import React from 'react';
import {fitBlockFont, TYPE} from '../stage.mjs';
import {verticalContentBox} from '../../../../scripts/lesson/vertical-layout.mjs';
import type {LayoutProps} from './shared';
import {ContentFrame, PageBody, Reveal, colorsOf, listOf, pick, protectBreaks, textOf, useBlockWidth, useCanvas, useFrame, useOrientation, usePageReserve} from './shared';
import {PropPaper} from './pro';

export const Statement: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const canvas = useCanvas();
  const reserve = usePageReserve();
  const t = colorsOf(theme);
  const lines = listOf(fields.lines);
  const propLines = listOf(fields.propLines);
  const alertLast = fields.alertLast === true;
  const longest = Math.max(1, ...lines.map((line) => Array.from(line).length));
  const size = vert
    ? fitBlockFont({chars: longest, width: 680, maxFont: 64, lineHeight: 1.25, maxHeight: 220})
    : TYPE.statement;
  const circle = typeof fields.circle === 'number' ? fields.circle : 0;
  const paperTop = canvas.brandBug ? 168 : 148;
  const paperMax = Math.min(650, Math.max(240, reserve.y - paperTop - 24));
  const vBox = verticalContentBox(canvas.pageLayout || 'statement', canvas.presenter, {
    sampleReview: canvas.sampleReview,
    topReserve: canvas.topReserve,
    showHook: canvas.showHook,
    hookBottom: canvas.hookBottom,
    frame: canvas.clipFrame,
    fps: canvas.fps,
    pageFrame: canvas.pageFrame,
    prevLayout: canvas.prevLayout,
    brandBug: canvas.brandBug === true,
  });
  const leftH = lines.length * size * 1.25 + 16 + 36;
  const vChrome = 14 + 12 + 40 * 1.2 + 8 + 26 * 1.3 + 4;
  const vBudget = Math.max(160, vBox.height - leftH - 12 - 24);
  const rowH = vert
    ? Math.max(30, Math.min(44, Math.floor((vBudget - vChrome) / Math.max(1, propLines.length))))
    : Math.min(70, Math.max(48, Math.floor((paperMax - (TYPE.propTitle + 12 + 72 + 48)) / Math.max(1, propLines.length))));
  const leftW = Math.min(800, useBlockWidth(vert ? 0 : 460));
  const left = <div style={{width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 16}}>
    <Reveal page={page} index={0} frame={frame} fallbackAtEnd>
      <div style={{fontFamily: t.fontHeading, fontWeight: 800, fontSize: size, lineHeight: vert ? 1.25 : 1.3, color: t.ink}}>
        {lines.map((line, index) => <div key={index} style={{color: alertLast && index === lines.length - 1 ? t.alert : t.ink}}>{protectBreaks(line)}</div>)}
      </div>
    </Reveal>
    <Reveal page={page} index={1} frame={frame} fallbackAtEnd>
      <div style={{display: 'flex', gap: 12, alignItems: 'center', fontFamily: t.fontBody, fontSize: TYPE.statementBasis, color: t.muted}}>
        <span>{pick(lang, '依据', 'Basis')}</span>
        <b style={{color: t.accent, fontWeight: 700}}>{protectBreaks(textOf(fields.basis))}</b>
      </div>
    </Reveal>
  </div>;
  const paper = <PropPaper theme={theme} kind={textOf(fields.prop)} title={textOf(fields.propTitle)} lines={propLines} circle={circle} annotation={textOf(fields.annotation)} lineH={rowH} />;
  if (vert) {
    return <ContentFrame>
      <PageBody>
        <div style={{width: '100%', display: 'flex', flexDirection: 'column', gap: 12}}>
          {left}
          <Reveal page={page} index={2} frame={frame} fallbackAtEnd>
            {paper}
          </Reveal>
        </div>
      </PageBody>
    </ContentFrame>;
  }
  return <>
    <ContentFrame>
      <PageBody>
        <div style={{width: leftW}}>{left}</div>
      </PageBody>
    </ContentFrame>
    <Reveal page={page} index={2} frame={frame} fallbackAtEnd style={{position: 'absolute', left: 960, top: paperTop, width: 640, height: paperMax, zIndex: 2, overflow: 'hidden'}}>
      {paper}
    </Reveal>
  </>;
};
