// ============================================================
// journey 的「世界剧本」：分镜 → 街区列表 + 相机曲线 + 各层世界坐标。一镜到底的风格音画要对得上，
// 全靠这里先把时刻定死，再反推道具放在哪（拆解附 B 第 4 条：先定笑点时刻，再把道具放到那一刻正好到角色面前的位置）。
//
//   相机 x(t) = ∫速度 dt（前景层像素）。速度：开场怠速 → 起飞加速到巡航 → 每个街区的笑点窗口减速（0.52–0.7 倍）→ 片尾减速到 0
//   某层（视差系数 f）上的物体，屏幕 x = 物体层坐标 - camAt(t) × f
//   路牌：街区第 0 拍正好经过角色（车票上的当前站同一拍切换）
//   明信片：第 boardReadBeat 拍时中心在屏幕 boardReadX 处（最好读的位置）
//   道具：第 gagAt 拍时正好在角色面前
// ============================================================
import {FPS} from '../../../core/safe';
import {DISTRICT, DistrictKind, INK, Skyline} from '../art/palette';
import type {Slot} from '../../../core/timeline';
import type {Storyboard} from '../../../schema';

export type Tokens = Record<string, any>;
export type Expr = 'normal' | 'happy' | 'excited' | 'surprised' | 'squash' | 'relaxed' | 'lean' | 'offer' | 'curious' | 'pose' | 'wave';
export type Phase = 'day' | 'warm' | 'dusk' | 'night';

export type SceneDef = {
  name: {zh: string; en: string};
  gag: string;
  props: string[];
  slow: [number, number, number];
  gagAt: number;
  expr: [number, number, Expr][];
  burst: {zh: string; en: string};
  burstTone: 'yellow' | 'blue' | 'gray';
  burstAt: number;
  bubble: {zh: string; en: string};
  bubbleAt: number;
  sfx: [number, string, number][];
  /** 能配哪些背景天际线（checks.mjs 也按它拦） */
  fits?: Skyline[];
  /** 夜景街区（只放最后一站） */
  night?: boolean;
  /** catch 笑点抛来的东西：box 礼盒 / cup 咖啡 / tea 茶杯 */
  item?: 'box' | 'cup' | 'tea';
};

export type District = {
  /** 第几个街区（0 起） */
  k: number;
  /** 分镜里第几镜 */
  shotIndex: number;
  start: number;
  dur: number;
  scene: string;
  def: SceneDef;
  color: string;
  phase: Phase;
  category: string;
  title: string;
  tag?: string;
  source?: string;
  bubble: string;
  burst: string;
  /** 夜站台街区屋顶对话框上的字：类别名 + 标签 */
  words: string[];
  /** 道具配色（scenes.*.props 的槽位已换成这个街区的美术配色） */
  props: string[];
};

export type Plan = {
  beat: number;
  total: number;
  opening?: Slot;
  finale?: Slot;
  districts: District[];
  /** 相机位置（前景层像素） */
  camAt: (t: number) => number;
  speedAt: (t: number) => number;
  /** t 时刻所在街区序号（还没进第一个街区 = -1） */
  districtAt: (t: number) => number;
  /** 美术城市：建筑缩放（世界单位 → 屏幕像素）、每个街区的世界宽、第一个街区的世界 x 起点 */
  city: {scale: number; districtW: number; x0: number; kinds: ArtKind[]};
  /** 背景天际线（opening.params.skyline）：modern / street / oldtown */
  skyline: Skyline;
  /** 天色进度 0..1（美术 SKY 色标：0 白天 → 0.35 午后 → 0.62 黄昏 → 1 夜） */
  skyP: (t: number) => number;
};

/** 美术的街区外观（art/palette.ts 的 DISTRICT_KINDS） */
export type ArtKind = DistrictKind;
/** 剧情街区类型（scene）→ 美术街区外观 */
export const ART_KIND: Record<string, ArtKind> = {
  crossing: 'docs', postbox: 'post', punch: 'tools', booth: 'creative', hitch: 'data', platform: 'global',
  market: 'market', phone: 'phone', home: 'home', cafe: 'cafe',
  gate: 'gate', bridge: 'bridge', teahouse: 'teahouse', lantern: 'lantern',
};
export const SKYLINES: Skyline[] = ['modern', 'street', 'oldtown'];
/** 美术街区的世界宽（近景层，未缩放）与邮局街区邮筒楼的位置，见 art/districts.tsx */
const ART_DISTRICT_W = 2200;
const ART_POSTBOX_X = 1090;
const PHASE_SKY: Record<Phase, number> = {day: 0.08, warm: 0.36, dusk: 0.64, night: 1};

export const sceneIds = (tk: Tokens): string[] => Object.keys(tk.scenes ?? {}).filter((k) => !k.startsWith('$'));

