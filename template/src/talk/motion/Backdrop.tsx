// 动效画面的背景：铺满 B-roll 框，不是纯平的底色——很淡的纹理（编码后也看得出）+ 一两块很大的柔边色块慢慢漂 + 几件按风格画的装饰。
// 装饰只放在禁区以外：禁区 = 取景框外扩 48 参考像素（720 宽时 32 像素）、字幕带、画中画圆窗外扩 72 参考像素。
// 所以 split 下装饰只在顶上平台栏那一条里（一部分出画），pip / full 再加上字幕下面那一块；装饰压不到字、也不从圆窗后面露出来。
// 只有形状和纹理，没有字、没有像字符的符号（不画「+」）。
//   wood：木纹桌面 + 几块刷漆木积木（浅蓝灰、暖橙、原木色）
//   clay：细毛孔 + 斑驳 + 软软的黏土团
//   paper：纸纤维 + 斑驳 + 两角叠几层彩纸
//   ink：点格白纸 + 一道荧光笔、一圈墨线涂鸦，pip / full 底下再加一道波浪线
// 坐标是「参考像素」（短边 1080），MotionLayer 统一缩放。
import React from 'react';
import {Easing} from 'remotion';
import type {Rect} from '../layout';
import {blend, rgba, type MotionPalette} from './palette';
import {clayPores, clayPrints, drift, noiseTile, prog, springAt} from './parts';
import {inflate, placeDecor, type DecorSpec} from './stage';

type Props = {
  pal: MotionPalette;
  w: number;
  h: number;
  t: number;
  seed: string;
  /** 取景框（参考像素，相对 B-roll 框左上角） */
  focus: Rect;
  /** 另外要躲开的（字幕带、圆窗，参考像素，相对 B-roll 框左上角；已经外扩过） */
  avoid: Rect[];
};

/** 文字框外扩多少才放装饰（参考像素；720 宽时 32 像素） */
export const DECOR_PAD = 48;

type Piece = DecorSpec & {
  rot?: number;
  draw: (w: number, h: number, t: number) => React.ReactNode;
};

/** 进场：从框外滑进来（弹簧），之后慢慢漂 */
const enterAt = (t: number, i: number) => springAt(t, 0.03 * i, 16, 110);

const woodPieces = (pal: MotionPalette, S: number): Piece[] => {
  const darker = (c: string) => blend(c, '#3B2410', 0.28);
  const grain = 'repeating-linear-gradient(98deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 7px, rgba(70,40,10,0.035) 7px, rgba(70,40,10,0.035) 16px)';
  const block = (c: string, radius: (w: number, h: number) => string) => (w: number, h: number) => {
    const depth = Math.max(8, 0.06 * Math.min(w, h) + 4);
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius(w, h),
          background: `${grain}, ${c}`,
          boxShadow: `inset 0 4px 0 rgba(255,255,255,0.32), 0 ${depth}px 0 ${darker(c)}, 0 ${depth + 0.2 * depth}px ${depth * 2.4}px ${rgba('#4A3218', 0.2)}`,
        }}
      />
    );
  };
  return [
    {slot: 'tl', w: 0.34 * S, h: 0.17 * S, rot: -9, draw: block(pal.cool, (w, h) => `${0.1 * h}px`)},
    {slot: 'tr', w: 0.24 * S, h: 0.13 * S, rot: 7, at: 0.0, draw: block(pal.accent, (w) => `${w / 2}px ${w / 2}px ${0.05 * w}px ${0.05 * w}px`)},
    {slot: 'tm', w: 0.08 * S, h: 0.08 * S, rot: -14, at: 0.01, draw: block(pal.warm, (w) => `${0.18 * w}px`)},
    {slot: 'bl', w: 0.16 * S, h: 0.16 * S, rot: 9, draw: block(pal.warm, (w) => `${0.16 * w}px`)},
    {slot: 'bl', w: 0.12 * S, h: 0.12 * S, rot: 0, shift: 0.22, draw: block(blend(pal.cool, '#FFFFFF', 0.2), () => '50%')},
    {slot: 'br', w: 0.19 * S, h: 0.19 * S, rot: 0, draw: block(blend(pal.cool, '#FFFFFF', 0.25), () => '50%')},
  ];
};

