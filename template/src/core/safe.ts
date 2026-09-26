// ============================================================
// 全平台通用安全区（1080x1920）。所有镜头只用这些常量摆位置，不要自己写魔法数。
//
//   y 0–205     只放背景（平台状态栏/标题会盖住）
//   y ≈216      免责小字（全局层画）
//   y 260–540   字幕带（全局层画，镜头不要在这里放东西；hook/endCard 例外，见各自说明）
//   y 560–1340  主体区（镜头的地盘）
//   y 1340 以下 只放背景/装饰（平台的文案、按钮会盖住）
//   关键内容 x 180–900，以 x=540 左右对称；文字行宽 ≤780（x 150–930）
// ============================================================
import ASPECTS from './aspects.json';

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const CX = 540;

/** 关键内容区（文字、按钮、数字都要在里面） */
export const SAFE = {x0: 180, x1: 900, y0: 560, y1: 1340, w: 720, h: 780};
/** 卡片外框可以放宽到 150–930，但卡片内边距要 ≥30，保证里面的字仍在 180–900 */
export const CARD = {x0: 150, x1: 930, w: 780, padX: 30};
/** 文字行宽上限 */
export const TEXT = {x0: 150, x1: 930, w: 780};
/** 字幕带 */
export const CAP = {x0: 150, w: 780, y0: 260, y1: 540, max: 90, min: 64};
/** 主体区 */
export const MAIN = {x0: 150, x1: 930, y0: 560, y1: 1340, w: 780, h: 780};
/** 免责小字 */
export const DISCLAIMER_Y = 216;
/** 背景专用区 */
export const BG_ONLY = {top: 205, bottom: 1340};

/** 字号下限（审美底线） */
export const MIN_FONT = {body: 40, panel: 34, tiny: 26};

// ============================================================
// 多画幅（2026-09 风格包架构）：上面的常量是 9:16 的，cards 风格的镜头一直按它们摆，保持不动。
// 新风格按 meta.aspect 取几何：useGeometry()（core/aspect.tsx）或 geometryOf(aspect)。
// 数值的唯一来源是 core/aspects.json，scripts/lib/styles.mjs（校验、版式自查）也读它。
// ============================================================
export type AspectName = keyof typeof ASPECTS;
export type Geometry = (typeof ASPECTS)['9:16'];
export const ASPECT_NAMES = Object.keys(ASPECTS) as AspectName[];
export const DEFAULT_ASPECT: AspectName = '9:16';
export const isAspect = (a: unknown): a is AspectName => typeof a === 'string' && a in ASPECTS;
/** 画幅 → 尺寸与安全区；不认识的画幅按 9:16 */
export const geometryOf = (a?: string): Geometry => (isAspect(a) ? (ASPECTS[a] as Geometry) : (ASPECTS['9:16'] as Geometry));
