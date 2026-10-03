import React from 'react';
import {Easing, interpolate} from 'remotion';
import {bump, clamp, float, pop} from '../core/anim';
import {charUnits, fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {pick} from '../core/kit';
import type {Lang} from '../core/kit';
import {CARD, MAIN} from '../core/safe';
import {alpha, toneColor, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// counter：大数字滚动。一张卡片（x 150–930，主体区内垂直居中）：
//   图标 → （可选）旧值行 → 大数字从 from 滚到 to（液位条同步走）→
//   落定那一拍：数字弹一下 + 放射光线 + 叮（落定时刻吸附整拍）→ 含义 label + 口径 sub。
// 旧值行分两种（showFrom: true 时）：
//   钱（prefix/suffix 带 ¥ 元 $ 等）：旧价划掉 + ↓% 胶囊——这是价格语义，只给钱用；
//   其他（℃、分钟、个…）：旧值不划掉，写成「旧值 →」，下面的液位条从旧值的位置降到（或升到）新值，
//   不出百分比胶囊（「95℃ → 68℃」按降价样式画成「↓28%」是错的：温度、剩余量不是打折）。
// 液位条 = |当前值| / max(|from|, |to|)，旧值位置留一道浅色残影；没写 from 时就是 0 → 满格。
// 图标跟着方向走：数值下降时 trend 图标上下翻转，不在下降的数字上画上升箭头。
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

// 数字字体：等宽数字优先，缺字（℃ ¥ 元 等）落到正文字体，不落到系统等宽字体（中文系统上是宋体，衬线）
const NUMF = `${MONO.replace(/,\s*monospace\s*$/, '')}, ${FONT}`;
// 钱：只有这些单位才用「划掉旧价 + 降幅胶囊」
const MONEY_RE = /[¥￥$€£]|元|块|RMB|CNY|USD/i;
// 紧贴数字的符号单位（95℃、30%），不留空格；拉丁字母开头的单位（min、hrs）留一个空格；中文单位留一点间距
const TIGHT_RE = /^[%‰℃℉°×]/;
const LATIN_RE = /^[A-Za-z]/;

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

// 变化幅度（只给钱用）：下降给百分比，上升 ≥2 倍给「倍」，否则给百分比；起点为 0 时不显示
const deltaText = (from: number, to: number, lang: Lang | undefined) => {
  if (!from || from === to) return '';
  const r = to / from;
  if (to < from && from > 0 && to >= 0) {
    const pct = Math.round((1 - r) * 100);
    return pct >= 100 || pct <= 0 ? '' : `↓ ${pct}%`;
  }
  if (to > from && from > 0) {
    if (r < 2) return `↑ ${Math.round((r - 1) * 100)}%`;
    const k = Number.isInteger(Math.round(r * 10) / 10) ? String(Math.round(r)) : (Math.round(r * 10) / 10).toFixed(1);
    return pick(lang, `↑ ${k} 倍`, `↑ ${k}×`);
  }
  return '';
};

/** 带单位的数值：数字用 NUMF，前后缀用正文字体；符号单位紧贴数字 */
const Value: React.FC<{num: string; prefix: string; suffix: string; size: number; unitK?: number; gap?: number}> = ({num, prefix, suffix, size, unitK = 1, gap}) => {
  const sGap = gap ?? (TIGHT_RE.test(suffix) ? 2 : LATIN_RE.test(suffix) ? size * 0.28 : size * 0.16);
  return (
    <span style={{whiteSpace: 'nowrap'}}>
      {prefix && <span style={{fontFamily: FONT, fontWeight: 800, fontSize: size * unitK, marginRight: 4}}>{prefix}</span>}
      <span style={{fontFamily: NUMF, fontWeight: 700, fontSize: size}}>{num}</span>
      {suffix && <span style={{fontFamily: FONT, fontWeight: 800, fontSize: size * unitK, marginLeft: sGap}}>{suffix}</span>}
    </span>
  );
};

const Counter: React.FC<ShotProps<P>> = ({params: p, t, dur, beat, meta}) => {
  const th = useTheme();
  const lang = meta?.lang;
  const pl = plan(p, dur, beat);
  const to = typeof p.to === 'number' && Number.isFinite(p.to) ? p.to : 0;
  const hasFrom = typeof p.from === 'number' && Number.isFinite(p.from);
  const from = hasFrom ? (p.from as number) : 0;
  const dec = Math.max(0, Math.min(2, Math.round(p.decimals ?? 0)));
  const toneKey = p.tone === 'good' || p.tone === 'bad' ? p.tone : 'accent';
  const toneFill = toneKey === 'accent' ? th.accentFill : toneColor(th, toneKey);
  const toneInk = toneKey === 'accent' ? th.accentInk : toneColor(th, toneKey);
  const prog = interpolate(t, [pl.start, pl.land], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const landed = t >= pl.land;
  const v = landed ? to : from + (to - from) * prog;
  const hit = bump(t, pl.land, 0.5);
  const rays = landed ? Math.min(1, (t - pl.land) / 0.55) : 0;
  const enter = pop(t, 0, 16, 170);
  const prefix = p.prefix ?? '';
  const suffix = p.suffix ?? '';
  const money = MONEY_RE.test(prefix + suffix);
  const showFrom = !!p.showFrom && hasFrom && from !== to; // 没写 from 就不显示旧值行
  const discount = showFrom && money; // 钱：划掉 + 降幅胶囊
  const change = showFrom && !money; // 其他：旧值 → 新值，不划掉、不出百分比
  const delta = discount ? deltaText(from, to, lang) : '';
  const deltaP = pop(t, pl.land + 0.05, 12, 200);
  const strike = interpolate(t, [pl.land - 0.25, pl.land], [0, 1], clamp);
  const down = hasFrom && to < from;

  // ---- 版面 ----
  const W = CARD.w;
  const inner = W - 2 * CARD.padX;
  const longest = [fmtNum(to, dec), fmtNum(from, dec)].sort((a, b) => b.length - a.length)[0];
  const em = longest.length * 0.6 + charUnits(prefix) * 0.5 + (suffix ? charUnits(suffix) * 0.38 + 0.08 : 0);
  const numSize = Math.max(100, Math.min(230, Math.floor((inner - 40) / Math.max(0.6, em))));
  const labelSize = fitLine(p.label ?? '', inner, 54, 40);
  const subSize = fitLine(p.sub ?? '', inner, 36, 30);
  const ICON = 96;
  const FROM_H = showFrom ? 86 : 0;
  const NUM_H = Math.round(numSize * 1.06);
  const BAR_H = change ? 22 : 16;
  const cardH = 40 + ICON + 18 + FROM_H + NUM_H + 22 + BAR_H + 30 + Math.round(labelSize * 1.3) + (p.sub ? 10 + Math.round(subSize * 1.35) : 0) + 40;
  const cardY = MAIN.y0 + Math.max(0, Math.round((MAIN.h - cardH) / 2));
  const icon = isIcon(p.icon) ? p.icon : 'trend';
  const flipIcon = icon === 'trend' && down; // 下降时不画上升箭头
  const halo = (t % 1.5) / 1.5;
  const barW = Math.min(560, inner);
  const numCenterY = 40 + ICON + 18 + FROM_H + NUM_H / 2;
  // 液位：当前值占 max(|from|,|to|) 的比例；change 模式下旧值位置留残影
  const full = Math.max(Math.abs(from), Math.abs(to)) || 1;
  const level = (x: number) => Math.max(0, Math.min(1, Math.abs(x) / full));
  const fill = hasFrom ? level(v) : prog;
  const ghost = change ? level(from) : 0;
  const arrowIn = interpolate(t, [pl.start, pl.start + 0.3], [0, 1], clamp);

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
            background: `radial-gradient(ellipse at 50% 50%, ${alpha(toneFill, th.dark ? 0.28 : 0.16 + 0.12 * hit)} 0%, ${alpha(toneFill, 0)} 70%)`,
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
                  stroke={i % 2 ? th.hot : toneInk}
                  strokeWidth={10}
                  strokeLinecap="round"
                  opacity={1 - rays}
                />
              );
            })}
          </svg>
        )}
        {/* 图标（下降时 trend 上下翻转成下降箭头） */}
        <div style={{position: 'absolute', left: W / 2 - ICON / 2, top: 40, width: ICON, height: ICON, transform: `translateY(${float(t, 0, 4)}px)`}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `5px solid ${toneInk}`, transform: `scale(${1 + halo * 0.5})`, opacity: 0.6 * (1 - halo)}} />
          <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: toneFill, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 24px ${alpha(toneFill, 0.35)}`}}>
            <Icon name={icon} size={ICON * 0.52} color={toneKey === 'accent' ? th.accentText : '#FFFFFF'} stroke={2.2} style={flipIcon ? {transform: 'scaleY(-1)'} : undefined} />
          </div>
        </div>
        {/* 旧值行 */}
        {discount && (
          <div style={{position: 'absolute', left: 0, right: 0, top: 40 + ICON + 18, height: FROM_H, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            <div style={{position: 'relative', color: th.cardMuted, whiteSpace: 'nowrap'}}>
              <Value num={fmtNum(from, dec)} prefix={prefix} suffix={suffix} size={52} unitK={0.8} />
              {strike > 0 && <div style={{position: 'absolute', left: -6, top: '52%', height: 7, width: `calc(${strike * 100}% + ${12 * strike}px)`, background: th.bad, borderRadius: 4, transform: 'rotate(-4deg)'}} />}
            </div>
            {delta && (
              <div
                style={{
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: 42,
                  color: toneKey === 'accent' && th.accentFill !== th.accent ? th.accentText : '#ffffff',
                  background: toneFill,
                  borderRadius: 30,
                  padding: '4px 24px',
                  whiteSpace: 'nowrap',
                  opacity: landed ? Math.min(1, deltaP * 2) : 0,
                  transform: `scale(${landed ? 0.5 + 0.5 * deltaP : 0.5})`,
                  boxShadow: `0 8px 20px ${alpha(toneFill, 0.35)}`,
                }}
              >
                {delta}
              </div>
            )}
          </div>
        )}
        {change && (
          <div style={{position: 'absolute', left: 0, right: 0, top: 40 + ICON + 18, height: FROM_H, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, color: th.cardSub}}>
            <Value num={fmtNum(from, dec)} prefix={prefix} suffix={suffix} size={52} unitK={0.8} />
            <div style={{opacity: arrowIn, transform: `translateX(${(1 - arrowIn) * -16}px)`}}>
              <Icon name="arrow" size={46} color={toneInk} stroke={2.8} />
            </div>
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
            color: toneInk,
            transformOrigin: '50% 60%',
            transform: `scale(${1 + hit * 0.22})`,
          }}
        >
          {prefix && <span style={{fontFamily: FONT, fontWeight: 900, fontSize: numSize * 0.5, marginRight: 6, alignSelf: 'center'}}>{prefix}</span>}
          <span style={{fontFamily: NUMF, fontWeight: 700, fontSize: numSize, lineHeight: 1, letterSpacing: -2}}>{fmtNum(v, dec)}</span>
          {suffix && (
            <span style={{fontFamily: FONT, fontWeight: 900, fontSize: numSize * 0.38, marginLeft: TIGHT_RE.test(suffix) ? 2 : 12, alignSelf: 'flex-end', marginBottom: numSize * 0.16}}>{suffix}</span>
          )}
        </div>
        {/* 液位条：从旧值的位置降到（升到）新值；change 模式下旧值位置留残影 + 刻度 */}
        <div style={{position: 'absolute', left: W / 2 - barW / 2, top: 40 + ICON + 18 + FROM_H + NUM_H + 22, width: barW, height: BAR_H}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: BAR_H / 2, background: alpha(toneFill, th.dark ? 0.2 : 0.14), overflow: 'hidden'}}>
            {change && <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${ghost * 100}%`, background: alpha(toneFill, th.dark ? 0.32 : 0.26)}} />}
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, borderRadius: BAR_H / 2, background: toneFill, boxShadow: landed ? `0 0 ${16 * hit}px ${toneFill}` : undefined}} />
          </div>
          {change && <div style={{position: 'absolute', left: `calc(${ghost * 100}% - 3px)`, top: -8, width: 6, height: BAR_H + 16, borderRadius: 3, background: th.cardMuted}} />}
        </div>
        {/* 含义 + 口径 */}
        <div style={{position: 'absolute', left: CARD.padX, right: CARD.padX, top: 40 + ICON + 18 + FROM_H + NUM_H + 22 + BAR_H + 30, textAlign: 'center'}}>
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
