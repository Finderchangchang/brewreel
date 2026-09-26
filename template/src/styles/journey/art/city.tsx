import React from 'react';
import {INK, NEON, STREET, WINDOW, clamp01, hash, lit, mixHex, nightOf, skyAt} from './palette';
import {cloudPath, spark4} from './shapes';

// ============================================================
// journey / art 城市基础件：天空、远景天际线、中景塔楼、近景房子、街面、街道家具。
// 近景件的局部坐标：地面线 y = 0，往上是负数；x 从 0 往右。夜晚程度、黄昏暖光都按天色进度 p 自动套。
// 画法：扁平平涂；近景统一墨色描边 4px；中景不描边、低饱和（天然退后）；远景是一层淡色剪影。
// ============================================================

export const OUT = 4; // 近景描边

// ---------------- 天空 ----------------
export const Sky: React.FC<{w: number; h: number; horizonY: number; p: number; t: number; drift?: number; id?: string}> = ({w, h, horizonY, p, t, drift = 0, id = 'jsky'}) => {
  const s = skyAt(p);
  const night = nightOf(p);
  // 太阳：白天高挂右上，黄昏落到地平线附近；夜里换成月亮
  const sunP = clamp01(p / 0.8);
  const sunX = w * (0.78 - sunP * 0.1);
  const sunY = horizonY * (0.16 + sunP * 0.62);
  const sunR = 58 + sunP * 34;
  const moonX = w * 0.8;
  const moonY = horizonY * 0.2;
  const clouds = [
    [0.08, 0.2, 260, 80],
    [0.52, 0.12, 200, 64],
    [0.8, 0.34, 300, 92],
    [0.3, 0.42, 170, 56],
    [1.1, 0.24, 240, 74],
  ];
  const span = w + 700;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.top} />
          <stop offset={0.62} stopColor={mixHex(s.top, s.bot, 0.75)} />
          <stop offset="1" stopColor={s.bot} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
      {/* 星星 */}
      {night > 0.05 &&
        Array.from({length: 46}, (_, i) => {
          const x = hash(i * 3.1) * w;
          const y = hash(i * 7.7) * horizonY * 0.8;
          const tw = 0.55 + 0.45 * Math.sin(t * 2.4 + i);
          return i % 7 === 0 ? (
            <path key={i} d={spark4(x, y, 9)} fill="#FFF6D8" opacity={night * tw} />
          ) : (
            <circle key={i} cx={x} cy={y} r={1.8 + hash(i) * 2.2} fill="#FFF6D8" opacity={night * tw * 0.9} />
          );
        })}
      {/* 太阳 */}
      {night < 0.95 && (
        <g opacity={1 - night}>
          <circle cx={sunX} cy={sunY} r={sunR * 1.9} fill={s.sun} opacity={0.18} />
          <circle cx={sunX} cy={sunY} r={sunR * 1.4} fill={s.sun} opacity={0.28} />
          <circle cx={sunX} cy={sunY} r={sunR} fill={s.sun} />
        </g>
      )}
      {/* 月亮 */}
      {night > 0.05 && (
        <g opacity={night}>
          <circle cx={moonX} cy={moonY} r={110} fill="#FFF3C8" opacity={0.08} />
          <circle cx={moonX} cy={moonY} r={56} fill="#FFF3C8" />
          <circle cx={moonX + 24} cy={moonY - 14} r={48} fill={s.top} />
        </g>
      )}
      {/* 云 */}
      {clouds.map(([fx, fy, cw, ch], i) => {
        const x = ((((fx as number) * span - drift - t * (8 + i * 3)) % span) + span) % span - 350;
        const y = horizonY * (fy as number);
        return (
          <g key={i} opacity={0.95 - night * 0.55}>
            <path d={cloudPath(x, y, cw as number, ch as number)} fill={s.cloud} />
            <rect x={x + 10} y={y - 4} width={(cw as number) - 20} height={8} rx={4} fill={mixHex(s.cloud, s.top, 0.18)} />
          </g>
        );
      })}
    </g>
  );
};

