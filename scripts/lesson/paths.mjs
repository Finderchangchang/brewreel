// 数据目录和出片目录都跟着用户当前工作目录走，不写死某台电脑的盘符。
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR_NAME = 'brewreel-data';
export const LEGACY_DATA_DIR_NAME = 'brewreel-studio-data';
export const OUT_DIR_NAME = 'brewreel-studio-out';

export function defaultDataDir(cwd = process.cwd()) {
  const next = path.resolve(cwd, '..', DATA_DIR_NAME);
  const legacy = path.resolve(cwd, '..', LEGACY_DATA_DIR_NAME);
  try {
    if (!fs.existsSync(next) && fs.existsSync(legacy)) return legacy;
  } catch { /* 读不到就用新目录名 */ }
  return next;
}

export function defaultOutDir(cwd = process.cwd()) {
  return path.resolve(cwd, '..', OUT_DIR_NAME);
}

function chosen(arg, envValue) {
  const fromArg = arg != null ? String(arg).trim() : '';
  if (fromArg) return fromArg;
  const fromEnv = envValue != null ? String(envValue).trim() : '';
  return fromEnv || '';
}

export function resolveDataDir(arg, env = process.env, cwd = process.cwd()) {
  const raw = chosen(arg, env?.LESSON_DATA_DIR);
  return raw ? path.resolve(cwd, raw) : defaultDataDir(cwd);
}

export function resolveOutDir(arg, env = process.env, cwd = process.cwd()) {
  const raw = chosen(arg, env?.LESSON_OUT_DIR);
  return raw ? path.resolve(cwd, raw) : defaultOutDir(cwd);
}

/** 目录落在安装文件夹里面时，角色档案和成片都不能放进去。 */
export function isInsideRepo(file, root) {
  const rel = path.relative(path.resolve(root), path.resolve(file));
  if (rel === '' || rel === '.') return true;
  if (path.isAbsolute(rel)) return false;
  return !rel.startsWith('..');
}

/** 给用户看的路径。能写成相对工作目录就写相对的，避免把本机绝对路径打进说明。 */
export function showPath(abs, cwd = process.cwd()) {
  const rel = path.relative(cwd, path.resolve(abs));
  if (rel && !path.isAbsolute(rel)) return rel;
  return path.basename(path.resolve(abs));
}
