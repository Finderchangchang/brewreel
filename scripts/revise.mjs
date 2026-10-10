#!/usr/bin/env node
// 一句话改稿。便宜模型只返回修改清单，校验通过才写回。
//   node scripts/revise.mjs <storyboard.json|lesson.json|broll.json> "第三镜慢一点，开头换成提问"
//   --dry-run          只印清单和 diff，不写文件
//   --render           校验通过后出整片（默认：宣传片只出改动镜头静帧；讲课和口播只提示命令）
//   --mock-llm <json>  假模型，不联网。也认环境变量 REVISE_MOCK_LLM
//   --out <目录>       宣传片静帧 / --render 的输出目录（必须在仓库外）
//   --max-rounds <n>   校验回喂轮数，默认 3
//
// 模型返回 {"asks":[{"ask":"第三镜慢一点","ops":[0]},{"ask":"开头换成提问","ops":[1]}],"ops":[{"op":"set"|"insert"|"remove","path":"shots[2].dur","value":4.5}]}
// asks 把用户的话拆开，ops 下标指向为这件事做的修改。假模型文件可以是这一对象，或按轮次排的数组。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {callLlm, explainLlmError, extractJson, readLlmEnv, redactSecrets} from './broll/llm-client.mjs';
import {loadBanned, loadProject, loadStyles, validateBroll} from './broll/validate.mjs';
import {keyKindOf} from './broll/prices.mjs';
import {validateLesson} from './lesson/validate-lesson.mjs';
import {validate} from './validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = '用法：node scripts/revise.mjs <storyboard.json | lesson.json | broll.json> "一句话" [--dry-run] [--render] [--mock-llm <json文件>] [--out <目录>] [--max-rounds 3]';

const args = process.argv.slice(2);
const flagValue = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const has = (name) => args.includes(name);
const positionals = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--mock-llm' && args[i - 1] !== '--out' && args[i - 1] !== '--max-rounds');

const fail = (message, code = 2) => {
  console.error(message);
  process.exit(code);
};

if (positionals.length < 2) fail(USAGE);
const fileArg = positionals[0];
const sentence = positionals.slice(1).join(' ').trim();
if (!sentence) fail('改稿的那句话是空的\n' + USAGE);
const dryRun = has('--dry-run');
const wantRender = has('--render');
const mockArg = flagValue('--mock-llm') || process.env.REVISE_MOCK_LLM || '';
const outArg = flagValue('--out');
const maxRounds = flagValue('--max-rounds') === undefined ? 3 : Number(flagValue('--max-rounds'));
if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 3) fail('--max-rounds 只能是 1、2 或 3');
if (flagValue('--mock-llm') === undefined && args.includes('--mock-llm')) fail('--mock-llm 后面要跟 json 文件');
if (flagValue('--out') === undefined && args.includes('--out')) fail('--out 后面要跟目录');

const file = path.resolve(fileArg);
if (!fs.existsSync(file)) fail(`找不到文件：${file}`);

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));

let originalText;
let doc0;
try {
  originalText = fs.readFileSync(file, 'utf8');
  doc0 = JSON.parse(originalText.replace(/^\uFEFF/, ''));
} catch (e) {
  fail(`JSON 解析失败：${e.message}`);
}

const kindOf = (doc, filePath) => {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  if (doc.meta?.format === 'lesson' || (Array.isArray(doc.chapters) && doc.meta && !Array.isArray(doc.shots))) return 'lesson';
  if (Array.isArray(doc.clips) && (doc.version === 1 || doc.version === 2) && !Array.isArray(doc.shots)) return 'broll';
  if (doc.meta && Array.isArray(doc.shots)) return 'storyboard';
  const base = path.basename(filePath);
  if (base === 'lesson.json') return 'lesson';
  if (base === 'broll.json') return 'broll';
  return null;
};

const kind = kindOf(doc0, file);
if (!kind) fail('看不出这是宣传片分镜、讲课稿还是口播 broll.json。分镜要有 meta 和 shots，讲课要有 meta.format = lesson，口播要有 version 和 clips。');

const KIND_NAME = {storyboard: '宣传片分镜', lesson: '讲课稿', broll: '口播 broll.json'};
const SKILL_FILE = {
  storyboard: 'SKILL.md',
  lesson: path.join('lesson', 'SKILL-lesson.md'),
  broll: path.join('broll', 'SKILL-broll.md'),
};

const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);
const META_SET = new Set(['title', 'product', 'theme', 'bpm', 'disclaimer', 'cta', 'action', 'brandColor', 'durationRange']);
const TWEAK_SET = new Set(['pace', 'textScale', 'headingFont']);
const VOICE_SET = new Set(['speed', 'emotion', 'subtitles', 'voiceId']);
const FACT_SET = new Set(['text', 'source', 'quote']);
const SHOT_SET = new Set(['type', 'dur', 'beats', 'caption', 'mood', 'note', 'vo', 'bg']);
const PAGE_STRING = new Set(['title', 'subtitle', 'smallText', 'kicker', 'body', 'quote', 'note', 'caption', 'label', 'heading', 'source', 'question', 'answer', 'leftTitle', 'rightTitle', 'badge', 'footer', 'tip']);
const PAGE_ARRAY = new Set(['steps', 'left', 'right', 'points', 'items']);
const BROLL_TOP = new Set(['thread', 'style', 'styleAlt', 'motionTheme', 'captions', 'budgetYuan', 'quality']);
const BROLL_CLIP = new Set(['plain', 'place', 'subject', 'action', 'end', 'camera', 'mode', 'job', 'from', 'to', 'look', 'link', 'template', 'source']);
const BROLL_SLOT = new Set(['text', 'hot', 'title', 'say', 'from', 'label', 'verdict', 'labels']);
const AI_TOUCH = new Set(['place', 'subject', 'action', 'end', 'camera', 'look', 'link', 'from', 'to', 'source', 'beats']);

