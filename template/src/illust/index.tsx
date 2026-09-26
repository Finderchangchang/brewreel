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

const KNOWN = new Set((names as {id: string}[]).map((x) => x.id));
export const isIllust = (name: unknown): name is IllustName => typeof name === 'string' && KNOWN.has(name);
export const illustNames = (): string[] => (names as {id: string}[]).map((x) => x.id);

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
  const fillMain = color === 'accent' ? th.accent : th.cardAlt;
  const fillPop = color === 'accent' ? th.accentSoft : th.accent;
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
