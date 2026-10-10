// 角色档案放在仓库外的数据目录。改形象升版本，旧版本留在 history，已出的片子钉住旧版本。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PRESETS} from '../../template/src/lesson/mascot/cast.mjs';
import {lookFieldErrors} from './validate-lesson.mjs';
import {STYLE_IDS} from './style-rules.mjs';
import {ID_RE, parseCharacterRef} from './character-ref.mjs';
import {isInsideRepo, resolveDataDir} from './paths.mjs';

export {resolveDataDir};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOOK_KEYS = ['preset', 'hair', 'accessory', 'facialHair', 'outfit', 'skin'];
const SOURCES = new Set(['photo', 'preset', 'custom']);
const SOURCE_LABEL = {photo: '照片建角色', preset: '预设形象', custom: '手改形象'};
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export class CharacterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CharacterError';
  }
}

export function assertOutsideRepo(file, root = ROOT) {
  if (isInsideRepo(file, root)) {
    throw new CharacterError('角色档案不能放在仓库里。数据目录要在仓库外面，默认是当前工作目录上一级的 brewreel-data');
  }
}

export function characterFile(dataDir, client, id) {
  return path.join(dataDir, 'characters', client, id, 'character.json');
}

export function lookFromPreset(name) {
  if (name !== 'male' && name !== 'female') throw new CharacterError('预设只能是 male 或 female');
  const preset = PRESETS[name];
  return {preset: name, hair: preset.hair, accessory: preset.accessory, facialHair: preset.facialHair, outfit: preset.outfit};
}

export function normalizeLook(look) {
  if (!look || typeof look !== 'object' || Array.isArray(look)) return look;
  const out = {};
  for (const key of LOOK_KEYS) if (look[key] !== undefined) out[key] = look[key];
  return out;
}

function lookKey(look) {
  return JSON.stringify(normalizeLook(look) ?? null);
}

function isIso(value) {
  return typeof value === 'string' && ISO_RE.test(value);
}

function consentErrors(consent, where, err) {
  if (!consent || typeof consent !== 'object' || Array.isArray(consent)) {
    err(where, '必须是对象，包含 source、grantedBy、grantedAt、scope');
    return;
  }
  if (!SOURCES.has(consent.source)) err(`${where}.source`, '必须是 photo、preset 或 custom');
  if (consent.source === 'photo') {
    if (typeof consent.photoFile !== 'string' || !/^photo\.(png|jpe?g|gif|webp)$/i.test(consent.photoFile)) {
      err(`${where}.photoFile`, '照片建角色必须记录照片文件名，例如 photo.png。不要写路径');
    }
  } else if (consent.photoFile !== undefined) {
    err(`${where}.photoFile`, '预设和手改形象不记录照片');
  }
  if (typeof consent.grantedBy !== 'string' || !consent.grantedBy.trim()) {
    err(`${where}.grantedBy`, consent.source === 'photo' ? '照片建角色必须填写授权人' : '必须填写授权人；没有照片时写明未使用客户照片');
  } else if (Array.from(consent.grantedBy).length > 40) err(`${where}.grantedBy`, '最多 40 个字');
  if (!isIso(consent.grantedAt)) err(`${where}.grantedAt`, '必须是 ISO 时间，例如 2026-10-02T00:00:00.000Z');
  if (typeof consent.scope !== 'string' || !consent.scope.trim()) err(`${where}.scope`, '必须写明授权范围');
  else if (Array.from(consent.scope).length > 120) err(`${where}.scope`, '最多 120 个字');
}

export function validateCharacter(data) {
  const errors = [];
  const err = (at, problem) => errors.push(`${at}：${problem}`);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['角色档案必须是对象'];
  if (typeof data.id !== 'string' || !ID_RE.test(data.id)) err('id', '必须是小写字母、数字和短横线，并以字母或数字开头，最长 41 个字符');
  if (typeof data.client !== 'string' || !ID_RE.test(data.client)) err('client', '必须是小写字母、数字和短横线，并以字母或数字开头，最长 41 个字符');
  if (typeof data.name !== 'string' || !data.name.trim()) err('name', '必须是非空字符串');
  else if (Array.from(data.name).length > 40) err('name', '最多 40 个字');
  if (!Number.isInteger(data.version) || data.version < 1) err('version', '必须是从 1 开始的整数');
  if (!STYLE_IDS.includes(data.defaultTheme)) err('defaultTheme', `必须是 ${STYLE_IDS.join('、')}`);
  for (const problem of lookFieldErrors(data.look, 'look')) errors.push(problem);
  consentErrors(data.consent, 'consent', err);
  if (data.approvedAt !== null && !isIso(data.approvedAt)) err('approvedAt', '客户还没确认时写 null，确认后写 ISO 时间');
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
      if (typeof item.name !== 'string' || !item.name.trim()) err(`${at}.name`, '必须是非空字符串');
      for (const problem of lookFieldErrors(item.look, `${at}.look`)) errors.push(problem);
      if (!STYLE_IDS.includes(item.defaultTheme)) err(`${at}.defaultTheme`, `必须是 ${STYLE_IDS.join('、')}`);
      if (item.approvedAt !== null && !isIso(item.approvedAt)) err(`${at}.approvedAt`, '必须是 ISO 时间或 null');
      if (!isIso(item.updatedAt)) err(`${at}.updatedAt`, '必须是 ISO 时间');
      consentErrors(item.consent, `${at}.consent`, err);
    });
  }
  return errors;
}

