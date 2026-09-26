#!/usr/bin/env node
// ============================================================
// 风格蒸馏第一步：从参考视频抽帧、出总览拼图、找场景切换点（给拆解用，见 distill/）。
//   node scripts/extract-frames.mjs <参考视频> --out <仓库外的目录> [--fps 4] [--scene 0.3] [--cols 8] [--audio]
// 产物（都在 --out 下）：
//   info.json        时长、分辨率、帧率、场景切换时间点
//   frames/          每秒 --fps 张（宽 540）
//   contact.jpg      每秒一格的总览拼图（--cols 列；要完整版 ffmpeg，Remotion 自带的精简版没有 tile 滤镜，就只出 contact.html）
//   contact.html     同一份总览，浏览器打开看（任何 ffmpeg 都能出）
//   cuts/            每个场景切换点后的第一帧（全分辨率）
//   audio.wav        --audio 时导出单声道 22.05kHz 音轨（找节拍、测旁白用）
// ffmpeg：优先用环境变量 FFMPEG 指向的可执行文件，否则用 template/node_modules 里 Remotion 自带的 ffmpeg。
// 版权：参考视频和抽出来的帧只放仓库外，不许提交；--out 落在仓库里会直接退出。
// ============================================================
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(ROOT, 'template');
const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d;
};
const VALUED = ['--out', '--fps', '--scene', '--cols'];
const input = argv.find((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));
const USAGE = '用法：node scripts/extract-frames.mjs <参考视频> --out <仓库外的目录> [--fps 4] [--scene 0.3] [--cols 8] [--audio]';
if (!input || !opt('--out')) {
  console.log(USAGE);
  process.exit(2);
}
const video = path.resolve(input);
if (!fs.existsSync(video)) {
  console.log(`找不到视频：${video}`);
  process.exit(2);
}
const out = path.resolve(opt('--out'));
const rel = path.relative(ROOT, out);
if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
  console.log(`输出目录在仓库里面：${out}\n参考视频的帧不许进仓库（版权），--out 给仓库外的目录`);
  process.exit(2);
}
const fps = Number(opt('--fps', 4));
const scene = Number(opt('--scene', 0.12));
const cols = Math.max(1, Math.round(Number(opt('--cols', 8))));

const ff = (args, {binary = false} = {}) => {
  const bin = process.env.FFMPEG;
  const base = ['-hide_banner', ...args];
  const o = {encoding: binary ? 'buffer' : 'utf8', maxBuffer: 512 * 1024 * 1024};
  const p = bin ? spawnSync(bin, base, o) : spawnSync(process.execPath, [REMOTION, 'ffmpeg', ...base], {cwd: TEMPLATE, ...o});
  if (p.error) {
    console.log(`调用 ffmpeg 失败：${p.error.message}（设 FFMPEG 环境变量指向 ffmpeg，或先在 template/ 下 npm install）`);
    process.exit(4);
  }
  return p;
};

fs.mkdirSync(path.join(out, 'frames'), {recursive: true});
fs.mkdirSync(path.join(out, 'cuts'), {recursive: true});

// 1. 基本信息（从 ffmpeg -i 的输出里读）
const probe = ff(['-i', video]).stderr ?? '';
const dm = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(probe);
const duration = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0;
const vm = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(probe);
const fm = /([\d.]+)\s*fps/.exec(probe);
const info = {video: path.basename(video), duration, width: vm ? Number(vm[1]) : null, height: vm ? Number(vm[2]) : null, fps: fm ? Number(fm[1]) : null, hasAudio: /Audio:/.test(probe)};
if (!duration) {
  console.log(`读不出视频时长，可能不是视频文件：\n${probe.split('\n').slice(-5).join('\n')}`);
  process.exit(4);
}
console.log(`视频 ${info.width}x${info.height}，${info.fps ?? '?'} fps，${duration.toFixed(2)} 秒${info.hasAudio ? '，有音轨' : '，无音轨'}`);

// 2. 抽帧（用输出帧率 -r，不用 fps 滤镜：Remotion 自带的精简版 ffmpeg 没有 fps / tile / select 滤镜）
ff(['-y', '-loglevel', 'error', '-i', video, '-vf', 'scale=540:-2', '-r', String(fps), '-q:v', '3', path.join(out, 'frames', 'f_%04d.jpg')]);
const frameFiles = fs.readdirSync(path.join(out, 'frames')).filter((f) => f.endsWith('.jpg')).sort();
console.log(`抽帧：${frameFiles.length} 张（每秒 ${fps} 张）→ ${path.join(out, 'frames')}`);

