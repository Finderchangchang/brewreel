// ============================================================
// 交付相关的小工具（make.mjs 用）：清旧产物、算哈希、读 mp4 时长、写 / 核对 manifest.json。
// 目的：成片、拼图、检查帧必须和「这一次跑的这份分镜」绑在一起——报告里只能引用 manifest.json 里的路径。
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** make.mjs 写进输出目录的全部产物（开跑时清掉上一次的；目录里别的文件不动） */
export const PRODUCT_FILES = [
  'video.mp4',
  'video.rejected.mp4',
  'sheet.png',
  'sheet.rejected.png',
  'sheet-props.json',
  'props.json',
  'storyboard.json',
  'layout.json',
  'report.txt',
  'manifest.json',
  'bgm.wav',
  'DELIVERED.json',
  'video.meta.json',
];

/** 清掉上一次 make 在 outDir 留下的产物。keep 里的绝对路径（例如分镜源文件本身）永远不删。返回删掉的相对路径。 */
export const clearStaleOutputs = (outDir, keep = []) => {
  const keepSet = new Set(keep.map((p) => path.resolve(p).toLowerCase()));
  const removed = [];
  const rm = (abs) => {
    if (keepSet.has(path.resolve(abs).toLowerCase())) return;
    try {
      if (fs.existsSync(abs)) {
        fs.rmSync(abs, {force: true});
        removed.push(path.relative(outDir, abs));
      }
    } catch (e) {
      throw new Error(`清旧产物失败：${abs}（${e.code || e.message}），可能被播放器/看图软件占用，关掉后重跑`);
    }
  };
  for (const f of PRODUCT_FILES) rm(path.join(outDir, f));
  const check = path.join(outDir, 'check');
  if (fs.existsSync(check)) for (const f of fs.readdirSync(check)) if (/\.png$/i.test(f)) rm(path.join(check, f));
  return removed;
};

export const sha256Of = (bufOrFile) => {
  const h = crypto.createHash('sha256');
  if (Buffer.isBuffer(bufOrFile)) h.update(bufOrFile);
  else {
    const fd = fs.openSync(bufOrFile, 'r');
    try {
      const buf = Buffer.allocUnsafe(1 << 20);
      for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0; ) h.update(buf.subarray(0, n));
    } finally {
      fs.closeSync(fd);
    }
  }
  return h.digest('hex');
};

/** 读 mp4 的 moov/mvhd 拿总时长（秒），不依赖 ffprobe。读不出返回 null。 */
export const mp4Duration = (file) => {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const hdr = Buffer.alloc(16);
    const boxAt = (off) => {
      if (off + 8 > size) return null;
      fs.readSync(fd, hdr, 0, 16, off);
      let len = hdr.readUInt32BE(0);
      const type = hdr.toString('latin1', 4, 8);
      let head = 8;
      if (len === 1) {
        len = Number(hdr.readBigUInt64BE(8));
        head = 16;
      } else if (len === 0) len = size - off;
      if (len < head) return null;
      return {type, off, len, head};
    };
    const find = (from, to, type) => {
      for (let off = from; off < to; ) {
        const b = boxAt(off);
        if (!b) return null;
        if (b.type === type) return b;
        off += b.len;
      }
      return null;
    };
    const moov = find(0, size, 'moov');
    if (!moov) return null;
    const mvhd = find(moov.off + moov.head, moov.off + moov.len, 'mvhd');
    if (!mvhd) return null;
    const body = Buffer.alloc(32);
    fs.readSync(fd, body, 0, 32, mvhd.off + mvhd.head);
    const v = body.readUInt8(0);
    const [timescale, dur] = v === 1 ? [body.readUInt32BE(20), Number(body.readBigUInt64BE(24))] : [body.readUInt32BE(12), body.readUInt32BE(16)];
    return timescale ? dur / timescale : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
};

export const writeManifest = (outDir, manifest) => {
  const file = path.join(outDir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return file;
};

/**
 * 核对 outDir 里的成片是否还对应 sbPath 这份分镜（make.mjs --verify 用；测试脚本交付前也该调它）。
 * 返回 {ok, lines}
 */
export const verifyDelivery = (outDir, sbPath) => {
  const lines = [];
  const bad = (s) => lines.push(`  ✗ ${s}`);
  const good = (s) => lines.push(`  ✓ ${s}`);
  const mf = path.join(outDir, 'manifest.json');
  if (!fs.existsSync(mf)) {
    bad(`没有 ${mf}：这个目录没有一次跑完的 make，没有可交付的成片`);
    return {ok: false, lines};
  }
  let m;
  try {
    m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  } catch (e) {
    bad(`manifest.json 读不出来（${e.message}）`);
    return {ok: false, lines};
  }
  if (m.status !== 'delivered') bad(`manifest 状态是「${m.status}」${m.reason ? `：${m.reason}` : ''}，不是可交付的成片`);
  else good(`manifest 状态 delivered（${m.finishedAt}）`);
  if (sbPath) {
    const cur = sha256Of(fs.readFileSync(sbPath));
    if (cur !== m.storyboard?.sha256) bad(`成片和分镜不一致：${sbPath} 在出片之后改过（哈希变了），请重跑 make`);
    else good('分镜没改过，和出片时是同一份');
  }
  const v = m.video?.path;
  if (!v || !fs.existsSync(v)) bad(`manifest 里的成片 ${v ?? '（空）'} 不存在`);
  else if (sha256Of(v) !== m.video.sha256) bad(`成片 ${v} 在出片之后被替换过（哈希对不上），请重跑 make`);
  else good(`成片 ${v}（${m.video.durationSec?.toFixed?.(2) ?? '?'} 秒）哈希一致`);
  return {ok: !lines.some((l) => l.startsWith('  ✗')), lines};
};
