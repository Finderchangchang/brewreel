import React from 'react';
import {Img, staticFile} from 'remotion';
import {pick} from '../../core/kit';
import type {LessonTheme} from '../theme';
import {useCanvas} from '../canvas';
import {colorsOf} from '../layouts/shared';
import {NAMEBAR} from '../stage.mjs';

const ON_NAVY = '#C9AE80';
const TIP = '#E3CFA6';

export const brandSrc = (src: string) => (src.startsWith('data:') ? src : staticFile(src));

function hexAlpha(hex: string, alpha: number) {
  const h = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return `rgba(176,141,87,${alpha})`;
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return `rgba(${n(0)},${n(2)},${n(4)},${alpha})`;
}

export const BrandOpening: React.FC<{pageTitle: string; theme: LessonTheme}> = ({pageTitle, theme}) => {
  const brand = useCanvas().brand;
  const t = colorsOf(theme);
  if (!brand) return null;
  const rule = brand.secondary || t.deco;
  return <div style={{position:'absolute', inset:0, background:brand.primary, color:'#fff', zIndex:2}}>
    <div style={{position:'absolute', inset:0, background:`radial-gradient(900px 600px at 50% 42%, ${hexAlpha(rule, 0.22)}, transparent 70%)`}} />
    <div style={{position:'absolute', left:0, right:0, top:190, textAlign:'center'}}>
      <Img src={brandSrc(brand.logo)} style={{width:190, height:190}} />
      <div style={{fontFamily:t.fontHeading, fontSize:64, fontWeight:800, letterSpacing:10, marginTop:28}}>{brand.firm}</div>
      {brand.english ? <div style={{fontFamily:t.fontBody, fontSize:22, letterSpacing:8, color:ON_NAVY, marginTop:8}}>{brand.english}</div> : null}
      <div style={{width:120, height:3, background:rule, margin:'46px auto 40px'}} />
      <div style={{fontFamily:t.fontBody, fontSize:30, color:ON_NAVY, letterSpacing:4}}>{brand.series}</div>
      <div style={{fontFamily:t.fontHeading, fontSize:60, fontWeight:700, marginTop:14}}>{pageTitle}</div>
    </div>
    <div style={{position:'absolute', left:0, right:0, bottom:70, textAlign:'center', fontFamily:t.fontBody, fontSize:26, color:'rgba(255,255,255,.82)'}}>
      <span style={{border:'1px solid rgba(255,255,255,.5)', padding:'6px 18px', borderRadius:6, marginRight:brand.openingExtra ? 14 : 0}}>{brand.openingAi}</span>
      {brand.openingExtra || null}
    </div>
  </div>;
};

export const BrandBug: React.FC<{theme: LessonTheme; box?: {x: number; y: number; w?: number; h?: number} | null; logo?: number}> = ({theme, box, logo = 46}) => {
  const brand = useCanvas().brand;
  const t = colorsOf(theme);
  if (!brand) return null;
  const placed = box
    ? {left: box.x, top: box.y, width: box.w, height: box.h}
    : {left: 120, top: 44, height: logo};
  return <div style={{position:'absolute', ...placed, display:'flex', alignItems:'center', gap:14, zIndex:6, fontFamily:t.fontHeading, fontSize: logo >= 46 ? 26 : 28, fontWeight:700, color:brand.primary, letterSpacing:3, pointerEvents:'none'}}>
    <Img src={brandSrc(brand.logo)} style={{width:logo, height:logo}} />
    <span>{brand.column}</span>
  </div>;
};

export const BrandNameBar: React.FC<{theme: LessonTheme; slide: {x: number; opacity: number}; vertical?: boolean; box?: {right: number; bottom: number} | null}> = ({theme, slide, vertical = false, box}) => {
  const brand = useCanvas().brand;
  const t = colorsOf(theme);
  const lawyer = brand?.lawyer;
  if (!brand || !lawyer || !(slide.opacity > 0)) return null;
  const rule = brand.secondary || t.deco;
  const right = box?.right ?? (vertical ? 180 : NAMEBAR.right);
  const bottom = box?.bottom ?? (vertical ? 640 : NAMEBAR.bottom);
  return <div style={{position:'absolute', right, bottom, zIndex:20, display:'flex', alignItems:'stretch', boxShadow:'0 20px 40px -24px rgba(0,0,0,.5)', transform:`translateX(${slide.x}px)`, opacity:slide.opacity, pointerEvents:'none'}}>
    <div style={{background:brand.primary, color:'#fff', fontFamily:t.fontHeading, fontSize: vertical ? 32 : 40, fontWeight:800, padding: vertical ? '12px 22px' : '16px 30px', display:'flex', alignItems:'baseline', gap:12}}>
      {lawyer.name}<small style={{fontSize: vertical ? 22 : 26, fontWeight:500, color:ON_NAVY}}>{lawyer.title}</small>
    </div>
    <div style={{background:'#fff', color:brand.primary, fontFamily:t.fontBody, fontSize: vertical ? 22 : 26, padding:'0 28px', display:'flex', alignItems:'center', borderLeft:`6px solid ${rule}`}}>{lawyer.firmLine}</div>
  </div>;
};

export const FirmFace: React.FC<{theme: LessonTheme; lang?: 'zh' | 'en'; compact?: boolean}> = ({theme, lang = 'zh', compact = false}) => {
  const brand = useCanvas().brand;
  const t = colorsOf(theme);
  const qrLabel = pick(lang, '律所二维码位置', 'Firm QR code');
  if (!brand) return null;
  const logo = compact ? 96 : 130;
  return <>
    <Img src={brandSrc(brand.logo)} style={{width:logo, height:logo}} />
    <div style={{fontFamily:t.fontHeading, fontSize: compact ? 32 : 44, fontWeight:800, letterSpacing: compact ? 2 : 6, marginTop: compact ? 12 : 18}}>{brand.firm}</div>
    {brand.qr ? <Img src={brandSrc(brand.qr)} style={{width: compact ? 160 : 230, height: compact ? 160 : 230, margin: compact ? '20px auto 12px' : '40px auto 18px', objectFit:'contain'}} /> : <div style={{width: compact ? 160 : 230, height: compact ? 160 : 230, margin: compact ? '20px auto 12px' : '40px auto 18px', border:'3px dashed rgba(255,255,255,.55)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:t.fontBody, fontSize: compact ? 20 : 24, color:'rgba(255,255,255,.75)'}}>{qrLabel}</div>}
    <div style={{fontFamily:t.fontBody, fontSize: compact ? 22 : 28, color:TIP}}>{brand.tip}</div>
  </>;
};

export const BrandEnding: React.FC<{theme: LessonTheme; lang?: 'zh' | 'en'; disclaimerBottom?: number}> = ({theme, lang = 'zh', disclaimerBottom = 70}) => {
  const brand = useCanvas().brand;
  const t = colorsOf(theme);
  if (!brand) return null;
  return <>
    <div style={{position:'absolute', right:120, top:150, width:620, height:690, background:brand.primary, borderRadius:18, color:'#fff', textAlign:'center', paddingTop:56, boxSizing:'border-box', zIndex:4}}>
      <FirmFace theme={theme} lang={lang} />
    </div>
    <div style={{position:'absolute', left:120, right:120, bottom:disclaimerBottom, zIndex:6, fontFamily:t.fontBody, fontSize:24, color:t.muted, textAlign:'center', borderTop:`1px solid ${t.line}`, paddingTop:22}}>{brand.disclaimer}</div>
  </>;
};
