#!/usr/bin/env node
// 动效画面（broll.json 里 source:"motion" 的段）：模板表、摘词定位、数字解析、否定词保护、顺序检查、窗口与 marks。
// 规矩：屏幕上的每个字都出自原句。模型写的摘词只用来「定位」，真正上屏的字按位置从字幕原文里拷出来；
// 数字只能经 counter 的 say / from 两格，由脚本自己换算。动效段不花钱、不进账本、不审片、不加「AI 生成画面」标。
// 报错格式和 validate.mjs 一样：{where, problem, fix}（哪一段、哪个字段、错在哪、怎么改）。
//   node scripts/broll/motion.mjs <项目目录>    只查 broll.json 里的 motion 段，打印窗口、上屏字和 marks
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {asrTokensOf} from './asr/tokens.mjs';
import {parseSrt} from './srt.mjs';
import {windowOf} from './time.mjs';

// ============================================================
// 常量（validate.mjs / llm_broll.mjs 集成时直接引用）
// ============================================================
/** motion 段的窗口（毫秒）。AI 段仍是 2.5–12 秒（time.mjs 的 MIN_COVER_MS / MAX_COVER_MS） */
export const MOTION_MIN_MS = 1800;
export const MOTION_MAX_MS = 12000;
/** motion 段只许写这些字段 */
export const MOTION_KEYS = new Set(['id', 'from', 'to', 'source', 'mode', 'job', 'template', 'plain', 'slots']);
/** AI 段才有的字段：motion 段写了就报「不写」，提示更具体 */
export const AI_ONLY_KEYS = new Set(['place', 'subject', 'camera', 'action', 'end', 'beats', 'file', 'look', 'link']);
/** 这一期新增的两个 job（validate.mjs 的 JOBS 要加上） */
export const MOTION_JOBS = ['list', 'stress'];
/** 动效段 plain 的字数上限（和 AI 段一样） */
export const PLAIN_MAX = 20;
/** 摘词前一个字是这些时，必须一起摘进来（「不会乱编数字」摘成「会乱编数字」意思就反了） */
export const NEG = new Set(['不', '没', '别', '无', '非', '未']);
/** 数字前后有这些词时，只显示数字会改掉意思（「不到一块钱」不能显示成「1 元」） */
const BEFORE_QUAL = ['不超过', '差不多', '不到', '不足', '不止', '超过', '至少', '最多', '最少', '将近', '接近', '大约', '大概', '少于', '多于', '低于', '高于', '小于', '大于'];
const AFTER_QUAL = ['以上', '以下', '以内', '之内', '左右', '上下', '出头'];
/** 数字或单位后面紧跟这些字是约数（「三十多秒」「十块来钱」「一百余人」） */
const APPROX_AFTER = ['多', '来', '余'];

/** compare 两栏的栏标题：模型只选枚举，字由这里给 */
/** 原话里标「新 / 旧」的时间词（归一后的写法，英文去了空格）：查 compare 两栏有没有放反 */
const TIME_NEW = ['现在', '之后', '后来', '如今', '目前', 'now', 'after', 'later', 'today'];
const TIME_OLD = ['以前', '之前', '原来', '过去', '当初', '从前', '本来', 'before', 'usedto', 'previously'];

export const LABELS = {
  'before-after': {zh: ['之前', '之后'], en: ['Before', 'After']},
  'old-new': {zh: ['以前', '现在'], en: ['Before', 'Now']},
  'manual-auto': {zh: ['手动', '自动'], en: ['Manual', 'Auto']},
  'wrong-right': {zh: ['不对', '这样做'], en: ['Wrong', 'Right']},
};

// ============================================================
// 模板表：校验、llm_broll 提示词、渲染共用的单一来源
// kind：quote = 原句摘词；quotes = 摘词数组；number = 原句里带数字的那几个字；enum = 固定选项（屏幕字由模板给）
// max / each：字数上限（汉字算 1，英文算半个）
// ============================================================
export const TEMPLATES = {
  keyword: {
    jobs: ['stress', 'explain', 'evoke'],
    slots: {
      text: {kind: 'quote', min: 2, max: 12, required: true},
      hot: {kind: 'quote', max: 6, inside: 'text'},
    },
    use: '一句要观众记住的话、一个关键词',
    note: '关键词大字：说到哪个字亮到哪个字，hot 在说完时扫一道马克笔',
    example: {sentence: '花钱之前，它先报价', job: 'stress', slots: {text: '花钱之前它先报价', hot: '先报价'}},
  },
  checklist: {
    jobs: ['list'],
    slots: {
      title: {kind: 'quote', max: 8},
      items: {kind: 'quotes', min: 2, max: 4, each: 10, required: true},
    },
    use: '列两到四样东西',
    note: '清单：说到哪一条哪一条出来并打勾',
    example: {sentence: '你要准备的只有两样东西：口播视频和预算', job: 'list', slots: {title: '要准备的', items: ['口播视频', '预算']}},
  },
  steps: {
    jobs: ['explain', 'demonstrate'],
    slots: {items: {kind: 'quotes', min: 2, max: 4, each: 8, required: true}},
    use: '讲先后（先…再…最后）',
    note: '步骤流：说到第几步点亮第几步，全部说完打勾',
    example: {sentence: '做法分三步：先转写，再挑句子，最后出片', job: 'explain', slots: {items: ['先转写', '再挑句子', '最后出片']}},
  },
  counter: {
    jobs: ['quantify'],
    slots: {
      from: {kind: 'number'},
      say: {kind: 'number', required: true},
      label: {kind: 'quote', max: 12, required: true},
    },
    use: '报一个确定的数（钱、时长、个数、倍数），原句里有这个数',
    note: '数字滚动：数字在说完这个数的那一刻落定；写了 from 会显示旧值和降幅',
    example: {sentence: '整条视频只用了二十五秒', job: 'quantify', slots: {say: '二十五秒', label: '整条视频'}},
  },
  compare: {
    jobs: ['compare'],
    slots: {
      labels: {kind: 'enum', values: Object.keys(LABELS), required: true},
      left: {kind: 'quotes', min: 1, max: 2, each: 10, required: true},
      right: {kind: 'quotes', min: 1, max: 2, each: 10, required: true},
      verdict: {kind: 'quote', max: 12},
    },
    use: '前后、两种做法对比，原句先说旧的（或错的）、后说新的（或对的）',
    note: '左右对比：左栏放先说的旧做法、右栏放后说的新做法并胜出；栏标题由 labels 给固定词。先说新做法的句子别用 compare',
    example: {sentence: '以前配一段画面要花七块钱，现在一分钱不用', job: 'compare', slots: {labels: 'old-new', left: ['要花七块钱'], right: ['一分钱不用']}},
  },
};
export const MOTION_TEMPLATES = Object.keys(TEMPLATES);

// ============================================================
// 摆法：说话的人优先留在画面里
// 动效段默认 split（上 60% 动效、下 40% 真人），横版用 pip。keyword 不许 full；full 只给条目多（≥3 条）的 checklist / steps。
// ============================================================
export const FULL_MIN_ITEMS = 3;

/**
 * 这一段的 mode 配不配这个模板。配就返回 null，不配返回 {problem, fix}。
 * @param {string} template
 * @param {string} mode
 * @param {object | null} slots
 * @param {{vertical?: boolean | null, captions?: string}} [ctx] vertical：原片是不是竖版（不知道传 null）；captions 是 burned 时只给 split
 */
export const motionModeProblem = (template, mode, slots, ctx = {}) => {
  if (mode !== 'full' || !TEMPLATES[template]) return null;
  const alt =
    ctx.captions === 'burned'
      ? 'split（上 60% 放画面、下 40% 露脸）'
      : ctx.vertical === false
        ? 'pip（右下角圆窗留脸）'
        : 'split（上 60% 放画面、下 40% 露脸），横版原片改成 pip（右下角圆窗留脸）';
  if (template === 'keyword') return {problem: 'keyword 不用 full：整屏一张字卡，看不到说话的人，像在放幻灯片', fix: `改成 ${alt}`};
  if (template === 'checklist' || template === 'steps') {
    const n = Array.isArray(slots?.items) ? slots.items.length : 0;
    if (n >= FULL_MIN_ITEMS) return null;
    return {problem: `${template} 只有 ${n} 条，用 full 整屏太空，也看不到说话的人`, fix: `改成 ${alt}。full 只给 ${FULL_MIN_ITEMS} 条以上的 checklist、steps`};
  }
  return {problem: `${template} 不用 full：一张卡盖满整屏，看不到说话的人`, fix: `改成 ${alt}。full 只给 ${FULL_MIN_ITEMS} 条以上的 checklist、steps`};
};

