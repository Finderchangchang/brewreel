// 取景框：动效画面在 B-roll 框里能放字的那一整块。让开：竖版贴顶时平台标题栏（顶 205/1920）、字幕块（卡片底和字幕顶隔够 24 像素@720）、
// 画中画圆窗；竖版 pip / full 还让开抖音右侧的图标列（左右各留 60 像素@720，卡片右边不过 x 660）。
// 字幕块按行数变高时，调用方把最靠上的那条字幕的 y 传进来即可。
// 模板按取景框的宽高重新排版、把它填满；取景框外面只画背景和装饰（MotionLayer 的 Backdrop，装饰只放在取景框外扩出来的禁区以外）。
// 纯函数，只有类型依赖，节点测试直接引用。
import type {Rect} from '../layout';

/** 竖版：画面顶上被平台标题、状态栏盖住的高度（比例，和 core/safe.ts 的 BG_ONLY.top = 205 一致） */
export const TOP_UNSAFE = 205 / 1920;
/** 竖版：画面底下被平台文案、按钮盖住的起点（比例，BG_ONLY.bottom = 1340）。split 和老调用（不传 mode）按它留底 */
export const BOTTOM_UNSAFE = 1340 / 1920;
/** 竖版 pip / full：取景框的顶边（比例，720×1280 时 y 128） */
export const TALL_TOP = 0.1;
/** 竖版 pip / full：取景框最低到哪（比例）。pip 在圆窗上面（720×1280 时 y 1000），full 在字幕带上面（y 1080） */
export const TALL_BOTTOM = {pip: 1000 / 1280, full: 1080 / 1280} as const;
/** 竖版 pip / full：左右留边（比例，720 宽时 60 像素：右边不进抖音图标列 x 660 以右） */
export const TALL_SIDE = 60 / 720;
/** 取景框底和字幕顶、圆窗顶至少隔多少（比例，1280 高时 36 像素：卡片底边的厚度算进去也还有 24 像素以上） */
export const CAPTION_GAP = 0.028;

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
  /** 摆法。竖版 pip / full 按「人优先」的竖版规矩排（见上面 TALL_*）；不传按 split 的老规矩 */
  mode?: 'full' | 'pip' | 'split';
};

const overlaps = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0;

/**
 * 取景框（成片像素，绝对坐标）。
 * 竖版 pip / full：左右各留 TALL_SIDE，顶在 TALL_TOP，底不过 TALL_BOTTOM、字幕顶、圆窗顶（都隔 CAPTION_GAP）。
 * 其余（split、横版）：上下先按全部规矩算；太扁（不到框高 30%）时先放开平台顶栏，再放开平台底栏，字幕永远不压。
 * 圆窗压进来时：把底边提到圆窗上沿，或把靠圆窗那一侧收到圆窗旁边，哪个剩得多用哪个（底边提得太狠就只收侧边）。
 */
export const freeRect = ({box, compW, compH, captionTop, avoid, mode}: FreeInput): Rect => {
  const vertical = compH > compW;
  const gap = Math.max(6, compH * CAPTION_GAP);
  const capBottom = captionTop != null && captionTop > box.y && captionTop < box.y + box.height ? captionTop - gap : Infinity;

  if (vertical && (mode === 'pip' || mode === 'full')) {
    const side = compW * TALL_SIDE;
    const left = Math.max(box.x, side);
    const right = Math.min(box.x + box.width, compW - side);
    const top = Math.max(box.y, compH * TALL_TOP);
    let bottom = Math.min(box.y + box.height, compH * TALL_BOTTOM[mode], capBottom);
    if (avoid && overlaps(avoid.x - gap, avoid.x + avoid.width + gap, left, right)) bottom = Math.min(bottom, avoid.y - gap);
    if (bottom - top < compH * 0.25) bottom = top + compH * 0.25;
    return {x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top)};
  }

  const mx = Math.max(8, box.width * 0.04);
  const my = Math.max(8, box.height * 0.03);
  let left = box.x + mx;
  let right = box.x + box.width - mx;
  const boxTop = box.y + my;
  const boxBottom = box.y + box.height - my;
  const platformTop = vertical && box.y <= 0 ? Math.max(boxTop, compH * TOP_UNSAFE) : boxTop;
  const platformBottom = vertical ? Math.min(boxBottom, compH * BOTTOM_UNSAFE) : boxBottom;
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

/** 两个框相交没有 */
export const rectsHit = (a: Rect, b: Rect): boolean => Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);

/** 框往外扩 m（四边） */
export const inflate = (r: Rect, m: number): Rect => ({x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m});

/** 内容在框里竖直居中、再往上偏框高的 4%（视觉居中）：返回内容的顶边 */
export const visualTop = (H: number, contentH: number): number => Math.max(0, (H - contentH) / 2 - H * 0.04);

/** 装饰贴哪个角：tl / tr 左上右上，tm 顶上中间，bl / br 左下右下 */
export type DecorSlot = 'tl' | 'tr' | 'tm' | 'bl' | 'br';
export type DecorSpec = {slot: DecorSlot; w: number; h: number; shift?: number; at?: number};

/**
 * 给一件装饰找位置（B-roll 框坐标，参考像素）：贴着它的角，最多一半出画；碰到禁区先往外挪（往上 / 往下），
 * 再缩小（最小到 55%），还不行就不放（返回 null）。碰撞时按装饰外扩一点算（漂动、旋转的余量），返回的 hit 就是外扩后的框。
 *   shift：往框里挪多少（框宽的比例，tl / bl 往右、tr / br 往左，tm 往右）；at：想放的竖向位置（框高的比例）
 */
export const placeDecor = (p: DecorSpec, bw: number, bh: number, no: Rect[]): {x: number; y: number; s: number; hit: Rect} | null => {
  for (const s of [1, 0.85, 0.7, 0.55]) {
    const w = p.w * s;
    const h = p.h * s;
    const shift = (p.shift ?? 0) * bw;
    const x = p.slot === 'tl' || p.slot === 'bl' ? -0.2 * w + shift : p.slot === 'tr' || p.slot === 'br' ? bw - 0.8 * w - shift : bw * (0.58 + (p.shift ?? 0)) - w / 2;
    const m = 10 + 0.06 * Math.max(w, h);
    const top = p.slot === 'tl' || p.slot === 'tr' || p.slot === 'tm';
    const hitsX = no.filter((r) => Math.min(x + w + m, r.x + r.width) > Math.max(x - m, r.x));
    let y: number;
    if (top) {
      const want = p.at != null ? p.at * bh : -0.12 * h;
      const limit = Math.min(bh, ...hitsX.map((r) => r.y));
      y = Math.min(want, limit - h - m);
      if (y < -0.5 * h) continue;
    } else {
      const want = p.at != null ? p.at * bh : bh - 0.82 * h;
      const limit = Math.max(0, ...hitsX.map((r) => r.y + r.height));
      y = Math.max(want, limit + m);
      if (y > bh - 0.5 * h) continue;
    }
    const hit = {x: x - m, y: y - m, width: w + 2 * m, height: h + 2 * m};
    if (no.some((r) => rectsHit(hit, r))) continue;
    return {x, y, s, hit};
  }
  return null;
};

