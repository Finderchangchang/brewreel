import React from 'react';
import {fitBlockFont, TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {Card, ContentFrame, PageBody, Reveal, colorsOf, pick, protectBreaks, textOf, useFrame, useOrientation} from './shared';
import {Icon, emphasized} from './pro';

export const BigNumber: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const number = textOf(fields.number);
  const unit = textOf(fields.unit);
  const name = textOf(fields.name);
  const basis = textOf(fields.basis);
  const cardText = textOf(fields.cardText);
  const cardEmphasis = textOf(fields.cardEmphasis);
  const axisFrom = textOf(fields.axisFrom);
  const axisTo = textOf(fields.axisTo);
  const axisSpan = textOf(fields.axisSpan);
  const hasAxis = Boolean(axisFrom && axisTo && axisSpan);
  const glyphs = Math.max(1, Array.from(number).length);
  const size = vert
    ? fitBlockFont({chars: glyphs, width: 640, maxFont: 180, lineHeight: 0.9, maxHeight: 260})
    : glyphs <= 2
      ? TYPE.bigNumber
      : fitBlockFont({chars: glyphs, width: 700, maxFont: TYPE.bigNumber, lineHeight: 0.9, maxHeight: 380});
  const unitSize = vert ? Math.max(48, Math.round(size * 0.36)) : TYPE.bigUnit;
  return <ContentFrame>
    <PageBody>
      <div style={{width: '100%', display: 'flex', flexDirection: vert ? 'column' : 'row', alignItems: 'flex-start', gap: vert ? 12 : 40}}>
        <div style={{flex: vert ? '0 0 auto' : '0 0 700px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
          <Reveal page={page} index={0} frame={frame} fallbackAtEnd>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 12, color: t.accent}}>
              <span style={{fontFamily: t.fontNumber, fontWeight: 800, fontSize: size, lineHeight: 0.9, letterSpacing: -2}}>{protectBreaks(number)}</span>
              <span style={{fontFamily: t.fontHeading, fontWeight: 800, fontSize: unitSize, lineHeight: 1}}>{protectBreaks(unit)}</span>
            </div>
            <i style={{display: 'block', width: 72, height: 4, background: t.deco, margin: '16px 0 12px'}} />
            <div style={{fontFamily: t.fontHeading, fontWeight: 800, fontSize: vert ? 36 : TYPE.bigName, lineHeight: 1.2, color: t.ink, letterSpacing: 2}}>{protectBreaks(name)}</div>
          </Reveal>
          <Reveal page={page} index={1} frame={frame} fallbackAtEnd>
            <div style={{display: 'flex', gap: 12, alignItems: 'center', marginTop: 14, fontFamily: t.fontBody, fontSize: 30, color: t.muted}}>
              <span>{pick(lang, '依据', 'Basis')}</span>
              <b style={{color: t.accent, fontWeight: 700}}>{protectBreaks(basis)}</b>
            </div>
          </Reveal>
        </div>
        <Reveal page={page} index={2} frame={frame} fallbackAtEnd style={{flex: vert ? '0 0 auto' : '1 1 0', width: vert ? '100%' : undefined, minWidth: 0, display: 'flex'}}>
          <Card theme={theme} style={{position: 'relative', flex: 1, height: vert ? undefined : 440, padding: vert ? '18px 20px' : '36px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, fontFamily: t.fontBody, fontWeight: 700, fontSize: 30, color: t.accent, letterSpacing: 1}}>
              <Icon name={textOf(fields.cardIcon)} size={36} color={t.accent} />
            </div>
            <div style={{marginTop: 20, fontFamily: t.fontHeading, fontWeight: 800, fontSize: vert ? 32 : TYPE.bigCard, lineHeight: 1.3, color: t.ink, wordBreak: 'normal'}}>
              {emphasized(cardText, cardEmphasis, {color: t.alert})}
            </div>
            {hasAxis ? <Reveal page={page} index={3} frame={frame} fallbackAtEnd>
              <div style={{marginTop: 36, position: 'relative', height: 88}}>
                <div style={{position: 'absolute', left: 8, right: 8, top: 8, height: 14, border: `2px solid ${t.line}`, borderBottom: 'none'}} />
                <div style={{position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', fontFamily: t.fontNumber, fontWeight: 800, fontSize: 30, color: t.accent, background: t.surface, padding: '0 10px'}}>{protectBreaks(axisSpan)}</div>
                <div style={{position: 'absolute', left: 8, right: 8, top: 36, height: 4, background: t.accent}} />
                <i style={{position: 'absolute', left: 0, top: 26, width: 22, height: 22, borderRadius: 11, background: t.accent}} />
                <i style={{position: 'absolute', right: 0, top: 26, width: 22, height: 22, borderRadius: 11, background: t.surface, border: `4px solid ${t.accent}`, boxSizing: 'border-box'}} />
                <span style={{position: 'absolute', left: 0, top: 56, fontSize: 30, color: t.accent, fontWeight: 700}}>{protectBreaks(axisFrom)}</span>
                <span style={{position: 'absolute', right: 0, top: 56, fontSize: 30, color: t.muted}}>{protectBreaks(axisTo)}</span>
              </div>
            </Reveal> : null}
          </Card>
        </Reveal>
      </div>
    </PageBody>
  </ContentFrame>;
};
