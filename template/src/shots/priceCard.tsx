import React from 'react';
import {interpolate} from 'remotion';
import {bump, clamp, pop} from '../core/anim';
import {fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon} from '../core/icons';
import {CARD, MAIN} from '../core/safe';
import {alpha, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// priceCard：价格卡 / 价目表（docs/dev/industry-design.md §1.2）。
// 主角 = 价格数字「盖章」落定（一次性弹一下，不持续闪烁/抖动，符合设计 §1.2 的排版要求）。
//   card：label+人数 → 价格(+划线对比价) → 套餐名 → 分隔线 → 包含项清单 → 限制/另收/条件/活动期 → 赠品 → 脚注
//   menu：label → 逐行价目（名称…leader…价格/单位）→ 同上共享信息块 → 脚注
// 不写"原价"二字：compare 只显示 basis 本身（如"厂商建议零售价"）。
// ============================================================
type Item = {itemId?: string; name?: string; price?: number; unit?: string; from?: boolean; fromNote?: string; note?: string};
type AddOn = {cond: string; extra: string};
type Compare = {price: number; basis: string; evidence?: string};
type Gift = {name: string; qty: number};
type P = {
  layout?: 'card' | 'menu';
  items: Item[];
  label?: string;
  people?: string;
  includes?: string[];
  excludes?: string;
  limits?: string[];
  conditions?: string;
  period?: string;
  addOns?: AddOn[];
  compare?: Compare;
  gift?: Gift;
  footnote?: string;
};

const PAD = 34;
const GAP = 16;

// ---------- 小工具行 ----------
const IncludeRow: React.FC<{text: string; t: number; at: number; c: string}> = ({text, t, at, c}) => {
  const th = useTheme();
  const q = pop(t, at, 14, 210);
  if (t < at) return null;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 14, height: 44, opacity: Math.min(1, q * 1.8), transform: `translateX(${(1 - q) * -24}px)`}}>
      <div style={{width: 34, height: 34, borderRadius: 17, background: alpha(c, 0.16), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}>
        <Icon name="check" size={20} color={c} stroke={3.2} />
      </div>
      <span style={{fontSize: 34, fontWeight: 700, color: th.cardText, whiteSpace: 'nowrap'}}>{text}</span>
    </div>
  );
};

const Chip: React.FC<{text: string; t: number; at: number; tone?: 'warn' | 'neutral'}> = ({text, t, at, tone = 'neutral'}) => {
  const q = pop(t, at, 14, 220);
  if (t < at) return null;
  const th = useTheme();
  const c = tone === 'warn' ? th.warn : th.cardSub;
  return (
    <div
      style={{
        padding: '8px 18px',
        borderRadius: 20,
        background: alpha(c, th.dark ? 0.2 : 0.12),
        color: c,
        fontSize: 26,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        opacity: Math.min(1, q * 1.8),
        transform: `scale(${0.8 + 0.2 * q})`,
      }}
    >
      {text}
    </div>
  );
};

const NoteLine: React.FC<{icon: string; text: string; t: number; at: number; strong?: boolean; size?: number}> = ({icon, text, t, at, strong, size = 30}) => {
  const th = useTheme();
  const q = pop(t, at, 14, 210);
  if (t < at) return null;
  return (
    <div style={{display: 'flex', alignItems: 'flex-start', gap: 10, opacity: Math.min(1, q * 1.8), transform: `translateY(${(1 - q) * 10}px)`}}>
      <Icon name={icon} size={size} color={strong ? th.accent : th.cardMuted} stroke={2.4} style={{marginTop: 2, flex: 'none'}} />
      <span style={{fontSize: size, fontWeight: strong ? 800 : 600, color: strong ? th.cardText : th.cardSub, lineHeight: 1.3}}>{text}</span>
    </div>
  );
};

