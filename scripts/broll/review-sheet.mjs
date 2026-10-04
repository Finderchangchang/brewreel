#!/usr/bin/env node
// 审片页。每段一行：原句、plain、提示词、开头/中间/结尾 3 帧、费用、状态。
//   node scripts/broll/review-sheet.mjs <项目目录> --out <输出目录>
// 只写 HTML，不写 broll.review.json。批准要人自己跑 approve.mjs。
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const outFlag = argv.indexOf('--out');
const projectDir = path.resolve(argv.find((a) => !a.startsWith('--') && a !== argv[outFlag + 1]) || '');
const outDir = outFlag >= 0 ? path.resolve(argv[outFlag + 1] || '') : '';
if (!projectDir || !outDir || argv[outFlag + 1]?.startsWith('--')) {
  console.log('用法：node scripts/broll/review-sheet.mjs <项目目录> --out <输出目录>');
  process.exit(2);
}
const planPath = path.join(outDir, 'broll.plan.json');
if (!fs.existsSync(planPath)) {
  console.log('还没有 broll.plan.json。先跑 make-talk，至少要先生成计划。');
  process.exit(2);
}
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8').replace(/^\uFEFF/, ''));
const ledgerPath = path.join(outDir, 'ledger.json');
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8').replace(/^\uFEFF/, '')) : {clips: {}};

const STATUS = {
  submitting: '提交中',
  submit_unknown: '提交结果不明',
  submit_failed: '提交失败',
  submitted: '已提交',
  succeeded: '已生成',
  downloaded: '已下载',
  checked: '已检查',
  approved: '已出片',
  failed: '生成失败',
  moderation: '审核拦截',
  timeout: '超时',
  auth: '鉴权失败',
  balance: '余额不足',
  cancelled: '已取消',
};

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const frame = (id, tag, label) => {
  const rel = `check/${id}-${tag}.png`;
  if (!fs.existsSync(path.join(outDir, rel))) return `<div class="ph">还没有${label}</div>`;
  return `<figure><img src="${rel}" alt="${esc(id)} ${esc(label)}"><figcaption>${esc(label)}</figcaption></figure>`;
};

const rows = (plan.clips ?? [])
  .map((clip) => {
    const entry = ledger.clips?.[clip.id] ?? {};
    const status = STATUS[entry.status] || entry.status || '还没有';
    const reason = entry.error?.message ? `<p class="err">${esc(entry.error.message)}</p>` : '';
    const cost = Number.isFinite(entry.costYuan) ? `${entry.costYuan} 元（按价目表）` : `${clip.costYuan} 元（估价）`;
    return `<tr>
      <td>${esc(clip.id)}</td>
      <td>${esc(clip.sentence)}</td>
      <td>${esc(clip.plain)}</td>
      <td class="prompt">${esc(clip.prompt)}</td>
      <td class="frames">${frame(clip.id, 'start', '开头')}${frame(clip.id, 'mid', '中间')}${frame(clip.id, 'end', '结尾')}</td>
      <td>${esc(cost)}</td>
      <td>${esc(status)}${reason}</td>
    </tr>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>B-roll 审片</title>
<style>
  body { font-family: sans-serif; margin: 24px; background: #111; color: #eee; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #333; padding: 8px; vertical-align: top; }
  th { background: #222; }
  .prompt { max-width: 360px; white-space: pre-wrap; font-size: 13px; }
  .frames { display: flex; gap: 8px; }
  img { width: 120px; height: auto; background: #000; }
  .ph { width: 120px; height: 80px; background: #222; color: #888; display: flex; align-items: center; justify-content: center; font-size: 12px; }
  .err { color: #f88; font-size: 12px; }
</style>
</head>
<body>
<h1>B-roll 审片</h1>
<p>看完再决定。这一页不批准。要批准，人自己运行 approve。AI 助手不许替人运行 approve。</p>
<table>
<thead><tr><th>段</th><th>原句</th><th>plain</th><th>提示词</th><th>开头 / 中间 / 结尾</th><th>费用</th><th>状态</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
const dest = path.join(outDir, 'review.html');
fs.writeFileSync(dest, html, 'utf8');
console.log(`审片页：${dest}`);
console.log('看完后，人自己运行 node scripts/broll/approve.mjs <项目目录> --out <输出目录>');
console.log('AI 助手不许替人运行 approve。');
