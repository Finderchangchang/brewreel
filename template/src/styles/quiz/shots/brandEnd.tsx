import React from 'react';
import {Easing, Img, interpolate, staticFile} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitLine} from '../../../core/fit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Actor} from '../parts/cast';
import {Hearts, Mark, Pill, backOut, usePal, useTk} from '../parts/kit';
import tokens from '../tokens.json';

// ============================================================
// quiz / brandEnd：收尾（参考片 40.4–45.8 秒）。接上一镜的圆形擦除：
// 满屏亮色只停 1 帧（motion.blob.hold），0.24 秒缩成一个点——缩的同时下面的整版已经在位（边擦边露出内容，不停在纯色上）：
// 「✓ 小标」+ 两行口号（整行弹入，不逐字打）、logo 卡（logo + 产品名，宽 780）、亮色 CTA 按钮（params.button 或 meta.cta）、两个小人冒心，
// 全部在前 0.5 秒内入场，然后定格到最后：最后 1 秒按钮轻轻一跳，不淡出、不缩成小 logo。内容铺满 y300–1330。
// 画面不出网址（规则禁止）；logo 用 meta.logo，没有就画产品名首字的圆角徽章。
// ============================================================
type P = {badge?: string; slogan: string; name?: string; button?: string};

export const plan = (p: P, dur: number) => {
  const b = tokens.motion.blob;
  const shrink0 = b.hold;
  const dotAt = shrink0 + b.shrink;
  const sloganAt = 0.02;
  const logoPop = 0.1;
  const nameAt = 0.18;
  const pillAt = 0.28;
  const charsAt = 0.34;
  const lockAt = Math.max(charsAt + 0.8, dur - tokens.motion.logoHold);
  return {shrink0, dotAt, sloganAt, logoPop, nameAt, pillAt, charsAt, lockAt};
};

