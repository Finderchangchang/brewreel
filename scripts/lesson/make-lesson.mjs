#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {synthesizeCached, voiceConfigOf, PROVIDER_IDS} from '../lib/tts/index.mjs';
import {TtsError} from '../lib/tts/minimax.mjs';
import {acquireRenderLock, QueueTimeoutError} from '../lib/render-lock.mjs';
import {PRODUCT_FILES, clearStaleOutputs, mp4Duration, sha256Of, writeManifest} from '../lib/delivery.mjs';
import {blankRuns, contentRegionBlankRuns} from '../lib/blank-check.mjs';
import {buildTimeline, chaptersText, narrationText, pageFrames, platformChaptersText, toSrt} from './timeline.mjs';
import {validateLesson} from './validate-lesson.mjs';
import {brandContrastError, contrastFailures} from './style-rules.mjs';
import {checkReview} from './review.mjs';
import {aigcMetadataValue, aigcPayload, embedAigcMetadata, explicitMarking, findFullFfmpeg, findRemotionFfprobe, AIGC_METADATA_KEY, AIGC_NOTE} from './aigc-label.mjs';
import {internalLeaks} from './text-quality.mjs';
import {preparePresenterMedia, resolvePresenterSource} from './presenter-media.mjs';
import {cartoonOnScreen, resolveCartoonWardrobe} from '../../template/src/lesson/mascot/cast.mjs';
import {judgeBgmRun, probePythonBgm, skippedByFlag} from '../lib/bgm.mjs';
import {CharacterError, bindLessonCharacter, resolveDataDir} from './character-store.mjs';
import {resolveOutDir, showPath} from './paths.mjs';
import {coverCopy, coverTextIssues, planClips, publishForClip, sliceTimeline} from './vertical.mjs';
import {BGM_PARAMS, buildLockDocument, createFfmpegRunner, decideEngineChange, externalBrandChange, planVerticalClip, presenterRecord, readEngineFingerprint, readFrameCount, readGitState, readLock, readPackageVersion, readRemotionVersion, verticalLog, writeLock} from './segments.mjs';
import {BrandError, bindLessonBrand} from './brand-store.mjs';
import {appendBrandTail, brandFingerprint, disclaimerFor, nameBarPageOf, openingCredit, seriesLine} from './brand-render.mjs';
import {appendDisclaimerPage} from './disclaimer-page.mjs';
import {timelineClipIssues, timelineFrameLayout} from './timeline-frame.mjs';
import {ensureTemplateBrowser, withBrowserExecutable} from '../lib/remotion-browser.mjs';
import {openLessonRenderer, renderLessonFilm} from './render-ranges.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE = path.join(ROOT, 'template');
const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const EXIT = {OK: 0, INVALID: 1, USAGE: 2, REJECTED: 3, RENDER: 4};
class LessonError extends Error { constructor(code, message) { super(message); this.code = code; } }
const usage = '用法：node scripts/lesson/make-lesson.mjs <lesson.json> [--out <目录>] [--theme paper|lecture|product|editorial] [--voice-provider minimax|aliyun|volcengine|mock] [--no-bgm] [--draft] [--vertical] [--covers] [--accept-engine-change] [--data-dir <目录>] [--stills 0,5,12]；不写 --out 时，成片放在当前工作目录上一级的 brewreel-studio-out。真人视频按 lesson.meta.presenter 导入。卡通角色写 meta.presenter.character，未确认的角色不能正式出片。--vertical 出竖版切片，--covers 出三张封面，默认都不出。成片目录已有 lock.json 且引擎变了，默认停下；--accept-engine-change 用新引擎整片重出';
const args = process.argv.slice(2);
const valueOf = (k) => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1]; };
const valuedFlags = ['--out','--voice-provider','--stills','--theme','--data-dir'];
const inputArg = args.find((x, i) => !x.startsWith('--') && !valuedFlags.includes(args[i - 1]));
const outProvided = args.includes('--out');
const outArg = outProvided ? valueOf('--out') : undefined;
const noBgm = args.includes('--no-bgm');
const draft = args.includes('--draft');
const wantVertical = args.includes('--vertical');
const wantCovers = args.includes('--covers');
const acceptEngineChange = args.includes('--accept-engine-change');
const providerArg = valueOf('--voice-provider');
const stillsArg = valueOf('--stills');
const themeArg = valueOf('--theme');
const dataArg = valueOf('--data-dir');
const log = (...x) => console.log('[make-lesson]', ...x);
if (!inputArg || (outProvided && (!outArg || outArg.startsWith('--'))) || (providerArg && !PROVIDER_IDS.includes(providerArg)) || (themeArg && !['paper','lecture','product','editorial'].includes(themeArg)) || (stillsArg && !/^(?:\d+(?:\.\d+)?)(?:,\d+(?:\.\d+)?)*$/.test(stillsArg)) || (args.includes('--data-dir') && (!dataArg || dataArg.startsWith('--')))) {
  console.error(usage); process.exit(EXIT.USAGE);
}

