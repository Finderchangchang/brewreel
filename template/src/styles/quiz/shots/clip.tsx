import React from 'react';
import type {SfxCue, ShotProps} from '../../../core/types';
import {litDur, useVoice} from '../parts/kit';
import {HookHeader, MediaCard, SubStack, useCardBox} from '../parts/media';
import {useScreenItems, useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / clip：证据片段。版式和钩子一模一样（题号签、标题、被圈起来的误解、讲解小窗都还在），
// 只有媒体卡里开播：小剧场里的角色开口说话（或播用户自备视频 / 截图），卡下左对齐引文块：
// 说话人等宽小签 / 原文逐词点亮（跟着嘴型）/ 译文。最后一句里的关键词变主色，杏黄马克笔 1.5 秒从左往右扫。
// 1–2 句对白，按时长平分；第二句换另一个角色说。
// ============================================================
type Line = {speaker?: string; text: string; zh?: string};
type P = {lines: Line[]; key?: string; scene?: string; media?: string; screenItems?: string[]};

const RATE = 3.2;

export const plan = (p: P, dur: number) => {
  const lines = (p.lines ?? []).slice(0, 2);
  const n = Math.max(1, lines.length);
  const slice = dur / n;
  return lines.map((l, i) => {
    const t0 = i * slice + 0.12;
    const d = litDur(l.text ?? '', RATE * 2, 0.3);
    const last = i === n - 1;
    const hotAt = last ? Math.min(t0 + d + 0.35, dur - 1.0) : undefined;
    return {t0, end: t0 + d, from: i * slice, to: (i + 1) * slice, hotAt};
  });
};

const Clip: React.FC<ShotProps<P>> = ({params, t, dur, meta}) => {
  const voice = useVoice(meta);
  const box = useCardBox('hook');
  const hook = useStoryParams<{tag?: string; eyebrow?: string; phrase: string; guess: string; scene?: string; media?: string}>('phraseTitle');
  const lines = (params.lines ?? []).slice(0, 2);
  const pl = plan(params, dur);
  const cur = Math.max(0, pl.findIndex((x) => t >= x.from && t < x.to));
  const k = t >= dur ? lines.length - 1 : cur;
  const L = lines[k];
  const P0 = pl[k];
  const who = k % 2 === 0 ? 'b' : 'a';
  const items = useScreenItems(params.screenItems);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {hook ? <HookHeader t={t} tag={hook.tag ?? voice('tag')} eyebrow={hook.eyebrow} phrase={hook.phrase ?? ''} guess={hook.guess ?? ''} lit /> : null}
      <MediaCard box={box} t={t} stage={{scene: params.scene ?? hook?.scene, media: params.media ?? hook?.media, speaker: who, talkFrom: P0?.t0 ?? 0, talkUntil: P0?.end ?? 0, items, phase: 'ask', phaseAt: 0.3}} />
      {L ? (
        <SubStack key={k} y={box.y + box.h + (tokens.layout.underCardGap ?? 30)} t={t} t0={P0.t0} speaker={L.speaker} line={L.text ?? ''} zh={L.zh} hot={k === lines.length - 1 ? params.key : undefined} hotAt={P0.hotAt} rate={RATE} />
      ) : null}
    </div>
  );
};
export default Clip;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur);
  const last = pl[pl.length - 1];
  return last?.hotAt !== undefined ? [{at: last.hotAt, kind: 'ding', vol: 0.18}] : [];
};
