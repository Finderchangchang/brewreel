// 动效画面的时刻：画面上的每一处字，在口播说出它的那一刻出来（marks 是脚本按字幕 / 逐字时间算好的「窗口内第几秒」）。
// 宣传片镜头的时间重映射（warp）已经不用了：模板现在按口播框重画，直接按 marks 排，第 i 条在说出第 i 条前 LEAD 秒出场。
// 纯函数，没有运行时依赖，节点测试直接引用。

/** 条目比开口早出场这么多秒（入场弹簧的前几帧落在开口之前，开口时字已经站稳） */
export const LEAD = 0.12;
/** 第一条最晚在这一刻出场：画面一出来就有字，不空着等 */
export const FIRST_BY = 0.35;
/** 整段最后出场（面板推出去、真人回到全屏）的时长，和 layout.ts 的 TRANS_SEC 一致（Talk.tsx / transition.ts） */
export const FADE = 0.36;
/** 出场最晚不晚于整段结束前这么多秒（来不及就提前）：退场动画开始前至少还能站稳 0.24 秒 */
export const LAST_BEFORE_END = 0.6;

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * 每条出场的时刻（窗口内秒）。
 * 有 marks：开口前 LEAD 秒；第一条不晚于 firstBy（传 null 就不提前，compare 右栏用）；单调不减；不早于 0、不晚于 dur - LAST_BEFORE_END。
 * 没有 marks（老 props、或者某条没对上）：按拍子排开。
 */
export const revealTimes = (marks: readonly number[] | undefined, n: number, dur: number, firstBy: number | null = FIRST_BY): number[] => {
  const cap = Math.max(0, dur - LAST_BEFORE_END);
  const step = n > 1 ? Math.max(0.25, Math.min(0.6, (cap - 0.2) / (n - 1))) : 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const m = marks?.[i];
    let at = fin(m) ? m - LEAD : (out[i - 1] ?? 0.1) + (i ? step : 0);
    if (i === 0 && firstBy != null) at = Math.min(at, firstBy);
    at = Math.max(0, Math.min(cap, at));
    if (i > 0) at = Math.max(at, out[i - 1]);
    out.push(at);
  }
  return out;
};

/** 全部说完的时刻：最后一条的结尾（没有就按最后一条开头 + 0.6 秒）+ 0.15 秒，夹在淡出之前 */
export const doneTime = (starts: readonly number[], ends: readonly number[] | undefined, dur: number): number => {
  const n = starts.length;
  if (!n) return 0;
  const last = fin(ends?.[n - 1]) ? (ends as number[])[n - 1] : starts[n - 1] + 0.6;
  return Math.max(starts[n - 1] + 0.2, Math.min(Math.max(0, dur - LAST_BEFORE_END), last + 0.15));
};

/**
 * keyword 的马克笔什么时候扫、扫多久：说完 hot 那一刻开始扫 0.45 秒。
 * 离这段退场太近时：全亮、带马克笔的样子要在退场（最后 FADE 秒）前停够 0.5 秒，来不及就扫快一点，再不够就提前扫（不早于 hot 第一个字）。
 */
export const markerTiming = (hotMark: number | undefined, dur?: number, hotStart?: number): {at?: number; dur: number} => {
  if (!fin(hotMark)) return {at: undefined, dur: 0.45};
  let at = Math.max(0, hotMark - 0.1);
  let len = 0.45;
  if (dur != null && Number.isFinite(dur)) {
    const doneBy = dur - FADE - 0.5;
    if (at + len > doneBy) len = Math.max(0.2, doneBy - at);
    if (at + len > doneBy) {
      const earliest = fin(hotStart) ? Math.max(0, hotStart - 0.1) : 0;
      at = Math.max(earliest, doneBy - len);
    }
  }
  return {at, dur: len};
};

