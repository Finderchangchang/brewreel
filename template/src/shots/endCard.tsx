import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {beatPulse, clamp, float, pop, rise} from '../core/anim';
import {emWidth, fitLine, fitSize} from '../core/fit';
import {FONT} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {BigText, Card, IconDisc, Sweep, repeatsHint} from '../core/kit';
import {alpha, textOnHot, useTheme} from '../core/theme';
import type {ShotProps} from '../core/types';

// ============================================================
// endCard：片尾。这一镜没有字幕，所以可以用字幕带（y 260–540）。
// 三种版式（params.layout；不写就按产品名自动挑一种，同一产品每次都一样，不同产品大概率不同）：
//   stack     居中一列：logo → 品牌名胶囊 → 口号大字 → 卖点胶囊 → 行动号召
//   panel     口号大字当标题放在字幕带，下方一张白卡：logo + 品牌名一行、卖点逐行打勾、行动号召按钮通栏
//   spotlight 大 logo + 背后卡拍转动的光芒，品牌名大字，口号，卖点排成一排小胶囊，行动号召
// 2026-09 第三轮（评审：片尾重心太靠上、y1300 以下全空、不同产品片尾一模一样）：
//   整组内容以 y≈880 为中心往下放（上限 y 1320），内容少时 logo 放大；
//   卖点和顶部免责小字/底部提示条说的是同一句时不再重复画。
// ============================================================
type Layout = 'stack' | 'panel' | 'spotlight';
type P = {brand: string; slogan: string; points?: string[]; cta?: string; icon?: string; layout?: Layout};

const TOP_MIN = 290;
const BOT = 1320;
const CENTER = 880;
/** logo 光圈顶（放大 1.12 倍后）要离免责胶囊底（y≈258）至少 12px */
const logoTopMin = (L: number) => Math.ceil(270 - L / 2 + (L / 2 + 20) * 1.12);

const hashStr = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0, 7);
const pickLayout = (p: P, nPoints: number): Layout => {
  if (p.layout === 'stack' || p.layout === 'panel' || p.layout === 'spotlight') return p.layout;
  const cands: Layout[] = nPoints ? ['stack', 'panel', 'spotlight'] : ['stack', 'spotlight'];
  return cands[hashStr(p.brand ?? '') % cands.length];
};

const Logo: React.FC<{size: number; t: number; logo?: string; icon?: string; m: number}> = ({size, t, logo, icon, m}) => {
  const th = useTheme();
  const halo = (t % 2) / 2;
  return (
    <div style={{position: 'relative', width: size, height: size, transform: `scale(${m}) translateY(${float(t, 0, 5)}px)`}}>
      <div style={{position: 'absolute', inset: -20, borderRadius: '50%', border: `4px solid ${alpha(th.onBg.startsWith('#') ? th.onBg : '#ffffff', 0.5)}`, transform: `scale(${1 + halo * 0.12})`, opacity: 1 - halo}} />
      {logo ? (
        <Img src={staticFile(logo)} style={{width: size, height: size, objectFit: 'contain'}} />
      ) : (
        <IconDisc name={isIcon(icon) ? (icon as string) : 'sparkle'} size={size} style={{border: `${Math.round(size / 22)}px solid #ffffff`}} />
      )}
    </div>
  );
};

const Cta: React.FC<{text: string; t: number; at: number; wide?: boolean}> = ({text, t, at, wide}) => {
  const th = useTheme();
  const q = pop(t, at, 12, 180);
  const sweep = interpolate(t, [at + 0.3, at + 1.0], [0, 1], clamp);
  const size = fitLine(text, 560, 44, 36);
  return (
    <div style={{display: 'flex', justifyContent: 'center', ...rise(q, 30)}}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          width: wide ? '100%' : undefined,
          boxSizing: 'border-box',
          background: th.hot,
          color: textOnHot(th),
          fontWeight: 900,
          fontSize: size,
          padding: '16px 40px',
          borderRadius: 54,
          border: '4px solid #ffffff',
          boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
        <Icon name="arrow" size={size * 0.95} color={textOnHot(th)} stroke={3} />
        <Sweep p={sweep} w={600} />
      </div>
    </div>
  );
};

