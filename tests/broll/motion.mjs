#!/usr/bin/env node
// 动效画面（source:"motion"）的单测：摘词定位、数字解析、否定词、顺序、上屏字从原文拷、marks、模板搭配、舞台几何、时间重映射。
// 不渲染、不下载、不联网，几秒跑完。夹具只有文字和时间戳。
//   node tests/broll/motion.mjs
import {parseSrt} from '../../scripts/broll/srt.mjs';
import {
  LABELS,
  MOTION_TEMPLATES,
  TEMPLATES,
  checkAiQuantify,
  checkMotionSequence,
  cnToNum,
  describeTemplates,
  findNumbers,
  locate,
  norm,
  parseSay,
  spokenOf,
  toMotionProps,
  units,
  validateMotionClip,
} from '../../scripts/broll/motion.mjs';
import {SHOT_MAIN, stageOf, toComp} from '../../template/src/talk/motion/stage.ts';
import {END_PAD, makeWarp, warpKnots} from '../../template/src/talk/motion/warp.ts';

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
    const p = toMotionProps(r.plan, {theme: 'studio-graphite'});
    check('toMotionProps 时刻换成窗口内的秒数', p.kind === 'motion' && p.badge === false && p.theme === 'studio-graphite' && near(p.marks.items[0], (m[0] - r.plan.windowMs[0]) / 1000, 0.001) && p.startMs === r.plan.windowMs[0], JSON.stringify(p));
    check('toMotionProps 带 mode 和 lang', p.mode === 'split' && p.lang === 'zh');
  }
}
{
  const r = expectOk('checklist 正确写法', clip({id: 'b03', from: 'c4', to: 'c4', mode: 'full', job: 'list', template: 'checklist', slots: {title: '要准备的', items: ['口播视频', '预算']}}));
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

// ---------------- 舞台几何 ----------------
const inside = (r, f, eps = 0.5) => r.x >= f.left - eps && r.x + r.width <= f.right + eps && r.y >= f.top - eps && r.y + r.height <= f.bottom + eps;
{
  // 720×1280 split：上 60% 是框，字幕一行时贴在分界线上方
  const box = {x: 0, y: 0, width: 720, height: 768};
  const st = stageOf({box, compW: 720, compH: 1280, captionTop: 695, content: {x0: 150, x1: 930, y0: 597, y1: 1302}});
  check('split：内容放得下就不缩（k=1）', near(st.k, 1), JSON.stringify(st));
  check('split：内容在可用区里', inside(st.placed, st.free), JSON.stringify(st));
  check('split：不压字幕', st.placed.y + st.placed.height <= 695, JSON.stringify(st.placed));
  check('split：让开平台顶栏', st.placed.y >= (205 / 1920) * 1280 - 0.5, JSON.stringify(st.placed));
  const p = toComp(st, box, 150, 597);
  check('toComp 和 placed 对得上', near(p.x, st.placed.x, 0.01) && near(p.y, st.placed.y, 0.01), JSON.stringify(p));
  // 字幕三行：顶边上移，内容等比缩小
  const st3 = stageOf({box, compW: 720, compH: 1280, captionTop: 560, content: {x0: 150, x1: 930, y0: 597, y1: 1302}});
  check('split 三行字幕：缩小但不压字幕', st3.k < 1 && st3.placed.y + st3.placed.height <= 560 + 0.5 && inside(st3.placed, st3.free), JSON.stringify(st3));
  // 内容小（compare）时，三行字幕下也不必缩
  const stc = stageOf({box, compW: 720, compH: 1280, captionTop: 560, content: {x0: 150, x1: 944, y0: 731, y1: 1185}});
  check('split 三行字幕 + 小内容：不缩', near(stc.k, 1), JSON.stringify(stc));
}
{
  // 1080×1920 pip：圆窗在右下，主体在 205–1340 之间
  const box = {x: 0, y: 0, width: 1080, height: 1920};
  const face = {x: 696, y: 1536, width: 320, height: 320};
  const st = stageOf({box, compW: 1080, compH: 1920, captionTop: 1440, avoid: face, content: SHOT_MAIN});
  check('pip 竖版：主体在平台安全区里', st.placed.y >= 205 - 0.5 && st.placed.y + st.placed.height <= 1340 + 0.5, JSON.stringify(st.placed));
  const r = st.placed;
  const hitFace = Math.min(r.x + r.width, face.x + face.width) > Math.max(r.x, face.x) && Math.min(r.y + r.height, face.y + face.height) > Math.max(r.y, face.y);
  check('pip 竖版：不压圆窗', !hitFace, JSON.stringify(r));
  // 圆窗变大（版式按宽度缩放后）压进主体区时，内容让到圆窗上面
  const big = {x: 560, y: 1100, width: 460, height: 460};
  const st2 = stageOf({box, compW: 1080, compH: 1920, captionTop: 1440, avoid: big, content: SHOT_MAIN});
  check('pip 大圆窗：内容让到圆窗上沿以上', st2.placed.y + st2.placed.height <= big.y, JSON.stringify(st2.placed));
}
{
  // 横版 1920×1080 full：按高度缩，字幕在 0.75H
  const box = {x: 0, y: 0, width: 1920, height: 1080};
  const st = stageOf({box, compW: 1920, compH: 1080, captionTop: 810, content: {x0: 150, x1: 930, y0: 597, y1: 1302}});
  check('横版：按高度缩小、不压字幕、在框里', st.k < 1 && st.placed.y + st.placed.height <= 810 && inside(st.placed, st.free), JSON.stringify(st));
  check('横版：不按竖版平台栏留顶', st.free.top < 100, JSON.stringify(st.free));
}
{
  // 没有字幕层
  const box = {x: 0, y: 0, width: 720, height: 768};
  const st = stageOf({box, compW: 720, compH: 1280, captionTop: null, content: SHOT_MAIN});
  check('没有字幕：内容在框里', inside(st.placed, st.free) && st.placed.y + st.placed.height <= 768, JSON.stringify(st));
}

// ---------------- 时间重映射 ----------------
{
  const dur = 6;
  const anchors = [{real: 2.5, shot: 1.0, lead: 0.5}, {real: 4.0, shot: 2.0, lead: 0.5}];
  const w = makeWarp(anchors, dur);
  check('warp 锚点正好对上', near(w(2.5), 1.0) && near(w(4.0), 2.0), `${w(2.5)} ${w(4.0)}`);
  const samples = Array.from({length: 601}, (_, i) => w(i / 100));
  check('warp 单调不减', samples.every((v, i) => i === 0 || v >= samples[i - 1] - 1e-9));
  check('warp 起点 0、负数也是 0', w(0) === 0 && w(-1) === 0);
  check('warp 不超过 dur（不进退场尾巴）', samples.every((v) => v <= dur - END_PAD + 1e-9));
  // 事件前 lead 秒按 1:1 播（光点、滚动不被拉成慢动作）
  check('warp 事件前按 1:1 播', near(w(2.5) - w(2.0), 0.5, 1e-6), `${w(2.0)} ${w(2.5)}`);
  // 事件后 follow 秒按 1:1 播（弹跳播完），中间停住
  check('warp 入场按 1:1 播', near(w(0.3), 0.3, 1e-6), String(w(0.3)));
  const k = warpKnots(anchors, dur);
  check('warp 拐点真实秒严格递增', k.every((p, i) => i === 0 || p[0] > k[i - 1][0]), JSON.stringify(k));
  // 说得比镜头排得快：加速
  const fast = makeWarp([{real: 0.5, shot: 1.5, lead: 1.1}], 3);
  check('warp 说得快就加速', near(fast(0.5), 1.5) && near(fast(0.25), 0.75), `${fast(0.25)}`);
  // 不单调的锚点丢掉
  const bad = warpKnots([{real: 1, shot: 2}, {real: 2, shot: 1}], 5);
  check('warp 丢掉不单调的锚点', bad.length === 2 && bad[1][0] === 1 && bad[1][1] === 2, JSON.stringify(bad));
  // stretch：入场后不停住，匀速走到锚点（counter 没有旧值时不停在 0 上）
  const sw = makeWarp([{real: 3, shot: 1.5, lead: 1.1, stretch: true}], 4);
  const sv = Array.from({length: 31}, (_, i) => sw(i / 10));
  check('warp stretch 到锚点前一直在走、正好落在锚点', near(sw(3), 1.5) && sv.every((v, i) => i === 0 || v > sv[i - 1]), JSON.stringify(sv));
  // 最后一个锚点之后 1:1
  check('warp 最后一个锚点之后 1:1', near(w(5) - w(4.5), 0.5, 1e-6));
}

if (failures.length) {
  console.log(`motion 单测：${passed} 过，${failures.length} 败`);
  failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  process.exit(1);
}
console.log(`motion 单测全过：${passed} 项`);
