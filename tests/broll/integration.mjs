#!/usr/bin/env node
// v0.9 集成测试：动效段、多风格 v2、转写接入、归一化、计费显示、版式修复、一条命令。几秒跑完。
// 不下载模型、不联网、不花钱（用到 ffmpeg 合成一段 1 秒的小视频；示例口播 mp4 没有就先生成，见 demo.mjs）。
//   node tests/broll/integration.mjs
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cuesLockOf} from '../../scripts/broll/asr/lock.mjs';
import {tokensFromAsr} from '../../scripts/broll/asr/tokens.mjs';
import {generateClips} from '../../scripts/broll/generate.mjs';
import {sha256File} from '../../scripts/broll/hash.mjs';
import {buildMessages, parseArgs as parseLlmArgs} from '../../scripts/broll/llm_broll.mjs';
import {ffmpeg, probeMedia} from '../../scripts/broll/media.mjs';
import {toMotionProps} from '../../scripts/broll/motion.mjs';
import {normalizeArgs, normalizeReasons, normalizeTalk, normalizedMediaOf, targetFpsOf} from '../../scripts/broll/normalize.mjs';
import {aiClipsOf, buildPlan} from '../../scripts/broll/plan.mjs';
import {costLine, creditsOf, isSubscriptionKey, keyKindOf} from '../../scripts/broll/prices.mjs';
import {readStyles} from '../../scripts/broll/prompt.mjs';
import {brollAiSha256, checkReview, writeApproval} from '../../scripts/broll/review.mjs';
import {ROOT} from '../../scripts/broll/root.mjs';
import {parseSrt} from '../../scripts/broll/srt.mjs';
import {formatReport, loadBanned, loadProject, loadStyles, validateBroll} from '../../scripts/broll/validate.mjs';
import {parseTalkArgs} from '../../scripts/talk.mjs';
import {importTs} from './quiet-ts.mjs';
import {ensureDemo} from './demo.mjs';
const {captionLinesFor, layoutOf, pipOf} = await importTs('../../template/src/talk/layout.ts', import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.join(ROOT, 'examples', 'talk', 'demo');
const MOTION = path.join(ROOT, 'examples', 'talk', 'motion');
const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name}：${String(detail).slice(0, 1200)}` : name);
};
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const clone = (x) => JSON.parse(JSON.stringify(x));
const demoCues = () => parseSrt(fs.readFileSync(path.join(DEMO, 'talk.srt'), 'utf8'));
const motionDoc = () => readJson(path.join(MOTION, 'broll.json'));
const STYLES = loadStyles();
const ctxOf = (over = {}) => ({cues: demoCues(), durationMs: 20000, width: 1080, height: 1920, styles: STYLES, banned: loadBanned(), projectDir: MOTION, ...over});
const errorsOf = (doc, over) => {
  const r = validateBroll(doc, ctxOf(over));
  return {r, text: formatReport(r)};
};
const expectErr = (name, doc, needles, over = {}) => {
  const {r, text} = errorsOf(doc, over);
  const miss = needles.filter((n) => !text.includes(n));
  check(name, r.errors.length > 0 && text.includes('怎么改') && !miss.length, miss.length ? `${text}\n缺：${miss.join('、')}` : text);
  return r;
};
const expectOk = (name, doc, over = {}) => {
  const {r, text} = errorsOf(doc, over);
  check(name, r.errors.length === 0 && !r.budgetExceeded, text);
  return r;
};
const cue = (i, startMs, endMs, text) => ({id: `c${i}`, index: i, startMs, endMs, text});
const MEDIA = {width: 1080, height: 1920, fps: 30, durationMs: 20000};

// ───────── 版式：pip 按宽度缩放、split 字幕按行数留高 ─────────
const layoutTests = () => {
  const p1080 = pipOf(1080, 1920);
  const p720 = pipOf(720, 1280);
  const pWide = pipOf(1920, 1080);
  const pWide720 = pipOf(1280, 720);
  check('pip 1080 竖版和 v0.8 一样', p1080.d === 320 && p1080.margin === 64, JSON.stringify(p1080));
  check('pip 720 竖版按宽度缩放', p720.d === 213 && p720.margin === 43, JSON.stringify(p720));
  check('pip 横版 1920 和 v0.8 一样', pWide.d === 260 && pWide.margin === 64, JSON.stringify(pWide));
  check('pip 横版 1280 按宽度缩放', pWide720.d === 173 && pWide720.margin === 43, JSON.stringify(pWide720));
  const lay720 = layoutOf('pip', 720, 1280);
  check('pip 720 圆窗贴右下', lay720.face.x + lay720.face.width + p720.margin === 720 && lay720.face.y + lay720.face.height + p720.margin === 1280, JSON.stringify(lay720.face));
  check('pip 720 字幕不进圆窗', lay720.caption.x + lay720.caption.width <= lay720.face.x, JSON.stringify(lay720.caption));
  const one = layoutOf('split', 1080, 1920, 1).caption;
  const two = layoutOf('split', 1080, 1920, 2).caption;
  const face = layoutOf('split', 1080, 1920).face;
  const block = Math.round(one.fontSize * 1.2);
  check('split 两行字幕往上多留一行', one.y - two.y === block && two.y + 2 * block <= face.y, `${one.y} ${two.y} ${face.y}`);
  check('split 一行字幕和 v0.8 一样', layoutOf('split', 1080, 1920).caption.y === one.y);
  check('字幕行数：换行符算一行', captionLinesFor('split', 720, 1280, '比如我说先把\n要做的事列出来') === 2 && captionLinesFor('split', 720, 1280, '你录一段口播') === 1);
  check('字幕行数：太长会折行', captionLinesFor('full', 1080, 1920, '这一句特别特别长长到一行肯定放不下的字幕要折成三行') === 3);
  const full = layoutOf('full', 720, 1280, 3).caption;
  check('full 不受行数影响', full.y === Math.round(1280 * 0.75));
};

// ───────── 计费显示 ─────────
const billingTests = () => {
  check('订阅 key 前缀', isSubscriptionKey('sk-cp-abc') && !isSubscriptionKey('sk-abc') && !isSubscriptionKey(''));
  check('key 种类只看前缀', keyKindOf({MINIMAX_API_KEY: 'sk-cp-xyz'}) === 'subscription' && keyKindOf({MINIMAX_API_KEY: 'eyJ'}) === 'payg' && keyKindOf({}) === 'none');
  check('积分估算 768P', creditsOf('768P', 5) === 350 && creditsOf('2K', 5) === null);
  const sub = costLine({provider: 'minimax-h3', quality: '768P', genSec: 9, yuan: 4.5, kind: 'subscription'});
  check('订阅 key 显示积分和秒数', sub.includes('9 秒') && sub.includes('约 630 积分') && sub.includes('订阅 key') && sub.includes('以 MiniMax 后台为准') && sub.includes('4.5 元'), sub);
  const payg = costLine({provider: 'minimax-h3', quality: '768P', genSec: 9, yuan: 4.5, kind: 'payg'});
  check('按量 key 显示秒数和元', payg.includes('9 秒') && payg.includes('4.5 元') && !payg.includes('积分'), payg);
  const k2 = costLine({provider: 'minimax-h3', quality: '2K', genSec: 5, yuan: 4, kind: 'subscription'});
  check('2K 不瞎估积分', k2.includes('没实测') && !/约 \d+ 积分/.test(k2), k2);
  const doc = {...motionDoc(), provider: 'minimax-h3'};
  const r = validateBroll(doc, ctxOf({keyKind: 'subscription'}));
  const text = formatReport(r);
  check('校验报告带积分', r.errors.length === 0 && text.includes('积分') && text.includes('AI 视频共 5 秒') && r.estimateYuan === 2.5, text);
  const over = validateBroll({...doc, budgetYuan: 1}, ctxOf({keyKind: 'subscription'}));
  check('预算闸门仍按元拦', over.budgetExceeded && formatReport(over).includes('超过预算'), formatReport(over));
};

// ───────── 校验：动效段、风格 v2、AI 段报数 ─────────
const validateTests = () => {
  expectOk('正例：v2 动效 + AI', motionDoc());
  const v1 = {...motionDoc(), version: 1};
  expectErr('v1 不能写动效段', v1, ['version 2']);
  const doc = motionDoc();
  expectErr('source 写错', {...doc, clips: [{...doc.clips[0], source: 'video'}, doc.clips[1]]}, ['source', '不在可选值']);
  expectErr('动效段写 place', {...doc, clips: [{...doc.clips[0], place: '桌面'}, doc.clips[1]]}, ['motion 段不写']);
  expectErr('AI 段写 template', {...doc, clips: [doc.clips[0], {...doc.clips[1], template: 'steps'}]}, ['只有动效画面才写']);
  expectErr('动效摘词不在原句', {...doc, clips: [{...doc.clips[0], slots: {items: ['先列好清单', '一步一步做完']}}, doc.clips[1]]}, ['items[0]']);
  // 动效段 1.8 秒可以，AI 段要 2.5 秒
  const shortCues = [cue(1, 0, 1500, '开场先说一句'), cue(2, 3000, 4500, '你录一段口播'), cue(3, 9000, 12000, '这里放一段画面看看'), cue(4, 18000, 19500, '最后一句')];
  const mShort = {...doc, keepFace: [], clips: [{id: 'b01', from: 'c2', to: 'c2', source: 'motion', mode: 'full', job: 'stress', template: 'keyword', plain: '录口播', slots: {text: '录一段口播'}}]};
  expectOk('动效段 1.8 秒窗口可以', mShort, {cues: shortCues});
  const aShort = {...doc, keepFace: [], clips: [{...doc.clips[1], id: 'b01', from: 'c2', to: 'c2'}]};
  expectErr('AI 段 1.8 秒窗口不行', aShort, ['短于 2.5'], {cues: shortCues});
  // 相邻同模板
  const twoKw = {
    ...doc,
    keepFace: [],
    clips: [
      {id: 'b01', from: 'c3', to: 'c3', source: 'motion', mode: 'full', job: 'stress', template: 'keyword', plain: '列出来', slots: {text: '要做的事列出来'}},
      {id: 'b02', from: 'c6', to: 'c6', source: 'motion', mode: 'full', job: 'stress', template: 'keyword', plain: '换新', slots: {text: '把旧的换成新的'}},
    ],
  };
  expectErr('相邻动效段同模板', twoKw, ['b02.template']);
  // AI 段报数
  const numCues = [cue(1, 0, 1500, '开场'), cue(2, 2500, 6000, '整条视频只用了二十五秒'), cue(3, 9000, 12000, '中间'), cue(4, 18000, 19500, '最后一句')];
  const quant = {...doc, keepFace: [], clips: [{...doc.clips[1], id: 'b01', from: 'c2', to: 'c2', job: 'quantify'}]};
  expectErr('AI 段报确定的数要改 counter', quant, ['b01.source', 'counter', '二十五秒'], {cues: numCues});
  const counter = {...doc, keepFace: [], clips: [{id: 'b01', from: 'c2', to: 'c2', source: 'motion', mode: 'full', job: 'quantify', template: 'counter', plain: '二十五秒', slots: {say: '二十五秒', label: '整条视频'}}]};
  expectOk('counter 照抄原句的数', counter, {cues: numCues});
  expectErr('counter 编数字', {...counter, clips: [{...counter.clips[0], slots: {say: '三十秒', label: '整条视频'}}]}, ['slots.say'], {cues: numCues});
  // AI 段上限
  expectErr('--max-ai 0', doc, ['最多 0 段'], {maxAi: 0});
  expectOk('--max-ai 1', doc, {maxAi: 1});
  // 风格 v2
  expectErr('副风格不在 pairsWith', {...doc, styleAlt: 'clay-stopmotion'}, ['styleAlt']);
  expectErr('AI 段 subject 写材质', {...doc, clips: [doc.clips[0], {...doc.clips[1], subject: '木头机器人'}]}, ['b02.subject', '材质词']);
  expectErr('AI 段 place 写材质', {...doc, clips: [doc.clips[0], {...doc.clips[1], place: '积木小仓库'}]}, ['b02.place']);
  expectErr('第一段 AI 用 alt', {...doc, styleAlt: 'ink-sketch', clips: [doc.clips[0], {...doc.clips[1], look: 'alt', job: 'compare', camera: 'pan-right'}]}, ['第一段 AI 画面必须用主风格']);
  expectErr('v2 禁用词用 suggestV2', {...doc, clips: [doc.clips[0], {...doc.clips[1], subject: '乐高小人'}]}, ['乐高', '「机器人」']);
  expectErr('v1 的 AI 段写 list', {...readJson(path.join(DEMO, 'broll.json')), clips: [{...readJson(path.join(DEMO, 'broll.json')).clips[0], job: 'list'}]}, ['动效画面的 job'], {projectDir: DEMO});
  expectErr('风格不存在（v2）', {...doc, style: 'no-such'}, ['没有叫「no-such」的风格']);
  // 分句锁
  expectErr('分句锁不对就拦', doc, ['talk.srt', '分句变了'], {lockProblem: {where: 'talk.srt', problem: '写完 broll.json 后 talk.srt 的分句变了：原来 9 句，现在 8 句', fix: '重写'}});
  // v1 老文件只多一条实验风格的提醒
  const old = validateBroll(readJson(path.join(DEMO, 'broll.json')), ctxOf({projectDir: DEMO}));
  check('v1 老文件照常通过，提醒实验风格', old.errors.length === 0 && old.warnings.some((w) => w.problem.includes('实验风格')), formatReport(old));
};

// ───────── 计划：v1 哈希不变、动效段费用 0、v2 哈希字段 ─────────
const planTests = () => {
  const demo = readJson(path.join(DEMO, 'broll.json'));
  const v1 = buildPlan({doc: {...demo, provider: 'minimax-h3'}, cues: demoCues(), media: MEDIA, style: STYLES['brick-diorama'], styles: STYLES, projectDir: DEMO});
  // 这两个哈希是 v0.8.0（2369ae9）的 plan.mjs 对同一份 demo 算出来的：老账本靠它不重新花钱
  check('v1 请求哈希和 v0.8 一样 b01', v1.clips[0].requestHash === '428f931f9a6b3c3cbf3c17ed698120e4c3725eef7a6d21a9c208ef1b9da4a5cf', v1.clips[0].requestHash);
  check('v1 请求哈希和 v0.8 一样 b02', v1.clips[1].requestHash === '933b162f3457f8d28fcd199b3eed5f7c9ebfa9d68f39bf7f3a905db540706874', v1.clips[1].requestHash);
  check('v1 参考图沿用 ref-3', v1.clips[0].refs.length === 1 && v1.clips[0].refs[0].endsWith('ref-3.jpg') && v1.clips[0].freezeNoise === 0.003);
  const doc = {...motionDoc(), provider: 'minimax-h3'};
  const plan = buildPlan({doc, cues: demoCues(), media: MEDIA, styles: STYLES, projectDir: MOTION});
  const m = plan.clips[0];
  check('动效段费用 0、不生成', m.source === 'motion' && m.costYuan === 0 && m.genSec === 0 && m.requestHash === null && m.prompt === null && m.motion?.screenText?.join('|') === '要做的事列出来|一步一步做完', JSON.stringify(m).slice(0, 400));
  check('合计只算 AI 段', plan.totalYuan === 2.5 && plan.aiCount === 1 && plan.motionCount === 1 && plan.aiGenSec === 5 && aiClipsOf(plan).length === 1);
  const ai = plan.clips[1];
  check('v2 AI 段按风格带参考图和扩写模式', ai.styleId === 'wood-blocks' && ai.refs.length === 2 && ai.refs[0].endsWith(path.join('refs', 'character.jpg')) && ai.promptExpansion === 'disabled' && ai.prompt.startsWith('图1是角色参考，图2是材质参考。'));
  check('v2 提示词没有泄漏词', !/凸点|乐高|拼搭|颗粒|人仔|stud|lego|minifig/i.test(ai.prompt), ai.prompt);
  const alt = clone(doc);
  alt.styleAlt = 'ink-sketch';
  const planAlt = buildPlan({doc: alt, cues: demoCues(), media: MEDIA, styles: STYLES, projectDir: MOTION});
  check('写了 styleAlt 但这段没用 alt：哈希不变', planAlt.clips[1].requestHash === ai.requestHash);
  const three = clone(doc);
  three.styleAlt = 'ink-sketch';
  three.clips = [
    {...doc.clips[1], id: 'b01', from: 'c3', to: 'c4', mode: 'full', job: 'demonstrate'},
    {...doc.clips[1], id: 'b02', from: 'c6', to: 'c7', look: 'alt', job: 'compare', camera: 'pan-right', link: 'new'},
  ];
  const p3 = buildPlan({doc: three, cues: demoCues(), media: MEDIA, styles: STYLES, projectDir: MOTION});
  check('look alt 换风格、换参考图', p3.clips[1].styleId === 'ink-sketch' && p3.clips[1].refs[0].includes('ink-sketch') && p3.clips[1].prompt.includes('墨') && p3.clips[1].freezeNoise === 0.0005, p3.clips[1].prompt);
  const cont = clone(three);
  cont.clips[1].look = 'main';
  cont.clips[1].job = 'demonstrate';
  cont.clips[1].camera = 'slow-push';
  const pNew = buildPlan({doc: cont, cues: demoCues(), media: MEDIA, styles: STYLES, projectDir: MOTION});
  cont.clips[1].link = 'continue';
  const pCont = buildPlan({doc: cont, cues: demoCues(), media: MEDIA, styles: STYLES, projectDir: MOTION});
  check('continue 把上一段结尾写进提示词和哈希', pCont.clips[1].prompt.includes('开场画面接上一段的结尾：架子变得整整齐齐') && pCont.clips[1].requestHash !== pNew.clips[1].requestHash, pCont.clips[1].prompt);
  const props = toMotionProps(m.motion, {theme: STYLES['wood-blocks'].motionTheme});
  check('动效 props', props.kind === 'motion' && props.badge === false && props.theme === 'studio-graphite' && props.startMs === 3880 && Array.isArray(props.marks.items) && props.marks.items[0] > 0 && props.marks.items[0] < 5, JSON.stringify(props));
  // 转写逐字时间接进 marks
  const tokens = tokensFromAsr({tokens: ['先', '把', '要', '做', '的', '事', '列', '出', '来', '再', '一', '步', '一', '步', '做', '完'], times: [4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 5.6, 5.7, 5.8, 6.5, 6.6, 6.7, 6.8, 6.9, 8.1, 8.2]});
  const timed = buildPlan({doc, cues: demoCues(), media: MEDIA, styles: STYLES, projectDir: MOTION, tokens});
  check('有逐字时间就用真实时刻', timed.clips[0].motion.marksMs.items[0] >= 4200 && timed.clips[0].motion.marksMs.items[0] < 4300 && timed.clips[0].motion.marksMs.items[1] >= 6600 && timed.clips[0].motion.marksMs.items[1] < 6700, JSON.stringify(timed.clips[0].motion.marksMs));
  check('逐字时间：秒换毫秒、去掉词头符号', JSON.stringify(tokensFromAsr({tokens: ['▁open', 'x'], times: [1.234, 2]})) === JSON.stringify([{text: ' open', startMs: 1234}, {text: 'x', startMs: 2000}]));
};

// ───────── 审片：动效段不进批准，改动效不作废 ─────────
const reviewTests = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-rev-'));
  const proj = path.join(tmp, 'proj');
  const out = path.join(tmp, 'out');
  fs.mkdirSync(proj, {recursive: true});
  fs.mkdirSync(path.join(out, 'clips'), {recursive: true});
  const doc = motionDoc();
  const jsonPath = path.join(proj, 'broll.json');
  fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf8');
  fs.writeFileSync(path.join(out, 'clips', 'b02.mp4'), 'clip', 'utf8');
  writeApproval({projectDir: proj, outDir: out, clipIds: ['b02']});
  check('只审 AI 段', checkReview({projectDir: proj, outDir: out, clipIds: ['b02']}).ok === true);
  const before = brollAiSha256(jsonPath);
  const editMotion = clone(doc);
  editMotion.clips[0].slots.items = ['要做的事列出来', '一步一步'];
  fs.writeFileSync(jsonPath, JSON.stringify(editMotion), 'utf8');
  check('改动效段不作废审片', brollAiSha256(jsonPath) === before && checkReview({projectDir: proj, outDir: out, clipIds: ['b02']}).ok === true);
  const editAi = clone(doc);
  editAi.clips[1].action = '把方块摆整齐';
  fs.writeFileSync(jsonPath, JSON.stringify(editAi), 'utf8');
  const stale = checkReview({projectDir: proj, outDir: out, clipIds: ['b02']});
  check('改 AI 段审片作废', stale.ok === false && /broll.json/.test(stale.reason), stale.reason);
  // v0.8 的审片记录（只有整文件哈希）照样认
  fs.writeFileSync(jsonPath, JSON.stringify(doc), 'utf8');
  fs.writeFileSync(path.join(out, 'broll.review.json'), JSON.stringify({version: 1, brollSha256: sha256File(jsonPath), clips: {b02: {file: 'clips/b02.mp4', sha256: sha256File(path.join(out, 'clips', 'b02.mp4'))}}}), 'utf8');
  check('v0.8 的审片记录照样认', checkReview({projectDir: proj, outDir: out, clipIds: ['b02']}).ok === true);
  fs.rmSync(tmp, {recursive: true, force: true});
};

// ───────── 生成：动效段跳过；缺参考图在写账本前拦下 ─────────
const generateTests = async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-gen-'));
  const doc = {...motionDoc(), provider: 'minimax-h3'};
  const plan = buildPlan({doc, cues: demoCues(), media: MEDIA, styles: STYLES, projectDir: MOTION});
  let submits = 0;
  const client = {submit: async () => (submits += 1), poll: async () => ({}), download: async () => 0};
  let err = null;
  try {
    await generateClips({doc, plan, outDir: tmp, projectDir: MOTION, client, log: () => {}});
  } catch (e) {
    err = e;
  }
  const ledgerFile = path.join(tmp, 'ledger.json');
  const ledger = fs.existsSync(ledgerFile) ? readJson(ledgerFile) : {clips: {}};
  check('缺参考图：退出码 2、没提交、没记账', err?.exitCode === 2 && submits === 0 && !ledger.clips.b02 && /没有花钱/.test(err.message) && err.message.includes('make-style-refs.mjs --style wood-blocks'), err?.message);
  let only = null;
  try {
    await generateClips({doc, plan, outDir: tmp, projectDir: MOTION, client, only: 'b01', log: () => {}});
  } catch (e) {
    only = e;
  }
  check('--only 动效段：说清楚不用生成', only?.exitCode === 2 && only.message.includes('动效画面'), only?.message);
  // placeholder：动效段不进账本
  const ph = buildPlan({doc: motionDoc(), cues: demoCues(), media: {...MEDIA, width: 180, height: 320}, styles: STYLES, projectDir: MOTION});
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-gen2-'));
  const led = await generateClips({doc: motionDoc(), plan: ph, outDir: tmp2, projectDir: MOTION, log: () => {}});
  check('placeholder 只生成 AI 段', Object.keys(led.clips).join() === 'b02' && led.clips.b02.status === 'checked', JSON.stringify(Object.keys(led.clips)));
  fs.rmSync(tmp, {recursive: true, force: true});
  fs.rmSync(tmp2, {recursive: true, force: true});
};

// ───────── 原片归一化 ─────────
const normalizeTests = async () => {
  check('帧率档', targetFpsOf(29.97) === 30 && targetFpsOf(59.94) === 60 && targetFpsOf(25) === 25 && targetFpsOf(12) === 30 && targetFpsOf(120) === 60 && targetFpsOf(23.976) === 24);
  const phone = {width: 1080, height: 1920, fps: 29.87, avgFps: 29.87, rFps: 120, vfr: true, videoCodec: 'hevc', pixFmt: 'yuv420p10le', rotation: 90, hasAudio: true, audioChannels: 1, audioCodec: 'aac'};
  const why = normalizeReasons(phone).join('；');
  check('手机片的问题都说出来', ['HEVC', '可变帧率', '旋转', '单声道', 'yuv420p10le'].every((w) => why.includes(w)), why);
  const want = normalizedMediaOf({...phone, width: 721, height: 1281});
  check('归一化后偶数宽高、整数帧率', want.normalized && want.width === 720 && want.height === 1280 && want.fps === 30 && want.videoCodec === 'h264');
  check('标准 H.264 不转', normalizedMediaOf({width: 1080, height: 1920, fps: 30, avgFps: 30, rFps: 30, vfr: false, videoCodec: 'h264', pixFmt: 'yuv420p', rotation: 0, hasAudio: true, audioChannels: 2, audioCodec: 'aac'}).normalized === false);
  const args = normalizeArgs({src: 'a.mp4', dest: 'b.mp4', target: {width: 720, height: 1280, fps: 30}, hasAudio: true}).join(' ');
  check('转码参数：恒定帧率、双声道、H.264', args.includes('-fps_mode cfr') && args.includes('-r 30') && args.includes('-ac 2') && args.includes('libx264') && args.includes('scale=720:1280'), args);
  // 真转一段：奇数宽高 + 单声道 → 偶数宽高 + 双声道 H.264，原片不动
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-norm-'));
  const src = path.join(tmp, 'talk.mp4');
  const made = ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=361x641:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=44100', '-t', '1', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv444p', '-ac', '1', '-c:a', 'aac', src]);
  check('造一段不标准的小视频', made.status === 0, made.stderr);
  if (made.status === 0) {
    const before = sha256File(src);
    const r = await normalizeTalk({talk: src, projectDir: tmp, log: () => {}});
    const got = probeMedia(r.file);
    check('真转码：偶数宽高、双声道、yuv420p', r.normalized && got.width === 360 && got.height === 640 && got.audioChannels === 2 && got.pixFmt === 'yuv420p' && got.videoCodec === 'h264' && r.file.includes('.brewreel'), JSON.stringify(got));
    check('原片不动', sha256File(src) === before);
    const again = await normalizeTalk({talk: src, projectDir: tmp, log: () => {}});
    check('第二次用缓存', again.cached === true && again.file === r.file);
  }
  fs.rmSync(tmp, {recursive: true, force: true});
};

// ───────── 项目加载：缺 srt 的提示、分句锁、逐字时间 ─────────
const projectTests = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-proj-'));
  fs.copyFileSync(path.join(DEMO, 'talk.mp4'), path.join(tmp, 'talk.mp4'));
  const noSrt = loadProject(tmp);
  check('缺 talk.srt 提示两种做法', !noSrt.ok && noSrt.exitCode === 2 && noSrt.message.includes('transcribe.mjs') && noSrt.message.includes('talk.mjs'), noSrt.message);
  fs.copyFileSync(path.join(DEMO, 'talk.srt'), path.join(tmp, 'talk.srt'));
  fs.writeFileSync(path.join(tmp, 'broll.json'), JSON.stringify(motionDoc()), 'utf8');
  const cues = demoCues();
  fs.mkdirSync(path.join(tmp, '.brewreel'), {recursive: true});
  fs.writeFileSync(path.join(tmp, '.brewreel', 'cues.lock.json'), JSON.stringify(cuesLockOf(cues)), 'utf8');
  const same = loadProject(tmp);
  check('分句没变：不拦', same.ok && same.lockProblem === null);
  fs.writeFileSync(path.join(tmp, '.brewreel', 'cues.lock.json'), JSON.stringify(cuesLockOf(cues.slice(0, 7))), 'utf8');
  const changed = loadProject(tmp);
  check('分句变了：报出来', changed.ok && changed.lockProblem && changed.lockProblem.problem.includes('分句变了') && changed.lockProblem.fix.includes('llm_broll'), JSON.stringify(changed.lockProblem));
  const cli = spawnSync(process.execPath, ['scripts/broll/validate.mjs', tmp], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
  check('validate 命令行因分句锁退出 1', cli.status === 1 && cli.stdout.includes('分句变了'), cli.stdout);
  // 逐字时间：transcribe.json 指向缓存才用
  fs.writeFileSync(path.join(tmp, '.brewreel', 'asr-x.json'), JSON.stringify({tokens: ['先', '把'], times: [4.0, 4.1]}), 'utf8');
  fs.writeFileSync(path.join(tmp, '.brewreel', 'transcribe.json'), JSON.stringify({cache: 'asr-x.json', srtSha256: 'whatever'}), 'utf8');
  check('转写缓存的逐字时间进了项目', loadProject(tmp).tokens.length === 2);
  fs.rmSync(tmp, {recursive: true, force: true});
};

// ───────── 一条命令和便宜模型提示 ─────────
const cliTests = () => {
  const p = parseTalkArgs(['proj', '--out', 'out', '--budget', '8', '--provider', 'minimax-h3', '--yes', '--no-fix', '--lang', 'zh', '--max-ai', '1']);
  check('talk.mjs 参数分发', !p.error && p.makeArgs.includes('--yes') && p.makeArgs.includes('minimax-h3') && !p.makeArgs.includes('--budget') && p.llmArgs.includes('--budget') && p.llmArgs.includes('--max-ai') && !p.llmArgs.includes('--yes') && p.switches.has('--no-fix'), JSON.stringify(p));
  check('talk.mjs 要 --out', parseTalkArgs(['proj']).error?.includes('--out'));
  check('talk.mjs 不认识的参数', parseTalkArgs(['proj', '--out', 'o', '--approve']).error?.includes('不认识'));
  const r = spawnSync(process.execPath, ['scripts/talk.mjs', DEMO, '--out', path.join(ROOT, 'inside')], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
  check('talk.mjs 输出在仓库里被拒', r.status === 2 && r.stdout.includes('仓库里面'), r.stdout);
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'talk.mjs'), 'utf8');
  check('talk.mjs 不调 approve', !/spawn[^\n]*approve/.test(src) && !src.includes("'approve.mjs')"));
  const flags = parseLlmArgs(['proj', '--max-ai', '1', '--no-fix', '--lang', 'zh']);
  check('llm_broll 新参数', flags.flags['max-ai'] === '1' && flags.flags.noFix === true && flags.flags.lang === 'zh');
  const styles = readStyles();
  const skill = fs.readFileSync(path.join(ROOT, 'broll', 'SKILL-broll.md'), 'utf8');
  const cuesText = fs.readFileSync(path.join(DEMO, 'talk.srt'), 'utf8');
  const msg = buildMessages({skill, cuesText, picture: '竖版', flags: {...parseLlmArgs(['x']).flags}, styles})[1].content;
  check('提示词：v2、选择表、模板、风格清单、AI 上限', msg.includes('version 写 2') && msg.includes('style 写 wood-blocks') && msg.includes('| 报一个确定的数') && msg.includes('- counter：') && msg.includes('积木风（wood-blocks）') && msg.includes('手绘线稿（ink-sketch）') && msg.includes('最多 2 段'), msg.slice(-1500));
  check('提示词：去掉旧约束', !msg.includes('浅蓝灰积木机器人') && !msg.includes('积木工作台') && !msg.includes('塑料积木（实验）（brick-diorama）：'));
  // 示例 1 照这次的句子能通过校验
  const ex = msg.split('## 正确示例 1')[1].split('## 正确示例 2')[0];
  const ex1 = JSON.parse(ex.slice(ex.indexOf('{'), ex.lastIndexOf('}') + 1));
  const okEx = validateBroll(ex1, ctxOf({maxAi: 2}));
  check('示例 1 是合法的 v2', okEx.errors.length === 0, formatReport(okEx));
  for (const id of ['clay-stopmotion', 'paper-layers', 'ink-sketch']) {
    const m = buildMessages({skill, cuesText, picture: '竖版', flags: {...parseLlmArgs(['x']).flags, style: id}, styles})[1].content;
    const e = m.split('## 正确示例 1')[1].split('## 正确示例 2')[0];
    const d = JSON.parse(e.slice(e.indexOf('{'), e.lastIndexOf('}') + 1));
    const rr = validateBroll(d, ctxOf({maxAi: 2}));
    check(`示例 1 换主风格 ${id} 也合法`, rr.errors.length === 0, formatReport(rr));
    const e2 = m.split('## 正确示例 2')[1];
    const d2 = JSON.parse(e2.slice(e2.indexOf('{'), e2.lastIndexOf('}') + 1));
    const st = validateBroll(d2, ctxOf({maxAi: 2, cues: [cue(1, 0, 1500, '开场'), cue(2, 2500, 6000, '先动手搭第一块'), cue(3, 7200, 8000, '中间一句'), cue(4, 9000, 12000, '整条视频只用了二十五秒'), cue(5, 13200, 14000, '露脸'), cue(6, 15000, 16500, '两种做法'), cue(7, 16600, 18000, '放在一起看'), cue(8, 19000, 19800, '最后一句')]}));
    check(`示例 2 换主风格 ${id} 风格规则不报错`, !st.errors.some((x) => /styleAlt|look|camera|job|subject|place/.test(x.where)), formatReport(st));
  }
  const zero = buildMessages({skill, cuesText, picture: '竖版', flags: {...parseLlmArgs(['x']).flags, 'max-ai': '0'}, styles})[1].content;
  check('--max-ai 0 的提示', zero.includes('这次不要 AI 画面'));
  const dry = spawnSync(process.execPath, ['scripts/broll/llm_broll.mjs', fs.mkdtempSync(path.join(os.tmpdir(), 'broll-nosrt-')), '--dry-run'], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
  check('dry-run 没有字幕不转写', dry.status === 2 && dry.stdout.includes('dry-run 不转写'), dry.stdout);
};

const main = async () => {
  const t0 = Date.now();
  // 示例口播的 mp4 不进仓库：单独跑这个文件时也要先生成（几秒）
  ensureDemo();
  const slow = [];
  for (const [name, fn] of Object.entries({layoutTests, billingTests, validateTests, planTests, reviewTests, generateTests, normalizeTests, projectTests, cliTests})) {
    const t = Date.now();
    await fn();
    if (Date.now() - t > 5000) slow.push(`${name} ${((Date.now() - t) / 1000).toFixed(1)} 秒`);
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (slow.length) console.log(`慢的部分：${slow.join('，')}`);
  if (failures.length) {
    console.log(`集成测试：失败 ${failures.length}，通过 ${passed}（${sec} 秒）`);
    for (const f of failures) console.log(`- ${f}`);
    process.exit(1);
  }
  console.log(`集成测试：全部通过（${passed} 项，${sec} 秒）`);
};

main();
