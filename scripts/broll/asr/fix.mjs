// 转写校对层：便宜模型只交「改字补丁」，改不改由脚本按规则决定，模型没法改意思。
//   模型输出 {"fixes":[{"cue":"c3","from":"他","to":"它"}],"doubt":[{"cue":"c6","text":"之后","why":"上下文像之前"}]}
//   一条补丁同时满足下面几条才自动落地，其余只写进 talk.fixes.txt 的「只提示，没改」：
//     from 在这句原文里出现且只出现一次；中文 from ≤4 字、to ≤6 字（英文按词数）；字数差 ≤1（to 是专有名词的除外）；
//     不涉及数字、否定和反义字；不带声调的拼音逐音节相同（z/zh、c/ch、s/sh、n/l、an/ang、en/eng、in/ing、f/h 互混），
//     或者 to 是专有名词表里的词；每句最多自动改 2 处。
// 校对结果按 sha256(句子清单 + 名词表 + 模型名 + 提示词版本) 缓存在 .brewreel/，复跑不重复调接口。
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {sha256Text, stableString} from '../hash.mjs';
import {extractJson, redact} from '../llm-client.mjs';
import {TEMPLATE} from '../root.mjs';

export const FIX_PROMPT_VERSION = 1;
export const MAX_AUTO_PER_CUE = 2;

// 改了就可能把意思改反的字：否定、方向、多少、涨跌、先后……
export const FLIP_RE = /[不没别未无非否莫勿前后上下左右多少大小高低加减增降涨跌买卖开关进出早晚先再快慢真假]/;
export const NEGATION_RE = /[不没别未无非否莫勿]/;
export const DIGIT_RE = /[0-9０-９零〇一二三四五六七八九十百千万亿两半]/;

let pinyinFn = null;
const loadPinyin = () => {
  if (pinyinFn) return pinyinFn;
  const req = createRequire(path.join(TEMPLATE, 'package.json'));
  try {
    pinyinFn = req('pinyin-pro').pinyin;
  } catch {
    pinyinFn = null;
  }
  return pinyinFn;
};

const isLatin = (s) => /[A-Za-z]/.test(s);
const lenOf = (s, latin) => (latin ? String(s).trim().split(/\s+/).filter(Boolean).length : [...String(s)].length);
const fuzzy = (a) =>
  String(a)
    .replace(/^zh/, 'z')
    .replace(/^ch/, 'c')
    .replace(/^sh/, 's')
    .replace(/^l/, 'n')
    .replace(/^f/, 'h')
    .replace(/ng$/, 'n');

/** 在 text 里 at 位置、长度 n 的那几个字的拼音（带上下文，多音字更准）。拿不到返回 null。 */
const pinyinAt = (text, at, n) => {
  const pinyin = loadPinyin();
  if (!pinyin) return null;
  const chars = [...text];
  const all = pinyin(text, {toneType: 'none', type: 'array', nonZh: 'spaced'});
  if (all.length === chars.length) return all.slice(at, at + n);
  return pinyin(chars.slice(at, at + n).join(''), {toneType: 'none', type: 'array', nonZh: 'spaced'});
};

const charIndexOf = (text, part) => {
  const i = text.indexOf(part);
  return i < 0 ? -1 : [...text.slice(0, i)].length;
};
const countOf = (text, part) => (part ? text.split(part).length - 1 : 0);

/** 专有名词命中：to 就是名词表里的某个词（最多多带 1 个字）。 */
const glossaryHit = (to, terms) => terms.some((g) => g && to.includes(g) && lenOf(to, isLatin(to)) - lenOf(g, isLatin(g)) <= 1);

/**
 * 判一条补丁能不能自动落地。
 * @returns {{apply: boolean, why: string}}
 */
export const judgeFix = (cueText, fix, terms = []) => {
  const from = String(fix?.from ?? '');
  const to = String(fix?.to ?? '');
  const text = String(cueText ?? '').replace(/\n/g, '');
  if (!from || !to || from === to) return {apply: false, why: '空改动'};
  if (!text.includes(from)) return {apply: false, why: `原句里没有「${from}」`};
  if (countOf(text, from) > 1) return {apply: false, why: `「${from}」在这句里出现了不止一次，不知道改哪个`};
  const latin = isLatin(from + to);
  if (lenOf(from, latin) > 4 || lenOf(to, latin) > 6) return {apply: false, why: '一次改得太长'};
  const inGlossary = glossaryHit(to, terms);
  if (Math.abs(lenOf(from, latin) - lenOf(to, latin)) > 1 && !inGlossary) return {apply: false, why: '字数变化超过 1'};
  if (DIGIT_RE.test(from) || (DIGIT_RE.test(to) && !inGlossary)) return {apply: false, why: '涉及数字，只提示'};
  if (NEGATION_RE.test(from) || (NEGATION_RE.test(to) && !inGlossary)) return {apply: false, why: '涉及否定词，只提示'};
  const fa = [...from];
  const ta = [...to];
  const changed = ta.filter((ch, i) => ch !== fa[i]).join('') + fa.filter((ch, i) => ch !== ta[i]).join('');
  if (FLIP_RE.test(changed) && !inGlossary) return {apply: false, why: `改动含「${[...new Set(changed)].join('')}」，可能改了意思，只提示`};
  if (inGlossary) return {apply: true, why: '专有名词表'};
  if (latin) return {apply: false, why: '英文改词只提示'};
  const at = charIndexOf(text, from);
  const a = pinyinAt(text, at, fa.length);
  const replaced = text.replace(from, to);
  const b = pinyinAt(replaced, at, ta.length);
  if (!a || !b) return {apply: false, why: '没装 pinyin-pro，读音没法核对，只提示'};
  if (a.length !== b.length) return {apply: false, why: '音节数不同'};
  const same = a.every((x, i) => x === b[i] || fuzzy(x) === fuzzy(b[i]));
  if (!same) return {apply: false, why: `读音不同（${a.join(' ')} → ${b.join(' ')}），只提示`};
  return {apply: true, why: `同音（${a.join(' ')}）`};
};

