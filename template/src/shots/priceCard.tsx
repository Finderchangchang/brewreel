import React from 'react';
import {interpolate} from 'remotion';
import {bump, clamp, pop} from '../core/anim';
import {fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon} from '../core/icons';
import {pick, type Lang} from '../core/kit';
import {CARD, MAIN} from '../core/safe';
import {alpha, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// priceCard：价格卡 / 价目表（docs/dev/industry-design.md §1.2）。
// 主角 = 价格数字「盖章」落定（一次性弹一下，不持续闪烁/抖动，符合设计 §1.2 的排版要求）。
//   card：label+人数 → 价格(+划线对比价) → 套餐名 → 分隔线 → 包含项清单 → 限制/另收/条件/活动期 → 赠品 → 脚注
//         items 有 2–3 项时逐行堆叠（每行 名称/说明 + 价格），同名房型只写一次名字、行标题用 note（如「周日至周四」「周五周六」）；
//         4 项以上自动换成 menu 布局。任何一项都不丢（评审 evidence：旧版 card 只画 items[0]，468/周五周六 整条消失）。
//   menu：label → 逐行价目（名称…leader…价格/单位）→ 同上共享信息块 → 脚注
// 内容多到主体区放不下时：包含项改两列、间距收紧，最后整体缩小（下限 0.8，字号仍 ≥26px）。
// 卡片高度跟内容走，在 y 560–1340 里垂直居中（不再固定高度留大片空白）。
// 脚注和 meta.notices 底部提示条一字不差（忽略空格/标点）时不再重复画。
// 不写"原价"二字：compare 只显示 basis 本身（如"厂商建议零售价"）。固定文案走 pick(meta.lang, 中, 英)。
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

// spec 里 label / compare.basis 是中文枚举（行业规则按中文核对），英文片上屏时换成英文说法
const LABEL_EN: Record<string, string> = {
  售价: 'Price',
  到手价: 'Final price',
  券后价: 'After coupon',
  团购价: 'Deal price',
  套餐价: 'Bundle price',
  活动价: 'Promo price',
  门票: 'Ticket',
};
const BASIS_EN: Record<string, string> = {
  前7日最低成交价: 'Lowest price in past 7 days',
  单点合计: 'Items ordered separately',
  厂商建议零售价: 'MSRP',
  吊牌价: 'Tag price',
  平日价: 'Weekday price',
};
const tr = (lang: Lang | undefined, zh: string, table: Record<string, string>) => pick(lang, zh, table[zh] ?? zh);

/** 比较用：去掉空格和常见标点 */
const norm = (s: string) => s.replace(/[\s·•・,，。.、:：;；!！?？()（）\-–—]/g, '');
/** 脚注是不是已经作为底部提示条出现了 */
const dupOfNotice = (text: string | undefined, notices: string[] | undefined) => {
  if (!text || !notices?.length) return false;
  const a = norm(text);
  return !!a && notices.some((n) => {
    const b = norm(n);
    return !!b && (a === b || a.includes(b) || b.includes(a));
  });
};

// ---------- 小工具行 ----------
const IncludeRow: React.FC<{text: string; t: number; at: number; c: string; maxW: number}> = ({text, t, at, c, maxW}) => {
  const th = useTheme();
  const q = pop(t, at, 14, 210);
  if (t < at) return null;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 14, height: 44, opacity: Math.min(1, q * 1.8), transform: `translateX(${(1 - q) * -24}px)`}}>
      <div style={{width: 34, height: 34, borderRadius: 17, background: alpha(c, 0.16), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}>
        <Icon name="check" size={20} color={c} stroke={3.2} />
      </div>
      <span style={{fontSize: fitLine(text, maxW - 48, 34, 28), fontWeight: 700, color: th.cardText, whiteSpace: 'nowrap'}}>{text}</span>
    </div>
  );
};

