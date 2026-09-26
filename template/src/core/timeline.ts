// ============================================================
// 排程器：分镜 → 每镜的开始/时长（秒）。validate.mjs 里有同一算法的 JS 版，改这里要同步改那边。
//   1. 时长 = beats × 一拍，或 dur，或 spec 默认时长
//   2. 吸附到整拍（最少 1 拍）
//   3. 首尾相接；每镜结束后有 EXIT 秒退场尾巴与下一镜重叠
// ============================================================
import type {Shot, Storyboard} from '../schema';
import type {ShotSpec} from './types';

export const EXIT = 0.35;
export const DEFAULT_BPM = 120;

export type Slot = {i: number; shot: Shot; start: number; dur: number; end: number; mood: number};

export const beatOf = (sb: Storyboard) => 60 / (sb.meta?.bpm || DEFAULT_BPM);

export const schedule = (sb: Storyboard, specOf: (type: string) => ShotSpec | undefined): Slot[] => {
  const beat = beatOf(sb);
  let t = 0;
  return (sb.shots || []).map((shot, i) => {
    const spec = specOf(shot.type);
    const raw = typeof shot.beats === 'number' ? shot.beats * beat : typeof shot.dur === 'number' ? shot.dur : spec?.dur.default ?? 3;
    const dur = Math.max(1, Math.round(raw / beat)) * beat;
    const slot = {i, shot, start: t, dur, end: t + dur, mood: typeof shot.mood === 'number' ? shot.mood : spec?.mood ?? 0.5};
    t += dur;
    return slot;
  });
};

export const totalDur = (slots: Slot[]) => (slots.length ? slots[slots.length - 1].end : 1);
