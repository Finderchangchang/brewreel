#!/usr/bin/env node
// hero / stack / split × 1、2、4、6 条 × 9:16、16:9、4:5。安全区内、字号不低于下限、块不重叠。
import assert from 'node:assert/strict';
import {layoutBlocks, legacyStack} from './geom.mjs';
import {sceneFrame} from './geom.mjs';

const CASES = [
  {product: 'promo', aspect: '9:16'},
  {product: 'lesson', aspect: '16:9'},
  {product: 'promo', aspect: '4:5'},
];
const LAYOUTS = ['hero', 'stack', 'split'];
const COUNTS = [1, 2, 4, 6];

function hits(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function inside(block, frame) {
  const safe = frame.safe;
  const right = block.x + block.w;
  const bottom = block.y + block.h;
  assert.ok(block.x >= safe.x - 0.01 && block.y >= safe.y - 0.01, `左上超出 ${block.x},${block.y}`);
  assert.ok(right <= safe.x + safe.w + 0.01 && bottom <= safe.y + safe.h + 0.01, `右下超出 ${right},${bottom}`);
  const reserve = safe.reserve;
  if (reserve) assert.ok(!(right > reserve.x + 0.01 && bottom > reserve.y + 0.01), '进了讲解员保留区');
  assert.ok(block.w > 1 && block.h > 1);
}

for (const layout of LAYOUTS) {
  for (const count of COUNTS) {
    for (const item of CASES) {
      const frame = sceneFrame(item.product, item.aspect);
      const result = layoutBlocks({
        layout,
        count,
        chars: Array.from({length: count}, () => 8),
        safe: frame.safe,
        floor: frame.floor,
        maxRow: frame.maxRow,
        density: 'regular',
        align: item.product === 'lesson' ? 'start' : 'center',
        winner: 'right',
        emphasis: 'focus',
        portrait: frame.portrait,
      });
      assert.equal(result.blocks.length, count, `${layout} ${item.aspect} ${count} 条`);
      assert.equal(result.overflow, false, `${layout} ${item.aspect} n=${count} 溢出`);
      for (const block of result.blocks) {
        inside(block, frame);
        const floor = block.role === 'main' ? frame.floor.title : frame.floor.body;
        assert.ok(block.font >= floor, `${layout} ${item.aspect} n=${count} 字号 ${block.font} < ${floor}`);
      }
      for (let i = 0; i < result.blocks.length; i++) {
        for (let j = i + 1; j < result.blocks.length; j++) {
          assert.equal(hits(result.blocks[i], result.blocks[j]), false, `${layout} ${item.aspect} n=${count} 重叠`);
        }
      }
    }
  }
}

const promo = sceneFrame('promo', '9:16');
assert.deepEqual(promo.safe, {x: 150, y: 560, w: 780, h: 780, reserve: null});
const lesson = sceneFrame('lesson', '16:9');
assert.equal(lesson.safe.x, 120);
assert.equal(lesson.safe.y, 300);
assert.equal(lesson.safe.w, 1680);
assert.equal(lesson.safe.h, 580);
const vertical = sceneFrame('lesson', '9:16');
assert.equal(vertical.safe.x, 180);
assert.equal(vertical.safe.w, 720);
assert.equal(vertical.floor.body, 48);
assert.equal(vertical.floor.title, 72);

const rows = [];
for (const n of [2, 3, 4, 6]) {
  const legacy = legacyStack(n);
  const next = layoutBlocks({
    layout: 'stack',
    count: n,
    chars: Array.from({length: n}, () => 8),
    safe: promo.safe,
    floor: promo.floor,
    maxRow: promo.maxRow,
    density: 'regular',
  });
  rows.push({n, gap: next.gap, row: next.row, font: next.font, ...legacy});
  if (n === 2 || n === 3) {
    assert.equal(next.row, 200);
    assert.equal(next.gap, 24);
  }
  if (n === 4) {
    assert.ok(Math.abs(next.row - legacy.stepPitch) <= 4, `4 条行高 ${next.row}`);
    assert.ok(Math.abs(next.gap - legacy.featureGap) <= 8);
  }
  if (n === 6) {
    assert.ok(Math.abs(next.row - legacy.quickRow) <= 8);
    assert.ok(Math.abs(next.gap - legacy.quickGap) <= 6);
  }
}
const lessonFour = layoutBlocks({
  layout: 'stack',
  count: 4,
  chars: [8, 8, 8, 8],
  safe: lesson.safe,
  floor: lesson.floor,
  maxRow: lesson.maxRow,
  density: 'regular',
  align: 'start',
});
assert.equal(lessonFour.row, 96);
assert.ok(Math.abs(lessonFour.gap - 16) <= 8, `讲课间距 ${lessonFour.gap}`);
assert.ok(lessonFour.font >= 44);

const tight = layoutBlocks({layout: 'stack', count: 4, chars: [8, 8, 8, 8], safe: promo.safe, floor: promo.floor, maxRow: promo.maxRow, density: 'tight'});
const regular = layoutBlocks({layout: 'stack', count: 4, chars: [8, 8, 8, 8], safe: promo.safe, floor: promo.floor, maxRow: promo.maxRow, density: 'regular'});
const loose = layoutBlocks({layout: 'stack', count: 4, chars: [8, 8, 8, 8], safe: promo.safe, floor: promo.floor, maxRow: promo.maxRow, density: 'loose'});
assert.ok(tight.gap < regular.gap && regular.gap < loose.gap);

const hero = layoutBlocks({layout: 'hero', count: 1, chars: [6], safe: promo.safe, floor: promo.floor, maxRow: promo.maxRow, align: 'start'});
assert.equal(hero.blocks[0].x, promo.safe.x);
assert.ok(hero.mainAreaRatio >= 0.4, `主块面积 ${hero.mainAreaRatio}`);

const split = layoutBlocks({
  layout: 'split',
  count: 2,
  chars: [6, 6],
  safe: promo.safe,
  floor: promo.floor,
  maxRow: promo.maxRow,
  winner: 'right',
  emphasis: 'focus',
  portrait: false,
});
assert.ok(split.blocks[1].w > split.blocks[0].w);
assert.ok(split.blocks[1].w / split.blocks[0].w > 1.1 && split.blocks[1].w / split.blocks[0].w < 1.25);

const portrait = layoutBlocks({
  layout: 'split',
  count: 2,
  chars: [6, 6],
  safe: promo.safe,
  floor: promo.floor,
  maxRow: promo.maxRow,
  portrait: true,
});
assert.ok(portrait.blocks[1].y >= portrait.blocks[0].y + portrait.blocks[0].h);
assert.equal(portrait.blocks[0].x, portrait.blocks[1].x);

const verticalStack = layoutBlocks({
  layout: 'stack',
  count: 4,
  chars: [8, 8, 8, 8],
  safe: vertical.safe,
  floor: vertical.floor,
  maxRow: vertical.maxRow,
});
assert.ok(verticalStack.font >= 48);
assert.ok(verticalStack.row <= 142);

console.log('对照');
for (const row of rows) {
  console.log(`n=${row.n} 新间距=${row.gap} 新行高=${row.row} 新字号=${row.font} | features ${row.featureGap}/${row.featureRow.toFixed(0)} quickList ${row.quickGap}/${row.quickRow} steps间距 ${row.stepPitch}`);
}
console.log(`讲课 16:9 四条 间距=${lessonFour.gap} 行高=${lessonFour.row} 字号=${lessonFour.font} | Steps 16/96 正文下限 44（组件 TYPE.stepsBody 是 38）`);
