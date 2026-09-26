import React from 'react';
import {Easing, spring} from 'remotion';
import {FPS} from '../../../core/safe';
import {fitSize, glueBreaks} from '../../../core/fit';
import {starPath} from './rider';
import type {World} from './city';
import {mixHex, tint} from './city';
import type {District} from './plan';

// ============================================================
// 界面元件（本风格自己的「旅行文具」皮肤）：
//   开场翻牌站牌大字（HookTitle）、顶部车票（RouteTicket：路线 + 站点 + 当前站名 + 票根上的产品名）、
//   每站一张航空信封边的明信片（Postcard：屏幕层，甩进来、看完「寄出」缩进车票上这一站）、路牌、气泡、拟声字。
// 世界里的字（路牌、道具上的字）跟着所在层滚动；为了「任何时刻截图都不出现半截字」，贴边淡出。
// ============================================================
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const springAt = (dt: number, damping = 12, stiffness = 200) => (dt < 0 ? 0 : spring({frame: Math.round(dt * FPS), fps: FPS, config: {damping, stiffness}}));
const easeIO = Easing.inOut(Easing.cubic);

/** 贴边淡出：文字框 [x0,x1] 完全在卡片区里（离边 ≥ fadePx）= 1，碰到边就是 0——不出现被画框切掉的半截字 */
export const edgeFade = (w: World, x0: number, x1: number) => {
  const f: number = w.tk.motion?.edgeFadePx ?? 48;
  const c = w.geo.card;
  return clamp01((x0 - c.x0 + 4) / f) * clamp01((c.x1 + 4 - x1) / f);
};

