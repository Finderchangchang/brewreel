#!/usr/bin/env node
// 口播配 B-roll 的测试。一个入口跑完：解析、校验、时间、费用、账本、占位片、几何、v0.9 三个模块和集成测试、示例成片（v1 + v2）。
//   node tests/broll/run.mjs
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkClip} from '../../scripts/broll/check-clip.mjs';
import {sha256Text, stableString} from '../../scripts/broll/hash.mjs';
import {decide, resumeClip} from '../../scripts/broll/ledger.mjs';
import {ffmpeg, ffmpegPath, probeMedia} from '../../scripts/broll/media.mjs';
import {buildPlan} from '../../scripts/broll/plan.mjs';
import {clipCost} from '../../scripts/broll/prices.mjs';
import {buildPrompt} from '../../scripts/broll/prompt.mjs';
import {createH3Client} from '../../scripts/broll/providers/minimax-h3.mjs';
import {prepareLocal} from '../../scripts/broll/providers/local.mjs';
import {colorOf, renderPlaceholder} from '../../scripts/broll/providers/placeholder.mjs';
import {ROOT} from '../../scripts/broll/root.mjs';
import {parseSrt} from '../../scripts/broll/srt.mjs';
import {beatSpans, fmtSec, framesFor, genSecOf, windowOf} from '../../scripts/broll/time.mjs';
import {formatReport, loadBanned, loadStyles, validateBroll} from '../../scripts/broll/validate.mjs';
import {importTs} from './quiet-ts.mjs';
import {ensureDemo} from './demo.mjs';
import {h3Tests} from './h3.mjs';
const {layoutOf} = await importTs('../../template/src/talk/layout.ts', import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.join(ROOT, 'examples', 'talk', 'demo');
const MOTION_DEMO = path.join(ROOT, 'examples', 'talk', 'motion');
const OUT = path.resolve(ROOT, '..', 'broll-b1', 'demo-placeholder');
const OUT_MOTION = path.resolve(ROOT, '..', 'broll-b1', 'motion-placeholder');
const LOGS = path.resolve(ROOT, '..', 'broll-b1', 'logs');
const unitsOnly = process.argv.includes('--units-only');
const failures = [];
let passed = 0;

const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name}：${detail}` : name);
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const demoDoc = () => readJson(path.join(DEMO, 'broll.json'));
const demoCues = () => parseSrt(fs.readFileSync(path.join(DEMO, 'talk.srt'), 'utf8'));
const ctxOf = (over = {}) => ({
  cues: demoCues(),
  durationMs: 20000,
  width: 1080,
  height: 1920,
  styles: loadStyles(),
  banned: loadBanned(),
  projectDir: DEMO,
  ...over,
});
const expectError = (name, doc, extra, needles) => {
  const r = validateBroll(doc, ctxOf(extra));
  const text = formatReport(r);
  const missing = needles.filter((n) => !text.includes(n));
  check(name, r.errors.length > 0 && text.includes('怎么改') && missing.length === 0, missing.length ? `${text}\n缺：${missing.join('、')}` : text);
  return r;
};
const expectOk = (name, doc, extra = {}) => {
  const r = validateBroll(doc, ctxOf(extra));
  check(name, r.errors.length === 0 && !r.budgetExceeded, formatReport(r));
  return r;
};
const cue = (i, startMs, endMs, text) => ({id: `c${i}`, index: i, startMs, endMs, text});
const runNode = (args) => spawnSync(process.execPath, args, {cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024});

const srtTests = () => {
  const raw = '\uFEFF1\r\n00:00:00,000 --> 00:00:01,500\r\n第一行\r\n第二行\r\n\r\n\r\n2\r\n00:00:02.250 --> 00:00:03,5\r\n单行\r\n\r\n9\r\n\r\n3\r\n00:00:04,25 --> 00:00:05.250\r\n尾\r\n';
  const cues = parseSrt(raw);
  check('srt 段数', cues.length === 3, String(cues.length));
  check('srt 编号按出现顺序', cues.map((c) => c.id).join() === 'c1,c2,c3');
  check('srt 多行', cues[0].text === '第一行\n第二行');
  check('srt 毫秒', cues[0].startMs === 0 && cues[0].endMs === 1500 && cues[1].startMs === 2250 && cues[1].endMs === 3500 && cues[2].startMs === 4250 && cues[2].endMs === 5250, JSON.stringify(cues));
  let threw = false;
  try {
    parseSrt('没有时间\n\n');
  } catch (e) {
    threw = /时间轴/.test(e.message);
  }
  check('srt 缺时间轴', threw);
  threw = false;
  try {
    parseSrt('1\n00:00:02,000 --> 00:00:01,000\n倒退\n');
  } catch (e) {
    threw = /结束时间/.test(e.message);
  }
  check('srt 结束不晚于开始', threw);
  const listed = parseSrt(fs.readFileSync(path.join(DEMO, 'talk.srt'), 'utf8'));
  check('示例字幕 8 句', listed.length === 8 && listed[0].text === '先看这一段口播' && listed[7].id === 'c8');
};

const timeTests = () => {
  const cues = demoCues();
  const by = Object.fromEntries(cues.map((c) => [c.id, c]));
  const w1 = windowOf(by.c3, by.c4, 20000);
  const w2 = windowOf(by.c6, by.c7, 20000);
  check('窗口 b01', w1.startMs === 3880 && w1.endMs === 8800 && w1.durationMs === 4920, JSON.stringify(w1));
  check('窗口 b02', w2.startMs === 12080 && w2.endMs === 16800 && w2.durationMs === 4720, JSON.stringify(w2));
  check('取整', genSecOf(4920) === 5 && genSecOf(4000) === 4 && genSecOf(2500) === 4 && genSecOf(12000) === 12 && genSecOf(12001) === 13 && genSecOf(20000) === 15);
  check('帧数', framesFor(4920, 30) === 148 && framesFor(4720, 30) === 142);
  const spans = beatSpans(5, 2);
  check('分拍', spans[0][0] === 0 && spans[0][1] === 250 && spans[1][0] === 250 && spans[1][1] === 500 && fmtSec(0) === '0' && fmtSec(250) === '2.5' && fmtSec(500) === '5');
  check('费用', clipCost('placeholder', '768P', 5) === 0 && clipCost('local', '2K', 5) === 0 && clipCost('minimax-h3', '768P', 5) === 2.5 && clipCost('minimax-h3', '2K', 5) === 4);
  const plan = buildPlan({doc: demoDoc(), cues, media: {width: 1080, height: 1920, fps: 30, durationMs: 20000}, style: loadStyles()['brick-diorama'], projectDir: DEMO});
  check('计划费用为 0', plan.totalYuan === 0 && plan.clips[0].genSec === 5 && plan.clips[0].costYuan === 0 && plan.aspect === '9:16');
  const prompt = plan.clips[0].prompt;
  const forbid = '画面里不要出现凸点、文字、字母、数字、商标、品牌标志或真实人物，不要开口夹手，不要黄色皮肤，没有人声对白。no studs, no logos or lettering on any surface, no minifigure, no C-shaped hands, no yellow skin.';
  check(
    '提示词',
    prompt.includes('圆头') && prompt.includes('圆球手') && prompt.includes('没有凸点') && prompt.includes('smooth-top') && !prompt.includes('可以有凸点') && prompt.includes('no studs') && prompt.includes('no minifigure') && prompt.includes('no C-shaped hands') && prompt.includes('no yellow skin') && prompt.includes('0–2.5 秒') && prompt.includes('2.5–5 秒') && prompt.includes('镜头固定不动') && prompt.includes(forbid) && !prompt.includes('先列计划再动手') && !prompt.includes('人仔') && !prompt.includes('C形') && !prompt.includes('乐高'),
    prompt,
  );
  check('单拍提示词', buildPrompt({style: loadStyles()['brick-diorama'], clip: demoDoc().clips[1], genSec: 5}).includes('镜头缓慢推近') && buildPrompt({style: loadStyles()['brick-diorama'], clip: demoDoc().clips[1], genSec: 5}).includes('从货架取下旧方块换上新方块'));
  const again = buildPlan({doc: demoDoc(), cues, media: {width: 1080, height: 1920, fps: 30, durationMs: 20000}, style: loadStyles()['brick-diorama'], projectDir: DEMO});
  check('请求哈希稳定', plan.clips[0].requestHash === again.clips[0].requestHash && plan.clips[0].promptHash === sha256Text(prompt));
  check('哈希与键顺序无关', stableString({b: 1, a: {d: 2, c: 3}}) === stableString({a: {c: 3, d: 2}, b: 1}));
};

const clip = (over) => ({
  id: 'b01',
  from: 'c3',
  to: 'c4',
  mode: 'full',
  job: 'explain',
  plain: '先列计划再动手',
  place: '积木工作台',
  subject: '蓝色积木机器人',
  action: '把方块排成一行',
  end: '方块排好',
  camera: 'static',
  ...over,
});

const ruleTests = () => {
  expectOk('正例：示例 broll', demoDoc());
  const doc = demoDoc();
  expectError('clips 为空', {...doc, clips: []}, {}, ['1 到 12']);
  expectError('clips 超过 12', {...doc, clips: Array.from({length: 13}, (_, i) => clip({id: `b${String(i + 1).padStart(2, '0')}`}))}, {}, ['1 到 12']);
  expectError('id 形状', {...doc, clips: [clip({id: 'b1'})]}, {}, ['形如 b01']);
  expectError('id 重复', {...doc, clips: [clip({id: 'b01', from: 'c2', to: 'c2'}), clip({id: 'b01', from: 'c6', to: 'c7'})]}, {}, ['重复']);
  expectError('句子不存在', {...doc, clips: [clip({from: 'c99', to: 'c99'})]}, {}, ['没有']);
  expectError('from 晚于 to', {...doc, clips: [clip({from: 'c4', to: 'c3'})]}, {}, ['起点比终点晚']);
  expectError('时间重叠', {...doc, clips: [clip({id: 'b01', from: 'c2', to: 'c3', mode: 'split'}), clip({id: 'b02', from: 'c3', to: 'c4', mode: 'split', action: '从货架取下旧方块', end: '货架整齐'})]}, {}, ['叠在一起']);
  expectError('真人间隔太短', {...doc, clips: [clip({id: 'b01', from: 'c2', to: 'c2', mode: 'split'}), clip({id: 'b02', from: 'c3', to: 'c3', mode: 'split'})]}, {}, ['至少要 1.0 秒']);
  expectError('没有按时间排序', {...doc, clips: [doc.clips[1], doc.clips[0]]}, {}, ['没有按时间排序']);
  expectError('action 和 beats 都写', {...doc, clips: [{...doc.clips[0], action: '挥手', end: '停下'}]}, {}, ['都写了']);
  expectError('缺少动作', {...doc, clips: [clip({action: undefined, end: undefined, beats: undefined})]}, {}, ['缺少动作']);
  expectError('beats 只有 1 拍', {...doc, clips: [{...clip({action: undefined, end: undefined}), beats: [{action: '摆一块', end: '摆好'}]}]}, {}, ['2 到 4']);
  expectError('beats 有 5 拍', {...doc, clips: [{...clip({action: undefined, end: undefined}), beats: Array.from({length: 5}, () => ({action: '摆一块', end: '摆好'}))}]}, {}, ['2 到 4']);
  expectError('mode 非法', {...doc, clips: [clip({mode: 'corner'})]}, {}, ['full、pip 或 split']);
  expectError('job 非法', {...doc, clips: [clip({job: 'sing'})]}, {}, ['不在可选值']);
  expectError('camera 非法', {...doc, clips: [clip({camera: 'zoom'})]}, {}, ['不在可选值']);
  expectError('风格不存在', {...doc, style: 'no-such'}, {}, ['风格预设']);
  expectError('plain 超字数', {...doc, clips: [clip({plain: '字'.repeat(21)})]}, {}, ['最多 20']);
  expectError('place 超字数', {...doc, clips: [clip({place: '字'.repeat(13)})]}, {}, ['最多 12']);
  expectError('action 超字数', {...doc, clips: [clip({action: '字'.repeat(25)})]}, {}, ['最多 24']);
  expectError('end 超字数', {...doc, clips: [clip({end: '字'.repeat(17)})]}, {}, ['最多 16']);
  expectError('短于 2.5 秒', {...doc, clips: [clip({from: 'c2', to: 'c2', mode: 'split'})]}, {}, ['短于 2.5']);
  expectError('长于 12 秒', {...doc, clips: [clip({from: 'c2', to: 'c7', mode: 'split'})]}, {}, ['长于 12']);
  expectError('总时长超过 60%', {...doc, clips: [clip({id: 'b01', from: 'c2', to: 'c4', mode: 'split'}), clip({id: 'b02', from: 'c6', to: 'c7', mode: 'split'})]}, {durationMs: 15000}, ['60%']);
  expectError('盖住第一句', {...doc, clips: [clip({from: 'c1', to: 'c2', mode: 'split'})]}, {}, ['第一句']);
  expectError('盖住最后一句', {...doc, clips: [clip({from: 'c6', to: 'c8', mode: 'split'})]}, {}, ['最后一句']);
  expectError('盖住 keepFace', {...doc, keepFace: ['c5'], clips: [clip({from: 'c5', to: 'c5'})]}, {}, ['keepFace']);
  const padCues = [cue(1, 0, 1000, '开场白'), cue(2, 1050, 4500, '中间这件事'), cue(3, 18000, 19000, '收尾')];
  expectError('窗口提前盖住第一句', {...doc, keepFace: [], clips: [clip({from: 'c2', to: 'c2', mode: 'split'})]}, {cues: padCues, durationMs: 20000}, ['第一句']);
  const warnDoc = {...doc, clips: [clip({from: 'c3', to: 'c4'})]};
  const warnCues = demoCues().map((c) => (c.id === 'c3' ? {...c, text: '我觉得这样更好'} : c));
  const warned = validateBroll(warnDoc, ctxOf({cues: warnCues}));
  // v0.9 起 v1 的 brick-diorama 还会多一条「实验风格」提醒，这里只数第一人称那条
  const personWarn = warned.warnings.filter((w) => w.problem.includes('第一人称'));
  check('第一人称只警告', warned.errors.length === 0 && personWarn.length === 1 && formatReport(warned).includes('不拦截') && formatReport(warned).includes('我觉得'), formatReport(warned));
  expectError('burned 配 full', {...doc, captions: 'burned'}, {}, ['burned', 'split']);
  expectError('burned 配 pip', {...doc, captions: 'burned', clips: doc.clips.map((c) => ({...c, mode: 'pip'}))}, {}, ['burned']);
  expectOk('正例：竖版 burned 配 split', {...doc, captions: 'burned', clips: doc.clips.map((c) => ({...c, mode: 'split'}))});
  expectError('横版不能 split', {...doc, clips: doc.clips.map((c) => ({...c, mode: 'split'}))}, {width: 1920, height: 1080}, ['竖版']);
  expectError('禁用词', {...doc, clips: [clip({subject: '乐高小人'})]}, {}, ['乐高小人', '积木小人']);
  expectError('禁用词凸点', {...doc, clips: [clip({action: '桌上有凸点'})]}, {}, ['凸点', '顶面光滑']);
  expectError('禁用词颗粒', {...doc, clips: [clip({place: '颗粒货架'})]}, {}, ['颗粒', '方块']);
  expectError('禁用词 stud', {...doc, clips: [clip({end: 'stud 方块'})]}, {}, ['stud']);
  expectError('禁用词 studs', {...doc, clips: [clip({end: 'studs方块'})]}, {}, ['studs']);
  expectError('禁用词 minifigure', {...doc, clips: [clip({subject: 'minifigure'})]}, {}, ['minifigure', '积木机器人']);
  expectError('引号', {...doc, clips: [clip({place: '「工位」'})]}, {}, ['引号']);
  expectError('画面写字', {...doc, clips: [clip({action: '牌子上写着欢迎'})]}, {}, ['写着']);
  expectError('阿拉伯数字', {...doc, clips: [clip({action: '摆好3块方块'})]}, {}, ['数字']);
  expectError('百分比', {...doc, clips: [clip({end: '完成一半', action: '进度走到50%'})]}, {}, ['数字']);
  expectError('自带参考图', {...doc, references: []}, {}, ['参考图']);
  expectError('段内自带参考图', {...doc, clips: [{...clip(), references: ['a.png']}]}, {}, ['参考图']);
  expectError('local 缺 file', {...doc, provider: 'local'}, {}, ['file']);
  expectError('placeholder 不能写 file', {...doc, clips: [{...doc.clips[0], file: 'talk.mp4'}]}, {}, ['不要写 file']);
  expectError('local 文件不存在', {...doc, provider: 'local', clips: doc.clips.map((c) => ({...c, file: 'no-such-clip.mp4'}))}, {}, ['找不到']);
  expectOk('正例：minimax-h3 预算够', {...doc, provider: 'minimax-h3', budgetYuan: 20});
  const over = validateBroll({...doc, provider: 'minimax-h3', budgetYuan: 1}, ctxOf());
  const overText = formatReport(over);
  check('超预算', over.budgetExceeded && over.estimateYuan === 5 && overText.includes('2.5') && overText.includes('元/秒') && overText.includes('超过预算'), overText);
  expectOk('正例：2K 占位片费用为 0', {...doc, quality: '2K'});
  expectOk('正例：local 指向已有文件', {...doc, provider: 'local', clips: doc.clips.map((c) => ({...c, file: 'talk.mp4'}))});
  const edgeCues = [cue(1, 0, 400, '开场'), cue(2, 800, 2980, '正好两秒半'), cue(3, 8000, 10000, '后面'), cue(4, 20000, 21000, '收尾')];
  const edgeDoc = {...doc, keepFace: [], clips: [clip({from: 'c2', to: 'c2', mode: 'split'})]};
  const win = windowOf(edgeCues[1], edgeCues[1], 22000);
  check('边界窗口正好 2.5 秒', win.durationMs === 2500);
  expectOk('正例：窗口正好 2.5 秒', edgeDoc, {cues: edgeCues, durationMs: 22000});
};

const layoutTests = () => {
  const split = layoutOf('split', 1080, 1920);
  check('split 几何', split.broll.height === 1152 && split.face.y === 1152 && split.face.height === 768 && split.face.shape === 'rect' && split.face.x === 0);
  const pip = layoutOf('pip', 1080, 1920);
  check('pip 竖版', pip.face.shape === 'circle' && pip.face.width === 320 && pip.face.x === 696 && pip.face.y === 1536 && pip.broll.width === 1080);
  const wide = layoutOf('pip', 1920, 1080);
  check('pip 横版', wide.face.width === 260 && wide.face.x === 1596 && wide.face.y === 756);
  const full = layoutOf('full', 1080, 1920);
  check('full 几何', full.face === null && full.broll.width === 1080 && full.broll.height === 1920);
  const block = Math.round(full.caption.fontSize * 1.2);
  check('full 字幕几何', full.caption.y === Math.round(1920 * 0.75) && full.caption.fontSize === 72 && full.caption.x === 150 && full.caption.width === 780);
  const pipBottom = pip.caption.y + block;
  check('pip 字幕几何', pip.caption.y === Math.round(1920 * 0.75) && pipBottom <= pip.face.y && pip.caption.x + pip.caption.width <= pip.face.x);
  const splitBottom = split.caption.y + block;
  check('split 字幕几何', splitBottom <= split.face.y && split.face.y - splitBottom <= Math.round(1920 * 0.02) && split.caption.y > split.broll.y);
};

const ledgerTests = () => {
  const file = path.join(os.tmpdir(), `broll-ledger-${process.pid}.mp4`);
  fs.writeFileSync(file, 'x');
  let submits = 0;
  let queries = 0;
  let checks = 0;
  const ops = {
    submit: () => {
      submits += 1;
      return {taskId: 'new-task', provider: 'placeholder', file};
    },
    query: (entry) => {
      queries += 1;
      return {status: 'downloaded', file: entry.file};
    },
    check: (entry) => {
      checks += 1;
      return {file: entry.file, meta: {black: 0}};
    },
  };
  const first = resumeClip(null, 'hash-a', ops);
  check('首次会提交', first.submitted && first.entry.status === 'checked' && first.entry.taskId === 'new-task' && submits === 1 && checks === 1);
  submits = 0;
  checks = 0;
  queries = 0;
  const again = resumeClip(first.entry, 'hash-a', ops);
  check('哈希没变不重提', again.action === 'reuse' && !again.submitted && submits === 0 && queries === 0 && checks === 0);
  const pending = {requestHash: 'hash-a', taskId: 'task-kept', status: 'submitted', file, provider: 'placeholder'};
  check('有 task id 走查询', decide(pending, 'hash-a') === 'query');
  const queried = resumeClip(pending, 'hash-a', ops);
  check('查询不分配新任务号', queried.submitted === false && queries === 1 && checks === 1 && submits === 0 && queried.entry.taskId === 'task-kept' && queried.entry.status === 'checked');
  const downloaded = {requestHash: 'hash-a', taskId: 'task-kept', status: 'downloaded', file};
  check('已下载只检查', decide(downloaded, 'hash-a') === 'check');
  submits = 0;
  const changed = resumeClip(queried.entry, 'hash-b', ops);
  check('哈希变了要重提', changed.submitted && changed.entry.taskId === 'new-task' && submits === 1);
  fs.rmSync(file, {force: true});
};

// v0.9 三个模块各自的单测 + 集成测试：各是一个独立脚本，不下载模型、不联网、不花钱
const moduleSuites = () => {
  for (const name of ['asr.mjs', 'motion.mjs', 'motion-kit.mjs', 'styles.mjs', 'style-factory.mjs', 'integration.mjs', 'fixes.mjs', 'pick.mjs']) {
    const r = runNode([path.join('tests', 'broll', name)]);
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    const last = out
      .trim()
      .split(/\r?\n/)
      .filter((l) => !/MODULE_TYPELESS|Reparsing|To eliminate|trace-warnings/.test(l))
      .slice(-12)
      .join('\n');
    check(`模块测试 ${name}`, r.status === 0, last);
    console.log(`  ${name}：${r.status === 0 ? '通过' : '失败'}`);
  }
};

const mediaTests = () => {
  ensureDemo();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-ph-'));
  const dest = path.join(tmp, 'card.mp4');
  const frames = 75;
  renderPlaceholder({id: 'b01', plain: '先列计划再动手', sentence: '先把要做的事列出来', width: 540, height: 960, frames, dest});
  const probed = probeMedia(dest);
  check('占位片无音轨', probed.hasAudio === false, JSON.stringify(probed));
  check('占位片时长', Math.abs(probed.durationSec - frames / 30) < 1 / 30, String(probed.durationSec));
  const checked = checkClip({src: dest, dest: path.join(tmp, 'card-30.mp4'), frames, width: 540, height: 960, frameDir: path.join(tmp, 'frames'), id: 'b01', preset: 'ultrafast'});
  check('占位片检查', checked.meta.black === 0 && checked.meta.freeze === 0 && checked.meta.fps === 30 && fs.existsSync(checked.meta.pngs.mid), JSON.stringify(checked.meta));
  const black = path.join(tmp, 'black.mp4');
  const still = path.join(tmp, 'still.mp4');
  const enc = (color, file) => ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=320x180:r=30:d=2`, '-frames:v', '60', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', file]);
  check('黑场素材', enc('black', black).status === 0);
  check('静帧素材', enc('0x285AC8', still).status === 0);
  const blackMeta = checkClip({src: black, dest: path.join(tmp, 'black-out.mp4'), frames: 60, width: 320, height: 180, preset: 'ultrafast'});
  const stillMeta = checkClip({src: still, dest: path.join(tmp, 'still-out.mp4'), frames: 60, width: 320, height: 180, preset: 'ultrafast'});
  check('黑帧能查出来', blackMeta.meta.black > 0, JSON.stringify(blackMeta.meta));
  check('静帧能查出来', stillMeta.meta.freeze > 0, JSON.stringify(stillMeta.meta));
  const short = path.join(tmp, 'short.mp4');
  enc('0x224466', short);
  let shortMsg = '';
  try {
    prepareLocal({file: 'short.mp4', projectDir: tmp, windowSec: 4.92});
  } catch (e) {
    shortMsg = e.message;
  }
  check('本地片太短', shortMsg.includes('short.mp4') && shortMsg.includes('4.92'), shortMsg);
  fs.rmSync(tmp, {recursive: true, force: true});
};

