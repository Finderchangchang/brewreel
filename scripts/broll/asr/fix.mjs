// 转写校对层：便宜模型只交「改字补丁」，改不改由脚本按规则决定，模型没法改意思。
//   模型输出 {"fixes":[{"cue":"c2","from":"带码","to":"代码"}],
//             "pronouns":[{"id":"c3#1","refers":"这个开源项目","person":false}],
//             "doubt":[{"cue":"c6","text":"之后","why":"上下文像之前"}]}
//   一条补丁同时满足下面几条才自动落地，其余只写进 talk.fixes.txt 的「只提示，没改」：
//     from 在这句原文里出现且只出现一次；中文 from ≤4 字、to ≤6 字（英文按词数）；字数差 ≤1（to 是专有名词的除外）；
//     不涉及数字、否定和反义字；不带声调的拼音逐音节相同（z/zh、c/ch、s/sh、n/l、an/ang、en/eng、in/ing、f/h 互混）；
//     to 带专有名词表里的词时：纯英文字母的名词免查读音，中文名词按放宽的读音比对，数字、否定、反义只对名词以外的字免查；
//     每句最多自动改 2 处。
//   代词单独一类：识别器分不出 tā，几乎一律写成「他」。脚本把字幕里每一个「他」「她」编号（c3#1 = c3 的第 1 个），
//     逐个列给模型，模型对每一个回答指的是什么（refers）、是不是人（person）。同一次请求里做完，不多调一次接口。
//     person 为 false、refers 说得出是什么（不是「我」「你」「他」这类）：按位置把那个字改成「它」，不占每句 2 处的名额。
//     指人的不动。fixes 里的代词补丁只认「他/她 → 它」（读音相同，不涉及数字和否定），改成「他」「她」的只提示；
//     清单里已经判断过的位置以清单为准。
// 校对结果按 sha256(句子清单 + 名词表 + 模型名 + 提示词版本) 缓存在 .brewreel/，复跑不重复调接口。
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {sha256Text, stableString} from '../hash.mjs';
import {extractJson, redact} from '../llm-client.mjs';
import {TEMPLATE} from '../root.mjs';

// 2：代词单独成一类（逐个列出「他」「她」，模型给出指代对象），示例换成和真实口播不重样的编造内容
export const FIX_PROMPT_VERSION = 2;
export const MAX_AUTO_PER_CUE = 2;

/** 读 tā 的三个字。识别器分不出，几乎一律写成「他」。 */
const TA = new Set(['他', '她', '它']);
/** 要逐个判断的代词：指东西时改成「它」。 */
const HUMAN_TA = new Set(['他', '她']);
/** 说「不是人」，指代对象却写成这些：前后矛盾或等于没说，只提示。 */
const VAGUE_REFERS = /^(?:[他她它](?:们)?|这个|那个|不知道|不确定|不清楚|未知|无|没有|\?|？)$/;
const PERSON_REFERS = /^(?:我|我们|你|你们|您|咱|咱们|大家|自己|别人|人|有人|对方|用户)$/;

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

/**
 * 代词互换补丁：from 和 to 一样长，改动的位置全是「他/她/它」互换。返回改动的字下标（from 里的位置），不是这种补丁返回 null。
 * 「他会」→「它会」、「他」→「它」算；「他会」→「它要」不算。
 */
export const pronounDiffs = (from, to) => {
  const fa = [...String(from ?? '')];
  const ta = [...String(to ?? '')];
  if (!fa.length || fa.length !== ta.length) return null;
  const at = [];
  for (let i = 0; i < fa.length; i++) {
    if (fa[i] === ta[i]) continue;
    if (!TA.has(fa[i]) || !TA.has(ta[i])) return null;
    at.push(i);
  }
  return at.length ? at : null;
};

/**
 * 字幕里每一个「他」「她」：{id: 'c3#1', cue: 'c3', at: 在这句里的字下标, ch: '他'}。编号按句内出现的先后，从 1 开始。
 * @param {Array<{id: string, text: string}>} cues
 */
