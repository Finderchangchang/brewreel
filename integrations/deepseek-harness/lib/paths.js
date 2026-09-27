// @ts-check
// Path normalization and containment. Every comparison happens on real paths (symlinks and junctions
// resolved), case-insensitively on Windows, so a link inside the workspace cannot point the tools elsewhere.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WIN = process.platform === 'win32';

/** Error whose message tells the model what to do instead. */
export class PathRuleError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'PathRuleError';
  }
}

/**
 * realpath of the longest existing ancestor, with the missing tail appended. Works for outputs that do
 * not exist yet.
 * @param {string} p absolute path
 */
export function realpathLoose(p) {
  let cur = path.resolve(p);
  /** @type {string[]} */
  const tail = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native(cur);
      return tail.length ? path.join(real, ...tail.reverse()) : real;
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(p);
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

/** @param {string} p */
const norm = (p) => {
  const r = path.resolve(p);
  return WIN ? r.toLowerCase() : r;
};

/** Whether `child` equals or sits under `parent` (both already real). */
export function isInside(child, parent) {
  const rel = path.relative(norm(parent), norm(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** @param {string} a @param {string} b */
export const samePath = (a, b) => norm(a) === norm(b);

/**
 * Resolve a model-supplied path against the workspace. Rejects empty strings and NUL bytes.
 * @param {unknown} input
 * @param {string} workspace
 * @param {string} field name for the error message
 */
export function resolveUserPath(input, workspace, field) {
  if (typeof input !== 'string' || !input.trim()) throw new PathRuleError(`${field} must be a non-empty path (relative to the workspace, or absolute)`);
  if (input.includes('\0')) throw new PathRuleError(`${field} contains a NUL byte`);
  return realpathLoose(path.resolve(workspace, input.trim()));
}

/**
 * The directories the tools may read inputs from / write outputs into.
 * @param {{workspace: string, outputRoot: string, extraWriteRoots: string[]}} o
 */
export function allowedRoots({workspace, outputRoot, extraWriteRoots}) {
  const ws = realpathLoose(workspace);
  const out = realpathLoose(path.resolve(ws, outputRoot));
  const extra = (extraWriteRoots ?? []).filter((x) => typeof x === 'string' && path.isAbsolute(x)).map((x) => realpathLoose(x));
  return {workspace: ws, outputRoot: out, extra, all: [ws, out, ...extra]};
}

/**
 * Inputs (storyboard, brief) must live in the workspace, the output root, or an extra root.
 * @param {string} abs real path
 * @param {ReturnType<typeof allowedRoots>} roots
 * @param {string} field
 */
export function assertReadable(abs, roots, field) {
  if (!roots.all.some((r) => isInside(abs, r))) {
    throw new PathRuleError(`${field} ${abs} is outside the workspace (${roots.workspace}); move it into the workspace, or add its folder to the plugin's extraWriteRoots`);
  }
}

/**
 * Output folders: inside the workspace / an extra root, never the workspace itself, the output root
 * itself, the home folder or a drive root (make.mjs clears fixed product file names there).
 * @param {string} abs real path
 * @param {ReturnType<typeof allowedRoots>} roots
 */
export function assertOutDir(abs, roots) {
  if (!roots.all.some((r) => isInside(abs, r))) {
    throw new PathRuleError(`outDir ${abs} is outside the workspace (${roots.workspace}); use a folder such as ${path.join(roots.outputRoot, '<name>')}`);
  }
  const forbidden = [roots.workspace, roots.outputRoot, ...roots.extra, realpathLoose(os.homedir()), path.parse(abs).root];
  if (forbidden.some((f) => samePath(f, abs))) {
    throw new PathRuleError(`outDir ${abs} is a root folder; give each video its own sub-folder, e.g. ${path.join(roots.outputRoot, '<name>')}`);
  }
}

/** Marker the render tool writes into every outDir before make.mjs runs (make.mjs leaves other files alone). */
export const OUT_MARKER = '.brewreel-out.json';

/** Marker names written by earlier versions of this plugin (dsh-distill-video 0.1.x); still recognised. */
export const LEGACY_OUT_MARKERS = Object.freeze(['.distill-video-out.json']);

/** Whether this plugin (under its current or an earlier name) has marked outDir. @param {string} outDir */
const hasOutMarker = (outDir) => [OUT_MARKER, ...LEGACY_OUT_MARKERS].some((m) => fs.existsSync(path.join(outDir, m)));

/**
 * File names make.mjs deletes in outDir before it starts (mirror of PRODUCT_FILES in the skill's
 * scripts/lib/delivery.mjs, plus check/*.png). storyboard.json is handled separately.
 */
export const MAKE_PRODUCT_FILES = Object.freeze([
  'video.mp4', 'video.rejected.mp4', 'sheet.png', 'sheet.rejected.png', 'sheet-props.json', 'props.json',
  'layout.json', 'report.txt', 'manifest.json', 'bgm.wav', 'DELIVERED.json', 'video.meta.json',
]);

/** Whether a parsed manifest.json looks like one make.mjs wrote (it always records status and exitCode). @param {any} m */
const isMakeManifest = (m) => !!m && typeof m === 'object' && typeof m.status === 'string' && 'exitCode' in m;

/**
 * make.mjs removes a fixed list of product file names in outDir before it starts. Refuse folders where
 * that could delete the user's own files: a storyboard.json that is neither this storyboard nor a copy
 * make wrote, or any of make's product file names (video.mp4, report.txt, layout.json, check/*.png …)
 * in a folder that neither make (manifest.json) nor this plugin (marker file) has rendered into.
 * @param {string} outDir real path
 * @param {string} storyboard real path
 */
export function assertOutDirSafe(outDir, storyboard) {
  if (!fs.existsSync(outDir)) return;
  const manifestPath = path.join(outDir, 'manifest.json');
  /** @type {any} */
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/, ''));
  } catch {}
  const ours = hasOutMarker(outDir) || isMakeManifest(manifest);
  const sbCopy = path.join(outDir, 'storyboard.json');
  if (fs.existsSync(sbCopy) && !samePath(realpathLoose(sbCopy), storyboard)) {
    const madeByMake = manifest?.storyboard?.copy && samePath(String(manifest.storyboard.copy), sbCopy);
    if (!madeByMake && !hasOutMarker(outDir)) {
      throw new PathRuleError(`outDir ${outDir} already holds a different storyboard.json that this tool did not write; rendering there would overwrite it. Use another outDir (one folder per video)`);
    }
  }
  if (ours) return;
  const clobbered = MAKE_PRODUCT_FILES.filter((f) => fs.existsSync(path.join(outDir, f)));
  try {
    if (fs.readdirSync(path.join(outDir, 'check')).some((f) => /\.png$/i.test(f))) clobbered.push('check/*.png');
  } catch {}
  if (clobbered.length) {
    throw new PathRuleError(`outDir ${outDir} holds ${clobbered.join(', ')} that this tool did not produce (no manifest.json from a previous render); rendering there would delete them. Use a new folder such as promo/<name>/ (one folder per video)`);
  }
}

/**
 * Mark outDir as rendered by this plugin, so a later render into the same folder (for example after a
 * timeout left partial files and no manifest) is not refused. Best effort.
 * @param {string} outDir real path
 * @param {string} storyboard real path
 */
export function markOutDir(outDir, storyboard) {
  try {
    fs.mkdirSync(outDir, {recursive: true});
    fs.writeFileSync(path.join(outDir, OUT_MARKER), `${JSON.stringify({by: 'dsh-brewreel', storyboard, at: new Date().toISOString()}, null, 1)}\n`);
  } catch {}
}

/**
 * Every argv element built from model input must be an absolute path, which can never be mistaken
 * for a --flag.
 * @param {string} p
 */
export function assertArgPath(p) {
  if (!path.isAbsolute(p) || p.startsWith('-')) throw new PathRuleError(`internal: refusing non-absolute argument ${JSON.stringify(p)}`);
  return p;
}

const ASSET_KEY = /^(src|image|img|photo|screen|screenshot|logo|avatar|file|video|before|after|icon|cover|poster)$/i;
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|svg|bmp|mp4|mov|webm|m4v|wav|mp3)$/i;

