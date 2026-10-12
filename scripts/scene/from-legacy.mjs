#!/usr/bin/env node
// 旧分镜 → scene.json。原文案不改写。旧 JSON 仍走旧组件。
//   node scripts/scene/from-legacy.mjs <storyboard.json|lesson.json> --out <scene.json> [--skip-unsupported]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ICONS from '../../template/src/core/icons.json' with {type: 'json'};
import PRESETS_FILE from '../../template/src/scene/presets.json' with {type: 'json'};
import {defaultMotion} from '../../template/src/scene/motion.ts';
import {auditPlan, prepareScene} from '../../template/src/scene/prepare.ts';
import {sceneFrame} from './geom.mjs';
import {loadStyle} from './tokens.mjs';
import {formatReport, validateScene} from './validate-scene.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = '用法: node scripts/scene/from-legacy.mjs <storyboard.json|lesson.json> --out <scene.json> [--skip-unsupported]';
const ICON_NAMES = new Set(Object.keys(ICONS));
const LESSON_ICON_HINT = {
  document: 'doc',
  warning: 'alert',
  cross: 'x',
  percent: 'chart',
  card: 'money',
  bank: 'money',
  scale: 'chart',
  flag: 'star',
};
const TEXT_HOOK_VISUALS = new Set(['icon']);
const NUMBER_TEXT = /^\d+(?:\.\d+)?%?(?:\s*[\u3400-\u9fffA-Za-z]{1,3})?$/;

export const PRESETS = PRESETS_FILE.rows;

export function presetOf(product, legacy) {
  return PRESETS.find((row) => row.product === product && row.legacy === legacy) || null;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textOf(value) {
  return typeof value === 'string' ? value : '';
}

/** 只去掉 {} 和换行标记，汉字本身不动。 */
export function plainCopy(value) {
  const raw = Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item : textOf(item?.text))).join('') : textOf(value);
  return raw.replace(/\{|\}/g, '').replace(/\r\n|\n|\r|\\n/g, '');
}

export function emphasisOf(value) {
  const raw = Array.isArray(value) ? value.join('') : textOf(value);
  const hit = raw.match(/\{([^}]+)\}/);
  if (!hit) return undefined;
  const word = hit[1].replace(/\r\n|\n|\r|\\n/g, '');
  return word ? [word] : undefined;
}

function sceneIcon(name) {
  const raw = textOf(name).trim();
  if (!raw) return undefined;
  if (ICON_NAMES.has(raw)) return raw;
  const mapped = LESSON_ICON_HINT[raw];
  if (mapped && ICON_NAMES.has(mapped)) return mapped;
  return undefined;
}

function whenOf(piece, narration) {
  const raw = textOf(piece);
  if (!raw || !narration) return undefined;
  return String(narration).includes(raw) ? raw : undefined;
}

function kindOf(raw) {
  if (!isObject(raw)) return '';
  if (Array.isArray(raw.shots)) return 'promo';
  if (Array.isArray(raw.chapters) || Array.isArray(raw.pages) || raw.meta?.format === 'lesson') return 'lesson';
  return '';
}

export function isTextHook(shot) {
  const params = isObject(shot?.params) ? shot.params : {};
  const visual = textOf(params.visual) || 'icon';
  if (!TEXT_HOOK_VISUALS.has(visual)) return false;
  if (textOf(params.src) || textOf(params.illust)) return false;
  return true;
}

function convertibleOf(product, shot, page) {
  const type = product === 'promo' ? textOf(shot?.type) : textOf(page?.layout);
  const row = presetOf(product, type);
  if (!row) return {ok: false, why: `预设表没有「${type}」`};
  if (row.convertible === true) return {ok: true, row};
  if (row.convertible === 'text-hook') {
    if (isTextHook(shot)) return {ok: true, row};
    const visual = textOf(shot?.params?.visual) || '（空）';
    return {ok: false, row, why: `hook 的 visual=${visual}，这一轮只转纯文字（visual=icon）`};
  }
  const why = row.reason || row.delta || '这一轮不转';
  return {ok: false, row, why};
}

