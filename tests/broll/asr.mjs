#!/usr/bin/env node
// 本地转写（asr）的单测。几秒跑完，不下载模型、不调任何接口：
//   逐字时间夹具 → 切句 / 两行 / SRT 往返；静音切块；校对守门；模型下载（本机假服务器）；transcribeProject 的缓存路径；命令行退出码。
//   node tests/broll/asr.mjs
// 可选：用真模型跑一个视频（会用本机模型缓存，第一次会下载约 240MB；不做校对、不调接口）：
//   node tests/broll/asr.mjs --real <某个 talk.mp4>
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseSilences, planChunks} from '../../scripts/broll/asr/audio.mjs';
import {buildCues, cuesFromAsr, groupWords, layoutText, toSrt, toWords, twoLines, unitsOf, widthOf} from '../../scripts/broll/asr/cues.mjs';
import {applyFixes, buildFixMessages, formatFixesTxt, judgeFix, parseFixReply, pronounDiffs, pronounSlots, runFix} from '../../scripts/broll/asr/fix.mjs';
import {compareCuesLock, cuesLockOf} from '../../scripts/broll/asr/lock.mjs';
import {AsrModelError, asrCacheRoot, downloadOne, ensureModel, modelDirOf} from '../../scripts/broll/asr/models.mjs';
import {callLlm, extractJson, hasLlmKey, readLlmEnv, redact} from '../../scripts/broll/llm-client.mjs';
import {ROOT} from '../../scripts/broll/root.mjs';
import {parseSrt} from '../../scripts/broll/srt.mjs';
import {asrCachePath, parseArgs, parseTerms, srtSourceOf, transcribeProject} from '../../scripts/broll/transcribe.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures');
const TRANSCRIBE = path.join(ROOT, 'scripts', 'broll', 'transcribe.mjs');
const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name}：${detail}` : name);
};
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `得到 ${JSON.stringify(got)}，应为 ${JSON.stringify(want)}`);
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));
const quiet = () => {};
const tmpDir = (tag) => fs.mkdtempSync(path.join(os.tmpdir(), `brewreel-asr-test-${tag}-`));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const NO_KEY_ENV = {PATH: process.env.PATH || ''};

// ---------- 拼词 ----------
{
  const en = fixture('asr-talk-en.json');
  const words = toWords(en.tokens, en.times, en.breaks).map((w) => w.text);
  check('英文：块边界第一个 token 是新词（For 不粘到 picture 上）', words.includes('For') && words.includes('picture'), words.join(' '));
  check('英文：标点后的空白 token 之后是新词（quote / Nothing 分开）', words.includes('quote') && words.includes('Nothing') && !words.some((w) => /quoteNothing/.test(w)), words.join(' '));
  check('英文：BPE 片段拼成一个词（Brureel）', words.includes('Brureel'), words.join(' '));
  const num = fixture('asr-numbers-zh.json');
  const nw = toWords(num.tokens, num.times, num.breaks).map((w) => w.text);
  check('数字：小数点不当标点（3.5、0.9）', nw.includes('3.5') && nw.includes('0.9'), nw.join('|'));
  check('数字：百分号挂在数字上（20%）', nw.includes('20%'), nw.join('|'));
  check('数字：连续数字拼成一个词（2026）', nw.includes('2026'), nw.join('|'));
  eq('撇号和连字符接在英文词里', toWords(['▁I', '▁don', "'", 't', '▁know', '▁open', '-', 'source'], [0, 0.2, 0.3, 0.35, 0.5, 0.8, 0.9, 0.95]).map((w) => w.text), ['I', "don't", 'know', 'open-source']);
  const mixed = toWords(['我', '用', '▁Brew', 'Re', 'el', '做', '视', '频'], [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2]);
  eq('中英混排：英文词前后不加空格、不拆开', groupWords(mixed, 'zh').map((g) => g.map((w) => w.text).join('')), ['我用BrewReel做视频']);
}

// ---------- 切句（中文真口播夹具）----------
const zh = fixture('asr-talk-zh.json');
const zhOut = cuesFromAsr(zh, {lang: 'auto'});
{
  check('中文夹具走中文规则', zhOut.mode === 'zh');
  eq('中文夹具切成 7 句', zhOut.cues.map((c) => c.text), [
    '最近我在做一个开源项目叫精酿',
    '你录一段口播',
    '他会自己挑出哪几句适合配画面',
    '比如我说先把要做的事列出来',
    '这里就会插一段积木动画',
    '花钱之后，他先报价',
    '你点头了才生成',
  ]);
  const c = zhOut.cues;
  check('句尾标点去掉', c.every((x) => !/[，。！？、：；,.!?]$/.test(x.text)), c.map((x) => x.text).join(' / '));
  check('每句不超过 16 个字', c.every((x) => unitsOf(x.text, 'zh') <= 16));
  check('时间递增、不重叠、句间至少 40 毫秒', c.every((x, i) => x.endMs > x.startMs && (i === 0 || x.startMs >= c[i - 1].endMs + 40)), JSON.stringify(c.map((x) => [x.startMs, x.endMs])));
  check('每句至少 0.6 秒', c.every((x) => x.endMs - x.startMs >= 600));
  eq('终点贴到静音起点上（第 1、5 句）', [c[0].endMs, c[4].endMs], [4425, 18536]);
  check('起点比首字早（首字 0.54 秒前后）', c[0].startMs <= 600 && c[0].startMs >= 400, String(c[0].startMs));
  const lines = c.map((x) => layoutText(x.text, 'zh'));
  check('超过 10 个字断两行，每行不超过 12 字', lines.every((t, i) => (widthOf(c[i].text) > 10 ? t.split('\n').length === 2 : !t.includes('\n')) && t.split('\n').every((l) => widthOf(l) <= 12)), lines.join(' | '));
  eq('两行按词边界、不断在「哪」后面', lines[2], '他会自己挑出\n哪几句适合配画面');
  const srt = toSrt(c.map((x, i) => ({...x, text: lines[i]})));
  const back = parseSrt(srt);
  eq('SRT 能被 parseSrt 原样读回（句数、毫秒、两行文字）', back.map((x) => [x.id, x.startMs, x.endMs, x.text]), c.map((x, i) => [x.id, x.startMs, x.endMs, lines[i]]));
}

// ---------- 切句（英文、数字、过长、过久）----------
{
  const en = fixture('asr-talk-en.json');
  const out = cuesFromAsr(en, {lang: 'auto'});
  check('英文夹具走英文规则', out.mode === 'en');
  check('英文每句不超过 42 个字符', out.cues.every((c) => c.text.length <= 42), out.cues.map((c) => c.text).join(' / '));
  check('英文不手动换行', out.cues.every((c) => !layoutText(c.text, 'en').includes('\n')));
  check('英文没有粘连词', !out.cues.some((c) => /quoteNothing|pictureFor/.test(c.text)));
  check('英文句末 . 必断（picture. / For example 分开）', out.cues.some((c) => /need a picture$/.test(c.text)));
  const back = parseSrt(toSrt(out.cues));
  check('英文 SRT 往返', back.length === out.cues.length && back.every((b, i) => b.text === out.cues[i].text));

  const num = fixture('asr-numbers-zh.json');
  const nc = cuesFromAsr(num).cues.map((c) => c.text);
  check('数字留在句子里（3.5块钱、20%、0.9）', nc.some((t) => t.includes('3.5块钱')) && nc.some((t) => t.includes('20%')) && nc.some((t) => t.endsWith('0.9')), nc.join(' / '));

  // 24 个字没有标点：在均衡处拆开，每段不超过 16 字
  const long = '我们今天要讲的是怎么把一段口播视频变成带画面的成品短片';
  const tk = [...long];
  const lw = toWords(tk, tk.map((_, i) => 1 + i * 0.2));
  const lc = buildCues(lw, {mode: 'zh', audioEnd: 10});
  check('过长无标点：拆成每段不超过 16 字', lc.length >= 2 && lc.every((c) => unitsOf(c.text, 'zh') <= 16), lc.map((c) => c.text).join(' / '));
  check('过长无标点：拆得比较均衡', Math.abs(unitsOf(lc[0].text) - unitsOf(lc[lc.length - 1].text)) <= 6, lc.map((c) => c.text).join(' / '));
  // 8 个字说了 8 秒：超过 6 秒要拆
  const slow = toWords([...'慢慢地说八个字啊'], [0, 1, 2, 3, 4, 5, 6, 7]);
  const sc = buildCues(slow, {mode: 'zh', audioEnd: 9});
  check('超过 6 秒拆句', sc.length >= 2 && sc.every((c) => c.endMs - c.startMs <= 6800), JSON.stringify(sc.map((c) => [c.text, c.startMs, c.endMs])));
  // 长停顿断句
  const pause = toWords([...'第一句话说完了第二句开始'], [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 2.6, 2.8, 3.0, 3.2, 3.4]);
  eq('停顿超过 0.9 秒且满 4 字就断', buildCues(pause, {mode: 'zh'}).map((c) => c.text), ['第一句话说完了', '第二句开始']);
  // 逗号后短尾巴并进同一句
  const tail = toWords(['花', '钱', '之', '前', '，', '它', '先', '报', '价', '。'], [0, 0.2, 0.4, 0.6, 0.7, 0.9, 1.1, 1.3, 1.5, 1.6]);
  eq('逗号后短尾巴并进同一句', buildCues(tail, {mode: 'zh'}).map((c) => c.text), ['花钱之前，它先报价']);
  // 静音贴边：起点取前面 0.45 秒内的静音结束点
  const sw = toWords([...'你好世界'], [1.0, 1.2, 1.4, 1.6]);
  const sCue = buildCues(sw, {mode: 'zh', silences: [{start: 0, end: 0.7}, {start: 1.9, end: 3}], audioEnd: 3})[0];
  eq('静音贴边：起点取静音结束点、终点贴静音起点', [sCue.startMs, sCue.endMs], [700, 1900]);
}

// ---------- 两行 ----------
{
  eq('10 个字以内不断行', twoLines('你点头了才生成'), '你点头了才生成');
  eq('优先断在逗号后面', twoLines('你录一段口播，他会自己挑出'), '你录一段口播，\n他会自己挑出');
  const t = twoLines('最近我用BrewReel做了很多条视频');
  check('不拆英文单词', !/Brew\nReel|BrewRe\nel/.test(t) && t.split('\n').every((l) => widthOf(l) <= 12), t);
  check('行首不放标点', !twoLines('这是第一段话，然后是第二段话呀').split('\n')[1].startsWith('，'));
}

// ---------- 静音和切块 ----------
{
  const stderr = '[silencedetect @ 0x1] silence_start: 0\n[silencedetect @ 0x1] silence_end: 0.718 | silence_duration: 0.718\nsilence_start: 4.4\nsilence_end: 5.1 | x\nsilence_start: 25.2\n';
  eq('解析 silencedetect，最后一段用总长收尾', parseSilences(stderr, 25.7), [{start: 0, end: 0.718}, {start: 4.4, end: 5.1}, {start: 25.2, end: 25.7}]);
  eq('不超过 25 秒整段识别', planChunks(24.9, []), [0, 24.9]);
  const sil = [{start: 10, end: 10.4}, {start: 18, end: 19}, {start: 30, end: 30.3}, {start: 41, end: 42}, {start: 55, end: 55.2}];
  const cuts = planChunks(60, sil);
  const spans = cuts.slice(1).map((c, i) => c - cuts[i]);
  check('长音频在静音中点切开', cuts.slice(1, -1).every((c) => sil.some((s) => Math.abs((s.start + s.end) / 2 - c) < 1e-6)), JSON.stringify(cuts));
  check('每块不超过 25 秒、不短于 4 秒', spans.every((d) => d <= 25 + 1e-6 && d >= 4 - 1e-6), JSON.stringify(cuts));
  const hard = planChunks(60, []);
  const hs = hard.slice(1).map((c, i) => c - hard[i]);
  check('没有静音就硬切，每块不超过 25 秒、最后一块不短于 4 秒', hs.every((d) => d <= 25 + 1e-6 && d >= 4 - 1e-6), JSON.stringify(hard));
  const tailCut = planChunks(26, [{start: 25.3, end: 25.7}]);
  check('不切出太短的尾巴', tailCut.slice(1).every((c, i) => c - tailCut[i] >= 4 - 1e-6), JSON.stringify(tailCut));
}

// ---------- 校对守门 ----------
{
  const glossary = ['精酿', 'BrewReel'];
  const cases = [
    ['他会自己挑出哪几句适合配画面', {from: '他', to: '它'}, true],
    ['这里就会差一段积木动画', {from: '差', to: '插'}, true],
    ['这里就会拍一段积木动画', {from: '拍', to: '插'}, false],
    ['最近我在做一个开源项目叫经验', {from: '经验', to: '精酿'}, true],
    ['花钱之后它先报价', {from: '之后', to: '之前'}, false],
    ['这里就会插一段寂寞动画', {from: '寂寞', to: '积木'}, false],
    ['你点头了才生成', {from: '点头了才生成', to: '同意后再生成'}, false],
    ['一共花了三块五', {from: '三块五', to: '五块三'}, false],
    ['它不会自己花钱', {from: '不会', to: '会'}, false],
    ['an open source tool called Brureel', {from: 'Brureel', to: 'BrewReel'}, true],
    ['最近我来做一个开源项目', {from: '来', to: '在'}, false],
  ];
  for (const [text, fix, want] of cases) {
    const r = judgeFix(text, fix, glossary);
    check(`守门：${fix.from} → ${fix.to} ${want ? '自动改' : '只提示'}`, r.apply === want, r.why);
  }
  check('守门：原句里出现两次的不自动改', !judgeFix('他说他会来', {from: '他', to: '它'}).apply);
  check('守门：原句里没有的不改', !judgeFix('你好', {from: '他', to: '它'}).apply);
  check('守门：英文非名词表只提示', !judgeFix('there is a tool', {from: 'there', to: 'their'}).apply);
  check('守门：名词表也不放过否定词', !judgeFix('这个不行', {from: '不行', to: '精酿'}, glossary).apply);

  const cues = [
    {id: 'c1', text: '他和他们'},
    {id: 'c2', text: '在差一段话里拍一下'},
    {id: 'c3', text: '花钱之后它先报价'},
  ];
  const reply = {
    fixes: [
      {cue: 'c2', from: '在', to: '再'},
      {cue: 'c2', from: '差', to: '插'},
      {cue: 'c2', from: '话', to: '画'},
      {cue: 'c2', from: '拍', to: '派'},
      {cue: 'c9', from: '一', to: '二'},
    ],
    doubt: [{cue: 'c3', text: '之后', why: '上下文像之前'}],
  };
  const r = applyFixes(cues, reply, []);
  eq('落地：每句最多自动改 2 处', r.applied.map((a) => `${a.from}${a.to}`), ['差插', '话画']);
  eq('落地：改后的文字', r.cues[1].text, '在插一段画里拍一下');
  check('落地：反义字（再）只提示', r.hints.some((h) => h.from === '在' && /意思/.test(h.why)), JSON.stringify(r.hints));
  check('落地：超过 2 处的只提示', r.hints.some((h) => h.from === '拍' && /2 处/.test(h.why)), JSON.stringify(r.hints));
  check('落地：不存在的句子只提示', r.hints.some((h) => h.cue === 'c9'));
  check('落地：doubt 原样进提示', r.hints.some((h) => h.kind === 'doubt' && h.text === '之后'));
  check('落地：不改原数组', cues[1].text === '在差一段话里拍一下');

  const pr = parseFixReply('```json\n{"fixes":[{"cue":"c1","from":"他","to":"它"},{"cue":"x","from":"a","to":"b"},{"cue":"c2"}],"doubt":"bad"}\n```');
  eq('解析回复：去掉代码块、丢掉格式不对的条目', pr, {fixes: [{cue: 'c1', from: '他', to: '它'}], pronouns: [], doubt: []});
  const pp = parseFixReply('{"fixes":[],"pronouns":[{"id":"c3#1","refers":" 这个软件 ","person":false},{"id":"c4#1","refers":"我同事","person":"true"},{"id":"c5","person":false},{"id":"c6#1","refers":"x","person":"maybe"}],"doubt":[]}');
  eq('解析回复：代词清单（id 要带 #，person 认布尔和 "true"/"false"）', pp.pronouns, [
    {id: 'c3#1', refers: '这个软件', person: false},
    {id: 'c4#1', refers: '我同事', person: true},
  ]);
  let threw = false;
  try {
    parseFixReply('不是 JSON');
  } catch {
    threw = true;
  }
  check('解析回复：不是 JSON 就抛错', threw);

  const txt = formatFixesTxt({fix: {status: 'done', model: 'm', applied: r.applied, hints: r.hints}, notes: ['字幕里有阿拉伯数字']});
  check('talk.fixes.txt 有两栏和注意事项', txt.includes('已自动改（2 处）') && txt.includes('只提示，没改') && txt.includes('差 → 插') && txt.includes('「之后」拿不准') && txt.includes('阿拉伯数字'), txt);
}

// ---------- 代词（他/她 → 它）----------
{
  // 守门：fixes 里的代词补丁只认「他/她 → 它」
  const cases = [
    ['他会自己挑出哪几句', {from: '他', to: '它'}, true],
    ['他会自己挑出哪几句', {from: '他会', to: '它会'}, true],
    ['她每天提醒我喝水', {from: '她', to: '它'}, true],
    ['它说明天再来', {from: '它', to: '他'}, false],
    ['他说明天再来', {from: '他', to: '她'}, false],
    ['他不会自己花钱', {from: '他不会', to: '它不会'}, false],
    ['他花了三块钱', {from: '他花了三', to: '它花了三'}, false],
    ['他会自己挑出哪几句', {from: '他会', to: '它要'}, false],
  ];
  for (const [text, fix, want] of cases) {
    const r = judgeFix(text, fix);
    check(`代词守门：${text} ${fix.from} → ${fix.to} ${want ? '自动改' : '只提示'}`, r.apply === want, r.why);
  }
  check('代词守门：自动改的理由写明是代词', /代词/.test(judgeFix('他会自己挑出', {from: '他', to: '它'}).why));
  check('代词守门：两个「他」只给一个字还是不改', !judgeFix('他说他会来', {from: '他', to: '它'}).apply);
  eq('代词判断：pronounDiffs', [pronounDiffs('他会', '它会'), pronounDiffs('他说他', '它说它'), pronounDiffs('他会', '它要'), pronounDiffs('他', '他们')], [[0], [0, 2], null, null]);

  // 编号：每句里的「他」「她」按先后从 1 编，「它」不列
  const cues = [
    {id: 'c1', text: '最近我在做一个开源项目叫精酿'},
    {id: 'c2', text: '你录一段口播'},
    {id: 'c3', text: '他会自己挑出哪几句适合配画面'},
    {id: 'c4', text: '我同事说他和她都在用它'},
    {id: 'c5', text: '花钱之后，他先报价'},
  ];
  eq(
    '代词清单：编号和位置',
    pronounSlots(cues).map((s) => `${s.id}@${s.at}${s.ch}`),
    ['c3#1@0他', 'c4#1@4他', 'c4#2@6她', 'c5#1@5他'],
  );
  const [sys, user] = buildFixMessages(cues, ['精酿']).map((m) => m.content);
  check('提示词：单独点名代词这一类', sys.includes('他') && user.includes('二、代词') && user.includes('每一个都要回答'), user);
  check('提示词：代词清单逐个标出位置', user.includes('c3#1 〔他〕会自己挑出哪几句适合配画面') && user.includes('c4#2 我同事说他和〔她〕都在用它') && user.includes('c5#1 花钱之后，〔他〕先报价'), user);
  check('提示词：示例不和真实口播重样', !user.includes('"from":"他"') && !user.includes('"text":"之后"'), user);
  check('提示词：没有代词时写「（没有）」', buildFixMessages([{id: 'c1', text: '你好'}])[1].content.includes('代词清单：\n（没有）'));

  // 落地：指东西的改成「它」，指人的不动，说不清的只提示
  const reply = {
    fixes: [
      {cue: 'c3', from: '他会', to: '它会'}, // 清单里判断过：以清单为准，不重复改
      {cue: 'c4', from: '说他', to: '说它'}, // 清单说指人：不改
      {cue: 'c2', from: '录', to: '做'}, // 不同音：照旧只提示
    ],
    pronouns: [
      {id: 'c3#1', refers: '精酿这个开源项目', person: false},
      {id: 'c3#1', refers: '我', person: true}, // 同一个位置的第二条回答不认
      {id: 'c4#1', refers: '我同事', person: true},
      {id: 'c4#2', refers: '', person: false},
      {id: 'c5#1', refers: '精酿', person: false},
      {id: 'c9#1', refers: '不存在', person: false},
    ],
    doubt: [],
  };
  const r = applyFixes(cues, reply, ['精酿']);
  eq('代词落地：改后的文字', r.cues.map((c) => c.text).slice(2), ['它会自己挑出哪几句适合配画面', '我同事说他和她都在用它', '花钱之后，它先报价']);
  eq('代词落地：自动改的', r.applied.map((a) => `${a.cue} ${a.from}→${a.to} ${a.refers}`), ['c3 他→它 精酿这个开源项目', 'c5 他→它 精酿']);
  check('代词落地：理由带指代对象', r.applied[0].why.includes('精酿这个开源项目') && r.applied[0].why.includes('代词'), r.applied[0].why);
  check('代词落地：没说指什么的只提示', r.hints.some((h) => h.cue === 'c4' && h.from === '她' && h.to === '它' && /没说清/.test(h.why)), JSON.stringify(r.hints));
  check('代词落地：清单判断过的位置，fixes 里的同一处不再提示', !r.hints.some((h) => h.cue === 'c3' || (h.cue === 'c4' && h.from === '说他')), JSON.stringify(r.hints));
  eq('代词落地：提示只有两条（说不清的代词 + 不同音的字）', r.hints.map((h) => `${h.cue}${h.from}`), ['c4她', 'c2录']);
  check('代词落地：指代对象是「我」「你」这类的不改', !applyFixes([{id: 'c1', text: '他会来'}], {fixes: [], pronouns: [{id: 'c1#1', refers: '你', person: false}], doubt: []}).applied.length);

  // 清单漏了的位置：fixes 里的「他 → 它」照旧能落地；代词不占每句 2 处的名额
  const two = [{id: 'c1', text: '他在差一段话里拍他'}];
  const r2 = applyFixes(
    two,
    {
      fixes: [
        {cue: 'c1', from: '差', to: '插'},
        {cue: 'c1', from: '话', to: '画'},
        {cue: 'c1', from: '拍他', to: '拍它'},
      ],
      pronouns: [{id: 'c1#1', refers: '那台扫地机器人', person: false}],
      doubt: [],
    },
    [],
  );
  eq('代词：清单改的不占名额，fixes 的照旧最多 2 处', r2.cues[0].text, '它在插一段画里拍他');
  check('代词：清单漏掉的位置，fixes 里的代词补丁按普通补丁算名额', r2.hints.some((h) => h.from === '拍他' && /2 处/.test(h.why)), JSON.stringify(r2.hints));
  const r3 = applyFixes([{id: 'c1', text: '他会自己挑出哪几句'}], {fixes: [{cue: 'c1', from: '他', to: '它'}], pronouns: [], doubt: []});
  check('代词：清单没回答时，fixes 里的「他 → 它」照旧自动改', r3.cues[0].text === '它会自己挑出哪几句' && r3.applied.length === 1);

  // runFix：同一次请求里拿到代词判断，缓存里也留着
  const dir = tmpDir('pronoun');
  let calls = 0;
  const llm = async (messages) => {
    calls += 1;
    check('代词：只发一次请求，清单在请求里', messages.length === 2 && messages[1].content.includes('c1#1 〔他〕会自己挑出哪几句'));
    return {content: JSON.stringify({fixes: [], pronouns: [{id: 'c1#1', refers: '精酿', person: false}], doubt: []})};
  };
  const one = [{id: 'c1', text: '他会自己挑出哪几句'}, {id: 'c2', text: '我朋友说他也想试试'}];
  const f1 = await runFix({cues: one, cacheDir: dir, llm, model: 'fake', log: quiet});
  const f2 = await runFix({cues: one, cacheDir: dir, llm, model: 'fake', log: quiet});
  check('代词：runFix 改对、指人的没回答也不动', f1.status === 'done' && f1.cues[0].text === '它会自己挑出哪几句' && f1.cues[1].text === '我朋友说他也想试试', JSON.stringify(f1.cues));
  check('代词：复跑用缓存，结果一样', f2.status === 'cached' && calls === 1 && f2.cues[0].text === '它会自己挑出哪几句');
  const txt = formatFixesTxt({fix: {...f1, model: 'fake'}});
  check('代词：talk.fixes.txt 写明改了哪个、指的是什么', txt.includes('c1  他 → 它（代词：指「精酿」，不是人）'), txt);
  fs.rmSync(dir, {recursive: true, force: true});
}

// ---------- 校对调用（假模型，不联网）----------
{
  const cues = [{id: 'c1', text: '他会自己挑出哪几句'}, {id: 'c2', text: '花钱之后它先报价'}];
  const dir = tmpDir('fix');
  let calls = 0;
  const bad = async () => {
    calls += 1;
    return {content: '好的，下面是修改：他改成它'};
  };
  const r1 = await runFix({cues, cacheDir: dir, llm: bad, model: 'fake', log: quiet});
  check('校对：两次都不是 JSON 就跳过', r1.status === 'skipped' && calls === 2 && r1.cues === cues, JSON.stringify({status: r1.status, calls}));
  calls = 0;
  const flaky = async () => {
    calls += 1;
    return {content: calls === 1 ? '{bad json' : '{"fixes":[{"cue":"c1","from":"他","to":"它"},{"cue":"c2","from":"之后","to":"之前"}],"doubt":[]}'};
  };
  const r2 = await runFix({cues, cacheDir: dir, llm: flaky, model: 'fake', log: quiet});
  check('校对：第一次坏 JSON 重试一次后成功', r2.status === 'done' && calls === 2 && r2.cues[0].text === '它会自己挑出哪几句' && r2.cues[1].text === '花钱之后它先报价', JSON.stringify(r2));
  calls = 0;
  const r3 = await runFix({cues, cacheDir: dir, llm: flaky, model: 'fake', log: quiet});
  check('校对：同样的句子复跑用缓存，不再调接口', r3.status === 'cached' && calls === 0 && r3.applied.length === 1);
  const r4 = await runFix({cues, cacheDir: dir, llm: flaky, model: 'other-model', log: quiet});
  check('校对：换模型不用旧缓存', r4.status === 'done');
  const boom = async () => {
    throw new Error('HTTP 401 Bearer sk-abcdefghijklmnop');
  };
  const r5 = await runFix({cues: [{id: 'c1', text: '新的一句'}], cacheDir: dir, llm: boom, model: 'fake', log: quiet});
  check('校对：接口出错就跳过，报错里的密钥打码', r5.status === 'skipped' && !/abcdefghijklmnop/.test(r5.reason), r5.reason);
  fs.rmSync(dir, {recursive: true, force: true});
}

// ---------- 模型目录 ----------
{
  eq('缓存根目录：BREWREEL_ASR_DIR 优先', asrCacheRoot({BREWREEL_ASR_DIR: path.resolve('x-asr')}, 'win32'), path.resolve('x-asr'));
  eq('缓存根目录：Windows 用 LOCALAPPDATA', asrCacheRoot({LOCALAPPDATA: 'X:/L'}, 'win32'), path.join('X:/L', 'brewreel', 'asr'));
  eq('缓存根目录：mac/Linux 用 ~/.cache', asrCacheRoot({HOME: '/srv/u'}, 'linux'), path.join('/srv/u', '.cache', 'brewreel', 'asr'));
  eq('缓存根目录：设了 XDG_CACHE_HOME 就用它', asrCacheRoot({HOME: '/srv/u', XDG_CACHE_HOME: '/srv/c'}, 'darwin'), path.join('/srv/c', 'brewreel', 'asr'));
  const md = modelDirOf('sensevoice-int8-20240717', {BREWREEL_ASR_MODEL_DIR: path.resolve('manual')});
  check('BREWREEL_ASR_MODEL_DIR 直接用、不下载', md.manual === true && md.dir === path.resolve('manual'));
}

// ---------- 模型下载（本机假服务器）----------
const startServer = (routes) =>
  new Promise((resolve) => {
    const log = [];
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      log.push({path: url.pathname, range: req.headers.range || ''});
      const h = routes[url.pathname];
      if (!h) {
        res.writeHead(404);
        res.end();
        return;
      }
      h(req, res);
    });
    server.listen(0, '127.0.0.1', () => resolve({base: `http://127.0.0.1:${server.address().port}`, log, close: () => new Promise((d) => server.close(d))}));
  });
