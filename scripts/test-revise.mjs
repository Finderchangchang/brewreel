#!/usr/bin/env node
// 一句话改稿的假模型测试，不联网。由 scripts/test-validate.mjs 拉起。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseFile, validate} from './validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
let n = 0;
const ok = (name) => {
  n += 1;
  console.log(`  ok  ${name}`);
};
const bad = (name, msg) => {
  n += 1;
  fails.push(`${name}：${msg}`);
  console.log(`  FAIL ${name}：${msg}`);
};

const tmp = fs.mkdtempSync(path.join(ROOT, '..', 'v0140-free', 't9b-revise-'));
let mockN = 0;
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
const readText = (p) => fs.readFileSync(p);

const run = (file, sentence, mock, extra = []) => {
  const mockPath = path.join(tmp, `mock-${++mockN}.json`);
  writeJson(mockPath, mock);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'revise.mjs'), file, sentence, '--mock-llm', mockPath, ...extra], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return {status: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`};
};

const copyStory = (name) => {
  const dest = path.join(tmp, name);
  fs.copyFileSync(path.join(ROOT, 'examples', 'ledger.json'), dest);
  return dest;
};
const copyLesson = (name) => {
  const dest = path.join(tmp, name);
  fs.copyFileSync(path.join(ROOT, 'examples', 'lesson', 'sample-tech.json'), dest);
  return dest;
};

const brollDir = path.join(tmp, 'talk');
fs.mkdirSync(brollDir);
const motion = path.join(ROOT, 'examples', 'talk', 'motion');
fs.copyFileSync(path.join(motion, 'broll.json'), path.join(brollDir, 'broll.json'));
fs.copyFileSync(path.join(motion, 'talk.srt'), path.join(brollDir, 'talk.srt'));
try {
  fs.linkSync(path.join(motion, 'talk.mp4'), path.join(brollDir, 'talk.mp4'));
} catch {
  fs.copyFileSync(path.join(motion, 'talk.mp4'), path.join(brollDir, 'talk.mp4'));
}
const brollFile = path.join(brollDir, 'broll.json');

const noBak = (file) => !fs.existsSync(file.replace(/\.json$/, '.bak.json')) && !fs.existsSync(file.replace(/\.json$/, '.bak.1.json'));

try {
  console.log('改稿（假模型）');

  {
    const file = copyStory('sb-ok.json');
    const before = readText(file);
    const r = run(file, '第三镜改到 5 秒，开头换成提问', {
      ops: [
        {op: 'set', path: 'shots[2].dur', value: 5},
        {op: 'set', path: 'shots[0].caption', value: '这个月的钱，\n{去向对不上}'},
      ],
    });
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (r.status !== 0) bad('宣传片改时长和字幕', r.out);
    else if (doc.shots[2].dur !== 5 || !String(doc.shots[0].caption).includes('去向对不上')) bad('宣传片改时长和字幕', '文件内容没改对');
    else if (!r.out.includes('第 3 镜 时长') || !r.out.includes('第 1 镜 字幕')) bad('宣传片改时长和字幕', '中文说明不全：' + r.out);
    else if (!fs.existsSync(path.join(tmp, 'sb-ok.bak.json'))) bad('宣传片改时长和字幕', '没有 .bak.json');
    else if (readText(path.join(tmp, 'sb-ok.bak.json')).equals(before)) ok('宣传片改时长和字幕');
    else bad('宣传片改时长和字幕', '备份不是原文件');
  }

  {
    const file = copyStory('sb-pace.json');
    const r1 = run(file, '节奏快一点', {ops: [{op: 'set', path: 'meta.tweak.pace', value: 'fast'}]});
    const doc1 = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (r1.status !== 0 || doc1.meta?.tweak?.pace !== 'fast') bad('宣传片节奏', r1.out);
    else if (!r1.out.includes('节奏')) bad('宣传片节奏', '没印节奏');
    else if (!fs.existsSync(path.join(tmp, 'sb-pace.bak.json'))) bad('宣传片节奏', '没有第一次备份');
    else {
      const r2 = run(file, '第 2 镜情绪再平静一点', {ops: [{op: 'set', path: 'shots[1].mood', value: 0.4}]});
      const doc2 = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (r2.status !== 0 || doc2.shots[1].mood !== 0.4) bad('宣传片第二次备份', r2.out);
      else if (!fs.existsSync(path.join(tmp, 'sb-pace.bak.1.json'))) bad('宣传片第二次备份', '没有 .bak.1.json');
      else ok('宣传片节奏和 .bak.1.json');
    }
  }

  {
    const file = copyLesson('lesson-a.json');
    const r = run(file, '封面标题改成提问', {ops: [{op: 'set', path: 'meta.title', value: 'Codex 到底是什么'}]});
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (r.status !== 0 || doc.meta.title !== 'Codex 到底是什么') bad('讲课改标题', r.out);
    else if (!r.out.includes('标题')) bad('讲课改标题', '没印标题');
    else ok('讲课改标题');
  }

  {
    const file = copyLesson('lesson-b.json');
    const r = run(file, '封面副标题改短', {ops: [{op: 'set', path: 'chapters[0].pages[0].subtitle', value: '它替谁改代码'}]});
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (r.status !== 0 || doc.chapters[0].pages[0].subtitle !== '它替谁改代码') bad('讲课改副标题', r.out);
    else if (!r.out.includes('副标题')) bad('讲课改副标题', r.out);
    else ok('讲课改副标题');
  }

  {
    const before = readText(brollFile);
    const r = run(brollFile, '第一段说明改短一点', {ops: [{op: 'set', path: 'clips[0].plain', value: '先写再做'}]});
    const doc = JSON.parse(fs.readFileSync(brollFile, 'utf8'));
    if (r.status !== 0 || doc.clips[0].plain !== '先写再做') bad('口播改说明', r.out);
    else if (!r.out.includes('b01') || !r.out.includes('说明')) bad('口播改说明', r.out);
    else if (!readText(path.join(brollDir, 'broll.bak.json')).equals(before)) bad('口播改说明', '备份不是原文');
    else ok('口播改说明');
  }

  {
    const r = run(brollFile, '第二段镜头改成不动', {ops: [{op: 'set', path: 'clips[1].camera', value: 'static'}]});
    const doc = JSON.parse(fs.readFileSync(brollFile, 'utf8'));
    if (r.status !== 0 || doc.clips[1].camera !== 'static') bad('口播改镜头', r.out);
    else if (!r.out.includes('镜头')) bad('口播改镜头', r.out);
    else if (!fs.existsSync(path.join(brollDir, 'broll.bak.1.json'))) bad('口播改镜头', '没有 .bak.1.json');
    else ok('口播改镜头');
  }

  {
    const file = copyStory('sb-deny.json');
    const before = readText(file);
    const r = run(file, '把第一镜换成自由镜头', {ops: [{op: 'set', path: 'shots[0].component', value: 'shots/X.tsx'}]});
    if (r.status === 0 || !readText(file).equals(before) || !noBak(file)) bad('宣传片越权路径', r.out);
    else if (!r.out.includes('不在允许范围') || !r.out.includes('没写文件')) bad('宣传片越权路径', r.out);
    else ok('宣传片越权路径');
  }

  {
    const file = copyLesson('lesson-deny.json');
    const before = readText(file);
    const r = run(file, '改领域', {ops: [{op: 'set', path: 'meta.domain', value: 'legal'}]});
    if (r.status === 0 || !readText(file).equals(before) || !noBak(file)) bad('讲课越权路径', r.out);
    else if (!r.out.includes('不在允许范围') || !r.out.includes('没写文件')) bad('讲课越权路径', r.out);
    else ok('讲课越权路径');
  }

  {
    const file = path.join(brollDir, 'broll-deny.json');
    fs.copyFileSync(brollFile, file);
    const before = readText(file);
    const r = run(file, '换供应商', {ops: [{op: 'set', path: 'provider', value: 'placeholder'}]});
    if (r.status === 0 || !readText(file).equals(before) || !noBak(file)) bad('口播越权路径', r.out);
    else if (!r.out.includes('不在允许范围') || !r.out.includes('没写文件')) bad('口播越权路径', r.out);
    else ok('口播越权路径');
  }

  {
    const file = copyStory('sb-op.json');
    const before = readText(file);
    const r = run(file, '换掉第三镜', {ops: [{op: 'replace', path: 'shots[2].dur', value: 5}]});
    if (r.status === 0 || !readText(file).equals(before) || !noBak(file)) bad('非法 op', r.out);
    else if (!r.out.includes('不允许的操作') || !r.out.includes('没写文件')) bad('非法 op', r.out);
    else ok('非法 op');
  }

  {
    const file = copyStory('sb-bad.json');
    const before = readText(file);
    const r = run(file, '第一镜改成 0.2 秒', {ops: [{op: 'set', path: 'shots[0].dur', value: 0.2}]});
    if (r.status === 0 || !readText(file).equals(before) || !noBak(file)) bad('宣传片校验三轮放弃', r.out);
    else if (!r.out.includes('校验 3 轮后仍不过') || !r.out.includes('没写文件')) bad('宣传片校验三轮放弃', r.out);
    else ok('宣传片校验三轮放弃');
  }

  {
    const file = copyLesson('lesson-bad.json');
    const before = readText(file);
    const r = run(file, '封面标题清空', {ops: [{op: 'set', path: 'chapters[0].pages[0].title', value: ''}]});
    if (r.status === 0 || !readText(file).equals(before) || !noBak(file)) bad('讲课校验三轮放弃', r.out);
    else if (!r.out.includes('校验 3 轮后仍不过') || !r.out.includes('没写文件')) bad('讲课校验三轮放弃', r.out);
    else ok('讲课校验三轮放弃');
  }

  {
    const file = path.join(brollDir, 'broll-bad.json');
    fs.copyFileSync(path.join(motion, 'broll.json'), file);
    const before = readText(file);
    const r = run(file, '说明写很长', {ops: [{op: 'set', path: 'clips[0].plain', value: '这句话一共有三十个汉字用来测试超长说明文字啊'}]});
    if (r.status === 0 || !readText(file).equals(before) || !noBak(file)) bad('口播校验三轮放弃', r.out);
    else if (!r.out.includes('校验 3 轮后仍不过') || !r.out.includes('没写文件')) bad('口播校验三轮放弃', r.out);
    else ok('口播校验三轮放弃');
  }

  {
    const file = copyStory('sb-dry.json');
    const before = readText(file);
    const r = run(file, '节奏快一点', {ops: [{op: 'set', path: 'meta.tweak.pace', value: 'fast'}]}, ['--dry-run']);
    if (r.status !== 0 || !readText(file).equals(before) || !noBak(file)) bad('干跑', r.out);
    else if (!r.out.includes('干跑') || !r.out.includes('修改清单')) bad('干跑', r.out);
    else ok('干跑不写文件');
  }

  console.log('可调项校验');
  const parsed = parseFile(path.join(ROOT, 'examples', 'ledger.json'));
  const baseDir = path.join(ROOT, 'examples');
  const base = validate(parsed.sb, {baseDir});
  const durs = (sb) => validate(sb, {baseDir}).slots.map((s) => s.dur).join(',');
  const fast = structuredClone(parsed.sb);
  fast.meta.tweak = {pace: 'fast'};
  const fastR = validate(fast, {baseDir});
  if (fastR.errors.length) bad('pace fast 能通过', fastR.errors.map((e) => e.problem).join('；'));
  else if (fastR.slots[0].dur !== 2) bad('pace fast 缩短第一镜', String(fastR.slots[0].dur));
  else ok('pace fast 第一镜 2 秒');

  const normal = structuredClone(parsed.sb);
  normal.meta.tweak = {pace: 'normal'};
  if (durs(normal) !== durs(parsed.sb)) bad('pace normal 与不写一致', `${durs(normal)} / ${durs(parsed.sb)}`);
  else ok('pace normal 与不写一致');

  const same = structuredClone(parsed.sb);
  same.meta.tweak = {textScale: 1, headingFont: 'sans'};
  if (validate(same, {baseDir}).errors.length || durs(same) !== durs(parsed.sb)) bad('textScale 1 与 sans', '不该改变时长或报错');
  else ok('textScale 1 与 sans 不改变排程');

  const big = structuredClone(parsed.sb);
  big.meta.tweak = {textScale: 1.1};
  if (validate(big, {baseDir}).errors.length) bad('textScale 1.1', validate(big, {baseDir}).errors.map((e) => e.problem).join('；'));
  else ok('textScale 1.1 通过');

  for (const value of [1.2, 0.85]) {
    const sb = structuredClone(parsed.sb);
    sb.meta.tweak = {textScale: value};
    const r = validate(sb, {baseDir});
    if (!r.errors.some((e) => e.where === 'meta.tweak.textScale')) bad(`textScale ${value} 应拦`, r.errors.map((e) => e.where).join(','));
    else ok(`textScale ${value} 被拦`);
  }

  const comic = structuredClone(parsed.sb);
  comic.meta.tweak = {headingFont: 'comic'};
  if (!validate(comic, {baseDir}).errors.some((e) => e.where === 'meta.tweak.headingFont')) bad('headingFont comic', '没拦');
  else ok('headingFont comic 被拦');

  const kai = structuredClone(parsed.sb);
  kai.meta.tweak = {headingFont: 'kai'};
  if (validate(kai, {baseDir}).errors.length) bad('headingFont kai', validate(kai, {baseDir}).errors.map((e) => e.problem).join('；'));
  else ok('headingFont kai 通过');

  const miss = structuredClone(parsed.sb);
  miss.shots[0].bg = 'missing-bg.png';
  if (!validate(miss, {baseDir}).errors.some((e) => e.where.includes('bg') && e.problem.includes('找不到'))) bad('bg 找不到', validate(miss, {baseDir}).errors.map((e) => e.problem).join('；'));
  else ok('bg 文件不存在被拦');

  const bgDir = path.join(tmp, 'bg');
  fs.mkdirSync(bgDir);
  fs.writeFileSync(path.join(bgDir, 'bg.jpg'), Buffer.alloc(2048, 7));
  const plainBg = structuredClone(parsed.sb);
  plainBg.shots[0].bg = 'bg.jpg';
  if (validate(plainBg, {baseDir: bgDir}).errors.length) bad('bg 装饰图', validate(plainBg, {baseDir: bgDir}).errors.map((e) => `${e.where}：${e.problem}`).join('；'));
  else ok('bg 装饰图不必登记');

  const claim = structuredClone(parsed.sb);
  claim.shots[0].bg = 'bg.jpg';
  claim.shots[0].caption = '店里{实拍}';
  const claimR = validate(claim, {baseDir: bgDir});
  if (!claimR.errors.some((e) => e.problem.includes('实拍') && e.problem.includes('bg.jpg'))) bad('未登记实拍', claimR.errors.map((e) => e.problem).join('；'));
  else ok('未登记 bg 不能写实拍');

  const merchant = structuredClone(claim);
  merchant.meta.assets = [{src: 'bg.jpg', source: 'merchant'}];
  const merchantR = validate(merchant, {baseDir: bgDir});
  if (merchantR.errors.some((e) => e.problem.includes('实拍'))) bad('登记 merchant 后实拍', merchantR.errors.map((e) => e.problem).join('；'));
  else ok('登记 merchant 后可以写实拍');

  if (base.errors.length) bad('ledger 基线', base.errors.map((e) => e.problem).join('；'));
} finally {
  fs.rmSync(tmp, {recursive: true, force: true});
}

console.log(`改稿用例：${n}，失败：${fails.length}`);
if (fails.length) {
  for (const f of fails) console.log(f);
  process.exit(1);
}
