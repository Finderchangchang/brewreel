// @ts-check
// Where the skill comes from (configured clone / the checkout around this plugin / the bundled snapshot)
// and where it runs (in place, or a staged copy under the runtime directory).
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isInside, realpathLoose} from './paths.js';

export const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Files and folders that make up a runnable skill. Everything else in the repository stays out. */
export const WHITELIST = Object.freeze({
  files: [
    'SKILL.md', 'SKILL.en.md', 'shots.md', 'shots.en.md', 'brief-template.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_LICENSES.md',
    // 分流表点名的文档：风格工厂、动效外观。口播步骤在 broll/，不把 tests、参考片、任务书带进来。
    'docs/style-factory.md', 'docs/style-factory.en.md', 'docs/motion-looks.md', 'docs/motion-looks.en.md',
  ],
  dirs: ['scripts', 'styles', 'industries', 'examples', 'docs/shots', 'docs/images', 'template', 'broll'],
  exclude: ['template/node_modules', 'template/public/_run', 'template/public/_dev', 'template/out', 'template/.render.lock', 'scripts/__pycache__', 'docs/images/contact'],
});

/** @param {string} dir */
export const isSkillRoot = (dir) => !!dir && fs.existsSync(path.join(dir, 'SKILL.md')) && fs.existsSync(path.join(dir, 'scripts', 'make.mjs'));

/**
 * @typedef {object} SkillSource
 * @property {'configured' | 'checkout' | 'bundled' | 'missing'} mode
 * @property {string} root
 * @property {string} [error]
 */

/**
 * Lookup order: configured skillRoot → the checkout two levels above the plugin (not inside
 * node_modules) → the bundled `skill/` snapshot.
 * @param {{skillRoot?: string, pluginDir?: string}} o
 * @returns {SkillSource}
 */
export function findSkillSource({skillRoot = '', pluginDir = PLUGIN_DIR} = {}) {
  if (skillRoot) {
    const abs = realpathLoose(path.resolve(skillRoot));
    if (isSkillRoot(abs)) return {mode: 'configured', root: abs};
    return {mode: 'missing', root: abs, error: `skillRoot ${abs} has no SKILL.md + scripts/make.mjs`};
  }
  const realPlugin = realpathLoose(pluginDir);
  const inNodeModules = realPlugin.split(/[\\/]/).includes('node_modules');
  const checkout = path.resolve(realPlugin, '..', '..');
  if (!inNodeModules && isSkillRoot(checkout)) return {mode: 'checkout', root: checkout};
  const bundled = path.join(realPlugin, 'skill');
  if (isSkillRoot(bundled)) return {mode: 'bundled', root: bundled};
  return {mode: 'missing', root: bundled, error: 'no skill found: neither a BrewReel checkout around the plugin nor a bundled skill/ snapshot'};
}

/** @param {string} a @param {string} b */
function samePath(a, b) {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

/** @param {string} rel */
function whitelistedRel(rel) {
  const norm = rel.split('\\').join('/');
  if (WHITELIST.exclude.some((ex) => norm === ex || norm.startsWith(ex + '/'))) return false;
  if (WHITELIST.files.includes(norm)) return true;
  return WHITELIST.dirs.some((d) => norm === d || norm.startsWith(d + '/'));
}

/**
 * Tracked files when `root` is a git worktree root. null = not a checkout (caller walks the disk).
 * An empty array means the checkout has no tracked files; do not fall back to the walk.
 * @param {string} root
 * @returns {string[] | null}
 */
function gitTrackedFiles(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return null;
  const top = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {encoding: 'utf8', windowsHide: true});
  if (top.status !== 0 || !top.stdout.trim()) return null;
  const topPath = top.stdout.trim();
  let same = samePath(topPath, root);
  if (!same) {
    try {
      same = samePath(fs.realpathSync(topPath), fs.realpathSync(root));
    } catch {
      same = false;
    }
  }
  if (!same) return null;
  const ls = spawnSync('git', ['-C', root, '-c', 'core.quotepath=false', 'ls-files', '-z'], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (ls.status !== 0) return null;
  return ls.stdout.split('\0').filter(Boolean);
}

/**
 * Relative paths (forward slashes, sorted) of every whitelisted file under `root`.
 * A git checkout contributes only `git ls-files` (ignored and untracked files stay out).
 * A directory that is not a checkout — plugin tests build these under the temp dir — is walked on disk.
 * @param {string} root
 */
export function listWhitelistFiles(root) {
  const tracked = gitTrackedFiles(root);
  if (tracked !== null) {
    /** @type {string[]} */
    const out = [];
    for (const rel0 of tracked) {
      const rel = rel0.split('\\').join('/');
      if (!whitelistedRel(rel)) continue;
      const abs = path.join(root, rel);
      let st;
      try {
        st = fs.lstatSync(abs);
      } catch {
        continue;
      }
      if (st.isSymbolicLink() || !st.isFile()) continue;
      out.push(rel);
    }
    return out.sort();
  }
  /** @type {string[]} */
  const out = [];
  const excluded = new Set(WHITELIST.exclude);
  /** @param {string} rel */
  const walk = (rel) => {
    if (excluded.has(rel)) return;
    const abs = path.join(root, rel);
    let st;
    try {
      st = fs.lstatSync(abs);
    } catch {
      return;
    }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) walk(rel ? `${rel}/${name}` : name);
    } else if (st.isFile()) out.push(rel);
  };
  for (const f of WHITELIST.files) walk(f);
  for (const d of WHITELIST.dirs) walk(d);
  return out.sort();
}

