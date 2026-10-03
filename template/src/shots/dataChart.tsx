import React from 'react';
import {pop} from '../core/anim';
import {FONT, MONO} from '../core/font';
import {pick, type Lang} from '../core/kit';
import {CARD, MAIN} from '../core/safe';
import {alpha, chartFallback, inkOn, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

type Datum = {label: string; value: number; series?: string; focus?: boolean};
type KPI = {label: string; value: string};
type P = {
  title: string;
  takeaway: string;
  chartType: 'bar' | 'line' | 'dot' | 'stacked' | 'donut';
  palette?: 'micro' | 'mono' | 'porcelain' | 'palm' | 'wire';
  data: Datum[];
  kpis?: KPI[];
  annotations?: string[];
  unit?: string;
  max?: number;
  refs: string[];
};

const PALETTES = {
  // MicroPalette references supplied in the project: ink, aubergine, blue, lavender.
  // The warm paper/card stays neutral so these series read as a deliberate set.
  micro: ['#0E1531', '#6D2B50', '#5E7FB5', '#77769C', '#97A3DA'],
  mono: ['#34383D', '#4C5156', '#60656A', '#73787C', '#858A8F'],
  porcelain: ['#374B6F', '#425A82', '#506C96', '#617EA8', '#748FB8'],
  palm: ['#0E4D4E', '#3A7568', '#648D78', '#A0A873', '#C27848'],
  wire: ['#41464B', '#595F64', '#72787C', '#91979A', '#E67E32'],
};
// 1080×1920 竖屏在手机上缩小显示；图表卡的字级以正文、数据、注释分层。
const TYPE = {
  title: 30,
  takeaway: 44,
  kpi: 52,
  kpiLabel: 28,
  plot: 30,
  plotValue: 30,
  note: 28,
  source: 28,
};
const INNER_W = CARD.w - 68;
const INNER_H = MAIN.h - 68;
const valueText = (n: number, unit = '') => `${Number.isInteger(n) ? n : Number(n.toFixed(1))}${unit}`;
/** 刻度取整，且 0 / 中点 / 上限都能被 2 整除，避免 107.5 这种半格。 */
const evenCeil = (n: number) => {
  const c = Math.ceil(n - 1e-9);
  return c % 2 === 0 ? Math.max(2, c) : c + 1;
};
const textWidth = (s: string, fs: number) => {
  let w = 0;
  for (const ch of Array.from(s)) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === ' ') w += fs * 0.33;
    else if (cp > 0xff) w += fs * 1.05;
    else w += fs * 0.64;
  }
  return w;
};
type Box = {x: number; y: number; w: number; h: number; text: string; fill: string; weight?: number; fs: number};

