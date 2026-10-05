// 动效画面的背景：铺满 B-roll 框，不是纯平的底色——很淡的纹理 + 几块按风格画的形状在框边慢慢漂。
// 形状都贴着框的四角和顶上那条平台栏，躲在卡片后面；只有形状和纹理，没有字。
//   wood：木纹桌面 + 几块刷漆木积木（浅蓝灰、暖橙、原木色）
//   clay：细颗粒 + 软软的黏土团
//   paper：纸纤维 + 两角叠几层彩纸
//   ink：点格白纸 + 几笔墨线涂鸦和一块荧光笔
// 坐标是「参考像素」（短边 1080），MotionLayer 统一缩放。
import React from 'react';
import {Easing} from 'remotion';
import {blend, rgba, type MotionPalette} from './palette';
import {drift, prog, springAt} from './parts';

type Props = {pal: MotionPalette; w: number; h: number; t: number; seed: string; focus: {x: number; y: number; w: number; h: number}};

/** 纹理（SVG 噪声）：只在第一帧算一次，后面每帧 DOM 不变，浏览器不重画 */
const Grain: React.FC<{id: string; w: number; h: number; freq: string; octaves: number; color: string; gain: number; cut: number; seed: number}> = React.memo(({id, w, h, freq, octaves, color, gain, cut, seed}) => {
  const n = parseInt(color.slice(1), 16);
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  return (
    <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0}}>
      <filter id={id} x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
        <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={octaves} seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values={`0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${gain} 0 0 0 ${-gain * cut}`} />
      </filter>
      <rect x={0} y={0} width={w} height={h} filter={`url(#${id})`} />
    </svg>
  );
});

/** 进场：从框外滑进来（0.6 秒弹簧），之后慢慢漂 */
const enterAt = (t: number, i: number) => springAt(t, 0.03 * i, 16, 110);

const WoodBlocks: React.FC<Props> = ({pal, w, h, t}) => {
  const S = Math.min(w, h);
  const darker = (c: string) => blend(c, '#3B2410', 0.28);
  const grain = 'repeating-linear-gradient(98deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 7px, rgba(70,40,10,0.035) 7px, rgba(70,40,10,0.035) 16px)';
  const blocks = [
    {x: -0.07 * w, y: 0.035 * h, bw: 0.36 * S, bh: 0.19 * S, c: pal.cool, r: 0.035 * S, rot: -11, dx: -1, dy: -0.4},
    {x: 0.79 * w, y: 0.05 * h, bw: 0.25 * S, bh: 0.125 * S, c: pal.accent, r: 0, arch: true, rot: 8, dx: 1, dy: -0.5},
    {x: 0.035 * w, y: h - 0.2 * S, bw: 0.15 * S, bh: 0.15 * S, c: pal.warm, r: 0.025 * S, rot: 9, dx: -1, dy: 0.5},
    {x: w - 0.2 * S, y: h - 0.27 * S, bw: 0.19 * S, bh: 0.19 * S, c: blend(pal.cool, '#FFFFFF', 0.25), r: 0.095 * S, rot: 0, dx: 1, dy: 0.6},
    {x: 0.62 * w, y: 0.012 * h, bw: 0.085 * S, bh: 0.085 * S, c: pal.warm, r: 0.018 * S, rot: -16, dx: 0.3, dy: -1},
  ];
  return (
    <>
      {blocks.map((b, i) => {
        const e = enterAt(t, i);
        const ox = (1 - e) * b.dx * 0.32 * S + drift(t, 8 + i * 1.7, 0.012 * S, i);
        const oy = (1 - e) * b.dy * 0.32 * S + drift(t, 9.5 + i * 1.3, 0.014 * S, i * 2);
        const depth = Math.max(8, 0.028 * S);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: b.x + ox,
              top: b.y + oy,
              width: b.bw,
              height: b.bh,
              borderRadius: b.arch ? `${b.bw / 2}px ${b.bw / 2}px ${0.012 * S}px ${0.012 * S}px` : b.r,
              background: `${grain}, ${b.c}`,
              boxShadow: `inset 0 4px 0 rgba(255,255,255,0.32), 0 ${depth}px 0 ${darker(b.c)}, 0 ${depth + 0.03 * S}px ${0.05 * S}px ${rgba('#4A3218', 0.2)}`,
              transform: `rotate(${b.rot + drift(t, 11 + i, 1.6, i)}deg)`,
            }}
          />
        );
      })}
    </>
  );
};

