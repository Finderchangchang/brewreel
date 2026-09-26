import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitLine, fitSize} from '../../../core/fit';
import {Stage, StagePhase, Who} from './cast';
export {Peek} from './cast';
import {Eyebrow, Lit, QBlock, fitDisplay, litDur, popScale, prog, usePal, useTk} from './kit';

// ============================================================
// 媒体卡（16:9 圆角卡，证据位）+ 卡上叠层（播放键、倒带角标、烧录字幕条、倒数）+ 探头吉祥物 + 卡下三层字幕 + 钩子标题头。
// 位置全部从令牌 layout 取；quiz 只支持 9:16（style.json aspects），所以直接用 9:16 的像素。
// ============================================================

export type CardBox = {x: number; y: number; w: number; h: number};
export const useCardBox = (pos: 'hook' | 'quiz'): CardBox => {
  const tk = useTk();
  const m = tk.layout?.media ?? {w: 780, h: 439, yHook: 600, yQuiz: 372};
  return {x: (1080 - m.w) / 2, y: pos === 'hook' ? m.yHook : m.yQuiz, w: m.w, h: m.h};
};

export type StageProps = {scene?: string; media?: string; speaker?: Who | null; talkFrom?: number; talkUntil?: number; rewind?: boolean; items?: string[]; phase?: StagePhase; phaseAt?: number};

/** 媒体卡本体。children 叠在画面上（角标、字幕条、倒数） */
export const MediaCard: React.FC<{box: CardBox; t: number; stage: StageProps; children?: React.ReactNode}> = ({box, t, stage, children}) => {
  const tk = useTk();
  const pal = usePal();
  const m = tk.layout?.media ?? {};
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: m.radius ?? 28, overflow: 'hidden', boxShadow: m.shadow, background: pal.card, border: `4px solid ${pal.ink}`}}>
      <Stage {...stage} w={box.w} h={box.h} t={t} />
      {children}
    </div>
  );
};

