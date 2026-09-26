// ============================================================
// journey / art 的颜色系统：角色、载具、天色、城市、街区。全部是本项目自己定的原创配色（v0.2.1 起整套换成「剪纸分层」皮肤）。
// 组件优先读 tokens.json 里的 art 覆盖（二创换皮只改令牌），没有就用这里的默认值。
// 天色用一个 0..1 的进度 p 表示：0 = 白天，0.35 = 午后，0.62 = 黄昏，0.82 = 蓝调，1 = 夜晚。
// ============================================================
import {useStyleTokens} from '../../context';
import tokens from '../tokens.json';

// 描边墨色：以 tokens.json 默认主题的 ink 为准（和 UI 元件同一支笔），令牌里没有时用深石油蓝。
// 角色、近景建筑、道具、招牌统一用它。不许用参考片那支近黑暖墨色。
const TK = tokens as unknown as {defaultTheme?: string; themes?: Record<string, {ink?: string}>};
export const INK_FALLBACK = '#15384A';
export const INK: string = TK.themes?.[TK.defaultTheme ?? '']?.ink ?? INK_FALLBACK;
/** 纸片投影色：剪纸分层——每一层都在身后那层上投一道硬边影子（World.tsx 的 paper 滤镜用） */
export const PAPER_SHADOW = '#0B2A38';

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
  fur: '#F28A3C', // 主体毛色：暖橘
  furLight: '#FFAE63',
  furDeep: '#D0681F', // 泪痕纹、耳背
  limb: '#5E2C22', // 四肢与尾巴环纹：深栗
  cream: '#FFF5E6', // 口鼻、眉斑、耳内
  blush: '#FF7A5C',
  scarf: '#23A36F', // 标志物：翡翠绿围巾
  scarfDeep: '#17784F',
  scarfStripe: '#FFF5E6',
  star: '#FFEA5A',
  glasses: '#3259C9',
  sweat: '#8FE3F0',
  clip: '#FFFDF7',
};
export type MascotColors = typeof MASCOT;

export const BOARD = {
  deck: '#3259C9', // 悬浮滑板：钴蓝
  deckLight: '#5577DD',
  rim: '#1F3A8A',
  stripe: '#FFB627', // 板面一道芥末黄条
  pod: '#EAF2EE',
  podDeep: '#A9BDB6',
  flameA: '#FFEA5A',
  flameB: '#FF8A2F',
  glow: '#7CFFD0', // 夜里喷口：薄荷辉光
  fin: '#23A36F',
  flag: '#FFB627',
  // 小飞艇
  balloon: '#FFB627',
  balloonDeep: '#D39A1E',
  balloonBand: '#1D8A8F',
  gondola: '#3259C9',
};
export type BoardColors = typeof BOARD;

// ---------------- 天色 ----------------
export type SkyStop = {at: number; top: string; bot: string; sun: string; far: string; cloud: string; haze: string};
// 自己的一套昼夜性格：薄荷晴空 → 柠檬午后 → 青蓝配橘子汽水的黄昏 → 深海蓝调 → 石油蓝夜。
// 远景是海玻璃绿 / 鼠尾草绿，不用奶油底、淡紫灰远景、粉橘黄昏、紫夜那一套
export const SKY: SkyStop[] = [
  {at: 0, top: '#4FB8D8', bot: '#CDEFE3', sun: '#FFE36E', far: '#9ED3C8', cloud: '#FFFFFF', haze: '#E4F7EF'},
  {at: 0.35, top: '#5AB3D6', bot: '#FFE9A6', sun: '#FFEA5A', far: '#B2D3AC', cloud: '#FFFFFF', haze: '#FFF4C9'},
  {at: 0.62, top: '#2B7A99', bot: '#FFB443', sun: '#FF6A2B', far: '#5E9A94', cloud: '#FFD08A', haze: '#FFC76B'},
  {at: 0.82, top: '#0F4A6B', bot: '#2E8F8F', sun: '#FF5A2E', far: '#1E5E6A', cloud: '#3F7F8C', haze: '#2A7880'},
  {at: 1, top: '#062633', bot: '#0E4B57', sun: '#FFF0C0', far: '#0B3945', cloud: '#15505C', haze: '#124A55'},
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
/** 给任何建筑色套上当前天色：黄昏偏琥珀、夜里压暗偏石油蓝 */
export const lit = (c: string, p: number) => mixHex(mixHex(c, '#FFA23A', duskOf(p) * 0.18), '#06303C', nightOf(p) * 0.6);

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
  walkDay: '#D6E5DE',
  walkNight: '#1C4550',
  curbDay: '#A9C2BA',
  curbNight: '#12363F',
  roadDay: '#3E5561',
  roadNight: '#0C2A33',
  dash: '#FFB627',
  lampPost: '#2E5563',
  lampGlow: '#FFD27A',
  tree: '#4FAE6A',
  treeDeep: '#35874E',
  trunk: '#9A6240',
  bush: '#6CC07E',
};
export const WINDOW = {day: '#F2FBF8', dayGlint: '#FFFFFF', on: '#FFAA3B', onWarm: '#FFD98A', off: '#1B4552'};

