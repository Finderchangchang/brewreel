// 按页分段渲染的指纹、版本锁和 ffmpeg 拼接。
// 画面指纹只收「会改变像素」的输入。配音文件路径每次运行都变，不进指纹；进的是时长和逐字时间。
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {sha256Of} from '../lib/delivery.mjs';
import {cartoonOnScreen} from '../../template/src/lesson/mascot/cast.mjs';

/** LegalMarkings.tsx 里片尾声明是 totalFrames - 4 * 30，片头大标是 frame < 90。 */
export const END_CARD_FRAMES = 4 * 30;
export const OPENING_FRAMES = 90;

/** 和 make-lesson 调用 make_bgm.py、Lesson 里配乐音量保持一致。 */
export const BGM_PARAMS = {bpm: 96, theme: 'mono-premium', duckDb: -12, duckAttack: 0.18, duckRelease: 0.5, lufs: -24, volume: 0.22};

const CODE_DIRS = [
  'template/src/lesson',
  'template/src/vendor/react-peeps',
];
const CODE_FILES = [
  'template/src/index.ts',
  'template/src/Root.tsx',
  'template/src/core/font.ts',
  'template/src/core/kit.tsx',
  'scripts/lesson/timeline.mjs',
  'scripts/lesson/title-wrap.mjs',
  'scripts/lesson/vertical-layout.mjs',
  'scripts/lesson/vertical.mjs',
  'scripts/lesson/reveal-targets.mjs',
  'scripts/lesson/segments.mjs',
  'scripts/lesson/render-ranges.mjs',
];
const FONT_FILES = [
  'template/public/NotoSansSC-VF.ttf',
  'template/public/NotoSerifSC-VF.ttf',
  'template/public/LXGWWenKai-Regular.ttf',
  'template/public/CascadiaMono.ttf',
];
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json']);

const relPath = (root, file) => path.relative(root, file).split(path.sep).join('/');

function walkCode(root, rel, out) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new Error(`引擎指纹缺少目录：${rel}`);
  for (const name of fs.readdirSync(abs)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (name.endsWith('.d.ts') || name.endsWith('.d.mts')) continue;
    const full = path.join(abs, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkCode(root, relPath(root, full), out);
    else if (st.isFile() && CODE_EXT.has(path.extname(name))) out.add(relPath(root, full));
  }
}

/** 影响课程画面和时间轴的文件。宣传片镜头不在里面。 */
export function listEngineFiles(root) {
  const rels = new Set(CODE_FILES);
  for (const dir of CODE_DIRS) walkCode(root, dir, rels);
  for (const font of FONT_FILES) rels.add(font);
  const files = [...rels].sort();
  for (const rel of files) {
    if (!fs.existsSync(path.join(root, rel))) throw new Error(`引擎指纹缺少文件：${rel}`);
  }
  return files;
}

export function readEngineFingerprint(root) {
  const files = listEngineFiles(root).map((rel) => ({path: rel, sha256: sha256Of(path.join(root, rel))}));
  const hash = sha256Of(Buffer.from(files.map((file) => `${file.path}\n${file.sha256}\n`).join(''), 'utf8'));
  return {hash, files};
}

export function readPackageVersion(root) {
  for (const rel of ['package.json', 'integrations/deepseek-harness/package.json']) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    try {
      const version = JSON.parse(fs.readFileSync(file, 'utf8')).version;
      if (typeof version === 'string' && version.trim()) return {version: version.trim(), file: rel};
    } catch { /* 下一个候选 */ }
  }
  return {version: null, file: null};
}

export function readRemotionVersion(root) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'template', 'package.json'), 'utf8'));
    return pkg.dependencies?.remotion || pkg.devDependencies?.remotion || null;
  } catch {
    return null;
  }
}

