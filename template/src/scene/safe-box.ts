// 安全区和字号下限。数字来自现有文件，不另做一套裁切。
// 宣传片 9:16 的主体区 = aspects.json 的 card 左右 + safe 上下，与 core/safe.ts 的 MAIN 相同。
// 讲课横版用 stage.mjs 的 CONTENT，并扣除 RESERVE。竖版用 vertical-layout.mjs 的 safe。
import aspects from '../core/aspects.json' with {type: 'json'};
import {CANVAS, CONTENT, RESERVE, RESERVE_ROW_RIGHT} from '../lesson/stage.mjs';
import {VERTICAL} from '../../../scripts/lesson/vertical-layout.mjs';
import type {Aspect, FontFloor, Product, SafeFrame} from './types.ts';

type AspectGeom = {
  w: number;
  h: number;
  safe: {x0: number; x1: number; y0: number; y1: number};
  card: {x0: number; x1: number};
  cap: {y0: number; y1: number};
};

const GEOM = aspects as Record<string, AspectGeom>;

/** 宣传片 MIN_FONT：正文 40、面板 34、最小 26。标题上限取版式里常用的 96。 */
export const PROMO_FLOOR: FontFloor = {title: 40, titleMax: 96, body: 40, aux: 34, tiny: 26};
/** 讲课横版：标题 64–96，正文 44，辅助 28。 */
export const LESSON_FLOOR: FontFloor = {title: 64, titleMax: 96, body: 44, aux: 28, tiny: 28};
/** 讲课竖版：标题 72，正文 48。 */
export const LESSON_VERTICAL_FLOOR: FontFloor = {title: 72, titleMax: 96, body: 48, aux: 28, tiny: 28};

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
