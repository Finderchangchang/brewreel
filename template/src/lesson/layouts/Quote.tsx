import React from 'react';
import {fitBlockFont, quoteBlockSize, TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {ContentFrame, textOf, useBlockWidth, useFrame, useOrientation} from './shared';
import {LawCard} from './pro';

export const Quote: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const quote = textOf(fields.quote);
  const source = textOf(fields.source);
  const tag = textOf(fields.tag);
  const tagText = textOf(fields.tagText);
  const wide = quoteBlockSize(quote, source, {width: 1680, tag: Boolean(tag || tagText)}).height;
  const blockW = useBlockWidth(vert ? 0 : wide);
  const size = vert
    ? fitBlockFont({chars: Math.max(1, Array.from(quote).length), width: 640, maxFont: 48, lineHeight: 1.45, maxHeight: 460})
    : TYPE.quote;
  return <ContentFrame>
    <div style={{width: vert ? '100%' : blockW, alignSelf: 'flex-start'}}>
      <LawCard page={page} frame={frame} theme={theme} lang={lang} quote={quote} source={source} emphasis={textOf(fields.emphasis)} tag={tag} tagText={tagText} quoteSize={size} />
    </div>
  </ContentFrame>;
};
