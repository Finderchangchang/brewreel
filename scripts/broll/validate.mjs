#!/usr/bin/env node
// 校验 broll.json。报错格式和 scripts/validate.mjs 一样：哪一段、哪个字段、错在哪、怎么改。
//   node scripts/broll/validate.mjs <项目目录>
// 退出码：0 通过 / 1 有错误 / 2 项目目录不齐 / 3 估价超过 budgetYuan
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT} from './root.mjs';
import {parseSrt} from './srt.mjs';
import {probeMedia} from './media.mjs';
import {clipCost, rateOf} from './prices.mjs';
import {MAX_COVER_MS, MAX_RATIO, MIN_BEAT_SEC, MIN_COVER_MS, MIN_GAP_MS, genSecOf, isVertical, secText, windowOf} from './time.mjs';

export const PROVIDERS = ['placeholder', 'local', 'minimax-h3'];
export const QUALITIES = ['768P', '2K'];
export const CAPTIONS = ['burned', 'add', 'none'];
export const MODES = ['full', 'pip', 'split'];
export const JOBS = ['demonstrate', 'explain', 'ground', 'compare', 'quantify', 'evoke', 'connect'];
export const CAMERAS = ['static', 'slow-push', 'pull-back', 'pan-left', 'pan-right', 'orbit', 'top-down'];
export const LIMITS = {plain: 20, place: 12, subject: 12, action: 24, end: 16};
const TOP_KEYS = new Set(['version', 'style', 'provider', 'quality', 'budgetYuan', 'captions', 'keepFace', 'clips']);
const CLIP_KEYS = new Set(['id', 'from', 'to', 'mode', 'job', 'plain', 'place', 'subject', 'action', 'end', 'beats', 'camera', 'file']);
const BEAT_KEYS = new Set(['action', 'end']);
const PERSON = ['我觉得', '我当时', '说实话', '后悔', '我记得', '我以为'];
const QUOTE_RE = /["“”„‟«»「」『』‘’']/;
const LETTER_RE = /写着|显示文字|标语|字幕/;
const DIGIT_RE = /[0-9０-９%％]/;
const CUE_RE = /^c[1-9][0-9]*$/;
const ID_RE = /^b[0-9]{2}$/;

export const charCount = (s) => Array.from(String(s).replace(/\s+/g, '')).length;

export const loadStyles = (root = ROOT) => {
  const dir = path.join(root, 'broll', 'styles');
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name, 'style.json');
    if (!fs.existsSync(p)) continue;
    out[name] = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  }
  return out;
};

