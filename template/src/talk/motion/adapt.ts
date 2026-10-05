// 模板 → 宣传片公共镜头（steps / quickList / counter / compare）的适配：
//   params（镜头参数，字全部来自 data）、anchors（时间重映射的锚点）、content（镜头真正占的那块，给舞台定缩放和居中）。
// 镜头代码一行不改；这里照各镜头导出的 plan() / geom() 取时间和版面。counter、compare 没导出版面函数，
// 下面按它们的写法复算了卡片高度（只用来定舞台的取景框，差几像素不影响画面）；改这两个镜头的版面时同步看一眼。
import {charUnits, emWidth, fitLine} from '../../core/fit';
import {CARD, MAIN} from '../../core/safe';
import {plan as comparePlan} from '../../shots/compare';
import {plan as counterPlan} from '../../shots/counter';
import {geom as quickGeom, plan as quickPlan} from '../../shots/quickList';
import {geom as stepsGeom, plan as stepsPlan} from '../../shots/steps';
import type {VBox} from './stage';
import type {MotionClip} from './types';
import type {Anchor} from './warp';

export const BEAT = 0.5;
/** checklist 的小标题由 MotionLayer 自己画在清单正上方（quickList 自带的标题钉在主体区顶上，和两三行清单隔得太远） */
export const CHECK_TITLE = {h: 76, gap: 24};

export type ShotType = 'steps' | 'quickList' | 'counter' | 'compare';
export type Adapted = {
  type: ShotType;
  params: Record<string, unknown>;
  anchors: Anchor[];
  content: VBox;
  /** checklist：小标题的位置（镜头坐标） */
  title?: {text: string; y: number};
};

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ---------------- counter 卡片高度（照 shots/counter.tsx 的版面） ----------------
const MONEY_RE = /[¥￥$€£]|元|块|RMB|CNY|USD/i;
const numText = (v: number, dec: number) => {
  const [ip, fp] = Math.abs(v).toFixed(dec).split('.');
  return (v < 0 ? '-' : '') + (ip.length > 4 ? ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ip) + (fp ? '.' + fp : '');
};
const counterBox = (p: {to: number; from?: number; showFrom?: boolean; decimals?: number; prefix?: string; suffix?: string; label: string}): VBox => {
  const inner = CARD.w - 2 * CARD.padX;
  const dec = Math.max(0, Math.min(2, Math.round(p.decimals ?? 0)));
  const prefix = p.prefix ?? '';
  const suffix = p.suffix ?? '';
  const hasFrom = fin(p.from);
  const longest = [numText(p.to, dec), numText(hasFrom ? (p.from as number) : 0, dec)].sort((a, b) => b.length - a.length)[0];
  const em = longest.length * 0.6 + charUnits(prefix) * 0.5 + (suffix ? charUnits(suffix) * 0.38 + 0.08 : 0);
  const numSize = Math.max(100, Math.min(230, Math.floor((inner - 40) / Math.max(0.6, em))));
  const labelSize = fitLine(p.label ?? '', inner, 54, 40);
  const showFrom = !!p.showFrom && hasFrom && p.from !== p.to;
  const change = showFrom && !MONEY_RE.test(prefix + suffix);
  const cardH = 40 + 96 + 18 + (showFrom ? 86 : 0) + Math.round(numSize * 1.06) + 22 + (change ? 22 : 16) + 30 + Math.round(labelSize * 1.3) + 40;
  const cardY = MAIN.y0 + Math.max(0, Math.round((MAIN.h - cardH) / 2));
  return {x0: CARD.x0, x1: CARD.x0 + CARD.w, y0: cardY - 12, y1: cardY + cardH + 36};
};

// ---------------- compare（lr）卡片高度（照 shots/compare.tsx 的 layoutSide） ----------------
const lineCount = (text: string, size: number, w: number) => {
  if (!/\s/.test(text)) return Math.max(1, Math.ceil((emWidth(text) * size) / w - 0.02));
  let lines = 1;
  let cur = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const ww = emWidth(word) * size;
    const withGap = cur ? cur + 0.3 * size + ww : ww;
    if (cur && withGap > w * 0.92) {
      lines += 1;
      cur = ww;
    } else cur = withGap;
  }
  return lines;
};
const compareBox = (left: string[], right: string[], verdict?: string): VBox => {
  const colW = (CARD.w - 20) / 2;
  const textW = colW - 2 * 22 - 36 - 12;
  const verdictSpace = verdict ? 92 + 20 : 0;
  const availH = MAIN.h - 30 - verdictSpace;
  const sideH = (items: string[]) => {
    const fixed = 96 + 22 + 14 + 22;
    const itemsH = (size: number) => items.slice(0, 3).reduce((a, it) => a + lineCount(it, size, textW) * size * 1.25 + 26, 0);
    let size = 40;
    while (size > 34 && fixed + itemsH(size) > availH) size -= 1;
    return Math.min(availH, Math.max(380, Math.ceil(fixed + itemsH(size))));
  };
  const h = Math.max(sideH(left), sideH(right));
  const top = MAIN.y0 + Math.round((MAIN.h - h - verdictSpace) / 2);
  // 右栏胜出时的对勾徽章圆心在卡片上沿 34px 处、直径 88，弹出时还会过冲一点：上沿留 92
  return {x0: CARD.x0, x1: CARD.x0 + CARD.w + 14, y0: top - 92, y1: top + h + verdictSpace + 30};
};

