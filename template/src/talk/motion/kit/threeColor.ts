// 一个外观是不是「底 + 一个强调色 + 一个深色」。
// 对应原理：底占大面积，强调色只给锚点，深色做边和投影。
// 碎屑可以用别的颜色，但不能再拿强调色（或和强调色 ΔE00 ≤ 8 的颜色），不然锚点不再是唯一的那一块。
// 底和强调色至少差 ΔE00 10，否则第 0 帧卡片会融进纸里。

import {deltaE} from './color.ts';
import {luminance} from '../palette.ts';

const HEX = /^#[0-9a-fA-F]{6}$/;

export type ThreeColorInput = {
  bg: string;
  accent: string;
  /** 深色：边、字、投影那一支 */
  dark: string;
  /** 碎屑色。不传就不查 */
  scraps?: string[];
};

export const threeColor = (p: ThreeColorInput): {ok: boolean; problems: string[]} => {
  const problems: string[] = [];
  if (!HEX.test(p.bg) || !HEX.test(p.accent) || !HEX.test(p.dark)) {
    problems.push('bg, accent and dark must be #RRGGBB');
    return {ok: false, problems};
  }
  if (p.accent.toLowerCase() === p.bg.toLowerCase()) problems.push('accent must differ from bg');
  if (p.accent.toLowerCase() === p.dark.toLowerCase()) problems.push('accent must differ from dark');
  if (luminance(p.dark) >= luminance(p.bg)) problems.push('dark must be darker than bg');
  const de = deltaE(p.bg, p.accent);
  if (!Number.isFinite(de) || de < 10) problems.push('bg and accent need deltaE 10 or more');
  for (const s of p.scraps ?? []) {
    if (!HEX.test(s)) {
      problems.push('scrap is not hex');
      continue;
    }
    if (s.toLowerCase() === p.accent.toLowerCase()) problems.push('scrap reuses accent');
    else if (deltaE(s, p.accent) <= 8) problems.push('scrap is too close to accent');
  }
  return {ok: problems.length === 0, problems};
};
