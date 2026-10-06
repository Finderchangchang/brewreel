// 看图打分。MiniMax 对话接口（OpenAI 兼容）看一张图，按固定检查表吐 JSON。
// 脚本自己判 pass / fail / unsure，不信模型的总评。缺字段不是硬伤。
// 密钥只从 MINIMAX_API_KEY 读，不写盘、不进日志。
//   POST <base>/v1/chat/completions
//   Authorization: Bearer $MINIMAX_API_KEY
//   图片用 data:image/jpeg;base64,...（单张 ≤10MB）
// base 默认 https://api.minimaxi.com，MINIMAX_BASE_URL 可改（只收 https，localhost 给测试）。
// 模型默认 MiniMax-M3，BREWREEL_VISION_MODEL 可改。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractJson, redact} from './llm-client.mjs';
import {ffmpeg} from './media.mjs';
import {isSubscriptionKey} from './prices.mjs';
import {redactBody, resolveBase} from './providers/minimax-h3.mjs';

export const VISION_MODEL_DEFAULT = 'MiniMax-M3';
/** 连通性试探失败时按这个顺序换。文档里还出现过 MiniMax-M3.1-Flash-Preview。 */
export const VISION_MODEL_CANDIDATES = ['MiniMax-M3', 'MiniMax-M3.1-Flash-Preview', 'MiniMax-M2.5', 'MiniMax-M2'];
export const JUDGE_KINDS = ['character', 'material', 'frame'];
const JPEG_LIMIT = 8 * 1024 * 1024;

export const visionModelOf = (env = process.env) => String(env.BREWREEL_VISION_MODEL || VISION_MODEL_DEFAULT).trim() || VISION_MODEL_DEFAULT;

/** judge 和风格工厂共用的 IP 名单。文件里的 groups.ip 是同一份的落盘。 */
export const IP_GROUP = ['乐高', 'LEGO', 'Lego', 'lego', 'Minecraft', '我的世界', '吉卜力', 'Ghibli', '宫崎骏', '皮克斯', 'Pixar', '迪士尼', 'Disney', 'Aardman', '阿德曼', '小羊肖恩', 'Shaun', '纪念碑谷', 'Monument Valley'];

/** 看图用的 IP 名单。优先读 broll/banned-words.json 的 groups.ip，读不到再用上面这份。 */
export const ipWordsOf = () => {
  try {
    const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'broll', 'banned-words.json');
    const group = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))?.groups?.ip;
    if (Array.isArray(group) && group.length) return group.map(String);
  } catch {
    /* 用内置名单 */
  }
  return [...IP_GROUP];
};

const asBool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const asNum = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};

/** 检查表里的一项。模型有时把布尔值直接放在键上，有时包成 {value, reason}。 */
export const judgeItem = (raw, key) => {
  const v = raw?.[key];
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') return {value: v, reason: ''};
  return null;
};

const reasonOf = (item, fallback) => {
  const text = [item?.seen, item?.like, item?.reason].filter((s) => typeof s === 'string' && s.trim()).join('；');
  return text || fallback;
};

const boolAnswered = (item) => {
  if (!item || typeof item !== 'object') return false;
  const v = item.value;
  return v === true || v === false || v === 'true' || v === 'false' || v === 1 || v === 0 || v === '1' || v === '0';
};

const countAnswered = (item) => !!item && asNum(item.value) != null;

/** 必填项。按 kind 分开。没答的要补问；补问后仍缺是 unsure，不是硬伤。软分项不在这里。 */
export const REQUIRED_FIELDS = {
  character: ['text', 'studs', 'ip', 'mouth', 'antenna', 'characters'],
  material: ['text', 'studs', 'ip', 'characters', 'objects'],
  frame: ['text', 'studs', 'ip', 'sameCharacter'],
};

const answeredOf = Object.assign(Object.create(null), {
  text: boolAnswered,
  studs: boolAnswered,
  ip: boolAnswered,
  mouth: boolAnswered,
  antenna: boolAnswered,
  sameCharacter: boolAnswered,
  characters: countAnswered,
  objects: countAnswered,
});

/** 这一 kind 还没回答的必填项，顺序固定。 */
export const missingRequired = (kind, raw) => (REQUIRED_FIELDS[kind] || []).filter((key) => !answeredOf[key](judgeItem(raw, key)));

/**
 * 硬伤。只看已经回答的字段，缺字段不算。
 * kind=character：text / studs / ip / mouth / antenna / characters≠1
 * kind=material：text / studs / ip / characters>0 / objects<3（blank）
 * kind=frame：text / studs / ip / sameCharacter=false
 * @returns {{code: string, reason: string}[]}
 */
