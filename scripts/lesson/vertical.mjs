// 竖版切片和封面的纯规则。不调模型，不改横版时间轴。
import {getDomainRules} from './packs/domain-hooks.mjs';
import {LEAD_MS} from './timeline.mjs';
import {emWidth, titleLines, titleSpans} from './title-wrap.mjs';
import {VERTICAL, verticalSubtitleMaxChars} from './vertical-layout.mjs';

export {titleLines};
export {VERTICAL, verticalSubtitleMaxChars, verticalSubtitleBox, verticalPresenterBox, headerHeight, verticalContentBox, verticalChromeBoxes, chromeTopReserve, verticalNoteBox, recapHeading, compareHeadings, visiblePageHeadings, headingsOverlap, shouldShowHook, emphasizedFontPx, hookEmphasisTransform} from './vertical-layout.mjs';

const DOMAIN_TAG = {legal: '普法', tech: 'AI编程'};

const graphemes = (text) => Array.from(String(text ?? ''));

/** 按词边界截断。拉丁词整词保留：短于上限就放进，放不进就停；开头一个超长英文词不拆开。 */
export function clampAtoms(text, maxChars) {
  const clean = String(text ?? '').replace(/[ \t]+/gu, ' ').trim();
  if (!clean) return '';
  const limit = Math.max(1, maxChars);
  const spans = titleSpans(clean);
  let end = 0;
  let count = 0;
  for (const span of spans) {
    const n = graphemes(clean.slice(span.start, span.end)).length;
    if (count + n > limit) break;
    end = span.end;
    count += n;
  }
  const out = clean.slice(0, end).trim();
  if (out) return out;
  const first = spans[0];
  if (!first) return graphemes(clean).slice(0, limit).join('');
  const word = clean.slice(first.start, first.end).trim();
  if (/^[A-Za-z0-9]/u.test(word)) return word;
  return graphemes(word).slice(0, limit).join('');
}

export function oneLine(text, maxEm = VERTICAL.coverSubtitleEm) {
  const clean = String(text ?? '').replace(/[ \t]+/gu, ' ').trim();
  if (!clean) return '';
  const spans = titleSpans(clean);
  let end = 0;
  for (const span of spans) {
    const next = clean.slice(0, span.end).trim();
    if (emWidth(next) > maxEm + 1e-6) break;
    end = span.end;
  }
  const out = clean.slice(0, end).trim();
  if (out) return out;
  const first = spans[0];
  if (first && /^[A-Za-z0-9]/u.test(clean.slice(first.start, first.end))) return clean.slice(first.start, first.end).trim();
  return clampAtoms(clean, Math.max(1, Math.floor(maxEm)));
}

const pageDur = (page) => Math.max(0, page.endMs - page.startMs);

function makeSegment(pages) {
  const chapterTitles = [];
  for (const page of pages) {
    if (page.chapterTitle && !chapterTitles.includes(page.chapterTitle)) chapterTitles.push(page.chapterTitle);
  }
  return {pages, chapterTitles, durationMs: pages.reduce((sum, page) => sum + pageDur(page), 0)};
}

/** 章节内部超过 60 秒才在页边界切开。单页再长也不切断旁白。 */
function packChapter(pages) {
  const total = pages.reduce((sum, page) => sum + pageDur(page), 0);
  if (total <= VERTICAL.clipMaxMs) return [pages];
  const buckets = [];
  let bucket = [];
  let acc = 0;
  for (const page of pages) {
    const dur = pageDur(page);
    if (bucket.length && acc + dur > VERTICAL.clipMaxMs) {
      buckets.push(bucket);
      bucket = [];
      acc = 0;
    }
    bucket.push(page);
    acc += dur;
  }
  if (bucket.length) buckets.push(bucket);
  return buckets;
}

/** 不足 15 秒的并到相邻一条，但合并后不能超过 60 秒。两边都会超，就留下这条短片。 */
function mergeShort(segments) {
  const list = segments.slice();
  let i = 0;
  while (i < list.length) {
    if (list[i].durationMs >= VERTICAL.clipMinMs) { i += 1; continue; }
    const dur = list[i].durationMs;
    const prevOk = i > 0 && list[i - 1].durationMs + dur <= VERTICAL.clipMaxMs;
    const nextOk = i + 1 < list.length && dur + list[i + 1].durationMs <= VERTICAL.clipMaxMs;
    if (prevOk) {
      list.splice(i - 1, 2, makeSegment([...list[i - 1].pages, ...list[i].pages]));
      i = Math.max(0, i - 1);
      continue;
    }
    if (nextOk) {
      list.splice(i, 2, makeSegment([...list[i].pages, ...list[i + 1].pages]));
      continue;
    }
    i += 1;
  }
  return list;
}