const clayPieces = (pal: MotionPalette, S: number): Piece[] => {
  const blob = (c: string, br: string, i: number) => (w: number, h: number, t: number) => {
    const sq = 1 + drift(t, 3.2 + i * 0.4, 0.02, i);
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: br,
          background: `${clayPores(pal)}, radial-gradient(circle at 34% 28%, ${blend(c, '#FFFFFF', 0.45)} 0%, ${c} 45%, ${blend(c, '#6A3A30', 0.22)} 100%)`,
          backgroundSize: '220px 220px, auto',
          boxShadow: `inset 0 -${0.05 * h}px 0 ${blend(c, '#6A3A30', 0.16)}, 0 ${0.06 * h}px ${0.14 * h}px ${rgba('#8C4A40', 0.22)}`,
          transform: `scale(${sq}, ${2 - sq})`,
        }}
      />
    );
  };
  return [
    {slot: 'tl', w: 0.32 * S, h: 0.22 * S, rot: -6, draw: blob(pal.cool, '58% 42% 55% 45% / 50% 58% 42% 50%', 0)},
    {slot: 'tr', w: 0.26 * S, h: 0.2 * S, rot: 8, draw: blob(pal.warm, '46% 54% 40% 60% / 55% 45% 55% 45%', 1)},
    {slot: 'tm', w: 0.09 * S, h: 0.08 * S, at: 0.01, draw: blob(pal.accent, '50%', 2)},
    {slot: 'bl', w: 0.2 * S, h: 0.18 * S, draw: blob(pal.accent, '50% 50% 46% 54% / 60% 52% 48% 40%', 3)},
    {slot: 'bl', w: 0.12 * S, h: 0.11 * S, shift: 0.22, draw: blob(pal.cool, '50%', 4)},
    {slot: 'br', w: 0.24 * S, h: 0.21 * S, draw: blob(blend(pal.cool, pal.warm, 0.5), '62% 38% 52% 48% / 46% 60% 40% 54%', 5)},
  ];
};

const paperPieces = (pal: MotionPalette, S: number): Piece[] => {
  const hills = ['M0 18 C22 8 40 30 62 40 C80 48 94 66 100 100 L0 100 Z', 'M0 42 C18 34 36 50 54 58 C70 65 84 80 90 100 L0 100 Z', 'M0 66 C14 60 30 70 42 78 C54 86 62 94 66 100 L0 100 Z'];
  const stack = (colors: string[], flip: boolean) => (w: number, h: number, t: number) => (
    <>
      {colors.map((c, i) => (
        <svg
          key={i}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            left: drift(t, 9 + i * 2, (i + 1) * 0.012 * w, i),
            top: 0,
            width: w,
            height: h,
            overflow: 'visible',
            transform: flip ? 'rotate(180deg)' : 'none',
            filter: `drop-shadow(0 ${0.02 * h}px ${0.03 * h}px ${rgba('#3A3020', 0.22)})`,
          }}
        >
          <path d={hills[i]} fill={c} />
        </svg>
      ))}
    </>
  );
  const strip = (w: number, h: number) => (
    <div style={{position: 'absolute', inset: 0, background: blend(pal.accent, '#FFFFFF', 0.25), boxShadow: `0 ${0.08 * h}px ${0.16 * h}px ${rgba('#3A3020', 0.2)}`, clipPath: 'polygon(0 0, 100% 6%, 97% 100%, 0 92%)'}} />
  );
  return [
    {slot: 'tr', w: 0.5 * S, h: 0.3 * S, draw: stack([pal.warm, pal.cool], true)},
    {slot: 'tl', w: 0.42 * S, h: 0.07 * S, rot: -4, at: 0.03, draw: strip},
    {slot: 'bl', w: 0.62 * S, h: 0.4 * S, draw: stack([pal.cool, pal.warm, pal.accent], false)},
    {slot: 'br', w: 0.36 * S, h: 0.24 * S, draw: stack([pal.warm, pal.cool], false)},
  ];
};

