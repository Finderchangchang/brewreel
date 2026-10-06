// 剪纸锚点卡的排字。keyword / checklist / steps / counter / compare 都走这一个函数。
// 中文按 Intl.Segmenter('zh', {granularity:'word'}) 分词，只在词与词之间断行。
// 两行按字宽尽量一样长；一行不许只剩一个字；放不下就把字号收到下限，也不把词拆开。
import {textEm} from './measure.ts';

export type AnchorLines = {font: number; lines: string[]};

const GLUE_RE = /[\s，、；：。！？,;:.!?…·]/;

type SegmenterLike = {segment(input: string): Iterable<{segment: string}>};
type IntlWithSegmenter = {Segmenter?: new (locale: string, opts: {granularity: 'word'}) => SegmenterLike};

let zhWordSegmenter: SegmenterLike | undefined;
const getZhWordSegmenter = (): SegmenterLike | undefined => {
  try {
    const Ctor = (Intl as unknown as IntlWithSegmenter).Segmenter;
    if (typeof Ctor !== 'function') return undefined;
    return (zhWordSegmenter ??= new Ctor('zh', {granularity: 'word'}));
  } catch {
    return undefined;
  }
};

const isGlue = (ch: string) => GLUE_RE.test(ch);
const visibleCount = (s: string) => Array.from(s).filter((ch) => !isGlue(ch)).length;

/** 词。标点和空白粘在前一个词上，避免标点落到下一行行首。没有分词器时，拉丁单词仍整段保留，汉字按字。 */
const wordTokens = (text: string): string[] => {
  const raw: string[] = [];
  const seg = getZhWordSegmenter();
  if (!seg) {
    let buf = '';
    const flush = () => {
      if (buf) {
        raw.push(buf);
        buf = '';
      }
    };
    for (const ch of Array.from(text)) {
      if (/[A-Za-z0-9]/.test(ch)) buf += ch;
      else {
        flush();
        raw.push(ch);
      }
    }
    flush();
  } else {
    for (const {segment} of seg.segment(text)) if (segment) raw.push(segment);
  }
  const out: string[] = [];
  for (const part of raw) {
    if (out.length && Array.from(part).every(isGlue)) out[out.length - 1] += part;
    else out.push(part);
  }
  return out;
};

/** 可以断行的字符下标（断在这个下标前面）。两边都至少两个字，并且落在词界上。 */
const wordCuts = (text: string): number[] => {
  const tokens = wordTokens(text);
  if (tokens.join('') !== text) return [];
  const cuts: number[] = [];
  let acc = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    acc += tokens[i].length;
    if (visibleCount(text.slice(0, acc)) >= 2 && visibleCount(text.slice(acc)) >= 2) cuts.push(acc);
  }
  return cuts;
};

const fitted = (em: number, maxW: number, maxPx: number) => Math.min(maxPx, Math.floor(maxW / Math.max(0.5, em)));

/**
 * 一行放得下（字号不低于 minPx）就一行。
 * 否则拆成两行：词内不断、不单字成行、两行字宽尽量一样；一样长时上一行多收一个词。
 * 这一拆放不进 maxW，字号收到 minPx，仍然不拆词。
 */
export const anchorLines = (text: string, maxW: number, maxPx: number, minPx: number): AnchorLines => {
  const raw = text ?? '';
  if (!raw) return {font: minPx, lines: []};
  const one = fitted(textEm(raw), maxW, maxPx);
  if (one >= minPx) return {font: one, lines: [raw]};
  const cuts = wordCuts(raw);
  if (!cuts.length) return {font: minPx, lines: [raw]};
  let best = cuts[0];
  let bestBal = Infinity;
  for (const cut of cuts) {
    const bal = Math.abs(textEm(raw.slice(0, cut)) - textEm(raw.slice(cut)));
    if (bal < bestBal - 1e-6 || (Math.abs(bal - bestBal) <= 1e-6 && cut > best)) {
      bestBal = bal;
      best = cut;
    }
  }
  const a = raw.slice(0, best);
  const b = raw.slice(best);
  const font = Math.max(minPx, Math.min(fitted(textEm(a), maxW, maxPx), fitted(textEm(b), maxW, maxPx)));
  return {font, lines: [a, b]};
};