/** 没有 .git、git 不存在、或不在工作树里时返回 null，不抛错。不往父目录找仓库。 */
export function readGitState(root) {
  const env = {...process.env, GIT_CEILING_DIRECTORIES: path.resolve(root, '..')};
  const git = (args) => spawnSync('git', args, {cwd: root, encoding: 'utf8', windowsHide: true, env});
  try {
    const inside = git(['rev-parse', '--is-inside-work-tree']);
    if (inside.error || inside.status !== 0 || String(inside.stdout || '').trim() !== 'true') return {commit: null, dirty: null};
    const commit = git(['rev-parse', 'HEAD']);
    if (commit.error || commit.status !== 0 || !String(commit.stdout || '').trim()) return {commit: null, dirty: null};
    const status = git(['status', '--porcelain']);
    if (status.error || status.status !== 0) return {commit: String(commit.stdout).trim(), dirty: null};
    return {commit: String(commit.stdout).trim(), dirty: String(status.stdout || '').trim().length > 0};
  } catch {
    return {commit: null, dirty: null};
  }
}

export function readLock(outDir) {
  const file = path.join(outDir, 'lock.json');
  if (!fs.existsSync(file)) return null;
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`成片目录里的 lock.json 读不出来：${e.message}`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('成片目录里的 lock.json 不是对象，拒绝出片');
  return parsed;
}

export function writeLock(outDir, lock) {
  fs.writeFileSync(path.join(outDir, 'lock.json'), JSON.stringify(lock, null, 2) + '\n', 'utf8');
}

export function diffEngineFiles(previousFiles, currentFiles) {
  const prev = new Map((previousFiles || []).map((file) => [file.path, file.sha256]));
  const next = new Map((currentFiles || []).map((file) => [file.path, file.sha256]));
  const changed = [];
  for (const [file, sha] of next) {
    if (!prev.has(file)) changed.push(`新增 ${file}`);
    else if (prev.get(file) !== sha) changed.push(file);
  }
  for (const file of prev.keys()) if (!next.has(file)) changed.push(`删除 ${file}`);
  changed.sort((a, b) => a.localeCompare(b, 'zh'));
  return changed;
}

export function engineRefusalMessage({previous, changed}) {
  const version = previous?.packageVersion ? `v${String(previous.packageVersion).replace(/^v/u, '')}` : 'v未知';
  const commit = previous?.git?.commit || '无';
  const listed = (changed || []).slice(0, 20);
  const more = (changed || []).length > 20 ? `\n……另有 ${changed.length - 20} 个文件` : '';
  const body = listed.length ? listed.map((file) => `- ${file}`).join('\n') : '- 引擎总指纹不一致';
  return `这个成片是用 ${version}（提交 ${commit}）出的，当前引擎已变化：\n${body}${more}\n可以加 --accept-engine-change 用新引擎整片重出，或回到交付时的版本再出。`;
}

export function decideEngineChange({previous, current, accept}) {
  if (!previous) return {ok: true, engineChanged: null};
  const same = previous.engine?.hash && previous.engine.hash === current.hash;
  if (same) return {ok: true, engineChanged: null};
  const changed = diffEngineFiles(previous.engine?.files, current.files);
  if (!accept) return {ok: false, message: engineRefusalMessage({previous, changed})};
  return {
    ok: true,
    engineChanged: {
      from: {packageVersion: previous.packageVersion ?? null, gitCommit: previous.git?.commit ?? null, engineHash: previous.engine?.hash ?? null},
      to: {packageVersion: current.packageVersion ?? null, gitCommit: current.git?.commit ?? null, engineHash: current.hash},
    },
  };
}

function digest(value) {
  return sha256Of(Buffer.from(JSON.stringify(stable(value)), 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) continue;
      out[key] = stable(value[key]);
    }
    return out;
  }
  return value;
}

function hashFileIfExists(src, publicDir) {
  if (!src || !publicDir) return null;
  const abs = path.isAbsolute(src) ? src : path.join(publicDir, src);
  try {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  } catch { return null; }
  return sha256Of(abs);
}

const ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|mp4|webm|mov)$/iu;
function isAssetKey(key, value) {
  if (key === 'image' || key === 'imagePath' || key === 'src' || key === 'file') return true;
  return ASSET_EXT.test(value);
}

function freezeAssets(value, publicDir, key = '') {
  if (Array.isArray(value)) return value.map((item) => freezeAssets(item, publicDir, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const child of Object.keys(value)) out[child] = freezeAssets(value[child], publicDir, child);
    return out;
  }
  if (typeof value === 'string' && isAssetKey(key, value)) {
    const hashed = hashFileIfExists(value, publicDir);
    if (hashed) return {asset: hashed};
  }
  return value;
}

function freezePresenter(presenter, publicDir) {
  if (!presenter) return null;
  const {src, ...rest} = presenter;
  const asset = hashFileIfExists(src, publicDir);
  return {...rest, asset: asset || src || null};
}

/** 与 Lesson.tsx 的 presenterKindOf 同一规则。 */
export function presenterKindOf(timeline, mascot) {
  if ((timeline?.pages || []).some((page) => page.presenter)) return 'real';
  if (!cartoonOnScreen(mascot)) return 'none';
  return 'cartoon';
}

function wardrobeOf(page, mascot) {
  if (!mascot) return null;
  const {pageOverrides, ...base} = mascot;
  const found = Array.isArray(pageOverrides) ? pageOverrides.find((item) => item.pageIndex === page.index) : null;
  if (!found?.wardrobe) return base;
  return {...base, ...found.wardrobe};
}

function pagePos(timeline, page) {
  const pos = timeline.pages.findIndex((item) => item.index === page.index);
  return pos >= 0 ? pos : timeline.pages.indexOf(page);
}

function neighborOf(timeline, page) {
  const pos = pagePos(timeline, page);
  const prev = pos > 0 ? timeline.pages[pos - 1] : null;
  if (!prev) return null;
  return {
    layout: prev.layout,
    presenter: prev.presenter ? {layout: prev.presenter.layout, aspectRatio: prev.presenter.aspectRatio ?? null} : null,
  };
}

/** 翻页时上一页的标题和内容会在这一页开头淡出。只收画面，不收时长，配音变长不会让后面的页失效。改一页的这些字段，会重渲这一页和下一页。 */
function visualOf(page, publicDir) {
  return {
    layout: page.layout,
    chapterIndex: page.chapterIndex ?? null,
    chapterTitle: page.chapterTitle ?? null,
    title: page.title,
    subtitle: page.subtitle ?? null,
    smallText: page.smallText ?? null,
    items: page.items ?? [],
    fields: freezeAssets(page.fields ?? {}, publicDir),
    narration: page.narration ?? [],
    pose: page.pose ?? [],
    presenter: page.presenter ? {layout: page.presenter.layout, aspectRatio: page.presenter.aspectRatio ?? null} : null,
    sentences: (page.sentences || []).map((sentence) => ({
      text: sentence.text,
      pose: sentence.pose ?? null,
      note: sentence.note ?? null,
      reveal: sentence.reveal ?? null,
    })),
  };
}

/** 指纹里的毫秒保留到 0.001，消掉页起点相减留下的浮点灰尘。不影响画面。 */
function roundMs(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function roundChars(chars) {
  return (chars || []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    return {...item, startMs: roundMs(item.startMs), endMs: roundMs(item.endMs)};
  });
}

