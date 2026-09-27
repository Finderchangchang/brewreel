// ============================================================
// 旁白时间轴：分词、按字数与标点加权估算字级时间戳、解析接口给的字幕时间戳、强调标记、字幕分页。
//
// 约定（voice.json 的 words / pages 都按这个来）：
//   - 旁白文本里的 {} 是强调，不念出来；plain = 去掉 {} 的文本。
//   - words[k].text 是 plain 的一段连续切片（含它后面跟着的标点和空格），所有 words 的 text 顺序拼起来 = plain（去首尾空白）。
//     中文一个汉字一个 word；拉丁字母/数字连成一个 word。
//   - words / pages 的 startMs / endMs 都相对「这句音频的开头」（镜头内时间 = line.startMs + word.startMs）。
// ============================================================

const CJK = /[㐀-鿿豈-﫿]/;
const WORDCH = /[A-Za-z0-9À-ɏ'’%％.]/;
const WORD_START = /[A-Za-z0-9À-ɏ]/;
const SENT_END = /[。！？!?…]/;
const CLAUSE = /[，、；：,;:—]/;
const OPENERS = /[「『“‘（(《〈"']/;
const isSpace = (ch) => /\s/.test(ch);

export const plainOf = (s) => String(s ?? '').replace(/[{}]/g, '');

/** 中文数字读法的大致音节数：2026 → 4（二零二六）或 3 位以内按「两千零二十六」那样多读几个字 */
const digitSyllables = (d) => (d.length <= 2 ? d.length : d.length <= 4 ? d.length + 1 : d.length);
/** 英文单词的音节数（元音组计数的粗估） */
const enSyllables = (w) => {
  const s = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return Math.max(1, w.replace(/[^0-9]/g, '').length);
  const groups = s.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
};

/**
 * 切成念读单位。返回 [{text, start, end, weight, pause}]：
 *   text = plain.slice(start, end)（含后面粘着的标点、空格）；weight = 念它要几个「音节单位」；pause = 它后面的停顿（单位同 weight）
 * @param {string} plain 去掉 {} 的旁白
 * @param {'zh'|'en'} lang
 */
export const tokenize = (plain, lang = 'zh') => {
  const s = String(plain);
  const toks = [];
  let i = 0;
  let pendingStart = null; // 开头的引号等，粘到下一个 token
  while (i < s.length) {
    const ch = s[i];
    if (isSpace(ch) || (!CJK.test(ch) && !WORD_START.test(ch))) {
      // 标点 / 空格：粘到前一个 token（开引号粘到后一个）
      if (OPENERS.test(ch) && (!toks.length || isSpace(s[i - 1] ?? ' ') || CLAUSE.test(s[i - 1] ?? '') || SENT_END.test(s[i - 1] ?? ''))) {
        if (pendingStart === null) pendingStart = i;
      } else if (toks.length) {
        const t = toks[toks.length - 1];
        t.end = i + 1;
        if (SENT_END.test(ch) || ch === '.' ) t.pause = Math.max(t.pause, 1.2);
        else if (CLAUSE.test(ch)) t.pause = Math.max(t.pause, 0.7);
        else if (!isSpace(ch)) t.pause = Math.max(t.pause, 0.15);
      } else if (pendingStart === null) pendingStart = i;
      i++;
      continue;
    }
    const start = pendingStart ?? i;
    pendingStart = null;
    if (CJK.test(ch)) {
      toks.push({text: '', start, end: i + 1, weight: 1, pause: 0});
      i++;
      continue;
    }
    let j = i + 1;
    while (j < s.length && WORDCH.test(s[j]) && !CJK.test(s[j])) {
      // 句点 / 撇号只在词中间（3.5、don't）算词的一部分；% 只跟在数字后面
      if ((s[j] === '.' || s[j] === "'" || s[j] === '’') && !WORD_START.test(s[j + 1] ?? '')) break;
      j++;
    }
    const word = s.slice(i, j);
    const isNum = /^[0-9.%％]+$/.test(word);
    const weight = lang === 'en' ? (isNum ? Math.max(1, word.replace(/[^0-9]/g, '').length * 0.8) : enSyllables(word)) : isNum ? digitSyllables(word.replace(/[^0-9]/g, '')) : Math.max(1, enSyllables(word));
    toks.push({text: '', start, end: j, weight, pause: 0});
    i = j;
  }
  if (pendingStart !== null && toks.length) toks[toks.length - 1].end = s.length;
  for (const t of toks) t.text = s.slice(t.start, t.end);
  // 句末那个 token 不算停顿（音频本身就在那儿结束）
  if (toks.length) toks[toks.length - 1].pause = 0;
  return toks;
};

/** 念读单位总数（weight + pause），语速估算、mock 合成共用 */
export const spokenUnits = (plain, lang = 'zh') => tokenize(plain, lang).reduce((a, t) => a + t.weight + t.pause, 0);

/**
 * 「按字数与标点加权」估算字级时间戳：把 [fromMs, toMs] 按 weight + pause 分给每个 token。
 * @returns {{text: string, startMs: number, endMs: number}[]}
 */
export const estimateWords = (plain, fromMs, toMs, lang = 'zh', toks = tokenize(plain, lang)) => {
  const total = toks.reduce((a, t) => a + t.weight + t.pause, 0) || 1;
  const span = Math.max(0, toMs - fromMs);
  let t = fromMs;
  return toks.map((k) => {
    const a = t;
    const b = a + (span * k.weight) / total;
    t = b + (span * k.pause) / total;
    return {text: k.text, startMs: Math.round(a), endMs: Math.round(b)};
  });
};

// ---------------- 解析接口返回的字幕时间戳（字段名宽松匹配） ----------------
const pick = (o, keys) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};
const T_BEGIN = ['time_begin', 'begin_time', 'start_time', 'timeBegin', 'beginTime', 'startTime', 'start_ms', 'startMs', 'begin', 'start', 'from'];
const T_END = ['time_end', 'end_time', 'stop_time', 'timeEnd', 'endTime', 'stopTime', 'end_ms', 'endMs', 'end', 'stop', 'to'];
const T_TEXT = ['text', 'word', 'content', 'sentence', 'token', 'char', 'value'];
const T_WORDS = ['timestamped_words', 'words', 'word_list', 'wordList', 'tokens', 'chars', 'timestamps'];

const entryOf = (e) => {
  if (!e || typeof e !== 'object') return null;
  const text = pick(e, T_TEXT);
  const b = Number(pick(e, T_BEGIN));
  const en = Number(pick(e, T_END));
  if (typeof text !== 'string' || !Number.isFinite(b) || !Number.isFinite(en)) return null;
  return {text, b, e: en, inner: pick(e, T_WORDS)};
};

/** 把字幕 JSON 拆成 {sentences:[{text,b,e}], words:[{text,b,e}]}（毫秒；看起来像秒的自动 ×1000） */
export const flattenSubtitle = (json, durMs) => {
  let list = json;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return {sentences: [], words: []};
    }
  }
  if (!Array.isArray(list)) list = pick(list ?? {}, ['subtitles', 'subtitle', 'sentences', 'data', 'result', 'segments', 'items']) ?? [];
  if (!Array.isArray(list)) return {sentences: [], words: []};
  const sentences = [];
  const words = [];
  for (const raw of list) {
    const s = entryOf(raw);
    if (!s) continue;
    sentences.push({text: s.text, b: s.b, e: s.e});
    if (Array.isArray(s.inner)) for (const w of s.inner) {
      const x = entryOf(w);
      if (x) words.push({text: x.text, b: x.b, e: x.e});
    }
  }
  // 单位：最大时间只和「音频秒数」一个量级（毫秒的话会是它的上千倍）→ 是秒
  const all = [...sentences, ...words].flatMap((x) => [x.b, x.e]);
  if (all.length && (durMs ?? 0) >= 300 && Math.max(...all) <= (durMs / 1000) * 1.2 + 0.5) for (const x of [...sentences, ...words]) (x.b *= 1000), (x.e *= 1000);
  // 整条都是单字/单词的句子数组 → 其实就是字级
  if (!words.length && sentences.length >= 2 && sentences.every((x) => Array.from(x.text.replace(/[\s\p{P}]/gu, '')).length <= 1 || /^[A-Za-z0-9'’-]+[\p{P}\s]*$/u.test(x.text.trim())))
    return {sentences: [], words: sentences};
  return {sentences, words};
};

const norm = (s) => Array.from(String(s).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, ''));

/** 我们 token 的每个「有效字符」（去空白标点）→ 所属 token 下标 */
const charMap = (toks) => {
  const out = [];
  toks.forEach((t, k) => {
    for (const ch of norm(t.text)) out.push({ch, k});
  });
  return out;
};

/** 顺序对齐两串字符（允许少量增删）。返回 ours[i] 对到 theirs 的下标（没对上 = -1）与命中率 */
const align = (ours, theirs) => {
  const m = new Array(ours.length).fill(-1);
  let i = 0;
  let j = 0;
  let hit = 0;
  while (i < ours.length && j < theirs.length) {
    if (ours[i] === theirs[j]) {
      m[i++] = j++;
      hit++;
      continue;
    }
    let moved = false;
    for (let d = 1; d <= 3 && !moved; d++) {
      if (theirs[j + d] === ours[i]) (j += d), (moved = true);
      else if (ours[i + d] === theirs[j]) (i += d), (moved = true);
    }
    if (!moved) i++, j++;
  }
  return {m, ratio: ours.length ? hit / ours.length : 0};
};

/**
 * 接口给了字幕时间戳：尽量落到我们的 token 上。
 * @returns {{words: {text,startMs,endMs}[], granularity: 'char'|'word'|'sentence-interp'}}
 */
export const wordsFromSubtitle = (plain, lang, durMs, subtitleJson) => {
  const toks = tokenize(plain, lang);
  const {sentences, words} = flattenSubtitle(subtitleJson, durMs);
  const ours = charMap(toks);
  // 1) 字级 / 词级：把对方每个字符的时间铺开，再按字符对齐到我们的 token
  if (words.length) {
    const theirs = [];
    for (const w of words) {
      const cs = norm(w.text);
      cs.forEach((ch, k) => theirs.push({ch, b: w.b + ((w.e - w.b) * k) / cs.length, e: w.b + ((w.e - w.b) * (k + 1)) / cs.length}));
    }
    const {m, ratio} = align(ours.map((x) => x.ch), theirs.map((x) => x.ch));
    if (ratio >= 0.7) {
      const span = toks.map(() => ({b: Infinity, e: -Infinity}));
      m.forEach((j, i) => {
        if (j < 0) return;
        const s = span[ours[i].k];
        s.b = Math.min(s.b, theirs[j].b);
        s.e = Math.max(s.e, theirs[j].e);
      });
      fillGaps(span, 0, durMs);
      return {words: toks.map((t, k) => ({text: t.text, startMs: Math.round(span[k].b), endMs: Math.round(Math.max(span[k].b, span[k].e))})), granularity: lang === 'en' ? 'word' : 'char'};
    }
  }
  // 2) 只有句级：每句的时间段内按字数与标点加权
  if (sentences.length) {
    const out = [];
    let k = 0;
    for (const s of sentences) {
      const need = norm(s.text).length;
      const start = k;
      let got = 0;
      while (k < toks.length && got < need) got += norm(toks[k++].text).length;
      if (k === start) continue;
      const sub = toks.slice(start, k);
      out.push(...estimateWords(sub.map((t) => t.text).join(''), s.b, s.e, lang, sub));
    }
    if (k < toks.length) {
      const last = out.length ? out[out.length - 1].endMs : 0;
      const rest = toks.slice(k);
      out.push(...estimateWords('', last, Math.max(last, durMs), lang, rest));
    }
    if (out.length === toks.length) return {words: out, granularity: 'sentence-interp'};
  }
  // 3) 什么都没有：整句时长内估算
  return {words: estimateWords(plain, 0, durMs, lang, toks), granularity: 'sentence-interp'};
};

/** 没对上的 token 用前后已知时间线性插值 */
const fillGaps = (span, from, to) => {
  const n = span.length;
  for (let k = 0; k < n; k++) {
    if (Number.isFinite(span[k].b)) continue;
    let a = k - 1;
    while (a >= 0 && !Number.isFinite(span[a].b)) a--;
    let z = k;
    while (z < n && !Number.isFinite(span[z].b)) z++;
    const t0 = a >= 0 ? span[a].e : from;
    const t1 = z < n ? span[z].b : to;
    const cnt = z - (a + 1);
    for (let q = 0; q < cnt; q++) {
      span[a + 1 + q].b = t0 + ((t1 - t0) * q) / cnt;
      span[a + 1 + q].e = t0 + ((t1 - t0) * (q + 1)) / cnt;
    }
    k = z - 1;
  }
};

// ---------------- 强调与字幕分页 ----------------
/** 旁白原文（含 {}）→ plain 里每个字符是否在 {} 里 */
export const hotMask = (vo) => {
  const mask = [];
  let depth = 0;
  for (const ch of String(vo ?? '')) {
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    else for (let k = 0; k < ch.length; k++) mask.push(depth > 0);
  }
  return mask;
};

/** 给 words 标 hot（按 plain 里的字符位置；words 由 tokenize 切出时位置精确） */
export const markHot = (vo, words) => {
  const plain = plainOf(vo);
  const mask = hotMask(vo);
  let pos = 0;
  return words.map((w) => {
    const at = plain.indexOf(w.text, pos);
    const start = at >= 0 ? at : pos;
    const end = start + w.text.length;
    pos = end;
    const hot = mask.slice(start, end).some((x, k) => x && !/[\s\p{P}]/u.test(plain[start + k]));
    return hot ? {...w, hot: true} : w;
  });
};

const wide = (ch) => CJK.test(ch) || /[　-〿＀-￯“”‘’…·]/.test(ch);
const unitsOf = (s, lang) => (lang === 'en' ? Array.from(s).length : Array.from(s).reduce((a, ch) => a + (wide(ch) ? 1 : 0.5), 0));
const TRIM_END = /[\s，。、；：,.;:—]+$/;

/**
 * 字幕分页：每页最多 maxLines 行，每行不超过 lineMax（中文按字、拉丁半个；英文按字符）。
 * 优先在句末断页、在逗号处断行；行尾的逗号句号去掉（？！保留）。
 * @returns {{text: string, from: number, to: number, startMs: number, endMs: number}[]}  text 带 {} 和 \n，可直接交给字幕组件
 */
export const paginate = (words, {lang = 'zh', lineMax = lang === 'en' ? 22 : 12, maxLines = 2} = {}) => {
  const pages = [];
  let page = [];
  let line = [];
  let lineU = 0;
  const flushLine = () => {
    if (line.length) page.push(line);
    line = [];
    lineU = 0;
  };
  const flushPage = () => {
    flushLine();
    if (page.length) pages.push(page);
    page = [];
  };
  words.forEach((w, k) => {
    const u = unitsOf(w.text.replace(/\s+$/, ''), lang);
    if (line.length && lineU + u > lineMax) {
      flushLine();
      if (page.length >= maxLines) flushPage();
    }
    line.push(k);
    lineU += unitsOf(w.text, lang);
    const t = w.text.trim();
    const pageU = page.reduce((a, l) => a + l.reduce((b, i) => b + unitsOf(words[i].text, lang), 0), 0) + lineU;
    if (SENT_END.test(t.slice(-1)) && pageU >= 4) flushPage();
    else if (CLAUSE.test(t.slice(-1)) && lineU >= lineMax * 0.6) {
      flushLine();
      if (page.length >= maxLines) flushPage();
    }
  });
  flushPage();
  return pages.map((ls) => {
    const idx = ls.flat();
    const text = ls
      .map((l) => {
        let out = '';
        let open = false;
        l.forEach((i, n) => {
          const w = words[i];
          let s = n === l.length - 1 ? w.text.replace(TRIM_END, '') : w.text;
          if (lang === 'en' && n === l.length - 1) s = s.replace(/\s+$/, '');
          if (w.hot && !open) (out += '{'), (open = true);
          if (!w.hot && open) {
            // 右花括号放在词和它后面的空格之间
            out = out.replace(/(\s*)$/, '}$1');
            open = false;
          }
          out += s;
        });
        if (open) out = out.replace(/([\s，。、；：,.;:！？!?]*)$/, '}$1');
        return out.trim();
      })
      .join('\n');
    return {text, from: idx[0], to: idx[idx.length - 1] + 1, startMs: words[idx[0]].startMs, endMs: words[idx[idx.length - 1]].endMs};
  });
};
