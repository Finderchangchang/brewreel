// 逐字字幕：去掉已经写在屏上的大字，并选出舞台上够对比度的字色。
// 位置在 safe-box.ts 的底部字幕带，不在这里算。
import {captionMinusKeyword} from '../talk/layout.ts';
import {contrastRatio} from './contrast.ts';

const SOFT = /[\s，。、！？：；,.!?:;“”"'‘’（）()【】…—\-–·~～《》「」『』]/u;
/** 扣重之后挂在碎片末尾的虚词、量词。不成句，丢掉。 */
const TRAILING_PARTICLES = new Set(['一共', '就是', '才是', '还有', '只是', '还是', '只剩']);

export function plainChars(text: string): string {
  return Array.from(String(text ?? '')).filter((ch) => !SOFT.test(ch)).join('');
}

function addPhrase(out: string[], value: unknown) {
  if (typeof value !== 'string') return;
  if (plainChars(value).length < 2) return;
  out.push(value);
}

/** 屏上的大字：标题、判断句、收束、数字、条目，以及同样大的说明、品牌和行动句。不含 kicker 和条目注。 */
export function onScreenPhrases(screen: {
  text?: string;
  title?: string;
  line?: string;
  support?: string;
  brand?: string;
  cta?: string;
  number?: {text?: string; label?: string};
  items?: {text?: string}[];
  left?: {label?: string; items?: unknown[]};
  right?: {label?: string; items?: unknown[]};
} | null | undefined): string[] {
  const out: string[] = [];
  if (!screen) return out;
  for (const key of ['text', 'title', 'line', 'support', 'brand', 'cta'] as const) addPhrase(out, screen[key]);
  addPhrase(out, screen.number?.text);
  addPhrase(out, screen.number?.label);
  for (const item of screen.items || []) addPhrase(out, item?.text);
  for (const side of ['left', 'right'] as const) {
    const pane = screen[side];
    if (!pane) continue;
    addPhrase(out, pane.label);
    for (const item of pane.items || []) addPhrase(out, typeof item === 'string' ? item : (item as {text?: string})?.text);
  }
  return out;
}

/**
 * 旁白里已经出现在屏上的大字不再进字幕。整句都被去掉时返回空串，这一屏不出字幕。
 * 每一段都走口播剪纸的 captionMinusKeyword：整截删掉，剩下不到两个字也整句不显示。
 * 长的先删，避免短数字先挖掉、后面的整句对不上。
 */
function keepLongestCaptionFragment(text: string): string {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  const fragments = raw.split(/[\s，。、！？：；,.!?:;]+/u).map((part) => part.trim()).filter(Boolean);
  if (fragments.length <= 1) return raw;
  const candidates = fragments.filter((part) => {
    const plain = plainChars(part);
    if (!plain || TRAILING_PARTICLES.has(plain)) return false;
    return plain.length >= 4;
  });
  if (!candidates.length) return '';
  return [...candidates].sort((a, b) => plainChars(b).length - plainChars(a).length)[0];
}

export function captionRemainder(narration: string, phrases: string[]): string {
  let text = String(narration ?? '');
  const ranked = [...phrases].sort((a, b) => plainChars(b).length - plainChars(a).length);
  for (const phrase of ranked) {
    if (!text) break;
    text = captionMinusKeyword(text, phrase);
  }
  return keepLongestCaptionFragment(text.trim());
}

function channel(hex: string, shift: number): number {
  return (Number.parseInt(hex.slice(1), 16) >> shift) & 255;
}

function mixHex(a: string, b: string, t: number): string {
  const mix = (shift: number) => {
    const from = channel(a, shift);
    const to = channel(b, shift);
    return Math.max(0, Math.min(255, Math.round(from + (to - from) * t)));
  };
  const packed = (mix(16) << 16) | (mix(8) << 8) | mix(0);
  return `#${packed.toString(16).padStart(6, '0').toUpperCase()}`;
}

function darken(fg: string, bg: string, min: number): {color: string; ratio: number} {
  let color = fg.toUpperCase();
  let ratio = contrastRatio(color, bg);
  let packed = Number.parseInt(color.slice(1), 16);
  for (let step = 0; step < 24 && ratio < min; step++) {
    let r = (packed >> 16) & 255;
    let g = (packed >> 8) & 255;
    let b = packed & 255;
    r = Math.max(0, Math.round(r * 0.82));
    g = Math.max(0, Math.round(g * 0.82));
    b = Math.max(0, Math.round(b * 0.82));
    packed = (r << 16) | (g << 8) | b;
    color = `#${packed.toString(16).padStart(6, '0').toUpperCase()}`;
    ratio = contrastRatio(color, bg);
  }
  return {color, ratio};
}

function lighten(fg: string, bg: string, min: number): {color: string; ratio: number} {
  let best = {color: fg.toUpperCase(), ratio: contrastRatio(fg, bg)};
  for (let step = 1; step <= 16; step++) {
    const color = mixHex(fg, '#FFFFFF', step / 16);
    const ratio = contrastRatio(color, bg);
    if (ratio > best.ratio) best = {color, ratio};
    if (ratio >= min) return {color, ratio};
  }
  return best;
}

/** 在原色、调深、调浅里挑对比度够 4.5 的。深底调深会更看不清，所以两侧都试。 */
export function fitContrast(fg: string, bg: string, min = 4.5): {color: string; ratio: number; adjusted: boolean} {
  const upper = fg.toUpperCase();
  const start = contrastRatio(upper, bg);
  if (start >= min) return {color: upper, ratio: start, adjusted: false};
  const dark = darken(upper, bg, min);
  const light = lighten(upper, bg, min);
  const best = dark.ratio >= light.ratio ? dark : light;
  return {color: best.color, ratio: best.ratio, adjusted: true};
}

export type CaptionPaint = {
  ink: string;
  hot: string;
  bg: string;
  shadow: string;
  inkRatio: number;
  hotRatio: number;
  inkAdjusted: boolean;
  hotAdjusted: boolean;
};

function distinctHot(
  hot: {color: string; ratio: number; adjusted: boolean},
  ink: string,
  bg: string,
): {color: string; ratio: number; adjusted: boolean} {
  if (hot.color !== ink && hot.ratio >= 4.5) return hot;
  for (const alt of ['#FFFFFF', '#1C1915', '#F4EFE4']) {
    const next = fitContrast(alt, bg);
    if (next.color !== ink && next.ratio >= 4.5) return {...next, adjusted: true};
  }
  return hot;
}

/**
 * 字幕画在舞台上，不铺底板。
 * techbrief 用舞台浅色（prepare 已经算好的 stage）；A / B 用令牌 ink。
 * 点亮用令牌 accent，不够 4.5 就调到过线，并且和底色字不是同一个色。
 * bg 取字幕带中线处的舞台色：渐变按这条高度采样，纯色直接用 bg。
 */
export function captionPaint(input: {
  style: string;
  ink: string;
  accent: string;
  bg: string;
  stage: string;
  backdropTop: string;
  backdropBottom: string;
  canvasH: number;
  laneY: number;
  laneH: number;
}): CaptionPaint {
  const flat = input.backdropTop.toUpperCase() === input.backdropBottom.toUpperCase();
  const t = input.canvasH > 0 ? (input.laneY + input.laneH / 2) / input.canvasH : 1;
  const bg = (flat ? input.bg : mixHex(input.backdropTop, input.backdropBottom, Math.max(0, Math.min(1, t)))).toUpperCase();
  const prefer = input.style === 'techbrief' ? input.stage : input.ink;
  const ink = fitContrast(prefer, bg);
  const hot = distinctHot(fitContrast(input.accent, bg), ink.color, bg);
  return {
    ink: ink.color,
    hot: hot.color,
    bg,
    shadow: input.style === 'techbrief' ? '0 2px 0 rgba(20,12,8,0.55), 0 0 8px rgba(20,12,8,0.35)' : 'none',
    inkRatio: ink.ratio,
    hotRatio: hot.ratio,
    inkAdjusted: ink.adjusted,
    hotAdjusted: hot.adjusted,
  };
}
