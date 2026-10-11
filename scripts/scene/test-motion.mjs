#!/usr/bin/env node
// 四种性格：时长和过冲落在区间里。bounce 有一次反向，crisp 没有，paper 先向上。
import assert from 'node:assert/strict';
import {BOUNCE_SPRING, curveOf, defaultMotion, moneyFlip, popAt} from './motion.mjs';

const ACTIONS = ['enter', 'emphasize', 'count', 'reveal', 'exit'];

function samples(curve, step = 1 / 30) {
  const out = [];
  const end = curve.duration + 0.4;
  for (let t = 0; t <= end + 1e-6; t += step) out.push({t, ...curve.sample(t)});
  return out;
}

for (const action of ACTIONS) {
  for (const motion of ['crisp', 'bounce', 'soft', 'paper']) {
    const curve = curveOf(action, motion, 1000);
    assert.equal(curve.motion, motion);
    assert.equal(curve.action, action);
    assert.ok(curve.duration >= curve.durationRange[0] - 1e-6 && curve.duration <= curve.durationRange[1] + 1e-6, `${motion} ${action} 时长 ${curve.duration}`);
  }
}

const crisp = curveOf('enter', 'crisp');
assert.equal(crisp.overshootPx, 0);
assert.ok(crisp.duration >= 0.16 && crisp.duration <= 0.28);
const crispSamples = samples(crisp);
for (let i = 1; i < crispSamples.length; i++) {
  assert.ok(crispSamples[i].p + 1e-6 >= crispSamples[i - 1].p);
  assert.equal(crispSamples[i].y, 0);
}
let crispTurns = 0;
for (let i = 1; i < crispSamples.length - 1; i++) {
  if (crispSamples[i].p > crispSamples[i - 1].p && crispSamples[i].p > crispSamples[i + 1].p) crispTurns += 1;
}
assert.equal(crispTurns, 0);

const soft = curveOf('enter', 'soft');
assert.equal(soft.duration, 0.35);
assert.equal(soft.overshootPx, 0);
const softSamples = samples(soft);
assert.ok(Math.abs(softSamples[0].y - 16) < 1e-6);
for (const sample of softSamples) assert.ok(sample.y >= -1e-6 && sample.y <= 16 + 1e-6);
for (let i = 1; i < softSamples.length; i++) assert.ok(softSamples[i].y <= softSamples[i - 1].y + 1e-6);

const bounce = curveOf('enter', 'bounce');
assert.equal(BOUNCE_SPRING.damping, 16);
assert.equal(BOUNCE_SPRING.stiffness, 170);
assert.ok(bounce.duration >= 0.25 && bounce.duration <= 0.45, `bounce 折返 ${bounce.duration}`);
assert.ok(bounce.overshootPx > 0);
const scale = [];
for (let frame = 0; frame <= 40; frame++) scale.push(popAt(frame / 30));
let reversals = 0;
for (let i = 1; i < scale.length - 1; i++) {
  if (scale[i] - scale[i - 1] > 0.002 && scale[i + 1] - scale[i] < -0.002 && scale[i] > 1.02) reversals += 1;
}
assert.equal(reversals, 1, `bounce 反向 ${reversals}`);

const paper = curveOf('enter', 'paper', 1000);
assert.ok(paper.up >= 0.4 && paper.up <= 0.7);
assert.ok(paper.down >= 0.8 && paper.down <= 1.1);
assert.ok(paper.overshootDeg >= 10 && paper.overshootDeg <= 18);
assert.ok(paper.overshootPx <= 1000 * 0.01);
assert.ok(paper.sample(0.08).y < 0, 'paper 上抛段应在静止位上方');
const early = paper.sample(0.08).y;
const peak = paper.sample(paper.up).y;
const later = paper.sample(paper.up + 0.05).y;
assert.ok(peak < early, '先向上抛到最高');
assert.ok(later > peak, '上抛之后开始落');

const paperExit = curveOf('exit', 'paper', 1000);
assert.ok(paperExit.duration >= 0.35 && paperExit.duration <= 0.5);

const flip = moneyFlip();
assert.equal(flip.duration, 0.16);
assert.equal(flip.sample(0).p, 0);
assert.equal(flip.sample(0.16).p, 1);

assert.equal(defaultMotion('lesson', 'paper'), 'soft');
assert.equal(defaultMotion('lesson', 'lecture'), 'soft');
assert.equal(defaultMotion('lesson', 'editorial'), 'crisp');
assert.equal(defaultMotion('promo', 'fresh-light', false), 'bounce');
assert.equal(defaultMotion('promo', 'tech-dark', true), 'crisp');
assert.equal(defaultMotion('talk', 'paper'), 'paper');
assert.equal(defaultMotion('talk', 'ink'), 'crisp');
assert.equal(defaultMotion('talk', 'wood'), 'bounce');
assert.equal(defaultMotion('promo', 'techbrief', false), 'push');
assert.equal(defaultMotion('lesson', 'techbrief'), 'push');

for (const action of ACTIONS) {
  const curve = curveOf(action, 'push', 1000);
  assert.equal(curve.motion, 'push');
  assert.ok(curve.duration >= 0.24 && curve.duration <= 0.4, `${action} ${curve.duration}`);
  assert.equal(curve.overshootPx, 0);
  assert.equal(curve.overshootDeg, 0);
}
const push = curveOf('enter', 'push');
assert.equal(push.duration, 0.3);
assert.equal(push.sample(0).y, 64);
assert.ok(Math.abs(push.sample(0.3).y) < 1e-6);
const pushSamples = samples(push);
for (const sample of pushSamples) assert.equal(sample.scale, 1);
for (let i = 1; i < pushSamples.length; i++) {
  if (pushSamples[i].t <= push.duration + 1e-9) assert.ok(pushSamples[i].y <= pushSamples[i - 1].y + 1e-6);
}
const yAt = push.sample(0.2).y;
const yNext = push.sample(0.2 + 1 / 30).y;
assert.ok(yNext - yAt < -0.2, `push 在 200ms 应仍向上，dy ${yNext - yAt}`);
const pushExit = curveOf('exit', 'push');
assert.ok(pushExit.sample(0.26).y < 0);
