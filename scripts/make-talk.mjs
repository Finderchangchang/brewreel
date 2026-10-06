#!/usr/bin/env node
// 口播配 B-roll：校验 → 计划 → 估价闸门 → 原片归一化 → 生成 AI 画面 → 审片（minimax-h3）→ 合成 → 交付。
//   node scripts/make-talk.mjs <项目目录> --out <输出目录> [--dry-run] [--provider placeholder|local|minimax-h3] [--yes] [--draft] [--only b01] [--concurrency 3] [--force-redo]
// 退出码：0 交付 / 1 校验没过 / 2 参数或输出目录在仓库里、缺参考图、缺完整版 ffmpeg、会盖掉付费片段 / 3 超预算、没加 --yes、或重做次数到顶 / 4 生成、检查、转码或渲染失败 / 5 还没审片
// 合成的输入（原片、字幕、计划、生成片、合成代码）和上次交付时完全一样时，不重新渲染，直接用上次的成片（删掉 video.mp4 就会重出）。
// --out 不许落在仓库里（promo/ 除外，或人手动加 --allow-in-repo）。--dry-run 只校验、写计划和估价，不生成。
// 动效画面（source:"motion"）不花钱、不进账本、不审片、不加「AI 生成画面」标，合成时直接画；
// 只有 AI 画面段才走 --yes、预算、审片这几道关。全片都是动效时不用 --yes。
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {sha256Stream} from './broll/asr/audio.mjs';
import {extractDeliveryFrames} from './broll/frames.mjs';
import {generateClips, redoCommandOf} from './broll/generate.mjs';
import {sha256File, sha256Text, stableString} from './broll/hash.mjs';
import {loadLedger, markApproved, saveLedger} from './broll/ledger.mjs';
import {ffmpeg, ffmpegCheck, ffmpegHelp} from './broll/media.mjs';
import {resolveMotionLook, toMotionProps} from './broll/motion.mjs';
import {normalizeTalk, normalizedMediaOf} from './broll/normalize.mjs';
import {aiClipsOf, buildPlan, writePlan} from './broll/plan.mjs';
import {costLine, keyKindOf} from './broll/prices.mjs';
import {missingRefs} from './broll/prompt.mjs';
import {checkReview} from './broll/review.mjs';
import {ROOT, TEMPLATE} from './broll/root.mjs';
import {readTranscribeMeta, srtSourceOf} from './broll/transcribe.mjs';
import {formatReport, loadBanned, loadProject, loadStyles, validateBroll} from './broll/validate.mjs';
import {QueueTimeoutError, acquireRenderLock} from './lib/render-lock.mjs';

const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const LOCK = path.join(TEMPLATE, '.render.lock');
const KNOWN = new Set(['--out', '--provider', '--dry-run', '--yes', '--keep', '--allow-in-repo', '--only', '--concurrency', '--draft', '--force-redo']);
const TAKES = new Set(['--out', '--provider', '--only', '--concurrency']);
const USAGE = '用法：node scripts/make-talk.mjs <项目目录> --out <输出目录> [--dry-run] [--provider placeholder|local|minimax-h3] [--yes] [--draft] [--only b01] [--concurrency 3]';

const fail = (code, message) => {
  console.log(message);
  process.exit(code);
};

