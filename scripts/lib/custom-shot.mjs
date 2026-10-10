// 自由镜头（type=custom）：静态检查、注册表、出片时拷进 template 再清掉。
// 画面上的字只能来自分镜 slots。这里只扫项目 shots/*.tsx，不改 template 里的正式镜头。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE = path.join(ROOT, 'template');
const require = createRequire(path.join(TEMPLATE, 'package.json'));
const ts = require('typescript');

export const COMPONENT_RE = /^shots\/[A-Za-z0-9_-]+\.tsx$/;

/** 空注册表。make.mjs 出片时改写成指向 _custom/<哈希>/registry.gen，结束时写回这几行。 */
export const REGISTRY_STUB = `import type {FC} from 'react';
import type {CustomShotProps} from '../custom-api';

export const CUSTOM_FILM = '';
export const CUSTOM_SHOTS: Record<string, FC<CustomShotProps>> = {};
`;

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
const EN_SENTENCE = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/;
const ALLOW_ATTR = new Set([
  'style', 'seed', 'opacity', 'w', 'h', 'width', 'height', 'tilt', 'shortSide', 'strokeWidth', 'shadowK',
  'count', 'sigma', 'scale', 'x', 'y', 'dx', 'dy', 'fontSize', 'fontWeight', 'left', 'top', 'right', 'bottom',
  'rotate', 'dur', 't', 'ampScale', 'travel', 'up', 'down', 'fill', 'stroke', 'shadow', 'd', 'viewBox',
  'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'offset', 'stopOpacity', 'points', 'strokeLinecap',
  'strokeLinejoin', 'preserveAspectRatio', 'xmlns', 'transform',
]);

const FIX_SLOTS = '挪进 slots';

export const filmHashOf = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

const posOf = (sf, node) => {
  const p = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return {line: p.line + 1, col: p.character + 1};
};

const isModuleSpecifier = (node) =>
  ts.isStringLiteral(node) && !!node.parent && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent));

const inStyleAttr = (node) => {
  let p = node.parent;
  while (p) {
    if (ts.isJsxAttribute(p) && p.name && ts.isIdentifier(p.name) && p.name.text === 'style') return true;
    p = p.parent;
  }
  return false;
};

const attrNameOf = (node) => {
  let p = node.parent;
  if (p && ts.isJsxExpression(p)) p = p.parent;
  if (p && ts.isJsxAttribute(p) && p.name && ts.isIdentifier(p.name)) return p.name.text;
  return '';
};

const importAllowed = (spec) =>
  spec === 'react' ||
  spec === 'remotion' ||
  spec === '../../custom-api' ||
  spec === '../../custom-api.ts' ||
  (spec.startsWith('./') && !spec.includes('..'));

const push = (hits, sf, node, rel, kind, text, fix) => {
  const p = posOf(sf, node);
  hits.push({file: rel, line: p.line, col: p.col, kind, text: String(text).slice(0, 80), fix});
};

const checkChunk = (hits, sf, node, rel, text) => {
  if (!text || !String(text).trim()) return;
  if (isModuleSpecifier(node)) return;
  if (CJK.test(text)) push(hits, sf, node, rel, 'text', text.trim(), FIX_SLOTS);
  else if (!inStyleAttr(node) && EN_SENTENCE.test(text)) push(hits, sf, node, rel, 'sentence', text.trim(), FIX_SLOTS);
};

/**
 * 扫一个组件源码。命中：JSX / 字符串里的中文、英文句子、直接渲染的数字。
 * 坐标和 style 里的数字、函数体里的数字、import 路径不算。
 * @returns {{file:string,line:number,col:number,kind:string,text:string,fix:string}[]}
 */
