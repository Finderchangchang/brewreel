// keyword 的版面（几行、每行字号、字块大小）和断行。纯函数，节点测试直接引用；画法见 Keyword.tsx。
import {glueBreaks, WORD_JOINER} from '../../core/fit.ts';
import {isTall, textEm} from './measure.ts';
import type {KeywordData} from './types';

export const LINE_H = 1.14;
/** 字号上限（参考像素；720 宽时约 213 像素） */
const MAX_SIZE = 320;
const PUNCT_RE = /[，、；：。！？,;:.!?]/;
const TAIL_PUNCT_RE = /[，、；：。,;:.]+$/;
const LEAD_PUNCT_RE = /^[\s，、；：。,;:.]+/;

/** 在哪个字后面断行：两行尽量等宽；不拆词（glueBreaks 认的中文词、英文单词）、尽量不拆 hot（hot 占一半以上时可以拆）；标点后面优先。
 * preferLate：一样好时取靠后的（奇数个字时上一行多一个字：「先给你 / 报价」） */
export const breakAt = (text: string, hot?: string, preferLate = false): number => {
  const chars = Array.from(text);
  if (chars.length < 2) return chars.length;
  const glued = new Set<number>(); // 第 i 个字和第 i+1 个字之间不许断
  {
    const g = Array.from(glueBreaks(text));
    let oi = -1;
    for (const ch of g) {
      if (ch === WORD_JOINER) glued.add(oi);
      else oi++;
    }
  }
  const hk = hot ? text.indexOf(hot) : -1;
  const hotFrom = hk >= 0 ? Array.from(text.slice(0, hk)).length : -1;
  const hotTo = hk >= 0 ? hotFrom + Array.from(hot as string).length : -1;
  const hotPenalty = hk >= 0 && (hotTo - hotFrom) * 2 >= chars.length ? 1 : 5;
  const total = textEm(text);
  let best = Math.ceil(chars.length / 2);
  let bestScore = Infinity;
  for (let p = 1; p < chars.length; p++) {
    const inWord = /[a-z0-9]/i.test(chars[p - 1]) && /[a-z0-9]/i.test(chars[p]);
    if (inWord) continue; // 英文单词、数字中间
    if (PUNCT_RE.test(chars[p])) continue; // 标点不落行首
    const left = textEm(chars.slice(0, p).join(''));
    let score = Math.abs(total - 2 * left);
    if (glued.has(p - 1)) score += 3;
    if (hotFrom >= 0 && p > hotFrom && p < hotTo) score += hotPenalty;
    if (PUNCT_RE.test(chars[p - 1])) score -= 2.5; // 逗号后面断最自然（「花钱之前，| 它先报价」好过「花钱之前，它 | 先报价」）
    if (score < bestScore - 1e-9 || (preferLate && score <= bestScore + 1e-9)) {
      bestScore = score;
      best = p;
    }
  }
  return best;
};

export type KwLine = {text: string; from: number; size: number};
export type KeywordLayout = {lines: KwLine[]; size: number; blockW: number; blockH: number; stacked: boolean; gaps: number[]};

/** 第 a 到 b 个字（按码点）这一截：去掉行首空格和标点（from 跟着挪）、行尾标点 */
const segOf = (chars: string[], a: number, b: number): {text: string; from: number} => {
  const raw = chars.slice(a, b).join('');
  const lead = raw.match(LEAD_PUNCT_RE)?.[0] ?? '';
  return {text: raw.slice(lead.length).trimEnd().replace(TAIL_PUNCT_RE, ''), from: a + Array.from(lead).length};
};
const meaningful = (s: string) => Array.from(s).filter((ch) => !PUNCT_RE.test(ch) && !/\s/.test(ch)).length;

