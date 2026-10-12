#!/usr/bin/env node
// T21：横版几何、讲课字段、口播 scene 模板。
import assert from 'node:assert/strict';
import {layoutBlocks, sceneFrame, captionBox} from './geom.mjs';
import {probeScale} from '../../template/src/core/probe-scale.ts';
import {validateMotionClip} from '../broll/motion.mjs';
import {parseSrt} from '../broll/srt.mjs';
import {prepareScene} from '../../template/src/scene/prepare.ts';
import {formatReport, validateScene} from './validate-scene.mjs';
import {loadStyle} from './tokens.mjs';

const promo = sceneFrame('promo', '9:16');
const wide = sceneFrame('lesson', '16:9');

function hits(a, b) {
  return a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5;
}

const sides = [
  {labelChars: 2, itemChars: [3, 3, 3]},
  {labelChars: 2, itemChars: [3, 3, 3]},
];
const portraitSplit = layoutBlocks({
  layout: 'split',
  count: 8,
  chars: [2, 3, 3, 3, 2, 3, 3, 3],
  safe: promo.safe,
  floor: promo.floor,
  maxRow: promo.maxRow,
  portrait: true,
  sides,
});
assert.equal(portraitSplit.overflow, false, '竖版分组 split 溢出');
const kickers = portraitSplit.blocks.filter((block) => block.kind === 'kicker');
assert.equal(kickers.length, 2);
assert.equal(kickers[0].pane, 'left');
assert.equal(kickers[1].pane, 'right');
assert.ok(kickers[1].y >= kickers[0].y + kickers[0].h + 20, '两组要上下分开');
assert.ok(portraitSplit.rule && portraitSplit.rule.w > portraitSplit.rule.h, '竖版分隔是横条');
assert.ok(portraitSplit.rule.y > kickers[0].y && portraitSplit.rule.y < kickers[1].y);
const leftCards = portraitSplit.blocks.filter((block) => block.pane === 'left' && block.kind === 'card');
const rightCards = portraitSplit.blocks.filter((block) => block.pane === 'right' && block.kind === 'card');
assert.equal(leftCards.length, 3);
assert.equal(rightCards.length, 3);
assert.ok(rightCards[0].y >= leftCards[leftCards.length - 1].y + leftCards[leftCards.length - 1].h);
for (let i = 0; i < portraitSplit.blocks.length; i++) {
  for (let j = i + 1; j < portraitSplit.blocks.length; j++) {
    assert.equal(hits(portraitSplit.blocks[i], portraitSplit.blocks[j]), false);
  }
}

const landSplit = layoutBlocks({
  layout: 'split',
  count: 6,
  chars: [2, 4, 4, 2, 4, 4],
  safe: wide.safe,
  floor: wide.floor,
  maxRow: wide.maxRow,
  portrait: false,
  sides: [
    {labelChars: 2, itemChars: [4, 4]},
    {labelChars: 2, itemChars: [4, 4]},
  ],
});
assert.equal(landSplit.overflow, false, '横版分组 split 溢出');
assert.ok(landSplit.blocks[0].pane === 'left' && landSplit.blocks.at(-1).pane === 'right');
assert.ok(landSplit.blocks.at(-1).x > landSplit.blocks[0].x + landSplit.blocks[0].w);
assert.ok(landSplit.rule && landSplit.rule.h > landSplit.rule.w, '横版分隔是竖条');

const media = layoutBlocks({
  layout: 'media',
  count: 3,
  chars: [6, 4, 4],
  safe: wide.safe,
  floor: wide.floor,
  maxRow: wide.maxRow,
  portrait: false,
});
const image = media.blocks.find((block) => block.kind === 'evidence');
assert.ok(image);
assert.ok(Math.abs(image.w / wide.safe.w - 0.62) < 0.03, `图宽比 ${image.w / wide.safe.w}`);
assert.ok(image.h >= wide.floor.body * 2);
const title = media.blocks.find((block) => block.kind === 'card');
assert.ok(title && title.x >= image.x + image.w);

const board = layoutBlocks({
  layout: 'board',
  count: 4,
  chars: [8, 8, 2, 8],
  bands: ['kicker', 'title', 'evidence', 'caption'],
  safe: wide.safe,
  floor: wide.floor,
  maxRow: wide.maxRow,
  portrait: false,
});
const evidence = board.blocks.find((block) => block.kind === 'evidence');
assert.ok(evidence.h / wide.safe.h >= 0.45, `资讯板证据高比 ${evidence.h / wide.safe.h}`);

const cap = captionBox(wide);
assert.equal(cap.x, 260);
assert.equal(cap.y, 900);
assert.equal(cap.w, 1280);
assert.equal(cap.h, 116);
assert.ok(cap.y >= wide.safe.y + wide.safe.h - 1, '横版字幕在内容框下面');
assert.ok(cap.x + cap.w <= 1580);

