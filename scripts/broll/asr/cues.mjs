// 逐字时间 → 词 → 句子（cue）→ 两行 → SRT。全是纯函数，好写单测。
// 输入是识别结果：tokens[i] 在 times[i] 秒出现（SenseVoice 的 CTC 帧，60 毫秒一格）；
// breaks 是每个识别块第一个 token 的下标（块边界强制作为新词开头，防止 quote + Nothing 粘成 quoteNothing）。
// 规则写死（不让模型自由发挥）：
//   必断：。？！；… 和英文 . ? ! ;
//   软断：，、：（中文本句满 4 个字 / 英文满 18 个字符才断；但和下一小段合起来不超过 12 个字 / 32 个字符、4.5 秒就不断）
//   过长：中文超过 16 个字、英文超过 42 个字符、或超过 6 秒，就在句内找最均衡、最像停顿的词边界拆开
//   停顿：两个字之间隔了 0.9 秒以上，且本句够长，也断
//   时间：起点 = 首字 − 0.05 秒，前面 0.45 秒内有静音结束点就取更早的；终点 = 末字 + 0.2 秒，后面紧跟静音起点就贴上去；
//         终点不晚于下一句起点 − 0.04 秒；一句至少 0.6 秒
//   文字：句尾标点去掉，句中逗号保留；中文超过 10 个字时按词边界断成两行，每行不超过 12 字

// mergeMax / mergeSec：逗号处本来该断，但和下一小段合起来仍不超过这个长度和时长，就不断（「花钱之后，它先报价」留在一句）。
export const RULES = {
  zh: {softMin: 4, pauseMin: 4, max: 16, maxSec: 6, mergeMax: 12, mergeSec: 4.5},
  en: {softMin: 18, pauseMin: 8, max: 42, maxSec: 6, mergeMax: 32, mergeSec: 4.5},
};
export const PAUSE_SEC = 0.9;
export const LINE_SPLIT_OVER = 10;
export const LINE_MAX = 12;

