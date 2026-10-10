#!/usr/bin/env node
// 专业版 A–G：规格正反例、揭示顺序、最长文案的横竖版心。
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateLesson} from './validate-lesson.mjs';
import {revealTargetsFor} from './reveal-targets.mjs';
import {cardEchoWarnings} from './card-echo.mjs';
import {LAYOUT_NAMES, MIN_BODY, contentFrame, insideContent, intersectsReserve, layoutContentBoxes} from '../../template/src/lesson/stage.mjs';
import {verticalContentBox, verticalLayoutContentBoxes, verticalPresenterBox} from './vertical-layout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = '《中华人民共和国民法典》第六百八十条（自2021-01-01起施行）';
const Q680 = '借款合同对支付利息没有约定的，视为没有利息。';
const Q675 = '借款人应当按照约定的期限返还借款。';

const lesson = (pages, meta = {}) => ({
  meta: {
    format: 'lesson', title: '借条利息', domain: 'legal', lang: 'zh',
    voice: {provider: 'mock', voiceId: 'mock-zh'},
    sources: [SRC, '《中华人民共和国民法典》第六百七十五条（自2021-01-01起施行）'],
    ...meta,
  },
  chapters: [{title: '借条里的利息', pages}],
});
const say = (text, reveal = 0) => ({text, reveal, pose: 'explain'});
const errors = (pages) => validateLesson(lesson(pages)).errors.join('\n');
const ok = (pages) => {
  const result = validateLesson(lesson(pages));
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.errors.some((line) => line.includes('legal-quote-corpus')), false);
  return result;
};

ok([{
  layout: 'quote', title: '没写利息', quote: Q680,
  source: '《民法典》第六百八十条（2021-01-01）', emphasis: '视为没有利息',
  tag: '自然人之间', tagText: '约定不明也按没有',
  narration: [say('看原文', 0), say('看条号', 1), say('看红字', 2)],
}]);
assert.match(errors([{
  layout: 'quote', title: '没写利息', quote: Q680,
  source: '《民法典》第六百八十条（2021-01-01）',
  narration: [say('看原文', 0), say('多了一段', 2)],
}]), /reveal/);
assert.match(errors([{
  layout: 'quote', title: '没写利息', quote: Q680,
  source: '《民法典》第六百八十条（2021-01-01）', tag: '超过六个字啦呀',
  narration: [say('看原文', 0)],
}]), /tag/);

ok([{
  layout: 'points', title: '三件事',
  items: [
    {icon: 'percent', title: '利息', text: '没写就没有'},
    {icon: 'card', title: '交付', text: '银行转账'},
  ],
  narration: [say('利息', 0), say('交付', 1)],
}]);
assert.match(errors([{
  layout: 'points', title: '三件事',
  items: [{icon: 'nope', title: '利息', text: '没写就没有'}, {icon: 'card', title: '交付', text: '银行转账'}],
  narration: [say('利息', 0)],
}]), /icon/);
assert.match(errors([{
  layout: 'points', title: '三件事',
  items: [{icon: 'percent', title: '利息太长了吧', text: '没写就没有'}],
  narration: [say('利息', 0)],
}]), /items/);

ok([{
  layout: 'statement', title: '空着',
  lines: ['利息这一栏', '就是没有'], alertLast: true,
  basis: '《民法典》第六百八十条', prop: 'iou', propTitle: '借条',
  propLines: ['今借到李华', '利息一栏空白'], circle: 2, annotation: '空着即无利息',
  narration: [say('结论', 0), say('依据', 1), say('纸', 2)],
}]);
assert.match(errors([{
  layout: 'statement', title: '空着',
  lines: ['利息这一栏', '就是没有'], basis: '依据', prop: 'ticket', propTitle: '借条',
  propLines: ['今借到李华', '利息一栏空白'], circle: 9, annotation: '空着即无利息',
  narration: [say('结论', 0)],
}]), /prop|circle/);

