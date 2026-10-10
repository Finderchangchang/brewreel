import React from 'react';
import {KAI} from '../../core/font';
import {Icon} from '../icons';
import {TYPE} from '../stage.mjs';
import type {LessonTheme} from '../theme';
import type {LessonPage} from '../types';
import {Card, Reveal, colorsOf, pick, protectBreaks, showFor, textOf, useOrientation} from './shared';

export {Icon};

export const TONES = ['ok', 'alert', 'neutral'] as const;
export type Tone = (typeof TONES)[number];
export const toneOf = (theme: LessonTheme, tone: string) => {
  const t = colorsOf(theme);
  if (tone === 'ok') return t.ok;
  if (tone === 'alert') return t.alert;
  return t.muted;
};

export function emphasized(text: string, emphasis: string, style: React.CSSProperties) {
  const at = emphasis ? text.indexOf(emphasis) : -1;
  if (at < 0) return protectBreaks(text);
  return <>
    {protectBreaks(text.slice(0, at))}
    <span style={style}>{protectBreaks(emphasis)}</span>
    {protectBreaks(text.slice(at + emphasis.length))}
  </>;
}

export function markedQuote(quote: string, emphasis: string, hl: string) {
  const at = emphasis ? quote.indexOf(emphasis) : -1;
  if (at < 0) return protectBreaks(quote);
  return <>
    {protectBreaks(quote.slice(0, at))}
    <span style={{backgroundImage: `linear-gradient(transparent 55%, ${hl} 55%)`, padding: '0 4px', boxDecorationBreak: 'clone'}}>{protectBreaks(emphasis)}</span>
    {protectBreaks(quote.slice(at + emphasis.length))}
  </>;
}

