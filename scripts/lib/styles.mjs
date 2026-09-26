// ============================================================
// 风格包（Node 侧）：校验和出片按 meta.style 取这个风格的清单、镜头 spec、规则和自定义检查。
//   代码侧清单：template/src/styles/<id>/style.json（TS 也读同一份）
//   专属镜头：  template/src/styles/<id>/shots/*.spec.json
//   风格规则：  styles/<id>/rules.json（声明式，见 runStyleRules）+ styles/<id>/checks.mjs（可选，写不成声明式的规则）
//   画幅：      template/src/core/aspects.json（TS 的 core/safe.ts 也读它）
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STYLES_SRC = path.join(ROOT, 'template', 'src', 'styles');
const STYLES_DOC = path.join(ROOT, 'styles');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));

export const DEFAULT_STYLE = 'cards';
export const ASPECTS = readJson(path.join(ROOT, 'template', 'src', 'core', 'aspects.json'));
export const geometryOf = (a) => ASPECTS[a] ?? ASPECTS['9:16'];
/** 开发中的风格（status 不是 stable）默认不许出片；风格负责人自测时设 PROMO_DEV_STYLES=1 */
export const devStylesAllowed = () => process.env.PROMO_DEV_STYLES === '1';

const STYLE_IDS = fs.existsSync(STYLES_SRC)
  ? fs.readdirSync(STYLES_SRC, {withFileTypes: true}).filter((d) => d.isDirectory() && !d.name.startsWith('_') && fs.existsSync(path.join(STYLES_SRC, d.name, 'style.json'))).map((d) => d.name).sort()
  : [];

const cache = new Map();
/** 每个风格的 checks.mjs 在模块加载时预先 import（validate 是同步的） */
const CHECKS = {};
for (const id of STYLE_IDS) {
  const f = path.join(STYLES_DOC, id, 'checks.mjs');
  if (fs.existsSync(f)) {
    try {
      CHECKS[id] = await import(pathToFileURL(f).href);
    } catch (e) {
      CHECKS[id] = {loadError: String(e?.message ?? e)};
    }
  }
}

export const listStyles = () => STYLE_IDS.map((id) => loadStyle(id));

export const loadStyle = (id) => {
  if (!STYLE_IDS.includes(id)) return null;
  if (cache.has(id)) return cache.get(id);
  const dir = path.join(STYLES_SRC, id);
  const manifest = readJson(path.join(dir, 'style.json'));
  const ownSpecs = {};
  const shotsDir = path.join(dir, 'shots');
  if (fs.existsSync(shotsDir))
    for (const f of fs.readdirSync(shotsDir)) {
      if (!f.endsWith('.spec.json')) continue;
      const s = readJson(path.join(shotsDir, f));
      ownSpecs[s.type] = s;
    }
  const rulesPath = path.join(STYLES_DOC, id, 'rules.json');
  const rules = fs.existsSync(rulesPath) ? readJson(rulesPath) : {};
  const tokPath = path.join(dir, 'tokens.json');
  const tokens = fs.existsSync(tokPath) ? readJson(tokPath) : {};
  const st = {id, manifest, ownSpecs, rules, tokens, checks: CHECKS[id] ?? null};
  cache.set(id, st);
  return st;
};

export const styleIds = () => [...STYLE_IDS];
export const styleIdOf = (meta) => (typeof meta?.style === 'string' && meta.style ? meta.style : DEFAULT_STYLE);

/** 这个风格能用的镜头 spec：专属镜头 + commonShots 允许的公共镜头 */
export const specsForStyle = (st, commonSpecs) => {
  if (!st) return commonSpecs;
  const cs = st.manifest.commonShots;
  const out = {};
  for (const [t, s] of Object.entries(commonSpecs)) if (cs === '*' || (Array.isArray(cs) && cs.includes(t))) out[t] = s;
  return {...out, ...st.ownSpecs};
};

/** 画幅：meta.aspect，不写用风格默认 */
export const aspectOf = (meta) => {
  const st = loadStyle(styleIdOf(meta)) ?? loadStyle(DEFAULT_STYLE);
  return typeof meta?.aspect === 'string' && ASPECTS[meta.aspect] ? meta.aspect : st?.manifest.defaultAspect ?? '9:16';
};

