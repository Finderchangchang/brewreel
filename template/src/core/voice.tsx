import React from 'react';
import {Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {Storyboard} from '../schema';
import {clamp} from './anim';
import {FONT} from './font';
import {WORD_JOINER, emWidth, glueBreaks} from './fit';
import {Lang, glyph, parseRich} from './kit';
import {CAP, FPS} from './safe';
import {mixHex, useTheme} from './theme';
import type {Slot} from './timeline';

// ============================================================
// 配音（画面这一半）：以声音为时间轴的音轨、配乐闪避、逐字字幕的排版与时间表。
//
// 数据从哪来：make.mjs 渲染前跑「配音」步骤，产出 voice.json，原样挂到 props.voice（和 props.bgm 同级）；
// 同时已按旁白实际时长改写了各镜 dur，所以这里 schedule() 排出来的镜头起点就是声音的起点基准。
//   props.voice = {provider, voiceId, totalMs, duck:{db, attackMs, releaseMs, baked?},
//                  lines:[{shot, text, src, startMs, durMs, words:[{text,startMs,endMs}], granularity}]}
//   - lines[].shot     第几镜（0 起）
//   - lines[].startMs  相对这一镜起点；words[].startMs/endMs 相对这一句起点
//   - lines[].src      public 下的相对路径（staticFile），也接受 http(s):// / data: 地址
//   - lines[].text     这一句的上屏文字，可带 {} 强调（words 按去掉花括号后的文字对齐）；
//                      没带 {} 时，从分镜这一镜的 vo 里把 {} 强调词找回来
//   - duck.baked=true  表示配乐已经在 make_bgm.py 里压过了，这里不再压；没有 duck 也不压
// 字幕方式：meta.voice.subtitles（或 props.voice.subtitles）= karaoke（默认，逐字点亮）/ line（整句）/ off（不显示）
// 谁来画字幕：cards（及 captionLayer=cards 的风格）在全局字幕带画 VoiceCaptions——这一镜写了 caption 就照旧显示 caption、旁白只念，
//   endCard 这类 caption:none 的镜头也不画（跳过 lines[].subtitle === false 的句子）；
//   quiz / journey 在各自的 Film 里画自己的字幕条（styles/quiz/parts/voiceSub.tsx、styles/journey/parts/subtitle.tsx），不看 subtitle 标记
//
// 没有 props.voice（或 lines 为空）时这里所有东西都是 null / undefined，老分镜渲染结果和以前逐帧一致。
// schema.ts 的正式类型由管线负责人补；这里先按约定接口自己声明一份。
// ============================================================

export type SubtitleMode = 'karaoke' | 'line' | 'off';
export type VoiceWord = {text: string; startMs: number; endMs: number};
export type VoiceLine = {
  shot: number;
  text: string;
  src: string;
  startMs: number;
  durMs: number;
  words?: VoiceWord[];
  granularity?: 'char' | 'word' | 'sentence-interp';
  /** 管线给的：这一句上不上旁白字幕。cards 字幕带：这一镜写了 caption / 镜头 caption:none / subtitles 为 off 时为 false；
   *  quiz / journey（captionLayer: none）：只在 subtitles 为 off 时为 false。组件这边 cards 用它做二次过滤，quiz / journey 看 mode */
  subtitle?: boolean;
};
export type VoiceDuck = {db: number; attackMs?: number; releaseMs?: number; baked?: boolean};
export type VoiceTrack = {provider?: string; voiceId?: string; totalMs?: number; duck?: VoiceDuck | null; lines: VoiceLine[]; subtitles?: SubtitleMode; volume?: number};
/** meta.voice（分镜里模型写的配置；这里只读 subtitles） */
export type VoiceMeta = {provider?: 'minimax' | 'mock' | (string & {}); voiceId?: string; speed?: number; emotion?: string; model?: string; subtitles?: SubtitleMode};

type SbWithVoice = Storyboard & {voice?: VoiceTrack | null};

// ---------------- 读 props ----------------

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** props.voice 里能用的句子（shot 越界 / 没有 src 的丢掉）；没有配音返回 null */
export const voiceOf = (sb: Storyboard, slots: Slot[]): VoiceTrack | null => {
  const v = (sb as SbWithVoice).voice;
  if (!v || !Array.isArray(v.lines)) return null;
  const lines = v.lines.filter((l) => l && typeof l.src === 'string' && l.src && Number.isInteger(l.shot) && l.shot >= 0 && l.shot < slots.length);
  return lines.length ? {...v, lines} : null;
};

export const subtitleModeOf = (sb: Storyboard): SubtitleMode => {
  const v = (sb as SbWithVoice).voice?.subtitles ?? ((sb.meta as {voice?: VoiceMeta} | undefined)?.voice?.subtitles as SubtitleMode | undefined);
  return v === 'line' || v === 'off' ? v : 'karaoke';
};

// ---------------- 每个字什么时候说 ----------------

/** 一个上屏字：c 字符、hot 是否 {} 强调、a/b 这个字开始 / 念完的时刻（整片绝对秒）；br = 手动换行 */
export type VChar = {c: string; hot: boolean; a: number; b: number; br?: boolean};

const isWideCh = (ch: string) => emWidth(ch) >= 1;
const PUNCT = /[\s，。！？、；：“”‘’（）《》「」『』【】…—·,.!?;:'"()\[\]<>\-–%％~～]/;
/** 不能落在行首的标点（跟前一个字粘住） */
const CLOSE = /[，。！？、；：”’）》」』】…,.!?;:%％)\]]/;
/** 不能落在行尾的标点（跟后一个字粘住） */
const OPEN = /[“‘（《「『【(\[]/;
/** 分句结束的标点：换行、翻页优先落在这些后面 */
const CLAUSE = /[，。！？；：、…,.!?;:]/;

const core = (s: string) => Array.from(s).filter((c) => !PUNCT.test(c)).map((c) => c.toLowerCase());

/**
 * 给一句的每个字配上时刻。words 按顺序和去掉空白/标点后的文字逐字对齐：
 *   多字的词（中文句级插值、英文单词）——中文按字均分词的时长，拉丁单词整词同一时刻；
 *   标点、空格 = 前一个字念完的时刻；对不上的字按剩余时长均分。words 缺失或对齐率 < 50% 时，整句按字数比例均分。
 */
export const timeChars = (rich: {c: string; hot: boolean; br?: boolean}[], line: VoiceLine, t0: number): VChar[] => {
  const dur = Math.max(0.05, num(line.durMs, 1000) / 1000);
  const n = rich.length;
  const A = new Array<number>(n).fill(NaN);
  const B = new Array<number>(n).fill(NaN);
  const coreIdx: number[] = [];
  rich.forEach((r, i) => {
    if (!r.br && !PUNCT.test(r.c)) coreIdx.push(i);
  });
  const coreCh = coreIdx.map((i) => rich[i].c.toLowerCase());
  const words = (Array.isArray(line.words) ? line.words : [])
    .filter((w) => w && typeof w.text === 'string' && Number.isFinite(w.startMs) && Number.isFinite(w.endMs))
    .slice()
    .sort((x, y) => x.startMs - y.startMs);
  let k = 0;
  let matched = 0;
  for (const w of words) {
    const wc = core(w.text);
    if (!wc.length) continue;
    const eq = (at: number) => wc.every((c, j) => coreCh[at + j] === c);
    let at = -1;
    for (let s = k; s <= Math.min(coreCh.length - wc.length, k + 8); s++)
      if (eq(s)) {
        at = s;
        break;
      }
    if (at < 0) continue;
    const s0 = t0 + w.startMs / 1000;
    const e0 = t0 + Math.max(w.startMs, w.endMs) / 1000;
    // 跳过的字（TTS 没给时间戳的）：夹在上一个字和这个词之间
    const prevEnd = k > 0 && Number.isFinite(B[coreIdx[k - 1]]) ? B[coreIdx[k - 1]] : t0;
    for (let s = k; s < at; s++) {
      const p = (s - k + 1) / (at - k + 1);
      A[coreIdx[s]] = prevEnd + (s0 - prevEnd) * (p - 1 / (at - k + 1));
      B[coreIdx[s]] = prevEnd + (s0 - prevEnd) * p;
    }
    const latin = wc.every((c) => !isWideCh(c));
    wc.forEach((_, j) => {
      const i = coreIdx[at + j];
      A[i] = latin ? s0 : s0 + ((e0 - s0) * j) / wc.length;
      B[i] = latin ? e0 : s0 + ((e0 - s0) * (j + 1)) / wc.length;
    });
    matched += wc.length;
    k = at + wc.length;
  }
  if (!coreIdx.length || matched < coreIdx.length * 0.5) {
    // 按字数比例均分（汉字 1，拉丁 0.5，标点 0.35 当停顿）
    const wt = rich.map((r): number => (r.br ? 0 : PUNCT.test(r.c) ? (/\s/.test(r.c) ? 0.1 : 0.35) : isWideCh(r.c) ? 1 : 0.5));
    const tot = wt.reduce((x, y) => x + y, 0) || 1;
    let acc = 0;
    return rich.map((r, i) => {
      const a = t0 + (acc / tot) * dur;
      acc += wt[i];
      const b = t0 + (acc / tot) * dur;
      return {...r, a: PUNCT.test(r.c) || r.br ? b : a, b};
    });
  }
  // 尾巴上没对上的字：均分到句末
  const lastT = coreIdx.reduce((m, i) => (Number.isFinite(B[i]) ? Math.max(m, B[i]) : m), t0);
  const rest = coreIdx.filter((i) => !Number.isFinite(A[i]));
  const end = Math.max(lastT, t0 + dur);
  rest.forEach((i, j) => {
    A[i] = lastT + ((end - lastT) * j) / rest.length;
    B[i] = lastT + ((end - lastT) * (j + 1)) / rest.length;
  });
  // 标点 / 空格：前一个字念完就算念到
  let prev = t0;
  return rich.map((r, i) => {
    if (Number.isFinite(A[i])) {
      prev = B[i];
      return {...r, a: A[i], b: B[i]};
    }
    return {...r, a: prev, b: prev};
  });
};

/** 上屏文字：line.text 带 {} 就用它；否则从这一镜的 vo 里找回 {} 强调词 */
export const richOf = (line: VoiceLine, vo?: unknown): {c: string; hot: boolean; br?: boolean}[] => {
  const text = String(line.text ?? '');
  const rich = parseRich(text).map((x) => ('br' in x ? {c: '\n', hot: false, br: true} : x));
  if (text.includes('{') || typeof vo !== 'string' || !vo.includes('{')) return rich;
  const plain = rich.map((r) => r.c).join('');
  for (const m of vo.matchAll(/\{([^{}]+)\}/g)) {
    const h = m[1];
    if (!h) continue;
    let from = 0;
    for (let p = plain.indexOf(h, from); p >= 0; p = plain.indexOf(h, from)) {
      // plain 是按 UTF-16 下标，rich 按码点：两者只在有代理对（emoji）时不同，强调词里一般没有
      for (let j = 0; j < Array.from(h).length; j++) if (rich[p + j]) rich[p + j].hot = true;
      from = p + h.length;
    }
  }
  return rich;
};

// ---------------- 排版：安全换行 + 一屏最多两行 + 按时间翻页 ----------------

type Tok = {s: number; e: number; w: number; space: boolean; br: boolean; punct: boolean};

/** 把一句切成不可断开的小段：中文词内（Intl.Segmenter，与 fit.ts glueBreaks 同一规则）、{} 强调段内、拉丁单词内、避头尾标点都不断 */
const tokensOf = (chars: VChar[], lang: Lang): Tok[] => {
  const plain = chars.map((c) => (c.br ? '\n' : c.c)).join('');
  const glue = new Set<number>();
  {
    const g = glueBreaks(plain, lang);
    let oi = -1;
    for (const ch of Array.from(g)) {
      if (ch === WORD_JOINER) glue.add(oi);
      else oi++;
    }
  }
  const toks: Tok[] = [];
  let cur: Tok | null = null;
  chars.forEach((c, i) => {
    if (c.br) {
      if (cur) toks.push(cur);
      cur = null;
      toks.push({s: i, e: i + 1, w: 0, space: false, br: true, punct: false});
      return;
    }
    const space = /\s/.test(c.c);
    if (space) {
      if (cur) toks.push(cur);
      cur = null;
      toks.push({s: i, e: i + 1, w: emWidth(' '), space: true, br: false, punct: false});
      return;
    }
    const prev = chars[i - 1];
    const joined =
      cur !== null &&
      prev &&
      !prev.br &&
      !/\s/.test(prev.c) &&
      (glue.has(i - 1) || (prev.hot && c.hot) || (!isWideCh(prev.c) && !isWideCh(c.c)) || CLOSE.test(c.c) || OPEN.test(prev.c));
    if (!joined) {
      if (cur) toks.push(cur);
      cur = {s: i, e: i, w: 0, space: false, br: false, punct: false};
    }
    const t = cur as unknown as Tok;
    t.e = i + 1;
    t.w += emWidth(c.c);
    // 分句结束：以 ，。！？ 等结尾（后面再跟个右引号 / 右括号也算）
    t.punct = CLAUSE.test(c.c) || (t.punct && /[”’）》」』】)\]]/.test(c.c));
  });
  if (cur) toks.push(cur);
  return toks;
};

