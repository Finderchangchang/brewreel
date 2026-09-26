#!/usr/bin/env node
// ============================================================
// 原创性检查：风格的配色和招牌细节是不是换成了我们自己的（蒸馏流程第 3 步「再设计」的验收）。
//
//   node scripts/check-originality.mjs --style <id> --ref <参考 tokens.json> [--signatures <招牌清单.md>]
//
// 可选参数：
//   --tokens <file>      不用 template/src/styles/<id>/tokens.json，改查这个文件
//   --record <file>      不用 styles/<id>/originality.md，改查这个文件
//   --extra <file>       额外扫一个代码/JSON 文件里的 #RRGGBB（如角色配色 art/palette.ts），可写多次
//   --primary <key> / --accent <key>   指定主题里哪个键是主色 / 强调色（也可在 tokens.json 写 "$originality"）
//   --strict             主题以外的有彩色（道具色、类别色、--extra）也按 ΔE00 ≥ 20 卡，不只是提示
//   --svg <file>         另存一张色块对照图（必须写到仓库外）
//   --json               输出 JSON（给脚本和测试用）
//
// 判定（全部用 CIEDE2000，D65）：
//   1. 有彩色：风格所有主题里 CIELCh 色度 C* ≥ 12 的颜色，与参考里每个有彩色的最小 ΔE00 必须 ≥ 20。
//   2. 背景色：主题里的背景色（bg / background / sky… 键）与参考背景色的最小 ΔE00 必须 ≥ 8。
//   3. 主色 + 强调色：不能与参考里任意两色的组合同时落在 ΔE00 < 25 以内。
//   4. 描边色：近黑近白的中性色（C* < 12）不参加第 1 条，但描边色（ink / outline / stroke…）
//      不许与参考描边色相同（ΔE00 < 1，肉眼分不出）。
//   5. 照搬：主题以外的有彩色与参考某色 ΔE00 < 3（实测误差内）= 原样照搬，失败；< 20 只提示（--strict 时失败）。
//   6. --signatures 给出时：清单里每条参考招牌元素，styles/<id>/originality.md 都要有「已替换为…」的记录。
// 失败退出码 1，参数错误退出码 2。
// 参考 tokens.json 只从命令行读，不要复制进仓库。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseColor, rgbToLab, labToLch, deltaE2000} from './lib/color.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const LIMITS = {
  /** C* 低于它算中性色（近黑 / 近白 / 灰），不参加有彩色比较 */
  chroma: 12,
  /** 主题有彩色与参考有彩色的最小色差 */
  chromatic: 20,
  /** 背景色与参考背景色的最小色差 */
  background: 8,
  /** 主色、强调色同时落进这个色差以内就算撞组合 */
  pair: 25,
  /** 描边色与参考描边色小于这个色差 = 相同 */
  outlineSame: 1,
  /** 主题以外的有彩色小于这个色差 = 原样照搬 */
  copy: 3,
  /** 半透明色（阴影、遮罩）低于这个不透明度不参加比较 */
  minAlpha: 0.6,
};

const WRAPPER_LEAF = new Set(['hex', 'value', 'color', 'css', 'rgb', 'rgba']);
// 卡片、纸张这类白色面板不算背景（几乎每个色板都有近白面板，比它没意义）；别的键名要算背景就在 $originality.background 里声明
const BG_WORDS = ['bg', 'background', 'backdrop', 'sky'];
const OUTLINE_EXACT = new Set(['outline', 'stroke', 'ink', 'line', 'border', 'outlinecolor', 'strokecolor', 'linecolor', 'inkline']);
const PRIMARY_KEYS = ['primary', 'brand', 'main', 'brandColor', 'primaryColor'];
const ACCENT_KEYS = ['accent', 'highlight', 'secondary', 'pop', 'hot', 'accentColor', 'highlightColor'];

// ---------------- 取色 ----------------

/** 以某个词开头、后面不再接小写字母（skyDay、bg_cream、sky0 算；skyline 不算） */
const startsWord = (leaf, words) =>
  words.some((w) => leaf.toLowerCase().startsWith(w) && (leaf.length === w.length || !/[a-z]/.test(leaf[w.length])));

export const isBackgroundKey = (leaf) => startsWord(leaf, BG_WORDS);
export const isOutlineKey = (leaf) => OUTLINE_EXACT.has(leaf.toLowerCase()) || /(Outline|Stroke|Border)$|_(outline|stroke|border)$/.test(leaf);

const leafOf = (segs) => {
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = String(segs[i]);
    if (/^\d+$/.test(s) || WRAPPER_LEAF.has(s.toLowerCase())) continue;
    return s;
  }
  return '';
};
const pathOf = (segs) => segs.map((s) => (/^\d+$/.test(String(s)) ? `[${s}]` : `.${s}`)).join('').replace(/^\./, '');

const makeEntry = (segs, c, extra = {}) => {
  const lab = rgbToLab(c.r, c.g, c.b);
  return {path: pathOf(segs), leaf: leafOf(segs), hex: c.hex, alpha: c.a, lab, C: labToLch(lab)[1], ...extra};
};

