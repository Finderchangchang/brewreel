#!/usr/bin/env node
// 建角色、出角色卡、客户确认、改形象升版本。档案在仓库外。
import fs from 'node:fs';
import path from 'node:path';
import {STYLE_IDS} from './style-rules.mjs';
import {ID_RE} from './character-ref.mjs';
import {
  CharacterError,
  approveCharacter,
  characterFile,
  createCharacterFile,
  locateCharacter,
  lookFromPreset,
  readCharacter,
  resolveDataDir,
  updateCharacter,
  writeCharacter,
} from './character-store.mjs';
import {lookFieldErrors} from './validate-lesson.mjs';
import {writeCardMp4, writeCardPng} from './character-card.mjs';
import {
  LIKENESS_LIMIT,
  callVision,
  coerceLook,
  parseModelJson,
  readPhoto,
  redact,
  resolveVisionEndpoint,
} from './presenter-vision.mjs';

const FLAGS = new Set(['--client', '--name', '--id', '--preset', '--look', '--photo', '--consent-by', '--theme', '--data-dir', '--scope', '--out', '--mock', '--model', '--base-url']);
const USAGE = `用法：
  node scripts/lesson/character.mjs create --client <客户id> --name <名字> [--id <角色id>] (--preset male|female | --look <look.json> | --photo <照片>) [--consent-by <授权人>] [--theme paper|lecture|product|editorial] [--data-dir <目录>]
  node scripts/lesson/character.mjs card <客户id/角色id> --out <目录> [--data-dir <目录>]
  node scripts/lesson/character.mjs approve <客户id/角色id> [--data-dir <目录>]
  node scripts/lesson/character.mjs update <客户id/角色id> [--name <名字>] [--preset male|female | --look <look.json> | --photo <照片>] [--theme ...] [--consent-by <授权人>] [--data-dir <目录>]
照片建角色必须写 --consent-by。数据目录默认是仓库外的 brewreel-data，也可用环境变量 LESSON_DATA_DIR。`;

function parseArgs(argv) {
  const opts = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new CharacterError(`${arg} 后面要跟值`);
      opts[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new CharacterError(`不认识的参数 ${arg}`);
    } else positionals.push(arg);
  }
  return {opts, positionals};
}

function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redact(message, [process.env.MINIMAX_API_KEY, process.env.VISION_API_KEY]));
  process.exit(error instanceof CharacterError && /用法|不认识的参数|后面要跟值/.test(message) ? 2 : 1);
}

function themeOf(value) {
  if (!value) return 'lecture';
  if (!STYLE_IDS.includes(value)) throw new CharacterError(`默认风格必须是 ${STYLE_IDS.join('、')}`);
  return value;
}

function idOf(value, label) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw new CharacterError(`${label}只能用小写字母、数字和短横线，并以字母或数字开头`);
  }
  return value;
}

function readLook(file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/u, ''));
  } catch {
    throw new CharacterError(`看不懂形象文件 ${path.basename(file)}`);
  }
  const look = data?.look && typeof data.look === 'object' && !Array.isArray(data.look) ? data.look : data;
  const errors = lookFieldErrors(look, 'look');
  if (errors.length) throw new CharacterError(errors.join('\n'));
  return look;
}

async function lookFromPhoto(photoPath, opts) {
  console.log(LIKENESS_LIMIT);
  const photo = readPhoto(path.resolve(photoPath));
  let raw;
  if (opts.mock) {
    console.log('使用本地 mock 回放，照片不会离开这台电脑。');
    raw = JSON.parse(fs.readFileSync(path.resolve(opts.mock), 'utf8').replace(/^\uFEFF/u, ''));
  } else {
    const endpoint = resolveVisionEndpoint({env: process.env, baseArg: opts['base-url'], modelArg: opts.model});
    console.log(`照片会发送给 ${endpoint.host} 做识别`);
    raw = await callVision({endpoint, dataUrl: photo.dataUrl});
  }
  const {look, notes} = coerceLook(parseModelJson(raw));
  const secretKeys = [process.env.MINIMAX_API_KEY, process.env.VISION_API_KEY];
  for (const note of notes) console.log(redact(note, secretKeys));
  return {look, photo};
}

function photoName(photo) {
  const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' }[photo.mime];
  if (!ext) throw new CharacterError('照片必须是 JPEG、PNG、GIF 或 WEBP');
  return `photo${ext}`;
}

function copyPhoto(dir, photo, name) {
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, name), Buffer.from(photo.base64, 'base64'));
}

function removePhoto(dir, name) {
  if (!name || !/^photo\.(png|jpe?g|gif|webp)$/i.test(name)) return;
  fs.rmSync(path.join(dir, name), {force: true});
}

async function buildLook(opts, {requireOne}) {
  const picked = [opts.preset, opts.look, opts.photo].filter(Boolean);
  if (picked.length > 1) throw new CharacterError('预设、形象文件、照片只能选一种');
  if (requireOne && picked.length !== 1) throw new CharacterError('请选一种建法：--preset male|female、--look <look.json>，或 --photo <照片>');
  if (opts.photo && !String(opts['consent-by'] ?? '').trim()) {
    throw new CharacterError('照片建角色必须填写授权人（--consent-by）。没有授权人不能创建。');
  }
  if (opts.preset) return {look: lookFromPreset(opts.preset), source: 'preset', photo: null};
  if (opts.look) return {look: readLook(opts.look), source: 'custom', photo: null};
  if (opts.photo) {
    const result = await lookFromPhoto(opts.photo, opts);
    return {look: result.look, source: 'photo', photo: result.photo};
  }
  return null;
}

