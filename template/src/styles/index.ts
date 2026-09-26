// ============================================================
// 风格查找：分镜 → 风格定义 → 这个风格能用的镜头（专属镜头 + 允许复用的公共镜头）。
// 注册表 registry.gen.ts 由 scripts/gen-styles.mjs 生成，不要手改。
// ============================================================
import {isAspect} from '../core/safe';
import type {ShotModule, ShotSpec} from '../core/types';
import type {Storyboard} from '../schema';
import {moduleOf as commonModuleOf, specOf as commonSpecOf} from '../shots';
import {STYLES} from './registry.gen';
import type {StyleDef} from './types';

export {STYLES};
export const DEFAULT_STYLE = 'cards';
export const STYLE_IDS = Object.keys(STYLES);

export const styleIdOf = (sb?: Partial<Storyboard> | null): string => {
  const id = (sb?.meta as {style?: string} | undefined)?.style;
  return id && STYLES[id] ? id : DEFAULT_STYLE;
};
export const styleDefOf = (sb?: Partial<Storyboard> | null): StyleDef => STYLES[styleIdOf(sb)];

export type ShotLookup = {specOf: (type: string) => ShotSpec | undefined; moduleOf: (type: string) => ShotModule | undefined};

/** 这个风格能用的镜头：先找专属镜头，再找 commonShots 允许的公共镜头 */
export const lookupOf = (def: StyleDef): ShotLookup => {
  const cs = def.manifest.commonShots;
  const allow = (t: string) => cs === '*' || (Array.isArray(cs) && cs.includes(t));
  return {
    specOf: (t) => def.shots[t]?.spec ?? (allow(t) ? commonSpecOf(t) : undefined),
    moduleOf: (t) => def.shots[t]?.mod ?? (allow(t) ? commonModuleOf(t) : undefined),
  };
};

/** 画幅：meta.aspect，不写用风格默认 */
export const aspectOf = (sb?: Partial<Storyboard> | null): string => {
  const a = (sb?.meta as {aspect?: string} | undefined)?.aspect;
  return isAspect(a) ? a : styleDefOf(sb).manifest.defaultAspect;
};

/** 补上风格默认值（目前只有 bpm）。cards 原样返回，行为和改造前完全一样 */
export const withStyleDefaults = <T extends Storyboard>(sb: T): T => {
  if (styleIdOf(sb) === DEFAULT_STYLE) return sb;
  const def = styleDefOf(sb);
  if (sb.meta?.bpm) return sb;
  return {...sb, meta: {...sb.meta, bpm: def.manifest.bpm}};
};
