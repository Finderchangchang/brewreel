import React from 'react';
import {Img, OffthreadVideo, staticFile} from 'remotion';
import {easeIn, easeOut, fitTimeline, float, mix, pop} from '../core/anim';
import {fitLine} from '../core/fit';
import {FONT} from '../core/font';
import {Icon} from '../core/icons';
import {alpha, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// phone：手机框（居中，完整落在主体区 y 572–1332）+ 用户真截图/录屏 + 1–3 处圈注。
// 圈注按整拍依次出现，三种样式：
//   zoom  放大镜：该段从手机里「弹出」成 720 宽的放大卡片（投影光束连着原位置）+ 标签；下一处出现时缩回去，原位留编号框
//   box   高亮框：描边画框 + 编号 + 标签胶囊（常驻）
//   arrow 箭头：手机外侧大箭头指向该段 + 标签胶囊（常驻）
// 当前圈注以外的屏幕区域压暗（聚光）。截图只在手机框里，不整屏放大来回动。
// 没素材（校验会拦，这里兜底）时画一张中性骨架屏，不出现空白。
// ============================================================
type Area = 'top' | 'upper' | 'middle' | 'lower' | 'bottom';
type Mark = {area: Area; label: string; style?: 'zoom' | 'box' | 'arrow'};
type P = {src?: string; focus?: Mark[]; videoStart?: number};

const AREAS: Area[] = ['top', 'upper', 'middle', 'lower', 'bottom'];

// ---------- 版面常量 ----------
const PW = 364;
const PH = 760;
const PX = 540 - PW / 2; // 358
const PY = 572;
const BZ = 12;
const SX = PX + BZ; // 屏幕左 370
const SY = PY + BZ; // 屏幕上 584
const SW = PW - 2 * BZ; // 340
const SH = PH - 2 * BZ; // 736
const BAND = SH / 5;
const ZX = 180; // 放大卡片
const ZW = 720;
const ZS = ZW / SW;
const ZH = BAND * ZS;
const ZB = 8; // 卡片边框
const PILL_H = 84;

const areaIdx = (a?: string) => Math.max(0, AREAS.indexOf((a ?? 'middle') as Area));
const bandTop = (a?: string) => SY + areaIdx(a) * BAND;
const isVideo = (src?: string) => !!src && /\.(mp4|webm|mov|m4v)$/i.test(src);

// ---------- 时间线 ----------
export const plan = (p: P, dur: number, beat: number) => {
  const marks = (p.focus ?? []).slice(0, 3);
  const raw = marks.map((_, i) => beat * (1 + 2 * i));
  const end = marks.length ? raw[raw.length - 1] + beat * 2 : beat;
  const k = fitTimeline(end, dur, 0.3);
  return {marks, at: raw.map((v) => v * k)};
};

// ---------- 屏幕内容：截图 / 录屏 / 骨架屏 ----------
const Screen: React.FC<{src?: string; videoStart?: number}> = ({src, videoStart}) => {
  const th = useTheme();
  if (src && isVideo(src))
    return <OffthreadVideo src={staticFile(src)} muted trimBefore={Math.round((videoStart ?? 0) * 30)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%'}} />;
  if (src) return <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%'}} />;
  // 兜底骨架屏（相对单位，放大后依旧清楚）
  const bar = (w: string, h: string, c: string, mt = '0') => <div style={{width: w, height: h, background: c, borderRadius: '0.4em', marginTop: mt}} />;
  return (
    <div style={{width: '100%', height: '100%', background: th.dark ? '#10131c' : '#F2F4F7', fontSize: 10, display: 'flex', flexDirection: 'column'}}>
      <div style={{height: '9%', background: th.accent}} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{margin: '5% 5% 0', height: i === 0 ? '17%' : '12%', background: th.dark ? '#1b2030' : '#fff', borderRadius: '1.2em', padding: '5%', boxSizing: 'border-box', display: 'flex', gap: '6%'}}>
          {i > 0 && <div style={{width: '22%', height: '100%', borderRadius: '0.8em', background: alpha(th.accent, 0.18)}} />}
          <div style={{flex: 1}}>
            {bar('60%', '1.6em', th.dark ? '#3a4260' : '#1f2937')}
            {bar('90%', '1.1em', th.dark ? '#2a3148' : '#9CA3AF', '1.2em')}
            {i === 0 && bar('80%', '1.1em', th.dark ? '#2a3148' : '#9CA3AF', '1em')}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------- 装饰：主体区外侧漂浮小图标 ----------
const Floaty: React.FC<{x: number; y: number; icon: string; t: number; ph: number; rot: number}> = ({x, y, icon, t, ph, rot}) => {
  const th = useTheme();
  const q = pop(t, 0.1, 14, 170);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + float(t, ph, 10),
        width: 96,
        height: 96,
        borderRadius: 30,
        background: th.card,
        boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${rot}deg) scale(${q})`,
        opacity: 0.95,
      }}
    >
      <Icon name={icon} size={48} color={th.accent} stroke={2.4} />
    </div>
  );
};

// ---------- 标签胶囊（编号 + 文字） ----------
const Label: React.FC<{n: number; text: string; q: number; style?: React.CSSProperties}> = ({n, text, q, style}) => {
  const th = useTheme();
  const size = fitLine(text, 520, 44, 36);
  return (
    <div
      style={{
        position: 'absolute',
        height: PILL_H,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 34px 0 14px',
        borderRadius: PILL_H / 2,
        background: th.card,
        border: `4px solid ${th.accent}`,
        boxShadow: `0 14px 30px ${alpha('#000000', 0.22)}`,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: size,
        color: th.cardText,
        whiteSpace: 'nowrap',
        opacity: Math.min(1, q * 1.6),
        ...style,
        transform: `${style?.transform ?? ''} scale(${0.6 + 0.4 * q})`,
      }}
    >
      <div style={{width: 54, height: 54, borderRadius: 27, background: th.accent, color: th.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, flex: 'none'}}>
        {n}
      </div>
      {text}
    </div>
  );
};

// ---------- 描边框（在屏幕上），d = 0..1 画出进度 ----------
const BoxStroke: React.FC<{top: number; d: number; n: number; dim?: boolean}> = ({top, d, n, dim}) => {
  const th = useTheme();
  if (d <= 0) return null;
  const x = SX - 6;
  const w = SW + 12;
  const h = BAND + 12;
  const per = 2 * (w + h);
  return (
    <>
      <svg width={w + 20} height={h + 20} style={{position: 'absolute', left: x - 10, top: top - 16, overflow: 'visible', filter: `drop-shadow(0 0 10px ${alpha(th.accent, 0.7)})`, opacity: dim ? 0.75 : 1}}>
        <rect x={10} y={10} width={w} height={h} rx={16} fill="none" stroke={th.accent} strokeWidth={7} strokeDasharray={`${per * d} ${per}`} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: x - 22,
          top: top - 30,
          width: 48,
          height: 48,
          borderRadius: 24,
          background: th.accent,
          color: th.accentText,
          border: '4px solid #ffffff',
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${Math.min(1, d * 1.4)})`,
          opacity: dim ? 0.85 : 1,
        }}
      >
        {n}
      </div>
    </>
  );
};