const isIndex = (x) => typeof x === 'number' && Number.isInteger(x) && x >= 0;
const isKey = (x) => typeof x === 'string' && !BAD_KEY.has(x);

export const parsePath = (input) => {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s || s.includes('..') || s.startsWith('/') || s.startsWith('\\') || /^[A-Za-z]:/.test(s)) return null;
  const parts = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '.') {
      i += 1;
      continue;
    }
    if (s[i] === '[') {
      const m = /^\[(\d+)\]/.exec(s.slice(i));
      if (!m) return null;
      parts.push(Number(m[1]));
      i += m[0].length;
      continue;
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (!m) return null;
    if (BAD_KEY.has(m[0])) return null;
    parts.push(m[0]);
    i += m[0].length;
  }
  return parts.length ? parts : null;
};

const pathText = (parts) => parts.map((p) => (typeof p === 'number' ? `[${p}]` : (parts[0] === p && parts.indexOf(p) === 0 ? p : ''))).join('').replace(/\]\[/g, '][').replace(/\]([A-Za-z_])/g, '].$1').replace(/([A-Za-z0-9_])\[/g, '$1[');
// 上面的拼接容易错。直接用调用方传来的 path 字符串做展示。

const allowed = (kindName, parts) => {
  if (!parts?.length || parts.some((p) => p === '__proto__' || p === 'constructor' || p === 'prototype')) return false;
  if (kindName === 'storyboard') return allowedStory(parts);
  if (kindName === 'lesson') return allowedLesson(parts);
  if (kindName === 'broll') return allowedBroll(parts);
  return false;
};

const allowedStory = (p) => {
  if (p[0] === 'meta') {
    if (p.length === 2 && (META_SET.has(p[1]) || p[1] === 'tweak' || p[1] === 'notices' || p[1] === 'facts')) return true;
    if (p.length === 3 && p[1] === 'tweak' && TWEAK_SET.has(p[2])) return true;
    if (p.length === 3 && p[1] === 'voice' && VOICE_SET.has(p[2])) return true;
    if (p.length === 3 && p[1] === 'notices' && isIndex(p[2])) return true;
    if (p.length === 3 && p[1] === 'facts' && isIndex(p[2])) return true;
    if (p.length === 4 && p[1] === 'facts' && isIndex(p[2]) && FACT_SET.has(p[3])) return true;
    if (p.length === 3 && p[1] === 'durationRange' && isIndex(p[2])) return true;
    return false;
  }
  if (p[0] !== 'shots') return false;
  if (p.length === 1) return true;
  if (!isIndex(p[1])) return false;
  if (p.length === 2) return true;
  if (p[2] === 'params' || p[2] === 'slots') return p.slice(3).every((x) => isKey(x) || isIndex(x)) && p.length <= 8;
  if (p.length === 3 && SHOT_SET.has(p[2])) return true;
  if (p.length === 4 && p[2] === 'caption' && isIndex(p[3])) return true;
  return false;
};

const allowedLesson = (p) => {
  if (p[0] === 'meta' && p.length === 2 && (p[1] === 'title' || p[1] === 'theme')) return true;
  if (p[0] !== 'chapters' || !isIndex(p[1])) return false;
  if (p.length === 2) return true;
  if (p.length === 3 && p[2] === 'title') return true;
  if (p[2] !== 'pages' || !isIndex(p[3])) return false;
  if (p.length === 4) return true;
  if (p.length === 5 && PAGE_STRING.has(p[4])) return true;
  if (p.length === 5 && (PAGE_ARRAY.has(p[4]) || p[4] === 'narration')) return true;
  if (p.length === 6 && PAGE_ARRAY.has(p[4]) && isIndex(p[5])) return true;
  if (p.length === 6 && p[4] === 'narration' && isIndex(p[5])) return true;
  if (p.length === 7 && p[4] === 'narration' && isIndex(p[5]) && (p[6] === 'text' || p[6] === 'pose')) return true;
  if (p.length === 7 && PAGE_ARRAY.has(p[4]) && isIndex(p[5]) && (p[6] === 'text' || p[6] === 'title')) return true;
  return false;
};

const allowedBroll = (p) => {
  if (p.length === 1 && BROLL_TOP.has(p[0])) return true;
  if (p[0] === 'keepFace' && (p.length === 1 || (p.length === 2 && isIndex(p[1])))) return true;
  if (p[0] !== 'clips') return false;
  if (p.length === 1) return true;
  if (!isIndex(p[1])) return false;
  if (p.length === 2) return true;
  if (p.length === 3 && BROLL_CLIP.has(p[2])) return true;
  if (p[2] === 'slots') {
    if (p.length === 3) return true;
    if (p.length === 4 && BROLL_SLOT.has(p[3])) return true;
    if (p.length === 4 && (p[3] === 'items' || p[3] === 'left' || p[3] === 'right')) return true;
    if (p.length === 5 && (p[3] === 'items' || p[3] === 'left' || p[3] === 'right') && isIndex(p[4])) return true;
    return false;
  }
  if (p[2] === 'beats') {
    if (p.length === 3) return true;
    if (p.length === 4 && isIndex(p[3])) return true;
    if (p.length === 5 && isIndex(p[3]) && (p[4] === 'action' || p[4] === 'end')) return true;
  }
  return false;
};

const clone = (v) => structuredClone(v);

const parentOf = (root, parts, create) => {
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cur == null || typeof cur !== 'object') return null;
    if (cur[key] == null) {
      if (!create || isIndex(key)) return null;
      const next = parts[i + 1];
      cur[key] = isIndex(next) ? [] : {};
    }
    if (typeof cur[key] !== 'object') return null;
    cur = cur[key];
  }
  return cur;
};

