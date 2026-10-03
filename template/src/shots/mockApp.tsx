import React from 'react';
import {interpolate} from 'remotion';
import {bump, clamp, easeOut, fitTimeline, pop} from '../core/anim';
import {emWidth, fitLine} from '../core/fit';
import {FONT} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {IconDisc, Sweep, TapRipple, pick} from '../core/kit';
import type {Lang} from '../core/kit';
import {CARD, SAFE} from '../core/safe';
import {alpha, toneColor, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// mockApp：没有截图时的模拟产品界面（x 150–930，y 560–1340），中性配色，全部由 params 驱动。
//   dashboard 大数字滚动 + 折线/柱状图生长 + 指标行逐拍出现 + 点中高亮行
//   list      （可选）搜索框打字 → 列表逐行出现（带状态标签）→ 点中高亮行，标签变「完成」态
//   editor    （可选）提示框打字 → 点「生成」→ 文档逐行逐字写出 → 高亮一行 → 完成提示
//   form      表单逐项填写（打字 + 勾）→ 点提交 → 按钮变成功态
// 时间线落整拍；内容多、时长短时整体按比例压缩（fitTimeline）。
// ============================================================
type Tone = 'good' | 'warn' | 'bad' | 'neutral';
type Item = {icon?: string; text: string; value?: string; tone?: Tone};
type Kind = 'dashboard' | 'list' | 'editor' | 'form';
type P = {
  kind: Kind;
  title: string;
  items?: Item[];
  highlight?: number;
  stat?: {value: string; label: string; live?: string};
  series?: number[];
  chart?: 'line' | 'bar';
  input?: string;
  button?: string;
  done?: string;
};

const X = CARD.x0;
const W = CARD.w;
const HEADER = 92;
const PADX = 30;
const IN_W = W - 2 * PADX; // 720
const KIND_ICON: Record<Kind, string> = {dashboard: 'chart', list: 'doc', editor: 'sparkle', form: 'check'};
const hexOr = (c: string, d: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : d);

const kindOf = (p: P): Kind => (['dashboard', 'list', 'editor', 'form'].includes(p.kind) ? p.kind : 'list');
// dashboard 的主体高度固定（卡片用满主体区）：提问框 + 大数字 + 图表（至少 CHART_MIN）之后剩下的高度能放几行就放几行，保证最后一行完整落在卡片里
const DASH_BODY = 780 - 92 - 28 - 30; // SAFE.h - HEADER - PAD_T - PAD_B
const CHART_MIN = 140;
export const dashRowsMax = (p: {input?: string; stat?: unknown}) => Math.max(0, Math.min(3, Math.floor((DASH_BODY - (p.input ? 80 + 18 : 0) - (p.stat ? 150 : 0) - CHART_MIN - 10) / (84 + 10))));
const items = (p: P) => (Array.isArray(p.items) ? p.items : []).filter((x) => x && typeof x.text === 'string').slice(0, kindOf(p) === 'dashboard' ? dashRowsMax(p) : 5);
const hl = (p: P) => (typeof p.highlight === 'number' && p.highlight >= 0 && p.highlight < items(p).length ? p.highlight : -1);
const chars = (s?: string) => Array.from(s ?? '');
const snap = (v: number, beat: number) => Math.ceil(v / beat - 1e-6) * beat;

// ---------- 时间线（所有时刻为镜头内秒） ----------
export const plan = (p: P, dur: number, beat: number) => {
  const kind = kindOf(p);
  const rows = items(p);
  const h = hl(p);
  const input = chars(p.input);
  const charSec = kind === 'editor' ? 0.06 : 0.08;
  const lineChar = 0.05;
  let typeFrom = -1;
  let rowAt: number[] = [];
  let tapAt = -1;
  let doneAt = -1;
  let lineFrom: number[] = [];
  let hlAt = -1;
  let end = beat * 2;
  let ansAt = 0;
  if (kind === 'dashboard') {
    // 有 input：先在提问框里打出问题，再出数（「问一句 → 出结果」）
    if (input.length) {
      typeFrom = 0.2;
      ansAt = snap(typeFrom + input.length * charSec + 0.15, beat);
    }
    rowAt = rows.map((_, i) => ansAt + beat * (1 + i));
    end = rows.length ? rowAt[rows.length - 1] + beat : ansAt + beat * 3;
    if (h >= 0) {
      tapAt = rowAt[rows.length - 1] + beat * 2;
      end = tapAt + 0.6;
    }
  } else if (kind === 'list') {
    let from = 0.15;
    if (input.length) {
      typeFrom = 0.2;
      from = snap(typeFrom + input.length * charSec + 0.1, beat);
    }
    rowAt = rows.map((_, i) => from + i * beat * 0.5);
    end = rows.length ? rowAt[rows.length - 1] + beat : from + beat;
    if (h >= 0) {
      tapAt = snap(end + beat * 0.5, beat);
      end = tapAt + 0.7;
    }
  } else if (kind === 'editor') {
    let from = 0.3;
    if (input.length) {
      typeFrom = 0.2;
      tapAt = snap(typeFrom + input.length * charSec + 0.15, beat);
      from = tapAt + beat * 0.5;
    }
    // 第 1 行（文档标题）第 0 帧就完整显示（-1 = 不打字直接出），其余行生成时逐字写出
    let cur = from;
    lineFrom = rows.map((r, i) => {
      if (i === 0) return -1;
      const at = cur;
      cur += chars(r.text).length * lineChar + 0.12;
      return at;
    });
    end = cur;
    if (h >= 0 || p.done) {
      hlAt = snap(cur + 0.1, beat);
      doneAt = hlAt;
      end = hlAt + 0.8;
    }
  } else {
    rowAt = rows.map((_, i) => 0.3 + i * beat);
    const last = rows.length ? rowAt[rows.length - 1] + 0.4 : 0.3;
    tapAt = snap(last + 0.2, beat);
    doneAt = tapAt + 0.3;
    end = doneAt + 0.7;
  }
  const k = fitTimeline(end, dur, 0.4);
  const s = (v: number) => (v < 0 ? v : v * k);
  return {k, kind, rows, h, ansAt: s(ansAt), typeFrom: s(typeFrom), charSec: charSec * k, rowAt: rowAt.map(s), tapAt: s(tapAt), doneAt: s(doneAt), lineFrom: lineFrom.map(s), lineChar: lineChar * k, hlAt: s(hlAt)};
};
type Plan = ReturnType<typeof plan>;

const typed = (text: string, t: number, t0: number, cs: number) => {
  const a = chars(text);
  if (t0 < 0) return text;
  if (t < t0) return '';
  return a.slice(0, Math.min(a.length, Math.floor((t - t0) / cs) + 1)).join('');
};

const Caret: React.FC<{t: number; size: number; on?: boolean}> = ({t, size, on = true}) => {
  const th = useTheme();
  return on ? <span style={{display: 'inline-block', width: 4, height: size * 1.05, marginLeft: 4, verticalAlign: 'middle', background: th.accentFill, opacity: Math.floor(t * 2.5) % 2 === 0 ? 1 : 0}} /> : null;
};

// ---------- 数字滚动（从字符串里取出数字部分滚动，前后缀保留） ----------
const rollText = (v: string, p: number) => {
  const m = /^([^\d]*)(\d[\d,]*\.?\d*)(.*)$/.exec(v);
  if (!m) return v;
  const num = parseFloat(m[2].replace(/,/g, ''));
  const dec = (m[2].split('.')[1] ?? '').length;
  const cur = num * p;
  let s = cur.toFixed(dec);
  if (m[2].includes(',')) s = Number(s).toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
  return m[1] + s + m[3];
};

// ---------- 图表 ----------
const DEF_SERIES = [3, 4.2, 3.6, 5.1, 4.7, 6.3, 7.8];
const Chart: React.FC<{p: P; t: number; w: number; h: number}> = ({p, t, w, h}) => {
  const th = useTheme();
  const raw = (Array.isArray(p.series) ? p.series : []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const ser = raw.length >= 2 ? raw.slice(0, 12) : DEF_SERIES;
  const mn = Math.min(...ser);
  const hi = Math.max(...ser);
  const lo = p.chart === 'bar' ? Math.min(0, mn) : mn - (hi - mn || 1) * 0.35; // 折线留出起伏感，柱状从 0 起
  const pad = 14;
  const base = h - pad - 8;
  const yOf = (v: number) => pad + (base - pad) * (1 - (v - lo) / (hi - lo || 1));
  const n = ser.length;
  const grid = [0, 0.33, 0.66, 1].map((g) => pad + (base - pad) * g);
  const gridEls = grid.map((y, i) => <line key={i} x1={0} x2={w} y1={y} y2={y} stroke={th.line} strokeWidth={2} strokeDasharray={i === 3 ? undefined : '6 8'} />);
  if (p.chart === 'bar') {
    const step = (w - 20) / n;
    const bw = Math.min(64, step * 0.6);
    return (
      <svg width={w} height={h} style={{display: 'block'}}>
        {gridEls}
        {ser.map((v, i) => {
          const g = pop(t, 0.3 + i * 0.1, 14, 150);
          const bh = (base - yOf(v)) * g;
          return <rect key={i} x={10 + step * i + (step - bw) / 2} y={base - bh} width={bw} height={Math.max(0, bh)} rx={10} fill={i === n - 1 ? th.accentFill : alpha(th.accentFill, 0.35)} />;
        })}
      </svg>
    );
  }
  const draw = easeOut(t, 0.3, 1.3);
  const xs = ser.map((_, i) => 12 + ((w - 40) * i) / (n - 1));
  const pts = ser.map((v, i) => [xs[i], yOf(v)] as [number, number]);
  const pos = draw * (n - 1);
  const full = Math.floor(pos);
  const frac = pos - full;
  const vis = pts.slice(0, full + 1);
  if (full < n - 1) {
    const a = pts[full];
    const b = pts[full + 1];
    vis.push([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]);
  }
  const d = vis.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
  const area = vis.length > 1 ? `${d} L${vis[vis.length - 1][0].toFixed(1)},${base} L${vis[0][0].toFixed(1)},${base} Z` : '';
  const tip = vis[vis.length - 1];
  const pulse = (t % 1.2) / 1.2;
  const gid = `mg-${th.name}`;
  return (
    <svg width={w} height={h} style={{display: 'block', overflow: 'visible'}}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={th.accentFill} stopOpacity={0.32} />
          <stop offset="100%" stopColor={th.accentFill} stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridEls}
      {area && <path d={area} fill={`url(#${gid})`} />}
      {vis.length > 1 && <path d={d} fill="none" stroke={th.accentFill} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />}
      {draw > 0 && (
        <>
          <circle cx={tip[0]} cy={tip[1]} r={14 + pulse * 18} fill="none" stroke={th.accentFill} strokeWidth={3} opacity={1 - pulse} />
          <circle cx={tip[0]} cy={tip[1]} r={11} fill={th.card} stroke={th.accentFill} strokeWidth={6} />
        </>
      )}
    </svg>
  );
};

// ---------- 行出现前的骨架占位（像真 App 加载中，避免大片空白） ----------
// 骨架只在行出现前 SKELETON_MAX 秒内显示（灰块信息量为零，停久了像卡住）；更早只占位不画
const SKELETON_MAX = 0.3;
const Skeleton: React.FC<{h: number; on?: boolean}> = ({h, on = true}) => {
  const th = useTheme();
  if (!on) return <div style={{height: h}} />;
  return (
    <div style={{height: h, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 20, padding: '0 20px', borderRadius: 22, background: th.cardAlt, opacity: 0.6}}>
      <div style={{width: 64, height: 64, borderRadius: 32, background: th.line}} />
      <div style={{flex: 1}}>
        <div style={{width: '55%', height: 20, borderRadius: 10, background: th.line}} />
      </div>
      <div style={{width: 90, height: 20, borderRadius: 10, background: th.line}} />
    </div>
  );
};

// ---------- 通用行（dashboard 指标 / list 条目） ----------
const Row: React.FC<{it: Item; t: number; at: number; hot: boolean; hotAt: number; h: number; kind: Kind}> = ({it, t, at, hot, hotAt, h, kind}) => {
  const th = useTheme();
  const q = pop(t, at, 14, 200);
  const on = hot && hotAt >= 0 && t >= hotAt;
  const sel = on ? easeOut(t, hotAt, 0.25) : 0;
  const b = on ? bump(t, hotAt + 0.05, 0.4) : 0;
  const tone = toneColor(th, it.tone ?? (kind === 'dashboard' ? 'neutral' : 'accent'));
  const icon = isIcon(it.icon) ? it.icon : kind === 'dashboard' ? 'trend' : 'doc';
  const dash = kind === 'dashboard';
  const valueSize = dash ? 42 : 30;
  const valW = it.value ? Math.min(260, (dash ? valueSize * 0.62 : 30) * chars(it.value).length + (dash ? 10 : 60)) : 0;
  const textSize = fitLine(it.text, IN_W - 40 - 64 - 40 - valW, dash ? 38 : 40, 34);
  const discTone = it.tone === 'good' || it.tone === 'warn' || it.tone === 'bad' ? it.tone : 'accent';
  return (
    <div
      style={{
        height: h,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '0 20px',
        borderRadius: 22,
        background: sel > 0 ? th.accentSoft : th.cardAlt,
        boxShadow: sel > 0 ? `inset 0 0 0 ${3 * sel}px ${th.accentFill}, 0 ${10 * sel}px ${24 * sel}px ${alpha(hexOr(th.accentFill, '#3B82F6'), 0.25 * sel)}` : undefined,
        opacity: Math.min(1, q * 1.6),
        transform: `translateY(${(1 - q) * 30}px) scale(${1 + b * 0.04})`,
      }}
    >
      <IconDisc name={icon} size={64} tone={discTone} soft />
      <div style={{flex: 1, fontSize: textSize, fontWeight: 700, color: th.cardText, whiteSpace: 'nowrap', overflow: 'hidden'}}>{it.text}</div>
      {it.value &&
        (dash ? (
          <div style={{fontSize: valueSize, fontWeight: 900, color: it.tone && it.tone !== 'neutral' ? tone : th.cardText, whiteSpace: 'nowrap', transform: `scale(${1 + b * 0.2})`}}>{it.value}</div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 52,
              padding: '0 20px',
              borderRadius: 26,
              fontSize: 30,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              color: on ? '#ffffff' : tone,
              background: on ? tone : alpha(hexOr(tone, '#888888'), th.dark ? 0.2 : 0.12),
              transform: `scale(${1 + b * 0.25})`,
            }}
          >
            {it.value}
          </div>
        ))}
    </div>
  );
};