// ---------- 放大镜卡片 ----------
const Zoom: React.FC<{p: P; m: Mark; i: number; k: number; lq: number}> = ({p, m, i, k, lq}) => {
  const th = useTheme();
  if (k <= 0.01) return null;
  const bT = bandTop(m.area);
  // 放大卡片放在原位置的另一侧（上段→下方，下段→上方，中段→盖在原位），光束把两者连起来
  const ai = areaIdx(m.area);
  const outer = ZH + 2 * ZB;
  const wantTop = ai <= 1 ? bT + BAND + 34 : ai >= 3 ? bT - 34 - outer - PILL_H / 2 : bT + BAND / 2 - outer / 2;
  const cardTop = Math.max(PY + 4, Math.min(1334 - outer - PILL_H / 2 - 6, wantTop));
  const x = mix(SX, ZX, k);
  const y = mix(bT, cardTop + ZB, k);
  const w = mix(SW, ZW, k);
  const s = w / SW;
  const h = BAND * s;
  const off = areaIdx(m.area) * BAND * s;
  const beam = alpha(th.accent, 0.2 * k);
  return (
    <>
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <polygon points={`${SX},${bT} ${SX},${bT + BAND} ${x},${y + h} ${x},${y}`} fill={beam} />
        <polygon points={`${SX + SW},${bT} ${SX + SW},${bT + BAND} ${x + w},${y + h} ${x + w},${y}`} fill={beam} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: x - ZB * k,
          top: y - ZB * k,
          width: w + 2 * ZB * k,
          height: h + 2 * ZB * k,
          boxSizing: 'border-box',
          borderRadius: 26,
          background: th.card,
          border: `${ZB * k}px solid ${th.card}`,
          boxShadow: `0 26px 60px rgba(0,0,0,${0.34 * k}), 0 0 0 ${4 * k}px ${th.accent}`,
          overflow: 'hidden',
        }}
      >
        <div style={{position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 18}}>
          <div style={{position: 'absolute', left: 0, top: -off, width: SW * s, height: SH * s}}>
            <Screen src={p.src} videoStart={p.videoStart} />
          </div>
        </div>
      </div>
      {/* 放大镜角标 */}
      <div
        style={{
          position: 'absolute',
          left: x + w - 40,
          top: y - 34,
          width: 72,
          height: 72,
          borderRadius: 36,
          background: th.accent,
          border: '5px solid #ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${k})`,
          boxShadow: `0 8px 20px ${alpha(th.accent, 0.45)}`,
        }}
      >
        <Icon name="search" size={38} color={th.accentText} stroke={2.8} />
      </div>
      <div style={{position: 'absolute', left: 150, width: 780, top: y + h + ZB * k - PILL_H / 2, display: 'flex', justifyContent: 'center'}}>
        <Label n={i + 1} text={m.label} q={lq * k} style={{position: 'relative'}} />
      </div>
    </>
  );
};

