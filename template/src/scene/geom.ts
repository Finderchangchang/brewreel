// hero / stack / split 的几何。只算矩形和字号，不画。
// 疏密：间距约占行高的 tight 0.06 / regular 0.12 / loose 0.20。
// 行高先按这个比例求，再被 maxRow 封顶（宣传片 200、讲课横版 96、竖版 142）。
// 没被封顶时，把剩余高度分进行里，尽量用满安全区；封顶后整组垂直居中。
// 字号跟着行高放大，停在标题上限。放不下就停在该产品下限，不把整卡缩到 0.8。
import type {Align, Density, FontFloor, ProtoLayout, SafeFrame, SceneBlock} from './types.ts';

const RATIO: Record<Density, number> = {tight: 0.06, regular: 0.12, loose: 0.2};

export type GeomInput = {
  layout: ProtoLayout;
  count: number;
  chars: number[];
  safe: SafeFrame;
  floor: FontFloor;
  maxRow: number;
  density?: Density;
  align?: Align;
  winner?: 'left' | 'right' | 'none';
  emphasis?: 'even' | 'focus';
  /** 竖画面的 split 改成上下，不改成左右。 */
  portrait?: boolean;
};

export type GeomResult = {
  layout: ProtoLayout;
  blocks: SceneBlock[];
  gap: number;
  row: number;
  font: number;
  floor: number;
  overflow: boolean;
  /** hero 主块面积 / 安全区面积。其他原型为 0。 */
  mainAreaRatio: number;
};

const clampCount = (n: number) => Math.max(1, Math.min(8, Math.round(n) || 1));

/** 主块按标题字号收紧时的高度：行盒 1.25，再加上下各 16 的内边距。 */
function textBoxH(charCount: number, width: number, font: number): number {
  const innerW = Math.max(1, width - 36);
  const per = Math.max(1, Math.floor(innerW / Math.max(1, font)));
  const lines = Math.ceil(Math.max(1, charCount) / per);
  return lines * Math.ceil(font * 1.25) + 32;
}

function fitFont(chars: number, width: number, height: number, max: number, min: number): {font: number; overflow: boolean} {
  const n = Math.max(1, chars);
  const innerW = Math.max(1, width - 24);
  const innerH = Math.max(1, height - 8);
  let font = Math.floor(max);
  const minFont = Math.floor(min);
  while (font > minFont) {
    const per = Math.max(1, Math.floor(innerW / font));
    const lines = Math.ceil(n / per);
    if (lines * font * 1.25 <= innerH) return {font, overflow: false};
    font -= 1;
  }
  const per = Math.max(1, Math.floor(innerW / minFont));
  const lines = Math.ceil(n / per);
  return {font: minFont, overflow: lines * minFont * 1.25 > innerH};
}

function finish(block: SceneBlock, safe: SafeFrame): SceneBlock {
  let x = Math.round(block.x);
  let y = Math.round(block.y);
  let w = Math.round(block.w);
  let h = Math.round(block.h);
  const right = safe.x + safe.w;
  const bottom = safe.y + safe.h;
  if (x < safe.x) {
    w -= safe.x - x;
    x = safe.x;
  }
  if (y < safe.y) {
    h -= safe.y - y;
    y = safe.y;
  }
  if (x + w > right) w = right - x;
  if (y + h > bottom) h = bottom - y;
  const reserve = safe.reserve;
  if (reserve && y + h > reserve.y && x + w > reserve.x) w = Math.min(w, reserve.rowRight - x);
  return {...block, x, y, w: Math.max(1, w), h: Math.max(1, h)};
}

function stackMetrics(height: number, count: number, maxRow: number, ratio: number) {
  let row = Math.floor(height / (count + ratio * Math.max(0, count - 1)));
  if (row > maxRow) row = maxRow;
  if (row < 1) row = 1;
  let gap = count > 1 ? Math.round(ratio * row) : 0;
  let total = row * count + gap * Math.max(0, count - 1);
  while (total > height && row > 1) {
    row -= 1;
    gap = count > 1 ? Math.round(ratio * row) : 0;
    total = row * count + gap * Math.max(0, count - 1);
  }
  while (total > height && gap > 0) {
    gap -= 1;
    total = row * count + gap * Math.max(0, count - 1);
  }
  // 6 条这类没顶到上限的，把剩下的像素分进行高，整组尽量贴满安全区。
  if (row < maxRow && count > 0) {
    const add = Math.min(maxRow - row, Math.floor((height - total) / count));
    if (add > 0) {
      row += add;
      gap = count > 1 ? Math.round(ratio * row) : 0;
      total = row * count + gap * Math.max(0, count - 1);
      while (total > height && row > 1) {
        row -= 1;
        gap = count > 1 ? Math.round(ratio * row) : 0;
        total = row * count + gap * Math.max(0, count - 1);
      }
      while (total > height && gap > 0) {
        gap -= 1;
        total = row * count + gap * Math.max(0, count - 1);
      }
    }
  }
  return {row, gap, total};
}

