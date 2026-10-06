#!/usr/bin/env node
// 人看完风格工厂的汇总页之后自己跑。AI 助手不许替人运行本命令。
//   node scripts/broll/approve-style.mjs <id>
// 把 broll/styles/_drafts/<id>/ 里的 style.json 和选中的两张参考图抄到 broll/styles/<id>/。
// 做过视频试拍且通过的，status 写 stable；没做或没过的写 experimental。
// 不覆盖已经发布的风格目录。
// 不是交互终端就拒绝。人跑时先看结论和硬伤，输入 id 确认；需要人看的还要再输入 yes。
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {approveStyle, approveTestRootOk, draftDirOf, FactoryError} from './style-factory.mjs';
import {ROOT} from './root.mjs';

export const parseApproveArgs = (args) => {
  const rootFlag = args.indexOf('--root');
  const root = rootFlag >= 0 ? args[rootFlag + 1] : undefined;
  const id = args.find((a, i) => !a.startsWith('--') && !(rootFlag >= 0 && i === rootFlag + 1));
  return {id, root};
};

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer ?? '').trim());
    });
  });

const hardLines = (report) => {
  const lines = [];
  for (const block of [report?.character, report?.material, report?.still, report?.video]) {
    for (const row of block?.rows || []) {
      for (const hard of row.hard || []) lines.push(`${row.file} ${hard.code} ${hard.reason || ''}`.trim());
    }
  }
  return lines;
};

const sameEntry = (a, b) => {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
};

const isMain = process.argv[1] && sameEntry(fileURLToPath(import.meta.url), process.argv[1]);

const main = async () => {
  const args = process.argv.slice(2);
  const {id, root} = parseApproveArgs(args);
  const rootFlag = args.indexOf('--root');
  console.log('AI 助手不许替人运行 approve-style。这一步只能人自己跑。');
  const testBypass = process.env.BREWREEL_APPROVE_TEST === '1' && rootFlag >= 0 && approveTestRootOk(root);
  if (!process.stdin.isTTY && !testBypass) {
    console.log('这一步只能人在终端里自己跑');
    process.exit(2);
  }
  if (!id || (rootFlag >= 0 && !root)) {
    console.log('用法：node scripts/broll/approve-style.mjs <id>');
    console.log('先看 broll/styles/_drafts/<id>/review.html，再运行这条。');
    process.exit(2);
  }
  const draftDir = draftDirOf(root || ROOT, id);
  const reportPath = path.join(draftDir, 'report.json');
  let report = null;
  if (fs.existsSync(reportPath)) {
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      report = null;
    }
  }
  let humanYes = false;
  if (!testBypass) {
    console.log(`汇总页：${path.join(draftDir, 'review.html')}`);
    console.log(`结论：${report?.conclusion || '（还没有报告）'}`);
    const hards = hardLines(report);
    console.log(hards.length ? `硬伤：\n${hards.map((line) => `- ${line}`).join('\n')}` : '硬伤：没有');
    if (report?.needsHuman) console.log('这一份标了需要人看。');
    if (report?.error) console.log(`报告里有错误：${String(report.error).split('\n')[0]}`);
    const typed = await ask(`输入 ${id} 再回车，才会批准：`);
    if (typed !== id) {
      console.log('输入的 id 不一致，没有批准。');
      process.exit(2);
    }
    if (report?.needsHuman) {
      const yes = await ask('看过需要人看的项之后，输入 yes 再回车：');
      if (yes !== 'yes') {
        console.log('没有输入 yes，没有批准。');
        process.exit(2);
      }
      humanYes = true;
    }
  }
  try {
    approveStyle({id, root, log: console.log, humanYes});
  } catch (error) {
    console.log(error instanceof FactoryError ? error.message : error.message);
    process.exit(error.exitCode || 1);
  }
};

if (isMain) await main();
