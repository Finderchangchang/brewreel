import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitSize, glueBreaks} from '../../../core/fit';
import type {World} from './city';
import {mixHex} from './city';
import {starPath} from './rider';
import {clamp01, springAt, textW} from './ui';

// ============================================================
// 片尾：数字卡落下滚动计数（约 1 秒 ease-out）→ 整个世界 0.3 秒缩进浏览器框（产品界面）→ 品牌卡弹出 + 类别 chips +
// 数据胶囊 + 彩纸，角色出框挥手。产品界面是我们用街区数据拼的「内容卡片墙」，不用任何真实网页截图，也不写网址。
// ============================================================
export type Stat = {value: string; unit?: string};
export type FinaleData = {stats: Stat[]; sub?: string; brand: string; slogan: string; cta?: string; bye: string};

/** 「650」「1.2万」「30+」→ 只滚数字部分，小数位保持 */
export const countText = (v: string, p: number) => {
  const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(v);
  if (!m) return v;
  const raw = m[2].replace(/,/g, '');
  const dec = raw.includes('.') ? raw.split('.')[1].length : 0;
  const n = parseFloat(raw) * p;
  let s = n.toFixed(dec);
  if (m[2].includes(',')) s = Number(s).toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
  return `${m[1]}${s}${m[3]}`;
};

export const browserRect = (w: World) => {
  const [y0, y1] = w.lay.browser as [number, number];
  return {x0: w.geo.card.x0 + (w.geo.w > 0 && w.geo.h < 1500 ? 60 : 0), x1: w.geo.card.x1 - (w.geo.h < 1500 ? 60 : 0), y0, y1};
};

const StatRow: React.FC<{w: World; stats: Stat[]; p: number; vSize: number; uSize: number}> = ({w, stats, p, vSize, uSize}) => (
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28}}>
    {stats.slice(0, 2).map((s, i) => (
      <React.Fragment key={i}>
        {i ? <div style={{width: 3, alignSelf: 'stretch', background: mixHex(w.pal.inkSoft, '#FFFFFF', 0.55), margin: '6px 0'}} /> : null}
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap', lineHeight: 1.15}}>
          <span style={{fontSize: vSize, fontWeight: 600, color: i === 0 ? w.pal.brand : w.pal.ink, fontVariantNumeric: 'tabular-nums'}}>{countText(s.value, p)}</span>
          {s.unit ? <span style={{fontSize: uSize, fontWeight: 500, color: w.pal.ink}}>{s.unit}</span> : null}
        </div>
      </React.Fragment>
    ))}
  </div>
);