const HARD_RE = /[。！？!?；;…]/;
const SOFT_RE = /^[，,、：:]+$/;
const PUNCT_TOKEN_RE = /^[。！？!?；;…，,、：:.．"“”‘「」『』（）()《》【】〈〉<>—―~～〜]+$/;
// 连接符：挂在前一个词上，下一个片段也接上（don't、open-source、A/B）
const JOINER_RE = /^['’\-－/·&+]$/;
// 后缀：挂在前一个词上（20%、30℃）
const SUFFIX_RE = /^[%％℃]$/;
const WIDE_RE = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/;
const CJK_RE = /[぀-ヿ㐀-鿿가-힯豈-﫿]/;
const DIGIT_RE = /[0-9０-９]/;

export const isWide = (ch) => WIDE_RE.test(ch);
const isCjkStart = (s) => CJK_RE.test([...s][0] || '');
const endsCjk = (s) => CJK_RE.test([...s].pop() || '');

/** 显示宽度：中日韩字 1，拉丁字母/数字/空格 0.5。 */
export const widthOf = (s) => [...String(s)].reduce((n, ch) => n + (isWide(ch) ? 1 : 0.5), 0);

/** 句长：中文按字（拉丁字符算半个），英文按字符数（含空格，中文字算 2）。 */
export const unitsOf = (text, mode = 'zh') => (mode === 'en' ? [...String(text)].reduce((n, ch) => n + (isWide(ch) ? 2 : 1), 0) : widthOf(String(text).replace(/\s+/g, '')));

/** 识别语种 + 用户指定 → 切句模式。只有英文走 en，其余（中、粤、日、韩）都按中文规则。 */
export const modeOf = (lang, detected) => {
  const l = lang && lang !== 'auto' ? lang : detected;
  return l === 'en' ? 'en' : 'zh';
};

/**
 * 拼词。中文一字一词；英文以空格或 ▁ 开头的是新词；标点挂到前一个词上。
 * 强制作为新词开头：标点后面的第一个 token、每个识别块的第一个 token、空白 token 之后的 token。
 * 数字里的小数点（3.5）、百分号、英文缩写的撇号（don't）、连字符（open-source）不当标点。
 * @returns {Array<{text: string, t: number, tEnd: number, punct: string, latin: boolean}>}
 */
export const toWords = (tokens, times, breaks = [0]) => {
  const words = [];
  const brk = new Set(breaks);
  let pendingNew = true;
  let glueNext = false;
  const nextReal = (i) => {
    for (let j = i + 1; j < tokens.length; j++) {
      const c = String(tokens[j]).replace(/^[▁\s]+/, '');
      if (c) return {c, j};
    }
    return null;
  };
  for (let i = 0; i < tokens.length; i++) {
    const raw = String(tokens[i] ?? '');
    const t = Number(times[i] ?? 0);
    if (brk.has(i)) pendingNew = true;
    const clean = raw.replace(/^[▁\s]+/, '').replace(/\s+$/, '');
    if (!clean) {
      pendingNew = true;
      continue;
    }
    const last = words[words.length - 1];
    // 小数点：前一个词以数字结尾、下一个 token 以数字开头
    if ((clean === '.' || clean === '．') && last && !last.punct && DIGIT_RE.test(last.text.slice(-1))) {
      const nx = nextReal(i);
      if (nx && nx.j === i + 1 && DIGIT_RE.test(nx.c[0])) {
        last.text += '.';
        last.tEnd = t;
        glueNext = true;
        continue;
      }
    }
    if (SUFFIX_RE.test(clean) && last && !last.punct) {
      last.text += clean === '％' ? '%' : clean;
      last.tEnd = t;
      continue;
    }
    if (JOINER_RE.test(clean) && last && !last.punct && !endsCjk(last.text)) {
      const nx = nextReal(i);
      if (nx && nx.j === i + 1 && /^[A-Za-z0-9]/.test(nx.c)) {
        last.text += clean === '’' ? "'" : clean;
        last.tEnd = t;
        glueNext = true;
        continue;
      }
    }
    if (JOINER_RE.test(clean) || SUFFIX_RE.test(clean)) {
      // 前后接不上的连接符（单独的引号、破折号）不上屏
      pendingNew = true;
      glueNext = false;
      continue;
    }
    if (PUNCT_TOKEN_RE.test(clean)) {
      if (last) last.punct += clean;
      pendingNew = true;
      glueNext = false;
      continue;
    }
    const startsNew =
      !glueNext && (pendingNew || !last || /^[▁\s]/.test(raw) || isCjkStart(clean) || endsCjk(last.text) || Boolean(last.punct));
    if (startsNew) words.push({text: clean, t, tEnd: t, punct: '', latin: !isCjkStart(clean)});
    else {
      last.text += clean;
      last.tEnd = t;
    }
    pendingNew = false;
    glueNext = false;
  }
  return words;
};

const isHard = (p) => HARD_RE.test(p) || /\./.test(p);
const isSoft = (p) => Boolean(p) && SOFT_RE.test(p);

/** 把一组词拼成一句显示文字：句尾标点去掉，句中逗号保留，两个拉丁词之间加空格。 */
export const renderWords = (ws) =>
  ws
    .map((w, j) => {
      const sep = j > 0 && w.latin && ws[j - 1].latin ? ' ' : '';
      const p = j < ws.length - 1 && isSoft(w.punct) ? w.punct : '';
      return sep + w.text + p;
    })
    .join('');

const segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter('zh', {granularity: 'word'}) : null;

/**
 * 文字里哪些字符位置是词边界（Intl.Segmenter；没有就每个字都算）。
 * 返回 Map：位置 → 断在这里的额外扣分。词典不认识的词会被拆成单字（开|源、精|酿），
 * 所以两个单字之间、「这那哪几…」后面、「的了吗呢…」前面都加一点分，尽量不在这些地方断。
 */
const wordBoundaries = (text) => {
  const chars = [...text];
  const map = new Map();
  if (!segmenter) {
    for (let i = 1; i < chars.length; i++) map.set(i, 0);
    return map;
  }
  const segs = [...segmenter.segment(text)].map((x) => x.segment);
  let pos = 0;
  segs.forEach((seg, i) => {
    pos += [...seg].length;
    const next = segs[i + 1] || '';
    let pen = 0;
    if ([...seg].length === 1 && [...next].length === 1 && CJK_RE.test(seg) && CJK_RE.test(next)) pen += 1.5;
    if (/[这那哪每各某第几]$/.test(seg)) pen += 2.5;
    if (/^[的了着过吗呢吧啊么得地们]/.test(next)) pen += 2.5;
    map.set(pos, pen);
  });
  return map;
};

// 英文拆句：尽量断在这些词前面，别断在冠词、介词后面
const EN_BREAK_BEFORE = /^(and|but|or|so|because|when|while|before|after|then|which|that|if|until|to|with|for)$/i;
const EN_NO_BREAK_AFTER = /^(a|an|the|to|of|for|with|in|on|at|my|your|our|their|his|her|its|this|that|very|so)$/i;

// 句长前缀和：第 j 个词贡献「文字 + 句中逗号 + 英文词间空格」。ws[a..b) 的句长 = P[b] − P[a] − 句尾标点 − 句首空格。
// 和 unitsOf(renderWords(ws.slice(a, b))) 完全相等，但不用反复拼字符串（长音频没有标点时也不会变慢）。
const sepUnits = (ws, j, mode) => (mode === 'en' && j > 0 && ws[j].latin && ws[j - 1].latin ? 1 : 0);
const punctUnits = (w, mode) => (isSoft(w.punct) ? unitsOf(w.punct, mode) : 0);
const prefixUnits = (ws, mode) => {
  const p = [0];
  ws.forEach((w, j) => p.push(p[j] + unitsOf(w.text, mode) + punctUnits(w, mode) + sepUnits(ws, j, mode)));
  return (a, b) => (b <= a ? 0 : p[b] - p[a] - punctUnits(ws[b - 1], mode) - sepUnits(ws, a, mode));
};

/** 过长或过久的一句，在最均衡、最像停顿、又不拆词的边界一分为二，直到每段都合格。 */
const splitLong = (ws, mode) => {
  const R = RULES[mode];
  const range = prefixUnits(ws, mode);
  const units = range(0, ws.length);
  const dur = ws[ws.length - 1].tEnd - ws[0].t;
  if (ws.length < 2 || (units <= R.max && dur < R.maxSec)) return [ws];
  const flat = ws.map((w) => w.text).join('');
  const bounds = mode === 'zh' ? wordBoundaries(flat) : null;
  let best = null;
  let off = 0;
  for (let j = 0; j < ws.length - 1; j++) {
    off += [...ws[j].text].length;
    const left = range(0, j + 1);
    const right = range(j + 1, ws.length);
    const gap = ws[j + 1].t - ws[j].tEnd;
    let score = (Math.abs(left - right) / units) * 10;
    if (bounds) score += bounds.has(off) ? bounds.get(off) : 6;
    if (mode === 'en') {
      if (EN_BREAK_BEFORE.test(ws[j + 1].text)) score -= 2;
      if (EN_NO_BREAK_AFTER.test(ws[j].text)) score += 3;
    }
    score -= Math.min(Math.max(gap - 0.2, 0), 1) * 4;
    if (ws[j].punct) score -= 3;
    if (!best || score < best.score) best = {score, at: j + 1};
  }
  return [...splitLong(ws.slice(0, best.at), mode), ...splitLong(ws.slice(best.at), mode)];
};

/** 词 → 句子分组（还没算时间）。 */
export const groupWords = (words, mode = 'zh') => {
  const R = RULES[mode];
  const range = prefixUnits(words, mode);
  // 逗号后面那一小段（到下一个标点或长停顿为止）短到可以并进本句吗？
  const shortTail = (cs, i) => {
    let j = i + 1;
    if (j >= words.length || words[j].t - words[i].tEnd > PAUSE_SEC) return false;
    while (j + 1 < words.length && !words[j].punct && words[j + 1].t - words[j].tEnd <= PAUSE_SEC) j++;
    return range(cs, j + 1) <= R.mergeMax && words[j].tEnd - words[cs].t <= R.mergeSec;
  };
  const groups = [];
  let cs = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const units = range(cs, i + 1);
    const next = words[i + 1];
    const gap = next ? next.t - w.tEnd : Infinity;
    let cut = false;
    if (isHard(w.punct)) cut = true;
    else if (isSoft(w.punct) && units >= R.softMin && !shortTail(cs, i)) cut = true;
    else if (gap > PAUSE_SEC && units >= R.pauseMin) cut = true;
    if (cut || i === words.length - 1) {
      groups.push(words.slice(cs, i + 1));
      cs = i + 1;
    }
  }
  return groups.flatMap((g) => splitLong(g, mode));
};

/**
 * 分组 → 带时间的句子。
 * @param {Array} words toWords 的结果
 * @param {{mode?: 'zh'|'en', silences?: Array<{start: number, end: number}>, audioEnd?: number}} [opts]
 * @returns {Array<{id: string, index: number, startMs: number, endMs: number, text: string}>} text 是单行（还没断两行）
 */
export const buildCues = (words, {mode = 'zh', silences = [], audioEnd = null} = {}) => {
  const groups = groupWords(words, mode);
  const sil = [...silences].sort((a, b) => a.start - b.start);
  const out = groups.map((ws, k) => {
    const t0 = ws[0].t;
    const t1 = ws[ws.length - 1].tEnd;
    let start = t0 - 0.05;
    const before = sil.filter((s) => s.end <= t0 && s.end >= t0 - 0.45).pop();
    if (before) start = Math.min(start, before.end);
    if (k > 0) start = Math.max(start, groups[k - 1][groups[k - 1].length - 1].tEnd + 0.1);
    start = Math.max(0, start);
    let end = t1 + 0.2;
    const after = sil.find((s) => s.start >= t1 + 0.05 && s.start <= t1 + 0.8);
    if (after) end = after.start;
    return {start, end, text: renderWords(ws)};
  });
  for (let k = 0; k < out.length; k++) {
    const limit = Math.min(out[k + 1] ? out[k + 1].start - 0.04 : Infinity, audioEnd ?? Infinity);
    out[k].end = Math.min(out[k].end, limit);
    if (out[k].end - out[k].start < 0.6) out[k].end = Math.min(limit, out[k].start + 0.6);
  }
  return out.map((c, k) => {
    const startMs = Math.round(c.start * 1000);
    const endMs = Math.max(startMs + 1, Math.round(c.end * 1000));
    return {id: `c${k + 1}`, index: k + 1, startMs, endMs, text: c.text};
  });
};

/**
 * 中文超过 10 个字时断成两行：按词边界找最均衡的位置，优先断在逗号后面，每行不超过 12 字；行首不放标点。
 * 英文不手动换行（交给画面自动折行）。
 */
export const twoLines = (text, {splitOver = LINE_SPLIT_OVER, maxLine = LINE_MAX} = {}) => {
  const s = String(text).replace(/\s*\n\s*/g, '');
  const chars = [...s];
  if (widthOf(s) <= splitOver) return s;
  const bounds = wordBoundaries(s);
  const latinAt = (i) => /[A-Za-z0-9]/.test(chars[i] || '');
  const tryAt = (positions, wordPenalty) => {
    let best = null;
    for (const pos of positions) {
      if (pos <= 0 || pos >= chars.length) continue;
      const left = chars.slice(0, pos).join('');
      const right = chars.slice(pos).join('');
      if (/^[，,、：:。！？!?；;…）)」』》]/.test(right)) continue;
      if (latinAt(pos - 1) && latinAt(pos)) continue;
      const a = widthOf(left);
      const b = widthOf(right);
      if (a > maxLine || b > maxLine) continue;
      let score = Math.abs(a - b);
      if (/[，,、：:；;]$/.test(left)) score -= 3;
      score += bounds.has(pos) ? bounds.get(pos) : wordPenalty;
      if (!best || score < best.score) best = {score, pos};
    }
    return best;
  };
  const all = chars.map((_, i) => i);
  const best = tryAt([...bounds.keys()], 0) || tryAt(all, 4);
  if (!best) return s;
  return `${chars.slice(0, best.pos).join('')}\n${chars.slice(best.pos).join('')}`;
};

