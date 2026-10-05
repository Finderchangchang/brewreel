// 转写模型注册表 + 下载。模型是全局缓存，所有项目共用。
// 版本和哈希写死：同一个 release 里还有一个 2025-09-09 的粤语微调版，选错会乱，所以只认这里列的文件。
// 缓存目录：Windows %LOCALAPPDATA%\brewreel\asr，mac/Linux ~/.cache/brewreel/asr。
//   BREWREEL_ASR_DIR        改缓存根目录（模型放在 <根目录>/<模型ID>/ 下）
//   BREWREEL_ASR_MODEL_DIR  直接指定手动下载好的目录（里面放 model.int8.onnx 和 tokens.txt），不下载
// 下载：先写 <文件>.part，用 Range 断点续传，sha256 对上才改名；哈希不对就删掉换下一个源。
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_MODEL = 'sensevoice-int8-20240717';

export const MODELS = {
  'sensevoice-int8-20240717': {
    id: 'sensevoice-int8-20240717',
    engine: 'local',
    label: 'SenseVoice Small int8 2024-07-17（FunAudioLLM / 阿里通义实验室，sherpa-onnx 转换）',
    languages: ['auto', 'zh', 'en', 'yue', 'ja', 'ko'],
    files: {
      model: {name: 'model.int8.onnx', bytes: 239233841, sha256: 'c71f0ce00bec95b07744e116345e33d8cbbe08cef896382cf907bf4b51a2cd51'},
      tokens: {name: 'tokens.txt', bytes: 315894, sha256: 'f449eb28dc567533d7fa59be34e2abca8784f771850c78a47fb731a31429a1dc'},
    },
    // 按顺序试。魔搭这个仓库是第三方上传，但两个文件的哈希已核对和官方一致；哈希不对的文件一律拒收。
    sources: [
      {name: '魔搭 ModelScope', url: 'https://modelscope.cn/models/poloniumrock/SenseVoiceSmallOnnx/resolve/master/{file}'},
      {name: 'HuggingFace（官方 csukuangfj）', url: 'https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/{file}'},
      {name: 'hf-mirror.com', url: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/{file}'},
    ],
  },
};

export class AsrModelError extends Error {
  constructor(message, {attempts = [], dir = ''} = {}) {
    super(message);
    this.name = 'AsrModelError';
    this.attempts = attempts;
    this.dir = dir;
  }
}

export const modelOf = (id = DEFAULT_MODEL) => {
  const m = MODELS[id];
  if (!m) throw new AsrModelError(`没有叫 ${id} 的转写模型。现在只有 ${Object.keys(MODELS).join('、')}。`);
  return m;
};

/** 缓存根目录。env 可注入，方便测试。 */
export const asrCacheRoot = (env = process.env, platform = process.platform) => {
  if (env.BREWREEL_ASR_DIR) return path.resolve(env.BREWREEL_ASR_DIR);
  if (platform === 'win32') {
    const base = env.LOCALAPPDATA || path.join(env.USERPROFILE || os.homedir(), '.cache');
    return path.join(base, 'brewreel', 'asr');
  }
  const base = env.XDG_CACHE_HOME || path.join(env.HOME || os.homedir(), '.cache');
  return path.join(base, 'brewreel', 'asr');
};

/** 模型文件应该在哪个目录。manual=true 表示用户用 BREWREEL_ASR_MODEL_DIR 指定，不往里下载。 */
export const modelDirOf = (id = DEFAULT_MODEL, env = process.env, platform = process.platform) => {
  if (env.BREWREEL_ASR_MODEL_DIR) return {dir: path.resolve(env.BREWREEL_ASR_MODEL_DIR), manual: true};
  return {dir: path.join(asrCacheRoot(env, platform), id), manual: false};
};

export const sha256FileStream = (file) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    fs.createReadStream(file, {highWaterMark: 4 * 1024 * 1024})
      .on('data', (b) => h.update(b))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });

// 校验过的文件记一笔（大小 + 修改时间 + 哈希），下次不用再算 240MB 的哈希。
const stampFile = (dir) => path.join(dir, '.verified.json');
const readStamp = (dir) => {
  try {
    return JSON.parse(fs.readFileSync(stampFile(dir), 'utf8'));
  } catch {
    return {};
  }
};
const writeStamp = (dir, stamp) => {
  try {
    fs.writeFileSync(stampFile(dir), JSON.stringify(stamp, null, 2), 'utf8');
  } catch {
    // 目录只读（比如用户手动指定的目录）就不记，下次再算一遍哈希。
  }
};