const serveBytes = (buf, {range = true} = {}) => (req, res) => {
  const m = /bytes=(\d+)-/.exec(req.headers.range || '');
  if (range && m) {
    const from = Number(m[1]);
    if (from >= buf.length) {
      res.writeHead(416);
      res.end();
      return;
    }
    res.writeHead(206, {'Content-Length': buf.length - from, 'Content-Range': `bytes ${from}-${buf.length - 1}/${buf.length}`});
    res.end(buf.subarray(from));
    return;
  }
  res.writeHead(200, {'Content-Length': buf.length});
  res.end(buf);
};
{
  const modelBuf = Buffer.alloc(300_000, 7);
  for (let i = 0; i < modelBuf.length; i += 997) modelBuf[i] = i % 251;
  const tokBuf = Buffer.from('<blk> 0\n你 1\n好 2\n', 'utf8');
  const spec = {
    id: 'test-model',
    files: {
      model: {name: 'model.int8.onnx', bytes: modelBuf.length, sha256: sha(modelBuf)},
      tokens: {name: 'tokens.txt', bytes: tokBuf.length, sha256: sha(tokBuf)},
    },
  };
  const wrong = Buffer.alloc(modelBuf.length, 1);
  const srv = await startServer({
    '/a/model.int8.onnx': (req, res) => {
      res.writeHead(500);
      res.end('boom');
    },
    '/a/tokens.txt': (req, res) => {
      res.writeHead(500);
      res.end('boom');
    },
    '/b/model.int8.onnx': serveBytes(wrong),
    '/b/tokens.txt': serveBytes(tokBuf),
    '/c/model.int8.onnx': serveBytes(modelBuf),
    '/c/tokens.txt': serveBytes(tokBuf),
    '/norange/model.int8.onnx': serveBytes(modelBuf, {range: false}),
  });
  const sources = ['a', 'b', 'c'].map((n) => ({name: `源${n}`, url: `${srv.base}/${n}/{file}`}));
  const root = tmpDir('model');
  const env = {BREWREEL_ASR_DIR: root};
  const lines = [];
  const r = await ensureModel('test-model', {spec, env, sources, log: (s) => lines.push(s)});
  const dir = path.join(root, 'test-model');
  check('下载：坏源（500）和哈希不对的源都跳过，最后一个源下好', r.downloaded && sha(fs.readFileSync(path.join(dir, 'model.int8.onnx'))) === spec.files.model.sha256, lines.join('\n'));
  check('下载：哈希不对的文件被删掉，不留 .part', !fs.existsSync(path.join(dir, 'model.int8.onnx.part')));
  check('下载：tokens 从第一个能用的源下', fs.readFileSync(path.join(dir, 'tokens.txt')).equals(tokBuf));
  check('下载：记下校验结果', Object.keys(JSON.parse(fs.readFileSync(path.join(dir, '.verified.json'), 'utf8'))).length === 2);
  const before = srv.log.length;
  const again = await ensureModel('test-model', {spec, env, sources, log: quiet});
  check('下载：第二次直接用缓存，不发请求', again.downloaded === false && srv.log.length === before);

  // 断点续传：先放一半 .part
  const root2 = tmpDir('resume');
  const dir2 = path.join(root2, 'test-model');
  fs.mkdirSync(dir2, {recursive: true});
  fs.writeFileSync(path.join(dir2, 'model.int8.onnx.part'), modelBuf.subarray(0, 100_000));
  const l2 = [];
  srv.log.length = 0;
  await ensureModel('test-model', {spec, env: {BREWREEL_ASR_DIR: root2}, sources: [sources[2]], log: (s) => l2.push(s)});
  check('续传：带 Range 请求剩下的部分', srv.log.some((x) => x.path === '/c/model.int8.onnx' && x.range === 'bytes=100000-'), JSON.stringify(srv.log));
  check('续传：拼起来哈希一致', sha(fs.readFileSync(path.join(dir2, 'model.int8.onnx'))) === spec.files.model.sha256 && l2.some((s) => s.includes('续传')), l2.join('\n'));

  // 服务器不认 Range（回 200）：从头写
  const dir3 = tmpDir('norange');
  const dest3 = path.join(dir3, 'model.int8.onnx');
  fs.writeFileSync(`${dest3}.part`, modelBuf.subarray(0, 50_000));
  await downloadOne(`${srv.base}/norange/model.int8.onnx`, dest3, spec.files.model, {log: quiet});
  check('不认 Range 的服务器：从头写，哈希一致', sha(fs.readFileSync(dest3)) === spec.files.model.sha256);

  // 全部失败：报错里列出所有地址和手动下载办法
  let err = null;
  try {
    await ensureModel('test-model', {spec, env: {BREWREEL_ASR_DIR: tmpDir('fail')}, sources: sources.slice(0, 2), log: quiet});
  } catch (e) {
    err = e;
  }
  check(
    '全部源失败：AsrModelError，列出地址、错误和手动下载办法',
    err instanceof AsrModelError && err.message.includes('/a/model.int8.onnx') && err.message.includes('/b/model.int8.onnx') && err.message.includes('HTTP 500') && err.message.includes('BREWREEL_ASR_MODEL_DIR') && err.message.includes('talk.srt'),
    err?.message,
  );
  // 手动目录里文件不对
  const man = tmpDir('manual');
  fs.writeFileSync(path.join(man, 'model.int8.onnx'), wrong);
  fs.writeFileSync(path.join(man, 'tokens.txt'), tokBuf);
  let err2 = null;
  try {
    await ensureModel('test-model', {spec, env: {BREWREEL_ASR_MODEL_DIR: man}, sources, log: quiet});
  } catch (e) {
    err2 = e;
  }
  check('手动目录文件不对：说清是哪个文件、怎么办', err2 instanceof AsrModelError && err2.message.includes('model.int8.onnx') && err2.message.includes('sha256'), err2?.message);
  await srv.close();
  for (const d of [root, root2, dir3, man]) fs.rmSync(d, {recursive: true, force: true});
}

