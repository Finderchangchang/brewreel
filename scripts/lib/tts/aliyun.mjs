// ============================================================
// 阿里云百炼（DashScope）CosyVoice 语音合成：POST …/api/v1/services/audio/tts/SpeechSynthesizer，
// 请求头 Authorization: Bearer <DASHSCOPE_API_KEY> + X-DashScope-SSE: enable（字级时间戳只在 SSE 流式里下发）。
//   - 密钥只从环境变量读，不写盘、不进日志、报错里不带：
//       DASHSCOPE_API_KEY       必填，百炼控制台「API-KEY 管理」
//       DASHSCOPE_WORKSPACE_ID  可选，百炼业务空间 ID；填了走空间域名 https://<id>.<DASHSCOPE_REGION>.maas.aliyuncs.com
//       DASHSCOPE_REGION        可选，默认 cn-beijing（新加坡填 ap-southeast-1）
//       DASHSCOPE_TTS_URL       可选，完整接口地址，覆盖上面两项。只接受 https
//   - 音频：SSE 事件里 output.audio.data 是 base64 分片，按顺序拼起来是整段 mp3；只给了 output.audio.url 时下载（不带鉴权头）。
//   - 时间戳：句末事件里的 words[{text, begin_time, end_time}]（毫秒）。官方文档没给出完整的事件嵌套路径，
//     这里在整个事件里找 words 数组；解析不出字级就退回按字数估算（timing.mjs）。
//   - 还没用真实 key 实测：字段按官方文档写，第一次真跑时看缓存目录里的 <hash>.subtitle.json 核对。
//   - 限流：cosyvoice / qwen-audio 系列约 3 RPS，默认两次调用隔 400 毫秒。
// ============================================================
import fs from 'node:fs';
import {download, httpsUrl, parseSSE, redact, toSegments, TtsError, withRetry} from './http.mjs';
import {mp3DurationMs} from './wav.mjs';
import {wordsFromSubtitle} from './timing.mjs';

export const id = 'aliyun';
export const DEFAULT_BASE = 'https://dashscope.aliyuncs.com';
export const PATH = '/api/v1/services/audio/tts/SpeechSynthesizer';
export const DEFAULT_MODEL = 'cosyvoice-v3-flash';
export const MODELS = ['cosyvoice-v3-flash', 'cosyvoice-v3-plus', 'cosyvoice-v3.5-plus', 'qwen-audio-3.0-tts-flash', 'qwen-audio-3.1-tts-flash', 'qwen-audio-3.0-tts-plus'];
/** 默认音色：中文「沉稳质感男」，英文美式女声（都来自官方音色列表，没在真实接口上试听过） */
export const DEFAULT_VOICE = {zh: 'longsanshu_v3', en: 'loongabby_v3'};
/** 要设的环境变量（validate 提醒、插件白名单用） */
export const KEY_ENV = ['DASHSCOPE_API_KEY'];
export const ENV = ['DASHSCOPE_API_KEY', 'DASHSCOPE_WORKSPACE_ID', 'DASHSCOPE_REGION', 'DASHSCOPE_TTS_URL'];
export const hasKey = (env = process.env) => !!String(env?.DASHSCOPE_API_KEY ?? '').trim();
/** 单次文本上限（SDK 写的是 2 万字符；HTTP 接口没写，按这个保守拦） */
export const MAX_CHARS = 20000;

/** 接口地址：DASHSCOPE_TTS_URL > 业务空间域名 > dashscope.aliyuncs.com */
export const endpointOf = (env = process.env) => {
  if (String(env.DASHSCOPE_TTS_URL ?? '').trim()) return httpsUrl(env.DASHSCOPE_TTS_URL, 'DASHSCOPE_TTS_URL');
  const ws = String(env.DASHSCOPE_WORKSPACE_ID ?? '').trim();
  if (ws) {
    const region = String(env.DASHSCOPE_REGION ?? '').trim() || 'cn-beijing';
    if (!/^[A-Za-z0-9-]+$/.test(ws) || !/^[a-z0-9-]+$/.test(region))
      throw new TtsError('BAD_PARAMS', 'DASHSCOPE_WORKSPACE_ID / DASHSCOPE_REGION 格式不对', 'DASHSCOPE_WORKSPACE_ID / DASHSCOPE_REGION look malformed', {
        hint: '业务空间 ID 从百炼控制台原样复制；地域如 cn-beijing、ap-southeast-1',
        hintEn: 'copy the workspace ID from the Model Studio console; region like cn-beijing or ap-southeast-1',
      });
    return `https://${ws}.${region}.maas.aliyuncs.com${PATH}`;
  }
  return `${DEFAULT_BASE}${PATH}`;
};