/** counter：旧值开始往新值滚的提前量（秒）。滚动中的数原话里没说过，最多滚 0.6 秒 */
export const ROLL = 0.6;
/** counter：金额（元、块、¥、$ ……）有旧值时不滚，在落定那一刻直接翻牌（中间价截图出来就是一个错的价格）；翻牌前后各用这么多秒 */
export const FLIP = 0.16;
/** counter：没有旧值时，入场后从这一刻开始往上滚 */
export const ROLL_FROM_START = 0.15;

export type CounterClock = {
  /** 开始滚的时刻 */
  start: number;
  /** 落定的时刻（= 念到数字最后一个字） */
  land: number;
  /** 有没有旧值 */
  hasFrom: boolean;
  /**
   * 怎么从起点走到落定：
   *   roll：一直往上滚（没有旧值的计数），或旧值落定前 ROLL 秒才滚（有旧值的计数）
   *   flip：金额有旧值，旧值亮到落定那一刻直接翻成新值，不出中间价
   *   pop：金额没有旧值，落定前 ROLL 秒才出现、滚到落定（之前不显示 0 元这种原话里没有的价）
   */
  how: 'roll' | 'flip' | 'pop';
};

/** 金额：前缀 ¥ / $ / € / £，或后缀是钱的单位（元、块、美元、刀……） */
export const isMoney = (prefix?: string, suffix?: string): boolean =>
  /[¥￥$€£]/.test(prefix ?? '') || /^(元|块|块钱|毛|角|分钱|美元|美金|刀|欧元|英镑|日元|港币|港元|万元|亿元|千元|百元|RMB|CNY|USD|dollars?|bucks?|yuan)/i.test(String(suffix ?? '').trim());

/**
 * 数字在念到最后一个数字字时落定。
 *   有旧值（降价、涨了多少）：旧值一直亮着（原话里说了），落定前 ROLL 秒才开始滚；金额不滚，落定那一刻直接翻牌（how = flip）；
 *   没有旧值：起点是 0，停在 0 上会让人读成一个原话里没有的数，所以入场后就一直往上滚，正好在开口时落定；
 *   金额没有旧值：落定前 ROLL 秒才出现并滚到落定（how = pop），之前数字位置空着。
 */
export const counterClock = (sayAt: number | undefined, hasFrom: boolean, dur: number, money = false): CounterClock => {
  const cap = Math.max(0.3, dur - LAST_BEFORE_END);
  const land = Math.max(0.35, Math.min(cap, fin(sayAt) ? sayAt : cap * 0.6));
  const how: CounterClock['how'] = money ? (hasFrom ? 'flip' : 'pop') : 'roll';
  let start: number;
  if (how === 'flip') start = Math.max(0, land - FLIP);
  else if (how === 'pop' || hasFrom) start = Math.max(0.05, Math.min(land - 0.25, land - ROLL));
  else start = Math.min(ROLL_FROM_START, land - 0.2);
  return {start: Math.max(0, start), land, hasFrom, how};
};

/** t 时刻屏幕上的数：落定前滚（有旧值缓进缓出，没旧值先快后慢、一直在动），翻牌的在落定前一直是旧值，落定后就是原话里的那个数 */
export const counterValue = (t: number, c: CounterClock, to: number, from = 0): number => {
  if (t >= c.land) return to;
  const a = c.hasFrom ? from : 0;
  if (c.how === 'flip') return a;
  if (t <= c.start) return a;
  const x = (t - c.start) / Math.max(1e-6, c.land - c.start);
  const e = c.hasFrom ? (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) : 1 - Math.pow(1 - x, 2.2);
  return a + (to - a) * e;
};

/** 第 i 步什么时候打勾（窗口内秒）；null = 不打。下一步开口时打；最后一步 min(说完, 结束前 0.7 秒)，离出场不到 0.25 秒就不打 */
export const stepCheckTimes = (at: number[], done: number, dur: number): (number | null)[] =>
  at.map((a, i) => {
    if (i < at.length - 1) return Math.max(a + 0.2, at[i + 1]);
    const last = Math.min(done, dur - 0.7);
    return last >= a + 0.25 ? last : null;
  });
