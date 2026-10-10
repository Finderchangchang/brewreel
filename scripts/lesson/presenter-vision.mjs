// 照片 → Open Peeps look。只挑清单里的部件，动画仍走现有嘴、眨眼、手势和镜像。
// 密钥只从环境变量读，不写进文件、不进日志。key 和地址成对：MiniMax 的 key 只发到 MiniMax，VISION 的 key 只发到 VISION_BASE_URL。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OUTFIT_NAMES, PRESETS} from '../../template/src/lesson/mascot/cast.mjs';

const PEEP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../template/src/vendor/react-peeps/peeps');

export const LIKENESS_LIMIT = '生成的是 Open Peeps 部件组合，只对齐发型、眼镜、胡子和衣服气质，不是照片级相似。肤色会记下来，这一版画面上不生效。';
export const VISION_TIMEOUT_MS = 120_000;
export const MINIMAX_VISION_BASE = 'https://api.minimaxi.com/v1';
export const MINIMAX_VISION_MODEL = 'MiniMax-M3';
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_SKIN = '#E0B090';

const SKIN_SWATCHES = [
  {hex: '#F6D7C3', keys: ['fair', 'pale', 'light', '白', '浅', '白皙']},
  {hex: '#E8C4A8', keys: ['peach', 'beige', '小麦浅']},
  {hex: '#E0B090', keys: ['medium', 'tan', 'natural', '自然', '小麦']},
  {hex: '#C68642', keys: ['olive', 'brown', '棕']},
  {hex: '#8D5524', keys: ['dark', '深', '深色']},
  {hex: '#3C2415', keys: ['deep', '黑', 'verydark']},
];

function peepOptionNames(file, exportName) {
  const text = fs.readFileSync(path.join(PEEP_DIR, file), 'utf8');
  const match = text.match(new RegExp(`exports\\.${exportName} = \\{([\\s\\S]*?)\\n\\};`));
  if (!match) throw new Error(`读不到 Open Peeps 选项 ${exportName}`);
  const names = [...match[1].matchAll(/^\s+(\w+):/gm)].map((item) => item[1]);
  if (!names.length) throw new Error(`Open Peeps 选项 ${exportName} 是空的`);
  return names;
}

export const HAIR_NAMES = peepOptionNames('hair/z_options.js', 'Hair');
export const ACCESSORY_NAMES = peepOptionNames('accessories/z_options.js', 'Accessories');
export const FACIAL_HAIR_NAMES = peepOptionNames('facialHair/z_options.js', 'FacialHair');

const norm = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s_\-./]+/gu, '');

function aliasMap(groups) {
  const map = new Map();
  for (const [canonical, words] of Object.entries(groups)) {
    for (const word of words) map.set(norm(word), canonical);
  }
  return map;
}

const PRESET_ALIASES = aliasMap({
  male: ['male', 'm', 'man', 'boy', 'guy', '男', '男性', '男生', '先生', 'peep-mentor', 'mentor'],
  female: ['female', 'f', 'woman', 'girl', 'lady', '女', '女性', '女生', '女士', 'peep-counsel', 'counsel'],
});
const HAIR_ALIASES = aliasMap({
  Bald: ['光头', '秃'],
  Short: ['短发'],
  Bun: ['丸子', '丸子头'],
  BunCurly: ['卷发丸子'],
  Afro: ['爆炸头'],
  Mohawk: ['莫霍克'],
  Long: ['长发'],
  LongBangs: ['长刘海'],
  Bangs: ['刘海'],
  MediumBangs: ['中长刘海'],
  Hijab: ['头巾'],
  Beanie: ['毛线帽'],
});
const ACCESSORY_ALIASES = aliasMap({
  None: ['none', '无', '没有', '没戴', '无眼镜', 'no'],
  GlassRound: ['glasses', 'glass', '眼镜', '圆框', '圆框眼镜'],
  GlassRoundThick: ['厚圆镜', '厚框'],
  GlassAviator: ['aviator', '飞行员', '飞行员镜'],
  SunglassWayfarer: ['sunglasses', '墨镜', 'rayban', 'raybans'],
  Eyepatch: ['眼罩'],
});
const FACIAL_ALIASES = aliasMap({
  None: ['none', '无', '没有', '没胡子', 'cleanshaven', 'clean'],
  Goatee: ['山羊胡'],
  Handlebars: ['handlebar', '八字胡'],
  MoustacheThin: ['moustache', 'mustache', '小胡子'],
  Full: ['beard', 'beardz', '络腮', '大胡子'],
  Chin: ['下巴胡'],
  GrayFull: ['花白胡子'],
});
const OUTFIT_ALIASES = aliasMap({
  darkSweater: ['darksweater', 'sweater', '毛衣', '深色毛衣', '针织'],
  blackTee: ['blacktee', 'tee', 'tshirt', 't恤', '黑t'],
  whiteShirt: ['whiteshirt', 'shirt', '衬衫', '白衬衫', '西装', '正装', 'tuxedo', 'blazer'],
});

