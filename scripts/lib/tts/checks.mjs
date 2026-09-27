// ============================================================
// 配音相关的分镜校验（validate.mjs 调用）：meta.voice 字段、每镜 vo 的格式与语速、配音后总时长估算。
// vo 的广告法 / 极限词 / 事实依据 / 错别字等文本检查不在这里：validate.mjs 把 vo 放进统一的 texts 里一起扫。
// ============================================================
import {PROVIDER_IDS, SPEED_RANGE, SUBTITLE_MODES} from './index.mjs';
import {EMOTIONS, MODELS} from './minimax.mjs';
import {UNIT_SEC} from './mock.mjs';
import {LEAD_SEC, TAIL_SEC} from './pipeline.mjs';
import {plainOf, spokenUnits, tokenize} from './timing.mjs';

export const VOICE_KEYS = ['provider', 'voiceId', 'speed', 'emotion', 'model', 'subtitles'];
/** 听得清的语速上限（speed = 1 时）：中文约 5 字/秒，英文约 3 词/秒；speed 越快上限按比例放宽 */
export const RATE_LIMIT = {zh: 5, en: 3};

const f1 = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** 读出来的「字数」：中文按汉字（数字、英文单词按音节折算），英文按词 */
export const voCount = (plain, lang) =>
  lang === 'en' ? plain.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length : tokenize(plain, 'zh').reduce((a, t) => a + t.weight, 0);

/** 按常见语速估算念完要几秒（和 mock 配音同一套：一个汉字 / 一个英文音节约 0.225 秒 ÷ speed） */
export const estimateSec = (plain, lang, speed = 1) => (spokenUnits(plain, lang) * UNIT_SEC) / (speed || 1);

/**
 * meta.voice 校验。
 * @param {any} v meta.voice
 * @param {{lang: 'zh'|'en', err: Function, warn: Function, env?: Record<string, string|undefined>}} o
 */
export function checkVoiceMeta(v, {lang, err, warn, env = process.env}) {
  const W = (k) => (k ? `meta.voice.${k}` : 'meta.voice');
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    err(W(), '应该是对象', '写成 {"provider": "minimax", "voiceId": "…", "speed": 1, "subtitles": "karaoke"}；不配音就删掉 meta.voice');
    return;
  }
  for (const k of Object.keys(v)) if (!VOICE_KEYS.includes(k)) err(W(k), '多了一个不认识的字段', `删掉，或检查拼写。可用字段：${VOICE_KEYS.join('、')}`);
  if (!PROVIDER_IDS.includes(v.provider))
    err(W('provider'), v.provider === undefined ? '缺少 provider（用哪家配音）' : `「${v.provider}」不是可选值`, `只能写 ${PROVIDER_IDS.join(' / ')}：minimax = 真人感配音（要 MINIMAX_API_KEY）；mock = 不联网的占位音，先看节奏用`);
  if (v.voiceId !== undefined && (typeof v.voiceId !== 'string' || !v.voiceId.trim() || v.voiceId.length > 100))
    err(W('voiceId'), '应该是音色 id（文字）', '如 "Chinese (Mandarin)_Male_Announcer"；不确定就删掉，用默认音色');
  if (v.speed !== undefined && (typeof v.speed !== 'number' || !Number.isFinite(v.speed) || v.speed < SPEED_RANGE[0] || v.speed > SPEED_RANGE[1]))
    err(W('speed'), `语速 ${JSON.stringify(v.speed)} 不在 ${SPEED_RANGE[0]}–${SPEED_RANGE[1]} 之间`, '不确定就删掉（默认 1）；广告旁白一般 1–1.15');
  else if (typeof v.speed === 'number' && (v.speed > 1.3 || v.speed < 0.8))
    warn(W('speed'), `语速 ${v.speed} ${v.speed > 1.3 ? '偏快，中文会超过每秒 5 字，听不清' : '偏慢，片子会拖'}`, '广告旁白一般 1–1.15；念不完就删字或拆镜，不要靠调快语速硬塞');
  if (v.emotion !== undefined && !EMOTIONS.includes(v.emotion))
    err(W('emotion'), `「${v.emotion}」不是可选情绪`, `只能从这些里选：${EMOTIONS.join(' / ')}；广告旁白建议 calm 或 fluent，不写用音色默认`);
  if (v.model !== undefined) {
    if (typeof v.model !== 'string' || !v.model.trim()) err(W('model'), '应该是模型名（文字）', `如 ${MODELS[0]}；不确定就删掉`);
    else if (v.provider === 'minimax' && !MODELS.includes(v.model)) warn(W('model'), `「${v.model}」不在已知模型列表里`, `常用：${MODELS.slice(0, 4).join(' / ')}（hd 音质好、turbo 便宜）；新模型可以保留`);
  }
  if (v.subtitles !== undefined && !SUBTITLE_MODES.includes(v.subtitles))
    err(W('subtitles'), `「${v.subtitles}」不是可选值`, `只能写 ${SUBTITLE_MODES.join(' / ')}：karaoke = 逐字高亮，line = 整句字幕，off = 不出旁白字幕；不写默认 karaoke`);
  if (v.provider === 'minimax' && lang === 'en' && v.voiceId === undefined)
    warn(W('voiceId'), '英文片没写 voiceId，会用默认英文音色（没有在真实接口上核对过）', '在 MiniMax 音色列表里选一个英文音色写进 voiceId');
  if (v.provider === 'minimax' && !String(env?.MINIMAX_API_KEY ?? '').trim())
    warn(W('provider'), '当前环境没有 MINIMAX_API_KEY：校验可以过，但出片（make.mjs）会停在配音这一步', '出片前设好环境变量 MINIMAX_API_KEY；想先看节奏，出片加 --voice-provider mock（不联网的占位音，不用改分镜）预览，或加 --no-voice 出无配音版');
}

