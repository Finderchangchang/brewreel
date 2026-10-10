import React from 'react';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, colorsOf, useOrientation} from './shared';
import {useCanvas} from '../canvas';
import {FirmFace} from '../brand/BrandChrome';

export const BrandEnd: React.FC<LayoutProps> = ({page, theme, lang}) => {
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const brand = useCanvas().brand;
  if (vert) {
    return <ContentFrame>
      <PageBody style={{alignItems:'center', justifyContent:'center', gap:18}}>
        <div style={{fontFamily:t.fontHeading, fontWeight:800, fontSize:48, lineHeight:1.2, color:t.ink, textAlign:'center'}}>{page.title}</div>
        {brand ? <div style={{width:'100%', background:brand.primary, color:'#fff', borderRadius:18, textAlign:'center', padding:'28px 20px 24px', boxSizing:'border-box'}}>
          <FirmFace theme={theme} lang={lang} compact />
          <div style={{marginTop:18, fontFamily:t.fontBody, fontSize:22, lineHeight:1.4, color:'rgba(255,255,255,.82)'}}>{brand.disclaimer}</div>
        </div> : null}
      </PageBody>
    </ContentFrame>;
  }
  return <div style={{position:'absolute', left:120, top:290, width:900}}>
    <div style={{fontFamily:t.fontHeading, fontWeight:800, fontSize:60, lineHeight:1.2, color:t.ink}}>{page.title}</div>
  </div>;
};
