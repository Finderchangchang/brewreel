// @ts-check
// brewreel_doctor (read-only environment check) and brewreel_setup (stage + npm ci +
// Chrome Headless Shell). Setup only ever runs fixed commands.
import fs from 'node:fs';
import path from 'node:path';
import {cleanEnv, runProcess} from './run.js';
import {isStaged, stageSkill} from './skill-root.js';
import {TOOL_NAMES} from './skill.js';

/** @param {string} runtimeRoot */
export const remotionCli = (runtimeRoot) => path.join(runtimeRoot, 'template', 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
/** @param {string} runtimeRoot */
export const chromeDir = (runtimeRoot) => path.join(runtimeRoot, 'template', 'node_modules', '.remotion', 'chrome-headless-shell');

/** @param {string} dir */
const nonEmptyDir = (dir) => {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
};

/** Whether the render dependencies are in place. @param {string} runtimeRoot */
export function depsReady(runtimeRoot) {
  return fs.existsSync(remotionCli(runtimeRoot)) && nonEmptyDir(chromeDir(runtimeRoot));
}

/** npm's CLI script next to the running Node (spawning npm.cmd would need a shell on Windows). */
export function findNpmCli() {
  const dir = path.dirname(process.execPath);
  const candidates = [
    path.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(dir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

/** @param {string} p */
function writableAncestor(p) {
  let cur = path.resolve(p);
  for (;;) {
    if (fs.existsSync(cur)) {
      try {
        fs.accessSync(cur, fs.constants.W_OK);
        return true;
      } catch {
        return false;
      }
    }
    const parent = path.dirname(cur);
    if (parent === cur) return false;
    cur = parent;
  }
}

/**
 * @param {any} rt runtime context (see plugin.js)
 * @param {{deep?: boolean, workspace: string, signal?: AbortSignal}} o
 */
export async function runDoctor(rt, {deep = false, workspace, signal}) {
  const en = rt.lang === 'en';
  const root = rt.plan.runtimeRoot;
  /** @type {{id: string, ok: boolean, optional?: boolean, detail?: string, fix?: string}[]} */
  const checks = [];
  const nodeVer = process.versions.node;
  const [maj, min] = nodeVer.split('.').map(Number);
  checks.push({id: 'node', ok: maj > 22 || (maj === 22 && min >= 19), detail: `v${nodeVer} (${en ? 'needs' : '需要'} >=22.19)`});
  const srcOk = rt.source.mode !== 'missing';
  checks.push({id: 'skill-files', ok: srcOk, detail: srcOk ? `${rt.source.mode}: ${rt.source.root}` : rt.source.error, ...(srcOk ? {} : {fix: en ? 'set skillRoot to a BrewReel clone, or reinstall the plugin' : '把 skillRoot 配成一份 BrewReel clone，或重装插件'})});
  const staged = !rt.plan.staged || isStaged(root);
  checks.push({id: 'runtime-staged', ok: staged, detail: rt.plan.staged ? root : en ? 'runs in place' : '原地运行', ...(staged ? {} : {fix: `${TOOL_NAMES.setup}`})});
  const cli = fs.existsSync(remotionCli(root));
  checks.push({id: 'template-deps', ok: fs.existsSync(path.join(root, 'template', 'node_modules')), detail: path.join(root, 'template', 'node_modules'), fix: TOOL_NAMES.setup});
  checks.push({id: 'remotion-cli', ok: cli, ...(cli ? {} : {fix: TOOL_NAMES.setup})});
  const chrome = nonEmptyDir(chromeDir(root));
  checks.push({id: 'chrome-headless-shell', ok: chrome, detail: chromeDir(root), ...(chrome ? {} : {fix: TOOL_NAMES.setup})});
  // python + numpy/scipy (optional: music is silent without them)
  const py = rt.cfg.python || (process.platform === 'win32' ? 'python' : 'python3');
  const pr = await runProcess({cmd: py, args: ['-c', 'import sys, numpy, scipy; print(sys.version.split()[0])'], cwd: rt.plan.runtimeDir && fs.existsSync(rt.plan.runtimeDir) ? rt.plan.runtimeDir : process.cwd(), env: cleanEnv(), timeoutMs: 20_000, signal});
  if (pr.spawnError) checks.push({id: 'python', ok: false, optional: true, detail: `${py}: ${pr.spawnError}`, fix: en ? 'install Python 3.10+ (optional; music is silent without it)' : '装 Python 3.10+（可选，缺了配乐静音）'});
  else {
    checks.push({id: 'python', ok: true, optional: true, detail: py});
    checks.push({id: 'python-numpy-scipy', ok: pr.code === 0, optional: true, detail: pr.code === 0 ? `Python ${pr.stdout.trim()}` : en ? 'missing: music will be silent, video still renders' : '缺少时配乐静音，不影响出片', ...(pr.code === 0 ? {} : {fix: `${py} -m pip install numpy scipy ${en ? '(run it yourself)' : '（由用户自己执行）'}`})});
  }
  checks.push({id: 'ffmpeg', ok: !!rt.cfg.ffmpeg, optional: true, detail: rt.cfg.ffmpeg || (en ? 'not set; contact sheets use Remotion instead' : '没设 FFMPEG，拼图改用 Remotion 合成')});
  const outRoot = path.resolve(workspace, rt.cfg.outputRoot);
  checks.push({id: 'output-writable', ok: writableAncestor(outRoot), detail: outRoot});
  let lock = 'free';
  const lockFile = path.join(root, 'template', '.render.lock');
  if (fs.existsSync(lockFile)) {
    try {
      const l = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      lock = `held by pid ${l.pid ?? '?'}`;
    } catch {
      lock = 'present';
    }
  }
  checks.push({id: 'render-lock', ok: true, detail: lock});
  checks.push({id: 'skill-registered', ok: !!rt.skillRegistered, optional: true, detail: rt.skillRegistered ? rt.skillName || 'brewreel' : en ? 'skills service not loaded or registerSkill: false; the tools still work' : 'skills 服务没加载或 registerSkill 关了；工具照常可用'});
  if (deep && srcOk && staged) {
    const r = await runProcess({cmd: process.execPath, args: [path.join(root, 'scripts', 'validate.mjs'), '--specs'], cwd: root, env: cleanEnv(), timeoutMs: 30_000, signal});
    checks.push({id: 'specs', ok: r.code === 0, detail: (r.stdout || r.stderr).trim().split(/\r?\n/).slice(-3).join(' | ')});
  }
  const ready = checks.every((c) => c.ok || c.optional);
  const info = rt.sourceInfo ?? {};
  return {
    ready,
    mode: rt.source.mode,
    skillSource: rt.source.root,
    runtimeRoot: root,
    pluginVersion: rt.pluginVersion,
    skillVersion: rt.skillVersion ?? info.skillVersion ?? null,
    repoCommit: info.repoCommit ?? null,
    checks,
    nextStep: ready
      ? en ? 'Ready: pick a style with brewreel_catalog and write the storyboard' : '环境就绪：用 brewreel_catalog 选风格，然后写分镜'
      : !srcOk
        ? en ? 'Skill files are missing: fix skillRoot or reinstall the plugin' : 'skill 文件缺失：检查 skillRoot 或重装插件'
        : en ? `Call ${TOOL_NAMES.setup} to install render dependencies (several hundred MB — ask the user first)` : `调 ${TOOL_NAMES.setup} 安装渲染依赖（约几百 MB，先问用户）`,
  };
}

/**
 * @param {any} rt
 * @param {{steps?: string[], signal?: AbortSignal, onLine?: (line: string) => void, onProgress?: (p: string) => void}} o
 */
export async function runSetup(rt, {steps = ['stage', 'deps', 'browser'], signal, onLine, onProgress} = {}) {
  const want = new Set(steps);
  const root = rt.plan.runtimeRoot;
  /** @type {{id: string, status: 'done' | 'skipped' | 'failed', detail: string, durationSec: number}[]} */
  const out = [];
  let failed = false;
  /** @param {string} id @param {() => Promise<{status: 'done' | 'skipped' | 'failed', detail: string}>} fn */
  const step = async (id, fn) => {
    if (!want.has(id)) return;
    if (failed) {
      out.push({id, status: 'skipped', detail: 'previous step failed', durationSec: 0});
      return;
    }
    onProgress?.(id);
    const t0 = Date.now();
    let r;
    try {
      r = await fn();
    } catch (e) {
      r = {status: /** @type {const} */ ('failed'), detail: String(/** @type {any} */ (e)?.message ?? e)};
    }
    if (r.status === 'failed') failed = true;
    out.push({id, ...r, durationSec: Math.round((Date.now() - t0) / 1000)});
  };
  /** @param {string[]} args @param {number} timeoutMs @param {boolean} proxy */
  const node = async (args, timeoutMs, proxy) => {
    const r = await runProcess({cmd: process.execPath, args, cwd: path.join(root, 'template'), env: cleanEnv({proxy, passthrough: rt.cfg.envPassthrough}), timeoutMs, signal, onLine: (l) => onLine?.(l.slice(0, 500))});
    if (r.spawnError) return {status: /** @type {const} */ ('failed'), detail: r.spawnError};
    if (r.timedOut || r.aborted) return {status: /** @type {const} */ ('failed'), detail: r.timedOut ? 'timed out' : 'cancelled'};
    if (r.code !== 0) return {status: /** @type {const} */ ('failed'), detail: `exit ${r.code}: ${(r.stderr || r.stdout).trim().split(/\r?\n/).slice(-6).join(' | ')}`};
    return {status: /** @type {const} */ ('done'), detail: (r.stdout || r.stderr).trim().split(/\r?\n/).slice(-2).join(' | ')};
  };
  await step('stage', async () => {
    if (rt.source.mode === 'missing') return {status: 'failed', detail: rt.source.error ?? 'skill source missing'};
    return stageSkill(rt.source, rt.plan);
  });
  await step('deps', async () => {
    if (fs.existsSync(remotionCli(root))) return {status: 'skipped', detail: 'template/node_modules already installed'};
    const npmCli = findNpmCli();
    if (!npmCli) return {status: 'failed', detail: `npm not found next to ${process.execPath}; run "npm ci" yourself in ${path.join(root, 'template')}`};
    const args = [npmCli, 'ci', '--no-audit', '--no-fund'];
    if (rt.cfg.npmRegistry) args.push(`--registry=${rt.cfg.npmRegistry}`);
    return node(args, 30 * 60_000, true);
  });
  await step('browser', async () => {
    if (nonEmptyDir(chromeDir(root))) return {status: 'skipped', detail: 'Chrome Headless Shell already present'};
    if (!fs.existsSync(remotionCli(root))) return {status: 'failed', detail: 'template dependencies missing (run the deps step first)'};
    const r = await node([remotionCli(root), 'browser', 'ensure'], 30 * 60_000, true);
    if (r.status === 'failed') r.detail += rt.lang === 'en' ? ' — see the README troubleshooting section for downloading Chrome Headless Shell behind a firewall' : ' —— 国内网络下载失败的处理见 README 故障排查一节';
    return r;
  });
  return {ok: !failed, steps: out};
}
