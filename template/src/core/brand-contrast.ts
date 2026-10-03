// 品牌色和卡片底色撞车时，只改 OKLCH 亮度、不动色相。
// 对比度已经够就原样返回传入的字符串，渲染结果和没调整时逐像素相同。
// 文字/图标（画在卡片上）要 4.5:1；色块/按钮/进度条（卡片上的底色）要 3:1。

export const TEXT_CONTRAST = 4.5;
export const FILL_CONTRAST = 3;

const hexOf = (c: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
};

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

// 和 theme.tsx 的 relLuminance 同一条 WCAG 折线（0.03928，不是 sRGB 的 0.04045）。
const linearize = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const delinearize = (c: number) => {
  const x = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, x)) * 255);
};

export const relLuminance = (color: string) => {
  const rgb = hexOf(color);
  if (!rgb) return 0;
  return 0.2126 * linearize(rgb[0]) + 0.7152 * linearize(rgb[1]) + 0.0722 * linearize(rgb[2]);
};

export const contrastRatio = (a: string, b: string) => {
  const hi = Math.max(relLuminance(a), relLuminance(b));
  const lo = Math.min(relLuminance(a), relLuminance(b));
  return (hi + 0.05) / (lo + 0.05);
};

/** 相对亮度低于这块时，白字对它至少有 4.5:1，算深底，往亮调。 */
export const cardIsDark = (color: string) => relLuminance(color) < 0.18;

type Oklch = {L: number; C: number; H: number};

const rgbToOklch = (r: number, g: number, b: number): Oklch => {
  const R = linearize(r);
  const G = linearize(g);
  const B = linearize(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return {L, C, H};
};

const oklchToLinear = (L: number, C: number, H: number) => {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

const inGamut = (lin: number[]) => lin.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/** 同色相、尽量保住彩度，落进 sRGB。出界就降彩度，不转色相。 */
const oklchToHex = (L: number, C: number, H: number) => {
  let lo = 0;
  let hi = Math.max(0, C);
  let best = 0;
  if (inGamut(oklchToLinear(L, hi, H))) best = hi;
  else {
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, H))) {
        best = mid;
        lo = mid;
      } else hi = mid;
    }
  }
  const [r, g, b] = oklchToLinear(L, best, H);
  return toHex(delinearize(r), delinearize(g), delinearize(b));
};

/**
 * 把 color 调到对 against 的对比度 ≥ minRatio。
 * 深底往亮调，浅底往暗调，只动 OKLCH 的 L。已经够就返回原来的字符串。
 */
export const tuneLightness = (color: string, against: string, minRatio: number) => {
  if (!hexOf(color) || !hexOf(against)) return color;
  if (contrastRatio(color, against) >= minRatio - 1e-6) return color;
  const [r, g, b] = hexOf(color)!;
  const {L, C, H} = rgbToOklch(r, g, b);
  const dark = cardIsDark(against);
  let lo = dark ? L : 0;
  let hi = dark ? 1 : L;
  let best = oklchToHex(dark ? 1 : 0, C, H);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const hex = oklchToHex(mid, C, H);
    const ok = contrastRatio(hex, against) >= minRatio - 1e-6;
    if (dark) {
      if (ok) {
        best = hex;
        hi = mid;
      } else lo = mid;
    } else if (ok) {
      best = hex;
      lo = mid;
    } else hi = mid;
  }
  if (contrastRatio(best, against) < minRatio - 1e-6) {
    const extreme = oklchToHex(dark ? 1 : 0, 0, H);
    if (contrastRatio(extreme, against) >= minRatio - 1e-6) return extreme;
  }
  return best;
};

const INK_LIGHT = '#FFFFFF';
const INK_DARK = '#1B2738';

const passes = (ratio: number, min: number) => ratio >= min - 1e-6;

/** 这个底上，原来的字色够 4.5 就留着；否则白/深色里能到 4.5 的那个。都到不了返回 null。 */
const inkAt = (bg: string, current: string) => {
  if (hexOf(current) && passes(contrastRatio(current, bg), TEXT_CONTRAST)) return current;
  const light = contrastRatio(INK_LIGHT, bg);
  const dark = contrastRatio(INK_DARK, bg);
  if (passes(Math.max(light, dark), TEXT_CONTRAST)) return light >= dark ? INK_LIGHT : INK_DARK;
  return null;
};

/**
 * 卡片上的底色。和卡片已经 ≥ 3:1 就用原色。
 * 不够就只动亮度，调到 ≥ 3:1，并且底上有字色能到 4.5:1（步骤图标、气泡字）。
 * 做不到两头都满足时，退回「只保证和卡片 ≥ 3:1」。
 */
export const tuneFill = (brand: string, card: string, accentText: string) => {
  const usable = (fill: string) => passes(contrastRatio(fill, card), FILL_CONTRAST) && inkAt(fill, accentText) !== null;
  if (usable(brand)) return brand;
  if (passes(contrastRatio(brand, card), FILL_CONTRAST)) return brand;
  if (!hexOf(brand) || !hexOf(card)) return brand;
  const [r, g, b] = hexOf(brand)!;
  const {L, C, H} = rgbToOklch(r, g, b);
  const dark = cardIsDark(card);
  let lo = dark ? L : 0;
  let hi = dark ? 1 : L;
  let best: string | null = null;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const hex = oklchToHex(mid, C, H);
    if (usable(hex)) {
      best = hex;
      if (dark) hi = mid;
      else lo = mid;
    } else if (dark) lo = mid;
    else hi = mid;
  }
  if (best && usable(best)) return best;
  return tuneLightness(brand, card, FILL_CONTRAST);
};

export type BrandOnCard = {
  /** 品牌色原样，画在页面背景上的东西继续用它 */
  accent: string;
  /** 画在卡片上的底色（按钮、进度条、色块）。和卡片 ≥ 3:1 时等于 accent */
  accentFill: string;
  /** 画在卡片上的文字和图标色。和卡片 ≥ 4.5:1 时等于 accent */
  accentInk: string;
  /** 画在 accentFill 上的字。原来的字色够清楚就不动 */
  accentText: string;
};

export const brandOnCard = (brand: string, card: string, accentText: string): BrandOnCard => {
  const accentFill = tuneFill(brand, card, accentText);
  const ink = inkAt(accentFill, accentText);
  return {
    accent: brand,
    accentFill,
    accentInk: tuneLightness(brand, card, TEXT_CONTRAST),
    accentText: ink ?? accentText,
  };
};