export const hardFails = (kind, raw) => {
  const fails = [];
  const text = judgeItem(raw, 'text');
  const studs = judgeItem(raw, 'studs');
  const ip = judgeItem(raw, 'ip');
  if (boolAnswered(text) && asBool(text.value)) fails.push({code: 'text', reason: reasonOf(text, '画面里有字')});
  if (boolAnswered(studs) && asBool(studs.value)) fails.push({code: 'studs', reason: reasonOf(studs, '画面里有圆形凸点')});
  if (boolAnswered(ip) && asBool(ip.value)) fails.push({code: 'ip', reason: reasonOf(ip, '画面像某个知名作品')});
  const characters = judgeItem(raw, 'characters');
  const count = countAnswered(characters) ? asNum(characters.value) : null;
  if (kind === 'character') {
    const mouth = judgeItem(raw, 'mouth');
    const antenna = judgeItem(raw, 'antenna');
    if (boolAnswered(mouth) && asBool(mouth.value)) fails.push({code: 'mouth', reason: reasonOf(mouth, '脸上有嘴')});
    if (boolAnswered(antenna) && asBool(antenna.value)) fails.push({code: 'antenna', reason: reasonOf(antenna, '头顶有凸起')});
    if (count != null && count !== 1) fails.push({code: 'characters', reason: reasonOf(characters, `角色数是 ${count}，角色图要正好 1 个`)});
  } else if (kind === 'material') {
    if (count != null && count > 0) fails.push({code: 'characters', reason: reasonOf(characters, `材质图里不该有角色，现在是 ${count}`)});
    const objectsItem = judgeItem(raw, 'objects');
    const objects = countAnswered(objectsItem) ? asNum(objectsItem.value) : null;
    if (objects != null && objects < 3) fails.push({code: 'blank', reason: reasonOf(objectsItem, `可辨认物件 ${objects} 个，少于 3 个算几乎空白`)});
  } else if (kind === 'frame') {
    const same = judgeItem(raw, 'sameCharacter');
    if (boolAnswered(same) && (same.value === false || same.value === 'false' || same.value === 0 || same.value === '0')) {
      fails.push({code: 'sameCharacter', reason: reasonOf(same, '和共用机器人不一致')});
    }
  }
  return fails;
};

/** pass：必填齐且无硬伤。fail：已答字段里有硬伤。unsure：必填仍缺。硬伤优先于 unsure。 */
export const verdictOf = (kind, raw) => {
  if (hardFails(kind, raw).length) return 'fail';
  if (missingRequired(kind, raw).length) return 'unsure';
  return 'pass';
};

const score5 = (raw, key) => {
  const n = asNum(judgeItem(raw, key)?.value);
  if (n == null) return 0;
  return Math.max(0, Math.min(5, n));
};

/** 软分。只加已经回答的项：缺的不加分，也不另扣。pass 之间比；没有 pass 时 unsure 之间比。 */
export const softScore = (kind, raw) => {
  let s = score5(raw, 'clarity') + score5(raw, 'composition') + score5(raw, 'shape');
  if (kind === 'character' || kind === 'frame') {
    for (const key of ['roundHead', 'glowEyes', 'ballHands', 'chestPanel']) {
      if (asBool(judgeItem(raw, key)?.value)) s += 1;
    }
    const colors = judgeItem(raw, 'colors');
    if (colors && asBool(colors.body)) s += 1;
    if (colors && asBool(colors.eyes)) s += 1;
  }
  return Math.round(s * 100) / 100;
};

/** 每项一句理由，写进报告。 */
export const reasonLines = (raw) => {
  if (!raw || typeof raw !== 'object') return [];
  const lines = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const bit = [value.seen, value.like, value.reason].filter((s) => typeof s === 'string' && s.trim()).join('；');
    if (bit) lines.push(`${key}：${bit}`);
  }
  return lines;
};

const RULES = `你是画面质检员。只输出一个 JSON 对象，不要 markdown，不要总评。脚本会自己判过不过。
每一项都要有 reason（一句人话，说你看见了什么）。布尔题先在 seen 里描述，再给 value。

口径（照这个，不要自己放宽，也不要自己加严）：
- text.value：画面里只要有字母、数字、汉字、商标、水印、字幕、角标，就是 true。什么字都没有才是 false。
- studs：先在 seen 里描述方块或砖的顶面。studs.value 只在「和砖是一体的、顶面上一排排小圆柱凸点」时为 true。单独放着的圆球、圆柱积木、拱门、木纹、纸纹、颜料点、阴影圆斑都不是凸点，value 为 false。侧面的耳朵也不是凸点。
- ip.value：只有明显像这些才 true，并在 like 里写像谁：乐高（人仔或顶面圆凸点砖）、Minecraft（像素方块世界）、吉卜力、皮克斯、迪士尼、Aardman 或小羊肖恩、纪念碑谷。普通木头机器人、黏土机器人、纸艺机器人、平整的木头积木，不要因为「机器人加方块」就判成乐高。不像就 false，like 写空字符串。reason 和 like 里出现这些名字不作数，不要写「没有乐高、吉卜力」这种否定名单。
- characters.value：数得清的角色个数（有头有身体的机器人、动物、人）。积木、杯子、线条、污渍不是角色。
- antenna：先在 seen 里只描述头顶正中有什么。头顶是光滑圆顶、或和头差不多宽的一整块圆纸，value 为 false。只有明显比头窄的小零件（小圆钮、短杆、螺栓、天线、球顶在细杆上）才是 true。头两侧的耳朵、耳状圆片、侧边的小圆柱，不算天线。
- mouth：先在 seen 里描述两只眼睛下面的脸。一条短弧线、缝、点状嘴、三角鼻子加一条嘴，都是 true。只有眼睛、脸的下半部分是一整块光滑的，才是 false。黏土上的小坑、指纹、污点不是嘴。
- roundHead / glowEyes / ballHands / chestPanel：符合就 true，不符合就 false。这几项只是软分，照实说。
- colors.body：主体是不是接近浅蓝灰 #9FB1BC。灰蓝、木色上的灰蓝漆也算 true。完全是别的主色才 false。
- colors.eyes：眼睛是不是接近暖橙 #FFB04A。
- objects：必须带 names 数组，没写 names 算没回答。names 里每一种看得清的东西写一个名字，value 等于名字个数。房子、太阳、月亮、山丘、波浪层、地面、桌子、杯子、盒子、灯、植物、拱门、方块、圆柱都要列入。剪出来的一层山、一块波浪纸，各算一件。同一种方块不要按块数拆开。名字不要写成线条、轮廓、水渍、污点、污渍、纸纹。你说「没有」的东西不要写进 names。叫得出名字的不满 3 种，names 就少于 3 个，value 必须小于 3。几乎空白时 names 写空数组。
- sameCharacter：圆头、头顶光滑、暖橙眼睛、圆球手、没有嘴，就是同一只共用机器人，value 为 true。头两侧有耳朵不影响。人仔、方头带嘴、C 形手、头顶有小天线，value 为 false。这一帧看不清角色、但没有明显变成别的角色，value 为 true。
- clarity / composition / shape：1 到 5 的整数，5 最好。shape 是形状和色号符合度。`;

