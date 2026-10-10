#!/usr/bin/env node
// ============================================================
// 分镜校验（零依赖 Node）。
//   node scripts/validate.mjs <storyboard.json>          人看的中文报告；有错退出码 1
//   node scripts/validate.mjs <storyboard.json> --json   机器读的 JSON（llm_make.py 回喂用）
//   node scripts/validate.mjs --specs                    镜头开发者自检：所有 spec.json 结构 + 示例是否合规
// 规则来源：template/src/shots/*.spec.json（参数）、template/src/core/themes.json（主题）、
//          template/src/core/icons.json（图标）、template/public/sfx（音效）。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runIndustryChecks} from './lib/industry.mjs';
import {runTextChecks, FILLIN_BY_TYPE, FILLIN_DEFAULT, typeOfWhere, splitFacts} from './lib/text-checks.mjs';
import {ASPECTS, DEFAULT_STYLE, bpmOf, devStylesAllowed, listStyles, loadStyle, runStyleRules, specsForStyle, styleIdOf, styleIds} from './lib/styles.mjs';
import {checkVo, checkVoiceMeta} from './lib/tts/checks.mjs';

// ---------------- 可调清单（改这里） ----------------
/** 《广告法》极限词。命中即报错；meta.allowWords 里的词豁免 */
export const AD_WORDS = [
  '最', '第一', '唯一', '首个', '首选', '首家', '独家', '顶级', '顶尖', '国家级', '世界级', '全球首', '100%', '100％', '百分之百',
  '绝对', '极致', '万能', '王牌', '独一无二', '史无前例', '全网', '无敌', '遥遥领先', '驰名', '权威', '冠军', '巅峰', '至尊', '永久', '零风险', '根治',
];
/** 含「最」但不算极限用语的常见词 */
export const AD_BENIGN = ['最近', '最后', '最终', '最初', '最早', '第一步', '第一次', '第一眼', '第一句', '第一条'];
/** 画面里禁止出现的网址/二维码/账号 */
export const FORBID = [
  {re: /https?:/i, what: '网址（http）'},
  {re: /www\./i, what: '网址（www）'},
  {re: /\.(com|cn|net|org|io|cc|top|xyz|me|app|ai)\b/i, what: '网址后缀'},
  {re: /二维码|扫码|扫一扫|网址|官网链接/, what: '二维码/网址引导'},
  {re: /@[A-Za-z0-9_一-龥]/, what: '@账号'},
  // 只拦「X号：具体名字」和「关注/搜 XX 号」这类引流写法；单独出现品类词（如产品本身就是做公众号排版的）只提醒
  {re: /(微信|抖音|快手|小红书|QQ|qq|视频|公众)号\s*[:：]\s*\S/, what: '账号名（X号：名字）'},
  {re: /(关注|搜索|搜|添加|加)\s*[^\s，。,！!？?]{0,12}(微信|抖音|快手|小红书|QQ|qq|视频|公众)号/, what: '引流写法（关注/搜 XX 号）'},
];
/** 平台品类词：不拦，只提醒（产品本身的品类词加进 meta.allowWords 就不再提醒） */
export const PLATFORM_WORDS = ['公众号', '视频号', '抖音号', '快手号', '小红书号', '微信号', 'QQ号'];
export const DUR_RANGE = [15, 45];
/** maxHold：同一句字幕连续显示的最长秒数（超过就拆成字幕数组或拆镜） */
export const CAPTION = {maxLines: 2, lineMax: 12, maxHot: 1, maxHold: 5, maxSegs: 3};
/** 容易被照抄的套路句式：字幕以这些开头就提醒 */
export const CLICHE_START = ['三件事', '三步', '一句话', '只需三步', '三个', '两个', '四个', '这些时刻', '这些麻烦'];
/** 套路句式（正则，匹配去掉 {} 和换行后的字幕；不要求开头，全句任意位置命中即算） */
export const CLICHE_RE = [
  /^这些.{1,3}，?你是不是/,
  /(就是)?这\s*[0-9一二两三四五六七八九十]+\s*步/,
  /[0-9一二两三四五六七八九十]+\s*步搞定/,
];
/** 删字凑字数留下的残词：命中提醒整句重写。re 用来排除正常词（如「卡脖子」） */
export const BROKEN_WORDS = [
  {w: '卡脖', re: /卡脖(?!子)/},
  {w: '自传', re: /自传(?!记)/},
  {w: '推进草稿', re: /推进草稿/},
  {w: '命令推进', re: /命令推进/},
];
/** 数字来源关键词：counter.sub 出现它们，meta.facts 里就必须有对应来源 */
export const SOURCE_WORDS = ['测试', '实测', '统计', '调研', '数据显示', '调查', '报告显示'];
/** 中段镜头：常规结构里至少要有一个，避免片子都长成 hook → quickList → mockApp → counter → endCard */
export const MID_SHOTS = ['compare', 'steps', 'phone', 'meter', 'dataChart'];
export const BPM_RANGE = [90, 150];

// ---------------- 路径与数据 ----------------
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATE = path.join(ROOT, 'template');
const SHOTS_DIR = path.join(TEMPLATE, 'src', 'shots');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));

export const loadSpecs = () => {
  const specs = {};
  for (const f of fs.readdirSync(SHOTS_DIR)) {
    if (!f.endsWith('.spec.json')) continue;
    const s = readJson(path.join(SHOTS_DIR, f));
    specs[s.type] = s;
  }
  return specs;
};
const THEMES = readJson(path.join(TEMPLATE, 'src', 'core', 'themes.json'));
// 和 template/src/core/brand-contrast.ts 的 relLuminance 同一条 WCAG 折线（0.03928）。
// 这里只决定要不要提醒；真正调色在渲染侧，对比度已经够时不会改色。
const brandLum = (color) => {
  const n = parseInt(color.slice(1), 16);
  const ch = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
};
const brandContrast = (a, b) => {
  const hi = Math.max(brandLum(a), brandLum(b));
  const lo = Math.min(brandLum(a), brandLum(b));
  return (hi + 0.05) / (lo + 0.05);
};
const brandCardIsDark = (color) => brandLum(color) < 0.18;
/** 样例里的文字（examples/*.json、spec.json 的 example、shots.md 的 json 代码块）：新分镜的字和它们太像就提醒（别照抄样例）。
 *  kind: caption = 字幕/口号；param = 其他参数文字。SEQS = examples 的镜头类型序列 */
const collectStrings = (v, out) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!NON_SCREEN_KEYS.includes(k)) collectStrings(x, out);
  return out;
};
/** 不上屏 / 结构性字段：不参与「和样例太像」、数字口径这些文字检查（插画 id「travel/house」、素材路径、来源说明等） */
const NON_SCREEN_KEYS = ['icon', 'src', 'kind', 'visual', 'tone', 'chart', 'from', 'higherIs', 'type', 'mode', 'illust', 'layout', 'source', 'itemId', 'refs', 'evidence', 'hex'];
const EXAMPLE_SEQS = [];
const EXAMPLE_COUNTERS = [];
let EXAMPLE_CACHE = null;
const exampleLines = () => (EXAMPLE_CACHE ??= (() => {
  const out = [];
  const addShot = (file, title, s) => {
    if (!s || typeof s !== 'object') return;
    for (const c of [s.caption, s.params?.slogan].flat()) if (typeof c === 'string') out.push({file, title, text: c, kind: 'caption'});
    const ps = collectStrings(s.params ?? {}, []).filter((x) => x !== s.params?.slogan && units(x) >= 5);
    for (const x of ps) out.push({file, title, text: x, kind: 'param'});
    if (s.type === 'counter' && s.params) EXAMPLE_COUNTERS.push({file, title, from: s.params.from, to: s.params.to, suffix: s.params.suffix ?? '', sub: s.params.sub});
  };
  const dir = path.join(ROOT, 'examples');
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const sb = readJson(path.join(dir, f));
        for (const s of sb.shots ?? []) addShot(`examples/${f}`, sb.meta?.title, s);
        const exTypes = (sb.shots ?? []).map((s) => s?.type);
        let exDurs = [];
        try {
          exDurs = schedule(sb, loadSpecs()).map((s) => s.dur);
        } catch {}
        EXAMPLE_SEQS.push({file: `examples/${f}`, title: sb.meta?.title, seq: exTypes.join('→'), types: exTypes, durs: exDurs});
      } catch {}
    }
  } catch {}
  try {
    for (const f of fs.readdirSync(SHOTS_DIR)) {
      if (!f.endsWith('.spec.json')) continue;
      try {
        const sp = readJson(path.join(SHOTS_DIR, f));
        if (sp.example) addShot(f, '__spec__', {type: sp.type, ...sp.example});
      } catch {}
    }
  } catch {}
  try {
    const md = fs.readFileSync(path.join(ROOT, 'shots.md'), 'utf8');
    for (const m of md.matchAll(/```json\s*\n([\s\S]*?)```/g)) {
      try {
        const o = JSON.parse(m[1]);
        for (const s of Array.isArray(o) ? o : o.shots ?? [o]) addShot('shots.md', '__spec__', s);
      } catch {
        for (const c of m[1].matchAll(/"(?:caption|slogan|text|sub|label|desc|title)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
          const t = c[1].replace(/\\n/g, '\n');
          if (units(t) >= 5) out.push({file: 'shots.md', title: '__spec__', text: t, kind: 'caption'});
        }
      }
    }
  } catch {}
  return out;
})());
const ICONS = Object.keys(readJson(path.join(TEMPLATE, 'src', 'core', 'icons.json')));
// 行业插画名单（"format": "illust" 用），见 template/src/illust/names.json + docs/dev/industry-design.md 第 2 节。
// names.json 只是「打算画」的清单，真正画出来的以 template/src/illust/icons.tsx 的 ICONS 注册表为准；
// 两者对不上时（还没画的插画）渲染出来是一个红色占位块，校验之前完全查不出来（2026-09 round4 修复：这里做交叉核对）。
const ILLUST_PATH = path.join(TEMPLATE, 'src', 'illust', 'names.json');
const ILLUST_NAMES = fs.existsSync(ILLUST_PATH) ? readJson(ILLUST_PATH).map((x) => x.id) : [];
const ICONS_TSX_PATH = path.join(TEMPLATE, 'src', 'illust', 'icons.tsx');
const ILLUST_IMPL = fs.existsSync(ICONS_TSX_PATH)
  ? new Set(Array.from(fs.readFileSync(ICONS_TSX_PATH, 'utf8').matchAll(/^\s*'([a-z_]+\/[a-z_-]+)':\s*\w+,/gm)).map((m) => m[1]))
  : null;
const ILLUSTS = ILLUST_IMPL ? ILLUST_NAMES.filter((id) => ILLUST_IMPL.has(id)) : ILLUST_NAMES;
const SFX_KINDS = fs.existsSync(path.join(TEMPLATE, 'public', 'sfx'))
  ? fs.readdirSync(path.join(TEMPLATE, 'public', 'sfx')).filter((f) => f.endsWith('.wav')).map((f) => f.slice(0, -4))
  : [];

// ---------------- 字数：汉字/全角 1，拉丁半个（与 template/src/core/fit.ts 一致） ----------------
const isWide = (cp) =>
  (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x3000 && cp <= 0x303f) ||
  cp === 0x201c || cp === 0x201d || cp === 0x2018 || cp === 0x2019 || cp === 0x2026 || cp === 0x00b7;
