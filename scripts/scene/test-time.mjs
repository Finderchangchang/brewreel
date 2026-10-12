#!/usr/bin/env node
// 三种来源各走各的函数。逐字出场 = 字时间 − 提前量，并且单调。
import assert from 'node:assert/strict';
import {revealFromBeats, revealFromSentenceInterp, revealFromSentences, revealFromWords} from './time.mjs';

const words = [0.2, 0.8, 1.4];
const duration = 4;
const leads = {crisp: 0.08, soft: 0.12, bounce: 0.12, paper: 0.2};

for (const [motion, lead] of Object.entries(leads)) {
  const plan = revealFromWords(words, motion, duration, 'talk-marks');
  assert.equal(plan.source, 'word');
  assert.equal(plan.kind, 'talk-marks');
  assert.equal(plan.lead, lead);
  assert.deepEqual(plan.at, words.map((mark) => mark - lead));
  for (let i = 1; i < plan.at.length; i++) assert.ok(plan.at[i] >= plan.at[i - 1]);
}

const clamped = revealFromWords([1, 0.2], 'soft', duration);
assert.equal(clamped.source, 'word');
assert.ok(clamped.at[0] <= 0.35);
assert.ok(clamped.at[1] >= clamped.at[0]);

const sentences = revealFromSentences(words, 'soft', duration);
assert.equal(sentences.source, 'sentence');
assert.equal(sentences.kind, 'lesson-human');
assert.equal(sentences.resolution, 'sentence-start');
assert.notEqual(sentences.source, 'word');

const interp = revealFromSentenceInterp(words, 'soft', duration);
assert.equal(interp.source, 'sentence');
assert.equal(interp.kind, 'tts-sentence');
assert.equal(interp.resolution, 'sentence-interp');
assert.notEqual(interp.source, 'word');
assert.deepEqual(interp.at, words.map((mark) => mark - 0.12));
assert.deepEqual(sentences.at, words.map((mark) => mark - 0.12));

const beats = revealFromBeats({hanzi: 8, count: 3, motion: 'bounce', bpm: 120});
assert.equal(beats.source, 'beat');
assert.equal(beats.kind, 'promo-no-audio');
assert.equal(beats.charsPerSec, 4);
assert.equal(beats.bpm, 120);
assert.equal(beats.beat, 0.5);
assert.ok(beats.duration >= 0.5);
assert.equal(beats.at.length, 3);
assert.ok(beats.at[0] <= 0.35);
assert.ok(beats.at[2] <= beats.duration - 0.6 + 1e-6);
for (let i = 1; i < beats.at.length; i++) assert.ok(beats.at[i] >= beats.at[i - 1]);
assert.ok(!('resolution' in beats));
assert.notEqual(beats.source, sentences.source);
assert.notEqual(beats.source, clamped.source);