// ============================================================
// 配色和质感：风格包 style.json 的 motionTheme。键名和 template/src/talk/motion/palette.ts 一致（测试会对）
// ============================================================
export const MOTION_LOOKS = ['wood', 'clay', 'paper', 'ink', 'cutpaper-meadow', 'cutpaper-dusk'];
export const MOTION_COLOR_KEYS = ['bg', 'bg2', 'card', 'edge', 'ink', 'sub', 'accent', 'cool', 'warm', 'good', 'muted'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** 查 motionTheme 写得对不对，返回问题清单 */
export const lintMotionTheme = (mt) => {
  if (!mt || typeof mt !== 'object' || Array.isArray(mt)) return [`motionTheme 要写成对象：{"look": "${MOTION_LOOKS.join(' / ')}", 色号…}`];
  const out = [];
  if (!MOTION_LOOKS.includes(mt.look)) out.push(`motionTheme.look 要是 ${MOTION_LOOKS.join('、')} 之一`);
  for (const [k, v] of Object.entries(mt)) {
    if (k === 'look') continue;
    if (!MOTION_COLOR_KEYS.includes(k)) out.push(`motionTheme 里多了不认识的「${k}」（色号只有 ${MOTION_COLOR_KEYS.join('、')}）`);
    else if (typeof v !== 'string' || !HEX_RE.test(v)) out.push(`motionTheme.${k} 要写成 #RRGGBB`);
  }
  return out;
};

/** 风格包 → 传给合成的 look（只拷认识的键）。v0.9 早期写成字符串主题名的老风格包：不传，合成用积木风默认 */
export const motionLookOf = (style) => {
  const mt = style?.motionTheme;
  if (!mt || typeof mt !== 'object' || Array.isArray(mt) || !MOTION_LOOKS.includes(mt.look)) return undefined;
  const out = {look: mt.look};
  for (const k of MOTION_COLOR_KEYS) if (typeof mt[k] === 'string' && HEX_RE.test(mt[k])) out[k] = mt[k];
  return out;
};

/**
 * 这一支片子用哪套动效外观。
 * broll.json v2 顶层 motionTheme 是外观名字（字符串）时优先用它，而且只用该外观的默认色，不把主风格的色号盖上来。
 * 不写、或写了不认识的名字：跟主风格 style.json 的 motionTheme 对象走（motionLookOf）。老文件因此不变。
 */
export const resolveMotionLook = (doc, style) => {
  const name = doc?.motionTheme;
  if (typeof name === 'string' && MOTION_LOOKS.includes(name)) return {look: name};
  return motionLookOf(style);
};

/** 给 llm_broll 的提示词用：模板、配哪些 job、槽位写法、一个正确示例 */
export const describeTemplates = () =>
  MOTION_TEMPLATES.map((name) => {
    const t = TEMPLATES[name];
    const slots = Object.entries(t.slots)
      .map(([k, d]) => {
        const req = d.required ? '必填' : '可选';
        if (d.kind === 'enum') return `${k}（${req}，只能选 ${d.values.join(' / ')}）`;
        if (d.kind === 'number') return `${k}（${req}，照抄原句里带数字的那几个字连同单位）`;
        if (d.kind === 'quotes') return `${k}（${req}，${d.min}–${d.max} 条，每条照抄原句 ≤${d.each} 字，按说话先后）`;
        return `${k}（${req}，照抄原句 ≤${d.max} 字${d.inside ? `，要在 ${d.inside} 里` : ''}）`;
      })
      .join('；');
    return `- ${name}：${t.use}。job 写 ${t.jobs.join(' / ')}。槽位：${slots}。\n  例：原句「${t.example.sentence}」→ "job":"${t.example.job}","template":"${name}","slots":${JSON.stringify(t.example.slots)}`;
  }).join('\n');

// ============================================================
// 文字归一：全角转半角、英文转小写、去空白和标点（list-cues 用「 / 」表示换行，斜杠也去掉）。
// 数字之间的「. : - / ~」保留：「3.5 元」不能和「35 元」算成同一句。
// ============================================================
const STRIP_RE = /[\s\/，。、！？：；,.!?:;“”"'‘’（）()【】\[\]{}…—\-–·~～《》<>「」『』|｜*#＃]/u;
const DIGIT_JOIN = new Set(['.', ':', '-', '/', '~', '～']);
const isDigit = (ch) => ch >= '0' && ch <= '9';
export const half = (ch) => {
  const c = ch.codePointAt(0);
  if (c >= 0xff01 && c <= 0xff5e) return String.fromCharCode(c - 0xfee0); // 全角 ASCII（数字、字母、％、．、：、／…）
  if (ch === '￥') return '¥';
  if (ch === '　') return ' ';
  return ch;
};
const isWide = (ch) => {
  const cp = ch.codePointAt(0) ?? 0;
  return (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xff00 && cp <= 0xff60);
};
const isCjk = (ch) => {
  const cp = ch?.codePointAt(0) ?? 0;
  return (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff);
};
const lower = (ch) => {
  const l = ch.toLowerCase();
  return l.length === ch.length ? l : ch;
};
/** 每个字留不留（参与比对）。chars 已经过 half()。
 *  基本平面以外的字（表情符号等，占两个 UTF-16 单元）不参与比对：归一串按 UTF-16 下标查找，chars 按码点排，两者要一一对应 */
const keepFlags = (chars) => chars.map((c, i) => c.length === 1 && (!STRIP_RE.test(c) || (DIGIT_JOIN.has(c) && isDigit(chars[i - 1] ?? '') && isDigit(chars[i + 1] ?? ''))));

/**
 * 两个数字字之间夹着被去掉的字（空白、换行、分句处，或阿拉伯数字之间的中文标点）时，归一串里留一个分隔符 SEP：
 * 「2 30 second」「价格是 20 / 30天之后」不能拼成 230、2030 这种原话里没有的数。英文逗号「1,000」是千分位，不隔。
 */
export const SEP = '\u0001';
const CN_NUM_RE = /[零〇一二两三四五六七八九十百千万亿]/;
const isNumCh = (ch) => isDigit(ch) || CN_NUM_RE.test(ch ?? '');
const needSep = (prev, cur, gap) => {
  if (!prev || !isNumCh(prev) || !isNumCh(cur)) return false;
  if (gap.boundary || gap.chars.some((c) => /\s/.test(c))) return true;
  return isDigit(prev) && isDigit(cur) && gap.chars.some((c) => c !== ',');
};

export const norm = (s) => {
  const raw = Array.from(String(s ?? ''));
  const chars = raw.map(half);
  const keep = keepFlags(chars);
  let out = '';
  let prev = '';
  let gap = {chars: [], boundary: false};
  chars.forEach((c, i) => {
    if (!keep[i]) {
      gap.chars.push(raw[i]);
      return;
    }
    const ch = lower(c);
    if (needSep(prev, ch, gap)) out += SEP;
    out += ch;
    prev = ch;
    gap = {chars: [], boundary: false};
  });
  return out;
};

/** 字数：汉字算 1，英文、数字、半角符号算半个，空白不算（和模板表的上限同一规则） */
export const units = (s) => Array.from(String(s ?? '').replace(/\s+/g, '')).reduce((n, ch) => n + (/[\x00-\x7F]/.test(ch) ? 0.5 : 1), 0);
const fmtUnits = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const cueNo = (id) => Number(String(id).slice(1));
export const isMotion = (clip) => Boolean(clip && typeof clip === 'object' && clip.source === 'motion');

// ============================================================
// 每个字的时刻
// 默认：句内按「念的分量」线性插值（汉字 1、阿拉伯数字 0.8、英文字母 0.35、逗号顿号算一点停顿）。
// 有逐字时间戳时（转写缓存里的 tokens：[{text, startMs}]），同一句归一后字数对得上就用真实时刻，对不上退回插值。
// ============================================================
const weightOf = (ch) => {
  if (isWide(ch) && !STRIP_RE.test(ch)) return 1;
  if (isDigit(ch)) return 0.8;
  if (/[a-z]/i.test(ch)) return 0.35;
  if (/[，,、；;：:]/.test(ch)) return 0.5;
  if (/[。.！!？?…]/.test(ch)) return 0.6;
  return 0;
};

const linearTimes = (cue, chars) => {
  const w = chars.map(weightOf);
  const total = w.reduce((a, b) => a + b, 0);
  const span = cue.endMs - cue.startMs;
  if (!(total > 0)) return chars.map(() => Math.round(cue.startMs + span / 2));
  let acc = 0;
  return chars.map((_, i) => {
    const center = (acc + w[i] / 2) / total;
    acc += w[i];
    return Math.round(cue.startMs + center * span);
  });
};

/** 用转写的逐字时间：返回每个「留下的字」的时刻；对不上返回 null */
const tokenTimes = (cue, keptCount, tokens) => {
  if (!Array.isArray(tokens) || !tokens.length) return null;
  const toks = tokens.filter((t) => t && typeof t.text === 'string' && Number.isFinite(t.startMs) && t.startMs >= cue.startMs - 150 && t.startMs < cue.endMs + 50);
  const out = [];
  toks.forEach((tok, j) => {
    const chars = Array.from(tok.text).map(half);
    const keep = keepFlags(chars);
    const n = keep.filter(Boolean).length;
    if (!n) return;
    const next = toks[j + 1]?.startMs ?? Math.min(tok.startMs + 300, cue.endMs);
    const span = Math.max(80, Math.min(400, next - tok.startMs));
    let m = 0;
    keep.forEach((k) => {
      if (!k) return;
      out.push(Math.round(tok.startMs + ((m + 0.5) / n) * span));
      m++;
    });
  });
  return out.length === keptCount ? out : null;
};

/**
 * 盖住的几句 → 归一后的字串 + 每个字的时刻和它在原文里的位置。
 * @param {{id: string, startMs: number, endMs: number, text: string}[]} cues 只传这一段盖住的句子
 * @param {{tokens?: {text: string, startMs: number}[]}} [opts]
 */
export const spokenOf = (cues, opts = {}) => {
  const chars = [];
  const raws = [];
  let prev = '';
  cues.forEach((cue, ci) => {
    const raw = Array.from(String(cue.text ?? ''));
    const halfChars = raw.map(half);
    const keep = keepFlags(halfChars);
    const kept = keep.filter(Boolean).length;
    let times = linearTimes(cue, halfChars);
    const real = tokenTimes(cue, kept, opts.tokens);
    if (real) {
      // 真实时刻给留下的字；标点沿用前一个字的时刻
      let m = 0;
      let last = cue.startMs;
      times = halfChars.map((_, k) => {
        if (keep[k]) last = real[m++];
        return last;
      });
    }
    raws.push(raw.map((ch, k) => ({ch, ms: times[k]})));
    // 分句处算一道缝：上一句末尾和这一句开头都是数字时留 SEP（见 norm）
    let gap = {chars: [], boundary: ci > 0};
    halfChars.forEach((ch, k) => {
      if (!keep[k]) {
        gap.chars.push(raw[k]);
        return;
      }
      const c = lower(ch);
      if (needSep(prev, c, gap)) chars.push({ch: SEP, ms: times[k], ci, k, sep: true});
      chars.push({ch: c, ms: times[k], ci, k});
      prev = c;
      gap = {chars: [], boundary: false};
    });
  });
  return {text: chars.map((c) => c.ch).join(''), chars, raws, timed: Boolean(opts.tokens?.length)};
};

/** 归一后的 [start, end) → 原文里的那一截（保留句中标点；跨句、跨行处中文直接接上、英文补空格；去掉首尾标点） */
export const displayOf = (spoken, start, end) => {
  // 分隔符 SEP 不对应原文里的字：首尾落在它上面时往里收
  while (start < end && spoken.chars[start]?.sep) start++;
  while (end > start && spoken.chars[end - 1]?.sep) end--;
  if (!(end > start)) return {text: '', times: []};
  const a = spoken.chars[start];
  const b = spoken.chars[end - 1];
  const seq = [];
  const join = () => {
    const prev = seq[seq.length - 1];
    if (prev && !/\s/.test(prev.ch)) seq.push({ch: ' ', ms: prev.ms, soft: true});
  };
  for (let ci = a.ci; ci <= b.ci; ci++) {
    const raw = spoken.raws[ci];
    const k0 = ci === a.ci ? a.k : 0;
    const k1 = ci === b.ci ? b.k : raw.length - 1;
    if (ci > a.ci) join();
    for (let k = k0; k <= k1; k++) {
      if (raw[k].ch === '\n' || raw[k].ch === '\r') join();
      else seq.push({...raw[k]});
    }
  }
  // 空白：连续空白合成一个；中文和中文之间的空白去掉；首尾空白和标点去掉
  const out = [];
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i];
    if (/\s/.test(c.ch)) {
      const prev = out[out.length - 1];
      const next = seq.slice(i + 1).find((x) => !/\s/.test(x.ch));
      if (!prev || !next || /\s/.test(prev.ch)) continue;
      if (isWide(prev.ch) || isWide(next.ch)) continue;
      out.push({ch: ' ', ms: c.ms});
    } else out.push(c);
  }
  const strip = (c) => STRIP_RE.test(half(c.ch)) && !/[%％]/.test(c.ch);
  while (out.length && strip(out[0])) out.shift();
  while (out.length && strip(out[out.length - 1])) out.pop();
  return {text: out.map((c) => c.ch).join(''), times: out.map((c) => c.ms)};
};