const getAt = (root, parts) => {
  let cur = root;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

const plainValue = (v, depth = 0) => {
  if (depth > 8) return false;
  if (v == null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every((x) => plainValue(x, depth + 1));
  if (typeof v === 'object') {
    return Object.keys(v).every((k) => isKey(k) && plainValue(v[k], depth + 1));
  }
  return false;
};

export const applyOps = (doc, ops, kindName) => {
  const errors = [];
  const changes = [];
  if (!Array.isArray(ops) || !ops.length) {
    return {ok: false, errors: ['修改清单是空的，或不是数组。返回 {"ops":[{"op":"set","path":"...","value":...}]}，op 只能是 set、insert、remove'], changes: []};
  }
  const next = clone(doc);
  ops.forEach((op, i) => {
    const at = `ops[${i}]`;
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      errors.push(`${at}：每一条要是对象`);
      return;
    }
    if (op.op !== 'set' && op.op !== 'insert' && op.op !== 'remove') {
      errors.push(`${at}：不允许的操作「${op.op ?? ''}」。op 只能是 set、insert、remove`);
      return;
    }
    const parts = parsePath(op.path);
    if (!parts || !allowed(kindName, parts)) {
      errors.push(`${at}：路径不在允许范围内：${op.path ?? ''}`);
      return;
    }
    if ((op.op === 'set' || op.op === 'insert') && !plainValue(op.value)) {
      errors.push(`${at}：value 只能是文字、数字、布尔、数组或普通对象`);
      return;
    }
    const parent = parentOf(next, parts, op.op === 'set');
    const last = parts[parts.length - 1];
    if (parent == null || (typeof parent !== 'object' && !Array.isArray(parent))) {
      errors.push(`${at}：路径不存在：${op.path}`);
      return;
    }
    const before = getAt(next, parts);
    if (op.op === 'set') {
      if (Array.isArray(parent) && isIndex(last) && last >= parent.length) {
        errors.push(`${at}：下标越界：${op.path}`);
        return;
      }
      if (!Array.isArray(parent) && isIndex(last)) {
        errors.push(`${at}：这一层不是数组：${op.path}`);
        return;
      }
      parent[last] = clone(op.value);
      changes.push({op: 'set', path: op.path, before, after: parent[last]});
      return;
    }
    if (op.op === 'insert') {
      if (Array.isArray(parent) && isIndex(last)) {
        if (last > parent.length) {
          errors.push(`${at}：下标越界：${op.path}`);
          return;
        }
        parent.splice(last, 0, clone(op.value));
        changes.push({op: 'insert', path: op.path, before: undefined, after: op.value});
        return;
      }
      if (Array.isArray(before)) {
        before.push(clone(op.value));
        changes.push({op: 'insert', path: op.path, before: undefined, after: op.value});
        return;
      }
      if (before === undefined && (last === 'notices' || last === 'facts' || last === 'shots' || last === 'clips' || last === 'pages' || last === 'keepFace' || last === 'items' || last === 'steps')) {
        parent[last] = [clone(op.value)];
        changes.push({op: 'insert', path: op.path, before: undefined, after: op.value});
        return;
      }
      errors.push(`${at}：insert 只能插进数组：${op.path}`);
      return;
    }
    if (before === undefined) {
      errors.push(`${at}：没有这一项，不能删：${op.path}`);
      return;
    }
    if (Array.isArray(parent) && isIndex(last)) parent.splice(last, 1);
    else delete parent[last];
    changes.push({op: 'remove', path: op.path, before, after: undefined});
  });
  if (errors.length) return {ok: false, errors, changes: []};
  return {ok: true, errors: [], changes, doc: next};
};

const short = (v) => {
  const s = Array.isArray(v) ? v.join(' / ') : v == null ? '没写' : typeof v === 'string' ? v.replace(/\n/g, ' / ') : JSON.stringify(v);
  const chars = Array.from(String(s));
  return chars.length > 28 ? chars.slice(0, 28).join('') + '…' : chars.join('');
};

const num = (v) => (typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : short(v));

export const describeChange = (change, doc) => {
  const {path: p, before, after} = change;
  let m = /^shots\[(\d+)\]\.dur$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 镜 时长 ${num(before)} → ${num(after)} 秒`;
  m = /^shots\[(\d+)\]\.caption(?:\[(\d+)\])?$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 镜 字幕 ${short(before)}→${short(after)}`;
  m = /^shots\[(\d+)\]\.bg$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 镜 背景 ${short(before)}→${short(after)}`;
  m = /^shots\[(\d+)\]\.mood$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 镜 情绪 ${num(before)} → ${num(after)}`;
  m = /^shots\[(\d+)\]\.vo$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 镜 旁白 ${short(before)}→${short(after)}`;
  m = /^shots\[(\d+)\]\.beats$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 镜 拍数 ${num(before)} → ${num(after)}`;
  if (p === 'meta.tweak.pace' || p === 'meta.tweak') return `节奏 ${short(before?.pace ?? before)} → ${short(after?.pace ?? after)}`;
  if (p === 'meta.tweak.textScale') return `字号 ${num(before)} → ${num(after)}`;
  if (p === 'meta.tweak.headingFont') return `标题字体 ${short(before)} → ${short(after)}`;
  m = /^meta\.title$/.exec(p);
  if (m) return `标题 ${short(before)}→${short(after)}`;
  m = /^chapters\[(\d+)\]\.title$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 章 标题 ${short(before)}→${short(after)}`;
  m = /^chapters\[(\d+)\]\.pages\[(\d+)\]\.title$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 章第 ${Number(m[2]) + 1} 页 标题 ${short(before)}→${short(after)}`;
  m = /^chapters\[(\d+)\]\.pages\[(\d+)\]\.subtitle$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 章第 ${Number(m[2]) + 1} 页 副标题 ${short(before)}→${short(after)}`;
  m = /^chapters\[(\d+)\]\.pages\[(\d+)\]\.narration\[(\d+)\]\.text$/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 章第 ${Number(m[2]) + 1} 页 旁白 ${Number(m[3]) + 1} ${short(before)}→${short(after)}`;
  m = /^clips\[(\d+)\]\.(plain|camera|from|to|template|action|end)$/.exec(p);
  if (m) {
    const clip = doc?.clips?.[Number(m[1])];
    const id = clip && typeof clip.id === 'string' ? clip.id : `第 ${Number(m[1]) + 1} 段`;
    const label = {plain: '说明', camera: '镜头', from: '起点', to: '终点', template: '模板', action: '动作', end: '结束画面'}[m[2]];
    return `${id} ${label} ${short(before)}→${short(after)}`;
  }
  m = /^shots\[(\d+)\]/.exec(p);
  if (m) return `第 ${Number(m[1]) + 1} 镜 ${p.slice(m[0].length + 1)} ${short(before)}→${short(after)}`;
  return `${p} ${short(before)}→${short(after)}`;
};

const CN_DIGIT = {零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9};

export const parseCnInt = (raw) => {
  const s = String(raw).replace(/\s/g, '');
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 999 ? n : null;
  }
  if (!s || [...s].some((ch) => ch !== '十' && ch !== '百' && CN_DIGIT[ch] == null)) return null;
  let rest = s;
  let n = 0;
  const bai = rest.indexOf('百');
  if (bai >= 0) {
    const head = rest.slice(0, bai);
    if (head.length > 1) return null;
    const h = head ? CN_DIGIT[head] : 1;
    if (!h) return null;
    n += h * 100;
    rest = rest.slice(bai + 1);
    if (rest.startsWith('零')) rest = rest.slice(1);
  }
  if (!rest) return n || null;
  const shi = rest.indexOf('十');
  if (shi >= 0) {
    const head = rest.slice(0, shi);
    const tail = rest.slice(shi + 1);
    if (head.length > 1 || tail.length > 1) return null;
    const tens = head ? CN_DIGIT[head] : 1;
    if (!tens) return null;
    const ones = tail ? CN_DIGIT[tail] : 0;
    if (tail && ones == null) return null;
    return n + tens * 10 + ones;
  }
  if (rest.length === 1 && CN_DIGIT[rest] != null) return n + CN_DIGIT[rest];
  return null;
};