export const Finale: React.FC<{w: World; data: FinaleData; t0: number; dur: number}> = ({w, data, t0, dur}) => {
  const {t, pal, tk, geo, lay} = w;
  const ft = t - t0;
  if (ft < 0) return null;
  const ty = tk.type ?? {};
  const m = tk.motion ?? {};
  const cam = tk.camera ?? {};
  const ink = pal.ink;
  const zoomAt: number = cam.outroZoomAt ?? 1.3;
  const zd: number = cam.outroZoomDur ?? 0.3;
  const B = browserRect(w);
  // ---- 数字卡 ----
  const drop = springAt(ft, 13, 190);
  const cnt = interpolate(ft, [0.15, 0.15 + (m.counter ?? 1)], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const fly = clamp01((ft - zoomAt) / (m.statsFly ?? 0.2));
  const cardW = geo.card.x1 - geo.card.x0 - 120;
  const cardY = lay.counterY as number;
  const [sy0, sy1] = lay.stats as [number, number];
  const cardCy = cardY + 100;
  const statsCy = (sy0 + sy1) / 2;
  const vSize = fitSize(data.stats.map((s) => s.value + (s.unit ?? '')).join('  '), cardW - 120, ty.counterValue ?? 76, 48, 0);
  // ---- 品牌卡、chips、彩纸 ----
  const brandT = zoomAt + zd + 0.05;
  const bp = springAt(ft - brandT, 11, 220);
  const chipsP = springAt(ft - brandT - 0.15, 14, 200);
  const statsP = clamp01((ft - zoomAt - 0.1) / 0.15);
  const top = B.y0 + 84;
  const innerW = B.x1 - B.x0;
  const cards = w.plan.districts.slice(0, 3);
  const cw = (innerW - 40 - (cards.length - 1) * 16) / Math.max(1, cards.length);
  // 小卡标题不截断（以前超过两行就加省略号）：最多 3 行，放不下再缩字，不低于 26px 底线
  const cardFont = (s: string) => Math.max(26, Math.min(ty.pageCard ?? 26, Math.floor(((cw - 28) * 3 * 0.9) / Math.max(1, textW(s, 1)))));
  const tall = geo.h > 1500;
  const pageP = interpolate(ft, [zoomAt + zd * 0.5, zoomAt + zd * 0.5 + (m.crossfade ?? 0.3)], [0, 1], clamp);
  const brandBoxTop = top + 190;
  return (
    <>
      {/* 产品界面：浏览器框上半截是内容卡片墙，下半截透出夜景（世界本身在 film.tsx 里缩进这个框） */}
      {pageP > 0 ? (
        <div style={{position: 'absolute', left: B.x0, top: B.y0, width: innerW, height: B.y1 - B.y0, borderRadius: tk.radius?.browser ?? 34, overflow: 'hidden', opacity: pageP}}>
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${pal.bg} 0%, ${pal.bg} 62%, ${mixHex(pal.bg, pal.skyNight, 0.4)}00 84%)`}} />
          <div style={{position: 'absolute', left: 20, right: 20, top: 84, display: 'flex', gap: 16}}>
            {cards.map((d) => (
              <div key={d.k} style={{width: cw, minHeight: 160, background: pal.card, border: `3px solid ${mixHex(ink, '#FFFFFF', 0.75)}`, borderRadius: 16, overflow: 'visible', boxSizing: 'border-box'}}>
                <div style={{height: 40, borderRadius: '13px 13px 0 0', background: mixHex(d.color, '#FFFFFF', 0.72)}} />
                <div style={{padding: '8px 14px 8px'}}>
                  <div style={{fontSize: cardFont(d.title), lineHeight: 1.3, color: ink, wordBreak: 'normal'}}>{glueBreaks(d.title, w.lang)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {/* 浏览器外框 + 顶栏（地址栏只写产品名，不写网址） */}
      {ft >= zoomAt ? (
        <div style={{position: 'absolute', left: B.x0 - 5, top: B.y0 - 5, width: innerW + 10, height: B.y1 - B.y0 + 10, borderRadius: (tk.radius?.browser ?? 34) + 4, border: `5px solid ${ink}`, boxSizing: 'border-box', opacity: clamp01((ft - zoomAt) / zd), boxShadow: '0 10px 0 rgba(31,25,26,0.10)'}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 64, background: pal.card, borderRadius: `${tk.radius?.browser ?? 34}px ${tk.radius?.browser ?? 34}px 0 0`, borderBottom: `3px solid ${mixHex(ink, '#FFFFFF', 0.8)}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', boxSizing: 'border-box'}}>
            {['#F0645A', '#F5C33B', '#3CC77A'].map((c) => <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />)}
            <div style={{flex: 1, marginLeft: 12, height: 40, borderRadius: 20, background: mixHex(pal.bg, '#FFFFFF', 0.3), display: 'flex', alignItems: 'center', padding: '0 20px', fontSize: ty.address ?? 26, color: pal.inkSoft, whiteSpace: 'nowrap', overflow: 'visible'}}>{data.brand}</div>
          </div>
        </div>
      ) : null}
      {/* 品牌卡 */}
      {bp > 0 ? (
        <div style={{position: 'absolute', left: B.x0 + 36, width: innerW - 72, top: brandBoxTop, transform: `scale(${0.7 + 0.3 * bp})`, opacity: Math.min(1, bp * 2), transformOrigin: '50% 50%'}}>
          <div style={{position: 'relative', background: pal.card, border: `4.5px solid ${ink}`, borderRadius: tk.radius?.card ?? 26, padding: '22px 30px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxSizing: 'border-box'}}>
            <span style={{padding: '4px 26px', borderRadius: 999, background: pal.brand, color: pal.brandInk, fontSize: ty.endBrand ?? 36, fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap'}}>{data.brand}</span>
            <div style={{fontSize: fitSize(data.slogan, innerW - 150, ty.endSlogan ?? 48, 40, 0), fontWeight: 600, color: ink, lineHeight: 1.25, whiteSpace: 'nowrap'}}>{data.slogan}</div>
            {data.cta ? <div style={{fontSize: ty.endCta ?? 40, fontWeight: 700, color: pal.brand, lineHeight: 1.25, whiteSpace: 'nowrap'}}>{data.cta}</div> : null}
            {[-1, 1].map((s) => (
              <svg key={s} style={{position: 'absolute', top: -22, [s < 0 ? 'left' : 'right']: -22, overflow: 'visible'} as React.CSSProperties} width={50} height={50}>
                <path d={starPath(25, 25, 24 + Math.sin(t * 8 + s) * 4, 10)} fill="#FFD84A" stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
              </svg>
            ))}
          </div>
          {/* 类别 chips */}
          <div style={{marginTop: 18, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, opacity: chipsP, transform: `translateY(${(1 - chipsP) * 20}px)`}}>
            {w.plan.districts.map((d) => (
              <span key={d.k} style={{padding: '4px 18px', borderRadius: 999, background: d.color, color: '#fff', fontSize: ty.endChip ?? 28, fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap', border: `3px solid ${ink}`}}>{d.category}</span>
            ))}
          </div>
        </div>
      ) : null}
      {/* 数字卡（缩框时飞到底部变成数据胶囊） */}
      {data.stats.length && fly < 1 ? (
        <div style={{position: 'absolute', left: (geo.w - cardW) / 2, width: cardW, top: cardY - (1 - drop) * 320 + fly * (statsCy - cardCy), opacity: 1 - fly, transform: `scale(${1 - 0.45 * fly})`}}>
          <div style={{background: pal.card, border: `4.5px solid ${ink}`, borderRadius: tk.radius?.card ?? 26, padding: '22px 30px', boxShadow: '0 8px 0 rgba(31,25,26,0.14)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
            <StatRow w={w} stats={data.stats} p={cnt} vSize={vSize} uSize={ty.counterUnit ?? 40} />
            {data.sub ? <div style={{fontSize: ty.counterSub ?? 28, color: pal.inkSoft, lineHeight: 1.3, whiteSpace: 'nowrap'}}>{data.sub}</div> : null}
          </div>
        </div>
      ) : null}
      {data.stats.length && statsP > 0 ? (
        <div style={{position: 'absolute', left: B.x0 + 60, width: innerW - 120, top: sy0, height: sy1 - sy0, background: pal.card, border: `4px solid ${ink}`, borderRadius: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: statsP, transform: `scale(${0.9 + 0.1 * statsP})`, boxSizing: 'border-box'}}>
          <StatRow w={w} stats={data.stats} p={1} vSize={ty.statsValue ?? 40} uSize={30} />
          {data.sub ? <div style={{fontSize: ty.statsSub ?? 26, color: pal.inkSoft, lineHeight: 1.3, whiteSpace: 'nowrap'}}>{data.sub}</div> : null}
        </div>
      ) : null}
      {tall && pageP > 0 ? <Footer w={w} y0={Math.max(B.y1, data.stats.length ? sy1 : B.y1) + 30} op={pageP} /> : null}
      <Confetti w={w} t0={t0 + zoomAt + zd} dur={dur} />
    </>
  );
};

export const Fireworks: React.FC<{w: World; t0: number}> = ({w, t0}) => {
  const ft = w.t - t0;
  if (ft < 0 || ft > 1.6) return null;
  const cy = (w.lay.counterY as number) + 100;
  const spots = [
    [w.geo.w * 0.16, cy - 40, 0.1],
    [w.geo.w * 0.84, cy - 70, 0.35],
    [w.geo.w * 0.3, cy + 170, 0.6],
    [w.geo.w * 0.72, cy + 190, 0.8],
  ];
  const cols = [w.pal.neonA, w.pal.neonB, w.pal.neonC, w.pal.brand];
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
      {spots.map(([x, y, d0], i) => {
        const p = clamp01((ft - d0) / 0.6);
        if (p <= 0 || p >= 1) return null;
        const r0 = 30 + 110 * p;
        return (
          <g key={i} opacity={1 - p * p}>
            {Array.from({length: 14}, (_, k) => {
              const a = (k / 14) * Math.PI * 2;
              return <line key={k} x1={x + Math.cos(a) * r0 * 0.55} y1={y + Math.sin(a) * r0 * 0.55} x2={x + Math.cos(a) * r0} y2={y + Math.sin(a) * r0} stroke={cols[(i + k) % cols.length]} strokeWidth={6} strokeLinecap="round" />;
            })}
          </g>
        );
      })}
    </svg>
  );
};

const Confetti: React.FC<{w: World; t0: number; dur: number}> = ({w, t0}) => {
  const ft = w.t - t0;
  if (ft < 0) return null;
  const cols = [w.pal.brand, '#F2D743', '#2BB29B', '#3E81DE', '#DD3F74'];
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}} width={w.geo.w} height={w.geo.h}>
      {Array.from({length: 80}, (_, i) => {
        const r = (k: number) => {
          const x = Math.sin((i + 1) * 12.9898 * (k + 1)) * 43758.5453;
          return x - Math.floor(x);
        };
        const x = r(1) * w.geo.w + Math.sin(ft * (2 + r(2) * 3) + i) * 30;
        const y = -60 - r(3) * 500 + ft * (420 + r(4) * 380);
        if (y > w.geo.h + 40) return null;
        const rot = ft * (180 + r(5) * 360) * (i % 2 ? 1 : -1);
        return <rect key={i} x={x} y={y} width={10 + r(6) * 8} height={18 + r(7) * 10} fill={cols[i % cols.length]} transform={`rotate(${rot} ${x} ${y})`} />;
      })}
    </svg>
  );
};

/**
 * 9:16 片尾底部：浏览器框和数据卡下面（y 1340 以下会被平台文案盖住，不放字）铺一条小城天际线 + 街面，
 * 和片子里的城市呼应，免得下半屏只剩空底色。纯装饰，没有文字。
 */
const Footer: React.FC<{w: World; y0: number; op: number}> = ({w, y0, op}) => {
  const {geo, pal} = w;
  const ink = pal.ink;
  const ground = Math.min(geo.h - 180, y0 + 310);
  const cols = [mixHex(pal.brand, '#FFFFFF', 0.55), '#BFD7EA', '#F6D9A8', '#C8E6C9', '#E6D3F0'];
  const out: React.ReactNode[] = [];
  let x = -20;
  let i = 0;
  while (x < geo.w + 20) {
    const bw = 110 + ((i * 53) % 70);
    const bh = 90 + ((i * 71) % 130);
    out.push(<rect key={`b${i}`} x={x} y={ground - bh} width={bw} height={bh + 2} rx={8} fill={cols[i % cols.length]} stroke={ink} strokeWidth={3} />);
    for (let r = 0; r < Math.floor((bh - 30) / 44); r++)
      for (let q = 0; q < Math.floor((bw - 20) / 40); q++)
        out.push(<rect key={`w${i}-${r}-${q}`} x={x + 16 + q * 40} y={ground - bh + 18 + r * 44} width={20} height={22} rx={4} fill={(i + r + q) % 3 ? '#FFFFFF' : '#FFE08A'} opacity={0.9} />);
    x += bw + 14;
    i++;
  }
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: op}} width={geo.w} height={geo.h}>
      <path d={`M0 ${ground - 60} Q ${geo.w * 0.3} ${ground - 150} ${geo.w * 0.55} ${ground - 70} Q ${geo.w * 0.8} ${ground - 10} ${geo.w} ${ground - 90} L ${geo.w} ${ground} L 0 ${ground} Z`} fill={mixHex(pal.bg, '#9CC9E0', 0.35)} />
      {out}
      <rect x={0} y={ground} width={geo.w} height={geo.h - ground} fill={mixHex(pal.bg, ink, 0.1)} />
      <rect x={0} y={ground} width={geo.w} height={40} fill={mixHex(pal.bg, '#FFFFFF', 0.3)} stroke={ink} strokeWidth={3} />
      {Array.from({length: 9}, (_, k) => <rect key={`d${k}`} x={k * 130 + 20} y={ground + 110} width={70} height={12} rx={6} fill="#FFD84D" />)}
    </svg>
  );
};