#!/usr/bin/env node
// 用 DeepSeek 再测 10 条简报。不调 MiniMax。调用次数封在 25。
// 输出写到仓库外。密钥只从环境变量读，不打印、不落盘。
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ICONS from '../../template/src/core/icons.json' with {type: 'json'};
import {layoutBlocks} from '../../template/src/scene/geom.ts';
import {auditPlan, glyphCount, prepareScene} from '../../template/src/scene/prepare.ts';
import {callLlm, readLlmEnv} from '../broll/llm-client.mjs';
import {sceneFrame} from './geom.mjs';
import {loadStyle} from './tokens.mjs';
import {validateScene} from './validate-scene.mjs';

const iconNames = Object.keys(ICONS).join('、');

export const prompt = `你只输出一个 JSON 对象，不要 markdown。这是 scene.json。不要写坐标、像素、帧号、毫秒。

字段名必须是 role，不要写 type。要点数组必须叫 items，不要叫 points。emphasis 必须是字符串数组，不要写成一个字符串。数字必须写在 number 对象里，不要把 text、fact 放在屏的根上。

最外层 product 用 promo，aspect 用 9:16，style 用 fresh-light，motion 用 bounce。facts 只有一条：id 写 f1，text 照抄给出的那句原文，source 照抄来源名。screens 写 4 到 5 屏。

字数按去掉空格后计算。写超了，第一轮就排不下：
- claim：text 最多 16 字，写成一句判断，不要把简报的一句话原样搬上来。emphasis 是 text 里连续的几个字。support 最多 16 字，可以不写。kicker 最多 8 字。layout 用 hero 或 board。
- points：2 到 4 条。每条 text 最多 12 字，从简报要点里摘短句，放在 items 里。不要写 note。可选 icon，只能是这些名字：${iconNames}。layout 用 grid 或 sequence。
- number：layout 用 board。number 是对象，含 text、fact、label。text 只写数字和单位，最多 6 个字，例如「9 分钟」「62%」，而且必须是事实原文里的连续一段。整句放进 label，label 最多 16 字。fact 写 f1。title 最多 12 字。kicker 最多 8 字。不要再编一个数。
- compare：没有两边对照就不要写。left、right 各有 label（最多 6 字）和 items（每条最多 8 字的字符串数组）。layout 用 split。
- media：只有用户消息里给出素材清单时才能用。src 必须和清单里的路径逐字相同，source 写 screenshot，layout 用 board，title 最多 12 字。callouts 写 1 到 2 个，x、y、w、h 都是 0 到 1 的小数，label 最多 12 字。没有清单就不要写 media，不要编造文件名或截图。
- chart：简报里能放在一起比的数字不足 2 个就不要用，不要编数据点。要用时 layout 写 chart，chart 写 bar，每个 point 有 label（最多 6 字）和 value，value 必须出现在事实原文里，title 最多 12 字，fact 写 f1。
- action：brand 用产品名，最多 8 字。line 是一句收束，最多 16 字。layout 用 end。简报里没有获取方式就不要写 cta。
- dialogue 不要用。

版式多样性：同一版式连续不超过 2 屏，全片至少用 3 种版式。不要连续三屏都是 hero。有素材清单时放一屏 media，有关键数字时放一屏 number，要点放 grid 或 sequence，开头放一句判断，结尾放 action。

文案只能摘简报，不要加简报里没有的数字。

每一屏都要写 narration。这是口播，用简报里的话写成一句完整的口语，可以比屏上的标题长。不要只把 text、title、items 或 number.text 原样再写一遍：这些字已经在画面上。旁白要带上画面上没有的那半句，比如对象、原因或下一步。narration 不能是空字符串。

例子只说明字段，不要照抄产品和文案，src 也不要照抄：
{"product":"promo","aspect":"9:16","style":"fresh-light","motion":"bounce","facts":[{"id":"f1","text":"样例平均要 4 分钟。","source":"样例记录"}],"screens":[{"role":"claim","layout":"hero","narration":"先看完这一屏，再决定要不要回。","text":"先看完再回","emphasis":["看完"],"support":"不要急着发"},{"role":"points","layout":"grid","narration":"先看语气，再写回复，两步都做完再发。","items":[{"text":"先看语气","icon":"eye"},{"text":"再写回复","icon":"send"}]},{"role":"number","layout":"board","narration":"样例平均要 4 分钟，不赶着发。","kicker":"● 趋势","title":"还要一会儿","number":{"text":"4 分钟","fact":"f1","label":"样例平均"}},{"role":"action","layout":"end","narration":"看完再回，按这个改一版。","brand":"样例","line":"看完再回"}]}`;