/** 文件在不在、大小和哈希对不对。返回 {ok, why, entry}；entry 可以直接记进 .verified.json。 */
export const verifyFile = async (file, spec, stamp = null) => {
  if (!fs.existsSync(file)) return {ok: false, why: '文件不存在'};
  const st = fs.statSync(file);
  if (spec.bytes && st.size !== spec.bytes) return {ok: false, why: `大小不对（${st.size} 字节，应为 ${spec.bytes} 字节）`};
  const key = path.basename(file);
  const s = stamp?.[key];
  if (s && s.bytes === st.size && s.mtimeMs === st.mtimeMs && s.sha256 === spec.sha256) return {ok: true, why: '已校验', entry: s};
  const got = await sha256FileStream(file);
  if (got !== spec.sha256) return {ok: false, why: `sha256 不对（${got.slice(0, 12)}…，应为 ${spec.sha256.slice(0, 12)}…）`};
  const entry = {bytes: st.size, mtimeMs: st.mtimeMs, sha256: got};
  if (stamp) stamp[key] = entry;
  return {ok: true, why: '哈希一致', entry};
};

const fmtMb = (n) => `${(n / 1e6).toFixed(1)}MB`;

/**
 * 下载一个文件到 dest（经 dest.part 续传）。成功返回校验记录 {bytes, mtimeMs, sha256}，失败抛错（错误信息给人看）。
 * 服务器不认 Range（回 200）就从头写；回 416 说明 .part 已经够长，交给哈希判断。
 */
export const downloadOne = async (url, dest, spec, {fetchImpl = fetch, log = console.log, idleMs = 30_000, label = ''} = {}) => {
  const part = `${dest}.part`;
  let have = fs.existsSync(part) ? fs.statSync(part).size : 0;
  if (spec.bytes && have > spec.bytes) {
    fs.rmSync(part, {force: true});
    have = 0;
  }
  if (!(spec.bytes && have === spec.bytes)) {
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), idleMs);
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => ctrl.abort(), idleMs);
    };
    try {
      const headers = {'User-Agent': 'brewreel-asr'};
      if (have > 0) headers.Range = `bytes=${have}-`;
      const res = await fetchImpl(url, {headers, redirect: 'follow', signal: ctrl.signal});
      if (res.status === 416) {
        // .part 已经是完整长度（或服务器不认这个区间），下面按哈希判断
      } else if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      } else {
        const resumed = res.status === 206 && have > 0;
        if (!resumed) have = 0;
        const total = spec.bytes || Number(res.headers.get('content-length') || 0) + have;
        if (resumed) log(`  ${label}从 ${fmtMb(have)} 处续传`);
        const out = fs.createWriteStream(part, {flags: resumed ? 'a' : 'w'});
        let got = have;
        // 每 5% 打一次进度；小文件（tokens.txt）不打
        let nextMark = total >= 5e6 ? Math.floor((got / total) * 20) + 1 : Infinity;
        try {
          if (!res.body) throw new Error('没有响应体');
          for await (const chunk of res.body) {
            bump();
            if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
            got += chunk.length;
            if (total && got / total >= nextMark / 20) {
              log(`  ${label}${Math.min(100, Math.floor((got / total) * 100))}%（${fmtMb(got)} / ${fmtMb(total)}）`);
              nextMark = Math.floor((got / total) * 20) + 1;
            }
          }
        } finally {
          await new Promise((r) => out.end(r));
        }
      }
    } catch (e) {
      const why = e?.name === 'AbortError' ? `${Math.round(idleMs / 1000)} 秒没有收到数据` : e?.cause?.code || e?.message || String(e);
      throw new Error(why);
    } finally {
      clearTimeout(timer);
    }
  }
  const v = await verifyFile(part, spec);
  if (!v.ok) {
    fs.rmSync(part, {force: true});
    throw new Error(`下载的文件${v.why}，已删除`);
  }
  fs.renameSync(part, dest);
  return v.entry;
};

