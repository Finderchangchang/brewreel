#!/usr/bin/env node
// 渲染前的准备：同一文案收成四屏，三套风格的块、拍点和曲线参数。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditPlan, checkFrames, ensureContrast, holdPose, measureEnter, poseAt, prepareScene, protoScene} from '../../template/src/scene/prepare.ts';
import {sceneFrame} from './geom.mjs';
import {loadStyle} from './tokens.mjs';
import {formatReport, validateScene} from './validate-scene.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = JSON.parse(readFileSync(path.join(ROOT, 'scripts/scene/fixtures/example-promo.json'), 'utf8'));
const collapsed = protoScene(fixture);

assert.deepEqual(collapsed.screens.map((screen) => `${screen.role}:${screen.layout}`), [
  'claim:hero',
  'points:grid',
  'compare:split',
  'number:hero',
  'action:end',
]);
assert.equal(collapsed.screens[0].text, fixture.screens[0].text);
assert.equal(collapsed.screens[1].items[1].text, '给出回复');
assert.equal(collapsed.screens[1].items[1].note, '三条里挑一条');
assert.equal(collapsed.screens[2].right.items[1], '直接发送');
assert.equal(collapsed.screens[4].brand, '示例助手');

function planFor(product, style, motion) {
  const scene = {...collapsed, product, style, motion};
  const result = validateScene(scene);
  assert.equal(result.ok, true, formatReport(result));
  const token = loadStyle(product, style);
  assert.ok(token, style);
  const frame = sceneFrame(result.scene.product, result.scene.aspect);
  return prepareScene({scene: result.scene, roles: token.roles, extra: token.extra, frame});
}

const A = planFor('promo', 'fresh-light', 'bounce');
const B = planFor('lesson', 'editorial', 'crisp');
const C = planFor('talk', 'paper', 'paper');

function linesOf(plan) {
  return plan.screens.map((screen) => screen.blocks.map((block) => `${block.text}|${block.note || ''}`));
}
assert.deepEqual(linesOf(A), linesOf(B));
assert.deepEqual(linesOf(B), linesOf(C));
assert.deepEqual(A.screens.map((screen) => screen.durationFrames), B.screens.map((screen) => screen.durationFrames));
assert.deepEqual(B.screens.map((screen) => screen.durationFrames), C.screens.map((screen) => screen.durationFrames));
assert.ok(A.durationSec >= 6, `A ${A.durationSec}`);
assert.equal(A.align, 'center');
assert.equal(B.align, 'start');
assert.equal(B.screens[0].blocks[0].textAlign, 'start');
assert.equal(A.screens[0].blocks[0].textAlign, 'center');
assert.ok(A.roles.radius > 8, String(A.roles.radius));
assert.equal(B.roles.radius, 0);
assert.equal(A.cardBorder, 'none');
assert.equal(B.cardBorder, '2px solid #121212');
assert.equal(A.paint.inkAdjusted, false);
assert.equal(A.paint.mutedAdjusted, false);
assert.equal(C.paint.mutedAdjusted, false);
assert.equal(A.backdrop.top.toUpperCase(), '#9AF0CF');
assert.notEqual(A.backdrop.top.toUpperCase(), A.backdrop.bottom.toUpperCase());
assert.equal(C.roles.texture, 'paper');
assert.equal(B.roles.weight, 900);
assert.equal(A.headlinePlate, 'card');
assert.equal(B.headlinePlate, 'card');
assert.equal(C.headlinePlate, 'card');

const tech = planFor('promo', 'techbrief', 'push');
assert.equal(tech.headlinePlate, 'none');
assert.equal(tech.style, 'techbrief');
assert.deepEqual(linesOf(tech), linesOf(A));

for (const plan of [A, B, C]) {
  const issues = auditPlan(plan);
  assert.deepEqual(issues, [], issues.join('；'));
  assert.ok(checkFrames(plan).includes(0));
  for (const screen of plan.screens) {
    assert.equal(screen.reveal.source, 'beat');
    assert.equal(screen.reveal.kind, 'promo-no-audio');
    assert.equal(screen.blocks[0].showAt, 0);
    assert.ok(screen.curve.motion === plan.motion);
    for (let i = 1; i < screen.blocks.length; i++) {
      assert.equal(screen.blocks[i].showAt, screen.reveal.at[i]);
    }
  }
  for (const row of plan.contrast) {
    if (row.painted) assert.ok(row.ratio >= 4.5, `${plan.style} ${row.pair} ${row.ratio}`);
  }
}

const mutedBgA = A.contrast.find((row) => row.pair === 'muted/bg');
const mutedBgC = C.contrast.find((row) => row.pair === 'muted/bg');
assert.ok(mutedBgA.ratio < 4.5 && mutedBgA.painted === false);
assert.ok(mutedBgC.ratio < 4.5 && mutedBgC.painted === false);
assert.ok(B.contrast.find((row) => row.pair === 'muted/bg').ratio >= 4.5);

