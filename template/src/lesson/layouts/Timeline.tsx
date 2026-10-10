import React from 'react';
import {TYPE} from '../stage.mjs';
import {timelineFrameLayout} from '../../../../scripts/lesson/timeline-frame.mjs';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, Reveal, colorsOf, protectBreaks, showFor, textOf, useBlockWidth, useFrame, useOrientation} from './shared';
import {Icon, LawCard, timelineCaptions, timelineNodes, timelineSegments, toneOf} from './pro';

export const Timeline: React.FC<LayoutProps> = ({page, fields, theme, lang, domain}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const nodes = timelineNodes(fields.nodes);
  const segments = timelineSegments(fields.segments);
  const captions = timelineCaptions(fields.captions);
  const quote = textOf(fields.quote);
  const cardW = useBlockWidth(quote ? 400 : 0, 590);
  const open = (index: number) => showFor(page, index, frame, vert && index === 0, true) > 0.02 || (!vert && index === 0);
  const layout = timelineFrameLayout({nodes, segments, captions, hasQuote: Boolean(quote)});
  if (vert) return <ContentFrame>
    <PageBody>
      <div style={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16}}>
        <div style={{flex: '1 1 46%', width: '100%', minHeight: 160, position: 'relative'}}>
          <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
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
          </div>
        </div>
        {quote ? <Reveal page={page} index={nodes.length} frame={frame} fallbackAtEnd style={{width: '100%', flex: '0 0 auto'}}>
          <LawCard page={page} frame={frame} theme={theme} lang={lang} domain={domain} quote={quote} source={textOf(fields.source)} emphasis={textOf(fields.emphasis)} bundleIndex={nodes.length} compact quoteSize={32} />
        </Reveal> : null}
      </div>
    </PageBody>
  </ContentFrame>;
  return <ContentFrame>
    <div style={{position: 'relative', width: '100%', height: '100%'}}>
      {layout.bars.map((bar) => {
        const seen = open(bar.index + 1);
        const color = bar.tone === 'alert' ? t.alert : t.accent;
        return <React.Fragment key={`bar-${bar.index}`}>
          {bar.labelBox ? <div style={{position: 'absolute', left: bar.labelBox.x, top: bar.labelBox.y, width: bar.labelBox.w, height: bar.labelBox.h, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontFamily: t.fontHeading, fontWeight: 800, fontSize: bar.labelBox.font, opacity: seen ? 1 : 0.4, lineHeight: 1.15}}>{protectBreaks(bar.label)}</div> : null}
          <div style={{position: 'absolute', left: bar.x, top: bar.y, width: bar.w, height: bar.h, borderRadius: bar.h / 2, background: bar.tone === 'alert' ? 'transparent' : t.accent, border: bar.tone === 'alert' ? `3px dashed ${t.alert}` : undefined, opacity: seen ? 1 : 0.4, boxSizing: 'border-box'}} />
        </React.Fragment>;
      })}
      {layout.captions.map((cap) => {
        const seen = open(cap.index);
        const seg = segments[cap.index];
        return <div key={`cap-${cap.index}`} style={{position: 'absolute', left: cap.x, top: cap.y, width: cap.w, height: cap.h, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: seg?.tone === 'alert' ? t.alert : t.accent, fontFamily: t.fontHeading, fontWeight: 800, fontSize: cap.font, opacity: seen ? 1 : 0.4, lineHeight: 1.15}}>
          <Icon name={cap.icon} size={Math.round(cap.font)} color="currentColor" />
          {protectBreaks(cap.text)}
        </div>;
      })}
      {layout.nodes.map((node) => {
        const seen = open(node.index);
        const prev = node.index > 0 ? segments[node.index - 1] : null;
        const color = prev?.tone === 'alert' ? t.alert : t.accent;
        return <React.Fragment key={`node-${node.index}`}>
          <div style={{position: 'absolute', left: node.cx - 14, top: node.cy - 14, width: 28, height: 28, borderRadius: 14, background: t.surface, border: `7px solid ${color}`, opacity: seen ? 1 : 0.35, zIndex: 1, boxSizing: 'border-box'}} />
          <div style={{position: 'absolute', left: node.x, top: node.y, width: node.w, height: node.h, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: t.fontHeading, fontWeight: 800, fontSize: node.font, color: t.ink, opacity: seen ? 1 : 0.35, lineHeight: 1.15, wordBreak: 'normal'}}>{protectBreaks(node.text)}</div>
        </React.Fragment>;
      })}
      {quote ? <Reveal page={page} index={nodes.length} frame={frame} fallbackAtEnd style={{position: 'absolute', left: 0, top: layout.quoteTop, width: cardW}}>
        <LawCard page={page} frame={frame} theme={theme} lang={lang} domain={domain} quote={quote} source={textOf(fields.source)} emphasis={textOf(fields.emphasis)} bundleIndex={nodes.length} compact quoteSize={TYPE.timelineQuote} />
      </Reveal> : null}
    </div>
  </ContentFrame>;
};
