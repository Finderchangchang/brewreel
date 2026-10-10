// 讲解课时间轴：所有对外时刻均为毫秒；frame 边界是唯一播放时间基准。
import {revealTargetsFor} from './reveal-targets.mjs';
import {emWidth, titleSpans} from './title-wrap.mjs';
import {STAGE, SUBTITLE, subtitleLayout} from '../../template/src/lesson/stage.mjs';
export {STAGE};
export const FPS = 30;
export const LEAD_MS = 400;
export const TAIL_MS = 800;
export const roundFrame = (ms) => Math.ceil(ms * FPS / 1000) * 1000 / FPS;

const chars = (s) => Array.from(String(s));
const terminal = /[。！？!?…；;.]$/u;
const sentenceText = (s) => {
  const t = String(s.text).trim();
  return terminal.test(t) ? t : `${t}。`;
};
export const narrationText = (sentences) => sentences.map(sentenceText).join('');

/** 真人口播只给句边界；句内字时刻是字幕分屏的均分估计，不是 ASR 或逐字对齐。 */
export function mapExplicitSentences(sentences, timings, durMs) {
  if (!Array.isArray(timings) || timings.length !== sentences.length) throw new Error('真人口播的句时刻数量必须与本页旁白句数一致');
  let previousEnd = 0;
  let offset = 0;
  return sentences.map((sentence, index) => {
    const {startMs, endMs} = timings[index] ?? {};
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < previousEnd || endMs <= startMs || endMs > durMs) {
      throw new Error(`真人口播第 ${index + 1} 句的时刻无效或与前句重叠`);
    }
    previousEnd = endMs;
    // 真人音轨不经 TTS，保留用户稿的原字符与标点；分句只用于画面 cue。
    const text = String(sentence.text).trim();
    const letters = chars(text);
    const timed = letters.map((letter, i) => ({text: letter, startMs: Math.round(startMs + (endMs - startMs) * i / letters.length), endMs: Math.round(startMs + (endMs - startMs) * (i + 1) / letters.length)}));
    const mapped = {index, text, charStart: offset, charEnd: offset + letters.length, startMs, endMs, chars: timed};
    offset += letters.length;
    return mapped;
  });
}

/** 将 provider 的词/字时间戳铺到字符，再顺序对齐整页原文；缺漏与多余字符由邻近时间线性插值。 */
export function mapSentences(sentences, words, durMs) {
  const pieces = sentences.map(sentenceText);
  const full = pieces.join('');
  const target = chars(full);
  const timed = [];
  for (const w of words ?? []) {
    const wc = chars(w.text ?? '');
    const span = Math.max(0, Number(w.endMs) - Number(w.startMs));
    wc.forEach((ch, i) => timed.push({ch, startMs: Number(w.startMs) + span * i / Math.max(1, wc.length), endMs: Number(w.startMs) + span * (i + 1) / Math.max(1, wc.length)}));
  }
  const aligned = new Array(target.length).fill(null);
  let j = 0;
  for (let i = 0; i < target.length; i++) {
    if (/\s/u.test(target[i])) continue;
    let found = -1;
    for (let k = j; k < Math.min(timed.length, j + 8); k++) if (timed[k].ch === target[i]) { found = k; break; }
    if (found >= 0) { aligned[i] = timed[found]; j = found + 1; }
  }
  for (let i = 0; i < aligned.length; i++) {
    if (aligned[i]) continue;
    let a = i - 1; while (a >= 0 && !aligned[a]) a--;
    let b = i + 1; while (b < aligned.length && !aligned[b]) b++;
    const lo = a >= 0 ? aligned[a].endMs : 0;
    const hi = b < aligned.length ? aligned[b].startMs : durMs;
    const n = b - a;
    aligned[i] = {startMs: lo + (hi - lo) * (i - a - 1) / n, endMs: lo + (hi - lo) * (i - a) / n};
  }
  const out = [];
  let offset = 0;
  pieces.forEach((text, index) => {
    const count = chars(text).length;
    const span = aligned.slice(offset, offset + count);
    const startMs = Math.max(0, Math.round(span[0]?.startMs ?? 0));
    const endMs = Math.min(durMs, Math.max(startMs, Math.round(span.at(-1)?.endMs ?? durMs)));
    out.push({index, text, charStart: offset, charEnd: offset + count, startMs, endMs, chars: span.map((x, i) => ({text: chars(text)[i], startMs: Math.round(x.startMs), endMs: Math.round(x.endMs)}))});
    offset += count;
  });
  return out;
}

