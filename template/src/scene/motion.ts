// 动效性格。弹簧只调 remotion 的 spring，参数和 core/anim.ts 的 pop 相同。
// anim.ts 写的是 import './safe'（无后缀），Node 加载不了，所以这里不经那文件，避免另写一条弹簧。
// paper 的入场调用 talk/motion/kit/settle.ts，退场调用 toss.ts 的 leave。
import {spring} from 'remotion';
import {leave, toss} from '../talk/motion/kit/toss.ts';
import {settle} from '../talk/motion/kit/settle.ts';
import type {ActionName, MotionName} from './types.ts';

const FPS = 30;

/** 与 anim.ts pop 同一调用。steps 常用 (16, 170)，落在文档的 damping 13–16、stiffness 170–210。 */
export const BOUNCE_SPRING = {damping: 16, stiffness: 170};

/** 重点字的手感。crisp / push 下划线，bounce 色块，soft / paper 马克笔。 */
export function emphasisLook(motion: MotionName): 'line' | 'block' | 'marker' {
  if (motion === 'bounce') return 'block';
  if (motion === 'soft' || motion === 'paper') return 'marker';
  return 'line';
}

export function popAt(t: number, t0 = 0, damping = BOUNCE_SPRING.damping, stiffness = BOUNCE_SPRING.stiffness): number {
  if (t < t0) return 0;
  return spring({frame: Math.round((t - t0) * FPS), fps: FPS, config: {damping, stiffness}});
}

const easeOut = (u: number) => {
  const t = Math.min(1, Math.max(0, u));
  return 1 - (1 - t) ** 3;
};

export type CurveSample = {p: number; y: number; tilt: number; scale: number};

export type MotionCurve = {
  action: ActionName;
  motion: MotionName;
  /** 秒。bounce 取第一次过冲折返；paper 入场取 settle 的总时长。 */
  duration: number;
  durationRange: readonly [number, number];
  /** 位移过冲像素。没有过冲是 0。 */
  overshootPx: number;
  overshootDeg: number;
  /** paper 入场才有。上抛、下落分开，不和总时长混成一个数。 */
  up?: number;
  down?: number;
  sample: (t: number) => CurveSample;
};

const CRISP_DUR: Record<ActionName, number> = {enter: 0.22, emphasize: 0.2, count: 0.24, reveal: 0.22, exit: 0.2};
const SOFT_DUR: Record<ActionName, number> = {enter: 0.35, emphasize: 0.4, count: 0.4, reveal: 0.35, exit: 0.36};

const crispCurve = (action: ActionName): MotionCurve => {
  const duration = CRISP_DUR[action];
  return {
    action,
    motion: 'crisp',
    duration,
    durationRange: [0.16, 0.28],
    overshootPx: 0,
    overshootDeg: 0,
    sample: (t) => ({p: easeOut(t / duration), y: 0, tilt: 0, scale: easeOut(t / duration)}),
  };
};

/** 和讲课 enter() 一致：三次缓出，16 像素上浮，350 毫秒。不越过静止位。 */
const softCurve = (action: ActionName): MotionCurve => {
  const duration = SOFT_DUR[action];
  const travel = 16;
  return {
    action,
    motion: 'soft',
    duration,
    durationRange: [0.3, 0.45],
    overshootPx: 0,
    overshootDeg: 0,
    sample: (t) => {
      const p = easeOut(t / duration);
      return {p, y: (1 - p) * travel, tilt: 0, scale: 1};
    },
  };
};

function bounceTurnAt(): {at: number; peak: number} {
  let peak = 0;
  let at = 0;
  let prev = 0;
  for (let frame = 0; frame <= 45; frame++) {
    const value = popAt(frame / FPS);
    if (frame > 0 && value < prev && prev > peak) {
      peak = prev;
      at = (frame - 1) / FPS;
      break;
    }
    prev = value;
  }
  return {at, peak};
}

const bounceCurve = (action: ActionName): MotionCurve => {
  const turn = bounceTurnAt();
  const travel = 24;
  return {
    action,
    motion: 'bounce',
    duration: turn.at,
    durationRange: [0.25, 0.45],
    overshootPx: Math.max(0, (turn.peak - 1) * travel),
    overshootDeg: 0,
    sample: (t) => {
      const scale = popAt(t);
      return {p: Math.min(1, Math.max(0, scale)), y: (1 - scale) * travel, tilt: 0, scale};
    },
  };
};

