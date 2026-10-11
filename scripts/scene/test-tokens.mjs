#!/usr/bin/env node
// 三套预设都能读出全部角色名。正文对比度 ≥ 4.5。颜色来自现有文件。
import assert from 'node:assert/strict';
import {contrastRatio} from '../../template/src/scene/contrast.ts';
import {TOKEN_ROLES} from '../../template/src/scene/types.ts';
import {loadPreset, loadStyle, missingRoles, registerStyleReader} from './tokens.mjs';

const REQUIRED = [
  ['ink', 'surface'],
  ['ink', 'bg'],
  ['muted', 'surface'],
];

for (const name of ['A', 'B', 'C']) {
  const token = loadPreset(name);
  assert.ok(token, name);
  assert.deepEqual(missingRoles(token.roles), []);
  for (const key of TOKEN_ROLES) assert.ok(token.roles[key] !== undefined, `${name} ${key}`);
  for (const [fg, bg] of REQUIRED) {
    const ratio = contrastRatio(token.roles[fg], token.roles[bg]);
    assert.ok(ratio >= 4.5, `${name} ${fg}/${bg} ${ratio.toFixed(2)}`);
  }
}

const fresh = loadPreset('A');
assert.equal(fresh.family, 'surface');
assert.equal(fresh.id, 'fresh-light');
assert.equal(fresh.roles.surface, '#FFFFFF');
assert.equal(fresh.roles.ink, '#0F2530');
assert.equal(fresh.roles.radius, 36);
assert.equal(fresh.source, 'template/src/core/themes.json');

const editorial = loadPreset('B');
assert.equal(editorial.family, 'lesson');
assert.equal(editorial.roles.radius, 0);
assert.equal(editorial.roles.weight, 900);
assert.equal(editorial.roles.bg, '#F2F1EC');
assert.equal(editorial.source, 'template/src/lesson/style-tokens.json');

const paper = loadPreset('C');
assert.equal(paper.family, 'material');
assert.equal(paper.roles.bg, '#F7F2E7');
assert.equal(paper.roles.surface, '#FFFDF8');
assert.equal(paper.roles.ink, '#2C3938');
assert.equal(paper.roles.accent, '#F28E6C');
assert.equal(paper.source, 'template/src/talk/motion/palette.ts');
assert.notEqual(fresh.source, editorial.source);
assert.notEqual(editorial.source, paper.source);

registerStyleReader((product, style) => {
  if (product !== 'talk' || style !== 'demo-extra') return null;
  return {
    family: 'material',
    product: 'talk',
    id: style,
    source: 'registerStyleReader',
    roles: {...paper.roles, texture: 'demo-extra'},
  };
});
const extra = loadStyle('talk', 'demo-extra');
assert.equal(extra.roles.texture, 'demo-extra');
assert.equal(extra.roles.bg, paper.roles.bg);
assert.equal(loadStyle('talk', 'missing-style'), null);
