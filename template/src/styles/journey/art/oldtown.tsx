import React from 'react';
import {DISTRICT, DistrictKind, INK, NEON, OLD, hash, lit, mixHex, nightOf, skyAt} from './palette';
import {OUT} from './city';

// ============================================================
// journey / art 古城（skyline: oldtown）：白墙黛瓦、马头墙、远山宝塔、石板路和河，外加四个古城街区（原创造型）。
//   gate     城门：城墙 + 拱门 + 两层城楼 + 旗
//   bridge   石桥：三孔石拱桥跨河、柳树、乌篷船慢慢划过
//   teahouse 茶馆 / 老铺 / 手作：两层木楼、格窗、布幌（茶杯图案）、晾着的蓝染布、门口茶桌
//   lantern  灯会 / 夜市：牌楼、一串串红灯笼、摊位；gagT 起灯笼从左到右依次亮起（放最后一站，夜景）
// 局部坐标同 districts.tsx：地面线 y = 0，x 0..2200。背景层 OldFar（远山 + 宝塔 + 远处屋檐）、OldMid（淡色白墙群）、
// 填充段 OldFiller、街面 OldStreet（石板路 + 河道）由 World.tsx 在 skyline = oldtown 时换上。
// ============================================================
type C = (typeof DISTRICT)[DistrictKind];
type P = {p: number; t: number; gagT?: number; c: C};
const W = 2200;

/** 黛瓦屋顶：y = 屋檐底边（墙顶），两端起翘 */
export const TileRoof: React.FC<{x: number; y: number; w: number; h?: number; eave?: number; p: number; color?: string}> = ({x, y, w, h = 48, eave = 28, p, color = OLD.tile}) => {
  const c = lit(color, p);
  const lines: React.ReactNode[] = [];
  for (let lx = x + 14; lx < x + w - 10; lx += 22) lines.push(<line key={lx} x1={lx} y1={y - h + 8} x2={lx + (lx - (x + w / 2)) * 0.04} y2={y - 4} stroke={lit(OLD.tileLight, p)} strokeWidth={3} />);
  return (
    <g>
      <path d={`M ${x - eave},${y - 18} Q ${x - eave * 0.2},${y + 2} ${x + 16},${y} L ${x + w - 16},${y} Q ${x + w + eave * 0.2},${y + 2} ${x + w + eave},${y - 18} Q ${x + w + eave * 0.1},${y - 16} ${x + w - 6},${y - h} L ${x + 6},${y - h} Q ${x - eave * 0.1},${y - 16} ${x - eave},${y - 18} Z`} fill={c} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      {lines}
      <path d={`M ${x - 4},${y - h - 2} L ${x + w + 4},${y - h - 2}`} stroke={INK} strokeWidth={12} strokeLinecap="round" />
      <path d={`M ${x - 4},${y - h - 2} L ${x + w + 4},${y - h - 2}`} stroke={c} strokeWidth={6} strokeLinecap="round" />
      <path d={`M ${x - 10},${y - h + 4} q -6,-22 8,-26 M ${x + w + 10},${y - h + 4} q 6,-22 -8,-26`} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
    </g>
  );
};

/** 红灯笼（中心 x,y，半径 r）；on = 亮度 0..1 */
export const Lantern: React.FC<{x: number; y: number; r?: number; p: number; on?: number; color?: string}> = ({x, y, r = 26, p, on, color = OLD.lantern}) => {
  const n = on ?? nightOf(p);
  const body = mixHex(lit(color, p), '#FF6A3D', n * 0.5);
  return (
    <g>
      {n > 0.05 && <circle cx={x} cy={y} r={r * 2.3} fill={OLD.lanternGlow} opacity={0.32 * n} />}
      <line x1={x} y1={y - r * 1.4} x2={x} y2={y - r * 0.9} stroke={INK} strokeWidth={3} />
      <rect x={x - r * 0.45} y={y - r * 1.05} width={r * 0.9} height={r * 0.28} rx={3} fill={lit('#E9B949', p)} stroke={INK} strokeWidth={3} />
      <ellipse cx={x} cy={y} rx={r} ry={r * 0.82} fill={body} stroke={INK} strokeWidth={3.5} />
      <path d={`M ${x},${y - r * 0.8} Q ${x - r * 0.55},${y} ${x},${y + r * 0.8} M ${x},${y - r * 0.8} Q ${x + r * 0.55},${y} ${x},${y + r * 0.8}`} fill="none" stroke={mixHex(INK, body, 0.5)} strokeWidth={2.5} />
      {n > 0.05 && <ellipse cx={x - r * 0.3} cy={y - r * 0.25} rx={r * 0.28} ry={r * 0.2} fill="#FFE7A8" opacity={0.7 * n} />}
      <rect x={x - r * 0.45} y={y + r * 0.78} width={r * 0.9} height={r * 0.26} rx={3} fill={lit('#E9B949', p)} stroke={INK} strokeWidth={3} />
      <path d={`M ${x},${y + r * 1.04} L ${x},${y + r * 1.6}`} stroke={lit('#E9B949', p)} strokeWidth={5} strokeLinecap="round" />
    </g>
  );
};

