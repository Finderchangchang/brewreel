import React from 'react';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Lit, litDur, usePal, useTk} from '../parts/kit';
import {HookHeader, MediaCard, Peek, PlayButton, hookPlan, useCardBox} from '../parts/media';
import {useScreenItems} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / phraseTitle：误解钩子（参考片 0–6.3 秒）。
// 第 0 帧就是钩子：短语已是实色（只做落定缩放），「= 误解 ?」是 60% 幽灵字（motion.hookGhost），语境句前 4 个字已亮，媒体卡已在位。
// 误解行逐字点实 → 问号块变亮色 → 0.38 秒后吉祥物从卡片上沿探头（0.17 秒回弹）
// → 卡下语境句余下的字逐字点亮（6 字/秒）→ 最后 0.35 秒卡中央弹出播放键，下一镜（clip）开播。
// ============================================================
type P = {eyebrow?: string; phrase: string; guess: string; context?: string; scene?: string; media?: string; screenItems?: string[]};

export const plan = (p: P, dur: number) => {
  const h = hookPlan(p.phrase ?? '', p.guess ?? '', tokens);
  const ctxAt = h.peekAt + 0.05;
  const ctxEnd = ctxAt + (p.context ? litDur(p.context, tokens.motion.charsPerSec.narration) : 0);
  const playAt = Math.max(h.peekAt + 0.3, dur - 0.42);
  return {...h, ctxAt, ctxEnd, playAt};
};

const PhraseTitle: React.FC<ShotProps<P>> = ({params, t, dur}) => {
  const tk = useTk();
  const pal = usePal();
  const box = useCardBox('hook');
  const pl = plan(params, dur);
  const items = useScreenItems(params.screenItems);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <HookHeader t={t} eyebrow={params.eyebrow} phrase={params.phrase ?? ''} guess={params.guess ?? ''} />
      <MediaCard box={box} t={t} stage={{scene: params.scene, media: params.media, items, phase: 'idle'}}>
        <PlayButton t={t} at={pl.playAt} box={box} />
      </MediaCard>
      <Peek t={t} at={pl.peekAt} cardY={box.y} />
      {params.context ? (
        <div style={{position: 'absolute', left: 150, width: 780, top: box.y + box.h + (tk.layout?.underCardGap ?? 30), textAlign: 'center', fontSize: tk.type?.narration ?? 46, fontWeight: 700, color: pal.ink, lineHeight: 1.4}}>
          <Lit text={params.context} t={t} t0={pl.ctxAt - 4 / (tk.motion?.charsPerSec?.narration ?? 6)} rate={tk.motion?.charsPerSec?.narration ?? 6} pre={4} ghost={0.35} />
        </div>
      ) : null}
    </div>
  );
};
export default PhraseTitle;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur);
  return [
    {at: pl.guessAt, kind: 'tick', vol: 0.16},
    {at: pl.qAt, kind: 'pop', vol: 0.3},
    {at: pl.peekAt, kind: 'pu', vol: 0.26},
    {at: pl.playAt + 0.25, kind: 'tap', vol: 0.3},
  ];
};
