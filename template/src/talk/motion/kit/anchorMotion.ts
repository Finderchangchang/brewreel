// 把飞入、上抛、浮动、翻面、翻出合成一条锚点姿态。外观只填时刻和高度。
// 接力（relay）不做飞入。下一段会接上（hold）就不翻出。同一段里两次上抛至少隔 1.2 秒。
// 翻面绕 Y 轴走 180°。正面 / 背面各放一条内容，转到侧面时字在棱上，不穿帮。

import {floatMotion, type FloatSample} from './float.ts';
import {mulberry32, seedOf} from './rng.ts';
import {PERSPECTIVE, entrance, leave, toss, type AirSample} from './toss.ts';

export {PERSPECTIVE} from './toss.ts';

/** 两次上抛的最小间隔（秒）。 */
export const TOSS_GAP = 1.2;
/** 翻面时长。参考翻滚同一姿态大约 1.22 秒重复一次，半圈用 0.62 秒。 */
export const FLIP_DUR = 0.62;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type AnchorInput = {
  t: number;
  dur: number;
  /** split 用面板高，pip / full 用取景框高。浮动、飞入、翻出用这个 */
  height: number;
  /** 上抛行程参照。不传跟 height 一样。取景框比画面框矮、按 height 抛不满画面高 18% 时另给 */
  travelHeight?: number;
  width: number;
  restTilt: number;
  /** 这一段接上一段的锚点，不做飞入 */
  relay: boolean;
  /** 下一段会接这张锚点，不做翻出 */
  hold: boolean;
  seed: string;
  /** 说到重点的时刻（窗口内秒）。间隔不够的会被丢掉 */
  tossAt?: number[];
  /** 翻到下一条内容的时刻 */
  flipAt?: number[];
};

export type AnchorSample = {
  x: number;
  y: number;
  /** 绕 Z 的纸面倾角（度），含静止角 */
  tilt: number;
  rotX: number;
  /** 上抛带来的 Y 轴倾角，不含翻面 */
  rotY: number;
  /** 翻面角，加到 rotY 上。0、180、360… */
  flip: number;
  /** 离纸高度 0–1 */
  h: number;
  perspective: number;
  /** 正面内容的序号（偶步） */
  faceA: number;
  /** 背面内容的序号（奇步） */
  faceB: number;
  phase: 'enter' | 'live' | 'toss' | 'exit';
};

export const pickTosses = (times: number[], opts: {dur: number; enterEnd: number; exitStart: number; gap?: number}): number[] => {
  const gap = opts.gap ?? TOSS_GAP;
  const sorted = [...times].filter((t) => Number.isFinite(t) && t >= opts.enterEnd - 1e-3 && t <= opts.exitStart - 0.05).sort((a, b) => a - b);
  const out: number[] = [];
  let last = -1e9;
  for (const t of sorted) {
    if (t - last < gap - 1e-6) continue;
    out.push(t);
    last = t;
  }
  return out;
};

/**
 * 窗口里至少抛起一次。口播时刻能用就用；被飞入或退场裁掉时，放在剩余窗口的 42%（落在 35–50%）。
 */
export const placeTosses = (times: number[], opts: {dur: number; enterEnd: number; exitStart: number; gap?: number}): number[] => {
  const picked = pickTosses(times, opts);
  if (picked.length > 0) return picked;
  const start = Math.max(0, opts.enterEnd);
  const end = Math.min(opts.dur, opts.exitStart);
  const span = end - start;
  if (span < 0.05) return [];
  const at = start + span * 0.42;
  if (at < start - 1e-3 || at > end - 0.02) return [];
  return [at];
};

/** 合成角的余弦为负时，观众看见的是背面。 */
export const facingBack = (angleDeg: number): boolean => Math.cos((angleDeg * Math.PI) / 180) < -1e-6;

/** |cos| < 0.5（约 60°）起藏正面；翻过 120°（cos ≤ -0.5）背面才出现。pitch 同样处理。 */
export const FACE_COS = 0.5;

export const faceVisibility = (angleDeg: number, pitchDeg = 0): 'front' | 'back' | 'edge' => {
  const c = Math.cos((angleDeg * Math.PI) / 180);
  const cp = Math.cos((pitchDeg * Math.PI) / 180);
  if (Math.abs(cp) < FACE_COS - 1e-6) return 'edge';
  if (c <= -FACE_COS + 1e-6) return 'back';
  if (c >= FACE_COS - 1e-6) return 'front';
  return 'edge';
};

const mix = (a: AirSample, f: FloatSample, rest: number, w: number): AirSample => ({
  x: a.x * (1 - w) + f.x * w,
  y: a.y * (1 - w) + f.y * w,
  tilt: a.tilt * (1 - w) + (rest + f.tilt) * w,
  rotX: a.rotX * (1 - w) + f.rotX * w,
  rotY: a.rotY * (1 - w) + f.rotY * w,
  h: a.h * (1 - w) + f.h * w,
  speed: a.speed,
});

type FlipPose = {flip: number; faceA: number; faceB: number};

