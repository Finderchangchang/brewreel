/** 横版版心。版式只从这里取几何。竖版不读这些数。 */
import {emWidth, titleLines} from '../../../scripts/lesson/title-wrap.mjs';

export const CANVAS = {w: 1920, h: 1080};
export const MARGIN_X = 120;
export const CHAPTER_TOP = 96;
export const TITLE_TOP = 150;
export const TITLE_PX = 68;
export const TITLE_BAND = 150;
export const MIN_BODY = 30;

/** 内容区：x 120–1800，y 300–880。右下角另有讲解员保留区。 */
export const CONTENT = {x: 120, y: 300, right: 1800, bottom: 880};
/** x ≥ 1600 且 y ≥ 810 不放版式内容。 */
export const RESERVE = {x: 1600, y: 810};

export const AVATAR_D = 210;
export const AVATAR_RIGHT = 96;
export const AVATAR_BOTTOM = 52;
export const AVATAR = {
  x: CANVAS.w - AVATAR_RIGHT - AVATAR_D,
  y: CANVAS.h - AVATAR_BOTTOM - AVATAR_D,
  w: AVATAR_D,
  h: AVATAR_D,
};
export const COVER_AVATAR_D = 360;
export const COVER_AVATAR = {x: CANVAS.w - MARGIN_X - COVER_AVATAR_D, y: 280, w: COVER_AVATAR_D, h: COVER_AVATAR_D};
export const COVER_MORPH_MS = 400;

/** 翻页：上一页 0.2 秒淡出并上移，下一页从 0.12 秒起用 0.3 秒淡入。线性下两页文字的重叠峰值约 0.16，低于 0.25。 */
export const TURN_OUT_MS = 200;
export const TURN_IN_DELAY_MS = 120;
export const TURN_IN_MS = 300;
export const TURN_SHIFT_PX = 12;
export const TURN_MAX_OVERLAP = 0.25;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

export function pageTurnAt(tMs) {
  const t = Number.isFinite(tMs) ? tMs : 0;
  const outP = t <= 0 ? 1 : t >= TURN_OUT_MS ? 0 : 1 - t / TURN_OUT_MS;
  const inP = clamp01((t - TURN_IN_DELAY_MS) / TURN_IN_MS);
  return {
    outgoing: {opacity: outP, dy: outP >= 1 ? 0 : -TURN_SHIFT_PX * (1 - outP)},
    incoming: {opacity: inP, dy: inP >= 1 ? 0 : TURN_SHIFT_PX * (1 - inP)},
  };
}

/** 第一页从第一帧就在，不淡入。退场走上一页曲线，进场走下一页曲线。 */
export function contentMotion({first = false, inTail = false, tMs = 0} = {}) {
  if (inTail) return pageTurnAt(tMs).outgoing;
  if (first) return {opacity: 1, dy: 0};
  return pageTurnAt(tMs).incoming;
}

/** 上一页内容要画进下一页开头，直到淡出结束的那一帧。 */
export function turnOutFrames(fps = 30) {
  const rate = fps > 0 ? fps : 30;
  return Math.floor((TURN_OUT_MS / 1000) * rate) + 1;
}

/** 两页内容都不在画上的毫秒。进场早于退场结束时是 0。 */
export function contentBlankMs(fps = 30) {
  const rate = fps > 0 ? fps : 30;
  const frames = Math.ceil(((TURN_IN_DELAY_MS + TURN_IN_MS) / 1000) * rate) + 1;
  let blank = 0;
  let run = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const turn = pageTurnAt((frame * 1000) / rate);
    if (turn.outgoing.opacity <= 0 && turn.incoming.opacity <= 0) run += 1;
    else {
      blank = Math.max(blank, run);
      run = 0;
    }
  }
  return (Math.max(blank, run) * 1000) / rate;
}

/** 普通页的章节行。封面、章节页、品牌收尾和品牌总结页没有这行。 */
export function chapterLineKey(page, options = {}) {
  if (!page) return null;
  if (page.layout === 'cover' || page.layout === 'chapter' || page.layout === 'brandEnd') return null;
  if (options.brandRecapIndex != null && page.index === options.brandRecapIndex) return null;
  const kind = page.layout === 'question' ? 'quiz' : 'chapter';
  return `${kind}:${page.chapterIndex ?? 0}:${page.chapterTitle ?? ''}`;
}

