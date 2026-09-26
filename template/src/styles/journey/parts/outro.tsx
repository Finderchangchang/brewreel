import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitSize} from '../../../core/fit';
import {pick} from '../../../core/kit';
import type {World} from './city';
import {mixHex} from './city';
import {clamp01, springAt} from './ui';

// ============================================================
// 片尾「集章卡」：相机减速停在终点 → 城市压暗（世界不缩框、不换画面）→ 一张集章卡从下方升起 →
// 每一站按顺序「盖章」（类别色双线印章，带编号，落下时有一圈墨点）→ 数据滚动计数 →
// 最后盖一枚主色「到站」圆章，口号和获取方式出现，打孔纸屑落下；角色落在卡片右下角，转身朝卡片欢呼。
// 不用任何真实网页截图、不写网址。
// ============================================================
export type Stat = {value: string; unit?: string};
export type FinaleData = {stats: Stat[]; sub?: string; brand: string; slogan: string; cta?: string; bye: string; seal: string};

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

const shadowOf = (ink: string, a: number) => {
  const s = ink.replace('#', '');
  return `rgba(${parseInt(s.slice(0, 2), 16)},${parseInt(s.slice(2, 4), 16)},${parseInt(s.slice(4, 6), 16)},${a})`;
};

/** 集章卡的几何：左右边、上沿、各段高度（film.tsx 也用它给角色定位） */
export const stampCardRect = (w: World, data: FinaleData) => {
  const {geo, lay, plan} = w;
  const tall = geo.h > 1500;
  const x0 = geo.card.x0 + (tall ? 0 : 30);
  const x1 = geo.card.x1 - (tall ? 0 : 30);
  const [y0, yMax] = (lay.stampCard as [number, number]) ?? [150, 900];
  const n = plan.districts.length;
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const headH = 88;
  const gap = 18;
  const padX = 34;
  let cellH = 118;
  // 数据栏：数据竖排（每行约 64px）+ 出处一行，至少放得下左边的集章小圆牌
  const statsH = data.stats.length ? Math.max(112, Math.min(2, data.stats.length) * 64 + (data.sub ? 38 : 0)) + 28 : 0;
  const tailH = 66 + (data.cta ? 56 : 0) + 26;
  const fixed = headH + 26 + (rows - 1) * gap + 24 + statsH + tailH;
  if (fixed + rows * cellH > yMax - y0) cellH = Math.max(92, Math.floor((yMax - y0 - fixed) / rows));
  const h = fixed + rows * cellH;
  return {x0, x1, y0, h, y1: y0 + h, cols, rows, headH, gap, padX, cellH, statsH, cw: (x1 - x0 - padX * 2 - (cols - 1) * gap) / cols};
};

/**
 * 数据栏：左边一枚「集章 k/n」小圆牌（跟着盖章数走），右边数据竖着排成票面上的两行（值 + 单位），
 * 出处小字在最下面。不用「数字 │ 数字」横排加竖分隔那种写法。
 */