// ---------- transcribeProject（走缓存，不需要模型）----------
const makeProject = (withCache = true) => {
  const dir = tmpDir('proj');
  const bytes = Buffer.from('not really a video, only used for the cache key');
  fs.writeFileSync(path.join(dir, 'talk.mp4'), bytes);
  if (withCache) {
    fs.mkdirSync(path.join(dir, '.brewreel'), {recursive: true});
    fs.writeFileSync(asrCachePath(dir, sha(bytes), 'sensevoice-int8-20240717', 'auto'), JSON.stringify(zh), 'utf8');
  }
  return dir;
};
{
  const missing = await transcribeProject(path.join(os.tmpdir(), 'brewreel-no-such-dir-xyz'), {log: quiet});
  check('缺目录：退出码 2', !missing.ok && missing.exitCode === 2);
  const empty = tmpDir('empty');
  const noMp4 = await transcribeProject(empty, {log: quiet});
  check('缺 talk.mp4：退出码 2，说怎么办', !noMp4.ok && noMp4.exitCode === 2 && noMp4.message.includes('talk.mp4'), noMp4.message);
  const badLang = await transcribeProject(empty, {lang: 'fr', log: quiet});
  check('--lang 不认识：退出码 2', !badLang.ok && badLang.exitCode === 2);
  fs.writeFileSync(path.join(empty, 'talk.srt'), '1\n00:00:00,000 --> 00:00:01,000\n我自己的字幕\n', 'utf8');
  const kept = await transcribeProject(empty, {log: quiet});
  check('已有 talk.srt：不覆盖、不需要 talk.mp4', kept.ok && kept.status === 'kept' && fs.readFileSync(path.join(empty, 'talk.srt'), 'utf8').includes('我自己的字幕'));
  check('用户自己放的字幕：来源是 user', srtSourceOf(empty) === 'user');
  fs.rmSync(empty, {recursive: true, force: true});

  const dir = makeProject();
  fs.writeFileSync(path.join(dir, 'talk.terms.txt'), '# 专有名词\n精酿\nBrewReel\n', 'utf8');
  const r = await transcribeProject(dir, {fix: false, terms: '精酿, 剪映', log: quiet});
  check('缓存命中：写出 talk.srt', r.ok && r.status === 'written' && r.cacheHit === true, JSON.stringify(r));
  const cues = parseSrt(fs.readFileSync(path.join(dir, 'talk.srt'), 'utf8'));
  eq('缓存命中：7 句，parseSrt 能读', cues.length, 7);
  eq('名词表合并去重（--terms + talk.terms.txt）', r.terms, ['精酿', '剪映', 'BrewReel']);
  check('--no-fix：talk.fixes.txt 写明没校对', fs.readFileSync(path.join(dir, 'talk.fixes.txt'), 'utf8').includes('--no-fix'));
  check('写了转写记录，来源是 auto', fs.existsSync(path.join(dir, '.brewreel', 'transcribe.json')) && srtSourceOf(dir) === 'auto');
  fs.appendFileSync(path.join(dir, 'talk.srt'), '\n', 'utf8');
  check('用户改过字幕：来源是 auto-edited', srtSourceOf(dir) === 'auto-edited');

  const again = await transcribeProject(dir, {fix: false, log: quiet});
  check('第二次不加 --force：不动', again.status === 'kept');

  let calls = 0;
  const llm = async (messages) => {
    calls += 1;
    check('校对提示里有句子清单和名词表', messages[1].content.includes('c3 他会自己挑出哪几句适合配画面') && messages[1].content.includes('精酿'));
    check('校对提示里有代词清单（这段口播的两个「他」）', messages[1].content.includes('c3#1 〔他〕会自己挑出哪几句适合配画面') && messages[1].content.includes('c6#1 花钱之后，〔他〕先报价'), messages[1].content);
    return {content: JSON.stringify({fixes: [{cue: 'c3', from: '他', to: '它'}, {cue: 'c6', from: '之后', to: '之前'}], doubt: [{cue: 'c6', text: '之后', why: '上下文像之前'}]})};
  };
  const f = await transcribeProject(dir, {force: true, llm, llmModel: 'fake-model', now: () => new Date(2026, 9, 5, 9, 30, 0), log: quiet});
  const srt = fs.readFileSync(path.join(dir, 'talk.srt'), 'utf8');
  check('--force：旧字幕改名备份', f.backupPath && path.basename(f.backupPath) === 'talk.srt.bak-20261005-093000' && fs.existsSync(f.backupPath), f.backupPath);
  check('校对：同音字自动改，反义词不改', srt.includes('它会自己挑出') && srt.includes('花钱之后') && !srt.includes('花钱之前'), srt);
  check('校对：只调一次接口', calls === 1);
  const fixes = fs.readFileSync(path.join(dir, 'talk.fixes.txt'), 'utf8');
  check('talk.fixes.txt：列出自动改的和只提示的', fixes.includes('c3  他 → 它') && fixes.includes('c6  之后 → 之前') && fixes.includes('「之后」拿不准'), fixes);
  eq('返回结构：fix 状态和计数', [f.fix.status, f.fix.applied.length, f.fix.hints.length], ['done', 1, 2]);

  const nokey = await transcribeProject(dir, {force: true, env: NO_KEY_ENV, now: () => new Date(2026, 9, 5, 9, 31, 0), log: quiet});
  check('没有 key：不校对、不报错', nokey.ok && nokey.fix.status === 'nokey' && fs.readFileSync(path.join(dir, 'talk.srt'), 'utf8').includes('他会自己挑出'));
  fs.rmSync(dir, {recursive: true, force: true});
}

