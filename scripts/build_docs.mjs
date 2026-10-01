#!/usr/bin/env node
// ============================================================
// 生成 shots.md / shots.en.md（镜头目录）：合并 docs/shots/<type>.md（+ <type>.en.md），
// 并在每节末尾附上从 spec.json 自动生成的「参数速查」。
//   node scripts/build_docs.mjs
// 镜头文档或 spec 改了就重跑一次。数字以 spec.json 为准（校验也读它）。
// 英文版缺 docs/shots/<type>.en.md 时用中文兜底（并在标题后标注 [no English doc yet]）。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSpecs} from './validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = [
  'hook', 'chat', 'phone', 'mockApp', 'photoShot', 'meter', 'compare', 'beforeAfter', 'counter', 'dataChart',
  'priceCard', 'storeCard', 'reviewCard', 'factSheet', 'credCard', 'features', 'steps', 'quickList', 'endCard',
];
const specs = loadSpecs();
const read = (p) => fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
const themes = JSON.parse(read(path.join(ROOT, 'template', 'src', 'core', 'themes.json')));
const icons = Object.keys(JSON.parse(read(path.join(ROOT, 'template', 'src', 'core', 'icons.json'))));

// 概览表里给英文版用的一句话说明（spec.json 的 purpose 只有中文，这里单独维护一份英文摘要）
const PURPOSE_EN = {
  hook: "Frame 0's cover hook: a big headline + a one-line product highlight pill + a main visual — complete on frame 0, never blank",
  chat: 'A mock chat window: messages pop in, optionally typed into the input box, product panel pops up with a verdict + tags + candidate replies, first reply flies into the input box',
  phone: '1–3 callouts on a real screenshot or recording inside a phone frame (magnifier / highlight box / arrow + short label), saying "look here"',
  mockApp: 'A simulated, animated product UI for when there\'s no screenshot: dashboard / list / editor / form',
  photoShot: 'Real photos or short clips of the dish/product/work/room/space/kitchen, with name, price tag and selling points overlaid',
  meter: 'A gauge/score: the needle springs to the target value, the number bumps + a verdict pill pops up, then a closing line',
  compare: 'A comparison: side-by-side columns (lr) or a before/after wipe reveal (beforeAfter)',
  beforeAfter: 'A before/after wipe slider: hair/nail/lash only, the same customer before and after, revealed with a wipe',
  counter: 'A rolling number from `from` to `to`, bumping and flashing as it lands, with the number\'s meaning and basis below it',
  dataChart: 'A data story card with a title, takeaway, KPIs, chart, annotations, and cited source; supports bars, lines, dots, stacked bars, and donut charts',
  priceCard: 'A price card/list: the display-pricing rules are built into the component, the model only fills in numbers and conditions',
  storeCard: 'Store location and directions: where it is, hours, how to get there, and how to act on the platform',
  reviewCard: 'A real customer review, quoted verbatim (may be trimmed, never rewritten to sound better)',
  factSheet: 'A spec sheet / unboxing list / course syllabus / exam info / color swatches — verifiable facts laid out on one screen',
  credCard: 'A credentials or honors card: only provable credentials/honors, in place of vague claims like "master teacher" or "gold medal"',
  features: '2–4 selling-point cards pop in on the beat, a yellow spotlight frame follows the one being talked about',
  steps: 'A 1-2-3 flow card: nodes light up top to bottom as a dot runs down the line, each step\'s text slides in, all steps get a ✓ at the end',
  quickList: '3–6 rows fly in alternating left/right, each stamped with a score or a colored tag; the left edge fills in by tone',
  endCard: 'The end card: logo/brand icon + product name + a big headline + 1–3 selling-point pills + an optional call to action',
};
const capRuleZh = {required: '必填', optional: '可选', none: '不能写'};
const capRuleEn = {required: 'required', optional: 'optional', none: 'not allowed'};
const typeNameZh = (s) =>
  s.enum ? s.enum.join(' / ') : ({string: '文字', number: '数字', integer: '整数', boolean: 'true/false', object: '对象', array: '数组'})[s.type] ?? s.type;
const typeNameEn = (s) =>
  s.enum ? s.enum.join(' / ') : ({string: 'text', number: 'number', integer: 'integer', boolean: 'true/false', object: 'object', array: 'array'})[s.type] ?? s.type;

