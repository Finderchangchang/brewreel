import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {appendBrandTail, openingCredit} from './brand-render.mjs';
import {bindLessonBrand, createBrandFile, readBrand, resolveBrandVersion, updateBrandFile} from './brand-store.mjs';
import {brandContrastError} from './style-rules.mjs';
import {decideEngineChange, externalBrandChange} from './segments.mjs';
import {headerShift, nameBarSlide} from '../../template/src/lesson/stage.mjs';
import {verticalChromeBoxes} from './vertical-layout.mjs';
import {validateLesson} from './validate-lesson.mjs';


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-'));
const script = path.join(ROOT, 'scripts', 'lesson', 'brand.mjs');
const now = '2026-10-04T00:00:00.000Z';
const later = '2026-10-04T01:00:00.000Z';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" fill="#1F3A5F"/></svg>\n`;
const logo1 = path.join(tmp, 'logo-a.svg');
const logo2 = path.join(tmp, 'logo-b.svg');
fs.writeFileSync(logo1, svg, 'utf8');
fs.writeFileSync(logo2, svg.replace('#1F3A5F', '#333333'), 'utf8');

const run = (args) => spawnSync(process.execPath, [script, ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 30_000,
  windowsHide: true,
});

const created = run(['create', '--client', 'hengchuan', '--firm', '衡川律师事务所', '--english', 'HENGCHUAN LAW FIRM', '--column', '衡川普法', '--logo', logo1, '--primary', '#1F3A5F', '--secondary', '#B08D57', '--lawyer', '陈思远', '--title', '律师', '--department', '民商事业务部', '--data-dir', tmp]);
assert.equal(created.status, 0, created.stderr);
assert.match(created.stdout, /版本 1/);
const file = path.join(tmp, 'clients', 'hengchuan', 'brand.json');
let record = readBrand(file);
assert.equal(record.version, 1);
assert.equal(record.tip, '扫码咨询 · 下期见');
assert.equal(record.qr, null);
assert.equal(fs.existsSync(path.join(tmp, 'clients', 'hengchuan', record.logo.file)), true);
const v1Firm = record.firm;
const v1Logo = record.logo.file;

const shown = run(['show', 'hengchuan@1', '--data-dir', tmp]);
assert.equal(shown.status, 0, shown.stderr);
assert.match(shown.stdout, /衡川律师事务所/);

record = updateBrandFile(file, {firm: '衡川律师事务所更新'}, later);
assert.equal(record.version, 2);
assert.equal(record.history.length, 1);
assert.equal(record.history[0].version, 1);
assert.equal(record.history[0].firm, v1Firm);
assert.equal(record.firm, '衡川律师事务所更新');
assert.notEqual(record.logo.file, v1Logo);
assert.equal(fs.existsSync(path.join(path.dirname(file), v1Logo)), true);
assert.equal(fs.existsSync(path.join(path.dirname(file), record.logo.file)), true);
const old = resolveBrandVersion(record, 1);
assert.equal(old.firm, v1Firm);
assert.equal(old.logo.file, v1Logo);
assert.equal(old.pinned, true);

const lesson = {
  meta: {format: 'lesson', title: '题', domain: 'tech', lang: 'zh', brand: 'hengchuan@1'},
  chapters: [{title: '章', pages: [{layout: 'cover', title: '题', narration: [{text: '一句。'}]}]}],
};
const pinned = bindLessonBrand(lesson, {dataDir: tmp});
assert.equal(pinned.id, 'hengchuan@1');
assert.equal(pinned.view.firm, v1Firm);
assert.equal(pinned.lawyer.name, '陈思远');

const bad = run(['create', '--client', 'hengchuan', '--firm', '重复', '--column', '栏', '--logo', logo1, '--primary', '#1F3A5F', '--data-dir', tmp]);
assert.notEqual(bad.status, 0);
assert.match(bad.stderr, /已经有品牌档案/);

assert.equal(headerShift(false), 0);
assert.equal(headerShift(true), 30);
const slideIn = nameBarSlide(0, 8000);
assert.equal(slideIn.opacity, 0);
const slideMid = nameBarSlide(1000, 8000);
assert.equal(slideMid.opacity, 1);
assert.equal(slideMid.x, 0);
const slideOut = nameBarSlide(3900, 8000);
assert.ok(slideOut.opacity < 1);
assert.equal(nameBarSlide(4000, 8000).visible, false);

