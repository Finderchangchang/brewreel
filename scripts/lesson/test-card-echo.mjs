#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARD_ECHO_HINT, cardEchoWarnings, singleChapterWarning, textsEcho} from './card-echo.mjs';
import {validateLesson} from './validate-lesson.mjs';

assert.equal(textsEcho('没约定，视为无利息', '借条里如果没写利息，法律上就视为没有利息。'), false, '正例不应警告');
assert.equal(textsEcho('没约定或约定不明，视为没有利息', '没约定或约定不明，视为没有利息'), true, '反例应警告');
assert.equal(textsEcho('利息', '利息别预先扣除，先扣就按实际借款数额算'), false, '短关键词被包含也不警告');
assert.equal(textsEcho('预先扣除的按实际借款数额计算', '预先扣除的，按实际借款数额计算。'), true, '去标点后几乎一样');

const sample = JSON.parse(readFileSync(new URL('../../examples/lesson/sample-tech.json', import.meta.url), 'utf8'));
const echoLesson = {
  ...sample,
  chapters: [{
    title: '章',
    pages: [
      {layout: 'steps', title: '反例', items: ['没约定或约定不明，视为没有利息', '另一条要点'], narration: [{text: '没约定或约定不明，视为没有利息'}]},
      {layout: 'steps', title: '正例', items: ['没约定，视为无利息', '另一条要点'], narration: [{text: '借条里如果没写利息，法律上就视为没有利息。'}]},
    ],
  }],
};
const warnings = cardEchoWarnings(echoLesson);
assert.deepEqual(warnings, [`chapters[0].pages[0]：${CARD_ECHO_HINT}`]);
const checked = validateLesson(echoLesson);
assert.equal(checked.ok, true, checked.errors.join('；'));
assert.match(checked.warnings.join('\n'), /卡片写关键词，旁白讲完整的话/);
assert.equal(singleChapterWarning(echoLesson).length, 0, '没有章节页时不提示');

const oneChapter = {
  ...sample,
  chapters: [{
    title: '只有一章',
    pages: [
      {layout: 'chapter', title: '这一章', subtitle: '时长并到后一页', narration: [{text: '这一章先看结构。'}]},
      {layout: 'steps', title: '两步', items: ['先看', '再做'], narration: [{text: '先看结构，再动手。'}]},
    ],
  }],
};
assert.deepEqual(singleChapterWarning(oneChapter), ['全片只有 1 章，章节页不会单独成页，时长并到后一页']);
const hinted = validateLesson(oneChapter);
assert.equal(hinted.ok, true, hinted.errors.join('；'));
assert.match(hinted.warnings.join('\n'), /全片只有 1 章，章节页不会单独成页，时长并到后一页/);

const script = readFileSync(new URL('./prompts/script.txt', import.meta.url), 'utf8');
const outline = readFileSync(new URL('./prompts/outline.txt', import.meta.url), 'utf8');
const generate = readFileSync(new URL('./generate-lesson.mjs', import.meta.url), 'utf8');
assert.match(script, /卡片写关键词，旁白讲完整的话/);
assert.match(script, /没约定，视为无利息/);
assert.match(script, /没约定或约定不明，视为没有利息/);
assert.match(outline, /卡片只写关键词，旁白再讲完整的话/);
assert.match(generate, /卡片写关键词，旁白讲完整的话：卡片上一行不要和旁白里的一句几乎一样/);

console.log('test-card-echo：重复警告、单章提示、讲稿规矩');