function levenshtein(a, b) {
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = next[j];
  }
  return prev[b.length];
}

function nearestName(key, names) {
  let best = names[0];
  let bestDist = Infinity;
  for (const name of names) {
    const dist = levenshtein(key, norm(name));
    if (dist < bestDist || (dist === bestDist && name < best)) {
      best = name;
      bestDist = dist;
    }
  }
  return best;
}

function pickFromList(value, names, aliases, fallback, field, notes) {
  if (value == null || String(value).trim() === '') {
    notes.push(`模型没有给出 ${field}，改用 ${fallback}`);
    return fallback;
  }
  const raw = String(value).trim();
  if (names.includes(raw)) return raw;
  const key = norm(raw);
  const byNorm = new Map(names.map((name) => [norm(name), name]));
  if (byNorm.has(key)) {
    const next = byNorm.get(key);
    notes.push(`纠正 ${field}：模型给了「${raw}」，改用清单里的 ${next}`);
    return next;
  }
  if (aliases.has(key)) {
    const next = aliases.get(key);
    notes.push(`纠正 ${field}：模型给了「${raw}」，不在清单里，改用最接近的 ${next}`);
    return next;
  }
  let aliasHit = null;
  for (const [alias, canonical] of aliases) {
    if (alias.length >= 4 && key.startsWith(alias) && (!aliasHit || alias.length > aliasHit[0].length)) aliasHit = [alias, canonical];
  }
  if (aliasHit && names.includes(aliasHit[1])) {
    notes.push(`纠正 ${field}：模型给了「${raw}」，不在清单里，改用最接近的 ${aliasHit[1]}`);
    return aliasHit[1];
  }
  let contained = null;
  for (const name of names) {
    const token = norm(name);
    if (token.length >= 4 && key.includes(token) && (!contained || token.length > norm(contained).length)) contained = name;
  }
  if (contained) {
    notes.push(`纠正 ${field}：模型给了「${raw}」，不在清单里，改用最接近的 ${contained}`);
    return contained;
  }
  const next = nearestName(key, names);
  notes.push(`纠正 ${field}：模型给了「${raw}」，不在清单里，改用最接近的 ${next}`);
  return next;
}

function normalizeHex(value) {
  const text = String(value ?? '').trim();
  const short = /^#([0-9a-f]{3})$/i.exec(text);
  if (short) return `#${short[1].split('').map((ch) => ch + ch).join('')}`.toUpperCase();
  const long = /^#([0-9a-f]{6})$/i.exec(text);
  if (long) return `#${long[1].toUpperCase()}`;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(text);
  if (!rgb) return null;
  const nums = rgb.slice(1, 4).map(Number);
  if (nums.some((n) => n > 255)) return null;
  return `#${nums.map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function coerceSkin(value, notes) {
  if (value == null || String(value).trim() === '') {
    notes.push(`模型没有给出 skin，改用大致肤色 ${DEFAULT_SKIN}`);
    return DEFAULT_SKIN;
  }
  const hex = normalizeHex(value);
  if (hex) return hex;
  const key = norm(value);
  const swatch = SKIN_SWATCHES.find((item) => item.keys.some((name) => norm(name) === key || (norm(name).length >= 2 && key.includes(norm(name)))));
  const next = swatch?.hex ?? DEFAULT_SKIN;
  notes.push(`纠正 skin：模型给了「${String(value).trim()}」，不是 #RRGGBB，改用最接近的 ${next}`);
  return next;
}