/**
 * 递归收集 JSON 里「整个值就是颜色」的字符串。$ 开头的键（$doc 说明、$originality 配置）跳过。
 * @returns {{path:string, leaf:string, hex:string, alpha:number, lab:number[], C:number}[]}
 */
export function collectColors(node, segs = [], out = []) {
  if (typeof node === 'string') {
    const c = parseColor(node);
    if (c && c.a >= LIMITS.minAlpha) out.push(makeEntry(segs, c));
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => collectColors(v, [...segs, i], out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      collectColors(v, [...segs, k], out);
    }
  }
  return out;
}

/** 从代码 / 文本里扫 #RRGGBB（--extra 用）；同一行有 `key: '#…'` 时拿 key 当名字 */
export function collectColorsFromText(text, label) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const re = /(?:([A-Za-z_$][\w$]*)\s*[:=]\s*)?['"`](#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)['"`]/g;
    let m;
    while ((m = re.exec(line))) {
      const c = parseColor(m[2]);
      if (!c || c.a < LIMITS.minAlpha) continue;
      const key = m[1] ?? '';
      out.push(makeEntry([], c, {path: `${label}:${i + 1}${key ? ' ' + key : ''}`, leaf: key}));
    }
  });
  return out;
}

/**
 * 把风格令牌拆成「主题」和「主题以外」两部分。
 * - 有 themes 对象：每个键一个主题（quiz / journey / 新风格的 tokens.json）
 * - 没有 themes、顶层全是对象：顶层每个键一个主题（cards 的 core/themes.json）
 * - 都不是：整份文件当一个主题
 */
export function splitStyleTokens(json) {
  const themes = [];
  let others = [];
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (isObj(json?.themes)) {
    for (const [name, t] of Object.entries(json.themes)) {
      if (name.startsWith('$')) continue;
      themes.push({name, colors: collectColors(t, ['themes', name])});
    }
    const rest = {...json};
    delete rest.themes;
    others = collectColors(rest);
  } else if (isObj(json) && Object.entries(json).filter(([k]) => !k.startsWith('$')).every(([, v]) => isObj(v))) {
    for (const [name, t] of Object.entries(json)) {
      if (name.startsWith('$')) continue;
      themes.push({name, colors: collectColors(t, [name])});
    }
  } else {
    themes.push({name: '(整份文件)', colors: collectColors(json)});
  }
  return {themes, others};
}

const dedupe = (list) => {
  const seen = new Map();
  for (const c of list) if (!seen.has(c.hex)) seen.set(c.hex, {...c, paths: [c.path]});
  else seen.get(c.hex).paths.push(c.path);
  return [...seen.values()];
};

const nearest = (c, pool) => {
  let best = null;
  for (const r of pool) {
    const d = deltaE2000(c.lab, r.lab);
    if (!best || d < best.dE) best = {ref: r, dE: d};
  }
  return best;
};

// 两位小数：离门槛很近时（如 7.97 对 8）也不会显示成「8 却失败」
const r1 = (x) => Math.round(x * 100) / 100;

// ---------------- 改色建议（--suggest） ----------------

