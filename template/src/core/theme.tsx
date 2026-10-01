import React, {createContext, useContext} from 'react';
import {interpolateColors} from 'remotion';
import THEMES from './themes.json';

// ============================================================
// 主题：组件只通过 useTheme() 取色，不写死颜色。
// brandColor 只替换 accent（按钮、我方气泡、图标、进度条），字幕强调色 hot 不变。
// ============================================================
export type ThemeData = (typeof THEMES)['warm-emotion'] & {
  /** 新主题可使用简洁字幕和自己的图表系列色；显式 palette 仍可覆盖。 */
  captionStyle?: string;
  chartColors?: string[];
};
export type Theme = ThemeData & {
  name: string;
  /** 强调色的浅底（卡片上的高亮底色） */
  accentSoft: string;
  /** 强调色的中间调（描边/进度底） */
  accentLine: string;
};
export const THEME_NAMES = Object.keys(THEMES);

const hex = (c: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** 两个 #RRGGBB 颜色按 p 混合（p=0 → a，p=1 → b） */
export const mixHex = (a: string, b: string, p: number) => {
  const x = hex(a);
  const y = hex(b);
  if (!x || !y) return a;
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * p));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
/** #RRGGBB → rgba(..., a) */
export const alpha = (c: string, a: number) => {
  const x = hex(c);
  return x ? `rgba(${x[0]},${x[1]},${x[2]},${a})` : c;
};

/** Solid labels on chart segments must remain readable on light and dark series. */
export const inkOn = (color: string) => {
  const rgb = hex(color);
  return rgb && rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 165 ? '#1B2738' : '#FFFFFF';
};

export const resolveTheme = (name: string | undefined, brandColor?: string): Theme => {
  const key = name && name in THEMES ? (name as keyof typeof THEMES) : 'warm-emotion';
  const base = THEMES[key] as ThemeData;
  const accent = brandColor && hex(brandColor) ? brandColor : base.accent;
  const cardHex = hex(base.card) ? base.card : base.dark ? '#141B33' : '#FFFFFF';
  return {
    ...base,
    name: key,
    accent,
    accentSoft: mixHex(accent, cardHex, base.dark ? 0.78 : 0.88),
    accentLine: mixHex(accent, cardHex, base.dark ? 0.55 : 0.7),
  };
};

const Ctx = createContext<Theme>(resolveTheme('warm-emotion'));
export const ThemeProvider: React.FC<{theme: Theme; children: React.ReactNode}> = ({theme, children}) => (
  <Ctx.Provider value={theme}>{children}</Ctx.Provider>
);
export const useTheme = () => useContext(Ctx);

/** 背景渐变在 mood（0..1）下的上/下两色 */
export const moodColors = (th: Theme, m: number) => ({
  top: interpolateColors(m, [0, 0.5, 1], th.bgTop),
  bot: interpolateColors(m, [0, 0.5, 1], th.bgBot),
});

/** 语气色：good/warn/bad/accent/neutral → 颜色 */
export const toneColor = (th: Theme, tone?: string) =>
  tone === 'good' ? th.good : tone === 'warn' ? th.warn : tone === 'bad' ? th.bad : tone === 'neutral' ? th.cardSub : th.accent;