const inkPieces = (pal: MotionPalette, S: number, t0: number): Piece[] => {
  const stroke = rgba(pal.ink, 0.62);
  const draw = (i: number, t: number) => prog(t, t0 + 0.1 + i * 0.12, 0.6, Easing.inOut(Easing.quad));
  const line = (d: string, vb: [number, number], i: number, sw = 6) => (w: number, h: number, t: number) => (
    <svg viewBox={`0 0 ${vb[0]} ${vb[1]}`} preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: w, height: h, overflow: 'visible'}}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={(sw * vb[0]) / Math.max(1, w)} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw(i, t)} />
    </svg>
  );
  const swash = (w: number, h: number, t: number) => (
    <div style={{position: 'absolute', left: 0, top: 0, width: w * prog(t, 0.05, 0.4), height: h, background: rgba(pal.accent, 0.8), borderRadius: 0.25 * h, transform: 'skewX(-10deg)'}} />
  );
  return [
    {slot: 'tl', w: 0.3 * S, h: 0.07 * S, rot: -3, at: 0.035, draw: swash},
    {slot: 'tr', w: 0.25 * S, h: 0.25 * S, at: 0.0, draw: line('M50 12 C74 10 90 30 86 54 C82 78 58 90 38 84 C18 78 10 56 18 38 C26 22 44 18 58 24 C70 30 72 46 62 54', [100, 100], 0)},
    {slot: 'bl', w: 0.36 * S, h: 0.14 * S, at: 0.905, draw: line('M4 24 C14 8 22 8 30 22 C38 36 46 36 54 22 C62 8 70 8 78 22 C84 32 90 32 96 24', [100, 40], 1)},
  ];
};

/** 一两块很大的柔边色块，整段慢慢漂 20–30 像素@720（背景的一部分，在字后面，不算装饰） */
const Patches: React.FC<{pal: MotionPalette; w: number; h: number; t: number}> = ({pal, w, h, t}) => {
  const list =
    pal.look === 'paper'
      ? [
          {cx: 0.2, cy: 0.3, r: 0.62, c: pal.cool, a: 0.22},
          {cx: 0.85, cy: 0.75, r: 0.58, c: pal.warm, a: 0.28},
        ]
      : pal.look === 'clay'
        ? [
            {cx: 0.15, cy: 0.62, r: 0.6, c: pal.cool, a: 0.26},
            {cx: 0.88, cy: 0.3, r: 0.55, c: pal.warm, a: 0.3},
          ]
        : pal.look === 'wood'
          ? [
              {cx: 0.3, cy: 0.35, r: 0.7, c: '#FFFFFF', a: 0.22},
              {cx: 0.9, cy: 0.85, r: 0.5, c: pal.accent, a: 0.1},
            ]
          : [{cx: 0.85, cy: 0.2, r: 0.45, c: pal.accent, a: 0.1}];
  const S = Math.min(w, h);
  return (
    <>
      {list.map((p, i) => {
        const R = p.r * S;
        const x = p.cx * w + drift(t, 11 + i * 3, 0.035 * S, i * 1.7);
        const y = p.cy * h + drift(t, 13 + i * 2, 0.025 * S, i);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - R,
              top: y - R * 0.8,
              width: R * 2,
              height: R * 1.6,
              borderRadius: '50%',
              background: `radial-gradient(ellipse at 50% 50%, ${rgba(p.c, p.a)} 0%, ${rgba(p.c, p.a * 0.75)} 38%, ${rgba(p.c, 0)} 70%)`,
            }}
          />
        );
      })}
    </>
  );
};

