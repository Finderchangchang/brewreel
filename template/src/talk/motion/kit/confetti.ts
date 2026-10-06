// 只铺在纸底上的纸屑。颜色由外观给。交接前 0.2 秒退干净。
// 大片 3–5 片，1080 宽上边长 70–140，带投影、飞行中自转。小片 4–8 片，边长 30–60。
// 至少 2 片大纸穿过画面后离开，其余落在边缘并继续漂。运动模糊只加在速度过了门槛的那几帧。

import {mulberry32, seedOf} from './rng.ts';

export const CONFETTI_COUNT = {min: 7, max: 13, default: 10};
/** 1080 宽上的边长。大片要能在 720 成片上看出投影和自转。 */
export const SCRAP_LARGE = {count: [3, 5] as const, size: [70, 140] as const};
export const SCRAP_SMALL = {count: [4, 8] as const, size: [30, 60] as const};
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
  return Math.min(14, (speed720 - BLUR_SPEED_720) / 80);
};

export type ScrapKind = 'tri' | 'quad' | 'disc';
export type ScrapMode = 'cross' | 'land';

export type Scrap = {
  /** 抛物线起点（可以在画面外） */
  x0: number;
  y0: number;
  /** 终点。cross 在画面外，land 在边缘 */
  x1: number;
  y1: number;
  /** 抛物线拱起的高度（像素，往上） */
  arc: number;
  rot0: number;
  /** 飞行过程转过的角度，180–540 */
  spin: number;
  /** 飞完要几秒 */
  flight: number;
  /** 边长，参考像素。大片 70–140，小片 30–60（1080 宽） */
  size: number;
  /** 大片才强调投影 */
  large: boolean;
  color: string;
  kind: ScrapKind;
  /** 顶点起伏 0–1，同一片每次渲染一样 */
  jag: number;
  mode: ScrapMode;
  /** 落地后的漂移振幅（像素）和周期（秒） */
  drift: number;
  driftT: number;
  /** 落地后的自转，度/秒。很慢，但不是 0 */
  driftSpin: number;
  /** 小投影。每片自己的偏移 */
  shadowDx: number;
  shadowDy: number;
};

export const scraps = (opts: {seed: string | number; count?: number; w: number; h: number; colors: string[]; dur: number}): Scrap[] => {
  const rng = mulberry32(seedOf(opts.seed) ^ 0xc0fe);
  const colors = opts.colors.length ? opts.colors : ['#CCCCCC'];
  const kinds: ScrapKind[] = ['tri', 'quad', 'disc'];
  const largeN = SCRAP_LARGE.count[0] + Math.floor(rng() * (SCRAP_LARGE.count[1] - SCRAP_LARGE.count[0] + 1));
  const smallN = SCRAP_SMALL.count[0] + Math.floor(rng() * (SCRAP_SMALL.count[1] - SCRAP_SMALL.count[0] + 1));
  const n = largeN + smallN;
  // 前几片是大片。至少 2 片大纸横穿，多出来的 0–1 片也横穿。
  const crossN = clamp(2 + Math.floor(rng() * 2), 2, Math.min(largeN, n));
  const out: Scrap[] = [];
  const w = Math.max(1, opts.w);
  const h = Math.max(1, opts.h);
  const room = Math.max(0.48, opts.dur - 0.35);
  for (let i = 0; i < n; i++) {
    const large = i < largeN;
    const mode: ScrapMode = i < crossN ? 'cross' : 'land';
    const span = large ? SCRAP_LARGE.size : SCRAP_SMALL.size;
    const size = span[0] + rng() * (span[1] - span[0]);
    const spinSign = rng() < 0.5 ? -1 : 1;
    const spin = spinSign * (180 + rng() * 360);
    let x1 = 0;
    let y1 = 0;
    if (mode === 'cross') {
      const dir = i % 2 === 0 ? 1 : -1;
      x1 = dir > 0 ? w + size + 30 : -size - 30;
      y1 = h * (0.15 + rng() * 0.7);
    } else {
      const edge = i % 4;
      const band = 0.03 + rng() * 0.09;
      x1 = w * (0.12 + rng() * 0.76);
      y1 = h * (0.1 + rng() * 0.55);
      if (edge === 0) x1 = w * band;
      else if (edge === 1) x1 = w * (1 - band) - size;
      else if (edge === 2) y1 = h * (0.04 + rng() * 0.08);
      else y1 = h * (0.62 + rng() * 0.12);
    }
    const fromLeft = x1 > w * 0.5;
    const x0 = fromLeft ? -size - 40 - rng() * 80 : w + size + 40 + rng() * 80;
    const y0 = mode === 'cross' ? h * (0.05 + rng() * 0.4) : -size - 20 - rng() * h * 0.25;
    out.push({
      x0,
      y0,
      x1,
      y1,
      arc: h * (0.12 + rng() * 0.28),
      rot0: rng() * 360,
      spin,
      flight: Math.min(mode === 'cross' ? 0.62 + rng() * 0.38 : 0.75 + rng() * 0.45, room),
      size,
      large,
      color: colors[i % colors.length],
      kind: kinds[i % kinds.length],
      jag: rng(),
      mode,
      drift: (large ? 14 : 8) + rng() * (large ? 18 : 12),
      driftT: 2.4 + rng() * 1.6,
      driftSpin: spinSign * (large ? 28 + rng() * 36 : 14 + rng() * 18),
      shadowDx: size * (0.06 + rng() * 0.04),
      shadowDy: size * (0.1 + rng() * 0.05),
    });
  }
  return out;
};

