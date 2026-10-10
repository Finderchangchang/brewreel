// 品牌档案放在仓库外的数据目录。改了就升版本，旧版本和当时的 logo 留在 history。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ID_RE, parseBrandRef, brandRefProblem} from './brand-ref.mjs';
import {resolveLawyer} from './brand-render.mjs';
import {isInsideRepo, resolveDataDir} from './paths.mjs';

export {resolveDataDir};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ASSET_RE = /^(logo|qr)-v[1-9]\d*\.(svg|png)$/;
export const DEFAULT_TIP = '扫码咨询 · 下期见';

export class BrandError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BrandError';
  }
}

export function assertOutsideRepo(file, root = ROOT) {
  if (isInsideRepo(file, root)) {
    throw new BrandError('品牌档案不能放在仓库里。数据目录要在仓库外面，默认是当前工作目录上一级的 brewreel-data');
  }
}

export function brandFile(dataDir, client) {
  return path.join(dataDir, 'clients', client, 'brand.json');
}

export function sha256Of(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function isIso(value) {
  return typeof value === 'string' && ISO_RE.test(value);
}

export function normalizeHex(value, label) {
  const text = String(value ?? '').trim();
  if (!HEX_RE.test(text)) throw new BrandError(`${label}必须是 #RRGGBB`);
  return `#${text.slice(1).toUpperCase()}`;
}

function limited(value, label, max) {
  const text = String(value ?? '').trim();
  if (!text) throw new BrandError(`${label}不能为空`);
  if (Array.from(text).length > max) throw new BrandError(`${label}最多 ${max} 个字`);
  return text;
}

export function normalizeLawyer(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BrandError('律师必须是对象，包含姓名、职称、部门');
  return {
    name: limited(raw.name, '律师姓名', 20),
    title: limited(raw.title, '律师职称', 20),
    department: limited(raw.department, '律师部门', 30),
  };
}

function assetErrors(asset, where, kind, err) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    err(where, '必须是对象，包含 file 和 sha256');
    return;
  }
  if (typeof asset.file !== 'string' || !ASSET_RE.test(asset.file) || !asset.file.startsWith(kind)) {
    err(`${where}.file`, `必须是 ${kind}-v版本号.svg 或 .png，不要写路径`);
  }
  if (typeof asset.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(asset.sha256)) err(`${where}.sha256`, '必须是 64 位小写十六进制');
}

