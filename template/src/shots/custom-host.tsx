import React from 'react';
import type {Storyboard} from '../schema';
import type {Slot} from '../core/timeline';
import {useTheme} from '../core/theme';
import {geometryOf} from '../core/safe';
import {aspectOf} from '../styles';
import {CUSTOM_SHOTS} from './_custom/registry';
import type {CustomShotProps} from './custom-api';

const lineInStack = (stack: string, file: string) => {
  const base = file.split('/').pop() ?? '';
  if (!base) return '';
  const m = new RegExp(`${base.replace(/\./g, '\\.')}(?::(\\d+)|\\((\\d+))`).exec(stack);
  return m?.[1] || m?.[2] || '';
};

/** 自由镜头外壳。没注册、或组件自己抛错，都带上第几镜和组件路径，不换成占位画面。 */
export const CustomShotView: React.FC<{slot: Slot; t: number; beat: number; sb: Storyboard}> = ({slot, t, beat, sb}) => {
  const key = typeof slot.shot.component === 'string' ? slot.shot.component : '';
  const Comp = key ? CUSTOM_SHOTS[key] : undefined;
  const theme = useTheme();
  const geo = geometryOf(aspectOf(sb));
  const fps = 30;
  if (typeof Comp !== 'function') {
    throw new Error(`第 ${slot.i + 1} 镜（custom）组件没注册：${key || '（空）'}`);
  }
  const props: CustomShotProps = {
    slots: (slot.shot.slots ?? {}) as Record<string, unknown>,
    theme,
    geo,
    frame: Math.round(t * fps),
    fps,
    t,
    dur: slot.dur,
    frames: Math.max(1, Math.round(slot.dur * fps)),
    lang: sb.meta?.lang === 'en' ? 'en' : 'zh',
    beat,
    index: slot.i,
  };
  try {
    return Comp(props);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const line = lineInStack(String(err.stack ?? ''), key);
    const head = `第 ${slot.i + 1} 镜（custom）${key}${line ? ':' + line : ''}`;
    const wrapped = new Error(`${head}：${err.message}`);
    wrapped.stack = err.stack;
    console.error(wrapped.message);
    if (err.stack) console.error(err.stack);
    throw wrapped;
  }
};
