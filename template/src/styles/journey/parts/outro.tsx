import React from 'react';
import {emWidth, fitSize} from '../../../core/fit';
import {pick} from '../../../core/kit';
import {PAPER_SHADOW, WINDOW} from '../art/palette';
import type {World} from './city';
import {mixHex} from './city';
import {clamp01, ticketNodeX, ticketRect} from './ui';

// ============================================================
// 片尾「终点检票」：顶部那张车票本身就是收尾的载体，全程不换元件、不出空帧。
//   0      相机减速停在终点；顶部车票从上沿滑到画面中间、票面往下展开成一张大车票（路线全部走完、站号、起点 / 终点）；
//          城市同时转成夜景暖光（四周压暗但保留颜色，车票身后一圈暖灯光）；角色一跳落到车票上沿。
//   tally  有数字时：正面终点旗上方由出票机打出一行累计（「1200 期节目」，一条虚线连到终点旗），出处小字在它下面。
//   punch  检票钳从右上伸进来，在票根上打一个真孔（遮罩挖空，后面的城市透过来），掉下一粒纸屑。
//   flip   车票翻面（沿竖轴翻 180°，侧对镜头时能看到纸的厚度；角色在票上跳一下躲开翻动的票边）。
//          背面只有：票根换到左边写「已检」、孔还在；主区「终点站」+ 产品名（大字）、口号、获取方式。背面没有数字。
//   dash   角色蹲一下，踩着滑板冲出画面右侧（这一程结束，下一程出发）；最后画面上只剩这张车票。
// 没有集章格、类别色块、并排数字、彩纸和告别气泡。不用任何真实网页截图、不写网址。
// ============================================================
export type Stat = {value: string; unit?: string};
export type FinaleData = {stat?: Stat; sub?: string; brand: string; slogan: string; cta?: string};

const rgba = (hex: string, a: number) => {
  const s = hex.replace('#', '');
  return `rgba(${parseInt(s.slice(0, 2), 16)},${parseInt(s.slice(2, 4), 16)},${parseInt(s.slice(4, 6), 16)},${a})`;
};
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIO = (x: number) => {
  const u = clamp01(x);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};

/** 片尾各步的时刻（片尾内的秒，读 tokens.motion） */
export const finaleTimes = (w: World) => {
  const m = (w.tk.motion ?? {}) as Record<string, unknown>;
  const n = (k: string, d: number) => (typeof m[k] === 'number' ? (m[k] as number) : d);
  return {
    dim: n('finDim', 0.45),
    move: n('finMove', 0.55),
    hop: n('finHop', 0.1),
    tallyAt: n('finTallyAt', 0.6),
    tally: n('finTally', 0.4),
    punch: n('finPunch', 1.25),
    flipAt: n('finFlipAt', 1.65),
    flip: n('finFlip', 0.5),
    dashAt: n('finDashAt', 2.35),
    dash: n('finDash', 0.65),
  };
};

/** 片尾大车票的几何（film.tsx 也用它给角色定位）：左右和顶部车票对齐，上沿读 layout.finTicket，高度按背面内容算 */
export const finTicketRect = (w: World, data: FinaleData) => {
  const R = ticketRect(w);
  const tall = w.geo.h > 1500;
  const ty = w.tk.type ?? {};
  const [y0, maxH] = (w.lay.finTicket as [number, number]) ?? (tall ? [700, 560] : [450, 520]);
  const W = R.x1 - R.x0;
  const stubW = R.x1 - R.px;
  const pad = 34;
  const mainW = W - stubW - pad * 2 - 6;
  const need = pad + 40 + (ty.endBrand ?? 92) * 1.18 + 25 + (ty.endSlogan ?? 48) * 1.3 + (data.cta ? (ty.endCta ?? 40) * 1.3 + 10 : 0) + pad;
  const h = Math.min(maxH, Math.max(tall ? 500 : 420, Math.ceil(need)));
  return {x0: R.x0, x1: R.x1, y0, h, W, stubW, P: W - stubW, pad, mainW};
};