// ---- 找不到摘词时的「原句里最接近的」：给整词、不带标点，照抄就能过 ----
let segmenter = null;
try {
  segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter('zh', {granularity: 'word'}) : null;
} catch {
  segmenter = null;
}
/** 一串归一后文字的词边界（下标集合，含 0 和末尾）。没有分词器时每个字都算边界。 */
const wordBounds = (text) => {
  const out = new Set([0, text.length]);
  if (!segmenter) {
    for (let i = 0; i <= text.length; i++) out.add(i);
    return out;
  }
  for (const seg of segmenter.segment(text)) {
    out.add(seg.index);
    out.add(seg.index + seg.segment.length);
  }
  return out;
};
/** 归一串 [start, end) 在原文里的样子，去掉中文标点和句末英文标点（匹配时本来就忽略标点）。 */
const hintText = (spoken, start, end) =>
  displayOf(spoken, start, end)
    .text.replace(/[，。、！？：；“”「」『』（）《》【】…—]/g, '')
    .replace(/[,.!?;:]+(?=\s|$)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** 模型摘的字没找到时，给原句里最接近的一截，让模型照抄。短句（12 字以内）给整句；长句扩到词边界，不切半个词 */
const nearest = (q, spoken) => {
  const text = spoken.text;
  let best = '';
  for (let a = 0; a < q.length; a++) {
    for (let b = q.length; b > a + best.length; b--) {
      if (text.includes(q.slice(a, b))) {
        best = q.slice(a, b);
        break;
      }
    }
  }
  if (best.replaceAll(SEP, '').length < 2) return '';
  const at = text.indexOf(best);
  // 这一处所在的那一句（归一串里的下标范围）
  const ci = spoken.chars[at].ci;
  let lo = at;
  let hi = at + best.length;
  while (lo > 0 && spoken.chars[lo - 1].ci === ci) lo--;
  while (hi < text.length && spoken.chars[hi].ci === ci) hi++;
  if (text.slice(lo, hi).replaceAll(SEP, '').length <= 12) return hintText(spoken, lo, hi);
  // 长句：先扩到词边界，再按摘词两头还差的字往外补整词，补到和摘词差不多长
  const bounds = [...wordBounds(text.slice(lo, hi))].map((x) => x + lo).sort((x, y) => x - y);
  let s = Math.max(...bounds.filter((x) => x <= at));
  let e = Math.min(...bounds.filter((x) => x >= at + best.length));
  // 两头至少各多给两个字（按整词补；模型改写的往往是旁边那个词），摘词两头还差的字更多就补更多
  const qa = q.indexOf(best);
  let needLeft = Math.max(2, qa);
  let needRight = Math.max(2, q.length - qa - best.length);
  while (needLeft > 0 && s > lo) {
    const ns = Math.max(...bounds.filter((x) => x < s));
    needLeft -= s - ns;
    s = ns;
  }
  while (needRight > 0 && e < hi) {
    const ne = Math.min(...bounds.filter((x) => x > e));
    needRight -= ne - e;
    e = ne;
  }
  return hintText(spoken, s, e);
};

// ---- 否定词保护：摘词前面紧挨着「不用 / 不要 / 不会 / 没有 / don't …」时，摘掉就把意思说反了 ----
/** 以否定字开头、但本身不是否定的词（「特别」「别人」这种否定字不在词头的，靠分词就排除了） */
const NEG_NOT = new Set(['未来', '无论', '非常', '不久', '不少', '不错', '不断', '不仅', '不但', '不管', '没准', '无数', '非得', '不禁', '未免', '无非', '不过', '别人', '别的', '别处', '不等', '无限', '无所谓']);
/** 否定字不在词头、但整词是否定的 */
const NEG_MID = new Set(['从不', '从没', '从未', '毫无', '毫不', '并不', '并没', '并未', '并非', '尚未', '绝不', '决不', '永不', '绝非', '绝无', '全无', '再也不', '一点也不', '一点都不']);
/** 以「不」收尾、但不是在否定后面的词（「要不」= 要么） */
const NEG_END_NOT = new Set(['要不']);
/** 否定字后面跟这些字仍算同一个否定短语（「不用」「不要」「没法」「不太会」） */
const NEG_BRIDGE = new Set(Array.from('用要会能必该再有太够准可肯敢想需得法过是曾到'));
const EN_NEG_RE = /^(not|never|no|don['’]?t|doesn['’]?t|didn['’]?t|can['’]?t|cannot|won['’]?t|wouldn['’]?t|shouldn['’]?t|couldn['’]?t|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t|haven['’]?t|hasn['’]?t|hadn['’]?t|mustn['’]?t|without|nobody|nothing|neither|nor|none)$/i;
const EN_BRIDGE = new Set(['ever', 'even', 'really', 'always', 'actually', 'just', 'need', 'have', 'be', 'to', 'quite', 'necessarily', 'yet']);
/** 去掉空白后的一串字是不是以否定收尾（给数字查前文用：「不用两个小时」「don't need 2 hours」） */
const negTail = (str) => {
  const s = String(str ?? '');
  for (let k = 1; k <= Math.min(3, s.length); k++) {
    const tail = s.slice(-k);
    if (NEG.has(tail[0]) && !NEG_NOT.has(tail) && Array.from(tail.slice(1)).every((ch) => NEG_BRIDGE.has(ch))) return true;
  }
  if (NEG_MID.has(s.slice(-2)) || NEG_MID.has(s.slice(-3))) return true;
  return /(n['’]t|not|never|without)(need|needs|take|takes|have|has|ever|even|really|be|to|cost|costs)?$/i.test(s);
};

/**
 * 归一串第 i 个字前面是不是紧挨着一个否定（中文看最后一个词，英文看最后一两个词）。
 * @returns {{start: number, text: string} | null} start：否定从归一串第几个字开始；text：否定那几个字（原文）
 */
export const negationBefore = (spoken, i) => {
  const text = spoken.text;
  if (i <= 0) return null;
  const prevCh = text[i - 1];
  if (prevCh === SEP) return null;
  if (/[a-z0-9]/.test(prevCh)) {
    // 英文：原文里看前面一两个词
    const words = displayOf(spoken, Math.max(0, i - 40), i)
      .text.toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/^[^a-z0-9'’]+|[^a-z0-9'’]+$/g, ''))
      .filter(Boolean);
    const last = words[words.length - 1];
    const prev = words[words.length - 2];
    let neg = null;
    if (last && EN_NEG_RE.test(last)) neg = [last];
    else if (prev && EN_NEG_RE.test(prev) && EN_BRIDGE.has(last)) neg = [prev, last];
    if (!neg) return null;
    const n = norm(neg.join(' ')).length;
    return {start: i - n, text: displayOf(spoken, i - n, i).text};
  }
  // 中文：取前面最多 8 个字（不跨 SEP），分词后看最后一个词
  let lo = Math.max(0, i - 8);
  const cut = text.lastIndexOf(SEP, i - 1);
  if (cut >= lo) lo = cut + 1;
  const win = text.slice(lo, i);
  if (!win) return null;
  let last = win.slice(-1);
  if (segmenter) {
    const segs = [...segmenter.segment(win)].map((x) => x.segment);
    last = segs[segs.length - 1] ?? last;
    // 分词器把「不」「用」拆开时往前并：否定字 + 衔接字
    for (let k = segs.length - 2; k >= 0 && Array.from(last).every((ch) => NEG_BRIDGE.has(ch)); k--) {
      last = segs[k] + last;
      if (NEG.has(segs[k][0])) break;
    }
  } else {
    // 没有分词器：退回「否定字 + 最多两个衔接字」
    for (let k = 1; k <= Math.min(3, win.length); k++) {
      const tail = win.slice(-k);
      if (NEG.has(tail[0]) && Array.from(tail.slice(1)).every((ch) => NEG_BRIDGE.has(ch))) last = tail;
    }
  }
  const tailOk = (str) => Array.from(str).every((ch) => NEG_BRIDGE.has(ch) || NEG.has(ch));
  let negLen = 0;
  if (NEG_MID.has(last) || (NEG.has(last[0]) && !NEG_NOT.has(last) && tailOk(last.slice(1)))) negLen = last.length;
  else {
    // 分词器把「也不」「都不」「还不会」并成一个词：从词里的「不」算起（「特别」「区别」的「别」不算）
    const j = last.lastIndexOf('不');
    if (j > 0 && !NEG_END_NOT.has(last) && tailOk(last.slice(j + 1))) negLen = last.length - j;
  }
  if (!negLen) return null;
  return {start: i - negLen, text: displayOf(spoken, i - negLen, i).text};
};

/**
 * 在原句里找摘词。
 * @returns {{ok: true, start: number, end: number, startMs: number, endMs: number, text: string, times: number[]} | {ok: false, problem: string, fix: string, early?: number, neg?: string}}
 *   early：只在 from 之前找到（顺序错）时给出它的位置；neg：摘词前面紧挨着的否定（「不用」）
 */
export const locate = (quote, spoken, {from = 0, within = null} = {}) => {
  const q = norm(quote);
  if (!q) return {ok: false, problem: '空的', fix: '照抄原句里连着的几个字'};
  const lo = within ? within[0] : from;
  let i = spoken.text.indexOf(q, lo);
  if (within && i >= 0 && i + q.length > within[1]) i = -1;
  if (i < 0) {
    if (!within && from > 0) {
      const j = spoken.text.indexOf(q);
      if (j >= 0) return {ok: false, early: j, problem: `「${quote}」在原句里比前一条先说`, fix: '按说话的先后排'};
    }
    const hint = nearest(q, spoken);
    return {
      ok: false,
      problem: `「${quote}」不在这一段盖住的口播里`,
      fix: hint ? `只能照抄原句里连着的字，不改写、不换同义词、不补数字。原句里最接近的是「${hint}」` : '只能照抄原句里连着的字，不改写、不换同义词、不补数字',
    };
  }
  // 摘词自己以否定开头（「不会乱编数字」「don't trust」）就不用再查前面
  const neg = NEG.has(q[0]) || EN_NEG_RE.test(String(quote).trim().split(/\s+/)[0] ?? '') ? null : negationBefore(spoken, i);
  if (neg) {
    const shown = displayOf(spoken, neg.start, i + q.length).text;
    return {ok: false, neg: neg.text, problem: `「${quote}」前面原句是「${neg.text}」，摘掉后意思反了`, fix: `把「${neg.text}」一起摘进来，写成「${shown}」`};
  }
  const end = i + q.length;
  const d = displayOf(spoken, i, end);
  return {ok: true, start: i, end, startMs: spoken.chars[i].ms, endMs: spoken.chars[end - 1].ms, text: d.text, times: d.times};
};

// ============================================================
// 数字：只认「原句里的写法」，脚本自己换算
// 认：阿拉伯数字（含千分位逗号、小数）、十百千万亿、两、半、几点几、百分之几、¥ $ 前缀、「个半」「两年半」
// 拒：第几（序数）、七八块 / 十几 / 三十多（约数）、一万二 / 两千五（口语简写）、三分之一（分数）、
//     前后带「不到 / 超过 / 以内 / 左右」这类词（只显示数字会改掉意思）、单位不在白名单里
// ============================================================
const CN_DIGIT = {零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9};
const parseSection = (s) => {
  let sec = 0;
  let num = 0;
  let seen = false;
  for (const ch of s) {
    if (ch in CN_DIGIT) {
      num = CN_DIGIT[ch];
      seen = true;
    } else if (ch === '十' || ch === '百' || ch === '千') {
      const mul = {十: 10, 百: 100, 千: 1000}[ch];
      if (!num && ch !== '十') return NaN;
      sec += (num || 1) * mul;
      num = 0;
      seen = true;
    } else return NaN;
  }
  return seen ? sec + num : NaN;
};
const parseBig = (s) => {
  if (!s) return NaN;
  const yi = s.lastIndexOf('亿');
  if (yi >= 0) {
    const hi = parseBig(s.slice(0, yi));
    const lo = s.slice(yi + 1);
    return hi * 1e8 + (lo ? parseBig(lo) : 0);
  }
  const wan = s.indexOf('万');
  if (wan >= 0) {
    const hi = parseSection(s.slice(0, wan));
    const lo = s.slice(wan + 1);
    return hi * 1e4 + (lo ? parseSection(lo) : 0);
  }
  return parseSection(s);
};
/** 中文数字 → 数值（「二十五」25、「三点五」3.5、「两万」20000、「半」0.5）。认不出返回 NaN */
export const cnToNum = (s) => {
  const str = String(s ?? '');
  if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
  if (str === '半') return 0.5;
  const dot = str.indexOf('点');
  if (dot >= 0) {
    const ip = parseBig(str.slice(0, dot));
    const frac = Array.from(str.slice(dot + 1));
    if (!frac.length || frac.some((c) => !(c in CN_DIGIT))) return NaN;
    return Number(`${ip}.${frac.map((c) => CN_DIGIT[c]).join('')}`);
  }
  return parseBig(str);
};

// 单位白名单（长的在前；英文按词边界）。显示时「块 / 块钱」统一成「元」，「秒钟」成「秒」，「美金」成「美元」
const UNITS = [
  '毫秒', '秒钟', '分钟', '小时', '个月', '星期', '礼拜', '块钱', '美元', '美金', '万元', '亿元', '公里', '公斤', '千克',
  '秒', '分', '天', '周', '月', '年', '元', '块', '毛', '角', '倍', '%', '‰', '个', '次', '步', '条', '张', '页', '行', '件', '人', '位',
  '段', '句', '帧', '遍', '项', '款', '种', '份', '篇', '集', '期', '台', '部', '本', '字', '岁', '度', '℃', '斤', '米', '万', '亿', '千',
  'seconds', 'second', 'secs', 'sec', 'minutes', 'minute', 'mins', 'min', 'hours', 'hour', 'hrs', 'days', 'day', 'times', 'dollars', 'yuan', 'steps', 'clips', 'fps',
  'k', 'w', 'h', 's', 'x',
];
const UNIT_SHOW = {块: '元', 块钱: '元', 秒钟: '秒', 美金: '美元'};
const NUM_HEAD = /^(?:\d+(?:,\d{3})*(?:\.\d+)?|[零〇一二两三四五六七八九十百千万亿]+(?:点[零〇一二三四五六七八九]+)?|半)/;

const unitAt = (s, i) => {
  const rest = s.slice(i).toLowerCase();
  for (const u of UNITS) {
    if (!rest.startsWith(u)) continue;
    if (/^[a-z]/.test(u) && /[a-z]/.test(rest[u.length] ?? '')) continue; // 英文单位要整词
    return s.slice(i, i + u.length);
  }
  return '';
};

/**
 * 找出一段文字里所有「数」并逐个解析。
 * @param {string} text 原文（会去空白、全角转半角）
 * @param {{before?: string, after?: string}} [ctx] 这段文字在原句里前后紧挨着的字（查「不到」「以内」这类限定词）
 * @returns {{raw: string, value: number, prefix: string, suffix: string, decimals: number, problem: string | null, kind: 'arabic' | 'cn'}[]}
 */
export const parseQuantities = (text, ctx = {}) => {
  // 去空白后的串 s，以及 s 里每个字在原文（按码点）里的位置：渲染时要知道「数字最后一个字」是原文第几个字
  const orig = Array.from(String(text ?? '')).map(half);
  const map = [];
  const kept = [];
  let ws = -1;
  orig.forEach((ch, idx) => {
    if (/\s/.test(ch)) {
      if (ws < 0) ws = idx;
      return;
    }
    // 两个数字字中间隔着空白（「2 30 second」）：留一个分隔符 SEP，不拼成 230
    if (ws >= 0 && kept.length && isNumCh(kept[kept.length - 1]) && isNumCh(ch)) {
      kept.push(SEP);
      map.push(ws);
    }
    ws = -1;
    kept.push(ch);
    map.push(idx);
  });
  const s = kept.join('');
  const before = Array.from(String(ctx.before ?? '')).map(half).join('').replace(/\s+/g, '');
  const after = Array.from(String(ctx.after ?? '')).map(half).join('').replace(/\s+/g, '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    let j = i;
    let pct = false;
    let prefix = '';
    if (s.startsWith('百分之', j)) {
      pct = true;
      j += 3;
    }
    if (s[j] === '¥' || s[j] === '$') {
      prefix = s[j];
      j += 1;
    }
    const m = NUM_HEAD.exec(s.slice(j));
    if (!m) {
      i += 1;
      continue;
    }
    const raw0 = m[0];
    const kind = /^\d/.test(raw0) ? 'arabic' : 'cn';
    let k = j + raw0.length;
    let value = kind === 'arabic' ? Number(raw0.replace(/,/g, '')) : cnToNum(raw0);
    let decimals = kind === 'arabic' ? (raw0.split('.')[1]?.length ?? 0) : raw0.includes('点') ? raw0.split('点')[1].length : 0;
    let problem = null;
    const prevCh = i > 0 ? s[i - 1] : before.slice(-1);
    const ctxBefore = before + s.slice(0, i);
    if (prevCh === '第') problem = 'ordinal';
    else if (kind === 'cn' && /[一二两三四五六七八九][一二两三四五六七八九]/.test(raw0)) problem = 'approx';
    else if (prevCh === '几' || s[k] === '几') problem = 'approx';
    else if (prevCh === '上' && /^[百千万亿]/.test(raw0)) problem = 'approx';
    else if (kind === 'cn' && /[百千万亿][一二两三四五六七八九]$/.test(raw0)) problem = 'colloquial';
    else if (s.startsWith('分之', k)) problem = 'fraction';
    else if (!Number.isFinite(value)) problem = 'unknown';
    // 「个半」「个小时」「个月」
    if (s.startsWith('个半', k)) {
      value += 0.5;
      decimals = Math.max(decimals, 1);
      k += 2;
    } else if (s[k] === '个' && /^(小时|钟头|星期|礼拜)/.test(s.slice(k + 1))) k += 1;
    let unit = pct ? '%' : unitAt(s, k);
    if (!pct) k += unit.length;
    if (s[k] === '半' && unit) {
      value += 0.5;
      decimals = Math.max(decimals, 1);
      k += 1;
    }
    const tail = s.slice(k) + (k >= s.length ? after : '');
    // 单独一个「半」只认「半个小时」「半个月」这种；「半天」多半是「好一会儿」，不当数
    if (!problem && raw0 === '半' && s[j + 1] !== '个') problem = 'notQuantity';
    if (!problem && APPROX_AFTER.some((w) => tail.startsWith(w))) problem = 'approx';
    if (!problem && AFTER_QUAL.some((w) => tail.startsWith(w))) problem = 'qualified';
    if (!problem && BEFORE_QUAL.some((w) => ctxBefore.endsWith(w))) problem = 'qualified';
    // 「大概是三十」「三十秒的左右」：限定词和数字中间隔了一两个字，紧挨着的检查会漏
    if (!problem && /(大概|大约|差不多|将近|接近|不到|超过|至少|最多|少于|多于)([^\d零〇一二两三四五六七八九十百千万亿]{1,2})$/.test(ctxBefore)) problem = 'qualified';
    if (!problem && /^([^\d零〇一二两三四五六七八九十百千万亿]{1,2})(左右|上下|以内|之内|以上|以下|出头)/.test(tail)) problem = 'qualified';
    if (!problem && negTail(ctxBefore.replaceAll(SEP, ''))) problem = 'negated';
    if (!problem && !unit && /^[一两]$/.test(raw0)) problem = 'notQuantity';
    if (!problem && !unit && isCjk(s[k] ?? '')) problem = 'unit';
    if (Number.isFinite(value) && !Number.isInteger(value)) decimals = Math.max(decimals, Math.min(2, String(value).split('.')[1]?.length ?? 1));
    const suffix = UNIT_SHOW[unit] ?? unit;
    // 数字部分最后一个字（「二十五秒」的「五」、「3.5 元」的「5」）在原文里的位置
    let lastNum = j + raw0.length - 1;
    if (s.slice(j + raw0.length).startsWith('个半')) lastNum = j + raw0.length + 1;
    else if (s[k - 1] === '半') lastNum = k - 1;
    out.push({
      raw: s.slice(i, k),
      numAt: map[j] ?? 0,
      numLastAt: map[lastNum] ?? map[map.length - 1] ?? 0,
      value,
      prefix: prefix === '$' ? '$' : prefix ? '¥' : '',
      suffix: prefix && suffix === '元' ? '' : suffix,
      decimals: Math.min(2, decimals),
      problem,
      kind,
    });
    i = Math.max(k, i + 1);
  }
  return out;
};

const NUM_PROBLEM = {
  ordinal: (r) => [`「${r}」是第几，不是多少`, '这句别用 counter，改用 keyword 或 steps'],
  approx: (r) => [`「${r}」是约数（或逐位念的编号、年份），counter 只放确定的数`, '这句别用 counter，改用 keyword 照抄原话'],
  colloquial: (r) => [`「${r}」是口语简写，认不准是多少`, '这句别用 counter，改用 keyword 照抄原话'],
  fraction: (r) => [`「${r}」是分数，认不准`, '这句别用 counter，改用 keyword 照抄原话'],
  qualified: (r) => [`「${r}」前后有「不到 / 超过 / 以内 / 左右」这类词，只显示数字会改掉意思`, '这句别用 counter，改用 keyword，把限定词一起照抄'],
  negated: (r) => [`「${r}」里数字前面有否定词（不用、不要、没有…），只显示数字会把意思说反`, '这句别用 counter，改用 keyword，把否定词一起照抄'],
  notQuantity: (r) => [`「${r}」不是一个数量`, '没有确定的数就别用 counter，改用 keyword'],
  unit: (r) => [`「${r}」里数字后面的单位认不出来`, '只摘数字连同常见单位（元、秒、分钟、小时、天、个、次、倍、% …）；单位不常见就改用 keyword'],
  unknown: (r) => [`「${r}」认不出是多少`, '照抄原句里阿拉伯数字或中文数字的写法；认不出就改用 keyword'],
};

/**
 * counter 的 say / from：必须恰好一个数。
 * numAt / numLastAt：数字部分第一个、最后一个字在 text 里的位置（按码点数），用来定「数字落定」的时刻。
 * @returns {{value: number, prefix: string, suffix: string, decimals: number, text: string, numAt: number, numLastAt: number} | {error: string, fix: string}}
 */
export const parseSay = (text, ctx = {}) => {
  const found = parseQuantities(text, ctx);
  // 「一起」「两样」里的一、两不是数：旁边还有真正的数时不算它
  const real = found.filter((q) => q.problem !== 'notQuantity');
  const all = real.length ? real : found;
  if (!all.length) return {error: `「${text}」里没有数字`, fix: '照抄原句里带数字的那几个字连同单位，比如「两个小时」「3.5 元」；没有确定的数就别用 counter，改用 keyword'};
  if (all.length > 1) return {error: `「${text}」里有 ${all.length} 个数（${all.map((q) => q.raw).join('、')}）`, fix: '一格只放一个数。说「从七块降到三块」时 from 写「七块」、say 写「三块」'};
  const q = all[0];
  if (q.problem) {
    const [error, fix] = NUM_PROBLEM[q.problem](String(text).trim() || q.raw);
    return {error, fix};
  }
  return {value: q.value, prefix: q.prefix, suffix: q.suffix, decimals: q.decimals, text: String(text), numAt: q.numAt, numLastAt: q.numLastAt};
};

/** 一段文字里能放进 counter 的数（「一个」「一段」这种不算）。给 validate.mjs 查「quantify 却选了 AI」用 */
export const findNumbers = (text) => parseQuantities(text).filter((q) => !q.problem && !(q.kind === 'cn' && q.raw.replace(/^[¥$]/, '').startsWith('一') && q.value === 1));

const STEP_ORDER_RE = /先|再|然后|接着|最后|first|then|finally/i;
const COUNT_UNIT_RE = /^(个|样|点|种|件|条|项|步|招|类|things?|items?|steps?|ways?)$/i;

/**
 * 原句里只有一个确定的数，却选了 checklist 或 steps。
 * 第几不算这个数。steps 句里已经有序号，或者这个数的单位是「步」并且原句在讲先后，放行。
 * 这个数是「两个 / 三样」这种个数，并且正好等于条数，放行。
 * @returns {{problem: string, fix: string} | null}
 */
export const loneNumberPickProblem = (sentence, template, items = []) => {
  if (template !== 'checklist' && template !== 'steps') return null;
  const definite = findNumbers(sentence);
  if (definite.length !== 1) return null;
  const one = definite[0];
  if (COUNT_UNIT_RE.test(one.suffix ?? '') && Array.isArray(items) && one.value === items.length) return null;
  if (template === 'steps' && parseQuantities(sentence).some((q) => q.problem === 'ordinal')) return null;
  const stepUnit = one.suffix === '步' || one.suffix === 'step' || one.suffix === 'steps';
  if (template === 'steps' && stepUnit && STEP_ORDER_RE.test(sentence)) return null;
  return {
    problem: `原句里只有一个数「${one.raw}」，却选了 ${template}`,
    fix: `改成 counter：job 写 quantify，template 写 counter，say 照抄「${one.raw}」`,
  };
};

/** from–to 盖住的句子 */
export const coveredCues = (cues, from, to) => cues.filter((c) => cueNo(c.id) >= cueNo(from) && cueNo(c.id) <= cueNo(to));

const langOf = (text) => {
  const cjk = Array.from(text).filter(isCjk).length;
  const latin = (text.match(/[a-z]/gi) ?? []).length;
  return cjk > 0 && cjk * 3 >= latin ? 'zh' : latin > 0 ? 'en' : 'zh';
};

// ============================================================
// 校验 + 算 marks
// ============================================================
const TAIL_STATIC_MS = 4000; // 最后一处字说完后，画面最多再停 4 秒
const HEAD_LATE_MS = 1500; // 第一处字最晚在窗口开始 1.5 秒内说出来（超过且不在 from 那句里就报）
const LAND_MIN_MS = 500; // counter 数字落定后至少还要露 0.5 秒

/**
 * 校验一段 motion 片段，并算出上屏的字和每个元素的时刻。
 * 只管 motion 自己的东西：字段、template、job 配不配、plain、slots（摘词、数字、否定词、顺序、字数）、字出现得太晚 / 停得太久。
 * id 格式、from/to 是否存在、mode、split 只能竖版、captions=burned、窗口长短、和别段重叠、60% 上限——这些 validate.mjs 已经在查，
 * 默认不重复报；单独调用时传 {full: true} 才一起查 from/to 和窗口长短。
 *
 * @param {object} clip broll.json 里的一段（source 应为 "motion"）
 * @param {{id: string, startMs: number, endMs: number, text: string}[]} cues 全片句子（parseSrt 的结果）
 * mode 配不配模板（keyword 不许 full、full 只给 3 条以上的清单和步骤）总是查；传 width / height / captions 时报错里的改法更准。
 * @param {{durationMs?: number, tokens?: {text: string, startMs: number}[], full?: boolean, width?: number, height?: number, captions?: string}} [opts]
 * @returns {{errors: {where: string, problem: string, fix: string}[], warnings: {where: string, problem: string, fix: string}[], plan: MotionPlan | null}}
 */
export const validateMotionClip = (clip, cues, opts = {}) => {
  const errors = [];
  const warnings = [];
  const id = clip && typeof clip === 'object' && typeof clip.id === 'string' && clip.id ? clip.id : 'motion';
  const at = (field) => (field ? `${id}.${field}` : id);
  const err = (field, problem, fix) => errors.push({where: at(field), problem, fix});
  const warn = (field, problem, fix) => warnings.push({where: at(field), problem, fix});
  const done = (plan = null) => ({errors, warnings, plan: errors.length ? null : plan});
  if (!clip || typeof clip !== 'object' || Array.isArray(clip)) {
    err('', '这一段必须是对象', '照 broll/README.md 里 motion 段的写法重写');
    return done();
  }

  for (const k of Object.keys(clip)) {
    if (MOTION_KEYS.has(k)) continue;
    if (AI_ONLY_KEYS.has(k)) err(k, `motion 段不写「${k}」`, '删掉它。动效画面的字全部从原句里摘，不写场景、主体、动作、运镜和文件');
    else err(k, `多了一个不认识的字段「${k}」`, `删掉它。motion 段只写 ${[...MOTION_KEYS].join('、')}`);
  }
  if (clip.source !== 'motion') err('source', `这里只查 motion 段，source 是「${clip.source ?? ''}」`, '动效画面写 "source":"motion"');

  if (typeof clip.plain !== 'string' || !clip.plain.trim()) err('plain', '不能空着', `写一句不超过 ${PLAIN_MAX} 字的话，说明这段画面在干嘛`);
  else if (Array.from(clip.plain.replace(/\s+/g, '')).length > PLAIN_MAX) err('plain', `${Array.from(clip.plain.replace(/\s+/g, '')).length} 字，最多 ${PLAIN_MAX} 字`, '整句换成更短的说法');

  const tpl = TEMPLATES[clip.template];
  if (!tpl) err('template', `没有叫「${clip.template ?? ''}」的模板`, `改成 ${MOTION_TEMPLATES.join('、')} 之一。${MOTION_TEMPLATES.map((n) => `${n}：${TEMPLATES[n].use}`).join('；')}`);
  else if (!tpl.jobs.includes(clip.job)) {
    const fit = MOTION_TEMPLATES.filter((n) => TEMPLATES[n].jobs.includes(clip.job));
    err('job', `模板 ${clip.template} 配不上 job「${clip.job ?? ''}」`, `${clip.template} 的 job 只能写 ${tpl.jobs.join('、')}${fit.length ? `；job 是 ${clip.job} 的话模板用 ${fit.join('、')}` : ''}`);
  }

  const slots = clip.slots;
  const slotsOk = slots && typeof slots === 'object' && !Array.isArray(slots);
  if (!slotsOk) err('slots', '要写成对象', tpl ? `照这个样子写：${JSON.stringify(tpl.example.slots)}` : '先选对 template，再按模板写 slots');
  else if (tpl) {
    for (const k of Object.keys(slots)) {
      if (tpl.slots[k]) continue;
      const numHint = clip.template !== 'counter' && /count|num|数/.test(k) ? '；数字只能写在 counter 的 say 和 from 里' : '';
      err(`slots.${k}`, `模板 ${clip.template} 没有「${k}」这一格`, `删掉它。${clip.template} 只有 ${Object.keys(tpl.slots).join('、')}${numHint}`);
    }
  }
  // 摆法：说话的人优先留在画面里（keyword 不许 full；full 只给 3 条以上的清单、步骤）
  {
    const vertical = opts.width > 0 && opts.height > 0 ? opts.height > opts.width : null;
    const mp = motionModeProblem(clip.template, clip.mode, slotsOk ? slots : null, {vertical, captions: opts.captions});
    if (mp) err('mode', mp.problem, mp.fix);
  }

  const byId = new Map(cues.map((c) => [c.id, c]));
  const fromCue = byId.get(clip.from);
  const toCue = byId.get(clip.to);
  if (!fromCue || !toCue || cueNo(clip.from) > cueNo(clip.to)) {
    if (opts.full) err('', `from「${clip.from ?? ''}」/ to「${clip.to ?? ''}」不对`, '用 list-cues 里的句子号，from 不晚于 to');
    return done();
  }
  if (!tpl || !slotsOk) return done();

  const covered = coveredCues(cues, clip.from, clip.to);
  const spoken = spokenOf(covered, {tokens: opts.tokens});
  const durationMs = Number.isFinite(opts.durationMs) && opts.durationMs > 0 ? opts.durationMs : cues[cues.length - 1].endMs + 500;
  const win = windowOf(fromCue, toCue, durationMs);
  if (opts.full) {
    if (!['full', 'pip', 'split'].includes(clip.mode)) err('mode', `「${clip.mode ?? ''}」不在可选值里`, '改成 full、pip 或 split');
    if (win.durationMs < MOTION_MIN_MS) err('', `这段盖住 ${(win.durationMs / 1000).toFixed(2)} 秒，短于 1.8 秒`, '把 to 延到下一句');
    else if (win.durationMs > MOTION_MAX_MS) err('', `这段盖住 ${(win.durationMs / 1000).toFixed(2)} 秒，长于 12 秒`, '把 to 收回到更早的句子');
  }
  const sentence = covered.map((c) => c.text.replace(/\s+/g, ' ').trim()).join(' ');
  const lang = langOf(sentence);
  const lone = loneNumberPickProblem(sentence, clip.template, clip.slots?.items);
  if (lone) err('template', lone.problem, lone.fix);

  const data = {};
  const marksMs = {};
  const located = {};
  const ctxOf = (start, end) => ({
    before: start > 0 ? displayOf(spoken, Math.max(0, start - 8), start).text : '',
    after: end < spoken.text.length ? displayOf(spoken, end, Math.min(spoken.text.length, end + 8)).text : '',
  });
  const checkLen = (field, text, max, min) => {
    const n = units(text);
    if (max && n > max) {
      err(field, `上屏是「${text}」，${fmtUnits(n)} 字，最多 ${max} 字`, '摘得更短一点，还是照抄原句里连着的字');
      return false;
    }
    if (min && n < min) {
      err(field, `只有「${text}」${fmtUnits(n)} 个字，太短`, `至少摘 ${min} 个字`);
      return false;
    }
    return true;
  };

  for (const [name, def] of Object.entries(tpl.slots)) {
    const v = slots[name];
    const field = `slots.${name}`;
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) {
      if (def.required) {
        const how = def.kind === 'number' ? '照抄原句里带数字的那几个字连同单位，比如「两个小时」' : def.kind === 'enum' ? `选 ${def.values.join('、')} 之一` : def.kind === 'quotes' ? `写 ${def.min} 到 ${def.max} 条，每条照抄原句` : '照抄原句里连着的几个字';
        err(field, '必填', `${how}。例：${JSON.stringify(tpl.example.slots)}`);
      }
      continue;
    }
    if (def.kind === 'enum') {
      if (typeof v !== 'string' || !def.values.includes(v)) err(field, `「${typeof v === 'string' ? v : JSON.stringify(v)}」不在可选值里`, `改成 ${def.values.map((x) => `${x}（${LABELS[x]?.zh.join(' / ') ?? x}）`).join('、')}；栏标题的字由脚本给，不用自己写`);
      else data[name] = v;
      continue;
    }
    if (def.kind === 'quote' || def.kind === 'number') {
      if (typeof v !== 'string') {
        err(field, '要写一个字符串', def.kind === 'number' ? '照抄原句里带数字的那几个字' : '照抄原句里连着的几个字');
        continue;
      }
      let within = null;
      if (def.inside) {
        const host = located[def.inside];
        if (!host) continue; // 宿主自己错了，已经报过
        if (!norm(slots[def.inside]).includes(norm(v))) {
          err(field, `「${v}」不在 ${def.inside}「${slots[def.inside]}」里`, `从 ${def.inside} 里再摘几个字`);
          continue;
        }
        within = [host.start, host.end];
      }
      const loc = locate(v, spoken, {within});
      if (!loc.ok) {
        // 数字前面有否定：把否定摘进来也不行（只显示数字照样说反），直接让它换 keyword
        if (def.kind === 'number' && loc.neg) err(field, loc.problem, `这句别用 counter：只显示数字会把意思说反。改用 keyword，把「${loc.neg}」一起照抄`);
        else err(field, loc.problem, loc.fix);
        continue;
      }
      located[name] = loc;
      if (def.kind === 'number' && spoken.text.slice(loc.start, loc.end).includes(SEP)) {
        err(field, `「${v}」里的数字是隔开说的（中间隔着空格、换行或分句），连起来是原话里没有的数`, '一格只放一个连着说的数，照抄原句里那几个字；拿不准就改用 keyword');
        continue;
      }
      if (def.kind === 'number') {
        const n = parseSay(loc.text, ctxOf(loc.start, loc.end));
        if (n.error) {
          err(field, n.error, n.fix);
          continue;
        }
        const {numAt, numLastAt, ...num} = n;
        data[name] = {...num, text: loc.text};
        // 落定时刻：念到数字最后一个字（「二十五秒」的「五」），不是整截说完——数字多在句尾，等说完画面就该收了
        marksMs[`${name}At`] = loc.times[numLastAt] ?? loc.endMs;
      } else {
        if (!checkLen(field, loc.text, def.max, def.min)) continue;
        data[name] = loc.text;
      }
      marksMs[`${name}0`] = loc.startMs;
      marksMs[name] = loc.endMs;
      if (name === 'text') marksMs.chars = loc.times;
      continue;
    }
    if (def.kind === 'quotes') {
      if (!Array.isArray(v)) {
        err(field, '要写成数组', `写 ${def.min} 到 ${def.max} 条，每条照抄原句，比如 ${JSON.stringify(tpl.example.slots[name])}`);
        continue;
      }
      if (v.length < def.min || v.length > def.max) err(field, `现在 ${v.length} 条，要 ${def.min} 到 ${def.max} 条`, v.length > def.max ? `只留最要紧的 ${def.max} 条；多的可以分到下一段，或者换 keyword` : '按原句里说到的条数写；只有一样东西就改用 keyword');
      const texts = [];
      const starts = [];
      const ends = [];
      let cursor = 0;
      let bad = false;
      v.forEach((item, i) => {
        const f = `${field}[${i}]`;
        if (typeof item !== 'string') {
          err(f, '要写字符串', '照抄原句');
          bad = true;
          return;
        }
        const dup = v.slice(0, i).findIndex((x) => typeof x === 'string' && norm(x) === norm(item) && norm(x));
        if (dup >= 0) {
          err(f, `和第 ${dup + 1} 条「${v[dup]}」一样`, '每条写不同的内容；重复的删掉');
          bad = true;
          return;
        }
        const loc = locate(item, spoken, {from: cursor});
        if (!loc.ok) {
          if (loc.early != null) err(f, `「${item}」在原句里比上一条「${v[i - 1]}」先说`, `按说话的先后排：把「${item}」挪到前面`);
          else err(f, loc.problem, loc.fix);
          bad = true;
          return;
        }
        if (!checkLen(f, loc.text, def.each)) {
          bad = true;
          return;
        }
        texts.push(loc.text);
        starts.push(loc.startMs);
        ends.push(loc.endMs);
        located[`${name}[${i}]`] = loc;
        cursor = loc.end;
      });
      if (bad) continue;
      data[name] = texts;
      marksMs[name] = starts;
      marksMs[`${name}End`] = ends;
      located[name] = {start: located[`${name}[0]`]?.start ?? 0, end: cursor};
    }
  }
  if (errors.length) return done();

  // ---- 模板自己的规矩 ----
  if (clip.template === 'compare') {
    data.leftTitle = LABELS[data.labels][lang][0];
    data.rightTitle = LABELS[data.labels][lang][1];
    if (located['right[0]'] && located['left[0]'] && located['right[0]'].start < located['left[0]'].start) {
      // 不要叫模型「换 labels」或「两栏对调」：先说新做法时，对调后就成了「以前：新做法」，意思反了
      err('slots.right', '右栏比左栏先说出来', `compare 只给「先说旧的（或错的）、后说新的（或对的）」的句子：左栏是先说的旧做法，右栏是后说、胜出的新做法（${data.labels} 是「${LABELS[data.labels].zh.join('」在左、「')}」在右）。这句先说的是新做法，就别用 compare，不要把两栏对调，改用 keyword 或 checklist`);
    } else if (data.labels === 'old-new' || data.labels === 'before-after') {
      // 两栏顺序对，但内容放反了：左栏前面紧挨着「现在 / 之后」，或右栏前面紧挨着「以前 / 之前」
      // 看这一栏前面最近的那个时间词（前 10 个字里，取离得最近的）
      const timeOf = (loc) => {
        if (!loc) return null;
        const win = spoken.text.slice(Math.max(0, loc.start - 10), loc.start);
        let best = null;
        for (const [kind, words] of [['new', TIME_NEW], ['old', TIME_OLD]]) {
          for (const w of words) {
            const at = win.lastIndexOf(w);
            if (at >= 0 && (!best || at + w.length > best.end)) best = {kind, end: at + w.length};
          }
        }
        return best?.kind ?? null;
      };
      const leftNew = timeOf(located['left[0]']) === 'new';
      const rightOld = timeOf(located['right[0]']) === 'old';
      if (leftNew || rightOld) {
        err('slots.left', `两栏放反了：原话里${leftNew ? `左栏「${data.left[0]}」说的是现在的做法` : `右栏「${data.right[0]}」说的是以前的做法`}，上屏会写成「${LABELS[data.labels].zh[0]}：${data.left[0]}」`, '这句先说的是新做法，别用 compare，不要把两栏对调，改用 keyword 或 checklist');
      }
    }
  }
  if (clip.template === 'counter' && data.from && data.say) {
    if (data.from.suffix && data.say.suffix && data.from.suffix !== data.say.suffix) err('slots.from', `from 的单位「${data.from.suffix}」和 say 的「${data.say.suffix}」不一样`, '两个数要是同一个单位；不一样就删掉 from');
    else if ((data.from.prefix || data.say.prefix) && data.from.prefix && data.say.prefix && data.from.prefix !== data.say.prefix) err('slots.from', `from 的「${data.from.prefix}」和 say 的「${data.say.prefix}」不一样`, '两个数要是同一种钱；不一样就删掉 from');
    if (!data.say.suffix && data.from.suffix) data.say = {...data.say, suffix: data.from.suffix};
    if (!data.say.prefix && data.from.prefix) data.say = {...data.say, prefix: data.from.prefix};
  }
  if (errors.length) return done();

  // ---- 时间上的两条：字出现得太晚（前面卡片是空的）、说完后停得太久 ----
  const leadMs = {keyword: marksMs.text0, checklist: marksMs.items?.[0], steps: marksMs.items?.[0], counter: marksMs.say0, compare: marksMs.left?.[0]}[clip.template];
  if (Number.isFinite(leadMs) && leadMs > fromCue.endMs && leadMs - win.startMs > HEAD_LATE_MS) {
    const cue = covered.find((c) => c.endMs >= leadMs) ?? covered[0];
    err('from', `画面上的字要到第 ${((leadMs - win.startMs) / 1000).toFixed(1)} 秒才说出来，前面这段卡片是空的、人却在讲别的`, `把 from 改成 ${cue.id}`);
  } else if (Number.isFinite(leadMs) && leadMs - win.startMs > 2500) {
    warn('', `画面上的字要到第 ${((leadMs - win.startMs) / 1000).toFixed(1)} 秒才说出来`, '这句前半截和画面无关；能的话换一句开口就说到要点的句子');
  }
  const allMs = Object.entries(marksMs)
    .filter(([k]) => k !== 'chars')
    .flatMap(([, x]) => (Array.isArray(x) ? x : [x]))
    .filter(Number.isFinite);
  const lastMs = Math.max(...allMs);
  if (Number.isFinite(lastMs) && win.endMs - lastMs > TAIL_STATIC_MS) {
    const lastCue = covered.find((c) => c.endMs >= lastMs) ?? covered[covered.length - 1];
    const tail = ((win.endMs - lastMs) / 1000).toFixed(1);
    if (cueNo(lastCue.id) < cueNo(clip.to)) err('to', `最后一处字说完后，画面还要停 ${tail} 秒不动`, `把 to 改成 ${lastCue.id}`);
    else warn('', `最后一处字说完后，画面还要停 ${tail} 秒`, '这句后半截和画面无关的话，可以考虑换一段更贴的句子');
  }
  if (clip.template === 'counter' && win.endMs - marksMs.sayAt < LAND_MIN_MS) {
    warn('slots.say', `数字落定到这段结束只有 ${((win.endMs - marksMs.sayAt) / 1000).toFixed(1)} 秒，一闪就没了`, '能的话把 to 延到下一句');
  }
  if (errors.length) return done();

  const screenText = [];
  if (clip.template === 'keyword') screenText.push(data.text);
  if (clip.template === 'checklist') screenText.push(...(data.title ? [data.title] : []), ...data.items);
  if (clip.template === 'steps') screenText.push(...data.items);
  const shown = (n) => `${n.prefix}${n.value.toFixed(n.decimals)}${n.suffix}（原话「${n.text}」）`;
  if (clip.template === 'counter') screenText.push(...(data.from ? [shown(data.from)] : []), shown(data.say), data.label);
  if (clip.template === 'compare') screenText.push(`${data.leftTitle}：${data.left.join(' / ')}`, `${data.rightTitle}：${data.right.join(' / ')}`, ...(data.verdict ? [data.verdict] : []));

  return done({
    id,
    source: 'motion',
    template: clip.template,
    mode: clip.mode,
    job: clip.job,
    plain: clip.plain,
    from: clip.from,
    to: clip.to,
    windowMs: [win.startMs, win.endMs],
    sentence,
    lang,
    data,
    marksMs,
    screenText,
    costYuan: 0,
  });
};

