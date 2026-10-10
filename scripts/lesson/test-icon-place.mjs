import assert from 'node:assert/strict';
import fs from 'node:fs';
import {POSE_LOOK, POSES} from '../../template/src/lesson/mascot/cast.mjs';
import {boxesOverlap, CARD_MOTION_FRAME, cssPx, fitPeep, placeMarks} from '../../template/src/lesson/mascot/icon-place.mjs';
import {cartoonBox} from '../../template/src/lesson/presenter-place.mjs';
import {cardHtml, cardLayout} from './character-card.mjs';

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

const character = read('../../template/src/lesson/mascot/Character.tsx');
const cardView = read('../../template/src/lesson/CharacterCard.tsx');
const lesson = read('../../template/src/lesson/Lesson.tsx');
const cardScript = read('./character-card.mjs');
assert.match(character, /icon-place\.mjs/);
assert.match(character, /markFractions\(/);
assert.match(cardView, /CARD_MOTION_FRAME/);
assert.match(cardView, /frameWidth=\{CARD_MOTION_FRAME\.w\}/);
assert.match(lesson, /frameWidth=\{cartoonLive\.w\}/);
assert.match(cardScript, /icon-place\.mjs/);
assert.match(cardScript, /placeMarks\(/);
assert.doesNotMatch(cardScript, /\.stage svg\{[^}]*width:\d+px/);

const frames = [
  {name: '角色卡动作格', w: 230, h: 324},
  {name: '角色卡状态格', w: 280, h: 360},
  {name: '成片', ...(() => { const box = cartoonBox('steps'); return {w: box.w, h: box.h}; })()},
  {name: '成片小窗', ...(() => { const box = cartoonBox('code'); return {w: box.w, h: box.h}; })()},
  {name: '角色卡动画', w: CARD_MOTION_FRAME.w, h: CARD_MOTION_FRAME.h},
];
const times = [0, 89, 90, 140, 700, 1600];

for (const frame of frames) {
  for (const family of Object.keys(POSE_LOOK)) {
    for (const pose of POSES) {
      const kind = POSE_LOOK[family][pose].icon;
      for (const elapsedMs of times) {
        const placed = placeMarks(frame.w, frame.h, 'card', kind, elapsedMs);
        const where = `${frame.name} ${family}/${pose} ${elapsedMs}ms`;
        const boxes = [placed.icon, ...placed.pieces].filter(Boolean);
        for (const box of boxes) {
          assert.equal(boxesOverlap(box, placed.head), false, `${where} 的图标压住了头`);
          assert.ok(box.x >= -0.05 && box.y >= -0.05, `${where} 的图标跑出舞台左边或上边`);
          assert.ok(box.x + box.w <= frame.w + 0.05 && box.y + box.h <= frame.h + 0.05, `${where} 的图标跑出舞台`);
          assert.ok(box.h < frame.h * 0.3 && box.w < frame.w * 0.55, `${where} 的图标相对人物过大`);
        }
        if (placed.icon) {
          const iconCx = placed.icon.x + placed.icon.w / 2;
          const headCx = placed.head.x + placed.head.w / 2;
          assert.ok(iconCx > headCx, `${where} 的图标不在头的右侧`);
          assert.ok(placed.icon.y + placed.icon.h <= placed.head.y + 0.05, `${where} 的图标没有停在头顶上方`);
          const ratio = placed.icon.h / placed.fit.drawnH;
          assert.ok(Math.abs(ratio - 200 / 1200) < 0.001, `${where} 的图标没有按人物高度换算`);
        }
        if (kind === 'cheer') {
          assert.equal(placed.pieces.length, 8, `${where} 的纸屑不是 8 片`);
          const centers = placed.pieces.map((piece) => piece.x + piece.w / 2);
          assert.ok(Math.min(...centers) < placed.head.x, `${where} 的纸屑没有散到头的左侧`);
          assert.ok(Math.max(...centers) > placed.head.x + placed.head.w, `${where} 的纸屑没有散到头的右侧`);
        }
      }
    }
  }
  const fit = fitPeep(frame.w, frame.h, 'card');
  assert.equal(fit.view.width, 850);
  assert.equal(fit.view.height, 1200);
  assert.ok(fit.offsetX >= -0.05 && fit.offsetY >= -0.05);
  assert.ok(fit.offsetX + fit.drawnW <= frame.w + 0.05);
  assert.ok(fit.offsetY + fit.drawnH <= frame.h + 0.05);
  assert.ok(fit.drawnW > frame.w * 0.6 && fit.drawnH > frame.h * 0.9, `${frame.name} 把人物裁小了`);
}

function hits(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const layout = cardLayout();
const cells = [...layout.poses, ...layout.states];
assert.equal(layout.poses.length, 8);
assert.equal(layout.states.length, 3);
for (const cell of cells) {
  const fit = fitPeep(cell.stage.w, cell.stage.h, 'card');
  assert.ok(fit.drawnW <= cell.stage.w + 0.05 && fit.drawnH <= cell.stage.h + 0.05, `${cell.label} 的人物画出格子`);
  assert.ok(cell.stage.x >= 0 && cell.stage.y >= 0);
  assert.ok(cell.stage.x + cell.stage.w <= layout.width);
  assert.ok(cell.caption.x + cell.caption.w <= layout.width);
  assert.ok(cell.caption.y + cell.caption.h <= layout.height);
  assert.equal(hits(cell.stage, cell.caption), false, `${cell.label} 的标签压住人物`);
}
const boxes = cells.flatMap((cell) => [cell.stage, cell.caption]);
for (let i = 0; i < boxes.length; i += 1) {
  for (let j = i + 1; j < boxes.length; j += 1) {
    assert.equal(hits(boxes[i], boxes[j]), false, `角色卡格子重叠 ${i} 和 ${j}`);
  }
}
assert.ok(layout.foot.y >= cells.at(-1).caption.y + cells.at(-1).caption.h);
assert.equal(hits(layout.foot, cells.at(-1).caption), false, '脚注压住标签');
assert.ok(layout.foot.y + layout.foot.h <= layout.height - 28);

const html = cardHtml({name: '甲', version: 1, theme: 'lecture', look: {preset: 'male'}});
const check = placeMarks(230, 324, 'card', 'check', 0);
const checkFig = html.split('data-pose="check"')[1].split('</figure>')[0];
assert.match(checkFig, new RegExp(`left:${cssPx(check.icon.x)}px`));
assert.match(checkFig, new RegExp(`top:${cssPx(check.icon.y)}px`));
assert.match(checkFig, new RegExp(`width:${cssPx(check.icon.w)}px`));
assert.match(checkFig, new RegExp(`height:${cssPx(check.icon.h)}px`));
assert.match(checkFig, /class="peep"/);
const cheerFig = html.split('data-pose="cheer"')[1].split('</figure>')[0];
assert.equal(cheerFig.split('class="mark"').length - 1, 8);
assert.doesNotMatch(cheerFig, /width="230"/);
assert.doesNotMatch(cheerFig, /height="324"/);

console.log('test-icon-place：图标按人物尺寸摆在头顶右上，纸屑不压脸，角色卡格子和标签不重叠');