const cliTests = () => {
  ensureDemo();
  fs.mkdirSync(LOGS, {recursive: true});
  const listed = runNode(['scripts/broll/list-cues.mjs', DEMO]);
  check('list-cues', listed.status === 0 && listed.stdout.includes('c1') && listed.stdout.includes('先看这一段口播') && listed.stdout.includes('c8'), listed.stdout);
  const valid = runNode(['scripts/broll/validate.mjs', DEMO]);
  check('validate 示例通过', valid.status === 0 && valid.stdout.includes('校验通过'), valid.stdout);
  const cases = [
    {
      name: 'overlap',
      doc: {
        ...demoDoc(),
        clips: [
          clip({id: 'b01', from: 'c2', to: 'c3', mode: 'split'}),
          clip({id: 'b02', from: 'c3', to: 'c4', mode: 'split', action: '从货架取下旧方块', end: '货架整齐'}),
        ],
      },
    },
    {name: 'lego', doc: {...demoDoc(), clips: [demoDoc().clips[0], {...demoDoc().clips[1], subject: '乐高小人'}]}},
    {name: 'burned-full', doc: {...demoDoc(), captions: 'burned'}},
  ];
  for (const item of cases) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-bad-'));
    fs.copyFileSync(path.join(DEMO, 'talk.mp4'), path.join(dir, 'talk.mp4'));
    fs.copyFileSync(path.join(DEMO, 'talk.srt'), path.join(dir, 'talk.srt'));
    fs.writeFileSync(path.join(dir, 'broll.json'), JSON.stringify(item.doc, null, 2), 'utf8');
    const r = runNode(['scripts/broll/validate.mjs', dir]);
    fs.writeFileSync(path.join(LOGS, `bad-${item.name}.txt`), r.stdout, 'utf8');
    check(`命令行反例 ${item.name}`, r.status === 1 && r.stdout.includes('怎么改'), r.stdout);
    fs.rmSync(dir, {recursive: true, force: true});
  }
  const inside = runNode(['scripts/make-talk.mjs', DEMO, '--out', path.join(ROOT, 'broll', 'inside-out'), '--dry-run']);
  check('仓库内输出被拒绝', inside.status === 2 && inside.stdout.includes('仓库里面'), inside.stdout);
  const dryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-dry-'));
  const dry = runNode(['scripts/make-talk.mjs', DEMO, '--out', dryDir, '--dry-run', '--provider', 'placeholder']);
  check('dry-run', dry.status === 0 && fs.existsSync(path.join(dryDir, 'broll.plan.json')) && !fs.existsSync(path.join(dryDir, 'video.mp4')) && dry.stdout.includes('不生成'), dry.stdout);
  fs.rmSync(dryDir, {recursive: true, force: true});
};

