import {useStylePalette} from '../../context';

// ============================================================
// quiz / art 配色。分两层：
//   1. 主题色（tokens.json 的 themes）：底色 bg、墨色 ink（描边 / 五官）、白卡 card。换主题这三样跟着变。
//   2. 人设色 CAST：两个角色的衣服、道具，以及小剧场里的家具、植物、灯。角色是我们自己的形象，
//      换主题不换衣服（否则换到某些主题会撞上别人的角色配色）。主题里写了 castWarm / castDeep /
//      castLight / castSand / castGlow 就用主题的，没写用下面的默认值。
// 默认人设色：暖橙 + 墨绿 + 奶白，琥珀色当「懂了」的亮灯色；墨绿 / 琥珀和默认主题 sage-pine 的 primary / highlight 同值。全部平涂，不用渐变。
// ============================================================

export type ThemeColors = {bg: string; ink: string; primary: string; highlight: string; card: string; wrong?: string; cross?: string};

/** 没有主题上下文时（单独预览）用默认主题 sage-pine 的值 */
const FALLBACK: ThemeColors = {bg: '#CFDCCD', ink: '#1B1F1C', primary: '#1F5C48', highlight: '#F4A81C', card: '#FBFAF3'};

/** 默认人设色（主题可用 castXxx 覆盖） */
export const CAST = {
  /** 暖橙：主讲人夹克、搭档胸前条纹 / 帽檐 / 高帮鞋 */
  warm: '#EE7A3B',
  /** 墨绿：主讲人耳机 / 短裤 / 鞋底，搭档毛衣 / 棒球帽（= 默认主题 sage-pine 的 primary 松绿） */
  deep: '#1F5C48',
  /** 奶白：拉链、袜子、袖口、领口、鞋面 */
  light: '#FFF3E0',
  /** 沙色：搭档工装裤 */
  sand: '#D2B67E',
  /** 琥珀：耳机亮灯（= 听懂了）、徽章、小剧场里的灯（= 默认主题的 highlight 杏黄） */
  glow: '#F4A81C',
  /** 主讲人栗色头发 */
  hair: '#5B3426',
} as const;

const hex = (c: string) => {
  const s = c.replace('#', '');
  const f = s.length === 3 ? s.split('').map((x) => x + x).join('') : s.slice(0, 6);
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** 两色按比例混合：p=0 → a，p=1 → b */
export const mixHex = (a: string, b: string, p: number) => {
  const A = hex(a);
  const B = hex(b);
  return toHex(A[0] + (B[0] - A[0]) * p, A[1] + (B[1] - A[1]) * p, A[2] + (B[2] - A[2]) * p);
};

export type ArtPalette = ThemeColors & {
  /** 描边 / 五官 / 搭档头发 */
  line: string;
  /** 主讲人肤色（偏小麦的暖桃色） */
  skinA: string;
  /** 搭档肤色（深棕） */
  skinB: string;
  /** 主讲人头发（栗色） */
  hairA: string;
  /** 腮红（固定暖色，不跟主题走） */
  blushA: string;
  blushB: string;
  /** 搭档雀斑 */
  freckle: string;
  /** 张嘴时口腔 / 舌头 / 鼻线（固定暖色） */
  mouthIn: string;
  tongue: string;
  nose: string;
  /** 地面椭圆影 */
  ground: string;
  /** 人设色及其深浅档 */
  warm: string;
  warmSoft: string;
  warmPale: string;
  warmDeep: string;
  deep: string;
  deepSoft: string;
  deepPale: string;
  deepDark: string;
  light: string;
  sand: string;
  sandDeep: string;
  glow: string;
  glowSoft: string;
  /** 旧名保留（镜头作者可能在用）：主色 / 亮色的浅深档，现在指向人设色 */
  primarySoft: string;
  primaryPale: string;
  primaryDeep: string;
  highlightSoft: string;
  /** 墨色的中间调（显示器、咖啡机这类深色家具） */
  inkSoft: string;
  inkPale: string;
  /** 场景墙 / 地板 / 窗外 / 木头 / 叶子 */
  wall: string;
  wallAlt: string;
  floor: string;
  sky: string;
  wood: string;
  leaf: string;
};

export const artPalette = (p?: Partial<ThemeColors> & Record<string, string | undefined>): ArtPalette => {
  const c: ThemeColors = {...FALLBACK, ...(p ?? {})} as ThemeColors;
  const pick = (k: string, d: string) => (p && typeof p[k] === 'string' && /^#[0-9a-f]{3,8}$/i.test(p[k] as string) ? (p[k] as string) : d);
  const warm = pick('castWarm', CAST.warm);
  const deep = pick('castDeep', CAST.deep);
  const light = pick('castLight', CAST.light);
  const sand = pick('castSand', CAST.sand);
  const glow = pick('castGlow', CAST.glow);
  const skinA = '#EFC19C';
  const skinB = '#B57653';
  const warmSoft = mixHex(warm, light, 0.45);
  const warmPale = mixHex(warm, light, 0.78);
  const warmDeep = mixHex(warm, c.ink, 0.3);
  const glowSoft = mixHex(glow, light, 0.5);
  return {
    ...c,
    line: c.ink,
    skinA,
    skinB,
    hairA: CAST.hair,
    blushA: mixHex(skinA, '#EF7560', 0.36),
    blushB: mixHex(skinB, '#C4473A', 0.34),
    freckle: mixHex(skinB, '#5A2E1E', 0.5),
    mouthIn: mixHex('#A8392E', c.ink, 0.35),
    tongue: '#E2735E',
    nose: mixHex(skinB, c.ink, 0.35),
    ground: pick('ground', mixHex(c.bg, c.ink, 0.1)),
    warm,
    warmSoft,
    warmPale,
    warmDeep,
    deep,
    deepSoft: mixHex(deep, light, 0.3),
    deepPale: mixHex(deep, light, 0.8),
    deepDark: mixHex(deep, c.ink, 0.35),
    light,
    sand,
    sandDeep: mixHex(sand, warmDeep, 0.3),
    glow,
    glowSoft,
    primarySoft: warmSoft,
    primaryPale: warmPale,
    primaryDeep: warmDeep,
    highlightSoft: glowSoft,
    inkSoft: mixHex(c.ink, c.bg, 0.3),
    inkPale: mixHex(c.ink, c.bg, 0.72),
    wall: mixHex(c.card, glow, 0.14),
    wallAlt: mixHex(c.card, warm, 0.1),
    floor: mixHex(c.card, sand, 0.6),
    sky: mixHex(c.card, deep, 0.12),
    wood: mixHex(sand, warm, 0.35),
    leaf: mixHex(deep, light, 0.22),
  };
};

/** 组件里用：取当前主题的角色 / 场景配色 */
export const useArtPalette = () => artPalette(useStylePalette() as Partial<ThemeColors> & Record<string, string>);
