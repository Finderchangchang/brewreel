// 按 seed 生成的手剪不规则圆角多边形。4–7 边，边缘有一点毛糙，投影参数全片统一。
// 对应原理：锚点是一块自己剪的纸，不是图标；投影偏下、颜色是底色压暗，让纸离开纸面。
// 静止倾斜默认落在 −7°…+7°。有一个必须躲开的招牌静止角（见 TILT_AVOID），±2° 以内的结果会被推出去。
// 五边形可以出现，但不会停在那个招牌角度上。

import {mulberry32, seedOf} from './rng.ts';

export const TILT_MIN = -7;
export const TILT_MAX = 7;
/** 参考片锚点的静止角。默认范围碰不到它；范围被放宽时仍要离开 ±TILT_AVOID_BAND。 */
export const TILT_AVOID = -12.9;
export const TILT_AVOID_BAND = 2;

/** 720 宽时的投影：偏右 0–12 px、偏下 36–47 px 的中段。1080 参考像素乘 1.5。 */
export const SHADOW_720 = {dx: 8, dy: 42};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 把一个角度收进 [min, max]，并推出招牌静止角 ±2° 的禁区。 */
export const safeTilt = (deg: number, min = TILT_MIN, max = TILT_MAX): number => {
  const loB = TILT_AVOID - TILT_AVOID_BAND;
  const hiB = TILT_AVOID + TILT_AVOID_BAND;
  let t = clamp(deg, min, max);
  if (t < loB || t > hiB) return Math.round(t * 100) / 100;
  const below = loB - 0.05;
  const above = hiB + 0.05;
  const cand = [below, above].filter((v) => v >= min - 1e-6 && v <= max + 1e-6);
  if (cand.length) t = cand.reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a));
  else t = Math.abs(min - TILT_AVOID) >= Math.abs(max - TILT_AVOID) ? min : max;
  if (t >= loB && t <= hiB) t = min < loB ? min : max;
  return Math.round(clamp(t, min, max) * 100) / 100;
};

/** seed → 默认范围内的静止角（已经躲开禁区）。 */
export const tiltFromSeed = (seed: string | number, min = TILT_MIN, max = TILT_MAX): number => {
  const rng = mulberry32(seedOf(seed) ^ 0x51ed);
  return safeTilt(min + rng() * (max - min), min, max);
};

/** 同一外观共用一个静止角，相邻两段的倾斜差才是 0，接力条件（≤ 3°）自然满足。多边形仍按每段的 seed 变。 */
export const restTiltFor = (key: string): number => tiltFromSeed(key);

/**
 * 投影偏移。shortSide 把 720 的参数换到参考像素（1080 → ×1.5）。
 * k < 1 只给小纸签：方向和比例不变，按纸签的大小缩小，避免投影比纸还大。锚点用 k = 1。
 */
export const shadowOffset = (shortSide = 1080, k = 1): {dx: number; dy: number} => {
  const s = (Math.max(0.5, shortSide) / 720) * (k > 0 ? k : 1);
  return {dx: Math.round(SHADOW_720.dx * s * 10) / 10, dy: Math.round(SHADOW_720.dy * s * 10) / 10};
};

/** 投影色 = 底色压暗。不是纯黑。若正好压到招牌那支投影青，就再压一档。 */
const SHADOW_AVOID = '#4B8481';
export const shadowColor = (bg: string): string => {
  const m = /^#([0-9a-fA-F]{6})$/.exec(bg.trim());
  if (!m) return '#2A2A2A';
  const n = parseInt(m[1], 16);
  const pack = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  let hex = pack(((n >> 16) & 255) * 0.42, ((n >> 8) & 255) * 0.42, (n & 255) * 0.42);
  if (hex.toLowerCase() === '#000000') hex = '#1A1A1A';
  if (hex.toLowerCase() === SHADOW_AVOID.toLowerCase()) {
    hex = pack(((n >> 16) & 255) * 0.28, ((n >> 8) & 255) * 0.28, (n & 255) * 0.28);
  }
  return hex;
};

export type CutGeometry = {
  sides: number;
  tilt: number;
  /** 多边形路径，坐标在 width × height 的盒子里，不含倾斜（倾斜由视图旋转） */
  d: string;
  shadow: {dx: number; dy: number};
  /** 字放在这块里，躲开毛边和投影 */
  inner: {x: number; y: number; w: number; h: number};
};

