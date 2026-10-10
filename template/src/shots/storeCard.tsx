import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {bump, clamp, pop} from '../core/anim';
import {emWidth, fitLine} from '../core/fit';
import {FONT} from '../core/font';
import {Icon} from '../core/icons';
import {pick, type Lang} from '../core/kit';
import {CARD, MAIN} from '../core/safe';
import {alpha, textOnHot, useTheme} from '../core/theme';
import {labelInk} from '../core/plate';
import {useStylePalette} from '../styles/context';
import type {ShotProps, SfxCue} from '../core/types';
import {IllustScene} from '../illust/scene';

// ============================================================
// storeCard：门店、位置、到店指引（docs/dev/industry-design.md §1.3）。
// 不设电话/微信/二维码/网址/门牌号字段——组件也不画这些。
//   photo 门头实拍横幅 + 信息卡（没有照片时横幅换成整卡插画场景 illust/scene.tsx，角标「示意」）
//   map   代码画的抽象示意图：街区色块 + 道路 + 定位针；每条路线画一条虚线从目的地连到店，
//         目的地标签两行：「青禾高铁站」+「驾车 25分钟」（评审 evidence：旧版只写「驾车 25分钟」，r.to 被丢掉）。
//         landmark/hours/parking/pickup/badges/cta/disclaimer 放在图下方的信息条里，不再静默丢掉。不模仿任何地图 App 界面。
//   card  纯排版信息卡；卡片高度跟内容走，内容少时上方自动补一条插画横幅，不再留大片空白。
// 主角 = 定位针落地（弹一下）+ 路线依次从目的地连到店。
// disclaimer 和 meta.notices 底部提示条重复时不再画（评审 evidence：美业片「生活美容·不提供医疗美容服务」出现两次）。
// 固定文案走 pick(meta.lang, 中, 英)。
// ============================================================
type Mode = '步行' | '驾车' | '打车' | '公交' | '地铁' | '骑行' | '接驳车'; // i18n-ignore（枚举值，上屏走 modeText 的 pick）
const METRO = '地铁'; // i18n-ignore（枚举值比较用，不上屏）
const MEASURED = '实测'; // i18n-ignore（枚举值比较用，不上屏）
type Route = {to: string; mode: Mode; minutes?: number; km?: number};
type P = {
  layout?: 'photo' | 'map' | 'card';
  name: string;
  landmark?: string;
  hours?: string;
  photo?: string;
  routes?: Route[];
  basis?: '导航估算' | '实测'; // i18n-ignore（枚举值，不上屏）
  parking?: string;
  pickup?: string;
  badges?: string[];
  cta?: string;
  disclaimer?: string;
};

const MODE_EN: Record<string, string> = {步行: 'Walk', 驾车: 'Drive', 打车: 'Taxi', 公交: 'Bus', 地铁: 'Metro', 骑行: 'Bike', 接驳车: 'Shuttle'};
const modeText = (lang: Lang | undefined, m: string) => pick(lang, m, MODE_EN[m] ?? m);
/** 「驾车 25分钟 · 3km」/ "Drive 25 min · 3km" */
const howText = (lang: Lang | undefined, r: Route) => {
  const mins = r.minutes !== undefined ? pick(lang, `${r.minutes}分钟`, `${r.minutes} min`) : '';
  const km = r.km !== undefined ? ` · ${r.km}km` : '';
  return `${modeText(lang, r.mode)} ${mins}${km}`.trim();
};

/** 行业 → 门店兜底插画 */
const STORE_ILLUST: Record<string, string> = {
  food: 'food/storefront',
  travel: 'travel/house',
  beauty: '_base/store',
  education: '_base/store',
  ecommerce: '_base/store',
  software: '_base/store',
};

/** 比较用：去掉空格和常见标点 */
const norm = (s: string) => s.replace(/[\s·•・,，。.、:：;；!！?？()（）\-–—]/g, '');
const dupOfNotice = (text: string | undefined, notices: string[] | undefined) => {
  if (!text || !notices?.length) return false;
  const a = norm(text);
  return !!a && notices.some((n) => {
    const b = norm(n);
    return !!b && (a === b || a.includes(b) || b.includes(a));
  });
};

