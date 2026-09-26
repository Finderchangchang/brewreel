import React from 'react';
import {spring} from 'remotion';
import {bump, float, pop} from '../core/anim';
import {charUnits as units, fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {Card, IconDisc} from '../core/kit';
import {CARD, FPS, MAIN} from '../core/safe';
import {Theme, alpha, mixHex, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// meter：仪表 / 评分（jev「危险仪表」泛化）。一张卡片（x 150–930，主体区内垂直居中）：
//   顶栏：图标 + 仪表名 → 主角：gauge 半圆分段 / ring 圆环 / bar 横条，指针弹簧摆到目标值 →
//   落定：数字弹一下 + 判词胶囊弹出 + 波纹（thud 卡在落定时刻，落定时刻吸附整拍）→ 下一拍：结论条上浮。
// 分段颜色：higherIs=bad 时 绿→黄→红；higherIs=good 时 红→黄→绿。
// ============================================================
type P = {
  value: number;
  max?: number;
  from?: number;
  label: string;
  unit?: string;
  style?: 'gauge' | 'ring' | 'bar';
  higherIs?: 'good' | 'bad';
  word?: string;
  note?: string;
  icon?: string;
};

const SPR = {damping: 14, stiffness: 70};
// 指针从起点到「肉眼看着到位」（弹簧 ≥0.96）所需秒数
const LAND_DELTA = (() => {
  for (let fr = 0; fr < 150; fr++) if (spring({frame: fr, fps: FPS, config: SPR}) >= 0.96) return fr / FPS;
  return 1;
})();

const norm = (p: P) => {
  const max = typeof p.max === 'number' && p.max > 0 ? p.max : 10;
  const clampV = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : d);
  return {max, value: clampV(p.value, 0), from: clampV(p.from, 0), style: p.style ?? 'gauge', bad: p.higherIs !== 'good'};
};

// ---------- 时间线：落定时刻吸附整拍 ----------
export const plan = (p: P, dur: number, beat: number) => {
  const minStart = Math.min(0.35, dur * 0.15);
  let land = Math.ceil((minStart + LAND_DELTA) / beat - 1e-6) * beat;
  const latest = Math.max(minStart + LAND_DELTA, dur - 1.0);
  if (land > latest) land = latest;
  const start = land - LAND_DELTA;
  const noteAt = Math.min(land + beat, Math.max(land + 0.15, dur - 0.7));
  return {start, land, noteAt};
};

// 刻度颜色：f = 0..1 位置
const scaleColor = (th: Theme, f: number, bad: boolean) => {
  const x = Math.max(0, Math.min(1, bad ? f : 1 - f));
  return x < 0.5 ? mixHex(th.good, th.warn, x * 2) : mixHex(th.warn, th.bad, (x - 0.5) * 2);
};

const GR = 268;
const GS = 58;

const fmt = (v: number, dec: number) => (dec > 0 ? v.toFixed(dec) : String(Math.round(v)));

// ---------- 主角：半圆分段仪表 ----------
const GaugeViz: React.FC<{w: number; cur: number; max: number; bad: boolean; shownColor: string; ripple: number; discrete: boolean; num: React.ReactNode; word: React.ReactNode; t: number}> = ({
  w,
  cur,
  max,
  bad,
  shownColor,
  ripple,
  discrete,
  num,
  word,
  t,
}) => {
  const th = useTheme();
  const R = GR;
  const S = GS;
  const cx = w / 2;
  const cy = S / 2 + R + 14;
  const H = cy + 110;
  const N = discrete ? Math.round(max) : 10;
  const segDeg = 180 / N;
  const pt = (deg: number, rr: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  };
  const arc = (i: number) => {
    const [x0, y0] = pt(180 - i * segDeg - 1.1, R);
    const [x1, y1] = pt(180 - (i + 1) * segDeg + 1.1, R);
    return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
  };
  const frac = discrete ? Math.max(0, (cur - 0.5) / N) : cur / max;
  const knobDeg = 180 - Math.max(0, Math.min(1, frac)) * 180 + float(t, 0, 0.35, 0.5);
  const [kx, ky] = pt(knobDeg, R);
  const [px, py] = pt(knobDeg, R - S / 2 - 26);
  const [pl, ply] = pt(knobDeg + 5, R - S / 2 - 8);
  const [pr, pry] = pt(knobDeg - 5, R - S / 2 - 8);
  const shown = discrete ? Math.round(cur) : cur;
  return (
    <div style={{position: 'relative', width: w, height: H}}>
      <svg width={w} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {Array.from({length: N}).map((_, i) => {
          const lit = discrete ? i + 1 <= shown : (i + 0.5) / N <= cur / max;
          const col = scaleColor(th, (i + 0.5) / N, bad);
          const [lx, ly] = pt(180 - (i + 0.5) * segDeg, R);
          return (
            <g key={i}>
              <path d={arc(i)} stroke={col} strokeWidth={S} fill="none" opacity={lit ? 1 : 0.2} />
              {discrete && N <= 10 && (
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontWeight={700} fontSize={26} fill={lit ? '#ffffff' : col}>
                  {i + 1}
                </text>
              )}
            </g>
          );
        })}
        {/* 内圈指示三角 */}
        <path d={`M ${px} ${py} L ${pl} ${ply} L ${pr} ${pry} Z`} fill={shownColor} />
        {ripple > 0 && ripple < 1 && <circle cx={kx} cy={ky} r={S * 0.6 + ripple * 60} fill="none" stroke={shownColor} strokeWidth={6} opacity={1 - ripple} />}
        <circle cx={kx} cy={ky + 4} r={S * 0.62} fill="rgba(0,0,0,0.20)" />
        <circle cx={kx} cy={ky} r={S * 0.62} fill={shownColor} stroke="#ffffff" strokeWidth={7} />
      </svg>
      {!discrete && (
        <>
          <div style={{position: 'absolute', left: cx - R - 40, width: 80, top: cy + 36, textAlign: 'center', fontFamily: MONO, fontSize: 28, fontWeight: 700, color: th.cardMuted}}>0</div>
          <div style={{position: 'absolute', left: cx + R - 60, width: 120, top: cy + 36, textAlign: 'center', fontFamily: MONO, fontSize: 28, fontWeight: 700, color: th.cardMuted}}>{fmt(max, 0)}</div>
        </>
      )}
      <div style={{position: 'absolute', left: 0, right: 0, top: cy - 188, height: 170, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'}}>{num}</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + 12, display: 'flex', justifyContent: 'center'}}>{word}</div>
    </div>
  );
};

// ---------- 主角：圆环 ----------
const RingViz: React.FC<{w: number; cur: number; max: number; bad: boolean; shownColor: string; ripple: number; num: React.ReactNode; word: React.ReactNode; t: number}> = ({
  w,
  cur,
  max,
  shownColor,
  ripple,
  num,
  word,
  t,
}) => {
  const th = useTheme();
  const R = 200;
  const S = 46;
  const cx = w / 2;
  const cy = R + S / 2 + 10;
  const H = cy * 2;
  const span = 300; // 底部留 60° 缺口
  const f = Math.max(0, Math.min(1, cur / max));
  const C = 2 * Math.PI * R;
  const trackLen = (C * span) / 360;
  const a = ((90 + span / 2 - f * span + float(t, 0, 0.35, 0.5)) * Math.PI) / 180; // 从左下 240° 顺时针走
  const kx = cx + R * Math.cos(a);
  const ky = cy - R * Math.sin(a);
  const rot = 90 + (360 - span) / 2; // SVG 起点：正下方偏左 30°
  return (
    <div style={{position: 'relative', width: w, height: H}}>
      <svg width={w} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <circle cx={cx} cy={cy} r={R} stroke={alpha(shownColor, th.dark ? 0.22 : 0.14)} strokeWidth={S} fill="none" strokeLinecap="round" strokeDasharray={`${trackLen} ${C}`} transform={`rotate(${rot} ${cx} ${cy})`} />
        {Array.from({length: 11}).map((_, i) => {
          const aa = ((90 + span / 2 - (i / 10) * span) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={cx + (R - S / 2 - 16) * Math.cos(aa)}
              y1={cy - (R - S / 2 - 16) * Math.sin(aa)}
              x2={cx + (R - S / 2 - 30) * Math.cos(aa)}
              y2={cy - (R - S / 2 - 30) * Math.sin(aa)}
              stroke={th.cardMuted}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.6}
            />
          );
        })}
        {f > 0.001 && (
          <circle cx={cx} cy={cy} r={R} stroke={shownColor} strokeWidth={S} fill="none" strokeLinecap="round" strokeDasharray={`${trackLen * f} ${C}`} transform={`rotate(${rot} ${cx} ${cy})`} />
        )}
        {ripple > 0 && ripple < 1 && <circle cx={kx} cy={ky} r={S * 0.62 + ripple * 60} fill="none" stroke={shownColor} strokeWidth={6} opacity={1 - ripple} />}
        <circle cx={kx} cy={ky + 4} r={S * 0.62} fill="rgba(0,0,0,0.2)" />
        <circle cx={kx} cy={ky} r={S * 0.62} fill={shownColor} stroke="#ffffff" strokeWidth={7} />
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: cy - 150, height: 170, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'}}>{num}</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + 44, display: 'flex', justifyContent: 'center'}}>{word}</div>
    </div>
  );
};

// ---------- 主角：横条 ----------
const BarViz: React.FC<{w: number; cur: number; max: number; bad: boolean; shownColor: string; ripple: number; num: React.ReactNode; word: React.ReactNode}> = ({
  w,
  cur,
  max,
  bad,
  shownColor,
  ripple,
  num,
  word,
}) => {
  const th = useTheme();
  const BW = w - 60;
  const x0 = 30;
  const N = 10;
  const gap = 8;
  const segW = (BW - gap * (N - 1)) / N;
  const f = Math.max(0, Math.min(1, cur / max));
  const barTop = 250;
  const mx = x0 + f * BW;
  return (
    <div style={{position: 'relative', width: w, height: barTop + 140}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 180, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'}}>{num}</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 184, display: 'flex', justifyContent: 'center'}}>{word}</div>
      {Array.from({length: N}).map((_, i) => {
        const segF = Math.max(0, Math.min(1, (f * BW - i * (segW + gap)) / segW));
        const col = scaleColor(th, (i + 0.5) / N, bad);
        return (
          <div key={i} style={{position: 'absolute', left: x0 + i * (segW + gap), top: barTop + 24, width: segW, height: 52, borderRadius: 14, background: alpha(col, th.dark ? 0.22 : 0.16), overflow: 'hidden'}}>
            <div style={{width: `${segF * 100}%`, height: '100%', background: col}} />
          </div>
        );
      })}
      {/* 游标 */}
      <div style={{position: 'absolute', left: mx - 22, top: barTop - 14, width: 44, height: 34}}>
        <svg width={44} height={34}>
          <path d="M 4 4 L 40 4 L 22 30 Z" fill={shownColor} stroke="#ffffff" strokeWidth={4} strokeLinejoin="round" />
        </svg>
      </div>
      {ripple > 0 && ripple < 1 && (
        <div style={{position: 'absolute', left: mx - 40 - ripple * 30, top: barTop + 50 - 40 - ripple * 30, width: 80 + ripple * 60, height: 80 + ripple * 60, borderRadius: '50%', border: `6px solid ${shownColor}`, opacity: 1 - ripple}} />
      )}
      <div style={{position: 'absolute', left: x0 - 20, top: barTop + 90, fontFamily: MONO, fontSize: 28, fontWeight: 700, color: th.cardMuted}}>0</div>
      <div style={{position: 'absolute', right: x0 - 20, top: barTop + 90, fontFamily: MONO, fontSize: 28, fontWeight: 700, color: th.cardMuted}}>{fmt(max, 0)}</div>
    </div>
  );
};

const Meter: React.FC<ShotProps<P>> = ({params: p, t, dur, beat}) => {
  const th = useTheme();
  const {max, value, from, style, bad} = norm(p);
  const pl = plan(p, dur, beat);
  const dec = Number.isInteger(value) && Number.isInteger(from) ? 0 : 1;
  const discrete = style === 'gauge' && Number.isInteger(max) && max <= 10 && dec === 0;
  const s = t < pl.start ? 0 : spring({frame: Math.round((t - pl.start) * FPS), fps: FPS, config: SPR});
  const cur = from + (value - from) * s;
  // 显示的数字不越过目标（弹簧过冲只让指针晃，不让数字跳过头）
  const shownV = value >= from ? Math.min(cur, value) : Math.max(cur, value);
  const landed = t >= pl.land;
  const shownNum = landed ? value : shownV;
  const shownColor = scaleColor(th, (discrete ? Math.max(0.5, Math.round(shownNum) - 0.5) : shownNum) / max, bad);
  const finalColor = scaleColor(th, (discrete ? Math.max(0.5, value - 0.5) : value) / max, bad);
  const hit = bump(t, pl.land, 0.5);
  const ripple = landed ? Math.min(1, (t - pl.land) / 0.6) : 0;
  const enter = pop(t, 0, 16, 170);
  const wordP = pop(t, pl.land, 12, 200);
  const noteP = pop(t, pl.noteAt, 16, 170);

  const W = CARD.w;
  const inner = W - 2 * CARD.padX;
  const unit = p.unit ?? '';
  const numStr = fmt(shownNum, dec);
  const tail = unit || `/${fmt(max, 0)}`;
  // 数字 + 尾巴（单位或 /满分）按宽度自动缩：数字等宽 0.6em
  const numEm = fmt(value >= from ? value : from, dec).length * 0.6 + (unit ? units(unit) * 0.34 + 0.08 : tail.length * 0.6 * 0.36);
  const numSize = Math.max(96, Math.min(style === 'ring' ? 136 : 150, Math.floor((style === 'ring' ? 300 : 360) / numEm)));
  const num = (
    <div style={{fontFamily: MONO, fontWeight: 700, fontSize: numSize, lineHeight: 1, color: shownColor, whiteSpace: 'nowrap', transformOrigin: '50% 80%', transform: `scale(${1 + hit * 0.35})`}}>
      {numStr}
      <span style={{fontFamily: unit ? FONT : MONO, fontWeight: unit ? 800 : 700, fontSize: numSize * (unit ? 0.34 : 0.36), color: unit ? shownColor : th.cardMuted, marginLeft: unit ? 8 : 2}}>{tail}</span>
    </div>
  );
  const word = p.word ? (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 42,
        color: '#ffffff',
        background: finalColor,
        padding: '6px 30px',
        borderRadius: 40,
        whiteSpace: 'nowrap',
        boxShadow: `0 8px 20px ${alpha(finalColor, 0.35)}`,
        opacity: landed ? Math.min(1, wordP * 2) : 0,
        transform: `scale(${landed ? 0.5 + 0.5 * wordP : 0.5})`,
      }}
    >
      {p.word}
    </div>
  ) : null;

  const vizH = style === 'ring' ? 2 * (200 + 23 + 10) : style === 'bar' ? 390 : GS / 2 + GR + 14 + 110;
  const HEAD = 76;
  const NOTE = p.note ? 106 : 0;
  const cardH = 34 + HEAD + 18 + vizH + (NOTE ? 22 + NOTE : 0) + 30;
  const cardY = MAIN.y0 + Math.max(0, Math.round((MAIN.h - cardH) / 2));
  const labelSize = fitLine(p.label ?? '', inner - 100, 46, 36);
  const noteSize = fitLine(p.note ?? '', inner - 150, 42, 36);
  const noteIcon = bad ? (value / max >= 0.5 ? 'alert' : 'check') : value / max >= 0.5 ? 'check' : 'alert';
  const icon = isIcon(p.icon) ? p.icon : bad ? 'alert' : 'star';

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <Card
        radius={40}
        style={{
          position: 'absolute',
          left: CARD.x0,
          top: cardY,
          width: W,
          height: cardH,
          padding: `34px ${CARD.padX}px 30px`,
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 60}px) scale(${0.94 + 0.06 * enter})`,
          overflow: 'hidden',
        }}
      >
        {/* 顶栏：图标 + 仪表名 + 状态点 */}
        <div style={{height: HEAD, display: 'flex', alignItems: 'center', gap: 20}}>
          <IconDisc name={icon} size={72} tone={bad ? 'warn' : 'accent'} soft />
          <div style={{flex: 1, fontSize: labelSize, fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap'}}>{p.label}</div>
          <div style={{display: 'flex', gap: 8}}>
            {[0, 1, 2].map((i) => {
              const on = landed ? 1 : 0.35 + 0.65 * Math.max(0, Math.sin(t * 9 - i * 0.9));
              return <div key={i} style={{width: 14, height: 14, borderRadius: 7, background: landed ? finalColor : th.cardMuted, opacity: on}} />;
            })}
          </div>
        </div>
        <div style={{marginTop: 18, display: 'flex', justifyContent: 'center'}}>
          {style === 'ring' ? (
            <RingViz w={inner} cur={cur} max={max} bad={bad} shownColor={shownColor} ripple={ripple} num={num} word={word} t={t} />
          ) : style === 'bar' ? (
            <BarViz w={inner} cur={cur} max={max} bad={bad} shownColor={shownColor} ripple={ripple} num={num} word={word} />
          ) : (
            <GaugeViz w={inner} cur={cur} max={max} bad={bad} shownColor={shownColor} ripple={ripple} discrete={discrete} num={num} word={word} t={t} />
          )}
        </div>
        {p.note && (
          <div style={{marginTop: 22, height: NOTE, position: 'relative'}}>
            {/* 结论出来之前：骨架条在「加载」，卡片下半不空 */}
            {noteP < 1 && (
              <div style={{position: 'absolute', inset: 0, borderRadius: 26, background: th.cardAlt, display: 'flex', alignItems: 'center', gap: 20, padding: '0 28px', opacity: 1 - noteP}}>
                <div style={{width: 50, height: 50, borderRadius: 25, background: th.line}} />
                <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 12}}>
                  {[0.82, 0.5].map((wk, i) => (
                    <div key={i} style={{width: `${wk * 100}%`, height: 16, borderRadius: 8, background: th.line, opacity: 0.6 + 0.4 * Math.sin(t * 8 - i)}} />
                  ))}
                </div>
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '0 28px',
                borderRadius: 26,
                background: alpha(finalColor, th.dark ? 0.2 : 0.1),
                borderLeft: `10px solid ${finalColor}`,
                opacity: t >= pl.noteAt ? Math.min(1, noteP * 1.5) : 0,
                transform: `translateY(${(1 - (t >= pl.noteAt ? noteP : 0)) * 30}px)`,
              }}
            >
              <Icon name={noteIcon} size={50} color={finalColor} stroke={2.6} />
              <div style={{fontSize: noteSize, fontWeight: 800, color: th.cardText, whiteSpace: 'nowrap'}}>{p.note}</div>
            </div>
          </div>
        )}
      </Card>
      {/* 落定时卡片外一圈光晕 */}
      {landed && ripple < 1 && (
        <div
          style={{
            position: 'absolute',
            left: CARD.x0,
            top: cardY,
            width: W,
            height: cardH,
            borderRadius: 40,
            boxShadow: `0 0 0 ${6 + ripple * 18}px ${alpha(finalColor, 0.35 * (1 - ripple))}`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

export default Meter;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur, ctx.beat);
  const {max, value, bad} = norm(p);
  const good = bad ? value / max < 0.4 : value / max >= 0.6;
  const out: SfxCue[] = [
    {at: 0.05, kind: 'pop', vol: 0.2},
    {at: Math.max(0.1, pl.start), kind: 'swish', vol: 0.22},
    {at: pl.land, kind: 'thud', vol: 0.42},
  ];
  if (good) out.push({at: pl.land + 0.08, kind: 'ding', vol: 0.18});
  if (p.note) out.push({at: pl.noteAt, kind: 'pop', vol: 0.16});
  return out;
};
