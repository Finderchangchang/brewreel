// @ts-check
// brewreel_render / brewreel_verify: run make.mjs with a fixed argv, stream progress, and
// assemble a result where `video` is present only when every delivery condition holds.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {describeExit} from './exit-codes.js';
import {allowedRoots, assertArgPath, assertOutDir, assertOutDirSafe, markOutDir, PathRuleError, resolveUserPath} from './paths.js';
import {cleanEnv, runProcess} from './run.js';
import {resolveInputs, spawnValidate} from './validate.js';

const LINE_MAX = 500;

/** Runtime root from the plugin context (rt.plan) or a plain {runtimeRoot}. @param {any} rt */
const rootOf = (rt) => rt.plan?.runtimeRoot ?? rt.runtimeRoot;

/**
 * Map one make.mjs output line to a short progress line, or null.
 * @param {string} line
 * @param {'zh' | 'en'} [lang]
 */
export function parseProgress(line, lang = 'zh') {
  const en = lang === 'en';
  const s = line.replace(/^\[make\s+\d+s\]\s*/, '').trim();
  if (!s) return null;
  if (s.startsWith('输出目录：')) return en ? 'preparing' : '准备中';
  if (s.startsWith('生成配乐')) return en ? 'generating music' : '配乐中';
  if (s.startsWith('配乐 OK')) return en ? 'music ready' : '配乐完成';
  if (s.startsWith('配乐失败')) return en ? 'music failed (silent)' : '配乐失败（静音）';
  if (s.includes('排队中')) return (en ? 'queued: ' : '排队中：') + s.slice(0, 120);
  if (s.startsWith('拿到渲染锁')) return en ? 'render lock acquired' : '拿到渲染锁';
  const stillM = /^出单帧\s+([\d.]+)s/.exec(s);
  if (stillM) return en ? `rendering still at ${stillM[1]}s` : `出单帧 ${stillM[1]}s`;
  if (s.startsWith('渲染整片')) return en ? 'rendering started' : '开始渲染';
  const fr = /（(\d+)\/(\d+)\s*帧?）|\((\d+)\/(\d+)/.exec(s);
  if (/渲染中/.test(s) && fr) {
    const a = Number(fr[1] ?? fr[3]);
    const b = Number(fr[2] ?? fr[4]);
    const pct = b > 0 ? Math.round((a / b) * 100) : 0;
    return en ? `rendering ${a}/${b} frames (${pct}%)` : `渲染 ${a}/${b} 帧（${pct}%）`;
  }
  if (/渲染中/.test(s)) return en ? 'rendering' : '渲染中';
  if (s.startsWith('渲染完成')) return en ? 'render finished' : '渲染完成';
  if (/拼图/.test(s)) return en ? 'contact sheet' : '拼图';
  if (/检查帧/.test(s)) return en ? 'check frames' : '抽检查帧';
  if (/空帧/.test(s)) return en ? 'blank-frame check' : '空帧检查';
  return null;
}

/** @param {string} file */
const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** @param {string} file */
const readJsonSafe = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
};

/**
 * @typedef {object} RenderPlan
 * @property {string} storyboard
 * @property {string} [brief]
 * @property {string} outDir
 * @property {number[] | undefined} stills
 * @property {boolean} bgm
 * @property {number} queueTimeoutMin
 * @property {string[]} argv arguments after process.execPath
 */

/**
 * Validate the model's arguments and build make.mjs argv. Only verified absolute paths and numbers
 * reach argv; --round / --allow-in-repo / --accept-layout / --keep are never passed.
 * @param {{storyboard: string, brief?: string, outDir?: string, stills?: number[], bgm?: boolean, queueTimeoutMin?: number}} args
 * @param {{runtimeRoot: string, roots: ReturnType<typeof allowedRoots>, cfg: import('./config.js').BrewreelConfig, verify?: boolean}} o
 * @returns {RenderPlan}
 */
