import React from 'react';
import {bump, pop} from '../core/anim';
import {emWidth} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {pick} from '../core/kit';
import type {Lang} from '../core/kit';
import {CARD, MAIN} from '../core/safe';
import {alpha, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// reviewCard：真实顾客评价摘录。纯图形卡片（design §1.4：本来就没有照片版本）。
// 主角 = 星级一颗一颗点亮（不是静态贴一排星星），配合大引号 + 原文 + 首字圆标（不用真人头像）。
// 1 条评价：单张大卡居中；2 条：上下两张卡依次飞入。
// ============================================================
type Quote = {text?: string; month?: string; stars?: number; who?: string};
type P = {quotes?: Quote[]; evidence?: string};

const GAP = 24;
const STAR_D = 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z';

// ---------- 版面 ----------
const geom = (n: number) => {
  const cardH = n <= 1 ? 560 : Math.floor((MAIN.h - GAP) / 2);
  const total = cardH * n + GAP * (n - 1);
  const y0 = MAIN.y0 + Math.round((MAIN.h - total) / 2);
  return {cardH, y0};
};

// ---------- 时间线：卡片依次飞入，每张卡内的星星再依次点亮 ----------
export const plan = (n: number, beat: number) => {
  const step = beat * 2; // 120bpm 下 1 秒一张卡
  return Array.from({length: n}, (_, i) => i * step);
};

// ---------- 自适应引文字号（按可用宽高估算换行数，不依赖字体加载） ----------
const fitQuote = (text: string, w: number, maxLines: number, big: boolean) => {
  const em = emWidth(text);
  const maxSize = big ? 48 : 40;
  const minSize = 34;
  for (let s = maxSize; s >= minSize; s -= 2) {
    const perLine = Math.max(1, w / (s * 0.62));
    if (Math.ceil(em / perLine) <= maxLines) return s;
  }
  return minSize;
};

// 头像里的首字：英文名取首字母大写；没写 who 时按 meta.lang 给占位字
const initial = (who: string | undefined, lang: Lang | undefined) => (who && who.trim() ? Array.from(who.trim())[0].toUpperCase() : pick(lang, '评', '★'));

// ---------- 一颗星（自绘：Icon 组件恒 fill=none，评分需要「实心」效果） ----------
const Star: React.FC<{size: number; filled: boolean; color: string; empty: string; scale: number}> = ({size, filled, color, empty, scale}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{transform: `scale(${scale})`, flex: 'none'}}>
    <path d={STAR_D} fill={filled ? color : 'none'} stroke={filled ? 'none' : empty} strokeWidth={filled ? 0 : 1.6} strokeLinejoin="round" />
  </svg>
);

// ---------- 一张评价卡 ----------
const ReviewOne: React.FC<{q: Quote; t: number; at: number; w: number; h: number; big: boolean; lang?: Lang}> = ({q, t, at, w, h, big, lang}) => {
  const th = useTheme();
  if (t < at) return null;
  const enter = pop(t, at, 14, 170);
  const stars = Math.max(0, Math.min(5, Math.round(q.stars ?? 0)));
  const starAt = at + 0.35;
  const text = q.text ?? '';
  const innerW = w - 2 * (big ? 44 : 34) - (big ? 116 : 82);
  const size = fitQuote(text, innerW, big ? 3 : 2, big);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        boxSizing: 'border-box',
        borderRadius: 36,
        background: th.card,
        boxShadow: th.shadow,
        padding: big ? '38px 44px' : '26px 34px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: big ? 20 : 12,
        opacity: Math.min(1, enter * 1.6),
        transform: `translateY(${(1 - enter) * 50}px) scale(${0.92 + 0.08 * enter})`,
      }}
    >
      <div style={{display: 'flex', gap: big ? 22 : 16, alignItems: 'flex-start'}}>
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 900,
            fontSize: big ? 96 : 64,
            lineHeight: 0.7,
            color: alpha(th.accent, 0.85),
            flex: 'none',
            marginTop: big ? 4 : 2,
          }}
        >
          “
        </div>
        <div style={{fontSize: size, fontWeight: 700, lineHeight: 1.32, color: th.cardText, wordBreak: 'break-word'}}>{text}</div>
      </div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: big ? 4 : 0}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, minWidth: 0}}>
          <div
            style={{
              width: big ? 64 : 52,
              height: big ? 64 : 52,
              borderRadius: big ? 32 : 26,
              background: th.accentSoft,
              color: th.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: big ? 32 : 26,
              flex: 'none',
            }}
          >
            {initial(q.who, lang)}
          </div>
          <div style={{display: 'flex', flexDirection: 'column', minWidth: 0}}>
            {q.who && <div style={{fontSize: big ? 32 : 28, fontWeight: 800, color: th.cardText, whiteSpace: 'nowrap'}}>{q.who}</div>}
            {q.month && <div style={{fontSize: big ? 28 : 26, color: th.cardMuted, whiteSpace: 'nowrap'}}>{q.month}</div>}
          </div>
        </div>
        {stars > 0 && (
          <div style={{display: 'flex', gap: 5, flex: 'none'}}>
            {Array.from({length: 5}).map((_, si) => {
              const filled = si < stars;
              const sp = filled ? pop(t, starAt + si * 0.12, 10, 260) : 1;
              const sb = filled ? bump(t, starAt + si * 0.12 + 0.06, 0.4) : 0;
              return <Star key={si} size={big ? 36 : 30} filled={filled && sp > 0.05} color={th.hot} empty={th.line} scale={filled ? 0.5 + 0.5 * sp + sb * 0.22 : 1} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ReviewCard: React.FC<ShotProps<P>> = ({params: p, t, beat, meta}) => {
  const quotes = (p.quotes ?? []).slice(0, 2);
  const n = Math.max(1, quotes.length);
  const g = geom(n);
  const at = plan(n, beat);
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      {quotes.map((q, i) => (
        <div key={i} style={{position: 'absolute', left: CARD.x0, top: g.y0 + i * (g.cardH + GAP), width: CARD.w, height: g.cardH}}>
          <ReviewOne q={q} t={t} at={at[i]} w={CARD.w} h={g.cardH} big={n === 1} lang={meta?.lang} />
        </div>
      ))}
    </div>
  );
};

export default ReviewCard;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const quotes = (p.quotes ?? []).slice(0, 2);
  const n = Math.max(1, quotes.length);
  const at = plan(n, ctx.beat);
  const out: SfxCue[] = [];
  quotes.forEach((q, i) => {
    out.push({at: at[i], kind: 'pop', vol: 0.24});
    const stars = Math.max(0, Math.min(5, Math.round(q.stars ?? 0)));
    for (let s = 0; s < stars; s++) out.push({at: at[i] + 0.35 + s * 0.12, kind: 'tick', vol: 0.12});
  });
  return out;
};