// ---------- 分隔线（票据感：虚线 + 两侧圆点） ----------
const Divider: React.FC<{w: number; c: string}> = ({w, c}) => (
  <div style={{position: 'relative', width: w, height: 2, borderTop: `3px dashed ${c}`}}>
    <div style={{position: 'absolute', left: -PAD - 6, top: -7, width: 16, height: 16, borderRadius: 8, background: c}} />
    <div style={{position: 'absolute', right: -PAD - 6, top: -7, width: 16, height: 16, borderRadius: 8, background: c}} />
  </div>
);

// ---------- 大价格（card 布局） ----------
const PriceBlock: React.FC<{item?: Item; compare?: Compare; label?: string; t: number; w: number}> = ({item, compare, label, t, w}) => {
  const th = useTheme();
  const settle = 0.22;
  const q = pop(t, 0.05, 13, 180);
  const hit = bump(t, settle, 0.5);
  const priceStr = item?.price !== undefined ? String(item.price) : '--';
  const size = Math.max(96, Math.min(150, Math.floor((w - (item?.from ? 60 : 0)) / (priceStr.length * 0.62 + 1.2))));
  const unitSize = Math.max(34, Math.round(size * 0.46));
  const strike = interpolate(t, [settle - 0.15, settle], [0, 1], clamp);
  const cmpP = pop(t, settle + 0.1, 12, 200);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
      {label && (
        <div style={{opacity: Math.min(1, q * 2), transform: `translateY(${(1 - q) * -10}px)`}}>
          <span style={{display: 'inline-block', padding: '6px 18px', borderRadius: 18, background: th.hot, color: '#1B1A18', fontSize: 26, fontWeight: 900}}>{label}</span>
        </div>
      )}
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10, transform: `scale(${1 + hit * 0.08})`, transformOrigin: '0% 60%'}}>
        <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 40, color: th.accent, opacity: Math.min(1, q * 2)}}>¥</span>
        <span style={{fontFamily: MONO, fontWeight: 800, fontSize: size, lineHeight: 1, color: th.accent, opacity: Math.min(1, q * 2)}}>{priceStr}</span>
        {item?.unit && <span style={{fontSize: unitSize, fontWeight: 700, color: th.accent, opacity: Math.min(1, q * 2)}}>/{item.unit}</span>}
        {item?.from && <span style={{fontSize: unitSize, fontWeight: 900, color: th.accent, opacity: Math.min(1, q * 2)}}>起</span>}
        {compare && (
          <span style={{position: 'relative', marginLeft: 8, fontFamily: MONO, fontSize: 34, fontWeight: 600, color: th.cardMuted, opacity: Math.min(1, cmpP * 2)}}>
            ¥{compare.price}
            {strike > 0 && <span style={{position: 'absolute', left: -4, top: '50%', height: 4, width: `calc(${strike * 100}% + 8px)`, background: th.cardMuted, transform: 'rotate(-3deg)'}} />}
          </span>
        )}
      </div>
      {compare && (
        <div style={{fontSize: 26, fontWeight: 700, color: th.cardMuted, opacity: Math.min(1, cmpP * 2)}}>依据：{compare.basis}</div>
      )}
      {item?.name && <div style={{marginTop: 2, fontSize: 38, fontWeight: 800, color: th.cardText, opacity: Math.min(1, q * 2)}}>{item.name}</div>}
      {item?.from && item?.fromNote && <div style={{fontSize: 28, fontWeight: 600, color: th.cardSub, opacity: Math.min(1, q * 2)}}>{item.fromNote}</div>}
      {item?.note && <div style={{fontSize: 28, fontWeight: 600, color: th.cardSub, opacity: Math.min(1, q * 2)}}>{item.note}</div>}
    </div>
  );
};

