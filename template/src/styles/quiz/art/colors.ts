import {useStylePalette} from '../../context';

// ============================================================
// quiz / art 配色：角色和小剧场只用当前主题（tokens.json 的 themes）里的颜色 + 由它们调出来的浅色。
// 不写死主题色：换主题（cream-tomato / blue-lime / 二创新配色）角色和场景自动跟着换。
// 固定的只有两种肤色和地面影（它们不属于主题语义）。全部平涂，不用渐变。
// ============================================================

export type ThemeColors = {bg: string; ink: string; primary: string; highlight: string; card: string; wrong?: string; cross?: string};

const FALLBACK: ThemeColors = {bg: '#F4EFE4', ink: '#1E1B18', primary: '#E4572E', highlight: '#FFE08A', card: '#FFFFFF'};

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
  /** 描边 / 头发 / 五官 */
  line: string;
  /** 主讲人肤色（浅） */
  skinA: string;
  /** 搭档肤色（小麦色） */
  skinB: string;
  /** 腮红（固定暖粉，不跟主题走：蓝色主题下掺主色会像淤青） */
  blushA: string;
  blushB: string;
  /** 张嘴时口腔 / 舌头 / 鼻线（固定暖色） */
  mouthIn: string;
  tongue: string;
  nose: string;
  /** 地面椭圆影 */
  ground: string;
  /** 主色的浅 / 深两档（布料暗部、场景墙面） */
  primarySoft: string;
  primaryPale: string;
  primaryDeep: string;
  highlightSoft: string;
  /** 墨色的中间调（裤子、场景家具） */
  inkSoft: string;
  inkPale: string;
  /** 场景墙 / 地板 / 窗外 */
  wall: string;
  wallAlt: string;
  floor: string;
  sky: string;
  wood: string;
  leaf: string;
};

export const artPalette = (p?: Partial<ThemeColors>): ArtPalette => {
  const c: ThemeColors = {...FALLBACK, ...(p ?? {})} as ThemeColors;
  const skinA = '#FCE5D2';
  const skinB = '#E7B58F';
  return {
    ...c,
    line: c.ink,
    skinA,
    skinB,
    blushA: mixHex(skinA, '#F07E6E', 0.34),
    blushB: mixHex(skinB, '#D9624F', 0.34),
    mouthIn: mixHex('#A8392E', c.ink, 0.35),
    tongue: '#F29A8C',
    nose: mixHex(skinB, c.ink, 0.3),
    ground: mixHex(c.bg, c.ink, 0.1),
    primarySoft: mixHex(c.primary, c.card, 0.45),
    primaryPale: mixHex(c.primary, c.card, 0.78),
    primaryDeep: mixHex(c.primary, c.ink, 0.28),
    highlightSoft: mixHex(c.highlight, c.card, 0.5),
    inkSoft: mixHex(c.ink, c.bg, 0.3),
    inkPale: mixHex(c.ink, c.bg, 0.72),
    wall: mixHex(c.bg, c.highlight, 0.28),
    wallAlt: mixHex(c.bg, c.primary, 0.12),
    floor: mixHex(c.bg, c.ink, 0.14),
    sky: mixHex(c.card, c.primary, 0.14),
    wood: mixHex(c.primary, c.highlight, 0.55),
    leaf: mixHex(c.ink, c.highlight, 0.64),
  };
};

/** 组件里用：取当前主题的角色 / 场景配色 */
export const useArtPalette = () => artPalette(useStylePalette() as Partial<ThemeColors>);
