// @ts-check
// Styles, industries, shots and examples, read from the skill's own files (nothing duplicated here),
// plus the guide reader with strict id validation and containment.
import fs from 'node:fs';
import path from 'node:path';
import {isInside, realpathLoose} from './paths.js';

/** @param {string} p */
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
/** @param {string} p */
const listDir = (p) => {
  try {
    return fs.readdirSync(p).sort();
  } catch {
    return [];
  }
};
/** @param {any} v @param {'zh' | 'en'} lang */
const pick = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? v.zh ?? v.en ?? '' : String(v ?? ''));

/** First paragraph of a markdown file that is not a heading, trimmed to `max` characters. */
function firstParagraph(file, max = 200) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  } catch {
    return '';
  }
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l));
    if (!lines.length) continue;
    const s = lines.join(' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    return s.length > max ? `${s.slice(0, max)}…` : s;
  }
  return '';
}

/** @param {string} root */
function commonShots(root) {
  return listDir(path.join(root, 'template', 'src', 'shots'))
    .filter((f) => f.endsWith('.spec.json'))
    .map((f) => f.replace(/\.spec\.json$/, ''));
}

/**
 * @param {string} root skill root
 * @param {{includeDev?: boolean, lang?: 'zh' | 'en'}} [o]
 */
export function listStyles(root, {includeDev = false, lang = 'zh'} = {}) {
  const base = path.join(root, 'template', 'src', 'styles');
  const common = commonShots(root);
  const out = [];
  for (const id of listDir(base)) {
    const file = path.join(base, id, 'style.json');
    if (id.startsWith('_') || !fs.existsSync(file)) continue;
    let s;
    try {
      s = readJson(file);
    } catch {
      continue;
    }
    if (!includeDev && s.status !== 'stable') continue;
    const own = listDir(path.join(base, id, 'shots'))
      .filter((f) => f.endsWith('.spec.json'))
      .map((f) => f.replace(/\.spec\.json$/, ''));
    const shared = s.commonShots === '*' ? common : Array.isArray(s.commonShots) ? s.commonShots : [];
    const exDir = id === 'cards' ? path.join(root, 'examples') : path.join(root, 'styles', id, 'examples');
    const examples = listDir(exDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
    const docDir = path.join(root, 'styles', id);
    const styleDoc = lang === 'en' && fs.existsSync(path.join(docDir, 'STYLE.en.md')) ? 'STYLE.en.md' : 'STYLE.md';
    out.push({
      id,
      name: pick(s.name, lang),
      status: s.status ?? 'unknown',
      fitsFor: pick(s.summary, lang),
      aspects: s.aspects ?? [],
      defaultAspect: s.defaultAspect ?? '9:16',
      ...(Array.isArray(s.themes) ? {themes: s.themes} : {}),
      firstShot: s.firstShot,
      lastShot: s.lastShot,
      ...(s.bpm ? {bpm: s.bpm} : {}),
      shots: [...new Set([...own, ...shared])],
      docs: {style: `styles/${id}/${styleDoc}`, recipes: `styles/${id}/recipes.md`},
      examples: examples.map((e) => (id === 'cards' ? e : `${id}/${e}`)),
    });
  }
  // cards first (default), then the rest alphabetically
  return out.sort((a, b) => (a.id === 'cards' ? -1 : b.id === 'cards' ? 1 : a.id.localeCompare(b.id)));
}

/**
 * @param {string} root
 * @param {'zh' | 'en'} [lang]
 */
export function listIndustries(root, lang = 'zh') {
  const base = path.join(root, 'industries');
  const out = [];
  for (const id of listDir(base)) {
    const file = path.join(base, id, 'rules.json');
    if (id.startsWith('_') || !fs.existsSync(file)) continue;
    let r;
    try {
      r = readJson(file);
    } catch {
      continue;
    }
    const recipe = lang === 'en' && fs.existsSync(path.join(base, id, 'recipe.en.md')) ? 'recipe.en.md' : 'recipe.md';
    const brief = lang === 'en' && fs.existsSync(path.join(base, id, 'brief-template.en.md')) ? 'brief-template.en.md' : 'brief-template.md';
    const summary = lang === 'en' ? firstParagraph(path.join(base, id, recipe)) : String(r.note ?? '') || firstParagraph(path.join(base, id, recipe));
    out.push({
      id,
      name: pick(r.name, lang),
      summary,
      enabledShots: r.enabledShots ?? [],
      coreActionSurface: r.coreAction?.surface ?? null,
      docs: {recipe: `industries/${id}/${recipe}`, briefTemplate: `industries/${id}/${brief}`},
    });
  }
  return out;
}

/** @param {string} root @param {{includeDev?: boolean, lang?: 'zh' | 'en'}} [o] */
export function buildCatalog(root, {includeDev = false, lang = 'zh'} = {}) {
  let cardsThemes = [];
  try {
    cardsThemes = Object.keys(readJson(path.join(root, 'template', 'src', 'core', 'themes.json')));
  } catch {}
  return {
    defaultStyle: 'cards',
    styles: listStyles(root, {includeDev, lang}),
    industries: listIndustries(root, lang),
    cardsThemes,
    languages: ['zh', 'en'],
    howToChoose:
      lang === 'en'
        ? 'Unsure → cards. A common misconception that fits a multiple-choice question → quiz. Lots of content in clear categories → journey (from SKILL step 0).'
        : '拿不准用 cards；有常见误解、能出选择题用 quiz；内容多、类别清楚用 journey（出自 SKILL.md 第 0 步）',
  };
}

// ---------------- guide ----------------

export const GUIDE_TOPICS = ['skill', 'style', 'industry', 'shot', 'example', 'brief-template'];
export const GUIDE_PARTS = ['style', 'recipes', 'readme', 'recipe', 'brief-template', 'test-brief', 'expected', 'rules'];
const ID_RE = /^[a-zA-Z][a-zA-Z0-9-]*$/;

/** Error carrying the list of valid choices for the model. */
export class GuideError extends Error {}

/**
 * Resolve a guide request to one file under the skill root. Ids must match the catalog; the final path
 * is containment-checked against the real skill root.
 * @param {string} root
 * @param {{topic: string, id?: string, part?: string, lang?: 'zh' | 'en'}} q
 * @returns {{rel: string, langServed: 'zh' | 'en', fallback: boolean, related: string[]} | {choices: string[]}}
 */
export function resolveGuide(root, {topic, id, part, lang = 'zh'}) {
  const catalog = buildCatalog(root, {includeDev: true, lang});
  /** @param {string[]} candidates zh first, en second */
  const choose = (candidates) => {
    const [zh, en] = candidates;
    if (lang === 'en' && en && fs.existsSync(path.join(root, en))) return {rel: en, langServed: /** @type {const} */ ('en'), fallback: false};
    return {rel: zh, langServed: /** @type {const} */ ('zh'), fallback: lang === 'en'};
  };
  /** @param {string | undefined} v @param {string[]} valid @param {string} what */
  const need = (v, valid, what) => {
    if (!v) return false;
    if (!ID_RE.test(v) || !valid.includes(v)) throw new GuideError(`unknown ${what} "${v}"; valid: ${valid.join(', ')}`);
    return true;
  };
  switch (topic) {
    case 'skill':
      return {...choose(['SKILL.md', 'SKILL.en.md']), related: ['shots.md']};
    case 'brief-template':
      return {...choose(['brief-template.md', 'brief-template.en.md']), related: catalog.industries.map((i) => i.docs.briefTemplate)};
    case 'style': {
      const ids = catalog.styles.map((s) => s.id);
      if (!need(id, ids, 'style')) return {choices: ids};
      const p = part ?? 'recipes';
      const map = {style: [`styles/${id}/STYLE.md`, `styles/${id}/STYLE.en.md`], recipes: [`styles/${id}/recipes.md`], readme: [`styles/${id}/README.md`], rules: [`styles/${id}/rules.json`]};
      const c = /** @type {Record<string, string[]>} */ (map)[p];
      if (!c) throw new GuideError(`part "${p}" is not valid for a style; use one of: ${Object.keys(map).join(', ')}`);
      const style = catalog.styles.find((s) => s.id === id);
      return {...choose(c), related: (style?.examples ?? []).map((e) => (e.includes('/') ? `styles/${e}.json` : `examples/${e}.json`))};
    }
    case 'industry': {
      const ids = catalog.industries.map((i) => i.id);
      if (!need(id, ids, 'industry')) return {choices: ids};
      const p = part ?? 'recipe';
      const b = `industries/${id}`;
      const map = {recipe: [`${b}/recipe.md`, `${b}/recipe.en.md`], 'brief-template': [`${b}/brief-template.md`, `${b}/brief-template.en.md`], 'test-brief': [`${b}/test-brief.md`], expected: [`${b}/expected.md`], rules: [`${b}/rules.json`]};
      const c = /** @type {Record<string, string[]>} */ (map)[p];
      if (!c) throw new GuideError(`part "${p}" is not valid for an industry; use one of: ${Object.keys(map).join(', ')}`);
      return {...choose(c), related: [`${b}/brief-template.md`]};
    }
    case 'shot': {
      const ids = listDir(path.join(root, 'docs', 'shots')).filter((f) => f.endsWith('.md') && !f.endsWith('.en.md')).map((f) => f.replace(/\.md$/, ''));
      if (!need(id, ids, 'shot')) return {choices: ids};
      return {...choose([`docs/shots/${id}.md`, `docs/shots/${id}.en.md`]), related: []};
    }
    case 'example': {
      const all = catalog.styles.flatMap((s) => s.examples);
      if (!id) return {choices: all};
      const [a, b, ...rest] = id.split('/');
      if (rest.length || !ID_RE.test(a) || (b !== undefined && !ID_RE.test(b)) || !all.includes(id)) {
        throw new GuideError(`unknown example "${id}"; valid: ${all.join(', ')}`);
      }
      return {rel: b === undefined ? `examples/${a}.json` : `styles/${a}/examples/${b}.json`, langServed: 'zh', fallback: false, related: []};
    }
    default:
      throw new GuideError(`unknown topic "${topic}"; use one of: ${GUIDE_TOPICS.join(', ')}`);
  }
}

/**
 * Read one guide file with paging.
 * @param {string} root
 * @param {string} rel
 * @param {{offset?: number, maxChars: number}} o
 */
export function readGuideFile(root, rel, {offset = 0, maxChars}) {
  const realRoot = realpathLoose(root);
  const abs = realpathLoose(path.join(realRoot, rel));
  if (!isInside(abs, realRoot)) throw new GuideError(`refusing to read outside the skill root: ${rel}`);
  if (!fs.existsSync(abs)) throw new GuideError(`not found in this skill version: ${rel}`);
  const text = fs.readFileSync(abs, 'utf8').replace(/^﻿/, '');
  const start = Math.max(0, Math.min(Math.floor(offset), text.length));
  const content = text.slice(start, start + maxChars);
  const end = start + content.length;
  return {content, truncated: end < text.length, ...(end < text.length ? {nextOffset: end} : {}), totalChars: text.length};
}
