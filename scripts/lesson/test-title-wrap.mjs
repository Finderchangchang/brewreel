import assert from 'node:assert/strict';
import {protectBreaks, titleAtoms, titleLines, WORD_JOINER} from './title-wrap.mjs';

const codex = titleLines('什么是 Codex', {forceTwo: true});
assert.deepEqual(codex, ['什么是', 'Codex']);
assert.equal(codex.some((line) => line === '什么是 C' || line === 'odex'), false);

const claude = titleLines('Claude Code 入门', {forceTwo: true});
assert.deepEqual(claude, ['Claude Code', '入门']);
assert.equal(claude.some((line) => /Cla$/.test(line) || /^ude/.test(line) || line === 'Co' || line === 'de'), false);

const article = titleLines('民法典第六百八十条', {forceTwo: true});
assert.deepEqual(article, ['民法典', '第六百八十条']);
assert.equal(article.some((line) => line.includes('第六') && line.includes('条') === false), false);

assert.deepEqual(titleLines('Codex', {forceTwo: true}), ['Codex']);
assert.deepEqual(titleAtoms('什么是 Codex'), ['什么', '是', 'Codex']);
assert.deepEqual(titleAtoms('Claude Code 入门'), ['Claude Code', '入门']);
assert.ok(titleAtoms('民法典第六百八十条').includes('第六百八十条'));
assert.deepEqual(titleAtoms('不可以'), ['不可以']);
assert.ok(titleAtoms('答案：不可以。').some((atom) => atom.includes('不可以')));
assert.equal(titleLines(`${'甲'.repeat(16)}不可以${'乙'.repeat(16)}`, {maxEm: 30}).some((line) => line.includes('不') && !line.includes('不可以')), false);

const joined = titleLines('镜头讲重点', {forceTwo: true}).join('');
assert.equal(joined, '镜头讲重点');
assert.notEqual(titleLines('镜头讲重点', {forceTwo: true})[0], '镜头');

const gpt = titleLines('用 ChatGPT 账号登录', {forceTwo: true});
assert.ok(gpt.some((line) => line.includes('ChatGPT')));
assert.equal(gpt.join('').replaceAll(' ', ''), '用ChatGPT账号登录');

const safe = protectBreaks('什么是 Codex');
assert.equal(safe.includes(WORD_JOINER), true);
assert.equal(safe.replaceAll(WORD_JOINER, ''), '什么是 Codex');
assert.equal(safe.includes(`C${WORD_JOINER}o${WORD_JOINER}d${WORD_JOINER}e${WORD_JOINER}x`), true);

console.log('✓ 标题断行：什么是 Codex →', codex.join(' / '));
console.log('✓ 标题断行：Claude Code 入门 →', claude.join(' / '));
console.log('✓ 标题断行：民法典第六百八十条 →', article.join(' / '));
console.log('test-title-wrap：3/3 通过');
