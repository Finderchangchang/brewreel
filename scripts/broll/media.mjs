import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {TEMPLATE} from './root.mjs';

let cachedFf = null;
let cachedProbe = null;

const run = (bin, args) => spawnSync(bin, args, {encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024});

const remotionBin = (name) => {
  const dir = path.join(TEMPLATE, 'node_modules', '@remotion');
  if (!fs.existsSync(dir)) return null;
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  for (const folder of fs.readdirSync(dir)) {
    if (!folder.startsWith('compositor-')) continue;
    const p = path.join(dir, folder, exe);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

const pythonFfmpeg = () => {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const r = run(py, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']);
  const line = String(r.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .pop();
  return r.status === 0 && line && fs.existsSync(line) ? line : null;
};

/** 系统 PATH 里的 ffmpeg：能跑 -version 才算。 */
const systemFfmpeg = () => {
  const r = run('ffmpeg', ['-hide_banner', '-version']);
  return r.status === 0 && /ffmpeg version/i.test(String(r.stdout || '')) ? 'ffmpeg' : null;
};

/**
 * 完整版 ffmpeg（要 lavfi / drawtext / blackdetect / tile）。查找顺序：
 * FFMPEG 环境变量 → Python 的 imageio-ffmpeg → 系统 PATH 里的 ffmpeg → Remotion 自带的精简版（缺很多滤镜，只够转写抽音频）。
 * 精简版排最后：装了 Remotion 以后它总在，排前面会盖住用户自己装的完整版。
 */
export const ffmpegPath = () => {
  if (cachedFf) return cachedFf;
  if (process.env.FFMPEG && fs.existsSync(process.env.FFMPEG)) return (cachedFf = process.env.FFMPEG);
  const found = pythonFfmpeg();
  if (found) return (cachedFf = found);
  const sys = systemFfmpeg();
  if (sys) return (cachedFf = sys);
  const bundled = remotionBin('ffmpeg');
  if (bundled) return (cachedFf = bundled);
  return (cachedFf = 'ffmpeg');
};

/**
 * 出片要用到的滤镜和编码器：原片转码（scale / setsar / format）、占位片（color / geq / drawtext）、
 * 片段检查（fps / crop / blackdetect / freezedetect / select）、拼图（pad / concat / tile）。
 * 转写只用 aresample / silencedetect，Remotion 自带的精简版就够，不查。
 */
export const REQUIRED_FILTERS = ['scale', 'setsar', 'format', 'fps', 'crop', 'pad', 'concat', 'tile', 'color', 'geq', 'drawtext', 'blackdetect', 'freezedetect', 'select'];
export const REQUIRED_ENCODERS = ['libx264', 'aac'];

/** 解析 `ffmpeg -filters` / `-encoders` 的输出，返回名字集合。 */
export const parseFfmpegList = (text) => {
  const out = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^\s*[A-Z.|]{3,6}\s+([A-Za-z0-9_]+)\s/.exec(line);
    if (m && m[1] !== '=') out.add(m[1]);
  }
  return out;
};

let cachedCheck = null;
/**
 * 现在用的 ffmpeg 够不够出片。返回 {ok, path, missing[], bundled}。runner 只给测试用。
 * @param {{runner?: (bin: string, args: string[]) => {status: number, stdout?: string, stderr?: string}, bin?: string}} [opts]
 */
export const ffmpegCheck = (opts = {}) => {
  if (!opts.runner && !opts.bin && cachedCheck) return cachedCheck;
  const runner = opts.runner ?? run;
  const bin = opts.bin ?? ffmpegPath();
  const bundled = /[\\/]@remotion[\\/]compositor-/.test(bin);
  const f = runner(bin, ['-hide_banner', '-filters']);
  const e = runner(bin, ['-hide_banner', '-encoders']);
  let result;
  if (f.status !== 0 && !f.stdout) result = {ok: false, path: bin, missing: ['ffmpeg 本身'], bundled};
  else {
    const filters = parseFfmpegList(f.stdout);
    const encoders = parseFfmpegList(e.stdout);
    const missing = [...REQUIRED_FILTERS.filter((x) => !filters.has(x)), ...REQUIRED_ENCODERS.filter((x) => !encoders.has(x))];
    result = {ok: missing.length === 0, path: bin, missing, bundled};
  }
  if (!opts.runner && !opts.bin) cachedCheck = result;
  return result;
};

/** 缺完整版 ffmpeg 时给人看的话：缺什么、三种装法。 */
export const ffmpegHelp = (check) => {
  const what = check.missing.includes('ffmpeg 本身')
    ? '没找到能用的 ffmpeg'
    : `${check.bundled ? '现在用的是 Remotion 自带的精简版 ffmpeg' : `现在用的 ffmpeg（${check.path}）`}，缺 ${check.missing.join('、')}`;
  return [
    `出片要完整版 ffmpeg：${what}。三选一装好再跑同一条命令：`,
    '  ① pip install imageio-ffmpeg（推荐，装完不用设置）',
    '  ② 自己装 ffmpeg 并放进 PATH（Windows：winget install ffmpeg；macOS：brew install ffmpeg；Linux：apt install ffmpeg）',
    '  ③ 设环境变量 FFMPEG=完整版 ffmpeg 的路径',
    'Full ffmpeg is required: pip install imageio-ffmpeg, or put a full ffmpeg on PATH, or set FFMPEG=/path/to/ffmpeg.',
  ].join('\n');
};

/** ffmpeg 报错是不是因为缺滤镜 / 编码器（精简版 ffmpeg 的典型报错）。 */
export const isMissingFeature = (text) => /No such filter|Error parsing filterchain|Filter not found|Unknown encoder|Encoder not found/i.test(String(text || ''));

export const ffprobePath = () => {
  if (cachedProbe) return cachedProbe;
  if (process.env.FFPROBE && fs.existsSync(process.env.FFPROBE)) return (cachedProbe = process.env.FFPROBE);
  const bundled = remotionBin('ffprobe');
  if (bundled) return (cachedProbe = bundled);
  return (cachedProbe = 'ffprobe');
};

export const ffmpeg = (args) => run(ffmpegPath(), args);

/** 滤镜参数里的路径：正斜杠，盘符冒号转义。 */
export const ffmpegFilterPath = (p) => path.resolve(p).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

const fpsOf = (rate) => {
  const [a, b] = String(rate || '30/1').split('/').map(Number);
  let fps = b ? a / b : a;
  if (!Number.isFinite(fps) || fps <= 0) fps = 30;
  const rounded = Math.round(fps);
  if (Math.abs(fps - rounded) < 0.02) return rounded;
  return Math.round(fps * 100) / 100;
};

const parseProbe = (stdout) => {
  const text = String(stdout || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('没有 JSON');
  return JSON.parse(text.slice(start, end + 1));
};

export const probeMedia = (file) => {
  let last = '';
  let parsed = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
    last = `${r.stdout || ''}\n${r.stderr || ''}`;
    if (r.status !== 0 || !r.stdout) continue;
    try {
      parsed = parseProbe(r.stdout);
      break;
    } catch {
      parsed = null;
    }
  }
  if (!parsed) {
    const tail = last.trim().split(/\r?\n/).slice(-4).join(' / ');
    throw new Error(`ffprobe 失败：${tail || '没有输出'}`);
  }
  const j = parsed;
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  if (!v) throw new Error('ffprobe 没有找到视频流');
  const durationSec = Number(j.format?.duration ?? v.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('ffprobe 没有读到时长');
  // 手机竖拍常把画面存成横的、再加一个旋转标记：宽高按旋转之后（人看到的样子）算
  const rotation = rotationOf(v);
  const turned = Math.abs(rotation) % 180 === 90;
  const avgFps = rateOf(v.avg_frame_rate);
  const rFps = rateOf(v.r_frame_rate);
  return {
    width: turned ? v.height : v.width,
    height: turned ? v.width : v.height,
    fps: fpsOf(v.avg_frame_rate && v.avg_frame_rate !== '0/0' ? v.avg_frame_rate : v.r_frame_rate),
    durationSec,
    durationMs: Math.round(durationSec * 1000),
    hasAudio: Boolean(a),
    videoCodec: v.codec_name || '',
    pixFmt: v.pix_fmt || '',
    rotation,
    avgFps,
    rFps,
    // 可变帧率：标称帧率和平均帧率差 1% 以上（手机录像常见），或标称帧率高得离谱（时间基当帧率）
    vfr: Boolean(avgFps && rFps && (rFps > 240 || Math.abs(rFps - avgFps) / avgFps > 0.01)),
    audioCodec: a?.codec_name || '',
    audioChannels: Number(a?.channels) || 0,
  };
};

const rateOf = (rate) => {
  const [x, y] = String(rate || '').split('/').map(Number);
  const v = y ? x / y : x;
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** 视频流的旋转角度（0、90、180、-90…）：新版 ffprobe 在 side_data_list 的 Display Matrix 里，老版在 tags.rotate。 */
const rotationOf = (v) => {
  const side = (v.side_data_list || []).find((s) => s && Number.isFinite(Number(s.rotation)));
  const raw = side ? Number(side.rotation) : Number(v.tags?.rotate ?? 0);
  if (!Number.isFinite(raw)) return 0;
  const r = Math.round(raw) % 360;
  return r > 180 ? r - 360 : r <= -180 ? r + 360 : r;
};