/** 校对提示词：只发句子清单和专有名词表，不发 SKILL。 */
export const buildFixMessages = (cues, terms = []) => {
  const list = cues.map((c) => `${c.id} ${String(c.text).replace(/\s*\n\s*/g, '')}`).join('\n');
  const user = [
    '下面是语音自动转写出来的字幕，每行一句，前面是句子号。请找出听错的字。',
    '',
    '规则：',
    '1. 只改听错的字：同音或近音的错字，以及专有名词表里的词被听错的情况。',
    '2. 不加词、不删词、不换说法、不改语序。拿不准就不改。',
    '3. 数字、否定词（不、没、别、未、无），以及前后、上下、多少、早晚这类意思相反的词，不要放进 fixes，写进 doubt。',
    '4. from 必须是原句里连续出现的片段，不超过 4 个字；to 是应该改成的字。',
    '5. 没有要改的，就输出 {"fixes":[],"doubt":[]}。',
    '',
    `专有名词表：${terms.length ? terms.join('、') : '无'}`,
    '',
    '输出格式（下面的内容是编的，只看格式，不要照抄）：',
    '{"fixes":[{"cue":"c3","from":"他","to":"它"}],"doubt":[{"cue":"c6","text":"之后","why":"上下文像之前"}]}',
    '',
    '字幕：',
    list,
    '',
    '只输出一个 JSON 对象。不要 Markdown，不要解释。',
  ].join('\n');
  return [
    {role: 'system', content: '你是字幕校对，只改听错的字。你只输出一个 JSON 对象，不要输出解释，不要输出 Markdown。'},
    {role: 'user', content: user},
  ];
};

/** 解析模型回复。整体不是 JSON 对象就抛错（上层重试一次）；单条格式不对的丢掉。 */
export const parseFixReply = (content) => {
  const doc = JSON.parse(extractJson(content));
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('回复不是 JSON 对象');
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const fixes = (Array.isArray(doc.fixes) ? doc.fixes : [])
    .map((f) => ({cue: str(f?.cue), from: str(f?.from), to: str(f?.to)}))
    .filter((f) => /^c\d+$/.test(f.cue) && f.from && f.to);
  const doubt = (Array.isArray(doc.doubt) ? doc.doubt : [])
    .map((d) => ({cue: str(d?.cue), text: str(d?.text), why: str(d?.why)}))
    .filter((d) => /^c\d+$/.test(d.cue) && d.text);
  return {fixes, doubt};
};

/**
 * 按规则落地补丁。
 * @param {Array<{id: string, text: string}>} cues 单行文字（还没断两行）
 * @param {{fixes: Array, doubt: Array}} reply
 * @returns {{cues: Array, applied: Array<{cue, from, to, why}>, hints: Array<{cue, from?, to?, text?, why, kind: 'fix'|'doubt'}>}}
 */
export const applyFixes = (cues, reply, terms = []) => {
  const byId = new Map(cues.map((c) => [c.id, {...c}]));
  const applied = [];
  const hints = [];
  const perCue = {};
  for (const f of reply?.fixes || []) {
    const c = byId.get(f.cue);
    if (!c) {
      hints.push({...f, kind: 'fix', why: `没有 ${f.cue} 这一句`});
      continue;
    }
    if ((perCue[f.cue] || 0) >= MAX_AUTO_PER_CUE) {
      hints.push({...f, kind: 'fix', why: `这句已经自动改了 ${MAX_AUTO_PER_CUE} 处，其余只提示`});
      continue;
    }
    const v = judgeFix(c.text, f, terms);
    if (!v.apply) {
      hints.push({...f, kind: 'fix', why: v.why});
      continue;
    }
    c.text = c.text.replace(f.from, f.to);
    perCue[f.cue] = (perCue[f.cue] || 0) + 1;
    applied.push({...f, why: v.why});
  }
  for (const d of reply?.doubt || []) {
    if (!byId.has(d.cue)) continue;
    hints.push({...d, kind: 'doubt', why: d.why || '模型拿不准'});
  }
  return {cues: cues.map((c) => byId.get(c.id)), applied, hints};
};