/** 把模型返回收成一份能放进 meta.presenter.look 的配置。不在清单里的换成最接近的合法值。 */
export function coerceLook(raw) {
  const notes = [];
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const preset = pickFromList(source.preset, ['male', 'female'], PRESET_ALIASES, 'male', 'preset', notes);
  const base = PRESETS[preset] || PRESETS.male;
  const hair = pickFromList(source.hair, HAIR_NAMES, HAIR_ALIASES, base.hair, 'hair', notes);
  const accessory = pickFromList(source.accessory, ACCESSORY_NAMES, ACCESSORY_ALIASES, base.accessory, 'accessory', notes);
  const facialHair = pickFromList(source.facialHair, FACIAL_HAIR_NAMES, FACIAL_ALIASES, base.facialHair, 'facialHair', notes);
  const outfit = pickFromList(source.outfit, OUTFIT_NAMES, OUTFIT_ALIASES, base.outfit, 'outfit', notes);
  const skin = coerceSkin(source.skin, notes);
  return {look: {preset, hair, accessory, facialHair, outfit, skin}, notes};
}

export function buildPrompt() {
  return [
    '你是讲解员造型助手。看照片，从清单里各选一个最接近的值。只返回一个 JSON 对象，不要 Markdown。',
    LIKENESS_LIMIT,
    '不要描述脸型、五官或年龄。拿不准性别时 preset 用 male。没戴眼镜 accessory 用 None。没有胡子 facialHair 用 None。',
    'outfit 只能是 darkSweater（深色毛衣）、blackTee（黑 T）、whiteShirt（白衬衫）之一，选着装气质最接近的一套。',
    'JSON 字段：preset, hair, accessory, facialHair, outfit, skin。',
    `preset 只能是 male 或 female。`,
    `hair 只能是：${HAIR_NAMES.join(', ')}`,
    `accessory 只能是：${ACCESSORY_NAMES.join(', ')}`,
    `facialHair 只能是：${FACIAL_HAIR_NAMES.join(', ')}`,
    'outfit 只能是：darkSweater, blackTee, whiteShirt',
  ].join('\n');
}

export function messageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('\n');
  return '';
}

export function parseModelJson(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.choices) {
      const message = raw.choices?.[0]?.message ?? {};
      return parseModelJson(messageText(message.content) || messageText(message.reasoning_content));
    }
    return raw;
  }
  let text = messageText(raw).trim().replace(/<think>[\s\S]*?<\/think>/giu, '').trim();
  text = text.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '');
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error('模型没有返回合法 JSON');
  }
}

export function redact(value, keys) {
  let out = String(value ?? '');
  const list = (Array.isArray(keys) ? keys : [keys]).map((item) => String(item ?? '').trim()).filter((item) => item.length >= 4);
  for (const key of list) out = out.split(key).join('***');
  return out.replace(/Bearer\s+\S+/giu, 'Bearer ***');
}

export function isMinimaxHost(hostname) {
  const host = String(hostname ?? '').toLowerCase();
  return host === 'api.minimaxi.com' || host === 'api.minimax.cn' || host === 'api.minimax.io'
    || host.endsWith('.minimaxi.com') || host.endsWith('.minimax.cn') || host.endsWith('.minimax.io');
}

function assertVisionUrl(base) {
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new Error('接口地址不是合法 URL。必须是 https，或本机 http://127.0.0.1 / http://localhost');
  }
  const local = url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (url.protocol !== 'https:' && !local) throw new Error('接口地址必须是 https。只有本机代理可以用 http://127.0.0.1 或 http://localhost');
  return url;
}

/**
 * 没设 VISION_* 时用 MINIMAX_API_KEY + https://api.minimaxi.com/v1 + MiniMax-M3。
 * 设了 VISION_API_KEY 和 VISION_BASE_URL 就用这一对。--base-url 指向 MiniMax 域名时仍用 MINIMAX_API_KEY。
 */
