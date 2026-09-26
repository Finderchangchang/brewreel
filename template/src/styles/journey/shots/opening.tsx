import type React from 'react';
import type {ShotProps, SfxCtx, SfxCue} from '../../../core/types';
import tokens from '../tokens.json';

// ============================================================
// journey / opening：钩子（第 0 帧就有完整城市 + 角色 + 车票 + 翻牌大字）。画面由整片渲染器 film.tsx 画，这里只导出音效卡点。
// 翻牌大字从 flipAt 起逐块翻一下（嗒嗒）→ 第 1 拍角色喊口令（气泡）→ 起飞加速（whoosh）→ 最后牌子逐块上翻退场。
// ============================================================
const Opening: React.FC<ShotProps> = () => null;
export default Opening;

export const sfx = (_p: Record<string, unknown>, {dur}: SfxCtx): SfxCue[] => {
  const tk = tokens as any;
  const [fk, fv] = tk.sfx.hookFlip;
  const [wk, wv] = tk.sfx.takeoff;
  const f0: number = tk.motion.flipAt;
  return [
    {at: f0, kind: fk, vol: fv},
    {at: Math.round((f0 + 0.12) * 100) / 100, kind: fk, vol: fv * 0.8},
    {at: Math.round(dur * tk.camera.takeoffFrom * 100) / 100 + 0.05, kind: wk, vol: wv},
  ];
};