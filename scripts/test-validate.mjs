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
import {listStyles} from './lib/styles.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tests', 'validate');

// {file, rule, level: 'errors'|'warnings', expect: true=应该出现/false=不应该出现, match: 子串}
const CASES = [
  // 风格包 / 画幅（2026-09）：不写 style = cards；写错风格名、用开发中的风格、cards 用 4:5 都要拦；显式写 cards + 9:16 不误伤
  {file: 'style-unknown-bad.json', rule: 'meta.style 写了不存在的风格', level: 'errors', expect: true, match: '没有叫「nope」的风格'},
  // draftStyle：把 meta.style 换成当前任意一个开发中的风格；所有风格都 stable 时这条记为「跳过」（不算失败）
  {file: 'style-draft-bad.json', rule: '开发中的风格（status 不是 stable）不能出片', level: 'errors', expect: true, match: '还在开发中', draftStyle: true},
  {file: 'style-aspect-bad.json', rule: 'cards 只支持 9:16，写 4:5 要拦', level: 'errors', expect: true, match: '不支持 4:5'},
  {file: 'style-cards-ok.json', rule: '显式写 style: cards + aspect: 9:16 和不写一样', level: 'errors', expect: false, match: '风格'},
  // journey 风格（2026-09）：价格 / 时间 / 钩子里的总量都要在 meta.facts 里；文旅样例不误报
  {file: 'journey-facts-bad.json', rule: 'journey：价格不在 meta.facts 里要拦', level: 'errors', expect: true, match: '「10 元」是价格或时间'},
  {file: 'journey-facts-bad.json', rule: 'journey：钩子数字既不是街区数也不在 facts 里要拦', level: 'errors', expect: true, match: '钩子大字里的「30」'},
  {file: 'journey-travel-ok.json', rule: 'journey：价格时间都抄自 facts 时不误报', level: 'errors', expect: false, match: '价格或时间'},
  {file: 'journey-travel-ok.json', rule: 'journey：古镇写了 oldtown 背景 + 古城街区时不误报', level: 'errors', expect: false, match: '背景'},
  // journey 第 2 轮（2026-09）：背景天际线和街区要配套、古镇题材必须古城背景、类别名截断 / 钩子照搬 / 标题无停顿提醒、活动日期不能编、字段写在顶层合并成一条
  {file: 'journey-oldtown-bad.json', rule: 'journey：古镇题材用现代城市背景要拦', level: 'errors', expect: true, match: '题材是「古镇」，背景却是现代城市'},
  {file: 'journey-skyline-bad.json', rule: 'journey：古城背景里用邮筒街要拦', level: 'errors', expect: true, match: '「postbox」的道具和古城背景'},
  {file: 'journey-skyline-bad.json', rule: 'journey：古城背景写对了就不再报题材不符', level: 'errors', expect: false, match: '题材是「古镇」'},
  {file: 'journey-copy-bad.json', rule: 'journey：类别名被截成半个词要提醒', level: 'warnings', expect: true, match: '「预算提」像被截断的词'},
  {file: 'journey-copy-bad.json', rule: 'journey：钩子「N 个 XX 街」要提醒', level: 'warnings', expect: true, match: '钩子大字「5 个账本街」读不通'},
  {file: 'journey-copy-bad.json', rule: 'journey：长标题没有停顿要提醒', level: 'warnings', expect: true, match: '没有停顿'},
  {file: 'journey-copy-bad.json', rule: '促销报错写出触发词，并先让删词', level: 'errors', expect: true, match: '活动日期「9月16日」在 meta.facts 里找不到'},
  {file: 'journey-copy-bad.json', rule: '字段写在镜头顶层合并成一条错', level: 'errors', expect: true, match: 'category、title、scene 写在了镜头顶层'},
  {file: 'journey-copy-bad.json', rule: '字段写在镜头顶层时不再逐个报「不认识的字段」', level: 'errors', expect: false, match: '多了一个不认识的字段'},
  {file: 'journey-copy-bad.json', rule: 'journey：片尾没有数字也没有获取方式要提醒', level: 'warnings', expect: true, match: '落版只剩一句口号'},
  // quiz 风格（2026-09）：陷阱项 = 钩子误解；错误选项不写数字；中文片里的英文台词可以用半角标点
  {file: 'quiz-trap-bad.json', rule: 'quiz：钩子误解必须原样是一个选项', level: 'errors', expect: true, match: '不在选项里'},
  {file: 'quiz-number-bad.json', rule: 'quiz：错误选项不许写阿拉伯数字', level: 'errors', expect: true, match: '错误选项「隔夜泡 12 小时」写了具体数字'},
  {file: 'quiz-english-ok.json', rule: 'quiz：英文台词的半角标点不误报', level: 'errors', expect: false, match: '半角标点'},
  {file: 'quiz-spoiler-bad.json', rule: 'quiz：clip 台词不许说出答案（含数字）', level: 'errors', expect: true, match: '把答案说出来了'},
  {file: 'quiz-vo-spoiler-bad.json', rule: 'quiz：揭晓前的配音不许说出答案', level: 'errors', expect: true, match: '在揭晓前把答案说出来了'},
  {file: 'quiz-vo-spoiler-ok.json', rule: 'quiz：揭晓之后的配音可以说答案', level: 'errors', expect: false, match: '在揭晓前把答案说出来了'},
  {file: 'quiz-vo-options-ok.json', rule: 'quiz：念完全部选项、钩子并列设问不算配音剧透', level: 'errors', expect: false, match: '把答案说出来了'},
  {file: 'quiz-vo-options-ok.json', rule: 'quiz：念完全部选项的配音整份通过', level: 'errors', expect: false, match: '｜'},
  {file: 'quiz-qty-bad.json', rule: 'quiz：数量题的选项都要是数量', level: 'errors', expect: true, match: '问的是数量'},
  {file: 'quiz-qty-ok.json', rule: 'quiz：数量题错误项用中文数字能过', level: 'errors', expect: false, match: '问的是数量'},
  {file: 'quiz-screen-bad.json', rule: 'quiz：scene=phone/screen 没写 screenItems 要拦', level: 'errors', expect: true, match: '没写 screenItems'},
  {file: 'quiz-cta-bad.json', rule: 'quiz：落版按钮要和 meta.cta 对得上', level: 'errors', expect: true, match: '对不上：落版上看不到'},
  {file: 'quiz-english-ok.json', rule: 'quiz：正常的英文短语片不误报剧透', level: 'errors', expect: false, match: '把答案说出来了'},
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
  // ---- 配音（meta.voice + 每镜 vo）----
  {file: 'voice-ok.json', rule: '配音：mock + 三镜旁白（一镜不写 caption）整份通过', level: 'errors', expect: false, match: '｜'},
  {file: 'voice-ok.json', rule: '配音：正例不误报 vo / meta.voice 的提醒', level: 'warnings', expect: false, match: 'vo'},
  {file: 'facts-ok.json', rule: '配音：老分镜（没有 meta.voice / vo）不出任何配音相关提示', level: 'warnings', expect: false, match: '旁白'},
  {file: 'voice-meta-bad.json', rule: 'meta.voice：provider 只能是 minimax / mock', level: 'errors', expect: true, match: '「azure」不是可选值'},
  {file: 'voice-meta-bad.json', rule: 'meta.voice：speed 超出 0.5–2', level: 'errors', expect: true, match: '语速 3 不在 0.5–2 之间'},
  {file: 'voice-meta-bad.json', rule: 'meta.voice：emotion 不在可选情绪里', level: 'errors', expect: true, match: '「excited」不是可选情绪'},
  {file: 'voice-meta-bad.json', rule: 'meta.voice：subtitles 只能是 karaoke / line / off', level: 'errors', expect: true, match: '「big」不是可选值'},
  {file: 'voice-meta-bad.json', rule: 'meta.voice：多写的字段要拦', level: 'errors', expect: true, match: 'meta.voice.pitch｜多了一个不认识的字段'},
  {file: 'voice-rate-bad.json', rule: 'vo 语速：这一镜最长时长里念不完就拦，并给出能念的字数', level: 'errors', expect: true, match: '才念得完'},
  {file: 'voice-rate-bad.json', rule: 'vo 的 {} 要成对', level: 'errors', expect: true, match: 'vo｜{} 没有成对'},
  {file: 'voice-text-bad.json', rule: 'vo 也查《广告法》极限词', level: 'errors', expect: true, match: '（mockApp）vo｜「全网第一的排版工具，登陆就能用。」含《广告法》极限词'},
  {file: 'voice-text-bad.json', rule: 'vo 也查错别字', level: 'errors', expect: true, match: '「登陆」是错别字'},
  {file: 'voice-text-bad.json', rule: 'vo 里的数字也要在 meta.facts 里有来源', level: 'errors', expect: true, match: '（steps）vo｜「80%」在 meta.facts 里找不到来源'},
  {file: 'voice-nokey-warn.json', env: {}, rule: 'provider=minimax 但环境里没有 MINIMAX_API_KEY：只警告，不拦', level: 'warnings', expect: true, match: '当前环境没有 MINIMAX_API_KEY'},
  {file: 'voice-nokey-warn.json', env: {}, rule: '没有 key 时校验本身仍然通过', level: 'errors', expect: false, match: '｜'},
  {file: 'voice-nokey-warn.json', env: {MINIMAX_API_KEY: 'placeholder-for-test'}, rule: '有 key 时不再提醒', level: 'warnings', expect: false, match: 'MINIMAX_API_KEY'},
  {file: 'voice-orphan-bad.json', rule: '写了 vo 但没开 meta.voice 要提醒', level: 'warnings', expect: true, match: '写了 vo（旁白），但没写 meta.voice'},
  {file: 'voice-orphan-bad.json', rule: '配音设置写在顶层 voice 要拦（顶层 voice 是 make 生成的配音轨）', level: 'errors', expect: true, match: '配音设置要写在 meta.voice 里'},
  {file: 'brand-dark.json', rule: '深色品牌色配深色卡片：提醒已自动调亮', level: 'warnings', expect: true, match: '已自动调亮用于卡片上的文字'},
  {file: 'brand-light.json', rule: '浅色品牌色配浅色卡片：提醒已自动调暗', level: 'warnings', expect: true, match: '已自动调暗用于卡片上的文字'},
  {file: 'brand-clear.json', rule: '品牌色本来就够清楚时不提醒自动调色', level: 'warnings', expect: false, match: '已自动调'},
  {file: 'brand-dark.json', rule: '对比度不够只提醒，不拦', level: 'errors', expect: false, match: '已自动调'},
];

