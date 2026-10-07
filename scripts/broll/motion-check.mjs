// 动效段出片检查：在动效面板里量相邻帧差，抓「停死」和「整屏闪」。
// 抽样只用 -r、scale、灰度、rawvideo。像素在这里算，不靠 ffmpeg 的 fps / tile 滤镜。
//   node scripts/broll/motion-check.mjs --video <成片.mp4> --project <项目目录> [--json <输出.json>]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ffmpegPath, probeMedia} from './media.mjs';
import {buildPlan} from './plan.mjs';
import {normalizedMediaOf} from './normalize.mjs';
import {loadProject, loadStyles} from './validate.mjs';

/** 抽样宽度。竖版 720 收到这一档，人脸圆窗和卡片都还在。 */
export const SAMPLE_WIDTH = 270;
/** 大约 15 帧/秒。0.4 秒窗口里有 6 对帧。 */
export const SAMPLE_FPS = 15;
/** 灰度差达到这个值，这一像素算「动了」。低于它的当编码噪点。 */
export const PIXEL_ON = 12;

/**
 * 标定（v0120-motioncheck）：
 * 停死看最安静的 0.4 秒窗口里，帧差最大的那一对。好片最差 0.65（剪纸 counter），
 * 坏片把一帧冻住 1.6 秒后是 0.00。低于 0.4 算停死，但只有低于 stillHard 0.2 才 ✗（冻帧 0.00、
 * 没加浮动之前默认 steps 0.08）；0.2–0.4 只出 ⚠，因为 0.4 离好片最差只有 1.6 倍。
 * 闪看孤立跳变：帧差 ≥ jumpFloor，且 ≥ jumpRatio × 局部中位数，并且两帧后回到原画面。
 * 好片最大孤立倍数低于 6，坏片插亮帧是 14.3 倍，间距大于 2 倍，所以仍是 ✗。
 * freezeLevel / jumpLevel 为 warn 时只印 ⚠，不拦交付。间距不到 2 倍才降成 warn。
 */
export const DEFAULTS = {
  sampleFps: SAMPLE_FPS,
  sampleWidth: SAMPLE_WIDTH,
  pixelOn: PIXEL_ON,
  stillMean: 0.4,
  /** 最安静窗口低于这个才判 ✗；在它和 stillMean 之间只出 ⚠。 */
  stillHard: 0.2,
  freezeWindowSec: 0.4,
  edgePadSec: 0.2,
  jumpRatio: 6,
  jumpRadius: 4,
  /** 段首段尾各让这么久不判闪。面板推进是 0.36 秒，切进来的那一下帧差会鼓一下，不是纸纹在闪。 */
  jumpEdgeSec: 0.5,
  jumpFloor: 8,
  freezeLevel: 'fail',
  jumpLevel: 'fail',
};

