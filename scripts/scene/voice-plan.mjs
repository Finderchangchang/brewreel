// 场景配音的时间。逐字和拍点各走各的函数，不合成一个再丢掉来源。
import {LEAD_SEC, TAIL_SEC} from '../lib/tts/pipeline.mjs';
import {paginate, plainOf} from '../lib/tts/timing.mjs';
import {plainChars} from '../../template/src/scene/caption.ts';
import {CAPTION_FONT_MAX, captionBox} from '../../template/src/scene/safe-box.ts';
import {fitSceneCopy} from '../../template/src/scene/wrap.ts';

/** 一段字幕少于此字数，或在屏上短于此时长，就并进邻段；并不进去就不显示。 */
export const CAPTION_ORPHAN_MIN_CHARS = 4;
export const CAPTION_ORPHAN_MIN_SEC = 0.6;

export {LEAD_SEC, TAIL_SEC};

const clampBpm = (bpm) => Math.max(90, Math.min(150, Number(bpm) || 120));

/** 屏长 = 前留白 + 旁白 + 后留白，向上取整拍。拍长按 90–150 BPM。 */
export function screenDurationFromAudio(durSec, bpm = 120) {
  const beat = 60 / clampBpm(bpm);
  const raw = Math.max(0, Number(durSec) || 0) + LEAD_SEC + TAIL_SEC;
  const steps = Math.max(1, Math.ceil(raw / beat - 1e-9));
  return Number((steps * beat).toFixed(6));
}

function indexToStartMs(words, index) {
  let cursor = 0;
  for (const word of words) {
    const text = String(word?.text || '');
    const next = cursor + text.length;
    if (index < next) return Number(word.startMs) || 0;
    cursor = next;
  }
  const last = words[words.length - 1];
  return last ? Number(last.startMs) || 0 : 0;
}

/**
 * 每条画面文案一个时刻（秒，含前留白）。
 * 能在旁白里找到这段字，就用那个字的开始时间；找不到就按条目序号取一个真实的字时间。
 * 不退回拍点。
 */
export function marksForTexts(narration, words, pieceTexts) {
  const plain = plainOf(narration);
  const list = Array.isArray(words) ? words : [];
  const texts = pieceTexts?.length ? pieceTexts : [''];
  let cursor = 0;
  return texts.map((piece, index) => {
    const needle = plainOf(piece).replace(/\s/g, '');
    let atMs = null;
    if (needle) {
      const from = plain.indexOf(needle, cursor);
      const hit = from >= 0 ? from : plain.indexOf(needle);
      if (hit >= 0 && list.length) {
        atMs = indexToStartMs(list, hit);
        cursor = hit + needle.length;
      }
    }
    if (atMs == null) {
      const word = list[Math.min(index, Math.max(0, list.length - 1))];
      atMs = word ? Number(word.startMs) || 0 : 0;
    }
    return LEAD_SEC + atMs / 1000;
  });
}

/**
 * 逐字（granularity 缺省或 char）标 word。
 * 逐词（word）或只有整句（sentence-interp）标 sentence。时间用 timing.mjs 已经分好的字，不另写一套。
 */
export function clockSource(granularity) {
  if (granularity === 'word' || granularity === 'sentence-interp') return 'sentence';
  return 'word';
}

/** 有旁白和时间戳的屏按粒度给 word 或 sentence；其余只给 beat。 */
export function clocksFor(screens, lines, textsOf) {
  const byIndex = new Map();
  for (const line of lines || []) byIndex.set(line.index, line);
  return (screens || []).map((screen, index) => {
    const narration = plainOf(screen?.narration || '').trim();
    const line = byIndex.get(index);
    if (!narration || !line?.words?.length) return {source: 'beat'};
    const texts = textsOf(screen);
    return {
      source: clockSource(line.granularity),
      marks: marksForTexts(narration, line.words, texts),
      duration: screenDurationFromAudio((line.durMs || 0) / 1000),
    };
  });
}

/** 一个 reveal 只能带自己那一家的字段。混了就返回原因，干净就返回空串。 */
export function timingExclusive(reveal) {
  if (!reveal || typeof reveal !== 'object') return '时间来源缺失';
  if (reveal.source === 'word') {
    if (reveal.kind !== 'tts-words' && reveal.kind !== 'talk-marks') return '逐字时间的种类不对';
    if ('bpm' in reveal || 'charsPerSec' in reveal) return '逐字时间混进了拍点';
    return '';
  }
  if (reveal.source === 'sentence') {
    if (reveal.kind !== 'tts-sentence' || reveal.resolution !== 'sentence-interp') return '时间来源不是逐字，也不是拍点';
    if ('bpm' in reveal || 'charsPerSec' in reveal) return '句级时间混进了拍点';
    return '';
  }
  if (reveal.source === 'beat') {
    if (reveal.kind !== 'promo-no-audio') return '拍点种类不对';
    if ('lead' in reveal) return '拍点混进了逐字提前量';
    return '';
  }
  return '时间来源不是逐字，也不是拍点';
}

