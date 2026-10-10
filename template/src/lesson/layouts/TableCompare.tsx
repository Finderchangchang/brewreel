import React from 'react';
import {TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, Reveal, colorsOf, focusRank, pick, protectBreaks, textOf, useBlockWidth, useFrame, useOrientation} from './shared';
import {emphasized} from './pro';

function rowsOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    return [{situation: textOf(row.situation), result: textOf(row.result), emphasis: textOf(row.emphasis)}];
  });
}

export const TableCompare: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const rows = rowsOf(fields.rows);
  const head = vert ? 44 : 84;
  const basisH = 36;
  const naturalRow = vert ? 64 : 130;
  const count = Math.max(1, rows.length);
  const natural = head + count * naturalRow + basisH;
  const limit = vert ? 900 : 580;
  const rowH = natural <= limit ? naturalRow : Math.max(56, Math.floor((limit - head - basisH) / count));
  const blockH = head + count * rowH + basisH;
  const blockW = useBlockWidth(vert ? 0 : blockH);
  return <ContentFrame>
    <PageBody>
      <div style={{width: vert ? '100%' : blockW, display:'flex', flexDirection:'column', alignSelf:'flex-start'}}>
        <div style={{display:'flex', flexDirection:'column', border:t.cardBorder, borderRadius:t.radius, overflow:'hidden', background:t.surface}}>
          <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', background:t.accent, color:t.surface, fontSize: vert ? 30 : TYPE.tableHead, fontWeight:700, letterSpacing:4, height:head}}>
            <div style={{display:'flex', alignItems:'center', padding:'0 20px'}}>{pick(lang, '情形', 'Case')}</div>
            <div style={{display:'flex', alignItems:'center', padding:'0 20px', borderLeft:'1px solid rgba(255,255,255,.25)'}}>{pick(lang, '结果', 'Result')}</div>
          </div>
          {rows.map((row, index) => {
            const rank = focusRank(page, frame, index);
            const current = rank === 'current';
            const ink = rank === 'next' ? t.muted : t.ink;
            return <Reveal key={index} page={page} index={index} frame={frame} fallbackAtEnd style={{flex:'0 0 auto', height:rowH, display:'flex'}}>
              <div style={{position:'relative', flex:1, height:rowH, display:'grid', gridTemplateColumns:'1.4fr 1fr', borderTop:`1px solid ${t.line}`, background: current ? t.hl : 'transparent', opacity: rank === 'past' ? 0.55 : 1, boxShadow: current ? `inset 8px 0 0 ${t.alert}` : undefined}}>
                <div style={{display:'flex', alignItems:'flex-end', gap:12, padding: current ? '36px 20px 16px' : '0 20px', fontFamily:t.fontBody, fontWeight: current ? 700 : 500, fontSize: vert ? 30 : TYPE.tableSituation, color:ink, wordBreak:'normal'}}>
                  <span style={{width:40, height:40, flex:'0 0 auto', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:t.fontNumber, fontWeight:800, fontSize:30, color: current ? t.surface : t.muted, background: current ? t.alert : 'transparent', border: current ? 'none' : `2px solid ${t.muted}`}}>{index + 1}</span>
                  {protectBreaks(row.situation)}
                </div>
                <div style={{display:'flex', alignItems:'flex-end', gap:10, padding: current ? '36px 20px 16px' : '0 20px', borderLeft:`1px solid ${t.line}`, fontFamily:t.fontBody, fontSize: vert ? 30 : TYPE.tableResult, color:ink, wordBreak:'normal'}}>
                  <span style={{color:t.deco, fontWeight:800}}>→</span>
                  <span style={{fontWeight: current ? 800 : 600, color: current ? t.alert : ink}}>{emphasized(row.result, row.emphasis, {fontWeight:800, color: current ? t.alert : t.ink})}</span>
                </div>
                {current ? <span style={{position:'absolute', left:16, top:8, zIndex:2, fontSize:22, lineHeight:1, color:'#FFFFFF', background:t.accent, padding:'4px 10px', borderRadius:t.badgeRadius, fontFamily:t.fontBody, fontWeight:700}}>{pick(lang, '正在讲', 'Now')}</span> : null}
              </div>
            </Reveal>;
          })}
        </div>
        <div style={{flex:'0 0 auto', display:'flex', alignItems:'center', gap:12, marginTop:0, height:basisH, fontSize:TYPE.tableBasis, color:t.muted}}>
          <em style={{fontStyle:'normal', fontSize:30, color:t.accent, border:`1.5px solid ${t.accent}`, padding:'2px 10px', borderRadius:t.badgeRadius, letterSpacing:2}}>{pick(lang, '依据', 'Basis')}</em>
          <span>{protectBreaks(textOf(fields.basis))}</span>
        </div>
      </div>
    </PageBody>
  </ContentFrame>;
};
