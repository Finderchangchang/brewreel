import type React from 'react';
import type {ShotProps, SfxCtx, SfxCue} from '../../../core/types';
import tokens from '../tokens.json';

// ============================================================
// journey / district：一个街区 = 8 拍。画面由 film.tsx 画（一镜到底），这里只导出音效卡点：
// 第 0 拍路牌经过角色（轻 tick）+ 该街区类型的笑点音效（tokens.scenes[scene].sfx，单位拍）。
// ============================================================
const District: React.FC<ShotProps> = () => null;
export default District;

export const sfx = (p: Record<string, unknown>, {beat}: SfxCtx): SfxCue[] => {
  const tk = tokens as any;
  const scene = typeof p?.scene === 'string' && tk.scenes[p.scene] ? p.scene : tk.sceneOrder[0];
  const [sk, sv] = tk.sfx.signPass;
  const out: SfxCue[] = [{at: 0, kind: sk, vol: sv}];
  for (const [b, kind, vol] of tk.scenes[scene].sfx as [number, string, number][]) out.push({at: b * beat, kind, vol});
  return out;
};