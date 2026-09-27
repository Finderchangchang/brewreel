// U1 package manifest, U2 skill source lookup, U3 skill registration, U4 tool registration, config rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {normalizeConfig} from '../lib/config.js';
import {applyPlugin} from '../lib/plugin.js';
import {findSkillSource, planRuntime, stageSkill, isStaged, listWhitelistFiles} from '../lib/skill-root.js';
import {buildPreamble, parseFrontmatter, TOOL_NAMES} from '../lib/skill.js';
import {fakeCtx, fakeSkillRoot, PLUGIN_DIR, REPO_ROOT, stubDefineTool, tmpDir} from './helpers.mjs';

test('U1 package.json declares a dsh bundle and ships the right files', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'dsh-distill-video');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  for (const f of ['index.js', 'lib/', 'cordis.patch.yml', 'skill/', 'LICENSE', 'NOTICE']) assert.ok(pkg.files.includes(f), f);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.ok(pkg.keywords.includes('dsh-plugin'));
  const patch = fs.readFileSync(path.join(PLUGIN_DIR, 'cordis.patch.yml'), 'utf8');
  assert.match(patch, /^- insert:\s*$/m);
  assert.match(patch, /id: distill-video/);
  assert.match(patch, new RegExp(`name: ${pkg.name}\\s*$`, 'm'));
});

test('U2 skill source: configured / checkout / bundled / missing', () => {
  const fake = fakeSkillRoot();
  assert.equal(findSkillSource({skillRoot: fake}).mode, 'configured');
  assert.equal(findSkillSource({skillRoot: path.join(fake, 'nope')}).mode, 'missing');
  // the real plugin dir sits in the repository → checkout
  const co = findSkillSource({pluginDir: PLUGIN_DIR});
  assert.equal(co.mode, 'checkout');
  assert.equal(path.resolve(co.root).toLowerCase(), path.resolve(REPO_ROOT).toLowerCase());
  // a plugin inside node_modules never uses the checkout, only skill/
  const nm = tmpDir('dv-nm-');
  const pkgDir = path.join(nm, 'node_modules', 'dsh-distill-video');
  fs.mkdirSync(path.join(pkgDir, 'skill', 'scripts'), {recursive: true});
  fs.writeFileSync(path.join(pkgDir, 'skill', 'SKILL.md'), '---\nname: promo-video-skill\ndescription: x\n---\n');
  fs.writeFileSync(path.join(pkgDir, 'skill', 'scripts', 'make.mjs'), '');
  fs.writeFileSync(path.join(nm, 'SKILL.md'), 'decoy');
  const b = findSkillSource({pluginDir: pkgDir});
  assert.equal(b.mode, 'bundled');
  fs.rmSync(path.join(pkgDir, 'skill'), {recursive: true});
  assert.equal(findSkillSource({pluginDir: pkgDir}).mode, 'missing');
});

test('U2 staging copies only the whitelist and reuses nothing it should not', () => {
  const src = fakeSkillRoot();
  fs.writeFileSync(path.join(src, '.privacy-denylist.local'), 'secret words');
  fs.mkdirSync(path.join(src, 'promo'), {recursive: true});
  fs.writeFileSync(path.join(src, 'promo', 'x.txt'), 'x');
  const runtimeDir = tmpDir('dv-rt-');
  const plan = planRuntime({mode: 'configured', root: src}, {stageCheckout: true, runtimeDir});
  assert.ok(plan.staged);
  const r = stageSkill({mode: 'configured', root: src}, plan);
  assert.equal(r.status, 'done');
  assert.ok(isStaged(plan.runtimeRoot));
  assert.ok(!fs.existsSync(path.join(plan.runtimeRoot, '.privacy-denylist.local')));
  assert.ok(!fs.existsSync(path.join(plan.runtimeRoot, 'promo')));
  assert.ok(!fs.existsSync(path.join(plan.runtimeRoot, 'template', 'node_modules')), 'node_modules is never copied from the source');
  assert.equal(stageSkill({mode: 'configured', root: src}, plan).status, 'skipped');
  const files = listWhitelistFiles(src);
  assert.ok(files.includes('scripts/make.mjs') && !files.some((f) => f.includes('node_modules')));
});

