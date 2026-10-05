#!/usr/bin/env node
// 按风格包出参考图（image-01）。规格全从 broll/styles/<id>/style.json 的 refs 读：
// 每张图的文件名、用途（角色 / 材质）、宽高比、出图提示；提示里的 {character} 换成
// 「本风格材质的机器人 + broll/character.json 里共用的形状和色号」。已有的图不覆盖，可以重复跑。
//   node scripts/broll/make-style-refs.mjs --style <id> [--only refs/character.jpg] [--n 1-4] [--dry-run] [--yes]
// --dry-run：只打印将要发送的请求（图片按字节数略写，不带密钥）。不需要密钥，不花钱。
// --n 2..4：每张出几张候选，存成 refs/character.cand-1.jpg 这样；人挑一张改名成 refs/character.jpg。
// 退出码：0 完成或没有要出的 / 2 参数或风格包有问题 / 3 还没加 --yes / 4 接口失败。
// 密钥只从 MINIMAX_API_KEY 读。参考图提交不重试。这个脚本给维护者用，普通用户不用跑。
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg} from './media.mjs';
import {IMAGE_YUAN} from './prices.mjs';
import {expandRefPrompt, isExperimental, lintStyle, loadCharacter, readStyles, refListOf, styleDirOf, styleLabel, styleRefs} from './prompt.mjs';
import {buildImageBody, createH3Client, IMAGE_MODEL, redactBody, resolveBase} from './providers/minimax-h3.mjs';
import {ROOT} from './root.mjs';

const MAX_IMAGES = 4;
const USAGE = '用法：node scripts/broll/make-style-refs.mjs --style <风格 id> [--only refs/character.jpg] [--n 1-4] [--dry-run] [--yes]';
const PICK = '挑图标准：任何表面都没有圆形凸点；机器人头顶光滑、两只手都是实心圆球；画面里没有字；角色图和材质图看着是同一个世界。';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : null;
};
const stop = (code, msg) => {
  console.log(msg);
  process.exit(code);
};

const styles = readStyles(ROOT);
const listStyles = () =>
  Object.keys(styles)
    .map((id) => {
      const st = styles[id];
      const refs = styleRefs(id, st, ROOT);
      const tag = st.default ? '，默认' : isExperimental(st) ? '，实验' : '';
      return `  - ${id}：${st.name ?? id}${tag}，参考图 ${refs.filter((r) => r.exists).length}/${refs.length}`;
    })
    .join('\n');

const styleId = value('--style');
if (styleId === undefined || styleId === null) stop(2, `${USAGE}\n要先用 --style 说清给哪个风格出图。现在有：\n${listStyles()}`);
const style = styles[styleId];
if (!style) stop(2, `没有叫「${styleId}」的风格。现在有：\n${listStyles()}`);

const only = value('--only');
if (only === null) stop(2, USAGE);
const nRaw = value('--n');
if (nRaw === null) stop(2, USAGE);
const n = nRaw === undefined ? 1 : Number(nRaw);
if (!Number.isInteger(n) || n < 1 || n > MAX_IMAGES) stop(2, `--n 要是 1 到 ${MAX_IMAGES} 的整数，现在是 ${nRaw}。`);
const dryRun = flag('--dry-run');
const yes = flag('--yes');

let character;
try {
  character = loadCharacter(ROOT);
} catch (e) {
  stop(2, `读不到 broll/character.json（${e.message}）。从仓库恢复这个文件再来。`);
}
const problems = lintStyle(style, styleId, {styles, character});
if (problems.length) stop(2, `风格包有问题，先改 broll/styles/${styleId}/style.json：\n${problems.map((p) => `  - ${p}`).join('\n')}`);

const styleDir = styleDirOf(styleId, ROOT);
const specs = refListOf(style);
const sameFile = (a, b) => path.normalize(a) === path.normalize(b) || path.basename(a) === b;
const selected = only ? specs.filter((s) => sameFile(s.file, only)) : specs;
if (only && !selected.length) stop(2, `「${styleId}」没有叫 ${only} 的参考图。只能是 ${specs.map((s) => s.file).join('、')}。`);

const candName = (file, k) => {
  const ext = path.extname(file) || '.jpg';
  return `${file.slice(0, file.length - path.extname(file).length)}.cand-${k}${ext}`;
};

// 要出的图：目标已在就整张跳过；--n 大于 1 时出候选，已有的候选也跳过。
const jobs = [];
for (const spec of selected) {
  const target = path.resolve(styleDir, spec.file);
  if (fs.existsSync(target)) {
    console.log(`${spec.file} 已有，跳过`);
    continue;
  }
  if (typeof spec.prompt !== 'string' || !spec.prompt.trim()) {
    stop(2, `${spec.file} 还没有，可是风格包里没有它的出图提示（prompt 为空）。这张图不能由脚本出：${spec.note ?? '补上 prompt，或手动放一张图'}。`);
  }
  const outs = n === 1 ? [spec.file] : Array.from({length: n}, (_, k) => candName(spec.file, k + 1));
  for (const out of outs) {
    if (fs.existsSync(path.resolve(styleDir, out))) console.log(`${out} 已有，跳过`);
    else jobs.push({spec, out, abs: path.resolve(styleDir, out), prompt: expandRefPrompt(spec, style, character)});
  }
}
if (jobs.length > MAX_IMAGES) stop(2, `这次要出 ${jobs.length} 张，一次最多 ${MAX_IMAGES} 张。用 --only 一张一张出，或把 --n 调小。`);

