#!/usr/bin/env node
// Snapshot the repository root into ./skill/ for npm pack (the repository root stays the only source).
// listWhitelistFiles keeps only git ls-files inside the whitelist, so ignored files never enter the snapshot.
//   node scripts/sync-skill.mjs                 copy the whitelist, self-check, write skill/.distill-source.json
//   node scripts/sync-skill.mjs --check-clean   same, but refuse when whitelisted files have uncommitted changes (prepack)
//   node scripts/sync-skill.mjs --check         only compare an existing snapshot with the repository (exit 1 on drift)
// BREWREEL_SYNC_ALLOW_DIRTY=1 skips the --check-clean refusal (the old name DISTILL_SYNC_ALLOW_DIRTY still works).
// Also copies LICENSE and NOTICE to the package root so the tarball carries them.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {copyWhitelist, listWhitelistFiles, readSourceInfo, treeSha256, WHITELIST} from '../lib/skill-root.js';
import {parseFrontmatter} from '../lib/skill.js';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PKG, '..', '..');
const OUT = path.join(PKG, 'skill');
const args = process.argv.slice(2);
const die = (msg) => {
  console.error(`sync-skill: ${msg}`);
  process.exit(1);
};

if (!fs.existsSync(path.join(REPO, 'SKILL.md'))) die(`no SKILL.md in ${REPO}; run this from a BrewReel checkout`);
const files = listWhitelistFiles(REPO);
const tree = treeSha256(REPO, files);

if (args.includes('--check')) {
  const info = readSourceInfo(OUT);
  if (!info) die('no skill/ snapshot; run npm run sync');
  if (info.treeSha256 !== tree) die(`skill/ is stale (snapshot ${info.treeSha256.slice(0, 12)}, repository ${tree.slice(0, 12)}); run npm run sync`);
  console.log(`sync-skill: snapshot is current (${info.fileCount} files, ${tree.slice(0, 12)})`);
  process.exit(0);
}

const git = (...a) => spawnSync('git', ['-C', REPO, ...a], {encoding: 'utf8', shell: false});
if (args.includes('--check-clean') && !(process.env.BREWREEL_SYNC_ALLOW_DIRTY || process.env.DISTILL_SYNC_ALLOW_DIRTY)) {
  const st = git('status', '--porcelain', '--', ...WHITELIST.files, ...WHITELIST.dirs);
  if (st.status !== 0) die('git status failed; is this a git checkout?');
  const dirty = st.stdout.split('\n').filter(Boolean);
  if (dirty.length) die(`${dirty.length} whitelisted file(s) have uncommitted changes; commit or stash them before packing (or set BREWREEL_SYNC_ALLOW_DIRTY=1):\n${dirty.slice(0, 20).join('\n')}`);
}

fs.rmSync(OUT, {recursive: true, force: true});
const n = copyWhitelist(REPO, OUT, files);

// self-check inside the snapshot: shot specs + one example storyboard
const node = (script, ...a) => spawnSync(process.execPath, [path.join(OUT, 'scripts', script), ...a], {cwd: OUT, encoding: 'utf8', shell: false});
const specs = node('validate.mjs', '--specs');
if (specs.status !== 0) die(`validate.mjs --specs failed inside the snapshot:\n${specs.stdout}${specs.stderr}`);
const ex = node('validate.mjs', path.join(OUT, 'examples', 'ledger.json'), '--json');
if (ex.status !== 0) die(`examples/ledger.json does not validate inside the snapshot:\n${ex.stdout.slice(0, 2000)}`);

const fm = parseFrontmatter(fs.readFileSync(path.join(REPO, 'SKILL.md'), 'utf8')).data;
const head = git('rev-parse', '--short', 'HEAD');
const dirty = git('status', '--porcelain', '--', ...WHITELIST.files, ...WHITELIST.dirs).stdout?.trim();
const info = {skillVersion: fm.metadata?.version ?? null, repoCommit: head.status === 0 ? head.stdout.trim() : null, dirty: !!dirty, syncedAt: new Date().toISOString(), fileCount: n, treeSha256: tree};
fs.writeFileSync(path.join(OUT, '.distill-source.json'), `${JSON.stringify(info, null, 2)}\n`);
for (const f of ['LICENSE', 'NOTICE']) fs.copyFileSync(path.join(REPO, f), path.join(PKG, f));
console.log(`sync-skill: ${n} files → skill/ (skill ${info.skillVersion}, commit ${info.repoCommit}${info.dirty ? ', DIRTY' : ''}, tree ${tree.slice(0, 12)})`);
