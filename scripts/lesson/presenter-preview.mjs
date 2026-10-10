#!/usr/bin/env node
// 手改 look.json 之后立刻看三个姿势。不调用在线模型。
import fs from 'node:fs';
import path from 'node:path';
import {presenterLookErrors} from './validate-lesson.mjs';
import {writePreviewPng} from './presenter-preview-render.mjs';
import {LIKENESS_LIMIT} from './presenter-vision.mjs';

const args = process.argv.slice(2);
const lookArg = args.find((arg) => !arg.startsWith('--'));
const outIndex = args.indexOf('--out');
const outArg = outIndex >= 0 ? args[outIndex + 1] : '';
if (!lookArg || !outArg) {
  console.error('用法：node scripts/lesson/presenter-preview.mjs <look.json> --out <png>');
  process.exit(2);
}

const json = JSON.parse(fs.readFileSync(path.resolve(lookArg), 'utf8').replace(/^\uFEFF/u, ''));
const look = json?.meta?.presenter?.look || json?.presenter?.look || json?.look || json;
const errors = presenterLookErrors({kind: 'cartoon', look});
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(2);
}
const pngPath = path.resolve(outArg);
writePreviewPng({look, pngPath});
console.log(LIKENESS_LIMIT);
console.log(`preview：${path.basename(pngPath)}`);
