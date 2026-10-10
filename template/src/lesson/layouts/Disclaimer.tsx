import React from 'react';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, colorsOf, protectBreaks, textOf, titleLines} from './shared';

/** 片尾免责。标题由页眉画出，这里只放正文。 */
export const Disclaimer: React.FC<LayoutProps> = ({fields, theme}) => {
  const t = colorsOf(theme);
  const body = textOf(fields.body) || textOf(fields.text);
  const lines = titleLines(body, {maxEm: 26, maxLines: 4, subtitle: true});
  return <ContentFrame>
    <PageBody>
      <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{maxWidth: 1280, textAlign: 'center', fontFamily: t.fontBody, fontWeight: 700, fontSize: 42, lineHeight: 1.5, color: t.ink}}>
          {lines.map((line, index) => <div key={index}>{protectBreaks(line, {subtitle: true})}</div>)}
        </div>
      </div>
    </PageBody>
  </ContentFrame>;
};
