// ============================================================
// journey / art 的颜色系统：角色、载具、天色、城市、街区。全部是本项目自己定的原创配色。
// 组件优先读 tokens.json 里的 art 覆盖（二创换皮只改令牌），没有就用这里的默认值。
// 天色用一个 0..1 的进度 p 表示：0 = 白天，0.35 = 午后，0.62 = 黄昏，0.82 = 蓝调，1 = 夜晚。
// ============================================================
import {useStyleTokens} from '../../context';

export const INK = '#1F191A';

type Rgb = [number, number, number];
const toRgb = (h: string): Rgb => {
  const s = h.replace('#', '');
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6);
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};
const toHex = ([r, g, b]: Rgb) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** 两色按 p 混合 */
export const mixHex = (a: string, b: string, p: number) => {
  const A = toRgb(a);
  const B = toRgb(b);
  const q = clamp01(p);
  return toHex([A[0] + (B[0] - A[0]) * q, A[1] + (B[1] - A[1]) * q, A[2] + (B[2] - A[2]) * q]);
};
/** 伪随机（同一个 i 永远同一个值），给窗灯、云、星星用 */
export const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------- 角色与载具 ----------------
export const MASCOT = {
  fur: '#F5993A', // 主体毛色：暖橘
  furLight: '#FFB861',
  furDeep: '#DE7A22', // 泪痕纹、耳背
  limb: '#7B3A22', // 四肢与尾巴环纹：深栗
  cream: '#FFF3E0', // 口鼻、眉斑、耳内
  blush: '#FF6F61',
  scarf: '#14B8A6', // 标志物：青绿围巾
  scarfDeep: '#0C8C7F',
  scarfStripe: '#FFFFFF',
  star: '#FFD93B',
  glasses: '#2F4BD8',
  sweat: '#8AD8FF',
  clip: '#FFFDF7',
};
export type MascotColors = typeof MASCOT;

export const BOARD = {
  deck: '#3558E8', // 悬浮滑板：电光蓝
  deckLight: '#5C7BF7',
  rim: '#22379E',
  stripe: '#FFFFFF',
  pod: '#E9EDF5',
  podDeep: '#AEB8CC',
  flameA: '#FFE066',
  flameB: '#FF8A3D',
  glow: '#7CF4FF',
  fin: '#14B8A6',
  flag: '#FF5A4E',
  // 小飞艇
  balloon: '#FFCF3F',
  balloonDeep: '#F0A81E',
  balloonBand: '#FF5A4E',
  gondola: '#3558E8',
};
export type BoardColors = typeof BOARD;

// ---------------- 天色 ----------------
export type SkyStop = {at: number; top: string; bot: string; sun: string; far: string; cloud: string; haze: string};
// 白天比初版柔一档（降饱和、远景偏灰蓝），但仍是蓝天 + 灰蓝远景：STYLE.md 规定避开参考片的「米白天空 + 淡紫中景」配色；黄昏粉橘
export const SKY: SkyStop[] = [
  {at: 0, top: '#92CCEC', bot: '#E4F3F2', sun: '#FFE27A', far: '#BCD3DE', cloud: '#FFFFFF', haze: '#EEF7F5'},
  {at: 0.35, top: '#9CC6E6', bot: '#FBE6CB', sun: '#FFD45E', far: '#C8D2D8', cloud: '#FFFFFF', haze: '#FFF1DE'},
  {at: 0.62, top: '#8A82C6', bot: '#F8B89A', sun: '#FF8452', far: '#BC9CB6', cloud: '#FFD6C8', haze: '#FFCDB0'},
  {at: 0.82, top: '#2C3A85', bot: '#77599C', sun: '#FF6A4A', far: '#554C86', cloud: '#8C7FB8', haze: '#6E5A98'},
  {at: 1, top: '#0B1535', bot: '#223A70', sun: '#FFF3C8', far: '#1D2B55', cloud: '#2A3B6B', haze: '#26386A'},
];
export const skyAt = (p: number): SkyStop => {
  const q = clamp01(p);
  let i = 0;
  while (i < SKY.length - 2 && q > SKY[i + 1].at) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const k = clamp01((q - a.at) / (b.at - a.at));
  const m = (x: keyof SkyStop) => mixHex(a[x] as string, b[x] as string, k);
  return {at: q, top: m('top'), bot: m('bot'), sun: m('sun'), far: m('far'), cloud: m('cloud'), haze: m('haze')};
};
/** 夜晚程度 0..1（窗灯、路灯、霓虹、星星跟它走） */
export const nightOf = (p: number) => clamp01((p - 0.6) / 0.32);
/** 黄昏程度 0..1（暖光） */
export const duskOf = (p: number) => clamp01(1 - Math.abs(p - 0.62) / 0.24);
/** 给任何建筑色套上当前天色：黄昏偏暖、夜里压暗偏蓝 */
export const lit = (c: string, p: number) => mixHex(mixHex(c, '#FF9A66', duskOf(p) * 0.16), '#141C45', nightOf(p) * 0.58);

/**
 * 按街区序号给天色进度：前面一直是白天/午后，倒数第二个街区进黄昏，最后一个街区是夜晚。
 * f = 当前在第几个街区（可带小数，0 = 第一个街区开头），n = 街区总数
 */