test('U3 skill registration: frontmatter name, preamble first, resourceBase = runtimeRoot, en variant', () => {
  const {ctx, skillRegs} = fakeCtx();
  const rt = applyPlugin(ctx, {skillRoot: REPO_ROOT}, {defineTool: stubDefineTool});
  assert.equal(skillRegs.length, 1);
  const s = skillRegs[0];
  const fm = parseFrontmatter(fs.readFileSync(path.join(REPO_ROOT, 'SKILL.md'), 'utf8'));
  assert.equal(s.name, fm.data.name);
  assert.equal(s.description, fm.data.description);
  assert.ok(s.content.startsWith(buildPreamble('zh', rt.plan.runtimeRoot)));
  assert.ok(s.content.includes(fm.body.trim().slice(0, 40)));
  assert.deepEqual(s.resourceBase, {kind: 'directory', path: rt.plan.runtimeRoot});
  assert.equal(s.metadata.plugin, 'dsh-distill-video');
  assert.equal(s.metadata.skillVersion, fm.data.metadata.version);
  assert.ok(rt.skillRegistered);

  const en = fakeCtx();
  applyPlugin(en.ctx, {skillRoot: REPO_ROOT, skillLang: 'en'}, {defineTool: stubDefineTool});
  assert.ok(en.skillRegs[0].content.startsWith('[Using this skill inside DeepSeek Harness]'));
  assert.ok(en.skillRegs[0].path.endsWith('SKILL.en.md'));
  for (const n of Object.values(TOOL_NAMES).filter((x) => x !== 'distill_video_verify')) assert.ok(s.content.includes(n) || n === TOOL_NAMES.setup, n);

  const off = fakeCtx();
  applyPlugin(off.ctx, {skillRoot: REPO_ROOT, registerSkill: false}, {defineTool: stubDefineTool});
  assert.equal(off.skillRegs.length, 0);
});

test('U4 seven tools registered; read-only ones are concurrency-safe; parameter DSL uses only allowed keys', () => {
  const {ctx, tools} = fakeCtx();
  applyPlugin(ctx, {skillRoot: fakeSkillRoot()}, {defineTool: stubDefineTool});
  assert.deepEqual(tools.map((t) => t.name).sort(), Object.values(TOOL_NAMES).sort());
  const readOnly = [TOOL_NAMES.doctor, TOOL_NAMES.catalog, TOOL_NAMES.guide, TOOL_NAMES.validate, TOOL_NAMES.verify];
  for (const t of tools) {
    assert.equal(!!t.isConcurrencySafe, readOnly.includes(t.name), t.name);
    assert.deepEqual(t.output.schema, {type: 'json'});
    const allowed = new Set(['type', 'description', 'required', 'enum', 'items']);
    for (const [k, p] of Object.entries(t.parameters)) {
      for (const key of Object.keys(p)) assert.ok(allowed.has(key), `${t.name}.${k}.${key}`);
      if ('required' in p) assert.equal(p.required, true);
    }
    assert.ok(t.description.length > 40);
  }
});

test('config: credential-like envPassthrough, bad registry and ranges are rejected', () => {
  assert.throws(() => normalizeConfig({envPassthrough: ['MY_TOKEN']}), /credentials/);
  assert.throws(() => normalizeConfig({envPassthrough: ['DEEPSEEK_API_KEY']}), /credentials/);
  assert.throws(() => normalizeConfig({npmRegistry: 'http://registry.example.com'}), /https/);
  assert.throws(() => normalizeConfig({maxConcurrentRenders: 9}), /between 1 and 4/);
  assert.deepEqual(normalizeConfig({envPassthrough: ['HTTP_PROXY_EXTRA']}).envPassthrough, ['HTTP_PROXY_EXTRA']);
  assert.equal(normalizeConfig({}).outputRoot, 'promo');
});
