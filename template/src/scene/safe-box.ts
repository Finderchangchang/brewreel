// 安全区和字号下限。数字来自现有文件，不另做一套裁切。
// 宣传片 9:16 的主体区 = aspects.json 的 card 左右 + safe 上下，与 core/safe.ts 的 MAIN 相同。
// 讲课横版用 stage.mjs 的 CONTENT，并扣除 RESERVE。竖版用 vertical-layout.mjs 的 safe。
import aspects from '../core/aspects.json' with {type: 'json'};
import {CANVAS, CONTENT, RESERVE, RESERVE_ROW_RIGHT} from '../lesson/stage.mjs';
import {SUBTITLE} from '../lesson/presenter-place.mjs';
import {VERTICAL} from '../../../scripts/lesson/vertical-layout.mjs';
import type {Aspect, FontFloor, Product, SafeFrame} from './types.ts';

type AspectGeom = {
  w: number;
  h: number;
  safe: {x0: number; x1: number; y0: number; y1: number};
  card: {x0: number; x1: number};
  cap: {y0: number; y1: number};
  bgOnly: {top: number; bottom: number};
};

const GEOM = aspects as Record<string, AspectGeom>;

/** 宣传片 MIN_FONT：正文 40、面板 34、最小 26。标题上限取版式里常用的 96。 */
export const PROMO_FLOOR: FontFloor = {title: 40, titleMax: 96, body: 40, aux: 34, tiny: 26};
/** 讲课横版：标题 64–96，正文 44，辅助 28。 */
export const LESSON_FLOOR: FontFloor = {title: 64, titleMax: 96, body: 44, aux: 28, tiny: 28};
/** 讲课竖版：标题 72，正文 48。 */
export const LESSON_VERTICAL_FLOOR: FontFloor = {title: 72, titleMax: 96, body: 48, aux: 28, tiny: 28};

/**
 * 资讯板用的竖版安全框，和讲课 `VERTICAL.safe` 同一块：x180–900、y260–1340。
 *
 * 不会压到平台按钮。依据是现有安全区，不是新裁的一圈：
 * - `template/src/core/aspects.json` 的 9:16 注：y 0–205 被状态栏和标题盖住，y 1340 以下被平台文案和按钮盖住，关键内容 x 180–900。
 * - `template/src/core/safe.ts`：y 1340 以下只放背景；`BG_ONLY.bottom` 是 1340。宣传片主体从 y560 起，是为了把 y260–540 让给全局字幕带，不是因为 y260–560 会被按钮盖住。
 * - `docs/lesson/LAYOUT_RULES.md`：竖版内容就放在 x180–900、y260–1340，「底部和右侧按钮区不放内容」。
 *
 * 所以这块上沿在平台顶栏（y205）下面 55px，下沿停在按钮区之前，右沿停在 x900。board / number / media 没有全局字幕带，可以沿用讲课这块。hero / stack / split 等仍用宣传片主体区。
 */
export function plateSafe(frame: SceneFrame): SafeFrame {
  if (frame.aspect !== '9:16') return frame.safe;
  const box = VERTICAL.safe;
  return {x: box.x, y: box.y, w: box.right - box.x, h: box.bottom - box.y, reserve: null};
}

/**
 * 9:16 底部字幕带。参考片的字幕大约在 y 1400–1450，贴着画面下沿，不在顶部。
 *
 * 不照搬那个 y。`aspects.json` 的 9:16 写明 y 1340 以下会被平台文案和按钮盖住
 * （`bgOnly.bottom` = 1340，`noticeY` = 1344）。讲课竖版字幕条在 y 1380–1520，同样落进底栏，这里也不照搬。
 * 宣传片原来的全局字幕带在 y 260–540。资讯板从 y 260 起排 kicker 和标题，字幕放在那里会压住它们。
 *
 * 所以下沿对齐安全区下沿 y = 1340，高度 140（两行、字号不超过 56、行高 1.25 正好放下）。
 * 上沿 y = 1200。左右用关键内容 x 180–900。有字幕的屏，内容排到 y 1200 为止，不再往上挪字幕。
 */
export const PORTRAIT_CAPTION = {x: 180, y: 1200, w: 720, h: 140, bottom: 1340};

/** 字幕字号上限。两行 × 1.25 行高 = 140，和 PORTRAIT_CAPTION.h 对齐。下限用这一帧的正文下限，不另定。 */
export const CAPTION_FONT_MAX = 56;