const near = (px, rgb, tol) => Math.abs(px[0] - rgb[0]) <= tol && Math.abs(px[1] - rgb[1]) <= tol && Math.abs(px[2] - rgb[2]) <= tol;
const readFrame = (file, sec) => {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-i', file, '-ss', String(sec), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], {windowsHide: true, maxBuffer: 32 * 1024 * 1024});
  if (r.status !== 0 || !r.stdout || r.stdout.length < 1080 * 1920 * 3) throw new Error(`读帧失败 ${sec}：${r.stderr}`);
  return r.stdout;
};
const pixel = (buf, x, y, width = 1080) => {
  const i = (y * width + x) * 3;
  return [buf[i], buf[i + 1], buf[i + 2]];
};

const renderTest = () => {
  ensureDemo();
  fs.rmSync(OUT, {recursive: true, force: true});
  console.log('渲染示例成片…');
  const r = runNode(['scripts/make-talk.mjs', DEMO, '--out', OUT, '--provider', 'placeholder']);
  fs.mkdirSync(LOGS, {recursive: true});
  fs.writeFileSync(path.join(LOGS, 'demo-placeholder.txt'), `${r.stdout || ''}\n${r.stderr || ''}`, 'utf8');
  check('make-talk 退出码', r.status === 0 && (r.stdout || '').includes('交付：'), r.stdout || r.stderr);
  if (r.status !== 0) return;
  const video = path.join(OUT, 'video.mp4');
  const src = probeMedia(path.join(DEMO, 'talk.mp4'));
  const out = probeMedia(video);
  check('成片时长等于原片', Math.abs(out.durationSec - src.durationSec) < 0.2, `${out.durationSec} vs ${src.durationSec}`);
  check('成片有音轨', out.hasAudio && out.width === 1080 && out.height === 1920, JSON.stringify(out));
  const vol = ffmpeg(['-hide_banner', '-i', video, '-af', 'volumedetect', '-f', 'null', '-']);
  const mean = /mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/.exec(`${vol.stderr || ''}`);
  check('音量还在', mean && Number(mean[1]) > -40, mean ? mean[1] : vol.stderr);
  const b01 = colorOf('b01');
  const b02 = colorOf('b02');
  const atB01 = pixel(readFrame(video, 5.1), 60, 640);
  const before = pixel(readFrame(video, 2.5), 60, 640);
  const atB02 = pixel(readFrame(video, 14.44), 60, 640);
  check('b01 出现在窗口里', near(atB01, [b01.r, b01.g, b01.b], 55), atB01.join(','));
  check('窗口前不是 b01', !near(before, [b01.r, b01.g, b01.b], 55), before.join(','));
  check('b02 出现在窗口里', near(atB02, [b02.r, b02.g, b02.b], 55) && !near(atB02, [b01.r, b01.g, b01.b], 55), atB02.join(','));
  const frame = readFrame(video, 5.1);
  const ref = pixel(frame, 60, 640);
  const cap = layoutOf('full', 1080, 1920).caption;
  let diff = 0;
  for (let y = cap.y; y < cap.y + cap.fontSize; y++) {
    for (let x = cap.x + 40; x < cap.x + cap.width - 40; x++) {
      const p = pixel(frame, x, y);
      if (Math.abs(p[0] - ref[0]) > 40 || Math.abs(p[1] - ref[1]) > 40 || Math.abs(p[2] - ref[2]) > 40) diff += 1;
    }
  }
  check('full 字幕在画面下方四分之一', diff > 150, String(diff));
  const manifest = readJson(path.join(OUT, 'manifest.json'));
  const dumped = JSON.stringify(manifest);
  check('manifest', manifest.status === 'delivered' && manifest.totalYuan === 0 && manifest.draft === false && manifest.inputs['talk.mp4'] && manifest.clips.length === 2 && manifest.clips[0].windowMs[0] === 3880 && !/[A-Za-z]:\\/.test(dumped), dumped.slice(0, 500));
  check('检查帧和拼图', ['b01-start', 'b01-mid', 'b01-end', 'b01-before', 'b01-after', 'b02-mid'].every((n) => fs.existsSync(path.join(OUT, 'check', `${n}.png`))) && fs.existsSync(path.join(OUT, 'sheet.png')));
  const b02clip = manifest.clips.find((c) => c.id === 'b02');
  const midSec = (b02clip.windowMs[0] + b02clip.windowMs[1]) / 2000;
  const shot = readFrame(video, midSec);
  const sheetFrame = readFrame(path.join(OUT, 'check', 'b02-mid.png'), 0);
  const topShot = pixel(shot, 40, 200);
  const botShot = pixel(shot, 40, 1600);
  const topPng = pixel(sheetFrame, 40, 200);
  const botPng = pixel(sheetFrame, 40, 1600);
  check(
    '检查帧来自成片',
    near(topPng, topShot, 20) && near(botPng, botShot, 20) && near(topPng, [b02.r, b02.g, b02.b], 55) && !near(botPng, [b02.r, b02.g, b02.b], 45),
    `png ${topPng}/${botPng} 成片 ${topShot}/${botShot}`,
  );
  const ledger = readJson(path.join(OUT, 'ledger.json'));
  let submits = 0;
  for (const c of manifest.clips) {
    const entry = ledger.clips[c.id];
    const step = resumeClip(entry, c.requestHash, {
      submit: () => {
        submits += 1;
        return {taskId: 'nope', provider: 'placeholder', file: entry.file};
      },
      query: () => {
        throw new Error('approved 不应再查询');
      },
      check: () => {
        throw new Error('approved 不应再检查');
      },
    });
    check(`成片账本复用 ${c.id}`, entry.taskId && entry.status === 'approved' && step.action === 'reuse');
  }
  check('成片账本不重提', submits === 0);
};

