// U10 exit-code mapping and delivery conditions, U11 progress parsing, background jobs, cancel, verify.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {describeExit} from '../lib/exit-codes.js';
import {applyPlugin} from '../lib/plugin.js';
import {parseProgress} from '../lib/render.js';
import {TOOL_NAMES} from '../lib/skill.js';
import {execIn, fakeCtx, fakeJobs, fakeSkillRoot, stubDefineTool, tmpDir, writeStoryboard} from './helpers.mjs';

function setup({jobs, config = {}} = {}) {
  const skill = fakeSkillRoot();
  const {ctx, tools} = fakeCtx({jobs});
  applyPlugin(ctx, {skillRoot: skill, renderInBackground: false, ...config}, {defineTool: stubDefineTool});
  const tool = (n) => tools.find((t) => t.name === n);
  return {skill, tool, ws: tmpDir('dv-ws-')};
}

test('U10 exit code table', () => {
  assert.equal(describeExit(0).status, 'delivered');
  assert.equal(describeExit(0, {stills: true}).status, 'stills');
  for (const [code, status] of [[1, 'invalid'], [2, 'usage'], [3, 'rejected'], [4, 'render-failed'], [5, 'queue-timeout'], [6, 'internal'], [130, 'interrupted'], [null, 'killed'], [77, 'killed']]) {
    assert.equal(describeExit(code).status, status, String(code));
  }
  assert.match(describeExit(3, {lang: 'en'}).nextStep, /failures/);
});

test('U10 delivered only when exit 0 + delivery line + manifest + sha256 all agree', async () => {
  const {tool, ws} = setup();
  const render = tool(TOOL_NAMES.render);
  const ok = await render.execute({storyboard: writeStoryboard(ws, 'ok', {code: 0})}, execIn(ws));
  assert.equal(ok.status, 'delivered');
  assert.equal(ok.delivered, true);
  assert.ok(ok.video.path.endsWith('video.mp4'));
  assert.ok(ok.deliveryLine.startsWith('交付：'));
  assert.ok(ok.sheet);
  const text = render.output.render({}, ok)[0].text;
  assert.match(text, /成片（可交付）/);

  for (const [name, fake] of [['nosha', {code: 0, badSha: true}], ['noline', {code: 0, noDeliveryLine: true}]]) {
    const r = await render.execute({storyboard: writeStoryboard(ws, name, fake)}, execIn(ws));
    assert.equal(r.video, null, name);
    assert.equal(r.delivered, false, name);
  }
  const rej = await render.execute({storyboard: writeStoryboard(ws, 'rej', {code: 3})}, execIn(ws));
  assert.equal(rej.status, 'rejected');
  assert.equal(rej.video, null);
  assert.ok(rej.rejectedPreview.path.endsWith('video.rejected.mp4'));
  assert.ok(rej.failures.some((f) => f.includes('字幕出界')));
  const inv = await render.execute({storyboard: writeStoryboard(ws, 'inv', {code: 1, errors: [{where: '第 1 镜（hook）', problem: 'p', fix: 'f'}]})}, execIn(ws));
  assert.equal(inv.status, 'invalid');
  assert.equal(inv.validation.errors.length, 1, 'validate errors are folded into the render result');
  for (const code of [4, 5, 6]) {
    const r = await render.execute({storyboard: writeStoryboard(ws, `c${code}`, {code})}, execIn(ws));
    assert.equal(r.exitCode, code);
    assert.equal(r.video, null);
  }
  const st = await render.execute({storyboard: writeStoryboard(ws, 'st', {code: 0}), stills: [0, 3]}, execIn(ws));
  assert.equal(st.status, 'stills');
  assert.equal(st.video, null);
  assert.equal(st.checkFrames.length, 2);
  const argv = JSON.parse(fs.readFileSync(path.join(ws, 'promo', 'st', 'argv.json'), 'utf8'));
  assert.ok(argv.argv.includes('--stills'));
  assert.ok(!argv.env.some((k) => /API_KEY|TOKEN/i.test(k)));
});

test('U10 renderTimeoutMin kills the render (status killed)', async () => {
  const {tool, ws} = setup({config: {renderTimeoutMin: 0.02}});
  const r = await tool(TOOL_NAMES.render).execute({storyboard: writeStoryboard(ws, 'slow', {code: 0, sleepMs: 20000})}, execIn(ws));
  assert.equal(r.status, 'killed');
  assert.equal(r.video, null);
  assert.match(r.exitMeaning, /renderTimeoutMin/);
});

