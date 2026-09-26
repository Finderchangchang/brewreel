#!/usr/bin/env node
// ============================================================
// 风格注册表生成器（Remotion 要静态 import，所以注册表是生成出来的，不要手改）。
//   node scripts/gen-styles.mjs           扫描 template/src/styles/<id>/style.json，写
//                                         template/src/styles/registry.gen.ts 和每个风格的 shots/index.gen.ts
//   node scripts/gen-styles.mjs --check   只检查：注册表是否最新、清单/令牌/镜头是否对得上（PR 自查用，有问题退出码 1）
//   node scripts/gen-styles.mjs --new <id> [--name 中文名] [--name-en EnglishName]
//                                         从 styles/_template/ 生成一个新风格的两个文件夹（status: draft），再生成注册表
// 新增风格 = 建 template/src/styles/<id>/（style.json、tokens.json、index.ts、shots/）+ styles/<id>/，再跑一次本脚本。
// 以 _ 开头的文件夹（_shared、_template）不是风格，跳过。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'template', 'src');
const STYLES_SRC = path.join(SRC, 'styles');
const COMMON_SHOTS = path.join(SRC, 'shots');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const check = process.argv.includes('--check');
const argOf = (k) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

// ---------------- --new：从模板脚手架出一个新风格 ----------------
const newId = argOf('--new');
if (newId !== undefined) {
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(newId ?? '')) {
    console.log('风格 id 只能用小写字母、数字、连字符，2–24 位，如 --new poster');
    process.exit(2);
  }
  const TPL = path.join(ROOT, 'styles', '_template');
  const docDir = path.join(ROOT, 'styles', newId);
  const codeDir = path.join(STYLES_SRC, newId);
  if (fs.existsSync(docDir) || fs.existsSync(codeDir)) {
    console.log(`风格「${newId}」已经存在（styles/${newId}/ 或 template/src/styles/${newId}/），换个 id`);
    process.exit(2);
  }
  const vars = {__ID__: newId, __NAME__: argOf('--name') ?? newId, __NAME_EN__: argOf('--name-en') ?? newId, __FIRST__: 'opening'};
  const fill = (s) => Object.entries(vars).reduce((acc, [k, v]) => acc.split(k).join(v), s);
  const copyTree = (from, to, skip = []) => {
    fs.mkdirSync(to, {recursive: true});
    for (const e of fs.readdirSync(from, {withFileTypes: true})) {
      if (skip.includes(e.name)) continue;
      const src = path.join(from, e.name);
      const dst = path.join(to, fill(e.name));
      if (e.isDirectory()) copyTree(src, dst);
      else fs.writeFileSync(dst, fill(fs.readFileSync(src, 'utf8')), 'utf8');
    }
  };
  copyTree(TPL, docDir, ['code', 'README.md']);
  copyTree(path.join(TPL, 'code'), codeDir);
  console.log(`已建好：styles/${newId}/（文档、规则）和 template/src/styles/${newId}/（清单、令牌、index.ts、一个示例镜头 opening）`);
}

const problems = [];
const outputs = new Map(); // 文件 → 内容
const ASPECTS = Object.keys(readJson(path.join(SRC, 'core', 'aspects.json')));
const commonTypes = fs.readdirSync(COMMON_SHOTS).filter((f) => f.endsWith('.spec.json')).map((f) => readJson(path.join(COMMON_SHOTS, f)).type);
const CARDS_THEMES = Object.keys(readJson(path.join(SRC, 'core', 'themes.json')));

const ids = fs
  .readdirSync(STYLES_SRC, {withFileTypes: true})
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && fs.existsSync(path.join(STYLES_SRC, d.name, 'style.json')))
  .map((d) => d.name)
  .sort();