export function planRender(args, {runtimeRoot, roots, cfg, verify = false}) {
  const {storyboard, brief} = resolveInputs(args, roots);
  const outDir = args.outDir ? resolveUserPath(args.outDir, roots.workspace, 'outDir') : path.dirname(storyboard);
  assertOutDir(outDir, roots);
  if (!verify) assertOutDirSafe(outDir, storyboard);
  /** @type {number[] | undefined} */
  let stills;
  if (args.stills !== undefined) {
    if (!Array.isArray(args.stills) || args.stills.length === 0 || args.stills.length > 12) throw new PathRuleError('stills must be a list of 1–12 seconds, e.g. [0, 3.5]');
    for (const s of args.stills) if (typeof s !== 'number' || !Number.isFinite(s) || s < 0 || s > 120) throw new PathRuleError(`stills entries must be seconds between 0 and 120, got ${JSON.stringify(s)}`);
    stills = args.stills;
  }
  const q = args.queueTimeoutMin ?? cfg.queueTimeoutMin;
  if (!Number.isFinite(q) || q < 1 || q > 120) throw new PathRuleError('queueTimeoutMin must be between 1 and 120 minutes');
  const bgm = args.bgm ?? cfg.bgm;
  const argv = [path.join(runtimeRoot, 'scripts', 'make.mjs'), assertArgPath(storyboard), '--out', assertArgPath(outDir)];
  if (verify) argv.push('--verify');
  else {
    if (brief) argv.push('--brief', assertArgPath(brief));
    if (stills) argv.push('--stills', stills.map((n) => String(Number(n))).join(','));
    if (!bgm) argv.push('--no-bgm');
    argv.push('--queue-timeout', String(Math.round(q)));
  }
  return {storyboard, brief, outDir, stills, bgm, queueTimeoutMin: q, argv};
}

/**
 * Environment for make.mjs. Besides the base whitelist it passes the fixed voice-over variables
 * (MINIMAX_API_KEY / MINIMAX_GROUP_ID / MINIMAX_BASE_URL / BREWREEL_TTS_CACHE) so a storyboard with
 * meta.voice can be voiced; no other key reaches the render process, and validate / doctor never get them.
 * @param {import('./config.js').BrewreelConfig} cfg
 */
export function makeEnv(cfg) {
  return cleanEnv({
    passthrough: cfg.envPassthrough,
    voice: true,
    extra: {PYTHON: cfg.python || (process.platform === 'win32' ? 'python' : 'python3'), FFMPEG: cfg.ffmpeg || undefined},
  });
}

/** Last non-empty line of a text. @param {string} s */
const lastLine = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() ?? '';

/**
 * Assemble the canonical render result from exit status, stdout and the files make.mjs wrote.
 * @param {{code: number | null, stdout: string, killed: boolean, durationMs: number}} run
 * @param {RenderPlan} plan
 * @param {{lang: 'zh' | 'en', validation?: any}} o
 */