/**
 * 全片的模板搭配：同一个模板最多 2 次，相邻两段（按 clips 的顺序，只看 motion 段挨着 motion 段）不要同一个模板。
 * @param {object[]} clips broll.json 的 clips
 * @returns {{errors: {where: string, problem: string, fix: string}[], warnings: {where: string, problem: string, fix: string}[]}}
 */
export const checkMotionSequence = (clips) => {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(clips)) return {errors, warnings};
  const used = new Map();
  let prev = null;
  clips.forEach((clip, i) => {
    if (!clip || typeof clip !== 'object') {
      prev = null;
      return;
    }
    const id = typeof clip.id === 'string' ? clip.id : `clips[${i}]`;
    if (!isMotion(clip) || !TEMPLATES[clip.template]) {
      prev = null;
      return;
    }
    const list = used.get(clip.template) ?? [];
    list.push(id);
    used.set(clip.template, list);
    if (list.length === 3) errors.push({where: `${id}.template`, problem: `模板 ${clip.template} 已经用了 2 次（${list.slice(0, 2).join('、')}），这是第 3 次`, fix: '同一个模板全片最多用 2 次。换一个模板，或者这句改成 AI 画面，或者删掉这一段留真人'});
    if (prev && prev.template === clip.template) errors.push({where: `${id}.template`, problem: `和上一段 ${prev.id} 都是 ${clip.template}`, fix: '最省事的是删掉不那么要紧的一段，留真人（两段数字挨着时尤其这样，别把要紧的数换成 keyword）；或者把其中一段换成别的模板'});
    prev = {id, template: clip.template};
  });
  return {errors, warnings};
};