export const loadBanned = (root = ROOT) => {
  const p = path.join(root, 'broll', 'banned-words.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  return Array.isArray(j.words) ? j.words : [];
};

const findBanned = (text, words) => {
  const list = [...words].sort((a, b) => Array.from(b.word).length - Array.from(a.word).length);
  const hits = [];
  const spans = [];
  for (const w of list) {
    if (!w?.word) continue;
    const ascii = /^[\x00-\x7F]+$/.test(w.word);
    const hay = ascii ? text.toLowerCase() : text;
    const needle = ascii ? w.word.toLowerCase() : w.word;
    let from = 0;
    while (from < hay.length) {
      const i = hay.indexOf(needle, from);
      if (i < 0) break;
      const end = i + needle.length;
      if (!spans.some(([a, b]) => i >= a && end <= b)) {
        hits.push(w);
        spans.push([i, end]);
      }
      from = end;
    }
  }
  return hits;
};

const cueNo = (id) => Number(String(id).slice(1));

/**
 * @param {object} doc
 * @param {{cues: object[], durationMs: number, width: number, height: number, styles: object, banned: object[], projectDir?: string}} ctx
 */
export const validateBroll = (doc, ctx) => {
  const errors = [];
  const warnings = [];
  const costs = [];
  const err = (where, problem, fix) => errors.push({where, problem, fix});
  const warn = (where, problem, fix) => warnings.push({where, problem, fix});
  const cues = ctx.cues ?? [];
  const byId = new Map(cues.map((c) => [c.id, c]));
  const styles = ctx.styles ?? {};
  const banned = ctx.banned ?? [];
  const durationMs = ctx.durationMs ?? 0;
  const width = ctx.width ?? 0;
  const height = ctx.height ?? 0;

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return {errors: [{where: 'broll.json', problem: '顶层必须是一个对象', fix: '按 broll/README.md 的字段重写'}], warnings, budgetExceeded: false, costs, estimateYuan: 0, budgetYuan: 0};
  }
  for (const k of Object.keys(doc)) {
    if (TOP_KEYS.has(k)) continue;
    if (/reference/i.test(k)) err(k, '不能自带参考图', '删掉这个字段。参考图由风格预设提供，模型不要写');
    else err(k, `多了一个不认识的字段「${k}」`, `删掉 ${k}。可用字段：version、style、provider、quality、budgetYuan、captions、keepFace、clips`);
  }
  if (doc.version !== 1) err('version', `必须是 1，现在是 ${JSON.stringify(doc.version)}`, '改成 1');
  if (!styles[doc.style]) err('style', `没有叫「${doc.style ?? ''}」的风格预设`, `改成 ${Object.keys(styles).join('、') || 'brick-diorama'}`);
  if (!PROVIDERS.includes(doc.provider)) err('provider', `「${doc.provider ?? ''}」不在可选值里`, '改成 placeholder、local 或 minimax-h3');
  else if (doc.provider === 'minimax-h3') err('provider', 'minimax-h3 下一版才支持', '这一版先写 placeholder（占位片）或 local（自带视频）');
  if (!QUALITIES.includes(doc.quality)) err('quality', `「${doc.quality ?? ''}」不在可选值里`, '改成 768P 或 2K');
  if (typeof doc.budgetYuan !== 'number' || !Number.isFinite(doc.budgetYuan) || doc.budgetYuan < 0) err('budgetYuan', '要写一个不小于 0 的数字，单位是元', '比如 20');
  if (!CAPTIONS.includes(doc.captions)) err('captions', `「${doc.captions ?? ''}」不在可选值里`, 'burned = 原片已经烧了字幕；add = 按 SRT 另画一层；none = 不要字幕');

  const keepFace = Array.isArray(doc.keepFace) ? doc.keepFace : doc.keepFace == null ? [] : null;
  if (!keepFace) err('keepFace', '要写成句子号的数组', '比如 ["c7"]；没有就写成 [] 或整段删掉');
  else {
    for (const id of keepFace) {
      if (typeof id !== 'string' || !CUE_RE.test(id)) err('keepFace', `「${id}」不是句子号`, '写成 c1、c2 这样');
      else if (!byId.has(id)) err('keepFace', `${id} 在字幕里没有`, '先跑 list-cues 看句子号。第一句和最后一句脚本会自动保护');
    }
  }

  if (!Array.isArray(doc.clips)) {
    err('clips', '要写成数组', '至少 1 段、最多 12 段');
    return finish(doc, errors, warnings, costs);
  }
  if (doc.clips.length < 1 || doc.clips.length > 12) err('clips', `现在 ${doc.clips.length} 段，要在 1 到 12 段之间`, '删掉多余的段，或补上至少一段');

  const seen = new Set();
  const ready = [];
  doc.clips.forEach((clip, i) => {
    const where = clip && typeof clip === 'object' && typeof clip.id === 'string' ? clip.id : `clips[${i}]`;
    if (!clip || typeof clip !== 'object' || Array.isArray(clip)) {
      err(where, '这一段必须是对象', '看 broll/README.md 里 clips 的字段');
      return;
    }
    for (const k of Object.keys(clip)) {
      if (CLIP_KEYS.has(k)) continue;
      if (/reference/i.test(k)) err(`${where}.${k}`, '不能自带参考图', '删掉这个字段。参考图由风格预设提供');
      else err(`${where}.${k}`, `多了一个不认识的字段「${k}」`, '删掉它。这一段只写 id、from、to、mode、job、plain、place、subject、action、end 或 beats、camera，local 再加 file');
    }
    if (typeof clip.id !== 'string' || !ID_RE.test(clip.id)) err(`${where}.id`, `id「${clip.id ?? ''}」要形如 b01`, '改成两位数字，如 b01、b02');
    else if (seen.has(clip.id)) err(clip.id, `id「${clip.id}」重复`, '每段用不同的 id');
    else seen.add(clip.id);
    const id = ID_RE.test(clip.id) ? clip.id : where;

    if (typeof clip.from !== 'string' || !CUE_RE.test(clip.from)) err(`${id}.from`, `「${clip.from ?? ''}」不是句子号`, '写成 c1、c2 这样，先跑 list-cues');
    else if (!byId.has(clip.from)) err(`${id}.from`, `${clip.from} 在字幕里没有`, '改成 list-cues 里有的句子号');
    if (typeof clip.to !== 'string' || !CUE_RE.test(clip.to)) err(`${id}.to`, `「${clip.to ?? ''}」不是句子号`, '写成 c1、c2 这样');
    else if (!byId.has(clip.to)) err(`${id}.to`, `${clip.to} 在字幕里没有`, '改成 list-cues 里有的句子号');
    if (byId.has(clip.from) && byId.has(clip.to) && cueNo(clip.from) > cueNo(clip.to)) err(id, `from 是 ${clip.from}，to 是 ${clip.to}，起点比终点晚`, '让 from 的句子号小于或等于 to');

    if (!MODES.includes(clip.mode)) err(`${id}.mode`, `「${clip.mode ?? ''}」不在可选值里`, '改成 full、pip 或 split');
    if (!JOBS.includes(clip.job)) err(`${id}.job`, `「${clip.job ?? ''}」不在可选值里`, `改成 ${JOBS.join('、')}`);
    if (!CAMERAS.includes(clip.camera)) err(`${id}.camera`, `「${clip.camera ?? ''}」不在可选值里`, `改成 ${CAMERAS.join('、')}`);

    for (const key of ['plain', 'place', 'subject']) {
      if (typeof clip[key] !== 'string' || !clip[key].trim()) err(`${id}.${key}`, '不能空着', `写一句不超过 ${LIMITS[key]} 字的话`);
      else if (charCount(clip[key]) > LIMITS[key]) err(`${id}.${key}`, `${charCount(clip[key])} 字，最多 ${LIMITS[key]} 字`, '整句换成更短的说法，不要删掉词里的字来凑数');
    }

    const hasAction = typeof clip.action === 'string' || typeof clip.end === 'string';
    const hasBeats = Array.isArray(clip.beats);
    if (hasAction && hasBeats) err(id, 'action 和 beats 都写了', '只留一种。一拍写 action 和 end；多拍只写 beats（2 到 4 拍）');
    else if (!hasAction && !hasBeats) err(id, '缺少动作', '写 action 和 end，或写 2 到 4 拍 beats');
    else if (hasBeats) {
      if (clip.beats.length < 2 || clip.beats.length > 4) err(`${id}.beats`, `现在 ${clip.beats.length} 拍，要 2 到 4 拍`, '改成 2 到 4 拍；只有一拍就改成 action 和 end，删掉 beats');
      clip.beats.forEach((b, bi) => {
        if (!b || typeof b !== 'object' || Array.isArray(b)) {
          err(`${id}.beats[${bi}]`, '每一拍要是对象', '写成 {"action":"…","end":"…"}');
          return;
        }
        for (const k of Object.keys(b)) if (!BEAT_KEYS.has(k)) err(`${id}.beats[${bi}].${k}`, `多了一个不认识的字段「${k}」`, '这一拍只写 action 和 end');
        for (const key of ['action', 'end']) {
          if (typeof b[key] !== 'string' || !b[key].trim()) err(`${id}.beats[${bi}].${key}`, '不能空着', `写不超过 ${LIMITS[key]} 字`);
          else if (charCount(b[key]) > LIMITS[key]) err(`${id}.beats[${bi}].${key}`, `${charCount(b[key])} 字，最多 ${LIMITS[key]} 字`, '整句换成更短的说法');
        }
      });
    } else {
      if (typeof clip.action !== 'string' || !clip.action.trim()) err(`${id}.action`, '和 end 成对，不能空着', `写不超过 ${LIMITS.action} 字的动作`);
      else if (charCount(clip.action) > LIMITS.action) err(`${id}.action`, `${charCount(clip.action)} 字，最多 ${LIMITS.action} 字`, '整句换成更短的说法');
      if (typeof clip.end !== 'string' || !clip.end.trim()) err(`${id}.end`, '和 action 成对，不能空着', `写不超过 ${LIMITS.end} 字的结束画面`);
      else if (charCount(clip.end) > LIMITS.end) err(`${id}.end`, `${charCount(clip.end)} 字，最多 ${LIMITS.end} 字`, '整句换成更短的说法');
    }

    scanText(id, clip, banned, err);
    if (doc.provider === 'local') {
      if (typeof clip.file !== 'string' || !clip.file.trim()) err(`${id}.file`, 'provider 是 local，要写 file', '填上这段 B-roll 的视频路径，相对项目目录或绝对路径');
      else if (ctx.projectDir) {
        const abs = path.resolve(ctx.projectDir, clip.file);
        if (!fs.existsSync(abs)) err(`${id}.file`, `找不到 ${clip.file}`, '改成真实存在的视频路径');
      }
    } else if (clip.file != null) err(`${id}.file`, 'provider 不是 local，不要写 file', '删掉 file。占位片和生成片都不收自带视频');

    if (clip.mode === 'split' && width > 0 && height > 0 && !isVertical(width, height)) err(`${id}.mode`, `split 只能用于竖版，原片是 ${width}×${height}`, '改成 full 或 pip');
    if (doc.captions === 'burned' && (clip.mode === 'full' || clip.mode === 'pip')) {
      err(`${id}.mode`, `captions 是 burned，${clip.mode} 会盖住原片上已经烧进去的字幕`, '竖版改成 split，或把 captions 改成 add，让字幕画在 B-roll 上面');
    }

    if (byId.has(clip.from) && byId.has(clip.to) && cueNo(clip.from) <= cueNo(clip.to) && durationMs > 0) {
      const win = windowOf(byId.get(clip.from), byId.get(clip.to), durationMs);
      ready.push({clip, id, win});
    }
  });

  const protectedIds = new Set(keepFace ?? []);
  if (cues.length) {
    protectedIds.add(cues[0].id);
    protectedIds.add(cues[cues.length - 1].id);
  }
  const auto = new Set(cues.length ? [cues[0].id, cues[cues.length - 1].id] : []);

  for (const item of ready) {
    const {id, clip, win} = item;
    if (win.durationMs < MIN_COVER_MS) err(id, `这段盖住 ${secText(win.durationMs)} 秒，短于 2.5 秒`, '把 to 延到后面的句子，让这段盖住 2.5 到 12 秒');
    else if (win.durationMs > MAX_COVER_MS) err(id, `这段盖住 ${secText(win.durationMs)} 秒，长于 12 秒`, '把 to 收回到更早的句子');
    for (let n = cueNo(clip.from); n <= cueNo(clip.to); n++) {
      const cid = `c${n}`;
      if (!protectedIds.has(cid)) continue;
      const why = auto.has(cid) ? (cid === cues[0].id ? '第一句' : '最后一句') : 'keepFace 里的';
      err(id, `盖住了不许盖的${why} ${cid}`, '把 from / to 挪开。第一句、最后一句，以及 keepFace 里的句子都要露着真人');
    }
    for (const cue of cues) {
      if (!protectedIds.has(cue.id)) continue;
      if (cueNo(cue.id) >= cueNo(clip.from) && cueNo(cue.id) <= cueNo(clip.to)) continue;
      const overlap = Math.min(win.endMs, cue.endMs) - Math.max(win.startMs, cue.startMs);
      if (overlap > 0) {
        const why = auto.has(cue.id) ? (cue.id === cues[0].id ? '第一句' : '最后一句') : 'keepFace 里的';
        err(id, `窗口 ${secText(win.startMs)}–${secText(win.endMs)} 秒盖住了${why} ${cue.id}（句首会再提前 120 毫秒，句尾再留 200 毫秒）`, '让上一段口播更早结束，或从再往后的句子开始');
      }
    }
    if (Array.isArray(clip.beats) && clip.beats.length >= 2 && clip.beats.length <= 4 && win.durationMs >= MIN_COVER_MS && win.durationMs <= MAX_COVER_MS) {
      const gen = genSecOf(win.durationMs);
      const maxBeats = gen / MIN_BEAT_SEC;
      if (clip.beats.length > maxBeats + 1e-9) err(`${id}.beats`, `生成 ${gen} 秒，${clip.beats.length} 拍每拍不到 1.2 秒`, `减到 ${Math.max(2, Math.floor(maxBeats))} 拍以内，或把 from / to 拉长`);
    }
    for (let n = cueNo(clip.from); n <= cueNo(clip.to); n++) {
      const cue = byId.get(`c${n}`);
      if (!cue) continue;
      const hit = PERSON.find((w) => cue.text.includes(w));
      if (hit) warn(`${id}（${cue.id}）`, `这句有第一人称经历或情绪（「${hit}」），盖住脸会不像在讲自己的事`, '改口播，或把这句放进 keepFace');
    }
    if (QUALITIES.includes(doc.quality) && PROVIDERS.includes(doc.provider)) {
      const genSec = genSecOf(win.durationMs);
      const costYuan = clipCost(doc.provider, doc.quality, genSec);
      costs.push({id, genSec, rate: rateOf(doc.provider, doc.quality), costYuan, windowMs: [win.startMs, win.endMs]});
    }
  }

  const ordered = [...ready].sort((a, b) => a.win.startMs - b.win.startMs || cueNo(a.clip.from) - cueNo(b.clip.from));
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const gap = cur.win.startMs - prev.win.endMs;
    if (gap < 0) err(cur.id, `和 ${prev.id} 的时间叠在一起（${prev.id} 到 ${secText(prev.win.endMs)} 秒，${cur.id} 从 ${secText(cur.win.startMs)} 秒开始）`, `把 ${cur.id} 的 from 挪到更后面的句子，两段窗口不要重叠`);
    else if (gap < MIN_GAP_MS) err(cur.id, `和 ${prev.id} 之间只留了 ${secText(gap)} 秒真人画面，至少要 1.0 秒`, '把后一段的 from 再往后挪一句，或把前一段的 to 往前收');
  }
  for (let i = 1; i < ready.length; i++) {
    if (ready[i].win.startMs < ready[i - 1].win.startMs) err('clips', `没有按时间排序，${ready[i].id} 写在 ${ready[i - 1].id} 后面，但更早`, '按 from 的先后重排 clips');
  }
  if (ready.length && durationMs > 0) {
    const sum = ready.reduce((a, c) => a + c.win.durationMs, 0);
    const cap = durationMs * MAX_RATIO;
    if (sum > cap + 1e-6) err('clips', `B-roll 一共 ${secText(sum)} 秒，超过全片 ${secText(durationMs)} 秒的 60%（最多 ${secText(cap)} 秒）`, '删掉一段，或把某段的 to 往前收');
  }

  return finish(doc, errors, warnings, costs, ready.length === doc.clips.length);
};

