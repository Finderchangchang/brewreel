// 一次上抛 + 角度过冲 + 几乎不二次回弹的落定。
// 对应原理「落定」：锚点先离开静止位，再回到原位附近。上去短、下来长，角度过冲一截，
// 位置只越过静止位一点点（不超过画面高的 1%）就停住，不再弹回去。
// 返回的 y：屏幕坐标，负值在静止位上方。tilt：度。speed：像素/秒。

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 原理给的区间。调用时超出的参数会被夹回区间。 */
export const SETTLE_RANGE = {
  travel: [0.15, 0.25] as const,
  up: [0.4, 0.7] as const,
  down: [0.8, 1.1] as const,
  tiltOver: [10, 18] as const,
  posOver: 0.01,
};

export type SettleOpts = {
  /** 行程占高度的比例，默认 0.20，夹在 0.15–0.25 */
  travel?: number;
  /** 上去的秒数，默认 0.55，夹在 0.4–0.7。下来总是更长 */
  up?: number;
  /** 下来的秒数，默认 0.95，夹在 0.8–1.1 */
  down?: number;
  /** 角度过冲的幅度（度），默认 14，夹在 10–18 */
  tiltOver?: number;
  /** 位置过冲占高度的比例，默认 0.004，不超过 0.01。落定后停在这里，不弹回静止位 */
  posOver?: number;
  /** 静止倾斜（度）。过冲在它的一侧来回，不越过它 */
  restTilt?: number;
  /** 过冲方向。默认 +1，往正侧甩，静止角附近的禁区留在行程外面 */
  sign?: number;
};

export type SettleSample = {y: number; tilt: number; speed: number};

export type Settle = {
  duration: number;
  up: number;
  down: number;
  travel: number;
  tiltOver: number;
  posOver: number;
  restTilt: number;
  at: (t: number) => SettleSample;
};

/**
 * @param height 行程和位置过冲参照的高度（像素）。口播动效里用取景框的高，上抛才落在纸面里。
 */
export const settle = (height: number, opts: SettleOpts = {}): Settle => {
  const travel = clamp(opts.travel ?? 0.2, SETTLE_RANGE.travel[0], SETTLE_RANGE.travel[1]);
  const up = clamp(opts.up ?? 0.55, SETTLE_RANGE.up[0], SETTLE_RANGE.up[1]);
  const down = clamp(opts.down ?? 0.95, SETTLE_RANGE.down[0], SETTLE_RANGE.down[1]);
  const tiltOver = clamp(opts.tiltOver ?? 14, SETTLE_RANGE.tiltOver[0], SETTLE_RANGE.tiltOver[1]);
  const posOver = clamp(opts.posOver ?? 0.004, 0, SETTLE_RANGE.posOver);
  const rest = opts.restTilt ?? 0;
  const sign = opts.sign === undefined ? 1 : opts.sign < 0 ? -1 : 1;
  const H = Math.max(1, height);
  const travelPx = travel * H;
  const overPx = posOver * H;
  const T = up + down;
  const at = (t: number): SettleSample => {
    if (t <= 0) return {y: 0, tilt: rest, speed: 0};
    if (t >= T) return {y: overPx, tilt: rest, speed: 0};
    if (t <= up) {
      const u = t / up;
      const y = -travelPx * (1 - Math.cos(Math.PI * u)) / 2;
      const speed = Math.abs((travelPx * Math.PI) / (2 * up) * Math.sin(Math.PI * u));
      const tilt = rest + sign * tiltOver * Math.sin((Math.PI * u) / 2);
      return {y, tilt, speed};
    }
    const u = (t - up) / down;
    const s = 1 - Math.pow(1 - u, 3);
    const y = -travelPx + (travelPx + overPx) * s;
    const speed = Math.abs((travelPx + overPx) * ((3 * Math.pow(1 - u, 2)) / down));
    const back = Math.min(1, u / 0.85);
    const e = back * back * (3 - 2 * back);
    const tilt = rest + sign * tiltOver * (1 - e);
    return {y, tilt, speed};
  };
  return {duration: T, up, down, travel, tiltOver, posOver, restTilt: rest, at};
};
