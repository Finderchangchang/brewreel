#!/usr/bin/env node
// node scripts/scene/make-scene.mjs <scene.json> --out <仓库外目录>
//   [--style 名字] [--motion 性格] [--product promo|lesson|talk] [--scale 1]
//   [--voice-provider minimax|aliyun|volcengine|mock] [--no-voice] [--no-bgm]
// 校验 → 配音 → 时间 → 逐字字幕 → 配乐闪避 → 渲染 → 检查 → manifest。
// 旧的 storyboard / lesson / broll 不走这里。这一版对外是实验。
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {blankRuns} from '../lib/blank-check.mjs';
import {layoutCheck, parseProbeLog} from '../lib/layout-check.mjs';
import {ensureTemplateBrowser, withBrowserExecutable} from '../lib/remotion-browser.mjs';
import {acquireRenderLock} from '../lib/render-lock.mjs';
import {cacheDirOf} from '../lib/tts/index.mjs';
import {sampleClip, scoreFrames} from '../broll/motion-check.mjs';
import {auditPlan, checkFrames, pieceTextsOf, prepareScene, protoScene} from '../../template/src/scene/prepare.ts';
import {sceneFrame} from './geom.mjs';
import {speakScreens, DUCK, LEAD_SEC, loudnessGainDb} from './speak.mjs';
import {loadStyle, stylesFor} from './tokens.mjs';
import {formatReport, validateScene} from './validate-scene.mjs';
import {captionRemainder, onScreenPhrases} from '../../template/src/scene/caption.ts';
import {aigcPayload, embedAigcMetadata, findFullFfmpeg, findRemotionFfprobe} from '../lesson/aigc-label.mjs';
import {captionBoxFor, captionHits, clocksFor, pagesForCaption} from './voice-plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE = path.join(ROOT, 'template');
const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const LOCK = path.join(TEMPLATE, '.render.lock');
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const PROVIDER_IDS = ['minimax', 'aliyun', 'volcengine', 'mock'];
const BGM_THEMES = new Set(['warm-emotion', 'tech-dark', 'fresh-light', 'business-blue', 'festival-red', 'mono-premium']);
const USAGE = '用法: node scripts/scene/make-scene.mjs <scene.json> --out <目录> [--style 名字] [--motion 性格] [--product promo|lesson|talk] [--scale 1] [--voice-provider minimax|aliyun|volcengine|mock] [--no-voice] [--no-bgm]';

function argsOf(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = 'true';
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return {positional, flags};
}

function familiesOf(style) {
  return ['promo', 'lesson', 'talk'].filter((product) => stylesFor(product).includes(style));
}

function outsideRepo(dir) {
  const rel = path.relative(ROOT, path.resolve(dir));
  return rel.startsWith('..') || path.isAbsolute(rel);
}

function ffmpegExe() {
  const ran = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], {encoding: 'utf8'});
  const exe = String(ran.stdout || '').trim();
  if (ran.status !== 0 || !exe || !fs.existsSync(exe)) throw new Error('找不到 imageio_ffmpeg 的 ffmpeg');
  return exe;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function embedImages(plan) {
  const next = structuredClone(plan);
  for (const screen of next.screens) {
    const src = screen.imageSrc;
    if (!src || String(src).startsWith('data:')) continue;
    const abs = path.isAbsolute(src) ? src : path.resolve(ROOT, src);
    if (!fs.existsSync(abs)) throw new Error(`找不到画面素材 ${src}`);
    const buf = fs.readFileSync(abs);
    const ext = path.extname(abs).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    if (buf.length >= 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w > 0 && h > 0) screen.imageAspect = w / h;
    }
    screen.imageSrc = `data:${mime};base64,${buf.toString('base64')}`;
  }
  return next;
}

