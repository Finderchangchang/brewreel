#!/usr/bin/env node
// 发布前隐私自查：扫全仓（或 --stdin 传入的文本，如 git log -p 的输出），命中就退出码 1。
//   node scripts/privacy-scan.mjs            扫工作区（排除 .gitignore 里的目录）
//   node scripts/privacy-scan.mjs --stdin     扫标准输入（配合 git log -p | node scripts/privacy-scan.mjs --stdin）
//   .privacy-denylist.local（不提交，见 .gitignore）：每行一个额外要拦截的词/正则，# 开头是注释
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 内置规则：[名字, 正则, 说明]
const RULES = [
  ['本机路径-Windows', /[A-Za-z]:\\(?=\w{2,})[^\s"'`]*/g, 'Windows 盘符路径'],
  ['本机路径-Unix', /\/(Users|home)\/[^\s"'`]+/g, 'Unix 用户目录路径'],
  ['本机账号', /\bAdministrator\b/g, '本机账号名'],
  ['本机路径关键词-AppData', /\bAppData\b/g, ''],
  ['本机路径关键词-Desktop', /\bDesktop\b/g, ''],
  ['手机号', /(?<!\d)1[3-9]\d{9}(?!\d)/g, '大陆手机号（脱敏写法如 138****0000 / 138xxxx0000 不会命中）'],
  ['邮箱', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, ''],
  ['OpenAI 风格 key', /\bsk-[A-Za-z0-9]{20,}\b/g, ''],
  ['GitHub token', /\bghp_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, ''],
  ['AWS key', /\bAKIA[0-9A-Z]{16}\b/g, ''],
  ['私钥块', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, ''],
  ['Anthropic env key/token', /\bANTHROPIC_(API_KEY|AUTH_TOKEN)=\S{8,}/g, ''],
  // 人名、内部项目名、客户名不要写在这里（本文件会公开），写进 .privacy-denylist.local
];

// 允许命中的例外（测试夹具里故意写的、文档里解释规则用的脱敏号码等），按“文件路径子串 + 命中文本子串”白名单
const ALLOW = [
  // 教培/餐饮行业文档举例说明手机号正则怎么命中/不命中，属于文档解释，不是真实号码
  {fileIncludes: path.join('industries', 'education', 'expected.md'), textIncludes: '13800000000'},
  {fileIncludes: path.join('industries', 'food', 'expected.md'), textIncludes: '13800005678'},
  {fileIncludes: path.join('tests', 'rules', 'food', '02-refprice-induce-alcohol-rival-contact.json'), textIncludes: '13800005678'},
];

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'out', '.render.lock']);
// 本工具自身的规则源码天然会包含这些关键词/示例文本，不算真实泄露
const SELF_EXCLUDE = new Set([path.join('scripts', 'privacy-scan.mjs'), '.privacy-denylist.local']);
const EXCLUDE_PATH_PARTS = ['public/_run', 'public\\_run', 'public/_dev', 'public\\_dev'];
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.mov', '.wav', '.mp3', '.ttf', '.otf', '.woff', '.woff2',
  '.ico', '.zip', '.lock',
]);

function loadDenylist() {
  const p = path.join(ROOT, '.privacy-denylist.local');
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => ({name: `denylist: ${l}`, re: new RegExp(l, 'g')}));
}

function isAllowed(relFile, text) {
  return ALLOW.some((a) => relFile.split(path.sep).join('/').includes(a.fileIncludes.split(path.sep).join('/')) && text.includes(a.textIncludes));
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full);
    if (EXCLUDE_PATH_PARTS.some((p) => rel.split(path.sep).join('/').includes(p.split('\\').join('/')))) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else {
      if (BINARY_EXT.has(path.extname(name).toLowerCase())) continue;
      out.push(full);
    }
  }
  return out;
}

function scanText(label, text, denylistRules) {
  const hits = [];
  for (const [name, re, note] of RULES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const snippet = m[0];
      if (label !== '<stdin>' && isAllowed(label, text.slice(Math.max(0, m.index - 40), m.index + snippet.length + 40))) continue;
      hits.push({file: label, rule: name, match: snippet, note});
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }
  for (const {name, re} of denylistRules) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      hits.push({file: label, rule: name, match: m[0], note: ''});
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }
  return hits;
}

async function main() {
  const denylistRules = loadDenylist();
  let allHits = [];
  if (process.argv.includes('--stdin')) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const text = Buffer.concat(chunks).toString('utf8');
    allHits = scanText('<stdin>', text, denylistRules);
  } else {
    const files = walk(ROOT, []);
    for (const f of files) {
      let text;
      try {
        text = fs.readFileSync(f, 'utf8');
      } catch {
        continue;
      }
      const rel = path.relative(ROOT, f);
      if (SELF_EXCLUDE.has(rel)) continue;
      const hits = scanText(rel, text, denylistRules);
      allHits.push(...hits);
    }
  }
  if (allHits.length === 0) {
    console.log('隐私扫描：0 命中。');
    process.exit(0);
  }
  console.log(`隐私扫描：${allHits.length} 处命中\n`);
  for (const h of allHits) {
    console.log(`  [${h.rule}] ${h.file} :: ${h.match}${h.note ? '  (' + h.note + ')' : ''}`);
  }
  process.exit(1);
}

main();
