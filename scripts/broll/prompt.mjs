import fs from 'node:fs';
import path from 'node:path';
import {sha256File} from './hash.mjs';
import {lintMotionTheme} from './motion.mjs';
import {IMAGE_YUAN} from './prices.mjs';
import {EXPANSION_MODES} from './providers/minimax-h3.mjs';
import {ROOT} from './root.mjs';
import {beatSpans, fmtSec} from './time.mjs';

/**
 * 提示词 = 风格固定描述 + 地点/主体/动作（或按生成秒数切开的 beats）+ 运镜 + 固定禁用句。
 * plain 不进提示词。version 1 的老文件走这里，一个字都不改（改了老项目的请求哈希会变、重新花钱）。
 */
export const buildPrompt = ({style, clip, genSec}) => {
  const parts = [];
  if (style?.look) parts.push(style.look.endsWith('。') ? style.look : `${style.look}。`);
  parts.push(`地点：${clip.place}。`);
  parts.push(`主体：${clip.subject}。`);
  if (Array.isArray(clip.beats) && clip.beats.length) {
    const spans = beatSpans(genSec, clip.beats.length);
    const body = clip.beats
      .map((b, i) => `${fmtSec(spans[i][0])}–${fmtSec(spans[i][1])} 秒：${b.action}，结束画面：${b.end}`)
      .join('；');
    parts.push(`${body}。`);
  } else {
    parts.push(`动作：${clip.action}。结束画面：${clip.end}。`);
  }
  const cam = style?.camera?.[clip.camera] || clip.camera;
  parts.push(`${cam}。`);
  if (style?.forbid) parts.push(style.forbid.endsWith('。') ? style.forbid : `${style.forbid}。`);
  return parts.join('');
};

// ───────────────────────── version 2：多风格 + 共用角色 ─────────────────────────
// broll.json v2：顶层 style（主风格）+ 可选 styleAlt（副风格）+ 可选 thread（主线，只进审片页和日志）；
// 每段 look: main|alt、link: new|continue。角色形状和色号在 broll/character.json，所有风格共用；
// 风格包 broll/styles/<id>/style.json 只管材质、地面、运镜和适合的 job。

export const LOOKS = ['main', 'alt'];
export const LINKS = ['new', 'continue'];
export const STATUSES = ['default', 'stable', 'experimental'];
export const ALL_JOBS = ['demonstrate', 'explain', 'ground', 'compare', 'quantify', 'evoke', 'connect'];
/** 动效画面专用的 job（motion 模块加的），AI 画面不用。 */
export const MOTION_JOBS = ['list', 'stress'];
export const ALL_CAMERAS = ['static', 'slow-push', 'pull-back', 'pan-left', 'pan-right', 'orbit', 'top-down'];
export const CAMERA_TEXT = {
  static: '镜头固定不动',
  'slow-push': '镜头缓慢推近',
  'pull-back': '镜头缓慢拉远',
  'pan-left': '镜头缓慢向左摇',
  'pan-right': '镜头缓慢向右摇',
  orbit: '镜头缓缓环绕主体',
  'top-down': '镜头从正上方俯拍',
};
/** image-01 认的宽高比。 */
export const IMAGE_ASPECTS = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9'];
/**
 * 拼好的提示词里一个都不许有的词。写「不要凸点」也算：视频模型没有反向提示词，
 * 写进去的词都会被当成要画的东西。英文按不分大小写的子串查（studless 也算）。
 */
export const LEAK_WORDS = ['凸点', '乐高', '拼搭', '颗粒', '人仔', 'stud', 'lego', 'minifig'];
export const THREAD_MAX = 20;
/** 凡是让人把 version 1 改成 2 的报错都带上这句：v2 的提示词和请求字段都变了，已经付费生成的段会重新花钱。 */
export const V2_COST_NOTE = '注意：改成 2 以后，已经生成过的 AI 段会按新的提示词重新生成、重新花钱';
export const DEFAULT_STYLE = 'wood-blocks';
const COLOR_BEFORE_ROBOT = /(浅蓝灰|蓝灰|[红橙黄绿青蓝紫灰白黑粉棕金银]色?)的?机器人/;

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const chars = (s) => Array.from(String(s ?? '').replace(/\s+/g, '')).length;
const sentence = (s) => {
  const t = String(s ?? '').trim();
  if (!t) return '';
  return /[。！？.!?]$/.test(t) ? t : `${t}。`;
};

