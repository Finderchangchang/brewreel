// steps：步骤。一步一行排成往右下走的台阶：左边一块积木（点数表示第几步，不写数字），右边一张卡写这一步（原话）。
// 说到第几步：一颗小球顺着连线从上一块滚到这一块，积木上色弹一下，卡片从下方滑上来；当前这一步卡片描 4 像素@720 的重点色边、放大到 1.04 倍。
// 每一步在下一步开口时打勾（徽章 0.2 秒弹出），最后一步在说完和「结束前 0.7 秒」里取早的那个打勾，来不及就不打。
// 没说到的步骤隐形预留版位，不画虚线、灰条、灰积木。字全部出自原句。
import React from 'react';
import {Easing, interpolate} from 'remotion';
import {blend, rgba, shapeColors, type MotionPalette} from './palette';
import {Card, DoneBadge, Pips, bump, fitFont, listGeom, prog, quietFloat, riseIn, springAt} from './parts';
import {doneTime, revealTimes, stepCheckTimes} from './timing';
import type {ListMarks, StepsData} from './types';

export const Steps: React.FC<{data: StepsData; marks: ListMarks; t: number; dur: number; W: number; H: number; pal: MotionPalette}> = ({data, marks, t, dur, W, H, pal}) => {
  const items = (data.items ?? []).slice(0, 4);
  const n = items.length;
  if (!n) return null;
  const g = listGeom(n, W, H, false);
  const rh = g.rh;
  const ind = n > 1 ? Math.min(g.contentW * 0.065, 60) : 0;
  const rowW = g.contentW - ind * (n - 1);
  const nd = Math.min(rh * 0.66, 200);
  const gapN = Math.min(rh * 0.16, 40);
  const cardW = rowW - nd - gapN;
  const at = revealTimes(marks.items, n, dur);
  const done = doneTime(at, marks.itemsEnd, dur);
  const checks = stepCheckTimes(at, done, dur);
  const colors = shapeColors(pal);
  const ink = pal.look === 'ink';
  let cur = -1;
  at.forEach((a, i) => {
    if (t >= a) cur = i;
  });
  const rowX = (i: number) => g.x0 + i * ind;
  const rowY = (i: number) => g.rowsTop + i * (rh + g.gap);
  const nodeC = (i: number) => ({x: rowX(i) + nd / 2, y: rowY(i) + rh / 2});
  const lineW = Math.max(8, Math.min(16, rh * 0.06));
  const travel = 0.32;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, ...quietFloat(t, H)}}>
      {/* 连线：只画走过的那一截 + 正在滚的小球（还没轮到的那一段不画） */}
      {items.slice(1).map((_, k) => {
        const i = k + 1;
        const a = nodeC(i - 1);
        const b = nodeC(i);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const q = prog(t, at[i] - travel, travel, Easing.inOut(Easing.cubic));
        if (q <= 0) return null;
        const moving = q < 1;
        return (
          <React.Fragment key={`l${i}`}>
            <div style={{position: 'absolute', left: a.x, top: a.y - lineW / 2, width: len * q, height: lineW, borderRadius: lineW / 2, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`, background: ink ? pal.ink : pal.accent}} />
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
                  border: `${lineW * 0.5}px solid ${ink ? pal.ink : pal.card}`,
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
        const r = riseIn(t, at[i]);
        if (!r.on) return null;
        const x = rowX(i);
        const y = rowY(i);
        const p = springAt(t, at[i], 12, 200);
        const hit = bump(t, at[i] + 0.08, 0.4);
        const fill = ink ? (i === cur ? pal.accent : '#FFFFFF') : colors[i % colors.length];
        const active = i === cur && (checks[i] == null || t < (checks[i] as number));
        const pad = Math.min(rh * 0.26, 64);
        const font = Math.min(g.tall ? 126 : rh * 0.46, fitFont(text, cardW - pad * 2 - 12, 140, 36));
        const nodeR = pal.look === 'clay' ? nd * 0.34 : ink ? nd * 0.14 : pal.look === 'paper' ? nd * 0.1 : nd * 0.2;
        const cardX = x + nd + gapN;
        const act = interpolate(t - at[i], [0.2, 0.4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const grow = active ? 1 + 0.04 * act : 1;
        const bs = nd * 0.5;
        return (
          <React.Fragment key={i}>
            {/* 积木：上色弹出 */}
            <div style={{position: 'absolute', left: x, top: y + (rh - nd) / 2, width: nd, height: nd, zIndex: 1}}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: nodeR,
                  background: fill,
                  border: ink ? `4px solid ${pal.ink}` : 'none',
                  boxSizing: 'border-box',
                  boxShadow: ink
                    ? `5px 5px 0 ${pal.ink}`
                    : pal.look === 'paper'
                      ? `0 6px 12px ${rgba('#3A3020', 0.2)}`
                      : `inset 0 3px 0 rgba(255,255,255,0.35), 0 ${nd * 0.07}px 0 ${blend(fill, '#3B2410', 0.28)}, 0 ${nd * 0.12}px ${nd * 0.16}px ${rgba('#4A3218', 0.18)}`,
                  opacity: Math.min(1, p * 2),
                  transform: `scale(${(0.55 + 0.45 * p) * (1 + 0.12 * hit)})`,
                }}
              >
                <Pips n={i + 1} size={nd} color={ink ? pal.ink : blend(pal.ink, fill, 0.15)} />
              </div>
              {checks[i] != null ? (
                <div style={{position: 'absolute', right: -bs * 0.4, top: -bs * 0.4, width: bs, height: bs}}>
                  <DoneBadge pal={pal} t={t} at={checks[i] as number} size={bs} />
                </div>
              ) : null}
            </div>
            {/* 卡片：从下方滑上来；当前这一步描重点色边、放大一点 */}
            <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: r.opacity, transform: `translateY(${r.y}px) scale(${r.scale * grow})`, transformOrigin: `${cardX + cardW / 2}px ${y + rh / 2}px`}}>
              <Card pal={pal} x={cardX} y={y} w={cardW} h={rh} index={i} tone={active ? 'hot' : 'normal'}>
                <div style={{position: 'absolute', left: pad, top: 0, height: '100%', width: cardW - pad * 2, display: 'flex', alignItems: 'center', fontSize: font, fontWeight: 900, color: pal.ink, whiteSpace: 'nowrap', lineHeight: 1.1}}>{text}</div>
              </Card>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
