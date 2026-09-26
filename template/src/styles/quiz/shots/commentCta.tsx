import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {pick} from '../../../core/kit';
import {fitLine} from '../../../core/fit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Avatar} from '../parts/cast';
import {Hearts, Lit, litDur, popScale, usePal, useTk} from '../parts/kit';
import {useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / commentCta：评论区互动（参考片 37.4–40.4 秒）。整页上滑进场。
// 大提问逐字 → 大号 A B C 逐个弹出（答案字母用主色）→ 提示行「评论区打个字母 ↓」→ 仿评论框：头像 + 打字（带闪烁光标）+ 主色发送键
// → 最后 0.1 秒发送键变成亮色圆，膨胀铺满全屏（圆形擦除），下一镜 brandEnd 接着把它缩回成一个点。
// → 评论框下面依次弹出 2–3 条别人的评论（默认「<答案字母>！」「我也选了 <陷阱项字母>……」，可用 params.comments 自己写）。
// 字母和答案不写就沿用 quiz 镜头；预填评论默认「我选了 <陷阱项字母>……」。
// ============================================================
// i18n-ignore：默认提示语的两种语言，上屏时经 pick() 选
const DEF_HINT = {zh: '评论区打个字母', en: 'Drop a letter below'};
const Q_RATE = 14;
type P = {question: string; hint?: string; prefill?: string; footnote?: string; letters?: number; answer?: number; comments?: string[]};

// 这一镜只有 3 秒多：提问 14 字/秒快打，字母、提示、打字、别人的评论都在前 2 秒内出齐，擦除前能看清
export const plan = (p: P, dur: number) => {
  const qEnd = 0.05 + litDur(p.question ?? '', Q_RATE);
  const lettersAt = qEnd + 0.05;
  const hintAt = lettersAt + 0.3;
  const typeAt = Math.min(hintAt + 0.3, dur - 1.8);
  const blob = dur - tokens.motion.blob.grow;
  // 评论框下面依次弹出 2–3 条「别人的评论」（和参考片的评论区对上），在擦除前都要出完
  const cAt = [0, 1, 2].map((k) => Math.min(typeAt + 0.25 + k * 0.3, dur - 0.7 + k * 0.1));
  return {qEnd, lettersAt, hintAt, typeAt, blob, cAt};
};

const CommentCta: React.FC<ShotProps<P>> = ({params, t, dur, meta}) => {
  const tk = useTk();
  const pal = usePal();
  const quiz = useStoryParams<{options?: string[]; answer?: number}>('quiz');
  const hook = useStoryParams<{guess?: string}>('phraseTitle');
  const n = Math.max(2, Math.min(4, params.letters ?? quiz?.options?.length ?? 3));
  const ans = params.answer ?? quiz?.answer ?? 1;
  const trapIdx = quiz?.options?.findIndex((o) => o === hook?.guess) ?? -1;
  const trap = String.fromCharCode(65 + (trapIdx >= 0 ? trapIdx : 0));
  const prefill = params.prefill ?? `${pick(meta?.lang, '我选了', 'I picked')} ${trap}……`;
  const right = String.fromCharCode(65 + ans);
  const comments = (params.comments?.length ? params.comments : [pick(meta?.lang, `${right}！`, `${right}!`), pick(meta?.lang, `我也选了 ${trap}……`, `I also picked ${trap}…`)]).slice(0, 3);
  const pl = plan(params, dur);
  const C = tk.layout?.comment ?? {y: 780, h: 172, radius: 56, stroke: 4, avatar: 104, send: 92};
  const x0 = tk.layout?.marginLeft ?? 150;
  const qs = fitLine(params.question ?? '', 780, tk.type?.ctaQuestion ?? 80, 56);
  const hint = params.hint ?? pick(meta?.lang, DEF_HINT.zh, DEF_HINT.en);
  // 圆形擦除：从发送键中心长出，0.1 秒盖满全屏
  const sendCx = 930 - 30 - C.send / 2;
  const sendCy = C.y + C.h / 2;
  const blobP = interpolate(t, [pl.blob, dur], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const blobR = C.send / 2 + blobP * 1400;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: x0, top: 330, width: 780, fontSize: qs, fontWeight: 900, color: pal.ink, lineHeight: 1.25, whiteSpace: 'nowrap'}}>
        <Lit text={params.question ?? ''} t={t} t0={0.05} rate={Q_RATE} mode="type" />
      </div>
      <div style={{position: 'absolute', left: x0, top: 450, display: 'flex', gap: 44, fontSize: tk.type?.abc ?? 128, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em'}}>
        {Array.from({length: n}).map((_, i) => {
          const at = pl.lettersAt + i * 0.12;
          const s = popScale(t, at, 0.2, 0, 1.12);
          return (
            <span key={i} style={{color: i === ans ? pal.primary : pal.ink, transform: `scale(${s})`, display: 'inline-block', opacity: t >= at ? 1 : 0}}>
              {String.fromCharCode(65 + i)}
            </span>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: x0, top: 624, fontSize: 48, fontWeight: 800, color: pal.ink, lineHeight: 1.3, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 14}}>
        <span>
          <Lit text={hint} t={t} t0={pl.hintAt} rate={tk.motion?.charsPerSec?.narration ?? 6} mode="type" />
        </span>
        <svg width={40} height={52} viewBox="0 0 30 40" style={{opacity: t >= pl.hintAt + 0.3 ? 1 : 0, transform: `translateY(${Math.sin(t * 7) * 5}px)`}}>
          <path d="M15 4 L15 34 M4 23 L15 34 L26 23" fill="none" stroke={pal.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {/* 仿评论框 */}
      <div style={{position: 'absolute', left: 150, width: 780, top: C.y, height: C.h, borderRadius: C.radius, background: pal.card, border: `${C.stroke}px solid ${pal.ink}`, boxShadow: '0 20px 60px rgba(20,33,62,0.10)', display: 'flex', alignItems: 'center', gap: 22, padding: '0 30px', boxSizing: 'border-box'}}>
        <Avatar who="a" size={C.avatar} t={t} />
        <div style={{flex: 1, fontSize: tk.type?.comment ?? 44, fontWeight: 700, color: pal.ink, whiteSpace: 'nowrap', lineHeight: 1.2}}>
          <Lit text={prefill} t={t} t0={pl.typeAt} rate={tk.motion?.charsPerSec?.typing ?? 7} mode="type" caret />
        </div>
        <div style={{width: C.send, height: C.send, borderRadius: '50%', background: t >= pl.blob - 0.2 ? pal.highlight : pal.primary, border: `4px solid ${pal.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <svg width={44} height={44} viewBox="0 0 40 40">
            <path d="M8 20 L32 20 M22 10 L32 20 L22 30" fill="none" stroke={t >= pl.blob - 0.2 ? pal.ink : pal.card} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {/* 别人的评论：头像 + 一句，依次弹出 */}
      {comments.map((c, i) => {
        const at = pl.cAt[i];
        const s = popScale(t, at, 0.2, 0, 1.06);
        return (
          <div key={i} style={{position: 'absolute', left: 150, width: 780, top: C.y + C.h + 34 + i * 104, height: 88, display: 'flex', alignItems: 'center', gap: 18, opacity: t >= at ? 1 : 0, transform: `scale(${s})`, transformOrigin: 'left center'}}>
            <Avatar who={i % 2 === 0 ? 'b' : 'a'} size={72} t={t} />
            <div style={{padding: '10px 26px', borderRadius: 26, background: pal.card, border: `3px solid ${pal.ink}`, fontSize: tk.type?.comment ?? 44, fontWeight: 800, color: pal.ink, lineHeight: 1.2, whiteSpace: 'nowrap'}}>{c}</div>
            {i === 0 ? <Hearts t={t} at={at + 0.15} x={700} y={40} spread={80} /> : null}
          </div>
        );
      })}
      {params.footnote && comments.length < 3 ? (
        <div style={{position: 'absolute', left: 150, width: 780, top: C.y + C.h + 34 + comments.length * 104 + 10, textAlign: 'left', fontSize: tk.type?.footnote ?? 28, fontWeight: 700, color: pal.ink, opacity: interpolate(t, [pl.typeAt + 0.5, pl.typeAt + 0.7], [0, 0.7], clamp)}}>{params.footnote}</div>
      ) : null}
      {t >= pl.blob ? <div style={{position: 'absolute', left: sendCx - blobR, top: sendCy - blobR, width: blobR * 2, height: blobR * 2, borderRadius: '50%', background: pal.highlight}} /> : null}
    </div>
  );
};
export default CommentCta;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur);
  return [
    {at: 0, kind: 'swish', vol: 0.24},
    {at: pl.lettersAt, kind: 'pop', vol: 0.24},
    {at: pl.typeAt + 0.1, kind: 'tick', vol: 0.12},
    {at: pl.typeAt + 0.5, kind: 'tick', vol: 0.12},
    {at: pl.typeAt + 0.9, kind: 'tick', vol: 0.12},
    {at: pl.blob - 0.05, kind: 'whoosh', vol: 0.34},
  ];
};
