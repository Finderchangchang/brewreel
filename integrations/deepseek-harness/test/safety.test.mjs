// U8 path and argv safety, U9 environment whitelist, process-tree timeout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {normalizeConfig} from '../lib/config.js';
import {allowedRoots, assetEscapes, assertOutDir, assertOutDirSafe, LEGACY_OUT_MARKERS, markOutDir, OUT_MARKER} from '../lib/paths.js';
import {planRender} from '../lib/render.js';
import {cleanEnv, runProcess} from '../lib/run.js';
import {tmpDir, writeStoryboard} from './helpers.mjs';

const cfg = normalizeConfig({});

test('U8 outDir must stay inside the workspace and never be a root folder', () => {
  const ws = tmpDir('dv-ws-');
  const roots = allowedRoots({workspace: ws, outputRoot: 'promo', extraWriteRoots: []});
  const sb = writeStoryboard(ws, 'demo');
  const plan = (outDir) => planRender({storyboard: sb, outDir}, {runtimeRoot: ws, roots, cfg});
  assert.throws(() => plan(os.tmpdir()), /outside the workspace/);
  assert.throws(() => plan('..'), /outside the workspace/);
  assert.throws(() => plan('.'), /root folder/);
  assert.throws(() => plan('promo'), /root folder/);
  assert.equal(plan('promo/demo-out').outDir, path.join(ws, 'promo', 'demo-out'));
  assert.equal(planRender({storyboard: 'promo/demo/storyboard.json'}, {runtimeRoot: ws, roots, cfg}).outDir, path.dirname(sb));
  // storyboard outside the workspace
  const outside = tmpDir('dv-out-');
  fs.writeFileSync(path.join(outside, 'sb.json'), '{}');
  assert.throws(() => planRender({storyboard: path.join(outside, 'sb.json')}, {runtimeRoot: ws, roots, cfg}), /outside the workspace/);
  // brief given but missing
  assert.throws(() => planRender({storyboard: sb, brief: 'promo/demo/brief.md'}, {runtimeRoot: ws, roots, cfg}), /brief file not found/);
});

test('U8 symlinked / junctioned folders cannot escape the workspace', (t) => {
  const ws = tmpDir('dv-ws-');
  const outside = tmpDir('dv-out-');
  const link = path.join(ws, 'promo', 'link');
  fs.mkdirSync(path.dirname(link), {recursive: true});
  try {
    fs.symlinkSync(outside, link, 'junction');
  } catch {
    t.skip('cannot create links here');
    return;
  }
  const roots = allowedRoots({workspace: ws, outputRoot: 'promo', extraWriteRoots: []});
  assert.throws(() => assertOutDir(path.join(fs.realpathSync.native(link), 'x'), roots), /outside the workspace/);
  const sb = writeStoryboard(ws, 'demo');
  assert.throws(() => planRender({storyboard: sb, outDir: 'promo/link/x'}, {runtimeRoot: ws, roots, cfg}), /outside the workspace/);
});

test('U8 refuses folders where make.mjs would delete user files', () => {
  const ws = tmpDir('dv-ws-');
  const sb = writeStoryboard(ws, 'demo');
  const other = path.join(ws, 'promo', 'other');
  fs.mkdirSync(other, {recursive: true});
  fs.writeFileSync(path.join(other, 'storyboard.json'), '{"mine": true}');
  assert.throws(() => assertOutDirSafe(other, sb), /different storyboard\.json/);
  fs.rmSync(path.join(other, 'storyboard.json'));
  fs.writeFileSync(path.join(other, 'video.mp4'), 'user video');
  assert.throws(() => assertOutDirSafe(other, sb), /video\.mp4/);
  fs.writeFileSync(path.join(other, 'manifest.json'), '{"status":"delivered","exitCode":0}');
  assert.doesNotThrow(() => assertOutDirSafe(other, sb));
  assert.doesNotThrow(() => assertOutDirSafe(path.dirname(sb), sb), 'the storyboard itself is never a conflict');
  // any other product name make.mjs clears (report.txt, layout.json, check/*.png …) in a foreign folder
  const docs = path.join(ws, 'docs');
  fs.mkdirSync(path.join(docs, 'check'), {recursive: true});
  fs.writeFileSync(path.join(docs, 'report.txt'), 'my report');
  assert.throws(() => assertOutDirSafe(docs, sb), /report\.txt.*delete them/);
  fs.rmSync(path.join(docs, 'report.txt'));
  fs.writeFileSync(path.join(docs, 'check', 'shot.png'), 'png');
  assert.throws(() => assertOutDirSafe(docs, sb), /check\/\*\.png/);
  fs.writeFileSync(path.join(docs, 'manifest.json'), '{"name":"web app manifest","icons":[]}');
  assert.throws(() => assertOutDirSafe(docs, sb), /manifest\.json/, 'a manifest.json make did not write is not a pass');
  // after a render that left partial files and no manifest (killed), the plugin's own marker lets it retry
  const partial = path.join(ws, 'promo', 'partial');
  markOutDir(partial, sb);
  fs.writeFileSync(path.join(partial, 'props.json'), '{}');
  assert.doesNotThrow(() => assertOutDirSafe(partial, sb));
  assert.ok(fs.existsSync(path.join(partial, OUT_MARKER)) && OUT_MARKER === '.brewreel-out.json');
  // a folder marked by plugin 0.1.x (dsh-distill-video) is still recognised
  const legacy = path.join(ws, 'promo', 'legacy');
  fs.mkdirSync(legacy, {recursive: true});
  fs.writeFileSync(path.join(legacy, 'storyboard.json'), '{"old": true}');
  fs.writeFileSync(path.join(legacy, 'props.json'), '{}');
  assert.throws(() => assertOutDirSafe(legacy, sb), /different storyboard\.json/);
  fs.writeFileSync(path.join(legacy, LEGACY_OUT_MARKERS[0]), '{"by":"dsh-distill-video"}');
  assert.equal(LEGACY_OUT_MARKERS[0], '.distill-video-out.json');
  assert.doesNotThrow(() => assertOutDirSafe(legacy, sb));
});