export const pronounSlots = (cues) => {
  const out = [];
  for (const c of cues || []) {
    const chars = [...String(c?.text ?? '')];
    let n = 0;
    chars.forEach((ch, at) => {
      if (HUMAN_TA.has(ch)) out.push({id: `${c.id}#${++n}`, cue: c.id, at, ch});
    });
  }
  return out;
};

/** 代词清单里「不是人」的一条能不能改：要说得出它指的是什么。 */
export const judgePronoun = (p) => {
  const refers = String(p?.refers ?? '').trim().replace(/^[「“"']+|[」”"'。.]+$/g, '');
  if (!refers || VAGUE_REFERS.test(refers)) return {apply: false, why: '代词：模型说不是人，但没说清指的是什么，只提示'};
  if (PERSON_REFERS.test(refers)) return {apply: false, why: `代词：模型说不是人，指的却是「${refers}」，前后矛盾，只提示`};
  return {apply: true, why: `代词：指「${refers}」，不是人`};
};

/** 专有名词命中：to 就是名词表里的某个词（最多多带 1 个字）。返回命中的那个词，没命中返回 null。 */
const glossaryHit = (to, terms) => terms.find((g) => g && to.includes(g) && lenOf(to, isLatin(to)) - lenOf(g, isLatin(g)) <= 1) ?? null;
const isLatinOnly = (s) => /^[\x00-\x7F]+$/.test(String(s));
/** 放宽的读音比对（只给中文专有名词用）：每个音节声母或韵母有一样对得上就算（「精娘」→「精酿」能过，「工具」→「精酿」过不了）。 */
const looseSame = (x, y) => {
  // y / w 只是拼写上的零声母：yan 的韵母是 ian（和 niang 的 iang 只差前后鼻音），wan 的韵母是 uan
  const split = (py) => {
    let p = String(py);
    if (/^y/.test(p)) p = /^y[iu]/.test(p) ? p.slice(1).replace(/^u/, 'v') : `i${p.slice(1)}`;
    else if (/^w/.test(p)) p = /^wu/.test(p) ? p.slice(1) : `u${p.slice(1)}`;
    const m = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])?(.*)$/.exec(fuzzy(p));
    return {ini: m?.[1] ?? '', fin: (m?.[2] ?? '').replace(/ng$/, 'n')};
  };
  const a = split(x);
  const b = split(y);
  return x === y || fuzzy(x) === fuzzy(y) || (a.ini && a.ini === b.ini) || (a.fin && a.fin === b.fin);
};

/**
 * 判一条补丁能不能自动落地。
 * to 里带专有名词时：数字、否定、反义字只对名词以外的字免查（「之前」改成「名词+后」照样拦）；
 * 只有纯英文字母的名词才免查读音，中文名词要过一遍放宽的读音比对（不然模型可以把任意词换成名词表里的词）。
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
  const term = glossaryHit(to, terms);
  const inGlossary = Boolean(term);
  // to 去掉名词之后剩下的字：数字、否定、反义照查
  const rest = inGlossary ? to.replace(term, '') : to;
  if (Math.abs(lenOf(from, latin) - lenOf(to, latin)) > 1 && !inGlossary) return {apply: false, why: '字数变化超过 1'};
  if (DIGIT_RE.test(from) || DIGIT_RE.test(rest)) return {apply: false, why: '涉及数字，只提示'};
  if (NEGATION_RE.test(from) || NEGATION_RE.test(rest)) return {apply: false, why: '涉及否定词，只提示'};
  const fa = [...from];
  const ta = [...to];
  // 代词：读音都是 ta，拼音比对说明不了什么。只认「他/她 → 它」；改成「他」「她」要看指的是谁、是男是女
  const swap = pronounDiffs(from, to);
  if (swap) {
    if (swap.every((i) => HUMAN_TA.has(fa[i]) && ta[i] === '它')) return {apply: true, why: '代词：他/她 → 它（读音相同）'};
    return {apply: false, why: '代词改成「他」「她」要看指的是谁，只提示'};
  }
  if (inGlossary) {
    // 名词以外：from 里被换掉的字、to 里多出来的字，有反义字就只提示
    const gone = fa.filter((ch) => !ta.includes(ch)).join('');
    const added = [...rest].filter((ch) => !fa.includes(ch)).join('');
    if (FLIP_RE.test(gone + added)) return {apply: false, why: `改动含「${[...new Set(gone + added)].join('')}」，可能改了意思，只提示`};
    if (isLatinOnly(term)) return {apply: true, why: '专有名词表'};
    const at = charIndexOf(text, from);
    const a = pinyinAt(text, at, fa.length);
    const b = pinyinAt(text.replace(from, to), at, ta.length);
    if (!a || !b) return {apply: false, why: '没装 pinyin-pro，读音没法核对，只提示'};
    if (a.length !== b.length) return {apply: false, why: '音节数不同（专有名词），只提示'};
    if (!a.every((x, i) => looseSame(x, b[i]))) return {apply: false, why: `读音差得远（${a.join(' ')} → ${b.join(' ')}），只提示`};
    return {apply: true, why: `专有名词表（读音接近：${a.join(' ')} → ${b.join(' ')}）`};
  }
  const changed = ta.filter((ch, i) => ch !== fa[i]).join('') + fa.filter((ch, i) => ch !== ta[i]).join('');
  if (FLIP_RE.test(changed)) return {apply: false, why: `改动含「${[...new Set(changed)].join('')}」，可能改了意思，只提示`};
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

const flatText = (s) => String(s ?? '').replace(/\s*\n\s*/g, '');

