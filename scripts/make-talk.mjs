#!/usr/bin/env node
// 口播配 B-roll：校验 → 计划 → 估价闸门 → 生成 → 审片（minimax-h3）→ 合成 → 交付。
//   node scripts/make-talk.mjs <项目目录> --out <输出目录> [--dry-run] [--provider placeholder|local|minimax-h3] [--yes] [--draft] [--only b01] [--concurrency 3] [--force-redo]
// 退出码：0 交付 / 1 校验没过 / 2 参数或输出目录在仓库里 / 3 超预算、没加 --yes、或重做次数到顶 / 4 生成、检查或渲染失败 / 5 还没审片
// --out 不许落在仓库里（promo/ 除外，或人手动加 --allow-in-repo）。--dry-run 只校验、写计划和估价，不生成。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractDeliveryFrames} from './broll/frames.mjs';
import {generateClips} from './broll/generate.mjs';
import {sha256File} from './broll/hash.mjs';
import {markApproved, saveLedger} from './broll/ledger.mjs';
import {ffmpeg} from './broll/media.mjs';
import {buildPlan, writePlan} from './broll/plan.mjs';
import {checkReview} from './broll/review.mjs';
import {ROOT, TEMPLATE} from './broll/root.mjs';
import {formatReport, loadBanned, loadProject, loadStyles, validateBroll} from './broll/validate.mjs';
import {QueueTimeoutError, acquireRenderLock} from './lib/render-lock.mjs';

const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const LOCK = path.join(TEMPLATE, '.render.lock');
const KNOWN = new Set(['--out', '--provider', '--dry-run', '--yes', '--keep', '--allow-in-repo', '--only', '--concurrency', '--draft', '--force-redo']);
const TAKES = new Set(['--out', '--provider', '--only', '--concurrency']);

const fail = (code, message) => {
  console.log(message);
  process.exit(code);
};

const argv = process.argv.slice(2);
for (const a of argv) {
  if (a.startsWith('--') && !KNOWN.has(a)) fail(2, `不认识的参数 ${a}\n用法：node scripts/make-talk.mjs <项目目录> --out <输出目录> [--dry-run] [--provider placeholder|local|minimax-h3] [--yes] [--draft] [--only b01] [--concurrency 3]`);
}
const positionals = [];
for (let i = 0; i < argv.length; i++) {
  if (TAKES.has(argv[i])) {
    i += 1;
    continue;
  }
  if (!argv[i].startsWith('--')) positionals.push(argv[i]);
}
const opt = (name) => {
  const i = argv.lastIndexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(name);

if (positionals.length !== 1 || !opt('--out')) {
  fail(2, '用法：node scripts/make-talk.mjs <项目目录> --out <输出目录> [--dry-run] [--provider placeholder|local|minimax-h3] [--yes] [--draft] [--only b01] [--concurrency 3]');
}

const projectDir = path.resolve(positionals[0]);
const outDir = path.resolve(opt('--out'));
const dryRun = has('--dry-run');
const yes = has('--yes');
const keep = has('--keep');
const draft = has('--draft');
const forceRedo = has('--force-redo');
const only = opt('--only');
const concurrency = opt('--concurrency') == null ? 3 : Number(opt('--concurrency'));
if (only && !/^b[0-9]{2}$/.test(only)) fail(2, `--only 要写成 b01 这样的段号，现在是 ${only}`);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) fail(2, '--concurrency 要是 1 到 12 的整数');

{
  const rel = path.relative(ROOT, outDir);
  const inRepo = !rel.startsWith('..') && !path.isAbsolute(rel);
  const inPromo = inRepo && (rel === 'promo' || rel.startsWith(`promo${path.sep}`));
  if (inRepo && !inPromo && !has('--allow-in-repo')) {
    fail(2, `输出目录在仓库里面：${outDir}\n测试 / 渲染产物请放仓库外：--out 给仓库外的绝对路径。确需放仓库内请加 --allow-in-repo。\nOutput folder is inside the repo; pass an absolute --out outside it.`);
  }
}

const loaded = loadProject(projectDir);
if (!loaded.ok) fail(loaded.exitCode, loaded.message);

const doc = loaded.doc;
if (opt('--provider')) doc.provider = opt('--provider');

const report = validateBroll(doc, {
  cues: loaded.cues,
  durationMs: loaded.media.durationMs,
  width: loaded.media.width,
  height: loaded.media.height,
  styles: loadStyles(),
  banned: loadBanned(),
  projectDir,
});
console.log(formatReport(report));
if (report.errors.length && !report.budgetExceeded) process.exit(1);
if (loaded.media.width % 2 || loaded.media.height % 2) {
  fail(1, `原片是 ${loaded.media.width}×${loaded.media.height}，有一边是奇数。yuv420 需要偶数宽高，先把口播裁成偶数。`);
}