// 票面外形：圆角矩形，打孔线 x = P 处上下各咬一个半圆缺口
const bodyPath = (W: number, h: number, P: number, r: number, nr: number) =>
  `M ${r} 0 L ${P - nr} 0 A ${nr} ${nr} 0 0 0 ${P + nr} 0 L ${W - r} 0 Q ${W} 0 ${W} ${r} L ${W} ${h - r} Q ${W} ${h} ${W - r} ${h} L ${P + nr} ${h} A ${nr} ${nr} 0 0 0 ${P - nr} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
const stubRight = (W: number, h: number, P: number, r: number, nr: number) =>
  `M ${P + nr} 0 L ${W - r} 0 Q ${W} 0 ${W} ${r} L ${W} ${h - r} Q ${W} ${h} ${W - r} ${h} L ${P + nr} ${h} A ${nr} ${nr} 0 0 0 ${P} ${h - nr} L ${P} ${nr} A ${nr} ${nr} 0 0 0 ${P + nr} 0 Z`;
const stubLeft = (h: number, P: number, r: number, nr: number) =>
  `M ${r} 0 L ${P - nr} 0 A ${nr} ${nr} 0 0 0 ${P} ${nr} L ${P} ${h - nr} A ${nr} ${nr} 0 0 0 ${P - nr} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;

type Hole = {x: number; y: number; r: number} | null;
type Shape = {W: number; h: number; P: number; stubOnLeft: boolean; hole: Hole; id: string; shade: number};
/** 票的纸：阴影、票面、票根、打孔线、描边；孔用遮罩真挖空。shade 0..1 = 投影随展开加深（夜里票浮在城市前面） */
const TicketPaper: React.FC<{w: World; s: Shape}> = ({w, s}) => {
  const {pal, tk} = w;
  const ink = pal.ink;
  const sw: number = tk.outline?.ticket ?? 3.5;
  const r: number = tk.radius?.ticket ?? 14;
  const nr = 13;
  const body = bodyPath(s.W, s.h, s.P, r, nr);
  const stub = s.stubOnLeft ? stubLeft(s.h, s.P, r, nr) : stubRight(s.W, s.h, s.P, r, nr);
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={s.W} height={s.h}>
      <defs>
        <mask id={s.id} maskUnits="userSpaceOnUse" x={-20} y={-20} width={s.W + 40} height={s.h + 40}>
          <rect x={-20} y={-20} width={s.W + 40} height={s.h + 40} fill="#FFFFFF" />
          {s.hole ? <circle cx={s.hole.x} cy={s.hole.y} r={s.hole.r} fill="#000000" /> : null}
        </mask>
      </defs>
      <path d={body} transform={`translate(${5 + 5 * s.shade} ${7 + 6 * s.shade})`} fill={rgba(PAPER_SHADOW, 0.2 + 0.22 * s.shade)} />
      <g mask={`url(#${s.id})`}>
        <path d={body} fill={pal.card} />
        <path d={stub} fill={pal.brand} />
        <line x1={s.P} y1={nr + 4} x2={s.P} y2={s.h - nr - 4} stroke={mixHex(pal.brand, '#FFFFFF', 0.55)} strokeWidth={3} strokeDasharray="6 6" />
        <path d={body} fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      </g>
      {s.hole ? <circle cx={s.hole.x} cy={s.hole.y} r={s.hole.r} fill="none" stroke={ink} strokeWidth={3} /> : null}
    </svg>
  );
};