// ---------------- 远景天际线（可无限平铺） ----------------
const FAR_TILE = 1800;
export const FarSkyline: React.FC<{w: number; horizonY: number; p: number; offset: number; scale?: number}> = ({w, horizonY, p, offset, scale = 1}) => {
  const s = skyAt(p);
  const night = nightOf(p);
  const col = mixHex(s.far, s.bot, 0.15);
  const col2 = mixHex(s.far, s.top, 0.12);
  const start = Math.floor(offset / FAR_TILE) - 1;
  const tiles = Math.ceil(w / FAR_TILE) + 2;
  const shapes: React.ReactNode[] = [];
  for (let k = 0; k < tiles; k++) {
    const tx = (start + k) * FAR_TILE - offset;
    for (let i = 0; i < 16; i++) {
      const bx = tx + i * 112 + hash(i * 9.1) * 30;
      const bw = 70 + hash(i * 2.3) * 60;
      const bh = (140 + hash(i * 5.7) * 260) * scale;
      const top = horizonY - bh;
      const kind = Math.floor(hash(i * 1.9) * 5);
      const c = i % 2 ? col : col2;
      shapes.push(<rect key={`${k}-${i}`} x={bx} y={top} width={bw} height={bh + 4} fill={c} />);
      if (kind === 0) shapes.push(<path key={`${k}-${i}a`} d={`M ${bx + bw / 2},${top - 60} L ${bx + bw / 2},${top}`} stroke={c} strokeWidth={6} />);
      if (kind === 1) shapes.push(<circle key={`${k}-${i}b`} cx={bx + bw / 2} cy={top} r={bw / 2} fill={c} />);
      if (kind === 2) shapes.push(<rect key={`${k}-${i}c`} x={bx + bw * 0.2} y={top - 36} width={bw * 0.6} height={40} fill={c} />);
      if (night > 0.1)
        for (let j = 0; j < 5; j++) {
          if (hash(i * 13 + j * 7 + k) > 0.55) continue;
          shapes.push(<rect key={`${k}-${i}w${j}`} x={bx + 12 + (j % 2) * (bw / 2 - 6)} y={top + 24 + j * 38} width={10} height={14} fill={WINDOW.on} opacity={night * 0.75} />);
        }
    }
    // 远处小山丘
    shapes.push(<path key={`${k}-hill`} d={`M ${tx},${horizonY} Q ${tx + 300},${horizonY - 120 * scale} ${tx + 700},${horizonY} Q ${tx + 1100},${horizonY - 90 * scale} ${tx + FAR_TILE},${horizonY} Z`} fill={mixHex(col, s.bot, 0.3)} />);
  }
  return <g>{shapes}</g>;
};

// ---------------- 窗户 ----------------
type WinKind = 'grid' | 'arch' | 'round' | 'band' | 'tall';
export const windowColor = (seed: number, p: number) => {
  const n = nightOf(p);
  const on = hash(seed) < 0.62;
  return mixHex(WINDOW.day, on ? (hash(seed + 5) < 0.3 ? WINDOW.onWarm : WINDOW.on) : WINDOW.off, n);
};
export const Windows: React.FC<{x: number; y: number; w: number; h: number; kind?: WinKind; p: number; seed: number; cols?: number; rows?: number; stroke?: boolean}> = ({x, y, w, h, kind = 'grid', p, seed, cols, rows, stroke = true}) => {
  const c = cols ?? Math.max(1, Math.floor(w / 62));
  const r = rows ?? Math.max(1, Math.floor(h / 78));
  const gw = w / c;
  const gh = h / r;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < c; i++)
    for (let j = 0; j < r; j++) {
      const cx = x + gw * (i + 0.5);
      const cy = y + gh * (j + 0.5);
      const col = windowColor(seed * 17 + i * 5 + j * 11, p);
      const sw = stroke ? 3 : 0;
      const k = `${i}-${j}`;
      if (kind === 'round') out.push(<circle key={k} cx={cx} cy={cy} r={Math.min(gw, gh) * 0.3} fill={col} stroke={INK} strokeWidth={sw} />);
      else if (kind === 'arch') {
        const ww = gw * 0.52;
        const hh = gh * 0.62;
        out.push(<path key={k} d={`M ${cx - ww / 2},${cy + hh / 2} L ${cx - ww / 2},${cy - hh / 2 + ww / 2} A ${ww / 2} ${ww / 2} 0 0 1 ${cx + ww / 2},${cy - hh / 2 + ww / 2} L ${cx + ww / 2},${cy + hh / 2} Z`} fill={col} stroke={INK} strokeWidth={sw} />);
      } else if (kind === 'band') out.push(<rect key={k} x={x + 10} y={cy - gh * 0.22} width={w - 20} height={gh * 0.44} rx={6} fill={col} stroke={INK} strokeWidth={sw} />);
      else if (kind === 'tall') out.push(<rect key={k} x={cx - gw * 0.2} y={cy - gh * 0.36} width={gw * 0.4} height={gh * 0.72} rx={6} fill={col} stroke={INK} strokeWidth={sw} />);
      else out.push(<rect key={k} x={cx - gw * 0.3} y={cy - gh * 0.26} width={gw * 0.6} height={gh * 0.52} rx={7} fill={col} stroke={INK} strokeWidth={sw} />);
      if (kind === 'band') break;
    }
  return <g>{out}</g>;
};