const DataChart: React.FC<ShotProps<P>> = ({params: p, t, meta}) => {
  const th = useTheme();
  const lang: Lang | undefined = meta.lang;
  const paletteName = p.palette ?? 'micro';
  const colors = p.palette ? PALETTES[p.palette] : th.chartColors?.length ? th.chartColors : chartFallback(th.card);
  const enter = pop(t, 0, 14, 180);
  const data = (p.data ?? []).slice(0, 6);
  const max = p.max && p.max > 0 ? p.max : Math.max(1, ...data.map((d) => d.value));
  const labels = [...new Set(data.map((d) => d.series ?? ''))].filter(Boolean);
  const focusColor = meta.brandColor ? th.accent : paletteName === 'micro' ? colors[1] : paletteName === 'palm' || paletteName === 'wire' ? colors[4] : colors[0];
  const seriesColor = (series: string) => {
    // A series keeps one color across segments and its legend, including focused rows.
    if (data.some((d) => d.series === series && d.focus)) return focusColor;
    const others = labels.filter((s) => !data.some((d) => d.series === s && d.focus));
    const available = colors.filter((c) => c !== focusColor);
    return available[Math.max(0, others.indexOf(series)) % available.length];
  };
  const colorFor = (d: Datum, i: number) => {
    if (d.series) return seriesColor(d.series);
    if (d.focus && meta.brandColor) return th.accent;
    if (d.focus && paletteName === 'micro') return colors[1];
    if (d.focus && p.palette === 'wire') return colors[4];
    if (d.focus && paletteName === 'palm') return colors[4];
    const palette = paletteName === 'micro' ? colors.filter((_, index) => index !== 1) : colors;
    const categoryCount = paletteName === 'wire' || paletteName === 'palm' ? 4 : palette.length;
    const unaccentedIndex = d.series
      ? Math.max(0, labels.indexOf(d.series))
      : data.slice(0, i).filter((item) => !item.focus).length;
    return palette[unaccentedIndex % categoryCount];
  };
  const refs = new Set(p.refs ?? []);
  const sources = (meta.facts ?? []).filter((f) => refs.has(f.id)).map((f) => f.source).filter(Boolean);
  const chartType = p.chartType ?? 'bar';
  const axisName = p.unit || pick(lang, '数值', 'Value');
  const sourceText = sources.length ? `${pick(lang, '数据来源：', 'Source: ')}${[...new Set(sources)].join(pick(lang, '；', '; '))}` : '';

  // 先按字号估每一块的高度，图表区用剩下的，条目多就缩小行高，避免压住 KPI 和旁注。
  // 结论优先收成一行，避免「方案」被拆成行尾孤字；收不动再排两行。
  let takeFs = TYPE.takeaway;
  while (takeFs > 34 && textWidth(p.takeaway ?? '', takeFs) > INNER_W - 8) takeFs -= 2;
  const takeLines = Math.min(2, Math.max(1, Math.ceil(textWidth(p.takeaway ?? '', takeFs) / (INNER_W - 8))));
  const titleH = 40;
  const takeH = 10 + (takeLines > 1 ? Math.ceil(takeFs * 1.25) * 2 + 8 : Math.ceil(takeFs * 1.35));
  const kpiN = Math.min(3, p.kpis?.length ?? 0);
  const kpiH = kpiN ? 12 + 122 : 0;
  const annN = Math.min(2, p.annotations?.length ?? 0);
  const annLong = Math.max(0, ...(p.annotations ?? []).slice(0, 2).map((a) => textWidth(a, TYPE.note)));
  const annFs = annLong > INNER_W - 24 ? 26 : TYPE.note;
  const annH = annN ? 12 + annN * (annFs + 10) : 0;
  const srcLines = sourceText ? Math.min(2, Math.max(1, Math.ceil(textWidth(sourceText, TYPE.source) / (INNER_W - 8)))) : 0;
  const srcH = srcLines ? 8 + srcLines * 36 : 0;
  const needsLegend = labels.length > 1 && chartType !== 'donut' && chartType !== 'stacked';
  const legendH = needsLegend ? 36 : 0;
  const axisH = chartType === 'line' || chartType === 'dot' ? 30 : 0;
  const plotH = Math.max(150, INNER_H - titleH - takeH - kpiH - annH - srcH - 8);
  const labelCol = 12 * TYPE.plot + 12;

  const bars = () => {
    const n = Math.max(1, data.length);
    let gap = n >= 6 ? 8 : n > 4 ? 12 : 18;
    let rowH = Math.floor((plotH - gap * (n - 1)) / n);
    if (rowH < 32) {
      gap = 6;
      rowH = Math.floor((plotH - gap * (n - 1)) / n);
    }
    rowH = Math.max(28, Math.min(40, rowH));
    const barH = Math.min(32, rowH);
    const valueCol = 100;
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap, width: '100%'}}>
        {data.map((d, i) => {
          const q = pop(t, 0.25 + i * 0.16, 14, 200);
          const w = Math.max(2, Math.min(100, (d.value / max) * 100));
          const color = colorFor(d, i);
          return (
            <div key={`${d.label}-${i}`} style={{display: 'grid', gridTemplateColumns: `${labelCol}px 1fr ${valueCol}px`, gap: 12, alignItems: 'center', height: rowH, opacity: Math.min(1, q * 1.7), transform: `translateX(${(1 - q) * 18}px)`}}>
              <div style={{fontSize: TYPE.plot, lineHeight: `${rowH}px`, fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap'}}>{d.label}</div>
              <div style={{height: barH, borderRadius: 8, background: alpha(color, 0.1), overflow: 'hidden'}}>
                <div style={{height: '100%', width: `${d.value === 0 ? 0 : w * q}%`, borderRadius: 8, background: color}} />
              </div>
              <div style={{fontFamily: MONO, fontSize: TYPE.plotValue, lineHeight: `${rowH}px`, fontWeight: 800, color: th.cardText, textAlign: 'right', whiteSpace: 'nowrap'}}>{valueText(d.value, p.unit)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const plot = () => {
    if (chartType === 'bar') return bars();
    if (chartType === 'donut') {
      const sum = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
      let offset = 0;
      const circumference = 2 * Math.PI * 104;
      const featured = data.find((d) => d.focus) ?? data.reduce((a, d) => (d.value > a.value ? d : a), data[0]);
      const size = Math.min(260, plotH);
      const featFs = textWidth(featured.label, 28) <= 150 ? 28 : 26;
      return (
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, width: '100%', height: plotH}}>
          <svg width={size} height={size} viewBox="0 0 280 280" style={{flex: 'none'}}>
            <circle cx="140" cy="140" r="104" fill="none" stroke={th.line} strokeWidth="38" />
            {data.map((d, i) => {
              const len = (Math.max(0, d.value) / sum) * circumference;
              const dash = `${len} ${circumference - len}`;
              const dashOffset = -offset;
              offset += len;
              const q = pop(t, 0.25 + i * 0.14, 14, 200);
              return <circle key={i} cx="140" cy="140" r="104" fill="none" stroke={colorFor(d, i)} strokeWidth="34" strokeDasharray={dash} strokeDashoffset={dashOffset} transform="rotate(-90 140 140)" strokeLinecap="butt" opacity={Math.min(1, q * 1.6)} />;
            })}
            <text x="140" y="144" textAnchor="middle" fill={th.cardText} fontSize="52" fontWeight="800" fontFamily={FONT}>{Math.round((featured.value / sum) * 100)}%</text>
            <text x="140" y="182" textAnchor="middle" fill={th.cardSub} fontSize={featFs} fontFamily={FONT}>{featured.label}</text>
          </svg>
          <div style={{display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0}}>
            {data.map((d, i) => (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: TYPE.plot, fontWeight: d.focus ? 800 : 500, color: th.cardText, whiteSpace: 'nowrap'}}>
                <span style={{width: 16, height: 16, borderRadius: 8, background: colorFor(d, i), flex: 'none'}} />
                <span style={{flex: 1}}>{d.label}</span>
                <b style={{fontFamily: FONT, fontSize: TYPE.plotValue, fontVariantNumeric: 'tabular-nums', color: th.cardText}}>{Math.round((d.value / sum) * 100)}%</b>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (chartType === 'stacked') {
      const cats = [...new Set(data.map((d) => d.label))];
      const series = labels.length ? labels : [''];
      const n = Math.max(1, cats.length);
      let gap = n > 4 ? 10 : 16;
      let rowH = Math.floor((plotH - 40 - gap * (n - 1)) / n);
      if (rowH < 36) {
        gap = 8;
        rowH = Math.floor((plotH - 40 - gap * (n - 1)) / n);
      }
      rowH = Math.max(32, Math.min(48, rowH));
      const trackW = INNER_W - labelCol - 12;
      return (
        <div style={{display: 'flex', flexDirection: 'column', gap, width: '100%'}}>
          {cats.map((cat, i) => {
            const rows = data.filter((d) => d.label === cat);
            const total = rows.reduce((a, d) => a + d.value, 0) || 1;
            return (
              <div key={cat} style={{display: 'grid', gridTemplateColumns: `${labelCol}px 1fr`, gap: 12, alignItems: 'center', height: rowH}}>
                <span style={{fontSize: 28, fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap'}}>{cat}</span>
                <div style={{display: 'flex', height: Math.min(42, rowH), borderRadius: 12, overflow: 'hidden', background: th.cardAlt}}>
                  {rows.map((d, j) => {
                    const q = pop(t, 0.3 + i * 0.18 + j * 0.08, 14, 200);
                    const color = colorFor(d, j);
                    const label = valueText(d.value, p.unit);
                    const segW = Math.max(0, (d.value / total) * trackW * Math.min(1, q * 1.4));
                    const show = d.value / total >= 0.18 && textWidth(label, 26) + 10 <= segW;
                    return (
                      <div key={j} title={d.series} style={{width: `${Math.max(0, (d.value / total) * 100 * q)}%`, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap', color: inkOn(color), fontFamily: MONO, fontSize: 26, fontWeight: 800}}>
                        {show ? label : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px 18px', justifyContent: 'center'}}>
            {series.map((s) => (
              <span key={s} style={{display: 'flex', alignItems: 'center', gap: 7, color: th.cardSub, fontSize: 28}}>
                <i style={{width: 14, height: 14, borderRadius: 7, background: seriesColor(s)}} />
                {s || pick(lang, '数据', 'Data')}
              </span>
            ))}
            <span style={{fontSize: 28, color: th.cardSub}}>{pick(lang, '每条 = 100%', 'each bar = 100%')}</span>
          </div>
        </div>
      );
    }
    if (chartType === 'dot') {
      const W = INNER_W;
      const axisMax = evenCeil(max);
      const n = Math.max(1, data.length);
      const avail = Math.max(120, plotH - axisH - legendH);
      let rowH = Math.floor((avail - 40) / n);
      rowH = Math.max(32, Math.min(54, rowH));
      const top = 8;
      const bottom = top + n * rowH;
      const H = Math.min(avail, bottom + 40);
      const valueCol = 108;
      const x0 = labelCol;
      const x1 = W - valueCol - 8;
      const ticks = [0, axisMax / 2, axisMax];
      return (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          {ticks.map((tick) => {
            const x = x0 + (tick / axisMax) * (x1 - x0);
            return (
              <g key={tick}>
                <line x1={x} x2={x} y1={top} y2={bottom} stroke={th.line} strokeWidth="2" />
                <text x={x} y={bottom + 28} textAnchor="middle" fill={th.cardSub} fontSize="26" fontFamily={FONT}>{`${tick}${p.unit ?? ''}`}</text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const y = top + 18 + i * rowH;
            const x = x0 + (Math.max(0, d.value) / axisMax) * (x1 - x0);
            const color = d.focus ? focusColor : d.series ? seriesColor(d.series) : colors[0];
            const q = Math.min(1, pop(t, 0.3 + i * 0.12, 14, 200) * 1.6);
            const fs = textWidth(d.label, 30) <= x0 - 8 ? 30 : 26;
            return (
              <g key={i} opacity={q}>
                <text x="0" y={y + 8} fill={th.cardSub} fontSize={fs} fontWeight={d.focus ? 800 : 500} fontFamily={FONT}>{d.label}</text>
                <line x1={x0} x2={x1} y1={y} y2={y} stroke={th.line} strokeWidth="2" />
                <line x1={x0} x2={x} y1={y} y2={y} stroke={alpha(color, 0.24)} strokeWidth="5" />
                <circle cx={x} cy={y} r={d.focus ? 11 : 8} fill={color} />
                <text x={W - 4} y={y + 8} textAnchor="end" fill={th.cardText} fontSize="30" fontWeight="800" fontFamily={MONO}>{valueText(d.value, p.unit)}</text>
              </g>
            );
          })}
        </svg>
      );
    }
    const W = INNER_W;
    const H = Math.max(140, plotH - axisH - legendH);
    const fs = 28;
    const labelH = Math.ceil(fs * 1.2);
    const padX = 86;
    const padTop = labelH + 22;
    const padBot = 52;
    const plotTop = padTop;
    const plotBot = H - padBot;
    const inner = Math.max(48, plotBot - plotTop);
    const axisMax = evenCeil(Math.max(max, 1));
    const grouped = labels.length
      ? labels.map((s) => ({name: s, values: data.filter((d) => d.series === s)}))
      : [{name: '', values: data}];
    const cats = [...new Set(grouped.flatMap((g) => g.values.map((d) => d.label)))];
    const nPts = Math.max(1, cats.length);
    const widest = Math.max(48, ...data.map((d) => textWidth(valueText(d.value, p.unit), fs) + 10));
    const xLo = padX + widest / 2;
    const xHi = W - 8 - widest / 2;
    const xAt = (i: number) => (nPts <= 1 ? (xLo + xHi) / 2 : xLo + (i / (nPts - 1)) * (xHi - xLo));
    const yAt = (v: number) => plotBot - (Math.max(0, v) / axisMax) * inner;
    const valueBoxes: Box[] = [];
    const xBoxes: Box[] = [];
    cats.forEach((cat, i) => {
      const here: {d: Datum; x: number; y: number; color: string}[] = [];
      grouped.forEach((g) => {
        const d = g.values.find((v) => v.label === cat);
        if (!d) return;
        const color = g.name ? seriesColor(g.name) : colors[0];
        here.push({d, x: xAt(i), y: yAt(d.value), color});
      });
      here.sort((a, b) => a.y - b.y);
      here.forEach((pt, k) => {
        const text = valueText(pt.d.value, p.unit);
        const w = textWidth(text, fs) + 10;
        const above = here.length === 1 || k < here.length - 1;
        let top = above ? pt.y - 16 - labelH : pt.y + 18;
        if (!above && top + labelH > plotBot - 4) top = pt.y - 16 - labelH;
        let left = pt.x - w / 2;
        if (left < padX + 4) left = padX + 4;
        if (left + w > W - 4) left = W - 4 - w;
        valueBoxes.push({x: left, y: top, w, h: labelH, text, fill: th.cardText, weight: 800, fs});
      });
      const xw = textWidth(cat, 26) + 8;
      xBoxes.push({x: Math.max(4, xAt(i) - xw / 2), y: H - 42, w: xw, h: 32, text: cat, fill: th.cardSub, fs: 26});
    });
    const hit = (a: Box, b: Box) => {
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return ix > 2 && iy > 2 ? {ix, iy} : null;
    };
    for (let pass = 0; pass < 14; pass++) {
      let moved = false;
      for (let i = 0; i < valueBoxes.length; i++) {
        for (let j = 0; j < valueBoxes.length; j++) {
          if (i === j) continue;
          const o = hit(valueBoxes[i], valueBoxes[j]);
          if (!o) continue;
          const push = o.iy / 2 + 5;
          if (valueBoxes[i].y <= valueBoxes[j].y) valueBoxes[i].y -= push;
          else valueBoxes[i].y += push;
          moved = true;
        }
        for (const fixed of xBoxes) {
          const o = hit(valueBoxes[i], fixed);
          if (!o) continue;
          valueBoxes[i].y -= o.iy + 6;
          moved = true;
        }
      }
      if (!moved) break;
    }
    for (const b of valueBoxes) {
      if (b.y < 2) b.y = 2;
      if (b.y + b.h > H - 46) b.y = H - 46 - b.h;
    }
    const ticks = [0, axisMax / 2, axisMax];
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {ticks.map((tick) => {
          const y = yAt(tick);
          return (
            <g key={tick}>
              <line x1={padX} y1={y} x2={W - 28} y2={y} stroke={th.line} strokeWidth="2" strokeDasharray={tick ? '5 7' : undefined} />
              <text x={padX - 12} y={y + 8} textAnchor="end" fill={th.cardSub} fontSize="26" fontFamily={FONT}>{String(tick)}</text>
            </g>
          );
        })}
        {grouped.map((g, si) => {
          const pts = cats.map((cat, i) => {
            const d = g.values.find((v) => v.label === cat);
            return d ? {d, x: xAt(i), y: yAt(d.value)} : null;
          }).filter((pt): pt is {d: Datum; x: number; y: number} => !!pt);
          const color = g.name ? seriesColor(g.name) : colors[0];
          return (
            <g key={`s${si}`}>
              {chartType === 'line' && pts.length > 1 ? <polyline points={pts.map((pt) => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /> : null}
              {pts.map((pt, i) => {
                const q = pop(t, 0.3 + i * 0.12, 14, 200);
                return <circle key={i} cx={pt.x} cy={pt.y} r={pt.d.focus ? 11 : 8} fill={pt.d.focus ? focusColor : color} stroke={th.card} strokeWidth="3" opacity={Math.min(1, q * 1.6)} />;
              })}
            </g>
          );
        })}
        {xBoxes.map((b, i) => (
          <text key={`x${i}`} x={b.x + b.w / 2} y={b.y + b.fs} textAnchor="middle" fill={b.fill} fontSize={b.fs} fontFamily={FONT}>{b.text}</text>
        ))}
        {valueBoxes.map((b, i) => (
          <text key={`v${i}`} x={b.x + b.w / 2} y={b.y + b.fs} textAnchor="middle" fill={b.fill} fontSize={b.fs} fontWeight={b.weight ?? 700} fontFamily={FONT}>{b.text}</text>
        ))}
      </svg>
    );
  };

  const kpiCols = Math.max(1, kpiN);
  const kpiColW = (INNER_W - 10 * (kpiCols - 1)) / kpiCols - 28;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: CARD.x0, top: MAIN.y0, width: CARD.w, height: MAIN.h, boxSizing: 'border-box', borderRadius: 40, background: th.card, boxShadow: th.shadow, padding: 34, display: 'flex', flexDirection: 'column', opacity: Math.min(1, enter * 1.5), transform: `translateY(${(1 - enter) * 40}px) scale(${0.96 + 0.04 * enter})`}}>
        <header style={{height: titleH, fontSize: TYPE.title, lineHeight: `${titleH}px`, fontWeight: 600, color: th.cardSub, whiteSpace: 'nowrap', flex: 'none'}}>{p.title}</header>
        <div style={{marginTop: 10, height: takeH - 10, flex: 'none', fontSize: takeFs, lineHeight: 1.2, fontWeight: 800, color: th.cardText}}>{p.takeaway}</div>
        {kpiN ? (
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${kpiCols}, 1fr)`, gap: 10, marginTop: 12, flex: 'none'}}>
            {p.kpis!.slice(0, 3).map((k, i) => {
              const valueFs = Math.min(TYPE.kpi, Math.max(32, Math.floor(kpiColW / Math.max(1, textWidth(k.value, 1)))));
              const labelFs = textWidth(k.label, TYPE.kpiLabel) <= kpiColW ? TYPE.kpiLabel : 26;
              return (
                <div key={i} style={{minWidth: 0, padding: '12px 14px', borderRadius: 16, background: th.cardAlt, opacity: Math.min(1, pop(t, 0.2 + i * 0.12, 14, 200) * 1.5)}}>
                  <div style={{fontFamily: FONT, fontSize: valueFs, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, fontWeight: 800, color: th.accent, whiteSpace: 'nowrap'}}>{k.value}</div>
                  <div style={{fontSize: labelFs, marginTop: 5, color: th.cardSub, whiteSpace: 'nowrap'}}>{k.label}</div>
                </div>
              );
            })}
          </div>
        ) : null}
        <div style={{flex: 'none', height: plotH, marginTop: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          {needsLegend ? (
            <div style={{display: 'flex', gap: 18, justifyContent: 'center', height: legendH, alignItems: 'center'}}>
              {labels.map((s) => (
                <span key={s} style={{display: 'flex', alignItems: 'center', gap: 7, fontSize: TYPE.note, color: th.cardSub}}>
                  <i style={{width: 14, height: 14, borderRadius: 7, background: seriesColor(s)}} />
                  {s}
                </span>
              ))}
            </div>
          ) : null}
          {axisH ? <div style={{height: axisH, fontSize: 26, lineHeight: `${axisH}px`, color: th.cardSub}}>{axisName}</div> : null}
          {plot()}
        </div>
        {annN ? (
          <div style={{display: 'flex', flexDirection: 'column', gap: 4, borderTop: `2px solid ${th.line}`, paddingTop: 8, marginTop: 8, flex: 'none'}}>
            {p.annotations!.slice(0, 2).map((a, i) => (
              <div key={i} style={{fontSize: annFs, lineHeight: 1.25, color: th.cardSub, whiteSpace: 'nowrap'}}>• {a}</div>
            ))}
          </div>
        ) : null}
        {sourceText ? <footer style={{fontSize: TYPE.source, lineHeight: 1.25, color: th.cardMuted, marginTop: 8, flex: 'none'}}>{sourceText}</footer> : null}
      </div>
    </div>
  );
};

export default DataChart;

export const sfx = (_p: P, _ctx: {dur: number; beat: number}): SfxCue[] => [{at: 0.04, kind: 'pop', vol: 0.18}, {at: 0.55, kind: 'tick', vol: 0.14}, {at: 1.05, kind: 'tick', vol: 0.12}];
