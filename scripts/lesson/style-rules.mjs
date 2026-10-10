import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJsonResource} from './read-json.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tokens = readJsonResource(path.resolve(HERE, '../../template/src/lesson/style-tokens.json'));
const SPEC_DIR = path.resolve(HERE, '../../template/src/lesson/layouts');
const LAYOUT_ORDER = ['cover','chapter','steps','quote','compare','question','flow','recap','screenshot','code','points','statement','timeline','checklist','bignumber','saying','levels','case','document','table'];
const layoutSpecs = Object.fromEntries(LAYOUT_ORDER.map((name) => [name, readJsonResource(path.join(SPEC_DIR, `${name}.spec.json`))]));
export const STYLE_IDS = ['paper', 'lecture', 'product', 'editorial'];
/** 生成器写进 lesson.json 的标记。校验靠它区分新稿和旧稿，不靠字段外形猜测。 */
export const LESSON_GENERATED_BY = 'generate-lesson';
const LEGACY = new Set(['light', 'dark']);
const chars = (value) => Array.from(String(value ?? '')).length;
const itemText = (item) => item && typeof item === 'object' && !Array.isArray(item) ? String(item.title ?? '') : String(item ?? '');
const itemChars = (item) => chars(itemText(item));
const pagesOf = (lesson) => (lesson?.chapters ?? []).flatMap((chapter, ci) => (chapter?.pages ?? []).map((page, pi) => ({page, at: `chapters[${ci}].pages[${pi}]`})));

function channel(hex, index) {
  const n = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}
export function contrastRatio(a, b) {
  const lum = (hex) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastFailures(id = null) {
  const ids = id ? [id] : STYLE_IDS;
  const failures = [];
  for (const name of ids) {
    const t = tokens[name];
    if (!t) { failures.push(`${name}：没有这套风格`); continue; }
    const pairs = [
      ['ink/bg', t.ink, t.bg],
      ['ink/surface', t.ink, t.surface],
      ['muted/bg', t.muted, t.bg],
      ['muted/surface', t.muted, t.surface],
      ['subtitle/bg', t.subtitleInk, t.bg],
      ['accent/bg', t.accent, t.bg],
      ['accent/surface', t.accent, t.surface],
      ['白字/accent', '#FFFFFF', t.accent],
      ['白字/accent2', '#FFFFFF', t.accent2],
      ['白字/warn', '#FFFFFF', t.warn],
      ['卡片字/warn', t.surface, t.warn],
      ['codeFg/codeBg', t.codeFg, t.codeBg],
    ];
    for (const [label, fg, bg] of pairs) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.5) failures.push(`${name} ${label} ${ratio.toFixed(2)}:1，低于 4.5:1。请改 style-tokens.json 里的颜色，不要在版式里写死`);
    }
  }
  return failures;
}