const inputPath = path.resolve(inputArg);
const outDir = resolveOutDir(outArg);
const relativeOut = path.relative(ROOT, outDir);
if (!fs.existsSync(inputPath) || (relativeOut && !relativeOut.startsWith('..') && !path.isAbsolute(relativeOut))) {
  console.error(!fs.existsSync(inputPath) ? `找不到 lesson 文件：${inputPath}` : '输出目录必须位于仓库之外');
  process.exit(!fs.existsSync(inputPath) ? EXIT.USAGE : EXIT.USAGE);
}
if (!path.isAbsolute(relativeOut) && relativeOut !== '..' && !relativeOut.startsWith(`..${path.sep}`)) {
  console.error('输出目录必须位于仓库之外'); process.exit(EXIT.USAGE);
}

const safeExit = (code, message) => { if (message) console.error(message); process.exitCode = code; };
const runChild = (cmd, argv, options = {}) => new Promise((resolve) => {
  let child;
  try { child = spawn(cmd, argv, {windowsHide: true, ...options}); }
  catch (e) { resolve({code: -1, error: e.message, output: ''}); return; }
  let output = '';
  child.stdout?.on('data', (b) => { const s = b.toString(); output += s; if (s.trim()) process.stdout.write(s); });
  child.stderr?.on('data', (b) => { const s = b.toString(); output += s; if (s.trim()) process.stderr.write(s); });
  child.on('error', (e) => resolve({code: -1, error: e.message, output}));
  child.on('close', (code) => resolve({code: code ?? -1, output}));
});