function frame0Issue(probes, plan) {
  const hit = probes.get(0);
  if (!hit || hit.error) return hit?.error ? `第 0 帧探针出错 ${hit.error}` : '没有第 0 帧探针';
  const text = plan.screens[0]?.blocks[0]?.text || '';
  const needle = text.replace(/\s/g, '').slice(0, 6);
  const block = (hit.blocks || []).find((item) => String(item.text || '').replace(/\s/g, '').includes(needle));
  if (!block) return `第 0 帧安全区内看不到主文案「${text.slice(0, 12)}」`;
  const [x0, y0, x1, y1] = block.tx || [block.x0, block.y0, block.x1, block.y1];
  const safe = plan.screens[0]?.safe ?? plan.safe;
  if (x0 < safe.x - 12 || x1 > safe.x + safe.w + 12 || y0 < safe.y - 30 || y1 > safe.y + safe.h + 30) {
    return `第 0 帧主文案出了安全区（x ${x0}–${x1}，y ${y0}–${y1}）`;
  }
  return '';
}

function bgmTheme(style) {
  if (style === 'editorial') return 'mono-premium';
  if (style === 'techbrief') return 'tech-dark';
  if (BGM_THEMES.has(style)) return style;
  return 'warm-emotion';
}

function hasNarration(scene) {
  return (scene.screens || []).some((screen) => String(screen?.narration || '').trim());
}

function attachCaptions(plan, lines, sceneScreens) {
  const byIndex = new Map(lines.map((line) => [line.index, line]));
  const screens = [];
  for (const screen of plan.screens) {
    const line = byIndex.get(screen.index);
    const src = sceneScreens?.[screen.index];
    if (!line?.words?.length || !src) continue;
    const spoken = captionRemainder(src.narration || '', onScreenPhrases(src));
    if (!spoken) continue;
    const placed = captionBoxFor(screen, plan.width, plan.height, plan.aspect);
    const pages = pagesForCaption(src.narration || '', line.words, spoken, placed.box.w, plan.floor?.body || 40, screen.duration);
    if (!pages.length) continue;
    screens.push({index: screen.index, box: placed.box, pages});
  }
  if (!screens.length) return;
  plan.captions = {coverScreens: [], screens};
}

function captionIssues(plan) {
  const issues = [];
  for (const cap of plan.captions?.screens || []) {
    const screen = plan.screens.find((item) => item.index === cap.index);
    if (!screen) continue;
    if (plan.aspect === '9:16') {
      const bottom = cap.box.y + cap.box.h;
      if (bottom > 1340.5) issues.push(`第 ${cap.index + 1} 屏字幕下沿 ${Math.round(bottom)} 进了平台底栏（y 1340 以下）`);
      if (cap.box.y < 1100) issues.push(`第 ${cap.index + 1} 屏字幕在 y ${Math.round(cap.box.y)}，不在底部字幕带`);
    } else if (plan.aspect === '16:9') {
      const bottom = cap.box.y + cap.box.h;
      const right = cap.box.x + cap.box.w;
      if (bottom > plan.height + 0.5) issues.push(`第 ${cap.index + 1} 屏字幕下沿 ${Math.round(bottom)} 超出横版画面`);
      if (right > 1580.5 && bottom > 810.5) issues.push(`第 ${cap.index + 1} 屏字幕进了讲解员保留区`);
    }
    for (const block of captionHits(cap.box, screen.blocks)) {
      const kind = block.kind || 'card';
      issues.push(`第 ${cap.index + 1} 屏字幕压住${kind}「${String(block.text || '').slice(0, 12)}」`);
    }
  }
  return issues;
}

function contentMask(screen, plan, outW, outH, enterEnd) {
  const mask = new Uint8Array(outW * outH);
  const sx = outW / plan.width;
  const sy = outH / plan.height;
  const visible = (screen.blocks || []).filter((block) => (block.showAt || 0) <= enterEnd + 1e-6);
  const blocks = visible.length ? visible : (screen.blocks || []).slice(0, 1);
  for (const block of blocks) {
    const x0 = Math.max(0, Math.floor(block.x * sx));
    const y0 = Math.max(0, Math.floor(block.y * sy));
    const x1 = Math.min(outW, Math.ceil((block.x + block.w) * sx));
    const y1 = Math.min(outH, Math.ceil((block.y + block.h) * sy));
    for (let y = y0; y < y1; y++) {
      const row = y * outW;
      for (let x = x0; x < x1; x++) mask[row + x] = 1;
    }
  }
  return mask;
}