/** 底纹：几层可平铺的噪声贴图（低频的斑驳在 H.264 编码后也留得住，细线、细点只是近看的质感） */
const textureOf = (pal: MotionPalette): {image: string; size: string} => {
  const dark = (k: number) => blend(pal.bg2, '#4A3418', k);
  if (pal.look === 'wood') {
    // 木纹（turbulence 取低值 → 细长的纹线）+ 每 320 参考像素一道木板缝 + 斑驳
    const grain = noiseTile({freq: '0.0016 0.05', octaves: 3, color: dark(0.55), gain: 1.1, cut: 0.16, seed: 3, size: 512, type: 'turbulence', invert: true});
    const seam = `repeating-linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 318px, ${rgba(dark(0.6), 0.1)} 318px, ${rgba(dark(0.6), 0.1)} 321px, rgba(255,255,255,0.22) 321px, rgba(255,255,255,0.22) 323px)`;
    const mottle = noiseTile({freq: '0.01', octaves: 3, color: dark(0.45), gain: 0.3, cut: 0.3, seed: 2, size: 512});
    return {image: `${grain}, ${seam}, ${mottle}`, size: '512px 512px, auto, 512px 512px'};
  }
  if (pal.look === 'clay') {
    const mottle = noiseTile({freq: '0.011', octaves: 4, color: blend(pal.edge, '#B8574A', 0.45), gain: 0.6, cut: 0.3, seed: 3, size: 512});
    return {image: `${clayPrints(pal)}, ${clayPores(pal)}, ${mottle}`, size: '256px 256px, 220px 220px, 512px 512px'};
  }
  if (pal.look === 'paper') {
    const fiber = noiseTile({freq: '0.025 0.06', octaves: 2, color: dark(0.5), gain: 1.3, cut: 0.05, seed: 8, size: 256, type: 'turbulence', invert: true});
    const tooth = noiseTile({freq: '0.8', octaves: 1, color: dark(0.6), gain: 0.4, cut: 0.5, seed: 2, size: 200});
    const mottle = noiseTile({freq: '0.006', octaves: 4, color: blend(pal.bg2, '#8A6A3A', 0.5), gain: 0.62, cut: 0.3, seed: 11, size: 512});
    return {image: `${fiber}, ${tooth}, ${mottle}`, size: '256px 256px, 200px 200px, 512px 512px'};
  }
  const mottle = noiseTile({freq: '0.01', octaves: 3, color: blend(pal.bg2, '#3A3630', 0.4), gain: 0.18, cut: 0.3, seed: 6, size: 512});
  return {image: `radial-gradient(circle, ${rgba(pal.ink, 0.14)} 0px, ${rgba(pal.ink, 0.14)} 2px, transparent 2.6px), ${mottle}`, size: '38px 38px, 512px 512px'};
};

export const Backdrop: React.FC<Props> = ({pal, w, h, t, focus, avoid}) => {
  const look = pal.look;
  const S = Math.min(w, h);
  const no = [inflate(focus, DECOR_PAD), ...avoid];
  const pieces = look === 'wood' ? woodPieces(pal, S) : look === 'clay' ? clayPieces(pal, S) : look === 'paper' ? paperPieces(pal, S) : inkPieces(pal, S, 0);
  const base = look === 'ink' ? `linear-gradient(170deg, ${pal.bg} 0%, ${pal.bg2} 100%)` : `linear-gradient(162deg, ${blend(pal.bg, '#FFFFFF', 0.25)} 0%, ${pal.bg} 45%, ${pal.bg2} 100%)`;
  const tex = textureOf(pal);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', background: base}}>
      <div style={{position: 'absolute', inset: 0, backgroundImage: tex.image, backgroundSize: tex.size}} />
      <Patches pal={pal} w={w} h={h} t={t} />
      {/* 内容后面一团亮光，把字从纹理上托起来 */}
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse ${Math.round(focus.width * 0.75)}px ${Math.round(focus.height * 0.7)}px at ${Math.round(focus.x + focus.width / 2)}px ${Math.round(focus.y + focus.height / 2)}px, rgba(255,255,255,${look === 'ink' ? 0.5 : look === 'wood' ? 0.36 : 0.26}) 0%, rgba(255,255,255,0) 100%)`}} />
      {pieces.map((p, i) => {
        const at = placeDecor(p, w, h, no);
        if (!at) return null;
        const pw = p.w * at.s;
        const ph = p.h * at.s;
        const top = p.slot === 'tl' || p.slot === 'tr' || p.slot === 'tm';
        const e = enterAt(t, i);
        const amp = 0.04 * Math.min(pw, ph);
        const ox = drift(t, 8 + i * 1.7, amp, i);
        const oy = (1 - e) * (top ? -1 : 1) * (ph + 40) + drift(t, 9.5 + i * 1.3, amp, i * 2);
        return (
          <div key={i} style={{position: 'absolute', left: at.x + ox, top: at.y + oy, width: pw, height: ph, transform: `rotate(${(p.rot ?? 0) + drift(t, 11 + i, 1.2, i)}deg)`}}>
            {p.draw(pw, ph, t)}
          </div>
        );
      })}
      {look !== 'ink' ? <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 58%, ${rgba(blend(pal.bg2, '#3A2410', 0.5), 0.16)} 100%)`}} /> : null}
    </div>
  );
};