/**
 * AI 段写了 job:"quantify"、原句里又有确定的数：生成画面里的数字不可靠，要改成 counter。
 * @returns {{where: string, problem: string, fix: string} | null}
 */
export const checkAiQuantify = (clip, cues) => {
  if (!clip || typeof clip !== 'object' || isMotion(clip) || clip.job !== 'quantify') return null;
  const byId = new Set(cues.map((c) => c.id));
  if (!byId.has(clip.from) || !byId.has(clip.to)) return null;
  const nums = coveredCues(cues, clip.from, clip.to).flatMap((c) => findNumbers(c.text));
  if (!nums.length) return null;
  const id = typeof clip.id === 'string' ? clip.id : 'clip';
  return {
    where: `${id}.source`,
    problem: `这段在报数（原句里有「${nums[0].raw}」），AI 生成画面里的数字不可靠`,
    fix: `改成 "source":"motion"、"template":"counter"，"slots":{"say":"${nums[0].raw}","label":"…照抄原句…"}；删掉 place、subject、action、end、camera`,
  };
};

/**
 * 计划 → Talk 合成的一段 props（template/src/talk/motion/types.ts 的 MotionClip）。时刻换成「窗口内第几秒」。
 * @param {MotionPlan} plan validateMotionClip 返回的 plan
 * @param {{look?: {look: string} & Record<string, string>}} [opts] look：主风格的配色和质感（motionLookOf(style) 的结果）；不写 = 合成用积木风默认
 */
