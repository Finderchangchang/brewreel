#!/usr/bin/env node
// ============================================================
// 行业规则回归测试：一键跑 tests/rules/<industry>/*.json，每个文件是
//   {"name": "...", "storyboard": {meta, shots}, "expect": {"block": [...], "warn": [...], "human": [...]}}
// storyboard 只需要 meta + shots（镜头用 11 个旧镜头或 7 个新镜头的 spec 字段，dur 用显式数字）。
// expect 里的每个字符串按子串匹配对应档位（block→errors / warn→warnings / human→human）里
// 任意一条 problem 或 fix；全部命中才算这个文件通过。
//
// 用法：node scripts/test-rules.mjs [industry ...]（不传参数=跑全部）
//
// 注意：这里直接调用 runIndustryChecks()，不跑 scripts/validate.mjs 主体的通用检查（字数/断词/相似度等，
// 那些和「行业规则」无关，属于另一层职责）。ctx.texts/slots 由下面的 buildCtx() 按 storyboard 自己算，
// 是本文件的简化实现，字段收集规则和 validate.mjs 主体基本一致但不完全相同（见 buildCtx 注释）。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runIndustryChecks} from './lib/industry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_DIR = path.join(ROOT, 'tests', 'rules');

// 递归收集 shot.params 里的文字叶子值，排除结构性/不上屏字段（对照 validate.mjs 里 collectStrings 的排除表，
// 补了新镜头引入的 source/tag/layout/illust/itemId/refs/evidence——evidence 是 format:"note"，本就不上屏）
const SKIP_KEYS = new Set(['icon', 'src', 'kind', 'visual', 'tone', 'chart', 'from', 'higherIs', 'type', 'mode', 'source', 'tag', 'layout', 'illust', 'itemId', 'refs', 'evidence', 'x', 'y', 'hex', 'no']);
function collectTexts(v, keyHint, out) {
  if (typeof v === 'string') {
    if (v.trim()) out.push(v);
  } else if (Array.isArray(v)) {
    for (const x of v) collectTexts(x, keyHint, out);
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) collectTexts(x, k, out);
  }
}

/** 简化版 ctx 构造：texts 按 where 字符串定位（和 validate.mjs 的 where(i,type,field) 格式一致，field 用 "params" 统一代表），
 *  slots 按 shots 里显式的 dur 累加（测试样例都写显式 dur，不依赖 beat 吸附）。 */
function buildCtx(sb) {
  const meta = sb.meta ?? {};
  const texts = [];
  (sb.shots ?? []).forEach((s, i) => {
    if (!s) return;
    for (const c of [s.caption].flat()) if (typeof c === 'string' && c.trim()) texts.push({where: `第 ${i + 1} 镜（${s.type}）caption`, text: c, caption: true, shotIndex: i, shotType: s.type, shot: s});
    const leaves = [];
    collectTexts(s.params ?? {}, null, leaves);
    for (const t of leaves) texts.push({where: `第 ${i + 1} 镜（${s.type}）params`, text: t, shotIndex: i, shotType: s.type, shot: s});
  });
  (meta.notices ?? []).forEach((n, k) => texts.push({where: `meta.notices[${k}]`, text: n, shotIndex: -1}));
  if (meta.disclaimer) texts.push({where: 'meta.disclaimer', text: meta.disclaimer, shotIndex: -1});
  if (meta.product) texts.push({where: 'meta.product', text: meta.product, shotIndex: -1});
  if (meta.cta) texts.push({where: 'meta.cta', text: meta.cta, shotIndex: -1});
  let start = 0;
  const slots = (sb.shots ?? []).map((s, i) => {
    const dur = typeof s?.dur === 'number' ? s.dur : 2;
    const slot = {i, type: s?.type, start, dur, end: start + dur};
    start += dur;
    return slot;
  });
  return {baseDir: RULES_DIR, specs: {}, texts, assets: [], slots, beat: 0.5, meta};
}
// buildCtx 直接把 shotIndex/shotType/shot 附到每条 texts 上，industry.mjs 的 indexTexts() 会重新从 where 反解
// 一遍（兼容 validate.mjs 传下来的、没有附加字段的 texts），两边字段重复无害。

function loadFixtures(industry) {
  const dir = path.join(RULES_DIR, industry);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({file: `${industry}/${f}`, data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))}));
}

function findAll(list) {
  return (list ?? []).map((x) => `${x.problem} ${x.fix}`).join('\n');
}

function runOne(fixture) {
  const {name, storyboard, expect} = fixture.data;
  const ctx = buildCtx(storyboard);
  const r = runIndustryChecks(storyboard, ctx);
  const hay = {block: findAll(r.errors), warn: findAll(r.warnings), human: findAll(r.human)};
  const fails = [];
  for (const level of ['block', 'warn', 'human']) {
    for (const needle of expect?.[level] ?? []) {
      if (!hay[level].includes(needle)) fails.push(`缺少 ${level} 命中："${needle}"`);
    }
  }
  if (expect?.blockCount !== undefined && r.errors.length !== expect.blockCount) fails.push(`block 数量 ${r.errors.length} != 期望 ${expect.blockCount}`);
  return {file: fixture.file, name: name ?? fixture.file, ok: fails.length === 0, fails, counts: {block: r.errors.length, warn: r.warnings.length, human: r.human.length}, r};
}

const INDUSTRIES = ['software', 'food', 'ecommerce', 'education', 'beauty', 'travel'];
const argIndustries = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const target = argIndustries.length ? argIndustries : INDUSTRIES;
const verbose = process.argv.includes('--verbose');

let total = 0;
let passed = 0;
const summaryByIndustry = {};
for (const industry of target) {
  const fixtures = loadFixtures(industry);
  if (!fixtures.length) continue;
  console.log(`\n== ${industry}（${fixtures.length} 个样例）==`);
  summaryByIndustry[industry] = {pass: 0, fail: 0};
  for (const fx of fixtures) {
    total++;
    const res = runOne(fx);
    if (res.ok) {
      passed++;
      summaryByIndustry[industry].pass++;
      console.log(`  OK   ${res.file} — ${res.name}（block ${res.counts.block} / warn ${res.counts.warn} / human ${res.counts.human}）`);
    } else {
      summaryByIndustry[industry].fail++;
      console.log(`  FAIL ${res.file} — ${res.name}`);
      for (const f of res.fails) console.log(`       - ${f}`);
    }
    if (verbose) {
      for (const e of res.r.errors) console.log(`       block: ${e.problem} → ${e.fix}`);
      for (const w of res.r.warnings) console.log(`       warn : ${w.problem} → ${w.fix}`);
      for (const h of res.r.human) console.log(`       human: ${h.problem} → ${h.fix}`);
    }
  }
}
console.log(`\n共 ${total} 个样例，通过 ${passed}，失败 ${total - passed}`);
if (total - passed > 0) process.exit(1);
