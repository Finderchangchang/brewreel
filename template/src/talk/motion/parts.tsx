// 动效画面的公共小件：按风格画的卡片、马克笔、手绘勾叉、打勾徽章、积木点数（表示第几步，不写数字）、彩纸、纹理贴图、弹簧、字号估算。
// 只画形状，不画字：屏幕上的字只来自模板槽位（原话）。
import React from 'react';
import {Easing, interpolate, spring} from 'remotion';
import {badgeOf, blend, rgba, shapeColors, type MotionPalette} from './palette';

export const FPS = 30;
const clampX = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 弹簧 0→1（t0 之前 0）。damping 小 = 更弹 */
export const springAt = (t: number, t0: number, damping = 13, stiffness = 180) =>
  t < t0 ? 0 : spring({frame: Math.round((t - t0) * FPS), fps: FPS, config: {damping, stiffness}});
/** 0→1 缓动 */
export const prog = (t: number, t0: number, dur: number, easing: (x: number) => number = Easing.out(Easing.cubic)) =>
  interpolate(t, [t0, t0 + Math.max(0.001, dur)], [0, 1], {...clampX, easing});
/** 鼓一下：0→1→0 */
export const bump = (t: number, t0: number, dur = 0.45) => {
  const d = t - t0;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};
/** 慢慢漂：周期 period 秒，振幅 amp */
export const drift = (t: number, period: number, amp: number, phase = 0) => Math.sin((t / period) * Math.PI * 2 + phase) * amp;

/**
 * 条目入场：从下方 60 参考像素（720 宽时 40 像素）滑上来、淡入，0.22 秒走完，同时回弹一下（0.96 → 1.04 → 1）。
 * 没到时间时 on = false：版位隐形预留，不画任何骨架。
 */
export const riseIn = (t: number, at: number): {on: boolean; opacity: number; y: number; scale: number} => {
  const d = t - at;
  if (d < 0) return {on: false, opacity: 0, y: 60, scale: 0.96};
  const p = prog(t, at, 0.22, Easing.out(Easing.cubic));
  const scale = interpolate(d, [0, 0.14, 0.3], [0.96, 1.04, 1], {...clampX, easing: Easing.inOut(Easing.quad)});
  return {on: true, opacity: Math.min(1, 0.4 + d / 0.06), y: (1 - p) * 60, scale};
};

export {CARD_BLEED, fitFont, isTall, listGeom, textEm, type ListGeom} from './measure';

// ---------------- 纹理贴图 ----------------
const tileCache = new Map<string, string>();
/**
 * SVG 噪声贴图（data URI，可平铺，浏览器当图片缓存，每帧不重算）。
 * alpha = gain × 噪声 − gain × cut：cut 越大越稀疏（只剩峰值的斑点），gain 越大越浓。
 * invert：alpha = gain × (cut − 噪声)，只留噪声最低的地方。配 turbulence 用，得到细细的线（木纹、纸纤维、指纹）。
 */
export const noiseTile = (o: {freq: string; octaves?: number; color: string; gain: number; cut: number; seed?: number; size?: number; type?: 'fractalNoise' | 'turbulence'; invert?: boolean}): string => {
  const key = JSON.stringify(o);
  const hit = tileCache.get(key);
  if (hit) return hit;
  const n = parseInt(o.color.slice(1), 16);
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(3));
  const size = o.size ?? 256;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
    `<filter id='n' x='0' y='0' width='100%' height='100%' filterUnits='userSpaceOnUse' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='${o.type ?? 'fractalNoise'}' baseFrequency='${o.freq}' numOctaves='${o.octaves ?? 2}' seed='${o.seed ?? 1}' stitchTiles='stitch'/>` +
    `<feColorMatrix type='matrix' values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${o.invert ? -o.gain : o.gain} 0 0 0 ${((o.invert ? 1 : -1) * o.gain * o.cut).toFixed(4)}'/>` +
    `</filter><rect width='${size}' height='${size}' filter='url(#n)'/></svg>`;
  const url = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  tileCache.set(key, url);
  return url;
};

