// ============================================================
// 火山引擎（豆包语音）语音合成：V3 单向流式 HTTP SSE，POST https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse。
//   - 密钥只从环境变量读，不写盘、不进日志、报错里不带（两套鉴权二选一）：
//       VOLCENGINE_TTS_API_KEY                               新版控制台「API Key 管理」→ 请求头 X-Api-Key
//       VOLCENGINE_TTS_APP_ID + VOLCENGINE_TTS_ACCESS_TOKEN  旧版控制台应用的 APP ID / Access Token → X-Api-App-Id / X-Api-Access-Key
//       VOLCENGINE_TTS_BASE_URL                              可选，完整接口地址。只接受 https
//   - meta.voice.model 填资源 ID（请求头 X-Api-Resource-Id）：seed-tts-2.0（默认，豆包语音合成模型 2.0）/ seed-tts-1.0 …，
//     音色要和资源版本对上（2.0 音色以 _uranus_bigtts 结尾）。
//   - 音频：event 352 的 data 是 base64 分片，按顺序拼起来是整段 mp3。
//   - 时间戳：2.0 用 enable_subtitle、1.0 用 enable_timestamp；事件里 sentence.words[{word, startTime, endTime}]，
//     单位是秒、相对整段音频，这里换成毫秒。2.0 的 word 是原文，1.0 是数字读法转换后的文字（对不上时 timing.mjs 退回估算）。
//   - 还没用真实 key 实测：字段按官方文档写，第一次真跑时看缓存目录里的 <hash>.subtitle.json 核对。
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import {httpsUrl, parseSSE, redact, toSegments, TtsError, withRetry} from './http.mjs';
import {mp3DurationMs} from './wav.mjs';
import {wordsFromSubtitle} from './timing.mjs';

export const id = 'volcengine';
export const DEFAULT_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse';
/** model = 资源 ID（X-Api-Resource-Id） */
export const DEFAULT_MODEL = 'seed-tts-2.0';
export const MODELS = ['seed-tts-2.0', 'seed-tts-1.0', 'seed-tts-1.0-concurr', 'seed-icl-2.0', 'seed-icl-1.0'];
/** 默认音色：中文「广告解说 2.0」，英文 Alex（2.0 音色，没在真实接口上试听过） */
export const DEFAULT_VOICE = {zh: 'zh_male_guanggaojieshuo_uranus_bigtts', en: 'en_male_alex_uranus_bigtts'};
export const KEY_ENV = ['VOLCENGINE_TTS_API_KEY'];
export const ENV = ['VOLCENGINE_TTS_API_KEY', 'VOLCENGINE_TTS_APP_ID', 'VOLCENGINE_TTS_ACCESS_TOKEN', 'VOLCENGINE_TTS_BASE_URL'];
export const hasKey = (env = process.env) =>
  !!String(env?.VOLCENGINE_TTS_API_KEY ?? '').trim() || (!!String(env?.VOLCENGINE_TTS_APP_ID ?? '').trim() && !!String(env?.VOLCENGINE_TTS_ACCESS_TOKEN ?? '').trim());
/** 旧版接口写的是单次 1024 字节（约 300 汉字）；V3 没写数字，按这个保守拦 */
export const MAX_CHARS = 1000;
const OK_CODES = new Set([0, 20000000]);

export const endpointOf = (env = process.env) =>
  String(env.VOLCENGINE_TTS_BASE_URL ?? '').trim() ? httpsUrl(env.VOLCENGINE_TTS_BASE_URL, 'VOLCENGINE_TTS_BASE_URL') : DEFAULT_URL;

/** 语速倍数（0.5–2）→ speech_rate（-50–100，100 = 2 倍速，-50 = 0.5 倍速） */
export const speechRateOf = (speed = 1) => Math.max(-50, Math.min(100, Math.round(((Number(speed) || 1) - 1) * 100)));
const isV2 = (resource) => /-2\.\d/.test(resource);

const AUTH_HINT = '检查 VOLCENGINE_TTS_API_KEY（或 APP_ID + ACCESS_TOKEN）；音色要和 meta.voice.model（资源 ID）对上，并且在控制台开通了';
const AUTH_HINT_EN = 'check VOLCENGINE_TTS_API_KEY (or APP_ID + ACCESS_TOKEN); the voice must match meta.voice.model (resource ID) and be enabled in the console';

