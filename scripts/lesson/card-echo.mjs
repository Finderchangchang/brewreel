/** 卡片和旁白几乎同一句话时给提示。不拦截交付。 */

const PUNCT = /[\s，。！？、；：,.!?;:'"“”‘’（）()【】\[\]《》<>…—\-·]/gu;
export const CARD_ECHO_HINT = '卡片写关键词，旁白讲完整的话';
export const SINGLE_CHAPTER_HINT = '全片只有 1 章，章节页不会单独成页，时长并到后一页';

export function normalizeEcho(text) {
  return String(text ?? '').replace(PUNCT, '');
}

export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 去标点后，编辑距离不超过较长串的 20%，或较短串至少 8 字且被包含。 */
export function textsEcho(card, sentence) {
  const a = normalizeEcho(card);
  const b = normalizeEcho(sentence);
  if (!a || !b) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= 8 && longer.includes(shorter)) return true;
  return editDistance(a, b) / Math.max(a.length, b.length) <= 0.2;
}

function pushLine(lines, value) {
  if (typeof value === 'string' && value.trim()) lines.push(value.trim());
}

export function cardLinesOf(page) {
  const lines = [];
  for (const item of page?.items ?? []) pushLine(lines, item);
  for (const key of ['subtitle', 'smallText', 'quote', 'source', 'emphasis', 'question', 'leftTitle', 'rightTitle']) pushLine(lines, page?.[key]);
  for (const key of ['options', 'steps', 'left', 'right', 'items']) {
    if (Array.isArray(page?.[key])) for (const item of page[key]) pushLine(lines, item);
  }
  if (Array.isArray(page?.callouts)) for (const box of page.callouts) pushLine(lines, box?.label);
  return [...new Set(lines)];
}

export function singleChapterWarning(lesson) {
  const chapters = Array.isArray(lesson?.chapters) ? lesson.chapters : [];
  if (chapters.length !== 1) return [];
  const hasChapterPage = (chapters[0]?.pages ?? []).some((page) => page?.layout === 'chapter');
  return hasChapterPage ? [SINGLE_CHAPTER_HINT] : [];
}

export function cardEchoWarnings(lesson) {
  const warnings = [];
  const chapters = Array.isArray(lesson?.chapters) ? lesson.chapters : [];
  chapters.forEach((chapter, ci) => {
    (chapter?.pages ?? []).forEach((page, pi) => {
      const sentences = (page?.narration ?? []).map((line) => line?.text).filter((text) => typeof text === 'string');
      const hit = cardLinesOf(page).some((line) => sentences.some((sentence) => textsEcho(line, sentence)));
      if (hit) warnings.push(`chapters[${ci}].pages[${pi}]：${CARD_ECHO_HINT}`);
    });
  });
  return warnings;
}
