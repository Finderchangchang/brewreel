// 动效 B-roll 的 props 形状。由 scripts/broll/motion.mjs 的 toMotionProps() 产出，写进 Talk 的 props.clips。
// 只有类型，没有运行时代码（节点测试可以直接引用 stage.ts / warp.ts，不会拖进 React）。

export type MotionTemplate = 'keyword' | 'checklist' | 'steps' | 'counter' | 'compare';
export type MotionMode = 'full' | 'pip' | 'split';

/** 一个数：脚本从原句里解析好的。text 是原句里的写法（审片用），屏幕上画 prefix + value + suffix */
export type MotionNum = {value: number; prefix: string; suffix: string; decimals: number; text: string};

// ---- 每个模板的上屏数据（字全部从原句里拷出来）和时刻（窗口内第几秒） ----
export type KeywordData = {text: string; hot?: string};
/** text0 / text：第一个字、最后一个字被说出的时刻；chars：data.text 每个字（按码点）的时刻 */
export type KeywordMarks = {text0: number; text: number; chars?: number[]; hot0?: number; hot?: number};

export type ChecklistData = {title?: string; items: string[]};
export type StepsData = {items: string[]};
/** items：每条第一个字被说出的时刻；itemsEnd：每条最后一个字 */
export type ListMarks = {items: number[]; itemsEnd?: number[]; title0?: number; title?: number};

export type CounterData = {say: MotionNum; from?: MotionNum; label: string};
/** sayAt：数字最后一个字被说出的时刻（数字在这时落定）；say0 / say：整截摘词的首尾 */
export type CounterMarks = {sayAt: number; say0: number; say: number; fromAt?: number; from0?: number; from?: number; label0?: number; label?: number};

export type CompareData = {labels: string; leftTitle: string; rightTitle: string; left: string[]; right: string[]; verdict?: string};
export type CompareMarks = {left: number[]; right: number[]; leftEnd?: number[]; rightEnd?: number[]; verdict0?: number; verdict?: number};

type Base = {
  kind: 'motion';
  id: string;
  /** 窗口（成片绝对毫秒），和视频段一样 */
  startMs: number;
  endMs: number;
  mode: MotionMode;
  /** 动效段不加「AI 生成画面」标，恒为 false */
  badge: false;
  /** 宣传片配色（core/themes.json 的名字），默认 studio-graphite。由风格预设的 motionTheme 决定 */
  theme?: string;
  /** keyword 纸卡配色（styles/quiz/tokens.json 的 themes），默认 sage-pine */
  paper?: string;
  /** 原句语言，决定镜头里少量固定词（「倍」/「×」） */
  lang?: 'zh' | 'en';
};

export type MotionClip = Base &
  (
    | {template: 'keyword'; data: KeywordData; marks: KeywordMarks}
    | {template: 'checklist'; data: ChecklistData; marks: ListMarks}
    | {template: 'steps'; data: StepsData; marks: ListMarks}
    | {template: 'counter'; data: CounterData; marks: CounterMarks}
    | {template: 'compare'; data: CompareData; marks: CompareMarks}
  );
