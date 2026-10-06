// 风格工厂：一句话 → 草稿风格包 → 出参考图 → 看图打分 → 挑图 → 静态试拍 →（可选）视频试拍。
// 产物在 broll/styles/_drafts/<id>/。人看完 review.html 自己跑 approve-style.mjs。
// AI 助手不许替人运行 approve-style。
// 没有 --yes 只打印将要发送的请求，不调接口。视频试拍要同时有 --video 和 --yes。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {extractFramesEvery} from './frames.mjs';
import {extractJson, callLlm, readLlmEnv, explainLlmError, redactSecrets} from './llm-client.mjs';
import {ffmpegPath} from './media.mjs';
import {candName, generateRefImage, planRefJobs} from './make-style-refs.mjs';
import {DESCRIBE_PROMPT, IP_GROUP, buildVisionBody, describeImage, jpegDataUrl, judgeImage, redactVisionBody, visionModelOf} from './judge.mjs';
import {clipCost, creditsOf} from './prices.mjs';
import {ALL_CAMERAS, ALL_JOBS, buildPromptV2, findLeaks, lintStyle, loadCharacter, readStyles, refListOf} from './prompt.mjs';
import {buildImageBody, buildVideoBody, createH3Client, redactBody, resolveBase, IMAGE_MODEL, VIDEO_MODEL} from './providers/minimax-h3.mjs';
import {ROOT} from './root.mjs';

export class FactoryError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'FactoryError';
    this.exitCode = exitCode;
  }
}

const ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const REF_FILES = ['refs/character.jpg', 'refs/material.jpg'];
const REF_HUMAN_SKIP = '参考图有项目模型没答完，需要人看';
const SHAPE_LEAK = [/天线/, /antenna/i, /\bmouth\b/i, /嘴巴/, /没有嘴/, /有嘴/, /旋钮/, /螺栓/];
const DRAFT_TEMPERATURE = 0.3;
export const TEST_ACTION = '把一块方块推到桌面中间';
export const TEST_END = '方块停在桌面中间';
export const VIDEO_SEC = 4;
export const VIDEO_QUALITY = '768P';
const HUMAN = 'AI 助手不许替人运行 approve-style。这一步只能人自己跑。';

export const draftDirOf = (root, id) => path.join(root, 'broll', 'styles', '_drafts', id);
export const publishedDirOf = (root, id) => path.join(root, 'broll', 'styles', id);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
/** 先写临时文件再改名。Windows 上目标已存在时，先把旧文件挪开再换上新的。 */
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch {
    const old = `${file}.${process.pid}.old`;
    try {
      fs.rmSync(old, {force: true});
    } catch {
      /* 旧的中转文件清不掉也继续试 */
    }
    fs.renameSync(file, old);
    try {
      fs.renameSync(tmp, file);
    } catch (e) {
      try {
        fs.renameSync(old, file);
      } catch {
        /* 换不回去就留下 .old，原来的内容还在 */
      }
      throw e;
    }
    fs.rmSync(old, {force: true});
  }
};

const realpathOf = (file) => {
  const resolved = path.resolve(String(file));
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return fs.realpathSync(resolved);
  }
};

const pathContains = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
};

/**
 * 测试绕过不再看 os.tmpdir()（那个值会被 TEMP/TMP 改掉）。
 * root 按 realpath 比较：不能等于仓库根，不能包含仓库根，也不能是仓库根下面的目录。
 * 目录名还要以 brewreel-approve-test- 开头。
 */
export const approveTestRootOk = (root) => {
  if (!root) return false;
  let target;
  let repo;
  try {
    target = realpathOf(root);
    repo = realpathOf(ROOT);
  } catch {
    return false;
  }
  if (pathContains(target, repo) || pathContains(repo, target)) return false;
  return path.basename(target).startsWith('brewreel-approve-test-');
};

const STATE_FLAG = Symbol('stateFlag');
const BAD_STATE_RE = /^state\.json\.bad-/;

const badStateNames = (dir) => {
  try {
    return fs.readdirSync(dir).filter((name) => BAD_STATE_RE.test(name) && !name.includes('.checked-'));
  } catch {
    return [];
  }
};

/** 人检查过坏备份之后，把 state.json.bad-* 改名为 .checked-<时间>。没检查过就拒绝。 */
const settleBadBackups = (dir, {stateReset, log}) => {
  const names = badStateNames(dir);
  if (!names.length) return;
  if (!stateReset) {
    throw new FactoryError(`草稿里还有损坏的 state 备份：${names.join('、')}。请先检查这些文件，确认没有未记录的付费任务，再加 --state-reset。这次不会出图，也不会提交视频。`, 2);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const name of names) fs.renameSync(path.join(dir, name), path.join(dir, `${name}.checked-${stamp}`));
  log(`已按 --state-reset 把坏状态备份改名为 .checked-${stamp}，继续。`);
};

const hasPaidArtifacts = (dir) => {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let names;
    try {
      names = fs.readdirSync(cur);
    } catch {
      continue;
    }
    for (const name of names) {
      const abs = path.join(cur, name);
      let st;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (/\.(?:jpe?g|png|webp|mp4|webm)$/i.test(name)) return true;
    }
  }
  return false;
};

/** {}、缺 stages，或 state.json 已经没了，但出图 / 视频还在：疑似被清空。 */
const assertNotWiped = (dir, state, {stateReset, log}) => {
  const why = state[STATE_FLAG];
  if (!why || !hasPaidArtifacts(dir)) return;
  if (stateReset) {
    log('已加 --state-reset，state 疑似被清空，按检查过继续。');
    return;
  }
  const detail = why === 'missing' ? 'state.json 不在了' : why === 'empty' ? 'state.json 是空对象 {}' : 'state.json 缺 stages';
  throw new FactoryError(`${detail}，但草稿目录里已经有出图或视频，疑似被清空。先检查这些产物，确认没有未记录的付费任务，再加 --state-reset。这次不会出图，也不会提交视频。`, 2);
};

const pidAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** 草稿目录独占锁。活着的 pid 拒绝；死掉的当残留锁删掉再占。 */
const acquireDraftLock = (draftDir) => {
  const lockPath = path.join(draftDir, 'run.lock');
  let owned = false;
  const writeLock = () => {
    const fd = fs.openSync(lockPath, 'wx');
    try {
      fs.writeFileSync(fd, `${JSON.stringify({pid: process.pid, at: new Date().toISOString()})}\n`, 'utf8');
    } finally {
      fs.closeSync(fd);
    }
    owned = true;
  };
  const tryWrite = () => {
    try {
      writeLock();
      return true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      return false;
    }
  };
  if (!tryWrite()) {
    let pid = 0;
    try {
      pid = Number(JSON.parse(fs.readFileSync(lockPath, 'utf8')).pid);
    } catch {
      pid = 0;
    }
    if (pidAlive(pid)) throw new FactoryError('这个风格正在另一个进程里跑', 2);
    fs.rmSync(lockPath, {force: true});
    if (!tryWrite()) throw new FactoryError('这个风格正在另一个进程里跑', 2);
  }
  return {
    release() {
      if (!owned) return;
      owned = false;
      try {
        const cur = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        if (Number(cur.pid) !== process.pid) return;
      } catch {
        /* 读不到也按自己占的锁清掉 */
      }
      try {
        fs.rmSync(lockPath, {force: true});
      } catch {
        /* 锁已经没了 */
      }
    },
  };
};