// 出数前（先打字提问，还没到 ansAt）：数字和图表区域别空着，画三个跳动的点，像「正在算」，别让观众盯着一片空白
const Thinking: React.FC<{h: number; t: number}> = ({h, t}) => {
  const th = useTheme();
  return (
    <div style={{height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18}}>
      {[0, 1, 2].map((i) => {
        const ph = (((t * 1.6 - i * 0.22) % 1) + 1) % 1;
        const s = Math.max(0, Math.sin(Math.PI * Math.min(1, ph * 1.5)));
        return <div key={i} style={{width: 22, height: 22, borderRadius: 11, background: th.accentFill, opacity: 0.35 + 0.65 * s, transform: `translateY(${-s * 16}px)`}} />;
      })}
    </div>
  );
};

// ---------- dashboard ----------
const DASH_ROW = 84;
const Dashboard: React.FC<{p: P; pl: Plan; t: number; bodyH: number; lang?: Lang}> = ({p, pl, t: t0, bodyH, lang}) => {
  const th = useTheme();
  const rows = pl.rows;
  const rowsH = rows.length ? rows.length * (DASH_ROW + 10) + 6 : 0;
  const askH = p.input ? SEARCH_H + 18 : 0;
  const statH = p.stat ? 150 : 0;
  const chartH = Math.max(CHART_MIN, bodyH - askH - statH - rowsH - 4);
  const ask = typed(p.input ?? '', t0, pl.typeFrom, pl.charSec);
  // 出数前的时间轴整体后移 ansAt（没有 input 时 ansAt = 0，和原来一样）
  const t = t0 - pl.ansAt;
  const roll = easeOut(t, 0.15, 1.0);
  const settle = bump(t, 1.15, 0.4);
  const live = (t % 1.2) / 1.2;
  const thinking = !!p.input && t < 0;
  return (
    <div style={{display: 'flex', flexDirection: 'column'}}>
      {p.input && <SearchBar text={ask} t={t0} focus={t0 >= pl.typeFrom && t < 0.3} icon="sparkle" lang={lang} />}
      {thinking ? (
        <Thinking h={statH + chartH} t={t0} />
      ) : (
        <>
          {p.stat && (
            <div style={{height: statH, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 6, boxSizing: 'border-box'}}>
              <div>
                <div style={{fontSize: 34, fontWeight: 700, color: th.cardSub, lineHeight: 1.2}}>{p.stat.label}</div>
                <div style={{fontSize: fitLine(p.stat.value, 440, 104, 72), fontWeight: 900, color: th.cardText, lineHeight: 1.05, letterSpacing: -1, transformOrigin: '0% 80%', transform: `scale(${1 + settle * 0.08})`, opacity: p.input ? Math.min(1, Math.max(0, (t - 0.05) / 0.15)) : 1}}>
                  {rollText(p.stat.value, roll)}
                </div>
              </div>
              {/* live 是可选文案（如「实时」/"Live"），不写死中文：不给就不画这个角标，避免英文视频里冒出中文字，也避免无依据地宣称"实时" */}
              {p.stat.live && (
                <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, padding: '8px 18px', borderRadius: 24, background: alpha(hexOr(th.good, '#16A34A'), th.dark ? 0.2 : 0.12), color: th.good, fontSize: 28, fontWeight: 800}}>
                  <div style={{position: 'relative', width: 16, height: 16}}>
                    <div style={{position: 'absolute', inset: 0, borderRadius: 8, background: th.good}} />
                    <div style={{position: 'absolute', inset: 0, borderRadius: 8, border: `3px solid ${th.good}`, transform: `scale(${1 + live * 1.6})`, opacity: 1 - live}} />
                  </div>
                  {p.stat.live}
                </div>
              )}
            </div>
          )}
          <div style={{height: chartH}}>
            <Chart p={p} t={t} w={IN_W} h={chartH} />
          </div>
        </>
      )}
      {rows.length > 0 && (
        <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6}}>
          {rows.map((it, i) => (t0 >= pl.rowAt[i] ? <Row key={i} it={it} t={t0} at={pl.rowAt[i]} hot={i === pl.h} hotAt={pl.tapAt} h={DASH_ROW} kind="dashboard" /> : <Skeleton key={i} h={DASH_ROW} on={t0 >= pl.rowAt[i] - SKELETON_MAX} />))}
        </div>
      )}
    </div>
  );
};

