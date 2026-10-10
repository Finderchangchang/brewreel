import React from 'react';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, Reveal, colorsOf, pick, textOf, useFrame, useOrientation} from './shared';

type Callout = {x: number; y: number; width: number; height: number; label?: string; type?: string};

export const Screenshot: React.FC<LayoutProps> = ({page, fields, theme, lang, stage}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const boxes = (Array.isArray(fields.callouts) ? fields.callouts : []) as Callout[];
  const imageData = textOf(fields.imageData);
  const radius = t.radius;
  const shellShadow = t.id === 'editorial' ? 'none' : '0 30px 60px -28px rgba(0,0,0,.28)';
  return <ContentFrame stage={stage ?? 'tall'}>
    <PageBody>
      <div style={{position:'relative', width:'100%', height:'100%', minHeight: vert ? 280 : 0, borderRadius:radius, background:'#FFFFFF', border:t.id === 'editorial' ? '2px solid #121212' : '1px solid rgba(0,0,0,.08)', boxShadow:shellShadow, overflow:'hidden'}}>
        {imageData ? <img src={imageData} alt={textOf(fields.image)} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', background:'#fff'}} /> : <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center', color:t.muted, fontSize: vert ? 48 : 30}}>{pick(lang, '界面示意', 'Interface')}</div>}
        {boxes.map((box, i) => <Reveal key={i} page={page} index={i + 1} frame={frame} fallbackAtEnd style={{position:'absolute', inset:0}}>
          <div style={{position:'absolute', left:`${box.x * 100}%`, top:`${box.y * 100}%`, width:`${box.width * 100}%`, height:`${box.height * 100}%`, boxSizing:'border-box', border:`${t.id === 'editorial' ? 4 : 2}px solid ${t.accent}`, borderRadius:box.type === 'magnify' ? '50%' : Math.max(0, radius - 4)}}>
            {box.label ? <div style={{position:'absolute', left:0, top: vert ? -52 : 8, maxWidth:420, padding:'4px 10px', borderRadius:t.id === 'lecture' ? 999 : radius, background:t.id === 'editorial' ? t.ink : t.surface, color:t.id === 'editorial' ? '#fff' : t.ink, border:t.cardBorder, fontFamily:t.fontBody, fontWeight:600, fontSize: vert ? 36 : 30, whiteSpace:'nowrap'}}>{box.label}</div> : null}
          </div>
        </Reveal>)}
      </div>
    </PageBody>
  </ContentFrame>;
};