// v2：一段动效（steps）+ 一段 AI 占位。动效段直接画进成片，不进账本、不加「AI 生成画面」标
const renderMotionTest = () => {
  ensureDemo();
  fs.rmSync(OUT_MOTION, {recursive: true, force: true});
  console.log('渲染 v2 示例（动效 + 占位）…');
  const r = runNode(['scripts/make-talk.mjs', MOTION_DEMO, '--out', OUT_MOTION]);
  fs.mkdirSync(LOGS, {recursive: true});
  fs.writeFileSync(path.join(LOGS, 'motion-placeholder.txt'), `${r.stdout || ''}\n${r.stderr || ''}`, 'utf8');
  check('v2 make-talk 退出码', r.status === 0 && (r.stdout || '').includes('交付：'), r.stdout || r.stderr);
  if (r.status !== 0) return;
  const manifest = readJson(path.join(OUT_MOTION, 'manifest.json'));
  const [m, a] = manifest.clips;
  check('v2 manifest 记来源和模板', m.source === 'motion' && m.template === 'steps' && m.screenText.join('|') === '要做的事列出来|一步一步做完' && m.costYuan === 0 && a.source === 'ai' && a.styleId === 'wood-blocks' && manifest.totalYuan === 0, JSON.stringify(manifest.clips));
  check('v2 manifest 记转码原因和字幕来源', Array.isArray(manifest.inputs.talkNormalized?.reasons) && manifest.inputs.srtSource === 'user', JSON.stringify(manifest.inputs));
  const ledger = readJson(path.join(OUT_MOTION, 'ledger.json'));
  check('动效段不进账本', Object.keys(ledger.clips).join() === 'b02', JSON.stringify(Object.keys(ledger.clips)));
  const props = readJson(path.join(OUT_MOTION, 'talk-props.json'));
  check('props：动效段直接写进去', props.clips[0].kind === 'motion' && props.clips[0].badge === false && props.clips[0].template === 'steps' && !props.clips[0].src && props.clips[1].kind === 'video' && props.clips[1].badge === true, JSON.stringify(props.clips[0]).slice(0, 300));
  const video = path.join(OUT_MOTION, 'video.mp4');
  const out = probeMedia(video);
  check('v2 成片时长、音轨、尺寸', out.hasAudio && out.width === 1080 && out.height === 1920 && Math.abs(out.durationSec - 20) < 0.2, JSON.stringify(out));
  const midA = (m.windowMs[0] + m.windowMs[1]) / 2000;
  // 动效段在 split 上半：顶上平台栏那一条只有背景（积木风的暖木色桌面），和口播原片不一样
  const bar = pixel(readFrame(video, 2.5), 540, 120);
  const atMotion = pixel(readFrame(video, midA), 540, 120);
  check('动效段盖住了口播（积木风暖木色底）', !near(atMotion, bar, 40) && atMotion[0] > 200 && atMotion[1] > 180 && atMotion[2] > 150 && atMotion[0] > atMotion[2] + 15, `${atMotion} vs ${bar}`);
  const b02 = colorOf('b02');
  const midB = (a.windowMs[0] + a.windowMs[1]) / 2000;
  const top = pixel(readFrame(video, midB), 60, 300);
  check('AI 占位段在 split 上半', near(top, [b02.r, b02.g, b02.b], 55), `${top}`);
  check('v2 检查帧和拼图', ['b01-mid', 'b02-mid'].every((n) => fs.existsSync(path.join(OUT_MOTION, 'check', `${n}.png`))) && fs.existsSync(path.join(OUT_MOTION, 'sheet.png')));
  const sheet = runNode(['scripts/broll/review-sheet.mjs', MOTION_DEMO, '--out', OUT_MOTION]);
  const htmlFile = path.join(OUT_MOTION, 'review.html');
  const html = fs.existsSync(htmlFile) ? fs.readFileSync(htmlFile, 'utf8') : '';
  check('审片页：动效段标「不用审」并列出上屏字', sheet.status === 0 && html.includes('动效，不用审') && html.includes('要做的事列出来') && html.includes('积木风（wood-blocks）'), sheet.stdout);
};