export function sameChapterLine(a, b, options) {
  const left = chapterLineKey(a, options);
  const right = chapterLineKey(b, options);
  return Boolean(left && left === right);
}

/** 同章翻页时章节行保持 1。换章时跟着标题的那一侧走。 */
export function chapterLineOpacity({sameChapter = false, role = 'steady', tMs = 0} = {}) {
  if (sameChapter) return 1;
  const turn = pageTurnAt(tMs);
  if (role === 'outgoing') return turn.outgoing.opacity;
  if (role === 'incoming') return turn.incoming.opacity;
  return 1;
}

/** stable 不动；turn 跟着这一侧淡；none 不画，避免同章两行叠成「011」。 */
export function chapterLineMode({key = null, first = false, inTail = false, holdPrev = false, holdNext = false, tMs = 0} = {}) {
  if (!key) return 'none';
  if (inTail) return holdNext ? 'none' : 'turn';
  if (!first && !holdPrev && tMs < TURN_IN_DELAY_MS + TURN_IN_MS) return 'turn';
  return 'stable';
}

/** 有品牌角标时，章节行和标题一起下移的量。各版式只加这一处，不再各写各的。 */
export const BUG_OFFSET = 30;
export const BUG = {left: MARGIN_X, top: 44, logo: 46, gap: 14, font: 26, tracking: 3};
export const NAMEBAR_TOTAL_MS = 4000;
export const NAMEBAR_SLIDE_MS = 300;
export const NAMEBAR = {right: AVATAR_RIGHT, bottom: 290};

export function headerShift(withBug = false) {
  return withBug ? BUG_OFFSET : 0;
}

/** 姓名条 4 秒：0.3 秒从右侧滑入，停住，再 0.3 秒滑出。页比 4 秒短就跟页走。 */
export function nameBarSlide(localMs, pageMs) {
  const total = Math.min(NAMEBAR_TOTAL_MS, Math.max(0, pageMs));
  const hidden = {visible: false, x: 40, opacity: 0};
  if (!(localMs >= 0) || localMs >= total || total <= 0) return hidden;
  const slide = Math.min(NAMEBAR_SLIDE_MS, total / 2);
  if (localMs < slide) {
    const p = slide === 0 ? 1 : localMs / slide;
    return {visible: true, x: 40 * (1 - p), opacity: p};
  }
  if (localMs > total - slide) {
    const p = slide === 0 ? 0 : (total - localMs) / slide;
    return {visible: true, x: 40 * (1 - p), opacity: Math.max(0, p)};
  }
  return {visible: true, x: 0, opacity: 1};
}

/** 姓名条实际占位。宽度按姓名、职称、律所行的字宽算，不写死 1240。 */
export function nameBarMetrics({name = '', title = '', firmLine = ''} = {}) {
  const namePx = 40;
  const titlePx = 26;
  const firmPx = 26;
  const mainW = 30 + emWidth(name) * namePx + 12 + emWidth(title) * titlePx + 30;
  const firmW = 6 + 28 + emWidth(firmLine) * firmPx + 28;
  const width = mainW + firmW;
  const height = 16 + namePx + 16;
  const right = CANVAS.w - NAMEBAR.right;
  const bottom = CANVAS.h - NAMEBAR.bottom;
  return {x: right - width, y: bottom - height, width, height, right, bottom};
}

/** 姓名条那一页的保留区：姓名条和讲解员圆的并集。其他页仍用 RESERVE。 */
export function nameBarReserve(metrics) {
  return {x: Math.min(metrics.x, AVATAR.x), y: Math.min(metrics.y, AVATAR.y)};
}

export const SUBTITLE = {
  centerX: 900,
  maxWidth: 1280,
  bottom: 64,
  fontPx: 40,
  minFont: MIN_BODY,
  padX: 34,
  padY: 12,
  lineHeight: 1.4,
};

