// keyword：关键词大字（口播专用）。字占取景框宽度约八成，长了自动两行；说到哪个字亮到哪个字（每个字的时刻由脚本按字幕算好，
// marks.chars），没说到的字先以很淡的样子排好（版面不跳）。hot 在说完那一刻扫一道马克笔，同时轻轻放大一下。字全部出自原句。
// 字的质感按风格：wood 像贴在木板上的贴纸字带一点厚度，clay 软圆的投影，paper 错开一层彩纸，ink 纯墨色。
// 四角的括线、没有 hot 时最后一行下面的一笔弧线只是形状，不是字。
import React from 'react';
import {Easing} from 'remotion';
import {glueBreaks, WORD_JOINER} from '../../core/fit';
import {unitsOf} from '../../styles/quiz/parts/kit';
import {blend, rgba, type MotionPalette} from './palette';
import {MarkerSwipe, bump, prog, springAt, textEm} from './parts';
import {markerTiming} from './timing';
import type {KeywordData, KeywordMarks} from './types';

const LINE_H = 1.14;
/** 一行最多放多少「字宽」才不换行（12 字的 keyword 拆成两行，每行 ≤ 6–7 字） */
const ONE_LINE_EM = 7.2;
/** 没说到的字的不透明度 */
const GHOST = 0.13;
const PUNCT_RE = /[，、；：。！？,;:.!?]/;
const TAIL_PUNCT_RE = /[，、；：。,;:.]+$/;

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
    if (hotFrom >= 0 && p > hotFrom && p < hotTo) score += 5;
    if (PUNCT_RE.test(chars[p - 1])) score -= 2.5; // 逗号后面断最自然（「花钱之前，| 它先报价」好过「花钱之前，它 | 先报价」）
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
};

export type KeywordLayout = {lines: {text: string; from: number}[]; size: number; blockW: number; blockH: number};