/** 服务端明确拒绝才算没提交。网络断开、超时、5xx 仍算结果不明。 */
const submitWasRefused = (error) => {
  const code = error && typeof error === 'object' ? error.code : '';
  const http = error && Number.isInteger(error.http) ? error.http : null;
  const api = error && Number.isInteger(error.apiCode) ? error.apiCode : null;
  if (code === 'NETWORK' || code === 'SUBMIT_UNKNOWN' || code === 'SERVER') return false;
  if (http != null && (http >= 500 || http === 408)) return false;
  if (api === 1000 || api === 1001) return false;
  if (code === 'BALANCE' || code === 'AUTH' || code === 'MODERATION' || code === 'API' || code === 'BAD_REQUEST' || code === 'RATE' || code === 'NO_KEY' || code === 'NO_REFS') return true;
  if (http != null && http >= 400 && http < 500) return true;
  if (api != null && api !== 0) return true;
  return false;
};

const refusedSubmitMessage = (error) => {
  const http = Number.isInteger(error?.http) ? error.http : null;
  const api = Number.isInteger(error?.apiCode) ? error.apiCode : null;
  const code = error?.code || '';
  const mark = api ?? http ?? '';
  const where = mark === '' ? '' : `（${mark}）`;
  if (code === 'BALANCE' || api === 1008 || /余额|insufficient|balance/i.test(String(error?.message || ''))) {
    return `余额不足${where}。去 MiniMax 充值之后，直接重跑同一条命令即可，不用加 --video-redo。这次提交被拒绝，没有留下提交标记。`;
  }
  if (code === 'AUTH' || http === 401 || http === 403 || api === 1004 || api === 2049) {
    return `鉴权失败${where}。检查 MINIMAX_API_KEY。这次提交被拒绝，没有留下提交标记，改好之后直接重跑即可，不用加 --video-redo。`;
  }
  return `提交被拒绝${where}：${error?.message || code}。这次没有留下提交标记，可以直接重跑，不用加 --video-redo。`;
};

/** 写盘前：key 原文打码，草稿目录的绝对路径改成相对草稿目录。 */
const scrubText = (text, {draftDir, env}) => {
  let s = redactSecrets(text, env);
  if (!draftDir) return s;
  const abs = path.resolve(draftDir);
  for (const variant of [abs, abs.replace(/\\/g, '/'), abs.replace(/\//g, '\\')]) {
    if (variant.length >= 3) s = s.split(variant).join('.');
  }
  return s;
};

const scrubValue = (value, ctx) => {
  if (typeof value === 'string') return scrubText(value, ctx);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, ctx));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = scrubValue(value[key], ctx);
    return out;
  }
  return value;
};

const ffmpegIsReady = () => {
  try {
    const probe = spawnSync(ffmpegPath(), ['-hide_banner', '-version'], {encoding: 'utf8', windowsHide: true});
    return probe.status === 0;
  } catch {
    return false;
  }
};

/** 正好两张，顺序角色然后材质。文件名、role、aspect 都要对。 */
const refsAreCanonical = (style) => {
  const refs = refListOf(style);
  if (refs.length !== 2) return false;
  const [character, material] = refs;
  return character?.file === 'refs/character.jpg' && character?.role === '角色' && character?.aspect === '1:1'
    && material?.file === 'refs/material.jpg' && material?.role === '材质' && material?.aspect === '16:9';
};

export const loadIpWords = (root = ROOT) => {
  try {
    const group = readJson(path.join(root, 'broll', 'banned-words.json'))?.groups?.ip;
    if (Array.isArray(group) && group.length) return group.map(String);
  } catch {
    /* 用内置名单 */
  }
  return [...IP_GROUP];
};

/** 文本里命中的 IP 词（ASCII 不分大小写，同一词的大小写变体只算一次）。 */
export const ipHits = (text, words) => {
  const raw = String(text ?? '');
  const lower = raw.toLowerCase();
  const seen = new Set();
  const hits = [];
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    const ascii = /^[\x00-\x7F]+$/.test(word);
    if (ascii ? lower.includes(key) : raw.includes(word)) {
      seen.add(key);
      hits.push(word);
    }
  }
  return hits;
};

const styleBlob = (style) => {
  const parts = [];
  for (const key of ['look', 'lookV2', 'character', 'characterEn', 'ground', 'name', 'nameEn', 'summary', 'summaryEn', 'forbid', 'forbidV2']) {
    if (typeof style?.[key] === 'string') parts.push(style[key]);
  }
  if (style?.camera && typeof style.camera === 'object') parts.push(...Object.values(style.camera).filter((s) => typeof s === 'string'));
  if (Array.isArray(style?.materialWords)) parts.push(style.materialWords.join('\n'));
  for (const ref of refListOf(style)) if (typeof ref.prompt === 'string') parts.push(ref.prompt);
  return parts.join('\n');
};

/**
 * lintStyle 再加 IP 词和「反着写的形状词」（天线、嘴）。空数组就是能用。
 * @returns {string[]}
 */
export const styleProblems = (style, id, ctx = {}) => {
  const problems = lintStyle(style, id, ctx);
  if (!refsAreCanonical(style)) problems.push(`${id}：refs 必须正好两张，顺序是角色然后材质：refs/character.jpg（角色，1:1）和 refs/material.jpg（材质，16:9）。`);
  const hits = ipHits(styleBlob(style), ctx.ipWords ?? IP_GROUP);
  if (hits.length) problems.push(`${id}：写进了作品或品牌名 ${hits.join('、')}。删掉这些词，只写画面本身。`);
  const visual = [style?.look, style?.character, style?.characterEn, style?.ground, ...refListOf(style).map((r) => r.prompt)].filter((s) => typeof s === 'string').join('\n');
  const shape = [];
  for (const re of SHAPE_LEAK) {
    const m = visual.match(re);
    if (m && !shape.includes(m[0])) shape.push(m[0]);
  }
  if (shape.length) problems.push(`${id}：描述或出图提示里写了「${shape.join('、')}」。只写想看到的（头顶是光滑圆顶、脸的下半部分是光滑的），不要写反着的禁用描述。`);
  return problems;
};

const fillDefaults = (style, {id, name}) => {
  const out = style && typeof style === 'object' && !Array.isArray(style) ? {...style} : {};
  out.id = id;
  if (typeof name === 'string' && name.trim()) out.name = name.trim();
  out.status = 'experimental';
  out.default = false;
  out.pairsWith = [];
  if (out.promptExpansion == null) out.promptExpansion = 'disabled';
  if (typeof out.freezeNoise !== 'number') out.freezeNoise = 0.003;
  return out;
};

const systemPrompt = () => `你给精酿 BrewReel 写一个画面风格包，只输出一个 JSON 对象（style.json），不要 markdown。
规则：
- 只写想看到的东西。不要写「不要天线」「no studs」「no mouth」这种反着的话，那些词本身就会把画面带偏。天线、antenna、嘴、mouth、凸点、stud、lego、品牌和作品名，一个都不要出现。
- 角色图的英文 prompt 用 {character} 占位（不要自己写色号），并正面写明 the top of the head is one smooth round dome，each hand is one solid round ball。
- 材质图的英文 prompt 写没有角色的空场景，里面至少有三件看得清的物件，不要几乎空白。
- forbid 只写这一句：画面里没有文字、字母、数字、商标和真实人物，没有人声对白。
- pairsWith 写 []。status 写 experimental，default 写 false。promptExpansion 写 disabled。
- jobs 从 ${ALL_JOBS.join('、')} 里选，不能空。cameras 从 ${ALL_CAMERAS.join('、')} 里选，不能空。camera 里给每个运镜一句中文。
- materialWords 至少一个，写这个风格自己的材质词。
- motionTheme.look 只能是 wood、clay、paper、ink 之一。剪纸外观 cutpaper-meadow / cutpaper-dusk 不写进风格包，由 broll.json 顶层 motionTheme 选。白底、纯色底 freezeNoise 写 0.0005，否则 0.003。
- refs 两张，顺序是角色然后材质：file 用 refs/character.jpg（aspect 1:1，role 角色）和 refs/material.jpg（aspect 16:9，role 材质）。不要写 subjectFrom。
- 要有 name、nameEn、summary、summaryEn、look、character、characterEn、ground。id 用用户给的。`;

