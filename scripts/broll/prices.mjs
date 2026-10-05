/** 生成单价（元/秒）。placeholder / local 不花钱，单价按 0 计。接口回执不带金额，费用一律用这张表乘秒数。 */
export const PRICE_YUAN_PER_SEC = {
  '768P': 0.5,
  '2K': 0.8,
};

/** image-01 参考图，每张。 */
export const IMAGE_YUAN = 0.025;

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

// ───────────── 订阅 key 的积分 ─────────────
// MiniMax 有两种 key：
// - 按量付费的 key：H3 视频按秒扣余额，就是上面的元/秒价目表。
// - 订阅套餐的 key（以 sk-cp- 开头）：不能按量付费。H3 视频不在 Plus 套餐的额度里，扣的是积分。
//   2026-10 实测 768P 约 70 积分/秒；2K 没实测。以 MiniMax 后台为准。
// 预算闸门（budgetYuan）照旧按元的价目表拦，两种用户都一样；订阅 key 只是多显示一行积分估算。

/** 768P 实测约 70 积分/秒；2K 没测过，不估（显示「以后台为准」）。 */
export const CREDITS_PER_SEC = {'768P': 70, '2K': null};

/** 订阅套餐的 key（sk-cp- 开头）：只能走套餐 / 积分，不能按量付费。 */
export const isSubscriptionKey = (key) => /^sk-cp-/i.test(String(key ?? '').trim());

/** 这台机器上的 MiniMax key 是哪种：'subscription' | 'payg' | 'none'。只看前缀，不打印 key。 */
export const keyKindOf = (env = process.env) => {
  const key = String(env.MINIMAX_API_KEY ?? '').trim();
  if (!key) return 'none';
  return isSubscriptionKey(key) ? 'subscription' : 'payg';
};

/** 积分估算：768P 返回整数；2K 或不认识的画质返回 null。 */
export const creditsOf = (quality, genSec) => {
  const per = CREDITS_PER_SEC[quality];
  if (!Number.isFinite(per) || !Number.isFinite(genSec)) return null;
  return Math.round(per * genSec);
};

/**
 * 一批 AI 视频的费用说明（一行）。始终带秒数；订阅 key 时以积分为主、元为预算参考。
 * @param {{provider: string, quality: string, genSec: number, yuan: number, kind?: 'subscription'|'payg'|'none'}} p
 */
export const costLine = ({provider, quality, genSec, yuan, kind = 'none'}) => {
  if (provider !== 'minimax-h3') return `${yuan} 元（${provider} 不花钱）`;
  const sec = `AI 视频共 ${genSec} 秒`;
  if (kind === 'subscription') {
    const credits = creditsOf(quality, genSec);
    const c = credits == null ? `${quality} 的积分价没实测，以 MiniMax 后台为准` : `约 ${credits} 积分（订阅 key，从积分扣，以 MiniMax 后台为准）`;
    return `${sec}，${c}；按价目表折合 ${yuan} 元，预算闸门按这个数拦`;
  }
  return `${sec}，按价目表 ${yuan} 元`;
};
