import React from 'react';
import {fitBlockFont, TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, Reveal, colorsOf, listOf, pick, protectBreaks, textOf, useFrame, useOrientation} from './shared';
import {emphasized} from './pro';

export const Saying: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const lines = listOf(fields.lines);
  const emphasis = textOf(fields.emphasis);
  const logo = textOf(fields.logoData);
  const longest = Math.max(1, ...lines.map((line) => Array.from(line).length));
  const size = vert
    ? fitBlockFont({chars: longest, width: 640, maxFont: 48, lineHeight: 1.35, maxHeight: 180})
    : TYPE.saying;
  return <ContentFrame>
    <PageBody style={{justifyContent:'flex-start', height:'100%'}}>
      <div style={{display:'flex', gap: vert ? 12 : 20, alignItems:'flex-start', minHeight:0}}>
        <div style={{flex:'0 0 auto', fontFamily:t.fontQuote, fontWeight:800, fontSize: vert ? 96 : 140, lineHeight:0.7, color:t.deco}}>“</div>
        <div style={{flex:1, minWidth:0}}>
          <Reveal page={page} index={0} frame={frame} fallbackAtEnd>
            <div style={{fontFamily:t.fontHeading, fontWeight:800, fontSize:size, lineHeight: vert ? 1.35 : 1.42, color:t.ink, letterSpacing:1}}>
              {lines.map((line, index) => <div key={index}>{emphasized(line, emphasis, {color:t.alert})}</div>)}
            </div>
          </Reveal>
          <Reveal page={page} index={1} frame={frame} fallbackAtEnd>
            <div style={{marginTop: vert ? 16 : 28, borderTop:`1px solid ${t.line}`, paddingTop: vert ? 14 : 20, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
              {logo ? <img src={logo} alt="" style={{width:64, height:64, objectFit:'contain', flex:'0 0 auto'}} /> : null}
              <span style={{fontFamily:t.fontHeading, fontWeight:800, fontSize: vert ? 32 : TYPE.sayingName, color:t.ink}}>{protectBreaks(textOf(fields.name))}</span>
              <i style={{width:8, height:8, borderRadius:4, background:t.deco, flex:'0 0 auto'}} />
              <span style={{fontFamily:t.fontBody, fontSize: vert ? 30 : TYPE.sayingOrg, color:t.muted}}>{protectBreaks(textOf(fields.org))}</span>
              <span style={{fontSize:30, fontWeight:700, color:t.deco, border:`2px solid ${t.deco}`, padding:'2px 12px', borderRadius:t.badgeRadius, letterSpacing:2}}>{pick(lang, '律师观点', 'Opinion')}</span>
            </div>
          </Reveal>
        </div>
      </div>
    </PageBody>
  </ContentFrame>;
};
