import React from 'react';
import {FONT, MONO} from '../core/font';
import {alpha, useTheme} from '../core/theme';
import names from './names.json';
import {ICONS} from './icons';

// ============================================================
// Illust：行业插画（设计 docs/dev/industry-design.md §2）。
// 用法：<Illust name="food/bowl" size={320} />
//   name    "<industry>/<id>"，从 names.json 里选；还没画的图形，或拼错的名字，画一个警示色的占位块
//   size    像素，建议 240–480（设计 §2.1）
//   color   'primary' | 'accent'，只从当前主题取色（设计 §2.1：填色只从当前主题取 2 种，外加描边色）
//   animate 是否有 ≤1.5 秒循环的小动作（设计 §2.1：如热气飘动、指针转动，不改变物体大小/数量）
//   t       动画用的镜头内秒数（配合 ShotProps.t 传入）；animate=false 时恒为静止姿态
// 图形本体在 ./icons.tsx（按 id 注册），这个文件只管取色、套 svg 外壳、处理未知名字的占位。
// validate.mjs 已经按 names.json 校验所有 "format": "illust" 的字段（steps/features/quickList 的 icon 参数，设计 §1.8）。
// ============================================================
export type IllustName = string;
type Props = {name: IllustName; size?: number; color?: 'primary' | 'accent'; animate?: boolean; t?: number};

type NameRow = {id: string; industry: string; label?: string; must?: boolean; keywords?: string[]};
const ROWS = names as NameRow[];
// 只认「names.json 里有 + icons.tsx 真画了」的名字；names.json 里还没画的，当成不存在（否则会渲染出红色占位块）
const KNOWN = new Set(ROWS.map((x) => x.id).filter((id) => !!ICONS[id]));
export const isIllust = (name: unknown): name is IllustName => typeof name === 'string' && KNOWN.has(name);
export const illustNames = (): string[] => ROWS.map((x) => x.id).filter((id) => KNOWN.has(id));
/** 插画所属行业（"food/bowl" → "food"） */
export const illustIndustry = (name: string): string => name.split('/')[0] ?? '_base';

/**
 * 按文字（标题/标签/卖点）挑一张插画：names.json 的 keywords 里命中最长关键词的那张。
 * industry 给了就只在该行业 + _base 里挑（防止「画面」里的「面」挑到面碗这类跨行业误配）。
 * 一个都没命中返回 undefined，调用方再按行业默认图兜底。
 */
export const illustFor = (texts: Array<string | undefined>, industry?: string): string | undefined => {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return undefined;
  let best: {id: string; score: number} | undefined;
  for (const row of ROWS) {
    if (!KNOWN.has(row.id) || !row.keywords?.length) continue;
    if (industry && row.industry !== industry && row.industry !== '_base') continue;
    for (const k of row.keywords) {
      if (!hay.includes(k.toLowerCase())) continue;
      // 行业内的图优先于 _base（同样长度时）
      const score = Array.from(k).length * 10 + (row.industry === industry ? 1 : 0);
      if (!best || score > best.score) best = {id: row.id, score};
    }
  }
  return best?.id;
};

/** 每个行业的首选默认图（没给 illust、文字也没命中关键词时用；对应设计 §2.2 每行业的 ★ 首图） */
export const DEFAULT_ILLUST: Record<string, string> = {
  food: 'food/bowl',
  ecommerce: 'ecommerce/parcel',
  education: 'education/book',
  beauty: 'beauty/hair-short',
  travel: 'travel/house',
  software: '_base/bubble',
  _base: '_base/bubble',
};

const WARN = '#E4572E';

export const Illust: React.FC<Props> = ({name, size = 320, color = 'primary', animate = false, t = 0}) => {
  const th = useTheme();
  const Icon = KNOWN.has(name) ? ICONS[name] : undefined;

  if (!Icon) {
    // 占位：names.json 里还没画的图形，或者拼错的名字。警示色方便肉眼发现。
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.18,
          background: alpha(WARN, 0.22),
          border: `${Math.max(4, Math.round(size * 0.02))}px solid ${WARN}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxSizing: 'border-box',
          fontFamily: FONT,
        }}
      >
        <div style={{fontFamily: MONO, fontWeight: 700, fontSize: Math.max(18, Math.round(size * 0.09)), color: WARN}}>?</div>
        <div style={{fontWeight: 700, fontSize: Math.max(14, Math.round(size * 0.07)), color: WARN, textAlign: 'center', padding: '0 8px', lineHeight: 1.3}}>{name}</div>
      </div>
    );
  }

  // 2 种主题填色 + 1 种描边色（设计 §2.1）；color='accent' 时整体更强调
  const fillMain = color === 'accent' ? th.accentFill : th.cardAlt;
  const fillPop = color === 'accent' ? th.accentSoft : th.accentFill;
  const stroke = th.cardText;
  const effT = animate ? t : 0;

  return (
    <div style={{width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'}}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{overflow: 'visible', display: 'block'}}>
        <Icon fillMain={fillMain} fillPop={fillPop} stroke={stroke} t={effT} />
      </svg>
    </div>
  );
};

export default Illust;
