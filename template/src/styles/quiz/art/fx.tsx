import React from 'react';
import type {ArtPalette} from './colors';
import {SW} from './rig';

// ============================================================
// quiz / art 头顶特效（挂在角色头顶，也可以单独放）。t = 特效开始后的秒数，t<0 不画。
//   hearts   冒心：3 颗主色 / 亮色心往上飘 0.9 秒后淡出（开心、被说服）
//   surprise 惊讶：头边三道放射短线 + 弹一下（0.25 秒弹出，常驻）
//   think    思考：三个由小到大的圆点气泡依次冒出，循环
//   sweat    尴尬：一滴汗从额角滑下
//   sparkle  开窍：四角星闪两下
//   question 疑问：一个问号弹出后左右晃
// ============================================================

export const FX_KINDS = ['hearts', 'surprise', 'think', 'sweat', 'sparkle', 'question'] as const;
export type FxKind = (typeof FX_KINDS)[number];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const backOut = (p: number, s = 1.9) => {
  const q = clamp01(p) - 1;
  return q * q * ((s + 1) * q + s) + 1;
};

export const Heart: React.FC<{x: number; y: number; s: number; fill: string; line: string}> = ({x, y, s, fill, line}) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0,10 C-14,0 -18,-10 -10,-16 C-5,-19 -1,-16 0,-12 C1,-16 5,-19 10,-16 C18,-10 14,0 0,10 Z"
    fill={fill}
    stroke={line}
    strokeWidth={3.2 / Math.max(0.3, s)}
    strokeLinejoin="round"
  />
);

export const Sparkle: React.FC<{x: number; y: number; s: number; fill: string; line: string}> = ({x, y, s, fill, line}) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0,-16 Q2,-2 16,0 Q2,2 0,16 Q-2,2 -16,0 Q-2,-2 0,-16 Z"
    fill={fill}
    stroke={line}
    strokeWidth={3 / Math.max(0.3, s)}
    strokeLinejoin="round"
  />
);

export const Fx: React.FC<{kind: FxKind; t: number; x: number; y: number; pal: ArtPalette}> = ({kind, t, x, y, pal}) => {
  if (t < 0) return null;
  const L = pal.line;
  switch (kind) {
    case 'hearts': {
      const items = [
        {dx: 58, d: 0, s: 1.5, c: pal.primary},
        {dx: 92, d: 0.12, s: 1.1, c: pal.highlight},
        {dx: 34, d: 0.24, s: 0.9, c: pal.primarySoft},
      ];
      return (
        <g>
          {items.map((h, i) => {
            const p = clamp01((t - h.d) / 0.9);
            if (t < h.d || p >= 1) return null;
            const rise = 120 * (1 - Math.pow(1 - p, 2));
            const sc = h.s * backOut(Math.min(1, p * 4));
            return (
              <g key={i} opacity={p > 0.7 ? (1 - p) / 0.3 : 1}>
                <Heart x={x + h.dx + Math.sin(p * 6 + i) * 6} y={y + 90 - rise} s={sc} fill={h.c} line={L} />
              </g>
            );
          })}
        </g>
      );
    }
    case 'surprise': {
      const p = backOut(t / 0.25);
      const lines = [
        [-40, 30],
        [-10, 20],
        [20, 30],
      ];
      return (
        <g transform={`translate(${x + 70} ${y + 70}) scale(${p})`}>
          {lines.map(([a, len], i) => {
            const r = ((a - 90) * Math.PI) / 180;
            return (
              <line key={i} x1={Math.cos(r) * 18} y1={Math.sin(r) * 18} x2={Math.cos(r) * (18 + len)} y2={Math.sin(r) * (18 + len)} stroke={L} strokeWidth={SW} strokeLinecap="round" />
            );
          })}
        </g>
      );
    }
    case 'think': {
      const cyc = t % 1.6;
      const dots = [
        {dx: 66, dy: 30, r: 7, at: 0},
        {dx: 86, dy: 4, r: 11, at: 0.25},
        {dx: 116, dy: -32, r: 17, at: 0.5},
      ];
      return (
        <g>
          {dots.map((d, i) => {
            const sc = backOut((cyc - d.at) / 0.2);
            if (cyc < d.at) return null;
            return <circle key={i} cx={x + d.dx} cy={y + 60 + d.dy} r={d.r * sc} fill={pal.card} stroke={L} strokeWidth={4} />;
          })}
        </g>
      );
    }
    case 'sweat': {
      const p = clamp01(t / 0.8);
      const yy = y + 90 + 26 * p;
      return (
        <path
          transform={`translate(${x + 80} ${yy}) scale(${backOut(t / 0.2)})`}
          d="M0,-16 C6,-6 11,0 11,6 C11,13 6,17 0,17 C-6,17 -11,13 -11,6 C-11,0 -6,-6 0,-16 Z"
          fill={pal.sky}
          stroke={L}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      );
    }
    case 'sparkle': {
      const a = 0.6 + 0.4 * Math.abs(Math.sin(t * 7));
      return (
        <g>
          <Sparkle x={x + 84} y={y + 40} s={1.2 * backOut(t / 0.2) * a} fill={pal.highlight} line={L} />
          <Sparkle x={x - 50} y={y + 70} s={0.7 * backOut((t - 0.12) / 0.2) * (1.6 - a)} fill={pal.highlight} line={L} />
        </g>
      );
    }
    case 'question': {
      const sc = backOut(t / 0.25);
      const rot = Math.sin(t * 5) * 10;
      return (
        <g transform={`translate(${x + 88} ${y + 40}) rotate(${rot}) scale(${sc})`}>
          <path d="M-12,-10 C-12,-26 12,-28 14,-12 C16,0 0,2 0,14" fill="none" stroke={L} strokeWidth={SW * 2 + 5} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M-12,-10 C-12,-26 12,-28 14,-12 C16,0 0,2 0,14" fill="none" stroke={pal.primary} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={0} cy={30} r={7} fill={pal.primary} stroke={L} strokeWidth={SW} />
        </g>
      );
    }
    default:
      return null;
  }
};
