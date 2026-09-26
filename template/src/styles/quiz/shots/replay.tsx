import React from 'react';
import {interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Label, Lit, Seal, Sparks, TagRow, displayEm, litDur, usePal, useTk, useVoice} from '../parts/kit';
import {MediaCard, SubStack, TimecodeChip, useCardBox} from '../parts/media';
import {useScreenItems, useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / replay：回放复证。压暗溶解回到纸面。
// 标题（回环箭头 + 口吻里的「倒回去看 / 慢放一次 / 回放一下」，或 params.title）逐字 → 讲解小窗在卡右沿打开
// → 卡左上角的计时签往回数，画面倒放 0.5 秒 → 计时签往前走，重播那句台词；
// 卡下：杏黄书签形标签「= 正解」+ 引文块（关键词主色 + 马克笔）+ 译文；
// 最后朱红印章「批改」在卡下的「= 正解」标签右端（0.14 秒，1.35→1，-12°，字按口吻：过关 / 原来如此 / 拿下），旁边放火花。
// 这一镜不放讲解员小窗：卡里的两个角色自己把那句话再演一遍。
// 台词、关键词、正解不写就沿用 clip 和 meaningCard。
// ============================================================
type P = {title?: string; line?: string; zh?: string; key?: string; meaning?: string; sticker?: string; scene?: string; media?: string; screenItems?: string[]};

export const plan = (p: P, dur: number) => {
  const titleEnd = 0.1 + litDur(p.title ?? 'xxxx', 9);
  const hostAt = 0.26;
  const rw0 = Math.max(0.6, titleEnd);
  const rw1 = rw0 + tokens.motion.rewind;
  const lineAt = rw1 + 0.15;
  const stamp = Math.max(lineAt + 0.6, dur - 1.25);
  return {hostAt, rw0, rw1, lineAt, stamp, sparks: stamp + 0.2};
};

const Replay: React.FC<ShotProps<P>> = ({params, t, dur, meta}) => {
  const tk = useTk();
  const pal = usePal();
  const voice = useVoice(meta);
  const box = useCardBox('hook');
  const clip = useStoryParams<{lines?: {speaker?: string; text: string; zh?: string}[]; key?: string; scene?: string; media?: string}>('clip');
  const mean = useStoryParams<{rows?: {kind: string; text: string}[]}>('meaningCard');
  const hook = useStoryParams<{tag?: string; eyebrow?: string}>('phraseTitle');
  const last = clip?.lines?.[clip.lines.length - 1];
  const line = params.line ?? last?.text ?? '';
  const zh = params.zh ?? last?.zh;
  const key = params.key ?? clip?.key;
  const meaning = params.meaning ?? mean?.rows?.find((r) => r.kind === 'eq')?.text;
  const title = params.title ?? voice('replayTitle');
  const pl = plan(params, dur);
  const items = useScreenItems(params.screenItems);
  const x0 = tk.layout?.marginLeft ?? 150;
  const rewinding = t >= pl.rw0 && t < pl.rw1;
  const pillOp = interpolate(t, [pl.lineAt, pl.lineAt + 0.1], [0, 1], clamp);
  const subY = box.y + box.h + (tk.layout?.underCardGap ?? 34);
  // 印章压在「= 正解」标签右端（没有正解标签就压在卡下左侧），不盖在卡的角上
  const sealD = 128;
  const sealX = x0 + (meaning ? displayEm(`= ${meaning}`) * 34 + 40 + sealD * 0.42 : sealD / 2);
  const sealY = subY + 16;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <TagRow label={hook?.tag ?? voice('tag')} text={hook?.eyebrow} x={x0} y={tk.layout?.tagY ?? 262} />
      <div style={{position: 'absolute', left: x0, top: 420, display: 'flex', alignItems: 'center', gap: 20, fontSize: 70, fontWeight: 800, color: pal.ink, lineHeight: 1.2, whiteSpace: 'nowrap'}}>
        <svg width={76} height={76} viewBox="0 0 40 40" style={{flexShrink: 0, transform: `rotate(${rewinding ? -t * 700 : 0}deg)`}}>
          <path d="M31 13 A13 13 0 1 0 33 24" fill="none" stroke={pal.primary} strokeWidth={5.5} strokeLinecap="round" />
          <path d="M24 12 L32 13 L33 5" fill="none" stroke={pal.primary} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          <Lit text={title} t={t} t0={0.1} rate={9} />
        </span>
      </div>
      <MediaCard box={box} t={t} stage={{scene: params.scene ?? clip?.scene, media: params.media ?? clip?.media, rewind: rewinding, speaker: 'a', talkFrom: pl.lineAt, talkUntil: pl.lineAt + 1.6, items, phase: 'show', phaseAt: pl.lineAt - 0.1}}>
        <TimecodeChip t={t} from={pl.rw0} to={pl.rw1} />
      </MediaCard>
      {meaning ? (
        <div style={{position: 'absolute', left: x0, top: subY, opacity: pillOp}}>
          <Label text={`= ${meaning}`} bg={pal.highlight} color={pal.ink} size={34} />
        </div>
      ) : null}
      <Seal t={t} at={pl.stamp} text={params.sticker ?? voice('seal')} x={sealX} y={sealY} size={sealD} rot={-12} />
      <Sparks t={t} at={pl.sparks} x={sealX} y={sealY - 50} spread={120} />
      {line ? <SubStack y={subY + 92} t={t} t0={pl.lineAt} line={line} zh={zh} hot={key} hotAt={pl.lineAt} mode="ghost" /> : null}
    </div>
  );
};
export default Replay;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur);
  return [
    {at: 0, kind: 'swish', vol: 0.22},
    {at: pl.rw0, kind: 'whoosh', vol: 0.22},
    {at: pl.stamp, kind: 'thud', vol: 0.42},
    {at: pl.stamp + 0.05, kind: 'bell', vol: 0.26},
  ];
};