const EndCard: React.FC<ShotProps<P>> = ({params: p, t, beat, meta}) => {
  const th = useTheme();
  const b = beat / 0.5; // 以 120 BPM 为基准缩放节奏
  const m = pop(t, 0, 10, 160);
  const br = pop(t, 0, 18, 160);
  const big = pop(t, 0, 14, 170);
  const bb = beatPulse(t, beat);
  const slogan = p.slogan ?? '';
  const sloganFlat = slogan.replace(/[{}\n\s]/g, '');
  // 同一提示不重复：和免责小字/底部提示条/口号本身说同一句的卖点不画
  const points = (p.points ?? [])
    .filter((x) => typeof x === 'string' && x.trim())
    .filter((x) => !repeatsHint(x, {disclaimer: meta?.disclaimer, notices: meta?.notices}) && x.replace(/\s/g, '') !== sloganFlat)
    .slice(0, 3);
  const pointAt = (i: number) => (0.5 + i * 0.25) * b;
  const ctaAt = (0.5 + points.length * 0.25 + 0.25) * b;
  const layout = pickLayout(p, points.length);
  const sloganStyle = {opacity: Math.min(1, big * 1.5), transform: `translateY(${(1 - big) * 50}px) scale(${0.85 + 0.15 * big})`};
  const nLines = slogan.split('\n').length;

  // ---------------- panel：口号当标题 + 一张按内容长高的白卡 ----------------
  if (layout === 'panel') {
    // 按关键内容区 x180–900（720 宽）缩，780 会让 10 字左右的口号出界 5–10px（p3 样例：ecommerce 口号 x173–908）
    const sSize = fitSize(slogan, 720, 104, 64, 40);
    const sloganTop = 300;
    const sloganH = nLines * sSize * 1.16;
    const L = 116;
    const brandSize = fitLine(p.brand, 480, 60, 40);
    const rowSize = Math.min(44, ...points.map((x) => fitLine(x, 540, 44, 34)));
    const cardH = 44 + L + (points.length ? 30 + points.length * (rowSize * 1.3 + 30) : 0) + (p.cta ? 30 + 96 : 0) + 44;
    const zoneTop = sloganTop + sloganH + 50;
    const cardTop = Math.round(Math.max(zoneTop, Math.min(BOT - cardH, CENTER + 60 - cardH / 2)));
    return (
      <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
        <div style={{position: 'absolute', left: 150, width: 780, top: sloganTop, ...sloganStyle}}>
          <BigText text={slogan} size={sSize} />
        </div>
        <div style={{position: 'absolute', left: 150, width: 780, top: cardTop, ...rise(br, 60)}}>
          <Card style={{width: 780, padding: '44px 44px', display: 'flex', flexDirection: 'column'}} radius={44}>
            <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
              <Logo size={L} t={t} logo={meta?.logo} icon={p.icon} m={m} />
              <div style={{fontSize: brandSize, fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap', lineHeight: 1.2}}>{p.brand}</div>
            </div>
            {points.length > 0 && <div style={{height: 3, background: th.line, borderRadius: 2, marginTop: 30}} />}
            {points.map((pt, i) => {
              const q = pop(t, pointAt(i), 16, 170);
              return (
                <div key={i} style={{display: 'flex', alignItems: 'center', gap: 20, marginTop: 30, ...rise(q, 24)}}>
                  <div style={{width: 56, height: 56, borderRadius: 28, flex: 'none', background: th.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Icon name="check" size={34} color={th.accentInk} stroke={3} />
                  </div>
                  <div style={{fontSize: rowSize, fontWeight: 700, color: th.cardText, whiteSpace: 'nowrap', lineHeight: 1.3}}>{pt}</div>
                </div>
              );
            })}
            {p.cta && (
              <div style={{marginTop: 30}}>
                <Cta text={p.cta} t={t} at={ctaAt} wide />
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ---------------- spotlight：大 logo + 背后光芒，品牌名大字，卖点一排小胶囊 ----------------
  if (layout === 'spotlight') {
    const roomy = points.length <= 1 && !p.cta;
    const L = roomy ? 300 : 250;
    const brandSize = fitLine(p.brand, 720, 84, 56);
    const sSize = fitSize(slogan, 720, roomy ? 96 : 84, 60, 36);
    const sloganH = nLines * sSize * 1.16;
    const chipSize = 36;
    // 小胶囊按 720 宽贪心排行，估出行数
    const chipW = (x: string) => emWidth(x) * chipSize + 2 * 26 + 12;
    const rows: number[] = [];
    for (const x of points) {
      const w = Math.min(720, chipW(x));
      if (rows.length && rows[rows.length - 1] + 16 + w <= 720) rows[rows.length - 1] += 16 + w;
      else rows.push(w);
    }
    const chipsH = rows.length ? rows.length * (chipSize * 1.6) + (rows.length - 1) * 16 : 0;
    const H = L + 40 + brandSize * 1.2 + 24 + sloganH + (rows.length ? 40 + chipsH : 0) + (p.cta ? 40 + 96 : 0);
    const top = Math.round(Math.max(logoTopMin(L), Math.min(BOT - H, CENTER - H / 2)));
    const rot = t * 18;
    let y = top;
    const logoTop = y;
    y += L + 40;
    const brandTop = y;
    y += brandSize * 1.2 + 24;
    const sloganTop = y;
    y += sloganH;
    const chipsTop = y + 40;
    if (rows.length) y += 40 + chipsH;
    const ctaTop = y + 40;
    const R = L * 0.95;
    return (
      <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
        {/* 光芒：只在关键区外沿做装饰，卡拍亮一下 */}
        <div
          style={{
            position: 'absolute',
            left: 540 - R * 1.6,
            top: logoTop + L / 2 - R * 1.6,
            width: R * 3.2,
            height: R * 3.2,
            borderRadius: '50%',
            background: `repeating-conic-gradient(from ${rot}deg, ${alpha(th.hot, 0.22 + 0.12 * bb)} 0deg 9deg, rgba(0,0,0,0) 9deg 22deg)`,
            WebkitMaskImage: 'radial-gradient(circle, #000 20%, rgba(0,0,0,0) 68%)',
            maskImage: 'radial-gradient(circle, #000 20%, rgba(0,0,0,0) 68%)',
            opacity: m,
          }}
        />
        <div style={{position: 'absolute', left: 540 - L / 2, top: logoTop}}>
          <Logo size={L} t={t} logo={meta?.logo} icon={p.icon} m={m} />
        </div>
        <div style={{position: 'absolute', left: 150, width: 780, top: brandTop, ...rise(br)}}>
          <BigText text={p.brand} size={brandSize} />
        </div>
        <div style={{position: 'absolute', left: 150, width: 780, top: sloganTop, ...sloganStyle}}>
          <BigText text={slogan} size={sSize} />
        </div>
        {rows.length > 0 && (
          <div style={{position: 'absolute', left: 180, width: 720, top: chipsTop, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16}}>
            {points.map((pt, i) => {
              const q = pop(t, pointAt(i), 16, 170);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    height: chipSize * 1.6,
                    boxSizing: 'border-box',
                    padding: '0 26px',
                    borderRadius: chipSize,
                    background: alpha(th.card.startsWith('#') ? th.card : '#ffffff', 0.92),
                    color: th.cardText,
                    fontSize: chipSize,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.16)',
                    ...rise(q, 24),
                  }}
                >
                  <div style={{width: 12, height: 12, borderRadius: 6, background: th.accentFill, flex: 'none'}} />
                  {pt}
                </div>
              );
            })}
          </div>
        )}
        {p.cta && (
          <div style={{position: 'absolute', left: 150, width: 780, top: Math.min(ctaTop, BOT - 96)}}>
            <Cta text={p.cta} t={t} at={ctaAt} />
          </div>
        )}
      </div>
    );
  }

  // ---------------- stack：居中一列，整组以 y≈880 为中心往下放 ----------------
  const roomy = points.length <= 2 && !p.cta;
  const configs = [
    {L: roomy ? 250 : 210, sMax: 112, ptFont: roomy ? 46 : 42, ptStep: roomy ? 118 : 104},
    {L: 180, sMax: 100, ptFont: 40, ptStep: 98},
    {L: 150, sMax: 90, ptFont: 40, ptStep: 92},
  ];
  const calc = (c: (typeof configs)[number]) => {
    const size = fitSize(slogan, 720, c.sMax, 64, 40); // 720 = 关键内容区宽，见 panel 布局的说明
    const sloganH = nLines * size * 1.16;
    const H = c.L + 30 + 72 + 40 + sloganH + (points.length ? 44 + points.length * c.ptStep - (c.ptStep - c.ptFont * 1.6) : 0) + (p.cta ? 40 + 96 : 0);
    return {...c, size, sloganH, H};
  };
  let g = calc(configs[0]);
  for (const c of configs.slice(1)) if (g.H > BOT - logoTopMin(g.L)) g = calc(c);
  const top = Math.round(Math.max(logoTopMin(g.L), Math.min(BOT - g.H, CENTER - g.H / 2)));
  const logoTop = top;
  const brandTop = top + g.L + 30;
  const sloganTop = brandTop + 72 + 40;
  let y = Math.round(sloganTop + g.sloganH + 44);
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: 540 - g.L / 2, top: logoTop}}>
        <Logo size={g.L} t={t} logo={meta?.logo} icon={p.icon} m={m} />
      </div>
      {/* 品牌名放在卡片色胶囊里：浅色背景（如 mood=0 的浅青）上白字对比度不够 */}
      <div style={{position: 'absolute', left: 150, width: 780, top: brandTop, display: 'flex', justifyContent: 'center', ...rise(br)}}>
        <div style={{background: th.card, color: th.cardText, fontSize: fitLine(p.brand, 660, 48, 40), fontWeight: 900, lineHeight: 1.25, padding: '6px 34px', borderRadius: 40, boxShadow: '0 8px 22px rgba(0,0,0,0.2)', whiteSpace: 'nowrap'}}>{p.brand}</div>
      </div>
      <div style={{position: 'absolute', left: 150, width: 780, top: sloganTop, ...sloganStyle}}>
        <BigText text={slogan} size={g.size} />
      </div>
      {points.map((pt, i) => {
        const q = pop(t, pointAt(i), 16, 170);
        const top = y;
        y += g.ptStep;
        const f = Math.min(g.ptFont, fitLine(pt, 720 - 80 - g.ptFont - 14, g.ptFont, 34));
        return (
          <div key={i} style={{position: 'absolute', left: 150, width: 780, top, display: 'flex', justifyContent: 'center', ...rise(q)}}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: th.card,
                color: th.cardText,
                fontWeight: 700,
                fontSize: f,
                padding: roomy ? '18px 40px' : '14px 34px',
                borderRadius: 50,
                boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon name="check" size={f} color={th.accentInk} stroke={3} />
              {pt}
            </div>
          </div>
        );
      })}
      {p.cta && (
        <div style={{position: 'absolute', left: 150, width: 780, top: Math.min(y - (points.length ? g.ptStep - g.ptFont * 1.6 : 0) + 40, BOT - 96)}}>
          <Cta text={p.cta} t={t} at={ctaAt} />
        </div>
      )}
    </div>
  );
};

export default EndCard;
