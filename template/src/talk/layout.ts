// 口播配 B-roll 的三种摆法。纯函数，节点测试直接引用。
// 尺寸按画面缩放：下面的像素值是 1080 宽竖版 / 1920 宽横版时的大小，别的分辨率按宽度等比换算。
export const PIP_MARGIN = 64;
export const PIP_DIAMETER_V = 320;
export const PIP_DIAMETER_H = 260;
/** 上面三个数对应的参考宽度：竖版 1080、横版 1920。 */
export const PIP_REF_W_V = 1080;
export const PIP_REF_W_H = 1920;
export const SPLIT_TOP = 0.6;
export const FADE_SEC = 0.2;
/** 字幕一行占多高（字号的倍数）。和 Talk.tsx 里 CaptionLayer 的 lineHeight 1.18 留一点余量。 */
export const CAPTION_LINE = 1.2;

export type Rect = {x: number; y: number; width: number; height: number};
export type FaceLayout = Rect & {shape: 'circle' | 'rect'};
export type CaptionBox = {x: number; y: number; width: number; fontSize: number; stroke: number; lines: number};

export type TalkLayout = {
  broll: Rect;
  face: FaceLayout | null;
  badge: {x: number; y: number};
  caption: CaptionBox;
};

/** 画面里固定元素（角标、留边）的缩放比例：以短边 1080 为 1。 */
export const uiScale = (width: number, height: number): number => Math.max(0.3, Math.min(width, height) / 1080);

/** 画中画圆窗：直径和边距按画面宽度等比缩放（v0.8 写死像素，720 宽竖版的圆窗相对画面大了一半）。 */
export const pipOf = (width: number, height: number): {d: number; margin: number} => {
  const vertical = height > width;
  const k = width / (vertical ? PIP_REF_W_V : PIP_REF_W_H);
  return {d: Math.round((vertical ? PIP_DIAMETER_V : PIP_DIAMETER_H) * k), margin: Math.round(PIP_MARGIN * k)};
};

const WIDE_RE = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/; // i18n-ignore 只是字宽判断

/**
 * 一句字幕在给定宽度里要占几行：按换行符分段，每段按字宽估算折行（汉字算 1 个字号宽，英文和数字算 0.55）。
 * 估多不估少，宁可多留一点空。
 */
export const captionLinesOf = (text: string, width: number, fontSize: number): number => {
  const perLine = Math.max(1, width / Math.max(1, fontSize));
  return String(text ?? '')
    .split('\n')
    .reduce((n, line) => {
      const units = Array.from(line.trim()).reduce((a, ch) => a + (WIDE_RE.test(ch) ? 1 : 0.55), 0);
      return n + Math.max(1, Math.ceil(units / perLine - 1e-6));
    }, 0);
};

/**
 * full / pip：字幕顶边在画面 3/4 处，往下排。
 * split：贴在分界线上方，按行数往上留高（v0.8 只留一行，两行字幕的第二行会压进下半张脸）。
 */
const captionOf = (mode: 'full' | 'pip' | 'split', width: number, height: number, lines: number): CaptionBox => {
  const fontSize = Math.max(36, Math.round((height * 72) / 1920));
  const x = Math.round((width * 150) / 1080);
  let boxW = Math.round((width * 780) / 1080);
  const stroke = Math.max(4, Math.round(fontSize * 0.15));
  const n = Math.max(1, Math.round(lines) || 1);
  const block = Math.round(fontSize * CAPTION_LINE);
  if (mode === 'split') {
    const line = Math.round(height * SPLIT_TOP);
    return {x, y: Math.max(0, line - n * block - Math.round(height * 0.012)), width: boxW, fontSize, stroke, lines: n};
  }
  const y = Math.round(height * 0.75);
  if (mode === 'pip') {
    const {d, margin} = pipOf(width, height);
    const faceLeft = width - margin - d;
    boxW = Math.min(boxW, Math.max(120, faceLeft - Math.round(16 * uiScale(width, height)) - x));
  }
  return {x, y, width: boxW, fontSize, stroke, lines: n};
};

/** 一句字幕在这一摆法下占几行。 */
export const captionLinesFor = (mode: 'full' | 'pip' | 'split', width: number, height: number, text: string): number => {
  const c = captionOf(mode, width, height, 1);
  return captionLinesOf(text, c.width, c.fontSize);
};

/** full 盖满；pip 右下角圆形小窗；split 上 60% 是 B-roll、下 40% 是口播。lines 是当前字幕的行数（只影响 split 的字幕位置）。 */
export const layoutOf = (mode: 'full' | 'pip' | 'split', width: number, height: number, lines = 1): TalkLayout => {
  const s = uiScale(width, height);
  const badge = {x: Math.round(36 * s), y: Math.round(36 * s)};
  const caption = captionOf(mode, width, height, lines);
  if (mode === 'split') {
    const bh = Math.round(height * SPLIT_TOP);
    return {
      broll: {x: 0, y: 0, width, height: bh},
      face: {x: 0, y: bh, width, height: height - bh, shape: 'rect'},
      badge,
      caption,
    };
  }
  if (mode === 'pip') {
    const {d, margin} = pipOf(width, height);
    return {
      broll: {x: 0, y: 0, width, height},
      face: {x: width - margin - d, y: height - margin - d, width: d, height: d, shape: 'circle'},
      badge,
      caption,
    };
  }
  return {
    broll: {x: 0, y: 0, width, height},
    face: null,
    badge,
    caption,
  };
};
