// 场景 A / B 的打扮。只描述已经在令牌里的角色怎么用，不新造色。
// techbrief 没有条目：画面继续走原来的分支。
import look from './styles/look.json' with {type: 'json'};

export type SceneDress = {
  stage: 'blobs' | 'paper-grid';
  titleFont: 'sans' | 'serif';
  kickerWeight: number;
  titleWeight: number;
  bodyWeight: number;
  noteWeight: number;
  kickerTrackingEm: number;
  emphasis: 'block' | 'marker' | 'line';
  number: 'pill' | 'rule';
  step: 'disc' | 'index';
  evidence: 'rounded' | 'hairline';
  split: 'accent-bar' | 'column-rule';
  end: 'chip' | 'masthead';
};

const TABLE = look as Record<string, SceneDress>;

/** 没有条目的风格（含 techbrief）返回 null，渲染保持原样。 */
export function dressOf(style: string): SceneDress | null {
  return TABLE[style] ?? null;
}

/** 卡片左右内边距。强调色块的外沿要留出同样宽的空隙。 */
export const CARD_PAD_X = 18;
/** 强调色块左右各加这么宽，算进字宽，避免色块贴住卡片边。 */
export const BLOCK_CHIP_EM = 0.12;

/**
 * 新鲜浅色左下那一块。大圆角、离开画面边缘，不是贴边的直角矩形。
 * 渲染只读这些数，单测锁住形状。
 */
export function freshLowerBlob(): {left: number; bottom: number; width: number; height: number; radius: number} {
  return {left: 36, bottom: 72, width: 420, height: 340, radius: 170};
}

/** 没有 kicker 时，新鲜浅色不画标题上方那截强调色短线。别的风格照旧。 */
export function showTitleTick(stage: string | undefined, hasKicker: boolean, mark: boolean): boolean {
  if (!mark) return false;
  if (stage === 'blobs' && !hasKicker) return false;
  return true;
}

/** 色块强调时，把色块自己的左右内边距从可排字宽度里扣掉。 */
export function chipFitWidth(innerWidth: number, fontPx: number, chip: boolean): number {
  const width = Math.max(8, innerWidth);
  if (!chip) return width;
  const pad = Math.ceil(Math.max(1, fontPx) * BLOCK_CHIP_EM) * 2;
  return Math.max(8, width - pad);
}
