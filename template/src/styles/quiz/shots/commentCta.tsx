import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitLine} from '../../../core/fit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Avatar} from '../parts/cast';
import {Lit, Sparks, TagRow, cardStyle, litDur, popScale, prog, usePal, useTk, useVoice} from '../parts/kit';
import {useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / commentCta：评论区交卷。整页上滑进场。
// 大提问逐字 → 「答题卡」一行椭圆涂卡格逐个弹出（正确项的字母用主色），铅笔把陷阱项那一格涂黑（多数人会选的那个）
// → 提示行（朱红下箭头 + 口吻里的提示句）→ 仿评论框：头像 + 打字（带光标）+ 朱红「交卷」键
// → 框下面贴出 2–3 张别人的便签评论（杏黄便签 + 胶带，微微歪着）
// → 最后 0.1 秒交卷键长成一枚朱红方章、转着铺满全屏（印章擦除），下一镜 brandEnd 把它收回成落版卡上的印章。
// 字母和答案不写就沿用 quiz；提示、预填、便签的字不写按口吻（phraseTitle.voice）。
// ============================================================
const Q_RATE = 14;
type P = {question: string; hint?: string; prefill?: string; footnote?: string; letters?: number; answer?: number; comments?: string[]};

// 这一镜只有 3 秒多：提问 14 字/秒快打，涂卡格、提示、打字、便签都在前 2 秒内出齐，擦除前能看清
export const plan = (p: P, dur: number) => {
  const qEnd = 0.05 + litDur(p.question ?? '', Q_RATE);
  const lettersAt = qEnd + 0.05;
  const hintAt = lettersAt + 0.3;
  const typeAt = Math.min(hintAt + 0.3, dur - 1.8);
  const fillAt = lettersAt + 0.35;
  const blob = dur - tokens.motion.sealWipe.grow;
  const cAt = [0, 1, 2].map((k) => Math.min(typeAt + 0.25 + k * 0.3, dur - 0.7 + k * 0.1));
  return {qEnd, lettersAt, hintAt, typeAt, fillAt, blob, cAt};
};

/** 铅笔涂卡：在椭圆里来回排线，从左往右涂满 */
const PencilFill: React.FC<{w: number; h: number; p: number; color: string}> = ({w, h, p, color}) => {
  const n = 9;
  const id = React.useId().replace(/:/g, '');
  let d = '';
  for (let i = 0; i < n; i++) {
    const x0 = (w / n) * i;
    const x1 = x0 + w / n;
    d += i === 0 ? `M${x0} ${h}` : '';
    d += ` L${x1} 0 L${x1 + w / n / 2} ${h}`;
  }
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      <defs>
        <clipPath id={`pf${id}`}>
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 6} ry={h / 2 - 6} />
        </clipPath>
      </defs>
      <g clipPath={`url(#pf${id})`}>
        <path d={d} fill="none" stroke={color} strokeWidth={h * 0.34} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={0.88} />
      </g>
    </svg>
  );
};