/** 行内扣掉上下各 16 的内边距后，字号能用到的上限。不低于调用方给的底，不超过标题上限。 */
function fontCapForRow(row: number, base: number, ceiling: number): number {
  const grown = Math.max(1, Math.floor(Math.max(1, row - 32) / 1.25));
  return Math.max(base, Math.min(ceiling, grown));
}

function placeRows(safe: SafeFrame, count: number, chars: number[], floor: number, maxFont: number, maxRow: number, ratio: number, align: Align, role: SceneBlock['role'], ceiling = maxFont): {blocks: SceneBlock[]; gap: number; row: number; overflow: boolean} {
  const {row, gap, total} = stackMetrics(safe.h, count, maxRow, ratio);
  const cap = fontCapForRow(row, maxFont, ceiling);
  const y0 = safe.y + Math.floor((safe.h - total) / 2);
  let overflow = false;
  let fontMin = maxFont;
  const blocks: SceneBlock[] = [];
  for (let i = 0; i < count; i++) {
    const draft: SceneBlock = {
      x: safe.x,
      y: y0 + i * (row + gap),
      w: safe.w,
      h: row,
      font: floor,
      role,
      index: i,
      align,
      textAlign: align,
    };
    const box = finish(draft, safe);
    const fitted = fitFont(chars[i] ?? 8, box.w, box.h, cap, floor);
    if (fitted.overflow) overflow = true;
    fontMin = Math.min(fontMin, fitted.font);
    blocks.push({...box, font: fitted.font});
  }
  return {blocks, gap, row, overflow};
}

function layoutStack(input: GeomInput, count: number, chars: number[], safe: SafeFrame, role: SceneBlock['role'], maxFont: number): GeomResult {
  const density = input.density ?? 'regular';
  const align = input.align ?? 'center';
  const placed = placeRows(safe, count, chars, input.floor.body, maxFont, input.maxRow, RATIO[density], align, role, input.floor.titleMax);
  return {
    layout: 'stack',
    blocks: placed.blocks,
    gap: placed.gap,
    row: placed.row,
    font: placed.blocks.reduce((min, block) => Math.min(min, block.font), input.floor.titleMax),
    floor: input.floor.body,
    overflow: placed.overflow,
    mainAreaRatio: 0,
  };
}

function layoutHero(input: GeomInput, count: number): GeomResult {
  const safe = input.safe;
  const align = input.align ?? 'center';
  const density = input.density ?? 'regular';
  const chars = input.chars;
  const supports = count - 1;
  const ratio = RATIO[density];
  let supportH = Math.max(Math.ceil(input.floor.body * 1.5), input.floor.body + 16);
  let gap = supports > 0 ? Math.max(8, Math.round(ratio * supportH)) : 0;
  let supportTotal = supports * supportH + Math.max(0, supports - 1) * gap;
  const capH = Math.round(safe.h * 0.72);
  const minMain = Math.ceil(input.floor.title * 1.3);
  const mainW0 = align === 'center' ? Math.round(safe.w * 0.92) : safe.w;
  let overflow = false;
  // 单条保持 72%，字在块内居中。有辅条时主块按文字高度收，避免一张空卡占满安全区。
  let mainH = capH;
  if (supports > 0) {
    let font = input.floor.titleMax;
    let need = textBoxH(chars[0] ?? 4, mainW0, font);
    while (need > capH && font > input.floor.title) {
      font -= 2;
      need = textBoxH(chars[0] ?? 4, mainW0, font);
    }
    // 一句标题收成文字高度后，纸色卡片在 36×64 空帧检查里会掉到 5% 以下。
    // 下限取安全区的 28%，仍低于 72% 的单条主块，字在块内居中。
    const minCard = Math.min(capH, Math.max(minMain, Math.round(safe.h * 0.28)));
    mainH = Math.min(capH, Math.max(minCard, need));
    const group0 = mainH + gap + supportTotal;
    if (group0 > safe.h) {
      const minSup = Math.ceil(input.floor.body * 1.35);
      gap = 8;
      const room = safe.h - minMain - gap;
      supportH = Math.max(minSup, Math.floor((room - Math.max(0, supports - 1) * gap) / supports));
      supportTotal = supports * supportH + Math.max(0, supports - 1) * gap;
      mainH = Math.min(mainH, Math.max(1, safe.h - gap - supportTotal));
      if (mainH < minMain || supportH < minSup) overflow = true;
      mainH = Math.max(1, mainH);
      supportH = Math.max(1, supportH);
    }
  }
  const group = mainH + (supports > 0 ? gap : 0) + supportTotal;
  let y = safe.y + Math.max(0, Math.floor((safe.h - group) / 2));
  const mainW = align === 'center' ? Math.round(safe.w * 0.92) : safe.w;
  const mainX = align === 'center' ? safe.x + Math.floor((safe.w - mainW) / 2) : safe.x;
  const mainDraft = finish(
    {x: mainX, y, w: mainW, h: mainH, font: input.floor.title, role: 'main', index: 0, align, textAlign: align},
    safe,
  );
  const mainFit = fitFont(chars[0] ?? 4, mainDraft.w, mainDraft.h, input.floor.titleMax, input.floor.title);
  if (mainFit.overflow) overflow = true;
  const blocks: SceneBlock[] = [{...mainDraft, font: mainFit.font}];
  y = mainDraft.y + mainDraft.h + (supports > 0 ? gap : 0);
  for (let i = 0; i < supports; i++) {
    const step = i === 0 ? 0 : gap;
    y += step;
    const draft = finish(
      {x: safe.x, y, w: safe.w, h: supportH, font: input.floor.body, role: 'support', index: i + 1, align, textAlign: align},
      safe,
    );
    const supportMax = input.floor.body + 8;
    const fitted = fitFont(chars[i + 1] ?? 8, draft.w, draft.h, supportMax, input.floor.body);
    if (fitted.overflow) overflow = true;
    blocks.push({...draft, font: fitted.font});
    y = draft.y + draft.h;
  }
  const safeArea = safe.w * safe.h;
  const main = blocks[0];
  return {
    layout: 'hero',
    blocks,
    gap,
    row: main.h,
    font: main.font,
    floor: input.floor.title,
    overflow,
    mainAreaRatio: safeArea > 0 ? (main.w * main.h) / safeArea : 0,
  };
}

