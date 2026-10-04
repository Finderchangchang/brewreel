#!/usr/bin/env node
// 人看完审片页之后自己跑。AI 助手不许替人运行本命令。
//   node scripts/broll/approve.mjs <项目目录> --out <输出目录>
// 写出 broll.review.json，绑定 broll.json 和每段片段文件的 sha256。改了就失效。
import fs from 'node:fs';
import path from 'node:path';
import {writeApproval} from './review.mjs';

const argv = process.argv.slice(2);
const outFlag = argv.indexOf('--out');
const projectDir = path.resolve(argv.find((a, i) => !a.startsWith('--') && i !== outFlag + 1) || '');
const outDir = outFlag >= 0 ? path.resolve(argv[outFlag + 1] || '') : '';
if (!projectDir || !outDir || argv[outFlag + 1]?.startsWith('--')) {
  console.log('用法：node scripts/broll/approve.mjs <项目目录> --out <输出目录>');
  console.log('AI 助手不许替人运行 approve。');
  process.exit(2);
}
const planPath = path.join(outDir, 'broll.plan.json');
if (!fs.existsSync(planPath)) {
  console.log('还没有 broll.plan.json。先生成，再看审片页，再批准。');
  process.exit(2);
}
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8').replace(/^\uFEFF/, ''));
const ids = (plan.clips ?? []).map((c) => c.id);
try {
  const dest = writeApproval({projectDir, outDir, clipIds: ids});
  console.log(`已写入 ${dest}`);
  console.log('broll.json 或任一段片段变了，这份批准就失效。');
} catch (e) {
  console.log(e.message);
  process.exit(1);
}
