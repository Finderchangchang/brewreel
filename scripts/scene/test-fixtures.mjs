#!/usr/bin/env node
// 文档例 1、例 2 通过结构检查。全文没有坐标、帧号、毫秒字段。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {formatReport, validateScene, validateSceneFile} from './validate-scene.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const coord = /"(x|y|frame|ms|fps|startMs|endMs|durationMs)"\s*:/;

for (const name of ['example-promo.json', 'example-lesson.json']) {
  const file = path.join(dir, name);
  const raw = readFileSync(file, 'utf8');
  assert.equal(coord.test(raw), false, `${name} 出现了坐标或时间字段`);
  const result = validateSceneFile(file);
  assert.equal(result.ok, true, formatReport(result, name));
  assert.equal(result.errors.length, 0);
  assert.equal(result.rewrites.length, 0);
  assert.ok(result.scene.screens.length >= 1);
}

const bad = JSON.parse(readFileSync(path.join(dir, 'example-promo.json'), 'utf8'));
bad.screens[0].x = 120;
bad.screens[0].frame = 0;
const rejected = validateScene(bad);
assert.equal(rejected.ok, false);
assert.ok(rejected.errors.some((item) => item.where === 'screens[0].x'));
assert.ok(rejected.errors.some((item) => item.problem.includes('frame') || item.where.endsWith('.frame')));
assert.ok(formatReport(rejected).includes('怎么改'));

const unknown = validateScene({product: 'promo', aspect: '9:16', style: 'no-such-theme', motion: 'bounce', screens: [{role: 'claim', layout: 'hero', text: '一句', narration: '一句'}]});
assert.equal(unknown.ok, false);
assert.ok(unknown.errors.some((item) => item.where === 'style' && item.fix.includes('fresh-light')));

const missed = validateScene({
  product: 'lesson',
  aspect: '16:9',
  style: 'paper',
  motion: 'soft',
  screens: [{role: 'points', layout: 'sequence', narration: '写清金额', items: [{text: '签名', when: '不在旁白里'}]}],
});
assert.equal(missed.ok, false);
assert.ok(missed.errors.some((item) => item.where.includes('when') && item.fix.includes('旁白')));
