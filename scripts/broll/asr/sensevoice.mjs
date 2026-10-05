// 本地 SenseVoice（sherpa-onnx-node）：加载组件、建识别器、逐块识别，得到每个字/词片的绝对时间。
// sherpa-onnx-node 装在 template/node_modules（和其它 Node 依赖放一起），这里用 createRequire 从那里加载。
// 参数写死：useInverseTextNormalization 必须开（不开就没有标点）；auto 时 language 传空串。
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TEMPLATE} from '../root.mjs';
import {planChunks} from './audio.mjs';

export const SHERPA_VERSION = '1.13.8';

export class AsrRuntimeError extends Error {
  /** code：NO_PACKAGE 没装组件 / NEED_LIBPATH mac、Linux 要设库路径重启 / ADDON 原生库加载失败 / MODEL 模型加载失败 / EMPTY 没识别出字 */
  constructor(message, {code = 'ASR', libDir = '', libVar = ''} = {}) {
    super(message);
    this.name = 'AsrRuntimeError';
    this.code = code;
    this.libDir = libDir;
    this.libVar = libVar;
  }
}

const platformArch = () => `${process.platform === 'win32' ? 'win' : process.platform}-${process.arch}`;

/** mac 用 DYLD_LIBRARY_PATH，Linux 用 LD_LIBRARY_PATH；Windows 不需要。 */
export const libPathVar = (platform = process.platform) => (platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : platform === 'linux' ? 'LD_LIBRARY_PATH' : '');
export const sherpaLibDir = () => path.join(TEMPLATE, 'node_modules', `sherpa-onnx-${platformArch()}`);

let cachedSherpa = null;

export const loadSherpa = () => {
  if (cachedSherpa) return cachedSherpa;
  const req = createRequire(path.join(TEMPLATE, 'package.json'));
  try {
    req.resolve('sherpa-onnx-node');
  } catch {
    throw new AsrRuntimeError(
      `缺转写组件 sherpa-onnx-node。在 template 目录跑 npm install（或 npm install sherpa-onnx-node@${SHERPA_VERSION}）后再试；也可以自己放一个 talk.srt 跳过转写。`,
      {code: 'NO_PACKAGE'},
    );
  }
  try {
    cachedSherpa = req('sherpa-onnx-node');
    return cachedSherpa;
  } catch (e) {
    const libVar = libPathVar();
    const libDir = sherpaLibDir();
    if (libVar && !String(process.env[libVar] || '').includes(libDir)) {
      throw new AsrRuntimeError(`加载 sherpa-onnx 原生库失败，需要设置 ${libVar}=${libDir} 后重新启动。`, {code: 'NEED_LIBPATH', libDir, libVar});
    }
    const first = String(e?.message || e).split('\n')[0];
    const hint =
      process.platform === 'win32'
        ? 'Windows 上多半是缺「Microsoft Visual C++ 2015-2022 运行库（x64）」，到微软官网装上再试；或者在 template 目录重新跑 npm install。'
        : `确认 template/node_modules 下有 sherpa-onnx-${platformArch()} 目录（npm install 会装），并设置 ${libVar}=${libDir}。`;
    throw new AsrRuntimeError(`加载 sherpa-onnx 原生库失败（${first}）。${hint}也可以自己放一个 talk.srt 跳过转写。`, {code: 'ADDON', libDir, libVar});
  }
};

/** '<|zh|>' → 'zh' */
export const langOf = (raw) => String(raw || '').replace(/[<|>]/g, '').trim();

export const createRecognizer = (sherpa, files, lang = 'auto') => {
  try {
    return new sherpa.OfflineRecognizer({
      featConfig: {sampleRate: 16000, featureDim: 80},
      modelConfig: {
        senseVoice: {model: files.model, language: lang === 'auto' ? '' : lang, useInverseTextNormalization: 1},
        tokens: files.tokens,
        numThreads: Math.max(1, Math.min(4, os.cpus().length || 1)),
        provider: 'cpu',
        debug: 0,
      },
    });
  } catch (e) {
    throw new AsrRuntimeError(`加载转写模型失败（${String(e?.message || e).split('\n')[0]}）。模型文件可能损坏：删掉 ${path.dirname(files.model)} 后重跑会重新下载。`, {code: 'MODEL'});
  }
};

/**
 * 读 16k wav，按静音切块，逐块识别。
 * @param {{wavPath: string, silences: Array<{start: number, end: number}>, files: {model: string, tokens: string}, lang?: string, log?: (s: string) => void}} args
 * @returns {{audioSec: number, chunks: number[], tokens: string[], times: number[], breaks: number[], chunkLangs: string[], detected: string}}
 *   breaks：每块第一个 token 在 tokens 里的下标（切句时要强制作为新词开头）。
 */
export const recognizeWav = ({wavPath, silences = [], files, lang = 'auto', log = console.log}) => {
  if (!fs.existsSync(wavPath)) throw new AsrRuntimeError('临时音频文件不见了。', {code: 'ASR'});
  const sherpa = loadSherpa();
  const recognizer = createRecognizer(sherpa, files, lang);
  const wave = sherpa.readWave(wavPath);
  const sr = wave.sampleRate;
  const audioSec = wave.samples.length / sr;
  const chunks = planChunks(audioSec, silences);
  const tokens = [];
  const times = [];
  const breaks = [];
  const chunkLangs = [];
  const weight = {};
  const n = chunks.length - 1;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, Math.floor(chunks[i] * sr));
    const b = Math.min(wave.samples.length, Math.ceil(chunks[i + 1] * sr));
    if (b - a < sr * 0.1) continue;
    const stream = recognizer.createStream();
    stream.acceptWaveform({samples: wave.samples.subarray(a, b), sampleRate: sr});
    recognizer.decode(stream);
    const res = recognizer.getResult(stream);
    const l = langOf(res.lang);
    chunkLangs.push(l);
    const toks = res.tokens || [];
    const ts = res.timestamps || [];
    if (toks.length) breaks.push(tokens.length);
    const off = a / sr;
    toks.forEach((t, k) => {
      tokens.push(t);
      times.push(Math.round((Number(ts[k] ?? 0) + off) * 1000) / 1000);
    });
    const real = toks.filter((t) => t.trim()).length;
    if (l) weight[l] = (weight[l] || 0) + real;
    if (n > 1) log(`  识别 ${i + 1}/${n} 块（${chunks[i].toFixed(1)}–${chunks[i + 1].toFixed(1)} 秒）`);
  }
  const detected = Object.entries(weight).sort((x, y) => y[1] - x[1])[0]?.[0] || '';
  return {audioSec: Math.round(audioSec * 1000) / 1000, chunks, tokens, times, breaks, chunkLangs, detected};
};