const firstClause = (text) => {
  const clean = String(text ?? '').trim();
  if (!clean) return '';
  const cut = clean.split(/[，。！？、；：,.!?;:\n]/u)[0].trim();
  return cut || clean;
};

/** 章节名不超过 14 字就用章节名；否则用问题页题目；再没有就取第一句旁白，在标点处截断。不在词中截断，不加省略号。 */
export function hookTitleFor(pages) {
  const chapter = String(pages[0]?.chapterTitle || '').trim();
  if (chapter && graphemes(chapter).length <= VERTICAL.hookMaxChars) return chapter;
  const question = pages.find((page) => page.layout === 'question');
  const asked = String(question?.title || question?.fields?.question || '').trim();
  if (asked) return asked;
  return firstClause(narrationsOf(pages)[0] || pages[0]?.title || chapter);
}

export function planClips(timeline, {domain = 'tech', courseTitle = ''} = {}) {
  const fps = timeline?.fps || 30;
  const legalTailFrames = domain === 'legal' ? Math.round(VERTICAL.legalTailMs * fps / 1000) : 0;
  const groups = [];
  for (const page of timeline?.pages ?? []) {
    const last = groups[groups.length - 1];
    if (!last || last.chapterIndex !== page.chapterIndex) groups.push({chapterIndex: page.chapterIndex, pages: [page]});
    else last.pages.push(page);
  }
  let segments = [];
  for (const group of groups) for (const pages of packChapter(group.pages)) segments.push(makeSegment(pages));
  segments = mergeShort(segments);
  return segments.map((seg, index) => ({
    index: index + 1,
    id: `clip-${String(index + 1).padStart(2, '0')}`,
    pageStart: seg.pages[0].index,
    pageEnd: seg.pages[seg.pages.length - 1].index,
    pages: seg.pages,
    chapterTitles: seg.chapterTitles,
    durationMs: seg.durationMs,
    hookTitle: hookTitleFor(seg.pages),
    legalTailFrames,
    courseTitle,
  }));
}

export function sliceTimeline(timeline, clip) {
  const selected = timeline.pages.filter((page) => page.index >= clip.pageStart && page.index <= clip.pageEnd);
  if (!selected.length) throw new Error('切片没有页面');
  const originFrame = selected[0].startFrame;
  const originMs = selected[0].startMs;
  const pages = selected.map((page) => ({
    ...page,
    startFrame: page.startFrame - originFrame,
    endFrame: page.endFrame - originFrame,
    startMs: page.startMs - originMs,
    endMs: page.endMs - originMs,
    audioStartFrame: page.audioStartFrame - originFrame,
    sentences: (page.sentences ?? []).map((sentence) => ({
      ...sentence,
      startMs: sentence.startMs - originMs,
      endMs: sentence.endMs - originMs,
      revealAtMs: sentence.revealAtMs == null ? null : sentence.revealAtMs - originMs,
    })),
  }));
  const tail = clip.legalTailFrames || 0;
  const totalFrames = pages[pages.length - 1].endFrame + tail;
  const sliced = {
    fps: timeline.fps,
    width: VERTICAL.canvas.w,
    height: VERTICAL.canvas.h,
    totalFrames,
    durationMs: totalFrames * 1000 / timeline.fps,
    chapters: timeline.chapters,
    pages,
    subtitles: [],
  };
  sliced.subtitles = verticalSubtitleScreens(sliced);
  return sliced;
}

const LATIN_WORD = /^[A-Za-z][A-Za-z0-9.+#_-]*$/u;
const DIGIT_WORD = /^[0-9０-９]+$/u;
const SOFT_EM = (VERTICAL.subtitle.w - 8) / VERTICAL.subtitleMinPx;
const SPACE_PUNCT = /^[，,。．.、]+$/u;
const TONE_PUNCT = /^[！？!?；;：:]+$/u;
const segmenter = () => new Intl.Segmenter('zh', {granularity: 'word'});

const consumeFlag = (raw, index) => {
  if (index >= raw.length || raw[index].text !== '-') return null;
  let j = index;
  let dashes = 0;
  while (j < raw.length && raw[j].text === '-' && dashes < 2) {
    dashes += 1;
    j += 1;
  }
  if (dashes < 1 || j >= raw.length || !LATIN_WORD.test(raw[j].text)) return null;
  return j + 1;
};

/** 词边界上的字幕原子。连字符英文、`codex --help` 这类命令合成一块，标点单独留下当断点。 */
export function subtitlePieces(text) {
  const src = String(text ?? '');
  const raw = [...segmenter().segment(src)].map((part) => ({
    text: part.segment,
    start: part.index,
    end: part.index + part.segment.length,
  }));
  const atoms = [];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i].text.trim() === '') continue;
    if (LATIN_WORD.test(raw[i].text) || DIGIT_WORD.test(raw[i].text)) {
      const start = raw[i].start;
      let end = raw[i].end;
      let j = i;
      while (j + 2 < raw.length && /^[-_]$/u.test(raw[j + 1].text) && (LATIN_WORD.test(raw[j + 2].text) || DIGIT_WORD.test(raw[j + 2].text))) {
        end = raw[j + 2].end;
        j += 2;
      }
      while (j + 1 < raw.length) {
        let k = j + 1;
        if (raw[k].text !== ' ') break;
        k += 1;
        const flagAt = consumeFlag(raw, k);
        if (flagAt == null) break;
        end = raw[flagAt - 1].end;
        j = flagAt - 1;
      }
      atoms.push({text: src.slice(start, end), start, end, kind: 'word'});
      i = j;
      continue;
    }
    const kind = SPACE_PUNCT.test(raw[i].text) ? 'space' : TONE_PUNCT.test(raw[i].text) ? 'tone' : 'word';
    atoms.push({text: raw[i].text, start: raw[i].start, end: raw[i].end, kind});
  }
  return atoms;
}

