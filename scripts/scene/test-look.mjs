#!/usr/bin/env node
// A / B 的打扮在令牌里。techbrief 没有这组键。九种版式同一份场景只改 style / motion。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BLOCK_CHIP_EM, CARD_PAD_X, chipFitWidth, dressOf, freshLowerBlob, showTitleTick} from '../../template/src/scene/look.ts';
import {loadStyle} from './tokens.mjs';
import {formatReport, validateScene} from './validate-scene.mjs';

const KEYS = ['stage', 'titleFont', 'kickerWeight', 'titleWeight', 'bodyWeight', 'noteWeight', 'kickerTrackingEm', 'emphasis', 'number', 'step', 'evidence', 'split', 'end'];

assert.equal(dressOf('techbrief'), null);
const fresh = dressOf('fresh-light');
const editorial = dressOf('editorial');
assert.ok(fresh && editorial);
for (const key of KEYS) {
  assert.ok(fresh[key] !== undefined, `fresh-light ${key}`);
  assert.ok(editorial[key] !== undefined, `editorial ${key}`);
}
assert.equal(fresh.stage, 'blobs');
assert.equal(fresh.emphasis, 'block');
assert.equal(fresh.number, 'pill');
assert.equal(fresh.end, 'chip');
assert.equal(editorial.stage, 'paper-grid');
assert.equal(editorial.titleFont, 'serif');
assert.equal(editorial.emphasis, 'marker');
assert.equal(editorial.number, 'rule');
assert.equal(editorial.step, 'index');
assert.equal(editorial.end, 'masthead');
assert.ok(editorial.titleWeight < fresh.titleWeight);
assert.ok(editorial.noteWeight < editorial.bodyWeight && editorial.bodyWeight < editorial.titleWeight);

const blob = freshLowerBlob();
assert.ok(blob.left > 0 && blob.bottom > 0, '左下色块离开画面边缘');
assert.ok(blob.radius >= Math.min(blob.width, blob.height) / 3, '左下色块是大圆角，不是直角矩形');
assert.equal(showTitleTick('blobs', false, true), false);
assert.equal(showTitleTick('blobs', true, true), true);
assert.equal(showTitleTick('paper-grid', false, true), true);
assert.equal(showTitleTick(undefined, false, true), true);
assert.equal(showTitleTick('blobs', false, false), false);
const chip = chipFitWidth(400, 80, true);
assert.equal(chip, 400 - Math.ceil(80 * BLOCK_CHIP_EM) * 2);
assert.ok(chip < 400, '色块内边距从可排字宽度里扣掉');
assert.equal(chipFitWidth(400, 80, false), 400);
assert.equal(CARD_PAD_X, 18);

const raw = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/layouts-9.json'), 'utf8'));
const layouts = ['hero', 'stack', 'split', 'grid', 'sequence', 'board', 'media', 'chart', 'end'];
assert.deepEqual(raw.screens.map((screen) => screen.layout), layouts);
const specs = [
  {style: 'fresh-light', motion: 'bounce', product: 'promo'},
  {style: 'editorial', motion: 'crisp', product: 'lesson'},
  {style: 'techbrief', motion: 'push', product: 'promo'},
];
for (const spec of specs) {
  const scene = {...raw, ...spec};
  const result = validateScene(scene);
  assert.equal(result.ok, true, `${spec.style} ${formatReport(result)}`);
  assert.ok(loadStyle(spec.product, spec.style), spec.style);
}

console.log('look ok');