const widthOf = (toks: Tok[]) => toks.reduce((a, t) => a + t.w, 0);
const trim = (toks: Tok[]) => {
  let a = 0;
  let b = toks.length;
  while (a < b && toks[a].space) a++;
  while (b > a && toks[b - 1].space) b--;
  return toks.slice(a, b);
};

/** 贪心折行（maxEm = 一行能放几个 em） */
const wrap = (toks: Tok[], maxEm: number): Tok[][] => {
  const lines: Tok[][] = [];
  let cur: Tok[] = [];
  const push = () => {
    const l = trim(cur);
    if (l.length) lines.push(l);
    cur = [];
  };
  for (const t of toks) {
    if (t.space && !cur.length) continue;
    if (cur.length && widthOf(cur) + t.w > maxEm + 1e-6 && !t.space) push();
    cur.push(t);
  }
  push();
  return lines;
};

/** 一个分句折成两行时拉匀（例如 12+2 → 7+7）；最宽行能窄半个字以上才换，一样匀时上行不短于下行 */
const balance = (a: Tok[], b: Tok[], maxEm: number): [Tok[], Tok[]] => {
  const all = [...a, ...b];
  let best: [Tok[], Tok[]] = [a, b];
  let bestCost = Math.max(widthOf(a), widthOf(b)) - 0.5;
  for (let k = 1; k < all.length; k++) {
    const x = trim(all.slice(0, k));
    const y = trim(all.slice(k));
    if (!x.length || !y.length) continue;
    const wx = widthOf(x);
    const wy = widthOf(y);
    if (wx > maxEm + 1e-6 || wy > maxEm + 1e-6) continue;
    const cost = Math.max(wx, wy) + (wy > wx ? 0.01 : 0);
    if (cost < bestCost - 1e-6) {
      bestCost = cost;
      best = [x, y];
    }
  }
  return best;
};