function shotNarration(shot) {
  if (shot?.vo) return plainCopy(shot.vo);
  if (shot?.caption) return plainCopy(shot.caption);
  return undefined;
}

function pageNarration(page) {
  const raw = page?.narration;
  if (typeof raw === 'string') return raw;
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item) => (typeof item === 'string' ? item : textOf(item?.text))).filter(Boolean).join('');
}

function cloneFacts(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(isObject).map((fact) => ({
    id: textOf(fact.id),
    text: textOf(fact.text),
    source: textOf(fact.source),
  })).filter((fact) => fact.id && fact.text);
}

function formatNum(value, decimals) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const places = Number.isInteger(decimals) ? decimals : (String(value).includes('.') ? 1 : 0);
  return places > 0 ? n.toFixed(places) : String(Math.trunc(n) === n ? Math.trunc(n) : n);
}

function numberCandidates(params) {
  const to = formatNum(params.to, params.decimals);
  const suffix = textOf(params.suffix);
  const prefix = textOf(params.prefix);
  const list = [];
  if (to && suffix) list.push(`${to} ${suffix}`, `${to}${suffix}`);
  if (to) list.push(to);
  if (to && prefix && !/[¥￥$€£]/.test(prefix)) list.unshift(`${prefix}${to}${suffix}`, `${prefix}${to} ${suffix}`.trim());
  return [...new Set(list.filter((item) => NUMBER_TEXT.test(item)))];
}

function pickFactText(facts, refs, candidates) {
  const wanted = Array.isArray(refs) ? refs.map((id) => String(id)) : [];
  const ordered = [
    ...facts.filter((fact) => wanted.includes(fact.id)),
    ...facts.filter((fact) => !wanted.includes(fact.id)),
  ];
  for (const fact of ordered) {
    const hit = candidates.find((item) => fact.text.includes(item));
    if (hit) return {fact, text: hit};
  }
  return {fact: ordered[0] || null, text: candidates[0] || ''};
}

