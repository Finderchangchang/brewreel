#!/usr/bin/env node
// 一键自检。逐项打勾或打叉，并给中文修法。密钥只报告有没有，不打印值。
//   node scripts/lesson/doctor.mjs [--data-dir <目录>] [--out-dir <目录>]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {probePythonBgm} from '../lib/bgm.mjs';
import {findRemotionFfmpeg} from './aigc-label.mjs';
import {
  REQUIRED_FONTS,
  exitCode,
  formatReport,
  judgeApiKey,
  judgeBrowser,
  judgeDeps,
  judgeDir,
  judgeDisk,
  judgeFfmpeg,
  judgeFonts,
  judgeNode,
  judgePython,
} from './doctor-checks.mjs';
import {isInsideRepo, resolveDataDir, resolveOutDir, showPath} from './paths.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE = path.join(ROOT, 'template');
const args = process.argv.slice(2);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const known = new Set(['--data-dir', '--out-dir']);
const unknown = args.find((arg) => arg.startsWith('--') && !known.has(arg));
const dataArg = valueOf('--data-dir');
const outArg = valueOf('--out-dir');
if (unknown || args.includes('--data-dir') && (!dataArg || dataArg.startsWith('--')) || args.includes('--out-dir') && (!outArg || outArg.startsWith('--'))) {
  console.error('用法：node scripts/lesson/doctor.mjs [--data-dir <目录>] [--out-dir <目录>]');
  process.exit(2);
}

function exists(file) {
  try { return fs.existsSync(file); }
  catch { return false; }
}

function isLink(file) {
  try { return fs.lstatSync(file).isSymbolicLink(); }
  catch { return false; }
}

function probeWritable(dir) {
  const probe = path.join(dir, '.doctor-write-ok');
  try {
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.rmSync(probe, {force: true});
    return true;
  } catch {
    return false;
  }
}

function freeBytes(dir) {
  try {
    const stat = fs.statfsSync(dir);
    return Number(stat.bavail) * Number(stat.bsize);
  } catch {
    return Number.NaN;
  }
}

const nodeModules = path.join(TEMPLATE, 'node_modules');
const cli = path.join(nodeModules, '@remotion', 'cli', 'remotion-cli.js');
const depsReady = exists(cli);
const items = [
  judgeNode(process.versions.node),
  judgeDeps({
    cli: depsReady,
    remotion: exists(path.join(nodeModules, 'remotion', 'package.json')),
    react: exists(path.join(nodeModules, 'react', 'package.json')),
    typescript: exists(path.join(nodeModules, 'typescript', 'package.json')),
    lock: exists(path.join(TEMPLATE, 'package-lock.json')),
    linked: isLink(nodeModules),
  }),
  judgeFonts(REQUIRED_FONTS.filter((name) => exists(path.join(TEMPLATE, 'public', name)))),
];

let browser = {skipped: !depsReady, code: 1, timedOut: false};
if (depsReady) {
  const ran = spawnSync(process.execPath, [cli, 'browser', 'ensure'], {
    cwd: TEMPLATE,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
  });
  browser = {skipped: false, code: ran.error?.code === 'ETIMEDOUT' ? 1 : (ran.status ?? 1), timedOut: ran.error?.code === 'ETIMEDOUT'};
}
items.push(judgeBrowser(browser));

let ffmpeg = {skipped: !depsReady, code: 1, output: ''};
if (depsReady) {
  const bin = findRemotionFfmpeg(TEMPLATE);
  if (!bin) ffmpeg = {skipped: false, code: 1, output: ''};
  else {
    const ran = spawnSync(bin, ['-version'], {encoding: 'utf8', windowsHide: true, timeout: 20000});
    ffmpeg = {skipped: false, code: ran.status ?? 1, output: `${ran.stdout || ''}\n${ran.stderr || ''}`};
  }
}
items.push(judgeFfmpeg(ffmpeg));
items.push(judgePython(probePythonBgm()));
items.push(judgeApiKey('DEEPSEEK_API_KEY', Boolean(String(process.env.DEEPSEEK_API_KEY || '').trim())));
items.push(judgeApiKey('MINIMAX_API_KEY', Boolean(String(process.env.MINIMAX_API_KEY || '').trim())));

const dataDir = resolveDataDir(dataArg);
const outDir = resolveOutDir(outArg);
const dataWritable = probeWritable(dataDir);
const outWritable = probeWritable(outDir);
items.push(judgeDir({id: 'data-dir', title: '数据目录', shown: showPath(dataDir), writable: dataWritable, inside: isInsideRepo(dataDir, ROOT)}));
items.push(judgeDir({id: 'out-dir', title: '出片目录', shown: showPath(outDir), writable: outWritable, inside: isInsideRepo(outDir, ROOT)}));
items.push(judgeDisk([
  {label: '数据目录', bytes: dataWritable ? freeBytes(dataDir) : Number.NaN},
  {label: '出片目录', bytes: outWritable ? freeBytes(outDir) : Number.NaN},
]));

console.log(formatReport(items));
process.exit(exitCode(items));