export const splitClauses = (sentence) => String(sentence)
  .split(/[，,；;。！？!?]+|(?:并且|同时|还要|另外|以及)/)
  .map((s) => s.trim())
  .filter((s) => [...s].length >= 2);

const normAsk = (s) => String(s).replace(/\s+/g, '').replace(/[，,。；;、！？!?]/g, '');

const findLocations = (text) => {
  const locs = [];
  const re = /第\s*([0-9]+|[零〇一二两三四五六七八九十百]+)\s*(镜|页|段)/g;
  let m;
  while ((m = re.exec(text))) {
    const n = parseCnInt(m[1]);
    if (n) locs.push({kind: m[2], n});
  }
  if (text.includes('开头')) locs.push({kind: 'start'});
  if (text.includes('最后一镜')) locs.push({kind: 'end-shot'});
  else if (text.includes('结尾')) locs.push({kind: 'end'});
  if (text.includes('最后一页')) locs.push({kind: 'end-page'});
  if (text.includes('最后一段')) locs.push({kind: 'end-clip'});
  if (text.includes('片尾')) locs.push({kind: 'credits'});
  return locs;
};

const END_TYPES = new Set(['endCard', 'finale', 'brandEnd']);

const onParts = (path, head, index) => {
  const parts = parsePath(path);
  return !!(parts && parts[0] === head && parts[1] === index);
};

const pageList = (doc) => {
  const out = [];
  (doc?.chapters ?? []).forEach((ch, ci) => {
    (ch?.pages ?? []).forEach((_, pi) => out.push({ci, pi}));
  });
  return out;
};

