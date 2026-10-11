#!/usr/bin/env node
// 场景文字按词断行：不把一个词拆开，不把一个字单独放成一行。放不下先缩字号。
import assert from 'node:assert/strict';
import {fitSceneCopy} from '../../template/src/scene/wrap.ts';

const PHRASES = [
  ['规格先摆到第一屏', '屏'],
  ['容量写清', '清'],
  ['价格相邻', '邻'],
  ['原料可见', '见'],
];

function visibleLen(text) {
  return [...text].filter((ch) => !/[\s，、；：。！？,;:.!?…·]/u.test(ch)).length;
}

const segmenter = new Intl.Segmenter('zh', {granularity: 'word'});

function wordsOf(text) {
  return [...segmenter.segment(text)].map((part) => part.segment).filter((part) => visibleLen(part) >= 2);
}

function assertCopy(text, orphan, maxW, maxPx, minPx) {
  const fitted = fitSceneCopy(text, maxW, maxPx, minPx);
  assert.equal(fitted.lines.join(''), text, text);
  assert.ok(fitted.font >= minPx && fitted.font <= maxPx, `${text} 字号 ${fitted.font}`);
  for (const line of fitted.lines) {
    assert.notEqual(visibleLen(line), 1, `${text} 单字成行「${line}」`);
    assert.notEqual(line, orphan, `${text} 把「${orphan}」单独成行`);
  }
  for (const word of wordsOf(text)) {
    assert.ok(fitted.lines.some((line) => line.includes(word)), `${text} 拆开了「${word}」→ ${fitted.lines.join(' | ')}`);
  }
  return fitted;
}

for (const [text, orphan] of PHRASES) {
  const maxPx = 96;
  const minPx = 40;
  const maxW = ([...text].length - 1) * maxPx - 1;
  const fitted = assertCopy(text, orphan, maxW, maxPx, minPx);
  assert.equal(fitted.lines.length, 1, `${text} 应先缩字号，实际 ${fitted.lines.join(' | ')}`);
  assert.ok(fitted.font < maxPx, `${text} 字号 ${fitted.font} 没有缩小`);
}

const shrunk = fitSceneCopy('容量写清', 96 * 3, 96, 40);
assert.equal(shrunk.lines.join(''), '容量写清');
assert.equal(shrunk.lines.length, 1);
assert.ok(shrunk.font < 96 && shrunk.font >= 40, String(shrunk.font));

const tight = assertCopy('容量写清', '清', 100, 96, 40);
assert.equal(tight.lines.length, 2, tight.lines.join(' | '));

const sentence = '规格先摆到第一屏，顾客不用再点开展开。';
const wrapped = assertCopy(sentence, '屏', 96 * 6, 96, 40);
assert.ok(wrapped.lines.length >= 2, wrapped.lines.join(' | '));
assert.ok(wrapped.lines.every((line) => visibleLen(line) >= 2));

console.log('wrap ok');