/** 实际节拍：meta.bpm，不写用风格默认（cards 是 120，和改造前一致） */
export const bpmOf = (meta) => (typeof meta?.bpm === 'number' && meta.bpm ? meta.bpm : loadStyle(styleIdOf(meta))?.manifest.bpm ?? 120);

// ---------------- 风格规则（styles/<id>/rules.json，声明式） ----------------
// {
//   "durationRange": [30, 50],                  总时长默认范围（meta.durationRange 仍可覆盖）
//   "shotCount": {"min": 5, "max": 14},         镜头数
//   "requiredShots": ["optionList"],            必须出现的镜头
//   "maxCount": {"meaningCard": 1},             某种镜头最多几次
//   "order": ["phraseTitle", "optionList", "meaningCard"],   这些镜头出现时必须按这个先后
//   "noAdjacentSame": true,                     同一种镜头不能连着用
//   "level": "block"                            以上规则的默认级别：block 拦截 / warn 提醒
// }
// 声明式写不了的（「陷阱项等于钩子里的误解」这类跨字段规则）写进 styles/<id>/checks.mjs：
//   export function run(storyboard, ctx) → {errors, warnings, human}，每条 {where, problem, fix}
export const runStyleRules = (sb, st, {where}) => {
  const errors = [];
  const warnings = [];
  const human = [];
  if (!st) return {errors, warnings, human};
  const R = st.rules ?? {};
  const shots = Array.isArray(sb?.shots) ? sb.shots : [];
  const types = shots.map((s) => s?.type);
  const push = (lvl, w, problem, fix) => ((lvl ?? R.level ?? 'block') === 'warn' ? warnings : errors).push({where: w, problem, fix});
  const name = st.manifest.name?.zh ?? st.id;
  if (R.shotCount) {
    const {min, max} = R.shotCount;
    if (typeof min === 'number' && shots.length < min) push(R.shotCount.level, 'shots', `「${name}」风格至少 ${min} 镜，现在 ${shots.length} 镜`, `照 styles/${st.id}/recipes.md 的结构补镜头`);
    if (typeof max === 'number' && shots.length > max) push(R.shotCount.level, 'shots', `「${name}」风格最多 ${max} 镜，现在 ${shots.length} 镜`, '删掉信息重复的镜头');
  }
  for (const t of R.requiredShots ?? []) if (!types.includes(t)) push(null, 'shots', `「${name}」风格必须有一镜 ${t}`, `照 styles/${st.id}/recipes.md 加上 ${t}`);
  for (const [t, n] of Object.entries(R.maxCount ?? {})) {
    const c = types.filter((x) => x === t).length;
    if (c > n) push(null, 'shots', `${t} 用了 ${c} 次，「${name}」风格最多 ${n} 次`, `删到 ${n} 次以内`);
  }
  if (Array.isArray(R.order) && R.order.length > 1) {
    let last = -1;
    let lastType = null;
    for (const t of R.order) {
      const i = types.indexOf(t);
      if (i < 0) continue;
      if (i < last) push(null, where(i, t, 'type'), `${t} 要放在 ${lastType} 后面`, `按 ${R.order.join(' → ')} 的顺序排`);
      else {
        last = i;
        lastType = t;
      }
    }
  }
  if (R.noAdjacentSame)
    for (let i = 1; i < types.length; i++) if (types[i] && types[i] === types[i - 1]) push('warn', where(i, types[i], 'type'), `和上一镜都是 ${types[i]}`, '中间换一种镜头');
  // 自定义检查
  const mod = st.checks;
  if (mod?.loadError) errors.push({where: `styles/${st.id}/checks.mjs`, problem: `加载失败：${mod.loadError}`, fix: '修好这个文件的语法错误'});
  else if (typeof mod?.run === 'function') {
    try {
      const r = mod.run(sb, {where, style: st}) ?? {};
      errors.push(...(r.errors ?? []));
      warnings.push(...(r.warnings ?? []));
      human.push(...(r.human ?? []));
    } catch (e) {
      errors.push({where: `styles/${st.id}/checks.mjs`, problem: `运行出错：${e?.message ?? e}`, fix: '这是风格包的 bug，不是分镜的问题；报给风格负责人'});
    }
  }
  return {errors, warnings, human};
};
