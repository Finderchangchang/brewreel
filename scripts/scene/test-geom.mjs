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
assert.equal(hero.blocks[0].h, Math.round(promo.safe.h * 0.72));
assert.ok(hero.mainAreaRatio >= 0.4, `主块面积 ${hero.mainAreaRatio}`);

const heroPair = layoutBlocks({layout: 'hero', count: 2, chars: [13, 6], safe: promo.safe, floor: promo.floor, maxRow: promo.maxRow, align: 'center'});
assert.ok(heroPair.blocks[0].h < promo.safe.h * 0.72, `有辅条的主块应收回文字高度，现在 ${heroPair.blocks[0].h}`);
assert.ok(heroPair.blocks[0].y > promo.safe.y, '整组应在安全区里垂直居中');
assert.equal(heroPair.overflow, false);

const heroShort = layoutBlocks({layout: 'hero', count: 2, chars: [4, 6], safe: promo.safe, floor: promo.floor, maxRow: promo.maxRow, align: 'center'});
assert.ok(heroShort.blocks[0].h >= Math.round(promo.safe.h * 0.28), `一句标题的主块不应缩成细条，现在 ${heroShort.blocks[0].h}`);
assert.ok(heroShort.blocks[0].h < promo.safe.h * 0.72);

const six = rows.find((row) => row.n === 6);
const two = rows.find((row) => row.n === 2);
assert.ok(two.font > six.font, `条数少时字号应更大：2 条 ${two.font}，6 条 ${six.font}`);
const sixTotal = six.row * 6 + six.gap * 5;
assert.ok(sixTotal >= promo.safe.h * 0.95, `6 条应尽量用满安全区，现在 ${sixTotal}/${promo.safe.h}`);

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

const frames = [
  sceneFrame('promo', '9:16'),
  sceneFrame('lesson', '16:9'),
  sceneFrame('lesson', '9:16'),
];

function assertLaid(result, frame, label) {
  assert.equal(result.overflow, false, `${label} 溢出`);
  for (const block of result.blocks) inside(block, frame);
  for (let i = 0; i < result.blocks.length; i++) {
    for (let j = i + 1; j < result.blocks.length; j++) {
      assert.equal(hits(result.blocks[i], result.blocks[j]), false, `${label} 重叠`);
    }
  }
}

function baseInput(frame, extra) {
  return {
    chars: Array.from({length: extra.count ?? 1}, () => extra.char ?? 6),
    safe: frame.safe,
    floor: frame.floor,
    maxRow: frame.maxRow,
    density: 'regular',
    align: 'center',
    portrait: frame.portrait,
    ...extra,
  };
}

