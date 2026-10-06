// 剪纸拼贴外观。五个模板都重新排过：锚点卡只承载这一段的主信息，其余是小纸签。
// 纸纹、碎屑、落定、多边形、接力全部用 kit/。锚点只留一层软投影，不再叠一张深色底卡。
// 第 0 帧锚点上已经有字。没有固定的眉题句式。字只来自槽位。
import React from 'react';
import type {Rect} from '../layout';
import {anchorLines} from './anchorLayout.ts';
import {textEm} from './measure.ts';
import {blend, luminance, type MotionPalette} from './palette.ts';
import {SPLIT_TOP} from '../layout.ts';
import {revealTimes} from './timing.ts';
import {anchorPose, faceVisibility, PERSPECTIVE} from './kit/anchorMotion.ts';
import type {RelayDecision} from './kit/anchorRelay.ts';
import {Confetti} from './kit/Confetti.tsx';
import {CutShape} from './kit/CutShape.tsx';
import {cutGeometry, restTiltFor, safeTilt, shadowColor, shadowOffset} from './kit/cutShape.ts';
import {PaperGrain} from './kit/PaperGrain.tsx';
import {mapPath, projectPoint} from './kit/project.ts';
import {hashSeed} from './kit/rng.ts';
import {shadowByHeight} from './kit/shadowByHeight.ts';
import {BOTTOM_UNSAFE, TOP_UNSAFE, rectsHit} from './stage.ts';
import type {MotionClip, MotionNum} from './types.ts';

export type CutpaperProps = {
  clip: MotionClip;
  pal: MotionPalette;
  t: number;
  dur: number;
  /** 取景框（参考像素，1080 宽为 1） */
  W: number;
  H: number;
  bw: number;
  bh: number;
  fx: number;
  fy: number;
  relay: RelayDecision | null;
  /** 下一段会接这张锚点，这一段不翻出 */
  hold?: boolean;
  /** 字幕带、圆窗。纸签和碎屑都躲开 */
  avoid?: Rect[];
};

/** 锚点色块占框的比例。split 用上方面板，pip / full 用取景框。宽 62–70%、高 40–55%。
 * 卡心放在框高正中：上抛 24% 后顶边还在框里。再往上放，抛起会被画面顶裁掉，看起来只是原地晃。 */
const ANCHOR_WF = 0.66;
const ANCHOR_HF = 0.47;
const ANCHOR_LIFT = 0;
/** 1080 宽上的字号下限。720 成片由舞台缩放按比例缩小 */
const MAIN_MIN = 120;
const SUB_MIN = 56;
/** 纸签和「以前」卡的字号。1080 宽参考像素。粗体汉字墨高比字号大约少 1，下限 48，成片墨高不低于 44 */
const TAG_FONT = 50;
const TAG_MIN = 48;
const TAG_PAD = 12;
/** 两张纸签之间的净距下限（1080 宽参考像素）。摆位时再加上转动和浮动会吃掉的那一截 */
const TAG_GAP = 24;
/** 同一时刻留在画面上的已说条目。再多的，最早的一张退场 */
const SLIP_MAX = 3;
const SLIP_EXIT = 0.4;
/** 纸签离画面边缘的下限（1080 宽上的参考像素），并且整张落在平台栏以下 */
const TAG_EDGE = 48;
/** 同色系边缘：压暗 10%（落在 8–12%），1–2 参考像素，不再描黑边 */
const EDGE_DARK = 0.1;
const EDGE_PX = 2;
/** chunky 毛边会探出排版框（半径约 6%）。水平再让出这些，纸签连毛边也离画面 ≥ 48 */
const TAG_DECKLE = 12;