/** 白墙黛瓦民居：马头墙（两端阶梯状山墙）、小格窗、木门，可挂灯笼 */
export const OldHouse: React.FC<{x: number; w: number; h: number; p: number; seed: number; horse?: boolean; lantern?: boolean; door?: boolean}> = ({x, w, h, p, seed, horse = true, lantern = false, door = true}) => {
  const n = nightOf(p);
  const wall = lit(OLD.wall, p);
  const shade = lit(OLD.wallShade, p);
  const top = -h;
  const steps = horse ? 2 : 0;
  const capC = lit(OLD.tile, p);
  const gable = (gx: number, dir: 1 | -1) =>
    Array.from({length: steps}, (_, i) => {
      const sw = 46;
      const sx = dir > 0 ? gx + i * 26 : gx - sw - i * 26;
      const sy = top - 36 - i * 34;
      return (
        <g key={`${dir}${i}`}>
          <rect x={sx} y={sy} width={sw} height={top - sy + 40} fill={wall} stroke={INK} strokeWidth={OUT} />
          <path d={`M ${sx - 10},${sy} L ${sx + sw + 10},${sy} L ${sx + sw + 4},${sy - 12} L ${sx - 4},${sy - 12} Z`} fill={capC} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
          <path d={`M ${sx + (dir > 0 ? -10 : sw + 10)},${sy} q ${dir > 0 ? -8 : 8},-6 ${dir > 0 ? -4 : 4},-18`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    });
  const cols = Math.max(1, Math.floor((w - 40) / 90));
  const wins: React.ReactNode[] = [];
  for (let i = 0; i < cols; i++) {
    const wx = x + 20 + ((w - 40) / cols) * (i + 0.5);
    const wy = top + 40 + (h > 300 ? 0 : 0);
    const on = hash(seed * 11 + i) < 0.7;
    const glass = mixHex(lit('#5A4A3F', p), on ? '#FFD98A' : '#1E3038', n);
    wins.push(
      <g key={i}>
        <rect x={wx - 26} y={wy} width={52} height={50} rx={4} fill={glass} stroke={INK} strokeWidth={3.5} />
        <path d={`M ${wx},${wy} L ${wx},${wy + 50} M ${wx - 26},${wy + 25} L ${wx + 26},${wy + 25}`} stroke={lit(OLD.woodLight, p)} strokeWidth={3} />
      </g>,
    );
  }
  return (
    <g>
      {horse && gable(x - 6, 1)}
      {horse && gable(x + w + 6, -1)}
      <TileRoof x={x + 8} y={top} w={w - 16} h={Math.min(56, 26 + w * 0.06)} eave={22} p={p} />
      <rect x={x} y={top} width={w} height={h} fill={wall} stroke={INK} strokeWidth={OUT} />
      <rect x={x + 2} y={top + 2} width={w - 4} height={14} fill={shade} />
      <rect x={x} y={-34} width={w} height={34} fill={lit(OLD.plinth, p)} stroke={INK} strokeWidth={OUT} />
      {h > 200 && wins}
      {door && (
        <g>
          <rect x={x + w * 0.5 - 34} y={-118} width={68} height={118} fill={lit(OLD.wood, p)} stroke={INK} strokeWidth={OUT} />
          <line x1={x + w * 0.5} y1={-118} x2={x + w * 0.5} y2={0} stroke={INK} strokeWidth={3} />
          <path d={`M ${x + w * 0.5 - 46},${-118} L ${x + w * 0.5 + 46},${-118} L ${x + w * 0.5 + 38},${-136} L ${x + w * 0.5 - 38},${-136} Z`} fill={capC} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
        </g>
      )}
      {lantern && <Lantern x={x + w * 0.5 + 64} y={-150} r={22} p={p} />}
    </g>
  );
};

/** 垂柳 */
export const Willow: React.FC<{x: number; p: number; t: number; s?: number}> = ({x, p, t, s = 1}) => {
  const g = lit(OLD.willow, p);
  const gd = lit(mixHex(OLD.willow, '#2E7D4A', 0.45), p);
  const strands: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const sx = x + (-110 + i * 27) * s;
    const len = (150 + hash(i * 3.1 + x) * 90) * s;
    const sway = Math.sin(t * 1.6 + i * 0.7) * 10 * s;
    strands.push(<path key={i} d={`M ${sx},${-300 * s} Q ${sx + sway},${-300 * s + len * 0.5} ${sx + sway * 1.6},${-300 * s + len}`} fill="none" stroke={i % 2 ? g : gd} strokeWidth={14 * s} strokeLinecap="round" />);
  }
  return (
    <g>
      <path d={`M ${x - 8 * s},0 Q ${x - 14 * s},${-160 * s} ${x + 6 * s},${-300 * s} L ${x + 22 * s},${-296 * s} Q ${x + 8 * s},${-160 * s} ${x + 14 * s},0 Z`} fill={lit('#7A5A44', p)} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <ellipse cx={x} cy={-310 * s} rx={130 * s} ry={56 * s} fill={g} stroke={INK} strokeWidth={OUT} />
      {strands}
    </g>
  );
};

// ---------------- 背景：远山 + 宝塔 + 远处屋檐（可无限平铺） ----------------
const FAR_TILE = 2000;
export const OldFar: React.FC<{w: number; horizonY: number; p: number; offset: number; scale?: number}> = ({w, horizonY, p, offset, scale = 1}) => {
  const s = skyAt(p);
  const far1 = mixHex(s.far, s.top, 0.2);
  const far2 = mixHex(s.far, s.bot, 0.2);
  const roofC = mixHex(OLD.tile, s.far, 0.62);
  const wallC = mixHex(OLD.wall, s.far, 0.45);
  const start = Math.floor(offset / FAR_TILE) - 1;
  const tiles = Math.ceil(w / FAR_TILE) + 2;
  const out: React.ReactNode[] = [];
  const H = (v: number) => horizonY - v * scale;
  for (let k = 0; k < tiles; k++) {
    const tx = (start + k) * FAR_TILE - offset;
    out.push(<path key={`m1${k}`} d={`M ${tx},${horizonY} Q ${tx + 260},${H(420)} ${tx + 560},${H(260)} Q ${tx + 820},${H(160)} ${tx + 1080},${H(380)} Q ${tx + 1420},${H(520)} ${tx + 1700},${H(240)} Q ${tx + 1860},${H(150)} ${tx + FAR_TILE},${H(200)} L ${tx + FAR_TILE},${horizonY} Z`} fill={far1} />);
    out.push(<path key={`m2${k}`} d={`M ${tx},${H(120)} Q ${tx + 380},${H(300)} ${tx + 760},${H(150)} Q ${tx + 1100},${H(60)} ${tx + 1400},${H(230)} Q ${tx + 1700},${H(330)} ${tx + FAR_TILE},${H(120)} L ${tx + FAR_TILE},${horizonY} L ${tx},${horizonY} Z`} fill={far2} />);
    // 宝塔（七层）
    const px = tx + 1180;
    const pb = H(300);
    for (let i = 0; i < 7; i++) {
      const ww = (70 - i * 7) * scale;
      const y = pb - i * 34 * scale;
      out.push(<rect key={`pt${k}${i}`} x={px - ww / 2} y={y - 26 * scale} width={ww} height={26 * scale} fill={wallC} />);
      out.push(<path key={`pr${k}${i}`} d={`M ${px - ww / 2 - 16 * scale},${y - 22 * scale} L ${px + ww / 2 + 16 * scale},${y - 22 * scale} L ${px + ww / 2},${y - 36 * scale} L ${px - ww / 2},${y - 36 * scale} Z`} fill={roofC} />);
    }
    out.push(<rect key={`pp${k}`} x={px - 3} y={pb - 7 * 34 * scale - 40 * scale} width={6} height={40 * scale} fill={roofC} />);
    // 地平线上一排远处屋檐
    for (let i = 0; i < 12; i++) {
      const bx = tx + i * 170 + hash(i * 3.3) * 40;
      const bw = (110 + hash(i * 1.7) * 60) * scale;
      const bh = (50 + hash(i * 2.9) * 50) * scale;
      out.push(<rect key={`hw${k}${i}`} x={bx} y={horizonY - bh} width={bw} height={bh + 4} fill={wallC} />);
      out.push(<path key={`hr${k}${i}`} d={`M ${bx - 14},${horizonY - bh + 2} L ${bx + bw + 14},${horizonY - bh + 2} L ${bx + bw - 6},${horizonY - bh - 20 * scale} L ${bx + 6},${horizonY - bh - 20 * scale} Z`} fill={roofC} />);
      if (nightOf(p) > 0.1 && hash(i * 7 + k) < 0.5) out.push(<circle key={`hl${k}${i}`} cx={bx + bw / 2} cy={horizonY - bh / 2} r={5} fill="#FFB25A" opacity={nightOf(p)} />);
    }
  }
  return <g>{out}</g>;
};

// ---------------- 中景：淡色白墙群（不描边），可带宝塔 / 钟楼 ----------------
export const OldMid: React.FC<{w: number; p: number; seed?: number; tower?: boolean}> = ({w, p, seed = 0, tower = false}) => {
  const s = skyAt(p);
  const wall = mixHex(lit(OLD.wall, p), s.far, 0.3);
  const wall2 = mixHex(lit(OLD.wallShade, p), s.far, 0.3);
  const roof = mixHex(lit(OLD.tile, p), s.far, 0.35);
  const n = nightOf(p);
  const out: React.ReactNode[] = [];
  let x = 0;
  let i = 0;
  while (x < w - 60) {
    const sd = seed * 13 + i * 5;
    const bw = 170 + hash(sd) * 120;
    const bh = 170 + hash(sd + 1) * 150;
    const c = i % 2 ? wall : wall2;
    out.push(<rect key={`w${i}`} x={x} y={-bh} width={bw} height={bh} fill={c} />);
    out.push(<path key={`r${i}`} d={`M ${x - 16},${-bh + 4} L ${x + bw + 16},${-bh + 4} L ${x + bw - 4},${-bh - 30} L ${x + 4},${-bh - 30} Z`} fill={roof} />);
    // 马头墙
    [x - 4, x + bw - 38].forEach((gx, g) => {
      out.push(<rect key={`g${i}${g}`} x={gx} y={-bh - 64} width={42} height={64} fill={c} />);
      out.push(<rect key={`gc${i}${g}`} x={gx - 6} y={-bh - 72} width={54} height={10} fill={roof} />);
    });
    for (let j = 0; j < Math.floor(bw / 70); j++) out.push(<rect key={`wn${i}${j}`} x={x + 24 + j * 70} y={-bh + 50} width={30} height={30} fill={mixHex(roof, '#FFC874', n * 0.8)} opacity={0.8} />);
    x += bw + 18 + hash(sd + 2) * 30;
    i++;
  }
  const tw = w * 0.5;
  const extra = tower ? (
    <g>
      {Array.from({length: 5}, (_, k) => {
        const ww = 110 - k * 14;
        const y = -380 - k * 60;
        return (
          <g key={k}>
            <rect x={tw - ww / 2} y={y - 44} width={ww} height={48} fill={wall} />
            <path d={`M ${tw - ww / 2 - 30},${y - 38} L ${tw + ww / 2 + 30},${y - 38} L ${tw + ww / 2},${y - 64} L ${tw - ww / 2},${y - 64} Z`} fill={roof} />
          </g>
        );
      })}
      <rect x={tw - 70} y={-380} width={140} height={380} fill={wall2} />
    </g>
  ) : null;
  return (
    <g>
      {extra}
      {out}
    </g>
  );
};

// ---------------- 填充段：民居 + 垂柳 ----------------
export const OldFiller: React.FC<{p: number; t: number; seed?: number; w?: number}> = ({p, t, seed = 0, w = W}) => {
  const out: React.ReactNode[] = [];
  let x = 40;
  let i = 0;
  while (x < w - 220) {
    const s = seed * 29 + i;
    const hw = 230 + Math.floor(hash(s) * 90);
    const hh = 220 + Math.floor(hash(s + 1) * 110);
    out.push(<OldHouse key={i} x={x} w={hw} h={hh} p={p} seed={s} horse={hash(s + 2) > 0.3} lantern={hash(s + 3) > 0.55} />);
    x += hw + 60;
    if (hash(s + 4) > 0.5 && x < w - 300) {
      out.push(<Willow key={`wl${i}`} x={x + 70} p={p} t={t} s={0.9} />);
      x += 200;
    }
    i++;
  }
  return <g>{out}</g>;
};

// ---------------- 街面：石板路 + 河道 ----------------
export const OldStreet: React.FC<{x0: number; x1: number; depth: number; p: number; offset: number; t: number}> = ({x0, x1, depth, p, offset, t}) => {
  const n = nightOf(p);
  const slab = lit(OLD.stone, p);
  const slabDeep = lit(OLD.stoneDeep, p);
  const lane = lit(mixHex(OLD.stone, OLD.stoneDeep, 0.5), p);
  const roadBot = Math.min(depth, 250);
  const seams: React.ReactNode[] = [];
  const period = 120;
  const first = Math.floor((x0 + offset) / period) - 1;
  for (let k = first; k * period - offset < x1 + period; k++) {
    const x = k * period - offset;
    seams.push(<line key={`a${k}`} x1={x} y1={4} x2={x} y2={40} stroke={slabDeep} strokeWidth={3} />);
    for (let r = 0; r < 3; r++) {
      const yy = 60 + r * ((roadBot - 60) / 3);
      const xx = x + (r % 2) * 60;
      seams.push(<line key={`b${k}${r}`} x1={xx} y1={yy} x2={xx} y2={yy + (roadBot - 60) / 3} stroke={mixHex(lane, INK, 0.18)} strokeWidth={3} />);
    }
  }
  const water = mixHex(lit(OLD.water, p), '#0E3440', n * 0.5);
  const ripples: React.ReactNode[] = [];
  if (depth > roadBot + 20) {
    const rp = 160;
    const f0 = Math.floor((x0 + offset * 0.9) / rp) - 1;
    for (let k = f0; k * rp - offset * 0.9 < x1 + rp; k++) {
      const x = k * rp - offset * 0.9 + Math.sin(t * 1.5 + k) * 10;
      const y = roadBot + 40 + (k % 3) * 34;
      if (y < depth - 10) ripples.push(<path key={k} d={`M ${x},${y} q 20,-10 40,0 q 20,10 40,0`} fill="none" stroke={mixHex(water, '#FFFFFF', 0.45)} strokeWidth={4} strokeLinecap="round" />);
      if (n > 0.3 && k % 2 === 0) ripples.push(<rect key={`g${k}`} x={x + 20} y={y + 12} width={36} height={6} rx={3} fill="#FFB25A" opacity={0.5 * n} />);
    }
  }
  return (
    <g>
      <rect x={x0} y={0} width={x1 - x0} height={44} fill={slab} />
      <rect x={x0} y={40} width={x1 - x0} height={14} fill={slabDeep} />
      <rect x={x0} y={54} width={x1 - x0} height={roadBot - 54} fill={lane} />
      {seams}
      {depth > roadBot && (
        <g>
          <rect x={x0} y={roadBot} width={x1 - x0} height={16} fill={slabDeep} />
          <rect x={x0} y={roadBot + 16} width={x1 - x0} height={depth - roadBot} fill={water} />
          {ripples}
        </g>
      )}
      <line x1={x0} y1={0} x2={x1} y2={0} stroke={INK} strokeWidth={OUT} />
    </g>
  );
};

// ---------------- gate 城门 ----------------
const GateNear: React.FC<P> = ({p, t, c}) => {
  const stone = lit(OLD.stone, p);
  const brick: React.ReactNode[] = [];
  for (let r = 0; r < 7; r++) {
    const y = -300 + r * 40;
    brick.push(<line key={`h${r}`} x1={400} y1={y} x2={1500} y2={y} stroke={lit(OLD.stoneDeep, p)} strokeWidth={3} />);
    for (let bx = 400 + (r % 2) * 40; bx < 1500; bx += 80) brick.push(<line key={`v${r}${bx}`} x1={bx} y1={y} x2={bx} y2={y + 40} stroke={lit(OLD.stoneDeep, p)} strokeWidth={3} />);
  }
  const flag = (x: number, col: string, k: number) => {
    const wv = Math.sin(t * 5 + k) * 10;
    return (
      <g key={`f${k}`}>
        <line x1={x} y1={-330} x2={x} y2={-520} stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <path d={`M ${x},-516 Q ${x + 50},${-506 + wv} ${x + 100},${-500 + wv} L ${x + 94},${-452 + wv} Q ${x + 46},${-458 + wv} ${x},-466 Z`} fill={lit(col, p)} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      </g>
    );
  };
  const pillars = [790, 870, 950, 1030, 1110];
  return (
    <g>
      <OldHouse x={40} w={260} h={250} p={p} seed={71} lantern />
      <Willow x={335} p={p} t={t} s={0.95} />
      {/* 城墙 */}
      <rect x={400} y={-300} width={1100} height={300} fill={stone} stroke={INK} strokeWidth={OUT} />
      {brick}
      {Array.from({length: 22}, (_, i) => (
        <rect key={`cr${i}`} x={404 + i * 50} y={-330} width={30} height={32} fill={stone} stroke={INK} strokeWidth={3.5} />
      ))}
      {/* 拱门 */}
      <path d="M 850,0 L 850,-150 A 100 100 0 0 1 1050,-150 L 1050,0 Z" fill={lit('#233238', p)} stroke={INK} strokeWidth={OUT} />
      <path d="M 856,0 L 856,-150 A 94 94 0 0 1 900,-229 L 900,0 Z" fill={lit(c.main, p)} stroke={INK} strokeWidth={3.5} />
      <path d="M 1044,0 L 1044,-150 A 94 94 0 0 0 1000,-229 L 1000,0 Z" fill={lit(c.main, p)} stroke={INK} strokeWidth={3.5} />
      {[0, 1, 2].map((r) => [870, 884, 1016, 1030].map((x) => <circle key={`s${r}${x}`} cx={x} cy={-150 + r * 44} r={4} fill={lit('#E9B949', p)} />))}
      <rect x={895} y={-292} width={110} height={40} rx={4} fill={lit(c.accent, p)} stroke={lit('#E9B949', p)} strokeWidth={5} />
      {/* 城楼 */}
      <rect x={740} y={-352} width={420} height={24} fill={lit(OLD.stoneDeep, p)} stroke={INK} strokeWidth={OUT} />
      {pillars.map((x) => <rect key={x} x={x - 12} y={-452} width={24} height={102} fill={lit(c.main, p)} stroke={INK} strokeWidth={3.5} />)}
      {[0, 1, 2, 3].map((i) => <rect key={`lw${i}`} x={pillars[i] + 18} y={-440} width={44} height={70} fill={lit(OLD.woodLight, p)} stroke={INK} strokeWidth={3} />)}
      <rect x={760} y={-360} width={380} height={12} fill={lit(c.deep, p)} stroke={INK} strokeWidth={3} />
      <TileRoof x={760} y={-450} w={380} h={60} eave={56} p={p} />
      <rect x={840} y={-556} width={220} height={52} fill={lit(c.main, p)} stroke={INK} strokeWidth={OUT} />
      {[870, 930, 990].map((x) => <rect key={`uw${x}`} x={x} y={-548} width={40} height={36} fill={lit(OLD.woodLight, p)} stroke={INK} strokeWidth={3} />)}
      <TileRoof x={820} y={-556} w={260} h={56} eave={48} p={p} />
      {nightOf(p) > 0.1 && [800, 1100].map((x) => <Lantern key={`gl${x}`} x={x} y={-300} r={20} p={p} />)}
      {flag(470, c.accent, 1)}
      {flag(1420, c.main, 2)}
      <OldHouse x={1570} w={280} h={270} p={p} seed={72} lantern />
      <Willow x={1905} p={p} t={t} s={0.85} />
      <OldHouse x={1990} w={200} h={230} p={p} seed={73} horse={false} />
    </g>
  );
};

// ---------------- bridge 石桥 ----------------
const BridgeNear: React.FC<P> = ({p, t, c}) => {
  const n = nightOf(p);
  const water = mixHex(lit(OLD.water, p), '#0E3440', n * 0.5);
  const stone = lit(mixHex(OLD.stone, c.mid, 0.25), p);
  const boatX = 560 + ((t * 45) % 880);
  const arches = [
    {cx: 1000, r: 130, top: -170},
    {cx: 710, r: 88, top: -100},
    {cx: 1290, r: 88, top: -100},
  ];
  const deck = 'M 440,-24 Q 1000,-300 1560,-24';
  return (
    <g>
      <OldHouse x={30} w={250} h={260} p={p} seed={81} lantern />
      <OldHouse x={300} w={170} h={210} p={p} seed={82} horse={false} door={false} />
      {/* 河 */}
      <rect x={480} y={-16} width={1040} height={700} fill={water} />
      {Array.from({length: 7}, (_, i) => (
        <path key={`rp${i}`} d={`M ${520 + i * 140 + Math.sin(t * 1.4 + i) * 12},${30 + (i % 3) * 36} q 22,-10 44,0 q 22,10 44,0`} fill="none" stroke={mixHex(water, '#FFFFFF', 0.45)} strokeWidth={4} strokeLinecap="round" />
      ))}
      <rect x={460} y={-24} width={40} height={708} fill={lit(OLD.stoneDeep, p)} stroke={INK} strokeWidth={OUT} />
      <rect x={1500} y={-24} width={40} height={708} fill={lit(OLD.stoneDeep, p)} stroke={INK} strokeWidth={OUT} />
      {/* 倒影 */}
      {arches.map((a) => <ellipse key={`rf${a.cx}`} cx={a.cx} cy={20} rx={a.r * 0.9} ry={a.r * 0.35} fill={mixHex(water, INK, 0.25)} opacity={0.5} />)}
      {/* 乌篷船 */}
      <g transform={`translate(${boatX},10)`}>
        <path d="M -90,-10 Q 0,24 90,-10 L 76,-26 L -76,-26 Z" fill={lit(OLD.wood, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <path d="M -44,-26 Q -40,-74 0,-76 Q 40,-74 44,-26 Z" fill={lit(OLD.tile, p)} stroke={INK} strokeWidth={3.5} />
        <line x1={70} y1={-26} x2={120} y2={-90} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      </g>
      {/* 三孔石拱桥 */}
      <path
        d={`${deck} L 1560,0 L ${arches[2].cx + arches[2].r},0 A ${arches[2].r} ${arches[2].r} 0 0 0 ${arches[2].cx - arches[2].r},0 L ${arches[0].cx + arches[0].r},0 A ${arches[0].r} ${arches[0].r} 0 0 0 ${arches[0].cx - arches[0].r},0 L ${arches[1].cx + arches[1].r},0 A ${arches[1].r} ${arches[1].r} 0 0 0 ${arches[1].cx - arches[1].r},0 L 440,0 Z`}
        fill={stone}
        stroke={INK}
        strokeWidth={OUT}
        strokeLinejoin="round"
      />
      {arches.map((a) => <path key={`ar${a.cx}`} d={`M ${a.cx - a.r - 16},0 A ${a.r + 16} ${a.r + 16} 0 0 1 ${a.cx + a.r + 16},0`} fill="none" stroke={lit(OLD.stoneDeep, p)} strokeWidth={10} />)}
      <path d="M 452,-40 Q 1000,-322 1548,-40" fill="none" stroke={INK} strokeWidth={OUT} />
      {Array.from({length: 15}, (_, i) => {
        const u = (i + 0.5) / 15;
        const x = 452 + u * 1096;
        const y = -40 + (-322 + 40) * 2 * u * (1 - u) * 0.98;
        return <rect key={`rl${i}`} x={x - 8} y={y - 40} width={16} height={42} rx={4} fill={stone} stroke={INK} strokeWidth={3} />;
      })}
      <path d="M 452,-80 Q 1000,-362 1548,-80" fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <path d="M 452,-80 Q 1000,-362 1548,-80" fill="none" stroke={stone} strokeWidth={3} strokeLinecap="round" />
      {n > 0.1 && [600, 1400].map((x) => <Lantern key={`bl${x}`} x={x} y={-190} r={20} p={p} />)}
      <Willow x={560} p={p} t={t} s={0.85} />
      <Willow x={1600} p={p} t={t} s={0.95} />
      <OldHouse x={1680} w={260} h={280} p={p} seed={83} lantern />
      <OldHouse x={1960} w={220} h={230} p={p} seed={84} />
    </g>
  );
};

// ---------------- teahouse 茶馆 / 老铺 / 手作 ----------------
const TeahouseNear: React.FC<P> = ({p, t, c}) => {
  const wood = lit(OLD.wood, p);
  const woodL = lit(OLD.woodLight, p);
  const lattice = (x: number, y: number, w: number, h: number, k: string) => (
    <g key={k}>
      <rect x={x} y={y} width={w} height={h} fill={mixHex(woodL, '#FFD98A', nightOf(p) * 0.7)} stroke={INK} strokeWidth={3} />
      {Array.from({length: Math.floor(w / 18)}, (_, i) => <line key={`v${i}`} x1={x + 9 + i * 18} y1={y} x2={x + 9 + i * 18} y2={y + h} stroke={wood} strokeWidth={3} />)}
      {Array.from({length: Math.floor(h / 18)}, (_, i) => <line key={`h${i}`} x1={x} y1={y + 9 + i * 18} x2={x + w} y2={y + 9 + i * 18} stroke={wood} strokeWidth={3} />)}
    </g>
  );
  const wave = Math.sin(t * 3) * 6;
  const cloth = (x: number, k: number) => (
    <g key={`cl${k}`}>
      <path d={`M ${x},-300 L ${x + 90},-300 L ${x + 90 + wave * 0.4},-80 L ${x + wave * 0.4},-80 Z`} fill={lit(k % 2 ? '#2F5E9E' : '#3F74B8', p)} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      {[0, 1, 2].map((r) => <circle key={r} cx={x + 45 + wave * 0.2} cy={-250 + r * 60} r={14} fill="none" stroke={lit('#EAF1FA', p)} strokeWidth={5} />)}
    </g>
  );
  return (
    <g>
      <OldHouse x={40} w={230} h={240} p={p} seed={91} />
      {/* 竹子 */}
      {[300, 330, 362].map((x, i) => (
        <g key={`bb${x}`}>
          <rect x={x} y={-330 + i * 30} width={14} height={330 - i * 30} rx={6} fill={lit('#6DBE5A', p)} stroke={INK} strokeWidth={3} />
          <path d={`M ${x + 7},${-300 + i * 30} q 40,-10 54,-34 q -30,4 -54,34 M ${x + 7},${-220 + i * 30} q -40,-8 -50,-30 q 30,2 50,30`} fill={lit('#58A84A', p)} stroke={INK} strokeWidth={3} />
        </g>
      ))}
      {/* 两层木楼 */}
      <rect x={450} y={-236} width={600} height={236} fill={woodL} stroke={INK} strokeWidth={OUT} />
      {[450, 570, 690, 810, 930, 1050].map((x) => <rect key={`po${x}`} x={x - 10} y={-236} width={20} height={236} fill={wood} stroke={INK} strokeWidth={3} />)}
      {lattice(480, -206, 76, 120, 'l1')}
      {lattice(600, -206, 76, 120, 'l2')}
      <rect x={712} y={-150} width={76} height={150} fill={lit('#3A2A22', p)} stroke={INK} strokeWidth={3.5} />
      {lattice(830, -206, 76, 120, 'l3')}
      {lattice(950, -206, 76, 120, 'l4')}
      <TileRoof x={450} y={-236} w={600} h={34} eave={40} p={p} />
      <rect x={480} y={-410} width={540} height={150} fill={woodL} stroke={INK} strokeWidth={OUT} />
      {[500, 620, 740, 860].map((x, i) => lattice(x + 10, -390, 90, 100, `u${i}`))}
      <rect x={470} y={-290} width={560} height={26} fill={wood} stroke={INK} strokeWidth={3.5} />
      {Array.from({length: 18}, (_, i) => <line key={`rl${i}`} x1={482 + i * 31} y1={-290} x2={482 + i * 31} y2={-264} stroke={woodL} strokeWidth={4} />)}
      <TileRoof x={470} y={-410} w={560} h={70} eave={58} p={p} />
      <Lantern x={520} y={-190} r={24} p={p} on={Math.max(0.35, nightOf(p))} />
      <Lantern x={980} y={-190} r={24} p={p} on={Math.max(0.35, nightOf(p))} />
      {/* 布幌：茶杯图案 */}
      <line x1={1110} y1={0} x2={1110} y2={-540} stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <path d={`M 1116,-520 L 1196,-520 L ${1196 + wave},-300 L ${1116 + wave * 0.5},-300 Z`} fill={lit('#FFF6E4', p)} stroke={lit(c.accent, p)} strokeWidth={6} strokeLinejoin="round" />
      <g transform={`translate(${1156 + wave * 0.4},-410)`}>
        <path d="M -26,-18 L 26,-18 Q 24,22 0,24 Q -24,22 -26,-18 Z" fill={lit(c.main, p)} stroke={INK} strokeWidth={3.5} />
        <path d="M 24,-10 q 16,0 12,14 q -4,8 -14,6" fill="none" stroke={INK} strokeWidth={3.5} />
        <ellipse cx={0} cy={28} rx={32} ry={7} fill={lit(c.main, p)} stroke={INK} strokeWidth={3} />
        {[-10, 6].map((sx, i) => <path key={i} d={`M ${sx},-26 q -8,-12 0,-24 q 8,-12 0,-24`} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.6 + 0.4 * Math.sin(t * 3 + i)} />)}
      </g>
      {/* 晾布（蓝染） */}
      <line x1={1240} y1={-310} x2={1500} y2={-310} stroke={INK} strokeWidth={6} />
      {[1240, 1500].map((x) => <line key={`cp${x}`} x1={x} y1={-310} x2={x} y2={0} stroke={wood} strokeWidth={10} />)}
      {cloth(1262, 0)}
      {cloth(1372, 1)}
      {/* 茶桌 */}
      {[1580].map((x) => (
        <g key={`tb${x}`}>
          <rect x={x} y={-70} width={130} height={14} rx={4} fill={wood} stroke={INK} strokeWidth={3} />
          <path d={`M ${x + 14},-56 L ${x + 14},0 M ${x + 116},-56 L ${x + 116},0`} stroke={INK} strokeWidth={6} />
          <path d={`M ${x + 40},-70 q 0,-32 26,-32 q 26,0 26,32 Z`} fill={lit(c.main, p)} stroke={INK} strokeWidth={3} />
          <circle cx={x + 104} cy={-78} r={8} fill={lit('#FFF6E4', p)} stroke={INK} strokeWidth={2.5} />
        </g>
      ))}
      <OldHouse x={1760} w={250} h={260} p={p} seed={92} lantern />
      <Willow x={2100} p={p} t={t} s={0.8} />
    </g>
  );
};

// ---------------- lantern 灯会 / 夜市 ----------------
const LanternNear: React.FC<P> = ({p, t, gagT, c}) => {
  const n = nightOf(p);
  const g = gagT ?? -1;
  // 笑点前灯笼半亮；笑点起从左到右一盏盏亮透
  const onAt = (x: number) => (g < 0 ? 0.35 + 0.25 * n : Math.max(0.35 + 0.25 * n, Math.min(1, (g - (x - 200) / 2600) / 0.12)));
  const strand = (x0: number, x1: number, y: number, sag: number, k: string) => {
    const cnt = Math.floor((x1 - x0) / 80);
    const pts = Array.from({length: cnt}, (_, i) => {
      const u = (i + 0.5) / cnt;
      return [x0 + (x1 - x0) * u, y + Math.sin(u * Math.PI) * sag] as const;
    });
    return (
      <g key={k}>
        <path d={`M ${x0},${y} Q ${(x0 + x1) / 2},${y + sag * 2} ${x1},${y}`} fill="none" stroke={INK} strokeWidth={3} />
        {pts.map(([x, yy], i) => <Lantern key={i} x={x} y={yy + 34} r={20} p={p} on={onAt(x)} color={i % 3 === 1 ? c.accent : OLD.lantern} />)}
      </g>
    );
  };
  const post = lit(c.main, p);
  return (
    <g>
      {/* 牌楼 */}
      {[220, 400, 600, 780].map((x) => <rect key={`pl${x}`} x={x - 16} y={-420} width={32} height={420} fill={post} stroke={INK} strokeWidth={OUT} />)}
      <rect x={200} y={-420} width={600} height={40} fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} />
      <rect x={430} y={-500} width={140} height={60} fill={lit(c.accent, p)} stroke={INK} strokeWidth={OUT} />
      <TileRoof x={400} y={-500} w={200} h={52} eave={50} p={p} />
      <TileRoof x={200} y={-420} w={200} h={44} eave={40} p={p} />
      <TileRoof x={600} y={-420} w={200} h={44} eave={40} p={p} />
      {[310, 690].map((x) => <Lantern key={`pg${x}`} x={x} y={-320} r={26} p={p} on={onAt(x)} />)}
      <Lantern x={500} y={-340} r={34} p={p} on={onAt(500)} />
      {/* 灯笼串 */}
      {strand(820, 1560, -430, 50, 's1')}
      {strand(820, 1560, -300, 36, 's2')}
      {/* 摊位 */}
      {[880, 1180].map((x, i) => (
        <g key={`st${x}`}>
          <path d={`M ${x - 10},-120 L ${x + 250},-120`} stroke={INK} strokeWidth={4} />
          <rect x={x} y={-100} width={240} height={100} fill={lit(OLD.woodLight, p)} stroke={INK} strokeWidth={OUT} />
          <path d={`M ${x - 20},-210 L ${x + 260},-210 L ${x + 240},-150 L ${x},-150 Z`} fill={lit(i ? c.accent : c.main, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
          {[0, 1, 2, 3].map((k) => <circle key={k} cx={x + 40 + k * 54} cy={-112} r={16} fill={lit(NEON[(k + i) % NEON.length], p)} stroke={INK} strokeWidth={3} />)}
          <line x1={x + 4} y1={-150} x2={x + 4} y2={0} stroke={INK} strokeWidth={6} />
          <line x1={x + 236} y1={-150} x2={x + 236} y2={0} stroke={INK} strokeWidth={6} />
        </g>
      ))}
      {/* 大灯笼架 */}
      <path d="M 1480,0 L 1480,-470 L 1620,-470" fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
      <path d="M 1480,0 L 1480,-470 L 1620,-470" fill="none" stroke={lit(OLD.wood, p)} strokeWidth={8} strokeLinecap="round" />
      <Lantern x={1600} y={-360} r={56} p={p} on={onAt(1600)} />
      <OldHouse x={1700} w={260} h={280} p={p} seed={101} lantern />
      <OldHouse x={1990} w={200} h={240} p={p} seed={102} lantern />
    </g>
  );
};

export const OLDTOWN_NEAR = {gate: GateNear, bridge: BridgeNear, teahouse: TeahouseNear, lantern: LanternNear};
