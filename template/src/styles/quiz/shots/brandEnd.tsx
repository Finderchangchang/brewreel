import React from 'react';
import {Easing, Img, interpolate, staticFile} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitLine} from '../../../core/fit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Actor} from '../parts/cast';
import {Mark, SealFace, Sparks, backOut, cardStyle, usePal, useTk, useVoice} from '../parts/kit';
import tokens from '../tokens.json';

// ============================================================
// quiz / brandEnd：结业卡落版。接上一镜的印章擦除：
// 满屏朱红方章只停 1 帧（motion.sealWipe.hold），0.26 秒边转边缩，正好落成品牌卡右上角的一枚印章——缩的同时下面的整版已经在位
// （边擦边露出内容，不停在纯色上）：朱红手写勾 + 小标（口吻里的「本题已掌握 / 又长知识了 / 这一题拿下了」或 params.badge）
// + 两行口号（左对齐，整行弹入）、品牌卡（logo + 产品名，宽 780，主色硬投影）、票根形 CTA 按钮（params.button 或 meta.cta）、两个小人放火花，
// 全部在前 0.5 秒内入场，然后定格到最后：最后 1 秒按钮轻轻一跳，不淡出、不缩成小 logo。内容铺满 y300–1330。
// 画面不出网址（规则禁止）；logo 用 meta.logo，没有就画产品名首字的圆角徽章。
// ============================================================
type P = {badge?: string; slogan: string; name?: string; button?: string};

export const plan = (p: P, dur: number) => {
  const w = tokens.motion.sealWipe;
  const shrink0 = w.hold;
  const sealAt = shrink0 + w.shrink;
  const sloganAt = 0.02;
  const logoPop = 0.1;
  const nameAt = 0.18;
  const pillAt = 0.28;
  const charsAt = 0.34;
  const lockAt = Math.max(charsAt + 0.8, dur - tokens.motion.logoHold);
  return {shrink0, sealAt, sloganAt, logoPop, nameAt, pillAt, charsAt, lockAt};
};