// ---------- 价目表行（menu 布局） ----------
const MenuRow: React.FC<{item: Item; i: number; t: number; at: number; w: number}> = ({item, i, t, at, w}) => {
  const th = useTheme();
  const q = pop(t, at, 14, 210);
  if (t < at) return null;
  const nameSize = fitLine(item.name ?? item.itemId ?? '', w * 0.5, 36, 30);
  return (
    <div style={{opacity: Math.min(1, q * 1.8), transform: `translateX(${(1 - q) * -20}px)`}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
        <span style={{fontSize: nameSize, fontWeight: 800, color: th.cardText, whiteSpace: 'nowrap'}}>{item.name ?? item.itemId}</span>
        <span style={{flex: 1, borderBottom: `2px dotted ${th.line}`, transform: 'translateY(-6px)'}} />
        <span style={{fontFamily: MONO, fontSize: 38, fontWeight: 800, color: th.accent, whiteSpace: 'nowrap'}}>
          ¥{item.price}
          <span style={{fontSize: 24, fontWeight: 600}}>/{item.unit}{item.from ? '起' : ''}</span>
        </span>
      </div>
      {(item.note || (item.from && item.fromNote)) && <div style={{fontSize: 24, fontWeight: 600, color: th.cardSub, marginTop: 2}}>{item.note ?? item.fromNote}</div>}
    </div>
  );
};

const PriceCard: React.FC<ShotProps<P>> = ({params: p, t}) => {
  const th = useTheme();
  const layout = p.layout ?? 'card';
  const items = (p.items ?? []).slice(0, layout === 'menu' ? 6 : 1);
  const w = CARD.w - PAD * 2;
  const enter = pop(t, 0, 15, 160);

  // ---- 逐段计算高度（只累计真正出现的段） ----
  const blocks: {h: number; render: (at: number) => React.ReactNode}[] = [];
  let clock = 0.42; // 头部占用的时间，用于下面各段的错落起点

  if (layout === 'card') {
    blocks.push({h: 132 + (items[0]?.name ? 50 : 0) + (items[0]?.from && items[0]?.fromNote ? 40 : 0) + (items[0]?.note ? 38 : 0) + (p.compare ? 74 : 0), render: () => null});
  } else {
    items.forEach(() => blocks.push({h: 62, render: () => null}));
  }
  if (p.includes?.length) blocks.push({h: 8 + p.includes.length * 46, render: () => null});
  if (p.limits?.length) blocks.push({h: 52, render: () => null});
  if (p.excludes) blocks.push({h: 44, render: () => null});
  if (p.conditions) blocks.push({h: 44, render: () => null});
  if (p.period) blocks.push({h: 44, render: () => null});
  if (p.addOns?.length) blocks.push({h: 8 + p.addOns.length * 40, render: () => null});
  if (p.gift) blocks.push({h: 50, render: () => null});

  const headH = (p.label && layout === 'menu') || p.people ? 54 : 0;
  const dividerCount = 1;
  const contentH = headH + blocks.reduce((a, b) => a + b.h + GAP, 0) + dividerCount * (24 + GAP);
  const footH = p.footnote ? 44 : 0;
  const cardH = Math.min(MAIN.h, PAD * 2 + contentH + footH);
  const cardY = MAIN.y0 + Math.max(0, Math.round((MAIN.h - cardH) / 2));

  let y = PAD;
  const rowAt = () => {
    clock += 0.07;
    return clock;
  };

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div
        style={{
          position: 'absolute',
          left: CARD.x0,
          top: cardY,
          width: CARD.w,
          minHeight: cardH,
          borderRadius: 40,
          background: th.card,
          boxShadow: th.shadow,
          boxSizing: 'border-box',
          padding: `${PAD}px ${PAD}px ${PAD - 8}px`,
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 46}px) scale(${0.94 + 0.06 * enter})`,
        }}
      >
        {/* 头部：label（menu 用）+ 人数 */}
        {headH > 0 && (
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: headH - GAP, opacity: Math.min(1, enter * 2)}}>
            {p.label && layout === 'menu' ? (
              <span style={{padding: '6px 18px', borderRadius: 18, background: th.hot, color: '#1B1A18', fontSize: 26, fontWeight: 900}}>{p.label}</span>
            ) : (
              <span />
            )}
            {p.people && (
              <div style={{display: 'flex', alignItems: 'center', gap: 8, color: th.cardSub, fontSize: 28, fontWeight: 700}}>
                <Icon name="users" size={26} color={th.cardSub} stroke={2.4} />
                {p.people}
              </div>
            )}
          </div>
        )}
        {headH > 0 && <div style={{height: GAP}} />}

        {/* 价格 / 价目表 */}
        {layout === 'card' ? (
          <PriceBlock item={items[0]} compare={p.compare} label={p.label} t={t} w={w} />
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: GAP}}>
            {items.map((it, i) => (
              <MenuRow key={i} item={it} i={i} t={t} at={0.1 + i * 0.09} w={w} />
            ))}
          </div>
        )}

        <div style={{height: GAP + 10}} />
        <Divider w={w} c={th.line} />
        <div style={{height: GAP + 6}} />

        {/* 包含项 */}
        {!!p.includes?.length && (
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            {p.includes.map((it, i) => (
              <IncludeRow key={i} text={it} t={t} at={rowAt()} c={th.good} />
            ))}
          </div>
        )}
        {!!p.includes?.length && <div style={{height: GAP - 6}} />}

        {/* 限制条件 */}
        {!!p.limits?.length && (
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 10}}>
            {p.limits.map((it, i) => (
              <Chip key={i} text={it} t={t} at={rowAt()} tone="warn" />
            ))}
          </div>
        )}
        {!!p.limits?.length && <div style={{height: GAP - 6}} />}

        {/* 另收费用 / 条件 / 活动期 */}
        {p.excludes && <NoteLine icon="alert" text={`另收：${p.excludes}`} t={t} at={rowAt()} size={28} />}
        {p.excludes && <div style={{height: 8}} />}
        {p.conditions && <NoteLine icon="doc" text={p.conditions} t={t} at={rowAt()} strong size={30} />}
        {p.conditions && <div style={{height: 8}} />}
        {p.period && <NoteLine icon="calendar" text={p.period} t={t} at={rowAt()} size={28} />}
        {p.period && <div style={{height: 8}} />}

        {/* 加价项 */}
        {!!p.addOns?.length && (
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            {p.addOns.map((a, i) => {
              const at = rowAt();
              const q = pop(t, at, 14, 210);
              if (t < at) return null;
              return (
                <div key={i} style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 26, fontWeight: 600, color: th.cardSub, opacity: Math.min(1, q * 2)}}>
                  <Icon name="arrow" size={20} color={th.cardMuted} stroke={2.4} />
                  {/* extra 有的写法自带"+"（如"+80元"），有的不带（"80元"）：这里统一去掉模型可能带的前导"+"再自己加一个，避免画面出现"++80元" */}
                  {a.cond} +{String(a.extra ?? '').replace(/^\+/, '')}
                </div>
              );
            })}
          </div>
        )}

        {/* 赠品 */}
        {p.gift &&
          (() => {
            const at = rowAt();
            const q = pop(t, at, 11, 230);
            return t < at ? null : (
              <div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, opacity: Math.min(1, q * 1.8), transform: `scale(${0.7 + 0.3 * q}) rotate(${(1 - q) * -8}deg)`, transformOrigin: '0% 50%'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 22, background: alpha(th.good, 0.14), color: th.good, fontSize: 28, fontWeight: 900}}>
                  <Icon name="gift" size={26} color={th.good} stroke={2.6} />
                  赠 {p.gift.name}×{p.gift.qty}
                </div>
              </div>
            );
          })()}

        {/* 脚注 */}
        {p.footnote && (
          <div style={{marginTop: 14, paddingTop: 10, borderTop: `2px solid ${th.line}`, fontSize: 26, fontWeight: 600, color: th.cardMuted, lineHeight: 1.3}}>{p.footnote}</div>
        )}
      </div>
    </div>
  );
};

export default PriceCard;

export const sfx = (p: P, _ctx: {dur: number; beat: number}): SfxCue[] => {
  const out: SfxCue[] = [{at: 0.05, kind: 'pop', vol: 0.22}, {at: 0.22, kind: 'thud', vol: 0.32}];
  if (p.compare) out.push({at: 0.07, kind: 'swish', vol: 0.16});
  return out;
};
