#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {internalLeaks, repetition, thinBrief} from './text-quality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'm6a-quality-'));
const run = (file, args) => spawnSync(process.execPath, [path.join(ROOT, file), ...args], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
const page = (narration, extra = {}) => ({layout: 'steps', title: '内容', items: ['第一点', '第二点'], narration: narration.map((text) => ({text})), ...extra});
const lesson = (pages, domain = 'legal') => ({meta: {format: 'lesson', title: '课程', domain}, chapters: [{title: '章节', pages}]});
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`✓ ${name}`); } catch (error) { console.error(`✗ ${name}: ${error.message}`); process.exitCode = 1; } }

test('内部词和正则命中给出页码、句子和修改建议', () => {
  const result = internalLeaks(lesson([page(['条文原文以核对语料为准。', '来源校验仍需完成。'], {title: '按大纲提示：核对来源'})]));
  assert.equal(result.ok, false);
  assert.ok(result.blocks.some((x) => x.includes('第 1 页第 1 句旁白') && x.includes('以核对语料为准')));
  assert.ok(result.blocks.some((x) => x.includes('卡片字段 title')));
  assert.ok(result.blocks.every((x) => x.includes('请改成')));
});

test('出处 source 不拦截；tech 白名单允许“大模型”和常见模型表述', () => {
  const tech = lesson([page(['大模型可以帮助理解代码，也要评估模型能力。', '不要把模型的建议直接当作决定。'], {source: '内部语料说明'})], 'tech');
  assert.equal(internalLeaks(tech).ok, true);
  assert.equal(internalLeaks(lesson([page(['这句话提到模型流程。'])], 'tech')).ok, false);
});

test('重复整句出现三次会 block', () => {
  const result = repetition(lesson([page(['请先检查这项修改。', '请先检查这项修改！', '请先检查这项修改。'])]));
  assert.equal(result.ok, false);
  assert.match(result.blocks[0], /出现 3 次/u);
});

test('十字以上片段出现在四句旁白中会 warn 并给出前五项', () => {
  const lines = [
    '每次都要仔细查看完整代码差异，再开始下一步。',
    '提交前应该仔细查看完整代码差异，确认变化范围。',
    '评估修改时要仔细查看完整代码差异，了解影响。',
    '准备交付之前仔细查看完整代码差异，避免遗漏。'
  ];
  const result = repetition(lesson([page(lines)]));
  assert.equal(result.ok, true);
  assert.ok(result.warnings.length);
  assert.ok(result.topFragments.length <= 5);
});

test('brief 要点少于时长两倍时提示建议条数', () => {
  const result = thinBrief({minutes: 3, points: ['一', '二', '三']});
  assert.equal(result.ok, false);
  assert.match(result.warnings[0], /建议补到 6 条/u);
});

test('generate 将内部词原始错误回喂修复，并保留干净结果', () => {
  const out = path.join(TMP, 'generate-repaired');
  const fixture = path.join(ROOT, 'scripts/lesson/fixtures/internal-leak');
  const result = run('scripts/lesson/generate-lesson.mjs', ['--brief', path.join(ROOT, 'examples/lesson/briefs/what-is-codex.json'), '--out', out, '--mock-llm', fixture]);
  assert.equal(result.status, 0, result.stderr);
  const log = fs.readFileSync(path.join(out, 'generate-log.txt'), 'utf8');
  assert.match(log, /回喂 .*原始错误/u);
  const output = fs.readFileSync(path.join(out, 'lesson.json'), 'utf8');
  assert.ok(!output.includes('以核对语料为准'));
});

test('make 遇到内部词在出片前以退出码 1 阻断', () => {
  const input = path.join(TMP, 'leaky-lesson.json');
  fs.writeFileSync(input, JSON.stringify(lesson([page(['按大纲提示继续讲解。'])])));
  const result = run('scripts/lesson/make-lesson.mjs', [input, '--out', path.join(TMP, 'blocked-render'), '--voice-provider', 'mock']);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /内部用语检查未通过/u);
  assert.match(result.stderr, /第 1 页/u);
});

console.log(`test-quality：${passed}/7 通过`);
