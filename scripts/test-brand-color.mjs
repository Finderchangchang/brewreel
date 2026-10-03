// 品牌色派生：18 套主题 × 5 个品牌色。不联网。
// 画在卡片上的文字色对卡片底 ≥ 4.5:1；本来就够清楚时派生色等于原色（字符串原样）。
// 卡片上的底色对卡片 ≥ 3:1，够了同样等于原色。只动亮度，色相不变。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {brandOnCard, cardIsDark, contrastRatio, tuneLightness} from '../template/src/core/brand-contrast.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themes = JSON.parse(fs.readFileSync(path.join(root, 'template/src/core/themes.json'), 'utf8'));
const BRANDS = ['#0F766E', '#FF6B35', '#111827', '#FDE047', '#3B82F6'];

const hex = (c) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const linearize = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const oklch = (color) => {
  const rgb = hex(color);
  if (!rgb) return null;
  const [R, G, B] = rgb.map(linearize);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return {L, C, H};
};
const hueDelta = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

const fails = [];
const names = Object.keys(themes);
let checked = 0;
let unchanged = 0;
for (const name of names) {
  const card = themes[name].card;
  if (!hex(card)) {
    fails.push(`${name} 的卡片色不是 #RRGGBB`);
    continue;
  }
  for (const brand of BRANDS) {
    checked++;
    const got = brandOnCard(brand, card, themes[name].accentText);
    const ink = contrastRatio(got.accentInk, card);
    const fill = contrastRatio(got.accentFill, card);
    const raw = contrastRatio(brand, card);
    if (!(ink >= 4.5)) fails.push(`${name} + ${brand} 文字色 ${got.accentInk} 对卡片 ${ink.toFixed(2)}:1`);
    if (!(fill >= 3)) fails.push(`${name} + ${brand} 底色 ${got.accentFill} 对卡片 ${fill.toFixed(2)}:1`);
    if (raw >= 4.5 - 1e-6) {
      if (got.accentInk !== brand) fails.push(`${name} + ${brand} 文字对比度已够，派生色应等于原色，得到 ${got.accentInk}`);
      else unchanged++;
    } else if (got.accentInk === brand) fails.push(`${name} + ${brand} 文字对比度 ${raw.toFixed(2)}:1 不够，却没有调`);
    if (raw >= 3 - 1e-6) {
      if (got.accentFill !== brand) fails.push(`${name} + ${brand} 底色对比度已够，应等于原色，得到 ${got.accentFill}`);
    } else if (got.accentFill === brand) fails.push(`${name} + ${brand} 底色对比度 ${raw.toFixed(2)}:1 不够，却没有调`);
    if (got.accent !== brand) fails.push(`${name} + ${brand} accent 应保持品牌色原样`);
    const onFill = contrastRatio(got.accentText, got.accentFill);
    // 底色被调过，是为了让底上的字也能到 4.5。底色没动时，字色要么本来就够，要么保持主题原来的字色。
    if (got.accentFill !== brand) {
      if (!(onFill >= 4.5)) fails.push(`${name} + ${brand} 底色上的字 ${got.accentText} 对 ${got.accentFill} ${onFill.toFixed(2)}:1`);
    } else if (got.accentText !== themes[name].accentText && !(onFill >= 4.5)) {
      fails.push(`${name} + ${brand} 改了底上的字色却仍不够 4.5（${onFill.toFixed(2)}:1）`);
    }
    if (contrastRatio(themes[name].accentText, got.accentFill) >= 4.5 - 1e-6 && got.accentText !== themes[name].accentText) {
      fails.push(`${name} + ${brand} 原来的 accentText 已经够清楚，不应改成 ${got.accentText}`);
    }
    for (const [label, derived] of [['文字', got.accentInk], ['底色', got.accentFill]]) {
      if (derived === brand) continue;
      const src = oklch(brand);
      const out = oklch(derived);
      if (!src || !out) {
        fails.push(`${name} + ${brand} ${label}色解析失败`);
        continue;
      }
      if (cardIsDark(card) ? out.L + 1e-3 < src.L : out.L > src.L + 1e-3) {
        fails.push(`${name} + ${brand} ${label}亮度方向反了（${src.L.toFixed(3)} → ${out.L.toFixed(3)}）`);
      }
      if (src.C > 0.02 && hueDelta(src.H, out.H) > 8) {
        fails.push(`${name} + ${brand} ${label}色相偏了 ${hueDelta(src.H, out.H).toFixed(1)}°（${brand} → ${derived}）`);
      }
    }
  }
}

// 直接调一次：够清楚时连大小写都原样返回
if (tuneLightness('#0F766E', '#FFFFFF', 4.5) !== '#0F766E') fails.push('浅底上的深青绿应原样返回');
if (tuneLightness('#ff6b35', '#111111', 4.5) !== '#ff6b35') fails.push('深底上的亮橙应原样返回，包括大小写');

if (fails.length) {
  console.error(`品牌色派生没过（${fails.length}）:`);
  for (const line of fails) console.error('  ' + line);
  process.exit(1);
}
console.log(`${names.length} 套主题 × ${BRANDS.length} 个品牌色，共 ${checked} 组通过；其中 ${unchanged} 组文字色本来就够、派生色等于原色`);