test('U11 progress lines', () => {
  const seen = [
    '[make   0s] 输出目录：/x',
    '[make   1s] 生成配乐…',
    '[make   3s] 配乐 OK',
    '[make   4s] 排队中：前面还有 1 个渲染，最多再等 19 分钟',
    '[make   5s] 渲染整片 24.5 秒…',
    '[make  20s] 渲染中… 已用 15 秒（120/735 帧）',
    '[make  90s] 拼图（Remotion Sheet，12 格）…',
    'random noise',
  ].map((l) => parseProgress(l)).filter(Boolean);
  assert.deepEqual(seen.slice(0, 3), ['准备中', '配乐中', '配乐完成']);
  assert.match(seen[3], /^排队中/);
  assert.equal(seen[4], '开始渲染');
  assert.equal(seen[5], '渲染 120/735 帧（16%）');
  assert.equal(seen[6], '拼图');
  assert.equal(seen.length, 7);
});

test('background render: job id at once, progress streamed, result JSON on completion', async () => {
  const jobs = fakeJobs();
  const {tool, ws} = setup({jobs, config: {renderInBackground: true}});
  const h = await tool(TOOL_NAMES.render).execute({storyboard: writeStoryboard(ws, 'bg', {code: 0, sleepMs: 800})}, execIn(ws));
  assert.equal(h.kind, 'background');
  assert.equal(h.jobId, 'brewreel-1');
  assert.equal(jobs.started[0].spec.owner, 'session-1');
  const rec = jobs.started[0];
  await rec.done;
  assert.equal(rec.outcome.status, 'completed');
  assert.match(rec.outcome.detail, /exit code: 0/);
  const result = JSON.parse(rec.outcome.result);
  assert.equal(result.status, 'delivered');
  assert.ok(rec.progress.includes('准备中'));
  assert.ok(rec.progress.some((p) => /^渲染 \d+\/700 帧/.test(p)));
  assert.ok(rec.output.some((l) => l.includes('输出目录')));
});

test('cancel: job cancel kills the render; the next render is not blocked', async () => {
  const jobs = fakeJobs();
  const {tool, ws} = setup({jobs, config: {renderInBackground: true}});
  await tool(TOOL_NAMES.render).execute({storyboard: writeStoryboard(ws, 'c1', {code: 0, sleepMs: 30000})}, execIn(ws));
  const rec = jobs.started[0];
  await new Promise((r) => setTimeout(r, 700));
  const t0 = Date.now();
  rec.hooks.cancel('user');
  await rec.done;
  assert.ok(Date.now() - t0 < 10000);
  assert.equal(rec.outcome.status, 'killed');
  await tool(TOOL_NAMES.render).execute({storyboard: writeStoryboard(ws, 'c2', {code: 0})}, execIn(ws));
  await jobs.started[1].done;
  assert.equal(jobs.started[1].outcome.status, 'completed', 'semaphore released after cancel');
});

test('foreground fallback when no jobs service; missing deps are reported, not installed', async () => {
  const {tool, ws, skill} = setup({config: {renderInBackground: true}});
  const r = await tool(TOOL_NAMES.render).execute({storyboard: writeStoryboard(ws, 'fg', {code: 0})}, execIn(ws));
  assert.equal(r.status, 'delivered');
  assert.match(r.note, /jobs/);
  fs.rmSync(path.join(skill, 'template', 'node_modules'), {recursive: true});
  await assert.rejects(tool(TOOL_NAMES.render).execute({storyboard: writeStoryboard(ws, 'nodeps', {code: 0})}, execIn(ws)), /brewreel_setup/);
});

test('background admission refused → foreground with a note', async () => {
  const jobs = {start() {
    throw new Error('no job controller serves this agent');
  }};
  const {tool, ws} = setup({jobs, config: {renderInBackground: true}});
  const r = await tool(TOOL_NAMES.render).execute({storyboard: writeStoryboard(ws, 'refused', {code: 0})}, execIn(ws));
  assert.equal(r.status, 'delivered');
  assert.match(r.note, /no job controller/);
});

test('verify: ok after render, mismatch otherwise', async () => {
  const {tool, ws} = setup();
  const sb = writeStoryboard(ws, 'v', {code: 0});
  assert.equal((await tool(TOOL_NAMES.verify).execute({storyboard: sb}, execIn(ws))).ok, false);
  await tool(TOOL_NAMES.render).execute({storyboard: sb}, execIn(ws));
  const v = await tool(TOOL_NAMES.verify).execute({storyboard: sb}, execIn(ws));
  assert.equal(v.ok, true);
  assert.ok(v.video.endsWith('video.mp4'));
});