function motionIssues(video, plan) {
  const fails = [];
  const notes = [];
  for (const screen of plan.screens) {
    const enter = Math.max(0.16, Number(screen.curve?.duration) || 0.3);
    // 只量入场曲线里已经出现的块。落定之后停住是版式，整帧平均会被空白背景拉低，都不能算停死。
    const start = screen.start + 0.02;
    const end = Math.min(screen.start + screen.duration - 0.02, screen.start + Math.min(0.7, enter + 0.02));
    const span = end - start;
    let sampleFps = 15;
    let freezeWindowSec = 0.3;
    let edgePadSec = 0.05;
    if (span + 1e-6 < freezeWindowSec + edgePadSec * 2) {
      sampleFps = 30;
      edgePadSec = 0.02;
      freezeWindowSec = Math.min(0.16, Math.max(0.1, span * 0.4));
    }
    if (span + 1e-6 < freezeWindowSec + edgePadSec * 2) {
      notes.push(`第 ${screen.index + 1} 屏入场 ${enter.toFixed(2)} 秒，短于停死窗，不据此拒收`);
      continue;
    }
    try {
      const sampled = sampleClip(video, start, end, plan.width, plan.height, {sampleFps, sampleWidth: 270});
      const scored = scoreFrames(sampled.frames, sampled.w, sampled.h, {
        sampleFps,
        startSec: start,
        freezeLevel: 'fail',
        jumpLevel: 'warn',
        jumpFloor: 30,
        edgePadSec,
        freezeWindowSec,
        mask: contentMask(screen, plan, sampled.w, sampled.h, enter),
      });
      if (scored.freezeHit && scored.quietest < 0.2) fails.push(`第 ${screen.index + 1} 屏入场停死`);
      else if (scored.jumpHit) notes.push(`第 ${screen.index + 1} 屏入场有一帧闪动，只记一笔`);
    } catch {
      notes.push(`第 ${screen.index + 1} 屏动效检查没跑成`);
    }
  }
  return {fails, notes};
}

function lastMatch(text, re) {
  const all = [...String(text || '').matchAll(re)];
  return all.length ? Number(all[all.length - 1][1]) : null;
}

function readProgramLoudness(ffmpeg, video) {
  const ran = spawnSync(ffmpeg, ['-hide_banner', '-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8', windowsHide: true});
  const text = `${ran.stdout || ''}\n${ran.stderr || ''}`;
  const integrated = lastMatch(text, /I:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g);
  const peak = lastMatch(text, /Peak:\s+(-?\d+(?:\.\d+)?)\s+dBFS/g);
  if (integrated == null || peak == null) return null;
  return {integrated, peak};
}

function fitProgramLoudness(ffmpeg, video) {
  const before = readProgramLoudness(ffmpeg, video);
  if (!before) return null;
  const gain = loudnessGainDb(before.integrated, before.peak);
  if (!gain) return {beforeIntegrated: before.integrated, beforePeak: before.peak, gain: 0, integrated: before.integrated, peak: before.peak};
  const tmp = `${video}.loud.mp4`;
  const ran = spawnSync(
    ffmpeg,
    ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-c:v', 'copy', '-af', `volume=${gain}dB`, '-c:a', 'aac', '-b:a', '192k', tmp],
    {encoding: 'utf8', windowsHide: true},
  );
  if (ran.status !== 0 || !fs.existsSync(tmp)) {
    if (fs.existsSync(tmp)) fs.rmSync(tmp);
    return {beforeIntegrated: before.integrated, beforePeak: before.peak, gain: 0, integrated: before.integrated, peak: before.peak, error: '增益没写成'};
  }
  fs.rmSync(video);
  fs.renameSync(tmp, video);
  const after = readProgramLoudness(ffmpeg, video) || before;
  return {beforeIntegrated: before.integrated, beforePeak: before.peak, gain, integrated: after.integrated, peak: after.peak};
}

