// 舞台：把「按 1080×1920 画、主体在 y 560–1340」的宣传片镜头，塞进口播合成里任意大小的 B-roll 框。
// 做法：虚拟画布宽 1080，基础缩放 s = 框宽 / 1080；镜头真正占的那块（content，镜头坐标）整体平移、按需再缩小（k ≤ 1），
// 落到框里的「可用区」正中。可用区让开：竖版贴顶时平台标题栏（顶 205/1920）、竖版平台底部文案（1340/1920 以下）、
// 字幕块顶边、画中画圆窗。字幕块按行数变高时，调用方把最靠上的那条字幕的 y 传进来即可。
// 纯函数，只有类型依赖，节点测试直接引用。
import type {Rect} from '../layout';

/** 宣传片镜头的虚拟画布 */
export const VW = 1080;
export const VH = 1920;
/** 镜头主体区（core/safe.ts 的 MAIN），content 没给时就用它 */
export const SHOT_MAIN: VBox = {x0: 150, x1: 930, y0: 560, y1: 1340};
/** 竖版：画面顶上被平台标题、状态栏盖住的高度（比例，和 core/safe.ts 的 BG_ONLY.top = 205 一致） */
export const TOP_UNSAFE = 205 / 1920;
/** 竖版：画面底下被平台文案、按钮盖住的起点（比例，BG_ONLY.bottom = 1340） */
export const BOTTOM_UNSAFE = 1340 / 1920;

/** 镜头坐标（1080×1920 虚拟画布）里的一块 */
export type VBox = {x0: number; x1: number; y0: number; y1: number};

export type Stage = {
  /** 基础缩放：1080 宽的虚拟画布缩放到框宽 */
  s: number;
  /** 再缩小的倍数（≤ 1）：内容放不下可用区时才 < 1 */
  k: number;
  /** 最终每个虚拟像素占多少成片像素（= s × k） */
  u: number;
  /** 1080×1920 画布在框内的平移（成片像素，相对框左上角）；变换写成 translate(tx, ty) scale(u)，原点左上 */
  tx: number;
  ty: number;
  /** 用到的可用区（成片像素，绝对坐标） */
  free: {left: number; right: number; top: number; bottom: number};
  /** content 最终落在成片上的位置（成片像素，绝对坐标），给测试和版式自查用 */
  placed: Rect;
};

export type StageInput = {
  /** B-roll 框（成片像素） */
  box: Rect;
  /** 成片宽高 */
  compW: number;
  compH: number;
  /** 字幕块顶边（成片像素）；没有字幕层传 null。字幕按行数变高时传这一段里最靠上的那条 */
  captionTop: number | null;
  /** 画中画圆窗等要让开的东西（成片像素）；不在框里的自动忽略 */
  avoid?: Rect | null;
  /** 要放进来的那块（镜头坐标），默认主体区 */
  content?: VBox;
};

const overlaps = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0;

export const stageOf = ({box, compW, compH, captionTop, avoid, content = SHOT_MAIN}: StageInput): Stage => {
  const vertical = compH > compW;
  const s = box.width / VW;
  const mx = Math.max(8, box.width * 0.04);
  const my = Math.max(8, box.height * 0.03);
  const gap = Math.max(6, compH * 0.012);
  const left = box.x + mx;
  const right = box.x + box.width - mx;
  const boxTop = box.y + my;
  const boxBottom = box.y + box.height - my;
  const platformTop = vertical && box.y <= 0 ? Math.max(boxTop, compH * TOP_UNSAFE) : boxTop;
  const platformBottom = vertical ? Math.min(boxBottom, compH * BOTTOM_UNSAFE) : boxBottom;
  const capBottom = captionTop != null && captionTop > box.y && captionTop < box.y + box.height ? captionTop - gap : Infinity;
  const cw = Math.max(1, content.x1 - content.x0);
  const ch = Math.max(1, content.y1 - content.y0);
  const minH = box.height * 0.3;

  // 先按全部规矩算；可用区太扁时先放开平台顶栏，再放开平台底栏，字幕永远不压
  const tries: [number, number][] = [
    [platformTop, Math.min(platformBottom, capBottom)],
    [boxTop, Math.min(platformBottom, capBottom)],
    [boxTop, Math.min(boxBottom, capBottom)],
  ];
  let [top, bottom] = tries.find(([t, b]) => b - t >= minH) ?? tries[tries.length - 1];
  if (bottom - top < 1) bottom = top + 1;

  const fit = (t: number, b: number) => {
    const u = Math.min(s, (right - left) / cw, (b - t) / ch);
    const w = cw * u;
    const h = ch * u;
    const x = (left + right) / 2 - w / 2;
    const y = (t + b) / 2 - h / 2;
    return {u, placed: {x, y, width: w, height: h}};
  };
  let f = fit(top, bottom);
  // 画中画圆窗：内容横向和它有交叠、竖向又压到它，就把可用区底边提到圆窗上沿
  if (avoid && overlaps(avoid.x, avoid.x + avoid.width, box.x, box.x + box.width) && overlaps(avoid.y, avoid.y + avoid.height, box.y, box.y + box.height)) {
    const p = f.placed;
    if (overlaps(p.x, p.x + p.width, avoid.x - gap, avoid.x + avoid.width + gap) && overlaps(p.y, p.y + p.height, avoid.y - gap, avoid.y + avoid.height)) {
      const b2 = Math.min(bottom, avoid.y - gap);
      if (b2 - top >= minH * 0.5) {
        bottom = b2;
        f = fit(top, bottom);
      }
    }
  }
  const {u, placed} = f;
  // 镜头坐标 (x, y) → 成片 (box.x + tx + x·u, box.y + ty + y·u)
  const tx = placed.x - box.x - content.x0 * u;
  const ty = placed.y - box.y - content.y0 * u;
  return {s, k: u / s, u, tx, ty, free: {left, right, top, bottom}, placed};
};

/** 镜头坐标 → 成片像素（测试、版式自查用） */
export const toComp = (st: Stage, box: Rect, x: number, y: number) => ({x: box.x + st.tx + x * st.u, y: box.y + st.ty + y * st.u});
