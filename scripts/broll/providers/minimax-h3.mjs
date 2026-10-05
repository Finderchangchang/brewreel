// MiniMax H3 图生视频，以及 image-01 参考图。
// 密钥只从环境变量 MINIMAX_API_KEY 读，不写盘、不进日志、不进报错。
// 域名默认 https://api.minimaxi.com，可用 MINIMAX_BASE_URL 改。只收 https；
// 本机 127.0.0.1 / localhost 的 http 只给测试假服务器用。
// 提交不重试。查询和下载遇到 429 / 5xx 才指数退避，最多 3 次。
// 每段送自己的参考图（最多 5 张，5 张以内免费）；风格包可以写 extra.prompt_expansion_mode。
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_BASE = 'https://api.minimaxi.com';
export const VIDEO_MODEL = 'MiniMax-H3';
export const IMAGE_MODEL = 'image-01';
/** H3 的 extra.prompt_expansion_mode 可选值。不传 = 官方默认 balanced。 */
export const EXPANSION_MODES = ['disabled', 'balanced', 'quality'];
/** 每段参考图 5 张以内免费，超过每张另收 0.2 元；接口上限 9 张。脚本只送免费的量。 */
export const FREE_REFS = 5;
export const MAX_REFS = 9;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const AUTH_CODES = new Set([1004, 2049]);
const BALANCE_CODES = new Set([1008]);
const RATE_CODES = new Set([1002, 1039]);
const MODERATION_CODES = new Set([1026, 1027]);

export class H3Error extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'H3Error';
    this.code = code;
    this.http = extra.http ?? null;
    this.apiCode = extra.apiCode ?? null;
    this.retryable = !!extra.retryable;
    this.stopPool = extra.stopPool !== false;
    this.exitCode = extra.exitCode ?? (code === 'NO_KEY' || code === 'INSECURE_URL' ? 2 : 4);
  }
}

export const redact = (s, key) => {
  let out = String(s ?? '');
  if (key && key.length >= 4) out = out.split(key).join('***');
  return out.replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, 300);
};

/** 规范化域名。非本机的 http 直接拒绝。 */
export const resolveBase = (env = process.env, override) => {
  const raw = String(override ?? env.MINIMAX_BASE_URL ?? DEFAULT_BASE).trim().replace(/\/+$/, '');
  let base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new H3Error('INSECURE_URL', 'MINIMAX_BASE_URL 不是合法地址。改成 https://api.minimaxi.com');
  }
  const loopback = LOOPBACK.has(url.hostname);
  if (url.protocol === 'http:' && !loopback) {
    throw new H3Error('INSECURE_URL', 'MINIMAX_BASE_URL 必须是 https 地址（http 会把密钥明文发出去）。改成 https://api.minimaxi.com');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new H3Error('INSECURE_URL', 'MINIMAX_BASE_URL 必须是 https 地址。改成 https://api.minimaxi.com');
  }
  return base.replace(/\/+$/, '');
};

const blobOf = (json, text) => {
  const msg = json?.base_resp?.status_msg || json?.error?.message || json?.message || text || '';
  const type = json?.error?.type || json?.type || '';
  return `${type} ${msg}`.toLowerCase();
};

/** HTTP 状态和 base_resp.status_code → H3Error。没问题返回 null。 */
export const classify = ({status, json, text, key}) => {
  const code = json?.base_resp?.status_code ?? null;
  const msg = redact(json?.base_resp?.status_msg || json?.error?.message || json?.message || text || '', key);
  const type = json?.error?.type || json?.type || '';
  const blob = blobOf(json, text);
  // 查询成功时，任务失败原因在 task 里，交给 taskFailure。不要把正文里的词当成 HTTP 错误。
  if (status >= 200 && status < 300 && json?.task) return null;
  if (status === 401 || status === 403 || AUTH_CODES.has(code) || type === 'authorized_error') {
    return new H3Error('AUTH', `鉴权失败（${code ?? status}）。检查 MINIMAX_API_KEY，key 和域名要同区：大陆用 https://api.minimaxi.com。`, {http: status, apiCode: code});
  }
  if (status === 402 || BALANCE_CODES.has(code) || /余额|insufficient|balance/.test(blob)) {
    return new H3Error('BALANCE', `余额不足（${code ?? status}）。停下来，不要再提交。${msg}`.trim(), {http: status, apiCode: code});
  }
  if (MODERATION_CODES.has(code) || /sensitive|moderation|content_filter|content policy|审核|违规|拦截/.test(blob)) {
    return new H3Error('MODERATION', `内容审核拦截（${code ?? status}）：${msg || '没有更多原因'}`, {http: status, apiCode: code});
  }
  if (status === 429 || RATE_CODES.has(code)) {
    return new H3Error('RATE', `限流（${code ?? status}）`, {http: status, apiCode: code, retryable: true});
  }
  if ((status >= 500 && status <= 599) || code === 1000 || code === 1001 || status === 408) {
    return new H3Error('SERVER', `服务暂时出错（${code ?? status}）：${msg}`, {http: status, apiCode: code, retryable: true});
  }
  if (status !== 200 || (code != null && code !== 0 && !json?.task_id && !json?.task)) {
    return new H3Error('API', `接口返回错误（${code ?? status}）：${msg}`, {http: status, apiCode: code});
  }
  return null;
};

