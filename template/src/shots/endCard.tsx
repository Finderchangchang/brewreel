import React from 'react';
import {Img, staticFile} from 'remotion';
import {clamp, float, pop, rise} from '../core/anim';
import {emWidth, fitLine, fitSize} from '../core/fit';
import {FONT} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {BigText, Card, IconDisc, repeatsHint} from '../core/kit';
import {alpha, useTheme} from '../core/theme';
import type {ShotProps} from '../core/types';

// ============================================================
// endCard：片尾。这一镜没有字幕，所以可以用字幕带（y 260–540）。
// 三种版式（params.layout；不写就按产品名自动挑一种，同一产品每次都一样，不同产品大概率不同）：
//   stack     居中一列：logo → 产品名大字 → 次级口号 → 卖点列表 → 行动号召
//   panel     口号大字当标题放在字幕带，下方一张白卡：logo + 品牌名一行、卖点逐行打勾、行动号召按钮通栏
//   spotlight 品牌图标 + 产品名大字、次级口号、按行排列的卖点胶囊、行动号召
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
  const progress = Math.max(0, Math.min(1, (t - at) / 0.32));
  const q = 1 - Math.pow(1 - progress, 3);
  const size = fitLine(text, 560, 44, 36);
  return (
    <div style={{display: 'flex', justifyContent: 'center', opacity: q, transform: `translateY(${(1 - q) * 12}px)`}}>
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
          background: th.accent,
          color: th.accentText,
          fontWeight: 800,
          fontSize: size,
          height: 96,
          padding: '0 32px',
          borderRadius: 28,
          border: `2px solid ${th.accentLine}`,
          boxShadow: th.shadow,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
        <Icon name="arrow" size={size * 0.85} color={th.accentText} stroke={2.4} />
      </div>
    </div>
  );
};