const Chip: React.FC<{text: string; t: number; at: number; tone?: 'warn' | 'neutral'}> = ({text, t, at, tone = 'neutral'}) => {
  const q = pop(t, at, 14, 220);
  const th = useTheme();
  if (t < at) return null;
  const c = tone === 'warn' ? th.warn : th.cardSub;
  return (
    <div
      style={{
        padding: '8px 18px',
        borderRadius: 20,
        background: alpha(c, th.dark ? 0.2 : 0.12),
        color: c,
        fontSize: 28,
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

const LabelPill: React.FC<{text: string; q: number}> = ({text, q}) => {
  const th = useTheme();
  return (
    <div style={{opacity: Math.min(1, q * 2), transform: `translateY(${(1 - q) * -10}px)`}}>
      <span style={{display: 'inline-block', padding: '6px 18px', borderRadius: 18, background: th.hot, color: '#1B1A18', fontSize: 28, fontWeight: 900}}>{text}</span>
    </div>
  );
};

/** 划线对比价（数字 + 一道斜线从左划到右） */
const Struck: React.FC<{price: number; t: number; settle: number; size?: number}> = ({price, t, settle, size = 34}) => {
  const th = useTheme();
  const strike = interpolate(t, [settle - 0.15, settle], [0, 1], clamp);
  const cmpP = pop(t, settle + 0.1, 12, 200);
  return (
    <span style={{position: 'relative', marginLeft: 8, fontFamily: MONO, fontSize: size, fontWeight: 600, color: th.cardMuted, opacity: Math.min(1, cmpP * 2), whiteSpace: 'nowrap'}}>
      ¥{price}
      {strike > 0 && <span style={{position: 'absolute', left: -4, top: '50%', height: 4, width: `calc(${strike * 100}% + 8px)`, background: th.cardMuted, transform: 'rotate(-3deg)'}} />}
    </span>
  );
};

// ---------- 大价格（card 布局，单项） ----------
const PriceBlock: React.FC<{item?: Item; compare?: Compare; label?: string; t: number; w: number; lang?: Lang}> = ({item, compare, label, t, w, lang}) => {
  const th = useTheme();
  const settle = 0.22;
  const q = pop(t, 0.05, 13, 180);
  const hit = bump(t, settle, 0.5);
  const priceStr = item?.price !== undefined ? String(item.price) : '--';
  const size = Math.max(96, Math.min(150, Math.floor((w - (item?.from ? 60 : 0)) / (priceStr.length * 0.62 + 1.2))));
  const unitSize = Math.max(34, Math.round(size * 0.46));
  const cmpP = pop(t, settle + 0.1, 12, 200);
  const en = lang === 'en';
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
      {label && <LabelPill text={tr(lang, label, LABEL_EN)} q={q} />}
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10, transform: `scale(${1 + hit * 0.08})`, transformOrigin: '0% 60%'}}>
        {item?.from && en && <span style={{fontSize: 34, fontWeight: 800, color: th.accent, opacity: Math.min(1, q * 2)}}>from</span>}
        <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 40, color: th.accent, opacity: Math.min(1, q * 2)}}>¥</span>
        <span style={{fontFamily: MONO, fontWeight: 800, fontSize: size, lineHeight: 1, color: th.accent, opacity: Math.min(1, q * 2)}}>{priceStr}</span>
        {item?.unit && <span style={{fontSize: unitSize, fontWeight: 700, color: th.accent, opacity: Math.min(1, q * 2)}}>/{item.unit}</span>}
        {item?.from && !en && <span style={{fontSize: unitSize, fontWeight: 900, color: th.accent, opacity: Math.min(1, q * 2)}}>{pick(lang, '起', '')}</span>}
        {compare && <Struck price={compare.price} t={t} settle={settle} />}
      </div>
      {compare && (
        <div style={{fontSize: 26, fontWeight: 700, color: th.cardMuted, opacity: Math.min(1, cmpP * 2)}}>
          {pick(lang, '依据：', 'Basis: ')}
          {tr(lang, compare.basis, BASIS_EN)}
        </div>
      )}
      {item?.name && <div style={{marginTop: 2, fontSize: fitLine(item.name, w, 38, 32), fontWeight: 800, color: th.cardText, opacity: Math.min(1, q * 2), whiteSpace: 'nowrap'}}>{item.name}</div>}
      {item?.from && item?.fromNote && <div style={{fontSize: 28, fontWeight: 600, color: th.cardSub, opacity: Math.min(1, q * 2)}}>{item.fromNote}</div>}
      {item?.note && <div style={{fontSize: 28, fontWeight: 600, color: th.cardSub, opacity: Math.min(1, q * 2)}}>{item.note}</div>}
    </div>
  );
};