function pageBody(page, timeline, publicDir, relative) {
  const originMs = relative ? page.startMs : 0;
  return {
    index: page.index,
    chapterIndex: page.chapterIndex,
    chapterTitle: page.chapterTitle,
    layout: page.layout,
    title: page.title,
    subtitle: page.subtitle ?? null,
    smallText: page.smallText ?? null,
    items: page.items ?? [],
    fields: freezeAssets(page.fields ?? {}, publicDir),
    revealTargets: page.revealTargets ?? [],
    narration: page.narration ?? [],
    pose: page.pose ?? [],
    durationFrames: page.durationFrames,
    audioLeadFrames: page.audioStartFrame - page.startFrame,
    audioDurationMs: roundMs(page.audioDurationMs),
    timingSource: page.timingSource ?? null,
    presenter: freezePresenter(page.presenter, publicDir),
    startFrame: relative ? 0 : page.startFrame,
    sentences: (page.sentences || []).map((sentence) => ({
      text: sentence.text,
      pose: sentence.pose ?? null,
      note: sentence.note ?? null,
      reveal: sentence.reveal ?? null,
      revealAtMs: roundMs(sentence.revealAtMs ?? null),
      startMs: roundMs(sentence.startMs - originMs),
      endMs: roundMs(sentence.endMs - originMs),
      chars: roundChars(sentence.chars),
    })),
    prev: neighborOf(timeline, page),
    chapterTitles: page.layout === 'chapter' ? (timeline.chapters || []).map((chapter) => chapter.title) : null,
  };
}

function sharedContext({engineHash, theme, mascot, domain, lang, sampleReview, trial, characterUnconfirmed, timeline, page, brand}) {
  return {
    engine: engineHash,
    theme: theme ?? null,
    domain: domain ?? null,
    lang: lang ?? null,
    sampleReview: sampleReview === true,
    trial: trial === true,
    characterUnconfirmed: characterUnconfirmed === true,
    presenterKind: presenterKindOf(timeline, mascot),
    wardrobe: wardrobeOf(page, mascot),
    fps: timeline.fps,
    width: timeline.width,
    height: timeline.height,
    brand: brand ?? null,
  };
}

/** 品牌档案不在引擎指纹里。变了只说明页面内容要重渲，不整片拒绝。 */
export function externalBrandChange({previous, brand}) {
  if (!previous) return '';
  const prev = previous.brand ?? null;
  const next = brand ?? null;
  const id = (item) => item?.id ?? null;
  const sha = (item) => item?.logoSha256 ?? null;
  if (id(prev) === id(next) && sha(prev) === sha(next)) return '';
  const was = id(prev) || '无';
  const now = id(next) || '无';
  return `品牌档案是引擎外输入，从 ${was} 变成 ${now}。页面内容变了会重渲；这不是引擎指纹变化，不会整片拒绝。已交付的片子仍钉在当时的版本。`;
}

function filmExtras(page, timeline) {
  const endCardStart = Math.max(0, timeline.totalFrames - END_CARD_FRAMES);
  const overlapsEnd = page.endFrame > endCardStart;
  const overlapsOpen = page.startFrame < OPENING_FRAMES;
  return {
    totalFrames: overlapsEnd ? timeline.totalFrames : null,
    endCardStart: overlapsEnd ? endCardStart : null,
    startFrame: overlapsOpen ? page.startFrame : null,
  };
}

/** 横版页指纹用页内相对时间。绝对起点只在片头 90 帧窗口里保留；片尾 120 帧窗口仍带总帧数。 */
export function filmFingerprint(input) {
  const {page, timeline, publicDir} = input;
  const pos = pagePos(timeline, page);
  const prev = pos > 0 ? timeline.pages[pos - 1] : null;
  return digest({
    ...sharedContext({...input, page}),
    page: pageBody(page, timeline, publicDir, true),
    prevVisual: prev ? visualOf(prev, publicDir) : null,
    film: filmExtras(page, timeline),
  });
}

/** 页内相对时间的内容指纹。竖版切片用它：不因前面页把整片撑长而失效。 */
export function contentFingerprint(input) {
  const {page, timeline, publicDir} = input;
  return digest({...sharedContext({...input, page}), page: pageBody(page, timeline, publicDir, true)});
}

export function segmentCacheFile(outDir, fingerprint) {
  return path.join(outDir, '.cache', 'segments', `${fingerprint}.mp4`);
}

