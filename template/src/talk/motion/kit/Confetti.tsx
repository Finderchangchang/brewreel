// 纸底上的纸屑。只在调用方确认这是纸底时用。颜色和数量从外观来。
// 交接前按 HANDOFF_LEAD 退场。每片自带一小块投影。方向模糊只加在 scrapPose 算出 blur > 0 的那几帧。
import React from 'react';
import {scraps, scrapPose, type Scrap} from './confetti.ts';

export type ConfettiProps = {
  t: number;
  dur: number;
  w: number;
  h: number;
  seed: string | number;
  colors: string[];
  count?: number;
  shortSide?: number;
  /** 落定后还压住这些框（字幕、圆窗、锚点）就往上推，推不出去就不画 */
  avoid?: {x: number; y: number; width: number; height: number}[];
};

const boxHit = (a: {x: number; y: number; width: number; height: number}, b: {x: number; y: number; width: number; height: number}) =>
  Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);

const clearOf = (s: Scrap, avoid: ConfettiProps['avoid']): Scrap | null => {
  if (s.mode === 'cross' || !avoid?.length) return s;
  let y = s.y1;
  for (let n = 0; n < 10; n++) {
    const box = {x: s.x1, y, width: s.size, height: s.size};
    if (!avoid.some((a) => boxHit(box, a))) return {...s, y1: y};
    y -= s.size * 0.65 + 8;
  }
  return y > -s.size * 0.4 ? {...s, y1: y} : null;
};

const scrapD = (s: Scrap): string => {
  const z = s.size;
  const j = (n: number) => ((s.jag * 17 + n * 5.1) % 1) * 0.22 - 0.06;
  const p = (x: number, y: number) => `${(x * z).toFixed(1)} ${(y * z).toFixed(1)}`;
  if (s.kind === 'disc') {
    const c = 0.5 + j(1) * 0.3;
    const rx = 0.42 + j(2);
    const ry = 0.34 + j(3);
    return `M ${p(c - rx, c)} A ${(rx * z).toFixed(1)} ${(ry * z).toFixed(1)} 0 1 1 ${p(c - rx + 0.01, c)} Z`;
  }
  if (s.kind === 'tri') {
    return `M ${p(0.5 + j(1), 0.06 + j(2))} L ${p(0.08 + j(3), 0.92 + j(4))} L ${p(0.94 + j(5), 0.78 + j(6))} Z`;
  }
  return `M ${p(0.12 + j(1), 0.2 + j(2))} L ${p(0.78 + j(3), 0.06 + j(4))} L ${p(0.96 + j(5), 0.72 + j(6))} L ${p(0.22 + j(7), 0.94 + j(8))} Z`;
};

export const Confetti: React.FC<ConfettiProps> = ({t, dur, w, h, seed, colors, count, shortSide = 1080, avoid}) => {
  const pieces = scraps({seed, count, w, h, colors, dur}).flatMap((s) => {
    const cleared = clearOf(s, avoid);
    return cleared ? [cleared] : [];
  });
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, pointerEvents: 'none', overflow: 'hidden'}}>
      {pieces.map((s, i) => {
        const p = scrapPose(s, t, dur, shortSide);
        if (p.opacity <= 0.01) return null;
        const len = Math.hypot(p.vx, p.vy) || 1;
        const dirx = p.vx / len;
        const diry = p.vy / len;
        const steps = p.blur > 0 ? 5 : 1;
        const d = scrapD(s);
        const filterId = `cpsc-${i}-${String(seed).replace(/[^a-zA-Z0-9]/g, '')}`;
        return (
          <svg key={i} width={s.size} height={s.size} style={{position: 'absolute', left: p.x, top: p.y, overflow: 'visible', pointerEvents: 'none'}}>
            <defs>
              <filter id={filterId} x="-80%" y="-80%" width="260%" height="260%" colorInterpolationFilters="sRGB">
                <feGaussianBlur stdDeviation={Math.max(1.5, s.size * 0.06)} />
              </filter>
            </defs>
            <path d={d} fill="#1A140C" opacity={(s.large ? 0.42 : 0.28) * p.opacity} filter={`url(#${filterId})`} transform={`translate(${s.shadowDx.toFixed(1)} ${s.shadowDy.toFixed(1)}) rotate(${p.rot.toFixed(2)} ${s.size / 2} ${s.size / 2})`} />
            {Array.from({length: steps}, (_, k) => {
              const along = steps === 1 ? 0 : (k / (steps - 1) - 0.5) * p.blur * 2.2;
              const fade = steps === 1 ? 1 : 1 - Math.abs(k / (steps - 1) - 0.5) * 1.15;
              return (
                <path
                  key={k}
                  d={d}
                  fill={s.color}
                  opacity={Math.max(0, p.opacity * fade)}
                  transform={`translate(${(dirx * along).toFixed(2)} ${(diry * along).toFixed(2)}) rotate(${p.rot.toFixed(2)} ${s.size / 2} ${s.size / 2})`}
                />
              );
            })}
          </svg>
        );
      })}
    </div>
  );
};
