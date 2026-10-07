// 落定之后的慢浮动。上下 1–1.5% 高，倾斜 ±2–3°。
// 两个周期落在 1.6–2.4 s，而且按 0.1 秒取整后互质，避免合成出一个短的机械循环。
// 水平振幅和上下一样，相位差 90°，波峰也不会停。另外给一点 rotateX / rotateY。

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const FLOAT_RANGE = {
  y: [0.01, 0.015] as const,
  tilt: [2, 3] as const,
  period: [1.6, 2.4] as const,
};

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const n = x % y;
    x = y;
    y = n;
  }
  return x;
};

/** 两个周期（秒）按 scale 取整后是否互质。默认 0.1 秒一格。 */
export const periodsCoprime = (a: number, b: number, scale = 10): boolean => {
  const ia = Math.round(a * scale);
  const ib = Math.round(b * scale);
  if (ia <= 0 || ib <= 0) return false;
  return gcd(ia, ib) === 1;
};

export type FloatOpts = {
  /** 上下振幅占高度的比例 */
  ampY?: number;
  /** 倾斜振幅（度） */
  ampTilt?: number;
  periodY?: number;
  periodTilt?: number;
  /**
   * 相对默认振幅的倍数，夹在 0.05–1。
   * 1 是剪纸。非剪纸落定后的主卡片用 0.5，不超过剪纸默认的一半。
   */
  ampScale?: number;
};

export type FloatSample = {x: number; y: number; tilt: number; rotX: number; rotY: number; h: number};

export type FloatMotion = {
  ampY: number;
  ampTilt: number;
  periodY: number;
  periodTilt: number;
  at: (t: number) => FloatSample;
};

const nudgeCoprime = (period: number, other: number): number => {
  let p = clamp(period, FLOAT_RANGE.period[0], FLOAT_RANGE.period[1]);
  if (periodsCoprime(p, other)) return Math.round(p * 1000) / 1000;
  for (let i = 1; i <= 8; i++) {
    const up = clamp(Math.round((p + i * 0.1) * 10) / 10, FLOAT_RANGE.period[0], FLOAT_RANGE.period[1]);
    const dn = clamp(Math.round((p - i * 0.1) * 10) / 10, FLOAT_RANGE.period[0], FLOAT_RANGE.period[1]);
    if (periodsCoprime(up, other)) return up;
    if (periodsCoprime(dn, other)) return dn;
  }
  return p;
};

/**
 * @param height 振幅参照的高度（像素），和上抛用同一套面板 / 取景框高。
 */
export const floatMotion = (height: number, opts: FloatOpts = {}): FloatMotion => {
  const ampFrac = clamp(opts.ampY ?? 0.015, FLOAT_RANGE.y[0], FLOAT_RANGE.y[1]);
  const ampTilt = clamp(opts.ampTilt ?? 3, FLOAT_RANGE.tilt[0], FLOAT_RANGE.tilt[1]);
  const periodY = clamp(opts.periodY ?? 1.6, FLOAT_RANGE.period[0], FLOAT_RANGE.period[1]);
  const periodTilt = nudgeCoprime(opts.periodTilt ?? 1.7, periodY);
  const ampScale = clamp(opts.ampScale ?? 1, 0.05, 1);
  const H = Math.max(1, height);
  const ampY = ampFrac * H * ampScale;
  const tiltAmp = ampTilt * ampScale;
  const at = (t: number): FloatSample => {
    const w = (2 * Math.PI * t) / periodY;
    // 水平与上下差 90°。纯上下在波峰会停大约 0.4 秒；绕一小圈之后速度几乎不变。
    const x = ampY * Math.cos(w);
    const y = ampY * Math.sin(w);
    const tilt = tiltAmp * Math.sin((2 * Math.PI * t) / periodTilt);
    const rotX = 3.2 * Math.sin((2 * Math.PI * t) / 2.1 + 0.4);
    const rotY = 2.8 * Math.sin((2 * Math.PI * t) / 1.9 + 1.1);
    const h = Math.min(0.2, Math.abs(y) / Math.max(1, ampY) * 0.16);
    return {x, y, tilt, rotX, rotY, h};
  };
  return {ampY, ampTilt: tiltAmp, periodY, periodTilt, at};
};
