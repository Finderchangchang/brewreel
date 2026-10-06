#!/usr/bin/env node
// 用人工标注集核对看图打分。会真的调 MiniMax 看图接口（订阅套餐额度）。
//   node scripts/broll/judge-calibrate.mjs <labels.json> --yes [--out 报告.json] [--probe-only]
// 标注里的 file 相对「labels.json 所在目录的上一级」（也就是 promo-video-skill-tests）。
// 先做一次连通性试探（一张图问「图里有什么」）。模型名不对就换候选再试。
// 密钥只从 MINIMAX_API_KEY 读，不打印、不写进报告。
// unsure 不计入硬伤召回，也不算误杀，汇总里单独列出。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {judgeImage, probeVision, visionModelOf} from './judge.mjs';

/**
 * 校准汇总。unsure 从硬伤召回的分子和分母里拿掉，也不算误杀、不算 best 误杀。
 * @param {Array<{file: string, human: string, judge: string, best?: boolean, missing?: boolean, hard?: string[], humanReasons?: string[], followups?: number}>} rows
 */
export const summarizeCalibration = (rows) => {
  const unsure = rows.filter((row) => row.judge === 'unsure');
  const humanFail = rows.filter((row) => row.human === 'fail' && !row.missing && row.judge !== 'unsure');
  const humanPass = rows.filter((row) => row.human === 'pass' && !row.missing);
  const recalled = humanFail.filter((row) => row.judge === 'fail');
  const falseKill = humanPass.filter((row) => row.judge === 'fail');
  const bestKill = humanPass.filter((row) => row.best && row.judge === 'fail');
  const recall = humanFail.length ? recalled.length / humanFail.length : 0;
  const types = {};
  for (const row of humanFail) {
    for (const code of row.humanReasons || []) {
      if (!types[code]) types[code] = {human: 0, hit: 0};
      types[code].human += 1;
      if ((row.hard || []).includes(code)) types[code].hit += 1;
    }
  }
  const followups = rows.reduce((sum, row) => sum + (Number(row.followups) || 0), 0);
  const secondOpinions = rows.reduce((sum, row) => sum + (Number(row.secondOpinions) || 0), 0);
  const attempts = rows.reduce((sum, row) => sum + (Number(row.attempts) || 0), 0);
  const humanFailLabeled = rows.filter((row) => row.human === 'fail' && !row.missing);
  const humanFailUnsure = humanFailLabeled.filter((row) => row.judge === 'unsure').length;
  const invalid = humanFailLabeled.length > 0 && humanFailUnsure / humanFailLabeled.length > 0.25;
  return {
    recall,
    recalled: recalled.length,
    humanFail: humanFail.length,
    falseKill: falseKill.length,
    falseKillFiles: falseKill.map((row) => row.file),
    humanPass: humanPass.length,
    bestKill: bestKill.length,
    bestKillFiles: bestKill.map((row) => row.file),
    unsure: unsure.length,
    unsureFiles: unsure.map((row) => row.file),
    humanFailUnsure,
    humanFailLabeled: humanFailLabeled.length,
    followups,
    secondOpinions,
    attempts,
    types,
    missed: humanFail.filter((row) => row.judge !== 'fail'),
    invalid,
    conclusion: invalid ? '无效：模型没答完的太多' : '',
  };
};

const sameEntry = (a, b) => {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
};
const isMain = process.argv[1] && sameEntry(fileURLToPath(import.meta.url), process.argv[1]);
if (isMain) await main();

