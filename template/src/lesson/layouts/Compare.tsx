import React from 'react';
import type {LayoutProps} from './shared';
import {compareHeadings} from '../../../../scripts/lesson/vertical-layout.mjs';
import {TYPE} from '../stage.mjs';
import {KAI} from '../../core/font';
import {Card, ContentFrame, PageBody, Reveal, colorsOf, focusRank, listOf, pick, protectBreaks, textOf, useFrame, useHeadingEmphasis, useOrientation} from './shared';
import {Icon, toneOf} from './pro';

const Column: React.FC<{
  title: string;
  items: string[];
  verdict: string;
  tone: string;
  index: number;
  theme: LayoutProps['theme'];
  page: LayoutProps['page'];
  frame: number;
  titleStyle: React.CSSProperties;
  lang: string;
}> = ({title, items, verdict, tone, index, theme, page, frame, titleStyle, lang}) => {
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const rank = focusRank(page, frame, index);
  const color = toneOf(theme, tone);
  const showVerdict = verdict.trim().length > 0;
  const sample = items[0] ?? '';
  const rest = showVerdict ? items.slice(1) : items;
  const body = vert ? 32 : 34;
  const icon = tone === 'ok' ? 'check' : tone === 'alert' ? 'cross' : 'flag';
  const iconBox = vert ? 64 : TYPE.compareIcon;
  return <Reveal page={page} index={index} frame={frame} fallbackAtEnd style={{flex: '1 1 0', minWidth: 0, height: vert ? undefined : 500, display: 'flex'}}>
    <Card theme={theme} style={{flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', borderTop: `10px solid ${showVerdict ? color : t.accent}`}}>
      <div style={{flex: 1, minHeight: 0, padding: vert ? '16px 18px' : '28px 32px 12px', display: 'flex', flexDirection: 'column', gap: 10}}>
        <div style={{fontFamily: t.fontHeading, fontWeight: 800, fontSize: vert ? 40 : TYPE.compareTitle, lineHeight: 1.2, color: t.ink, ...titleStyle}}>{protectBreaks(title)}</div>
        {showVerdict ? <div style={{display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 16px', background: t.bg, border: `1px solid ${t.line}`, borderRadius: t.radius, fontFamily: KAI, fontSize: 32, color: t.ink}}>
          <span style={{wordBreak: 'normal'}}>{protectBreaks(sample)}</span>
        </div> : null}
        {rest.map((item, i) => <div key={i} style={{fontFamily: t.fontBody, fontWeight: 500, fontSize: body, lineHeight: 1.3, color: rank === 'past' ? t.muted : t.ink, wordBreak: 'normal'}}>{protectBreaks(item)}</div>)}
      </div>
      {showVerdict ? <div style={{minHeight: vert ? 96 : 210, padding: vert ? '12px 18px' : '16px 32px', display: 'flex', alignItems: 'center', gap: 18, background: t.surface, borderTop: `1px solid ${t.line}`}}>
        <span style={{width: iconBox, height: iconBox, borderRadius: '50%', background: color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto'}}>
          <Icon name={icon} size={vert ? 36 : 52} color="#FFFFFF" />
        </span>
        <div>
          <div style={{fontFamily: t.fontBody, fontSize: 30, color: t.muted, letterSpacing: 2}}>{pick(lang, '结果', 'Result')}</div>
          <div style={{fontFamily: t.fontHeading, fontWeight: 800, fontSize: vert ? 36 : TYPE.compareVerdict, lineHeight: 1.15, color}}>{protectBreaks(verdict)}</div>
        </div>
      </div> : null}
    </Card>
  </Reveal>;
};

export const Compare: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const [leftTitle, rightTitle] = compareHeadings(fields, lang);
  const leftEmphasis = useHeadingEmphasis(leftTitle, vert ? 40 : TYPE.compareTitle);
  const rightEmphasis = useHeadingEmphasis(rightTitle, vert ? 40 : TYPE.compareTitle);
  const vs = <div style={{flex: '0 0 auto', width: vert ? '100%' : 108, height: vert ? undefined : 500, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'}}>
    {vert ? null : <div style={{position: 'absolute', top: 24, bottom: 24, width: 2, background: t.line}} />}
    <div style={{width: vert ? 72 : 108, height: vert ? 72 : 108, borderRadius: '50%', background: t.surface, border: t.cardBorder, boxShadow: t.cardShadow !== 'none' ? t.cardShadow : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.fontNumber, fontWeight: 800, fontSize: vert ? 28 : 40, color: t.deco, zIndex: 1}}>VS</div>
  </div>;
  return <ContentFrame>
    <PageBody>
      <div style={{width: '100%', display: 'flex', flexDirection: vert ? 'column' : 'row', gap: vert ? 8 : 0, alignItems: vert ? 'stretch' : 'flex-start'}}>
        <Column title={leftTitle} items={listOf(fields.left)} verdict={textOf(fields.leftVerdict)} tone={textOf(fields.leftTone) || 'neutral'} index={0} theme={theme} page={page} frame={frame} titleStyle={leftEmphasis.style} lang={lang} />
        {vs}
        <Column title={rightTitle} items={listOf(fields.right)} verdict={textOf(fields.rightVerdict)} tone={textOf(fields.rightTone) || 'neutral'} index={1} theme={theme} page={page} frame={frame} titleStyle={rightEmphasis.style} lang={lang} />
      </div>
    </PageBody>
  </ContentFrame>;
};
