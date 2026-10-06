// 投影跟着卡离纸的高度走。h=0 是贴着纸的静止投影，h=1 是上抛到顶点。
// 数字是 720 宽上的像素：偏下 36–47，模糊 18–24，不透明度 0.45。
// 到顶点，偏下大约 +50%，模糊 40–55，不透明度 0.22。中间单调。
// shortSide 把这组数换到参考像素（1080 宽的舞台乘 1.5）。落地时 h 回到 0，投影收紧。

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const SHADOW_BY_HEIGHT = {
  dx: 8,
  dyRest: 42,
  /** 顶点相对静止的放大。0.5 = 偏下增加 50% */
  dyGain: 0.5,
  blurRest: 21,
  blurAir: 48,
  opacityRest: 0.45,
  opacityAir: 0.22,
};

export type ShadowSample = {dx: number; dy: number; blur: number; opacity: number};

/**
 * @param h 离纸高度，0–1。超出的会被夹住。
 * @param shortSide 参考短边。720 时返回值就是上面的像素；1080 时乘 1.5。
 */
export const shadowByHeight = (h: number, shortSide = 720): ShadowSample => {
  const k = clamp(h, 0, 1);
  const s = Math.max(0.5, shortSide) / 720;
  const dy = SHADOW_BY_HEIGHT.dyRest * (1 + SHADOW_BY_HEIGHT.dyGain * k);
  const blur = SHADOW_BY_HEIGHT.blurRest + (SHADOW_BY_HEIGHT.blurAir - SHADOW_BY_HEIGHT.blurRest) * k;
  const opacity = SHADOW_BY_HEIGHT.opacityRest + (SHADOW_BY_HEIGHT.opacityAir - SHADOW_BY_HEIGHT.opacityRest) * k;
  const round = (v: number) => Math.round(v * s * 10) / 10;
  return {
    dx: round(SHADOW_BY_HEIGHT.dx),
    dy: round(dy),
    blur: round(blur),
    opacity: Math.round(opacity * 1000) / 1000,
  };
};