export const toMotionProps = (plan, opts = {}) => {
  const [w0, w1] = plan.windowMs;
  const rel = (ms) => Math.max(0, Math.round(ms - w0) / 1000);
  const marks = {};
  for (const [k, v] of Object.entries(plan.marksMs)) marks[k] = Array.isArray(v) ? v.map(rel) : rel(v);
  const out = {
    kind: 'motion',
    id: plan.id,
    template: plan.template,
    data: plan.data,
    marks,
    startMs: w0,
    endMs: w1,
    mode: plan.mode,
    badge: false,
    lang: plan.lang,
  };
  if (opts.look && typeof opts.look === 'object') out.look = opts.look;
  return out;
};

/**
 * @typedef {object} MotionPlan
 * @property {string} id
 * @property {'motion'} source
 * @property {'keyword'|'checklist'|'steps'|'counter'|'compare'} template
 * @property {'full'|'pip'|'split'} mode
 * @property {string} job
 * @property {string} plain
 * @property {string} from
 * @property {string} to
 * @property {[number, number]} windowMs 窗口（绝对毫秒）
 * @property {string} sentence 盖住的原句
 * @property {'zh'|'en'} lang
 * @property {object} data 上屏数据（全部从原文拷出）
 * @property {object} marksMs 每个元素被说出的时刻（绝对毫秒）
 * @property {string[]} screenText 屏幕上会出现的字（给审片页、manifest）
 * @property {0} costYuan
 */

