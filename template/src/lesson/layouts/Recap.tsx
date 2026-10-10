import React from 'react';
import type {LayoutProps} from './shared';
import {TYPE} from '../stage.mjs';
import {recapHeading} from '../../../../scripts/lesson/vertical-layout.mjs';
import {ContentFrame, PageBody, Reveal, colorsOf, focusRank, listOf, protectBreaks, useCanvas, useFrame, useHeadingEmphasis, useOrientation} from './shared';

export const Recap: React.FC<LayoutProps> = ({page, fields, theme, lang, domain}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const canvas = useCanvas();
  const t = colorsOf(theme);
  const side = !vert && Boolean(canvas.brand) && canvas.brandRecapIndex === page.index;
  const items = listOf(fields.items);
  const heading = recapHeading(domain, lang);
  const headPx = vert ? 48 : TYPE.recapHead;
  const emphasis = useHeadingEmphasis(heading, headPx);
  const body = vert ? 32 : TYPE.recapItem;
  return <ContentFrame>
    <PageBody style={{gap: vert ? 12 : 18, width: side ? 900 : '100%', height:'100%', justifyContent:'flex-start'}}>
      <div style={{fontFamily:t.fontHeading, fontWeight:800, fontSize: headPx, lineHeight:1.2, color:t.ink, ...emphasis.style}}>{heading}</div>
      <div style={{display:'flex', flexDirection:'column', gap: vert ? 10 : 18, minHeight:0}}>
        {items.map((item, index) => {
          const rank = focusRank(page, frame, index);
          return <Reveal key={`${index}-${item}`} page={page} index={index} frame={frame} fallbackAtEnd>
            <div style={{display:'flex', alignItems:'baseline', gap:18}}>
              <b style={{fontFamily:t.fontNumber, fontWeight:800, fontSize: vert ? 36 : TYPE.recapIndex, color:t.deco, flex:'0 0 auto'}}>{String(index + 1).padStart(2, '0')}</b>
              <span style={{fontFamily:t.fontBody, fontWeight:600, fontSize:body, lineHeight:1.4, color: rank === 'next' ? t.muted : t.ink, wordBreak:'normal'}}>{protectBreaks(item)}</span>
            </div>
          </Reveal>;
        })}
      </div>
    </PageBody>
  </ContentFrame>;
};
