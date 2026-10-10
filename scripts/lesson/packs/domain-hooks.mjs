import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ABS_CLAIM_ZH, ABS_CLAIM_ZH_PATTERNS} from '../../lib/typo-list.mjs';
import {readJsonResource} from '../read-json.mjs';

const PACKS = path.dirname(fileURLToPath(import.meta.url));
const readPack = (domain) => readJsonResource(path.join(PACKS, domain, 'rules.json'));
const legalRules = readPack('legal');
const techRules = readPack('tech');
const newsRules = readPack('news');
const legalRoot = path.join(PACKS, 'legal');
const corpusDir = path.join(legalRoot, 'corpus');

const clean = (value) => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
function pageStrings(page) {
  const out = [];
  for (const key of ['title', 'subtitle', 'smallText', 'text', 'content', 'quote', 'code', 'alt', 'annotation', 'annotations', 'items', 'narration', 'tag', 'tagText', 'leftVerdict', 'rightVerdict', 'basis', 'propTitle', 'lines', 'propLines', 'nodes', 'segments', 'captions', 'name', 'org', 'point', 'rows', 'roles', 'verdictText', 'verdictLabel', 'payLabel', 'payAmount', 'cardText', 'points', 'amount', 'status', 'screenTitle', 'unit']) {
    const val = page?.[key];
    if (typeof val === 'string') out.push(val);
    else if (Array.isArray(val)) for (const item of val) {
      if (typeof item === 'string') out.push(item);
      else if (item && typeof item === 'object') for (const k of ['text', 'content', 'code', 'alt', 'label', 'title', 'name', 'value', 'role', 'situation', 'result']) if (typeof item[k] === 'string') out.push(item[k]);
    }
    else if (val && typeof val === 'object') for (const k of ['text', 'content', 'code', 'alt', 'label', 'title', 'name', 'value', 'role', 'situation', 'result']) if (typeof val[k] === 'string') out.push(val[k]);
  }
  return out;
}
function pagesOf(lesson) {
  return (lesson.chapters ?? []).flatMap((chapter, ci) => (chapter.pages ?? []).map((page, pi) => ({page, ci, pi, where: `chapters[${ci}].pages[${pi}]`, texts: pageStrings(page)})));
}
function corpusArticles() {
  const files = fs.readdirSync(corpusDir).filter((name) => name.endsWith('.txt') && name !== 'README.txt');
  const articles = [];
  for (const name of files) {
    const content = fs.readFileSync(path.join(corpusDir, name), 'utf8');
    const headers = [...content.matchAll(/《中华人民共和国民法典》第([〇零一二三四五六七八九十百千\d]+)条（自(\d{4}-\d{2}-\d{2})起施行）/gu)];
    for (let i = 0; i < headers.length; i++) {
      const current = headers[i];
      const start = current.index + current[0].length;
      const end = i + 1 < headers.length ? headers[i + 1].index : content.length;
      const body = content.slice(start, end).trim();
      articles.push({number: current[1], effective: current[2], body, compact: body.replace(/\s+/gu, '')});
    }
  }
  return articles;
}
const corpus = corpusArticles();
export function corpusNumbers() {
  return corpus.map((article) => article.number);
}
const sourcesText = (meta) => (Array.isArray(meta?.sources) ? meta.sources : []).map((s) => typeof s === 'string' ? s : JSON.stringify(s)).join(' ');
const sourceOf = (page) => typeof page?.source === 'string' ? page.source : page?.source && typeof page.source === 'object' ? JSON.stringify(page.source) : '';
const conclusions = /可以|不可以|应当|要担责|承担责任|违法|无效|有效|必须/u;