// ---------- 本地图标（icons.json 没有定位/地铁，按同款线条风格现画，不改 core） ----------
const Pin: React.FC<{size?: number; color?: string}> = ({size = 28, color = 'currentColor'}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s7-6.8 7-12.2A7 7 0 1 0 5 8.8C5 14.2 12 21 12 21z" />
    <circle cx="12" cy="8.6" r="2.6" />
  </svg>
);
/** 实心大头针（地图上的主角） */
const PinSolid: React.FC<{size?: number; color: string; dot: string}> = ({size = 64, color, dot}) => (
  <svg width={size} height={size * 1.2} viewBox="0 0 40 48" style={{display: 'block', overflow: 'visible'}}>
    <path d="M20 46s16-14.5 16-27A16 16 0 1 0 4 19c0 12.5 16 27 16 27z" fill={color} />
    <circle cx="20" cy="18.5" r="6.5" fill={dot} />
  </svg>
);
const Subway: React.FC<{size?: number; color?: string}> = ({size = 24, color = 'currentColor'}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="4" width="14" height="13" rx="5" />
    <circle cx="9" cy="12.5" r="1" fill={color} stroke="none" />
    <circle cx="15" cy="12.5" r="1" fill={color} stroke="none" />
    <path d="M9 20l-2 2M15 20l2 2" />
  </svg>
);

const RouteChip: React.FC<{r: Route; t: number; at: number; lang?: Lang; maxW: number}> = ({r, t, at, lang, maxW}) => {
  const th = useTheme();
  const q = pop(t, at, 14, 210);
  if (t < at) return null;
  const text = `${r.to} · ${howText(lang, r)}`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px',
        borderRadius: 24,
        background: th.cardAlt,
        opacity: Math.min(1, q * 1.8),
        transform: `translateX(${(1 - q) * -20}px)`,
      }}
    >
      {r.mode === METRO ? <Subway size={28} color={th.accentInk} /> : <div style={{width: 12, height: 12, borderRadius: 6, background: th.accentFill, flex: 'none'}} />}
      <span style={{fontSize: fitLine(text, maxW - 70, 30, 26), fontWeight: 700, color: th.cardText, whiteSpace: 'nowrap'}}>{text}</span>
    </div>
  );
};

