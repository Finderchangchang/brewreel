import React from 'react';
import {FONT} from '../../../core/font';
import {INK, lit, mixHex, nightOf} from './palette';

// ============================================================
// journey / art 的带字招牌（HTML 层，字能自动换行、按字号底线排版）。都用屏幕像素定位。
//   WaySign    路牌：指向右边的箭头牌（街区名），立柱到地面；可带一块小副牌（第几站）
// 字号默认值都不低于底线（正文 40 / 面板 34 / 最小 26）。
// ============================================================

type Base = {p?: number; t?: number; color: string; style?: React.CSSProperties};

export const WaySign: React.FC<
  Base & {
    /** 立柱中心 x、地面 y（屏幕像素） */
    x: number;
    groundY: number;
    label: string;
    /** 箭头牌中心离地高度 */
    height?: number;
    size?: number;
    /** 副牌小字（如 "2 / 6"） */
    badge?: string;
  }
> = ({x, groundY, label, color, p = 0, height = 170, size = 52, badge, style}) => {
  const n = nightOf(p);
  const panelH = size * 1.7;
  const panelW = Math.max(220, label.length * size * 1.05 + 120);
  const top = groundY - height - panelH / 2;
  const fill = lit(color, p);
  return (
    <div style={{position: 'absolute', left: x - 30, top, width: panelW + 60, height: groundY - top, ...style}}>
      <div style={{position: 'absolute', left: 30 - 12, top: panelH / 2, width: 24, height: groundY - top - panelH / 2, background: lit('#3E5561', p), border: `4px solid ${INK}`, borderRadius: 8, boxSizing: 'border-box'}} />
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={panelW + 60} height={panelH}>
        <path d={`M 12,6 L ${panelW},6 L ${panelW + 44},${panelH / 2} L ${panelW},${panelH - 6} L 12,${panelH - 6} Q 4,${panelH - 6} 4,${panelH - 14} L 4,14 Q 4,6 12,6 Z`} fill={fill} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <path d={`M 18,16 L ${panelW - 6},16`} stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.35} />
        {n > 0.3 && <path d={`M 12,6 L ${panelW},6 L ${panelW + 44},${panelH / 2} L ${panelW},${panelH - 6} L 12,${panelH - 6} Z`} fill="none" stroke={mixHex(color, '#FFFFFF', 0.4)} strokeWidth={16} opacity={0.3 * n} />}
      </svg>
      <div style={{position: 'absolute', left: 30, top: 0, height: panelH, width: panelW - 40, display: 'flex', alignItems: 'center', fontFamily: FONT, fontSize: size, fontWeight: 900, color: '#FFFFFF', whiteSpace: 'nowrap', textShadow: `0 3px 0 ${mixHex(color, INK, 0.5)}`}}>{label}</div>
      {badge && (
        <div style={{position: 'absolute', left: 60, top: panelH + 8, padding: '2px 16px', background: '#FFFFFF', border: `4px solid ${INK}`, borderRadius: 12, fontFamily: FONT, fontSize: 30, fontWeight: 800, color: INK, whiteSpace: 'nowrap'}}>{badge}</div>
      )}
    </div>
  );
};
