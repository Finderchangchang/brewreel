import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {pick} from '../core/kit';
import {coverTitleLayout, emWidth, protectBreaks} from '../../../scripts/lesson/title-wrap.mjs';
import {lessonThemes, type LessonTheme} from './theme';
import {Character} from './mascot';
import type {MascotWardrobe} from './mascot';

export type CoverAspect = '16x9' | '9x16' | '3x4';
export type CoverPresenterKind = 'cartoon' | 'real' | 'none';
export type CoverStillProps = {
  aspect?: CoverAspect;
  title?: string;
  subtitle?: string;
  theme?: LessonTheme;
  lang?: 'zh' | 'en';
  mascot?: MascotWardrobe | null;
  presenterKind?: CoverPresenterKind;
  presenterImage?: string | null;
  brand?: {logo: string; column: string; primary?: string} | null;
};

const SIZES: Record<CoverAspect, {w: number; h: number}> = {
  '16x9': {w: 1920, h: 1080},
  '9x16': {w: 1080, h: 1920},
  '3x4': {w: 1080, h: 1440},
};

export const coverSize = (aspect: CoverAspect = '16x9') => SIZES[aspect] ?? SIZES['16x9'];

export const CoverStill: React.FC<CoverStillProps> = ({
  aspect = '16x9',
  title = 'Cover',
  subtitle = '',
  theme = 'lecture',
  lang = 'zh',
  mascot,
  presenterKind = 'cartoon',
  presenterImage = null,
  brand = null,
}) => {
  const t = lessonThemes[theme];
  const {w, h} = coverSize(aspect);
  const wide = aspect === '16x9';
  const tall = aspect === '9x16' || aspect === '3x4';
  const showPresenter = presenterKind === 'cartoon' || (presenterKind === 'real' && Boolean(presenterImage));
  const presenterH = presenterKind === 'real' ? (wide ? 360 : Math.round(h * 0.28)) : (wide ? Math.round(h * 0.62) : Math.round(h * 0.4));
  const presenterW = presenterKind === 'real' ? presenterH : Math.round(presenterH * 850 / 1200);
  const margin = wide ? 80 : 48;
  const titleX = wide ? 120 : 72;
  const peepX = showPresenter ? w - presenterW - margin : w;
  const peepY = tall ? Math.max(Math.round(h / 2), h - presenterH - 36) : h - presenterH - 36;
  const titleW = wide ? Math.max(280, (showPresenter ? peepX : w - margin) - titleX - 24) : w - titleX * 2;
  const fitted = coverTitleLayout(title, {width: titleW, minPx: tall ? 110 : 88, maxPx: tall ? 140 : 120, maxLines: 4});
  const lines = fitted.lines;
  const titleSize = fitted.size;
  const titleY = tall ? Math.round(h * 0.07) : 180;
  const label = pick(lang, 'AI生成', 'AI-generated');
  return <AbsoluteFill style={{background:t.bg, color:t.ink, width:w, height:h}}>
    <div style={{position:'absolute', left:titleX, top:titleY, width:titleW}}>
      {lines.map((line, index) => <div key={index} style={{fontFamily:t.fontHeading, fontWeight:t.headingWeight, fontSize:titleSize, lineHeight:1.12, color:t.ink, wordBreak:'normal'}}>{protectBreaks(line)}</div>)}
      <div style={{marginTop: tall ? 18 : 16, width: Math.min(titleW, Math.round(titleSize * 3.2)), height: tall ? 16 : 12, background:brand?.primary || t.accent, borderRadius:2}} />
      {subtitle ? <div style={{marginTop:22, fontFamily:t.fontBody, fontWeight:t.bodyWeight, fontSize:Math.max(28, Math.min(wide ? 40 : 36, Math.floor(titleW / Math.max(1, emWidth(subtitle))))), lineHeight:1.35, color:t.muted, whiteSpace:'nowrap', wordBreak:'normal'}}>{protectBreaks(subtitle)}</div> : null}
    </div>
    {presenterKind === 'cartoon' ? <div style={{position:'absolute', left:peepX, top:peepY, width:presenterW, height:presenterH, pointerEvents:'none'}}>
      <Character pose="explain" fromPose="explain" progress={1} mouth={0} blink={0} elapsedMs={0} wardrobe={mascot} ink={t.ink} surface={t.surface} crop="card" frameWidth={presenterW} frameHeight={presenterH} />
    </div> : null}
    {presenterKind === 'real' && presenterImage ? <div style={{position:'absolute', left:peepX, top:peepY, width:presenterW, height:presenterW, borderRadius:presenterW / 2, overflow:'hidden', pointerEvents:'none'}}>
      <Img src={staticFile(presenterImage)} style={{width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 40%'}} />
    </div> : null}
    {brand?.logo ? <div style={{position:'absolute', left:titleX, top:28, width:titleW, height:46, display:'flex', alignItems:'center', gap:12, zIndex:4}}>
      <Img src={brand.logo.startsWith('data:') ? brand.logo : staticFile(brand.logo)} style={{width:40, height:40}} />
      <div style={{fontFamily:t.fontHeading, fontWeight:700, fontSize:28, letterSpacing:2, color:brand.primary || t.accent}}>{brand.column}</div>
    </div> : null}
    <div aria-label={label} style={{position:'absolute', top:36, right:36, zIndex:4, background:t.badgeBg, color:t.badgeFg, fontFamily:t.fontBody, fontWeight:t.badgeWeight, fontSize:32, lineHeight:1, padding:'8px 14px', borderRadius:t.badgeRadius}}>{label}</div>
  </AbsoluteFill>;
};
