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
import {TYPO_ZH, TYPO_EN, ABS_CLAIM_ZH, ABS_CLAIM_ZH_PATTERNS, ABS_CLAIM_EN, SPELLED_NUM_EN_RE} from './typo-list.mjs';

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
    err(t.where, `字幕${why}`, `字幕是说给观众的话，讲用户的处境或产品带来的变化，不要描述画面怎么动。可以按这个句型改写：「${fillin}」`);
  }
}

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
      if (/[㐀-鿿]/.test(s)) err(t.where, `English video (meta.lang: "en") but this text contains Chinese characters: "${s}"`, 'Translate this field to English, or check whether a component is hard-coding Chinese text here');
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

  return {errors, warnings, human};
}