function legalHook(lesson) {
  const block = [], warn = [], human = [];
  const allPages = pagesOf(lesson);
  const allText = allPages.flatMap((p) => p.texts).join('\n');
  for (const entry of legalRules.patterns ?? []) {
    const re = new RegExp(entry.regex, 'u');
    const found = allPages.flatMap((row) => row.texts.filter((text) => re.test(text)).map((text) => ({row, text})));
    if (!found.length) continue;
    const level = entry.id === 'legal-old-statutes' && lesson.meta?.allowHistorical === true ? 'warn' : entry.level;
    const target = level === 'block' ? block : level === 'human' ? human : warn;
    for (const {row, text} of found) {
      if (entry.id === 'legal-honor-date-body' && /(?:19|20)\d{2}年/u.test(text) && /(律协|律师协会|司法局|司法厅|委员会|政府|法院|协会|机构).{0,10}(授予|颁发|评选|奖|荣誉)|(?:授予|颁发|评选).{0,10}(律协|律师协会|司法局|司法厅|委员会|政府|法院|协会|机构)/u.test(text)) continue;
      target.push(`${row.where}：${entry.message}（规则 ${entry.id}；${entry.source}）`);
    }
  }

  if (/(?:1[3-9]\d{9}|\d{17}[\dXx]|\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]|\d+(?:\.\d+)?\s*(?:万|万元|元|人民币)|(?:姓名|身份证|住址|手机号|个人信息|张某|李某|王某|赵某|某某)|(?:省|市|区|县|镇|乡|街道|路|巷|弄|号|室))/u.test(allText)) human.push(`legal：${legalRules.checks.find((x) => x.id === 'legal-case-privacy').message}（legal-case-privacy；${legalRules.checks.find((x) => x.id === 'legal-case-privacy').source}）`);

  const metaSources = sourcesText(lesson.meta);
  const sharedClaims = legalRules.checks.find((x) => x.id === 'legal-shared-absolute-claims');
  for (const row of allPages) for (const text of row.texts) {
    const word = ABS_CLAIM_ZH.find((item) => text.includes(item));
    const pattern = ABS_CLAIM_ZH_PATTERNS.map((item) => item.exec(text)?.[0]).find(Boolean);
    if (word || pattern) warn.push(`${row.where}：${sharedClaims.message}（legal-shared-absolute-claims；命中“${word ?? pattern}”；${sharedClaims.source}）`);
  }
  for (const row of allPages) {
    const quoteValue = row.page.quote;
    const hasQuoteLayout = row.page.layout === 'quote' || quoteValue !== undefined;
    if (hasQuoteLayout) {
      const q = typeof quoteValue === 'string' ? quoteValue : quoteValue && typeof quoteValue === 'object' ? quoteValue.text : '';
      const citation = `${sourceOf(row.page)} ${metaSources}`;
      const compact = clean(q).replace(/\s+/gu, '');
      const article = corpus.find((a) => a.compact.includes(compact) && compact.length > 0);
      const articleNo = article && `第${article.number}条`;
      const hasCitation = Boolean(article && citation.includes('民法典') && citation.includes(articleNo) && citation.includes(article.effective));
      if (!article || !hasCitation) block.push(`${row.where}：引用法条未能在本地语料逐字匹配，或条号、法规名、施行日期出处不对应（legal-quote-corpus）`);
    }
    const pageText = row.texts.join(' ');
    if (conclusions.test(pageText) && !sourceOf(row.page).trim() && !metaSources.trim()) warn.push(`${row.where}：${legalRules.checks.find((x) => x.id === 'legal-conclusion-source').message}（legal-conclusion-source）`);
  }
  // 固定片尾由 LegalMarkings 强制覆盖，meta.disclaimer 不能关闭该视觉标识。
  return {block, warn, human, summary: {domain: 'legal', ruleCount: legalRules.patterns.length + legalRules.checks.length, articleCount: corpus.length, aiMarkForced: true, disclaimerForced: true}};
}

