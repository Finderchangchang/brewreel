import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {preparePresenterMedia, resolvePresenterSource, validatePresenterSegments} from './presenter-media.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const template = path.join(root, 'template');
const remotion = path.join(template, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'brewreel-presenter-test-'));
const source = path.join(temp, 'presenter.mp4');
const lessonPath = path.join(temp, 'lesson.json');
const makeLesson = (src = 'presenter.mp4') => ({meta: {presenter: {kind: 'video', src, layout: 'pip', segments: [
  {pageIndex: 0, startMs: 0, endMs: 1500, sentences: [{startMs: 0, endMs: 600}, {startMs: 700, endMs: 1300}]},
  {pageIndex: 1, startMs: 1700, endMs: 3200, layout: 'hidden', sentences: [{startMs: 100, endMs: 1400}]},
]}}, chapters: [{pages: [{narration: [{text: '第一句'}, {text: '第二句'}]}, {narration: [{text: '第三句'}]}]}]});

try {
  assert.throws(() => resolvePresenterSource('https://example.com/a.mp4', lessonPath), /URL/);
  assert.throws(() => resolvePresenterSource('\\\\server\\share\\a.mp4', lessonPath), /网络共享/);
  assert.throws(() => validatePresenterSegments(makeLesson(), 2500), /超出源片时长/);
  const wrongCount = makeLesson();
  wrongCount.meta.presenter.segments[0].sentences.pop();
  assert.throws(() => validatePresenterSegments(wrongCount, 4000), /逐条对应/);
  const overlap = makeLesson();
  overlap.meta.presenter.segments[0].sentences[1].startMs = 500;
  assert.throws(() => validatePresenterSegments(overlap, 4000), /交叠/);
  const pageOverlap = makeLesson();
  pageOverlap.meta.presenter.segments[1].startMs = 1400;
  assert.throws(() => validatePresenterSegments(pageOverlap, 4000), /交叠/);

  const generated = spawnSync(process.execPath, [remotion, 'ffmpeg', '-y','-hide_banner','-loglevel','error','-loop','1','-framerate','24','-i',path.join(root,'examples','assets','meeting-screen.png'),'-stream_loop','-1','-i',path.join(template,'public','sfx','ding.wav'),'-t','4','-vf','scale=180:320','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source], {cwd: template, encoding: 'utf8', windowsHide: true});
  assert.equal(generated.status, 0, generated.stderr || generated.error?.message);
  const lesson = makeLesson();
  const env = {...process.env, BREWREEL_PRESENTER_CACHE: path.join(temp, 'cache')};
  const first = preparePresenterMedia({lesson, lessonPath, assetDir: path.join(temp, 'run-1'), runRel: '_run/test-1', remotion, template, env});
  assert.equal(first.audioPages.length, 2);
  assert.equal(first.manifest.provider, 'source-video');
  assert.equal(first.manifest.timingSource, 'manual-sentence');
  assert.equal(first.manifest.audioCacheHits, 0);
  assert.ok(fs.statSync(path.join(temp, 'run-1', 'presenter.mp4')).size > 1024);
  assert.ok(fs.statSync(path.join(temp, 'run-1', 'voice', path.basename(first.audioPages[0].src))).size > 1024);
  assert.deepEqual(first.audioPages[0].sentenceTimings, lesson.meta.presenter.segments[0].sentences);
  assert.equal(first.audioPages[1].presenter.layout, 'hidden');
  assert.equal(first.audioPages[0].presenter.aspectRatio, 180 / 320);
  const second = preparePresenterMedia({lesson, lessonPath, assetDir: path.join(temp, 'run-2'), runRel: '_run/test-2', remotion, template, env});
  assert.equal(second.manifest.normalizedCacheHit, true);
  assert.equal(second.manifest.audioCacheHits, 2);
  assert.equal(second.audioPages[0].presenter.aspectRatio, 180 / 320, '旧媒体缓存命中时也必须从规范化视频探测宽高比');
  const output = path.join(temp, 'output');
  fs.mkdirSync(output);
  const protectedInput = path.join(output, 'lesson-props.json');
  fs.copyFileSync(path.join(root, 'examples', 'lesson', 'sample-tech.json'), protectedInput);
  const before = fs.readFileSync(protectedInput);
  const guarded = spawnSync(process.execPath, [path.join(root,'scripts','lesson','make-lesson.mjs'), protectedInput, '--out', output, '--no-bgm'], {cwd: root, encoding: 'utf8', windowsHide: true});
  assert.equal(guarded.status, 2, guarded.stderr);
  assert.match(guarded.stderr, /输入文件名.*与输出产物冲突/);
  assert.deepEqual(fs.readFileSync(protectedInput), before, '合法讲稿与内部产物重名时须在渲染前拒绝且内容不变');
  console.log('presenter-media: 路径与映射拦截、真实音视频探测、抽音、缓存复用通过');
} finally { fs.rmSync(temp, {recursive: true, force: true}); }
