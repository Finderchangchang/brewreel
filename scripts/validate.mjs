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
import {runTextChecks, FILLIN_BY_TYPE, FILLIN_DEFAULT, typeOfWhere} from './lib/text-checks.mjs';

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
export const MID_SHOTS = ['compare', 'steps', 'phone', 'meter'];
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
/** 样例里的文字（examples/*.json、spec.json 的 example、shots.md 的 json 代码块）：新分镜的字和它们太像就提醒（别照抄样例）。
 *  kind: caption = 字幕/口号；param = 其他参数文字。SEQS = examples 的镜头类型序列 */
const collectStrings = (v, out) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['icon', 'src', 'kind', 'visual', 'tone', 'chart', 'from', 'higherIs', 'type', 'mode'].includes(k)) collectStrings(x, out);
  return out;
};
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
  const q = /秒出|秒级|秒回|秒懂|秒答|秒查|秒到|秒推送|秒达|秒批|秒生成|秒传|秒完成|秒上传/.exec(t);
  if (q) out.push({sec: 5, raw: q[0], fast: true});
  return out;
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
export const schedule = (sb, specs) => {
  const beat = 60 / (sb.meta?.bpm || 120);
  let t = 0;
  return (sb.shots || []).map((shot, i) => {
    const spec = specs[shot?.type];
    const raw = typeof shot?.beats === 'number' ? shot.beats * beat : typeof shot?.dur === 'number' ? shot.dur : spec?.dur?.default ?? 3;
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
  }
  if (type === 'meter') {
    const max = num(p.max) ? p.max : 10;
    if (num(p.value) && p.value > max) err(W('value'), `value ${p.value} 比 max ${max} 还大，画面数字会对不上`, `把 value 改到 0–${max}，或把 max 调大`);
    if (num(p.from) && p.from > max) err(W('from'), `from ${p.from} 比 max ${max} 还大`, `把 from 改到 0–${max}`);
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
export function validate(sb, {baseDir = process.cwd(), specs = loadSpecs()} = {}) {
  const errors = [];
  const warnings = [];
  const texts = []; // [{where, text}] 画面上会出现的字，统一扫网址/极限词
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
    else if (!['meta', 'shots'].includes(k)) err(k, '多了一个不认识的顶层字段', '最外层只能有 meta 和 shots');
  }

  // ---- meta ----
  const meta = sb.meta;
  if (!meta || typeof meta !== 'object') err('meta', '缺少 meta', '补上 "meta": {"title": "...", "product": "...", "theme": "warm-emotion"}');
  else {
    const known = [
      'title', 'product', 'bpm', 'theme', 'brandColor', 'disclaimer', 'logo', 'allowWords', 'cta', 'facts',
      'industry', 'lang', 'platform', 'notices', 'action', 'durationRange', 'subCategory', 'attachDeal',
    ];
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
          // facts.text 不上屏（不进 texts 数组），所以不扫网址/极限词；它是给 refs 引用、给人和校验看的依据
        }
      });
    }
    // industry / lang / platform：枚举值，不写就是默认值，校验按下面的可选值检查
    if (meta.industry !== undefined) {
      const opts = ['software', 'food', 'ecommerce', 'education', 'beauty', 'travel'];
      if (typeof meta.industry !== 'string' || !opts.includes(meta.industry)) err('meta.industry', `「${meta.industry}」不是可选值`, `只能从这些里选一个：${opts.join(' / ')}；不写默认 software`);
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
    for (const k of Object.keys(meta)) if (!known.includes(k)) err(`meta.${k}`, '多了一个不认识的字段', `删掉，或检查拼写。可用字段：${known.join('、')}`);
    for (const k of ['title', 'product', 'theme']) if (typeof meta[k] !== 'string' || !meta[k].trim()) err(`meta.${k}`, '缺少必填字段（文字）', k === 'theme' ? `从这些里选：${Object.keys(THEMES).join(' / ')}` : '填上');
    if (typeof meta.theme === 'string' && meta.theme && !(meta.theme in THEMES)) err('meta.theme', `没有叫「${meta.theme}」的主题`, `从这些里选：${Object.keys(THEMES).join(' / ')}`);
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

  // ---- shots ----
  const shots = sb.shots;
  if (!Array.isArray(shots) || shots.length === 0) {
    err('shots', '缺少镜头列表', '写 "shots": [{"type": "hook", ...}, ..., {"type": "endCard", ...}]');
    return {errors, warnings, slots: [], total: 0, beat: 60 / (meta?.bpm || 120), assets, human: []};
  }
  const beat = 60 / (meta?.bpm || 120);
  const slots = schedule(sb, specs);
  shots.forEach((shot, i) => {
    const type = shot?.type;
    const W = (f) => where(i, type, f);
    if (!shot || typeof shot !== 'object') return err(where(i, '?', ''), '不是对象', '每一镜写成 {"type": ..., "params": {...}}');
    const spec = specs[type];
    if (!spec) return err(W('type'), `没有「${type}」这种镜头`, `从这些里选：${Object.keys(specs).join(' / ')}`);
    for (const k of Object.keys(shot)) if (!['type', 'dur', 'beats', 'caption', 'mood', 'params', 'note'].includes(k))
      err(W(k), '多了一个不认识的字段', '每一镜只能有 type、dur 或 beats、caption、mood、params、note（时长字段叫 dur，单位秒）');
    // 时长
    if (shot.dur !== undefined && (typeof shot.dur !== 'number' || !(shot.dur > 0))) err(W('dur'), `时长 ${JSON.stringify(shot.dur)} 不对`, '写正数秒，例如 3 或 2.5');
    if (shot.beats !== undefined && (typeof shot.beats !== 'number' || !(shot.beats > 0))) err(W('beats'), `拍数 ${JSON.stringify(shot.beats)} 不对`, '写正整数，例如 6');
    if (shot.dur !== undefined && shot.beats !== undefined) warn(W('dur/beats'), '同时写了 dur 和 beats，以 beats 为准', '只留一个');
    const s = slots[i];
    const {min, max} = spec.dur;
    if (s.dur < min - 1e-6 || s.dur > max + 1e-6) err(W('dur'), `时长 ${fmtN(s.dur)} 秒不在该镜头允许的 ${min}–${max} 秒内`, `改到 ${min}–${max} 秒之间（默认 ${spec.dur.default} 秒）`);
    if (Math.abs(s.dur - s.raw) > 1e-6 && typeof s.raw === 'number' && s.raw > 0) warn(W('dur'), `${fmtN(s.raw)} 秒已吸附到整拍 → ${fmtN(s.dur)} 秒`, `想精确就写成 ${fmtN(beat)} 秒的整数倍`);
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
    } else if (spec.caption === 'required') err(W('caption'), '缺少字幕（这一镜必填）', type === 'hook' ? 'hook 的 caption 就是封面大标题，写用户痛点，{} 里放最扎心的几个字' : '补上 caption');
    // 参数
    if (shot.params === undefined) err(W('params'), '缺少 params', '补上 "params": {...}，字段见 shots.md');
    else {
      checkValue(spec.params, shot.params, W('params'));
      if (shot.params && typeof shot.params === 'object') crossCheck(type, shot.params, (f) => W(`params.${f}`), err, warn);
    }
    // 位置规则
    if (i === 0 && type !== 'hook') err(W('type'), '第 1 镜必须是 hook（第 0 帧就要有钩子）', '在最前面加一个 hook 镜头，caption 写封面大标题');
    if (i > 0 && type === 'hook') err(W('type'), 'hook 只能是第 1 镜', '换成其他镜头类型');
    if (type === 'endCard' && i !== shots.length - 1) warn(W('type'), '片尾不在最后一镜', '把 endCard 挪到最后');
  });
  if (!shots.some((s) => s?.type === 'endCard')) warn('shots', '没有片尾 endCard', '最后加一个 endCard（产品名 + 口号）');

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
    return false;
  };
  if (!shots.some(isDemo))
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
  const selfTitle = meta?.title;
  for (const {where: w, text, caption} of texts) {
    if (!caption && !/slogan/.test(w)) continue;
    const plain = String(text).replace(/[{}\n]/g, '');
    const cl = CLICHE_START.find((c) => plain.startsWith(c)) ?? (CLICHE_RE.some((re) => re.test(plain)) ? plain.slice(0, 6) : null);
    if (cl) {
      const fillin = FILLIN_BY_TYPE[typeOfWhere(w)] ?? FILLIN_DEFAULT;
      warn(w, `字幕含「${cl}」，是样例里的套路句式`, `别用「三个能力，…」「这些时刻，你是不是也…」「这三步」这种万能句；可以按这个句型改写：「${fillin}」`);
    }
    const ex = exampleLines().find((e) => e.title !== selfTitle && e.kind === 'caption' && similar(text, e.text) >= 0.5);
    if (ex) warn(w, `和样例 ${ex.file} 的「${short(ex.text.replace(/[{}\n]/g, ''), 14)}」太像`, '按这个产品自己的场景重写，别照抄样例');
  }

  // ---- 文案逻辑：数字口径、引用词、数量词、重字残词、推荐回复立场、照抄样例、结构 ----
  // facts 是 {id,text}[]（见 schema.ts Fact）；这里只取 text 参与数字/来源核对，id 留给以后的 refs 校验用
  const facts = Array.isArray(meta?.facts) ? meta.facts.filter((x) => x && typeof x === 'object' && typeof x.text === 'string').map((x) => x.text) : [];
  const factText = facts.join(' ');
  const factNums = new Set((factText.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
  const shotTexts = shots.map((sh) => {
    if (!sh || typeof sh !== 'object') return [];
    const out = [];
    for (const c of [sh.caption].flat()) if (typeof c === 'string') out.push({text: c, caption: true, field: 'caption'});
    for (const x of collectStrings(sh.params ?? {}, [])) out.push({text: x, caption: false, field: 'params'});
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
    for (const key of ['from', 'to']) if (num(P[key]) && P[key] !== 0 && !factNums.has(P[key]) && !(key === 'from' && !P.showFrom && P.from === 0))
      err(W(`params.${key}`), `数字 ${P[key]} 在 meta.facts 里找不到来源${facts.length ? '' : '（没写 meta.facts）'}`, facts.length ? '简报给了这个数字就把原话抄进 meta.facts，id 随便起' : '简报没给数字就别编：改用其他镜头，或 sub 写「示例数据，以实际为准」，删掉这个具体数字');
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
        if (!m) continue; // 中文数词（半天/三小时）不核对来源，避免误伤定性说法
        const v = Number(m[1]);
        if (v !== 0 && !factNums.has(v))
          err(w, `「${d.raw}」这个时长在 meta.facts 里找不到来源${facts.length ? '' : '（没写 meta.facts）'}`, noFactsFix('时长'));
      }
      for (const {kind, re} of PERF_NUM_RES) {
        for (const m of t.matchAll(re)) {
          const v = Number(m[1] ?? m[2]);
          if (!Number.isFinite(v) || v === 0 || factNums.has(v)) continue;
          err(w, `「${m[0]}」（${kind}）在 meta.facts 里找不到来源${facts.length ? '' : '（没写 meta.facts）'}`, noFactsFix(kind));
        }
      }
    }
  }
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
    const caps = sh.type === 'endCard' ? [P.slogan] : [sh.caption].flat();
    for (const c of caps) {
      if (typeof c !== 'string') continue;
      const t = plainOf(c);
      if (sh.type === 'chat' && !/回复|建议|候选|说法/.test(t)) continue;
      for (const m of t.matchAll(QTY)) {
        const n = cnNum(m[1]);
        if (!Number.isFinite(n) || n < 2 || n === arr.length) continue;
        err(where(i, sh.type, sh.type === 'endCard' ? 'params.slogan' : 'caption'), `字幕说「${m[0]}」，这一镜的${what}只有 ${arr.length} 条，数量对不上`, `把数字改成 ${arr.length}，或者别写数量`);
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
      if (x.caption || units(x.text) < 5 || /示例数据|演示/.test(x.text) || [meta?.product, meta?.cta, meta?.disclaimer].includes(x.text)) continue;
      const ex = exampleLines().find((e) => e.title !== selfT && e.kind === 'param' && similar(x.text, e.text) >= 0.6);
      if (ex) warn(where(i, sh.type, 'params'), `「${short(plainOf(x.text), 14)}」和样例 ${ex.file} 的「${short(plainOf(ex.text), 14)}」太像`, '按这个产品自己的场景重写，别照抄样例');
    }
  });
  // (8) 结构：别和样例/常见模板一模一样（含近似匹配）；中段要有 compare/steps/phone/meter 之一；quickList 和 counter 别同时用；单镜别占比过大
  {
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
    if (shots.length >= 4 && !types.some((t) => MID_SHOTS.includes(t))) warn('shots', `中段没有 ${MID_SHOTS.join(' / ')} 里的任何一镜`, '至少放一镜：对比（compare）、流程（steps）、真截图（phone）或仪表（meter）');
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
  const durRange = Array.isArray(meta?.durationRange) && meta.durationRange.length === 2 && meta.durationRange.every((x) => typeof x === 'number') ? meta.durationRange : DUR_RANGE;
  const total = slots.length ? slots[slots.length - 1].end : 0;
  if (total < durRange[0] || total > durRange[1])
    err('总时长', `${fmtN(total)} 秒，要在 ${durRange[0]}–${durRange[1]} 秒之间`, total < durRange[0] ? `加镜头或加长时长，还差 ${fmtN(durRange[0] - total)} 秒` : `删镜头或缩短时长，多了 ${fmtN(total - durRange[1])} 秒`);

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
  errors.push(...(ind.errors ?? []), ...(txt.errors ?? []));
  warnings.push(...(ind.warnings ?? []), ...(txt.warnings ?? []));
  const human = [...(ind.human ?? []), ...(txt.human ?? [])];

  return {errors, warnings, human, slots, total, beat, assets};
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
      shots.push({type, dur: s.example.dur ?? s.dur?.default, caption: s.example.caption, mood: s.example.mood, params: s.example.params});
      const ep = s.example.params;
      const r = validate({meta: {title: 'spec-check', product: typeof ep.brand === 'string' ? ep.brand : 'x', theme: 'warm-emotion', ...(s.example.industry ? {industry: s.example.industry} : {}), ...(typeof ep.cta === 'string' ? {cta: ep.cta} : {})}, shots}, {baseDir: TEMPLATE, specs});
      // 单镜示例不要求「全片有演示镜」「meta.action」「meta.facts 数字来源」这类整片才有意义的业务规则，只查 spec/schema 本身对不对
      for (const e of r.errors)
        if (
          !e.where.startsWith('总时长') && e.where !== 'shots' && e.where !== 'meta.action' &&
          !(type === 'hook' && e.where.includes('第 1 镜必须')) &&
          !/在 meta\.facts 里找不到来源/.test(e.problem)
        )
          problems.push(`${type}.spec.json 示例：${e.where}：${e.problem}`);
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
    out.push(`校验通过：${r.slots.length} 镜，共 ${fmtN(r.total)} 秒（一拍 ${fmtN(r.beat)} 秒，共 ${Math.round(r.total / r.beat)} 拍）`);
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
    console.log(`spec 自检通过：${Object.keys(loadSpecs()).length} 个镜头`);
    process.exit(0);
  }
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.log('用法：node scripts/validate.mjs <storyboard.json> [--json]   或   node scripts/validate.mjs --specs');
    process.exit(2);
  }
  const asJson = args.includes('--json');
  const parsed = parseFile(file);
  let r;
  if (parsed.error) r = {errors: [parsed.error], warnings: [], slots: [], total: 0, beat: 0.5, assets: [], human: []};
  else r = validate(parsed.sb, {baseDir: path.dirname(path.resolve(file))});
  r.sb = parsed.sb;
  if (asJson) {
    console.log(JSON.stringify({ok: !r.errors.length, errors: r.errors, warnings: r.warnings, human: r.human ?? [], total: r.total, slots: r.slots.map(({i, type, start, dur, end}) => ({i, type, start, dur, end}))}, null, 2));
  } else console.log(formatReport(r, file));
  process.exit(r.errors.length ? 1 : 0);
}
