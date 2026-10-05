#!/usr/bin/env node
// 动效画面（source:"motion"）的单测：摘词定位、数字解析、否定词、顺序、上屏字从原文拷、marks、模板搭配、摆法、配色、取景框、出场时刻。
// 不渲染、不下载、不联网，几秒跑完。夹具只有文字和时间戳。
//   node tests/broll/motion.mjs
import {parseSrt} from '../../scripts/broll/srt.mjs';
import {
  FULL_MIN_ITEMS,
  LABELS,
  MOTION_COLOR_KEYS,
  MOTION_LOOKS,
  MOTION_TEMPLATES,
  TEMPLATES,
  checkAiQuantify,
  checkMotionSequence,
  cnToNum,
  describeTemplates,
  findNumbers,
  lintMotionTheme,
  locate,
  motionLookOf,
  motionModeProblem,
  norm,
  parseSay,
  spokenOf,
  toMotionProps,
  units,
  validateMotionClip,
} from '../../scripts/broll/motion.mjs';
import {LOOK_DEFAULTS, MOTION_COLOR_KEYS as TS_COLOR_KEYS, MOTION_LOOKS as TS_LOOKS, resolvePalette} from '../../template/src/talk/motion/palette.ts';
import {freeRect} from '../../template/src/talk/motion/stage.ts';
import {FADE, FIRST_BY, LAST_BEFORE_END, LEAD, counterClock, counterValue, doneTime, markerTiming, revealTimes} from '../../template/src/talk/motion/timing.ts';

const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name}：${detail}` : name);
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ---------------- 夹具：合成口播字幕（纯文字 + 时间） ----------------
const SRT = `1
00:00:00,200 --> 00:00:03,000
大家好，今天聊一个省钱的办法

2
00:00:03,200 --> 00:00:07,000
以前配一段画面要花七块钱，
现在一分钱不用

3
00:00:07,400 --> 00:00:11,800
做法分三步：先转写，
再挑句子，最后出片

4
00:00:12,200 --> 00:00:15,600
你要准备的只有两样东西：
口播视频和预算

5
00:00:16,000 --> 00:00:19,000
整条视频只用了二十五秒

6
00:00:19,400 --> 00:00:22,400
关键是，它不会乱编数字

7
00:00:22,800 --> 00:00:25,000
单价从七块钱降到 3.5 元

8
00:00:25,400 --> 00:00:31,800
这一句前面说了很长很长一段没有用的铺垫，然后才说到正题：先报价

9
00:00:32,200 --> 00:00:34,000
不到一块钱