const showSubtitle = (raw) => String(raw ?? '').replace(/[，,。．.、]/gu, ' ').replace(/[ \t]+/gu, ' ').trim();
const punctOnly = (text) => !/[^\s，,。．.、！？!?；;：:…—]/u.test(text);

const subtitleFont = (em) => (
  em <= SOFT_EM + 1e-6
    ? VERTICAL.subtitleMinPx
    : Math.max(28, Math.floor((VERTICAL.subtitle.w - 8) / Math.max(em, 0.1)))
);

const CJK_ONE = /^[\u3400-\u9fff]$/u;

/** 行尾如果只剩一个汉字，而下一个词也是汉字，就把这个字挪到下一行，避免「由」单独留下、「人确认」单独成行。 */
function holdOrphan(cur, next) {
  if (!next || next.kind !== 'word' || !/^[\u3400-\u9fff]/u.test(next.text)) return null;
  const words = cur.filter((atom) => atom.kind === 'word');
  if (words.length < 2) return null;
  const last = words[words.length - 1];
  if (graphemes(last.text).length !== 1 || !CJK_ONE.test(last.text)) return null;
  const at = cur.lastIndexOf(last);
  return cur.splice(at);
}

/** 竖版字幕按词和标点折行。普通行不超过约 12.8 个汉字宽，从而 56px 能放进 720。拆不开的命令单独成行，允许放到 18 宽以上并缩小字号。 */
export function layoutSubtitleText(text) {
  const src = String(text ?? '');
  const atoms = subtitlePieces(src);
  const lines = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    const raw = src.slice(cur[0].start, cur[cur.length - 1].end);
    cur = [];
    const shown = showSubtitle(raw);
    if (!shown || punctOnly(shown)) return;
    const em = emWidth(shown);
    lines.push({text: shown, em, fontPx: subtitleFont(em)});
  };
  for (const atom of atoms) {
    if (atom.kind !== 'word') {
      if (cur.length) cur.push(atom);
      continue;
    }
    if (cur.length) {
      const trial = src.slice(cur[0].start, atom.end);
      if (emWidth(showSubtitle(trial)) > SOFT_EM + 1e-6) {
        const moved = holdOrphan(cur, atom);
        flush();
        if (moved) cur.push(...moved);
      }
    }
    cur.push(atom);
  }
  flush();
  return lines;
}

export function verticalSubtitleScreens(timeline) {
  const screens = [];
  for (const page of timeline.pages ?? []) for (const sentence of page.sentences ?? []) {
    const chars = sentence.chars ?? [];
    const src = chars.map((ch) => ch.text).join('');
    if (!src) continue;
    const ranges = [];
    let offset = 0;
    for (let i = 0; i < chars.length; i += 1) {
      const start = offset;
      offset += String(chars[i].text).length;
      ranges.push({start, end: offset, i});
    }
    const atoms = subtitlePieces(src);
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      const from = cur[0].start;
      const to = cur[cur.length - 1].end;
      cur = [];
      const shown = showSubtitle(src.slice(from, to));
      if (!shown || punctOnly(shown)) return;
      const hit = ranges.filter((range) => range.start < to && range.end > from);
      if (!hit.length) return;
      const em = emWidth(shown);
      const pageOffsetMs = page.startMs + LEAD_MS;
      const first = chars[hit[0].i];
      const last = chars[hit[hit.length - 1].i];
      screens.push({
        pageIndex: page.index,
        startMs: pageOffsetMs + first.startMs,
        endMs: Math.max(pageOffsetMs + first.startMs + 1, pageOffsetMs + last.endMs),
        text: shown,
        em,
        fontPx: subtitleFont(em),
      });
    };
    for (const atom of atoms) {
      if (atom.kind !== 'word') {
        if (cur.length) cur.push(atom);
        continue;
      }
      if (cur.length && emWidth(showSubtitle(src.slice(cur[0].start, atom.end))) > SOFT_EM + 1e-6) {
        const moved = holdOrphan(cur, atom);
        flush();
        if (moved) cur.push(...moved);
      }
      cur.push(atom);
    }
    flush();
  }
  for (let i = 0; i + 1 < screens.length; i += 1) {
    if (screens[i].pageIndex === screens[i + 1].pageIndex && screens[i].endMs < screens[i + 1].startMs) {
      screens[i].endMs = screens[i + 1].startMs;
    }
  }
  return screens;
}

