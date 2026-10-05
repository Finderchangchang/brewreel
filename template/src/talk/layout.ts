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

/** 字号最多缩到原来的这么多（为了不让一行末尾剩一两个字单独折到下一行） */
export const CAPTION_MIN_K = 0.8;
/** pip 段字幕放哪：side 圆窗左边（窄），above 圆窗上方（和 full 一样宽） */
export type PipCaption = 'side' | 'above';

const unitsOfLine = (line: string): number => Array.from(line.trim()).reduce((a, ch) => a + (WIDE_RE.test(ch) ? 1 : 0.55), 0);

/**
 * 字幕字号：最长那一行在原字号下放得下就用原字号；放不下、但缩到 80% 以内能放下，就缩到刚好放下
 * （转写排好的每行最多 12 字，竖版字幕框一行只放得下约 10.8 个字，不缩就会剩一两个字单独成行）；
 * 缩到 80% 还放不下就用原字号，让它折行。
 */
export const fitCaptionFont = (text: string, width: number, base: number): number => {
  const longest = Math.max(0, ...String(text ?? '').split('\n').map(unitsOfLine));
  if (!longest || longest * base <= width) return base;
  const fitted = Math.floor((width * 0.98) / longest);
  return fitted >= base * CAPTION_MIN_K ? fitted : base;
};

/** 字幕的基准：原字号、左边距、字幕框宽（full 和 split 用这个宽度） */
const captionBase = (width: number, height: number) => ({
  fontSize: Math.max(36, Math.round((height * 72) / 1920)),
  x: Math.round((width * 150) / 1080),
  boxW: Math.round((width * 780) / 1080),
});

/** pip 段放在圆窗左边时字幕框的宽度 */
const pipSideWidth = (width: number, height: number): number => {
  const {x, boxW} = captionBase(width, height);
  const {d, margin} = pipOf(width, height);
  const faceLeft = width - margin - d;
  return Math.min(boxW, Math.max(120, faceLeft - Math.round(16 * uiScale(width, height)) - x));
};

/**
 * pip 段的字幕放哪：这一段里每句字幕在圆窗左边都放得下（字号缩到 80% 以内、不多折行）就放左边；
 * 有一句放不下就整段放到圆窗上方、用满宽度（720 宽竖版的左边只放得下约 7 个字，八个字的一行会剩一个字单独成行）。
 */
export const pipCaptionPlacement = (width: number, height: number, texts: string[]): PipCaption => {
  const w = pipSideWidth(width, height);
  const {fontSize: base} = captionBase(width, height);
  for (const text of texts) {
    const size = fitCaptionFont(text, w, base);
    const want = String(text ?? '').split('\n').length;
    if (captionLinesOf(text, w, size) > want) return 'above';
  }
  return 'side';
};

/**
 * 一句字幕在这一摆法下的位置、字号和行数。
 * full：顶边在画面 3/4 处往下排；pip：side 和 full 一样高、框收窄到圆窗左边，above 贴在圆窗上方、按行数往上留高；
 * split：贴在分界线上方，按行数往上留高（v0.8 只留一行，两行字幕的第二行会压进下半张脸）。
 */
export const captionFor = (mode: 'full' | 'pip' | 'split', width: number, height: number, text: string, placement: PipCaption = 'side'): CaptionBox => {
  const {fontSize: base, x, boxW} = captionBase(width, height);
  const w = mode === 'pip' && placement === 'side' ? pipSideWidth(width, height) : boxW;
  const fontSize = fitCaptionFont(text, w, base);
  const lines = captionLinesOf(text, w, fontSize);
  const stroke = Math.max(4, Math.round(fontSize * 0.15));
  const block = Math.round(fontSize * CAPTION_LINE);
  let y = Math.round(height * 0.75);
  if (mode === 'split') y = Math.max(0, Math.round(height * SPLIT_TOP) - lines * block - Math.round(height * 0.012));
  else if (mode === 'pip' && placement === 'above') {
    const {d, margin} = pipOf(width, height);
    y = Math.max(0, height - margin - d - Math.round(16 * uiScale(width, height)) - lines * block);
  }
  return {x, y, width: w, fontSize, stroke, lines};
};

/** 按行数排的老接口（原字号）：layoutOf 传数字时用，测试和 v0.8 的调用照旧。 */
const captionOf = (mode: 'full' | 'pip' | 'split', width: number, height: number, lines: number): CaptionBox => {
  const {fontSize, x, boxW} = captionBase(width, height);
  const stroke = Math.max(4, Math.round(fontSize * 0.15));
  const n = Math.max(1, Math.round(lines) || 1);
  const block = Math.round(fontSize * CAPTION_LINE);
  if (mode === 'split') {
    const line = Math.round(height * SPLIT_TOP);
    return {x, y: Math.max(0, line - n * block - Math.round(height * 0.012)), width: boxW, fontSize, stroke, lines: n};
  }
  return {x, y: Math.round(height * 0.75), width: mode === 'pip' ? pipSideWidth(width, height) : boxW, fontSize, stroke, lines: n};
};

/** 一句字幕在这一摆法下占几行（字号按 fitCaptionFont 缩过之后）。 */
export const captionLinesFor = (mode: 'full' | 'pip' | 'split', width: number, height: number, text: string, placement: PipCaption = 'side'): number =>
  captionFor(mode, width, height, text, placement).lines;

/**
 * full 盖满；pip 右下角圆形小窗；split 上 60% 是 B-roll、下 40% 是口播。
 * cap：当前字幕。传 {text, placement} 时字号和位置按这句字幕算（Talk.tsx 用）；传数字时只按行数排（老接口）。
 */
export const layoutOf = (mode: 'full' | 'pip' | 'split', width: number, height: number, cap: number | {text: string; placement?: PipCaption} = 1): TalkLayout => {
  const s = uiScale(width, height);
  const badge = {x: Math.round(36 * s), y: Math.round(36 * s)};
  const caption = typeof cap === 'number' ? captionOf(mode, width, height, cap) : captionFor(mode, width, height, cap.text, cap.placement ?? 'side');
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
