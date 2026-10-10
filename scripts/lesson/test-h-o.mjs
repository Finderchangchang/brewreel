#!/usr/bin/env node
// 专业版 H–O：规格正反例、法条/品牌/虚构标签、版式分布、最长文案的横竖版心。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateLesson} from './validate-lesson.mjs';
import {revealTargetsFor} from './reveal-targets.mjs';
import {layoutMixIssues} from './style-rules.mjs';
import {CASE_LABEL} from '../../template/src/lesson/layout-guards.mjs';
import {LAYOUT_NAMES, MIN_BODY, contentFrame, insideContent, intersectsReserve, layoutContentBoxes} from '../../template/src/lesson/stage.mjs';
import {verticalContentBox, verticalLayoutContentBoxes, verticalPresenterBox} from './vertical-layout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const LOGO = 'examples/lesson/assets/mark.svg';
const lesson = (pages, meta = {}) => ({
  meta: {
    format: 'lesson', title: '借条利息', domain: 'legal', lang: 'zh',
    voice: {provider: 'mock', voiceId: 'mock-zh'},
    mascot: {id: 'counsel', enabled: true},
    sources: [
      '《中华人民共和国民法典》第六百八十条（自2021-01-01起施行）',
      '《中华人民共和国民法典》第六百七十四条（自2021-01-01起施行）',
    ],
    ...meta,
  },
  chapters: [{title: '利息', pages}],
});
const say = (text, reveal = 0) => ({text, reveal, pose: 'explain'});
const errors = (pages, meta) => validateLesson(lesson(pages, meta)).errors.join('\n');
const ok = (pages, meta) => {
  const result = validateLesson(lesson(pages, meta));
  assert.equal(result.ok, true, result.errors.join('\n'));
  return result;
};

const big = {
  layout: 'bignumber', title: '利息期限',
  number: '1', unit: '年', name: '届满就付息', basis: '《民法典》第六百七十四条',
  cardIcon: 'clock', cardText: '不满一年到期付', cardEmphasis: '到期付',
  axisFrom: '起算', axisTo: '满一年', axisSpan: '一年',
  narration: [say('数字', 0), say('依据', 1), say('说明', 2), say('轴', 3)],
};
ok([big]);
assert.deepEqual(revealTargetsFor(big), ['大数字与名称', '依据', '说明卡', '进度轴']);
assert.deepEqual(revealTargetsFor({...big, axisFrom: undefined, axisTo: undefined, axisSpan: undefined}), ['大数字与名称', '依据', '说明卡']);
assert.match(errors([{...big, number: '12345'}]), /number/);
assert.match(errors([{...big, basis: '司法解释第二十五条'}]), /basis/);
assert.match(errors([{...big, basis: '《民法典》第一百八十八条'}]), /白名单/);
assert.match(errors([{...big, axisTo: undefined}]), /axisTo/);

const saying = {
  layout: 'saying', title: '律师说',
  lines: ['借钱先把借条写清', '别把证据交给运气'], emphasis: '交给运气',
  name: '陈思远', org: '衡川律师', logo: LOGO,
  narration: [say('观点在左边', 0), say('署名在下面', 1)],
};
const said = ok([saying]);
assert.match(said.lesson.chapters[0].pages[0].logoData, /^data:image\/svg\+xml;base64,/);
assert.equal(saying.logoData, undefined);
assert.deepEqual(revealTargetsFor(saying), ['引号与观点', '署名']);
ok([{...saying, logo: undefined, lines: ['看民法典里的约定', '别把证据交给运气']}]);
assert.match(errors([{...saying, lines: ['看第六百八十条', '别把证据交给运气']}]), /法条/);
assert.match(errors([{...saying, narration: [say('《合同法》这么写', 0), say('署名', 1)]}]), /法条/);
assert.match(errors([{...saying, logo: 'examples/lesson/assets/missing.svg'}]), /logo/);

const levels = {
  layout: 'levels', title: '凭证分档',
  items: [
    {tone: 'high', label: '高风险', icon: 'warning', text: '只有聊天没有借条'},
    {tone: 'mid', label: '中风险', icon: 'document', text: '有借条但现金交付'},
    {tone: 'low', label: '低风险', icon: 'card', text: '借条加转账备注'},
  ],
  narration: [say('高', 0), say('中', 1), say('低', 2)],
};
ok([levels]);
assert.deepEqual(revealTargetsFor(levels), ['第 1 档', '第 2 档', '第 3 档']);
assert.match(errors([{...levels, items: levels.items.map((item, i) => i === 1 ? {...item, tone: 'red'} : item)}]), /tone/);