/** 粗略字宽（px）：汉字 1em，其余 0.56em */
export const textW = (s: string, size: number) => {
  let n = 0;
  for (const ch of Array.from(s)) n += /[⺀-鿿＀-￯　-〿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.56;
  return n * size;
};
const isWide = (ch: string) => /[⺀-鿿＀-￯　-〿]/.test(ch);
const shadowOf = (ink: string, a: number) => {
  const s = ink.replace('#', '');
  return `rgba(${parseInt(s.slice(0, 2), 16)},${parseInt(s.slice(2, 4), 16)},${parseInt(s.slice(4, 6), 16)},${a})`;
};

// ---------------- 开场：翻牌站牌大字 ----------------
/**
 * 大字拆成一块块翻牌（像车站的翻牌时刻表）：第 0 帧就完整可读，flipAt 起每块牌依次「翻一下」（上半片扫过），
 * 数字用高亮色。小引是一行带荧光笔底色的字。退场时牌子逐块上翻淡出。
 */
export const HookTitle: React.FC<{w: World; kicker?: string; headline: string; t0: number; dur: number}> = ({w, kicker, headline, t0, dur}) => {
  const {pal, tk, geo, lay} = w;
  const m = tk.motion ?? {};
  const ty = tk.type ?? {};
  const lt = w.t - t0;
  const outAt = dur * (m.hookOutAt ?? 0.88);
  const outD: number = m.hookOut ?? 0.2;
  if (lt > outAt + outD + 0.3) return null;
  const pin = springAt(lt, 12, 240);
  const from: number = m.hookFrom ?? 0.9;
  const chars = Array.from(headline);
  const maxW = geo.card.x1 - geo.card.x0 - 40;
  // 每块牌的宽（按 1px 字号算）：汉字 1.16，其余 0.78；空格只留缝
  const unit = chars.reduce((a, ch) => a + (ch === ' ' ? 0.22 : (isWide(ch) ? 1.16 : 0.78) + 0.07), 0);
  const size = Math.max(ty.hookHeadlineMin ?? 64, Math.min(ty.hookHeadline ?? 116, Math.floor(maxW / Math.max(1, unit))));
  const tileH = size * 1.24;
  const ink = pal.ink;
  const fAt: number = m.flipAt ?? 0.22;
  const fGap: number = m.flipGap ?? 0.05;
  const fDur: number = m.flipDur ?? 0.14;
  const kOut = clamp01((lt - outAt) / outD);
  let idx = -1;
  return (
    <>
      {kicker ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: lay.hookKickerY, textAlign: 'center', opacity: 1 - kOut, transform: `translateY(${-kOut * 30}px)`}}>
          <span style={{fontSize: ty.hookKicker ?? 48, fontWeight: 800, color: ink, lineHeight: 1.25, padding: '0 14px', background: `linear-gradient(transparent 58%, ${mixHex(pal.accent, '#FFFFFF', 0.35)} 58%, ${mixHex(pal.accent, '#FFFFFF', 0.35)} 92%, transparent 92%)`, whiteSpace: 'nowrap'}}>{kicker}</span>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, top: lay.hookHeadlineY, height: tileH, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: size * 0.07, transform: `scale(${from + (1 - from) * pin})`, transformOrigin: '50% 50%'}}>
        {chars.map((ch, i) => {
          if (ch === ' ') return <div key={i} style={{width: size * 0.15}} />;
          idx++;
          const j = idx;
          const ft = lt - (fAt + j * fGap);
          const flap = ft >= 0 && ft < fDur ? Math.sin((ft / fDur) * Math.PI) : 0;
          const o = clamp01((lt - outAt - j * 0.03) / outD);
          const up = easeIO(o);
          const digit = /[0-9０-９]/.test(ch);
          const cw = size * (isWide(ch) ? 1.16 : 0.78);
          return (
            <div key={i} style={{position: 'relative', width: cw, height: tileH, borderRadius: tk.radius?.flap ?? 10, background: pal.flap, border: `3px solid ${ink}`, boxShadow: `0 ${size * 0.06}px 0 ${shadowOf(ink, 0.28)}`, boxSizing: 'border-box', overflow: 'hidden', transform: `translateY(${-up * 70}px) rotateX(${up * 80}deg)`, opacity: 1 - up}}>
              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size, fontWeight: 900, color: digit ? pal.flapHi : pal.flapInk, lineHeight: 1}}>{ch}</div>
              {/* 翻牌中缝 + 两侧轴钉 */}
              <div style={{position: 'absolute', left: 0, right: 0, top: tileH / 2 - 3, height: 4, background: shadowOf('#000000', 0.5)}} />
              <div style={{position: 'absolute', left: 3, top: tileH / 2 - 8, width: 6, height: 14, borderRadius: 3, background: mixHex(pal.flap, '#FFFFFF', 0.35)}} />
              <div style={{position: 'absolute', right: 3, top: tileH / 2 - 8, width: 6, height: 14, borderRadius: 3, background: mixHex(pal.flap, '#FFFFFF', 0.35)}} />
              {flap > 0 ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: tileH / 2, background: mixHex(pal.flap, '#000000', 0.25), transform: `scaleY(${flap})`, transformOrigin: '50% 100%'}} /> : null}
            </div>
          );
        })}
      </div>
    </>
  );
};

// ---------------- 顶部车票：路线 + 站点 + 当前站名，票根写产品名 ----------------
export const ticketRect = (w: World) => {
  const tall = w.geo.h > 1500;
  const [y0, h] = (w.lay.ticket as [number, number]) ?? [110, 92];
  const x0 = w.geo.card.x0 + (tall ? 0 : 30);
  const x1 = w.geo.card.x1 - (tall ? 0 : 30);
  const stubW = tall ? 196 : 206;
  const px = x1 - stubW;
  const rx0 = x0 + 44;
  const rx1 = px - 46;
  const lineY = y0 + h - 25;
  return {x0, x1, y0, h, px, rx0, rx1, lineY};
};
/** 车票上第 k 站的站点 x（k = n 是终点旗） */
export const ticketNodeX = (w: World, k: number) => {
  const R = ticketRect(w);
  const n = Math.max(1, w.plan.districts.length);
  return R.rx0 + ((k + 1) / (n + 1)) * (R.rx1 - R.rx0);
};
/** 小人标记在路线上的 x：开场在起点，每站从本站站点走到下一站，片尾到终点 */
const markerX = (w: World) => {
  const {plan, t} = w;
  const R = ticketRect(w);
  const n = plan.districts.length;
  const pts: [number, number][] = [];
  const op = plan.opening;
  if (op) pts.push([op.start, R.rx0], [op.start + op.dur * (w.tk.camera?.takeoffFrom ?? 0.45), R.rx0]);
  plan.districts.forEach((d) => pts.push([d.start, ticketNodeX(w, d.k)]));
  pts.push([plan.finale ? plan.finale.start : plan.total, ticketNodeX(w, n)]);
  if (!pts.length) return R.rx0;
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [ta, xa] = pts[i - 1];
      const [tb, xb] = pts[i];
      return xa + (xb - xa) * clamp01((t - ta) / Math.max(1e-3, tb - ta));
    }
  }
  return pts[pts.length - 1][1];
};