/** 版面：几行、字号（宽度占取景框约 84%，高度不超过六成）、字块大小。W×H 是取景框（参考像素） */
export const keywordLayout = (data: KeywordData, W: number, H: number): KeywordLayout => {
  const text = data.text ?? '';
  const chars = Array.from(text);
  const two = textEm(text) > ONE_LINE_EM && chars.length >= 4;
  const cut = two ? breakAt(text, data.hot) : chars.length;
  // 行尾的逗号、顿号、句号不上屏（大字标题的排法；不加字、不改字，只是行尾不留标点）
  const tidy = (s: string) => s.trimEnd().replace(TAIL_PUNCT_RE, '');
  const lines = [{text: tidy(chars.slice(0, cut).join('')), from: 0}];
  if (two) {
    const rest = chars.slice(cut).join('');
    const lead = rest.length - rest.trimStart().length;
    lines.push({text: tidy(rest.trimStart()), from: cut + lead});
  }
  const maxW = Math.min(W * 0.84, H * 2.2);
  const byW = Math.min(...lines.map((l) => Math.floor(maxW / textEm(l.text))));
  const byH = Math.floor((H * 0.62) / (lines.length * LINE_H));
  const size = Math.max(56, Math.min(300, byW, byH));
  const blockW = Math.max(...lines.map((l) => textEm(l.text))) * size;
  return {lines, size, blockW, blockH: lines.length * size * LINE_H};
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

/** 字的质感（点亮之后） */
const litStyle = (pal: MotionPalette, s: number): React.CSSProperties => {
  if (pal.look === 'wood')
    return {color: pal.ink, WebkitTextStroke: `${s * 0.12}px ${pal.card}`, paintOrder: 'stroke fill', textShadow: `0 ${s * 0.035}px 0 ${pal.edge}, 0 ${s * 0.07}px 0 ${pal.edge}, 0 ${s * 0.11}px ${s * 0.12}px ${rgba('#4A3218', 0.28)}`};
  if (pal.look === 'clay') return {color: pal.ink, WebkitTextStroke: `${s * 0.13}px ${pal.card}`, paintOrder: 'stroke fill', textShadow: `0 ${s * 0.05}px 0 ${pal.edge}, 0 ${s * 0.1}px ${s * 0.1}px ${rgba('#8C4A40', 0.28)}`};
  if (pal.look === 'paper') return {color: pal.ink, textShadow: `${s * 0.05}px ${s * 0.05}px 0 ${pal.warm}, ${s * 0.06}px ${s * 0.1}px ${s * 0.06}px ${rgba('#3A3020', 0.2)}`};
  return {color: pal.ink};
};

/** 字块四角的括线：画出来，把大字框住 */
const Brackets: React.FC<{x: number; y: number; w: number; h: number; s: number; t: number; color: string}> = ({x, y, w, h, s, t, color}) => {
  const p = prog(t, 0.05, 0.4, Easing.out(Easing.cubic));
  const len = s * 0.42 * p;
  const sw = Math.max(6, s * 0.065);
  const m = s * 0.32;
  const corner = (cx: number, cy: number, sx: number, sy: number, k: number) => (
    <React.Fragment key={k}>
      <div style={{position: 'absolute', left: sx > 0 ? cx : cx - len, top: cy - sw / 2, width: len, height: sw, borderRadius: sw / 2, background: color}} />
      <div style={{position: 'absolute', left: cx - sw / 2, top: sy > 0 ? cy : cy - len, width: sw, height: len, borderRadius: sw / 2, background: color}} />
    </React.Fragment>
  );
  return (
    <>
      {corner(x - m, y - m * 0.75, 1, 1, 0)}
      {corner(x + w + m, y - m * 0.75, -1, 1, 1)}
      {corner(x - m, y + h + m * 0.6, 1, -1, 2)}
      {corner(x + w + m, y + h + m * 0.6, -1, -1, 3)}
    </>
  );
};

export const Keyword: React.FC<{data: KeywordData; marks: KeywordMarks; t: number; dur: number; W: number; H: number; pal: MotionPalette}> = ({data, marks, t, dur, W, H, pal}) => {
  const L = keywordLayout(data, W, H);
  const s = L.size;
  const text = data.text ?? '';
  const total = Array.from(text).length;
  const hk = data.hot ? text.indexOf(data.hot) : -1;
  const h0 = hk >= 0 ? Array.from(text.slice(0, hk)).length : -1;
  const h1 = hk >= 0 ? h0 + Array.from(data.hot as string).length : -1;
  const marker = markerTiming(marks.hot, dur, marks.hot0);
  const mP = marker.at == null ? 0 : prog(t, marker.at, marker.dur, Easing.inOut(Easing.quad));
  const hotBump = marker.at == null ? 0 : bump(t, marker.at + marker.dur * 0.55, 0.5);
  const lit = litStyle(pal, s);
  const x0 = (W - L.blockW) / 2;
  const y0 = (H - L.blockH) / 2;
  const lastAt = Math.max(0, (marks.text ?? 0) - 0.05);
  const swoop = hk < 0 ? prog(t, lastAt + 0.05, 0.45, Easing.inOut(Easing.quad)) : 0;
  const markerColor = pal.look === 'ink' ? rgba(pal.accent, 0.95) : pal.accent;
  const bracketColor = pal.look === 'ink' ? pal.ink : pal.look === 'paper' ? pal.cool : blend(pal.cool, pal.ink, 0.15);

  /** hot 里的字：马克笔扫到它时，贴纸描边换成马克笔的颜色（wood / clay），paper 的错位纸层换成马克笔色 */
  const hotLit = (frac: number | null): React.CSSProperties => {
    if (frac == null || mP <= frac) return lit;
    if (pal.look === 'wood' || pal.look === 'clay') return {...lit, WebkitTextStroke: `${s * (pal.look === 'clay' ? 0.13 : 0.12)}px ${pal.accent}`};
    if (pal.look === 'paper') return {...lit, textShadow: `${s * 0.05}px ${s * 0.05}px 0 ${pal.accent}, ${s * 0.06}px ${s * 0.1}px ${s * 0.06}px ${rgba('#3A3020', 0.2)}`};
    return lit;
  };
  const unitEl = (u: string, at: number, key: string, hotFrac: number | null) => {
    const on = t >= at;
    const p = on ? springAt(t, at, 11, 230) : 0;
    return (
      <span
        key={key}
        style={
          on
            ? {display: 'inline-block', whiteSpace: 'pre', ...hotLit(hotFrac), opacity: Math.min(1, 0.25 + p * 2), transform: `translateY(${(1 - p) * 0.16}em) scale(${0.72 + 0.28 * p})`, transformOrigin: '50% 80%'}
            : {display: 'inline-block', whiteSpace: 'pre', color: rgba(pal.ink, GHOST)}
        }
      >
        {u}
      </span>
    );
  };

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
      <Brackets x={x0} y={y0} w={L.blockW} h={L.blockH} s={s} t={t} color={bracketColor} />
      <div style={{position: 'absolute', left: 0, top: y0, width: W, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${1 + 0.03 * Math.min(1, t / dur)})`, transformOrigin: `50% ${L.blockH / 2}px`}}>
        {L.lines.map((line, li) => {
          const units = unitsOf(line.text);
          const clock = clockOf(line.text, line.from, marks, total);
          const before: React.ReactNode[] = [];
          const hotEls: React.ReactNode[] = [];
          const after: React.ReactNode[] = [];
          let off = line.from;
          units.forEach((u, k) => {
            const at = off;
            off += Array.from(u).length;
            const isHot = h0 >= 0 && at >= h0 && at < h1;
            const el = unitEl(u, clock[k], `${li}-${k}`, isHot ? (at - h0) / Math.max(1, h1 - h0) : null);
            if (isHot) hotEls.push(el);
            else if (h0 >= 0 && at >= h1) after.push(el);
            else before.push(el);
          });
          const isLast = li === L.lines.length - 1;
          return (
            <div key={li} style={{position: 'relative', fontSize: s, fontWeight: 900, lineHeight: LINE_H, whiteSpace: 'nowrap', height: s * LINE_H, display: 'flex', alignItems: 'center', zIndex: 0}}>
              {before}
              {hotEls.length ? (
                <span style={{position: 'relative', display: 'inline-flex', zIndex: 0, transform: `scale(${1 + 0.09 * hotBump})`, transformOrigin: '50% 60%'}}>
                  <MarkerSwipe p={mP} color={markerColor} top="34%" height="74%" />
                  {hotEls}
                </span>
              ) : null}
              {after}
              {isLast && swoop > 0 ? (
                <svg viewBox="0 0 300 40" preserveAspectRatio="none" style={{position: 'absolute', left: '8%', width: '84%', top: s * 1.02, height: s * 0.22, overflow: 'visible'}}>
                  <path d="M6 30 C70 10 160 8 294 18" fill="none" stroke={pal.accent} strokeWidth={14} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - swoop} />
                </svg>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