// ---------- 多个价格（card 布局，2–3 项逐行堆叠） ----------
const multiRowH = (n: number) => (n === 2 ? 116 : 100);
const PriceStack: React.FC<{items: Item[]; compare?: Compare; label?: string; t: number; w: number; lang?: Lang}> = ({items, compare, label, t, w, lang}) => {
  const th = useTheme();
  const n = items.length;
  const q = pop(t, 0.05, 13, 180);
  const en = lang === 'en';
  // 同名（同一房型不同日期/同一套餐不同人数）：名字只写一次当小标题，行标题用 note/fromNote
  const sameName = items.every((it) => !!it.name && it.name === items[0].name) && items.every((it) => !!(it.note || it.fromNote));
  const priceSize = n === 2 ? 84 : 70;
  const rowH = multiRowH(n);
  const leftW = w * 0.5;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
      {(label || sameName) && (
        <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6}}>
          {label && <LabelPill text={tr(lang, label, LABEL_EN)} q={q} />}
          {sameName && <span style={{fontSize: fitLine(items[0].name ?? '', w - 200, 40, 32), fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap', opacity: Math.min(1, q * 2)}}>{items[0].name}</span>}
        </div>
      )}
      {items.map((it, i) => {
        const at = 0.05 + i * 0.22; // 每行落定间隔约半拍
        const rq = pop(t, at, 13, 180);
        const hit = bump(t, at + 0.17, 0.5);
        const title = sameName ? it.note ?? it.fromNote ?? '' : it.name ?? it.itemId ?? '';
        const sub = sameName ? (it.note && it.from ? it.fromNote : undefined) : it.note ?? (it.from ? it.fromNote : undefined);
        const priceStr = it.price !== undefined ? String(it.price) : '--';
        return (
          <div
            key={i}
            style={{
              height: rowH,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              borderTop: i ? `2px solid ${th.line}` : undefined,
              opacity: t < at ? 0 : Math.min(1, rq * 1.8),
              transform: `translateX(${(1 - rq) * -24}px)`,
            }}
          >
            <div style={{display: 'flex', flexDirection: 'column', gap: 4, width: leftW, minWidth: 0}}>
              <span style={{fontSize: fitLine(title, leftW, 38, 30), fontWeight: 800, color: th.cardText, whiteSpace: 'nowrap'}}>{title}</span>
              {sub && <span style={{fontSize: fitLine(sub, leftW, 28, 26), fontWeight: 600, color: th.cardSub, whiteSpace: 'nowrap'}}>{sub}</span>}
            </div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', transform: `scale(${1 + hit * 0.08})`, transformOrigin: '100% 60%'}}>
              {it.from && en && <span style={{fontSize: 28, fontWeight: 800, color: th.accent}}>from</span>}
              <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 34, color: th.accent}}>¥</span>
              <span style={{fontFamily: MONO, fontWeight: 800, fontSize: priceSize, lineHeight: 1, color: th.accent}}>{priceStr}</span>
              {it.unit && <span style={{fontSize: 34, fontWeight: 700, color: th.accent}}>/{it.unit}</span>}
              {it.from && !en && <span style={{fontSize: 34, fontWeight: 900, color: th.accent}}>{pick(lang, '起', '')}</span>}
            </div>
          </div>
        );
      })}
      {compare && (
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, paddingTop: 8, borderTop: `2px solid ${th.line}`, fontSize: 26, fontWeight: 700, color: th.cardMuted}}>
          <Struck price={compare.price} t={t} settle={0.3} size={30} />
          <span>
            {pick(lang, '依据：', 'Basis: ')}
            {tr(lang, compare.basis, BASIS_EN)}
          </span>
        </div>
      )}
    </div>
  );
};