const FIELDS = {
  character: ['text', 'studs', 'ip', 'characters', 'antenna', 'mouth', 'roundHead', 'glowEyes', 'ballHands', 'chestPanel', 'colors', 'clarity', 'composition', 'shape'],
  material: ['text', 'studs', 'ip', 'characters', 'objects', 'clarity', 'composition', 'shape'],
  frame: ['text', 'studs', 'ip', 'sameCharacter', 'clarity', 'composition', 'shape'],
};

const blob = (item) => [item?.seen, item?.like, item?.reason].filter((s) => typeof s === 'string' && s.trim()).join('；');

/**
 * 否定只看硬伤词前面：否定词结束到硬伤词之间不超过 6 个字。
 * 「不是很明显」这种程度说法不算否定。整句里后半段的「没有」不算。
 */
const NEG_RE = /没有|不像|看不出|看不到|看不见|不具备|不属于|不符合|不带|谈不上|未见|未有|并不|并非|不算|不含|不是|也非|没|无|非(?!常|洲|凡)|unlike|nothing like|not like|不同于|区别于|而不是|\bnot\b|\bno\b|\bwithout\b/i;

const negatedBefore = (text, index) => {
  const from = Math.max(0, index - 24);
  const slice = text.slice(from, index);
  const re = new RegExp(NEG_RE.source, 'gi');
  let m;
  while ((m = re.exec(slice))) {
    const gap = index - (from + m.index + m[0].length);
    if (gap < 0 || gap > 6) continue;
    const tail = text.slice(from + m.index, from + m.index + m[0].length + 4);
    if (/^(?:不是很|不是特别|不是太|不太|不怎么)/.test(tail)) continue;
    return true;
  }
  return false;
};

const findAffirmed = (text, re) => {
  const s = String(text ?? '');
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  let m;
  while ((m = copy.exec(s))) {
    const at = m[1] != null ? m.index + m[0].lastIndexOf(m[1]) : m.index;
    if (!negatedBefore(s, at)) return true;
    if (copy.lastIndex === m.index) copy.lastIndex += 1;
  }
  return false;
};

