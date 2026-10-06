// 任意底色上的一层纸纹。高通是「噪声减去它自己的模糊」，不作用在纸片上，所以剪边保持硬。
// σ 和颗粒尺度的默认值在 paperGrain.ts，落在原理给的区间。
import React from 'react';
import {grainSettings} from './paperGrain.ts';

export type PaperGrainProps = {
  w: number;
  h: number;
  /** 同一段、同一外观用同一个种子，重跑不换颗粒 */
  seed?: number;
  sigma?: number;
  scale?: number;
  /** 盖上去的浓度。默认很低，不抢字 */
  opacity?: number;
};

export const PaperGrain: React.FC<PaperGrainProps> = ({w, h, seed = 1, sigma, scale, opacity = 0.28}) => {
  const g = grainSettings({sigma, scale});
  const id = `pg-${(seed >>> 0) % 9973}-${Math.round(w)}-${Math.round(h)}`;
  // userSpaceOnUse 下，baseFrequency 是每坐标单位的周期。0.7 / scale 把 2–4 px 的颗粒变成看得见的纸纹，而不是亚像素噪点。
  const freq = (0.7 / g.scale).toFixed(4);
  return (
    <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}} aria-hidden>
      <filter id={id} x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
        <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={2} seed={(seed >>> 0) % 8191} result="n" />
        <feGaussianBlur in="n" stdDeviation={g.sigma} result="b" />
        <feComposite in="n" in2="b" operator="arithmetic" k1="0" k2="2.6" k3="-2.6" k4="0.5" result="hp" />
        <feColorMatrix in="hp" type="saturate" values="0" result="g" />
        <feComponentTransfer in="g" result="c">
          <feFuncR type="linear" slope="2.2" intercept="-0.6" />
          <feFuncG type="linear" slope="2.2" intercept="-0.6" />
          <feFuncB type="linear" slope="2.2" intercept="-0.6" />
        </feComponentTransfer>
      </filter>
      <rect width={w} height={h} filter={`url(#${id})`} opacity={opacity} />
    </svg>
  );
};
