// 竖版画面几何。不引用 Node 内置模块，Remotion 浏览器包可以直接引用。
import {MIN_BODY, fitBlockFont} from '../../template/src/lesson/stage.mjs';
export const VERTICAL = {
  canvas: {w: 1080, h: 1920},
  safe: {x: 180, y: 260, right: 900, bottom: 1340},
  subtitle: {x: 180, y: 1380, w: 720, h: 140},
  subtitleMinPx: 56,
  subtitleMaxChars: 14,
  cartoonH: 300,
  cartoonHOpen: 420,
  cartoonHDense: 220,
  cartoonHTight: 220,
  circleD: 240,
  circleDOpen: 360,
  circleDDense: 200,
  circleDTight: 220,
  peepRatio: 850 / 1200,
  presenterGap: 12,
  openMoveMs: 400,
  pageMoveMs: 300,
  noteW: 220,
  noteH: 72,
  noteGap: 12,
  sampleH: 48,
  labelH: 108,
  hookH: 96,
  hookLine: 96,
  hookFont: 80,
  hookMs: 1500,
  hookFrames: 45,
  hookMaxChars: 14,
  clipMaxMs: 60_000,
  clipMinMs: 15_000,
  legalTailMs: 2000,
  coverTitleMax: 20,
  coverSubtitleEm: 18,
  publishTitleMax: 20,
};

export function verticalSubtitleMaxChars() {
  const fit = Math.floor((VERTICAL.subtitle.w - 32) / VERTICAL.subtitleMinPx);
  return Math.min(VERTICAL.subtitleMaxChars, Math.max(1, fit));
}

/** 字幕在内容下方、按内容宽度水平居中。内容底边还在字幕带上方时，仍用 y=1380 那一条。 */
export function verticalSubtitleBox(content) {
  const band = VERTICAL.subtitle;
  const fallback = {x: band.x, y: band.y, width: band.w, height: band.h};
  if (!content || !Number.isFinite(content.width) || content.width <= 0) return fallback;
  const width = Math.min(band.w, content.width);
  const x = Math.round(content.x + (content.width - width) / 2);
  const contentBottom = content.y + (content.height ?? content.h ?? 0);
  let y = band.y;
  if (contentBottom > band.y) y = Math.round(contentBottom);
  if (y + band.h > 1520) y = 1520 - band.h;
  if (y < band.y) y = band.y;
  return {x, y, width, height: band.h};
}

/** 稳态不给片头标识和钩子留空。它们出现时由 topReserve（或 showLabel / showHook）把内容往下推。 */
export function headerHeight({sampleReview = false, topReserve, showLabel = false, showHook = false, hookLines = 1, brandBug = false} = {}) {
  if (topReserve != null && Number.isFinite(topReserve)) return Math.max(0, topReserve);
  return chromeTopReserve({sampleReview, showLabel, showHook, hookLines, brandBug});
}

/** 版式主体。和讲解员包围盒不重叠：平时在人物上方拉满宽度，开头人物居中时改到人物下方。 */
export function verticalContentBox(layout, presenterKind = 'cartoon', options = {}) {
  return resolveVertical(presenterKind, {layout, ...options}).content;
}

/** 卡通平时高 300、右缘 x=900、脚底 y=1340。开头 1.5 秒高 420 并居中在钩子下，再用 0.4 秒收到角上。截图、代码、对比高 220。真人圆窗同样摆，直径 360 / 240 / 200。 */
export function verticalPresenterBox(kind, options = {}) {
  if (kind !== 'cartoon' && kind !== 'real') return null;
  return resolveVertical(kind, options).presenter;
}

/** 片头标识在安全区右上，钩子在它下面。没出现的层不占位。 */
const BRAND_BUG_H = 64;

export function verticalChromeBoxes({sampleReview = false, showLabel = false, showHook = false, hookLines = 1, brandBug = false} = {}) {
  let y = VERTICAL.safe.y;
  const w = VERTICAL.safe.right - VERTICAL.safe.x;
  const boxes = {};
  if (brandBug) {
    boxes.brand = {x: VERTICAL.safe.x, y, w, h: BRAND_BUG_H};
    y += BRAND_BUG_H;
  }
  if (sampleReview) {
    boxes.sample = {x: VERTICAL.safe.x, y, w, h: VERTICAL.sampleH};
    y += VERTICAL.sampleH;
  }
  if (showLabel) {
    boxes.label = {x: VERTICAL.safe.x, y, w, h: VERTICAL.labelH};
    y += VERTICAL.labelH;
  }
  if (showHook) {
    const lines = Math.max(1, hookLines);
    boxes.hook = {x: VERTICAL.safe.x, y, w, h: Math.max(VERTICAL.hookH, lines * VERTICAL.hookLine)};
  }
  return boxes;
}

