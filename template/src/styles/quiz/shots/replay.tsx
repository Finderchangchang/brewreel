import React from 'react';
import {interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {pick} from '../../../core/kit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Lit, Pill, Sticker, litDur, usePal, useTk} from '../parts/kit';
import {MediaCard, Peek, RewindBadge, SubStack, useCardBox} from '../parts/media';
import {useScreenItems, useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / replay：再听一遍（参考片 26.3–29.7 秒，复证）。压暗溶解回到底色页。
// 「◀◀ 再听一遍」逐字 → 吉祥物探头 → 卡左上角倒带角标，画面倒放 0.5 秒 → 重播那句台词；
// 卡下：亮色小胶囊「= 正解」+ 原文（关键词主色 + 马克笔）+ 译文；最后「懂了」圆贴纸盖章（0.13 秒，1.3→1，-8°），
// 吉祥物头顶灯泡亮起、冒心。台词、关键词、正解不写就沿用 clip 和 meaningCard。
// ============================================================
type P = {title?: string; line?: string; zh?: string; key?: string; meaning?: string; sticker?: string; scene?: string; media?: string; screenItems?: string[]};

export const plan = (p: P, dur: number) => {
  const titleEnd = 0.1 + litDur(p.title ?? 'xxxx', 9);
  const peekAt = 0.26;
  const rw0 = Math.max(0.6, titleEnd);
  const rw1 = rw0 + tokens.motion.rewind;
  const lineAt = rw1 + 0.15;
  const stamp = Math.max(lineAt + 0.6, dur - 1.25);
  return {peekAt, rw0, rw1, lineAt, stamp, hearts: stamp + 0.2};
};

const Replay: React.FC<ShotProps<P>> = ({params, t, dur, meta}) => {
  const tk = useTk();
  const pal = usePal();
  const box = useCardBox('hook');
  const clip = useStoryParams<{lines?: {speaker?: string; text: string; zh?: string}[]; key?: string; scene?: string; media?: string}>('clip');
  const mean = useStoryParams<{rows?: {kind: string; text: string}[]}>('meaningCard');
  const last = clip?.lines?.[clip.lines.length - 1];
  const line = params.line ?? last?.text ?? '';
  const zh = params.zh ?? last?.zh;
  const key = params.key ?? clip?.key;
  const meaning = params.meaning ?? mean?.rows?.find((r) => r.kind === 'eq')?.text;
  const title = params.title ?? pick(meta?.lang, '再听一遍', 'Hear it again');
  const pl = plan(params, dur);
  const items = useScreenItems(params.screenItems);
  const x0 = tk.layout?.marginLeft ?? 150;
  const rewinding = t >= pl.rw0 && t < pl.rw1;
  const pillOp = interpolate(t, [pl.lineAt, pl.lineAt + 0.1], [0, 1], clamp);
  const subY = box.y + box.h + (tk.layout?.underCardGap ?? 30);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: x0, top: 440, display: 'flex', alignItems: 'center', gap: 18, fontSize: 72, fontWeight: 900, color: pal.ink, lineHeight: 1.2, whiteSpace: 'nowrap'}}>
        <svg width={86} height={52} viewBox="0 0 64 34" style={{flexShrink: 0}}>
          <path d="M30 4 L6 17 L30 30 Z M58 4 L34 17 L58 30 Z" fill={pal.primary} stroke={pal.ink} strokeWidth={3} strokeLinejoin="round" />
        </svg>
        <span>
          <Lit text={title} t={t} t0={0.1} rate={9} />
        </span>
      </div>
      <MediaCard box={box} t={t} stage={{scene: params.scene ?? clip?.scene, media: params.media ?? clip?.media, rewind: rewinding, speaker: 'a', talkFrom: pl.lineAt, talkUntil: pl.lineAt + 1.6, items, phase: 'show', phaseAt: pl.lineAt - 0.1}}>
        <RewindBadge t={t} from={pl.rw0} to={pl.rw1} />
      </MediaCard>
      <Peek t={t} at={pl.peekAt} cardY={box.y} lit={t >= pl.stamp + 0.1} fx={t >= pl.hearts ? 'hearts' : undefined} fxT={t - pl.hearts} />
      <Sticker t={t} at={pl.stamp} text={params.sticker ?? pick(meta?.lang, '听懂了', 'Got it')} x={Math.min(box.x + box.w - 70, 850)} y={box.y + box.h - 50} />
      {meaning ? (
        <div style={{position: 'absolute', left: 150, width: 780, top: subY, display: 'flex', justifyContent: 'center', opacity: pillOp}}>
          <Pill text={`= ${meaning}`} bg={pal.highlight} color={pal.ink} size={30} style={{padding: '2px 18px'}} />
        </div>
      ) : null}
      {line ? <SubStack y={subY + (meaning ? 60 : 0)} t={t} t0={pl.lineAt} line={line} zh={zh} hot={key} hotAt={pl.lineAt} mode="ghost" /> : null}
    </div>
  );
};
export default Replay;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur);
  return [
    {at: 0, kind: 'swish', vol: 0.22},
    {at: pl.peekAt, kind: 'pu', vol: 0.22},
    {at: pl.rw0, kind: 'whoosh', vol: 0.22},
    {at: pl.stamp, kind: 'thud', vol: 0.42},
    {at: pl.stamp + 0.05, kind: 'bell', vol: 0.26},
  ];
};
