// hero / stack / split 的几何。只算矩形和字号，不画。
// 疏密：间距约占行高的 tight 0.06 / regular 0.12 / loose 0.20。
// 行高先按这个比例求，再被 maxRow 封顶（宣传片 200、讲课横版 96、竖版 142）。
// 没被封顶时，把剩余高度分进行里，尽量用满安全区；封顶后整组垂直居中。
// 字号跟着行高放大，停在标题上限。放不下就停在该产品下限，不把整卡缩到 0.8。
// grid / sequence / media / chart / end / board / number 在同一文件里，不改上面三支的公式。
import type {Align, BlockKind, CalloutBox, Density, FontFloor, ProtoLayout, Rect, SafeFrame, SceneBlock} from './types.ts';
import {inspectCallouts} from './rules.ts';

export type BandName = 'kicker' | 'title' | 'evidence' | 'caption' | 'number';
export type GeomLayout = ProtoLayout | 'grid' | 'sequence' | 'media' | 'chart' | 'end' | 'board' | 'number';

const RATIO: Record<Density, number> = {tight: 0.06, regular: 0.12, loose: 0.2};

export type GeomInput = {
  layout: GeomLayout;
  count: number;
  chars: number[];
  safe: SafeFrame;
  floor: FontFloor;
  maxRow: number;
  density?: Density;
  align?: Align;
  winner?: 'left' | 'right' | 'none';
  emphasis?: 'even' | 'focus';
  /** 竖画面的 split 改成上下，不改成左右。grid 的 3 条在竖画面改成单列。 */
  portrait?: boolean;
  /** board / number 的分层。长度必须和 count 一致。 */
  bands?: BandName[];
  /** media 的 0–1 标注。几何只检查相交，不猜图里是什么。 */
  callouts?: CalloutBox[];
};

export type GeomLink = {x1: number; y1: number; x2: number; y2: number};

export type GeomResult = {
  layout: GeomLayout;
  blocks: SceneBlock[];
  gap: number;
  row: number;
  font: number;
  floor: number;
  overflow: boolean;
  /** hero 主块面积 / 安全区面积。其他原型为 0。 */
  mainAreaRatio: number;
  /** sequence 的节点连线。不是文字块。 */
  links?: GeomLink[];
  /** 标注检查失败时的人话。有内容就同时把 overflow 标上。 */
  calloutIssues?: string[];
  /** 证据卡或图区，绝对坐标。media 的标注相对它。 */
  frame?: Rect;
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

function densityGap(input: GeomInput, along: number): number {
  const ratio = RATIO[input.density ?? 'regular'];
  return Math.max(8, Math.round(ratio * Math.max(48, along)));
}

function clampRect(rect: Rect | undefined, host: Rect): Rect | undefined {
  if (!rect) return undefined;
  const x = Math.max(host.x, Math.round(rect.x));
  const y = Math.max(host.y, Math.round(rect.y));
  const right = Math.min(host.x + host.w, Math.round(rect.x + rect.w));
  const bottom = Math.min(host.y + host.h, Math.round(rect.y + rect.h));
  return {x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y)};
}

function paintBlock(draft: SceneBlock, safe: SafeFrame, chars: number, fontMax: number, fontMin: number): {block: SceneBlock; overflow: boolean} {
  const box = finish(draft, safe);
  const textBox = clampRect(draft.textBox, box);
  const slot = clampRect(draft.slot, box);
  const fitted = fitFont(chars, textBox?.w ?? box.w, textBox?.h ?? box.h, fontMax, fontMin);
  return {block: {...box, font: fitted.font, ...(slot ? {slot} : {}), ...(textBox ? {textBox} : {})}, overflow: fitted.overflow};
}

