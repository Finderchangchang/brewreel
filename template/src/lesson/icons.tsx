import React from 'react';
import {ICON_NAMES, ICON_SHAPES, isIconName} from './icon-names.mjs';

export {ICON_NAMES, isIconName};
export type IconName = (typeof ICON_NAMES)[number];

type Shape = {
  t: string;
  cx?: number; cy?: number; r?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  d?: string;
  x?: number; y?: number; w?: number; h?: number; rx?: number;
};

const draw = (shape: Shape, index: number) => {
  if (shape.t === 'circle') return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />;
  if (shape.t === 'line') return <line key={index} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} />;
  if (shape.t === 'path') return <path key={index} d={shape.d} />;
  if (shape.t === 'rect') return <rect key={index} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx} />;
  return null;
};

/** 线条图标。描边粗细统一，颜色默认跟着 currentColor，版式传入主题 accent。 */
export const Icon: React.FC<{name: string; size?: number; color?: string}> = ({name, size = 48, color = 'currentColor'}) => {
  const shapes = (ICON_SHAPES as Record<string, Shape[]>)[name];
  if (!shapes) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {shapes.map(draw)}
  </svg>;
};
