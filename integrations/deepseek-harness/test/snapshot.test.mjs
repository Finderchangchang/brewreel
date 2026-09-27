// U12 snapshot freshness: when a skill/ snapshot sits next to the checkout, it must match the
// repository's whitelisted files; drift in a copied tree is detected.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {copyWhitelist, listWhitelistFiles, readSourceInfo, treeSha256} from '../lib/skill-root.js';
import {fakeSkillRoot, PLUGIN_DIR, REPO_ROOT, tmpDir} from './helpers.mjs';

test('U12 treeSha256 detects drift in a copied tree', () => {
  const src = fakeSkillRoot();
  fs.mkdirSync(path.join(src, 'examples'), {recursive: true});
  fs.writeFileSync(path.join(src, 'examples', 'a.json'), '{"a":1}');
  const copy = tmpDir('dv-copy-');
  copyWhitelist(src, copy);
  assert.equal(treeSha256(copy), treeSha256(src));
  fs.writeFileSync(path.join(copy, 'examples', 'a.json'), '{"a":2}');
  assert.notEqual(treeSha256(copy), treeSha256(src));
});

test('U12 existing skill/ snapshot matches the repository', (t) => {
  const info = readSourceInfo(path.join(PLUGIN_DIR, 'skill'));
  if (!info) {
    t.skip('no skill/ snapshot (run npm run sync)');
    return;
  }
  const files = listWhitelistFiles(REPO_ROOT);
  assert.equal(info.fileCount, files.length, 'file count drifted — run npm run sync');
  assert.equal(info.treeSha256, treeSha256(REPO_ROOT, files), 'snapshot is stale — run npm run sync');
});