export const RouteTicket: React.FC<{w: World; product: string; hide: number}> = ({w, product, hide}) => {
  const {plan, t, pal, tk} = w;
  const R = ticketRect(w);
  const {x0, x1, y0, h, px, rx0, rx1, lineY} = R;
  const k = plan.districtAt(t);
  const d = k >= 0 && !(plan.finale && t >= plan.finale.start) ? plan.districts[k] : undefined;
  const n = plan.districts.length;
  const ty = tk.type ?? {};
  const ink = pal.ink;
  const sw: number = tk.outline?.ticket ?? 3.5;
  const r: number = tk.radius?.ticket ?? 14;
  const nr = 13;
  const W = x1 - x0;
  // 票面外形：圆角矩形，打孔线上下各咬一个半圆缺口；右边一截是票根
  const L = (x: number) => x - x0;
  const T = (y: number) => y - y0;
  const P = L(px);
  const body = `M ${r} 0 L ${P - nr} 0 A ${nr} ${nr} 0 0 0 ${P + nr} 0 L ${W - r} 0 Q ${W} 0 ${W} ${r} L ${W} ${h - r} Q ${W} ${h} ${W - r} ${h} L ${P + nr} ${h} A ${nr} ${nr} 0 0 0 ${P - nr} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
  const stub = `M ${P + nr} 0 L ${W - r} 0 Q ${W} 0 ${W} ${r} L ${W} ${h - r} Q ${W} ${h} ${W - r} ${h} L ${P + nr} ${h} A ${nr} ${nr} 0 0 0 ${P} ${h - nr} L ${P} ${nr} A ${nr} ${nr} 0 0 0 ${P + nr} 0 Z`;
  const mx = markerX(w);
  const swap = d ? clamp01((t - d.start) / (tk.motion?.ticketSwap ?? 0.18)) : 1;
  const label = d ? d.category : '';
  const no = d ? String(d.k + 1).padStart(2, '0') : '';
  const lsize: number = ty.ticketStation ?? 34;
  const nsize: number = ty.ticketNo ?? 26;
  const lw = textW(label, lsize) + textW(no, nsize) + 12;
  const lx = d ? Math.max(rx0 - 20, Math.min(rx1 + 20 - lw, ticketNodeX(w, d.k) - lw / 2)) : rx0;
  const bsize = fitSize(product, px === x1 ? 0 : x1 - px - 44, ty.ticketBrand ?? 30, 26, 0);
  return (
    <div style={{position: 'absolute', left: x0, top: y0 - hide * 40, width: W, height: h, opacity: 1 - hide}}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={W} height={h}>
        <path d={body} transform="translate(5 7)" fill={shadowOf(ink, 0.18)} />
        <path d={body} fill={pal.card} />
        <path d={stub} fill={pal.brand} />
        <line x1={P} y1={nr + 4} x2={P} y2={h - nr - 4} stroke={mixHex(pal.brand, '#FFFFFF', 0.55)} strokeWidth={3} strokeDasharray="6 6" />
        <path d={body} fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        {/* 路线：底线虚线，走过的一段实线 */}
        <line x1={L(rx0)} y1={T(lineY)} x2={L(ticketNodeX(w, n))} y2={T(lineY)} stroke={mixHex(ink, '#FFFFFF', 0.55)} strokeWidth={5} strokeDasharray="10 8" strokeLinecap="round" />
        <line x1={L(rx0)} y1={T(lineY)} x2={L(mx)} y2={T(lineY)} stroke={pal.brand} strokeWidth={8} strokeLinecap="round" />
        <circle cx={L(rx0)} cy={T(lineY)} r={7} fill={pal.brand} stroke={ink} strokeWidth={3} />
        {plan.districts.map((x) => {
          const cx = L(ticketNodeX(w, x.k));
          const passed = k > x.k || (plan.finale && t >= plan.finale.start);
          const cur = d && x.k === k;
          if (cur) {
            const pulse = 1 + 0.25 * Math.sin(swap * Math.PI);
            return (
              <g key={x.k}>
                <circle cx={cx} cy={T(lineY)} r={16 * pulse} fill={pal.card} stroke={ink} strokeWidth={3} />
                <circle cx={cx} cy={T(lineY)} r={9 * pulse} fill={x.color} />
              </g>
            );
          }
          return <circle key={x.k} cx={cx} cy={T(lineY)} r={passed ? 11 : 9} fill={passed ? x.color : pal.card} stroke={ink} strokeWidth={3} />;
        })}
        {/* 终点旗 */}
        <g transform={`translate(${L(ticketNodeX(w, n))} ${T(lineY)})`}>
          <line x1={0} y1={8} x2={0} y2={-34} stroke={ink} strokeWidth={4} strokeLinecap="round" />
          <path d="M 0 -34 L 26 -26 L 0 -16 Z" fill={pal.brand} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        </g>
        {/* 小人标记：一颗高亮色的圆钉，带两道速度线 */}
        <g transform={`translate(${L(mx)} ${T(lineY)})`}>
          <line x1={-30} y1={-5} x2={-20} y2={-5} stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
          <line x1={-34} y1={4} x2={-22} y2={4} stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
          <circle r={13} fill={pal.accent} stroke={ink} strokeWidth={3.5} />
          <circle r={4.5} fill={ink} />
        </g>
      </svg>
      {d ? (
        <div style={{position: 'absolute', left: L(lx), top: 6 + (1 - swap) * 14, height: lsize * 1.25, display: 'flex', alignItems: 'baseline', gap: 10, opacity: swap, whiteSpace: 'nowrap'}}>
          <span style={{fontSize: nsize, fontWeight: 800, color: pal.brand, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2}}>{no}</span>
          <span style={{fontSize: lsize, fontWeight: 800, color: ink, lineHeight: 1.2}}>{label}</span>
        </div>
      ) : null}
      {product ? (
        <div style={{position: 'absolute', left: P + 14, width: W - P - 22, top: 0, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: bsize, fontWeight: 800, color: pal.brandInk, whiteSpace: 'nowrap', lineHeight: 1.2}}>{product}</div>
      ) : null}
    </div>
  );
};

// ---------------- 明信片（每站一张，屏幕层；夜里只是纸色偏暖，没有霓虹 / 故障模式） ----------------
/** 明信片节拍：第 cardInBeat 拍甩进来，cardTextDelay 秒后出字；第 cardOutBeat 拍「寄出」（缩进车票上这一站的站点） */
export const cardTimes = (w: World, d: District) => {
  const cam = w.tk.camera ?? {};
  const tin = d.start + (cam.cardInBeat ?? 0.3) * w.plan.beat;
  const tout = d.start + (cam.cardOutBeat ?? 7.1) * w.plan.beat;
  return {tin, tout};
};

/** 邮票齿孔边：一圈小圆 + 白底 */
const Stamp: React.FC<{x: number; y: number; sw: number; sh: number; color: string; ink: string; no: string; size: number; rot: number; glow?: boolean}> = ({x, y, sw, sh, color, ink, no, size, rot, glow}) => {
  const holes: React.ReactNode[] = [];
  const g = 12;
  for (let i = 0; i <= Math.round(sw / g); i++) {
    const xx = (i * sw) / Math.round(sw / g);
    holes.push(<circle key={`t${i}`} cx={xx} cy={0} r={5} fill="#FFFFFF" />, <circle key={`b${i}`} cx={xx} cy={sh} r={5} fill="#FFFFFF" />);
  }
  for (let i = 0; i <= Math.round(sh / g); i++) {
    const yy = (i * sh) / Math.round(sh / g);
    holes.push(<circle key={`l${i}`} cx={0} cy={yy} r={5} fill="#FFFFFF" />, <circle key={`r${i}`} cx={sw} cy={yy} r={5} fill="#FFFFFF" />);
  }
  return (
    <svg style={{position: 'absolute', left: x, top: y, overflow: 'visible', transform: `rotate(${rot}deg)`, filter: `drop-shadow(3px 4px 0 ${shadowOf(ink, 0.22)})`}} width={sw} height={sh}>
      {holes}
      <rect x={0} y={0} width={sw} height={sh} fill="#FFFFFF" />
      <rect x={9} y={9} width={sw - 18} height={sh - 18} rx={4} fill={color} stroke={glow ? '#FFFFFF' : 'none'} strokeWidth={2} />
      <path d={`M ${sw * 0.2} ${sh * 0.72} L ${sw * 0.42} ${sh * 0.48} L ${sw * 0.56} ${sh * 0.62} L ${sw * 0.68} ${sh * 0.5} L ${sw * 0.84} ${sh * 0.72} Z`} fill={mixHex(color, '#FFFFFF', 0.35)} />
      <text x={sw / 2} y={sh * 0.42} textAnchor="middle" fontSize={size} fontWeight={900} fill="#FFFFFF" style={{fontVariantNumeric: 'tabular-nums'}}>{no}</text>
      {/* 邮戳：一圈虚线圆 + 两道波浪线，压在邮票左下角 */}
      <circle cx={6} cy={sh - 4} r={30} fill="none" stroke={shadowOf(ink, 0.5)} strokeWidth={3} strokeDasharray="5 4" />
      <path d={`M 20 ${sh - 18} q 12 -8 24 0 t 24 0 t 24 0 M 20 ${sh - 6} q 12 -8 24 0 t 24 0 t 24 0`} fill="none" stroke={shadowOf(ink, 0.45)} strokeWidth={3} />
    </svg>
  );
};

export const Postcard: React.FC<{w: World; d: District; textOn: number}> = ({w, d, textOn}) => {
  const {t, pal, tk, lay, geo} = w;
  const {tin, tout} = cardTimes(w, d);
  const m = tk.motion ?? {};
  const mailD: number = m.cardMail ?? 0.36;
  if (t < tin - 0.02 || t > tout + mailD + 0.05) return null;
  const [y0, y1] = lay.card as [number, number];
  const W: number = lay.cardW;
  const H = y1 - y0;
  const ink = pal.ink;
  const ty = tk.type ?? {};
  // 甩进来：从右边画外带着旋转飞到位（弹簧）；停住后轻轻浮动
  const inP = springAt(t - tin, 13, 170);
  const baseRot = d.k % 2 ? 1.6 : -1.8;
  const cx0 = geo.w / 2 + (d.k % 2 ? 10 : -10);
  const cy0 = (y0 + y1) / 2;
  let cx = geo.w + W / 2 + 60 + (cx0 - geo.w - W / 2 - 60) * inP;
  let cy = cy0 - 40 * (1 - inP) + Math.sin(t * Math.PI * 0.9 + d.k) * 3;
  let rot = baseRot + 12 * (1 - inP) + Math.sin(t * 1.3 + d.k) * 0.4;
  let sc = 1;
  // 寄出：缩小、转一下，飞进车票上这一站的站点
  const mail = easeIO(clamp01((t - tout) / mailD));
  if (mail > 0) {
    const R = ticketRect(w);
    const tx = ticketNodeX(w, d.k);
    cx = cx + (tx - cx) * mail;
    cy = cy + (R.lineY - cy) * mail - Math.sin(mail * Math.PI) * 60;
    rot = rot - 24 * mail;
    sc = 1 - 0.93 * mail;
  }
  const show = clamp01((t - tin - (m.cardTextDelay ?? 0.1)) / 0.12) * textOn * (1 - clamp01(mail * 3));
  const phase = d.phase;
  const night = phase === 'night' ? 1 : phase === 'dusk' ? 0.3 : 0;
  const col = tint(d.color, phase);
  const deep = mixHex(d.color, ink, 0.32);
  const paper = night > 0.5 ? mixHex(pal.paper, '#FFF4D6', 0.3) : pal.paper;
  const stripeA = col;
  const stripeB = pal.brand;
  const pad = 40;
  const inner = W - pad * 2;
  const tSize = Math.max(ty.cardTitleMin ?? 40, Math.min(ty.cardTitle ?? 46, fitSize(d.title, inner * 2 - 60, ty.cardTitle ?? 46, ty.cardTitleMin ?? 40, 0)));
  const cSize: number = ty.cardCategory ?? 32;
  const tagSize: number = ty.cardTag ?? 26;
  const stW = 104;
  const stH = 116;
  const border = 13;
  return (
    <div style={{position: 'absolute', left: cx - W / 2, top: cy - H / 2, width: W, height: H, transform: `rotate(${rot}deg) scale(${sc})`, transformOrigin: '50% 50%', opacity: mail > 0.85 ? (1 - mail) / 0.15 : 1}}>
      {/* 航空信封边：斜条纹外框（本站类别色 + 主色），里面是纸 */}
      <div style={{position: 'absolute', inset: 0, borderRadius: tk.radius?.postcard ?? 12, border: `4px solid ${ink}`, boxSizing: 'border-box', background: `repeating-linear-gradient(-45deg, ${stripeA} 0 18px, #FFFFFF 18px 30px, ${stripeB} 30px 48px, #FFFFFF 48px 60px)`, boxShadow: night > 0.5 ? `0 0 26px ${mixHex(col, '#FFFFFF', 0.3)}` : `7px 9px 0 ${shadowOf(ink, 0.2)}`}}>
        <div style={{position: 'absolute', inset: border - 4, borderRadius: 6, background: paper, border: `2px solid ${shadowOf(ink, 0.25)}`}} />
      </div>
      <Stamp x={W - stW - 18} y={-34} sw={stW} sh={stH} color={col} ink={ink} no={String(d.k + 1).padStart(2, '0')} size={ty.stampNo ?? 34} rot={d.k % 2 ? -5 : 6} />
      <div style={{position: 'absolute', left: pad, right: stW + 40, top: 30, height: cSize * 1.3, display: show > 0.01 ? 'flex' : 'none', alignItems: 'center', gap: 14, opacity: show, whiteSpace: 'nowrap'}}>
        <span style={{fontSize: cSize, fontWeight: 900, color: deep, lineHeight: 1.2, letterSpacing: 1}}>{d.category}</span>
        {d.tag ? <span style={{display: 'inline-block', padding: '0 14px', borderRadius: 8, border: `3px solid ${col}`, color: deep, fontSize: tagSize, fontWeight: 700, lineHeight: 1.35}}>{d.tag}</span> : null}
      </div>
      <div style={{position: 'absolute', left: pad, right: pad, top: 30 + cSize * 1.3 + 10, bottom: d.source ? 56 : 24, display: show > 0.01 ? 'flex' : 'none', alignItems: 'center', opacity: show}}>
        <div style={{fontSize: tSize, lineHeight: 1.26, fontWeight: tk.font?.strongWeight ?? 700, color: ink, wordBreak: 'normal', textWrap: 'balance'} as React.CSSProperties}>{glueBreaks(d.title, w.lang)}</div>
      </div>
      {d.source ? (
        <div style={{position: 'absolute', left: pad, right: pad, bottom: 22, height: 34, display: show > 0.01 ? 'flex' : 'none', alignItems: 'center', gap: 12, opacity: show}}>
          <span style={{width: 34, height: 3, background: pal.inkSoft, flex: 'none'}} />
          <span style={{fontSize: ty.cardSource ?? 26, fontWeight: 600, color: pal.inkSoft, whiteSpace: 'nowrap', lineHeight: 1.3}}>{d.source}</span>
        </div>
      ) : null}
    </div>
  );
};