// ---------- list ----------
const SEARCH_H = 80;
const listRowH = (n: number) => (n >= 5 ? 96 : 104);
const SearchBar: React.FC<{text: string; t: number; focus: boolean; icon?: string; lang?: Lang}> = ({text, t, focus, icon = 'search', lang}) => {
  const th = useTheme();
  return (
    <div style={{height: SEARCH_H, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', borderRadius: 40, background: th.cardAlt, border: `2px solid ${focus ? th.accentLine : th.line}`, marginBottom: 18}}>
      <Icon name={icon} size={40} color={icon === 'search' ? th.cardMuted : th.accentInk} stroke={2.4} />
      <div style={{fontSize: 38, color: th.cardText, whiteSpace: 'nowrap'}}>
        {text || <span style={{color: th.cardMuted}}>{icon === 'search' ? pick(lang, '搜索', 'Search') : pick(lang, '问一句…', 'Ask anything…')}</span>}
        <Caret t={t} size={38} on={focus} />
      </div>
    </div>
  );
};

const List: React.FC<{p: P; pl: Plan; t: number; lang?: Lang}> = ({p, pl, t, lang}) => {
  const rows = pl.rows;
  const text = typed(p.input ?? '', t, pl.typeFrom, pl.charSec);
  const focus = !!p.input && t >= pl.typeFrom && (pl.rowAt[0] === undefined || t < pl.rowAt[0] + 0.3);
  const rowH = listRowH(rows.length);
  return (
    <div>
      {p.input && <SearchBar text={text} t={t} focus={focus} lang={lang} />}
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        {rows.map((it, i) => (t >= pl.rowAt[i] ? <Row key={i} it={it} t={t} at={pl.rowAt[i]} hot={i === pl.h} hotAt={pl.tapAt} h={rowH} kind="list" /> : <Skeleton key={i} h={rowH} on={t >= pl.rowAt[i] - SKELETON_MAX} />))}
      </div>
    </div>
  );
};

// ---------- editor ----------
const PROMPT_H = 104;
const Editor: React.FC<{p: P; pl: Plan; t: number; bodyH: number; lang?: Lang}> = ({p, pl, t, bodyH, lang}) => {
  const th = useTheme();
  const rows = pl.rows;
  const prompt = typed(p.input ?? '', t, pl.typeFrom, pl.charSec);
  const btn = p.button || pick(lang, '生成', 'Generate');
  const press = pl.tapAt >= 0 ? bump(t, pl.tapAt, 0.3) : 0;
  const genFrom = rows.length > 1 ? pl.lineFrom[1] : Infinity;
  const generating = rows.length > 1 && t >= genFrom && (pl.hlAt < 0 || t < pl.hlAt);
  const lineSize = 46;
  const typing = rows.findIndex((r, i) => t >= pl.lineFrom[i] && typed(r.text, t, pl.lineFrom[i], pl.lineChar).length < chars(r.text).length);
  const cursorLine = t < genFrom ? -1 : typing >= 0 ? typing : rows.reduce((a, _, i) => (t >= pl.lineFrom[i] ? i : a), -1);
  return (
    <div style={{position: 'relative', height: bodyH, display: 'flex', flexDirection: 'column'}}>
      <div style={{height: 60, flex: 'none', display: 'flex', alignItems: 'center', gap: 26, borderBottom: `2px solid ${th.line}`, marginBottom: 20}}>
        {['doc', 'image', 'chart', 'code'].map((ic) => (
          <Icon key={ic} name={ic} size={36} color={th.cardMuted} stroke={2.2} />
        ))}
        <div style={{flex: 1}} />
        {generating && (
          <div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 800, color: th.accentInk}}>
            <Icon name="sparkle" size={30} color={th.accentInk} stroke={2.4} style={{transform: `rotate(${t * 180}deg)`}} />
            {pick(lang, '生成中', 'Generating')}
          </div>
        )}
      </div>
      <div style={{flex: 1, overflow: 'hidden'}}>

        {rows.map((r, i) => {
          if (t < pl.lineFrom[i]) return null;
          const s = typed(r.text, t, pl.lineFrom[i], pl.lineChar);
          const mark = i === pl.h && pl.hlAt >= 0 ? easeOut(t, pl.hlAt, 0.35) : 0;
          const first = i === 0;
          const size = first ? 52 : lineSize;
          return (
            <div key={i} style={{position: 'relative', fontSize: size, fontWeight: first ? 900 : 500, lineHeight: first ? 1.5 : 1.75, color: th.cardText, whiteSpace: 'nowrap', marginBottom: first ? 8 : 2}}>
              <span style={{position: 'relative', display: 'inline-block'}}>
                {mark > 0 && <span style={{position: 'absolute', left: -8, top: '20%', height: '66%', width: `calc(${mark * 100}% + 16px)`, background: alpha(hexOr(th.hot, '#FFE14D'), 0.6), borderRadius: 8}} />}
                <span style={{position: 'relative'}}>
                  {!first && <span style={{color: th.accentInk, fontWeight: 900, marginRight: 14}}>•</span>}
                  {s}
                  <Caret t={t} size={size} on={i === cursorLine && (pl.hlAt < 0 || t < pl.hlAt + 0.4)} />
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {p.input && (
        <div style={{height: PROMPT_H, flex: 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14, borderTop: `2px solid ${th.line}`, paddingTop: 14}}>
          <div style={{flex: 1, height: 80, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', borderRadius: 24, background: th.cardAlt, border: `2px solid ${pl.tapAt >= 0 && t < pl.tapAt ? th.accentLine : th.line}`, overflow: 'hidden'}}>
            <Icon name="sparkle" size={36} color={th.accentInk} stroke={2.4} />
            <div style={{fontSize: fitLine(p.input, 410, 36, 34), color: th.cardText, whiteSpace: 'nowrap'}}>
              {prompt}
              <Caret t={t} size={36} on={t >= pl.typeFrom && (pl.tapAt < 0 || t < pl.tapAt)} />
            </div>
          </div>
          <div style={{position: 'relative', overflow: 'hidden', height: 80, padding: '0 28px', borderRadius: 24, background: th.accentFill, color: th.accentText, fontSize: fitLine(btn, 170, 36, 34), fontWeight: 900, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', transform: `scale(${1 - press * 0.1})`}}>
            {btn}
            <Sweep p={interpolate(t, [0.2, 0.9], [0, 1], clamp)} w={200} />
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- form ----------
const FORM_BTN = 88;
const formPer = (bodyH: number, n: number) => Math.min(132, (bodyH - FORM_BTN - 24) / Math.max(1, n));
const Form: React.FC<{p: P; pl: Plan; t: number; bodyH: number; lang?: Lang}> = ({p, pl, t, bodyH, lang}) => {
  const th = useTheme();
  const rows = pl.rows;
  const per = formPer(bodyH, rows.length);
  const fieldH = Math.max(62, Math.min(76, per - 50));
  const labelH = per - fieldH - 8;
  const btn = p.button || pick(lang, '提交', 'Submit');
  const press = pl.tapAt >= 0 ? bump(t, pl.tapAt, 0.3) : 0;
  const ok = pl.doneAt >= 0 && t >= pl.doneAt;
  const okQ = pl.doneAt >= 0 ? pop(t, pl.doneAt, 12, 200) : 0;
  const good = hexOr(th.good, '#16A34A');
  const cs = (r: Item) => Math.min(0.08, 0.35 / Math.max(1, chars(r.value).length)) * pl.k;
  return (
    <div style={{height: bodyH, display: 'flex', flexDirection: 'column'}}>
      {rows.map((r, i) => {
        const at = pl.rowAt[i];
        const v = typed(r.value ?? '', t, at, cs(r));
        const fillAt = at + chars(r.value).length * cs(r) + 0.05;
        const filled = !!r.value && t >= fillAt;
        const focus = t >= at && !filled && !!r.value;
        const chk = filled ? pop(t, fillAt, 12, 220) : 0;
        return (
          <div key={i} style={{height: per, flex: 'none'}}>
            <div style={{height: labelH, fontSize: 30, fontWeight: 700, color: th.cardSub, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap'}}>{r.text}</div>
            <div
              style={{
                height: fieldH,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 22px',
                borderRadius: 18,
                background: th.cardAlt,
                border: `3px solid ${focus ? th.accentFill : filled ? alpha(good, 0.5) : th.line}`,
                boxShadow: focus ? `0 0 0 6px ${alpha(hexOr(th.accentFill, '#3B82F6'), 0.18)}` : undefined,
              }}
            >
              {isIcon(r.icon) && <Icon name={r.icon} size={34} color={th.cardMuted} stroke={2.2} />}
              <div style={{flex: 1, fontSize: fitLine(r.value ?? '', 520, 38, 34), color: th.cardText, whiteSpace: 'nowrap', overflow: 'hidden'}}>
                {v}
                <Caret t={t} size={36} on={focus} />
              </div>
              {chk > 0 && (
                <div style={{width: 44, height: 44, borderRadius: 22, background: th.good, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${chk})`}}>
                  <Icon name="check" size={28} color="#fff" stroke={3.2} />
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div style={{flex: 1, minHeight: 16}} />
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: FORM_BTN,
          flex: 'none',
          borderRadius: 44,
          background: ok ? th.good : th.accentFill,
          color: ok ? '#ffffff' : th.accentText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          fontSize: 40,
          fontWeight: 900,
          transform: `scale(${1 - press * 0.08})`,
          boxShadow: `0 12px 26px ${alpha(ok ? good : hexOr(th.accentFill, '#3B82F6'), 0.35)}`,
        }}
      >
        {ok && <Icon name="check" size={42} color="#fff" stroke={3.2} style={{transform: `scale(${okQ})`}} />}
        {ok ? p.done || pick(lang, '已提交', 'Submitted') : btn}
      </div>
    </div>
  );
};

// ---------- 卡片高度（list/form 按内容定并居中；dashboard/editor 用满） ----------
const PAD_T = 28;
const PAD_B = 30;
const cardHeight = (p: P) => {
  const kind = kindOf(p);
  const n = items(p).length;
  if (kind === 'list') return Math.min(SAFE.h, Math.max(480, HEADER + PAD_T + (p.input ? SEARCH_H + 18 : 0) + n * (listRowH(n) + 12) - 12 + PAD_B));
  if (kind === 'form') return Math.min(SAFE.h, Math.max(520, HEADER + PAD_T + n * 132 + 24 + FORM_BTN + PAD_B));
  return SAFE.h;
};

const MockApp: React.FC<ShotProps<P>> = ({params: p, t, dur, beat, meta}) => {
  const th = useTheme();
  const lang = meta?.lang;
  const pl = plan(p, dur, beat);
  const kind = pl.kind;
  const enter = pop(t, 0, 16, 170);
  const H = cardHeight(p);
  const Y = SAFE.y0 + Math.round((SAFE.h - H) / 2);
  const bodyH = H - HEADER - PAD_T - PAD_B;
  const title = p.title ?? '';
  // editor 的完成角标放顶栏右侧（替换「…」）；标题按剩余宽度缩字号，两者不相交
  const badge = kind === 'editor' && !!p.done;
  const badgeW = badge ? 22 * 2 + 32 + 10 + Math.ceil(emWidth(p.done ?? '') * 32) : 0;
  const doneQ = badge && pl.doneAt >= 0 ? pop(t, pl.doneAt, 12, 190) : 0;
  // 点击位置（dashboard/list 高亮行；editor 生成按钮；form 提交按钮）
  let tap: {x: number; y: number} | null = null;
  const bodyY = Y + HEADER + PAD_T;
  if (kind === 'dashboard' && pl.h >= 0 && pl.tapAt >= 0) {
    const rowsTop = bodyY + bodyH - pl.rows.length * (DASH_ROW + 10) + 10;
    tap = {x: X + W - 170, y: rowsTop + pl.h * (DASH_ROW + 10) + DASH_ROW / 2};
  } else if (kind === 'list' && pl.h >= 0 && pl.tapAt >= 0) {
    const rh = listRowH(pl.rows.length);
    tap = {x: X + W - 160, y: bodyY + (p.input ? SEARCH_H + 18 : 0) + pl.h * (rh + 12) + rh / 2};
  } else if (kind === 'editor' && pl.tapAt >= 0) tap = {x: X + W - PADX - 90, y: bodyY + bodyH - 40};
  else if (kind === 'form' && pl.tapAt >= 0) tap = {x: 540, y: bodyY + bodyH - FORM_BTN / 2};
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div
        style={{
          position: 'absolute',
          left: X,
          top: Y,
          width: W,
          height: H,
          borderRadius: 40,
          overflow: 'hidden',
          background: th.card,
          boxShadow: th.shadow,
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 60}px) scale(${0.94 + 0.06 * enter})`,
        }}
      >
        {/* 顶栏 */}
        <div style={{height: HEADER, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 18, padding: `0 ${PADX}px`, borderBottom: `2px solid ${th.line}`}}>
          <div style={{width: 56, height: 56, borderRadius: 16, background: th.accentFill, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}>
            <Icon name={KIND_ICON[kind]} size={34} color={th.accentText} stroke={2.4} />
          </div>
          <div style={{flex: 1, fontSize: fitLine(title, badge ? Math.min(440, 646 - 18 - badgeW) : 440, 42, 34), fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap', overflow: 'hidden'}}>{title}</div>
          {badge ? (
            doneQ > 0 ? (
              <div
                style={{
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 60,
                  boxSizing: 'border-box',
                  padding: '0 22px',
                  borderRadius: 30,
                  background: th.good,
                  color: '#fff',
                  fontSize: 32,
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                  boxShadow: `0 8px 20px ${alpha(hexOr(th.good, '#16A34A'), 0.35)}`,
                  transform: `scale(${doneQ})`,
                  transformOrigin: '100% 50%',
                }}
              >
                <Icon name="check" size={32} color="#fff" stroke={3} />
                {p.done}
              </div>
            ) : (
              <div style={{display: 'flex', gap: 8}}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{width: 10, height: 10, borderRadius: 5, background: th.cardMuted}} />
                ))}
              </div>
            )
          ) : (kind === 'dashboard' || kind === 'list') && p.button ? (
            <div style={{height: 56, padding: '0 22px', borderRadius: 28, background: th.accentSoft, color: th.accentInk, fontSize: 30, fontWeight: 800, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap'}}>{p.button}</div>
          ) : kind === 'dashboard' || kind === 'list' ? (
            <Icon name="bell" size={40} color={th.cardMuted} stroke={2.2} />
          ) : (
            <div style={{display: 'flex', gap: 8}}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{width: 10, height: 10, borderRadius: 5, background: th.cardMuted}} />
              ))}
            </div>
          )}
        </div>
        {/* 主体 */}
        <div style={{padding: `${PAD_T}px ${PADX}px ${PAD_B}px`}}>
          {kind === 'dashboard' ? (
            <Dashboard p={p} pl={pl} t={t} bodyH={bodyH} lang={lang} />
          ) : kind === 'list' ? (
            <List p={p} pl={pl} t={t} lang={lang} />
          ) : kind === 'editor' ? (
            <Editor p={p} pl={pl} t={t} bodyH={bodyH} lang={lang} />
          ) : (
            <Form p={p} pl={pl} t={t} bodyH={bodyH} lang={lang} />
          )}
        </div>
      </div>
      {tap && <TapRipple x={tap.x} y={tap.y} d={t - pl.tapAt} />}
    </div>
  );
};

export default MockApp;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur, ctx.beat);
  const out: SfxCue[] = [{at: 0.05, kind: 'whoosh', vol: 0.26}];
  if (pl.kind === 'dashboard') {
    out.push({at: pl.ansAt + 0.3, kind: 'swish', vol: 0.16});
    if (p.stat) out.push({at: pl.ansAt + 1.15, kind: 'ding', vol: 0.16});
  }
  if (pl.typeFrom >= 0) chars(p.input).forEach((_, i) => i % 2 === 0 && out.push({at: pl.typeFrom + i * pl.charSec, kind: 'tap', vol: 0.12}));
  pl.rowAt.forEach((at) => out.push({at, kind: pl.kind === 'form' ? 'tap' : 'pop', vol: 0.18}));
  pl.lineFrom.forEach((at) => out.push({at, kind: 'tick', vol: 0.12}));
  if (pl.tapAt >= 0) out.push({at: pl.tapAt, kind: 'tap', vol: 0.35});
  if (pl.doneAt >= 0 && (pl.kind === 'form' || p.done)) out.push({at: pl.doneAt, kind: 'ding', vol: 0.22});
  return out;
};