// 主体参考：要么已经有，要么这次会先出它（只算 --n 1 出的正式图）。
const willMake = new Set(jobs.filter((j) => j.out === j.spec.file).map((j) => j.abs));
for (const job of jobs) {
  if (!job.spec.subjectFrom) continue;
  job.subjectAbs = path.resolve(styleDir, job.spec.subjectFrom);
  if (!fs.existsSync(job.subjectAbs) && !willMake.has(job.subjectAbs) && !dryRun) {
    stop(2, `${job.out} 要用 ${job.spec.subjectFrom} 做主体参考，可是那张图还没有，这次也不会出。先出那张图。没有提交，也没有花钱。`);
  }
}

if (!jobs.length) stop(0, '参考图都在，没有新的花费。');
const cost = Math.round(jobs.length * IMAGE_YUAN * 1000) / 1000;

if (dryRun) {
  let base;
  try {
    base = resolveBase(process.env);
  } catch (e) {
    stop(2, e.message);
  }
  console.log(`dry-run：${styleLabel(style, styleId)} 要出 ${jobs.length} 张，下面是将要发送的请求。没有发送，不花钱。`);
  jobs.forEach((job, i) => {
    let body;
    if (job.subjectAbs && fs.existsSync(job.subjectAbs)) body = redactBody(buildImageBody({prompt: job.prompt, aspect: job.spec.aspect, subjectPath: job.subjectAbs}));
    else {
      body = buildImageBody({prompt: job.prompt, aspect: job.spec.aspect});
      if (job.subjectAbs) body.subject_reference = [{type: 'character', image_file: `（运行时读 ${job.spec.subjectFrom}，现在还没有这张图）`}];
    }
    console.log(`\n[${i + 1}/${jobs.length}] ${job.out}（${job.spec.role}，${job.spec.aspect}，模型 ${IMAGE_MODEL}）`);
    console.log(`POST ${base}/v1/image_generation`);
    console.log(JSON.stringify(body, null, 2));
  });
  console.log(`\n按价目表 ${cost} 元（每张 ${IMAGE_YUAN} 元）。确认后把 --dry-run 换成 --yes 再跑同一条命令。`);
  console.log(PICK);
  process.exit(0);
}

console.log(`${styleLabel(style, styleId)} 还要出 ${jobs.length} 张，按价目表 ${cost} 元（每张 ${IMAGE_YUAN} 元）。`);
if (!yes) stop(3, '还没生成。先加 --dry-run 看将要发送的请求；确认后加 --yes 再跑同一条命令。');

const client = createH3Client({log: console.log});
let spent = 0;
for (const job of jobs) {
  if (job.subjectAbs && !fs.existsSync(job.subjectAbs)) stop(2, `停：${job.out} 要用 ${job.spec.subjectFrom} 做主体参考，可是那张图没出来。不提交。`);
  console.log(job.subjectAbs ? `生成 ${job.out}（${job.spec.role}，${job.spec.aspect}，主体参考 ${job.spec.subjectFrom}）` : `生成 ${job.out}（${job.spec.role}，${job.spec.aspect}）`);
  let url;
  try {
    url = await client.image({prompt: job.prompt, aspect: job.spec.aspect, subjectPath: job.subjectAbs || undefined});
  } catch (e) {
    stop(e.exitCode || 4, `停：${job.out} 失败。${e.message}`);
  }
  let buf;
  try {
    buf = await client.downloadBytes(url);
  } catch (e) {
    stop(e.exitCode || 4, `停：${job.out} 下载失败。${e.message}`);
  }
  fs.mkdirSync(path.dirname(job.abs), {recursive: true});
  const jpeg = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
  if (jpeg) fs.writeFileSync(job.abs, buf);
  else {
    const src = `${job.abs}.src`;
    fs.writeFileSync(src, buf);
    const conv = ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-frames:v', '1', job.abs]);
    fs.rmSync(src, {force: true});
    if (conv.status !== 0 || !fs.existsSync(job.abs)) stop(4, `停：${job.out} 转成 jpg 失败。`);
  }
  spent = Math.round((spent + IMAGE_YUAN) * 1000) / 1000;
  console.log(`${job.out} 已保存，按价目表 ${IMAGE_YUAN} 元`);
}
console.log(`本次参考图 ${spent} 元（按价目表）。`);
if (n > 1) console.log(`候选在 broll/styles/${styleId}/ 下。每张挑一张改名成正式文件名（比如 refs/character.jpg），其余删掉。`);
console.log(PICK);
