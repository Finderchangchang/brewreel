// 标题和大字断行：英文单词、连续拉丁产品名、数字串（含汉字数字和「第…条」）内部不断开。
// 中文按 Intl.Segmenter('zh', {granularity:'word'}) 的词边界断开。两行取视觉宽度最接近的切法，
// 一样匀时上行不短于下行。宽度估算和 template/src/core/fit.ts 的 emWidth 一致。

export const WORD_JOINER = '⁠';

const isWide = (cp) =>
  (cp >= 0x2e80 && cp <= 0x9fff) ||
  (cp >= 0xac00 && cp <= 0xd7af) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xff60) ||
  (cp >= 0xffe0 && cp <= 0xffe6) ||
  (cp >= 0x3000 && cp <= 0x303f) ||
  cp === 0x201c || cp === 0x201d || cp === 0x2018 || cp === 0x2019 || cp === 0x2026 || cp === 0x00b7;

export const emWidth = (text) => {
  let w = 0;
  for (const ch of Array.from(String(text).replace(/[{}⁠]/gu, ''))) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === ' ') w += 0.3;
    else if (isWide(cp)) w += 1;
    else w += 0.55;
  }
  return w;
};

const LATIN = /^[A-Za-z][A-Za-z0-9.+#_-]*$/u;
const NUMERAL = /^[零〇一二两三四五六七八九十百千万亿]+$/u;
const DIGIT = /^[0-9０-９]+$/u;
const CLASSIFIER = /^[条章节款项目号]$/u;
const CLOSE = /^[，。！？、；：,.!?;:）)】》」』”’]+$/u;
const OPEN = /^[（(【《「『“‘]+$/u;

const segmenter = () => new Intl.Segmenter('zh', {granularity: 'word'});

const takeNumber = (raw, start) => {
  let end = raw[start].end;
  let j = start;
  let dated = false;
  while (j < raw.length) {
    if (NUMERAL.test(raw[j].text) || DIGIT.test(raw[j].text)) {
      end = raw[j].end;
      j += 1;
      continue;
    }
    const sep = raw[j].text;
    if ((sep === '-' || sep === '.' || sep === '/' || sep === '－' || sep === '—') && j + 1 < raw.length && DIGIT.test(raw[j + 1].text)) {
      dated = true;
      end = raw[j + 1].end;
      j += 2;
      continue;
    }
    break;
  }
  if (!dated && j < raw.length && CLASSIFIER.test(raw[j].text)) {
    end = raw[j].end;
    j += 1;
  }
  return {end, next: j};
};

/** @returns {{text: string, start: number, end: number}[]} 下标对齐传入的原文 */
export function titleSpans(text) {
  const src = String(text);
  const raw = [...segmenter().segment(src)].map((part) => ({
    text: part.segment,
    start: part.index,
    end: part.index + part.segment.length,
  }));
  const atoms = [];
  for (let i = 0; i < raw.length; i += 1) {
    const s = raw[i];
    if (s.text.trim() === '') continue;
    if (LATIN.test(s.text)) {
      let end = s.end;
      while (i + 2 < raw.length && raw[i + 1].text === ' ' && LATIN.test(raw[i + 2].text)) {
        end = raw[i + 2].end;
        i += 2;
      }
      atoms.push({text: src.slice(s.start, end), start: s.start, end});
      continue;
    }
    if (s.text === '第' && i + 1 < raw.length && (NUMERAL.test(raw[i + 1].text) || DIGIT.test(raw[i + 1].text))) {
      const taken = takeNumber(raw, i + 1);
      atoms.push({text: src.slice(s.start, taken.end), start: s.start, end: taken.end});
      i = taken.next - 1;
      continue;
    }
    if (NUMERAL.test(s.text) || DIGIT.test(s.text)) {
      const taken = takeNumber(raw, i);
      atoms.push({text: src.slice(s.start, taken.end), start: s.start, end: taken.end});
      i = taken.next - 1;
      continue;
    }
    atoms.push(s);
  }
  const merged = [];
  for (const atom of atoms) {
    const prev = merged[merged.length - 1];
    if (CLOSE.test(atom.text) && prev) merged[merged.length - 1] = {text: src.slice(prev.start, atom.end), start: prev.start, end: atom.end};
    else merged.push(atom);
  }
  const out = [];
  for (let i = 0; i < merged.length; i += 1) {
    if (OPEN.test(merged[i].text) && i + 1 < merged.length) {
      const nxt = merged[i + 1];
      out.push({text: src.slice(merged[i].start, nxt.end), start: merged[i].start, end: nxt.end});
      i += 1;
    } else out.push(merged[i]);
  }
  // 「不 / 没」常被分词器从后面的词上撕开。「不可以」要整词留下，断行和 protectBreaks 都走这里。
  const glued = [];
  for (let i = 0; i < out.length; i += 1) {
    const nxt = out[i + 1];
    if (nxt && out[i].end === nxt.start && /[不没]$/u.test(out[i].text)) {
      glued.push({text: src.slice(out[i].start, nxt.end), start: out[i].start, end: nxt.end});
      i += 1;
    } else glued.push(out[i]);
  }
  return glued;
}

export function titleAtoms(text) {
  return titleSpans(text).map((atom) => atom.text);
}

/**
 * @param {string} text
 * @param {{forceTwo?: boolean, maxEm?: number, maxLines?: number}} [options]
 * forceTwo：封面把放得下一行的标题也断成两行。否则只有超过 maxEm 才断。
 * maxLines 大于 2 时按词边界贪心折行，单行尽量不超过 maxEm，最后一行吃掉剩余词。
 * @returns {string[]}
 */
export function titleLines(text, options = {}) {
  const clean = String(text ?? '').replace(/[ \t]+/gu, ' ').trim();
  if (!clean) return [''];
  const forceTwo = options.forceTwo === true;
  const maxEm = Number.isFinite(options.maxEm) ? options.maxEm : Number.POSITIVE_INFINITY;
  const maxLines = Math.max(1, Math.floor(options.maxLines ?? 2));
  const atoms = titleSpans(clean);
  if (maxLines === 1 || atoms.length < 2) return [clean];
  if (!forceTwo && emWidth(clean) <= maxEm + 1e-6) return [clean];
  if (maxLines === 2) {
    let best = null;
    for (let i = 1; i < atoms.length; i += 1) {
      const left = clean.slice(atoms[0].start, atoms[i - 1].end).trim();
      const right = clean.slice(atoms[i].start, atoms[atoms.length - 1].end).trim();
      if (!left || !right) continue;
      const wa = emWidth(left);
      const wb = emWidth(right);
      const cost = Math.max(wa, wb) + (wb > wa + 1e-6 ? 0.02 : 0);
      if (!best || cost < best.cost - 1e-9) best = {cost, lines: [left, right]};
    }
    return best ? best.lines : [clean];
  }
  const lines = [];
  let i = 0;
  while (i < atoms.length) {
    const last = lines.length >= maxLines - 1;
    if (last) {
      const rest = clean.slice(atoms[i].start, atoms[atoms.length - 1].end).trim();
      if (rest) lines.push(rest);
      break;
    }
    let best = i;
    for (let j = i; j < atoms.length; j += 1) {
      const slice = clean.slice(atoms[i].start, atoms[j].end).trim();
      if (j > i && emWidth(slice) > maxEm + 1e-6) break;
      best = j;
      if (emWidth(slice) > maxEm + 1e-6) break;
    }
    const line = clean.slice(atoms[i].start, atoms[best].end).trim();
    if (line) lines.push(line);
    i = best + 1;
  }
  return lines.length ? lines : [clean];
}

/** 钩子和封面：从 1 行试到 maxLines，每行都不超过 maxEm 就停。拆不开的超长词仍单独成行。 */
export function fitHookLines(text, maxEm, maxLines = 6) {
  const clean = String(text ?? '').replace(/[ \t]+/gu, ' ').trim();
  if (!clean) return [];
  const cap = Math.max(1, maxLines);
  let last = [clean];
  for (let n = 1; n <= cap; n += 1) {
    const lines = titleLines(clean, {maxEm, maxLines: n});
    last = lines;
    if (lines.every((line) => emWidth(line) <= maxEm + 0.08)) return lines;
  }
  return last;
}

/** 封面标题：在字号区间里取放得下的最大字号，2–4 行，不截断、不加省略号。 */
export function coverTitleLayout(text, {width, minPx, maxPx, maxLines = 4} = {}) {
  const clean = String(text ?? '').replace(/[ \t]+/gu, ' ').trim();
  const box = Math.max(1, width ?? 1);
  const lo = Math.max(1, Math.floor(minPx ?? 48));
  const hi = Math.max(lo, Math.floor(maxPx ?? lo));
  for (let size = hi; size >= lo; size -= 2) {
    const maxEm = box / size;
    const lines = titleLines(clean, {maxEm, maxLines});
    const widest = Math.max(1, ...lines.map((line) => emWidth(line)));
    if (lines.length <= maxLines && widest * size <= box + 1) return {lines, size, em: widest};
  }
  const lines = titleLines(clean, {maxEm: box / lo, maxLines});
  const widest = Math.max(1, ...lines.map((line) => emWidth(line)));
  return {lines, size: Math.max(48, Math.min(lo, Math.floor(box / widest))), em: widest};
}

/** 在不可断开的片段内部插入 WORD JOINER，交给 word-break:normal 的容器自动换行。原文空格保留。 */
export function protectBreaks(text) {
  return String(text ?? '').split('\n').map((line) => {
    const atoms = titleSpans(line);
    let out = '';
    let cursor = 0;
    for (const atom of atoms) {
      out += line.slice(cursor, atom.start);
      out += Array.from(atom.text).join(WORD_JOINER);
      cursor = atom.end;
    }
    return out + line.slice(cursor);
  }).join('\n');
}
