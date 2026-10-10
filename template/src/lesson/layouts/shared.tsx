import React from 'react';
import {useCurrentFrame} from 'remotion';
import {lessonThemes, type LessonTheme, type LessonTokens} from '../theme';
import type {LessonPage} from '../types';
import {revealProgress} from '../../../../scripts/lesson/timeline.mjs';
import {CHAPTER_TOP, CONTENT, MARGIN_X, RESERVE, RESERVE_ROW_RIGHT, STAGE, TITLE_TOP, headerShift, nameBarMetrics, nameBarReserve, titleFontPx} from '../stage.mjs';
import {titleLines} from '../../../../scripts/lesson/title-wrap.mjs';
import {VERTICAL, emphasizedFontPx, headingsOverlap, hookEmphasisTransform, verticalContentBox} from '../../../../scripts/lesson/vertical-layout.mjs';
import {useCanvas, useOrientation} from '../canvas';
export {emWidth, protectBreaks, titleLines} from '../../../../scripts/lesson/title-wrap.mjs';
export {useCanvas, useOrientation} from '../canvas';

export type StageMode = 'standard' | 'wide' | 'tall' | 'side' | 'cover';
export type LayoutProps = {
  page: LessonPage;
  fields: Record<string, unknown>;
  theme: LessonTheme;
  lang: 'zh' | 'en';
  stage?: StageMode;
  domain?: string;
  chapterTitles?: string[];
};
export const pick = (lang: string, zh: string, en: string) => lang === 'en' ? en : zh;
export const textOf = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
export const listOf = (value: unknown): string[] => Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
export const colorsOf = (theme: LessonTheme): LessonTokens => {
  const base = lessonThemes[theme];
  const override = useCanvas().brandColors;
  if (!override) return base;
  return {...base, accent: override.accent || base.accent, ...(override.deco ? {deco: override.deco} : {})};
};
export const showFor = (page: LessonPage, reveal: number, frame: number, immediate = false, fallbackAtEnd = false) => {
  if (immediate) return Math.min(1, Math.max(.72, (frame + 3) / 12));
  return revealProgress(page, reveal, frame, fallbackAtEnd);
};
const ease = (progress: number) => 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;
export const enter = (progress: number): React.CSSProperties => ({opacity: ease(progress), transform: `translateY(${(1 - ease(progress)) * 16}px)`});
export type FocusRank = 'past' | 'current' | 'next';
export function focusRank(page: LessonPage, frame: number, index: number): FocusRank {
  const ms = frame * 1000 / 30;
  let current = -1;
  for (const sentence of page.sentences) {
    if (typeof sentence.reveal === 'number' && sentence.revealAtMs != null && ms >= sentence.revealAtMs) current = Math.max(current, sentence.reveal);
  }
  if (current < 0) return index === 0 ? 'current' : 'next';
  if (index < current) return 'past';
  if (index === current) return 'current';
  return 'next';
}
export const inkFor = (theme: LessonTheme, rank: FocusRank) => rank === 'past' ? colorsOf(theme).muted : colorsOf(theme).ink;

/** 这一页的右下角保留区。姓名条那一页按姓名条实际宽度，和讲解员合成一块；其他页只有讲解员那一角。 */
export function usePageReserve() {
  const canvas = useCanvas();
  const lawyer = canvas.brand?.lawyer;
  if (canvas.orientation === 'vertical' || !lawyer || canvas.pageIndex == null || canvas.pageIndex !== canvas.nameBarPage) return RESERVE;
  return nameBarReserve(nameBarMetrics({name: lawyer.name, title: lawyer.title, firmLine: lawyer.firmLine}));
}

/** 横版一块内容的可用宽度。底边越过保留区上沿时，右缘收到保留区左边。竖版不套这套数。 */
export function useBlockWidth(height: number, y = CONTENT.y) {
  const canvas = useCanvas();
  const reserve = usePageReserve();
  if (canvas.orientation === 'vertical') return CONTENT.right - CONTENT.x;
  if (y + height <= reserve.y) return CONTENT.right - CONTENT.x;
  const small = reserve.x === RESERVE.x && reserve.y === RESERVE.y;
  const edge = small ? RESERVE_ROW_RIGHT : reserve.x;
  return Math.max(0, edge - CONTENT.x);
}