export const taskFailure = (task, key) => {
  const err = task?.error ?? {};
  const msg = redact(typeof err === 'string' ? err : err.message || err.msg || '', key);
  const type = String(typeof err === 'object' && err ? err.type || err.code || '' : '');
  const blob = `${type} ${msg}`.toLowerCase();
  if (/sensitive|moderation|content_filter|content policy|审核|违规|拦截/.test(blob)) {
    return new H3Error('MODERATION', `内容审核拦截：${msg || type || '没有更多原因'}`);
  }
  if (String(task?.status || '').toLowerCase() === 'cancelled') {
    return new H3Error('FAILED', `任务被取消：${msg || '没有更多原因'}。不自动重做。`);
  }
  return new H3Error('FAILED', `生成失败：${msg || '没有更多原因'}。不自动重做。`);
};

const mimeOf = (buf) => (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : 'image/png');
const dataUrl = (buf) => `data:${mimeOf(buf)};base64,${buf.toString('base64')}`;

/**
 * H3 提交的请求体。每段带自己的参考图（按顺序就是提示词里的图1、图2）；
 * promptExpansion 有值才写 extra.prompt_expansion_mode，不传时和 v0.8 的请求体一模一样。
 * 不发请求，先把会花冤枉钱或必然失败的情况拦下：没有参考图、参考图文件不在、超过 5 张、扩写模式写错。
 * @param {{prompt: string, refs: string[], resolution: string, duration: number, ratio: string,
 *   promptExpansion?: string|null, styleId?: string, readFile?: (p: string) => Buffer, exists?: (p: string) => boolean}} p
 */
export const buildVideoBody = ({prompt, refs, resolution, duration, ratio, promptExpansion = null, styleId = '', readFile = fs.readFileSync, exists = fs.existsSync}) => {
  const who = styleId ? `风格 ${styleId} ` : '';
  const next = `下一步：换一个已经有参考图的风格（或把这几段改成动效画面 / 留脸），或让维护者先跑 node scripts/broll/make-style-refs.mjs --style ${styleId || '<风格 id>'} --dry-run 看要发的请求，确认后加 --yes 出图。`;
  const list = Array.isArray(refs) ? refs : [];
  if (!list.length) throw new H3Error('NO_REFS', `${who}没有参考图。AI 画面要靠参考图定住角色和材质，这一段没有提交，也没有花钱。${next}`, {exitCode: 2});
  const missing = list.filter((p) => !exists(p));
  if (missing.length) {
    throw new H3Error('NO_REFS', `${who}缺参考图：${missing.map((p) => path.basename(p)).join('、')}（${missing.join('；')}）。这一段没有提交，也没有花钱。${next}`, {exitCode: 2});
  }
  if (list.length > FREE_REFS) {
    throw new H3Error('BAD_REQUEST', `参考图 ${list.length} 张。超过 ${FREE_REFS} 张的部分每张要另收 0.2 元，脚本不送。风格包的 refs 最多写 ${FREE_REFS} 张。`, {exitCode: 2});
  }
  if (promptExpansion != null && !EXPANSION_MODES.includes(promptExpansion)) {
    throw new H3Error('BAD_REQUEST', `提示词扩写模式「${promptExpansion}」不对，只能是 ${EXPANSION_MODES.join('、')}。改风格包里的 promptExpansion。`, {exitCode: 2});
  }
  const content = [{type: 'text', text: prompt}];
  for (const ref of list) content.push({type: 'image_url', image_url: {url: dataUrl(readFile(ref))}, role: 'reference_image'});
  const body = {model: VIDEO_MODEL, content, resolution, duration, ratio};
  if (promptExpansion != null) body.extra = {prompt_expansion_mode: promptExpansion};
  return body;
};

