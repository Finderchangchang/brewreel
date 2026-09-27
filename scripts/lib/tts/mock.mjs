// ============================================================
// mock 配音：不联网、不要 key。按字数和标点生成「柔和的音节脉冲」占位音，时间戳和音频严格对齐。
// 用途：没有 key 时把整条配音管线（改镜头时长、逐字字幕、配乐闪避）跑通和测试。
// 输出确定：同一句话、同样的 speed / voiceId 永远生成同一段音频。
// ============================================================
import fs from 'node:fs';
import {encodeWav} from './wav.mjs';
import {tokenize} from './timing.mjs';

export const id = 'mock';
export const SAMPLE_RATE = 32000;
/** 一个念读单位（一个汉字 / 一个英文音节）的时长（秒，speed = 1 时）。约 4.4 字/秒，和真人播音接近 */
export const UNIT_SEC = 0.225;
const TAIL_SEC = 0.06;

const hash = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
};

/**
 * @param {string} text 旁白（已去掉 {}）
 * @param {{outBase: string, lang?: 'zh'|'en', speed?: number, voiceId?: string, emotion?: string}} opts
 * @returns {Promise<{audioPath: string, ext: string, durMs: number, words: {text,startMs,endMs}[], granularity: 'char'|'word', usageCharacters: number}>}
 */
export async function synthesize(text, opts) {
  const lang = opts.lang === 'en' ? 'en' : 'zh';
  const speed = Number.isFinite(opts.speed) && opts.speed > 0 ? opts.speed : 1;
  const unit = UNIT_SEC / speed;
  const toks = tokenize(text, lang);
  const base = 150 + (hash(opts.voiceId ?? 'mock') % 70); // 不同 voiceId 音高不同，听得出换了
  const lift = opts.emotion === 'happy' || opts.emotion === 'surprised' ? 1.12 : opts.emotion === 'sad' || opts.emotion === 'calm' ? 0.92 : 1;
  const words = [];
  const pulses = [];
  let t = 0;
  toks.forEach((k, n) => {
    const d = k.weight * unit;
    words.push({text: k.text, startMs: Math.round(t * 1000), endMs: Math.round((t + d) * 1000)});
    const syl = Math.max(1, Math.round(k.weight));
    for (let q = 0; q < syl; q++) {
      const f = base * lift * (0.9 + ((hash(k.text + q + n) % 1000) / 1000) * 0.25);
      pulses.push({at: t + (q * d) / syl, len: d / syl, f, last: n === toks.length - 1 && q === syl - 1});
    }
    t += d + k.pause * unit;
  });
  const total = t + TAIL_SEC;
  const N = Math.max(1, Math.round(total * SAMPLE_RATE));
  const out = new Float32Array(N);
  for (const p of pulses) {
    const i0 = Math.round(p.at * SAMPLE_RATE);
    const n = Math.round(p.len * SAMPLE_RATE * 0.88);
    for (let i = 0; i < n && i0 + i < N; i++) {
      const x = i / n;
      // 起 12% 升、之后缓落；音高轻微下滑（句末那一下更明显），像说话的音节
      const env = x < 0.12 ? Math.sin((Math.PI / 2) * (x / 0.12)) : Math.pow(1 - (x - 0.12) / 0.88, 1.6);
      const f = p.f * (1 - (p.last ? 0.12 : 0.04) * x);
      const ph = (2 * Math.PI * f * i) / SAMPLE_RATE;
      const s = Math.sin(ph) + 0.45 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph) + 0.08 * Math.sin(5 * ph);
      out[i0 + i] += 0.2 * env * s;
    }
  }
  const audioPath = `${opts.outBase}.wav`;
  fs.writeFileSync(audioPath, encodeWav(out, SAMPLE_RATE));
  return {
    audioPath,
    ext: 'wav',
    durMs: Math.round((N / SAMPLE_RATE) * 1000),
    words,
    granularity: lang === 'en' ? 'word' : 'char',
    usageCharacters: 0,
  };
}
