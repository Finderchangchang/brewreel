import React from 'react';
import type {Geometry} from '../../../core/safe';
import type {Phase, Plan, Tokens} from './plan';

// ============================================================
// 整片共用的「世界」上下文和颜色小工具。城市本身（天空、远景、中景、近景街区、街面）由美术的 art/World.tsx 画，
// film.tsx 按 plan 的相机和天色驱动它；这里只留道具和 UI 要用的：World 类型、mixHex、按天色阶段调色的 tint、齿轮。
// ============================================================
export type World = {
  plan: Plan;
  tk: Tokens;
  pal: Record<string, string>;
  geo: Geometry;
  lay: Record<string, any>;
  t: number;
  mascotX: number;
  lang: 'zh' | 'en';
};

const hex = (h: string) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
export const mixHex = (a: string, b: string, p: number) => {
  const A = hex(a);
  const B = hex(b);
  const q = Math.max(0, Math.min(1, p));
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * q).toString(16).padStart(2, '0')).join('')}`;
};
const PHASE_TINT: Record<Phase, [string, number]> = {day: ['#FFFFFF', 0], warm: ['#F6C9A8', 0.14], dusk: ['#826178', 0.3], night: ['#221A3E', 0.66]};
/** 楼的颜色按天色阶段调：黄昏偏紫、夜里压暗 */
export const tint = (c: string, ph: Phase) => (PHASE_TINT[ph][1] ? mixHex(c, PHASE_TINT[ph][0], PHASE_TINT[ph][1]) : c);


export const Gear: React.FC<{cx: number; cy: number; r: number; rot: number; fill: string; ink: string}> = ({cx, cy, r, rot, fill, ink}) => {
  const teeth = 8;
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i * Math.PI) / teeth;
    const rr = i % 2 ? r * 0.78 : r;
    pts.push(`${(Math.cos(a0 - 0.12) * rr).toFixed(1)} ${(Math.sin(a0 - 0.12) * rr).toFixed(1)}`, `${(Math.cos(a0 + 0.12) * rr).toFixed(1)} ${(Math.sin(a0 + 0.12) * rr).toFixed(1)}`);
  }
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <path d={`M${pts.join(' L')} Z`} fill={fill} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      <circle r={r * 0.3} fill="#fff" stroke={ink} strokeWidth={3} />
    </g>
  );
};
