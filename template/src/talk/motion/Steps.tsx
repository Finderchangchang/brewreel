// steps：步骤。一步一行排成往右下走的台阶：左边一块积木（点数表示第几步，不写数字），右边一张卡写这一步（原话）。
// 说到第几步：一颗小球顺着连线从上一块滚到这一块，积木上色弹一下，卡片滑进来、当前这一步描重点色边；全部说完，每块积木弹出一个勾。
// 没说到的步骤先是虚线空位。字全部出自原句。
import React from 'react';
import {Easing} from 'remotion';
import {blend, rgba, shapeColors, type MotionPalette} from './palette';
import {Card, Check, Pips, bump, fitFont, listGeom, prog, springAt} from './parts';
import {doneTime, revealTimes} from './timing';
import type {ListMarks, StepsData} from './types';

export const Steps: React.FC<{data: StepsData; marks: ListMarks; t: number; dur: number; W: number; H: number; pal: MotionPalette}> = ({data, marks, t, dur, W, H, pal}) => {
  const items = (data.items ?? []).slice(0, 4);
  const n = items.length;
  if (!n) return null;
  const g = listGeom(n, W, H, false);
  const rh = g.rh;
  const ind = n > 1 ? Math.min(g.contentW * 0.065, 60) : 0;
  const rowW = g.contentW - ind * (n - 1);
  const nd = rh * 0.68;
  const gapN = rh * 0.16;
  const cardW = rowW - nd - gapN;
  const at = revealTimes(marks.items, n, dur);
  const done = doneTime(at, marks.itemsEnd, dur);
  const colors = shapeColors(pal);
  let cur = -1;
  at.forEach((a, i) => {
    if (t >= a) cur = i;
  });
  const allDone = t >= done;
  const rowX = (i: number) => g.x0 + i * ind;
  const rowY = (i: number) => g.rowsTop + i * (rh + g.gap);
  const nodeC = (i: number) => ({x: rowX(i) + nd / 2, y: rowY(i) + rh / 2});
  const lineW = Math.max(8, rh * 0.06);
  const travel = 0.32;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
      {/* 连线：底线 + 走过的那一截 + 正在滚的小球 */}
      {items.slice(1).map((_, k) => {
        const i = k + 1;
        const a = nodeC(i - 1);
        const b = nodeC(i);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const q = prog(t, at[i] - travel, travel, Easing.inOut(Easing.cubic));
        const moving = q > 0 && q < 1;
        return (
          <React.Fragment key={`l${i}`}>
            <div style={{position: 'absolute', left: a.x, top: a.y - lineW / 2, width: len, height: lineW, borderRadius: lineW / 2, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`, background: rgba(pal.sub, 0.22)}} />
            <div style={{position: 'absolute', left: a.x, top: a.y - lineW / 2, width: len * q, height: lineW, borderRadius: lineW / 2, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`, background: pal.accent}} />
            {moving ? (
              <div
                style={{
                  position: 'absolute',
                  left: a.x + (b.x - a.x) * q - lineW * 1.6,
                  top: a.y + (b.y - a.y) * q - lineW * 1.6,
                  width: lineW * 3.2,
                  height: lineW * 3.2,
                  borderRadius: '50%',
                  background: pal.accent,
                  border: `${lineW * 0.5}px solid ${pal.card}`,
                  boxSizing: 'border-box',
                  boxShadow: `0 0 0 ${lineW * 0.6}px ${rgba(pal.accent, 0.35)}`,
                  zIndex: 2,
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
      {items.map((text, i) => {
        const x = rowX(i);
        const y = rowY(i);
        const on = t >= at[i];
        const p = springAt(t, at[i], 12, 200);
        const hit = bump(t, at[i] + 0.08, 0.4);
        const fill = colors[i % colors.length];
        const active = i === cur && !allDone;
        const cp = springAt(t, done + i * 0.07, 11, 220);
        const draw = prog(t, done + i * 0.07 + 0.05, 0.25, Easing.out(Easing.quad));
        const pad = rh * 0.26;
        const font = Math.min(rh * 0.46, fitFont(text, cardW - pad * 2, 140, 36));
        const nodeR = pal.look === 'clay' ? nd * 0.34 : pal.look === 'ink' ? nd * 0.14 : pal.look === 'paper' ? nd * 0.1 : nd * 0.2;
        const cardX = x + nd + gapN;
        return (
          <React.Fragment key={i}>
            {/* 积木：虚线空位 → 上色弹出 */}
            <div style={{position: 'absolute', left: x, top: y + (rh - nd) / 2, width: nd, height: nd, zIndex: 1}}>
              {!on || p < 0.5 ? (
                <div style={{position: 'absolute', inset: 0, borderRadius: nodeR, border: `4px dashed ${rgba(pal.look === 'ink' ? pal.ink : pal.sub, 0.35)}`, background: rgba(pal.card, 0.3), boxSizing: 'border-box', opacity: on ? 1 - p * 2 : 1}}>
                  <Pips n={i + 1} size={nd} color={rgba(pal.sub, 0.22)} />
                </div>
              ) : null}
              {on ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: nodeR,
                    background: fill,
                    border: pal.look === 'ink' ? `4px solid ${pal.ink}` : 'none',
                    boxSizing: 'border-box',
                    boxShadow:
                      pal.look === 'ink'
                        ? `5px 5px 0 ${pal.ink}`
                        : pal.look === 'paper'
                          ? `0 6px 12px ${rgba('#3A3020', 0.2)}`
                          : `inset 0 3px 0 rgba(255,255,255,0.35), 0 ${nd * 0.07}px 0 ${blend(fill, '#3B2410', 0.28)}, 0 ${nd * 0.12}px ${nd * 0.16}px ${rgba('#4A3218', 0.18)}`,
                    opacity: Math.min(1, p * 2),
                    transform: `scale(${(0.55 + 0.45 * p) * (1 + 0.12 * hit)})`,
                  }}
                >
                  <Pips n={i + 1} size={nd} color={pal.look === 'ink' ? pal.ink : blend(pal.ink, fill, 0.15)} />
                </div>
              ) : null}
              {cp > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    right: -nd * 0.2,
                    top: -nd * 0.2,
                    width: nd * 0.5,
                    height: nd * 0.5,
                    borderRadius: '50%',
                    background: pal.good,
                    border: `${Math.max(3, nd * 0.05)}px solid ${pal.card}`,
                    boxSizing: 'border-box',
                    boxShadow: `0 ${nd * 0.04}px ${nd * 0.08}px ${rgba('#000000', 0.18)}`,
                    transform: `scale(${cp})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check p={draw} size={nd * 0.3} color="#FFFFFF" stroke={11} />
                </div>
              ) : null}
            </div>
            {/* 卡片：虚线空位 → 滑进来，当前这一步描重点色边 */}
            {on ? (
              <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: Math.min(1, p * 1.8), transform: `translateX(${(1 - p) * 70}px)`}}>
                <Card pal={pal} x={cardX} y={y} w={cardW} h={rh} index={i} tone={active ? 'hot' : 'normal'}>
                  <div style={{position: 'absolute', left: pad, top: 0, height: '100%', width: cardW - pad * 2, display: 'flex', alignItems: 'center', fontSize: font, fontWeight: 900, color: pal.ink, whiteSpace: 'nowrap', lineHeight: 1.1}}>{text}</div>
                </Card>
              </div>
            ) : (
              <Card pal={pal} x={cardX} y={y} w={cardW} h={rh} index={i} tone="ghost">
                <div style={{position: 'absolute', left: pad, top: rh / 2 - font * 0.18, width: Math.min(cardW - pad * 2, font * Math.max(2, Array.from(text).length) * 0.9), height: font * 0.36, borderRadius: font * 0.18, background: rgba(pal.sub, 0.14)}} />
              </Card>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