/**
 * Content hash of the whitelisted tree (paths + bytes).
 * @param {string} root
 * @param {string[]} [files]
 */
export function treeSha256(root, files = listWhitelistFiles(root)) {
  const h = crypto.createHash('sha256');
  for (const rel of files) {
    h.update(rel);
    h.update('\0');
    h.update(fs.readFileSync(path.join(root, rel)));
    h.update('\0');
  }
  return h.digest('hex');
}

/**
 * Cheap fingerprint (paths + sizes + mtimes) for deciding whether a staged copy of a live checkout is
 * still current.
 * @param {string} root
 */
export function statFingerprint(root) {
  const h = crypto.createHash('sha256');
  for (const rel of listWhitelistFiles(root)) {
    const st = fs.statSync(path.join(root, rel));
    h.update(`${rel}\0${st.size}\0${Math.floor(st.mtimeMs)}\n`);
  }
  return h.digest('hex');
}

/**
 * Copy the whitelisted tree to `dest` (created; must not exist or be empty).
 * @param {string} src
 * @param {string} dest
 * @param {string[]} [files]
 */
export function copyWhitelist(src, dest, files = listWhitelistFiles(src)) {
  for (const rel of files) {
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), {recursive: true});
    fs.copyFileSync(path.join(src, rel), to);
  }
  return files.length;
}

/** Runtime directory name used by plugin 0.1.x (published as dsh-distill-video); reused when present. */
export const LEGACY_RUNTIME_DIR_NAME = 'distill-video';

/**
 * Default runtime directory: $DSH_HOME/brewreel, or ~/.dsh/brewreel. When only the directory of plugin
 * 0.1.x ($DSH_HOME/distill-video) exists, that one is reused so its node_modules and Chrome Headless
 * Shell are not downloaded again.
 */
export function defaultRuntimeDir() {
  const home = process.env.DSH_HOME ? path.resolve(process.env.DSH_HOME) : path.join(os.homedir(), '.dsh');
  const current = path.join(home, 'brewreel');
  const legacy = path.join(home, LEGACY_RUNTIME_DIR_NAME);
  if (!fs.existsSync(current) && fs.existsSync(legacy)) return legacy;
  return current;
}