const argv = process.argv.slice(2);
for (const a of argv) {
  if (a.startsWith('--') && !KNOWN.has(a)) fail(2, `不认识的参数 ${a}\n${USAGE}`);
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

if (positionals.length !== 1 || !opt('--out')) fail(2, USAGE);

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
const styles = loadStyles();
const keyKind = keyKindOf();

const report = validateBroll(doc, {
  cues: loaded.cues,
  durationMs: loaded.media.durationMs,
  width: loaded.media.width,
  height: loaded.media.height,
  styles,
  banned: loadBanned(),
  projectDir,
  tokens: loaded.tokens,
  lockProblem: loaded.lockProblem,
  keyKind,
  doubts: loaded.doubts,
});
console.log(formatReport(report));
if (report.errors.length && !report.budgetExceeded) process.exit(1);

// 合成用的画面参数：原片要转码的话（HEVC、可变帧率、奇数宽高…）按转完之后的算
const renderMedia = normalizedMediaOf(loaded.media);
let plan;
try {
  plan = buildPlan({doc, cues: loaded.cues, media: renderMedia, style: styles[doc.style], styles, projectDir, tokens: loaded.tokens});
} catch (e) {
  fail(1, e.message);
}
const aiClips = aiClipsOf(plan);
const motionClips = plan.clips.filter((c) => c.source === 'motion');
fs.mkdirSync(outDir, {recursive: true});
const planPath = writePlan(path.join(outDir, 'broll.plan.json'), plan);
console.log(`计划：${planPath}`);
if (motionClips.length) console.log(`动效画面 ${motionClips.length} 段（${motionClips.map((c) => `${c.id} ${c.template}`).join('、')}）：不花钱，不用审片`);
if (doc.provider === 'minimax-h3' || plan.totalYuan > 0) {
  if (aiClips.length) {
    console.log('估价明细：');
    for (const c of aiClips) console.log(`  ${c.id}  ${c.genSec} 秒 × ${plan.priceYuanPerSec} 元/秒 = ${c.costYuan} 元`);
    console.log(`  合计 ${plan.totalYuan} 元（预算 ${doc.budgetYuan} 元）`);
    console.log(`  ${costLine({provider: doc.provider, quality: doc.quality, genSec: plan.aiGenSec, yuan: plan.totalYuan, kind: keyKind})}`);
  } else {
    console.log(`估价：0 元，这一版没有 AI 画面段（预算 ${doc.budgetYuan} 元）`);
  }
} else {
  console.log(`估价：${plan.totalYuan} 元（预算 ${doc.budgetYuan} 元）`);
}
if (renderMedia.normalized && dryRun) console.log(`原片要先转成标准格式再合成（${renderMedia.reasons.join('；')}）：H.264、${renderMedia.fps} 帧/秒恒定帧率，转好的存在项目目录的 .brewreel/ 下，原片不动。`);
if (report.budgetExceeded) process.exit(3);

// 参考图：只有真要给 minimax-h3 提交 AI 画面时才拦（dry-run 只提醒）
const refProblems = doc.provider === 'minimax-h3' && aiClips.length ? missingRefs(doc, styles) : [];
if (refProblems.length) {
  const text = refProblems.map((e, k) => `${k + 1}. ${e.where}：${e.problem}\n   → 怎么改：${e.fix}`).join('\n');
  if (dryRun) console.log(`提醒：真生成时会停在这里（缺参考图）：\n${text}`);
  else fail(2, `缺参考图，不提交：\n${text}`);
}
// 出片要完整版 ffmpeg（转码、占位片、片段检查、拼图都要用）：先查，免得生成完、花完钱才在拼图那一步失败
const ffCheck = ffmpegCheck();
if (!ffCheck.ok) {
  if (dryRun) console.log(`提醒：真出片时会停在这里。\n${ffmpegHelp(ffCheck)}`);
  else fail(2, ffmpegHelp(ffCheck));
}
if (dryRun) {
  console.log('dry-run：只出计划，不生成。');
  process.exit(0);
}
if (doc.provider === 'minimax-h3' && aiClips.length && !yes) fail(3, '还没生成。确认后加 --yes 再跑同一条命令。');
if (plan.totalYuan > 0 && !yes) fail(3, `估价 ${plan.totalYuan} 元。加 --yes 才会真正生成。`);

let talkReady;
try {
  talkReady = await normalizeTalk({talk: loaded.talk, projectDir, media: loaded.media, log: console.log});
} catch (e) {
  fail(e.exitCode || 4, e.message);
}
if (talkReady.cached) console.log('原片转码：用上次转好的那份');

let ledger;
try {
  ledger = aiClips.length
    ? await generateClips({
        doc,
        plan,
        outDir,
        projectDir,
        only,
        forceRedo,
        concurrency: doc.provider === 'minimax-h3' ? concurrency : 1,
        log: console.log,
        // 上次失败、要手动重做时印出的完整命令：从 talk.mjs 来的用 talk.mjs 那一条，直接跑的按这次参数拼
        redoCommand: (id) => redoCommandOf({argv, projectDir, outDir, id, talkCmd: process.env.BREWREEL_TALK_CMD}),
      })
    : loadLedger(path.join(outDir, 'ledger.json'));
} catch (e) {
  fail(e.exitCode || 4, e.message);
}
if (only && !aiClips.some((c) => c.id === only)) {
  fail(2, plan.clips.some((c) => c.id === only) ? `${only} 是动效画面，不用生成。去掉 --only 直接出片。` : `--only ${only} 不在这份计划里。先看 broll.plan.json 里的 id。`);
}

const ledgerPath = path.join(outDir, 'ledger.json');
const missing = aiClips.filter((c) => !ledger.clips[c.id] || !['checked', 'approved'].includes(ledger.clips[c.id].status));
if (missing.length) {
  fail(only ? 0 : 4, only ? `只处理了 ${only}。还有 ${missing.map((c) => c.id).join('、')} 没准备好，这次不出片。` : `还有片段没准备好：${missing.map((c) => c.id).join('、')}`);
}

if (doc.provider === 'minimax-h3' && !draft && aiClips.length) {
  const gate = checkReview({projectDir, outDir, clipIds: aiClips.map((c) => c.id)});
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

/** 合成代码的指纹：template/src 下所有文件 + 依赖锁文件。代码一改（升级仓库）就重新渲染。 */
const templateHash = () => {
  const h = createHash('sha256');
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else {
        h.update(path.relative(TEMPLATE, p).split(path.sep).join('/'));
        h.update(fs.readFileSync(p));
      }
    }
  };
  walk(path.join(TEMPLATE, 'src'));
  for (const f of ['package-lock.json', 'remotion.config.ts']) {
    const p = path.join(TEMPLATE, f);
    if (fs.existsSync(p)) {
      h.update(f);
      h.update(fs.readFileSync(p));
    }
  }
  return h.digest('hex');
};