const linChan = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const hexRgb = (hex) => {
  const h = String(hex).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/** WCAG 对比度。色值要是不透明的 #RRGGBB。折线和 scripts/lib 的品牌对比同一条 0.03928。 */
export function contrastRatio(fg, bg) {
  const L = (hex) => {
    const [r, g, b] = hexRgb(hex).map(linChan);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = L(fg);
  const b = L(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const mixHex = (fg, bg, t) => {
  const a = hexRgb(fg);
  const b = hexRgb(bg);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};

/** 往底色掺，掺到对比度仍 ≥ min 的最淡一档。讲过的字用原色，没讲到的字用这一档。 */
function dimKeepContrast(fg, bg, min = 4.5) {
  let best = fg;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    const mixed = mixHex(fg, bg, mid);
    if (contrastRatio(mixed, bg) >= min - 1e-6) {
      best = mixed;
      lo = mid;
    } else hi = mid;
  }
  return best;
}

/**
 * 横版字幕条跟主题走：底和字用该主题的 badge 实色（和片头「AI生成合成」同一对），不用统一的半透明黑底。
 * 圆角用主题 radius，不用 badge 的胶囊圆角。
 */
export function subtitleChrome(token) {
  const background = token.badgeBg;
  const color = token.badgeFg;
  return {
    background,
    color,
    radius: token.radius,
    karaokeSpoken: color,
    karaokeRest: dimKeepContrast(color, background, 4.5),
  };
}

/** 伸进右下角的那一排，右缘收到这里，不再把整块内容抬到 y=810。 */
export const RESERVE_ROW_RIGHT = 1580;

/** 全宽内容可以用到 y=880。只有右下角那一块不能进。截图和代码靠左。封面文字停在大圆左边。 */
export const STAGE = {
  standard: {x: 120, y: 300, width: 1680, height: 580},
  wide: {x: 120, y: 300, width: 1680, height: 580},
  tall: {x: 120, y: 300, width: 1470, height: 570},
  side: {x: 120, y: 300, width: 1140, height: 510},
  cover: {x: 120, y: 300, width: 1260, height: 510},
};

export const LAYOUT_NAMES = ['cover', 'steps', 'chapter', 'quote', 'compare', 'question', 'flow', 'recap', 'screenshot', 'code', 'points', 'statement', 'timeline', 'checklist', 'bignumber', 'saying', 'levels', 'case', 'document', 'table'];

export function contentFrame(layout) {
  if (layout === 'cover') return STAGE.cover;
  if (layout === 'screenshot' || layout === 'code') return STAGE.tall;
  return STAGE.standard;
}

export function intersectsReserve(box, reserve = RESERVE) {
  const w = box.w ?? box.width ?? 0;
  const h = box.h ?? box.height ?? 0;
  const rx = reserve?.x ?? RESERVE.x;
  const ry = reserve?.y ?? RESERVE.y;
  return box.x < CANVAS.w && box.x + w > rx && box.y < CANVAS.h && box.y + h > ry;
}

export function insideContent(box) {
  const w = box.w ?? box.width ?? 0;
  const h = box.h ?? box.height ?? 0;
  return box.x >= CONTENT.x - 0.01
    && box.y >= CONTENT.y - 0.01
    && box.x + w <= CONTENT.right + 0.01
    && box.y + h <= CONTENT.bottom + 0.01
    && !intersectsReserve(box);
}

export function fitBlockFont({chars, width, maxFont, lineHeight, maxHeight, minFont = MIN_BODY}) {
  const n = Math.max(1, chars | 0);
  let font = maxFont;
  while (font > minFont) {
    const per = Math.max(1, Math.floor(width / font));
    if (Math.ceil(n / per) * font * lineHeight <= maxHeight) return font;
    font -= 1;
  }
  return minFont;
}

/** 短标题保持 68。长标题缩小，两到三行停在 y 150–300 的标题带里。 */
export function titleFontPx(text, width = 1680) {
  const chars = Math.max(1, Array.from(String(text ?? '')).length);
  const lineH = 1.15;
  if (chars * TITLE_PX <= width) return TITLE_PX;
  for (let lines = 2; lines <= 3; lines += 1) {
    const font = Math.min(TITLE_PX, Math.floor(TITLE_BAND / (lines * lineH)));
    const per = Math.max(1, Math.floor(width / Math.max(1, font)));
    if (Math.ceil(chars / per) <= lines) return Math.max(MIN_BODY, font);
  }
  return Math.max(MIN_BODY, Math.floor(TITLE_BAND / (3 * lineH)));
}

/** 底部居中字幕条。放得下一行就一行，底条按这一行的字宽收；超出才折成两行。 */
export function subtitleLayout(text) {
  const raw = String(text ?? '').replace(/\u2060/gu, '').replace(/[ \t]+/gu, ' ').trim();
  const innerMax = SUBTITLE.maxWidth - SUBTITLE.padX * 2;
  const choose = (px) => {
    if (!raw) return [''];
    const maxEm = innerMax / px;
    if (emWidth(raw) <= maxEm + 1e-6) return [raw];
    const lines = titleLines(raw, {maxEm, maxLines: 2, subtitle: true});
    return lines.length ? lines : [raw];
  };
  let font = SUBTITLE.fontPx;
  let lines = choose(font);
  const lineFits = (px, rows) => rows.every((line) => emWidth(line) * px <= innerMax + 1e-6);
  while (font > SUBTITLE.minFont && !lineFits(font, lines)) {
    font -= 1;
    lines = choose(font);
  }
  const widest = Math.max(1, ...lines.map((line) => emWidth(line) * font));
  let width = Math.ceil(widest + SUBTITLE.padX * 2);
  if (width + 4 <= SUBTITLE.maxWidth) width += 4;
  width = Math.min(SUBTITLE.maxWidth, width);
  const linePx = font * SUBTITLE.lineHeight;
  const height = Math.ceil(lines.length * linePx + SUBTITLE.padY * 2);
  const x = SUBTITLE.centerX - width / 2;
  const y = CANVAS.h - SUBTITLE.bottom - height;
  return {x, y, width, height, font, lines, lineHeight: SUBTITLE.lineHeight};
}

const zh = (n) => '字'.repeat(n);

const QUOTE_PAD_X = 56;
const QUOTE_PAD_Y = 44;

/** 法条卡高度贴着原文、出处和可选底栏，上下内边距各 44。 */
export function quoteBlockSize(quote, source, {width = 1680, tag = true} = {}) {
  const inner = Math.max(1, width - QUOTE_PAD_X * 2);
  const block = (text, font, lineHeight) => {
    const em = emWidth(String(text ?? ''));
    const per = inner / Math.max(1, font);
    const lines = Math.max(1, Math.ceil((em - 1e-6) / per));
    return lines * font * lineHeight;
  };
  const sourceH = Math.max(40, block(source, TYPE.quoteSource, 1.4));
  const quoteH = block(quote, TYPE.quote, 1.55);
  const tagH = tag ? 28 + TYPE.quoteTag * 1.2 : 0;
  return {width, inner, sourceH, quoteH, tagH, height: QUOTE_PAD_Y * 2 + sourceH + 18 + quoteH + tagH};
}

/** 稿件契约里的最长文案。和样张字号冲突时以字号为准，契约已收紧。 */
export function longestCopy(layout) {
  if (layout === 'cover') return {title: zh(12), subtitle: zh(16)};
  if (layout === 'steps') return {items: 4, item: zh(14)};
  if (layout === 'chapter') return {title: zh(6), point: zh(8)};
  if (layout === 'quote') return {quote: zh(100), source: zh(30)};
  if (layout === 'compare') return {head: zh(12), item: zh(16), verdict: zh(10)};
  if (layout === 'question') return {option: zh(10)};
  if (layout === 'bignumber') return {number: '8', name: zh(8), card: zh(14)};
  if (layout === 'saying') return {line: zh(12)};
  if (layout === 'levels') return {text: zh(16)};
  if (layout === 'case') return {line: zh(16), verdict: zh(12)};
  if (layout === 'document') return {point: zh(12), zoom: zh(8)};
  if (layout === 'table') return {situation: zh(16), result: zh(8), basis: zh(24)};
  if (layout === 'flow') return {title: zh(5), point: zh(8)};
  if (layout === 'points') return {title: zh(6), text: zh(20)};
  if (layout === 'statement') return {line: zh(7), basis: zh(24), prop: zh(16)};
  if (layout === 'timeline') return {node: zh(4), quote: zh(40)};
  if (layout === 'checklist') return {item: zh(16)};
  if (layout === 'recap') return {item: zh(14)};
  if (layout === 'screenshot') return {label: zh(12)};
  if (layout === 'code') return {line: zh(48)};
  return {};
}

/** 样张字号。版式组件和包围盒共用这一份，避免测试过了画面又缩回去。 */
export const TYPE = Object.freeze({
  quote: 50,
  quoteSource: 28,
  quoteTag: 44,
  pointsTitle: 48,
  pointsBody: 32,
  pointsIndex: 72,
  pointsIcon: 96,
  statement: 104,
  statementBasis: 30,
  propTitle: 64,
  propLine: 34,
  compareTitle: 54,
  compareVerdict: 62,
  compareIcon: 104,
  flowTitle: 50,
  flowPoint: 32,
  flowIcon: 80,
  timelineNode: 46,
  timelineSeg: 54,
  timelineQuote: 36,
  checkItem: 42,
  checkBox: 68,
  checkIndex: 52,
  checkNum: 64,
  bigNumber: 380,
  bigUnit: 136,
  bigName: 72,
  bigCard: 60,
  saying: 116,
  sayingName: 44,
  sayingOrg: 32,
  levelsText: 42,
  levelsIcon: 88,
  questionOption: 50,
  questionLetter: 88,
  caseBubble: 42,
  caseFace: 120,
  caseVerdict: 52,
  documentAmount: 66,
  documentPoint: 64,
  documentZoom: 64,
  tableHead: 32,
  tableSituation: 38,
  tableResult: 44,
  tableBasis: 30,
  chapterNum: 420,
  chapterTitle: 112,
  chapterPoint: 46,
  recapHead: 60,
  recapItem: 38,
  recapIndex: 44,
  stepsBody: 38,
});

function placed(x, y, w, h, fontPx, text = '', lineHeight = 1.2) {
  return {x, y, w, h, fontPx, text, lineHeight};
}

/** 最长契约文案在字号下要能排进这个盒子（可换行）。 */
export function boxTextFits(box) {
  if (!box.text) return true;
  const em = emWidth(box.text);
  const lh = box.lineHeight ?? 1.2;
  const per = box.w / Math.max(1, box.fontPx);
  const lines = em <= per + 1e-6 ? 1 : Math.ceil((em - 1e-6) / per);
  return lines * box.fontPx * lh <= box.h + 1.01;
}

/** 盒子伸进保留区时，上半段保持原宽，下半段右缘收到保留区左缘。 */
function dodge(box, reserve) {
  if (box.bleed) return [box];
  const right = box.x + box.w;
  const bottom = box.y + box.h;
  if (!(right > reserve.x && bottom > reserve.y)) return [box];
  const parts = [];
  if (box.y < reserve.y - 0.5) parts.push({...box, h: reserve.y - box.y});
  const botY = Math.max(box.y, reserve.y);
  const botH = bottom - botY;
  const botW = Math.min(right, reserve.x) - box.x;
  if (botH > 0.5 && botW > 1) parts.push({...box, y: botY, h: botH, w: botW, text: ''});
  return parts;
}

/** 样张尺寸下的内容包围盒。bleed 的章节面板可以出内容框，但不能进保留区。 */
function designBoxes(layout) {
  const copy = longestCopy(layout);
  const frame = contentFrame(layout);
  const x0 = frame.x;
  const y0 = frame.y;
  const fw = frame.width;
  const fh = frame.height;
  if (layout === 'cover') {
    const titlePx = fitBlockFont({chars: 12, width: fw - 32, maxFont: 72, lineHeight: 1.15, maxHeight: 240});
    const subPx = fitBlockFont({chars: 16, width: fw - 32, maxFont: 32, lineHeight: 1.4, maxHeight: 140});
    return [
      placed(x0 + 16, y0 + 16, fw - 32, 240, titlePx, copy.title, 1.15),
      placed(x0 + 16, y0 + 266, fw - 32, 140, subPx, copy.subtitle, 1.4),
      placed(x0 + 16, y0 + 416, fw - 32, 40, MIN_BODY),
    ];
  }
  if (layout === 'screenshot') return [placed(frame.x, frame.y, frame.width, frame.height, MIN_BODY)];
  if (layout === 'code') {
    const headH = 36;
    const lines = 14;
    const rowH = (fh - 32 - headH) / lines;
    return [
      placed(x0 + 16, y0 + 16, fw - 32, headH, MIN_BODY),
      ...Array.from({length: lines}, (_, i) => placed(x0 + 16, y0 + 16 + headH + i * rowH, fw - 32, rowH, MIN_BODY)),
    ];
  }
  if (layout === 'steps') {
    const rowH = 96;
    const gap = 16;
    return Array.from({length: 4}, (_, i) => placed(x0, y0 + i * (rowH + gap), fw, rowH, TYPE.stepsBody, copy.item, 1.3));
  }
  if (layout === 'chapter') {
    const panelW = 820;
    return [
      {...placed(0, 0, panelW, CANVAS.h, 32), bleed: true},
      {...placed(104, 330, 700, 460, TYPE.chapterNum, '02', 0.9), bleed: true},
      {...placed(940, 230, 860, 140, TYPE.chapterTitle, copy.title, 1.15), bleed: true},
      placed(940, 520, 760, 288, TYPE.chapterPoint, copy.point, 1.3),
      {...placed(120, 900, 580, 80, 30), bleed: true},
    ];
  }
  if (layout === 'quote') {
    let width = fw;
    let size = quoteBlockSize(copy.quote, copy.source, {width, tag: true});
    if (y0 + size.height > RESERVE.y) {
      width = RESERVE_ROW_RIGHT - x0;
      size = quoteBlockSize(copy.quote, copy.source, {width, tag: true});
    }
    const sourceY = y0 + QUOTE_PAD_Y;
    const quoteY = sourceY + size.sourceH + 18;
    const tagH = TYPE.quoteTag * 1.2;
    const tagY = quoteY + size.quoteH + 28;
    return [
      placed(x0, y0, width, size.height, TYPE.quote),
      placed(x0 + QUOTE_PAD_X, sourceY, size.inner, size.sourceH, MIN_BODY, copy.source, 1.3),
      placed(x0 + QUOTE_PAD_X, quoteY, size.inner, size.quoteH, TYPE.quote, copy.quote, 1.55),
      placed(x0 + QUOTE_PAD_X, tagY, size.inner, tagH, TYPE.quoteTag, zh(16), 1.2),
    ];
  }
  if (layout === 'compare') {
    const colW = (fw - 108) / 2;
    return [
      placed(x0, y0, fw, 500, TYPE.compareTitle),
      placed(x0 + 32, y0 + 28, colW - 64, 80, TYPE.compareTitle, copy.head, 1.2),
      placed(x0 + colW + 108 + 32, y0 + 28, colW - 64, 80, TYPE.compareTitle, copy.head, 1.2),
      placed(x0 + 32, y0 + 280, colW - 64, 160, TYPE.compareVerdict, copy.verdict, 1.2),
      placed(x0 + colW + 140, y0 + 280, colW - 64, 160, TYPE.compareVerdict, copy.verdict, 1.2),
    ];
  }
  if (layout === 'question') {
    const gap = 20;
    const colW = (fw - gap * 3) / 4;
    return [
      placed(x0, y0, fw, 440, TYPE.questionOption),
      ...Array.from({length: 4}, (_, i) => placed(x0 + i * (colW + gap) + 28, y0 + 120, colW - 56, 200, TYPE.questionOption, copy.option, 1.4)),
    ];
  }
  if (layout === 'flow') {
    const gap = 28;
    const colW = (fw - gap * 4) / 5;
    return Array.from({length: 5}, (_, i) => placed(x0 + i * (colW + gap), y0, colW, 474, TYPE.flowTitle, copy.title, 1.2))
      .concat(Array.from({length: 5}, (_, i) => placed(x0 + i * (colW + gap) + 16, y0 + 220, colW - 32, 160, TYPE.flowPoint, copy.point, 1.6)));
  }
  if (layout === 'recap') {
    return [
      placed(x0, y0, fw, 80, TYPE.recapHead, zh(8), 1.2),
      ...Array.from({length: 4}, (_, i) => placed(x0 + 72, y0 + 96 + i * 84, fw - 120, 72, TYPE.recapItem, copy.item, 1.4)),
    ];
  }
  if (layout === 'points') {
    const gap = 40;
    const colW = (fw - gap * 3) / 4;
    return [
      placed(x0, y0, fw, 380, TYPE.pointsBody),
      ...Array.from({length: 4}, (_, i) => placed(x0 + i * (colW + gap) + 28, y0 + 150, colW - 56, 70, TYPE.pointsTitle, copy.title, 1.2)),
      ...Array.from({length: 4}, (_, i) => placed(x0 + i * (colW + gap) + 28, y0 + 230, colW - 56, 120, TYPE.pointsBody, copy.text, 1.45)),
    ];
  }
  if (layout === 'statement') {
    return [
      placed(x0, y0, 800, 420, TYPE.statement, copy.line, 1.3),
      placed(x0, y0 + 440, 800, 48, TYPE.statementBasis, copy.basis, 1.2),
      placed(960, y0, 640, 520, TYPE.propLine, copy.prop, 1.4),
    ];
  }
  if (layout === 'timeline') {
    return [
      placed(x0, y0, fw, 280, TYPE.timelineNode, copy.node, 1.2),
      placed(x0, y0 + 300, RESERVE_ROW_RIGHT - x0, 250, TYPE.timelineQuote, copy.quote, 1.5),
    ];
  }
  if (layout === 'checklist') {
    const gap = 26;
    const colW = (fw - gap) / 2;
    const rowH = 142;
    const boxes = [placed(x0, y0, fw, 72, TYPE.checkNum)];
    for (let i = 0; i < 6; i += 1) {
      const col = i < 3 ? 0 : 1;
      const row = i % 3;
      boxes.push(placed(x0 + col * (colW + gap) + 88, y0 + 80 + row * (rowH + gap), colW - 120, rowH, TYPE.checkItem, copy.item, 1.2));
    }
    return boxes;
  }
  if (layout === 'bignumber') {
    return [
      placed(x0, y0, 700, 380, TYPE.bigNumber, copy.number, 0.9),
      placed(x0, y0 + 400, 700, 90, TYPE.bigName, copy.name, 1.2),
      placed(860, y0 + 18, 940, 440, TYPE.bigCard, copy.card, 1.3),
    ];
  }
  if (layout === 'saying') {
    return [
      placed(x0, y0, fw, 460, TYPE.saying),
      placed(300, y0, 1392, 360, TYPE.saying, zh(24), 1.42),
      placed(300, y0 + 380, 800, 60, TYPE.sayingName, zh(6), 1.2),
    ];
  }
  if (layout === 'levels') {
    const gap = 28;
    const colW = (fw - gap * 2) / 3;
    return [
      placed(x0, y0, fw, 450, TYPE.levelsText),
      ...Array.from({length: 3}, (_, i) => placed(x0 + i * (colW + gap) + 24, y0 + 180, colW - 48, 160, TYPE.levelsText, copy.text, 1.42)),
    ];
  }
  if (layout === 'case') {
    return [
      placed(x0, y0, 1010, 560, TYPE.caseBubble, copy.line, 1.3),
      placed(1200, y0 + 60, 560, 360, TYPE.caseVerdict, copy.verdict, 1.35),
    ];
  }
  if (layout === 'document') {
    return [
      placed(x0, y0, 500, 560, TYPE.documentAmount),
      placed(860, y0 + 40, 900, 200, TYPE.documentPoint, copy.point, 1.35),
      placed(860, y0 + 280, 720, 140, TYPE.documentZoom, copy.zoom, 1.2),
    ];
  }
  if (layout === 'table') {
    const head = 84;
    const rowH = 130;
    return [
      placed(x0, y0, fw, head, TYPE.tableHead),
      ...Array.from({length: 3}, (_, i) => placed(x0 + 80, y0 + head + i * rowH, 900, rowH, TYPE.tableSituation, copy.situation, 1.3)),
      ...Array.from({length: 3}, (_, i) => placed(x0 + 1100, y0 + head + i * rowH, 480, rowH, TYPE.tableResult, copy.result, 1.2)),
      placed(x0, y0 + head + 3 * rowH, fw, 36, TYPE.tableBasis, copy.basis, 1.2),
    ];
  }
  return [placed(frame.x, frame.y, frame.width, frame.height, MIN_BODY)];
}

/** 最长文案下的内容包围盒。默认避开讲解员那一角；传入姓名条保留区时按更大的角再让一次。 */
export function layoutContentBoxes(layout, options = {}) {
  const reserve = options.reserve ?? RESERVE;
  return designBoxes(layout).flatMap((box) => dodge(box, reserve));
}
