// @ts-check
// Where the skill comes from (configured clone / the checkout around this plugin / the bundled snapshot)
// and where it runs (in place, or a staged copy under the runtime directory).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isInside, realpathLoose} from './paths.js';

export const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Files and folders that make up a runnable skill. Everything else in the repository stays out. */
export const WHITELIST = Object.freeze({
  files: ['SKILL.md', 'SKILL.en.md', 'shots.md', 'shots.en.md', 'brief-template.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_LICENSES.md'],
  dirs: ['scripts', 'styles', 'industries', 'examples', 'docs/shots', 'docs/images', 'template'],
  exclude: ['template/node_modules', 'template/public/_run', 'template/public/_dev', 'template/out', 'template/.render.lock', 'scripts/__pycache__'],
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
  return {mode: 'missing', root: bundled, error: 'no skill found: neither a Distill Video checkout around the plugin nor a bundled skill/ snapshot'};
}

/**
 * Relative paths (forward slashes, sorted) of every whitelisted file under `root`.
 * @param {string} root
 */
export function listWhitelistFiles(root) {
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

/** Default runtime directory: $DSH_HOME/distill-video, or ~/.dsh/distill-video. */
export function defaultRuntimeDir() {
  const home = process.env.DSH_HOME ? path.resolve(process.env.DSH_HOME) : path.join(os.homedir(), '.dsh');
  return path.join(home, 'distill-video');
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

/** @param {string} dir */
const lockHash = (dir) => {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'template', 'package-lock.json'))).digest('hex');
  } catch {
    return null;
  }
};

/** @param {string} root */
export const isStaged = (root) => fs.existsSync(path.join(root, '.distill-staged.json')) && isSkillRoot(root);

/**
 * Copy the source into plan.runtimeRoot if it is not there yet. Reuses template/node_modules (with the
 * downloaded Chrome) from an older staged copy when package-lock.json is unchanged, and keeps only the
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