/** Content-driven bookend spacing; every group reserves the same CTA height. */
const EndCard: React.FC<ShotProps<P>> = ({params: p, t, beat, meta}) => {
  const th = useTheme();
  const b = beat / 0.5;
  const m = pop(t, 0, 10, 160);
  const br = pop(t, 0, 18, 160);
  const big = pop(t, 0, 14, 170);
  const slogan = p.slogan ?? '';
  const flat = slogan.replace(/[{}\n\s]/g, '');
  const points = (p.points ?? []).filter(x => typeof x === 'string' && x.trim())
    .filter(x => !repeatsHint(x, {disclaimer: meta?.disclaimer, notices: meta?.notices}) && x.replace(/\s/g, '') !== flat).slice(0, 3);
  const layout = pickLayout(p, points.length);
  const pointAt = (i: number) => (0.5 + i * 0.25) * b;
  const ctaAt = (0.75 + points.length * 0.25) * b;
  const sloganStyle = {opacity: Math.min(1, big * 1.5), transform: 'translateY(' + (1 - big) * 50 + 'px) scale(' + (0.85 + 0.15 * big) + ')'};
  const nLines = slogan.split('\n').length;
  const rowSize = Math.min(46, ...points.map(x => fitLine(x, 612, 46, 34)));
  const rowH = Math.max(48, rowSize * 1.35);
  const pointsH = points.length ? points.length * rowH + (points.length - 1) * 16 : 0;
  const Rows = ({center = false}: {center?: boolean}) => <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>{points.map((text, i) => <div key={i} style={{height: rowH, display: 'flex', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start', gap: 16, ...rise(pop(t, pointAt(i), 16, 170), 24)}}><Icon name="check" size={32} color={center ? th.onBg : th.accent} stroke={2.4}/><div style={{fontSize: rowSize, lineHeight: 1.35, fontWeight: 600, color: center ? th.onBg : th.cardText, whiteSpace: 'nowrap'}}>{text}</div></div>)}</div>;

  if (layout === 'panel') {
    const L = 116;
    const brandSize = fitLine(p.brand, 480, 64, 40);
    const sSize = fitSize(slogan, 720, 104, 64, 40);
    const sloganH = nLines * sSize * 1.16;
    const cardH = 80 + L + (points.length ? 32 + 2 + 32 + pointsH : 0) + (p.cta ? 40 + 96 : 0);
    const groupH = sloganH + 48 + cardH;
    const top = Math.round(Math.max(TOP_MIN, Math.min(BOT - groupH, CENTER - groupH / 2)));
    return <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: 150, width: 780, top, ...sloganStyle}}><BigText text={slogan} size={sSize}/></div>
      <div style={{position: 'absolute', left: 150, width: 780, top: top + sloganH + 48, ...rise(br, 60)}}>
        <Card style={{width: 780, padding: 40, display: 'flex', flexDirection: 'column'}} radius={40}>
          <div style={{height: L, display: 'flex', alignItems: 'center', gap: 32}}><Logo size={L} t={t} logo={meta?.logo} icon={p.icon} m={m}/><div style={{fontSize: brandSize, fontWeight: 800, lineHeight: 1.2, color: th.cardText, whiteSpace: 'nowrap'}}>{p.brand}</div></div>
          {points.length > 0 && <><div style={{height: 2, flex: 'none', background: th.line, marginTop: 32, marginBottom: 32}}/><Rows/></>}
          {p.cta && <div style={{marginTop: 40}}><Cta text={p.cta} t={t} at={ctaAt} wide/></div>}
        </Card>
      </div>
    </div>;
  }

  const spotlight = layout === 'spotlight';
  const L = spotlight ? (points.length || p.cta ? 250 : 300) : (points.length || p.cta ? 210 : 250);
  const brandSize = fitLine(p.brand, 720, spotlight ? 92 : 88, 56);
  const sSize = fitSize(slogan, 720, spotlight ? 96 : 112, 64, 40);
  const brandH = brandSize * 1.16;
  const sloganH = nLines * sSize * 1.16;
  const chipSize = Math.min(36, ...points.map(x => fitLine(x, 652, 36, 30)));
  const chipH = chipSize * 1.6;
  const chipWidths: number[] = [];
  const chipRows: number[][] = [];
  for (const [i, text] of points.entries()) {
    const w = emWidth(text) * chipSize * 1.08 + 72;
    if (chipWidths.length && chipWidths[chipWidths.length - 1] + 16 + w <= 720) {
      chipWidths[chipWidths.length - 1] += 16 + w;
      chipRows[chipRows.length - 1].push(i);
    } else {
      chipWidths.push(w);
      chipRows.push([i]);
    }
  }
  const supportH = spotlight ? chipWidths.length * chipH + Math.max(0, chipWidths.length - 1) * 16 : pointsH;
  // Use the existing type sizes; when content is dense, reclaim logo space first.
  const fixedH = 32 + brandH + 24 + sloganH + (points.length ? 32 + supportH : 0) + (p.cta ? 40 + 96 : 0);
  let logoSize = L;
  while (logoSize > 112 && fixedH + logoSize > BOT - logoTopMin(logoSize)) logoSize -= 2;
  const H = logoSize + fixedH;
  const top = Math.round(Math.max(logoTopMin(logoSize), Math.min(BOT - H, CENTER - H / 2)));
  const brandTop = top + logoSize + 32;
  const sloganTop = brandTop + brandH + 24;
  const supportTop = sloganTop + sloganH + 32;
  const ctaTop = sloganTop + sloganH + (points.length ? 32 + supportH : 0) + 40;
  return <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
    <div style={{position: 'absolute', left: 540 - logoSize / 2, top}}><Logo size={logoSize} t={t} logo={meta?.logo} icon={p.icon} m={m}/></div>
    <div style={{position: 'absolute', left: 150, width: 780, top: brandTop, ...rise(br)}}><BigText text={p.brand} size={brandSize}/></div>
    <div style={{position: 'absolute', left: 150, width: 780, top: sloganTop, ...sloganStyle}}><BigText text={slogan} size={sSize}/></div>
    {points.length > 0 && <div style={{position: 'absolute', left: 180, width: 720, top: supportTop}}>{spotlight ? <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>{chipRows.map((row, r) => <div key={r} style={{display: 'flex', justifyContent: 'center', gap: 16}}>{row.map(i => <div key={i} style={{height: chipH, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderRadius: 20, background: th.card, color: th.cardText, fontSize: chipSize, fontWeight: 600, whiteSpace: 'nowrap', ...rise(pop(t, pointAt(i), 16, 170), 24)}}><div style={{width: 12, height: 12, borderRadius: 6, background: th.accent, flex: 'none'}}/>{points[i]}</div>)}</div>)}</div> : <Rows center/>}</div>}
    {p.cta && <div style={{position: 'absolute', left: 180, width: 720, top: ctaTop}}><Cta text={p.cta} t={t} at={ctaAt}/></div>}
  </div>;
};

export default EndCard;