const omitted = validateScene({
  product: 'promo',
  style: 'fresh-light',
  screens: [{role: 'claim', layout: 'hero', text: '一句主张', narration: '一句主张'}],
});
assert.equal(omitted.ok, true, formatReport(omitted));
assert.equal(omitted.scene.aspect, '9:16');
assert.ok(omitted.applied.some((item) => item.where === 'aspect' && item.to === '9:16'));

const lessonDefault = validateScene({
  product: 'lesson',
  style: 'lecture',
  screens: [{role: 'claim', layout: 'hero', text: '先看全貌', narration: '先看全貌'}],
});
assert.equal(lessonDefault.ok, true, formatReport(lessonDefault));
assert.equal(lessonDefault.scene.aspect, '16:9');

const withPresenter = validateScene({
  product: 'lesson',
  style: 'lecture',
  domain: 'tech',
  presenter: {kind: 'cartoon', look: {preset: 'peep-mentor'}},
  screens: [{role: 'claim', layout: 'hero', text: '先看全貌', narration: '先看全貌'}],
});
assert.equal(withPresenter.ok, true, formatReport(withPresenter));
assert.equal(withPresenter.scene.presenter.kind, 'cartoon');

const noneKind = validateScene({
  product: 'lesson',
  style: 'paper',
  presenter: {kind: 'none'},
  screens: [{role: 'claim', layout: 'hero', text: '先看全貌', narration: '先看全貌'}],
});
assert.equal(noneKind.ok, true, formatReport(noneKind));

const promoPresenter = validateScene({
  product: 'promo',
  aspect: '9:16',
  style: 'fresh-light',
  presenter: {kind: 'cartoon'},
  screens: [{role: 'claim', layout: 'hero', text: '一句', narration: '一句'}],
});
assert.equal(promoPresenter.ok, false);
assert.ok(promoPresenter.errors.some((item) => item.where === 'presenter'));

const remote = validateScene({
  product: 'lesson',
  style: 'lecture',
  presenter: {kind: 'real', src: 'https://example.com/a.mp4'},
  screens: [{role: 'claim', layout: 'hero', text: '一句', narration: '一句'}],
});
assert.equal(remote.ok, false);
assert.ok(remote.errors.some((item) => item.where === 'presenter.src'));

const legal = validateScene({
  product: 'lesson',
  style: 'lecture',
  domain: 'legal',
  presenter: {kind: 'none'},
  screens: [{role: 'claim', layout: 'hero', text: '借款要写清', narration: '借款要写清'}],
});
assert.equal(legal.ok, true, formatReport(legal));
assert.equal(legal.scene.domain, 'legal');

const token = loadStyle('lesson', 'lecture');
const lessonPlan = prepareScene({
  scene: withPresenter.scene,
  roles: token.roles,
  extra: token.extra,
  frame: sceneFrame('lesson', '16:9'),
});
assert.equal(lessonPlan.product, 'lesson');
assert.equal(lessonPlan.presenter.kind, 'cartoon');
assert.equal(lessonPlan.domain, 'tech');
assert.equal(lessonPlan.aspect, '16:9');

const cues = parseSrt('1\n00:00:01,500 --> 00:00:05,500\n做法分三步：先转写，再挑句子，最后出片\n');
const motion = validateMotionClip({
  id: 'b01',
  from: 'c1',
  to: 'c1',
  source: 'motion',
  mode: 'split',
  job: 'explain',
  template: 'scene',
  plain: '场景画面',
  slots: {title: '做法分三步', items: ['先转写', '再挑句子', '最后出片']},
}, cues, {durationMs: 7000, full: true});
assert.equal(motion.errors.length, 0, JSON.stringify(motion.errors));
assert.equal(motion.plan.data.screen.layout, 'stack');
assert.equal(motion.plan.data.screen.title, '做法分三步');
assert.equal(motion.plan.data.screen.items.length, 3);
assert.equal(motion.plan.template, 'scene');

const oldFive = validateMotionClip({
  id: 'b01',
  from: 'c1',
  to: 'c1',
  source: 'motion',
  mode: 'split',
  job: 'explain',
  template: 'steps',
  plain: '三步',
  slots: {items: ['先转写', '再挑句子', '最后出片']},
}, cues, {durationMs: 7000, full: true});
assert.equal(oldFive.errors.length, 0, JSON.stringify(oldFive.errors));
assert.equal(oldFive.plan.data.screen, undefined);

assert.equal(probeScale(1080, 1080), 1);
assert.equal(probeScale(1080, 540), 2);
assert.equal(probeScale(1920, 1920), 1, '横版按成片宽换算，不再折成 1080');
assert.equal(probeScale(1920, 960), 2);
assert.equal(probeScale(0, 1920), 1080 / 1920);
assert.equal(probeScale(1920, 0), 1);

console.log('t21 ok');