export const units = (s) => {
  let n = 0;
  for (const ch of Array.from(String(s).replace(/[{}]/g, ''))) n += isWide(ch.codePointAt(0)) ? 1 : 0.5;
  return n;
};
const fmtN = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** 一拍的秒数：0.5 这类一位小数照旧，128 BPM 这类（0.469）保留三位，免得提示「0.5 秒的整数倍」误导 */
const fmtBeat = (b) => (Math.abs(b * 10 - Math.round(b * 10)) < 1e-9 ? fmtN(b) : b.toFixed(3));
const SHORTEN_FIX = '整句换一种更短的说法（汉字算 1，拉丁字母算半个）；不要删掉词里的字凑字数（「自动上传」不能缩成「自传」），也不要换成英文';
/** 字符二元组相似度（Jaccard），用来发现照抄样例的字幕 */
const bigrams = (s) => {
  const a = Array.from(String(s).replace(/[{}\n\s，。、！？,.!?“”"'：:]/g, ''));
  const out = new Set();
  for (let i = 0; i < a.length - 1; i++) out.add(a[i] + a[i + 1]);
  return out;
};
const similar = (x, y) => {
  const a = bigrams(x);
  const b = bigrams(y);
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const g of a) if (b.has(g)) n++;
  return n / (a.size + b.size - n);
};
const short = (s, n = 16) => {
  const a = Array.from(String(s).replace(/\n/g, '⏎'));
  return a.length > n ? a.slice(0, n).join('') + '…' : a.join('');
};

// ---------------- 时长说法抽取（数字口径一致性用） ----------------
const plainOf = (t) => String(t).replace(/[{}]/g, '').replace(/\n/g, '');
const CN_DIGIT = {零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 半: 0.5};
export const cnNum = (x) => {
  if (/^\d+(\.\d+)?$/.test(x)) return Number(x);
  if (x in CN_DIGIT) return CN_DIGIT[x];
  const m = /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(x);
  if (m) return (m[1] ? CN_DIGIT[m[1]] : 1) * 10 + (m[2] ? CN_DIGIT[m[2]] : 0);
  return NaN;
};
const TIME_UNIT = (u) => (/^(秒|秒钟|s)$/i.test(u) ? 1 : /^(分|分钟|min)$/i.test(u) ? 60 : /^(小时|h)$/i.test(u) ? 3600 : /^天$/.test(u) ? 86400 : 0);
/** 从一段画面文字里抽出所有「多长时间」的说法，统一换算成秒。fast = 秒级说法（N 秒 / 秒出 / 秒级） */
export const durations = (text) => {
  const t = plainOf(text);
  const out = [];
  if (/半天/.test(t)) out.push({sec: 4 * 3600, raw: '半天'});
  if (/一(个|整个)?下午/.test(t)) out.push({sec: 4 * 3600, raw: '一下午'});
  if (/一(个|整个)?上午/.test(t)) out.push({sec: 3 * 3600, raw: '一上午'});
  if (/一整天/.test(t)) out.push({sec: 8 * 3600, raw: '一整天'});
  for (const m of t.matchAll(/(\d+(?:\.\d+)?|[一二两三四五六七八九十半]{1,3})\s*个?\s*(秒钟|秒|分钟|小时|天|min|h)(?![a-z])/gi)) {
    const n = cnNum(m[1]);
    const k = TIME_UNIT(m[2]);
    if (!Number.isFinite(n) || !k) continue;
    out.push({sec: n * k, raw: m[0].replace(/\s+/g, ''), fast: k === 1});
  }
  // 「几秒 / 几分钟」：没有具体数字，但同样是时长说法（几秒钟 = 秒级）
  for (const m of t.matchAll(/几\s*个?\s*(秒钟|秒|分钟|小时|天)/g)) {
    const k = TIME_UNIT(m[1]);
    if (k) out.push({sec: 3 * k, raw: m[0].replace(/\s+/g, ''), fast: k === 1});
  }
  // 「秒 + 动词」的秒级说法：按模式抓，不再是固定词表（秒出/秒算/秒进/秒回…）。
  // 即刻/瞬间/立刻/instantly 这类不带量的速度词只进下面的「速度说法」核对，不参与全片耗时口径比较（它们不是一个时长）
  for (const m of t.matchAll(SEC_VERB_RE)) out.push({sec: 5, raw: m[0], fast: true});
  return out;
};
const SEC_VERB_RE = /(?<![\d几]\s*)秒(?![杀表针钟])[一-龥]/g;
/** 速度说法（模式）。秒杀/秒表/秒针/N 秒钟 不算；「立即/马上/即刻 + 下载/试试/体验/开通…」是行动号召，不算 */
const CTA_VERB = '(?!下载|试|体验|开始|开通|开启|解锁|生效|开课|观看|行动|购买|抢|领|预约|报名|咨询|加入|关注|使用|查看|点击|订|下单|入手|出发|收藏|安装|注册|登录|前往|参与)';
export const SPEED_ZH_RE = new RegExp(`几\\s*秒|(?<![\\d几]\\s*)秒(?![杀表针钟])[一-龥]|即刻${CTA_VERB}|瞬间|立刻${CTA_VERB}|立即${CTA_VERB}|马上${CTA_VERB}|一眨眼|眨眼间|零等待|无需等待|不用等|转眼`, 'g');
export const SPEED_EN_RE = /\b(instantly|instant|in seconds|within seconds|in no time|in a flash|in a snap|right away|immediately|zero wait|no waiting|lightning[- ]fast)\b/gi;
export const speedClaims = (text) => {
  const t = plainOf(text);
  return [...t.matchAll(SPEED_ZH_RE), ...t.matchAll(SPEED_EN_RE)].map((m) => m[0]);
};
const fmtSec = (s) => (s >= 3600 ? `${fmtN(s / 3600)} 小时` : s >= 60 ? `${fmtN(s / 60)} 分钟` : `${fmtN(s)} 秒`);
/** 是否按顺序包含（引用词可以省略中间几个字，如「你不懂我」对「你根本就不懂我」） */
const subseq = (q, p) => {
  let k = 0;
  const a = Array.from(q.replace(/[\s，。、！？,.!?…]/g, ''));
  for (const ch of p) if (ch === a[k]) k++;
  return k >= a.length;
};

// ---------------- 排程（与 template/src/core/timeline.ts 同一算法） ----------------
/** 和 template/src/core/timeline.ts、styles/quiz/checks.mjs 同一组系数。不写或 normal 时返回 null，不乘。 */
export const paceFactor = (meta) => {
  const p = meta?.tweak?.pace;
  if (p === 'slow') return 1.15;
  if (p === 'fast') return 0.88;
  return null;
};
export const schedule = (sb, specs) => {
  const beat = 60 / bpmOf(sb.meta); // cards：meta.bpm || 120（和改造前一样）；其他风格不写 bpm 时用风格默认
  const factor = paceFactor(sb.meta);
  let t = 0;
  return (sb.shots || []).map((shot, i) => {
    const spec = specs[shot?.type];
    const raw0 = typeof shot?.beats === 'number' ? shot.beats * beat : typeof shot?.dur === 'number' ? shot.dur : spec?.dur?.default ?? 3;
    const raw = factor == null ? raw0 : raw0 * factor;
    const dur = Math.max(1, Math.round(raw / beat)) * beat;
    const s = {i, type: shot?.type, raw, start: t, dur, end: t + dur};
    t += dur;
    return s;
  });
};

/** 字幕数组的分段：n 句平分这一镜，分界吸附到整拍（与 template/src/core/layers.tsx 的 captionSegments 同一算法） */
export const captionSegments = (start, dur, n, beat) => {
  const cuts = [0];
  for (let k = 1; k < n; k++) cuts.push(Math.min(dur, Math.max(cuts[k - 1] + beat, Math.round((dur * k) / n / beat) * beat)));
  cuts.push(dur);
  return cuts.slice(0, -1).map((a, k) => [start + a, start + cuts[k + 1]]);
};

// ---------------- 跨字段规则（spec.json 的 JSON-Schema 子集表达不了的） ----------------
const num = (v) => typeof v === 'number' && Number.isFinite(v);
export function crossCheck(type, p, W, err, warn) {
  if (type === 'hook') {
    const v = p.visual;
    if (v === 'phone' && !p.src) err(W('src'), 'visual 是 phone 时必须给截图', '补上 "src": "截图路径.png"，或把 visual 换成 icon / stat / bubble');
    if (v === 'icon' && !p.icon) err(W('icon'), 'visual 是 icon 时必须选一个主图标', '补上 "icon"，从图标清单里选');
    if ((v === 'bubble' || v === 'stat') && !p.text) err(W('text'), `visual 是 ${v} 时必须写 text`, v === 'bubble' ? '写那条扎心消息，如「你根本就不懂我」' : '写大数字，如「3 秒」「87%」');
    if (v === 'illust' && !p.illust) err(W('illust'), 'visual 是 illust 时必须选一张插画', '补上 "illust"，从 template/src/illust/names.json 里选，如 "travel/window"；没有合适的插画就换成 icon');
    // stat/statBar 没有数字时组件会退成大字卡：不拦，但提醒换 visual
    if ((v === 'stat' || v === 'statBar') && typeof p.text === 'string' && !/\d/.test(p.text))
      warn(W('text'), `visual 是 ${v}，但「${p.text}」里没有数字，画面会退成一张大字卡`, '说一处风景/一样东西用 illust，说一个功能用 icon；真有数字（且在 meta.facts 里）再用 stat');
  }
  if (type === 'meter') {
    const max = num(p.max) ? p.max : 10;
    if (num(p.value) && p.value > max) err(W('value'), `value ${p.value} 比 max ${max} 还大，画面数字会对不上`, `把 value 改到 0–${max}，或把 max 调大`);
    if (num(p.from) && p.from > max) err(W('from'), `from ${p.from} 比 max ${max} 还大`, `把 from 改到 0–${max}`);
  }
  if (type === 'dataChart') {
    const rows = Array.isArray(p.data) ? p.data : [];
    if (p.chartType === 'donut' && rows.length > 5) err(W('data'), 'donut 类别超过 5 个，标签和占比会挤在一起', '合并小类别，或改用 bar');
    if (rows.length && rows.every((d) => num(d?.value) && d.value === 0)) err(W('data'), '所有图表数据都是 0，无法读出比较或占比', '换成有差异的数据，或改用文字解释');
    if (p.chartType === 'line') {
      const groups = new Map();
      const order = new Map();
      rows.forEach((d) => {
        const key = d?.series ?? '';
        groups.set(key, (groups.get(key) ?? 0) + 1);
        if (!order.has(key)) order.set(key, []);
        order.get(key).push(String(d?.label ?? ''));
      });
      if ([...groups.values()].some((n) => n < 2)) err(W('data'), 'line 每条 series 至少要有两个时间点才能连成趋势', '补上另一个时间点，或改用 dot 展示单点');
      const sigs = [...order.values()].map((a) => a.join('\u0001'));
      if (sigs.length > 1 && sigs.some((s) => s !== sigs[0])) err(W('data'), '折线每条线的时间点不一致，会对不齐', '每条 series 用同一组 label、同一顺序');
    }
    if (p.chartType === 'stacked' && rows.some((d) => !d?.series)) err(W('data'), 'stacked 每条数据都需要 series 来标识堆叠分段', '给每条数据加 series 名称；相同 label 的数据会组成一条堆叠条');
    if (p.chartType === 'stacked') {
      const byLabel = new Map();
      rows.forEach((d) => {
        const k = String(d?.label ?? '');
        if (!byLabel.has(k)) byLabel.set(k, new Set());
        if (d?.series) byLabel.get(k).add(String(d.series));
      });
      const counts = [...byLabel.values()].map((s) => s.size);
      if (counts.length > 1 && counts.some((n) => n !== counts[0])) err(W('data'), '堆叠图每个类别的段数不一致，会画成错误的 100%', '每个类别都写上相同的 series；没有的那段写 value: 0');
    }
    if (num(p.max) && rows.some((d) => num(d?.value) && d.value > p.max)) err(W('max'), 'max 小于某条数据，图表会截断或把点画出坐标区', '把 max 调到不小于最大数据值');
    if (rows.filter((d) => d?.focus === true).length > 1) err(W('data'), '一张图只能突出一个 focus 数据项', '只保留最重要的一条为 focus: true');
  }
  if (type === 'counter') {
    if (p.showFrom === true && !num(p.from)) err(W('from'), 'showFrom 是 true 但没写 from（旧值）', '补上 "from": 旧值，或删掉 showFrom');
    if (num(p.from) && num(p.to) && p.from === p.to) warn(W('from'), 'from 和 to 一样，数字不会滚动', '改成不同的值，或删掉 from');
  }
  if (type === 'compare') {
    const L = p.left ?? {};
    const R = p.right ?? {};
    for (const k of ['stat', 'level']) {
      const a = L[k] !== undefined;
      const b = R[k] !== undefined;
      if (a !== b) err(W(`${a ? 'right' : 'left'}.${k}`), `只有一栏写了 ${k}，对比不成立`, `两栏都写 ${k}，或两栏都删掉`);
    }
    if (L.level !== undefined && R.level !== undefined && !p.meterLabel) warn(W('meterLabel'), '两栏都有 level 刻度条，但没写这把尺子量什么', '补上 "meterLabel"，如「麻烦程度」');
  }
  if (type === 'mockApp') {
    const n = Array.isArray(p.items) ? p.items.length : 0;
    if (p.kind === 'dashboard' || p.kind === 'list')
      (Array.isArray(p.items) ? p.items : []).forEach((it, k) => {
        if (it && it.value && typeof it.text === 'string' && units(it.text) > 10) err(W(`items[${k}].text`), `行尾有 value 时 text 最多 10 字（现在 ${fmtN(units(it.text))} 字）`, SHORTEN_FIX);
      });
    if (p.kind === 'form' && p.input) warn(W('input'), 'form 界面不显示 input', '删掉 input；表单内容写在 items 的 value 里');
    if ((p.kind === 'form' || p.kind === 'list') && n < 2) err(W('items'), `${p.kind} 界面至少要 2 个 items，否则画面大半是空的`, '补到 2–5 条');
    if (p.kind === 'dashboard' && !p.stat && !Array.isArray(p.series)) warn(W('stat'), 'dashboard 没有 stat 也没有 series，主角不突出', '补一个 "stat": {"value": "1,286", "label": "今日新增"} 或 "series"');
    if (num(p.highlight) && p.highlight >= n) err(W('highlight'), `highlight ${p.highlight} 超出了 items 范围（共 ${n} 条，从 0 数）`, `改成 0–${Math.max(0, n - 1)}，或删掉`);
  }
  if (type === 'factSheet') {
    // rows 的必填字段按 layout 分派：syllabus 只用 no/name/lessons，swatch 只用 hex/name，其余（spec/box/exam）用 key/value。
    // spec.json 的 required 只能整体声明，表达不了"按 layout 二选一"，这里用跨字段规则补（round4 修复：之前 rows.items 统一
    // 要求 key+value，逼 syllabus/swatch 布局的分镜写一堆渲染器根本不读的占位字段）
    (Array.isArray(p.rows) ? p.rows : []).forEach((row, k) => {
      if (!row || typeof row !== 'object') return;
      const rw = (f) => W(`rows[${k}]${f ? '.' + f : ''}`);
      if (p.layout === 'syllabus') {
        if (typeof row.name !== 'string' || !row.name.trim()) err(rw('name'), 'syllabus 布局的 rows 必须有 name（章节名）', '补上 "name": "..."');
        if (!num(row.lessons)) err(rw('lessons'), 'syllabus 布局的 rows 必须有 lessons（节数，数字）', '补上 "lessons": 6 这样的数字');
      } else if (p.layout === 'swatch') {
        if (typeof row.hex !== 'string' || !row.hex.trim()) err(rw('hex'), 'swatch 布局的 rows 必须有 hex', '补上 "hex": "#RRGGBB"');
        if (typeof row.name !== 'string' || !row.name.trim()) err(rw('name'), 'swatch 布局的 rows 必须有 name（色号名）', '补上 "name": "..."');
      } else {
        if (typeof row.key !== 'string' || !row.key.trim()) err(rw('key'), `${p.layout ?? 'spec'} 布局的 rows 必须有 key`, '补上 "key"');
        if (typeof row.value !== 'string' || !row.value.trim()) err(rw('value'), `${p.layout ?? 'spec'} 布局的 rows 必须有 value`, '补上 "value"');
      }
    });
  }
  if (type === 'quickList' && num(p.max) && Array.isArray(p.items)) {
    p.items.forEach((it, k) => {
      if (it && num(it.score) && it.score > p.max) err(W(`items[${k}].score`), `score ${it.score} 比 max ${p.max} 还大`, `改到 0–${p.max}`);
    });
  }
}

// ---------------- 校验主体 ----------------
/** 「没有简报依据」类错误的统一标记（checkSpecs 单镜自检时按它过滤，单镜示例本来就没有 meta.facts） */
const NO_BASIS = '没有简报依据';
const DEMO_HINT_RE = /演示|示例|示意|模拟|虚构|sample|demo|simulated|illustrative/i;
export function validate(sb, {baseDir = process.cwd(), specs = loadSpecs(), brief = null, allowDraftStyles = false, env = process.env, skipCustomFiles = false} = {}) {
  const errors = [];
  const warnings = [];
  const texts = []; // [{where, text}] 画面上会出现的字，统一扫网址/极限词
  const customNums = []; // 自由镜头 slots 里的数字，等 sourceCheck 定义后再核对来源
  const assets = []; // [{where, rel, abs}]
  const where = (i, type, field) => (i < 0 ? field : `第 ${i + 1} 镜（${type ?? '?'}）${field}`);
  const err = (w, problem, fix) => errors.push({where: w, problem, fix});
  const warn = (w, problem, fix) => warnings.push({where: w, problem, fix});

  const resolveAsset = (rel) => {
    if (typeof rel !== 'string' || !rel) return null;
    const cands = [path.isAbsolute(rel) ? rel : path.resolve(baseDir, rel), path.join(TEMPLATE, 'public', rel)];
    return cands.find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
  };

  // lang=en：字幕按拉丁字符数估宽（64px 下中文每行 12 字 ≈ 英文每行 22 字符），不用中文的 units() 半宽规则；报错信息也换成英文
  const checkRich = (w, s, {maxLines, lineMax, maxLen}) => {
    const lang = meta?.lang === 'en' ? 'en' : 'zh';
    const EN_SCALE = 22 / 12;
    const lineLen = (ln) => (lang === 'en' ? Array.from(ln.replace(/[{}]/g, '')).length : units(ln));
    const effLineMax = lang === 'en' && lineMax ? Math.round(lineMax * EN_SCALE) : lineMax;
    const effMaxLen = lang === 'en' && maxLen ? Math.round(maxLen * EN_SCALE) : maxLen;
    const lines = s.split('\n');
    if (lines.length > maxLines)
      err(w, lang === 'en' ? `${lines.length} lines, at most ${maxLines}` : `有 ${lines.length} 行，最多 ${maxLines} 行`,
        lang === 'en' ? `Cut it down to ${maxLines} line(s) or fewer (use \\n to break lines)` : `删减或合并成 ${maxLines} 行以内（用 \\n 换行）`);
    lines.forEach((ln, k) => {
      const u = lineLen(ln);
      if (effLineMax && u > effLineMax)
        err(w, lang === 'en'
            ? `Line ${k + 1} "${short(ln.replace(/[{}]/g, ''), 30)}" is ${fmtN(u)} characters, at most ${effLineMax}`
            : `第 ${k + 1} 行「${short(ln.replace(/[{}]/g, ''), 20)}」${fmtN(u)} 字，每行最多 ${lineMax} 字`,
          lang === 'en' ? 'Shorten this line, or break it into two with \\n at a natural pause' : `缩短这一行，或在合适处用 \\n 断成两行（拉丁字母算半个字）`);
      if (!ln.replace(/[{}\s]/g, '')) err(w, lang === 'en' ? `Line ${k + 1} is empty` : `第 ${k + 1} 行是空的`, lang === 'en' ? 'Remove the extra \\n' : '删掉多余的 \\n');
    });
    const totalLen = lang === 'en' ? Array.from(s.replace(/[{}\n]/g, '')).length : units(s);
    if (effMaxLen && totalLen > effMaxLen)
      err(w, lang === 'en' ? `${fmtN(totalLen)} characters total, at most ${effMaxLen}` : `共 ${fmtN(units(s))} 字，最多 ${maxLen} 字`,
        lang === 'en' ? 'Trim the text' : '精简文字');
    let depth = 0;
    let pairs = 0;
    let inner = '';
    let bad = false;
    for (const ch of s) {
      if (ch === '{') {
        if (depth) bad = true;
        depth++;
        inner = '';
      } else if (ch === '}') {
        if (!depth) bad = true;
        else {
          depth--;
          pairs++;
          if (!inner.trim()) err(w, lang === 'en' ? '{} is empty' : '{} 里是空的', lang === 'en' ? 'Put the emphasized words inside {}, or remove the {}' : '把要强调的字放进 {} 里，或删掉 {}');
        }
      } else if (depth) {
        inner += ch;
        if (ch === '\n') bad = true;
      }
    }
    if (depth || bad)
      err(w, lang === 'en' ? '{} is not balanced (or nested, or spans a line break)' : '{} 没有成对（或嵌套、跨行了）',
        lang === 'en' ? 'Every { needs a matching }; do not nest {} and do not let it span a line break' : '每个 { 后面都要有对应的 }，不要嵌套、不要跨行，例如「对方要的是{你的在乎}」');
    if (pairs > CAPTION.maxHot)
      err(w, lang === 'en' ? `${pairs} {} emphasis spans used, at most ${CAPTION.maxHot}` : `用了 ${pairs} 处 {} 强调，最多 ${CAPTION.maxHot} 处`,
        lang === 'en' ? 'Keep only the single most important {} span, unwrap the rest' : '只保留最关键的一处 {}，其余去掉花括号');
  };

  const typeName = (t) => ({string: '文字', number: '数字', integer: '整数', boolean: 'true/false', object: '对象 {…}', array: '数组 […]'})[t] ?? t;

  const checkValue = (schema, v, w, isScreenText = true) => {
    if (!schema) return;
    const T = schema.type;
    const typeOk =
      T === 'string' ? typeof v === 'string' :
      T === 'number' ? typeof v === 'number' && Number.isFinite(v) :
      T === 'integer' ? Number.isInteger(v) :
      T === 'boolean' ? typeof v === 'boolean' :
      T === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) :
      T === 'array' ? Array.isArray(v) : true;
    if (!typeOk) {
      err(w, `类型不对：应该是${typeName(T)}，现在是 ${short(JSON.stringify(v), 24)}`, schema.description ? `按说明填写：${schema.description}` : `改成${typeName(T)}`);
      return;
    }
    if (schema.enum && !schema.enum.includes(v)) {
      err(w, `「${v}」不是可选值`, `只能从这些里选一个：${schema.enum.join(' / ')}`);
      return;
    }
    if (T === 'string') {
      if (schema.format === 'asset') {
        const abs = resolveAsset(v);
        if (!abs) err(w, `素材文件找不到：${v}`, `确认文件存在；相对路径以 storyboard.json 所在目录为准（${baseDir}）`);
        else {
          const ext = path.extname(v).slice(1).toLowerCase();
          if (schema.accept && !schema.accept.includes(ext)) err(w, `素材格式 .${ext} 不支持`, `换成 ${schema.accept.map((e) => '.' + e).join(' / ')}`);
          // 占位/空文件拦截：图片/视频真实文件通常至少几 KB，几十到几百字节大概率是占位 stub（渲染会直接报错或整块空白），
          // 不能等渲染失败才发现（round4 修复：ind-food/ind-travel 都是这种 67~68 字节占位图混进来才炸的）
          try {
            const sz = fs.statSync(abs).size;
            if (sz < 1024) err(w, `素材文件「${v}」只有 ${sz} 字节，大概率是占位/空文件，不是真实图片或视频`, '换成真实素材；没有真实素材就删掉这个字段，改用 source:"drawn" 的插画兜底（见对应镜头的「没有照片时」说明）');
          } catch {}
          if (/(^|[\\/])_dev([\\/]|$)/.test(v)) warn(w, `素材路径「${v}」在 _dev/ 目录下，这是测试用的占位素材`, '正式交付前换成真实素材路径');
          assets.push({where: w, rel: v, abs});
        }
        return;
      }
      if (schema.format === 'icon') {
        if (!ICONS.includes(v)) err(w, `没有叫「${v}」的图标`, `从图标清单里选：${ICONS.join(' ')}`);
        return;
      }
      if (schema.format === 'illust') {
        if (!ILLUSTS.includes(v)) err(w, `没有叫「${v}」的插画`, `从 template/src/illust/names.json 里选一个 "<行业>/<名字>"，如 "${ILLUSTS[0] ?? 'food/bowl'}"`);
        return;
      }
      if (schema.format === 'color') {
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) err(w, `颜色格式不对：${v}`, '写成 #RRGGBB，例如 #3B82F6');
        return;
      }
      if (schema.format === 'caption') {
        checkRich(w, v, {maxLines: schema.maxLines ?? 2, lineMax: schema.lineMax, maxLen: schema.maxLen});
      } else if (schema.format === 'note') {
        // 不上屏的说明字段（如 evidence）：只查字数，不限制 {} / 换行，不扫网址/极限词（见下面 isScreenText 判断）
        if (schema.maxLen !== undefined && units(v) > schema.maxLen)
          err(w, `「${short(v, 20)}」${fmtN(units(v))} 字，最多 ${schema.maxLen} 字`, SHORTEN_FIX);
      } else {
        if (/[{}]/.test(v)) err(w, '这个字段不支持 {} 强调', '去掉花括号');
        if (/\n/.test(v)) err(w, '这个字段不支持换行', '去掉 \\n，写成一行');
        if (schema.maxLen !== undefined && units(v) > schema.maxLen)
          err(w, `「${short(v, 20)}」${fmtN(units(v))} 字，最多 ${schema.maxLen} 字`, SHORTEN_FIX);
      }
      // 最少字数按「非空白字符个数」算（单个字母/数字也算 1），避免把 "x" 误报成空
      if (schema.minLen !== undefined && Array.from(v.replace(/[\s{}]/g, '')).length < schema.minLen) err(w, schema.minLen <= 1 ? '不能为空' : `至少 ${schema.minLen} 个字`,schema.description ? `填写：${schema.description}` : '填上内容');
      if (isScreenText && schema.format !== 'note') texts.push({where: w, text: v});
      return;
    }
    if (T === 'number' || T === 'integer') {
      if (schema.minimum !== undefined && v < schema.minimum) err(w, `${v} 太小，最小 ${schema.minimum}`, `改到 ${schema.minimum}–${schema.maximum ?? '∞'} 之间`);
      if (schema.maximum !== undefined && v > schema.maximum) err(w, `${v} 太大，最大 ${schema.maximum}`, `改到 ${schema.minimum ?? '-∞'}–${schema.maximum} 之间`);
      return;
    }
    if (T === 'array') {
      if (schema.minItems !== undefined && v.length < schema.minItems) err(w, `只有 ${v.length} 项，至少 ${schema.minItems} 项`, '补足条目');
      if (schema.maxItems !== undefined && v.length > schema.maxItems) err(w, `有 ${v.length} 项，最多 ${schema.maxItems} 项`, `删到 ${schema.maxItems} 项以内，留最重要的`);
      v.forEach((x, k) => checkValue(schema.items, x, `${w}[${k}]`, isScreenText));
      return;
    }
    if (T === 'object') {
      const props = schema.properties ?? {};
      for (const r of schema.required ?? []) {
        if (v[r] === undefined || v[r] === null) err(`${w}.${r}`, '缺少必填字段', props[r]?.description ? `补上：${props[r].description}` : '补上这个字段');
      }
      for (const [k, x] of Object.entries(v)) {
        if (!(k in props)) {
          err(`${w}.${k}`, '多了一个不认识的字段', `删掉，或检查拼写。可用字段：${Object.keys(props).join('、')}`);
          continue;
        }
        if (x === undefined || x === null) continue;
        checkValue(props[k], x, `${w}.${k}`, isScreenText);
      }
    }
  };

  // ---- 顶层 ----
  if (!sb || typeof sb !== 'object' || Array.isArray(sb)) {
    err('整个文件', '不是一个 JSON 对象', '最外层写成 {"meta": {...}, "shots": [...]}');
    return {errors, warnings, slots: [], total: 0, beat: 0.5, assets, human: []};
  }
  for (const k of Object.keys(sb)) {
    if (k === 'bgm') warn('bgm', '这个字段由 make.mjs 自动填写', '删掉它');
    else if (k === 'voice') err('voice', '配音设置要写在 meta.voice 里（顶层的 voice 是 make.mjs 生成的配音轨）', '把它挪进 meta：{"meta": {…, "voice": {"provider": "minimax"}}}，每镜要念的话写在镜头的 vo 里');
    else if (!['meta', 'shots'].includes(k)) err(k, '多了一个不认识的顶层字段', '最外层只能有 meta 和 shots');
  }

  // ---- 风格与画幅（meta.style 不写 = cards，下面 cards 的规则和改造前逐条一致）----
  const styleId = styleIdOf(sb.meta);
  const style = loadStyle(styleId);
  const isCards = styleId === DEFAULT_STYLE;
  const SM = style?.manifest ?? loadStyle(DEFAULT_STYLE)?.manifest ?? {};
  const commonTypes = new Set(Object.keys(specs));
  if (!isCards && style) specs = specsForStyle(style, specs);
  const aspect = typeof sb.meta?.aspect === 'string' && ASPECTS[sb.meta.aspect] ? sb.meta.aspect : SM.defaultAspect ?? '9:16';
  if (sb.meta && typeof sb.meta === 'object') {
    if (sb.meta.style !== undefined && (typeof sb.meta.style !== 'string' || !style))
      err('meta.style', `没有叫「${sb.meta.style}」的风格`, `从这些里选：${styleIds().join(' / ')}（不写就是 cards）；各风格适合什么产品见 styles/<id>/STYLE.md`);
    else if (style && style.manifest.status !== 'stable' && !allowDraftStyles && !devStylesAllowed())
      err('meta.style', `风格「${styleId}」还在开发中（status: ${style.manifest.status}），不能出片`, `换成已完成的风格：${listStyles().filter((x) => x.manifest.status === 'stable').map((x) => x.id).join(' / ')}（风格负责人自测：设环境变量 PROMO_DEV_STYLES=1）`);
    if (sb.meta.aspect !== undefined) {
      const ok = SM.aspects ?? ['9:16'];
      if (typeof sb.meta.aspect !== 'string' || !ASPECTS[sb.meta.aspect]) err('meta.aspect', `「${sb.meta.aspect}」不是可选画幅`, `只能写 ${Object.keys(ASPECTS).join(' / ')}；不写用风格默认（${SM.defaultAspect}）`);
      else if (!ok.includes(sb.meta.aspect)) err('meta.aspect', `「${styleId}」风格不支持 ${sb.meta.aspect} 画幅`, `改成 ${ok.join(' / ')}，或删掉 meta.aspect`);
    }
  }

  // ---- meta ----
  const meta = sb.meta;
  if (!meta || typeof meta !== 'object') err('meta', '缺少 meta', '补上 "meta": {"title": "...", "product": "...", "theme": "warm-emotion"}');
  else {
    const known = [
      'title', 'product', 'bpm', 'theme', 'brandColor', 'disclaimer', 'logo', 'allowWords', 'cta', 'facts',
      'industry', 'lang', 'platform', 'notices', 'action', 'durationRange', 'subCategory', 'attachDeal', 'demoData',
      // assets：素材清单 [{src, source: merchant|illustration|screenshot, kind?, pair?}]，结构和真实性由 scripts/checks/assets.mjs 校验
      'assets',
      // style / aspect：风格包（styles/<id>/）与画幅（9:16 / 4:5），不写 = cards + 风格默认画幅
      'style', 'aspect',
      // voice：配音（{provider, voiceId?, speed?, emotion?, model?, subtitles?}），不写 = 不配音；各镜 vo 是旁白
      'voice',
      // tweak：可选节奏 / 字号 / 标题字体。不写时排程和字号与以前一致
      'tweak',
    ];
    if (meta.voice !== undefined) checkVoiceMeta(meta.voice, {lang: meta.lang === 'en' ? 'en' : 'zh', err, warn, env});
    // demoData：整片用的是演示数据（简报没给真数据，界面里的数字是示例）。只放行「演示界面里的内容」，不放行效果说法；
    // 画面上必须有「演示/示例」提示（写在 meta.disclaimer，顶部胶囊会显示）
    if (meta.demoData !== undefined) {
      if (typeof meta.demoData !== 'boolean') err('meta.demoData', '应该是 true/false', '界面里用了示例数字就写 true，并在 meta.disclaimer 写「演示画面，数据为示例」；没用就删掉');
      else if (meta.demoData && !(typeof meta.disclaimer === 'string' && DEMO_HINT_RE.test(meta.disclaimer)))
        err('meta.demoData', 'demoData 是 true，但画面上没有「演示数据」提示', meta?.lang === 'en' ? 'Set meta.disclaimer to something like "Demo screens, sample data"' : 'meta.disclaimer 写「演示画面，数据为示例」（顶部胶囊会显示）；不要写进 notices，免得重复');
    }
    // subCategory / attachDeal：行业规则的 sub 层和 checks[].when 早就在用（merge-rules.mjs、util.mjs 的 evalWhen），
    // 但一直没进这份 known 字段清单，写了就被当成"不认识的字段"拦掉，规则等于永远触发不了（round4 修复）
    if (meta.subCategory !== undefined && (typeof meta.subCategory !== 'string' || !meta.subCategory.trim()))
      err('meta.subCategory', '应该是文字', '按行业的子品类填，如 food 行业写 "hotpot"；不确定就删掉');
    if (meta.attachDeal !== undefined && typeof meta.attachDeal !== 'boolean')
      err('meta.attachDeal', '应该是 true/false', '是否挂了团购/优惠链接，写 true 或 false');
    // facts：2026-09 起是 {id,text}[]（给 refs 一个可指认的 id），不再是纯字符串数组
    if (meta.facts !== undefined) {
      if (!Array.isArray(meta.facts)) err('meta.facts', '应该是数组', '写成 [{"id": "f1", "text": "..."}, ...]；把简报里给的数字和来源原话抄进 text，id 随便起（f1、f2…），镜头用 params.refs: ["f1"] 引用');
      else meta.facts.forEach((f, k) => {
        const w = `meta.facts[${k}]`;
        if (!f || typeof f !== 'object' || Array.isArray(f)) err(w, '应该是对象 {id, text}', '写成 {"id": "f1", "text": "简报里的原话"}');
        else {
          if (typeof f.id !== 'string' || !f.id.trim()) err(`${w}.id`, '缺少 id（文字，给 refs 引用用）', '起一个短 id，如 "f1"');
          if (typeof f.text !== 'string' || !f.text.trim()) err(`${w}.text`, '缺少 text（简报原话）', '把简报里给的数字和来源原话抄进来');
          // source：这条数字在简报里写的来源（2026-09 p2r2 起必填）。没有它，校验分不清「简报给的」和「模型自己编的」
          if (typeof f.source !== 'string' || !f.source.trim())
            err(`${w}.source`, '缺少 source（这条数字的来源）', '照抄简报「数字和来源」那栏写的来源，如 "source": "2026-09 价目表"、"后台统计至 8 月"；简报没写来源就写 "简报未注明来源"。不许自己编来源，也不许自己编 fact');
          if (f.quote !== undefined && (typeof f.quote !== 'string' || !f.quote.trim())) err(`${w}.quote`, '应该是文字（简报原句）', '把简报里那一句原样抄进来；不需要就删掉');
          for (const k of Object.keys(f)) if (!['id', 'text', 'source', 'quote'].includes(k)) err(`${w}.${k}`, '多了一个不认识的字段', '只能有 id、text、source、quote');
          // --brief：有简报原文时逐条核对（数字必须在简报里出现；quote 必须逐字出现）
          if (typeof brief === 'string' && brief.trim() && typeof f.text === 'string') {
            const B = brief.replace(/\s+/g, '');
            const bNums = new Set((brief.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
            const miss = (f.text.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => !bNums.has(n));
            if (miss.length) err(`${w}.text`, `「${short(f.text, 24)}」里的 ${[...new Set(miss)].join('、')} 在简报里找不到（${NO_BASIS}）`, '这是自己编的数字：删掉这条 fact，画面上用到它的地方改成不带数字的说法');
            if (typeof f.quote === 'string' && f.quote.trim() && !B.includes(f.quote.replace(/\s+/g, '')))
              err(`${w}.quote`, `quote「${short(f.quote, 24)}」在简报里找不到原句（${NO_BASIS}）`, 'quote 只能逐字复制简报里的一句话；找不到就删掉这条 fact');
          }
          // facts.text 不上屏（不进 texts 数组），所以不扫网址/极限词；它是给 refs 引用、给人和校验看的依据
        }
      });
    }
    // industry / lang / platform：枚举值，不写就是默认值，校验按下面的可选值检查
    if (meta.industry !== undefined) {
      const opts = ['software', 'food', 'ecommerce', 'education', 'beauty', 'travel', 'general'];
      if (typeof meta.industry !== 'string' || !opts.includes(meta.industry)) err('meta.industry', `「${meta.industry}」不是可选值`, '六个行业包是 software / food / ecommerce / education / beauty / travel，不写默认 software。产品不在六个行业里时不要编行业名：先告诉用户没有专门合规规则包；版式可借最接近的行业并写明借了哪个；只跑通用广告法就写 general。详见 SKILL.md「产品不在六个行业里」（英文 SKILL.en.md "When the product is not in the six industries"）。');
    }
    if (meta.lang !== undefined) {
      const opts = ['zh', 'en'];
      if (typeof meta.lang !== 'string' || !opts.includes(meta.lang)) err('meta.lang', `「${meta.lang}」不是可选值`, `只能从这些里选一个：${opts.join(' / ')}；不写默认 zh`);
    }
    if (meta.platform !== undefined) {
      const opts = ['douyin', 'shipinhao', 'generic'];
      if (typeof meta.platform !== 'string' || !opts.includes(meta.platform)) err('meta.platform', `「${meta.platform}」不是可选值`, `只能从这些里选一个：${opts.join(' / ')}；不写默认 generic`);
    }
    // notices：底部提示条，字符串数组
    if (meta.notices !== undefined) {
      if (!Array.isArray(meta.notices) || meta.notices.some((x) => typeof x !== 'string' || !x.trim()))
        err('meta.notices', '应该是文字数组', '如 ["以团购详情页为准"]；不需要就删掉 meta.notices');
      else meta.notices.forEach((n, k) => {
        if (units(n) > 24) err(`meta.notices[${k}]`, `「${short(n, 20)}」${fmtN(units(n))} 字，最多 24 字`, SHORTEN_FIX);
        texts.push({where: `meta.notices[${k}]`, text: n});
      });
    }
    // action：核心动作一句话，不上画面，只给字数上限（业务规则——是否真的演出来了，由 industry/text-checks 判断）
    if (meta.action !== undefined && (typeof meta.action !== 'string' || !meta.action.trim())) err('meta.action', '应该是文字', '一句话：用户做什么 → 产品给出什么');
    // durationRange：[min, max] 秒，覆盖默认总时长范围（真正生效由业务规则接手，这里只做类型/范围检查）
    if (meta.durationRange !== undefined) {
      const d = meta.durationRange;
      if (!Array.isArray(d) || d.length !== 2 || d.some((x) => typeof x !== 'number' || !Number.isFinite(x)))
        err('meta.durationRange', '应该是 [最短秒数, 最长秒数]', '如 [15, 45]；不确定就删掉 meta.durationRange');
      else if (!(d[0] > 0 && d[0] < d[1])) err('meta.durationRange', `[${d[0]}, ${d[1]}] 不对：最短要大于 0，且小于最长`, '如 [15, 45]');
    }
    if (typeof meta.product === 'string' && units(meta.product) > 10)
      err('meta.product', `产品名「${short(meta.product, 20)}」${fmtN(units(meta.product))} 字，片尾放不下（最多 10 字）`, '写产品的正式名称或正式简称；片尾 brand 必须和它一字不差');
    if (meta.cta !== undefined) {
      if (typeof meta.cta !== 'string' || !meta.cta.trim()) err('meta.cta', '应该是文字', '照抄简报「获取方式」那一栏；简报没写就删掉 meta.cta');
      else {
        if (units(meta.cta) > 12) err('meta.cta', `「${short(meta.cta, 20)}」${fmtN(units(meta.cta))} 字，最多 12 字`, '把简报里的获取方式换一种更短的说法，意思不能变（不能把官网下载写成应用商店）');
        texts.push({where: 'meta.cta', text: meta.cta});
      }
    }
    if (meta.tweak !== undefined) {
      const tw = meta.tweak;
      if (!tw || typeof tw !== 'object' || Array.isArray(tw)) err('meta.tweak', '应该是对象', '写成 {"pace":"fast","textScale":1.1,"headingFont":"kai"}；不需要的项删掉。不写 meta.tweak 就是现在的节奏和字号');
      else {
        for (const k of Object.keys(tw)) if (!['pace', 'textScale', 'headingFont'].includes(k)) err(`meta.tweak.${k}`, '多了一个不认识的字段', '只能有 pace、textScale、headingFont');
        if (tw.pace !== undefined && !['slow', 'normal', 'fast'].includes(tw.pace))
          err('meta.tweak.pace', `「${tw.pace}」不是可选值`, '只能是 slow（×1.15）、normal（不乘，和不写一样）、fast（×0.88）');
        if (tw.textScale !== undefined && (typeof tw.textScale !== 'number' || !Number.isFinite(tw.textScale) || tw.textScale < 0.9 - 1e-9 || tw.textScale > 1.15 + 1e-9))
          err('meta.tweak.textScale', `字号缩放 ${JSON.stringify(tw.textScale)} 不在 0.9–1.15`, '写 0.9 到 1.15；字大一点用 1.08，字小一点用 0.92。不写或写 1 等于不缩放');
        if (tw.headingFont !== undefined && !['sans', 'serif', 'kai'].includes(tw.headingFont))
          err('meta.tweak.headingFont', `「${tw.headingFont}」不是可选字体`, 'sans = 思源黑体（Noto Sans SC，和不写一样），serif = BrewReel Serif，kai = BrewReel Kai');
        const fontKeys = ['textScale', 'headingFont'].filter((k) => tw[k] !== undefined);
        if ((styleId === 'quiz' || styleId === 'journey') && fontKeys.length)
          warn('meta.tweak', `${fontKeys.join('、')}：这两项目前只对 cards 生效`, 'quiz 和 journey 的标题是风格自己画的，不跟着字号和字体变。节奏 pace、镜头 bg 仍然生效。不想看到这条提醒就删掉这两项，或改用 cards');
      }
    }
    for (const k of Object.keys(meta)) if (!known.includes(k)) err(`meta.${k}`, '多了一个不认识的字段', `删掉，或检查拼写。可用字段：${known.join('、')}`);
    if (isCards) {
      for (const k of ['title', 'product', 'theme']) if (typeof meta[k] !== 'string' || !meta[k].trim()) err(`meta.${k}`, '缺少必填字段（文字）', k === 'theme' ? `从这些里选：${Object.keys(THEMES).join(' / ')}` : '填上');
      if (typeof meta.theme === 'string' && meta.theme && !(meta.theme in THEMES)) err('meta.theme', `没有叫「${meta.theme}」的主题`, `从这些里选：${Object.keys(THEMES).join(' / ')}`);
    } else {
      // 其他风格：配色从风格自己的 themes 里选，可以不写（用 defaultTheme）
      for (const k of ['title', 'product']) if (typeof meta[k] !== 'string' || !meta[k].trim()) err(`meta.${k}`, '缺少必填字段（文字）', '填上');
      const opts = SM.themes ?? [];
      if (meta.theme !== undefined && (typeof meta.theme !== 'string' || !opts.includes(meta.theme)))
        err('meta.theme', `「${styleId}」风格没有叫「${meta.theme}」的配色`, opts.length ? `从这些里选：${opts.join(' / ')}；不写用 ${SM.defaultTheme}` : '这个风格没有可选配色，删掉 meta.theme');
    }
    if (meta.bpm !== undefined && (typeof meta.bpm !== 'number' || meta.bpm < BPM_RANGE[0] || meta.bpm > BPM_RANGE[1]))
      err('meta.bpm', `节拍 ${meta.bpm} 不在 ${BPM_RANGE[0]}–${BPM_RANGE[1]} 之间`, '不确定就删掉，默认 120');
    if (meta.brandColor !== undefined) {
      if (typeof meta.brandColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(meta.brandColor)) err('meta.brandColor', `颜色格式不对：${meta.brandColor}`, '写成 #RRGGBB，例如 #3B82F6；不确定就删掉');
      else {
        const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
        const [r, g, b] = rgb(meta.brandColor);
        for (const im of ['#07C160', '#95EC69', '#1AAD19', '#09BB07']) {
          const [r2, g2, b2] = rgb(im);
          if (Math.hypot(r - r2, g - g2, b - b2) < 70) {
            warn('meta.brandColor', `${meta.brandColor} 很像某聊天软件的标志绿，我方气泡会显得像它`, '换一个品牌色，或删掉 brandColor 用主题默认色');
            break;
          }
        }
        if (isCards) {
          const themeName = typeof meta.theme === 'string' && meta.theme in THEMES ? meta.theme : 'warm-emotion';
          const card = THEMES[themeName] && THEMES[themeName].card;
          if (typeof card === 'string' && /^#[0-9a-fA-F]{6}$/.test(card) && brandContrast(meta.brandColor, card) < 4.5 - 1e-6) {
            const dir = brandCardIsDark(card) ? '调亮' : '调暗';
            warn('meta.brandColor', `${meta.brandColor} 和「${themeName}」卡片对比度不到 4.5:1，已自动${dir}用于卡片上的文字`, '想保持原色就换一个和卡片拉开的品牌色，或换一套主题');
          }
        }
      }
    }
    if (meta.disclaimer !== undefined) {
      if (typeof meta.disclaimer !== 'string') err('meta.disclaimer', '应该是文字', '如「演示场景，对话为模拟」');
      else {
        if (units(meta.disclaimer) > 16) err('meta.disclaimer', `${fmtN(units(meta.disclaimer))} 字，最多 16 字`, '缩短');
        texts.push({where: 'meta.disclaimer', text: meta.disclaimer});
      }
    }
    if (typeof meta.product === 'string') texts.push({where: 'meta.product', text: meta.product});
    if (meta.logo !== undefined) checkValue({type: 'string', format: 'asset', accept: ['png', 'jpg', 'jpeg', 'webp']}, meta.logo, 'meta.logo');
    if (meta.allowWords !== undefined && (!Array.isArray(meta.allowWords) || meta.allowWords.some((x) => typeof x !== 'string')))
      err('meta.allowWords', '应该是文字数组', '如 ["第一"]；不需要豁免就删掉');
  }

  // 自由镜头 slots：字进 texts（广告法、字数、带单位的数字），纯数字单独记下来对来源
  const EFFECT_SLOT = new Set(['from', 'to', 'value', 'percent', 'delta']);
  const SLOT_SKIP = new Set(['refs', 'ref', 'icon', 'src', 'logo', 'note', 'color', 'id', 'illust', 'hex']);
  const walkCustomSlots = (v, p, depth, W) => {
    if (depth > 4) {
      err(W(p), 'slots 嵌套超过 4 层', '把结构展平到 4 层以内');
      return;
    }
    if (typeof v === 'string') {
      const w = W(p);
      const key = p.split(/[.[\]]/).filter(Boolean).pop();
      if (v.includes('\n') || v.includes('{') || v.includes('}')) checkRich(w, v, {maxLines: 2, lineMax: 12});
      else if (units(v) > 24) err(w, `${fmtN(units(v))} 字，slots 里每段最多 24 字`, '缩短，或拆成几个更短的字段');
      texts.push({where: w, text: v});
      if (/^\d+(?:\.\d+)?$/.test(v)) {
        const numV = Number(v);
        if (numV !== 0) customNums.push({where: w, value: numV, effect: EFFECT_SLOT.has(key)});
      }
      return;
    }
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) err(W(p), '不是有效数字', '写普通数字，别写 NaN 或无穷');
      else if (v !== 0) {
        const key = p.split(/[.[\]]/).filter(Boolean).pop();
        customNums.push({where: W(p), value: v, effect: EFFECT_SLOT.has(key)});
      }
      return;
    }
    if (typeof v === 'boolean') return;
    if (Array.isArray(v)) {
      v.forEach((x, i) => walkCustomSlots(x, `${p}[${i}]`, depth + 1, W));
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (SLOT_SKIP.has(k)) continue;
        walkCustomSlots(x, `${p}.${k}`, depth + 1, W);
      }
      return;
    }
    err(W(p), 'slots 里只能是文字、数字、布尔、数组或对象', '删掉空值这类不能上屏的东西');
  };

  // ---- shots ----
  const shots = sb.shots;
  if (!Array.isArray(shots) || shots.length === 0) {
    err('shots', '缺少镜头列表', '写 "shots": [{"type": "hook", ...}, ..., {"type": "endCard", ...}]');
    return {errors, warnings, slots: [], total: 0, beat: 60 / bpmOf(meta), assets, human: []};
  }
  const beat = 60 / bpmOf(meta);
  const slots = schedule(sb, specs);
  const voEst = {}; // 写了 vo 的镜头：按常见语速估算的配音后时长（秒）
  shots.forEach((shot, i) => {
    const type = shot?.type;
    const W = (f) => where(i, type, f);
    if (!shot || typeof shot !== 'object') return err(where(i, '?', ''), '不是对象', '每一镜写成 {"type": ..., "params": {...}}');
    const spec = specs[type];
    if (!spec) return err(W('type'), isCards ? `没有「${type}」这种镜头` : `「${styleId}」风格没有「${type}」这种镜头`, `从这些里选：${Object.keys(specs).join(' / ')}`);
    if (!isCards && commonTypes.has(type) && !style?.ownSpecs?.[type] && aspect !== '9:16')
      err(W('type'), `公共镜头 ${type} 只按 9:16 设计，${aspect} 画幅不能用`, `换成「${styleId}」风格的专属镜头，或把 meta.aspect 改成 9:16`);
    if (!isCards && SM.captionLayer === 'none' && shot.caption !== undefined && spec.caption !== 'none')
      err(W('caption'), `「${styleId}」风格不用全局字幕，caption 不能写`, '删掉 caption，要上屏的字写进这一镜的 params');
    // 把 params 里的字段写到了镜头顶层（便宜模型常见：{"type":"district","headline":…}）：合并成一条错，不按字段一条条报
    const SHOT_KEYS = ['type', 'dur', 'beats', 'caption', 'mood', 'params', 'note', 'vo', 'bg'];
    if (type === 'custom') SHOT_KEYS.push('component', 'slots');
    const paramKeys = Object.keys(spec.params?.properties ?? {});
    const misplaced = Object.keys(shot).filter((k) => !SHOT_KEYS.includes(k) && paramKeys.includes(k));
    for (const k of Object.keys(shot)) if (!SHOT_KEYS.includes(k) && !misplaced.includes(k))
      err(W(k), '多了一个不认识的字段', '每一镜只能有 type、dur 或 beats、caption、mood、params、note、vo、bg（时长字段叫 dur，单位秒；vo 是旁白；bg 是这一镜的背景图）');
    if (misplaced.length)
      err(W('params'), `${misplaced.join('、')} 写在了镜头顶层，这些是 params 里的字段`, `整镜写成 {"type": "${type}", "dur": ${spec.dur?.default ?? 3}, "params": {${misplaced.map((k) => `"${k}": …`).join(', ')}}}：${isCards ? '' : '风格镜头的字段一律写在 params 里；'}改完再校验一次，剩下的字段问题会逐条报出来`);
    // 时长
    if (shot.bg !== undefined) {
      const bg = shot.bg;
      if (typeof bg !== 'string' || !bg.trim()) err(W('bg'), '背景图应该是相对路径', '写项目目录里的 png / jpg / webp，例如 "photos/desk.jpg"；不需要就删掉 bg');
      else if (path.isAbsolute(bg) || bg.includes('..') || /^[A-Za-z]:/.test(bg) || bg.startsWith('/') || bg.startsWith('\\'))
        err(W('bg'), `背景图不能写绝对路径或 ..：${bg}`, '改成相对 storyboard.json 所在目录的路径');
      else {
        const ext = path.extname(bg).slice(1).toLowerCase();
        if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) err(W('bg'), `背景图格式 .${ext || '无'} 不支持`, '换成 png / jpg / webp');
        else {
          const abs = resolveAsset(bg);
          if (!abs) err(W('bg'), `素材文件找不到：${bg}`, `确认文件存在；相对路径以 storyboard.json 所在目录为准（${baseDir}）`);
          else {
            try {
              const sz = fs.statSync(abs).size;
              if (sz < 1024) err(W('bg'), `素材文件「${bg}」只有 ${sz} 字节，大概率是占位/空文件，不是真实图片`, '换成至少 1KB 的 png / jpg / webp；不需要背景就删掉 bg');
              else assets.push({where: W('bg'), rel: bg, abs});
            } catch {}
          }
        }
      }
    }
    if (shot.dur !== undefined && (typeof shot.dur !== 'number' || !(shot.dur > 0))) err(W('dur'), `时长 ${JSON.stringify(shot.dur)} 不对`, '写正数秒，例如 3 或 2.5');
    if (shot.beats !== undefined && (typeof shot.beats !== 'number' || !(shot.beats > 0))) err(W('beats'), `拍数 ${JSON.stringify(shot.beats)} 不对`, '写正整数，例如 6');
    if (shot.dur !== undefined && shot.beats !== undefined) warn(W('dur/beats'), '同时写了 dur 和 beats，以 beats 为准', '只留一个');
    const s = slots[i];
    const {min, max} = spec.dur;
    if (s.dur < min - 1e-6 || s.dur > max + 1e-6) err(W('dur'), `时长 ${fmtN(s.dur)} 秒不在该镜头允许的 ${min}–${max} 秒内`, `改到 ${min}–${max} 秒之间（默认 ${spec.dur.default} 秒）`);
    if (Math.abs(s.dur - s.raw) > 1e-6 && typeof s.raw === 'number' && s.raw > 0) warn(W('dur'), `${fmtN(s.raw)} 秒已吸附到整拍 → ${fmtN(s.dur)} 秒`, fmtBeat(beat) === fmtN(beat) ? `想精确就写成 ${fmtN(beat)} 秒的整数倍` : `想精确就改写 beats（拍数），一拍 ${fmtBeat(beat)} 秒`);
    // 情绪
    if (shot.mood !== undefined && (typeof shot.mood !== 'number' || shot.mood < 0 || shot.mood > 1)) err(W('mood'), `情绪 ${JSON.stringify(shot.mood)} 不在 0–1`, '0 = 平静/正向，0.5 = 留神，1 = 紧张/痛点');
    // 字幕
    if (shot.caption !== undefined) {
      const caps = Array.isArray(shot.caption) ? shot.caption : [shot.caption];
      if (spec.caption === 'none') err(W('caption'), '这一镜不能写字幕', type === 'endCard' ? '删掉 caption，片尾大字写在 params.slogan' : '删掉 caption');
      else if (!caps.length || caps.some((c) => typeof c !== 'string')) err(W('caption'), '字幕应该是文字，或 2–3 句文字的数组', '如「先别急着发，\\n对方要的是{你的在乎}」；长镜头写成 ["第一句", "第二句"]');
      else if (caps.length > CAPTION.maxSegs) err(W('caption'), `字幕数组有 ${caps.length} 句，最多 ${CAPTION.maxSegs} 句`, '合并成 3 句以内，或把这一镜拆成两镜');
      else if (i === 0 && caps.length > 1) err(W('caption'), 'hook 的字幕是封面标题，只能写一句', '写成一个字符串');
      else {
        caps.forEach((c, k) => {
          const w = caps.length > 1 ? W(`caption[${k}]`) : W('caption');
          checkRich(w, c, {maxLines: CAPTION.maxLines, lineMax: CAPTION.lineMax});
          texts.push({where: w, text: c, caption: true});
        });
      }
    } else if (spec.caption === 'required') err(W('caption'), '缺少字幕（这一镜必填）', type === 'hook' ? `hook 的 caption 就是封面大标题，写用户痛点，{} 里放最扎心的几个字${shot.vo !== undefined ? '（写了 vo 也要写：封面第 0 帧就要有标题，旁白字幕要等开口才出）' : ''}` : '补上 caption');
    // 旁白（配音）：格式 / 语速在 lib/tts/checks.mjs；文字本身和字幕一样进 texts，走广告法、极限词、数字来源、错别字等全部文本检查
    if (shot.vo !== undefined) {
      const est = checkVo({vo: shot.vo, W, spec, lang: meta?.lang === 'en' ? 'en' : 'zh', speed: typeof meta?.voice?.speed === 'number' ? meta.voice.speed : 1, beat, err, warn});
      if (est !== null) voEst[i] = est;
      if (typeof shot.vo === 'string' && shot.vo.trim()) texts.push({where: W('vo'), text: shot.vo, caption: true});
    }
    // 参数。自由镜头的字在 slots，params 不传给组件
    if (type === 'custom') {
      const comp = shot.component;
      if (typeof comp !== 'string' || !/^shots\/[A-Za-z0-9_-]+\.tsx$/.test(comp))
        err(W('component'), `组件路径 ${JSON.stringify(comp)} 不对`, '写成 "component": "shots/名字.tsx"。文件放在和 storyboard.json 同级的 shots/ 里，不要写 .. 或绝对路径');
      else if (!skipCustomFiles) {
        const abs = path.resolve(baseDir, comp);
        const root = path.resolve(baseDir);
        const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
        const inside = norm(abs) === norm(root) || norm(abs).startsWith(norm(root + path.sep));
        if (!inside || !fs.existsSync(abs) || !fs.statSync(abs).isFile())
          err(W('component'), `找不到组件文件 ${comp}`, '在分镜同一目录下建 shots/名字.tsx（和 storyboard.json 同级，不放进 template/）');
      }
      if (shot.slots === undefined || shot.slots === null || typeof shot.slots !== 'object' || Array.isArray(shot.slots))
        err(W('slots'), '缺少 slots（自由镜头的画面文字和数字只能写在这里）', '补上 "slots": {"keyword": "…"}，组件里不要写死句子');
      else walkCustomSlots(shot.slots, 'slots', 1, W);
      if (shot.params !== undefined && (typeof shot.params !== 'object' || shot.params === null || Array.isArray(shot.params) || Object.keys(shot.params).length > 0))
        err(W('params'), '自由镜头的字写在 slots，params 不会传给组件', '删掉 params，或写成 {}');
    } else if (shot.params === undefined) {
      if (!misplaced.length) err(W('params'), '缺少 params', '补上 "params": {...}，字段见 shots.md');
    } else if (!misplaced.length) {
      checkValue(spec.params, shot.params, W('params'));
      if (shot.params && typeof shot.params === 'object') crossCheck(type, shot.params, (f) => W(`params.${f}`), err, warn);
    }
    // 位置规则
    if (isCards) {
      if (i === 0 && type !== 'hook') err(W('type'), '第 1 镜必须是 hook（第 0 帧就要有钩子）', '在最前面加一个 hook 镜头，caption 写封面大标题');
      if (i > 0 && type === 'hook') err(W('type'), 'hook 只能是第 1 镜', '换成其他镜头类型');
      if (type === 'endCard' && i !== shots.length - 1) warn(W('type'), '片尾不在最后一镜', '把 endCard 挪到最后');
    } else {
      if (SM.firstShot && i === 0 && type !== SM.firstShot) err(W('type'), `「${styleId}」风格的第 1 镜必须是 ${SM.firstShot}（第 0 帧就要有钩子）`, `在最前面加一镜 ${SM.firstShot}`);
      if (SM.firstShot && i > 0 && type === SM.firstShot) err(W('type'), `${SM.firstShot} 只能是第 1 镜`, '换成其他镜头类型');
      if (SM.lastShot && type === SM.lastShot && i !== shots.length - 1) warn(W('type'), `${SM.lastShot} 应该放在最后一镜`, `把 ${SM.lastShot} 挪到最后`);
    }
  });
  if (isCards && !shots.some((s) => s?.type === 'endCard')) warn('shots', '没有片尾 endCard', '最后加一个 endCard（产品名 + 口号）');
  if (!isCards && SM.lastShot && !shots.some((s) => s?.type === SM.lastShot)) warn('shots', `没有片尾 ${SM.lastShot}`, `最后加一镜 ${SM.lastShot}（产品名 + 口号）`);

  // ---- 跨镜规则：产品名一致、CTA 照抄简报、核心动作要演示、字幕别停太久、情绪别硬跳、别照抄样例 ----
  const product = typeof meta?.product === 'string' ? meta.product.trim() : '';
  const metaCta = typeof meta?.cta === 'string' ? meta.cta.trim() : '';
  shots.forEach((shot, i) => {
    if (shot?.type !== 'endCard' || !shot.params || typeof shot.params !== 'object') return;
    const W = (f) => where(i, 'endCard', f);
    const brand = typeof shot.params.brand === 'string' ? shot.params.brand.trim() : '';
    if (product && brand && brand !== product)
      err(W('params.brand'), `片尾产品名「${brand}」和 meta.product「${product}」不一致`, `brand 写成「${product}」，一字不差；全片只用这一个产品名`);
    const cta = typeof shot.params.cta === 'string' ? shot.params.cta.trim() : '';
    if (cta && !metaCta)
      err(W('params.cta'), '写了 cta，但 meta.cta 是空的：获取方式不能自己编', '简报「获取方式」那栏有内容：原样写进 meta.cta，这里照抄；简报没写：删掉 cta');
    else if (cta && cta !== metaCta) err(W('params.cta'), `cta「${cta}」和 meta.cta「${metaCta}」不一致`, `cta 原样写成「${metaCta}」`);
    else if (!cta && metaCta) warn(W('params.cta'), '简报给了获取方式，片尾却没放', `补上 "cta": "${metaCta}"`);
  });
  // 疑似另起了一个产品名（如 meta.product=文章推送助手，画面上写成「推文助手」）
  const NAME_SUFFIX = ['助手', '管家', '神器', '工具', '平台', '系统', '大师', '精灵', '小帮手', 'App', 'APP'];
  const suffix = NAME_SUFFIX.find((x) => product.endsWith(x) && product.length > x.length);
  if (suffix) {
    {
      const re = new RegExp(`[一-龥A-Za-z]{1,6}${suffix}`, 'g');
      for (const {where: w, text} of texts) {
        if (w.startsWith('meta.') || /params\.brand$/.test(w)) continue;
        for (const m of String(text).replace(/[{}]/g, '').match(re) ?? [])
          if (!product.includes(m) && !m.includes(product)) warn(w, `「${m}」像另一个产品名，和 meta.product「${product}」不一样`, `统一写「${product}」，或换个说法避免像产品名`);
      }
    }
  }
  // 核心动作：至少一镜演示「用户做什么 → 产品给出什么」
  // 非软件行业（food/ecommerce/education/beauty/travel）的核心动作大多靠实拍/过程类镜头演出来，不天然带 chat/phone/mockApp，
  // 和 scripts/lib/text-checks.mjs 的 DEMO_TYPES（含 photoShot）保持一致，避免两处判断打架（2026-09 round4 修复）
  const isDemo = (s) => {
    const p = s?.params ?? {};
    if (s?.type === 'chat') return !!(p.panel && (p.panel.verdict || (Array.isArray(p.panel.replies) && p.panel.replies.length)));
    if (s?.type === 'phone') return !!p.src;
    if (s?.type === 'mockApp') {
      const hasResult = (Array.isArray(p.items) && p.items.length > 0) || !!p.done || !!p.stat;
      if (p.kind === 'form') return hasResult && !!(p.button || p.done);
      return !!p.input && hasResult;
    }
    if (s?.type === 'photoShot') return Array.isArray(p.media) && p.media.length > 0;
    // beforeAfter：美业/服务类的「做之前 → 做完」本身就是在演示服务结果
    if (s?.type === 'beforeAfter') return !!(p.before && p.after);
    return false;
  };
  const demoOwn = new Set(SM.demoShots ?? []);
  if ((isCards || SM.requireDemo) && !shots.some((s) => isDemo(s) || demoOwn.has(s?.type)))
    err('shots', '全片没有一镜在演示产品的核心动作（用户做什么 → 产品给出什么），只有口号和卖点卡',
      '加一镜：chat 写 messages + panel（提问 → 回答）；或 mockApp 写 input（用户输入/提问）+ 结果（dashboard 的 stat、editor 的 items、done）；有截图就用 phone；非软件行业（餐饮/电商/文旅/美业等）可以用 photoShot（填 media，实拍或插画兜底皆可）演示产品本身');
  // 字幕停留时长：同一句字幕连续显示不超过 maxHold 秒
  const segs = [];
  slots.forEach((s, i) => {
    const c = shots[i]?.caption;
    const caps = Array.isArray(c) ? c.filter((x) => typeof x === 'string') : typeof c === 'string' ? [c] : [];
    if (!caps.length) return segs.push({i, text: null, dur: s.dur});
    captionSegments(s.start, s.dur, caps.length, beat).forEach(([a, b], k) => segs.push({i, k, n: caps.length, text: caps[k], dur: b - a}));
  });
  for (let k = 0; k < segs.length; ) {
    let j = k;
    let d = segs[k].dur;
    while (segs[k].text && j + 1 < segs.length && segs[j + 1].text === segs[k].text) d += segs[++j].dur;
    if (segs[k].text && d > CAPTION.maxHold + 1e-6) {
      const s0 = segs[k];
      const t0 = shots[s0.i]?.type;
      err(where(s0.i, t0, s0.n > 1 ? `caption[${s0.k}]` : 'caption'), `「${short(s0.text.replace(/[{}]/g, ''), 14)}」这一句要在屏幕上停 ${fmtN(d)} 秒，超过 ${CAPTION.maxHold} 秒观众会划走`,
        s0.n > 1 ? '字幕数组再加一句（最多 3 句），或缩短这一镜' : `把 caption 写成 2–3 句的数组，跟着画面换字幕，如 ["先别急着发，\\n对方要的是{你的在乎}", "挑一条填进去，\\n发不发{你决定}"]；或把这一镜拆成两镜`);
    }
    k = j + 1;
  }
  // 情绪硬跳：相邻两镜 mood 差太大，背景会从暖红直接切到冷色
  for (let i = 1; i < slots.length; i++) {
    const a = typeof shots[i - 1]?.mood === 'number' ? shots[i - 1].mood : specs[shots[i - 1]?.type]?.mood ?? 0.5;
    const b = typeof shots[i]?.mood === 'number' ? shots[i].mood : specs[shots[i]?.type]?.mood ?? 0.5;
    if (Math.abs(a - b) > 0.5 + 1e-6) warn(where(i, shots[i]?.type, 'mood'), `和上一镜的情绪从 ${a} 跳到 ${b}，跨度太大`, '中间插一镜过渡（mood 0.4–0.6，如 compare 或 mockApp 产品出场），或把两边往中间靠');
  }
  // 套路句式 / 照抄样例
  // 「和样例太像」只针对模型自己写的文案：插画 id、简报原话（facts/notices/cta/product）、时间/价格/周几这类格式串不算照抄
  const briefPool = [
    ...(Array.isArray(meta?.facts) ? meta.facts.map((f) => f?.text) : []),
    ...(Array.isArray(meta?.notices) ? meta.notices : []),
    meta?.cta, meta?.product,
  ].filter((x) => typeof x === 'string' && x.trim()).map((x) => plainOf(x).replace(/\s/g, ''));
  // 有 --brief 时，简报原文里逐字出现的菜名/地址/评价也不算照抄样例（只认整段包含，不按二元组覆盖率算，简报太长会什么都放过）
  const briefFlat = typeof brief === 'string' ? brief.replace(/\s/g, '') : '';
  const coveredBy = (p, b) => {
    const a = bigrams(p);
    if (!a.size) return false;
    const bb = bigrams(b);
    let n = 0;
    for (const g of a) if (bb.has(g)) n++;
    return n / a.size >= 0.6;
  };
  const notOwnCopy = (s) => {
    const p = plainOf(s).replace(/\s/g, '');
    if (/^[a-z_]+\/[a-z_-]+$/.test(p)) return true;
    const rest = p.replace(/\d+([:：.]\d+)?/g, '').replace(/周[一二三四五六日天]|[至到~～\-–—/·元¥￥晚起]/g, '');
    if (Array.from(rest).filter((c) => /[一-龥A-Za-z]/.test(c)).length < 3) return true;
    if (briefFlat && (briefFlat.includes(p) || briefFlat.includes(p.replace(/[×x]\d+$/i, '')))) return true;
    return briefPool.some((b) => b.includes(p) || coveredBy(p, b));
  };
  const selfTitle = meta?.title;
  for (const {where: w, text, caption} of texts) {
    if (!caption && !/slogan/.test(w)) continue;
    const plain = String(text).replace(/[{}\n]/g, '');
    const cl = CLICHE_START.find((c) => plain.startsWith(c)) ?? (CLICHE_RE.some((re) => re.test(plain)) ? plain.slice(0, 6) : null);
    if (cl) {
      const fillin = FILLIN_BY_TYPE[typeOfWhere(w)] ?? FILLIN_DEFAULT;
      warn(w, `字幕含「${cl}」，是样例里的套路句式`, `别用「三个能力，…」「这些时刻，你是不是也…」「这三步」这种万能句；可以按这个句型改写：「${fillin}」`);
    }
    const ex = !notOwnCopy(text) && exampleLines().find((e) => e.title !== selfTitle && e.kind === 'caption' && similar(text, e.text) >= 0.5);
    if (ex) warn(w, `和样例 ${ex.file} 的「${short(ex.text.replace(/[{}\n]/g, ''), 14)}」太像`, '按这个产品自己的场景重写，别照抄样例');
  }

  // ---- 文案逻辑：数字口径、引用词、数量词、重字残词、推荐回复立场、照抄样例、结构 ----
  // facts 是 {id,text}[]（见 schema.ts Fact）；这里只取 text 参与数字/来源核对，id 留给以后的 refs 校验用
  const facts = Array.isArray(meta?.facts) ? meta.facts.filter((x) => x && typeof x === 'object' && typeof x.text === 'string').map((x) => x.text) : [];
  const factText = facts.join(' ');
  // 2026-09 p2r2：facts 分两堆。real = 简报给的依据；demo = 模型自己标了「示例/演示/模拟/sample」的。
  // demo 只能给「演示界面里的内容」用（且要 meta.demoData: true + 画面提示），不能给效果说法背书
  const {real: realFacts, demo: demoFacts} = splitFacts(meta);
  const numsOf = (arr) => new Set(arr.flatMap((f) => (f.text.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? []).map(Number)));
  const realNums = numsOf(realFacts);
  const demoNums = numsOf(demoFacts);
  const factNums = new Set([...realNums, ...demoNums]);
  const realIds = new Set(realFacts.map((f) => f.id));
  const demoOn = meta?.demoData === true;
  const DEMO_UI_TYPES = ['mockApp', 'phone', 'chat', 'priceCard', 'factSheet', 'storeCard', 'photoShot', 'dataChart'];
  const EFFECT_TYPES = ['compare', 'counter', 'meter'];
  const EFFECT_WORDS = /省|节省|缩短|提升|提高|降低|减少|只要|只需|仅需|就能|就够|变成|→|比上|比以前|比手动|相比|更快|加快|耗时|花了|要花|得花|多存|多赚|增长|翻倍|\bsaves?\b|faster|quicker|boost|down to/i;
  /** 这个数字是不是「效果说法」：compare/counter/meter 里的数、秒级说法、字幕和卖点里的百分比/倍数、带「省/缩短/提升…」的时长和金额。
   *  价格、有效期、营业时间、人数这类「条款」不算效果（示例数据可以在 demoData 下出现） */
  const isEffect = (w, kind, text, fast = false) => {
    if (w.startsWith('meta.')) return false;
    const type = typeOfWhere(w);
    if (EFFECT_TYPES.includes(type) || fast) return true;
    if (kind === '百分比' || kind === '倍数') return !DEMO_UI_TYPES.includes(type) || /(caption(\[\d+\])?|vo)$/.test(w);
    if (kind === '时长' && type === 'hook') return true;
    return EFFECT_WORDS.test(plainOf(text));
  };
  const EFFECT_FIX = '效果说法（耗时、速度、百分比、倍数、compare 的 stat/level、counter、meter 打分）只能用简报给的真数据。简报没给就删掉数字，写具体差别，如「少 3 步」「不用切窗口」「不用手动传图」；compare 可以只比过程：「找同事→等排期→拼表格」对「问一句→看图」';
  const DEMO_DECLARE_FIX = 'meta 里写 "demoData": true，并在 meta.disclaimer 写「演示画面，数据为示例」；这类数字只能出现在 mockApp/phone/chat/priceCard 等演示界面里，不能写进字幕、compare、counter、meter 当效果';
  /** 屏幕上一个数字的来源核对。返回 true = 有来源（或已报错） */
  const sourceCheck = (w, v, what, noneFix, effect) => {
    if (realNums.has(v)) return;
    if (demoNums.has(v)) {
      if (effect) err(w, `「${what}」只在你自己标了「示例/演示」的 fact 里有：这是你自己编的示例，不能当效果依据（${NO_BASIS}）`, EFFECT_FIX);
      else if (!demoOn) err(w, `「${what}」来自标了「示例/演示」的 fact，但没声明这是演示数据`, DEMO_DECLARE_FIX);
      return;
    }
    err(w, `「${what}」在 meta.facts 里找不到来源${facts.length ? '' : '（没写 meta.facts）'}`, noneFix);
  };
  for (const n of customNums)
    sourceCheck(n.where, n.value, `数字 ${n.value}`, facts.length ? '简报给了这个数字就把原话抄进 meta.facts（带 source），id 随便起' : '简报没给数字就别编：删掉这个数，或把原话和来源抄进 meta.facts', n.effect);
  const shotTexts = shots.map((sh) => {
    if (!sh || typeof sh !== 'object') return [];
    const out = [];
    for (const c of [sh.caption].flat()) if (typeof c === 'string') out.push({text: c, caption: true, field: 'caption'});
    for (const x of collectStrings(sh.params ?? {}, [])) out.push({text: x, caption: false, field: 'params'});
    if (sh.slots && typeof sh.slots === 'object') for (const x of collectStrings(sh.slots, [])) out.push({text: x, caption: false, field: 'slots'});
    // 旁白参与全片数字口径核对；不按字幕做「」引用检查（念出来的引号观众看不到）
    if (typeof sh.vo === 'string') out.push({text: sh.vo, caption: false, field: 'vo'});
    return out;
  });
  // (1) 全片数字口径：counter 的时间单位 vs 其他镜头的「N 秒 / 秒出」；counter.from vs hook 的痛点时长
  shots.forEach((sh, i) => {
    if (sh?.type !== 'counter' || !sh.params || typeof sh.params !== 'object') return;
    const P = sh.params;
    const W = (f) => where(i, 'counter', f);
    const k = TIME_UNIT(String(P.suffix ?? '').trim());
    if (k && num(P.to)) {
      const toSec = P.to * k;
      const clash = [];
      shotTexts.forEach((list, j) => {
        for (const x of list) for (const d of durations(x.text)) if (d.fast && Math.max(d.sec, toSec) / Math.max(0.1, Math.min(d.sec, toSec)) >= 10) clash.push(`第 ${j + 1} 镜「${d.raw}」`);
      });
      if (clash.length)
        err(W('params.to'), `counter 说新耗时是 ${fmtN(P.to)} ${P.suffix}，但 ${[...new Set(clash)].join('、')} 说的是秒级，差了 10 倍以上`,
          `全片说的是同一件事的耗时，只能有一个数；改成都用「${fmtN(P.to)} ${P.suffix}」（把「秒出」「N秒」换掉），或者 counter 改成秒（to 写秒数、suffix 写「秒」）`);
      if (num(P.from)) {
        const fromSec = P.from * k;
        for (const x of shotTexts[0] ?? []) for (const d of durations(x.text)) if (!d.fast && Math.max(d.sec, fromSec) / Math.min(d.sec, fromSec) >= 4)
          warn(W('params.from'), `counter 的旧耗时 ${fmtN(P.from)} ${P.suffix}和开头钩子说的「${d.raw}」（${fmtSec(d.sec)}）对不上`, `钩子和 counter 讲的是同一个痛点，时长用同一个数；以简报（meta.facts）为准`);
      }
    }
    // (2) 数字和来源要出自简报（没有来源的具体数字一律报错，不只是提醒）
    for (const key of ['from', 'to']) if (num(P[key]) && P[key] !== 0 && !realNums.has(P[key]) && !(key === 'from' && !P.showFrom && P.from === 0))
      sourceCheck(W(`params.${key}`), P[key], `数字 ${P[key]}`, facts.length ? '简报给了这个数字就把原话抄进 meta.facts（带 source），id 随便起' : '简报没给数字就别编：counter 讲的是效果，换成 compare（items 写具体差别）或 steps，删掉这个具体数字', true);
    if (typeof P.sub === 'string') {
      const miss = SOURCE_WORDS.filter((w) => P.sub.includes(w) && !factText.includes(w));
      if (miss.length) err(W('params.sub'), `sub 写了「${miss.join('」「')}」，但 meta.facts 里没有这个来源：来源不能自己编`, '简报给了来源就把原话抄进 meta.facts；简报没给，sub 改成「示例数据，以实际为准」');
    }
    const cp = exampleLines() && EXAMPLE_COUNTERS.find((e) => e.title !== meta?.title && num(e.from) && num(e.to) && e.from === P.from && e.to === P.to && (e.suffix ?? '') === (P.suffix ?? ''));
    if (cp) warn(W('params'), `from/to/suffix 和样例 ${cp.file} 一模一样（${cp.from}→${cp.to}${cp.suffix}），像是照抄样例`, '数字只能来自简报（meta.facts）；简报没给数字就换一种镜头');
  });
  // 全片所有镜头、所有字段（不只 counter/caption）里「有单位的具体数字」都要能在 meta.facts 里找到来源：
  // 时长（秒/分钟/小时/天）、百分比、倍数、人数、金额。没有来源一律报错；0 是常见的「之前」占位值（如 ¥0.00），不算需要来源的数字
  {
    const PERF_NUM_RES = [
      {kind: '百分比', re: /(\d+(?:\.\d+)?)\s*[%％]/g},
      {kind: '倍数', re: /(\d+(?:\.\d+)?)\s*倍/g},
      {kind: '人数', re: /(\d+(?:\.\d+)?)\s*(?:人|位|名|用户)/g},
      {kind: '金额', re: /[¥￥]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*元/g},
    ];
    const noFactsFix = (kind) => (facts.length ? '简报给了这个数字就把原话抄进 meta.facts' : `简报没给数字就别写具体${kind}，改成定性说法（如把「3 秒」改成「更快」）`);
    for (const {where: w, text} of texts) {
      const t = plainOf(text);
      for (const d of durations(t)) {
        const m = /(\d+(?:\.\d+)?)/.exec(d.raw);
        if (!m) continue; // 中文数词（半天/三小时）不核对来源，避免误伤定性说法；秒级说法在下面「速度说法」单独核对
        const v = Number(m[1]);
        if (v !== 0) sourceCheck(w, v, d.raw, noFactsFix('时长'), isEffect(w, '时长', t, d.fast));
      }
      for (const {kind, re} of PERF_NUM_RES) {
        for (const m of t.matchAll(re)) {
          const v = Number(m[1] ?? m[2]);
          if (!Number.isFinite(v) || v === 0) continue;
          sourceCheck(w, v, m[0], noFactsFix(kind), isEffect(w, kind, t));
        }
      }
    }
  }
  // 速度说法（几秒钟 / 即刻 / 秒算 / 秒进 / 瞬间 / instantly / in seconds…）：按模式抓，要有简报给的「秒级耗时」依据
  {
    const realFast = realFacts.some((f) => durations(f.text).some((d) => d.fast));
    const demoFast = demoFacts.some((f) => durations(f.text).some((d) => d.fast));
    if (!realFast)
      for (const {where: w, text} of texts) {
        if (w.startsWith('meta.') || /params\.cta$/.test(w)) continue; // 获取方式照抄简报；免责/提示条不是效果说法
        const hits = [...new Set(speedClaims(text))];
        if (!hits.length) continue;
        err(w, meta?.lang === 'en'
            ? `"${hits.join('", "')}" is a speed claim, but meta.facts has no timing from the brief${demoFast ? ' (only facts you labelled sample/demo, which you made up)' : ''} (${NO_BASIS})`
            : `「${hits.join('」「')}」是速度说法，但${demoFast ? '只有你自己标了「示例/演示」的 fact 说到耗时：这是你自己编的示例，不能当依据' : 'meta.facts 里没有简报给的秒级耗时'}（${NO_BASIS}）`,
          meta?.lang === 'en'
            ? 'Drop the speed word and say the concrete difference instead, e.g. "3 fewer steps", "no app switching", "no manual upload"; only if the brief gives a timing, copy it into meta.facts (with source)'
            : '删掉速度词，写具体差别，如「少 3 步」「不用切窗口」「不用手动传图」「问一句就出图」；简报真给了耗时（如「3 秒出结果」）才能说快，原话抄进 meta.facts（带 source）');
      }
  }
  // compare 的 level、meter 的数值：画面上会印成「8/10」这类分数，像是量出来的，必须有简报依据
  shots.forEach((sh, i) => {
    const P = sh?.params;
    if (!P || typeof P !== 'object') return;
    const W = (f) => where(i, sh.type, f);
    const refsReal = Array.isArray(P.refs) && P.refs.some((r) => realIds.has(r));
    const backed = (vals) => refsReal || vals.every((v) => realNums.has(v));
    const inDemo = (vals) => vals.every((v) => demoNums.has(v));
    if (sh.type === 'compare') {
      const lv = [P.left?.level, P.right?.level].filter(num);
      if (lv.length && !backed(lv))
        err(W(`params.${num(P.left?.level) ? 'left' : 'right'}.level`),
          `level（${lv.join(' 对 ')}）会在画面上印成「${lv.map((v) => `${v}/10`).join('」「')}」，像是量出来的分数，但${inDemo(lv) ? '它只在你自己标了「示例/演示」的 fact 里：这是你自己编的示例，不能当依据' : 'meta.facts 里没有这个分数'}（${NO_BASIS}）`,
          '删掉两栏的 level 和 meterLabel，把差别写进 items：「少 3 步」「不用切窗口」「不用手动传图」；简报真给了评分，原话抄进 meta.facts（带 source）才能写 level');
    }
    if (sh.type === 'meter' && num(P.value)) {
      // 「变好了」（higherIs=good 往上 / higherIs=bad 往下）是效果说法；风险从 2 升到 7 这类是产品在演示里的读数，按单个读数处理
      const change = num(P.from) && P.from !== P.value && (P.value - P.from) * (P.higherIs === 'good' ? 1 : -1) > 0;
      const vals = change ? [P.value, P.from] : [P.value];
      if (!backed(vals) && (change || !demoOn))
        err(W(change ? 'params.from' : 'params.value'),
          change
            ? `指针从 ${P.from} 摆到 ${P.value}，这是在说效果变好/变差，但${inDemo(vals) ? '这两个数只在你自己标了「示例/演示」的 fact 里' : 'meta.facts 里没有这组数'}（${NO_BASIS}）`
            : `读数 ${P.value} 没有依据（${NO_BASIS}）`,
          change
            ? '删掉 from（不演「从 3 到 7」）；想说前后变化，用 compare 的 items 写具体差别（「不用切窗口」「少 3 步」），或 meter 的 word 写定性判词；简报真给了前后数值才能写 from'
            : '这个读数如果是产品在演示里给出的判断（如 AI 给这句话打的危险程度），写 meta.demoData: true 并在 meta.disclaimer 标「演示」；如果是在说效果/评分，简报没给就删掉这一镜，换成 compare（items 写具体差别）');
    }
    if (sh.type === 'dataChart') {
      const refs = Array.isArray(P.refs) ? P.refs : [];
      const citedReal = realFacts.filter((f) => refs.includes(f.id));
      const citedDemo = demoFacts.filter((f) => refs.includes(f.id));
      const demoChart = !citedReal.length && citedDemo.length > 0 && demoOn && DEMO_HINT_RE.test(String(meta?.disclaimer ?? ''));
      if (!citedReal.length && !demoChart) err(W('params.refs'), 'dataChart 必须引用至少一条 meta.facts 中有来源的真实数据；示例数据需同时声明 demoData 和演示/示例提示', '将简报原文与来源写入 meta.facts 并引用其 id；如为样例画面，标注 meta.demoData 与 meta.disclaimer');
      const citedNums = numsOf(citedReal.length ? citedReal : citedDemo);
      const visible = [P.title, P.takeaway, ...(Array.isArray(P.kpis) ? P.kpis.flatMap((k) => [k?.label, k?.value]) : []), ...(Array.isArray(P.annotations) ? P.annotations : []), ...(Array.isArray(P.data) ? P.data.flatMap((d) => [d?.label, d?.value]) : [])].filter((x) => typeof x === 'string' || num(x)).join(' ');
      const visibleNums = numsOf([{text: visible}]);
      for (const v of visibleNums) if (!citedNums.has(v)) err(W('params.refs'), `画面数值 ${v} 不在 refs 指向的 fact 中；来源必须与图表、KPI、结论和旁注一一对应`, '只引用包含画面数值的事实，并把原文及来源写入 meta.facts；不要将未注明的数据写成 KPI 或结论');
    }
  });
  // 同一个 compare 栏内部（stat vs items）耗时/数字别打架：同一栏说的是同一件事，只能有一个数量级
  shots.forEach((sh, i) => {
    if (sh?.type !== 'compare' || !sh.params || typeof sh.params !== 'object') return;
    const P = sh.params;
    for (const side of ['left', 'right']) {
      const S = P[side];
      if (!S || typeof S !== 'object') continue;
      const statDur = typeof S.stat === 'string' ? durations(S.stat) : [];
      const itemsText = Array.isArray(S.items) ? S.items.filter((x) => typeof x === 'string').join('；') : '';
      const itemDur = durations(itemsText);
      if (!statDur.length || !itemDur.length) continue;
      for (const a of statDur) for (const b of itemDur) {
        const ratio = Math.max(a.sec, b.sec) / Math.max(0.1, Math.min(a.sec, b.sec));
        if (ratio < 2 - 1e-6) continue;
        err(where(i, 'compare', `params.${side}`), `${side === 'left' ? '左' : '右'}栏内部耗时前后矛盾：stat 写「${a.raw}」，items 里却写「${b.raw}」`,
          '同一栏说的是同一件事的耗时，改成同一个数（以 meta.facts 为准，没有来源就都改成定性说法）');
        break;
      }
    }
  });
  // 全片「秒级」说法 vs 「分钟/小时/天」说法：同一件事只能有一个数量级。
  // hook 和 compare.left 允许描述「以前」的慢（这是产品故事的正常对比，不算矛盾），其余地方的慢说法如果和某处的秒级说法差 10 倍以上才报错
  {
    const isPainSpot = (w) => typeOfWhere(w) === 'hook' || /params\.left(\.|\[|$)/.test(w);
    const fastList = [];
    const slowList = [];
    for (const {where: w, text} of texts) for (const d of durations(text)) (d.fast ? fastList : slowList).push({where: w, ...d});
    const slowOutside = slowList.filter((d) => !isPainSpot(d.where));
    const reported = new Set();
    for (const f of fastList) for (const s of slowOutside) {
      if (f.where === s.where) continue;
      const ratio = Math.max(f.sec, s.sec) / Math.max(0.1, Math.min(f.sec, s.sec));
      if (ratio < 10 - 1e-6) continue;
      const key = [f.where, f.raw, s.where, s.raw].join('|');
      if (reported.has(key)) continue;
      reported.add(key);
      err(f.where, `全片对同一件事的耗时说法不一致：这里写「${f.raw}」，${s.where} 却写「${s.raw}」，差了 ${fmtN(ratio)} 倍以上`,
        '全片同一件事的耗时只能有一个数（以 meta.facts 为准）：把其中一处改成和另一处一致的说法');
    }
  }
  // (3) 字幕里「」引用的词，必须在本镜或前面镜头的画面上出现过
  const seen = [];
  shots.forEach((sh, i) => {
    const own = shotTexts[i];
    const pool = [...seen, ...own.filter((x) => !x.caption).map((x) => plainOf(x.text))];
    for (const x of own) {
      if (!x.caption) continue;
      for (const m of plainOf(x.text).matchAll(/[「“『"]([^」”』"]{1,14})[」”』"]/g)) {
        const q = m[1].trim();
        if (!q) continue;
        const ok = pool.some((p) => (Array.from(q).length <= 2 ? p.includes(q) : subseq(q, p)));
        if (!ok) err(where(i, sh.type, 'caption'), `字幕引用了「${q}」，但画面上还没出现过`, `先让「${q}」在前面的对话/列表里出现（如 chat.messages 或 hook.text），或者换掉这个引用`);
      }
    }
    seen.push(...own.map((x) => plainOf(x.text)));
  });
  // (4) 字幕里的数量词要和本镜条目数一致
  const QTY = /(\d+|[两二三四五六七八九十]{1,2})\s*(句|条|个|种|件|步|点|招|类|项|大)(?![人月年天小时字倍钟分秒岁])/g;
  shots.forEach((sh, i) => {
    const P = sh?.params ?? {};
    let arr = null;
    let what = '';
    if (['quickList', 'features', 'steps'].includes(sh?.type) || (sh?.type === 'mockApp' && P.kind === 'list')) [arr, what] = [P.items, '条目'];
    else if (sh?.type === 'endCard') [arr, what] = [P.points, 'points'];
    else if (sh?.type === 'chat') [arr, what] = [P.panel?.replies, '候选回复'];
    if (!Array.isArray(arr)) return;
    const caps = [...(sh.type === 'endCard' ? [P.slogan] : [sh.caption].flat()), sh.vo];
    for (const c of caps) {
      if (typeof c !== 'string') continue;
      const t = plainOf(c);
      if (sh.type === 'chat' && !/回复|建议|候选|说法/.test(t)) continue;
      for (const m of t.matchAll(QTY)) {
        const n = cnNum(m[1]);
        if (!Number.isFinite(n) || n < 2 || n === arr.length) continue;
        const isVo = c === sh.vo;
        err(where(i, sh.type, isVo ? 'vo' : sh.type === 'endCard' ? 'params.slogan' : 'caption'), `${isVo ? '旁白' : '字幕'}说「${m[0]}」，这一镜的${what}只有 ${arr.length} 条，数量对不上`, `把数字改成 ${arr.length}，或者别写数量`);
      }
    }
  });
  // (5) 重字、残词
  for (const {where: w, text} of texts) {
    const a = Array.from(plainOf(text));
    let hit = '';
    for (let i = 0; i < a.length && !hit; i++)
      for (let L = 2; L <= 6 && i + 2 * L <= a.length; L++) {
        const f = a.slice(i, i + L).join('');
        if (f !== a.slice(i + L, i + 2 * L).join('')) continue;
        if (new Set(f).size === 1 || /^一/.test(f) || !/[一-龥]/.test(f)) continue; // 哈哈哈哈、一步一步、数字符号
        hit = f;
        break;
      }
    if (hit) err(w, `「${hit}${hit}」重复了`, '删掉重复的字，整句再读一遍；不要靠叠字凑字数');
    for (const b of BROKEN_WORDS) if (b.re.test(plainOf(text))) warn(w, `「${b.w}」像是删字凑字数留下的残词`, '整句重写，不要删字（「卡脖子」不能缩成「卡脖」，「推送进草稿」不能缩成「推进草稿」）');
  }
  // (6) chat：推荐回复站在「我」的立场；typing 和 panel 衔接
  shots.forEach((sh, i) => {
    if (sh?.type !== 'chat' || !sh.params || typeof sh.params !== 'object') return;
    const P = sh.params;
    const W = (f) => where(i, 'chat', f);
    const replies = Array.isArray(P.panel?.replies) ? P.panel.replies.filter((x) => typeof x === 'string') : [];
    if (typeof P.typing === 'string' && P.panel && P.typing !== replies[0])
      err(W('params.typing'), 'typing 和 panel 同时写了：输入框先打出 typing，面板随后把第 1 条回复填进去，两句对不上，看着像打字打一半', replies.length ? `二选一：删掉 typing；或把 typing 写成和 replies[0]「${replies[0]}」一字不差` : '删掉 typing');
    const peer = (Array.isArray(P.messages) ? P.messages : []).filter((m) => m?.from === 'peer' && typeof m.text === 'string');
    replies.forEach((r, k) => {
      const m = peer.find((x) => similar(r, x.text) >= 0.4);
      if (m) warn(W(`params.panel.replies[${k}]`), `推荐回复「${r}」和对方说的「${m.text}」很像`, '推荐回复是产品建议「我」发给对方的话，站在我的立场写，不能复述对方的诉求');
    });
  });
  // (7) 照抄样例的参数文字（字幕/口号的检查在上面「套路句式」里）
  const selfT = meta?.title;
  shots.forEach((sh, i) => {
    for (const x of shotTexts[i]) {
      if (x.caption || units(x.text) < 5 || /示例数据|演示/.test(x.text) || [meta?.product, meta?.cta, meta?.disclaimer].includes(x.text) || notOwnCopy(x.text)) continue;
      const ex = exampleLines().find((e) => e.title !== selfT && e.kind === 'param' && similar(x.text, e.text) >= 0.6);
      if (ex) warn(where(i, sh.type, 'params'), `「${short(plainOf(x.text), 14)}」和样例 ${ex.file} 的「${short(plainOf(ex.text), 14)}」太像`, '按这个产品自己的场景重写，别照抄样例');
    }
  });
  // (8) 结构：别和样例/常见模板一模一样（含近似匹配）；中段要有 compare/steps/phone/meter 之一；quickList 和 counter 别同时用；单镜别占比过大
  // 这些是 cards 风格的结构经验；其他风格的结构规则写在 styles/<id>/rules.json
  if (isCards) {
    const seq = shots.map((x) => x?.type).join('→');
    const types = shots.map((x) => x?.type);
    const durs = slots.map((s) => s.dur);
    exampleLines();
    const same = EXAMPLE_SEQS.find((e) => e.title !== selfT && e.seq === seq);
    const TEMPLATES = ['hook→quickList→mockApp→counter→endCard', 'hook→quickList→mockApp→features→counter→endCard', 'hook→quickList→mockApp→counter→features→endCard'];
    if (same) warn('shots', `镜头顺序和样例 ${same.file} 完全一样（${seq}）`, '换掉其中一镜，按这个产品自己的故事排');
    else {
      const editDist1 = (a, b) => {
        if (Math.abs(a.length - b.length) > 1) return false;
        const dp = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0));
        for (let i = 0; i <= a.length; i++) dp[i][0] = i;
        for (let j = 0; j <= b.length; j++) dp[0][j] = j;
        for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
          dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        return dp[a.length][b.length] <= 1;
      };
      const durMatch80 = (tA, dA, tB, dB) => {
        if (!tA.length || tA.length !== tB.length) return false;
        let hit = 0;
        for (let i = 0; i < tA.length; i++) if (tA[i] === tB[i] && Math.abs((dA[i] ?? -1) - (dB[i] ?? -2)) < 0.05) hit++;
        return hit / tA.length >= 0.8;
      };
      const near = EXAMPLE_SEQS.find((e) => e.title !== selfT && (editDist1(types, e.types ?? []) || durMatch80(types, durs, e.types ?? [], e.durs ?? [])));
      if (near) warn('shots', `镜头顺序和样例 ${near.file}（${near.seq}）几乎一样：只差一两处，或时长也对得上`, '换掉或加入一种镜头，别照这支样例的时长排');
      else if (TEMPLATES.includes(seq)) warn('shots', `镜头顺序是最常见的模板（${seq}），和别的片子放在一起会像换皮`, `中段换成 ${MID_SHOTS.join(' / ')} 之一`);
    }
    if (shots.length >= 4 && !types.some((t) => MID_SHOTS.includes(t))) warn('shots', `中段没有 ${MID_SHOTS.join(' / ')} 里的任何一镜`, '至少放一镜：对比（compare）、流程（steps）、真截图（phone）、仪表（meter）或数据叙事图（dataChart）');
    if (types.includes('quickList') && types.includes('counter')) warn('shots', 'quickList 和 counter 同时出现，结构太像模板', '二选一：痛点用 compare 或 meter 讲，或者把 counter 换成 steps');
    // 单镜时长占比：chat 超过 8 秒，或任意一镜占全片超过 40%，都会让片子头重脚轻
    const totalDur = slots.length ? slots[slots.length - 1].end : 0;
    slots.forEach((s, i) => {
      if (types[i] === 'chat' && s.dur > 8 + 1e-6)
        warn(where(i, 'chat', 'dur'), `chat 这一镜 ${fmtN(s.dur)} 秒，超过 8 秒`, '精简对话或候选回复，把这一镜控制在 8 秒以内，否则片子头重脚轻');
      else if (totalDur > 0 && s.dur / totalDur > 0.4 + 1e-6)
        warn(where(i, types[i], 'dur'), `这一镜 ${fmtN(s.dur)} 秒，占全片 ${fmtN((s.dur / totalDur) * 100)}%，单镜超过 40% 会显得拖`, '拆成两镜，或缩短这一镜给别的镜头腾时间');
    });
  }

  // ---- 总时长（meta.durationRange 覆盖默认 15–45 秒；行业推荐结构给的时长更长时，在分镜里写 meta.durationRange 放开）----
  const styleDur = !isCards && Array.isArray(style?.rules?.durationRange) && style.rules.durationRange.length === 2 ? style.rules.durationRange : null;
  const durRange = Array.isArray(meta?.durationRange) && meta.durationRange.length === 2 && meta.durationRange.every((x) => typeof x === 'number') ? meta.durationRange : styleDur ?? DUR_RANGE;
  const total = slots.length ? slots[slots.length - 1].end : 0;
  if (total < durRange[0] || total > durRange[1])
    err('总时长', `${fmtN(total)} 秒，要在 ${durRange[0]}–${durRange[1]} 秒之间`, total < durRange[0] ? `加镜头或加长时长，还差 ${fmtN(durRange[0] - total)} 秒` : `删镜头或缩短时长，多了 ${fmtN(total - durRange[1])} 秒`);

  // ---- 配音：vo 和 meta.voice 要配套；按常见语速估算配音后（有旁白的镜头时长由配音决定）的总时长 ----
  const hasVo = shots.some((s) => typeof s?.vo === 'string' && s.vo.trim());
  if (hasVo && meta?.voice === undefined)
    warn('shots', '写了 vo（旁白），但没写 meta.voice：不会配音，也不会出旁白字幕', '要配音就在 meta 里加 "voice": {"provider": "minimax"}（没有 key 先用 "mock" 听节奏）；不要配音就删掉各镜的 vo');
  else if (!hasVo && meta?.voice !== undefined)
    warn('meta.voice', '开了配音，但没有一镜写 vo（旁白）', '在要念的镜头里写 "vo": "这一镜要念的话"；不配音就删掉 meta.voice');
  else if (hasVo && meta?.voice && typeof meta.voice === 'object') {
    const est = slots.reduce((a, s) => a + (voEst[s.i] ?? s.dur), 0);
    if (est < durRange[0] - 1e-6 || est > durRange[1] + 1e-6)
      warn('总时长', `有旁白的镜头时长由配音决定：按常见语速估算，配音后全片约 ${fmtN(Math.round(est * 10) / 10)} 秒，不在 ${durRange[0]}–${durRange[1]} 秒之间（出片时按实际配音时长再核一次，超了会停）`,
        est > durRange[1] ? '删减旁白字数或删一镜' : '加一镜，或把旁白写得完整一点');
  }

  // ---- 全文扫描：网址/二维码/账号、极限词 ----
  const allow = Array.isArray(meta?.allowWords) ? meta.allowWords.filter((x) => typeof x === 'string') : [];
  for (const {where: w, text} of texts) {
    // 转义残留：JSON 里把换行写成了 "\\n"，画面上会原样显示反斜杠
    if (/\\n/.test(text)) err(w, `「${short(text, 20)}」里有字面的 \\n，画面上会直接显示反斜杠和 n`, 'JSON 里换行只写一个反斜杠：\\n（不要写成两个反斜杠）；这个字段不支持换行就删掉');
    else if (/\\[tr"'u]/.test(text)) err(w, `「${short(text, 20)}」里有转义残留（反斜杠）`, '删掉反斜杠；字幕里要用引号就写「」，不要写英文双引号');
    else if (/\\/.test(text)) err(w, `「${short(text, 20)}」里有反斜杠`, '删掉反斜杠');
    let scrub = text;
    for (const a of allow) scrub = scrub.split(a).join('');
    const fb = FORBID.filter((f) => f.re.test(text)); // allowWords 不豁免网址/账号/引流
    if (fb.length) err(w, `「${short(text, 20)}」含${fb.map((f) => f.what).join('、')}，画面里不许出现网址/二维码/账号/引流`, '删掉这部分（只删引流/账号，别改产品名）；片尾的获取方式只能照抄 meta.cta（简报原文），不要自己编');
    else {
      const pw = PLATFORM_WORDS.filter((x) => scrub.includes(x));
      if (pw.length) warn(w, `含平台名「${pw.join('、')}」`, `如果它是产品本身的品类词，把它加进 meta.allowWords（如 ["${pw[0]}"]），不要为了过校验改产品名或删字；如果是引流就删掉`);
    }
    for (const b of AD_BENIGN) scrub = scrub.split(b).join('');
    const hits = AD_WORDS.filter((a) => !allow.includes(a) && scrub.includes(a));
    if (hits.length) err(w, `「${short(text, 20)}」含《广告法》极限词：${hits.map((h) => `「${h}」`).join('')}`, '换成可证实的具体说法（如「平均 3 秒出结果」）；确有依据可把词加进 meta.allowWords');
  }

  // ---- 行业规则 + 文案检查（三档合并：block→errors 拦截，warn→warnings 提醒，human→单独列「需人工复核」）----
  const checkCtx = {baseDir, specs, texts, assets, slots, beat, meta};
  const ind = runIndustryChecks(sb, checkCtx);
  const txt = runTextChecks(sb, checkCtx);
  // 限定语一致（text-checks 的通用版）和行业规则 checks/price-conditions（价格专用版）会对同一处报两遍：同一位置行业规则已报，就不再重复
  // chat 用错场景同理：行业规则 checks/core-action 已经对这一镜报了「演成了对话」，这里的通用版就不再重复
  const indWhere = new Set((ind.errors ?? []).map((e) => e.where));
  const shotOf = (w) => /^第\s*\d+\s*镜（[^）]+）/.exec(String(w))?.[0] ?? null;
  const indChatShots = new Set((ind.errors ?? []).filter((e) => /对话|聊天|chat/i.test(e.problem)).map((e) => shotOf(e.where)).filter(Boolean));
  const QUAL_DUP = /限定语丢了|和 facts 对不上：facts 里是/;
  const CHAT_DUP = /chat 只用于|chat is for messaging/;
  errors.push(...(ind.errors ?? []), ...(txt.errors ?? []).filter((e) => !(QUAL_DUP.test(e.problem) && indWhere.has(e.where)) && !(CHAT_DUP.test(e.problem) && indChatShots.has(shotOf(e.where)))));
  warnings.push(...(ind.warnings ?? []), ...(txt.warnings ?? []));
  const human = [...(ind.human ?? []), ...(txt.human ?? [])];
  // ---- 风格规则（styles/<id>/rules.json + checks.mjs）----
  const sty = runStyleRules(sb, style, {where});
  errors.push(...sty.errors);
  warnings.push(...sty.warnings);
  human.push(...sty.human);

  return {errors, warnings, human, slots, total, beat, assets, style: styleId, aspect};
}

// ---------------- spec 自检（镜头开发者用） ----------------
export function checkSpecs(specs = loadSpecs()) {
  const problems = [];
  const need = ['type', 'purpose', 'dur', 'caption', 'params', 'sfx', 'example'];
  for (const [type, s] of Object.entries(specs)) {
    for (const k of need) if (s[k] === undefined) problems.push(`${type}.spec.json：缺少字段 ${k}`);
    if (s.dur && !(s.dur.min <= s.dur.default && s.dur.default <= s.dur.max)) problems.push(`${type}.spec.json：dur 要满足 min ≤ default ≤ max`);
    if (!['required', 'optional', 'none'].includes(s.caption)) problems.push(`${type}.spec.json：caption 只能是 required / optional / none`);
    if (s.exit && !['push', 'fade', 'none'].includes(s.exit)) problems.push(`${type}.spec.json：exit 只能是 push / fade / none`);
    for (const c of s.sfx ?? []) if (!SFX_KINDS.includes(c.kind)) problems.push(`${type}.spec.json：音效 ${c.kind} 不存在（可用：${SFX_KINDS.join(' ')}）`);
    // 用示例拼一个最小分镜跑一遍校验
    if (s.example?.params) {
      const hook = specs.hook?.example;
      const shots = type === 'hook' ? [] : [{type: 'hook', caption: hook?.caption ?? '标题', params: hook?.params ?? {visual: 'icon', icon: 'sparkle'}}];
      const one = {type, dur: s.example.dur ?? s.dur?.default, caption: s.example.caption, mood: s.example.mood, params: s.example.params};
      if (type === 'custom') {
        one.component = s.example.component;
        one.slots = s.example.slots;
      }
      shots.push(one);
      const ep = s.example.params;
      const r = validate({meta: {title: 'spec-check', product: typeof ep.brand === 'string' ? ep.brand : 'x', theme: 'warm-emotion', ...(s.example.industry ? {industry: s.example.industry} : {}), ...(s.example.facts ? {facts: s.example.facts} : {}), ...(s.example.demoData ? {demoData: true} : {}), ...(s.example.disclaimer ? {disclaimer: s.example.disclaimer} : {}), ...(typeof ep.cta === 'string' ? {cta: ep.cta} : {})}, shots}, {baseDir: TEMPLATE, specs, skipCustomFiles: type === 'custom'});
      // 单镜示例不要求「全片有演示镜」「meta.action」「meta.facts 数字来源」这类整片才有意义的业务规则，只查 spec/schema 本身对不对
      for (const e of r.errors)
        if (
          !e.where.startsWith('总时长') && e.where !== 'shots' && e.where !== 'meta.action' &&
          !(type === 'hook' && e.where.includes('第 1 镜必须')) &&
          !/在 meta\.facts 里找不到来源|没有简报依据|示例\/演示」的 fact|没声明这是演示数据/.test(e.problem)
        )
          problems.push(`${type}.spec.json 示例：${e.where}：${e.problem}`);
    }
  }
  // 各风格的专属镜头：结构同上；示例放进这个风格的最小分镜里跑（开发中的风格也跑）
  for (const st of listStyles()) {
    if (st.id === DEFAULT_STYLE) continue;
    const all = specsForStyle(st, specs);
    for (const [type, s] of Object.entries(st.ownSpecs)) {
      const tag = `styles/${st.id}/shots/${type}.spec.json`;
      for (const k of need) if (s[k] === undefined) problems.push(`${tag}：缺少字段 ${k}`);
      if (s.dur && !(s.dur.min <= s.dur.default && s.dur.default <= s.dur.max)) problems.push(`${tag}：dur 要满足 min ≤ default ≤ max`);
      if (!['required', 'optional', 'none'].includes(s.caption)) problems.push(`${tag}：caption 只能是 required / optional / none`);
      if (st.manifest.captionLayer === 'none' && s.caption !== 'none') problems.push(`${tag}：这个风格 captionLayer 是 none，镜头的 caption 只能是 none`);
      // 可选：checkBeat = make.mjs 在本镜第几拍抽检查帧；mustShow = 检查帧上必须看得见的字段（见 scripts/lib/layout-check.mjs）
      if (s.checkBeat !== undefined && !(typeof s.checkBeat === 'number' && s.checkBeat > 0)) problems.push(`${tag}：checkBeat 要是正数（本镜第几拍抽检查帧）`);
      if (s.mustShow !== undefined && !(Array.isArray(s.mustShow) && s.mustShow.every((x) => typeof x === 'string' && /^params\.\w+$/.test(x) && s.params?.properties?.[x.slice(7)])))
        problems.push(`${tag}：mustShow 要是 params 里已有字段的列表，如 ["params.title"]`);
      for (const c of s.sfx ?? []) if (!SFX_KINDS.includes(c.kind)) problems.push(`${tag}：音效 ${c.kind} 不存在（可用：${SFX_KINDS.join(' ')}）`);
      if (!s.example?.params) continue;
      const first = st.manifest.firstShot;
      const shots = [];
      if (first && first !== type && all[first]?.example) shots.push({type: first, dur: all[first].example.dur, params: all[first].example.params});
      shots.push({type, dur: s.example.dur ?? s.dur?.default, caption: s.example.caption, mood: s.example.mood, params: s.example.params});
      const r = validate({meta: {title: 'spec-check', product: 'x', style: st.id, ...(s.example.industry ? {industry: s.example.industry} : {}), ...(s.example.facts ? {facts: s.example.facts} : {}), ...(s.example.demoData ? {demoData: true} : {}), ...(s.example.disclaimer ? {disclaimer: s.example.disclaimer} : {})}, shots}, {baseDir: TEMPLATE, specs, allowDraftStyles: true});
      for (const e of r.errors)
        if (!e.where.startsWith('总时长') && e.where !== 'shots' && e.where !== 'meta.action' && !/在 meta\.facts 里找不到来源|没有简报依据|示例\/演示」的 fact|没声明这是演示数据/.test(e.problem))
          problems.push(`${tag} 示例：${e.where}：${e.problem}`);
    }
  }
  return problems;
}

// ---------------- 报告 ----------------
const pad = (s, n) => {
  const w = Array.from(String(s)).reduce((a, ch) => a + (isWide(ch.codePointAt(0)) ? 2 : 1), 0);
  return String(s) + ' '.repeat(Math.max(0, n - w));
};
export const formatReport = (r, file = '') => {
  const out = [];
  if (r.errors.length) {
    out.push(`校验未通过：${r.errors.length} 个问题${file ? `（${file}）` : ''}`);
    r.errors.forEach((e, k) => out.push(`${k + 1}. ${e.where}：${e.problem}\n   → 怎么改：${e.fix}`));
  }
  if (r.warnings.length) {
    out.push(`提醒 ${r.warnings.length} 条（不拦截）：`);
    r.warnings.forEach((e) => out.push(`  - ${e.where}：${e.problem}（${e.fix}）`));
  }
  if (r.human?.length) {
    out.push(`需人工复核 ${r.human.length} 条（不拦截，发布前自己确认）：`);
    r.human.forEach((e) => out.push(`  - ${e.where}：${e.problem}（${e.fix}）`));
  }
  if (!r.errors.length) {
    out.push(`校验通过：${r.slots.length} 镜，共 ${fmtN(r.total)} 秒（一拍 ${fmtBeat(r.beat)} 秒，共 ${Math.round(r.total / r.beat)} 拍）`);
    out.push(`  ${pad('#', 4)}${pad('类型', 11)}${pad('起止(秒)', 16)}${pad('时长', 7)}字幕`);
    for (const s of r.slots) out.push(`  ${pad(s.i + 1, 4)}${pad(s.type, 11)}${pad(`${s.start.toFixed(1)} – ${s.end.toFixed(1)}`, 16)}${pad(s.dur.toFixed(1), 7)}${short([r.sb?.shots?.[s.i]?.caption ?? ''].flat().join(' / ').replace(/[{}]/g, ''), 20)}`);
  }
  return out.join('\n');
};

export const parseFile = (file) => {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  try {
    return {sb: JSON.parse(raw)};
  } catch (e) {
    const m = /position (\d+)/.exec(String(e.message));
    const lc = /line (\d+) column (\d+)/.exec(String(e.message));
    let loc = '';
    const lineOf = (pos) => {
      const before = raw.slice(0, pos).split('\n');
      return `第 ${before.length} 行第 ${before[before.length - 1].length + 1} 列附近`;
    };
    if (lc) loc = `第 ${lc[1]} 行第 ${lc[2]} 列附近`;
    else if (m) loc = lineOf(Number(m[1]));
    else {
      // 常见错：多余逗号 / 结尾逗号 / 中文引号当 JSON 引号
      const hint = /,\s*,|,\s*[}\]]|[“”]\s*:/.exec(raw);
      if (hint) loc = lineOf(hint.index);
    }
    return {error: {where: '整个文件', problem: `JSON 解析失败${loc ? '：' + loc : ''}（${e.message}）`, fix: '检查是否漏了逗号、多了结尾逗号、括号没配对，或把中文引号当成了 JSON 引号；字幕里的换行写成 \\n（一个反斜杠）；字幕里要用引号就写「」，不要写英文双引号 "'}};
  }
};

