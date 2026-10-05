// compare：对比。竖着的取景框（竖版 split / pip）上下两张大卡、中间一个往下的箭头；横版左右两栏、中间往右的箭头。
// 先说的旧做法在上（左），后说的新做法在下（右）。说到新做法时：箭头画出来，新卡片从下方滑上来、描重点色边、弹出一个勾，
// 旧卡片退一步：换成不透明的暗一档卡面加细灰边，旧的字划一道线（labels 是 wrong-right 时再画一个叉）。卡片都不透明，不透出后面的装饰。
// 栏标题是脚本按 labels 给的固定词，其余的字全部出自原句。
// verdict（可选，原话）最后出来：和卡片正文一样大或更大（114–126 参考像素），正文色，下半截扫一道马克笔，弹一下。
import React from 'react';
import {Easing, interpolate} from 'remotion';
import {blend, oldCardOf, rgba, type MotionPalette} from './palette';
import {Card, Cross, DoneBadge, MarkerSwipe, Pill, fitFont, isTall, prog, riseIn, springAt} from './parts';
import {visualTop} from './stage';
import {LEAD, revealTimes} from './timing';
import type {CompareData, CompareMarks} from './types';

type Box = {x: number; y: number; w: number; h: number};

/** 一栏：标题胶囊 + 1–2 条原话（没说到的条目不显示，只留版位） */
const Column: React.FC<{
  pal: MotionPalette;
  box: Box;
  title: string;
  items: string[];
  at: number[];
  t: number;
  tone: 'normal' | 'hot' | 'old';
  /** 旧的字划线的进度（0–1） */
  strike: number;
  index: number;
  font: number;
  titleSize: number;
  titleBg: string;
}> = ({pal, box, title, items, at, t, tone, strike, index, font, titleSize, titleBg}) => {
  const padX = Math.max(30, box.w * 0.07);
  const pillH = titleSize * 1.7;
  const top = box.h * 0.1;
  const areaTop = top + pillH + box.h * 0.04;
  const areaH = box.h - areaTop - box.h * 0.08;
  const lineH = font * 1.25;
  const startY = areaTop + Math.max(0, (areaH - items.length * lineH) / 2);
  const old = oldCardOf(pal);
  return (
    <Card pal={pal} x={box.x} y={box.y} w={box.w} h={box.h} tone={tone === 'hot' ? 'hot' : 'normal'} index={index} face={tone === 'old' ? old.face : undefined} border={tone === 'old' ? old.border : undefined}>
      <div style={{position: 'absolute', left: padX, top}}>
        <Pill text={title} size={titleSize} bg={titleBg} color={pal.ink} pal={pal} />
      </div>
      {items.map((it, i) => {
        const r = riseIn(t, at[i]);
        if (!r.on) return null;
        return (
          <div key={i} style={{position: 'absolute', left: padX, top: startY + i * lineH, height: lineH, display: 'flex', alignItems: 'center', opacity: r.opacity, transform: `translateY(${r.y * 0.5}px)`}}>
            <span style={{position: 'relative', fontSize: font, fontWeight: 900, color: tone === 'old' ? blend(pal.ink, old.face, 0.3) : pal.ink, whiteSpace: 'nowrap', lineHeight: 1.1}}>
              {it}
              {strike > 0 ? <span style={{position: 'absolute', left: '-2%', top: '54%', height: Math.max(5, font * 0.08), width: `${104 * strike}%`, borderRadius: font * 0.04, background: rgba(pal.ink, 0.7)}} /> : null}
            </span>
          </div>
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
  const tall = isTall(W, H);
  const la = revealTimes(marks.left, left.length, dur);
  const ra = revealTimes(marks.right, right.length, dur, null).map((v, i) => (i === 0 ? Math.max(v, (la[la.length - 1] ?? 0) + 0.3) : v));
  const R0 = ra[0] ?? dur;
  const va = verdict && Number.isFinite(marks.verdict0) ? Math.max(R0 + 0.3, (marks.verdict0 as number) - LEAD) : R0 + 0.8;
  const ink = pal.look === 'ink';
  const usableW = W - 14;
  const usableH = H - 14;

  // 结论字号：和卡片正文一样大或更大（114–126 参考像素），放不下再缩
  const vFont = verdict ? Math.max(48, Math.min(126, fitFont(verdict, Math.min(usableW, side ? usableW : usableH * 1.4) * 0.86, 126, 48))) : 0;
  const verdictH = verdict ? vFont * 1.45 : 0;

  // 版面
  const gap = Math.max(16, usableH * 0.025);
  const vGap = verdict ? gap : 0;
  let A: Box;
  let B: Box;
  let arrow: {x: number; y: number; size: number};
  if (!side) {
    const contentW = Math.min(usableW, usableH * 1.4);
    const arrowH = Math.max(64, Math.min(110, usableH * 0.1));
    const cardH = Math.min((usableH - arrowH - verdictH - vGap) / 2, usableH * (tall ? 0.4 : 0.42));
    const total = cardH * 2 + arrowH + verdictH + vGap;
    const y0 = visualTop(usableH, total);
    const x0 = (usableW - contentW) / 2;
    A = {x: x0, y: y0, w: contentW, h: cardH};
    B = {x: x0, y: y0 + cardH + arrowH, w: contentW, h: cardH};
    arrow = {x: x0 + contentW / 2, y: y0 + cardH + arrowH / 2, size: arrowH * 1.05};
  } else {
    const contentW = Math.min(usableW, usableH * 2.4);
    const arrowW = Math.max(70, Math.min(130, contentW * 0.08));
    const colW = (contentW - arrowW) / 2;
    const cardH = Math.min(usableH - verdictH - vGap, colW * 0.75);
    const total = cardH + verdictH + vGap;
    const y0 = visualTop(usableH, total);
    const x0 = (usableW - contentW) / 2;
    A = {x: x0, y: y0, w: colW, h: cardH};
    B = {x: x0 + colW + arrowW, y: y0, w: colW, h: cardH};
    arrow = {x: x0 + colW + arrowW / 2, y: y0 + cardH / 2, size: arrowW * 0.9};
  }
  const titleSize = Math.max(34, Math.min(tall ? 72 : 64, A.h * 0.19));
  const padX = Math.max(30, A.w * 0.07);
  const innerW = A.w - padX * 2;
  const areaH = A.h * (1 - 0.1 - 0.04 - 0.08) - titleSize * 1.7;
  const k = Math.max(left.length, right.length);
  const font = Math.max(36, Math.min(areaH / (k * 1.25), tall ? 126 : 120, ...[...left, ...right].map((s) => fitFont(s, innerW, tall ? 126 : 120, 36))));

  const enterL = springAt(t, la[0] ?? 0, 14, 170);
  const rB = riseIn(t, R0);
  const dimP = prog(t, R0, 0.35, Easing.out(Easing.cubic));
  const arrowP = prog(t, R0 - 0.22, 0.3, Easing.inOut(Easing.quad));
  const wrongRight = data.labels === 'wrong-right';
  const bs = Math.max(60, Math.min(110, A.h * 0.26));
  const vR = riseIn(t, va);
  const vPop = interpolate(t - va, [0.15, 0.3, 0.45], [1, 1.06, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const vMark = prog(t, va + 0.12, 0.4, Easing.inOut(Easing.quad));
  const vTop = side ? A.y + A.h + vGap : B.y + B.h + vGap;
  const strike = wrongRight ? 0 : prog(t, R0 + 0.15, 0.3, Easing.out(Easing.quad));

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
      {/* 旧做法：说到新做法后换成旧卡片的样子（不透明），轻轻缩一点 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: Math.min(1, enterL * 1.6), transform: `translateY(${(1 - enterL) * -40}px) scale(${1 - 0.03 * dimP})`, transformOrigin: `${A.x + A.w / 2}px ${A.y + A.h / 2}px`}}>
        <Column pal={pal} box={A} title={data.leftTitle} items={left} at={la} t={t} tone={dimP > 0.5 ? 'old' : 'normal'} strike={strike} index={0} font={font} titleSize={titleSize} titleBg={ink ? '#FFFFFF' : blend(pal.muted, pal.card, 0.2)} />
        {wrongRight && t >= R0 ? (
          <div style={{position: 'absolute', left: A.x + A.w - bs * 0.75, top: A.y - bs * 0.25, width: bs, height: bs}}>
            <Cross p={prog(t, R0 + 0.05, 0.3, Easing.out(Easing.quad))} size={bs} color={ink ? pal.ink : blend(pal.accent, '#B0301E', 0.55)} stroke={10} />
          </div>
        ) : null}
      </div>
      <Arrow x={arrow.x} y={arrow.y} size={arrow.size} p={arrowP} dir={side ? 'right' : 'down'} color={ink ? pal.ink : pal.accent} />
      {/* 新做法：说到时从下方滑上来（之前隐形预留版位） */}
      {rB.on ? (
        <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: rB.opacity, transform: `translateY(${rB.y}px) scale(${rB.scale})`, transformOrigin: `${B.x + B.w / 2}px ${B.y + B.h / 2}px`}}>
          <Column pal={pal} box={B} title={data.rightTitle} items={right} at={ra} t={t} tone="hot" strike={0} index={1} font={font} titleSize={titleSize} titleBg={pal.accent} />
          <div style={{position: 'absolute', left: B.x + B.w - bs * 0.8, top: B.y - bs * 0.3, width: bs, height: bs}}>
            <DoneBadge pal={pal} t={t} at={R0 + 0.3} size={bs} />
          </div>
        </div>
      ) : null}
      {verdict && vR.on ? (
        <div style={{position: 'absolute', left: 0, top: vTop, width: usableW, height: verdictH, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: vR.opacity, transform: `translateY(${vR.y * 0.5}px) scale(${vR.scale * vPop})`, transformOrigin: `${usableW / 2}px ${verdictH / 2}px`}}>
          <span style={{position: 'relative', display: 'inline-block', zIndex: 0, fontSize: vFont, fontWeight: 900, color: pal.ink, whiteSpace: 'nowrap', lineHeight: 1.2}}>
            <MarkerSwipe p={vMark} color={pal.accent} top="50%" height="45%" opacity={0.85} tilt={-2} />
            {verdict}
          </span>
        </div>
      ) : null}
    </div>
  );
};
