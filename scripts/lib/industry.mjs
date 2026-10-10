// ============================================================
// 行业规则校验：三层合并（_base → industries/<meta.industry> → sub/platform 覆盖层，见
// scripts/lib/merge-rules.mjs 和 docs/dev/industry-design.md 第 3 节）之后，跑
//   1. disabledShots：本行业禁用的镜头类型，命中就 block
//   2. patterns：正则扫描（scope: text / shot:<type>；brief:<field> 因为暂无 brief 加载器而跳过）
//   3. checks：调用 scripts/checks/*.mjs 里的内置检查函数
//   4. humanReview：本行业的静态人工复核提醒
// 三档结果分别进 errors / warnings / human，格式和 validate.mjs 主体一致：{where, problem, fix}。
//
// meta.industry 缺省按 software 处理（调用方已兜底），找不到对应 industries/<name>/ 目录时报 block，不静默回退（§3.5）。
// ============================================================
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveIndustryRules} from './merge-rules.mjs';
import {where, normalize, maskAllowlist, indexTexts, checkUnless, checkBlockIf, evalWhen} from '../checks/util.mjs';
import {REGISTRY} from '../checks/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * @param {any} storyboard 解析后的 storyboard.json
 * @param {{baseDir: string, specs: Record<string, any>, texts: {where: string, text: string, caption?: boolean}[],
 *          assets: {where: string, rel: string, abs: string}[], slots: any[], beat: number, meta: any}} ctx
 * @returns {{errors: {where: string, problem: string, fix: string}[], warnings: {where: string, problem: string, fix: string}[], human: {where: string, problem: string, fix: string}[]}}
 */
export function runIndustryChecks(storyboard, ctx) {
  const meta = ctx.meta ?? {};
  const industry = meta.industry || 'software';
  const errors = [];
  const warnings = [];
  const human = [];
  const push = (f) => {
    if (!f) return;
    const item = {where: f.where, problem: f.problem, fix: f.fix};
    if (f.level === 'block') errors.push(item);
    else if (f.level === 'warn') warnings.push(item);
    else human.push(item);
  };

  const rules = resolveIndustryRules(ROOT, meta);
  if (rules.missing) {
    push({level: 'block', where: 'meta.industry', problem: `找不到 industries/${industry}/ 目录`, fix: '不要编一个不存在的行业名。六个行业包是 software / food / ecommerce / education / beauty / travel。产品不在六个行业里时，先告诉用户没有专门合规规则包；版式可借最接近的行业并写明借了哪个；只跑通用广告法就写 meta.industry 为 general。详见 SKILL.md「产品不在六个行业里」（英文 SKILL.en.md "When the product is not in the six industries"）。'});
    return {errors, warnings, human};
  }

  // ---- 1) disabledShots：本行业/子层/平台层禁用的镜头 ----
  const disabled = new Set(rules.disabledShots ?? []);
  (storyboard.shots ?? []).forEach((s, i) => {
    if (s && disabled.has(s.type))
      push({level: 'block', where: where(i, s.type, ''), problem: `「${industry}」行业不开放镜头 ${s.type}`, fix: s.type === 'beforeAfter' ? '只有美业（beauty）且已获顾客书面授权时才能用；否则换 steps 展示过程' : '这个类型在合并后的 disabledShots 里。换一个镜头。enabledShots 没写不等于不能用'});
  });

  // ---- 2) patterns：正则扫描（先按 §3.5 做文本规范化 + allowlist 占位替换）----
  const allowlist = rules.allowlist ?? [];
  const allowWords = Array.isArray(meta.allowWords) ? meta.allowWords : [];
  const texts = indexTexts(storyboard, ctx);
  for (const p of rules.patterns ?? []) {
    if (!p?.regex) continue;
    let re;
    try {
      re = new RegExp(p.regex, p.flags ?? '');
    } catch {
      push({level: 'human', where: `rules.patterns[${p.id ?? '?'}]`, problem: '正则写错了，跳过这一条', fix: '检查 rules.json 里的 regex 语法'});
      continue;
    }
    const scope = p.scope || 'text';
    if (scope.startsWith('brief:')) continue; // 没有 brief 加载器，见 merge-rules.mjs 顶部注释
    const scopeType = scope.startsWith('shot:') ? scope.slice(5) : null;
    for (const t of texts) {
      if (scopeType && t.shotType !== scopeType) continue;
      const normalized = maskAllowlist(normalize(t.text), allowlist);
      if (!re.test(normalized)) continue;
      if (p.unless && checkUnless(p.unless, {shot: t.shot, meta}) && !(p.blockIf && checkBlockIf(p.blockIf))) continue;
      if (p.level === 'warn' && allowWords.some((w) => t.text.includes(w))) continue;
      push({level: p.level, where: t.where, problem: `[${p.id}] 「${t.text}」${p.message}`, fix: p.source ? `${p.fix}（依据：${p.source}）` : p.fix});
    }
  }

  // ---- 3) checks：内置检查函数（priceMatchesBrief 等标了 fn 的一律走这里）----
  const shotTypes = (storyboard.shots ?? []).map((s) => s?.type);
  for (const c of rules.checks ?? []) {
    if (!evalWhen(c.when, {meta, shotTypes})) continue;
    const fn = REGISTRY[c.fn];
    if (!fn) {
      push({level: 'human', where: 'rules.checks', problem: `未知检查函数 "${c.fn}"`, fix: '检查 rules.json 里的 fn 拼写，或在 scripts/checks/index.mjs 的 REGISTRY 里补上'});
      continue;
    }
    for (const f of fn(storyboard, ctx, rules) ?? []) push(f);
  }

  // ---- 4) humanReview：本行业的静态人工复核提醒（不依赖具体文字命中）----
  for (const h of rules.humanReview ?? []) push({level: 'human', where: h.where || `industries/${industry}`, problem: h.text, fix: h.source ? `依据：${h.source}（人工判断）` : '人工判断'});

  return {errors, warnings, human};
}
