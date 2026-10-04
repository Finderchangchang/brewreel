import fs from 'node:fs';
import path from 'node:path';
import {probeMedia} from '../media.mjs';

/**
 * 用户自带的视频当 B-roll。时长不够窗口就报错。
 * 报错里的路径用模型写在 file 里的那一串，不改写成另一条绝对路径。
 */
export const prepareLocal = ({file, projectDir, windowSec}) => {
  const written = String(file ?? '');
  if (!written.trim()) throw new Error('local 这段没有写 file。填上视频路径。');
  const abs = path.resolve(projectDir, written);
  if (!fs.existsSync(abs)) throw new Error(`找不到 ${written}。改成真实存在的视频路径。`);
  const media = probeMedia(abs);
  const have = media.durationSec;
  if (have + 0.05 < windowSec) {
    throw new Error(`${written} 只有 ${have.toFixed(2)} 秒，这段窗口要 ${windowSec.toFixed(2)} 秒。换成更长的视频，或把 from / to 收短。`);
  }
  return {abs, media};
};