function layoutGrid(input: GeomInput, count: number): GeomResult {
  const safe = input.safe;
  const n = Math.max(1, Math.min(4, count));
  const portrait = input.portrait === true;
  const gap = densityGap(input, Math.min(safe.w, safe.h) * 0.2);
  const cells: Rect[] = [];
  if (n === 3 && !portrait) {
    const topH = Math.floor((safe.h - gap) * 0.46);
    const botH = safe.h - gap - topH;
    const colW = Math.floor((safe.w - gap) / 2);
    cells.push({x: safe.x, y: safe.y, w: safe.w, h: topH});
    cells.push({x: safe.x, y: safe.y + topH + gap, w: colW, h: botH});
    cells.push({x: safe.x + colW + gap, y: safe.y + topH + gap, w: safe.w - colW - gap, h: botH});
  } else if (n === 2) {
    const colW = Math.floor((safe.w - gap) / 2);
    cells.push({x: safe.x, y: safe.y, w: colW, h: safe.h});
    cells.push({x: safe.x + colW + gap, y: safe.y, w: safe.w - colW - gap, h: safe.h});
  } else if (n === 4) {
    const colW = Math.floor((safe.w - gap) / 2);
    const rowH = Math.floor((safe.h - gap) / 2);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        cells.push({
          x: safe.x + col * (colW + gap),
          y: safe.y + row * (rowH + gap),
          w: col === 1 ? safe.w - colW - gap : colW,
          h: row === 1 ? safe.h - rowH - gap : rowH,
        });
      }
    }
  } else {
    const {row, gap: rowGap} = stackMetrics(safe.h, n, input.maxRow, RATIO[input.density ?? 'regular']);
    const total = row * n + rowGap * Math.max(0, n - 1);
    const y0 = safe.y + Math.floor((safe.h - total) / 2);
    for (let i = 0; i < n; i++) cells.push({x: safe.x, y: y0 + i * (row + rowGap), w: safe.w, h: row});
  }
  const wide = (cell: Rect) => cell.w > cell.h * 1.35;
  let overflow = count > 4;
  const align = input.align ?? 'center';
  const blocks: SceneBlock[] = cells.map((cell, index) => {
    const icon = Math.max(36, Math.min(72, Math.round(Math.min(cell.w, cell.h) * (wide(cell) ? 0.62 : 0.28))));
    const slot: Rect = wide(cell)
      ? {x: cell.x + 16, y: cell.y + Math.max(12, Math.round((cell.h - icon) / 2)), w: icon, h: icon}
      : {x: cell.x + Math.round((cell.w - icon) / 2), y: cell.y + 14, w: icon, h: icon};
    const textBox: Rect = wide(cell)
      ? {x: slot.x + slot.w + 12, y: cell.y + 12, w: cell.x + cell.w - (slot.x + slot.w + 24), h: cell.h - 24}
      : {x: cell.x + 12, y: slot.y + slot.h + 8, w: cell.w - 24, h: cell.y + cell.h - (slot.y + slot.h + 20)};
    const draft: SceneBlock = {
      x: cell.x, y: cell.y, w: cell.w, h: cell.h,
      font: input.floor.body, role: 'item', index, align, textAlign: align, kind: 'card', slot, textBox,
    };
    const painted = paintBlock(draft, safe, input.chars[index] ?? 4, input.floor.titleMax, input.floor.body);
    if (painted.overflow) overflow = true;
    return painted.block;
  });
  return {
    layout: 'grid',
    blocks,
    gap,
    row: blocks[0]?.h ?? 0,
    font: blocks.reduce((min, block) => Math.min(min, block.font), input.floor.titleMax),
    floor: input.floor.body,
    overflow,
    mainAreaRatio: 0,
  };
}