export function scanSource(rel, text) {
  const sf = ts.createSourceFile(rel, String(text), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (!importAllowed(spec)) push(hits, sf, node.moduleSpecifier, rel, 'import', spec, '只能 import react、remotion、../../custom-api，或同目录的 ./ 辅助文件');
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (!importAllowed(spec)) push(hits, sf, node.moduleSpecifier, rel, 'import', spec, '只能从 react、remotion、../../custom-api 或同目录 ./ 再导出');
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      const spec = arg && ts.isStringLiteral(arg) ? arg.text : '(dynamic)';
      push(hits, sf, arg ?? node, rel, 'import', spec, '不要动态 import；用 ../../custom-api');
    } else if (ts.isJsxText(node)) {
      const raw = node.getText(sf);
      if (CJK.test(raw) || EN_SENTENCE.test(raw) || /[0-9\uFF10-\uFF19]/.test(raw)) {
        const kind = CJK.test(raw) ? 'text' : EN_SENTENCE.test(raw) ? 'sentence' : 'number';
        push(hits, sf, node, rel, kind, raw.trim(), FIX_SLOTS);
      }
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      checkChunk(hits, sf, node, rel, node.text);
    } else if (ts.isTemplateExpression(node)) {
      checkChunk(hits, sf, node.templateSpans[0] ? node.head : node.head, rel, node.head.text);
      for (const sp of node.templateSpans) checkChunk(hits, sf, sp, rel, sp.literal.text);
    } else if (ts.isNumericLiteral(node)) {
      const parent = node.parent;
      const asChild = parent && ts.isJsxExpression(parent) && (ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent));
      const name = attrNameOf(node);
      const asAttr = parent && ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) && name !== 'style' && !ALLOW_ATTR.has(name);
      if (asChild || asAttr) push(hits, sf, node, rel, 'number', node.text, FIX_SLOTS);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

/** 扫项目 shots/*.tsx（只一层）。文件不存在就空数组。 */
export function scanShotDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const hits = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.tsx')) continue;
    const abs = path.join(dir, name);
    let st;
    try {
      st = fs.lstatSync(abs);
    } catch {
      continue;
    }
    if (st.isSymbolicLink() || !st.isFile()) continue;
    hits.push(...scanSource(`shots/${name}`, fs.readFileSync(abs, 'utf8')));
  }
  return hits;
}

export function registrySource(names, hash) {
  const files = [...names].sort();
  const imports = files.map((n, i) => `import Shot${i} from './${n.replace(/\.tsx$/, '')}';`);
  const rows = files.map((n, i) => `  'shots/${n}': Shot${i},`);
  return `import type {FC} from 'react';
import type {CustomShotProps} from '../../custom-api';
${imports.join('\n')}
export const CUSTOM_FILM = '${hash}';
export const CUSTOM_SHOTS: Record<string, FC<CustomShotProps>> = {
${rows.join('\n')}
};
`;
}

export function registryRedirect(hash) {
  if (!/^[0-9a-f]{12}$/.test(hash)) throw new Error(`非法片子哈希：${hash}`);
  return `export {CUSTOM_SHOTS, CUSTOM_FILM} from './${hash}/registry.gen';\n`;
}

const safeRm = (dir) => {
  if (!dir || !fs.existsSync(dir)) return;
  const st = fs.lstatSync(dir);
  if (st.isSymbolicLink()) throw new Error(`拒绝删除链接或 junction：${dir}`);
  if (!st.isDirectory()) throw new Error(`不是目录：${dir}`);
  fs.rmSync(dir, {recursive: true, force: true});
};

/**
 * 把项目 shots/*.tsx 拷到 destRoot/<hash>/，并改写注册表。
 * destRoot 由调用方指定（测试用临时目录，出片用 template/src/shots/_custom）。
 */
export function stageCustom({srcDir, destRoot, hash, registryFile}) {
  if (!/^[0-9a-f]{12}$/.test(hash)) throw new Error(`非法片子哈希：${hash}`);
  const names = fs.readdirSync(srcDir).filter((n) => n.endsWith('.tsx')).sort();
  if (!names.length) throw new Error(`shots 目录里没有 tsx：${srcDir}`);
  const dest = path.join(destRoot, hash);
  safeRm(dest);
  fs.mkdirSync(dest, {recursive: true});
  for (const n of names) {
    const from = path.join(srcDir, n);
    const st = fs.lstatSync(from);
    if (st.isSymbolicLink() || !st.isFile()) continue;
    fs.copyFileSync(from, path.join(dest, n));
  }
  fs.writeFileSync(path.join(dest, 'registry.gen.ts'), registrySource(names, hash), 'utf8');
  fs.writeFileSync(registryFile, registryRedirect(hash), 'utf8');
  return {dir: dest, names};
}