/** 一行：toks；mid = 这一行停在一个分句中间（下一行接着同一个分句） */
type LineT = {toks: Tok[]; mid: boolean};

/**
 * 按分句排行：分句（到 ，。！？；：、 为止，\n 也算）尽量整句放一行，几个短分句能挤一行就挤一行；
 * 一个分句一行放不下才在句中折行（折成两行时拉匀）。这样换行、翻页都优先落在标点处，不把「填进」这类短语劈开。
 */
const layoutLines = (toks: Tok[], maxEm: number): LineT[] => {
  const clauses: {toks: Tok[]; br: boolean}[] = [];
  let c: Tok[] = [];
  for (const t of toks) {
    if (t.br) {
      clauses.push({toks: c, br: true});
      c = [];
      continue;
    }
    c.push(t);
    if (t.punct) {
      clauses.push({toks: c, br: false});
      c = [];
    }
  }
  if (c.length) clauses.push({toks: c, br: false});
  const out: LineT[] = [];
  let line: Tok[] = [];
  const flush = () => {
    const l = trim(line);
    if (l.length) out.push({toks: l, mid: false});
    line = [];
  };
  for (const cl of clauses) {
    const body = trim(cl.toks);
    if (body.length) {
      if (widthOf(body) <= maxEm + 1e-6) {
        if (line.length && widthOf(trim([...line, ...cl.toks])) <= maxEm + 1e-6) line.push(...cl.toks);
        else {
          flush();
          line = [...body];
        }
      } else {
        flush();
        let parts = wrap(body, maxEm);
        if (parts.length === 2) parts = balance(parts[0], parts[1], maxEm);
        parts.forEach((p, k) => out.push({toks: p, mid: k < parts.length - 1}));
      }
    }
    if (cl.br) flush();
  }
  flush();
  return out;
};

