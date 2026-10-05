#!/usr/bin/env node
// v0.9 修复轮的单测：E2E 和审查找出来的问题，每条一组。半分钟内跑完，不下载模型、不联网、不花钱
// （便宜模型用本机的假接口；示例口播 mp4 没有就先生成，见 demo.mjs）。
//   node tests/broll/fixes.mjs
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {doubtsFromHints, openDoubts} from '../../scripts/broll/asr/doubts.mjs';
import {judgeFix} from '../../scripts/broll/asr/fix.mjs';
import {generateClips} from '../../scripts/broll/generate.mjs';
import {decidePaid, isFreeEntry, isPaidEntry} from '../../scripts/broll/ledger.mjs';
import {buildMessages, forceTop, parseArgs as parseLlmArgs} from '../../scripts/broll/llm_broll.mjs';
import {explainLlmError} from '../../scripts/broll/llm-client.mjs';
import {ffmpegCheck, ffmpegHelp, isMissingFeature, parseFfmpegList} from '../../scripts/broll/media.mjs';
import {locate, norm, parseSay, spokenOf, validateMotionClip} from '../../scripts/broll/motion.mjs';
import {buildPlan, extendMotionTails} from '../../scripts/broll/plan.mjs';
import {readStyles} from '../../scripts/broll/prompt.mjs';
import {ROOT, TEMPLATE} from '../../scripts/broll/root.mjs';
import {parseSrt} from '../../scripts/broll/srt.mjs';
import {formatReport, loadBanned, loadStyles, validateBroll} from '../../scripts/broll/validate.mjs';
import {nextCommand, parseTalkArgs} from '../../scripts/talk.mjs';
import {importTs} from './quiet-ts.mjs';
import {DEMO, MOTION_DEMO, ensureDemo} from './demo.mjs';
const {captionFor, pipCaptionPlacement} = await importTs('../../template/src/talk/layout.ts', import.meta.url);

