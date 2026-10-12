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
