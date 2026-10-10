import React from 'react';
import {pick} from '../../core/kit';
import {emWidth, fitHookLines, protectBreaks} from '../../../../scripts/lesson/title-wrap.mjs';
import {VERTICAL, verticalChromeBoxes} from '../../../../scripts/lesson/vertical-layout.mjs';
import {lessonThemes, type LessonTheme} from '../theme';
import {BrandBug} from '../brand/BrandChrome';

// 显式标识只留片头起始画面。常驻角标已取消。sampleReview 只由测试审稿记录打开。
export const LegalMarkings: React.FC<{
  domain?: string;
  lang?: 'zh' | 'en';
  frame: number;
  totalFrames: number;
  sampleReview?: boolean;
  trial?: boolean;
  theme?: LessonTheme;
  branded?: boolean;
}> = ({domain, lang, frame, totalFrames, sampleReview = false, trial = false, theme = 'lecture', branded = false}) => {
  const t = lessonThemes[theme] ?? lessonThemes.lecture;
  const legal = domain === 'legal';
  const endCardStart = Math.max(0, totalFrames - 4 * 30);
  const showEndCard = legal && !branded && frame >= endCardStart;
  const openingWindow = frame < 90;
  const showOpening = openingWindow && !branded;
  const bigLabel = pick(lang, 'AI生成合成', 'AI-generated synthetic');
  const disclaimer = pick(lang, '普法内容，不构成法律意见', 'Legal education only; not legal advice');
  const sampleLabel = pick(lang, '内部样片 · 未经律师审核', 'Internal sample · not reviewed by a lawyer');
  // 国标显式标识：实色 badge，不写 opacity，不许掺淡。四套主题的 badge 对比度由 test-stage 锁在 ≥ 4.5:1。
  const explicitMark = {background:t.badgeBg, color:t.badgeFg, fontFamily:t.fontBody, fontWeight:t.badgeWeight, fontSize:76, lineHeight:1, padding:'16px 24px', borderRadius:t.badgeRadius};
  return <>
    <div style={{position:'absolute', top:56, right:80, zIndex:40, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, pointerEvents:'none'}}>
      {showOpening ? <div aria-label={bigLabel} style={explicitMark}>{bigLabel}</div> : null}
      {sampleReview ? <div style={{padding:'8px 14px', borderRadius:t.badgeRadius, background:'rgba(140,72,0,.94)', color:'#fff', fontSize:22, fontWeight:700, letterSpacing:1}} aria-label={sampleLabel}>{sampleLabel}</div> : null}
    </div>
    {showEndCard ? <div style={{position:'absolute', left:0, right:0, top:790, zIndex:29, display:'flex', justifyContent:'center', pointerEvents:'none'}}>
      <div style={{padding:'13px 28px', borderRadius:t.badgeRadius, background:t.badgeBg, color:t.badgeFg, fontSize:28, fontWeight:700}}>{disclaimer}</div>
    </div> : null}
  </>;
};

/** 竖版片头标识、钩子和普法结尾。坐标都在安全区里，不走横版右上角。 */
export const VerticalChrome: React.FC<{
  domain?: string;
  lang?: 'zh' | 'en';
  frame: number;
  totalFrames: number;
  sampleReview?: boolean;
  trial?: boolean;
  theme?: LessonTheme;
  hookTitle?: string;
  legalTailFrames?: number;
  brandBug?: boolean;
}> = ({domain, lang, frame, totalFrames, sampleReview = false, trial = false, theme = 'lecture', hookTitle = '', legalTailFrames = 0, brandBug = false}) => {
  const t = lessonThemes[theme] ?? lessonThemes.lecture;
  const legal = domain === 'legal';
  const showOpening = frame < 90;
  const showLabelRow = showOpening;
  const showHook = Boolean(hookTitle) && frame < VERTICAL.hookFrames;
  const safeW = VERTICAL.safe.right - VERTICAL.safe.x;
  const hookLines = showHook ? fitHookLines(hookTitle, safeW / VERTICAL.hookFont) : [];
  const boxes = verticalChromeBoxes({sampleReview, showLabel: showLabelRow, showHook: hookLines.length > 0, hookLines: Math.max(1, hookLines.length), brandBug});
  const hookWide = Math.max(1, ...hookLines.map((line) => emWidth(line)));
  const hookSize = hookWide * VERTICAL.hookFont <= safeW + 1 ? VERTICAL.hookFont : Math.max(48, Math.floor(safeW / hookWide));
  const showTail = legal && legalTailFrames > 0 && frame >= totalFrames - legalTailFrames;
  const bigLabel = pick(lang, 'AI生成合成', 'AI-generated synthetic');
  const disclaimer = pick(lang, '普法内容，不构成法律意见', 'Legal education only; not legal advice');
  const sampleLabel = pick(lang, '内部样片 · 未经律师审核', 'Internal sample · not reviewed by a lawyer');
  const labelSize = lang === 'en' ? 40 : 76;
  return <>
    {boxes.brand ? <BrandBug theme={theme} box={boxes.brand} logo={48} /> : null}
    {sampleReview && boxes.sample ? <div style={{position:'absolute', left:boxes.sample.x, top:boxes.sample.y, width:boxes.sample.w, height:boxes.sample.h, zIndex:40, display:'flex', alignItems:'center', justifyContent:'flex-end', pointerEvents:'none'}}>
      <div aria-label={sampleLabel} style={{padding:'6px 12px', borderRadius:t.badgeRadius, background:'rgba(140,72,0,.94)', color:'#fff', fontFamily:t.fontBody, fontSize:22, fontWeight:700, letterSpacing:1}}>{sampleLabel}</div>
    </div> : null}
    {boxes.label ? <div style={{position:'absolute', left:boxes.label.x, top:boxes.label.y, width:boxes.label.w, height:boxes.label.h, zIndex:40, display:'flex', alignItems:'center', justifyContent:'space-between', pointerEvents:'none'}}>
      <div />
      {showOpening ? <div aria-label={bigLabel} style={{background:t.badgeBg, color:t.badgeFg, fontFamily:t.fontBody, fontWeight:t.badgeWeight, fontSize:labelSize, lineHeight:1, padding:lang === 'en' ? '10px 16px' : '16px 24px', borderRadius:t.badgeRadius}}>{bigLabel}</div> : null}
    </div> : null}
    {boxes.hook && hookLines.length ? <div style={{position:'absolute', left:boxes.hook.x, top:boxes.hook.y, width:boxes.hook.w, height:boxes.hook.h, zIndex:40, display:'flex', flexDirection:'column', justifyContent:'center', pointerEvents:'none', fontFamily:t.fontHeading, fontWeight:t.headingWeight, fontSize:hookSize, lineHeight:1.15, color:t.ink}}>{hookLines.map((line, index) => <div key={index}>{protectBreaks(line)}</div>)}</div> : null}
    {showTail ? <div style={{position:'absolute', left:VERTICAL.safe.x, top:VERTICAL.safe.y, width:safeW, height:VERTICAL.safe.bottom - VERTICAL.safe.y, zIndex:30, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none'}}>
      <div style={{padding:'16px 28px', borderRadius:t.badgeRadius, background:t.badgeBg, color:t.badgeFg, fontFamily:t.fontBody, fontSize:36, fontWeight:700, textAlign:'center'}}>{disclaimer}</div>
    </div> : null}
  </>;
};
