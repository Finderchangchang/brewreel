// ============================================================
// 出片前的机器自查（make.mjs 用，不靠模型自评；结果写进 report.txt）。
//   machineCheck：反斜杠残留、片尾产品名 / 获取方式、字幕最长停留、片尾图标光圈 vs 免责胶囊
//   reportTextWrap：模拟换行，报出会断词的行（!，提醒）/ 明显超宽的行（✗）
// 这里的 ✗ 和渲染后的「布局自查」✗ 一样：有就不交付。
// ============================================================
import {CAPTION, captionSegments} from '../validate.mjs';

export const machineCheck = (sb0, r) => {
  const lines = [];
  const ok = (cond, good, bad) => lines.push(cond ? `  ✓ ${good}` : `  ✗ ${bad}`);
  // 画面文字里的反斜杠（字面 \n 等转义残留）
  const bs = [];
  const walk = (v, w) => {
    if (typeof v === 'string') {
      if (/\\/.test(v) && !/(^|\.)(src|logo|bgm)$/.test(w)) bs.push(`${w}「${v.slice(0, 16)}」`);
    } else if (Array.isArray(v)) v.forEach((x, k) => walk(x, `${w}[${k}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'note') walk(x, w ? `${w}.${k}` : k);
  };
  walk(sb0, '');
  ok(!bs.length, '画面文字里没有反斜杠（封面没有字面 \\n）', `画面文字里有反斜杠：${bs.join('；')}`);
  // 产品名 / CTA 一致
  const end = (sb0.shots ?? []).find((s) => s.type === 'endCard');
  if (end) {
    ok(end.params?.brand === sb0.meta?.product, `片尾产品名 = meta.product（${sb0.meta?.product}）`, `片尾产品名「${end.params?.brand}」≠ meta.product「${sb0.meta?.product}」`);
    ok((end.params?.cta ?? '') === (sb0.meta?.cta ?? ''), end.params?.cta ? `片尾获取方式 = meta.cta（${sb0.meta.cta}）` : '片尾没放获取方式（简报没给）', `片尾 cta「${end.params?.cta ?? ''}」≠ meta.cta「${sb0.meta?.cta ?? ''}」`);
  }
  // 字幕最长停留
  let longest = {d: 0, text: ''};
  r.slots.forEach((s, i) => {
    const c = sb0.shots[i]?.caption;
    const caps = Array.isArray(c) ? c : typeof c === 'string' ? [c] : [];
    captionSegments(s.start, s.dur, Math.max(1, caps.length), r.beat).forEach(([a, b], k) => {
      if (caps[k] && b - a > longest.d) longest = {d: b - a, text: caps[k]};
    });
  });
  ok(longest.d <= CAPTION.maxHold + 1e-6, `单句字幕最长停 ${longest.d.toFixed(1)} 秒（≤${CAPTION.maxHold}）`, `「${longest.text.replace(/\n/g, '⏎')}」停 ${longest.d.toFixed(1)} 秒`);
  // 片尾图标光圈 vs 免责胶囊（几何常量与 core/safe.ts DISCLAIMER_Y、shots/endCard.tsx 一致）
  if (end && sb0.meta?.disclaimer) {
    const discBottom = 216 + Math.round(26 * 1.3 + 8);
    const haloTop = Math.round(306 + 85 - (85 + 20) * 1.12);
    ok(haloTop - discBottom >= 8, `片尾图标光圈（y≥${haloTop}）和免责胶囊（y≤${discBottom}）不相碰`, `片尾图标光圈顶 y=${haloTop} 贴着免责胶囊底 y=${discBottom}`);
  }
  return lines;
};

// ---------------- 文字排版报告：模拟换行，报出会断词的行 / 明显超宽的行 ----------------
// 和 template/src/core/fit.ts 的 glueBreaks() 同一套「中文按 Intl.Segmenter 分词、词内不断行」的判断
// 规则，但 Node 不能直接 import 这个 .ts 文件（没有 ts-node/tsx），这里复刻一份最小逻辑。
const isWideCp = (cp) =>
  (cp >= 0x2e80 && cp <= 0x9fff) ||
  (cp >= 0xac00 && cp <= 0xd7af) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xff60) ||
  (cp >= 0xffe0 && cp <= 0xffe6) ||
  (cp >= 0x3000 && cp <= 0x303f) ||
  cp === 0x201c || cp === 0x201d || cp === 0x2018 || cp === 0x2019 || cp === 0x2026 || cp === 0x00b7;
const isIdeographCp = (cp) => (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff);
const charUnitsOf = (s) => Array.from(String(s).replace(/[{}]/g, '')).reduce((n, ch) => n + (isWideCp(ch.codePointAt(0)) ? 1 : 0.5), 0);
let zhSegmenter;
const getZhSegmenter = () => {
  try {
    return (zhSegmenter ??= new Intl.Segmenter('zh', {granularity: 'word'}));
  } catch {
    return undefined;
  }
};
// 安全区文字行宽 780px、正文字号下限 40px（SHOT_API §4/§5）折算出的「一行大约能放几个字」
const LINE_UNITS = 780 / 40;
export const reportTextWrap = (sb0, specs) => {
  const lines = [];
  const seg = getZhSegmenter();
  const addField = (loc, val, fmt) => {
    if (typeof val !== 'string' || !val) return;
    if (fmt === 'note' || fmt === 'asset' || fmt === 'icon' || fmt === 'illust' || fmt === 'color') return;
    for (const raw of val.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const units = charUnitsOf(line);
      if (units > LINE_UNITS * 2.2) {
        lines.push(`  ✗ 超宽：${loc}「${line.slice(0, 22)}${line.length > 22 ? '…' : ''}」约 ${units.toFixed(1)} 字，正文下限 40px 也装不下一行`);
        continue;
      }
      if (units <= LINE_UNITS || !seg) continue;
      const words = Array.from(seg.segment(line.replace(/[{}]/g, ''))).map((s) => s.segment);
      const risky = words.filter((w) => {
        const cs = Array.from(w);
        return cs.length >= 2 && cs.some((c) => isIdeographCp(c.codePointAt(0)));
      });
      if (risky.length) lines.push(`  ! 可能断词：${loc}「${line}」超一行宽度且含多字词「${risky.slice(0, 3).join('、')}」——渲染它的组件要用 core/fit.ts 的 glueBreaks() 保护词边界，否则可能被从词中间拆到下一行`);
    }
  };
  addField('meta.disclaimer', sb0.meta?.disclaimer);
  (sb0.meta?.notices ?? []).forEach((n, i) => addField(`meta.notices[${i}]`, n));
  const walkParam = (val, schema, loc) => {
    if (!schema || val == null) return;
    if (schema.type === 'string') return addField(loc, val, schema.format);
    if (schema.type === 'array' && Array.isArray(val)) val.forEach((v, k) => walkParam(v, schema.items, `${loc}[${k}]`));
    else if (schema.type === 'object' && val && typeof val === 'object') for (const [k, v] of Object.entries(val)) walkParam(v, schema.properties?.[k], `${loc}.${k}`);
  };
  (sb0.shots ?? []).forEach((shot, i) => {
    const tag = `${i + 1}-${shot.type}`;
    const caps = Array.isArray(shot.caption) ? shot.caption : typeof shot.caption === 'string' ? [shot.caption] : [];
    caps.forEach((c, k) => addField(`${tag}.caption[${k}]`, c, 'caption'));
    const spec = specs[shot.type];
    if (spec) for (const [k, v] of Object.entries(shot.params || {})) walkParam(v, spec.params?.properties?.[k], `${tag}.params.${k}`);
  });
  return lines.length ? [...new Set(lines)] : ['  ✓ 没发现明显会断词或超宽的行'];
};

export const hasCross = (lines) => lines.some((l) => /^\s*✗/.test(l));
