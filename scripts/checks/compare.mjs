// ============================================================
// compareDirection：compare 镜头两栏都写了 level（0–10 刻度条）时，tone=good 那一栏在这把尺子上必须更优。
//
// 评审连续两轮出现同一个硬伤：meterLabel「保温时间」，普通杯 8/10（红）、暖屿杯 2/10（绿）——观众读成普通杯保温久四倍。
// 尺子的方向优先看 params.higherIs（"good" 越高越好 / "bad" 越高越差，镜头 spec 若补上这个字段就直接生效）；
// 没写就按 meterLabel 的词判断（「麻烦程度」「降温速度」越高越差，「保温时长」「稳固度」越高越好）。
// 判断不出方向时只提醒，不拦。
// ============================================================
import {where, shotsOfType, mkFinding as F} from './util.mjs';

// 越高越差的量
const HIGHER_BAD = [
  '降温', '散热', '变凉', '凉得', '流失', '损耗', '麻烦', '费劲', '费事', '费时', '耗时', '难度', '困难', '风险', '危险', '出错', '错误', '失误', '焦虑',
  '压力', '负担', '成本', '花费', '费用', '开销', '等待', '排队', '繁琐', '复杂', '混乱', '杂乱', '噪音', '噪声', '异味', '油腻', '疲劳', '疼', '痛',
  '踩坑', '遗漏', '漏', '故障', '延迟', '卡顿', '松脱', '脱落', '松动', '掉落', '返工', '拖延', '步骤', '操作次数', '点击次数', '切换', '内耗', '手动',
  'effort', 'hassle', 'risk', 'error', 'cost', 'wait', 'delay', 'steps', 'stress', 'noise', 'friction', 'clicks',
];
// 越高越好的量
const HIGHER_GOOD = [
  '保温', '保冷', '效率', '速度', '稳固', '稳定', '牢固', '满意', '整洁', '匹配', '舒适', '准确', '精准', '完整', '清晰', '耐用', '续航', '保鲜', '省时',
  '省钱', '省力', '省心', '便捷', '方便', '轻松', '顺手', '好用', '安心', '放心', '容量', '覆盖', '透气', '柔软', '质感', '口感', '新鲜', '干净', '安全',
  '专注', '掌握', '熟练', '效果', '体验', '性价比', '评分', '得分', '完成度', '贴合', '防护', '收纳',
  'speed', 'efficiency', 'focus', 'accuracy', 'comfort', 'quality', 'score', 'satisfaction', 'stability', 'battery',
];
// 「防漏」「减少麻烦」「低风险」：前缀把越高越差的量翻成越高越好
const FLIP_PREFIX = /[防抗免省减少无低降]$/;

/** 返回 'good' | 'bad' | null。多个词同时命中时取最靠前的那个（中文复合词是「修饰语+中心语」，「降温速度」量的是降温） */
export function inferHigherIs(label) {
  const s = String(label ?? '').toLowerCase();
  if (!s.trim()) return null;
  let best = null;
  const consider = (word, dir) => {
    const idx = s.indexOf(word.toLowerCase());
    if (idx < 0) return;
    let d = dir;
    if (dir === 'bad' && idx > 0 && FLIP_PREFIX.test(s.slice(0, idx))) d = 'good';
    if (!best || idx < best.idx || (idx === best.idx && word.length > best.len)) best = {idx, dir: d, len: word.length};
  };
  for (const w of HIGHER_BAD) consider(w, 'bad');
  for (const w of HIGHER_GOOD) consider(w, 'good');
  return best ? best.dir : null;
}

export function compareDirection(sb) {
  const out = [];
  for (const {i, shot} of shotsOfType(sb, 'compare')) {
    const p = shot.params ?? {};
    const L = p.left ?? {};
    const R = p.right ?? {};
    if (typeof L.level !== 'number' || typeof R.level !== 'number') continue;
    const lt = L.tone ?? 'bad';
    const rt = R.tone ?? 'good';
    const sides = [{s: L, tone: lt, name: 'left'}, {s: R, tone: rt, name: 'right'}];
    const good = sides.find((x) => x.tone === 'good');
    const bad = sides.find((x) => x.tone === 'bad');
    if (!good || !bad) continue;
    const label = typeof p.meterLabel === 'string' ? p.meterLabel.trim() : '';
    const explicit = p.higherIs === 'good' || p.higherIs === 'bad' ? p.higherIs : null;
    const dir = explicit ?? inferHigherIs(label);
    const gt = good.s.title ?? good.name;
    const bt = bad.s.title ?? bad.name;
    if (!dir) {
      out.push(F('warn', where(i, 'compare', label ? 'params.meterLabel' : 'params'), label ? `看不出「${label}」是越高越好还是越高越差，刻度条方向没法核对` : '两栏都写了 level，但没写 meterLabel，观众不知道这把尺子量什么',
        '把 meterLabel 写成方向明确的词：越高越差用「麻烦程度」「出错风险」「降温速度」，越高越好用「保温时长」「稳固度」「效率」；然后让 tone=good 那栏在这把尺子上更优'));
      continue;
    }
    if (good.s.level === bad.s.level) {
      out.push(F('warn', where(i, 'compare', `params.${good.name}.level`), `两栏 level 一样（都是 ${good.s.level}），对比不成立`, '要么拉开差距（数字要有依据），要么删掉两栏的 level'));
      continue;
    }
    const goodBetter = dir === 'good' ? good.s.level > bad.s.level : good.s.level < bad.s.level;
    if (goodBetter) continue;
    const dirWord = dir === 'good' ? '越高越好' : '越高越差';
    const what = label || '这把尺子';
    out.push(F('block', where(i, 'compare', `params.${good.name}.level`),
      `刻度方向反了：「${what}」${dirWord}，可 tone=good 的「${gt}」是 ${good.s.level}/10、tone=bad 的「${bt}」是 ${bad.s.level}/10，观众会读成「${bt}」更${dir === 'good' ? '好' : '省心'}`,
      dir === 'good'
        ? `level 表示「${what}」的量，越高越好：让「${gt}」的 level 更高（如 8）、「${bt}」更低（如 3）；或者把 meterLabel 改成反向说法（如「降温速度」「麻烦程度」），让 bad 那栏更高`
        : `level 表示「${what}」的量，越高越差：让「${bt}」的 level 更高（如 8）、「${gt}」更低（如 2）；或者把 meterLabel 改成正向说法（如「保温时长」「效率」），让 good 那栏更高`));
  }
  return out;
}