export const stylesDir = (root = ROOT) => path.join(root, 'broll', 'styles');
export const styleDirOf = (id, root = ROOT) => path.join(stylesDir(root), id);

/** 读所有风格包，键是目录名。和 validate.mjs 的 loadStyles 返回同样的形状。 */
export const readStyles = (root = ROOT) => {
  const dir = stylesDir(root);
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name, 'style.json');
    if (fs.existsSync(p)) out[name] = readJson(p);
  }
  return out;
};

/** 共用角色规格 broll/character.json。 */
export const loadCharacter = (root = ROOT) => readJson(path.join(root, 'broll', 'character.json'));

export const isExperimental = (style) => style?.status === 'experimental';
export const styleLabel = (style, id) => (style?.name ? `${style.name}（${id}）` : String(id ?? ''));
/** 默认主风格：style.json 里 default 为 true 的那个，没有就是 wood-blocks。 */
export const defaultStyleId = (styles = {}) => Object.keys(styles).find((id) => styles[id]?.default === true) ?? DEFAULT_STYLE;
/** 不是实验风格的 id，按目录名排序。 */
export const stableStyleIds = (styles = {}) => Object.keys(styles).filter((id) => !isExperimental(styles[id]));

/** 不写 source 或写 ai 都是 AI 画面；source 为 motion 的是免费动效，不归风格管。 */
export const isAiClip = (clip) => !!clip && typeof clip === 'object' && !Array.isArray(clip) && clip.source !== 'motion';
export const isV2 = (doc) => doc?.version === 2;
export const lookOf = (clip) => clip?.look ?? 'main';
export const linkOf = (clip) => clip?.link ?? 'new';
/** 这一段实际用的风格 id。v1 永远是 doc.style。 */
export const clipStyleId = (doc, clip) => (isV2(doc) && lookOf(clip) === 'alt' ? doc.styleAlt : doc.style);
/** 一段的结束画面：多拍取最后一拍的 end。 */
export const endOf = (clip) => {
  if (Array.isArray(clip?.beats) && clip.beats.length) {
    const last = clip.beats[clip.beats.length - 1];
    return typeof last?.end === 'string' && last.end.trim() ? last.end.trim() : null;
  }
  return typeof clip?.end === 'string' && clip.end.trim() ? clip.end.trim() : null;
};
/** link 为 continue 时要接的上一段（clips 里紧挨着的前一段）；其他情况 null。 */
export const prevForContinue = (doc, clip) => {
  if (!isV2(doc) || linkOf(clip) !== 'continue' || !Array.isArray(doc?.clips)) return null;
  let i = doc.clips.indexOf(clip);
  if (i < 0 && clip?.id) i = doc.clips.findIndex((c) => c?.id === clip.id);
  return i > 0 ? doc.clips[i - 1] : null;
};

/** 风格的参考图清单（不碰磁盘）：v2 的 refs，没有就退回 v1 的 references。 */
export const refListOf = (style) => {
  if (Array.isArray(style?.refs) && style.refs.length) {
    return style.refs.map((r) => (typeof r === 'string' ? {file: r, role: '参考'} : {...r, file: r.file, role: r.role || '参考'}));
  }
  if (Array.isArray(style?.references)) return style.references.map((file) => ({file, role: '参考'}));
  return [];
};

/** 参考图在磁盘上的位置和有没有。返回 [{file, role, abs, exists, ...}]，顺序就是送给 H3 的顺序（图1、图2）。 */
export const styleRefs = (styleId, style, root = ROOT) => {
  const dir = styleDirOf(styleId, root);
  return refListOf(style).map((r) => {
    const abs = path.resolve(dir, r.file);
    return {...r, abs, exists: fs.existsSync(abs)};
  });
};

/** 这一段要送的参考图（按 look 选风格）。 */
export const clipRefs = ({doc, clip, styles, root = ROOT}) => {
  const id = clipStyleId(doc, clip);
  return styleRefs(id, styles?.[id], root);
};

/** 风格里写的提示词扩写模式；没写或写错返回 null。只进校验和请求哈希；H3 不收 extra，目前不发送。 */
export const promptExpansionOf = (style) => (EXPANSION_MODES.includes(style?.promptExpansion) ? style.promptExpansion : null);