function layoutSplit(input: GeomInput, count: number): GeomResult {
  const safe = input.safe;
  const portrait = input.portrait === true;
  const align = input.align ?? 'center';
  const focus = (input.emphasis ?? 'even') === 'focus' && input.winner && input.winner !== 'none';
  const primary = !focus ? 0.5 : input.winner === 'left' ? 0.54 : 0.46;
  const gutter = Math.max(8, Math.round((portrait ? safe.h : safe.w) * 0.04));
  const chars = input.chars;
  const leftCount = count <= 1 ? count : Math.ceil(count / 2);
  const rightCount = count - leftCount;
  const panes: {origin: SafeFrame; chars: number[]; index0: number}[] = [];
  if (portrait) {
    const span = safe.h - gutter;
    const topH = Math.round(span * (count <= 1 ? 1 : primary));
    const botH = span - topH;
    panes.push({
      origin: {x: safe.x, y: safe.y, w: safe.w, h: count <= 1 ? safe.h : topH, reserve: safe.reserve},
      chars: chars.slice(0, leftCount),
      index0: 0,
    });
    if (rightCount > 0) {
      panes.push({
        origin: {x: safe.x, y: safe.y + topH + gutter, w: safe.w, h: botH, reserve: safe.reserve},
        chars: chars.slice(leftCount),
        index0: leftCount,
      });
    }
  } else {
    const span = safe.w - gutter;
    const leftW = Math.round(span * (count <= 1 ? 1 : primary));
    const rightW = span - leftW;
    panes.push({
      origin: {x: safe.x, y: safe.y, w: count <= 1 ? safe.w : leftW, h: safe.h, reserve: safe.reserve},
      chars: chars.slice(0, leftCount),
      index0: 0,
    });
    if (rightCount > 0) {
      panes.push({
        origin: {x: safe.x + leftW + gutter, y: safe.y, w: rightW, h: safe.h, reserve: safe.reserve},
        chars: chars.slice(leftCount),
        index0: leftCount,
      });
    }
  }
  const blocks: SceneBlock[] = [];
  let gap = 0;
  let row = 0;
  let overflow = false;
  for (const pane of panes) {
    const placed = placeRows(pane.origin, pane.chars.length, pane.chars, input.floor.body, Math.max(input.floor.body, 56), pane.origin.h, RATIO[input.density ?? 'regular'], align, 'item', input.floor.titleMax);
    gap = placed.gap;
    row = placed.row;
    if (placed.overflow) overflow = true;
    for (const block of placed.blocks) blocks.push({...block, index: pane.index0 + block.index});
  }
  return {
    layout: 'split',
    blocks,
    gap,
    row,
    font: blocks.reduce((min, block) => Math.min(min, block.font), input.floor.titleMax),
    floor: input.floor.body,
    overflow,
    mainAreaRatio: 0,
  };
}

export function layoutBlocks(input: GeomInput): GeomResult {
  const count = clampCount(input.count);
  const chars = Array.from({length: count}, (_, i) => Math.max(1, input.chars[i] ?? 8));
  if (input.layout === 'hero') return layoutHero({...input, chars}, count);
  if (input.layout === 'split') return layoutSplit({...input, chars}, count);
  const maxFont = input.floor.body >= 44 ? input.floor.body : 56;
  const result = layoutStack({...input, chars}, count, chars, input.safe, 'item', maxFont);
  return {...result, layout: 'stack'};
}

/** 现有竖排像素，给对照表用。公式抄自 features.boxes 的 stack、quickList.geom、steps.geom。 */
export function legacyStack(n: number) {
  const h = 780;
  const featureGap = 24;
  const featureRow = Math.min(200, (h - featureGap * (n - 1)) / n);
  const quickGap = n >= 5 ? 16 : 22;
  const quickRow = Math.floor(Math.min(170, (h - quickGap * (n - 1)) / n));
  const stepPitch = n <= 2 ? 250 : n === 3 ? 215 : 178;
  return {featureGap, featureRow, quickGap, quickRow, stepPitch, lessonRow: 96, lessonGap: 16};
}
