// ============================================================
// 文案检查：跨行业、和「行业」本身无关的新规则（2026-09 round3 修复）。
//
// 装的规则：
//   1. 字幕/上屏文字不能是「写给剪辑师的镜头说明」（光点跑下来、卡片一张张出…）
//   2. 常见错别字表（中文 ≥50 组 / 英文一小份）
//   3. 绝对化承诺词表（中/英）
//   4. meta.action 必填 + 至少一个演示类镜头（chat/phone/mockApp/photoShot）的文字要体现 action 的关键词
//
// 和 industry.mjs 的分工：这里是「所有行业都要过的文案检查」，industry.mjs 是「按 meta.industry 才生效的检查」。
// 不读 industries/*，不做「这个行业该用什么措辞」的判断。
//
// 实现上只用 ctx 里已经算好的东西（texts/specs/meta），不反向 import validate.mjs，避免循环依赖。
// ============================================================
import {TYPO_ZH, TYPO_EN, ABS_CLAIM_ZH, ABS_CLAIM_ZH_PATTERNS, ABS_CLAIM_EN, SPELLED_NUM_EN_RE, NEAR_WORDS_ZH} from './typo-list.mjs';

// 「where」是 "第 N 镜（type）字段" 或 "meta.xxx"（见 validate.mjs 的 where()），从它反推镜头类型，不用额外传参
const TYPE_RE = /^第\s*\d+\s*镜（([^）]+)）/;
export const typeOfWhere = (w) => TYPE_RE.exec(String(w ?? ''))?.[1] ?? null;
const plain = (s) => String(s ?? '').replace(/[{}]/g, '').replace(/\n/g, '');

// ---- 1. 镜头说明词表：写给剪辑师看的动画/运镜描述，不该出现在给观众看的字幕里 ----
const SHOT_DIRECTION_WORDS = [
  '光点', '卡片', '一张张出', '滑入', '滑出', '点亮', '镜头', '画面', '动画', '这一镜', '转场',
  '特写', '慢动作', '淡入', '淡出', '拉近', '推近', '跳切', '闪回', '运镜',
  '划入', '弹出', '浮现', '闪现', '渐显', '渐隐', '缩放', '旋转入场', '飞入', '飞进', '出画', '入画', '字幕飘', '镜头切', '打光',
];
const SHOT_DIRECTION_START_RE = /^(讲|展示|演示|介绍)[^，。！？\n]{0,10}/;
/** 找 a、b 里最长的公共连续子串（≥n 才算命中），用来发现字幕抄了 spec.json 的说明文字 */
const sharedRun = (a, b, n = 4) => {
  if (!a || !b || a.length < n) return null;
  for (let i = 0; i + n <= a.length; i++) {
    const g = a.slice(i, i + n);
    if (b.includes(g)) return g;
  }
  return null;
};

export const FILLIN_BY_TYPE = {
  hook: '{用户此刻的处境}，{一句反常识的追问}',
  steps: '{动作}完就{结果}，如「拍完照，金额自动填好」',
  features: '{用户场景}，{它帮你做的事}，如「小票拍完不用整理，自动分好类」',
  quickList: '{这一条具体场景}，{真实感受或结果}',
  compare: '{以前要花多久/多少步}，{现在变成什么样}',
  mockApp: '{用户做了什么操作}，{看到了什么结果}',
  chat: '{对方说了什么}，{我这句回复解决了什么}',
  meter: '{这句话/这件事}，{它被打出的结论}',
  counter: '{这段时间里}，{这个数字说明了什么}',
  phone: '{看这一处}，{看到了什么}',
  photoShot: '{这道菜/这件商品}，{它的卖点}',
  endCard: '{产品能帮用户做成的那件事}',
};
export const FILLIN_DEFAULT = '{用户此刻的处境}，{产品带来的变化}';

function checkShotDirections(texts, specs, err) {
  for (const t of texts) {
    if (!t.caption) continue;
    const p = plain(t.text);
    const type = typeOfWhere(t.where);
    const hitWord = SHOT_DIRECTION_WORDS.find((w) => p.includes(w));
    const hitStart = SHOT_DIRECTION_START_RE.test(p);
    const spec = type ? specs?.[type] : null;
    // 只比 purpose（说画面怎么动的说明文字），不比 tips：tips 里常常原样引用了 example 的字幕当写法示范，会和自己的示例字幕重复，不算抄袭
    const corpus = spec?.purpose ?? '';
    // 阈值给到 6（比判词报告建议的 4 更保守）：purpose 里常有「输入框」「候选」这类正常的界面用词，字幕提到同一个 UI
    // 元素很正常，4 个字的重复太容易误伤；6 个字基本只有整句照抄说明文字才会命中
    const hitCopy = !hitWord && !hitStart ? sharedRun(p.replace(/\s/g, ''), corpus, 6) : null;
    if (!hitWord && !hitStart && !hitCopy) continue;
    const why = hitWord
      ? `含镜头说明用词「${hitWord}」`
      : hitStart
      ? '以「讲/展示/演示/介绍」开头，像是写给剪辑师看的说明，不是说给观众听的话'
      : `和「${type}」这个镜头 spec.json 里的说明文字连续重复了 4 个字以上（「${hitCopy}」），像是直接抄了说明文字`;
    const fillin = FILLIN_BY_TYPE[type] ?? FILLIN_DEFAULT;
    const what = /vo$/.test(t.where) ? '旁白' : '字幕';
    err(t.where, `${what}${why}`, `${what}是说给观众的话，讲用户的处境或产品带来的变化，不要描述画面怎么动。可以按这个句型改写：「${fillin}」`);
  }
}

/** 只能写中文、由组件在英文片里翻译上屏的枚举值（和各 spec.json 的 enum 保持一致） */
const ENUM_ZH_VALUES = new Set([
  '实拍', '示意', '效果图', // photoShot media[].tag
  '售价', '到手价', '券后价', '团购价', '套餐价', '活动价', '门票', // priceCard label
  '前7日最低成交价', '单点合计', '厂商建议零售价', '吊牌价', '平日价', // priceCard compare.basis
  '步行', '驾车', '打车', '公交', '地铁', '骑行', '接驳车', '导航估算', '实测', // storeCard routes[].mode / basis
]);
const ENUM_ZH_FIELD_RE = /\.(tag|label|basis|mode)$/;