function lawyerErrors(list, where, err) {
  if (!Array.isArray(list)) { err(where, '必须是数组。没有律师时写空数组'); return; }
  list.forEach((item, index) => {
    const at = `${where}[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) { err(at, '必须是对象'); return; }
    if (typeof item.name !== 'string' || !item.name.trim() || Array.from(item.name).length > 20) err(`${at}.name`, '必须是 1–20 个字');
    if (typeof item.title !== 'string' || !item.title.trim() || Array.from(item.title).length > 20) err(`${at}.title`, '必须是 1–20 个字');
    if (typeof item.department !== 'string' || !item.department.trim() || Array.from(item.department).length > 30) err(`${at}.department`, '必须是 1–30 个字');
  });
}

function visualErrors(data, where, err, {versioned}) {
  if (typeof data.firm !== 'string' || !data.firm.trim() || Array.from(data.firm).length > 40) err(`${where}firm`, '必须是 1–40 个字');
  if (typeof data.english !== 'string' || Array.from(data.english).length > 80) err(`${where}english`, '必须是字符串，不写英文名时用空字符串，最多 80 个字');
  if (typeof data.column !== 'string' || !data.column.trim() || Array.from(data.column).length > 20) err(`${where}column`, '必须是 1–20 个字');
  if (typeof data.primary !== 'string' || !HEX_RE.test(data.primary)) err(`${where}primary`, '必须是 #RRGGBB');
  if (data.secondary != null && (typeof data.secondary !== 'string' || !HEX_RE.test(data.secondary))) err(`${where}secondary`, '不写辅色时用 null，写了就必须是 #RRGGBB');
  if (typeof data.tip !== 'string' || !data.tip.trim() || Array.from(data.tip).length > 40) err(`${where}tip`, '必须是 1–40 个字');
  assetErrors(data.logo, `${where}logo`, 'logo', err);
  if (data.qr != null) assetErrors(data.qr, `${where}qr`, 'qr', err);
  lawyerErrors(data.lawyers, `${where}lawyers`, err);
  if (versioned && data.logo?.file && Number.isInteger(data.version) && !data.logo.file.includes(`-v${data.version}.`)) {
    err(`${where}logo.file`, '文件名里的版本号要和这条记录的版本一致');
  }
}

export function validateBrand(data) {
  const errors = [];
  const err = (at, problem) => errors.push(`${at}：${problem}`);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['品牌档案必须是对象'];
  if (typeof data.client !== 'string' || !ID_RE.test(data.client)) err('client', '必须是小写字母、数字和短横线，并以字母或数字开头，最长 41 个字符');
  if (!Number.isInteger(data.version) || data.version < 1) err('version', '必须是从 1 开始的整数');
  visualErrors(data, '', err, {versioned: true});
  if (!isIso(data.createdAt)) err('createdAt', '必须是 ISO 时间');
  if (!isIso(data.updatedAt)) err('updatedAt', '必须是 ISO 时间');
  if (!Array.isArray(data.history)) err('history', '必须是数组。没有旧版本时写空数组');
  else {
    const seen = new Set();
    data.history.forEach((item, index) => {
      const at = `history[${index}]`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) { err(at, '必须是对象'); return; }
      if (!Number.isInteger(item.version) || item.version < 1) err(`${at}.version`, '必须是从 1 开始的整数');
      else if (Number.isInteger(data.version) && item.version >= data.version) err(`${at}.version`, '旧版本号必须小于当前版本');
      else if (seen.has(item.version)) err(`${at}.version`, '版本号不能重复');
      else seen.add(item.version);
      visualErrors(item, `${at}.`, err, {versioned: true});
      if (!isIso(item.updatedAt)) err(`${at}.updatedAt`, '必须是 ISO 时间');
    });
  }
  return errors;
}

export function readBrand(file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new BrandError(`找不到品牌档案：${path.basename(path.dirname(file))}`);
    throw new BrandError('品牌档案不是合法的 JSON');
  }
  const errors = validateBrand(data);
  if (errors.length) throw new BrandError(`品牌档案不合格：\n${errors.map((item) => `  ${item}`).join('\n')}`);
  return data;
}

export function writeBrand(file, record) {
  assertOutsideRepo(file);
  const errors = validateBrand(record);
  if (errors.length) throw new BrandError(`品牌档案不合格：\n${errors.map((item) => `  ${item}`).join('\n')}`);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return record;
}

export function readAsset(src) {
  const abs = path.resolve(src);
  const ext = path.extname(abs).toLowerCase().replace(/^\./u, '');
  if (ext !== 'svg' && ext !== 'png') throw new BrandError('图片只能是 svg 或 png');
  let buf;
  try { buf = fs.readFileSync(abs); }
  catch { throw new BrandError(`找不到图片：${path.basename(abs)}`); }
  if (!buf.length) throw new BrandError(`${path.basename(abs)} 是空文件`);
  if (ext === 'svg' && !/<svg[\s>]/i.test(buf.toString('utf8'))) throw new BrandError('svg 里没有 svg 根节点');
  if (ext === 'png' && buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new BrandError('png 文件头不对');
  return {buf, ext};
}

function snapshot(record) {
  return {
    version: record.version,
    firm: record.firm,
    english: record.english,
    column: record.column,
    logo: structuredClone(record.logo),
    primary: record.primary,
    secondary: record.secondary,
    lawyers: structuredClone(record.lawyers),
    qr: record.qr ? structuredClone(record.qr) : null,
    tip: record.tip,
    updatedAt: record.updatedAt,
  };
}

function writeVersioned(dir, kind, version, asset) {
  const name = `${kind}-v${version}.${asset.ext}`;
  fs.writeFileSync(path.join(dir, name), asset.buf);
  return {file: name, sha256: sha256Of(asset.buf)};
}

function existingAsset(dir, file) {
  const abs = path.join(dir, file);
  if (!fs.existsSync(abs)) throw new BrandError(`档案里的 ${file} 不在了`);
  const buf = fs.readFileSync(abs);
  return {buf, ext: path.extname(file).slice(1)};
}

export function createBrandFile(file, input) {
  if (fs.existsSync(file)) throw new BrandError('这个客户已经有品牌档案。要改请用 update，不要覆盖');
  assertOutsideRepo(file);
  if (typeof input.client !== 'string' || !ID_RE.test(input.client)) throw new BrandError('客户 id 只能用小写字母、数字和短横线，并以字母或数字开头');
  const dir = path.dirname(file);
  fs.mkdirSync(dir, {recursive: true});
  const logo = readAsset(input.logoPath);
  const logoRef = writeVersioned(dir, 'logo', 1, logo);
  let qr = null;
  if (input.qrPath) qr = writeVersioned(dir, 'qr', 1, readAsset(input.qrPath));
  const record = {
    client: input.client,
    version: 1,
    firm: limited(input.firm, '律所全称', 40),
    english: input.english ? limited(input.english, '英文名', 80) : '',
    column: limited(input.column, '栏目名', 20),
    logo: logoRef,
    primary: normalizeHex(input.primary, '主色'),
    secondary: input.secondary ? normalizeHex(input.secondary, '辅色') : null,
    lawyers: (input.lawyers ?? []).map(normalizeLawyer),
    qr,
    tip: input.tip ? limited(input.tip, '片尾提示语', 40) : DEFAULT_TIP,
    createdAt: input.now,
    updatedAt: input.now,
    history: [],
  };
  try {
    return writeBrand(file, record);
  } catch (error) {
    fs.rmSync(dir, {recursive: true, force: true});
    throw error;
  }
}

export function updateBrandFile(file, patch, now) {
  const record = readBrand(file);
  const dir = path.dirname(file);
  const next = structuredClone(record);
  let changed = false;
  if (patch.firm !== undefined && patch.firm !== record.firm) { next.firm = limited(patch.firm, '律所全称', 40); changed = true; }
  if (patch.clearEnglish) {
    if (record.english) { next.english = ''; changed = true; }
  } else if (patch.english !== undefined && patch.english !== record.english) {
    next.english = patch.english ? limited(patch.english, '英文名', 80) : '';
    changed = true;
  }
  if (patch.column !== undefined && patch.column !== record.column) { next.column = limited(patch.column, '栏目名', 20); changed = true; }
  if (patch.primary !== undefined) {
    const primary = normalizeHex(patch.primary, '主色');
    if (primary !== record.primary) { next.primary = primary; changed = true; }
  }
  if (patch.clearSecondary) {
    if (record.secondary) { next.secondary = null; changed = true; }
  } else if (patch.secondary !== undefined) {
    const secondary = patch.secondary ? normalizeHex(patch.secondary, '辅色') : null;
    if (secondary !== record.secondary) { next.secondary = secondary; changed = true; }
  }
  if (patch.tip !== undefined && patch.tip !== record.tip) { next.tip = limited(patch.tip, '片尾提示语', 40); changed = true; }
  if (patch.lawyers) {
    const lawyers = patch.lawyers.map(normalizeLawyer);
    if (JSON.stringify(lawyers) !== JSON.stringify(record.lawyers)) { next.lawyers = lawyers; changed = true; }
  }
  const logoChanged = Boolean(patch.logoPath);
  const qrChanged = Boolean(patch.qrPath) || patch.clearQr === true;
  if (!changed && !logoChanged && !qrChanged) throw new BrandError('没有要改的内容');
  next.history.push(snapshot(record));
  next.version = record.version + 1;
  next.updatedAt = now;
  const logo = logoChanged ? readAsset(patch.logoPath) : existingAsset(dir, record.logo.file);
  next.logo = writeVersioned(dir, 'logo', next.version, logo);
  if (patch.clearQr) next.qr = null;
  else if (patch.qrPath) next.qr = writeVersioned(dir, 'qr', next.version, readAsset(patch.qrPath));
  else if (record.qr) next.qr = writeVersioned(dir, 'qr', next.version, existingAsset(dir, record.qr.file));
  return writeBrand(file, next);
}

export function resolveBrandVersion(record, version) {
  const current = {
    version: record.version,
    firm: record.firm,
    english: record.english,
    column: record.column,
    logo: record.logo,
    primary: record.primary,
    secondary: record.secondary,
    lawyers: record.lawyers,
    qr: record.qr,
    tip: record.tip,
    updatedAt: record.updatedAt,
    pinned: version != null,
  };
  if (version == null || version === record.version) return current;
  const old = record.history.find((item) => item.version === version);
  if (!old) {
    const known = [...record.history.map((item) => item.version), record.version].sort((a, b) => a - b).join('、');
    throw new BrandError(`品牌 ${record.client} 没有版本 ${version}。现有版本：${known}`);
  }
  return {...old, pinned: true};
}

export function locateBrand(ref, dataDir) {
  const parsed = parseBrandRef(ref);
  if (!parsed) throw new BrandError(brandRefProblem(ref) || '品牌引用不对');
  return {file: brandFile(dataDir, parsed.client), client: parsed.client, version: parsed.version};
}

function loadAsset(dir, asset, label) {
  const abs = path.join(dir, asset.file);
  if (!fs.existsSync(abs)) throw new BrandError(`${label} ${asset.file} 不在档案目录里`);
  const buf = fs.readFileSync(abs);
  const sha256 = sha256Of(buf);
  if (sha256 !== asset.sha256) throw new BrandError(`${label} 文件和档案里的 sha256 对不上`);
  return {path: abs, sha256};
}

/** 讲稿写成字符串客户id[@版本] 时才启用。对象形式的旧 brand 不在这里处理。 */
export function bindLessonBrand(lesson, {dataDir} = {}) {
  const ref = lesson?.meta?.brand;
  if (typeof ref !== 'string') return null;
  const located = locateBrand(ref, dataDir);
  const record = readBrand(located.file);
  const view = resolveBrandVersion(record, located.version);
  const dir = path.dirname(located.file);
  const logo = loadAsset(dir, view.logo, 'logo');
  const qr = view.qr ? loadAsset(dir, view.qr, '二维码') : null;
  let lawyer;
  try { lawyer = resolveLawyer(view.lawyers, lesson?.meta?.lawyer); }
  catch (error) { throw new BrandError(error.message); }
  return {
    id: `${record.client}@${view.version}`,
    client: record.client,
    version: view.version,
    pinned: view.pinned,
    view,
    lawyer,
    logoPath: logo.path,
    logoSha256: logo.sha256,
    qrPath: qr?.path ?? null,
    qrSha256: qr?.sha256 ?? null,
  };
}
