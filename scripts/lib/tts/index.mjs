// ============================================================
// 配音提供者注册 + 缓存。
//   provider 接口：synthesize(text, opts) → {audioPath, durMs, words[], granularity, ...}
//   提供者：minimax（MiniMax）/ aliyun（阿里云百炼 CosyVoice）/ volcengine（火山引擎豆包语音）/ mock（占位音）
//   缓存键 = sha256(provider + model + voiceId + speed + emotion + lang + text)，音频和时间戳一起存；
//   改画面、改别的镜头都不会重复合成、不会重复计费。
//   缓存目录：BREWREEL_TTS_CACHE → $XDG_CACHE_HOME/brewreel/tts → ~/.cache/brewreel/tts（都在输出目录和仓库之外）
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as aliyun from './aliyun.mjs';
import * as minimax from './minimax.mjs';
import * as mock from './mock.mjs';
import * as volcengine from './volcengine.mjs';

/** 真接口三家 + 不联网的 mock。每家导出 synthesize / DEFAULT_VOICE / DEFAULT_MODEL / MODELS（mock 除外） */
export const PROVIDERS = {minimax, aliyun, volcengine, mock};
export const PROVIDER_IDS = Object.keys(PROVIDERS);
export const SUBTITLE_MODES = ['karaoke', 'line', 'off'];
export const SPEED_RANGE = [0.5, 2];
/** 缓存格式版本：改了时间戳算法 / 音频处理就加一，旧缓存自动失效 */
const CACHE_VERSION = 1;

export const cacheDirOf = (env = process.env) => {
  if (env.BREWREEL_TTS_CACHE) return path.resolve(env.BREWREEL_TTS_CACHE);
  const base = env.XDG_CACHE_HOME ? path.resolve(env.XDG_CACHE_HOME) : path.join(os.homedir(), '.cache');
  return path.join(base, 'brewreel', 'tts');
};

/** meta.voice → 补上默认值的配置；没写 meta.voice 返回 null（不配音） */
export const voiceConfigOf = (meta) => {
  const v = meta?.voice;
  if (!v || typeof v !== 'object') return null;
  const lang = meta?.lang === 'en' ? 'en' : 'zh';
  const provider = PROVIDER_IDS.includes(v.provider) ? v.provider : 'mock';
  return {
    provider,
    lang,
    voiceId: typeof v.voiceId === 'string' && v.voiceId.trim() ? v.voiceId.trim() : PROVIDERS[provider].DEFAULT_VOICE?.[lang] ?? `mock-${lang}`,
    speed: typeof v.speed === 'number' && v.speed >= SPEED_RANGE[0] && v.speed <= SPEED_RANGE[1] ? v.speed : 1,
    // 情绪只有 MiniMax 认（另外两家的情绪参数取值不同，先不接）
    emotion: provider === 'minimax' && typeof v.emotion === 'string' && v.emotion ? v.emotion : null,
    model: provider === 'mock' ? 'mock' : typeof v.model === 'string' && v.model ? v.model : PROVIDERS[provider].DEFAULT_MODEL,
    subtitles: SUBTITLE_MODES.includes(v.subtitles) ? v.subtitles : 'karaoke',
  };
};

export const cacheKey = (cfg, text) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify([CACHE_VERSION, cfg.provider, cfg.model, cfg.voiceId, cfg.speed, cfg.emotion ?? '', cfg.lang, text]))
    .digest('hex');

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

/**
 * 合成一句（先查缓存）。返回 {audioPath, ext, durMs, words, granularity, cacheHit, key, usageCharacters}
 * @param {string} text 去掉 {} 的旁白
 * @param {ReturnType<typeof voiceConfigOf>} cfg
 * @param {{cacheDir?: string, env?: any, fetch?: any, sleep?: any, log?: (s: string) => void, minIntervalMs?: number}} [o]
 */
export async function synthesizeCached(text, cfg, o = {}) {
  const provider = PROVIDERS[cfg.provider];
  if (!provider) throw new Error(`unknown TTS provider: ${cfg.provider}`);
  const dir = o.cacheDir ?? cacheDirOf(o.env);
  fs.mkdirSync(dir, {recursive: true});
  const key = cacheKey(cfg, text);
  const metaPath = path.join(dir, `${key}.json`);
  const hit = readJson(metaPath);
  if (hit && hit.audio && fs.existsSync(path.join(dir, hit.audio)) && Array.isArray(hit.words) && hit.durMs > 0)
    return {...hit, audioPath: path.join(dir, hit.audio), cacheHit: true, key, usageCharacters: 0};
  // 先写到临时名，成功后再改名：并发的两次 make 不会读到半个文件
  const tmpBase = path.join(dir, `${key}.tmp-${process.pid}-${Date.now().toString(36)}`);
  const r = await provider.synthesize(text, {
    outBase: tmpBase,
    lang: cfg.lang,
    speed: cfg.speed,
    voiceId: cfg.voiceId,
    emotion: cfg.emotion ?? undefined,
    model: cfg.model,
    env: o.env,
    fetch: o.fetch,
    sleep: o.sleep,
    log: o.log,
    minIntervalMs: o.minIntervalMs,
  });
  const ext = r.ext || path.extname(r.audioPath).slice(1) || 'bin';
  const finalAudio = path.join(dir, `${key}.${ext}`);
  fs.renameSync(r.audioPath, finalAudio);
  if (fs.existsSync(`${tmpBase}.subtitle.json`)) fs.renameSync(`${tmpBase}.subtitle.json`, path.join(dir, `${key}.subtitle.json`));
  const meta = {
    v: CACHE_VERSION,
    provider: cfg.provider,
    model: cfg.model,
    voiceId: cfg.voiceId,
    speed: cfg.speed,
    emotion: cfg.emotion,
    lang: cfg.lang,
    text,
    audio: path.basename(finalAudio),
    ext,
    durMs: r.durMs,
    words: r.words,
    granularity: r.granularity,
    usageCharacters: r.usageCharacters ?? 0,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(`${metaPath}.tmp-${process.pid}`, JSON.stringify(meta), 'utf8');
  fs.renameSync(`${metaPath}.tmp-${process.pid}`, metaPath);
  return {...meta, audioPath: finalAudio, cacheHit: false, key};
}
