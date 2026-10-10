const DEEPSEEK_URL = 'https://api.deepseek.com';
export const LLM_TIMEOUT_MS = 180_000;

function assertHttps(base) {
  let url;
  try { url = new URL(base); }
  catch { throw new Error('接口地址不是合法 URL，且必须是 https'); }
  if (url.protocol !== 'https:') throw new Error('接口地址必须是 https');
  return url;
}

function isDeepseekUrl(base) {
  try {
    const url = new URL(base);
    return url.protocol === 'https:' && (url.hostname === 'api.deepseek.com' || url.hostname.endsWith('.deepseek.com'));
  } catch { return false; }
}

// key 和地址成对取：DEEPSEEK_API_KEY 只能发到 DeepSeek；自定义地址只能用 LLM_API_KEY。
export function resolveLlmEndpoint({env = process.env, baseArg, timeoutMs = LLM_TIMEOUT_MS} = {}) {
  const deepseekKey = String(env.DEEPSEEK_API_KEY ?? '').trim();
  const llmKey = String(env.LLM_API_KEY ?? '').trim();
  const custom = String(baseArg || env.LLM_BASE_URL || '').trim().replace(/\/+$/u, '');
  if (custom) {
    assertHttps(custom);
    if (isDeepseekUrl(custom)) {
      if (llmKey) return {apiKey: llmKey, base: custom, timeoutMs, pair: 'LLM_API_KEY'};
      if (deepseekKey) return {apiKey: deepseekKey, base: custom, timeoutMs, pair: 'DEEPSEEK_API_KEY'};
      throw new Error('DeepSeek 接口地址需要 DEEPSEEK_API_KEY 或 LLM_API_KEY');
    }
    if (!llmKey) throw new Error('自定义接口地址只能和 LLM_API_KEY 成对使用，不能把 DEEPSEEK_API_KEY 发到其他地址');
    return {apiKey: llmKey, base: custom, timeoutMs, pair: 'LLM_API_KEY'};
  }
  if (deepseekKey) return {apiKey: deepseekKey, base: DEEPSEEK_URL, timeoutMs, pair: 'DEEPSEEK_API_KEY'};
  if (llmKey) throw new Error('使用 LLM_API_KEY 时必须同时设置 LLM_BASE_URL 或 --base-url');
  throw new Error('未找到成对的密钥和接口地址（DEEPSEEK_API_KEY 对应 DeepSeek，或 LLM_API_KEY 与 LLM_BASE_URL 成对）');
}