export function chromeTopReserve(options = {}) {
  const boxes = verticalChromeBoxes(options);
  let bottom = VERTICAL.safe.y;
  for (const box of Object.values(boxes)) bottom = Math.max(bottom, box.y + box.h);
  return bottom - VERTICAL.safe.y;
}

const cleanHeading = (value) => typeof value === 'string' ? value.trim() : '';

const compactHeading = (value) => cleanHeading(value).replace(/\s+/gu, '');

/** 回顾页实际画出的标题。版式和这里用同一句，避免钩子判断和画面不一致。 */
export function recapHeading(domain = '', lang = 'zh') {
  const en = lang === 'en';
  if (domain === 'legal') return en ? 'A note from counsel' : '律师提示';
  return en ? 'Recap' : '要点回顾';
}

/** 对比页两栏实际画出的标题。缺省和版式里的「前者 / 后者」一致。 */
export function compareHeadings(fields = {}, lang = 'zh') {
  const en = lang === 'en';
  const left = cleanHeading(fields.leftTitle) || (en ? 'Before' : '前者');
  const right = cleanHeading(fields.rightTitle) || (en ? 'After' : '后者');
  return [left, right];
}

/**
 * 当前页已经画在画面上的标题、章节名、封面标题。
 * 封面和章节画的是 page.title；提问页画的是 fields.question；
 * 步骤、引用、流程、代码、截图不画页面标题，返回空，钩子仍单独显示。
 */
export function visiblePageHeadings(page, {domain = '', lang = 'zh'} = {}) {
  if (!page || typeof page !== 'object') return [];
  const title = cleanHeading(page.title);
  const fields = page.fields && typeof page.fields === 'object' ? page.fields : {};
  if (page.layout === 'cover' || page.layout === 'chapter') return title ? [title] : [];
  if (page.layout === 'question') {
    const asked = cleanHeading(fields.question);
    return asked ? [asked] : [];
  }
  if (page.layout === 'recap') return [recapHeading(domain, lang)];
  if (page.layout === 'compare') return compareHeadings(fields, lang);
  return [];
}

/** 相同，或去掉空白后一方包含另一方。空串不算。单字包含不算，避免一个「的」吞掉整句。 */
export function headingsOverlap(hookTitle, headings) {
  const hook = compactHeading(hookTitle);
  if (!hook) return false;
  const list = Array.isArray(headings) ? headings : [headings];
  return list.some((raw) => {
    const text = compactHeading(raw);
    if (!text) return false;
    if (text === hook) return true;
    const shorter = Array.from(hook).length <= Array.from(text).length ? hook : text;
    if (Array.from(shorter).length < 2) return false;
    return text.includes(hook) || hook.includes(text);
  });
}

/** 开头 1.5 秒内，钩子和当前页标题不重复时才单独画钩子。 */
export function shouldShowHook(hookTitle, page, frame, options) {
  if (!compactHeading(hookTitle)) return false;
  if (!(Number(frame) < VERTICAL.hookFrames)) return false;
  return !headingsOverlap(hookTitle, visiblePageHeadings(page, options));
}

/** 重复时把页面标题放大到钩子字号；本来就更大则保持。 */
export function emphasizedFontPx(basePx, active) {
  const base = Number.isFinite(basePx) ? basePx : 0;
  if (!active) return base;
  return Math.max(base, VERTICAL.hookFont);
}

/** 开头 1.5 秒轻微强调：下移 8px 后收回。字号放大由 emphasizedFontPx 负责，这里不再 scale，避免 9em 标题被内容框裁切。 */
export function hookEmphasisTransform(frame) {
  const span = Math.max(1, VERTICAL.hookFrames - 1);
  const t = Math.min(1, Math.max(0, Number(frame) / span));
  const settle = 1 - (1 - t) ** 3;
  const y = (1 - settle) * 8;
  return {scale: 1, y, transform: `translateY(${y.toFixed(2)}px)`};
}

const DENSE_LAYOUTS = new Set(['screenshot', 'code', 'compare']);

function overlapsBox(a, b) {
  if (!a || !b) return false;
  const aw = a.width ?? a.w;
  const ah = a.height ?? a.h;
  const bw = b.width ?? b.w;
  const bh = b.height ?? b.h;
  return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y;
}