export function captionBox(frame: Pick<SceneFrame, 'aspect' | 'canvasH' | 'safe'>): {x: number; y: number; w: number; h: number} {
  if (frame.aspect === '9:16' || frame.canvasH >= 1600) {
    return {x: PORTRAIT_CAPTION.x, y: PORTRAIT_CAPTION.y, w: PORTRAIT_CAPTION.w, h: PORTRAIT_CAPTION.h};
  }
  if (frame.aspect === '4:5') {
    const g = GEOM['4:5'];
    const h = 112;
    return {x: g.safe.x0, y: g.bgOnly.bottom - h, w: g.safe.x1 - g.safe.x0, h};
  }
  // 横版字幕不占内容框。讲课 `presenter-place.mjs` 的 SUBTITLE 在内容框下沿（y=880）之下、
  // 画布底之上：x260–1540、y900–1016。右下讲解员圆窗从 x1614 起，和这条带左右不相交。
  // 宣传片没有自己的 16:9 安全区（aspects.json 只有 9:16 和 4:5），横版沿用这一条。
  if (frame.aspect === '16:9') {
    return {x: SUBTITLE.x, y: SUBTITLE.y, w: SUBTITLE.w, h: SUBTITLE.h};
  }
  const h = 96;
  const bottom = frame.safe.y + frame.safe.h;
  return {x: frame.safe.x, y: bottom - h, w: frame.safe.w, h};
}

/** 有还没写在屏上的旁白时，内容区下沿停在字幕带上沿。安全区记录仍是原来的那一块。 */
export function layoutSafe(full: SafeFrame, laneY: number, reserve: boolean): SafeFrame {
  if (!reserve) return full;
  if (laneY <= full.y + 1) return full;
  if (full.y + full.h <= laneY + 0.5) return full;
  return {...full, h: laneY - full.y};
}

const PLATE_GEOM = new Set(['board', 'number', 'media']);

/** 9:16 的资讯板用 plateSafe，其余画幅和其余版式用这一帧原来的安全区。 */
export function screenSafe(frame: SceneFrame, geom: string): SafeFrame {
  if (PLATE_GEOM.has(geom)) return plateSafe(frame);
  return frame.safe;
}

export type SceneFrame = {
  product: Product;
  aspect: Aspect;
  canvasW: number;
  canvasH: number;
  safe: SafeFrame;
  floor: FontFloor;
  /** stack 行高上限。宣传片对 features 的 200，讲课横版对 Steps 的 96，竖版对 checklist 的 142。 */
  maxRow: number;
  portrait: boolean;
};

export function sceneFrame(product: Product, aspect: Aspect): SceneFrame {
  const floor = product === 'lesson' ? (aspect === '9:16' ? LESSON_VERTICAL_FLOOR : LESSON_FLOOR) : PROMO_FLOOR;
  // 横版画布 1920×1080，来自讲课 stage.mjs 的 CANVAS。
  // 内容框是 CONTENT：x 120–1800，y 300–880。宣传片 aspects.json 没有 16:9，所以横版不另裁一圈。
  // 右下角 RESERVE（x≥1600 且 y≥810）是讲解员保留区，右缘收到 RESERVE_ROW_RIGHT（1580）。
  // 字号：讲课用 LESSON_FLOOR（标题 64–96，正文 44，辅助 28）；宣传片和口播用 PROMO_FLOOR（正文 40，面板 34，最小 26，标题上限 96）。
  if (aspect === '16:9') {
    return {
      product,
      aspect,
      canvasW: CANVAS.w,
      canvasH: CANVAS.h,
      safe: {
        x: CONTENT.x,
        y: CONTENT.y,
        w: CONTENT.right - CONTENT.x,
        h: CONTENT.bottom - CONTENT.y,
        reserve: {x: RESERVE.x, y: RESERVE.y, rowRight: RESERVE_ROW_RIGHT},
      },
      floor,
      maxRow: product === 'lesson' ? 96 : 200,
      portrait: false,
    };
  }
  if (product === 'lesson' && aspect === '9:16') {
    const box = VERTICAL.safe;
    return {
      product,
      aspect,
      canvasW: VERTICAL.canvas.w,
      canvasH: VERTICAL.canvas.h,
      safe: {x: box.x, y: box.y, w: box.right - box.x, h: box.bottom - box.y, reserve: null},
      floor,
      maxRow: 142,
      portrait: true,
    };
  }
  if (aspect === '4:5') {
    const g = GEOM['4:5'];
    const y = g.cap.y1;
    const x = g.safe.x0;
    return {
      product,
      aspect,
      canvasW: g.w,
      canvasH: g.h,
      safe: {x, y, w: g.safe.x1 - x, h: g.safe.y1 - y, reserve: null},
      floor,
      maxRow: 200,
      portrait: true,
    };
  }
  const g = GEOM['9:16'];
  return {
    product,
    aspect,
    canvasW: g.w,
    canvasH: g.h,
    safe: {
      x: g.card.x0,
      y: g.safe.y0,
      w: g.card.x1 - g.card.x0,
      h: g.safe.y1 - g.safe.y0,
      reserve: null,
    },
    floor,
    maxRow: 200,
    portrait: true,
  };
}
