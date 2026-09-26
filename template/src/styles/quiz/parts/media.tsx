import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitLine, fitSize} from '../../../core/fit';
import {Stage, StagePhase, Who} from './cast';
export {Presenter, presenterSpot} from './cast';
import {Lit, PenCircle, TagRow, cardStyle, displayEm, fitDisplay, litDur, popScale, prog, usePal, useTk} from './kit';

// ============================================================
// 媒体卡（16:9 小圆角卡 + 硬投影，证据位）+ 卡上叠层（播放键、回放计时签、卡内字幕签、秒表倒数）
// + 卡下引文块（说话人 / 原文 / 译文）+ 钩子标题头（题号签 + 大短语 + 红笔圈疑）。
// 位置全部从令牌 layout 取；quiz 只支持 9:16（style.json aspects），所以直接用 9:16 的像素。
// ============================================================

export type CardBox = {x: number; y: number; w: number; h: number};
export const useCardBox = (pos: 'hook' | 'quiz'): CardBox => {
  const tk = useTk();
  const m = tk.layout?.media ?? {w: 840, h: 473, yHook: 612, yQuiz: 388};
  return {x: (1080 - m.w) / 2, y: pos === 'hook' ? m.yHook : m.yQuiz, w: m.w, h: m.h};
};

export type StageProps = {scene?: string; media?: string; speaker?: Who | null; talkFrom?: number; talkUntil?: number; rewind?: boolean; items?: string[]; phase?: StagePhase; phaseAt?: number};

/** 媒体卡本体。children 叠在画面上（计时签、字幕签、倒数） */
export const MediaCard: React.FC<{box: CardBox; t: number; stage: StageProps; children?: React.ReactNode}> = ({box, t, stage, children}) => {
  const tk = useTk();
  const pal = usePal();
  const m = tk.layout?.media ?? {};
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, overflow: 'hidden', ...cardStyle(pal, {radius: m.radius ?? 16, stroke: m.stroke ?? 4, shadow: m.shadow ?? 10})}}>
      <Stage {...stage} w={box.w - 8} h={box.h - 8} t={t} />
      {children}
    </div>
  );
};