/** 正面终点旁的累计（数字 + 单位，出处在下一行）：右端对齐终点旗，出票机从左到右打出来 */
const Tally: React.FC<{w: World; W: number; stat: Stat; sub?: string; right: number; leftLimit: number; pr: number}> = ({w, W, stat, sub, right, leftLimit, pr}) => {
  const {pal, tk} = w;
  const ty = tk.type ?? {};
  const unit = stat.unit ?? '';
  const vMax: number = ty.endTally ?? 46;
  const uMax: number = ty.endTallyUnit ?? 30;
  const avail = right - leftLimit;
  const natural = emWidth(stat.value) * vMax + (unit ? 8 + emWidth(unit) * uMax : 0);
  const k = natural > avail ? Math.max(0.72, avail / natural) : 1;
  const vs = Math.round(vMax * k);
  const us = Math.max(26, Math.round(uMax * k));
  const subSize: number = ty.endTallySub ?? 26;
  return (
    <div style={{position: 'absolute', right: W - right, top: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ...(pr < 1 ? {clipPath: `inset(-10px ${(1 - pr) * 100}% -10px 0)`} : {})}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap', lineHeight: 1.15}}>
        <span style={{fontSize: vs, fontWeight: 900, color: pal.brand, fontVariantNumeric: 'tabular-nums'}}>{stat.value}</span>
        {unit ? <span style={{fontSize: us, fontWeight: 800, color: pal.ink}}>{unit}</span> : null}
      </div>
      {sub ? <div style={{fontSize: subSize, fontWeight: 600, color: pal.inkSoft, lineHeight: 1.3, whiteSpace: 'nowrap'}}>{sub}</div> : null}
    </div>
  );
};

/** 正面：和顶部车票同一张票，m = 0 时和顶部车票一致，m = 1 时展开成大票；终点旗上方挂一行累计 */
const Front: React.FC<{w: World; W: number; h: number; P: number; m: number; hole: Hole; product: string; data: FinaleData; ft: number}> = ({w, W, h, P, m, hole, product, data, ft}) => {
  const {pal, plan, tk} = w;
  const ink = pal.ink;
  const ty = tk.type ?? {};
  const R = ticketRect(w);
  const T = finaleTimes(w);
  const n = plan.districts.length;
  const L = (x: number) => x - R.x0;
  const lineY = (R.h - 25) * (1 - m) + h * 0.62 * m;
  const s = 1 + 0.45 * m;
  const endX = L(ticketNodeX(w, n));
  const lab = clamp01((m - 0.55) / 0.45);
  const labSize: number = ty.endRoute ?? 26;
  const headSize: number = ty.endRouteHead ?? 32;
  const stubW = W - P;
  const bsize = fitSize(product, stubW - 40, (ty.ticketBrand ?? 30) + 8 * m, 26, 0);
  const prodY = h * (0.5 * (1 - m) + 0.34 * m);
  const head = pick(w.lang, '全程已走完', 'Route complete');
  // 累计：打印进度；右端对齐终点旗的旗尖，左边不压「全程已走完」
  const pr = data.stat ? clamp01((ft - T.tallyAt) / T.tally) : 0;
  const tallyRight = Math.min(P - 20, endX + 30);
  const tallyH = 16 + (ty.endTally ?? 46) * 1.15 + (data.sub ? (ty.endTallySub ?? 26) * 1.3 : 0);
  const flagTop = lineY - 34 * s - 8;
  return (
    <>
      <TicketPaper w={w} s={{W, h, P, stubOnLeft: false, hole, id: 'jyFinHoleF', shade: m}} />
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={W} height={h}>
        <line x1={L(R.rx0)} y1={lineY} x2={endX} y2={lineY} stroke={pal.brand} strokeWidth={8 * s} strokeLinecap="round" />
        <circle cx={L(R.rx0)} cy={lineY} r={7 * s} fill={pal.brand} stroke={ink} strokeWidth={3} />
        {plan.districts.map((x) => (
          <circle key={x.k} cx={L(ticketNodeX(w, x.k))} cy={lineY} r={11 * s} fill={x.color} stroke={ink} strokeWidth={3} />
        ))}
        <g transform={`translate(${endX} ${lineY}) scale(${s})`}>
          <line x1={0} y1={8} x2={0} y2={-34} stroke={ink} strokeWidth={4} strokeLinecap="round" />
          <path d="M 0 -34 L 26 -26 L 0 -16 Z" fill={pal.brand} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        </g>
        {/* 顶部车票上那颗青柠圆钉停在终点，展开时淡出 */}
        <g transform={`translate(${endX} ${lineY})`} opacity={1 - clamp01(m * 1.6)}>
          <circle r={13} fill={pal.accent} stroke={ink} strokeWidth={3.5} />
          <circle r={4.5} fill={ink} />
        </g>
        {/* 累计和终点旗之间的一条虚线（从上往下画出来） */}
        {pr > 0 && flagTop > tallyH + 10 ? (
          <line x1={endX} y1={tallyH + 6} x2={endX} y2={tallyH + 6 + (flagTop - tallyH - 6) * pr} stroke={rgba(ink, 0.45)} strokeWidth={3} strokeDasharray="5 7" strokeLinecap="round" />
        ) : null}
      </svg>
      {lab > 0 ? (
        <>
          <div style={{position: 'absolute', left: 34, top: 26, fontSize: headSize, fontWeight: 800, color: ink, lineHeight: 1.25, whiteSpace: 'nowrap', opacity: lab}}>{head}</div>
          {[
            {x: L(R.rx0), t: pick(w.lang, '起点', 'START'), c: pal.inkSoft},
            ...plan.districts.map((x) => ({x: L(ticketNodeX(w, x.k)), t: String(x.k + 1).padStart(2, '0'), c: ink})),
            {x: endX, t: pick(w.lang, '终点', 'END'), c: pal.brand},
          ].map((o, i) => (
            <div key={i} style={{position: 'absolute', left: o.x - 50, width: 100, top: lineY + 24 * s, textAlign: 'center', fontSize: labSize, fontWeight: 800, color: o.c, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', opacity: lab}}>{o.t}</div>
          ))}
        </>
      ) : null}
      {data.stat && pr > 0 ? <Tally w={w} W={W} stat={data.stat} sub={data.sub} right={tallyRight} leftLimit={34 + emWidth(head) * headSize + 28} pr={pr} /> : null}
      {product ? (
        <div style={{position: 'absolute', left: P + 14, width: stubW - 22, top: prodY - bsize * 0.62, height: bsize * 1.24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: bsize, fontWeight: 800, color: pal.brandInk, whiteSpace: 'nowrap', lineHeight: 1.2}}>{product}</div>
      ) : null}
    </>
  );
};

/** 背面：票根在左（孔还在），主区只有终点站 + 产品名、口号、获取方式（没有数字），整块在票面里上下居中 */
const Back: React.FC<{w: World; F: ReturnType<typeof finTicketRect>; data: FinaleData; hole: Hole; ft: number}> = ({w, F, data, hole, ft}) => {
  const {pal, tk} = w;
  const ink = pal.ink;
  const ty = tk.type ?? {};
  const T = finaleTimes(w);
  const after = ft - (T.flipAt + T.flip);
  const sloganOn = clamp01((after - 0.05) / 0.2);
  const ctaOn = clamp01((after - 0.2) / 0.2);
  const x0 = F.stubW + F.pad;
  const nameSize = fitSize(data.brand, F.mainW, ty.endBrand ?? 92, 52, 0);
  const slogSize = fitSize(data.slogan, F.mainW, ty.endSlogan ?? 48, 38, 0);
  const ctaSize = data.cta ? fitSize(data.cta, F.mainW - 24, ty.endCta ?? 40, 34, 0) : 0;
  const hi = mixHex(pal.accent, '#FFFFFF', 0.45);
  return (
    <>
      <TicketPaper w={w} s={{W: F.W, h: F.h, P: F.stubW, stubOnLeft: true, hole, id: 'jyFinHoleB', shade: 1}} />
      {/* 主区一道印刷细框（车票底纹的意思） */}
      <div style={{position: 'absolute', left: F.stubW + 14, right: 14, top: 14, bottom: 14, borderRadius: 8, border: `2px solid ${mixHex(pal.brand, '#FFFFFF', 0.62)}`, boxSizing: 'border-box'}} />
      {/* 票根：已检 */}
      <div style={{position: 'absolute', left: 8, width: F.stubW - 16, top: F.h * 0.22, textAlign: 'center', fontSize: ty.endStub ?? 32, fontWeight: 900, color: pal.brandInk, lineHeight: 1.2, whiteSpace: 'nowrap', letterSpacing: 2}}>{pick(w.lang, '已检', 'USED')}</div>
      <div style={{position: 'absolute', left: x0, width: F.mainW, top: F.pad - 4, bottom: F.pad - 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, height: 40}}>
          <svg width={22} height={30} style={{overflow: 'visible', flex: 'none'}}>
            <line x1={3} y1={29} x2={3} y2={2} stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
            <path d="M 3 2 L 21 8 L 3 15 Z" fill={pal.brand} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
          <span style={{fontSize: ty.endLabel ?? 28, fontWeight: 800, color: pal.inkSoft, lineHeight: 1.2, whiteSpace: 'nowrap'}}>{pick(w.lang, '终点站', 'Last stop')}</span>
        </div>
        <div style={{fontSize: nameSize, fontWeight: 900, color: pal.brand, lineHeight: 1.18, whiteSpace: 'nowrap', letterSpacing: 1}}>{data.brand}</div>
        <div style={{width: '100%', height: 0, borderTop: `3px dashed ${rgba(ink, 0.22)}`, margin: '10px 0 12px'}} />
        <div style={{fontSize: slogSize, fontWeight: 800, color: ink, lineHeight: 1.3, whiteSpace: 'nowrap', opacity: sloganOn, transform: `translateY(${(1 - sloganOn) * 12}px)`}}>{data.slogan}</div>
        {data.cta ? (
          <div style={{marginTop: 10, fontSize: ctaSize, fontWeight: 800, color: pal.brand, lineHeight: 1.3, whiteSpace: 'nowrap', padding: '0 12px', marginLeft: -12, opacity: ctaOn, background: `linear-gradient(transparent 62%, ${hi} 62%, ${hi} 94%, transparent 94%)`}}>{data.cta}</div>
        ) : null}
      </div>
    </>
  );
};

/** 检票钳：从右上伸进来，钳头落在孔的位置，合上一下再退走 */
const Punch: React.FC<{w: World; x: number; y: number; ft: number}> = ({w, x, y, ft}) => {
  const T = finaleTimes(w);
  const d = ft - T.punch;
  if (d < -0.3 || d > 0.42) return null;
  const inP = easeOut((d + 0.3) / 0.28);
  const outP = easeIO((d - 0.14) / 0.28);
  const off = 1 - inP + outP;
  const shut = d < -0.06 ? 0 : d < 0 ? (d + 0.06) / 0.06 : d < 0.1 ? 1 : 1 - clamp01((d - 0.1) / 0.08);
  const ink = w.pal.ink;
  const pc = w.pal.brand;
  const spread = 9 * (1 - shut);
  const press = 1 + 0.1 * (1 - shut);
  const arm = (a: number) => (
    <g transform={`rotate(${a})`}>
      <rect x={34} y={-15} width={250} height={30} rx={15} fill={pc} stroke={ink} strokeWidth={4} />
      <rect x={200} y={-15} width={84} height={30} rx={15} fill={mixHex(pc, '#000000', 0.25)} stroke={ink} strokeWidth={4} />
    </g>
  );
  const pa = (-51 * Math.PI) / 180;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}} width={w.geo.w} height={w.geo.h}>
      <g transform={`translate(${x + off * 260} ${y - off * 300})`}>
        {arm(-62 - spread)}
        {arm(-40 + spread)}
        <g transform={`scale(${press})`}>
          <circle r={36} fill={mixHex(ink, '#FFFFFF', 0.82)} stroke={ink} strokeWidth={4} />
          <circle r={17} fill={ink} />
        </g>
        <circle cx={Math.cos(pa) * 62} cy={Math.sin(pa) * 62} r={10} fill={w.pal.accent} stroke={ink} strokeWidth={3} />
        {d >= 0 && d < 0.16
          ? [0, 1, 2, 3, 4].map((k) => {
              const a = ((110 + k * 34) * Math.PI) / 180;
              const r0 = 48 + d * 180;
              return <line key={k} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * (r0 + 22)} y2={Math.sin(a) * (r0 + 22)} stroke={ink} strokeWidth={4} strokeLinecap="round" />;
            })
          : null}
      </g>
    </svg>
  );
};

