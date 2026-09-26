import React from 'react';
import {Img, staticFile} from 'remotion';
import {bump, pop} from '../core/anim';
import {fitLine} from '../core/fit';
import {FONT} from '../core/font';
import {Icon} from '../core/icons';
import {CARD, MAIN} from '../core/safe';
import {alpha, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// storeCard：门店、位置、到店指引（docs/dev/industry-design.md §1.3）。
// 不设电话/微信/二维码/网址/门牌号字段——组件也不画这些。
//   photo 门头实拍（无照片按行业插画兜底，用 features/index 同款 Illust 占位）横幅 + 信息卡
//   map   代码画的抽象示意图：几条街道线 + 定位针 + 地铁点，不模仿任何地图 App 界面
//   card  纯排版信息卡
// 主角 = 定位针落地（弹一下）+ 路线小标签依次从针脚"辐射"出来。
// ============================================================
type Route = {to: string; mode: '步行' | '驾车' | '打车' | '公交' | '地铁' | '骑行' | '接驳车'; minutes?: number; km?: number};
type P = {
  layout?: 'photo' | 'map' | 'card';
  name: string;
  landmark?: string;
  hours?: string;
  photo?: string;
  routes?: Route[];
  basis?: '导航估算' | '实测';
  parking?: string;
  pickup?: string;
  badges?: string[];
  cta?: string;
  disclaimer?: string;
};

// ---------- 本地图标（icons.json 没有定位/地铁，按同款线条风格现画，不改 core） ----------
const Pin: React.FC<{size?: number; color?: string}> = ({size = 28, color = 'currentColor'}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s7-6.8 7-12.2A7 7 0 1 0 5 8.8C5 14.2 12 21 12 21z" />
    <circle cx="12" cy="8.6" r="2.6" />
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

const RouteChip: React.FC<{r: Route; t: number; at: number}> = ({r, t, at}) => {
  const th = useTheme();
  const q = pop(t, at, 14, 210);
  if (t < at) return null;
  const text = `${r.mode} ${r.to} ${r.minutes ?? ''}${r.minutes !== undefined ? '分钟' : ''}${r.km !== undefined ? ` · ${r.km}km` : ''}`.trim();
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
      <div style={{width: 12, height: 12, borderRadius: 6, background: th.accent, flex: 'none'}} />
      <span style={{fontSize: 30, fontWeight: 700, color: th.cardText, whiteSpace: 'nowrap'}}>{text}</span>
    </div>
  );
};

// ---------- 门头照 / 插画兜底横幅 ----------
const PhotoBand: React.FC<{photo?: string; box: {x: number; y: number; w: number; h: number}; t: number}> = ({photo, box, t}) => {
  const th = useTheme();
  const q = pop(t, 0, 15, 170);
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: 36, overflow: 'hidden', boxShadow: th.shadow, opacity: Math.min(1, q * 1.6), transform: `scale(${0.96 + 0.04 * q})`}}>
      {photo ? (
        <Img src={staticFile(photo)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
      ) : (
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(160deg, ${th.accentSoft} 0%, ${th.card} 120%)`}}>
          <Icon name="doc" size={72} color={th.accent} stroke={1.8} />
        </div>
      )}
      <div style={{position: 'absolute', top: 14, right: 14, padding: '6px 16px', borderRadius: 18, background: alpha('#0B0D14', 0.55), color: '#FFFFFF', fontSize: 24, fontWeight: 700}}>{photo ? '实拍' : '示意'}</div>
    </div>
  );
};

// ---------- 抽象示意地图：几条街道线 + 地铁点 + 定位针 ----------
const MapArt: React.FC<{p: P; t: number}> = ({p, t}) => {
  const th = useTheme();
  const cx = 540;
  const cy = MAIN.y0 + 300;
  const drop = pop(t, 0, 11, 130);
  const halo = (t % 1.6) / 1.6;
  const streets = [
    {x1: 190, y1: cy - 210, x2: 890, y2: cy - 90},
    {x1: 220, y1: cy + 260, x2: 900, y2: cy + 140},
    {x1: cx - 120, y1: MAIN.y0 - 30, x2: cx + 40, y2: MAIN.y0 + 560},
  ];
  const routes = (p.routes ?? []).slice(0, 4);
  return (
    <div style={{position: 'absolute', left: CARD.x0, top: MAIN.y0, width: CARD.w, height: 620}}>
      <svg width={CARD.w} height={640} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {streets.map((s, i) => (
          <line key={i} x1={s.x1 - CARD.x0} y1={s.y1 - MAIN.y0} x2={s.x2 - CARD.x0} y2={s.y2 - MAIN.y0} stroke={th.line} strokeWidth={10} strokeLinecap="round" opacity={0.9} />
        ))}
      </svg>
      <div style={{position: 'absolute', left: cx - CARD.x0 - 130, top: cy - MAIN.y0 - 210, padding: '6px 16px', borderRadius: 18, background: alpha('#0B0D14', 0.5), color: '#fff', fontSize: 24, fontWeight: 700}}>示意图</div>
      {/* 地铁小图标（有地铁类路线时才画） */}
      {routes.some((r) => r.mode === '地铁') && (
        <div style={{position: 'absolute', left: cx - CARD.x0 - 260, top: cy - MAIN.y0 - 40, width: 56, height: 56, borderRadius: 28, background: th.card, boxShadow: th.shadow, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Subway size={30} color={th.accent} />
        </div>
      )}
      {/* 定位针 */}
      <div style={{position: 'absolute', left: cx - CARD.x0 - 26, top: cy - MAIN.y0 - 52 * drop, transform: `translateY(${(1 - drop) * -60}px)`}}>
        <div style={{position: 'absolute', left: -20, top: 46, width: 92, height: 26, borderRadius: '50%', background: alpha('#000000', 0.18 * drop), filter: 'blur(3px)'}} />
        <div style={{position: 'absolute', left: 0, top: 46, width: 52, height: 52, borderRadius: '50%', border: `4px solid ${th.accent}`, transform: `scale(${1 + halo * 0.9})`, opacity: (1 - halo) * drop}} />
        <Pin size={64} color={th.accent} />
      </div>
      {drop > 0.6 && (
        <div style={{position: 'absolute', left: cx - CARD.x0 - 140, top: cy - MAIN.y0 + 40, width: 280, textAlign: 'center', opacity: Math.min(1, (drop - 0.6) * 3)}}>
          <div style={{display: 'inline-block', padding: '10px 22px', borderRadius: 22, background: th.card, boxShadow: th.shadow, fontSize: fitLine(p.name, 260, 36, 28), fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap'}}>{p.name}</div>
        </div>
      )}
      {routes.map((r, i) => {
        const angle = -0.5 + i * 0.42;
        const rx = cx - CARD.x0 + Math.cos(angle) * 320;
        const ry = cy - MAIN.y0 + Math.sin(angle) * 210 + 60;
        const at = 0.55 + i * 0.16;
        const q = pop(t, at, 14, 210);
        if (t < at) return null;
        return (
          <div key={i} style={{position: 'absolute', left: rx - 90, top: ry, width: 180, textAlign: 'center', opacity: Math.min(1, q * 1.8), transform: `translateY(${(1 - q) * 14}px)`}}>
            <div style={{display: 'inline-block', padding: '6px 16px', borderRadius: 18, background: th.cardAlt, fontSize: 26, fontWeight: 700, color: th.cardText, whiteSpace: 'nowrap'}}>
              {r.mode} {r.minutes ?? ''}分钟
            </div>
          </div>
        );
      })}
    </div>
  );
};

const StoreCard: React.FC<ShotProps<P>> = ({params: p, t}) => {
  const th = useTheme();
  const layout = p.layout ?? 'card';
  const routes = (p.routes ?? []).slice(0, 4);
  const badges = (p.badges ?? []).slice(0, 4);
  const nameHit = bump(t, 0.05, 0.5);
  const basisNote = p.basis === '实测' ? undefined : '时间为导航估算，以实际路况为准';

  // ---- map：图形已经在 MapArt 里画完 name，下面只补路线依次出现的 chip 列表已内置 + 底部备注 ----
  if (layout === 'map') {
    return (
      <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
        <MapArt p={p} t={t} />
        {basisNote && (
          <div style={{position: 'absolute', left: CARD.x0, width: CARD.w, top: MAIN.y0 + 636, textAlign: 'center', fontSize: 26, fontWeight: 600, color: th.onBgSub}}>{basisNote}</div>
        )}
      </div>
    );
  }

  const bandH = layout === 'photo' ? 316 : 0;
  const cardTop = MAIN.y0 + (layout === 'photo' ? bandH + 20 : 0);
  const cardH = MAIN.h - (layout === 'photo' ? bandH + 20 : 0);
  const enter = pop(t, layout === 'photo' ? 0.08 : 0, 14, 170);

  let clock = 0.16;
  const at = () => {
    clock += 0.09;
    return clock;
  };

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      {layout === 'photo' && <PhotoBand photo={p.photo} box={{x: CARD.x0, y: MAIN.y0, w: CARD.w, h: bandH}} t={t} />}
      <div
        style={{
          position: 'absolute',
          left: CARD.x0,
          top: cardTop,
          width: CARD.w,
          minHeight: cardH,
          borderRadius: 36,
          background: th.card,
          boxShadow: th.shadow,
          boxSizing: 'border-box',
          padding: '30px 34px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 40}px) scale(${0.95 + 0.05 * enter})`,
        }}
      >
        {/* 店名 + 徽标 */}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, transform: `scale(${1 + nameHit * 0.06})`, transformOrigin: '0% 50%'}}>
            <div style={{width: 56, height: 56, borderRadius: 28, background: th.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}>
              <Pin size={30} color={th.accent} />
            </div>
            <span style={{fontSize: fitLine(p.name, 440, 48, 38), fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap'}}>{p.name}</span>
          </div>
          {!!badges.length && (
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
              {badges.slice(0, 2).map((b, i) => (
                <span key={i} style={{padding: '6px 14px', borderRadius: 16, background: alpha(th.good, 0.14), color: th.good, fontSize: 24, fontWeight: 700, whiteSpace: 'nowrap'}}>{b}</span>
              ))}
            </div>
          )}
        </div>

        {/* 地标 / 营业时间 */}
        {p.landmark && (
          <div style={{display: 'flex', alignItems: 'center', gap: 12, opacity: Math.min(1, pop(t, at(), 14, 200) * 1.8)}}>
            <Pin size={30} color={th.cardMuted} />
            <span style={{fontSize: 32, fontWeight: 700, color: th.cardSub}}>{p.landmark}</span>
          </div>
        )}
        {p.hours && (
          <div style={{display: 'flex', alignItems: 'center', gap: 12, opacity: Math.min(1, pop(t, at(), 14, 200) * 1.8)}}>
            <Icon name="clock" size={28} color={th.cardMuted} stroke={2.2} />
            <span style={{fontSize: 32, fontWeight: 700, color: th.cardSub}}>{p.hours}</span>
          </div>
        )}

        {/* 路线 */}
        {!!routes.length && (
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 2}}>
            {routes.map((r, i) => (
              <RouteChip key={i} r={r} t={t} at={at()} />
            ))}
          </div>
        )}
        {basisNote && routes.length > 0 && <div style={{fontSize: 24, fontWeight: 600, color: th.cardMuted, marginTop: -4}}>{basisNote}</div>}

        {/* 停车 / 接驳 */}
        {(p.parking || p.pickup) && (
          <div style={{display: 'flex', gap: 20, flexWrap: 'wrap'}}>
            {p.parking && <span style={{fontSize: 28, fontWeight: 600, color: th.cardSub}}>停车：{p.parking}</span>}
            {p.pickup && <span style={{fontSize: 28, fontWeight: 600, color: th.cardSub}}>接站：{p.pickup}</span>}
          </div>
        )}

        <div style={{flex: 1}} />

        {/* 行动号召 */}
        {p.cta &&
          (() => {
            const ctaAt = at();
            const q = pop(t, ctaAt, 12, 190);
            return t < ctaAt ? null : (
              <div style={{display: 'flex', justifyContent: 'center', opacity: Math.min(1, q * 1.8), transform: `translateY(${(1 - q) * 16}px)`}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '14px 32px', borderRadius: 30, background: th.hot, color: '#1B1A18', fontSize: 34, fontWeight: 900, whiteSpace: 'nowrap'}}>
                  {p.cta}
                  <Icon name="arrow" size={30} color="#1B1A18" stroke={3} />
                </div>
              </div>
            );
          })()}

        {/* 免责小字 */}
        {p.disclaimer && <div style={{textAlign: 'center', fontSize: 24, fontWeight: 600, color: th.cardMuted}}>{p.disclaimer}</div>}
      </div>
    </div>
  );
};

export default StoreCard;

export const sfx = (p: P, _ctx: {dur: number; beat: number}): SfxCue[] => {
  const out: SfxCue[] = [{at: 0.05, kind: 'pop', vol: 0.22}];
  (p.routes ?? []).slice(0, 4).forEach((_, i) => out.push({at: 0.55 + i * 0.16, kind: 'tick', vol: 0.16}));
  if (p.cta) out.push({at: 0.7, kind: 'swish', vol: 0.18});
  return out;
};