// ---------------- 路牌（前景层，第 0 拍经过角色） ----------------
export const Sign: React.FC<{w: World; d: District; textOn: number}> = ({w, d, textOn}) => {
  const {plan, t, pal, tk, lay} = w;
  const x = plan.camAt(d.start) + w.mascotX - plan.camAt(t);
  const size: number = tk.type?.sign ?? 44;
  const tw = textW(d.category, size);
  // 类别色箭头牌指向前进方向，立柱在左（立柱 = 街区分界，第 0 拍经过角色），下挂「第几站」小牌
  const bw = Math.max(230, tw + 90);
  const tip = 44;
  if (x + bw + tip < -40 || x - 40 > w.geo.w + 40) return null;
  const [y0, y1] = lay.sign as [number, number];
  const H = y1 - y0;
  const ink = pal.ink;
  const post = tint('#5E6573', d.phase);
  const fill = tint(d.color, d.phase);
  const tx0 = x - 10;
  const op = edgeFade(w, tx0 + 20, tx0 + 20 + tw) * textOn;
  const n = plan.districts.length;
  const badge = `${d.k + 1} / ${n}`;
  const bs: number = tk.type?.signBadge ?? 30;
  const bop = edgeFade(w, tx0 + 40, tx0 + 40 + textW(badge, bs)) * textOn;
  return (
    <div style={{position: 'absolute', left: tx0, top: y0, width: bw + tip, height: H}}>
      <div style={{position: 'absolute', left: -2, top: H / 2, width: 24, height: lay.groundY - y0 - H / 2, background: post, border: `4px solid ${ink}`, borderRadius: 8, boxSizing: 'border-box'}} />
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={bw + tip} height={H}>
        <path d={`M 12,4 L ${bw},4 L ${bw + tip},${H / 2} L ${bw},${H - 4} L 12,${H - 4} Q 4,${H - 4} 4,${H - 12} L 4,12 Q 4,4 12,4 Z`} fill={fill} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d={`M 18,15 L ${bw - 8},15`} stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.35} />
      </svg>
      <div style={{position: 'absolute', left: 24, top: 0, height: H, display: 'flex', alignItems: 'center', fontSize: size, fontWeight: 900, color: '#FFFFFF', whiteSpace: 'nowrap', opacity: op, lineHeight: 1.1, textShadow: `0 3px 0 ${mixHex(d.color, ink, 0.5)}`}}>{d.category}</div>
      <div style={{position: 'absolute', left: 40, top: H + 10, padding: '0 14px', background: '#FFFFFF', border: `4px solid ${ink}`, borderRadius: 12, fontSize: bs, fontWeight: 800, color: ink, whiteSpace: 'nowrap', lineHeight: 1.25}}>
        <span style={{opacity: bop}}>{badge}</span>
      </div>
    </div>
  );
};