/** 模板 → 镜头。keyword 不走这里（Keyword.tsx 自己画） */
export const adaptShot = (c: MotionClip, dur: number, beat = BEAT): Adapted | null => {
  if (c.template === 'steps') {
    const items = c.data.items.slice(0, 4).map((title) => ({title}));
    const n = items.length;
    if (!n) return null;
    const pl = stepsPlan(n, dur, beat);
    const g = stepsGeom(n);
    const marks = c.marks.items ?? [];
    // 第 1 步在镜头 0 秒就亮（和卡片入场同时），从第 2 步开始对口播：光点在说出这一步之前 fill 秒出发，开口时落到节点上
    const anchors: Anchor[] = marks.slice(1, n).map((sec, i) => ({real: sec - 0.05, shot: pl.at[i + 1], lead: pl.fill + 0.1}));
    return {type: 'steps', params: {items}, anchors, content: {x0: MAIN.x0, x1: MAIN.x1, y0: g.cardY - 24, y1: g.cardY + g.cardH + 36}};
  }
  if (c.template === 'checklist') {
    const items = c.data.items.slice(0, 4).map((text) => ({text, tone: 'good'}));
    const n = items.length;
    if (!n) return null;
    const pl = quickPlan(n, dur, beat);
    const g = quickGeom(n, false);
    const rowsTop = g.y0;
    const rowsBottom = g.y0 + n * g.rh + (n - 1) * g.gap;
    const title = c.data.title ? {text: c.data.title, y: rowsTop - CHECK_TITLE.gap - CHECK_TITLE.h} : undefined;
    const marks = c.marks.items ?? [];
    const anchors: Anchor[] = marks.slice(1, n).map((sec, i) => ({real: sec - 0.1, shot: pl.at[i + 1], lead: 0.12}));
    return {
      type: 'quickList',
      params: {items},
      anchors,
      content: {x0: MAIN.x0, x1: MAIN.x1, y0: (title ? title.y : rowsTop) - 16, y1: rowsBottom + 28},
      title,
    };
  }
  if (c.template === 'counter') {
    const {say, from, label} = c.data;
    const hasFrom = !!from && from.value !== say.value;
    const params = {
      to: say.value,
      from: hasFrom ? from!.value : undefined,
      showFrom: hasFrom,
      // 钱数带 from 时宣传片会多画一个算出来的「↓57%」：原话里没有这个数，口播动效不画
      hideDelta: true,
      decimals: Math.max(say.decimals, hasFrom ? from!.decimals : 0),
      prefix: say.prefix || undefined,
      suffix: say.suffix || undefined,
      label,
    };
    const pl = counterPlan(params, dur, beat);
    // 数字在念到最后一个数字字时落定。
    //   有 from（降价）：旧值一直亮着（原话里说了），落定前 roll 秒才开始滚，滚动按 1:1 播；
    //   没有 from：起点是 0，停在「0 秒」上会让人读成一个原话里没有的数，所以入场后就慢慢往上滚，正好在开口时落定
    const land = fin(c.marks.sayAt) ? c.marks.sayAt : c.marks.say;
    return {type: 'counter', params, anchors: [{real: land, shot: pl.land, lead: pl.roll, stretch: !hasFrom}], content: counterBox(params)};
  }
  if (c.template === 'compare') {
    const {leftTitle, rightTitle, left, right, verdict} = c.data;
    const params = {mode: 'lr', left: {title: leftTitle, items: left.slice(0, 2)}, right: {title: rightTitle, items: right.slice(0, 2)}, verdict: verdict || undefined};
    const pl = comparePlan(params as Parameters<typeof comparePlan>[0], dur, beat);
    const m = c.marks;
    const anchors: Anchor[] = [];
    (m.left ?? []).slice(1, 2).forEach((sec, i) => anchors.push({real: sec - 0.1, shot: pl.leftItems[i + 1], lead: 0.15}));
    // 右栏：中线画到、VS 弹出，再出第一条——这一串在开口说右栏前播完
    if (fin(m.right?.[0])) anchors.push({real: m.right[0] - 0.15, shot: pl.rightItems[0], lead: pl.rightItems[0] - pl.vsAt + 0.15});
    if (fin(m.right?.[1])) anchors.push({real: m.right[1] - 0.1, shot: pl.rightItems[1], lead: 0.15});
    if (verdict && fin(m.verdict0)) anchors.push({real: m.verdict0 - 0.1, shot: pl.verdictAt, lead: 0.2});
    return {type: 'compare', params, anchors, content: compareBox(left, right, verdict)};
  }
  return null;
};
