// ============================================================
// 空帧检查：成片里「整屏几乎一个颜色」连续超过 maxFrames 帧就算空帧（转场停在纯色上、落版只剩一个小点）。
// 做法：ffmpeg 把整片缩成 36×64 的 RGB 原始帧（一格 = 原画 30×30 像素的平均色），
// 每帧取出现最多的颜色，和它相差 ≤ tol 的格子占比 ≥ ratio 就记为「近纯色帧」；连续段长度 > maxFrames 报出来。
// 只读成片，不依赖风格代码；make.mjs 抽完检查帧后调用。
// ============================================================
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const W = 36;
const H = 64;

/**
 * @param {object} o
 * @param {string} o.video mp4 路径
 * @param {(args: string[]) => string[]} o.cmd 返回 [可执行文件, ...参数]（make.mjs 决定用系统 ffmpeg 还是 Remotion 自带的）
 * @param {number} o.fps
 * @param {number} [o.ratio] 同色格子占比阈值（默认 0.95）
 * @param {number} [o.maxFrames] 允许的最长连续近纯色帧数（默认 6）
 * @param {number} [o.tol] 同色容差（三通道差的绝对值之和，默认 30）
 * @returns {{ok: boolean, runs: {from: number, to: number, frames: number, color: string, ratio: number}[], frames: number, error?: string}}
 */
export function blankRuns({video, cmd, fps, ratio = 0.95, maxFrames = 6, tol = 30, cwd}) {
  // 写到临时文件再读（Remotion 自带的 ffmpeg 没有 rawvideo 封装器，用 image2pipe 把一帧帧原始 RGB 接在一起）
  const tmp = path.join(os.tmpdir(), `promo-blank-${process.pid}-${Date.now()}.rgb`);
  const [bin, ...args] = cmd(['-y', '-i', video, '-vf', `scale=${W}:${H}:flags=area`, '-c:v', 'rawvideo', '-pix_fmt', 'rgb24', '-f', 'image2pipe', tmp]);
  const res = spawnSync(bin, args, {cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  const buf = fs.existsSync(tmp) ? fs.readFileSync(tmp) : null;
  try {
    fs.rmSync(tmp, {force: true});
  } catch {}
  if (res.status !== 0 || !buf?.length) return {ok: true, runs: [], frames: 0, error: (res.stderr || 'ffmpeg 没输出').slice(-300)};
  const size = W * H * 3;
  const n = Math.floor(buf.length / size);
  const flat = [];
  for (let f = 0; f < n; f++) {
    const o = f * size;
    // 出现最多的颜色（每通道量化到 16 级找众数，再用众数格子的平均色做参照）
    const hist = new Map();
    for (let p = 0; p < W * H; p++) {
      const k = ((buf[o + p * 3] >> 4) << 8) | ((buf[o + p * 3 + 1] >> 4) << 4) | (buf[o + p * 3 + 2] >> 4);
      hist.set(k, (hist.get(k) ?? 0) + 1);
    }
    let best = 0;
    let bestN = -1;
    for (const [k, c] of hist) if (c > bestN) [best, bestN] = [k, c];
    let sr = 0, sg = 0, sb = 0, cnt = 0;
    for (let p = 0; p < W * H; p++) {
      const r = buf[o + p * 3], g = buf[o + p * 3 + 1], b = buf[o + p * 3 + 2];
      if ((((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)) === best) (sr += r), (sg += g), (sb += b), cnt++;
    }
    const [cr, cg, cb] = [sr / cnt, sg / cnt, sb / cnt];
    let same = 0;
    for (let p = 0; p < W * H; p++) {
      const d = Math.abs(buf[o + p * 3] - cr) + Math.abs(buf[o + p * 3 + 1] - cg) + Math.abs(buf[o + p * 3 + 2] - cb);
      if (d <= tol) same++;
    }
    const r = same / (W * H);
    flat.push(r >= ratio ? {r, color: `#${[cr, cg, cb].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`} : null);
  }
  const runs = [];
  for (let f = 0; f < n; ) {
    if (!flat[f]) {
      f++;
      continue;
    }
    let e = f;
    let minR = 1;
    while (e < n && flat[e]) minR = Math.min(minR, flat[e++].r);
    if (e - f > maxFrames) runs.push({from: f / fps, to: e / fps, frames: e - f, color: flat[f].color, ratio: minR});
    f = e;
  }
  return {ok: runs.length === 0, runs, frames: n};
}