// ---------- 价目表行（menu 布局） ----------
const MenuRow: React.FC<{item: Item; t: number; at: number; w: number; lang?: Lang; dense?: boolean}> = ({item, t, at, w, lang, dense}) => {
  const th = useTheme();
  const q = pop(t, at, 14, 210);
  if (t < at) return null;
  const name = item.name ?? item.itemId ?? '';
  const nameSize = fitLine(name, w * 0.5, dense ? 34 : 36, 30);
  const en = lang === 'en';
  const sub = item.note ?? (item.from ? item.fromNote : undefined);
  return (
    <div style={{opacity: Math.min(1, q * 1.8), transform: `translateX(${(1 - q) * -20}px)`}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
        <span style={{fontSize: nameSize, fontWeight: 800, color: th.cardText, whiteSpace: 'nowrap'}}>{name}</span>
        <span style={{flex: 1, borderBottom: `2px dotted ${th.line}`, transform: 'translateY(-6px)'}} />
        <span style={{fontFamily: MONO, fontSize: dense ? 36 : 38, fontWeight: 800, color: th.accent, whiteSpace: 'nowrap'}}>
          {item.from && en && <span style={{fontFamily: FONT, fontSize: 26, fontWeight: 700}}>from </span>}¥{item.price}
          <span style={{fontSize: 26, fontWeight: 600}}>
            {item.unit ? `/${item.unit}` : ''}
            {item.from ? pick(lang, '起', '') : ''}
          </span>
        </span>
      </div>
      {sub && <div style={{fontSize: 26, fontWeight: 600, color: th.cardSub, marginTop: 2}}>{sub}</div>}
    </div>
  );
};

const PriceCard: React.FC<ShotProps<P>> = ({params: p, t, meta}) => {
  const th = useTheme();
  const lang = meta?.lang;
  const all = p.items ?? [];
  // card 最多堆 3 个价格；再多自动换 menu。任何一项都不丢
  const layout: 'card' | 'menu' = (p.layout ?? 'card') === 'menu' || all.length > 3 ? 'menu' : 'card';
  const items = all;
  const w = CARD.w - PAD * 2;
  const enter = pop(t, 0, 15, 160);
  const footnote = dupOfNotice(p.footnote, meta?.notices) ? undefined : p.footnote;

  // ---- 估算高度：决定是否收紧（包含项两列 / 间距变小）以及最后的整体缩放 ----
  const est = (dense: boolean) => {
    let h = PAD * 2 - 8;
    const headH = (p.label && layout === 'menu') || p.people ? 54 : 0;
    h += headH;
    if (layout === 'card' && items.length <= 1) {
      const it = items[0];
      h += (p.label ? 54 : 0) + 150 + (it?.name ? 52 : 0) + (it?.from && it?.fromNote ? 40 : 0) + (it?.note ? 40 : 0) + (p.compare ? 38 : 0);
    } else if (layout === 'card') {
      h += 64 + items.length * (multiRowH(items.length) + 6) + (p.compare ? 44 : 0);
    } else {
      h += items.reduce((a, it) => a + (dense ? 50 : 56) + (it.note || (it.from && it.fromNote) ? 32 : 0) + (dense ? 10 : GAP), 0);
    }
    h += GAP + 10 + 3 + GAP + 6; // 分隔线
    const inc = p.includes?.length ?? 0;
    const incCols = dense && inc >= 3 ? 2 : 1;
    if (inc) h += Math.ceil(inc / incCols) * 50 + (GAP - 6);
    if (p.limits?.length) h += 56 * Math.ceil(p.limits.length / 3) + (GAP - 6);
    if (p.excludes) h += 44;
    if (p.conditions) h += 47;
    if (p.period) h += 44;
    if (p.addOns?.length) h += p.addOns.length * 40;
    if (p.gift) h += 54;
    if (footnote) h += 60;
    return h;
  };
  const dense = est(false) > MAIN.h;
  const estH = est(dense);
  const k = estH > MAIN.h ? Math.max(0.8, MAIN.h / estH) : 1;
  const incCols = dense && (p.includes?.length ?? 0) >= 3 ? 2 : 1;
  const colW = incCols === 2 ? (w - 16) / 2 : w;

  let clock = 0.42 + (layout === 'card' ? Math.max(0, items.length - 1) * 0.22 : Math.max(0, items.length - 3) * 0.09);
  const rowAt = () => {
    clock += 0.07;
    return clock;
  };
  const gapS = dense ? 6 : 8;
  const headH = (p.label && layout === 'menu') || p.people ? 54 : 0;

  return (
    <div style={{position: 'absolute', left: 0, top: MAIN.y0, width: 1080, height: MAIN.h, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT}}>
      <div
        style={{
          width: CARD.w,
          borderRadius: 40,
          background: th.card,
          boxShadow: th.shadow,
          boxSizing: 'border-box',
          padding: `${PAD}px ${PAD}px ${PAD - 8}px`,
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 46}px) scale(${((0.94 + 0.06 * enter) * k).toFixed(4)})`,
          flex: 'none',
        }}
      >
        {/* 头部：label（menu 用）+ 人数 */}
        {headH > 0 && (
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: headH - GAP, opacity: Math.min(1, enter * 2)}}>
            {p.label && layout === 'menu' ? (
              <span style={{padding: '6px 18px', borderRadius: 18, background: th.hot, color: '#1B1A18', fontSize: 28, fontWeight: 900}}>{tr(lang, p.label, LABEL_EN)}</span>
            ) : (
              <span />
            )}
            {p.people && (
              <div style={{display: 'flex', alignItems: 'center', gap: 8, color: th.cardSub, fontSize: 30, fontWeight: 700}}>
                <Icon name="users" size={28} color={th.cardSub} stroke={2.4} />
                {p.people}
              </div>
            )}
          </div>
        )}
        {headH > 0 && <div style={{height: GAP}} />}

        {/* 价格 / 价目表 */}
        {layout === 'card' ? (
          items.length <= 1 ? (
            <PriceBlock item={items[0]} compare={p.compare} label={p.label} t={t} w={w} lang={lang} />
          ) : (
            <PriceStack items={items} compare={p.compare} label={p.label} t={t} w={w} lang={lang} />
          )
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: dense ? 10 : GAP}}>
            {items.map((it, i) => (
              <MenuRow key={i} item={it} t={t} at={0.1 + i * 0.09} w={w} lang={lang} dense={dense} />
            ))}
          </div>
        )}

        <div style={{height: GAP + 10}} />
        <Divider w={w} c={th.line} />
        <div style={{height: GAP + 6}} />

        {/* 包含项（多了就两列） */}
        {!!p.includes?.length && (
          <div style={{display: 'grid', gridTemplateColumns: incCols === 2 ? `${colW}px ${colW}px` : `${w}px`, columnGap: 16, rowGap: 6}}>
            {p.includes.map((it, i) => (
              <IncludeRow key={i} text={it} t={t} at={rowAt()} c={th.good} maxW={colW} />
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
        {p.excludes && <NoteLine icon="alert" text={`${pick(lang, '另收：', 'Extra: ')}${p.excludes}`} t={t} at={rowAt()} size={28} />}
        {p.excludes && <div style={{height: gapS}} />}
        {p.conditions && <NoteLine icon="doc" text={p.conditions} t={t} at={rowAt()} strong size={30} />}
        {p.conditions && <div style={{height: gapS}} />}
        {p.period && <NoteLine icon="calendar" text={p.period} t={t} at={rowAt()} size={28} />}
        {p.period && <div style={{height: gapS}} />}

        {/* 加价项 */}
        {!!p.addOns?.length && (
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            {p.addOns.map((a, i) => {
              const at = rowAt();
              const q = pop(t, at, 14, 210);
              if (t < at) return null;
              return (
                <div key={i} style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 600, color: th.cardSub, opacity: Math.min(1, q * 2)}}>
                  <Icon name="arrow" size={22} color={th.cardMuted} stroke={2.4} />
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
                  {pick(lang, '赠 ', 'Free: ')}
                  {p.gift.name}×{p.gift.qty}
                </div>
              </div>
            );
          })()}

        {/* 脚注（和底部提示条重复时不画） */}
        {footnote && (
          <div style={{marginTop: 14, paddingTop: 10, borderTop: `2px solid ${th.line}`, fontSize: 26, fontWeight: 600, color: th.cardMuted, lineHeight: 1.3}}>{footnote}</div>
        )}
      </div>
    </div>
  );
};

export default PriceCard;

export const sfx = (p: P, _ctx: {dur: number; beat: number}): SfxCue[] => {
  const n = p.items?.length ?? 1;
  const card = (p.layout ?? 'card') === 'card' && n <= 3;
  const out: SfxCue[] = [{at: 0.05, kind: 'pop', vol: 0.22}];
  if (card && n >= 2) for (let i = 0; i < n; i++) out.push({at: 0.22 + i * 0.22, kind: i ? 'tick' : 'thud', vol: i ? 0.2 : 0.32});
  else out.push({at: 0.22, kind: 'thud', vol: 0.32});
  if (p.compare) out.push({at: 0.07, kind: 'swish', vol: 0.16});
  return out;
};