function sheetOf(ffmpeg, video, plan, dest) {
  const frames = [];
  for (const screen of plan.screens) {
    const a = Math.min(plan.durationFrames - 1, screen.startFrame + Math.round(0.45 * plan.fps));
    const b = Math.min(plan.durationFrames - 1, screen.startFrame + Math.round(screen.durationFrames * 0.72));
    frames.push(a, b);
  }
  const unique = [];
  for (const frame of frames) if (!unique.includes(frame)) unique.push(frame);
  while (unique.length < 8 && unique.length) unique.push(unique[unique.length - 1]);
  const picked = unique.slice(0, 8);
  if (picked.length < 8) return false;
  const select = picked.map((frame) => `eq(n\\,${frame})`).join('+');
  const ran = spawnSync(
    ffmpeg,
    ['-y', '-i', video, '-vf', `select='${select}',scale=270:-1,tile=4x2`, '-vsync', '0', '-frames:v', '1', dest],
    {encoding: 'utf8', windowsHide: true},
  );
  return ran.status === 0 && fs.existsSync(dest);
}

function makeBgm(plan, outWav, intervals) {
  const script = path.join(ROOT, 'scripts', 'make_bgm.py');
  if (!fs.existsSync(script)) return {ok: false, message: '没有 scripts/make_bgm.py'};
  const args = [
    script,
    '--duration', plan.durationSec.toFixed(3),
    '--bpm', '120',
    '--theme', bgmTheme(plan.style),
    '--cues', JSON.stringify(plan.screens.map((screen) => Number(screen.start.toFixed(3)))),
    '--moods', JSON.stringify(plan.screens.map(() => 0.4)),
    '--types', JSON.stringify(plan.screens.map((screen) => screen.layout)),
    '--out', outWav,
  ];
  if (intervals.length) {
    args.push('--voice', JSON.stringify(intervals), '--duck-db', String(DUCK.db), '--duck-attack', String(DUCK.attackMs / 1000), '--duck-release', String(DUCK.releaseMs / 1000));
  }
  const ran = spawnSync(PY, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'},
    windowsHide: true,
  });
  if (ran.status === 0 && fs.existsSync(outWav)) return {ok: true, ducked: intervals.length > 0 && /闪避/.test(ran.stdout || '')};
  const tail = String(ran.stderr || ran.stdout || '').trim().split(/\r?\n/).slice(-4).join(' | ');
  return {ok: false, message: tail || '配乐脚本没有写出文件'};
}