/** 向上推入。无回弹、无倾斜。0.30 秒走完 64 像素，200 毫秒时仍在向上。 */
const PUSH_DUR: Record<ActionName, number> = {enter: 0.3, emphasize: 0.26, count: 0.3, reveal: 0.28, exit: 0.26};
const PUSH_TRAVEL: Record<ActionName, number> = {enter: 64, emphasize: 28, count: 48, reveal: 40, exit: 48};

const pushCurve = (action: ActionName): MotionCurve => {
  const duration = PUSH_DUR[action];
  const travel = PUSH_TRAVEL[action];
  const upward = action !== 'exit';
  return {
    action,
    motion: 'push',
    duration,
    durationRange: [0.24, 0.4],
    overshootPx: 0,
    overshootDeg: 0,
    sample: (t) => {
      const p = easeOut(t / duration);
      const y = upward ? (1 - p) * travel : -p * travel;
      return {p, y, tilt: 0, scale: 1};
    },
  };
};

const paperCurve = (action: ActionName, height = 1000): MotionCurve => {
  if (action === 'exit') {
    const gone = leave(height);
    return {
      action,
      motion: 'paper',
      duration: gone.duration,
      durationRange: [0.35, 0.5],
      overshootPx: 0,
      overshootDeg: 0,
      sample: (t) => {
        const pose = gone.at(t / gone.duration);
        return {p: Math.min(1, Math.max(0, t / gone.duration)), y: pose.y, tilt: pose.rotX, scale: 1};
      },
    };
  }
  const posed = action === 'emphasize' ? toss(height) : settle(height);
  return {
    action,
    motion: 'paper',
    duration: posed.duration,
    durationRange: [1.2, 1.8],
    overshootPx: posed.posOver * height,
    overshootDeg: posed.tiltOver,
    up: posed.up,
    down: posed.down,
    sample: (t) => {
      const pose = posed.at(t);
      return {p: Math.min(1, Math.max(0, t / posed.duration)), y: pose.y, tilt: pose.tilt, scale: 1};
    },
  };
};

/** 金额翻牌。时长固定 0.16 秒，不走性格区间，也不滚动出中间价。 */
export function moneyFlip(): MotionCurve {
  const duration = 0.16;
  return {
    action: 'count',
    motion: 'crisp',
    duration,
    durationRange: [0.16, 0.16],
    overshootPx: 0,
    overshootDeg: 0,
    sample: (t) => {
      const p = t >= duration ? 1 : 0;
      return {p, y: 0, tilt: 0, scale: 1};
    },
  };
}

export function curveOf(action: ActionName, motion: MotionName, height = 1000): MotionCurve {
  if (motion === 'crisp') return crispCurve(action);
  if (motion === 'soft') return softCurve(action);
  if (motion === 'bounce') return bounceCurve(action);
  if (motion === 'push') return pushCurve(action);
  return paperCurve(action, height);
}

/** 提前量（秒）。口播 LEAD 0.12 落在 soft / bounce。paper 上抛更长。 */
export const LEAD_SEC: Record<MotionName, number> = {crisp: 0.08, soft: 0.12, bounce: 0.12, paper: 0.2, push: 0.1};

export type MotionDefaults = Record<string, MotionName>;

/** 用户没写性格时用。讲课 paper / lecture 保持 soft，不改现有课程手感。 */
export function defaultMotion(product: 'promo' | 'lesson' | 'talk', style: string, dark = false): MotionName {
  if (style === 'techbrief') return 'push';
  if (style === 'cutpaper-collage') return 'crisp';
  if (style === 'impressionist' || style === 'mural') return 'soft';
  if (product === 'lesson') {
    if (style === 'paper' || style === 'lecture') return 'soft';
    return 'crisp';
  }
  if (product === 'talk') {
    if (style === 'paper' || style === 'cutpaper-meadow' || style === 'cutpaper-dusk') return 'paper';
    if (style === 'ink') return 'crisp';
    return 'bounce';
  }
  if (dark) return 'crisp';
  return 'bounce';
}