export function readCharacter(file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new CharacterError(`找不到角色档案：${path.basename(path.dirname(file))}`);
    throw new CharacterError('角色档案不是合法的 JSON');
  }
  const errors = validateCharacter(data);
  if (errors.length) throw new CharacterError(`角色档案不合格：\n${errors.map((item) => `  ${item}`).join('\n')}`);
  return data;
}

export function writeCharacter(file, record) {
  assertOutsideRepo(file);
  const errors = validateCharacter(record);
  if (errors.length) throw new CharacterError(`角色档案不合格：\n${errors.map((item) => `  ${item}`).join('\n')}`);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return record;
}

function defaultGrantedBy(source, consentBy) {
  const given = String(consentBy ?? '').trim();
  if (given) return given;
  if (source === 'photo') throw new CharacterError('照片建角色必须填写授权人（--consent-by）。没有授权人不能创建。');
  if (source === 'preset') return '（预设形象，无客户照片）';
  return '（手改形象，无客户照片）';
}

function defaultScope(source) {
  if (source === 'photo') return '授权使用这张照片识别发型、眼镜、胡子和肤色，生成卡通讲解员，用于该客户的讲课视频。肤色只记录，这一版画面不使用';
  if (source === 'preset') return '使用预设卡通形象，未使用客户照片';
  return '使用手改的卡通形象，未使用客户照片';
}

function consentOf({source, consentBy, photoFile, scope, now}) {
  const consent = {
    source,
    grantedBy: defaultGrantedBy(source, consentBy),
    grantedAt: now,
    scope: scope?.trim() || defaultScope(source),
  };
  if (source === 'photo') consent.photoFile = photoFile;
  return consent;
}

export function createRecord({client, id, name, look, theme = 'lecture', source, consentBy, photoFile, scope, now}) {
  if (source === 'photo' && !String(consentBy ?? '').trim()) {
    throw new CharacterError('照片建角色必须填写授权人（--consent-by）。没有授权人不能创建。');
  }
  const record = {
    id,
    name: String(name ?? '').trim(),
    client,
    version: 1,
    look: normalizeLook(look),
    defaultTheme: theme,
    consent: consentOf({source, consentBy, photoFile, scope, now}),
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
    history: [],
  };
  const errors = validateCharacter(record);
  if (errors.length) throw new CharacterError(`角色档案不合格：\n${errors.map((item) => `  ${item}`).join('\n')}`);
  return record;
}

export function createCharacterFile(file, input) {
  if (fs.existsSync(file)) throw new CharacterError('这个角色已经有档案。要改形象请用 update，不要覆盖');
  return writeCharacter(file, createRecord(input));
}

export function updateCharacter(record, patch, now) {
  const next = structuredClone(record);
  const nextLook = patch.look ? normalizeLook(patch.look) : null;
  const lookChanged = Boolean(nextLook) && lookKey(nextLook) !== lookKey(record.look);
  const nameChanged = patch.name !== undefined && String(patch.name).trim() !== record.name;
  const themeChanged = patch.theme !== undefined && patch.theme !== record.defaultTheme;
  const consentPatch = patch.consent;
  const consentChanged = Boolean(consentPatch) && Object.keys(consentPatch).length > 0;
  if (!lookChanged && !nameChanged && !themeChanged && !consentChanged) {
    throw new CharacterError('没有要改的内容');
  }
  if (lookChanged || nameChanged || themeChanged) {
    next.history.push({
      version: record.version,
      name: record.name,
      look: structuredClone(record.look),
      defaultTheme: record.defaultTheme,
      approvedAt: record.approvedAt,
      updatedAt: record.updatedAt,
      consent: structuredClone(record.consent),
    });
    next.version = record.version + 1;
    next.approvedAt = null;
  }
  if (nextLook) next.look = nextLook;
  if (nameChanged) next.name = String(patch.name).trim();
  if (themeChanged) next.defaultTheme = patch.theme;
  if (consentPatch) {
    next.consent = {...next.consent, ...consentPatch};
    if (next.consent.photoFile == null) delete next.consent.photoFile;
  }
  next.updatedAt = now;
  const errors = validateCharacter(next);
  if (errors.length) throw new CharacterError(`角色档案不合格：\n${errors.map((item) => `  ${item}`).join('\n')}`);
  return next;
}