export function resolveVisionEndpoint({env = process.env, baseArg, modelArg, timeoutMs = VISION_TIMEOUT_MS} = {}) {
  const visionKey = String(env.VISION_API_KEY ?? '').trim();
  const visionBase = String(env.VISION_BASE_URL ?? '').trim().replace(/\/+$/u, '');
  const minimaxKey = String(env.MINIMAX_API_KEY ?? '').trim();
  const requested = String(baseArg ?? '').trim().replace(/\/+$/u, '');
  const finish = (apiKey, base, pair, url) => ({
    apiKey,
    base,
    model: String(modelArg || MINIMAX_VISION_MODEL).trim() || MINIMAX_VISION_MODEL,
    timeoutMs,
    pair,
    host: url.hostname,
  });
  if (requested) {
    const url = assertVisionUrl(requested);
    if (isMinimaxHost(url.hostname)) {
      if (!minimaxKey) throw new Error('MiniMax 地址需要 MINIMAX_API_KEY，不能改用 VISION_API_KEY');
      return finish(minimaxKey, requested, 'MINIMAX_API_KEY', url);
    }
    if (!visionKey) throw new Error('自定义接口地址只能和 VISION_API_KEY 成对使用，不能把 MINIMAX_API_KEY 发到其他地址');
    return finish(visionKey, requested, 'VISION_API_KEY', url);
  }
  if ((visionKey && !visionBase) || (!visionKey && visionBase)) {
    throw new Error('VISION_API_KEY 和 VISION_BASE_URL 必须成对设置。只设其中一个时，不会把这把 key 发到另一家地址');
  }
  if (visionKey && visionBase) {
    const url = assertVisionUrl(visionBase);
    return finish(visionKey, visionBase, 'VISION_API_KEY', url);
  }
  if (!minimaxKey) throw new Error('未找到成对的密钥和接口地址。默认用 MINIMAX_API_KEY 调用 MiniMax；或同时设置 VISION_API_KEY 与 VISION_BASE_URL');
  return finish(minimaxKey, MINIMAX_VISION_BASE, 'MINIMAX_API_KEY', assertVisionUrl(MINIMAX_VISION_BASE));
}

export function sniffImage(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function readPhoto(file) {
  if (/^[a-z][a-z\d+.-]*:\/\//iu.test(file) || /^data:/iu.test(file)) throw new Error('照片必须是本地文件，不能是网络地址');
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    throw new Error(`找不到照片：${path.basename(file)}`);
  }
  if (buf.length > PHOTO_MAX_BYTES) throw new Error('照片超过 10MB，看图接口不接受');
  const mime = sniffImage(buf);
  if (!mime) throw new Error('照片必须是 JPEG、PNG、GIF 或 WEBP');
  const base64 = buf.toString('base64');
  return {mime, base64, dataUrl: `data:${mime};base64,${base64}`};
}

export function visionRequestBody(endpoint) {
  const body = {
    model: endpoint.model,
    temperature: 0,
    messages: [
      {role: 'system', content: buildPrompt()},
      {role: 'user', content: [
        {type: 'text', text: '请只根据这张照片返回 JSON。'},
        {type: 'image_url', image_url: {url: 'data:image/png;base64,REPLACE'}},
      ]},
    ],
  };
  if (isMinimaxHost(endpoint.host)) {
    body.max_completion_tokens = 800;
    if (endpoint.model === MINIMAX_VISION_MODEL) body.thinking = {type: 'disabled'};
  }
  return body;
}

export async function callVision({endpoint, dataUrl, fetchImpl = globalThis.fetch}) {
  const body = visionRequestBody(endpoint);
  body.messages[1].content[1].image_url.url = dataUrl;
  const keys = [endpoint.apiKey];
  let response;
  try {
    response = await fetchImpl(`${endpoint.base}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(endpoint.timeoutMs),
      headers: {'content-type': 'application/json', authorization: `Bearer ${endpoint.apiKey}`},
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`看图请求失败：${redact(error?.message ?? error, keys)}`);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`看图请求失败：HTTP ${response.status} ${redact(text, keys).slice(0, 300)}`);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('看图接口没有返回 JSON');
  }
  return parseModelJson(payload);
}