10
00:00:34,400 --> 00:00:36,000
试试看吧
`;
const cues = parseSrt(SRT);
const DUR = 36500;
const clip = (over) => ({id: 'b01', from: 'c2', to: 'c2', source: 'motion', mode: 'split', job: 'compare', template: 'compare', plain: '测试', slots: {}, ...over});
const run = (c, opts = {}) => validateMotionClip(c, cues, {durationMs: DUR, ...opts});
const errText = (r) => r.errors.map((e) => `${e.where}：${e.problem} → ${e.fix}`).join('\n');
const expectErr = (name, c, where, needles = [], opts = {}) => {
  const r = run(c, opts);
  const text = errText(r);
  const hit = r.errors.some((e) => e.where === where);
  const missing = needles.filter((n) => !text.includes(n));
  check(name, hit && missing.length === 0 && r.plan === null && r.errors.every((e) => e.where && e.problem && e.fix), `${text || '没有报错'}${missing.length ? `\n缺：${missing.join('、')}` : ''}`);
  return r;
};
const expectOk = (name, c, opts = {}) => {
  const r = run(c, opts);
  check(name, r.errors.length === 0 && r.plan, errText(r));
  return r;
};

// ---------------- 归一和字数 ----------------
check('norm 去空白标点斜杠、全角转半角、英文小写', norm('口播视频 / 和，预算！ＡＢ１２') === '口播视频和预算ab12', norm('口播视频 / 和，预算！ＡＢ１２'));
check('norm 数字之间的小数点保留', norm('3.5 元') === '3.5元' && norm('35 元') === '35元' && norm('3.5元') !== norm('35元'));
check('norm 句尾的点照样去掉', norm('三步.') === '三步');
check('units 汉字 1、英文半个、空白不算', units('口播 AI') === 3 && units('abcd') === 2);

// ---------------- 摘词定位 ----------------
{
  const sp = spokenOf([{id: 'c1', startMs: 0, endMs: 3000, text: '它不会乱编数字，也不难用'}]);
  const a = locate('不会乱编数字', sp);
  check('locate 原句连续片段能找到', a.ok && a.text === '不会乱编数字' && a.startMs < a.endMs, JSON.stringify(a));
  const b = locate('会乱编数字', sp);
  check('locate 丢了否定词要拦', !b.ok && b.fix.includes('不会乱编数字'), JSON.stringify(b));
  const c = locate('难用', sp);
  check('locate「难用」前面是「不」也要拦', !c.ok && c.fix.includes('不难用'), JSON.stringify(c));
  const d = locate('视频文件', sp);
  check('locate 改写的找不到', !d.ok && d.problem.includes('不在'), JSON.stringify(d));
  const e = locate('不会乱编 数字', sp);
  check('locate 空格、标点不影响比对', e.ok && e.text === '不会乱编数字', JSON.stringify(e));
  const f = locate('不，会乱编', sp);
  check('locate 模型加的标点不会上屏（上屏字从原文拷）', f.ok && f.text === '不会乱编', JSON.stringify(f));
  const sp2 = spokenOf([{id: 'c1', startMs: 0, endMs: 2000, text: '要花 3.5 元'}]);
  check('locate「35 元」不能匹配原句「3.5 元」', !locate('35 元', sp2).ok);
  const sp3 = spokenOf([{id: 'c1', startMs: 0, endMs: 2000, text: '你要准备的只有两样东西：'}, {id: 'c2', startMs: 2000, endMs: 4000, text: '口播视频和预算'}]);
  const g = locate('东西口播视频', sp3);
  check('locate 能跨句，跨句处中文直接接上', g.ok && g.text === '东西：口播视频', JSON.stringify(g));
  const sp4 = spokenOf([{id: 'c1', startMs: 0, endMs: 2000, text: '今天😊聊一个省钱办法'}]);
  const e2 = locate('省钱办法', sp4);
  check('locate 句子里有表情符号时位置不错位', e2.ok && e2.text === '省钱办法' && e2.endMs > e2.startMs, JSON.stringify(e2));
  const h = locate('视频文件', sp3);
  check('locate 找不到时给原句里最接近的一截', !h.ok && h.fix.includes('口播视频'), h.fix);
}

// ---------------- 时刻 ----------------
{
  const cue = {id: 'c1', startMs: 1000, endMs: 3000, text: '先转写，再出片'};
  const lin = spokenOf([cue]);
  const ms = lin.chars.map((c) => c.ms);
  check('插值时刻单调递增且在句内', ms.every((v, i) => i === 0 || v > ms[i - 1]) && ms[0] > 1000 && ms[ms.length - 1] < 3000, JSON.stringify(ms));
  const tokens = Array.from('先转写，再出片').map((ch, i) => ({text: ch, startMs: 1100 + i * 200}));
  const real = spokenOf([cue], {tokens});
  check('有逐字时间戳时用真实时刻', near(real.chars[3].ms, 1100 + 4 * 200 + 100, 1), JSON.stringify(real.chars.map((c) => c.ms)));
  const wrong = spokenOf([cue], {tokens: tokens.slice(0, 3)});
  check('逐字时间戳对不上时退回插值', JSON.stringify(wrong.chars.map((c) => c.ms)) === JSON.stringify(ms));
}

// ---------------- 数字 ----------------
const say = (s, ctx) => parseSay(s, ctx);
const okNum = (s, value, suffix, prefix = '', decimals = 0) => {
  const r = say(s);
  check(`parseSay「${s}」`, !r.error && near(r.value, value) && r.suffix === suffix && r.prefix === prefix && r.decimals === decimals, JSON.stringify(r));
};
okNum('3.5 元', 3.5, '元', '', 1);
okNum('两个小时', 2, '小时');
okNum('¥199', 199, '', '¥');
okNum('$3.50', 3.5, '', '$', 2);
okNum('二十五秒', 25, '秒');
okNum('40%', 40, '%');
okNum('百分之四十', 40, '%');
okNum('三百块', 300, '元');
okNum('七块钱', 7, '元');
okNum('十五分钟', 15, '分钟');
okNum('一个半小时', 1.5, '小时', '', 1);
okNum('两年半', 2.5, '年', '', 1);
okNum('半个小时', 0.5, '小时', '', 1);
okNum('三点五元', 3.5, '元', '', 1);
okNum('1,000 次', 1000, '次');
okNum('一百零五个', 105, '个');
okNum('12 倍', 12, '倍');
okNum('只用了二十五秒', 25, '秒');
const badNum = (s, needle, ctx) => {
  const r = say(s, ctx);
  check(`parseSay 拒绝「${s}」`, !!r.error && (r.error + r.fix).includes(needle), JSON.stringify(r));
};
badNum('第三步', '第几');
badNum('七八块', '约数');
badNum('三十多秒', '约数');
badNum('十几个', '约数');
badNum('十块来钱', '约数');
badNum('一万二', '口语简写');
badNum('两千五', '口语简写');
badNum('好几倍', '没有数字');
badNum('半天', '不是一个数量');
badNum('三分之一', '分数');
badNum('不到一块钱', '不到');
badNum('三十秒以内', '以内');
badNum('一块钱', '不到', {before: '不到'});
badNum('从七块降到三块', '2 个数');
badNum('三棵树', '单位');
check('cnToNum 基本写法', cnToNum('二十五') === 25 && cnToNum('十五') === 15 && cnToNum('一百零五') === 105 && cnToNum('三万五千') === 35000 && cnToNum('两亿') === 2e8 && cnToNum('三点五') === 3.5 && cnToNum('半') === 0.5);
check('cnToNum 认不出返回 NaN', Number.isNaN(cnToNum('百')) && Number.isNaN(cnToNum('万')) && Number.isNaN(cnToNum('abc')));
check('findNumbers 找到确定的数，「一个」「一段」不算', JSON.stringify(findNumbers('录一段口播，一个项目，整条视频只用了二十五秒').map((q) => q.raw)) === JSON.stringify(['二十五秒']));

// ---------------- 校验：五个模板的正确写法 ----------------
{
  const r = expectOk('compare 正确写法', clip({slots: {labels: 'old-new', left: ['要花七块钱'], right: ['一分钱不用']}}));
  if (r.plan) {
    check('compare 栏标题由 labels 给', r.plan.data.leftTitle === '以前' && r.plan.data.rightTitle === '现在');
    check('compare 左栏比右栏先说', r.plan.marksMs.left[0] < r.plan.marksMs.right[0]);
    check('compare 不花钱', r.plan.costYuan === 0);
  }
}
{
  const r = expectOk('steps 正确写法', clip({id: 'b02', from: 'c3', to: 'c3', job: 'explain', template: 'steps', slots: {items: ['先转写', '再挑句子', '最后出片']}}));
  if (r.plan) {
    const m = r.plan.marksMs.items;
    check('steps marks 按说话先后递增、落在窗口里', m.length === 3 && m[0] < m[1] && m[1] < m[2] && m[0] >= r.plan.windowMs[0] && m[2] <= r.plan.windowMs[1], JSON.stringify(m));
    const p = toMotionProps(r.plan, {look: {look: 'wood', accent: '#FFB04A'}});
    check('toMotionProps 时刻换成窗口内的秒数', p.kind === 'motion' && p.badge === false && p.look?.look === 'wood' && p.look.accent === '#FFB04A' && near(p.marks.items[0], (m[0] - r.plan.windowMs[0]) / 1000, 0.001) && p.startMs === r.plan.windowMs[0], JSON.stringify(p));
    check('toMotionProps 带 mode 和 lang', p.mode === 'split' && p.lang === 'zh');
  }
}
{
  const r = expectOk('checklist 正确写法', clip({id: 'b03', from: 'c4', to: 'c4', mode: 'pip', job: 'list', template: 'checklist', slots: {title: '要准备的', items: ['口播视频', '预算']}}));
  if (r.plan) check('checklist 上屏字', JSON.stringify(r.plan.screenText) === JSON.stringify(['要准备的', '口播视频', '预算']), JSON.stringify(r.plan.screenText));
}
{
  const r = expectOk('counter 正确写法', clip({id: 'b04', from: 'c5', to: 'c5', mode: 'pip', job: 'quantify', template: 'counter', slots: {say: '二十五秒', label: '整条视频'}}));
  if (r.plan) {
    const {say: n} = r.plan.data;
    check('counter 数字由脚本换算', n.value === 25 && n.suffix === '秒' && n.text === '二十五秒', JSON.stringify(n));
    check('counter 落定在念到「五」时（早于整截说完）', r.plan.marksMs.sayAt < r.plan.marksMs.say && r.plan.marksMs.sayAt > r.plan.marksMs.say0, JSON.stringify(r.plan.marksMs));
  }
}
{
  const r = expectOk('counter 写 from（降价）', clip({id: 'b05', from: 'c7', to: 'c7', mode: 'split', job: 'quantify', template: 'counter', slots: {from: '七块钱', say: '3.5 元', label: '单价'}}));
  if (r.plan) check('counter from 和 say 都解析', r.plan.data.from.value === 7 && r.plan.data.say.value === 3.5 && r.plan.data.say.decimals === 1, JSON.stringify(r.plan.data));
}
{
  const r = expectOk('keyword 正确写法', clip({id: 'b06', from: 'c6', to: 'c6', job: 'stress', template: 'keyword', slots: {text: '它不会乱编数字', hot: '不会乱编'}}));
  if (r.plan) {
    const p = toMotionProps(r.plan);
    check('keyword 每个字都有时刻', p.marks.chars.length === Array.from(r.plan.data.text).length && p.marks.chars.every((v, i, a) => i === 0 || v >= a[i - 1]), JSON.stringify(p.marks.chars));
    check('keyword hot 在 text 里', r.plan.data.text.includes(r.plan.data.hot));
  }
}
check('模板表里每个示例都能用', MOTION_TEMPLATES.every((name) => {
  const ex = TEMPLATES[name].example;
  const one = parseSrt(`1\n00:00:00,000 --> 00:00:01,000\n开场\n\n2\n00:00:01,500 --> 00:00:05,500\n${ex.sentence}\n\n3\n00:00:06,000 --> 00:00:07,000\n结尾\n`);
  const r = validateMotionClip({id: 'b01', from: 'c2', to: 'c2', source: 'motion', mode: 'split', job: ex.job, template: name, plain: '示例', slots: ex.slots}, one, {durationMs: 7500, full: true});
  if (r.errors.length) failures.push(`示例 ${name}：${errText(r)}`);
  return r.errors.length === 0;
}));
check('describeTemplates 列出全部模板和示例', MOTION_TEMPLATES.every((n) => describeTemplates().includes(`- ${n}：`)) && describeTemplates().includes('例：'));

// ---------------- 校验：拦下来的写法（每条都要有「怎么改」） ----------------
expectErr('编了个数', clip({job: 'quantify', template: 'counter', slots: {say: '8 块钱', label: '配一段画面'}}), 'b01.slots.say', ['不在', '原句里最接近']);
expectErr('改写了', clip({from: 'c4', to: 'c4', job: 'list', template: 'checklist', slots: {items: ['视频文件', '预算']}}), 'b01.slots.items[0]', ['口播视频']);
expectErr('丢了否定词', clip({from: 'c6', to: 'c6', job: 'stress', template: 'keyword', slots: {text: '会乱编数字'}}), 'b01.slots.text', ['不会乱编数字']);
expectErr('顺序乱了', clip({from: 'c3', to: 'c3', job: 'explain', template: 'steps', slots: {items: ['再挑句子', '先转写', '最后出片']}}), 'b01.slots.items[1]', ['先后']);
expectErr('多写了一格', clip({from: 'c3', to: 'c3', job: 'explain', template: 'steps', slots: {items: ['先转写', '再挑句子'], count: '3 步'}}), 'b01.slots.count', ['数字只能写在 counter']);
expectErr('labels 乱写', clip({slots: {labels: '贵-便宜', left: ['要花七块钱'], right: ['一分钱不用']}}), 'b01.slots.labels', ['old-new']);
expectErr('job 不配', clip({from: 'c5', to: 'c5', job: 'evoke', template: 'counter', slots: {say: '二十五秒', label: '整条视频'}}), 'b01.job', ['quantify', 'keyword']);
expectErr('写了 AI 段的字段', clip({camera: 'static', slots: {labels: 'old-new', left: ['要花七块钱'], right: ['一分钱不用']}}), 'b01.camera', ['不写']);
expectErr('多了不认识的字段', clip({color: 'red', slots: {labels: 'old-new', left: ['要花七块钱'], right: ['一分钱不用']}}), 'b01.color', ['只写']);
expectErr('没有这个模板', clip({template: 'chart'}), 'b01.template', ['keyword']);
expectErr('slots 不是对象', clip({slots: ['要花七块钱']}), 'b01.slots', ['照这个样子写']);
expectErr('plain 空着', clip({plain: '', slots: {labels: 'old-new', left: ['要花七块钱'], right: ['一分钱不用']}}), 'b01.plain', ['20 字']);
expectErr('必填没写', clip({slots: {labels: 'old-new', left: ['要花七块钱']}}), 'b01.slots.right', ['必填']);
expectErr('右栏比左栏先说', clip({slots: {labels: 'old-new', left: ['一分钱不用'], right: ['要花七块钱']}}), 'b01.slots.right', ['先说']);
expectErr('清单只有一条', clip({from: 'c4', to: 'c4', job: 'list', template: 'checklist', slots: {items: ['预算']}}), 'b01.slots.items', ['keyword']);
expectErr('清单重复', clip({from: 'c4', to: 'c4', job: 'list', template: 'checklist', slots: {items: ['预算', '预算']}}), 'b01.slots.items[1]', ['一样']);
expectErr('步骤每条太长', clip({from: 'c3', to: 'c3', job: 'explain', template: 'steps', slots: {items: ['做法分三步先转写', '再挑句子最后出片']}}), 'b01.slots.items[0]', ['最多 8 字']);
expectErr('keyword hot 不在 text 里', clip({from: 'c6', to: 'c6', job: 'stress', template: 'keyword', slots: {text: '它不会乱编数字', hot: '关键是'}}), 'b01.slots.hot', ['不在 text']);
expectErr('counter 约数', clip({from: 'c9', to: 'c9', job: 'quantify', template: 'counter', slots: {say: '一块钱', label: '不到一块钱'}}), 'b01.slots.say', []);
expectErr('counter 限定词', clip({from: 'c9', to: 'c9', job: 'quantify', template: 'counter', slots: {say: '不到一块钱', label: '不到一块钱'}}), 'b01.slots.say', ['不到', 'keyword']);
expectErr('字说得太晚：from 要改', clip({from: 'c7', to: 'c8', job: 'stress', template: 'keyword', slots: {text: '先报价'}}), 'b01.from', ['把 from 改成 c8']);
expectErr('说完停太久：to 要改', clip({from: 'c5', to: 'c7', mode: 'pip', job: 'quantify', template: 'counter', slots: {say: '二十五秒', label: '整条视频'}}), 'b01.to', ['把 to 改成 c5']);
{
  const r = run(clip({from: 'c8', to: 'c8', job: 'stress', template: 'keyword', slots: {text: '先报价'}}));
  check('同一句里字说得晚只提醒不拦', r.errors.length === 0 && r.warnings.some((w) => w.problem.includes('才说出来')), errText(r) + JSON.stringify(r.warnings));
}
{
  const r = run(clip({from: 'c1', to: 'c1', slots: {labels: 'old-new', left: ['a'], right: ['b']}}), {full: true});
  check('full 模式也查 mode 和窗口', r.errors.length > 0);
  const r2 = run(clip({from: 'c9', to: 'c2', slots: {labels: 'old-new', left: ['要花七块钱'], right: ['一分钱不用']}}), {full: true});
  check('full 模式查 from / to', r2.errors.some((e) => e.where === 'b01' && e.problem.includes('from')), errText(r2));
  const r3 = run(clip({from: 'c9', to: 'c2', slots: {labels: 'old-new', left: ['要花七块钱'], right: ['一分钱不用']}}));
  check('默认不重复报 from / to（validate.mjs 会报）', r3.errors.length === 0 && r3.plan === null, errText(r3));
}

// ---------------- 全片搭配、AI 段报数 ----------------
{
  const k = (id, from) => ({id, from, to: from, source: 'motion', mode: 'split', job: 'stress', template: 'keyword', plain: 'x', slots: {}});
  const seq = checkMotionSequence([k('b01', 'c2'), k('b02', 'c4'), {id: 'b03', from: 'c5', to: 'c5', job: 'evoke'}, k('b04', 'c6'), {...k('b05', 'c7'), template: 'steps'}, k('b06', 'c8')]);
  check('相邻两段同一个模板要拦', seq.errors.some((e) => e.where === 'b02.template' && e.problem.includes('b01')), JSON.stringify(seq));
  check('同一个模板第 3 次要拦', seq.errors.some((e) => e.where === 'b04.template' && e.problem.includes('第 3 次')), JSON.stringify(seq));
  check('中间隔着 AI 段不算相邻', !seq.errors.some((e) => e.where === 'b04.template' && e.problem.includes('上一段')), JSON.stringify(seq));
  const ai = checkAiQuantify({id: 'b01', from: 'c5', to: 'c5', job: 'quantify', mode: 'full'}, cues);
  check('AI 段报数要改成 counter', ai && ai.where === 'b01.source' && ai.fix.includes('二十五秒') && ai.fix.includes('counter'), JSON.stringify(ai));
  check('AI 段不报数不拦', checkAiQuantify({id: 'b01', from: 'c4', to: 'c4', job: 'quantify'}, cues) === null && checkAiQuantify({id: 'b01', from: 'c5', to: 'c5', job: 'evoke'}, cues) === null);
  check('LABELS 中英都有', Object.values(LABELS).every((l) => l.zh.length === 2 && l.en.length === 2));
}

// ---------------- 摆法：说话的人优先留在画面里 ----------------
{
  expectErr('keyword 不许 full', clip({from: 'c6', to: 'c6', mode: 'full', job: 'stress', template: 'keyword', slots: {text: '它不会乱编数字'}}), 'b01.mode', ['keyword', 'split', 'pip']);
  const wide = run(clip({from: 'c6', to: 'c6', mode: 'full', job: 'stress', template: 'keyword', slots: {text: '它不会乱编数字'}}), {width: 1920, height: 1080});
  check('横版 keyword full：只让改 pip', wide.errors.some((e) => e.where === 'b01.mode' && e.fix.includes('pip') && !e.fix.includes('split')), errText(wide));
  const burned = run(clip({from: 'c6', to: 'c6', mode: 'full', job: 'stress', template: 'keyword', slots: {text: '它不会乱编数字'}}), {width: 1080, height: 1920, captions: 'burned'});
  check('burned keyword full：只让改 split', burned.errors.some((e) => e.where === 'b01.mode' && e.fix.includes('split') && !e.fix.includes('pip')), errText(burned));
  expectErr('两条的清单不许 full', clip({from: 'c4', to: 'c4', mode: 'full', job: 'list', template: 'checklist', slots: {items: ['口播视频', '预算']}}), 'b01.mode', ['2 条', `${FULL_MIN_ITEMS} 条以上`]);
  expectOk('三条的步骤可以 full', clip({from: 'c3', to: 'c3', mode: 'full', job: 'explain', template: 'steps', slots: {items: ['先转写', '再挑句子', '最后出片']}}));
  expectErr('counter 不许 full', clip({from: 'c5', to: 'c5', mode: 'full', job: 'quantify', template: 'counter', slots: {say: '二十五秒', label: '整条视频'}}), 'b01.mode', ['counter']);
  expectErr('compare 不许 full', clip({mode: 'full', slots: {labels: 'old-new', left: ['要花七块钱'], right: ['一分钱不用']}}), 'b01.mode', ['compare']);
  expectOk('keyword 用 pip', clip({from: 'c6', to: 'c6', mode: 'pip', job: 'stress', template: 'keyword', slots: {text: '它不会乱编数字'}}));
  check('split / pip 都不报', ['split', 'pip'].every((m) => MOTION_TEMPLATES.every((n) => motionModeProblem(n, m, {items: ['a', 'b']}) === null)));
  check('模板表的示例都不用 full', MOTION_TEMPLATES.every((n) => motionModeProblem(n, 'split', TEMPLATES[n].example.slots) === null));
}

// ---------------- 配色：风格包的 motionTheme ----------------
{
  check('look 和色号的键名脚本、合成两边一致', JSON.stringify(MOTION_LOOKS) === JSON.stringify(TS_LOOKS) && JSON.stringify(MOTION_COLOR_KEYS) === JSON.stringify(TS_COLOR_KEYS));
  check('每个 look 的默认色都齐', TS_LOOKS.every((l) => TS_COLOR_KEYS.every((k) => /^#[0-9A-F]{6}$/i.test(LOOK_DEFAULTS[l][k]))));
  check('lintMotionTheme：对的写法没问题', lintMotionTheme({look: 'wood', accent: '#FFB04A'}).length === 0);
  check('lintMotionTheme：字符串、错的 look、错的色号、多的键都报', lintMotionTheme('studio-graphite').length === 1 && lintMotionTheme({look: 'neon'}).length === 1 && lintMotionTheme({look: 'wood', accent: 'orange'}).length === 1 && lintMotionTheme({look: 'wood', glow: '#FFFFFF'}).length === 1);
  const look = motionLookOf({motionTheme: {look: 'paper', accent: '#F28E6C', extra: 1, ink: 'bad'}});
  check('motionLookOf 只拷认识的键', JSON.stringify(look) === JSON.stringify({look: 'paper', accent: '#F28E6C'}), JSON.stringify(look));
  check('motionLookOf：老的字符串主题名不传', motionLookOf({motionTheme: 'studio-graphite'}) === undefined && motionLookOf({}) === undefined);
  const pal = resolvePalette({look: 'paper', accent: '#123456', ink: 'nope'});
  check('resolvePalette：写了的色号覆盖、写错的用默认', pal.look === 'paper' && pal.accent === '#123456' && pal.ink === LOOK_DEFAULTS.paper.ink, JSON.stringify(pal));
  check('resolvePalette：不认识的 look、字符串都退回 wood', resolvePalette({look: 'neon'}).look === 'wood' && resolvePalette('studio-graphite').look === 'wood' && resolvePalette(undefined).cool === '#9FB1BC');
}

// ---------------- 取景框：让开平台栏、字幕、画中画圆窗 ----------------
const inBox = (r, b, eps = 0.5) => r.x >= b.x - eps && r.x + r.width <= b.x + b.width + eps && r.y >= b.y - eps && r.y + r.height <= b.y + b.height + eps;
const hits = (a, b) => Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
{
  // 720×1280 split：上 60% 是框，字幕一行时贴在分界线上方
  const box = {x: 0, y: 0, width: 720, height: 768};
  const f = freeRect({box, compW: 720, compH: 1280, captionTop: 695});
  check('split：取景框在框里', inBox(f, box), JSON.stringify(f));
  check('split：不压字幕', f.y + f.height <= 695, JSON.stringify(f));
  check('split：让开平台顶栏', f.y >= (205 / 1920) * 1280 - 0.5, JSON.stringify(f));
  check('split：宽度用满（只留 4% 边）', f.width >= 720 * 0.9, JSON.stringify(f));
  const f3 = freeRect({box, compW: 720, compH: 1280, captionTop: 560});
  check('split 三行字幕：底边跟着上移', f3.y + f3.height <= 560 && f3.height < f.height, JSON.stringify(f3));
  const f0 = freeRect({box, compW: 720, compH: 1280, captionTop: null});
  check('没有字幕：用到框底（留边）', f0.y + f0.height <= 768 && f0.height > f.height, JSON.stringify(f0));
}
{
  // 1080×1920 pip：圆窗在右下，取景框在平台安全区里、不压圆窗
  const box = {x: 0, y: 0, width: 1080, height: 1920};
  const face = {x: 696, y: 1536, width: 320, height: 320};
  const f = freeRect({box, compW: 1080, compH: 1920, captionTop: 1440, avoid: face});
  check('pip 竖版：在平台安全区里', f.y >= 205 - 0.5 && f.y + f.height <= 1340 + 0.5, JSON.stringify(f));
  check('pip 竖版：不压圆窗', !hits(f, face), JSON.stringify(f));
  const big = {x: 560, y: 1100, width: 460, height: 460};
  const f2 = freeRect({box, compW: 1080, compH: 1920, captionTop: 1440, avoid: big});
  check('pip 大圆窗压进来：取景框让开', !hits(f2, big) && f2.height > 300, JSON.stringify(f2));
}
{
  // 横版 1920×1080 pip：圆窗在右下，字幕在 0.75H
  const box = {x: 0, y: 0, width: 1920, height: 1080};
  const face = {x: 1596, y: 756, width: 260, height: 260};
  const f = freeRect({box, compW: 1920, compH: 1080, captionTop: 810, avoid: face});
  check('横版 pip：不压字幕、不压圆窗、在框里', f.y + f.height <= 810 && !hits(f, face) && inBox(f, box), JSON.stringify(f));
  check('横版：不按竖版平台栏留顶', f.y < 100, JSON.stringify(f));
}

// ---------------- 出场时刻：第 i 条在说出第 i 条的那一刻出来 ----------------
{
  const dur = 5;
  const marks = [1.2, 2.0, 3.1];
  const at = revealTimes(marks, 3, dur);
  check('第一条不晚于 FIRST_BY（画面一出来就有字）', at[0] <= FIRST_BY + 1e-9, JSON.stringify(at));
  check('后面的条目正好在开口前 LEAD 秒出场', near(at[1], 2.0 - LEAD) && near(at[2], 3.1 - LEAD), JSON.stringify(at));
  check('出场单调不减、都不晚于开口', at.every((v, i) => (i === 0 || v >= at[i - 1]) && v <= marks[i]));
  const late = revealTimes([0.2, 4.95], 2, dur);
  check('说得太晚的条目也在淡出前出场', late[1] <= dur - LAST_BEFORE_END + 1e-9, JSON.stringify(late));
  const right = revealTimes([2.5], 1, dur, null);
  check('compare 右栏不提前到开头', near(right[0], 2.5 - LEAD), JSON.stringify(right));
  const none = revealTimes(undefined, 3, dur);
  check('没有 marks 时按拍子排开', none[0] > 0 && none[1] > none[0] && none[2] > none[1] && none[2] <= dur - LAST_BEFORE_END, JSON.stringify(none));
  const bad = revealTimes([2, 1], 2, dur);
  check('时刻倒着来也不倒退', bad[1] >= bad[0], JSON.stringify(bad));
  const done = doneTime(at, [1.8, 2.8, 3.9], dur);
  check('全部说完：最后一条结尾之后、淡出之前', done > 3.9 && done <= dur - LAST_BEFORE_END, String(done));
}
{
  // keyword 马克笔：说完 hot 开始扫；离淡出太近就扫快、再不够提前（不早于 hot 第一个字）
  const m = markerTiming(1.5, 4, 1.0);
  check('马克笔在说完 hot 时扫', near(m.at, 1.4) && near(m.dur, 0.45), JSON.stringify(m));
  const tight = markerTiming(3.2, 4, 2.6);
  check('马克笔离淡出太近：扫完后还停够 0.5 秒', tight.at + tight.dur <= 4 - FADE - 0.5 + 1e-9 && tight.at >= 2.6 - 0.1 - 1e-9, JSON.stringify(tight));
  check('没有 hot 就不扫', markerTiming(undefined, 4).at === undefined);
}
{
  // counter：念到最后一个数字字时落定；没有旧值时一直在往上滚，有旧值时旧值先亮着
  const c = counterClock(2.4, false, 4);
  check('counter 落定在念到数字的那一刻', near(c.land, 2.4) && near(counterValue(2.4, c, 25), 25) && near(counterValue(3.5, c, 25), 25));
  const vs = Array.from({length: 25}, (_, i) => counterValue(0.2 + i * 0.09, c, 25));
  check('counter 没有旧值：落定前一直在动（不停在 0 上）', vs.every((v, i) => i === 0 || v > vs[i - 1] || v === 25), JSON.stringify(vs.map((v) => v.toFixed(2))));
  const f = counterClock(2.4, true, 4);
  check('counter 有旧值：滚之前停在旧值', near(counterValue(0.8, f, 3.5, 7), 7) && f.start > 1 && near(counterValue(2.4, f, 3.5, 7), 3.5), JSON.stringify(f));
  const early = counterClock(0.1, false, 3);
  check('counter 数字说得很早也有一小段滚动', early.land > early.start, JSON.stringify(early));
}
if (failures.length) {
  console.log(`motion 单测：${passed} 过，${failures.length} 败`);
  failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  process.exit(1);
}
console.log(`motion 单测全过：${passed} 项`);
