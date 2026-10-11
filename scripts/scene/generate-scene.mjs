#!/usr/bin/env node
// 便宜模型写 scene.json，校验和几何审计的原文回喂，最多 3 轮。
//   node scripts/scene/generate-scene.mjs <brief.json|md> --out <scene.json>
//   node scripts/scene/generate-scene.mjs --batch <briefs.json> --out-dir <目录> [--ids 01,03]
// 不调 MiniMax。调用次数记在输出目录的 calls.json，总数不超过 35。3 轮不过不写文件。
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {callLlm, extractJson, readLlmEnv, redactSecrets} from '../broll/llm-client.mjs';
import {auditPlan, prepareScene} from '../../template/src/scene/prepare.ts';
import {prompt} from './deepseek-layouts.mjs';
import {sceneFrame} from './geom.mjs';
import {loadStyle} from './tokens.mjs';
import {formatReport, validateScene} from './validate-scene.mjs';

const MAX_ROUNDS = 3;
const MAX_CALLS = 35;
const DEFAULT_IDS = ['01', '03', '05', '07', '09', '11', '13', '15', '17', '19'];

function argsOf(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else flags[key] = '1';
    } else positional.push(arg);
  }
  return {flags, positional};
}

function say(line) {
  console.log(redactSecrets(line));
}

function userFromFile(file) {
  const raw = readFileSync(file, 'utf8');
  if (file.toLowerCase().endsWith('.md')) return raw;
  const data = JSON.parse(raw);
  if (Array.isArray(data)) throw new Error('这份 JSON 是数组。一次只喂一条简报，或改用 --batch');
  return userFromBrief(data, raw);
}

function assetLines(data) {
  const assets = Array.isArray(data?.assets) ? data.assets : [];
  const rows = assets.filter((item) => item && item.file && item.note);
  if (!rows.length) return '素材清单：没有。不要用 media，不要编造截图路径。';
  const lines = rows.map((item) => `- ${item.file}：${item.note}`);
  return `素材清单（src 只能用下面这些路径，逐字复制，不要编造）：\n${lines.join('\n')}\n请用一屏 media，layout 用 board，把其中一张图放进 src。`;
}

function userFromBrief(data, raw) {
  if (data && data.product && data.oneLiner && data.fact) {
    const points = Array.isArray(data.points) ? data.points.join('、') : '';
    return `产品：${data.product}\n一句话：${data.oneLiner}\n要点：${points}\n原文：${data.fact.text}\n来源：${data.fact.source}\n${assetLines(data)}`;
  }
  return raw ?? JSON.stringify(data);
}

function numbersIn(text) {
  const cleaned = String(text).replace(/(\d),(\d{3})/g, '$1$2');
  return [...cleaned.matchAll(/\d+(?:\.\d+)?/g)].map((item) => item[0]);
}

function listedAssets(user) {
  return [...String(user).matchAll(/^-\s+(\S+)：/gm)].map((item) => item[1]);
}

function visibleCopy(scene) {
  const parts = [];
  for (const screen of scene?.screens || []) {
    if (!screen || typeof screen !== 'object') continue;
    for (const key of ['text', 'title', 'support', 'line', 'kicker', 'brand', 'cta', 'narration']) {
      if (screen[key]) parts.push(String(screen[key]));
    }
    if (screen.number) parts.push(`${screen.number.text || ''} ${screen.number.label || ''}`);
    for (const item of screen.items || []) parts.push(`${item?.text || ''} ${item?.note || ''}`);
    for (const side of ['left', 'right']) {
      const pane = screen[side];
      if (!pane) continue;
      parts.push(String(pane.label || ''));
      for (const item of pane.items || []) parts.push(String(item));
    }
    for (const row of screen.rows || []) parts.push(`${row?.label || ''} ${row?.value || ''}`);
    for (const point of screen.points || []) parts.push(`${point?.label || ''} ${point?.value ?? ''}`);
    if (screen.code) parts.push(String(screen.code));
  }
  return parts.join('\n');
}

function contentIssues(scene, user) {
  const lines = [];
  const allowed = listedAssets(user);
  const srcs = [];
  for (const screen of scene?.screens || []) {
    if (screen?.src) srcs.push(String(screen.src));
  }
  for (const src of srcs) {
    if (!allowed.includes(src)) {
      lines.push(allowed.length
        ? `src「${src}」不在素材清单里。改成清单上的路径，或删掉这屏 media`
        : `没有素材还写了 src「${src}」。删掉 media，不要编造截图`);
    }
  }
  const allowedNumbers = new Set(numbersIn(user));
  const extra = [...new Set(numbersIn(visibleCopy(scene)).filter((value) => !allowedNumbers.has(value)))];
  if (extra.length) lines.push(`这些数字不在简报里：${extra.join('、')}。删掉，或改成简报原文里有的数`);
  (scene?.screens || []).forEach((screen, index) => {
    if (!String(screen?.narration || '').trim()) {
      lines.push(`第 ${index + 1} 屏没有 narration。每一屏都要写口播，用简报里的话，并带上画面上没有的半句`);
    }
  });
  return lines;
}

