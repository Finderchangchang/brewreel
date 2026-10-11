// 和 scripts/lesson/style-rules.mjs 的 contrastRatio 同一条公式（sRGB 0.04045）。

function channel(hex: string, index: number): number {
  const n = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const left = lum(a);
  const right = lum(b);
  const hi = left > right ? left : right;
  const lo = left > right ? right : left;
  return (hi + 0.05) / (lo + 0.05);
}

export const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