// ---- 2/3. 错别字 + 绝对化承诺（按 meta.lang 切中英文词表和报错语言） ----
function checkTypoAndClaims(texts, lang, err, warn) {
  if (lang === 'en') {
    for (const t of texts) {
      const s = String(t.text ?? '');
      for (const {wrong, right} of TYPO_EN) {
        if (new RegExp(`\\b${wrong}\\b`, 'i').test(s))
          err(t.where, `"${wrong}" looks like a common misspelling of "${right}"`, `Change "${wrong}" to "${right}"`);
      }
      const hit = ABS_CLAIM_EN.find((w) => s.toLowerCase().includes(w.toLowerCase()));
      if (hit) warn(t.where, `"${hit}" is an absolute claim the product likely can't back up`, 'Use a more grounded, specific phrase instead of an absolute claim');
      const num = SPELLED_NUM_EN_RE.exec(s);
      if (num) warn(t.where, `"${num[0]}" is a spelled-out number with no cited source (English copy isn't checked against meta.facts)`, 'Either back it with a real number from the brief, or use a qualitative phrase instead');
      // 硬编码中文：英文视频画面上不应出现中文字（含组件写死的字符串，也会一并进 texts）
      // 例外：中文枚举值（photoShot 的 tag、priceCard 的 label/compare.basis、storeCard 的 mode/basis）按 spec 只能写中文，
      // 组件在 lang=en 时换成英文上屏（TAG_EN / MODE_EN / priceCard 的 label 表），不算穿帮
      if (/[㐀-鿿]/.test(s) && !(ENUM_ZH_VALUES.has(s.trim()) && ENUM_ZH_FIELD_RE.test(t.where))) err(t.where, `English video (meta.lang: "en") but this text contains Chinese characters: "${s}"`, 'Translate this field to English, or check whether a component is hard-coding Chinese text here');
    }
    return;
  }
  for (const t of texts) {
    const s = String(t.text ?? '');
    for (const {wrong, right, exceptionRe} of TYPO_ZH) {
      if (!s.includes(wrong)) continue;
      if (exceptionRe && exceptionRe.test(s)) continue;
      err(t.where, `「${wrong}」是错别字，应为「${right}」`, `把「${wrong}」改成「${right}」`);
    }
    const hitWord = ABS_CLAIM_ZH.find((w) => s.includes(w));
    const hitPat = !hitWord ? ABS_CLAIM_ZH_PATTERNS.map((re) => re.exec(s)?.[0]).find(Boolean) : null;
    const hit = hitWord ?? hitPat;
    if (hit) warn(t.where, `「${hit}」是绝对化承诺，产品很难兑现`, '换成有分寸、可信的说法，如把「全搞定」改成「常见情况都能处理」，把「一清二楚」改成「关键信息看得到」');
  }
}

// ---- 2b. 中文画面里的半角标点：紧贴汉字或包住汉字的英文引号，在描边大字上会很显眼（round4 修复） ----
const ASCII_PUNCT_FULLWIDTH = {',': '，', '?': '？', '!': '！', ':': '：', ';': '；'};
function checkAsciiPunctInZh(texts, lang, err) {
  if (lang !== 'zh') return;
  for (const t of texts) {
    const s = String(t.text ?? '');
    // 整句是外文（中文片里的英文台词、英文短语）：半角标点本来就对，不拦
    if (!/[㐀-鿿豈-﫿]/.test(s)) continue;
    const hits = new Set();
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (!(ch in ASCII_PUNCT_FULLWIDTH)) continue;
      const prev = s[i - 1] ?? '';
      const next = s[i + 1] ?? '';
      // 数字千分位（2,847）、英文单词/缩写里的标点，前后都是数字/字母时放过
      if (/[0-9A-Za-z]/.test(prev) && /[0-9A-Za-z]/.test(next)) continue;
      hits.add(ch);
    }
    for (const p of hits) err(t.where, `「${s.slice(0, 20)}」里的半角标点「${p}」和中文混排，粗描边大字上会很扎眼`, `换成全角：「${p}」→「${ASCII_PUNCT_FULLWIDTH[p]}」`);
    if (/'[^']*[㐀-鿿][^']*'/.test(s) || /"[^"]*[㐀-鿿][^"]*"/.test(s))
      err(t.where, `「${s.slice(0, 20)}」用英文引号包住了中文`, '改成中文引号「」，如把 \'嗯\' 改成「嗯」');
  }
}

// ---- 4. meta.action 必填 + 至少一个演示类镜头体现关键词 ----
const DEMO_TYPES = ['chat', 'phone', 'mockApp', 'photoShot'];
function checkActionDemo(texts, meta, lang, err) {
  const action = typeof meta?.action === 'string' ? meta.action.trim() : '';
  if (!action) {
    err('meta.action', lang === 'en' ? 'meta.action is required (one sentence: what the user does → what the product gives back)' : '缺少必填字段 meta.action（核心动作一句话）',
      lang === 'en' ? 'e.g. "snap a receipt photo → amount and category filled in automatically"' : '写「用户做什么 → 产品给出什么」，如「拍小票 → 自动填好金额和分类」');
    return;
  }
  const cleaned = action.replace(/[→\-—>\s，,。.：:；;、]/g, '');
  if (cleaned.length < 2) return;
  const grams = [];
  for (let i = 0; i < cleaned.length - 1; i++) grams.push(cleaned.slice(i, i + 2));
  const demoPool = texts.filter((t) => DEMO_TYPES.includes(typeOfWhere(t.where))).map((t) => plain(t.text)).join('');
  if (!demoPool) return; // 全片没有演示类镜头，交给 validate.mjs 主体的「核心动作」检查去报
  const hit = grams.some((g) => demoPool.includes(g));
  if (!hit)
    err('shots', lang === 'en'
      ? `meta.action says "${action}", but no demo shot (chat/phone/mockApp/photoShot) shows it on screen`
      : `meta.action 写的是「${action}」，但演示类镜头（chat/phone/mockApp/photoShot）的画面文字里没体现这个动作`,
      lang === 'en' ? 'Make the button/input/done/panel/callout text of the demo shot echo the action' : '让演示镜的 button/input/done/panel/callout 等文字体现这个动作的关键词，或者把 meta.action 改成和演示画面一致');
}