/** HTTP 状态 / 业务码 → TtsError */
export const classify = ({status, code, msg, key}) => {
  const m = redact(msg, key);
  const tag = code ?? status;
  if (status === 401 || status === 403 || code === 45000000 || /permission denied|unauthori[sz]ed|invalid (api )?key|access denied/i.test(m))
    return new TtsError('AUTH', `火山引擎鉴权失败（${tag}）：${m}`, `Volcengine authentication failed (${tag}): ${m}`, {status, apiCode: code, hint: AUTH_HINT, hintEn: AUTH_HINT_EN});
  if (/lifetime/i.test(m))
    return new TtsError('QUOTA', `火山引擎试用额度用完（${tag}）`, `Volcengine trial quota used up (${tag})`, {status, apiCode: code, hint: '到控制台开通正式版或购买资源包', hintEn: 'enable the paid plan in the console'});
  if (status === 429 || /quota exceeded|concurrency|too many/i.test(m))
    return new TtsError('RATE_LIMIT', `火山引擎限流（${tag}）`, `Volcengine rate limit (${tag})`, {retryable: true, status, apiCode: code, hint: '稍后重试，或减少并发', hintEn: 'retry later'});
  if (code === 40402003)
    return new TtsError('TOO_LONG', '旁白超过火山引擎单次长度上限（40402003）', 'narration is over the Volcengine per-request length limit (40402003)', {status, apiCode: code, hint: '一镜一句，拆开写', hintEn: 'split it across shots'});
  if (status === 400 || (code && String(code).startsWith('4')))
    return new TtsError('BAD_PARAMS', `火山引擎参数不合法（${tag}）：${m}`, `Volcengine rejected the parameters (${tag}): ${m}`, {status, apiCode: code, hint: '检查 meta.voice 的 voiceId / model（资源 ID）是否匹配', hintEn: 'check that meta.voice voiceId matches model (resource ID)'});
  if ((status && status >= 500) || status === 408 || code === 55000000)
    return new TtsError('SERVER', `火山引擎服务暂时出错（${tag}）：${m}`, `Volcengine server error (${tag}): ${m}`, {retryable: true, status, apiCode: code});
  return new TtsError('API', `火山引擎返回错误（${tag}）：${m}`, `Volcengine returned an error (${tag}): ${m}`, {status, apiCode: code});
};

/**
 * @param {string} text 旁白（已去掉 {}）
 * @param {{outBase: string, lang?: 'zh'|'en', speed?: number, voiceId?: string, model?: string,
 *          env?: Record<string, string|undefined>, fetch?: typeof fetch, sleep?: (ms: number) => Promise<void>,
 *          maxRetries?: number, minIntervalMs?: number, timeoutMs?: number, log?: (s: string) => void}} opts
 */