const contrastRatio = (a: string, b: string) => {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
};
/** 墨色和卡纸色里，选对比度够 4.5 的那支；两支都够就用更深的墨色 */
const inkOn = (pal: MotionPalette) => {
  const inkC = contrastRatio(pal.ink, pal.accent);
  const cardC = contrastRatio(pal.card, pal.accent);
  if (inkC >= 4.5 && inkC >= cardC) return pal.ink;
  if (cardC >= 4.5) return pal.card;
  return inkC >= cardC ? pal.ink : pal.card;
};

const darken = (hex: string, amount: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const f = 1 - amount;
  const pack = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + pack(((n >> 16) & 255) * f) + pack(((n >> 8) & 255) * f) + pack((n & 255) * f);
};

const Lines: React.FC<{text: string; color: string; maxW: number; maxPx: number; minPx: number; rotX?: number; rotY?: number; perspective?: number}> = ({
  text,
  color,
  maxW,
  maxPx,
  minPx,
  rotX = 0,
  rotY = 0,
  perspective = 1500,
}) => {
  if (!text) return null;
  const b = anchorLines(text, Math.max(40, maxW), maxPx, minPx);
  const n = b.lines.length;
  const blockH = n * b.font * 1.05;
  const pitch = (rotX * Math.PI) / 180;
  const yaw = (rotY * Math.PI) / 180;
  const cosY = Math.cos(yaw);
  const cosX = Math.cos(pitch);
  return (
    <div style={{color, fontWeight: 900, fontSize: b.font, lineHeight: 1.05, width: '100%'}}>
      {b.lines.map((ln, i) => {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const yRel = t * blockH;
        const k = perspective / Math.max(40, perspective + yRel * Math.sin(pitch));
        const scaleX = Math.max(0.5, Math.abs(cosY) * k);
        const scaleY = Math.max(0.5, Math.abs(cosX));
        const shift = yRel * Math.sin(yaw) * 0.42;
        const skew = n === 1 ? rotX * 0.5 : 0;
        return (
          <div key={i} style={{whiteSpace: 'nowrap', transform: `translateX(${shift.toFixed(1)}px) skewX(${skew.toFixed(2)}deg) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`, transformOrigin: '50% 50%'}}>
            {ln}
          </div>
        );
      })}
    </div>
  );
};

const pathPts = (d: string): {x: number; y: number}[] => {
  const nums = d.match(/-?\d+(?:\.\d+)?/g);
  if (!nums) return [];
  const pts: {x: number; y: number}[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({x: Number(nums[i]), y: Number(nums[i + 1])});
  return pts;
};

/** 旋转后的外接框。量的是色块，不是带投影的占位 */
const rotatedBounds = (pts: {x: number; y: number}[], deg: number, cx: number, cy: number) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const x = cx + dx * c - dy * s;
    const y = cy + dx * s + dy * c;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {minX, minY, maxX, maxY};
};

const numText = (n: MotionNum): string => `${n.prefix}${n.decimals ? n.value.toFixed(n.decimals) : String(n.value)}${n.suffix}`;

const currentIndex = (times: number[], t: number): number => {
  let c = 0;
  for (let i = 0; i < times.length; i++) if (t + 1e-3 >= times[i]) c = i;
  return c;
};

