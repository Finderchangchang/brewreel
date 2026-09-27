// ============================================================
// 阿里云 / 火山引擎两家配音共用的小工具：调用间隔、指数退避重试、SSE 文本解析、临时链接下载，
// 以及把各家的字级时间戳整理成 timing.mjs 认识的格式（和 MiniMax 字幕文件同形：timestamped_words，毫秒）。
// MiniMax（minimax.mjs）先接入，自带一套；TtsError / redact 从那边复用，三家的报错形状一致。
// ============================================================
import {TtsError, redact} from './minimax.mjs';

export {TtsError, redact};
export const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lastCallAt = new Map();
/** 同一家两次调用之间至少隔 minGap 毫秒（各家限流不同，按提供者分开计时） */
export async function throttle(id, minGap, sleep) {
  const wait = (lastCallAt.get(id) ?? 0) + minGap - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt.set(id, Date.now());
}
/** 测试用：清掉限流计时 */
export const _resetThrottle = (id) => (id ? lastCallAt.delete(id) : lastCallAt.clear());

/**
 * 只接受 https（http 会把密钥明文发出去）；给 host 也行，自动补 https://。
 * @param {string} raw 地址
 * @param {string} envName 出错时提示的环境变量名
 */
export const httpsUrl = (raw, envName) => {
  const u = String(raw).trim().replace(/\/+$/, '');
  if (/^http:\/\//i.test(u))
    throw new TtsError('INSECURE_URL', `${envName} 必须是 https 地址（http 会把密钥明文发出去）`, `${envName} must be an https URL (http would send the key in clear text)`, {
      hint: '把 http:// 改成 https://',
      hintEn: 'change http:// to https://',
    });
  return /^https:\/\//i.test(u) ? u : `https://${u}`;
};

/**
 * SSE 文本 → [{event, data}]，data 能解析成 JSON 就给对象。
 * 整段本身就是一个 JSON（非流式响应、HTTP 报错体）时当成一个事件返回。
 */
export const parseSSE = (text) => {
  const s = String(text ?? '').trim();
  if (!s) return [];
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      return [{event: '', data: JSON.parse(s)}];
    } catch {}
  }
  const out = [];
  for (const block of s.split(/\r?\n\r?\n/)) {
    let event = '';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':')) continue; // 注释行
      const m = /^([A-Za-z_-]+):\s?(.*)$/.exec(line);
      if (!m) continue;
      if (m[1] === 'event') event = m[2].trim();
      else if (m[1] === 'data') data.push(m[2]);
    }
    if (!data.length) continue;
    const raw = data.join('\n');
    let parsed = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {}
    out.push({event, data: parsed});
  }
  return out;
};

/** 只下载 http(s)，不带任何鉴权头（音频是对象存储的临时链接） */
export const download = async (url, fetchImpl) => {
  if (!/^https?:\/\//i.test(url)) throw new Error('not an http(s) url');
  const res = await fetchImpl(url, {method: 'GET'});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

/**
 * 带重试地跑一次调用：fn 抛 TtsError（retryable 的按指数退避重试），其他异常当网络错误重试。
 * @param {(attempt: number) => Promise<any>} fn
 * @param {{id: string, key: string, maxRetries?: number, minIntervalMs?: number, sleep?: (ms: number) => Promise<void>, log?: (s: string) => void, name: string, netHint: string, netHintEn: string}} o
 */
export async function withRetry(fn, o) {
  const sleep = o.sleep ?? defaultSleep;
  const log = o.log ?? (() => {});
  const maxRetries = o.maxRetries ?? 4;
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await throttle(o.id, o.minIntervalMs ?? 1000, sleep);
    try {
      return await fn(attempt);
    } catch (e) {
      const err =
        e instanceof TtsError
          ? e
          : new TtsError('NETWORK', `连不上${o.name}：${redact(e?.message ?? e, o.key)}`, `could not reach ${o.name}: ${redact(e?.message ?? e, o.key)}`, {retryable: true, hint: o.netHint, hintEn: o.netHintEn});
      lastErr = err;
      if (!err.retryable || attempt === maxRetries) throw err;
      const delay = Math.min(30000, (err.code === 'RATE_LIMIT' ? 2000 : 1000) * 2 ** attempt) + Math.floor(Math.random() * 250);
      log(`${o.name} ${err.code}，${(delay / 1000).toFixed(1)} 秒后重试（第 ${attempt + 1}/${maxRetries} 次）`);
      await sleep(delay);
    }
  }
  throw lastErr ?? new TtsError('API', `${o.name}调用失败`, `${o.name} call failed`);
}

/**
 * 各家字级时间戳 → timing.mjs 认识的字幕结构（和 MiniMax 字幕文件同形）。
 * @param {{text: string, b: number, e: number}[]} words 毫秒
 */
export const toSegments = (words) =>
  words.length
    ? [
        {
          text: words.map((w) => w.text).join(''),
          time_begin: Math.min(...words.map((w) => w.b)),
          time_end: Math.max(...words.map((w) => w.e)),
          timestamped_words: words.map((w) => ({word: w.text, time_begin: w.b, time_end: w.e})),
        },
      ]
    : null;
