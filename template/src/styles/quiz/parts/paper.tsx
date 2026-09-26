import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {FilmProps} from '../../types';
import {usePal, useTk} from './kit';

// ============================================================
// quiz 的纸面背景（全片常驻，垫在镜头下面）：底色 + 点阵（像答题纸 / 手账点阵本）+ 左侧一条朱红页边线 + 页脚几件笔记本小物（不带字）。
// 纯 SVG 图案，不用渐变；点阵和页边线都很淡，只给「这是一张纸」的质感，不抢内容。
// 释义段的桌面底色和落版前的印章擦除都画在镜头里，会整个盖住它。
// ============================================================
export const QuizPaper: React.FC<FilmProps> = () => {
  const tk = useTk();
  const pal = usePal();
  const P = tk.layout?.paper ?? {dot: 36, dotR: 2.2, dotOpacity: 0.13, marginX: 118, marginOpacity: 0.4};
  const id = 'quiz-paper-dots';
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <defs>
          <pattern id={id} x={0} y={0} width={P.dot} height={P.dot} patternUnits="userSpaceOnUse">
            <circle cx={P.dot / 2} cy={P.dot / 2} r={P.dotR} fill={pal.grid ?? pal.ink} opacity={P.dotOpacity} />
          </pattern>
        </defs>
        <rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
        <rect x={P.marginX} y={0} width={3} height="100%" fill={pal.pen ?? pal.primary} opacity={P.marginOpacity} />
        {/* 页脚装饰（y1340 以下是平台按钮区，只放不带信息的笔记本小物）：页底虚线、斜贴的一截胶带、右沿三枚索引签、右下角折起的页角 */}
        <line x1={P.marginX + 20} y1={1372} x2={1040} y2={1372} stroke={pal.ink} strokeWidth={3} strokeDasharray="14 12" opacity={0.14} />
        <g transform="translate(176 1560) rotate(-7)">
          <path d="M0 0 L230 0 L222 11 L230 22 L222 33 L230 44 L0 44 L8 33 L0 22 L8 11 Z" fill={pal.highlight ?? pal.primary} opacity={0.5} />
        </g>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={1080 - 34} y={1430 + i * 86} width={60} height={70} rx={10} fill={[pal.primary, pal.highlight ?? pal.primary, pal.pen ?? pal.primary][i]} stroke={pal.ink} strokeWidth={3} opacity={0.75} />
        ))}
        <path d="M1080 1760 L1080 1920 L920 1920 Z" fill={pal.ink} opacity={0.1} />
        <path d="M920 1920 L1080 1760 L946 1786 Z" fill={pal.cardAlt ?? pal.card} stroke={pal.ink} strokeWidth={3} strokeLinejoin="round" />      </svg>
    </AbsoluteFill>
  );
};
