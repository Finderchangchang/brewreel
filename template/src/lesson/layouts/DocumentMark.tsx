import React from 'react';
import {TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, Reveal, colorsOf, pick, protectBreaks, showFor, textOf, useFrame, useOrientation} from './shared';
import {Icon, emphasized} from './pro';

function rowsOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    return [{name: textOf(row.name), value: textOf(row.value)}];
  });
}

export const DocumentMark: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const kind = textOf(fields.kind) === 'chat' ? 'chat' : 'transfer';
  const rows = rowsOf(fields.rows);
  const highlight = typeof fields.highlight === 'number' ? fields.highlight : 1;
  const hit = rows[highlight - 1];
  const marked = showFor(page, 1, frame) > 0.02;
  const title = textOf(fields.screenTitle) || (kind === 'chat' ? pick(lang, '聊天记录', 'Messages') : pick(lang, '转账详情', 'Transfer'));
  return <ContentFrame>
    <PageBody>
      <div style={{width:'100%', display:'flex', flexDirection: vert ? 'column' : 'row', alignItems:'flex-start', gap: vert ? 12 : 48}}>
        <Reveal page={page} index={0} frame={frame} fallbackAtEnd style={{flex:'0 0 auto', width: vert ? '100%' : 500, height: vert ? undefined : 560, position:'relative'}}>
          <span style={{position:'absolute', left:8, top:-4, zIndex:2, fontSize:30, color:t.surface, background:t.muted, padding:'2px 12px', borderRadius:t.badgeRadius, letterSpacing:2}}>{pick(lang, '示意图', 'Diagram')}</span>
          <div style={{height: vert ? 420 : '100%', boxSizing:'border-box', padding:10, background:t.ink, borderRadius:28, display:'flex'}}>
            <div style={{flex:1, minHeight:0, background:t.surface, color:t.ink, borderRadius:20, overflow:'hidden', display:'flex', flexDirection:'column', fontFamily:t.fontBody}}>
              <div style={{height:36, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', fontSize:30, fontWeight:700}}>
                <span>14:20</span>
                <span style={{width:36, height:10, border:`2px solid ${t.ink}`, borderRadius:2}} />
              </div>
              <div style={{height:40, display:'flex', alignItems:'center', justifyContent:'center', borderBottom:`1px solid ${t.line}`, fontSize:30, fontWeight:700}}>{protectBreaks(title)}</div>
              {kind === 'transfer' ? <div style={{textAlign:'center', padding:'12px 8px 8px'}}>
                {textOf(fields.status) ? <div style={{display:'inline-flex', alignItems:'center', gap:8, fontSize:30, fontWeight:700, color:t.ok}}>
                  <Icon name="check" size={28} color={t.ok} />
                  {protectBreaks(textOf(fields.status))}
                </div> : null}
                {textOf(fields.amount) ? <div style={{fontFamily:t.fontNumber, fontWeight:800, fontSize: vert ? 36 : TYPE.documentAmount, lineHeight:1.2, marginTop:4}}>{protectBreaks(textOf(fields.amount))}</div> : null}
              </div> : null}
              <div style={{flex:1, minHeight:0, overflow:'hidden', padding: kind === 'chat' ? '10px 12px' : '0 14px'}}>
                {rows.map((row, index) => {
                  const on = marked && index + 1 === highlight;
                  if (kind === 'chat') {
                    return <div key={index} style={{margin:'6px 0', maxWidth:'86%', marginLeft: index % 2 ? 'auto' : 0, padding:'6px 10px', borderRadius:t.radius, background: index % 2 ? t.accentSoft : t.hl, border: on ? `3px solid ${t.alert}` : 'none', fontSize:30, lineHeight:1.3}}>
                      <b style={{display:'block', color:t.muted, fontWeight:600}}>{protectBreaks(row.name)}</b>
                      <span style={{fontWeight: on ? 800 : 600}}>{protectBreaks(row.value)}</span>
                    </div>;
                  }
                  return <div key={index} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, minHeight:44, borderTop:`1px solid ${on ? 'transparent' : t.line}`, padding:'0 6px', borderRadius:8, boxShadow: on ? `0 0 0 3px ${t.alert}` : undefined, background: on ? t.hl : 'transparent', fontSize:30}}>
                    <span style={{color:t.muted}}>{protectBreaks(row.name)}</span>
                    <b style={{fontWeight: on ? 800 : 600, color:t.ink}}>{protectBreaks(row.value)}</b>
                  </div>;
                })}
              </div>
            </div>
          </div>
        </Reveal>
        <div style={{flex:'1 1 auto', minWidth:0, display:'flex', flexDirection:'column', justifyContent:'flex-start', gap:16, paddingTop: vert ? 0 : 24}}>
          <Reveal page={page} index={2} frame={frame} fallbackAtEnd>
            <div style={{display:'flex', alignItems:'center', gap:12, fontSize:30, color:t.muted, letterSpacing:2}}>
              <i style={{width:48, height:2, background:t.deco}} />
              {pick(lang, '要点', 'Point')}
            </div>
            <div style={{marginTop:12, fontFamily:t.fontHeading, fontWeight:800, fontSize: vert ? 32 : TYPE.documentPoint, lineHeight:1.35, color:t.ink, wordBreak:'normal'}}>
              {emphasized(textOf(fields.point), textOf(fields.emphasis), {color:t.alert})}
            </div>
          </Reveal>
          {hit ? <Reveal page={page} index={1} frame={frame} fallbackAtEnd>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              {!vert ? <i style={{width:36, height:4, background:t.alert, position:'relative', flex:'0 0 auto'}}>
                <b style={{position:'absolute', left:-6, top:-5, width:14, height:14, borderRadius:7, background:t.alert}} />
              </i> : null}
              <div style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:16, minHeight:72, padding:'8px 16px', background:t.surface, border:`4px solid ${t.alert}`, borderRadius:t.radius}}>
                <span style={{fontSize:30, color:t.muted}}>{protectBreaks(hit.name)}</span>
                <b style={{fontFamily:t.fontHeading, fontWeight:800, fontSize: vert ? 32 : TYPE.documentZoom, color:t.ink}}>{protectBreaks(hit.value)}</b>
                <span style={{marginLeft:'auto'}}><Icon name="search" size={36} color={t.alert} /></span>
              </div>
            </div>
          </Reveal> : null}
        </div>
      </div>
    </PageBody>
  </ContentFrame>;
};
