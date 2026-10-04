export const LEAD_MS = 120;
export const TAIL_MS = 200;
export const MIN_COVER_MS = 2500;
export const MAX_COVER_MS = 12000;
export const MIN_GAP_MS = 1000;
export const MAX_RATIO = 0.6;
export const MIN_BEAT_SEC = 1.2;
export const GEN_MIN = 4;
export const GEN_MAX = 15;

/** 窗口：起句开始前 120ms 到止句结束后 200ms，夹在原片时长里。 */
export const windowOf = (fromCue, toCue, durationMs) => {
  const startMs = Math.max(0, fromCue.startMs - LEAD_MS);
  const endMs = Math.min(durationMs, toCue.endMs + TAIL_MS);
  return {startMs, endMs, durationMs: Math.max(0, endMs - startMs)};
};

/** 生成秒数：窗口向上取整，再夹到 4–15 秒。多出来的合成时裁掉。 */
export const genSecOf = (durationMs) => {
  const up = Math.ceil(durationMs / 1000 - 1e-6);
  return Math.min(GEN_MAX, Math.max(GEN_MIN, up));
};

export const framesFor = (durationMs, fps = 30) => Math.max(1, Math.round((durationMs * fps) / 1000));

/** 竖版当 9:16，横版当 16:9。差得远也按朝向归到这两档（生成接口只有这两种）。 */
export const aspectOf = (width, height) => {
  if (!(width > 0) || !(height > 0)) return null;
  return height > width ? '9:16' : '16:9';
};

export const isVertical = (width, height) => height > width;

/** 把生成秒数切成 n 段，返回每段起止的「百分秒」（250 = 2.5 秒），最后一段正好落到总秒数。 */
export const beatSpans = (genSec, n) => {
  const total = Math.round(genSec * 100);
  const out = [];
  for (let i = 0; i < n; i++) out.push([Math.round((total * i) / n), Math.round((total * (i + 1)) / n)]);
  return out;
};

export const fmtSec = (cents) => {
  const sign = cents < 0 ? '-' : '';
  const v = Math.abs(Math.round(cents));
  const whole = Math.floor(v / 100);
  const frac = v % 100;
  if (frac === 0) return sign + String(whole);
  if (frac % 10 === 0) return `${sign}${whole}.${frac / 10}`;
  return `${sign}${whole}.${String(frac).padStart(2, '0')}`;
};

export const secText = (ms) => (ms / 1000).toFixed(2);