// ---------- 命令行 ----------
{
  const run = (args) => spawnSync(process.execPath, [TRANSCRIBE, ...args], {encoding: 'utf8', windowsHide: true, env: NO_KEY_ENV});
  const a = run([]);
  check('命令行：不给目录退出 2 并打印用法', a.status === 2 && a.stdout.includes('用法'), a.stdout);
  check('命令行：不认识的参数退出 2', run(['x', '--bogus']).status === 2);
  check('命令行：目录不存在退出 2', run([path.join(os.tmpdir(), 'brewreel-no-such-dir-xyz')]).status === 2);
  const d = tmpDir('cli');
  fs.writeFileSync(path.join(d, 'talk.srt'), '1\n00:00:00,000 --> 00:00:01,000\n字幕\n', 'utf8');
  const k = run([d]);
  check('命令行：已有 talk.srt 退出 0 并提示 --force', k.status === 0 && k.stdout.includes('--force'), k.stdout);
  const p = makeProject();
  const w = run([p, '--no-fix']);
  check('命令行：缓存命中写出字幕，退出 0', w.status === 0 && fs.existsSync(path.join(p, 'talk.srt')) && w.stdout.includes('7 句'), w.stdout + w.stderr);
  eq('命令行参数解析', parseArgs(['d', '--lang', 'zh', '--terms', 'a,b', '--no-fix', '--force']), {dir: 'd', opts: {lang: 'zh', terms: 'a,b', fix: false, force: true, engine: 'local'}});
  eq('名词拆分：中英文逗号、顿号', parseTerms('精酿，BrewReel、剪映, 精酿'), ['精酿', 'BrewReel', '剪映']);
  fs.rmSync(d, {recursive: true, force: true});
  fs.rmSync(p, {recursive: true, force: true});
}

