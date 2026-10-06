// 锚点的一次上抛、飞入和翻出。
// 上抛：行程 18–24% 高，上升 0.5–0.6 s（ease-out），下落 0.9–1.1 s，末速比下落前段至少掉一个数量级。
// 角度过冲约 14°，只过一次，然后回到静止角。位置过冲不超过高度的 1%，是落地点附近的一小下，最后回到 0，好接上浮动。
// 飞入：0.45–0.6 s，从下方或侧面进来，起始角 ±25–40°。翻出：0.35–0.5 s，rotateX 到 70–90°。
// y 是屏幕坐标，负值在静止位上方。角度单位是度。

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const TOSS_RANGE = {
  travel: [0.18, 0.24] as const,
  up: [0.5, 0.6] as const,
  down: [0.9, 1.1] as const,
  tiltOver: [12, 16] as const,
  posOver: 0.01,
  rotX: [10, 25] as const,
  rotY: [10, 20] as const,
};

export const ENTRANCE_RANGE = {
  dur: [0.45, 0.6] as const,
  startTilt: [25, 40] as const,
  tiltOver: [12, 16] as const,
  posOver: 0.01,
};

export const EXIT_RANGE = {
  dur: [0.35, 0.5] as const,
  rotX: [70, 90] as const,
};

/** 屏幕上的透视距离（720 宽成片的像素）。取区间下沿，顶点的近大远小才看得出。参考坐标里再乘 bw/720。 */
export const PERSPECTIVE = 1000;

export type AirSample = {
  x: number;
  y: number;
  tilt: number;
  rotX: number;
  rotY: number;
  /** 离纸高度 0–1。落地为 0，投影据此收紧。 */
  h: number;
  speed: number;
};

export type TossOpts = {
  travel?: number;
  up?: number;
  down?: number;
  tiltOver?: number;
  /** 位置过冲占高度的比例，不超过 0.01。落在主下落的末尾，随后回到 0 */
  posOver?: number;
  restTilt?: number;
  sign?: number;
  rotX?: number;
  rotY?: number;
  rotYSign?: number;
};

export type Toss = {
  duration: number;
  up: number;
  down: number;
  travel: number;
  tiltOver: number;
  posOver: number;
  restTilt: number;
  rotX: number;
  rotY: number;
  at: (t: number) => AirSample;
};

/**
 * @param height 行程参照的高度（像素）。split 用面板高，pip / full 用取景框高。
 */
export const toss = (height: number, opts: TossOpts = {}): Toss => {
  const travel = clamp(opts.travel ?? 0.24, TOSS_RANGE.travel[0], TOSS_RANGE.travel[1]);
  const up = clamp(opts.up ?? 0.55, TOSS_RANGE.up[0], TOSS_RANGE.up[1]);
  const down = clamp(opts.down ?? 1, TOSS_RANGE.down[0], TOSS_RANGE.down[1]);
  const tiltOver = clamp(opts.tiltOver ?? 14, TOSS_RANGE.tiltOver[0], TOSS_RANGE.tiltOver[1]);
  const posOver = clamp(opts.posOver ?? 0.006, 0, TOSS_RANGE.posOver);
  const rotXAmp = clamp(opts.rotX ?? 25, TOSS_RANGE.rotX[0], TOSS_RANGE.rotX[1]);
  const rotYAmp = clamp(opts.rotY ?? 20, TOSS_RANGE.rotY[0], TOSS_RANGE.rotY[1]);
  const rest = opts.restTilt ?? 0;
  const sign = opts.sign === undefined ? 1 : opts.sign < 0 ? -1 : 1;
  const ySign = opts.rotYSign === undefined ? sign : opts.rotYSign < 0 ? -1 : 1;
  const H = Math.max(1, height);
  const travelPx = travel * H;
  const overPx = posOver * H;
  const main = down * 0.86;
  const back = down - main;
  const T = up + down;
  const landT = up + main;
  const at = (t: number): AirSample => {
    // 3D 倾角在高度顶点满幅，不放在整段中点（中点已经在下落）。两端为 0。
    let spinEnv = 0;
    if (t <= up) spinEnv = Math.sin((Math.PI * t) / (2 * up));
    else if (t <= landT) spinEnv = Math.cos((Math.PI * (t - up)) / (2 * main));
    const rotX = rotXAmp * spinEnv;
    const rotY = ySign * rotYAmp * spinEnv;
    if (t <= 0 || t >= T) return {x: 0, y: 0, tilt: rest, rotX: 0, rotY: 0, h: 0, speed: 0};
    let y = 0;
    let speed = 0;
    if (t <= up) {
      const u = t / up;
      // ease-out：起步快，到顶点速度落到 0
      const s = Math.sin((Math.PI * u) / 2);
      y = -travelPx * s;
      speed = Math.abs((travelPx * Math.PI) / (2 * up) * Math.cos((Math.PI * u) / 2));
    } else if (t <= landT) {
      const u = (t - up) / main;
      const s = 1 - Math.pow(1 - u, 3);
      y = -travelPx + (travelPx + overPx) * s;
      speed = Math.abs((travelPx + overPx) * ((3 * Math.pow(1 - u, 2)) / main));
    } else {
      const u = (t - landT) / back;
      const s = u * u * (3 - 2 * u);
      y = overPx * (1 - s);
      speed = Math.abs(overPx * (6 * u * (1 - u)) / back);
    }
    let tilt = rest;
    if (t <= landT) {
      const e = Math.sin((Math.PI * t) / (2 * landT));
      tilt = rest + sign * tiltOver * e;
    } else {
      const u = (t - landT) / back;
      const e = u * u * (3 - 2 * u);
      tilt = rest + sign * tiltOver * (1 - e);
    }
    const h = clamp(-y / travelPx, 0, 1);
    return {x: 0, y, tilt, rotX, rotY, h, speed};
  };
  return {duration: T, up, down, travel, tiltOver, posOver, restTilt: rest, rotX: rotXAmp, rotY: rotYAmp, at};
};