let renderLock;
let assetDir;
let renderer;
const runStarted = Date.now();
try {
  fs.mkdirSync(outDir, {recursive: true});
  let lesson;
  try { lesson = JSON.parse(fs.readFileSync(inputPath, 'utf8')); }
  catch (e) { throw new LessonError(EXIT.INVALID, `lesson.json 解析失败：${e.message}`); }
  const internalNames = [...PRODUCT_FILES, 'lesson-props.json','sheet-props.json','sheet-debug.png','timeline.json','subtitles.srt','chapters.txt','chapters-platforms.txt'];
  const internalFiles = new Set(internalNames.map((name) => name.toLowerCase()));
  const inputReal = fs.realpathSync(inputPath);
  const inputCollision = path.dirname(inputReal).toLowerCase() === fs.realpathSync(outDir).toLowerCase() && internalFiles.has(path.basename(inputReal).toLowerCase());
  const linkedCollision = internalNames.some((name) => { const target = path.join(outDir,name); return fs.existsSync(target) && fs.realpathSync(target).toLowerCase() === inputReal.toLowerCase(); });
  if (inputCollision || linkedCollision) {
    throw new LessonError(EXIT.USAGE, `输入文件名 ${path.basename(inputPath)} 与输出产物冲突；请将讲稿另存为 lesson.json`);
  }
  const presenterKind = lesson.meta?.presenter?.kind;
  const presenterMode = presenterKind === 'video' || presenterKind === 'real';
  if (presenterMode && lesson.meta?.domain !== 'tech') throw new LessonError(EXIT.INVALID, '真人视频 V1 仅支持 tech 领域；legal 需要针对真人素材重新设计审稿绑定');
  if (presenterMode && providerArg) throw new LessonError(EXIT.USAGE, '真人视频使用源片原声，请勿传 --voice-provider');
  if (themeArg) lesson.meta = {...(lesson.meta ?? {}), theme: themeArg};
  if (presenterMode) {
    let sourcePath;
    try { sourcePath = resolvePresenterSource(lesson.meta.presenter.src, inputPath); }
    catch (e) { throw new LessonError(EXIT.INVALID, e.message); }
    const relativeSource = path.relative(fs.realpathSync(outDir), sourcePath);
    if (!relativeSource || (!relativeSource.startsWith('..') && !path.isAbsolute(relativeSource))) throw new LessonError(EXIT.USAGE, '真人源片须放在本次输出目录之外，避免清理或渲染覆盖');
  }
  const effectiveProvider = providerArg ?? lesson.meta?.voice?.provider ?? 'minimax';
  const packageInfo = readPackageVersion(ROOT);
  const gitState = readGitState(ROOT);
  const engine = readEngineFingerprint(ROOT);
  let previousLock = null;
  try { previousLock = readLock(outDir); }
  catch (e) { throw new LessonError(EXIT.INVALID, e.message); }
  const engineDecision = decideEngineChange({
    previous: previousLock,
    current: {...engine, packageVersion: packageInfo.version, git: gitState},
    accept: acceptEngineChange,
  });
  if (!engineDecision.ok) throw new LessonError(EXIT.INVALID, engineDecision.message);
  clearStaleOutputs(outDir, [inputPath]);
  for (const stale of ['lesson-props.json','sheet-props.json','sheet-debug.png']) {
    const stalePath = path.join(outDir, stale);
    if (path.resolve(stalePath).toLowerCase() !== inputPath.toLowerCase()) fs.rmSync(stalePath,{force:true});
  }
  fs.mkdirSync(path.join(outDir, 'check'), {recursive: true});
  const leaks = internalLeaks(lesson);
  if (!leaks.ok) throw new LessonError(EXIT.INVALID, `内部用语检查未通过：\n${leaks.blocks.map((e) => `  ✗ ${e}`).join('\n')}`);
  let review = null;
  if (lesson.meta?.domain === 'legal') {
    review = checkReview(lesson, inputPath);
    if (!review.ok) throw new LessonError(EXIT.INVALID, `律师审稿未通过（${review.reason}）；讲稿改过，需要律师重新审。审稿记录：${path.basename(review.path)}`);
    if (review.test) log('测试审稿：成片将标注「内部样片 · 未经律师审核」，不能当作律师审稿交付');
  }
  const validation = validateLesson(lesson);
  if (!validation.ok) throw new LessonError(EXIT.INVALID, `lesson.json 校验失败：\n${validation.errors.map((e) => `  ✗ ${e}`).join('\n')}`);
  for (const message of validation.warnings) log(`WARN ${message}`);
  for (const message of validation.human) log(`HUMAN ${message}`);
  let characterBind = null;
  if (validation.lesson.meta?.presenter?.character) {
    try { characterBind = bindLessonCharacter(validation.lesson, {dataDir: resolveDataDir(dataArg), draft}); }
    catch (e) { throw new LessonError(EXIT.INVALID, e instanceof CharacterError ? e.message : `角色档案无法用于出片：${e.message}`); }
    log(`角色 ${characterBind.manifest.id}@${characterBind.manifest.version}${characterBind.watermark ? '（未确认，试看）' : ''}`);
  }
  let brandBind = null;
  if (typeof validation.lesson.meta?.brand === 'string') {
    try { brandBind = bindLessonBrand(validation.lesson, {dataDir: resolveDataDir(dataArg)}); }
    catch (e) { throw new LessonError(EXIT.INVALID, e instanceof BrandError ? e.message : `品牌档案无法用于出片：${e.message}`); }
    log(`品牌 ${brandBind.id}`);
  }
  const brandLock = brandBind ? {id: brandBind.id, logoSha256: brandBind.logoSha256} : null;
  const brandNotice = externalBrandChange({previous: previousLock, brand: brandLock});
  if (brandNotice) log(brandNotice);

  const cfgMeta = {...lesson.meta, voice: {...(lesson.meta.voice ?? {}), provider: providerArg ?? lesson.meta.voice?.provider ?? 'minimax'}};
  const cfg = voiceConfigOf(cfgMeta);
  const id = `lesson-${process.pid}-${Date.now().toString(36)}`;
  assetDir = path.join(TEMPLATE, 'public', '_run', id);
  const voiceDir = path.join(assetDir, 'voice');
  fs.mkdirSync(voiceDir, {recursive: true});
  const audioPages = [];
  let billedCharacters = 0;
  let synthesizedPages = 0;
  let presenterManifest = null;
  if (presenterMode) {
    try {
      const prepared = preparePresenterMedia({lesson, lessonPath: inputPath, assetDir, runRel: `_run/${id}`, remotion: REMOTION, template: TEMPLATE, log});
      audioPages.push(...prepared.audioPages);
      presenterManifest = prepared.manifest;
    } catch (e) { throw new LessonError(EXIT.INVALID, e.message); }
  } else for (let ci = 0; ci < lesson.chapters.length; ci++) for (let pi = 0; pi < lesson.chapters[ci].pages.length; pi++) {
    const page = lesson.chapters[ci].pages[pi];
    const text = narrationText(page.narration);
    let r;
    try { r = await synthesizeCached(text, cfg); }
    catch (e) { throw new LessonError(EXIT.USAGE, `第 ${audioPages.length + 1} 页配音失败：${e instanceof TtsError ? e.zh : e.message}`); }
    const filename = `${String(audioPages.length + 1).padStart(2,'0')}-${r.key.slice(0,12)}.${r.ext}`;
    fs.copyFileSync(r.audioPath, path.join(voiceDir, filename));
    audioPages.push({words: r.words, durMs: r.durMs, src: `_run/${id}/voice/${filename}`, usageCharacters: r.usageCharacters ?? 0, cacheHit: r.cacheHit});
    billedCharacters += r.usageCharacters ?? 0;
    if (!r.cacheHit) synthesizedPages++;
    log(`第 ${audioPages.length} 页配音 ${r.durMs} ms${r.cacheHit ? '（缓存）' : ''}`);
  }

  let timeline = buildTimeline(validation.lesson, audioPages);
  let brandTimeline = {added: false, recapIndex: null};
  if (brandBind) {
    brandTimeline = appendBrandTail(timeline, lesson.meta.title);
    timeline = brandTimeline.timeline;
  }
  const disclaimerTail = appendDisclaimerPage(timeline, lesson.meta);
  timeline = disclaimerTail.timeline;
  if (timeline.durationMs < 30000 || timeline.durationMs > 480000) {
    throw new LessonError(EXIT.INVALID, `成片时长 ${Math.round(timeline.durationMs / 1000)} 秒不在 30 秒–8 分钟范围内`);
  }
  const inputHash = sha256Of(inputPath);
  if (!outProvided) log(`未指定 --out，成片目录：${showPath(outDir)}`);
  let bgm = null;
  let bgmStatus = noBgm ? 'disabled' : 'skipped';
  let bgmNote = noBgm ? skippedByFlag(true) : '';
  if (!noBgm) {
    const bgmFile = path.join(assetDir, 'bgm.wav');
    const intervals = timeline.pages.map((p) => [p.audioStartFrame / timeline.fps, (p.audioStartFrame / timeline.fps) + p.audioDurationMs / 1000]);
    const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    const pre = probePythonBgm(py);
    if (!pre.ok) {
      bgmNote = pre.message;
      log(bgmNote);
    } else {
      const bgmRes = spawnSync(py, [path.join(ROOT,'scripts','make_bgm.py'), '--duration', (timeline.durationMs / 1000).toFixed(3), '--bpm', String(BGM_PARAMS.bpm), '--theme', BGM_PARAMS.theme, '--cues', JSON.stringify(timeline.pages.map((p) => p.startMs / 1000)), '--moods', JSON.stringify(timeline.pages.map(() => 0.25)), '--types', JSON.stringify(timeline.pages.map((_, i) => i === 0 ? 'hook' : i === timeline.pages.length - 1 ? 'endCard' : 'x')), '--voice', JSON.stringify(intervals), '--duck-db', String(BGM_PARAMS.duckDb), '--duck-attack', String(BGM_PARAMS.duckAttack), '--duck-release', String(BGM_PARAMS.duckRelease), '--lufs', String(BGM_PARAMS.lufs), '--out', bgmFile], {cwd: ROOT, encoding: 'utf8', windowsHide: true, env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'}, maxBuffer: 8 * 1024 * 1024});
      const judged = judgeBgmRun({error: bgmRes.error?.message || '', status: bgmRes.status ?? -1, stderr: bgmRes.stderr || '', stdout: bgmRes.stdout || '', fileExists: fs.existsSync(bgmFile)});
      bgmNote = judged.message;
      if (judged.ok) { bgm = `_run/${id}/bgm.wav`; bgmStatus = 'generated-and-ducked'; }
      log(bgmNote);
    }
  } else log(bgmNote);
  const sampleReview = review?.test === true;
  const trial = false;
  const markings = explicitMarking(lesson.meta.domain, lesson.meta.lang, sampleReview, trial);
  if (disclaimerTail.added) {
    markings.disclaimer = disclaimerTail.body;
    markings.forcedEndCard = true;
  }
  const aigc = aigcPayload(inputHash);
  const validatedTheme = validation.lesson.meta.theme;
  const sheetOverride = process.env.BREWREEL_SHEET_THEME;
  const themeId = ['paper', 'lecture', 'product', 'editorial'].includes(sheetOverride) ? sheetOverride : validatedTheme;
  if (themeId !== validatedTheme) log(`画面主题按 BREWREEL_SHEET_THEME=${themeId} 渲染；讲稿校验仍按 ${validatedTheme}`);
  const contrast = contrastFailures(themeId);
  if (contrast.length) throw new LessonError(EXIT.INVALID, `对比度未过 4.5:1：\n${contrast.map((line) => `  ✗ ${line}`).join('\n')}`);
  if (brandBind) {
    const brandContrast = brandContrastError(themeId, brandBind.view.primary);
    if (brandContrast) throw new LessonError(EXIT.INVALID, brandContrast);
  }
  let brandProps = null;
  if (brandBind) {
    const brandDir = path.join(assetDir, 'brand');
    fs.mkdirSync(brandDir, {recursive: true});
    const logoExt = path.extname(brandBind.logoPath) || '.svg';
    fs.copyFileSync(brandBind.logoPath, path.join(brandDir, `logo${logoExt}`));
    let qrRel = null;
    if (brandBind.qrPath) {
      const qrExt = path.extname(brandBind.qrPath) || '.png';
      fs.copyFileSync(brandBind.qrPath, path.join(brandDir, `qr${qrExt}`));
      qrRel = `_run/${id}/brand/qr${qrExt}`;
    }
    const lawyer = brandBind.lawyer ? {
      name: brandBind.lawyer.name,
      title: brandBind.lawyer.title,
      department: brandBind.lawyer.department,
      firmLine: `${brandBind.view.firm} · ${brandBind.lawyer.department}`,
    } : null;
    const credit = openingCredit({review, lang: lesson.meta.lang});
    const episode = Number.isInteger(lesson.meta.episode) ? lesson.meta.episode : null;
    brandProps = {
      id: brandBind.id,
      logoSha256: brandBind.logoSha256,
      qrSha256: brandBind.qrSha256,
      firm: brandBind.view.firm,
      english: brandBind.view.english || '',
      column: brandBind.view.column,
      logo: `_run/${id}/brand/logo${logoExt}`,
      primary: brandBind.view.primary,
      secondary: brandBind.view.secondary,
      episode,
      tip: brandBind.view.tip,
      qr: qrRel,
      lawyer,
      series: seriesLine(brandBind.view.column, episode, lesson.meta.lang),
      openingAi: credit.ai,
      openingExtra: credit.extra,
      disclaimer: disclaimerFor(lesson.meta.domain, lesson.meta.lang),
      recapIndex: brandTimeline.recapIndex,
      nameBarPage: nameBarPageOf(timeline, lawyer),
    };
  }
  const renderMeta = characterBind
    ? {...validation.lesson.meta, presenter: {...validation.lesson.meta.presenter, kind: 'cartoon', look: characterBind.look}, mascot: validation.lesson.meta.mascot ? {...validation.lesson.meta.mascot, pageOverrides: undefined} : undefined}
    : validation.lesson.meta;
  const props = {timeline, title: lesson.meta.title, bgm, mascot: resolveCartoonWardrobe(renderMeta), theme: themeId, domain: lesson.meta.domain, lang: lesson.meta.lang, sampleReview, characterUnconfirmed: characterBind?.watermark === true, trial, brand: brandProps};
  const timelinePath = path.join(outDir, 'timeline.json');
  fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2) + '\n', 'utf8');
  const propsPath = path.join(outDir, 'lesson-props.json');
  fs.writeFileSync(propsPath, JSON.stringify(props), 'utf8');
  fs.writeFileSync(path.join(outDir, 'subtitles.srt'), toSrt(timeline), 'utf8');
  fs.writeFileSync(path.join(outDir, 'chapters.txt'), chaptersText(timeline), 'utf8');
  fs.writeFileSync(path.join(outDir, 'chapters-platforms.txt'), platformChaptersText(timeline), 'utf8');

  try { renderLock = await acquireRenderLock({file: path.join(TEMPLATE, '.render.lock'), id, log, timeoutMs: 20 * 60 * 1000}); }
  catch (e) { throw new LessonError(EXIT.RENDER, e instanceof QueueTimeoutError ? e.message : `获取渲染锁失败：${e.message}`); }
  const ffmpegBin = process.env.FFMPEG || (process.platform === 'win32' ? spawnSync('where', ['ffmpeg'], {encoding: 'utf8'}).stdout?.split(/\r?\n/).map((line) => line.trim()).find(Boolean) : spawnSync('which', ['ffmpeg'], {encoding: 'utf8'}).stdout?.trim());
  const runFfmpeg = createFfmpegRunner({ffmpeg: ffmpegBin, remotion: REMOTION, template: TEMPLATE});
  const ffprobe = findRemotionFfprobe(TEMPLATE);
  const fingerprintInput = {theme: themeId, mascot: props.mascot, domain: lesson.meta.domain, lang: lesson.meta.lang, sampleReview, trial, characterUnconfirmed: props.characterUnconfirmed === true, brand: brandFingerprint(props.brand)};
  const timelineProblems = [];
  for (const page of validation.lesson.chapters.flatMap((chapter) => chapter.pages ?? [])) {
    if (page?.layout !== 'timeline') continue;
    const issues = timelineClipIssues(timelineFrameLayout({
      nodes: (page.nodes ?? []).map((node) => node?.label ?? node),
      segments: page.segments ?? [],
      captions: page.captions ?? [],
      hasQuote: Boolean(page.quote),
    }));
    for (const issue of issues) timelineProblems.push(`${page.title || '时间轴'}：${issue}`);
  }
  if (timelineProblems.length) throw new LessonError(EXIT.REJECTED, `时间轴文字会被裁切：\n${timelineProblems.map((line) => `  ✗ ${line}`).join('\n')}`);
  let browserExe;
  try { browserExe = ensureTemplateBrowser({templateDir: TEMPLATE, log}); }
  catch (e) { throw new LessonError(EXIT.RENDER, e.message); }
  log(`渲染 ${timeline.totalFrames} 帧（${(timeline.durationMs / 1000).toFixed(1)} 秒），按页分段…`);
  let film;
  try {
    renderer = await openLessonRenderer({template: TEMPLATE, log, browserExecutable: browserExe});
    film = await renderLessonFilm({
      renderer,
      timeline,
      props,
      publicDir: path.join(TEMPLATE, 'public'),
      outDir,
      bgmPath: bgm ? path.join(TEMPLATE, 'public', bgm) : null,
      engineHash: engine.hash,
      previousLock: engineDecision.engineChanged ? null : previousLock,
      engineChanged: Boolean(engineDecision.engineChanged),
      runFfmpeg,
      ffprobe,
      log,
      fingerprintInput,
    });
  } catch (e) { throw new LessonError(EXIT.RENDER, e instanceof LessonError ? e.message : e.message); }
  const videoPath = film.videoPath;
  log(`画面分段 ${film.reused} 页复用，${film.rendered} 页重渲，拼接 ${(film.ms / 1000).toFixed(1)} 秒`);
  try { embedAigcMetadata({videoPath, payload: aigc, ffmpeg: findFullFfmpeg(TEMPLATE), ffprobe: findRemotionFfprobe(TEMPLATE)}); log('已用 Remotion 自带的 ffmpeg 把 AIGC 隐式标识写入成片元数据'); }
  catch (e) { throw new LessonError(EXIT.RENDER, e.message); }
  const finalFrames = readFrameCount(ffprobe, videoPath);
  if (finalFrames !== timeline.totalFrames) throw new LessonError(EXIT.RENDER, `成片 ${finalFrames} 帧，时间轴 ${timeline.totalFrames} 帧`);

  const seconds = [];
  for (const p of timeline.pages) for (const s of p.sentences) seconds.push(Math.min(timeline.durationMs / 1000 - .05, Math.max(0, s.startMs / 1000 + .5)));
  let selected = [...new Set(seconds.map((s) => Math.round(s * timeline.fps) / timeline.fps))].sort((a,b) => a-b);
  if (selected.length > 40) selected = Array.from({length: 40}, (_, i) => selected[Math.round(i * (selected.length - 1) / 39)]);
  const ffmpeg = ffmpegBin;
  const ff = (ffArgs) => ffmpeg ? spawnSync(ffmpeg, ['-y','-hide_banner','-loglevel','error',...ffArgs], {encoding:'utf8', windowsHide:true}) : spawnSync(process.execPath, [REMOTION,'ffmpeg','-y','-hide_banner','-loglevel','error',...ffArgs], {cwd:TEMPLATE,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
  for (let i = 0; i < selected.length; i++) {
    const at = selected[i];
    const png = path.join(outDir,'check',`${String(i+1).padStart(2,'0')}-${at.toFixed(2)}s.png`);
    const shot = ff(['-ss', at.toFixed(3), '-i', videoPath, '-frames:v', '1', png]);
    if (shot.status !== 0 || !fs.existsSync(png)) throw new LessonError(EXIT.RENDER, `抽取检查帧失败 ${at.toFixed(2)}s：${shot.stderr || shot.error}`);
  }
  const stillValues = stillsArg ? stillsArg.split(',').map(Number) : [];
  for (const at of stillValues) {
    const png = path.join(outDir,'check',`still-${at.toFixed(2)}s.png`);
    const still = await runChild(process.execPath, withBrowserExecutable([REMOTION,'still','src/index.ts','Lesson',png,`--frame=${Math.min(timeline.totalFrames-1, Math.max(0,Math.round(at*timeline.fps)))}`,`--props=${propsPath}`], browserExe),{cwd:TEMPLATE});
    if (still.code !== 0) throw new LessonError(EXIT.RENDER, `Remotion still 失败（${at}s）：${still.output.slice(-500)}`);
  }
  const sheetPath = path.join(outDir, 'sheet.png');
  const sheetDir = path.join(assetDir, 'sheet');
  fs.mkdirSync(sheetDir, {recursive: true});
  const sheetImages = selected.map((_, i) => {
    const name = `${String(i + 1).padStart(2,'0')}.png`;
    fs.copyFileSync(path.join(outDir,'check',`${String(i+1).padStart(2,'0')}-${selected[i].toFixed(2)}s.png`), path.join(sheetDir,name));
    return `_run/${id}/sheet/${name}`;
  });
  const sheetProps = path.join(outDir, 'sheet-props.json');
  fs.writeFileSync(sheetProps, JSON.stringify({images:sheetImages}), 'utf8');
  const sheet = await runChild(process.execPath, withBrowserExecutable([REMOTION,'still','src/index.ts','LessonSheet',sheetPath,`--props=${sheetProps}`], browserExe),{cwd:TEMPLATE});
  if (sheet.code !== 0 || !fs.existsSync(sheetPath)) throw new LessonError(EXIT.RENDER, `拼图生成失败（退出码 ${sheet.code}）：${sheet.error ?? sheet.output.slice(-1000)}`);
  fs.rmSync(propsPath,{force:true});
  fs.rmSync(sheetProps,{force:true});

  const blank = blankRuns({video: videoPath, fps: timeline.fps, cwd: TEMPLATE, contentAware: true, cmd: (a) => ffmpeg ? [ffmpeg,...a] : [process.execPath,REMOTION,'ffmpeg',...a]});
  if (blank.error) throw new LessonError(EXIT.REJECTED, `按内容空帧检查无法运行：${blank.error.trim().split('\n').at(-1)}`);
  if (blank.runs.length) throw new LessonError(EXIT.REJECTED, `按内容空帧检查不通过：${blank.runs.map((r) => `${r.from.toFixed(2)}–${r.to.toFixed(2)}s`).join(', ')}`);
  const regionBlank = contentRegionBlankRuns({video: videoPath, fps: timeline.fps, cwd: TEMPLATE, cmd: (a) => ffmpeg ? [ffmpeg,...a] : [process.execPath,REMOTION,'ffmpeg',...a]});
  if (regionBlank.error) throw new LessonError(EXIT.REJECTED, `内容区空帧检查无法运行：${regionBlank.error.trim().split('\n').at(-1)}`);
  if (regionBlank.runs.length) throw new LessonError(EXIT.REJECTED, `内容区空帧检查不通过：${regionBlank.runs.map((r) => `${r.from.toFixed(2)}–${r.to.toFixed(2)}s`).join(', ')}`);

  const durationSec = mp4Duration(videoPath);
  if (durationSec === null || Math.abs(durationSec - timeline.durationMs / 1000) > .5) throw new LessonError(EXIT.RENDER, `无法确认成片时长，期望 ${(timeline.durationMs / 1000).toFixed(2)} 秒，实测 ${durationSec}`);
  fs.rmSync(path.join(outDir, 'vertical'), {recursive: true, force: true});
  fs.rmSync(path.join(outDir, 'covers'), {recursive: true, force: true});
  const extraArtifacts = [];
  let verticalList;
  let coverList;
  const verticalLock = [];
  if (wantVertical || wantCovers) {
    const clips = planClips(timeline, {domain: lesson.meta.domain, courseTitle: lesson.meta.title});
    if (wantCovers) {
      const copy = coverCopy(lesson);
      const issues = coverTextIssues(lesson.meta.domain, [copy.title, copy.subtitle]);
      if (issues.length) throw new LessonError(EXIT.INVALID, `封面文字未过领域规则：\n${issues.map((e) => `  ✗ ${e}`).join('\n')}`);
    }
    if (wantVertical) {
      for (const clip of clips) {
        const issues = coverTextIssues(lesson.meta.domain, [clip.hookTitle]);
        if (issues.length) throw new LessonError(EXIT.INVALID, `封面文字未过领域规则：${clip.id}\n${issues.map((e) => `  ✗ ${e}`).join('\n')}`);
      }
    }
    const coverPresenter = timeline.pages.some((p) => p.presenter) ? 'real' : (cartoonOnScreen(props.mascot) ? 'cartoon' : 'none');
    let presenterImage = null;
    if (coverPresenter === 'real') {
      const src = timeline.pages.find((p) => p.presenter)?.presenter?.src;
      if (!src) throw new LessonError(EXIT.RENDER, '封面需要真人讲解员画面，但没有找到源片');
      presenterImage = `_run/${id}/presenter-frame.png`.replace(/\\/g, '/');
      const png = path.join(TEMPLATE, 'public', presenterImage);
      const shot = ff(['-ss', '0', '-i', path.join(TEMPLATE, 'public', src), '-frames:v', '1', png]);
      if (shot.status !== 0 || !fs.existsSync(png)) throw new LessonError(EXIT.RENDER, `抽取真人封面帧失败：${shot.stderr || shot.error || ''}`);
    }
    const stillOf = async (dest, stillProps) => {
      const propsFile = path.join(outDir, `${path.basename(dest, '.png')}-props.json`);
      fs.writeFileSync(propsFile, JSON.stringify(stillProps), 'utf8');
      const still = await runChild(process.execPath, withBrowserExecutable([REMOTION, 'still', 'src/index.ts', 'LessonCover', dest, `--props=${propsFile}`], browserExe), {cwd: TEMPLATE});
      fs.rmSync(propsFile, {force: true});
      if (still.code !== 0 || !fs.existsSync(dest)) throw new LessonError(EXIT.RENDER, `封面渲染失败：${path.basename(dest)}：${(still.error || still.output || '').slice(-800)}`);
    };
    const coverBase = {theme: themeId, lang: lesson.meta.lang, mascot: props.mascot, presenterKind: coverPresenter, presenterImage, brand: props.brand ? {logo: props.brand.logo, column: props.brand.column, primary: props.brand.primary} : null};
    if (wantCovers) {
      const copy = coverCopy(lesson);
      fs.mkdirSync(path.join(outDir, 'covers'), {recursive: true});
      coverList = [];
      for (const [aspect, name] of [['16x9', 'cover-16x9.png'], ['9x16', 'cover-9x16.png'], ['3x4', 'cover-3x4.png']]) {
        const dest = path.join(outDir, 'covers', name);
        log(`封面 ${name}`);
        await stillOf(dest, {...coverBase, aspect, title: copy.title, subtitle: copy.subtitle});
        coverList.push(`covers/${name}`);
        extraArtifacts.push(`covers/${name}`);
      }
    }
    if (wantVertical) {
      fs.mkdirSync(path.join(outDir, 'vertical'), {recursive: true});
      verticalList = [];
      const contentsByIndex = new Map(film.pages.map((page) => [page.index, page.content]));
      for (const clip of clips) {
        const sliced = sliceTimeline(timeline, clip);
        const clipVideo = path.join(outDir, 'vertical', `${clip.id}.mp4`);
        const plan = planVerticalClip({clip, contentsByIndex, previousLock: engineDecision.engineChanged ? null : previousLock, engineChanged: Boolean(engineDecision.engineChanged), outDir});
        log(verticalLog(clip.id, plan.decision, plan.changed));
        if (plan.decision.reuse) fs.copyFileSync(plan.cacheFile, clipVideo);
        else {
          const part = path.join(outDir, '.cache', 'work', `${plan.fingerprint}.part.mp4`);
          await renderer.renderPart({
            compositionId: 'LessonVertical',
            inputProps: {...props, timeline: sliced, orientation: 'vertical', hookTitle: clip.hookTitle, legalTailFrames: clip.legalTailFrames || 0},
            outputLocation: part,
            frameRange: null,
            muted: false,
            label: `竖版 ${clip.id} `,
          });
          const clipFrames = readFrameCount(ffprobe, part);
          if (clipFrames !== sliced.totalFrames) throw new LessonError(EXIT.RENDER, `竖版切片 ${clip.id} 渲染了 ${clipFrames} 帧，时间轴是 ${sliced.totalFrames} 帧`);
          fs.mkdirSync(path.dirname(plan.cacheFile), {recursive: true});
          fs.rmSync(plan.cacheFile, {force: true});
          fs.renameSync(part, plan.cacheFile);
          fs.copyFileSync(plan.cacheFile, clipVideo);
        }
        if (!fs.existsSync(clipVideo) || fs.statSync(clipVideo).size < 1024) throw new LessonError(EXIT.RENDER, `竖版切片 ${clip.id} 没有生成`);
        try { embedAigcMetadata({videoPath: clipVideo, payload: aigc, ffmpeg: findFullFfmpeg(TEMPLATE), ffprobe: findRemotionFfprobe(TEMPLATE)}); }
        catch (e) { throw new LessonError(EXIT.RENDER, e.message); }
        verticalLock.push({id: clip.id, fingerprint: plan.fingerprint, pageStart: clip.pageStart, pageEnd: clip.pageEnd});
        const clipSec = mp4Duration(clipVideo);
        if (clipSec === null || Math.abs(clipSec - sliced.durationMs / 1000) > .5) throw new LessonError(EXIT.RENDER, `无法确认竖版切片 ${clip.id} 时长，期望 ${(sliced.durationMs / 1000).toFixed(2)} 秒，实测 ${clipSec}`);
        const pub = publishForClip(clip, {courseTitle: lesson.meta.title, domain: lesson.meta.domain, tags: lesson.meta.tags});
        const publishRel = `vertical/${clip.id}.publish.txt`;
        fs.writeFileSync(path.join(outDir, publishRel), pub.text, 'utf8');
        const coverRel = `vertical/${clip.id}.cover.png`;
        await stillOf(path.join(outDir, coverRel), {...coverBase, aspect: '9x16', title: clip.hookTitle, subtitle: ''});
        const videoRel = `vertical/${clip.id}.mp4`;
        extraArtifacts.push(videoRel, coverRel, publishRel);
        verticalList.push({id: clip.id, video: videoRel, cover: coverRel, publish: publishRel, durationSec: clipSec, contentSec: Number((clip.durationMs / 1000).toFixed(3)), hookTitle: clip.hookTitle, chapters: clip.chapterTitles, pageStart: clip.pageStart + 1, pageEnd: clip.pageEnd + 1});
      }
    }
  }
  const artifacts = ['video.mp4','subtitles.srt','chapters.txt','chapters-platforms.txt','timeline.json','manifest.json','sheet.png',...fs.readdirSync(path.join(outDir,'check')).filter((x)=>x.endsWith('.png')).map((x)=>`check/${x}`), ...extraArtifacts];
  const onScreenPresenter = presenterRecord({characterBind, meta: renderMeta});
  const manifest = {status: draft ? 'draft' : 'delivered', input:{path:inputPath,sha256:inputHash}, domain:lesson.meta.domain, theme:themeId, presenter:onScreenPresenter, review:review ? {reviewer:review.review.reviewer,license_no:review.review.license_no,reviewed_at:review.review.reviewed_at,script_sha256:review.hash,decision:review.review.decision,test:review.test === true,kind:review.test ? '测试审稿' : '律师审稿'} : null, domainChecks:{warnings:validation.warnings,human:validation.human,summary:validation.domainSummary}, legalMarkings:markings, aigc:{metadataKey:AIGC_METADATA_KEY,Label:aigc.Label,ContentProducer:aigc.ContentProducer,ProduceID:aigc.ProduceID,value:aigcMetadataValue(aigc),note:AIGC_NOTE}, durationSec, chapters:timeline.chapters.map((c)=>({title:c.title,startMs:c.startMs,endMs:c.endMs})), pages:timeline.pages.map((p)=>({index:p.index+1,title:p.title,chapter:p.chapterTitle,startMs:p.startMs,endMs:p.endMs})), voice:{provider:cfg.provider,voiceId:cfg.voiceId,model:cfg.model,billedCharacters,synthesizedPages,cachePages:audioPages.filter((x)=>x.cacheHit).length}, music:bgmStatus, musicNote:bgmNote, checks:{contentAwareBlank:{ok:true,frames:blank.frames,method:'192x108 area-resampled RGB; dominant-color ratio >=95% is blank only when fewer than 0.3% pixels differ from quantized background by RGB-L1 >=70'}}, video:{path:videoPath,sha256:sha256Of(videoPath),bytes:fs.statSync(videoPath).size,durationSec}, artifacts, generatedAt:new Date().toISOString()};
  if (draft) manifest.draft = true;
  if (verticalList) manifest.vertical = verticalList;
  if (coverList) manifest.covers = coverList;
  if (characterBind) manifest.character = characterBind.manifest;
  if (brandLock) manifest.brand = brandLock;
  if (presenterManifest) {
    manifest.presenter = presenterManifest;
    manifest.voice = {provider: 'source-video', timingSource: 'manual-sentence', billedCharacters: 0, synthesizedPages: 0, cachePages: 0};
  }
  if (engineDecision.engineChanged) manifest.engineChanged = engineDecision.engineChanged;
  if (themeId !== validatedTheme) manifest.validatedTheme = validatedTheme;
  writeManifest(outDir,manifest);
  writeLock(outDir, buildLockDocument({
    packageVersion: packageInfo.version,
    git: gitState,
    remotionVersion: readRemotionVersion(ROOT),
    theme: themeId,
    presenter: onScreenPresenter,
    voice: presenterManifest ? {provider: 'source-video', model: null, voiceId: null} : {provider: cfg.provider, model: cfg.model, voiceId: cfg.voiceId},
    music: {status: bgmStatus, bpm: BGM_PARAMS.bpm, theme: BGM_PARAMS.theme, duckDb: BGM_PARAMS.duckDb, duckAttack: BGM_PARAMS.duckAttack, duckRelease: BGM_PARAMS.duckRelease, lufs: BGM_PARAMS.lufs, volume: BGM_PARAMS.volume},
    engine,
    pages: film.pages,
    vertical: verticalLock,
    brand: brandLock,
  }));
  log(`配音计费 ${presenterManifest ? 0 : billedCharacters} 字`);
  log(`本次出片 ${((Date.now() - runStarted) / 1000).toFixed(1)} 秒`);
  if (onScreenPresenter.kind === 'none') log('讲解员已关闭');
  log(`交付清单：风格 ${themeId}，讲解员 ${onScreenPresenter.kind === 'none' ? '已关闭' : JSON.stringify(renderMeta.presenter ?? onScreenPresenter)}`);
  log(`交付：${videoPath}`);
} catch (e) {
  safeExit(e instanceof LessonError ? e.code : EXIT.RENDER, e instanceof LessonError ? e.message : `讲解课渲染失败：${e?.stack ?? e}`);
} finally {
  if (renderer) { try { await renderer.close(); } catch { /* 浏览器已经关了 */ } }
  renderLock?.release();
  if (assetDir) { try { fs.rmSync(assetDir,{recursive:true,force:true}); } catch {} }
}
