#!/usr/bin/env node
// 照片 → look.json + 预览图。测试用 --mock，不调用在线模型。
import fs from 'node:fs';
import path from 'node:path';
import {writePreviewPng} from './presenter-preview-render.mjs';
import {
  LIKENESS_LIMIT,
  callVision,
  coerceLook,
  parseModelJson,
  readPhoto,
  redact,
  resolveVisionEndpoint,
} from './presenter-vision.mjs';

const args = process.argv.slice(2);
const flags = new Set(['--out', '--model', '--base-url', '--mock']);
const opts = {_: []};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (flags.has(arg)) opts[arg.slice(2)] = args[++i];
  else if (arg.startsWith('--')) {
    console.error(`不认识的参数 ${arg}`);
    process.exit(2);
  } else opts._.push(arg);
}

const photoPath = opts._[0];
const outPath = opts.out ? path.resolve(opts.out) : '';
const fail = (message, code = 2) => {
  console.error(message);
  process.exit(code);
};
if (!photoPath || !opts.out) fail('用法：node scripts/lesson/presenter-from-photo.mjs <照片> --out <look.json> [--model ...] [--base-url ...] [--mock <fixture.json>]');

const secretKeys = () => [process.env.MINIMAX_API_KEY, process.env.VISION_API_KEY];
const say = (line) => redact(line, secretKeys());

async function main() {
  const lines = [LIKENESS_LIMIT];
  let endpoint;
  if (!opts.mock) {
    try {
      endpoint = resolveVisionEndpoint({env: process.env, baseArg: opts['base-url'], modelArg: opts.model});
    } catch (error) {
      fail(say(error.message));
    }
  }
  const photo = readPhoto(path.resolve(photoPath));
  let raw;
  if (opts.mock) {
    const fixturePath = path.resolve(opts.mock);
    if (!fs.existsSync(fixturePath)) fail(`找不到 mock：${path.basename(fixturePath)}`);
    lines.push('使用本地 mock 回放，照片不会离开这台电脑。');
    for (const line of lines) console.log(say(line));
    raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8').replace(/^\uFEFF/u, ''));
  } else {
    lines.push(`照片会发送给 ${endpoint.host} 做识别`);
    for (const line of lines) console.log(say(line));
    raw = await callVision({endpoint, dataUrl: photo.dataUrl});
  }
  const {look, notes} = coerceLook(parseModelJson(raw));
  for (const note of notes) {
    const safe = say(note);
    console.log(safe);
    lines.push(safe);
  }
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  const previewPath = path.join(path.dirname(outPath), `${path.basename(outPath, path.extname(outPath))}.preview.png`);
  const logPath = path.join(path.dirname(outPath), `${path.basename(outPath, path.extname(outPath))}.log.txt`);
  fs.writeFileSync(outPath, `${JSON.stringify(look, null, 2)}\n`, 'utf8');
  writePreviewPng({look, photoPath: path.resolve(photoPath), pngPath: previewPath});
  lines.push(`look：${path.basename(outPath)}`, `preview：${path.basename(previewPath)}`);
  fs.writeFileSync(logPath, `${lines.map((line) => say(line)).join('\n')}\n`, 'utf8');
  console.log(`look：${path.basename(outPath)}`);
  console.log(`preview：${path.basename(previewPath)}`);
}

main().catch((error) => {
  console.error(say(error?.message ?? error));
  process.exit(1);
});