const darkened = ensureContrast('#5B6B75', '#9AF0CF');
assert.equal(darkened.adjusted, true);
assert.ok(darkened.ratio >= 4.5, String(darkened.ratio));
assert.notEqual(A.paint.muted.toUpperCase(), darkened.color);

const parkedPush = holdPose('push', A.height);
assert.deepEqual(parkedPush, poseAt('push', 0, A.height));
assert.equal(parkedPush.y, 64);
assert.equal(parkedPush.scale, 1);
for (const motion of ['crisp', 'bounce', 'soft', 'paper']) {
  assert.deepEqual(holdPose(motion, A.height), {y: 0, scale: 1, tilt: 0, opacity: 1}, motion);
}

const bounce = measureEnter('bounce', A.height);
const crisp = measureEnter('crisp', B.height);
const paper = measureEnter('paper', C.height);
assert.equal(bounce.scaleTurns, 1, JSON.stringify(bounce));
assert.equal(crisp.scaleTurns, 0, JSON.stringify(crisp));
assert.equal(paper.vertical, 'up', JSON.stringify(paper));
assert.equal(crisp.vertical, 'still');
assert.ok(paper.tiltPeak >= 10 && paper.tiltPeak <= 18, String(paper.tiltPeak));
assert.equal(B.screens[0].curve.overshootPx, 0);
assert.ok(A.screens[0].curve.overshootPx > 0);
assert.ok(C.screens[0].curve.overshootDeg >= 10 && C.screens[0].curve.overshootDeg <= 18);

let hits = 0;
for (const screen of A.screens) {
  for (let i = 0; i < screen.blocks.length; i++) {
    for (let j = i + 1; j < screen.blocks.length; j++) {
      const a = screen.blocks[i];
      const b = screen.blocks[j];
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 1 && iy > 1) hits += 1;
    }
  }
}
assert.equal(hits, 0);

const coverageRaw = JSON.parse(readFileSync(path.join(ROOT, 'scripts/scene/fixtures/coverage.json'), 'utf8'));
const coverageChecked = validateScene(coverageRaw);
assert.equal(coverageChecked.ok, true, formatReport(coverageChecked));
for (const spec of [
  {product: 'promo', style: 'fresh-light', motion: 'bounce', aspect: '9:16'},
  {product: 'lesson', style: 'editorial', motion: 'crisp', aspect: '9:16'},
  {product: 'lesson', style: 'editorial', motion: 'crisp', aspect: '16:9'},
]) {
  const scene = {...coverageChecked.scene, ...spec};
  const again = validateScene(scene);
  assert.equal(again.ok, true, formatReport(again));
  const token = loadStyle(spec.product, spec.style);
  const frame = sceneFrame(spec.product, spec.aspect);
  const plan = prepareScene({scene: again.scene, roles: token.roles, extra: token.extra, frame});
  const issues = auditPlan(plan).filter((item) => spec.aspect === '9:16' || !item.includes('画幅'));
  assert.deepEqual(issues, [], `${spec.product} ${spec.aspect} ${issues.join('；')}`);
  const number = plan.screens.find((item) => item.role === 'number');
  const stage = number.blocks.find((block) => block.kind === 'stage');
  const caption = number.blocks.find((block) => block.kind === 'caption');
  assert.ok(stage.font >= caption.font * 2, `${spec.aspect} ${stage.font} vs ${caption.font}`);
  assert.equal(stage.mono, true);
  assert.ok(number.blocks.some((block) => block.kind === 'kicker' && block.mono));
  assert.equal(plan.screens.some((item) => item.imageSrc && item.imageSrc.includes('detail-screen')), true);
  if (spec.product === 'promo' && spec.aspect === '9:16') {
    for (const screen of plan.screens) {
      const plate = screen.layout === 'board' || screen.layout === 'number' || screen.layout === 'media';
      if (plate) {
        assert.equal(screen.safe.y, 260, `${screen.role} 资讯板应改用讲课竖版上沿`);
        assert.equal(screen.safe.x, 180);
        assert.equal(screen.safe.w, 720);
        assert.equal(screen.safe.h, 1080);
        assert.ok(screen.blocks[0].y < 400, `${screen.role} 标题带应上移，现在 y=${screen.blocks[0].y}`);
      } else {
        assert.ok(screen.blocks[0].y >= 560, `${screen.role} 仍用宣传片主体区，y=${screen.blocks[0].y}`);
      }
    }
    const evidence = plan.screens.find((item) => item.role === 'media').blocks.find((block) => block.kind === 'evidence');
    assert.ok(evidence.h >= 600, `证据卡应占满剩余高度，现在 ${evidence.h}`);
  }
}

console.log(`prepare ok ${A.durationSec.toFixed(2)}s ${A.screens.map((screen) => screen.duration.toFixed(2)).join('+')} frames ${A.durationFrames}`);
console.log(`measure bounce turns ${bounce.scaleTurns} dy ${bounce.dy.toFixed(2)} | crisp turns ${crisp.scaleTurns} ${crisp.vertical} | paper ${paper.vertical} tilt ${paper.tiltPeak.toFixed(1)}`);