function layoutSequence(input: GeomInput, count: number): GeomResult {
  const safe = input.safe;
  const n = Math.max(2, Math.min(6, count));
  const align = input.align ?? 'center';
  const vertical = input.portrait === true || safe.h >= safe.w;
  const gap = densityGap(input, 64);
  const blocks: SceneBlock[] = [];
  const links: GeomLink[] = [];
  let overflow = count < 2 || count > 6;
  if (vertical) {
    const {row, gap: rowGap, total} = stackMetrics(safe.h, n, input.maxRow, RATIO[input.density ?? 'regular']);
    const y0 = safe.y + Math.floor((safe.h - total) / 2);
    for (let i = 0; i < n; i++) {
      const y = y0 + i * (row + rowGap);
      const icon = Math.max(input.floor.body, Math.min(72, row - 16));
      const slot: Rect = {x: safe.x, y: y + Math.round((row - icon) / 2), w: icon, h: icon};
      const textBox: Rect = {x: slot.x + slot.w + 16, y: y + 8, w: safe.w - icon - 28, h: row - 16};
      const painted = paintBlock({
        x: safe.x, y, w: safe.w, h: row, font: input.floor.body, role: 'item', index: i, align, textAlign: 'start', kind: 'node', slot, textBox,
      }, safe, input.chars[i] ?? 4, input.floor.titleMax, input.floor.body);
      if (painted.overflow) overflow = true;
      blocks.push(painted.block);
      if (i > 0) {
        const prev = blocks[i - 1].slot!;
        links.push({x1: prev.x + prev.w / 2, y1: prev.y + prev.h, x2: slot.x + slot.w / 2, y2: slot.y});
      }
    }
    return {layout: 'sequence', blocks, gap: rowGap, row, font: blocks.reduce((m, b) => Math.min(m, b.font), input.floor.titleMax), floor: input.floor.body, overflow, mainAreaRatio: 0, links};
  }
  const colW = Math.floor((safe.w - gap * (n - 1)) / n);
  const bandH = Math.min(safe.h, Math.max(input.floor.body * 4, Math.round(safe.h * 0.72)));
  const y0 = safe.y + Math.floor((safe.h - bandH) / 2);
  for (let i = 0; i < n; i++) {
    const x = safe.x + i * (colW + gap);
    const w = i === n - 1 ? safe.x + safe.w - x : colW;
    const icon = Math.max(input.floor.body, Math.min(64, Math.round(w * 0.42)));
    const slot: Rect = {x: x + Math.round((w - icon) / 2), y: y0, w: icon, h: icon};
    const textBox: Rect = {x: x + 6, y: slot.y + slot.h + 12, w: w - 12, h: bandH - icon - 20};
    const painted = paintBlock({
      x, y: y0, w, h: bandH, font: input.floor.body, role: 'item', index: i, align, textAlign: 'center', kind: 'node', slot, textBox,
    }, safe, input.chars[i] ?? 4, input.floor.titleMax, input.floor.body);
    if (painted.overflow) overflow = true;
    blocks.push(painted.block);
    if (i > 0) {
      const prev = blocks[i - 1].slot!;
      links.push({x1: prev.x + prev.w, y1: prev.y + prev.h / 2, x2: slot.x, y2: slot.y + slot.h / 2});
    }
  }
  return {layout: 'sequence', blocks, gap, row: bandH, font: blocks.reduce((m, b) => Math.min(m, b.font), input.floor.titleMax), floor: input.floor.body, overflow, mainAreaRatio: 0, links};
}