function geometryReport(scene) {
  const token = loadStyle(scene.product, scene.style);
  if (!token) return {ok: false, lines: ['风格读不到']};
  const frame = sceneFrame(scene.product, scene.aspect);
  let plan;
  try {
    plan = prepareScene({scene, roles: token.roles, extra: token.extra, frame});
  } catch (error) {
    return {ok: false, lines: [`几何准备失败：${redactSecrets(error?.message || String(error))}`]};
  }
  const lines = auditPlan(plan).filter((item) => !item.startsWith('成片') && !item.includes('画幅'));
  plan.screens.forEach((screen, index) => {
    if (screen.overflow) lines.push(`第 ${index + 1} 屏 ${screen.layout} 几何溢出：字或层放不进安全区`);
  });
  return {ok: lines.length === 0, lines};
}

function loadCalls(file) {
  if (!existsSync(file)) return 0;
  try {
    return Number(JSON.parse(readFileSync(file, 'utf8')).calls) || 0;
  } catch {
    return 0;
  }
}

function makeFetch(ledger) {
  let calls = loadCalls(ledger);
  const fetchImpl = (url, init) => {
    calls += 1;
    writeFileSync(ledger, `${JSON.stringify({calls})}\n`, 'utf8');
    if (calls > MAX_CALLS) throw new Error('已到 35 次上限，停止');
    return fetch(url, init);
  };
  return {fetchImpl, read: () => calls};
}

async function revise(user, cfg, fetchImpl) {
  let messages = [
    {role: 'system', content: prompt},
    {role: 'user', content: user},
  ];
  const trace = [];
  let lastText = '';
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let content = '';
    try {
      const res = await callLlm(messages, cfg, {
        temperature: 0,
        json: true,
        timeoutMs: 70000,
        retryDelayMs: 800,
        fetchImpl,
        log: (line) => say(`  ${line}`),
      });
      content = res.content;
    } catch (error) {
      lastText = redactSecrets(error?.message || String(error));
      trace.push({round, structure: false, fit: false, error: lastText});
      break;
    }
    let scene;
    try {
      const parsed = JSON.parse(extractJson(content));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('模型返回的不是一个 JSON 对象');
      scene = parsed;
    } catch (error) {
      lastText = `JSON 解析失败：${redactSecrets(error?.message || String(error))}`;
      trace.push({round, structure: false, fit: false, error: lastText});
      if (round === MAX_ROUNDS) break;
      messages = messages.concat([
        {role: 'assistant', content: String(content)},
        {role: 'user', content: `校验未通过。下面是报错原文，请逐条修改，其余能用的内容保持不变。只输出完整的新 JSON。\n\n${lastText}`},
      ]);
      continue;
    }
    const result = validateScene(scene);
    const screens = Array.isArray(result.scene?.screens) ? result.scene.screens.length : 0;
    const structure = Boolean(result.ok && screens >= 4 && screens <= 5);
    let report = formatReport(result);
    if (result.ok && (screens < 4 || screens > 5)) report += `\nscreens 要 4 到 5 屏，现在是 ${screens} 屏`;
    let fit = false;
    let contentOk = false;
    if (structure) {
      const geo = geometryReport(result.scene);
      fit = geo.ok;
      if (!geo.ok) report += `\n几何审计：\n${geo.lines.join('\n')}`;
      const content = contentIssues(result.scene, user);
      contentOk = content.length === 0;
      if (!contentOk) report += `\n内容：\n${content.join('\n')}`;
    }
    trace.push({round, structure, fit, content: contentOk, screens, report});
    if (structure && fit && contentOk) return {ok: true, scene: result.scene, passedRound: round, trace};
    lastText = report;
    if (round === MAX_ROUNDS) break;
    const body = JSON.stringify(result.scene ?? scene);
    messages = messages.concat([
      {role: 'assistant', content: body},
      {role: 'user', content: `校验未通过。下面是校验脚本的原文，请逐条按「怎么改」修改，其余能用的内容保持不变。只输出完整的新 JSON。\n\n${report}`},
    ]);
  }
  return {ok: false, passedRound: 0, trace, error: lastText};
}

function statusAt(row, round) {
  if (row.passedRound && row.passedRound <= round) return {structure: true, fit: true};
  const seen = (row.trace || []).filter((item) => item.round <= round);
  const last = seen[seen.length - 1];
  if (!last) return {structure: false, fit: false};
  return {structure: Boolean(last.structure), fit: Boolean(last.fit)};
}

function summarize(rows, calls) {
  const after = {};
  for (const round of [1, 2, 3]) {
    const structure = rows.filter((row) => statusAt(row, round).structure).length;
    const fits = rows.filter((row) => statusAt(row, round).fit).length;
    after[String(round)] = {structure, fits, n: rows.length};
  }
  return {calls, n: rows.length, after, rows};
}

function writeScene(file, scene) {
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, `${JSON.stringify(scene, null, 2)}\n`, 'utf8');
}

