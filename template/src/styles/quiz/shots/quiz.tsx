import React from 'react';
import {interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitLine} from '../../../core/fit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Lit, Mark, cardStyle, litDur, popScale, usePal, useTk} from '../parts/kit';
import {CaptionTag, Countdown, MediaCard, useCardBox} from '../parts/media';
import {useScreenItems, useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / quiz：提问 → 答题卡选项依次弹出 → 秒表倒数 3 拍 → 批改式揭晓（全片高潮）。
// 版式跳切：钩子标题、讲解小窗、卡下引文全撤，媒体卡跳到上方（y388），卡左下角出字幕签（关键词主色 + 马克笔）：
// 默认只放 clip 最后一句里含 key 的那半句（或 params.quizLine），出题时屏幕上不许有答案。
// 提问 9 字/秒打出；答题卡行依次弹出（0.27 秒，0→1.05→1，间隔 3 拍）；倒数是卡中央的墨色秒表，杏黄外圈每拍走空；
// 揭晓严格落在整拍上：正确项 1 帧切成主色整行 + 杏黄涂卡格 + 杏黄手写勾，0.2 秒放大到 1.03 回弹；错误项变灰 + 朱红小叉。
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
  const O0 = tk.layout?.option ?? {h: 104, gap: 22, stroke: 4, radius: 14, bubbleW: 84, bubbleH: 58, shadow: 6};
  const R = tk.motion?.reveal ?? {bump: 0.2, bumpScale: 1.03, mark: 0.14};
  const opts = (params.options ?? []).slice(0, 4);
  // 答题卡行放不进主体区（y ≤ 1340）时整体等比压扁（4 个选项时会用到），字号跟着 fitLine 走
  const top0 = box.y + box.h + 40;
  const room = 1340 - top0;
  const need = opts.length * O0.h + Math.max(0, opts.length - 1) * O0.gap;
  const kk = need > room ? room / need : 1;
  const O = {...O0, h: Math.floor(O0.h * kk), gap: Math.floor(O0.gap * kk)};
  const sub = params.quizLine ?? params.sub ?? quizLineOf(clip?.lines?.[clip.lines.length - 1]?.text ?? '', clip?.key);
  const items = useScreenItems(params.screenItems);
  const revealed = t >= pl.reveal;
  const x0 = tk.layout?.marginLeft ?? 150;
  const qs = fitLine(params.question ?? '', 780, tk.type?.question ?? 64, 50);
  const markP = interpolate(t, [pl.reveal, pl.reveal + (R.mark ?? 0.14)], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: x0, top: tk.layout?.tagY ?? 262, width: 780, fontSize: qs, fontWeight: 800, color: pal.ink, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
        <Lit text={params.question ?? ''} t={t} t0={pl.qAt} rate={tk.motion?.charsPerSec?.question ?? 9} mode="type" />
      </div>
      <MediaCard box={box} t={t} stage={{scene: params.scene ?? (clip ? clip.scene : hook?.scene), media: params.media ?? (clip ? clip.media : hook?.media), items, phase: 'ask', phaseAt: -1}}>
        <CaptionTag text={sub} hot={clip?.key} t={t} at={0.05} box={box} />
        <Countdown t={t} at={pl.cd} beat={beat} box={box} />
      </MediaCard>
      {opts.map((o, i) => {
        const at = pl.opts[i];
        if (t < at) return null;
        const s = popScale(t, at, tk.motion?.popIn?.dur ?? 0.27, 0, tk.motion?.popIn?.overshoot ?? 1.05);
        const right = i === params.answer;
        const bump = revealed && right ? interpolate(t, [pl.reveal, pl.reveal + R.bump / 2, pl.reveal + R.bump], [1, R.bumpScale, 1], clamp) : 1;
        // 答题卡一行：左边一个椭圆涂卡格（字母），右边选项字。揭晓：正确项整行变主色、涂卡格涂成杏黄、右端杏黄手写勾；
        // 错误项褪成灰字，右端一个朱红小叉（像老师批改）
        const good = revealed && right;
        const bad = revealed && !right;
        const fg = good ? pal.onPrimary : bad ? pal.wrong : pal.ink;
        const fs = fitLine(o, 780 - O.bubbleW - 170, tk.type?.option ?? 50, 38);
        return (
          <div key={i} style={{position: 'absolute', left: x0, width: 780, top: top0 + i * (O.h + O.gap), height: O.h, display: 'flex', alignItems: 'center', gap: 24, padding: '0 28px 0 22px', transform: `scale(${s * bump})`, transformOrigin: 'left center', opacity: bad ? interpolate(t, [pl.reveal, pl.reveal + (R.wrongFade ?? 0.1)], [1, 0.85], clamp) : 1, ...cardStyle(pal, {radius: O.radius, stroke: O.stroke, shadow: bad ? 0 : O.shadow, bg: good ? pal.primary : bad ? pal.cardAlt : pal.card, shadowColor: pal.ink})}}>
            <div style={{width: O.bubbleW, height: Math.min(O.bubbleH, O.h - 24), borderRadius: '50%', border: `4px solid ${good ? pal.ink : bad ? pal.wrong : pal.ink}`, background: good ? pal.highlight : pal.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: tk.font?.mono, fontSize: tk.type?.optionLetter ?? 36, fontWeight: 700, color: bad ? pal.wrong : pal.ink, flexShrink: 0, lineHeight: 1}}>
              {String.fromCharCode(65 + i)}
            </div>
            <div style={{flex: 1, fontSize: fs, fontWeight: 800, color: fg, whiteSpace: 'nowrap', lineHeight: 1.2}}>{o}</div>
            {revealed ? (
              <div style={{transform: good ? 'rotate(-6deg) translateY(-6px)' : undefined}}>
                <Mark kind={right ? 'check' : 'cross'} size={right ? 76 : 50} color={right ? pal.highlight : pal.pen} p={markP} stroke={right ? 11 : 9} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};export default Quiz;

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