export function segmentDecision({cacheExists, previousFingerprint, fingerprint, engineChanged}) {
  if (engineChanged) return {reuse: false, reason: '引擎已更换'};
  if (cacheExists) return {reuse: true, reason: '复用'};
  if (!previousFingerprint) return {reuse: false, reason: '首次出片'};
  if (previousFingerprint !== fingerprint) return {reuse: false, reason: '页面内容变化'};
  return {reuse: false, reason: '缓存缺失'};
}

export function segmentLog(index, decision) {
  const n = index + 1;
  if (decision.reuse) return `第 ${n} 页：复用`;
  return `第 ${n} 页：重渲（${decision.reason}）`;
}

export function verticalCacheFile(outDir, fingerprint) {
  return path.join(outDir, '.cache', 'vertical', `${fingerprint}.mp4`);
}

export function planVerticalClip({clip, contentsByIndex, previousLock, engineChanged, outDir}) {
  const indices = [];
  for (let index = clip.pageStart; index <= clip.pageEnd; index += 1) indices.push(index);
  const contents = indices.map((index) => contentsByIndex.get(index));
  const fingerprint = digest({contents, hookTitle: clip.hookTitle, legalTailFrames: clip.legalTailFrames || 0});
  const cacheFile = verticalCacheFile(outDir, fingerprint);
  let cacheExists = false;
  try { cacheExists = fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 1024; } catch { cacheExists = false; }
  const prevPages = new Map((previousLock?.pages || []).map((item) => [item.index, item.content]));
  const changed = [];
  if (previousLock) for (const index of indices) if (prevPages.get(index) !== contentsByIndex.get(index)) changed.push(index);
  let decision;
  if (engineChanged) decision = {reuse: false, reason: '引擎已更换'};
  else if (cacheExists) decision = {reuse: true, reason: '复用'};
  else if (!previousLock) decision = {reuse: false, reason: '首次出片'};
  else if (changed.length) decision = {reuse: false, reason: '页面内容变化'};
  else decision = {reuse: false, reason: '缓存缺失'};
  return {fingerprint, cacheFile, decision, changed, indices};
}

export function verticalLog(id, decision, changed) {
  if (decision.reuse) return `竖版 ${id}：复用`;
  if (decision.reason === '页面内容变化' && changed?.length) return `竖版 ${id}：重渲（第 ${changed.map((index) => index + 1).join('、')} 页有变化）`;
  return `竖版 ${id}：重渲（${decision.reason}）`;
}

export function cacheReady(file) {
  try { return fs.existsSync(file) && fs.statSync(file).size > 1024; } catch { return false; }
}

export function presenterRecord({characterBind, meta}) {
  if (characterBind?.manifest) return {kind: 'character', id: characterBind.manifest.id, version: characterBind.manifest.version ?? null};
  const presenter = meta?.presenter;
  if (presenter?.kind === 'video' || presenter?.kind === 'real') return {kind: presenter.kind, id: presenter.src || null, version: null};
  if (presenter?.kind === 'none' || meta?.mascot?.enabled === false) return {kind: 'none', id: null, version: null};
  return {kind: 'mascot', id: meta?.mascot?.id || presenter?.look?.preset || null, version: meta?.mascot?.version ?? null};
}

export function buildLockDocument({packageVersion, git, remotionVersion, theme, presenter, voice, music, engine, pages, vertical, brand}) {
  return {
    packageVersion: packageVersion ?? null,
    git: {commit: git?.commit ?? null, dirty: git?.dirty ?? null},
    remotionVersion: remotionVersion ?? null,
    theme: theme ?? null,
    presenter: presenter ?? null,
    voice: voice ?? null,
    music: music ?? null,
    engine: {hash: engine.hash, files: engine.files},
    brand: brand ?? null,
    pages,
    vertical: vertical || [],
  };
}