const plainChrome = verticalChromeBoxes({showLabel: true, showHook: true, hookLines: 1});
const brandChrome = verticalChromeBoxes({showLabel: true, showHook: true, hookLines: 1, brandBug: true});
assert.equal(plainChrome.brand, undefined);
assert.equal(brandChrome.label.y, plainChrome.label.y + 64);

assert.equal(brandContrastError('paper', '#1F3A5F'), '');
const contrast = brandContrastError('paper', '#FFFFFF');
assert.match(contrast, /4\.5:1/);
assert.match(contrast, /建议改成 #[0-9A-F]{6}/);
assert.match(contrast, /不会被自动替换/);
assert.equal(brandContrastError('paper', '#1F3A5F'), '');

const testCredit = openingCredit({review: {ok: true, test: true, review: {reviewer: '内部测试'}}, lang: 'zh'});
assert.equal(testCredit.ai, 'AI 辅助生成');
assert.equal(testCredit.extra, '内部测试 · 未经律师审核');
assert.doesNotMatch(`${testCredit.ai}${testCredit.extra}`, /审核律师：/);
const lawyerCredit = openingCredit({review: {ok: true, test: false, review: {reviewer: '陈思远'}}, lang: 'zh'});
assert.equal(lawyerCredit.extra, '审核律师：陈思远');
assert.equal(openingCredit({review: null, lang: 'zh'}).extra, '');

const bare = {
  fps: 30,
  totalFrames: 90,
  durationMs: 3000,
  chapters: [{index: 0, title: '章', startFrame: 0, endFrame: 90, startMs: 0, endMs: 3000}],
  pages: [{index: 0, chapterIndex: 0, chapterTitle: '章', layout: 'points', title: '题', startFrame: 0, endFrame: 90, durationFrames: 90, audio: 'a.wav', sentences: []}],
  subtitles: [{text: '原字幕'}],
};
const tailed = appendBrandTail(bare, '整片标题');
assert.equal(tailed.added, true);
assert.equal(tailed.recapIndex, null);
assert.equal(tailed.timeline.pages[1].layout, 'brandEnd');
assert.equal(tailed.timeline.pages[1].audio, '');
assert.equal(tailed.timeline.pages[1].durationFrames, 120);
assert.equal(tailed.timeline.pages[1].sentences.length, 0);
assert.equal(tailed.timeline.totalFrames, 210);
assert.equal(tailed.timeline.chapters[0].endFrame, 210);
assert.equal(tailed.timeline.subtitles.length, 1);
const withRecap = appendBrandTail({...bare, pages: [{...bare.pages[0], layout: 'recap', index: 3}]}, '整片标题');
assert.equal(withRecap.added, false);
assert.equal(withRecap.recapIndex, 3);
assert.equal(withRecap.timeline.pages.length, 1);

const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'lesson', 'sample-tech.json'), 'utf8'));
const errors = (item) => validateLesson(item).errors.join('\n');
assert.equal(errors({...sample, meta: {...sample.meta, brand: 'hengchuan@1', episode: 3, lawyer: '陈思远'}}), '');
assert.match(errors({...sample, meta: {...sample.meta, brand: {primary: 'blue'}}}), /meta\.brand\.primary/);
assert.match(errors({...sample, meta: {...sample.meta, brand: '不是合法id'}}), /meta\.brand/);

const engine = {hash: 'abc', files: ['template/src/lesson/Lesson.tsx']};
const previous = {engine, packageVersion: '1.0.0', git: {commit: 'c'}, brand: {id: 'hengchuan@1', logoSha256: 'a'.repeat(64)}};
const decision = decideEngineChange({previous, current: {hash: 'abc', files: engine.files, packageVersion: '1.0.0', git: {commit: 'c'}}, accept: false});
assert.equal(decision.ok, true);
assert.match(externalBrandChange({previous, brand: {id: 'hengchuan@2', logoSha256: 'b'.repeat(64)}}), /引擎外输入/);
assert.equal(externalBrandChange({previous, brand: previous.brand}), '');
assert.equal(externalBrandChange({previous: {engine}, brand: null}), '');