export function boxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const CONTENT_KINDS = new Set(['card', 'stage', 'kicker', 'caption', 'evidence', 'plot', 'node']);

/** 字幕盒和标题、kicker、证据、数字、条目（以及说明条、绘图区）是否相交。不相交返回空数组。 */
export function captionHits(box, blocks) {
  return (blocks || []).filter((block) => {
    const kind = block?.kind || 'card';
    if (!CONTENT_KINDS.has(kind)) return false;
    return boxesOverlap(box, block);
  });
}

/**
 * 逐字字幕的盒子。固定在底部字幕带，不因为压到证据就改到顶部或说明条上。
 * coversCaption 恒为 false：屏上的说明照旧画，字幕只说还没写在屏上的那部分。
 */
export function captionBoxFor(screen, width, height = 1920, aspect) {
  const canvasH = Number(height) || 1920;
  const safe = screen?.safe || {x: 80, y: 80, w: Math.max(200, (Number(width) || 1080) - 160), h: Math.max(200, canvasH - 160)};
  const resolved = aspect || (canvasH >= 1600 ? '9:16' : canvasH >= 1200 ? '4:5' : '16:9');
  const box = captionBox({aspect: resolved, canvasH, safe});
  return {box, coversCaption: false};
}

function glyphTimeline(words) {
  const glyphs = [];
  for (const word of words || []) {
    const text = String(word?.text || '');
    const chars = [...text];
    const start = Number(word?.startMs) || 0;
    const end = Number(word?.endMs) || start;
    chars.forEach((ch, i) => {
      const at = LEAD_SEC + (start + ((end - start) * i) / Math.max(1, chars.length)) / 1000;
      glyphs.push({ch, at});
    });
  }
  return glyphs;
}

/** 把去重后的字幕对齐回逐字时间。对不上的空格沿用前一个字的时刻。 */
export function alignSpoken(narration, words, spoken) {
  const glyphs = glyphTimeline(words);
  let cursor = 0;
  const out = [];
  for (const ch of [...String(spoken || '')]) {
    if (ch === '\n') continue;
    let found = -1;
    for (let i = cursor; i < glyphs.length; i++) {
      if (glyphs[i].ch === ch) {
        found = i;
        break;
      }
    }
    if (found >= 0) {
      out.push({ch, at: glyphs[found].at});
      cursor = found + 1;
    } else {
      const prev = out[out.length - 1];
      out.push({ch, at: prev ? prev.at : LEAD_SEC});
    }
  }
  return out;
}

function visibleChars(page) {
  return (page?.chars || []).filter((item) => item.ch !== '\n');
}

function pageText(page) {
  return visibleChars(page).map((item) => item.ch).join('');
}

function holdSec(page, next, screenEndSec) {
  const until = next ? next.startSec : (Number.isFinite(screenEndSec) ? screenEndSec : page.endSec);
  return Math.max(0, until - page.startSec);
}

function isOrphan(page, next, screenEndSec) {
  if (plainChars(pageText(page)).length < CAPTION_ORPHAN_MIN_CHARS) return true;
  return holdSec(page, next, screenEndSec) < CAPTION_ORPHAN_MIN_SEC;
}

/** 两段拼成一页。按词断行，超过两行或装不进字幕带宽度就返回 null。逐字时刻原样保留。 */
function mergeCaptionPages(left, right, maxW, minPx) {
  const chars = [...visibleChars(left), ...visibleChars(right)];
  if (!chars.length) return null;
  const text = chars.map((item) => item.ch).join('');
  const lo = Math.max(1, Math.min(CAPTION_FONT_MAX, Math.floor(Number(minPx) || 40)));
  const fitted = fitSceneCopy(text, Math.max(8, maxW - 16), CAPTION_FONT_MAX, lo);
  const lines = fitted.lines.length ? fitted.lines : [text];
  if (lines.length > 2 || lines.join('') !== text) return null;
  const out = [];
  let cursor = 0;
  let broken = false;
  lines.forEach((line, lineIndex) => {
    if (broken) return;
    if (lineIndex) {
      const prev = out[out.length - 1];
      out.push({ch: '\n', at: prev ? prev.at : chars[0].at});
    }
    for (const ch of [...line]) {
      const src = chars[cursor];
      if (!src || src.ch !== ch) {
        broken = true;
        return;
      }
      out.push({ch: src.ch, at: src.at});
      cursor += 1;
    }
  });
  if (broken || cursor !== chars.length) return null;
  const visible = out.filter((item) => item.ch !== '\n');
  return {
    startSec: visible[0].at,
    endSec: visible[visible.length - 1].at,
    font: fitted.font,
    chars: out,
  };
}

