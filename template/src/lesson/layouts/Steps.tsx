import React from 'react';
import {TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {Card, ContentFrame, PageBody, Reveal, colorsOf, focusRank, listOf, pick, protectBreaks, useFrame, useOrientation} from './shared';

export const Steps: React.FC<LayoutProps> = ({page, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const items = listOf(page.items);
  const body = vert ? Math.max(36, t.bodySize) : TYPE.stepsBody;
  return <ContentFrame>
    <PageBody>
      <div style={{width: '100%', display: 'flex', flexDirection: 'column', gap: vert ? 12 : 16}}>
        {items.map((item, index) => {
          const rank = focusRank(page, frame, index);
          const current = rank === 'current';
          return <Reveal key={index} page={page} index={index} frame={frame} fallbackAtEnd style={{flex: '0 0 auto', display: 'flex'}}>
            <Card theme={theme} shadow={current} style={{flex: 1, height: vert ? undefined : 96, display: 'flex', alignItems: 'center', gap: vert ? 14 : 22, padding: vert ? '8px 16px' : '0 28px', border: current ? `2px solid ${t.accent}` : t.cardBorder, overflow: 'hidden'}}>
              <span style={{fontFamily: t.fontNumber, fontWeight: 800, fontSize: vert ? 36 : 40, color: current ? t.accent : t.muted, flex: '0 0 auto'}}>{String(index + 1).padStart(2, '0')}</span>
              <span style={{fontFamily: t.fontBody, fontWeight: 700, fontSize: body, lineHeight: 1.3, color: rank === 'past' ? t.muted : t.ink, wordBreak: 'normal'}}>{protectBreaks(item)}</span>
              {current ? <span style={{marginLeft: 'auto', flex: '0 0 auto', background: t.accent, color: '#FFFFFF', fontFamily: t.fontBody, fontSize: 30, fontWeight: 700, padding: '2px 12px', borderRadius: t.badgeRadius}}>{pick(lang, '正在讲', 'Now')}</span> : null}
            </Card>
          </Reveal>;
        })}
      </div>
    </PageBody>
  </ContentFrame>;
};
