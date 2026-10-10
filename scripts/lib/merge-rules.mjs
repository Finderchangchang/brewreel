// ============================================================
// 行业规则三层合并（docs/dev/industry-design.md 第 3.5 节）。
//   industries/_base/rules.json → industries/<industry>/rules.json
//     → rules.sub[meta.subCategory] → rules.platform[meta.platform]
//
// 数组按 id 合并：后加载的覆盖先加载的同 id 条目；{id, off:true} 表示关掉上层的这条。
// 没有 id 的数组（disabledShots、enabledShots、allowlist、humanReview、publishChecklist）直接拼接去重。
// 对象字段（mediaPolicy、shotRules）按 key 做一层浅合并，overlay 赢。
//
// 已知缺口（写在这里免得散在各处）：
//   meta.subCategory 目前不在 template/src/schema.ts 的 Meta.known 字段列表里，
//   任何 storyboard.json 写了 meta.subCategory 都会被 validate.mjs 主体判成"不认识的字段"报错。
//   这里仍然实现 sub 合并（架构就绪、按 meta.subCategory 生效），一旦 schema 补上这个字段，
//   merge 逻辑不用改。在此之前，行业规则里依赖 subCategory 的内容改成对 storyboard 正文的规则式判断，
//   不强依赖这个字段（见各行业 rules.json 的注释）。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));

const ID_ARRAYS = ['patterns', 'checks', 'requiredNotices'];
const PLAIN_ARRAYS = ['disabledShots', 'enabledShots', 'allowlist', 'humanReview', 'publishChecklist', 'rejectBrief'];
// flags 之前漏在这张表外：food 的 flags.promoRequiresLimits 合并后丢失，promoHasPeriod 的「促销要有 limits」从没生效（round5 修复）
// coreAction：核心动作演示面（ui / physical / none），见 scripts/checks/core-action.mjs
const OBJECT_FIELDS = ['mediaPolicy', 'shotRules', 'flags', 'coreAction'];

/** 数组按 id 合并；id 相同的后来者覆盖先来者；{id,off:true} 删掉先来的同 id 条目。checks 没有天然 id，按 fn(+when 摘要) 兜底当 id。 */
function mergeIdArray(base, overlay, idOf) {
  const out = [];
  const index = new Map();
  for (const item of base ?? []) {
    const id = idOf(item);
    index.set(id, out.length);
    out.push(item);
  }
  for (const item of overlay ?? []) {
    const id = idOf(item);
    if (item && item.off) {
      if (index.has(id)) out[index.get(id)] = null;
      continue;
    }
    if (index.has(id)) out[index.get(id)] = item;
    else {
      index.set(id, out.length);
      out.push(item);
    }
  }
  return out.filter(Boolean);
}

const idOfPattern = (p) => p?.id ?? JSON.stringify(p);
const idOfCheck = (c) => (c?.id ?? c?.fn ?? '') + (c?.when ? JSON.stringify(c.when) : '');
const idOfNotice = (n) => n?.id ?? n?.text ?? JSON.stringify(n);

/** 把 overlay 规则合并进 base 规则（浅合并）。两者都是 rules.json 的顶层对象（或其 sub/platform 下的片段）。 */
export function mergeRules(base, overlay) {
  if (!overlay) return base;
  const out = {...base};
  out.patterns = mergeIdArray(base?.patterns, overlay.patterns, idOfPattern);
  out.checks = mergeIdArray(base?.checks, overlay.checks, idOfCheck);
  out.requiredNotices = mergeIdArray(base?.requiredNotices, overlay.requiredNotices, idOfNotice);
  for (const k of PLAIN_ARRAYS) {
    const merged = [...(base?.[k] ?? []), ...(overlay[k] ?? [])];
    out[k] = [...new Set(merged.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))))].map((x) => {
      try {
        return typeof x === 'string' && x.startsWith('{') ? JSON.parse(x) : x;
      } catch {
        return x;
      }
    });
  }
  for (const k of OBJECT_FIELDS) out[k] = {...(base?.[k] ?? {}), ...(overlay[k] ?? {})};
  // 重新开放：overlay 的 enabledShots 里显式列出的类型，从合并后的 disabledShots 里摘掉
  // （如 _base 默认禁用 beforeAfter，beauty/rules.json 把它写进 enabledShots 就等于重新开放）
  if (Array.isArray(overlay.enabledShots) && overlay.enabledShots.length)
    out.disabledShots = (out.disabledShots ?? []).filter((t) => !overlay.enabledShots.includes(t));
  // sub / platform 保留最新写入的整段（子层合并在 applySubPlatform 里按需触发，这里不预先展开）
  if (overlay.sub) out.sub = {...(base?.sub ?? {}), ...overlay.sub};
  if (overlay.platform) out.platform = {...(base?.platform ?? {}), ...overlay.platform};
  for (const k of ['id', 'name', 'version', 'note']) if (overlay[k] !== undefined) out[k] = overlay[k];
  return out;
}

/** 按 meta.subCategory / meta.platform 把 rules.sub[...] 和 rules.platform[...] 的片段叠加进来。 */
export function applySubPlatform(rules, meta) {
  let out = rules;
  const sub = meta?.subCategory && rules.sub?.[meta.subCategory];
  if (sub) out = mergeRules(out, sub);
  const plat = meta?.platform && rules.platform?.[meta.platform];
  if (plat) out = mergeRules(out, plat);
  return out;
}

/**
 * 读 industries/_base/rules.json + industries/<industry>/rules.json，三层合并后返回最终规则。
 * industry 目录不存在时返回 {missing: true}（调用方据此报 block，不静默回退，见 §3.5）。
 */
export function resolveIndustryRules(root, meta) {
  const industriesDir = path.join(root, 'industries');
  const industry = meta?.industry || 'software';
  const industryDir = path.join(industriesDir, industry);
  if (!fs.existsSync(industryDir) || !fs.existsSync(path.join(industryDir, 'rules.json'))) {
    return {missing: true, industry};
  }
  const basePath = path.join(industriesDir, '_base', 'rules.json');
  const base = fs.existsSync(basePath) ? readJson(basePath) : {};
  const overlay = readJson(path.join(industryDir, 'rules.json'));
  let merged = mergeRules(base, overlay);
  merged = applySubPlatform(merged, meta);
  merged.industry = industry;
  return merged;
}