// ============================================================
// 命令行：只查 motion 段
// ============================================================
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dirArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!dirArg) {
    console.log('用法：node scripts/broll/motion.mjs <项目目录>');
    process.exit(2);
  }
  const dir = path.resolve(dirArg);
  const srt = path.join(dir, 'talk.srt');
  const json = path.join(dir, 'broll.json');
  const missing = [srt, json].filter((p) => !fs.existsSync(p)).map((p) => path.basename(p));
  if (missing.length) {
    console.log(`项目目录缺少 ${missing.join('、')}。`);
    process.exit(2);
  }
  let cues;
  let doc;
  try {
    cues = parseSrt(fs.readFileSync(srt, 'utf8'));
    doc = JSON.parse(fs.readFileSync(json, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
  if (!cues.length) {
    console.log('字幕里一句都没有。检查 talk.srt 是不是空的。');
    process.exit(1);
  }
  let durationMs = cues[cues.length - 1].endMs + 500;
  let size = {};
  const talk = path.join(dir, 'talk.mp4');
  if (fs.existsSync(talk)) {
    try {
      const {probeMedia} = await import('./media.mjs');
      const media = probeMedia(talk);
      durationMs = media.durationMs;
      size = {width: media.width, height: media.height};
    } catch {
      // 读不到时长就按最后一句估
    }
  }
  const clips = Array.isArray(doc.clips) ? doc.clips : [];
  const all = [];
  for (const clip of clips) {
    if (!isMotion(clip)) continue;
    const r = validateMotionClip(clip, cues, {durationMs, full: true, tokens: asrTokensOf(dir), ...size, captions: doc.captions});
    all.push(...r.errors);
    r.warnings.forEach((w) => console.log(`提醒 ${w.where}：${w.problem}（${w.fix}）`));
    if (r.plan) {
      const p = toMotionProps(r.plan);
      console.log(`✓ ${p.id} ${p.template}（${p.mode}）窗口 ${(p.startMs / 1000).toFixed(2)}–${(p.endMs / 1000).toFixed(2)} 秒`);
      console.log(`  上屏：${r.plan.screenText.join(' | ')}`);
      console.log(`  marks：${JSON.stringify(Object.fromEntries(Object.entries(p.marks).filter(([k]) => k !== 'chars')))}`);
    }
  }
  all.push(...checkMotionSequence(clips).errors);
  if (all.length) {
    console.log(`motion 段校验未通过：${all.length} 个问题`);
    all.forEach((e, k) => console.log(`${k + 1}. ${e.where}：${e.problem}\n   → 怎么改：${e.fix}`));
    process.exit(1);
  }
  if (!clips.some(isMotion)) console.log('broll.json 里没有 motion 段。');
  process.exit(0);
}