const resolveLoc = (loc, doc, kind) => {
  const shots = Array.isArray(doc?.shots) ? doc.shots : [];
  const clips = Array.isArray(doc?.clips) ? doc.clips : [];
  const pages = pageList(doc);
  const shotLabel = (index, name) => `${name}是第 ${index + 1} 镜 shots[${index}]`;
  if (kind === 'storyboard') {
    if (loc.kind === '页' || loc.kind === 'end-page') return {error: '宣传片没有页，位置写成 shots[N]'};
    if (loc.kind === '段' || loc.kind === 'end-clip') return {error: '宣传片没有段，位置写成 shots[N]'};
    if (!shots.length) return {error: '这份分镜没有镜头'};
    let index = -1;
    let label = '';
    if (loc.kind === '镜') {
      if (loc.n > shots.length) return {error: `点了第 ${loc.n} 镜，但这份只有 ${shots.length} 镜`};
      index = loc.n - 1;
      label = `第 ${loc.n} 镜 shots[${index}]`;
    } else if (loc.kind === 'start') {
      index = 0;
      label = shotLabel(0, '开头');
    } else if (loc.kind === 'end-shot' || loc.kind === 'end') {
      index = shots.length - 1;
      label = shotLabel(index, '结尾');
    } else if (loc.kind === 'credits') {
      for (let i = shots.length - 1; i >= 0; i -= 1) if (END_TYPES.has(shots[i]?.type)) index = i;
      if (index < 0) index = shots.length - 1;
      const type = shots[index]?.type ? `（${shots[index].type}）` : '';
      label = `片尾是第 ${index + 1} 镜 shots[${index}]${type}`;
    }
    if (index < 0) return {error: '没有可以对应的镜头'};
    return {label, hit: (path) => onParts(path, 'shots', index)};
  }
  if (kind === 'lesson') {
    if (loc.kind === '镜' || loc.kind === 'end-shot' || loc.kind === '段' || loc.kind === 'end-clip') return {error: '讲课稿没有镜头或段，位置写成 chapters[i].pages[j]'};
    if (!pages.length) return {error: '这份讲课稿没有页'};
    let page = null;
    let label = '';
    if (loc.kind === '页') {
      if (loc.n > pages.length) return {error: `点了第 ${loc.n} 页，但这份只有 ${pages.length} 页`};
      page = pages[loc.n - 1];
      label = `第 ${loc.n} 页 chapters[${page.ci}].pages[${page.pi}]`;
    } else if (loc.kind === 'start') {
      page = pages[0];
      label = `开头是第 1 章第 1 页 chapters[${page.ci}].pages[${page.pi}]`;
    } else if (loc.kind === 'end' || loc.kind === 'end-page' || loc.kind === 'credits') {
      page = pages[pages.length - 1];
      label = `结尾是 chapters[${page.ci}].pages[${page.pi}]`;
    }
    if (!page) return {error: '没有可以对应的页'};
    return {label, hit: (path) => {
      const parts = parsePath(path);
      return !!(parts && parts[0] === 'chapters' && parts[1] === page.ci && parts[2] === 'pages' && parts[3] === page.pi);
    }};
  }
  if (loc.kind === '镜' || loc.kind === 'end-shot' || loc.kind === '页' || loc.kind === 'end-page') return {error: '口播没有镜头或页，位置写成 clips[N]'};
  if (!clips.length) return {error: '这份口播没有段'};
  let index = -1;
  let label = '';
  if (loc.kind === '段') {
    if (loc.n > clips.length) return {error: `点了第 ${loc.n} 段，但这份只有 ${clips.length} 段`};
    index = loc.n - 1;
    label = `第 ${loc.n} 段 clips[${index}]`;
  } else if (loc.kind === 'start') {
    index = 0;
    label = '开头是第 1 段 clips[0]';
  } else if (loc.kind === 'end' || loc.kind === 'end-clip' || loc.kind === 'credits') {
    index = clips.length - 1;
    label = `结尾是第 ${clips.length} 段 clips[${index}]`;
  }
  if (index < 0) return {error: '没有可以对应的段'};
  return {label, hit: (path) => onParts(path, 'clips', index)};
};

const locHint = (text, doc, kind) => {
  const bits = [];
  for (const loc of findLocations(text)) {
    const resolved = resolveLoc(loc, doc, kind);
    bits.push(resolved.label || resolved.error);
  }
  return bits.filter(Boolean).join('；');
};

const missAsk = (text, doc, kind, extra) => {
  const hint = locHint(text, doc, kind);
  const head = hint ? `『${text}』没有对应的修改，${hint}` : `『${text}』没有对应的修改`;
  return extra ? `${head}。${extra}` : head;
};

const asIndex = (v) => {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return null;
};

const ASK_FORMAT = '返回里要有 asks。把用户的话按逗号拆开，每件事一条。格式：{"asks":[{"ask":"第三镜慢一点","ops":[0]},{"ask":"开头换成提问","ops":[1]}],"ops":[{"op":"set","path":"shots[2].dur","value":5.5},{"op":"set","path":"shots[0].caption","value":"…"}]}。asks[i].ops 是 ops 的下标。开头是第 1 镜 shots[0]，不能把开头的修改写进别的镜。';

/** 用户的话里每件事都要有修改；点了名的位置，对应 op 必须落在那里 */
export const checkAsks = (sentence, asks, ops, doc, kind) => {
  const errors = [];
  const seen = new Set();
  const push = (line) => {
    if (!line || seen.has(line)) return;
    seen.add(line);
    errors.push(line);
  };
  const list = Array.isArray(asks) ? asks : [];
  if (!list.length) push(ASK_FORMAT);
  const opList = Array.isArray(ops) ? ops : [];
  list.forEach((ask, i) => {
    const text = ask && typeof ask.ask === 'string' ? ask.ask.trim() : '';
    if (!text) {
      push(`asks[${i}] 缺少要改的那句话`);
      return;
    }
    if (!ask.ops || !Array.isArray(ask.ops) || !ask.ops.length) {
      push(missAsk(text, doc, kind));
      return;
    }
    const idxs = [];
    for (const raw of ask.ops) {
      const at = asIndex(raw);
      if (at == null || at < 0 || at >= opList.length) push(missAsk(text, doc, kind, `ops 下标 ${JSON.stringify(raw)} 不在这 ${opList.length} 条修改里`));
      else idxs.push(at);
    }
    if (!idxs.length) return;
    const locs = findLocations(text);
    if (!locs.length) return;
    const hits = [];
    for (const loc of locs) {
      const resolved = resolveLoc(loc, doc, kind);
      if (!resolved.hit) {
        push(missAsk(text, doc, kind));
        continue;
      }
      const landed = idxs.filter((at) => resolved.hit(opList[at]?.path));
      if (!landed.length) push(missAsk(text, doc, kind, `这一条写到了 ${idxs.map((at) => opList[at]?.path).filter(Boolean).join('、') || '别处'}`));
      else hits.push(resolved);
    }
    if (!hits.length) return;
    for (const at of idxs) {
      const path = opList[at]?.path;
      if (hits.some((h) => h.hit(path))) continue;
      push(`『${text}』的 ${path ?? ''} 不在点名的位置上，${hits.map((h) => h.label).join('；')}`);
    }
  });
  for (const clause of splitClauses(sentence)) {
    const covered = list.some((ask) => {
      if (typeof ask?.ask !== 'string') return false;
      const wrote = normAsk(ask.ask);
      const want = normAsk(clause);
      return wrote === want || wrote.includes(want);
    });
    if (!covered) push(missAsk(clause, doc, kind));
  }
  return errors;
};