const TERM_RE = /\b(API|SDK|CLI|HTTP|HTTPS|JSON|YAML|SQL|Git|Docker|Token|LLM|RAG|OAuth|Webhook)\b/giu;
const EXPLAIN_RE = /(?:（[^）]{2,40}）|\([^)]{2,40}\)|，也就是[^，。；]{2,35}|，即[^，。；]{2,35}|是指[^，。；]{2,35}|指的是[^，。；]{2,35})/u;
function techHook(lesson) {
  const block = [], warn = [], human = [];
  const seenTerms = new Set();
  for (const row of pagesOf(lesson)) {
    const text = row.texts.join(' ');
    if (row.page.layout === 'code') {
      const code = typeof row.page.code === 'string' ? row.page.code : typeof row.page.content === 'string' ? row.page.content : '';
      const lines = code ? code.split(/\r?\n/u).filter((line) => line.trim()).length : 0;
      if (!row.page.language || !lines) warn.push(`${row.where}：${techRules.checks.find((x) => x.id === 'tech-code-block').message}（缺少语言或代码；tech-code-block）`);
      else if (lines < 2 || lines > 12) warn.push(`${row.where}：${techRules.checks.find((x) => x.id === 'tech-code-block').message}（当前 ${lines} 行）`);
    }
    if (row.page.layout === 'screenshot') {
      const alt = typeof row.page.alt === 'string' ? row.page.alt : row.page.image?.alt;
      const annotations = row.page.callouts ?? row.page.annotations ?? row.page.annotation ?? row.page.markers;
      const hasAnnotations = Array.isArray(annotations) ? annotations.length > 0 : Boolean(annotations && (typeof annotations === 'string' || Object.keys(annotations).length));
      if (!alt?.trim() || !hasAnnotations) block.push(`${row.where}：${techRules.checks.find((x) => x.id === 'tech-screenshot').message}（tech-screenshot）`);
    }
    for (const term of text.matchAll(TERM_RE)) {
      const word = term[0].toUpperCase();
      if (seenTerms.has(word)) continue;
      seenTerms.add(word);
      const nearby = text.slice(term.index + term[0].length, term.index + term[0].length + 48);
      if (!EXPLAIN_RE.test(nearby) && !EXPLAIN_RE.test(text)) warn.push(`${row.where}：术语“${term[0]}”首次出现缺少通俗解释（tech-first-term）`);
    }
    TERM_RE.lastIndex = 0;
  }
  const full = pagesOf(lesson).flatMap((p) => p.texts).join(' ');
  const hasProductOrVersion = /\b(?:Codex|ChatGPT|Claude|OpenAI|Windows|Android|iOS|Python|Node(?:\.js)?|React|Remotion)\b|\bv?\d+\.\d+(?:\.\d+)?\b/iu.test(full);
  if (hasProductOrVersion) {
    const facts = Array.isArray(lesson.meta?.facts) ? lesson.meta.facts : [];
    const sourcedFact = facts.some((fact) => fact && (typeof fact.source === 'string' && fact.source.trim() || typeof fact.url === 'string' && fact.url.trim() || typeof fact.citation === 'string' && fact.citation.trim()));
    if (!sourcedFact) warn.push(`meta.facts：${techRules.checks.find((x) => x.id === 'tech-product-facts').message}（tech-product-facts）`);
  }
  return {block, warn, human, summary: {domain: 'tech', ruleCount: techRules.patterns.length + techRules.checks.length}};
}

const judgmentWords = () => newsRules.checks.find((item) => item.id === 'news-judgment')?.words ?? [];
const sideChars = (value) => {
  const list = Array.isArray(value) ? value : [];
  return list.reduce((sum, item) => sum + Array.from(typeof item === 'string' ? item : item?.text ?? '').length, 0);
};

function newsHook(lesson) {
  const block = [];
  const warn = [];
  const human = [];
  const words = judgmentWords();
  const balance = newsRules.checks.find((item) => item.id === 'news-balance');
  const judgment = newsRules.checks.find((item) => item.id === 'news-judgment');
  for (const row of pagesOf(lesson)) {
    const extra = [];
    for (const key of ['left', 'right']) {
      const value = row.page?.[key];
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (typeof item === 'string') extra.push(item);
        else if (item && typeof item.text === 'string') extra.push(item.text);
      }
    }
    const blob = [...row.texts, ...extra].join('\n');
    for (const word of words) {
      if (word && blob.includes(word)) warn.push(`${row.where}：${judgment.message}（命中「${word}」；${judgment.id}）`);
    }
    if (row.page?.layout === 'compare') {
      const left = sideChars(row.page.left);
      const right = sideChars(row.page.right);
      const short = Math.min(left, right);
      const long = Math.max(left, right);
      if (long > 0 && (short === 0 || long > short * 1.5)) warn.push(`${row.where}：${balance.message}（${left} 字对 ${right} 字；${balance.id}）`);
    }
  }
  return {block, warn, human, summary: {domain: 'news', ruleCount: newsRules.checks.length, disclaimerForced: true}};
}

export const domainHooks = {legal: legalHook, tech: techHook, news: newsHook};
export function hookForDomain(domain) { return domainHooks[domain] ?? null; }
export function getDomainRules(domain) {
  if (domain === 'legal') return legalRules;
  if (domain === 'tech') return techRules;
  if (domain === 'news') return newsRules;
  return null;
}
