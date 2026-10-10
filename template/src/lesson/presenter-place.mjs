/** 讲解员摆放。横版卡通和真人小窗都是右下角圆；封面卡通是标题右侧的大圆。竖版不走这里。 */
import {AVATAR, COVER_AVATAR, COVER_MORPH_MS} from './stage.mjs';

export const CANVAS = {w: 1920, h: 1080};
export const RIGHT = 96;
/** 讲解员保留区左缘。版式内容不能进入 x≥1600 且 y≥810。 */
export const CONTENT_RIGHT = 1600;
export const CONTENT = {x: 120, y: 300, w: 1480, h: 510};
export const SUBTITLE = {x: 260, y: 900, w: 1280, h: 116};
export const CIRCLE_D = AVATAR.w;
export const COVER_D = COVER_AVATAR.w;
export const SIDE_RADIUS = 20;
export const MORPH_MS = 600;
export const COVER_MORPH = COVER_MORPH_MS;
export const NOTE_W = 230;
export const NOTE_H = 100;

export function cornerBox() {
  return {x: AVATAR.x, y: AVATAR.y, w: AVATAR.w, h: AVATAR.h, radius: AVATAR.w / 2, shape: 'circle', eyeY: 32};
}

export function coverBox() {
  return {x: COVER_AVATAR.x, y: COVER_AVATAR.y, w: COVER_AVATAR.w, h: COVER_AVATAR.h, radius: COVER_AVATAR.w / 2, shape: 'circle', eyeY: 32};
}

/** 封面是大圆，其余横版页是右下角小圆。 */
export function cartoonBox(pageLayout) {
  return pageLayout === 'cover' ? coverBox() : cornerBox();
}

/** 真人画中画固定在同一个小圆。full / 竖屏并排不走这里。 */
export function circleBox() {
  return cornerBox();
}

export function sideBox() {
  return {x: 1300, y: 100, w: 540, h: 720, radius: SIDE_RADIUS, shape: 'rounded', eyeY: 25};
}

export function fullBox() {
  return {x: 0, y: 0, w: CANVAS.w, h: CANVAS.h, radius: 0, shape: 'full', eyeY: 25};
}

/** 真人窗的落定位置。hidden 返回 null。 */
export function realBox(page) {
  const layout = page?.presenter?.layout ?? 'pip';
  const ratio = page?.presenter?.aspectRatio ?? 1;
  if (layout === 'hidden') return null;
  if (layout === 'full' && ratio >= 1) return fullBox();
  if (layout === 'full') return sideBox();
  return circleBox();
}

function smooth(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** 从上一页的窗收到这一页。t 为 0–1。 */
export function morphBox(from, to, t) {
  if (!to) return null;
  if (!from) return to;
  const same = from.x === to.x && from.y === to.y && from.w === to.w && from.h === to.h && from.radius === to.radius;
  if (same || t >= 1) return to;
  if (t <= 0) return from;
  const k = smooth(t);
  const lerp = (a, b) => a + (b - a) * k;
  return {
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
    w: lerp(from.w, to.w),
    h: lerp(from.h, to.h),
    radius: lerp(from.radius, to.radius),
    shape: to.shape,
    eyeY: lerp(from.eyeY ?? 25, to.eyeY ?? 25),
  };
}

export function objectPosition(box) {
  const eye = Number.isFinite(box?.eyeY) ? box.eyeY : 32;
  return `center ${eye}%`;
}

/** 竖版卡通仍无框。横版改走 avatarFrameStyle。 */
export function cartoonFrameStyle() {
  return {background: 'transparent', border: 'none', boxShadow: 'none', borderRadius: 0, overflow: 'visible'};
}

/** 圆形讲解员：6px surface 内圈，3px accent 外圈，圆内底用 accentSoft。 */
export function avatarFrameStyle(tokens) {
  const surface = tokens?.surface ?? '#FBF8F1';
  const accent = tokens?.accent ?? '#1F3B5C';
  return {
    background: tokens?.accentSoft ?? '#E7EDF3',
    border: `6px solid ${surface}`,
    boxShadow: `0 0 0 3px ${accent}, 0 24px 44px -20px rgba(0,0,0,.35)`,
    borderRadius: 9999,
    overflow: 'hidden',
  };
}

/** 真人全屏或并排大窗。圆形小窗用 avatarFrameStyle。 */
export function realFrameStyle(tokens, box) {
  const full = box?.shape === 'full';
  const border = full ? 'none' : String(tokens?.pipBorder || '1px solid rgba(0,0,0,.08)').replace(/^\d+(?:\.\d+)?px\b/u, '1px');
  const shadow = full || !tokens?.pipShadow || tokens.pipShadow === 'none' ? 'none' : tokens.pipShadow;
  return {background: tokens?.bg ?? 'transparent', border, boxShadow: shadow, borderRadius: box?.radius ?? 0, overflow: 'hidden'};
}

/** 竖版仍用自己的气泡。横版不再画 note。 */
export function noteBox(anchor) {
  if (!anchor || anchor.shape === 'full') return null;
  const w = NOTE_W;
  const h = NOTE_H;
  let x = anchor.x - w + 48;
  if (x < CONTENT_RIGHT) x = CONTENT_RIGHT;
  let y = anchor.y - h - 16;
  if (y < 24) y = 24;
  if (y + h > SUBTITLE.y) y = SUBTITLE.y - h;
  return {x, y, w, h};
}

export function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