const casePage = {
  layout: 'case', title: '钱转了借条呢',
  roles: [
    {name: '小李', role: '借款人', look: 'peep-mentor', pose: 'explain'},
    {name: '老王', role: '出借人', look: 'peep-teacher', pose: 'wave'},
  ],
  lines: [
    {who: 0, text: '先借我一笔周转'},
    {who: 1, text: '转过去了'},
    {who: 0, text: '借条回头补'},
  ],
  payLabel: '转账', payAmount: '伍万',
  verdictIcon: 'warning', verdictLabel: '风险', verdictText: '没有借条，合意难证明', verdictEmphasis: '合意',
  narration: [say('开口', 0), say('转出', 1), say('补写', 2), say('结论', 3)],
};
ok([casePage]);
assert.deepEqual(revealTargetsFor(casePage), ['第 1 句', '第 2 句', '第 3 句', '结论']);
assert.match(errors([{...casePage, caseLabel: '真实案例'}]), /人物均为虚构/);
ok([{...casePage, caseLabel: CASE_LABEL}]);
assert.match(errors([{...casePage, roles: [{...casePage.roles[0]}, {...casePage.roles[0], name: '老王'}]}]), /不能相同/);
assert.match(errors([{...casePage, roles: [casePage.roles[0], {...casePage.roles[1], look: 'peep-counsel'}]}]), /讲解员/);
assert.match(errors([{...casePage, lines: [{who: 0, text: '先借'}, {who: 0, text: '再借'}]}]), /交替/);

const doc = {
  layout: 'document', title: '看备注这一行', kind: 'transfer',
  screenTitle: '转账详情', status: '交易成功', amount: '伍万整',
  rows: [{name: '收款人', value: '小李'}, {name: '转账日', value: '三月一日'}, {name: '备注', value: '借款'}],
  highlight: 3, point: '备注要写明是借款', emphasis: '是借款',
  narration: [say('先看整页', 0), say('红框在备注', 1), say('用途要写上', 2)],
};
ok([doc]);
assert.deepEqual(revealTargetsFor(doc), ['示意图', '高亮与放大', '关键句']);
ok([{...doc, kind: 'chat', amount: undefined, screenTitle: '对话', status: undefined, rows: [...doc.rows, {name: '下一条', value: '回头补借条'}]}]);
assert.match(errors([{...doc, kind: 'chat', amount: '伍万整'}]), /amount/);
assert.match(errors([{...doc, rows: [{name: '渠道', value: '支付宝'}, ...doc.rows.slice(1)]}]), /品牌/);
assert.match(errors([{...doc, narration: [say('打开微信支付看备注', 0), say('红框', 1), say('用途', 2)]}]), /品牌/);
assert.match(errors([{...doc, highlight: 9}]), /highlight/);

const table = {
  layout: 'table', title: '利息三种情形',
  rows: [
    {situation: '借条没约定利息', result: '视为没有利息', emphasis: '没有利息'},
    {situation: '约定不清楚', result: '同样没有利息', emphasis: '没有利息'},
    {situation: '利率已经写明', result: '按约定付息', emphasis: '约定'},
  ],
  basis: '《民法典》第六百八十条',
  narration: [say('开头这行', 0), say('中间这行', 1), say('最后这行', 2)],
};
ok([table]);
assert.deepEqual(revealTargetsFor(table), ['第 1 行', '第 2 行', '第 3 行']);
assert.match(errors([{...table, basis: '《民法典》第一百八十八条'}]), /白名单/);
assert.equal(ok([{...table, rows: table.rows.map((row) => ({...row, emphasis: '不在结果里'}))}]).ok, true);

ok([{layout: 'chapter', title: '凭证', kicker: '凭证', subtitle: '转账和原件', narration: [say('换一章')]}]);
ok([{
  layout: 'chapter', title: '凭证', subtitle: '转账和原件',
  points: [{icon: 'card', text: '转账备注'}, {icon: 'chat', text: '聊天记录'}, {icon: 'document', text: '借条原件'}],
  narration: [say('三个要点')],
}]);
assert.match(errors([{layout: 'chapter', title: '凭证', points: [{icon: 'card', text: '转账备注'}], narration: [say('太少')]}]), /points/);
assert.match(errors([{layout: 'chapter', title: '凭证', points: [{icon: 'nope', text: '转账备注'}, {icon: 'chat', text: '聊天记录'}], narration: [say('坏图标')]}]), /icon/);

ok([{
  layout: 'question', title: '没写利息还能要吗', question: '没写利息还能要吗',
  options: ['按银行利率', '视为没有利息', '双方再商量'], answer: 1, answerText: '约定不明同样没有',
  narration: [say('题目在上面', 0), say('先想一想。', 0), say('中间这项对', 1)],
}]);
ok([{
  layout: 'question', title: '开放题', question: '你会先看哪一行', openQuestion: true, answerText: '先看备注那一行',
  narration: [say('自己想', 0), say('先想一想。', 0), say('再听解释', 1)],
}]);
ok([{layout: 'recap', title: '记住', items: ['没写就没有利息', '转账备注写借款', '借条原件留着'], narration: [say('利息', 0), say('备注', 1), say('原件', 2)]}]);