export type ScrapPose = {x: number; y: number; rot: number; opacity: number; speed: number; blur: number; vx: number; vy: number};

const parabola = (s: Scrap, u: number) => {
  const x = s.x0 + (s.x1 - s.x0) * u;
  const y = s.y0 + (s.y1 - s.y0) * u - s.arc * 4 * u * (1 - u);
  const vx = (s.x1 - s.x0) / s.flight;
  const vy = (s.y1 - s.y0) / s.flight - (s.arc * 4 * (1 - 2 * u)) / s.flight;
  return {x, y, vx, vy};
};

/** 某一帧这一片在哪、有多透明、要不要模糊。t 超过退场点之后 opacity 是 0。 */
export const scrapPose = (s: Scrap, t: number, dur: number, shortSide = 1080): ScrapPose => {
  const gone = Math.max(0.3, dur - HANDOFF_LEAD);
  const fadeFrom = Math.max(0, gone - 0.22);
  let opacity = 1;
  if (t >= gone || t < 0) opacity = 0;
  else if (t >= fadeFrom) opacity = 1 - (t - fadeFrom) / Math.max(1e-3, gone - fadeFrom);
  const flight = Math.max(0.2, s.flight);
  if (t <= flight) {
    const u = clamp(t / flight, 0, 1);
    const p = parabola(s, u);
    const ease = 1 - Math.pow(1 - u, 2);
    const speed = Math.hypot(p.vx, p.vy);
    return {
      x: p.x,
      y: p.y,
      rot: s.rot0 + s.spin * ease,
      opacity,
      speed,
      blur: opacity > 0 ? blurAmount(speed, shortSide) : 0,
      vx: p.vx,
      vy: p.vy,
    };
  }
  if (s.mode === 'cross') {
    return {x: s.x1, y: s.y1, rot: s.rot0 + s.spin, opacity: 0, speed: 0, blur: 0, vx: 0, vy: 0};
  }
  const dt = t - flight;
  const drift = s.drift * Math.sin((2 * Math.PI * dt) / s.driftT);
  const driftY = s.drift * 0.65 * Math.sin((2 * Math.PI * dt) / (s.driftT * 1.3) + 0.8);
  const vx = s.drift * ((2 * Math.PI) / s.driftT) * Math.cos((2 * Math.PI * dt) / s.driftT);
  const vy = s.drift * 0.65 * ((2 * Math.PI) / (s.driftT * 1.3)) * Math.cos((2 * Math.PI * dt) / (s.driftT * 1.3) + 0.8);
  const speed = Math.hypot(vx, vy);
  return {
    x: s.x1 + drift,
    y: s.y1 + driftY,
    rot: s.rot0 + s.spin + s.driftSpin * dt,
    opacity,
    speed,
    blur: opacity > 0 ? blurAmount(speed, shortSide) : 0,
    vx,
    vy,
  };
};