export async function synthesize(text, opts) {
  const env = opts.env ?? process.env;
  const apiKey = String(env.VOLCENGINE_TTS_API_KEY ?? '').trim();
  const appId = String(env.VOLCENGINE_TTS_APP_ID ?? '').trim();
  const token = String(env.VOLCENGINE_TTS_ACCESS_TOKEN ?? '').trim();
  const key = apiKey || token;
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const log = opts.log ?? (() => {});
  const lang = opts.lang === 'en' ? 'en' : 'zh';
  if (!apiKey && !(appId && token))
    throw new TtsError('NO_KEY', '没有设置 VOLCENGINE_TTS_API_KEY（或 VOLCENGINE_TTS_APP_ID + VOLCENGINE_TTS_ACCESS_TOKEN），无法调用火山引擎配音', 'VOLCENGINE_TTS_API_KEY (or VOLCENGINE_TTS_APP_ID + VOLCENGINE_TTS_ACCESS_TOKEN) is not set; cannot call Volcengine TTS', {
      hint: '设好环境变量后重跑；想先看效果，加 --voice-provider mock（占位音，不用改分镜）预览，或加 --no-voice 出无配音版',
      hintEn: 'set it and run again; to preview first, pass --voice-provider mock (placeholder voice, storyboard unchanged), or pass --no-voice',
    });
  if (!String(text).trim()) throw new TtsError('EMPTY', '旁白是空的', 'narration text is empty');
  const n = Array.from(String(text)).length;
  if (n > MAX_CHARS) throw new TtsError('TOO_LONG', `旁白 ${n} 字，超过火山引擎单次上限（约 ${MAX_CHARS} 字）`, `narration is ${n} characters, over the Volcengine per-request limit (~${MAX_CHARS})`, {hint: '一镜一句，拆开写', hintEn: 'split it across shots'});
  if (typeof fetchImpl !== 'function') throw new TtsError('NO_FETCH', '当前 Node 没有 fetch（需要 Node 18+）', 'fetch is not available (Node 18+ required)');

  const resource = opts.model || DEFAULT_MODEL;
  const url = endpointOf(env);
  const audioParams = {format: 'mp3', sample_rate: 24000, speech_rate: speechRateOf(opts.speed)};
  audioParams[isV2(resource) ? 'enable_subtitle' : 'enable_timestamp'] = true;
  const body = JSON.stringify({user: {uid: 'brewreel'}, req_params: {text, speaker: opts.voiceId || DEFAULT_VOICE[lang], audio_params: audioParams}});
  const headers = {'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-Api-Resource-Id': resource, 'X-Api-Request-Id': crypto.randomUUID()};
  if (apiKey) headers['X-Api-Key'] = apiKey;
  else {
    headers['X-Api-App-Id'] = appId;
    headers['X-Api-Access-Key'] = token;
  }

  const r = await withRetry(
    async () => {
      const res = await fetchImpl(url, {method: 'POST', headers, body, signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(opts.timeoutMs ?? 90000) : undefined});
      let raw = '';
      try {
        raw = await res.text();
      } catch {}
      const events = parseSSE(raw);
      if (!res.ok) {
        const d = events.find((e) => e.data && typeof e.data === 'object')?.data ?? {};
        throw classify({status: res.status, code: typeof d.code === 'number' ? d.code : undefined, msg: d.message ?? raw, key});
      }
      const chunks = [];
      const words = [];
      const seen = new Set();
      let usage = 0;
      for (const {data} of events) {
        if (!data || typeof data !== 'object') continue;
        const code = Number(data.code ?? 0);
        if (!OK_CODES.has(code)) throw classify({status: res.status, code, msg: data.message, key});
        if (typeof data.data === 'string' && data.data) chunks.push(Buffer.from(data.data, 'base64'));
        for (const w of Array.isArray(data.sentence?.words) ? data.sentence.words : []) {
          const b = Math.round(Number(w.startTime) * 1000);
          const e = Math.round(Number(w.endTime) * 1000);
          const k = `${b}|${e}|${w.word}`;
          if (!Number.isFinite(b) || !Number.isFinite(e) || seen.has(k)) continue;
          seen.add(k);
          words.push({text: String(w.word ?? ''), b, e});
        }
        if (Number(data.usage?.text_words) > 0) usage = Number(data.usage.text_words);
      }
      if (!chunks.length) throw new TtsError('BAD_RESPONSE', '火山引擎没返回音频', 'Volcengine returned no audio', {retryable: true});
      return {chunks, words, usage};
    },
    {id, key, maxRetries: opts.maxRetries, minIntervalMs: opts.minIntervalMs ?? 300, sleep: opts.sleep, log, name: '火山引擎', netHint: '检查网络或 VOLCENGINE_TTS_BASE_URL', netHintEn: 'check the network or VOLCENGINE_TTS_BASE_URL'},
  );

  const audio = Buffer.concat(r.chunks);
  const audioPath = `${opts.outBase}.mp3`;
  fs.writeFileSync(audioPath, audio);
  const durMs = mp3DurationMs(audio) ?? 0;
  if (!(durMs > 0)) throw new TtsError('BAD_RESPONSE', '读不出火山引擎音频时长', 'could not read the Volcengine audio duration');
  const subtitle = toSegments(r.words.sort((a, b) => a.b - b.b));
  if (subtitle) fs.writeFileSync(`${opts.outBase}.subtitle.json`, JSON.stringify(subtitle, null, 1), 'utf8');
  else log('火山引擎没返回字级时间戳，改用按字数估算');
  const t = wordsFromSubtitle(text, lang, durMs, subtitle);
  return {audioPath, ext: 'mp3', durMs: Math.round(durMs), words: t.words, granularity: t.granularity, usageCharacters: r.usage || n};
}
