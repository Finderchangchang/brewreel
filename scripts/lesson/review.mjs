import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// 不影响观众所见所闻的内部字段。pose / reveal 是动作和时间轴参数，imageData 是校验器塞进去的派生数据。
const SKIP_KEYS = new Set(['pose', 'reveal', 'imageData', 'logoData']);
const PLACEHOLDERS = new Set([
  '无', '没有', '暂无', '未知', '不详', '未提供', '无证', '无证号', '未填',
  '测试', '测试证号', '测试号', '内部测试', '内部样片', '样片',
  'none', 'null', 'nil', 'na', 'n/a', 'n.a.', 'unknown', 'test', 'testing', 'xxx', 'todo', 'tbd', 'sample', 'demo',
  '-', '--', '---', '—', '－', '/', '／', '0', '00', '000',
]);

const normalize = (value) => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();

export function isPlaceholderLicense(value) {
  const raw = normalize(value).toLowerCase().replace(/\s+/gu, '');
  if (!raw) return true;
  if (PLACEHOLDERS.has(raw)) return true;
  return /^[-—－_./／。]+$/u.test(raw);
}

function isImageField(key, value) {
  if (typeof value !== 'string') return false;
  if (key === 'image' || key === 'imagePath' || key === 'logo') return true;
  return (key === 'src' || key === 'file') && /\.(png|jpe?g|webp|gif|svg)$/iu.test(value.trim());
}

function resolveImage(raw, baseDir) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const candidates = path.isAbsolute(text)
    ? [text]
    : [baseDir ? path.resolve(baseDir, text) : null, path.resolve(ROOT, text), path.resolve(process.cwd(), text)].filter(Boolean);
  return candidates.find((candidate) => {
    try { return fs.existsSync(candidate) && fs.statSync(candidate).isFile(); }
    catch { return false; }
  }) ?? null;
}

function fileDigest(raw, baseDir) {
  const abs = resolveImage(raw, baseDir);
  if (!abs) return `missing:${normalize(raw)}`;
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

// 按固定顺序收集观众能看到、听到的字符串；数字和布尔值也计入（答案序号、是否开放题会改变画面）。
function walk(value, keyPath, keyName, lines, baseDir) {
  if (value == null) return;
  if (typeof value === 'string') {
    if (isImageField(keyName, value)) {
      lines.push(`${keyPath}=file:${fileDigest(value, baseDir)}`);
      return;
    }
    const text = normalize(value);
    if (text) lines.push(`${keyPath}=${text}`);
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    lines.push(`${keyPath}=${String(value)}`);
    return;
  }
  if (typeof value === 'boolean') {
    lines.push(`${keyPath}=${value ? 'true' : 'false'}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${keyPath}[${index}]`, keyName, lines, baseDir));
    return;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value).sort()) {
      if (SKIP_KEYS.has(key)) continue;
      walk(value[key], keyPath ? `${keyPath}.${key}` : key, key, lines, baseDir);
    }
  }
}

export function cardTexts(page, baseDir) {
  const lines = [];
  if (!page || typeof page !== 'object') return lines;
  const copy = {...page};
  delete copy.narration;
  walk(copy, 'page', 'page', lines, baseDir);
  return lines.map((line) => line.replace(/^page\./u, ''));
}

export function reviewText(lesson, baseDir) {
  const lines = [];
  const meta = lesson?.meta ?? {};
  walk(meta.title, 'meta.title', 'title', lines, baseDir);
  walk(meta.sources, 'meta.sources', 'sources', lines, baseDir);
  walk(meta.facts, 'meta.facts', 'facts', lines, baseDir);
  walk(meta.disclaimer, 'meta.disclaimer', 'disclaimer', lines, baseDir);
  (lesson?.chapters ?? []).forEach((chapter, ci) => {
    const chapterPath = `chapters[${ci}]`;
    for (const key of Object.keys(chapter ?? {}).sort()) {
      if (key === 'pages') continue;
      walk(chapter[key], `${chapterPath}.${key}`, key, lines, baseDir);
    }
    (chapter?.pages ?? []).forEach((page, pi) => walk(page, `${chapterPath}.pages[${pi}]`, 'page', lines, baseDir));
  });
  return lines.join('\n');
}