const ClayBlobs: React.FC<Props> = ({pal, w, h, t}) => {
  const S = Math.min(w, h);
  const blobs = [
    {x: -0.09 * w, y: 0.02 * h, s: 0.34 * S, c: pal.cool, br: '58% 42% 55% 45% / 50% 58% 42% 50%', dx: -1, dy: -0.3},
    {x: 0.78 * w, y: 0.03 * h, s: 0.26 * S, c: pal.warm, br: '46% 54% 40% 60% / 55% 45% 55% 45%', dx: 1, dy: -0.4},
    {x: 0.02 * w, y: h - 0.24 * S, s: 0.2 * S, c: pal.accent, br: '50% 50% 46% 54% / 60% 52% 48% 40%', dx: -1, dy: 0.5},
    {x: w - 0.25 * S, y: h - 0.3 * S, s: 0.24 * S, c: blend(pal.cool, pal.warm, 0.5), br: '62% 38% 52% 48% / 46% 60% 40% 54%', dx: 1, dy: 0.5},
    {x: 0.6 * w, y: 0.0 * h, s: 0.1 * S, c: pal.accent, br: '50%', dx: 0.3, dy: -1},
  ];
  return (
    <>
      {blobs.map((b, i) => {
        const e = enterAt(t, i);
        const ox = (1 - e) * b.dx * 0.3 * S + drift(t, 7 + i * 1.5, 0.012 * S, i);
        const oy = (1 - e) * b.dy * 0.3 * S + drift(t, 8.5 + i, 0.014 * S, i * 2);
        const sq = 1 + drift(t, 3.2 + i * 0.4, 0.02, i);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: b.x + ox,
              top: b.y + oy,
              width: b.s,
              height: b.s * 0.9,
              borderRadius: b.br,
              background: `radial-gradient(circle at 34% 28%, ${blend(b.c, '#FFFFFF', 0.45)} 0%, ${b.c} 45%, ${blend(b.c, '#6A3A30', 0.22)} 100%)`,
              boxShadow: `0 ${0.025 * S}px ${0.05 * S}px ${rgba('#8C4A40', 0.22)}`,
              transform: `scale(${sq}, ${2 - sq})`,
            }}
          />
        );
      })}
    </>
  );
};

/** 叠纸：角上几层彩纸山丘，每层带一点投影，前后层漂的速度不一样 */
const PaperLayers: React.FC<Props> = ({pal, w, h, t}) => {
  const S = Math.min(w, h);
  const hills = ['M0 18 C22 8 40 30 62 40 C80 48 94 66 100 100 L0 100 Z', 'M0 42 C18 34 36 50 54 58 C70 65 84 80 90 100 L0 100 Z', 'M0 66 C14 60 30 70 42 78 C54 86 62 94 66 100 L0 100 Z'];
  const layer = (corner: 'bl' | 'tr', i: number, color: string) => {
    const e = enterAt(t, corner === 'bl' ? i : i + 3);
    const cw = (corner === 'bl' ? 0.64 : 0.5) * S;
    const ch = (corner === 'bl' ? 0.46 : 0.36) * S;
    const par = (i + 1) * 0.006 * S;
    const ox = drift(t, 9 + i * 2, par, i) + (1 - e) * (corner === 'bl' ? -1 : 1) * 0.25 * S;
    const oy = (1 - e) * (corner === 'bl' ? 1 : -1) * 0.2 * S;
    const style: React.CSSProperties =
      corner === 'bl'
        ? {position: 'absolute', left: -0.02 * w + ox, top: h - ch + 0.01 * h + oy, width: cw, height: ch}
        : {position: 'absolute', left: w - cw + 0.02 * w + ox, top: -0.01 * h + oy, width: cw, height: ch, transform: 'rotate(180deg)'};
    return (
      <svg key={`${corner}${i}`} viewBox="0 0 100 100" preserveAspectRatio="none" style={{...style, overflow: 'visible', filter: `drop-shadow(0 ${0.008 * S}px ${0.012 * S}px ${rgba('#3A3020', 0.22)})`}}>
        <path d={hills[i]} fill={color} />
      </svg>
    );
  };
  const strip = enterAt(t, 2);
  return (
    <>
      {layer('tr', 0, pal.warm)}
      {layer('tr', 1, pal.cool)}
      {layer('bl', 0, pal.cool)}
      {layer('bl', 1, pal.warm)}
      {layer('bl', 2, pal.accent)}
      <div
        style={{
          position: 'absolute',
          left: -0.04 * w,
          top: 0.045 * h,
          width: 0.42 * S * strip,
          height: 0.07 * S,
          background: blend(pal.accent, '#FFFFFF', 0.25),
          transform: `rotate(-4deg) translateX(${drift(t, 10, 0.01 * S)}px)`,
          boxShadow: `0 ${0.006 * S}px ${0.012 * S}px ${rgba('#3A3020', 0.2)}`,
          clipPath: 'polygon(0 0, 100% 6%, 97% 100%, 0 92%)',
        }}
      />
    </>
  );
};

