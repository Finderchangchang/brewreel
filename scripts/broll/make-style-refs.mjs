#!/usr/bin/env node
// 按积木风预设出参考图（image-01）。已有的图默认不覆盖，可以重复跑。
// 第 1 张是角色。后面的场景图用它做主体参考（subject_reference，type=character）。
//   node scripts/broll/make-style-refs.mjs [--yes] [--only ref-1.jpg]
// 没加 --yes 且还有图要生成：退出码 3。密钥只从 MINIMAX_API_KEY 读。参考图提交不重试。
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg} from './media.mjs';
import {IMAGE_YUAN} from './prices.mjs';
import {createH3Client} from './providers/minimax-h3.mjs';
import {ROOT} from './root.mjs';

const STYLE_DIR = path.join(ROOT, 'broll', 'styles', 'brick-diorama');
const STYLE_FILE = path.join(STYLE_DIR, 'style.json');
const MAX_IMAGES = 4;
const NEGATIVE = 'no studs, no logos or lettering on any surface, no minifigure, no C-shaped hands, no yellow skin.';
const ROBOT =
  'The same original light blue-grey toy robot: round smooth dome head with nothing on the crown, two round softly glowing eyes. Each hand is one solid closed ball, a smooth sphere stuck on the wrist, with no gap, no fingers and no opening. The chest is a plain blank square tile. Smooth-top matte plastic blocks, no prints and no patterns anywhere on the body.';
const yes = process.argv.includes('--yes');
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : '';

const SPECS = [
  {
    file: 'ref-1.jpg',
    aspect: '1:1',
    prompt: `Macro photograph, front view, full body, of one original toy robot made of smooth-top matte plastic blocks. Every block top is a flat tile. ${ROBOT} Standing on a plain warm brown table. Soft side light, shallow depth of field, photoreal plastic. ${NEGATIVE}`,
  },
  {
    file: 'ref-2.jpg',
    aspect: '16:9',
    subjectFrom: 'ref-1.jpg',
    prompt: `Macro photograph of a miniature workshop built only from smooth-top matte plastic blocks with flat tile tops. A small desk and shelves of colorful square blocks. ${ROBOT} stands at the desk. Soft warm side light, shallow depth of field, photoreal plastic. ${NEGATIVE}`,
  },
  {
    file: 'ref-3.jpg',
    aspect: '9:16',
    subjectFrom: 'ref-1.jpg',
    prompt: `Vertical macro photograph of a miniature warehouse built only from smooth-top matte plastic blocks with flat tile tops. Shelves of colorful square blocks line both sides. ${ROBOT} pushes a tiny block cart. Soft side light, shallow depth of field, photoreal plastic. ${NEGATIVE}`,
  },
];

if (onlyIdx >= 0 && (!only || only.startsWith('--'))) {
  console.log('用法：node scripts/broll/make-style-refs.mjs [--yes] [--only ref-1.jpg]');
  process.exit(2);
}
const selected = only ? SPECS.filter((spec) => spec.file === only) : SPECS;
if (only && !selected.length) {
  console.log(`没有叫 ${only} 的参考图。只能是 ${SPECS.map((spec) => spec.file).join('、')}。`);
  process.exit(2);
}
if (selected.length > MAX_IMAGES) {
  console.log(`参考图最多 ${MAX_IMAGES} 张。`);
  process.exit(2);
}
for (const spec of selected) {
  if (spec.prompt.length > 1500) {
    console.log(`${spec.file} 的提示词有 ${spec.prompt.length} 字，image-01 上限 1500。`);
    process.exit(2);
  }
}

const style = JSON.parse(fs.readFileSync(STYLE_FILE, 'utf8').replace(/^\uFEFF/, ''));
const missing = selected.filter((spec) => !fs.existsSync(path.join(STYLE_DIR, spec.file)));
for (const spec of selected) {
  if (!missing.includes(spec)) console.log(`${spec.file} 已有，跳过`);
}

const writeStyle = () => {
  style.references = SPECS.map((spec) => spec.file).filter((name) => fs.existsSync(path.join(STYLE_DIR, name)));
  fs.writeFileSync(STYLE_FILE, JSON.stringify(style, null, 2) + '\n', 'utf8');
};

if (!missing.length) {
  writeStyle();
  console.log('参考图都在，没有新的花费。');
  process.exit(0);
}

const cost = Math.round(missing.length * IMAGE_YUAN * 1000) / 1000;
console.log(`还要生成 ${missing.length} 张，按价目表 ${cost} 元（每张 ${IMAGE_YUAN} 元）。`);
if (!yes) {
  console.log('还没生成。确认后加 --yes 再跑同一条命令。');
  process.exit(3);
}

const client = createH3Client({log: console.log});
let spent = 0;
for (const spec of missing) {
  const subjectPath = spec.subjectFrom ? path.join(STYLE_DIR, spec.subjectFrom) : '';
  if (spec.subjectFrom && !fs.existsSync(subjectPath)) {
    writeStyle();
    console.log(`停：${spec.file} 要用 ${spec.subjectFrom} 做主体参考，可是那张图还没有。不提交。`);
    process.exit(2);
  }
  console.log(spec.subjectFrom ? `生成 ${spec.file}（${spec.aspect}，主体参考 ${spec.subjectFrom}）` : `生成 ${spec.file}（${spec.aspect}，角色图）`);
  let url;
  try {
    url = await client.image({prompt: spec.prompt, aspect: spec.aspect, subjectPath: subjectPath || undefined});
  } catch (e) {
    writeStyle();
    console.log(`停：${spec.file} 失败。${e.message}`);
    process.exit(e.exitCode || 4);
  }
  let buf;
  try {
    buf = await client.downloadBytes(url);
  } catch (e) {
    writeStyle();
    console.log(`停：${spec.file} 下载失败。${e.message}`);
    process.exit(e.exitCode || 4);
  }
  const dest = path.join(STYLE_DIR, spec.file);
  const jpeg = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
  if (jpeg) {
    fs.writeFileSync(dest, buf);
  } else {
    const src = `${dest}.src`;
    fs.writeFileSync(src, buf);
    const conv = ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-frames:v', '1', dest]);
    fs.rmSync(src, {force: true});
    if (conv.status !== 0 || !fs.existsSync(dest)) {
      writeStyle();
      console.log(`停：${spec.file} 转成 jpg 失败。`);
      process.exit(4);
    }
  }
  spent = Math.round((spent + IMAGE_YUAN) * 1000) / 1000;
  console.log(`${spec.file} 已保存，按价目表 ${IMAGE_YUAN} 元`);
}
writeStyle();
console.log(`本次参考图 ${spent} 元（按价目表）。style.json 已写上参考图列表。`);