let GRID = null;
/** sRGB 每通道 23 级（0, 12, 24 … 252, 255）的候选色，约 1.2 万个 */
const grid = () => {
  if (GRID) return GRID;
  const levels = [];
  for (let v = 0; v <= 252; v += 12) levels.push(v);
  levels.push(255);
  GRID = [];
  for (const r of levels)
    for (const g of levels)
      for (const b of levels) {
        const lab = rgbToLab(r, g, b);
        GRID.push({hex: '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(), lab, C: labToLch(lab)[1]});
      }
  return GRID;
};

const minDE = (lab, pool) => pool.reduce((m, r) => Math.min(m, deltaE2000(lab, r.lab)), Infinity);

/** 候选池：每个候选色离参考有彩色、参考背景色、参考全部颜色各有多远（一份参考只算一次） */
export const suggestionPool = (refChromatic, refBg, refAll = refChromatic) =>
  grid().map((g) => ({...g, minChrom: minDE(g.lab, refChromatic), minBg: minDE(g.lab, refBg), minAll: minDE(g.lab, refAll)}));

/**
 * 给一个没过的颜色找「离原色最近、又能过线」的候选（留 1 的余量）。
 * 有彩色候选要离参考所有有彩色 ≥ 21；原色本来就不太鲜（C* < 25，如墨色、肤色、浅底）时也可以退成中性色，
 * 但中性候选要离参考的每个颜色（含中性色）都 ≥ 9，不能只是把参考色去饱和一点。
 * @param {{lab:number[], C:number}} c 原色
 * @param {object[]} pool suggestionPool() 的结果
 * @param {{needBg?:boolean, allowNeutral?:boolean}} [o] needBg：它也是背景色（还要离参考背景 ≥ 9）
 */
export function suggestColor(c, pool, {needBg = false, allowNeutral = c.C < 25} = {}) {
  let best = null;
  for (const g of pool) {
    if (g.C >= LIMITS.chroma ? g.minChrom < LIMITS.chromatic + 1 : !allowNeutral || g.minAll < LIMITS.background + 1) continue;
    if (needBg && g.minBg < LIMITS.background + 1) continue;
    const d = deltaE2000(c.lab, g.lab);
    if (!best || d < best.dE) best = {hex: g.hex, dE: d};
  }
  return best && {hex: best.hex, fromOriginal: r1(best.dE)};
}

// ---------------- 判定 ----------------

/**
 * @param {object} styleTokens 风格 tokens.json（已解析）
 * @param {object} refTokens 参考 tokens.json（已解析）
 * @param {object} [opt]
 * @param {{path:string, colors:object[]}[]} [opt.extra] --extra 扫出来的颜色
 * @param {string} [opt.primary] 主色键名
 * @param {string} [opt.accent] 强调色键名
 * @param {boolean} [opt.strict]
 */
export function checkPalette(styleTokens, refTokens, opt = {}) {
  const refJson = {...refTokens};
  delete refJson.meta; // 参考 tokens 的 meta 只是说明
  const refAll = collectColors(refJson);
  const refChromatic = dedupe(refAll.filter((c) => c.C >= LIMITS.chroma));
  const refBg = dedupe(refAll.filter((c) => isBackgroundKey(c.leaf)));
  const refOutline = dedupe(refAll.filter((c) => isOutlineKey(c.leaf)));

  const cfg = styleTokens?.$originality ?? {};
  const primaryKey = opt.primary ?? cfg.primary;
  const accentKey = opt.accent ?? cfg.accent;
  const bgExtra = new Set([].concat(cfg.background ?? []));
  const outlineExtra = new Set([].concat(cfg.outline ?? []));
  const isBg = (c) => isBackgroundKey(c.leaf) || bgExtra.has(c.leaf);
  const isOutline = (c) => isOutlineKey(c.leaf) || outlineExtra.has(c.leaf);

  const {themes, others} = splitStyleTokens(styleTokens);
  const extraColors = (opt.extra ?? []).flatMap((e) => e.colors);
  const outside = [...others, ...extraColors];

  let poolCache = null;
  const pool = () => (poolCache ??= suggestionPool(refChromatic, refBg, dedupe(refAll)));
  const failures = [];
  const warnings = [];
  const fail = (rule, msg, fix) => failures.push({rule, msg, fix});
  const warn = (rule, msg) => warnings.push({rule, msg});

  if (!refChromatic.length) warn('ref', '参考 tokens.json 里没找到有彩色（C* ≥ 12），第 1、3、5 条无从比较');

  // 1. 主题有彩色
  const chromatic = [];
  for (const t of themes) {
    for (const c of t.colors) {
      if (c.C < LIMITS.chroma) continue;
      const n = nearest(c, refChromatic);
      const row = {theme: t.name, path: c.path, hex: c.hex, C: r1(c.C), nearest: n ? {hex: n.ref.hex, path: n.ref.path} : null, dE: n ? r1(n.dE) : null};
      row.ok = !n || n.dE >= LIMITS.chromatic;
      if (!row.ok && opt.suggest) row.suggest = suggestColor(c, pool(), {needBg: isBg(c) && refBg.length > 0});
      chromatic.push(row);
      if (!row.ok)
        fail('chromatic', `${c.path} ${c.hex} 离参考色 ${n.ref.hex}（${n.ref.path}）只有 ΔE00 ${row.dE}，要 ≥ ${LIMITS.chromatic}`, '换色相，或把明度 / 饱和度拉开一大截；只微调几个色值不够');
    }
  }

  // 2. 背景色
  const background = [];
  const styleBg = themes.flatMap((t) => t.colors.filter(isBg).map((c) => ({...c, theme: t.name})));
  if (!styleBg.length) warn('background', '主题里没找到背景色键（bg / background / sky…），第 2 条跳过；键名不同时在 tokens.json 的 "$originality": {"background": [键名]} 里声明');
  if (!refBg.length) warn('background', '参考 tokens.json 里没找到背景色键（bg / background / sky…），第 2 条跳过');
  if (styleBg.length && refBg.length) {
    for (const c of styleBg) {
      const n = nearest(c, refBg);
      const row = {theme: c.theme, path: c.path, hex: c.hex, nearest: {hex: n.ref.hex, path: n.ref.path}, dE: r1(n.dE), ok: n.dE >= LIMITS.background};
      if (!row.ok && opt.suggest) row.suggest = suggestColor(c, pool(), {needBg: true});
      background.push(row);
      if (!row.ok)
        fail('background', `${c.path} ${c.hex} 和参考背景 ${n.ref.hex}（${n.ref.path}）只差 ΔE00 ${row.dE}，要 ≥ ${LIMITS.background}`, '换底色的冷暖或明度（暖米白 → 冷灰白 / 浅薄荷 / 纸黄 / 深色底），不要只动一两个色值');
    }
  }

  // 3. 主色 + 强调色组合
  const pairs = [];
  for (const t of themes) {
    const pick = (explicit, keys) => {
      const names = explicit ? [explicit] : keys;
      for (const k of names) {
        const c = t.colors.find((x) => x.leaf === k);
        if (c) return c;
      }
      return null;
    };
    const P = pick(primaryKey, PRIMARY_KEYS);
    const A = pick(accentKey, ACCENT_KEYS);
    if (!P || !A) {
      warn('pair', `主题 ${t.name} 缺${!P ? '主色' : ''}${!P && !A ? '和' : ''}${!A ? '强调色' : ''}键（主色认 ${PRIMARY_KEYS.join('/')}，强调色认 ${ACCENT_KEYS.join('/')}），组合检查跳过；键名不同时用 --primary/--accent 或 "$originality": {"primary": 键名, "accent": 键名}`);
      continue;
    }
    if (P.C < LIMITS.chroma || A.C < LIMITS.chroma) {
      pairs.push({theme: t.name, primary: P.hex, accent: A.hex, ok: true, note: '主色或强调色是中性色，不构成配色组合'});
      continue;
    }
    let best = null;
    for (const x of refChromatic) {
      const dx = deltaE2000(P.lab, x.lab);
      if (dx >= LIMITS.pair) continue;
      for (const y of refChromatic) {
        if (y.hex === x.hex) continue;
        const dy = deltaE2000(A.lab, y.lab);
        if (dy >= LIMITS.pair) continue;
        const score = Math.max(dx, dy);
        if (!best || score < best.score) best = {x, y, dx, dy, score};
      }
    }
    const row = {theme: t.name, primary: P.hex, primaryPath: P.path, accent: A.hex, accentPath: A.path, ok: !best};
    if (best) Object.assign(row, {refPrimary: best.x.hex, refAccent: best.y.hex, dePrimary: r1(best.dx), deAccent: r1(best.dy)});
    pairs.push(row);
    if (best)
      fail('pair', `主题 ${t.name}：主色 ${P.hex} ≈ 参考 ${best.x.hex}（ΔE00 ${r1(best.dx)}），强调色 ${A.hex} ≈ 参考 ${best.y.hex}（ΔE00 ${r1(best.dy)}），两个都 < ${LIMITS.pair}，是同一组搭配`, '主色和强调色至少换掉一个的色相，让它离参考的所有颜色都 ≥ 25');
  }

  // 4. 描边色
  const outline = [];
  const styleOutline = [...themes.flatMap((t) => t.colors), ...outside].filter(isOutline);
  if (!styleOutline.length) warn('outline', '没找到描边色键（ink / outline / stroke / line…），第 4 条跳过');
  if (!refOutline.length) warn('outline', '参考 tokens.json 里没找到描边色键（ink / outline / stroke…），第 4 条跳过');
  if (styleOutline.length && refOutline.length) {
    for (const c of styleOutline) {
      const n = nearest(c, refOutline);
      const row = {path: c.path, hex: c.hex, nearest: {hex: n.ref.hex, path: n.ref.path}, dE: r1(n.dE), ok: n.dE >= LIMITS.outlineSame};
      outline.push(row);
      if (!row.ok)
        fail('outline', `${c.path} ${c.hex} 和参考描边色 ${n.ref.hex}（${n.ref.path}）相同（ΔE00 ${r1(n.dE)}）`, '描边换成自己的深色：纯黑、带自己色相倾向的深色（深墨绿 / 深酒红 / 深靛），或加粗减细改变描边手法');
    }
  }

  // 5. 主题以外的有彩色：照搬检查
  const outsideRows = [];
  for (const c of outside) {
    if (c.C < LIMITS.chroma) continue;
    const n = nearest(c, refChromatic);
    if (!n) continue;
    const row = {path: c.path, hex: c.hex, C: r1(c.C), nearest: {hex: n.ref.hex, path: n.ref.path}, dE: r1(n.dE)};
    const limit = opt.strict ? LIMITS.chromatic : LIMITS.copy;
    row.ok = n.dE >= limit;
    row.level = n.dE < LIMITS.copy ? 'copy' : n.dE < LIMITS.chromatic ? 'near' : 'ok';
    outsideRows.push(row);
    if (n.dE < LIMITS.copy) fail('copy', `${c.path} ${c.hex} 就是参考色 ${n.ref.hex}（${n.ref.path}，ΔE00 ${row.dE}），原样照搬`, '道具 / 类别 / 角色配色也要自己定，不要抄参考的实测色');
    else if (!row.ok) fail('near', `${c.path} ${c.hex} 离参考色 ${n.ref.hex} 只有 ΔE00 ${row.dE}（--strict 要 ≥ ${LIMITS.chromatic}）`, '换色相或拉开明度');
  }
  const nearCount = outsideRows.filter((r) => r.level === 'near').length;
  if (nearCount && !opt.strict) warn('near', `主题以外有 ${nearCount} 个有彩色离参考色 ΔE00 < ${LIMITS.chromatic}（不算失败，--strict 时算）；成组出现时仍会让人觉得像`);

  // 6. 中性色原样照搬（纯白纯黑除外）：只提示
  const refNeutralHex = new Set(refAll.filter((c) => c.C < LIMITS.chroma).map((c) => c.hex));
  const neutralCopies = [...themes.flatMap((t) => t.colors), ...outside]
    .filter((c) => c.C < LIMITS.chroma && refNeutralHex.has(c.hex) && !['#FFFFFF', '#000000'].includes(c.hex) && !isOutline(c))
    .map((c) => ({path: c.path, hex: c.hex}));
  if (neutralCopies.length) warn('neutral', `${neutralCopies.length} 个中性色和参考片的实测色值一模一样：${neutralCopies.map((c) => `${c.path} ${c.hex}`).join('，')}（不算失败，建议顺手换掉）`);

  return {
    ok: failures.length === 0,
    ref: {colors: refAll.length, chromatic: refChromatic.length, background: refBg.map((c) => c.hex), outline: refOutline.map((c) => c.hex)},
    themes: themes.map((t) => t.name),
    chromatic,
    background,
    pairs,
    outline,
    outside: outsideRows,
    neutralCopies,
    failures,
    warnings,
  };
}

// ---------------- 招牌元素 ----------------

const SIG_HEADING = /招牌|必须避开|品牌资产|signature|avoid/i;
const PLACEHOLDER = /^(?:…+|\.{2,}|_+|-+|—+|<[^>]*>|（[^）]*）|\([^)]*\)|todo|tbd|待填|待定|x{2,}|\?+|？+)$/i;
const MARKERS = ['已替换为', '已删除', 'replaced with', 'removed'];

/**
 * 读招牌清单：列表项一条一个元素。文件里有「招牌 / 必须避开 / 品牌资产 / signature / avoid」标题时，只读这些标题下的列表。
 * 编号：写了 [S1] 或 `S1：` 就用它，否则按出现顺序编 S1、S2…
 * @returns {{id:string, text:string}[]}
 */
export function parseSignatures(md) {
  const lines = md.split(/\r?\n/);
  const heads = lines.map((l) => l.match(/^(#{1,6})\s+(.*)$/)).filter(Boolean);
  const keyLevels = heads.filter((h) => SIG_HEADING.test(h[2])).map((h) => h[1].length);
  // 二级以下有匹配的标题时，一级标题（文件名式的大标题）不算范围
  const minLevel = keyLevels.some((l) => l >= 2) ? 2 : 1;
  const useSections = keyLevels.some((l) => l >= minLevel);
  const stack = []; // stack[level] = 该级标题是否匹配
  const items = [];
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lv = h[1].length;
      stack.length = lv;
      stack[lv] = lv >= minLevel && SIG_HEADING.test(h[2]);
      continue;
    }
    if (useSections && !stack.some(Boolean)) continue;
    const m = line.match(/^( ?)(?:[-*+]|\d+[.)、])\s+(.+)$/);
    if (!m) continue;
    let text = m[2].trim();
    let id = null;
    const idm = text.match(/^\[([A-Za-z]{1,3}\d{1,3})\]\s*|^([A-Za-z]{1,3}\d{1,3})\s*[:：.、)）]\s*/);
    if (idm) {
      id = (idm[1] ?? idm[2]).toUpperCase();
      text = text.slice(idm[0].length).trim();
    }
    items.push({id, text});
  }
  // 没写编号的按列表位置编（第几条就是 S 几），和手写编号混用时也不会错位
  return items.map((it, i) => ({id: it.id ?? `S${i + 1}`, text: it.text}));
}

