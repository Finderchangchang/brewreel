#!/usr/bin/env node
// 风格工厂。一句话造一个 AI 画面风格的草稿：写配置、出参考图、看图打分、挑图、静态试拍。
// 人最后自己看 broll/styles/_drafts/<id>/review.html，再自己跑 approve-style.mjs。
// AI 助手不许替人运行 approve-style。
// 不加 --yes 只打印将要发送的请求，不调接口。视频试拍要同时加 --video 和 --yes。
//   node scripts/broll/new-style.mjs --id <id> --name <名字> --desc <一句话> [--from 图] [--n 1-4] [--retries 0-3] [--yes] [--video] [--video-redo] [--human-ok] [--state-reset]
//   node scripts/broll/new-style.mjs --batch <清单.json> [--yes] [--video] [--max-video 3]
// 清单是 JSON 数组，每项 {id, name, desc, from?}。一项失败不影响下一项。
// 做过的阶段再跑会跳过。描述改了要先删掉 broll/styles/_drafts/<id>。
import {FactoryError, runBatch, runNewStyle} from './style-factory.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : null;
};

const USAGE = `用法：node scripts/broll/new-style.mjs --id <id> --name <名字> --desc <一句话> [--from 参考图] [--n 1-4] [--retries 0-3] [--yes] [--video] [--video-redo] [--human-ok] [--state-reset]
      node scripts/broll/new-style.mjs --batch <清单.json> [--n 1-4] [--retries 0-3] [--yes] [--video] [--max-video 3]
不加 --yes 只打印将要发送的请求，不花钱。
视频试拍（H3，4 秒 768P）要同时加 --video 和 --yes，真调前会印「约 N 积分 / 按价目表约 X 元」。
提交过的任务再跑只查询，不重新提交。上次失败要重做，加 --video-redo（会再花约 280 积分）。
参考图是「需要人看」时不提交视频；人看过之后加 --human-ok 才提交。
同一个草稿同时只能有一个进程。草稿目录里有 state.json.bad-*，或 state 被清空但出图、视频还在时，先检查再加 --state-reset。
批量视频默认最多 3 条（--max-video），开跑前打印合计。
看完 broll/styles/_drafts/<id>/review.html 之后，人自己运行 approve-style.mjs。AI 助手不许替人运行 approve-style。`;

const fail = (error) => {
  console.log(error.message || String(error));
  console.log('AI 助手不许替人运行 approve-style。');
  process.exit(error.exitCode || 1);
};

const nRaw = value('--n');
const retriesRaw = value('--retries');
const maxVideoRaw = value('--max-video');
if (nRaw === null || retriesRaw === null || maxVideoRaw === null) fail(new FactoryError(USAGE, 2));
const common = {
  n: nRaw === undefined ? undefined : Number(nRaw),
  retries: retriesRaw === undefined ? undefined : Number(retriesRaw),
  yes: flag('--yes'),
  video: flag('--video'),
  videoRedo: flag('--video-redo'),
  humanOk: flag('--human-ok'),
  stateReset: flag('--state-reset'),
  maxVideo: maxVideoRaw === undefined ? undefined : Number(maxVideoRaw),
  root: value('--root') || undefined,
  log: console.log,
};
if (value('--root') === null) fail(new FactoryError(USAGE, 2));

const batch = value('--batch');
try {
  if (batch === null) fail(new FactoryError(USAGE, 2));
  if (batch) {
    const result = await runBatch({...common, file: batch});
    process.exit(result.exitCode);
  }
  const id = value('--id');
  const name = value('--name');
  const desc = value('--desc');
  const from = value('--from');
  if (id === null || name === null || desc === null || from === null || id === undefined) fail(new FactoryError(USAGE, 2));
  const result = await runNewStyle({...common, id, name, desc, from: from || null});
  process.exit(result.exitCode);
} catch (error) {
  fail(error);
}
