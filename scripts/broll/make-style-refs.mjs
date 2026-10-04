#!/usr/bin/env node
// 按积木风预设出 3 张参考图（image-01）。已有的图默认不覆盖，可以重复跑。
//   node scripts/broll/make-style-refs.mjs [--yes]
// 没加 --yes 且还有图要生成：退出码 3。密钥只从 MINIMAX_API_KEY 读。
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg} from './media.mjs';
import {IMAGE_YUAN} from './prices.mjs';
import {createH3Client} from './providers/minimax-h3.mjs';
import {ROOT} from './root.mjs';

const STYLE_DIR = path.join(ROOT, 'broll', 'styles', 'brick-diorama');
const STYLE_FILE = path.join(STYLE_DIR, 'style.json');
const MAX_IMAGES = 4;
const yes = process.argv.includes('--yes');

const SPECS = [
  {
    file: 'ref-1.jpg',
    aspect: '16:9',
    prompt:
      'Macro photograph of a miniature tabletop diorama built entirely from matte plastic toy bricks. A tiny brick workshop, desk and shelves of colorful square blocks. One small boxy toy robot made of light blue-grey matte bricks stands at the desk: rounded head with a smooth top and no studs on the head, two round softly glowing eyes, rounded ball-like hands. The brick scenery may show studs. The robot is unbranded. Soft warm side light, shallow depth of field. No text, letters, numbers, logos or real people.',
  },
  {
    file: 'ref-2.jpg',
    aspect: '3:4',
    prompt:
      'Close-up macro photograph of one small boxy toy robot built from light blue-grey matte plastic bricks. Rounded head, smooth top with no studs on the head, two round softly glowing eyes, short rounded ball-like hands, standing on a brown brick base and holding one small orange square block. The baseplate may show studs. Unbranded. Soft side light, shallow depth of field. No text, letters, numbers, logos or real people.',
  },
  {
    file: 'ref-3.jpg',
    aspect: '9:16',
    prompt:
      'Vertical macro photograph of a miniature brick warehouse. Shelves of colorful square blocks line both sides. The same unbranded light blue-grey toy robot, rounded head with a smooth top and no studs on the head, round glowing eyes, ball-like hands, pushes a tiny brick cart. Brick scenery may show studs. Soft side light, shallow depth of field. No text, letters, numbers, logos or real people.',
  },
];

if (SPECS.length > MAX_IMAGES) {
  console.log(`参考图最多 ${MAX_IMAGES} 张。`);
  process.exit(2);
}

const style = JSON.parse(fs.readFileSync(STYLE_FILE, 'utf8').replace(/^\uFEFF/, ''));
const missing = SPECS.filter((spec) => !fs.existsSync(path.join(STYLE_DIR, spec.file)));
for (const spec of SPECS) {
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
  console.log(`生成 ${spec.file}（${spec.aspect}）`);
  let url;
  try {
    url = await client.image({prompt: spec.prompt, aspect: spec.aspect});
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