/** 拼好的文字里出现了哪些泄漏词（去重，按 LEAK_WORDS 的顺序）。 */
export const findLeaks = (text) => {
  const raw = String(text ?? '');
  const lower = raw.toLowerCase();
  return LEAK_WORDS.filter((w) => (/^[\x00-\x7F]+$/.test(w) ? lower.includes(w.toLowerCase()) : raw.includes(w)));
};

/**
 * 提示词 v2。顺序：图序指代 → 风格 look → 风格材质的角色 + 共用形状和色号 → 地面 + 地点 + 主体
 * → continue 时接上一段结尾 → 动作或分拍 → 运镜 → 风格 forbid。
 * 不写任何「不要 X」里的 X；最后查一遍泄漏词，查到的放在 leaked 里交给调用方拦。
 * @param {{doc: object, clip: object, prev?: object|null, genSec: number, styles: object, character: object, style?: object}} p
 * @returns {{prompt: string, leaked: string[], styleId: string, look: string, link: string, chars: number}}
 */
export const buildPromptV2 = ({doc, clip, prev = null, genSec, styles, character, style: styleOverride}) => {
  const styleId = clipStyleId(doc, clip);
  const style = styleOverride ?? styles?.[styleId];
  if (!style) throw new Error(`${clip?.id ?? '这一段'}：没有叫「${styleId ?? ''}」的风格预设。`);
  if (!character?.shape || !character?.color) throw new Error('缺少共用角色规格 broll/character.json（要有 shape 和 color）。');
  const parts = [];
  const roles = refListOf(style).map((r) => r.role);
  if (roles.length) parts.push(`${roles.map((role, i) => `图${i + 1}是${role}参考`).join('，')}。`);
  parts.push(sentence(style.lookV2 ?? style.look));
  parts.push(`${style.character}：${character.shape}；${character.color}。全片只有这一个角色，造型保持不变。`);
  parts.push(`${sentence(style.ground)}地点：${clip.place}。主体：${clip.subject}。`);
  if (linkOf(clip) === 'continue' && prev) {
    const end = endOf(prev);
    if (end) parts.push(`开场画面接上一段的结尾：${end}。`);
  }
  if (Array.isArray(clip.beats) && clip.beats.length) {
    const spans = beatSpans(genSec, clip.beats.length);
    const body = clip.beats.map((b, i) => `${fmtSec(spans[i][0])}–${fmtSec(spans[i][1])} 秒：${b.action}，结束画面：${b.end}`).join('；');
    parts.push(`${body}。`);
  } else {
    parts.push(`动作：${clip.action}。结束画面：${clip.end}。`);
  }
  parts.push(sentence(style.camera?.[clip.camera] ?? CAMERA_TEXT[clip.camera] ?? clip.camera));
  parts.push(sentence(style.forbidV2 ?? style.forbid));
  const prompt = parts.filter(Boolean).join('');
  return {prompt, leaked: findLeaks(prompt), styleId, look: lookOf(clip), link: linkOf(clip), chars: Array.from(prompt).length};
};

/**
 * v2 时 requestHash 要额外带上的字段（合进 plan.mjs 原来的 request 对象再算哈希）。
 * 参考图按这一段实际用的风格算 sha256，不存在的记成 missing:<file>，和 plan.mjs 的老写法一样。
 * @returns {{styleId: string, look: string, link: string, promptExpansion: string|null, referenceSha256: string[], prevEnd: string|null}}
 */
export const hashFieldsV2 = ({doc, clip, prev = null, styles, root = ROOT}) => {
  const styleId = clipStyleId(doc, clip);
  const style = styles?.[styleId];
  return {
    styleId,
    look: lookOf(clip),
    link: linkOf(clip),
    promptExpansion: promptExpansionOf(style),
    referenceSha256: styleRefs(styleId, style, root).map((r) => (r.exists ? sha256File(r.abs) : `missing:${r.file}`)),
    prevEnd: linkOf(clip) === 'continue' && prev ? endOf(prev) : null,
  };
};

/** 参考图齐全的风格 id（不含实验风格）。 */
export const readyStyleIds = (styles = {}, root = ROOT) =>
  stableStyleIds(styles).filter((id) => {
    const refs = styleRefs(id, styles[id], root);
    return refs.length > 0 && refs.every((r) => r.exists);
  });