/**
 * 夜景暖光：不再蒙一层灰纱。一层 multiply 暗角（中间白 = 不变，四周石油蓝 = 压暗但保留原色），
 * 一层 screen 暖光（窗灯的暖黄，只在车票身后一圈），车票本身不受影响、最亮。
 */
const NightLight: React.FC<{w: World; cx: number; cy: number; rw: number; rh: number; k: number}> = ({w, cx, cy, rw, rh, k}) => {
  if (k <= 0) return null;
  const {geo} = w;
  const mid = mixHex('#FFFFFF', PAPER_SHADOW, 0.2);
  const edge = mixHex('#FFFFFF', PAPER_SHADOW, 0.5);
  const warm = WINDOW.onWarm;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply', opacity: k, background: `radial-gradient(${Math.round(geo.w * 0.78)}px ${Math.round(geo.h * 0.52)}px at ${Math.round(cx)}px ${Math.round(cy)}px, #FFFFFF 0%, #FFFFFF 38%, ${mid} 70%, ${edge} 100%)`}} />
      <div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: k, background: `radial-gradient(${Math.round(rw)}px ${Math.round(rh)}px at ${Math.round(cx)}px ${Math.round(cy)}px, ${rgba(warm, 0.42)} 0%, ${rgba(warm, 0.16)} 55%, ${rgba(warm, 0)} 100%)`}} />
    </>
  );
};

