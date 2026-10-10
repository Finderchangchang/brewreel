import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {aigcMetadataValue, aigcPayload, explicitMarking, tagsMatchAigc} from './aigc-label.mjs';
import {assignFramesToPages, checkReview, frameTimeMs, isPlaceholderLicense, reviewHash} from './review.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = {meta:{title:'审稿测试',facts:['事实甲'],disclaimer:'仅供教学'},chapters:[{title:'一',pages:[
  {layout:'compare',title:'标题',kicker:'提示语',leftTitle:'左',rightTitle:'右',left:['左边正文'],right:['右边正文'],question:'问题',answer:'原来的答案',narration:[{text:'旁白。',note:'便签',pose:'explain',reveal:0}]},
]}]};
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'m4-review-'));
const lessonPath = path.join(temp,'lesson.json');
fs.writeFileSync(lessonPath,JSON.stringify(base),'utf8');
assert.equal(checkReview(base,lessonPath).ok,false,'missing review blocks');
const reviewPath = path.join(temp,'review.json');
const record = {reviewer:'测试',license_no:'14401199012345678',reviewed_at:'2026-09-28',script_sha256:reviewHash(base,temp),decision:'approved'};
fs.writeFileSync(reviewPath,JSON.stringify(record),'utf8');
assert.equal(checkReview(base,lessonPath).ok,true,'approved matching review passes');
const changed = structuredClone(base); changed.chapters[0].pages[0].narration[0].text='旁白改字。';
assert.equal(checkReview(changed,lessonPath).ok,false,'one script edit invalidates review');
assert.ok(/哈希/.test(checkReview(changed,lessonPath).reason));
const changedHeading = structuredClone(base); changedHeading.chapters[0].title='章节改名';
assert.notEqual(reviewHash(changedHeading),reviewHash(base),'visible chapter heading is bound into review hash');
const changedCourse = structuredClone(base); changedCourse.meta.title='课程改名';
assert.notEqual(reviewHash(changedCourse),reviewHash(base),'visible course title is bound into review hash');
const normalized = structuredClone(base); normalized.chapters[0].pages[0].narration[0].text='旁白。 ';
assert.equal(reviewHash(normalized),reviewHash(base),'whitespace normalization is stable');
const spacedFacts = structuredClone(base); spacedFacts.meta.facts=['事实甲   '];
assert.equal(reviewHash(spacedFacts),reviewHash(base),'只改空白不变');

const left = structuredClone(base); left.chapters[0].pages[0].left[0]='左边被改';
assert.notEqual(reviewHash(left),reviewHash(base),'compare.left changed');
const answer = structuredClone(base); answer.chapters[0].pages[0].answer='另一个答案';
assert.notEqual(reviewHash(answer),reviewHash(base),'question.answer changed');
const kicker = structuredClone(base); kicker.chapters[0].pages[0].kicker='另一句提示';
assert.notEqual(reviewHash(kicker),reviewHash(base),'chapter.kicker changed');
const facts = structuredClone(base); facts.meta.facts=['事实乙'];
assert.notEqual(reviewHash(facts),reviewHash(base),'meta.facts changed');
const note = structuredClone(base); note.chapters[0].pages[0].narration[0].note='改便签';
assert.notEqual(reviewHash(note),reviewHash(base),'narration.note changed');
const pose = structuredClone(base); pose.chapters[0].pages[0].narration[0].pose='wave';
assert.equal(reviewHash(pose),reviewHash(base),'pose 不改变审稿哈希');

const shotA = path.join(temp,'shot-a.png');
const shotB = path.join(temp,'shot-b.png');
fs.writeFileSync(shotA, Buffer.from([0x89,0x50,0x4e,0x47,0x01]));
fs.writeFileSync(shotB, Buffer.from([0x89,0x50,0x4e,0x47,0x02]));
const withShot = structuredClone(base);
withShot.chapters[0].pages[0].image = shotA;
const shotHash = reviewHash(withShot, temp);
fs.writeFileSync(shotA, Buffer.from([0x89,0x50,0x4e,0x47,0x03]));
assert.notEqual(reviewHash(withShot, temp), shotHash,'截图文件内容变化必须改变哈希');
const spacedShot = structuredClone(withShot);
spacedShot.chapters[0].pages[0].title = '标题 ';
assert.equal(reviewHash(spacedShot, temp), reviewHash(withShot, temp),'截图课只改标题空白时哈希不变');