export function approveCharacter(record, now) {
  if (record.approvedAt) return {record, already: true};
  const next = structuredClone(record);
  next.approvedAt = now;
  next.updatedAt = now;
  const errors = validateCharacter(next);
  if (errors.length) throw new CharacterError(`角色档案不合格：\n${errors.map((item) => `  ${item}`).join('\n')}`);
  return {record: next, already: false};
}

export function resolveCharacterVersion(record, version) {
  if (version == null) {
    return {
      version: record.version,
      name: record.name,
      look: record.look,
      defaultTheme: record.defaultTheme,
      approvedAt: record.approvedAt,
      consent: record.consent,
      pinned: false,
    };
  }
  if (version === record.version) {
    return {
      version: record.version,
      name: record.name,
      look: record.look,
      defaultTheme: record.defaultTheme,
      approvedAt: record.approvedAt,
      consent: record.consent,
      pinned: true,
    };
  }
  const old = record.history.find((item) => item.version === version);
  if (!old) {
    const known = [...record.history.map((item) => item.version), record.version].sort((a, b) => a - b).join('、');
    throw new CharacterError(`角色 ${record.client}/${record.id} 没有版本 ${version}。现有版本：${known}`);
  }
  return {
    version: old.version,
    name: old.name,
    look: old.look,
    defaultTheme: old.defaultTheme,
    approvedAt: old.approvedAt,
    consent: old.consent,
    pinned: true,
  };
}

export function consentSummary(consent) {
  const source = SOURCE_LABEL[consent.source] || consent.source;
  const photo = consent.photoFile ? `，照片文件 ${consent.photoFile}` : '';
  return `${source}${photo}；授权人 ${consent.grantedBy}；授权时间 ${consent.grantedAt}；范围：${consent.scope}`;
}

export function characterManifestEntry(record, resolved) {
  const consent = resolved.consent ?? record.consent;
  return {
    id: `${record.client}/${record.id}`,
    version: resolved.version,
    approvedAt: resolved.approvedAt,
    consent: {
      source: consent.source,
      grantedBy: consent.grantedBy,
      grantedAt: consent.grantedAt,
      scope: consent.scope,
      photoFile: consent.photoFile ?? null,
      summary: consentSummary(consent),
    },
  };
}

export function assertReady(record, resolved, draft) {
  if (resolved.approvedAt) return {ok: true, watermark: false, message: ''};
  const who = `${record.client}/${record.id}@${resolved.version}`;
  if (draft) return {ok: true, watermark: true, message: ''};
  return {
    ok: false,
    watermark: false,
    message: `角色 ${who} 还没有客户确认，不能正式出片。请先运行 character.mjs card 出角色卡给客户确认，确认后运行 character.mjs approve。试看出片可以加 --draft，画面会加上「角色未确认」。`,
  };
}

export function locateCharacter(arg, dataDir) {
  const text = String(arg ?? '').trim();
  const ref = parseCharacterRef(text.replaceAll('\\', '/'));
  if (ref) {
    if (ref.version != null) {
      throw new CharacterError('角色卡、确认和修改都针对当前版本。不要在路径里写 @版本；版本写在 lesson.json 的 meta.presenter.character 里');
    }
    return characterFile(dataDir, ref.client, ref.id);
  }
  const resolved = path.resolve(text);
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    return stat.isDirectory() ? path.join(resolved, 'character.json') : resolved;
  }
  throw new CharacterError('找不到角色。请写 客户id/角色id，或 character.json 的路径');
}

export function bindLessonCharacter(lesson, {dataDir, draft = false} = {}) {
  const refText = lesson?.meta?.presenter?.character;
  if (refText == null || refText === '') return null;
  const ref = parseCharacterRef(refText);
  if (!ref) throw new CharacterError(`meta.presenter.character：${refText}`);
  const file = characterFile(dataDir, ref.client, ref.id);
  if (!fs.existsSync(file)) {
    throw new CharacterError(`找不到角色档案 ${ref.client}/${ref.id}。请先建角色，再出角色卡给客户确认`);
  }
  const record = readCharacter(file);
  const resolved = resolveCharacterVersion(record, ref.version);
  const gate = assertReady(record, resolved, draft);
  if (!gate.ok) throw new CharacterError(gate.message);
  return {
    watermark: gate.watermark,
    manifest: characterManifestEntry(record, resolved),
    look: resolved.look,
    file,
  };
}
