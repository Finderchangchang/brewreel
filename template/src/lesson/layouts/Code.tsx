import React from 'react';
import {MONO} from '../../core/font';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, Reveal, colorsOf, focusRank, textOf, useFrame, useOrientation} from './shared';

export const Code: React.FC<LayoutProps> = ({page, fields, theme, stage}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const lines = textOf(fields.code).split(/\r?\n/);
  const marked = Array.isArray(fields.highlightLines) ? fields.highlightLines.filter((n): n is number => typeof n === 'number') : [];
  const size = vert ? Math.max(34, t.codeSize) : (lines.length >= 12 ? 30 : Math.max(30, t.codeSize));
  const lineH = !vert && lines.length >= 12 ? 1.2 : 1.45;
  return <ContentFrame stage={stage ?? 'tall'}>
    <PageBody>
      <div style={{width:'100%', minHeight:0, height:'100%', overflow:'hidden', boxSizing:'border-box', background:t.codeBg, color:t.codeFg, borderRadius:t.radius, padding: vert ? '18px 20px' : '20px 28px', border:t.id === 'editorial' ? `2px solid ${t.ink}` : 'none', display:'flex', flexDirection:'column', justifyContent: vert ? 'center' : 'flex-start'}}>
        <div style={{fontFamily:MONO, fontSize: vert ? 32 : 30, letterSpacing:'0.06em', opacity:0.7, marginBottom:12}}>{textOf(fields.language, 'code')}</div>
        {lines.map((line, i) => {
          const rank = focusRank(page, frame, i);
          const listed = marked.includes(i + 1);
          const active = marked.length > 0 ? listed && rank === 'current' : rank === 'current';
          const bright = marked.length > 0 ? listed && rank !== 'next' : rank === 'current';
          const bar = t.id === 'paper' ? t.codeFg : t.accent;
          return <Reveal key={i} page={page} index={i} frame={frame} fallbackAtEnd>
            <div style={{display:'flex', gap:18, minHeight:Math.round(size * lineH), alignItems:'center', fontFamily:MONO, fontSize:size, lineHeight:lineH, color:bright || active ? t.codeFg : t.codeMuted, background:active ? 'rgba(255,255,255,.18)' : 'transparent', borderLeft:active ? `6px solid ${bar}` : '6px solid transparent', paddingLeft:14, borderRadius:8}}>
              <span style={{width:48, textAlign:'right', opacity:0.7}}>{i + 1}</span>
              <code style={{whiteSpace:'pre-wrap', wordBreak:'normal'}}>{line || ' '}</code>
            </div>
          </Reveal>;
        })}
      </div>
    </PageBody>
  </ContentFrame>;
};