export type CutOpts = {
  width?: number;
  height?: number;
  sidesMin?: number;
  sidesMax?: number;
  /** 明示倾斜。仍会过 safeTilt */
  tilt?: number;
  tiltMin?: number;
  tiltMax?: number;
  /** 边缘毛糙，相对短半径的比例。默认 0.06 */
  roughness?: number;
  /** 半径起伏的下限和幅度。小纸签收窄，避免剪成一条放不下字 */
  wobbleMin?: number;
  wobbleSpan?: number;
  shortSide?: number;
  /** 小纸签把投影按比例缩小。锚点不传（1） */
  shadowK?: number;
  /** 落定过程中的角度原样用，不再夹进静止范围。静止角自己要先过 safeTilt */
  keepTilt?: boolean;
};

type Pt = {x: number; y: number};

const roundedPath = (pts: Pt[], rad: number): string => {
  const n = pts.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const v1x = prev.x - cur.x;
    const v1y = prev.y - cur.y;
    const v2x = next.x - cur.x;
    const v2y = next.y - cur.y;
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const r = Math.min(rad, l1 * 0.32, l2 * 0.32);
    const p1x = cur.x + (v1x / l1) * r;
    const p1y = cur.y + (v1y / l1) * r;
    const p2x = cur.x + (v2x / l2) * r;
    const p2y = cur.y + (v2y / l2) * r;
    parts.push(`${i === 0 ? 'M' : 'L'} ${p1x.toFixed(1)} ${p1y.toFixed(1)}`);
    parts.push(`Q ${cur.x.toFixed(1)} ${cur.y.toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`);
  }
  parts.push('Z');
  return parts.join(' ');
};

/**
 * @param seed 每段一个。决定边数、半径起伏和毛边。倾斜默认也从 seed 来；同一外观要共用倾斜时传入 tilt。
 */
export const cutGeometry = (seed: string | number, opts: CutOpts = {}): CutGeometry => {
  const width = Math.max(8, opts.width ?? 100);
  const height = Math.max(8, opts.height ?? 100);
  const minS = Math.max(3, Math.round(opts.sidesMin ?? 4));
  const maxS = Math.max(minS, Math.round(opts.sidesMax ?? 7));
  const rng = mulberry32(seedOf(seed));
  const sides = minS + Math.floor(rng() * (maxS - minS + 1));
  const tilt = opts.keepTilt && opts.tilt != null
    ? opts.tilt
    : safeTilt(opts.tilt ?? tiltFromSeed(seedOf(seed) ^ 0x9e3779b9, opts.tiltMin, opts.tiltMax), opts.tiltMin ?? TILT_MIN, opts.tiltMax ?? TILT_MAX);
  const shadow = shadowOffset(opts.shortSide ?? 1080, opts.shadowK ?? 1);
  const padX = shadow.dx + 6;
  const padY = shadow.dy + 6;
  const cx = (width - shadow.dx) / 2;
  const cy = (height - shadow.dy) / 2;
  const rx = Math.max(4, (width - padX) / 2);
  const ry = Math.max(4, (height - padY) / 2);
  const start = rng() * Math.PI * 2;
  const verts: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const ang = start + (i * 2 * Math.PI) / sides;
    // 五边也故意不做成接近正多边形：半径起伏至少有一截
    const wobble = (opts.wobbleMin ?? 0.72) + rng() * (opts.wobbleSpan ?? 0.42);
    verts.push({x: cx + Math.cos(ang) * rx * wobble, y: cy + Math.sin(ang) * ry * wobble});
  }
  const amp = (opts.roughness ?? 0.055) * Math.min(rx, ry);
  const rough: Pt[] = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    rough.push(a);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const j = (rng() - 0.5) * 2 * amp;
    rough.push({x: mx + (-dy / len) * j, y: my + (dx / len) * j});
  }
  const rad = Math.min(rx, ry) * 0.12;
  const d = roundedPath(rough, rad);
  const innerW = rx * 1.15;
  const innerH = ry * 1.05;
  return {
    sides,
    tilt,
    d,
    shadow,
    inner: {
      x: cx - innerW / 2,
      y: cy - innerH / 2,
      w: innerW,
      h: innerH,
    },
  };
};
