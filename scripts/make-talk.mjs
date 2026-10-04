#!/usr/bin/env node
// 口播配 B-roll：校验 → 计划 → 估价闸门 → 生成 → 检查 → 合成 → 交付。
//   node scripts/make-talk.mjs <项目目录> --out <输出目录> [--dry-run] [--provider placeholder|local] [--yes]
// 退出码：0 交付 / 1 校验没过 / 2 参数或输出目录在仓库里 / 3 超预算或没加 --yes / 4 生成、检查或渲染失败
// --out 不许落在仓库里（promo/ 除外，或人手动加 --allow-in-repo）。--dry-run 只校验、写计划和估价，不生成。
// 本版只做 placeholder 和 local。minimax-h3 会在校验里报「下一版才支持」。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkClip} from './broll/check-clip.mjs';
import {sha256File} from './broll/hash.mjs';
import {loadLedger, markApproved, resumeClip, saveLedger} from './broll/ledger.mjs';
import {ffmpeg} from './broll/media.mjs';
import {buildPlan, writePlan} from './broll/plan.mjs';
import {prepareLocal} from './broll/providers/local.mjs';
import {renderPlaceholder} from './broll/providers/placeholder.mjs';
import {ROOT, TEMPLATE} from './broll/root.mjs';
import {framesFor} from './broll/time.mjs';
import {formatReport, loadBanned, loadProject, loadStyles, validateBroll} from './broll/validate.mjs';
import {QueueTimeoutError, acquireRenderLock} from './lib/render-lock.mjs';

const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const LOCK = path.join(TEMPLATE, '.render.lock');
const KNOWN = new Set(['--out', '--provider', '--dry-run', '--yes', '--keep', '--allow-in-repo']);
const TAKES = new Set(['--out', '--provider']);

const fail = (code, message) => {
  console.log(message);
  process.exit(code);
};

const argv = process.argv.slice(2);
for (const a of argv) {
  if (a.startsWith('--') && !KNOWN.has(a)) fail(2, `不认识的参数 ${a}\n用法：node scripts/make-talk.mjs <项目目录> --out <输出目录> [--dry-run] [--provider placeholder|local] [--yes]`);
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
  fail(2, '用法：node scripts/make-talk.mjs <项目目录> --out <输出目录> [--dry-run] [--provider placeholder|local] [--yes]');
}

const projectDir = path.resolve(positionals[0]);
const outDir = path.resolve(opt('--out'));
const dryRun = has('--dry-run');
const yes = has('--yes');
const keep = has('--keep');

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
console.log(`估价：${plan.totalYuan} 元（预算 ${doc.budgetYuan} 元）`);
if (report.budgetExceeded) process.exit(3);
if (dryRun) {
  console.log('dry-run：只出计划，不生成。');
  process.exit(0);
}
if (plan.totalYuan > 0 && !yes) fail(3, `估价 ${plan.totalYuan} 元。加 --yes 才会真正生成。`);

const ledgerPath = path.join(outDir, 'ledger.json');
const ledger = loadLedger(ledgerPath);
const clipDir = path.join(outDir, 'clips');
const rawDir = path.join(outDir, 'raw');
const checkDir = path.join(outDir, 'check');
fs.mkdirSync(clipDir, {recursive: true});
fs.mkdirSync(rawDir, {recursive: true});
fs.mkdirSync(checkDir, {recursive: true});

const presetOf = doc.provider === 'placeholder' ? 'ultrafast' : 'veryfast';

for (const clip of plan.clips) {
  const ops = {
    submit() {
      const taskId = `${doc.provider}-${clip.id}-${clip.requestHash.slice(0, 8)}`;
      if (doc.provider === 'placeholder') {
        const dest = path.join(rawDir, `${clip.id}.mp4`);
        renderPlaceholder({
          id: clip.id,
          plain: clip.plain,
          sentence: clip.sentence,
          width: plan.width,
          height: plan.height,
          frames: framesFor(clip.windowMs[1] - clip.windowMs[0], 30),
          dest,
        });
        console.log(`生成 ${clip.id}（占位片，${clip.genSec} 秒）`);
        return {taskId, provider: doc.provider, file: path.relative(outDir, dest)};
      }
      if (doc.provider === 'local') {
        const got = prepareLocal({file: clip.file, projectDir, windowSec: clip.windowSec});
        console.log(`采用本地文件 ${clip.id}`);
        return {taskId, provider: doc.provider, file: got.abs};
      }
      throw new Error(`${doc.provider} 这一版不能生成。`);
    },
    query(entry) {
      const abs = path.isAbsolute(entry.file || '') ? entry.file : path.resolve(outDir, entry.file || '');
      if (entry.file && fs.existsSync(abs)) return {status: 'downloaded', file: entry.file};
      return {status: 'submitted'};
    },
    check(entry) {
      const src = path.isAbsolute(entry.file || '') ? entry.file : path.resolve(outDir, entry.file || '');
      const dest = path.join(clipDir, `${clip.id}.mp4`);
      const done = checkClip({
        src,
        dest,
        frames: framesFor(clip.windowMs[1] - clip.windowMs[0], 30),
        width: plan.width,
        height: plan.height,
        frameDir: checkDir,
        id: clip.id,
        preset: presetOf,
        crf: 18,
      });
      if (done.meta.black > 0) throw new Error(`${clip.id} 有黑帧（${done.meta.black} 段）。换一段画面，或检查源文件是不是黑的。`);
      if (done.meta.freeze > 0) throw new Error(`${clip.id} 有静帧（${done.meta.freeze} 段）。画面要有变化。`);
      console.log(`检查 ${clip.id}：${done.meta.durationSec.toFixed(2)} 秒，黑帧 0，静帧 0`);
      return {file: path.relative(outDir, dest), meta: {black: done.meta.black, freeze: done.meta.freeze, durationSec: done.meta.durationSec}};
    },
  };
  try {
    const step = resumeClip(ledger.clips[clip.id], clip.requestHash, ops);
    if (!step.entry.generatedAt) step.entry.generatedAt = step.entry.updatedAt;
    ledger.clips[clip.id] = step.entry;
    saveLedger(ledgerPath, ledger);
    if (step.action === 'reuse') console.log(`复用 ${clip.id}（请求没变，不重新生成）`);
  } catch (e) {
    saveLedger(ledgerPath, ledger);
    fail(4, e.message);
  }
}

const runRel = `_run/talk-${process.pid}-${Date.now()}`;
const runDir = path.join(TEMPLATE, 'public', runRel);
const propsPath = path.join(outDir, 'talk-props.json');
const videoPath = path.join(outDir, 'video.mp4');
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

  const fps = plan.fps;
  for (const clip of plan.clips) {
    const start = clip.windowMs[0] / 1000;
    const end = clip.windowMs[1] / 1000;
    const before = Math.max(0, start - 1 / fps);
    const after = Math.min(Math.max(0, loaded.media.durationSec - 1 / fps), end + 1 / fps);
    for (const [tag, sec] of [
      ['before', before],
      ['after', after],
    ]) {
      const png = path.join(checkDir, `${clip.id}-${tag}.png`);
      const shot = ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', videoPath, '-ss', sec.toFixed(3), '-frames:v', '1', png]);
      if (shot.status !== 0 || !fs.existsSync(png)) stop(4, `成片抽帧失败（${clip.id} ${tag}）`);
    }
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
    totalYuan: plan.totalYuan,
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
      costYuan: c.costYuan,
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
