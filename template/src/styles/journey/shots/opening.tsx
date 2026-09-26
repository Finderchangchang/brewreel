import type React from 'react';
import type {ShotProps, SfxCtx, SfxCue} from '../../../core/types';
import tokens from '../tokens.json';

// ============================================================
// journey / opening：钩子（第 0 帧就有完整城市 + 角色 + 大字）。画面由整片渲染器 film.tsx 画，这里只导出音效卡点。
// 0 秒大字弹出（pop）→ 第 1 拍角色喊口令（气泡）→ 起飞加速（whoosh）→ 最后 0.15 秒大字缩出。
// ============================================================
const Opening: React.FC<ShotProps> = () => null;
export default Opening;

export const sfx = (_p: Record<string, unknown>, {dur}: SfxCtx): SfxCue[] => {
  const tk = tokens as any;
  const [pk, pv] = tk.sfx.hookPop;
  const [wk, wv] = tk.sfx.takeoff;
  return [
    {at: 0.05, kind: pk, vol: pv},
    {at: Math.round(dur * tk.camera.takeoffFrom * 100) / 100 + 0.05, kind: wk, vol: wv},
  ];
};