function runOk(run, args, what) {
  const result = run(args);
  if (!result || result.status !== 0) {
    const detail = String(result?.stderr || result?.stdout || result?.error || '').trim().slice(-800);
    throw new Error(`${what}：${detail || `退出码 ${result?.status}`}`);
  }
}

export function createFfmpegRunner({ffmpeg, remotion, template}) {
  return (args) => {
    if (ffmpeg) return spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024});
    return spawnSync(process.execPath, [remotion, 'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', ...args], {cwd: template, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024});
  };
}

export function readFrameCount(ffprobe, file) {
  const ran = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file], {encoding: 'utf8', windowsHide: true});
  const match = String(ran.stdout || '').match(/\d+/u);
  const n = match ? Number(match[0]) : NaN;
  if (ran.status !== 0 || !Number.isInteger(n) || n < 0) throw new Error(`读不到帧数：${path.basename(file)} ${String(ran.stderr || ran.stdout || ran.error?.message || '').trim()}`);
  return n;
}

export function concatVideos({run, segments, listPath, outPath}) {
  const lines = segments.map((file) => `file '${file.replace(/\\/g, '/').replace(/'/g, `'\\''`)}'`);
  fs.mkdirSync(path.dirname(listPath), {recursive: true});
  fs.writeFileSync(listPath, lines.join('\n') + '\n', 'utf8');
  fs.rmSync(outPath, {force: true});
  runOk(run, ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath], '视频段拼接失败');
}

export function mixLessonAudio({run, pages, publicDir, bgmPath, fps, totalFrames, outPath, scriptPath}) {
  const totalSec = (totalFrames / fps).toFixed(6);
  const args = [];
  const lines = [];
  const labels = [];
  let inputIndex = 0;
  for (const page of pages) {
    if (!page.audio) continue;
    const audio = path.join(publicDir, page.audio);
    if (!fs.existsSync(audio)) throw new Error(`第 ${page.index + 1} 页配音文件不在：${audio}`);
    args.push('-i', audio);
    const delayMs = (page.audioStartFrame / fps * 1000).toFixed(3);
    const dur = (Math.max(1, Math.ceil(page.audioDurationMs * fps / 1000)) / fps).toFixed(6);
    lines.push(`[${inputIndex}]aresample=48000:osf=fltp:ochl=stereo,atrim=0:${dur},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs}[a${inputIndex}]`);
    labels.push(`[a${inputIndex}]`);
    inputIndex += 1;
  }
  if (bgmPath) {
    if (!fs.existsSync(bgmPath)) throw new Error(`配乐文件不在：${bgmPath}`);
    args.push('-stream_loop', '-1', '-i', bgmPath);
    const index = inputIndex;
    lines.push(`[${index}]aresample=48000:osf=fltp:ochl=stereo,volume=${BGM_PARAMS.volume},atrim=0:${totalSec},asetpts=PTS-STARTPTS[bgm]`);
    labels.push('[bgm]');
  }
  if (!labels.length) throw new Error('没有可混合的声音');
  if (labels.length === 1) lines.push(`${labels[0]}apad,atrim=0:${totalSec},asetpts=PTS-STARTPTS[aout]`);
  else lines.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0:duration=longest,apad,atrim=0:${totalSec},asetpts=PTS-STARTPTS[aout]`);
  fs.mkdirSync(path.dirname(scriptPath), {recursive: true});
  fs.writeFileSync(scriptPath, lines.join(';\n'), 'utf8');
  fs.rmSync(outPath, {force: true});
  runOk(run, [...args, '-filter_complex_script', scriptPath, '-map', '[aout]', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', outPath], '整片声音混合失败');
}

export function muxFilm({run, video, audio, outPath}) {
  const tmp = `${outPath}.mux.mp4`;
  fs.rmSync(tmp, {force: true});
  runOk(run, ['-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', tmp], '画面和声音合成失败');
  fs.rmSync(outPath, {force: true});
  fs.renameSync(tmp, outPath);
}