function convertPromoShot(shot, facts) {
  const type = textOf(shot.type);
  const params = isObject(shot.params) ? shot.params : {};
  const narration = shotNarration(shot);
  if (type === 'features') {
    const items = (Array.isArray(params.items) ? params.items : []).map((item) => ({
      text: textOf(item.title),
      ...(textOf(item.desc) ? {note: textOf(item.desc)} : {}),
      ...(sceneIcon(item.icon) ? {icon: sceneIcon(item.icon)} : {}),
      ...(whenOf(item.title, narration) ? {when: textOf(item.title)} : {}),
    }));
    return {
      role: 'points',
      layout: params.layout === 'stack' ? 'stack' : 'grid',
      ...(narration ? {narration} : {}),
      items,
    };
  }
  if (type === 'steps') {
    const items = (Array.isArray(params.items) ? params.items : []).map((item) => ({
      text: textOf(item.title),
      ...(textOf(item.desc) ? {note: textOf(item.desc)} : {}),
      ...(sceneIcon(item.icon) ? {icon: sceneIcon(item.icon)} : {}),
      ...(whenOf(item.title, narration) ? {when: textOf(item.title)} : {}),
    }));
    return {
      role: 'points',
      layout: 'sequence',
      ...(narration ? {narration} : {}),
      ...(textOf(params.title) ? {title: textOf(params.title)} : {}),
      items,
    };
  }
  if (type === 'quickList') {
    const items = (Array.isArray(params.items) ? params.items : []).map((item) => ({
      text: textOf(item.text),
      ...(textOf(item.tag) ? {note: textOf(item.tag)} : {}),
      ...(sceneIcon(item.icon) ? {icon: sceneIcon(item.icon)} : {}),
      ...(whenOf(item.text, narration) ? {when: textOf(item.text)} : {}),
    }));
    return {
      role: 'points',
      layout: 'stack',
      ...(narration ? {narration} : {}),
      ...(textOf(params.title) ? {title: textOf(params.title)} : {}),
      items,
    };
  }
  if (type === 'compare') {
    const left = isObject(params.left) ? params.left : {};
    const right = isObject(params.right) ? params.right : {};
    const winner = right.tone === 'good' ? 'right' : left.tone === 'good' ? 'left' : 'right';
    return {
      role: 'compare',
      layout: 'split',
      ...(narration ? {narration} : {}),
      ...(textOf(params.verdict) ? {title: textOf(params.verdict)} : {}),
      left: {label: textOf(left.title), items: Array.isArray(left.items) ? left.items.map((item) => textOf(item)) : []},
      right: {label: textOf(right.title), items: Array.isArray(right.items) ? right.items.map((item) => textOf(item)) : []},
      winner,
    };
  }
  if (type === 'counter') {
    const candidates = numberCandidates(params);
    const picked = pickFactText(facts, params.refs, candidates);
    const fromCandidates = params.from === undefined ? [] : numberCandidates({...params, to: params.from});
    const fromHit = picked.fact && fromCandidates.find((item) => picked.fact.text.includes(item));
    return {
      role: 'number',
      layout: 'hero',
      ...(narration ? {narration} : {}),
      number: {
        text: picked.text,
        fact: picked.fact?.id || '',
        label: textOf(params.label),
        ...(fromHit ? {from: fromHit} : {}),
      },
      showComputedDelta: false,
    };
  }
  if (type === 'hook') {
    const text = plainCopy(shot.caption);
    const emphasis = emphasisOf(shot.caption);
    const support = textOf(params.badge) || textOf(params.text);
    return {
      role: 'claim',
      layout: 'hero',
      ...(narration ? {narration} : {}),
      text,
      ...(emphasis ? {emphasis} : {}),
      ...(support ? {support} : {}),
    };
  }
  if (type === 'endCard') {
    const line = plainCopy(params.slogan);
    const emphasis = emphasisOf(params.slogan);
    return {
      role: 'action',
      layout: 'end',
      ...(narration ? {narration} : {}),
      brand: textOf(params.brand),
      line,
      ...(emphasis ? {emphasis} : {}),
      ...(textOf(params.cta) ? {cta: textOf(params.cta)} : {}),
    };
  }
  return null;
}

function ensureFact(facts, id, text, source) {
  if (!text) return id;
  const existing = facts.find((fact) => fact.text.includes(text));
  if (existing) return existing.id;
  const nextId = id;
  facts.push({id: nextId, text, source: source || '原课件'});
  return nextId;
}