/** 黏土表面的毛孔：很淡的细点（卡片、黏土团上铺一层） */
export const clayPores = (pal: MotionPalette) => noiseTile({freq: '0.5', octaves: 1, color: blend(pal.edge, '#7A3B33', 0.5), gain: 1.2, cut: 0.68, seed: 5, size: 220, type: 'turbulence'});
/** 纸面的纤维和细颗粒（paper 的卡片铺一层，很淡） */
export const paperTooth = (pal: MotionPalette) =>
  `${noiseTile({freq: '0.025 0.06', octaves: 2, color: blend(pal.edge, '#5A4A30', 0.5), gain: 0.9, cut: 0.05, seed: 12, size: 256, type: 'turbulence', invert: true})}, ${noiseTile({freq: '0.9', octaves: 1, color: blend(pal.edge, '#5A4A30', 0.5), gain: 0.35, cut: 0.5, seed: 13, size: 200})}`;
/** 黏土表面的指纹：一圈圈很淡的细线（背景铺一层） */
export const clayPrints = (pal: MotionPalette) => noiseTile({freq: '0.03', octaves: 1, color: blend(pal.edge, '#7A3B33', 0.4), gain: 2.0, cut: 0.04, seed: 9, size: 256, type: 'turbulence', invert: true});

export type CardTone = 'normal' | 'hot' | 'dim';

/**
 * 卡片：按 look 换质感。
 * wood：米白木牌 + 底下一层木头厚度；clay：圆润、细毛孔、顶上 2 像素内高光、底边一道同色加深（压扁的黏土）；
 * paper：纸面细纤维，后面错开一张彩纸（错开 8 像素@720）；ink：墨线描边 + 硬投影。
 * face / border：调用方指定卡面颜色和描边（compare 的旧卡片用）。
 */
export const Card: React.FC<{
  pal: MotionPalette;
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: CardTone;
  /** 第几张（彩纸、侧边颜色轮换用） */
  index?: number;
  radius?: number;
  face?: string;
  border?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({pal, x, y, w, h, tone = 'normal', index = 0, radius, face: faceOver, border, style, children}) => {
  const look = pal.look;
  const colors = shapeColors(pal);
  const sheet = look === 'ink' ? pal.ink : colors[index % colors.length];
  const r = radius ?? (look === 'clay' ? Math.min(46, h * 0.3) : look === 'paper' ? Math.min(12, h * 0.08) : look === 'ink' ? Math.min(16, h * 0.1) : Math.min(30, h * 0.2));
  const depth = Math.round(Math.max(7, Math.min(12, h * 0.05)));
  const base: React.CSSProperties = {position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', borderRadius: r, ...style};
  const face = faceOver ?? (tone === 'dim' ? blend(pal.card, pal.bg2, 0.45) : pal.card);
  const edge = tone === 'hot' ? blend(pal.accent, '#000000', look === 'ink' ? 0 : 0.12) : tone === 'dim' ? blend(pal.edge, pal.bg2, 0.4) : pal.edge;
  const hotBorder = tone === 'hot' ? `6px solid ${pal.accent}` : border ? `3px solid ${border}` : 'none';
  if (look === 'wood') {
    return (
      <div style={{...base, background: face, boxShadow: `inset 0 3px 0 rgba(255,255,255,0.75), 0 ${depth}px 0 ${edge}, 0 ${depth + 14}px 30px ${rgba('#4A3218', 0.17)}`, border: hotBorder}}>
        {children}
      </div>
    );
  }
  if (look === 'clay') {
    return (
      <div
        style={{
          ...base,
          background: `${clayPores(pal)}, ${face}`,
          backgroundSize: '220px 220px, auto',
          boxShadow: `inset 0 3px 0 rgba(255,255,255,0.85), inset 0 -6px 0 ${blend(face, '#8C4A40', 0.14)}, inset -6px 0 10px ${rgba('#7A3B33', 0.05)}, 0 ${depth}px 0 ${edge}, 0 ${depth + 12}px 26px ${rgba('#8C4A40', 0.2)}`,
          border: tone === 'hot' ? `6px solid ${pal.accent}` : border ? `3px solid ${border}` : 'none',
        }}
      >
        {children}
      </div>
    );
  }
  if (look === 'paper') {
    const off = Math.min(12, Math.round(depth * 0.95));
    return (
      <>
        <div style={{...base, border: 'none', background: tone === 'hot' ? pal.accent : sheet, transform: `translate(${off}px, ${off}px) rotate(${index % 2 ? 0.9 : -0.8}deg)`, boxShadow: `0 3px 8px ${rgba('#3A3020', 0.16)}`, opacity: tone === 'dim' ? 0.55 : 1}} />
        <div style={{...base, background: `${paperTooth(pal)}, ${face}`, backgroundSize: '256px 256px, 200px 200px, auto', border: border ? `3px solid ${border}` : 'none', boxShadow: `0 2px 0 ${rgba('#3A3020', 0.06)}, 0 10px 22px ${rgba('#3A3020', 0.14)}`}}>{children}</div>
      </>
    );
  }
  // ink：白底、黑线、黑色硬投影；当前这一张投影换成荧光黄
  return (
    <div
      style={{
        ...base,
        background: face,
        border: `4px solid ${border ?? (tone === 'dim' ? rgba(pal.ink, 0.55) : pal.ink)}`,
        boxShadow: `${depth - 2}px ${depth - 2}px 0 ${tone === 'hot' ? pal.accent : tone === 'dim' ? rgba(pal.ink, 0.3) : pal.ink}`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * 马克笔：一道粗笔触，从左往右扫出来（p 0→1）。放在字后面（父元素要 position: relative）。
 * 默认压在字的下半截（高 0.45em），略微倾斜，两头斜切、边缘略毛。
 */
export const MarkerSwipe: React.FC<{p: number; color: string; top?: string; height?: string; opacity?: number; tilt?: number}> = ({p, color, top = '52%', height = '45%', opacity = 0.85, tilt = -2}) => {
  if (p <= 0) return null;
  return (
    <span style={{position: 'absolute', left: '-0.1em', right: '-0.1em', top, height, zIndex: -1, clipPath: `inset(-30% ${(1 - Math.min(1, p)) * 100}% -30% 0)`, opacity, transform: `rotate(${tilt}deg)`}}>
      <svg width="100%" height="100%" viewBox="0 0 400 60" preserveAspectRatio="none" style={{display: 'block', overflow: 'visible'}}>
        <path d="M10 6 C80 2 160 7 240 3 C300 1 360 5 394 4 L388 56 C320 58 250 54 170 57 C100 59 50 55 2 58 Z" fill={color} />
      </svg>
    </span>
  );
};

/** 手绘勾：画出来（p 0→1） */
export const Check: React.FC<{p: number; size: number; color: string; stroke?: number}> = ({p, size, color, stroke = 10}) => (
  <svg width={size} height={size} viewBox="0 0 60 60" style={{display: 'block', overflow: 'visible'}}>
    <path d="M10 31 C13 33 17 37 21 42 C23 44 24 46 25 48 C32 33 41 21 52 10" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, Math.min(1, p))} />
  </svg>
);

/** 手绘叉：两笔先后画 */
export const Cross: React.FC<{p: number; size: number; color: string; stroke?: number}> = ({p, size, color, stroke = 9}) => (
  <svg width={size} height={size} viewBox="0 0 60 60" style={{display: 'block', overflow: 'visible'}}>
    <g stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none">
      <path d="M14 13 C24 24 34 36 47 48" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, Math.max(0, p * 2))} />
      <path d="M46 12 C36 24 26 36 13 48" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, Math.max(0, p * 2 - 1))} />
    </g>
  </svg>
);

