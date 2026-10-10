// Remotion 的下载缓存从 process.cwd() 往上找 package.json。
// 找到就放进那个目录的 node_modules/.remotion；找不到就放进 cwd/.remotion。
// 仓库根没有 package.json，所以在根目录里 openBrowser() 会再下一份 Chrome。
// doctor 在 template 目录执行，用的是 template/node_modules/.remotion。这里一律复用那一份。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXE_RANK = ['chrome-headless-shell.exe', 'chrome-headless-shell', 'headless_shell.exe', 'headless_shell', 'chrome.exe', 'chrome'];

export function templateBrowserCacheDir(templateDir) {
  return path.join(templateDir, 'node_modules', '.remotion');
}

/** 与 @remotion/renderer getDownloadsCacheDir 同一条向上查找。单测用来证明根目录和 template 不是同一处。 */
export function remotionCacheDirFromCwd(cwd) {
  let current = path.resolve(cwd);
  const root = current;
  while (true) {
    if (fs.existsSync(path.join(current, 'package.json'))) return path.join(current, 'node_modules', '.remotion');
    const parent = path.dirname(current);
    if (parent === current) return path.join(root, '.remotion');
    current = parent;
  }
}

function walkExecutables(dir, depth, found) {
  if (depth > 6) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, {withFileTypes: true}); }
  catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkExecutables(full, depth + 1, found);
    else if (EXE_RANK.includes(entry.name)) found.push(full);
  }
}

/** 不 realpath。node_modules 是 junction 时，返回的路径仍穿过 junction。 */
export function findTemplateBrowserExecutable(templateDir) {
  const root = templateBrowserCacheDir(templateDir);
  if (!fs.existsSync(root)) return null;
  const found = [];
  walkExecutables(root, 0, found);
  found.sort((a, b) => {
    const rank = EXE_RANK.indexOf(path.basename(a)) - EXE_RANK.indexOf(path.basename(b));
    return rank !== 0 ? rank : a.length - b.length;
  });
  return found[0] ?? null;
}

export function chromeModeForExecutable(exe) {
  return /headless-shell|headless_shell/i.test(String(exe)) ? 'headless-shell' : 'chrome';
}

export function withBrowserExecutable(args, exe) {
  if (!exe || args.includes('--browser-executable')) return args;
  return [...args, '--browser-executable', exe];
}

/**
 * 已有可执行文件就复用，不下载。没有才在 template 目录执行一次 browser ensure
 * （cwd 必须是 template，下载才会进 template/node_modules/.remotion）。
 */
export function ensureTemplateBrowser({templateDir, log = () => {}, spawnImpl = spawnSync} = {}) {
  const existing = findTemplateBrowserExecutable(templateDir);
  if (existing) {
    log(`Remotion 浏览器：复用 ${existing}`);
    return existing;
  }
  const cli = path.join(templateDir, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  log('Remotion 浏览器：template 下没有，开始下载（只这一次）');
  const result = spawnImpl(process.execPath, [cli, 'browser', 'ensure'], {
    cwd: templateDir,
    stdio: 'inherit',
    encoding: 'utf8',
    windowsHide: true,
  });
  if (!result || result.status !== 0) {
    throw new Error(`下载 Remotion 浏览器失败（退出码 ${result?.status ?? '未知'}）`);
  }
  const exe = findTemplateBrowserExecutable(templateDir);
  if (!exe) throw new Error('下载结束后仍找不到 template/node_modules/.remotion 里的浏览器');
  log(`Remotion 浏览器：已下载到 ${exe}`);
  return exe;
}
