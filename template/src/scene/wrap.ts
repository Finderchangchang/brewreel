// 场景上屏文字的断行。不另写分词：两行以内和单字行禁令直接用口播剪纸的 anchorLines
// （template/src/talk/motion/anchorLayout.ts，Intl.Segmenter 词界、两边都至少两个字）。
// 一句在下限字号仍宽过该行时，再对那一行调用同一个函数，从而减少每行字数。
// 放不下先缩字号，是 anchorLines 自己的顺序：一行能在下限以上放下就不成两行。
import {anchorLines} from '../talk/motion/anchorLayout.ts';
import {textEm} from '../talk/motion/measure.ts';

export type SceneCopy = {font: number; lines: string[]};

function splitFurther(text: string, maxW: number, maxPx: number, minPx: number, depth: number): SceneCopy {
  const fitted = anchorLines(text, maxW, maxPx, minPx);
  if (depth >= 5 || fitted.lines.length <= 1) return fitted;
  const next: string[] = [];
  let font = fitted.font;
  let changed = false;
  for (const line of fitted.lines) {
    if (line !== text && textEm(line) * minPx > maxW + 0.5) {
      const part = splitFurther(line, maxW, minPx, minPx, depth + 1);
      next.push(...part.lines);
      font = Math.min(font, part.font);
      changed = true;
    } else next.push(line);
  }
  if (!changed) return fitted;
  return {font, lines: next};
}

/** 标题、卡片、条目、口播行共用。字号夹在 [minPx, maxPx]，不拆词，不把一个字单独放成一行。 */
export function fitSceneCopy(text: string, maxW: number, maxPx: number, minPx: number): SceneCopy {
  const raw = String(text ?? '').replace(/[ \t]+/gu, ' ').trim();
  const lo = Math.max(1, Math.floor(Number.isFinite(minPx) ? minPx : 1));
  const hi = Math.max(lo, Math.floor(Number.isFinite(maxPx) ? maxPx : lo));
  if (!raw) return {font: lo, lines: []};
  return splitFurther(raw, Math.max(1, maxW), hi, lo, 0);
}
