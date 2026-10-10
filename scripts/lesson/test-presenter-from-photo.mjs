#!/usr/bin/env node
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {presenterLookErrors} from './validate-lesson.mjs';
import {previewHtml} from './presenter-preview-render.mjs';
import {
  ACCESSORY_NAMES,
  FACIAL_HAIR_NAMES,
  HAIR_NAMES,
  LIKENESS_LIMIT,
  MINIMAX_VISION_BASE,
  MINIMAX_VISION_MODEL,
  VISION_TIMEOUT_MS,
  buildPrompt,
  callVision,
  coerceLook,
  resolveVisionEndpoint,
} from './presenter-vision.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'presenter-photo-'));
const script = path.join(ROOT, 'scripts/lesson/presenter-from-photo.mjs');
const fakeKey = ['sk', 'TESTONLY'].join('-') + 'Z'.repeat(24);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const run = (args, env = {}) => spawnSync(process.execPath, [script, ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 60_000,
  windowsHide: true,
  env: {...process.env, MINIMAX_API_KEY: '', VISION_API_KEY: '', VISION_BASE_URL: '', ...env},
});
let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`✓ ${name}`);
    })
    .catch((error) => {
      console.error(`✗ ${name}: ${error.message}`);
      process.exitCode = 1;
    });
}

const valid = {
  preset: 'female',
  hair: 'Bun',
  accessory: 'GlassRound',
  facialHair: 'None',
  outfit: 'blackTee',
  skin: '#E0B090',
};

