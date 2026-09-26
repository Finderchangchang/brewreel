// ============================================================
// 动画工具。所有时间用「镜头内的秒」t（ShotProps.t），0 = 本镜开始。
// 关键动作尽量落在整拍：用 props.beat（120 BPM 时 0.5 秒）乘整数。
// ============================================================
import {Easing, interpolate, spring} from 'remotion';
import type React from 'react';
import {FPS} from './safe';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 弹簧 0→1，t0 之前为 0。damping 小 = 更弹。常用：卡片 (14,170)；气泡 (11,220)；大字 (16,170)；仪表指针 (16,70) */
export const pop = (t: number, t0: number, damping = 14, stiffness = 170) =>
  t < t0 ? 0 : spring({frame: Math.round((t - t0) * FPS), fps: FPS, config: {damping, stiffness}});

/** 缓动 0→1（出） */
export const easeOut = (t: number, t0: number, dur: number) =>
  interpolate(t, [t0, t0 + dur], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
/** 缓动 0→1（进） */
export const easeIn = (t: number, t0: number, dur: number) =>
  interpolate(t, [t0, t0 + dur], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
/** 缓动 0→1（进出） */
export const ease = (t: number, t0: number, dur: number) =>
  interpolate(t, [t0, t0 + dur], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});

export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** 入场样式：上浮 + 淡入（弹簧）。dy 为起始下移量 */
export const rise = (p: number, dy = 40): React.CSSProperties => ({
  opacity: Math.min(1, p * 1.5),
  transform: `translateY(${(1 - p) * dy}px)`,
});
/** 入场样式：从小放大（弹簧），origin 为变换原点 */
export const grow = (p: number, from = 0.6, origin = '50% 50%'): React.CSSProperties => ({
  opacity: Math.min(1, p * 2),
  transform: `scale(${from + (1 - from) * p})`,
  transformOrigin: origin,
});
/** 入场样式：从左/右滑入 */
export const slide = (p: number, dx = 160): React.CSSProperties => ({
  opacity: Math.min(1, p * 1.6),
  transform: `translateX(${(1 - p) * dx}px)`,
});

/** 一次性衰减抖动（冲击感），返回位移系数 -1..1 */
export const kick = (t: number, t0: number, dur = 0.45) => {
  const d = t - t0;
  if (d < 0 || d > dur) return 0;
  return Math.sin(d * 42) * Math.exp(-d * 9);
};
/** 一次性鼓一下（0→1→0），用于数字落定、按钮按下 */
export const bump = (t: number, t0: number, dur = 0.45) => {
  const d = t - t0;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI) * Math.exp(-d * 3);
};
/** 常驻漂浮（首帧装饰用，第 0 帧就在位） */
export const float = (t: number, phase = 0, amp = 8, period = 1.6) => Math.sin((t / period) * Math.PI * 2 + phase) * amp;

/** 打字机：返回 t 时已经打出的文字 */
export const typewriter = (text: string, t: number, t0: number, charSec = 0.1) => {
  const chars = Array.from(text);
  if (t < t0) return '';
  return chars.slice(0, Math.min(chars.length, Math.floor((t - t0) / charSec) + 1)).join('');
};

/** 弹簧落定时刻：从 t0 起，弹簧值第一次达到 0.98 的时间（用来对齐音效/数字弹跳） */
export const settleAt = (t0: number, damping = 16, stiffness = 70) => {
  for (let fr = 0; fr < 150; fr++) {
    if (spring({frame: fr, fps: FPS, config: {damping, stiffness}}) >= 0.98) return t0 + fr / FPS;
  }
  return t0 + 1;
};

/**
 * 把一串「拍点」压进镜头时长：内容太多时整体按比例压缩，保证最后一个动作在 dur - tail 之前完成。
 * 返回缩放系数 k（≤1），用法：at = k * plannedAt。
 */
export const fitTimeline = (plannedEnd: number, dur: number, tail = 0.6) => Math.min(1, Math.max(0.3, (dur - tail) / Math.max(0.01, plannedEnd)));
