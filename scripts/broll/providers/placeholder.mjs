import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TEMPLATE} from '../root.mjs';
import {ffmpeg, ffmpegFilterPath} from '../media.mjs';

const PALETTE = [
  [40, 90, 200],
  [200, 96, 40],
  [40, 160, 90],
  [160, 50, 180],
  [200, 180, 40],
  [40, 140, 180],
  [180, 60, 80],
  [80, 80, 200],
  [90, 160, 40],
  [200, 120, 60],
  [60, 100, 160],
  [140, 80, 40],
];

/** b01 → 第 1 色。整屏红通道随时间轻轻起伏，避免被静帧检测当成死画面。 */
export const colorOf = (id) => {
  const n = Math.max(1, Number(String(id).replace(/\D/g, '')) || 1);
  const [r, g, b] = PALETTE[(n - 1) % PALETTE.length];
  const hex = [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return {r, g, b, hex};
};

const fontFile = () => path.join(TEMPLATE, 'public', 'NotoSansSC-VF.ttf');

/**
 * 纯色卡 + 段号 + plain + 原句。帧数正好等于窗口，无音轨。
 * 文字放在画面中下，躲开字幕带。
 */
export const renderPlaceholder = ({id, plain, sentence, width, height, frames, fps = 30, dest}) => {
  if (width % 2 || height % 2) throw new Error(`画面 ${width}×${height} 有一边是奇数，yuv420 需要偶数宽高。`);
  if (!(frames > 0)) throw new Error('占位片帧数要大于 0。');
  const font = fontFile();
  if (!fs.existsSync(font)) throw new Error('找不到字幕字体文件，占位片写不了字。');
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-ph-'));
  const writeTxt = (name, text) => {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, String(text ?? '').replace(/\s+/g, ' ').trim(), 'utf8');
    return ffmpegFilterPath(p);
  };
  try {
    const {r, g, b, hex} = colorOf(id);
    const size = Math.max(28, Math.round((height * 64) / 1920));
    const vf = [
      'format=rgb24',
      `geq=r='clip(${r}+40*sin(2*PI*T)+if(lt(abs(X-W*(0.5+0.3*sin(2*PI*T)))\\,W*0.15)*gt(Y\\,H*0.84)*lt(Y\\,H*0.96)\\,80\\,0)\\,0\\,255)':g='${g}':b='${b}'`,
      `drawtext=fontfile='${ffmpegFilterPath(font)}':textfile='${writeTxt('id.txt', id)}':fontcolor=white:fontsize=${Math.round(size * 1.3)}:x=(w-text_w)/2:y=h*0.42:expansion=none`,
      `drawtext=fontfile='${ffmpegFilterPath(font)}':textfile='${writeTxt('plain.txt', plain)}':fontcolor=white:fontsize=${size}:x=(w-text_w)/2:y=h*0.50:expansion=none`,
      `drawtext=fontfile='${ffmpegFilterPath(font)}':textfile='${writeTxt('sent.txt', sentence)}':fontcolor=white:fontsize=${Math.round(size * 0.72)}:x=(w-text_w)/2:y=h*0.58:expansion=none`,
      'format=yuv420p',
    ].join(',');
    const dur = (frames / fps + 0.05).toFixed(3);
    const runc = ffmpeg([
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `color=c=0x${hex}:s=${width}x${height}:r=${fps}:d=${dur}`,
      '-vf',
      vf,
      '-frames:v',
      String(frames),
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      dest,
    ]);
    if (runc.status !== 0 || !fs.existsSync(dest)) {
      const tail = String(runc.stderr || runc.stdout || '没有输出')
        .trim()
        .split(/\r?\n/)
        .slice(-6)
        .join(' / ');
      throw new Error(`占位片生成失败：${tail}`);
    }
    return {file: dest, color: colorOf(id)};
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
};