export function pageFrames(voiceMs) { return Math.ceil((LEAD_MS + voiceMs + TAIL_MS) * FPS / 1000); }

/** 版式主体在 1920×1080 画布中的可见占位。截图和代码用更高的窄框，其余用全宽内容区。 */
export function contentBox(layout) {
  const box = layout === 'screenshot' || layout === 'code' ? STAGE.tall : STAGE.standard;
  return {x: box.x, y: box.y, width: box.width, height: box.height, area: box.width * box.height};
}

/** 单项元素的 reveal 进度；列表可选择把没有映射到旁白的项推迟到片尾前 0.5 秒。 */
export function revealProgress(page, reveal, frame, fallbackAtEnd = false) {
  // 累积语义：讲到第 k 个元素时，0…k 都要可见（元素在第一句 reveal ≥ 自己的旁白处出现）。
  const at = (page.sentences ?? []).filter((s) => Number.isInteger(s.reveal) && s.reveal >= reveal).reduce((m, s) => Math.min(m, s.revealAtMs ?? Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  if (at !== Number.MAX_SAFE_INTEGER) return Math.max(0, Math.min(1, (frame * 1000 / 30 - at) / 350));
  const hasReveal = (page.sentences ?? []).some((s) => Number.isInteger(s.reveal));
  if (!hasReveal) return Math.max(0, Math.min(1, (frame - reveal * 1.2) / 10));
  if (reveal === 0) return 1;
  if (!fallbackAtEnd) return 1;
  const start = Math.max(0, page.durationFrames - 26);
  return Math.max(0, Math.min(1, (frame - start) / 11));
}

/** 索引目标在给定页内帧是否已经完全可见；与布局组件使用同一 revealProgress。 */
export function visibleTargets(page, frame) {
  const targets = page.revealTargets ?? revealTargetsFor(page);
  return targets.map((_, index) => revealProgress(page, index, frame, true) >= 1);
}

/** 内容组占标准版心。标题带高度为 0：内容页不再放页眉。 */
export function layoutRegions() {
  const stage = STAGE.standard;
  return {
    stage,
    wide: STAGE.wide,
    side: STAGE.side,
    title: {y: stage.y, height: 0},
    body: {y: stage.y, height: stage.height},
  };
}

export function platformChaptersText(timeline) {
  const lines = timeline.chapters.map((c) => {
    const total = Math.floor(c.startMs / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor(total / 60) % 60;
    const s = total % 60;
    const stamp = h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${stamp} ${c.title}`;
  });
  const short = timeline.chapters.filter((c) => c.endMs - c.startMs < 10000);
  const note = short.length ? `\n# ${short.length} 个章节短于 10 秒，平台可能不收\n` : '\n';
  return `YouTube\n${lines.join('\n')}\n\nBilibili\n${lines.join('\n')}\n\nDouyin\n${lines.join('\n')}${note}`;
}

function presenterProblem(audio, pageIndex) {
  if (audio.presenter && !audio.sentenceTimings) return `真人口播第 ${pageIndex + 1} 页缺少逐句时刻映射`;
  if (!audio.presenter) return '';
  const {src, startMs: clipStartMs, endMs: clipEndMs, layout, aspectRatio} = audio.presenter;
  if (aspectRatio !== undefined && (!Number.isFinite(aspectRatio) || aspectRatio <= 0)) return `真人口播第 ${pageIndex + 1} 页的视频宽高比无效`;
  if (!src || !['pip', 'full', 'hidden'].includes(layout) || !Number.isInteger(clipStartMs) || !Number.isInteger(clipEndMs) || clipStartMs < 0 || clipEndMs <= clipStartMs || Math.abs(clipEndMs - clipStartMs - audio.durMs) > 1000 / FPS) {
    return `真人口播第 ${pageIndex + 1} 页的视频片段与音频时长不匹配`;
  }
  return '';
}

export function buildTimeline(lesson, audioPages) {
  const entries = [];
  let audioIndex = 0;
  for (const [ci, chapter] of lesson.chapters.entries()) {
    for (const [pi, page] of chapter.pages.entries()) {
      const audio = audioPages[audioIndex];
      if (!audio) throw new Error(`第 ${audioIndex + 1} 页缺少配音`);
      const problem = presenterProblem(audio, audioIndex);
      if (problem) throw new Error(problem);
      const mapped = audio.sentenceTimings
        ? mapExplicitSentences(page.narration, audio.sentenceTimings, audio.durMs)
        : mapSentences(page.narration, audio.words, audio.durMs);
      entries.push({ci, pi, chapter, page, audio, audioIndex, mapped, frames: pageFrames(audio.durMs)});
      audioIndex += 1;
    }
  }
  // 全片只有一章时，章节页不单独占时间轴。时长并到后一页的片尾停顿，总时长不变，这页配音不播。
  const skip = new Set();
  if (lesson.chapters.length === 1 && entries.length > 1) {
    entries.forEach((entry, i) => { if (entry.page.layout === 'chapter') skip.add(i); });
    if (skip.size === entries.length) skip.clear();
  }
  const bonus = new Array(entries.length).fill(0);
  for (let i = 0; i < entries.length; i += 1) {
    if (!skip.has(i)) continue;
    let target = -1;
    for (let j = i + 1; j < entries.length; j += 1) if (!skip.has(j)) { target = j; break; }
    if (target < 0) for (let j = i - 1; j >= 0; j -= 1) if (!skip.has(j)) { target = j; break; }
    if (target >= 0) bonus[target] += entries[i].frames;
  }
  const pages = [];
  const chapters = [];
  let frame = 0;
  let openChapter = -1;
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.ci !== openChapter) {
      openChapter = entry.ci;
      chapters.push({index: entry.ci, title: entry.chapter.title, startFrame: frame, endFrame: frame, startMs: frame * 1000 / FPS, endMs: frame * 1000 / FPS});
    }
    if (skip.has(i)) continue;
    const frames = entry.frames + bonus[i];
    const startFrame = frame;
    const startMs = startFrame * 1000 / FPS;
    const {page, audio, mapped} = entry;
    const sentenceRows = mapped.map((s, si) => {
      const sentence = page.narration[si];
      const voiceStartMs = LEAD_MS + s.startMs;
      return {...s, pose: sentence.pose ?? null, note: sentence.note ?? null, reveal: sentence.reveal ?? null, revealAtMs: sentence.reveal === undefined ? null : voiceStartMs, startMs: startMs + voiceStartMs, endMs: startMs + LEAD_MS + s.endMs};
    });
    const {narration, ...fields} = page;
    pages.push({index: entry.audioIndex, chapterIndex: entry.ci, chapterTitle: entry.chapter.title, pageInChapter: entry.pi, layout: page.layout, title: page.title, subtitle: page.subtitle ?? null, smallText: page.smallText ?? null, items: page.items ?? [], fields, narration, pose: page.narration.map((x) => x.pose ?? null), audio: audio.src, audioStartFrame: startFrame + Math.round(LEAD_MS * FPS / 1000), audioDurationMs: audio.durMs, presenter: audio.presenter ?? undefined, timingSource: audio.sentenceTimings ? 'manual-sentence' : 'tts-words', startFrame, endFrame: startFrame + frames, durationFrames: frames, startMs, endMs: (startFrame + frames) * 1000 / FPS, sentences: sentenceRows, revealTargets: revealTargetsFor(page)});
    frame += frames;
    const chapterRow = chapters[chapters.length - 1];
    chapterRow.endFrame = frame;
    chapterRow.endMs = frame * 1000 / FPS;
  }
  const timeline = {fps: FPS, width: 1920, height: 1080, totalFrames: frame, durationMs: frame * 1000 / FPS, chapters, pages};
  timeline.subtitles = subtitleScreens(timeline);
  return timeline;
}

const srtTime = (ms) => {
  const n = Math.max(0, Math.round(ms));
  const h = Math.floor(n / 3600000), m = Math.floor(n / 60000) % 60, s = Math.floor(n / 1000) % 60, milli = n % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(milli).padStart(3,'0')}`;
};

const SUBTITLE_TARGET_MIN = 10;
const SUBTITLE_TARGET_MAX = 18;
const SUBTITLE_MIN_MS = 800;
const HARD_END = /[。！？!?]$/u;

/** 一行字幕在默认字号下能放下的字宽。放得下就一行，放不下才两行。 */
export function subtitleLineEm() {
  return (SUBTITLE.maxWidth - SUBTITLE.padX * 2) / SUBTITLE.fontPx;
}

const pieceLen = (text) => Array.from(String(text).replace(/\s/gu, '')).length;

/** 把一页的逐字时间戳收成字幕屏。句号、问号、感叹号必须换屏；逗号和顿号只是软切，短片段合并到 10–18 字。不在词中间断。 */
export function packSubtitleChars(chars, options = {}) {
  const maxEm = options.maxEm ?? subtitleLineEm();
  const targetMin = options.targetMin ?? SUBTITLE_TARGET_MIN;
  const targetMax = options.targetMax ?? SUBTITLE_TARGET_MAX;
  const list = chars ?? [];
  if (!list.length) return [];
  const src = list.map((ch) => ch.text).join('');
  const ranges = [];
  let offset = 0;
  for (const ch of list) {
    const start = offset;
    offset += String(ch.text).length;
    ranges.push({start, end: offset, ch});
  }
  const take = (start, end) => ranges.filter((range) => range.start >= start && range.end <= end).map((range) => range.ch);
  const atoms = titleSpans(src).map((span) => ({
    text: span.text,
    chars: take(span.start, span.end),
    hard: HARD_END.test(span.text),
  })).filter((atom) => atom.chars.length);
  const textOf = (group) => group.map((atom) => atom.text).join('');
  const emOf = (group) => emWidth(textOf(group));
  const lenOf = (group) => pieceLen(textOf(group));
  const screens = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    screens.push(cur);
    cur = [];
  };
  for (const atom of atoms) {
    if (!cur.length) {
      cur = [atom];
      if (atom.hard) flush();
      continue;
    }
    const merged = [...cur, atom];
    const fits = emOf(merged) <= maxEm + 1e-6;
    const len = lenOf(merged);
    const keep = !cur.at(-1).hard && fits && (len <= targetMax || lenOf(cur) < targetMin);
    if (keep) cur = merged;
    else {
      flush();
      cur = [atom];
    }
    if (atom.hard) flush();
  }
  flush();
  const tightened = [];
  for (const screen of screens) {
    const prev = tightened.at(-1);
    const ownSentence = screen.at(-1).hard && (!prev || prev.at(-1).hard);
    if (prev && lenOf(screen) < 6 && !ownSentence && emOf([...prev, ...screen]) <= maxEm * 2 + 1e-6) {
      tightened[tightened.length - 1] = [...prev, ...screen];
      continue;
    }
    tightened.push(screen);
  }
  return tightened.map((group) => {
    const packed = group.flatMap((atom) => atom.chars);
    return {text: packed.map((ch) => ch.text).join(''), startMs: packed[0].startMs, endMs: packed.at(-1).endMs};
  });
}

function legacySubtitleScreens(timeline, options = {}) {
  const maxHan = options.maxHan ?? 28;
  const maxLen = options.maxLen ?? 48;
  const screens = [];
  for (const page of timeline.pages) for (const sentence of page.sentences) {
    let chunk = [];
    const flush = () => {
      if (!chunk.length) return;
      const pageOffsetMs = page.startMs + LEAD_MS;
      screens.push({pageIndex: page.index, startMs: pageOffsetMs + chunk[0].startMs, endMs: Math.max(pageOffsetMs + chunk[0].startMs + 1, pageOffsetMs + chunk.at(-1).endMs), text: chunk.map((c) => c.text).join('')});
      chunk = [];
    };
    for (const ch of sentence.chars) {
      chunk.push(ch);
      const han = chunk.reduce((n, x) => n + (/[\u3400-\u9fff]/u.test(x.text) ? 1 : 0), 0);
      if (/[。！？!?；;，,、]/u.test(ch.text) || han >= maxHan || chunk.length >= maxLen) flush();
    }
    flush();
  }
  return holdSubtitlePauses(screens);
}

function holdSubtitlePauses(screens) {
  for (let i = 0; i + 1 < screens.length; i += 1) {
    if (screens[i].pageIndex === screens[i + 1].pageIndex && screens[i].endMs < screens[i + 1].startMs) screens[i].endMs = screens[i + 1].startMs;
  }
  return screens;
}

function fitsSubtitleBar(text) {
  const layout = subtitleLayout(text);
  return layout.lines.length <= 2 && layout.font >= SUBTITLE.minFont;
}

/** 显示不足 0.8 秒的屏并进下一段。先吃掉标点后的停顿，停顿够 0.8 秒就不再并。 */
function mergeShortSubtitles(screens) {
  let list = screens;
  let guard = 0;
  while (guard < list.length + 2) {
    guard += 1;
    let changed = false;
    const next = [];
    for (const screen of list) {
      const prev = next.at(-1);
      if (prev && prev.pageIndex === screen.pageIndex && prev.endMs - prev.startMs < SUBTITLE_MIN_MS && fitsSubtitleBar(prev.text + screen.text)) {
        next[next.length - 1] = {...prev, text: prev.text + screen.text, endMs: Math.max(prev.endMs, screen.endMs)};
        changed = true;
      } else next.push(screen);
    }
    if (next.length >= 2) {
      const last = next.at(-1);
      const prev = next.at(-2);
      if (last.pageIndex === prev.pageIndex && last.endMs - last.startMs < SUBTITLE_MIN_MS && fitsSubtitleBar(prev.text + last.text)) {
        next.splice(next.length - 2, 2, {...prev, text: prev.text + last.text, endMs: Math.max(prev.endMs, last.endMs)});
        changed = true;
      }
    }
    list = next;
    if (!changed) break;
  }
  return list;
}

/** 横版：一屏一个意群。竖版仍传 maxHan / maxLen，走原来的标点切屏。 */
export function subtitleScreens(timeline, options = {}) {
  if (options.maxHan != null || options.maxLen != null) return legacySubtitleScreens(timeline, options);
  const screens = [];
  for (const page of timeline.pages ?? []) {
    const chars = [];
    for (const sentence of page.sentences ?? []) for (const ch of sentence.chars ?? []) chars.push(ch);
    const pageOffsetMs = page.startMs + LEAD_MS;
    for (const screen of packSubtitleChars(chars, options)) {
      screens.push({
        pageIndex: page.index,
        startMs: pageOffsetMs + screen.startMs,
        endMs: Math.max(pageOffsetMs + screen.startMs + 1, pageOffsetMs + screen.endMs),
        text: screen.text,
      });
    }
  }
  return mergeShortSubtitles(holdSubtitlePauses(screens));
}

/** 由全片帧号选择当前字幕屏；供 Remotion 与 Node 回归测试共用。 */
export function subtitleScreenAtFrame(timeline, frame) {
  const timeMs = frame * 1000 / timeline.fps;
  return timeline.subtitles.find((screen) => timeMs >= screen.startMs && timeMs < screen.endMs) ?? null;
}
export function toSrt(timeline) { return subtitleScreens(timeline).map((x, i) => `${i + 1}\n${srtTime(x.startMs)} --> ${srtTime(x.endMs)}\n${x.text}`).join('\n\n') + '\n'; }
export function chaptersText(timeline) {
  return timeline.chapters.map((c) => `${String(Math.floor(c.startMs / 60000)).padStart(2,'0')}:${String(Math.floor(c.startMs / 1000) % 60).padStart(2,'0')} ${c.title}`).join('\n') + '\n';
}
