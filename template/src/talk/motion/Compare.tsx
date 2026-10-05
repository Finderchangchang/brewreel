// compare：对比。竖着的取景框（竖版 split / pip）上下两张大卡、中间一个往下的箭头；横版左右两栏、中间往右的箭头。
// 先说的旧做法在上（左），后说的新做法在下（右）。说到新做法时：箭头画出来，新卡片弹进来、描重点色边、弹出一个勾，
// 旧卡片退一步变淡（labels 是 wrong-right 时再画一个叉）。栏标题是脚本按 labels 给的固定词，其余的字全部出自原句。
// verdict（可选，原话）最后出来，底下扫一道马克笔。
import React from 'react';
import {Easing} from 'remotion';
import {blend, rgba, type MotionPalette} from './palette';
import {Card, Check, Cross, MarkerSwipe, Pill, fitFont, prog, springAt} from './parts';
import {LEAD, revealTimes} from './timing';
import type {CompareData, CompareMarks} from './types';

type Box = {x: number; y: number; w: number; h: number};

/** 一栏：标题胶囊 + 1–2 条原话 */
const Column: React.FC<{
  pal: MotionPalette;
  box: Box;
  title: string;
  items: string[];
  at: number[];
  t: number;
  tone: 'normal' | 'hot' | 'dim';
  index: number;
  font: number;
  titleSize: number;
  titleBg: string;
}> = ({pal, box, title, items, at, t, tone, index, font, titleSize, titleBg}) => {
  const padX = Math.max(30, box.w * 0.07);
  const pillH = titleSize * 1.7;
  const top = box.h * 0.1;
  const areaTop = top + pillH + box.h * 0.04;
  const areaH = box.h - areaTop - box.h * 0.08;
  const lineH = font * 1.25;
  const startY = areaTop + Math.max(0, (areaH - items.length * lineH) / 2);
  return (
    <Card pal={pal} x={box.x} y={box.y} w={box.w} h={box.h} tone={tone} index={index}>
      <div style={{position: 'absolute', left: padX, top}}>
        <Pill text={title} size={titleSize} bg={titleBg} color={pal.ink} pal={pal} />
      </div>
      {items.map((it, i) => {
        const on = t >= at[i];
        const p = springAt(t, at[i], 13, 190);
        return on ? (
          <div key={i} style={{position: 'absolute', left: padX, top: startY + i * lineH, height: lineH, display: 'flex', alignItems: 'center', fontSize: font, fontWeight: 900, color: tone === 'dim' ? rgba(pal.ink, 0.62) : pal.ink, whiteSpace: 'nowrap', opacity: Math.min(1, p * 1.8), transform: `translateY(${(1 - p) * 24}px)`}}>
            {it}
          </div>
        ) : (
          <div key={i} style={{position: 'absolute', left: padX, top: startY + i * lineH + lineH / 2 - font * 0.18, width: Math.min(box.w - padX * 2, font * Math.max(2, Array.from(it).length) * 0.9), height: font * 0.36, borderRadius: font * 0.18, background: rgba(pal.sub, 0.14)}} />
        );
      })}
    </Card>
  );
};

/** 箭头：一根粗线 + 箭头头，画出来（p 0→1）；dir down / right */
const Arrow: React.FC<{x: number; y: number; size: number; p: number; dir: 'down' | 'right'; color: string}> = ({x, y, size, p, dir, color}) => {
  const d = dir === 'down' ? 'M50 8 L50 84 M22 58 L50 88 L78 58' : 'M8 50 L84 50 M58 22 L88 50 L58 78';
  return (
    <svg viewBox="0 0 100 100" style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, overflow: 'visible', opacity: p > 0 ? 1 : 0}}>
      <path d={d} fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};

