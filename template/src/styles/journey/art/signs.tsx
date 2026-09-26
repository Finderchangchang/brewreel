import React from 'react';
import {FONT} from '../../../core/font';
import {INK, clamp01, lit, mixHex, nightOf} from './palette';

// ============================================================
// journey / art 的带字招牌（HTML 层，字能自动换行、按字号底线排版）。都用屏幕像素定位。
//   Billboard  路边广告牌：顶部色带放标签，白底放标题（≤2 行），单根粗立柱 + 两盏仰射灯；夜里灯打亮、边框发光
//   WaySign    路牌：指向右边的箭头牌（街区名），立柱到地面；可带一块小副牌（第几站）
//   NeonSign   霓虹牌：深色底 + 发光描边和发光字，glitch 时横向错位 + 分色
// 字号默认值都不低于底线（正文 40 / 面板 34 / 最小 26）。
// ============================================================

type Base = {p?: number; t?: number; color: string; style?: React.CSSProperties};

export const Billboard: React.FC<
  Base & {
    /** 广告牌左上角（屏幕像素） */
    x: number;
    y: number;
    w: number;
    h: number;
    /** 立柱落地的屏幕 y；不给就只画 120px 柱子 */
    groundY?: number;
    tag?: string;
    title: string;
    sub?: string;
    titleSize?: number;
    tagSize?: number;
    subSize?: number;
  }
> = ({x, y, w, h, groundY, tag, title, sub, color, p = 0, t = 0, titleSize = 50, tagSize = 34, subSize = 28, style}) => {
  const n = nightOf(p);
  const body = mixHex('#FFFFFF', '#FFF6DA', n * 0.5);
  const post = lit(mixHex(color, INK, 0.35), p);
  const band = lit(color, p);
  const bottom = y + h;
  const postH = groundY !== undefined ? Math.max(40, groundY - bottom) : 120;
  const blink = 0.8 + 0.2 * Math.sin(t * 6);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h + postH, ...style}}>
      {/* 立柱 + 横撑 */}
      <div style={{position: 'absolute', left: w / 2 - 22, top: h - 10, width: 44, height: postH + 10, background: post, border: `4px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box'}} />
      <div style={{position: 'absolute', left: w * 0.22, top: h + 14, width: w * 0.56, height: 18, background: post, border: `4px solid ${INK}`, borderRadius: 9, boxSizing: 'border-box'}} />
      {/* 仰射灯的光（夜里） */}
      {n > 0.05 &&
        [0.25, 0.75].map((f) => (
          <div key={f} style={{position: 'absolute', left: w * f - 90, top: -30, width: 180, height: h + 60, background: `linear-gradient(to top, rgba(255,240,170,${0.5 * n * blink}), rgba(255,240,170,0))`, clipPath: 'polygon(40% 100%, 60% 100%, 100% 0, 0 0)'}} />
        ))}
      {/* 牌面 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          background: body,
          border: `5px solid ${INK}`,
          borderRadius: 26,
          boxSizing: 'border-box',
          overflow: 'hidden',
          boxShadow: n > 0.3 ? `0 0 ${30 * n}px ${mixHex(color, '#FFFFFF', 0.3)}` : `0 8px 0 rgba(31,25,26,0.18)`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {tag !== undefined && (
          <div style={{height: tagSize * 1.7, flex: 'none', background: band, borderBottom: `5px solid ${INK}`, display: 'flex', alignItems: 'center', padding: '0 26px', gap: 14}}>
            <div style={{width: tagSize * 0.5, height: tagSize * 0.5, borderRadius: '50%', background: '#FFFFFF', border: `3px solid ${INK}`, flex: 'none'}} />
            <div style={{fontFamily: FONT, fontSize: tagSize, fontWeight: 900, color: '#FFFFFF', whiteSpace: 'nowrap', letterSpacing: 1}}>{tag}</div>
          </div>
        )}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 30px 14px'}}>
          <div style={{fontFamily: FONT, fontSize: titleSize, fontWeight: 800, color: INK, lineHeight: 1.28, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{title}</div>
          {sub && <div style={{fontFamily: FONT, fontSize: subSize, fontWeight: 700, color: '#6B6F80', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{sub}</div>}
        </div>
      </div>
      {/* 两盏仰射灯 */}
      {[0.25, 0.75].map((f) => (
        <div key={`l${f}`} style={{position: 'absolute', left: w * f - 22, top: h - 4, width: 44, height: 26, background: lit('#4A5270', p), border: `4px solid ${INK}`, borderRadius: '8px 8px 14px 14px', boxSizing: 'border-box'}}>
          <div style={{position: 'absolute', left: 6, top: -8, width: 24, height: 10, borderRadius: 5, background: mixHex('#FFF6CC', '#FFE066', n), border: `3px solid ${INK}`, boxSizing: 'border-box'}} />
        </div>
      ))}
    </div>
  );
};

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
      <div style={{position: 'absolute', left: 30 - 12, top: panelH / 2, width: 24, height: groundY - top - panelH / 2, background: lit('#5A6178', p), border: `4px solid ${INK}`, borderRadius: 8, boxSizing: 'border-box'}} />
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

export const NeonSign: React.FC<Base & {x: number; y: number; w: number; h: number; text: string; sub?: string; size?: number; glitch?: number}> = ({x, y, w, h, text, sub, color, p = 1, t = 0, size = 110, glitch = 0, style}) => {
  const n = Math.max(0.35, nightOf(p));
  const g = clamp01(glitch);
  const jitter = g > 0 ? Math.sin(t * 57) * 14 * g : 0;
  const flick = g > 0 && Math.sin(t * 31) > 0.6 ? 0.45 : 1;
  const glow = (c: string, k: number) => `0 0 ${8 * k}px ${c}, 0 0 ${22 * k}px ${c}, 0 0 ${44 * k}px ${c}`;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, background: '#12162E', border: `5px solid ${INK}`, borderRadius: 28, boxSizing: 'border-box', ...style}}>
      <div style={{position: 'absolute', inset: 12, border: `5px solid ${color}`, borderRadius: 18, boxShadow: `${glow(color, n)}, inset ${glow(color, n * 0.6)}`, opacity: flick}} />
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: flick}}>
        <div style={{position: 'relative', fontFamily: FONT, fontSize: size, fontWeight: 900, lineHeight: 1.05, color: mixHex(color, '#FFFFFF', 0.55), textShadow: glow(color, n), transform: `translateX(${jitter}px)`, whiteSpace: 'nowrap'}}>
          {g > 0 && <span style={{position: 'absolute', left: -8 * g, top: 0, color: '#FF3B6B', opacity: 0.6, textShadow: 'none'}}>{text}</span>}
          {g > 0 && <span style={{position: 'absolute', left: 8 * g, top: 0, color: '#3BE8FF', opacity: 0.6, textShadow: 'none'}}>{text}</span>}
          <span style={{position: 'relative'}}>{text}</span>
        </div>
        {sub && <div style={{fontFamily: FONT, fontSize: 36, fontWeight: 800, color: '#FFFFFF', marginTop: 10, textShadow: glow(color, n * 0.5)}}>{sub}</div>}
      </div>
    </div>
  );
};