async function main() {
  const {opts, positionals} = parseArgs(process.argv.slice(2));
  const command = positionals[0];
  if (!command || !['create', 'card', 'approve', 'update'].includes(command)) {
    console.error(USAGE);
    process.exit(2);
  }
  const dataDir = resolveDataDir(opts['data-dir']);
  const now = new Date().toISOString();

  if (command === 'create') {
    if (!opts.client || !opts.name) throw new CharacterError('create 需要 --client 和 --name');
    const client = idOf(opts.client, '客户 id ');
    const idSource = opts.id || (ID_RE.test(opts.name) ? opts.name : '');
    if (!idSource) throw new CharacterError('请用 --id 指定角色 id。名字可以是中文，id 只用小写字母、数字和短横线');
    const id = idOf(idSource, '角色 id ');
    const built = await buildLook(opts, {requireOne: true});
    const file = characterFile(dataDir, client, id);
    let photoFile;
    if (built.photo) {
      photoFile = photoName(built.photo);
      copyPhoto(path.dirname(file), built.photo, photoFile);
    }
    try {
      const record = createCharacterFile(file, {
        client,
        id,
        name: opts.name,
        look: built.look,
        theme: themeOf(opts.theme),
        source: built.source,
        consentBy: opts['consent-by'],
        photoFile,
        scope: opts.scope,
        now,
      });
      console.log(`已建立 ${record.client}/${record.id} 版本 ${record.version}`);
      console.log('下一步：出角色卡给客户确认。确认前不能正式出片。');
      return;
    } catch (error) {
      if (photoFile) removePhoto(path.dirname(file), photoFile);
      throw error;
    }
  }

  const target = positionals[1];
  if (!target) throw new CharacterError(`${command} 需要角色路径，例如 demo/host`);
  const file = locateCharacter(target, dataDir);
  const record = readCharacter(file);

  if (command === 'approve') {
    const result = approveCharacter(record, now);
    if (result.already) {
      console.log(`${record.client}/${record.id}@${record.version} 已于 ${record.approvedAt} 确认`);
      return;
    }
    writeCharacter(file, result.record);
    console.log(`已确认 ${result.record.client}/${result.record.id}@${result.record.version}`);
    return;
  }

  if (command === 'card') {
    if (!opts.out) throw new CharacterError('card 需要 --out <目录>');
    const outDir = path.resolve(opts.out);
    const pngPath = path.join(outDir, 'card.png');
    const mp4Path = path.join(outDir, 'card.mp4');
    writeCardPng({record, pngPath});
    await writeCardMp4({record, mp4Path});
    console.log(`角色卡 ${record.client}/${record.id}@${record.version}`);
    console.log('card.png');
    console.log('card.mp4');
    if (!record.approvedAt) console.log('客户确认后请运行 approve。没确认不能正式出片。');
    return;
  }

  const built = await buildLook(opts, {requireOne: false});
  const patch = {};
  if (opts.name) patch.name = opts.name;
  if (opts.theme) patch.theme = themeOf(opts.theme);
  if (built) patch.look = built.look;
  const consent = {};
  if (built) {
    consent.source = built.source;
    if (built.source === 'photo') {
      consent.photoFile = photoName(built.photo);
      consent.grantedBy = String(opts['consent-by']).trim();
      consent.grantedAt = now;
    } else {
      consent.photoFile = null;
      if (opts['consent-by']) consent.grantedBy = opts['consent-by'];
    }
  } else if (opts['consent-by']) {
    consent.grantedBy = opts['consent-by'];
    consent.grantedAt = now;
  }
  if (opts.scope) consent.scope = opts.scope;
  else if (built?.source === 'photo') consent.scope = '授权使用这张照片识别发型、眼镜、胡子和肤色，生成卡通讲解员，用于该客户的讲课视频。肤色只记录，这一版画面不使用';
  else if (built?.source === 'preset') consent.scope = '使用预设卡通形象，未使用客户照片';
  else if (built?.source === 'custom') consent.scope = '使用手改的卡通形象，未使用客户照片';
  if (Object.keys(consent).length) patch.consent = consent;
  const next = updateCharacter(record, patch, now);
  const dir = path.dirname(file);
  if (built?.source === 'photo') copyPhoto(dir, built.photo, consent.photoFile);
  if (built && built.source !== 'photo') removePhoto(dir, record.consent.photoFile);
  if (built?.source === 'photo' && record.consent.photoFile && record.consent.photoFile !== consent.photoFile) {
    removePhoto(dir, record.consent.photoFile);
  }
  writeCharacter(file, next);
  if (next.version !== record.version) {
    console.log(`已更新到版本 ${next.version}。旧版本 ${record.version} 留在档案里。需要重新出角色卡，并让客户确认。`);
  } else {
    console.log(`已更新授权记录，版本仍是 ${next.version}`);
  }
}

main().catch(fail);