export const skyForDistrict = (f: number, n: number) => {
  if (n <= 1) return 0;
  const duskStart = Math.max(1, n - 2);
  if (f <= duskStart) return 0.35 * clamp01(f / duskStart);
  return Math.min(1, 0.35 + ((f - duskStart) / Math.max(0.6, n - 1 - duskStart)) * 0.65);
};

// ---------------- 城市 ----------------
export const STREET = {
  walkDay: '#EFE6D6',
  walkNight: '#39406A',
  curbDay: '#CDBFA8',
  curbNight: '#262D52',
  roadDay: '#5A6178',
  roadNight: '#1B2140',
  dash: '#FFD84D',
  lampPost: '#3B4260',
  lampGlow: '#FFE38A',
  tree: '#3DBE73',
  treeDeep: '#249A5A',
  trunk: '#8A5A3B',
  bush: '#56C98A',
};
export const WINDOW = {day: '#EAF6FF', dayGlint: '#FFFFFF', on: '#FFD86B', onWarm: '#FFF0B3', off: '#2A3462'};

/**
 * 主题街区。main = 近景主楼色，mid = 中景淡色，accent = 点缀色。
 * 前六个是现代城市的主题街区（districts.tsx）；phone / home / cafe / market 是日常街区（everyday.tsx）；
 * gate / bridge / teahouse / lantern 是古城街区（oldtown.tsx，配 skyline: oldtown 的白墙黛瓦背景）
 */
export const DISTRICT_KINDS = ['docs', 'launch', 'tools', 'creative', 'data', 'global', 'phone', 'home', 'cafe', 'market', 'gate', 'bridge', 'teahouse', 'lantern'] as const;
export type DistrictKind = (typeof DISTRICT_KINDS)[number];
export const DISTRICT: Record<DistrictKind, {main: string; deep: string; mid: string; accent: string}> = {
  docs: {main: '#3F6FF2', deep: '#2A4FC2', mid: '#B9C9F6', accent: '#FFC845'},
  launch: {main: '#FF5A4E', deep: '#D63C33', mid: '#F8C4BA', accent: '#3B4A6B'},
  tools: {main: '#F2A20C', deep: '#C97F00', mid: '#F6DCA6', accent: '#2F3A56'},
  creative: {main: '#E845A8', deep: '#B92C82', mid: '#F5C3E2', accent: '#7B5CFF'},
  data: {main: '#0FB5C9', deep: '#0A8C9D', mid: '#B2E6EE', accent: '#6A4DF4'},
  global: {main: '#2DAA5F', deep: '#1E8047', mid: '#BFE6CC', accent: '#FF8A3D'},
  phone: {main: '#5B6CFF', deep: '#3C4BD6', mid: '#C8CDFB', accent: '#FFB547'},
  home: {main: '#F0795B', deep: '#C95A3F', mid: '#F8CDBF', accent: '#3E81DE'},
  cafe: {main: '#C7773F', deep: '#9A5327', mid: '#EED3BD', accent: '#2BB29B'},
  market: {main: '#E8603C', deep: '#B8442A', mid: '#F6CDB9', accent: '#2DAA5F'},
  gate: {main: '#B8483A', deep: '#8E3328', mid: '#E6CFC6', accent: '#2F3A56'},
  bridge: {main: '#5F87A6', deep: '#44657F', mid: '#C9D7E0', accent: '#D9534F'},
  teahouse: {main: '#6F9A52', deep: '#4E7437', mid: '#D6E2C6', accent: '#C8473A'},
  lantern: {main: '#D8342B', deep: '#A3231D', mid: '#EFC2B8', accent: '#F2B233'},
};
/** 古城配色：白墙、黛瓦、石板、河水、灯笼 */
export const OLD = {wall: '#F3EFE6', wallShade: '#DDD6C9', plinth: '#B9B2A6', tile: '#3E4450', tileLight: '#5C6374', wood: '#7A4B32', woodLight: '#9A6446', stone: '#CFC9BE', stoneDeep: '#A9A296', water: '#8FC3D6', waterDeep: '#5E9DB6', lantern: '#E2402F', lanternGlow: '#FFB25A', willow: '#8CC86B'};
/** 背景天际线：modern 现代城市（默认）/ street 低层街巷 / oldtown 古城（白墙黛瓦、远山、宝塔、石板路和河） */
export type Skyline = 'modern' | 'street' | 'oldtown';
/** 霓虹色（夜景） */
export const NEON = ['#FFD23F', '#FF5E7E', '#4DE6FF', '#A8FF60', '#B18CFF'];

/** 读令牌里的 art 覆盖：tokens.art.mascot / tokens.art.board / tokens.art.district.<kind> */
export const useArtColors = () => {
  const tk = useStyleTokens();
  const art = (tk?.art ?? {}) as {mascot?: Partial<MascotColors>; board?: Partial<BoardColors>; district?: Partial<Record<DistrictKind, Partial<(typeof DISTRICT)[DistrictKind]>>>};
  return {
    mascot: {...MASCOT, ...(art.mascot ?? {})},
    board: {...BOARD, ...(art.board ?? {})},
    district: (k: DistrictKind) => ({...DISTRICT[k], ...(art.district?.[k] ?? {})}),
  };
};