/** 最终上屏文字：中文断两行，英文原样。 */
export const layoutText = (text, mode = 'zh') => (mode === 'en' ? String(text).replace(/\s*\n\s*/g, ' ').trim() : twoLines(text));

const ts = (ms) => {
  const v = Math.max(0, Math.round(ms));
  const h = Math.floor(v / 3600000);
  const m = Math.floor((v % 3600000) / 60000);
  const s = Math.floor((v % 60000) / 1000);
  const r = v % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`;
};

/** 写 SRT。能被 scripts/broll/srt.mjs 的 parseSrt 原样读回（时间到毫秒、两行文字都一致）。 */
export const toSrt = (cues) =>
  cues
    .map((c, i) => {
      const lines = String(c.text)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      return `${i + 1}\n${ts(c.startMs)} --> ${ts(c.endMs)}\n${lines.join('\n') || '…'}\n`;
    })
    .join('\n');

/** 识别结果（缓存 JSON 的形状）→ 单行句子。 */
export const cuesFromAsr = (asr, {lang = 'auto'} = {}) => {
  const mode = modeOf(lang, asr.detected);
  const words = toWords(asr.tokens, asr.times, asr.breaks?.length ? asr.breaks : [0]);
  return {mode, cues: buildCues(words, {mode, silences: asr.silences || [], audioEnd: asr.audioSec})};
};