// ---------- 分句锁 ----------
{
  const srt = toSrt(zhOut.cues.map((c) => ({...c, text: layoutText(c.text, 'zh')})));
  const cues = parseSrt(srt);
  const lock = cuesLockOf(cues);
  eq('锁内容：句数和起止毫秒', [lock.count, lock.spans[0]], [7, [cues[0].startMs, cues[0].endMs]]);
  const edited = parseSrt(srt.replace('他会自己挑出', '它会自己挑出'));
  check('只改字：不算分句变化', compareCuesLock(lock, edited).ok);
  const merged = parseSrt(srt.replace(/\n\n2\n[^\n]+\n你录一段口播\n/, '\n你录一段口播\n'));
  const r1 = compareCuesLock(lock, merged);
  check('并句：句数变了要报，说清怎么改', !r1.ok && r1.problem.includes('7 句') && r1.fix.includes('llm_broll'), JSON.stringify(r1));
  const shifted = cues.map((c, i) => (i === 2 ? {...c, endMs: c.endMs + 300} : c));
  const r2 = compareCuesLock(lock, shifted);
  check('改了起止时间：指出第几句', !r2.ok && r2.where.includes('c3'), JSON.stringify(r2));
  check('没有锁文件：不拦', compareCuesLock(null, cues).ok);
}