export const ContentFrame: React.FC<{children: React.ReactNode; stage?: StageMode}> = ({children, stage = 'standard'}) => {
  const canvas = useCanvas();
  const reserve = usePageReserve();
  const box = canvas.orientation === 'vertical'
    ? verticalContentBox(canvas.pageLayout || stage, canvas.presenter, {
      sampleReview: canvas.sampleReview,
      topReserve: canvas.topReserve,
      showHook: canvas.showHook,
      hookBottom: canvas.hookBottom,
      frame: canvas.clipFrame,
      fps: canvas.fps,
      pageFrame: canvas.pageFrame,
      prevLayout: canvas.prevLayout,
      brandBug: canvas.brandBug === true,
    })
    : STAGE[stage];
  // 两行钩子加上片头标识之后，内容框矮于正文一行的高度。这时不画半截卡片，避免和讲解员叠在一起。
  if (canvas.orientation === 'vertical' && box.height < 340) return null;
  const cutX = Math.max(0, reserve.x - box.x);
  const cutY = Math.max(0, reserve.y - box.y);
  const clip = canvas.orientation === 'vertical' ? undefined : `polygon(0 0, 100% 0, 100% ${cutY}px, ${cutX}px ${cutY}px, ${cutX}px 100%, 0 100%)`;
  return <div style={{position:'absolute', left:box.x, top:box.y, width:box.width, height:box.height, display:'flex', alignItems:'stretch', justifyContent: canvas.orientation === 'vertical' ? 'center' : 'flex-start', boxSizing:'border-box', overflow:'hidden', clipPath:clip}}>{children}</div>;
};
export const PageBody: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => {
  const vertical = useOrientation() === 'vertical';
  return <div style={{width:'100%', maxHeight:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'stretch', justifyContent:'flex-start', boxSizing:'border-box', gap: vertical ? 16 : undefined, ...style}}>{children}</div>;
};
export const Reveal: React.FC<{page: LessonPage; index: number; frame: number; children: React.ReactNode; style?: React.CSSProperties; fallbackAtEnd?: boolean}> = ({page, index, frame, children, style, fallbackAtEnd = false}) => {
  const vertical = useOrientation() === 'vertical';
  const progress = !vertical && index === 0 ? 1 : showFor(page, index, frame, vertical && index === 0, fallbackAtEnd);
  return <div style={{...enter(progress), ...style}}>{children}</div>;
};
export const Card: React.FC<{children: React.ReactNode; theme: LessonTheme; style?: React.CSSProperties; shadow?: boolean}> = ({children, theme, style, shadow = true}) => {
  const t = colorsOf(theme);
  return <div style={{background:t.surface, border:t.cardBorder, borderRadius:t.radius, boxShadow:shadow && t.cardShadow !== 'none' ? t.cardShadow : undefined, boxSizing:'border-box', ...style}}>{children}</div>;
};
/** 竖版开头：这段字和钩子相同或互相包含时，放大到钩子字号并做轻微强调。 */
export function useHeadingEmphasis(text: string, basePx: number) {
  const canvas = useCanvas();
  const frame = canvas.clipFrame ?? 0;
  const active = canvas.orientation === 'vertical' && frame < VERTICAL.hookFrames && headingsOverlap(canvas.hookTitle ?? '', [text]);
  const fontPx = emphasizedFontPx(basePx, active);
  const motion = active ? hookEmphasisTransform(frame) : null;
  const style: React.CSSProperties = motion
    ? {fontSize: fontPx, transform: motion.transform, transformOrigin: 'center top'}
    : {fontSize: fontPx};
  return {active, fontPx, style};
}
export const TitleLines: React.FC<{text: string; forceTwo?: boolean; maxEm?: number; maxLines?: number; style?: React.CSSProperties}> = ({text, forceTwo, maxEm, maxLines, style}) => {
  const lines = titleLines(text, {forceTwo, maxEm, maxLines});
  return <div style={{wordBreak:'normal', ...style}}>{lines.map((line, index) => <div key={index}>{line}</div>)}</div>;
};
export const useFrame = () => useCurrentFrame();

/** 横版内容页的章节行和标题。封面、章节页和竖版不画。slot 把章节行和标题拆开，翻页时只有标题跟着动。 */
export const PageHeader: React.FC<{page: LessonPage; theme: LessonTheme; lang?: 'zh' | 'en'; slot?: 'all' | 'chapter' | 'title'}> = ({page, theme, lang = 'zh', slot = 'all'}) => {
  const vertical = useOrientation() === 'vertical';
  const canvas = useCanvas();
  const t = colorsOf(theme);
  const shift = headerShift(Boolean(canvas.brandBug));
  if (vertical || page.layout === 'cover' || page.layout === 'chapter' || page.layout === 'brandEnd') return null;
  if (canvas.brandRecapIndex != null && page.index === canvas.brandRecapIndex) return null;
  const quiz = page.layout === 'question';
  const quietTitle = page.layout === 'saying' || page.layout === 'bignumber';
  const titleText = quiz ? (textOf(page.fields?.question) || page.title) : page.title;
  const titleWidth = page.layout === 'statement' ? 780 : 1680;
  const px = titleFontPx(titleText, titleWidth);
  const n = String((page.chapterIndex ?? 0) + 1).padStart(2, '0');
  const showChapter = slot !== 'title';
  const showTitle = slot !== 'chapter' && !quietTitle;
  return <>
    {showChapter ? <div style={{position:'absolute', left:MARGIN_X, top:CHAPTER_TOP + shift, display:'flex', alignItems:'center', gap:18, fontSize:26, color:t.muted, letterSpacing:2, fontFamily:t.fontBody, zIndex:2}}>
      {quiz
        ? <span style={{display:'inline-flex', alignItems:'center', gap:8, color:t.surface, background:t.accent, padding:'4px 14px', borderRadius:t.badgeRadius, fontSize:30, fontWeight:700, letterSpacing:2}}>{pick(lang, '随堂小测', 'Quiz')}</span>
        : <b style={{color:t.accent, fontWeight:800, fontFamily:t.fontNumber, fontSize:30}}>{n}</b>}
      <i style={{width:56, height:2, background:t.deco, display:'block'}} />
      <span>{page.chapterTitle}</span>
    </div> : null}
    {showTitle ? <div style={{position:'absolute', left:MARGIN_X, top:TITLE_TOP + shift, width:titleWidth, fontFamily:t.fontHeading, fontWeight:800, fontSize:px, lineHeight:1.15, color:t.ink, zIndex:2}}>
      <TitleLines text={titleText} maxLines={3} maxEm={titleWidth / Math.max(1, px)} />
    </div> : null}
  </>;
};