export const Finale: React.FC<{w: World; data: FinaleData; t0: number; dur: number; product: string}> = ({w, data, t0, product}) => {
  const {t, pal, geo} = w;
  const ft = t - t0;
  if (ft < 0) return null;
  const T = finaleTimes(w);
  const R = ticketRect(w);
  const F = finTicketRect(w, data);
  const m = easeOut(ft / T.move);
  const top = R.y0 + (F.y0 - R.y0) * m;
  const h = R.h + (F.h - R.h) * m;
  const dim = easeOut(ft / T.dim);
  // 孔：打在正面票根下部；翻面后在背面票根的镜像位置
  const holeR = 17;
  const holed = ft >= T.punch;
  const holeF = {x: F.P + F.stubW / 2, y: F.h * 0.74, r: holeR};
  const holeB = {x: F.stubW / 2, y: F.h * 0.74, r: holeR};
  const fp = clamp01((ft - T.flipAt) / T.flip);
  const ang = 180 * easeIO(fp);
  const back = ang > 90;
  const lift = Math.sin(fp * Math.PI);
  const hsx = F.x0 + holeF.x;
  const hsy = F.y0 + holeF.y;
  // 纸屑：一粒票根色的圆片，从孔里掉出来，翻着跟头落下
  const cd = ft - T.punch;
  const chadY = hsy + 30 * cd + 0.5 * 2600 * cd * cd;
  // 纸的厚度：翻到侧对镜头（cos 接近 0）时，票面投影几乎没有宽度，这时露出一条纸边，画面不空
  const edgeK = fp > 0 && fp < 1 ? 1 - clamp01(Math.abs(Math.cos((ang * Math.PI) / 180)) / 0.25) : 0;
  const ty = top - lift * 16;
  const sc = 1 + 0.04 * lift;
  const cx = F.x0 + F.W / 2;
  return (
    <>
      {/* 夜景暖光：和车票下移同时开始，中间不留空帧 */}
      <NightLight w={w} cx={cx} cy={top + h / 2} rw={F.W * 0.95} rh={F.h * 1.25} k={dim} />
      <div style={{position: 'absolute', left: F.x0, top: ty, width: F.W, height: h, perspective: 2400}}>
        <div style={{position: 'absolute', inset: 0, transform: `rotateY(${back ? ang - 180 : ang}deg) scale(${sc})`, transformOrigin: '50% 50%'}}>
          {back ? <Back w={w} F={F} data={data} hole={holeB} ft={ft} /> : <Front w={w} W={F.W} h={h} P={F.P} m={m} hole={holed ? holeF : null} product={product} data={data} ft={ft} />}
        </div>
      </div>
      {edgeK > 0 ? (
        <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}} width={geo.w} height={geo.h} opacity={edgeK}>
          {(() => {
            const eh = h * sc * (1 + 0.12 * edgeK);
            const ew = 14;
            const ex = cx - ew / 2;
            const ey = ty + (h - eh) / 2;
            return (
              <g>
                <rect x={ex + 7} y={ey + 10} width={ew} height={eh} rx={5} fill={rgba(PAPER_SHADOW, 0.35)} />
                <rect x={ex} y={ey} width={ew} height={eh} rx={5} fill={mixHex(pal.card, pal.ink, 0.08)} stroke={pal.ink} strokeWidth={3.5} />
              </g>
            );
          })()}
        </svg>
      ) : null}
      <Punch w={w} x={hsx} y={hsy} ft={ft} />
      {holed && chadY < geo.h + 40 ? (
        <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}} width={geo.w} height={geo.h}>
          <ellipse cx={hsx + 40 * cd} cy={chadY} rx={holeR - 1} ry={(holeR - 1) * Math.max(0.2, Math.abs(Math.cos(cd * 13)))} fill={pal.brand} stroke={pal.ink} strokeWidth={2.5} />
        </svg>
      ) : null}
    </>
  );
};

/** 片尾角色的表情：跳上车票（兴奋）→ 指着累计（有数字时）→ 看检票（开心）→ 翻面时跳一下（兴奋）→ 开心 → 冲出画面（兴奋） */
export const finaleExpr = (w: World, ft: number, hasStat: boolean) => {
  const T = finaleTimes(w);
  if (ft < T.move + 0.15) return 'excited' as const;
  if (hasStat && ft < T.tallyAt + T.tally + 0.25) return 'offer' as const;
  if (ft < T.flipAt - 0.05) return 'happy' as const;
  if (ft < T.flipAt + T.flip + 0.1) return 'excited' as const;
  if (ft < T.dashAt) return 'happy' as const;
  return 'excited' as const;
};
