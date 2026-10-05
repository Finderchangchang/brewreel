// 口播配 B-roll 的进出场：真人只有一个视频层，不把同一个人的两种裁切叠在一起交叉淡化（v0.8 那样会透出两张脸）。
//   split：真人从全屏往下收到下方 40%（只平移、裁上沿，不缩放），B-roll 面板从上方推进来，两条边一起走；
//   pip：真人从全屏收进右下圆窗（裁切框由矩形收成圆、画面同时缩小并把脸对准圆心），B-roll 面板在人像后面露出来；
//   full：B-roll 面板从上方推下来盖住真人（真人从上往下被裁掉，两条边一起走）。
// 出场倒放。紧挨着前一段、摆法相同时不动，直接接上。纯函数，节点测试直接引用。
import {MOTION_PIP_K, SPLIT_TOP, TRANS_SEC, pipOf} from './layout.ts';

export type TalkMode = 'full' | 'pip' | 'split';
export type ClipSpan = {startMs: number; endMs: number; mode: TalkMode};

/** 进出场各用几帧（30fps 时 11 帧） */
export const transFrames = (fps: number): number => Math.max(4, Math.round(TRANS_SEC * fps));

export const easeInOutCubic = (x: number): number => {
  const v = Math.max(0, Math.min(1, x));
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
};

const frameOf = (ms: number, fps: number) => Math.round((ms / 1000) * fps);
const spanOf = (c: ClipSpan, fps: number) => {
  const from = frameOf(c.startMs, fps);
  return {from, to: from + Math.max(1, Math.round(((c.endMs - c.startMs) / 1000) * fps))};
};

/** 每段进场、出场要不要动：和前一段（后一段）摆法相同、首尾相接（差 1 帧以内）就不动 */
export const edgesOf = (clips: ClipSpan[], fps: number): {enter: boolean; exit: boolean}[] =>
  clips.map((c, i) => {
    const me = spanOf(c, fps);
    const touching = (o: ClipSpan, j: number, side: 'prev' | 'next') => {
      if (j === i || o.mode !== c.mode) return false;
      const s = spanOf(o, fps);
      return side === 'prev' ? Math.abs(s.to - me.from) <= 1 : Math.abs(s.from - me.to) <= 1;
    };
    return {enter: !clips.some((o, j) => touching(o, j, 'prev')), exit: !clips.some((o, j) => touching(o, j, 'next'))};
  });

/** 这一帧进场走到哪了：0 = 还是全屏真人，1 = 摆好了。local：段内第几帧，dur：段长（帧） */
export const transProgress = (local: number, dur: number, fps: number, edges: {enter: boolean; exit: boolean} = {enter: true, exit: true}): number => {
  const T = transFrames(fps);
  const a = edges.enter ? local / T : 1;
  const b = edges.exit ? (dur - local) / T : 1;
  return easeInOutCubic(Math.min(a, b));
};

/** 真人画面的取景（split 的下半、pip 的圆窗）：动效段把圆窗放大、脸放大一点，并把裁切往下挪一点（少露天花板） */
export type FaceFraming = {
  /** 圆窗直径倍数（layout.ts 的 MOTION_PIP_K） */
  pipK: number;
  /** 圆窗里人脸放大倍数（1 = 刚好盖满圆窗） */
  zoom: number;
  /** 圆窗对准原片的哪一高度（0–1） */
  focusY: number;
  /** split 下半露原片的哪一截：0 = 最上面，0.5 = 正中（v0.8），越大越往下 */
  splitCrop: number;
};
export const VIDEO_FRAMING: FaceFraming = {pipK: 1, zoom: 1, focusY: 0.5, splitCrop: 0.5};
export const MOTION_FRAMING: FaceFraming = {pipK: MOTION_PIP_K, zoom: 1.3, focusY: 0.45, splitCrop: 0.54};

export type VideoPlacement = {
  /** 裁切框（成片像素，clip-path inset 的四边和圆角） */
  inset: {top: number; right: number; bottom: number; left: number; radius: number};
  /** 画面变换：先缩放 s（原点左上角）再平移 */
  tx: number;
  ty: number;
  s: number;
  /** 裁切框本身（画圆窗描边、阴影用） */
  frame: {x: number; y: number; width: number; height: number; radius: number};
};

/** e 时刻（0–1）真人画面放在哪。W×H 是成片；画面按 cover 铺满成片后再做这里的变换 */
export const videoPlacement = (mode: TalkMode, W: number, H: number, e: number, framing: FaceFraming = VIDEO_FRAMING): VideoPlacement => {
  const k = Math.max(0, Math.min(1, e));
  if (mode === 'split') {
    const bh = Math.round(H * SPLIT_TOP);
    const top = bh * k;
    return {inset: {top, right: 0, bottom: 0, left: 0, radius: 0}, tx: 0, ty: bh * (1 - framing.splitCrop) * k, s: 1, frame: {x: 0, y: top, width: W, height: H - top, radius: 0}};
  }
  if (mode === 'pip') {
    const {d, margin} = pipOf(W, H, framing.pipK);
    const x = W - margin - d;
    const y = H - margin - d;
    const sF = Math.max(d / Math.min(W, H), (framing.zoom * d) / Math.min(W, H));
    const s = 1 + (sF - 1) * k;
    const fx = W / 2;
    const fy = framing.focusY * H;
    const X = fx + (x + d / 2 - fx) * k;
    const Y = fy + (y + d / 2 - fy) * k;
    const fl = x * k;
    const ft = y * k;
    const fw = W + (d - W) * k;
    const fh = H + (d - H) * k;
    const radius = (d / 2) * k;
    return {
      inset: {top: ft, right: W - fl - fw, bottom: H - ft - fh, left: fl, radius},
      tx: X - s * fx,
      ty: Y - s * fy,
      s,
      frame: {x: fl, y: ft, width: fw, height: fh, radius},
    };
  }
  const top = H * k;
  return {inset: {top, right: 0, bottom: 0, left: 0, radius: 0}, tx: 0, ty: 0, s: 1, frame: {x: 0, y: top, width: W, height: H - top, radius: 0}};
};

/** B-roll 面板的位移：split / full 从上方推进来（e=0 时整块在画面上面），pip 不动（在人像后面露出来） */
export const panelOffset = (mode: TalkMode, boxHeight: number, e: number): number => (mode === 'pip' ? 0 : -(1 - Math.max(0, Math.min(1, e))) * boxHeight);
