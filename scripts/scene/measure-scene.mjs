#!/usr/bin/env node
// node scripts/scene/measure-scene.mjs <目录>
// 目录下要有 A/ B/ C/，各含 video.mp4、plan.json、manifest.json。
// 量圆角、200ms 垂直方向、回弹次数；拼同时刻静帧和 compare.mp4。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {measureEnter} from '../../template/src/scene/prepare.ts';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ffmpegExe() {
  const ran = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], {encoding: 'utf8'});
  const exe = String(ran.stdout || '').trim();
  if (ran.status !== 0 || !exe || !fs.existsSync(exe)) throw new Error('找不到 imageio_ffmpeg 的 ffmpeg');
  return exe;
}

function pngSize(file) {
  const buf = fs.readFileSync(file);
  return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)};
}

function rawFrame(ffmpeg, video, frame, dest) {
  const ran = spawnSync(ffmpeg, ['-y', '-i', video, '-vf', `select=eq(n\\,${frame})`, '-vsync', '0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', dest], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (ran.status !== 0 || !fs.existsSync(dest)) throw new Error(`抽原始帧失败 ${frame}：${(ran.stderr || '').slice(-300)}`);
  return fs.readFileSync(dest);
}

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function cardRadius(rgb, width, height, surface) {
  const [sr, sg, sb] = hexRgb(surface);
  const near = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const i = (y * width + x) * 3;
    return Math.abs(rgb[i] - sr) + Math.abs(rgb[i + 1] - sg) + Math.abs(rgb[i + 2] - sb) <= 28;
  };
  let seed = -1;
  for (let y = 0; y < height && seed < 0; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (near(x, y)) {
        seed = y * width + x;
        break;
      }
    }
  }
  if (seed < 0) return {radius: null, reason: '没有找到卡片色'};
  const seen = new Uint8Array(width * height);
  const queue = [seed];
  seen[seed] = 1;
  let head = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const x = cur % width;
    const y = (cur - x) / width;
    count += 1;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    const next = [];
    if (x > 0) next.push(cur - 1);
    if (x + 1 < width) next.push(cur + 1);
    if (y > 0) next.push(cur - width);
    if (y + 1 < height) next.push(cur + width);
    for (const n of next) {
      if (seen[n]) continue;
      const nx = n % width;
      const ny = (n - nx) / width;
      if (!near(nx, ny)) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  const rowLeft = (y) => {
    const yy = Math.max(minY, Math.min(maxY, y));
    for (let x = minX; x <= maxX; x++) if (seen[yy * width + x]) return x;
    return null;
  };
  const mid = Math.round((minY + maxY) / 2);
  const leftMid = rowLeft(mid);
  const leftTop = rowLeft(minY + 2);
  if (leftMid === null || leftTop === null) return {radius: null, reason: '卡片边量不到', count};
  return {
    radius: leftTop - leftMid,
    judged: leftTop - leftMid <= 3 ? 0 : leftTop - leftMid,
    box: [minX, minY, maxX, maxY],
    count,
  };
}

function run(ffmpeg, args) {
  const ran = spawnSync(ffmpeg, args, {encoding: 'utf8', windowsHide: true});
  if (ran.status !== 0) throw new Error(`${args.slice(0, 6).join(' ')} 失败：${(ran.stderr || '').slice(-500)}`);
}