function mixHex(from, to, t) {
  const ch = (hex, index) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const v = (index) => Math.max(0, Math.min(255, Math.round(ch(from, index) * (1 - t) + ch(to, index) * t)));
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(v(0))}${h(v(1))}${h(v(2))}`.toUpperCase();
}

/** 品牌主色替换主题 accent 之后，只复查原来会用到 accent 的三对。辅色替换 deco，现有检查本来就不含 deco。 */
export function accentContrastFailures(themeId, accent) {
  const t = tokens[themeId];
  if (!t) return [`${themeId}：没有这套风格`];
  if (typeof accent !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(accent)) return ['主色必须是 #RRGGBB'];
  const pairs = [
    ['主色/背景', accent, t.bg],
    ['主色/卡片', accent, t.surface],
    ['白字/主色', '#FFFFFF', accent],
  ];
  const failures = [];
  for (const [label, fg, bg] of pairs) {
    const ratio = contrastRatio(fg, bg);
    if (ratio < 4.5) failures.push(`${label} ${ratio.toFixed(2)}:1，低于 4.5:1`);
  }
  return failures;
}

export function suggestPassingAccent(themeId, accent) {
  const start = /^#[0-9A-Fa-f]{6}$/.test(accent || '') ? accent.toUpperCase() : '#808080';
  for (const toward of ['#000000', '#FFFFFF']) {
    for (let i = 1; i <= 20; i += 1) {
      const hex = mixHex(start, toward, i / 20);
      if (!accentContrastFailures(themeId, hex).length) return hex;
    }
  }
  return '';
}

export function brandContrastError(themeId, accent) {
  const failures = accentContrastFailures(themeId, accent);
  if (!failures.length) return '';
  const suggestion = suggestPassingAccent(themeId, accent);
  const hint = suggestion ? `建议改成 ${suggestion}。` : '请换一个更深或更浅的主色。';
  return `品牌主色 ${accent} 对比度未过 4.5:1：\n${failures.map((line) => `  ✗ ${line}`).join('\n')}\n${hint}主色不会被自动替换。`;
}

export function resolveLessonTheme(lesson) {
  const domain = lesson?.meta?.domain;
  const raw = lesson?.meta?.theme;
  if (raw === 'editorial' && domain === 'legal') {
    return {error: '杂志风格不对法律领域开放。请改成 paper（卷宗）或 lecture（讲台）；杂志只能手动选，而且不能用于 legal'};
  }
  if (typeof raw === 'string' && raw && !LEGACY.has(raw) && !STYLE_IDS.includes(raw)) {
    return {error: `不认识的风格「${raw}」。请改成 paper、lecture、product 或 editorial；不写则自动选`};
  }
  if (typeof raw === 'string' && STYLE_IDS.includes(raw)) return {theme: raw};
  const pages = (lesson?.chapters ?? []).flatMap((chapter) => chapter?.pages ?? []);
  const heavy = pages.filter((page) => page?.layout === 'screenshot' || page?.layout === 'code').length;
  let theme = 'lecture';
  if (domain === 'legal') theme = 'paper';
  else if (pages.length && heavy / pages.length >= 0.3) theme = 'product';
  const warning = LEGACY.has(raw) ? `meta.theme=${raw} 已取消，不再使用单独的深色底。已按领域和版式自动选为 ${theme}` : undefined;
  return {theme, warning};
}

function issue(at, message) {
  return `${at}：${message}`;
}

function copyOf(layout) {
  return layoutSpecs[layout]?.copy ?? null;
}

function describeCopy(name, copy) {
  if (!copy) return '';
  if (name === 'cover') return `标题最多 ${copy.titleMax} 字；副题最多 ${copy.subtitleMax} 字`;
  if (name === 'chapter') return `章名最多 ${copy.titleMax} 字；章说明最多 ${copy.subtitleMax} 字；要点每条最多 ${copy.pointMax} 字`;
  if (name === 'steps' || name === 'recap') return `最多 ${copy.maxItems} 条；每条最多 ${copy.itemMax} 字；本页合计最多 ${copy.totalMax} 字`;
  if (name === 'quote') return `引用原文最多 ${copy.quoteMax} 字；出处最多 ${copy.sourceMax} 字`;
  if (name === 'question') return `题干最多 ${copy.questionMax} 字；选项最多 ${copy.maxOptions} 个；每个选项最多 ${copy.optionMax} 字`;
  if (name === 'flow') return `节点 ${copy.minItems} 到 ${copy.maxItems} 个；每个节点最多 ${copy.itemMax} 字；小点最多 ${copy.maxPoints} 条，每条最多 ${copy.pointMax} 字`;
  if (name === 'screenshot') return `标注最多 ${copy.labelMax} 字`;
  if (name === 'code') return `代码最多 ${copy.maxLines} 行`;
  if (name === 'points') return `最多 ${copy.maxItems} 张；标题最多 ${copy.titleMax} 字；说明最多 ${copy.textMax} 字`;
  if (name === 'statement') return `大字每行最多 ${copy.lineMax} 字；依据最多 ${copy.basisMax} 字；道具每行最多 ${copy.propLineMax} 字；批注最多 ${copy.noteMax} 字`;
  if (name === 'timeline') return `节点名最多 ${copy.nodeMax} 字；区段最多 ${copy.segmentMax} 字；说明最多 ${copy.captionMax} 字；法条原文最多 ${copy.quoteMax} 字；出处最多 ${copy.sourceMax} 字`;
  if (name === 'checklist') return `${copy.minItems} 到 ${copy.maxItems} 项；每项最多 ${copy.itemMax} 字`;
  if (name === 'bignumber') return `数字最多 ${copy.numberMax} 个字符；单位最多 ${copy.unitMax} 字；名称最多 ${copy.nameMax} 字；依据最多 ${copy.basisMax} 字；说明卡最多 ${copy.cardMax} 字`;
  if (name === 'saying') return `观点每行最多 ${copy.lineMax} 字，合计最多 ${copy.totalMax} 字；姓名最多 ${copy.nameMax} 字；机构最多 ${copy.orgMax} 字`;
  if (name === 'levels') return `${copy.minItems} 到 ${copy.maxItems} 档；标签最多 ${copy.labelMax} 字；关键词最多 ${copy.textMax} 字`;
  if (name === 'case') return `姓名最多 ${copy.nameMax} 字；身份最多 ${copy.roleMax} 字；每句最多 ${copy.lineMax} 字；结论最多 ${copy.verdictMax} 字`;
  if (name === 'document') return `行名最多 ${copy.rowNameMax} 字；行值最多 ${copy.rowValueMax} 字；关键句最多 ${copy.pointMax} 字`;
  if (name === 'table') return `${copy.minRows} 到 ${copy.maxRows} 行；情形最多 ${copy.situationMax} 字；结果最多 ${copy.resultMax} 字；依据最多 ${copy.basisMax} 字`;
  return '';
}

/** 给模型的稿件契约表。数字只从版式 spec 的 copy 读出。 */
export function copyContractTable() {
  const lines = ['| 版式 | 稿件契约 |', '| --- | --- |'];
  for (const name of LAYOUT_ORDER) {
    const text = describeCopy(name, copyOf(name));
    if (text) lines.push(`| ${name} | ${text} |`);
  }
  return lines.join('\n');
}

/** 四套共用的稿件字数上限。默认给旧稿当警告；新稿（meta.generatedBy）或 strict 时当错误。 */
export function copyLimitIssues(lesson) {
  const issues = [];
  for (const {page, at} of pagesOf(lesson)) {
    if (!page || typeof page !== 'object') continue;
    const copy = copyOf(page.layout);
    if (!copy) continue;
    if (page.layout === 'cover') {
      if (chars(page.title) > copy.titleMax) issues.push(issue(`${at}.title`, `封面标题现在 ${chars(page.title)} 字，超过 ${copy.titleMax} 字。请收成不超过 ${copy.titleMax} 字，引擎会自动断成两行`));
      if (page.subtitle && chars(page.subtitle) > copy.subtitleMax) issues.push(issue(`${at}.subtitle`, `封面副题现在 ${chars(page.subtitle)} 字，超过 ${copy.subtitleMax} 字。请收成不超过 ${copy.subtitleMax} 字`));
    }
    if (page.layout === 'chapter') {
      if (chars(page.title) > copy.titleMax) issues.push(issue(`${at}.title`, `章名现在 ${chars(page.title)} 字，超过 ${copy.titleMax} 字。请改成不超过 ${copy.titleMax} 字，优先用案情、法条、怎么判、怎么做、律师提示这类短词`));
      if (page.subtitle && chars(page.subtitle) > copy.subtitleMax) issues.push(issue(`${at}.subtitle`, `章说明现在 ${chars(page.subtitle)} 字，超过 ${copy.subtitleMax} 字。请收成一行，不超过 ${copy.subtitleMax} 字`));
    }
    if (page.layout === 'steps' || page.layout === 'recap') {
      const items = Array.isArray(page.items) ? page.items : [];
      if (items.length > copy.maxItems) issues.push(issue(`${at}.items`, `现在 ${items.length} 条，超过 ${copy.maxItems} 条。请拆成两页，继续用 ${page.layout} 版式`));
      items.forEach((item, i) => { if (chars(item) > copy.itemMax) issues.push(issue(`${at}.items[${i}]`, `这一条 ${chars(item)} 字，超过 ${copy.itemMax} 字。请收成不超过 ${copy.itemMax} 字`)); });
      const total = items.reduce((n, item) => n + chars(item), 0);
      if (total > copy.totalMax) issues.push(issue(`${at}.items`, `这页要点合计 ${total} 字，超过 ${copy.totalMax} 字。请删字，或拆成两页`));
    }
    if (page.layout === 'quote') {
      if (chars(page.quote) > copy.quoteMax) issues.push(issue(`${at}.quote`, `引用原文现在 ${chars(page.quote)} 字，超过 ${copy.quoteMax} 字。请按意群拆成两页，每页仍用 quote`));
      if (chars(page.source) > copy.sourceMax) issues.push(issue(`${at}.source`, `出处现在 ${chars(page.source)} 字，超过 ${copy.sourceMax} 字。请只留法律全称和条号`));
    }
    if (page.layout === 'question') {
      if (chars(page.question) > copy.questionMax) issues.push(issue(`${at}.question`, `题干现在 ${chars(page.question)} 字，超过 ${copy.questionMax} 字。请收成不超过 ${copy.questionMax} 字`));
      const options = Array.isArray(page.options) ? page.options : [];
      if (options.length > copy.maxOptions) issues.push(issue(`${at}.options`, `现在 ${options.length} 个选项，超过 ${copy.maxOptions} 个。请删到 ${copy.maxOptions} 个以内`));
      options.forEach((item, i) => { if (chars(item) > copy.optionMax) issues.push(issue(`${at}.options[${i}]`, `这个选项 ${chars(item)} 字，超过 ${copy.optionMax} 字。请收成不超过 ${copy.optionMax} 字`)); });
    }
    if (page.layout === 'flow') {
      const steps = Array.isArray(page.steps) ? page.steps : [];
      if (steps.length < copy.minItems || steps.length > copy.maxItems) issues.push(issue(`${at}.steps`, `流程节点现在 ${steps.length} 个，需要 ${copy.minItems} 到 ${copy.maxItems} 个。请合并或拆页`));
      steps.forEach((item, i) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          if (chars(item.title) > copy.itemMax) issues.push(issue(`${at}.steps[${i}].title`, `这个节点 ${chars(item.title)} 字，超过 ${copy.itemMax} 字。请收成不超过 ${copy.itemMax} 字`));
          const points = Array.isArray(item.points) ? item.points : [];
          if (points.length > copy.maxPoints) issues.push(issue(`${at}.steps[${i}].points`, `小点现在 ${points.length} 条，最多 ${copy.maxPoints} 条`));
          points.forEach((point, pi) => { if (chars(point) > copy.pointMax) issues.push(issue(`${at}.steps[${i}].points[${pi}]`, `这条小点 ${chars(point)} 字，超过 ${copy.pointMax} 字`)); });
        } else if (chars(item) > copy.itemMax) issues.push(issue(`${at}.steps[${i}]`, `这个节点 ${chars(item)} 字，超过 ${copy.itemMax} 字。请收成不超过 ${copy.itemMax} 字`));
      });
    }
    if (page.layout === 'points') {
      const items = Array.isArray(page.items) ? page.items : [];
      if (items.length > copy.maxItems) issues.push(issue(`${at}.items`, `现在 ${items.length} 张，超过 ${copy.maxItems} 张。请拆页`));
      items.forEach((item, i) => {
        if (!item || typeof item !== 'object') return;
        if (chars(item.title) > copy.titleMax) issues.push(issue(`${at}.items[${i}].title`, `标题 ${chars(item.title)} 字，超过 ${copy.titleMax} 字`));
        if (chars(item.text) > copy.textMax) issues.push(issue(`${at}.items[${i}].text`, `说明 ${chars(item.text)} 字，超过 ${copy.textMax} 字`));
      });
    }
    if (page.layout === 'statement') {
      (Array.isArray(page.lines) ? page.lines : []).forEach((line, i) => { if (chars(line) > copy.lineMax) issues.push(issue(`${at}.lines[${i}]`, `这一行 ${chars(line)} 字，超过 ${copy.lineMax} 字`)); });
      if (chars(page.basis) > copy.basisMax) issues.push(issue(`${at}.basis`, `依据现在 ${chars(page.basis)} 字，超过 ${copy.basisMax} 字`));
      (Array.isArray(page.propLines) ? page.propLines : []).forEach((line, i) => { if (chars(line) > copy.propLineMax) issues.push(issue(`${at}.propLines[${i}]`, `这一行 ${chars(line)} 字，超过 ${copy.propLineMax} 字`)); });
      if (chars(page.annotation) > copy.noteMax) issues.push(issue(`${at}.annotation`, `批注现在 ${chars(page.annotation)} 字，超过 ${copy.noteMax} 字`));
    }
    if (page.layout === 'timeline') {
      (Array.isArray(page.nodes) ? page.nodes : []).forEach((node, i) => { if (chars(node?.label) > copy.nodeMax) issues.push(issue(`${at}.nodes[${i}].label`, `节点名 ${chars(node?.label)} 字，超过 ${copy.nodeMax} 字`)); });
      (Array.isArray(page.segments) ? page.segments : []).forEach((seg, i) => { if (chars(seg?.label) > copy.segmentMax) issues.push(issue(`${at}.segments[${i}].label`, `区段 ${chars(seg?.label)} 字，超过 ${copy.segmentMax} 字`)); });
      (Array.isArray(page.captions) ? page.captions : []).forEach((cap, i) => { if (chars(cap?.text) > copy.captionMax) issues.push(issue(`${at}.captions[${i}].text`, `说明 ${chars(cap?.text)} 字，超过 ${copy.captionMax} 字`)); });
      if (page.quote && chars(page.quote) > copy.quoteMax) issues.push(issue(`${at}.quote`, `法条原文现在 ${chars(page.quote)} 字，超过 ${copy.quoteMax} 字`));
      if (page.source && chars(page.source) > copy.sourceMax) issues.push(issue(`${at}.source`, `出处现在 ${chars(page.source)} 字，超过 ${copy.sourceMax} 字`));
    }
    if (page.layout === 'checklist') {
      const items = Array.isArray(page.items) ? page.items : [];
      if (items.length < copy.minItems || items.length > copy.maxItems) issues.push(issue(`${at}.items`, `现在 ${items.length} 项，需要 ${copy.minItems} 到 ${copy.maxItems} 项`));
      items.forEach((item, i) => { if (chars(item) > copy.itemMax) issues.push(issue(`${at}.items[${i}]`, `这一项 ${chars(item)} 字，超过 ${copy.itemMax} 字`)); });
    }
    if (page.layout === 'chapter' && Array.isArray(page.points)) {
      page.points.forEach((point, i) => { if (chars(point?.text) > copy.pointMax) issues.push(issue(`${at}.points[${i}].text`, `这一条 ${chars(point?.text)} 字，超过 ${copy.pointMax} 字`)); });
    }
    if (page.layout === 'bignumber') {
      if (chars(page.number) > copy.numberMax) issues.push(issue(`${at}.number`, `数字 ${chars(page.number)} 个字符，超过 ${copy.numberMax} 个`));
      if (chars(page.unit) > copy.unitMax) issues.push(issue(`${at}.unit`, `单位 ${chars(page.unit)} 字，超过 ${copy.unitMax} 字`));
      if (chars(page.name) > copy.nameMax) issues.push(issue(`${at}.name`, `名称 ${chars(page.name)} 字，超过 ${copy.nameMax} 字`));
      if (chars(page.basis) > copy.basisMax) issues.push(issue(`${at}.basis`, `依据 ${chars(page.basis)} 字，超过 ${copy.basisMax} 字`));
      if (chars(page.cardText) > copy.cardMax) issues.push(issue(`${at}.cardText`, `说明卡 ${chars(page.cardText)} 字，超过 ${copy.cardMax} 字`));
    }
    if (page.layout === 'saying') {
      const lines = Array.isArray(page.lines) ? page.lines : [];
      lines.forEach((line, i) => { if (chars(line) > copy.lineMax) issues.push(issue(`${at}.lines[${i}]`, `这一行 ${chars(line)} 字，超过 ${copy.lineMax} 字`)); });
      const total = lines.reduce((n, line) => n + chars(line), 0);
      if (total > copy.totalMax) issues.push(issue(`${at}.lines`, `观点合计 ${total} 字，超过 ${copy.totalMax} 字`));
      if (chars(page.name) > copy.nameMax) issues.push(issue(`${at}.name`, `姓名 ${chars(page.name)} 字，超过 ${copy.nameMax} 字`));
      if (chars(page.org) > copy.orgMax) issues.push(issue(`${at}.org`, `机构 ${chars(page.org)} 字，超过 ${copy.orgMax} 字`));
    }
    if (page.layout === 'levels') {
      const items = Array.isArray(page.items) ? page.items : [];
      if (items.length < copy.minItems || items.length > copy.maxItems) issues.push(issue(`${at}.items`, `现在 ${items.length} 档，需要 ${copy.minItems} 到 ${copy.maxItems} 档`));
      items.forEach((item, i) => {
        if (chars(item?.label) > copy.labelMax) issues.push(issue(`${at}.items[${i}].label`, `标签 ${chars(item?.label)} 字，超过 ${copy.labelMax} 字`));
        if (chars(item?.text) > copy.textMax) issues.push(issue(`${at}.items[${i}].text`, `关键词 ${chars(item?.text)} 字，超过 ${copy.textMax} 字`));
      });
    }
    if (page.layout === 'case') {
      (Array.isArray(page.roles) ? page.roles : []).forEach((role, i) => {
        if (chars(role?.name) > copy.nameMax) issues.push(issue(`${at}.roles[${i}].name`, `姓名 ${chars(role?.name)} 字，超过 ${copy.nameMax} 字`));
        if (chars(role?.role) > copy.roleMax) issues.push(issue(`${at}.roles[${i}].role`, `身份 ${chars(role?.role)} 字，超过 ${copy.roleMax} 字`));
      });
      (Array.isArray(page.lines) ? page.lines : []).forEach((line, i) => { if (chars(line?.text) > copy.lineMax) issues.push(issue(`${at}.lines[${i}].text`, `这一句 ${chars(line?.text)} 字，超过 ${copy.lineMax} 字`)); });
      if (chars(page.verdictText) > copy.verdictMax) issues.push(issue(`${at}.verdictText`, `结论 ${chars(page.verdictText)} 字，超过 ${copy.verdictMax} 字`));
    }
    if (page.layout === 'document') {
      (Array.isArray(page.rows) ? page.rows : []).forEach((row, i) => {
        if (chars(row?.name) > copy.rowNameMax) issues.push(issue(`${at}.rows[${i}].name`, `行名 ${chars(row?.name)} 字，超过 ${copy.rowNameMax} 字`));
        if (chars(row?.value) > copy.rowValueMax) issues.push(issue(`${at}.rows[${i}].value`, `行值 ${chars(row?.value)} 字，超过 ${copy.rowValueMax} 字`));
      });
      if (chars(page.point) > copy.pointMax) issues.push(issue(`${at}.point`, `关键句 ${chars(page.point)} 字，超过 ${copy.pointMax} 字`));
    }
    if (page.layout === 'table') {
      const rows = Array.isArray(page.rows) ? page.rows : [];
      if (rows.length < copy.minRows || rows.length > copy.maxRows) issues.push(issue(`${at}.rows`, `现在 ${rows.length} 行，需要 ${copy.minRows} 到 ${copy.maxRows} 行`));
      rows.forEach((row, i) => {
        if (chars(row?.situation) > copy.situationMax) issues.push(issue(`${at}.rows[${i}].situation`, `情形 ${chars(row?.situation)} 字，超过 ${copy.situationMax} 字`));
        if (chars(row?.result) > copy.resultMax) issues.push(issue(`${at}.rows[${i}].result`, `结果 ${chars(row?.result)} 字，超过 ${copy.resultMax} 字`));
      });
      if (chars(page.basis) > copy.basisMax) issues.push(issue(`${at}.basis`, `依据 ${chars(page.basis)} 字，超过 ${copy.basisMax} 字`));
    }
    if (page.layout === 'screenshot' && Array.isArray(page.callouts)) {
      page.callouts.forEach((box, i) => { if (box?.label && chars(box.label) > copy.labelMax) issues.push(issue(`${at}.callouts[${i}].label`, `标注现在 ${chars(box.label)} 字，超过 ${copy.labelMax} 字。请收成不超过 ${copy.labelMax} 字`)); });
    }
    if (page.layout === 'code' && typeof page.code === 'string') {
      const lines = page.code.split(/\r?\n/).length;
      if (lines > copy.maxLines) issues.push(issue(`${at}.code`, `代码现在 ${lines} 行，超过 ${copy.maxLines} 行。请删到 ${copy.maxLines} 行以内，或拆成两页`));
    }
  }
  return issues;
}

function fieldMin(layout, field) {
  const rule = layoutSpecs[layout]?.fields?.[field];
  return Number.isInteger(rule?.min) ? rule.min : 1;
}

function listFits(items, minItems, maxItems, itemMax, totalMax) {
  if (items.length < minItems || items.length > maxItems) return false;
  if (items.some((item) => itemChars(item) > itemMax)) return false;
  return items.reduce((n, item) => n + itemChars(item), 0) <= totalMax;
}

function splitNarration(narration, cut, total) {
  const lines = Array.isArray(narration) ? narration.map((line) => ({...line})) : [];
  if (lines.length < 2) return null;
  let left = [];
  let right = [];
  for (const line of lines) {
    const reveal = Number.isInteger(line.reveal) ? line.reveal : 0;
    if (reveal < cut) left.push(line);
    else right.push({...line, reveal: reveal - cut});
  }
  if (!left.length || !right.length) {
    const take = Math.min(lines.length - 1, Math.max(1, Math.round(lines.length * cut / total)));
    left = lines.slice(0, take).map((line) => ({...line, reveal: Math.min(Number.isInteger(line.reveal) ? line.reveal : 0, Math.max(0, cut - 1))}));
    right = lines.slice(take).map((line) => {
      const reveal = Number.isInteger(line.reveal) ? line.reveal : 0;
      return {...line, reveal: Math.max(0, reveal - cut)};
    });
  }
  const clamp = (list, count) => list.map((line) => ({...line, reveal: Math.max(0, Math.min(line.reveal ?? 0, Math.max(0, count - 1)))}));
  return [clamp(left, cut), clamp(right, total - cut)];
}

function splitNarrationHalf(narration) {
  const lines = Array.isArray(narration) ? narration.map((line) => ({...line})) : [];
  if (lines.length < 2) return null;
  const mid = Math.ceil(lines.length / 2);
  if (mid <= 0 || mid >= lines.length) return null;
  return [lines.slice(0, mid), lines.slice(mid)];
}

function splitItems(page, field, minItems, maxItems, itemMax, totalMax) {
  const items = Array.isArray(page[field]) ? page[field] : null;
  if (!items || items.length < minItems * 2) return null;
  if (items.some((item) => itemChars(item) > itemMax)) return null;
  let cut = null;
  for (let k = minItems; k <= items.length - minItems; k += 1) {
    if (listFits(items.slice(0, k), minItems, maxItems, itemMax, totalMax) && listFits(items.slice(k), minItems, maxItems, itemMax, totalMax)) {
      cut = k;
      break;
    }
  }
  if (cut == null) {
    cut = Math.max(minItems, Math.min(items.length - minItems, Math.ceil(items.length / 2)));
    if (cut < minItems || items.length - cut < minItems) return null;
    const joined = (list) => chars(list.map(itemText).join(''));
    if (joined(items.slice(0, cut)) >= joined(items) || joined(items.slice(cut)) >= joined(items)) return null;
  }
  const narration = splitNarration(page.narration, cut, items.length);
  if (!narration) return null;
  return [
    {...page, [field]: items.slice(0, cut), narration: narration[0]},
    {...page, [field]: items.slice(cut), narration: narration[1]},
  ];
}

function splitText(text, max) {
  const chunks = [];
  let buf = '';
  for (const ch of Array.from(text)) {
    buf += ch;
    if (/[。！？；\n]/u.test(ch)) { chunks.push(buf); buf = ''; }
  }
  if (buf) chunks.push(buf);
  if (!chunks.length || chunks.some((chunk) => chars(chunk) > max)) return null;
  for (let i = 1; i < chunks.length; i += 1) {
    const left = chunks.slice(0, i).join('');
    const right = chunks.slice(i).join('');
    if (left && right && chars(left) <= max && chars(right) <= max) return [left, right];
  }
  let taken = '';
  let index = 0;
  while (index < chunks.length - 1 && chars(taken + chunks[index]) <= max) {
    taken += chunks[index];
    index += 1;
  }
  const rest = chunks.slice(index).join('');
  if (!taken || !rest || chars(taken) > max) return null;
  return [taken, rest];
}

function splitQuotePage(page, quoteMax, sourceMax) {
  if (chars(page.source) > sourceMax) return null;
  if (typeof page.quote !== 'string' || chars(page.quote) <= quoteMax) return null;
  const parts = splitText(page.quote, quoteMax);
  if (!parts) return null;
  const narration = splitNarrationHalf(page.narration);
  if (!narration) return null;
  const side = (text, lines) => {
    const next = {...page, quote: text, narration: lines};
    if (next.emphasis && !text.includes(next.emphasis)) delete next.emphasis;
    return next;
  };
  return [side(parts[0], narration[0]), side(parts[1], narration[1])];
}

function splitCodePage(page, maxLines) {
  const lines = typeof page.code === 'string' ? page.code.split(/\r?\n/) : [];
  if (lines.length <= maxLines) return null;
  const cut = Math.min(maxLines, Math.max(1, Math.ceil(lines.length / 2)));
  if (cut <= 0 || cut >= lines.length) return null;
  const narration = splitNarration(page.narration, cut, lines.length) ?? splitNarrationHalf(page.narration);
  if (!narration) return null;
  const remap = (highlights, start, end) => {
    if (!Array.isArray(highlights)) return undefined;
    const next = highlights.filter((n) => n > start && n <= end).map((n) => n - start);
    return next.length ? next : undefined;
  };
  const left = {...page, code: lines.slice(0, cut).join('\n'), narration: narration[0]};
  const right = {...page, code: lines.slice(cut).join('\n'), narration: narration[1]};
  const leftMarks = remap(page.highlightLines, 0, cut);
  const rightMarks = remap(page.highlightLines, cut, lines.length);
  if (leftMarks) left.highlightLines = leftMarks; else delete left.highlightLines;
  if (rightMarks) right.highlightLines = rightMarks; else delete right.highlightLines;
  return [left, right];
}

function splitOnce(page) {
  const copy = copyOf(page?.layout);
  if (!copy || !page) return null;
  if (page.layout === 'steps' || page.layout === 'recap') return splitItems(page, 'items', fieldMin(page.layout, 'items'), copy.maxItems, copy.itemMax, copy.totalMax);
  if (page.layout === 'flow') return splitItems(page, 'steps', copy.minItems, copy.maxItems, copy.itemMax, Number.POSITIVE_INFINITY);
  if (page.layout === 'quote') return splitQuotePage(page, copy.quoteMax, copy.sourceMax);
  if (page.layout === 'code') return splitCodePage(page, copy.maxLines);
  return null;
}

function issuesOf(page) {
  return copyLimitIssues({chapters: [{pages: [page]}]});
}

function expandPage(page, depth) {
  const issues = issuesOf(page);
  if (!issues.length) return {pages: [page], blocked: []};
  if (depth > 8) return {pages: [page], blocked: issues};
  const pair = splitOnce(page);
  if (!pair) return {pages: [page], blocked: issues};
  const left = expandPage(pair[0], depth + 1);
  const right = expandPage(pair[1], depth + 1);
  if (left.blocked.length || right.blocked.length) return {pages: [page], blocked: [...left.blocked, ...right.blocked]};
  return {pages: [...left.pages, ...right.pages], blocked: []};
}

/**
 * 把仍超稿件契约、又能拆开的页拆成同一版式的两页（必要时再拆），旁白跟着分。
 * 单条文字本身超限、或拆开后仍过不了契约，则 blocked 非空，lesson 保持原样。
 */
export function splitCopyOverflow(lesson) {
  const next = structuredClone(lesson);
  let changed = false;
  for (const chapter of next.chapters ?? []) {
    if (!Array.isArray(chapter?.pages)) continue;
    const pages = [];
    for (const page of chapter.pages) {
      const expanded = expandPage(page, 0);
      if (expanded.blocked.length) return {lesson, blocked: copyLimitIssues(lesson), changed: false};
      if (expanded.pages.length !== 1) changed = true;
      pages.push(...expanded.pages);
    }
    chapter.pages = pages;
  }
  const left = copyLimitIssues(next);
  if (left.length || !changed) return {lesson, blocked: left.length ? left : copyLimitIssues(lesson), changed: false};
  return {lesson: next, blocked: [], changed: true};
}

/** 同一版式连续不超过 2 页；不少于 8 页时至少 5 种版式。只警告，并写明改法。 */
export function layoutMixIssues(lesson) {
  const pages = pagesOf(lesson);
  const issues = [];
  let start = 0;
  for (let i = 1; i <= pages.length; i += 1) {
    const same = i < pages.length && pages[i].page?.layout === pages[start].page?.layout;
    if (same) continue;
    const run = i - start;
    if (run > 2) {
      const name = pages[start].page?.layout ?? '';
      issues.push(issue(pages[start].at, `版式 ${name} 从这里连续用了 ${run} 页，同一版式连续不超过 2 页。请把多出来的页改成别的版式`));
    }
    start = i;
  }
  if (pages.length >= 8) {
    const kinds = new Set(pages.map((row) => row.page?.layout).filter(Boolean));
    if (kinds.size < 5) issues.push(issue('chapters', `全片 ${pages.length} 页只用了 ${kinds.size} 种版式。不少于 8 页时至少用 5 种。请把重复的页改成还没用过的版式`));
  }
  return issues;
}

export function styleTokens(id) { return tokens[id]; }
