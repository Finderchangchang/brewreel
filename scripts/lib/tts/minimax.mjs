// ============================================================
// MiniMax 语音合成（T2A v2，同步接口）：POST {base}/v1/t2a_v2，Authorization: Bearer <MINIMAX_API_KEY>。
//   - 密钥只从环境变量读（MINIMAX_API_KEY；MINIMAX_GROUP_ID、MINIMAX_BASE_URL 可选），不写盘、不进日志、报错里不带。
//   - 音频：output_format=hex（默认）直接解码；返回的是 URL 时下载（不带鉴权头，URL 24 小时有效）。
//   - 时间戳：subtitle_enable + subtitle_type=word，data.subtitle_file 是字幕 JSON 的下载地址（官方没公开内部字段名，
//     timing.mjs 按常见字段名宽松解析；解析不出字级就退回句级，句级也没有就按字数与标点估算）。
//     原始字幕 JSON 存在缓存目录 <hash>.subtitle.json，拿到真 key 后第一次跑完可以打开看实际结构。
//   - 重试：限流（HTTP 429 / 1002 / 1039）、超时和 5xx 按指数退避重试；鉴权失败（1004）、参数错（2013）等不重试。
//   - 限流 60 RPM：两次调用之间至少隔 minIntervalMs（默认 1000 毫秒）。
// ============================================================
import fs from 'node:fs';
import {mp3DurationMs, wavInfo} from './wav.mjs';
import {wordsFromSubtitle} from './timing.mjs';

export const id = 'minimax';
/** 默认走中国大陆域名；国际账号设 MINIMAX_BASE_URL=https://api.minimax.io（key 和域名要同区） */
export const DEFAULT_BASE = 'https://api.minimaxi.com';
export const DEFAULT_MODEL = 'speech-2.8-hd';
export const MODELS = ['speech-2.8-hd', 'speech-2.8-turbo', 'speech-2.6-hd', 'speech-2.6-turbo', 'speech-02-hd', 'speech-02-turbo', 'speech-01-hd', 'speech-01-turbo'];
export const EMOTIONS = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'];
/** 默认音色：中文用系统音色「新闻女声」；英文的默认音色未在真实接口上核对过，英文片建议显式写 voiceId */
export const DEFAULT_VOICE = {zh: 'Chinese (Mandarin)_News_Anchor', en: 'English_expressive_narrator'};
/** 同步接口单次文本上限（字符，不含） */
export const MAX_CHARS = 10000;

export class TtsError extends Error {
  /**
   * @param {string} code 机器可读的错误类型
   * @param {string} zh 中文说明
   * @param {string} en English
   * @param {{retryable?: boolean, hint?: string, hintEn?: string, status?: number, apiCode?: number}} [o]
   */
  constructor(code, zh, en, o = {}) {
    super(`${zh}${o.hint ? `（${o.hint}）` : ''} / ${en}${o.hintEn ? ` (${o.hintEn})` : ''}`);
    this.code = code;
    this.zh = zh;
    this.en = en;
    this.retryable = !!o.retryable;
    this.hint = o.hint;
    this.hintEn = o.hintEn;
    this.status = o.status;
    this.apiCode = o.apiCode;
  }
}

/** 规范化接口地址：给 host、host/v1、完整 /v1/t2a_v2 都行 */
export const endpointOf = (env = process.env) => {
  let base = String(env.MINIMAX_BASE_URL || DEFAULT_BASE).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  const url = /\/t2a_v2$/.test(base) ? base : /\/v1$/.test(base) ? `${base}/t2a_v2` : `${base}/v1/t2a_v2`;
  const gid = String(env.MINIMAX_GROUP_ID ?? '').trim();
  return gid ? `${url}${url.includes('?') ? '&' : '?'}GroupId=${encodeURIComponent(gid)}` : url;
};