/**
 * 主题街区。main = 近景主楼色，mid = 中景淡色，accent = 点缀色。
 * 前六个是现代城市的主题街区（districts.tsx）；phone / home / cafe / market 是日常街区（everyday.tsx）；
 * gate / bridge / teahouse / lantern 是古城街区（oldtown.tsx，配 skyline: oldtown 的白墙黛瓦背景）
 * 色族：芥末、钴蓝、苔绿、橘子、石油青、翡翠——暖冷各半，不用粉、紫、品牌红
 */
export const DISTRICT_KINDS = ['docs', 'post', 'tools', 'creative', 'data', 'global', 'phone', 'home', 'cafe', 'market', 'gate', 'bridge', 'teahouse', 'lantern'] as const;
export type DistrictKind = (typeof DISTRICT_KINDS)[number];
export const DISTRICT: Record<DistrictKind, {main: string; deep: string; mid: string; accent: string}> = {
  docs: {main: '#E3A92A', deep: '#B07E12', mid: '#F1DB9F', accent: '#1D8A8F'},
  post: {main: '#3259C9', deep: '#213F99', mid: '#B4D8EC', accent: '#F2762E'},
  tools: {main: '#6F9A3C', deep: '#4F7427', mid: '#CFE0B3', accent: '#FFB627'},
  creative: {main: '#F2762E', deep: '#C2551A', mid: '#F9DE9A', accent: '#3259C9'},
  data: {main: '#1D8A8F', deep: '#146166', mid: '#B3DEDB', accent: '#FFB627'},
  global: {main: '#2F9E6E', deep: '#1F7550', mid: '#BFE3CF', accent: '#FF8A2F'},
  phone: {main: '#2E8BC0', deep: '#1E6690', mid: '#BCDDEE', accent: '#F5A623'},
  home: {main: '#5FA3A0', deep: '#3F7C79', mid: '#CDE5E2', accent: '#F28F3A'},
  cafe: {main: '#A8683A', deep: '#7E4A24', mid: '#E8D0BA', accent: '#2F9E6E'},
  market: {main: '#EE9B2E', deep: '#BF7414', mid: '#F8DDAF', accent: '#2F9E6E'},
  gate: {main: '#B03A36', deep: '#862A27', mid: '#E4CFC8', accent: '#1D5A6B'},
  bridge: {main: '#4F8A9E', deep: '#356676', mid: '#C4DCE2', accent: '#E0643A'},
  teahouse: {main: '#7A9E4E', deep: '#577634', mid: '#D8E4C4', accent: '#C0453A'},
  lantern: {main: '#D6313A', deep: '#A2222B', mid: '#F2CBA6', accent: '#F5B82E'},
};
/** 古城配色：白墙、黛瓦、石板、河水、灯笼 */
export const OLD = {wall: '#F1F5F0', wallShade: '#D6DED8', plinth: '#AEB8B2', tile: '#2E4450', tileLight: '#4D6572', wood: '#7A4B32', woodLight: '#9A6446', stone: '#C9D1CB', stoneDeep: '#A2AEA8', water: '#6FC2C4', waterDeep: '#3F9CA6', lantern: '#DE3A34', lanternGlow: '#FFB25A', willow: '#8CC86B'};
/** 背景天际线：modern 现代城市（默认）/ street 低层街巷 / oldtown 古城（白墙黛瓦、远山、宝塔、石板路和河） */
export type Skyline = 'modern' | 'street' | 'oldtown';
/** 霓虹色（夜景）：柑橘 + 青柠 + 薄荷一族（青柠和 UI 的强调色同一支），不用粉紫 */
export const NEON = ['#FF9F1C', '#7CFC3A', '#7CFFD0', '#5CC8FF', '#FF7A45'];
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
