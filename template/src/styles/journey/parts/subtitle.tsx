import React from 'react';
import {buildPages, charState, pageAt, pageFade, planVoice} from '../../../core/voice';
import type {Storyboard} from '../../../schema';
import type {Slot} from '../../../core/timeline';
import type {World} from './city';
import {mixHex} from './city';

// ============================================================
// journey 的配音字幕：本风格原来没有字幕带。有 props.voice 时加一条克制的单行字幕条——
// 纸色小条 + 石墨细描边，放在角色脚下和路牌之间（9:16 中心 y≈1140；4:5 放路牌下面 y≈1086），
// 不压顶部车票、明信片、角色；片尾大车票展开时让到大票下沿。
// 逐字点亮：念过的字墨色、正在念的字主色、没念到的字浅灰；{} 强调词念过后保持主色。
// 位置可用 tokens.layout.<画幅>.sub = [中心 y, 片尾中心 y] 覆盖。
// ============================================================

const DEFAULT_SUB: Record<string, [number, number]> = {'9:16': [1140, 1300], '4:5': [1086, 1086]};

export const JourneySub: React.FC<{w: World; sb: Storyboard; slots: Slot[]; finTicketBottom?: number}> = ({w, sb, slots, finTicketBottom}) => {
  const {t, pal, tk, geo, lay} = w;
  const plan = React.useMemo(() => planVoice(sb, slots), [sb, slots]);
  const aspectKey = geo.h > 1500 ? '9:16' : '4:5';
  const size: number = tk.type?.subtitle ?? (aspectKey === '9:16' ? 40 : 38);
  const padX = 26;
  const maxW = geo.safe.x1 - geo.safe.x0 - padX * 2 - 6;
  const pages = React.useMemo(
    () => (plan && plan.mode !== 'off' ? buildPages(plan, slots, sb, {lang: w.lang, maxW, maxSize: size, minSize: 32, maxLines: 1}) : []),
    [plan, slots, sb, w.lang, maxW, size],
  );
  const total = slots.length ? slots[slots.length - 1].end : 0;
  const p = pageAt(pages, t, total);
  if (!plan || !p) return null;
  const {op, dy} = pageFade(pages, p, t, total);
  const [cy0, cyFin] = (lay.sub as [number, number] | undefined) ?? DEFAULT_SUB[aspectKey];
  const fin = (slots[p.shot]?.shot.type as string | undefined) === 'finale';
  const hBox = p.size * 1.3 + 16;
  // 片尾：让到大车票下沿（不超出安全区下沿）
  let cy = fin ? cyFin : cy0;
  if (fin && finTicketBottom !== undefined) cy = Math.max(cy, Math.min(finTicketBottom + 14 + hBox / 2, geo.safe.y1 - hBox / 2));
  const ink = pal.ink;
  const karaoke = plan.mode === 'karaoke';
  const dimInk = mixHex(ink, pal.paper ?? '#FFFFFF', 0.62);
  const dimBrand = mixHex(pal.brand, pal.paper ?? '#FFFFFF', 0.5);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: Math.round(cy - hBox / 2), display: 'flex', justifyContent: 'center', opacity: op, transform: dy ? `translateY(${dy}px)` : undefined}}>
      <div
        key={p.key}
        style={{
          padding: `6px ${padX}px 8px`,
          borderRadius: tk.radius?.bubble ?? 16,
          background: pal.paper ?? pal.card,
          border: `3px solid ${ink}`,
          boxShadow: `0 5px 0 rgba(0,0,0,0.12)`,
          fontSize: p.size,
          fontWeight: tk.font?.strongWeight ?? 700,
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        {p.lines[0]?.map((c, j) => {
          const s = karaoke ? charState(c, t).s : 2;
          const color = s === 1 ? pal.brand : s === 2 ? (c.hot ? pal.brand : ink) : c.hot ? dimBrand : dimInk;
          return (
            <span key={j} style={{color}}>
              {c.c === ' ' ? ' ' : c.c}
            </span>
          );
        })}
      </div>
    </div>
  );
};