export type EntranceOpts = {
  dur?: number;
  from?: 'below' | 'side';
  /** 带符号的起始角。绝对值会被夹进 25–40 */
  startTilt?: number;
  tiltOver?: number;
  posOver?: number;
  restTilt?: number;
  sideSign?: number;
};

export type Entrance = {
  duration: number;
  from: 'below' | 'side';
  startTilt: number;
  tiltOver: number;
  posOver: number;
  restTilt: number;
  at: (t: number) => AirSample;
};

/** 从面板下方或侧面飞到静止位。末段 12% 已经停在静止角上，方便接浮动。 */
export const entrance = (height: number, width: number, opts: EntranceOpts = {}): Entrance => {
  const dur = clamp(opts.dur ?? 0.52, ENTRANCE_RANGE.dur[0], ENTRANCE_RANGE.dur[1]);
  const mag = clamp(Math.abs(opts.startTilt ?? 34), ENTRANCE_RANGE.startTilt[0], ENTRANCE_RANGE.startTilt[1]);
  const startSign = (opts.startTilt ?? 34) < 0 ? -1 : 1;
  const startTilt = startSign * mag;
  const tiltOver = clamp(opts.tiltOver ?? 14, ENTRANCE_RANGE.tiltOver[0], ENTRANCE_RANGE.tiltOver[1]);
  const posOver = clamp(opts.posOver ?? 0.006, 0, ENTRANCE_RANGE.posOver);
  const rest = opts.restTilt ?? 0;
  const from = opts.from === 'side' ? 'side' : 'below';
  const side = (opts.sideSign ?? startSign) < 0 ? -1 : 1;
  const H = Math.max(1, height);
  const W = Math.max(1, width);
  const overPx = posOver * H;
  const startY = from === 'below' ? H * 0.3 : H * 0.08;
  const startX = from === 'side' ? side * W * 0.38 : side * W * 0.04;
  const overTilt = rest + (startTilt >= rest ? -tiltOver : tiltOver);
  const at = (t: number): AirSample => {
    if (t <= 0) {
      return {x: startX, y: startY, tilt: startTilt, rotX: 0, rotY: 0, h: 1, speed: 0};
    }
    if (t >= dur) return {x: 0, y: 0, tilt: rest, rotX: 0, rotY: 0, h: 0, speed: 0};
    const u = t / dur;
    const settleU = 0.88;
    let x = 0;
    let y = 0;
    let speed = 0;
    if (u <= 0.7) {
      const e = 1 - Math.pow(1 - u / 0.7, 3);
      x = startX * (1 - e);
      y = startY + (-overPx - startY) * e;
      speed = Math.hypot(startX, startY + overPx) * ((3 * Math.pow(1 - u / 0.7, 2)) / (0.7 * dur));
    } else if (u <= settleU) {
      const e = (u - 0.7) / (settleU - 0.7);
      const s = e * e * (3 - 2 * e);
      x = 0;
      y = -overPx * (1 - s);
      speed = Math.abs(overPx * (6 * e * (1 - e)) / ((settleU - 0.7) * dur));
    }
    let tilt = rest;
    if (u <= 0.62) {
      const e = Math.sin((Math.PI * u) / (2 * 0.62));
      tilt = startTilt + (overTilt - startTilt) * e;
    } else if (u <= settleU) {
      const e = (u - 0.62) / (settleU - 0.62);
      const s = e * e * (3 - 2 * e);
      tilt = overTilt + (rest - overTilt) * s;
    }
    const air = Math.sin(Math.PI * Math.min(1, u / settleU));
    const h = clamp(Math.hypot(x, y) / Math.max(1, Math.hypot(startX, startY)), 0, 1);
    return {x, y, tilt, rotX: 16 * air, rotY: side * 12 * air, h, speed};
  };
  return {duration: dur, from, startTilt, tiltOver, posOver, restTilt: rest, at};
};

export type ExitMotion = {
  duration: number;
  rotX: number;
  /** 相对退场起点的混合。u=0 还在起点，u=1 已经翻出。 */
  at: (u: number) => {y: number; rotX: number; h: number; tiltAdd: number};
};

/** 不再淡出：往上翻出画面。u 是 0–1。 */
export const leave = (height: number, opts: {dur?: number; rotX?: number} = {}): ExitMotion => {
  const duration = clamp(opts.dur ?? 0.42, EXIT_RANGE.dur[0], EXIT_RANGE.dur[1]);
  const rotX = clamp(opts.rotX ?? 82, EXIT_RANGE.rotX[0], EXIT_RANGE.rotX[1]);
  const H = Math.max(1, height);
  return {
    duration,
    rotX,
    at: (u: number) => {
      const e = clamp(u, 0, 1);
      const k = e * e;
      return {y: -0.68 * H * k, rotX: rotX * k, h: e, tiltAdd: 18 * k};
    },
  };
};