function smooth(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function lerpBox(from, to, t) {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const k = smooth(t);
  const lerp = (a, b) => a + (b - a) * k;
  return {
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
    w: lerp(from.w, to.w),
    h: lerp(from.h, to.h),
    radius: lerp(from.radius, to.radius),
    shape: to.shape,
    eyeY: lerp(from.eyeY ?? 0, to.eyeY ?? 0),
  };
}

function tierOf(layout) {
  return DENSE_LAYOUTS.has(layout) ? 'dense' : 'rest';
}

function metricsFor(kind, tier) {
  if (kind === 'real') {
    const d = tier === 'open' ? VERTICAL.circleDOpen
      : tier === 'dense' ? VERTICAL.circleDDense
      : tier === 'tight' ? VERTICAL.circleDTight
      : VERTICAL.circleD;
    return {w: d, h: d, radius: d / 2, shape: 'circle', eyeY: 40};
  }
  const h = tier === 'open' ? VERTICAL.cartoonHOpen
    : tier === 'dense' ? VERTICAL.cartoonHDense
    : tier === 'tight' ? VERTICAL.cartoonHTight
    : VERTICAL.cartoonH;
  const w = Math.round(h * VERTICAL.peepRatio);
  return {w, h, radius: 0, shape: 'cartoon', eyeY: 0};
}

function placeCorner(size) {
  return {...size, x: VERTICAL.safe.right - size.w, y: VERTICAL.safe.bottom - size.h};
}

function placeOpen(size, hookBottom) {
  const center = (VERTICAL.safe.x + VERTICAL.safe.right) / 2;
  const x = Math.round(center - size.w / 2);
  const y = Math.round(hookBottom + VERTICAL.presenterGap);
  return {...size, x, y};
}

function openingClock(options) {
  const fps = options.fps || 30;
  const openFrames = Math.round(VERTICAL.hookMs * fps / 1000);
  const moveFrames = Math.max(1, Math.round(VERTICAL.openMoveMs * fps / 1000));
  const frame = Number.isFinite(options.frame) ? options.frame : null;
  let phase = 'settled';
  if (options.showHook === true && frame != null) {
    if (frame < openFrames) phase = 'hold';
    else if (frame < openFrames + moveFrames) phase = 'move';
  }
  return {fps, openFrames, moveFrames, frame, phase};
}

/** 右下角落位。和字幕重叠时先缩到 220（已经更小则保持），仍重叠就把脚抬到字幕上沿。 */
function fittedCorner(kind, layout, subtitle) {
  const sub = subtitle ?? verticalSubtitleBox();
  let size = metricsFor(kind, tierOf(layout));
  let box = placeCorner(size);
  if (!overlapsBox(box, sub)) return box;
  const tight = metricsFor(kind, 'tight');
  if (tight.h < size.h) {
    size = tight;
    box = placeCorner(size);
  }
  if (overlapsBox(box, sub)) box = {...box, y: sub.y - box.h};
  return box;
}

function contentRegion(top, presenter, subtitle) {
  const x0 = VERTICAL.safe.x;
  const safeW = VERTICAL.safe.right - x0;
  const intrudes = subtitle && subtitle.y < VERTICAL.safe.bottom;
  const floor = intrudes ? Math.min(VERTICAL.safe.bottom, subtitle.y - VERTICAL.presenterGap) : VERTICAL.safe.bottom;
  if (!presenter) {
    const height = Math.max(0, floor - top);
    return {x: x0, y: top, width: safeW, height, area: safeW * height};
  }
  const gap = VERTICAL.presenterGap;
  const aboveH = Math.max(0, presenter.y - gap - top);
  const belowY = presenter.y + presenter.h + gap;
  const belowH = Math.max(0, floor - belowY);
  const besideW = Math.max(0, presenter.x - gap - x0);
  const fullH = Math.max(0, floor - top);
  const safeArea = safeW * (VERTICAL.safe.bottom - VERTICAL.safe.y);
  const above = {x: x0, y: top, width: safeW, height: aboveH, area: safeW * aboveH, rank: 3};
  // 人物上方的全宽区域够大时就用它。片头标识会把顶边压低，左侧竖条面积可能略大，但仍会和便签重叠。
  if (above.area >= safeArea * 0.45) return above;
  const candidates = [
    above,
    {x: x0, y: belowY, width: safeW, height: belowH, area: safeW * belowH, rank: 2},
    {x: x0, y: top, width: besideW, height: fullH, area: besideW * fullH, rank: 1},
  ];
  candidates.sort((a, b) => (b.area - a.area) || (b.rank - a.rank));
  const best = candidates[0];
  return {x: best.x, y: best.y, width: best.width, height: best.height, area: best.area};
}

function presenterMotion(kind, options) {
  const clock = openingClock(options);
  const hookBottom = Number.isFinite(options.hookBottom) ? options.hookBottom : VERTICAL.safe.y + headerHeight(options);
  const settled = fittedCorner(kind, options.layout, options.subtitle);
  if (clock.phase === 'hold') return placeOpen(metricsFor(kind, 'open'), hookBottom);
  if (clock.phase === 'move') {
    const intro = placeOpen(metricsFor(kind, 'open'), hookBottom);
    return lerpBox(intro, settled, (clock.frame - clock.openFrames) / clock.moveFrames);
  }
  const pageFrames = Math.max(1, Math.round(VERTICAL.pageMoveMs * clock.fps / 1000));
  const pageFrame = options.pageFrame;
  if (options.prevLayout && tierOf(options.prevLayout) !== tierOf(options.layout) && Number.isFinite(pageFrame) && pageFrame < pageFrames) {
    const from = fittedCorner(kind, options.prevLayout, options.subtitle);
    return lerpBox(from, settled, pageFrame / pageFrames);
  }
  return settled;
}

function resolveVertical(kind, options = {}) {
  const obstacle = options.subtitle ?? verticalSubtitleBox();
  const top = VERTICAL.safe.y + headerHeight(options);
  const empty = contentRegion(top, null, obstacle);
  if (kind !== 'cartoon' && kind !== 'real') {
    return {presenter: null, content: empty, subtitle: options.subtitle ?? verticalSubtitleBox(empty)};
  }
  const clock = openingClock(options);
  let presenter = presenterMotion(kind, options);
  const anchor = clock.phase === 'move' ? fittedCorner(kind, options.layout, options.subtitle) : presenter;
  let content = contentRegion(top, anchor, obstacle);
  const subtitle = options.subtitle ?? verticalSubtitleBox(content);
  if (clock.phase === 'settled' && overlapsBox(presenter, subtitle)) {
    presenter = {...presenter, y: subtitle.y - presenter.h};
    content = contentRegion(top, presenter, obstacle);
  }
  return {presenter, content, subtitle};
}

/** 便签贴在人物左缘外侧、与头顶齐平，四边留在安全区。左侧不够宽时变窄，不盖住上方的正文。 */
export function verticalNoteBox(anchor) {
  if (!anchor || anchor.shape === 'full') return null;
  const h = VERTICAL.noteH;
  const gap = VERTICAL.noteGap;
  const minX = VERTICAL.safe.x;
  const minY = VERTICAL.safe.y;
  const maxY = VERTICAL.safe.bottom - h;
  let y = Math.round(anchor.y);
  if (y < minY) y = minY;
  if (y > maxY) y = maxY;
  let w = VERTICAL.noteW;
  let x = Math.round(anchor.x - gap - w);
  if (x < minX) {
    x = minX;
    w = Math.floor(anchor.x - gap - x);
  }
  if (w < 1) return null;
  const maxW = VERTICAL.safe.right - x;
  if (w > maxW) w = maxW;
  return {x, y, w, h};
}

/** 最长文案在竖版内容框里的包围盒。落在内容框内，不和讲解员重叠。 */
export function verticalLayoutContentBoxes(layout) {
  const frame = verticalContentBox(layout, 'cartoon');
  const pad = 10;
  const x = frame.x + pad;
  const y = frame.y + pad;
  const w = Math.max(1, frame.width - pad * 2);
  const h = Math.max(1, frame.height - pad * 2);
  const placed = (px, py, pw, ph, fontPx) => ({x: px, y: py, w: pw, h: ph, fontPx: Math.max(MIN_BODY, fontPx)});
  const split = (n, maxFont, chars) => {
    const rowH = h / n;
    const font = fitBlockFont({chars, width: Math.max(40, w - 24), maxFont, lineHeight: 1.35, maxHeight: Math.max(1, rowH - 4)});
    return Array.from({length: n}, (_, i) => placed(x, y + i * rowH, w, rowH, font));
  };
  if (layout === 'points') return split(4, 36, 20);
  if (layout === 'flow') return split(6, 32, 30);
  if (layout === 'checklist') return split(9, 32, 16);
  if (layout === 'statement') return split(10, 32, 18);
  if (layout === 'timeline') return split(6, 32, 20);
  if (layout === 'compare') return split(10, 32, 42);
  if (layout === 'quote') return split(3, 40, 60);
  if (layout === 'steps') return split(6, 36, 32);
  if (layout === 'recap') return split(7, 36, 36);
  if (layout === 'question') return split(5, 36, 40);
  if (layout === 'code') return split(15, 30, 48);
  if (layout === 'cover' || layout === 'chapter') return split(3, 48, 40);
  if (layout === 'bignumber') {
    const numH = Math.max(80, Math.round(h * 0.4));
    return [placed(x, y, w, numH, Math.max(MIN_BODY, Math.min(300, numH - 8))), placed(x, y + numH, w, h - numH, 32)];
  }
  if (layout === 'saying' || layout === 'levels' || layout === 'case' || layout === 'document' || layout === 'table') return split(layout === 'table' ? 6 : 4, 36, 16);
  if (layout === 'screenshot') return [placed(frame.x, frame.y, frame.width, frame.height, MIN_BODY)];
  return [placed(frame.x, frame.y, frame.width, frame.height, MIN_BODY)];
}