function layoutMedia(input: GeomInput, count: number): GeomResult {
  const safe = input.safe;
  const align = input.align ?? 'center';
  const issues = inspectCallouts(input.callouts);
  const gap = densityGap(input, 56);
  const lead = input.bands?.[0] === 'kicker' ? 1 : 0;
  const kickerH = lead ? Math.max(input.floor.aux + 18, 50) : 0;
  const titleH = Math.max(input.floor.title + 20, Math.round(safe.h * 0.16));
  const labels = Math.max(0, count - 1 - lead);
  const labelH = labels > 0 ? Math.max(input.floor.body + 18, Math.round(safe.h * 0.16)) : 0;
  const gaps = gap * ((lead ? 1 : 0) + 1 + (labels > 0 ? 1 : 0));
  const imageH = Math.max(1, safe.h - kickerH - titleH - labelH - gaps);
  let overflow = issues.length > 0 || imageH < input.floor.body * 2;
  let y = safe.y;
  const blocks: SceneBlock[] = [];
  if (lead) {
    const kicker = paintBlock({
      x: safe.x, y, w: safe.w, h: kickerH, font: input.floor.aux, role: 'support', index: 0, align, textAlign: align, kind: 'kicker',
    }, safe, input.chars[0] ?? 4, input.floor.aux, input.floor.aux);
    if (kicker.overflow) overflow = true;
    blocks.push(kicker.block);
    y += kickerH + gap;
  }
  const title = paintBlock({
    x: safe.x, y, w: safe.w, h: titleH, font: input.floor.title, role: 'main', index: blocks.length, align, textAlign: align, kind: 'card',
  }, safe, input.chars[lead] ?? 4, input.floor.titleMax, input.floor.title);
  if (title.overflow) overflow = true;
  blocks.push(title.block);
  y += title.block.h + gap;
  const image = finish({
    x: safe.x, y, w: safe.w, h: imageH, font: input.floor.body, role: 'item', index: blocks.length, align, textAlign: align, kind: 'evidence',
  }, safe);
  blocks.push({...image, font: input.floor.body});
  y += image.h + (labels > 0 ? gap : 0);
  if (labels > 0) {
    const colW = Math.floor((safe.w - gap * Math.max(0, labels - 1)) / labels);
    for (let i = 0; i < labels; i++) {
      const x = safe.x + i * (colW + gap);
      const w = i === labels - 1 ? safe.x + safe.w - x : colW;
      const painted = paintBlock({
        x, y, w, h: labelH, font: input.floor.body, role: 'support', index: blocks.length, align, textAlign: 'center', kind: 'caption',
      }, safe, input.chars[lead + 1 + i] ?? 2, input.floor.body + 2, input.floor.body);
      if (painted.overflow) overflow = true;
      blocks.push(painted.block);
    }
  }
  return {
    layout: 'media',
    blocks,
    gap,
    row: image.h,
    font: title.block.font,
    floor: input.floor.body,
    overflow,
    mainAreaRatio: 0,
    ...(issues.length ? {calloutIssues: issues} : {}),
    frame: {x: image.x, y: image.y, w: image.w, h: image.h},
  };
}

function layoutChart(input: GeomInput, count: number): GeomResult {
  const safe = input.safe;
  const align = input.align ?? 'center';
  const gap = densityGap(input, 56);
  const hasCaption = count >= 3;
  const titleH = Math.max(input.floor.title + 16, Math.round(safe.h * 0.2));
  const captionH = hasCaption ? Math.max(input.floor.body + 16, Math.round(safe.h * 0.14)) : 0;
  const plotH = Math.max(1, safe.h - titleH - captionH - gap * (hasCaption ? 2 : 1));
  let overflow = plotH < safe.h * 0.4;
  let y = safe.y;
  const title = paintBlock({
    x: safe.x, y, w: safe.w, h: titleH, font: input.floor.title, role: 'main', index: 0, align, textAlign: align, kind: 'card',
  }, safe, input.chars[0] ?? 4, input.floor.titleMax, input.floor.title);
  if (title.overflow) overflow = true;
  y += titleH + gap;
  const plot = finish({
    x: safe.x, y, w: safe.w, h: plotH, font: input.floor.body, role: 'item', index: 1, align, textAlign: align, kind: 'plot',
  }, safe);
  y += plot.h + (hasCaption ? gap : 0);
  const blocks: SceneBlock[] = [title.block, {...plot, font: input.floor.body}];
  if (hasCaption) {
    const caption = paintBlock({
      x: safe.x, y, w: safe.w, h: captionH, font: input.floor.body, role: 'support', index: 2, align, textAlign: align, kind: 'caption',
    }, safe, input.chars[2] ?? 4, input.floor.body + 2, input.floor.body);
    if (caption.overflow) overflow = true;
    blocks.push(caption.block);
  }
  return {layout: 'chart', blocks, gap, row: plot.h, font: title.block.font, floor: input.floor.body, overflow, mainAreaRatio: 0, frame: {x: plot.x, y: plot.y, w: plot.w, h: plot.h}};
}