const run = (layouts) => ({chapters: [{title: '甲', pages: layouts.map((layout) => ({layout}))}]});
assert.match(layoutMixIssues(run(['steps', 'steps', 'steps'])).join('\n'), /连续不超过 2 页/);
assert.equal(layoutMixIssues(run(['steps', 'steps', 'quote'])).length, 0);
const few = layoutMixIssues(run(['steps', 'quote', 'steps', 'quote', 'steps', 'quote', 'steps', 'quote']));
assert.match(few.join('\n'), /至少用 5 种/);
assert.equal(layoutMixIssues(run(['cover', 'quote', 'points', 'statement', 'compare', 'flow', 'timeline', 'checklist'])).length, 0);
const mixed = validateLesson(lesson([
  {layout: 'steps', title: '一', items: ['写借条', '留凭证'], narration: [say('一', 0), say('二', 1)]},
  {layout: 'steps', title: '二', items: ['写借条', '留凭证'], narration: [say('一', 0), say('二', 1)]},
  {layout: 'steps', title: '三', items: ['写借条', '留凭证'], narration: [say('一', 0), say('二', 1)]},
]));
assert.equal(mixed.ok, true, mixed.errors.join('\n'));
assert.match(mixed.warnings.join('\n'), /版式分布：/);
assert.match(mixed.warnings.join('\n'), /改成别的版式/);

const overlaps = (a, b) => {
  if (!a || !b) return false;
  const aw = a.w ?? a.width; const ah = a.h ?? a.height; const bw = b.w ?? b.width; const bh = b.h ?? b.height;
  return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y;
};
const insideFrame = (box, frame) => {
  const w = box.w ?? box.width; const h = box.h ?? box.height;
  const fw = frame.width ?? frame.w; const fh = frame.height ?? frame.h;
  return box.x >= frame.x - 0.01 && box.y >= frame.y - 0.01 && box.x + w <= frame.x + fw + 0.01 && box.y + h <= frame.y + fh + 0.01;
};
for (const layout of ['bignumber', 'question', 'saying', 'levels', 'case', 'document', 'table', 'chapter', 'recap']) {
  assert.ok(LAYOUT_NAMES.includes(layout), layout);
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
  const presenter = verticalPresenterBox('cartoon', {layout});
  left = Infinity; right = 0; top = Infinity; bottom = 0;
  for (const box of verticalLayoutContentBoxes(layout)) {
    assert.equal(insideFrame(box, vFrame), true, `${layout} 竖版越界 ${JSON.stringify(box)}`);
    assert.equal(overlaps(box, presenter), false, `${layout} 竖版碰到讲解员`);
    assert.ok(box.fontPx >= MIN_BODY, `${layout} 竖版字号 ${box.fontPx}`);
    left = Math.min(left, box.x); right = Math.max(right, box.x + box.w);
    top = Math.min(top, box.y); bottom = Math.max(bottom, box.y + box.h);
  }
  assert.ok(right - left >= vFrame.width * 0.85, `${layout} 竖版没撑满宽度`);
  assert.ok(bottom - top >= vFrame.height * 0.65, `${layout} 竖版没撑满高度`);
}
assert.equal(layoutContentBoxes('bignumber')[0].fontPx, 380);

const component = readFileSync(path.join(ROOT, 'template/src/lesson/layouts/CaseStudy.tsx'), 'utf8');
assert.match(component, /CASE_LABEL/);
assert.equal(CASE_LABEL, '案例 · 人物均为虚构');

const gallery = JSON.parse(readFileSync(path.join(ROOT, 'examples/lesson/gallery-h-o.json'), 'utf8'));
const checked = validateLesson(gallery);
assert.equal(checked.ok, true, checked.errors.join('\n'));
assert.equal(checked.warnings.filter((line) => line.includes('版式分布')).length, 0, checked.warnings.join('\n'));
assert.equal(gallery.chapters.length >= 2, true);
const layouts = gallery.chapters.flatMap((chapter) => chapter.pages.map((page) => page.layout));
for (const name of ['bignumber', 'question', 'saying', 'levels', 'case', 'document', 'table', 'chapter', 'recap']) {
  assert.ok(layouts.includes(name), name);
}
const old = validateLesson(JSON.parse(readFileSync(path.join(ROOT, 'examples/lesson/layouts-gallery.json'), 'utf8')));
assert.equal(old.ok, true, old.errors.join('\n'));

console.log('test-h-o：H–O 正反例、禁法条/品牌/虚构标签、版式分布、横竖版心、旧稿与 gallery-h-o');