// 把 spec.params 摊平成一行一个字段
const flat = (schema, prefix, req, out, lang) => {
  const typeName = lang === 'en' ? typeNameEn : typeNameZh;
  const props = schema.properties ?? {};
  for (const [k, s] of Object.entries(props)) {
    const name = prefix ? `${prefix}.${k}` : k;
    const lim = [];
    if (s.maxLen !== undefined) lim.push(lang === 'en' ? `≤${s.maxLen} chars` : `≤${s.maxLen} 字`);
    if (s.lineMax !== undefined) lim.push(lang === 'en' ? `≤${s.lineMax} chars/line, ≤${s.maxLines ?? 2} lines` : `每行 ≤${s.lineMax} 字、≤${s.maxLines ?? 2} 行`);
    if (s.minimum !== undefined || s.maximum !== undefined) lim.push(`${s.minimum ?? '…'}–${s.maximum ?? '…'}`);
    if (s.minItems !== undefined || s.maxItems !== undefined) lim.push(lang === 'en' ? `${s.minItems ?? 0}–${s.maxItems ?? '…'} items` : `${s.minItems ?? 0}–${s.maxItems ?? '…'} 项`);
    if (s.format === 'icon') lim.push(lang === 'en' ? 'icon name' : '图标名');
    if (s.format === 'asset') lim.push(lang === 'en' ? `asset ${(s.accept ?? []).join('/')}` : `素材 ${(s.accept ?? []).join('/')}`);
    const req_ = lang === 'en' ? ((req ?? []).includes(k) ? 'Yes' : '') : ((req ?? []).includes(k) ? '是' : '');
    out.push(`| \`${name}\` | ${req_} | ${typeName(s)} | ${lim.join(lang === 'en' ? ', ' : '，')} | ${(s.description ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')} |`);
    if (s.type === 'object') flat(s, name, s.required, out, lang);
    if (s.type === 'array' && s.items?.type === 'object') flat(s.items, `${name}[]`, s.items.required, out, lang);
  }
};