const style = loadStyles()[doc.style];
const plan = buildPlan({doc, cues: loaded.cues, media: loaded.media, style, projectDir});
fs.mkdirSync(outDir, {recursive: true});
const planPath = writePlan(path.join(outDir, 'broll.plan.json'), plan);
console.log(`计划：${planPath}`);
if (doc.provider === 'minimax-h3' || plan.totalYuan > 0) {
  console.log('估价明细：');
  for (const c of plan.clips) console.log(`  ${c.id}  ${c.genSec} 秒 × ${plan.priceYuanPerSec} 元/秒 = ${c.costYuan} 元`);
  console.log(`  合计 ${plan.totalYuan} 元（预算 ${doc.budgetYuan} 元）`);
} else {
  console.log(`估价：${plan.totalYuan} 元（预算 ${doc.budgetYuan} 元）`);
}
if (report.budgetExceeded) process.exit(3);
if (dryRun) {
  console.log('dry-run：只出计划，不生成。');
  process.exit(0);
}
if (doc.provider === 'minimax-h3' && !yes) fail(3, '还没生成。确认后加 --yes 再跑同一条命令。');
if (plan.totalYuan > 0 && !yes) fail(3, `估价 ${plan.totalYuan} 元。加 --yes 才会真正生成。`);

const styleDir = path.join(ROOT, 'broll', 'styles', doc.style);
const references = (Array.isArray(style?.references) ? style.references : [])
  .map((rel) => path.join(styleDir, rel))
  .filter((abs) => fs.existsSync(abs));

let ledger;
try {
  ledger = await generateClips({
    doc,
    plan,
    outDir,
    projectDir,
    only,
    forceRedo,
    concurrency: doc.provider === 'minimax-h3' ? concurrency : 1,
    references,
    log: console.log,
  });
} catch (e) {
  fail(e.exitCode || 4, e.message);
}

const ledgerPath = path.join(outDir, 'ledger.json');
const missing = plan.clips.filter((c) => !ledger.clips[c.id] || !['checked', 'approved'].includes(ledger.clips[c.id].status));
if (missing.length) {
  fail(only ? 0 : 4, only ? `只处理了 ${only}。还有 ${missing.map((c) => c.id).join('、')} 没准备好，这次不出片。` : `还有片段没准备好：${missing.map((c) => c.id).join('、')}`);
}

if (doc.provider === 'minimax-h3' && !draft) {
  const gate = checkReview({projectDir, outDir, clipIds: plan.clips.map((c) => c.id)});
  if (!gate.ok) {
    console.log(`未审片：${gate.reason}`);
    console.log('先跑 node scripts/broll/review-sheet.mjs <项目目录> --out <输出目录>');
    console.log('人看完后自己跑 node scripts/broll/approve.mjs <项目目录> --out <输出目录>');
    console.log('AI 助手不许替人运行 approve。');
    console.log('要出带「B-roll 未审」标记的草稿，加 --draft。');
    process.exit(5);
  }
}

const runRel = `_run/talk-${process.pid}-${Date.now()}`;
const runDir = path.join(TEMPLATE, 'public', runRel);
const propsPath = path.join(outDir, 'talk-props.json');
const videoPath = path.join(outDir, 'video.mp4');
const checkDir = path.join(outDir, 'check');
let lock;
let exitCode = 0;
let exitMsg = '';
const stop = (code, message) => {
  const err = new Error(message);
  err.exitCode = code;
  throw err;
};

const cleanup = () => {
  if (lock) lock.release();
  lock = null;
  if (!keep) fs.rmSync(runDir, {recursive: true, force: true});
};

