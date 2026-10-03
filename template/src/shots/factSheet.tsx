import React from 'react';
import {bump, pop} from '../core/anim';
import {fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon} from '../core/icons';
import {IconDisc, pick} from '../core/kit';
import type {Lang} from '../core/kit';
import {CARD, MAIN} from '../core/safe';
import {alpha, textOnHot, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// factSheet：把可核实的事实一屏写清，5 种 layout 共用一张卡 + 逐行点亮的时间线。
//   spec    表格线：key/value 两栏，逐行画出底线
//   box     开箱清单：2 列圆角方块，qty「×N」+ isGift「赠」角标像开箱一样逐个弹出
//   syllabus大纲：竖排章节点，右侧「N节」胶囊
//   exam    考试信息：同 spec 的表格，顶部加日历图标，底部 source 常驻（必填才允许渲染，由校验拦）
//   swatch  色卡：色块横排依次弹出，highlight 那颗带光圈闪烁；notice 常驻小字
// 主角：逐行点亮——一屏信息不是一次性摆满，而是被「一条条证实」出来，配合 pop/bump 的落定感。
// ============================================================
type Row = {key?: string; value?: string; qty?: number; isGift?: boolean; no?: string; name?: string; lessons?: number; hex?: string};
type Fact = {label?: string; value?: string};
type Layout = 'spec' | 'box' | 'syllabus' | 'exam' | 'swatch';
type P = {
  layout?: Layout;
  title?: string;
  rows?: Row[];
  facts?: Fact[];
  source?: string;
  notice?: string;
  image?: string;
  highlight?: number;
};

const PAD = 36;
const HEAD_H = 84;
const LAYOUT_ICON: Record<Layout, string> = {spec: 'doc', box: 'gift', syllabus: 'chart', exam: 'calendar', swatch: 'sparkle'};
const LAYOUTS: Layout[] = ['spec', 'box', 'syllabus', 'exam', 'swatch'];
const asLayout = (v?: string): Layout => (LAYOUTS as string[]).includes(v ?? '') ? (v as Layout) : 'spec';

// ---------- 时间线：每行依次点亮，之后是 facts 条 ----------
export const plan = (n: number, dur: number, beat: number) => {
  const avail = Math.max(0.6, dur - 1.3);
  const step = n > 1 ? Math.max(beat * 0.4, Math.min(beat * 1.2, avail / n)) : beat * 0.5;
  const at = Array.from({length: Math.max(1, n)}, (_, i) => i * step);
  const factsAt = at[at.length - 1] + step * 0.8;
  return {at, factsAt};
};

// ---------- spec / exam：key: value 表格行 ----------
const KVRow: React.FC<{r: Row; t: number; at: number; w: number}> = ({r, t, at, w}) => {
  const th = useTheme();
  if (t < at) return null;
  const q = pop(t, at, 14, 200);
  const keySize = fitLine(r.key ?? '', w * 0.4, 38, 32);
  const valSize = fitLine(r.value ?? '', w * 0.56, 40, 32);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '13px 4px',
        borderBottom: `2px solid ${th.line}`,
        opacity: Math.min(1, q * 1.7),
        transform: `translateX(${(1 - q) * 40}px)`,
      }}
    >
      <span style={{fontSize: keySize, fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap'}}>{r.key}</span>
      <span style={{fontSize: valSize, fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap'}}>{r.value}</span>
    </div>
  );
};

// ---------- box：开箱方块（2 列） ----------
const BoxTile: React.FC<{r: Row; t: number; at: number; w: number; lang?: Lang}> = ({r, t, at, w, lang}) => {
  const th = useTheme();
  if (t < at) return null;
  const q = pop(t, at, 11, 230);
  const hit = bump(t, at + 0.1, 0.4);
  const nameSize = fitLine(r.key ?? '', w - 40, 36, 30);
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        boxSizing: 'border-box',
        borderRadius: 26,
        background: th.cardAlt,
        padding: '18px 18px 16px',
        opacity: Math.min(1, q * 1.7),
        transform: `scale(${(0.82 + 0.18 * q) * (1 + hit * 0.06)})`,
      }}
    >
      {typeof r.qty === 'number' && <div style={{position: 'absolute', right: 14, top: 12, fontFamily: MONO, fontWeight: 800, fontSize: 28, color: th.accent}}>×{r.qty}</div>}
      {r.isGift && (
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: -12,
            padding: '3px 13px',
            borderRadius: 12,
            background: th.hot,
            color: textOnHot(th),
            fontWeight: 900,
            fontSize: 26,
            boxShadow: '0 6px 14px rgba(0,0,0,0.22)',
          }}
        >
          {pick(lang, '赠', 'Gift')}
        </div>
      )}
      <div style={{fontSize: nameSize, fontWeight: 800, color: th.cardText, marginTop: r.isGift ? 10 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{r.key}</div>
      {r.value && <div style={{fontSize: 30, color: th.cardSub, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{r.value}</div>}
    </div>
  );
};

// ---------- syllabus：章节行 + 圆点 ----------
const SyllabusRow: React.FC<{r: Row; t: number; at: number; w: number; lang?: Lang}> = ({r, t, at, w, lang}) => {
  const th = useTheme();
  if (t < at) return null;
  const q = pop(t, at, 13, 210);
  const name = r.name ?? r.key ?? '';
  const lessons = typeof r.lessons === 'number' ? r.lessons : undefined;
  const lessonsText = lessons === undefined ? '' : pick(lang, `${lessons}节`, `${lessons} ${lessons === 1 ? 'lesson' : 'lessons'}`);
  const nameSize = fitLine(name, w - (lang === 'en' ? 220 : 170), 38, 32);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '11px 0', opacity: Math.min(1, q * 1.7), transform: `translateX(${(1 - q) * 40}px)`}}>
      <div style={{width: 50, height: 50, borderRadius: 25, background: th.accent, color: th.accentText, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontWeight: 800, fontSize: 25}}>
        {r.no ?? ''}
      </div>
      <div style={{flex: 1, fontSize: nameSize, fontWeight: 800, color: th.cardText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{name}</div>
      {lessons !== undefined && (
        <div style={{flex: 'none', padding: '6px 18px', borderRadius: 20, background: th.accentSoft, color: th.accent, fontWeight: 800, fontSize: 28, whiteSpace: 'nowrap'}}>{lessonsText}</div>
      )}
    </div>
  );
};

// ---------- swatch：色块 ----------
const Swatch: React.FC<{r: Row; t: number; at: number; hi: boolean}> = ({r, t, at, hi}) => {
  const th = useTheme();
  if (t < at) return null;
  const q = pop(t, at, 11, 230);
  const pulse = hi ? 0.5 + 0.5 * Math.sin(t * 3) : 0;
  const D = 104;
  const hexRaw = r.hex ?? '';
  const hex = /^#?[0-9a-fA-F]{6}$/.test(hexRaw) ? (hexRaw.startsWith('#') ? hexRaw : `#${hexRaw}`) : th.cardAlt;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: Math.min(1, q * 1.7), transform: `scale(${0.7 + 0.3 * q}) rotate(${(1 - q) * -20}deg)`}}>
      <div style={{position: 'relative', width: D, height: D}}>
        {hi && <div style={{position: 'absolute', inset: -8, borderRadius: '50%', border: `4px solid ${th.hot}`, opacity: 0.5 + 0.5 * pulse, transform: `scale(${1 + pulse * 0.06})`}} />}
        <div style={{width: D, height: D, borderRadius: '50%', background: hex, boxShadow: `inset 0 0 0 3px ${alpha('#000000', 0.08)}, 0 8px 18px rgba(0,0,0,0.18)`}} />
        {hi && (
          <div style={{position: 'absolute', right: -6, top: -6, width: 32, height: 32, borderRadius: 16, background: th.hot, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Icon name="star" size={19} color={textOnHot(th)} stroke={2.4} />
          </div>
        )}
      </div>
      <div style={{fontSize: 28, fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap'}}>{r.key}</div>
    </div>
  );
};

const FactSheet: React.FC<ShotProps<P>> = ({params: p, t, dur, beat, meta}) => {
  const th = useTheme();
  const lang = meta?.lang;
  const layout = asLayout(p.layout);
  const rows = (p.rows ?? []).slice(0, 6);
  const n = Math.max(1, rows.length);
  const facts = (p.facts ?? []).slice(0, 4);
  const pl = plan(n, dur, beat);
  const enter = pop(t, 0, 15, 180);
  const bodyW = CARD.w - 2 * PAD;
  const titleSize = fitLine(p.title ?? '', bodyW - 96, 44, 34);
  const footerLine = layout === 'exam' ? p.source : layout === 'swatch' ? p.notice : undefined;
  const factsQ = facts.length ? pop(t, pl.factsAt, 13, 200) : 0;

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div
        style={{
          position: 'absolute',
          left: CARD.x0,
          top: MAIN.y0,
          width: CARD.w,
          height: MAIN.h,
          boxSizing: 'border-box',
          borderRadius: 40,
          background: th.card,
          boxShadow: th.shadow,
          padding: PAD,
          display: 'flex',
          flexDirection: 'column',
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 50}px) scale(${0.94 + 0.06 * enter})`,
        }}
      >
        {/* 头部 */}
        <div style={{height: HEAD_H, flex: 'none', display: 'flex', alignItems: 'center', gap: 18}}>
          <IconDisc name={LAYOUT_ICON[layout]} size={64} soft />
          <div style={{fontSize: titleSize, fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{p.title}</div>
        </div>

        {/* 主体：按 layout 切换 */}
        <div style={{flex: 1, minHeight: 0, marginTop: 6, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden'}}>
          {layout === 'box' ? (
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
              {rows.map((r, i) => (
                <BoxTile key={i} r={r} t={t} at={pl.at[i]} w={(bodyW - 16) / 2} lang={lang} />
              ))}
            </div>
          ) : layout === 'syllabus' ? (
            <div>
              {rows.map((r, i) => (
                <SyllabusRow key={i} r={r} t={t} at={pl.at[i]} w={bodyW} lang={lang} />
              ))}
            </div>
          ) : layout === 'swatch' ? (
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 26, justifyContent: 'center', alignContent: 'center'}}>
              {rows.map((r, i) => (
                <Swatch key={i} r={r} t={t} at={pl.at[i]} hi={p.highlight === i} />
              ))}
            </div>
          ) : (
            <div>
              {rows.map((r, i) => (
                <KVRow key={i} r={r} t={t} at={pl.at[i]} w={bodyW} />
              ))}
            </div>
          )}
        </div>

        {/* facts 条 */}
        {facts.length > 0 && (
          <div style={{flex: 'none', display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, opacity: Math.min(1, factsQ * 1.7), transform: `translateY(${(1 - factsQ) * 24}px)`}}>
            {facts.map((f, i) => (
              <div key={i} style={{display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 16px', borderRadius: 18, background: th.accentSoft}}>
                <span style={{fontSize: 26, color: th.cardMuted}}>{f.label}</span>
                <span style={{fontSize: 30, fontWeight: 800, color: th.accent, whiteSpace: 'nowrap'}}>{f.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* 底部常驻小字：exam 的 source（必填） / swatch 的 notice */}
        {footerLine && (
          <div style={{flex: 'none', marginTop: 12, fontSize: 26, color: th.cardMuted, display: 'flex', alignItems: 'center', gap: 8, opacity: Math.min(1, enter * 1.6)}}>
            {layout === 'exam' && <Icon name="calendar" size={26} color={th.cardMuted} stroke={2.2} />}
            {footerLine}
          </div>
        )}
      </div>
    </div>
  );
};

export default FactSheet;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const rows = (p.rows ?? []).slice(0, 6);
  const n = Math.max(1, rows.length);
  const layout = asLayout(p.layout);
  const pl = plan(n, ctx.dur, ctx.beat);
  const out: SfxCue[] = [{at: 0.03, kind: 'pop', vol: 0.2}];
  pl.at.forEach((at) => out.push({at, kind: layout === 'box' || layout === 'swatch' ? 'tap' : 'tick', vol: 0.16}));
  if ((p.facts ?? []).length) out.push({at: pl.factsAt, kind: 'pop', vol: 0.18});
  return out;
};
