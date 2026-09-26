#!/usr/bin/env node
// ============================================================
// 一键跑 tests/validate/ 下的正反用例，汇总结果。
//   node scripts/test-validate.mjs
// 每条用例：给一个 storyboard 片段（tests/validate/<file>），断言 errors/warnings 里
// 「有/没有」一条 problem 包含某个关键词（不要求整份 storyboard 干净通过——大多数最小片段
// 本身还会因为别的不相关规则报别的错，用关键词匹配只盯这条用例要测的那条规则）。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate, parseFile} from './validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tests', 'validate');

// {file, rule, level: 'errors'|'warnings', expect: true=应该出现/false=不应该出现, match: 子串}
const CASES = [
  {file: 'shotdirection-bad.json', rule: '字幕禁止镜头说明词（光点/卡片一张张出…）', level: 'errors', expect: true, match: '镜头说明'},
  {file: 'shotdirection-ok.json', rule: '镜头说明检查不误伤正常字幕', level: 'errors', expect: false, match: '镜头说明'},
  {file: 'cliche-bad.json', rule: '套路句扩展：就是这N步 + 给填空句型', level: 'warnings', expect: true, match: '套路句式'},
  {file: 'cliche-ok.json', rule: '套路句检查不误伤正常字幕', level: 'warnings', expect: false, match: '套路句式'},
  {file: 'cliche-bad.json', rule: '套路句报错里带填空句型建议', level: 'warnings', expect: true, match: '句型改写'},
  {file: 'typo-bad.json', rule: '常见错别字表（登陆/帐号）', level: 'errors', expect: true, match: '是错别字'},
  {file: 'typo-ok.json', rule: '错别字检查不误伤正确写法', level: 'errors', expect: false, match: '是错别字'},
  {file: 'typo-exception-ok.json', rule: '错别字例外：登陆舰不算错', level: 'errors', expect: false, match: '是错别字'},
  {file: 'absclaim-bad.json', rule: '绝对化承诺词表（每…都/一清二楚）', level: 'warnings', expect: true, match: '绝对化承诺'},
  {file: 'absclaim-ok.json', rule: '绝对化承诺检查不误伤有分寸的说法', level: 'warnings', expect: false, match: '绝对化承诺'},
  {file: 'action-missing-bad.json', rule: 'meta.action 必填', level: 'errors', expect: true, match: 'meta.action'},
  {file: 'action-mismatch-bad.json', rule: 'meta.action 关键词要在演示镜的画面文字里出现', level: 'errors', expect: true, match: '没体现这个动作'},
  {file: 'action-ok.json', rule: 'meta.action 检查不误伤对得上的演示', level: 'errors', expect: false, match: 'meta.action'},
  {file: 'facts-missing-bad.json', rule: 'facts 覆盖全部镜头的百分比/人数（不只 counter）', level: 'errors', expect: true, match: '在 meta.facts 里找不到来源'},
  {file: 'facts-ok.json', rule: 'facts 有来源时不报错', level: 'errors', expect: false, match: '在 meta.facts 里找不到来源'},
  {file: 'duration-mismatch-bad.json', rule: '全片耗时口径矛盾（秒级 vs 分钟级，非 counter 场景）', level: 'errors', expect: true, match: '耗时说法不一致'},
  {file: 'duration-mismatch-ok.json', rule: '耗时口径一致时不报错', level: 'errors', expect: false, match: '耗时说法不一致'},
  {file: 'compareside-bad.json', rule: 'compare 同一栏 stat 和 items 内部耗时矛盾', level: 'errors', expect: true, match: '栏内部耗时前后矛盾'},
  {file: 'compareside-ok.json', rule: 'compare 同栏一致时不报错', level: 'errors', expect: false, match: '栏内部耗时前后矛盾'},
  {file: 'structure-near-bad.json', rule: '结构模糊匹配样例（编辑距离≤1）', level: 'warnings', expect: true, match: '几乎一样'},
  {file: 'structure-near-ok.json', rule: '结构差异够大时不提醒', level: 'warnings', expect: false, match: '几乎一样'},
  {file: 'lang-en-bad.json', rule: 'lang=en 字幕按拉丁字符数估宽（超限报错）', level: 'errors', expect: true, match: 'characters, at most'},
  {file: 'lang-en-ok.json', rule: 'lang=en 字幕在英文宽度内不报错', level: 'errors', expect: false, match: 'characters, at most'},
  {file: 'durationrange-bad.json', rule: 'meta.durationRange 生效：超出自定义区间报错', level: 'errors', expect: true, match: '总时长'},
  {file: 'durationrange-ok.json', rule: 'meta.durationRange 生效：落在自定义区间内不报错', level: 'errors', expect: false, match: '总时长'},
];

const flatten = (list) => list.map((e) => `${e.where}｜${e.problem}｜${e.fix}`).join('\n');

let pass = 0;
let fail = 0;
const fails = [];
for (const c of CASES) {
  const file = path.join(DIR, c.file);
  let r;
  try {
    const parsed = parseFile(file);
    if (parsed.error) throw new Error(`JSON 解析失败：${parsed.error.problem}`);
    r = validate(parsed.sb, {baseDir: DIR});
  } catch (e) {
    fail++;
    fails.push(`[ERR] ${c.rule}（${c.file}）：跑校验本身抛异常：${e.message}`);
    continue;
  }
  const text = flatten(r[c.level] ?? []);
  const hit = text.includes(c.match);
  const ok = hit === c.expect;
  if (ok) pass++;
  else {
    fail++;
    fails.push(
      `[FAIL] ${c.rule}（${c.file}）：期望 ${c.level} 里${c.expect ? '出现' : '不出现'}「${c.match}」，实际${hit ? '出现了' : '没出现'}。\n` +
        `  errors: ${r.errors.length}, warnings: ${r.warnings.length}\n` +
        (r.errors.length ? '  ' + r.errors.map((e) => `${e.where}：${e.problem}`).join('\n  ') + '\n' : '') +
        (r.warnings.length ? '  ' + r.warnings.map((e) => `${e.where}：${e.problem}`).join('\n  ') : ''),
    );
  }
}

console.log(`用例：${CASES.length}，通过：${pass}，失败：${fail}`);
if (fails.length) {
  console.log('\n失败明细：');
  for (const f of fails) console.log(f + '\n');
  process.exit(1);
}
process.exit(0);
