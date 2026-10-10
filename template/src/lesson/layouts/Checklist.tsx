import React from 'react';
import {TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {Card, ContentFrame, PageBody, colorsOf, focusRank, listOf, pick, protectBreaks, useBlockWidth, useFrame, useOrientation} from './shared';
import {Icon} from './pro';

export const Checklist: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const items = listOf(fields.items);
  const cols = vert ? 1 : 2;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const progressH = 72;
  const gap = vert ? 10 : 26;
  const naturalRow = vert ? 72 : 142;
  const natural = progressH + rows * naturalRow + Math.max(0, rows - 1) * gap;
  const limit = vert ? 900 : 580;
  const rowH = natural <= limit ? naturalRow : Math.max(vert ? 56 : 80, Math.floor((limit - progressH - Math.max(0, rows - 1) * gap) / rows));
  const blockH = progressH + rows * rowH + Math.max(0, rows - 1) * gap;
  const blockW = useBlockWidth(vert ? 0 : blockH);
  const checked = items.filter((_, index) => focusRank(page, frame, index) !== 'next').length;
  const ratio = items.length ? checked / items.length : 0;
  const box = vert ? 48 : TYPE.checkBox;
  return <ContentFrame>
    <PageBody>
      <div style={{width: vert ? '100%' : blockW, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'flex-start'}}>
        <div style={{flex: '0 0 auto', height: progressH, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16}}>
          <span style={{fontFamily: t.fontBody, fontSize: 30, color: t.muted}}>{pick(lang, '已核对', 'Checked')}</span>
          <span style={{fontFamily: t.fontNumber, fontWeight: 800, fontSize: vert ? 42 : TYPE.checkNum, lineHeight: 1, color: t.accent}}>{checked}<small style={{fontSize: 30, color: t.muted, fontWeight: 700}}> / {items.length}</small></span>
          <span style={{width: 180, height: 10, borderRadius: 5, background: t.line, overflow: 'hidden'}}>
            <i style={{display: 'block', width: `${Math.round(ratio * 100)}%`, height: '100%', background: t.ok}} />
          </span>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: cols === 2 ? '1fr 1fr' : '1fr', gridTemplateRows: `repeat(${rows}, ${rowH}px)`, gridAutoFlow: 'column', gap}}>
          {items.map((item, index) => {
            const rank = focusRank(page, frame, index);
            const on = rank !== 'next';
            return <Card key={index} theme={theme} shadow={on} style={{height: rowH, display: 'flex', alignItems: 'center', gap: 16, padding: vert ? '0 16px' : '0 22px', border: on ? t.cardBorder : `2px dashed ${t.line}`, background: on ? t.surface : 'transparent', opacity: on ? 1 : 0.55, overflow: 'hidden'}}>
              <span style={{width: box, height: box, flex: '0 0 auto', borderRadius: t.radius, border: `4px solid ${on ? t.ok : t.muted}`, background: on ? t.ok : t.surface, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                {on ? <Icon name="check" size={vert ? 28 : 36} color="#FFFFFF" /> : null}
              </span>
              <span style={{flex: 1, minWidth: 0, fontFamily: t.fontBody, fontWeight: 700, fontSize: vert ? 30 : TYPE.checkItem, lineHeight: 1.2, color: on ? t.ink : t.muted, wordBreak: 'normal'}}>{protectBreaks(item)}</span>
              <span style={{fontFamily: t.fontNumber, fontWeight: 800, fontSize: vert ? 32 : TYPE.checkIndex, color: t.line}}>{String(index + 1).padStart(2, '0')}</span>
            </Card>;
          })}
        </div>
      </div>
    </PageBody>
  </ContentFrame>;
};