const groupLines = (asks, changes, doc) => {
  const used = new Set();
  const lines = [];
  const list = Array.isArray(asks) ? asks : [];
  for (const ask of list) {
    const text = ask && typeof ask.ask === 'string' ? ask.ask.trim() : '';
    const idxs = Array.isArray(ask?.ops) ? ask.ops : [];
    const parts = [];
    for (const raw of idxs) {
      const at = asIndex(raw);
      if (at == null || !changes[at]) continue;
      used.add(at);
      parts.push(describeChange(changes[at], doc));
    }
    if (text && parts.length) lines.push(`${text} → ${parts.join('；')}`);
  }
  changes.forEach((change, i) => {
    if (!used.has(i)) lines.push(describeChange(change, doc));
  });
  return lines;
};

const skillExcerpt = (kindName) => {
  const text = fs.readFileSync(path.join(ROOT, SKILL_FILE[kindName]), 'utf8');
  if (text.length <= 14000) return text;
  return text.slice(0, 14000) + '\n…（技能说明后面省略。改哪些字段以本提示列出的路径为准。）';
};

const allowHint = {
  storyboard: '宣传片可改：meta 的 title、product、theme、bpm、disclaimer、cta、action、brandColor、durationRange、notices、facts 的 text/source/quote、tweak.pace、tweak.textScale、tweak.headingFont、voice 的 speed/emotion/subtitles/voiceId；每一镜的 type、dur、beats、caption、mood、note、vo、bg、params、slots。不能改 component，不能改 meta.assets，不能写 .. 或绝对路径。',
  lesson: '讲课可改：meta.title、meta.theme；章的 title；页的 title、subtitle、smallText 和旁白 narration[].text / pose；steps、points、items、left、right 里的文字。不能改 layout、domain、voice、brand、mascot、图片路径。',
  broll: '口播可改：thread、style、styleAlt、motionTheme、captions、budgetYuan、quality、keepFace；每一段的 plain、place、subject、action、end、camera、mode、job、from、to、look、link、template、source、slots、beats。不能改 provider、file、version、id。',
};

const placeLine = (kindName, doc) => {
  if (kindName === 'storyboard' && Array.isArray(doc?.shots)) {
    const list = doc.shots.map((s, i) => `第 ${i + 1} 镜 shots[${i}] ${s?.type ?? ''}`).join('；');
    return `镜头位置：${list}。开头 = 第 1 镜 shots[0]。结尾 = 最后一镜。片尾 = endCard、finale 或 brandEnd 那一镜。`;
  }
  if (kindName === 'lesson') return '讲课位置：第 1 页一般是 chapters[0].pages[0]。开头改这一页，不要改到后面的页。';
  if (kindName === 'broll' && Array.isArray(doc?.clips)) {
    const list = doc.clips.map((c, i) => `第 ${i + 1} 段 clips[${i}] ${c?.id ?? ''}`).join('；');
    return `段落位置：${list}。开头 = 第 1 段 clips[0]。`;
  }
  return '';
};

const promptFor = (kindName, doc, note) => {
  const lines = [
    '你是改稿助手。用户一句话里可能有好几件事。你只返回一个 JSON 对象，不要解释，不要整份重写。',
    '格式：{"asks":[{"ask":"第三镜慢一点","ops":[0]},{"ask":"开头换成提问","ops":[1]}],"ops":[{"op":"set","path":"shots[2].dur","value":5.5},{"op":"set","path":"shots[0].caption","value":"还在靠毅力记账？\\n{别跟自己较劲}"}]}',
    '先按逗号把用户的话拆成 asks。asks[i].ask 照抄那半句，不要改写，不要合并，不要漏。',
    'asks[i].ops 是 ops 数组的下标，每条至少 1 个，而且这些修改必须就是在做这件事。',
    'op 只能是 set、insert、remove。path 用 shots[2].dur、chapters[0].pages[1].title、clips[0].plain 这种写法。',
    'set 改已有的值。insert 往数组里插（path 指到下标，或指到数组本身表示追加）。remove 删掉 path 那一项。',
    '点了名的位置必须改那个位置：第 N 镜是 shots[N-1]；开头和第一镜是 shots[0]；结尾和最后一镜是最后一条 shots；片尾是 endCard、finale 或 brandEnd。第 N 页是讲课的那一页。第 N 段是 clips[N-1]。',
    '「开头换成提问」要改第 1 镜的字幕或旁白，让它变成问句。不能把提问写进第 3 镜就算交差。',
    '同一句字幕停超过 5 秒会被校验打回。要加长某一镜时，caption 改成 2 到 3 句的数组，或把时长留在 5 秒以内。',
    allowHint[kindName],
    '宣传片：用户说节奏快一点写 meta.tweak.pace = fast（慢 slow，不变 normal）；字大一点写 meta.tweak.textScale（0.9 到 1.15）；标题换楷体写 meta.tweak.headingFont = kai（衬线 serif，黑体 sans）；某一镜换背景写这一镜的 bg 为项目目录里的图片相对路径。',
    '不要编造数字来源，不要把没登记的图说成实拍，不要改 provider 去触发付费生成。',
    '',
    '技能说明：',
    skillExcerpt(kindName),
    '',
    '原文件：',
    JSON.stringify(doc),
  ];
  if (note) lines.push('', '上一轮没通过。按下面的原文改清单，不要复述无关内容：', note);
  const where = placeLine(kindName, doc);
  if (where) lines.push('', where);
  lines.push('', `用户的话：${sentence}`, '按逗号拆开，每件事一条 ask，每条都要有落到对应位置的修改。只输出 JSON。');
  return lines.join('\n');
};