export const LawCard: React.FC<{
  page: LessonPage;
  frame: number;
  theme: LessonTheme;
  quote: string;
  source: string;
  emphasis: string;
  tag?: string;
  tagText?: string;
  quoteIndex?: number;
  sourceIndex?: number;
  tagIndex?: number;
  bundleIndex?: number;
  compact?: boolean;
  quoteSize?: number;
  lang?: string;
}> = ({page, frame, theme, quote, source, emphasis, tag = '', tagText = '', quoteIndex = 0, sourceIndex = 1, tagIndex = 2, bundleIndex, compact = false, quoteSize, lang = 'zh'}) => {
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const fitted = quoteSize ?? (compact ? (vert ? 32 : TYPE.timelineQuote) : (vert ? 40 : TYPE.quote));
  const sourcePx = vert || compact ? 26 : TYPE.quoteSource;
  const tagPx = vert || compact ? 32 : TYPE.quoteTag;
  // 时间轴卡片共用一个 reveal，没出现时仍占位。法条页里还没讲到的出处和底栏不渲染，避免在原文下面空出一块。
  const piece = (index: number, node: React.ReactNode) => {
    if (bundleIndex != null) return <Reveal page={page} index={bundleIndex} frame={frame} fallbackAtEnd>{node}</Reveal>;
    if (index !== 0 && showFor(page, index, frame, false, false) <= 0) return null;
    return <Reveal page={page} index={index} frame={frame}>{node}</Reveal>;
  };
  const body = <>
    {piece(sourceIndex, <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: compact ? 12 : 18, fontFamily: t.fontBody, fontSize: sourcePx, fontWeight: 700, color: t.accent, letterSpacing: 1}}>
      <span style={{width: 40, height: 40, borderRadius: Math.min(6, Number(t.badgeRadius) || 6), background: t.accent, color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.fontHeading, fontSize: 22, flex: '0 0 auto'}}>{pick(lang, '法', 'Law')}</span>
      <span style={{wordBreak: 'normal'}}>{protectBreaks(source)}</span>
    </div>)}
    {piece(quoteIndex, <div style={{fontFamily: t.fontHeading, fontWeight: t.headingWeight, fontSize: fitted, lineHeight: vert ? 1.45 : 1.55, color: t.ink, wordBreak: 'normal'}}>
      {markedQuote(quote, emphasis, t.hl)}
    </div>)}
    {tag || tagText ? piece(tagIndex, <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: compact ? 16 : 28, fontFamily: t.fontHeading, fontWeight: 800, fontSize: tagPx, color: t.alert, wordBreak: 'normal'}}>
      {tag ? <em style={{fontStyle: 'normal', fontSize: 28, color: '#FFFFFF', background: t.alert, padding: '4px 14px', borderRadius: t.badgeRadius}}>{protectBreaks(tag)}</em> : null}
      {tagText ? <span>{protectBreaks(tagText)}</span> : null}
    </div>) : null}
  </>;
  return <Card theme={theme} style={{width: '100%', height: 'auto', boxSizing: 'border-box', padding: compact ? (vert ? '20px 24px' : '24px 36px') : (vert ? '28px 28px' : '44px 56px'), borderLeft: `10px solid ${t.accent}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
    {body}
  </Card>;
};

const PROP_KINDS = new Set(['iou', 'contract', 'notice']);
export const isPropKind = (value: string) => PROP_KINDS.has(value);

export const PropPaper: React.FC<{
  theme: LessonTheme;
  kind: string;
  title: string;
  lines: string[];
  circle: number;
  annotation: string;
  lineH?: number;
}> = ({theme, kind, title, lines, circle, annotation, lineH}) => {
  const t = colorsOf(theme);
  const vert = useOrientation() === 'vertical';
  const rowH = lineH ?? (vert ? 44 : 70);
  const font = vert ? 28 : TYPE.propLine;
  const titleSize = vert ? 40 : TYPE.propTitle;
  const noteSize = vert ? 26 : 32;
  const circled = circle >= 1 && circle <= lines.length ? circle - 1 : -1;
  return <div style={{width: '100%', height: 'auto'}}>
    <div style={{
      position: 'relative',
      width: '100%',
      boxSizing: 'border-box',
      padding: vert ? '14px 22px 12px' : '36px 42px 36px',
      background: t.surface,
      color: t.ink,
      border: t.cardBorder,
      borderRadius: t.radius,
      boxShadow: t.cardShadow !== 'none' ? t.cardShadow : undefined,
      transform: 'rotate(-3deg)',
      transformOrigin: 'center top',
      fontFamily: KAI,
    }}>
      <div style={{fontSize: titleSize, textAlign: kind === 'notice' ? 'left' : 'center', letterSpacing: kind === 'iou' ? 12 : 4, lineHeight: 1.2, marginBottom: 12, color: kind === 'notice' ? t.alert : t.ink}}>
        {protectBreaks(title)}
      </div>
      {lines.map((line, index) => {
        const blank = /[:：]\s*$/u.test(line);
        const marked = index === circled;
        return <React.Fragment key={index}>
          <div style={{position: 'relative', fontSize: font, lineHeight: `${rowH}px`, minHeight: rowH, whiteSpace: 'nowrap', borderBottom: `2px solid ${t.line}`}}>
            {kind === 'contract' ? <span style={{color: t.muted}}>{index + 1}. </span> : null}
            {protectBreaks(line)}
            {blank ? <span style={{display: 'inline-block', width: vert ? 120 : 180, borderBottom: `3px solid ${t.ink}`, height: 28, verticalAlign: -4, marginLeft: 8}} /> : null}
            {marked ? <svg style={{position: 'absolute', left: -12, top: -4, width: '108%', height: rowH + 8, overflow: 'visible', pointerEvents: 'none'}} viewBox="0 0 340 80" preserveAspectRatio="none" fill="none" stroke={t.alert} strokeWidth={4} strokeLinecap="round">
              <path d="M24 46 C 36 12, 260 6, 310 32 C 336 52, 270 74, 160 72 C 70 70, 8 62, 28 34" />
            </svg> : null}
          </div>
          {marked && annotation ? <div style={{fontFamily: KAI, fontSize: noteSize, lineHeight: 1.3, color: t.alert, padding: vert ? '2px 0 2px' : '6px 0 8px', whiteSpace: 'normal'}}>{protectBreaks(annotation)}</div> : null}
        </React.Fragment>;
      })}
    </div>
  </div>;
};

export const SpeakingBadge: React.FC<{theme: LessonTheme; lang?: string; hang?: boolean}> = ({theme, lang = 'zh', hang = false}) => {
  const t = colorsOf(theme);
  return <span style={{position: 'absolute', left: hang ? 24 : 28, bottom: hang ? -22 : 16, zIndex: 2, fontSize: hang ? 22 : 30, lineHeight: 1, color: '#FFFFFF', background: t.accent, padding: hang ? '4px 10px' : '4px 12px', borderRadius: t.badgeRadius, fontFamily: t.fontBody, fontWeight: 700}}>{pick(lang, '正在讲', 'Now')}</span>;
};

export function pointItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {icon: textOf(row.icon), title: textOf(row.title), text: textOf(row.text)};
  });
}

export function flowCards(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return item.trim() ? [{title: item, icon: '', points: [] as string[]}] : [];
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const title = textOf(row.title);
    if (!title.trim()) return [];
    const points = Array.isArray(row.points) ? row.points.filter((x): x is string => typeof x === 'string') : [];
    return [{title, icon: textOf(row.icon), points}];
  });
}

export function timelineNodes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return textOf(row.label);
  });
}

export function timelineSegments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const tone = textOf(row.tone);
    return {label: textOf(row.label), tone: tone === 'alert' ? 'alert' : 'accent'};
  });
}

export function timelineCaptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {icon: textOf(row.icon), text: textOf(row.text)};
  });
}

export const Arrow: React.FC<{theme: LessonTheme; on: boolean; down?: boolean}> = ({theme, on, down = false}) => {
  const t = colorsOf(theme);
  const color = on ? t.accent : t.muted;
  return <svg width={down ? 30 : 40} height={down ? 28 : 22} viewBox={down ? '0 0 30 36' : '0 0 52 30'} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{flex: '0 0 auto', opacity: on ? 1 : 0.45}}>
    {down
      ? <><line x1="15" y1="4" x2="15" y2="28" strokeDasharray={on ? undefined : '6 7'} /><path d="M6 20 l9 10 l9 -10" /></>
      : <><line x1="4" y1="15" x2="46" y2="15" strokeDasharray={on ? undefined : '6 7'} /><path d="M34 4 l12 11 l-12 11" /></>}
  </svg>;
};