const root = process.argv[2];
if (!root) {
  console.error('用法: node scripts/scene/measure-scene.mjs <目录>');
  process.exit(2);
}
const ffmpeg = ffmpegExe();
const names = ['A', 'B', 'C'];
const rows = [];
for (const name of names) {
  const dir = path.join(root, name);
  const plan = readJson(path.join(dir, 'plan.json'));
  const manifest = readJson(path.join(dir, 'manifest.json'));
  const motion = measureEnter(plan.motion, plan.height);
  const screen = plan.screens[0];
  const frame = Math.max(0, screen.startFrame + screen.durationFrames - Math.round(0.2 * plan.fps));
  const rawPath = path.join(dir, 'settled.rgb');
  const rgb = rawFrame(ffmpeg, path.join(dir, 'video.mp4'), frame, rawPath);
  fs.rmSync(rawPath, {force: true});
  const preview = path.join(dir, 'shot-1.png');
  const size = fs.existsSync(preview) ? pngSize(preview) : {width: Math.round(plan.width * (manifest.scale || 1)), height: Math.round(plan.height * (manifest.scale || 1))};
  if (rgb.length < size.width * size.height * 3) {
    throw new Error(`${name} 原始帧只有 ${rgb.length} 字节，画幅 ${size.width}×${size.height}`);
  }
  const radius = cardRadius(rgb.subarray(0, size.width * size.height * 3), size.width, size.height, plan.roles.surface);
  rows.push({
    name,
    style: plan.style,
    motion: plan.motion,
    product: plan.product,
    tokenRadius: plan.roles.radius,
    pixelRadius: radius.radius,
    pixelJudged: radius.judged ?? null,
    radiusBox: radius.box || null,
    vertical: motion.vertical,
    dy: Number(motion.dy.toFixed(3)),
    scaleTurns: motion.scaleTurns,
    tiltPeak: Number(motion.tiltPeak.toFixed(2)),
    durationSec: plan.durationSec,
    texts: plan.screens.map((item) => item.blocks.map((block) => block.text)),
  });
  console.log(`${name} radius token ${plan.roles.radius} pixel ${radius.radius} | ${motion.vertical} dy ${motion.dy.toFixed(2)} turns ${motion.scaleTurns} tilt ${motion.tiltPeak.toFixed(1)}`);
}

const textsSame = JSON.stringify(rows[0].texts) === JSON.stringify(rows[1].texts) && JSON.stringify(rows[1].texts) === JSON.stringify(rows[2].texts);
const passRadius = rows[0].pixelJudged > 8 && rows[1].pixelJudged === 0;
const passVertical = rows[2].vertical === 'up';
const passBounce = rows[0].scaleTurns === 1 && rows[1].scaleTurns === 0;
const passed = [passRadius, passVertical, passBounce].filter(Boolean).length;
const report = {textsSame, passRadius, passVertical, passBounce, passed, need: 2, rows};
fs.writeFileSync(path.join(root, 'measure.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const shots = readJson(path.join(root, 'A', 'manifest.json')).shots || [];
const inputs = [];
const filters = [];
let index = 0;
for (const shot of shots) {
  for (const name of names) {
    inputs.push('-i', path.join(root, name, shot.name));
    filters.push(`[${index}:v]scale=360:640:flags=area,setsar=1[v${index}]`);
    index += 1;
  }
}
const cols = names.length;
const rowsN = shots.length;
const layout = [];
for (let r = 0; r < rowsN; r++) {
  for (let c = 0; c < cols; c++) layout.push(`${c * 360}_${r * 640}`);
}
const stacked = shots.map((_, r) => names.map((__, c) => `[v${r * cols + c}]`).join('')).join('');
run(ffmpeg, [
  '-y',
  ...inputs,
  '-filter_complex',
  `${filters.join(';')};${stacked}xstack=inputs=${index}:layout=${layout.join('|')}[out]`,
  '-map',
  '[out]',
  '-frames:v',
  '1',
  path.join(root, 'compare-sheet.png'),
]);

const duration = Math.min(8, ...rows.map((row) => row.durationSec));
run(ffmpeg, [
  '-y',
  '-i', path.join(root, 'A', 'video.mp4'),
  '-i', path.join(root, 'B', 'video.mp4'),
  '-i', path.join(root, 'C', 'video.mp4'),
  '-filter_complex',
  '[0:v]scale=360:640:flags=area,setsar=1[a];[1:v]scale=360:640:flags=area,setsar=1[b];[2:v]scale=360:640:flags=area,setsar=1[c];[a][b][c]hstack=inputs=3,trim=duration=' + duration.toFixed(3) + ',setpts=PTS-STARTPTS[out]',
  '-map', '[out]',
  '-an',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  path.join(root, 'compare.mp4'),
]);
console.log(`measure ${passed}/3 textsSame ${textsSame} sheet compare.mp4 ${duration.toFixed(2)}s`);
if (passed < 2 || !textsSame) process.exit(1);
