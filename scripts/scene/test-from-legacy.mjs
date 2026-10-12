#!/usr/bin/env node
// 旧分镜转换器：各能转的镜头、不能转的停下、跳过、原文案、校验和几何。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {convertLegacy, geometryAudit, isTextHook, plainCopy} from './from-legacy.mjs';
import {validateScene} from './validate-scene.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function mustOk(result, label) {
  assert.equal(result.ok, true, `${label}: ${(result.errors || []).join('；')}`);
  const checked = validateScene(result.scene);
  assert.equal(checked.ok, true, `${label} validate: ${checked.errors.map((e) => e.problem).join('；')}`);
  const geo = geometryAudit(checked.scene);
  assert.equal(geo.ok, true, `${label} geom: ${(geo.lines || []).join('；')}`);
  return result.scene;
}

const promoBase = {
  meta: {
    product: '样例',
    theme: 'fresh-light',
    facts: [
      {id: 'f1', text: '整理一份周报大约 6 分钟', source: '样例口径'},
      {id: 'f2', text: '连续甩头 100 次两侧都没掉', source: '商家实测'},
    ],
  },
  shots: [],
};

function promo(shots) {
  return convertLegacy({...promoBase, shots});
}

const features = mustOk(promo([{
  type: 'features',
  caption: '看懂语气，\n{回复也帮你想好}',
  params: {
    items: [
      {icon: 'search', title: '读懂语气', desc: '看出对方话里的真实情绪'},
      {icon: 'chat', title: '给出回复', desc: '三条候选，挑一条就行'},
      {icon: 'shield', title: '不替你发', desc: '发不发永远由你决定'},
    ],
  },
}]), 'features');
assert.equal(features.screens[0].role, 'points');
assert.equal(features.screens[0].layout, 'grid');
assert.equal(features.screens[0].items[0].text, '读懂语气');
assert.equal(features.screens[0].items[0].note, '看出对方话里的真实情绪');
assert.equal(features.screens[0].narration, '看懂语气，回复也帮你想好');

const featuresStack = mustOk(promo([{
  type: 'features',
  caption: '三条竖排',
  params: {
    layout: 'stack',
    items: [
      {icon: 'doc', title: '第一项', desc: '说明一'},
      {icon: 'clock', title: '第二项', desc: '说明二'},
    ],
  },
}]), 'features-stack');
assert.equal(featuresStack.screens[0].layout, 'stack');

const steps = mustOk(promo([{
  type: 'steps',
  caption: '三步就上手',
  params: {
    items: [
      {title: '打开聊天', desc: '点进会话', icon: 'chat'},
      {title: '点悬浮球', desc: '弹出建议', icon: 'bolt'},
      {title: '挑一条填入', desc: '发不发你定', icon: 'check'},
    ],
  },
}]), 'steps');
assert.equal(steps.screens[0].layout, 'sequence');
assert.equal(steps.screens[0].items[1].text, '点悬浮球');

const quickList = mustOk(promo([{
  type: 'quickList',
  caption: '钱花哪了',
  params: {
    title: '本月去向不明',
    items: [
      {text: '外卖', tag: '¥860', icon: 'bell'},
      {text: '奶茶咖啡', tag: '¥326', icon: 'heart'},
      {text: '自动续费', tag: '¥98', icon: 'calendar'},
    ],
  },
}]), 'quickList');
assert.equal(quickList.screens[0].layout, 'stack');
assert.equal(quickList.screens[0].items[0].text, '外卖');
assert.equal(quickList.screens[0].items[0].note, '¥860');
assert.equal(quickList.screens[0].title, '本月去向不明');

const compare = mustOk(promo([{
  type: 'compare',
  caption: '别再靠毅力',
  params: {
    left: {title: '手动记账', items: ['每笔手动输入', '分类全靠猜'], tone: 'bad'},
    right: {title: '省心记账', items: ['拍小票识别', '自动分好类'], tone: 'good'},
    verdict: '记账不用再硬撑',
  },
}]), 'compare');
assert.equal(compare.screens[0].role, 'compare');
assert.equal(compare.screens[0].layout, 'split');
assert.equal(compare.screens[0].left.label, '手动记账');
assert.equal(compare.screens[0].right.items[1], '自动分好类');
assert.equal(compare.screens[0].winner, 'right');
assert.equal(compare.screens[0].title, '记账不用再硬撑');

const counter = mustOk(promo([{
  type: 'counter',
  caption: '几分钟就交',
  params: {from: 45, to: 6, suffix: '分钟', showFrom: true, label: '整理一份周报', refs: ['f1']},
}]), 'counter');
assert.equal(counter.screens[0].role, 'number');
assert.equal(counter.screens[0].number.text, '6 分钟');
assert.equal(counter.screens[0].number.fact, 'f1');
assert.equal(counter.screens[0].showComputedDelta, false);

const hook = mustOk(promo([{
  type: 'hook',
  caption: '汇报PPT改到崩溃？\n{先把框架搭对}',
  params: {visual: 'icon', icon: 'doc', text: '改到第9版还没定', badge: 'AI帮你搭框架'},
}]), 'hook-icon');
assert.equal(hook.screens[0].role, 'claim');
assert.equal(hook.screens[0].text, '汇报PPT改到崩溃？先把框架搭对');
assert.deepEqual(hook.screens[0].emphasis, ['先把框架搭对']);
assert.equal(hook.screens[0].support, 'AI帮你搭框架');
assert.equal(isTextHook({params: {visual: 'stat'}}), false);