function layoutEnd(input: GeomInput, count: number): GeomResult {
  const safe = input.safe;
  const align: Align = 'center';
  const gap = densityGap(input, 48);
  const n = Math.max(1, Math.min(3, count));
  const lineH = Math.max(input.floor.body + 18, 68);
  const extra = n - 1;
  let brandH = Math.round(safe.h * 0.42);
  const group = brandH + extra * lineH + Math.max(0, n - 1) * gap;
  if (group > safe.h) brandH = Math.max(input.floor.title + 24, safe.h - extra * lineH - Math.max(0, n - 1) * gap);
  const total = brandH + extra * lineH + Math.max(0, n - 1) * gap;
  let y = safe.y + Math.max(0, Math.floor((safe.h - total) / 2));
  const w = Math.round(safe.w * 0.86);
  const x = safe.x + Math.floor((safe.w - w) / 2);
  const kinds: BlockKind[] = ['card', 'caption', 'caption'];
  const roles: SceneBlock['role'][] = ['main', 'support', 'support'];
  const heights = [brandH, lineH, lineH];
  let overflow = false;
  const blocks: SceneBlock[] = [];
  for (let i = 0; i < n; i++) {
    const fontMin = i === 0 ? input.floor.title : input.floor.body;
    const fontMax = i === 0 ? input.floor.titleMax : input.floor.body + 6;
    const painted = paintBlock({
      x, y, w, h: heights[i], font: fontMin, role: roles[i], index: i, align, textAlign: 'center', kind: kinds[i],
    }, safe, input.chars[i] ?? 4, fontMax, fontMin);
    if (painted.overflow) overflow = true;
    blocks.push(painted.block);
    y += heights[i] + gap;
  }
  return {layout: 'end', blocks, gap, row: brandH, font: blocks[0].font, floor: input.floor.title, overflow, mainAreaRatio: (blocks[0].w * blocks[0].h) / (safe.w * safe.h)};
}