// ---------------- 气泡（角色台词） ----------------
/** anchor = right：气泡右下角对着 x（角色在右边、气泡往左长） */
export const Bubble: React.FC<{w: World; text: string; t0: number; hold: number; x: number; y: number; anchor?: 'left' | 'right'}> = ({w, text, t0, hold, x, y, anchor = 'left'}) => {
  const {t, pal, tk} = w;
  const m = tk.motion ?? {};
  const lt = t - t0;
  const inS: number = m.bubbleIn ?? 0.1;
  const outS: number = m.bubbleOut ?? 0.1;
  if (lt < 0 || lt > hold + outS) return null;
  const pin = lt < inS ? lt / inS : 1;
  const k = springAt(lt, 10, 260);
  const out = clamp01((lt - hold) / outS);
  const s = (0.6 + 0.4 * Math.min(1.08, k)) * (1 - 0.3 * out);
  const size: number = tk.type?.bubble ?? 40;
  const right = anchor === 'right';
  const maxW = right ? x - w.geo.card.x0 - 10 : w.geo.card.x1 - x - 10;
  const fs = fitSize(text, maxW - 56, size, 34, 0);
  const ink = pal.ink;
  return (
    <div style={{position: 'absolute', ...(right ? {right: w.geo.w - x} : {left: x}), top: y, opacity: Math.min(pin * 2, 1) * (1 - out), transform: `scale(${s})`, transformOrigin: right ? '100% 100%' : '0% 100%'}}>
      <div style={{position: 'relative', padding: '12px 28px', background: pal.card, border: `3.5px solid ${ink}`, borderRadius: tk.radius?.bubble ?? 22, fontSize: fs, fontWeight: 600, color: ink, whiteSpace: 'nowrap', lineHeight: 1.25, boxShadow: `0 6px 0 ${shadowOf(ink, 0.12)}`}}>
        {text}
        <svg style={{position: 'absolute', ...(right ? {right: 18} : {left: 18}), bottom: -24, overflow: 'visible'}} width={34} height={26}>
          <path d={right ? 'M4 -2 L24 22 L32 -2' : 'M2 -2 L10 22 L30 -2'} fill={pal.card} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};

// ---------------- 拟声字（邮戳形圆齿框） ----------------
export const Burst: React.FC<{w: World; word: string; tone: 'yellow' | 'blue' | 'gray'; t0: number; x: number; y: number}> = ({w, word, tone, t0, x, y}) => {
  const {t, pal, tk} = w;
  const m = tk.motion ?? {};
  const lt = t - t0;
  const inS: number = m.burstIn ?? 0.07;
  const hold: number = m.burstHold ?? 0.42;
  if (lt < 0 || lt > inS + hold) return null;
  const p = clamp01(lt / inS);
  const over = p < 1 ? p * 1.15 : 1 + 0.08 * Math.exp(-(lt - inS) * 18) * Math.sin((lt - inS) * 40);
  const rot = -8 - 15 * (1 - p);
  const size: number = tk.type?.burst ?? 46;
  const tw = textW(word, size);
  const R = Math.max(96, tw / 2 + 50);
  const fill = tone === 'blue' ? pal.burstBlue : tone === 'gray' ? pal.burstGray : pal.burstYellow;
  const ink = pal.ink;
  // 邮戳形：一圈圆齿边（像齿孔 / 邮戳），里面一道虚线圈；不是尖刺爆炸框
  const bumps = 14;
  const P = (a: number, k: number) => `${(Math.cos(a) * R * k * 1.08).toFixed(1)} ${(Math.sin(a) * R * k * 0.72).toFixed(1)}`;
  const seg: string[] = [`M${P(0, 0.88)}`];
  for (let i = 0; i < bumps; i++) {
    const a0 = (i * 2 * Math.PI) / bumps;
    const a1 = ((i + 1) * 2 * Math.PI) / bumps;
    seg.push(`Q${P((a0 + a1) / 2, 1.1)} ${P(a1, 0.88)}`);
  }
  const shape = `${seg.join(' ')} Z`;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0, transform: `rotate(${rot}deg) scale(${over})`}}>
      <svg style={{position: 'absolute', left: -R * 1.2, top: -R, overflow: 'visible'}} width={R * 2.4} height={R * 2}>
        <path d={shape} transform={`translate(${R * 1.2 + 6} ${R + 7})`} fill={ink} opacity={0.9} />
        <path d={shape} transform={`translate(${R * 1.2} ${R})`} fill={fill} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <ellipse cx={R * 1.2} cy={R} rx={R * 0.8} ry={R * 0.52} fill="none" stroke={ink} strokeWidth={2.5} strokeDasharray="7 6" opacity={0.45} />
      </svg>
      <div style={{position: 'absolute', left: -R, width: R * 2, top: -size * 0.66, textAlign: 'center', fontSize: size, fontWeight: 800, color: ink, whiteSpace: 'nowrap', lineHeight: 1.3}}>{word}</div>
    </div>
  );
};

/** 闪光小星（放在角色周围）：纸白小星 */
export const Sparkles: React.FC<{w: World; t0: number; t1: number; cx: number; cy: number; r: number}> = ({w, t0, t1, cx, cy, r}) => {
  const lt = w.t - t0;
  if (lt < 0 || w.t > t1) return null;
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
      {Array.from({length: 7}, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const pulse = Math.max(0, Math.sin(lt * 9 + i * 1.7));
        const rr = r * (0.85 + 0.25 * Math.sin(i * 3.1));
        return <path key={i} d={starPath(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, 16 * pulse + 4, (16 * pulse + 4) * 0.42)} fill={i % 3 ? '#FFFFFF' : w.pal.accent} stroke={w.pal.ink} strokeWidth={3} strokeLinejoin="round" />;
      })}
    </svg>
  );
};
