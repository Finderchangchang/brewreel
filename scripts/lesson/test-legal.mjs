import assert from 'node:assert/strict';
import fs from 'node:fs';
import {domainHooks, getDomainRules} from './packs/domain-hooks.mjs';

const rules = getDomainRules('legal');
assert.equal(rules.patterns.length, 8);
const page = (text, extra = {}) => ({layout:'steps',title:'测试',items:[text,'另一项'],narration:[{text}],...extra});
const lesson = (pages, meta = {}) => ({meta:{domain:'legal',sources:[],...meta},chapters:[{title:'章',pages}]});
const run = (data) => domainHooks.legal(data);
for (const rule of rules.patterns) {
  assert.ok(rule.source?.trim(), `${rule.id} has source`);
  const re = new RegExp(rule.regex, 'u');
  const positive = {
    'legal-promise':'胜诉率', 'legal-expert':'自称专家', 'legal-judicial-relation':'有关系', 'legal-rival':'贬低同行',
    'legal-extreme-words':'最专业', 'legal-flag-emblem':'国旗', 'legal-old-statutes':'《合同法》', 'legal-honor-date-body':'荣获奖项',
  }[rule.id];
  const negative = {
    'legal-promise':'介绍案件办理流程', 'legal-expert':'说明执业领域', 'legal-judicial-relation':'依法提交材料', 'legal-rival':'专注自身服务',
    'legal-extreme-words':'依法提供服务', 'legal-flag-emblem':'民法典条文', 'legal-old-statutes':'《中华人民共和国民法典》', 'legal-honor-date-body':'分享普法知识',
  }[rule.id];
  assert.ok(re.test(positive), `${rule.id} positive example`);
  assert.ok(!re.test(negative), `${rule.id} negative example`);
  const positiveResult = run(lesson([page(positive)]));
  const resultBucket = rule.level === 'block' ? positiveResult.block : rule.level === 'human' ? positiveResult.human : positiveResult.warn;
  assert.ok(resultBucket.some((x) => x.includes(rule.id)), `${rule.id} hook positive`);
  const negativeResult = run(lesson([page(negative)]));
  assert.equal([...negativeResult.block,...negativeResult.warn,...negativeResult.human].some((x) => x.includes(rule.id)), false, `${rule.id} hook negative`);
}

let result = run(lesson([page('自称专家保证胜诉') ]));
assert.ok(result.block.some((x) => /legal-expert/.test(x)));
assert.ok(result.block.some((x) => /legal-promise/.test(x)));
result = run(lesson([page('讲解《合同法》的历史沿革')], {allowHistorical:true}));
assert.ok(result.warn.some((x) => /legal-old-statutes/.test(x)));
assert.ok(!result.block.some((x) => /legal-old-statutes/.test(x)));
result = run(lesson([page('讲解《合同法》的历史沿革')]));
assert.ok(result.block.some((x) => /legal-old-statutes/.test(x)));
assert.ok(result.warn.some((x) => /荣誉/u.test(x)) === false);
result = run(lesson([page('荣获奖项') ]));
assert.ok(result.warn.some((x) => /legal-honor-date-body/.test(x)));
result = run(lesson([page('2025年获得海城市律师协会授予的优秀律师荣誉') ]));
assert.equal(result.warn.some((x) => /legal-honor-date-body/.test(x)), false);
result = run(lesson([page('自称专家，胜诉率百分之百，有法院关系，同行都不专业') ]));
for (const id of ['legal-expert','legal-promise','legal-judicial-relation','legal-rival']) assert.ok(result.block.some((x) => x.includes(id)), id);
for (const plain of ['依法介绍办理流程','普法知识分享','民法典第四百六十九条']) assert.equal(run(lesson([page(plain)])).block.some((x) => /legal-(expert|promise|judicial-relation|rival|old-statutes)/.test(x)), false, `negative ${plain}`);

const corpus = fs.readFileSync(new URL('./packs/legal/corpus/minfa-469-473.txt', import.meta.url), 'utf8');
const quote = '以电子数据交换、电子邮件等方式能够有形地表现所载内容，并可以随时调取查用的数据电文，视为书面形式。';
assert.ok(corpus.includes(quote));
const citation = '《中华人民共和国民法典》第四百六十九条，自2021-01-01起施行';
result = run(lesson([page('电子邮件规则', {quote,source:citation})]));
assert.equal(result.block.some((x) => /legal-quote-corpus/.test(x)), false);
result = run(lesson([page('电子邮件规则', {quote:quote.replace('随时','及时'),source:citation})]));
assert.ok(result.block.some((x) => /legal-quote-corpus/.test(x)));
result = run(lesson([page('电子邮件规则', {quote,source:'《中华人民共和国民法典》第四百六十九条'})]));
assert.ok(result.block.some((x) => /legal-quote-corpus/.test(x)));
result = run(lesson([page('这里可以查询，一般应当保存相关材料') ]));
assert.ok(result.warn.some((x) => /legal-conclusion-source/.test(x)));
result = run(lesson([page('这里可以查询，一般应当保存相关材料')], {sources:[citation]}));
assert.equal(result.warn.some((x) => /legal-conclusion-source/.test(x)), false);
result = run(lesson([page('案例中张某住在上海市静安区南京路88号，损失30000元') ]));
assert.ok(result.human.some((x) => /legal-case-privacy/.test(x)));
result = run(lesson([page('一般介绍法律条文与基础概念') ]));
assert.equal(result.human.some((x) => /legal-case-privacy/.test(x)), false);
assert.ok(rules.checks.every((rule) => rule.source?.trim()));
assert.equal(result.summary.articleCount, 19);
result = run(lesson([page('这套服务一步到位') ]));
assert.ok(result.warn.some((x) => /legal-shared-absolute-claims/.test(x)));
result = run(lesson([page('逐步介绍各项服务') ]));
assert.equal(result.warn.some((x) => /legal-shared-absolute-claims/.test(x)), false);
console.log('✓ legal patterns：8 条规则均有正反例，旧法 allowHistorical 降级、荣誉提示');
console.log('✓ legal corpus：逐字原文通过，改字/缺施行日期均 block');
console.log('✓ legal 结论出处 warn、案例隐私 human 与 clean 反例通过');