// ---------- 门头照 / 插画兜底横幅 ----------
const PhotoBand: React.FC<{photo?: string; w: number; h: number; t: number; dur: number; industry?: string; lang?: Lang}> = ({photo, w, h, t, dur, industry, lang}) => {
  const th = useTheme();
  const q = pop(t, 0, 15, 170);
  return (
    <div style={{position: 'relative', width: w, height: h, borderRadius: 36, overflow: 'hidden', boxShadow: th.shadow, opacity: Math.min(1, q * 1.6), transform: `scale(${0.96 + 0.04 * q})`, flex: 'none'}}>
      {photo ? (
        <Img src={staticFile(photo)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
      ) : (
        <IllustScene name={STORE_ILLUST[industry ?? ''] ?? '_base/store'} w={w} h={h} t={t} dur={dur} industry={industry} />
      )}
      <div style={{position: 'absolute', top: 14, right: 14, padding: '6px 16px', borderRadius: 8, ...labelInk(useTheme(), useStylePalette()), fontSize: 26, fontWeight: 700, lineHeight: 1.2}}>
        {photo ? pick(lang, '实拍', 'Real photo') : pick(lang, '示意', 'Illustration')}
      </div>
    </div>
  );
};

// ---------- 抽象示意地图：街区色块 + 道路 + 目的地 → 店 的虚线 + 定位针 ----------
const LABEL_W = 300;
const MapPanel: React.FC<{p: P; routes: Route[]; t: number; w: number; h: number; lang?: Lang}> = ({p, routes, t, w, h, lang}) => {
  const th = useTheme();
  const drop = pop(t, 0.05, 11, 130);
  const halo = (t % 1.6) / 1.6;
  const pin = {x: w * 0.5, y: h * 0.47};
  // 目的地四个角位（标签中心），按路线顺序占用
  const slots = [
    {x: w * 0.25, y: h * 0.17},
    {x: w * 0.75, y: h * 0.17},
    {x: w * 0.25, y: h * 0.83},
    {x: w * 0.75, y: h * 0.83},
  ];
  const blocks = [
    [0.04, 0.05, 0.26, 0.22],
    [0.36, 0.04, 0.22, 0.2],
    [0.66, 0.06, 0.3, 0.18],
    [0.05, 0.36, 0.22, 0.26],
    [0.72, 0.32, 0.24, 0.3],
    [0.06, 0.72, 0.3, 0.24],
    [0.42, 0.7, 0.18, 0.26],
    [0.66, 0.74, 0.3, 0.22],
  ];
  const road = th.card;
  const blockC = alpha(th.cardText, th.dark ? 0.08 : 0.06);
  return (
    <div style={{position: 'relative', width: w, height: h, borderRadius: 36, overflow: 'hidden', background: th.cardAlt, boxShadow: th.shadow, flex: 'none'}}>
      <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}>
        {blocks.map(([x, y, bw, bh], i) => (
          <rect key={i} x={x * w} y={y * h} width={bw * w} height={bh * h} rx={18} fill={i === 3 ? alpha(th.good, 0.16) : blockC} />
        ))}
        <path d={`M0 ${h * 0.3} L${w} ${h * 0.26}`} stroke={road} strokeWidth={26} />
        <path d={`M0 ${h * 0.66} L${w} ${h * 0.7}`} stroke={road} strokeWidth={26} />
        <path d={`M${w * 0.32} 0 L${w * 0.36} ${h}`} stroke={road} strokeWidth={22} />
        <path d={`M${w * 0.64} 0 L${w * 0.6} ${h}`} stroke={road} strokeWidth={22} />
        {/* 路线虚线：目的地 → 店，依次画出 */}
        {routes.map((r, i) => {
          const s = slots[i];
          const at = 0.55 + i * 0.25;
          const pr = interpolate(t, [at, at + 0.4], [0, 1], clamp);
          if (pr <= 0) return null;
          const x2 = s.x + (pin.x - s.x) * pr;
          const y2 = s.y + (pin.y - s.y) * pr;
          return <line key={i} x1={s.x} y1={s.y} x2={x2} y2={y2} stroke={th.accentInk} strokeWidth={8} strokeDasharray="4 16" strokeLinecap="round" />;
        })}
      </svg>
      {/* 「示意图」角标放在左侧中上（四个角留给目的地标签） */}
      <div style={{position: 'absolute', left: 18, top: Math.max(h * 0.17 + 56, pin.y - 100), padding: '6px 16px', borderRadius: 8, ...labelInk(useTheme(), useStylePalette()), fontSize: 26, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap'}}>
        {pick(lang, '示意图', 'Illustrative map')}
      </div>

      {/* 定位针 + 店名 */}
      <div style={{position: 'absolute', left: pin.x - 60, top: pin.y + 6, width: 120, height: 40, borderRadius: '50%', border: `5px solid ${th.accentInk}`, transform: `scale(${0.6 + halo * 0.9})`, opacity: (1 - halo) * drop}} />
      <div style={{position: 'absolute', left: pin.x - 32, top: pin.y - 72, transform: `translateY(${(1 - drop) * -80}px)`, opacity: Math.min(1, drop * 2)}}>
        <PinSolid size={64} color={th.accentInk} dot={th.card} />
      </div>
      {drop > 0.5 && (
        <div style={{position: 'absolute', left: pin.x - 200, top: pin.y + 36, width: 400, textAlign: 'center', opacity: Math.min(1, (drop - 0.5) * 3)}}>
          <div style={{display: 'inline-block', padding: '10px 24px', borderRadius: 22, background: th.card, boxShadow: th.shadow, fontSize: fitLine(p.name, 350, 40, 30), fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap', transform: `scale(${1 + bump(t, 0.35) * 0.08})`}}>
            {p.name}
          </div>
        </div>
      )}

      {/* 目的地标签：两行（目的地 / 方式+时间），都 fit 到 300px */}
      {routes.map((r, i) => {
        const s = slots[i];
        const at = 0.45 + i * 0.25;
        const q = pop(t, at, 14, 210);
        if (t < at) return null;
        const how = howText(lang, r);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.x - LABEL_W / 2,
              top: s.y - 44,
              width: LABEL_W,
              display: 'flex',
              justifyContent: 'center',
              opacity: Math.min(1, q * 1.8),
              transform: `scale(${0.8 + 0.2 * q})`,
            }}
          >
            <div style={{maxWidth: LABEL_W, boxSizing: 'border-box', padding: '8px 18px', borderRadius: 20, background: th.card, boxShadow: th.shadow, textAlign: 'center'}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}>
                {r.mode === METRO && <Subway size={28} color={th.accentInk} />}
                <span style={{fontSize: fitLine(r.to, LABEL_W - 36 - (r.mode === METRO ? 36 : 0), 32, 26), fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap'}}>{r.to}</span>
              </div>
              <div style={{fontSize: fitLine(how, LABEL_W - 36, 28, 26), fontWeight: 700, color: th.accentInk, whiteSpace: 'nowrap'}}>{how}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------- 信息块（card/photo 的主卡，map 的下方信息条共用） ----------
const InfoBody: React.FC<{p: P; routes: Route[]; badges: string[]; t: number; lang?: Lang; showRoutes: boolean; basisNote?: string; disclaimer?: string; compact?: boolean; w: number}> = ({
  p,
  routes,
  badges,
  t,
  lang,
  showRoutes,
  basisNote,
  disclaimer,
  compact,
  w,
}) => {
  const th = useTheme();
  const nameHit = bump(t, 0.05, 0.5);
  let clock = 0.16;
  const at = () => {
    clock += 0.09;
    return clock;
  };
  const nameSize = compact ? fitLine(p.name, 440, 40, 34) : fitLine(p.name, 440, 48, 38);
  const nameW = emWidth(p.name) * nameSize + 68;
  const badgeW = badges.slice(0, 2).reduce((a, b) => a + emWidth(b) * 26 + 36, 0);
  const badgesInline = !!badges.length && badges.length <= 2 && nameW + badgeW + 48 <= w;
  const rowFont = compact ? 30 : 32;
  const badgeRow = (
    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: badgesInline ? 'flex-end' : 'flex-start'}}>
      {badges.map((b, i) => (
        <span key={i} style={{padding: '6px 14px', borderRadius: 16, background: alpha(th.good, 0.14), color: th.good, fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap'}}>
          {b}
        </span>
      ))}
    </div>
  );
  return (
    <>
      {/* 店名 + 徽标 */}
      {!compact && (
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, transform: `scale(${1 + nameHit * 0.06})`, transformOrigin: '0% 50%'}}>
            <div style={{width: 56, height: 56, borderRadius: 28, background: th.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}>
              <Pin size={30} color={th.accentInk} />
            </div>
            <span style={{fontSize: nameSize, fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap'}}>{p.name}</span>
          </div>
          {badgesInline && badgeRow}
        </div>
      )}
      {!!badges.length && (compact || !badgesInline) && badgeRow}

      {/* 地标 / 营业时间 */}
      {p.landmark && (
        <div style={{display: 'flex', alignItems: 'center', gap: 12, opacity: Math.min(1, pop(t, at(), 14, 200) * 1.8)}}>
          <Pin size={30} color={th.cardMuted} />
          <span style={{fontSize: fitLine(p.landmark, w - 42, rowFont, 28), fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap'}}>{p.landmark}</span>
        </div>
      )}
      {p.hours && (
        <div style={{display: 'flex', alignItems: 'center', gap: 12, opacity: Math.min(1, pop(t, at(), 14, 200) * 1.8)}}>
          <Icon name="clock" size={28} color={th.cardMuted} stroke={2.2} />
          <span style={{fontSize: rowFont, fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap'}}>{p.hours}</span>
        </div>
      )}

      {/* 路线 */}
      {showRoutes && !!routes.length && (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, marginTop: 2}}>
          {routes.map((r, i) => (
            <RouteChip key={i} r={r} t={t} at={at()} lang={lang} maxW={w} />
          ))}
        </div>
      )}
      {basisNote && routes.length > 0 && <div style={{fontSize: 26, fontWeight: 600, color: th.cardMuted, marginTop: -4}}>{basisNote}</div>}

      {/* 停车 / 接驳 */}
      {(p.parking || p.pickup) && (
        <div style={{display: 'flex', gap: 20, flexWrap: 'wrap'}}>
          {p.parking && (
            <span style={{fontSize: 28, fontWeight: 600, color: th.cardSub}}>
              {pick(lang, '停车：', 'Parking: ')}
              {p.parking}
            </span>
          )}
          {p.pickup && (
            <span style={{fontSize: 28, fontWeight: 600, color: th.cardSub}}>
              {pick(lang, '接站：', 'Pickup: ')}
              {p.pickup}
            </span>
          )}
        </div>
      )}

      {/* 行动号召 */}
      {p.cta &&
        (() => {
          const ctaAt = at();
          const q = pop(t, ctaAt, 12, 190);
          return t < ctaAt ? null : (
            <div style={{display: 'flex', justifyContent: 'center', marginTop: 4, opacity: Math.min(1, q * 1.8), transform: `translateY(${(1 - q) * 16}px)`}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '12px 32px', borderRadius: 30, background: th.hot, color: textOnHot(th), fontSize: 34, fontWeight: 900, whiteSpace: 'nowrap'}}>
                {p.cta}
                <Icon name="arrow" size={30} color={textOnHot(th)} stroke={3} />
              </div>
            </div>
          );
        })()}

      {/* 免责小字（和底部提示条重复时不画） */}
      {disclaimer && <div style={{textAlign: 'center', fontSize: 26, fontWeight: 600, color: th.cardMuted}}>{disclaimer}</div>}
    </>
  );
};

const StoreCard: React.FC<ShotProps<P>> = ({params: p, t, dur, meta}) => {
  const th = useTheme();
  const lang = meta?.lang;
  const industry = meta?.industry as string | undefined;
  const layout = p.layout ?? 'card';
  const routes = (p.routes ?? []).slice(0, 4);
  const badges = (p.badges ?? []).slice(0, 4);
  const basisNote = p.basis === MEASURED ? undefined : pick(lang, '时间为导航估算，以实际路况为准', 'Times are navigation estimates');
  const disclaimer = dupOfNotice(p.disclaimer, meta?.notices) ? undefined : p.disclaimer;
  const innerW = CARD.w - 68;

  // ---- 信息卡高度估算（决定插画横幅 / 地图能占多高） ----
  const infoH = (compact: boolean, withRoutes: boolean) => {
    const row = compact ? 42 : 46;
    let h = compact ? 44 : 56; // 上下内边距
    const items: number[] = [];
    if (!compact) items.push(58);
    if (badges.length && (compact || badges.length > 2)) items.push(42);
    if (p.landmark) items.push(row);
    if (p.hours) items.push(row);
    if (withRoutes && routes.length) items.push(routes.length * 58);
    if (routes.length && basisNote) items.push(32);
    if (p.parking || p.pickup) items.push(38);
    if (p.cta) items.push(70);
    if (disclaimer) items.push(34);
    h += items.reduce((a, b) => a + b, 0) + Math.max(0, items.length - 1) * (compact ? 10 : 14);
    return h;
  };

  const enter = pop(t, 0.08, 14, 170);
  const cardStyle: React.CSSProperties = {
    width: CARD.w,
    borderRadius: 36,
    background: th.card,
    boxShadow: th.shadow,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    flex: 'none',
    opacity: Math.min(1, enter * 1.6),
    transform: `translateY(${(1 - enter) * 40}px) scale(${0.95 + 0.05 * enter})`,
  };
  const column: React.CSSProperties = {position: 'absolute', left: 0, top: MAIN.y0, width: 1080, height: MAIN.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: FONT};

  if (layout === 'map') {
    const hasInfo = !!(p.landmark || p.hours || p.parking || p.pickup || badges.length || p.cta || disclaimer);
    const iH = hasInfo ? infoH(true, false) - (routes.length && basisNote ? 32 : 0) : 0;
    const mapH = Math.max(460, Math.min(640, MAIN.h - (hasInfo ? iH + 16 : 0) - (basisNote && routes.length ? 44 : 0)));
    return (
      <div style={column}>
        <MapPanel p={p} routes={routes} t={t} w={CARD.w} h={mapH} lang={lang} />
        {basisNote && routes.length > 0 && <div style={{fontSize: 26, fontWeight: 600, color: th.onBgSub, textAlign: 'center', marginTop: -6}}>{basisNote}</div>}
        {hasInfo && (
          <div style={{...cardStyle, padding: '20px 34px', gap: 10}}>
            <InfoBody p={p} routes={routes} badges={badges} t={t} lang={lang} showRoutes={false} disclaimer={disclaimer} compact w={innerW} />
          </div>
        )}
      </div>
    );
  }

  const cardH = infoH(false, true);
  // photo：固定一条门头横幅；card：内容少（卡片矮于 480）时在上方补一条插画横幅，填掉空白、也给镜头一个会动的主角
  const bandH = layout === 'photo' ? Math.max(240, Math.min(360, MAIN.h - cardH - 16)) : cardH < 480 ? Math.max(220, Math.min(330, MAIN.h - cardH - 16)) : 0;

  return (
    <div style={column}>
      {bandH > 0 && <PhotoBand photo={layout === 'photo' ? p.photo : undefined} w={CARD.w} h={bandH} t={t} dur={dur} industry={industry} lang={lang} />}
      <div style={{...cardStyle, padding: '30px 34px 26px', gap: 14}}>
        <InfoBody p={p} routes={routes} badges={badges} t={t} lang={lang} showRoutes basisNote={basisNote} disclaimer={disclaimer} w={innerW} />
      </div>
    </div>
  );
};

export default StoreCard;

export const sfx = (p: P, _ctx: {dur: number; beat: number}): SfxCue[] => {
  const out: SfxCue[] = [{at: 0.05, kind: 'pop', vol: 0.22}];
  const map = p.layout === 'map';
  (p.routes ?? []).slice(0, 4).forEach((_, i) => out.push({at: map ? 0.45 + i * 0.25 : 0.25 + i * 0.09, kind: 'tick', vol: 0.16}));
  if (p.cta) out.push({at: 0.7, kind: 'swish', vol: 0.18});
  return out;
};