async function main() {

const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : null;
};
const labelsPath = args.find((a) => !a.startsWith('--') && a !== value('--out'));
const probeOnly = args.includes('--probe-only');
if (!labelsPath || value('--out') === null) {
  console.log('用法：node scripts/broll/judge-calibrate.mjs <labels.json> --yes [--out 报告.json] [--probe-only]');
  console.log('没有 --yes 只打印张数和最多请求数，不调接口。密钥从 MINIMAX_API_KEY 读，不打印。');
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const labelsFile = path.resolve(labelsPath);
const base = path.resolve(path.dirname(labelsFile), '..');
const doc = readJson(labelsFile);
const items = Array.isArray(doc.items) ? doc.items : [];
if (!items.length) {
  console.log(`标注集是空的：${labelsFile}`);
  process.exit(2);
}
if (!args.includes('--yes')) {
  console.log(`标注 ${items.length} 张，最多 ${items.length * 6} 次看图请求。没有 --yes，不调用。`);
  process.exit(0);
}

const env = process.env;
const first = items.map((item) => path.resolve(base, item.file)).find((file) => fs.existsSync(file));
if (!first) {
  console.log(`一张标注图都找不到。路径相对 ${base}。`);
  process.exit(2);
}

let probe;
try {
  probe = await probeVision({file: first, env, log: console.log});
} catch (error) {
  console.log(error.message);
  process.exit(error.exitCode || 4);
}
if (probeOnly) process.exit(0);

const model = probe.model || visionModelOf(env);
const rows = [];
for (const item of items) {
  const file = path.resolve(base, item.file);
  if (!fs.existsSync(file)) {
    rows.push({file: item.file, kind: item.kind, human: item.verdict, best: !!item.best, missing: true, judge: 'missing', hard: [], reasons: ['文件不在']});
    console.log(`缺文件 ${item.file}`);
    continue;
  }
  let judged;
  try {
    judged = await judgeImage({file, kind: item.kind, env, model, log: console.log});
  } catch (error) {
    rows.push({file: item.file, kind: item.kind, human: item.verdict, best: !!item.best, humanReasons: item.reasons || [], judge: 'error', hard: [], reasons: [error.message], pass: false});
    console.log(`${item.file} 看图失败：${error.message}`);
    continue;
  }
  const hard = judged.hard.map((h) => h.code);
  const row = {
    file: item.file,
    kind: item.kind,
    human: item.verdict,
    best: !!item.best,
    humanReasons: item.reasons || [],
    judge: judged.verdict,
    pass: judged.pass,
    hard,
    hardDetail: judged.hard,
    unanswered: judged.missing || [],
    soft: judged.soft,
    reasons: judged.reasons,
    attempts: judged.attempts,
    followups: judged.followups || 0,
    secondOpinions: judged.secondOpinions || 0,
  };
  rows.push(row);
  const mark = item.verdict === row.judge ? '一致' : row.judge === 'unsure' ? '未答完' : '不一致';
  const extra = row.judge === 'unsure' && row.unanswered.length ? ` 没回答=${row.unanswered.join('+')}` : '';
  console.log(`${mark} ${item.file} 人=${item.verdict}${item.best ? '/best' : ''} judge=${row.judge} 硬伤=${hard.join('+') || '无'}${extra}`);
}

const stats = summarizeCalibration(rows);

console.log('');
console.log(`硬伤召回 ${stats.recalled}/${stats.humanFail} = ${(stats.recall * 100).toFixed(1)}%`);
console.log(`误杀 ${stats.falseKill}/${stats.humanPass}`);
console.log(`best 误杀 ${stats.bestKill}`);
console.log(`unsure ${stats.unsure}${stats.unsureFiles.length ? `：${stats.unsureFiles.join('、')}` : ''}`);
console.log(`人标 fail 里 unsure 张数 ${stats.humanFailUnsure}`);
console.log(`补问 ${stats.followups} 次`);
console.log(`第二意见 ${stats.secondOpinions} 次`);
console.log(`看图请求 ${stats.attempts} 次（不含开头那一次连通性试探）`);
if (stats.invalid) console.log(stats.conclusion);
for (const [code, stat] of Object.entries(stats.types)) console.log(`类型 ${code}：命中 ${stat.hit}/${stat.human}`);
if (stats.falseKill) console.log(`误杀的图：${stats.falseKillFiles.join('、')}`);
if (stats.bestKill) console.log(`best 被误杀：${stats.bestKillFiles.join('、')}`);
if (stats.missed.length) console.log(`漏掉的硬伤：${stats.missed.map((row) => `${row.file}（人=${(row.humanReasons || []).join('+')}）`).join('、')}`);

const out = value('--out') || path.join(path.dirname(labelsFile), 'out', 'judge-calibrate.json');
fs.mkdirSync(path.dirname(out), {recursive: true});
const summary = {
  model,
  subscription: probe.subscription,
  probeMs: probe.ms,
  probeAnswer: probe.answer,
  tried: probe.tried,
  recall: stats.recall,
  recalled: stats.recalled,
  humanFail: stats.humanFail,
  falseKill: stats.falseKill,
  humanPass: stats.humanPass,
  bestKill: stats.bestKill,
  unsure: stats.unsure,
  unsureFiles: stats.unsureFiles,
  humanFailUnsure: stats.humanFailUnsure,
  followups: stats.followups,
  secondOpinions: stats.secondOpinions,
  attempts: stats.attempts,
  types: stats.types,
  invalid: stats.invalid,
  conclusion: stats.conclusion,
  rows,
};
fs.writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`报告：${out}`);
process.exit(0);
}
