// 把卡片上的点投到纸面上。
// 成片外层有 translateY 和 scale，Remotion 会把 CSS 的 preserve-3d 压扁，rotateY 只剩水平缩放，看不出翻面。
// 这里在参考像素里自己做透视，画出来的轮廓近大远小。perspective 与点用同一套坐标。

export type Pt = {x: number; y: number};

const clampDen = (v: number) => (v < 40 ? 40 : v);

/**
 * 绕卡片中心先绕 Y 再绕 X，然后按透视缩短。z0 是卡面法向的厚度，用来画侧面。
 */
export const projectPoint = (
  x: number,
  y: number,
  cx: number,
  cy: number,
  rotX: number,
  rotY: number,
  perspective: number,
  z0 = 0,
): Pt => {
  const ay = (rotY * Math.PI) / 180;
  const ax = (rotX * Math.PI) / 180;
  const cyaw = Math.cos(ay);
  const syaw = Math.sin(ay);
  const cpitch = Math.cos(ax);
  const spitch = Math.sin(ax);
  const px = x - cx;
  const py = y - cy;
  const x1 = px * cyaw - z0 * syaw;
  const z1 = px * syaw + z0 * cyaw;
  const y2 = py * cpitch - z1 * spitch;
  const z2 = py * spitch + z1 * cpitch;
  const k = perspective / clampDen(perspective + z2);
  return {x: cx + x1 * k, y: cy + y2 * k};
};

/** 按出现顺序替换路径里的坐标对。命令（M/L/Q/Z）不动。 */
export const mapPath = (d: string, map: (x: number, y: number) => Pt): string => {
  const re = /-?\d+(?:\.\d+)?/g;
  const nums = d.match(re);
  if (!nums || nums.length < 2 || nums.length % 2 !== 0) return d;
  const out: string[] = [];
  for (let i = 0; i < nums.length; i += 2) {
    const p = map(Number(nums[i]), Number(nums[i + 1]));
    out.push(p.x.toFixed(1), p.y.toFixed(1));
  }
  let k = 0;
  return d.replace(re, () => out[k++]);
};