const Logo: React.FC<{logo?: string; name: string; size: number}> = ({logo, name, size}) => {
  const pal = usePal();
  if (logo) return <Img src={staticFile(logo)} style={{width: size, height: size, borderRadius: size * 0.2, objectFit: 'cover', border: `4px solid ${pal.ink}`}} />;
  // 没给 logo 时画一枚圆形印章（主色底 + 内圈细线 + 产品名首字），跟本风格的批改章一套，不画圆角方块字母徽标
  return (
    <div style={{width: size, height: size, borderRadius: '50%', background: pal.primary, border: `5px solid ${pal.ink}`, boxShadow: `inset 0 0 0 ${Math.round(size * 0.06)}px ${pal.primary}, inset 0 0 0 ${Math.round(size * 0.06) + 3}px ${pal.onPrimary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pal.onPrimary, fontSize: size * 0.48, fontWeight: 800, lineHeight: 1, flexShrink: 0}}>
      {Array.from(name)[0] ?? '·'}
    </div>
  );
};

/** 票根形按钮：主色底、两端各咬掉一个半圆缺口（纸色），中间一道虚线撕口 */
const Ticket: React.FC<{text: string; size: number}> = ({text, size}) => {
  const pal = usePal();
  const notch = 22;
  return (
    <div style={{position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 26, padding: `18px ${notch + 30}px`, background: pal.primary, border: `5px solid ${pal.ink}`, borderRadius: 12, boxShadow: `8px 8px 0 ${pal.ink}`, color: pal.onPrimary, fontSize: size, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap'}}>
      <div style={{position: 'absolute', left: -notch - 5, top: '50%', marginTop: -notch, width: notch * 2, height: notch * 2, borderRadius: '50%', background: pal.bg, border: `5px solid ${pal.ink}`, boxSizing: 'border-box', clipPath: 'inset(0 0 0 50%)'}} />
      <div style={{position: 'absolute', right: -notch - 5, top: '50%', marginTop: -notch, width: notch * 2, height: notch * 2, borderRadius: '50%', background: pal.bg, border: `5px solid ${pal.ink}`, boxSizing: 'border-box', clipPath: 'inset(0 50% 0 0)'}} />
      <span>{text}</span>
      <span style={{alignSelf: 'stretch', borderLeft: `4px dashed ${pal.onPrimary}`, opacity: 0.6}} />
      <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 40 40">
        <path d="M8 20 L30 20 M21 11 L30 20 L21 29" fill="none" stroke={pal.highlight} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

const BrandEnd: React.FC<ShotProps<P>> = ({params, t, dur, meta}) => {
  const tk = useTk();
  const pal = usePal();
  const voice = useVoice(meta);
  const pl = plan(params, dur);
  const name = params.name ?? meta?.product ?? '';
  const button = params.button ?? meta?.cta;
  const badge = params.badge ?? voice('badge');
  const x0 = tk.layout?.marginLeft ?? 150;
  const slogan = (params.slogan ?? '').split('\n').slice(0, 2);
  const sl = fitLine(slogan.reduce((a, b) => (a.length > b.length ? a : b), ''), 780, tk.type?.headline ?? 70, 52);
  const logoD = 170;
  const ns = fitLine(name, 780 - 48 - logoD - 36 - 120, tk.type?.brandName ?? 110, 56);
  const fly = interpolate(t, [pl.nameAt, pl.nameAt + (tk.motion?.flyIn ?? 0.13)], [1, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const logoS = interpolate(t, [pl.logoPop, pl.logoPop + 0.2], [0.4, 1], {...clamp, easing: backOut(1.6)});
  const cs = (at: number) => interpolate(t, [at, at + 0.2], [0.2, 1], {...clamp, easing: backOut(1.5)});
  const lineIn = (at: number) => ({opacity: interpolate(t, [at, at + 0.1], [0, 1], clamp), transform: `translateY(${interpolate(t, [at, at + 0.2], [24, 0], {...clamp, easing: Easing.out(Easing.cubic)})}px)`});
  const bs = fitLine(button ?? '', 560, 46, 34);
  const pulse = interpolate(t, [pl.lockAt, pl.lockAt + 0.12, pl.lockAt + 0.3], [1, 1.07, 1], clamp);
  const cardTop = 600;
  const cardH = 236;
  const btnTop = cardTop + cardH + 58;
  const H = 300;
  // 印章擦除收回：从盖满全屏的朱红方章开始，边转边缩到品牌卡右上角的印章位置（缓出，前两三帧就露出内容）
  const W = tk.motion?.sealWipe ?? {rot: 8};
  const sealD = 150;
  const sealX = x0 + 780 - 40;
  const sealY = cardTop - 6;
  const sp = interpolate(t, [pl.shrink0, pl.sealAt], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const side = t < pl.shrink0 ? 3000 : 3000 * (1 - sp) + sealD * sp;
  // 起点 = 上一镜 commentCta 交卷键的圆心（同一套 layout.comment 算出来）
  const C = tk.layout?.comment ?? {y: 790, h: 150, send: 96};
  const fromX = x0 + 780 - 28 - C.send / 2;
  const fromY = C.y + C.h / 2;
  const cx = fromX + (sealX - fromX) * sp;
  const cy = fromY + (sealY - fromY) * sp;
  const rot = (W.rot ?? 8) * (1 - sp) - 8 * sp;
  const landed = t >= pl.sealAt;
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: x0, top: 300, display: 'flex', alignItems: 'center', gap: 12, fontSize: tk.type?.eyebrow ?? 30, fontWeight: 800, color: pal.ink, whiteSpace: 'nowrap', ...lineIn(0)}}>
        <Mark kind="check" size={40} color={pal.pen} stroke={10} />
        <span>{badge}</span>
      </div>
      <div style={{position: 'absolute', left: x0, top: 364, width: 780, textAlign: 'left', fontSize: sl, fontWeight: 800, color: pal.ink, lineHeight: 1.28}}>
        {slogan.map((l, i) => (
          <div key={i} style={{whiteSpace: 'nowrap', ...lineIn(pl.sloganAt + i * 0.1)}}>
            {l}
          </div>
        ))}
      </div>
      {/* 品牌卡：logo + 产品名（宽 780），主色硬投影；右上角压一枚印章（印章擦除落在这里） */}
      <div style={{position: 'absolute', left: x0, width: 780, top: cardTop, height: cardH, display: 'flex', alignItems: 'center', gap: 36, padding: '0 40px', overflow: 'hidden', transform: `scale(${logoS})`, transformOrigin: 'left center', ...cardStyle(pal, {radius: 20, stroke: 5, shadow: 12, shadowColor: pal.primary})}}>
        <Logo logo={meta?.logo} name={name} size={logoD} />
        <div style={{fontSize: ns, fontWeight: 800, color: pal.ink, lineHeight: 1.1, whiteSpace: 'nowrap', letterSpacing: tk.font?.latinTracking ?? '-0.01em', transform: `translateX(${fly * 360}px)`, filter: fly > 0.02 ? `blur(${fly * 10}px)` : undefined, opacity: t >= pl.nameAt ? 1 : 0}}>
          {name}
        </div>
      </div>
      {button ? (
        <div style={{position: 'absolute', left: x0 + 26, top: btnTop, opacity: interpolate(t, [pl.pillAt, pl.pillAt + (tk.motion?.pillFade ?? 0.1)], [0, 1], clamp), transform: `scale(${pulse})`, transformOrigin: 'left center'}}>
          <Ticket text={button} size={bs} />
        </div>
      ) : null}
      <Actor who="a" x={300} y={1330} size={H} t={t} scale={cs(pl.charsAt)} lit facing="right" expr="happy" pose="wave" />
      <Actor who="b" x={780} y={1330} size={H} t={t} scale={cs(pl.charsAt + 0.1)} facing="left" expr="happy" pose="peace" />
      <Sparks t={t} at={pl.charsAt + 0.25} x={540} y={1180} spread={260} />
      <Sparks t={t} at={pl.lockAt} x={540} y={1180} spread={200} />
      {/* 印章：擦除收回的过程和落定后的印章是同一个元素 */}
      <div style={{position: 'absolute', left: cx - side / 2, top: cy - side / 2, width: side, height: side, transform: `rotate(${rot}deg)`}}>
        {landed ? <SealFace text="" size={side} check /> : <div style={{width: side, height: side, borderRadius: side * 0.14, background: pal.pen}} />}
      </div>
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
    {at: pl.sealAt, kind: 'thud', vol: 0.32},
    {at: pl.charsAt, kind: 'pu', vol: 0.24},
    {at: pl.lockAt, kind: 'bell', vol: 0.26},
  ];
};