/** 把任何可能带出密钥的文字抹掉 */
export const redact = (s, key) => {
  let out = String(s ?? '');
  if (key && key.length >= 4) out = out.split(key).join('***');
  return out.replace(/Bearer\s+[^\s"',;]+/gi, 'Bearer ***').slice(0, 300);
};

const AUTH_HINT = '检查 MINIMAX_API_KEY；key 和接口域名要同区：大陆账号用 https://api.minimaxi.com，国际账号设 MINIMAX_BASE_URL=https://api.minimax.io';
const AUTH_HINT_EN = 'check MINIMAX_API_KEY; the key and host must match: mainland accounts use https://api.minimaxi.com, global accounts set MINIMAX_BASE_URL=https://api.minimax.io';

/** base_resp.status_code / HTTP 状态 → TtsError */
export const classify = ({status, apiCode, msg, key}) => {
  const m = redact(msg, key);
  if (status === 429 || apiCode === 1002 || apiCode === 1039)
    return new TtsError('RATE_LIMIT', `MiniMax 限流（${apiCode ?? status}）`, `MiniMax rate limit (${apiCode ?? status})`, {retryable: true, status, apiCode, hint: '稍后重试，或减少并发', hintEn: 'retry later'});
  if (status === 401 || status === 403 || apiCode === 1004)
    return new TtsError('AUTH', `MiniMax 鉴权失败（${apiCode ?? status}）`, `MiniMax authentication failed (${apiCode ?? status})`, {status, apiCode, hint: AUTH_HINT, hintEn: AUTH_HINT_EN});
  if (apiCode === 2038)
    return new TtsError('VERIFY', 'MiniMax 账号需要先完成实名认证（2038）', 'MiniMax account needs identity verification (2038)', {status, apiCode, hint: '到 MiniMax 开放平台完成认证后重跑', hintEn: 'verify the account on the MiniMax platform'});
  if (apiCode === 1042)
    return new TtsError('BAD_TEXT', `旁白里非法字符太多（1042）：${m}`, `too many invalid characters in the narration (1042): ${m}`, {status, apiCode, hint: '删掉 emoji、特殊符号和不可见字符', hintEn: 'remove emoji, symbols and invisible characters'});
  if (apiCode === 2013)
    return new TtsError('BAD_PARAMS', `MiniMax 参数不合法（2013）：${m}`, `MiniMax rejected the parameters (2013): ${m}`, {status, apiCode, hint: '检查 meta.voice 的 voiceId / model / emotion / speed', hintEn: 'check meta.voice voiceId / model / emotion / speed'});
  if (apiCode === 1000 || apiCode === 1001 || (status && status >= 500) || status === 408)
    return new TtsError('SERVER', `MiniMax 服务暂时出错（${apiCode ?? status}）：${m}`, `MiniMax server error (${apiCode ?? status}): ${m}`, {retryable: true, status, apiCode});
  return new TtsError('API', `MiniMax 返回错误（${apiCode ?? status}）：${m}`, `MiniMax returned an error (${apiCode ?? status}): ${m}`, {status, apiCode});
};

let lastCallAt = 0;
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 只下载 http(s)，不带任何鉴权头（音频 / 字幕文件是对象存储的临时链接） */
const download = async (url, fetchImpl, asJson) => {
  if (!/^https?:\/\//i.test(url)) throw new Error('not an http(s) url');
  const res = await fetchImpl(url, {method: 'GET'});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (asJson) return res.json();
  return Buffer.from(await res.arrayBuffer());
};

/**
 * @param {string} text 旁白（已去掉 {}）
 * @param {{outBase: string, lang?: 'zh'|'en', speed?: number, voiceId?: string, emotion?: string, model?: string,
 *          env?: Record<string, string|undefined>, fetch?: typeof fetch, sleep?: (ms: number) => Promise<void>,
 *          maxRetries?: number, minIntervalMs?: number, timeoutMs?: number, log?: (s: string) => void}} opts
 */
export async function synthesize(text, opts) {
  const env = opts.env ?? process.env;
  const key = String(env.MINIMAX_API_KEY ?? '').trim();
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const log = opts.log ?? (() => {});
  const lang = opts.lang === 'en' ? 'en' : 'zh';
  if (!key)
    throw new TtsError('NO_KEY', '没有设置 MINIMAX_API_KEY，无法调用 MiniMax 配音', 'MINIMAX_API_KEY is not set; cannot call MiniMax TTS', {
      hint: '设好环境变量后重跑；想先看效果，加 --voice-provider mock（占位音，不用改分镜）预览，或加 --no-voice 出无配音版',
      hintEn: 'set it and run again; to preview first, pass --voice-provider mock (placeholder voice, storyboard unchanged), or pass --no-voice',
    });
  if (!String(text).trim()) throw new TtsError('EMPTY', '旁白是空的', 'narration text is empty');
  const n = Array.from(String(text)).length;
  if (n >= MAX_CHARS)
    throw new TtsError('TOO_LONG', `旁白 ${n} 字，超过 MiniMax 同步接口单次上限（不到 ${MAX_CHARS} 字）`, `narration is ${n} characters; the synchronous API takes fewer than ${MAX_CHARS}`, {hint: '一镜一句，拆开写', hintEn: 'split it across shots'});
  if (typeof fetchImpl !== 'function') throw new TtsError('NO_FETCH', '当前 Node 没有 fetch（需要 Node 18+）', 'fetch is not available (Node 18+ required)');

  const voiceSetting = {voice_id: opts.voiceId || DEFAULT_VOICE[lang], speed: opts.speed ?? 1, vol: 1, pitch: 0};
  if (opts.emotion) voiceSetting.emotion = opts.emotion;
  const body = JSON.stringify({
    model: opts.model || DEFAULT_MODEL,
    text,
    stream: false,
    voice_setting: voiceSetting,
    audio_setting: {sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1},
    language_boost: lang === 'en' ? 'English' : 'Chinese',
    output_format: 'hex',
    subtitle_enable: true,
    subtitle_type: 'word',
  });
  const url = endpointOf(env);
  const maxRetries = opts.maxRetries ?? 4;
  const minGap = opts.minIntervalMs ?? 1000;
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const wait = lastCallAt + minGap - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    let json;
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
        body,
        signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(opts.timeoutMs ?? 60000) : undefined,
      });
      if (!res.ok) {
        let msg = '';
        try {
          msg = await res.text();
        } catch {}
        throw classify({status: res.status, msg, key});
      }
      try {
        json = await res.json();
      } catch {
        throw new TtsError('BAD_RESPONSE', 'MiniMax 返回的不是 JSON', 'MiniMax returned non-JSON', {retryable: true});
      }
      const code = json?.base_resp?.status_code;
      if (code !== undefined && code !== 0) throw classify({status: res.status, apiCode: code, msg: json?.base_resp?.status_msg, key});
    } catch (e) {
      const err = e instanceof TtsError ? e : new TtsError('NETWORK', `连不上 MiniMax：${redact(e?.message ?? e, key)}`, `could not reach MiniMax: ${redact(e?.message ?? e, key)}`, {retryable: true, hint: '检查网络或 MINIMAX_BASE_URL', hintEn: 'check the network or MINIMAX_BASE_URL'});
      lastErr = err;
      if (!err.retryable || attempt === maxRetries) throw err;
      const delay = Math.min(30000, (err.code === 'RATE_LIMIT' ? 2000 : 1000) * 2 ** attempt) + Math.floor(Math.random() * 250);
      log(`MiniMax ${err.code}，${(delay / 1000).toFixed(1)} 秒后重试（第 ${attempt + 1}/${maxRetries} 次）`);
      await sleep(delay);
      continue;
    }
    // ---- 成功：取音频 ----
    const data = json?.data ?? {};
    const extra = json?.extra_info ?? {};
    const raw = typeof data.audio === 'string' ? data.audio.trim() : '';
    if (!raw) throw new TtsError('BAD_RESPONSE', 'MiniMax 没返回音频（data.audio 为空）', 'MiniMax returned no audio (data.audio is empty)');
    let audio;
    if (/^https?:\/\//i.test(raw)) {
      try {
        audio = await download(raw, fetchImpl, false);
      } catch (e) {
        throw new TtsError('DOWNLOAD', `下载 MiniMax 音频失败：${redact(e?.message, key)}`, `could not download the MiniMax audio: ${redact(e?.message, key)}`, {retryable: false});
      }
    } else {
      if (!/^[0-9a-f]+$/i.test(raw) || raw.length % 2) throw new TtsError('BAD_RESPONSE', 'MiniMax 返回的音频不是 hex', 'MiniMax audio is not hex');
      audio = Buffer.from(raw, 'hex');
    }
    const ext = String(extra.audio_format || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
    const audioPath = `${opts.outBase}.${ext}`;
    fs.writeFileSync(audioPath, audio);
    const durMs = Number(extra.audio_length) > 0 ? Number(extra.audio_length) : ext === 'wav' ? wavInfo(audio)?.durMs ?? 0 : mp3DurationMs(audio) ?? 0;
    if (!(durMs > 0)) throw new TtsError('BAD_RESPONSE', '读不出 MiniMax 音频时长', 'could not read the MiniMax audio duration');
    // ---- 时间戳 ----
    let subtitle = null;
    const subUrl = typeof data.subtitle_file === 'string' ? data.subtitle_file.trim() : '';
    if (subUrl) {
      try {
        subtitle = await download(subUrl, fetchImpl, true);
        fs.writeFileSync(`${opts.outBase}.subtitle.json`, JSON.stringify(subtitle, null, 1), 'utf8');
      } catch (e) {
        log(`字幕时间戳下载失败（${redact(e?.message, key)}），改用按字数估算`);
      }
    }
    const t = wordsFromSubtitle(text, lang, durMs, subtitle);
    return {audioPath, ext, durMs: Math.round(durMs), words: t.words, granularity: t.granularity, usageCharacters: Number(extra.usage_characters) || 0, traceId: typeof json.trace_id === 'string' ? json.trace_id : undefined};
  }
  throw lastErr ?? new TtsError('API', 'MiniMax 调用失败', 'MiniMax call failed');
}

/** 测试用：清掉限流计时 */
export const _resetThrottle = () => {
  lastCallAt = 0;
};
