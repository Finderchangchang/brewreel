// 便宜模型（OpenAI 兼容 chat/completions）的共用调用层。llm_broll 和转写校对共用。
// 环境变量（只有真正调用时才读）：
//   LLM_API_KEY（没有再读 DEEPSEEK_API_KEY）
//   LLM_BASE_URL  默认 https://api.deepseek.com
//   LLM_MODEL     默认 deepseek-flash
// 报错文案里的密钥一律打码（redact），不落盘、不打印。

export const SECRET_RE = /bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}/gi;

export const redact = (text) => String(text ?? '').replace(SECRET_RE, (m) => (m.toLowerCase().startsWith('bearer') ? 'Bearer [redacted]' : 'sk-[redacted]'));

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
      last = redact(`接口调用失败：${e?.name || 'Error'}: ${e?.message || e}`);
      if (attempt < 2) {
        log(`  网络中断，${Math.round((retryDelayMs * (attempt + 1)) / 1000)} 秒后重试…`);
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      throw new Error(last);
    }
    const raw = await res.text();
    if (res.status === 429 || res.status >= 500) {
      last = redact(`接口报错 HTTP ${res.status}：${raw.slice(0, 300)}`);
      if (attempt < 2) {
        log(`  接口 HTTP ${res.status}，${Math.round((retryDelayMs * (attempt + 1)) / 1000)} 秒后重试…`);
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      throw new Error(last);
    }
    if (!res.ok) throw new Error(redact(`接口报错 HTTP ${res.status}：${raw.slice(0, 300)}`));
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
