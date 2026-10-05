// 口播原片归一化：手机直出的 HEVC、可变帧率、单声道、旋转标记、奇数宽高……合成前统一转成
// H.264 + 恒定帧率 + yuv420p + AAC 双声道，存在 <项目目录>/.brewreel/ 下。原片一个字节都不动。
// 已经是 H.264 恒定帧率的就直接用原片，不转。
import fs from 'node:fs';
import path from 'node:path';
import {sha256Stream} from './asr/audio.mjs';
import {ffmpeg, probeMedia} from './media.mjs';

/** 常见帧率：差 0.6 以内就归到这一档（29.97 → 30）。 */
export const STANDARD_FPS = [24, 25, 30, 50, 60];

/** 合成用的帧率：靠近哪档用哪档；高于 60 的降到 60；不常见的用 30。 */
export const targetFpsOf = (fps) => {
  const n = Number(fps);
  if (!Number.isFinite(n) || n <= 0) return 30;
  const near = STANDARD_FPS.find((f) => Math.abs(f - n) <= 0.6);
  if (near) return near;
  return n > 60 ? 60 : 30;
};

/** 为什么要转（人话，空数组表示不用转）。info 是 probeMedia 的结果。 */
export const normalizeReasons = (info) => {
  const out = [];
  if (info.videoCodec && info.videoCodec !== 'h264') out.push(`视频编码是 ${info.videoCodec.toUpperCase()}，不是 H.264`);
  if (info.pixFmt && !['yuv420p', 'yuvj420p'].includes(info.pixFmt)) out.push(`像素格式是 ${info.pixFmt}`);
  if (info.vfr) out.push(`可变帧率（平均 ${Number(info.avgFps || info.fps).toFixed(2)} 帧/秒）`);
  else if (Math.abs(targetFpsOf(info.fps) - info.fps) > 0.01) out.push(`帧率 ${info.fps} 不是整数档`);
  if (info.rotation) out.push(`带 ${info.rotation}° 旋转标记`);
  if (info.width % 2 || info.height % 2) out.push(`宽高有奇数（${info.width}×${info.height}）`);
  if (info.hasAudio && info.audioChannels === 1) out.push('单声道');
  if (info.hasAudio && info.audioCodec && info.audioCodec !== 'aac') out.push(`音频编码是 ${info.audioCodec}`);
  return out;
};

/** 转完之后的画面参数（宽高取偶数、帧率取整数档）。不用转的话就是原样。 */
export const normalizedMediaOf = (info) => {
  const reasons = normalizeReasons(info);
  if (!reasons.length) return {...info, normalized: false, reasons};
  const width = info.width - (info.width % 2);
  const height = info.height - (info.height % 2);
  return {...info, width, height, fps: targetFpsOf(info.fps), videoCodec: 'h264', pixFmt: 'yuv420p', vfr: false, rotation: 0, audioChannels: info.hasAudio ? 2 : 0, audioCodec: info.hasAudio ? 'aac' : '', normalized: true, reasons};
};

const tailOf = (r) =>
  String(r.stderr || r.stdout || '没有输出')
    .trim()
    .split(/\r?\n/)
    .slice(-4)
    .join(' / ');

/** ffmpeg 参数（纯函数，测试用）。cfrFlag 是 -fps_mode（新版）或 -vsync（老版）。 */
export const normalizeArgs = ({src, dest, target, hasAudio, cfrFlag = '-fps_mode'}) => {
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-map', '0:v:0'];
  if (hasAudio) args.push('-map', '0:a:0');
  // 旋转标记 ffmpeg 解码时自动转正（autorotate），这里的宽高已经是转正之后的
  args.push('-vf', `scale=${target.width}:${target.height}:flags=bicubic,setsar=1,format=yuv420p`);
  args.push('-r', String(target.fps), cfrFlag, 'cfr');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p');
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000');
  args.push('-movflags', '+faststart', dest);
  return args;
};

/**
 * 需要的话把 talk.mp4 转好，返回合成要用的文件和它的画面参数。
 * 结果缓存在 .brewreel/talk-h264-<sha16>-<fps>.mp4：同一个原片第二次直接用。
 * @param {{talk: string, projectDir: string, media?: object, log?: (s: string) => void}} p
 * @returns {Promise<{file: string, media: object, normalized: boolean, reasons: string[], cached: boolean}>}
 */
export const normalizeTalk = async ({talk, projectDir, media = null, log = console.log}) => {
  const info = media ?? probeMedia(talk);
  const want = normalizedMediaOf(info);
  if (!want.normalized) return {file: talk, media: info, normalized: false, reasons: [], cached: false};
  const sha = await sha256Stream(talk);
  const dir = path.join(projectDir, '.brewreel');
  fs.mkdirSync(dir, {recursive: true});
  const name = `talk-h264-${sha.slice(0, 16)}-${want.fps}.mp4`;
  const dest = path.join(dir, name);
  if (fs.existsSync(dest)) {
    try {
      const got = probeMedia(dest);
      if (got.videoCodec === 'h264' && got.width === want.width && got.height === want.height) {
        return {file: dest, media: {...got, normalized: true, reasons: want.reasons}, normalized: true, reasons: want.reasons, cached: true};
      }
    } catch {
      // 坏了就重转
    }
  }
  log(`原片要先转一下再合成（${want.reasons.join('；')}）：转成 H.264、${want.fps} 帧/秒恒定帧率${info.hasAudio ? '、双声道' : ''}，存在 .brewreel/${name}，原片不动…`);
  const tmp = `${dest}.${process.pid}.tmp.mp4`;
  const target = {width: want.width, height: want.height, fps: want.fps};
  let r = ffmpeg(normalizeArgs({src: talk, dest: tmp, target, hasAudio: info.hasAudio}));
  if (r.status !== 0 && /fps_mode|Unrecognized option/i.test(`${r.stderr || ''}`)) {
    r = ffmpeg(normalizeArgs({src: talk, dest: tmp, target, hasAudio: info.hasAudio, cfrFlag: '-vsync'}));
  }
  if (r.status !== 0 || !fs.existsSync(tmp)) {
    fs.rmSync(tmp, {force: true});
    const err = new Error(`原片转码失败：${tailOf(r)}。可以先用剪辑软件把口播导出成 H.264、30 帧/秒的 mp4，再改名为 talk.mp4。`);
    err.exitCode = 4;
    throw err;
  }
  fs.renameSync(tmp, dest);
  // 只留这一份：换过原片后的旧转码删掉
  for (const f of fs.readdirSync(dir)) if (f.startsWith('talk-h264-') && f !== name) fs.rmSync(path.join(dir, f), {force: true});
  const got = probeMedia(dest);
  return {file: dest, media: {...got, normalized: true, reasons: want.reasons}, normalized: true, reasons: want.reasons, cached: false};
};
