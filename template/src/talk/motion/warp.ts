// 时间重映射：宣传片镜头的动画是「镜头内时间 t」的纯函数，按拍子自己排好了；口播里我们知道每一条在第几秒被说出来。
// 把真实时间分段映射成镜头时间，让「第 i 条点亮」正好落在说出第 i 条的那一刻，镜头代码一行不改。
//
// 不做整段线性拉伸（那样入场、光点、弹跳都会被拖慢成慢动作），而是：
//   事件之后按 1:1 播 follow 秒（把这一下的弹跳播完）→ 停住等 → 下一个事件前 lead 秒再按 1:1 播进去（光点跑过去、数字滚起来）。
//   说得比镜头排得快时，这一段整体加速。
// 纯函数，没有运行时依赖，节点测试直接引用。

/**
 * 锚点：real = 窗口内真实秒（说出口的时刻），shot = 镜头时间里这件事发生的秒；lead = 事件前要按 1:1 播的秒数。
 * stretch = true：上一件事播完 follow 秒后不停住，直接匀速走到这个锚点（counter 没有旧值时用：慢慢往上滚，好过停在 0 上）
 */
export type Anchor = {real: number; shot: number; lead?: number; stretch?: boolean};

export const FOLLOW = 0.6;
export const LEAD = 0.5;
/** 镜头时间最多走到 dur - END_PAD：t > dur 是宣传片的退场尾巴，口播里不要 */
export const END_PAD = 0.04;

/** 分段线性的拐点：[真实秒, 镜头秒]，真实秒严格递增、镜头秒不减 */
export const warpKnots = (anchors: Anchor[], dur: number, follow = FOLLOW): [number, number][] => {
  const pts: [number, number][] = [[0, 0]];
  const sorted = anchors.filter((a) => Number.isFinite(a.real) && Number.isFinite(a.shot)).sort((x, y) => x.real - y.real);
  for (const a of sorted) {
    const [r0, s0] = pts[pts.length - 1];
    // 不单调的锚点丢掉（说话顺序和镜头顺序对不上时，宁可按镜头自己的节奏走）
    if (!(a.real > r0 + 0.05 && a.shot > s0 + 0.02 && a.real < dur)) continue;
    const dr = a.real - r0;
    const ds = a.shot - s0;
    if (dr <= ds + 1e-6) {
      pts.push([a.real, a.shot]); // 说得比镜头快：这一段加速（或正好 1:1）
      continue;
    }
    if (a.stretch) {
      const fol = Math.min(follow, ds * 0.5);
      if (fol > 1e-6) pts.push([r0 + fol, s0 + fol]);
      pts.push([a.real, a.shot]);
      continue;
    }
    // lead 至少 0.05 秒：否则「停住」会落在事件之后，事件提前发生
    const lead = Math.min(Math.max(a.lead ?? LEAD, 0.05), ds);
    const fol = Math.min(follow, ds - lead);
    if (fol > 1e-6) pts.push([r0 + fol, s0 + fol]);
    const holdEnd = a.real - lead;
    const [hr] = pts[pts.length - 1];
    if (lead > 1e-6 && holdEnd > hr + 1e-6) pts.push([holdEnd, a.shot - lead]);
    pts.push([a.real, a.shot]);
  }
  return pts;
};

/** 真实秒 → 镜头秒。最后一个锚点之后按 1:1 走，走到 dur - END_PAD 停住 */
export const makeWarp = (anchors: Anchor[], dur: number, follow = FOLLOW) => {
  const pts = warpKnots(anchors, dur, follow);
  const cap = Math.max(0, dur - END_PAD);
  return (t: number): number => {
    if (!(t > 0)) return 0;
    for (let i = 1; i < pts.length; i++) {
      const [a0, b0] = pts[i - 1];
      const [a1, b1] = pts[i];
      if (t <= a1) return Math.min(cap, b0 + ((t - a0) / (a1 - a0)) * (b1 - b0));
    }
    const [a0, b0] = pts[pts.length - 1];
    return Math.min(cap, b0 + (t - a0));
  };
};
