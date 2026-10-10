import React from 'react';
import {TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {Card, ContentFrame, PageBody, colorsOf, focusRank, protectBreaks, useFrame, useOrientation} from './shared';
import {Icon, SpeakingBadge, pointItems} from './pro';

export const Points: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const items = pointItems(fields.items);
  return <ContentFrame>
    <PageBody>
      <div style={{width: '100%', display: 'flex', flexDirection: vert ? 'column' : 'row', alignItems: 'flex-start', gap: vert ? 12 : 40}}>
        {items.map((item, index) => {
          const rank = focusRank(page, frame, index);
          const current = rank === 'current';
          return <div key={index} style={{flex: vert ? '0 0 auto' : '1 1 0', width: vert ? '100%' : undefined, minWidth: 0, display: 'flex', opacity: rank === 'next' ? 0.7 : 1}}>
            <Card theme={theme} shadow={rank !== 'next'} style={{position: 'relative', flex: 1, height: vert ? undefined : 380, padding: vert ? '16px 20px' : '28px 28px 36px', border: current ? `2px solid ${t.accent}` : t.cardBorder, display: 'flex', flexDirection: vert ? 'row' : 'column', alignItems: vert ? 'center' : 'flex-start', gap: vert ? 16 : 8, overflow: 'visible'}}>
              <span style={{position: vert ? 'relative' : 'absolute', right: vert ? undefined : 20, top: vert ? undefined : 16, marginLeft: vert ? 'auto' : undefined, fontFamily: t.fontNumber, fontWeight: 800, fontSize: vert ? 36 : TYPE.pointsIndex, color: t.line, order: vert ? 3 : 0}}>{String(index + 1).padStart(2, '0')}</span>
              <Icon name={item.icon} size={vert ? 56 : TYPE.pointsIcon} color={t.accent} />
              <div style={{minWidth: 0}}>
                <div style={{fontFamily: t.fontHeading, fontWeight: 800, fontSize: vert ? 36 : TYPE.pointsTitle, color: t.accent, lineHeight: 1.2, marginTop: vert ? 0 : 12}}>{protectBreaks(item.title)}</div>
                <div style={{fontFamily: t.fontBody, fontWeight: 500, fontSize: vert ? 30 : TYPE.pointsBody, lineHeight: 1.45, color: t.ink, marginTop: 8, wordBreak: 'normal'}}>{protectBreaks(item.text)}</div>
              </div>
              {current ? <SpeakingBadge theme={theme} lang={lang} hang /> : null}
            </Card>
          </div>;
        })}
      </div>
    </PageBody>
  </ContentFrame>;
};
