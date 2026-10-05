// keyword：关键词大字（口播专用）。字全部出自原句。
// 版面两种：
//   ① 有 hot、hot 前后还有别的字（单独成行的那一截至少两个字）：hot 单独一行、按宽度撑满（取景框九成宽），前后的字缩到 0.6 倍各占一行
//     （太长再拆两行）；竖长的框（pip / full）里这样排只占不到一半高时，hot 拆成两行再放大；
//   ② 其余：一行或两行同样大的字，7 个字以上一律两行，优先在逗号后断行，行尾标点不上屏。
// 字块在取景框里竖直居中、往上偏 4%（视觉居中）。
// 出字：hot 以外的字在进场 0.3 秒内先全部显出来；hot 的字先是卡片色的空心描边字（静帧里看着是有意的描边字，不是灰掉的字），
// 跟着口播一个字一个字填实。没有 hot 时整句在进场 0.3 秒内出完，说完最后一个字时底下画一笔弧线。
// hot 说完那一刻扫一道马克笔，描边换成马克笔色，同时轻轻放大一下。没有 hot 时最后一行下面画一笔弧线（形状，不是字）。
// 字的质感按风格：wood 像贴在木板上的贴纸字带一点厚度，clay 软圆的投影，paper 错开一层彩纸，ink 纯墨色。
import React from 'react';
import {Easing} from 'remotion';
import {unitsOf} from '../../styles/quiz/parts/kit';
import {rgba, type MotionPalette} from './palette';
import {LINE_H, keywordLayout} from './kwLayout';
import {MarkerSwipe, bump, prog, springAt} from './parts';
import {visualTop} from './stage';
import {markerTiming} from './timing';
import type {KeywordData, KeywordMarks} from './types';

export {LINE_H, breakAt, keywordLayout, type KeywordLayout, type KwLine} from './kwLayout';

/** 每个点亮单位（汉字一个字、英文一个词）开始亮的时刻：按口播（marks.chars），对不上时在首尾之间均分 */
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

export const Keyword: React.FC<{data: KeywordData; marks: KeywordMarks; t: number; dur: number; W: number; H: number; pal: MotionPalette}> = ({data, marks, t, dur, W, H, pal}) => {
  const L = keywordLayout(data, W, H);
  const text = data.text ?? '';
  const total = Array.from(text).length;
  const hk = data.hot ? text.indexOf(data.hot) : -1;
  const h0 = hk >= 0 ? Array.from(text.slice(0, hk)).length : -1;
  const h1 = hk >= 0 ? h0 + Array.from(data.hot as string).length : -1;
  const marker = markerTiming(marks.hot, dur, marks.hot0);
  const mP = marker.at == null ? 0 : prog(t, marker.at, marker.dur, Easing.inOut(Easing.quad));
  const hotBump = marker.at == null ? 0 : bump(t, marker.at + marker.dur * 0.55, 0.5);
  const y0 = visualTop(H, L.blockH);
  const lastAt = Math.max(0, (marks.text ?? 0) - 0.05);
  const swoop = hk < 0 ? prog(t, lastAt + 0.05, 0.45, Easing.inOut(Easing.quad)) : 0;
  const markerColor = pal.look === 'ink' ? rgba(pal.accent, 0.95) : pal.accent;
  // hot 以外的字在进场 0.3 秒内先显出来（按顺序快速排开）；hot 的字先是空心描边字，说到哪个字哪个字填实
  const contextCount = hk >= 0 ? total - (h1 - h0) : total;

  /** hot 里的字：马克笔扫到它时，贴纸描边换成马克笔的颜色（wood / clay），paper 的错位纸层换成马克笔色 */
  const hotLit = (lit: React.CSSProperties, s: number, frac: number | null): React.CSSProperties => {
    if (frac == null || mP <= frac) return lit;
    if (pal.look === 'wood' || pal.look === 'clay') return {...lit, WebkitTextStroke: `${s * (pal.look === 'clay' ? 0.13 : 0.12)}px ${pal.accent}`};
    if (pal.look === 'paper') return {...lit, textShadow: `${s * 0.05}px ${s * 0.05}px 0 ${pal.accent}, ${s * 0.06}px ${s * 0.1}px ${s * 0.06}px ${rgba('#3A3020', 0.2)}`};
    return lit;
  };
  const unitEl = (u: string, at: number, key: string, lit: React.CSSProperties, s: number, hotFrac: number | null) => {
    const on = t >= at;
    const p = on ? springAt(t, at, 11, 230) : 0;
    return (
      <span
        key={key}
        style={
          on
            ? {display: 'inline-block', whiteSpace: 'pre', ...hotLit(lit, s, hotFrac), opacity: Math.min(1, 0.25 + p * 2), transform: `translateY(${(1 - p) * 0.16}em) scale(${0.72 + 0.28 * p})`, transformOrigin: '50% 80%'}
            : hotFrac != null
              ? {display: 'inline-block', whiteSpace: 'pre', color: pal.card, WebkitTextStroke: `${Math.max(5, s * 0.06)}px ${rgba(pal.ink, 0.9)}`, paintOrder: 'stroke fill'}
              : {display: 'inline-block', whiteSpace: 'pre', opacity: 0}
        }
      >
        {u}
      </span>
    );
  };

  let ctxIdx = 0;
  let y = y0;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${1 + 0.03 * Math.min(1, t / dur)})`, transformOrigin: `50% ${y0 + L.blockH / 2}px`}}>
        {L.lines.map((line, li) => {
          const s = line.size;
          const lit = litStyle(pal, s);
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
            let when = clock[k];
            if (!isHot) {
              when = 0.04 + (0.26 * ctxIdx) / Math.max(1, contextCount);
              ctxIdx += Array.from(u).length;
            }
            const el = unitEl(u, when, `${li}-${k}`, lit, s, isHot ? (at - h0) / Math.max(1, h1 - h0) : null);
            if (isHot) hotEls.push(el);
            else if (h0 >= 0 && at >= h1) after.push(el);
            else before.push(el);
          });
          const isLast = li === L.lines.length - 1;
          const top = y;
          y += s * LINE_H + (L.gaps[li] ?? 0);
          return (
            <div key={li} style={{position: 'absolute', left: 0, top, width: W, height: s * LINE_H, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: s, fontWeight: 900, lineHeight: LINE_H, whiteSpace: 'nowrap', zIndex: 0}}>
              <div style={{position: 'relative', display: 'flex', alignItems: 'center', zIndex: 0}}>
                {before}
                {hotEls.length ? (
                  <span style={{position: 'relative', display: 'inline-flex', zIndex: 0, transform: `scale(${1 + 0.09 * hotBump})`, transformOrigin: '50% 60%'}}>
                    <MarkerSwipe p={mP} color={markerColor} top="34%" height="72%" opacity={0.92} tilt={-1.5} />
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
