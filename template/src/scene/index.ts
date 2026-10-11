// 准备函数从这里出。Remotion 组件在 Scene.tsx，合成名 Scene，不接 make / make-lesson / talk。
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
export {auditPlan, checkFrames, ensureContrast, hanziCount, measureEnter, poseAt, prepareScene, protoScene} from './prepare.ts';
export type {ContrastRow, PlanBlock, PlanScreen, Pose, ScenePlan} from './prepare.ts';
