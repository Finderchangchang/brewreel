#!/usr/bin/env node
// 配音时间、字幕盒子、缺密钥。不出片。
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditPlan, pieceTextsOf, prepareScene, protoScene} from '../../template/src/scene/prepare.ts';
import {sceneFrame} from './geom.mjs';
import {speakScreens} from './speak.mjs';
import {loadStyle} from './tokens.mjs';
import {validateScene} from './validate-scene.mjs';
import {LEAD_SEC, boxesOverlap, captionBoxFor, clocksFor, marksForTexts, timingExclusive} from './voice-plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const narration = '规格先摆';
const words = [...narration].map((ch, index) => ({text: ch, startMs: index * 225, endMs: (index + 1) * 225}));
const marks = marksForTexts(narration, words, ['规格先摆', '先摆']);
assert.equal(marks[0], LEAD_SEC);
assert.equal(Number(marks[1].toFixed(3)), Number((LEAD_SEC + 0.45).toFixed(3)));

const clocks = clocksFor(
  [{narration: '规格先摆到第一屏。'}, {text: '没有旁白'}],
  [{index: 0, words, durMs: 900}],
  () => ['规格先摆'],
);
assert.equal(clocks[0].source, 'word');
assert.equal(clocks[1].source, 'beat');
assert.notEqual(JSON.stringify(clocks[0]), JSON.stringify(clocks[1]));

assert.equal(timingExclusive({source: 'word', kind: 'tts-words', lead: 0.08, at: [0]}), '');
assert.match(timingExclusive({source: 'word', kind: 'tts-words', lead: 0.08, at: [0], bpm: 120}), /拍点/);
assert.equal(timingExclusive({source: 'beat', kind: 'promo-no-audio', bpm: 120, at: [0]}), '');
assert.match(timingExclusive({source: 'beat', kind: 'promo-no-audio', bpm: 120, at: [0], lead: 0.08}), /提前/);
assert.match(timingExclusive({source: 'sentence', kind: 'lesson-human', at: [0]}), /不是逐字/);

const classic = captionBoxFor({blocks: [{kind: 'card', x: 80, y: 560, w: 900, h: 400}], safe: {x: 80, y: 560, w: 920, h: 1000}}, 1080);
assert.equal(classic.box.y, 292);
assert.equal(classic.coversCaption, false);
const evidence = {kind: 'evidence', x: 100, y: 260, w: 880, h: 700};
const caption = {kind: 'caption', x: 120, y: 1100, w: 800, h: 80};
const moved = captionBoxFor({blocks: [evidence, caption], safe: {x: 80, y: 200, w: 920, h: 1500}}, 1080);
assert.equal(boxesOverlap(moved.box, evidence), false);

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/scene/fixtures/example-promo.json'), 'utf8'));
const scene = protoScene({...fixture, screens: fixture.screens.slice(0, 2), product: 'promo', style: 'fresh-light', motion: 'bounce'});
const checked = validateScene(scene);
assert.equal(checked.ok, true);
const token = loadStyle('promo', 'fresh-light');
const frame = sceneFrame('promo', '9:16');
const texts = pieceTextsOf(checked.scene.screens[0]);
const plan = prepareScene({
  scene: checked.scene,
  roles: token.roles,
  extra: token.extra,
  frame,
  clocks: [
    {source: 'word', marks: texts.map((_, index) => 0.2 + index * 0.3), duration: 4},
    {source: 'beat'},
  ],
});
assert.equal(plan.screens[0].reveal.source, 'word');
assert.equal(plan.screens[0].reveal.kind, 'tts-words');
assert.equal('bpm' in plan.screens[0].reveal, false);
assert.equal('charsPerSec' in plan.screens[0].reveal, false);
assert.equal(plan.screens[0].blocks[0].showAt, 0);
assert.equal(plan.screens[1].reveal.source, 'beat');
assert.equal(plan.screens[1].reveal.kind, 'promo-no-audio');
assert.equal('lead' in plan.screens[1].reveal, false);
const mixed = auditPlan(plan).filter((line) => line.includes('来源') || line.includes('混'));
assert.deepEqual(mixed, []);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-voice-'));
const missing = await speakScreens([{narration: '你好'}], {provider: 'minimax', cacheDir: tmp, workDir: tmp, env: {}});
assert.equal(missing.ok, false);
assert.match(missing.message, /MINIMAX_API_KEY/);
assert.match(missing.message, /第 1 屏/);
assert.doesNotMatch(missing.message, /sk-/);
const voiced = await speakScreens([{narration: '规格先摆到第一屏'}], {provider: 'mock', cacheDir: tmp, workDir: tmp, env: {}});
assert.equal(voiced.ok, true);
assert.equal(voiced.billedCharacters, 0);
assert.ok(voiced.lines[0].words.length > 0);

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-brief-'));
const brief = spawnSync(process.execPath, ['scripts/scene/brief-to-video.mjs', 'examples/scene/c-techbrief.json', '--out', out], {
  cwd: ROOT,
  encoding: 'utf8',
  env: {...process.env, DEEPSEEK_API_KEY: '', LLM_API_KEY: ''},
  windowsHide: true,
});
assert.equal(brief.status, 2);
assert.match(`${brief.stdout}\n${brief.stderr}`, /没有 DeepSeek 密钥/);
assert.doesNotMatch(`${brief.stdout}\n${brief.stderr}`, /sk-/);

const usage = spawnSync(process.execPath, ['scripts/scene/make-scene.mjs', 'examples/scene/c-techbrief.json', '--out', out], {
  cwd: ROOT,
  encoding: 'utf8',
  windowsHide: true,
});
assert.equal(usage.status, 2, usage.stderr);
assert.match(`${usage.stdout}\n${usage.stderr}`, /旁白/);

console.log('voice-plan ok');