try {
  fs.mkdirSync(runDir, {recursive: true});
  fs.copyFileSync(loaded.talk, path.join(runDir, 'talk.mp4'));
  const propsClips = plan.clips.map((clip) => {
    const entry = ledger.clips[clip.id];
    const abs = path.resolve(outDir, entry.file);
    const name = `${clip.id}.mp4`;
    fs.copyFileSync(abs, path.join(runDir, name));
    return {
      id: clip.id,
      src: `${runRel}/${name}`,
      startMs: clip.windowMs[0],
      endMs: clip.windowMs[1],
      mode: clip.mode,
      badge: doc.provider === 'placeholder' || doc.provider === 'minimax-h3',
    };
  });
  const props = {
    talkSrc: `${runRel}/talk.mp4`,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    durationSec: loaded.media.durationSec,
    captions: doc.captions,
    cues: loaded.cues.map((c) => ({id: c.id, startMs: c.startMs, endMs: c.endMs, text: c.text})),
    clips: propsClips,
    draft: doc.provider === 'minimax-h3' && draft,
  };
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2) + '\n', 'utf8');

  lock = await acquireRenderLock({file: LOCK, id: `talk-${process.pid}`});
  console.log('渲染中…');
  const renderOnce = (extra) =>
    spawnSync(process.execPath, [REMOTION, 'render', 'src/index.ts', 'Talk', videoPath, `--props=${propsPath}`, '--codec=h264', '--overwrite', ...extra], {
      cwd: TEMPLATE,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    });
  let rendered = renderOnce([]);
  const logText = `${rendered.stdout || ''}\n${rendered.stderr || ''}`;
  if (rendered.status !== 0 && /cache|EBUSY|EPERM|lock/i.test(logText)) {
    console.log('打包缓存冲突，关掉缓存重试…');
    rendered = renderOnce(['--bundle-cache=false']);
  }
  if (rendered.status !== 0 || !fs.existsSync(videoPath)) {
    const tail = `${rendered.stdout || ''}\n${rendered.stderr || ''}`
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .slice(-20)
      .join('\n');
    stop(4, `渲染失败。\n${tail}`);
  }

  try {
    extractDeliveryFrames({video: videoPath, clips: plan.clips, durationSec: loaded.media.durationSec, fps: plan.fps, checkDir});
  } catch (e) {
    stop(4, e.message);
  }
  const pngs = [];
  for (const clip of plan.clips) {
    for (const tag of ['before', 'start', 'mid', 'end', 'after']) pngs.push(path.join(checkDir, `${clip.id}-${tag}.png`));
  }
  for (const p of pngs) if (!fs.existsSync(p)) stop(4, `缺少检查帧 ${path.basename(p)}`);
  const cols = Math.min(5, pngs.length);
  const rows = Math.ceil(pngs.length / cols);
  const scale = 'scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2,setsar=1';
  const chain = pngs.map((_, i) => `[${i}:v]${scale}[s${i}]`).join(';');
  const tile = `${pngs.map((_, i) => `[s${i}]`).join('')}concat=n=${pngs.length}:v=1:a=0,tile=${cols}x${rows}:padding=8:color=0x111111`;
  const sheetPath = path.join(outDir, 'sheet.png');
  const sheet = ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', ...pngs.flatMap((p) => ['-i', p]), '-filter_complex', `${chain};${tile}`, '-frames:v', '1', sheetPath]);
  if (sheet.status !== 0 || !fs.existsSync(sheetPath)) {
    const tail = String(sheet.stderr || sheet.stdout || '')
      .trim()
      .split(/\r?\n/)
      .slice(-8)
      .join('\n');
    stop(4, `拼图失败。\n${tail}`);
  }

  const finishedAt = new Date().toISOString();
  for (const clip of plan.clips) ledger.clips[clip.id] = markApproved(ledger.clips[clip.id], finishedAt);
  saveLedger(ledgerPath, ledger);
  const manifest = {
    status: 'delivered',
    provider: doc.provider,
    quality: doc.quality,
    style: doc.style,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    durationSec: Number(loaded.media.durationSec.toFixed(3)),
    totalYuan: Math.round(plan.clips.reduce((sum, c) => sum + (Number(ledger.clips[c.id]?.costYuan) || Number(c.costYuan) || 0), 0) * 100) / 100,
    draft: doc.provider === 'minimax-h3' && draft,
    inputs: {
      'talk.mp4': sha256File(loaded.talk),
      'talk.srt': sha256File(loaded.srtPath),
      'broll.json': sha256File(loaded.jsonPath),
    },
    clips: plan.clips.map((c) => ({
      id: c.id,
      from: c.from,
      to: c.to,
      mode: c.mode,
      windowMs: c.windowMs,
      provider: doc.provider,
      costYuan: ledger.clips[c.id]?.costYuan ?? c.costYuan,
      outputSeconds: ledger.clips[c.id]?.outputSeconds ?? null,
      promptHash: c.promptHash,
      requestHash: c.requestHash,
      generatedAt: ledger.clips[c.id].generatedAt ?? null,
      taskId: ledger.clips[c.id].taskId ?? null,
    })),
    finishedAt,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`交付：${videoPath}`);
} catch (e) {
  exitCode = e.exitCode || 4;
  exitMsg = e instanceof QueueTimeoutError ? e.message : e.message || String(e);
} finally {
  cleanup();
}
if (exitCode) {
  if (exitMsg) console.log(exitMsg);
  process.exit(exitCode);
}
