import React from 'react';
import {fitBlockFont} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, TitleLines, colorsOf, emWidth, protectBreaks, showFor, textOf, titleLines, useCanvas, useFrame, useHeadingEmphasis, useOrientation} from './shared';
import {BrandOpening} from '../brand/BrandChrome';

export const Cover: React.FC<LayoutProps> = ({page, fields, theme}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const title = page.title;
  const maxW = vert ? 720 : 980;
  const widest = Math.max(1, ...titleLines(title, vert ? {maxLines: 3, maxEm: 9} : {forceTwo: true}).map((line) => emWidth(line)));
  const size = Math.max(vert ? 72 : 48, Math.min(vert ? 110 : t.coverSize, Math.floor(maxW / widest)));
  const emphasis = useHeadingEmphasis(title, size);
  const canvas = useCanvas();
  const subtitle = textOf(fields.subtitle, page.subtitle ?? '');
  const small = textOf(fields.smallText, page.smallText ?? '');
  const p0 = showFor(page, 0, frame, true);
  const p1 = showFor(page, 1, frame, true);
  const align = t.id === 'editorial' ? 'left' as const : 'center' as const;
  if (!vert && canvas.brand) return <BrandOpening pageTitle={title} theme={theme} />;
  if (!vert) {
    const fitted = fitBlockFont({chars: Array.from(title).length, width: 1200, maxFont: Math.min(t.coverSize, 96), lineHeight: 1.15, maxHeight: 240});
    return <ContentFrame stage="cover">
      <PageBody style={{justifyContent:'center', gap:28}}>
        <TitleLines text={title} maxLines={3} maxEm={1200 / Math.max(1, fitted)} style={{fontFamily:t.fontHeading, fontWeight:t.headingWeight, fontSize:fitted, lineHeight:1.15, letterSpacing:'-0.01em', color:t.ink, textAlign:'left', width:'100%'}} />
        {subtitle ? <div style={{fontFamily:t.fontBody, fontWeight:t.bodyWeight, fontSize:32, lineHeight:1.4, color:t.muted, width:'100%', wordBreak:'normal'}}>{protectBreaks(subtitle)}</div> : null}
        {small ? <div style={{fontFamily:t.fontBody, fontWeight:500, fontSize:30, letterSpacing:'0.04em', color:t.muted, wordBreak:'normal'}}>{protectBreaks(small)}</div> : null}
      </PageBody>
    </ContentFrame>;
  }
  return <ContentFrame stage="standard">
    <PageBody style={{alignItems:'center', paddingTop: vert ? 8 : 40}}>
      <TitleLines text={title} forceTwo={!vert} maxLines={vert ? 3 : undefined} maxEm={vert ? (emphasis.active && emphasis.fontPx > size ? maxW / emphasis.fontPx : 9) : undefined} style={{fontFamily:t.fontHeading, fontWeight:t.headingWeight, fontSize:size, lineHeight:t.id === 'editorial' ? 1.05 : 1.15, letterSpacing:t.id === 'editorial' ? '-0.03em' : '-0.01em', color:t.ink, textAlign:align, maxWidth:maxW, opacity:p0, ...emphasis.style}} />
      {vert ? <div style={{marginTop:18, width:Math.min(maxW, Math.round(size * 3)), height:14, background:t.accent, borderRadius:2, opacity:p0}} /> : null}
      {subtitle ? <div style={{marginTop: vert ? 20 : 28, fontFamily:t.fontBody, fontWeight:t.bodyWeight, fontSize: vert ? Math.max(48, t.bodySize) : t.id === 'paper' ? 30 : 32, lineHeight:1.4, color:t.muted, textAlign:align, maxWidth:maxW, width:'100%', opacity:p1, wordBreak:'normal'}}>{protectBreaks(subtitle)}</div> : null}
      {small ? <div style={{marginTop:22, fontFamily:t.fontBody, fontWeight:500, fontSize:26, letterSpacing:'0.06em', color:t.muted, wordBreak:'normal'}}>{protectBreaks(small)}</div> : null}
    </PageBody>
  </ContentFrame>;
};
