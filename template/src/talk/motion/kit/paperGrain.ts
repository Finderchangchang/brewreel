// 纸纹颗粒的参数。高通 σ 和颗粒尺度的默认值落在原理给的区间里。
// 对应原理：任何底色上都盖同一层颗粒，颗粒不糊掉形状的硬边（高通是减掉低频，不是对形状做模糊）。

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 8-bit 高通的 σ，单位是这一层的坐标像素。 */
export const GRAIN_SIGMA = {min: 4, max: 8, default: 6};
/** 颗粒尺度，原理在 720 宽上是 2–4 px。这里按调用方的坐标系夹。 */
export const GRAIN_SCALE = {min: 2, max: 4, default: 3};

export const grainSettings = (opts?: {sigma?: number; scale?: number}): {sigma: number; scale: number} => ({
  sigma: clamp(opts?.sigma ?? GRAIN_SIGMA.default, GRAIN_SIGMA.min, GRAIN_SIGMA.max),
  scale: clamp(opts?.scale ?? GRAIN_SCALE.default, GRAIN_SCALE.min, GRAIN_SCALE.max),
});