const scanText = (id, clip, banned, err) => {
  const fields = [];
  for (const key of ['plain', 'place', 'subject', 'action', 'end']) if (typeof clip[key] === 'string') fields.push([key, clip[key]]);
  if (Array.isArray(clip.beats)) {
    clip.beats.forEach((b, i) => {
      if (!b || typeof b !== 'object') return;
      for (const key of ['action', 'end']) if (typeof b[key] === 'string') fields.push([`beats[${i}].${key}`, b[key]]);
    });
  }
  for (const [key, text] of fields) {
    for (const hit of findBanned(text, banned)) err(`${id}.${key}`, `含禁用词「${hit.word}」`, `换成「${hit.suggest}」（不要出现品牌和商标）`);
    const q = text.match(QUOTE_RE);
    if (q) err(`${id}.${key}`, `含引号「${q[0]}」，生成画面里的字不可靠`, '删掉引号，也不要要求画面上写出这句话');
    const letter = text.match(LETTER_RE);
    if (letter) err(`${id}.${key}`, `含「${letter[0]}」，生成画面里的字不可靠`, '删掉「写着」「显示文字」「标语」「字幕」这类要求画面出字的说法');
    const digit = text.match(DIGIT_RE);
    if (digit) err(`${id}.${key}`, `含数字「${digit[0]}」，生成画面里的数字不可靠`, '数字请用宣传片的数字镜头，这里改成不带阿拉伯数字和百分比的说法');
  }
};

