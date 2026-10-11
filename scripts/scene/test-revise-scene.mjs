#!/usr/bin/env node
// scene.json 一句话改稿：允许的字段、干跑、超长文案打回。不写示例文件。
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyOps} from '../revise.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const doc = {
  product: 'promo',
  style: 'fresh-light',
  screens: [{role: 'claim', layout: 'hero', text: '短句'}],
};
const deniedSrc = applyOps(doc, [{op: 'set', path: 'screens[0].src', value: 'x.png'}], 'scene');
assert.equal(deniedSrc.ok, false);
const deniedTop = applyOps(doc, [{op: 'set', path: 'src', value: 'x.png'}], 'scene');
assert.equal(deniedTop.ok, false);
const density = applyOps(doc, [{op: 'set', path: 'density', value: 'loose'}], 'scene');
assert.equal(density.ok, true);
assert.equal(density.doc.density, 'loose');
const layout = applyOps(doc, [{op: 'set', path: 'screens[0].layout', value: 'not-a-layout'}], 'scene');
assert.equal(layout.ok, true);
assert.equal(layout.doc.screens[0].layout, 'not-a-layout');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-revise-'));
const file = path.join(dir, 'scene.json');
const source = fs.readFileSync(path.join(ROOT, 'examples/scene/a-fresh.json'));
fs.writeFileSync(file, source);
const mockOk = path.join(dir, 'ok.json');
fs.writeFileSync(mockOk, JSON.stringify({
  asks: [{ask: '把疏密改松', ops: [0]}],
  ops: [{op: 'set', path: 'density', value: 'loose'}],
}));
const dry = spawnSync(process.execPath, [path.join(ROOT, 'scripts/revise.mjs'), file, '把疏密改松', '--dry-run', '--mock-llm', mockOk], {
  cwd: ROOT,
  encoding: 'utf8',
  windowsHide: true,
});
assert.equal(dry.status, 0, `${dry.stdout}\n${dry.stderr}`);
assert.equal(fs.readFileSync(file).equals(source), true);
assert.match(dry.stdout, /干跑/);

const mockBad = path.join(dir, 'bad.json');
fs.writeFileSync(mockBad, JSON.stringify({
  asks: [{ask: '把第一屏写长', ops: [0]}],
  ops: [{op: 'set', path: 'screens[0].text', value: '第一屏这一句主张故意写得很长超过十六'}],
}));
const bad = spawnSync(process.execPath, [path.join(ROOT, 'scripts/revise.mjs'), file, '把第一屏写长', '--mock-llm', mockBad], {
  cwd: ROOT,
  encoding: 'utf8',
  windowsHide: true,
});
assert.equal(bad.status, 1, `${bad.stdout}\n${bad.stderr}`);
assert.equal(fs.readFileSync(file).equals(source), true);
assert.match(`${bad.stdout}\n${bad.stderr}`, /最多 16|几何/);

console.log('revise-scene ok');
