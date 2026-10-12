#!/usr/bin/env node
// A / B 的打扮在令牌里。techbrief 没有这组键。九种版式同一份场景只改 style / motion。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {dressOf} from '../../template/src/scene/look.ts';
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
