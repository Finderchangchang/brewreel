#!/usr/bin/env node
// 打印带编号的句子清单，给写 broll.json 的模型看。
//   node scripts/broll/list-cues.mjs <项目目录>
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {formatCues, parseSrt} from './srt.mjs';

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!dir) {
    console.log('用法：node scripts/broll/list-cues.mjs <项目目录>');
    process.exit(2);
  }
  const srt = path.join(path.resolve(dir), 'talk.srt');
  if (!fs.existsSync(srt)) {
    console.log(`项目目录缺少 talk.srt。先自动转写：node scripts/broll/transcribe.mjs "${path.resolve(dir)}"（或者自己放一个 talk.srt）。`);
    process.exit(2);
  }
  try {
    const cues = parseSrt(fs.readFileSync(srt, 'utf8'));
    if (!cues.length) {
      console.log('字幕里一句都没有。检查 talk.srt 是不是空的。');
      process.exit(1);
    }
    console.log(formatCues(cues));
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
}