/** 行 → 屏（每屏最多 per 行）；一个折成多行的分句尽量整个留在同一屏 */
const groupPages = (lines: LineT[], per: number): LineT[][] => {
  const pages: LineT[][] = [];
  let pg: LineT[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (pg.length >= per) {
      pages.push(pg);
      pg = [];
    }
    if (pg.length && lines[i].mid && !pg[pg.length - 1].mid) {
      let n = 1;
      while (lines[i + n - 1]?.mid) n++;
      // 这个分句一屏放得下才整个挪到下一屏；本来就超过一屏的长分句照常接着排，不浪费半屏
      if (pg.length + n > per && n <= per) {
        pages.push(pg);
        pg = [];
      }
    }
    pg.push(lines[i]);
  }
  if (pg.length) pages.push(pg);
  return pages;
};

export type VLine = VChar[];
/** 一屏：1–2 行；a/b = 这一屏第一个字开始 / 最后一个字念完；from/to = 这一屏在画面上的起止（整片秒） */
export type VPage = {key: string; shot: number; line: number; lines: VLine[]; size: number; a: number; b: number; from: number; to: number; first: boolean; instant: boolean};

export type PageOpts = {lang: Lang; maxW: number; maxSize: number; minSize: number; step?: number; maxLines?: number; /** 跳过 line.subtitle === false 的句子（cards 字幕带用） */ lineFlag?: boolean};