const StatRow: React.FC<{w: World; stats: Stat[]; p: number; vSize: number; uSize: number; stamped: number; sub?: string; subSize: number}> = ({w, stats, p, vSize, uSize, stamped, sub, subSize}) => {
  const n = w.plan.districts.length;
  const ink = w.pal.ink;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 26, width: '100%'}}>
      <div style={{flex: 'none', width: 112, height: 112, borderRadius: 56, border: `5px solid ${w.pal.brand}`, background: mixHex(w.pal.brand, '#FFFFFF', 0.9), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', transform: 'rotate(-6deg)'}}>
        <span style={{fontSize: 36, fontWeight: 900, color: w.pal.brand, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>{`${stamped}/${n}`}</span>
        <span style={{fontSize: 26, fontWeight: 800, color: ink, lineHeight: 1.15, whiteSpace: 'nowrap'}}>{pick(w.lang, '集章', 'STAMPS')}</span>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 0}}>
        {stats.slice(0, 2).map((s, i) => (
          <div key={i} style={{display: 'flex', alignItems: 'baseline', gap: 10, whiteSpace: 'nowrap', lineHeight: 1.1}}>
            <span style={{width: 14, height: 14, borderRadius: 7, background: i === 0 ? w.pal.accent : mixHex(ink, '#FFFFFF', 0.6), border: `2.5px solid ${ink}`, flex: 'none', alignSelf: 'center'}} />
            <span style={{fontSize: vSize, fontWeight: 900, color: i === 0 ? w.pal.brand : ink, fontVariantNumeric: 'tabular-nums'}}>{countText(s.value, p)}</span>
            {s.unit ? <span style={{fontSize: uSize, fontWeight: 700, color: ink}}>{s.unit}</span> : null}
          </div>
        ))}
        {sub ? <div style={{fontSize: subSize, color: w.pal.inkSoft, lineHeight: 1.3, whiteSpace: 'nowrap', marginTop: 2}}>{sub}</div> : null}
      </div>
    </div>
  );
};
/** 每个站章落下的时刻（片尾内的秒）：在 stampSpan 秒里均匀排开，站多就盖得快 */
export const stampTimes = (w: World) => {
  const m = w.tk.motion ?? {};
  const n = w.plan.districts.length;
  const a: number = m.stampAt ?? 0.8;
  const span: number = m.stampSpan ?? 0.8;
  return w.plan.districts.map((_, i) => a + (n > 1 ? (i * span) / (n - 1) : 0));
};