const CommentCta: React.FC<ShotProps<P>> = ({params, t, dur, meta}) => {
  const tk = useTk();
  const pal = usePal();
  const voice = useVoice(meta);
  const quiz = useStoryParams<{options?: string[]; answer?: number}>('quiz');
  const hook = useStoryParams<{guess?: string; tag?: string}>('phraseTitle');
  const n = Math.max(2, Math.min(4, params.letters ?? quiz?.options?.length ?? 3));
  const ans = params.answer ?? quiz?.answer ?? 1;
  const trapIdx = quiz?.options?.findIndex((o) => o === hook?.guess) ?? -1;
  const trapI = trapIdx >= 0 ? trapIdx : 0;
  const trap = String.fromCharCode(65 + trapI);
  const right = String.fromCharCode(65 + ans);
  const vars = {trap, right};
  const prefill = params.prefill ?? voice('prefill', vars);
  const comments = (params.comments?.length ? params.comments : voice.list('comments', vars)).slice(0, 3);
  const pl = plan(params, dur);
  const C = tk.layout?.comment ?? {y: 840, h: 150, radius: 16, stroke: 4, avatar: 96, send: 96};
  const x0 = tk.layout?.marginLeft ?? 150;
  const qs = fitLine(params.question ?? '', 780, tk.type?.ctaQuestion ?? 70, 52);
  const hint = params.hint ?? voice('hint');
  const hs = fitLine(hint, 700, 44, 34);
  // 答题卡：椭圆涂卡格
  const sheetY = 470;
  const bw = 150;
  const bh = 96;
  const gap = n > 3 ? 24 : 40;
  // 印章擦除：从交卷键中心长出一枚转着的朱红方章，0.1 秒盖满全屏
  const sendCx = 150 + 780 - 28 - C.send / 2;
  const sendCy = C.y + C.h / 2;
  const W = tk.motion?.sealWipe ?? {grow: 0.1, rot: 8};
  const blobP = interpolate(t, [pl.blob, dur], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const side = C.send + blobP * 2900;
  const armed = t >= pl.blob - 0.2;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <TagRow label={hook?.tag ?? voice('tag')} x={x0} y={tk.layout?.tagY ?? 262} />
      <div style={{position: 'absolute', left: x0, top: tk.layout?.titleY ?? 344, width: 780, fontSize: qs, fontWeight: 800, color: pal.ink, lineHeight: 1.25, whiteSpace: 'nowrap'}}>
        <Lit text={params.question ?? ''} t={t} t0={0.05} rate={Q_RATE} mode="type" />
      </div>
      {/* 答题卡 */}
      <div style={{position: 'absolute', left: x0, top: sheetY, width: 780, height: 200, ...cardStyle(pal, {radius: 14, stroke: 4, shadow: 8})}}>
        <div style={{position: 'absolute', left: 22, top: 14, fontFamily: tk.font?.mono, fontSize: tk.type?.tag ?? 28, fontWeight: 700, color: pal.ink, opacity: 0.7, letterSpacing: tk.font?.tagTracking ?? '0.08em', lineHeight: 1.2}}>{voice('sheet')}</div>
        <div style={{position: 'absolute', left: 30, top: 70, display: 'flex', gap}}>
          {Array.from({length: n}).map((_, i) => {
            const at = pl.lettersAt + i * 0.12;
            const s = popScale(t, at, 0.2, 0, 1.12);
            const isTrap = i === trapI;
            const fp = isTrap ? prog(t, pl.fillAt, 0.45, Easing.inOut(Easing.quad)) : 0;
            return (
              <div key={i} style={{position: 'relative', width: bw, height: bh, borderRadius: '50%', border: `5px solid ${pal.ink}`, background: pal.card, boxSizing: 'border-box', transform: `scale(${s})`, opacity: t >= at ? 1 : 0}}>
                {fp > 0 ? <PencilFill w={bw - 10} h={bh - 10} p={fp} color={pal.ink} /> : null}
                <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: tk.font?.mono, fontSize: tk.type?.sheetLetter ?? 56, fontWeight: 700, lineHeight: 1, color: fp > 0.6 ? pal.card : i === ans ? pal.primary : pal.ink}}>
                  {String.fromCharCode(65 + i)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* 提示行 */}
      <div style={{position: 'absolute', left: x0, top: 724, fontSize: hs, fontWeight: 800, color: pal.ink, lineHeight: 1.3, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 14}}>
        <svg width={44} height={54} viewBox="0 0 30 40" style={{opacity: t >= pl.hintAt ? 1 : 0, transform: `translateY(${Math.sin(t * 7) * 5}px)`}}>
          <path d="M15 4 C14 14 16 24 15 34 M5 24 C9 28 12 31 15 34 C18 31 21 28 25 23" fill="none" stroke={pal.pen} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          <Lit text={hint} t={t} t0={pl.hintAt} rate={tk.motion?.charsPerSec?.narration ?? 6} mode="type" />
        </span>
      </div>
      {/* 仿评论框 */}
      <div style={{position: 'absolute', left: x0, width: 780, top: C.y, height: C.h, display: 'flex', alignItems: 'center', gap: 22, padding: '0 28px', ...cardStyle(pal, {radius: C.radius, stroke: C.stroke, shadow: 8})}}>
        <Avatar who="a" size={C.avatar} t={t} />
        <div style={{flex: 1, fontSize: tk.type?.comment ?? 42, fontWeight: 700, color: pal.ink, whiteSpace: 'nowrap', lineHeight: 1.2}}>
          <Lit text={prefill} t={t} t0={pl.typeAt} rate={tk.motion?.charsPerSec?.typing ?? 7} mode="type" caret />
        </div>
        <div style={{width: C.send, height: C.send, borderRadius: 18, background: armed ? pal.pen : pal.card, border: `4px solid ${pal.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <svg width={50} height={50} viewBox="0 0 40 40">
            <path d="M20 6 L20 24 M12 16 L20 24 L28 16 M8 31 L32 31" fill="none" stroke={armed ? pal.card : pal.pen} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {/* 别人的评论：杏黄便签 + 胶带，依次贴上 */}
      {comments.map((c, i) => {
        const at = pl.cAt[i];
        const s = popScale(t, at, 0.2, 0, 1.06);
        const rot = i % 2 ? 2.5 : -3;
        const fs = fitLine(c, 520, tk.type?.note ?? 40, 34);
        return (
          <div key={i} style={{position: 'absolute', left: x0 + (i % 2) * 150, top: C.y + C.h + 44 + i * 112, display: 'flex', alignItems: 'center', gap: 16, opacity: t >= at ? 1 : 0, transform: `scale(${s}) rotate(${rot}deg)`, transformOrigin: 'left center'}}>
            <Avatar who={i % 2 === 0 ? 'b' : 'a'} size={64} t={t} />
            <div style={{position: 'relative', padding: '12px 26px', background: pal.highlight, border: `3px solid ${pal.ink}`, borderRadius: 3, boxShadow: `5px 5px 0 ${pal.ink}`, fontSize: fs, fontWeight: 800, color: pal.ink, lineHeight: 1.2, whiteSpace: 'nowrap'}}>
              <div style={{position: 'absolute', left: '50%', top: -14, width: 84, height: 24, marginLeft: -42, background: pal.card, opacity: 0.8, transform: `rotate(${-rot * 1.5}deg)`, border: `2px solid ${pal.ink}`, boxSizing: 'border-box'}} />
              {c}
            </div>
            {i === 0 ? <Sparks t={t} at={at + 0.15} x={620} y={30} spread={80} /> : null}
          </div>
        );
      })}
      {params.footnote && comments.length < 3 ? (
        <div style={{position: 'absolute', left: x0, width: 780, top: C.y + C.h + 44 + comments.length * 112 + 14, textAlign: 'left', fontSize: tk.type?.footnote ?? 28, fontWeight: 700, color: pal.ink, opacity: interpolate(t, [pl.typeAt + 0.5, pl.typeAt + 0.7], [0, 0.7], clamp)}}>{params.footnote}</div>
      ) : null}
      {t >= pl.blob ? <div style={{position: 'absolute', left: sendCx - side / 2, top: sendCy - side / 2, width: side, height: side, borderRadius: side * 0.14, background: pal.pen, transform: `rotate(${blobP * (W.rot ?? 8)}deg)`}} /> : null}
    </div>
  );
};
export default CommentCta;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur);
  return [
    {at: 0, kind: 'swish', vol: 0.24},
    {at: pl.lettersAt, kind: 'pop', vol: 0.24},
    {at: pl.fillAt, kind: 'tick', vol: 0.14},
    {at: pl.typeAt + 0.1, kind: 'tick', vol: 0.12},
    {at: pl.typeAt + 0.5, kind: 'tick', vol: 0.12},
    {at: pl.typeAt + 0.9, kind: 'tick', vol: 0.12},
    {at: pl.blob - 0.05, kind: 'whoosh', vol: 0.34},
  ];
};
