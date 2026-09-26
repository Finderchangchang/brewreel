import React from 'react';
import {interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitSize} from '../../../core/fit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Actor} from '../parts/cast';
import {Lit, TagRow, backOut, litDur, usePal, useTk, useVoice} from '../parts/kit';
import {useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / duoScene：两个小人再演一遍（把知识迁移到生活）。整页上滑进场。
// 语境句逐字 → 两个角色以脚底为锚点从 0.2 倍放大进场（0.2 秒，间隔 0.1 秒）→ 搭档（右）的问句气泡弹出（0.13 秒，0.6→1，
// 锚在尾巴尖），关键词主色 + 马克笔 1.5 秒慢扫 → 气泡收起 → 主讲人（左）的回答气泡（先幽灵后实）→ 主讲人跳起，
// 最高点状态道具亮起、放火花。气泡是小圆角 + 硬投影的方框、直角楔形尾巴；译文放在气泡第二行。小人放大到 y≈700–1400。
// ============================================================
type P = {context: string; ask: string; askZh?: string; reply: string; replyZh?: string; key?: string};

export const plan = (p: P, dur: number) => {
  // 语境句 14 字/秒快速打出，问句气泡 0.5 秒左右就弹出（开场不只有一行字 + 两个站着的小人）
  const ctxEnd = 0.1 + litDur(p.context ?? '', 14);
  const charA = 0;
  const charB = charA + tokens.motion.charIn.stagger;
  const askAt = Math.max(0.5, Math.min(ctxEnd + 0.1, dur * 0.2));
  const replyAt = Math.max(askAt + 1.6, dur * 0.58);
  const askOut = replyAt - 0.3;
  const solidAt = replyAt + 0.3;
  const hop = Math.min(dur - 0.9, solidAt + 0.9);
  return {ctxEnd, charA, charB, askAt, askOut, replyAt, solidAt, hop};
};

const Bubble: React.FC<{text: string; sub?: string; t: number; at: number; out?: number; side: 'left' | 'right'; tailX: number; y: number; hot?: string; ghostUntil?: number}> = ({text, sub, t, at, out, side, tailX, y, hot, ghostUntil}) => {
  const tk = useTk();
  const pal = usePal();
  const B = tk.layout?.bubble ?? {radius: 18, stroke: 4, padX: 32, padY: 18, tail: 24, shadow: 6};
  const bp = tk.motion?.bubblePop ?? {dur: 0.13, from: 0.6};
  if (t < at || (out !== undefined && t > out + 0.14)) return null;
  const sIn = interpolate(t, [at, at + bp.dur], [bp.from, 1], {...clamp, easing: backOut(1.6)});
  const sOut = out !== undefined ? interpolate(t, [out, out + 0.13], [1, 0], clamp) : 1;
  const fs = fitSize(text, 780 - B.padX * 2, tk.type?.bubble ?? 50, 40);
  const ghost = ghostUntil !== undefined && t < ghostUntil;
  const hotIn = hot && text.includes(hot);
  return (
    <div style={{position: 'absolute', left: 150, width: 780, top: y, display: 'flex', justifyContent: side === 'left' ? 'flex-start' : 'flex-end'}}>
      <div style={{position: 'relative', maxWidth: 780, padding: `${B.padY}px ${B.padX}px`, borderRadius: B.radius, background: pal.card, border: `${B.stroke}px solid ${ghost ? pal.wrong : pal.ink}`, fontSize: fs, fontWeight: 800, lineHeight: 1.3, color: pal.ink, opacity: ghost ? 0.5 : 1, transform: `scale(${sIn * sOut})`, transformOrigin: side === 'left' ? `${tailX - 150}px 100%` : `calc(100% - ${930 - tailX}px) 100%`, boxShadow: ghost ? 'none' : `${B.shadow ?? 6}px ${B.shadow ?? 6}px 0 ${pal.ink}`}}>
        <Lit text={text} t={t} t0={at} rate={40} hot={hotIn ? hot : undefined} marker={!!hotIn} markerAt={at + 0.1} />
        {sub ? <div style={{fontSize: tk.type?.translation ?? 40, fontWeight: 600, opacity: 0.7, marginTop: 4}}>{sub}</div> : null}
        <svg width={B.tail * 2} height={B.tail + 6} viewBox={`0 -6 ${B.tail * 2} ${B.tail + 6}`} style={{position: 'absolute', bottom: -B.tail - 2, ...(side === 'left' ? {left: tailX - 150 - B.tail} : {right: 930 - tailX - B.tail})}}>
          <path d={`M0 0 L${side === 'left' ? 0 : B.tail * 2} ${B.tail} L${B.tail * 2} 0`} fill={pal.card} stroke={ghost ? pal.wrong : pal.ink} strokeWidth={B.stroke} strokeLinejoin="round" />
          <rect x={B.stroke} y={-6} width={B.tail * 2 - B.stroke * 2} height={6 + B.stroke / 2} fill={pal.card} />
        </svg>
      </div>
    </div>
  );
};

const DuoScene: React.FC<ShotProps<P>> = ({params, t, dur, meta}) => {
  const tk = useTk();
  const voice = useVoice(meta);
  const hook = useStoryParams<{tag?: string}>('phraseTitle');
  const pal = usePal();
  const pl = plan(params, dur);
  const x0 = tk.layout?.marginLeft ?? 150;
  const H = tk.layout?.duoCharHeight ?? 700;
  // 小人放大到 y≈700–1400（腿可以伸出 1340 的文字安全线，脸和气泡在线内），译文放进气泡第二行，下半屏不空着
  const feet = 1400;
  const ci = tk.motion?.charIn ?? {dur: 0.2, from: 0.2};
  const sA = interpolate(t, [pl.charA, pl.charA + ci.dur], [ci.from, 1], {...clamp, easing: backOut(1.5)});
  const sB = interpolate(t, [pl.charB, pl.charB + ci.dur], [ci.from, 1], {...clamp, easing: backOut(1.5)});
  const hopY = t >= pl.hop ? Math.sin(Math.min(1, (t - pl.hop) / (tk.motion?.hop?.dur ?? 0.2) / 2) * Math.PI) * (tk.motion?.hop?.dy ?? 30) * 1.6 : 0;
  const lit = t >= pl.hop + 0.1;
  const replying = t >= pl.replyAt;
  const cs = fitSize(params.context ?? '', 780, tk.type?.context ?? 60, 44);
  const ax = 330;
  const bx = 750;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <TagRow label={hook?.tag ?? voice('tag')} x={x0} y={tk.layout?.tagY ?? 262} />
      <div style={{position: 'absolute', left: x0, top: tk.layout?.titleY ?? 318, width: 780, fontSize: cs, fontWeight: 800, color: pal.ink, lineHeight: 1.3}}>
        <Lit text={params.context ?? ''} t={t} t0={0.1} rate={14} mode="type" />
      </div>
      <Actor who="a" x={ax} y={feet} size={H} t={t} scale={sA} hop={hopY} lit={lit} facing="right" expr={lit ? 'happy' : 'neutral'} pose={lit ? 'cheer' : undefined} talk={replying ? [pl.replyAt, pl.replyAt + 1.2] : null} fx={lit ? 'sparkle' : undefined} fxT={t - pl.hop - 0.1} />
      <Actor who="b" x={bx} y={feet} size={H} t={t} scale={sB} facing="left" expr={replying ? 'surprised' : 'neutral'} talk={[pl.askAt, pl.askAt + 1.4]} />
      <Bubble text={params.ask ?? ''} sub={params.askZh} t={t} at={pl.askAt} out={pl.askOut} side="right" tailX={bx} y={450} hot={params.key} />
      <Bubble text={params.reply ?? ''} sub={params.replyZh} t={t} at={pl.replyAt} side="left" tailX={ax} y={450} hot={params.key} ghostUntil={pl.solidAt} />
    </div>
  );
};
export default DuoScene;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur);
  return [
    {at: 0, kind: 'swish', vol: 0.24},
    {at: pl.askAt, kind: 'pop', vol: 0.3},
    {at: pl.replyAt, kind: 'pop', vol: 0.26},
    {at: pl.hop, kind: 'pu', vol: 0.3},
    {at: pl.hop + 0.1, kind: 'bell', vol: 0.24},
  ];
};
