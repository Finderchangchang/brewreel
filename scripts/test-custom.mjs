#!/usr/bin/env node
// 自由镜头：静态检查、注册表生成、报错回指文件和行号。不渲染，不改 template 里的注册表。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  REGISTRY_STUB,
  attributeRenderFailure,
  registrySource,
  rewriteTscOutput,
  scanShotDir,
  scanSource,
  stageCustom,
} from './lib/custom-shot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const check = (name, cond, detail = '') => {
  if (cond) {
    console.log(`  ✓ ${name}`);
    return;
  }
  fails.push(detail ? `${name}：${detail}` : name);
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
};

console.log('自由镜头单测');

const exampleHits = scanShotDir(path.join(ROOT, 'examples', 'custom', 'shots'));
check('样例组件没有写死的字', exampleHits.length === 0, JSON.stringify(exampleHits));

const cjk = scanSource('shots/hardcode.tsx', 'export default function X() {\n  return <div>你好</div>;\n}\n');
check(
  'JSX 里的中文报文件和行号，改法是挪进 slots',
  cjk.some((h) => h.file === 'shots/hardcode.tsx' && h.line === 2 && h.kind === 'text' && h.text.includes('你好') && h.fix === '挪进 slots'),
  JSON.stringify(cjk),
);

const num = scanSource('shots/num.tsx', 'export default function X() {\n  return <div>{12}</div>;\n}\n');
check('JSX 里直接写的数字要拦', num.some((h) => h.kind === 'number' && h.line === 2 && h.fix === '挪进 slots'), JSON.stringify(num));

const styled = scanSource(
  'shots/ok.tsx',
  'export default function X() {\n  return <div style={{left: 0, top: 800}} seed={1}>ok</div>;\n}\n',
);
check('style 里的坐标和 seed 不算写死', styled.length === 0, JSON.stringify(styled));

const sentence = scanSource('shots/en.tsx', 'export default function X() {\n  return <div>Hello there</div>;\n}\n');
check('英文句子要拦', sentence.some((h) => h.kind === 'sentence' && h.fix === '挪进 slots'), JSON.stringify(sentence));

const banned = scanSource('shots/bad-import.tsx', "import {FONT} from '../../../core/font';\nexport default function X() { return null; }\n");
check('不能绕过 custom-api', banned.some((h) => h.kind === 'import'), JSON.stringify(banned));

const door = scanSource('shots/door.tsx', "import {FONT} from '../../custom-api';\nexport default function X() { return null; }\n");
check('../../custom-api 允许', door.length === 0, JSON.stringify(door));

const stub = fs.readFileSync(path.join(ROOT, 'template', 'src', 'shots', '_custom', 'registry.ts'), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
check('空注册表和出片结束时写回的原文一致', stub === REGISTRY_STUB, JSON.stringify(stub));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brewreel-custom-'));
try {
  const src = path.join(tmp, 'shots');
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, 'b.tsx'), 'export default function B() { return null; }\n', 'utf8');
  fs.writeFileSync(path.join(src, 'a.tsx'), 'export default function A() { return null; }\n', 'utf8');
  const destRoot = path.join(tmp, 'out');
  fs.mkdirSync(destRoot);
  const registryFile = path.join(tmp, 'registry.ts');
  fs.writeFileSync(registryFile, REGISTRY_STUB, 'utf8');
  const hash = 'abcdef012345';
  const staged = stageCustom({srcDir: src, destRoot, hash, registryFile});
  const st = fs.lstatSync(staged.dir);
  check('注册表目录是真目录', st.isDirectory() && !st.isSymbolicLink());
  const gen = fs.readFileSync(path.join(staged.dir, 'registry.gen.ts'), 'utf8');
  const expected = registrySource(['b.tsx', 'a.tsx'], hash);
  check('注册表按文件名排序并带上 shots/ 键', gen === expected && gen.includes("'shots/a.tsx': Shot0") && gen.includes("'shots/b.tsx': Shot1"), gen);
  check('入口改指向这一支片子', fs.readFileSync(registryFile, 'utf8') === `export {CUSTOM_SHOTS, CUSTOM_FILM} from './${hash}/registry.gen';\n`);

  const tscText = `src/shots/_custom/${hash}/type-error.tsx(4,11): error TS2322: Type 'string' is not assignable to type 'number'.\n`;
  const rewritten = rewriteTscOutput(tscText, hash, {'type-error.tsx': [2]});
  check('类型错误指回第几镜和项目文件', rewritten.startsWith('第 2 镜（custom）shots/type-error.tsx(4,11)'), rewritten);

  const film = path.join(tmp, 'film');
  fs.mkdirSync(path.join(film, 'shots'), {recursive: true});
  fs.writeFileSync(path.join(film, 'shots', 'throw-shot.tsx'), 'export default function T() {\n  throw new Error("boom");\n}\n', 'utf8');
  const sb = {shots: [{type: 'custom', component: 'shots/throw-shot.tsx'}]};
  const attributed = attributeRenderFailure('第 1 镜（custom）shots/throw-shot.tsx：boom', sb, film);
  check('渲染抛错没有行号时补上 throw 那一行', attributed.startsWith('第 1 镜（custom）shots/throw-shot.tsx:2'), attributed);
  const rewrittenStack = attributeRenderFailure(`at T (src/shots/_custom/${hash}/throw-shot.tsx:2:3)`, sb, film);
  check('拷贝路径换回项目路径', rewrittenStack.includes('shots/throw-shot.tsx') && !rewrittenStack.includes('_custom/'), rewrittenStack);
} finally {
  const st = fs.lstatSync(tmp);
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error(`拒绝删除：${tmp}`);
  fs.rmSync(tmp, {recursive: true, force: true});
}

if (fails.length) {
  console.log(`\n失败 ${fails.length} 条`);
  for (const f of fails) console.log(`  ${f}`);
  process.exit(1);
}
console.log('自由镜头单测通过');