function parseJson(content) {
  const text = String(content || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(text);
}

function visibleText(scene) {
  const parts = [];
  for (const screen of scene.screens || []) {
    for (const key of ['text', 'title', 'support', 'line', 'kicker', 'brand', 'cta', 'narration']) {
      if (screen[key]) parts.push(String(screen[key]));
    }
    if (screen.number) parts.push(`${screen.number.text || ''} ${screen.number.label || ''}`);
    for (const item of screen.items || []) parts.push(`${item.text || ''} ${item.note || ''}`);
    for (const side of ['left', 'right']) {
      const pane = screen[side];
      if (!pane) continue;
      parts.push(String(pane.label || ''));
      for (const item of pane.items || []) parts.push(String(item));
    }
  }
  return parts.join('\n');
}

function numbersIn(text) {
  const cleaned = String(text).replace(/(\d),(\d{3})/g, '$1$2');
  return [...cleaned.matchAll(/\d+(?:\.\d+)?/g)].map((item) => item[0]);
}

function failureKind(error) {
  const blob = `${error.where} ${error.problem}`;
  if (blob.includes('图标')) return 'icon';
  if (blob.includes('chart') || blob.includes('图表') || blob.includes('事实')) return 'fact';
  if (blob.includes('media') || blob.includes('标注')) return 'media';
  if (blob.includes('dialogue') || blob.includes('对话')) return 'dialogue';
  if (blob.includes('layout') || blob.includes('不能用')) return 'layout';
  if (blob.includes('when') || blob.includes('旁白')) return 'when';
  if (blob.includes('motion') || blob.includes('性格')) return 'motion';
  return 'other';
}

function fits(scene) {
  const token = loadStyle(scene.product, scene.style);
  if (!token) return {ok: false, reason: '风格读不到'};
  const frame = sceneFrame(scene.product, scene.aspect);
  const plan = prepareScene({scene, roles: token.roles, extra: token.extra, frame});
  const issues = auditPlan(plan).filter((item) => !item.startsWith('成片') && !item.includes('画幅'));
  const overflow = [];
  for (const screen of plan.screens) {
    const bands = screen.layout === 'board' || screen.layout === 'number'
      ? screen.blocks.map((block) => {
        if (block.kind === 'kicker') return 'kicker';
        if (block.kind === 'stage') return 'number';
        if (block.kind === 'evidence') return 'evidence';
        if (block.kind === 'caption') return 'caption';
        return 'title';
      })
      : undefined;
    const placed = layoutBlocks({
      layout: screen.layout === 'number' ? 'number' : screen.layout,
      count: screen.blocks.length,
      chars: screen.blocks.map((block) => glyphCount(block.text || ' ')),
      safe: frame.safe,
      floor: frame.floor,
      maxRow: frame.maxRow,
      density: scene.density || 'regular',
      align: plan.align,
      portrait: frame.portrait,
      ...(bands ? {bands} : {}),
      ...(screen.callouts ? {callouts: screen.callouts} : {}),
    });
    if (placed.overflow) overflow.push(screen.layout);
  }
  return {ok: issues.length === 0 && overflow.length === 0, issues, overflow};
}

async function main() {
const OUT = process.argv[2];
const IDS = ['01', '03', '05', '07', '09', '11', '13', '15', '17', '19'];
if (!OUT) {
  console.error('用法: node scripts/scene/deepseek-layouts.mjs <仓库外目录>');
  process.exit(2);
}
const briefs = JSON.parse(readFileSync(path.join('H:/ai_tool/promo-video-skill-tests/v0150-scene/ab/briefs/briefs.json'), 'utf8'));
const picked = IDS.map((id) => briefs.find((item) => item.id === id)).filter(Boolean);

let calls = 0;
const fetchImpl = (url, init) => {
  calls += 1;
  if (calls > 25) throw new Error('已到 25 次上限，停止');
  return fetch(url, init);
};

const cfg = readLlmEnv();
if (!cfg.key) {
  console.error('没有 DeepSeek 密钥，跳过。环境变量未打印。');
  process.exit(3);
}
if (/minimax/i.test(cfg.model) || /minimax/i.test(cfg.base)) {
  console.error('这个脚本不调 MiniMax');
  process.exit(2);
}

mkdirSync(OUT, {recursive: true});
const rows = [];
for (const brief of picked) {
  const user = `产品：${brief.product}\n一句话：${brief.oneLiner}\n要点：${brief.points.join('、')}\n原文：${brief.fact.text}\n来源：${brief.fact.source}`;
  let content = '';
  let error = '';
  try {
    const res = await callLlm(
      [{role: 'system', content: prompt}, {role: 'user', content: user}],
      cfg,
      {temperature: 0, json: true, timeoutMs: 120000, fetchImpl, log: (line) => console.log(line)},
    );
    content = res.content;
  } catch (err) {
    error = String(err?.message || err);
  }
  writeFileSync(path.join(OUT, `${brief.id}.txt`), content || error, 'utf8');
  const row = {id: brief.id, calls, structure: false, fits: false, fact: false, kinds: [], rewrites: 0};
  if (!content) {
    row.kinds.push('request');
    row.error = error.slice(0, 180);
    rows.push(row);
    console.log(`${brief.id} 请求失败`);
    continue;
  }
  let scene;
  try {
    scene = parseJson(content);
  } catch {
    row.kinds.push('json');
    rows.push(row);
    console.log(`${brief.id} JSON 解析失败`);
    continue;
  }
  const result = validateScene(scene);
  row.rewrites = result.rewrites.length;
  row.screens = Array.isArray(scene.screens) ? scene.screens.length : 0;
  if (!result.ok || row.screens < 4 || row.screens > 5) {
    row.kinds = result.errors.length ? [...new Set(result.errors.map(failureKind))] : ['count'];
    row.errors = result.errors.slice(0, 4).map((item) => `${item.where}：${item.problem}`);
  } else {
    row.structure = true;
    const laid = fits(result.scene);
    row.fits = laid.ok;
    if (!laid.ok) row.kinds.push(laid.overflow?.length ? 'overflow' : 'audit');
  }
  const allowed = new Set(numbersIn(`${brief.oneLiner}\n${brief.points.join('\n')}\n${brief.fact.text}`));
  const extra = numbersIn(visibleText(scene)).filter((value) => !allowed.has(value));
  row.fact = extra.length === 0;
  if (extra.length) row.kinds.push('extra-number');
  row.extra = extra;
  rows.push(row);
  console.log(`${brief.id} 结构 ${row.structure ? '过' : '不过'} 排下 ${row.fits ? '过' : '不过'} 数字 ${row.fact ? '过' : '不过'} ${row.kinds.join(',')}`);
}

const summary = {
  calls,
  n: rows.length,
  structure: rows.filter((row) => row.structure).length,
  fits: rows.filter((row) => row.fits).length,
  fact: rows.filter((row) => row.fact).length,
  rows,
};
writeFileSync(path.join(OUT, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`DeepSeek 调用 ${calls} 次。结构 ${summary.structure}/${summary.n}，不改文案排下 ${summary.fits}/${summary.n}，数字 ${summary.fact}/${summary.n}`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invoked) await main();