const flatten = (list) => list.map((e) => `${e.where}｜${e.problem}｜${e.fix}`).join('\n');

let pass = 0;
let fail = 0;
let skip = 0;
const fails = [];
const skips = [];
const draftId = listStyles().find((x) => x.manifest.status !== 'stable')?.id;
for (const c of CASES) {
  const file = path.join(DIR, c.file);
  let r;
  try {
    const parsed = parseFile(file);
    if (parsed.error) throw new Error(`JSON 解析失败：${parsed.error.problem}`);
    if (c.draftStyle) {
      if (!draftId) {
        skip++;
        skips.push(`[SKIP] ${c.rule}（${c.file}）：现在没有开发中的风格`);
        continue;
      }
      parsed.sb.meta.style = draftId;
    }
    const brief = c.brief ? fs.readFileSync(path.join(DIR, c.brief), 'utf8') : null;
    // env：配音用例用它模拟「有 / 没有 MINIMAX_API_KEY」，不读真实环境里的 key
    r = validate(parsed.sb, {baseDir: DIR, brief, ...(c.env ? {env: c.env} : {})});
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

function listStoryboardExamples() {
  const out = [];
  const take = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json') || name.startsWith('_')) continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isFile()) out.push(full);
    }
  };
  take(path.join(ROOT, 'examples'));
  const stylesDir = path.join(ROOT, 'styles');
  for (const name of fs.readdirSync(stylesDir)) {
    if (name.startsWith('_')) continue;
    const dir = path.join(stylesDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    take(path.join(dir, 'examples'));
  }
  return out;
}

let exPass = 0;
let exFail = 0;
for (const file of listStoryboardExamples()) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  try {
    const parsed = parseFile(file);
    if (parsed.error) throw new Error(parsed.error.problem);
    const r = validate(parsed.sb, {baseDir: path.dirname(file)});
    if (r.errors.length) {
      exFail++;
      fails.push(`[FAIL] 样例 ${rel}：${r.errors.length} 个错误\n  ` + r.errors.map((e) => `${e.where}：${e.problem}`).join('\n  '));
    } else exPass++;
  } catch (e) {
    exFail++;
    fails.push(`[ERR] 样例 ${rel}：${e.message}`);
  }
}

console.log(`用例：${CASES.length}，通过：${pass}，失败：${fail}${skip ? `，跳过：${skip}` : ''}`);
console.log(`样例：${exPass + exFail}，通过：${exPass}，失败：${exFail}`);
for (const x of skips) console.log(x);
if (fails.length) {
  console.log('\n失败明细：');
  for (const f of fails) console.log(f + '\n');
  process.exit(1);
}
process.exit(0);