/** 播放键：主色小方块 + 纸色三角，0.13 秒弹出，按下后消失 */
export const PlayButton: React.FC<{t: number; at: number; box: CardBox}> = ({t, at, box}) => {
  const pal = usePal();
  if (t < at || t > at + 0.42) return null;
  const s = popScale(t, at, 0.13, 0, 1.1);
  const press = interpolate(t, [at + 0.25, at + 0.32, at + 0.4], [1, 0.86, 1], clamp);
  const d = 124;
  return (
    <div style={{position: 'absolute', left: box.w / 2 - d / 2, top: box.h / 2 - d / 2, width: d, height: d, borderRadius: 22, background: pal.primary, border: `5px solid ${pal.ink}`, boxShadow: `6px 6px 0 ${pal.ink}`, transform: `scale(${s * press})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={54} height={54} viewBox="0 0 40 40">
        <path d="M13 8 L32 20 L13 32 Z" fill={pal.card} stroke={pal.card} strokeWidth={3} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** 回放计时签（卡左上角）：墨色签 + 回环箭头 + 等宽计时。倒带时计时往回数，放的时候往前走 */
export const TimecodeChip: React.FC<{t: number; from: number; to: number}> = ({t, from, to}) => {
  const tk = useTk();
  const pal = usePal();
  if (t < from) return null;
  const s = popScale(t, from, 0.13, 0.4, 1.1);
  const back = t < to;
  const sec = back ? Math.max(0, 3.2 - ((t - from) / Math.max(0.01, to - from)) * 3.2) : t - to;
  const txt = `00:0${Math.min(9.9, sec).toFixed(1)}`;
  return (
    <div style={{position: 'absolute', left: 20, top: 20, padding: '6px 16px 6px 10px', borderRadius: 8, background: pal.ink, display: 'flex', alignItems: 'center', gap: 10, transform: `scale(${s})`, transformOrigin: 'left top'}}>
      <svg width={36} height={36} viewBox="0 0 40 40" style={{transform: back ? `rotate(${-t * 900}deg)` : undefined}}>
        <path d="M31 13 A13 13 0 1 0 33 24" fill="none" stroke={back ? pal.highlight : pal.card} strokeWidth={5} strokeLinecap="round" />
        <path d="M24 12 L32 13 L33 5" fill="none" stroke={back ? pal.highlight : pal.card} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{fontFamily: tk.font?.mono, fontSize: 30, fontWeight: 700, color: back ? pal.highlight : pal.card, letterSpacing: '0.04em', lineHeight: 1.1}}>{txt}</span>
    </div>
  );
};

/** 卡内字幕签（卡左下角的纸色签，关键词主色 + 杏黄马克笔）：出题时只放不含答案的半句 */
export const CaptionTag: React.FC<{text: string; hot?: string; t: number; at: number; box: CardBox}> = ({text, hot, t, at, box}) => {
  const tk = useTk();
  const pal = usePal();
  if (!text) return null;
  const op = interpolate(t, [at, at + 0.16], [0, 1], clamp);
  const fs = fitLine(text, box.w - 140, 38, tk.type?.min ?? 28);
  return (
    <div style={{position: 'absolute', left: 20, bottom: 20, opacity: op, transform: `translateY(${(1 - op) * 12}px)`}}>
      <span style={{display: 'inline-block', padding: '6px 20px', borderRadius: 8, background: pal.card, border: `3px solid ${pal.ink}`, color: pal.ink, fontSize: fs, fontWeight: 800, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
        <Lit text={text} t={t} t0={-1} rate={40} hot={hot && text.includes(hot) ? hot : undefined} marker={!!hot && text.includes(hot)} markerAt={at} markerDur={0.4} />
      </span>
    </div>
  );
};

/** 秒表倒数：卡中央一只墨色秒表，杏黄外圈随每一拍走空，纸色等宽数字一拍一个 */
export const Countdown: React.FC<{t: number; at: number; beat: number; box: CardBox; n?: number}> = ({t, at, beat, box, n = 3}) => {
  const tk = useTk();
  const pal = usePal();
  const c = tk.motion?.countdown ?? {enter: 0.13, from: 1.25};
  const k = Math.floor((t - at) / beat);
  if (t < at || k >= n) return null;
  const t0 = at + k * beat;
  const s = interpolate(t, [t0, t0 + c.enter], [c.from, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const left = 1 - Math.min(1, (t - t0) / beat);
  const D = 250;
  const R = D / 2 - 14;
  const fs = tk.type?.countdown ?? 150;
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.14)'}}>
      <div style={{position: 'relative', width: D, height: D, transform: `scale(${s})`}}>
        <div style={{position: 'absolute', left: D / 2 - 22, top: -30, width: 44, height: 30, borderRadius: 6, background: pal.ink}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: pal.ink, boxShadow: `8px 8px 0 rgba(0,0,0,0.25)`}} />
        <svg width={D} height={D} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
          <circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke={pal.highlight} strokeWidth={16} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - left} strokeLinecap="round" />
        </svg>
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: tk.font?.mono, fontSize: fs, fontWeight: 700, color: pal.card, lineHeight: 1}}>{n - k}</div>
      </div>
    </div>
  );
};

/** 卡下引文块：左侧一道主色竖线，说话人等宽小签 / 原文（逐词点亮，关键词主色 + 马克笔）/ 译文。左对齐 */
export const SubStack: React.FC<{y: number; t: number; t0: number; speaker?: string; line: string; zh?: string; hot?: string; hotAt?: number; rate?: number; mode?: 'ghost' | 'type'; width?: number}> = ({y, t, t0, speaker, line, zh, hot, hotAt, rate = 3.2, mode = 'ghost', width = 780}) => {
  const tk = useTk();
  const pal = usePal();
  const fs = fitSize(line, width - 34, tk.type?.subtitle ?? 46, 40);
  const lineDur = litDur(line, rate * 2, 0.3);
  const on = hotAt === undefined || t >= hotAt;
  return (
    <div style={{position: 'absolute', left: 150, width, top: y, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, paddingLeft: 28, borderLeft: `6px solid ${pal.primary}`, boxSizing: 'border-box'}}>
      {speaker ? <span style={{fontFamily: tk.font?.mono, fontSize: tk.type?.speaker ?? 28, fontWeight: 700, color: pal.primary, letterSpacing: '0.04em', lineHeight: 1.2}}>{speaker} /</span> : null}
      <div style={{fontSize: fs, fontWeight: 800, color: pal.ink, lineHeight: 1.3}}>
        <Lit text={line} t={t} t0={t0} rate={rate * 2} latinWord={0.3} mode={mode} hot={on ? hot : undefined} marker={!!hot && on} markerAt={hotAt ?? t0 + lineDur} />
      </div>
      {zh ? (
        <div style={{fontSize: tk.type?.translation ?? 40, fontWeight: 600, color: pal.ink, opacity: interpolate(t, [t0 + lineDur * 0.5, t0 + lineDur * 0.5 + 0.2], [0.35, 0.7], clamp), lineHeight: 1.3}}>{zh}</div>
      ) : null}
    </div>
  );
};

/** 钩子标题头：题号签 + 大号短语（主色）+ 「= 误解」被朱红笔圈起来、甩出一个手写问号。phraseTitle 里逐字点亮，clip 里沿用（全亮） */
export const HookHeader: React.FC<{t: number; tag?: string; eyebrow?: string; phrase: string; guess: string; lit?: boolean}> = ({t, tag, eyebrow, phrase, guess, lit}) => {
  const tk = useTk();
  const pal = usePal();
  const L = tk.layout ?? {};
  const x0 = L.marginLeft ?? 150;
  const maxW = (L.marginRight ?? 930) - x0;
  const size = fitDisplay(phrase, maxW, tk.type?.phrase ?? 138, tk.type?.phraseMin ?? 88);
  const qSize = 84;
  const gs = fitLine(`= ${guess}`, maxW - qSize * 0.62 - 70, tk.type?.guess ?? 70, 52);
  const plan = hookPlan(phrase, guess, tk);
  const T = lit ? 99 : t;
  const top = L.titleY ?? 318;
  // 第 0 帧就是钩子：短语从第 0 帧起是实色（只做 1.05→1 的落定缩放），误解行幽灵字 ≥60%（motion.hookGhost）
  const settle = interpolate(T, [0, 0.3], [1.05, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const hookGhost = tk.motion?.hookGhost ?? 0.6;
  return (
    <>
      <TagRow label={tag} text={eyebrow} x={x0} y={L.tagY ?? 262} />
      <div style={{position: 'absolute', left: x0, top, fontSize: size, fontWeight: tk.font?.displayWeight ?? 800, color: pal.primary, lineHeight: 1.08, whiteSpace: 'nowrap', letterSpacing: tk.font?.latinTracking ?? '-0.01em', transform: `scale(${settle})`, transformOrigin: 'left center'}}>
        {phrase}
      </div>
      <div style={{position: 'absolute', left: x0 - 14, top: top + size * 1.08 + 18, display: 'flex', alignItems: 'center', fontSize: gs, fontWeight: 800, color: pal.ink, whiteSpace: 'nowrap', lineHeight: 1.25}}>
        <PenCircle t={T} at={plan.qAt} qSize={qSize} w={displayEm(`= ${guess}`) * gs} h={gs * 1.25}>
          <Lit text={`= ${guess}`} t={T} t0={plan.guessAt} rate={10} latinWord={0.12} ghost={hookGhost} />
        </PenCircle>
      </div>
    </>
  );
};

/** 钩子标题的时间表（phraseTitle 和 sfx 共用）。qAt = 红笔开始圈的时刻，hostAt = 讲解小窗打开 */
export const hookPlan = (phrase: string, guess: string, tk: Record<string, any>) => {
  const phraseAt = 0.03;
  const pd = litDur(phrase, 10, tk.motion?.latinWord ?? 0.37);
  const guessAt = phraseAt + pd + 0.16;
  const gd = litDur(`= ${guess}`, 10, 0.12);
  const qAt = guessAt + gd + 0.14;
  return {phraseAt, guessAt, qAt, hostAt: qAt + (tk.motion?.penCircle ?? 0.32) + 0.12};
};

export {prog};
