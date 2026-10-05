// 动效画面的公共小件：按风格画的卡片、马克笔、手绘勾叉、积木点数（表示第几步，不写数字）、弹簧、字号估算。
// 只画形状，不画字：屏幕上的字只来自模板槽位（原话）。
import React from 'react';
import {Easing, interpolate, spring} from 'remotion';
import {blend, rgba, type MotionPalette} from './palette';

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

const isWide = (ch: string) => {
  const cp = ch.codePointAt(0) ?? 0;
  return (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xf900 && cp <= 0xfaff) || cp === 0x2026 || cp === 0x201c || cp === 0x201d;
};
/** 粗体字宽（em）：汉字 1，拉丁按字形宽窄分档 */
export const textEm = (text: string): number => {
  let w = 0;
  for (const ch of Array.from(text ?? '')) {
    if (isWide(ch)) w += 1;
    else if (ch === ' ') w += 0.28;
    else if (/[iljtfrI'!.,:;|]/.test(ch)) w += 0.34;
    else if (/[mwMW]/.test(ch)) w += 0.92;
    else if (/[A-Z]/.test(ch)) w += 0.72;
    else if (/[0-9]/.test(ch)) w += 0.6;
    else w += 0.6;
  }
  return Math.max(0.5, w);
};
/** 一行放进 maxW 的字号，夹在 [min, max] */
export const fitFont = (text: string, maxW: number, max: number, min: number) => Math.max(min, Math.min(max, Math.floor(maxW / textEm(text))));

export type ListGeom = {x0: number; contentW: number; y0: number; titleH: number; titleGap: number; rowsTop: number; rh: number; gap: number; total: number};

/**
 * 清单、步骤的版面：一行一张卡，卡片用满取景框的宽（横版太宽时收到高的 1.5 倍），行高按条数分满高度、有上限，整块竖直居中。
 * W×H 是取景框（参考像素）；withTitle：checklist 有小标题时留一条胶囊的高度。
 */
export const listGeom = (n: number, W: number, H: number, withTitle: boolean): ListGeom => {
  const contentW = Math.min(W, Math.max(H * 1.5, 860));
  const x0 = (W - contentW) / 2;
  const gap = Math.max(16, Math.min(30, H * 0.032));
  const titleH = withTitle ? Math.max(70, Math.min(120, H * 0.125)) : 0;
  const titleGap = withTitle ? gap * 1.15 : 0;
  const rhMax = Math.max(140, Math.min(260, H * 0.3));
  const rh = Math.max(60, Math.min(rhMax, (H - titleH - titleGap - gap * (n - 1)) / Math.max(1, n)));
  const total = titleH + titleGap + n * rh + (n - 1) * gap;
  const y0 = Math.max(0, (H - total) / 2);
  return {x0, contentW, y0, titleH, titleGap, rowsTop: y0 + titleH + titleGap, rh, gap, total};
};

export type CardTone = 'normal' | 'hot' | 'dim' | 'ghost';

/**
 * 卡片：按 look 换质感。
 * wood：米白木牌 + 底下一层木头厚度；clay：圆润、内高光；paper：后面错开一张彩纸；ink：墨线描边 + 硬投影。
 * ghost：还没说到的位置（虚线框），第 0 帧就看得出有几条。
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
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({pal, x, y, w, h, tone = 'normal', index = 0, radius, style, children}) => {
  const look = pal.look;
  const colors = [pal.cool, pal.accent, pal.warm];
  const sheet = colors[index % colors.length];
  const r = radius ?? (look === 'clay' ? Math.min(46, h * 0.3) : look === 'paper' ? Math.min(12, h * 0.08) : look === 'ink' ? Math.min(16, h * 0.1) : Math.min(30, h * 0.2));
  const depth = Math.round(Math.max(7, Math.min(14, h * 0.055)));
  const base: React.CSSProperties = {position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', borderRadius: r, ...style};
  if (tone === 'ghost') {
    return (
      <div style={{...base, border: `${look === 'ink' ? 3 : 4}px dashed ${rgba(look === 'ink' ? pal.ink : pal.sub, 0.32)}`, background: rgba(pal.card, look === 'ink' ? 0.5 : 0.32)}}>
        {children}
      </div>
    );
  }
  const face = tone === 'dim' ? blend(pal.card, pal.bg2, 0.45) : pal.card;
  const edge = tone === 'hot' ? blend(pal.accent, '#000000', look === 'ink' ? 0 : 0.12) : tone === 'dim' ? blend(pal.edge, pal.bg2, 0.4) : pal.edge;
  if (look === 'wood') {
    return (
      <div style={{...base, background: face, boxShadow: `inset 0 3px 0 rgba(255,255,255,0.75), 0 ${depth}px 0 ${edge}, 0 ${depth + 16}px 34px ${rgba('#4A3218', 0.17)}`, border: tone === 'hot' ? `4px solid ${pal.accent}` : 'none'}}>
        {children}
      </div>
    );
  }
  if (look === 'clay') {
    return (
      <div
        style={{
          ...base,
          background: face,
          boxShadow: `inset -7px -9px 0 ${rgba('#7A3B33', 0.07)}, inset 7px 7px 0 rgba(255,255,255,0.75), 0 ${depth}px 0 ${edge}, 0 ${depth + 14}px 30px ${rgba('#8C4A40', 0.2)}`,
          border: tone === 'hot' ? `5px solid ${pal.accent}` : 'none',
        }}
      >
        {children}
      </div>
    );
  }
  if (look === 'paper') {
    return (
      <>
        <div style={{...base, background: tone === 'hot' ? pal.accent : sheet, transform: `translate(${Math.round(depth * 1.3)}px, ${Math.round(depth * 1.1)}px) rotate(${index % 2 ? 1.4 : -1.2}deg)`, boxShadow: `0 4px 10px ${rgba('#3A3020', 0.16)}`, opacity: tone === 'dim' ? 0.55 : 1}} />
        <div style={{...base, background: face, boxShadow: `0 2px 0 ${rgba('#3A3020', 0.06)}, 0 10px 22px ${rgba('#3A3020', 0.14)}`}}>{children}</div>
      </>
    );
  }
  // ink
  return (
    <>
      <div style={{...base, border: `2px solid ${rgba(pal.ink, 0.45)}`, transform: `translate(${-5 + (index % 2) * 3}px, ${-4}px) rotate(${index % 2 ? 0.7 : -0.6}deg)`}} />
      <div style={{...base, background: face, border: `4px solid ${tone === 'dim' ? rgba(pal.ink, 0.5) : pal.ink}`, boxShadow: `${depth - 2}px ${depth - 2}px 0 ${tone === 'hot' ? pal.accent : tone === 'dim' ? rgba(pal.ink, 0.35) : pal.ink}`}}>{children}</div>
    </>
  );
};

/** 马克笔：两头斜切、边缘略毛的一道粗笔触，从左往右扫出来（p 0→1）。放在字后面（父元素要 position: relative） */
export const MarkerSwipe: React.FC<{p: number; color: string; top?: string; height?: string; opacity?: number}> = ({p, color, top = '52%', height = '46%', opacity = 0.92}) => {
  if (p <= 0) return null;
  return (
    <span style={{position: 'absolute', left: '-0.12em', right: '-0.12em', top, height, zIndex: -1, clipPath: `inset(-20% ${(1 - Math.min(1, p)) * 100}% -20% 0)`, opacity}}>
      <svg width="100%" height="100%" viewBox="0 0 400 60" preserveAspectRatio="none" style={{display: 'block', overflow: 'visible'}}>
        <path d="M10 6 C80 2 160 7 240 3 C300 1 360 5 394 4 L388 56 C320 58 250 54 170 57 C100 59 50 55 2 58 Z" fill={color} />
        <path d="M14 12 C120 9 260 13 384 10" stroke={rgba('#FFFFFF', 0.25)} strokeWidth={4} fill="none" />
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

/** 落定时炸开的一小圈形状（方块、圆点），从 (x, y) 往外散 */
export const Burst: React.FC<{t: number; at: number; x: number; y: number; radius: number; pal: MotionPalette; count?: number}> = ({t, at, x, y, radius, pal, count = 10}) => {
  if (t < at || t > at + 0.9) return null;
  const colors = [pal.accent, pal.cool, pal.warm];
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const a = (i / count) * Math.PI * 2 + 0.3;
        const p = prog(t, at, 0.7, Easing.out(Easing.cubic));
        const r = radius * (0.55 + 0.45 * p) * (i % 2 ? 1 : 0.82);
        const s = Math.max(8, radius * 0.07) * (i % 3 === 0 ? 1.3 : 1);
        const op = interpolate(t, [at, at + 0.08, at + 0.55, at + 0.9], [0, 1, 1, 0], clampX);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.cos(a) * r - s / 2,
              top: y + Math.sin(a) * r - s / 2,
              width: s,
              height: s,
              borderRadius: i % 2 ? '50%' : s * 0.22,
              background: colors[i % 3],
              opacity: op,
              transform: `rotate(${p * 90 * (i % 2 ? 1 : -1)}deg) scale(${0.4 + 0.6 * Math.min(1, p * 2)})`,
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