const affirmedWord = (text, word) => {
  const s = String(text ?? '');
  if (/^[\x00-\x7F]+$/.test(word)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return findAffirmed(s, new RegExp(`(?:^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, 'i'));
  }
  return findAffirmed(s, new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'));
};

const HARD_TEXT = /文字|字母|汉字|水印|字幕|角标|字样|商标|watermark|letter|数字|logo|标志|签名|单词|文本|品牌/i;
const HARD_STUDS = /凸点|颗粒|圆粒|小圆柱|小圆点|圆形凸起|\bstuds?\b/i;
const HARD_MOUTH = /嘴|缝|横线|小口|很小的口|弧线|微笑|开口|小圆点|\bmouth\b|\bsmile\b/i;
const HARD_ANTENNA = /天线|细杆|短杆|杆顶|小圆钮|螺栓|旋钮|凸起|小球|小杆|小圆球|小圆钉|触角|小圆片|antenna|\bknob\b|\bpole\b|ball on a stick/i;

/** 名字整个就是线条、轮廓、水渍、污点，或东西、物体、纸、白纸这类泛名，才不当物件。带「杯子」的不因里面有「线条」被丢掉。同名只算一件。 */
const NON_OBJECT_NAME = /^(?:线条|轮廓|水渍|污点|污渍|纸纹|空白|色块|纹理|一条线|一根线|线|裂纹|噪点|铅笔线|东西|物体|形状|图案|元素|纸|白纸|纸张|一张纸|白纸张|纸面|空白纸|stain|stains|line|lines|outline|contour|scratch|noise|object|item|shape|paper)$/i;

export const realObjectNames = (names) => {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(names) ? names : []) {
    const name = String(raw).trim();
    if (!name || NON_OBJECT_NAME.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
};

const HARD_BY_KEY = {text: HARD_TEXT, studs: HARD_STUDS, mouth: HARD_MOUTH, antenna: HARD_ANTENNA};

/**
 * 第一轮描述里，没被否定窗盖住的硬伤词。
 * 只决定第二意见多问哪几项，不拿掉布尔值，也不直接判 unsure。
 */
export const suspectedKeys = (kind, raw) => {
  const keys = ['text', 'studs', ...(kind === 'character' ? ['mouth', 'antenna'] : [])];
  const hit = [];
  for (const key of keys) {
    const item = judgeItem(raw, key);
    if (item && findAffirmed(blob(item), HARD_BY_KEY[key])) hit.push(key);
  }
  return hit;
};

/**
 * 不允许把模型的 true 改成 false。描述里的硬伤词不在这里改布尔值。
 * IP 不从 reason / like 里扫品牌名。第一轮只认 ip.value。
 * 材质图的物件只数 objects.names。没给 names 就拿掉 value，让补问来要名字。
 * value 和叫得出名字的个数一边少于 3、另一边不少于 3：拿掉 value，判 unsure。这是两边对不上，不是猜意思。
 */
export const reconcileChecklist = (kind, raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw || {};
  const out = {...raw};
  if (kind === 'material') {
    const given = judgeItem(out, 'objects');
    if (given && !Array.isArray(given.names)) {
      const next = {...given};
      delete next.value;
      next.reason = `${given.reason || ''}（脚本：没有 names，要补问物件名字）`.trim();
      out.objects = next;
    } else if (given) {
      const names = given.names.map((n) => String(n));
      const real = realObjectNames(names);
      const stated = asNum(given.value);
      const conflict = stated != null && (stated < 3) !== (real.length < 3);
      const note = real.length === names.length ? '' : `（脚本：算得上物件的是 ${real.join('、') || '没有'}）`;
      if (conflict) {
        const next = {...given, names};
        delete next.value;
        next.reason = `${given.reason || ''}（脚本：value 是 ${stated}，叫得出名字的有 ${real.length} 个，两边对不上，交给人看）${note}`.trim();
        out.objects = next;
      } else {
        out.objects = {...given, names, value: real.length, reason: `${given.reason || ''}${note}`.trim()};
      }
    }
  }
  return out;
};

export const judgePrompt = (kind) => `${RULES}

这张图的 kind=${kind}。
${kind === 'character' ? '这是角色参考图。要正好 1 个角色。必须回答 antenna 和 mouth：先描述头顶，再描述眼睛下面，最后给布尔值。' : ''}${kind === 'material' ? '这是材质参考图。角色数必须是 0。objects.names 要把房子、太阳、山丘、波浪层、杯子、盒子、灯这些都写上；几乎空白、只有线条和污渍，objects.value 要小于 3。' : ''}${kind === 'frame' ? '这是视频抽帧。先看有没有一排排圆凸点，再看有没有字，再看角色是不是那只圆头圆球手的机器人。' : ''}
必须包含这些键：${FIELDS[kind].join('、')}。
每项的形状是 {"value": ..., "reason": "..."}。antenna 和 mouth 再加 "seen"。studs 再加 "seen"。ip 再加 "like"。objects 再加 "names"（字符串数组）。colors 的形状是 {"body": true, "eyes": true, "reason": "..."}。`;

/** 补问只点名缺的必填项。已经答过的由合并逻辑留下，不靠模型自己记得。 */
export const followupPrompt = (kind, missing) => `${judgePrompt(kind)}

上次没回答这几项：${missing.join('、')}。只补答这几项，其余不变。只输出一个 JSON 对象，键只保留这几项。`;

/** 补答合并进第一次的结果。已经答过的必填项和软分项不改。__proto__ 这类键不当成检查项。 */
export const mergeChecklist = (base, extra) => {
  const out = {...(base && typeof base === 'object' && !Array.isArray(base) ? base : {})};
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return out;
  for (const key of Object.keys(extra)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const value = extra[key];
    const check = Object.hasOwn(answeredOf, key) ? answeredOf[key] : null;
    if (typeof check === 'function') {
      if (check(judgeItem(out, key))) continue;
      out[key] = value;
      continue;
    }
    if (judgeItem(out, key)) continue;
    out[key] = value;
  }
  return out;
};

/** 把图收成 jpeg data URL。已经是不大的 jpg 就直接用；png 或太大则 ffmpeg 转。 */
export const jpegDataUrl = (file) => {
  const buf = fs.readFileSync(file);
  const jpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (jpeg && buf.length <= JPEG_LIMIT) return `data:image/jpeg;base64,${buf.toString('base64')}`;
  const dest = path.join(os.tmpdir(), `brewreel-judge-${process.pid}-${Date.now()}.jpg`);
  const conv = ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-vf', 'scale=1024:-2', '-q:v', '5', dest]);
  if (conv.status !== 0 || !fs.existsSync(dest)) {
    throw new Error(`看图之前要把 ${path.basename(file)} 转成 jpg，ffmpeg 失败了。装一个完整版 ffmpeg 再跑。`);
  }
  try {
    const out = fs.readFileSync(dest);
    if (out.length > 10 * 1024 * 1024) throw new Error(`${path.basename(file)} 转成 jpg 还有 ${out.length} 字节，超过接口的 10MB。`);
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } finally {
    fs.rmSync(dest, {force: true});
  }
};

export const buildVisionBody = ({model, prompt, dataUrl, temperature = 0}) => ({
  model,
  temperature,
  messages: [
    {
      role: 'user',
      content: [
        {type: 'text', text: prompt},
        {type: 'image_url', image_url: {url: dataUrl}},
      ],
    },
  ],
});

const contentOf = (json) => {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
  return '';
};

/**
 * 调一次看图接口。不重试（重试由 judgeImage 管）。报错文案里的密钥打码。
 * @returns {Promise<{content: string, json: object}>}
 */
export const callVision = async ({env = process.env, model, body, fetchImpl = fetch, timeoutMs = 120_000}) => {
  const key = String(env.MINIMAX_API_KEY ?? '').trim();
  if (!key) {
    const err = new Error('没有设置 MINIMAX_API_KEY。设好环境变量再跑。');
    err.exitCode = 2;
    throw err;
  }
  const base = resolveBase(env);
  let res;
  try {
    res = await fetchImpl(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json; charset=utf-8'},
      body: JSON.stringify(body),
      signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (e) {
    throw new Error(redact(`看图接口连不上：${e?.message || e}`, key));
  }
  const raw = await res.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.base_resp?.status_msg || raw.slice(0, 300);
    const err = new Error(redact(`看图接口 HTTP ${res.status}：${msg}`, key));
    err.http = res.status;
    err.body = redact(raw.slice(0, 500), key);
    throw err;
  }
  const content = contentOf(json);
  if (!content) throw new Error('看图接口返回里没有 message.content');
  return {content, json};
};

const stripThink = (text) =>
  String(text ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

/** 从 start 起切出一个括号配平的对象。配不平返回 null。 */
const sliceBalanced = (s, start) => {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < s.length; j++) {
    const c = s[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, j + 1);
    }
  }
  return null;
};

const tryParseObject = (s) => {
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    /* 换下一种切法 */
  }
  return null;
};

/** 从文本里按顺序切出已经各自闭合的对象。配不平的那一个丢掉，交给后面的补括号。 */
const collectClosedObjects = (text) => {
  const start = text.indexOf('{');
  if (start < 0) return [];
  const objs = [];
  let i = start;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i += 1;
    if (i >= text.length || text[i] === ']') break;
    if (text[i] !== '{') break;
    const piece = sliceBalanced(text, i);
    if (!piece) break;
    const parsed = tryParseObject(piece);
    if (!parsed) break;
    objs.push(parsed);
    i += piece.length;
  }
  return objs;
};

/**
 * 模型经常在 <think> 后面把检查表拆成一串 {"text":...}, {"studs":...}。
 * 每个键各自闭合的，逐个 parse 再合并。没闭合的，再按括号补齐。
 */
const repairLoose = (text) => {
  const closed = collectClosedObjects(text);
  if (closed.length >= 2) {
    const merged = {};
    for (const obj of closed) {
      for (const key of Object.keys(obj)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        merged[key] = obj[key];
      }
    }
    return JSON.stringify(merged);
  }
  const start = text.indexOf('{');
  if (start < 0) return text;
  let s = text.slice(start);
  s = s.replace(/,\s*\{\s*"/g, ',"');
  s = s.replace(/\}\s*\{\s*"/g, ',"');
  const balanced = sliceBalanced(s, 0);
  if (balanced) return balanced;
  let extra = '';
  for (let i = 0; i < 6; i++) {
    extra += '}';
    if (tryParseObject(s + extra)) return s + extra;
  }
  return s;
};

const normalizeChecklist = (raw) => {
  const out = {...raw};
  const characters = judgeItem(out, 'characters');
  if (characters && typeof characters.value === 'boolean') {
    out.characters = {...characters, value: characters.value ? 1 : 0, reason: characters.reason || (characters.value ? '模型用 true 表示有角色' : '模型用 false 表示没有角色')};
  }
  const objects = judgeItem(out, 'objects');
  if (objects) {
    const names = Array.isArray(objects.names) ? objects.names.map(String) : null;
    let n = asNum(objects.value);
    if (n == null && typeof objects.value === 'boolean') n = objects.value ? null : 0;
    if (n == null && names) n = names.length;
    if (n != null && n !== objects.value) out.objects = {...objects, value: n};
  }
  return out;
};

/** 从模型原文里取出检查表。拼不回来就带上 error，调用方再问一次。 */
export const parseChecklist = (content) => {
  const cleaned = stripThink(content);
  const candidates = [repairLoose(cleaned), extractJson(cleaned)];
  for (const candidate of candidates) {
    const parsed = tryParseObject(candidate);
    if (parsed) return {parsed: normalizeChecklist(parsed), error: null};
  }
  return {parsed: null, error: '不是 JSON 对象'};
};

/** 第一轮没有硬伤、必填也齐时再追问一次。假服务器靠这句认出这是专项追问，不是检查表。 */
export const SECOND_OPINION_MARK = '第二次独立检查';

const RESEMBLES_ASK = `resembles：这张图最像哪个已知品牌、玩具、游戏、动画或作品？只写一个名字；如果不像任何具体品牌或作品，写「无」。不要写句子，不要解释，不要写「没有乐高」这种否定名单，也不要写材质。不像就只写两个字以内的「无」。`;

const yesNo = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return 'vague';
  if (String(item.where ?? '').trim().length < 2) return 'vague';
  const answer = String(item.answer ?? '')
    .trim()
    .replace(/^[\s\u3000「『"'“]+/u, '')
    .replace(/[\s\u3000」』"'”。．.]+$/u, '');
  if (answer === '有') return 'yes';
  if (answer === '没有') return 'no';
  return 'vague';
};

const tidyResembles = (value) => String(value ?? '')
  .trim()
  .replace(/^[「『"'“]+/u, '')
  .replace(/[」』"'”]+$/u, '')
  .replace(/[。．.！!？?\s]+$/gu, '')
  .trim();

/** 第二意见的 resembles。缺字段、空字符串都算没给出可用答案。 */
export const readResembles = (parsed) => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.hasOwn(parsed, 'resembles')) return {present: false, text: ''};
  const raw = parsed.resembles;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return {present: true, text: tidyResembles(raw)};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return {present: true, text: tidyResembles(raw.name ?? raw.value ?? raw.answer ?? '')};
  return {present: true, text: ''};
};

const NONE_RESEMBLES = /^(?:无|没有|none)$/i;
const VAGUE_RESEMBLES = /^(?:不知道|看不清|不确定|说不清|不清楚|不详|无法判断|难以判断|可能|大概|好像|有点像|不太像|不似|不像|不是|一般|普通|某种|某个|没什么|没有特别|未知|其他|其它|n\/a|null|undefined|true|false|说不好|不好说|难说|无特别)$/i;

/**
 * resembles 和 groups.ip 的精确或包含匹配。
 * 英文按词边界，避免短词嵌进别的单词。中文按子串。长的名字先比。
 */
export const ipNameHit = (text, words = ipWordsOf()) => {
  const s = String(text ?? '').trim();
  if (!s) return null;
  const ordered = words.map((word) => String(word).trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const word of ordered) {
    if (s.toLowerCase() === word.toLowerCase()) return word;
    if (/^[\x00-\x7F]+$/.test(word)) {
      const re = new RegExp(`(?:^|[^A-Za-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^A-Za-z0-9])`, 'i');
      if (re.test(s)) return word;
    } else if (s.includes(word)) return word;
  }
  return null;
};

/** none：无 / none / 没有。hit：名单命中。specific：一个具体名字。其余含糊。 */
export const classifyResembles = (parsed, words = ipWordsOf()) => {
  const got = readResembles(parsed);
  if (!got.present || !got.text) return {kind: 'vague', name: ''};
  const name = got.text;
  if (NONE_RESEMBLES.test(name)) return {kind: 'none', name};
  const hit = ipNameHit(name, words);
  if (hit) return {kind: 'hit', name, hit};
  if (VAGUE_RESEMBLES.test(name) || name.length > 16 || /[，,；;、。！？?!]/.test(name) || /^(?:不像|不是|看不出|看不到|看不见|不具备|不符合|不带|没有任何|无任何|没有具体|不类似)/.test(name)) {
    return {kind: 'vague', name};
  }
  return {kind: 'specific', name};
};

const ASK = {
  head: ['{"where":"头顶是光滑圆顶，圆顶上面没有更小的零件","answer":"没有"}', '只问圆顶之上还有没有更小的零件。头自己的圆顶、半圆形的脑袋、和头差不多宽的一整块圆纸，都不是凸出，answer 写「没有」。只有明显比头窄的小零件（小圆钮、短杆、螺栓、球顶在细杆上）才答「有」。纸的折边、头两侧的耳朵也答「没有」。先在 where 里说圆顶上面还有什么。answer 只能是「有」或「没有」，不要写句子。'],
  face: ['{"where":"眼睛以下是一整块光滑的脸","answer":"没有"}', '脸上眼睛以下有没有任何线条、缝、弧、开口。先在 where 里说眼睛下面有什么。answer 只能是「有」或「没有」，不要写句子。'],
  text: ['{"where":"画面里没有字","answer":"没有"}', '画面任何位置有没有字、数字、字母、标志。先在 where 里说那个位置有什么。answer 只能是「有」或「没有」，不要写句子。'],
  studs: ['{"where":"表面平整，没有成排的小圆点或小圆柱","answer":"没有"}', '任何表面有没有成排的小圆点或小圆柱。先在 where 里说那个表面有什么。answer 只能是「有」或「没有」。单独的圆球、木纹、纸纹不算。'],
  bumps: ['{"where":"表面没有成排的圆形凸起","answer":"没有"}', '任何表面有没有成排的圆形凸起。先在 where 里说那个表面有什么。answer 只能是「有」或「没有」，不要写句子。'],
  objects: ['{"where":"桌上有杯子、盒子和灯","names":["杯子","盒子","灯"]}', '列出画面里每一件能叫出名字的物件（不算线条、轮廓、色块、水渍）。先在 where 里说看见了什么。names 必须是字符串数组，没有就写 []，不要写成一句话。'],
  same: ['{"where":"圆头、暖橙眼睛、圆球手，还是同一只","answer":"没有"}', '和共用机器人比，有没有换成另一只角色。先在 where 里写你看见的头、眼睛和手。是同一只，或看不清但没有明显换成别的，answer 写「没有」。只有头、脸或手明显变成了另一只，answer 才写「有」。'],
};

const FIXED_ASKS = {
  character: ['head', 'face', 'text'],
  material: ['objects', 'text', 'studs'],
  frame: ['text', 'bumps', 'same'],
};

const SUSPECT_ASK = {text: 'text', studs: 'studs', mouth: 'face', antenna: 'head'};

/** 这一 kind 的固定项，再加上描述里可疑、固定项还没覆盖的键。 */
export const secondOpinionAsks = (kind, suspected = []) => {
  const keys = [...(FIXED_ASKS[kind] || FIXED_ASKS.frame)];
  for (const key of suspected) {
    const ask = SUSPECT_ASK[key];
    if (ask && !keys.includes(ask)) keys.push(ask);
  }
  return keys;
};

const ASK_CODE = {
  head: 'antenna',
  face: 'mouth',
  text: 'text',
  studs: 'studs',
  bumps: 'studs',
  same: 'sameCharacter',
};

/** 只针对该 kind 的固定项，外加描述里可疑的键。二选一：先写那个位置有什么，再答有或没有。所有 kind 都问 resembles。 */
export const secondOpinionPrompt = (kind, suspected = []) => {
  const keys = secondOpinionAsks(kind, suspected);
  const marks = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];
  const example = keys.map((key) => `"${key}":${ASK[key][0]}`).join(',');
  const lines = keys.map((key, i) => `${marks[i] || `${i + 1}.`} ${key}：${ASK[key][1]}`);
  return `${SECOND_OPINION_MARK}。不要沿用上一轮的结论，只看这张图。kind=${kind}。
只输出一个 JSON 对象，不要 markdown，不要解释。
二选一的项：先在 where 里用一句话写那个位置有什么，answer 只能是「有」或「没有」这两个词。不要写否、无、false，不要加引号，不要写句子。
看不清、可能有、稍微像，answer 都写「没有」。只有清清楚楚看见才写「有」。
平滑的圆顶、半圆形的脑袋、和头差不多宽的圆纸、头两侧的耳朵、单独放着的圆球、木纹、纸纹、污渍、指纹，answer 都写「没有」。头自己的圆顶不是天线。
${RESEMBLES_ASK}
{${example},"resembles":"无"}
${lines.join('\n')}
${marks[keys.length] || `${keys.length + 1}.`} ${RESEMBLES_ASK}`;
};

/**
 * 任一项明确答「有」就是硬伤。resembles 命中 groups.ip 是 ip 硬伤。
 * 名单外的具体名字、含糊、空位置、不是合法 JSON，是 unsure。
 * 写成「无 / none / 没有」不影响。硬伤优先于 unsure。
 * 材质图的物件清单要参与判定：names 经 realObjectNames 去重、去泛名后不足 3 个是 blank。names 不是数组仍算含糊。
 * suspected 里多出来的键也要答；没答或不是有/没有，算含糊。
 */
export const judgeSecondOpinion = (kind, parsed, words = ipWordsOf(), suspected = []) => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {verdict: 'unsure', code: null, reason: '第二意见不是合法 JSON', fails: []};
  }
  const asks = secondOpinionAsks(kind, suspected).filter((key) => key !== 'objects');
  if (!FIXED_ASKS[kind]) return {verdict: 'unsure', code: null, reason: '第二意见的 kind 不对', fails: []};
  let vague = false;
  const hits = [];
  for (const key of asks) {
    const result = yesNo(parsed[key]);
    const code = ASK_CODE[key];
    if (result === 'yes') hits.push({code, reason: `第二意见：${key} 答了有（${String(parsed[key]?.where || '').slice(0, 80)}）`});
    else if (result === 'vague') vague = true;
  }
  const resemble = classifyResembles(parsed, words);
  if (resemble.kind === 'hit') hits.push({code: 'ip', reason: `第二意见：最像「${resemble.name}」，命中名单上的「${resemble.hit}」`});
  if (kind === 'material') {
    const names = parsed.objects?.names;
    if (!Array.isArray(names)) vague = true;
    else {
      const real = realObjectNames(names);
      if (real.length < 3) hits.push({code: 'blank', reason: `第二意见：叫得出名字的物件只有 ${real.length} 个（${real.join('、') || '没有'}），几乎空白`});
    }
  }
  if (hits.length) return {verdict: 'fail', code: hits[0].code, reason: hits[0].reason, fails: hits};
  if (resemble.kind === 'specific') return {verdict: 'unsure', code: null, reason: `第二意见：它说像「${resemble.name}」，不在名单里，交给人看`, fails: []};
  if (resemble.kind === 'vague' || vague) {
    const why = resemble.kind === 'vague' ? `第二意见：resembles 答得含糊（${resemble.name || '空'}）` : '第二意见答得含糊';
    return {verdict: 'unsure', code: null, reason: why, fails: []};
  }
  return {verdict: 'pass', code: null, reason: '', fails: []};
};

/**
 * 看一张图。temperature 0。
 * 不是合法 JSON：整份重试 1 次（思考过程和拆开的 JSON 仍由解析修）。
 * 必填项缺了：再补问，最多 2 次，只补缺的项，合并进第一次的结果。已有硬伤就不再补问。补问后仍缺是 unsure，不再追问。
 * 第一轮没有硬伤、必填也齐：一律做第二意见。描述里的可疑词只加进追问，不直接判 unsure。
 * 第二意见的 JSON 坏了再重试 1 次。任一项答「有」或 resembles 命中名单是 fail。含糊、重试后仍坏、名单外的名字是 unsure。全部「没有」且 resembles 是「无」才是 pass。
 * @returns {Promise<{kind: string, verdict: 'pass'|'fail'|'unsure', pass: boolean, hard: {code: string, reason: string}[], missing: string[], soft: number, reasons: string[], parsed: object, attempts: number, followups: number, secondOpinions: number, model: string}>}
 */
export const judgeImage = async ({file, kind, env = process.env, model = visionModelOf(env), fetchImpl = fetch, log = () => {}}) => {
  if (!JUDGE_KINDS.includes(kind)) throw new Error(`kind 要是 ${JUDGE_KINDS.join('、')}，现在是 ${kind}。`);
  if (!fs.existsSync(file)) throw new Error(`要打分的图不在：${file}`);
  const dataUrl = jpegDataUrl(file);
  let attempts = 0;
  let followups = 0;
  let secondOpinions = 0;
  const ask = async (prompt) => {
    attempts += 1;
    const body = buildVisionBody({model, prompt, dataUrl, temperature: 0});
    const {content} = await callVision({env, model, body, fetchImpl});
    return parseChecklist(content);
  };
  let first = await ask(judgePrompt(kind));
  if (first.error || !first.parsed) {
    const why = first.error || '不是 JSON 对象';
    log(`  看图返回不是完整 JSON（${why}），重试 1 次`);
    first = await ask(`${judgePrompt(kind)}\n\n上次的输出不能用：${why}。只输出一个 JSON 对象。`);
  }
  const suspected = first.parsed && !first.error ? suspectedKeys(kind, first.parsed) : [];
  let parsed = first.parsed && !first.error ? reconcileChecklist(kind, first.parsed) : {};
  while (followups < 2) {
    const missingNow = missingRequired(kind, parsed);
    if (!missingNow.length || hardFails(kind, parsed).length) break;
    followups += 1;
    log(`  看图缺了 ${missingNow.join('、')}，补问第 ${followups} 次`);
    const extra = await ask(followupPrompt(kind, missingNow));
    if (extra.parsed && !extra.error) parsed = reconcileChecklist(kind, mergeChecklist(parsed, extra.parsed));
  }
  let missing = missingRequired(kind, parsed);
  let hard = hardFails(kind, parsed);
  let verdict = hard.length ? 'fail' : missing.length ? 'unsure' : 'pass';
  let secondNote = '';
  if (!hard.length && !missing.length) {
    secondOpinions += 1;
    log(`  ${SECOND_OPINION_MARK}${suspected.length ? `，多问 ${suspected.join('、')}` : ''}`);
    const prompt = secondOpinionPrompt(kind, suspected);
    let extra = await ask(prompt);
    if (extra.error || !extra.parsed) {
      const why = extra.error || '不是 JSON 对象';
      log(`  第二意见不是完整 JSON（${why}），重试 1 次`);
      extra = await ask(`${prompt}\n\n上次的输出不能用：${why}。只输出一个 JSON 对象。`);
    }
    const second = judgeSecondOpinion(kind, extra.error ? null : extra.parsed, ipWordsOf(), suspected);
    secondNote = second.reason || '';
    if (second.verdict === 'fail') {
      verdict = 'fail';
      const extraFails = second.fails?.length ? second.fails : [{code: second.code, reason: second.reason}];
      hard = [...hard, ...extraFails];
    } else if (second.verdict === 'unsure') {
      verdict = 'unsure';
      missing = [...missing, 'second'];
    }
  }
  const reasons = reasonLines(parsed);
  if (verdict === 'unsure' && missing.length) reasons.unshift(`这几项模型没回答：${missing.join('、')}`);
  if (secondNote) reasons.unshift(secondNote);
  return {
    kind,
    verdict,
    pass: verdict === 'pass',
    hard,
    missing,
    soft: softScore(kind, parsed),
    reasons,
    parsed,
    attempts,
    followups,
    secondOpinions,
    model,
  };
};

/** 参考图只描述成材质 / 色调 / 光线，不把原图放进风格包。 */
export const DESCRIBE_PROMPT = '用中文描述这张图的材质、色调、光线。不要提品牌、作品名、角色名，不要写你不希望出现的东西。只输出 JSON：{"material":"","palette":"","light":""}';

export const describeImage = async ({file, env = process.env, model = visionModelOf(env), fetchImpl = fetch}) => {
  const dataUrl = jpegDataUrl(file);
  const body = buildVisionBody({model, prompt: DESCRIBE_PROMPT, dataUrl, temperature: 0});
  const {content} = await callVision({env, model, body, fetchImpl});
  const {parsed, error} = parseChecklist(content);
  if (error || !parsed) throw new Error(`参考图描述不是 JSON：${error || '空的'}。看图接口的原话：${redact(content).slice(0, 200)}`);
  const material = String(parsed.material ?? '').trim();
  const palette = String(parsed.palette ?? '').trim();
  const light = String(parsed.light ?? '').trim();
  return {material, palette, light, text: [material, palette, light].filter(Boolean).join('；')};
};

/**
 * 连通性试探：一张图问「图里有什么」。模型名不对就换候选再试。
 * 不打印密钥。返回 {model, subscription, ms, ok, answer, tried}。
 */
export const probeVision = async ({file, env = process.env, fetchImpl = fetch, log = () => {}, models}) => {
  const key = String(env.MINIMAX_API_KEY ?? '').trim();
  if (!key) {
    const err = new Error('没有设置 MINIMAX_API_KEY。设好环境变量再跑。');
    err.exitCode = 2;
    throw err;
  }
  const list = models?.length ? models : [visionModelOf(env), ...VISION_MODEL_CANDIDATES.filter((m) => m !== visionModelOf(env))];
  const dataUrl = jpegDataUrl(file);
  const tried = [];
  for (const model of list) {
    const body = buildVisionBody({model, prompt: '图里有什么？用一句话回答，不要 JSON。', dataUrl, temperature: 0});
    const started = Date.now();
    try {
      const {content} = await callVision({env, model, body, fetchImpl, timeoutMs: 90_000});
      const ms = Date.now() - started;
      const result = {ok: true, model, subscription: isSubscriptionKey(key), ms, answer: stripThink(content).replace(/\s+/g, ' ').slice(0, 200), tried};
      log(`连通性：模型 ${model}，${result.subscription ? '订阅 key 可调' : 'key 可调（不是 sk-cp 订阅 key）'}，耗时 ${ms} ms。`);
      log(`回答：${result.answer}`);
      return result;
    } catch (e) {
      tried.push({model, error: e.message});
      log(`模型 ${model} 不行：${e.message}`);
    }
  }
  const err = new Error(`看图接口没调通。试过：${tried.map((t) => `${t.model}（${t.error}）`).join('；')}。检查 MINIMAX_API_KEY、MINIMAX_BASE_URL 和 BREWREEL_VISION_MODEL。`);
  err.exitCode = 4;
  err.tried = tried;
  throw err;
};

/** 打印用：图片换成字节数。 */
export const redactVisionBody = (body) => redactBody(body);
