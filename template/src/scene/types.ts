// scene.json 的类型。渲染器（T12b）从这里取，不从镜头组件里取。
// 模型不写坐标、帧号、毫秒。when 是旁白里的连续几个字。

export const PRODUCTS = ['promo', 'lesson', 'talk'] as const;
export const ASPECTS = ['9:16', '16:9', '4:5'] as const;
export const ROLES = ['claim', 'points', 'number', 'quote', 'compare', 'chart', 'media', 'action', 'dialogue'] as const;
export const LAYOUTS = ['hero', 'stack', 'grid', 'split', 'sequence', 'media', 'chart', 'end', 'board', 'number'] as const;
export const MOTIONS = ['crisp', 'bounce', 'soft', 'paper', 'push'] as const;
export const ACTIONS = ['enter', 'emphasize', 'count', 'reveal', 'exit'] as const;
export const DENSITIES = ['tight', 'regular', 'loose'] as const;
export const ALIGNS = ['start', 'center'] as const;
export const PROTO_LAYOUTS = ['hero', 'stack', 'split'] as const;
/** 剪纸拼贴的跨屏接力。只有 cutpaper-collage 使用。 */
export const RELAYS = ['card', 'patch', 'guide', 'tumble', 'postcard', 'window'] as const;

export type Product = (typeof PRODUCTS)[number];
export type Aspect = (typeof ASPECTS)[number];
export type Role = (typeof ROLES)[number];
export type LayoutName = (typeof LAYOUTS)[number];
export type MotionName = (typeof MOTIONS)[number];
export type ActionName = (typeof ACTIONS)[number];
export type Density = (typeof DENSITIES)[number];
export type Align = (typeof ALIGNS)[number];
export type ProtoLayout = (typeof PROTO_LAYOUTS)[number];
export type RelayName = (typeof RELAYS)[number];

/** 统一角色名。值按家族分文件，不合成一份调色板。 */
export const TOKEN_ROLES = ['bg', 'surface', 'ink', 'muted', 'accent', 'line', 'radius', 'weight', 'shadow', 'texture'] as const;
export type TokenRole = (typeof TOKEN_ROLES)[number];

export type TokenRoles = {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  radius: number;
  weight: number;
  shadow: string;
  texture: string;
};

export type SceneFact = {id: string; text: string; source: string};

export type SceneItem = {text: string; note?: string; when?: string; icon?: string};

export type ChartPoint = {label: string; value: number; series?: string; focus?: boolean};

export type CalloutBox = {x: number; y: number; w: number; h: number; label?: string};

export type SceneScreen = {
  role: Role;
  layout: LayoutName;
  narration?: string;
  title?: string;
  text?: string;
  emphasis?: string[];
  support?: string;
  items?: SceneItem[];
  number?: {text: string; fact: string; label: string; from?: string};
  /** 金额有旧值时必须是 flip。roll 会被改写。 */
  count?: 'roll' | 'flip';
  showComputedDelta?: boolean;
  source?: string;
  fact?: string;
  left?: {label: string; items: string[]};
  right?: {label: string; items: string[]};
  winner?: 'left' | 'right' | 'none';
  brand?: string;
  line?: string;
  cta?: string;
  /** quiz 专用动词。surface 家族上出现就拒绝。 */
  verbs?: string[];
  src?: string;
  callouts?: CalloutBox[];
  /** 标题上方的栏目标。等宽小字，可省略。 */
  kicker?: string;
  /** 证据板中间放什么。不写时：有 src 就是图，有 number 就是大数字。 */
  evidence?: 'image' | 'table' | 'code' | 'number';
  chart?: 'bar' | 'line' | 'donut';
  points?: ChartPoint[];
  max?: number;
  /** 表格证据。数字必须出现在 fact 原文里。 */
  rows?: {label: string; value: string}[];
  /** 代码证据。整段当原件，不逐行套字号下限。 */
  code?: string;
  icon?: string;
  /**
   * 剪纸拼贴里这一屏的色卡怎么接上。不写坐标、不写秒。
   * 只有 style 为 cutpaper-collage 时可以写；不写则按版式推导。
   */
  relay?: RelayName;
};

/** 讲课讲解员。kind 与讲课引擎相同，包括 none。 */
export type ScenePresenter = {
  kind: 'cartoon' | 'real' | 'video' | 'none';
  look?: {preset?: string; hair?: string; accessory?: string; facialHair?: string; outfit?: string; skin?: string};
  src?: string;
};

export type SceneFile = {
  product: Product;
  aspect: Aspect;
  style: string;
  motion?: MotionName;
  density?: Density;
  align?: Align;
  /** 讲课领域。只有 legal 才出普法免责声明。 */
  domain?: string;
  /** 只在 product 为 lesson 时使用。 */
  presenter?: ScenePresenter;
  facts?: SceneFact[];
  screens: SceneScreen[];
};

export type Rect = {x: number; y: number; w: number; h: number};

export type BlockKind = 'card' | 'stage' | 'kicker' | 'caption' | 'evidence' | 'plot' | 'node';

export type SceneBlock = Rect & {
  font: number;
  role: 'main' | 'item' | 'support';
  index: number;
  align: Align;
  textAlign: Align;
  /** 不写就是卡片。stage 是压在舞台上的字，不铺底。 */
  kind?: BlockKind;
  /** 图标或节点圆，绝对坐标，落在块内。 */
  slot?: Rect;
  /** 正文占用的区域。和 slot 不相交。 */
  textBox?: Rect;
  /** split 的左右栏。竖版时上栏是 left、下栏是 right。 */
  pane?: 'left' | 'right';
};

export type SafeFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 讲解员保留区。块的底边越过 y 时，右缘收到 rowRight。 */
  reserve?: {x: number; y: number; rowRight: number} | null;
};

export type FontFloor = {
  title: number;
  titleMax: number;
  body: number;
  aux: number;
  tiny: number;
};
