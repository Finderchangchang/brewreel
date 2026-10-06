// 便宜模型（OpenAI 兼容 chat/completions）的共用调用层。llm_broll 和转写校对共用。
// 环境变量（只有真正调用时才读）：
//   LLM_API_KEY（没有再读 DEEPSEEK_API_KEY）
//   LLM_BASE_URL  默认 https://api.deepseek.com
//   LLM_MODEL     默认 deepseek-flash
// 报错文案里的密钥一律打码（redact），不落盘、不打印。

export const SECRET_RE = /bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}/gi;

const KEY_ENV_NAMES = ['MINIMAX_API_KEY', 'MINIMAX_PAYGO_API_KEY', 'DEEPSEEK_API_KEY', 'LLM_API_KEY'];

/** 先按 key 原文替换，再套通用正则。key 含点号或不以 sk- 开头时，只靠正则会漏。 */
export const redact = (text, key) => {
  let out = String(text ?? '');
  const extra = String(key ?? '').trim();
  if (extra.length >= 8) out = out.split(extra).join('***');
  return out.replace(SECRET_RE, (m) => (m.toLowerCase().startsWith('bearer') ? 'Bearer [redacted]' : 'sk-[redacted]'));
};

/** 环境里这几个 key 都按原文打码，再套通用正则。写报告前再过一遍。 */
export const redactSecrets = (text, env = process.env) => {
  let out = String(text ?? '');
  for (const name of KEY_ENV_NAMES) {
    const key = String(env?.[name] ?? '').trim();
    if (key.length >= 8) out = out.split(key).join('***');
  }
  return redact(out);
};

/** 粗估 token：中日韩字符按 0.7，其余按 3.5 字符一个。只用于 --dry-run 提示。 */
export const estTokens = (text) => {
  const s = String(text ?? '');
  const cjk = [...s].filter((ch) => {
    const c = ch.codePointAt(0);
    return (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x3000 && c <= 0x303f);
  }).length;
  return Math.round(cjk * 0.7 + (s.length - cjk) / 3.5);
};

/** 模型偶尔包一层 ```json … ``` 或在前后加话；取第一个 { 到最后一个 }。 */
export const extractJson = (text) => {
  let t = String(text ?? '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
};

/** 接口报错 → 一句人话的下一步（key 填错、余额不足、断网最常见）。msg 是 callLlm 抛出的报错原文。 */
export const explainLlmError = (msg) => {
  const m = String(msg ?? '');
  if (/HTTP 40[13]\b/.test(m)) return 'key 不对或已经失效：检查 DEEPSEEK_API_KEY（或 LLM_API_KEY）有没有填错、是不是这家接口的 key，改好再跑同一条命令';
  if (/HTTP 402\b|insufficient|balance/i.test(m)) return '账户余额不足：去 DeepSeek 开放平台充值后，再跑同一条命令';
  if (/HTTP 404\b/.test(m)) return '接口地址或模型名不对：检查 LLM_BASE_URL 和 LLM_MODEL';
  if (/HTTP 429\b/.test(m)) return '请求太频繁或额度用完：等一会儿再跑同一条命令';
  if (/HTTP 5\d\d\b/.test(m)) return '接口那边出错：等一会儿再跑同一条命令';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|TimeoutError|AbortError|network/i.test(m)) return '连不上接口：检查网络，以及 LLM_BASE_URL 有没有写错，再跑同一条命令';
  return '检查 key、账户余额和网络，再跑同一条命令';
};

/** 有没有可用的 key（不返回 key 本身）。 */
export const hasLlmKey = (env = process.env) => Boolean(env.LLM_API_KEY || env.DEEPSEEK_API_KEY);

export const readLlmEnv = (env = process.env) => {
  const key = env.LLM_API_KEY || env.DEEPSEEK_API_KEY || '';
  const base = env.LLM_BASE_URL || 'https://api.deepseek.com';
  const model = env.LLM_MODEL || 'deepseek-flash';
  return {key, base, model};
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 调一次 chat/completions。网络中断、429、5xx 最多重试 2 次；其余错误直接抛。
 * @param {Array<{role: string, content: string}>} messages
 * @param {{key: string, base: string, model: string}} cfg  readLlmEnv() 的返回
 * @param {{temperature?: number, json?: boolean, timeoutMs?: number, log?: (s: string) => void, fetchImpl?: typeof fetch, retryDelayMs?: number}} [opts]
 * @returns {Promise<{content: string, usage: object}>}
 */
export const callLlm = async (messages, cfg, opts = {}) => {
  const {temperature = 0.7, json = true, timeoutMs = 180_000, log = console.log, fetchImpl = fetch, retryDelayMs = 3000} = opts;
  const url = cfg.base.replace(/\/+$/, '') + '/chat/completions';
  const payload = {model: cfg.model, messages, temperature};
  if (json) payload.response_format = {type: 'json_object'};
  const body = JSON.stringify(payload);
  let last = '接口调用失败';
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${cfg.key}`},
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      last = redact(`接口调用失败：${e?.name || 'Error'}: ${e?.message || e}`, cfg.key);
      if (attempt < 2) {
        log(`  网络中断，${Math.round((retryDelayMs * (attempt + 1)) / 1000)} 秒后重试…`);
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      throw new Error(last);
    }
    const raw = await res.text();
    if (res.status === 429 || res.status >= 500) {
      last = redact(`接口报错 HTTP ${res.status}：${raw.slice(0, 300)}`, cfg.key);
      if (attempt < 2) {
        log(`  接口 HTTP ${res.status}，${Math.round((retryDelayMs * (attempt + 1)) / 1000)} 秒后重试…`);
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      throw new Error(last);
    }
    if (!res.ok) throw new Error(redact(`接口报错 HTTP ${res.status}：${raw.slice(0, 300)}`, cfg.key));
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('接口返回不是 JSON');
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('接口返回里没有 message.content');
    const usage = data.usage && typeof data.usage === 'object' ? data.usage : {};
    return {content, usage};
  }
  throw new Error(last);
};
