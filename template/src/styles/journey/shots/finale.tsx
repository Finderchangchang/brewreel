import type React from 'react';
import type {ShotProps, SfxCue} from '../../../core/types';
import tokens from '../tokens.json';

// ============================================================
// journey / finale：片尾集章卡。画面由 film.tsx 画：相机减速停在终点、城市压暗 → 集章卡从下方升起（swish）
// → 各站依次盖章（嗒 ×4，站多就盖得密）→ 数据滚动计数（嗒嗒 + 叮）→ 主色「到站」圆章 + 口号（pop），角色在卡片左下挥手。
// ============================================================
const Finale: React.FC<ShotProps> = () => null;
export default Finale;

export const sfx = (p: Record<string, unknown>): SfxCue[] => {
  const tk = tokens as any;
  const m = tk.motion;
  const hasStats = Array.isArray(p?.stats) && p.stats.length > 0;
  const [rk, rv] = tk.sfx.cardRise;
  const [sk, sv] = tk.sfx.stamp;
  const [ck, cv] = tk.sfx.count;
  const [dk, dv] = tk.sfx.countDone;
  const [bk, bv] = tk.sfx.seal;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const c0: number = m.countAt;
  const c1: number = m.countAt + m.counter;
  return [
    {at: m.stampCardAt, kind: rk, vol: rv},
    ...[0, 1, 2, 3].map((i) => ({at: r2(m.stampAt + (i * m.stampSpan) / 3), kind: sk, vol: sv})),
    ...(hasStats ? [r2(c0 + 0.2), r2(c0 + 0.45)].map((at) => ({at, kind: ck, vol: cv})) : []),
    ...(hasStats ? [{at: r2(c1), kind: dk, vol: dv}] : []),
    {at: m.sealAt, kind: bk, vol: bv},
  ];
};