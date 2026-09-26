// ============================================================
// 按字宽估算自动缩字号（不依赖字体加载，渲染和校验结果一致）
//   汉字/全角 = 1em，拉丁字母/数字/半角标点 = 0.55em，空格 = 0.3em
// ============================================================

const isWide = (cp: number) =>
  (cp >= 0x2e80 && cp <= 0x9fff) || // CJK 部首/汉字/标点
  (cp >= 0xac00 && cp <= 0xd7af) || // 韩文
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xff60) || // 全角 ASCII
  (cp >= 0xffe0 && cp <= 0xffe6) ||
  (cp >= 0x3000 && cp <= 0x303f) || // 中文标点
  cp === 0x201c ||
  cp === 0x201d ||
  cp === 0x2018 ||
  cp === 0x2019 ||
  cp === 0x2026 || // …
  cp === 0x00b7; // ·

/** 一行字的宽度（单位 em）。WORD_JOINER（glueBreaks 插入的零宽不换行符）不占宽度，一并去掉 */
export const emWidth = (text: string): number => {
  let w = 0;
  for (const ch of Array.from(text.replace(/[{}⁠]/g, ''))) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === ' ') w += 0.3;
    else if (isWide(cp)) w += 1;
    else w += 0.55;
  }
  return w;
};

/** 「字数」：汉字 1、拉丁半个（validate.mjs 用同一规则） */
export const charUnits = (text: string): number => {
  let n = 0;
  for (const ch of Array.from(text.replace(/[{}⁠]/g, ''))) {
    const cp = ch.codePointAt(0) ?? 0;
    n += isWide(cp) ? 1 : 0.5;
  }
  return n;
};

// ============================================================
// 安全换行：中文只在「词」与「词」之间断行，英文本身按单词间空格换行、不拆单词，
// {} 强调段内部整体不断开。
//
// 做法：往词/强调段内部相邻字符间插入 WORD JOINER（U+2060，零宽、Unicode 行断类 WJ——
// 断行算法规定此处禁止断开）。中文分词用 Intl.Segmenter('zh', {granularity:'word'})，
// Node 18+/22 和 Remotion 用的 Chrome 都原生支持。标点避头尾（闭合标点不落行首、开启标点不落行尾）
// 是浏览器默认断行算法（UAX #14）本来就有的行为，只要渲染容器不写 `wordBreak: 'break-all'` /
// `'break-word'`（那会强制逐字断行，把这条也覆盖掉），保留默认的 `wordBreak: 'normal'` 即可。
//
// 用法：渲染前把上屏文字过一遍 glueBreaks()，容器样式配 `wordBreak: 'normal'`（不要 break-all）。
// 单行定宽（whiteSpace: 'nowrap'）的文字本来就不会换行，过不过 glueBreaks 都一样，可以不调用。
//
// Node（scripts/make.mjs 的「文字排版报告」）不能直接 import 这个 .ts 文件，那边复刻了一份判断
// 「是不是多字词」的最小逻辑；改这里的分词/标点规则要同步改那边。
// ============================================================

/** 零宽、禁止此处换行（Unicode Word Joiner） */
export const WORD_JOINER = '⁠';

export type WrapLang = 'zh' | 'en';

// tsconfig 的 lib 是 ES2020，类型里还没有 Intl.Segmenter（ES2022+ 提案）；运行时 Node 18+/22 和
// Remotion 用的 Chrome 都已支持，这里手写一个最小类型、运行时探测，不改 tsconfig
type SegmenterLike = {segment(input: string): Iterable<{segment: string}>};
type IntlWithSegmenter = {Segmenter?: new (locale: string, opts: {granularity: 'word'}) => SegmenterLike};

let zhWordSegmenter: SegmenterLike | undefined;
const getZhWordSegmenter = (): SegmenterLike | undefined => {
  try {
    const Ctor = (Intl as unknown as IntlWithSegmenter).Segmenter;
    if (typeof Ctor !== 'function') return undefined;
    return (zhWordSegmenter ??= new Ctor('zh', {granularity: 'word'}));
  } catch {
    return undefined;
  }
};

/** 是不是「表意字」（判断一个分词结果算不算值得保护的「词」，标点、拉丁字母都不算） */
const isIdeograph = (cp: number) => (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff);

const glueChars = (run: string): string => Array.from(run).join(WORD_JOINER);

/**
 * 把一段可能会自动换行的文字，转成「安全换行」文字：词内、{} 强调段内部插入 WORD_JOINER，
 * 换行只会落在词与词之间。\n 原样保留（手动换行不受影响）。
 * 渲染容器要配 `wordBreak: 'normal'`（默认值，不要 'break-all' / 'break-word'）。
 * @param lang 'zh'（默认）按 Intl.Segmenter 分词保护；'en' 时英文单词本身空格分隔、交给浏览器，
 *             这里只处理 {} 强调段，不额外插入字符
 */
export const glueBreaks = (text: string, lang: WrapLang = 'zh'): string => {
  if (!text) return text;
  // 按 {...} 和 \n 切开，分别处理：{} 内（含花括号本身）整体粘住，\n 原样保留
  const parts = text.split(/(\{[^{}]*\}|\n)/);
  return parts
    .map((part) => {
      if (!part || part === '\n') return part;
      if (part.charCodeAt(0) === 0x7b && part.charCodeAt(part.length - 1) === 0x7d) {
        // '{' ... '}'：强调段整体不断开，含首尾花括号一起粘
        return glueChars(part);
      }
      if (lang !== 'zh') return part;
      const seg = getZhWordSegmenter();
      if (!seg) return part;
      let out = '';
      for (const {segment} of seg.segment(part)) {
        const chars = Array.from(segment);
        const isWord = chars.length >= 2 && chars.some((c) => isIdeograph(c.codePointAt(0) ?? 0));
        out += isWord ? glueChars(segment) : segment;
      }
      return out;
    })
    .join('');
};

/**
 * 让多行文字在 maxW 宽内放下的最大字号。
 * @param text 可含 \n 和 {}
 * @param maxW 可用宽度 px
 * @param max 字号上限
 * @param min 字号下限（放不下也不再缩，交给校验拦字数）
 * @param pad 额外留白 px（描边外扩等）
 */
export const fitSize = (text: string, maxW: number, max: number, min: number, pad = 0): number => {
  const lines = text.split('\n');
  const em = Math.max(0.01, ...lines.map(emWidth));
  return Math.max(min, Math.min(max, Math.floor((maxW - pad) / em)));
};

/** 单行：放不下时返回的字号（常用于卡片标题、按钮） */
export const fitLine = (text: string, maxW: number, max: number, min: number) => fitSize(text.replace(/\n/g, ''), maxW, max, min);
