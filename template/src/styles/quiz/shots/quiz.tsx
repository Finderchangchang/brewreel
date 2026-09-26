import React from 'react';
import {interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitLine} from '../../../core/fit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Lit, Mark, litDur, popScale, usePal, useTk} from '../parts/kit';
import {BurnedSub, Countdown, MediaCard, useCardBox} from '../parts/media';
import {useScreenItems, useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / quiz：提问 → 选项依次弹出 → 倒数 3 拍 → 揭晓（参考片 10.8–20.3 秒，全片高潮）。
// 版式跳切：钩子标题、吉祥物、卡下字幕全撤，媒体卡跳到上方（y384），卡内出烧录字幕条（关键词亮色）：
// 默认只放 clip 最后一句里含 key 的那半句（或 params.quizLine），出题时屏幕上不许有答案。
// 提问 9 字/秒打出；选项卡依次弹出（0.27 秒，0→1.05→1，间隔 3 拍）；倒数一拍一个亮色大数字（1.35→1）；
// 揭晓严格落在整拍上：正确项 1 帧切成亮色底 + 深色勾，0.2 秒放大到 1.03 回弹；错误项变灰 + 暖灰 ×。
// 时间表按时长倒推：揭晓 = 结束前 ≥1.5 秒的最后一个整拍，倒数在它前面 3 拍，选项均匀排在提问和倒数之间。
// ============================================================
type P = {question: string; options: string[]; answer: number; sub?: string; quizLine?: string; scene?: string; media?: string; screenItems?: string[]};

/** 出题时卡里字幕条默认只放 clip 最后一句里含 key 的那半句（不搬整句：后半句常常就是答案）。
 *  和 styles/quiz/checks.mjs 的 quizLineOf 同一规则 */
export const quizLineOf = (line: string, key?: string) => {
  const parts = (line ?? '').split(/[，,。.!！?？；;：:（）()]/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return '';
  if (key) return parts.find((s) => s.includes(key)) ?? key;
  return parts[0];
};

export const plan = (p: P, dur: number, beat: number) => {
  const n = Math.max(1, (p.options ?? []).length);
  const qAt = 0.12;
  const qEnd = qAt + litDur(p.question ?? '', tokens.motion.charsPerSec.question);
  const reveal = Math.max(Math.ceil((qEnd + 1.2 + 3 * beat) / beat), Math.floor((dur - 1.5) / beat)) * beat;
  const cd = reveal - 3 * beat;
  const opt0 = qEnd + 0.3;
  const room = cd - 2 * beat - 0.27 - opt0;
  const gap = n > 1 ? Math.max(0.45, Math.min(tokens.rhythm.optionGapBeats * beat, room / (n - 1))) : 0;
  const opts = Array.from({length: n}, (_, i) => opt0 + i * gap);
  return {qAt, qEnd, opts, cd, reveal};
};

const Quiz: React.FC<ShotProps<P>> = ({params, t, dur, beat}) => {
  const tk = useTk();
  const pal = usePal();
  const box = useCardBox('quiz');
  const clip = useStoryParams<{lines?: {text: string}[]; key?: string; scene?: string; media?: string}>('clip');
  const hook = useStoryParams<{scene?: string; media?: string}>('phraseTitle');
  const pl = plan(params, dur, beat);
  const O0 = tk.layout?.option ?? {h: 108, gap: 20, stroke: 4, radius: 26, letterD: 72, letterStroke: 3};
  const R = tk.motion?.reveal ?? {bump: 0.2, bumpScale: 1.03};
  const opts = (params.options ?? []).slice(0, 4);
  // 选项卡放不进主体区（y ≤ 1340）时整体等比压扁（4 个选项时会用到），字号跟着 fitLine 走
  const room = 1340 - (box.y + box.h + 32);
  const need = opts.length * O0.h + Math.max(0, opts.length - 1) * O0.gap;
  const kk = need > room ? room / need : 1;
  const O = {...O0, h: Math.floor(O0.h * kk), gap: Math.floor(O0.gap * kk)};
  const sub = params.quizLine ?? params.sub ?? quizLineOf(clip?.lines?.[clip.lines.length - 1]?.text ?? '', clip?.key);
  const items = useScreenItems(params.screenItems);
  const revealed = t >= pl.reveal;
  const x0 = tk.layout?.marginLeft ?? 150;
  const qs = fitLine(params.question ?? '', 780, tk.type?.question ?? 68, 52);
  const top0 = box.y + box.h + 32;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: x0, top: tk.layout?.eyebrowY ?? 270, width: 780, fontSize: qs, fontWeight: 900, color: pal.ink, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
        <Lit text={params.question ?? ''} t={t} t0={pl.qAt} rate={tk.motion?.charsPerSec?.question ?? 9} mode="type" />
      </div>
      <MediaCard box={box} t={t} stage={{scene: params.scene ?? (clip ? clip.scene : hook?.scene), media: params.media ?? (clip ? clip.media : hook?.media), items, phase: 'ask', phaseAt: -1}}>
        <BurnedSub text={sub} hot={clip?.key} t={t} at={0.05} box={box} />
        <Countdown t={t} at={pl.cd} beat={beat} box={box} />
      </MediaCard>
      {opts.map((o, i) => {
        const at = pl.opts[i];
        if (t < at) return null;
        const s = popScale(t, at, tk.motion?.popIn?.dur ?? 0.27, 0, tk.motion?.popIn?.overshoot ?? 1.05);
        const right = i === params.answer;
        const bump = revealed && right ? interpolate(t, [pl.reveal, pl.reveal + R.bump / 2, pl.reveal + R.bump], [1, R.bumpScale, 1], clamp) : 1;
        const bg = revealed ? (right ? pal.highlight : pal.cardAlt) : pal.card;
        const fg = revealed && !right ? pal.wrong : pal.ink;
        const line = revealed && !right ? pal.wrong : pal.ink;
        const fs = fitLine(o, 780 - O.letterD - 150, tk.type?.option ?? 54, 40);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 150,
              width: 780,
              top: top0 + i * (O.h + O.gap),
              height: O.h,
              borderRadius: O.radius,
              background: bg,
              border: `${O.stroke}px solid ${line}`,
              boxShadow: tk.layout?.option?.shadow,
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              padding: '0 26px',
              boxSizing: 'border-box',
              transform: `scale(${s * bump})`,
            }}
          >
            <div style={{width: O.letterD, height: O.letterD, borderRadius: '50%', border: `${O.letterStroke}px solid ${line}`, background: revealed && right ? pal.card : pal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: tk.type?.optionLetter ?? 40, fontWeight: 900, color: fg, flexShrink: 0}}>
              {String.fromCharCode(65 + i)}
            </div>
            <div style={{flex: 1, fontSize: fs, fontWeight: 800, color: fg, whiteSpace: 'nowrap', lineHeight: 1.2}}>{o}</div>
            {revealed ? <Mark kind={right ? 'check' : 'cross'} size={58} color={right ? pal.ink : pal.cross} p={interpolate(t, [pl.reveal, pl.reveal + (R.mark ?? 0.1)], [0, 1], clamp)} /> : null}
          </div>
        );
      })}
    </div>
  );
};
export default Quiz;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur, ctx.beat);
  return [
    {at: 0, kind: 'swish', vol: 0.24},
    ...pl.opts.map((at) => ({at: Math.max(0, at - 0.08), kind: 'pop', vol: 0.3})),
    ...[0, 1, 2].map((k) => ({at: pl.cd + k * ctx.beat, kind: 'tick', vol: k === 2 ? 0.34 : 0.28})),
    {at: pl.cd + 0.1, kind: 'whoosh', vol: 0.14},
    {at: pl.reveal, kind: 'ding', vol: 0.36},
    {at: pl.reveal, kind: 'thud', vol: 0.4},
  ];
};
