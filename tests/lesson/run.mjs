#!/usr/bin/env node
// 讲课引擎测试。不进 tests/broll/run.mjs，避免和口播 B-roll 绑在一起。
//   node tests/lesson/run.mjs
//   node tests/lesson/run.mjs test-lesson.mjs test-review.mjs
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(ROOT, 'scripts', 'lesson');
const wanted = process.argv.slice(2).filter((arg) => arg.endsWith('.mjs'));
const files = fs.readdirSync(dir).filter((name) => name.startsWith('test-') && name.endsWith('.mjs')).sort()
  .filter((name) => wanted.length === 0 || wanted.includes(name));
if (!files.length) {
  console.error('没有匹配的讲课测试');
  process.exit(2);
}
let failed = 0;
for (const name of files) {
  const started = Date.now();
  const ran = spawnSync(process.execPath, [path.join(dir, name)], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 240000,
  });
  const sec = ((Date.now() - started) / 1000).toFixed(1);
  const ok = ran.status === 0 && !ran.error;
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (${sec}s)`);
  if (!ok) {
    const tail = `${ran.stdout || ''}\n${ran.stderr || ''}${ran.error ? `\n${ran.error.message}` : ''}`.trim().split(/\r?\n/).slice(-30).join('\n');
    console.log(tail);
  }
}
console.log(failed ? `lesson tests: ${failed} failed of ${files.length}` : `lesson tests: ${files.length} passed`);
process.exit(failed ? 1 : 0);