// 3. 总览：contact.html 一定有（每秒一格，取抽出来的帧）；有完整版 ffmpeg 时再出 contact.jpg
const perSec = frameFiles.filter((_, k) => k % Math.max(1, Math.round(fps)) === 0);
const cells = perSec.map((f, k) => `<figure><img src="frames/${f}" loading="lazy"><figcaption>${k}s</figcaption></figure>`).join('\n');
fs.writeFileSync(path.join(out, 'contact.html'), `<!doctype html><meta charset="utf-8"><title>${info.video}</title><style>body{font:14px sans-serif;margin:12px}main{display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px}figure{margin:0}img{width:100%;display:block}figcaption{color:#555}</style><h3>${info.video} · ${duration.toFixed(2)}s · ${info.width}x${info.height}</h3><main>\n${cells}\n</main>`, 'utf8');
const rows = Math.max(1, Math.ceil(duration / cols));
const tiled = ff(['-y', '-loglevel', 'error', '-i', video, '-vf', `fps=1,scale=240:-2,pad=iw+6:ih+6:3:3:white,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', path.join(out, 'contact.jpg')]);
console.log(tiled.status === 0 && fs.existsSync(path.join(out, 'contact.jpg')) ? `总览拼图：${cols}x${rows} 格 → ${path.join(out, 'contact.jpg')}` : `总览：${path.join(out, 'contact.html')}（这个 ffmpeg 没有 tile 滤镜，没出 contact.jpg；要图片版就设 FFMPEG 指向完整版 ffmpeg）`);

// 4. 场景切换点：10 fps 灰度小图逐帧比较（平均亮度差占满量程的比例 > --scene 算一次切换），不依赖 select 滤镜
const sw = 64;
const sh = Math.max(2, Math.round((sw * (info.height ?? 16)) / (info.width ?? 9) / 2) * 2);
// 每帧一个小文件（精简版 ffmpeg 没有 rawvideo 封装，但有 rawvideo 编码 + image2 封装），读完就删
const tmp = path.join(out, '.diff');
fs.rmSync(tmp, {recursive: true, force: true});
fs.mkdirSync(tmp, {recursive: true});
ff(['-y', '-loglevel', 'error', '-i', video, '-vf', `scale=${sw}:${sh}`, '-r', '10', '-c:v', 'rawvideo', '-pix_fmt', 'gray', '-f', 'image2', path.join(tmp, 'g_%05d.gray')]);
const raw = Buffer.concat(fs.readdirSync(tmp).filter((f) => f.endsWith('.gray')).sort().map((f) => fs.readFileSync(path.join(tmp, f))));
fs.rmSync(tmp, {recursive: true, force: true});
const fsz = sw * sh;
const diffs = [];
for (let k = 1; k * fsz + fsz <= raw.length; k++) {
  let s = 0;
  for (let j = 0; j < fsz; j++) s += Math.abs(raw[k * fsz + j] - raw[(k - 1) * fsz + j]);
  diffs.push({t: Number((k / 10).toFixed(2)), d: s / fsz / 255});
}
const cuts = diffs.filter((x, k) => x.d > scene && x.d >= (diffs[k - 1]?.d ?? 0) && x.d >= (diffs[k + 1]?.d ?? 0)).map((x) => x.t);
info.diffPeaks = [...diffs].sort((a, b) => b.d - a.d).slice(0, 12).map((x) => ({t: x.t, diff: Number(x.d.toFixed(3))}));
info.sceneThreshold = scene;
info.cuts = cuts;
cuts.forEach((t, k) => {
  ff(['-y', '-loglevel', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-q:v', '2', path.join(out, 'cuts', `cut_${String(k + 1).padStart(2, '0')}_${t.toFixed(2)}s.jpg`)]);
});
console.log(cuts.length ? `场景切换 ${cuts.length} 处（阈值 ${scene}）：${cuts.map((t) => t.toFixed(2)).join('、')} 秒 → ${path.join(out, 'cuts')}` : `阈值 ${scene} 下没有场景切换（可能是一镜到底；想找更细的变化把 --scene 调低，info.json 的 diffPeaks 是变化最大的 12 个时刻）`);

// 5. 音轨
if (argv.includes('--audio') && info.hasAudio) {
  ff(['-y', '-loglevel', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '22050', path.join(out, 'audio.wav')]);
  console.log(`音轨 → ${path.join(out, 'audio.wav')}`);
}

fs.writeFileSync(path.join(out, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
console.log(`完成：${path.join(out, 'info.json')}`);
