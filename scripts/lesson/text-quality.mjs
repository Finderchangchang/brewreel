import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const WORDS = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'text-quality-words.json'), 'utf8'));
const SENTENCE_END = /[^。！？!?；;]+[。！？!?；;]?/gu;
const normalize = (text) => Array.from(String(text ?? '').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, ''));

function pageRows(lesson) {
  const rows = [];
  let pageNo = 0;
  for (let ci = 0; ci < (lesson?.chapters?.length ?? 0); ci++) {
    const chapter = lesson.chapters[ci];
    for (const page of chapter?.pages ?? []) {
      pageNo++;
      rows.push({page, pageNo, chapterTitle: chapter?.title});
    }
  }
  return rows;
}

function visibleStrings(value, location, result, {skipSource = true} = {}) {
  if (typeof value === 'string') { result.push({text: value, location}); return; }
  if (Array.isArray(value)) { value.forEach((item, i) => visibleStrings(item, `${location}[${i + 1}]`, result, {skipSource})); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (skipSource && key === 'source') continue;
    visibleStrings(item, `${location}.${key}`, result, {skipSource});
  }
}

export function internalLeaks(lesson) {
  const hits = [];
  const domain = lesson?.meta?.domain;
  const allow = WORDS.allowlist?.[domain] ?? [];
  const scan = [];
  if (typeof lesson?.meta?.title === 'string') scan.push({text: lesson.meta.title, location: '课程标题'});
  if (typeof lesson?.meta?.disclaimer === 'string') scan.push({text: lesson.meta.disclaimer, location: '片尾说明'});
  for (const row of pageRows(lesson)) {
    visibleStrings(row.chapterTitle, `第 ${row.pageNo} 页章节标题`, scan);
    visibleStrings(row.page, `第 ${row.pageNo} 页`, scan);
  }
  for (const item of scan) {
    let text = item.text;
    for (const phrase of allow) text = text.replaceAll(phrase, ' '.repeat(Array.from(phrase).length));
    const found = new Set();
    for (const term of WORDS.terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      if (new RegExp(escaped, 'iu').test(text)) found.add(term);
    }
    for (const source of WORDS.patterns) {
      const match = text.match(new RegExp(source, 'iu'));
      if (match) found.add(match[0]);
    }
    for (const term of found) {
      const sentenceIndex = item.location.includes('.narration[') ? Number(item.location.match(/\.narration\[(\d+)\]/u)?.[1]) : null;
      const sentence = sentenceIndex ? `第 ${sentenceIndex} 句旁白` : `卡片字段 ${item.location.split('.').at(-1)}`;
      hits.push({page: item.location.match(/第 (\d+) 页/u)?.[1] ?? '?', sentence, term, text: item.text});
    }
  }
  const blocks = hits.map((hit) => `第 ${hit.page} 页${hit.sentence}命中“${hit.term}”：${hit.text}。请改成直接面向观众的表达，删除审稿、来源核对或生成流程说明。`);
  return {ok: blocks.length === 0, blocks, hits};
}

function narrationSentences(lesson) {
  const result = [];
  for (const row of pageRows(lesson)) for (const line of row.page?.narration ?? []) {
    const parts = String(line?.text ?? '').match(SENTENCE_END) ?? [];
    for (const part of parts) if (normalize(part).length) result.push({text: part.trim(), normalized: normalize(part).join(''), pageNo: row.pageNo});
  }
  return result;
}

export function repetition(lesson) {
  const sentences = narrationSentences(lesson);
  const exact = new Map();
  sentences.forEach((sentence, i) => {
    if (!exact.has(sentence.normalized)) exact.set(sentence.normalized, []);
    exact.get(sentence.normalized).push({index: i, pageNo: sentence.pageNo, text: sentence.text});
  });
  const blocks = [];
  for (const rows of exact.values()) if (rows.length >= 3) {
    blocks.push(`旁白重复句出现 ${rows.length} 次（第 ${rows.map((x) => x.pageNo).join('、')} 页）：“${rows[0].text}”。请保留一次并改写其余内容。`);
  }

  const fragmentCounts = new Map();
  sentences.forEach((sentence, sentenceIndex) => {
    const chars = Array.from(sentence.normalized);
    const seen = new Set();
    for (let start = 0; start <= chars.length - 10; start++) {
      for (let end = start + 10; end <= Math.min(chars.length, start + 64); end++) seen.add(chars.slice(start, end).join(''));
    }
    for (const fragment of seen) {
      const ids = fragmentCounts.get(fragment) ?? new Set();
      ids.add(sentenceIndex);
      fragmentCounts.set(fragment, ids);
    }
  });
  const candidates = [...fragmentCounts].filter(([, ids]) => ids.size >= 4)
    .sort((a, b) => b[1].size - a[1].size || b[0].length - a[0].length || a[0].localeCompare(b[0]));
  const selected = [];
  for (const [fragment, ids] of candidates) {
    if (selected.some((entry) => entry.fragment.includes(fragment) && entry.count >= ids.size)) continue;
    selected.push({fragment, count: ids.size});
    if (selected.length === 5) break;
  }
  const warnings = selected.length ? [`旁白片段在多句中反复出现：${selected.map((x) => `“${x.fragment}”（${x.count}句）`).join('；')}。建议改写，避免车轱辘话。`] : [];
  return {ok: blocks.length === 0, blocks, warnings, topFragments: selected};
}

export function thinBrief(brief) {
  const points = Array.isArray(brief?.points) ? brief.points : [];
  const minimum = Math.ceil((Number(brief?.minutes) || 0) * 2);
  const warnings = points.length < minimum ? [`要点太少，模型只能重复，建议补到 ${minimum} 条。`] : [];
  return {ok: warnings.length === 0, warnings, requiredPoints: minimum, pointCount: points.length};
}