// ============================================================
// 2026-09 p2r2 修复（下面几节）：孤字成行、重复项目符号、chat 用错场景、问答对不上、占位词、
// 免责重复、限定语一致、facts 分真/示例。
// ============================================================
const whereOf = (i, type, field) => `第 ${i + 1} 镜（${type ?? '?'}）${field}`;
const isIdeo = (cp) => (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff);
const isWideCp = (cp) =>
  (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x3000 && cp <= 0x303f) ||
  cp === 0x201c || cp === 0x201d || cp === 0x2018 || cp === 0x2019 || cp === 0x2026 || cp === 0x00b7;

// ---- 5. 断行模拟：和 template/src/core/fit.ts 的 emWidth()/glueBreaks() 同一套规则的 JS 复刻 ----
// （Node 不能直接 import .ts；改 fit.ts 的字宽或分词规则要同步改这里）
export const emWidth = (text) => {
  let w = 0;
  for (const ch of Array.from(String(text).replace(/[{}⁠]/g, ''))) w += ch === ' ' ? 0.3 : isWideCp(ch.codePointAt(0)) ? 1 : 0.55;
  return w;
};
const fitLineSize = (text, maxW, max, min) => Math.max(min, Math.min(max, Math.floor(maxW / Math.max(0.01, emWidth(String(text).replace(/\n/g, ''))))));
let ZH_SEG;
const zhSeg = () => {
  try {
    return (ZH_SEG ??= new Intl.Segmenter('zh', {granularity: 'word'}));
  } catch {
    return null;
  }
};
const CLOSE_PUNCT = /^[，。、！？；：」』）》〉”’…,.!?;:)\]%％]/;
const OPEN_PUNCT = /[「『（《〈“‘([]$/;
/** 切成「不能从中间断开」的小块。mode: word = glueBreaks 保护的词/强调段；char = break-all 逐字断 */
const breakTokens = (text, mode, lang) => {
  const out = [];
  if (mode === 'char') {
    for (const ch of Array.from(String(text).replace(/[{}]/g, ''))) out.push(ch);
  } else {
    for (const part of String(text).split(/(\{[^{}]*\})/)) {
      if (!part) continue;
      if (part.startsWith('{') && part.endsWith('}')) {
        out.push(part.slice(1, -1));
        continue;
      }
      const seg = lang === 'zh' ? zhSeg() : null;
      if (!seg) {
        for (const w of part.split(/(\s+)/)) if (w) out.push(w);
        continue;
      }
      for (const {segment} of seg.segment(part)) {
        const cs = Array.from(segment);
        if ((cs.length >= 2 && cs.some((c) => isIdeo(c.codePointAt(0)))) || /^[A-Za-z0-9.]+$/.test(segment)) out.push(segment);
        else for (const c of cs) out.push(c);
      }
    }
  }
  // 标点避头尾：闭合标点粘到前一块，开启标点粘到后一块
  const glued = [];
  for (const tok of out) {
    if (glued.length && (CLOSE_PUNCT.test(tok) || OPEN_PUNCT.test(glued[glued.length - 1]))) glued[glued.length - 1] += tok;
    else glued.push(tok);
  }
  return glued;
};
/** 模拟一段文字在 width px 宽、size px 字号下会折成哪几行（\n 是手动换行） */
export const wrapSim = (text, size, width, {mode = 'word', lang = 'zh'} = {}) => {
  const lines = [];
  for (const raw of String(text).split('\n')) {
    let cur = '';
    let w = 0;
    for (const tok of breakTokens(raw, mode, lang)) {
      const tw = emWidth(tok) * size;
      if (/^\s+$/.test(tok)) {
        if (cur) (cur += tok), (w += tw);
        continue;
      }
      if (cur.trim() && w + tw > width + 0.5) {
        lines.push(cur.trimEnd());
        cur = tok;
        w = tw;
      } else (cur += tok), (w += tw);
    }
    lines.push(cur.trimEnd());
  }
  return lines;
};
const END_PUNCT = /[，。、！？；：,.!?;:…—]\s*\}?\s*$/;
/** 这一行是不是「孤字 / 孤词」：只剩 1 个汉字，或只剩 1 个英文单词，且上一行不是在标点处结束的 */
const orphanOf = (line, prev) => {
  if (prev === undefined || END_PUNCT.test(prev)) return null;
  const core = String(line).replace(/[{}\s，。、！？；：,.!?;:…—\-「」『』“”"'（）()]/g, '');
  if (!core) return null;
  const chars = Array.from(core);
  if (chars.length === 1 && isIdeo(chars[0].codePointAt(0))) return core;
  if (!chars.some((c) => isIdeo(c.codePointAt(0)))) {
    const words = String(line).trim().split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
    if (words.length === 1) return words[0].replace(/[{}]/g, '');
  }
  return null;
};
const EN_FUNC_END = /\b(a|an|the|your|my|our|their|his|her|its|to|of|in|on|at|for|with|by|from|and|or|but|into|about|as|than|that|this|these|those|every|each|no|not|be|is|are|was|were|will|can)\s*\}?\s*$/i;

function checkOrphans(sb, lang, err) {
  const zhFix = (hit) => `删两个字或换一种更短的说法，让最后一行不只剩「${hit}」一个字（如「复制粘贴排版全乱」→「复制后排版乱」）；不要删掉词里的字凑字数`;
  const enFix = (hit) => `Rephrase so no line is the lone word "${hit}" and the break falls at a phrase boundary, e.g. "Know your day,\\n{minute by minute}"`;
  const report = (w, lines, hit) =>
    err(w, lang === 'en' ? `On screen this wraps to "${lines.join(' / ')}": the last line is the lone word "${hit}"` : `画面上会折成「${lines.join(' / ')}」，最后一行只剩「${hit}」`, lang === 'en' ? enFix(hit) : zhFix(hit));
  const checkLines = (w, lines) => {
    for (let k = 1; k < lines.length; k++) {
      const hit = orphanOf(lines[k], lines[k - 1]);
      if (hit) return report(w, lines, hit);
    }
  };
  // 手动换行的大字（字幕、片尾口号）：单行不自动折，只看 \n 切出来的行；英文还要求断在短语边界
  const explicit = (w, s) => {
    if (typeof s !== 'string' || !s.includes('\n')) return;
    const lines = s.split('\n');
    checkLines(w, lines.map((x) => x.replace(/[{}]/g, '')));
    if (lang === 'en')
      lines.slice(0, -1).forEach((ln) => {
        const m = EN_FUNC_END.exec(ln);
        if (m) err(w, `The line break after "${m[1]}" splits a phrase ("${lines.map((x) => x.replace(/[{}]/g, '')).join(' / ')}")`, 'Break at a phrase boundary instead, e.g. "Know your day,\\n{minute by minute}" (not "Know your\\nreal day.")');
      });
  };
  (sb?.shots ?? []).forEach((sh, i) => {
    if (!sh || typeof sh !== 'object') return;
    const P = sh.params && typeof sh.params === 'object' ? sh.params : {};
    const caps = Array.isArray(sh.caption) ? sh.caption : [sh.caption];
    caps.forEach((c, k) => explicit(whereOf(i, sh.type, caps.length > 1 ? `caption[${k}]` : 'caption'), c));
    if (sh.type === 'endCard') explicit(whereOf(i, 'endCard', 'params.slogan'), P.slogan);
    // compare 栏内条目：按 compare.tsx 的 layoutSide() 复刻字号，再按 glueBreaks 的词边界模拟折行
    if (sh.type === 'compare') {
      const wide = P.mode === 'beforeAfter';
      const hasMeter = typeof P.left?.level === 'number' || typeof P.right?.level === 'number';
      const availH = 780 - 30 - (P.verdict ? 112 : 0);
      for (const side of ['left', 'right']) {
        const S = P[side];
        if (!S || !Array.isArray(S.items)) continue;
        const w = wide ? 780 : 380;
        const PAD = wide ? 30 : 22;
        const bullet = wide ? 44 : 36;
        const textW = w - 2 * PAD - bullet - 12;
        const items = S.items.slice(0, 3).filter((x) => typeof x === 'string');
        const rowsAt = (size) => items.map((it) => (/\s/.test(it) ? wrapSim(it, size, textW, {lang: 'en'}).length : Math.max(1, Math.ceil((emWidth(it) * size) / textW - 0.02))));
        const fixed = (wide ? 104 : 96) + PAD + (S.stat ? (wide ? 130 : 104) : 0) + (hasMeter ? 84 : 0) + 14 + PAD;
        let size = wide ? 44 : 40;
        while (size > 34 && fixed + rowsAt(size).reduce((a, n) => a + n * size * 1.25 + 26, 0) > availH) size -= 1;
        S.items.forEach((it, k) => {
          if (typeof it !== 'string') return;
          checkLines(whereOf(i, 'compare', `params.${side}.items[${k}]`), wrapSim(it, size, textW, {lang}));
        });
      }
    }
    // hook 气泡：hook.tsx 里 maxWidth 560、左右 padding 28，字号 56 或 48
    if (sh.type === 'hook' && P.visual === 'bubble' && typeof P.text === 'string') {
      const size = fitLineSize(P.text, 1200, 56, 44) >= 52 ? 56 : 48;
      checkLines(whereOf(i, 'hook', 'params.text'), wrapSim(P.text, size, 560 - 56, {lang}));
    }
    // chat 气泡：chat.tsx 里 maxWidth 520、字号 42、padding 0.58em，wordBreak: break-all（逐字断）
    if (sh.type === 'chat' && lang === 'zh' && Array.isArray(P.messages))
      P.messages.forEach((m, k) => {
        if (m && typeof m.text === 'string') checkLines(whereOf(i, 'chat', `params.messages[${k}].text`), wrapSim(m.text, 42, 520 - 42 * 1.16, {mode: 'char', lang}));
      });
  });
}

// ---- 6. 重复的项目符号：组件自己会画 ✓ / • / 序号，文字开头再写一遍画面上就是两个符号 ----
const LEAD_MARK = /^\s*([✓✔√☑✅•·●○◦▪■□◆◇➤►▶→✗✘×❌☐]|[-*+](?=\s)|\d{1,2}[.、)）](?!\d))\s*/;
function checkLeadMarkers(sb, lang, err) {
  const one = (w, s) => {
    if (typeof s !== 'string') return;
    const m = LEAD_MARK.exec(s);
    if (!m) return;
    err(w, lang === 'en' ? `"${s}" starts with "${m[1]}", but the component already draws its own marker, so the screen shows two` : `「${s}」开头写了「${m[1]}」，组件自己会画勾/圆点/序号，画面上会出现两个符号`,
      lang === 'en' ? `Delete the leading "${m[1]}" and write only the words` : `删掉开头的「${m[1]}」（和后面的空格），只写文字，如「${s.slice(m[0].length)}」`);
  };
  (sb?.shots ?? []).forEach((sh, i) => {
    const P = sh?.params;
    if (!P || typeof P !== 'object') return;
    const W = (f) => whereOf(i, sh.type, f);
    const list = (arr, base) =>
      Array.isArray(arr) &&
      arr.forEach((it, k) => {
        if (typeof it === 'string') one(W(`${base}[${k}]`), it);
        else if (it && typeof it === 'object') for (const f of ['text', 'title']) one(W(`${base}[${k}].${f}`), it[f]);
      });
    list(P.items, 'params.items');
    list(P.points, 'params.points');
    list(P.left?.items, 'params.left.items');
    list(P.right?.items, 'params.right.items');
  });
}

// ---- 7. 语义匹配：chat 只给聊天/消息/对话类场景；mockApp 问什么答什么；占位词 ----
const CHAT_OK_ZH = /消息|聊天|回复|对话|私信|客服|群聊|留言|评论|微信|咨询|沟通|交流|问答|答疑|提问|说出|说一句|问一句|聊/;
const CHAT_OK_EN = /\b(message|messages|messaging|chat|chats|reply|replies|conversation|dm|dms|inbox|texting|ask|asks|talk|support)\b/i;
const QUALIFIERS = [
  [/上个?月/, '上月'], [/(本|这个?)月/, '本月'], [/(今天|今日)/, '今日'], [/(昨天|昨日)/, '昨日'], [/(本|这)周|这个?星期/, '本周'], [/上周|上个?星期/, '上周'],
  [/新增/, '新增'], [/累计/, '累计'], [/环比/, '环比'], [/同比/, '同比'], [/平均|日均|人均/, '平均'], [/近\s*\d+\s*天/, '近N天'], [/今年|本年/, '今年'], [/去年/, '去年'],
];
const FILLER = /^(数据|信息|内容|详情|结果|文字|文本|说明|数值|指标|状态|待定|其他|xxx|XXX|—+|-+|…+|\.{3}|data|info|content|details|text|value|result|status|n\/a|tbd)$/i;
function checkSemanticFit(sb, meta, lang, err) {
  const shots = Array.isArray(sb?.shots) ? sb.shots : [];
  const action = typeof meta?.action === 'string' ? meta.action : '';
  const scene = [action, meta?.product].filter((x) => typeof x === 'string').join(' ');
  shots.forEach((sh, i) => {
    const P = sh?.params;
    if (!P || typeof P !== 'object') return;
    // (a) chat
    if (sh.type === 'chat' && action && !CHAT_OK_ZH.test(scene) && !CHAT_OK_EN.test(scene))
      err(whereOf(i, 'chat', 'type'),
        lang === 'en' ? `chat is for messaging products or real conversations, but meta.action "${action}" is not about messages/replies/chat` : `chat 只用于聊天/消息类产品或明确的对话场景，meta.action「${action}」不是在发消息/回复/对话`,
        lang === 'en' ? 'Show the product\'s own UI instead: mockApp with "button" (e.g. "Start") + "done", or phone with a screenshot. Only keep chat if the product really works inside a conversation, and then say so in meta.action (e.g. "reply to a message → …")' : '换成产品自己的界面：mockApp 写 button（如「开始」）+ done，或有截图就用 phone；产品真的是在对话里用的，就把 meta.action 写成「收到消息 → …」这样的对话动作');
    if (sh.type !== 'mockApp') return;
    // (b) dashboard：问什么答什么
    const input = typeof P.input === 'string' ? P.input.replace(/\s/g, '') : '';
    const label = typeof P.stat?.label === 'string' ? P.stat.label.replace(/\s/g, '') : '';
    if (P.kind === 'dashboard' && input && label && lang === 'zh') {
      const qs = (s) => new Set(QUALIFIERS.filter(([re]) => re.test(s)).map(([, k]) => k));
      const strip = (s) => QUALIFIERS.reduce((a, [re]) => a.replace(new RegExp(re.source, 'g'), ''), s).replace(/[有多少几个是呢吗？?的了查看一下]/g, '');
      const noun = strip(label);
      const grams = [];
      for (let k = 0; k + 2 <= noun.length; k++) grams.push(noun.slice(k, k + 2));
      const nounHit = !grams.length || grams.some((g) => input.includes(g));
      const miss = [...qs(label)].filter((q) => !qs(input).has(q));
      if (!nounHit || miss.length)
        err(whereOf(i, 'mockApp', 'params.input'),
          `问的和答的不是一回事：提问「${P.input}」，结果却是「${P.stat.label}」${miss.length ? `（多了「${miss.join('」「')}」这个限定）` : ''}`,
          `让提问和结果说同一件事、同一个时间范围：input 写成带同样限定的问题，如 stat.label 是「上月新增商户」，input 就写「上月广州新增多少商户」；或者把 stat.label 改成回答 input 的那个数`);
    }
    // (c) 占位词
    (Array.isArray(P.items) ? P.items : []).forEach((it, k) => {
      if (!it || typeof it !== 'object') return;
      for (const f of ['text', 'value']) {
        const v = typeof it[f] === 'string' ? it[f].trim() : '';
        if (v && FILLER.test(v))
          err(whereOf(i, 'mockApp', `params.items[${k}].${f}`), lang === 'en' ? `"${v}" is a placeholder word with no information` : `「${v}」是占位词，画面上没有信息量`,
            lang === 'en' ? 'Write a concrete value (e.g. "1,247", "Done", "Pending"), or delete this row' : '写具体的值（如「1,247 家」「已完成」「待处理」），没有具体值就删掉这一行');
      }
    });
  });
}

// ---- 8. notices 和 disclaimer 重复：顶部已经有免责胶囊，底部提示条再写一遍「演示/示意」就是重复 ----
const DEMO_MEANING = /演示|示意|示例|模拟|虚构|样例|sample|demo|simulated|illustrative|mock/i;
function checkNoticeDup(meta, lang, err) {
  const d = typeof meta?.disclaimer === 'string' ? meta.disclaimer : '';
  if (!d || !Array.isArray(meta?.notices)) return;
  const longestShared = (a, b) => {
    let best = '';
    for (let i = 0; i < a.length; i++) for (let j = i + best.length + 1; j <= a.length; j++) if (b.includes(a.slice(i, j))) best = a.slice(i, j);
    return best;
  };
  meta.notices.forEach((n, k) => {
    if (typeof n !== 'string') return;
    const shared = longestShared(n.replace(/[\s，。,.·]/g, ''), d.replace(/[\s，。,.·]/g, ''));
    if ((DEMO_MEANING.test(n) && DEMO_MEANING.test(d)) || Array.from(shared).length >= 4)
      err(`meta.notices[${k}]`, lang === 'en' ? `"${n}" repeats the top disclaimer "${d}"` : `「${n}」和顶部免责标签「${d}」说的是同一件事，画面上会出现两遍`,
        lang === 'en' ? 'Delete this notices entry; keep notices only for non-demo terms (e.g. "Prices vary by store")' : '顶部已经有免责标签，删掉这条 notices；notices 只放和演示无关的条款（如「以团购详情页为准」）');
  });
}

// ---- 9. facts 分真/示例：模型自己标了「示例/演示/模拟」的 fact 只能给演示界面用，不能给效果说法背书 ----
export const SAMPLE_FACT_RE = /示例|示意|演示|模拟|虚构|假设|举例|样例|编造|sample|demo|example|illustrative|fictional|made[- ]up|mock/i;
/** 把 meta.facts 分成两堆：real = 简报给的依据；demo = 模型自己标了示例/演示的 */
export const splitFacts = (meta) => {
  const all = Array.isArray(meta?.facts) ? meta.facts.filter((f) => f && typeof f === 'object' && typeof f.text === 'string') : [];
  const isDemo = (f) => SAMPLE_FACT_RE.test(f.text) || (typeof f.source === 'string' && SAMPLE_FACT_RE.test(f.source));
  return {real: all.filter((f) => !isDemo(f)), demo: all.filter(isDemo), all};
};

// ---- 10. 限定语一致：屏幕上的数字和某条 fact 对上了，fact 里跟着这个数字的日期范围/券后/时长/次数/附加费也要上屏 ----
const DAY = {一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7};
/** 从一段文字里读出「周几」集合（周日至周四 / 周一到周四 / 周五周六 / 周五六日 / 周末 / 工作日） */
export const parseDays = (s0) => {
  const s = String(s0).replace(/星期|礼拜/g, '周').replace(/周天/g, '周日');
  const set = new Set();
  let rest = s;
  for (const m of s.matchAll(/周([一二三四五六日])\s*(?:至|到|~|～|-|–|—)\s*周?([一二三四五六日])/g)) {
    let a = DAY[m[1]];
    const b = DAY[m[2]];
    for (let n = 0; n < 7; n++) {
      set.add(a);
      if (a === b) break;
      a = (a % 7) + 1;
    }
    rest = rest.replace(m[0], ' ');
  }
  for (const m of rest.matchAll(/周([一二三四五六日](?:[、和及,，\s]*周?[一二三四五六日])*)/g)) for (const c of m[1]) if (DAY[c]) set.add(DAY[c]);
  if (/周末/.test(s)) [6, 7].forEach((d) => set.add(d));
  if (/工作日|平日/.test(s)) [1, 2, 3, 4, 5].forEach((d) => set.add(d));
  return set;
};
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const DAY_NAME = ['', '一', '二', '三', '四', '五', '六', '日'];
const NUM_TOKEN = /\d{1,2}[:：]\d{2}|\d{4}[-./年]\d{1,2}(?:[-./月]\d{1,2}日?)?|\d{1,2}[-./月]\d{1,2}日?(?=\s*[至到~～\-–—])|(\d+(?:\.\d+)?)/g;
const plainNums = (s) => {
  const out = [];
  for (const m of String(s).matchAll(NUM_TOKEN)) if (m[1] !== undefined) out.push({v: Number(m[1]), idx: m.index, raw: m[1]});
  return out;
};
const COUPON_RE = /领[^，。；、]{0,8}?券后?|券后|满\s*\d+\s*减\s*\d+|满减后?|会员价|首单|新客|新人价?|拼团/;
const SURCHARGE_RE = /另计|另收|加收|附加费|服务费|加价|另付|[+＋]\s*\d+\s*元/;
const PERIOD_RE = /\d{1,4}[-./年月]\d{1,2}[^，。；]{0,6}?[至到~～\-–—]\s*\d|活动时间|活动期间|国庆期间|限时/;
const QTY_RE = /(\d+(?:\.\d+)?)\s*(小时|分钟|个月|天|晚|次|节|课时)/g;
function checkQualifiers(sb, meta, texts, lang, err) {
  if (lang !== 'zh') return;
  const {all} = splitFacts(meta);
  if (!all.length) return;
  const clauses = [];
  for (const f of all)
    for (const c of f.text.replace(/（[^）]*）|\([^)]*\)/g, (m) => m.replace(/[，,；;。]/g, ' ')).split(/[，,；;。：:\n]/)) if (c.trim()) clauses.push({id: f.id, text: c.trim()});
  const notices = (Array.isArray(meta?.notices) ? meta.notices : []).filter((x) => typeof x === 'string').join(' ');
  const shots = Array.isArray(sb?.shots) ? sb.shots : [];
  const strLeaves = (o, out = []) => {
    if (typeof o === 'string') out.push(o);
    else if (Array.isArray(o)) o.forEach((x) => strLeaves(x, out));
    else if (o && typeof o === 'object') for (const [k, x] of Object.entries(o)) if (!['icon', 'src', 'illust', 'source', 'evidence', 'itemId', 'refs', 'layout', 'kind', 'visual', 'tone', 'mode'].includes(k)) strLeaves(x, out);
    return out;
  };
  const reported = new Set();
  shots.forEach((sh, i) => {
    if (!sh || typeof sh !== 'object') return;
    // 旁白（vo）念出来的数字同样要带上限定语；限定语写在字幕、画面或旁白里都算
    const vo = typeof sh.vo === 'string' ? sh.vo : null;
    const shotAll = [...[sh.caption].flat().filter((x) => typeof x === 'string'), ...(vo ? [vo] : []), ...strLeaves(sh.params ?? {})].join(' ').replace(/[{}]/g, '');
    const pool = `${shotAll} ${notices}`;
    // 屏幕上的数字：{v, local（紧挨着它的那几个字）, obj（同一个对象里的其他字）, where, text}
    const hits = [];
    const visit = (node, field) => {
      if (Array.isArray(node)) return node.forEach((x, k) => visit(x, `${field}[${k}]`));
      if (!node || typeof node !== 'object') return;
      const own = Object.entries(node).filter(([k, x]) => typeof x === 'string' && !['icon', 'src', 'illust', 'source', 'evidence', 'itemId', 'layout', 'kind', 'visual', 'tone', 'mode'].includes(k));
      const ownArr = Object.values(node).filter((x) => Array.isArray(x) && x.every((y) => typeof y === 'string')).flat();
      const objText = [...own.map(([, x]) => x), ...ownArr].join(' ').replace(/[{}]/g, '');
      const strs = [...own];
      for (const [k, x] of Object.entries(node)) if (Array.isArray(x)) x.forEach((y, j) => typeof y === 'string' && strs.push([`${k}[${j}]`, y]));
      for (const [k, x] of strs)
        for (const n of plainNums(x)) {
          const part = x.replace(/[{}]/g, '').split(/[，,；;。]/).find((p) => p.includes(n.raw)) ?? x;
          hits.push({v: n.v, raw: n.raw, local: part, obj: objText, where: whereOf(i, sh.type, `${field}.${k}`), text: x});
        }
      for (const [k, x] of Object.entries(node)) {
        if (typeof x === 'number' && ['price', 'to', 'value'].includes(k) && x !== 0)
          hits.push({v: x, raw: String(x), local: objText, obj: objText, where: whereOf(i, sh.type, `${field}.${k}`), text: `${x}${node.unit ? node.unit : ''}${node.from === true ? '起' : ''}`, from: node.from === true});
        if (x && typeof x === 'object') visit(x, `${field}.${k}`);
      }
    };
    visit(sh.params ?? {}, 'params');
    [sh.caption].flat().forEach((c, k) => {
      if (typeof c !== 'string') return;
      const cw = Array.isArray(sh.caption) ? `caption[${k}]` : 'caption';
      for (const n of plainNums(c)) hits.push({v: n.v, raw: n.raw, local: c.replace(/[{}]/g, ''), obj: c.replace(/[{}]/g, ''), where: whereOf(i, sh.type, cw), text: c});
    });
    if (vo) for (const n of plainNums(vo)) hits.push({v: n.v, raw: n.raw, local: vo.replace(/[{}]/g, ''), obj: vo.replace(/[{}]/g, ''), where: whereOf(i, sh.type, 'vo'), text: vo});
    for (const h of hits) {
      const cl = clauses.filter((c) => plainNums(c.text).some((n) => n.v === h.v));
      if (!cl.length) continue;
      const problems = [];
      for (const c of cl) {
        const need = [];
        // (a) 周几范围
        const D = parseDays(c.text);
        if (D.size) {
          const L = parseDays(h.local).size ? parseDays(h.local) : parseDays(h.obj.replace(/[^，,；;。\s]*\d[^，,；;。\s]*/g, ' '));
          const DAY_PHRASE = /(?:星期|周)[一二三四五六日天](?:\s*[至到~～\-–—、和及]?\s*(?:星期|周)?[一二三四五六日天])*|周末|工作日|平日/g;
          const want = (c.text.match(DAY_PHRASE) ?? [''])[0];
          const got = [...new Set([...(h.local.match(DAY_PHRASE) ?? []), ...(parseDays(h.local).size ? [] : h.obj.match(DAY_PHRASE) ?? [])])].join('、') || [...L].sort().map((d) => '周' + DAY_NAME[d]).join('');
          if (L.size && !sameSet(L, D)) need.push({msg: `这里的「${got}」和 facts 里的「${want}」不是同一段日子`, fix: `照抄 facts 里的「${want}」`});
          else if (!L.size && ![...D].every((d) => parseDays(pool).has(d))) need.push({msg: `没写 facts 里跟着它的「${want}」`, fix: `在这一镜（或 meta.notices）写上「${want}」`});
        }
        if (/节假日/.test(c.text) && !/节假日/.test(pool)) need.push({msg: '没写 facts 里的「节假日」', fix: '在这一镜或 meta.notices 写上「节假日」'});
        // (d) 券后 / 满减 / 会员
        const cp = COUPON_RE.exec(c.text);
        if (cp && !/券|满减|满\s*\d+\s*减|会员|首单|新客|新人|拼团/.test(pool)) {
          const bare = /现价|只要|仅需|只需|到手|直降/.exec(h.local);
          need.push({msg: `facts 里这个价是「${cp[0]}」的价${bare ? `，这里却写成「${bare[0]}」` : '，画面上没写这个条件'}`, fix: `写成「${cp[0].replace(/后?$/, '后')}${h.raw}元」这样带条件的说法（priceCard 用 label:"券后价" + conditions）`});
        }
        // 起价
        if (new RegExp(`${h.raw.replace('.', '\\.')}\\s*(元|块)?\\s*(/\\s*\\S)?\\s*起`).test(c.text) && !h.from && !/起/.test(h.local))
          need.push({msg: `facts 里是「${h.raw}元起」，这里丢了「起」`, fix: '价格后面补「起」（priceCard 的这一项写 "from": true）'});
        // 附加费
        const sc = SURCHARGE_RE.exec(c.text);
        if (sc && !SURCHARGE_RE.test(pool) && !/另|加收|附加|服务费|加价|[+＋]\s*\d/.test(pool)) need.push({msg: `facts 里还有「${sc[0]}」，画面上没写`, fix: `把「${sc[0]}」写进这一镜或 meta.notices`});
        // 活动时间
        const pd = PERIOD_RE.exec(c.text);
        if (pd && !/\d{1,2}[-./月]\d{1,2}|期间|截至|限时|活动时间/.test(pool)) need.push({msg: 'facts 里这个数有活动时间限制，画面上没写', fix: '把活动时间写进这一镜（priceCard 用 period）或 meta.notices'});
        // (b/c) 时长 / 次数等数量限定：fact 里跟着的「6小时」「3次」也要上屏
        for (const q of c.text.matchAll(QTY_RE)) {
          if (Number(q[1]) === h.v) continue;
          if (!new RegExp(`${q[1].replace('.', '\\.')}\\s*${q[2]}`).test(pool)) need.push({msg: `facts 里这个数跟着「${q[0]}」，画面上没写`, fix: `写成带「${q[0]}」的完整说法（如「${q[0]}后还有${h.raw}${/℃|°/.test(c.text) ? '℃' : ''}」）`});
        }
        if (!need.length) {
          problems.length = 0;
          break; // 有一条 fact 的限定语全都对上了就算过
        }
        problems.push(...need);
      }
      if (!problems.length) continue;
      const key = `${h.where}|${h.v}`;
      if (reported.has(key)) continue;
      reported.add(key);
      err(h.where, `「${h.text.replace(/[{}\n]/g, '')}」里的 ${h.raw} 和 facts 对上了，但限定语丢了：${problems.map((p) => p.msg).join('；')}`, `${[...new Set(problems.map((p) => p.fix))].join('；')}。限定语（日期范围、券后、时长、次数、附加费）必须和数字出现在同一镜或底部提示条里`);
    }
  });
  // (c) 全天/24 小时：facts 只给了更短的时长
  const factAll = all.map((f) => f.text).join(' ');
  if (!/全天|整天|24\s*小时|24h|全天候/i.test(factAll)) {
    const shortH = [...factAll.matchAll(/(\d+(?:\.\d+)?)\s*(小时|h(?![a-z]))/gi)].map((m) => Number(m[1])).filter((n) => n < 24);
    const hours = /\d{1,2}[:：]\d{2}\s*[-–—~至到]\s*\d{1,2}[:：]\d{2}/.exec(factAll);
    const maxH = shortH.length ? Math.max(...shortH) : 0;
    if (shortH.length || hours)
      for (const t of texts) {
        const m = /全天候?|整天|一整天|24\s*小时|24h/i.exec(String(t.text));
        if (m) err(t.where, `「${m[0]}」比 facts 说的长：facts 里是「${maxH ? maxH + '小时' : hours[0]}」`, `照抄 facts 的时长，如写「${maxH ? maxH + '小时后还有…' : hours[0]}」，不要写「${m[0]}」`);
      }
  }
  // (b) 「四样/三样招牌」：要和 priceCard 的 includes 条数一致
  const incl = shots.filter((s) => s?.type === 'priceCard' && Array.isArray(s.params?.includes)).map((s) => s.params.includes.length);
  if (incl.length)
    for (const t of texts) {
      const m = /(\d+|[两二三四五六七八九十])\s*样(?![式子本品板])/.exec(plain(t.text));
      if (!m) continue;
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : {两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10}[m[1]];
      if (!incl.includes(n)) err(t.where, `「${m[0]}」和套餐 includes 的 ${incl.join('/')} 样对不上`, `照 priceCard 的 includes 数：写「${incl[0]}样」，或者别写数量`);
    }
  // (e) 入住/退房「灵活/随时/不限」：facts 给了固定时间或加价
  const fixedCI = /(入住|退房|离店)[^，。；]{0,6}\d{1,2}[:：]\d{2}|\d{1,2}[:：]\d{2}[^，。；]{0,4}(入住|退房|离店)|(延迟|延时)退房/.exec(factAll);
  if (fixedCI)
    for (const t of texts) {
      const m = /(灵活|随时|不限时?|自由)[^，。]{0,3}(入住|退房|离店)|(入住|退房|离店)[^，。]{0,4}(灵活|随时|不限|自由)/.exec(String(t.text));
      if (m) err(t.where, `「${m[0]}」和 facts 对不上：facts 里是「${fixedCI[0]}」`, `照抄 facts 的时间和加价，如「12:00 退房，延迟退房另收费」，不要写「灵活/随时/不限」`);
    }
}

