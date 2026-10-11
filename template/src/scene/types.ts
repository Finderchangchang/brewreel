// scene.json 的类型。渲染器（T12b）从这里取，不从镜头组件里取。
// 模型不写坐标、帧号、毫秒。when 是旁白里的连续几个字。

export const PRODUCTS = ['promo', 'lesson', 'talk'] as const;
export const ASPECTS = ['9:16', '16:9', '4:5'] as const;
export const ROLES = ['claim', 'points', 'number', 'quote', 'compare', 'chart', 'media', 'action', 'dialogue'] as const;
export const LAYOUTS = ['hero', 'stack', 'grid', 'split', 'sequence', 'media', 'chart', 'end'] as const;
export const MOTIONS = ['crisp', 'bounce', 'soft', 'paper'] as const;
export const ACTIONS = ['enter', 'emphasize', 'count', 'reveal', 'exit'] as const;
export const DENSITIES = ['tight', 'regular', 'loose'] as const;
export const ALIGNS = ['start', 'center'] as const;
export const PROTO_LAYOUTS = ['hero', 'stack', 'split'] as const;

export type Product = (typeof PRODUCTS)[number];
export type Aspect = (typeof ASPECTS)[number];
export type Role = (typeof ROLES)[number];
export type LayoutName = (typeof LAYOUTS)[number];
export type MotionName = (typeof MOTIONS)[number];
export type ActionName = (typeof ACTIONS)[number];
export type Density = (typeof DENSITIES)[number];
export type Align = (typeof ALIGNS)[number];
export type ProtoLayout = (typeof PROTO_LAYOUTS)[number];

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

export type SceneItem = {text: string; note?: string; when?: string};

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
  callouts?: {x: number; y: number; w: number; h: number}[];
};

export type SceneFile = {
  product: Product;
  aspect: Aspect;
  style: string;
  motion?: MotionName;
  density?: Density;
  align?: Align;
  facts?: SceneFact[];
  screens: SceneScreen[];
};

export type Rect = {x: number; y: number; w: number; h: number};

export type SceneBlock = Rect & {
  font: number;
  role: 'main' | 'item' | 'support';
  index: number;
  align: Align;
  textAlign: Align;
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
