// 动效画面的配色和质感：跟着主风格走（broll/styles/<id>/style.json 的 motionTheme），和 AI 段接得上。
// look 决定背景纹理、装饰形状、卡片质感怎么画；颜色是 11 个色号，style.json 里写了就覆盖，没写用这里的默认。
// 纯数据和纯函数，没有运行时依赖，节点测试直接引用（scripts/broll/prompt.mjs 的 lintStyle 用同一份键名）。

export const MOTION_LOOKS = ['wood', 'clay', 'paper', 'ink'] as const;
export type MotionLookName = (typeof MOTION_LOOKS)[number];

/** 色号的键：底色两层、卡片、卡片侧边（积木的厚度 / 纸的阴影层）、正文、副文、重点、冷色、暖色、完成、未亮 */
export const MOTION_COLOR_KEYS = ['bg', 'bg2', 'card', 'edge', 'ink', 'sub', 'accent', 'cool', 'warm', 'good', 'muted'] as const;
export type MotionColorKey = (typeof MOTION_COLOR_KEYS)[number];
export type MotionPalette = {look: MotionLookName} & Record<MotionColorKey, string>;
/** style.json 的 motionTheme（也是 props 里 clip.look 的形状）：look 必写，色号可选 */
export type MotionLookSpec = {look: string} & Partial<Record<MotionColorKey, string>>;

export const DEFAULT_LOOK: MotionLookName = 'wood';

/**
 * 四套默认色。
 * wood：暖木桌面、米白卡片、浅蓝灰和暖橙（角色色号 #9FB1BC / #FFB04A）
 * clay：暖粉彩，黏土的软
 * paper：米白纸，鼠尾草绿 / 珊瑚 / 芥末黄三层彩纸
 * ink：白纸墨线，一支黄色荧光笔
 */
export const LOOK_DEFAULTS: Record<MotionLookName, Record<MotionColorKey, string>> = {
  wood: {
    bg: '#F3E8D6',
    bg2: '#E4D1B4',
    card: '#FFFAF1',
    edge: '#D9BD94',
    ink: '#2E3843',
    sub: '#76685A',
    accent: '#FFB04A',
    cool: '#9FB1BC',
    warm: '#C99464',
    good: '#5F9A78',
    muted: '#CDBBA2',
  },
  clay: {
    bg: '#F9E5DC',
    bg2: '#F1CDBF',
    card: '#FFF7F2',
    edge: '#EBBFAE',
    ink: '#4A3341',
    sub: '#8B6C79',
    accent: '#FF9B78',
    cool: '#A9D9C8',
    warm: '#F8D386',
    good: '#5FAE8F',
    muted: '#E3C3B7',
  },
  paper: {
    bg: '#F7F2E7',
    bg2: '#ECE3D1',
    card: '#FFFDF8',
    edge: '#E2D6C0',
    ink: '#2C3938',
    sub: '#6A7874',
    accent: '#F28E6C',
    cool: '#9EC0AF',
    warm: '#F1C46A',
    good: '#4F957A',
    muted: '#D9CFBE',
  },
  ink: {
    bg: '#FBFAF6',
    bg2: '#F1EFE8',
    card: '#FFFFFF',
    edge: '#26231F',
    ink: '#221F1C',
    sub: '#5D5952',
    accent: '#FFD84A',
    cool: '#8EA3B1',
    warm: '#E9C9A0',
    good: '#2F7D5B',
    muted: '#BDB8AE',
  },
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX_RE.test(v);
export const isLook = (v: unknown): v is MotionLookName => typeof v === 'string' && (MOTION_LOOKS as readonly string[]).includes(v);

/** props 里的 look（可能缺、可能是 v0.9 早期的字符串主题名）→ 完整配色。不认识的 look 退回 wood，写错的色号用默认 */
export const resolvePalette = (spec?: unknown): MotionPalette => {
  const s = spec && typeof spec === 'object' && !Array.isArray(spec) ? (spec as Record<string, unknown>) : {};
  const look = isLook(s.look) ? s.look : DEFAULT_LOOK;
  const base = LOOK_DEFAULTS[look];
  const out = {look} as MotionPalette;
  for (const k of MOTION_COLOR_KEYS) out[k] = isHex(s[k]) ? (s[k] as string) : base[k];
  return out;
};

/** #RRGGBB + 不透明度 → rgba() */
export const rgba = (hex: string, a: number): string => {
  const n = parseInt((isHex(hex) ? hex : '#000000').slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
};

/** 两色混合：p=0 → a，p=1 → b */
export const blend = (a: string, b: string, p: number): string => {
  const h = (c: string) => {
    const n = parseInt((isHex(c) ? c : '#000000').slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const A = h(a);
  const B = h(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * p).toString(16).padStart(2, '0')).join('');
};

/** 装饰形状轮流用的三种颜色 */
export const shapeColors = (p: MotionPalette): string[] => [p.cool, p.accent, p.warm];
