// T12b 渲染器从这里进。本轮没有 Remotion 组件，也不接 make / make-lesson / talk。
// 新风格（例如之后的「陆三金」）加在令牌读取的 registerStyleReader，不改这三支原型的公式。
export {TOKEN_ROLES, PRODUCTS, ASPECTS, ROLES, LAYOUTS, MOTIONS, ACTIONS, DENSITIES, ALIGNS, PROTO_LAYOUTS} from './types.ts';
export type {
  ActionName,
  Align,
  Aspect,
  Density,
  FontFloor,
  LayoutName,
  MotionName,
  Product,
  ProtoLayout,
  Role,
  SafeFrame,
  SceneBlock,
  SceneFile,
  SceneScreen,
  TokenRole,
  TokenRoles,
} from './types.ts';
export {sceneFrame, PROMO_FLOOR, LESSON_FLOOR, LESSON_VERTICAL_FLOOR} from './safe-box.ts';
export type {SceneFrame} from './safe-box.ts';
export {layoutBlocks, legacyStack} from './geom.ts';
export type {GeomInput, GeomResult} from './geom.ts';
export {curveOf, popAt, moneyFlip, defaultMotion, LEAD_SEC, BOUNCE_SPRING} from './motion.ts';
export type {MotionCurve, CurveSample} from './motion.ts';
export {revealFromWords, revealFromSentences, revealFromBeats, FIRST_BY, LAST_BEFORE_END} from './time.ts';
export type {WordReveal, SentenceReveal, BeatReveal, RevealPlan} from './time.ts';
export {contrastRatio} from './contrast.ts';