export const fixCacheKey = (cues, terms, model) =>
  sha256Text(stableString({v: FIX_PROMPT_VERSION, cues: cues.map((c) => [c.id, c.text]), terms, model: model || ''})).slice(0, 16);

/**
 * 跑一次校对（带缓存）。llm 是 (messages) => Promise<{content}>，测试里传假的。
 * JSON 不合法重试 1 次；还不行、或接口报错，就跳过校对（status 'skipped'），不算失败。
 * @returns {Promise<{status: 'done'|'cached'|'skipped', reason?: string, cacheFile?: string, cues: Array, applied: Array, hints: Array}>}
 */
export const runFix = async ({cues, terms = [], cacheDir, llm, model = '', log = console.log}) => {
  const key = fixCacheKey(cues, terms, model);
  const cacheFile = cacheDir ? path.join(cacheDir, `asr-fix-${key}.json`) : '';
  let reply = null;
  let status = 'done';
  if (cacheFile && fs.existsSync(cacheFile)) {
    try {
      reply = parseFixReply(JSON.stringify(JSON.parse(fs.readFileSync(cacheFile, 'utf8')).reply));
      status = 'cached';
    } catch {
      reply = null;
    }
  }
  if (!reply) {
    let messages = buildFixMessages(cues, terms);
    for (let attempt = 0; attempt < 2 && !reply; attempt++) {
      let content;
      try {
        ({content} = await llm(messages));
      } catch (e) {
        return {status: 'skipped', reason: `校对接口出错（${redact(e?.message || e)}）`, cues, applied: [], hints: []};
      }
      try {
        reply = parseFixReply(content);
      } catch {
        if (attempt === 0) {
          log('  校对回复不是合法 JSON，重试一次…');
          messages = messages.concat([
            {role: 'assistant', content: String(content ?? '').slice(0, 2000)},
            {role: 'user', content: '上一条不是合法 JSON。只输出 {"fixes":[...],"doubt":[...]} 这一个 JSON 对象。'},
          ]);
        }
      }
    }
    if (!reply) return {status: 'skipped', reason: '校对回复两次都不是合法 JSON', cues, applied: [], hints: []};
    if (cacheFile) {
      fs.mkdirSync(cacheDir, {recursive: true});
      fs.writeFileSync(cacheFile, JSON.stringify({model, terms, reply}, null, 2), 'utf8');
    }
  }
  return {status, cacheFile, ...applyFixes(cues, reply, terms)};
};

const statusLine = (fix) => {
  switch (fix?.status) {
    case 'done':
      return `校对：做了（模型 ${fix.model || '?'}）。`;
    case 'cached':
      return `校对：用的是上次的校对结果（模型 ${fix.model || '?'}，没有重新调接口）。`;
    case 'skipped':
      return `校对：没做成（${fix.reason || '原因不明'}）。字幕是原始转写，可以自己改 talk.srt。`;
    case 'off':
      return '校对：没做（加了 --no-fix）。字幕是原始转写。';
    case 'nokey':
      return '校对：没做（没有 LLM_API_KEY / DEEPSEEK_API_KEY）。字幕是原始转写，可以自己改 talk.srt。';
    default:
      return '校对：没做。';
  }
};

/** talk.fixes.txt 的内容。 */
export const formatFixesTxt = ({fix, notes = [], srtName = 'talk.srt'} = {}) => {
  const applied = fix?.applied || [];
  const hints = fix?.hints || [];
  const out = [
    '自动转写的校对记录',
    `字幕在 ${srtName}，可以直接改错字；不要拆句、并句（句子号会错位，broll.json 要重写）。`,
    '原始转写（没校对过的）留在 .brewreel/ 缓存里：加 --no-fix --force 重跑就能拿回来。',
    '',
    statusLine(fix),
  ];
  if (notes.length) {
    out.push('', '注意：');
    for (const n of notes) out.push(`  - ${n}`);
  }
  out.push('', `已自动改（${applied.length} 处）：`);
  if (!applied.length) out.push('  （没有）');
  for (const a of applied) out.push(`  ${a.cue}  ${a.from} → ${a.to}（${a.why}）`);
  out.push('', `只提示，没改（${hints.length} 处）。请对照原片听一下，真错了就自己改 ${srtName}：`);
  if (!hints.length) out.push('  （没有）');
  for (const h of hints) {
    if (h.kind === 'doubt') out.push(`  ${h.cue}  「${h.text}」拿不准：${h.why}`);
    else out.push(`  ${h.cue}  ${h.from} → ${h.to}：${h.why}`);
  }
  return `${out.join('\n')}\n`;
};
