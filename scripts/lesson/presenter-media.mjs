import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha256Of} from '../lib/delivery.mjs';

const FPS = 30;
const NORMALIZE_VERSION = 1;
const AUDIO_VERSION = 1;
const LAYOUTS = new Set(['pip', 'full', 'hidden']);
const fail = (message) => { throw new Error(`真人素材：${message}`); };
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sec = (ms) => (ms / 1000).toFixed(6);

export function resolvePresenterSource(src, lessonPath) {
  if (typeof src !== 'string' || !src.trim()) fail('meta.presenter.src 必须是本地 MP4 路径');
  const name = src.trim();
  if (/^[a-z][a-z\d+.-]*:\/\//iu.test(name) || /^\\\\/u.test(name) || /^\/\//u.test(name)) fail('不接受 URL 或网络共享路径');
  if (path.extname(name).toLowerCase() !== '.mp4') fail('目前只接受 MP4 文件');
  const resolved = path.resolve(path.dirname(path.resolve(lessonPath)), name);
  let actual;
  try { actual = fs.realpathSync(resolved); }
  catch { fail(`找不到 MP4：${resolved}`); }
  if (actual.startsWith('\\\\') || actual.startsWith('//')) fail('不接受网络共享文件');
  if (!fs.statSync(actual).isFile()) fail('src 必须指向普通文件');
  return actual;
}

export function validatePresenterSegments(lesson, durationMs) {
  const presenter = lesson?.meta?.presenter;
  if (!presenter || (presenter.kind !== 'video' && presenter.kind !== 'real')) fail('meta.presenter.kind 必须为 real 或 video');
  const defaultLayout = presenter.layout ?? 'pip';
  if (!LAYOUTS.has(defaultLayout)) fail('layout 必须为 pip、full 或 hidden');
  const pages = (lesson.chapters ?? []).flatMap((chapter) => chapter.pages ?? []);
  if (!Array.isArray(presenter.segments) || presenter.segments.length !== pages.length) fail(`segments 必须与 ${pages.length} 页一一对应`);
  let previousSegmentEnd = 0;
  return presenter.segments.map((segment, index) => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) fail(`第 ${index + 1} 页 segment 必须是对象`);
    if (segment.pageIndex !== index) fail(`第 ${index + 1} 页 pageIndex 必须为 ${index}`);
    const {startMs, endMs} = segment;
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs) fail(`第 ${index + 1} 页源片起止毫秒无效`);
    if (startMs < previousSegmentEnd) fail(`第 ${index + 1} 页片段与前一页交叠或源时间倒退`);
    previousSegmentEnd = endMs;
    if (Number.isFinite(durationMs) && endMs > durationMs) fail(`第 ${index + 1} 页片段超出源片时长`);
    const layout = segment.layout ?? defaultLayout;
    if (!LAYOUTS.has(layout)) fail(`第 ${index + 1} 页 layout 必须为 pip、full 或 hidden`);
    if (!Array.isArray(segment.sentences) || segment.sentences.length !== pages[index].narration.length) fail(`第 ${index + 1} 页句子时间须与旁白逐条对应`);
    let previousEnd = 0;
    const sentences = segment.sentences.map((sentence, si) => {
      if (!sentence || !Number.isInteger(sentence.startMs) || !Number.isInteger(sentence.endMs) || sentence.startMs < previousEnd || sentence.endMs <= sentence.startMs || sentence.endMs > endMs - startMs) fail(`第 ${index + 1} 页第 ${si + 1} 句时间越界或交叠`);
      previousEnd = sentence.endMs;
      return {startMs: sentence.startMs, endMs: sentence.endMs};
    });
    return {pageIndex: index, startMs, endMs, layout, sentences};
  });
}

export function presenterCacheDir(env = process.env) {
  if (env.BREWREEL_PRESENTER_CACHE) return path.resolve(env.BREWREEL_PRESENTER_CACHE);
  const base = env.XDG_CACHE_HOME ? path.resolve(env.XDG_CACHE_HOME) : path.join(os.homedir(), '.cache');
  return path.join(base, 'brewreel', 'presenter');
}

function runRemotion(remotion, template, command, argv) {
  const result = spawnSync(process.execPath, [remotion, command, ...argv], {cwd: template, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024});
  if (result.error || result.status !== 0) fail(`${command} 失败：${String(result.stderr || result.error?.message || result.stdout || '').trim().slice(-1200)}`);
  return result.stdout;
}

export function probePresenterMedia(file, {remotion, template}) {
  const stdout = runRemotion(remotion, template, 'ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,width,height,r_frame_rate','-of','json',file]);
  let data;
  try { data = JSON.parse(stdout); } catch { fail('ffprobe 返回了无效媒体信息'); }
  if (!data.streams?.some((stream) => stream.codec_type === 'video')) fail('MP4 缺少视频流');
  if (!data.streams?.some((stream) => stream.codec_type === 'audio')) fail('MP4 缺少音轨');
  const durationMs = Math.round(Number(data.format?.duration) * 1000);
  if (!Number.isFinite(durationMs) || durationMs <= 0) fail('无法读取 MP4 时长');
  const video = data.streams.find((stream) => stream.codec_type === 'video');
  return {durationMs, width: video.width, height: video.height, frameRate: video.r_frame_rate};
}

