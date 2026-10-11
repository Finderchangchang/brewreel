#!/usr/bin/env node
// node scripts/scene/brief-to-video.mjs <brief.md|json> --out <目录> [--assets <素材清单>]
// 先让 generate-scene 写 scene.json（带回喂），再交给 make-scene 出片。
// 没有 DeepSeek 密钥时停在这里，不调用模型。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hasLlmKey} from '../broll/llm-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PASS = ['style', 'motion', 'voice-provider', 'scale', 'product'];
const SWITCH = ['no-voice', 'no-bgm'];

function argsOf(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = 'true';
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return {positional, flags};
}

function outsideRepo(dir) {
  const rel = path.relative(ROOT, path.resolve(dir));
  return rel.startsWith('..') || path.isAbsolute(rel);
}

function assetRows(file, briefId) {
  if (!file) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(data) ? data : data[briefId] || data.assets || [];
  if (!Array.isArray(list)) return [];
  return list.filter((item) => item && item.file).map((item) => ({file: String(item.file), note: String(item.note || '素材')}));
}

function briefUsed(briefPath, assetsPath, dest) {
  const id = path.basename(briefPath, path.extname(briefPath));
  const rows = assetRows(assetsPath, id);
  const ext = path.extname(briefPath).toLowerCase();
  if (ext === '.md') {
    let text = fs.readFileSync(briefPath, 'utf8');
    if (rows.length) {
      const lines = rows.map((item) => `- ${item.file}：${item.note}`).join('\n');
      text += `\n\n素材清单（src 只能用下面这些路径，逐字复制，不要编造）：\n${lines}\n`;
    }
    const out = path.join(dest, 'brief.used.md');
    fs.writeFileSync(out, text, 'utf8');
    return out;
  }
  const data = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
  if (rows.length) data.assets = rows;
  const out = path.join(dest, 'brief.used.json');
  fs.writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return out;
}

function runNode(script, argv) {
  const ran = spawnSync(process.execPath, [path.join(ROOT, script), ...argv], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
  });
  if (ran.stdout) process.stdout.write(ran.stdout);
  if (ran.stderr) process.stderr.write(ran.stderr);
  return ran.status ?? 1;
}

const {positional, flags} = argsOf(process.argv.slice(2));
const brief = positional[0];
const outDir = flags.out;
if (!brief || !outDir) {
  console.error('用法: node scripts/scene/brief-to-video.mjs <brief.md|json> --out <目录> [--assets <素材清单.json>] [--style 名字] [--motion 性格] [--voice-provider minimax|aliyun|volcengine|mock] [--no-voice] [--no-bgm]');
  process.exit(2);
}
if (!outsideRepo(outDir)) {
  console.error('输出目录要在仓库外面');
  process.exit(2);
}
if (!hasLlmKey()) {
  console.error('没有 DeepSeek 密钥。设 DEEPSEEK_API_KEY 或 LLM_API_KEY 后再跑这条命令。密钥不会打印，也不要写进命令或文件。只出片、简报已经是 scene.json 时，改跑 node scripts/scene/make-scene.mjs。');
  process.exit(2);
}
if (!fs.existsSync(brief)) {
  console.error(`找不到简报：${brief}`);
  process.exit(2);
}

fs.mkdirSync(outDir, {recursive: true});
const used = briefUsed(path.resolve(brief), flags.assets ? path.resolve(flags.assets) : '', outDir);
const scenePath = path.join(outDir, 'scene.json');
const generated = runNode('scripts/scene/generate-scene.mjs', [used, '--out', scenePath]);
if (generated !== 0) process.exit(generated);
if (!fs.existsSync(scenePath)) {
  console.error('没有写出 scene.json');
  process.exit(1);
}
const makeArgs = [scenePath, '--out', outDir];
for (const name of PASS) if (flags[name] && flags[name] !== 'true') makeArgs.push(`--${name}`, flags[name]);
for (const name of SWITCH) if (flags[name] === 'true') makeArgs.push(`--${name}`);
process.exit(runNode('scripts/scene/make-scene.mjs', makeArgs));