const TAG_TILT = [3.4, -3.2, 2.2, -3.8, 1.6];

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const greyOf = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  const y = Math.round(0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255));
  const p = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${p(y)}${p(y)}${p(y)}`;
};

/** 纸签浮动比锚点小：上下 0.6% 高（锚点 1.5%），倾角约 1°。 */
const slipBob = (t: number, i: number, height: number) => {
  const amp = Math.max(1, height) * 0.006;
  const w = (2 * Math.PI * t) / (1.85 + (i % 3) * 0.15);
  return {x: amp * Math.cos(w), y: amp * Math.sin(w + i * 0.7), tilt: 1.15 * Math.sin(w * 0.86 + i)};
};

type HistItem = {key: string; text: string; at: number; dots: number};

/** 说到重点的时刻：keyword 的 hot、counter 的数字落定、清单 / 步骤的新条目、compare 的结论。 */
const tossBeats = (clip: MotionClip, dur: number): number[] => {
  if (clip.template === 'keyword') {
    const hot = clip.marks.hot0 ?? clip.marks.hot;
    return finite(hot) ? [hot] : [];
  }
  if (clip.template === 'checklist' || clip.template === 'steps') {
    return revealTimes(clip.marks.items, clip.data.items.length, dur);
  }
  if (clip.template === 'counter') return finite(clip.marks.sayAt) ? [clip.marks.sayAt] : [];
  const verdict = clip.marks.verdict0 ?? clip.marks.verdict;
  return finite(verdict) ? [verdict] : [];
};

/** counter / steps 在新内容上绕 Y 翻一面。第一条从第 0 帧就在正面，不翻。 */
const flipBeats = (clip: MotionClip, dur: number): number[] => {
  if (clip.template === 'steps') return revealTimes(clip.marks.items, clip.data.items.length, dur).slice(1);
  if (clip.template === 'counter') return finite(clip.marks.sayAt) ? [clip.marks.sayAt] : [];
  return [];
};

export const CutpaperStage: React.FC<CutpaperProps> = ({clip, pal, t, dur, W, H, bw, bh, fx, fy, relay, hold = false, avoid = []}) => {
  const shade = shadowColor(pal.bg);
  const soft = darken(pal.bg, 0.25);
  const restTilt = relay?.relay ? relay.tilt : restTiltFor(pal.look);
  const accent = relay?.relay ? relay.color : pal.accent;
  const fg = inkOn({...pal, accent});
  const grainSeed = hashSeed(pal.look);

  // split 的比例相对整块上方面板。pip / full 相对取景框（脸和字幕已经让开）
  const usePanel = clip.mode === 'split';
  const frameW = usePanel ? bw : W;
  const frameH = usePanel ? bh : H;
  const frameX = usePanel ? 0 : fx;
  const frameY = usePanel ? 0 : fy;
  let anchorW = frameW * ANCHOR_WF;
  let anchorH = frameH * ANCHOR_HF;
  let anchorX = frameX + (frameW - anchorW) / 2;
  let anchorY = frameY + frameH * (0.5 - ANCHOR_LIFT) - anchorH / 2;
  // 顶边留 20 屏幕像素。行程取「取景框的 24%」和「画面框的 22%」里更大的那个，但不超过顶边。
  const marginRef = 20 * (bw / 720);
  const maxRise = Math.max(frameH * 0.18, anchorY - marginRef);
  const prefer = Math.max(frameH * 0.24, bh * 0.22);
  const rise = Math.min(maxRise, prefer);
  const motionH = rise / 0.24;
  let textW = anchorW * 0.72;
  let mainMax = Math.max(MAIN_MIN, Math.min(168, anchorH * 0.4));
  let subMax = Math.max(SUB_MIN, Math.min(78, anchorH * 0.18));
  const pose = anchorPose({
    t,
    dur,
    height: frameH,
    travelHeight: motionH,
    width: frameW,
    restTilt,
    relay: Boolean(relay?.relay),
    hold,
    seed: `${pal.look}-${clip.id}`,
    tossAt: tossBeats(clip, dur),
    flipAt: flipBeats(clip, dur),
  });
  const spin = pose.rotY + pose.flip;
  const vis = faceVisibility(spin, pose.rotX);
  const showBack = vis === 'back';
  const hideFace = vis === 'edge';
  const faceIndex = showBack ? pose.faceB : pose.faceA;
  const perspective = Math.round(PERSPECTIVE * (bw / 720));
  const linePose = {rotX: pose.rotX, rotY: spin, perspective};

  let anchorText: React.ReactNode = null;
  const hist: HistItem[] = [];
  let beforeLines: string[] = [];
  let beforeOn = false;

  if (clip.template === 'checklist' || clip.template === 'steps') {
    const items = clip.data.items;
    const times = revealTimes(clip.marks.items, items.length, dur);
    const cur = clip.template === 'steps' ? Math.max(0, Math.min(items.length - 1, faceIndex)) : currentIndex(times, t);
    items.forEach((text, i) => {
      // 只留已经离开锚点的条目。后面的条目即使提前到了 reveal 时刻，也不先变成纸签。
      if (!text.trim() || i >= cur || t + 1e-3 < times[i]) return;
      hist.push({key: `${clip.id}-i${i}`, text, at: times[i], dots: clip.template === 'steps' ? i + 1 : 0});
    });
    if (clip.template === 'checklist' && clip.data.title && t + 1e-3 >= (clip.marks.title0 ?? 0)) {
      const title = clip.data.title.trim();
      if (title && title !== (items[cur] ?? '').trim()) hist.push({key: `${clip.id}-title`, text: title, at: clip.marks.title0 ?? 0, dots: 0});
    }
    hist.sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : 1));
  } else if (clip.template === 'compare') {
    const leftAt = revealTimes(clip.marks.left, clip.data.left.length, dur);
    const said = clip.data.left.filter((_, i) => t + 1e-3 >= leftAt[i]);
    beforeLines = [clip.data.leftTitle, ...said].map((s) => s.trim()).filter(Boolean);
    beforeOn = beforeLines.length > 0 && (leftAt.length === 0 || t + 1e-3 >= leftAt[0]);
  }

  const fullH = clip.mode === 'split' ? bh / SPLIT_TOP : bh;
  const safeL = TAG_EDGE;
  const safeT = Math.max(TAG_EDGE, TOP_UNSAFE * fullH);
  const safeR = bw - TAG_EDGE;
  const safeB = Math.min(clip.mode === 'split' ? bh : bh - TAG_EDGE, BOTTOM_UNSAFE * fullH);
  let bandBottom = safeB;
  for (const r of avoid) {
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.x + r.width < safeL || r.x > safeR) continue;
    if (r.y > anchorY + 20 && r.y < bandBottom) bandBottom = r.y - 6;
  }

  const slipShadow = shadowOffset(1080, 0.16);
  const measureSlip = (text: string, dots: number) => {
    const dotW = dots > 0 ? 8 + Math.min(6, dots) * 13 : 0;
    const maxText = Math.max(80, Math.min(300, safeR - safeL - dotW - 96));
    const broken = anchorLines(text, maxText, TAG_FONT, TAG_MIN);
    const lineW = Math.max(...broken.lines.map((ln) => textEm(ln) * broken.font));
    const textH = broken.lines.length * broken.font * 1.08;
    return {
      w: Math.ceil(dotW + lineW + TAG_PAD * 2 + 8),
      h: Math.ceil(Math.max(textH, dots > 0 ? 22 : 0) + TAG_PAD * 2 + 4),
      font: broken.font,
    };
  };

  const keep = hist.slice(-SLIP_MAX);
  const leaving = hist.flatMap((h, i) => {
    if (i + SLIP_MAX >= hist.length) return [];
    const u = (t - hist[i + SLIP_MAX].at) / SLIP_EXIT;
    if (!(u >= 0 && u < 1)) return [];
    return [{...h, exit: u}];
  });
  const rowSrc = keep.map((h) => ({...h, exit: 0}));
  const measured = rowSrc.map((h) => ({...h, ...measureSlip(h.text, h.dots)}));
  if (measured.length) {
    const rowH = Math.max(...measured.map((m) => m.h)) + slipShadow.dy + frameH * 0.016 + 12;
    const centerY = anchorY + anchorH / 2;
    if (centerY + anchorH / 2 + rowH > bandBottom) {
      const nextH = Math.max(frameH * 0.36, (bandBottom - rowH - centerY) * 2);
      if (nextH < anchorH - 1) {
        anchorH = nextH;
        anchorY = centerY - anchorH / 2;
      }
    }
  }

  let beforeBox: {x: number; y: number; w: number; h: number; font: number} | null = null;
  if (clip.template === 'compare') {
    const gap = 18;
    const aW = frameW * 0.62;
    const aX = frameX + frameW - 72 - aW;
    const bW = Math.min(260, aX - gap - (safeL + 6));
    const bX = aX - gap - bW;
    const side = bW >= 180 && bX >= safeL && aX + aW <= frameX + frameW + 1;
    if (side) {
      anchorW = aW;
      anchorX = aX;
    }
    const cardW = side ? bW : Math.min(420, safeR - safeL - 16);
    const inner = Math.max(80, cardW - TAG_PAD * 2 - 8);
    const linesForSize = beforeLines.length ? beforeLines : [clip.data.leftTitle].filter((s) => s && s.trim());
    const parts = linesForSize.map((ln) => anchorLines(ln, inner, TAG_FONT, TAG_MIN));
    const font = parts.length ? Math.min(...parts.map((p) => p.font)) : TAG_MIN;
    const textH = parts.reduce((s, p) => s + p.lines.length * font * 1.12, 0);
    const h = Math.ceil((textH || font * 1.12) + TAG_PAD * 2 + 12);
    let x = side ? bX : Math.max(safeL, anchorX + (anchorW - cardW) / 2);
    let y = side ? anchorY + Math.max(0, (anchorH - h) / 2) : anchorY + anchorH + frameH * 0.02 + 8;
    if (!side) {
      const centerY = anchorY + anchorH / 2;
      const need = h + slipShadow.dy + frameH * 0.02 + 16;
      if (centerY + anchorH / 2 + need > bandBottom) {
        const nextH = Math.max(frameH * 0.36, (bandBottom - need - centerY) * 2);
        if (nextH < anchorH - 1) {
          anchorH = nextH;
          anchorY = centerY - anchorH / 2;
        }
      }
      y = anchorY + anchorH + frameH * 0.02 + 8;
    }
    y = Math.max(safeT, Math.min(y, bandBottom - h - slipShadow.dy - 2));
    x = Math.max(safeL, Math.min(x, safeR - cardW));
    beforeBox = {x, y, w: cardW, h, font};
  }

  textW = anchorW * 0.72;
  mainMax = Math.max(MAIN_MIN, Math.min(168, anchorH * 0.4));
  subMax = Math.max(SUB_MIN, Math.min(78, anchorH * 0.18));

  if (clip.template === 'keyword') {
    anchorText = <Lines text={clip.data.text} color={fg} maxW={textW} maxPx={mainMax} minPx={MAIN_MIN} {...linePose} />;
  } else if (clip.template === 'checklist' || clip.template === 'steps') {
    const items = clip.data.items;
    const times = revealTimes(clip.marks.items, items.length, dur);
    const cur = clip.template === 'steps' ? Math.max(0, Math.min(items.length - 1, faceIndex)) : currentIndex(times, t);
    anchorText = <Lines text={items[cur] ?? ''} color={fg} maxW={textW} maxPx={mainMax} minPx={MAIN_MIN} {...linePose} />;
  } else if (clip.template === 'counter') {
    const show = faceIndex >= 1;
    anchorText = (
      <div style={{width: '100%'}}>
        {show ? <Lines text={numText(clip.data.say)} color={fg} maxW={textW} maxPx={mainMax} minPx={MAIN_MIN} {...linePose} /> : null}
        <Lines text={clip.data.label} color={fg} maxW={textW} maxPx={subMax} minPx={SUB_MIN} {...linePose} />
      </div>
    );
  } else if (clip.template === 'compare') {
    const rightAt = revealTimes(clip.marks.right, clip.data.right.length, dur);
    const said = clip.data.right.filter((_, i) => t + 1e-3 >= rightAt[i]);
    const vAt = clip.marks.verdict0 ?? clip.marks.verdict;
    const showV = Boolean(clip.data.verdict) && finite(vAt) && t + 1e-3 >= vAt;
    anchorText = (
      <div style={{width: '100%'}}>
        <Lines text={clip.data.rightTitle} color={fg} maxW={textW} maxPx={mainMax} minPx={MAIN_MIN} {...linePose} />
        {said.map((text, i) => (
          <Lines key={i} text={text} color={fg} maxW={textW} maxPx={subMax} minPx={SUB_MIN} {...linePose} />
        ))}
        {showV ? <Lines text={clip.data.verdict ?? ''} color={fg} maxW={textW} maxPx={subMax} minPx={SUB_MIN} {...linePose} /> : null}
      </div>
    );
  }

  const placed: {key: string; text: string; x: number; y: number; w: number; h: number; tilt: number; font: number; dots: number; bob: number; opacity: number}[] = [];
  const newestFirst = [...measured].sort((a, b) => b.at - a.at || b.dots - a.dots);
  if (newestFirst.length) {
    const bobAmp = Math.max(1, frameH) * 0.006;
    const rowH = Math.max(...newestFirst.map((m) => m.h));
    // 纸片还会再转大约 6°、左右再漂一个振幅。净距按转完、漂完之后仍 ≥ TAG_GAP 来留
    const gap = TAG_GAP + 2 * bobAmp + rowH * Math.sin((6 * Math.PI) / 180);
    const centers = newestFirst.map(() => 0);
    const anchorCx = anchorX + anchorW / 2;
    centers[0] = anchorCx;
    let leftEdge = anchorCx - newestFirst[0].w / 2;
    let rightEdge = anchorCx + newestFirst[0].w / 2;
    for (let i = 1; i < newestFirst.length; i++) {
      if (i % 2 === 1) {
        centers[i] = leftEdge - gap - newestFirst[i].w / 2;
        leftEdge = centers[i] - newestFirst[i].w / 2;
      } else {
        centers[i] = rightEdge + gap + newestFirst[i].w / 2;
        rightEdge = centers[i] + newestFirst[i].w / 2;
      }
    }
    const left = Math.min(...centers.map((c, i) => c - newestFirst[i].w / 2));
    const right = Math.max(...centers.map((c, i) => c + newestFirst[i].w / 2));
    let shift = 0;
    const minX = safeL + TAG_DECKLE;
    const maxX = safeR - TAG_DECKLE;
    if (left < minX) shift = minX - left;
    if (right + shift > maxX) shift -= right + shift - maxX;
    const y = Math.max(safeT, Math.min(anchorY + anchorH + frameH * 0.012 + 6, bandBottom - Math.max(...newestFirst.map((m) => m.h)) - slipShadow.dy - 2));
    newestFirst.forEach((m, i) => {
      const age = Math.max(0, t - m.at);
      const x = centers[i] + shift - m.w / 2;
      placed.push({
        key: m.key,
        text: m.text,
        x,
        y,
        w: m.w,
        h: m.h,
        tilt: safeTilt(TAG_TILT[i % TAG_TILT.length], -4, 4),
        font: m.font,
        dots: m.dots,
        bob: i,
        opacity: Math.max(0, Math.min(1, age / 0.18)),
      });
    });
  }
  leaving.forEach((m, i) => {
    const box = measureSlip(m.text, m.dots);
    const x = Math.max(safeL, Math.min(safeR - box.w, anchorX + anchorW / 2 - box.w / 2 + (i % 2 === 0 ? -1 : 1) * (80 + m.exit * 36)));
    const y = Math.max(safeT, Math.min(anchorY + anchorH + 8 + m.exit * 20, bandBottom - box.h - slipShadow.dy));
    placed.push({
      key: `${m.key}-out`,
      text: m.text,
      x,
      y,
      w: box.w,
      h: box.h,
      tilt: safeTilt(TAG_TILT[(i + 1) % TAG_TILT.length], -4, 4),
      font: box.font,
      dots: m.dots,
      bob: SLIP_MAX + i,
      opacity: 1 - m.exit,
    });
  });

  const beforeFill = darken(blend(pal.card, greyOf(pal.card), 0.78), 0.22);
  const beforeBob = slipBob(t, 5, frameH);
  let beforeFade = 0;
  if (beforeOn && clip.template === 'compare') {
    const leftAt = revealTimes(clip.marks.left, clip.data.left.length, dur);
    beforeFade = Math.max(0, Math.min(1, (t - (leftAt[0] ?? 0)) / 0.2));
  }

  const geo = cutGeometry(`${clip.id}-anchor`, {
    width: anchorW,
    height: anchorH,
    tilt: restTilt,
    keepTilt: true,
    shortSide: 1080,
    shadowK: 0.18,
    wobbleMin: 0.99,
    wobbleSpan: 0.02,
    roughness: 0.02,
    sidesMin: 6,
    sidesMax: 7,
  });
  const bb = rotatedBounds(pathPts(geo.d), restTilt, anchorW / 2, anchorH / 2);
  const sx = anchorW / Math.max(1, bb.maxX - bb.minX);
  const sy = anchorH / Math.max(1, bb.maxY - bb.minY);
  const tx = -bb.minX * sx;
  const ty = -bb.minY * sy;
  const filterId = `cpsh-${clip.id}`;
  const shadow = shadowByHeight(pose.h, 1080);
  const cosY = Math.cos((spin * Math.PI) / 180);
  const cosX = Math.cos((pose.rotX * Math.PI) / 180);
  const shape = `translate(${tx} ${ty}) scale(${sx} ${sy}) rotate(${pose.tilt} ${anchorW / 2} ${anchorH / 2})`;
  const fitPt = (x: number, y: number) => {
    const cx = anchorW / 2;
    const cy = anchorH / 2;
    const a = (pose.tilt * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = x - cx;
    const dy = y - cy;
    return {x: (cx + dx * c - dy * s) * sx + tx, y: (cy + dx * s + dy * c) * sy + ty};
  };
  const faceD = mapPath(geo.d, (x, y) => {
    const p = fitPt(x, y);
    return projectPoint(p.x, p.y, anchorW / 2, anchorH / 2, pose.rotX, spin, perspective);
  });
  const foot = Math.max(0.04, Math.abs(cosY));
  const anchorBox = {x: anchorX + pose.x, y: anchorY + pose.y, width: anchorW, height: anchorH};

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: bw, height: bh, background: pal.bg, overflow: 'hidden'}}>
      <PaperGrain w={bw} h={bh} seed={grainSeed} opacity={pal.look === 'cutpaper-dusk' ? 0.27 : 0.24} scale={3.2} sigma={5} />
      <Confetti
        t={t}
        dur={dur}
        w={bw}
        h={bh}
        seed={clip.id}
        colors={[pal.warm, pal.cool, pal.muted]}
        avoid={[...avoid, {x: anchorX, y: anchorY, width: anchorW, height: anchorH}]}
      />
      {beforeOn && beforeBox ? (
        <div style={{position: 'absolute', left: beforeBox.x + beforeBob.x, top: beforeBox.y + beforeBob.y, width: beforeBox.w, height: beforeBox.h, opacity: beforeFade, transform: `rotate(${beforeBob.tilt}deg)`, transformOrigin: '50% 50%'}}>
          <CutShape seed={`${clip.id}-before`} w={beforeBox.w} h={beforeBox.h} fill={beforeFill} stroke={darken(beforeFill, EDGE_DARK)} strokeWidth={EDGE_PX} shadow={shade} tilt={safeTilt(-3.2, -4, 4)} shadowK={0.2} chunky />
          <div
            style={{
              position: 'absolute',
              left: TAG_PAD,
              right: TAG_PAD,
              top: TAG_PAD,
              bottom: TAG_PAD,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              zIndex: 1,
            }}
          >
            {beforeLines.map((ln, i) => (
              <div key={i} style={{position: 'relative', width: '100%'}}>
                <Lines text={ln} color={pal.ink} maxW={Math.max(40, beforeBox.w - TAG_PAD * 2)} maxPx={beforeBox.font} minPx={TAG_MIN} />
                <div style={{position: 'absolute', left: '6%', right: '6%', top: '52%', height: 3, background: pal.ink, opacity: 0.72, transform: 'translateY(-50%)'}} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {placed.map((tag) => {
        const bob = slipBob(t, tag.bob, frameH);
        const dotN = Math.min(6, tag.dots);
        return (
          <div key={tag.key} style={{position: 'absolute', left: tag.x + bob.x, top: tag.y + bob.y, width: tag.w, height: tag.h, opacity: tag.opacity, transform: `rotate(${bob.tilt}deg)`, transformOrigin: '50% 50%'}}>
            <CutShape seed={`${clip.id}-${tag.key}`} w={tag.w} h={tag.h} fill={pal.card} stroke={darken(pal.card, EDGE_DARK)} strokeWidth={EDGE_PX} shadow={shade} tilt={tag.tilt} shadowK={0.16} chunky />
            <div
              style={{
                position: 'absolute',
                left: TAG_PAD,
                right: TAG_PAD,
                top: TAG_PAD,
                bottom: TAG_PAD,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                textAlign: 'center',
                zIndex: 1,
              }}
            >
              {dotN > 0 ? (
                <div style={{display: 'flex', gap: 4, flex: '0 0 auto'}}>
                  {Array.from({length: dotN}, (_, k) => (
                    <span key={k} style={{width: 10, height: 10, borderRadius: 10, background: pal.ink, display: 'inline-block'}} />
                  ))}
                </div>
              ) : null}
              <Lines text={tag.text} color={pal.ink} maxW={Math.max(40, tag.w - TAG_PAD * 2 - (dotN > 0 ? 8 + dotN * 13 : 0))} maxPx={tag.font} minPx={TAG_MIN} />
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: anchorBox.x, top: anchorBox.y, width: anchorW, height: anchorH, overflow: 'visible'}}>
        <svg width={anchorW} height={anchorH} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
          <defs>
            <filter id={filterId} x="-70%" y="-70%" width="240%" height="280%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={Math.max(0.5, shadow.blur)} />
            </filter>
          </defs>
          <g opacity={shadow.opacity} filter={`url(#${filterId})`} transform={`translate(${shadow.dx} ${shadow.dy})`}>
            <g transform={`translate(${anchorW / 2} ${anchorH / 2}) scale(${foot} 1) translate(${-anchorW / 2} ${-anchorH / 2})`}>
              <g transform={shape}>
                <path d={geo.d} fill={soft} />
              </g>
            </g>
          </g>
        </svg>
        <svg width={anchorW} height={anchorH} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <path d={faceD} fill={accent} stroke={darken(accent, EDGE_DARK)} strokeWidth={EDGE_PX} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {Math.abs(cosY) < 0.42 ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '7%',
              width: Math.max(8, anchorW * 0.045),
              height: '86%',
              marginLeft: -Math.max(4, anchorW * 0.022),
              background: darken(accent, 0.32),
              transform: `rotate(${pose.tilt}deg) scaleY(${Math.max(0.2, Math.abs(cosX))})`,
              transformOrigin: '50% 50%',
              borderRadius: 3,
              opacity: Math.min(1, (0.42 - Math.abs(cosY)) / 0.28),
            }}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            left: (anchorW - textW) / 2,
            top: anchorH * 0.12,
            width: textW,
            height: anchorH * 0.76,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            transform: `rotate(${pose.tilt}deg)`,
            transformOrigin: '50% 50%',
            opacity: hideFace ? 0 : 1,
          }}
        >
          {anchorText}
        </div>
      </div>
    </div>
  );
};
