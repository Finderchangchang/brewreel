// 场景配音的时间。逐字和拍点各走各的函数，不合成一个再丢掉来源。
import {LEAD_SEC, TAIL_SEC} from '../lib/tts/pipeline.mjs';
import {paginate, plainOf} from '../lib/tts/timing.mjs';

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

/** 有旁白和时间戳的屏只给 word；其余只给 beat。 */
export function clocksFor(screens, lines, textsOf) {
  const byIndex = new Map();
  for (const line of lines || []) byIndex.set(line.index, line);
  return (screens || []).map((screen, index) => {
    const narration = plainOf(screen?.narration || '').trim();
    const line = byIndex.get(index);
    if (!narration || !line?.words?.length) return {source: 'beat'};
    const texts = textsOf(screen);
    return {
      source: 'word',
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

function hitsEvidence(box, blocks) {
  return (blocks || []).some((block) => (block.kind === 'evidence' || block.kind === 'plot') && boxesOverlap(box, block));
}

/**
 * 逐字字幕的盒子。先试宣传片字幕带；压到证据就改用本屏说明条；再不行就在安全区底部往上挪。
 * coversCaption 为真时，合成里不再画那条静态说明，避免叠两层字。
 */
export function captionBoxFor(screen, width) {
  const blocks = screen?.blocks || [];
  const safe = screen?.safe || {x: 80, y: 560, w: Math.max(200, width - 160), h: 1100};
  const classic = {x: Math.round(width * 0.12), y: 292, w: Math.round(width * 0.76), h: 160};
  if (!hitsEvidence(classic, blocks)) return {box: classic, coversCaption: false};
  const caption = blocks.find((block) => block.kind === 'caption');
  if (caption && !hitsEvidence(caption, blocks)) {
    return {box: {x: caption.x, y: caption.y, w: caption.w, h: caption.h}, coversCaption: true};
  }
  const stripH = 120;
  const box = {x: safe.x, y: safe.y, w: safe.w, h: stripH};
  let y = safe.y + safe.h - stripH;
  for (let step = 0; step < 14; step++) {
    box.y = y;
    if (box.y >= safe.y - 0.5 && !hitsEvidence(box, blocks)) return {box: {...box}, coversCaption: false};
    y -= 40;
  }
  return {box: {x: safe.x, y: safe.y, w: safe.w, h: stripH}, coversCaption: false};
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
