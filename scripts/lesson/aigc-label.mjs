import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const AIGC_METADATA_KEY = 'AIGC';
export const AIGC_PRODUCER = 'brewreel-studio';
export const AIGC_NOTE = '字段需对照标准原文复核';

export function aigcPayload(inputHash, when = new Date()) {
  const stamp = when.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/u, 'Z');
  return {
    Label: '1',
    ContentProducer: AIGC_PRODUCER,
    ProduceID: `${String(inputHash).slice(0, 16)}-${stamp}`,
  };
}

export function aigcMetadataValue(payload) {
  return JSON.stringify({
    Label: payload.Label,
    ContentProducer: payload.ContentProducer,
    ProduceID: payload.ProduceID,
  });
}

export function explicitMarking(domain, lang, sample, trial = false) {
  const en = lang === 'en';
  const legal = domain === 'legal';
  return {
    aiLabel: en ? 'AI-generated synthetic' : 'AI生成合成',
    residentLabel: null,
    realPersonLabel: null,
    forced: true,
    disclaimer: legal ? (en ? 'Legal education only; not legal advice' : '普法内容，不构成法律意见') : null,
    forcedEndCard: legal,
    sampleBanner: sample ? (en ? 'Internal sample · not reviewed by a lawyer' : '内部样片 · 未经律师审核') : null,
    trialBanner: null,
  };
}

function findRemotionBinary(templateDir, name) {
  const base = path.join(templateDir, 'node_modules', '@remotion');
  if (!templateDir || !fs.existsSync(base)) return null;
  let names = [];
  try { names = fs.readdirSync(base); }
  catch { return null; }
  const exeName = process.platform === 'win32' ? `${name}.exe` : name;
  const dir = names.find((item) => item.startsWith('compositor-') && fs.existsSync(path.join(base, item, exeName)));
  return dir ? path.join(base, dir, exeName) : null;
}

export function findRemotionFfmpeg(templateDir) {
  return findRemotionBinary(templateDir, 'ffmpeg');
}

export function findRemotionFfprobe(templateDir) {
  return findRemotionBinary(templateDir, 'ffprobe');
}

export function findFullFfmpeg(templateDir) {
  for (const candidate of [process.env.BREWREEL_FFMPEG, process.env.IMAGEIO_FFMPEG]) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return findRemotionFfmpeg(templateDir);
}

export function readFormatTags(ffprobe, videoPath) {
  if (!ffprobe) return null;
  const ran = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', videoPath], {encoding: 'utf8', windowsHide: true});
  if (ran.status !== 0) return null;
  try { return JSON.parse(ran.stdout)?.format?.tags ?? null; }
  catch { return null; }
}

export function tagsMatchAigc(tags, payload) {
  if (!tags || typeof tags !== 'object') return false;
  const raw = tags.AIGC ?? tags.aigc ?? tags.Aigc;
  if (typeof raw !== 'string' || !raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.Label === payload.Label && parsed?.ContentProducer === payload.ContentProducer && parsed?.ProduceID === payload.ProduceID) return true;
  } catch { /* ffprobe 有时会多包一层引号，下面用原文核对 */ }
  return raw.includes(`"Label":"${payload.Label}"`) && raw.includes(`"ContentProducer":"${payload.ContentProducer}"`) && raw.includes(`"ProduceID":"${payload.ProduceID}"`);
}

function sameTag(actual, expected) {
  if (actual === expected) return true;
  return typeof actual === 'string' && actual.replace(/^"|"$/g, '') === expected;
}

export function embedAigcMetadata({videoPath, payload, ffmpeg, ffprobe, extraTags = []}) {
  if (!ffmpeg) throw new Error('找不到完整版 ffmpeg，无法写入 AIGC 隐式标识');
  const json = aigcMetadataValue(payload);
  const tmp = `${videoPath}.aigc-tmp.mp4`;
  fs.rmSync(tmp, {force: true});
  const metadata = [`${AIGC_METADATA_KEY}=${json}`, ...extraTags.map((tag) => `${tag.key}=${tag.value}`)];
  const ran = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', videoPath, '-map', '0', '-c', 'copy', '-map_metadata', '0', '-movflags', 'use_metadata_tags', ...metadata.flatMap((item) => ['-metadata', item]), tmp], {encoding: 'utf8', windowsHide: true});
  if (ran.status !== 0 || !fs.existsSync(tmp) || fs.statSync(tmp).size < 1024) {
    fs.rmSync(tmp, {force: true});
    throw new Error(`写入 AIGC 元数据失败：${String(ran.stderr || ran.error?.message || '').trim() || `退出码 ${ran.status}`}`);
  }
  fs.rmSync(videoPath, {force: true});
  fs.renameSync(tmp, videoPath);
  const tags = readFormatTags(ffprobe, videoPath);
  if (!tagsMatchAigc(tags, payload)) {
    throw new Error('ffprobe 没有读到 AIGC 隐式标识');
  }
  for (const tag of extraTags) {
    const actual = tags?.[tag.key] ?? tags?.[tag.key.toLowerCase()] ?? tags?.[tag.key.toUpperCase()];
    if (!sameTag(actual, tag.value)) throw new Error(`ffprobe 没有读到 ${tag.key}`);
  }
  return tags;
}
