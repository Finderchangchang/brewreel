// 图表和截图标注的纯检查。图表数字规则对齐 scripts/validate.mjs 的 dataChart。
// 标注框对齐讲课 screenshot：0–1、不溢出图片、框与框不相交。
import type {CalloutBox, ChartPoint} from './types.ts';

export function numsIn(text: string): Set<number> {
  const cleaned = String(text ?? '').replace(/(\d),(\d{3})/g, '$1$2');
  const found = cleaned.match(/\d+(?:\.\d+)?/g) ?? [];
  return new Set(found.map(Number));
}

function hit(a: CalloutBox, b: CalloutBox): boolean {
  const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ix > 1e-6 && iy > 1e-6;
}

/** 返回人话错误。空数组表示这组标注能放。 */
export function inspectCallouts(callouts: CalloutBox[] | undefined): string[] {
  const errors: string[] = [];
  if (!callouts) return errors;
  callouts.forEach((box, index) => {
    if (!box || typeof box !== 'object') {
      errors.push(`第 ${index + 1} 个标注不是对象`);
      return;
    }
    for (const key of ['x', 'y', 'w', 'h'] as const) {
      const value = box[key];
      if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
        errors.push(`第 ${index + 1} 个标注的 ${key} 不在 0 到 1`);
      }
    }
    if (typeof box.x === 'number' && typeof box.w === 'number' && box.x + box.w > 1 + 1e-6) {
      errors.push(`第 ${index + 1} 个标注超出图片右边界`);
    }
    if (typeof box.y === 'number' && typeof box.h === 'number' && box.y + box.h > 1 + 1e-6) {
      errors.push(`第 ${index + 1} 个标注超出图片下边界`);
    }
  });
  for (let i = 0; i < callouts.length; i++) {
    for (let j = i + 1; j < callouts.length; j++) {
      const a = callouts[i];
      const b = callouts[j];
      if (a && b && hit(a, b)) errors.push(`第 ${i + 1} 个标注和第 ${j + 1} 个标注相交`);
    }
  }
  return errors;
}

/** dataChart 里和 bar / line / donut 对应的那几条。value 必须能在事实原文里找到。 */
export function inspectChart(chart: string, points: ChartPoint[] | undefined, factText: string, max?: number): string[] {
  const errors: string[] = [];
  const rows = Array.isArray(points) ? points : [];
  if (!rows.length) {
    errors.push('图表至少要一个点');
    return errors;
  }
  rows.forEach((row, index) => {
    if (!row || typeof row.label !== 'string' || !row.label.trim()) errors.push(`第 ${index + 1} 个点缺少 label`);
    if (!row || typeof row.value !== 'number' || !Number.isFinite(row.value)) errors.push(`第 ${index + 1} 个点的 value 必须是数字`);
  });
  if (rows.some((row) => !row || typeof row.value !== 'number')) return errors;
  if (chart === 'donut' && rows.length > 5) errors.push('donut 类别超过 5 个');
  if (rows.every((row) => row.value === 0)) errors.push('所有图表数据都是 0');
  if (chart === 'line') {
    const groups = new Map<string, string[]>();
    rows.forEach((row) => {
      const key = row.series ?? '';
      const list = groups.get(key) ?? [];
      list.push(String(row.label ?? ''));
      groups.set(key, list);
    });
    if ([...groups.values()].some((list) => list.length < 2)) errors.push('line 每条 series 至少要有两个点');
    const sigs = [...groups.values()].map((list) => list.join('\u0001'));
    if (sigs.length > 1 && sigs.some((sig) => sig !== sigs[0])) errors.push('折线每条线的时间点不一致');
  }
  if (typeof max === 'number' && rows.some((row) => row.value > max)) errors.push('max 小于某条数据');
  if (rows.filter((row) => row.focus === true).length > 1) errors.push('一张图只能突出一个 focus');
  const cited = numsIn(factText);
  const visible = numsIn(rows.map((row) => `${row.label} ${row.value}`).join(' '));
  for (const value of visible) {
    if (!cited.has(value)) errors.push(`画面数值 ${value} 不在事实原文里`);
  }
  return errors;
}
