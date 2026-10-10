import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ensureTemplateBrowser, findTemplateBrowserExecutable, remotionCacheDirFromCwd} from '../lib/remotion-browser.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 't11a-browser-'));
const realModules = path.join(root, 'real-modules');
const exe = path.join(realModules, '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
fs.mkdirSync(path.dirname(exe), {recursive: true});
fs.writeFileSync(exe, 'not-a-real-browser');
const template = path.join(root, 'template');
fs.mkdirSync(template);
fs.writeFileSync(path.join(template, 'package.json'), '{}\n');
const link = path.join(template, 'node_modules');
if (process.platform === 'win32') execFileSync('cmd.exe', ['/c', 'mklink', '/J', link, realModules], {stdio: 'ignore'});
else fs.symlinkSync(realModules, link, 'dir');

try {
  const found = findTemplateBrowserExecutable(template);
  assert.equal(path.basename(found), 'chrome-headless-shell.exe');
  assert.ok(found.includes(`${path.sep}node_modules${path.sep}.remotion${path.sep}`), found);
  assert.equal(found.includes(`${path.sep}real-modules${path.sep}`), false, found);

  let spawned = 0;
  const reused = ensureTemplateBrowser({
    templateDir: template,
    log: () => {},
    spawnImpl: () => { spawned += 1; return {status: 0}; },
  });
  assert.equal(spawned, 0);
  assert.equal(reused, found);

  const repo = path.join(root, 'repo-root');
  fs.mkdirSync(repo);
  // 没有 package.json 时，Remotion 会继续往上找。本机用户目录可能有 package.json，
  // 所以缓存不一定落在 repo-root/.remotion，但一定不是 template 这份。
  const repoCache = remotionCacheDirFromCwd(repo);
  const templateCache = remotionCacheDirFromCwd(template);
  assert.equal(templateCache, path.join(template, 'node_modules', '.remotion'));
  assert.notEqual(path.resolve(repoCache), path.resolve(templateCache));
  assert.equal(fs.existsSync(path.join(repo, 'package.json')), false);

  const empty = path.join(root, 'empty-template');
  fs.mkdirSync(path.join(empty, 'node_modules', '@remotion', 'cli'), {recursive: true});
  let seenCwd = '';
  let calls = 0;
  const downloaded = ensureTemplateBrowser({
    templateDir: empty,
    log: () => {},
    spawnImpl: (_cmd, _args, opts) => {
      calls += 1;
      seenCwd = opts.cwd;
      const planted = path.join(empty, 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
      fs.mkdirSync(path.dirname(planted), {recursive: true});
      fs.writeFileSync(planted, 'x');
      return {status: 0};
    },
  });
  assert.equal(calls, 1);
  assert.equal(seenCwd, empty);
  assert.ok(downloaded.includes(`${path.sep}empty-template${path.sep}node_modules${path.sep}.remotion${path.sep}`));
} finally {
  fs.rmdirSync(link);
  fs.rmSync(root, {recursive: true, force: true});
}

console.log('✓ Remotion 浏览器：根目录和 template 不是同一缓存，已有文件不下载，junction 不 realpath');
