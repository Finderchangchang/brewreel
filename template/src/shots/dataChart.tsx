import React from 'react';
import {pop} from '../core/anim';
import {FONT, MONO} from '../core/font';
import {CARD, MAIN} from '../core/safe';
import {alpha, inkOn, useTheme} from '../core/theme';
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
const valueText = (n: number, unit = '') => `${Number.isInteger(n) ? n : Number(n.toFixed(1))}${unit}`;

const DataChart: React.FC<ShotProps<P>> = ({params: p, t, meta}) => {
  const th = useTheme();
  const paletteName = p.palette ?? 'micro';
  const colors = !p.palette && th.chartColors?.length ? th.chartColors : PALETTES[paletteName];
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
  const plotH = 300;
  const chartType = p.chartType ?? 'bar';

  const bars = () => (
    <div style={{display: 'flex', flexDirection: 'column', gap: data.length > 4 ? 12 : 20, width: '100%'}}>
      {data.map((d, i) => {
        const q = pop(t, 0.25 + i * 0.16, 14, 200);
        const w = Math.max(2, Math.min(100, (d.value / max) * 100));
        const color = colorFor(d, i);
        return <div key={`${d.label}-${i}`} style={{display: 'grid', gridTemplateColumns: '142px 1fr 92px', gap: 12, alignItems: 'center', opacity: Math.min(1, q * 1.7), transform: `translateX(${(1 - q) * 18}px)`}}>
          <div style={{fontSize: TYPE.plot, fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{d.label}</div>
          <div style={{height: 32, borderRadius: 8, background: alpha(color, 0.10), overflow: 'hidden'}}><div style={{height: '100%', width: `${d.value === 0 ? 0 : w * q}%`, borderRadius: 8, background: color}} /></div>
          <div style={{fontFamily: MONO, fontSize: TYPE.plotValue, fontWeight: 800, color: th.cardText, textAlign: 'right', whiteSpace: 'nowrap'}}>{valueText(d.value, p.unit)}</div>
        </div>;
      })}
    </div>
  );

  const plot = () => {
    if (chartType === 'bar') return bars();
    if (chartType === 'donut') {
      const sum = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
      let offset = 0;
      const circumference = 2 * Math.PI * 104;
      const featured = data.find((d) => d.focus) ?? data.reduce((a, d) => d.value > a.value ? d : a, data[0]);
      return <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, width: '100%'}}>
        <svg width="280" height="280" viewBox="0 0 280 280" style={{flex: 'none'}}>
          <circle cx="140" cy="140" r="104" fill="none" stroke={th.line} strokeWidth="38" />
          {data.map((d, i) => { const len = (Math.max(0, d.value) / sum) * circumference; const dash = `${len} ${circumference - len}`; const dashOffset = -offset; offset += len; const q = pop(t, 0.25 + i * 0.14, 14, 200); return <circle key={i} cx="140" cy="140" r="104" fill="none" stroke={colorFor(d, i)} strokeWidth="34" strokeDasharray={dash} strokeDashoffset={dashOffset} transform="rotate(-90 140 140)" strokeLinecap="butt" opacity={Math.min(1, q * 1.6)} />; })}
          <text x="140" y="144" textAnchor="middle" fill={th.cardText} fontSize="52" fontWeight="800">{Math.round(featured.value / sum * 100)}%</text>
          <text x="140" y="182" textAnchor="middle" fill={th.cardSub} fontSize="28">{featured.label.length > 5 ? featured.label.slice(0, 5) + '…' : featured.label}</text>
        </svg>
        <div style={{display: 'flex', flexDirection: 'column', gap: 16, width: 300, minWidth: 0}}>{data.map((d, i) => <div key={i} style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: TYPE.plot, fontWeight: d.focus ? 800 : 500, color: th.cardText, whiteSpace: 'nowrap'}}><span style={{width: 16, height: 16, borderRadius: 8, background: colorFor(d, i), flex: 'none'}} /><span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis'}}>{d.label}</span><b style={{fontFamily: FONT, fontSize: TYPE.plotValue, fontVariantNumeric: 'tabular-nums', color: th.cardText}}>{Math.round((d.value / sum) * 100)}%</b></div>)}</div>
      </div>;
    }
    if (chartType === 'stacked') {
      const cats = [...new Set(data.map((d) => d.label))];
      const series = labels.length ? labels : [''];
      return <div style={{display: 'flex', flexDirection: 'column', gap: 18, width: '100%'}}>
        {cats.map((cat, i) => { const rows = data.filter((d) => d.label === cat); const total = rows.reduce((a, d) => a + d.value, 0) || 1; return <div key={cat} style={{display: 'grid', gridTemplateColumns: '138px 1fr', gap: 12, alignItems: 'center'}}><span style={{fontSize: 28, fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{cat}</span><div style={{display: 'flex', height: 42, borderRadius: 12, overflow: 'hidden', background: th.cardAlt}}>{rows.map((d, j) => { const q = pop(t, 0.3 + i * 0.18 + j * 0.08, 14, 200); return <div key={j} title={d.series} style={{width: `${Math.max(0, (d.value / total) * 100 * q)}%`, background: colorFor(d, j), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap', color: inkOn(colorFor(d, j)), fontFamily: MONO, fontSize: 26, fontWeight: 800}}>{d.value / total >= 0.18 ? valueText(d.value, p.unit) : null}</div>; })}</div></div>; })}
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px 18px', justifyContent: 'center'}}>{series.map((s) => <span key={s} style={{display: 'flex', alignItems: 'center', gap: 7, color: th.cardSub, fontSize: 28}}><i style={{width: 14, height: 14, borderRadius: 7, background: seriesColor(s)}} />{s || '数据'}</span>)}<span style={{fontSize:28,color:th.cardSub}}>每条 = 100%</span></div>
      </div>;
    }
    if (chartType === 'dot') {
      const W = 712, x0 = 155, x1 = 620;
      const rowH = data.length > 4 ? 42 : 54;
      const bottom = data.length * rowH + 10;
      return <svg width="100%" height={bottom + 42} viewBox={`0 0 ${W} ${bottom + 42}`}>
        {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1={x0 + fraction * (x1 - x0)} x2={x0 + fraction * (x1 - x0)} y1="8" y2={bottom} stroke={th.line} strokeWidth="2"/><text x={x0 + fraction * (x1 - x0)} y={bottom + 32} textAnchor="middle" fill={th.cardSub} fontSize="26">{valueText(max * fraction, p.unit)}</text></g>)}
        {data.map((d, i) => {
          const y = 24 + i * rowH, x = x0 + d.value / max * (x1 - x0);
          const color = d.focus ? focusColor : d.series ? seriesColor(d.series) : colors[0];
          const q = Math.min(1, pop(t, .3 + i * .12, 14, 200) * 1.6);
          return <g key={i} opacity={q}><text x="0" y={y + 9} fill={th.cardSub} fontSize="30" fontWeight={d.focus ? 800 : 500}>{d.label.length > 4 ? d.label.slice(0,4)+'…' : d.label}</text><line x1={x0} x2={x1} y1={y} y2={y} stroke={th.line} strokeWidth="2"/><line x1={x0} x2={x} y1={y} y2={y} stroke={alpha(color,.24)} strokeWidth="5"/><circle cx={x} cy={y} r={d.focus ? 11 : 8} fill={color}/><text x="708" y={y + 9} textAnchor="end" fill={th.cardText} fontSize="30" fontWeight="800">{valueText(d.value,p.unit)}</text></g>;
        })}
      </svg>;
    }
    const W = 712;
    const H = plotH;
    const padX = 65;
    const padY = 46;
    const grouped = labels.length ? labels.map((s) => ({name: s, values: data.filter((d) => d.series === s)})) : [{name: '', values: data}];
    const allPts: React.ReactNode[] = [];
    grouped.forEach((g, si) => {
      const pts = g.values.map((d, i) => ({d, x: padX + 48 + (g.values.length === 1 ? (W - 2 * padX - 48) / 2 : (i / (g.values.length - 1)) * (W - 2 * padX - 48)), y: H - padY - (Math.max(0, d.value) / max) * (H - 2 * padY), i}));
      const color = g.name ? seriesColor(g.name) : colors[0];
      if (chartType === 'line' && pts.length > 1) allPts.push(<polyline key={`l${si}`} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />);
      pts.forEach((pt, i) => { const q = pop(t, 0.3 + i * 0.12, 14, 200); allPts.push(<g key={`${si}-${i}`} opacity={Math.min(1, q * 1.6)}><circle cx={pt.x} cy={pt.y} r={pt.d.focus ? 11 : 8} fill={pt.d.focus ? focusColor : color} stroke={th.card} strokeWidth="3" /><text x={pt.x} y={H - 6} textAnchor="middle" fill={th.cardSub} fontSize="26">{pt.d.label.length > 3 ? pt.d.label.slice(0,3)+'…' : pt.d.label}</text><text x={pt.x} y={pt.y - 18} textAnchor="middle" fill={th.cardText} fontSize="28" fontWeight="800">{valueText(pt.d.value, p.unit)}</text></g>); });
    });
    return <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <text x="0" y="23" fill={th.cardSub} fontSize="26">{p.unit || '数值'}</text>
      {[0,.5,1].map((fraction) => {const y=H-padY-fraction*(H-2*padY);return <g key={fraction}><line x1={padX} y1={y} x2={W-padX} y2={y} stroke={th.line} strokeWidth="2" strokeDasharray={fraction ? '5 7' : undefined}/><text x={padX-10} y={y+9} textAnchor="end" fill={th.cardSub} fontSize="26">{valueText(max*fraction)}</text></g>;})}
      {allPts}
    </svg>;
  };

  return <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
    <div style={{position: 'absolute', left: CARD.x0, top: MAIN.y0, width: CARD.w, height: MAIN.h, boxSizing: 'border-box', borderRadius: 40, background: th.card, boxShadow: th.shadow, padding: 34, display: 'flex', flexDirection: 'column', opacity: Math.min(1, enter * 1.5), transform: `translateY(${(1 - enter) * 40}px) scale(${0.96 + 0.04 * enter})`}}>
      <header style={{fontSize: TYPE.title, lineHeight: 1.2, fontWeight: 600, color: th.cardSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex:'none'}}>{p.title}</header>
      <div style={{marginTop: 10, minHeight: 53, maxHeight:106, flex:'none', fontSize: TYPE.takeaway, lineHeight: 1.2, fontWeight: 800, color: th.cardText, overflow: 'hidden'}}>{p.takeaway}</div>
      {p.kpis?.length ? <div style={{display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, p.kpis.length)}, 1fr)`, gap: 10, marginTop: 12}}>{p.kpis.slice(0, 3).map((k, i) => <div key={i} style={{minWidth: 0, padding: '12px 14px', borderRadius: 16, background: th.cardAlt, opacity: Math.min(1, pop(t, 0.2 + i * 0.12, 14, 200) * 1.5)}}><div style={{fontFamily: FONT, fontSize: TYPE.kpi, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, fontWeight: 800, color: th.accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{k.value}</div><div style={{fontSize: TYPE.kpiLabel, marginTop: 5, color: th.cardSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{k.label}</div></div>)}</div> : null}
      <div style={{flex: 1, minHeight: 0, marginTop: 12, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        {labels.length > 1 && chartType !== 'donut' && chartType !== 'stacked' ? <div style={{display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 10}}>{labels.map((s) => <span key={s} style={{display: 'flex', alignItems: 'center', gap: 7, fontSize: TYPE.note, color: th.cardSub}}><i style={{width: 14, height: 14, borderRadius: 7, background: seriesColor(s)}} />{s}</span>)}</div> : null}
        {plot()}
      </div>
      {p.annotations?.length ? <div style={{display: 'flex', flexDirection: 'column', gap: 4, borderTop: `2px solid ${th.line}`, paddingTop: 8, marginTop: 6}}>{p.annotations.slice(0, 2).map((a, i) => <div key={i} style={{fontSize: TYPE.note, lineHeight: 1.2, color: th.cardSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>• {a}</div>)}</div> : null}
      {sources.length ? <footer style={{fontSize: TYPE.source, lineHeight: 1.2, color: th.cardMuted, marginTop: 7, maxHeight: 64, overflow: 'hidden', overflowWrap: 'anywhere', flex: 'none'}}>数据来源：{[...new Set(sources)].join('；')}</footer> : null}
    </div>
  </div>;
};

export default DataChart;

export const sfx = (_p: P, _ctx: {dur: number; beat: number}): SfxCue[] => [{at: 0.04, kind: 'pop', vol: 0.18}, {at: 0.55, kind: 'tick', vol: 0.14}, {at: 1.05, kind: 'tick', vol: 0.12}];
