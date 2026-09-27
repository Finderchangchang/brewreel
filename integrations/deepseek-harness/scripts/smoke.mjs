#!/usr/bin/env node
// Smoke test without dsh: build the plugin runtime and call the tool functions directly.
//   node scripts/smoke.mjs --runtime-dir <dir> --work <dir> [--chrome-from <template/node_modules/.remotion>] [--full] [--examples ledger,quiz/food-slow-soup]
//     --runtime-dir  where the skill is staged and dependencies installed (stageCheckout is forced on)
//     --work         workspace; storyboards are copied to <work>/promo/<name>/ and rendered there
//     --chrome-from  copy an existing .remotion/chrome-headless-shell instead of downloading it
//     --full         render full videos (2–4 min each); default renders stills only
//     --setup        run distill_video_setup (npm ci; downloads when the npm cache is cold)
// Prints one JSON line per step; exits 1 when a step fails.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyPlugin} from '../lib/plugin.js';
import {TOOL_NAMES} from '../lib/skill.js';

const argv = process.argv.slice(2);
const opt = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : d;
};
const runtimeDir = path.resolve(opt('--runtime-dir', path.join(process.cwd(), '.smoke-runtime')));
const work = path.resolve(opt('--work', path.join(process.cwd(), '.smoke-work')));
const chromeFrom = opt('--chrome-from');
const full = argv.includes('--full');
const examples = String(opt('--examples', 'ledger')).split(',').filter(Boolean);
const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const tools = [];
const ctx = {tools: {register: (t) => tools.push(t)}, logger: {info: (m) => console.error(`[info] ${m}`), warn: (m) => console.error(`[warn] ${m}`)}, get: () => undefined};
const rt = applyPlugin(ctx, {stageCheckout: true, runtimeDir, renderInBackground: false, bgm: argv.includes('--bgm')}, {defineTool: (s) => s, pluginDir});
const call = (name, args) => tools.find((t) => t.name === name).execute(args, {signal: new AbortController().signal, agent: {id: 'smoke', session: {header: {cwd: work}}}});
let failed = false;
const step = async (id, fn, check) => {
  const t0 = Date.now();
  try {
    const r = await fn();
    const ok = check(r);
    if (!ok) failed = true;
    console.log(JSON.stringify({step: id, ok, sec: Math.round((Date.now() - t0) / 1000), result: r}));
    return r;
  } catch (e) {
    failed = true;
    console.log(JSON.stringify({step: id, ok: false, error: String(e?.message ?? e)}));
    return null;
  }
};

fs.mkdirSync(work, {recursive: true});
await step('doctor-before', () => call(TOOL_NAMES.doctor, {}), (r) => typeof r.ready === 'boolean');
if (argv.includes('--setup')) {
  await step('setup-stage-deps', () => call(TOOL_NAMES.setup, {steps: ['stage', 'deps'], run_in_background: false}), (r) => r.ok);
  if (chromeFrom) {
    const src = path.join(path.resolve(chromeFrom), 'chrome-headless-shell');
    const dst = path.join(rt.plan.runtimeRoot, 'template', 'node_modules', '.remotion', 'chrome-headless-shell');
    if (!fs.existsSync(dst)) fs.cpSync(src, dst, {recursive: true});
  }
  await step('setup-browser', () => call(TOOL_NAMES.setup, {steps: ['browser'], run_in_background: false}), (r) => r.ok);
}
await step('doctor-after', () => call(TOOL_NAMES.doctor, {deep: true}), (r) => r.ready);
await step('catalog', () => call(TOOL_NAMES.catalog, {}), (r) => r.styles.length >= 3);
for (const ex of examples) {
  const name = ex.replace(/[^A-Za-z0-9-]/g, '-');
  const src = ex.includes('/') ? path.join(rt.plan.runtimeRoot, 'styles', ex.split('/')[0], 'examples', `${ex.split('/')[1]}.json`) : path.join(rt.plan.runtimeRoot, 'examples', `${ex}.json`);
  const dir = path.join(work, 'promo', name);
  fs.mkdirSync(dir, {recursive: true});
  fs.copyFileSync(src, path.join(dir, 'storyboard.json'));
  const sb = `promo/${name}/storyboard.json`;
  await step(`validate:${ex}`, () => call(TOOL_NAMES.validate, {storyboard: sb}), (r) => r.ok);
  await step(`stills:${ex}`, () => call(TOOL_NAMES.render, {storyboard: sb, outDir: `promo/${name}-stills`, stills: [0, 3], run_in_background: false}), (r) => r.status === 'stills' && r.checkFrames.length >= 2 && r.video === null);
  if (full) {
    await step(`render:${ex}`, () => call(TOOL_NAMES.render, {storyboard: sb, run_in_background: false}), (r) => r.delivered && !!r.video?.path);
    await step(`verify:${ex}`, () => call(TOOL_NAMES.verify, {storyboard: sb}), (r) => r.ok);
  }
}
process.exit(failed ? 1 : 0);