const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name}：${String(detail).slice(0, 1500)}` : name);
};
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const clone = (x) => JSON.parse(JSON.stringify(x));
const cue = (i, startMs, endMs, text) => ({id: `c${i}`, index: i, startMs, endMs, text});
const STYLES = loadStyles();
const demoCues = () => parseSrt(fs.readFileSync(path.join(DEMO, 'talk.srt'), 'utf8'));
const motionDoc = () => readJson(path.join(MOTION_DEMO, 'broll.json'));
const MEDIA = {width: 1080, height: 1920, fps: 30, durationMs: 20000};
const errText = (r) => r.errors.map((e) => `${e.where}：${e.problem} → ${e.fix}`).join('\n');
const motionClip = (cues, over) => validateMotionClip({id: 'b01', from: 'c2', to: 'c2', source: 'motion', mode: 'full', plain: '测试', ...over}, cues, {durationMs: 20000});
const three = (t2, t3 = '中间一句') => [cue(1, 0, 1500, '开场'), cue(2, 2000, 5000, t2), cue(3, 5100, 8000, t3), cue(4, 9000, 10000, '结尾')];

// ───────── 完整版 ffmpeg：查得出精简版缺什么 ─────────
const ffmpegTests = () => {
  const lite = ' ... scale             V->V       Scale the input video size\n ... format            V->V       Convert\n ... concat            N->N       Concat\n';
  const enc = ' V....D libx264              libx264 H.264\n A....D aac                  AAC\n';
  check('解析 -filters 输出', [...parseFfmpegList(lite)].join() === 'scale,format,concat');
  const runner = (bin, args) => ({status: 0, stdout: args.includes('-filters') ? lite : enc});
  const r = ffmpegCheck({runner, bin: path.join(TEMPLATE, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe')});
  check('精简版：缺 setsar / tile / drawtext / blackdetect', !r.ok && r.bundled && ['setsar', 'tile', 'drawtext', 'blackdetect', 'color'].every((x) => r.missing.includes(x)), JSON.stringify(r));
  const help = ffmpegHelp(r);
  check('缺 ffmpeg 的说明：三种装法', help.includes('pip install imageio-ffmpeg') && help.includes('FFMPEG=') && help.includes('Remotion 自带的精简版'), help);
  check('认得出精简版的报错', isMissingFeature("No such filter: 'color'") && isMissingFeature("Error parsing filterchain 'scale=720:1280,setsar=1'") && !isMissingFeature('Invalid data found when processing input'));
  // 真机：现在用的 ffmpeg 够不够（开发机装了 imageio-ffmpeg）；Remotion 自带的那份一定不够
  const bundled = path.join(TEMPLATE, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
  if (fs.existsSync(bundled)) check('Remotion 自带的 ffmpeg 不够出片', !ffmpegCheck({bin: bundled}).ok);
  // talk.mjs / make-talk 一开头就停（FFMPEG 指向精简版）：不转写、不调模型
  if (fs.existsSync(bundled)) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-ff-'));
    fs.copyFileSync(path.join(DEMO, 'talk.mp4'), path.join(tmp, 'talk.mp4'));
    const env = {...process.env, FFMPEG: bundled};
    const t = spawnSync(process.execPath, ['scripts/talk.mjs', tmp, '--out', path.join(tmp, 'out')], {cwd: ROOT, encoding: 'utf8', env, windowsHide: true});
    check('talk.mjs 缺完整版 ffmpeg：开头就退出 2，没转写', t.status === 2 && t.stdout.includes('pip install imageio-ffmpeg') && !fs.existsSync(path.join(tmp, '.brewreel')), t.stdout);
    fs.copyFileSync(path.join(DEMO, 'talk.srt'), path.join(tmp, 'talk.srt'));
    fs.copyFileSync(path.join(MOTION_DEMO, 'broll.json'), path.join(tmp, 'broll.json'));
    const m = spawnSync(process.execPath, ['scripts/make-talk.mjs', tmp, '--out', path.join(tmp, 'out')], {cwd: ROOT, encoding: 'utf8', env, windowsHide: true});
    check('make-talk 缺完整版 ffmpeg：生成前退出 2', m.status === 2 && m.stdout.includes('imageio-ffmpeg') && !fs.existsSync(path.join(tmp, 'out', 'ledger.json')), m.stdout);
    fs.rmSync(tmp, {recursive: true, force: true});
  }
};

// ───────── 账本：换 provider 不互相覆盖 ─────────
const ledgerTests = async () => {
  const ph = {requestHash: 'h-old', taskId: 'placeholder-b01-abcd', provider: 'placeholder', status: 'approved', file: 'clips/b01.mp4'};
  check('占位片条目不算花过钱', isFreeEntry(ph) && !isPaidEntry(ph) && decidePaid(ph, 'h-new') === 'submit');
  check('老账本没写 provider：看 task id 前缀', isFreeEntry({taskId: 'local-b01-x', status: 'checked'}));
  const paid = {requestHash: 'h1', taskId: 'TASK-1', provider: 'minimax-h3', status: 'approved', file: 'clips/b01.mp4', costYuan: 2};
  check('付费条目', isPaidEntry(paid) && !isFreeEntry(paid) && decidePaid(paid, 'h2') === 'redo');
  // 付费片段在账本里时，用 placeholder 跑要停下，账本和片段都不动
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-led-'));
  fs.mkdirSync(path.join(tmp, 'clips'), {recursive: true});
  fs.writeFileSync(path.join(tmp, 'clips', 'b01.mp4'), 'PAID', 'utf8');
  const ledgerText = JSON.stringify({version: 1, clips: {b01: paid}}, null, 2);
  fs.writeFileSync(path.join(tmp, 'ledger.json'), ledgerText, 'utf8');
  let err = null;
  try {
    await generateClips({doc: {provider: 'placeholder', version: 2}, plan: {width: 180, height: 320, quality: '768P', clips: [{id: 'b01', source: 'ai', requestHash: 'h1', windowMs: [0, 3000], genSec: 4}]}, outDir: tmp, projectDir: tmp, log: () => {}});
  } catch (e) {
    err = e;
  }
  check('占位片不盖付费片段：退出 2', err?.exitCode === 2 && err.message.includes('--provider minimax-h3') && err.message.includes('换一个 --out'), err?.message);
  check('账本和片段都没动', fs.readFileSync(path.join(tmp, 'ledger.json'), 'utf8') === ledgerText && fs.readFileSync(path.join(tmp, 'clips', 'b01.mp4'), 'utf8') === 'PAID');
  fs.rmSync(tmp, {recursive: true, force: true});
};

// ───────── 动效：数字不许拼、否定往前多看、最接近的给整词、compare 不叫人对调 ─────────
const motionTests = () => {
  const say = (cues, slots, to = 'c2') => motionClip(cues, {to, job: 'quantify', template: 'counter', slots});
  const r1 = say(three('I made 2 30 second videos today'), {say: '230 second', label: 'videos today'});
  check('英文空格隔开的两个数不能拼成 230', r1.errors.some((e) => e.where === 'b01.slots.say'), errText(r1) || JSON.stringify(r1.plan?.screenText));
  const r1b = say(three('I made 2 30 second videos today'), {say: '2 30 second', label: 'videos today'});
  check('照抄带空格的也不行：隔开说的不是一个数', r1b.errors.some((e) => e.problem.includes('隔开')), errText(r1b));
  const r2 = say(three('价格是 20', '30天之后涨价'), {say: '2030天', label: '之后涨价'}, 'c3');
  check('跨句的两个数不能拼成 2030', r2.errors.length > 0, errText(r2) || JSON.stringify(r2.plan?.screenText));
  const r3 = say(three('我们试了 3\n5 分钟就好了'), {say: '35分钟', label: '就好了'});
  check('换行隔开的两个数不能拼成 35', r3.errors.length > 0, errText(r3) || JSON.stringify(r3.plan?.screenText));
  check('千分位逗号照样是一个数', say(three('一共 1,000 元'), {say: '1,000 元', label: '一共'}).errors.length === 0);
  check('parseSay：空格隔开是两个数', parseSay('2 30 second').error?.includes('2 个数'), JSON.stringify(parseSay('2 30 second')));
  check('norm：数字之间的空白留分隔', norm('2 30') !== norm('230') && norm('1,000') === norm('1000') && norm('乱编 数字') === norm('乱编数字'));

  const kw = (text, t) => motionClip(three(text), {job: 'stress', template: 'keyword', slots: {text: t}});
  for (const [sentence, quote, neg] of [
    ['这一步完全不用花钱', '花钱', '不用'],
    ['千万不要相信它给的数字', '相信它给的数字', '不要'],
    ['它不会乱编数字', '乱编数字', '不会'],
    ['它不会乱编数字，也不难用', '难用', '不'],
  ]) {
    const r = kw(sentence, quote);
    check(`否定：「${sentence}」摘「${quote}」要拦`, r.errors.some((e) => e.problem.includes(`「${neg}」`) && e.fix.includes(neg)), errText(r) || JSON.stringify(r.plan?.screenText));
  }
  check('否定：英文 Don\'t trust 摘 trust 要拦', kw("Don't trust the numbers it gives", 'trust the numbers').errors.some((e) => e.problem.includes("Don't")));
  check('否定：带上否定就能过', kw('它不会乱编数字', '不会乱编数字').errors.length === 0 && kw("Don't trust the numbers it gives", "Don't trust the numbers").errors.length === 0);
  check('否定：「特别好用」不是否定', kw('这个功能特别好用', '好用').errors.length === 0);
  check('否定：「非常好用」不是否定', kw('这个功能非常好用', '好用').errors.length === 0);
  const neg = say(three('现在不用两个小时了'), {say: '两个小时', label: '现在'});
  check('否定：数字前面有「不用」，counter 直接让换 keyword', neg.errors.some((e) => e.fix.includes('别用 counter') && e.fix.includes('不用')), errText(neg));
  const neg2 = say(three('现在不用两个小时了'), {say: '不用两个小时', label: '现在'});
  check('否定：把「不用」摘进 say 也不行', neg2.errors.some((e) => e.problem.includes('否定')), errText(neg2));

  const near = kw('花钱之前，它先报价', '花钱之后它先报价');
  check('最接近的：短句给整句、不切词、不带标点', near.errors.some((e) => e.fix.includes('原句里最接近的是「花钱之前它先报价」')), errText(near));
  const sp = spokenOf([cue(1, 0, 3000, '你要准备的只有两样东西：口播视频和预算')]);
  const far = locate('视频文件', sp);
  check('最接近的：长句扩到词边界', !far.ok && far.fix.includes('口播视频') && !far.fix.includes('：'), far.fix);

  const cmp = (sentence, left, right) => motionClip(three(sentence), {job: 'compare', template: 'compare', slots: {labels: 'old-new', left: [left], right: [right]}});
  const rev = cmp('现在一分钱不用，以前要花七块钱', '要花七块钱', '一分钱不用');
  check('compare 先说新的：报错不叫人换 labels', rev.errors.length > 0 && !errText(rev).includes('换 labels') && errText(rev).includes('别用 compare'), errText(rev));
  const swapped = cmp('现在一分钱不用，以前要花七块钱', '一分钱不用', '要花七块钱');
  check('compare 两栏对调（以前：一分钱不用）要拦', swapped.errors.some((e) => e.problem.includes('放反')), errText(swapped) || JSON.stringify(swapped.plan?.screenText));
  check('compare 先旧后新照常能过', cmp('以前要花七块钱，现在一分钱不用', '要花七块钱', '一分钱不用').errors.length === 0);
};

// ───────── 计划：动效段说完后多停一会儿；v2 哈希按这一段的风格 ─────────
const planTests = () => {
  const cues = [cue(1, 0, 1500, '开场'), cue(2, 2000, 4000, '一句话'), cue(3, 5000, 7000, '插一段积木动画'), cue(4, 8000, 9000, '中间一句'), cue(5, 12000, 13000, '结尾')];
  const doc = {version: 2, style: 'wood-blocks', provider: 'placeholder', quality: '768P', budgetYuan: 20, captions: 'add', keepFace: [], clips: [{id: 'b01', from: 'c3', to: 'c3', source: 'motion', mode: 'full', job: 'stress', template: 'keyword', plain: '积木动画', slots: {text: '插一段积木动画'}}]};
  const plan = buildPlan({doc, cues, media: {width: 1080, height: 1920, fps: 30, durationMs: 13500}, styles: STYLES});
  const c = plan.clips[0];
  const lastMs = Math.max(...c.motion.marksMs.chars);
  check('动效段尾巴延到下一句开口前', c.windowMs[1] > 7200 && c.windowMs[1] <= 8000 && c.windowMs[1] - lastMs >= 900 && c.motion.windowMs[1] === c.windowMs[1], JSON.stringify({w: c.windowMs, lastMs}));
  // 下一段挨得近：和下一段之间照样留够 1 秒
  const near = [{id: 'b01', source: 'motion', to: 'c3', windowMs: [4880, 7200], motion: {marksMs: {text: 7000}, windowMs: [4880, 7200]}}, {id: 'b02', source: 'ai', to: 'c4', windowMs: [7880, 9200]}];
  extendMotionTails(near, cues, 13500);
  check('不挤掉和下一段之间的 1 秒真人', near[0].windowMs[1] === 7200, JSON.stringify(near[0].windowMs));
  // 副风格的段：换主风格、提示词和参考图都不变时，请求哈希不变（不重新花钱）
  const base = {version: 2, style: 'wood-blocks', styleAlt: 'ink-sketch', provider: 'minimax-h3', quality: '768P', budgetYuan: 20, captions: 'add', keepFace: ['c5'], clips: clone(motionDoc().clips)};
  base.clips = [
    {...motionDoc().clips[1], id: 'b01', from: 'c3', to: 'c4', mode: 'full', job: 'demonstrate'},
    {...motionDoc().clips[1], id: 'b02', from: 'c6', to: 'c7', look: 'alt', job: 'compare', camera: 'pan-right'},
  ];
  const other = {...clone(base), style: 'paper-layers'};
  const pa = buildPlan({doc: base, cues: demoCues(), media: MEDIA, styles: STYLES});
  const pb = buildPlan({doc: other, cues: demoCues(), media: MEDIA, styles: STYLES});
  check('副风格段换主风格：哈希不变', pa.clips[1].prompt === pb.clips[1].prompt && pa.clips[1].requestHash === pb.clips[1].requestHash && pa.clips[0].requestHash !== pb.clips[0].requestHash);
};

// ───────── 校验：v1 老文件、横版加 burned、转写拿不准的字 ─────────
const validateTests = () => {
  const ctx = (over = {}) => ({cues: demoCues(), durationMs: 20000, width: 1080, height: 1920, styles: STYLES, banned: loadBanned(), projectDir: MOTION_DEMO, ...over});
  const v1 = {version: 1, style: 'wood-blocks', provider: 'placeholder', quality: '768P', budgetYuan: 20, captions: 'add', keepFace: ['c5'], clips: [{...motionDoc().clips[1], id: 'b01', from: 'c6', to: 'c7'}]};
  delete v1.clips[0].source;
  const r1 = validateBroll(v1, ctx());
  check('version 1 配新风格：报出来，并说升 v2 要重新花钱', r1.errors.some((e) => e.where === 'style' && e.fix.includes('version') && e.fix.includes('重新花钱')), formatReport(r1));
  const v1q = {...clone(v1), style: 'brick-diorama'};
  v1q.clips[0] = {...v1q.clips[0], job: 'quantify', from: 'c3', to: 'c4', place: '桌面', subject: '机器人', action: '把方块排好', end: '方块排成一行', camera: 'static'};
  const cuesNum = demoCues().map((c) => (c.id === 'c4' ? {...c, text: '整条视频只用了二十五秒'} : c));
  const r2 = validateBroll(v1q, ctx({cues: cuesNum}));
  check('version 1 报数的 AI 段：只提醒，不拦', !r2.errors.some((e) => e.where === 'b01.source') && r2.warnings.some((w) => w.where === 'b01.source'), formatReport(r2));
  const burned = {...motionDoc(), captions: 'burned'};
  burned.clips = burned.clips.map((c) => ({...c, mode: 'full'}));
  const r3 = validateBroll(burned, ctx({width: 1920, height: 1080}));
  check('横版加 burned：顶层一条说清楚，不再让人改 add', r3.errors.some((e) => e.where === 'captions' && e.fix.includes('none')) && !formatReport(r3).includes('把 captions 改成 add'), formatReport(r3));
  // 转写拿不准的字上了动效卡片
  const doubtDoc = clone(motionDoc());
  const doubts = [{cue: 'c3', frag: '列出来', to: null, why: '上下文像写出来'}];
  const warn = validateBroll(doubtDoc, ctx({doubts}));
  check('拿不准的字上卡片：人跑时只提醒', warn.errors.length === 0 && warn.warnings.some((w) => w.problem.includes('拿不准')), formatReport(warn));
  const strict = validateBroll(doubtDoc, ctx({doubts, doubtLevel: 'error'}));
  check('拿不准的字上卡片：给模型时拦下', strict.errors.some((e) => e.where === 'b01.slots' && e.fix.includes('AI 画面')), formatReport(strict));
  check('拿不准的字没上卡片：不报', validateBroll(doubtDoc, ctx({doubts: [{cue: 'c3', frag: '先把', to: null, why: 'x'}], doubtLevel: 'error'})).errors.length === 0);
};

// ───────── 转写疑点：记下来，人改过那一句就算核对过 ─────────
const doubtTests = () => {
  const cues = [cue(1, 0, 1000, '开场'), cue(6, 2000, 4000, '花钱之后，它先报价')];
  const list = doubtsFromHints([{cue: 'c6', kind: 'doubt', text: '之后', why: '上下文像之前'}, {cue: 'c9', kind: 'doubt', text: 'x', why: ''}, {cue: 'c6', kind: 'fix', from: '没有的字', to: 'y', why: ''}], cues);
  check('只记原句里真有的', list.length === 1 && list[0].frag === '之后' && list[0].cueText === '花钱之后，它先报价', JSON.stringify(list));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-doubt-'));
  fs.mkdirSync(path.join(tmp, '.brewreel'), {recursive: true});
  fs.writeFileSync(path.join(tmp, '.brewreel', 'transcribe.json'), JSON.stringify({doubts: list}), 'utf8');
  check('没动过：还算拿不准', openDoubts(tmp, cues).length === 1);
  check('人改过那一句：算核对过', openDoubts(tmp, [cues[0], {...cues[1], text: '花钱之前，它先报价'}]).length === 0);
  check('只换了行：还算拿不准', openDoubts(tmp, [cues[0], {...cues[1], text: '花钱之后，\n它先报价'}]).length === 1);
  fs.rmSync(tmp, {recursive: true, force: true});
};

// ───────── 校对：专有名词不再免查读音和反义 ─────────
const fixTests = () => {
  const T = ['精酿', 'BrewReel'];
  check('名词：读音差得远只提示（工具 → 精酿）', !judgeFix('这个工具很好用', {from: '工具', to: '精酿'}, T).apply);
  check('名词：借名词改反义字只提示（之前 → 精酿后）', !judgeFix('花钱之前它先报价', {from: '之前', to: '精酿后'}, T).apply);
  check('名词：读音接近照样自动改（经验 → 精酿）', judgeFix('最近我在做一个开源项目叫经验', {from: '经验', to: '精酿'}, T).apply);
  check('名词：英文名词免查读音', judgeFix('a tool called Brureel', {from: 'Brureel', to: 'BrewReel'}, T).apply);
};

// ───────── 便宜模型的提示：疑点、横版、--max-ai ─────────
const promptTests = () => {
  const styles = readStyles();
  const skill = fs.readFileSync(path.join(ROOT, 'broll', 'SKILL-broll.md'), 'utf8');
  const cuesText = fs.readFileSync(path.join(DEMO, 'talk.srt'), 'utf8');
  const flags = (over = {}) => ({...parseLlmArgs(['x']).flags, ...over});
  const withDoubt = buildMessages({skill, cuesText, picture: '竖版', flags: flags(), styles, doubts: [{cue: 'c6', frag: '之后', to: null, why: '上下文像之前'}]})[1].content;
  check('提示里点名拿不准的字', withDoubt.includes('## 转写拿不准的字') && withDoubt.includes('c6「之后」拿不准'));
  const wide = buildMessages({skill, cuesText, picture: '横版', flags: flags(), styles, vertical: false})[1].content;
  const examples = wide.split('## 正确示例 1')[1].split('## 这次必须遵守')[0];
  check('横版：示例里没有 split，规则只写 full / pip', !examples.includes('"split"') && wide.includes('mode 只写 full 或 pip'), examples.slice(0, 800));
  const zero = buildMessages({skill, cuesText, picture: '竖版', flags: flags({'max-ai': '0'}), styles})[1].content;
  check('--max-ai 0：示例里没有 AI 段、没有示例 2', !zero.split('## 正确示例 1')[1].includes('"source": "ai"') && !zero.includes('## 正确示例 2'));
  const one = buildMessages({skill, cuesText, picture: '竖版', flags: flags({'max-ai': '1'}), styles})[1].content;
  const ex2 = one.split('## 正确示例 2')[1].split('## 这次必须遵守')[0];
  check('--max-ai 1：示例 2 只有一段 AI', (ex2.match(/"source": "ai"/g) ?? []).length === 1 && !ex2.includes('styleAlt'), ex2);
  const hard = skill.split(/\r?\n/).filter((l) => /最多 2 段|超过 2 段/.test(l) && !/默认|--max-ai|这次最多/.test(l));
  check('SKILL 里写 2 段的地方都注明「默认、--max-ai 可改」', !hard.length && skill.includes('--max-ai'), hard.join(' / '));
  const f = forceTop({version: 1, style: 'x', provider: 'minimax-h3', quality: '2K', budgetYuan: 99, captions: 'add', clips: []}, {style: 'wood-blocks', budget: '20', captions: 'burned'});
  check('顶层字段按命令行改回来（version 不动，让校验报）', f.doc.captions === 'burned' && f.doc.version === 1 && Object.keys(f.doc)[0] === 'version' && f.doc.provider === 'placeholder' && f.doc.budgetYuan === 20 && f.changed.includes('captions'), JSON.stringify(f));
  check('接口报错的人话', explainLlmError('接口报错 HTTP 401：x').includes('key') && explainLlmError('接口报错 HTTP 402：x').includes('余额') && explainLlmError('接口调用失败：TypeError: fetch failed').includes('网络'));
};

// ───────── talk.mjs：一次性参数不进「下一条命令」 ─────────
const talkTests = () => {
  check('--rewrite-broll 和 --yes 不能一起用', parseTalkArgs(['p', '--out', 'o', '--rewrite-broll', '--yes']).error?.includes('估价'));
  const argv = ['proj', '--out', 'out', '--provider', 'minimax-h3', '--only', 'b03', '--rewrite-broll', '--force-redo'];
  const next = nextCommand(argv, {addYes: true});
  check('下一条命令去掉 --only / --rewrite-broll / --force-redo，补 --yes', next === 'node scripts/talk.mjs proj --out out --provider minimax-h3 --yes', next);
  check('带空格的路径加引号', nextCommand(['my proj', '--out', 'o']).includes('"my proj"'));
};

// ───────── 版式：pip 不出单字行 ─────────
const layoutTests = () => {
  const t = '比如我说先把\n哪几句适合配画面';
  const pl = pipCaptionPlacement(720, 1280, [t]);
  const box = captionFor('pip', 720, 1280, t, pl);
  check('pip 720：八个字的一行不折出单字', box.lines === 2, JSON.stringify(box));
  const long = '这一句很长很长要十个字\n第二行';
  check('pip 720：放不下就挪到圆窗上方、用满宽度', pipCaptionPlacement(720, 1280, [long]) === 'above' && captionFor('pip', 720, 1280, long, 'above').width === captionFor('full', 720, 1280, long).width);
  const above = captionFor('pip', 720, 1280, long, 'above');
  check('pip 上方的字幕不压圆窗', above.y + above.lines * Math.round(above.fontSize * 1.2) <= 1280 - 43 - 213, JSON.stringify(above));
  const twelve = captionFor('full', 1080, 1920, '一二三四五六七八九十一二\n短');
  check('full：12 个字的一行缩一点字号，不折行', twelve.lines === 2 && twelve.fontSize < 72 && twelve.fontSize >= 72 * 0.8, JSON.stringify(twelve));
  check('pip 横版照旧放圆窗左边', pipCaptionPlacement(1920, 1080, [t]) === 'side');
  const adapt = fs.readFileSync(path.join(TEMPLATE, 'src', 'talk', 'motion', 'adapt.ts'), 'utf8');
  const counter = fs.readFileSync(path.join(TEMPLATE, 'src', 'shots', 'counter.tsx'), 'utf8');
  check('口播 counter 不画算出来的降幅', adapt.includes('hideDelta: true') && counter.includes('!p.hideDelta'));
};

// ───────── llm_broll：草稿、备份、接口失败（本机假接口） ─────────
const llmCliTests = async () => {
  let mode = 'bad';
  const good = JSON.stringify(motionDoc());
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      if (mode === '401') {
        res.writeHead(401, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: {message: 'Authentication Fails'}}));
        return;
      }
      const content = mode === 'good' ? good : JSON.stringify({version: 2, clips: [{id: 'b01', from: 'c3', to: 'c3', source: 'motion', template: 'keyword', job: 'stress', mode: 'full', plain: '错的', slots: {text: '原句里没有的字'}}]});
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({choices: [{message: {content}}], usage: {prompt_tokens: 1, completion_tokens: 1}}));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const env = {...process.env, LLM_API_KEY: 'sk-test-0000000000', DEEPSEEK_API_KEY: '', LLM_BASE_URL: `http://127.0.0.1:${port}`, LLM_MODEL: 'fake'};
  const run = (dir) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, ['scripts/broll/llm_broll.mjs', dir], {cwd: ROOT, env, windowsHide: true});
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
      child.on('close', (code) => resolve({code, out}));
    });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-llm-'));
  fs.copyFileSync(path.join(DEMO, 'talk.mp4'), path.join(tmp, 'talk.mp4'));
  fs.copyFileSync(path.join(DEMO, 'talk.srt'), path.join(tmp, 'talk.srt'));
  try {
    mode = '401';
    const a = await run(tmp);
    check('接口 401：退出 4，说 key 的事，不留 broll.json', a.code === 4 && a.out.includes('key') && !fs.existsSync(path.join(tmp, 'broll.json')), a.out.slice(-600));
    const original = '{"version": 2, "note": "用户手改过的"}\n';
    fs.writeFileSync(path.join(tmp, 'broll.json'), original, 'utf8');
    mode = 'bad';
    const b = await run(tmp);
    check('重写 3 轮没过：原来的 broll.json 不动，最后一版在草稿', b.code === 1 && fs.readFileSync(path.join(tmp, 'broll.json'), 'utf8') === original && fs.existsSync(path.join(tmp, 'broll.llm-draft.json')), b.out.slice(-600));
    mode = 'good';
    const c = await run(tmp);
    const baks = fs.readdirSync(tmp).filter((f) => f.startsWith('broll.json.bak-'));
    check('重写通过：换成新的，旧的留备份，分句锁落地', c.code === 0 && readJson(path.join(tmp, 'broll.json')).clips.length === 2 && baks.length === 1 && fs.readFileSync(path.join(tmp, baks[0]), 'utf8') === original && fs.existsSync(path.join(tmp, '.brewreel', 'cues.lock.json')) && !fs.existsSync(path.join(tmp, 'broll.llm-draft.json')), c.out.slice(-600));
  } finally {
    server.close();
    fs.rmSync(tmp, {recursive: true, force: true});
  }
};

const main = async () => {
  const t0 = Date.now();
  ensureDemo();
  for (const fn of [ffmpegTests, ledgerTests, motionTests, planTests, validateTests, doubtTests, fixTests, promptTests, talkTests, layoutTests, llmCliTests]) {
    try {
      await fn();
    } catch (e) {
      failures.push(`${fn.name} 抛错：${e?.stack || e}`);
    }
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (failures.length) {
    console.log(`修复轮单测：失败 ${failures.length}，通过 ${passed}（${sec} 秒）`);
    for (const f of failures) console.log(`- ${f}`);
    process.exit(1);
  }
  console.log(`修复轮单测：全部通过（${passed} 项，${sec} 秒）`);
};

main();
