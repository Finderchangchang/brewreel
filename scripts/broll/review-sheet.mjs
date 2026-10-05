#!/usr/bin/env node
// 审片页。每段一行：原句、plain、风格、提示词、开头/中间/结尾 3 帧、费用、状态。
// 动效段也出一行，标「动效，不用审」，列出屏幕上会出现的字（全部出自原句），给人看字对不对。
// 最上面一条「片头条」：每段 AI 画面一张中间帧加风格名并排放，一眼看出几段之间角色和材质是否一致。
//   node scripts/broll/review-sheet.mjs <项目目录> --out <输出目录>
// 只写 HTML，不写 broll.review.json。批准要人自己跑 approve.mjs。
import fs from 'node:fs';
import path from 'node:path';
import {readStyles, styleLabel} from './prompt.mjs';

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
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8').replace(/^﻿/, ''));
const ledgerPath = path.join(outDir, 'ledger.json');
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8').replace(/^﻿/, '')) : {clips: {}};
let styles = {};
try {
  styles = readStyles();
} catch {
  styles = {};
}

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
const frames = (id) => `<td class="frames">${frame(id, 'start', '开头')}${frame(id, 'mid', '中间')}${frame(id, 'end', '结尾')}</td>`;

const isMotion = (clip) => clip.source === 'motion';
const styleOf = (clip) => {
  const id = clip.styleId || plan.style;
  if (!id) return '';
  const label = styleLabel(styles[id], id);
  return clip.look === 'alt' ? `${label}（副风格）` : label;
};

const rows = (plan.clips ?? [])
  .map((clip) => {
    if (isMotion(clip)) {
      const text = (clip.motion?.screenText ?? []).map((t) => `<li>${esc(t)}</li>`).join('');
      return `<tr class="motion">
      <td>${esc(clip.id)}</td>
      <td>${esc(clip.sentence)}</td>
      <td>${esc(clip.plain)}</td>
      <td>动效：${esc(clip.template)}</td>
      <td class="prompt">屏幕上的字（全部出自原句）：<ul>${text}</ul></td>
      ${frames(clip.id)}
      <td>0 元（动效）</td>
      <td>动效，不用审</td>
    </tr>`;
    }
    const entry = ledger.clips?.[clip.id] ?? {};
    const status = STATUS[entry.status] || entry.status || '还没有';
    const reason = entry.error?.message ? `<p class="err">${esc(entry.error.message)}</p>` : '';
    const cost = Number.isFinite(entry.costYuan) ? `${entry.costYuan} 元（按价目表）` : `${clip.costYuan} 元（估价）`;
    const link = clip.link === 'continue' ? '<p class="note">接上一段的结尾</p>' : '';
    return `<tr>
      <td>${esc(clip.id)}</td>
      <td>${esc(clip.sentence)}</td>
      <td>${esc(clip.plain)}</td>
      <td>${esc(styleOf(clip))}${link}</td>
      <td class="prompt">${esc(clip.prompt)}</td>
      ${frames(clip.id)}
      <td>${esc(cost)}</td>
      <td>${esc(status)}${reason}</td>
    </tr>`;
  })
  .join('\n');

// 片头条：每段 AI 画面的中间帧 + 风格名，并排
const strip = (plan.clips ?? [])
  .filter((c) => !isMotion(c))
  .map((clip) => {
    const rel = `check/${clip.id}-mid.png`;
    const img = fs.existsSync(path.join(outDir, rel)) ? `<img src="${rel}" alt="${esc(clip.id)}">` : '<div class="ph">还没有画面</div>';
    return `<figure>${img}<figcaption>${esc(clip.id)} · ${esc(styleOf(clip))}</figcaption></figure>`;
  })
  .join('');
const thread = plan.thread ? `<p>主线：${esc(plan.thread)}</p>` : '';

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
  tr.motion td { background: #16201a; }
  .prompt { max-width: 360px; white-space: pre-wrap; font-size: 13px; }
  .frames { display: flex; gap: 8px; }
  .strip { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0 24px; }
  img { width: 120px; height: auto; background: #000; }
  figcaption { font-size: 12px; color: #aaa; }
  .ph { width: 120px; height: 80px; background: #222; color: #888; display: flex; align-items: center; justify-content: center; font-size: 12px; }
  .err { color: #f88; font-size: 12px; }
  .note { color: #8cf; font-size: 12px; }
</style>
</head>
<body>
<h1>B-roll 审片</h1>
<p>看完再决定。这一页不批准。要批准，人自己运行 approve。AI 助手不许替人运行 approve。</p>
<p>动效画面（绿色底的行）不花钱、不用审：屏幕上的字全部出自原句，看一眼字对不对就行。转写错的字会照样上屏，要改就改 talk.srt 里的错字（不要拆句、并句）。</p>
${thread}
${strip ? `<h2>片头条：几段 AI 画面放在一起看角色和材质是否一致</h2><div class="strip">${strip}</div>` : ''}
<table>
<thead><tr><th>段</th><th>原句</th><th>plain</th><th>风格</th><th>提示词 / 上屏字</th><th>开头 / 中间 / 结尾</th><th>费用</th><th>状态</th></tr></thead>
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
