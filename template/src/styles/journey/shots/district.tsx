import React from 'react';
import {interpolateColors} from 'remotion';
import {useGeometry} from '../../../core/aspect';
import {float} from '../../../core/anim';
import {fitSize} from '../../../core/fit';
import type {ShotProps} from '../../../core/types';
import {useStylePalette, useStyleTokens} from '../../context';

// ============================================================
// journey / district（骨架占位镜头，风格负责人会换成一镜到底的 Film）
// 三层视差：远景天际线不动、中景楼群 0.72 倍、前景街面 1.0 倍；角色固定在画面左侧 35%，上下漂浮。
// 所有尺寸按 useGeometry() 取，4:5 和 9:16 都能出。
// ============================================================
type P = {category: string; title: string; tone?: number};

const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const District: React.FC<ShotProps<P>> = ({params, t, index}) => {
  const geo = useGeometry();
  const tk = useStyleTokens();
  const pal = useStylePalette();
  const colors: string[] = tk.districtColors ?? ['#3E435D'];
  const main = colors[(params.tone ?? index) % colors.length];
  const lay = geo.h > 1500 ? tk.layout916 : tk.layout45;
  const horizon: number = lay?.horizonY ?? Math.round(geo.h * 0.77);
  const speed: number = tk.camera?.cruisePxPerSec ?? 553;
  const near = t * speed;
  const mid = near * (tk.camera?.parallax?.mid ?? 0.72);
  const outline = tk.outline?.color ?? pal.ink;
  // 天色：按本镜序号粗略地从白天走向黄昏（整片的天色走向由 Film 负责）
  const sky = interpolateColors(Math.min(1, index / 5), [0, 0.6, 1], [pal.skyDay, pal.skyDusk, pal.skyNight]);
  const mascotX = geo.w * (tk.camera?.mascotX ?? 0.35);
  const mascotY = horizon - 260 + float(t, 0, tk.camera?.floatAmp ?? 16, tk.camera?.floatPeriod ?? 2);
  const [bb0, bb1] = (lay?.billboardBandY ?? [180, 420]) as [number, number];
  const bbW = geo.card.x1 - geo.card.x0;
  const titleSize = fitSize(params.title, bbW - 80, tk.type?.billboard ?? 56, 40, 0);
  // 路牌从右侧进场，在第 0 拍附近经过角色
  const signX = geo.w * 0.9 - near * 0.6;
  return (
    <div style={{position: 'absolute', inset: 0, background: sky, overflow: 'hidden'}}>
      {/* 远景天际线（不动） */}
      {Array.from({length: 9}, (_, i) => {
        const w = 90 + hash(i) * 70;
        const h = 120 + hash(i + 9) * 200;
        return <div key={`f${i}`} style={{position: 'absolute', left: i * 125 - 20, top: horizon - 140 - h, width: w, height: h + 140, background: interpolateColors(0.35, [0, 1], [sky, main]), borderRadius: 6}} />;
      })}
      {/* 中景楼群（0.72 倍） */}
      {Array.from({length: 8}, (_, i) => {
        const w = 150 + hash(i + 3) * 90;
        const h = 220 + hash(i + 5) * 260;
        const x = ((i * 260 - mid) % 2080 + 2080) % 2080 - 300;
        return (
          <div key={`m${i}`} style={{position: 'absolute', left: x, top: horizon - h, width: w, height: h, background: main, borderRadius: '10px 10px 0 0'}}>
            {Array.from({length: 6}, (_, k) => (
              <div key={k} style={{position: 'absolute', left: 22 + (k % 2) * (w / 2 - 10), top: 30 + Math.floor(k / 2) * 70, width: w / 2 - 44, height: 38, background: pal.windowLight, opacity: 0.85, borderRadius: 4}} />
            ))}
          </div>
        );
      })}
      {/* 前景街面（1.0 倍） */}
      <div style={{position: 'absolute', left: 0, top: horizon, width: geo.w, height: geo.h - horizon, background: pal.ground, borderTop: `${tk.outline?.foreground ?? 3}px solid ${outline}`}} />
      {Array.from({length: 8}, (_, i) => (
        <div key={`r${i}`} style={{position: 'absolute', left: ((i * 180 - near) % 1440 + 1440) % 1440 - 180, top: horizon + 60, width: 90, height: 14, background: pal.road, borderRadius: 7}} />
      ))}
      {/* 路牌：类别名 */}
      <div style={{position: 'absolute', left: signX, top: horizon - 170, padding: '10px 26px', background: pal.card, border: `${tk.outline?.foreground ?? 3}px solid ${outline}`, borderRadius: 14, fontSize: tk.type?.sign ?? 56, fontWeight: 900, color: main, whiteSpace: 'nowrap'}}>
        {params.category}
      </div>
      {/* 广告牌：代表内容 */}
      <div style={{position: 'absolute', left: geo.card.x0, top: bb0, width: bbW, height: bb1 - bb0, background: pal.card, border: `4px solid ${outline}`, borderRadius: 24, boxShadow: `0 10px 0 ${outline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 40px', boxSizing: 'border-box'}}>
        <div style={{fontSize: titleSize, fontWeight: 800, color: pal.ink, lineHeight: 1.3, textAlign: 'center'}}>{params.title}</div>
      </div>
      {/* 占位角色：圆角身体 + 眼睛（风格负责人换成自己画的吉祥物与载具） */}
      <div style={{position: 'absolute', left: mascotX - 90, top: mascotY, width: 180, height: 150, background: pal.brand, border: `${tk.outline?.character ?? 4}px solid ${outline}`, borderRadius: '60px 60px 40px 40px'}}>
        <div style={{position: 'absolute', left: 48, top: 44, width: 22, height: 30, borderRadius: 11, background: outline}} />
        <div style={{position: 'absolute', left: 108, top: 44, width: 22, height: 30, borderRadius: 11, background: outline}} />
      </div>
      <div style={{position: 'absolute', left: mascotX - 150, top: mascotY + 150, width: 300, height: 40, background: pal.card, border: `4px solid ${outline}`, borderRadius: 20}} />
    </div>
  );
};
export default District;
