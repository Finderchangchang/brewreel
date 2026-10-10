import React from 'react';
import {TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, Reveal, colorsOf, protectBreaks, showFor, textOf, useBlockWidth, useFrame, useOrientation} from './shared';
import {Icon, LawCard, timelineCaptions, timelineNodes, timelineSegments, toneOf} from './pro';

export const Timeline: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const nodes = timelineNodes(fields.nodes);
  const segments = timelineSegments(fields.segments);
  const captions = timelineCaptions(fields.captions);
  const quote = textOf(fields.quote);
  const cardW = useBlockWidth(quote ? 400 : 0, 590);
  const open = (index: number) => showFor(page, index, frame, vert && index === 0, true) > 0.02 || (!vert && index === 0);
  return <ContentFrame>
    <PageBody>
      <div style={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16}}>
        <div style={{flex: vert ? '1 1 46%' : '0 0 auto', width: '100%', height: vert ? undefined : 280, minHeight: vert ? 160 : 280, position: 'relative'}}>
          {vert ? <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
            {nodes.map((label, index) => {
              const seg = segments[index - 1];
              const cap = captions[index] ?? captions[index - 1];
              const seen = open(index);
              return <React.Fragment key={index}>
                {index > 0 ? <div style={{flex: '1 1 auto', minHeight: 8, marginLeft: 16, borderLeft: seg?.tone === 'alert' ? `4px dashed ${t.alert}` : `8px solid ${t.accent}`, opacity: seen ? 1 : 0.35, display: 'flex', alignItems: 'center', paddingLeft: 16, fontFamily: t.fontHeading, fontWeight: 800, fontSize: 30, color: seg?.tone === 'alert' ? t.alert : t.accent}}>{seg ? protectBreaks(seg.label) : ''}</div> : null}
                <div style={{display: 'flex', alignItems: 'center', gap: 14, opacity: seen ? 1 : 0.35}}>
                  <span style={{width: 28, height: 28, borderRadius: 14, background: t.surface, border: `6px solid ${seg?.tone === 'alert' ? t.alert : t.accent}`, flex: '0 0 auto'}} />
                  <div style={{fontFamily: t.fontHeading, fontWeight: 800, fontSize: 32, color: t.ink}}>{protectBreaks(label)}</div>
                  {cap && index < captions.length ? <div style={{display: 'flex', alignItems: 'center', gap: 8, color: toneOf(theme, index === 0 ? 'neutral' : 'alert'), fontFamily: t.fontHeading, fontWeight: 800, fontSize: 30}}>
                    <Icon name={cap.icon} size={32} color="currentColor" />
                    {protectBreaks(cap.text)}
                  </div> : null}
                </div>
              </React.Fragment>;
            })}
          </div> : <div style={{position: 'absolute', inset: 0}}>
            {nodes.map((label, index) => {
              const pad = 10;
              const span = 80;
              const left = nodes.length === 1 ? 50 : pad + (index / (nodes.length - 1)) * span;
              const seg = segments[index];
              const nextLeft = nodes.length === 1 ? 90 : pad + ((index + 1) / (nodes.length - 1)) * span;
              const seen = open(index);
              const cap = captions[index];
              return <React.Fragment key={label + index}>
                {seg && index < nodes.length - 1 ? <div style={{position: 'absolute', left: `${left}%`, width: `${nextLeft - left}%`, top: 78, height: 48, opacity: open(index + 1) ? 1 : 0.4}}>
                  {seg.tone === 'alert'
                    ? <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.alert, fontFamily: t.fontHeading, fontWeight: 800, fontSize: 44}}>
                      <span style={{borderTop: `4px dashed ${t.alert}`, flex: 1, marginRight: 8}} />
                      {protectBreaks(seg.label)}
                      <span style={{marginLeft: 8}}>→</span>
                    </div>
                    : <div style={{height: '100%', borderRadius: 24, background: t.accent, color: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.fontHeading, fontWeight: 800, fontSize: TYPE.timelineSeg}}>{protectBreaks(seg.label)}</div>}
                </div> : null}
                {cap ? <div style={{position: 'absolute', left: `${left}%`, width: `${Math.max(12, nextLeft - left)}%`, top: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: seg?.tone === 'alert' ? t.alert : t.accent, fontFamily: t.fontHeading, fontWeight: 800, fontSize: 34, opacity: seen ? 1 : 0.4}}>
                  <Icon name={cap.icon} size={36} color="currentColor" />
                  {protectBreaks(cap.text)}
                </div> : null}
                <div style={{position: 'absolute', left: `${left}%`, top: 86, width: 28, height: 28, marginLeft: -14, borderRadius: 14, background: t.surface, border: `7px solid ${index > 0 && segments[index - 1]?.tone === 'alert' ? t.alert : t.accent}`, opacity: seen ? 1 : 0.35, zIndex: 1}} />
                <div style={{position: 'absolute', left: `${left}%`, top: 140, width: 220, marginLeft: -110, textAlign: 'center', fontFamily: t.fontHeading, fontWeight: 800, fontSize: TYPE.timelineNode, color: t.ink, opacity: seen ? 1 : 0.35, wordBreak: 'normal'}}>{protectBreaks(label)}</div>
              </React.Fragment>;
            })}
          </div>}
        </div>
        {quote ? <Reveal page={page} index={nodes.length} frame={frame} fallbackAtEnd style={{width: vert ? '100%' : cardW, flex: '0 0 auto'}}>
          <LawCard page={page} frame={frame} theme={theme} lang={lang} quote={quote} source={textOf(fields.source)} emphasis={textOf(fields.emphasis)} bundleIndex={nodes.length} compact quoteSize={vert ? 32 : TYPE.timelineQuote} />
        </Reveal> : null}
      </div>
    </PageBody>
  </ContentFrame>;
};