function layoutBoard(input: GeomInput, count: number): GeomResult {
  const safe = input.safe;
  const align = input.align ?? 'center';
  const bands = input.bands && input.bands.length === count ? input.bands : (['title', 'evidence', 'caption'] as BandName[]).slice(0, count);
  const gap = Math.max(10, Math.round(52 * RATIO[input.density ?? 'regular']));
  const heights = bands.map((band) => {
    if (band === 'kicker') return Math.max(input.floor.aux + 18, 50);
    if (band === 'caption') return Math.max(input.floor.body + 20, 68);
    // 判断带要有一块实底。深色舞台上只有一行字，空帧检查会把整屏当成纯色。
    if (band === 'title') return Math.max(input.floor.title + 28, Math.round(safe.h * 0.22));
    return 0;
  });
  const flexAt = bands.map((band, index) => (band === 'evidence' || band === 'number' ? index : -1)).filter((index) => index >= 0);
  const gaps = gap * Math.max(0, count - 1);
  const usedFixed = () => heights.reduce((sum, height) => sum + height, 0) + gaps;
  let flex = Math.floor((safe.h - usedFixed()) / Math.max(1, flexAt.length));
  const titleAt = bands.indexOf('title');
  const minTitle = input.floor.title + 24;
  while (flex < Math.round(safe.h * 0.38) && titleAt >= 0 && heights[titleAt] > minTitle) {
    heights[titleAt] -= 4;
    flex = Math.floor((safe.h - usedFixed()) / Math.max(1, flexAt.length));
  }
  for (const index of flexAt) heights[index] = Math.max(1, flex);
  let total = usedFixed();
  while (total > safe.h) {
    const cutAt = flexAt[0] ?? titleAt;
    if (cutAt < 0 || heights[cutAt] <= 1) break;
    heights[cutAt] -= 1;
    total = usedFixed();
  }
  let y = safe.y + Math.max(0, Math.floor((safe.h - total) / 2));
  let overflow = flex < input.floor.title;
  const blocks: SceneBlock[] = [];
  for (let i = 0; i < count; i++) {
    const band = bands[i];
    const kind: BlockKind = band === 'number' ? 'stage' : band === 'kicker' ? 'kicker' : band === 'caption' ? 'caption' : band === 'evidence' ? 'evidence' : 'card';
    const role: SceneBlock['role'] = band === 'title' || band === 'number' ? 'main' : 'support';
    const narrow = band === 'kicker' || band === 'caption';
    const w = narrow ? Math.round(safe.w * 0.92) : safe.w;
    const x = safe.x + Math.floor((safe.w - w) / 2);
    const halfTitle = Math.floor(input.floor.titleMax / 2);
    const fontMin = band === 'kicker' ? input.floor.aux : band === 'caption' ? Math.min(input.floor.body, halfTitle) : band === 'title' || band === 'number' ? input.floor.title : input.floor.body;
    const fontMax = band === 'kicker' ? input.floor.aux : band === 'caption' ? Math.min(input.floor.body + 4, halfTitle) : band === 'number' || band === 'title' ? input.floor.titleMax : input.floor.body;
    const painted = paintBlock({
      x, y, w, h: heights[i], font: fontMin, role, index: i, align, textAlign: align, kind,
    }, safe, band === 'evidence' ? 1 : (input.chars[i] ?? 4), fontMax, fontMin);
    if (painted.overflow) overflow = true;
    blocks.push(painted.block);
    y += heights[i] + gap;
  }
  const number = blocks.find((block, index) => bands[index] === 'number');
  const caption = blocks.find((block, index) => bands[index] === 'caption');
  if (number && caption) {
    const want = Math.min(input.floor.titleMax, Math.max(number.font, caption.font * 2));
    number.font = want;
    if (number.font < caption.font * 2) overflow = true;
    const again = fitFont(input.chars[number.index] ?? 2, number.w, number.h, number.font, number.font);
    if (again.overflow) overflow = true;
  }
  const evidence = blocks.find((block) => block.kind === 'evidence' || block.kind === 'stage');
  return {
    layout: input.layout === 'number' ? 'number' : 'board',
    blocks,
    gap,
    row: evidence?.h ?? 0,
    font: number?.font ?? blocks[0]?.font ?? input.floor.title,
    floor: input.floor.body,
    overflow,
    mainAreaRatio: 0,
    ...(evidence ? {frame: {x: evidence.x, y: evidence.y, w: evidence.w, h: evidence.h}} : {}),
  };
}

export function layoutBlocks(input: GeomInput): GeomResult {
  const count = clampCount(input.count);
  const chars = Array.from({length: count}, (_, i) => Math.max(1, input.chars[i] ?? 8));
  const next = {...input, chars};
  if (input.layout === 'hero') return layoutHero(next, count);
  if (input.layout === 'split') return layoutSplit(next, count);
  if (input.layout === 'grid') return layoutGrid(next, Math.min(4, count));
  if (input.layout === 'sequence') return layoutSequence(next, count);
  if (input.layout === 'media') return layoutMedia(next, count);
  if (input.layout === 'chart') return layoutChart(next, count);
  if (input.layout === 'end') return layoutEnd(next, count);
  if (input.layout === 'board' || input.layout === 'number') return layoutBoard({...next, layout: input.layout}, count);
  const maxFont = input.floor.body >= 44 ? input.floor.body : 56;
  const result = layoutStack(next, count, chars, input.safe, 'item', maxFont);
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