export function reviewHash(lesson, baseDir) {
  return crypto.createHash('sha256').update(reviewText(lesson, baseDir), 'utf8').digest('hex');
}

export function reviewRecordPath(lessonPath) {
  const abs = path.resolve(lessonPath);
  return path.join(path.dirname(abs), `${path.basename(abs)}.review.json`);
}

export function legacyReviewPath(lessonPath) {
  return path.join(path.dirname(path.resolve(lessonPath)), 'review.json');
}

export function reviewSnapshot(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const {history: _history, ...rest} = record;
  return rest;
}

export function splitReviewFile(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (typeof parsed.script_sha256 !== 'string') return null;
  const history = Array.isArray(parsed.history) ? parsed.history.map(reviewSnapshot).filter(Boolean) : [];
  return {current: reviewSnapshot(parsed), history};
}

function readJson(file) {
  try { return {ok: true, value: JSON.parse(fs.readFileSync(file, 'utf8'))}; }
  catch { return {ok: false}; }
}

export function checkReview(lesson, lessonPath) {
  const baseDir = path.dirname(path.resolve(lessonPath));
  const hash = reviewHash(lesson, baseDir);
  const named = reviewRecordPath(lessonPath);
  const legacy = legacyReviewPath(lessonPath);
  const fail = (file, reason) => ({ok: false, test: false, reason, path: file, hash});
  let file = named;
  let raw;
  if (fs.existsSync(named)) {
    const loaded = readJson(named);
    if (!loaded.ok) return fail(named, `${path.basename(named)} 无法解析`);
    raw = loaded.value;
  } else if (fs.existsSync(legacy)) {
    const loaded = readJson(legacy);
    if (!loaded.ok) return fail(legacy, 'review.json 无法解析');
    const legacySplit = splitReviewFile(loaded.value);
    if (!legacySplit || legacySplit.current.script_sha256 !== hash) {
      return fail(named, `缺少 ${path.basename(named)}（同目录 review.json 的哈希对不上这份讲稿）`);
    }
    file = legacy;
    raw = loaded.value;
  } else {
    return fail(named, `缺少 ${path.basename(named)}`);
  }
  const split = splitReviewFile(raw);
  if (!split) return fail(file, '审稿记录无法读取');
  const review = split.current;
  const test = review.test === true;
  const missing = ['reviewer', 'license_no', 'reviewed_at'].filter((key) => typeof review[key] !== 'string' || !review[key].trim());
  if (missing.length) return fail(file, `审稿信息缺少 ${missing.join('、')}`);
  if (!test && isPlaceholderLicense(review.license_no)) return fail(file, '执业证号无效，不算律师审稿');
  if (review.decision !== 'approved') return fail(file, '审稿 decision 不是 approved');
  if (review.script_sha256 !== hash) return fail(file, '审稿哈希与当前讲稿不一致');
  return {ok: true, test, path: file, hash, review};
}

export function frameTimeMs(filename) {
  const match = /(\d+(?:\.\d+)?)s\.(?:png|jpe?g|webp)$/iu.exec(path.basename(filename));
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

// 一张页配一张帧：落在该页起止时间内、最靠近页尾（内容最完整）的那张。对不上时间轴的帧不配给任何页。
export function assignFramesToPages(filenames, pages) {
  const chosen = pages.map(() => null);
  const distance = pages.map(() => Infinity);
  for (const name of filenames) {
    const ms = frameTimeMs(name);
    if (ms == null) continue;
    const index = pages.findIndex((page, i) => {
      const start = Number(page.startMs);
      const end = Number(page.endMs);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      if (ms < start - 0.5) return false;
      return i === pages.length - 1 ? ms <= end + 0.5 : ms < end;
    });
    if (index < 0) continue;
    const fromEnd = Number(pages[index].endMs) - ms;
    if (fromEnd < distance[index]) {
      distance[index] = fromEnd;
      chosen[index] = name;
    }
  }
  return chosen;
}