const AUTH_HINT = '检查 DASHSCOPE_API_KEY；用了业务空间域名的，DASHSCOPE_WORKSPACE_ID 要和 key 属于同一个账号、同一个地域';
const AUTH_HINT_EN = 'check DASHSCOPE_API_KEY; with a workspace host, DASHSCOPE_WORKSPACE_ID must belong to the same account and region as the key';

/** HTTP 状态 / 百炼错误码（如 InvalidApiKey、Throttling.RateQuota）→ TtsError */
export const classify = ({status, code, msg, key}) => {
  const c = String(code ?? '');
  const m = redact(msg, key);
  const tag = c || status;
  if (status === 401 || status === 403 || /InvalidApiKey|AccessDenied|NOT AUTHORIZED|Unauthorized/i.test(c))
    return new TtsError('AUTH', `阿里云鉴权失败（${tag}）`, `Alibaba Cloud authentication failed (${tag})`, {status, hint: AUTH_HINT, hintEn: AUTH_HINT_EN});
  if (/AllocationQuota|Arrearage|QuotaExhausted/i.test(c))
    return new TtsError('QUOTA', `阿里云额度用完或欠费（${tag}）：${m}`, `Alibaba Cloud quota exhausted or account in arrears (${tag}): ${m}`, {status, hint: '到百炼控制台查额度和账单', hintEn: 'check quota and billing in the Model Studio console'});
  if (status === 429 || /^Throttling/i.test(c))
    return new TtsError('RATE_LIMIT', `阿里云限流（${tag}）`, `Alibaba Cloud rate limit (${tag})`, {retryable: true, status, hint: '稍后重试，或减少并发', hintEn: 'retry later'});
  if (/DataInspectionFailed/i.test(c))
    return new TtsError('BAD_TEXT', `旁白没通过阿里云内容审核（${tag}）`, `the narration failed Alibaba Cloud content moderation (${tag})`, {status, hint: '改写这句旁白', hintEn: 'rewrite the line'});
  if (status === 400 || /InvalidParameter|ModelNotFound|Model not exist/i.test(c + m))
    return new TtsError('BAD_PARAMS', `阿里云参数不合法（${tag}）：${m}`, `Alibaba Cloud rejected the parameters (${tag}): ${m}`, {status, hint: '检查 meta.voice 的 voiceId / model / speed', hintEn: 'check meta.voice voiceId / model / speed'});
  if ((status && status >= 500) || status === 408 || /InternalError|RequestTimeOut|ServiceUnavailable/i.test(c))
    return new TtsError('SERVER', `阿里云服务暂时出错（${tag}）：${m}`, `Alibaba Cloud server error (${tag}): ${m}`, {retryable: true, status});
  return new TtsError('API', `阿里云返回错误（${tag}）：${m}`, `Alibaba Cloud returned an error (${tag}): ${m}`, {status});
};

/** 在一个事件对象里找字级时间戳数组（元素带 begin_time / end_time） */
const findWords = (o, depth = 0) => {
  if (!o || typeof o !== 'object' || depth > 5) return null;
  if (Array.isArray(o.words) && o.words.some((w) => w && typeof w === 'object' && 'begin_time' in w)) return o.words;
  for (const v of Object.values(o)) {
    const r = findWords(v, depth + 1);
    if (r) return r;
  }
  return null;
};

/**
 * @param {string} text 旁白（已去掉 {}）
 * @param {{outBase: string, lang?: 'zh'|'en', speed?: number, voiceId?: string, model?: string,
 *          env?: Record<string, string|undefined>, fetch?: typeof fetch, sleep?: (ms: number) => Promise<void>,
 *          maxRetries?: number, minIntervalMs?: number, timeoutMs?: number, log?: (s: string) => void}} opts
 */
