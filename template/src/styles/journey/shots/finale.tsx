import type React from 'react';
import type {ShotProps, SfxCue} from '../../../core/types';
import tokens from '../tokens.json';

// ============================================================
// journey / finale：片尾「终点检票」。画面由 film.tsx + parts/outro.tsx 画：相机减速停在终点、城市转成夜景暖光 →
// 顶部车票滑到画面中间展开成大票（swish），角色跳上票沿 →（有数字时）正面终点旗旁打出一行累计（tick ×2）→
// 检票钳在票根上打孔（tap）→ 车票翻面（swish）→ 背面落定：终点站 + 产品名、口号、获取方式（ding）→
// 角色踩滑板冲出画面右侧（whoosh），最后只剩车票。
// ============================================================
const Finale: React.FC<ShotProps> = () => null;
export default Finale;

export const sfx = (p: Record<string, unknown>): SfxCue[] => {
  const tk = tokens as any;
  const m = tk.motion;
  const hasStat = Array.isArray(p?.stats) && p.stats.length > 0;
  const [mk, mv] = tk.sfx.ticketMove;
  const [ak, av] = tk.sfx.tally;
  const [pk, pv] = tk.sfx.punch;
  const [fk, fv] = tk.sfx.flip;
  const [sk, sv] = tk.sfx.settle;
  const [dk, dv] = tk.sfx.dash;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const a0: number = m.finTallyAt;
  return [
    {at: 0.05, kind: mk, vol: mv},
    ...(hasStat ? [r2(a0 + 0.08), r2(a0 + m.finTally * 0.7)].map((at) => ({at, kind: ak, vol: av})) : []),
    {at: m.finPunch, kind: pk, vol: pv},
    {at: m.finFlipAt, kind: fk, vol: fv},
    {at: r2(m.finFlipAt + m.finFlip + 0.05), kind: sk, vol: sv},
    {at: r2(m.finDashAt + 0.1), kind: dk, vol: dv},
  ];
};