const Logo: React.FC<{logo?: string; name: string; size: number}> = ({logo, name, size}) => {
  const pal = usePal();
  if (logo) return <Img src={staticFile(logo)} style={{width: size, height: size, borderRadius: size * 0.24, objectFit: 'cover', border: `4px solid ${pal.ink}`}} />;
  return (
    <div style={{width: size, height: size, borderRadius: size * 0.26, background: pal.primary, border: `5px solid ${pal.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pal.onPrimary, fontSize: size * 0.52, fontWeight: 900, lineHeight: 1, flexShrink: 0}}>
      {Array.from(name)[0] ?? '·'}
    </div>
  );
};

const BrandEnd: React.FC<ShotProps<P>> = ({params, t, dur, meta}) => {
  const tk = useTk();
  const pal = usePal();
  const pl = plan(params, dur);
  const B = tk.motion?.blob ?? {dot: 24};
  const name = params.name ?? meta?.product ?? '';
  const button = params.button ?? meta?.cta;
  const cx = 540;
  const dotY = 735;
  // 圆形擦除收回：半径从刚好盖满全屏（到最远角 ≈1320）开始缩，缓出，前两三帧就露出内容
  const shrinkP = interpolate(t, [pl.shrink0, pl.dotAt], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const r = t < pl.shrink0 ? 1330 : 1330 * (1 - shrinkP) + (B.dot / 2) * shrinkP;
  const slogan = (params.slogan ?? '').split('\n').slice(0, 2);
  const sl = fitLine(slogan.reduce((a, b) => (a.length > b.length ? a : b), ''), 780, tk.type?.headline ?? 80, 56);
  const logoD = 190;
  const ns = fitLine(name, 780 - 48 - logoD - 40 - 40, tk.type?.brandName ?? 150, 60);
  const fly = interpolate(t, [pl.nameAt, pl.nameAt + (tk.motion?.flyIn ?? 0.13)], [1, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const logoS = interpolate(t, [pl.logoPop, pl.logoPop + 0.2], [0.4, 1], {...clamp, easing: backOut(1.6)});
  const cs = (at: number) => interpolate(t, [at, at + 0.2], [0.2, 1], {...clamp, easing: backOut(1.5)});
  const lineIn = (at: number) => ({opacity: interpolate(t, [at, at + 0.1], [0, 1], clamp), transform: `translateY(${interpolate(t, [at, at + 0.2], [24, 0], {...clamp, easing: Easing.out(Easing.cubic)})}px)`});
  const bs = fitLine(button ?? '', 700, 48, 36);
  const pulse = interpolate(t, [pl.lockAt, pl.lockAt + 0.12, pl.lockAt + 0.3], [1, 1.07, 1], clamp);
  const cardTop = 610;
  const cardH = 250;
  const btnTop = cardTop + cardH + 46;
  const H = 300;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {params.badge ? (
        <div style={{position: 'absolute', left: 150, width: 780, top: 300, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, fontSize: tk.type?.eyebrow ?? 30, fontWeight: 800, color: pal.primary, ...lineIn(0)}}>
          <Mark kind="check" size={34} color={pal.primary} stroke={10} />
          <span>{params.badge}</span>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 150, width: 780, top: 360, textAlign: 'center', fontSize: sl, fontWeight: 900, color: pal.ink, lineHeight: 1.25}}>
        {slogan.map((l, i) => (
          <div key={i} style={{whiteSpace: 'nowrap', ...lineIn(pl.sloganAt + i * 0.1)}}>
            {l}
          </div>
        ))}
      </div>
      {/* logo 卡：logo + 产品名（宽 780，占画面 72%） */}
      <div style={{position: 'absolute', left: 150, width: 780, top: cardTop, height: cardH, borderRadius: 40, background: pal.card, border: `5px solid ${pal.ink}`, boxShadow: `0 12px 0 ${pal.ink}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 40, padding: '0 40px', overflow: 'hidden', transform: `scale(${logoS})`}}>
        <Logo logo={meta?.logo} name={name} size={logoD} />
        <div style={{fontSize: ns, fontWeight: 900, color: pal.primary, lineHeight: 1.1, whiteSpace: 'nowrap', letterSpacing: tk.font?.latinTracking ?? '-0.025em', transform: `translateX(${fly * 360}px)`, filter: fly > 0.02 ? `blur(${fly * 10}px)` : undefined, opacity: t >= pl.nameAt ? 1 : 0}}>
          {name}
        </div>
      </div>
      {button ? (
        <div style={{position: 'absolute', left: 150, width: 780, top: btnTop, display: 'flex', justifyContent: 'center', opacity: interpolate(t, [pl.pillAt, pl.pillAt + (tk.motion?.pillFade ?? 0.1)], [0, 1], clamp), transform: `scale(${pulse})`}}>
          <Pill text={button} bg={pal.highlight} color={pal.ink} size={bs} style={{border: `5px solid ${pal.ink}`, padding: '16px 48px', boxShadow: `0 8px 0 ${pal.ink}`}} />
        </div>
      ) : null}
      <Actor who="a" x={270} y={1330} size={H} t={t} scale={cs(pl.charsAt)} lit facing="right" expr="happy" pose="wave" />
      <Actor who="b" x={810} y={1330} size={H} t={t} scale={cs(pl.charsAt + 0.1)} facing="left" expr="happy" pose="peace" />
      <Hearts t={t} at={pl.charsAt + 0.25} x={540} y={1200} spread={260} />
      <Hearts t={t} at={pl.lockAt} x={540} y={1200} spread={200} />
      {r > B.dot / 2 + 0.5 && t < pl.dotAt ? <div style={{position: 'absolute', left: cx - r, top: dotY - r, width: r * 2, height: r * 2, borderRadius: '50%', background: pal.highlight}} /> : null}
    </div>
  );
};
export default BrandEnd;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur);
  return [
    {at: pl.shrink0, kind: 'whoosh', vol: 0.22},
    {at: pl.logoPop, kind: 'pop', vol: 0.3},
    {at: pl.nameAt, kind: 'swish', vol: 0.3},
    {at: pl.charsAt, kind: 'pu', vol: 0.24},
    {at: pl.lockAt, kind: 'bell', vol: 0.26},
  ];
};
