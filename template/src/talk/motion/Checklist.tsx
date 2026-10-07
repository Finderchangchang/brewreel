// checklist：清单。一条一张卡，用满取景框（竖长的 pip / full 框行高按条数分满，字号 108–126 参考像素）；
// 说到哪一条，那一条从下方 40 像素@720 滑上来、淡入、回弹一下（0.22 秒），随后勾选框上色、画一道勾。
// 没说到的条目隐形预留版位，不画虚线框、灰条之类的骨架。小标题（槽位 title，原话）是一枚胶囊。字全部出自原句。
import React from 'react';
import {Easing} from 'remotion';
import {blend, rgba, shapeColors, type MotionPalette} from './palette';
import {Card, Check, Pill, fitFont, listGeom, prog, quietFloat, riseIn, springAt} from './parts';
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
  const ink = pal.look === 'ink';
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, ...quietFloat(t, H)}}>
      {data.title ? (
        <div style={{position: 'absolute', left: g.x0, top: g.y0, height: g.titleH, display: 'flex', alignItems: 'center', opacity: Math.min(1, titleP * 1.6), transform: `translateY(${(1 - titleP) * -24}px) rotate(${ink ? -1.5 : -1}deg)`, transformOrigin: '0 50%'}}>
          <Pill text={data.title} size={Math.min(titleSize, fitFont(data.title, g.contentW * 0.8 - titleSize * 2, titleSize, 30))} bg={pal.accent} color={pal.ink} pal={pal} />
        </div>
      ) : null}
      {items.map((text, i) => {
        const r = riseIn(t, at[i]);
        if (!r.on) return null;
        const y = g.rowsTop + i * (g.rh + g.gap);
        const rh = g.rh;
        const padL = Math.min(rh * 0.22, 56);
        const cb = Math.min(rh * 0.5, 120);
        const textX = padL + cb + Math.min(rh * 0.2, 44);
        const textW = g.contentW - textX - padL;
        const font = Math.min(g.tall ? 126 : rh * 0.47, fitFont(text, textW, 140, 36));
        const checkAt = Math.min(at[i] + 0.3, Math.max(at[i], dur - LAST_BEFORE_END));
        const ck = springAt(t, checkAt, 11, 220);
        const draw = prog(t, checkAt + 0.04, 0.26, Easing.out(Easing.quad));
        const fill = colors[i % colors.length];
        const bw = Math.max(4, cb * 0.07);
        return (
          <div key={i} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: r.opacity, transform: `translateY(${r.y}px) scale(${r.scale})`, transformOrigin: `${g.x0 + g.contentW / 2}px ${y + rh / 2}px`}}>
            <Card pal={pal} x={g.x0} y={y} w={g.contentW} h={rh} index={i}>
              <div
                style={{
                  position: 'absolute',
                  left: padL,
                  top: (rh - cb) / 2,
                  width: cb,
                  height: cb,
                  boxSizing: 'border-box',
                  borderRadius: pal.look === 'clay' ? cb * 0.36 : ink ? cb * 0.12 : cb * 0.22,
                  border: `${bw}px solid ${ink ? pal.ink : rgba(pal.sub, 0.45)}`,
                  background: ink ? '#FFFFFF' : rgba(pal.bg, 0.6),
                }}
              >
                {ck > 0 && !ink ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: -bw,
                      borderRadius: 'inherit',
                      background: fill,
                      boxShadow: pal.look === 'wood' ? `0 ${cb * 0.08}px 0 ${blend(fill, '#3B2410', 0.28)}` : `0 ${cb * 0.06}px ${cb * 0.12}px ${rgba('#000000', 0.15)}`,
                      boxSizing: 'border-box',
                      transform: `scale(${0.4 + 0.6 * ck})`,
                      opacity: Math.min(1, ck * 2),
                    }}
                  />
                ) : null}
                <div style={{position: 'absolute', left: (cb - 2 * bw - cb * 0.78) / 2 + cb * 0.03, top: (cb - 2 * bw - cb * 0.78) / 2 - cb * 0.03, width: cb * 0.78, height: cb * 0.78}}>
                  <Check p={draw} size={cb * 0.78} color={pal.ink} stroke={10} />
                </div>
              </div>
              <div style={{position: 'absolute', left: textX, top: 0, height: rh, width: textW, display: 'flex', alignItems: 'center', fontSize: font, fontWeight: 900, color: pal.ink, whiteSpace: 'nowrap', lineHeight: 1.1}}>{text}</div>
            </Card>
          </div>
        );
      })}
    </div>
  );
};
