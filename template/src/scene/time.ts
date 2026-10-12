// 三种时间来源分开返回。不要合成一个函数再丢掉来源标记。
// word：口播转写 / 配音接口的逐字时间。
// sentence：两种，kind 分开。
//   lesson-human：讲课真人。只有句首，句内不插值。
//   tts-sentence：配音接口不是逐字。字级时间由 timing.mjs 在句内按字数和标点分好，字幕按这个点亮。
// beat：宣传片还没有配音。只按拍，不假装对齐到字。
import type {MotionName} from './types.ts';
import {LEAD_SEC} from './motion.ts';

export const FIRST_BY = 0.35;
export const LAST_BEFORE_END = 0.6;
export const DEFAULT_BPM = 120;

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

export type WordReveal = {
  source: 'word';
  kind: 'tts-words' | 'talk-marks';
  lead: number;
  at: number[];
};

export type SentenceReveal = {
  source: 'sentence';
  kind: 'lesson-human' | 'tts-sentence';
  /** sentence-start 只对齐句首。sentence-interp 的 at 是句内估算，不是接口给的逐字。 */
  resolution: 'sentence-start' | 'sentence-interp';
  lead: number;
  at: number[];
};

export type BeatReveal = {
  source: 'beat';
  kind: 'promo-no-audio';
  bpm: number;
  beat: number;
  duration: number;
  addedBeats: number;
  /** 估算用的每秒汉字数。配音回来之前是 4，不是逐字结果。 */
  charsPerSec: 4;
  at: number[];
};

export type RevealPlan = WordReveal | SentenceReveal | BeatReveal;

function place(marks: readonly number[], lead: number, duration: number): number[] {
  const cap = Math.max(0, duration - LAST_BEFORE_END);
  const out: number[] = [];
  for (let i = 0; i < marks.length; i++) {
    let at = marks[i] - lead;
    if (i === 0) at = Math.min(at, FIRST_BY);
    at = clamp(at, 0, cap);
    if (i > 0) at = Math.max(at, out[i - 1]);
    out.push(at);
  }
  return out;
}

/** 出场 = 对应字的开始时间 − 性格提前量。单调，夹在 [0, 时长 − 0.6]。第一条不晚于 0.35。 */
export function revealFromWords(wordStarts: readonly number[], motion: MotionName, duration: number, kind: WordReveal['kind'] = 'tts-words'): WordReveal {
  const lead = LEAD_SEC[motion];
  return {source: 'word', kind, lead, at: place(wordStarts, lead, duration)};
}

/** 第 i 条对齐到第 i 句的句首，减去提前量。不在句内插值。 */
export function revealFromSentences(sentenceStarts: readonly number[], motion: MotionName, duration: number): SentenceReveal {
  const lead = LEAD_SEC[motion];
  return {
    source: 'sentence',
    kind: 'lesson-human',
    resolution: 'sentence-start',
    lead,
    at: place(sentenceStarts, lead, duration),
  };
}

/**
 * 配音只有句级或词级，没有逐字。marks 已经是 timing.mjs 在句内分好的时刻。
 * 来源标 sentence，不标 word。
 */
export function revealFromSentenceInterp(marks: readonly number[], motion: MotionName, duration: number): SentenceReveal {
  const lead = LEAD_SEC[motion];
  return {
    source: 'sentence',
    kind: 'tts-sentence',
    resolution: 'sentence-interp',
    lead,
    at: place(marks, lead, duration),
  };
}

/**
 * 还没有配音。镜长 = 汉字数 / 4，再吸到整拍，最少 1 拍。
 * 条目均匀放在 0.35 秒到结束前 0.6 秒之间。窗口不够就加拍。
 */
export function revealFromBeats(input: {hanzi: number; count: number; motion: MotionName; bpm?: number}): BeatReveal {
  const bpm = clamp(input.bpm ?? DEFAULT_BPM, 90, 150);
  const beat = 60 / bpm;
  const raw = Math.max(0, input.hanzi) / 4;
  let duration = Math.max(1, Math.round(raw / beat)) * beat;
  let addedBeats = 0;
  const count = Math.max(1, Math.round(input.count) || 1);
  while (duration - LAST_BEFORE_END < FIRST_BY && addedBeats < 8) {
    duration += beat;
    addedBeats += 1;
  }
  const start = Math.min(FIRST_BY, Math.max(0, duration - LAST_BEFORE_END));
  const end = Math.max(start, duration - LAST_BEFORE_END);
  const at = count === 1 ? [start] : Array.from({length: count}, (_, i) => start + ((end - start) * i) / (count - 1));
  return {source: 'beat', kind: 'promo-no-audio', bpm, beat, duration, addedBeats, charsPerSec: 4, at};
}