/**
 * 打勾徽章：在 at 时刻弹出来（0.2 秒，弹到 1.08 再回 1），勾随后画出来。颜色按风格（palette.ts 的 badgeOf）。
 * 放在一个 size×size 的格子里（父元素定位）。
 */
export const DoneBadge: React.FC<{pal: MotionPalette; t: number; at: number; size: number}> = ({pal, t, at, size}) => {
  if (t < at) return null;
  const b = badgeOf(pal);
  const d = t - at;
  const sc = interpolate(d, [0, 0.13, 0.2], [0.3, 1.08, 1], {...clampX, easing: Easing.out(Easing.quad)});
  const draw = prog(t, at + 0.1, 0.2, Easing.out(Easing.quad));
  const bw = Math.max(3, size * b.borderK);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: b.bg,
        border: `${bw}px solid ${b.border}`,
        boxSizing: 'border-box',
        boxShadow: pal.look === 'ink' ? `${size * 0.05}px ${size * 0.05}px 0 ${pal.ink}` : `0 ${size * 0.06}px ${size * 0.14}px ${rgba('#000000', 0.2)}`,
        transform: `scale(${sc})`,
        opacity: Math.min(1, d / 0.06),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Check p={draw} size={size * 0.56} color={b.fg} stroke={11} />
    </div>
  );
};