// ---------- 共用的 LLM 调用层 ----------
{
  check('打码：Bearer 和 sk- 密钥', !/secret123|sk-abcdefghij/.test(redact('Bearer secret123 and sk-abcdefghijklmn')));
  eq('extractJson 去掉代码块和前后废话', extractJson('好的：\n```json\n{"a":1}\n```'), '{"a":1}');
  check('hasLlmKey 只看有没有', hasLlmKey({DEEPSEEK_API_KEY: 'x'}) && !hasLlmKey({}));
  eq('readLlmEnv 默认值', readLlmEnv({}), {key: '', base: 'https://api.deepseek.com', model: 'deepseek-flash'});
  let n = 0;
  let body = null;
  const fakeFetch = async (url, init) => {
    n += 1;
    body = JSON.parse(init.body);
    if (n === 1) return new Response('busy', {status: 503});
    return new Response(JSON.stringify({choices: [{message: {content: '{"ok":true}'}}], usage: {total_tokens: 3}}), {status: 200});
  };
  const out = await callLlm([{role: 'user', content: 'hi'}], {key: 'k', base: 'http://x/', model: 'm'}, {temperature: 0, fetchImpl: fakeFetch, retryDelayMs: 1, log: quiet});
  check('callLlm：5xx 重试后拿到内容', out.content === '{"ok":true}' && n === 2);
  check('callLlm：temperature 0、要求 JSON 输出', body.temperature === 0 && body.response_format?.type === 'json_object' && body.model === 'm');
}

// ---------- 可选：真模型 ----------
const realAt = process.argv.indexOf('--real');
if (realAt > 0) {
  const src = process.argv[realAt + 1];
  if (!src || !fs.existsSync(src)) {
    failures.push(`--real 后面要给一个存在的视频文件（${src || '没给'}）`);
  } else {
    const dir = tmpDir('real');
    fs.copyFileSync(src, path.join(dir, 'talk.mp4'));
    const t0 = Date.now();
    const r = await transcribeProject(dir, {fix: false, log: (s) => console.log(`  [real] ${s}`)});
    const cues = r.ok ? parseSrt(fs.readFileSync(r.srtPath, 'utf8')) : [];
    console.log(`  [real] ${r.ok ? `${cues.length} 句，用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒` : r.message}`);
    if (r.ok) console.log(fs.readFileSync(r.srtPath, 'utf8'));
    check('真模型：转写成功且至少一句', r.ok && cues.length > 0, r.message);
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

if (failures.length) {
  console.log(`asr 单测：通过 ${passed}，失败 ${failures.length}`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`asr 单测：全部通过（${passed} 项）`);