/** 某个街区的天色阶段：最后一个 = 夜，倒数第二 = 黄昏，倒数第三 = 暖（≥5 个街区时），其余白天 */
export const phaseOf = (k: number, n: number): Phase => {
  if (n <= 1) return 'day';
  const fromEnd = n - 1 - k;
  if (fromEnd === 0 && n >= 3) return 'night';
  if (fromEnd === 1 && n >= 3) return 'dusk';
  if (fromEnd === 2 && n >= 5) return 'warm';
  return 'day';
};

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export const buildPlan = (sb: Storyboard, slots: Slot[], beat: number, tk: Tokens, opts: {cityScale?: number; mascotX?: number} = {}): Plan => {
  const cam = tk.camera ?? {};
  const cruise0: number = cam.cruisePxPerSec ?? 553;
  const cityScale = opts.cityScale ?? 0.9;
  const mascotX = opts.mascotX ?? 378;
  /** 一个街区在前景层走过的像素 = 美术街区宽 × 缩放；每个街区单独定巡航速度，让美术街区正好首尾相接 */
  const distW = ART_DISTRICT_W * cityScale;
  const idle: number = cam.idlePxPerSec ?? 65;
  const ramp: number = cam.rampSec ?? 0.25;
  const lang = sb.meta?.lang === 'en' ? 'en' : 'zh';
  const ids = sceneIds(tk);
  const order: string[] = (tk.sceneOrder ?? ids).filter((s: string) => ids.includes(s));
  const typeOf = (s: Slot) => s.shot.type as string;
  const opening = slots.find((s) => typeOf(s) === 'opening');
  const finale = slots.find((s) => typeOf(s) === 'finale');
  const dSlots = slots.filter((s) => typeOf(s) === 'district');
  const n = dSlots.length;
  const districts: District[] = dSlots.map((s, k) => {
    const p = (s.shot.params ?? {}) as Record<string, unknown>;
    const want = str(p.scene);
    const scene = want && ids.includes(want) ? want : order[k % Math.max(1, order.length)] ?? ids[0];
    const def = tk.scenes[scene] as SceneDef;
    // 类别色 = 该街区美术外观的主色（令牌 art.district 可覆盖），和楼群一个颜色；districtColors 只在美术色缺失时兜底
    const kind = ART_KIND[scene] ?? 'docs';
    const art = {...(DISTRICT[kind] ?? {}), ...(tk.art?.district?.[kind] ?? {})} as Record<string, string>;
    const colors: string[] = art.main ? [art.main] : ['#5E6573'];
    // 道具配色槽位：main / deep / mid / accent = 这个街区的美术配色，white / ink = 纸白和描边色，其余照写（#RRGGBB）
    const slot = (v: string) => (v === 'white' ? '#FFFFFF' : v === 'ink' ? INK : art[v] ?? (/^#[0-9a-fA-F]{6}$/.test(v) ? v : art.main ?? '#5E6573'));
    const props = (Array.isArray(def.props) ? def.props : ['main', 'accent', 'mid', 'deep']).map(slot);
    return {
      k,
      shotIndex: s.i,
      start: s.start,
      dur: s.dur,
      scene,
      def,
      color: typeof p.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : colors[k % colors.length],
      phase: phaseOf(k, n),
      category: str(p.category) ?? '',
      title: str(p.title) ?? '',
      tag: str(p.tag),
      source: str(p.source),
      bubble: str(p.bubble) ?? def.bubble[lang],
      burst: str(p.burst) ?? def.burst[lang],
      words: [str(p.category), str(p.tag)].filter((x): x is string => !!x),
      props,
    };
  });
  const total = slots.length ? slots[slots.length - 1].end : 1;

  // ---- 速度曲线 ----
  // 每个街区：巡航速度 cruiseK[k] × 减速形状（笑点窗口 0.52–0.7 倍）；相邻街区的巡航速度在路牌前后 0.25 秒内平滑过渡
  const cruiseK = districts.map(() => cruise0);
  const shapeAt = (d: District, t: number) => {
    const [b0, b1, f] = d.def.slow ?? [3, 6, 0.7];
    const into = smooth((t - (d.start + b0 * beat)) / ramp);
    const out = smooth((t - (d.start + b1 * beat)) / ramp);
    return 1 - into * (1 - out) * (1 - f);
  };
  const levelAt = (t: number) => {
    if (!districts.length) return cruise0;
    let lv = cruiseK[0];
    for (let k = 1; k < districts.length; k++) lv += (cruiseK[k] - cruiseK[k - 1]) * smooth((t - districts[k].start + ramp) / (2 * ramp));
    return lv;
  };
  const speedAt = (t: number): number => {
    const lv = levelAt(t);
    if (opening && t < opening.end) {
      const u0 = opening.start + opening.dur * (cam.takeoffFrom ?? 0.45);
      const k = smooth((t - u0) / Math.max(0.1, opening.end - u0));
      return idle + (lv - idle) * k;
    }
    if (finale && t >= finale.start) {
      const stop: number = cam.finaleStopSec ?? 1.3;
      const u = Math.min(1, (t - finale.start) / stop);
      return lv * (1 - u) * (1 - u);
    }
    const d = districts.find((x) => t >= x.start && t < x.start + x.dur);
    return d ? lv * shapeAt(d, t) : lv;
  };

  // 逐帧积分（每帧 4 个子步），查表插值；迭代 3 次把每个街区走过的距离校准到 distW
  const frames = Math.ceil(total * FPS) + 2;
  const table = new Float64Array(frames + 1);
  const integrate = () => {
    for (let f = 0; f < frames; f++) {
      let acc = 0;
      for (let q = 0; q < 4; q++) acc += speedAt((f + (q + 0.5) / 4) / FPS);
      table[f + 1] = table[f] + acc / 4 / FPS;
    }
  };
  const camAt = (t: number): number => {
    const x = t * FPS;
    if (x <= 0) return (x * idle) / FPS;
    if (x >= frames) return table[frames] + ((x - frames) * speedAt(total)) / FPS;
    const i = Math.floor(x);
    return table[i] + (table[i + 1] - table[i]) * (x - i);
  };
  for (let it = 0; it < 4; it++) {
    integrate();
    if (it === 3) break;
    districts.forEach((d, k) => {
      const got = camAt(d.start + d.dur) - camAt(d.start);
      if (got > 1) cruiseK[k] *= distW / got;
    });
  }
  const districtAt = (t: number) => {
    let k = -1;
    for (const d of districts) if (t >= d.start - 1e-6) k = d.k;
    return k;
  };

  // ---- 美术城市的世界坐标 ----
  // 路牌边界（第 0 拍经过角色）在前景层的 x = camAt(start) + mascotX。美术街区整体向后错开 o，
  // 让邮局街区的邮筒楼正好在笑点那一拍停在角色前方（postboxDX 像素处，贴纸从它的投信口吐出来）；没有邮筒街区就不错开
  const kinds = districts.map((d) => ART_KIND[d.scene] ?? 'docs');
  const b0 = districts.length ? (camAt(districts[0].start) + mascotX) / cityScale : 0;
  let o = 0;
  const L = districts.find((d) => d.def.gag === 'sticker');
  if (L) {
    const gx = (camAt(L.start + L.def.gagAt * beat) + mascotX + (cam.postboxDX ?? 170)) / cityScale; // 笑点时邮筒楼该在的世界 x
    const x0L = b0 + L.k * ART_DISTRICT_W;
    o = gx - (x0L + ART_POSTBOX_X);
    // 错开量限制在街区宽的 ±25%，免得路牌离街区太远
    o = Math.max(-ART_DISTRICT_W * 0.25, Math.min(ART_DISTRICT_W * 0.25, o));
  }
  const city = {scale: cityScale, districtW: ART_DISTRICT_W, x0: b0 + o, kinds};

  // ---- 天色：每个街区一个色标，在路牌经过前 0.45 × skyLerp 秒开始线性过渡 ----
  const lerp: number = tk.motion?.skyLerp ?? 2.2;
  const skyP = (t: number) => {
    if (!districts.length) return 0;
    let p = 0;
    for (let k = 0; k < districts.length; k++) {
      const target = PHASE_SKY[districts[k].phase] + (districts[k].phase === 'day' ? 0.2 * (k / Math.max(1, districts.length - 1)) : 0);
      const a = districts[k].start - lerp * 0.45;
      const q = Math.max(0, Math.min(1, (t - a) / lerp));
      if (q <= 0) break;
      p = p + (target - p) * q;
    }
    return p;
  };
  const sk = str((opening?.shot.params as Record<string, unknown> | undefined)?.skyline);
  const skyline: Skyline = sk && (SKYLINES as string[]).includes(sk) ? (sk as Skyline) : 'modern';
  return {beat, total, opening, finale, districts, camAt, speedAt, districtAt, city, skyP, skyline};
};

/** 视差层上的「边界」：街区 k 在这一层从哪个层坐标开始（它的路牌在第 0 拍经过角色） */
export const boundaryOn = (plan: Plan, k: number, f: number, mascotX: number) => plan.camAt(plan.districts[k].start) * f + mascotX;

/** 层坐标 L（视差 f）属于第几个街区：-1 = 开场段 */
export const districtOfLayerX = (plan: Plan, L: number, f: number, mascotX: number) => {
  let k = -1;
  for (const d of plan.districts) if (L >= boundaryOn(plan, d.k, f, mascotX) - 40) k = d.k;
  return k;
};

/** 伪随机（按整数种子，稳定） */
export const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** 当前表情：开场待命 → 起飞兴奋；街区按场景表；片尾欢呼 */
export const exprAt = (plan: Plan, t: number): Expr => {
  const b = plan.beat;
  if (plan.opening && t < plan.opening.end) {
    const u = (t - plan.opening.start) / plan.opening.dur;
    return u < 0.45 ? 'happy' : 'excited';
  }
  if (plan.finale && t >= plan.finale.start) return t - plan.finale.start < 1.3 ? 'excited' : 'pose';
  const k = plan.districtAt(t);
  if (k < 0) return 'normal';
  const d = plan.districts[k];
  const lb = (t - d.start) / b;
  for (const [a, z, e] of d.def.expr ?? []) if (lb >= a && lb < z) return e;
  // 上一个街区的表情不拖进下一个街区，干净切回常态
  return 'normal';
};
