import React from 'react';
import ICONS from './icons.json';

// 中性线条图标（24x24 视图，2px 线宽，圆头）。镜头里只用这些，不用 emoji。
// 名单：icons.json 的键；validate.mjs 也读这份清单校验 params 里的 icon 字段。
export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
export const isIcon = (s: unknown): s is IconName => typeof s === 'string' && s in ICONS;

export const Icon: React.FC<{
  name: string;
  size?: number;
  color?: string;
  /** 线宽（在 24 视图坐标里），默认 2 */
  stroke?: number;
  style?: React.CSSProperties;
}> = ({name, size = 48, color = 'currentColor', stroke = 2, style}) => {
  const markup = (ICONS as Record<string, string>)[name] ?? ICONS.sparkle;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{flex: 'none', display: 'block', ...style}}
      dangerouslySetInnerHTML={{__html: markup}}
    />
  );
};