export const buildDraftMessages = ({id, name, desc, referenceText, problems}) => {
  const user = [
    `id：${id}`,
    `name：${name}`,
    `一句话：${desc}`,
    referenceText ? `参考图只供你理解材质和光线（图本身不进风格包）：${referenceText}` : '',
    problems?.length ? `上一轮没通过检查，按这些改，只输出改好的完整 JSON：\n${problems.map((p) => `- ${p}`).join('\n')}` : '请输出完整的 style.json。',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    {role: 'system', content: systemPrompt()},
    {role: 'user', content: user},
  ];
};

const llmPayload = (cfg, messages) => ({model: cfg.model, messages, temperature: DRAFT_TEMPERATURE, response_format: {type: 'json_object'}});

const printPayload = (log, url, payload) => {
  log(`POST ${url}`);
  log(JSON.stringify(redactBody(payload), null, 2));
};

const llmUrl = (cfg) => `${cfg.base.replace(/\/+$/, '')}/chat/completions`;

const refByRole = (style, role, index) => {
  const refs = refListOf(style);
  return refs.find((r) => r.role === role) ?? refs[index] ?? null;
};

const candidateRels = (file, n, round) => {
  const base = round <= 1 ? file : file.replace(/(\.[a-z0-9]+)$/i, `.r${round}$1`);
  const names = n === 1 ? [base] : Array.from({length: n}, (_, i) => candName(base, i + 1));
  return names;
};

const readState = (dir) => {
  const file = path.join(dir, 'state.json');
  if (!fs.existsSync(file)) {
    const empty = {stages: {}, judge: {}};
    Object.defineProperty(empty, STATE_FLAG, {value: 'missing'});
    return empty;
  }
  try {
    const s = readJson(file);
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('不是对象');
    const missingStages = !s.stages || typeof s.stages !== 'object' || Array.isArray(s.stages);
    const wiped = Object.keys(s).length === 0 ? 'empty' : missingStages ? 'no-stages' : '';
    s.stages = missingStages ? {} : s.stages;
    s.judge = s.judge && typeof s.judge === 'object' && !Array.isArray(s.judge) ? s.judge : {};
    if (wiped) Object.defineProperty(s, STATE_FLAG, {value: wiped});
    return s;
  } catch (e) {
    if (e instanceof FactoryError) throw e;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = `${file}.bad-${stamp}`;
    try {
      fs.renameSync(file, backup);
    } catch {
      /* 改名失败也要停，不能当成全新开始 */
    }
    throw new FactoryError(`state.json 损坏，已改名为 ${backup}。请先检查这份备份，确认没有未记录的付费任务，再重新跑。这次不会提交。`, 2);
  }
};

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stillPromptOf = (style, character) => {
  const robot = `${style?.characterEn ?? 'a toy robot'}: ${character?.en?.shape ?? ''} ${character?.en?.color ?? ''}`.replace(/\s+/g, ' ').trim();
  return `Macro photograph, the robot in this material pushes one plain smooth block to the middle of the table: ${robot} ${style?.look ?? ''} ${style?.ground ?? ''} The top of the head is one smooth round dome. Each hand is one solid round ball. Soft light, tidy scene. Nothing is written anywhere in the image.`.replace(/\s+/g, ' ').trim();
};

const testClip = (style) => ({
  id: 'b01',
  from: 'c2',
  to: 'c2',
  mode: 'split',
  job: Array.isArray(style.jobs) && style.jobs.includes('demonstrate') ? 'demonstrate' : style.jobs?.[0],
  plain: '试拍',
  place: '桌面',
  subject: '机器人',
  action: TEST_ACTION,
  end: TEST_END,
  camera: Array.isArray(style.cameras) && style.cameras.includes('static') ? 'static' : style.cameras?.[0],
});

const costText = () => {
  const yuan = clipCost('minimax-h3', VIDEO_QUALITY, VIDEO_SEC);
  const credits = creditsOf(VIDEO_QUALITY, VIDEO_SEC);
  return `约 ${credits} 积分 / 按价目表约 ${yuan} 元`;
};

const loadCtx = (root) => {
  const character = loadCharacter(root);
  const styles = readStyles(root);
  const ipWords = loadIpWords(root);
  return {character, styles, ipWords};
};

const ensureShape = (id, name, desc) => {
  if (!id || !ID_RE.test(id)) throw new FactoryError(`id 要是小写英文和短横线，例如 demo-watercolor。现在是「${id ?? ''}」。`, 2);
  if (id.startsWith('_')) throw new FactoryError('id 不能以下划线开头（下划线目录是草稿，不进风格清单）。', 2);
  if (!name || !String(name).trim()) throw new FactoryError('缺 --name。写给人看的风格名，例如：水彩绘本。', 2);
  if (!desc || !String(desc).trim()) throw new FactoryError('缺 --desc。用一句话描述材质、色调和光线。', 2);
};

/**
 * 没有 --yes 时打印将要发送的请求。不写文件、不调接口。
 */
const printDryRun = ({root, id, name, desc, from, video, n, env, log, state, style}) => {
  const cfg = readLlmEnv(env);
  log('还没加 --yes。下面是将要发送的请求。没有发送，不花钱。');
  if (!state.stages?.draft?.done) {
    if (from) {
      let base;
      try {
        base = resolveBase(env);
      } catch (e) {
        throw new FactoryError(e.message, 2);
      }
      const dataUrl = fs.existsSync(from) ? jpegDataUrl(from) : 'data:image/jpeg;base64,（文件读不到）';
      const body = buildVisionBody({model: visionModelOf(env), prompt: DESCRIBE_PROMPT, dataUrl, temperature: 0});
      log('\n[describe] 看图，把参考图写成材质 / 色调 / 光线。图本身不进风格包。');
      printPayload(log, `${base}/v1/chat/completions`, redactVisionBody(body));
    }
    log('\n[draft] DeepSeek 写 style.json');
    printPayload(log, llmUrl(cfg), llmPayload(cfg, buildDraftMessages({id, name, desc, referenceText: state.stages?.describe?.text || (from ? '（上一步看图之后填进来）' : '')})));
    log('\n出图、看图、静态试拍要等 style.json 写出来才知道提示词。加上 --yes 才会真的调用。');
  } else if (style) {
    let base;
    try {
      base = resolveBase(env);
    } catch (e) {
      throw new FactoryError(e.message, 2);
    }
    const ctx = loadCtx(root);
    const specs = [refByRole(style, '角色', 0), refByRole(style, '材质', 1)].filter(Boolean);
    log('\n[refs] image-01 出参考图候选');
    specs.forEach((spec) => {
      const planned = planRefJobs({styleDir: draftDirOf(root, id), style, character: ctx.character, specs: [spec], n, dryRun: true});
      if (!planned.jobs.length) {
        log(`${spec.file} 的候选已经在，跳过`);
        return;
      }
      for (const job of planned.jobs) {
        log(`\n[refs] ${job.out}（${IMAGE_MODEL}）`);
        printPayload(log, `${base}/v1/image_generation`, redactBody(buildImageBody({prompt: job.prompt, aspect: spec.aspect || '1:1'})));
      }
    });
  }
  if (video) {
    log(`\n[video] 视频试拍还要再加 --yes 才会提交。${VIDEO_SEC} 秒 ${VIDEO_QUALITY}：${costText()}。这次没有同时加上 --yes，不会提交 H3。`);
    if (style) {
      try {
        const ctx = loadCtx(root);
        const clip = testClip(style);
        const built = buildPromptV2({doc: {version: 2, style: id, clips: [clip]}, clip, genSec: VIDEO_SEC, styles: {...ctx.styles, [id]: style}, character: ctx.character});
        const picks = ['selected/character.jpg', 'selected/material.jpg'].map((rel) => path.join(draftDirOf(root, id), rel)).filter((p) => fs.existsSync(p));
        if (picks.length === 2) {
          const body = redactBody(buildVideoBody({prompt: built.prompt, refs: picks, resolution: VIDEO_QUALITY, duration: VIDEO_SEC, ratio: '16:9', styleId: id}));
          let base = resolveBase(env);
          log(`POST ${base}/v2/video_generation`);
          log(JSON.stringify({...body, model: VIDEO_MODEL}, null, 2));
        }
      } catch (e) {
        log(`视频请求还拼不出来（${e.message}）。参考图挑好之后再打印。`);
      }
    }
  } else {
    log(`\n这次没有 --video，不会提交 H3。要试拍再加 --video（${VIDEO_SEC} 秒 ${VIDEO_QUALITY}：${costText()}），并且同时加 --yes。`);
  }
  log(HUMAN);
};

