// 手剪纸片的视图。形状、倾斜、投影都来自 cutShape.ts，这里只画。
// 投影是硬边色块，不做模糊，所以纸边还是纸边。
import React from 'react';
import {cutGeometry, shadowColor, type CutOpts} from './cutShape.ts';

export type CutShapeProps = {
  seed: string | number;
  w: number;
  h: number;
  fill: string;
  /** 硬边。不传就用填充色，边还在，只是不另描一圈 */
  stroke?: string;
  /** 投影色。不传就由调用方的底色压暗；这里没有底色时用一档深灰 */
  shadow?: string;
  tilt?: number;
  shortSide?: number;
  /** 小纸签缩小投影。锚点不传 */
  shadowK?: number;
  /** 落定过冲的角度不再夹进静止范围 */
  keepTilt?: boolean;
  /** 小纸签：半径起伏收窄，字留在纸面里 */
  chunky?: boolean;
  /** 描边宽度。不传按纸片短边估；剪纸外观传 1–2，用同色压暗，不描黑边 */
  strokeWidth?: number;
  children?: React.ReactNode;
};

export const CutShape: React.FC<CutShapeProps> = ({seed, w, h, fill, stroke, shadow, tilt, shortSide = 1080, shadowK, keepTilt, chunky, strokeWidth, children}) => {
  const opts: CutOpts = {width: w, height: h, tilt, shortSide, shadowK, keepTilt, ...(chunky ? {wobbleMin: 0.9, wobbleSpan: 0.16} : {})};
  const g = cutGeometry(seed, opts);
  const shade = shadow ?? shadowColor('#6E6A62');
  const sw = strokeWidth ?? Math.max(2.5, Math.min(w, h) * 0.014);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, transform: `rotate(${g.tilt}deg)`, transformOrigin: '50% 50%'}}>
      <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <path d={g.d} fill={shade} transform={`translate(${g.shadow.dx} ${g.shadow.dy})`} />
        <path d={g.d} fill={fill} stroke={stroke ?? fill} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: g.inner.x,
          top: g.inner.y,
          width: g.inner.w,
          height: g.inner.h,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};
