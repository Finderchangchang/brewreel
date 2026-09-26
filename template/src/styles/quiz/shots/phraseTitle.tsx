import React from 'react';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Lit, litDur, usePal, useTk, useVoice} from '../parts/kit';
import {HookHeader, MediaCard, PlayButton, Presenter, hookPlan, presenterSpot, useCardBox} from '../parts/media';
import {useScreenItems} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / phraseTitle：误解钩子（第 1 镜）。
// 第 0 帧就是钩子：题号签 + 短语已是实色（只做落定缩放），「= 误解」是 60% 幽灵字，语境句前 4 个字已亮，媒体卡已在位。
// 误解行逐字点实 → 朱红批改笔把它圈起来、甩出一个手写问号 → 讲解小窗在媒体卡右沿「光圈打开」
// → 卡下语境句余下的字逐字点亮（6 字/秒，左对齐）→ 最后 0.35 秒卡中央弹出播放键，下一镜（clip）开播。
// 题号签的字按口吻取（params.voice：exam / chat / show），也可以直接写 params.tag。
// ============================================================
type P = {tag?: string; voice?: string; eyebrow?: string; phrase: string; guess: string; context?: string; scene?: string; media?: string; screenItems?: string[]};

export const plan = (p: P, dur: number) => {
  const h = hookPlan(p.phrase ?? '', p.guess ?? '', tokens);
  const ctxAt = h.hostAt + 0.05;
  const ctxEnd = ctxAt + (p.context ? litDur(p.context, tokens.motion.charsPerSec.narration) : 0);
  const playAt = Math.max(h.hostAt + 0.3, dur - 0.42);
  return {...h, ctxAt, ctxEnd, playAt};
};

const PhraseTitle: React.FC<ShotProps<P>> = ({params, t, dur, meta}) => {
  const tk = useTk();
  const pal = usePal();
  const box = useCardBox('hook');
  const pl = plan(params, dur);
  const items = useScreenItems(params.screenItems);
  const voice = useVoice(meta);
  // 讲解员是卡下旁白的「说话人」标：圆形小窗停在旁白左边（不在卡的右沿 / 右上角），旁白往右让出位置
  const spot = presenterSpot(box, tk.layout?.presenter?.inset ?? 36);
  const underY = box.y + box.h + (tk.layout?.underCardGap ?? 34);
  const indent = spot.d + 2 * (tk.layout?.presenter?.ring ?? 8) + 24;
  const rate = tk.motion?.charsPerSec?.narration ?? 6;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <HookHeader t={t} tag={params.tag ?? voice('tag')} eyebrow={params.eyebrow} phrase={params.phrase ?? ''} guess={params.guess ?? ''} />
      <MediaCard box={box} t={t} stage={{scene: params.scene, media: params.media, items, phase: 'idle'}}>
        <PlayButton t={t} at={pl.playAt} box={box} />
      </MediaCard>
      <Presenter t={t} at={pl.hostAt} x={spot.x} y={spot.y} d={spot.d} talk={params.context ? [pl.ctxAt, pl.ctxEnd] : null} expr="thinking" />
      {params.context ? (
        <div style={{position: 'absolute', left: 150 + indent, width: 780 - indent, top: underY + 6, textAlign: 'left', fontSize: tk.type?.narration ?? 44, fontWeight: 700, color: pal.ink, lineHeight: 1.4}}>
          <Lit text={params.context} t={t} t0={pl.ctxAt - 4 / rate} rate={rate} pre={4} ghost={0.35} />
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
    {at: pl.qAt, kind: 'swish', vol: 0.2},
    {at: pl.hostAt, kind: 'pop', vol: 0.28},
    {at: pl.playAt + 0.25, kind: 'tap', vol: 0.3},
  ];
};
