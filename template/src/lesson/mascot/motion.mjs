export const POSE_BLEND_MS = 300;
export const PAGE_MOVE_FRAMES = 9;
export const BLINK_MS = 130;
export const SENTENCE_CLOSE_MS = 120;

export const smoothStep = (value) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};

export const interpolatePoint = (a, b, amount) => [
  a[0] + (b[0] - a[0]) * amount,
  a[1] + (b[1] - a[1]) * amount,
];

export const poseAt = (pose) =>
  pose === 'point' || pose === 'check' || pose === 'warn' || pose === 'think' || pose === 'affirm' || pose === 'cheer' || pose === 'wave' ? pose : 'explain';

const VOICED = /[\p{L}\p{N}]/u;

/** 样片里用的稳定伪随机，同一个序号每次得到同一个 0–1。 */
export const hashUnit = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * 眨眼只排在停顿里：每 3–5 秒一次，窗口 130ms。
 * speaking 为真时这次不眨，也不把窗口挪到下一拍。
 */
export const blinkAt = (elapsedMs, seed = 0, speaking = false) => {
  if (speaking || !Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  let cursor = 0;
  for (let i = 0; i < 80; i += 1) {
    const gap = 3000 + Math.floor(hashUnit(seed * 17 + i * 13 + 1) * 2001);
    const start = cursor + gap;
    if (elapsedMs < start) return 0;
    if (elapsedMs < start + BLINK_MS) return 1;
    cursor = start;
  }
  return 0;
};

/** 上下 ±3px，并带极轻的缩放。周期 3.2 秒。 */
export const breatheAt = (elapsedMs) => {
  const phase = Math.sin((elapsedMs / 1000) * Math.PI * 2 / 3.2);
  return {y: phase * 3, sx: 1 + phase * 0.004, sy: 1 + phase * 0.006};
};

/** 只在可发声字符的逐字区间张嘴；空格和标点对应闭口停顿。 */
export const talkingAt = (chars, elapsedMs, offsetMs = 0) =>
  chars.some((char) => VOICED.test(char.text) && elapsedMs >= char.startMs + offsetMs && elapsedMs < char.endMs + offsetMs);

/**
 * 张嘴幅度 0–1。每个字用正弦开合，幅度由字序号决定；
 * 标点和空隙为 0；句尾 120ms 收到 0。
 */
export const mouthOpenAmount = (chars, elapsedMs, offsetMs = 0, sentenceEndMs = Infinity) => {
  let amount = 0;
  if (Array.isArray(chars)) {
    for (let index = 0; index < chars.length; index += 1) {
      const char = chars[index];
      if (!char || !VOICED.test(char.text)) continue;
      const start = char.startMs + offsetMs;
      const end = char.endMs + offsetMs;
      if (elapsedMs < start || elapsedMs >= end) continue;
      const span = Math.max(1, end - start);
      const f = (elapsedMs - start) / span;
      const level = 0.5 + 0.5 * hashUnit(index + 1);
      amount = level * Math.sin(Math.PI * f);
      break;
    }
  }
  if (Number.isFinite(sentenceEndMs)) {
    const remain = sentenceEndMs - elapsedMs;
    if (remain < SENTENCE_CLOSE_MS) amount *= Math.max(0, remain / SENTENCE_CLOSE_MS);
  }
  return amount;
};

/**
 * 闭嘴是微笑弧；张开是上唇略平、下唇圆的 D。
 * 宽 52–68，下唇参数深 8–32，都是 850×1200 viewBox 的单位。
 * 幅度低于 0.1 时画弧，和已认可的样片脚本一致。
 */
export const mouthGeometry = (amount, anchor = {cx: 545, cy: 411}) => {
  const cx = anchor.cx;
  const cy = anchor.cy;
  if (!(amount >= 0.1)) {
    return {
      open: false,
      d: `M${cx - 31} ${cy - 2} Q${cx} ${cy + 17} ${cx + 31} ${cy - 2}`,
      width: 62,
      depth: 0,
    };
  }
  const rx = 26 + 8 * amount;
  const up = 3 + 3 * amount;
  const dn = 8 + 24 * amount;
  const n = (value) => (Math.round(value * 10) / 10).toString();
  return {
    open: true,
    d: `M${n(cx - rx)} ${n(cy)} Q${n(cx)} ${n(cy - up)} ${n(cx + rx)} ${n(cy)} Q${n(cx)} ${n(cy + dn * 1.6)} ${n(cx - rx)} ${n(cy)} Z`,
    width: rx * 2,
    depth: dn,
  };
};