await test('mock 回放出 look，预览里写明不是照片级相似', async () => {
  const photo = path.join(tmp, 'photo.png');
  const fixture = path.join(tmp, 'fixture.json');
  const out = path.join(tmp, 'look.json');
  fs.writeFileSync(photo, png);
  fs.writeFileSync(fixture, JSON.stringify(valid));
  const result = run([photo, '--out', out, '--mock', fixture], {MINIMAX_API_KEY: fakeKey});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const look = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(look, {...valid, skin: '#E0B090'});
  assert.equal(presenterLookErrors({kind: 'cartoon', look}).length, 0);
  assert.match(result.stdout, /不是照片级相似/);
  assert.match(result.stdout, /不会离开这台电脑/);
  assert.doesNotMatch(result.stdout, /照片会发送给/);
  const preview = path.join(tmp, 'look.preview.png');
  const log = fs.readFileSync(path.join(tmp, 'look.log.txt'), 'utf8');
  assert.match(log, /不是照片级相似/);
  const shot = fs.readFileSync(preview);
  assert.equal(shot[0], 0x89);
  assert.equal(shot.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(fs.existsSync(path.join(tmp, '.look.preview.html')), false);
  const html = previewHtml({look, photoDataUrl: 'data:image/png;base64,QQ=='});
  assert.equal((html.match(/<svg /g) || []).length, 3);
  assert.match(html, /scaleX\(-1\)/);
  assert.match(html, /Bun/);
  assert.match(html, /不是照片级相似/);
});

await test('非法值纠正到清单内', () => {
  const {look, notes} = coerceLook({
    preset: 'boy',
    hair: 'SuperMullet',
    accessory: 'RayBans',
    facialHair: 'Beardz',
    outfit: 'tuxedo',
    skin: 'peach',
  });
  assert.equal(look.preset, 'male');
  assert.equal(look.accessory, 'SunglassWayfarer');
  assert.equal(look.facialHair, 'Full');
  assert.equal(look.outfit, 'whiteShirt');
  assert.equal(look.skin, '#E8C4A8');
  assert.ok(HAIR_NAMES.includes(look.hair), look.hair);
  assert.equal(presenterLookErrors({kind: 'cartoon', look}).length, 0);
  const text = notes.join('\n');
  assert.match(text, /SuperMullet/);
  assert.match(text, /RayBans/);
  assert.match(text, /改用最接近的/);
  const clean = coerceLook(valid);
  assert.equal(clean.notes.length, 0);
  assert.deepEqual(clean.look, valid);
});

await test('key 不进日志', async () => {
  const endpoint = resolveVisionEndpoint({env: {MINIMAX_API_KEY: fakeKey}});
  let seen;
  const error = await callVision({
    endpoint,
    dataUrl: 'data:image/png;base64,QQ==',
    fetchImpl: async (url, init) => {
      seen = {url, init};
      throw new Error(`socket hang up ${fakeKey} Bearer ${fakeKey}`);
    },
  }).then(() => null, (reason) => reason);
  assert.ok(error);
  assert.equal(String(error.message).includes(fakeKey), false);
  assert.match(error.message, /\*\*\*/);
  assert.equal(seen.url, `${MINIMAX_VISION_BASE}/chat/completions`);
  assert.equal(seen.init.signal.aborted, false);
  assert.ok(seen.init.signal);
  const body = JSON.parse(seen.init.body);
  assert.equal(body.model, MINIMAX_VISION_MODEL);
  assert.equal(body.thinking.type, 'disabled');
  assert.equal(body.messages[1].content[1].type, 'image_url');
  assert.equal(body.messages[1].content[1].image_url.url, 'data:image/png;base64,QQ==');
  const photo = path.join(tmp, 'photo.png');
  const fixture = path.join(tmp, 'ok.json');
  const out = path.join(tmp, 'keyed.json');
  fs.writeFileSync(photo, png);
  fs.writeFileSync(fixture, JSON.stringify(valid));
  const result = run([photo, '--out', out, '--mock', fixture], {MINIMAX_API_KEY: fakeKey, VISION_API_KEY: fakeKey});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const blob = `${result.stdout}\n${result.stderr}\n${fs.readFileSync(out, 'utf8')}\n${fs.readFileSync(path.join(tmp, 'keyed.log.txt'), 'utf8')}`;
  assert.equal(blob.includes(fakeKey), false);
  assert.equal(fs.readFileSync(path.join(tmp, 'keyed.preview.png')).includes(Buffer.from(fakeKey)), false);
});

await test('地址非 https 报错，本机代理除外，key 和地址成对', () => {
  assert.throws(() => resolveVisionEndpoint({env: {VISION_API_KEY: 'vision-test', VISION_BASE_URL: 'http://models.example.com/v1'}}), /https/);
  assert.throws(() => resolveVisionEndpoint({env: {MINIMAX_API_KEY: 'mm-test'}, baseArg: 'http://api.minimaxi.com/v1'}), /https/);
  assert.throws(() => resolveVisionEndpoint({env: {VISION_API_KEY: 'vision-test'}, baseArg: 'http://127.0.0.1.evil.com/v1'}), /https/);
  const local = resolveVisionEndpoint({env: {VISION_API_KEY: 'vision-test'}, baseArg: 'http://127.0.0.1:9/v1'});
  assert.equal(local.host, '127.0.0.1');
  assert.equal(local.pair, 'VISION_API_KEY');
  assert.equal(local.apiKey, 'vision-test');
  const localhost = resolveVisionEndpoint({env: {VISION_API_KEY: 'vision-test', VISION_BASE_URL: 'http://localhost:9/v1'}});
  assert.equal(localhost.host, 'localhost');
  const fallback = resolveVisionEndpoint({env: {MINIMAX_API_KEY: 'mm-test'}});
  assert.equal(fallback.base, MINIMAX_VISION_BASE);
  assert.equal(fallback.model, MINIMAX_VISION_MODEL);
  assert.equal(fallback.pair, 'MINIMAX_API_KEY');
  assert.equal(fallback.apiKey, 'mm-test');
  assert.equal(fallback.timeoutMs, VISION_TIMEOUT_MS);
  const paired = resolveVisionEndpoint({env: {MINIMAX_API_KEY: 'mm-test', VISION_API_KEY: 'vision-test', VISION_BASE_URL: 'https://vision.example.com/v1'}});
  assert.equal(paired.apiKey, 'vision-test');
  assert.equal(paired.base, 'https://vision.example.com/v1');
  assert.throws(() => resolveVisionEndpoint({env: {MINIMAX_API_KEY: 'mm-test'}, baseArg: 'https://vision.example.com/v1'}), /VISION_API_KEY/);
  assert.throws(() => resolveVisionEndpoint({env: {VISION_API_KEY: 'vision-test', MINIMAX_API_KEY: 'mm-test'}}), /成对/);
  const minimaxHost = resolveVisionEndpoint({
    env: {MINIMAX_API_KEY: 'mm-test', VISION_API_KEY: 'vision-test', VISION_BASE_URL: 'https://vision.example.com/v1'},
    baseArg: 'https://api.minimax.cn/v1',
    modelArg: 'MiniMax-M3',
  });
  assert.equal(minimaxHost.apiKey, 'mm-test');
  assert.equal(minimaxHost.pair, 'MINIMAX_API_KEY');
  const prompt = buildPrompt();
  for (const name of [...HAIR_NAMES, ...ACCESSORY_NAMES, ...FACIAL_HAIR_NAMES, 'darkSweater', 'blackTee', 'whiteShirt', 'male', 'female']) {
    assert.match(prompt, new RegExp(`\\b${name}\\b`));
  }
  assert.match(prompt, /不是照片级相似/);
  assert.match(prompt, /\bskin\b/);
  assert.doesNotMatch(prompt, /大致肤色/);
  assert.doesNotMatch(prompt, /不要追求和照片像素一致/);
  const cli = run(['missing.png', '--out', path.join(tmp, 'nope.json'), '--base-url', 'http://models.example.com/v1'], {VISION_API_KEY: 'vision-test'});
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /https/);
  assert.doesNotMatch(cli.stdout || '', /照片会发送给/);
  assert.equal((cli.stdout || '').includes('vision-test'), false);
  assert.equal((cli.stderr || '').includes(fakeKey), false);
});

fs.rmSync(tmp, {recursive: true, force: true});
console.log(`test-presenter-from-photo：${passed}/4 通过`);
if (process.exitCode) process.exit(process.exitCode);