/** 缺参考图时的报错（哪个风格、缺哪几张、下一步三条）。field 是 style 或 styleAlt。 */
export const refsMissingProblem = ({styleId, style, missing, field = 'style', styles = {}, root = ROOT}) => {
  const ready = readyStyleIds(styles, root).filter((id) => id !== styleId);
  const options = [];
  if (ready.length) options.push(`把 ${field} 换成已经有参考图的风格（${ready.join('、')}）`);
  options.push('这几段改成动效画面（source 写 motion）或删掉留脸，动效画面不花钱、不用参考图');
  options.push('先用 provider placeholder 出占位版，看排版和节奏');
  const marks = ['①', '②', '③'];
  return {
    where: field,
    problem: `风格「${styleLabel(style, styleId)}」还没有参考图（缺 ${missing.join('、')}），这一版还不能用它真生成。AI 画面靠参考图定住角色和材质，缺了不提交，也没有花钱`,
    fix: `${options.length === 3 ? '三' : '二'}选一：${options.map((o, i) => `${marks[i]} ${o}`).join('；')}。参考图由项目维护者出好、随新版本发布，普通用户不用自己出，等新版本就行。（维护者出图：node scripts/broll/make-style-refs.mjs --style ${styleId} --dry-run 先看请求，确认后换成 --yes，每张 ${IMAGE_YUAN} 元）`,
  };
};

/**
 * 用到的风格里谁缺参考图。只看 AI 画面段；全是动效就返回 []。
 * 只在 provider 是 minimax-h3、真要提交之前调用（llm_broll 的回喂里不要调：便宜模型改不了这个）。
 * @returns {{where: string, problem: string, fix: string}[]}
 */
export const missingRefs = (doc, styles = {}, {root = ROOT} = {}) => {
  const clips = Array.isArray(doc?.clips) ? doc.clips : [];
  const used = new Set(clips.filter(isAiClip).map((c) => clipStyleId(doc, c)).filter((id) => typeof id === 'string' && styles[id]));
  const out = [];
  for (const id of used) {
    const refs = styleRefs(id, styles[id], root);
    const missing = refs.length ? refs.filter((r) => !r.exists).map((r) => r.file) : ['（这个风格一张参考图都没写）'];
    if (!missing.length) continue;
    out.push(refsMissingProblem({styleId: id, style: styles[id], missing, field: id === doc.style ? 'style' : 'styleAlt', styles, root}));
  }
  return out;
};

/** 出图提示里的 {character} 换成「本风格材质的机器人 + 共用形状和色号」（英文）。 */
export const expandRefPrompt = (ref, style, character) => {
  const robot = `${style?.characterEn ?? 'a toy robot'}: ${character?.en?.shape ?? ''} ${character?.en?.color ?? ''}`.replace(/\s+/g, ' ').trim();
  return String(ref?.prompt ?? '').split('{character}').join(robot);
};

/** 给便宜模型的风格清单：主风格一行，再列它能搭的副风格。返回若干行。 */
export const styleMenu = (styles = {}, mainId = defaultStyleId(styles)) => {
  const line = (id) => {
    const st = styles[id];
    if (!st) return `- ${id}：没有这个风格`;
    return `- ${styleLabel(st, id)}：${st.summary ?? ''}。适合 job：${(st.jobs ?? []).join('、')}；镜头：${(st.cameras ?? []).join('、')}`;
  };
  const main = styles[mainId];
  const alts = (main?.pairsWith ?? []).filter((id) => styles[id] && !isExperimental(styles[id]));
  const lines = ['主风格（style，命令行已经定好，照写）：', line(mainId)];
  if (alts.length) lines.push('可选副风格（styleAlt，最多一个，可以不用）：', ...alts.map(line));
  return lines;
};

const materialIndex = (styles) => {
  const out = [];
  for (const [id, st] of Object.entries(styles)) {
    for (const word of Array.isArray(st?.materialWords) ? st.materialWords : []) if (typeof word === 'string' && word) out.push({word, styleId: id});
  }
  return out.sort((a, b) => Array.from(b.word).length - Array.from(a.word).length);
};

const actionTexts = (clip) => {
  const out = [];
  for (const key of ['action', 'end']) if (typeof clip[key] === 'string') out.push(clip[key]);
  if (Array.isArray(clip.beats)) {
    for (const b of clip.beats) {
      if (!b || typeof b !== 'object') continue;
      for (const key of ['action', 'end']) if (typeof b[key] === 'string') out.push(b[key]);
    }
  }
  return out;
};

