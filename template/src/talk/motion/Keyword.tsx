// keyword：关键词大字（口播专用，新写）。皮肤借 quiz 的「批改纸」：纸卡 + 逐字点亮 + 杏黄马克笔。
// 说到哪个字亮到哪个字（每个字的时刻由脚本按字幕算好，marks.chars），hot 在说完那一刻扫一道马克笔。字全部出自原句。
// 画在 1080×1920 的镜头坐标里（主体区中心），由 MotionLayer 的舞台缩放进 B-roll 框。
import React from 'react';
import {glueBreaks, WORD_JOINER} from '../../core/fit';
import {FONT} from '../../core/font';
import {MAIN} from '../../core/safe';
import {Lit, displayEm, fitDisplay, popScale, unitsOf, usePal} from '../../styles/quiz/parts/kit';
import type {VBox} from './stage';
import type {KeywordData, KeywordMarks} from './types';

const PAD_X = 60;
const PAD_Y = 70;
const LINE_H = 1.22;
const SHADOW = 14;
const CY = (MAIN.y0 + MAIN.y1) / 2;
/** 一行最多放多少「字宽」才不换行（12 字的 keyword 拆成两行，每行 ≤ 6–7 字） */
const ONE_LINE_EM = 7.2;

const PUNCT_RE = /[，、；：。！？,;:.!?]/;

/** 在哪个字后面断行：两行尽量等宽；不拆词（glueBreaks 认的中文词、英文单词）、不拆 hot；标点后面优先 */
export const breakAt = (text: string, hot?: string): number => {
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
  const total = displayEm(text);
  let best = Math.ceil(chars.length / 2);
  let bestScore = Infinity;
  for (let p = 1; p < chars.length; p++) {
    const inWord = /[a-z0-9]/i.test(chars[p - 1]) && /[a-z0-9]/i.test(chars[p]);
    if (inWord) continue; // 英文单词、数字中间
    if (PUNCT_RE.test(chars[p])) continue; // 标点不落行首
    const left = displayEm(chars.slice(0, p).join(''));
    let score = Math.abs(total - 2 * left);
    if (glued.has(p - 1)) score += 3;
    if (hotFrom >= 0 && p > hotFrom && p < hotTo) score += 5;
    if (PUNCT_RE.test(chars[p - 1])) score -= 0.8;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
};

export type KeywordGeom = {lines: {text: string; from: number}[]; size: number; cardH: number; cardY: number; content: VBox};

/** 版面：几行、字号、卡片高度、给舞台的取景框（镜头坐标） */
export const keywordGeom = (data: KeywordData): KeywordGeom => {
  const text = data.text ?? '';
  const chars = Array.from(text);
  const two = displayEm(text) > ONE_LINE_EM && chars.length >= 4;
  const cut = two ? breakAt(text, data.hot) : chars.length;
  const lines = [{text: chars.slice(0, cut).join('').trimEnd(), from: 0}];
  if (two) {
    const rest = chars.slice(cut).join('');
    const lead = rest.length - rest.trimStart().length;
    lines.push({text: rest.trimStart(), from: cut + lead});
  }
  const innerW = (MAIN.w - 2 * PAD_X) * 0.94; // 留 6% 给马克笔两头和字形误差，保证不意外折行
  const size = Math.min(...lines.map((l) => fitDisplay(l.text, innerW, 150, 72)));
  const cardH = Math.round(size * LINE_H * lines.length + 2 * PAD_Y);
  const cardY = Math.round(CY - cardH / 2);
  return {lines, size, cardH, cardY, content: {x0: MAIN.x0, x1: MAIN.x1 + SHADOW, y0: cardY - 12, y1: cardY + cardH + SHADOW + 16}};
};

/** 每个点亮单位（汉字一个字、英文一个词）开始亮的时刻 */
const clockOf = (line: string, from: number, marks: KeywordMarks, total: number): number[] => {
  const units = unitsOf(line);
  const chars = marks.chars;
  const t0 = Math.max(0, marks.text0 - 0.15);
  const t1 = Math.max(t0 + 0.2, marks.text);
  let off = from;
  return units.map((u) => {
    const at = off;
    off += Array.from(u).length;
    if (chars && chars.length === total && Number.isFinite(chars[at])) return Math.max(0, chars[at] - 0.08);
    return t0 + (at / Math.max(1, total)) * (t1 - t0);
  });
};

/** hot 落在这一行里的那一截（hot 跨行时两行各扫一截） */
const hotPart = (line: string, from: number, text: string, hot?: string): string | undefined => {
  if (!hot) return undefined;
  const hk = text.indexOf(hot);
  if (hk < 0) return undefined;
  const h0 = Array.from(text.slice(0, hk)).length;
  const h1 = h0 + Array.from(hot).length;
  const l0 = from;
  const l1 = from + Array.from(line).length;
  const a = Math.max(h0, l0);
  const b = Math.min(h1, l1);
  if (b <= a) return undefined;
  return Array.from(line).slice(a - l0, b - l0).join('');
};

export const Keyword: React.FC<{data: KeywordData; marks: KeywordMarks; t: number; geom?: KeywordGeom}> = ({data, marks, t, geom}) => {
  const pal = usePal();
  const g = geom ?? keywordGeom(data);
  const total = Array.from(data.text ?? '').length;
  const enter = popScale(t, 0, 0.27, 0.85);
  const markerAt = Number.isFinite(marks.hot) ? Math.max(0, (marks.hot as number) - 0.1) : undefined;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div
        style={{
          position: 'absolute',
          left: MAIN.x0,
          width: MAIN.w,
          top: g.cardY,
          height: g.cardH,
          boxSizing: 'border-box',
          background: pal.card,
          borderRadius: 18,
          border: `5px solid ${pal.ink}`,
          boxShadow: `${SHADOW}px ${SHADOW}px 0 ${pal.ink}`,
          transform: `scale(${enter}) rotate(${(1 - enter) * -3}deg)`,
          opacity: Math.min(1, enter * 1.4),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `0 ${PAD_X}px`,
        }}
      >
        {g.lines.map((line, i) => {
          const hot = hotPart(line.text, line.from, data.text, data.hot);
          return (
            <div key={i} style={{fontSize: g.size, fontWeight: 900, lineHeight: LINE_H, color: pal.ink, textAlign: 'center', whiteSpace: 'nowrap'}}>
              <Lit text={line.text} t={t} t0={0} rate={6} clock={clockOf(line.text, line.from, marks, total)} hot={hot} hotColor={pal.primary} marker={!!hot} markerAt={markerAt} markerDur={0.45} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
