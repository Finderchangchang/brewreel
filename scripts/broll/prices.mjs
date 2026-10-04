/** 生成单价（元/秒）。placeholder / local 不花钱，单价按 0 计。 */
export const PRICE_YUAN_PER_SEC = {
  '768P': 0.5,
  '2K': 0.8,
};

export const rateOf = (provider, quality) => {
  if (provider === 'placeholder' || provider === 'local') return 0;
  const n = PRICE_YUAN_PER_SEC[quality];
  return Number.isFinite(n) ? n : null;
};

export const clipCost = (provider, quality, genSec) => {
  const rate = rateOf(provider, quality);
  if (rate == null || !Number.isFinite(genSec)) return null;
  return Math.round(rate * genSec * 100) / 100;
};