const promptReady = (clip) => {
  if (typeof clip.place !== 'string' || typeof clip.subject !== 'string') return false;
  if (Array.isArray(clip.beats)) return clip.beats.length > 0 && clip.beats.every((b) => b && typeof b.action === 'string' && typeof b.end === 'string');
  return typeof clip.action === 'string' && typeof clip.end === 'string';
};

/**
 * 风格和段间配合的校验。错误格式和 validate.mjs 一样：{where, problem, fix}。
 * version 1：只提醒实验风格；写了 v2 字段就让改 version。时间窗、字数、禁用词等仍由 validate.mjs 管。
 * version 2：规则 1–13，外加拼好的提示词不许有泄漏词。source 为 motion 的段不参与。
 * @param {object} doc broll.json
 * @param {object} styles 风格包，键是 id（readStyles() 或 validate.mjs 的 loadStyles()）
 * @param {{character?: object, root?: string}} [opts]
 * @returns {{errors: {where: string, problem: string, fix: string}[], warnings: {where: string, problem: string, fix: string}[]}}
 */
export const validateStyles = (doc, styles = {}, opts = {}) => {
  const errors = [];
  const warnings = [];
  const err = (where, problem, fix) => errors.push({where, problem, fix});
  const warn = (where, problem, fix) => warnings.push({where, problem, fix});
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return {errors, warnings};
  const clips = Array.isArray(doc.clips) ? doc.clips : [];
  const whereOf = (clip, i) => (clip && typeof clip === 'object' && typeof clip.id === 'string' && clip.id ? clip.id : `clips[${i}]`);
  const def = defaultStyleId(styles);
  const stableText = stableStyleIds(styles).join('、') || def;
  // 原因写在各风格的 summary 里（brick-diorama 会出凸点，ink-sketch 参考图未出），这里不写死某一个风格的毛病
  const otherStable = stableStyleIds(styles).filter((id) => id !== def);
  const experimentalWarn = (field, id) =>
    warn(
      field,
      `${styleLabel(styles[id], id)}是实验风格，不是默认：${styles[id]?.summary ?? '效果没有验证过'}`,
      `换成 ${def}（${styles[def]?.name ?? '积木风'}）${otherStable.length ? `或 ${otherStable.join('、')}` : ''}；一定要用就先用 provider placeholder 看排版，真生成后在审片页逐帧看`,
    );

  if (!isV2(doc)) {
    for (const k of ['styleAlt', 'thread']) {
      if (k in doc) err(k, `${k} 是 version 2 的写法，现在 version 是 ${JSON.stringify(doc.version)}`, `用不上就删掉 ${k}；一定要用就把顶层 version 改成 2（${V2_COST_NOTE}）`);
    }
    clips.forEach((clip, i) => {
      if (!clip || typeof clip !== 'object') return;
      for (const k of ['look', 'link']) {
        if (k in clip) err(`${whereOf(clip, i)}.${k}`, `${k} 是 version 2 的写法，现在 version 是 ${JSON.stringify(doc.version)}`, `用不上就删掉 ${k}；一定要用就把顶层 version 改成 2（${V2_COST_NOTE}）`);
      }
    });
    if (styles[doc.style] && isExperimental(styles[doc.style])) experimentalWarn('style', doc.style);
    return {errors, warnings};
  }

  let character = opts.character;
  if (!character) {
    try {
      character = loadCharacter(opts.root ?? ROOT);
    } catch {
      err('broll/character.json', '读不到共用角色规格', '从仓库恢复 broll/character.json，它定了机器人的形状和颜色');
      character = {name: '机器人'};
    }
  }
  const robot = character.name || '机器人';

  // 规则 12：主风格
  const main = typeof doc.style === 'string' ? styles[doc.style] : null;
  if (typeof doc.style !== 'string' || !doc.style.trim()) err('style', '主风格没写', `写 ${def}（默认）。可选：${stableText}`);
  else if (!main) err('style', `没有叫「${doc.style}」的风格`, `改成 ${stableText} 之一`);
  else if (isExperimental(main)) experimentalWarn('style', doc.style);

  // 规则 3 / 12：副风格
  const pairText = main ? (main.pairsWith ?? []).join('、') || '（这个主风格不搭副风格）' : stableText;
  if (doc.styleAlt != null) {
    if (typeof doc.styleAlt !== 'string' || !styles[doc.styleAlt]) err('styleAlt', `没有叫「${doc.styleAlt}」的风格`, `改成 ${pairText} 之一，或删掉 styleAlt`);
    else if (doc.styleAlt === doc.style) err('styleAlt', 'styleAlt 和 style 一样', `删掉 styleAlt；要副风格就换一个不同的：${pairText}`);
    else if (main && !(main.pairsWith ?? []).includes(doc.styleAlt)) {
      err('styleAlt', `${styleLabel(main, doc.style)}不搭配${styleLabel(styles[doc.styleAlt], doc.styleAlt)}`, `副风格改成 ${pairText} 之一，或删掉 styleAlt`);
    }
  }

  if (doc.thread != null) {
    if (typeof doc.thread !== 'string' || !doc.thread.trim()) err('thread', '要写一句话', '比如「机器人把乱方块搭成一座桥」；用不上就删掉 thread');
    else if (chars(doc.thread) > THREAD_MAX) err('thread', `${chars(doc.thread)} 字，最多 ${THREAD_MAX} 字`, '整句换成更短的说法');
  }

  const materials = materialIndex(styles);
  const altHint = main ? (main.pairsWith ?? []).find((id) => styles[id]) ?? '' : '';
  const ai = clips.map((clip, i) => ({clip, i})).filter(({clip}) => isAiClip(clip));
  let altCount = 0;
  let switches = 0;
  let prevAi = null;
  ai.forEach(({clip, i}, k) => {
    const id = whereOf(clip, i);
    // 规则 1
    if ('style' in clip) {
      err(`${id}.style`, '段里不能写 style', `整片只有 style（主风格）和 styleAlt（副风格）两种。删掉这一段的 style；要用副风格就写 "look": "alt"${doc.styleAlt == null ? '，并在顶层加 styleAlt' : ''}`);
    }
    const look = lookOf(clip);
    if (!LOOKS.includes(look)) err(`${id}.look`, `「${look}」不在可选值里`, '写 main（主风格）或 alt（副风格），不写就是 main');
    // 规则 2
    if (look === 'alt') {
      altCount += 1;
      if (doc.styleAlt == null) err(`${id}.look`, '写了 alt，可是顶层没有 styleAlt', `在顶层加 "styleAlt": "${altHint}"，或把这一段改回 main`);
    }
    // 规则 4
    if (k === 0 && look === 'alt') err(`${id}.look`, '第一段 AI 画面必须用主风格', '把这一段改成 main（或删掉 look），副风格留给后面讲道理、做对比的段');
    // 规则 7
    const link = linkOf(clip);
    if (!LINKS.includes(link)) err(`${id}.link`, `「${link}」不在可选值里`, '写 new（新画面）或 continue（接着上一段的结束画面），不写就是 new');
    if (link === 'continue') {
      const before = i > 0 ? clips[i - 1] : null;
      if (!before || typeof before !== 'object') err(`${id}.link`, '这是第一段，前面没有画面可接', '改成 new（或删掉 link）');
      else if (!isAiClip(before)) err(`${id}.link`, `上一段 ${before.id ?? `clips[${i - 1}]`} 是动效画面，接不上`, '改成 new（或删掉 link）');
      else if (lookOf(before) !== look) {
        err(`${id}.link`, `上一段 ${before.id ?? `clips[${i - 1}]`} 是 ${lookOf(before)}，这一段是 ${look}，换了风格就接不上`, '改成 new，或让两段用同一个 look');
      }
    }
    // 规则 6 的计数
    if (prevAi && lookOf(prevAi) !== look) switches += 1;
    prevAi = clip;

    const sid = clipStyleId(doc, clip);
    const st = typeof sid === 'string' ? styles[sid] : null;
    if (!st) return;
    const name = st.name ?? sid;
    const other = look === 'alt' ? '改回 main' : '换 look';
    // 规则 8
    if (typeof clip.job === 'string' && Array.isArray(st.jobs) && !st.jobs.includes(clip.job)) {
      if (MOTION_JOBS.includes(clip.job)) err(`${id}.job`, `${clip.job} 是动效画面的 job`, `这一段改成 source: motion（list 配 checklist、stress 配 keyword），或把 job 换成 ${st.jobs.join('、')}`);
      else if (ALL_JOBS.includes(clip.job)) {
        err(`${id}.job`, `${name}不适合 ${clip.job}`, `${name}只做 ${st.jobs.join('、')}。换一个 job，或${other}${clip.job === 'quantify' ? '；讲确定的数字用动效画面的 counter 更准' : ''}`);
      }
    }
    if (typeof clip.camera === 'string' && ALL_CAMERAS.includes(clip.camera) && Array.isArray(st.cameras) && !st.cameras.includes(clip.camera)) {
      err(`${id}.camera`, `${name}不用 ${clip.camera}`, `改成 ${st.cameras.join('、')} 之一`);
    }
    // 规则 9、11
    if (typeof clip.place === 'string') {
      const hit = materials.find(({word}) => clip.place.includes(word));
      if (hit) err(`${id}.place`, `写了材质词「${hit.word}」`, '只写地点，比如「桌面」「小仓库」。材质和地面由风格自动加');
    }
    if (typeof clip.subject === 'string' && clip.subject.trim()) {
      const hit = materials.find(({word}) => clip.subject.includes(word));
      if (hit) err(`${id}.subject`, `写了材质词「${hit.word}」`, `只写「${robot}」或「${robot}和某样东西」。材质和颜色由风格和角色规格自动加`);
      else if (!clip.subject.includes(robot)) err(`${id}.subject`, `全片只有一个角色，subject 里要有「${robot}」`, `写「${robot}」或「${robot}和小推车」这样`);
      else if (COLOR_BEFORE_ROBOT.test(clip.subject)) err(`${id}.subject`, `${robot}前面写了颜色`, `只写「${robot}」。颜色由角色规格统一加，每段都一样`);
    }
    // 规则 10
    const texts = actionTexts(clip);
    const own = new Set(Array.isArray(st.materialWords) ? st.materialWords : []);
    const foreign = materials.find(({word, styleId}) => styleId !== sid && !own.has(word) && texts.some((t) => t.includes(word)));
    if (foreign) {
      err(id, `这一段是${name}，动作里写了${styles[foreign.styleId]?.name ?? foreign.styleId}的「${foreign.word}」`, `换成${name}里有的东西（或不提材质），或${other}`);
    }
    // 泄漏词：按真实拼法拼一遍
    if (promptReady(clip)) {
      const {leaked} = buildPromptV2({doc, clip, prev: prevForContinue(doc, clip), genSec: 4, styles, character});
      if (leaked.length) {
        const mine = findLeaks([clip.place, clip.subject, ...texts].join(' '));
        const list = `「${leaked.join('」「')}」`;
        if (mine.length) err(id, `拼好的提示词里有${list}，这些词会把画面往带凸点的玩具积木上带`, '从这一段的 place / subject / action / end / beats 里删掉这些词，直接写想看到的东西');
        else err(id, `风格 ${sid} 的描述里有${list}`, `这是 broll/styles/${sid}/style.json 的问题，要维护者改；先把这一段换一个风格`);
      }
    }
  });

  // 规则 13
  if (doc.styleAlt != null && typeof doc.styleAlt === 'string' && styles[doc.styleAlt] && altCount === 0) {
    warn('styleAlt', '写了副风格但没有一段用它', '删掉 styleAlt，或把一段讲道理、做对比的 AI 画面改成 "look": "alt"');
  }
  // 规则 5
  if (ai.length && altCount > Math.floor(ai.length / 2)) {
    err('clips', `${ai.length} 段 AI 画面里有 ${altCount} 段用副风格，超过一半`, '主风格要占多数：把几段改回 main，或者干脆交换 style 和 styleAlt');
  }
  // 规则 6
  if (switches > 2) err('clips', `风格来回切了 ${switches} 次，最多 2 次`, '把用副风格的段挨在一起，或改回 main');
  return {errors, warnings};
};