const listen = (handler) =>
  new Promise((resolve) => {
    const state = {posts: 0, bodies: []};
    const server = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      state.posts += 1;
      state.bodies.push(raw);
      handler(req, res, state, raw);
    });
    server.listen(0, '127.0.0.1', () => resolve({state, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done))}));
  });

const llmEnv = (base, extra = {}) => ({
  ...process.env,
  LLM_API_KEY: 'unit-test-key',
  DEEPSEEK_API_KEY: '',
  LLM_BASE_URL: base,
  LLM_MODEL: 'fake-model',
  ...extra,
});

const copyDemo = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-llm-'));
  fs.copyFileSync(path.join(DEMO, 'talk.mp4'), path.join(dir, 'talk.mp4'));
  fs.copyFileSync(path.join(DEMO, 'talk.srt'), path.join(dir, 'talk.srt'));
  return dir;
};

const llmTests = async () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'broll', 'llm_broll.mjs'), 'utf8');
  const dryAt = src.indexOf('未调用任何接口');
  const readAt = src.indexOf('readLlmEnv()');
  check('dry-run 源码在读密钥之前返回', dryAt > 0 && readAt > dryAt, `dry ${dryAt} read ${readAt}`);

  const quiet = await listen((req, res) => {
    res.writeHead(500);
    res.end('should-not-be-called');
  });
  try {
    const canary = 'CANARYDO_NOT_LEAK_12345678';
    const dry = await runNodeEnv(
      ['scripts/broll/llm_broll.mjs', DEMO, '--dry-run', '--style', 'brick-diorama', '--budget', '20', '--captions', 'add'],
      llmEnv(quiet.base, {LLM_API_KEY: canary, DEEPSEEK_API_KEY: canary}),
    );
    const out = `${dry.stdout || ''}${dry.stderr || ''}`;
    check('dry-run 退出码 0', dry.status === 0, out.slice(-500));
    check('dry-run 打印提示和 token', out.includes('估算约') && out.includes('输入 token') && out.includes('未调用任何接口') && out.includes('正确示例') && out.includes('先看这一段口播'), out.slice(0, 200));
    // 像密钥的串：sk- 后面至少 8 位（和 llm-client 的 SECRET_RE 一样）；SKILL 里提到「sk-cp- 开头的订阅 key」不算
    check('dry-run 不读密钥', quiet.state.posts === 0 && !out.includes(canary) && !out.includes('CANARY') && !/sk-[A-Za-z0-9_-]{8,}/.test(out), `posts ${quiet.state.posts}`);
  } finally {
    await quiet.close();
  }

  const nokey = await runNodeEnv(['scripts/broll/llm_broll.mjs', DEMO], llmEnv('http://127.0.0.1:9', {LLM_API_KEY: '', DEEPSEEK_API_KEY: ''}));
  check('没有密钥就停', nokey.status === 2 && `${nokey.stdout}`.includes('DEEPSEEK_API_KEY') && !`${nokey.stdout}${nokey.stderr}`.includes('unit-test-key'));

  const badDir = copyDemo();
  const goodDir = copyDemo();
  const bad = demoDoc();
  bad.clips[0] = {...bad.clips[0], subject: '凸点机器人'};
  const badJson = JSON.stringify(bad);
  const goodJson = JSON.stringify(demoDoc());
  const chat = await listen((req, res, state) => {
    const content = state.posts === 1 ? badJson : goodJson;
    const payload = Buffer.from(JSON.stringify({choices: [{message: {content}}], usage: {prompt_tokens: 3, completion_tokens: 4}}));
    res.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': payload.length});
    res.end(payload);
  });
  try {
    const fixed = await runNodeEnv(['scripts/broll/llm_broll.mjs', goodDir, '--style', 'brick-diorama'], llmEnv(chat.base));
    const fixedOut = `${fixed.stdout || ''}${fixed.stderr || ''}`;
    check('回喂后通过', fixed.status === 0 && chat.state.posts === 2 && chat.state.bodies[1].includes('凸点') && chat.state.bodies[1].includes('怎么改'), fixedOut.slice(-800));
    check('通过后不留报错文件', !fs.existsSync(path.join(goodDir, 'broll.llm-error.txt')) && fs.existsSync(path.join(goodDir, 'broll.json')));
    const passedDoc = readJson(path.join(goodDir, 'broll.json'));
    check('回喂后是合法示例', passedDoc.clips?.[0]?.subject === '蓝色积木机器人' && passedDoc.provider === 'placeholder');
  } finally {
    await chat.close();
  }

  const stuck = await listen((req, res) => {
    const payload = Buffer.from(JSON.stringify({choices: [{message: {content: '{"version":1}'}}], usage: {}}));
    res.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': payload.length});
    res.end(payload);
  });
  try {
    const failed = await runNodeEnv(['scripts/broll/llm_broll.mjs', badDir], llmEnv(stuck.base));
    const failedOut = `${failed.stdout || ''}${failed.stderr || ''}`;
    const errFile = path.join(badDir, 'broll.llm-error.txt');
    check('最多 3 轮后停', failed.status === 1 && stuck.state.posts === 3 && fs.existsSync(path.join(badDir, 'broll.json')) && fs.existsSync(errFile), `status ${failed.status} posts ${stuck.state.posts} ${failedOut.slice(-400)}`);
    check('报错原文留在项目目录', fs.readFileSync(errFile, 'utf8').includes('怎么改'));
  } finally {
    await stuck.close();
    fs.rmSync(badDir, {recursive: true, force: true});
    fs.rmSync(goodDir, {recursive: true, force: true});
  }

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const imgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-img-'));
  const ref = path.join(imgDir, 'ref.png');
  fs.writeFileSync(ref, png);
  const img = await listen((req, res, state, raw) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/v1/image_generation') {
      state.last = JSON.parse(raw);
      if (state.fail) {
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({base_resp: {status_code: 1000, status_msg: 'down'}}));
        return;
      }
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({data: {image_urls: ['http://127.0.0.1/dl/a.jpg']}, base_resp: {status_code: 0, status_msg: 'success'}}));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  try {
    const client = createH3Client({baseUrl: img.base, env: {MINIMAX_API_KEY: 'unit-test-key', MINIMAX_BASE_URL: img.base}, log: () => {}});
    await client.image({prompt: 'robot', aspect: '1:1', subjectPath: ref});
    const refBody = img.state.last?.subject_reference?.[0];
    check('主体参考进请求', img.state.posts === 1 && refBody?.type === 'character' && String(refBody?.image_file || '').startsWith('data:image/png;base64,'));
    img.state.fail = true;
    const before = img.state.posts;
    let threw = false;
    try {
      await client.image({prompt: 'robot', aspect: '1:1'});
    } catch {
      threw = true;
    }
    check('参考图失败不重试', threw && img.state.posts === before + 1);
  } finally {
    await img.close();
    fs.rmSync(imgDir, {recursive: true, force: true});
  }
};