// ---------------- CLI ----------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--specs')) {
    const p = checkSpecs();
    if (p.length) {
      console.log(`spec 自检发现 ${p.length} 个问题：\n` + p.map((x) => '  - ' + x).join('\n'));
      process.exit(1);
    }
    const own = listStyles().filter((st) => st.id !== DEFAULT_STYLE).map((st) => `${st.id} ${Object.keys(st.ownSpecs).length}`);
    console.log(`spec 自检通过：${Object.keys(loadSpecs()).length} 个镜头${own.length ? `（另有风格专属镜头：${own.join('、')}）` : ''}`);
    process.exit(0);
  }
  // --brief <简报文件>：有简报原文时，逐条核对 meta.facts 的数字/quote 是否真的出自简报
  const bi = args.indexOf('--brief');
  const briefFile = bi >= 0 ? args[bi + 1] : null;
  const file = args.find((a, k) => !a.startsWith('--') && !(bi >= 0 && k === bi + 1));
  if (!file) {
    console.log('用法：node scripts/validate.mjs <storyboard.json> [--json] [--brief 简报.md]   或   node scripts/validate.mjs --specs');
    process.exit(2);
  }
  const asJson = args.includes('--json');
  const brief = briefFile && fs.existsSync(briefFile) ? fs.readFileSync(briefFile, 'utf8').replace(/^﻿/, '') : null;
  if (briefFile && !brief) console.error(`（--brief 指定的简报文件读不到：${briefFile}，本次不核对 facts 是否出自简报）`);
  const parsed = parseFile(file);
  let r;
  if (parsed.error) r = {errors: [parsed.error], warnings: [], slots: [], total: 0, beat: 0.5, assets: [], human: []};
  else r = validate(parsed.sb, {baseDir: path.dirname(path.resolve(file)), brief});
  r.sb = parsed.sb;
  if (asJson) {
    console.log(JSON.stringify({ok: !r.errors.length, errors: r.errors, warnings: r.warnings, human: r.human ?? [], total: r.total, slots: r.slots.map(({i, type, start, dur, end}) => ({i, type, start, dur, end}))}, null, 2));
  } else console.log(formatReport(r, file));
  process.exit(r.errors.length ? 1 : 0);
}