ok([{
  layout: 'compare', title: '对比',
  leftTitle: '写了', left: ['利率已写明', '双方签字'], leftVerdict: '按约定算', leftTone: 'ok',
  rightTitle: '没写', right: ['利息留空', '没有补约'], rightVerdict: '视为没有', rightTone: 'alert',
  narration: [say('左边', 0), say('右边', 1)],
}]);
assert.match(errors([{
  layout: 'compare', title: '对比',
  leftTitle: '写了', left: ['利率已写明', '双方签字'], leftTone: 'good',
  rightTitle: '没写', right: ['利息留空', '没有补约'],
  narration: [say('左边', 0)],
}]), /leftTone/);
ok([{
  layout: 'compare', title: '旧对比',
  leftTitle: '甲', left: ['一条', '二条'],
  rightTitle: '乙', right: ['三条', '四条'],
  narration: [say('左边', 0), say('右边', 1)],
}]);

ok([{
  layout: 'flow', title: '旧流程',
  steps: ['写借条', '去银行', '留凭证'],
  narration: [say('一', 0), say('二', 1), say('三', 2)],
}]);
ok([{
  layout: 'flow', title: '新流程',
  steps: [
    {icon: 'document', title: '写借条', points: ['金额', '利率']},
    {title: '银行转账'},
    {icon: 'chat', title: '到期催收', points: ['发消息']},
  ],
  narration: [say('一', 0), say('二', 1), say('三', 2)],
}]);
assert.match(errors([{
  layout: 'flow', title: '坏图标',
  steps: [{icon: 'rocket', title: '写借条'}, {title: '银行转账'}, {title: '留凭证'}],
  narration: [say('一', 0)],
}]), /icon/);

const timelinePage = {
  layout: 'timeline', title: '期限',
  nodes: [{label: '到期日'}, {label: '应还日'}],
  segments: [{label: '期限内', tone: 'accent'}],
  captions: [{icon: 'bank', text: '按期归还'}],
  quote: Q675,
  source: '《民法典》第六百七十五条（2021-01-01）',
  emphasis: '约定的期限',
  narration: [say('节点', 0), say('下一段', 1), say('原文', 2)],
};
ok([timelinePage]);
const fakeLaw = validateLesson(lesson([{...timelinePage, quote: '这不是白名单里的句子。', emphasis: undefined}]));
assert.equal(fakeLaw.ok, false);
assert.ok(fakeLaw.errors.some((line) => line.includes('legal-quote-corpus')));
assert.match(errors([{
  layout: 'timeline', title: '期限',
  nodes: [{label: '到期日'}, {label: '应还日'}],
  segments: [{label: '太长的区段标注', tone: 'weird'}],
  narration: [say('节点', 0)],
}]), /tone|区段/);

ok([{
  layout: 'checklist', title: '自查',
  items: ['身份', '金额', '利率', '日期'],
  narration: [say('一', 0), say('二', 1), say('三', 2), say('四', 3)],
}]);
assert.match(errors([{
  layout: 'checklist', title: '自查',
  items: ['只有', '三项', '不够'],
  narration: [say('一', 0)],
}]), /items/);

const quotePlain = {layout: 'quote', quote: Q680, source: '出处', fields: undefined};
assert.deepEqual(revealTargetsFor({layout: 'quote', quote: Q680, source: '出处'}), ['原文及随原文绘出的强调线', '出处']);
assert.deepEqual(revealTargetsFor({layout: 'quote', tag: '自然人之间', tagText: '约定不明'}), ['原文及随原文绘出的强调线', '出处', '底部关键句']);
assert.deepEqual(revealTargetsFor({layout: 'points', items: [{}, {}, {}]}), ['第 1 张', '第 2 张', '第 3 张']);
assert.deepEqual(revealTargetsFor({layout: 'flow', steps: [{}, {}, {}, {}]}), ['第 1 步', '第 2 步', '第 3 步', '第 4 步']);
assert.deepEqual(revealTargetsFor({layout: 'statement'}), ['左侧大字', '依据', '道具纸']);
assert.deepEqual(revealTargetsFor({layout: 'checklist', items: ['a', 'b', 'c', 'd', 'e', 'f']}), ['第 1 项', '第 2 项', '第 3 项', '第 4 项', '第 5 项', '第 6 项']);
const timelineTargets = revealTargetsFor({layout: 'timeline', nodes: [{}, {}, {}], quote: Q675});
assert.deepEqual(timelineTargets, ['第 1 个节点', '第 2 个节点', '第 3 个节点', '法条卡']);
assert.equal(timelineTargets.at(-1), '法条卡');
assert.deepEqual(revealTargetsFor({layout: 'timeline', nodes: [{}, {}]}), ['第 1 个节点', '第 2 个节点']);
assert.equal(quotePlain.layout, 'quote');