for (const license of ['', '  ', '无', '测试', '测试证号', 'none', 'NONE', 'n/a', '-', '—', '内部测试']) {
  assert.equal(isPlaceholderLicense(license), true, license || '(empty)');
}
for (const license of ['无', '测试', '测试证号', 'none', 'NONE', 'n/a', '-', '—', '内部测试']) {
  fs.writeFileSync(reviewPath, JSON.stringify({...record, license_no: license}), 'utf8');
  const result = checkReview(base, lessonPath);
  assert.equal(result.ok, false, license);
  assert.match(result.reason, /执业证号/);
}
fs.writeFileSync(reviewPath, JSON.stringify({...record, license_no: '   '}), 'utf8');
assert.equal(checkReview(base, lessonPath).ok, false, '空白证号不能通过');
assert.equal(isPlaceholderLicense('14401199012345678'), false);
fs.writeFileSync(reviewPath, JSON.stringify(record), 'utf8');

const otherPath = path.join(temp, 'other.json');
const other = structuredClone(base); other.meta.title = '另一份讲稿';
fs.writeFileSync(otherPath, JSON.stringify(other), 'utf8');
assert.equal(checkReview(other, otherPath).ok, false, '同目录 review.json 哈希对不上时不能套用');
const sign = (file, extra) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/lesson/sign-review.mjs'), file, ...extra], {encoding:'utf8', windowsHide:true});
const badLicense = sign(lessonPath, ['--reviewer','甲','--license','无']);
assert.notEqual(badLicense.status, 0);
assert.match(badLicense.stderr, /不算律师审稿/);
assert.equal(fs.existsSync(path.join(temp, 'lesson.json.review.json')), false, '无效证号不应写入记录');
const first = sign(lessonPath, ['--reviewer','甲律师','--license','14401199012345678']);
assert.equal(first.status, 0, first.stderr);
const named = path.join(temp, 'lesson.json.review.json');
const firstRecord = JSON.parse(fs.readFileSync(named, 'utf8'));
assert.equal(firstRecord.test, false);
assert.equal(checkReview(base, lessonPath).ok, true, '同名审稿记录优先于旧 review.json');
const second = sign(lessonPath, ['--reviewer','乙律师','--license','14401199012345679']);
assert.equal(second.status, 0, second.stderr);
const secondRecord = JSON.parse(fs.readFileSync(named, 'utf8'));
assert.equal(secondRecord.reviewer, '乙律师');
assert.equal(secondRecord.history.length, 1);
assert.equal(secondRecord.history[0].reviewer, '甲律师');
assert.equal(secondRecord.history[0].history, undefined, '历史记录不再嵌套 history');
const tested = sign(otherPath, ['--test']);
assert.equal(tested.status, 0, tested.stderr);
assert.match(tested.stdout, /test: true/);
const testRecord = JSON.parse(fs.readFileSync(path.join(temp, 'other.json.review.json'), 'utf8'));
assert.equal(testRecord.test, true);
assert.equal(checkReview(other, otherPath).test, true);
assert.equal(checkReview(other, otherPath).ok, true);
assert.equal(JSON.parse(fs.readFileSync(named, 'utf8')).reviewer, '乙律师', '给另一份讲稿签名不应覆盖已有记录');

