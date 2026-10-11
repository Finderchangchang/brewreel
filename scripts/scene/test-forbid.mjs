#!/usr/bin/env node
// 禁止组合表每一行一条输入：拒绝或改写，报告里有原因。
import assert from 'node:assert/strict';
import {REASONS, formatReport, validateScene} from './validate-scene.mjs';

const base = {product: 'promo', aspect: '9:16', style: 'fresh-light', motion: 'bounce', screens: []};

function screen(over) {
  return {narration: '一句旁白', ...over};
}

function run(scene) {
  const result = validateScene(scene);
  const report = formatReport(result);
  return {result, report};
}

function reasonOf(result) {
  return [...result.errors, ...result.rewrites].map((item) => item.reason).filter(Boolean);
}

{
  const {result, report} = run({...base, product: 'lesson', style: 'editorial', motion: 'bounce', screens: [screen({role: 'claim', layout: 'hero', text: '一句'})]});
  assert.equal(result.ok, false);
  assert.ok(reasonOf(result).includes(REASONS.editorialBounce));
  assert.ok(report.includes(REASONS.editorialBounce));
  assert.ok(report.includes('怎么改'));
}

{
  const {result, report} = run({...base, style: 'tech-dark', motion: 'paper', screens: [screen({role: 'claim', layout: 'hero', text: '一句'})]});
  assert.equal(result.ok, false);
  assert.ok(reasonOf(result).includes(REASONS.techDarkPaper));
  assert.ok(report.includes('材料对不上'));
}

{
  const {result, report} = run({...base, style: 'fresh-light', motion: 'paper', screens: [screen({role: 'claim', layout: 'hero', text: '一句'})]});
  assert.equal(result.ok, false);
  assert.ok(reasonOf(result).includes(REASONS.gradientPaper));
  assert.ok(report.includes('渐变'));
}

{
  const facts = [{id: 'f', text: '大约 3 分钟', source: '说明'}];
  const number = {text: '3 分钟', fact: 'f', label: '耗时'};
  for (const layout of ['grid', 'split']) {
    const {result, report} = run({...base, facts, screens: [screen({role: 'number', layout, number})]});
    assert.equal(result.ok, true, layout);
    assert.equal(result.rewrites[0].to, 'hero');
    assert.equal(result.rewrites[0].reason, REASONS.numberSplit);
    assert.equal(result.scene.screens[0].layout, 'hero');
    assert.ok(report.includes(REASONS.numberSplit));
  }
}

{
  const {result} = run({
    ...base,
    screens: [screen({
      role: 'compare',
      layout: 'hero',
      left: {label: '以前', items: ['翻记录']},
      right: {label: '现在', items: ['自动汇总']},
      winner: 'right',
    })],
  });
  assert.equal(result.ok, true);
  assert.equal(result.rewrites[0].to, 'split');
  assert.equal(result.rewrites[0].reason, REASONS.compareHero);
}

{
  const items = ['读懂语气', '给出回复', '不替你发', '留下记录', '下次还能看', '你来决定'].map((text) => ({text}));
  for (const layout of ['hero', 'grid']) {
    const {result, report} = run({...base, screens: [screen({role: 'points', layout, items})]});
    assert.equal(result.ok, true, layout);
    assert.equal(result.scene.screens[0].layout, 'stack');
    assert.equal(result.rewrites[0].reason, REASONS.tooMany);
    assert.ok(report.includes('grid 上限 4'));
  }
}

{
  const {result, report} = run({
    ...base,
    facts: [{id: 'p', text: '会员 29 元', source: '价目'}],
    screens: [screen({role: 'number', layout: 'hero', number: {text: '29 元', fact: 'p', label: '会员'}, count: 'roll'})],
  });
  assert.equal(result.ok, true);
  assert.equal(result.scene.screens[0].count, 'flip');
  assert.equal(result.scene.screens[0].showComputedDelta, false);
  assert.equal(result.rewrites[0].reason, REASONS.moneyRoll);
  assert.ok(report.includes('中间价'));
}

{
  const {result, report} = run({...base, screens: [screen({role: 'claim', layout: 'hero', text: '一句', verbs: ['stamp']})]});
  assert.equal(result.ok, false);
  assert.ok(reasonOf(result).includes(REASONS.quizVerb));
  assert.ok(report.includes('semantic'));
}

{
  const {result, report} = run({...base, screens: [screen({role: 'points', layout: 'stack', scene: 'district', items: [{text: '一站'}]})]});
  assert.equal(result.ok, false);
  assert.ok(reasonOf(result).includes(REASONS.journey));
  assert.ok(report.includes('一镜到底'));
}

{
  const {result} = run({...base, motion: 'crisp', screens: [screen({role: 'claim', layout: 'hero', text: '一句'})]});
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((item) => item.where === 'motion'));
}

{
  const page = screen({role: 'claim', layout: 'hero', text: '一句'});
  const {result} = run({...base, screens: [page, {...page}, {...page}]});
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((item) => item.problem.includes('连续 3 屏')));
  assert.ok(result.warnings.some((item) => item.problem.includes('不超过 2 屏')));
}

{
  const page = screen({role: 'claim', layout: 'hero', text: '一句'});
  const other = screen({role: 'points', layout: 'grid', items: [{text: '一条'}]});
  const {result} = run({...base, screens: [page, {...page}, other]});
  assert.equal(result.ok, true);
  assert.equal(result.warnings.some((item) => item.problem.includes('连续')), false);
}

{
  const page = screen({role: 'claim', layout: 'hero', text: '一句'});
  const {result} = run({...base, screens: [page, {...page}, {...page}, {...page}]});
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((item) => item.problem.includes('至少用 3 种')));
}

{
  const facts = [{id: 'f1', text: '一份补充协议人工对照平均要 25 分钟。', source: '记录'}];
  const long = run({...base, facts, screens: [screen({role: 'number', layout: 'board', number: {text: '平均要 25 分钟', fact: 'f1', label: '人工对照'}})]});
  assert.equal(long.result.ok, false);
  assert.ok(long.result.errors.some((item) => item.where.endsWith('number.text')));
  const short = run({...base, facts, screens: [screen({role: 'number', layout: 'board', title: '还要一会儿', number: {text: '25 分钟', fact: 'f1', label: '人工对照'}})]});
  assert.equal(short.result.ok, true, short.report);
}

{
  const {result} = run({...base, screens: [screen({role: 'action', layout: 'end', brand: '示例', line: '把三个步骤全部接成一句再补一句判断'})]});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.where.endsWith('.line')));
}

{
  const {result} = run({product: 'quiz', aspect: '9:16', style: 'sage-pine', screens: [screen({role: 'claim', layout: 'hero', text: '一句'})]});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.where === 'product'));
}