/** 墨线涂鸦：几笔画出来（第 0.1–1.0 秒），之后轻轻晃 */
const InkDoodles: React.FC<Props> = ({pal, w, h, t}) => {
  const S = Math.min(w, h);
  const stroke = rgba(pal.ink, 0.6);
  const draw = (i: number) => prog(t, 0.1 + i * 0.12, 0.6, Easing.inOut(Easing.quad));
  /** 笔画粗细按像素给：viewBox 宽 vb 画在 px 宽的框里 */
  const path = (d: string, i: number, vb: number, px: number, sw = 6) => (
    <path d={d} fill="none" stroke={stroke} strokeWidth={(sw * vb) / Math.max(1, px)} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw(i)} />
  );
  const wob = (i: number) => `rotate(${drift(t, 6 + i, 1.5, i)}deg)`;
  const hl = enterAt(t, 1);
  const loop = 0.27 * S;
  const wave = 0.36 * S;
  const star = 0.06 * S;
  return (
    <>
      <div style={{position: 'absolute', left: 0.05 * w, top: 0.04 * h, width: 0.3 * S * hl, height: 0.075 * S, background: rgba(pal.accent, 0.75), borderRadius: 0.02 * S, transform: 'rotate(-3deg) skewX(-10deg)'}} />
      <svg viewBox="0 0 100 100" style={{position: 'absolute', left: w - 0.3 * S, top: 0.02 * h, width: loop, height: loop, overflow: 'visible', transform: wob(0)}}>
        {path('M50 12 C74 10 90 30 86 54 C82 78 58 90 38 84 C18 78 10 56 18 38 C26 22 44 18 58 24 C70 30 72 46 62 54', 0, 100, loop)}
      </svg>
      <svg viewBox="0 0 100 40" style={{position: 'absolute', left: 0.04 * w, top: h - 0.16 * S, width: wave, height: wave * 0.4, overflow: 'visible', transform: wob(1)}}>
        {path('M4 24 C14 8 22 8 30 22 C38 36 46 36 54 22 C62 8 70 8 78 22 C84 32 90 32 96 24', 1, 100, wave)}
      </svg>
      {[
        [0.9, 0.42],
        [0.06, 0.38],
        [0.82, 0.88],
      ].map(([fx, fy], i) => (
        <svg key={i} viewBox="0 0 40 40" style={{position: 'absolute', left: fx * w - star / 2, top: fy * h - star / 2, width: star, height: star, overflow: 'visible', transform: wob(i + 2)}}>
          {path('M20 4 L20 36', i + 2, 40, star, 5)}
          {path('M4 20 L36 20', i + 2.5, 40, star, 5)}
        </svg>
      ))}
    </>
  );
};

export const Backdrop: React.FC<Props> = (props) => {
  const {pal, w, h, seed, focus} = props;
  const look = pal.look;
  const id = `grain-${seed.replace(/[^a-z0-9]/gi, '')}`;
  const base = look === 'ink' ? `linear-gradient(170deg, ${pal.bg} 0%, ${pal.bg2} 100%)` : `linear-gradient(162deg, ${blend(pal.bg, '#FFFFFF', 0.25)} 0%, ${pal.bg} 45%, ${pal.bg2} 100%)`;
  const grain =
    look === 'wood' ? (
      <Grain id={id} w={w} h={h} freq="0.0022 0.055" octaves={3} color={blend(pal.bg2, '#5A3A1A', 0.45)} gain={0.55} cut={0.42} seed={7} />
    ) : look === 'clay' ? (
      <Grain id={id} w={w} h={h} freq="0.75" octaves={2} color={blend(pal.bg2, '#7A3B33', 0.4)} gain={0.35} cut={0.4} seed={3} />
    ) : look === 'paper' ? (
      <Grain id={id} w={w} h={h} freq="0.55 0.9" octaves={2} color={blend(pal.bg2, '#5A4A30', 0.4)} gain={0.3} cut={0.42} seed={11} />
    ) : (
      <div style={{position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${rgba(pal.ink, 0.14)} 0px, ${rgba(pal.ink, 0.14)} 2px, transparent 2.6px)`, backgroundSize: '38px 38px'}} />
    );
  const Shapes = look === 'wood' ? WoodBlocks : look === 'clay' ? ClayBlobs : look === 'paper' ? PaperLayers : InkDoodles;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', background: base}}>
      {grain}
      {/* 内容后面一团亮光，把字从纹理上托起来 */}
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse ${Math.round(focus.w * 0.75)}px ${Math.round(focus.h * 0.7)}px at ${Math.round(focus.x + focus.w / 2)}px ${Math.round(focus.y + focus.h / 2)}px, rgba(255,255,255,${look === 'ink' ? 0.5 : 0.42}) 0%, rgba(255,255,255,0) 100%)`}} />
      <Shapes {...props} />
      {look !== 'ink' ? <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 58%, ${rgba(blend(pal.bg2, '#3A2410', 0.5), 0.16)} 100%)`}} /> : null}
    </div>
  );
};