for (const frame of frames) {
  const tag = `${frame.product} ${frame.aspect}`;
  const grid = layoutBlocks(baseInput(frame, {layout: 'grid', count: 4}));
  assert.equal(grid.blocks.length, 4, tag);
  assertLaid(grid, frame, `grid4 ${tag}`);
  for (const block of grid.blocks) {
    assert.equal(block.kind, 'card');
    assert.ok(block.slot && block.textBox, '格子要有图标位和文字位');
    assert.equal(hits(block.slot, block.textBox), false, `grid 图标和文字重叠 ${tag}`);
    assert.ok(block.font >= frame.floor.body, `grid 字号 ${block.font}`);
  }
  const grid3 = layoutBlocks(baseInput(frame, {layout: 'grid', count: 3}));
  assertLaid(grid3, frame, `grid3 ${tag}`);
  if (frame.portrait) assert.ok(grid3.blocks[1].y >= grid3.blocks[0].y + grid3.blocks[0].h - 0.01);
  else assert.ok(grid3.blocks[0].w > grid3.blocks[1].w);

  const sequence = layoutBlocks(baseInput(frame, {layout: 'sequence', count: 4}));
  assert.equal(sequence.links.length, 3, tag);
  assertLaid(sequence, frame, `sequence ${tag}`);
  for (const block of sequence.blocks) {
    assert.equal(block.kind, 'node');
    assert.ok(block.font >= frame.floor.body);
    assert.equal(hits(block.slot, block.textBox), false);
  }
  const tooMany = layoutBlocks(baseInput(frame, {layout: 'sequence', count: 7, chars: Array.from({length: 7}, () => 4)}));
  assert.equal(tooMany.overflow, true, `sequence 超过 6 步应溢出 ${tag}`);

  const callouts = [
    {x: 0.08, y: 0.08, w: 0.3, h: 0.2, label: '标题'},
    {x: 0.08, y: 0.5, w: 0.4, h: 0.2, label: '参数'},
  ];
  const media = layoutBlocks(baseInput(frame, {layout: 'media', count: 3, callouts}));
  assertLaid(media, frame, `media ${tag}`);
  assert.ok(media.blocks.some((block) => block.kind === 'evidence'), tag);
  assert.ok(media.frame && media.frame.h >= frame.floor.body * 2, `media 图太矮 ${tag}`);
  const clash = layoutBlocks(baseInput(frame, {
    layout: 'media',
    count: 3,
    callouts: [
      {x: 0.1, y: 0.1, w: 0.4, h: 0.4},
      {x: 0.2, y: 0.2, w: 0.4, h: 0.4},
    ],
  }));
  assert.equal(clash.overflow, true, `相交标注应溢出 ${tag}`);

  const chart = layoutBlocks(baseInput(frame, {layout: 'chart', count: 3}));
  assertLaid(chart, frame, `chart ${tag}`);
  const plot = chart.blocks.find((block) => block.kind === 'plot');
  assert.ok(plot && plot.h >= frame.safe.h * 0.4, `chart 图区 ${tag}`);

  const end = layoutBlocks(baseInput(frame, {layout: 'end', count: 3, chars: [4, 6, 6]}));
  assertLaid(end, frame, `end ${tag}`);
  assert.equal(end.blocks[0].kind, 'card');
  assert.equal(end.blocks[1].kind, 'caption');
  assert.ok(end.blocks[0].h > end.blocks[1].h, tag);
  assert.ok(end.blocks[0].font >= frame.floor.title);
  assert.ok(end.blocks[1].font >= frame.floor.body);

  const board = layoutBlocks(baseInput(frame, {
    layout: 'board',
    count: 4,
    chars: [8, 8, 2, 8],
    bands: ['kicker', 'title', 'evidence', 'caption'],
  }));
  assertLaid(board, frame, `board ${tag}`);
  assert.deepEqual(board.blocks.map((block) => block.kind), ['kicker', 'card', 'evidence', 'caption']);
  const evidence = board.blocks[2];
  assert.ok(evidence.h > board.blocks[1].h && evidence.h > board.blocks[3].h, `证据应是最高的一层 ${tag}`);
  assert.ok(board.blocks[0].font >= frame.floor.aux && board.blocks[0].font <= frame.floor.aux + 0.01);
  assert.ok(board.blocks[1].font >= frame.floor.title);
  assert.notEqual(board.blocks[0].h, board.blocks[1].h);
  assert.notEqual(board.blocks[1].h, evidence.h);

  const number = layoutBlocks(baseInput(frame, {
    layout: 'number',
    count: 4,
    chars: [8, 6, 3, 8],
    bands: ['kicker', 'title', 'number', 'caption'],
  }));
  assertLaid(number, frame, `number ${tag}`);
  assert.equal(number.layout, 'number');
  const stage = number.blocks.find((block) => block.kind === 'stage');
  const caption = number.blocks.find((block) => block.kind === 'caption');
  assert.ok(stage && caption, tag);
  assert.ok(stage.font >= caption.font * 2, `${tag} 数字 ${stage.font} 说明 ${caption.font}`);
  assert.ok(stage.font > frame.floor.titleMax, `${tag} 数字 ${stage.font} 应大于标题上限 ${frame.floor.titleMax}`);
  assert.ok(stage.font <= Math.round(stage.h * 0.55) + 1, `${tag} 数字 ${stage.font} 高 ${stage.h}`);
  const em = Math.max(1.8, 3 * 0.7);
  assert.ok(stage.font <= Math.floor((stage.w - 24) / em) + 1, `${tag} 数字宽 ${stage.font}`);
  assert.ok(stage.h > number.blocks.find((block) => block.kind === 'card').h, `数字区应大于判断带 ${tag}`);
}

console.log('对照');
for (const row of rows) {
  console.log(`n=${row.n} 新间距=${row.gap} 新行高=${row.row} 新字号=${row.font} | features ${row.featureGap}/${row.featureRow.toFixed(0)} quickList ${row.quickGap}/${row.quickRow} steps间距 ${row.stepPitch}`);
}
console.log(`讲课 16:9 四条 间距=${lessonFour.gap} 行高=${lessonFour.row} 字号=${lessonFour.font} | Steps 16/96 正文下限 44（组件 TYPE.stepsBody 是 38）`);