const parseModel = (content) => {
  let data;
  try {
    data = JSON.parse(extractJson(content));
  } catch {
    return {error: '模型返回的不是 JSON 对象。要 {"asks":[...],"ops":[...]}'};
  }
  if (Array.isArray(data)) return {ops: data, asks: undefined};
  if (data && Array.isArray(data.ops)) return {ops: data.ops, asks: data.asks};
  if (data && Array.isArray(data.changes)) return {ops: data.changes, asks: data.asks};
  return {error: 'JSON 里没有 ops 数组'};
};

const mockRounds = () => {
  const mockPath = path.resolve(mockArg);
  if (!fs.existsSync(mockPath)) fail(`找不到假模型文件：${mockPath}`);
  const data = readJson(mockPath);
  if (Array.isArray(data)) return data;
  return [data];
};

let mockQueue = null;
const askModel = async (round, note) => {
  if (mockArg) {
    mockQueue = mockQueue ?? mockRounds();
    const item = Array.isArray(readJson(path.resolve(mockArg))) ? mockQueue[round - 1] : mockQueue[0];
    if (!item) return {error: `假模型没有第 ${round} 轮响应`};
    console.log(`假模型：第 ${round} 轮`);
    return {content: JSON.stringify(item)};
  }
  const cfg = readLlmEnv();
  if (!cfg.key) fail('没有 DeepSeek 密钥。设 DEEPSEEK_API_KEY 或 LLM_API_KEY，或加 --mock-llm。不要把密钥写进命令。');
  const messages = [
    {role: 'system', content: '你只输出 JSON 对象，键是 asks 和 ops。asks 把用户的话拆开，每条 ask 的 ops 是修改下标。'},
    {role: 'user', content: promptFor(kind, doc0, note)},
  ];
  try {
    const res = await callLlm(messages, cfg, {temperature: 0.2, json: true, timeoutMs: 90_000});
    return {content: res.content};
  } catch (e) {
    const message = redactSecrets(e?.message || String(e));
    return {error: `${message}\n${explainLlmError(message)}`};
  }
};

const formatValidate = (errors) => errors.map((e) => (typeof e === 'string' ? e : `${e.where}：${e.problem}\n   → 怎么改：${e.fix}`)).join('\n');

let brollCtx = null;
const validateDoc = (doc) => {
  if (kind === 'storyboard') {
    const r = validate(doc, {baseDir: path.dirname(file)});
    return {ok: r.errors.length === 0, errors: r.errors, slots: r.slots};
  }
  if (kind === 'lesson') {
    const r = validateLesson(doc);
    return {ok: r.ok, errors: r.errors};
  }
  if (!brollCtx) {
    const loaded = loadProject(path.dirname(file), {jsonPath: file, ignoreLock: false});
    if (!loaded.ok) return {ok: false, errors: [loaded.message]};
    brollCtx = loaded;
  }
  const r = validateBroll(doc, {
    cues: brollCtx.cues,
    durationMs: brollCtx.media.durationMs,
    width: brollCtx.media.width,
    height: brollCtx.media.height,
    styles: loadStyles(),
    banned: loadBanned(),
    projectDir: brollCtx.dir,
    tokens: brollCtx.tokens,
    lockProblem: brollCtx.lockProblem,
    keyKind: keyKindOf(),
    doubts: brollCtx.doubts,
    doubtLevel: 'warn',
  });
  return {ok: r.errors.length === 0, errors: r.errors};
};

const backupPath = (target) => {
  const dir = path.dirname(target);
  const base = path.basename(target, '.json');
  const first = path.join(dir, `${base}.bak.json`);
  if (!fs.existsSync(first)) return first;
  let i = 1;
  while (fs.existsSync(path.join(dir, `${base}.bak.${i}.json`))) i += 1;
  return path.join(dir, `${base}.bak.${i}.json`);
};

const aiWouldRegen = (ops, doc) => {
  const clips = Array.isArray(doc?.clips) ? doc.clips : [];
  return ops.some((op) => {
    const parts = parsePath(op.path) ?? [];
    if (parts[0] === 'style' || parts[0] === 'styleAlt' || parts[0] === 'quality') return clips.some((c) => c && c.source !== 'motion');
    if (parts[0] !== 'clips' || !isIndex(parts[1])) return false;
    const clip = clips[parts[1]];
    const field = parts[2];
    if (field === 'source') return op.value === 'ai' || (clip && clip.source !== 'motion');
    if (!AI_TOUCH.has(field)) return false;
    return clip && clip.source !== 'motion';
  });
};

const changedShots = (ops, beforeSlots, afterSlots) => {
  const set = new Set();
  for (const op of ops) {
    const m = /^shots\[(\d+)\]/.exec(op.path);
    if (m) set.add(Number(m[1]));
  }
  if (ops.some((op) => op.path === 'meta.tweak.pace' || op.path === 'meta.tweak' || op.path === 'meta.bpm')) {
    afterSlots.forEach((s, i) => {
      const b = beforeSlots[i];
      if (!b || Math.abs(b.start - s.start) > 1e-6 || Math.abs(b.dur - s.dur) > 1e-6) set.add(i);
    });
  }
  return [...set].sort((a, b) => a - b);
};

const stillTimes = (ops, beforeSlots, afterSlots) => {
  const idx = changedShots(ops, beforeSlots, afterSlots).slice(0, 4);
  return idx.map((i) => {
    const s = afterSlots[i];
    const t = s.start + Math.min(0.4, s.dur / 2);
    return Math.round(t * 100) / 100;
  });
};

const previewOut = () => {
  if (outArg) return path.resolve(outArg);
  return path.resolve(ROOT, '..', 'v0140-free', 'revise-preview', path.basename(file, '.json'));
};

const runNode = (script, argv) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...argv], {cwd: ROOT, encoding: 'utf8'});
  if (r.stdout) process.stdout.write(r.stdout.endsWith('\n') || r.stdout === '' ? r.stdout : r.stdout + '\n');
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
};

