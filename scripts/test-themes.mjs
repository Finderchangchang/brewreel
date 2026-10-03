// 18 套主题的对比度，外加字幕重点词的三条数值规则。不联网。
// 对比度算法和 template/src/core/theme.tsx 的 relLuminance / contrastRatio / inkOn 保持一致。
// 正文（卡片字、强调色小标签、accent 上的字）≥ 4.5:1；大字（字幕）和图形（图表系列色）≥ 3:1。
// 重点词（hot）另外三条，只强制 12 套新配色：
//   1. 和普通字 capFill 的 CIEDE2000 ΔE ≥ 30（算法在 scripts/lib/color.mjs）
//   2. 和 bgTop 每一档的对比度 ≥ 3:1
//   3. 普通字接近中性（LCh 彩度 C* < 12，和 color.mjs 里「近黑 / 近白 / 灰」同一条线）时，重点词彩度 C* ≥ 35
// 12 套新配色必须全过。原来 6 套不过的只记录，不把这次运行判失败（它们靠描边，不改色）。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chroma, deltaE} from './lib/color.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themes = JSON.parse(fs.readFileSync(path.join(root, 'template/src/core/themes.json'), 'utf8'));
const ORIGINAL = ['warm-emotion', 'tech-dark', 'fresh-light', 'business-blue', 'festival-red', 'mono-premium'];
const NEUTRAL_C = 12;
const HOT_CHROMA = 35;
const HOT_DELTA_E = 30;

const hex = (c) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const relLuminance = (color) => {
  const rgb = hex(color);
  if (!rgb) return null;
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};
const contrastRatio = (a, b) => {
  const x = relLuminance(a);
  const y = relLuminance(b);
  if (x == null || y == null) return null;
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  return (hi + 0.05) / (lo + 0.05);
};
const inkOn = (color) => {
  const rgb = hex(color);
  return rgb && rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 165 ? '#1B2738' : '#FFFFFF';
};

const fails = [];
const legacy = [];
for (const [name, th] of Object.entries(themes)) {
  const bgs = [...(th.bgTop ?? []), ...(th.bgBot ?? [])].filter((c) => hex(c));
  const issues = [];
  const capBg = bgs.length ? Math.min(...bgs.map((b) => contrastRatio(th.capFill, b))) : null;
  const hotBg = bgs.length ? Math.min(...bgs.map((b) => contrastRatio(th.hot, b))) : null;
  if (capBg != null && capBg < 3) issues.push(`字幕正文 ${th.capFill} 对底色 ${capBg.toFixed(2)}:1`);
  if (hotBg != null && hotBg < 3) issues.push(`字幕重点 ${th.hot} 对底色 ${hotBg.toFixed(2)}:1`);
  for (const b of th.bgTop ?? []) {
    const r = contrastRatio(th.hot, b);
    if (r != null && r < 3) issues.push(`字幕重点 ${th.hot} 对 bgTop ${b} ${r.toFixed(2)}:1`);
  }
  const dE = deltaE(th.hot, th.capFill);
  if (!(dE >= HOT_DELTA_E)) issues.push(`字幕重点 ${th.hot} 对正文 ${th.capFill} ΔE ${Number.isFinite(dE) ? dE.toFixed(1) : '无法计算'}`);
  const capC = chroma(th.capFill);
  const hotC = chroma(th.hot);
  if (capC < NEUTRAL_C && !(hotC >= HOT_CHROMA)) {
    issues.push(`正文接近中性（C ${Number.isFinite(capC) ? capC.toFixed(1) : '无法计算'}），重点 ${th.hot} 彩度 C ${Number.isFinite(hotC) ? hotC.toFixed(1) : '无法计算'} < ${HOT_CHROMA}`);
  }
  if (String(th.hot).toLowerCase() === String(th.capFill).toLowerCase()) issues.push('字幕重点色和正文字颜色相同');
  const onHot = th.onHot || inkOn(th.hot);
  const hotInk = contrastRatio(onHot, th.hot);
  if (hotInk != null && hotInk < 4.5) issues.push(`强调色底上的字 ${onHot} 对 ${th.hot} ${hotInk.toFixed(2)}:1`);
  const accentInk = contrastRatio(th.accentText, th.accent);
  if (accentInk != null && accentInk < 4.5) issues.push(`accentText 对 accent ${accentInk.toFixed(2)}:1`);
  const cardInk = contrastRatio(th.cardText, th.card);
  if (cardInk != null && cardInk < 4.5) issues.push(`卡片正文对卡片底 ${cardInk.toFixed(2)}:1`);
  for (const c of th.chartColors ?? []) {
    const r = contrastRatio(c, th.card);
    if (r != null && r < 3) issues.push(`图表色 ${c} 对卡片底 ${r.toFixed(2)}:1`);
  }
  if (!issues.length) continue;
  const line = `${name}：${issues.join('；')}`;
  if (ORIGINAL.includes(name)) legacy.push(line);
  else fails.push(line);
}

if (legacy.length) {
  console.log('原来 6 套有对比度不足（描边主题，这次不改、不算失败）：');
  for (const line of legacy) console.log('  ' + line);
} else console.log('原来 6 套：没有需要记录的对比度问题');

if (fails.length) {
  console.error('新配色没过：');
  for (const line of fails) console.error('  ' + line);
  process.exit(1);
}
console.log(`新配色 ${Object.keys(themes).length - ORIGINAL.length} 套通过，共 ${Object.keys(themes).length} 套`);
