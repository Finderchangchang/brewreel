#!/usr/bin/env node
// ============================================================
// 静态扫描：template/src 里写死在代码中的汉字字面量（英文视频 meta.lang="en" 时会原样上屏）。
//
// 规则：.ts/.tsx 里的字符串、模板字符串、JSX 文本只要含汉字（或中文全角标点），就必须写在
//   pick(lang, '中文', 'English') 的第 2 个参数（中文那一侧）里；
// 第 3 个参数（英文那一侧）不许出现汉字。注释、正则字面量不算（不上屏）。
// 确实不上屏的数据（例如按汉字判断宽度的字符表），在同一行，或紧挨着的上一行（整行注释）写 `i18n-ignore` 豁免。
//
// 用法：
//   node scripts/check-i18n.mjs              扫 template/src，列出所有命中，有命中退出码 1
//   node scripts/check-i18n.mjs --json       输出 JSON（[{file, line, col, text, why}]）
//   node scripts/check-i18n.mjs <文件或目录> 只扫指定路径（相对仓库根目录或绝对路径）
//
// 解析用 template/node_modules 里的 typescript（和 tsc -p template 同一份），不需要额外安装。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(ROOT, 'template');
const require = createRequire(path.join(TEMPLATE, 'package.json'));
let ts;
try {
  ts = require('typescript');
} catch {
  console.error('找不到 typescript：先在 template 目录执行 npm install');
  process.exit(2);
}

// 汉字：和 make.mjs 的 HAN_RE 同一个范围（CJK 扩展 A + 基本区），再加兼容区；
// 另外把中文全角标点（，。：「」（）等）也算上——英文视频里单独冒出一个全角冒号一样穿帮
const HAN_RE = /[㐀-鿿豈-﫿　-〿！-｠]/;
const IGNORE_MARK = 'i18n-ignore';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const targets = args.filter((a) => !a.startsWith('--'));
const roots = targets.length ? targets.map((a) => path.resolve(ROOT, a)) : [path.join(TEMPLATE, 'src')];

const walk = (p, out) => {
  let st;
  try {
    st = fs.statSync(p);
  } catch {
    console.error(`路径不存在：${p}`);
    process.exit(2);
  }
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(p)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(path.join(p, name), out);
    }
  } else if (/\.(tsx?|mts|cts)$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  return out;
};

const calleeName = (call) => {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return '';
};

// 节点落在哪个 pick() 调用的第几个参数里（最近的一层 pick）；不在任何 pick 里返回 -1
const pickArgIndex = (node) => {
  let child = node;
  let cur = node.parent;
  while (cur) {
    if (ts.isCallExpression(cur) && calleeName(cur) === 'pick') {
      const i = cur.arguments.findIndex((a) => a === child);
      if (i >= 0) return i;
    }
    child = cur;
    cur = cur.parent;
  }
  return -1;
};

const literalText = (node) => {
  if (ts.isJsxText(node)) return node.text;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) return node.text;
  return null;
};

const scanFile = (file) => {
  const src = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const lines = src.split(/\r?\n/);
  const hits = [];
  const visit = (node) => {
    // import/export 的模块路径不上屏
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) return;
    const text = literalText(node);
    if (text !== null && HAN_RE.test(text)) {
      const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const line = pos.line + 1;
      const here = lines[pos.line] ?? '';
      const prev = lines[pos.line - 1] ?? '';
      // 豁免：同一行带 i18n-ignore，或上一行是只有注释的一行且带 i18n-ignore
      const prevIsComment = /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(prev);
      if (!here.includes(IGNORE_MARK) && !(prevIsComment && prev.includes(IGNORE_MARK))) {
        const idx = pickArgIndex(node);
        let why = '';
        if (idx < 0) why = '不在 pick() 里';
        else if (idx === 0) why = 'pick() 第 1 个参数应该是 lang';
        else if (idx >= 2) why = 'pick() 的英文参数里有汉字';
        if (why) hits.push({file: path.relative(ROOT, file).split(path.sep).join('/'), line, col: pos.character + 1, text: text.trim().slice(0, 60), why});
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
};

const files = roots.flatMap((r) => walk(r, []));
const hits = files.flatMap(scanFile);

if (asJson) {
  process.stdout.write(JSON.stringify(hits, null, 2) + '\n');
} else if (!hits.length) {
  console.log(`✓ check-i18n：扫了 ${files.length} 个文件，没有写死的中文界面文字`);
} else {
  const byFile = new Map();
  for (const h of hits) byFile.set(h.file, [...(byFile.get(h.file) ?? []), h]);
  for (const [f, hs] of byFile) {
    console.log(`\n${f}（${hs.length}）`);
    for (const h of hs) console.log(`  ${h.line}:${h.col}  ${h.why}  「${h.text}」`);
  }
  console.log(`\n✗ check-i18n：${hits.length} 处写死的中文（${byFile.size} 个文件）。`);
  console.log('  → 界面文字改成 pick(meta.lang, \'中文\', \'English\')（template/src/core/kit.tsx）；');
  console.log('    确实不上屏的数据，在同一行（或上一行单独一行注释）写 i18n-ignore。');
}
process.exit(hits.length ? 1 : 0);
