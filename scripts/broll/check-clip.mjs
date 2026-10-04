import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg, probeMedia} from './media.mjs';

const tailOf = (r) =>
  String(r.stderr || r.stdout || '没有输出')
    .trim()
    .split(/\r?\n/)
    .slice(-6)
    .join(' / ');

/**
 * 下载（或占位、本地文件）之后：转到 30fps、去掉音轨、裁到窗口帧数、查黑帧和静帧、抽 3 帧。
 * 不自己决定过不过，把 black / freeze 段数交回去。
 */
export const checkClip = ({src, dest, frames, width, height, frameDir, id, preset = 'veryfast', crf = 18}) => {
  if (width % 2 || height % 2) throw new Error(`画面 ${width}×${height} 有一边是奇数，yuv420 需要偶数宽高。把原片裁成偶数再来。`);
  if (!(frames > 0)) throw new Error('检查帧数要大于 0。');
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  if (frameDir) fs.mkdirSync(frameDir, {recursive: true});
  const vf = `fps=30,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=yuv420p`;
  const enc = ffmpeg([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    src,
    '-map',
    '0:v:0',
    '-frames:v',
    String(frames),
    '-an',
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    dest,
  ]);
  if (enc.status !== 0 || !fs.existsSync(dest)) throw new Error(`转码失败：${tailOf(enc)}`);
  const media = probeMedia(dest);
  const want = frames / 30;
  if (media.hasAudio) throw new Error('转码后仍有音轨。');
  if (Math.abs(media.fps - 30) > 0.02) throw new Error(`转码后帧率是 ${media.fps}，要 30。`);
  if (media.width !== width || media.height !== height) throw new Error(`转码后是 ${media.width}×${media.height}，要 ${width}×${height}。`);
  if (Math.abs(media.durationSec - want) > 1.5 / 30) throw new Error(`转码后 ${media.durationSec.toFixed(3)} 秒，窗口要 ${want.toFixed(3)} 秒。源片可能比窗口短。`);
  const det = ffmpeg(['-hide_banner', '-i', dest, '-vf', 'blackdetect=d=0.3:pix_th=0.10,freezedetect=n=0.003:d=0.5', '-f', 'null', '-']);
  const log = `${det.stderr || ''}\n${det.stdout || ''}`;
  if (det.status !== 0 && !/black_start|freeze_start|frame=/.test(log)) throw new Error(`黑帧检测失败：${tailOf(det)}`);
  const black = (log.match(/black_start/g) || []).length;
  const freeze = (log.match(/freeze_start/g) || []).length;
  const pngs = {};
  if (frameDir && id) {
    const marks = {start: 0, mid: Math.floor((frames - 1) / 2), end: frames - 1};
    for (const [tag, index] of Object.entries(marks)) {
      const png = path.join(frameDir, `${id}-${tag}.png`);
      const shot = ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', dest, '-vf', `select=eq(n\\,${index})`, '-frames:v', '1', png]);
      if (shot.status !== 0 || !fs.existsSync(png)) throw new Error(`抽帧失败（${id} ${tag}）：${tailOf(shot)}`);
      pngs[tag] = png;
    }
  }
  return {
    file: dest,
    meta: {width: media.width, height: media.height, fps: media.fps, durationSec: media.durationSec, frames, black, freeze, hasAudio: false, pngs},
  };
};
