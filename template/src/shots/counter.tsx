import React from 'react';
import {Easing, interpolate} from 'remotion';
import {bump, clamp, float, pop} from '../core/anim';
import {charUnits, fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {IconDisc} from '../core/kit';
import {CARD, MAIN} from '../core/safe';
import {alpha, toneColor, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// counter：大数字滚动。一张卡片（x 150–930，主体区内垂直居中）：
//   图标 → （可选）旧值被划掉 + 变化幅度胶囊 → 大数字从 from 滚到 to（进度条同步走）→
//   落定那一拍：数字弹一下 + 放射光线 + 叮（落定时刻吸附整拍）→ 含义 label + 口径 sub。
// ============================================================
type P = {
  to: number;
  from?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  sub?: string;
  icon?: string;
  showFrom?: boolean;
  tone?: 'accent' | 'good' | 'bad';
};

const ROLL = 1.1; // 滚动时长（秒，120 BPM 基准）

export const plan = (p: P, dur: number, beat: number) => {
  const roll = Math.min(ROLL * (beat / 0.5), Math.max(0.6, dur * 0.45));
  const minStart = Math.min(0.3, dur * 0.12);
  let land = Math.ceil((minStart + roll) / beat - 1e-6) * beat;
  const latest = Math.max(minStart + roll, dur - 0.8);
  if (land > latest) land = latest;
  const start = land - roll;
  return {start, land, roll};
};

const fmtNum = (v: number, dec: number) => {
  const neg = v < 0;
  const s = Math.abs(v).toFixed(dec);
  const [ip, fp] = s.split('.');
  const ints = ip.length > 4 ? ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ip;
  return (neg ? '-' : '') + ints + (fp ? '.' + fp : '');
};

// 变化幅度：下降给百分比，上升 ≥2 倍给「倍」，否则给百分比；起点为 0 时不显示
const deltaText = (from: number, to: number) => {
  if (!from || from === to) return '';
  const r = to / from;
  if (to < from && from > 0 && to >= 0) {
    const pct = Math.round((1 - r) * 100);
    return pct >= 100 || pct <= 0 ? '' : `↓ ${pct}%`;
  }
  if (to > from && from > 0) return r >= 2 ? `↑ ${Number.isInteger(Math.round(r * 10) / 10) ? Math.round(r) : (Math.round(r * 10) / 10).toFixed(1)} 倍` : `↑ ${Math.round((r - 1) * 100)}%`;
  return '';
};

const Counter: React.FC<ShotProps<P>> = ({params: p, t, dur, beat}) => {
  const th = useTheme();
  const pl = plan(p, dur, beat);
  const to = typeof p.to === 'number' && Number.isFinite(p.to) ? p.to : 0;
  const from = typeof p.from === 'number' && Number.isFinite(p.from) ? p.from : 0;
  const dec = Math.max(0, Math.min(2, Math.round(p.decimals ?? 0)));
  const tone = p.tone === 'good' || p.tone === 'bad' ? toneColor(th, p.tone) : th.accent;
  const prog = interpolate(t, [pl.start, pl.land], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const landed = t >= pl.land;
  const v = landed ? to : from + (to - from) * prog;
  const hit = bump(t, pl.land, 0.5);
  const rays = landed ? Math.min(1, (t - pl.land) / 0.55) : 0;
  const enter = pop(t, 0, 16, 170);
  const showFrom = !!p.showFrom && typeof p.from === 'number' && from !== to; // 没写 from 就不显示旧值行
  const delta = showFrom ? deltaText(from, to) : '';
  const deltaP = pop(t, pl.land + 0.05, 12, 200);
  const strike = interpolate(t, [pl.land - 0.25, pl.land], [0, 1], clamp);

  // ---- 版面 ----
  const W = CARD.w;
  const inner = W - 2 * CARD.padX;
  const prefix = p.prefix ?? '';
  const suffix = p.suffix ?? '';
  const longest = [fmtNum(to, dec), fmtNum(from, dec)].sort((a, b) => b.length - a.length)[0];
  const em = longest.length * 0.6 + charUnits(prefix) * 0.5 + (suffix ? charUnits(suffix) * 0.38 + 0.08 : 0);
  const numSize = Math.max(100, Math.min(230, Math.floor((inner - 40) / Math.max(0.6, em))));
  const labelSize = fitLine(p.label ?? '', inner, 54, 40);
  const subSize = fitLine(p.sub ?? '', inner, 36, 30);
  const ICON = 96;
  const FROM_H = showFrom ? 86 : 0;
  const NUM_H = Math.round(numSize * 1.06);
  const cardH = 40 + ICON + 18 + FROM_H + NUM_H + 22 + 16 + 30 + Math.round(labelSize * 1.3) + (p.sub ? 10 + Math.round(subSize * 1.35) : 0) + 40;
  const cardY = MAIN.y0 + Math.max(0, Math.round((MAIN.h - cardH) / 2));
  const icon = isIcon(p.icon) ? p.icon : 'trend';
  const halo = (t % 1.5) / 1.5;
  const barW = Math.min(560, inner);
  const fromStr = `${prefix}${fmtNum(from, dec)}${suffix ? ' ' + suffix : ''}`;
  const numCenterY = 40 + ICON + 18 + FROM_H + NUM_H / 2;

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div
        style={{
          position: 'absolute',
          left: CARD.x0,
          top: cardY,
          width: W,
          height: cardH,
          borderRadius: 40,
          background: th.card,
          boxShadow: th.shadow,
          overflow: 'hidden',
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 60}px) scale(${0.94 + 0.06 * enter})`,
        }}
      >
        {/* 数字背后的柔光 */}
        <div
          style={{
            position: 'absolute',
            left: W / 2 - 330,
            top: numCenterY - 200,
            width: 660,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(ellipse at 50% 50%, ${alpha(tone, th.dark ? 0.28 : 0.16 + 0.12 * hit)} 0%, ${alpha(tone, 0)} 70%)`,
          }}
        />
        {/* 放射光线（落定时） */}
        {rays > 0 && rays < 1 && (
          <svg width={W} height={cardH} style={{position: 'absolute', left: 0, top: 0}}>
            {Array.from({length: 12}).map((_, i) => {
              const a = (i / 12) * Math.PI * 2 + 0.26;
              const r0 = 150 + rays * 120;
              const r1 = r0 + 60 * (1 - rays);
              const cx = W / 2;
              const cy = numCenterY;
              return (
                <line
                  key={i}
                  x1={cx + Math.cos(a) * r0 * 1.5}
                  y1={cy + Math.sin(a) * r0 * 0.8}
                  x2={cx + Math.cos(a) * r1 * 1.5}
                  y2={cy + Math.sin(a) * r1 * 0.8}
                  stroke={i % 2 ? th.hot : tone}
                  strokeWidth={10}
                  strokeLinecap="round"
                  opacity={1 - rays}
                />
              );
            })}
          </svg>
        )}
        {/* 图标 */}
        <div style={{position: 'absolute', left: W / 2 - ICON / 2, top: 40, width: ICON, height: ICON, transform: `translateY(${float(t, 0, 4)}px)`}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `5px solid ${tone}`, transform: `scale(${1 + halo * 0.5})`, opacity: 0.6 * (1 - halo)}} />
          <IconDisc name={icon} size={ICON} tone={p.tone === 'good' || p.tone === 'bad' ? p.tone : 'accent'} />
        </div>
        {/* 旧值（划掉）→ 变化幅度 */}
        {showFrom && (
          <div style={{position: 'absolute', left: 0, right: 0, top: 40 + ICON + 18, height: FROM_H, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            <div style={{position: 'relative', fontFamily: MONO, fontWeight: 700, fontSize: 52, color: th.cardMuted, whiteSpace: 'nowrap'}}>
              {fromStr}
              {strike > 0 && <div style={{position: 'absolute', left: -6, top: '52%', height: 7, width: `calc(${strike * 100}% + ${12 * strike}px)`, background: th.bad, borderRadius: 4, transform: 'rotate(-4deg)'}} />}
            </div>
            {delta && (
              <div
                style={{
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: 42,
                  color: '#ffffff',
                  background: tone,
                  borderRadius: 30,
                  padding: '4px 24px',
                  whiteSpace: 'nowrap',
                  opacity: landed ? Math.min(1, deltaP * 2) : 0,
                  transform: `scale(${landed ? 0.5 + 0.5 * deltaP : 0.5})`,
                  boxShadow: `0 8px 20px ${alpha(tone, 0.35)}`,
                }}
              >
                {delta}
              </div>
            )}
          </div>
        )}
        {/* 大数字 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 40 + ICON + 18 + FROM_H,
            height: NUM_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            color: tone,
            transformOrigin: '50% 60%',
            transform: `scale(${1 + hit * 0.22})`,
          }}
        >
          {prefix && <span style={{fontFamily: FONT, fontWeight: 900, fontSize: numSize * 0.5, marginRight: 6, alignSelf: 'center'}}>{prefix}</span>}
          <span style={{fontFamily: MONO, fontWeight: 700, fontSize: numSize, lineHeight: 1, letterSpacing: -2}}>{fmtNum(v, dec)}</span>
          {suffix && <span style={{fontFamily: FONT, fontWeight: 900, fontSize: numSize * 0.38, marginLeft: 12, alignSelf: 'flex-end', marginBottom: numSize * 0.16}}>{suffix}</span>}
        </div>
        {/* 进度条 */}
        <div style={{position: 'absolute', left: W / 2 - barW / 2, top: 40 + ICON + 18 + FROM_H + NUM_H + 22, width: barW, height: 16, borderRadius: 8, background: alpha(tone, th.dark ? 0.2 : 0.14), overflow: 'hidden'}}>
          <div style={{width: `${prog * 100}%`, height: '100%', borderRadius: 8, background: tone, boxShadow: landed ? `0 0 ${16 * hit}px ${tone}` : undefined}} />
        </div>
        {/* 含义 + 口径 */}
        <div style={{position: 'absolute', left: CARD.padX, right: CARD.padX, top: 40 + ICON + 18 + FROM_H + NUM_H + 22 + 16 + 30, textAlign: 'center'}}>
          <div style={{fontSize: labelSize, fontWeight: 900, color: th.cardText, lineHeight: 1.3, whiteSpace: 'nowrap'}}>{p.label}</div>
          {p.sub && (
            <div style={{marginTop: 10, fontSize: subSize, fontWeight: 600, color: th.cardSub, lineHeight: 1.35, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10}}>
              <Icon name="doc" size={subSize} color={th.cardMuted} stroke={2.2} />
              {p.sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Counter;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur, ctx.beat);
  const out: SfxCue[] = [{at: 0.05, kind: 'pop', vol: 0.2}];
  const step = ctx.beat / 4;
  for (let at = pl.start, k = 0; at < pl.land - 0.12; at += step, k++) out.push({at, kind: 'tick', vol: Math.max(0.1, 0.22 - k * 0.012)});
  out.push({at: pl.land, kind: 'ding', vol: 0.3});
  if (p.showFrom) out.push({at: pl.land - 0.25, kind: 'swish', vol: 0.16});
  return out;
};