// ---------------- 近景房子 ----------------
export type Roof = 'flat' | 'gable' | 'arc' | 'saw' | 'step' | 'none';
export const House: React.FC<{x: number; w: number; h: number; color: string; p: number; seed: number; roof?: Roof; win?: WinKind; door?: boolean; awning?: string; roofColor?: string}> = ({x, w, h, color, p, seed, roof = 'flat', win = 'grid', door = true, awning, roofColor}) => {
  const body = lit(color, p);
  const rc = lit(roofColor ?? mixHex(color, INK, 0.28), p);
  const top = -h;
  const roofEl =
    roof === 'gable' ? (
      <path d={`M ${x - 14},${top} L ${x + w / 2},${top - w * 0.36} L ${x + w + 14},${top} Z`} fill={rc} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
    ) : roof === 'arc' ? (
      <path d={`M ${x},${top} A ${w / 2} ${w * 0.3} 0 0 1 ${x + w},${top} Z`} fill={rc} stroke={INK} strokeWidth={OUT} />
    ) : roof === 'saw' ? (
      <path d={`M ${x},${top} ${Array.from({length: 4}, (_, i) => `L ${x + (w / 4) * i},${top - 46} L ${x + (w / 4) * (i + 1)},${top}`).join(' ')} Z`} fill={rc} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
    ) : roof === 'step' ? (
      <g>
        <rect x={x + w * 0.18} y={top - 40} width={w * 0.64} height={44} fill={rc} stroke={INK} strokeWidth={OUT} />
        <rect x={x + w * 0.36} y={top - 70} width={w * 0.28} height={34} fill={rc} stroke={INK} strokeWidth={OUT} />
      </g>
    ) : roof === 'flat' ? (
      <rect x={x - 10} y={top - 18} width={w + 20} height={22} rx={4} fill={rc} stroke={INK} strokeWidth={OUT} />
    ) : null;
  const gf = 96; // 底层高度
  return (
    <g>
      {roofEl}
      <rect x={x} y={top} width={w} height={h} fill={body} stroke={INK} strokeWidth={OUT} />
      <Windows x={x + 14} y={top + 22} w={w - 28} h={Math.max(40, h - gf - 34)} kind={win} p={p} seed={seed} />
      {door && (
        <g>
          <rect x={x + w * 0.5 - 28} y={-78} width={56} height={78} rx={10} fill={lit(mixHex(color, INK, 0.45), p)} stroke={INK} strokeWidth={OUT} />
          <circle cx={x + w * 0.5 + 16} cy={-38} r={4} fill={STREET.dash} />
        </g>
      )}
      {awning && (
        <g>
          <path d={`M ${x + 12},${-104} L ${x + w - 12},${-104} L ${x + w - 2},${-80} L ${x + 2},${-80} Z`} fill={lit(awning, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
          {Array.from({length: Math.floor((w - 24) / 44)}, (_, i) => (
            <path key={i} d={`M ${x + 22 + i * 44},${-104} L ${x + 34 + i * 44},${-104} L ${x + 40 + i * 44},${-80} L ${x + 26 + i * 44},${-80} Z`} fill="#FFFFFF" opacity={0.85 - nightOf(p) * 0.5} />
          ))}
        </g>
      )}
    </g>
  );
};

// ---------------- 中景塔楼（不描边） ----------------
export const Tower: React.FC<{x: number; w: number; h: number; color: string; p: number; seed: number; top?: 'flat' | 'dome' | 'spire' | 'step' | 'antenna' | 'tank'}> = ({x, w, h, color, p, seed, top = 'flat'}) => {
  const c = lit(color, p);
  const n = nightOf(p);
  const winDay = mixHex(color, '#FFFFFF', 0.45);
  const y = -h;
  const cols = Math.max(2, Math.floor(w / 46));
  const rows = Math.floor((h - 40) / 56);
  const wins: React.ReactNode[] = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const on = hash(seed * 7 + i * 3 + j * 13) < 0.45;
      const col = mixHex(winDay, on ? WINDOW.on : lit(mixHex(color, INK, 0.3), p), n);
      wins.push(<rect key={`${i}-${j}`} x={x + 14 + i * ((w - 28) / cols) + 4} y={y + 30 + j * 56} width={(w - 28) / cols - 8} height={28} rx={5} fill={col} opacity={n > 0.3 && !on ? 0.5 : 1} />);
    }
  return (
    <g>
      {top === 'dome' && <path d={`M ${x},${y + 2} A ${w / 2} ${w / 2.2} 0 0 1 ${x + w},${y + 2} Z`} fill={c} />}
      {top === 'spire' && <path d={`M ${x + w * 0.2},${y + 2} L ${x + w / 2},${y - w * 0.9} L ${x + w * 0.8},${y + 2} Z`} fill={c} />}
      {top === 'step' && <rect x={x + w * 0.15} y={y - 50} width={w * 0.7} height={52} fill={c} />}
      {top === 'antenna' && (
        <g>
          <rect x={x + w * 0.3} y={y - 30} width={w * 0.4} height={32} fill={c} />
          <rect x={x + w / 2 - 3} y={y - 110} width={6} height={82} fill={c} />
          <circle cx={x + w / 2} cy={y - 112} r={7} fill={mixHex(c, '#FF5A4E', 0.3 + n * 0.7)} />
        </g>
      )}
      {top === 'tank' && (
        <g>
          <rect x={x + w * 0.25} y={y - 70} width={w * 0.5} height={50} rx={8} fill={c} />
          <path d={`M ${x + w * 0.3},${y - 20} L ${x + w * 0.3},${y} M ${x + w * 0.7},${y - 20} L ${x + w * 0.7},${y}`} stroke={c} strokeWidth={6} />
        </g>
      )}
      <rect x={x} y={y} width={w} height={h + 2} fill={c} />
      {wins}
    </g>
  );
};

// ---------------- 街道家具 ----------------
export const StreetLamp: React.FC<{x: number; p: number; h?: number}> = ({x, p, h = 250}) => {
  const n = nightOf(p);
  return (
    <g>
      {n > 0.05 && <path d={`M ${x + 40},${-h + 18} L ${x - 50},${20} L ${x + 150},${20} Z`} fill={STREET.lampGlow} opacity={0.16 * n} />}
      <rect x={x - 6} y={-h} width={12} height={h + 18} rx={6} fill={lit(STREET.lampPost, p)} stroke={INK} strokeWidth={3} />
      <path d={`M ${x},${-h + 6} Q ${x + 6},${-h - 30} ${x + 46},${-h - 22}`} fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
      <path d={`M ${x},${-h + 6} Q ${x + 6},${-h - 30} ${x + 46},${-h - 22}`} fill="none" stroke={lit(STREET.lampPost, p)} strokeWidth={7} strokeLinecap="round" />
      <path d={`M ${x + 26},${-h - 14} L ${x + 66},${-h - 14} L ${x + 58},${-h + 6} L ${x + 34},${-h + 6} Z`} fill={lit('#4A5270', p)} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <ellipse cx={x + 46} cy={-h + 8} rx={14} ry={6} fill={mixHex('#FFF6D8', STREET.lampGlow, n)} stroke={INK} strokeWidth={3} />
      {n > 0.05 && <circle cx={x + 46} cy={-h + 10} r={30} fill={STREET.lampGlow} opacity={0.35 * n} />}
    </g>
  );
};

export const Tree: React.FC<{x: number; p: number; s?: number; seed?: number}> = ({x, p, s = 1, seed = 1}) => {
  const g = lit(STREET.tree, p);
  const gd = lit(STREET.treeDeep, p);
  const r = 62 * s;
  const round = hash(seed) > 0.4;
  return (
    <g>
      <rect x={x - 9 * s} y={-110 * s} width={18 * s} height={122 * s} rx={6} fill={lit(STREET.trunk, p)} stroke={INK} strokeWidth={3.5} />
      {round ? (
        <g>
          <circle cx={x} cy={-150 * s} r={r} fill={g} stroke={INK} strokeWidth={OUT} />
          <path d={`M ${x - r * 0.7},${-150 * s + r * 0.45} A ${r} ${r} 0 0 0 ${x + r * 0.95},${-150 * s + r * 0.2}`} fill="none" stroke={gd} strokeWidth={14 * s} strokeLinecap="round" />
          <circle cx={x - r * 0.35} cy={-150 * s - r * 0.35} r={9 * s} fill="#FFFFFF" opacity={0.35 - nightOf(p) * 0.3} />
        </g>
      ) : (
        <g>
          <path d={`M ${x},${-270 * s} C ${x + 70 * s},${-200 * s} ${x + 70 * s},${-96 * s} ${x},${-96 * s} C ${x - 70 * s},${-96 * s} ${x - 70 * s},${-200 * s} ${x},${-270 * s} Z`} fill={g} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
          <path d={`M ${x + 30 * s},${-200 * s} Q ${x + 40 * s},${-140 * s} ${x + 16 * s},${-114 * s}`} fill="none" stroke={gd} strokeWidth={12 * s} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
};

export const Bush: React.FC<{x: number; p: number; w?: number}> = ({x, p, w = 120}) => (
  <path d={cloudPath(x, 14, w, 56)} fill={lit(STREET.bush, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
);

export const Bench: React.FC<{x: number; p: number; color?: string}> = ({x, p, color = '#FF8A3D'}) => (
  <g>
    <rect x={x} y={-44} width={120} height={14} rx={6} fill={lit(color, p)} stroke={INK} strokeWidth={3.5} />
    <rect x={x} y={-72} width={120} height={14} rx={6} fill={lit(color, p)} stroke={INK} strokeWidth={3.5} />
    <path d={`M ${x + 14},${-30} L ${x + 10},${14} M ${x + 106},${-30} L ${x + 110},${14}`} stroke={INK} strokeWidth={6} strokeLinecap="round" />
  </g>
);

/** 串旗（两点之间一串三角小旗） */
export const Bunting: React.FC<{x0: number; y0: number; x1: number; y1: number; p: number; sag?: number; seed?: number}> = ({x0, y0, x1, y1, p, sag = 60, seed = 0}) => {
  const n = Math.max(3, Math.floor(Math.abs(x1 - x0) / 56));
  const pt = (k: number) => {
    const q = k / n;
    return [x0 + (x1 - x0) * q, y0 + (y1 - y0) * q + Math.sin(q * Math.PI) * sag] as const;
  };
  const flags: React.ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const [ax, ay] = pt(k + 0.15);
    const [bx, by] = pt(k + 0.85);
    const col = NEON[(k + seed) % NEON.length];
    flags.push(<path key={k} d={`M ${ax},${ay} L ${bx},${by} L ${(ax + bx) / 2},${(ay + by) / 2 + 40} Z`} fill={lit(col, p)} stroke={INK} strokeWidth={3} strokeLinejoin="round" />);
  }
  const [mx, my] = pt(n / 2);
  return (
    <g>
      <path d={`M ${x0},${y0} Q ${mx},${my + sag * 0.9} ${x1},${y1}`} fill="none" stroke={INK} strokeWidth={3} />
      {flags}
    </g>
  );
};

// ---------------- 街面 ----------------
export const Street: React.FC<{x0: number; x1: number; depth: number; p: number; offset: number}> = ({x0, x1, depth, p, offset}) => {
  const n = nightOf(p);
  const walk = mixHex(STREET.walkDay, STREET.walkNight, n);
  const curb = mixHex(STREET.curbDay, STREET.curbNight, n);
  const road = mixHex(STREET.roadDay, STREET.roadNight, n);
  const grass = lit('#7ACB7E', p);
  const roadBot = Math.min(depth, 250);
  const dashes: React.ReactNode[] = [];
  const tiles: React.ReactNode[] = [];
  const period = 180;
  const first = Math.floor((x0 + offset) / period) - 1;
  for (let k = first; k * period - offset < x1 + period; k++) {
    const x = k * period - offset;
    dashes.push(<rect key={k} x={x} y={52 + (roadBot - 52) / 2 - 6} width={96} height={12} rx={6} fill={mixHex(STREET.dash, '#C9A83A', n * 0.4)} />);
    tiles.push(<line key={`t${k}`} x1={x + 40} y1={4} x2={x + 40} y2={40} stroke={mixHex(walk, INK, 0.12)} strokeWidth={3} />);
  }
  return (
    <g>
      <rect x={x0} y={0} width={x1 - x0} height={44} fill={walk} />
      {tiles}
      <rect x={x0} y={40} width={x1 - x0} height={14} fill={curb} />
      <rect x={x0} y={54} width={x1 - x0} height={roadBot - 54} fill={road} />
      {dashes}
      {depth > roadBot && (
        <g>
          <rect x={x0} y={roadBot} width={x1 - x0} height={14} fill={curb} />
          <rect x={x0} y={roadBot + 14} width={x1 - x0} height={depth - roadBot} fill={grass} />
        </g>
      )}
      <line x1={x0} y1={0} x2={x1} y2={0} stroke={INK} strokeWidth={OUT} />
    </g>
  );
};