/** 积木上的点数（像骰子）：表示第几步，不写数字。n = 1..4 */
export const Pips: React.FC<{n: number; size: number; color: string}> = ({n, size, color}) => {
  const pos: Record<number, [number, number][]> = {
    1: [[0.5, 0.5]],
    2: [[0.3, 0.3], [0.7, 0.7]],
    3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
    4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  };
  const d = size * (n >= 3 ? 0.17 : 0.2);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {(pos[Math.max(1, Math.min(4, n))] ?? []).map(([px, py], i) => (
        <div key={i} style={{position: 'absolute', left: px * size - d / 2, top: py * size - d / 2, width: d, height: d, borderRadius: '50%', background: color}} />
      ))}
    </div>
  );
};

/**
 * 落定时从卡片后面往外飞的一小把彩纸：起点在卡片上沿和两侧上半截的边上，往外飞 40–100 参考像素后消失。
 * 画在卡片前面的 DOM 之前（被卡片挡住的那一截看不见），只往上、往两边飞，不往下（下面是字幕）。
 * 寿命不超过 0.8 秒，并且在整段结束前 0.5 秒清完；来不及（剩不到 0.3 秒）就不飞。
 */
export const Confetti: React.FC<{t: number; at: number; dur: number; rect: {x: number; y: number; w: number; h: number}; pal: MotionPalette; count?: number}> = ({t, at, dur, rect, pal, count = 12}) => {
  const life = Math.min(0.8, dur - 0.5 - at);
  if (life < 0.3 || t < at || t > at + life) return null;
  const colors = pal.look === 'ink' ? [pal.accent, pal.ink] : [pal.accent, pal.cool, pal.warm];
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const k = i / count;
        // 一半在上沿，一半在两侧上半截
        let sx: number;
        let sy: number;
        let nx: number;
        let ny: number;
        if (i % 2 === 0) {
          sx = rect.x + rect.w * (0.08 + 0.84 * ((k * 1.7) % 1));
          sy = rect.y;
          nx = (sx - (rect.x + rect.w / 2)) / (rect.w / 2) * 0.5;
          ny = -1;
        } else {
          const left = i % 4 === 1;
          sx = left ? rect.x : rect.x + rect.w;
          sy = rect.y + rect.h * (0.05 + 0.4 * ((k * 2.3) % 1));
          nx = left ? -1 : 1;
          ny = -0.45;
        }
        const len = Math.hypot(nx, ny) || 1;
        const p = prog(t, at, life, Easing.out(Easing.cubic));
        const dist = (40 + 60 * ((i * 37) % 10) / 10) * p;
        const s = 12 + (i % 3) * 4;
        const op = interpolate(t, [at, at + 0.06, at + life * 0.6, at + life], [0, 1, 1, 0], clampX);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: sx + (nx / len) * dist - s / 2,
              top: sy + (ny / len) * dist - s / 2,
              width: s,
              height: i % 3 === 1 ? s * 0.6 : s,
              borderRadius: i % 2 ? '50%' : s * 0.2,
              background: colors[i % colors.length],
              opacity: op,
              transform: `rotate(${p * 160 * (i % 2 ? 1 : -1)}deg)`,
            }}
          />
        );
      })}
    </>
  );
};

/** 标签胶囊（compare 的栏标题、checklist 的小标题）：字由调用方给（都来自槽位或脚本按 labels 给的固定词） */
export const Pill: React.FC<{text: string; size: number; bg: string; color: string; pal: MotionPalette; style?: React.CSSProperties}> = ({text, size, bg, color, pal, style}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: size * 0.35,
      height: size * 1.7,
      padding: `0 ${size * 0.6}px`,
      borderRadius: pal.look === 'paper' || pal.look === 'ink' ? size * 0.3 : size * 0.85,
      background: bg,
      color,
      fontSize: size,
      fontWeight: 900,
      whiteSpace: 'nowrap',
      boxSizing: 'border-box',
      border: pal.look === 'ink' ? `3px solid ${pal.ink}` : 'none',
      boxShadow: pal.look === 'ink' ? `4px 4px 0 ${pal.ink}` : pal.look === 'paper' ? `0 4px 10px ${rgba('#3A3020', 0.16)}` : `0 ${Math.round(size * 0.12)}px 0 ${blend(bg, '#000000', 0.18)}`,
      ...style,
    }}
  >
    <span style={{display: 'inline-block', width: size * 0.36, height: size * 0.36, borderRadius: pal.look === 'wood' ? size * 0.08 : '50%', background: color, opacity: 0.85, flex: 'none'}} />
    {text}
  </div>
);
