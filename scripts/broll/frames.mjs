import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg} from './media.mjs';

const tailOf = (r) =>
  String(r.stderr || r.stdout || '没有输出')
    .trim()
    .split(/\r?\n/)
    .slice(-4)
    .join(' / ');

/**
 * 从合成后的成片上抽检查帧：每段 before / start / mid / end / after。
 * start 和 end 往窗口里面收一点，躲开 0.36 秒的进出场（真人收放、面板推进推出），这样看得到摆好的 pip 和 split。
 */
export const extractDeliveryFrames = ({video, clips, durationSec, fps = 30, checkDir}) => {
  if (!fs.existsSync(video)) throw new Error('成片不在，抽不了检查帧。');
  fs.mkdirSync(checkDir, {recursive: true});
  for (const clip of clips) {
    const start = clip.windowMs[0] / 1000;
    const end = clip.windowMs[1] / 1000;
    const mid = (start + end) / 2;
    const pad = Math.min(0.45, Math.max(0, (end - start) / 4));
    const marks = [
      ['before', Math.max(0, start - 1 / fps)],
      ['start', Math.min(mid, start + pad)],
      ['mid', mid],
      ['end', Math.max(mid, end - pad)],
      ['after', Math.min(Math.max(0, durationSec - 1 / fps), end + 1 / fps)],
    ];
    for (const [tag, sec] of marks) {
      const png = path.join(checkDir, `${clip.id}-${tag}.png`);
      const shot = ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-ss', sec.toFixed(3), '-frames:v', '1', png]);
      if (shot.status !== 0 || !fs.existsSync(png)) throw new Error(`成片抽帧失败（${clip.id} ${tag}）：${tailOf(shot)}`);
    }
  }
};

/**
 * 从一段视频上按固定间隔抽帧（风格工厂的视频试拍：4 秒、每 0.5 秒 1 帧，共 8 帧）。
 * 时刻是 0、0.5、…，不含结尾那一格（落到文件末尾容易抽空）。
 * @returns {string[]} 抽出的 jpg 路径
 */
export const extractFramesEvery = ({video, outDir, everySec = 0.5, durationSec = 4}) => {
  if (!fs.existsSync(video)) throw new Error(`视频不在：${video}。先生成再抽帧。`);
  if (!(everySec > 0) || !(durationSec > 0)) throw new Error(`抽帧间隔不对：everySec=${everySec}，durationSec=${durationSec}。`);
  fs.mkdirSync(outDir, {recursive: true});
  const n = Math.round(durationSec / everySec);
  const files = [];
  for (let i = 0; i < n; i++) {
    const sec = Math.round(i * everySec * 1000) / 1000;
    const dest = path.join(outDir, `f${String(i).padStart(2, '0')}.jpg`);
    const shot = ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-ss', sec.toFixed(3), '-frames:v', '1', dest]);
    if (shot.status !== 0 || !fs.existsSync(dest)) throw new Error(`抽帧失败（${sec} 秒）：${tailOf(shot)}。检查 ffmpeg 和视频。`);
    files.push(dest);
  }
  return files;
};
