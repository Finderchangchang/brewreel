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
import {CAPTION_GAP, TALL_SIDE, freeRect, inflate, placeDecor, rectsHit} from '../../template/src/talk/motion/stage.ts';
import {FADE, FIRST_BY, LAST_BEFORE_END, LEAD, ROLL, counterClock, counterValue, doneTime, isMoney, markerTiming, revealTimes, stepCheckTimes} from '../../template/src/talk/motion/timing.ts';
import {badgeOf, oldCardOf, shapeColors} from '../../template/src/talk/motion/palette.ts';
import {listGeom} from '../../template/src/talk/motion/measure.ts';
import {keywordLayout} from '../../template/src/talk/motion/kwLayout.ts';
import {MOTION_PIP_K, TRANS_SEC, captionMinusKeyword, pipOf} from '../../template/src/talk/layout.ts';
import {MOTION_FRAMING, edgesOf, panelOffset, transFrames, transProgress, videoPlacement} from '../../template/src/talk/transition.ts';

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
// ---------------- 第二轮打磨：摆法按模式取景、进出场、装饰禁区、关键词版面、数字翻牌、配色 ----------------
{
  // 竖版 pip / full：左右各留 60 像素@720（右边不进抖音图标列），顶在 0.1H，底不过字幕、圆窗
  const box = {x: 0, y: 0, width: 720, height: 1280};
  const {d, margin} = pipOf(720, 1280, MOTION_PIP_K);
  const face = {x: 720 - margin - d, y: 1280 - margin - d, width: d, height: d};
  check('动效段圆窗放大到 240–260 像素@720', d >= 240 && d <= 260, String(d));
  check('视频段圆窗还是 v0.8 的大小', pipOf(720, 1280).d === 213);
  const f = freeRect({box, compW: 720, compH: 1280, captionTop: 960, avoid: face, mode: 'pip'});
  check('pip 竖版：右边不过 x 660、左边留够 48', f.x + f.width <= 660 + 0.5 && f.x >= 48, JSON.stringify(f));
  check('pip 竖版：顶在 y 120–140，底在字幕顶 24 像素以上', f.y >= 120 && f.y <= 140 && f.y + f.height <= 960 - 24, JSON.stringify(f));
  check('pip 竖版：不压圆窗', !rectsHit(f, face) && f.y + f.height <= face.y - 24, JSON.stringify(f));
  check('pip 竖版：比老规矩高（用到字幕上方）', f.height > freeRect({box, compW: 720, compH: 1280, captionTop: 960, avoid: face}).height, JSON.stringify(f));
  const noCap = freeRect({box, compW: 720, compH: 1280, captionTop: null, avoid: face, mode: 'pip'});
  check('pip 竖版没有字幕：底到圆窗上面、不过 y 1000', noCap.y + noCap.height <= Math.min(1000, face.y - 24) + 0.5 && noCap.height > f.height, JSON.stringify(noCap));
  const full = freeRect({box, compW: 720, compH: 1280, captionTop: null, mode: 'full'});
  check('full 竖版没有字幕：底不过 y 1080', full.y + full.height <= 1080 + 0.5 && full.y + full.height > 1000, JSON.stringify(full));
  const split = freeRect({box: {x: 0, y: 0, width: 720, height: 768}, compW: 720, compH: 1280, captionTop: 695, mode: 'split'});
  check('split：卡片底和字幕顶隔够 24 像素', split.y + split.height <= 695 - 24, JSON.stringify(split));
  check('左右留边常量是 60/720', near(TALL_SIDE * 720, 60) && CAPTION_GAP * 1280 >= 24);
}
{
  // 进出场：一个视频层，e 0 → 1 → 0；split 只平移不缩放；pip 收进圆窗、画面盖满圆窗
  const fps = 30;
  const T = transFrames(fps);
  check('进出场 10–12 帧', T >= 10 && T <= 12 && near(T / fps, TRANS_SEC, 0.02), String(T));
  const dur = 90;
  check('进场从 0 开始、走完是 1、出场回到 0', transProgress(0, dur, fps) === 0 && transProgress(T, dur, fps) === 1 && transProgress(45, dur, fps) === 1 && transProgress(dur, dur, fps) === 0);
  const mid = transProgress(T / 2, dur, fps);
  check('进场缓进缓出（中点 0.5）', near(mid, 0.5, 0.02), String(mid));
  const clips = [
    {startMs: 1000, endMs: 4000, mode: 'split'},
    {startMs: 4000, endMs: 7000, mode: 'split'},
    {startMs: 7000, endMs: 9000, mode: 'pip'},
    {startMs: 12000, endMs: 15000, mode: 'pip'},
  ];
  const e = edgesOf(clips, fps);
  check('首尾相接、摆法相同：中间不收放', e[0].exit === false && e[1].enter === false && e[1].exit === true && e[2].enter === true && e[2].exit === true && e[3].enter === true, JSON.stringify(e));
  check('不收放的那头一直是 1', transProgress(0, dur, fps, {enter: false, exit: true}) === 1);
  const W = 720;
  const H = 1280;
  const s0 = videoPlacement('split', W, H, 0, MOTION_FRAMING);
  const s1 = videoPlacement('split', W, H, 1, MOTION_FRAMING);
  check('split e=0 是全屏', s0.frame.y === 0 && s0.frame.height === H && s0.s === 1 && s0.ty === 0);
  check('split e=1：真人在下方 40%、不缩放、裁切往下挪了一点', near(s1.frame.y, 768) && s1.s === 1 && s1.ty < 768 / 2 && s1.ty > 768 * 0.4, JSON.stringify(s1));
  const p1 = videoPlacement('pip', W, H, 1, MOTION_FRAMING);
  const {d, margin} = pipOf(W, H, MOTION_PIP_K);
  check('pip e=1：裁切框就是圆窗', near(p1.frame.x, W - margin - d) && near(p1.frame.y, H - margin - d) && near(p1.frame.width, d) && near(p1.frame.radius, d / 2), JSON.stringify(p1.frame));
  const vx0 = p1.tx;
  const vy0 = p1.ty;
  const vx1 = p1.tx + p1.s * W;
  const vy1 = p1.ty + p1.s * H;
  check('pip e=1：画面盖满圆窗（不露黑边）', vx0 <= p1.frame.x && vy0 <= p1.frame.y && vx1 >= p1.frame.x + d && vy1 >= p1.frame.y + d, JSON.stringify({vx0, vy0, vx1, vy1}));
  check('pip e=1：脸放大了（比刚好盖满大 1.2 倍以上）', p1.s >= (d / W) * 1.2, String(p1.s));
  const f1 = videoPlacement('full', W, H, 1);
  check('full e=1：真人整个被面板盖住', near(f1.frame.y, H) && near(f1.frame.height, 0));
  check('面板：split / full 从上方推进来，pip 不动', panelOffset('split', 768, 0) === -768 && panelOffset('split', 768, 1) === 0 && panelOffset('pip', 1280, 0) === 0);
}
{
  // 装饰禁区：放出来的装饰（连漂动余量）不碰取景框外扩 48、字幕带、圆窗外扩 72；放不下就不放
  const bw = 1080;
  const bh = 1152;
  const focus = {x: 43, y: 205, width: 994, height: 790};
  const cap = {x: -bw, y: 1000, width: bw * 3, height: 152};
  const no = [inflate(focus, 48), cap];
  const specs = [
    {slot: 'tl', w: 367, h: 184},
    {slot: 'tr', w: 259, h: 140, at: 0},
    {slot: 'tm', w: 86, h: 86, at: 0.01},
    {slot: 'bl', w: 173, h: 173},
    {slot: 'br', w: 205, h: 205},
  ];
  const placed = specs.map((sp) => placeDecor(sp, bw, bh, no));
  check('split：顶上的装饰都放得下，且碰不到禁区', placed.slice(0, 3).every((p) => p && !no.some((r) => rectsHit(p.hit, r))), JSON.stringify(placed.slice(0, 3)));
  check('split：底下没地方（字幕带到框底）就不放', placed[3] === null && placed[4] === null, JSON.stringify(placed.slice(3)));
  check('装饰最多一半出画', placed.slice(0, 3).every((p, i) => p.y >= -0.5 * specs[i].h * p.s - 1e-6));
  // pip：圆窗在右下，左下角可以放，右下角不放
  const pbh = 1920;
  const circle = {x: 640, y: 1480, width: 375, height: 375};
  const pno = [inflate({x: 90, y: 192, width: 900, height: 1100}, 48), {x: -bw, y: 1390, width: bw * 3, height: 150}, inflate(circle, 72)];
  const bl = placeDecor({slot: 'bl', w: 173, h: 173}, bw, pbh, pno);
  const br = placeDecor({slot: 'br', w: 205, h: 205}, bw, pbh, pno);
  check('pip：左下角的装饰放在字幕下面、碰不到圆窗', bl && !pno.some((r) => rectsHit(bl.hit, r)), JSON.stringify(bl));
  check('pip：右下角紧挨圆窗，不放', br === null, JSON.stringify(br));
}
{
  // keyword 版面
  const a = keywordLayout({text: '花钱之前它会先给你报价', hot: '先给你报价'}, 993, 912);
  check('split：hot 单独一行、按宽度撑满（九成宽左右）、前面的字缩到 0.6 倍', a.stacked && a.lines.length === 2 && a.lines[1].text === '先给你报价' && a.lines[1].size * 5 >= 993 * 0.8 && near(a.lines[0].size / a.lines[1].size, 0.6, 0.05), JSON.stringify(a.lines));
  const b = keywordLayout({text: '花钱之前它会先给你报价', hot: '先给你报价'}, 900, 1100);
  check('pip：hot 拆两行再放大，字块占到框高一半以上', b.stacked && b.lines.length === 3 && b.blockH >= 1100 * 0.5 && b.blockH <= 1100 * 0.86 + 1, JSON.stringify(b));
  const c = keywordLayout({text: '它不会乱编数字', hot: '不会乱编'}, 900, 1100);
  check('7 个字拆两行（它不会 / 乱编数字），不把一个字单独成行', c.lines.length === 2 && c.lines[0].text === '它不会' && c.lines[1].text === '乱编数字' && c.lines[0].size >= 180, JSON.stringify(c.lines));
  check('每一行都在取景框宽度里', [a, b, c].every((L, i) => L.blockW <= [993, 900, 900][i] + 1));
  const cc = keywordLayout({text: '花钱之前，它会先给你报价', hot: '先给你报价'}, 993, 912);
  check('行尾标点不上屏', cc.lines.every((l) => !/[，、。,.]$/.test(l.text)), JSON.stringify(cc.lines));
}
{
  // 清单 / 步骤：竖长的框行高 225–330 参考像素（720 宽时 150–220 像素），整组在框里
  const g = listGeom(3, 900, 1150, true);
  check('pip 清单：行高 225–330、整组在框里', g.tall && g.rh >= 225 && g.rh <= 330 && g.y0 >= 0 && g.y0 + g.total <= 1150 && g.x0 >= 0 && g.x0 + g.contentW <= 900, JSON.stringify(g));
  const sg = listGeom(3, 993, 680, true);
  check('split 清单：整组在框里', !sg.tall && sg.y0 + sg.total <= 680 && sg.rh >= 60, JSON.stringify(sg));
  // 步骤打勾：下一步开口时打；最后一步 min(说完, 结束前 0.7 秒)，太晚就不打
  const ck = stepCheckTimes([0.3, 1.5, 2.8], 3.4, 4.6);
  check('步骤：每一步在下一步开口时打勾，最后一步在结束前 0.7 秒内打', near(ck[0], 1.5) && near(ck[1], 2.8) && near(ck[2], 3.4), JSON.stringify(ck));
  const late = stepCheckTimes([0.3, 1.5, 3.8], 4.4, 4.6);
  check('步骤：最后一步说得太晚就不打勾（不出半个徽章）', late[2] === null, JSON.stringify(late));
}
{
  // counter：金额不出中间价
  check('金额识别', isMoney('', '元') && isMoney('¥', '') && isMoney('', '块钱') && !isMoney('', '秒') && !isMoney('', '个'));
  const c = counterClock(2.4, true, 4, true);
  const vals = Array.from({length: 40}, (_, i) => counterValue(i * 0.1, c, 3.5, 7));
  check('金额有旧值：翻牌，屏幕上只有 7 和 3.5', c.how === 'flip' && vals.every((v) => v === 7 || v === 3.5) && near(counterValue(2.4, c, 3.5, 7), 3.5), JSON.stringify([...new Set(vals)]));
  const pop = counterClock(2.4, false, 4, true);
  check('金额没有旧值：落定前最多滚 0.6 秒', pop.how === 'pop' && pop.land - pop.start <= ROLL + 1e-9, JSON.stringify(pop));
  const cnt = counterClock(2.4, true, 4, false);
  check('计数有旧值：最多滚 0.6 秒', cnt.how === 'roll' && cnt.land - cnt.start <= ROLL + 1e-9, JSON.stringify(cnt));
}
{
  // 配色：完成徽章按风格取色，ink 只用黑白黄
  const wood = resolvePalette({look: 'wood'});
  const ink = resolvePalette({look: 'ink'});
  check('wood 徽章：暖橙底、正文色勾', badgeOf(wood).bg === '#FFB04A' && badgeOf(wood).fg === wood.ink, JSON.stringify(badgeOf(wood)));
  check('clay / paper 徽章：珊瑚、鼠尾草绿', resolvePalette({look: 'clay'}).good === '#FF9B78' && resolvePalette({look: 'paper'}).good === '#8FB9A8');
  check('ink 徽章：荧光黄底、黑描边、黑勾', badgeOf(ink).bg === '#FFD84A' && badgeOf(ink).border === ink.ink && badgeOf(ink).fg === ink.ink, JSON.stringify(badgeOf(ink)));
  check('ink 条目上色不用蓝灰', !shapeColors(ink).includes(ink.cool), JSON.stringify(shapeColors(ink)));
  check('compare 旧卡片不透明', /^#[0-9A-F]{6}$/i.test(oldCardOf(wood).face) && oldCardOf(wood).face === '#EFE4D2' && oldCardOf(resolvePalette({look: 'paper'})).face === '#EEE9E0');
}
{
  // keyword 段字幕不和大字重复
  check('字幕整句就是 keyword：不显示', captionMinusKeyword('花钱之前，它会先给你报价', '花钱之前它会先给你报价') === '');
  check('字幕比 keyword 多一截：只显示多出的', captionMinusKeyword('关键是，它不会乱编数字', '它不会乱编数字') === '关键是');
  check('keyword 八成的字都在字幕里：不显示', captionMinusKeyword('它绝不会乱编一个数字', '它不会乱编数字') === '');
  check('不相干的字幕照常显示', captionMinusKeyword('想试试就去搜精酿', '它不会乱编数字') === '想试试就去搜精酿');
}

if (failures.length) {
  console.log(`motion 单测：${passed} 过，${failures.length} 败`);
  failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  process.exit(1);
}
console.log(`motion 单测全过：${passed} 项`);
