// 只铺在纸底上的碎屑。数量和颜色由外观给。交接前 0.2 秒退干净。
// 运动模糊只加在真正还在动、而且速度过了门槛的那几帧上（720 宽约 200 px/s，参考像素按短边换算）。
// 对应原理：碎屑证明纸是活的，但不跟锚点抢，也不带到下一段。

import {mulberry32, seedOf} from './rng.ts';

export const CONFETTI_COUNT = {min: 8, max: 20, default: 14};
/** 720 宽时，超过这个速度才加模糊。 */
export const BLUR_SPEED_720 = 200;
/** 交接前多久碎屑必须没了。 */
export const HANDOFF_LEAD = 0.2;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const confettiCount = (n?: number): number => Math.round(clamp(n ?? CONFETTI_COUNT.default, CONFETTI_COUNT.min, CONFETTI_COUNT.max));

/**
 * 运动模糊的像素半径。速度是参考像素/秒（短边 1080）。没过门槛返回 0。
 */
export const blurAmount = (speedRef: number, shortSide = 1080): number => {
  const speed720 = speedRef * (720 / Math.max(1, shortSide));
  if (speed720 <= BLUR_SPEED_720) return 0;
  return Math.min(6, (speed720 - BLUR_SPEED_720) / 140);
};

export type ScrapKind = 'tri' | 'quad' | 'disc';

export type Scrap = {
  /** 落定位置。入场从 x+vx、y+vy 飞到这里，停在画面边缘 */
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  /** 边长，参考像素。1080 宽上 18–36 */
  size: number;
  color: string;
  kind: ScrapKind;
  /** 顶点起伏 0–1，同一片每次渲染一样 */
  jag: number;
  /** 这一片在第几秒停住。停住以后速度是 0，不加模糊 */
  land: number;
};

export const scraps = (opts: {seed: string | number; count?: number; w: number; h: number; colors: string[]; dur: number}): Scrap[] => {
  const rng = mulberry32(seedOf(opts.seed) ^ 0xc0fe);
  const n = confettiCount(opts.count);
  const colors = opts.colors.length ? opts.colors : ['#CCCCCC'];
  const gone = Math.max(0.3, opts.dur - HANDOFF_LEAD);
  const out: Scrap[] = [];
  const kinds: ScrapKind[] = ['tri', 'quad', 'disc'];
  for (let i = 0; i < n; i++) {
    const edge = i % 4;
    const band = 0.05 + rng() * 0.09;
    let x = opts.w * (0.08 + rng() * 0.84);
    let y = opts.h * (0.06 + rng() * 0.72);
    if (edge === 0) x = opts.w * band;
    else if (edge === 1) x = opts.w * (1 - band) - 28;
    else if (edge === 2) y = opts.h * band;
    else y = opts.h * (0.78 + rng() * 0.06);
    const ox = x - opts.w / 2;
    const oy = y - opts.h / 2;
    const olen = Math.hypot(ox, oy) || 1;
    const dist = 120 + rng() * 200;
    out.push({
      x,
      y,
      vx: (ox / olen) * dist,
      vy: (oy / olen) * dist,
      rot: rng() * 360,
      vr: (rng() - 0.5) * 220,
      size: 18 + rng() * 18,
      color: colors[i % colors.length],
      kind: kinds[i % kinds.length],
      jag: rng(),
      land: gone * (0.35 + rng() * 0.4),
    });
  }
  return out;
};

export type ScrapPose = {x: number; y: number; rot: number; opacity: number; speed: number; blur: number};

/** 某一帧这一片在哪、有多透明、要不要模糊。t 超过退场点之后 opacity 是 0。 */
export const scrapPose = (s: Scrap, t: number, dur: number, shortSide = 1080): ScrapPose => {
  const gone = Math.max(0.3, dur - HANDOFF_LEAD);
  const fadeFrom = Math.max(0, gone - 0.28);
  const land = Math.max(0.05, s.land);
  const u = clamp(t / land, 0, 1);
  const ease = 1 - (1 - u) * (1 - u);
  const moving = u < 1 && t < gone;
  const speed = moving ? (Math.hypot(s.vx, s.vy) * 2 * (1 - u)) / land : 0;
  let opacity = 1;
  if (t >= gone) opacity = 0;
  else if (t >= fadeFrom) opacity = 1 - (t - fadeFrom) / (gone - fadeFrom);
  const k = 1 - ease;
  return {
    x: s.x + s.vx * k,
    y: s.y + s.vy * k,
    rot: s.rot + s.vr * ease,
    opacity,
    speed,
    blur: opacity > 0 ? blurAmount(speed, shortSide) : 0,
  };
};
