import React from 'react';
import {TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {Card, ContentFrame, PageBody, colorsOf, focusRank, protectBreaks, textOf, useFrame, useOrientation} from './shared';
import {Icon, SpeakingBadge} from './pro';

const toneColor = (alert: string, warn: string, ok: string, tone: string) => tone === 'high' ? alert : tone === 'mid' ? warn : ok;
const barsOf = (tone: string) => tone === 'high' ? 3 : tone === 'mid' ? 2 : 1;

function cardsOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    return [{tone: textOf(row.tone), label: textOf(row.label), icon: textOf(row.icon), text: textOf(row.text)}];
  });
}

export const Levels: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const items = cardsOf(fields.items);
  return <ContentFrame>
    <PageBody>
      <div style={{width:'100%', display:'grid', alignItems:'start', gridTemplateColumns: vert ? '1fr' : `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`, gap: vert ? 10 : 28}}>
        {items.map((item, index) => {
          const rank = focusRank(page, frame, index);
          const current = rank === 'current';
          const color = toneColor(t.alert, t.warn, t.ok, item.tone);
          const filled = barsOf(item.tone);
          return <div key={index} style={{display:'flex', opacity: rank === 'next' ? 0.7 : 1}}>
            <Card theme={theme} shadow={rank !== 'next'} style={{position:'relative', flex:1, height: vert ? undefined : 450, padding: vert ? '14px 16px 36px' : '28px 24px 32px', border: current ? `3px solid ${color}` : t.cardBorder, borderTop:`10px solid ${color}`, overflow:'visible', display:'flex', flexDirection:'column'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
                <span style={{fontSize:30, fontWeight:800, color:t.surface, background:color, padding:'4px 14px', borderRadius:t.badgeRadius, letterSpacing:2}}>{protectBreaks(item.label)}</span>
                <span style={{display:'flex', alignItems:'flex-end', gap:6}}>
                  {[22, 34, 46].map((height, bar) => <i key={height} style={{width:12, height, borderRadius:3, background: bar < filled ? color : t.line}} />)}
                </span>
              </div>
              <Icon name={item.icon} size={vert ? 48 : TYPE.levelsIcon} color={color} />
              <div style={{marginTop:16, fontFamily:t.fontHeading, fontWeight:800, fontSize: vert ? 30 : TYPE.levelsText, lineHeight:1.42, color: current ? color : t.ink, wordBreak:'normal'}}>{protectBreaks(item.text)}</div>
              {current ? <SpeakingBadge theme={theme} lang={lang} hang /> : null}
            </Card>
          </div>;
        })}
      </div>
    </PageBody>
  </ContentFrame>;
};
