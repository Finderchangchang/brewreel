#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {isPlaceholderLicense, reviewHash, reviewRecordPath, reviewSnapshot, splitReviewFile} from './review.mjs';

const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
const testMode = args.includes('--test');
const flagsWithValue = new Set(['--reviewer', '--license', '--decision']);
const lessonArg = args.find((item, index) => !item.startsWith('--') && !flagsWithValue.has(args[index - 1]));
const reviewerArg = value('--reviewer');
const licenseArg = value('--license');
const decision = value('--decision') ?? 'approved';
const usage = () => {
  console.error('用法：node scripts/lesson/sign-review.mjs <lesson.json> --reviewer <姓名> --license <执业证号> [--decision approved|rejected]');
  console.error('内部测试：node scripts/lesson/sign-review.mjs <lesson.json> --test [--reviewer <姓名>] [--license <编号>] [--decision approved|rejected]');
};
if (!lessonArg || !['approved', 'rejected'].includes(decision)) { usage(); process.exit(2); }
if (!testMode && (!reviewerArg?.trim() || !licenseArg?.trim())) { usage(); process.exit(2); }
if (!testMode && isPlaceholderLicense(licenseArg)) {
  console.error('执业证号无效，不算律师审稿。空、无、测试、none、- 这类占位不能写入律师审稿记录。内部样片请改用 --test。');
  process.exit(2);
}
const lessonPath = path.resolve(lessonArg);
if (!fs.existsSync(lessonPath)) { console.error(`找不到 lesson 文件：${lessonPath}`); process.exit(2); }
let lesson;
try { lesson = JSON.parse(fs.readFileSync(lessonPath, 'utf8')); }
catch (e) { console.error(`lesson JSON 解析失败：${e.message}`); process.exit(2); }
const output = reviewRecordPath(lessonPath);
let history = [];
if (fs.existsSync(output)) {
  try {
    const split = splitReviewFile(JSON.parse(fs.readFileSync(output, 'utf8')));
    if (split) history = [...split.history, reviewSnapshot(split.current)];
  } catch (e) { console.error(`已有审稿记录无法解析，未覆盖：${e.message}`); process.exit(2); }
}
const review = {
  reviewer: (reviewerArg?.trim() || '内部测试'),
  license_no: (licenseArg?.trim() || '内部测试'),
  reviewed_at: new Date().toISOString(),
  decision,
  script_sha256: reviewHash(lesson, path.dirname(lessonPath)),
  test: testMode,
  history,
};
fs.writeFileSync(output, JSON.stringify(review, null, 2) + '\n', 'utf8');
console.log(`审稿记录已写入：${output}`);
console.log(`结论：${decision}；SHA-256：${review.script_sha256}`);
if (testMode) console.log('这是内部测试签名（test: true），不能当作律师审稿。');
if (history.length) console.log(`已保留此前 ${history.length} 条签署记录。`);
