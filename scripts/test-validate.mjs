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
  // ---- 2026-09 p2r2 ----
  {file: 'speed-bad.json', rule: '速度说法按模式抓（几秒钟/秒算/即刻），没有依据就拦', level: 'errors', expect: true, match: '是速度说法'},
  {file: 'speed-bad.json', rule: '速度说法：「几秒钟」也抓', level: 'errors', expect: true, match: '「几秒'},
  {file: 'speed-bad.json', rule: '速度说法：「系统秒算」也抓', level: 'errors', expect: true, match: '秒算'},
  {file: 'speed-ok.json', rule: '简报给了秒级耗时就放行；「马上试试」这类行动号召不算速度说法', level: 'errors', expect: false, match: '是速度说法'},
  {file: 'sample-effect-bad.json', rule: '自己标了示例的 fact 不能给 compare 的效果数字背书', level: 'errors', expect: true, match: '这是你自己编的示例'},
  {file: 'demodata-ok.json', rule: 'demoData + 顶部提示：示例数字可以出现在演示界面里', level: 'errors', expect: false, match: '示例/演示」的 fact'},
  {file: 'demodata-missing-bad.json', rule: '示例数字用在演示界面但没声明 demoData', level: 'errors', expect: true, match: '没声明这是演示数据'},
  {file: 'facts-source-bad.json', rule: 'meta.facts 每条必须带 source', level: 'errors', expect: true, match: '缺少 source'},
  {file: 'facts-ok.json', rule: 'facts 带 source 时不报缺来源', level: 'errors', expect: false, match: '缺少 source'},
  {file: 'brief-bad.json', brief: 'brief-sample.md', rule: '--brief：fact 里的数字在简报里找不到就拦', level: 'errors', expect: true, match: '在简报里找不到'},
  {file: 'brief-ok.json', brief: 'brief-sample.md', rule: '--brief：fact 的数字出自简报时不报错', level: 'errors', expect: false, match: '在简报里找不到'},
  {file: 'level-bad.json', rule: 'compare.level 没有简报依据就拦', level: 'errors', expect: true, match: '像是量出来的分数'},
  {file: 'level-ok.json', rule: 'compare 不写 level 时不报', level: 'errors', expect: false, match: '像是量出来的分数'},
  {file: 'meter-bad.json', rule: 'meter 的 from→value 变化没有依据就拦', level: 'errors', expect: true, match: '指针从 3 摆到 7'},
  {file: 'meter-demo-ok.json', rule: 'meter 单个读数 + demoData（产品在演示里的判断）放行', level: 'errors', expect: false, match: '没有简报依据'},
  {file: 'chat-misfit-bad.json', rule: 'chat 只用于聊天/消息/对话场景（通用版或行业 core-action 任一报出即可）', level: 'errors', expect: true, match: '对话'},
  {file: 'chat-fit-ok.json', rule: '消息类产品用 chat 不报', level: 'errors', expect: false, match: '对话'},
  {file: 'mockapp-qa-bad.json', rule: 'mockApp 提问和结果不是一回事（上月新增 vs 有多少）', level: 'errors', expect: true, match: '问的和答的不是一回事'},
  {file: 'mockapp-qa-bad.json', rule: 'mockApp items 用「数据」这类占位词', level: 'errors', expect: true, match: '是占位词'},
  {file: 'mockapp-qa-ok.json', rule: '提问带同样限定时不报', level: 'errors', expect: false, match: '问的和答的不是一回事'},
  {file: 'mockapp-qa-ok.json', rule: '具体值不算占位词', level: 'errors', expect: false, match: '是占位词'},
  {file: 'orphan-bad.json', rule: 'compare 条目折行后最后一行只剩一个字', level: 'errors', expect: true, match: '最后一行只剩「乱」'},
  {file: 'orphan-ok.json', rule: '一行放得下的条目不报孤字', level: 'errors', expect: false, match: '最后一行只剩'},
  {file: 'orphan-en-bad.json', rule: '英文口号最后一行只剩一个词', level: 'errors', expect: true, match: 'lone word'},
  {file: 'orphan-en-ok.json', rule: '英文口号断在短语边界不报', level: 'errors', expect: false, match: 'lone word'},
  {file: 'orphan-en-ok.json', rule: '英文口号断在短语边界不报（短语中断）', level: 'errors', expect: false, match: 'splits a phrase'},
  {file: 'marker-bad.json', rule: '条目开头又写 ✓ / •（组件自己会画）', level: 'errors', expect: true, match: '开头写了「✓」'},
  {file: 'marker-bad.json', rule: '片尾卖点开头写 •', level: 'errors', expect: true, match: '开头写了「•」'},
  {file: 'marker-ok.json', rule: '条目不带符号时不报', level: 'errors', expect: false, match: '开头写了'},
  {file: 'notice-dup-bad.json', rule: 'notices 和 disclaimer 都是演示意思：重复', level: 'errors', expect: true, match: '说的是同一件事'},
  {file: 'notice-dup-ok.json', rule: 'notices 放非演示条款不报重复', level: 'errors', expect: false, match: '说的是同一件事'},
  {file: 'similar-noise-ok.json', rule: '简报原话 / 插画 id 不算「和样例太像」', level: 'warnings', expect: false, match: '太像'},
  {file: 'qualifier-bad.json', rule: '价格的周几范围和 fact 不一致（平日/周末 vs 周日至周四/周五周六）', level: 'errors', expect: true, match: '周日至周四'},
  {file: 'qualifier-bad.json', rule: '「现价59元」丢了「领券后」', level: 'errors', expect: true, match: '券后'},
  {file: 'qualifier-bad.json', rule: '「68℃」丢了「6小时」', level: 'errors', expect: true, match: '6小时'},
  {file: 'qualifier-bad.json', rule: '「全天保温」比 fact 的 6 小时长', level: 'errors', expect: true, match: '比 facts 说的长'},
  {file: 'qualifier-ok.json', rule: '限定语齐全时不报', level: 'errors', expect: false, match: '限定语丢了'},
  {file: 'qualifier-ok.json', rule: '限定语齐全时不报（全天）', level: 'errors', expect: false, match: '比 facts 说的长'},
  {file: 'nearword-bad.json', rule: '近似词「相懂」提醒', level: 'warnings', expect: true, match: '不是常用词'},
  {file: 'facts-ok.json', rule: '近似词不误伤', level: 'warnings', expect: false, match: '不是常用词'},
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
    const brief = c.brief ? fs.readFileSync(path.join(DIR, c.brief), 'utf8') : null;
    r = validate(parsed.sb, {baseDir: DIR, brief});
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