function probeAudioDuration(file, {remotion, template}) {
  const stdout = runRemotion(remotion, template, 'ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',file]);
  let data;
  try { data = JSON.parse(stdout); } catch { fail('无法解析抽取音频的媒体信息'); }
  if (!data.streams?.some((stream) => stream.codec_type === 'audio')) fail('抽取结果缺少音轨');
  const durationMs = Math.round(Number(data.format?.duration) * 1000);
  if (!Number.isFinite(durationMs) || durationMs <= 0) fail('无法读取抽取音频时长');
  return durationMs;
}

function ensureCached(file, create) {
  if (fs.existsSync(file) && fs.statSync(file).size > 1024) return true;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const tmp = `${file}.tmp-${process.pid}-${Date.now().toString(36)}${path.extname(file)}`;
  try {
    create(tmp);
    if (!fs.existsSync(tmp) || fs.statSync(tmp).size <= 1024) fail('媒体转换未产生有效文件');
    if (fs.existsSync(file)) fs.rmSync(file, {force: true});
    fs.renameSync(tmp, file);
  } finally { fs.rmSync(tmp, {force: true}); }
  return false;
}

/** 准备已录好音的真人 MP4。视频 muted，声音只从按页提取的 WAV 播放。 */
export function preparePresenterMedia({lesson, lessonPath, assetDir, runRel, remotion, template, log = () => {}, env = process.env}) {
  const sourcePath = resolvePresenterSource(lesson.meta.presenter.src, lessonPath);
  const sourceInfo = probePresenterMedia(sourcePath, {remotion, template});
  const segments = validatePresenterSegments(lesson, sourceInfo.durationMs);
  const sourceSha256 = sha256Of(sourcePath);
  const cacheDir = presenterCacheDir(env);
  const videoKey = digest([NORMALIZE_VERSION, sourceSha256, FPS, 'h264-yuv420p-aac48k']);
  const normalizedPath = path.join(cacheDir, `${videoKey}.mp4`);
  const normalizedCacheHit = ensureCached(normalizedPath, (tmp) => {
    log('规范化真人视频为 30fps MP4…');
    runRemotion(remotion, template, 'ffmpeg', ['-y','-hide_banner','-loglevel','error','-i',sourcePath,'-map','0:v:0','-map','0:a:0','-r',String(FPS),'-fps_mode','cfr','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',tmp]);
  });
  const normalizedInfo = probePresenterMedia(normalizedPath, {remotion, template});
  if (normalizedInfo.frameRate !== '30/1') fail(`规范化视频帧率不是 30fps：${normalizedInfo.frameRate}`);
  const aspectRatio = normalizedInfo.width / normalizedInfo.height;
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) fail('无法读取规范化视频的显示宽高比');
  if (normalizedInfo.durationMs + 34 < Math.max(...segments.map((s) => s.endMs))) fail('规范化后的视频短于所选片段');
  fs.mkdirSync(assetDir, {recursive: true});
  const copiedVideo = path.join(assetDir, 'presenter.mp4');
  fs.copyFileSync(normalizedPath, copiedVideo);
  const videoSrc = `${runRel}/presenter.mp4`;
  const audioDir = path.join(assetDir, 'voice');
  fs.mkdirSync(audioDir, {recursive: true});
  let audioCacheHits = 0;
  const audioPages = segments.map((segment, index) => {
    const durMs = segment.endMs - segment.startMs;
    const audioKey = digest([AUDIO_VERSION, videoKey, segment.startMs, segment.endMs, 'pcm_s16le-48k-stereo']);
    const cachedWav = path.join(cacheDir, `${audioKey}.wav`);
    const hit = ensureCached(cachedWav, (tmp) => {
      runRemotion(remotion, template, 'ffmpeg', ['-y','-hide_banner','-loglevel','error','-i',normalizedPath,'-ss',sec(segment.startMs),'-t',sec(durMs),'-vn','-af','apad','-ar','48000','-ac','2','-c:a','pcm_s16le',tmp]);
    });
    const extractedMs = probeAudioDuration(cachedWav, {remotion, template});
    if (Math.abs(extractedMs - durMs) > 40) fail(`第 ${index + 1} 页抽取音频时长 ${extractedMs}ms 与映射 ${durMs}ms 不符`);
    if (hit) audioCacheHits++;
    const name = `${String(index + 1).padStart(2,'0')}-${audioKey.slice(0,12)}.wav`;
    fs.copyFileSync(cachedWav, path.join(audioDir, name));
    return {durMs, src: `${runRel}/voice/${name}`, words: [], sentenceTimings: segment.sentences, presenter: {src: videoSrc, startMs: segment.startMs, endMs: segment.endMs, layout: segment.layout, aspectRatio}};
  });
  log(`真人原声 ${audioPages.length} 页；视频缓存${normalizedCacheHit ? '命中' : '新建'}，音频缓存命中 ${audioCacheHits} 页；句级手工时间，不含逐字 ASR。`);
  return {audioPages, manifest: {provider: 'source-video', sourcePath, sourceSha256, sourceDurationMs: sourceInfo.durationMs, normalizedSha256: sha256Of(normalizedPath), normalizedDurationMs: normalizedInfo.durationMs, normalizedCacheHit, audioCacheHits, pages: audioPages.length, timingSource: 'manual-sentence', layout: lesson.meta.presenter.layout ?? 'pip', billedCharacters: 0}};
}