// 假接口和被测进程在同一个事件循环里。spawnSync 会卡住循环，请求一直等不到回应。
const runNodeEnv = (args, env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, {cwd: ROOT, windowsHide: true, env});
  const out = [];
  const err = [];
  child.stdout.on('data', (d) => out.push(d));
  child.stderr.on('data', (d) => err.push(d));
  child.on('error', reject);
  child.on('close', (status) => resolve({status, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8')}));
});

const main = async () => {
  ensureDemo();
  srtTests();
  timeTests();
  ruleTests();
  layoutTests();
  ledgerTests();
  mediaTests();
  cliTests();
  await llmTests();
  await h3Tests({check, runNode, ROOT, DEMO});
  console.log('模块测试…');
  moduleSuites();
  if (failures.length) {
    console.log(`失败 ${failures.length}，通过 ${passed}`);
    for (const f of failures) console.log(`- ${f}`);
    process.exit(1);
  }
  console.log(`单元通过 ${passed}`);
  if (unitsOnly) process.exit(0);
  renderTest();
  renderMotionTest();
  if (failures.length) {
    console.log(`失败 ${failures.length}，通过 ${passed}`);
    for (const f of failures) console.log(`- ${f}`);
    process.exit(1);
  }
  console.log(`全部通过 ${passed}`);
};

main();