const tc = (sec) => {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${String(m).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}`;
};

export const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const round3 = (n) => Math.round(n * 1000) / 1000;

/** 两帧灰度的均值差，和「变了的像素」占比。mask 为 0 的像素不看（人脸圆窗、字幕带）。 */
export const diffPair = (prev, next, w, h, mask, pixelOn) => {
  const nPix = w * h;
  let sum = 0;
  let on = 0;
  let n = 0;
  for (let i = 0; i < nPix; i++) {
    if (mask && mask[i] === 0) continue;
    const d = Math.abs(prev[i] - next[i]);
    sum += d;
    if (d >= pixelOn) on += 1;
    n += 1;
  }
  return {mean: n ? sum / n : 0, area: n ? on / n : 0, n};
};

let layoutMod = null;
const layoutApi = async () => {
  if (layoutMod) return layoutMod;
  const keep = process.listeners('warning');
  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    if (w?.code === 'MODULE_TYPELESS_PACKAGE_JSON') return;
    if (keep.length) for (const l of keep) l(w);
    else console.error(String(w?.stack || w));
  });
  layoutMod = await import('../../template/src/talk/layout.ts');
  return layoutMod;
};

const punchRect = (mask, w, h, x, y, rw, rh) => {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(w, Math.ceil(x + rw));
  const y1 = Math.min(h, Math.ceil(y + rh));
  for (let yy = y0; yy < y1; yy++) {
    const row = yy * w;
    for (let xx = x0; xx < x1; xx++) mask[row + xx] = 0;
  }
};

/**
 * 动效面板的采样掩码。矩形来自 layoutOf(...).broll，动效段圆窗用 MOTION_PIP_K。
 * 圆窗是口播的脸，字幕是另一层，两块从面板里挖掉，免得嘴在动或换字幕被当成卡片在动、或当成闪。
 */
export const panelMask = async (videoW, videoH, mode, outW, outH) => {
  const {layoutOf, MOTION_PIP_K, CAPTION_LINE} = await layoutApi();
  const lay = layoutOf(mode === 'full' || mode === 'pip' ? mode : 'split', videoW, videoH, 1, MOTION_PIP_K);
  const sx = outW / videoW;
  const sy = outH / videoH;
  const mask = new Uint8Array(outW * outH);
  const box = lay.broll;
  const x0 = Math.max(0, Math.floor(box.x * sx));
  const y0 = Math.max(0, Math.floor(box.y * sy));
  const x1 = Math.min(outW, Math.ceil((box.x + box.width) * sx));
  const y1 = Math.min(outH, Math.ceil((box.y + box.height) * sy));
  for (let y = y0; y < y1; y++) {
    const row = y * outW;
    for (let x = x0; x < x1; x++) mask[row + x] = 1;
  }
  if (lay.face && lay.face.shape === 'circle') {
    const cx = (lay.face.x + lay.face.width / 2) * sx;
    const cy = (lay.face.y + lay.face.height / 2) * sy;
    const rx = (lay.face.width / 2) * sx + 2;
    const ry = (lay.face.height / 2) * sy + 2;
    const fx0 = Math.max(0, Math.floor(cx - rx));
    const fy0 = Math.max(0, Math.floor(cy - ry));
    const fx1 = Math.min(outW, Math.ceil(cx + rx));
    const fy1 = Math.min(outH, Math.ceil(cy + ry));
    for (let y = fy0; y < fy1; y++) {
      for (let x = fx0; x < fx1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) mask[y * outW + x] = 0;
      }
    }
  }
  const cap = lay.caption;
  const block = Math.round(cap.fontSize * CAPTION_LINE);
  const pad = 4;
  punchRect(mask, outW, outH, cap.x * sx - pad, cap.y * sy - pad, cap.width * sx + pad * 2, block * Math.max(2, cap.lines) * sy + pad * 2);
  return {mask, rect: {x: x0, y: y0, w: x1 - x0, h: y1 - y0}};
};

/**
 * 一段帧序列的判定。frames[i] 是一帧灰度（长度 w*h）。
 * 停死：去掉段首段尾各 edgePadSec 之后，还有任意 freezeWindowSec 的窗口，里面每一对都低于 stillMean。
 * 闪：某一对的帧差 ≥ jumpFloor，且 ≥ jumpRatio × 前后 jumpRadius 对的中位数，并且两帧之后又回到原来的画面（孤立的一帧，不是卡片滑进来留下的）。
 * 段首段尾 jumpEdgeSec 不算（切换和面板推进）。
 */
export const scoreFrames = (frames, w, h, opts = {}) => {
  const o = {...DEFAULTS, ...opts};
  const pairs = [];
  for (let i = 1; i < frames.length; i++) pairs.push(diffPair(frames[i - 1], frames[i], w, h, o.mask, o.pixelOn));
  const fps = o.sampleFps;
  const startSec = o.startSec || 0;
  const padFrames = Math.round(o.edgePadSec * fps);
  const win = Math.max(2, Math.round(o.freezeWindowSec * fps));
  const nFrames = frames.length;
  let quietest = Infinity;
  let quietAt = startSec;
  let windowCount = 0;
  for (let i = 0; i + win <= pairs.length; i++) {
    const frame0 = i;
    const frame1 = i + win;
    if (frame0 < padFrames || frame1 > nFrames - 1 - padFrames) continue;
    windowCount += 1;
    let maxMean = 0;
    for (let k = 0; k < win; k++) if (pairs[i + k].mean > maxMean) maxMean = pairs[i + k].mean;
    if (maxMean < quietest) {
      quietest = maxMean;
      quietAt = startSec + i / fps;
    }
  }
  if (!Number.isFinite(quietest)) quietest = pairs.reduce((m, p) => Math.min(m, p.mean), pairs.length ? Infinity : 0);

  let run = 0;
  let bestRun = 0;
  let bestStart = 0;
  let runStart = 0;
  let stillPairs = 0;
  for (let i = 0; i < pairs.length; i++) {
    const inside = i >= padFrames && i + 1 <= nFrames - 1 - padFrames;
    if (!inside) continue;
    if (pairs[i].mean < o.stillMean) {
      stillPairs += 1;
      if (run === 0) runStart = i;
      run += 1;
      if (run > bestRun) {
        bestRun = run;
        bestStart = runStart;
      }
    } else run = 0;
  }
  const insidePairs = pairs.slice(padFrames, Math.max(padFrames, pairs.length - padFrames));
  const stillPairPct = insidePairs.length ? (stillPairs / insidePairs.length) * 100 : 0;
  const meanArea = pairs.length ? pairs.reduce((s, p) => s + p.area, 0) / pairs.length : 0;

  let maxRatio = 0;
  let maxRatioAt = startSec;
  let maxRatioMean = 0;
  let maxRatioMedian = 0;
  let jumpHit = false;
  let jumpAt = startSec;
  let jumpMean = 0;
  let jumpMedian = 0;
  let jumpRatioHit = 0;
  let maxIsolatedRatio = 0;
  const edge = o.jumpEdgePairs != null ? o.jumpEdgePairs : Math.round((o.jumpEdgeSec ?? 0.5) * fps);
  for (let i = edge; i < pairs.length - edge; i++) {
    const neigh = [];
    for (let k = i - o.jumpRadius; k <= i + o.jumpRadius; k++) {
      if (k === i || k < 0 || k >= pairs.length) continue;
      neigh.push(pairs[k].mean);
    }
    const med = median(neigh);
    const ratio = pairs[i].mean / Math.max(med, 1e-3);
    if (ratio > maxRatio) {
      maxRatio = ratio;
      maxRatioAt = startSec + i / fps;
      maxRatioMean = pairs[i].mean;
      maxRatioMedian = med;
    }
    // pairs[i] 是 frames[i] 和 frames[i+1]。闪的那一帧是后者：再隔一帧应该回到 frames[i] 附近。
    // 卡片滑入会留下，frames[i] 和 frames[i+2] 仍然差很多，不算闪。
    if (i + 2 >= frames.length) continue;
    const reverted = diffPair(frames[i], frames[i + 2], w, h, o.mask, o.pixelOn).mean;
    const isolated = reverted <= pairs[i].mean * 0.45;
    if (isolated && ratio > maxIsolatedRatio) maxIsolatedRatio = ratio;
    if (pairs[i].mean >= o.jumpFloor && ratio >= o.jumpRatio && isolated) {
      jumpHit = true;
      if (ratio >= jumpRatioHit) {
        jumpRatioHit = ratio;
        jumpAt = startSec + i / fps;
        jumpMean = pairs[i].mean;
        jumpMedian = med;
      }
    }
  }

  const freezeHit = windowCount > 0 && bestRun >= win;
  // 停死分两档：最安静窗口低于 stillHard 才拦（冻帧 0.00、没加浮动的 steps 0.08）。
  // 介于 stillHard 和 stillMean 之间只提醒：好片最低 0.65，离 0.4 只有 1.6 倍，真实口播可能更安静，不能为这个拒收。
  const freezeLevel = freezeHit && o.freezeLevel === 'fail' && quietest >= o.stillHard ? 'warn' : o.freezeLevel;
  const short = windowCount === 0;
  let level = 'ok';
  if ((freezeHit && freezeLevel === 'fail') || (jumpHit && o.jumpLevel === 'fail')) level = 'fail';
  else if (freezeHit || jumpHit) level = 'warn';

  return {
    short,
    windowCount,
    quietest: round3(quietest),
    quietAt: round3(quietAt),
    longestStillSec: round3(bestRun / fps),
    stillFrom: round3(startSec + bestStart / fps),
    stillPairPct: round3(stillPairPct),
    meanArea: round3(meanArea),
    maxRatio: round3(maxRatio),
    maxRatioAt: round3(maxRatioAt),
    maxRatioMean: round3(maxRatioMean),
    maxRatioMedian: round3(maxRatioMedian),
    jumpAt: round3(jumpAt),
    jumpMean: round3(jumpMean),
    jumpMedian: round3(jumpMedian),
    jumpRatioHit: round3(jumpRatioHit),
    maxIsolatedRatio: round3(maxIsolatedRatio),
    freezeHit,
    jumpHit,
    freezeLevel,
    jumpLevel: o.jumpLevel,
    stillMean: o.stillMean,
    level,
    curve: pairs.map((p) => round3(p.mean)),
    areas: pairs.map((p) => round3(p.area)),
  };
};

export const formatLine = (seg) => {
  const span = `${tc(seg.startSec)}–${tc(seg.endSec)}`;
  const head = `${seg.id} ${span}`;
  if (seg.error) return `${head} ✗ 没抽成帧（${seg.error}）。检查 ffmpeg 和成片。`;
  if (seg.short && !seg.jumpHit) {
    return `${head} 太短，去头去尾之后不够 0.4 秒，不判停死。最大跳变 ${seg.maxRatio.toFixed(1)} 倍。`;
  }
  if (seg.level === 'ok') {
    return `${head} 通过：最安静的 0.4 秒帧差 ${seg.quietest.toFixed(2)}，静止帧对 ${seg.stillPairPct.toFixed(0)}%，运动面积 ${(seg.meanArea * 100).toFixed(1)}%，最大跳变 ${seg.maxRatio.toFixed(1)} 倍。`;
  }
  const bits = [];
  if (seg.freezeHit) {
    const mark = seg.freezeLevel === 'warn' ? '⚠' : '✗';
    bits.push(
      `停死 ${mark}：${tc(seg.stillFrom)} 起连续 ${seg.longestStillSec.toFixed(2)} 秒帧差低于 ${seg.stillMean}（最安静窗口 ${seg.quietest.toFixed(2)}）。落定后让主卡片继续轻轻动，不要停在那儿。`,
    );
  }
  if (seg.jumpHit) {
    const mark = seg.jumpLevel === 'warn' ? '⚠' : '✗';
    bits.push(
      `闪 ${mark}：${tc(seg.jumpAt)} 那一对帧差 ${seg.jumpMean.toFixed(1)}，是前后中位数 ${seg.jumpMedian.toFixed(2)} 的 ${seg.jumpRatioHit.toFixed(1)} 倍，下一帧又回到原画面。纸纹、剪边、纸屑用固定种子，不要每帧换随机数重画。`,
    );
  }
  return `${head} ${bits.join('')}`;
};

const sampleSize = (videoW, videoH, sampleWidth) => {
  const outW = sampleWidth % 2 === 0 ? sampleWidth : sampleWidth - 1;
  const outH = Math.max(2, Math.round((videoH * outW) / videoW / 2) * 2);
  return {outW, outH};
};

/** 从成片上抽出一段灰度帧。-ss 先跳到附近，再精确往前走一小段，避免整段重解码，也避免关键帧误差把上一段切进来。 */
export const sampleClip = (video, startSec, endSec, videoW, videoH, opts = {}) => {
  const fps = opts.sampleFps || SAMPLE_FPS;
  const {outW, outH} = sampleSize(videoW, videoH, opts.sampleWidth || SAMPLE_WIDTH);
  const dur = Math.max(0.05, endSec - startSec);
  const preroll = Math.min(0.45, Math.max(0, startSec));
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    (startSec - preroll).toFixed(3),
    '-i',
    video,
    '-ss',
    preroll.toFixed(3),
    '-t',
    dur.toFixed(3),
    '-an',
    '-vf',
    `scale=${outW}:${outH}`,
    '-r',
    String(fps),
    '-f',
    'rawvideo',
    '-pix_fmt',
    'gray',
    'pipe:1',
  ];
  const r = spawnSync(ffmpegPath(), args, {windowsHide: true, maxBuffer: 96 * 1024 * 1024});
  if (r.status !== 0 || !r.stdout || !r.stdout.length) {
    const tail = String(r.stderr || r.stdout || '没有输出')
      .trim()
      .split(/\r?\n/)
      .slice(-4)
      .join(' / ');
    throw new Error(`抽帧失败：${tail}`);
  }
  const frameBytes = outW * outH;
  const buf = r.stdout;
  const n = Math.floor(buf.length / frameBytes);
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(buf.subarray(i * frameBytes, (i + 1) * frameBytes));
  return {frames, w: outW, h: outH};
};

const maskKey = (mode) => mode || 'split';
const maskCache = new Map();

/**
 * 检查一支成片里的动效段。clips 用计划里的字段：source、id、mode、windowMs、template。
 * @returns {Promise<{ok: boolean, failCount: number, warnCount: number, lines: string[], segments: object[], payload: object}>}
 */
export const checkTalkMotion = async ({video, width, height, clips, jsonPath, thresholds} = {}) => {
  if (!video || !fs.existsSync(video)) throw new Error('成片不在，动效检查没跑。');
  if (!(width > 0) || !(height > 0)) throw new Error(`成片尺寸不对：${width}×${height}。`);
  const o = {...DEFAULTS, ...thresholds};
  const motion = (clips || []).filter((c) => c.source === 'motion' && Array.isArray(c.windowMs));
  if (!motion.length) {
    const lines = ['没有动效段，跳过动效检查。'];
    const payload = {ok: true, video, lines, segments: [], thresholds: o};
    if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    return {ok: true, failCount: 0, warnCount: 0, lines, segments: [], payload};
  }
  const segments = [];
  for (const c of motion) {
    const startSec = c.windowMs[0] / 1000;
    const endSec = c.windowMs[1] / 1000;
    const base = {id: c.id, template: c.template || '', mode: c.mode || 'split', startSec: round3(startSec), endSec: round3(endSec)};
    try {
      const sampled = sampleClip(video, startSec, endSec, width, height, o);
      if (sampled.frames.length < 2) throw new Error(`只抽到 ${sampled.frames.length} 帧`);
      const key = `${maskKey(c.mode)}:${sampled.w}x${sampled.h}`;
      if (!maskCache.has(key)) maskCache.set(key, await panelMask(width, height, c.mode, sampled.w, sampled.h));
      const {mask, rect} = maskCache.get(key);
      const judged = scoreFrames(sampled.frames, sampled.w, sampled.h, {...o, mask, startSec});
      segments.push({...base, rect, frames: sampled.frames.length, ...judged});
    } catch (e) {
      segments.push({...base, error: e.message, level: 'fail', freezeHit: false, jumpHit: false, line: ''});
    }
  }
  for (const seg of segments) seg.line = formatLine(seg);
  const lines = segments.map((s) => s.line);
  const failCount = segments.filter((s) => s.level === 'fail').length;
  const warnCount = segments.filter((s) => s.level === 'warn').length;
  const payload = {
    ok: failCount === 0,
    video: path.resolve(video),
    width,
    height,
    sampleFps: o.sampleFps,
    sampleWidth: o.sampleWidth,
    thresholds: {
      stillMean: o.stillMean,
      jumpRatio: o.jumpRatio,
      jumpFloor: o.jumpFloor,
      pixelOn: o.pixelOn,
      freezeWindowSec: o.freezeWindowSec,
      edgePadSec: o.edgePadSec,
      freezeLevel: o.freezeLevel,
      jumpLevel: o.jumpLevel,
    },
    lines,
    segments,
  };
  if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return {ok: failCount === 0, failCount, warnCount, lines, segments, payload};
};

/** 按项目目录的 broll.json 取时间轴（和 make-talk 同一条 buildPlan），再检查成片。 */
export const checkProject = async ({video, projectDir, jsonPath, thresholds} = {}) => {
  const loaded = loadProject(projectDir);
  if (!loaded.ok) throw new Error(loaded.message);
  const styles = loadStyles();
  const renderMedia = normalizedMediaOf(loaded.media);
  const probed = probeMedia(video);
  const media = {...renderMedia, width: probed.width, height: probed.height};
  const plan = buildPlan({
    doc: loaded.doc,
    cues: loaded.cues,
    media,
    style: styles[loaded.doc.style],
    styles,
    projectDir,
    tokens: loaded.tokens,
  });
  return checkTalkMotion({video, width: plan.width, height: plan.height, clips: plan.clips, jsonPath, thresholds});
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const argv = process.argv.slice(2);
  let video = '';
  let projectDir = '';
  let jsonPath = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--video' && next) {
      video = path.resolve(next);
      i += 1;
    } else if (a === '--project' && next) {
      projectDir = path.resolve(next);
      i += 1;
    } else if (a === '--json' && next) {
      jsonPath = path.resolve(next);
      i += 1;
    } else {
      console.log(`不认识的参数 ${a}。用法：node scripts/broll/motion-check.mjs --video <成片.mp4> --project <项目目录> [--json <输出.json>]`);
      process.exit(2);
    }
  }
  if (!video || !projectDir) {
    console.log('用法：node scripts/broll/motion-check.mjs --video <成片.mp4> --project <项目目录> [--json <输出.json>]');
    process.exit(2);
  }
  if (!jsonPath) jsonPath = path.join(path.dirname(video), 'motion-check.json');
  try {
    const result = await checkProject({video, projectDir, jsonPath});
    for (const line of result.lines) console.log(line);
    console.log(`动效检查：${result.failCount} 处 ✗，${result.warnCount} 处 ⚠。JSON：${jsonPath}`);
    process.exit(result.ok ? 0 : 4);
  } catch (e) {
    console.log(e.message || String(e));
    process.exit(4);
  }
}
