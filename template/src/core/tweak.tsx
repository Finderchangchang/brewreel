import React, {createContext, useContext} from 'react';
import type {Storyboard} from '../schema';
import {FONT, KAI, SERIF} from './font';

export type TweakView = {
  /** 1 表示不缩放（没写，或写了 1） */
  textScale: number;
  /** null 表示沿用原来的 FONT（没写，或写了 sans） */
  headingFont: 'serif' | 'kai' | null;
};

const IDENTITY: TweakView = {textScale: 1, headingFont: null};
const Ctx = createContext<TweakView>(IDENTITY);

export const tweakOf = (meta: Storyboard['meta'] | undefined): TweakView => {
  const t = meta?.tweak;
  const scale = typeof t?.textScale === 'number' && t.textScale !== 1 ? t.textScale : 1;
  const font = t?.headingFont === 'serif' || t?.headingFont === 'kai' ? t.headingFont : null;
  if (scale === 1 && font == null) return IDENTITY;
  return {textScale: scale, headingFont: font};
};

/** 不增加 DOM。没写 tweak 时提供的值和默认上下文相同。 */
export const TweakProvider: React.FC<{meta?: Storyboard['meta']; children?: React.ReactNode}> = ({meta, children}) => (
  <Ctx.Provider value={tweakOf(meta)}>{children}</Ctx.Provider>
);

export const useTweak = () => useContext(Ctx);

export const headingFamily = (font: TweakView['headingFont']) => (font === 'serif' ? SERIF : font === 'kai' ? KAI : FONT);