/** 播放键：0.13 秒弹出，点一下后消失 */
export const PlayButton: React.FC<{t: number; at: number; box: CardBox}> = ({t, at, box}) => {
  const pal = usePal();
  if (t < at || t > at + 0.42) return null;
  const s = popScale(t, at, 0.13, 0, 1.1);
  const press = interpolate(t, [at + 0.25, at + 0.32, at + 0.4], [1, 0.86, 1], clamp);
  const d = 132;
  return (
    <div style={{position: 'absolute', left: box.w / 2 - d / 2, top: box.h / 2 - d / 2, width: d, height: d, borderRadius: '50%', background: pal.card, border: `5px solid ${pal.ink}`, transform: `scale(${s * press})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={56} height={56} viewBox="0 0 40 40">
        <path d="M12 7 L33 20 L12 33 Z" fill={pal.primary} stroke={pal.ink} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** 倒带角标：卡左上角「◀◀」，倒带期间闪 */
export const RewindBadge: React.FC<{t: number; from: number; to: number}> = ({t, from, to}) => {
  const pal = usePal();
  if (t < from) return null;
  const on = t < to;
  const blink = on ? (Math.floor(t * 8) % 2 === 0 ? 1 : 0.55) : 1;
  const s = popScale(t, from, 0.13, 0.4, 1.1);
  return (
    <div style={{position: 'absolute', left: 22, top: 22, padding: '6px 18px', borderRadius: 999, background: pal.highlight, border: `4px solid ${pal.ink}`, display: 'flex', alignItems: 'center', gap: 4, transform: `scale(${s})`, transformOrigin: 'left top', opacity: blink}}>
      <svg width={64} height={34} viewBox="0 0 64 34">
        <path d="M30 4 L6 17 L30 30 Z M58 4 L34 17 L58 30 Z" fill={pal.ink} />
      </svg>
    </div>
  );
};

/** 卡内烧录字幕条（深色半透明底，关键词亮色） */
export const BurnedSub: React.FC<{text: string; hot?: string; t: number; at: number; box: CardBox}> = ({text, hot, t, at, box}) => {
  const tk = useTk();
  const pal = usePal();
  if (!text) return null;
  const op = interpolate(t, [at, at + 0.16], [0, 1], clamp);
  const fs = fitLine(text, box.w - 120, 38, tk.type?.min ?? 28);
  const k = hot && text.includes(hot) ? text.indexOf(hot) : -1;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', opacity: op}}>
      <span style={{padding: '6px 22px', borderRadius: 12, background: pal.subBar, color: '#FFFFFF', fontSize: fs, fontWeight: 800, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
        {k >= 0 ? (
          <>
            {text.slice(0, k)}
            <span style={{color: pal.highlight}}>{hot}</span>
            {text.slice(k + (hot?.length ?? 0))}
          </>
        ) : (
          text
        )}
      </span>
    </div>
  );
};

/** 倒数：卡中央大号亮色数字，一拍一个，1.35→1 */
export const Countdown: React.FC<{t: number; at: number; beat: number; box: CardBox; n?: number}> = ({t, at, beat, box, n = 3}) => {
  const tk = useTk();
  const pal = usePal();
  const c = tk.motion?.countdown ?? {enter: 0.13, from: 1.35, opacity: 0.92};
  const k = Math.floor((t - at) / beat);
  if (t < at || k >= n) return null;
  const t0 = at + k * beat;
  const s = interpolate(t, [t0, t0 + c.enter], [c.from, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const fs = tk.type?.countdown ?? 280;
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)'}}>
      <div style={{fontSize: fs, fontWeight: 900, lineHeight: 1, color: pal.highlight, WebkitTextStroke: `8px ${pal.ink}`, paintOrder: 'stroke fill', textShadow: `10px 12px 0 ${pal.ink}`, transform: `scale(${s})`, opacity: c.opacity}}>{n - k}</div>
    </div>
  );
};

/** 卡下三层字幕：说话人小标签 / 原文（逐词点亮，关键词换主色 + 马克笔）/ 译文 */
export const SubStack: React.FC<{y: number; t: number; t0: number; speaker?: string; line: string; zh?: string; hot?: string; hotAt?: number; rate?: number; mode?: 'ghost' | 'type'}> = ({y, t, t0, speaker, line, zh, hot, hotAt, rate = 3.2, mode = 'ghost'}) => {
  const tk = useTk();
  const pal = usePal();
  const fs = fitSize(line, 780, tk.type?.subtitle ?? 50, 40);
  const lineDur = litDur(line, rate * 2, 0.3);
  const on = hotAt === undefined || t >= hotAt;
  return (
    <div style={{position: 'absolute', left: 150, width: 780, top: y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center'}}>
      {speaker ? <span style={{padding: '2px 16px', borderRadius: 999, background: pal.cardAlt, border: `3px solid ${pal.primary}`, color: pal.primary, fontSize: tk.type?.speaker ?? 28, fontWeight: 800, lineHeight: 1.3}}>{speaker}</span> : null}
      <div style={{fontSize: fs, fontWeight: 800, color: pal.ink, lineHeight: 1.3}}>
        <Lit text={line} t={t} t0={t0} rate={rate * 2} latinWord={0.3} mode={mode} hot={on ? hot : undefined} marker={!!hot && on} markerAt={hotAt ?? t0 + lineDur} />
      </div>
      {zh ? (
        <div style={{fontSize: tk.type?.translation ?? 40, fontWeight: 600, color: pal.ink, opacity: interpolate(t, [t0 + lineDur * 0.5, t0 + lineDur * 0.5 + 0.2], [0.35, 0.72], clamp), lineHeight: 1.3}}>{zh}</div>
      ) : null}
    </div>
  );
};

/** 钩子标题头：眉题 + 大号短语 + 「= 误解 ?」。phraseTitle 里逐字点亮，clip 里沿用（全亮） */
export const HookHeader: React.FC<{t: number; eyebrow?: string; phrase: string; guess: string; lit?: boolean}> = ({t, eyebrow, phrase, guess, lit}) => {
  const tk = useTk();
  const pal = usePal();
  const L = tk.layout ?? {};
  const x0 = L.marginLeft ?? 150;
  const maxW = (L.peek?.x ?? 716) - 16 - x0;
  const size = fitDisplay(phrase, maxW, tk.type?.phrase ?? 150, tk.type?.phraseMin ?? 80);
  const q = tk.layout?.qBlock?.size ?? 108;
  const gs = fitLine(`= ${guess}`, maxW - q - 24, tk.type?.guess ?? 88, 60);
  const plan = hookPlan(phrase, guess, tk);
  const T = lit ? 99 : t;
  const top = L.titleY ?? 296;
  // 第 0 帧就是钩子：短语从第 0 帧起是实色（只做 1.06→1 的落定缩放），误解行幽灵字 ≥60%（motion.hookGhost）
  const settle = interpolate(T, [0, 0.3], [1.06, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const hookGhost = tk.motion?.hookGhost ?? 0.6;
  return (
    <>
      {eyebrow ? <Eyebrow text={eyebrow} x={x0 + 2} y={L.eyebrowY ?? 256} color={pal.ink} dot={pal.primary} /> : null}
      <div style={{position: 'absolute', left: x0, top, fontSize: size, fontWeight: 900, color: pal.primary, lineHeight: 1.08, whiteSpace: 'nowrap', letterSpacing: tk.font?.latinTracking ?? '-0.025em', transform: `scale(${settle})`, transformOrigin: 'left center'}}>
        {phrase}
      </div>
      <div style={{position: 'absolute', left: x0, top: top + size * 1.08 + 10, height: q, display: 'flex', alignItems: 'center', gap: 20, fontSize: gs, fontWeight: 900, color: pal.ink, whiteSpace: 'nowrap'}}>
        <span>
          <Lit text={`= ${guess}`} t={T} t0={plan.guessAt} rate={10} latinWord={0.12} ghost={hookGhost} />
        </span>
        <QBlock t={T} at={plan.qAt} />
      </div>
    </>
  );
};

/** 钩子标题的时间表（phraseTitle 和 sfx 共用） */
export const hookPlan = (phrase: string, guess: string, tk: Record<string, any>) => {
  const phraseAt = 0.03;
  const pd = litDur(phrase, 10, tk.motion?.latinWord ?? 0.37);
  const guessAt = phraseAt + pd + 0.16;
  const gd = litDur(`= ${guess}`, 10, 0.12);
  const qAt = guessAt + gd + 0.14;
  return {phraseAt, guessAt, qAt, peekAt: qAt + 0.38};
};

export {prog};