test('U8 hostile file names become exactly one absolute argv element', () => {
  const ws = tmpDir('dv-ws-');
  const roots = allowedRoots({workspace: ws, outputRoot: 'promo', extraWriteRoots: []});
  for (const name of ['--accept-layout.json', 'a b;c&d".json'.replace('"', process.platform === 'win32' ? "'" : '"'), '--round.json']) {
    const dir = path.join(ws, 'promo', 'x');
    fs.mkdirSync(dir, {recursive: true});
    const file = path.join(dir, name);
    fs.writeFileSync(file, '{}');
    const p = planRender({storyboard: `promo/x/${name}`, outDir: 'promo/x-out', stills: [0, 1.5], bgm: false}, {runtimeRoot: ws, roots, cfg});
    assert.equal(p.argv[1], file);
    assert.ok(path.isAbsolute(p.argv[1]) && !p.argv[1].startsWith('-'));
    assert.ok(!p.argv.includes('--accept-layout') && !p.argv.includes('--round') && !p.argv.includes('--allow-in-repo') && !p.argv.includes('--keep'));
    assert.deepEqual(p.argv.slice(2), ['--out', path.join(ws, 'promo', 'x-out'), '--stills', '0,1.5', '--no-bgm', '--queue-timeout', '20']);
  }
  const sb = writeStoryboard(ws, 'n');
  assert.throws(() => planRender({storyboard: sb, stills: [-1]}, {runtimeRoot: ws, roots, cfg}), /stills/);
  assert.throws(() => planRender({storyboard: sb, stills: []}, {runtimeRoot: ws, roots, cfg}), /stills/);
  assert.throws(() => planRender({storyboard: sb, queueTimeoutMin: 500}, {runtimeRoot: ws, roots, cfg}), /queueTimeoutMin/);
  assert.throws(() => planRender({storyboard: ''}, {runtimeRoot: ws, roots, cfg}), /non-empty/);
});

test('U8 asset paths that escape the storyboard folder are reported', () => {
  const ws = tmpDir('dv-ws-');
  const sbDir = path.join(ws, 'promo', 'a');
  fs.mkdirSync(sbDir, {recursive: true});
  const roots = allowedRoots({workspace: ws, outputRoot: 'promo', extraWriteRoots: []});
  const sb = {meta: {assets: [{src: 'shot.png'}, {src: '../../../x.png'}]}, shots: [{type: 'phone', params: {src: 'C:/Windows/win.ini', caption: '1/2 价'}}, {type: 'hook', caption: 'a/b'}]};
  const found = assetEscapes(sb, sbDir, roots);
  assert.equal(found.length, 2);
  assert.match(found[0].where, /meta\.assets\[1\]/);
  assert.match(found[1].where, /shots\[0\]\(phone\)\.params\.src/);
});

test('U9 child environment is a whitelist; credentials never pass', async () => {
  const env = cleanEnv({source: {PATH: '/bin', DEEPSEEK_API_KEY: 'dummy', GITHUB_TOKEN: 'dummy', HTTP_PROXY: 'http://p', LANG: 'C', RANDOM_VAR: '1', MY_VAR: 'y'}, passthrough: ['MY_VAR', 'OTHER_SECRET']});
  assert.equal(env.PATH, '/bin');
  assert.equal(env.LANG, 'C');
  assert.equal(env.MY_VAR, 'y');
  assert.equal(env.DEEPSEEK_API_KEY, undefined);
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.HTTP_PROXY, undefined, 'proxies only for setup');
  assert.equal(env.RANDOM_VAR, undefined);
  assert.equal(cleanEnv({source: {HTTP_PROXY: 'http://p'}, proxy: true}).HTTP_PROXY, 'http://p');
  // end to end through a real child
  process.env.DEEPSEEK_API_KEY = 'dummy-for-test';
  try {
    const r = await runProcess({cmd: process.execPath, args: ['-e', 'console.log(JSON.stringify(Object.keys(process.env)))'], cwd: os.tmpdir(), env: cleanEnv(), timeoutMs: 20_000});
    const keys = JSON.parse(r.stdout);
    assert.ok(!keys.some((k) => /DEEPSEEK|API_KEY/i.test(k)));
    assert.ok(keys.includes('PYTHONUTF8'));
  } finally {
    delete process.env.DEEPSEEK_API_KEY;
  }
});

test('runProcess: hard timeout kills the whole process tree', async () => {
  const script = "const {spawn}=require('child_process');const c=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'});console.log('child',c.pid);setTimeout(()=>{},60000)";
  const t0 = Date.now();
  const r = await runProcess({cmd: process.execPath, args: ['-e', script], cwd: os.tmpdir(), env: cleanEnv(), timeoutMs: 1500});
  assert.ok(r.timedOut);
  assert.ok(Date.now() - t0 < 15000);
  const childPid = Number(/child (\d+)/.exec(r.stdout)?.[1]);
  assert.ok(childPid > 0);
  await new Promise((res) => setTimeout(res, 500));
  let alive = true;
  try {
    process.kill(childPid, 0);
  } catch {
    alive = false;
  }
  assert.equal(alive, false, 'grandchild must be gone');
});
