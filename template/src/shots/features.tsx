import React from 'react';
import {Easing, interpolate} from 'remotion';
import {bump, clamp, pop} from '../core/anim';
import {emWidth, fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {isIcon} from '../core/icons';
import {IconDisc} from '../core/kit';
import {MAIN} from '../core/safe';
import {alpha, textOnHot, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// features：2–4 张卖点卡按拍依次弹入，一个黄色「聚光框」跟着当前讲到的卡片移动。
// 版面（主体区 x 150–930，y 560–1340）：
//   grid：2 张左右并排大卡 / 3 张 = 上面一张横卡 + 下面两张方卡 / 4 张 2x2
//   stack：竖排横条卡（任意张数）
// 未出现的卡先画成虚线占位（带序号），让观众知道「一共几点」，第 0 帧不空。
// 当前卡：图标实心 + 脉冲圈 + 聚光框；讲过的卡：图标变浅色，信息保留。
// ============================================================
type Item = {icon?: string; title: string; desc?: string};
type P = {items: Item[]; layout?: 'grid' | 'stack'};

type Box = {x: number; y: number; w: number; h: number; kind: 'row' | 'tile' | 'big'};

const G = 24; // 卡片间距
const RADIUS = 36;
const FRAME_PAD = 10; // 聚光框比卡片外扩

/** 多行自动字号（汉字按字断行）：maxLines 行内放得下的最大字号 */
const wrapFit = (text: string, w: number, max: number, min: number, maxLines: number) => {
  const em = emWidth(text);
  for (let s = max; s > min; s--) {
    const perLine = Math.max(1, Math.floor((w * 0.97) / s));
    if (Math.ceil(em / perLine) <= maxLines) return s;
  }
  return min;
};

export const boxes = (n: number, layout: 'grid' | 'stack'): Box[] => {
  const {x0, y0, w, h} = MAIN;
  if (layout === 'stack' || n < 2 || n > 4) {
    const rh = Math.min(200, (h - G * (n - 1)) / n);
    const tot = rh * n + G * (n - 1);
    const top = y0 + (h - tot) / 2;
    return Array.from({length: n}, (_, i) => ({x: x0, y: top + i * (rh + G), w, h: rh, kind: 'row' as const}));
  }
  const cw = (w - G) / 2;
  if (n === 2) {
    const bh = 560;
    const top = y0 + (h - bh) / 2;
    return [
      {x: x0, y: top, w: cw, h: bh, kind: 'big'},
      {x: x0 + cw + G, y: top, w: cw, h: bh, kind: 'big'},
    ];
  }
  if (n === 3) {
    const rh = 300;
    const bh = 400;
    const top = y0 + (h - (rh + G + bh)) / 2;
    return [
      {x: x0, y: top, w, h: rh, kind: 'row'},
      {x: x0, y: top + rh + G, w: cw, h: bh, kind: 'tile'},
      {x: x0 + cw + G, y: top + rh + G, w: cw, h: bh, kind: 'tile'},
    ];
  }
  const bh = 372;
  const top = y0 + (h - (bh * 2 + G)) / 2;
  return [0, 1, 2, 3].map((i) => ({x: x0 + (i % 2) * (cw + G), y: top + Math.floor(i / 2) * (bh + G), w: cw, h: bh, kind: 'tile' as const}));
};

/** 每张卡的出场时间：第 1 张 0 秒，之后每隔 1–4 拍一张，保证最后一张之后还有 ≥1.2 秒阅读 */
export const plan = (n: number, dur: number, beat: number) => {
  const k = n > 1 ? Math.max(1, Math.min(4, Math.floor((dur - 1.2) / (n - 1) / beat))) : 1;
  return Array.from({length: n}, (_, i) => i * k * beat);
};

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

// ---------- 虚线占位 ----------
const Ghost: React.FC<{b: Box; i: number; fade: number}> = ({b, i, fade}) => {
  const th = useTheme();
  const on = th.onBg.startsWith('#') ? th.onBg : '#FFFFFF';
  return (
    <div
      style={{
        position: 'absolute',
        left: b.x,
        top: b.y,
        width: b.w,
        height: b.h,
        boxSizing: 'border-box',
        borderRadius: RADIUS,
        background: alpha(on, 0.12),
        border: `3px dashed ${alpha(on, 0.5)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: 64,
        color: alpha(on, 0.6),
        opacity: fade,
      }}
    >
      {String(i + 1).padStart(2, '0')}
    </div>
  );
};

// ---------- 卡片 ----------
const FeatureCard: React.FC<{b: Box; item: Item; i: number; t: number; at: number; active: boolean; en?: boolean}> = ({b, item, i, t, at, active, en}) => {
  const th = useTheme();
  const q = pop(t, at, 13, 190);
  const hit = bump(t, at + 0.12, 0.45);
  const pulse = active ? ((Math.max(0, t - at) % 1) / 1) : 0;
  const icon = isIcon(item.icon) ? item.icon : 'sparkle';
  const row = b.kind === 'row';
  const disc = row ? Math.round(Math.max(84, Math.min(130, b.h * 0.5))) : b.kind === 'big' ? 150 : 104;
  const textW = row ? b.w - 60 - disc - 28 : b.w - 60;
  const titleSize = row ? fitLine(item.title, textW, b.h >= 260 ? 64 : 56, 40) : fitLine(item.title, textW, b.kind === 'big' ? 56 : 50, 38);
  const desc = item.desc ?? '';
  const descSize = row ? wrapFit(desc, textW, b.h >= 240 ? 42 : 38, 34, b.h >= 240 ? 2 : 1) : wrapFit(desc, textW, b.kind === 'big' ? 40 : 36, 34, 3);

  const discEl = (
    <div style={{position: 'relative', width: disc, height: disc, flex: 'none', transform: `scale(${1 + hit * 0.22})`}}>
      {active && <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `5px solid ${th.accent}`, transform: `scale(${1 + pulse * 0.55})`, opacity: 1 - pulse}} />}
      <IconDisc name={icon} size={disc} soft={!active} />
      <div
        style={{
          position: 'absolute',
          right: -8,
          top: -8,
          width: 44,
          height: 44,
          borderRadius: 22,
          boxSizing: 'border-box',
          border: `3px solid ${th.card}`,
          background: active ? th.hot : th.cardAlt,
          color: active ? textOnHot(th) : th.cardSub,
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {i + 1}
      </div>
    </div>
  );

  const texts = (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: row ? 'flex-start' : 'center', minWidth: 0, width: textW}}>
      <div style={{fontSize: titleSize, fontWeight: 900, lineHeight: 1.18, color: th.cardText, whiteSpace: 'nowrap'}}>{item.title}</div>
      {desc && (
        <div
          style={{
            marginTop: row ? 8 : 12,
            fontSize: descSize,
            fontWeight: 500,
            lineHeight: 1.3,
            color: th.cardSub,
            textAlign: row ? 'left' : 'center',
            // 中文任意处可断；英文只在词间断（break-all 会把英文单词从中间劈开）
            wordBreak: en ? 'normal' : 'break-all',
            overflowWrap: en ? 'break-word' : undefined,
            ...({textWrap: 'balance'} as React.CSSProperties), // 多行时各行等长，避免最后一行只剩一个字
          }}
        >
          {desc}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: b.x,
        top: b.y,
        width: b.w,
        height: b.h,
        boxSizing: 'border-box',
        borderRadius: RADIUS,
        background: th.card,
        boxShadow: th.shadow,
        display: 'flex',
        flexDirection: row ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: row ? 'flex-start' : 'center',
        gap: row ? 28 : b.kind === 'big' ? 30 : 20,
        padding: row ? '0 30px' : '24px 30px',
        opacity: Math.min(1, q * 1.6),
        transform: `translateY(${(1 - q) * 50}px) scale(${0.82 + 0.18 * q})`,
      }}
    >
      {discEl}
      {texts}
    </div>
  );
};

// ---------- 聚光框：跟着当前卡片移动 ----------
const Spotlight: React.FC<{bx: Box[]; at: number[]; t: number; cur: number}> = ({bx, at, t, cur}) => {
  const th = useTheme();
  if (cur < 0) return null;
  const mv = cur === 0 ? 1 : interpolate(t, [at[cur], at[cur] + 0.32], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const a = bx[Math.max(0, cur - 1)];
  const b = bx[cur];
  const show = interpolate(t, [at[0] + 0.1, at[0] + 0.35], [0, 1], clamp);
  const glow = 0.35 + 0.15 * Math.sin(t * 5);
  return (
    <div
      style={{
        position: 'absolute',
        left: lerp(a.x, b.x, mv) - FRAME_PAD,
        top: lerp(a.y, b.y, mv) - FRAME_PAD,
        width: lerp(a.w, b.w, mv) + FRAME_PAD * 2,
        height: lerp(a.h, b.h, mv) + FRAME_PAD * 2,
        boxSizing: 'border-box',
        borderRadius: RADIUS + FRAME_PAD,
        border: `6px solid ${th.hot}`,
        boxShadow: `0 0 28px ${alpha(th.hot, glow)}, inset 0 0 0 2px ${alpha('#FFFFFF', 0.5)}`,
        opacity: show,
        pointerEvents: 'none',
      }}
    />
  );
};

const Features: React.FC<ShotProps<P>> = ({params: p, t, dur, beat, meta}) => {
  const items = (p.items ?? []).slice(0, 4);
  const n = items.length;
  if (!n) return null;
  const bx = boxes(n, p.layout === 'stack' ? 'stack' : 'grid');
  const at = plan(n, dur, beat);
  let cur = -1;
  at.forEach((a, i) => {
    if (t >= a) cur = i;
  });
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      {items.map((it, i) => {
        // 虚线占位只在卡片出现前 0.3 秒露一下（预告下一张），不再从第 0 帧一直挂着像没加载完
        const ghostFade = Math.min(interpolate(t, [at[i] - 0.3, at[i] - 0.15], [0, 1], clamp), interpolate(t, [at[i], at[i] + 0.2], [1, 0], clamp));
        return i > 0 && ghostFade > 0 ? <Ghost key={`g${i}`} b={bx[i]} i={i} fade={ghostFade} /> : null;
      })}
      {items.map((it, i) => (t >= at[i] ? <FeatureCard key={i} b={bx[i]} item={it} i={i} t={t} at={at[i]} active={i === cur} en={meta?.lang === 'en'} /> : null))}
      <Spotlight bx={bx} at={at} t={t} cur={cur} />
    </div>
  );
};

export default Features;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const n = Math.min(4, p.items?.length ?? 0);
  return plan(n, ctx.dur, ctx.beat).map((at, i) => ({at: at + 0.02, kind: 'pop', vol: i === n - 1 ? 0.3 : 0.25}));
};