/**
 * 一镜的 vo：格式、强调、语速。返回按常见语速估算的「配音后本镜时长」（秒；vo 不合法时返回 null）。
 * @param {{vo: any, W: (f: string) => string, spec: any, lang: 'zh'|'en', speed: number, beat: number, err: Function, warn: Function}} o
 */
export function checkVo({vo, W, spec, lang, speed, beat, err, warn}) {
  const w = W('vo');
  if (typeof vo !== 'string') {
    err(w, '旁白应该是文字', '写这一镜要念的一句话，如「下班前五分钟，报表还没做完」');
    return null;
  }
  const plain = plainOf(vo).trim();
  if (!plain) {
    err(w, '旁白是空的', '写这一镜要念的话；不需要旁白就删掉 vo');
    return null;
  }
  if (/\n/.test(vo)) err(w, '旁白不用换行', '写成一句话；字幕会按节奏自动分页（长句拆到两镜更好）');
  // {} 强调：成对、不嵌套、不为空；每 24 字最多一处
  let depth = 0;
  let pairs = 0;
  let bad = false;
  let inner = '';
  for (const ch of vo) {
    if (ch === '{') {
      if (depth) bad = true;
      depth++;
      inner = '';
    } else if (ch === '}') {
      if (!depth) bad = true;
      else {
        depth--;
        pairs++;
        if (!inner.trim()) bad = true;
      }
    } else if (depth) inner += ch;
  }
  if (depth || bad) err(w, '{} 没有成对（或嵌套、或是空的）', '每个 { 后面都要有对应的 }，里面放要强调的几个字，如「报表{自己出来了}」');
  const maxHot = Math.max(1, Math.ceil(Array.from(plain).length / 24));
  if (pairs > maxHot) err(w, `用了 ${pairs} 处 {} 强调，这句最多 ${maxHot} 处`, '只留最关键的一处 {}，其余去掉花括号');
  // 语速：这一镜最长 spec.dur.max 秒，去掉前后留白，要在里面念完
  const s = speed > 0 ? speed : 1;
  const avail = Math.max(0.1, (spec?.dur?.max ?? 60) - LEAD_SEC - TAIL_SEC);
  const count = voCount(plain, lang);
  const limit = RATE_LIMIT[lang] * s;
  const unit = lang === 'en' ? '词' : '字';
  if (count / avail > limit + 1e-9) {
    err(w, `旁白 ${f1(count)} ${unit}，这一镜最长 ${spec?.dur?.max} 秒，要每秒念 ${f1(count / avail)} ${unit}才念得完（上限约 ${f1(limit)} ${unit}/秒）`,
      `缩短到 ${Math.floor(limit * avail)} ${unit}以内，或把这句拆到两镜（每镜一句）；不要靠调快 speed 硬塞`);
    return null;
  }
  const est = estimateSec(plain, lang, s);
  const need = LEAD_SEC + est + TAIL_SEC;
  if (spec?.dur?.max && need > spec.dur.max + 1e-6)
    warn(w, `按常见语速估算要念 ${est.toFixed(1)} 秒，加留白约 ${need.toFixed(1)} 秒，可能超过这一镜最长 ${spec.dur.max} 秒（出片时按实际配音时长判断，超了会停）`, `删几个${unit}，或拆到两镜`);
  const b = beat > 0 ? beat : 0.5;
  return Math.min(spec?.dur?.max ?? need, Math.max(Math.ceil((spec?.dur?.min ?? 0) / b - 1e-6), Math.ceil(need / b - 1e-6)) * b);
}
