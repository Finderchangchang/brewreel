import {Easing, interpolate} from 'remotion';

// ============================================================
// quiz / art 表演节奏工具。时间一律是「镜头内的秒」t（和 ShotProps.t 一致）。
// 全部是纯函数：同一个 t 永远算出同一个值（Remotion 逐帧渲染要求确定性）。
// ============================================================

const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 确定性伪随机 0..1 */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * 说话嘴型开合 0..1。rate = 每秒音节数（旁白读速约 6 字/秒）。
 * 每个音节一开一合，开口大小随机；每 4–6 个音节停顿一次（闭嘴），像在断句。
 * talk 不在 [from, to) 内返回 0。
 */
export const mouthAt = (t: number, from = 0, to = Infinity, rate = 6, seed = 1) => {
  if (t < from || t >= to) return 0;
  const u = (t - from) * rate;
  const i = Math.floor(u);
  const f = u - i;
  // 断句：约每 5 个音节有一个闭嘴的空拍
  if (hash(i * 3.1 + seed) < 0.16 && i > 0) return 0.05;
  const peak = 0.45 + 0.55 * hash(i + seed * 9.7);
  return peak * Math.sin(Math.PI * Math.min(1, f * 1.15));
};

/** 眨眼：返回 0..1（1 = 完全闭眼）。约每 2.6–3.6 秒眨一次，每次 3 帧 */
export const blinkAt = (t: number, seed = 1) => {
  const period = 2.6 + hash(seed) * 1.0;
  const phase = hash(seed * 5.3) * period;
  const d = (t + phase) % period;
  const len = 0.1;
  if (d > len) return 0;
  return Math.sin((d / len) * Math.PI);
};

/** 点头：从 t0 起点 times 次，每次 0.36 秒；返回 0..1（1 = 头最低） */
export const nodAt = (t: number, t0: number, times = 2, each = 0.36) => {
  const d = t - t0;
  if (d < 0 || d > times * each) return 0;
  return Math.sin(((d % each) / each) * Math.PI);
};

/** 待机呼吸：身体轻微起伏的位移（单位：角色坐标，600 高） */
export const breathe = (t: number, seed = 1) => Math.sin((t / 2.4) * Math.PI * 2 + seed * 2) * 1.6;

/** 跳起：t0 起 0.4 秒一个抛物线，返回离地高度（角色坐标），峰值 hop */
export const hopAt = (t: number, t0: number, hop = 40, dur = 0.4) => {
  const d = t - t0;
  if (d < 0 || d > dur) return 0;
  const k = d / dur;
  return 4 * hop * k * (1 - k);
};

/** easeOutBack 0→1（带回弹），探头、放大进场用 */
export const backOut = (t: number, t0: number, dur: number, s = 1.9) =>
  interpolate(t, [t0, t0 + dur], [0, 1], {...cl, easing: Easing.out(Easing.back(s))});

/** 线性 0→1 */
export const lin = (t: number, t0: number, dur: number) => interpolate(t, [t0, t0 + dur], [0, 1], cl);

/** 挥手：手臂摆角（度），常驻 */
export const waveAt = (t: number, speed = 2.6) => Math.sin(t * Math.PI * 2 * speed) * 16;
