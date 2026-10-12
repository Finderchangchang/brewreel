#!/usr/bin/env node
// 预设表和代码里的镜头清单一一对应。新增镜头忘了登记，这里会失败。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {LAYOUTS as LESSON_LAYOUTS} from '../lesson/validate-lesson.mjs';
import {PRESETS} from './from-legacy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TALK_TEMPLATES = ['keyword', 'checklist', 'steps', 'counter', 'compare'];
const KEEP_OLD = ['quiz', 'journey', 'chat', 'phone', 'mockApp', 'dataChart', 'meter', 'photoShot'];
const textOf = (value) => typeof value === 'string' && value.trim().length > 0;

function shotTypesFromIndex() {
  const src = fs.readFileSync(path.join(ROOT, 'template/src/shots/index.ts'), 'utf8');
  const block = src.match(/const REG(?::[^=]+)?=\s*\{([\s\S]*?)\n\};/);
  assert.ok(block, '找不到 SHOT_TYPES 的 REG');
  return [...block[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9]*):/gm)].map((hit) => hit[1]);
}

function namesOf(product) {
  return PRESETS.filter((row) => row.product === product).map((row) => row.legacy).sort();
}

const shotTypes = shotTypesFromIndex().sort();
assert.deepEqual(namesOf('promo'), shotTypes, '宣传片预设和 SHOT_TYPES 对不上');

const lessonNames = [...LESSON_LAYOUTS].sort();
assert.deepEqual(namesOf('lesson'), lessonNames, '讲课预设和 lessonLayouts 对不上');

assert.deepEqual(namesOf('talk'), [...TALK_TEMPLATES].sort(), '口播五个模板对不上');

for (const name of KEEP_OLD) {
  const row = PRESETS.find((item) => item.legacy === name && (name === 'quiz' || name === 'journey' ? item.product === 'film' : item.product === 'promo'));
  assert.ok(row, `保留旧组件的「${name}」不在预设表里`);
  assert.equal(row.keepLegacy, true, `${name} 应记成保留旧组件`);
  assert.equal(row.layout, '不可展开');
  assert.ok(textOf(row.reason), `${name} 要写明为什么保留旧组件`);
}

const required = ['legacy', 'product', 'layout', 'styleSource', 'exit', 'delta'];
for (const row of PRESETS) {
  for (const key of required) {
    assert.ok(row[key] !== undefined && row[key] !== '', `${row.product}:${row.legacy} 缺 ${key}`);
  }
  if (row.layout !== '不可展开') {
    assert.ok(row.role, `${row.product}:${row.legacy} 要有内容种类`);
  }
}

const keys = PRESETS.map((row) => `${row.product}:${row.legacy}`);
assert.equal(new Set(keys).size, keys.length, '预设表有重复的 product+legacy');

const counter = PRESETS.find((row) => row.product === 'promo' && row.legacy === 'counter');
assert.match(counter.delta, /降幅/);

console.log(`presets ok (${PRESETS.length} 行：promo ${shotTypes.length} / lesson ${lessonNames.length} / talk ${TALK_TEMPLATES.length} / film 2)`);