/** 已完成的半圈数，以及当前这下翻面走到哪。角度连续累加，不在 180° 时跳回 0。 */
export const flipPose = (t: number, flips: number[], dur = FLIP_DUR): FlipPose => {
  let done = 0;
  for (let i = 0; i < flips.length; i++) {
    const start = flips[i];
    const next = flips[i + 1];
    const len = Math.min(dur, next != null ? Math.max(0.4, (next - start) * 0.8) : dur);
    if (t < start) break;
    if (t < start + len) {
      const u = clamp((t - start) / len, 0, 1);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const from = done;
      const target = done + 1;
      return {
        flip: (from + e) * 180,
        faceA: from % 2 === 0 ? from : target,
        faceB: from % 2 === 0 ? target : from,
      };
    }
    done += 1;
  }
  return {flip: done * 180, faceA: done, faceB: done};
};

/**
 * 窗口内 t 秒的锚点姿态。dur 很短时照样飞入，翻出让给飞入。
 */
export const anchorPose = (input: AnchorInput): AnchorSample => {
  const H = Math.max(1, input.height);
  const W = Math.max(1, input.width);
  const dur = Math.max(0.2, input.dur);
  const rest = input.restTilt;
  const rng = mulberry32(seedOf(input.seed) ^ 0xa11ce);
  const from: 'below' | 'side' = rng() < 0.55 ? 'below' : 'side';
  const startSign = rng() < 0.5 ? -1 : 1;
  const tossSign = rng() < 0.5 ? -1 : 1;
  const enter = entrance(H, W, {from, startTilt: startSign * 34, restTilt: rest, sideSign: startSign});
  const lift = toss(Math.max(1, input.travelHeight ?? H), {restTilt: rest, sign: tossSign, rotYSign: -tossSign});
  const out = leave(H);
  const bob = floatMotion(H);
  const enterEnd = input.relay ? 0 : enter.duration;
  const exitStart = input.hold || dur < enterEnd + out.duration + 0.15 ? dur + 1 : dur - out.duration;
  const tossAt = placeTosses(input.tossAt ?? [], {dur, enterEnd, exitStart});
  const rawFlips = [...(input.flipAt ?? [])].filter((t) => Number.isFinite(t) && t >= 0 && t < dur).sort((a, b) => a - b);
  // 抛起和翻面落在同一刻时，翻面改到顶点之后。正面先完整抛起来，字不会在上升途中被压扁。
  const flips = rawFlips.map((ft) => {
    const clash = tossAt.some((s) => Math.abs(s - ft) < 0.25);
    if (!clash) return ft;
    const shifted = ft + lift.up;
    return shifted + FLIP_DUR < dur - 0.05 ? shifted : ft;
  });
  const t = input.t;

  const live = (at: number): {air: AirSample; phase: 'live' | 'toss'} => {
    const f = bob.at(at);
    let hit: number | null = null;
    for (const start of tossAt) {
      if (at >= start && at < start + lift.duration) hit = start;
    }
    if (hit == null) {
      return {air: {x: f.x, y: f.y, tilt: rest + f.tilt, rotX: f.rotX, rotY: f.rotY, h: f.h, speed: 0}, phase: 'live'};
    }
    const s = lift.at(at - hit);
    const airAmp = Math.sin((Math.PI * clamp(at - hit, 0, lift.duration)) / lift.duration);
    return {
      phase: 'toss',
      air: {
        x: f.x * (1 - airAmp),
        y: s.y + f.y * (1 - airAmp),
        tilt: s.tilt + f.tilt * (1 - airAmp),
        rotX: s.rotX + f.rotX * (1 - airAmp),
        rotY: s.rotY + f.rotY * (1 - airAmp),
        h: Math.max(s.h, f.h * (1 - airAmp)),
        speed: s.speed,
      },
    };
  };

  const faces = flipPose(t, flips);
  const base = (air: AirSample, phase: AnchorSample['phase']): AnchorSample => ({
    x: air.x,
    y: air.y,
    tilt: air.tilt,
    rotX: air.rotX,
    rotY: air.rotY,
    flip: faces.flip,
    h: air.h,
    perspective: PERSPECTIVE,
    faceA: faces.faceA,
    faceB: faces.faceB,
    phase,
  });

  if (!input.relay && t < enter.duration) {
    const e = enter.at(t);
    const f = bob.at(t);
    const w = t >= enter.duration - 0.08 ? clamp((t - (enter.duration - 0.08)) / 0.08, 0, 1) : 0;
    return base(mix(e, f, rest, w), 'enter');
  }

  if (!input.hold && t >= exitStart && exitStart < dur) {
    const fromPose = live(exitStart).air;
    const u = clamp((t - exitStart) / out.duration, 0, 1);
    const step = out.at(u);
    const e = u * u;
    return base(
      {
        x: fromPose.x * (1 - e),
        y: fromPose.y * (1 - e) + step.y,
        tilt: fromPose.tilt + tossSign * step.tiltAdd,
        rotX: fromPose.rotX * (1 - e) + step.rotX,
        rotY: fromPose.rotY * (1 - e * 0.35),
        h: Math.min(1, fromPose.h * (1 - e) + step.h),
        speed: 0,
      },
      'exit',
    );
  }

  const now = live(t);
  return base(now.air, now.phase);
};