const askDraft = async ({env, fetchImpl, log, messages, retryDelayMs}) => {
  const cfg = readLlmEnv(env);
  if (!cfg.key) throw new FactoryError('没有设置 DEEPSEEK_API_KEY（或 LLM_API_KEY）。设好再加 --yes。', 2);
  try {
    const {content} = await callLlm(messages, cfg, {temperature: DRAFT_TEMPERATURE, json: true, fetchImpl, log, retryDelayMs});
    return content;
  } catch (e) {
    throw new FactoryError(`写配置失败。${e.message}。${explainLlmError(e.message)}`, 4);
  }
};

const parseStyle = (content, id, name) => {
  let parsed;
  try {
    parsed = JSON.parse(extractJson(content));
  } catch (e) {
    return {style: fillDefaults({}, {id, name}), problems: [`输出不是 JSON（${e.message}）`]};
  }
  return {style: fillDefaults(parsed, {id, name})};
};

const imageClient = (opts) =>
  opts.client ??
  createH3Client({
    env: opts.env,
    fetchImpl: opts.fetchImpl,
    log: opts.log,
    pollMs: opts.pollMs ?? 10_000,
    timeoutMs: opts.timeoutMs,
    sleep: opts.sleep,
  });

const scoreOne = async ({file, rel, kind, state, env, fetchImpl, log, model}) => {
  if (state.judge[rel]) return state.judge[rel];
  log(`看图 ${rel}（${kind}）`);
  const judged = await judgeImage({file, kind, env, model, fetchImpl, log});
  const row = {
    file: rel,
    kind,
    verdict: judged.verdict,
    pass: judged.pass,
    hard: judged.hard,
    missing: judged.missing || [],
    soft: judged.soft,
    reasons: judged.reasons,
    attempts: judged.attempts,
    followups: judged.followups || 0,
    secondOpinions: judged.secondOpinions || 0,
    model: judged.model,
  };
  state.judge[rel] = row;
  return row;
};

const verdictOfRow = (row) => {
  if (row?.verdict === 'pass' || row?.verdict === 'fail' || row?.verdict === 'unsure') return row.verdict;
  if (row?.pass && !(row.hard || []).length) return 'pass';
  return 'fail';
};

/** pass 里软分最高；没有 pass 才取 unsure 里软分最高；全是 fail 返回 null（调用方才改提示重出）。 */
export const pickOf = (rows) => {
  const choose = (verdict) => {
    const ok = rows.filter((row) => verdictOfRow(row) === verdict);
    ok.sort((a, b) => (b.soft || 0) - (a.soft || 0) || String(a.file).localeCompare(String(b.file)));
    return ok[0] || null;
  };
  return choose('pass') || choose('unsure') || null;
};

const rowNeedsHuman = (row) => verdictOfRow(row) === 'unsure';

const blockNeedsHuman = (block) => {
  if (!block?.picked) return false;
  const row = (block.rows || []).find((item) => item.file === block.picked) || block.best;
  return rowNeedsHuman(row);
};

const rewritePrompt = async ({spec, rows, style, id, ctx, env, fetchImpl, log, retryDelayMs}) => {
  const brief = rows.map((r) => `${r.file}：${r.hard.map((h) => `${h.code} ${h.reason}`).join('；')}`).join('\n');
  const messages = [
    {
      role: 'system',
      content: '你改一条英文出图提示。只输出 JSON {"prompt":"..."}。只写想看到的东西。不要出现天线、antenna、嘴、mouth、凸点、stud、lego、品牌和作品名。角色图要写 the top of the head is one smooth round dome，each hand is one solid round ball。保留 {character}。材质图要有至少三件看得清的物件，不要角色。',
    },
    {role: 'user', content: `原来的提示：\n${spec.prompt}\n\n看图没过：\n${brief}\n\n只改这一张。`},
  ];
  let last = '没有返回 prompt';
  for (let i = 0; i < 2; i++) {
    const content = await askDraft({env, fetchImpl, log, messages, retryDelayMs});
    let prompt = '';
    try {
      prompt = String(JSON.parse(extractJson(content))?.prompt ?? '').trim();
    } catch (e) {
      last = `不是 JSON（${e.message}）`;
    }
    if (!prompt) {
      messages.push({role: 'assistant', content}, {role: 'user', content: `没有可用的 prompt。${last}。只输出 {"prompt":"..."}。`});
      continue;
    }
    const trial = {...style, refs: refListOf(style).map((r) => (r.file === spec.file ? {...r, prompt} : r))};
    const problems = styleProblems(trial, id, ctx);
    const own = problems.filter((p) => p.includes(spec.file) || p.includes('出图提示') || p.includes('品牌') || p.includes('描述'));
    if (own.length) {
      last = own.join('；');
      messages.push({role: 'assistant', content}, {role: 'user', content: `这版提示没过检查：\n${own.map((p) => `- ${p}`).join('\n')}\n再改一版。`});
      continue;
    }
    return prompt;
  }
  throw new FactoryError(`改「${spec.role}」的出图提示没通过检查：${last}`, 1);
};

const generateRound = async ({draftDir, style, character, spec, round, n, client, log}) => {
  const file = round <= 1 ? spec.file : spec.file.replace(/(\.[a-z0-9]+)$/i, `.r${round}$1`);
  const roundSpec = {...spec, file};
  const planned = planRefJobs({styleDir: draftDir, style, character, specs: [roundSpec], n, dryRun: false});
  for (const line of planned.logs) log(line);
  if (planned.error) throw new FactoryError(planned.error, 2);
  for (const job of planned.jobs) await generateRefImage({client, job, log});
  return candidateRels(spec.file, n, round)
    .map((rel) => ({rel, abs: path.join(draftDir, rel)}))
    .filter((item) => fs.existsSync(item.abs));
};

const copyPick = (draftDir, role, rel) => {
  const dest = path.join(draftDir, 'selected', role === '材质' ? 'material.jpg' : 'character.jpg');
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.copyFileSync(path.join(draftDir, rel), dest);
  return dest;
};