/**
 * Collect file references in a storyboard (meta.assets[].src plus media-like string fields in shots)
 * and report the ones that resolve outside the storyboard folder and the workspace.
 * @param {any} sb parsed storyboard
 * @param {string} sbDir real folder of the storyboard
 * @param {ReturnType<typeof allowedRoots>} roots
 * @returns {{where: string, problem: string, fix: string}[]}
 */
export function assetEscapes(sb, sbDir, roots) {
  /** @type {{where: string, ref: string}[]} */
  const refs = [];
  /** @param {any} v @param {string} where @param {string} key */
  const walk = (v, where, key) => {
    if (typeof v === 'string') {
      if ((ASSET_KEY.test(key) || MEDIA_EXT.test(v)) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && !/^data:/i.test(v) && v.length < 1024) {
        if (/[\\/]/.test(v) || MEDIA_EXT.test(v)) refs.push({where, ref: v});
      }
      return;
    }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, where ? `${where}.${k}` : k, k);
  };
  walk(sb?.meta?.assets, 'meta.assets', '');
  (Array.isArray(sb?.shots) ? sb.shots : []).forEach((/** @type {any} */ shot, i) => walk(shot, `shots[${i}]${shot?.type ? `(${shot.type})` : ''}`, ''));
  /** @type {{where: string, problem: string, fix: string}[]} */
  const out = [];
  for (const {where, ref} of refs) {
    const abs = realpathLoose(path.resolve(sbDir, ref));
    if (isInside(abs, sbDir) || roots.all.some((r) => isInside(abs, r))) continue;
    out.push({
      where,
      problem: `asset path "${ref}" points outside the storyboard folder and the workspace (${abs})`,
      fix: 'copy the file into the storyboard folder and reference it by file name',
    });
  }
  return out;
}
