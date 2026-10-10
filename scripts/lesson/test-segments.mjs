#!/usr/bin/env node
// 分段指纹和版本锁。不渲染真片。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  contentFingerprint,
  decideEngineChange,
  engineRefusalMessage,
  filmFingerprint,
  listEngineFiles,
  planVerticalClip,
  readEngineFingerprint,
  readGitState,
  readLock,
  segmentDecision,
  segmentLog,
  verticalLog,
} from './segments.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't18-segments-'));
let passed = 0;
let total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}: ${error.message}`); process.exitCode = 1; }
}

const sentenceAt = (startMs, text = '甲') => ({
  text,
  startMs: startMs + 400,
  endMs: startMs + 2000,
  chars: [{text, startMs: 400, endMs: 800}],
});

function makePage(index, startFrame, extra = {}) {
  const durationFrames = extra.durationFrames ?? 90;
  const startMs = startFrame * 1000 / 30;
  return {
    index,
    chapterIndex: 0,
    chapterTitle: extra.chapterTitle ?? '章',
    layout: extra.layout ?? 'steps',
    title: extra.title ?? `页${index}`,
    items: extra.items ?? ['甲', '乙'],
    fields: {},
    narration: [extra.narration ?? '甲'],
    pose: ['explain'],
    durationFrames,
    audioStartFrame: startFrame + 12,
    audioDurationMs: extra.audioDurationMs ?? 2000,
    startFrame,
    endFrame: startFrame + durationFrames,
    startMs,
    endMs: startMs + durationFrames * 1000 / 30,
    sentences: [sentenceAt(startMs, extra.narration ?? '甲')],
    presenter: extra.presenter,
  };
}

function filmOf(pages, totalFrames, extra = {}) {
  const timeline = {
    fps: 30,
    width: 1920,
    height: 1080,
    totalFrames: totalFrames ?? pages[pages.length - 1].endFrame,
    pages,
    chapters: [{title: '章'}],
  };
  return filmFingerprint({
    page: extra.page ?? pages[0],
    timeline,
    publicDir: extra.publicDir ?? null,
    engineHash: extra.engineHash ?? 'engine-a',
    theme: extra.theme ?? 'paper',
    mascot: extra.mascot ?? {id: 'counsel', enabled: true},
    domain: 'legal',
    lang: 'zh',
    sampleReview: extra.sampleReview === true,
    trial: extra.trial === true,
    characterUnconfirmed: extra.characterUnconfirmed === true,
  });
}

function contentOf(pages, page, extra = {}) {
  const timeline = {fps: 30, width: 1920, height: 1080, totalFrames: pages[pages.length - 1].endFrame, pages, chapters: [{title: '章'}]};
  return contentFingerprint({
    page,
    timeline,
    publicDir: extra.publicDir ?? null,
    engineHash: extra.engineHash ?? 'engine-a',
    theme: 'paper',
    mascot: {id: 'counsel', enabled: true},
    domain: 'legal',
    lang: 'zh',
    sampleReview: extra.sampleReview === true,
    trial: false,
    characterUnconfirmed: false,
  });
}

const basePages = () => [makePage(0, 0), makePage(1, 90), makePage(2, 180)];

test('指纹跟着本页文案变，不跟着无关页变', () => {
  const pages = basePages();
  const before = filmOf(pages, 270);
  const unrelated = basePages();
  unrelated[2] = makePage(2, 180, {title: '另一页标题', narration: '完全不同的一句'});
  assert.equal(filmOf(unrelated, 270), before);
  const edited = basePages();
  edited[0] = makePage(0, 0, {narration: '改了这一句'});
  assert.notEqual(filmOf(edited, 270), before);
});

test('改一页文案会让这一页和下一页失效，再后面的页不动', () => {
  const pages = basePages();
  const edited = basePages();
  edited[0] = makePage(0, 0, {narration: '改了这一句', title: '改了标题'});
  assert.notEqual(filmOf(edited, 270, {page: edited[0]}), filmOf(pages, 270, {page: pages[0]}));
  assert.notEqual(filmOf(edited, 270, {page: edited[1]}), filmOf(pages, 270, {page: pages[1]}));
  assert.equal(filmOf(edited, 270, {page: edited[2]}), filmOf(pages, 270, {page: pages[2]}));
  assert.equal(contentOf(edited, edited[1]), contentOf(pages, pages[1]));
});

test('上一页章节行变会让这一页失效', () => {
  const pages = basePages();
  const before = filmOf(pages, 270, {page: pages[1]});
  const changed = basePages();
  changed[0] = makePage(0, 0, {chapterTitle: '另一章'});
  assert.notEqual(filmOf(changed, 270, {page: changed[1]}), before);
  assert.equal(contentOf(changed, changed[1]), contentOf(pages, pages[1]));
});

test('页起点平移带来的浮点误差不改变内容指纹', () => {
  const pages = basePages();
  const before = contentOf(pages, pages[2]);
  const moved = basePages();
  const delta = 1000 / 3;
  const page = moved[2];
  page.startMs += delta;
  page.endMs += delta;
  page.startFrame += 10;
  page.endFrame += 10;
  page.audioStartFrame += 10;
  for (const sentence of page.sentences) {
    sentence.startMs += delta;
    sentence.endMs += delta;
  }
  assert.equal(contentOf(moved, page), before);
  assert.notEqual(filmOf(moved, page.endFrame, {page}), filmOf(pages, pages[2].endFrame, {page: pages[2]}));
  page.sentences[0].endMs += 2;
  assert.notEqual(contentOf(moved, page), before);
});

test('上一页版式或旁白文案变会让这一页失效，竖版内容指纹不看上一页文案', () => {
  const pages = basePages();
  const before = filmOf(pages, 270, {page: pages[1]});
  const layoutChanged = basePages();
  layoutChanged[0] = makePage(0, 0, {layout: 'quote'});
  assert.notEqual(filmOf(layoutChanged, 270, {page: layoutChanged[1]}), before);
  const narrationChanged = basePages();
  narrationChanged[0] = makePage(0, 0, {narration: '只改旁白'});
  assert.notEqual(filmOf(narrationChanged, 270, {page: narrationChanged[1]}), before, '翻页淡出会把上一页文案叠进这一页开头');
  assert.equal(contentOf(narrationChanged, narrationChanged[1]), contentOf(pages, pages[1]));
});

test('前面一页配音变长后，窗口外的后续页全部复用', () => {
  const span = 200;
  const row = (index, start, extra = {}) => makePage(index, start, {durationFrames: span, ...extra});
  const before = [0, 1, 2, 3].map((index) => row(index, index * span));
  const shift = 60;
  const after = [
    row(0, 0, {durationFrames: span + shift, audioDurationMs: 4000}),
    row(1, span + shift),
    row(2, span * 2 + shift),
    row(3, span * 3 + shift),
  ];
  const totalBefore = span * 4;
  const totalAfter = totalBefore + shift;
  assert.notEqual(filmOf(after, totalAfter, {page: after[0]}), filmOf(before, totalBefore, {page: before[0]}), '被改长的那一页本身要重渲');
  for (const index of [1, 2]) {
    assert.equal(
      filmOf(after, totalAfter, {page: after[index]}),
      filmOf(before, totalBefore, {page: before[index]}),
      `第 ${index + 1} 页内容没变，配音变长后仍复用`,
    );
  }
  assert.notEqual(
    filmOf(after, totalAfter, {page: after[3]}),
    filmOf(before, totalBefore, {page: before[3]}),
    '扫到片尾 120 帧的页仍随总帧数失效',
  );
});

test('样片标记、试看、角色未确认会让每一页失效', () => {
  const pages = basePages();
  const before = filmOf(pages, 270);
  assert.notEqual(filmOf(pages, 270, {sampleReview: true}), before);
  assert.notEqual(filmOf(pages, 270, {trial: true}), before);
  assert.notEqual(filmOf(pages, 270, {characterUnconfirmed: true}), before);
});

test('总帧数只让扫到片尾声明的页失效', () => {
  const early = [makePage(0, 0), makePage(1, 2900, {durationFrames: 100})];
  const earlySame = [makePage(0, 0), makePage(1, 2900, {durationFrames: 100})];
  assert.equal(filmOf(early, 3000), filmOf(earlySame, 4000));
  assert.notEqual(filmOf(early, 3000, {page: early[1]}), filmOf(earlySame, 3100, {page: earlySame[1]}));
});

test('整片起点移动会换横版指纹，竖版用的内容指纹不变', () => {
  const pages = basePages();
  const moved = [makePage(0, 30), makePage(1, 120), makePage(2, 210)];
  assert.notEqual(filmOf(moved, 300, {page: moved[1]}), filmOf(pages, 270, {page: pages[1]}));
  assert.equal(contentOf(moved, moved[1]), contentOf(pages, pages[1]));
});

test('引擎指纹变了，页指纹跟着变', () => {
  const pages = basePages();
  assert.notEqual(filmOf(pages, 270, {engineHash: 'engine-b'}), filmOf(pages, 270));
});

test('同一讲解员素材不同路径，指纹相同', () => {
  const dir = path.join(TMP, 'public');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'a.mp4'), 'same-bytes');
  fs.writeFileSync(path.join(dir, 'b.mp4'), 'same-bytes');
  const left = basePages();
  const right = basePages();
  left[0] = makePage(0, 0, {presenter: {src: 'a.mp4', layout: 'pip'}});
  right[0] = makePage(0, 0, {presenter: {src: 'b.mp4', layout: 'pip'}});
  assert.equal(filmOf(left, 270, {publicDir: dir}), filmOf(right, 270, {publicDir: dir}));
});

test('分段日志：复用、重渲、缓存缺失、引擎更换优先于缓存', () => {
  assert.equal(segmentLog(2, segmentDecision({cacheExists: true, previousFingerprint: 'a', fingerprint: 'a', engineChanged: false})), '第 3 页：复用');
  assert.equal(segmentLog(2, segmentDecision({cacheExists: false, previousFingerprint: 'a', fingerprint: 'b', engineChanged: false})), '第 3 页：重渲（页面内容变化）');
  assert.equal(segmentLog(0, segmentDecision({cacheExists: false, previousFingerprint: undefined, fingerprint: 'a', engineChanged: false})), '第 1 页：重渲（首次出片）');
  assert.equal(segmentLog(0, segmentDecision({cacheExists: false, previousFingerprint: 'a', fingerprint: 'a', engineChanged: false})), '第 1 页：重渲（缓存缺失）');
  assert.equal(segmentDecision({cacheExists: true, previousFingerprint: 'a', fingerprint: 'a', engineChanged: true}).reason, '引擎已更换');
});

test('竖版：没变的切片可以复用，变了的页点名重渲', () => {
  const out = path.join(TMP, 'vertical-cache');
  const contents = new Map([[0, 'a'], [1, 'b'], [2, 'c']]);
  const previousLock = {pages: [{index: 0, content: 'a'}, {index: 1, content: 'b'}, {index: 2, content: 'c'}]};
  const clip = {id: 'clip-01', pageStart: 0, pageEnd: 1, hookTitle: '钩子', legalTailFrames: 0};
  const other = {id: 'clip-02', pageStart: 2, pageEnd: 2, hookTitle: '钩子', legalTailFrames: 0};
  const missing = planVerticalClip({clip, contentsByIndex: contents, previousLock, engineChanged: false, outDir: out});
  assert.equal(missing.decision.reason, '缓存缺失');
  contents.set(1, 'B');
  const changed = planVerticalClip({clip, contentsByIndex: contents, previousLock, engineChanged: false, outDir: out});
  assert.deepEqual(changed.changed, [1]);
  assert.equal(verticalLog(clip.id, changed.decision, changed.changed), '竖版 clip-01：重渲（第 2 页有变化）');
  const untouched = planVerticalClip({clip: other, contentsByIndex: contents, previousLock, engineChanged: false, outDir: out});
  assert.equal(untouched.decision.reason, '缓存缺失');
  assert.equal(untouched.changed.length, 0);
  const cache = untouched.cacheFile;
  fs.mkdirSync(path.dirname(cache), {recursive: true});
  fs.writeFileSync(cache, Buffer.alloc(2048));
  const reused = planVerticalClip({clip: other, contentsByIndex: contents, previousLock, engineChanged: false, outDir: out});
  assert.equal(verticalLog(other.id, reused.decision, reused.changed), '竖版 clip-02：复用');
  const forced = planVerticalClip({clip: other, contentsByIndex: contents, previousLock, engineChanged: true, outDir: out});
  assert.equal(forced.decision.reuse, false);
  assert.equal(forced.decision.reason, '引擎已更换');
});

test('引擎不一致默认拒绝，--accept-engine-change 放行并记下前后', () => {
  const previous = {packageVersion: '9.9.9', git: {commit: 'deadbeef'}, engine: {hash: '0'.repeat(64), files: [{path: 'template/src/lesson/Lesson.tsx', sha256: 'old'}]}};
  const current = {hash: '1'.repeat(64), packageVersion: '1.2.0', git: {commit: 'abc'}, files: [{path: 'template/src/lesson/Lesson.tsx', sha256: 'new'}]};
  const refused = decideEngineChange({previous, current, accept: false});
  assert.equal(refused.ok, false);
  assert.match(refused.message, /这个成片是用 v9\.9\.9（提交 deadbeef）出的，当前引擎已变化：/);
  assert.match(refused.message, /template\/src\/lesson\/Lesson\.tsx/);
  assert.match(refused.message, /--accept-engine-change/);
  const accepted = decideEngineChange({previous, current, accept: true});
  assert.equal(accepted.ok, true);
  assert.equal(accepted.engineChanged.from.engineHash, previous.engine.hash);
  assert.equal(accepted.engineChanged.to.engineHash, current.hash);
  assert.equal(accepted.engineChanged.to.packageVersion, '1.2.0');
  const sameFiles = decideEngineChange({
    previous: {...previous, engine: {...previous.engine, files: current.files}},
    current,
    accept: false,
  });
  assert.match(sameFiles.message, /引擎总指纹不一致/);
  const many = Array.from({length: 25}, (_, i) => `f${String(i).padStart(2, '0')}.tsx`);
  const listed = engineRefusalMessage({previous, changed: many});
  assert.match(listed, /另有 5 个文件/);
  assert.equal(listed.split('\n').filter((line) => line.startsWith('- ')).length, 20);
});

test('没有 .git 不报错；这个仓库能读到提交', () => {
  const empty = fs.mkdtempSync(path.join(TMP, 'not-a-repo-'));
  assert.deepEqual(readGitState(empty), {commit: null, dirty: null});
  const here = readGitState(ROOT);
  assert.equal(typeof here.commit === 'string' || here.commit === null, true);
  assert.match(here.commit || '', /^[0-9a-f]{40}$/u);
  assert.equal(typeof here.dirty, 'boolean');
});

test('坏掉的 lock.json 拒绝，没有 lock 则当作第一次', () => {
  const dir = path.join(TMP, 'lock');
  fs.mkdirSync(dir);
  assert.equal(readLock(dir), null);
  fs.writeFileSync(path.join(dir, 'lock.json'), '{', 'utf8');
  assert.throws(() => readLock(dir), /lock\.json/);
});

test('引擎文件清单含时间轴、课程画面和字体，不含宣传片镜头', () => {
  const files = listEngineFiles(ROOT);
  assert.ok(files.includes('scripts/lesson/timeline.mjs'));
  assert.ok(files.includes('scripts/lesson/render-ranges.mjs'));
  assert.ok(files.includes('template/src/lesson/Lesson.tsx'));
  assert.ok(files.includes('template/public/NotoSansSC-VF.ttf'));
  assert.equal(files.some((file) => file.startsWith('template/src/shots/')), false);
  assert.equal(files.includes('scripts/lesson/make-lesson.mjs'), false);
});

test('已有 lock 且引擎变了就停，不删成片', () => {
  const out = path.join(TMP, 'refuse-out');
  const input = path.join(TMP, 'lesson.json');
  fs.mkdirSync(out);
  fs.writeFileSync(input, JSON.stringify({meta: {title: 'x'}}), 'utf8');
  fs.writeFileSync(path.join(out, 'video.mp4'), Buffer.alloc(2048));
  const engine = readEngineFingerprint(ROOT);
  fs.writeFileSync(path.join(out, 'lock.json'), JSON.stringify({
    packageVersion: '9.9.9',
    git: {commit: 'deadbeef', dirty: false},
    engine: {
      hash: '0'.repeat(64),
      files: engine.files.map((file) => file.path.endsWith('Lesson.tsx') ? {...file, sha256: 'not-the-real-hash'} : file),
    },
  }), 'utf8');
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts/lesson/make-lesson.mjs'),
    input,
    '--out', out,
    '--voice-provider', 'mock',
    '--no-bgm',
    '--theme', 'paper',
  ], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /这个成片是用 v9\.9\.9（提交 deadbeef）出的，当前引擎已变化：/);
  assert.match(result.stderr, /Lesson\.tsx/);
  assert.match(result.stderr, /--accept-engine-change/);
  assert.equal((result.stdout || '').includes('交付：'), false);
  assert.equal(fs.statSync(path.join(out, 'video.mp4')).size, 2048);
});

console.log(`test-segments：${passed}/${total} 通过`);
if (process.exitCode) process.exit(process.exitCode);
