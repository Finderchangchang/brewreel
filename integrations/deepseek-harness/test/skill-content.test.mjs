// U5 catalog, U6 guide, U7 validate — against the real skill files of this repository (read-only:
// validate.mjs only reads; storyboards are copied into a temp workspace).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {normalizeConfig} from '../lib/config.js';
import {allowedRoots} from '../lib/paths.js';
import {applyPlugin} from '../lib/plugin.js';
import {planRender} from '../lib/render.js';
import {TOOL_NAMES} from '../lib/skill.js';
import {execIn, fakeCtx, REPO_ROOT, stubDefineTool, tmpDir} from './helpers.mjs';

const {ctx, tools} = fakeCtx();
applyPlugin(ctx, {skillRoot: REPO_ROOT}, {defineTool: stubDefineTool});
const tool = (n) => tools.find((t) => t.name === n);

test('U5 catalog: stable styles with fitsFor, six industries, themes', async () => {
  const c = await tool(TOOL_NAMES.catalog).execute({}, execIn(REPO_ROOT));
  const ids = c.styles.map((s) => s.id);
  assert.equal(ids[0], 'cards');
  for (const id of ['cards', 'quiz', 'journey']) assert.ok(ids.includes(id), id);
  for (const s of c.styles) {
    assert.ok(s.fitsFor.length > 10, s.id);
    assert.equal(s.status, 'stable');
    assert.ok(s.shots.length > 0 && s.firstShot && s.lastShot, s.id);
  }
  assert.deepEqual(c.industries.map((i) => i.id).sort(), ['beauty', 'ecommerce', 'education', 'food', 'software', 'travel']);
  assert.ok(c.industries.every((i) => i.enabledShots.length && i.summary));
  assert.ok(c.cardsThemes.length > 0);
  assert.ok(c.styles.find((s) => s.id === 'cards').examples.includes('ledger'));
  assert.ok(c.styles.find((s) => s.id === 'quiz').examples.every((e) => e.startsWith('quiz/')));
  const en = await tool(TOOL_NAMES.catalog).execute({lang: 'en'}, execIn(REPO_ROOT));
  assert.equal(en.styles[0].name, 'Cards');
  const dev = await tool(TOOL_NAMES.catalog).execute({includeDev: true}, execIn(REPO_ROOT));
  assert.ok(dev.styles.length >= c.styles.length);
});

test('U6 guide: reads docs, lists choices, rejects traversal, pages long files', async () => {
  const g = tool(TOOL_NAMES.guide);
  const quiz = await g.execute({topic: 'style', id: 'quiz'}, execIn(REPO_ROOT));
  assert.equal(quiz.path, 'styles/quiz/recipes.md');
  assert.ok(quiz.content.length > 100);
  assert.equal((await g.execute({topic: 'industry', id: 'food'}, execIn(REPO_ROOT))).path, 'industries/food/recipe.md');
  assert.equal((await g.execute({topic: 'industry', id: 'food', lang: 'en'}, execIn(REPO_ROOT))).path, 'industries/food/recipe.en.md');
  assert.equal((await g.execute({topic: 'shot', id: 'hook'}, execIn(REPO_ROOT))).path, 'docs/shots/hook.md');
  const ex = await g.execute({topic: 'example', id: 'ledger'}, execIn(REPO_ROOT));
  assert.equal(ex.path, 'examples/ledger.json');
  JSON.parse(ex.content);
  assert.match(g.output.render({topic: 'example'}, ex)[0].text, /样例只看格式/);
  const choices = await g.execute({topic: 'style'}, execIn(REPO_ROOT));
  assert.ok(choices.choices.includes('journey'));
  for (const bad of [{topic: 'style', id: '../x'}, {topic: 'example', id: 'quiz/../../SKILL'}, {topic: 'shot', id: 'C:/Windows/win'}, {topic: 'example', id: '/etc/passwd'}, {topic: 'nope'}]) {
    await assert.rejects(g.execute(bad, execIn(REPO_ROOT)), /unknown|valid/, JSON.stringify(bad));
  }
  const p1 = await g.execute({topic: 'skill', maxChars: 1000}, execIn(REPO_ROOT));
  assert.equal(p1.truncated, true);
  const p2 = await g.execute({topic: 'skill', maxChars: 1000, offset: p1.nextOffset}, execIn(REPO_ROOT));
  const full = fs.readFileSync(path.join(REPO_ROOT, 'SKILL.md'), 'utf8').replace(/^\uFEFF/, '');
  assert.equal(p1.content + p2.content, full.slice(0, p1.content.length + p2.content.length));
});