const overlaps = (a, b) => {
  if (!a || !b) return false;
  const aw = a.w ?? a.width;
  const ah = a.h ?? a.height;
  const bw = b.w ?? b.width;
  const bh = b.h ?? b.height;
  return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y;
};
const insideFrame = (box, frame) => {
  const w = box.w ?? box.width;
  const h = box.h ?? box.height;
  const fw = frame.width ?? frame.w;
  const fh = frame.height ?? frame.h;
  return box.x >= frame.x - 0.01 && box.y >= frame.y - 0.01 && box.x + w <= frame.x + fw + 0.01 && box.y + h <= frame.y + fh + 0.01;
};

for (const layout of LAYOUT_NAMES) {
  const frame = contentFrame(layout);
  const boxes = layoutContentBoxes(layout);
  let left = Infinity; let right = 0; let top = Infinity; let bottom = 0;
  for (const box of boxes) {
    if (box.bleed) assert.equal(intersectsReserve(box), false, `${layout} 横版出血盒碰到讲解员`);
    else {
      assert.equal(insideContent(box), true, `${layout} 横版越界 ${JSON.stringify(box)}`);
      assert.equal(intersectsReserve(box), false, `${layout} 横版碰到讲解员`);
    }
    assert.ok(box.fontPx >= MIN_BODY, `${layout} 横版字号 ${box.fontPx}`);
    left = Math.min(left, box.x); right = Math.max(right, box.x + box.w);
    top = Math.min(top, box.y); bottom = Math.max(bottom, box.y + box.h);
  }
  assert.ok(right - left >= frame.width * 0.85, `${layout} 横版没撑满宽度`);
  assert.ok(bottom - top >= frame.height * 0.65, `${layout} 横版没撑满高度`);

  const vFrame = verticalContentBox(layout, 'cartoon');
  const vBoxes = verticalLayoutContentBoxes(layout);
  const presenter = verticalPresenterBox('cartoon', {layout});
  left = Infinity; right = 0; top = Infinity; bottom = 0;
  for (const box of vBoxes) {
    assert.equal(insideFrame(box, vFrame), true, `${layout} 竖版越出内容框 ${JSON.stringify(box)} frame ${JSON.stringify(vFrame)}`);
    assert.equal(overlaps(box, presenter), false, `${layout} 竖版碰到讲解员`);
    assert.ok(box.fontPx >= MIN_BODY, `${layout} 竖版字号 ${box.fontPx}`);
    left = Math.min(left, box.x); right = Math.max(right, box.x + box.w);
    top = Math.min(top, box.y); bottom = Math.max(bottom, box.y + box.h);
  }
  assert.ok(right - left >= vFrame.width * 0.85, `${layout} 竖版没撑满宽度`);
  assert.ok(bottom - top >= vFrame.height * 0.65, `${layout} 竖版没撑满高度`);
}

const exampleDir = path.resolve(HERE, '../../examples/lesson');
for (const name of readdirSync(exampleDir)) {
  if (!name.endsWith('.json')) continue;
  const data = JSON.parse(readFileSync(path.join(exampleDir, name), 'utf8'));
  if (data?.meta?.format !== 'lesson') continue;
  const result = validateLesson(data);
  assert.equal(result.ok, true, `${name}\n${result.errors.join('\n')}`);
}

const gallery = JSON.parse(readFileSync(path.join(exampleDir, 'gallery-a-g.json'), 'utf8'));
const checked = validateLesson(gallery);
assert.equal(checked.ok, true, checked.errors.join('\n'));
assert.equal(checked.errors.filter((line) => line.includes('legal-quote-corpus')).length, 0);
assert.deepEqual(gallery.chapters[0].pages.map((page) => page.layout).filter((name) => ['quote', 'points', 'statement', 'compare', 'flow', 'timeline', 'checklist'].includes(name)).length, 7);
assert.equal(cardEchoWarnings(gallery).length, 0, cardEchoWarnings(gallery).join('\n'));

console.log('test-pro-layouts：A–G 正反例、揭示顺序、横竖版心、旧稿与 gallery-a-g');
