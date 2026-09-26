import type React from 'react';
import type {ShotProps, SfxCtx, SfxCue} from '../../../core/types';
import tokens from '../tokens.json';

// ============================================================
// journey / finale：片尾。画面由 film.tsx 画：相机减速停下，数字卡落下滚动计数（嗒嗒 + 叮）→ 0.3 秒缩进浏览器框（swish）
// → 品牌卡弹出（pop）+ 类别 chips + 数据胶囊 + 彩纸，角色出框挥手。
// ============================================================
const Finale: React.FC<ShotProps> = () => null;
export default Finale;

export const sfx = (p: Record<string, unknown>): SfxCue[] => {
  const tk = tokens as any;
  const z = tk.camera.outroZoomAt as number;
  const hasStats = Array.isArray(p?.stats) && p.stats.length > 0;
  const [ck, cv] = tk.sfx.count;
  const [dk, dv] = tk.sfx.countDone;
  const [zk, zv] = tk.sfx.zoom;
  const [bk, bv] = tk.sfx.brandPop;
  return [
    ...(hasStats ? [0.3, 0.55, 0.8].map((at) => ({at, kind: ck, vol: cv})) : []),
    ...(hasStats ? [{at: 1.15, kind: dk, vol: dv}] : []),
    {at: z, kind: zk, vol: zv},
    {at: z + tk.camera.outroZoomDur + 0.05, kind: bk, vol: bv},
  ];
};