const renderReview = ({draftDir, id, report}) => {
  const card = (row) => {
    const verdict = verdictOfRow(row);
    const hard = row.hard?.length ? row.hard.map((h) => `${h.code}：${esc(h.reason)}`).join('<br>') : '无';
    const why = (row.reasons || []).map((r) => esc(r)).join('<br>');
    const label = verdict === 'unsure' ? '需要人看' : verdict === 'pass' ? '无硬伤' : '有硬伤';
    const cls = verdict === 'unsure' ? 'unsure' : verdict === 'pass' ? 'ok' : 'bad';
    const missing = verdict === 'unsure' && row.missing?.length ? `<p class="miss">这几项模型没回答：${esc(row.missing.join('、'))}</p>` : '';
    return `<figure class="${cls}">
      <img src="${esc(row.file)}" alt="${esc(row.file)}">
      <figcaption>${esc(row.file)} · ${label} · 软分 ${esc(row.soft)}</figcaption>
      <p>硬伤：${hard}</p>
      ${missing}
      <p class="why">${why}</p>
    </figure>`;
  };
  const group = (title, rows, picked) => {
    const body = (rows || []).map(card).join('') || '<p>还没有</p>';
    const pickedRow = (rows || []).find((row) => row.file === picked);
    const human = pickedRow && rowNeedsHuman(pickedRow);
    const note = picked ? `<p>选中：${esc(picked)}${human ? ' · 需要人看' : ''}</p>` : '';
    return `<section><h2>${esc(title)}</h2>${note}<div class="grid">${body}</div></section>`;
  };
  const alert = report.needsHuman ? '<p class="alert">需要人看</p>' : '';
  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>风格草稿 ${esc(id)}</title>
<style>
  body { font-family: sans-serif; margin: 24px; background: #111; color: #eee; }
  h1 { font-size: 22px; }
  .alert { background: #f5c518; color: #1a1400; font-weight: 700; padding: 10px 14px; }
  .bar { background: #1c1c1c; border: 1px solid #333; padding: 12px 16px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  figure { width: 220px; margin: 0; background: #1a1a1a; border: 1px solid #333; padding: 8px; }
  figure.ok { border-color: #3a6; }
  figure.bad { border-color: #a44; }
  figure.unsure { border-color: #f5c518; }
  img { width: 100%; height: auto; background: #000; }
  figcaption { font-size: 12px; color: #ccc; }
  .why, .miss { color: #aaa; font-size: 12px; }
  figure.unsure .miss { color: #f5c518; }
  code { color: #fe8; }
</style>
</head>
<body>
${alert}
<div class="bar">
  <p>结论：${esc(report.conclusion)}</p>
  <p>下一步：<code>${esc(report.next)}</code></p>
  <p>${esc(HUMAN)}</p>
</div>
<h1>${esc(report.name || id)} · ${esc(id)}</h1>
<p>${esc(report.desc || '')}</p>
${group('角色参考图', report.character?.rows, report.character?.picked)}
${group('材质参考图', report.material?.rows, report.material?.picked)}
${group('静态试拍', report.still?.rows, report.still?.pass ? report.still.rows?.[0]?.file : '')}
${group('视频抽帧', report.video?.rows, report.video?.pass ? '全部无硬伤' : '')}
</body>
</html>
`;
  fs.writeFileSync(path.join(draftDir, 'review.html'), html, 'utf8');
};

const writeReport = (draftDir, report, env = process.env) => {
  const clean = scrubValue(report, {draftDir, env});
  writeJson(path.join(draftDir, 'report.json'), clean);
  renderReview({draftDir, id: clean.id, report: clean});
};

/**
 * 跑一个风格的工厂。yes 为 false 时只打印请求。
 * @returns {Promise<{ok: boolean, exitCode: number, id: string, conclusion: string, dryRun?: boolean, reportPath?: string, reviewPath?: string, error?: string}>}
 */
export const runNewStyle = async (opts) => {
  const root = opts.root ?? ROOT;
  const env = opts.env ?? process.env;
  const log = opts.log ?? console.log;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const id = opts.id;
  const name = String(opts.name ?? '');
  const desc = String(opts.desc ?? '');
  const from = opts.from ? path.resolve(opts.from) : null;
  const n = opts.n == null ? 3 : Number(opts.n);
  const retries = opts.retries == null ? 1 : Number(opts.retries);
  const yes = !!opts.yes;
  const video = !!opts.video;
  const retryDelayMs = opts.retryDelayMs ?? 3000;
  ensureShape(id, name, desc);
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new FactoryError(`--n 要是 1 到 4 的整数，现在是 ${opts.n}。`, 2);
  if (!Number.isInteger(retries) || retries < 0 || retries > 3) throw new FactoryError(`--retries 要是 0 到 3 的整数，现在是 ${opts.retries}。`, 2);
  if (from && !fs.existsSync(from)) throw new FactoryError(`参考图不在：${from}。--from 要是一张本地图，图本身不会放进风格包。`, 2);
  const published = path.join(publishedDirOf(root, id), 'style.json');
  if (fs.existsSync(published)) throw new FactoryError(`已经有风格 ${id}（${published}）。工厂不覆盖已发布的风格。换一个 id。`, 2);

  const draftDir = draftDirOf(root, id);
  const stylePath = path.join(draftDir, 'style.json');
  const styleOnDisk = () => (fs.existsSync(stylePath) ? readJson(stylePath) : null);

  if (!yes) {
    const state = fs.existsSync(draftDir) ? readState(draftDir) : {stages: {}, judge: {}};
    printDryRun({root, id, name, desc, from, video, n, env, log, state, style: styleOnDisk()});
    return {ok: true, exitCode: 0, id, conclusion: '只打印请求，没有调用', dryRun: true};
  }

  if (!String(env.MINIMAX_API_KEY ?? '').trim()) throw new FactoryError('没有设置 MINIMAX_API_KEY。设好再加 --yes。', 2);
  fs.mkdirSync(draftDir, {recursive: true});
  let lock = null;
  const onSigint = () => {
    if (lock) lock.release();
    process.exit(130);
  };
  process.on('SIGINT', onSigint);
  try {
    lock = acquireDraftLock(draftDir);
    settleBadBackups(draftDir, {stateReset: !!opts.stateReset, log});
    const state = readState(draftDir);
    assertNotWiped(draftDir, state, {stateReset: !!opts.stateReset, log});
    const needsWriter = !!from || !state.stages?.draft?.done;
    if (needsWriter && !String(readLlmEnv(env).key ?? '').trim()) throw new FactoryError('没有设置 DEEPSEEK_API_KEY（或 LLM_API_KEY）。设好再加 --yes。', 2);
    const saveState = () => writeJson(path.join(draftDir, 'state.json'), scrubValue(state, {draftDir, env}));
    state.id = id;
    state.name = name;
    state.desc = desc;
    const ctx = loadCtx(root);
    const model = opts.visionModel || visionModelOf(env);

    try {
    if (from && !state.stages.describe?.done) {
      log('看参考图，写成材质 / 色调 / 光线。图不进风格包。');
      const described = await describeImage({file: from, env, model, fetchImpl});
      state.stages.describe = {done: true, text: described.text};
      saveState();
    }

    if (!state.stages.draft?.done) {
      const roundsDone = state.draftRounds || 0;
      if (roundsDone >= 3) throw new FactoryError(`写配置已经失败 ${roundsDone} 轮，不再调。删掉 broll/styles/_drafts/${id} 再跑。上一轮：\n${(state.draftProblems || []).map((p) => `- ${p}`).join('\n')}`, 2);
      let problems = state.draftProblems || [];
      let style = null;
      for (let round = roundsDone; round < 3; round++) {
        const messages = buildDraftMessages({id, name, desc, referenceText: state.stages.describe?.text || '', problems});
        log(`写配置，第 ${round + 1}/3 轮`);
        const content = await askDraft({env, fetchImpl, log, messages, retryDelayMs});
        state.draftRounds = round + 1;
        const parsed = parseStyle(content, id, name);
        style = parsed.style;
        problems = parsed.problems?.length ? parsed.problems : styleProblems(style, id, {...ctx, styles: {...ctx.styles, [id]: style}});
        state.draftProblems = problems;
        saveState();
        if (!problems.length) break;
        log(`这轮没过：\n${problems.map((p) => `- ${p}`).join('\n')}`);
        style = null;
      }
      if (!style) throw new FactoryError(`写配置 3 轮都没过。最后一轮：\n${problems.map((p) => `- ${p}`).join('\n')}\n改 --desc 再说清楚材质，或删掉草稿再跑。`, 2);
      writeJson(stylePath, style);
      state.stages.draft = {done: true, rounds: state.draftRounds};
      saveState();
    }

    const style = readJson(stylePath);
    const characterRef = refByRole(style, '角色', 0);
    const materialRef = refByRole(style, '材质', 1);
    if (!characterRef?.prompt || !materialRef?.prompt) throw new FactoryError('style.json 里要有角色和材质两张参考图的 prompt。', 2);
    const client = imageClient({...opts, env, fetchImpl, log});

    const judgeRole = async (spec, kind) => {
      const rows = [];
      let current = spec;
      for (let round = 1; round <= retries + 1; round++) {
        const files = await generateRound({draftDir, style: {...style, refs: refListOf(style).map((r) => (r.file === spec.file ? current : r))}, character: ctx.character, spec: current, round, n, client, log});
        if (!files.length) throw new FactoryError(`${spec.role} 没有出图。看上面的接口报错。`, 4);
        const scored = [];
        for (const file of files) {
          const row = await scoreOne({file: file.abs, rel: file.rel.split(path.sep).join('/'), kind, state, env, fetchImpl, log, model});
          scored.push(row);
          rows.push(row);
          saveState();
        }
        const best = pickOf(rows);
        if (best) {
          if (rowNeedsHuman(best)) log(`${spec.role} 选了 ${best.file}，模型没答完，需要人看。`);
          return {rows, picked: best.file, best};
        }
        if (round > retries) break;
        log(`${spec.role} 这一轮都有硬伤，改提示再出一轮（${round}/${retries}）`);
        const prompt = await rewritePrompt({spec: current, rows: scored, style, id, ctx: {...ctx, styles: {...ctx.styles, [id]: style}}, env, fetchImpl, log, retryDelayMs});
        current = {...current, prompt};
        const idx = refListOf(style).findIndex((r) => r.file === spec.file);
        if (idx >= 0) style.refs[idx] = {...style.refs[idx], prompt};
        writeJson(stylePath, style);
      }
      return {rows, picked: null, best: null};
    };

    const character = state.stages.character?.picked
      ? {rows: state.stages.character.rows, picked: state.stages.character.picked, best: state.judge[state.stages.character.picked]}
      : await judgeRole(characterRef, 'character');
    state.stages.character = {picked: character.picked, rows: character.rows};
    const material = state.stages.material?.picked
      ? {rows: state.stages.material.rows, picked: state.stages.material.picked, best: state.judge[state.stages.material.picked]}
      : await judgeRole(materialRef, 'material');
    state.stages.material = {picked: material.picked, rows: material.rows};
    saveState();

    if (!character.picked || !material.picked) {
      const stuck = [
        !character.picked ? `角色图：${(character.rows || []).map((r) => `${r.file} ${r.hard.map((h) => h.code).join('+')}`).join('；')}` : '',
        !material.picked ? `材质图：${(material.rows || []).map((r) => `${r.file} ${r.hard.map((h) => h.code).join('+')}`).join('；')}` : '',
      ].filter(Boolean);
      const conclusion = '卡在参考图';
      const report = baseReport({id, name, desc, conclusion, character, material, still: null, video: null, next: `改出图提示，或删掉 broll/styles/_drafts/${id} 再跑。${HUMAN}`});
      writeReport(draftDir, report, env);
      log(conclusion);
      log(stuck.join('\n'));
      log('建议：看 review.html 里每张的硬伤理由，把「头顶光滑圆顶」写进角色提示，材质提示里写上三件具体物件。');
      log(HUMAN);
      return {ok: false, exitCode: 1, id, conclusion, reportPath: path.join(draftDir, 'report.json'), reviewPath: path.join(draftDir, 'review.html'), error: stuck.join(' ')};
    }
    copyPick(draftDir, '角色', character.picked);
    copyPick(draftDir, '材质', material.picked);
    state.stages.judge = {done: true};
    saveState();

    let still = state.stages.still?.done ? state.stages.still : null;
    if (!still) {
      const prompt = stillPromptOf(style, ctx.character);
      const leaked = findLeaks(prompt);
      if (leaked.length) throw new FactoryError(`静态试拍的提示里有泄漏词 ${leaked.join('、')}。先改风格描述里的这些词。`, 2);
      const rel = 'still/1.jpg';
      const abs = path.join(draftDir, rel);
      if (!fs.existsSync(abs)) {
        log('静态试拍：机器人推一块方块');
        await generateRefImage({client, job: {out: rel, abs, prompt, spec: {role: '试拍', aspect: '16:9', file: rel}}, log});
      }
      const row = await scoreOne({file: abs, rel, kind: 'frame', state, env, fetchImpl, log, model});
      still = {done: true, pass: verdictOfRow(row) === 'pass', rows: [row]};
      state.stages.still = still;
      saveState();
    }

    const needsHuman = blockNeedsHuman(character) || blockNeedsHuman(material);
    const videoRedo = !!opts.videoRedo;
    const humanOk = !!opts.humanOk;
    const ffmpegReady = opts.ffmpegReady ?? ffmpegIsReady;
    const savedVideo = state.stages.video && typeof state.stages.video === 'object' ? {...state.stages.video} : null;
    const taskIdSaved = savedVideo?.taskId ? String(savedVideo.taskId) : '';
    // --human-ok 只决定要不要发起新的提交。已经有 task id 时，缺这个参数也不许清掉。
    const reopenHuman = savedVideo?.skipped === REF_HUMAN_SKIP && humanOk && !taskIdSaved;
    let videoReport = savedVideo?.done && !reopenHuman ? savedVideo : null;
    if (video && !videoReport) {
      const stuckSubmit = savedVideo?.status === 'submitting' && !taskIdSaved;
      const failed = savedVideo?.status === 'failed';
      const SUBMIT_UNKNOWN_MSG = '上次提交没有确认结果，可能已经扣费。先去 MiniMax 后台看视频任务列表；确认没有提交成功再加 --video-redo。';
      if (stuckSubmit && !videoRedo) throw new FactoryError(SUBMIT_UNKNOWN_MSG, 2);
      if (failed && !videoRedo) {
        throw new FactoryError(`视频试拍上次失败了（task id ${taskIdSaved || '没有'}）。不自动重做。要重做必须显式加 --video-redo，会再花${costText()}。`, 2);
      }
      const mustContinue = !!taskIdSaved || ((stuckSubmit || failed) && videoRedo);
      if (!mustContinue && !still.pass) {
        const stillUnsure = (still.rows || []).some((row) => rowNeedsHuman(row));
        const skip = stillUnsure ? '静态试拍模型没答完，需要人看，不提交视频' : '静态试拍没过';
        log(stillUnsure ? '静态试拍模型没答完，需要人看，不提交视频，不花积分。' : '静态试拍有硬伤，不提交视频，不花积分。');
        videoReport = {done: true, pass: false, skipped: skip, rows: []};
      } else if (!mustContinue && needsHuman && !humanOk) {
        log(`${REF_HUMAN_SKIP}，不提交视频，不花积分。`);
        videoReport = {done: true, pass: false, skipped: REF_HUMAN_SKIP, rows: []};
      } else {
        if (needsHuman && humanOk && !taskIdSaved) log('参考图需要人看，已加 --human-ok，这一条拦截解除，继续视频试拍。');
        const clip = testClip(style);
        const built = buildPromptV2({doc: {version: 2, style: id, clips: [clip]}, clip, genSec: VIDEO_SEC, styles: {...ctx.styles, [id]: style}, character: ctx.character, style});
        if (built.leaked.length) throw new FactoryError(`视频提示词里有泄漏词 ${built.leaked.join('、')}，这一段没有提交，也没有花钱。`, 2);
        const refs = [path.join(draftDir, 'selected', 'character.jpg'), path.join(draftDir, 'selected', 'material.jpg')];
        const videoPath = path.join(draftDir, 'video', 'clip.mp4');
        let taskId = taskIdSaved || null;
        if (failed && videoRedo) {
          log(`--video-redo：上次失败的任务作废，重新提交。会再花${costText()}。`);
          taskId = null;
          if (fs.existsSync(videoPath)) fs.rmSync(videoPath, {force: true});
        }
        if (stuckSubmit && videoRedo) {
          log(`--video-redo：上次提交没有确认结果，按你的确认重新提交。会再花${costText()}。`);
          taskId = null;
        }
        const ensureFfmpeg = (alreadyPaid) => {
          if (ffmpegReady()) return;
          if (alreadyPaid) throw new FactoryError('没有可用的 ffmpeg，抽不了帧。task id 已保留，装好再跑同一条命令，不会重新提交。', 2);
          throw new FactoryError('没有可用的 ffmpeg。装好再跑视频试拍。这次没有提交，也没有花钱。', 2);
        };
        if (!taskId && !fs.existsSync(videoPath)) {
          ensureFfmpeg(false);
          const disk = readState(draftDir);
          const diskVideo = disk.stages?.video;
          const diskStatus = diskVideo && typeof diskVideo === 'object' && !Array.isArray(diskVideo) && diskVideo.status ? String(diskVideo.status) : '';
          const diskTask = diskVideo && typeof diskVideo === 'object' && !Array.isArray(diskVideo) && diskVideo.taskId ? String(diskVideo.taskId) : '';
          const diskDone = !!(diskVideo && typeof diskVideo === 'object' && !Array.isArray(diskVideo) && diskVideo.done === true);
          const memStatus = savedVideo?.status ? String(savedVideo.status) : '';
          if ((diskTask && diskTask !== taskIdSaved) || (diskStatus && diskStatus !== memStatus) || (diskDone && savedVideo?.done !== true)) {
            throw new FactoryError('写提交标记前发现磁盘上已经有视频状态，这次停下，不提交。', 2);
          }
          log(`视频试拍：${costText()}`);
          const at = new Date().toISOString();
          state.stages.video = {status: 'submitting', at, done: false};
          saveState();
          let submitted;
          try {
            submitted = await client.submit({prompt: built.prompt, refs, resolution: VIDEO_QUALITY, duration: VIDEO_SEC, ratio: '16:9', promptExpansion: style.promptExpansion, styleId: id});
          } catch (e) {
            if (submitWasRefused(e)) {
              if (savedVideo && savedVideo.status && savedVideo.status !== 'submitting') state.stages.video = {...savedVideo};
              else delete state.stages.video;
              saveState();
              throw new FactoryError(refusedSubmitMessage(e), 2);
            }
            throw new FactoryError(`${SUBMIT_UNKNOWN_MSG}（${e.message}）`, 2);
          }
          if (!submitted) throw new FactoryError(SUBMIT_UNKNOWN_MSG, 2);
          taskId = String(submitted);
          const submittedAt = new Date().toISOString();
          state.stages.video = {status: 'submitted', taskId, at, submittedAt, done: false};
          saveState();
          log(`视频试拍已提交，task id ${taskId}`);
        } else if (taskId && !fs.existsSync(videoPath)) {
          log(`继续查询视频试拍，task id ${taskId}。不再提交。`);
        } else {
          log('clip.mp4 已在，跳过下载，只抽帧。');
        }
        if (!fs.existsSync(videoPath)) {
          const submittedAt = state.stages.video?.submittedAt || savedVideo?.submittedAt || new Date().toISOString();
          let task;
          try {
            task = await client.poll(taskId, submittedAt);
          } catch (e) {
            throw new FactoryError(`视频试拍查询失败：${e.message}。task id ${taskId} 已保留，再跑同一条命令会继续查，不会重新提交。`, e.exitCode || 4);
          }
          if (task.status === 'timeout') {
            state.stages.video = {...(state.stages.video || {}), status: 'submitted', taskId, submittedAt, done: false};
            saveState();
            throw new FactoryError('任务还在生成，稍后再跑同一条命令继续查询，不会重新提交', 3);
          }
          if (task.status === 'failed' || task.status === 'cancelled') {
            state.stages.video = {...(state.stages.video || {}), status: 'failed', taskId, submittedAt, done: false};
            saveState();
            throw new FactoryError(`视频试拍没有生成（${task.status}）。不自动重做。要重做必须显式加 --video-redo，会再花${costText()}。`, 4);
          }
          if (task.status !== 'succeeded' || !task.url) {
            state.stages.video = {...(state.stages.video || {}), status: 'submitted', taskId, submittedAt, done: false};
            saveState();
            throw new FactoryError('任务还在生成，稍后再跑同一条命令继续查询，不会重新提交', 3);
          }
          try {
            await client.download(taskId, videoPath, task.url);
          } catch (e) {
            throw new FactoryError(`视频试拍下载失败：${e.message}。task id ${taskId} 已保留，再跑同一条命令会继续下载，不会重新提交。`, e.exitCode || 4);
          }
          state.stages.video = {...(state.stages.video || {}), status: 'downloaded', taskId, submittedAt, done: false};
          saveState();
        }
        ensureFfmpeg(Boolean(taskId) || fs.existsSync(videoPath));
        const frameDir = path.join(draftDir, 'video', 'frames');
        const frames = opts.extractFrames ? opts.extractFrames({video: videoPath, outDir: frameDir, everySec: 0.5, durationSec: VIDEO_SEC}) : extractFramesEvery({video: videoPath, outDir: frameDir, everySec: 0.5, durationSec: VIDEO_SEC});
        const rows = [];
        for (const file of frames) {
          const rel = path.relative(draftDir, file).split(path.sep).join('/');
          rows.push(await scoreOne({file, rel, kind: 'frame', state, env, fetchImpl, log, model}));
          saveState();
        }
        const pass = rows.length === 8 && rows.every((row) => verdictOfRow(row) === 'pass');
        videoReport = {done: true, pass, rows, taskId};
        if (!pass && rows.some((row) => verdictOfRow(row) === 'fail')) log('视频抽帧有硬伤。不建议把这个风格标成 stable。');
        else if (!pass && rows.some((row) => rowNeedsHuman(row))) log('视频抽帧有模型没答完的检查项，需要人看。不建议把这个风格标成 stable。');
      }
      if (taskIdSaved && videoReport && !videoReport.taskId) {
        throw new FactoryError(`已有 task id ${taskIdSaved}，不能覆盖。再跑同一条带 --video 的命令会继续查询，不会重新提交。`, 2);
      }
      state.stages.video = videoReport;
      saveState();
    }

    const videoPass = videoReport?.pass === true;
    let conclusion = still.pass ? (video ? (videoPass ? '等人审（视频试拍通过）' : '等人审（视频试拍没过）') : '等人审') : '等人审（静态试拍没过，先不要花视频的钱）';
    if (needsHuman) conclusion = `需要人看。${conclusion}`;
    const next = `node scripts/broll/approve-style.mjs ${id}`;
    const report = baseReport({id, name, desc, conclusion, character, material, still, video: videoReport, next: `${next}\n${HUMAN}`, videoPass, needsHuman});
    writeReport(draftDir, report, env);
    log(conclusion);
    log(`汇总页：${path.join(draftDir, 'review.html')}`);
    log(`下一步（只能人跑）：${next}`);
    log(HUMAN);
    const exitCode = video && !videoPass ? 1 : 0;
    return {
      ok: exitCode === 0,
      exitCode,
      id,
      conclusion,
      reportPath: path.join(draftDir, 'report.json'),
      reviewPath: path.join(draftDir, 'review.html'),
      videoPass,
      stillPass: still.pass,
    };
  } catch (e) {
    const message = scrubText(e.message || String(e), {draftDir, env});
    if (fs.existsSync(draftDir)) {
      const report = {
        id,
        name,
        desc,
        conclusion: message.split('\n')[0],
        error: message,
        next: HUMAN,
        character: state.stages.character || null,
        material: state.stages.material || null,
      };
      try {
        writeReport(draftDir, report, env);
      } catch {
        /* 报告写不了也不要盖住原来的错 */
      }
    }
    if (e instanceof FactoryError) {
      e.message = message;
      throw e;
    }
    throw new FactoryError(message, e.exitCode || 1);
    }
  } finally {
    process.off('SIGINT', onSigint);
    if (lock) lock.release();
  }
};

const packBlock = (block) => {
  if (!block) return null;
  const row = (block.rows || []).find((item) => item.file === block.picked) || block.best;
  return {picked: block.picked, rows: block.rows, needsHuman: rowNeedsHuman(row)};
};

const baseReport = ({id, name, desc, conclusion, character, material, still, video, next, videoPass = false, needsHuman = false}) => ({
  id,
  name,
  desc,
  conclusion,
  needsHuman,
  attention: needsHuman ? '需要人看' : null,
  statusSuggestion: videoPass ? 'stable' : 'experimental',
  next,
  humanOnly: true,
  character: packBlock(character),
  material: packBlock(material),
  still: still ? {pass: !!still.pass, rows: still.rows || []} : null,
  video: video ? {pass: !!video.pass, skipped: video.skipped || null, rows: video.rows || []} : null,
});

/** 清单一项一项跑。一项失败不影响下一项。 */
export const runBatch = async ({file, log = console.log, ...rest}) => {
  let list;
  try {
    list = readJson(file);
  } catch (e) {
    throw new FactoryError(`读不了清单 ${file}（${e.message}）。要是 UTF-8 的 JSON 数组，每项有 id、name、desc。`, 2);
  }
  if (!Array.isArray(list) || !list.length) throw new FactoryError('清单是空的，或不是数组。每项要有 id、name、desc。', 2);
  const maxVideo = rest.maxVideo == null ? 3 : Number(rest.maxVideo);
  if (rest.maxVideo != null && (!Number.isInteger(maxVideo) || maxVideo < 1)) throw new FactoryError(`--max-video 要是正整数，现在是 ${rest.maxVideo}。`, 2);
  if (rest.video) {
    const credits = creditsOf(VIDEO_QUALITY, VIDEO_SEC);
    const yuan = clipCost('minimax-h3', VIDEO_QUALITY, VIDEO_SEC);
    const totalYuan = Math.round(yuan * list.length * 1000) / 1000;
    log(`批量视频 ${list.length} 项 × 约 ${credits} 积分 / 按价目表约 ${yuan} 元 = 合计约 ${credits * list.length} 积分 / 按价目表约 ${totalYuan} 元。`);
    if (rest.yes && list.length > maxVideo) throw new FactoryError(`批量视频 ${list.length} 项，超过 --max-video ${maxVideo}。这次没有提交。`, 2);
  }
  const rows = [];
  for (const item of list) {
    const id = item?.id;
    try {
      if (!id || !item.name || !item.desc) throw new FactoryError(`清单里有一项缺 id / name / desc：${JSON.stringify(item)}`, 2);
      const result = await runNewStyle({...rest, log, id, name: item.name, desc: item.desc, from: item.from || null});
      rows.push(result);
    } catch (e) {
      log(`${id || '（缺 id）'} 失败：${e.message}`);
      rows.push({ok: false, exitCode: e.exitCode || 1, id: id || '', conclusion: e.message, error: e.message});
    }
  }
  log('批量结果：');
  for (const row of rows) log(`- ${row.id}：${row.exitCode === 0 ? row.conclusion : `失败 ${row.error || row.conclusion}`}`);
  const failed = rows.filter((r) => r.exitCode !== 0);
  return {rows, exitCode: failed.length ? 1 : 0};
};

/**
 * 把草稿收进 broll/styles/<id>/。只能人跑。做过视频试拍且通过 → stable，否则 experimental。
 */
export const approveStyle = ({root = ROOT, id, log = console.log, humanYes = false}) => {
  const testBypass = process.env.BREWREEL_APPROVE_TEST === '1' && approveTestRootOk(root);
  if (!process.stdin.isTTY && !testBypass) throw new FactoryError('这一步只能人在终端里自己跑', 2);
  if (!id || !ID_RE.test(id)) throw new FactoryError(`id 不对：${id ?? ''}。用法：node scripts/broll/approve-style.mjs <id>`, 2);
  const draftDir = draftDirOf(root, id);
  const stylePath = path.join(draftDir, 'style.json');
  const reportPath = path.join(draftDir, 'report.json');
  if (!fs.existsSync(stylePath) || !fs.existsSync(reportPath)) {
    throw new FactoryError(`没有草稿 ${draftDir}。先跑 new-style.mjs --yes，看过 review.html，再来批准。`, 2);
  }
  const report = readJson(reportPath);
  if (report.error) throw new FactoryError(`这份草稿报错了，不批准。${String(report.error).split('\n')[0]}`, 2);
  if (report.needsHuman && humanYes !== true) throw new FactoryError('这份草稿标了需要人看。确认时要输入 yes 才批准。', 2);
  const characterSrc = path.join(draftDir, 'selected', 'character.jpg');
  const materialSrc = path.join(draftDir, 'selected', 'material.jpg');
  if (!fs.existsSync(characterSrc) || !fs.existsSync(materialSrc)) {
    throw new FactoryError('草稿里还没挑好两张参考图（selected/character.jpg、selected/material.jpg）。看 review.html，挑图没过就先别批准。', 2);
  }
  const dest = publishedDirOf(root, id);
  if (fs.existsSync(dest)) throw new FactoryError(`broll/styles/${id} 已经在了，不覆盖。`, 2);
  const style = readJson(stylePath);
  if (!refsAreCanonical(style)) throw new FactoryError('style.json 的 refs 必须正好两张，顺序是角色然后材质：refs/character.jpg（角色，1:1）和 refs/material.jpg（材质，16:9）。和选中的两张图对不上，不批准。', 2);
  const videoPass = report.video?.pass === true && !report.video?.skipped;
  style.status = videoPass ? 'stable' : 'experimental';
  style.default = false;
  style.id = id;
  fs.mkdirSync(path.join(dest, 'refs'), {recursive: true});
  writeJson(path.join(dest, 'style.json'), style);
  fs.copyFileSync(characterSrc, path.join(dest, 'refs', 'character.jpg'));
  fs.copyFileSync(materialSrc, path.join(dest, 'refs', 'material.jpg'));
  const line = (block, title) => {
    if (!block?.picked) return `- ${title}：没有选中`;
    const row = (block.rows || []).find((r) => r.file === block.picked);
    const reasons = (row?.reasons || []).slice(0, 4).join(' / ');
    return `- ${title}：${block.picked}，软分 ${row?.soft ?? '—'}${reasons ? `。${reasons}` : ''}`;
  };
  const readme = `# 参考图

从草稿 \`broll/styles/_drafts/${id}/\` 收进来的。人看过汇总页之后自己运行了 approve-style。

${line(report.character, '角色')}
${line(report.material, '材质')}

看图打分只是第一道筛，分数是模型打的。状态：${style.status}（${videoPass ? '做过视频试拍且通过' : '没有通过的视频试拍'}）。
`;
  fs.writeFileSync(path.join(dest, 'refs', 'README.md'), readme, 'utf8');
  log(`已收进 ${dest}，status=${style.status}。`);
  log('草稿还留在 _drafts，汇总页还在。风格清单要重启之后的下一次校验才把这个目录算进去（目录里有 style.json 就会被读到）。');
  return {dest, status: style.status};
};