/**
 * 在 originality.md 里找每条招牌的「已替换为…」记录：同一行要有编号（如 S3）和「已替换为」+ 实际内容。
 * @returns {{id:string, text:string, ok:boolean, record?:string, problem?:string}[]}
 */
export function checkSignatureRecords(sigs, recordText) {
  const lines = (recordText ?? '').split(/\r?\n/);
  return sigs.map((s) => {
    const idRe = new RegExp(`(?<![A-Za-z0-9])${s.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9])`, 'i');
    const hits = lines.filter((l) => idRe.test(l));
    if (!hits.length) return {...s, ok: false, problem: `originality.md 里没有 ${s.id} 这一条`};
    for (const l of hits) {
      const lower = l.toLowerCase();
      for (const mk of MARKERS) {
        const at = lower.indexOf(mk);
        if (at < 0) continue;
        const after = l
          .slice(at + mk.length)
          .replace(/\|/g, ' ')
          .replace(/[*`]/g, '')
          .replace(/^[\s:：，,]+/, '')
          .trim();
        if (mk === '已删除' || mk === 'removed') {
          // 「已删除（不用这个元素）」本身就是记录，后面补一句原因更好，但不强制
          return {...s, ok: true, record: l.trim()};
        }
        if (after.length >= 2 && !PLACEHOLDER.test(after)) return {...s, ok: true, record: l.trim()};
      }
    }
    return {...s, ok: false, problem: `${s.id} 有这一行，但没写「已替换为：<我们的做法>」（或还是占位符）`};
  });
}

// ---------------- 色块对照图 ----------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderSvg(result, title) {
  const W = 1280;
  const RH = 40;
  const rows = [];
  const section = (name, list, fmt) => {
    if (!list.length) return;
    rows.push({head: name});
    for (const r of list) rows.push(fmt(r));
  };
  section(`1 有彩色（主题内，要求 ΔE00 ≥ ${LIMITS.chromatic}）`, result.chromatic, (r) => ({a: r.hex, b: r.nearest?.hex, label: r.path, refLabel: r.nearest?.path ?? '', dE: r.dE, ok: r.ok}));
  section(`2 背景色（要求 ≥ ${LIMITS.background}）`, result.background, (r) => ({a: r.hex, b: r.nearest.hex, label: r.path, refLabel: r.nearest.path, dE: r.dE, ok: r.ok}));
  section(`3 主色 + 强调色（不能同时 < ${LIMITS.pair}）`, result.pairs.filter((p) => p.refPrimary || p.ok), (r) => ({a: r.primary, a2: r.accent, b: r.refPrimary, b2: r.refAccent, label: `${r.theme} 主色 + 强调色`, refLabel: r.refPrimary ? '参考里的一组' : '', dE: r.refPrimary ? `${r.dePrimary} / ${r.deAccent}` : '—', ok: r.ok}));
  section(`4 描边色（不能与参考相同）`, result.outline, (r) => ({a: r.hex, b: r.nearest.hex, label: r.path, refLabel: r.nearest.path, dE: r.dE, ok: r.ok}));
  // 第 5 节只画失败的（照搬 / --strict），偏近的只记个数，免得图拉得太长
  const nearOnly = result.outside.filter((r) => r.level === 'near' && r.ok).length;
  section(`5 主题以外的有彩色（< ${LIMITS.copy} 算照搬${nearOnly ? `；另有 ${nearOnly} 个 < ${LIMITS.chromatic} 的偏近色没画，见文字输出` : ''}）`, result.outside.filter((r) => !r.ok), (r) => ({a: r.hex, b: r.nearest.hex, label: r.path, refLabel: r.nearest.path, dE: r.dE, ok: r.ok}));
  const H = 110 + rows.length * RH + 20;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Microsoft YaHei UI, PingFang SC, Noto Sans SC, sans-serif">`);
  out.push(`<rect width="${W}" height="${H}" fill="#FAFAF7"/>`);
  out.push(`<text x="24" y="44" font-size="26" font-weight="700" fill="#111">${esc(title)}</text>`);
  const verdict = result.ok ? '通过' : `未通过（${result.failures.length} 项）`;
  out.push(`<text x="24" y="80" font-size="18" fill="${result.ok ? '#1B7F3B' : '#B3261E'}">${esc(verdict)}　左：我们的颜色　右：最近的参考色</text>`);
  let y = 110;
  const sw = (x, hex, w = 60) => (hex ? `<rect x="${x}" y="${y + 6}" width="${w}" height="${RH - 12}" rx="6" fill="${hex}" stroke="#0002"/>` : '');
  for (const r of rows) {
    if (r.head) {
      out.push(`<text x="24" y="${y + 28}" font-size="18" font-weight="700" fill="#333">${esc(r.head)}</text>`);
      y += RH;
      continue;
    }
    const color = r.ok ? (r.soft ? '#9A6700' : '#1B7F3B') : '#B3261E';
    out.push(`<text x="24" y="${y + 26}" font-size="15" font-weight="700" fill="${color}">${r.ok ? (r.soft ? 'WARN' : 'OK') : 'FAIL'}</text>`);
    out.push(sw(80, r.a, r.a2 ? 30 : 60));
    if (r.a2) out.push(sw(112, r.a2, 30));
    out.push(`<text x="152" y="${y + 26}" font-size="15" fill="#222">${esc(`${r.a}${r.a2 ? ' + ' + r.a2 : ''}  ${r.label}`)}</text>`);
    out.push(`<text x="700" y="${y + 26}" font-size="15" fill="#222">ΔE00 ${esc(r.dE ?? '—')}</text>`);
    if (r.b) {
      const bx = 820;
      out.push(sw(bx, r.b, r.b2 ? 30 : 60));
      if (r.b2) out.push(sw(bx + 32, r.b2, 30));
      out.push(`<text x="${bx + 72}" y="${y + 26}" font-size="15" fill="#555">${esc(`${r.b}${r.b2 ? ' + ' + r.b2 : ''}  ${r.refLabel}`)}</text>`);
    }
    y += RH;
  }
  out.push('</svg>');
  return out.join('\n');
}

// ---------------- 命令行 ----------------

function parseArgs(argv) {
  const o = {extra: []};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} 后面要跟一个值`);
      return v;
    };
    if (a === '--style') o.style = next();
    else if (a === '--ref') o.ref = next();
    else if (a === '--signatures') o.signatures = next();
    else if (a === '--tokens') o.tokens = next();
    else if (a === '--record') o.record = next();
    else if (a === '--extra') o.extra.push(next());
    else if (a === '--primary') o.primary = next();
    else if (a === '--accent') o.accent = next();
    else if (a === '--svg') o.svg = next();
    else if (a === '--strict') o.strict = true;
    else if (a === '--suggest') o.suggest = true;
    else if (a === '--verbose') o.verbose = true;
    else if (a === '--json') o.json = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error(`不认识的参数 ${a}`);
  }
  return o;
}

const USAGE = `用法：node scripts/check-originality.mjs --style <id> --ref <参考 tokens.json> [--signatures <招牌清单.md>]
  可选：--tokens <file> --record <file> --extra <file>（可多次） --primary <键> --accent <键>
        --strict --suggest（给没过的颜色找最近的可用色） --verbose --svg <仓库外.svg> --json`;

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const rel = (p) => {
  const r = path.relative(ROOT, p);
  return r.startsWith('..') || path.isAbsolute(r) ? path.basename(p) : r.split(path.sep).join('/');
};
const insideRepo = (p) => {
  const r = path.relative(ROOT, path.resolve(p));
  return !r.startsWith('..') && !path.isAbsolute(r);
};

export function run(argv) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    console.error(e.message + '\n' + USAGE);
    return 2;
  }
  if (o.help) {
    console.log(USAGE);
    return 0;
  }
  if (!o.style || !o.ref) {
    console.error(USAGE);
    return 2;
  }
  let tokensPath = o.tokens ? path.resolve(o.tokens) : path.join(ROOT, 'template', 'src', 'styles', o.style, 'tokens.json');
  if (!o.tokens && !fs.existsSync(tokensPath) && o.style === 'cards') tokensPath = path.join(ROOT, 'template', 'src', 'core', 'themes.json');
  const recordPath = o.record ? path.resolve(o.record) : path.join(ROOT, 'styles', o.style, 'originality.md');
  for (const [label, p] of [['风格令牌', tokensPath], ['参考 tokens.json', path.resolve(o.ref)], ...(o.signatures ? [['招牌清单', path.resolve(o.signatures)]] : []), ...o.extra.map((e) => ['--extra', path.resolve(e)])]) {
    if (!fs.existsSync(p)) {
      console.error(`找不到${label}：${p}`);
      return 2;
    }
  }
  if (o.svg && insideRepo(o.svg)) {
    console.error('--svg 要写到仓库外（测试产物不进仓库）');
    return 2;
  }
  let styleTokens;
  let refTokens;
  try {
    styleTokens = readJson(tokensPath);
    refTokens = readJson(path.resolve(o.ref));
  } catch (e) {
    console.error(`JSON 读不了：${e.message}`);
    return 2;
  }
  const extra = o.extra.map((e) => {
    const p = path.resolve(e);
    return {path: p, colors: collectColorsFromText(fs.readFileSync(p, 'utf8'), rel(p))};
  });
  const result = checkPalette(styleTokens, refTokens, {extra, primary: o.primary, accent: o.accent, strict: o.strict, suggest: o.suggest});

  // 招牌记录
  let signatures = null;
  if (o.signatures) {
    const sigs = parseSignatures(fs.readFileSync(path.resolve(o.signatures), 'utf8'));
    if (!sigs.length) {
      result.warnings.push({rule: 'signatures', msg: '招牌清单里没读到列表项（每条写成 "- [S1] 描述"）'});
      signatures = [];
    } else if (!fs.existsSync(recordPath)) {
      signatures = sigs.map((s) => ({...s, ok: false, problem: '缺少记录文件'}));
      result.failures.push({rule: 'signatures', msg: `缺少 ${rel(recordPath)}`, fix: '从 styles/_template/originality.md 复制一份，按招牌清单编号逐条写「已替换为：…」'});
    } else {
      signatures = checkSignatureRecords(sigs, fs.readFileSync(recordPath, 'utf8'));
      for (const s of signatures.filter((x) => !x.ok))
        result.failures.push({rule: 'signatures', msg: `${s.id}「${s.text}」：${s.problem}`, fix: `在 ${rel(recordPath)} 的招牌表里写一行：| ${s.id} | <抽象描述> | 已替换为：<我们的做法> |`});
    }
  }
  result.signatures = signatures;
  result.ok = result.failures.length === 0;

  const title = `原创性检查：${o.style}（对照 ${path.basename(path.dirname(path.resolve(o.ref)))}/${path.basename(o.ref)}）`;
  if (o.svg) {
    fs.mkdirSync(path.dirname(path.resolve(o.svg)), {recursive: true});
    fs.writeFileSync(path.resolve(o.svg), renderSvg(result, title), 'utf8');
  }
  if (o.json) {
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  const L = [];
  L.push(title);
  L.push(`风格令牌：${rel(tokensPath)}；主题：${result.themes.join('、')}`);
  L.push(`参考色板：${result.ref.colors} 个颜色，有彩色 ${result.ref.chromatic} 个；背景 ${result.ref.background.join(' ') || '无'}；描边 ${result.ref.outline.join(' ') || '无'}`);
  const mark = (ok) => (ok ? 'ok  ' : 'FAIL');
  const sug = (r) => (r.suggest ? `  → 可改 ${r.suggest.hex}（离原色 ΔE00 ${r.suggest.fromOriginal}）` : '');
  const none = (list, why = '（无）') => {
    if (!list.length) L.push(`  ${why}`);
  };
  L.push('');
  L.push(`[1] 主题有彩色（C* ≥ ${LIMITS.chroma}）与参考有彩色的最小 ΔE00 ≥ ${LIMITS.chromatic}`);
  for (const r of result.chromatic) L.push(`  ${mark(r.ok)} ${r.path.padEnd(34)} ${r.hex}  C*=${String(r.C).padEnd(5)} 最近参考 ${r.nearest?.hex ?? '—'} ${r.nearest ? '(' + r.nearest.path + ')' : ''}  ΔE00=${r.dE ?? '—'}${sug(r)}`);
  none(result.chromatic, '（主题里没有有彩色）');
  L.push(`[2] 背景色与参考背景色 ΔE00 ≥ ${LIMITS.background}`);
  for (const r of result.background) L.push(`  ${mark(r.ok)} ${r.path.padEnd(34)} ${r.hex}  最近参考背景 ${r.nearest.hex} (${r.nearest.path})  ΔE00=${r.dE}${sug(r)}`);
  none(result.background, '（跳过，见提示）');
  L.push(`[3] 主色 + 强调色不能同时落在参考某两色的 ΔE00 < ${LIMITS.pair} 以内`);
  for (const r of result.pairs)
    L.push(`  ${mark(r.ok)} ${r.theme}: 主色 ${r.primary} + 强调色 ${r.accent}${r.refPrimary ? `  ≈ 参考 ${r.refPrimary} + ${r.refAccent}（ΔE00 ${r.dePrimary} / ${r.deAccent}）` : r.note ? '  ' + r.note : '  没有撞上参考的任何一组'}`);
  none(result.pairs, '（跳过，见提示）');
  L.push(`[4] 描边色不许与参考描边色相同（ΔE00 < ${LIMITS.outlineSame}）`);
  for (const r of result.outline) L.push(`  ${mark(r.ok)} ${r.path.padEnd(34)} ${r.hex}  参考描边 ${r.nearest.hex} (${r.nearest.path})  ΔE00=${r.dE}`);
  none(result.outline, '（跳过，见提示）');
  const bad = result.outside.filter((r) => r.level !== 'ok');
  L.push(`[5] 主题以外的有彩色：ΔE00 < ${LIMITS.copy} 算照搬（失败），< ${LIMITS.chromatic} 提示${o.strict ? '（--strict：也算失败）' : ''}；共 ${result.outside.length} 个，${bad.length} 个偏近`);
  // 失败的全列；只是偏近的默认列前 12 个（--verbose 全列）
  const shownNear = o.verbose || o.strict ? Infinity : 12;
  let nearShown = 0;
  for (const r of bad) {
    const isFail = r.level === 'copy' || o.strict;
    if (!isFail && nearShown++ >= shownNear) continue;
    L.push(`  ${isFail ? 'FAIL' : 'near'} ${r.path.padEnd(34)} ${r.hex}  最近参考 ${r.nearest.hex} (${r.nearest.path})  ΔE00=${r.dE}`);
  }
  if (nearShown > shownNear) L.push(`  …另有 ${nearShown - shownNear} 个偏近的没列出（加 --verbose 全列）`);
  if (signatures) {
    L.push(`[6] 招牌元素记录（${rel(recordPath)}）`);
    for (const s of signatures) L.push(`  ${mark(s.ok)} ${s.id} ${s.text}${s.ok ? '' : '  ← ' + s.problem}`);
  }
  if (result.warnings.length) {
    L.push('');
    L.push('提示：');
    for (const w of result.warnings) L.push(`  - ${w.msg}`);
  }
  L.push('');
  if (result.ok) L.push('结论：通过');
  else {
    L.push(`结论：未通过（${result.failures.length} 项）`);
    const byRule = new Map();
    for (const f of result.failures) if (!byRule.has(f.rule)) byRule.set(f.rule, f.fix);
    L.push('怎么改：');
    for (const [rule, fix] of byRule) L.push(`  - [${rule}] ${fix}`);
  }
  if (o.svg) L.push(`色块对照图：${path.resolve(o.svg)}`);
  console.log(L.join('\n'));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = run(process.argv.slice(2));
}