/** 一句排成若干屏：先求最少屏数、再最少行数、最后最大字号（同一句字号不变） */
export const paginate = (chars: VChar[], o: PageOpts): {size: number; pages: VLine[][]} => {
  const toks = tokensOf(chars, o.lang);
  const per = o.maxLines ?? 2;
  let best: {size: number; lines: number; pages: LineT[][]} | null = null;
  for (let size = o.maxSize; size >= o.minSize; size -= o.step ?? 2) {
    const lines = layoutLines(toks, o.maxW / size);
    const pages = groupPages(lines, per);
    if (!best || pages.length < best.pages.length || (pages.length === best.pages.length && lines.length < best.lines)) best = {size, lines: lines.length, pages};
  }
  if (!best) return {size: o.minSize, pages: []};
  return {size: best.size, pages: best.pages.map((pg) => pg.map((l) => chars.slice(l.toks[0].s, l.toks[l.toks.length - 1].e)))};
};

// ---------------- 整片的字幕时间表 ----------------

export type VoicePlan = {
  track: VoiceTrack;
  mode: SubtitleMode;
  /** 每句的绝对起止（秒） */
  spans: {line: VoiceLine; shot: number; start: number; end: number}[];
  /** 有配音的镜头 */
  voiced: Set<number>;
};

