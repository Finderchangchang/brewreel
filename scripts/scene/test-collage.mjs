#!/usr/bin/env node
// 剪纸拼贴：接力时长、锚点姿态、配色距离、示例能通过准备。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deltaE} from '../../template/src/talk/motion/kit/color.ts';
import {confettiCount} from '../../template/src/talk/motion/kit/confetti.ts';
import {auditPlan, prepareScene} from '../../template/src/scene/prepare.ts';
import {defaultMotion} from '../../template/src/scene/motion.ts';
import {ANCHOR, PATCH, TOSS_AT, anchorPose, collageDurations, guideAt, openSettle, relayOf, worldScale} from '../../template/src/scene/backdrops/collage-time.ts';
import palette from '../../template/src/scene/styles/cutpaper-collage.json' with {type: 'json'};
import {sceneFrame} from './geom.mjs';
import {loadStyle} from './tokens.mjs';
import {formatReport, validateScene} from './validate-scene.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const example = JSON.parse(readFileSync(path.join(ROOT, 'examples/scene/d-cutpaper.json'), 'utf8'));

const durations = collageDurations(example.screens);
assert.equal(durations.length, 8);
const frames = durations.map((sec) => Math.round(sec * 30));
assert.equal(frames.reduce((sum, n) => sum + n, 0), 720);
assert.ok(durations.some((sec) => Math.abs(sec / 0.5 - Math.round(sec / 0.5)) > 0.05), '时长不应全部落在半秒网格');
assert.deepEqual(durations, [4, 3.2, 1.8, 3.6, 4.2, 3.8, 1.4, 2]);
assert.ok(durations[2] >= 1.5 && durations[2] <= 2.5, '带路这一段的长度');

const area = (ANCHOR.w * ANCHOR.h) / (1080 * 1920);
assert.ok(area >= 0.12 && area <= 0.18, area);
assert.ok(Math.abs(ANCHOR.cx - 540) / 1080 <= 0.08);
assert.ok(Math.abs(ANCHOR.cy - 960) / 1920 <= 0.05);
assert.equal(ANCHOR.tilt, 6);
assert.ok(PATCH.scale >= 0.15 && PATCH.scale <= 0.25);
assert.ok(Math.abs(anchorPose('card', 0, 0, false).tilt - anchorPose('patch', 2, 1, false).tilt) <= 3);

const open = anchorPose('card', 0, 0, false);
assert.equal(open.show, true);
assert.equal(open.scale, 1);
assert.equal(open.tilt, 6);
const apex = anchorPose('card', TOSS_AT + openSettle.up, 0, false);
assert.ok(apex.cy < 700, apex.cy);
assert.ok(openSettle.travel >= 0.15 && openSettle.travel <= 0.25);
assert.ok(openSettle.up >= 0.4 && openSettle.up <= 0.7);
assert.ok(openSettle.down >= 0.8 && openSettle.down <= 1.1);
assert.ok(openSettle.tiltOver >= 10 && openSettle.tiltOver <= 18);
assert.ok(openSettle.posOver <= 0.01);
assert.ok(Math.abs(openSettle.at(openSettle.duration).y) <= 0.01 * 1920);

const flying = anchorPose('patch', 0.67, 1, false);
assert.equal(flying.space, 'screen');
assert.ok(Math.abs(flying.scale - PATCH.scale * 2.4) < 0.05, flying.scale);
assert.equal(worldScale('patch', 3.2, 3.2, false), 1);
const seated = anchorPose('patch', 3.2, 1, false);
assert.equal(seated.space, 'garment');
assert.equal(seated.scale, PATCH.scale);

assert.equal(anchorPose('guide', 0.4, 2, false).show, false);
const moth = guideAt(0, 1.8);
assert.ok(moth.size / 1080 >= 0.08 && moth.size / 1080 <= 0.14);

const win0 = anchorPose('window', 0, 5, false);
const win1 = anchorPose('window', 2.5, 5, false);
assert.equal(win1.round, 1);
assert.equal(win0.cx, win1.cx);
assert.equal(win0.cy, win1.cy);
assert.ok(win1.swirl > 0);

const end0 = anchorPose('card', 0, 7, false);
const end1 = anchorPose('card', 0.2, 7, false);
assert.ok(end0.scale < 0.5);
assert.equal(end1.scale, 1);
assert.ok(Math.abs(end1.cy - ANCHOR.cy) < 1);

const count = confettiCount(12);
assert.ok(count >= 8 && count <= 20, count);

const grounds = ['bg', 'bg_plaster', 'bg_meadow', 'bg_cream', 'bg_swap', 'bg_drum'];
for (const key of grounds) {
  const d = deltaE(palette.palette.accent, palette.palette[key]);
  assert.ok(d >= 10, `${key} ΔE00 ${d}`);
}
for (const key of ['scrapA', 'scrapB', 'scrapC']) {
  const d = deltaE(palette.palette.accent, palette.palette[key]);
  assert.ok(d > 8, `${key} ΔE00 ${d}`);
}
assert.equal(palette.roles.accent, palette.palette.accent);

assert.equal(defaultMotion('promo', 'cutpaper-collage', false), 'crisp');
const token = loadStyle('promo', 'cutpaper-collage');
assert.equal(token.id, 'cutpaper-collage');
assert.equal(token.roles.accent, palette.roles.accent);

const result = validateScene(example);
assert.equal(result.ok, true, formatReport(result));
const plan = prepareScene({scene: result.scene, roles: token.roles, extra: token.extra, frame: sceneFrame('promo', '9:16')});
assert.equal(plan.durationSec, 24);
assert.equal(plan.durationFrames, 720);
assert.deepEqual(plan.screens.map((screen) => screen.relay), ['card', 'patch', 'guide', 'tumble', 'postcard', 'window', 'patch', 'card']);
assert.deepEqual(plan.screens.map((screen) => screen.duration), durations);
assert.deepEqual(auditPlan(plan), []);

const bare = example.screens.map((screen) => ({role: screen.role, layout: screen.layout}));
assert.deepEqual(bare.map((screen, index) => relayOf(screen, index, bare.length)), ['card', 'patch', 'guide', 'postcard', 'card', 'window', 'patch', 'card']);

const bad = validateScene({...example, screens: [{...example.screens[0], relay: 'spin'}]});
assert.equal(bad.ok, false);
const foreign = validateScene({
  product: 'promo',
  aspect: '9:16',
  style: 'fresh-light',
  motion: 'bounce',
  screens: [{role: 'claim', layout: 'hero', text: '补好再穿', relay: 'card'}],
});
assert.equal(foreign.ok, false);

console.log('test-collage ok');
