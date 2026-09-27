import React from 'react';
import {AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {clamp} from '../../core/anim';
import {FPS} from '../../core/safe';
import {useStyleTokens} from '../context';
import type {FilmProps} from '../types';
import {SHOTS} from './shots/index.gen';
import {StoryCtx} from './parts/story';
import {QuizVoiceSub} from './parts/voiceSub';

// ============================================================
// quiz 整片渲染器：固定机位的「App 界面」，镜头之间只有四种换场（tokens.transitions）：
//   cut 硬切 1 帧 / jump 版式跳切（硬切，配 swish）/ dim 压暗溶解（dimFrames 帧）/ pushUp 整页上滑（0.2 秒，easeInOutCubic）
// 另外给镜头一个「整片上下文」：后面的镜头能读到前面镜头的参数（片段卡沿用钩子标题、评论区沿用选项和答案），
// 便宜模型少填字段。ShotLab 单镜自测时上下文里只有这一镜，镜头自己给默认值。
// ============================================================

export type Trans = 'cut' | 'jump' | 'dim' | 'pushUp';

const Host: React.FC<{p: FilmProps; i: number; enter: Trans; leave: Trans | null; tail: number}> = ({p, i, enter, leave, tail}) => {
  const tk = useStyleTokens();
  const t = useCurrentFrame() / FPS;
  const slot = p.slots[i];
  const entry = SHOTS[slot.shot.type];
  const Comp = entry?.mod.default;
  const H = p.geo.h;
  const pu = tk.motion?.pushUp ?? 0.2;
  const dimS = (tk.motion?.dimFrames ?? 3) / FPS;
  let y = 0;
  let op = 1;
  let bright = 1;
  if (i > 0 && enter === 'pushUp') y += H * (1 - interpolate(t, [0, pu], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)}));
  if (i > 0 && enter === 'dim') op *= interpolate(t, [0, dimS], [0, 1], clamp);
  if (leave === 'pushUp') y -= H * interpolate(t, [slot.dur, slot.dur + pu], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  if (leave === 'dim') bright = interpolate(t, [slot.dur, slot.dur + dimS], [1, 0.55], clamp);
  const style: React.CSSProperties = {transform: y ? `translateY(${y}px)` : undefined, opacity: op, filter: bright < 1 ? `brightness(${bright})` : undefined};
  return (
    <StoryCtx.Provider value={{shots: p.sb.shots ?? [], index: i}}>
      <AbsoluteFill style={style}>
        {Comp ? (
          <Comp params={slot.shot.params || {}} t={t} dur={slot.dur} beat={p.beat} index={i} isLast={i === p.slots.length - 1} caption={slot.shot.caption} mood={slot.mood} meta={p.sb.meta} />
        ) : null}
      </AbsoluteFill>
    </StoryCtx.Provider>
  );
};

export const QuizFilm: React.FC<FilmProps> = (p) => {
  const tk = useStyleTokens();
  const trans = (type?: string): Trans => ((type && tk.transitions?.[type]) as Trans) || 'cut';
  const pu = tk.motion?.pushUp ?? 0.2;
  const dimS = (tk.motion?.dimFrames ?? 3) / FPS;
  return (
    <>
      {p.slots.map((s) => {
        const next = p.slots[s.i + 1];
        const leave = next ? trans(next.shot.type) : null;
        const tail = leave === 'pushUp' ? pu : leave === 'dim' ? dimS : 0;
        const from = Math.round(s.start * FPS);
        const len = Math.max(1, Math.round((s.dur + tail) * FPS));
        // 溶解时新镜要画在旧镜上面：Sequence 按顺序叠放，后面的在上，正好
        return (
          <Sequence key={s.i} from={from} durationInFrames={len} name={`${s.i + 1}-${s.shot.type}`}>
            <Host p={p} i={s.i} enter={trans(s.shot.type)} leave={leave} tail={tail} />
          </Sequence>
        );
      })}
      {/* 配音字幕（有 props.voice 才画；音轨和配乐闪避在 Promo.tsx 统一接） */}
      <QuizVoiceSub {...p} />
    </>
  );
};