function convertLessonPage(page, facts, index) {
  const layout = textOf(page.layout);
  const narration = pageNarration(page);
  if (layout === 'steps') {
    const items = (Array.isArray(page.items) ? page.items : []).map((item) => {
      const raw = typeof item === 'string' ? item : textOf(item?.title || item?.text);
      return {text: raw, ...(whenOf(raw, narration) ? {when: raw} : {})};
    });
    return {
      role: 'points',
      layout: 'sequence',
      ...(narration ? {narration} : {}),
      ...(textOf(page.title) ? {title: textOf(page.title)} : {}),
      items,
    };
  }
  if (layout === 'points') {
    const items = (Array.isArray(page.items) ? page.items : []).map((item) => ({
      text: textOf(item.title || item.text),
      ...(textOf(item.text) && item.title ? {note: textOf(item.text)} : {}),
      ...(sceneIcon(item.icon) ? {icon: sceneIcon(item.icon)} : {}),
      ...(whenOf(item.title || item.text, narration) ? {when: textOf(item.title || item.text)} : {}),
    }));
    return {
      role: 'points',
      layout: 'grid',
      ...(narration ? {narration} : {}),
      ...(textOf(page.title) ? {title: textOf(page.title)} : {}),
      items,
    };
  }
  if (layout === 'compare') {
    const leftItems = Array.isArray(page.left) ? page.left.map((item) => textOf(item)) : [];
    const rightItems = Array.isArray(page.right) ? page.right.map((item) => textOf(item)) : [];
    const winner = page.rightTone === 'ok' ? 'right' : page.leftTone === 'ok' ? 'left' : 'none';
    return {
      role: 'compare',
      layout: 'split',
      ...(narration ? {narration} : {}),
      ...(textOf(page.title) ? {title: textOf(page.title)} : {}),
      left: {label: textOf(page.leftTitle), items: leftItems},
      right: {label: textOf(page.rightTitle), items: rightItems},
      winner,
    };
  }
  if (layout === 'bignumber') {
    const number = textOf(page.number);
    const unit = textOf(page.unit);
    const glued = unit ? `${number}${unit}` : number;
    const spaced = unit ? `${number} ${unit}` : number;
    const text = NUMBER_TEXT.test(glued) ? glued : NUMBER_TEXT.test(spaced) ? spaced : glued;
    const source = textOf(page.basis) || textOf(page.name);
    const factId = ensureFact(facts, `legacy-${index + 1}`, text, source);
    return {
      role: 'number',
      layout: 'hero',
      ...(narration ? {narration} : {}),
      number: {
        text,
        fact: factId,
        label: textOf(page.name) || textOf(page.title),
      },
      showComputedDelta: false,
    };
  }
  return null;
}

function lessonPages(raw) {
  if (Array.isArray(raw.pages)) return raw.pages.map((page, index) => ({page, index, where: `pages[${index}]`}));
  const out = [];
  (raw.chapters || []).forEach((chapter, chapterIndex) => {
    (chapter.pages || []).forEach((page, pageIndex) => {
      out.push({page, index: out.length, where: `chapters[${chapterIndex}].pages[${pageIndex}]`});
    });
  });
  return out;
}

function unsupportedLine(where, type, why) {
  return `${where} ${type}：${why}`;
}

export function geometryAudit(scene) {
  const token = loadStyle(scene.product, scene.style);
  if (!token) return {ok: false, lines: [`风格读不到：${scene.style}`]};
  const frame = sceneFrame(scene.product, scene.aspect);
  let plan;
  try {
    plan = prepareScene({scene, roles: token.roles, extra: token.extra, frame});
  } catch (error) {
    return {ok: false, lines: [`几何准备失败：${error?.message || String(error)}`]};
  }
  const lines = auditPlan(plan).filter((item) => !String(item).startsWith('成片') && !String(item).includes('画幅'));
  (plan.screens || []).forEach((screen, index) => {
    if (screen.overflow) lines.push(`第 ${index + 1} 屏 ${screen.layout} 几何溢出`);
  });
  return {ok: lines.length === 0, lines, plan};
}