/** 课程名不超过 20 字就用课程名，否则章节名，都超了用钩子标题。仍超长才在词边界截断，不加省略号。 */
export function publishTitle({courseTitle = '', chapterTitle = '', hookTitle = ''} = {}) {
  const course = String(courseTitle ?? '').trim();
  const chapter = String(chapterTitle ?? '').trim();
  const hook = String(hookTitle ?? '').trim();
  if (course && graphemes(course).length <= VERTICAL.publishTitleMax) return course;
  if (chapter && graphemes(chapter).length <= VERTICAL.publishTitleMax) return chapter;
  if (hook && graphemes(hook).length <= VERTICAL.publishTitleMax) return hook;
  return clampAtoms(course || chapter || hook, VERTICAL.publishTitleMax);
}

export function domainTag(domain) {
  return DOMAIN_TAG[domain] || '知识分享';
}

/** 只用稿件里的 meta.tags，再加一个领域词。没有标签的旧稿只放领域词。 */
export function publishTags({domain, tags} = {}) {
  const out = [];
  const push = (word) => {
    const clean = String(word ?? '').replace(/^#+/u, '').trim();
    if (!clean || out.includes(clean)) return;
    out.push(clean);
  };
  if (Array.isArray(tags)) for (const tag of tags) push(tag);
  push(domainTag(domain));
  return out.map((tag) => `#${tag}`);
}

export function buildPublish({courseTitle, chapterTitle, chapterTitles, domain, narrations, tags, hookTitle}) {
  const sentences = (narrations ?? []).map((line) => String(line ?? '').trim()).filter(Boolean);
  const intro = sentences.slice(0, Math.min(3, sentences.length));
  const titles = chapterTitles?.length ? chapterTitles : [chapterTitle];
  const title = publishTitle({courseTitle: courseTitle || '', chapterTitle: titles[0] || chapterTitle || '', hookTitle: hookTitle || ''});
  const tagLine = publishTags({domain, tags});
  return {title, intro, tags: tagLine, text: `${title}\n\n${intro.join('\n')}\n\n${tagLine.join(' ')}\n`};
}

export function narrationsOf(pages) {
  const lines = [];
  for (const page of pages ?? []) {
    const rows = page.narration ?? page.sentences ?? [];
    for (const row of rows) {
      const text = String(row?.text ?? '').trim();
      if (text) lines.push(text);
    }
  }
  return lines;
}

export function publishForClip(clip, {courseTitle, domain, tags} = {}) {
  return buildPublish({
    courseTitle: courseTitle ?? clip.courseTitle ?? '',
    chapterTitle: clip.chapterTitles?.[0] ?? '',
    chapterTitles: clip.chapterTitles ?? [],
    domain,
    narrations: narrationsOf(clip.pages),
    tags,
    hookTitle: clip.hookTitle ?? '',
  });
}

export function coverCopy(lesson) {
  const pages = (lesson?.chapters ?? []).flatMap((chapter) => chapter.pages ?? []);
  const cover = pages.find((page) => page.layout === 'cover');
  const raw = String(lesson?.meta?.title ?? '').trim();
  const title = graphemes(raw).length <= VERTICAL.coverTitleMax ? raw : clampAtoms(raw, VERTICAL.coverTitleMax);
  return {
    title,
    subtitle: oneLine(cover?.subtitle || ''),
  };
}

/** 封面文字走领域包里的 block 规则。普法因此拦「胜诉」「保证胜诉」这一类。 */
export function coverTextIssues(domain, texts) {
  const rules = getDomainRules(domain);
  if (!rules) return [];
  const blob = (texts ?? []).filter(Boolean).join('\n');
  const issues = [];
  for (const entry of rules.patterns ?? []) {
    if (entry.level !== 'block') continue;
    const re = new RegExp(entry.regex, 'u');
    if (re.test(blob)) issues.push(`${entry.id}：${entry.message}`);
  }
  return issues;
}
