// ============================================================
// 行业规则引擎的共享小工具：文本归一化、allowlist 占位替换、pattern 匹配、
// unless/blockIf/when 小 DSL、where() 定位字符串。被 industry.mjs 和 scripts/checks/*.mjs 共用。
// ============================================================

/** 与 validate.mjs 里 where(i, type, field) 完全一致的定位字符串，方便报错格式统一 */
export const where = (i, type, field) => (i < 0 || i === undefined ? field : `第 ${i + 1} 镜（${type ?? '?'}）${field}`);

/** 从 ctx.texts 的 where 字符串反解出镜头序号（0-based）和类型；meta 级别的文字返回 null */
export function parseShotWhere(w) {
  const m = /^第 (\d+) 镜（([^）]*)）/.exec(w || '');
  return m ? {i: Number(m[1]) - 1, type: m[2]} : null;
}

/** §3.5 步骤 1：文本规范化——全角转半角、去空格和零宽字符、拉丁字母转小写 */
export function normalize(s) {
  if (typeof s !== 'string') return '';
  let out = s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)); // 全角->半角
  out = out.replace(/[\s　​-‍﻿]/g, ''); // 去空格（含全角空格）和零宽字符
  out = out.replace(/[A-Za-z]/g, (c) => c.toLowerCase());
  return out;
}

/** §3.5 步骤 2：allowlist 命中的片段先替换成占位符，避免它们被后面的 block 正则命中（如"第一杯"里的"第一"） */
export function maskAllowlist(text, allowlist) {
  let out = text;
  for (const frag of allowlist ?? []) {
    try {
      const re = new RegExp(frag, 'g');
      out = out.replace(re, (m) => '\u0000'.repeat(m.length));
    } catch {
      /* 规则里写了非法正则，跳过这一条，不让它拖垮整个校验 */
    }
  }
  return out;
}

/** 小 DSL：{shotHas:"source"} | {refsIn:"facts"} | {briefHas:"..."}（无 brief 加载器，恒为 false，见 merge-rules.mjs 顶部注释） */
export function checkUnless(cond, {shot, meta}) {
  const list = Array.isArray(cond) ? cond : [cond];
  return list.some((c) => {
    if (!c) return false;
    if (c.shotHas) return !!(shot?.params && shot.params[c.shotHas] !== undefined && shot.params[c.shotHas] !== null && shot.params[c.shotHas] !== '');
    if (c.refsIn === 'facts') {
      const refs = Array.isArray(shot?.params?.refs) ? shot.params.refs : [];
      const ids = new Set((meta?.facts ?? []).map((f) => f.id));
      return refs.some((r) => ids.has(r));
    }
    if (c.briefHas) return false; // 无 brief 加载器，见 merge-rules.mjs 顶部说明
    return false;
  });
}

/** blockIf 目前只支持 brief.* 条件；没有 brief 加载器时恒为 false（不额外拦截），见 merge-rules.mjs 顶部说明 */
export function checkBlockIf(_cond) {
  return false;
}

/** rules.checks[].when / rules.requiredNotices[].when 用的小 DSL 求值 */
export function evalWhen(when, {meta, shotTypes}) {
  if (!when) return true;
  return Object.entries(when).every(([k, v]) => {
    if (k === 'platform') return meta?.platform === v;
    if (k === 'attachDeal') return !!meta?.attachDeal === !!v; // 预留：meta 暂无 attachDeal 字段时恒为 undefined!=v
    if (k === 'hasShot') {
      const types = Array.isArray(v) ? v : [v];
      return types.some((t) => shotTypes.includes(t));
      }
    if (k === 'subCategory') return meta?.subCategory === v;
    if (k.startsWith('brief.')) return false; // 无 brief 加载器
    return true;
  });
}

/** 取某个类型的所有镜头（含索引） */
export function shotsOfType(sb, type) {
  return (sb?.shots ?? []).map((s, i) => ({i, shot: s})).filter((x) => x.shot?.type === type);
}

/** 把 ctx.texts 按镜头分组，附带该镜头的 params/refs，供 pattern 引擎和 checks 用 */
export function indexTexts(sb, ctx) {
  const shots = sb?.shots ?? [];
  return (ctx.texts ?? []).map((t) => {
    const loc = parseShotWhere(t.where);
    const shot = loc && loc.i >= 0 ? shots[loc.i] : undefined;
    return {...t, shotIndex: loc?.i ?? -1, shotType: loc?.type, shot};
  });
}

export const mkFinding = (level, w, problem, fix) => ({level, where: w, problem, fix});