const endCard = mustOk(promo([{
  type: 'endCard',
  params: {brand: '省心记账', slogan: '花出去的每一笔，\n{心里都有数}', cta: '课程页购买'},
}]), 'endCard');
assert.equal(endCard.screens[0].role, 'action');
assert.equal(endCard.screens[0].brand, '省心记账');
assert.equal(endCard.screens[0].line, '花出去的每一笔，心里都有数');
assert.equal(endCard.screens[0].cta, '课程页购买');

const blocked = convertLegacy({
  ...promoBase,
  shots: [
    {type: 'hook', caption: '月底又见底了', params: {visual: 'stat', text: '¥ 0.00'}},
    {type: 'quickList', caption: '钱花哪了', params: {items: [{text: '外卖'}, {text: '奶茶'}, {text: '打车'}]}},
    {type: 'mockApp', caption: '拍一下', params: {kind: 'editor', items: [{text: '午饭'}]}},
  ],
});
assert.equal(blocked.ok, false);
assert.ok(blocked.errors.some((line) => line.includes('hook') && line.includes('stat')));
assert.ok(blocked.errors.some((line) => line.includes('mockApp')));
assert.ok(blocked.errors[0].includes('--skip-unsupported'));

const skipped = convertLegacy({
  ...promoBase,
  shots: [
    {type: 'hook', caption: '月底又见底了', params: {visual: 'stat', text: '¥ 0.00'}},
    {type: 'quickList', caption: '钱花哪了', params: {items: [{text: '外卖'}, {text: '奶茶'}, {text: '打车'}]}},
    {type: 'endCard', params: {brand: '省心记账', slogan: '心里都有数'}},
  ],
}, {skipUnsupported: true});
mustOk(skipped, 'skip-unsupported');
assert.equal(skipped.scene.screens.length, 2);
assert.equal(skipped.unsupported.length, 1);

const lesson = mustOk(convertLegacy({
  meta: {format: 'lesson', domain: 'tech', facts: [{id: 'f1', text: '1年届满就付息', source: '《民法典》第六百七十四条'}]},
  chapters: [{
    title: '一',
    pages: [
      {
        layout: 'steps',
        title: '把提醒讲清楚',
        items: ['明确需要留意的条件', '停下来接住问题', '给出可以核实的依据'],
        narration: [{text: '先把条件说完。'}, {text: '再给出依据。'}],
      },
      {
        layout: 'points',
        title: '三件事',
        items: [
          {icon: 'percent', title: '利息', text: '没写就视为没有'},
          {icon: 'card', title: '交付', text: '银行转账并写上借款'},
          {icon: 'document', title: '凭证', text: '记录和原件都留下'},
        ],
        narration: [{text: '三张卡分开看。'}],
      },
      {
        layout: 'compare',
        title: '写没写利率',
        leftTitle: '写了利率',
        left: ['利率：已写明', '双方都签字'],
        leftTone: 'ok',
        rightTitle: '没写利息',
        right: ['利息：这一栏空', '没有另作约定'],
        rightTone: 'alert',
        narration: [{text: '左边按约定。'}],
      },
      {
        layout: 'bignumber',
        title: '届满一年怎么付息',
        number: '1',
        unit: '年',
        name: '届满就付息',
        basis: '《民法典》第六百七十四条',
        narration: [{text: '跨过一整年。'}],
      },
      {layout: 'cover', title: '封面不转'},
    ],
  }],
}, {skipUnsupported: true}), 'lesson');
assert.equal(lesson.product, 'lesson');
assert.equal(lesson.aspect, '16:9');
assert.equal(lesson.style, 'lecture');
assert.equal(lesson.motion, 'soft');
assert.equal(lesson.screens.length, 4);
assert.equal(lesson.screens[0].layout, 'sequence');
assert.equal(lesson.screens[0].items[0].text, '明确需要留意的条件');
assert.equal(lesson.screens[0].narration, '先把条件说完。再给出依据。');
assert.equal(lesson.screens[1].layout, 'grid');
assert.equal(lesson.screens[1].items[2].icon, 'doc');
assert.equal(lesson.screens[2].left.label, '写了利率');
assert.equal(lesson.screens[3].number.text, '1年');
assert.equal(lesson.screens[3].number.label, '届满就付息');
assert.equal(lesson.screens[3].showComputedDelta, false);

const coverOnly = convertLegacy({
  meta: {format: 'lesson'},
  pages: [{layout: 'cover', title: '封面'}],
});
assert.equal(coverOnly.ok, false);
assert.ok(coverOnly.errors.some((line) => line.includes('cover')));

assert.equal(plainCopy('花出去的每一笔，\n{心里都有数}'), '花出去的每一笔，心里都有数');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'from-legacy-'));
const src = path.join(tmp, 'in.json');
const dest = path.join(tmp, 'out.json');
fs.writeFileSync(src, JSON.stringify({
  ...promoBase,
  shots: [
    {type: 'quickList', caption: '钱花哪了', params: {items: [{text: '外卖'}, {text: '奶茶'}, {text: '打车'}]}},
    {type: 'mockApp', caption: '拍一下', params: {kind: 'editor'}},
  ],
}), 'utf8');
const stopped = spawnSync(process.execPath, ['scripts/scene/from-legacy.mjs', src, '--out', dest], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
assert.equal(stopped.status, 1);
assert.match(`${stopped.stdout}\n${stopped.stderr}`, /mockApp/);
assert.equal(fs.existsSync(dest), false);

const ran = spawnSync(process.execPath, ['scripts/scene/from-legacy.mjs', src, '--out', dest, '--skip-unsupported'], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
assert.equal(ran.status, 0, ran.stderr);
assert.equal(JSON.parse(fs.readFileSync(dest, 'utf8')).screens.length, 1);

console.log('from-legacy ok');