const finish = (doc, errors, warnings, costs, budgetReady = false) => {
  const estimateYuan = Math.round(costs.reduce((a, c) => a + (c.costYuan ?? 0), 0) * 100) / 100;
  const budgetYuan = typeof doc?.budgetYuan === 'number' ? doc.budgetYuan : 0;
  const budgetExceeded = Boolean(budgetReady && costs.length && estimateYuan > budgetYuan + 1e-9);
  return {errors, warnings, budgetExceeded, costs, estimateYuan, budgetYuan};
};

export const formatReport = (r) => {
  const out = [];
  if (r.errors?.length) {
    out.push(`校验未通过：${r.errors.length} 个问题`);
    r.errors.forEach((e, k) => out.push(`${k + 1}. ${e.where}：${e.problem}\n   → 怎么改：${e.fix}`));
  }
  if (r.budgetExceeded) out.push(formatBudget(r));
  if (r.warnings?.length) {
    out.push(`提醒 ${r.warnings.length} 条（不拦截）：`);
    r.warnings.forEach((e) => out.push(`  - ${e.where}：${e.problem}（${e.fix}）`));
  }
  if (!r.errors?.length && !r.budgetExceeded) out.push(`校验通过：估价 ${r.estimateYuan} 元（预算 ${r.budgetYuan} 元）`);
  return out.join('\n');
};