/**
 * 孤段先并进前一段，并不进去再并进后一段。并完仍超出字幕带宽度就丢掉这一段。
 * 没被丢掉的字，点亮时刻保持原值。
 */
export function foldShortCaptions(pages, maxW, minPx, screenEndSec) {
  const list = (pages || []).map((page) => ({...page, chars: (page.chars || []).map((item) => ({...item}))}));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      const next = list[i + 1];
      if (!isOrphan(list[i], next, screenEndSec)) continue;
      if (i > 0) {
        const merged = mergeCaptionPages(list[i - 1], list[i], maxW, minPx);
        if (merged) {
          list.splice(i - 1, 2, merged);
          changed = true;
          break;
        }
      }
      if (i + 1 < list.length) {
        const merged = mergeCaptionPages(list[i], list[i + 1], maxW, minPx);
        if (merged) {
          list.splice(i, 2, merged);
          changed = true;
          break;
        }
      }
    }
  }
  return list.filter((page, index) => !isOrphan(page, list[index + 1], screenEndSec));
}

/**
 * 去重后的字幕排进底部带。先缩字号，不低于正文下限；仍超过两行就按词断成多页。
 * 断行用 fitSceneCopy，不另写分词。短段再按 foldShortCaptions 并进邻段或丢掉。
 */
export function pagesForCaption(narration, words, spoken, maxW, minPx, screenEndSec) {
  const text = String(spoken || '').trim();
  if (!text) return [];
  const timed = alignSpoken(narration, words, text);
  if (!timed.length) return [];
  const lo = Math.max(1, Math.min(CAPTION_FONT_MAX, Math.floor(Number(minPx) || 40)));
  const fitted = fitSceneCopy(text, Math.max(8, maxW - 16), CAPTION_FONT_MAX, lo);
  const lines = fitted.lines.length ? fitted.lines : [text];
  const pages = [];
  let cursor = 0;
  const take = (ch) => {
    while (cursor < timed.length && timed[cursor].ch !== ch) cursor += 1;
    const hit = timed[Math.min(cursor, Math.max(0, timed.length - 1))];
    if (cursor < timed.length && timed[cursor].ch === ch) cursor += 1;
    return {ch, at: hit ? hit.at : LEAD_SEC};
  };
  for (let i = 0; i < lines.length; i += 2) {
    const chunk = lines.slice(i, i + 2);
    const chars = [];
    chunk.forEach((line, lineIndex) => {
      if (lineIndex) {
        const prev = chars[chars.length - 1];
        chars.push({ch: '\n', at: prev ? prev.at : LEAD_SEC});
      }
      for (const ch of [...line]) chars.push(take(ch));
    });
    const visible = chars.filter((item) => item.ch !== '\n');
    if (!visible.length) continue;
    const startSec = visible[0].at;
    const endSec = visible[visible.length - 1].at;
    pages.push({startSec, endSec, font: fitted.font, chars});
  }
  return foldShortCaptions(pages, maxW, lo, screenEndSec);
}

function charsOfPage(page, words) {
  const slice = words.slice(page.from, page.to);
  const timed = [];
  for (const word of slice) {
    const glyphs = [...String(word?.text || '')];
    const start = Number(word?.startMs) || 0;
    const end = Number(word?.endMs) || start;
    glyphs.forEach((ch, i) => {
      const at = LEAD_SEC + (start + ((end - start) * i) / Math.max(1, glyphs.length)) / 1000;
      timed.push({ch, at});
    });
  }
  const chars = [];
  let cursor = 0;
  for (const ch of String(page.text || '')) {
    if (ch === '{' || ch === '}') continue;
    if (ch === '\n') {
      chars.push({ch, at: chars.length ? chars[chars.length - 1].at : LEAD_SEC});
      continue;
    }
    while (cursor < timed.length && timed[cursor].ch !== ch) cursor += 1;
    const hit = timed[Math.min(cursor, Math.max(0, timed.length - 1))];
    chars.push({ch, at: hit ? hit.at : LEAD_SEC});
    if (cursor < timed.length && timed[cursor].ch === ch) cursor += 1;
  }
  return chars.filter((item) => item.ch !== '');
}

/** 卡拉 OK 页。时刻是相对本屏的秒，已经加上前留白。 */
export function pagesFor(words) {
  const list = Array.isArray(words) ? words : [];
  if (!list.length) return [];
  return paginate(list, {lang: 'zh', lineMax: 12, maxLines: 2})
    .map((page) => ({
      startSec: LEAD_SEC + (Number(page.startMs) || 0) / 1000,
      endSec: LEAD_SEC + (Number(page.endMs) || 0) / 1000,
      chars: charsOfPage(page, list),
    }))
    .filter((page) => page.chars.some((item) => item.ch !== '\n'));
}