export async function synthesize(text, opts) {
  const env = opts.env ?? process.env;
  const key = String(env.DASHSCOPE_API_KEY ?? '').trim();
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const log = opts.log ?? (() => {});
  const lang = opts.lang === 'en' ? 'en' : 'zh';
  if (!key)
    throw new TtsError('NO_KEY', '没有设置 DASHSCOPE_API_KEY，无法调用阿里云配音', 'DASHSCOPE_API_KEY is not set; cannot call Alibaba Cloud TTS', {
      hint: '设好环境变量后重跑；想先看效果，加 --voice-provider mock（占位音，不用改分镜）预览，或加 --no-voice 出无配音版',
      hintEn: 'set it and run again; to preview first, pass --voice-provider mock (placeholder voice, storyboard unchanged), or pass --no-voice',
    });
  if (!String(text).trim()) throw new TtsError('EMPTY', '旁白是空的', 'narration text is empty');
  const n = Array.from(String(text)).length;
  if (n >= MAX_CHARS) throw new TtsError('TOO_LONG', `旁白 ${n} 字，超过阿里云单次上限`, `narration is ${n} characters, over the Alibaba Cloud per-request limit`, {hint: '一镜一句，拆开写', hintEn: 'split it across shots'});
  if (typeof fetchImpl !== 'function') throw new TtsError('NO_FETCH', '当前 Node 没有 fetch（需要 Node 18+）', 'fetch is not available (Node 18+ required)');

  const url = endpointOf(env);
  const body = JSON.stringify({
    model: opts.model || DEFAULT_MODEL,
    input: {
      text,
      voice: opts.voiceId || DEFAULT_VOICE[lang],
      format: 'mp3',
      sample_rate: 24000,
      rate: opts.speed ?? 1,
      word_timestamp_enabled: true,
      language_hints: [lang],
    },
  });
  const r = await withRetry(
    async () => {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-DashScope-SSE': 'enable'},
        body,
        signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(opts.timeoutMs ?? 90000) : undefined,
      });
      let raw = '';
      try {
        raw = await res.text();
      } catch {}
      const events = parseSSE(raw);
      if (!res.ok) {
        const d = events.find((e) => e.data && typeof e.data === 'object')?.data ?? {};
        throw classify({status: res.status, code: d.code, msg: d.message ?? raw, key});
      }
      const chunks = [];
      let audioUrl = '';
      let usage = 0;
      let requestId;
      const seen = new Set();
      const words = [];
      for (const {event, data} of events) {
        if (!data || typeof data !== 'object') continue;
        requestId ??= data.request_id;
        if (event === 'error' || (data.code && !data.output)) throw classify({status: res.status, code: data.code, msg: data.message, key});
        const a = data.output?.audio;
        if (a && typeof a.data === 'string' && a.data) chunks.push(Buffer.from(a.data, 'base64'));
        if (a && typeof a.url === 'string' && a.url) audioUrl = a.url;
        if (Number(data.usage?.characters) > 0) usage = Number(data.usage.characters);
        for (const w of findWords(data) ?? []) {
          const k = `${w.begin_index ?? ''}|${w.begin_time}|${w.end_time}|${w.text}`;
          if (seen.has(k)) continue;
          seen.add(k);
          words.push({text: String(w.text ?? ''), b: Number(w.begin_time), e: Number(w.end_time)});
        }
      }
      if (!chunks.length && !audioUrl) throw new TtsError('BAD_RESPONSE', '阿里云没返回音频', 'Alibaba Cloud returned no audio', {retryable: true});
      return {chunks, audioUrl, usage, words, requestId};
    },
    {id, key, maxRetries: opts.maxRetries, minIntervalMs: opts.minIntervalMs ?? 400, sleep: opts.sleep, log, name: '阿里云', netHint: '检查网络或 DASHSCOPE_TTS_URL', netHintEn: 'check the network or DASHSCOPE_TTS_URL'},
  );

  let audio;
  if (r.chunks.length) audio = Buffer.concat(r.chunks);
  else {
    try {
      audio = await download(r.audioUrl, fetchImpl);
    } catch (e) {
      throw new TtsError('DOWNLOAD', `下载阿里云音频失败：${redact(e?.message, key)}`, `could not download the Alibaba Cloud audio: ${redact(e?.message, key)}`);
    }
  }
  const audioPath = `${opts.outBase}.mp3`;
  fs.writeFileSync(audioPath, audio);
  const durMs = mp3DurationMs(audio) ?? 0;
  if (!(durMs > 0)) throw new TtsError('BAD_RESPONSE', '读不出阿里云音频时长', 'could not read the Alibaba Cloud audio duration');
  // 分句下发的时间戳如果是句内相对时间，后一句会比前一句早：按前一句结尾接上
  let offset = 0;
  let lastEnd = 0;
  const words = r.words.map((w) => {
    if (w.b + offset < lastEnd - 50) offset = lastEnd - w.b;
    const out = {text: w.text, b: w.b + offset, e: w.e + offset};
    lastEnd = Math.max(lastEnd, out.e);
    return out;
  });
  const subtitle = toSegments(words.filter((w) => Number.isFinite(w.b) && Number.isFinite(w.e)));
  if (subtitle) fs.writeFileSync(`${opts.outBase}.subtitle.json`, JSON.stringify(subtitle, null, 1), 'utf8');
  else log('阿里云没返回字级时间戳，改用按字数估算');
  const t = wordsFromSubtitle(text, lang, durMs, subtitle);
  return {audioPath, ext: 'mp3', durMs: Math.round(durMs), words: t.words, granularity: t.granularity, usageCharacters: r.usage || n, traceId: typeof r.requestId === 'string' ? r.requestId : undefined};
}