export const planVoice = (sb: Storyboard, slots: Slot[]): VoicePlan | null => {
  const track = voiceOf(sb, slots);
  if (!track) return null;
  const spans = track.lines
    .map((line) => {
      // 对齐到整帧：音轨 <Sequence from> 只能从整帧开播，逐字点亮也用同一个起点，字和声音之间没有取整误差
      // （quiz 一拍 0.46875 秒，镜头起点常不在整帧上；不对齐会差出最多半帧）
      const start = Math.round((slots[line.shot].start + num(line.startMs) / 1000) * FPS) / FPS;
      return {line, shot: line.shot, start, end: start + Math.max(0.05, num(line.durMs, 1000) / 1000)};
    })
    .sort((x, y) => x.start - y.start);
  return {track, mode: subtitleModeOf(sb), spans, voiced: new Set(spans.map((s) => s.shot))};
};

/**
 * 按时间把各句排成一屏屏字幕，并算出每屏的显示窗口（首尾相接、互不重叠）：
 *   一镜第一屏从镜头起点就出（没念到的字是淡色），翻页在「上一屏念完」和「下一屏开念前 0.25 秒」里取晚的那个，
 *   一镜最后一屏留到镜头结束；skip(i) 为真的镜头不出字幕（比如片尾大字就是口播内容的镜头）。
 */
export const buildPages = (plan: VoicePlan, slots: Slot[], sb: Storyboard, o: PageOpts, skip?: (shot: number) => boolean): VPage[] => {
  const out: VPage[] = [];
  const byShot = new Map<number, VoicePlan['spans']>();
  for (const s of plan.spans) {
    if (skip?.(s.shot) || (o.lineFlag && s.line.subtitle === false)) continue;
    byShot.set(s.shot, [...(byShot.get(s.shot) ?? []), s]);
  }
  for (const [shot, spans] of [...byShot.entries()].sort((x, y) => x[0] - y[0])) {
    const slot = slots[shot];
    const vo = (sb.shots?.[shot] as {vo?: unknown} | undefined)?.vo;
    const pages: VPage[] = [];
    spans.forEach((sp, li) => {
      const chars = timeChars(richOf(sp.line, vo), sp.line, sp.start);
      const {size, pages: pg} = paginate(chars, o);
      // 中文字幕一屏末尾的句号不上屏（和 caption 的写法一致：句中逗号保留，句末不带「。」）；问号、感叹号保留语气
      if (o.lang !== 'en')
        for (const lines of pg) {
          const last = lines[lines.length - 1];
          while (last && last.length > 1 && /[。．.]/.test(last[last.length - 1].c)) last.pop();
        }
      pg.forEach((lines, pi) => {
        const flat = lines.flat();
        const cores = flat.filter((c) => !PUNCT.test(c.c));
        const a = cores.length ? Math.min(...cores.map((c) => c.a)) : sp.start;
        const b = cores.length ? Math.max(...cores.map((c) => c.b)) : sp.end;
        pages.push({key: `${shot}-${li}-${pi}`, shot, line: li, lines, size, a, b, from: 0, to: 0, first: false, instant: false});
      });
    });
    pages.forEach((p, i) => {
      if (i === 0) p.from = slot.start;
      else {
        const prev = pages[i - 1];
        p.from = Math.min(p.a, Math.max(prev.b, p.a - 0.25));
        p.from = Math.max(p.from, prev.from + 1 / FPS);
      }
      p.first = i === 0;
      p.instant = shot === 0 && i === 0;
    });
    pages.forEach((p, i) => {
      p.to = i < pages.length - 1 ? pages[i + 1].from : Math.max(slot.end, slot.start + 1 / FPS);
    });
    out.push(...pages);
  }
  return out;
};