const preview = (ops, applied, validated) => {
  if (mockArg) {
    if (kind === 'storyboard' && validated.slots) {
      const before = validate(doc0, {baseDir: path.dirname(file)});
      const times = stillTimes(ops, before.slots, validated.slots);
      console.log(times.length ? `静帧时刻：${times.join(',')}（假模型，不出帧）` : '静帧时刻：无（假模型，不出帧）');
    }
    return;
  }
  if (kind === 'lesson') {
    console.log(`讲课只重出改过的页。重出：node scripts/lesson/make-lesson.mjs ${file} --out <仓库外目录> --voice-provider mock --no-bgm`);
    if (wantRender) {
      const out = previewOut();
      console.log(`按 --render 出整片 → ${out}`);
      process.exit(runNode('scripts/lesson/make-lesson.mjs', [file, '--out', out, '--voice-provider', 'mock', '--no-bgm']));
    }
    return;
  }
  if (kind === 'broll') {
    const dir = path.dirname(file);
    const costly = aiWouldRegen(ops, applied);
    if (costly) console.log('这次改动会触发 AI 画面重新生成，要花钱。默认不出片。');
    else console.log('动效段不花钱。');
    console.log(`重出：node scripts/talk.mjs ${dir} --out <仓库外目录>`);
    if (wantRender && costly) {
      console.log('已加 --render，但这次会重新生成 AI 画面。revise 不代跑付费生成。上面的命令要人自己看过估价再跑。');
      return;
    }
    if (wantRender) {
      const out = previewOut();
      console.log(`按 --render 出整片 → ${out}`);
      process.exit(runNode('scripts/talk.mjs', [dir, '--out', out]));
    }
    return;
  }
  const before = validate(doc0, {baseDir: path.dirname(file)});
  const times = stillTimes(ops, before.slots, validated.slots ?? []);
  if (wantRender) {
    const out = previewOut();
    console.log(`按 --render 出整片 → ${out}`);
    const argv = [file, '--out', out, '--no-voice', '--no-bgm'];
    process.exit(runNode('scripts/make.mjs', argv));
  }
  if (!times.length) {
    console.log('没有落到某一镜上的改动，不出静帧。');
    return;
  }
  const out = previewOut();
  fs.mkdirSync(path.join(out, 'check'), {recursive: true});
  const pending = [];
  const reused = [];
  for (const t of times) {
    const png = path.join(out, 'check', `still-${t.toFixed(2)}s.png`);
    if (fs.existsSync(png)) reused.push(png);
    else pending.push(t);
  }
  if (reused.length) console.log(`复用已有静帧：${reused.join('，')}`);
  if (!pending.length) return;
  console.log(`出改动镜头静帧：${pending.join(',')} → ${out}`);
  const code = runNode('scripts/make.mjs', [file, '--out', out, '--stills', pending.join(','), '--no-voice', '--no-bgm']);
  if (code !== 0 && code !== 3) process.exit(code);
};

const main = async () => {
  console.log(`${KIND_NAME[kind]}：${path.basename(file)}`);
  let lastNote = '';
  let applied = null;
  let validated = null;
  let acceptedAsks = null;
  for (let round = 1; round <= maxRounds; round++) {
    const asked = await askModel(round, lastNote);
    if (asked.error && !asked.content) {
      lastNote = asked.error;
      console.error(asked.error);
      if (round === maxRounds) {
        console.error(`没写文件。修改清单 ${maxRounds} 轮都没拿到。`);
        process.exit(1);
      }
      continue;
    }
    const parsed = parseModel(asked.content);
    if (parsed.error) {
      lastNote = parsed.error;
      console.error(parsed.error);
      if (round === maxRounds) {
        console.error(`没写文件。修改清单 ${maxRounds} 轮都不是合法 JSON。`);
        process.exit(1);
      }
      continue;
    }
    const result = applyOps(doc0, parsed.ops, kind);
    if (!result.ok) {
      lastNote = result.errors.join('\n');
      console.error(lastNote);
      if (round === maxRounds) {
        console.error(`没写文件。修改清单 ${maxRounds} 轮都不在允许范围内。`);
        process.exit(1);
      }
      continue;
    }
    const askErrors = checkAsks(sentence, parsed.asks, parsed.ops, doc0, kind);
    const check = validateDoc(result.doc);
    const problems = [...askErrors];
    if (!check.ok) problems.push(formatValidate(check.errors));
    if (problems.length) {
      lastNote = problems.join('\n');
      console.error(lastNote);
      if (round === maxRounds) {
        console.error(`没写文件。校验 ${maxRounds} 轮后仍不过：`);
        console.error(lastNote);
        process.exit(1);
      }
      console.log(`第 ${round} 轮校验没过，把报错回喂后再改。`);
      continue;
    }
    applied = result;
    validated = check;
    acceptedAsks = parsed.asks;
    break;
  }
  if (!applied) {
    console.error('没写文件。');
    process.exit(1);
  }
  const lines = groupLines(acceptedAsks, applied.changes, applied.doc);
  console.log('修改清单：');
  console.log(JSON.stringify(applied.changes.map(({op, path: p, before, after}) => ({op, path: p, before, after})), null, 2));
  console.log('改了：');
  for (const line of lines) console.log(line);
  if (dryRun) {
    console.log('干跑：没写文件。');
    return;
  }
  const bak = backupPath(file);
  fs.copyFileSync(file, bak);
  fs.writeFileSync(file, JSON.stringify(applied.doc, null, 2) + '\n', 'utf8');
  console.log(`已备份 ${bak}`);
  console.log(`已写回 ${file}`);
  preview(applied.changes, applied.doc, validated);
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => {
    console.error(redactSecrets(e?.message || String(e)));
    process.exit(1);
  });
}