/** image-01 的请求体。subjectPath 有值时带主体参考（官方 subject_reference，type=character，Data URL）。 */
export const buildImageBody = ({prompt, aspect, subjectPath, readFile = fs.readFileSync}) => {
  const body = {model: IMAGE_MODEL, prompt, aspect_ratio: aspect, response_format: 'url', n: 1, prompt_optimizer: false};
  if (subjectPath) body.subject_reference = [{type: 'character', image_file: dataUrl(readFile(subjectPath))}];
  return body;
};

/** 打印用：把请求体里的 Data URL 换成「多少字节」，其余原样。不含密钥（密钥只在请求头里）。 */
export const redactBody = (value) => {
  if (typeof value === 'string') {
    const m = value.match(/^data:([^;,]+);base64,(.*)$/s);
    return m ? `data:${m[1]};base64,…（${Math.floor((m[2].length * 3) / 4)} 字节，略）` : value;
  }
  if (Array.isArray(value)) return value.map(redactBody);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactBody(v)]));
  return value;
};

/**
 * @param {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void>,
 *   log?: (s: string) => void, baseUrl?: string, pollMs?: number, timeoutMs?: number, maxAttempts?: number}} [opts]
 */
export const createH3Client = (opts = {}) => {
  const env = opts.env ?? process.env;
  const base = resolveBase(env, opts.baseUrl);
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const log = opts.log ?? (() => {});
  const pollMs = opts.pollMs ?? 10_000;
  const timeoutMs = opts.timeoutMs ?? 30 * 60 * 1000;
  const maxAttempts = opts.maxAttempts ?? 3;

  const key = () => {
    const k = String(env.MINIMAX_API_KEY ?? '').trim();
    if (!k) throw new H3Error('NO_KEY', '没有设置 MINIMAX_API_KEY。设好环境变量再跑。');
    return k;
  };

  const withRetry = async (label, fn) => {
    let last;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        if (!(e instanceof H3Error) || !e.retryable || attempt === maxAttempts) throw e;
        const delay = Math.min(8000, 1000 * 2 ** (attempt - 1));
        log(`${label}遇到 ${e.code}，${(delay / 1000).toFixed(1)} 秒后重试（第 ${attempt + 1}/${maxAttempts} 次）`);
        await sleep(delay);
      }
    }
    throw last;
  };

  const request = async (method, route, body, timeout) => {
    const k = key();
    let res;
    try {
      res = await fetchImpl(`${base}${route}`, {
        method,
        headers: {Authorization: `Bearer ${k}`, 'Content-Type': 'application/json'},
        body: body ? JSON.stringify(body) : undefined,
        signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(timeout) : undefined,
      });
    } catch (e) {
      throw new H3Error('NETWORK', `连不上接口：${redact(e?.message ?? e, k)}`, {retryable: true});
    }
    const raw = await res.text();
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
    const text = redact(raw, k);
    const problem = classify({status: res.status, json, text, key: k});
    if (problem) throw problem;
    return json ?? {};
  };

  const normalize = (json) => {
    const task = json?.task ?? {};
    const status = String(task.status || '').toLowerCase();
    return {
      status,
      url: task.content?.url ?? null,
      duration: task.duration ?? null,
      outputSeconds: task.usage?.output_seconds ?? task.duration ?? null,
      inputImageCount: task.usage?.input_image_count ?? null,
      elapsedSec: Number.isFinite(task.updated_at) && Number.isFinite(task.created_at) ? task.updated_at - task.created_at : null,
      error: task.error ?? null,
    };
  };

  return {
    base,
    pollMs,
    timeoutMs,
    /**
     * 提交一段。不重试。成功返回 task id 字符串。
     * refs 是这一段自己的参考图路径（v2 按 look 选风格，每段可以不同）；
     * promptExpansion 来自风格包（disabled / balanced / quality），不传就不写 extra。
     * styleId 只用来让缺图的报错说清是哪个风格。
     */
    async submit({prompt, refs, resolution, duration, ratio, promptExpansion = null, styleId = ''}) {
      key();
      const body = buildVideoBody({prompt, refs, resolution, duration, ratio, promptExpansion, styleId});
      let json;
      try {
        json = await request('POST', '/v2/video_generation', body, 180_000);
      } catch (e) {
        if (e instanceof H3Error && e.code === 'NETWORK') {
          throw new H3Error('SUBMIT_UNKNOWN', `提交没有得到明确结果（${e.message}）。不重提。`);
        }
        if (e instanceof H3Error && e.retryable) {
          throw new H3Error(e.code, `${e.message}。提交不重试。`, {http: e.http, apiCode: e.apiCode, retryable: false});
        }
        throw e;
      }
      const taskId = json?.task_id;
      if (!taskId) throw new H3Error('API', '提交没有返回 task id。不重提。');
      return String(taskId);
    },
    /** 查一次。429 / 5xx 退避，最多 3 次。 */
    async query(taskId) {
      const json = await withRetry('查询', () => request('GET', `/v2/query/video_generation/${encodeURIComponent(taskId)}`, null, 60_000));
      return normalize(json);
    },
    /** 10 秒一轮，从 submittedAt 起算，单段最多 timeoutMs。 */
    async poll(taskId, submittedAt) {
      const start = Date.parse(submittedAt) || Date.now();
      for (;;) {
        const task = await this.query(taskId);
        if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled') return task;
        if (Date.now() - start > timeoutMs) return {...task, status: 'timeout'};
        log(`任务 ${taskId} 状态 ${task.status || '排队'}，继续等`);
        await sleep(pollMs);
      }
    },
    /**
     * 下载到 dest。限时链接失败就重新查询拿新链接，不重新生成。
     * 已有 url 时先下那个；429 / 5xx 对同一次下载退避。
     */
    async download(taskId, dest, url) {
      const once = async (fileUrl) => {
        const k = String(env.MINIMAX_API_KEY ?? '');
        let res;
        try {
          res = await fetchImpl(fileUrl, {
            method: 'GET',
            signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(300_000) : undefined,
          });
        } catch (e) {
          throw new H3Error('DOWNLOAD', `下载失败：${redact(e?.message ?? e, k)}`, {retryable: true});
        }
        if (!res.ok) {
          const retryable = res.status === 429 || res.status >= 500;
          throw new H3Error('DOWNLOAD', `下载失败 HTTP ${res.status}`, {http: res.status, retryable});
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length) throw new H3Error('DOWNLOAD', '下载到空文件');
        fs.mkdirSync(path.dirname(dest), {recursive: true});
        fs.writeFileSync(dest, buf);
        return buf.length;
      };
      if (url) {
        try {
          return await withRetry('下载', () => once(url));
        } catch (e) {
          log(`下载失败（${e.message}），重新查询拿新链接，不重新生成。`);
        }
      }
      const task = await this.query(taskId);
      if (task.status !== 'succeeded' || !task.url) {
        throw new H3Error('DOWNLOAD', '重新查询没有拿到新的下载链接。不重新生成。');
      }
      return withRetry('下载', () => once(task.url));
    },
    /**
     * image-01，同步返回图片 URL。不重试。
     * subjectPath 有值时带主体参考（官方 subject_reference，type=character，Data URL）。
     */
    async image({prompt, aspect, subjectPath}) {
      const body = buildImageBody({prompt, aspect, subjectPath});
      let json;
      try {
        json = await request('POST', '/v1/image_generation', body, 120_000);
      } catch (e) {
        if (e instanceof H3Error && e.retryable) {
          throw new H3Error(e.code, `${e.message}。参考图提交不重试。`, {http: e.http, apiCode: e.apiCode, retryable: false});
        }
        throw e;
      }
      const url = json?.data?.image_urls?.[0];
      if (!url) throw new H3Error('API', '参考图接口没有返回图片地址');
      return url;
    },
    /** 下载图片字节。不带鉴权头。 */
    async downloadBytes(url) {
      const k = String(env.MINIMAX_API_KEY ?? '');
      let res;
      try {
        res = await fetchImpl(url, {method: 'GET', signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(120_000) : undefined});
      } catch (e) {
        throw new H3Error('DOWNLOAD', `下载参考图失败：${redact(e?.message ?? e, k)}`);
      }
      if (!res.ok) throw new H3Error('DOWNLOAD', `下载参考图失败 HTTP ${res.status}`, {http: res.status});
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new H3Error('DOWNLOAD', '参考图是空文件');
      return buf;
    },
  };
};