export function assembleRenderResult(run, plan, {lang, validation = null}) {
  const stills = !!plan.stills;
  const {status, exitMeaning, nextStep} = describeExit(run.code, {stills, lang, killed: run.killed});
  const manifestPath = path.join(plan.outDir, 'manifest.json');
  const manifest = readJsonSafe(manifestPath);
  const deliveryLine = lastLine(run.stdout);
  const mv = manifest?.video;
  /** @type {any} */
  let video = null;
  if (!run.killed && run.code === 0 && !stills && deliveryLine.startsWith('交付：') && manifest?.status === 'delivered' && mv?.path && fs.existsSync(mv.path)) {
    const actual = sha256File(mv.path);
    if (actual === mv.sha256 && path.resolve(deliveryLine.slice(3).trim()) === path.resolve(mv.path)) {
      video = {path: mv.path, sha256: mv.sha256, durationSec: mv.durationSec ?? null, bytes: mv.bytes ?? fs.statSync(mv.path).size};
    }
  }
  const rejected = path.join(plan.outDir, 'video.rejected.mp4');
  const checkDir = path.join(plan.outDir, 'check');
  let checkFrames = [];
  try {
    checkFrames = fs.readdirSync(checkDir).filter((f) => /\.png$/i.test(f)).sort().map((f) => path.join(checkDir, f));
  } catch {}
  /** @type {Record<string, string>} */
  const checks = {};
  const failures = [];
  for (const [k, v] of Object.entries(manifest?.checks ?? {})) {
    if (k === 'validate') continue;
    const vv = /** @type {any} */ (v);
    checks[k] = vv?.ok === true ? 'ok' : vv?.ok === false ? 'fail' : vv?.skipped ? 'skipped' : 'n/a';
    if (vv?.ok === false) for (const i of vv.issues ?? []) failures.push(`${k}: ${String(i).replace(/^\s*✗\s*/, '')}`);
  }
  for (const l of run.stdout.split(/\r?\n/)) if (/^\s+✗\s/.test(l) && failures.length < 40 && !failures.some((f) => f.endsWith(l.trim().replace(/^✗\s*/, '')))) failures.push(l.trim().replace(/^✗\s*/, ''));
  const sheet = manifest?.sheet && fs.existsSync(manifest.sheet) ? manifest.sheet : null;
  const en = lang === 'en';
  return {
    status,
    exitCode: run.code,
    exitMeaning,
    delivered: !!video,
    deliveryLine: deliveryLine.startsWith('交付：') ? deliveryLine : null,
    video,
    sheet: video ? sheet : null,
    outDir: plan.outDir,
    checkDir,
    checkFrames: checkFrames.slice(0, 40),
    report: fs.existsSync(path.join(plan.outDir, 'report.txt')) ? path.join(plan.outDir, 'report.txt') : null,
    manifest: manifest ? manifestPath : null,
    checks,
    failures: failures.slice(0, 40),
    rejectedPreview: fs.existsSync(rejected)
      ? {path: rejected, sheet: fs.existsSync(path.join(plan.outDir, 'sheet.rejected.png')) ? path.join(plan.outDir, 'sheet.rejected.png') : null, note: en ? 'only for a human to see what broke — never deliver it' : '只给人看哪里坏了，不能交付'}
      : null,
    validation: validation && !validation.ok ? {errors: validation.errors, counts: validation.counts} : null,
    humanReview: validation?.human ?? [],
    durationSec: Math.round(run.durationMs / 1000),
    nextStep,
  };
}

/**
 * Short model-facing text for a render result.
 * @param {any} r
 * @param {'zh' | 'en'} lang
 */
export function renderResultText(r, lang) {
  const en = lang === 'en';
  if (r.kind === 'background') {
    return en
      ? `Started background render job ${r.jobId} → ${r.outDir}. Follow it with job_output (job_id: ${r.jobId}); the final JSON is the job result. Deliver only video.path from that result.${r.note ? ` ${r.note}` : ''}`
      : `已在后台开始出片，任务 ${r.jobId} → ${r.outDir}。用 job_output（job_id: ${r.jobId}）看进度；完成后结果 JSON 在任务的 result 里，交付只认其中的 video.path。${r.note ? ` ${r.note}` : ''}`;
  }
  const lines = [];
  lines.push(`${en ? 'status' : '状态'}: ${r.status} (exit ${r.exitCode ?? 'none'}: ${r.exitMeaning})`);
  if (r.video) lines.push(`${en ? 'deliverable video' : '成片（可交付）'}: ${r.video.path} (${r.video.durationSec ?? '?'}s, sha256 ${String(r.video.sha256).slice(0, 12)}…)`);
  else lines.push(en ? 'no deliverable video' : '没有可交付的成片');
  if (r.sheet) lines.push(`${en ? 'contact sheet' : '拼图'}: ${r.sheet}`);
  if (r.checkFrames?.length) lines.push(`${en ? 'check frames' : '检查帧'}: ${r.checkFrames.length} → ${r.checkDir}`);
  if (r.failures?.length) lines.push(`${en ? 'failures' : '未通过项'}:\n${r.failures.map((/** @type {string} */ f) => `  ✗ ${f}`).join('\n')}`);
  if (r.rejectedPreview) lines.push(`${en ? 'rejected preview (do not deliver)' : '失败预览（不能交付）'}: ${r.rejectedPreview.path}`);
  if (r.validation?.errors?.length) lines.push(`${en ? 'validation errors' : '校验错误'}:\n${r.validation.errors.map((/** @type {any} */ e, /** @type {number} */ k) => `${k + 1}. ${e.where}: ${e.problem} → ${e.fix}`).join('\n')}`);
  if (r.humanReview?.length) lines.push(`${en ? 'human review (list for the user)' : '需人工复核（原样列给用户）'}:\n${r.humanReview.map((/** @type {any} */ e) => `  - ${e.where}: ${e.problem}`).join('\n')}`);
  if (r.report) lines.push(`report: ${r.report}`);
  lines.push(`${en ? 'next' : '下一步'}: ${r.nextStep}`);
  return lines.join('\n');
}