const build = (lang) => {
  const capRule = lang === 'en' ? capRuleEn : capRuleZh;
  const md = [];
  if (lang === 'en') {
    md.push('# Shot Catalog (shots.en.md)');
    md.push('');
    md.push('> Generated by `node scripts/build_docs.mjs` from `docs/shots/<type>.en.md` + `template/src/shots/*.spec.json` — do not hand-edit. Character limits and allowed values follow the "Params" table at the end of each section (validation reads the spec, not this prose).');
    md.push('');
    md.push('## Overview');
    md.push('');
    md.push('| Shot | What it does | Duration (s) | Caption |');
    md.push('|---|---|---|---|');
    for (const t of ORDER) {
      const s = specs[t];
      md.push(`| [${t}](#${t.toLowerCase()}) | ${PURPOSE_EN[t] ?? s.purpose.split('。')[0]} | ${s.dur.min}–${s.dur.max} (default ${s.dur.default}) | ${capRule[s.caption]} |`);
    }
    md.push('');
    md.push('**Typical structure**: hook (0–3s) → pain point / scene → evidence (dataChart / compare / meter / counter) → product appears (phone / mockApp / photoShot) → endCard. dataChart organizes a title, takeaway, KPIs, chart, annotations, and cited sources in one shot.');
    md.push('');
    md.push('**Industry shots** (which ones are allowed depends on `meta.industry`, see `enabledShots` in each `industries/<id>/rules.json`): photoShot (real or illustrated photos), priceCard (price list), storeCard (location/map/booking), reviewCard (real customer reviews), factSheet (spec sheet/syllabus/swatches), credCard (credentials/honors), beforeAfter (before/after slider, beauty industry only).');
    md.push('');
    md.push(`**Themes**: ${Object.keys(themes).map((k) => `\`${k}\``).join(' ')}`);
    md.push('');
    md.push(`**Icons** (every \`icon\` field must pick from this list): ${icons.map((k) => `\`${k}\``).join(' ')}`);
    md.push('');
    md.push('**Character counting**: for `meta.lang: "en"` videos, captions are measured in raw Latin characters against a scaled line budget (roughly 1.8× the Chinese limit) — see each shot\'s own English doc for exact numbers; non-caption param fields still use the base spec limits (CJK = 1, Latin = 0.5) shown in the tables below. Caption `caption` is at most 2 lines, one `{}` emphasis span, use `\\n` to break lines.');
    md.push('');
  } else {
    md.push('# 镜头目录（shots.md）');
    md.push('');
    md.push('> 由 `node scripts/build_docs.mjs` 从 `docs/shots/*.md` + `template/src/shots/*.spec.json` 生成，别手改。字数上限、可选值以每节末尾的「参数速查」为准（校验读的就是它）。');
    md.push('');
    md.push('## 一览');
    md.push('');
    md.push('| 镜头 | 干什么 | 时长（秒） | 字幕 |');
    md.push('|---|---|---|---|');
    for (const t of ORDER) {
      const s = specs[t];
      md.push(`| [${t}](#${t.toLowerCase()}) | ${s.purpose.split('。')[0]} | ${s.dur.min}–${s.dur.max}（默认 ${s.dur.default}） | ${capRule[s.caption]} |`);
    }
    md.push('');
    md.push('**常规结构**：hook（0–3 秒）→ 痛点/场景 → 证据（dataChart / compare / meter / counter）→ 产品出场（phone / mockApp / photoShot）→ endCard。dataChart 在一镜内组织标题、核心结论、KPI、图表、旁注和来源。');
    md.push('');
    md.push('**行业镜头**（`meta.industry` 决定哪些能用，见各 `industries/<id>/rules.json` 的 `enabledShots`）：photoShot（实拍/示意图）、priceCard（价目表）、storeCard（门店/地图/预订）、reviewCard（真实评价）、factSheet（参数表/大纲/色卡）、credCard（资历/荣誉）、beforeAfter（前后对比，仅美业）。');
    md.push('');
    md.push(`**主题**：${Object.keys(themes).map((k) => `\`${k}\``).join(' ')}`);
    md.push('');
    md.push(`**图标**（所有 icon 字段只能从这里选）：${icons.map((k) => `\`${k}\``).join(' ')}`);
    md.push('');
    md.push('**字数怎么数**：汉字、全角标点算 1 个字，拉丁字母、数字、半角空格算半个。字幕 `caption` 最多 2 行、每行 ≤12 字，`{}` 强调最多 1 处，用 `\\n` 换行。');
    md.push('');
  }

  let missingEn = 0;
  for (const t of ORDER) {
    const s = specs[t];
    const doc = path.join(ROOT, 'docs', 'shots', lang === 'en' ? `${t}.en.md` : `${t}.md`);
    const zhDoc = path.join(ROOT, 'docs', 'shots', `${t}.md`);
    md.push('---');
    md.push('');
    md.push(`<a id="${t.toLowerCase()}"></a>`);
    if (fs.existsSync(doc)) {
      // 各节标题降一级：# → ##，## → ###
      md.push(read(doc).trim().replace(/^(#+) /gm, (m, h) => `#${h} `));
    } else if (lang === 'en' && fs.existsSync(zhDoc)) {
      missingEn++;
      md.push(`## ${t} [no English doc yet — showing the Chinese doc]\n\n${read(zhDoc).trim().replace(/^(#+) /gm, (m, h) => `#${h} `).replace(/^#[^\n]*\n/, '')}`);
    } else {
      md.push(`## ${t}\n\n${s.purpose}`);
    }
    md.push('');
    md.push(lang === 'en' ? `### Params (auto-generated from ${t}.spec.json)` : `### 参数速查（自动生成自 ${t}.spec.json）`);
    md.push('');
    md.push(
      lang === 'en'
        ? `Duration ${s.dur.min}–${s.dur.max}s (default ${s.dur.default}); caption ${capRule[s.caption]}; default mood ${s.mood ?? 0.5}; exit ${s.exit ?? 'push'}.`
        : `时长 ${s.dur.min}–${s.dur.max} 秒（默认 ${s.dur.default}）；字幕 ${capRule[s.caption]}；默认情绪 ${s.mood ?? 0.5}；退场 ${s.exit ?? 'push'}。`
    );
    md.push('');
    md.push(lang === 'en' ? '| Field | Required | Type / values | Limit | Notes |' : '| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |');
    md.push('|---|---|---|---|---|');
    const rows = [];
    flat(s.params, '', s.params.required, rows, lang);
    md.push(...rows);
    md.push('');
    md.push(lang === 'en' ? 'Example (passes validation as-is):' : '示例（能直接通过校验）：');
    md.push('');
    md.push('```json');
    const ex = {type: t, dur: s.example.dur ?? s.dur.default};
    if (s.example.caption) ex.caption = s.example.caption;
    if (s.example.mood !== undefined) ex.mood = s.example.mood;
    ex.params = s.example.params;
    md.push(JSON.stringify(ex, null, 1).replace(/\n\s*/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']').replace(/\{ /g, '{').replace(/ \}/g, '}'));
    md.push('```');
    md.push('');
  }
  fs.writeFileSync(path.join(ROOT, lang === 'en' ? 'shots.en.md' : 'shots.md'), md.join('\n'), 'utf8');
  return missingEn;
};

build('zh');
const missing = build('en');
console.log(`已生成 shots.md / shots.en.md：${ORDER.length} 个镜头${missing ? `（shots.en.md 有 ${missing} 个镜头暂无独立英文文档，已用中文兜底）` : ''}`);
