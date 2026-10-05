// 取景框：动效画面在 B-roll 框里能放字的那一整块。让开：竖版贴顶时平台标题栏（顶 205/1920）、竖版平台底部文案
// （1340/1920 以下）、字幕块顶边、画中画圆窗。字幕块按行数变高时，调用方把最靠上的那条字幕的 y 传进来即可。
// 模板按取景框的宽高重新排版、把它填满；取景框外面只画背景和装饰（MotionLayer 的 Backdrop）。
// 纯函数，只有类型依赖，节点测试直接引用。
import type {Rect} from '../layout';

/** 竖版：画面顶上被平台标题、状态栏盖住的高度（比例，和 core/safe.ts 的 BG_ONLY.top = 205 一致） */
export const TOP_UNSAFE = 205 / 1920;
/** 竖版：画面底下被平台文案、按钮盖住的起点（比例，BG_ONLY.bottom = 1340） */
export const BOTTOM_UNSAFE = 1340 / 1920;

export type FreeInput = {
  /** B-roll 框（成片像素） */
  box: Rect;
  /** 成片宽高 */
  compW: number;
  compH: number;
  /** 字幕块顶边（成片像素）；没有字幕层传 null。字幕按行数变高时传这一段里最靠上的那条 */
  captionTop: number | null;
  /** 画中画圆窗等要让开的东西（成片像素）；不在框里的自动忽略 */
  avoid?: Rect | null;
};

const overlaps = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0;

/**
 * 取景框（成片像素，绝对坐标）。
 * 上下：先按全部规矩算；太扁（不到框高 30%）时先放开平台顶栏，再放开平台底栏，字幕永远不压。
 * 圆窗压进来时：把底边提到圆窗上沿，或把靠圆窗那一侧收到圆窗旁边，哪个剩得多用哪个（底边提得太狠就只收侧边）。
 */
export const freeRect = ({box, compW, compH, captionTop, avoid}: FreeInput): Rect => {
  const vertical = compH > compW;
  const mx = Math.max(8, box.width * 0.04);
  const my = Math.max(8, box.height * 0.03);
  const gap = Math.max(6, compH * 0.012);
  let left = box.x + mx;
  let right = box.x + box.width - mx;
  const boxTop = box.y + my;
  const boxBottom = box.y + box.height - my;
  const platformTop = vertical && box.y <= 0 ? Math.max(boxTop, compH * TOP_UNSAFE) : boxTop;
  const platformBottom = vertical ? Math.min(boxBottom, compH * BOTTOM_UNSAFE) : boxBottom;
  const capBottom = captionTop != null && captionTop > box.y && captionTop < box.y + box.height ? captionTop - gap : Infinity;
  const minH = box.height * 0.3;
  const tries: [number, number][] = [
    [platformTop, Math.min(platformBottom, capBottom)],
    [boxTop, Math.min(platformBottom, capBottom)],
    [boxTop, Math.min(boxBottom, capBottom)],
  ];
  let [top, bottom] = tries.find(([t, b]) => b - t >= minH) ?? tries[tries.length - 1];
  if (bottom - top < 1) bottom = top + 1;

  if (avoid && overlaps(avoid.x - gap, avoid.x + avoid.width + gap, left, right) && overlaps(avoid.y - gap, avoid.y + avoid.height, top, bottom)) {
    const area = (l: number, r: number, t: number, b: number) => Math.max(0, r - l) * Math.max(0, b - t);
    const liftedBottom = Math.min(bottom, avoid.y - gap);
    const onRight = avoid.x + avoid.width / 2 > (left + right) / 2;
    const nl = onRight ? left : Math.max(left, avoid.x + avoid.width + gap);
    const nr = onRight ? Math.min(right, avoid.x - gap) : right;
    const liftOk = liftedBottom - top >= minH * 0.5;
    if (liftOk && area(left, right, top, liftedBottom) >= area(nl, nr, top, bottom)) bottom = liftedBottom;
    else {
      left = nl;
      right = nr;
    }
  }
  return {x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top)};
};
