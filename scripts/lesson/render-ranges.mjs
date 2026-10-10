// 按页渲静音画面，拼起来再混上整片声音。渲的仍是完整 Lesson，只截这一页的帧范围。
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {
  cacheReady,
  concatVideos,
  contentFingerprint,
  filmFingerprint,
  mixLessonAudio,
  muxFilm,
  readFrameCount,
  segmentCacheFile,
  segmentDecision,
  segmentLog,
} from './segments.mjs';
import {chromeModeForExecutable, ensureTemplateBrowser} from '../lib/remotion-browser.mjs';

export async function openLessonRenderer({template, log = () => {}, browserExecutable = null}) {
  const require = createRequire(path.join(template, 'package.json'));
  const {bundle} = require('@remotion/bundler');
  const {renderMedia, selectComposition, openBrowser} = require('@remotion/renderer');
  log('打包课程画面…');
  const serveUrl = await bundle({
    entryPoint: path.join(template, 'src', 'index.ts'),
    publicDir: path.join(template, 'public'),
    rootDir: template,
    enableCaching: true,
    webpackOverride: (config) => config,
  });
  const exe = browserExecutable || ensureTemplateBrowser({templateDir: template, log});
  const browser = await openBrowser('chrome', {browserExecutable: exe, chromeMode: chromeModeForExecutable(exe), logLevel: 'error'});
  const compositions = new Map();
  return {
    serveUrl,
    async renderPart({compositionId, inputProps, outputLocation, frameRange, muted, label}) {
      const key = `${compositionId}\n${JSON.stringify(inputProps)}`;
      let composition = compositions.get(key);
      if (!composition) {
        composition = await selectComposition({
          serveUrl,
          id: compositionId,
          inputProps,
          puppeteerInstance: browser,
          logLevel: 'error',
        });
        compositions.set(key, composition);
      }
      fs.mkdirSync(path.dirname(outputLocation), {recursive: true});
      fs.rmSync(outputLocation, {force: true});
      let lastLog = -100;
      try {
        await renderMedia({
          composition,
          serveUrl,
          codec: 'h264',
          outputLocation,
          inputProps,
          frameRange: frameRange ?? null,
          muted: muted === true,
          enforceAudioTrack: muted === true ? false : undefined,
          puppeteerInstance: browser,
          overwrite: true,
          logLevel: 'error',
          hardwareAcceleration: 'disable',
          pixelFormat: 'yuv420p',
          onProgress: ({renderedFrames}) => {
            const n = renderedFrames || 0;
            if (n - lastLog >= 200) {
              lastLog = n;
              log(`${label} ${n} 帧`);
            }
          },
        });
      } catch (error) {
        throw new Error(`${label}渲染失败：${error?.message || error}`);
      }
    },
    async close() {
      try { await browser.close({silent: true}); }
      catch { /* 浏览器已经关了 */ }
    },
  };
}

/** 横版：每页一段静音视频，缓存命中就复用，最后拼上整片声音。 */
export async function renderLessonFilm({
  renderer,
  timeline,
  props,
  publicDir,
  outDir,
  bgmPath,
  engineHash,
  previousLock,
  engineChanged,
  runFfmpeg,
  ffprobe,
  log,
  fingerprintInput,
}) {
  if (!ffprobe) throw new Error('找不到 ffprobe，无法核对分段帧数');
  const started = Date.now();
  const workDir = path.join(outDir, '.cache', 'work');
  fs.rmSync(workDir, {recursive: true, force: true});
  fs.mkdirSync(workDir, {recursive: true});
  const prevByIndex = new Map((previousLock?.pages || []).map((item) => [item.index, item]));
  const segments = [];
  const pages = [];
  let reused = 0;
  let rendered = 0;
  for (const page of timeline.pages) {
    const input = {page, timeline, publicDir, engineHash, ...fingerprintInput};
    const film = filmFingerprint(input);
    const content = contentFingerprint(input);
    const cacheFile = segmentCacheFile(outDir, film);
    let decision = segmentDecision({
      cacheExists: cacheReady(cacheFile),
      previousFingerprint: prevByIndex.get(page.index)?.film,
      fingerprint: film,
      engineChanged,
    });
    if (decision.reuse) {
      const cachedFrames = readFrameCount(ffprobe, cacheFile);
      if (cachedFrames !== page.durationFrames) decision = {reuse: false, reason: '缓存帧数不对'};
    }
    log(segmentLog(page.index, decision));
    if (!decision.reuse) {
      const part = path.join(workDir, `${film}.part.mp4`);
      await renderer.renderPart({
        compositionId: 'Lesson',
        inputProps: props,
        outputLocation: part,
        frameRange: [page.startFrame, page.endFrame - 1],
        muted: true,
        label: `第 ${page.index + 1} 页`,
      });
      const frames = readFrameCount(ffprobe, part);
      if (frames !== page.durationFrames) throw new Error(`第 ${page.index + 1} 页渲染了 ${frames} 帧，时间轴是 ${page.durationFrames} 帧`);
      fs.mkdirSync(path.dirname(cacheFile), {recursive: true});
      fs.rmSync(cacheFile, {force: true});
      fs.renameSync(part, cacheFile);
      rendered += 1;
    } else reused += 1;
    segments.push(cacheFile);
    pages.push({index: page.index, film, content, startFrame: page.startFrame, endFrame: page.endFrame});
  }
  const silent = path.join(workDir, 'silent.mp4');
  concatVideos({run: runFfmpeg, segments, listPath: path.join(workDir, 'concat.txt'), outPath: silent});
  const joined = readFrameCount(ffprobe, silent);
  if (joined !== timeline.totalFrames) throw new Error(`拼接后 ${joined} 帧，时间轴 ${timeline.totalFrames} 帧`);
  const audio = path.join(workDir, 'audio.wav');
  mixLessonAudio({
    run: runFfmpeg,
    pages: timeline.pages.map((page) => ({
      index: page.index,
      audio: page.audio,
      audioStartFrame: page.audioStartFrame,
      audioDurationMs: page.audioDurationMs,
    })),
    publicDir,
    bgmPath,
    fps: timeline.fps,
    totalFrames: timeline.totalFrames,
    outPath: audio,
    scriptPath: path.join(workDir, 'mix.txt'),
  });
  const videoPath = path.join(outDir, 'video.mp4');
  muxFilm({run: runFfmpeg, video: silent, audio, outPath: videoPath});
  const muxed = readFrameCount(ffprobe, videoPath);
  if (muxed !== timeline.totalFrames) throw new Error(`合成后 ${muxed} 帧，时间轴 ${timeline.totalFrames} 帧`);
  fs.rmSync(workDir, {recursive: true, force: true});
  return {pages, ms: Date.now() - started, reused, rendered, videoPath};
}
