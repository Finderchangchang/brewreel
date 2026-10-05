// 口播配 B-roll 的三种摆法。纯函数，节点测试直接引用。
// 尺寸按画面缩放：下面的像素值是 1080 宽竖版 / 1920 宽横版时的大小，别的分辨率按宽度等比换算。
export const PIP_MARGIN = 64;
export const PIP_DIAMETER_V = 320;
export const PIP_DIAMETER_H = 260;
/** 上面三个数对应的参考宽度：竖版 1080、横版 1920。 */
export const PIP_REF_W_V = 1080;
export const PIP_REF_W_H = 1920;
export const SPLIT_TOP = 0.6;
/** 进出场的时长（秒）：真人只有一个视频层，在这段时间里从全屏收到下方 40%（split）或右下圆窗（pip），出场倒放。见 transition.ts */
export const TRANS_SEC = 0.36;
/** 老名字（v0.8 是 0.2 秒交叉淡化），保留导出，值跟着 TRANS_SEC */
export const FADE_SEC = TRANS_SEC;
/** 动效段的画中画圆窗比视频段大这么多倍（人优先：720 宽竖版直径 213 → 250） */
export const MOTION_PIP_K = 1.17;
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
export const pipOf = (width: number, height: number, pipK = 1): {d: number; margin: number} => {
  const vertical = height > width;
  const k = width / (vertical ? PIP_REF_W_V : PIP_REF_W_H);
  return {d: Math.round((vertical ? PIP_DIAMETER_V : PIP_DIAMETER_H) * k * (pipK > 0 ? pipK : 1)), margin: Math.round(PIP_MARGIN * k)};
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

/** pip 段放在圆窗左边时字幕框的宽度（pipK：圆窗放大倍数，动效段用 MOTION_PIP_K） */
const pipSideWidth = (width: number, height: number, pipK = 1): number => {
  const {x, boxW} = captionBase(width, height);
  const {d, margin} = pipOf(width, height, pipK);
  const faceLeft = width - margin - d;
  return Math.min(boxW, Math.max(120, faceLeft - Math.round(16 * uiScale(width, height)) - x));
};

/**
 * pip 段的字幕放哪：这一段里每句字幕在圆窗左边都放得下（字号缩到 80% 以内、不多折行）就放左边；
 * 有一句放不下就整段放到圆窗上方、用满宽度（720 宽竖版的左边只放得下约 7 个字，八个字的一行会剩一个字单独成行）。
 */
export const pipCaptionPlacement = (width: number, height: number, texts: string[], pipK = 1): PipCaption => {
  const w = pipSideWidth(width, height, pipK);
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
export const captionFor = (mode: 'full' | 'pip' | 'split', width: number, height: number, text: string, placement: PipCaption = 'side', pipK = 1): CaptionBox => {
  const {fontSize: base, x, boxW} = captionBase(width, height);
  const w = mode === 'pip' && placement === 'side' ? pipSideWidth(width, height, pipK) : boxW;
  const fontSize = fitCaptionFont(text, w, base);
  const lines = captionLinesOf(text, w, fontSize);
  const stroke = Math.max(4, Math.round(fontSize * 0.15));
  const block = Math.round(fontSize * CAPTION_LINE);
  let y = Math.round(height * 0.75);
  if (mode === 'split') y = Math.max(0, Math.round(height * SPLIT_TOP) - lines * block - Math.round(height * 0.012));
  else if (mode === 'pip' && placement === 'above') {
    const {d, margin} = pipOf(width, height, pipK);
    y = Math.max(0, height - margin - d - Math.round(16 * uiScale(width, height)) - lines * block);
  }
  return {x, y, width: w, fontSize, stroke, lines};
};

/** 按行数排的老接口（原字号）：layoutOf 传数字时用，测试和 v0.8 的调用照旧。 */
const captionOf = (mode: 'full' | 'pip' | 'split', width: number, height: number, lines: number, pipK = 1): CaptionBox => {
  const {fontSize, x, boxW} = captionBase(width, height);
  const stroke = Math.max(4, Math.round(fontSize * 0.15));
  const n = Math.max(1, Math.round(lines) || 1);
  const block = Math.round(fontSize * CAPTION_LINE);
  if (mode === 'split') {
    const line = Math.round(height * SPLIT_TOP);
    return {x, y: Math.max(0, line - n * block - Math.round(height * 0.012)), width: boxW, fontSize, stroke, lines: n};
  }
  return {x, y: Math.round(height * 0.75), width: mode === 'pip' ? pipSideWidth(width, height, pipK) : boxW, fontSize, stroke, lines: n};
};

/** 一句字幕在这一摆法下占几行（字号按 fitCaptionFont 缩过之后）。 */
export const captionLinesFor = (mode: 'full' | 'pip' | 'split', width: number, height: number, text: string, placement: PipCaption = 'side', pipK = 1): number =>
  captionFor(mode, width, height, text, placement, pipK).lines;

/**
 * full 盖满；pip 右下角圆形小窗；split 上 60% 是 B-roll、下 40% 是口播。
 * cap：当前字幕。传 {text, placement} 时字号和位置按这句字幕算（Talk.tsx 用）；传数字时只按行数排（老接口）。
 */
export const layoutOf = (mode: 'full' | 'pip' | 'split', width: number, height: number, cap: number | {text: string; placement?: PipCaption} = 1, pipK = 1): TalkLayout => {
  const s = uiScale(width, height);
  const badge = {x: Math.round(36 * s), y: Math.round(36 * s)};
  const caption = typeof cap === 'number' ? captionOf(mode, width, height, cap, pipK) : captionFor(mode, width, height, cap.text, cap.placement ?? 'side', pipK);
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
    const {d, margin} = pipOf(width, height, pipK);
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

const SOFT_RE = /[\s，。、！？：；,.!?:;“”"'‘’（）()【】…—\-–·~～《》「」『』]/u;
const trimSoft = (s: string): string => {
  const a = Array.from(s);
  while (a.length && SOFT_RE.test(a[0])) a.shift();
  while (a.length && SOFT_RE.test(a[a.length - 1])) a.pop();
  return a.join('');
};

/**
 * keyword 段在画面上时，字幕和大字说的是同一句话，屏上出现两遍。这一句字幕里有 keyword（不计标点空格）就只留多出的部分
 * （「关键是，它不会乱编数字」→「关键是」），多出的不到 2 个字就整句不显示；没整截包含、但 keyword 八成以上的字都在这句里，也不显示。
 * 返回要显示的字（'' = 这句不显示）。只删字，不加字。
 */
export const captionMinusKeyword = (text: string, keyword: string): string => {
  const kw = Array.from(String(keyword ?? '')).filter((ch) => !SOFT_RE.test(ch));
  const src = String(text ?? '');
  if (!kw.length || !src) return src;
  const chars = Array.from(src);
  const idx: number[] = [];
  const flat: string[] = [];
  chars.forEach((ch, i) => {
    if (!SOFT_RE.test(ch)) {
      idx.push(i);
      flat.push(ch);
    }
  });
  const at = flat.join('').indexOf(kw.join(''));
  if (at >= 0) {
    const a = idx[at];
    const b = idx[at + kw.length - 1];
    const parts = [trimSoft(chars.slice(0, a).join('')), trimSoft(chars.slice(b + 1).join(''))].filter(Boolean);
    const left = parts.join(' ');
    const meaningful = Array.from(left).filter((ch) => !SOFT_RE.test(ch)).length;
    return meaningful >= 2 ? left : '';
  }
  const pool = new Map<string, number>();
  for (const ch of flat) pool.set(ch, (pool.get(ch) ?? 0) + 1);
  let hit = 0;
  for (const ch of kw) {
    const n = pool.get(ch) ?? 0;
    if (n > 0) {
      hit++;
      pool.set(ch, n - 1);
    }
  }
  return hit / kw.length >= 0.8 ? '' : src;
};