const HEADER = '// 自动生成，不要手改：node scripts/gen-styles.mjs\n';
const ownTypes = new Map();
for (const id of ids) {
  const dir = path.join(STYLES_SRC, id);
  const m = readJson(path.join(dir, 'style.json'));
  const P = (s) => problems.push(`template/src/styles/${id}/${s}`);
  if (m.id !== id) P(`style.json：id「${m.id}」和文件夹名「${id}」不一致`);
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(id)) P('风格 id 只能用小写字母、数字、连字符，2–24 位');
  for (const k of ['name', 'summary', 'status', 'defaultAspect', 'aspects', 'bpm', 'commonShots', 'captionLayer'])
    if (m[k] === undefined) P(`style.json：缺少 ${k}`);
  if (!['stable', 'draft', 'skeleton'].includes(m.status)) P('style.json：status 只能是 stable / draft / skeleton');
  for (const a of m.aspects ?? []) if (!ASPECTS.includes(a)) P(`style.json：画幅「${a}」不在 core/aspects.json 里（可用：${ASPECTS.join(' / ')}）`);
  if (!(m.aspects ?? []).includes(m.defaultAspect)) P('style.json：defaultAspect 必须在 aspects 里');
  if (m.commonShots !== '*' && !Array.isArray(m.commonShots)) P('style.json：commonShots 写 "*" 或公共镜头名数组');
  for (const t of Array.isArray(m.commonShots) ? m.commonShots : []) if (!commonTypes.includes(t)) P(`style.json：commonShots 里的「${t}」不是公共镜头`);
  if (Array.isArray(m.commonShots) && m.commonShots.length && !(m.aspects ?? []).includes('9:16')) P('style.json：公共镜头只按 9:16 设计，复用它们的风格 aspects 里必须有 9:16');
  if (!['cards', 'none'].includes(m.captionLayer)) P('style.json：captionLayer 只能是 cards / none');
  // 令牌
  const tokPath = path.join(dir, 'tokens.json');
  if (id !== 'cards') {
    if (!fs.existsSync(tokPath)) P('缺少 tokens.json');
    else {
      const tk = readJson(tokPath);
      const names = Object.keys(tk.themes ?? {});
      for (const n of m.themes ?? []) if (!names.includes(n)) P(`style.json：themes 里的「${n}」在 tokens.json 的 themes 里没有定义`);
      if (m.defaultTheme && !names.includes(m.defaultTheme)) P(`style.json：defaultTheme「${m.defaultTheme}」在 tokens.json 里没有`);
    }
  } else if (m.themes) P('cards 的主题在 core/themes.json，style.json 不要写 themes');
  if (!fs.existsSync(path.join(dir, 'index.ts')) && !fs.existsSync(path.join(dir, 'index.tsx'))) P('缺少 index.ts（export default defineStyle({...})）');
  // 专属镜头
  const shotsDir = path.join(dir, 'shots');
  const types = [];
  if (fs.existsSync(shotsDir)) {
    for (const f of fs.readdirSync(shotsDir).filter((f) => f.endsWith('.spec.json')).sort()) {
      const spec = readJson(path.join(shotsDir, f));
      const base = f.slice(0, -'.spec.json'.length);
      if (spec.type !== base) P(`shots/${f}：type「${spec.type}」和文件名不一致`);
      if (!fs.existsSync(path.join(shotsDir, `${base}.tsx`))) P(`shots/${f}：缺少同名组件 ${base}.tsx`);
      if (commonTypes.includes(base)) P(`shots/${base}：和公共镜头重名，换个名字`);
      if (!/^[a-z][A-Za-z0-9]{1,31}$/.test(base)) P(`shots/${base}：镜头名用小驼峰英文`);
      types.push(base);
    }
    const lines = [HEADER, "import type {ShotModule, ShotSpec} from '../../../core/types';", "import type {ShotEntry} from '../../types';", ''];
    for (const t of types) lines.push(`import * as ${t} from './${t}';`, `import ${t}Spec from './${t}.spec.json';`);
    lines.push('', 'export const SHOTS: Record<string, ShotEntry> = {');
    for (const t of types) lines.push(`  ${t}: {mod: ${t} as ShotModule, spec: ${t}Spec as unknown as ShotSpec},`);
    lines.push('};', '');
    outputs.set(path.join(shotsDir, 'index.gen.ts'), lines.join('\n'));
  }
  for (const t of [m.firstShot, m.lastShot, ...(m.demoShots ?? [])].filter(Boolean))
    if (!types.includes(t) && !(m.commonShots === '*' ? commonTypes : m.commonShots ?? []).includes(t)) P(`style.json：用到的镜头「${t}」既不是专属镜头也不在 commonShots 里`);
  ownTypes.set(id, types);
  // 给人和模型看的那一半
  const docDir = path.join(ROOT, 'styles', id);
  for (const f of ['STYLE.md', 'STYLE.en.md', 'recipes.md', 'rules.json'])
    if (!fs.existsSync(path.join(docDir, f))) problems.push(`styles/${id}/${f}：缺少（每个风格都要有这份）`);
}
if (!ids.includes('cards')) problems.push('template/src/styles/cards/：默认风格 cards 不见了');

const reg = [HEADER, "import type {StyleDef} from './types';", ...ids.map((id) => `import ${id.replace(/-(\w)/g, (_, c) => c.toUpperCase())} from './${id}';`), '', 'export const STYLES: Record<string, StyleDef> = {', ...ids.map((id) => `  '${id}': ${id.replace(/-(\w)/g, (_, c) => c.toUpperCase())},`), '};', ''];
outputs.set(path.join(STYLES_SRC, 'registry.gen.ts'), reg.join('\n'));

let stale = 0;
for (const [file, content] of outputs) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (cur === content) continue;
  if (check) {
    stale++;
    problems.push(`${path.relative(ROOT, file).replace(/\\/g, '/')}：不是最新，跑一次 node scripts/gen-styles.mjs`);
  } else fs.writeFileSync(file, content, 'utf8');
}
const summary = ids.map((id) => `${id}（专属镜头 ${ownTypes.get(id).length}）`).join('、');
if (problems.length) {
  console.log(`风格注册检查发现 ${problems.length} 个问题：\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(check ? `风格注册表是最新的：${summary}` : `已生成风格注册表：${summary}${stale ? '' : ''}`);