async function main() {
  const {positional, flags} = argsOf(process.argv.slice(2));
  const scenePath = positional[0];
  const outDir = flags.out;
  if (!scenePath || !outDir) {
    console.error(USAGE);
    process.exit(2);
  }
  if (!outsideRepo(outDir)) {
    console.error('输出目录要在仓库外面');
    process.exit(2);
  }
  const scale = Number(flags.scale || 1);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) {
    console.error('--scale 取 0 到 1');
    process.exit(2);
  }
  if (flags['voice-provider'] && !PROVIDER_IDS.includes(flags['voice-provider'])) {
    console.error('--voice-provider 只能是 minimax、aliyun、volcengine 或 mock');
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  const collapsed = protoScene(raw);
  let product = flags.product || collapsed.product;
  let style = flags.style || collapsed.style;
  const motion = flags.motion || collapsed.motion;
  if (flags.style) {
    const families = familiesOf(flags.style);
    if (flags.product) {
      if (!families.includes(flags.product)) {
        console.error(`风格 ${flags.style} 不属于 ${flags.product}`);
        process.exit(1);
      }
      product = flags.product;
    } else if (families.includes(collapsed.product)) {
      product = collapsed.product;
    } else if (families.length === 1) {
      product = families[0];
    } else {
      console.error(`风格 ${flags.style} 在 ${families.join('、')} 里都有，请加 --product`);
      process.exit(1);
    }
    style = flags.style;
  }
  const scene = {...collapsed, product, style, ...(motion ? {motion} : {})};
  const result = validateScene(scene);
  console.log(formatReport(result, scenePath));
  if (!result.ok) process.exit(1);

  const noVoice = flags['no-voice'] === 'true';
  const noBgm = flags['no-bgm'] === 'true';
  const voiced = hasNarration(result.scene);
  let spoken = null;
  if (voiced && !noVoice && !flags['voice-provider']) {
    console.error('这一份有旁白。加上 --voice-provider minimax|aliyun|volcengine|mock，或加 --no-voice 出无配音版。mock 是占位音，只用来看节奏，不能当交付。');
    process.exit(2);
  }
  if (!voiced) console.log('没有旁白，不配音');
  else if (noVoice) console.log('按 --no-voice 不配音');

  const token = loadStyle(result.scene.product, result.scene.style);
  if (!token) {
    console.error(`读不到风格 ${result.scene.product}/${result.scene.style}`);
    process.exit(1);
  }
  const frame = sceneFrame(result.scene.product, result.scene.aspect);
  fs.mkdirSync(outDir, {recursive: true});
  const workDir = path.join(outDir, 'voice-work');
  if (voiced && !noVoice) {
    spoken = await speakScreens(result.scene.screens, {
      provider: flags['voice-provider'],
      cacheDir: cacheDirOf(process.env),
      workDir,
      env: process.env,
      remotion: REMOTION,
      log: () => {},
    });
    if (!spoken.ok) {
      console.error(spoken.message);
      process.exit(2);
    }
    const billed = spoken.billedCharacters ? `，本次计费 ${spoken.billedCharacters} 字符` : '';
    console.log(`配音：${spoken.cfg.provider} / ${spoken.cfg.voiceId}，合成 ${spoken.synthesized} 句、缓存命中 ${spoken.cacheHits} 句${billed}`);
    if (spoken.cfg.provider === 'mock') console.log('mock 是占位音，只用来看节奏，不能当交付');
  }

  const clocks = spoken ? clocksFor(result.scene.screens, spoken.lines, pieceTextsOf) : undefined;
  const plan = prepareScene({scene: result.scene, roles: token.roles, extra: token.extra, frame, ...(clocks ? {clocks} : {})});
  const issues = auditPlan(plan);
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exit(1);
  }
  if (spoken) attachCaptions(plan, spoken.lines, result.scene.screens);

  const runId = `scene-${Date.now().toString(36)}-${process.pid}`;
  const runDir = path.join(TEMPLATE, 'public', '_run', runId);
  fs.mkdirSync(runDir, {recursive: true});
  const cleanup = () => {
    try {
      fs.rmSync(runDir, {recursive: true, force: true});
    } catch {
      /* 渲染目录清不掉就留着，不往上删 */
    }
  };

  try {
    const intervals = [];
    if (spoken?.lines?.length) {
      plan.sound = {lines: []};
      for (const line of spoken.lines) {
        const screen = plan.screens[line.index];
        if (!screen) continue;
        const name = `voice-${line.index}.wav`;
        fs.copyFileSync(line.audioPath, path.join(runDir, name));
        const start = screen.start + LEAD_SEC;
        intervals.push([Number(start.toFixed(3)), Number((start + line.durMs / 1000).toFixed(3))]);
        plan.sound.lines.push({
          src: `_run/${runId}/${name}`,
          startFrame: screen.startFrame + Math.round(LEAD_SEC * plan.fps),
        });
      }
    }

    let bgmInfo = {ducked: false, skipped: true};
    if (!noBgm) {
      const bgmWav = path.join(runDir, 'bgm.wav');
      const made = makeBgm(plan, bgmWav, intervals);
      if (!made.ok) throw new Error(`配乐失败：${made.message}`);
      fs.copyFileSync(bgmWav, path.join(outDir, 'bgm.wav'));
      plan.sound = {...(plan.sound || {}), bgm: `_run/${runId}/bgm.wav`};
      bgmInfo = {ducked: made.ducked, duckDb: intervals.length ? DUCK.db : 0, skipped: false};
      console.log(made.ducked ? `配乐 OK（人声处压低 ${-DUCK.db} dB）` : '配乐 OK');
    } else {
      console.log('按 --no-bgm 静音');
    }

    const probe = checkFrames(plan);
    writeJson(path.join(outDir, 'scene.used.json'), result.scene);
    const propsPath = path.join(outDir, 'props.json');
    writeJson(propsPath, {plan: embedImages(plan), __probe: probe});
    console.log(`准备完成 ${plan.width}×${plan.height} ${plan.durationSec.toFixed(2)}s ${plan.durationFrames} 帧 ${plan.style} ${plan.motion}`);

    const browser = ensureTemplateBrowser({templateDir: TEMPLATE, log: console.log});
    const videoPath = path.join(outDir, 'video.mp4');
    const logPath = path.join(outDir, 'render.log');
    const renderArgs = withBrowserExecutable([
      REMOTION,
      'render',
      'src/index.ts',
      'Scene',
      videoPath,
      `--props=${propsPath}`,
      '--codec=h264',
      '--overwrite',
      '--log=verbose',
      '--scale',
      String(scale),
    ], browser);
    const lock = await acquireRenderLock({file: LOCK, id: `scene-${plan.style}`, log: console.log});
    let ran;
    try {
      const logFd = fs.openSync(logPath, 'w');
      try {
        ran = spawnSync(process.execPath, renderArgs, {
          cwd: TEMPLATE,
          stdio: ['ignore', logFd, logFd],
          windowsHide: true,
          timeout: 900000,
        });
      } finally {
        fs.closeSync(logFd);
      }
    } finally {
      lock.release();
    }
    if (!ran || ran.status !== 0 || !fs.existsSync(videoPath)) {
      const tail = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-30).join('\n') : '';
      console.error(`渲染失败（退出码 ${ran?.status ?? '无'}）`);
      if (tail) console.error(tail);
      throw new Error('渲染失败');
    }

    const log = fs.readFileSync(logPath, 'utf8');
    const probes = parseProbeLog(log);
    const slots = plan.screens.map((screen, index) => ({
      i: index,
      type: screen.layout,
      start: screen.start,
      end: screen.start + screen.duration,
    }));
    const sb = {
      meta: {lang: 'zh'},
      shots: plan.screens.map((screen) => ({
        type: screen.layout,
        params: {title: screen.blocks[0]?.text || '', items: screen.blocks.map((block) => block.text)},
      })),
    };
    const layout = layoutCheck({
      frames: probes,
      slots,
      sb,
      checkFrames: probe,
      fps: plan.fps,
      geo: {w: plan.width, h: plan.height, card: {x0: plan.safe.x, x1: plan.safe.x + plan.safe.w}},
      mustShow: [{i: 0, frame: 0, fields: ['params.title']}],
    });
    const safeIssue = frame0Issue(probes, plan);
    const capIssues = captionIssues(plan);
    const ffmpeg = ffmpegExe();
    const blank = blankRuns({
      video: videoPath,
      fps: plan.fps,
      cmd: (bits) => [ffmpeg, '-hide_banner', '-loglevel', 'error', ...bits],
    });
    const motion = motionIssues(videoPath, plan);
    for (const note of motion.notes) console.log(note);
    const sheetPath = path.join(outDir, 'sheet.png');
    const sheetOk = sheetOf(ffmpeg, videoPath, plan, sheetPath);

    const failed = [];
    if (layout.layoutIssues.length || layout.errors.length) failed.push(`版式 ${layout.layoutIssues.length + layout.errors.length} 条`);
    if (capIssues.length) failed.push(`字幕 ${capIssues.length} 条`);
    if (safeIssue) failed.push(safeIssue);
    if (!blank.ok || blank.error) failed.push(blank.error ? `空帧检查没跑成：${blank.error}` : `空帧 ${blank.runs.length} 段`);
    if (!probes.size) failed.push('没有布局探针');
    failed.push(...motion.fails);

    const videoName = failed.length ? 'video.rejected.mp4' : 'video.mp4';
    const manifest = {
      experimental: true,
      status: failed.length ? 'rejected' : 'delivered',
      style: plan.style,
      motion: plan.motion,
      product: plan.product,
      aspect: plan.aspect,
      width: plan.width,
      height: plan.height,
      scale,
      fps: plan.fps,
      durationSec: plan.durationSec,
      video: videoName,
      sheet: sheetOk ? 'sheet.png' : '',
      timing: plan.screens.map((screen) => ({index: screen.index, source: screen.reveal.source, kind: screen.reveal.kind})),
      voice: spoken
        ? {
            provider: spoken.cfg.provider,
            voiceId: spoken.cfg.voiceId,
            synthesized: spoken.synthesized,
            cacheHits: spoken.cacheHits,
            billedCharacters: spoken.billedCharacters,
            lines: spoken.lines.map((line) => ({
              index: line.index + 1,
              chars: [...line.text].length,
              durMs: line.durMs,
              cacheHit: line.cacheHit,
              granularity: line.granularity,
            })),
          }
        : {skipped: true, reason: noVoice ? '--no-voice' : '没有旁白'},
      bgm: bgmInfo,
      contrast: plan.contrast,
      checks: {
        layout: layout.layoutIssues.length || layout.errors.length ? 'fail' : 'ok',
        caption: capIssues.length ? 'fail' : 'ok',
        blank: blank.ok && !blank.error ? 'ok' : 'fail',
        contrast: plan.contrast.filter((row) => row.painted && row.ratio < 4.5).length ? 'fail' : 'ok',
        motion: motion.fails.length ? 'fail' : 'ok',
        frame0: safeIssue ? 'fail' : 'ok',
        layoutIssues: layout.layoutIssues,
        captionIssues: capIssues,
        blankRuns: blank.runs,
        frame0Issue: safeIssue,
        motionNotes: motion.notes,
      },
    };
    if (spoken) writeJson(path.join(outDir, 'voice.json'), manifest.voice);
    if (failed.length) {
      const rejected = path.join(outDir, 'video.rejected.mp4');
      if (fs.existsSync(rejected)) fs.rmSync(rejected);
      fs.renameSync(videoPath, rejected);
      writeJson(path.join(outDir, 'manifest.json'), manifest);
      console.error(failed.join('\n'));
      for (const line of layout.layoutIssues.slice(0, 8)) console.error(line);
      for (const line of capIssues.slice(0, 8)) console.error(line);
      const stop = new Error('检查没过');
      stop.exitCode = 3;
      throw stop;
    }
    const loud = fitProgramLoudness(ffmpeg, videoPath);
    if (loud) {
      manifest.loudness = {integratedLufs: loud.integrated, truePeakDb: loud.peak, gainDb: loud.gain};
      console.log(`响度 ${loud.beforeIntegrated} LUFS / 峰值 ${loud.beforePeak} dBTP，增益 ${loud.gain} dB → ${loud.integrated} LUFS / ${loud.peak} dBTP`);
    } else {
      console.log('响度没量到，成片保持渲染原样');
    }
    if (plan.product === 'lesson') {
      const inputHash = createHash('sha256').update(fs.readFileSync(scenePath)).digest('hex');
      const payload = aigcPayload(inputHash);
      embedAigcMetadata({videoPath, payload, ffmpeg: findFullFfmpeg(TEMPLATE), ffprobe: findRemotionFfprobe(TEMPLATE)});
      manifest.aigc = {key: 'AIGC', label: payload.Label, producer: payload.ContentProducer};
      console.log('已写入讲课 AIGC 隐式标识');
    }
    writeJson(path.join(outDir, 'manifest.json'), manifest);
    const leftover = path.join(outDir, 'video.rejected.mp4');
    if (fs.existsSync(leftover)) fs.rmSync(leftover);
    console.log(`交付：${videoPath}`);
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  if (error?.exitCode) process.exit(error.exitCode);
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