// ---------- 箭头（手机外侧指向该段） ----------
const Arrow: React.FC<{y: number; right: boolean; q: number; t: number}> = ({y, right, q, t}) => {
  const th = useTheme();
  const bob = Math.sin(t * Math.PI * 2) * 12;
  const len = 150;
  const x0 = right ? SX + SW + 26 : SX - 26 - len;
  return (
    <div
      style={{
        position: 'absolute',
        left: x0 + (right ? 1 : -1) * (bob + (1 - q) * 80),
        top: y - 50,
        width: len,
        height: 100,
        opacity: Math.min(1, q * 2),
        transform: right ? 'none' : 'scaleX(-1)',
      }}
    >
      <svg width={len} height={100} viewBox={`0 0 ${len} 100`} style={{overflow: 'visible', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.25))'}}>
        <path d={`M ${len} 50 L 48 50`} stroke="#ffffff" strokeWidth={34} strokeLinecap="round" />
        <path d="M 60 12 L 14 50 L 60 88" stroke="#ffffff" strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={`M ${len} 50 L 48 50`} stroke={th.accent} strokeWidth={20} strokeLinecap="round" />
        <path d="M 60 12 L 14 50 L 60 88" stroke={th.accent} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
};

const Phone: React.FC<ShotProps<P>> = ({params: p, t, dur, beat}) => {
  const th = useTheme();
  const pl = plan(p, dur, beat);
  const enter = pop(t, 0, 15, 150);
  // 当前聚光的圈注
  let cur = -1;
  pl.at.forEach((a, i) => {
    if (t >= a) cur = i;
  });
  const dimIn = pl.at.length ? easeOut(t, pl.at[0], 0.3) : 0;
  const spotTop = (() => {
    if (cur < 0) return bandTop(pl.marks[0]?.area);
    const from = cur > 0 ? bandTop(pl.marks[cur - 1].area) : bandTop(pl.marks[cur].area);
    return mix(from, bandTop(pl.marks[cur].area), easeOut(t, pl.at[cur], 0.3));
  })();
  const halo = (t % 1.6) / 1.6;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: 540 - 460, top: PY + PH / 2 - 460, width: 920, height: 920, borderRadius: '50%', background: `radial-gradient(circle, ${alpha('#ffffff', th.dark ? 0.12 : 0.3)} 0%, ${alpha('#ffffff', 0)} 68%)`, opacity: Math.min(1, enter * 2)}} />
      <Floaty x={40} y={700} icon="search" t={t} ph={0} rot={-10} />
      <Floaty x={944} y={1110} icon="sparkle" t={t} ph={Math.PI} rot={10} />
      {/* 手机 */}
      <div
        style={{
          position: 'absolute',
          left: PX,
          top: PY,
          width: PW,
          height: PH,
          opacity: Math.min(1, enter * 2),
          transform: `perspective(1600px) translateY(${(1 - enter) * 90}px) rotateY(${(1 - enter) * -22}deg) scale(${0.9 + 0.1 * enter})`,
        }}
      >
        <div style={{position: 'absolute', inset: -36, borderRadius: 90, border: `4px solid ${alpha('#ffffff', 0.35)}`, transform: `scale(${1 + halo * 0.08})`, opacity: 1 - halo}} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 58,
            background: 'linear-gradient(135deg, #ffffff 0%, #eef0f4 30%, #cfd2da 70%, #b9bdc8 100%)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.32), inset 0 3px 0 #ffffff',
          }}
        />
        <div style={{position: 'absolute', right: -5, top: 170, width: 6, height: 90, borderRadius: 3, background: '#b0b4be'}} />
        <div style={{position: 'absolute', left: BZ, top: BZ, width: SW, height: SH, borderRadius: 46, overflow: 'hidden', background: '#ffffff', boxShadow: 'inset 0 0 0 3px #2a2b33'}}>
          <Screen src={p.src} videoStart={p.videoStart} />
          {/* 聚光：当前圈注段以外压暗 */}
          {dimIn > 0 && (
            <div style={{position: 'absolute', left: 0, width: SW, top: spotTop - SY, height: BAND, boxShadow: `0 0 0 1200px rgba(8,10,20,${0.42 * dimIn})`}} />
          )}
        </div>
        <div style={{position: 'absolute', left: PW / 2 - 60, top: BZ + 10, width: 120, height: 30, borderRadius: 15, background: '#1c1d22'}} />
      </div>
      {/* 圈注 */}
      {pl.marks.map((m, i) => {
        const at = pl.at[i];
        if (t < at) return null;
        const style = m.style ?? 'zoom';
        const bT = bandTop(m.area);
        const draw = easeOut(t, at, 0.3);
        const right = i % 2 === 0;
        const lq = pop(t, at + 0.12, 13, 190);
        if (style === 'zoom') {
          const next = pl.at[i + 1];
          const k = pop(t, at + 0.1, 15, 160) * (next !== undefined ? 1 - easeIn(t, next, 0.28) : 1);
          return (
            <React.Fragment key={i}>
              <BoxStroke top={bT} d={draw} n={i + 1} dim={i !== cur} />
              <Zoom p={p} m={m} i={i} k={k} lq={lq} />
            </React.Fragment>
          );
        }
        // box / arrow：标签胶囊放在该段下方（lower/bottom 放上方），左右交替
        const below = areaIdx(m.area) <= 2;
        const pillTop = below ? bT + BAND + 22 : bT - 22 - PILL_H;
        return (
          <React.Fragment key={i}>
            {style === 'box' ? <BoxStroke top={bT} d={draw} n={i + 1} dim={i !== cur} /> : <Arrow y={bT + BAND / 2} right={right} q={lq} t={t - at} />}
            <Label n={i + 1} text={m.label} q={lq} style={right ? {top: pillTop, right: 180, transformOrigin: '80% 50%'} : {top: pillTop, left: 180, transformOrigin: '20% 50%'}} />
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Phone;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur, ctx.beat);
  const out: SfxCue[] = [{at: 0.05, kind: 'whoosh', vol: 0.28}];
  pl.at.forEach((at, i) => {
    const st = pl.marks[i].style ?? 'zoom';
    out.push({at, kind: st === 'zoom' ? 'pop' : 'tap', vol: st === 'zoom' ? 0.28 : 0.3});
    if (st === 'zoom') out.push({at: at + 0.12, kind: 'swish', vol: 0.14});
  });
  return out;
};