/** 校对提示词：只发句子清单、代词清单和专有名词表，不发 SKILL。 */
export const buildFixMessages = (cues, terms = []) => {
  const list = cues.map((c) => `${c.id} ${flatText(c.text)}`).join('\n');
  const byId = new Map(cues.map((c) => [c.id, c]));
  const slots = pronounSlots(cues).map((s) => {
    const chars = [...String(byId.get(s.cue).text)];
    chars[s.at] = `〔${chars[s.at]}〕`;
    return `${s.id} ${flatText(chars.join(''))}`;
  });
  const user = [
    '下面是语音自动转写出来的字幕，每行一句，前面是句子号。请做两件事：一、找出听错的字；二、判断字幕里每一个「他」「她」指的是人还是东西。',
    '',
    '一、听错的字，写进 fixes：',
    '1. 只改听错的字：同音或近音的错字，以及专有名词表里的词被听错的情况。',
    '2. 不加词、不删词、不换说法、不改语序。拿不准就不改。',
    '3. 数字、否定词（不、没、别、未、无），以及前后、上下、多少、早晚这类意思相反的词，不要放进 fixes，写进 doubt。',
    '4. from 必须是原句里连续出现的片段，不超过 4 个字；to 是应该改成的字。',
    '5. 「他」「她」不写进 fixes，按第二部分单独判断。',
    '',
    '二、代词，写进 pronouns（这一类单独查，代词清单里的每一个都要回答，不能漏）：',
    '语音识别分不出 tā 是「他」「她」还是「它」，几乎一律写成「他」。代词清单列出了字幕里每一个「他」「她」，〔〕里的字就是要判断的那一个。逐个看它前后的句子，弄清它指的是什么：',
    '- 指人（说话的人提到的某个人，男女都算）：person 写 true。这个字不会被改。',
    '- 指软件、App、工具、程序、项目、网站、机器人、动画、动物、物品、事情：person 写 false。脚本会把它改成「它」。',
    '- refers 写它指的是什么，从上下文里找，几个字就行。',
    '- 「拿不准就不改」不管这一类：上下文看得出指的是东西，就写 false。实在看不出指什么，person 写 true，再把这个字写进 doubt。',
    '- id 照抄代词清单里的编号。清单是「（没有）」时，pronouns 输出 []。',
    '',
    `专有名词表：${terms.length ? terms.join('、') : '无'}`,
    '',
    '字幕：',
    list,
    '',
    '代词清单：',
    ...(slots.length ? slots : ['（没有）']),
    '',
    '输出格式（下面的内容是编的，只看格式，不要照抄）：',
    '{"fixes":[{"cue":"c2","from":"带码","to":"代码"}],"pronouns":[{"id":"c5#1","refers":"这台打印机","person":false},{"id":"c7#1","refers":"我同事","person":true}],"doubt":[{"cue":"c4","text":"十块","why":"可能是四块"}]}',
    '没有要改的、没有拿不准的，对应的数组输出 []。',
    '',
    '只输出一个 JSON 对象。不要 Markdown，不要解释。',
  ].join('\n');
  return [
    {role: 'system', content: '你是字幕校对：只改听错的字，并逐个判断「他」「她」指的是人还是东西。你只输出一个 JSON 对象，不要输出解释，不要输出 Markdown。'},
    {role: 'user', content: user},
  ];
};