/** t 时刻该显示的那一屏（窗口互不重叠，最多一屏）；最后一屏在片尾之后也留着 */
export const pageAt = (pages: VPage[], t: number, total: number): VPage | undefined =>
  pages.find((p) => t >= p.from && (t < p.to || (p.to >= total - 1e-6 && t < total + 1)));

/**
 * 一屏的进出。紧接上一屏的（翻页 / 换句 / 换镜）：旧屏在这一帧直接撤掉、新屏同一帧完整出来，只做 0.1 秒的轻微上浮，
 * 中间不会出现空帧或两屏半透明叠在一起；前面没有字幕的：0.1 秒上浮淡入；后面不接字幕的：最后 0.15 秒淡出。
 * 第 1 镜第一屏第 0 帧直接完整。
 */
export const pageFade = (pages: VPage[], p: VPage, t: number, total: number) => {
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-6;
  const next = pages.some((x) => near(x.from, p.to));
  const prev = pages.some((x) => near(x.to, p.from));
  const inP = p.instant ? 1 : interpolate(t, [p.from, p.from + 0.1], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const outP = next || p.to >= total - 1e-6 ? 1 : interpolate(t, [p.to - 0.15, p.to], [1, 0], clamp);
  return {op: (prev ? 1 : inP) * outP, dy: (1 - inP) * (prev ? 6 : 14)};
};

/** 字的状态：0 = 没念到，1 = 正在念（p = 念到这个字的几成），2 = 念过了 */
export const charState = (c: VChar, t: number): {s: 0 | 1 | 2; p: number} => {
  if (t >= c.b) return {s: 2, p: 1};
  if (t >= c.a) return {s: 1, p: c.b > c.a ? (t - c.a) / (c.b - c.a) : 1};
  return {s: 0, p: 0};
};

// ---------------- 音轨 + 配乐闪避 ----------------

const srcOf = (s: string) => (/^(https?:|data:|blob:)/.test(s) ? s : staticFile(s.replace(/^\/+/, '')));

/** 每句旁白在「所在镜头起点 + startMs」开播 */
export const VoiceTrackAudio: React.FC<{plan: VoicePlan | null}> = ({plan}) => {
  if (!plan) return null;
  const vol = Math.max(0, Math.min(2, num(plan.track.volume, 1)));
  return (
    <>
      {plan.spans.map((s, i) => (
        <Sequence key={`vo${i}`} from={Math.max(0, Math.round(s.start * FPS))} durationInFrames={Math.max(1, Math.ceil((s.end - s.start) * FPS) + 6)} layout="none" name={`vo-${s.shot + 1}-${i}`}>
          <Audio src={srcOf(s.line.src)} volume={vol} />
        </Sequence>
      ))}
    </>
  );
};

/**
 * 配乐闪避增益（乘在配乐音量上）：人声区间里压到 duck.db（负分贝），前 attackMs 开始往下压、结束后 releaseMs 回来，
 * 两句间隔短于 attack+release 就不回升。duck.baked=true（make_bgm.py 已经压过）或没有 duck → undefined（不压）
 */
export const duckGainOf = (plan: VoicePlan | null): ((frame: number) => number) | undefined => {
  const d = plan?.track.duck;
  if (!plan || !d || d.baked || !Number.isFinite(d.db) || d.db === 0) return undefined;
  const db = -Math.abs(d.db);
  const att = Math.max(0.01, num(d.attackMs, 120) / 1000);
  const rel = Math.max(0.01, num(d.releaseMs, 350) / 1000);
  const iv: [number, number][] = [];
  for (const s of plan.spans) {
    const last = iv[iv.length - 1];
    if (last && s.start - last[1] < att + rel) last[1] = Math.max(last[1], s.end);
    else iv.push([s.start, s.end]);
  }
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));
  return (frame: number) => {
    const t = frame / FPS;
    let k = 0;
    for (const [a, b] of iv) {
      if (t < a - att || t > b + rel) continue;
      k = Math.max(k, t < a ? ease((t - (a - att)) / att) : t <= b ? 1 : 1 - ease((t - b) / rel));
    }
    return k > 0 ? Math.pow(10, (db * k) / 20) : 1;
  };
};

