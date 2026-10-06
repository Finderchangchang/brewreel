// 剪纸拼贴外观。五个模板都重新排过：锚点卡只承载这一段的主信息，其余是小纸签。
// 纸纹、碎屑、落定、多边形、接力全部用 kit/。锚点只留一层软投影，不再叠一张深色底卡。
// 第 0 帧锚点上已经有字。没有固定的眉题句式。字只来自槽位。
import React from 'react';
import type {Rect} from '../layout';
import {fitFont, textEm} from './measure.ts';
import {luminance, type MotionPalette} from './palette.ts';
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
/** 纸签首选字号。锚点下方到字幕只有一条窄缝，放不下就收到 TAG_MIN */
const TAG_FONT = 42;
const TAG_MIN = 32;
const TAG_PAD = 14;
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

const visibleCount = (s: string) => Array.from(s.replace(/\s/g, '')).length;

/**
 * 一行放得下就一行。放不下就拆成两行，两行按字宽尽量一样长，并且不许只剩一个字。
 * 字号往下限收，但不低于 minPx。
 */
const breakLines = (text: string, maxW: number, maxPx: number, minPx: number): {font: number; lines: string[]} => {
  const raw = Array.from(text);
  const n = raw.length;
  const widthOf = (s: string, font: number) => textEm(s) * font;
  const fits = (s: string, font: number) => widthOf(s, font) <= maxW + 0.5;
  const one = fitFont(text, maxW, maxPx, minPx);
  if (n <= 1 || (one >= minPx && fits(text, one))) return {font: Math.max(minPx, one), lines: [text]};
  let best: {i: number; balance: number; font: number} | null = null;
  const lo = n > 3 ? 2 : 1;
  const hi = n - lo;
  for (let i = lo; i <= hi; i++) {
    const a = raw.slice(0, i).join('');
    const b = raw.slice(i).join('');
    if (n > 3 && (visibleCount(a) < 2 || visibleCount(b) < 2)) continue;
    const font = Math.min(fitFont(a, maxW, maxPx, minPx), fitFont(b, maxW, maxPx, minPx));
    if (font < minPx || !fits(a, font) || !fits(b, font)) continue;
    const balance = Math.abs(textEm(a) - textEm(b));
    if (!best || balance < best.balance - 1e-6 || (Math.abs(balance - best.balance) < 1e-6 && font > best.font)) best = {i, balance, font};
  }
  if (best) return {font: best.font, lines: [raw.slice(0, best.i).join(''), raw.slice(best.i).join('')]};
  let pick = Math.round(n / 2);
  let bal = Infinity;
  for (let i = lo; i <= hi; i++) {
    const a = raw.slice(0, i).join('');
    const b = raw.slice(i).join('');
    if (n > 3 && (visibleCount(a) < 2 || visibleCount(b) < 2)) continue;
    const babs = Math.abs(textEm(a) - textEm(b));
    if (babs < bal) {
      bal = babs;
      pick = i;
    }
  }
  return {font: minPx, lines: [raw.slice(0, pick).join(''), raw.slice(pick).join('')].filter((s) => s.length > 0)};
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
  const b = breakLines(text, Math.max(40, maxW), maxPx, minPx);
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
  const anchorW = frameW * ANCHOR_WF;
  const anchorH = frameH * ANCHOR_HF;
  const anchorX = frameX + (frameW - anchorW) / 2;
  const anchorY = frameY + frameH * (0.5 - ANCHOR_LIFT) - anchorH / 2;
  // 顶边留 20 屏幕像素。行程取「取景框的 24%」和「画面框的 22%」里更大的那个，但不超过顶边。
  const marginRef = 20 * (bw / 720);
  const maxRise = Math.max(frameH * 0.18, anchorY - marginRef);
  const prefer = Math.max(frameH * 0.24, bh * 0.22);
  const rise = Math.min(maxRise, prefer);
  const motionH = rise / 0.24;
  const textW = anchorW * 0.72;
  const mainMax = Math.max(MAIN_MIN, Math.min(168, anchorH * 0.4));
  const subMax = Math.max(SUB_MIN, Math.min(78, anchorH * 0.18));
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
  let tags: {key: string; text: string}[] = [];

  if (clip.template === 'keyword') {
    anchorText = <Lines text={clip.data.text} color={fg} maxW={textW} maxPx={mainMax} minPx={MAIN_MIN} {...linePose} />;
  } else if (clip.template === 'checklist' || clip.template === 'steps') {
    const items = clip.data.items;
    const times = revealTimes(clip.marks.items, items.length, dur);
    const cur = clip.template === 'steps' ? Math.max(0, Math.min(items.length - 1, faceIndex)) : currentIndex(times, t);
    anchorText = <Lines text={items[cur] ?? ''} color={fg} maxW={textW} maxPx={mainMax} minPx={MAIN_MIN} {...linePose} />;
    tags = items.flatMap((text, i) => (i !== cur && t + 1e-3 >= times[i] ? [{key: `${clip.id}-t${i}`, text}] : []));
    if (clip.template === 'checklist' && clip.data.title && t + 1e-3 >= (clip.marks.title0 ?? 0)) {
      tags = [{key: `${clip.id}-title`, text: clip.data.title}, ...tags];
    }
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
    const leftAt = revealTimes(clip.marks.left, clip.data.left.length, dur);
    const said = clip.data.right.filter((_, i) => t + 1e-3 >= rightAt[i]);
    anchorText = (
      <div style={{width: '100%'}}>
        <Lines text={clip.data.rightTitle} color={fg} maxW={textW} maxPx={mainMax} minPx={MAIN_MIN} {...linePose} />
        {said.map((text, i) => (
          <Lines key={i} text={text} color={fg} maxW={textW} maxPx={subMax} minPx={SUB_MIN} {...linePose} />
        ))}
      </div>
    );
    const leftSaid = clip.data.left.filter((_, i) => t + 1e-3 >= leftAt[i]);
    tags = [{key: `${clip.id}-left`, text: [clip.data.leftTitle, ...leftSaid].filter(Boolean).join(' ')}];
    if (clip.data.verdict && clip.marks.verdict != null && t + 1e-3 >= clip.marks.verdict) {
      tags.push({key: `${clip.id}-v`, text: clip.data.verdict});
    }
  }

  tags = tags.filter((tag) => tag.text.trim()).slice(0, 3);

  // 纸签按画面边距和平台栏来放，不走 placeDecor（那个允许贴角探出画面）。
  // split 的框从画面顶开始，顶栏按整幅高度算；底边是面板底，再和平台底栏取更靠上的那条。
  const fullH = clip.mode === 'split' ? bh / SPLIT_TOP : bh;
  const safeL = TAG_EDGE;
  const safeT = Math.max(TAG_EDGE, TOP_UNSAFE * fullH);
  const safeR = bw - TAG_EDGE;
  const safeB = Math.min(clip.mode === 'split' ? bh : bh - TAG_EDGE, BOTTOM_UNSAFE * fullH);
  const travel = frameH * 0.28;
  const sweep: Rect = {
    x: anchorX - frameW * 0.2,
    y: anchorY - travel,
    width: anchorW + frameW * 0.4,
    height: anchorH + travel + frameH * 0.36,
  };
  const blocked: Rect[] = [sweep, ...avoid];
  const placed: {key: string; text: string; x: number; y: number; w: number; h: number; tilt: number; font: number}[] = [];
  // 锚点几乎占满面板宽，左右口袋放不下一张纸签。能用的是锚点落定位置和字幕之间的那条缝，左右并排。
  const sweepBottom = sweep.y + sweep.height;
  tags.forEach((tag, i) => {
    const tilt = safeTilt(TAG_TILT[i % TAG_TILT.length], -4, 4);
    const sh = shadowOffset(1080, 0.22);
    const rad = (tilt * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const sdx = sh.dx * c - sh.dy * s;
    const sdy = sh.dx * s + sh.dy * c;
    let spot: {x: number; y: number; w: number; h: number; font: number} | null = null;
    for (const font of [TAG_FONT, 36, TAG_MIN]) {
      const broken = breakLines(tag.text, Math.min(bw * 0.42, 460), font, font);
      const lineW = Math.max(...broken.lines.map((ln) => textEm(ln) * broken.font));
      const textH = broken.lines.length * broken.font * 1.08;
      const tagW = Math.ceil(lineW + TAG_PAD * 2 + 8);
      const tagH = Math.ceil(textH + TAG_PAD * 2 + 8);
      const ex = (tagW * Math.abs(c) + tagH * Math.abs(s) - tagW) / 2 + EDGE_PX;
      const ey = (tagW * Math.abs(s) + tagH * Math.abs(c) - tagH) / 2 + EDGE_PX;
      const padL = ex + Math.max(0, -sdx);
      const padT = ey + Math.max(0, -sdy);
      const padR = ex + Math.max(0, sdx);
      const padB = ey + Math.max(0, sdy);
      const minX = safeL + padL + TAG_DECKLE;
      const maxX = safeR - tagW - padR - TAG_DECKLE;
      const minY = safeT + padT;
      const maxY = safeB - tagH - padB;
      if (maxX < minX - 0.5 || maxY < minY - 0.5) continue;
      const ys: number[] = [];
      const under = sweepBottom + padT + 4;
      if (under >= minY - 0.5 && under <= maxY + 0.5) ys.push(Math.min(maxY, Math.max(minY, under)));
      for (let y = maxY; y >= minY - 0.5; y -= 8) ys.push(Math.max(minY, y));
      const xs = [minX, maxX];
      if (maxX - minX > 80) xs.push((minX + maxX) / 2);
      for (const yy of ys) {
        for (const x of xs) {
          const hit = {x: x - padL, y: yy - padT, width: tagW + padL + padR, height: tagH + padT + padB};
          if (hit.x < safeL + TAG_DECKLE - 0.5 || hit.y < safeT - 0.5 || hit.x + hit.width > safeR - TAG_DECKLE + 0.5 || hit.y + hit.height > safeB + 0.5) continue;
          if (blocked.some((r) => rectsHit(hit, r))) continue;
          spot = {x, y: yy, w: tagW, h: tagH, font: broken.font};
          blocked.push(hit);
          break;
        }
        if (spot) break;
      }
      if (spot) break;
    }
    if (!spot) return;
    placed.push({key: tag.key, text: tag.text, ...spot, tilt});
  });

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
      {placed.map((tag) => {
        const padTop = Math.max(TAG_PAD, -tag.y + 8);
        return (
          <div key={tag.key} style={{position: 'absolute', left: tag.x, top: tag.y, width: tag.w, height: tag.h}}>
            <CutShape seed={`${clip.id}-${tag.key}`} w={tag.w} h={tag.h} fill={pal.card} stroke={darken(pal.card, EDGE_DARK)} strokeWidth={EDGE_PX} shadow={shade} tilt={tag.tilt} shadowK={0.22} chunky />
            <div
              style={{
                position: 'absolute',
                left: TAG_PAD,
                right: TAG_PAD,
                top: padTop,
                bottom: TAG_PAD,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                zIndex: 1,
              }}
            >
              <Lines text={tag.text} color={pal.ink} maxW={Math.max(40, tag.w - TAG_PAD * 2)} maxPx={tag.font} minPx={tag.font} />
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