export const formatBudget = (r) => {
  const lines = [`估价 ${r.estimateYuan} 元，超过预算 ${r.budgetYuan} 元。这一批不生成。`];
  for (const c of r.costs ?? []) lines.push(`  ${c.id}  ${c.genSec} 秒 × ${c.rate} 元/秒 = ${c.costYuan} 元`);
  lines.push('   → 怎么改：提高 budgetYuan，或减少段数、缩短 from / to，或把 quality 改成 768P');
  return lines.join('\n');
};

export const loadProject = (dir) => {
  const talk = path.join(dir, 'talk.mp4');
  const srtPath = path.join(dir, 'talk.srt');
  const jsonPath = path.join(dir, 'broll.json');
  const missing = ['talk.mp4', 'talk.srt', 'broll.json'].filter((name) => !fs.existsSync(path.join(dir, name)));
  if (missing.length) return {ok: false, exitCode: 2, message: `项目目录缺少 ${missing.join('、')}。需要 talk.mp4、talk.srt 和 broll.json。`};
  let cues;
  try {
    cues = parseSrt(fs.readFileSync(srtPath, 'utf8'));
  } catch (e) {
    return {ok: false, exitCode: 1, message: e.message};
  }
  if (!cues.length) return {ok: false, exitCode: 1, message: '字幕里一句都没有。检查 talk.srt 是不是空的。'};
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    return {ok: false, exitCode: 1, message: `broll.json 解析失败（${e.message}）。检查逗号、括号，字符串里不要用中文引号当 JSON 引号。`};
  }
  let media;
  try {
    media = probeMedia(talk);
  } catch (e) {
    return {ok: false, exitCode: 2, message: e.message};
  }
  return {ok: true, dir, talk, srtPath, jsonPath, cues, doc, media};
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dirArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!dirArg) {
    console.log('用法：node scripts/broll/validate.mjs <项目目录>');
    process.exit(2);
  }
  const loaded = loadProject(path.resolve(dirArg));
  if (!loaded.ok) {
    console.log(loaded.message);
    process.exit(loaded.exitCode);
  }
  const r = validateBroll(loaded.doc, {
    cues: loaded.cues,
    durationMs: loaded.media.durationMs,
    width: loaded.media.width,
    height: loaded.media.height,
    styles: loadStyles(),
    banned: loadBanned(),
    projectDir: loaded.dir,
  });
  console.log(formatReport(r));
  if (r.budgetExceeded) process.exit(3);
  process.exit(r.errors.length ? 1 : 0);
}
