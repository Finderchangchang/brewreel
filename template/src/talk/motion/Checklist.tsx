// checklist：清单。一条一张卡，用满取景框；说到哪一条，那一条从左边滑进来，随后勾选框上色、画一道勾。
// 没说到的条目先是虚线空位（第 0 帧就看得出一共几条）。小标题（槽位 title，原话）是一枚胶囊。字全部出自原句。
import React from 'react';
import {Easing} from 'remotion';
import {blend, rgba, shapeColors, type MotionPalette} from './palette';
import {Card, Check, Pill, fitFont, listGeom, prog, springAt} from './parts';
import {LAST_BEFORE_END, revealTimes} from './timing';
import type {ChecklistData, ListMarks} from './types';

export const Checklist: React.FC<{data: ChecklistData; marks: ListMarks; t: number; dur: number; W: number; H: number; pal: MotionPalette}> = ({data, marks, t, dur, W, H, pal}) => {
  const items = (data.items ?? []).slice(0, 4);
  const n = items.length;
  if (!n) return null;
  const g = listGeom(n, W, H, !!data.title);
  const at = revealTimes(marks.items, n, dur);
  const colors = shapeColors(pal);
  const titleP = springAt(t, 0, 14, 170);
  const titleSize = g.titleH / 1.7;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
      {data.title ? (
        <div style={{position: 'absolute', left: g.x0, top: g.y0, height: g.titleH, display: 'flex', alignItems: 'center', opacity: Math.min(1, titleP * 1.6), transform: `translateY(${(1 - titleP) * -24}px) rotate(${pal.look === 'ink' ? -1.5 : -1}deg)`, transformOrigin: '0 50%'}}>
          <Pill text={data.title} size={Math.min(titleSize, fitFont(data.title, g.contentW * 0.8 - titleSize * 2, titleSize, 30))} bg={pal.accent} color={pal.ink} pal={pal} />
        </div>
      ) : null}
      {items.map((text, i) => {
        const y = g.rowsTop + i * (g.rh + g.gap);
        const rh = g.rh;
        const padL = rh * 0.22;
        const cb = rh * 0.52;
        const textX = padL + cb + rh * 0.2;
        const textW = g.contentW - textX - padL;
        const font = Math.min(rh * 0.47, fitFont(text, textW, 140, 36));
        const p = springAt(t, at[i], 14, 170);
        const shown = t >= at[i];
        const checkAt = Math.min(Math.max(at[i] + 0.3, at[i]), Math.max(at[i], dur - LAST_BEFORE_END));
        const ck = springAt(t, checkAt, 11, 220);
        const draw = prog(t, checkAt + 0.04, 0.26, Easing.out(Easing.quad));
        const fill = colors[i % colors.length];
        const box = (
          <div
            style={{
              position: 'absolute',
              left: padL,
              top: (rh - cb) / 2,
              width: cb,
              height: cb,
              boxSizing: 'border-box',
              borderRadius: pal.look === 'clay' ? cb * 0.36 : pal.look === 'ink' ? cb * 0.12 : cb * 0.22,
              border: `${Math.max(4, cb * 0.07)}px solid ${pal.look === 'ink' ? pal.ink : rgba(pal.sub, 0.45)}`,
              background: pal.look === 'ink' ? pal.card : rgba(pal.bg, 0.6),
            }}
          >
            {ck > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: -Math.max(4, cb * 0.07),
                  borderRadius: 'inherit',
                  background: fill,
                  boxShadow: pal.look === 'wood' ? `0 ${cb * 0.08}px 0 ${blend(fill, '#3B2410', 0.28)}` : pal.look === 'ink' ? 'none' : `0 ${cb * 0.06}px ${cb * 0.12}px ${rgba('#000000', 0.15)}`,
                  border: pal.look === 'ink' ? `${Math.max(4, cb * 0.07)}px solid ${pal.ink}` : 'none',
                  boxSizing: 'border-box',
                  transform: `scale(${0.4 + 0.6 * ck})`,
                  opacity: Math.min(1, ck * 2),
                }}
              />
            ) : null}
            <div style={{position: 'absolute', left: cb * 0.08, top: cb * 0.04, width: cb * 0.84, height: cb * 0.84}}>
              <Check p={draw} size={cb * 0.84} color={pal.ink} stroke={10} />
            </div>
          </div>
        );
        if (!shown) {
          return (
            <Card key={i} pal={pal} x={g.x0} y={y} w={g.contentW} h={rh} tone="ghost" index={i}>
              <div style={{position: 'absolute', left: padL, top: (rh - cb) / 2, width: cb, height: cb, boxSizing: 'border-box', borderRadius: cb * 0.22, border: `4px dashed ${rgba(pal.sub, 0.3)}`}} />
              <div style={{position: 'absolute', left: textX, top: rh / 2 - font * 0.18, width: Math.min(textW, font * Math.max(2, Array.from(text).length) * 0.9), height: font * 0.36, borderRadius: font * 0.18, background: rgba(pal.sub, 0.14)}} />
            </Card>
          );
        }
        return (
          <div key={i} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: Math.min(1, p * 1.8), transform: `translateX(${(1 - p) * -60}px) scale(${0.94 + 0.06 * p})`, transformOrigin: `${g.x0}px ${y + rh / 2}px`}}>
            <Card pal={pal} x={g.x0} y={y} w={g.contentW} h={rh} index={i}>
              {box}
              <div style={{position: 'absolute', left: textX, top: 0, height: rh, width: textW, display: 'flex', alignItems: 'center', fontSize: font, fontWeight: 900, color: pal.ink, whiteSpace: 'nowrap', lineHeight: 1.1}}>{text}</div>
            </Card>
          </div>
        );
      })}
    </div>
  );
};
