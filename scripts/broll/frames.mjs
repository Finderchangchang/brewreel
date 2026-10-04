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
 * start 和 end 往窗口里面收一点，躲开 0.2 秒淡入淡出，这样看得到 pip 和 split。
 */
export const extractDeliveryFrames = ({video, clips, durationSec, fps = 30, checkDir}) => {
  if (!fs.existsSync(video)) throw new Error('成片不在，抽不了检查帧。');
  fs.mkdirSync(checkDir, {recursive: true});
  for (const clip of clips) {
    const start = clip.windowMs[0] / 1000;
    const end = clip.windowMs[1] / 1000;
    const mid = (start + end) / 2;
    const pad = Math.min(0.25, Math.max(0, (end - start) / 4));
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