/** tsc 报错里的 _custom/<hash>/file.tsx 换回项目里的 shots/file.tsx，并标上第几镜。 */
export function rewriteTscOutput(text, hash, fileToShots = {}) {
  const norm = String(text).replace(/\\/g, '/');
  const re = new RegExp(`(?:\\S*/)?_custom/${hash}/([A-Za-z0-9_-]+\\.tsx)(?:\\((\\d+),(\\d+)\\)|:(\\d+):(\\d+))([^\\n]*)`, 'g');
  const hits = [];
  for (const m of norm.matchAll(re)) {
    const base = m[1];
    const line = m[2] || m[4];
    const col = m[3] || m[5];
    const rest = m[6] || '';
    const shots = fileToShots[base] || [];
    const who = shots.length ? shots.map((n) => `第 ${n} 镜（custom）`).join('、') : '自由镜头';
    hits.push(`${who}shots/${base}(${line},${col})${rest}`);
  }
  if (!hits.length) return norm.trim();
  return `${hits.join('\n')}\n${norm.trim()}`;
}

/** 渲染失败日志：把拷贝路径换回项目路径；堆栈没有行号时，用组件里的 throw 那一行。 */
export function attributeRenderFailure(detail, sb, baseDir) {
  let text = String(detail || '').replace(/\\/g, '/');
  text = text.replace(/(?:src\/)?shots\/_custom\/[0-9a-f]{12}\/([A-Za-z0-9_-]+\.tsx)/g, 'shots/$1');
  const notes = [];
  for (const [i, shot] of (sb?.shots ?? []).entries()) {
    if (shot?.type !== 'custom' || typeof shot.component !== 'string') continue;
    const base = path.basename(shot.component);
    if (!text.includes(base) && !text.includes(`第 ${i + 1} 镜`)) continue;
    const hasLine = new RegExp(`${base.replace(/\./g, '\\.')}(?:\\((\\d+)|:(\\d+))`).test(text);
    if (hasLine) continue;
    let line = '';
    try {
      const src = fs.readFileSync(path.join(baseDir, shot.component), 'utf8');
      const idx = src.split(/\n/).findIndex((l) => /\bthrow\b/.test(l));
      if (idx >= 0) line = String(idx + 1);
    } catch {}
    notes.push(`第 ${i + 1} 镜（custom）${shot.component}${line ? ':' + line : ''}`);
  }
  if (!notes.length) return text.trim();
  return `${notes.join('\n')}\n${text.trim()}`;
}

/** 版式 ✗ 落在自由镜头上时，补上组件文件；出界的 bad case 用 left: 0 那一行。 */
export function attributeLayoutIssues(issues, sb, baseDir) {
  return (issues ?? []).map((issue) => {
    const m = /第\s*(\d+)\s*镜（custom）/.exec(issue);
    if (!m) return issue;
    const shot = sb?.shots?.[Number(m[1]) - 1];
    const file = shot?.component;
    if (typeof file !== 'string') return issue;
    if (issue.includes(file)) return issue;
    let line = 0;
    try {
      const lines = fs.readFileSync(path.join(baseDir, file), 'utf8').split(/\n/);
      const at = lines.findIndex((l) => /left:\s*0\b/.test(l));
      const alt = lines.findIndex((l) => /<[A-Za-z]/.test(l));
      line = (at >= 0 ? at : alt) + 1;
    } catch {}
    return line ? `${issue}（组件 ${file}:${line}）` : `${issue}（组件 ${file}）`;
  });
}

/** 动效停死只看主体区（字幕带和底部平台区不算）。mask 为 0 的像素不参与。 */
export function mainMotionMask(w, h, videoW, videoH, rect) {
  const mask = new Uint8Array(w * h);
  const sx = w / videoW;
  const sy = h / videoH;
  const x0 = Math.max(0, Math.floor(rect.x0 * sx));
  const y0 = Math.max(0, Math.floor(rect.y0 * sy));
  const x1 = Math.min(w, Math.ceil(rect.x1 * sx));
  const y1 = Math.min(h, Math.ceil(rect.y1 * sy));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * w + x] = 1;
  return mask;
}