/**
 * Run make.mjs once for a plan. Never throws for process-level failures; returns the assembled result.
 * @param {any} rt plugin runtime (rt.plan.runtimeRoot, rt.cfg, rt.lang)
 * @param {RenderPlan} plan
 * @param {{signal?: AbortSignal, onLine?: (line: string) => void, onProgress?: (p: string) => void}} o
 */
export async function executeRender(rt, plan, {signal, onLine, onProgress} = {}) {
  markOutDir(plan.outDir, plan.storyboard);
  const run = await runProcess({
    cmd: process.execPath,
    args: plan.argv,
    cwd: rootOf(rt),
    env: makeEnv(rt.cfg),
    timeoutMs: rt.cfg.renderTimeoutMin * 60_000,
    signal,
    onLine: (line) => {
      const clipped = line.length > LINE_MAX ? `${line.slice(0, LINE_MAX)}…` : line;
      onLine?.(clipped);
      const p = parseProgress(line, rt.lang);
      if (p) onProgress?.(p);
    },
  });
  const killed = run.timedOut || run.aborted || (run.code === null && !run.spawnError);
  if (run.spawnError) throw new Error(`could not start make.mjs: ${run.spawnError}`);
  /** @type {any} */
  let validation = null;
  if (!killed && (run.code === 0 || run.code === 1 || run.code === 3) && !plan.stills) {
    try {
      const v = await spawnValidate({runtimeRoot: rootOf(rt), storyboard: plan.storyboard, brief: plan.brief, signal});
      validation = {ok: !!v.ok, errors: v.errors ?? [], human: v.human ?? [], counts: {errors: (v.errors ?? []).length, warnings: (v.warnings ?? []).length, human: (v.human ?? []).length}};
    } catch {}
  }
  const result = assembleRenderResult({code: run.code, stdout: run.stdout, killed, durationMs: run.durationMs}, plan, {lang: rt.lang, validation});
  if (killed) {
    const en = rt.lang === 'en';
    result.exitMeaning = run.timedOut
      ? en ? `killed after renderTimeoutMin (${rt.cfg.renderTimeoutMin} min)` : `超过 renderTimeoutMin（${rt.cfg.renderTimeoutMin} 分钟），已终止`
      : en ? 'cancelled; the process tree was terminated' : '已取消，进程树已终止';
  }
  return result;
}

/**
 * make.mjs --verify.
 * @param {any} rt plugin runtime plus signal
 * @param {RenderPlan} plan
 */
export async function executeVerify(rt, plan) {
  const run = await runProcess({cmd: process.execPath, args: plan.argv, cwd: rootOf(rt), env: makeEnv(rt.cfg), timeoutMs: 60_000, signal: rt.signal});
  if (run.spawnError) throw new Error(`could not start make.mjs: ${run.spawnError}`);
  if (run.timedOut || run.aborted) throw new Error('verify did not finish (timeout or cancelled)');
  const ok = run.code === 0;
  const manifest = readJsonSafe(path.join(plan.outDir, 'manifest.json'));
  const video = ok && manifest?.video?.path && fs.existsSync(manifest.video.path) ? manifest.video.path : null;
  const en = rt.lang === 'en';
  return {
    ok,
    exitCode: run.code,
    lines: run.stdout.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean).slice(0, 40),
    video,
    outDir: plan.outDir,
    nextStep: ok
      ? en ? 'Deliver the path in video to the user' : '把 video 里的路径交给用户'
      : en ? 'The storyboard changed or there is no deliverable video: call brewreel_render again' : '分镜改过了或没有可交付的成片：重新调 brewreel_render',
  };
}