const readJsonSafe = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
};

// 动效外观：broll.json 顶层 motionTheme（外观名字）优先，不写就用主风格 style.json 的 motionTheme 对象
const motionLook = resolveMotionLook(doc, styles[doc.style]);

try {
  const clipFiles = {};
  const propsClips = plan.clips.map((clip) => {
    if (clip.source === 'motion') return toMotionProps(clip.motion, {look: motionLook});
    const entry = ledger.clips[clip.id];
    const name = `${clip.id}.mp4`;
    clipFiles[clip.id] = path.resolve(outDir, entry.file);
    return {
      kind: 'video',
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
    draft: doc.provider === 'minimax-h3' && draft && aiClips.length > 0,
  };
  // 渲染指纹：原片、合成参数（字幕、每段窗口和上屏字、版式）、每段生成片、合成代码。和上次交付时一样就不重新渲染
  const talkSha = await sha256Stream(loaded.talk);
  const renderKey = sha256Text(
    stableString({
      v: 1,
      talk: talkSha,
      talkFile: path.basename(talkReady.file),
      clipFiles: Object.fromEntries(Object.entries(clipFiles).map(([id, f]) => [id, fs.existsSync(f) ? sha256File(f) : null])),
      props: {...props, talkSrc: null, clips: props.clips.map((c) => (c.kind === 'video' ? {...c, src: null} : c))},
      template: templateHash(),
    }),
  );
  const sheetPath = path.join(outDir, 'sheet.png');
  const manifestPath = path.join(outDir, 'manifest.json');
  const prev = readJsonSafe(manifestPath);
  if (prev?.status === 'delivered' && prev.renderKey === renderKey && fs.existsSync(videoPath) && fs.existsSync(sheetPath)) {
    console.log('合成的输入和上次交付时一样（原片、字幕、broll.json、生成片、合成代码都没变），不重新渲染，直接用上次的成片。要强制重出，删掉输出目录里的 video.mp4。');
    console.log(`交付：${videoPath}`);
    throw Object.assign(new Error(''), {exitCode: 0, skipRender: true});
  }
  fs.mkdirSync(runDir, {recursive: true});
  fs.copyFileSync(talkReady.file, path.join(runDir, 'talk.mp4'));
  for (const [id, abs] of Object.entries(clipFiles)) fs.copyFileSync(abs, path.join(runDir, `${id}.mp4`));
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
  for (const clip of aiClips) ledger.clips[clip.id] = markApproved(ledger.clips[clip.id], finishedAt);
  if (aiClips.length) saveLedger(ledgerPath, ledger);
  const meta = readTranscribeMeta(projectDir);
  const manifest = {
    status: 'delivered',
    renderKey,
    provider: doc.provider,
    quality: doc.quality,
    style: doc.style,
    styleAlt: doc.styleAlt ?? null,
    thread: doc.thread ?? null,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    durationSec: Number(loaded.media.durationSec.toFixed(3)),
    totalYuan: Math.round(aiClips.reduce((sum, c) => sum + (Number(ledger.clips[c.id]?.costYuan) || Number(c.costYuan) || 0), 0) * 100) / 100,
    aiGenSec: plan.aiGenSec,
    draft: props.draft,
    inputs: {
      'talk.mp4': talkSha,
      'talk.srt': sha256File(loaded.srtPath),
      'broll.json': sha256File(loaded.jsonPath),
      srtSource: srtSourceOf(projectDir),
      asrModel: meta?.model ?? null,
      talkNormalized: talkReady.normalized ? {reasons: talkReady.reasons, fps: talkReady.media.fps, width: talkReady.media.width, height: talkReady.media.height} : null,
    },
    clips: plan.clips.map((c) => {
      if (c.source === 'motion') {
        return {id: c.id, from: c.from, to: c.to, mode: c.mode, windowMs: c.windowMs, source: 'motion', template: c.template, screenText: c.motion?.screenText ?? [], costYuan: 0};
      }
      return {
        id: c.id,
        from: c.from,
        to: c.to,
        mode: c.mode,
        windowMs: c.windowMs,
        source: 'ai',
        provider: doc.provider,
        styleId: c.styleId ?? doc.style,
        look: c.look ?? 'main',
        costYuan: ledger.clips[c.id]?.costYuan ?? c.costYuan,
        outputSeconds: ledger.clips[c.id]?.outputSeconds ?? null,
        promptHash: c.promptHash,
        requestHash: c.requestHash,
        generatedAt: ledger.clips[c.id].generatedAt ?? null,
        taskId: ledger.clips[c.id].taskId ?? null,
      };
    }),
    finishedAt,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`交付：${videoPath}`);
} catch (e) {
  if (e?.skipRender) exitCode = 0;
  else {
    exitCode = e.exitCode || 4;
    exitMsg = e instanceof QueueTimeoutError ? e.message : e.message || String(e);
  }
} finally {
  cleanup();
}
if (exitCode) {
  if (exitMsg) console.log(exitMsg);
  process.exit(exitCode);
}