const baselineDir = path.resolve(ROOT, '..', 'brewreel-studio-out', 'v1.4-t22', 'baseline');
if (!fs.existsSync(path.join(baselineDir, 'frames.json'))) {
  console.log('test-brand：跳过逐帧基线。开源树不附带 v1.4-t22 私有出片目录');
  console.log('test-brand：建档、升版本、旧版可用、对比度、测试审稿、自动尾页、无品牌逐帧一致');
  process.exit(0);
}
const frames = JSON.parse(fs.readFileSync(path.join(baselineDir, 'frames.json'), 'utf8'));
const propsPath = path.join(baselineDir, 'props.json');
const remotion = path.join(ROOT, 'template', 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
// T23 改了字幕折行，字幕带可以不同。T24 把内容字号放大到样张，内容框（右下角讲解员那一块除外）也可以不同。框外像素仍须和 T22 基线一致。
const SUBTITLE_BAND = '680,820,1120,1060';
const CONTENT_BANDS = '118,298,1802,812;118,810,1600,882';
const differ = (left, right, band) => {
  const py = process.env.PYTHON || 'python';
  const helper = path.join(tmp, 'diff-png.py');
  if (!fs.existsSync(helper)) {
    fs.writeFileSync(helper, [
      'from PIL import Image',
      'import sys',
      'a = Image.open(sys.argv[1]).convert("RGB")',
      'b = Image.open(sys.argv[2]).convert("RGB")',
      'if a.size != b.size:',
      '    print(max(a.size[0] * a.size[1], b.size[0] * b.size[1]) * 3)',
      '    print(0)',
      'else:',
      '    ba, bb = a.tobytes(), b.tobytes()',
      '    w, h = a.size',
      '    rects = [[int(v) for v in part.split(",")] for part in sys.argv[3].split(";") if part]',
      '    outside = inside = 0',
      '    i = 0',
      '    for y in range(h):',
      '        for x in range(w):',
      '            diff = (ba[i] != bb[i]) + (ba[i + 1] != bb[i + 1]) + (ba[i + 2] != bb[i + 2])',
      '            hit = False',
      '            for x0, y0, x1, y1 in rects:',
      '                if x0 <= x < x1 and y0 <= y < y1:',
      '                    hit = True',
      '                    break',
      '            if hit:',
      '                inside += diff',
      '            else:',
      '                outside += diff',
      '            i += 3',
      '    print(outside)',
      '    print(inside)',
    ].join('\n'), 'utf8');
  }
  const ran = spawnSync(py, [helper, left, right, band], {encoding: 'utf8', windowsHide: true});
  if (ran.status !== 0) throw new Error(ran.stderr || ran.stdout || '对比帧失败');
  const [outside, inside] = String(ran.stdout).trim().split(/\s+/).map(Number);
  return {outside, inside};
};
const still = (frame, name) => {
  const dest = path.join(tmp, name);
  const ran = spawnSync(process.execPath, [remotion, 'still', 'src/index.ts', 'Lesson', dest, `--frame=${frame}`, `--props=${propsPath}`], {
    cwd: path.join(ROOT, 'template'),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (ran.status !== 0 || !fs.existsSync(dest)) throw new Error(ran.stderr || ran.stdout || 'still 失败');
  return dest;
};
const coverNow = still(frames.coverFrame, 'cover-now.png');
const contentNow = still(frames.contentFrame, 'content-now.png');
const coverDiff = differ(path.join(baselineDir, 'cover.png'), coverNow, SUBTITLE_BAND);
const contentDiff = differ(path.join(baselineDir, 'content.png'), contentNow, `${SUBTITLE_BAND};${CONTENT_BANDS}`);
assert.equal(coverDiff.outside, 0, `没有品牌时片头帧字幕带外有 ${coverDiff.outside} 个字节不同`);
assert.equal(contentDiff.outside, 0, `没有品牌时内容帧字幕带外有 ${contentDiff.outside} 个字节不同`);
assert.ok(coverDiff.inside > 0, '片头字幕带应因折行改变');
assert.ok(contentDiff.inside > 0, '内容字幕带应因折行改变');

console.log('test-brand：建档、升版本、旧版可用、对比度、测试审稿、自动尾页、无品牌逐帧一致');