// ---- 11. 近似词 / 不成词（「我们好像没那么相懂」）：只提醒 ----
function checkNearWords(texts, lang, warn) {
  if (lang !== 'zh') return;
  for (const t of texts) {
    const s = plain(t.text);
    for (const n of NEAR_WORDS_ZH) {
      if (!(n.re ? n.re.test(s) : s.includes(n.w))) continue;
      warn(t.where, `「${n.w}」不是常用词，像是压字数时凑出来的`, `换成顺口的说法，如「${n.w}」→「${n.fix}」；整句读一遍再定`);
    }
  }
}

/**
 * @param {any} storyboard 解析后的 storyboard.json
 * @param {{baseDir: string, specs: Record<string, any>, texts: {where: string, text: string, caption?: boolean}[],
 *          assets: {where: string, rel: string, abs: string}[], slots: any[], beat: number, meta: any}} ctx
 * @returns {{errors: {where: string, problem: string, fix: string}[], warnings: {where: string, problem: string, fix: string}[], human: {where: string, problem: string, fix: string}[]}}
 */
export function runTextChecks(storyboard, ctx) {
  const errors = [];
  const warnings = [];
  const human = [];
  const err = (where, problem, fix) => errors.push({where, problem, fix});
  const warn = (where, problem, fix) => warnings.push({where, problem, fix});

  const texts = Array.isArray(ctx?.texts) ? ctx.texts : [];
  const meta = ctx?.meta ?? storyboard?.meta ?? {};
  const lang = meta?.lang === 'en' ? 'en' : 'zh';

  checkShotDirections(texts, ctx?.specs ?? {}, err);
  checkTypoAndClaims(texts, lang, err, warn);
  checkAsciiPunctInZh(texts, lang, err);
  checkActionDemo(texts, meta, lang, err);
  checkOrphans(storyboard, lang, err);
  checkLeadMarkers(storyboard, lang, err);
  checkSemanticFit(storyboard, meta, lang, err);
  checkNoticeDup(meta, lang, err);
  checkQualifiers(storyboard, meta, texts, lang, err);
  checkNearWords(texts, lang, warn);

  return {errors, warnings, human};
}