export function convertLegacy(raw, options = {}) {
  const skip = Boolean(options.skipUnsupported);
  const kind = kindOf(raw);
  if (!kind) {
    return {ok: false, errors: ['不是宣传片分镜（shots）也不是讲课课件（pages/chapters）'], unsupported: []};
  }
  const unsupported = [];
  const screens = [];
  const notes = [];
  let product = kind;
  let style = 'fresh-light';
  let facts = [];
  let aspect = '9:16';
  let domain;

  if (kind === 'promo') {
    const meta = isObject(raw.meta) ? raw.meta : {};
    style = textOf(meta.theme) || 'fresh-light';
    facts = cloneFacts(meta.facts);
    aspect = textOf(meta.aspect) === '16:9' ? '16:9' : '9:16';
    (raw.shots || []).forEach((shot, index) => {
      const type = textOf(shot?.type) || '（空）';
      const where = `shots[${index}]`;
      const gate = convertibleOf('promo', shot, null);
      if (!gate.ok) {
        unsupported.push(unsupportedLine(where, type, gate.why));
        return;
      }
      const screen = convertPromoShot(shot, facts);
      if (!screen) {
        unsupported.push(unsupportedLine(where, type, '转换器没有写出这一屏'));
        return;
      }
      screens.push(screen);
      if (gate.row?.delta) notes.push(`${where} ${type}：${gate.row.delta}`);
    });
  } else {
    const meta = isObject(raw.meta) ? raw.meta : {};
    product = 'lesson';
    style = ['paper', 'lecture', 'product', 'editorial'].includes(meta.theme) ? meta.theme : 'lecture';
    facts = cloneFacts(meta.facts);
    aspect = '16:9';
    domain = textOf(meta.domain) || undefined;
    lessonPages(raw).forEach(({page, index, where}) => {
      const type = textOf(page?.layout) || '（空）';
      const gate = convertibleOf('lesson', null, page);
      if (!gate.ok) {
        unsupported.push(unsupportedLine(where, type, gate.why));
        return;
      }
      const screen = convertLessonPage(page, facts, index);
      if (!screen) {
        unsupported.push(unsupportedLine(where, type, '转换器没有写出这一屏'));
        return;
      }
      screens.push(screen);
      if (gate.row?.delta) notes.push(`${where} ${type}：${gate.row.delta}`);
    });
  }

  if (unsupported.length && !skip) {
    return {
      ok: false,
      kind,
      errors: ['有不能转换的镜头。加 --skip-unsupported 可跳过。', ...unsupported],
      unsupported,
      screens,
    };
  }
  if (!screens.length) {
    return {ok: false, kind, errors: ['没有能转换的镜头', ...unsupported], unsupported, screens};
  }

  const motion = defaultMotion(product, style);
  const scene = {
    product,
    aspect,
    style,
    motion,
    ...(domain ? {domain} : {}),
    ...(facts.length ? {facts} : {}),
    screens,
  };
  const checked = validateScene(scene);
  if (!checked.ok) {
    return {
      ok: false,
      kind,
      scene: checked.scene,
      errors: checked.errors.map((item) => `${item.where}：${item.problem}`),
      unsupported,
      notes,
      report: formatReport(checked),
    };
  }
  const geo = geometryAudit(checked.scene);
  if (!geo.ok) {
    return {
      ok: false,
      kind,
      scene: checked.scene,
      errors: ['几何审计没过', ...geo.lines],
      unsupported,
      notes,
    };
  }
  return {ok: true, kind, scene: checked.scene, unsupported, notes, skipped: skip ? unsupported : []};
}

function argsOf(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = 'true';
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return {positional, flags};
}

function main(argv) {
  const {positional, flags} = argsOf(argv);
  const input = positional[0];
  const out = flags.out;
  if (!input || !out) {
    console.error(USAGE);
    process.exit(2);
  }
  const absIn = path.resolve(input);
  if (!fs.existsSync(absIn)) {
    console.error(`找不到文件：${input}`);
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(absIn, 'utf8'));
  const result = convertLegacy(raw, {skipUnsupported: flags['skip-unsupported'] === 'true'});
  if (!result.ok) {
    for (const line of result.errors || []) console.error(line);
    process.exit(1);
  }
  const absOut = path.resolve(out);
  fs.mkdirSync(path.dirname(absOut), {recursive: true});
  fs.writeFileSync(absOut, `${JSON.stringify(result.scene, null, 2)}\n`, 'utf8');
  const skipped = result.skipped?.length || 0;
  console.log(`已写出 ${absOut}（${result.scene.screens.length} 屏${skipped ? `，跳过 ${skipped} 个旧镜头` : ''}）`);
  if (skipped) {
    for (const line of result.skipped) console.log(`跳过 ${line}`);
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main(process.argv.slice(2));