test('U7 validate: pass, structured errors, JSON syntax, missing brief, escaping asset, stuck', async () => {
  const ws = tmpDir('dv-ws-');
  const v = tool(TOOL_NAMES.validate);
  const dir = path.join(ws, 'promo', 'ledger');
  fs.mkdirSync(dir, {recursive: true});
  const sbFile = path.join(dir, 'storyboard.json');
  const ledger = fs.readFileSync(path.join(REPO_ROOT, 'examples', 'ledger.json'), 'utf8');
  fs.writeFileSync(sbFile, ledger);
  const ok = await v.execute({storyboard: 'promo/ledger/storyboard.json'}, execIn(ws));
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  assert.ok(ok.slots.length > 3 && ok.total > 10);
  assert.match(v.output.render({}, ok)[0].text, /校验通过/);

  const sb = JSON.parse(ledger);
  sb.shots = sb.shots.filter((s) => s.type !== 'hook');
  const bad = path.join(dir, 'nohook.json');
  fs.writeFileSync(bad, JSON.stringify(sb));
  const r = await v.execute({storyboard: bad}, execIn(ws));
  assert.equal(r.ok, false);
  assert.ok(r.errors.every((e) => e.where !== undefined && e.problem && e.fix !== undefined));
  assert.match(v.output.render({}, r)[0].text, /怎么改/);

  const broken = path.join(dir, 'broken.json');
  fs.writeFileSync(broken, '{"meta": {,}');
  const b = await v.execute({storyboard: broken}, execIn(ws));
  assert.equal(b.errors.length, 1);
  assert.match(b.errors[0].problem, /JSON 解析失败/);

  await assert.rejects(v.execute({storyboard: sbFile, brief: 'promo/ledger/brief.md'}, execIn(ws)), /brief file not found/);

  const esc = JSON.parse(ledger);
  esc.meta.assets = [{src: '../../../outside.png', source: 'screenshot'}];
  const escFile = path.join(dir, 'escape.json');
  fs.writeFileSync(escFile, JSON.stringify(esc));
  const e = await v.execute({storyboard: escFile}, execIn(ws));
  assert.ok(e.errors.some((x) => /outside the storyboard folder/.test(x.problem)));

  let last;
  for (let i = 0; i < 3; i++) last = await v.execute({storyboard: bad}, execIn(ws));
  assert.ok(last.stuck.length > 0, 'same error three rounds in a row → stuck');
  assert.match(last.nextStep, /3 次/);
});

test('custom shot is rejected in the plugin before any model-written code runs', async () => {
  const ws = tmpDir('dv-custom-');
  const dir = path.join(ws, 'promo', 'free');
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, 'storyboard.json');
  fs.writeFileSync(file, JSON.stringify({meta: {title: 'x'}, shots: [{type: 'custom', component: 'shots/a.tsx', dur: 2, slots: {keyword: 'hi'}}]}));
  const v = tool(TOOL_NAMES.validate);
  const r = await v.execute({storyboard: 'promo/free/storyboard.json'}, execIn(ws));
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].problem, '自由镜头只能在本地用，插件里不运行模型自己写的代码');
  assert.match(r.errors[0].where, /custom/);
  const roots = allowedRoots({workspace: ws, outputRoot: 'promo', extraWriteRoots: []});
  assert.throws(
    () => planRender({storyboard: file}, {runtimeRoot: REPO_ROOT, roots, cfg: normalizeConfig({})}),
    /自由镜头只能在本地用，插件里不运行模型自己写的代码/,
  );
});
