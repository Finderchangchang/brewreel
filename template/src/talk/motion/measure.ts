// 动效画面的量尺：字宽估算、一行放得下的字号、清单 / 步骤的版面。纯函数，节点测试直接引用。
import {visualTop} from './stage.ts';

const isWide = (ch: string) => {
  const cp = ch.codePointAt(0) ?? 0;
  return (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xf900 && cp <= 0xfaff) || cp === 0x2026 || cp === 0x201c || cp === 0x201d;
};
/** 粗体字宽（em）：汉字 1，拉丁按字形宽窄分档 */
export const textEm = (text: string): number => {
  let w = 0;
  for (const ch of Array.from(text ?? '')) {
    if (isWide(ch)) w += 1;
    else if (ch === ' ') w += 0.28;
    else if (/[iljtfrI'!.,:;|]/.test(ch)) w += 0.34;
    else if (/[mwMW]/.test(ch)) w += 0.92;
    else if (/[A-Z]/.test(ch)) w += 0.72;
    else if (/[0-9]/.test(ch)) w += 0.6;
    else w += 0.6;
  }
  return Math.max(0.5, w);
};
/** 一行放进 maxW 的字号，夹在 [min, max] */
export const fitFont = (text: string, maxW: number, max: number, min: number) => Math.max(min, Math.min(max, Math.floor(maxW / textEm(text))));

/** 取景框是竖长的（竖版 pip / full）：字和卡片按竖长的框放大 */
export const isTall = (W: number, H: number) => H > W * 1.05;

/** 卡片右边、下边给纸层错位、木块厚度留的余量（参考像素），这样卡片连厚度一起都在取景框里 */
export const CARD_BLEED = 14;

export type ListGeom = {x0: number; contentW: number; y0: number; titleH: number; titleGap: number; rowsTop: number; rh: number; gap: number; total: number; tall: boolean};

/**
 * 清单、步骤的版面：一行一张卡，卡片用满取景框的宽（横版太宽时收到高的 1.5 倍），整块竖直居中（往上偏 4%）。
 * 竖长的框（pip / full）：行高 = (框高 − 间距) / 条数，夹在 225–330 参考像素（720 宽时 150–220 像素）；扁的框（split）行高上限 260。
 * W×H 是取景框（参考像素）；withTitle：checklist 有小标题时留一条胶囊的高度。
 */
export const listGeom = (n: number, W: number, H: number, withTitle: boolean): ListGeom => {
  const tall = isTall(W, H);
  const contentW = Math.min(W, Math.max(H * 1.5, 860)) - CARD_BLEED;
  const x0 = (W - CARD_BLEED - contentW) / 2;
  const gap = tall ? Math.max(24, Math.min(40, H * 0.03)) : Math.max(16, Math.min(30, H * 0.032));
  const titleH = withTitle ? (tall ? Math.max(96, Math.min(132, H * 0.1)) : Math.max(70, Math.min(120, H * 0.125))) : 0;
  const titleGap = withTitle ? gap * 1.15 : 0;
  const room = (H - CARD_BLEED - titleH - titleGap - gap * (n - 1)) / Math.max(1, n);
  const rhMax = tall ? 330 : Math.max(140, Math.min(260, H * 0.3));
  const rhMin = tall ? 225 : 60;
  const rh = Math.max(Math.min(60, room), Math.min(rhMax, Math.max(Math.min(rhMin, room), room)));
  const total = titleH + titleGap + n * rh + (n - 1) * gap;
  const y0 = visualTop(H - CARD_BLEED, total);
  return {x0, contentW, y0, titleH, titleGap, rowsTop: y0 + titleH + titleGap, rh, gap, total, tall};
};