// ---------------- cards：字幕带里的逐字字幕 ----------------

/** cards 字幕带的排版参数（与 layers.tsx 的 captionSize 同一套：中文 720 宽 90→58，英文按 680 宽估、下限 44）；
 *  两边各再留约 6px：正在念的字会放大 1.1 倍，行首行尾的字放大后不能出 x180–900 */
export const cardsPageOpts = (lang: Lang): PageOpts => ({lang, maxW: lang === 'en' ? 668 : 708, maxSize: CAP.max, minSize: lang === 'en' ? 44 : Math.min(CAP.min, 58), lineFlag: true});

/**
 * 有旁白、没写 caption 的镜头：字幕带显示「正在说的那句」。karaoke = 念过的字实色、正在念的字强调色（轻轻顶起）、没念到的字淡色；
 * line = 整屏实色；{} 强调的字念过后保持强调色。一屏最多两行，长句按时间翻页，上下两屏不会同时出现。
 */
export const VoiceCaptions: React.FC<{plan: VoicePlan | null; slots: Slot[]; sb: Storyboard; lang?: Lang; skip?: (shot: number) => boolean}> = ({plan, slots, sb, lang = 'zh', skip}) => {
  const th = useTheme();
  const t = useCurrentFrame() / FPS;
  const pages = React.useMemo(() => (plan && plan.mode !== 'off' ? buildPages(plan, slots, sb, cardsPageOpts(lang), skip) : []), [plan, slots, sb, lang, skip]);
  const total = slots.length ? slots[slots.length - 1].end : 0;
  const p = pageAt(pages, t, total);
  if (!plan || !p) return null;
  const lineHeight = lang === 'en' ? 1.32 : 1.18;
  const clean = th.captionStyle === 'clean';
  const size = clean ? Math.min(78, p.size) : p.size;
  const h = p.lines.length * size * lineHeight;
  const top = Math.round(CAP.y0 + (CAP.y1 - CAP.y0 - h) / 2);
  const {op, dy} = pageFade(pages, p, t, total);
  const karaoke = plan.mode === 'karaoke';
  // 没念到的字：字身往描边色压一截（灰白 / 灰黄），描边不变，照样看得清，但和念过的实色分得开
  const dimFill = mixHex(th.capFill, th.capStroke, 0.36);
  const dimHot = mixHex(mixHex(th.hot, th.capFill, 0.35), th.capStroke, 0.36);
  return (
    <div
      key={p.key}
      style={{
        position: 'absolute',
        left: CAP.x0,
        width: CAP.w,
        top,
        textAlign: 'center',
        fontFamily: FONT,
        fontSize: size,
        fontWeight: clean ? 800 : 900,
        lineHeight,
        letterSpacing: lang === 'en' ? 0 : undefined,
        whiteSpace: 'nowrap',
        opacity: op,
        transform: dy ? `translateY(${dy}px)` : undefined,
        fontFeatureSettings: lang === 'en' ? undefined : '"palt"',
      }}
    >
      {p.lines.map((ln, li) => (
        <React.Fragment key={li}>
          {li > 0 ? <br /> : null}
          {ln.map((c, j) => {
            const st = karaoke ? charState(c, t) : {s: 2 as const, p: 1};
            const color = st.s === 1 ? th.hot : st.s === 2 ? (c.hot ? th.hot : th.capFill) : c.hot ? dimHot : dimFill;
            const lift = st.s === 1 ? Math.sin(Math.PI * Math.min(1, st.p)) : 0;
            return (
              <span
                key={j}
                style={{
                  display: 'inline-block',
                  ...glyph(th, size, c.hot),
                  color,
                  transform: lift ? `translateY(${-lift * size * 0.06}px) scale(${1 + lift * 0.1})` : undefined,
                }}
              >
                {c.c === ' ' ? ' ' : c.c}
              </span>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};