export const Finale: React.FC<{w: World; data: FinaleData; t0: number; dur: number}> = ({w, data, t0, dur}) => {
  const {t, pal, tk, geo} = w;
  const ft = t - t0;
  if (ft < 0) return null;
  const ty = tk.type ?? {};
  const m = tk.motion ?? {};
  const ink = pal.ink;
  const C = stampCardRect(w, data);
  const W = C.x1 - C.x0;
  const dim = clamp01((ft - (m.finDim ?? 0.3)) / 0.4);
  const rise = Math.min(1, springAt(ft - (m.stampCardAt ?? 0.35), 18, 170));
  const sealAt: number = m.sealAt ?? 2.0;
  const sealP = ft - sealAt;
  const seal = springAt(sealP, 10, 260);
  const cnt = interpolate(ft, [m.countAt ?? 1.0, (m.countAt ?? 1.0) + (m.counter ?? 0.9)], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const times = stampTimes(w);
  const n = w.plan.districts.length;
  const cardY = C.y0 + (1 - rise) * (geo.h - C.y0 + 60);
  const cardRot = -3 * (1 - rise) - 0.8;
  const statsV = Math.min(56, fitSize(data.stats.reduce((a, s) => ((s.value + (s.unit ?? '')).length > a.length ? s.value + (s.unit ?? '') : a), ''), W - C.padX * 2 - 200, ty.statsValue ?? 64, 44, 0));
  const stamped = times.filter((x) => ft >= x).length;
  const brandSize = fitSize(data.brand, W - C.padX * 2 - 190, ty.endBrand ?? 40, 30, 0);
  const tailOn = clamp01(sealP / 0.18);
  const sealWord = data.seal;
  const sealSize = fitSize(sealWord, 118, ty.endSeal ?? 40, 26, 0);
  return (
    <>
      {/* 压暗城市：主色和底色混出来的一层纱 */}
      <div style={{position: 'absolute', inset: 0, background: mixHex(pal.bg, pal.brand, 0.08), opacity: 0.68 * dim}} />
      {/* 打孔纸屑在集章卡后面落：不压卡上的产品名、站章和数据 */}
      <PunchDots w={w} t0={t0 + sealAt} dur={dur} />
      {rise > 0.001 ? (
        <div style={{position: 'absolute', left: C.x0, top: cardY, width: W, height: C.h, transform: `rotate(${cardRot}deg)`, transformOrigin: '50% 100%'}}>
          <div style={{position: 'absolute', inset: 0, background: pal.card, border: `4.5px solid ${ink}`, borderRadius: tk.radius?.stampCard ?? 22, boxShadow: `8px 10px 0 ${shadowOf(ink, 0.18)}`, overflow: 'hidden', boxSizing: 'border-box'}}>
            {/* 卡头：主色一条，左边产品名，右边两个打孔 */}
            <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: C.headH, background: pal.brand, borderBottom: `4px solid ${ink}`, display: 'flex', alignItems: 'center', padding: `0 ${C.padX}px`, boxSizing: 'border-box'}}>
              <span style={{fontSize: brandSize, fontWeight: 900, color: pal.brandInk, whiteSpace: 'nowrap', lineHeight: 1.2, letterSpacing: 1}}>{data.brand}</span>
            </div>
            {/* 站章格 */}
            {w.plan.districts.map((d, i) => {
              const col = i % C.cols;
              const row = Math.floor(i / C.cols);
              const lastRow = row === C.rows - 1;
              const inRow = lastRow ? n - row * C.cols : C.cols;
              const rowW = inRow * C.cw + (inRow - 1) * C.gap;
              const x = (W - rowW) / 2 + col * (C.cw + C.gap);
              const y = C.headH + 26 + row * (C.cellH + C.gap);
              const st = ft - times[i];
              const p = clamp01(st / 0.1);
              const s = st < 0 ? 1 : 1 + 0.5 * (1 - Easing.out(Easing.cubic)(p));
              const rot = ((i * 37) % 11) - 5;
              const deep = mixHex(d.color, ink, 0.35);
              const cs = fitSize(d.category, C.cw - 40, ty.endStamp ?? 30, 26, 0);
              return (
                <div key={d.k} style={{position: 'absolute', left: x, top: y, width: C.cw, height: C.cellH}}>
                  <div style={{position: 'absolute', inset: 6, borderRadius: 14, border: `3px dashed ${shadowOf(ink, 0.22)}`, opacity: st < 0.05 ? 1 : 0}} />
                  {st >= 0 ? (
                    <div style={{position: 'absolute', inset: 0, transform: `rotate(${rot}deg) scale(${s})`, opacity: Math.min(1, p * 1.5) * 0.95}}>
                      <div style={{position: 'absolute', inset: 0, borderRadius: 16, border: `5px solid ${d.color}`, background: mixHex(d.color, '#FFFFFF', 0.88), boxSizing: 'border-box'}} />
                      <div style={{position: 'absolute', inset: 9, borderRadius: 10, border: `2px dashed ${d.color}`}} />
                      <div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: cs, fontWeight: 900, color: deep, whiteSpace: 'nowrap', lineHeight: 1.2, paddingTop: 10}}>{d.category}</div>
                      <div style={{position: 'absolute', left: 14, top: -14, height: 36, padding: '0 10px', borderRadius: 18, background: d.color, border: `3px solid ${ink}`, color: '#FFFFFF', fontSize: ty.endStampNo ?? 26, fontWeight: 900, lineHeight: '30px', fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box'}}>{String(i + 1).padStart(2, '0')}</div>
                    </div>
                  ) : null}
                  {st >= 0 && st < 0.3 ? (
                    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={C.cw} height={C.cellH}>
                      {Array.from({length: 8}, (_, k) => {
                        const a = (k / 8) * Math.PI * 2 + i;
                        const r = C.cw * 0.42 + (st / 0.3) * 50;
                        return <circle key={k} cx={C.cw / 2 + Math.cos(a) * r} cy={C.cellH / 2 + Math.sin(a) * r * 0.6} r={5 * (1 - st / 0.3) + 1} fill={d.color} />;
                      })}
                    </svg>
                  ) : null}
                </div>
              );
            })}
            {/* 数据 */}
            {data.stats.length ? (
              <div style={{position: 'absolute', left: C.padX, right: C.padX, top: C.headH + 26 + C.rows * C.cellH + (C.rows - 1) * C.gap + 24, height: C.statsH, borderTop: `3px dashed ${shadowOf(ink, 0.25)}`, display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box', opacity: clamp01((ft - (m.countAt ?? 1) + 0.15) / 0.15)}}>
                <StatRow w={w} stats={data.stats} p={cnt} vSize={statsV} uSize={ty.statsUnit ?? 36} stamped={stamped} sub={data.sub} subSize={ty.statsSub ?? 28} />
              </div>
            ) : null}
            {/* 口号 + 获取方式（盖完「到站」章后出现） */}
            <div style={{position: 'absolute', left: C.padX, right: C.padX, bottom: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: tailOn, transform: `translateY(${(1 - tailOn) * 16}px)`}}>
              <div style={{fontSize: fitSize(data.slogan, W - C.padX * 2 - 10, ty.endSlogan ?? 48, 40, 0), fontWeight: 800, color: ink, lineHeight: 1.25, whiteSpace: 'nowrap'}}>{data.slogan}</div>
              {data.cta ? (
                <div style={{fontSize: fitSize(data.cta, W - C.padX * 2 - 30, ty.endCta ?? 40, 34, 0), fontWeight: 800, color: pal.brand, lineHeight: 1.25, whiteSpace: 'nowrap', padding: '0 12px', background: `linear-gradient(transparent 62%, ${mixHex(pal.accent, '#FFFFFF', 0.45)} 62%, ${mixHex(pal.accent, '#FFFFFF', 0.45)} 94%, transparent 94%)`}}>{data.cta}</div>
              ) : null}
            </div>
          </div>
          {/* 「到站」圆章：压在卡头右端 */}
          {sealP >= 0 ? (
            <div style={{position: 'absolute', right: 18, top: -30, width: 150, height: 150, transform: `rotate(-14deg) scale(${1 + 0.6 * (1 - Math.min(1, seal))})`, opacity: clamp01(sealP / 0.06)}}>
              <svg width={150} height={150} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
                <circle cx={75} cy={75} r={70} fill={pal.card} stroke={pal.brand} strokeWidth={7} />
                <circle cx={75} cy={75} r={56} fill="none" stroke={pal.brand} strokeWidth={2.5} strokeDasharray="7 5" />
                {[0, 1, 2].map((k) => (
                  <circle key={k} cx={55 + k * 20} cy={116} r={4} fill={pal.brand} />
                ))}
                <circle cx={75} cy={36} r={6} fill={pal.accent} stroke={ink} strokeWidth={2} />
              </svg>
              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: sealSize, fontWeight: 900, color: pal.brand, whiteSpace: 'nowrap', lineHeight: 1, letterSpacing: 2}}>{sealWord}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

/** 打孔纸屑：圆点，从上方飘下（主色、强调色、各站类别色） */
const PunchDots: React.FC<{w: World; t0: number; dur: number}> = ({w, t0}) => {
  const ft = w.t - t0;
  if (ft < 0) return null;
  const cols = [w.pal.brand, w.pal.accent, '#FFFFFF', ...w.plan.districts.map((d) => d.color)];
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}} width={w.geo.w} height={w.geo.h}>
      {Array.from({length: 64}, (_, i) => {
        const r = (k: number) => {
          const x = Math.sin((i + 1) * 12.9898 * (k + 1)) * 43758.5453;
          return x - Math.floor(x);
        };
        const x = r(1) * w.geo.w + Math.sin(ft * (1.5 + r(2) * 2) + i) * 24;
        const y = -40 - r(3) * 420 + ft * (360 + r(4) * 300);
        if (y > w.geo.h + 30) return null;
        const rr = 7 + r(6) * 6;
        return <circle key={i} cx={x} cy={y} r={rr} fill={cols[i % cols.length]} stroke={w.pal.ink} strokeWidth={2} opacity={0.95} />;
      })}
    </svg>
  );
};

export const sealWordOf = (lang: 'zh' | 'en') => pick(lang, '到站', 'ARRIVED');