/** 解析模型回复。整体不是 JSON 对象就抛错（上层重试一次）；单条格式不对的丢掉。 */
export const parseFixReply = (content) => {
  const doc = JSON.parse(extractJson(content));
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('回复不是 JSON 对象');
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const bool = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null);
  const fixes = (Array.isArray(doc.fixes) ? doc.fixes : [])
    .map((f) => ({cue: str(f?.cue), from: str(f?.from), to: str(f?.to)}))
    .filter((f) => /^c\d+$/.test(f.cue) && f.from && f.to);
  const pronouns = (Array.isArray(doc.pronouns) ? doc.pronouns : [])
    .map((p) => ({id: str(p?.id), refers: str(p?.refers), person: bool(p?.person)}))
    .filter((p) => /^c\d+#\d+$/.test(p.id) && p.person !== null);
  const doubt = (Array.isArray(doc.doubt) ? doc.doubt : [])
    .map((d) => ({cue: str(d?.cue), text: str(d?.text), why: str(d?.why)}))
    .filter((d) => /^c\d+$/.test(d.cue) && d.text);
  return {fixes, pronouns, doubt};
};

/**
 * 按规则落地补丁。先按代词清单逐个改（按位置，只改「他/她 → 它」），再过 fixes。
 * @param {Array<{id: string, text: string}>} cues 单行文字（还没断两行）
 * @param {{fixes: Array, pronouns?: Array, doubt: Array}} reply
 * @returns {{cues: Array, applied: Array<{cue, from, to, why, refers?}>, hints: Array<{cue, from?, to?, text?, why, kind: 'fix'|'doubt'}>}}
 */
export const applyFixes = (cues, reply, terms = []) => {
  const byId = new Map(cues.map((c) => [c.id, {...c}]));
  const original = new Map(cues.map((c) => [c.id, String(c.text ?? '')]));
  const applied = [];
  const hints = [];
  const perCue = {};

  // 代词清单：每个位置只认第一条回答；指人的不动；不是人、又说得出指什么的改成「它」
  const slots = new Map(pronounSlots(cues).map((s) => [s.id, s]));
  const decided = new Set();
  for (const p of reply?.pronouns || []) {
    const s = slots.get(p.id);
    const pos = s && `${s.cue}@${s.at}`;
    if (!s || decided.has(pos)) continue;
    decided.add(pos);
    if (p.person) continue;
    const v = judgePronoun(p);
    if (!v.apply) {
      hints.push({cue: s.cue, from: s.ch, to: '它', kind: 'fix', why: v.why});
      continue;
    }
    const c = byId.get(s.cue);
    const chars = [...c.text];
    chars[s.at] = '它';
    c.text = chars.join('');
    applied.push({cue: s.cue, from: s.ch, to: '它', refers: p.refers, why: v.why});
  }
  /** fixes 里的代词补丁，改的位置清单里都判断过了：以清单为准，不再重复处理。 */
  const coveredByList = (f) => {
    const at = pronounDiffs(f.from, f.to);
    const text = original.get(f.cue) ?? '';
    if (!at || countOf(text, f.from) !== 1) return false;
    const base = charIndexOf(text, f.from);
    return at.every((i) => decided.has(`${f.cue}@${base + i}`));
  };

  for (const f of reply?.fixes || []) {
    const c = byId.get(f.cue);
    if (!c) {
      hints.push({...f, kind: 'fix', why: `没有 ${f.cue} 这一句`});
      continue;
    }
    if (coveredByList(f)) continue;
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
            {role: 'user', content: '上一条不是合法 JSON。只输出 {"fixes":[...],"pronouns":[...],"doubt":[...]} 这一个 JSON 对象。'},
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