/**
 * 查一个风格包写得对不对（给维护者和测试用，不给便宜模型）。返回问题清单，空数组就是没问题。
 * @param {object} style style.json 的内容
 * @param {string} id 目录名
 * @param {{styles?: object, character?: object, themes?: object}} [ctx]
 * @returns {string[]}
 */
export const lintStyle = (style, id, ctx = {}) => {
  const out = [];
  const bad = (s) => out.push(`${id}：${s}`);
  if (!style || typeof style !== 'object') return [`${id}：style.json 不是对象`];
  if (style.id !== id) bad(`id 写的是「${style.id}」，要和目录名 ${id} 一样`);
  if (!STATUSES.includes(style.status)) bad(`status 要是 ${STATUSES.join(' / ')}`);
  if ((style.status === 'default') !== (style.default === true)) bad('status 为 default 的风格 default 才是 true，其他都是 false');
  for (const key of ['name', 'summary', 'character', 'ground', 'characterEn']) if (typeof style[key] !== 'string' || !style[key].trim()) bad(`${key} 不能空着`);
  const look = style.lookV2 ?? style.look;
  const forbid = style.forbidV2 ?? style.forbid;
  if (typeof look !== 'string' || !look.trim()) bad('look 不能空着');
  if (typeof forbid !== 'string' || !forbid.trim()) bad('forbid 不能空着');
  if (!Array.isArray(style.jobs) || !style.jobs.length || style.jobs.some((j) => !ALL_JOBS.includes(j))) bad(`jobs 要是 ${ALL_JOBS.join('、')} 的子集，不能空`);
  if (!Array.isArray(style.cameras) || !style.cameras.length || style.cameras.some((c) => !ALL_CAMERAS.includes(c))) bad(`cameras 要是 ${ALL_CAMERAS.join('、')} 的子集，不能空`);
  const camTexts = (Array.isArray(style.cameras) ? style.cameras : []).map((c) => style.camera?.[c] ?? CAMERA_TEXT[c]);
  if (camTexts.some((t) => typeof t !== 'string' || !t)) bad('cameras 里有运镜没有对应的说法');
  if (!Array.isArray(style.pairsWith)) bad('pairsWith 要是数组（可以是空的）');
  else {
    for (const p of style.pairsWith) {
      if (p === id) bad('pairsWith 不能写自己');
      else if (ctx.styles && !ctx.styles[p]) bad(`pairsWith 里的「${p}」不存在`);
      else if (ctx.styles && isExperimental(ctx.styles[p])) bad(`pairsWith 里的「${p}」是实验风格，不能当副风格`);
    }
  }
  if (!Array.isArray(style.materialWords) || !style.materialWords.length || style.materialWords.some((w) => typeof w !== 'string' || !w)) bad('materialWords 要写至少一个材质词');
  if (style.promptExpansion != null && !EXPANSION_MODES.includes(style.promptExpansion)) bad(`promptExpansion 要是 ${EXPANSION_MODES.join(' / ')}，或不写`);
  if (!(typeof style.freezeNoise === 'number' && style.freezeNoise > 0 && style.freezeNoise <= 0.05)) bad('freezeNoise 要是 0 到 0.05 之间的数（静帧检测的噪声容差，默认 0.003）');
  for (const p of lintMotionTheme(style.motionTheme)) bad(p);
  const refs = refListOf(style);
  if (!Array.isArray(style.refs) || !style.refs.length) bad('refs 要写参考图清单');
  const files = new Set();
  refs.forEach((r, i) => {
    if (typeof r.file !== 'string' || !r.file) bad(`refs[${i}] 缺 file`);
    else if (files.has(r.file)) bad(`refs 里 ${r.file} 写了两次`);
    else files.add(r.file);
    if (typeof r.role !== 'string' || !r.role) bad(`refs[${i}] 缺 role`);
    if (r.prompt != null) {
      if (typeof r.prompt !== 'string' || !r.prompt.trim()) bad(`refs[${i}].prompt 要是一句话或 null`);
      else {
        if (!IMAGE_ASPECTS.includes(r.aspect)) bad(`refs[${i}].aspect 要是 ${IMAGE_ASPECTS.join('、')} 之一`);
        const text = expandRefPrompt(r, style, ctx.character);
        if (text.length > 1500) bad(`refs[${i}] 的出图提示有 ${text.length} 字，image-01 上限 1500`);
        const leak = findLeaks(text);
        if (leak.length) bad(`refs[${i}] 的出图提示里有泄漏词 ${leak.join('、')}`);
      }
    }
  });
  if (refs.length > 5) bad(`参考图 ${refs.length} 张，H3 超过 5 张要另外收费`);
  const leak = findLeaks([look, style.character, style.ground, forbid, ...camTexts].join(' '));
  if (leak.length) bad(`会进提示词的字段里有泄漏词 ${leak.join('、')}`);
  return out;
};
