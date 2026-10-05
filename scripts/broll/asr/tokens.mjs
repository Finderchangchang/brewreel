// 转写缓存里的逐字时间 → 动效段 marks 用的 [{text, startMs}]（绝对毫秒）。纯读文件，不加载识别模型。
// 只在 talk.srt 是自动转写出来的（没改过或只改过字）时才用；用户自己放的字幕和缓存对不上，直接不用。
// 对不上的句子 motion.mjs 会自己退回句内插值，所以这里宁可多给，不会把时间弄错。
import fs from 'node:fs';
import path from 'node:path';

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
};

/** 缓存 {tokens, times(秒)} → [{text, startMs}]。英文词头的 ▁ 去掉；空 token 丢掉。 */
export const tokensFromAsr = (asr) => {
  if (!asr || !Array.isArray(asr.tokens) || !Array.isArray(asr.times) || asr.tokens.length !== asr.times.length) return [];
  const out = [];
  asr.tokens.forEach((t, i) => {
    const text = String(t ?? '').replace(/▁/g, ' ');
    const sec = Number(asr.times[i]);
    if (!text.trim() || !Number.isFinite(sec)) return;
    out.push({text, startMs: Math.round(sec * 1000)});
  });
  return out;
};

/**
 * 项目目录里能用的逐字时间。没转写过、字幕是用户自己放的、缓存不在：返回 []。
 * @param {string} dir 项目目录
 * @returns {{text: string, startMs: number}[]}
 */
export const asrTokensOf = (dir) => {
  const meta = readJson(path.join(dir, '.brewreel', 'transcribe.json'));
  if (!meta?.cache || !meta?.srtSha256) return [];
  const srt = path.join(dir, 'talk.srt');
  if (!fs.existsSync(srt)) return [];
  const asr = readJson(path.join(dir, '.brewreel', path.basename(String(meta.cache))));
  if (!asr) return [];
  // 用户改过字也照样给：motion.mjs 按句比字数，对不上的句子自己退回插值
  return tokensFromAsr(asr);
};
