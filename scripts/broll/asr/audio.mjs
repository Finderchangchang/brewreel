// 转写前的音频处理：抽 16k 单声道 wav、找静音、在静音处切块。
// ffmpeg 用 media.mjs 的查找顺序（FFMPEG 环境变量 → Python imageio → 系统 PATH → Remotion 自带的精简版）。
// Remotion 自带的精简版 ffmpeg 没有 s16le 封装，所以输出一律用 wav 容器（-c:a pcm_s16le）。
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {ffmpeg} from '../media.mjs';

// 参数写死，不让模型自由发挥。
export const SILENCE_NOISE = '-38dB';
export const SILENCE_MIN_SEC = 0.2;
export const CHUNK_MAX_SEC = 25;
export const CHUNK_MIN_SEC = 4;

const round3 = (x) => Math.round(x * 1000) / 1000;

/** 流式算 sha256（talk.mp4 可能上 GB，不整个读进内存）。 */
export const sha256Stream = (file) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    fs.createReadStream(file, {highWaterMark: 4 * 1024 * 1024})
      .on('data', (b) => h.update(b))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });

const tail = (text, n = 3) =>
  String(text || '')
    .trim()
    .split(/\r?\n/)
    .slice(-n)
    .join(' / ');

/** talk.mp4 → 16k 单声道 wav。失败抛错，message 给人看。 */
export const extractWav = (input, wavPath, run = ffmpeg) => {
  const r = run(['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wavPath]);
  if (r.error?.code === 'ENOENT') {
    throw new Error('找不到 ffmpeg。在 template 目录跑 npm install（会带上 Remotion 自带的 ffmpeg），或者装好 ffmpeg 后把路径设成环境变量 FFMPEG。');
  }
  if (r.status !== 0 || !fs.existsSync(wavPath) || fs.statSync(wavPath).size <= 44) {
    const msg = tail(`${r.stderr || ''}${r.error ? `\n${r.error.message}` : ''}`);
    if (/does not contain any stream|matches no streams|Output file .* does not contain/i.test(msg)) {
      throw new Error('talk.mp4 里没有声音轨道。检查剪辑软件的导出设置（要带音频），或者自己放一个 talk.srt。');
    }
    throw new Error(`从 talk.mp4 抽音频失败：${msg || '没有输出'}。文件可能损坏或不是视频：重新导出一次 talk.mp4，或者自己放一个 talk.srt。`);
  }
};

/** 解析 ffmpeg silencedetect 的输出。最后一段只有 start 没有 end 时，用 totalSec 收尾。 */
export const parseSilences = (stderr, totalSec = null) => {
  const out = [];
  let open = null;
  for (const m of String(stderr || '').matchAll(/silence_(start|end):\s*(-?[0-9.]+)/g)) {
    const v = Math.max(0, Number(m[2]));
    if (!Number.isFinite(v)) continue;
    if (m[1] === 'start') open = v;
    else if (open != null) {
      if (v > open) out.push({start: round3(open), end: round3(v)});
      open = null;
    }
  }
  if (open != null && totalSec != null && totalSec > open) out.push({start: round3(open), end: round3(totalSec)});
  return out;
};

export const detectSilences = (wavPath, totalSec = null, run = ffmpeg) => {
  const r = run(['-hide_banner', '-nostats', '-i', wavPath, '-af', `silencedetect=noise=${SILENCE_NOISE}:d=${SILENCE_MIN_SEC}`, '-f', 'null', '-']);
  if (r.status !== 0) return [];
  return parseSilences(r.stderr, totalSec);
};

/**
 * 在静音处把音频切成不超过 maxSec 的块。纯函数。
 * 总长不超过 maxSec 就整段；否则在每个窗口里找静音：优先窗口后半段里最长的那段，没有再找离块起点 minSec 以后的，
 * 从静音中点切开；一段静音都没有就在 maxSec 处硬切。最后一块不短于 minSec。
 * @returns {number[]} 切点（秒），首项 0，末项 totalSec
 */
export const planChunks = (totalSec, silences = [], {maxSec = CHUNK_MAX_SEC, minSec = CHUNK_MIN_SEC} = {}) => {
  const cuts = [0];
  if (!(totalSec > 0)) return [0, 0];
  while (totalSec - cuts[cuts.length - 1] > maxSec) {
    const from = cuts[cuts.length - 1];
    const mids = silences.map((s) => ({len: s.end - s.start, mid: (s.start + s.end) / 2}));
    // 最后一块也至少留 minSec：太短的块（1–2 秒）识别会明显变差，还容易认错语种
    const hi = Math.min(from + maxSec, totalSec - minSec);
    const pick = (lo) =>
      mids
        .filter((s) => s.mid > lo && s.mid < hi)
        .sort((a, b) => b.len - a.len || b.mid - a.mid)[0];
    const best = pick(from + maxSec / 2) || pick(from + minSec);
    cuts.push(round3(best ? best.mid : Math.max(from + minSec, hi)));
  }
  cuts.push(round3(totalSec));
  return cuts;
};