export const Compare: React.FC<{data: CompareData; marks: CompareMarks; t: number; dur: number; W: number; H: number; pal: MotionPalette}> = ({data, marks, t, dur, W, H, pal}) => {
  const left = (data.left ?? []).slice(0, 2);
  const right = (data.right ?? []).slice(0, 2);
  const verdict = data.verdict || '';
  const side = W / H >= 1.75; // 横版才左右排；竖版的取景框上下排，字能大一倍
  const la = revealTimes(marks.left, left.length, dur);
  const ra = revealTimes(marks.right, right.length, dur, null).map((v, i) => (i === 0 ? Math.max(v, (la[la.length - 1] ?? 0) + 0.3) : v));
  const R0 = ra[0] ?? dur;
  const va = verdict && Number.isFinite(marks.verdict0) ? Math.max(R0 + 0.3, (marks.verdict0 as number) - LEAD) : R0 + 0.8;

  // 版面
  const gap = Math.max(16, H * 0.025);
  const verdictH = verdict ? Math.max(84, Math.min(140, H * 0.15)) : 0;
  const vGap = verdict ? gap * 1.2 : 0;
  let A: Box;
  let B: Box;
  let arrow: {x: number; y: number; size: number};
  if (!side) {
    const contentW = Math.min(W, H * 1.4);
    const arrowH = Math.max(64, Math.min(110, H * 0.11));
    const cardH = Math.min((H - arrowH - verdictH - vGap) / 2, H * 0.42);
    const total = cardH * 2 + arrowH + verdictH + vGap;
    const y0 = (H - total) / 2;
    const x0 = (W - contentW) / 2;
    A = {x: x0, y: y0, w: contentW, h: cardH};
    B = {x: x0, y: y0 + cardH + arrowH, w: contentW, h: cardH};
    arrow = {x: W / 2, y: y0 + cardH + arrowH / 2, size: arrowH * 1.05};
  } else {
    const contentW = Math.min(W, H * 2.4);
    const arrowW = Math.max(70, Math.min(130, contentW * 0.08));
    const colW = (contentW - arrowW) / 2;
    const cardH = Math.min(H - verdictH - vGap, colW * 0.75);
    const total = cardH + verdictH + vGap;
    const y0 = (H - total) / 2;
    const x0 = (W - contentW) / 2;
    A = {x: x0, y: y0, w: colW, h: cardH};
    B = {x: x0 + colW + arrowW, y: y0, w: colW, h: cardH};
    arrow = {x: x0 + colW + arrowW / 2, y: y0 + cardH / 2, size: arrowW * 0.9};
  }
  const titleSize = Math.max(34, Math.min(64, A.h * 0.19));
  const padX = Math.max(30, A.w * 0.07);
  const innerW = A.w - padX * 2;
  const areaH = A.h * (1 - 0.1 - 0.04 - 0.08) - titleSize * 1.7;
  const k = Math.max(left.length, right.length);
  const font = Math.max(36, Math.min(areaH / (k * 1.25), ...[...left, ...right].map((s) => fitFont(s, innerW, 120, 36))));

  const enterL = springAt(t, la[0] ?? 0, 14, 170);
  const enterR = springAt(t, R0, 12, 190);
  const dimP = prog(t, R0, 0.35, Easing.out(Easing.cubic));
  const arrowP = prog(t, R0 - 0.22, 0.3, Easing.inOut(Easing.quad));
  const badge = springAt(t, R0 + 0.3, 11, 220);
  const badgeDraw = prog(t, R0 + 0.34, 0.25, Easing.out(Easing.quad));
  const wrongRight = data.labels === 'wrong-right';
  const bs = Math.max(60, Math.min(110, A.h * 0.26));
  const vP = springAt(t, va, 13, 180);
  const vMark = prog(t, va + 0.15, 0.4, Easing.inOut(Easing.quad));
  const vFont = verdict ? Math.min(verdictH * 0.64, fitFont(verdict, Math.min(W, side ? W : H * 1.4) * 0.8, 100, 34)) : 0;
  const vTop = side ? A.y + A.h + vGap : B.y + B.h + vGap;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
      {/* 旧做法 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: Math.min(1, enterL * 1.6) * (1 - 0.18 * dimP), transform: `translateY(${(1 - enterL) * -40}px) scale(${1 - 0.03 * dimP})`, transformOrigin: `${A.x + A.w / 2}px ${A.y + A.h / 2}px`}}>
        <Column pal={pal} box={A} title={data.leftTitle} items={left} at={la} t={t} tone={dimP > 0.5 ? 'dim' : 'normal'} index={0} font={font} titleSize={titleSize} titleBg={blend(pal.muted, pal.card, 0.2)} />
        {wrongRight && t >= R0 ? (
          <div style={{position: 'absolute', left: A.x + A.w - bs * 0.75, top: A.y - bs * 0.25, width: bs, height: bs}}>
            <Cross p={prog(t, R0 + 0.05, 0.3, Easing.out(Easing.quad))} size={bs} color={pal.look === 'ink' ? pal.ink : blend(pal.accent, '#B0301E', 0.55)} stroke={10} />
          </div>
        ) : null}
      </div>
      <Arrow x={arrow.x} y={arrow.y} size={arrow.size} p={arrowP} dir={side ? 'right' : 'down'} color={pal.look === 'ink' ? pal.ink : pal.accent} />
      {/* 新做法：没说到前是虚线空位 */}
      {t < R0 ? (
        <Card pal={pal} x={B.x} y={B.y} w={B.w} h={B.h} tone="ghost" index={1} />
      ) : (
        <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: Math.min(1, enterR * 1.6), transform: `translateY(${(1 - enterR) * 50}px) scale(${0.92 + 0.08 * enterR})`, transformOrigin: `${B.x + B.w / 2}px ${B.y + B.h / 2}px`}}>
          <Column pal={pal} box={B} title={data.rightTitle} items={right} at={ra} t={t} tone="hot" index={1} font={font} titleSize={titleSize} titleBg={pal.accent} />
          {badge > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: B.x + B.w - bs * 0.8,
                top: B.y - bs * 0.3,
                width: bs,
                height: bs,
                borderRadius: '50%',
                background: pal.good,
                border: `${Math.max(4, bs * 0.07)}px solid ${pal.card}`,
                boxSizing: 'border-box',
                boxShadow: pal.look === 'ink' ? `4px 4px 0 ${pal.ink}` : `0 ${bs * 0.06}px ${bs * 0.14}px ${rgba('#000000', 0.2)}`,
                transform: `scale(${badge})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check p={badgeDraw} size={bs * 0.56} color="#FFFFFF" stroke={11} />
            </div>
          ) : null}
        </div>
      )}
      {verdict && t >= va ? (
        <div style={{position: 'absolute', left: 0, top: vTop, width: W, height: verdictH, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: Math.min(1, vP * 1.8), transform: `translateY(${(1 - vP) * 20}px)`}}>
          <span style={{position: 'relative', display: 'inline-block', zIndex: 0, fontSize: vFont, fontWeight: 900, color: pal.ink, whiteSpace: 'nowrap', lineHeight: 1.2}}>
            <MarkerSwipe p={vMark} color={pal.look === 'ink' ? pal.accent : blend(pal.accent, '#FFFFFF', 0.15)} top="48%" height="48%" />
            {verdict}
          </span>
        </div>
      ) : null}
    </div>
  );
};