async function runOne(file, out, cfg, bucket) {
  const user = userFromFile(file);
  say(`简报 ${path.basename(file)}`);
  const result = await revise(user, cfg, bucket.fetchImpl);
  if (!result.ok) {
    say(result.error || '3 轮后仍未通过');
    say('未写文件');
    return result;
  }
  writeScene(out, result.scene);
  say(`第 ${result.passedRound} 轮通过，已写 ${out}`);
  return result;
}

async function runBatch(flags, cfg) {
  const briefsPath = flags.batch;
  const outDir = flags['out-dir'];
  if (!briefsPath || !outDir) {
    say('用法: node scripts/scene/generate-scene.mjs --batch <briefs.json> --out-dir <目录> [--ids 01,03]');
    process.exit(2);
  }
  mkdirSync(outDir, {recursive: true});
  const ledger = path.join(outDir, 'calls.json');
  const bucket = makeFetch(ledger);
  if (bucket.read() >= MAX_CALLS) {
    say('已到 35 次上限，停止');
    process.exit(2);
  }
  const briefs = JSON.parse(readFileSync(briefsPath, 'utf8'));
  if (!Array.isArray(briefs)) throw new Error('batch 文件要是简报数组');
  const assetMap = flags.assets ? JSON.parse(readFileSync(flags.assets, 'utf8')) : {};
  const ids = (flags.ids || DEFAULT_IDS.join(',')).split(',').map((item) => item.trim()).filter(Boolean);
  const summaryPath = path.join(outDir, 'summary.json');
  const previous = existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, 'utf8')) : {rows: []};
  const byId = new Map((previous.rows || []).map((row) => [row.id, row]));
  for (const id of ids) {
    if (bucket.read() >= MAX_CALLS) {
      say('已到 35 次上限，剩下的简报不再请求');
      break;
    }
    const found = briefs.find((item) => item.id === id);
    if (!found) {
      say(`${id} 不在简报里`);
      continue;
    }
    const brief = assetMap[id] ? {...found, assets: assetMap[id]} : found;
    say(`—— ${id} ${brief.product} ——`);
    const result = await revise(userFromBrief(brief), cfg, bucket.fetchImpl);
    const row = {
      id,
      passedRound: result.passedRound || 0,
      trace: (result.trace || []).map((item) => ({
        round: item.round,
        structure: Boolean(item.structure),
        fit: Boolean(item.fit),
        content: Boolean(item.content),
        screens: item.screens ?? 0,
        error: item.error ? redactSecrets(item.error).slice(0, 240) : '',
      })),
    };
    if (result.ok) {
      const scenePath = path.join(outDir, `${id}.scene.json`);
      writeScene(scenePath, result.scene);
      row.scene = `${id}.scene.json`;
      row.layouts = result.scene.screens.map((screen) => screen.layout);
      row.roles = result.scene.screens.map((screen) => screen.role);
      row.srcs = result.scene.screens.map((screen) => screen.src).filter(Boolean);
      say(`${id} 第 ${result.passedRound} 轮通过`);
    } else {
      say(`${id} 未通过`);
      say(redactSecrets(result.error || '').slice(0, 500));
    }
    byId.set(id, row);
    const rows = [...byId.values()];
    writeFileSync(summaryPath, `${JSON.stringify(summarize(rows, bucket.read()), null, 2)}\n`, 'utf8');
  }
  const rows = [...byId.values()];
  const summary = summarize(rows, bucket.read());
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  for (const round of [1, 2, 3]) {
    const item = summary.after[String(round)];
    say(`第 ${round} 轮之后 结构 ${item.structure}/${item.n} 排下 ${item.fits}/${item.n}`);
  }
  say(`DeepSeek 累计调用 ${summary.calls} 次`);
}

const {flags, positional} = argsOf(process.argv.slice(2));
const cfg = readLlmEnv();
if (!cfg.key) {
  say('没有 DeepSeek 密钥。设 DEEPSEEK_API_KEY 或 LLM_API_KEY。环境变量未打印。');
  process.exit(3);
}
if (/minimax/i.test(`${cfg.model} ${cfg.base}`)) {
  say('这个脚本不调 MiniMax');
  process.exit(2);
}
say(`模型 ${cfg.model}`);

if (flags.batch) {
  await runBatch(flags, cfg);
} else {
  const file = positional[0];
  const out = flags.out;
  if (!file || !out) {
    say('用法: node scripts/scene/generate-scene.mjs <brief.json|md> --out <scene.json>');
    say('      node scripts/scene/generate-scene.mjs --batch <briefs.json> --out-dir <目录> [--ids 01,03]');
    process.exit(2);
  }
  const ledger = path.join(path.dirname(out), 'calls.json');
  mkdirSync(path.dirname(out), {recursive: true});
  const bucket = makeFetch(ledger);
  if (bucket.read() >= MAX_CALLS) {
    say('已到 35 次上限，停止');
    process.exit(2);
  }
  const result = await runOne(file, out, cfg, bucket);
  if (!result.ok) process.exit(1);
}
