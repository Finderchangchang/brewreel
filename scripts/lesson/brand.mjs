#!/usr/bin/env node
// 建品牌档案、改档案升版本、查看某一版。档案在仓库外。
import fs from 'node:fs';
import path from 'node:path';
import {ID_RE} from './brand-ref.mjs';
import {
  BrandError,
  brandFile,
  createBrandFile,
  locateBrand,
  readBrand,
  resolveBrandVersion,
  resolveDataDir,
  updateBrandFile,
} from './brand-store.mjs';

const FLAGS = new Set(['--client', '--firm', '--english', '--column', '--logo', '--primary', '--secondary', '--qr', '--tip', '--lawyer', '--title', '--department', '--lawyers', '--data-dir']);
const USAGE = `用法：
  node scripts/lesson/brand.mjs create --client <客户id> --firm <律所全称> --column <栏目名> --logo <svg或png> --primary <#RRGGBB> [--english <英文名>] [--secondary <#RRGGBB>] [--lawyer <姓名> --title <职称> --department <部门>] [--lawyers <lawyers.json>] [--qr <svg或png>] [--tip <提示语>] [--data-dir <目录>]
  node scripts/lesson/brand.mjs update <客户id> [--firm <律所全称>] [--english <英文名>] [--column <栏目名>] [--logo <svg或png>] [--primary <#RRGGBB>] [--secondary <#RRGGBB>] [--qr <svg或png>] [--tip <提示语>] [--lawyer <姓名> --title <职称> --department <部门>] [--lawyers <lawyers.json>] [--no-english] [--no-secondary] [--no-qr] [--data-dir <目录>]
  node scripts/lesson/brand.mjs show <客户id 或 客户id@版本> [--data-dir <目录>]
改任何一项，版本号加 1，旧版本和当时的 logo 留在档案目录。数据目录默认是仓库外的 brewreel-studio-data，也可用环境变量 LESSON_DATA_DIR。`;

function parseArgs(argv) {
  const opts = {lawyer: [], title: [], department: []};
  const switches = new Set();
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-english' || arg === '--no-secondary' || arg === '--no-qr') {
      switches.add(arg);
      continue;
    }
    if (FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value == null || value.startsWith('--')) throw new BrandError(`${arg} 后面要跟值`);
      const key = arg.slice(2);
      if (key === 'lawyer' || key === 'title' || key === 'department') opts[key].push(value);
      else opts[key] = value;
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new BrandError(`不认识的参数 ${arg}`);
    } else positionals.push(arg);
  }
  return {opts, switches, positionals};
}

function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(error instanceof BrandError && /用法|不认识的参数|后面要跟值/.test(message) ? 2 : 1);
}

function idOf(value) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw new BrandError('客户 id 只能用小写字母、数字和短横线，并以字母或数字开头');
  }
  return value;
}

function lawyersFrom(opts) {
  if (opts.lawyers) {
    if (opts.lawyer.length || opts.title.length || opts.department.length) throw new BrandError('--lawyers 和 --lawyer 只能选一种');
    let data;
    try { data = JSON.parse(fs.readFileSync(path.resolve(opts.lawyers), 'utf8').replace(/^\uFEFF/u, '')); }
    catch { throw new BrandError(`看不懂律师名单 ${path.basename(opts.lawyers)}`); }
    const list = Array.isArray(data) ? data : data?.lawyers;
    if (!Array.isArray(list)) throw new BrandError('律师名单必须是数组，或是带 lawyers 数组的对象');
    return list;
  }
  const n = opts.lawyer.length;
  if (!n && !opts.title.length && !opts.department.length) return null;
  if (opts.title.length !== n || opts.department.length !== n) {
    throw new BrandError('每位律师都要成组写 --lawyer、--title、--department');
  }
  return opts.lawyer.map((name, index) => ({name, title: opts.title[index], department: opts.department[index]}));
}

function showRecord(record, view) {
  const payload = {
    client: record.client,
    version: view.version,
    latest: record.version,
    pinned: view.pinned,
    firm: view.firm,
    english: view.english,
    column: view.column,
    logo: view.logo,
    primary: view.primary,
    secondary: view.secondary,
    lawyers: view.lawyers,
    qr: view.qr,
    tip: view.tip,
    updatedAt: view.updatedAt,
  };
  console.log(JSON.stringify(payload, null, 2));
}

function run() {
  const {opts, switches, positionals} = parseArgs(process.argv.slice(2));
  const command = positionals[0];
  if (!command || !['create', 'update', 'show'].includes(command)) {
    console.error(USAGE);
    process.exit(2);
  }
  const dataDir = resolveDataDir(opts['data-dir']);
  const now = new Date().toISOString();

  if (command === 'create') {
    if (!opts.client || !opts.firm || !opts.column || !opts.logo || !opts.primary) {
      throw new BrandError('create 需要 --client、--firm、--column、--logo、--primary');
    }
    const client = idOf(opts.client);
    const record = createBrandFile(brandFile(dataDir, client), {
      client,
      firm: opts.firm,
      english: opts.english,
      column: opts.column,
      logoPath: opts.logo,
      primary: opts.primary,
      secondary: opts.secondary,
      qrPath: opts.qr,
      tip: opts.tip,
      lawyers: lawyersFrom(opts) ?? [],
      now,
    });
    console.log(`已建立 ${record.client} 版本 ${record.version}`);
    console.log(`logo ${record.logo.file} ${record.logo.sha256}`);
    return;
  }

  const target = positionals[1];
  if (!target) throw new BrandError(`${command} 需要客户 id，例如 hengchuan 或 hengchuan@1`);
  const located = locateBrand(target, dataDir);
  const record = readBrand(located.file);

  if (command === 'show') {
    showRecord(record, resolveBrandVersion(record, located.version));
    return;
  }

  if (located.version != null) throw new BrandError('update 不要写版本号。改的是最新版，旧版本会留在档案里');
  const lawyers = lawyersFrom(opts);
  const patch = {};
  if (opts.firm !== undefined) patch.firm = opts.firm;
  if (opts.english !== undefined) patch.english = opts.english;
  if (switches.has('--no-english')) patch.clearEnglish = true;
  if (opts.column !== undefined) patch.column = opts.column;
  if (opts.logo !== undefined) patch.logoPath = opts.logo;
  if (opts.primary !== undefined) patch.primary = opts.primary;
  if (opts.secondary !== undefined) patch.secondary = opts.secondary;
  if (switches.has('--no-secondary')) patch.clearSecondary = true;
  if (opts.qr !== undefined) patch.qrPath = opts.qr;
  if (switches.has('--no-qr')) patch.clearQr = true;
  if (opts.tip !== undefined) patch.tip = opts.tip;
  if (lawyers) patch.lawyers = lawyers;
  const next = updateBrandFile(located.file, patch, now);
  console.log(`已更新到版本 ${next.version}。旧版本 ${record.version} 留在档案里。已经交出去的片子仍用当时的版本。`);
  console.log(`logo ${next.logo.file} ${next.logo.sha256}`);
}

try { run(); }
catch (error) { fail(error); }