/** 版面：几行、每行字号、字块大小。W×H 是取景框（参考像素） */
export const keywordLayout = (data: KeywordData, W: number, H: number): KeywordLayout => {
  const text = data.text ?? '';
  const chars = Array.from(text);
  const hk = data.hot ? text.indexOf(data.hot) : -1;
  const h0 = hk >= 0 ? Array.from(text.slice(0, hk)).length : -1;
  const h1 = hk >= 0 ? h0 + Array.from(data.hot as string).length : -1;
  const finish = (lines: KwLine[], stacked: boolean, gaps: number[]): KeywordLayout => {
    let blockH = lines.reduce((a, l) => a + l.size * LINE_H, 0) + gaps.reduce((a, g) => a + g, 0);
    const cap = H * 0.86;
    if (blockH > cap) {
      const k = cap / blockH;
      lines = lines.map((l) => ({...l, size: Math.floor(l.size * k)}));
      gaps = gaps.map((g) => g * k);
      blockH = cap;
    }
    const blockW = Math.max(...lines.map((l) => textEm(l.text) * l.size));
    return {lines, size: Math.max(...lines.map((l) => l.size)), blockW, blockH, stacked, gaps};
  };

  // ① hot 单独一行撑满宽度，前后的字缩小。竖长的框里一行 hot 只占不到一半高时，hot 拆成两行再放大（「先给你 / 报价」）
  if (hk >= 0 && h1 - h0 < chars.length) {
    const before = segOf(chars, 0, h0);
    const hot = segOf(chars, h0, h1);
    const after = segOf(chars, h1, chars.length);
    const ctx = meaningful(before.text) + meaningful(after.text);
    // 前后单独成行的那一截至少两个字（「它 / 不会乱编 / 数字」不如「它不会 / 乱编数字」）
    const partsOk = [before.text, after.text].every((p) => !p || meaningful(p) >= 2);
    if (ctx >= 3 && partsOk && textEm(hot.text) / textEm(text) <= 0.7 && hot.text) {
      const smallOf = (part: {text: string; from: number}, big: number): KwLine[] => {
        if (!part.text) return [];
        const one = Math.min(big * 0.6, (W * 0.9) / textEm(part.text));
        if (one >= big * 0.42 || Array.from(part.text).length < 4) return [{...part, size: Math.floor(one)}];
        const cut = breakAt(part.text);
        const pc = Array.from(part.text);
        const a = segOf(pc, 0, cut);
        const b = segOf(pc, cut, pc.length);
        const size = Math.floor(Math.min(big * 0.6, (W * 0.9) / Math.max(textEm(a.text), textEm(b.text))));
        return [
          {text: a.text, from: part.from + a.from, size},
          {text: b.text, from: part.from + b.from, size},
        ];
      };
      const build = (hotLines: KwLine[], big: number) => {
        const pre = smallOf(before, big);
        const post = smallOf(after, big);
        const lines = [...pre, ...hotLines, ...post];
        const gaps = lines.slice(1).map((_, i) => (i === pre.length - 1 || i === pre.length + hotLines.length - 1 ? big * 0.1 : 0));
        return finish(lines, true, gaps);
      };
      const big = Math.max(56, Math.min(MAX_SIZE, Math.floor((W * 0.9) / textEm(hot.text))));
      const one = build([{...hot, size: big}], big);
      const hc = Array.from(hot.text);
      if (isTall(W, H) && hc.length >= 4 && one.blockH < H * 0.5) {
        const cut = breakAt(hot.text, undefined, true);
        const a = segOf(hc, 0, cut);
        const b = segOf(hc, cut, hc.length);
        const big2 = Math.max(56, Math.min(MAX_SIZE, Math.floor((W * 0.9) / Math.max(textEm(a.text), textEm(b.text)))));
        if (a.text && b.text && big2 >= big * 1.3) {
          const two = build(
            [
              {text: a.text, from: hot.from + a.from, size: big2},
              {text: b.text, from: hot.from + b.from, size: big2},
            ],
            big2,
          );
          if (two.size >= one.size * 1.2) return two;
        }
      }
      return one;
    }
  }

  // ② 一行或两行同样大
  const sizeFor = (ls: string[]) => Math.max(56, Math.min(MAX_SIZE, Math.floor((W * 0.84) / Math.max(...ls.map(textEm))), Math.floor((H * 0.7) / (ls.length * LINE_H))));
  const one = segOf(chars, 0, chars.length);
  const s1 = sizeFor([one.text]);
  if (chars.length >= 4) {
    const cut = breakAt(text, data.hot);
    const a = segOf(chars, 0, cut);
    const b = segOf(chars, cut, chars.length);
    const s2 = sizeFor([a.text, b.text]);
    if (a.text && b.text && (meaningful(text) >= 7 || s2 > s1 * 1.15)) {
      return finish(
        [
          {...a, size: s2},
          {...b, size: s2},
        ],
        false,
        [0],
      );
    }
  }
  return finish([{...one, size: s1}], false, []);
};