/**
 * 确保模型文件齐全，缺了就下载。
 * @param {string} [id]
 * @param {{env?: object, platform?: string, fetchImpl?: typeof fetch, log?: (s: string) => void, sources?: Array<{name: string, url: string}>, idleMs?: number, spec?: object}} [opts]
 *   spec：直接给一份注册表条目（测试用小文件），不查 MODELS。
 * @returns {Promise<{id: string, dir: string, manual: boolean, model: string, tokens: string, downloaded: boolean}>}
 * 失败抛 AsrModelError，message 是给人看的完整说明（试过的地址、各自的错误、怎么手动下载）。
 */
export const ensureModel = async (id = DEFAULT_MODEL, opts = {}) => {
  const {env = process.env, platform = process.platform, fetchImpl = fetch, log = console.log, idleMs = 30_000} = opts;
  const m = opts.spec || modelOf(id);
  const sources = opts.sources || m.sources;
  const {dir, manual} = modelDirOf(m.id || id, env, platform);
  const specs = Object.values(m.files);
  const paths = {model: path.join(dir, m.files.model.name), tokens: path.join(dir, m.files.tokens.name)};
  const manualHint = () =>
    [
      `可以手动下载这两个文件，放进 ${dir}：`,
      ...specs.map((s) => `  ${s.name}（${s.bytes.toLocaleString('en-US')} 字节，sha256 ${s.sha256}）`),
      `  地址任选其一：${sources.map((s) => s.url.replace('{file}', '<文件名>')).join('  或  ')}`,
      '或者把已经下载好的目录设成环境变量 BREWREEL_ASR_MODEL_DIR。',
      '也可以不转写：自己放一个 talk.srt（比如剪映导出的字幕）到项目目录。',
    ].join('\n');

  if (manual) {
    if (!fs.existsSync(dir)) throw new AsrModelError(`BREWREEL_ASR_MODEL_DIR 指向的目录不存在：${dir}\n${manualHint()}`, {dir});
    const stamp = readStamp(dir);
    for (const s of specs) {
      const v = await verifyFile(path.join(dir, s.name), s, stamp);
      if (!v.ok) throw new AsrModelError(`BREWREEL_ASR_MODEL_DIR 里的 ${s.name} ${v.why}。\n${manualHint()}`, {dir});
    }
    writeStamp(dir, stamp);
    return {id: m.id || id, dir, manual, ...paths, downloaded: false};
  }

  fs.mkdirSync(dir, {recursive: true});
  const stamp = readStamp(dir);
  const missing = [];
  for (const s of specs) {
    const v = await verifyFile(path.join(dir, s.name), s, stamp);
    if (!v.ok) {
      if (fs.existsSync(path.join(dir, s.name))) fs.rmSync(path.join(dir, s.name), {force: true});
      missing.push(s);
    }
  }
  writeStamp(dir, stamp);
  if (!missing.length) return {id: m.id || id, dir, manual, ...paths, downloaded: false};

  const totalBytes = missing.reduce((n, s) => n + s.bytes, 0);
  log(`第一次转写要下载模型（约 ${fmtMb(totalBytes)}，只下这一次，所有项目共用），存到 ${dir}`);
  const attempts = [];
  for (const s of missing) {
    const dest = path.join(dir, s.name);
    let ok = false;
    for (const src of sources) {
      const url = src.url.replace('{file}', s.name);
      log(`  下载 ${s.name}，来源：${src.name}`);
      try {
        stamp[s.name] = await downloadOne(url, dest, s, {fetchImpl, log, idleMs, label: `${s.name} `});
        writeStamp(dir, stamp);
        ok = true;
        break;
      } catch (e) {
        attempts.push({file: s.name, source: src.name, url, error: String(e?.message || e)});
        log(`  ${src.name} 失败：${e?.message || e}，换下一个地址`);
      }
    }
    if (!ok) {
      const lines = attempts.filter((a) => a.file === s.name).map((a) => `  ${a.url}\n    → ${a.error}`);
      throw new AsrModelError([`模型文件 ${s.name} 下载失败，试过的地址：`, ...lines, manualHint()].join('\n'), {attempts, dir});
    }
  }
  log('  模型下载完成，哈希校验通过');
  return {id: m.id || id, dir, manual, ...paths, downloaded: true};
};
