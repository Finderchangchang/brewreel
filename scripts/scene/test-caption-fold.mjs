#!/usr/bin/env node
// 字幕孤段：少于 4 字或短于 0.6 秒，并进前一段、并进后一段，或丢掉。点亮时刻不变。
import assert from 'node:assert/strict';
import {CAPTION_ORPHAN_MIN_CHARS, CAPTION_ORPHAN_MIN_SEC, foldShortCaptions} from './voice-plan.mjs';

assert.equal(CAPTION_ORPHAN_MIN_CHARS, 4);
assert.equal(CAPTION_ORPHAN_MIN_SEC, 0.6);

function page(text, start, step = 0.2) {
  const chars = [...text].map((ch, index) => ({ch, at: Number((start + index * step).toFixed(3))}));
  return {startSec: chars[0].at, endSec: chars[chars.length - 1].at, font: 48, chars};
}

function shown(pages) {
  return pages.map((item) => item.chars.filter((ch) => ch.ch !== '\n').map((ch) => ch.ch).join(''));
}

function atOf(pages, ch) {
  for (const page of pages) {
    const hit = page.chars.find((item) => item.ch === ch);
    if (hit) return hit.at;
  }
  return null;
}

const before = foldShortCaptions([page('规格先摆好', 0.2), page('顾客', 1.4, 0.12)], 720, 40, 5);
assert.deepEqual(shown(before), ['规格先摆好顾客']);
assert.equal(atOf(before, '顾'), 1.4);
assert.equal(atOf(before, '规'), 0.2);
assert.ok(before[0].chars.some((item) => item.ch === '\n') || before[0].chars.length === 7);

const after = foldShortCaptions([page('顾客', 0.3, 0.1), page('不用再点开', 0.8)], 720, 40, 5);
assert.deepEqual(shown(after), ['顾客不用再点开']);
assert.equal(atOf(after, '顾'), 0.3);
assert.equal(atOf(after, '不'), 0.8);

const dropped = foldShortCaptions([page('顾客', 1.2, 0.1)], 720, 40, 5);
assert.deepEqual(shown(dropped), []);

const wide = page('规格先摆到第一屏再写一行容量和价格原料配送', 0.2, 0.08);
const stuck = foldShortCaptions([wide, page('顾客', 4.2, 0.1)], 80, 40, 8);
assert.deepEqual(shown(stuck), [shown([wide])[0]]);
assert.equal(atOf(stuck, '顾'), null);

console.log('caption-fold ok');
