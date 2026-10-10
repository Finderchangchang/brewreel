// 自由镜头的公开接口。项目 shots/*.tsx 只从这里取东西（出片拷贝后路径是 ../../custom-api）。
// 可以：字体、fitLine、主题、安全区几何、口播动效套件里的纸纹 / 手剪形状 / 纸屑 / 抛起落定 / 浮动 / 投影。
// 不要直接 import template/src/core、template/src/shots 里的某个正式镜头，也不要 import 图标表。
import type {Theme} from '../core/theme';
import type {Geometry} from '../core/safe';

export {FONT, SERIF, MONO} from '../core/font';
export {fitLine, fitSize, emWidth, charUnits, glueBreaks} from '../core/fit';
export type {WrapLang} from '../core/fit';
export {SAFE, CARD, TEXT, CAP, MAIN, W, H, FPS, CX, MIN_FONT, geometryOf} from '../core/safe';
export type {Geometry} from '../core/safe';
export {useTheme, alpha, mixHex, toneColor, moodColors} from '../core/theme';
export type {Theme} from '../core/theme';
export {PaperGrain} from '../talk/motion/kit/PaperGrain.tsx';
export {CutShape} from '../talk/motion/kit/CutShape.tsx';
export {Confetti} from '../talk/motion/kit/Confetti.tsx';
export {toss, entrance, leave} from '../talk/motion/kit/toss';
export {floatMotion} from '../talk/motion/kit/float';
export {settle} from '../talk/motion/kit/settle';
export {shadowByHeight} from '../talk/motion/kit/shadowByHeight';

/** 自由镜头组件的 props。上屏的字和数字只读 slots，不要在 JSX 里写死。 */
export type CustomShotProps = {
  slots: Record<string, unknown>;
  theme: Theme;
  geo: Geometry;
  /** 镜头内帧号（从 0 起） */
  frame: number;
  fps: number;
  /** 镜头内秒 */
  t: number;
  /** 本镜时长（秒） */
  dur: number;
  /** 本镜帧数 */
  frames: number;
  lang: 'zh' | 'en';
  /** 一拍多少秒 */
  beat: number;
  /** 镜头下标，从 0 起 */
  index: number;
};