/** @param {string} root */
export function readSourceInfo(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.distill-source.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @typedef {object} RuntimePlan
 * @property {string} runtimeRoot where scripts run (the source itself, or the staging target)
 * @property {boolean} staged whether runtimeRoot is a staged copy
 * @property {string} runtimeDir
 * @property {string} [fingerprint]
 */

/**
 * Decide where the skill runs. Checkout / configured sources run in place unless stageCheckout is set;
 * bundled sources always run from a staged copy (package stores must stay read-only).
 * @param {SkillSource} source
 * @param {{stageCheckout?: boolean, runtimeDir?: string}} cfg
 * @returns {RuntimePlan}
 */
export function planRuntime(source, cfg) {
  const runtimeDir = realpathLoose(cfg.runtimeDir ? path.resolve(cfg.runtimeDir) : defaultRuntimeDir());
  if (source.mode === 'missing') return {runtimeRoot: source.root, staged: false, runtimeDir};
  const stage = source.mode === 'bundled' || !!cfg.stageCheckout;
  if (!stage) return {runtimeRoot: source.root, staged: false, runtimeDir};
  const info = source.mode === 'bundled' ? readSourceInfo(source.root) : null;
  const fingerprint = info?.treeSha256 ?? statFingerprint(source.root);
  return {runtimeRoot: path.join(runtimeDir, `skill-${fingerprint.slice(0, 8)}`), staged: true, runtimeDir, fingerprint};
}

/**
 * Hash of template/package-lock.json that ignores the root package's own name and version, so a rename
 * of the template package (promo-video-template → brewreel-template) or a version bump still reuses
 * installed node_modules; any dependency change gives a new hash.
 * @param {string} dir
 */
export const lockHash = (dir) => {
  let raw;
  try {
    raw = fs.readFileSync(path.join(dir, 'template', 'package-lock.json'));
  } catch {
    return null;
  }
  let data = raw;
  try {
    const lock = JSON.parse(raw.toString('utf8').replace(/^﻿/, ''));
    delete lock.name;
    delete lock.version;
    if (lock.packages?.['']) {
      delete lock.packages[''].name;
      delete lock.packages[''].version;
    }
    data = Buffer.from(JSON.stringify(lock));
  } catch {}
  return crypto.createHash('sha256').update(data).digest('hex');
};

/** @param {string} root */
export const isStaged = (root) => fs.existsSync(path.join(root, '.distill-staged.json')) && isSkillRoot(root);

/**
 * Copy the source into plan.runtimeRoot if it is not there yet. Reuses template/node_modules (with the
 * downloaded Chrome) from an older staged copy when package-lock.json's dependencies are unchanged, and keeps only the
 * two most recent staged copies.
 * @param {SkillSource} source
 * @param {RuntimePlan} plan
 * @returns {{status: 'done' | 'skipped', detail: string}}
 */
export function stageSkill(source, plan) {
  if (!plan.staged) return {status: 'skipped', detail: `runs in place: ${plan.runtimeRoot}`};
  if (isStaged(plan.runtimeRoot)) return {status: 'skipped', detail: `already staged: ${plan.runtimeRoot}`};
  if (isInside(plan.runtimeRoot, source.root)) throw new Error(`runtimeDir must not be inside the skill source (${source.root})`);
  fs.mkdirSync(plan.runtimeDir, {recursive: true});
  const tmp = `${plan.runtimeRoot}.tmp-${process.pid}-${Date.now().toString(36)}`;
  fs.rmSync(tmp, {recursive: true, force: true});
  const n = copyWhitelist(source.root, tmp);
  let reused = '';
  const myLock = lockHash(tmp);
  const siblings = fs
    .readdirSync(plan.runtimeDir)
    .filter((d) => /^skill-[0-9a-f]{8}$/.test(d) && path.join(plan.runtimeDir, d) !== plan.runtimeRoot)
    .map((d) => path.join(plan.runtimeDir, d))
    .filter((d) => isStaged(d))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const old of siblings) {
    const nm = path.join(old, 'template', 'node_modules');
    if (myLock && lockHash(old) === myLock && fs.existsSync(nm)) {
      fs.renameSync(nm, path.join(tmp, 'template', 'node_modules'));
      reused = ` (reused template/node_modules from ${path.basename(old)})`;
      break;
    }
  }
  fs.writeFileSync(path.join(tmp, '.distill-staged.json'), JSON.stringify({from: source.root, mode: source.mode, files: n, fingerprint: plan.fingerprint, stagedAt: new Date().toISOString()}, null, 2));
  fs.renameSync(tmp, plan.runtimeRoot);
  for (const old of siblings.slice(1)) {
    try {
      fs.rmSync(old, {recursive: true, force: true});
    } catch {}
  }
  return {status: 'done', detail: `staged ${n} files into ${plan.runtimeRoot}${reused}`};
}
