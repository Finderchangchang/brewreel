// ============================================================
// 最小 WAV 读写（PCM 16-bit）：mock 配音生成占位音、读配音时长用。零依赖。
// ============================================================
import fs from 'node:fs';

/** Float32/number 数组（-1..1，单声道）→ 16-bit PCM WAV Buffer */
export const encodeWav = (samples, sampleRate) => {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
};

/** 读 WAV 头：{sampleRate, channels, bits, durMs}；不是 WAV 返回 null。遍历 chunk，兼容 LIST 等附加块 */
export const wavInfo = (bufOrFile) => {
  let buf = bufOrFile;
  try {
    if (typeof bufOrFile === 'string') buf = fs.readFileSync(bufOrFile);
  } catch {
    return null;
  }
  if (!Buffer.isBuffer(buf) || buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let pos = 12;
  let fmt = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    let size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ' && body + 16 <= buf.length) {
      fmt = {channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), byteRate: buf.readUInt32LE(body + 8), bits: buf.readUInt16LE(body + 14)};
    } else if (id === 'data' && fmt) {
      // 流式写出的 WAV 有时 data 长度写成 0 或 0xFFFFFFFF：按文件剩余长度算
      if (!size || size === 0xffffffff || body + size > buf.length) size = buf.length - body;
      return {...fmt, dataBytes: size, durMs: fmt.byteRate ? (size / fmt.byteRate) * 1000 : 0};
    }
    pos = body + size + (size % 2);
  }
  return null;
};

/** 读 16-bit PCM 单/双声道 WAV 成单声道 Float32Array（测试用） */
export const decodeWav = (buf) => {
  const info = wavInfo(buf);
  if (!info || info.bits !== 16) return null;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'data') {
      const frames = Math.floor(info.dataBytes / (2 * info.channels));
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < info.channels; c++) s += buf.readInt16LE(pos + 8 + (i * info.channels + c) * 2);
        out[i] = s / info.channels / 32768;
      }
      return {samples: out, sampleRate: info.sampleRate};
    }
    pos += 8 + size + (size % 2);
  }
  return null;
};

/**
 * 估算 MP3 时长（毫秒）：逐帧扫帧头累加（CBR / VBR 都对，跳过开头的 ID3）。拿不到返回 null。
 * 只在接口没给 extra_info.audio_length、也没 ffmpeg 转码时兜底用。
 */
export const mp3DurationMs = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  let pos = 0;
  if (buf.toString('ascii', 0, 3) === 'ID3' && buf.length > 10) pos = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  const BR = {
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG1 Layer III
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG2/2.5 Layer III
  };
  const SR = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]};
  let ms = 0;
  let frames = 0;
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff || (buf[pos + 1] & 0xe0) !== 0xe0) {
      pos++;
      continue;
    }
    const ver = (buf[pos + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (buf[pos + 1] >> 1) & 3; // 1 = Layer III
    const bri = (buf[pos + 2] >> 4) & 15;
    const sri = (buf[pos + 2] >> 2) & 3;
    const pad = (buf[pos + 2] >> 1) & 1;
    if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) {
      pos++;
      continue;
    }
    const kbps = BR[ver === 3 ? 1 : 2][bri];
    const sr = SR[ver][sri];
    const spf = ver === 3 ? 1152 : 576;
    const len = Math.floor(((ver === 3 ? 144 : 72) * kbps * 1000) / sr) + pad;
    if (len < 4) break;
    ms += (spf / sr) * 1000;
    frames++;
    pos += len;
  }
  return frames ? ms : null;
};
