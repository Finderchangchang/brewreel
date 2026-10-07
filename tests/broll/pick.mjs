#!/usr/bin/env node
// 口播选型：一句里只有一个数却用了 checklist / steps 要拦；约数用 counter 要拦。
// 不渲染、不下载、不联网。正例反例都走 validateMotionClip。
//   node tests/broll/pick.mjs
import {parseSay, validateMotionClip} from '../../scripts/broll/motion.mjs';

const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name}：${detail}` : name);
};

const cue = (i, startMs, endMs, text) => ({id: `c${i}`, index: i, startMs, endMs, text});
const cuesOf = (text) => [cue(1, 0, 1500, '开场'), cue(2, 2000, 6000, text), cue(3, 7000, 8500, '结尾')];
const run = (text, over) =>
  validateMotionClip(
    {id: 'b01', from: 'c2', to: 'c2', source: 'motion', mode: 'split', plain: '测试', ...over},
    cuesOf(text),
    {durationMs: 9000},
  );
const errText = (r) => r.errors.map((e) => `${e.where}：${e.problem} → ${e.fix}`).join('\n');

const expectOk = (name, text, over) => {
  const r = run(text, over);
  check(name, r.errors.length === 0 && r.plan, errText(r) || '没有 plan');
  return r;
};
const expectLone = (name, text, template, job, slots, raw) => {
  const r = run(text, {job, template, slots});
  const hit = r.errors.find((e) => e.where === 'b01.template');
  check(
    name,
    !!hit && hit.problem.includes(raw) && hit.problem.includes(template) && hit.fix.includes('counter') && hit.fix.includes(raw) && hit.fix.includes('quantify') && r.plan === null,
    errText(r) || '没有报错',
  );
};
const expectApprox = (name, text, say, label) => {
  const r = run(text, {job: 'quantify', template: 'counter', slots: {say, label}});
  const hit = r.errors.find((e) => e.where === 'b01.slots.say');
  check(name, !!hit && /约数|别用 counter|限定词|认不出/.test(`${hit.problem}${hit.fix}`) && r.plan === null, errText(r) || '没有报错');
};

// ── 一个数却用 checklist / steps：反例 ──
expectLone('一个数用 checklist', '整条视频只用了二十五秒', 'checklist', 'list', {items: ['整条视频', '二十五秒']}, '二十五秒');
expectLone('一个数用 steps', '整条视频只用了二十五秒', 'steps', 'explain', {items: ['整条视频', '二十五秒']}, '二十五秒');
expectLone('金额用 checklist', '单价只要 3.5 元就够', 'checklist', 'list', {items: ['单价只要', '3.5 元']}, '3.5元');
expectLone('倍数用 steps', '这一条快了十二倍', 'steps', 'explain', {items: ['这一条', '十二倍']}, '十二倍');
expectLone('一个序号盖不住报出的数', '二十五秒，这是第一步', 'steps', 'explain', {items: ['二十五秒', '这是第一步']}, '二十五秒');
expectLone('英文句子保留数字和单位之间的空格', 'The whole video took only 25 seconds', 'steps', 'explain', {items: ['took only', '25 seconds']}, '25 seconds');

// 个数和条数对不上，仍然是在报一个数
expectLone('个数对不上条数', '我们一共服务了三个客户', 'checklist', 'list', {items: ['我们一共服务了', '客户']}, '三个');

// ── 一个数却用 checklist / steps：正例（不误伤） ──
expectOk('个数领起的清单', '一共两个功能：转写和配画面', {job: 'list', template: 'checklist', slots: {items: ['转写', '配画面']}});
expectOk('个数领起的步骤', '只要三步：先转写，再挑句子，最后出片', {job: 'explain', template: 'steps', slots: {items: ['先转写', '再挑句子', '最后出片']}});
expectOk('两个数可以做清单', '左边七块钱，右边三块钱', {job: 'list', template: 'checklist', slots: {items: ['七块钱', '三块钱']}});
expectOk('两个数可以做步骤', '先花七块钱，再花三块钱', {job: 'explain', template: 'steps', slots: {items: ['先花七块钱', '再花三块钱']}});
expectOk('步骤句带序号可以过', '第一步转写，第二步挑句，第三步出片', {
  job: 'explain',
  template: 'steps',
  slots: {items: ['第一步转写', '第二步挑句', '第三步出片']},
});
expectOk('「三步」加先再最后仍是步骤', '做法分三步：先转写，再挑句子，最后出片', {
  job: 'explain',
  template: 'steps',
  slots: {items: ['先转写', '再挑句子', '最后出片']},
});
expectOk('序号和步数在同一句仍是步骤', '一共三步：第一步转写，第二步出片', {
  job: 'explain',
  template: 'steps',
  slots: {items: ['第一步转写', '第二步出片']},
});
expectOk('没有确定的数可以做清单', '你要准备的只有两样东西：口播视频和预算', {
  job: 'list',
  template: 'checklist',
  slots: {title: '要准备的', items: ['口播视频', '预算']},
});

// ── 约数用 counter：反例（紧挨着的，以及中间隔了一两个字的） ──
expectApprox('七八块不用 counter', '七八块钱就够了', '七八块', '就够了');
expectApprox('几十不用 counter', '大概要几十块', '几十块', '大概要');
expectApprox('左右不用 counter', '只要三十秒左右', '三十秒', '只要');
expectApprox('大概是不用 counter', '大概是三十秒', '三十秒', '大概是');
expectApprox('上千不用 counter', '现场有上千人', '上千人', '现场有');

// ── 确定的数用 counter：正例 ──
expectOk('二十五秒用 counter', '整条视频只用了二十五秒', {job: 'quantify', template: 'counter', slots: {say: '二十五秒', label: '整条视频'}});
expectOk('3.5 元用 counter', '单价只要 3.5 元就够', {job: 'quantify', template: 'counter', slots: {say: '3.5 元', label: '单价只要'}});
expectOk('十二倍用 counter', '这一条快了十二倍', {job: 'quantify', template: 'counter', slots: {say: '十二倍', label: '这一条'}});
expectOk('两个确定的数用 from 和 say', '单价从七块钱降到 3.5 元', {
  job: 'quantify',
  template: 'counter',
  slots: {from: '七块钱', say: '3.5 元', label: '单价'},
});

// 隔字的约数在 parseSay 上也会直接拒绝（不依赖整段校验）
{
  const a = parseSay('三十秒', {before: '大概是'});
  const b = parseSay('三十秒', {before: '大概需要'});
  const c = parseSay('三十秒', {after: '的左右'});
  check('parseSay 大概是', !!a.error && a.fix.includes('别用 counter'), JSON.stringify(a));
  check('parseSay 大概需要', !!b.error && b.fix.includes('别用 counter'), JSON.stringify(b));
  check('parseSay 的左右', !!c.error && c.fix.includes('别用 counter'), JSON.stringify(c));
}

if (failures.length) {
  console.log(`pick 单测：${passed} 过，${failures.length} 败`);
  failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  process.exit(1);
}
console.log(`pick 单测全过：${passed} 项`);
