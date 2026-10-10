import React from 'react';
import {TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {Card, ContentFrame, PageBody, colorsOf, focusRank, pick, protectBreaks, useFrame, useOrientation} from './shared';
import {Arrow, Icon, flowCards} from './pro';

const FALLBACK = ['document', 'bank', 'card', 'chat', 'clock', 'flag'];

export const Flow: React.FC<LayoutProps> = ({page, fields, theme, stage, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const steps = flowCards(fields.steps);
  const titleSize = vert ? 32 : TYPE.flowTitle;
  const pointSize = vert ? 30 : TYPE.flowPoint;
  return <ContentFrame stage={stage ?? 'standard'}>
    <PageBody>
      <div style={{width: '100%', display: 'flex', flexDirection: vert ? 'column' : 'row', alignItems: vert ? 'stretch' : 'flex-start', gap: vert ? 4 : 0, paddingTop: vert ? 0 : 10}}>
        {steps.map((step, index) => {
          const rank = focusRank(page, frame, index);
          const current = rank === 'current';
          const past = rank === 'past';
          const icon = step.icon || FALLBACK[index % FALLBACK.length];
          const border = current ? `3px solid ${t.accent}` : past ? t.cardBorder : `2px dashed ${t.line}`;
          const badge = vert ? 36 : 58;
          return <React.Fragment key={index}>
            <Card theme={theme} shadow={current} style={{
              flex: '1 1 0', minWidth: 0, height: vert ? undefined : 474, overflow: 'hidden',
              padding: vert ? '8px 14px' : '22px 18px 16px',
              display: 'flex', flexDirection: 'column',
              border, background: past || current ? t.surface : 'transparent',
              opacity: past ? 0.55 : 1,
              transform: current && !vert ? 'translateY(-8px)' : undefined,
              color: rank === 'next' ? t.muted : t.ink,
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8}}>
                <Icon name={icon} size={vert ? 36 : TYPE.flowIcon} color={rank === 'next' ? t.muted : t.accent} />
                <span style={{width: badge, height: badge, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.fontNumber, fontWeight: 800, fontSize: vert ? 22 : 32, background: past ? t.ok : current ? t.accent : 'transparent', color: past || current ? '#FFFFFF' : t.muted, border: past || current ? 'none' : `3px solid ${t.line}`, flex: '0 0 auto'}}>
                  {past ? <Icon name="check" size={vert ? 22 : 28} color="#FFFFFF" /> : index + 1}
                </span>
              </div>
              <div style={{fontFamily: t.fontHeading, fontWeight: 800, fontSize: titleSize, lineHeight: 1.2, margin: vert ? '4px 0' : '14px 0 10px', color: current ? t.accent : undefined, wordBreak: 'normal'}}>{protectBreaks(step.title)}</div>
              {step.points.length ? <div style={{fontFamily: t.fontBody, fontSize: pointSize, lineHeight: 1.6, color: rank === 'next' ? t.muted : t.ink}}>
                {step.points.map((point) => <div key={point} style={{display: 'flex', alignItems: 'center', gap: 8, wordBreak: 'normal'}}>
                  <i style={{width: 8, height: 8, borderRadius: 4, background: rank === 'next' ? t.line : t.deco, display: 'block', flex: '0 0 auto'}} />
                  {protectBreaks(point)}
                </div>)}
              </div> : null}
              <div style={{marginTop: 'auto', paddingTop: 8, borderTop: `1px solid ${current ? t.accent : t.line}`, fontFamily: t.fontBody, fontSize: 30, fontWeight: current ? 800 : 500, color: past ? t.ok : current ? t.accent : t.muted}}>
                {past ? pick(lang, '已完成', 'Done') : current ? pick(lang, '正在讲', 'Now') : pick(lang, '未开始', 'Next')}
              </div>
            </Card>
            {index < steps.length - 1 ? <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', height: vert ? undefined : 474}}>
              <Arrow theme={theme} on={past} down={vert} />
            </div> : null}
          </React.Fragment>;
        })}
      </div>
    </PageBody>
  </ContentFrame>;
};
