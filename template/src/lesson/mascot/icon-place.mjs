/** 头顶图标和纸屑的位置。角色卡、3 秒动画、成片都用这里的盒子，按人物实际画进舞台的尺寸换算。 */

import {FRAME} from './cast.mjs';

/**
 * 850×1200 半身里、镜像前的脸。
 * 从眉毛到下巴，含眼睛、眼镜和嘴。头发在这块上面，图标可以落在头发上。
 * 嘴心 (545, 411)，眼睛大约在 y 287–330。
 */
export const HEAD_VIEW = {x: 430, y: 248, w: 250, h: 260};

/**
 * 镜像前的图标盒子，对应成片里 48px 的标记（人物画满 1200 高时约占 200）。
 * 镜像后落在脸的右上方，底边停在眉毛以上。
 */
export const BADGE_VIEW = {x: 342, y: 33, w: 200, h: 200};

/** 镜像前的纸屑。散在头的左右和身侧，不进 HEAD_VIEW。 */
const PIECE_VIEW = [
  {x: 48, y: 48, w: 64, h: 36},
  {x: 740, y: 56, w: 64, h: 36},
  {x: 36, y: 340, w: 60, h: 34},
  {x: 750, y: 400, w: 60, h: 34},
  {x: 80, y: 700, w: 64, h: 36},
  {x: 690, y: 820, w: 64, h: 36},
  {x: 220, y: 120, w: 58, h: 32},
  {x: 160, y: 560, w: 60, h: 34},
];

export const CONFETTI_ACCENT = '#C4552A';

/** 角色卡 3 秒动画里，人物那一块的像素。和 CharacterCard 的框一致。 */
export const CARD_MOTION_FRAME = {w: 800, h: 760};

const BADGE_KINDS = new Set(['check', 'warn', 'think']);

export function cssPx(value) {
  const rounded = Math.round(Number(value) * 100) / 100;
  return String(rounded);
}

export function boxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 人物按 viewBox meet 放进舞台。返回的宽高是人物真正画出来的尺寸，不是外框。 */
export function fitPeep(stageW, stageH, crop = 'card') {
  const view = FRAME[crop] ?? FRAME.card;
  const scale = Math.min(stageW / view.width, stageH / view.height);
  const drawnW = view.width * scale;
  const drawnH = view.height * scale;
  return {
    scale,
    drawnW,
    drawnH,
    offsetX: (stageW - drawnW) / 2,
    offsetY: (stageH - drawnH) / 2,
    view,
  };
}

function wobble(index, elapsedMs) {
  const t = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  const dx = ((index * 17 + Math.floor(t / 90) * 9) % 17) - 8;
  const dy = ((index * 13 + Math.floor(t / 70) * 11) % 17) - 8;
  return {dx, dy};
}

function separate(box, head) {
  if (!boxesOverlap(box, head)) return box;
  const options = [
    {x: box.x, y: head.y - box.h - 8, w: box.w, h: box.h},
    {x: box.x, y: head.y + head.h + 8, w: box.w, h: box.h},
    {x: head.x - box.w - 8, y: box.y, w: box.w, h: box.h},
    {x: head.x + head.w + 8, y: box.y, w: box.w, h: box.h},
  ];
  return options.find((item) => !boxesOverlap(item, head)) ?? options[1];
}

function clampBox(box, view) {
  const x = Math.max(view.x, Math.min(box.x, view.x + view.width - box.w));
  const y = Math.max(view.y, Math.min(box.y, view.y + view.height - box.h));
  return {x, y, w: box.w, h: box.h};
}

/** 镜像前的绝对坐标，变成观众看到的、相对裁切 viewBox 的 0–1。人物水平翻转，图标本身不翻转。 */
function toFraction(box, view) {
  const localLeft = box.x - view.x;
  const localRight = box.x + box.w - view.x;
  const localTop = box.y - view.y;
  const localBottom = box.y + box.h - view.y;
  const mirroredLeft = view.width - localRight;
  return {
    x: mirroredLeft / view.width,
    y: localTop / view.height,
    w: (localRight - localLeft) / view.width,
    h: (localBottom - localTop) / view.height,
  };
}

export function markFractions(kind, elapsedMs = 0, crop = 'card') {
  const view = FRAME[crop] ?? FRAME.card;
  const head = toFraction(HEAD_VIEW, view);
  const icon = BADGE_KINDS.has(kind) ? toFraction(BADGE_VIEW, view) : null;
  const pieces = kind === 'cheer'
    ? PIECE_VIEW.map((piece, index) => {
      const shift = wobble(index, elapsedMs);
      const moved = clampBox(separate({x: piece.x + shift.dx, y: piece.y + shift.dy, w: piece.w, h: piece.h}, HEAD_VIEW), view);
      return toFraction(moved, view);
    })
    : [];
  return {head, icon, pieces};
}

/** 舞台像素。head / icon / pieces 已经按人物缩放，并算上 meet 留白。 */
export function placeMarks(stageW, stageH, crop = 'card', kind = 'none', elapsedMs = 0) {
  const fit = fitPeep(stageW, stageH, crop);
  const frac = markFractions(kind, elapsedMs, crop);
  const box = (item) => ({
    x: fit.offsetX + item.x * fit.drawnW,
    y: fit.offsetY + item.y * fit.drawnH,
    w: item.w * fit.drawnW,
    h: item.h * fit.drawnH,
  });
  return {
    head: box(frac.head),
    icon: frac.icon ? box(frac.icon) : null,
    pieces: frac.pieces.map(box),
    fit,
  };
}

export function pieceFill(index, ink) {
  return index % 2 === 0 ? (ink || '#1E2422') : CONFETTI_ACCENT;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
}

export function iconMarkup(kind, ink) {
  const color = esc(ink || '#1E2422');
  if (kind === 'warn') {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><path d="M32 8 L56 52 H8 Z" fill="#F6C85F" stroke="${color}" stroke-width="3" stroke-linejoin="round"/><path d="M32 24 V38 M32 46 V48" stroke="${color}" stroke-width="4" stroke-linecap="round"/></svg>`;
  }
  if (kind === 'think') {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="#FFFFFF" stroke="${color}" stroke-width="3"/><text x="32" y="42" text-anchor="middle" font-size="32" font-weight="700" fill="${color}">?</text></svg>`;
  }
  if (kind === 'check') {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="#FFFFFF" stroke="${color}" stroke-width="3"/><path d="M20 33 L28 41 L45 22" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return '';
}

export function pieceMarkup(fill) {
  const color = esc(fill || '#1E2422');
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><path d="M8 18 l40 12 l-12 28 l-40 -12Z" fill="${color}"/></svg>`;
}