const frames = path.join(temp, 'video', 'check');
fs.mkdirSync(frames, {recursive:true});
for (const name of ['01-1.00s.png','02-8.00s.png','03-12.00s.png','04-30.00s.png']) fs.writeFileSync(path.join(frames, name), Buffer.from([0x89,0x50,0x4e,0x47]));
const timeline = {pages:[{startMs:0,endMs:10000},{startMs:10000,endMs:40000}]};
fs.writeFileSync(path.join(temp, 'video', 'timeline.json'), JSON.stringify(timeline));
const sheetLesson = {meta:{format:'lesson',title:'配帧',domain:'tech',lang:'zh',facts:[],sources:[]},chapters:[{title:'章',pages:[
  {layout:'steps',title:'第一页',items:['甲','乙'],narration:[{text:'第一页旁白。'}]},
  {layout:'steps',title:'第二页',items:['丙','丁'],narration:[{text:'第二页旁白。'}]},
]}]};
const sheetLessonPath = path.join(temp, 'sheet-lesson.json');
fs.writeFileSync(sheetLessonPath, JSON.stringify(sheetLesson));
const sheetOut = path.join(temp, 'sheet-out');
const sheet = spawnSync(process.execPath, [path.join(ROOT,'scripts/lesson/review-sheet.mjs'), sheetLessonPath, '--out', sheetOut, '--frames', frames], {encoding:'utf8', windowsHide:true});
assert.equal(sheet.status, 0, sheet.stderr);
const html = fs.readFileSync(path.join(sheetOut, 'review.html'), 'utf8');
assert.match(html, /data-page="1" data-time="8.00"/);
assert.match(html, /data-page="2" data-time="30.00"/);
assert.doesNotMatch(html, /data-time="1.00"/);
assert.doesNotMatch(html, /data-time="12.00"/);
const orphan = path.join(temp, 'orphan-frames');
fs.mkdirSync(orphan);
fs.writeFileSync(path.join(orphan, '01-1.00s.png'), Buffer.from([0x89]));
const orphanOut = path.join(temp, 'orphan-out');
const orphanSheet = spawnSync(process.execPath, [path.join(ROOT,'scripts/lesson/review-sheet.mjs'), sheetLessonPath, '--out', orphanOut, '--frames', orphan], {encoding:'utf8', windowsHide:true});
assert.equal(orphanSheet.status, 0, orphanSheet.stderr);
const orphanHtml = fs.readFileSync(path.join(orphanOut, 'review.html'), 'utf8');
assert.match(orphanHtml, /未找到 timeline\.json，检查帧未按时间配到页上/);
assert.doesNotMatch(orphanHtml, /<img/);
assert.deepEqual(assignFramesToPages(['01-1.00s.png','02-8.00s.png','03-12.00s.png','04-30.00s.png'], timeline.pages), ['02-8.00s.png','04-30.00s.png']);
assert.equal(frameTimeMs('still-10.73s.png'), 10730);

const payload = aigcPayload('abcdef0123456789', new Date('2026-10-01T00:00:00.000Z'));
assert.equal(aigcMetadataValue(payload).includes('='), false, 'Remotion metadata 的值里不能有等号');
assert.equal(payload.Label, '1');
assert.equal(payload.ContentProducer, 'brewreel-studio');
assert.equal(explicitMarking('tech','zh',false).aiLabel, 'AI生成合成');
assert.equal(explicitMarking('legal','zh',false).aiLabel, 'AI生成合成');
assert.equal(explicitMarking('tech','en',false).aiLabel, 'AI-generated synthetic');
assert.equal(explicitMarking('tech','zh',false).residentLabel, null);
assert.equal(explicitMarking('legal','en',false).residentLabel, null);
assert.equal(explicitMarking('tech','zh',false).realPersonLabel, null);
assert.equal(explicitMarking('legal','zh',true).sampleBanner, '内部样片 · 未经律师审核');
assert.equal(explicitMarking('tech','zh',false).sampleBanner, null);
assert.equal(tagsMatchAigc({AIGC:aigcMetadataValue(payload)}, payload), true);
assert.equal(tagsMatchAigc({comment:'Made with Remotion'}, payload), false);
const markingSource = fs.readFileSync(path.join(ROOT, 'template/src/lesson/overlays/LegalMarkings.tsx'), 'utf8');
const lessonSource = fs.readFileSync(path.join(ROOT, 'template/src/lesson/Lesson.tsx'), 'utf8');
assert.match(markingSource, /AI生成合成/);
assert.match(markingSource, /frame < 90/);
assert.match(markingSource, /fontSize:76/);
assert.doesNotMatch(markingSource, /AI生成合成 · AI配音/);
assert.doesNotMatch(markingSource, /真人出镜 · 画面AI生成/);
assert.doesNotMatch(markingSource, /totalFrames - 90/);
assert.doesNotMatch(lessonSource, /AI合成配音/);
assert.match(markingSource, /内部样片 · 未经律师审核/);
assert.doesNotMatch(markingSource, /domain !== 'legal'/);
assert.doesNotMatch(markingSource, /真人原声/);

console.log('✓ legal review：无记录拦截、签署通过、改稿后哈希失效、空白规范化');
console.log('✓ 审稿指纹覆盖对比栏、答案、章节提示、事实、便签和截图文件；占位证号、按讲稿留存、按时间配帧');
