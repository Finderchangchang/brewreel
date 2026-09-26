import React from 'react';
import {Mascot, SpeedLines} from '../art';
import type {MascotProps} from '../art';
import type {Expr} from './plan';

// ============================================================
// 角色 + 载具的接入层（Film 只认这里的 <Rider>，不直接引用 art/）。
// 正式角色来自 art/ 的 Mascot（吉祥物 + 悬浮滑板）；这里把风格的 11 种「剧情表情」翻译成美术的 pose / expr / fx。
// lean（道口下腰）只换姿态和表情，身体后仰的角度由 film.tsx 转整个角色。
// 接口：原点 (0,0) = 载具中心；size = 300 时角色身高约 190px；不画任何文字（版式探针会把文字当内容查）。
// 美术没交付或想对照时，把 USE_ART 改成 false 就回到下面的占位件。
// ============================================================
const USE_ART = true;
const ART: Record<Expr, Pick<MascotProps, 'pose' | 'expr' | 'fx'>> = {
  normal: {pose: 'cruise'},
  happy: {pose: 'cruise', expr: 'happy'},
  excited: {pose: 'excited'},
  surprised: {pose: 'surprised'},
  squash: {pose: 'squeeze'},
  relaxed: {pose: 'cruise', expr: 'happy', fx: 'sweat'},
  lean: {pose: 'surprised', expr: 'shock', fx: 'sweat'},
  offer: {pose: 'point', expr: 'smile'},
  curious: {pose: 'study'},
  pose: {pose: 'cheer'},
  wave: {pose: 'wave'},
};
export type RiderProps = {
  expr: Expr;
  /** 秒：驱动眨眼、挥手、火苗 */
  t: number;
  /** 总宽像素（默认 300） */
  size?: number;
  ink: string;
  brand: string;
  /** 额外压扁 0..1（落地、挤过去） */
  squash?: number;
};

const EYE_Y = -118;
const EYE_DX = 26;

const Eyes: React.FC<{expr: Expr; ink: string; t: number}> = ({expr, ink, t}) => {
  const sw = 6;
  const blink = expr === 'normal' && t % 3.2 > 3.05;
  const pair = (fn: (x: number) => React.ReactNode) => (
    <>
      {fn(-EYE_DX)}
      {fn(EYE_DX)}
    </>
  );
  switch (expr) {
    case 'happy':
    case 'relaxed':
    case 'wave':
      return pair((x) => <path key={x} d={`M${x - 11} ${EYE_Y + 4} Q${x} ${EYE_Y - 10} ${x + 11} ${EYE_Y + 4}`} stroke={ink} strokeWidth={sw} fill="none" strokeLinecap="round" />);
    case 'excited':
      return pair((x) => (
        <path key={x} d={starPath(x, EYE_Y, 15, 6.5)} fill="#FFAA3B" stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
      ));
    case 'surprised':
      return pair((x) => <circle key={x} cx={x} cy={EYE_Y} r={11} fill="#fff" stroke={ink} strokeWidth={sw - 1} />);
    case 'squash':
    case 'pose':
      return pair((x) => <path key={x} d={`M${x - 12} ${EYE_Y} L${x + 12} ${EYE_Y + (x < 0 ? -5 : 5) * 0}`} stroke={ink} strokeWidth={sw} strokeLinecap="round" />);
    default:
      return blink
        ? pair((x) => <path key={x} d={`M${x - 10} ${EYE_Y} L${x + 10} ${EYE_Y}`} stroke={ink} strokeWidth={sw} strokeLinecap="round" />)
        : pair((x) => <ellipse key={x} cx={x} cy={EYE_Y} rx={8} ry={10} fill={ink} />);
  }
};

const Mouth: React.FC<{expr: Expr; ink: string; brand: string}> = ({expr, ink, brand}) => {
  const y = EYE_Y + 30;
  switch (expr) {
    case 'surprised':
    case 'lean':
      return <ellipse cx={0} cy={y + 4} rx={9} ry={11} fill={ink} />;
    case 'excited':
    case 'happy':
    case 'wave':
    case 'pose':
      return <path d={`M-16 ${y - 2} Q0 ${y + 22} 16 ${y - 2} Z`} fill={brand} stroke={ink} strokeWidth={4} strokeLinejoin="round" />;
    case 'squash':
      return <path d={`M-14 ${y + 2} L14 ${y + 2}`} stroke={ink} strokeWidth={5} strokeLinecap="round" />;
    default:
      return <path d={`M-12 ${y} Q0 ${y + 12} 12 ${y}`} stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" />;
  }
};

export const starPath = (cx: number, cy: number, R: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
};

/** 手臂：从肩膀到手的折线 + 白圆手 */
const Arm: React.FC<{side: -1 | 1; pose: 'down' | 'up' | 'wave' | 'hold'; ink: string; t: number}> = ({side, pose, ink, t}) => {
  const sx = side * 50;
  const sy = -86;
  let hx = side * 74;
  let hy = -54;
  if (pose === 'up') {
    hx = side * 70;
    hy = -176;
  } else if (pose === 'wave') {
    const a = Math.sin(t * 14) * 0.45;
    hx = side * (66 + Math.sin(a) * 30);
    hy = -170 + Math.abs(Math.sin(a)) * 12;
  } else if (pose === 'hold') {
    hx = side * 40;
    hy = -40;
  }
  return (
    <g>
      <path d={`M${sx} ${sy} Q${(sx + hx) / 2 + side * 12} ${(sy + hy) / 2} ${hx} ${hy}`} stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" />
      <circle cx={hx} cy={hy} r={11} fill="#fff" stroke={ink} strokeWidth={4} />
    </g>
  );
};

const PlaceholderRider: React.FC<RiderProps> = ({expr, t, size = 300, ink, brand, squash = 0}) => {
  const sq = expr === 'squash' ? Math.max(squash, 0.8) : squash;
  const sx = 1 + 0.32 * sq;
  const sy = 1 - 0.4 * sq;
  const armsUp = expr === 'excited' || expr === 'pose' || expr === 'surprised';
  const flame = 0.8 + 0.2 * Math.sin(t * 40);
  const soot = false;
  return (
    <svg width={size} height={size * 0.95} viewBox="-150 -230 300 285" style={{position: 'absolute', left: -size / 2, top: -size * 0.95 * (230 / 285), overflow: 'visible'}}>
      {/* 滑板尾焰 */}
      <path d={`M-128 6 L${-128 - 46 * flame} 16 L-128 26 Z`} fill="#FFB547" stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
      {/* 身体（压扁时以滑板面为底） */}
      <g transform={`translate(0 -14) scale(${sx} ${sy}) translate(0 14)`}>
        <Arm side={-1} pose={expr === 'wave' ? 'wave' : armsUp ? 'up' : 'down'} ink={ink} t={t} />
        <Arm side={1} pose={armsUp ? 'up' : 'down'} ink={ink} t={t + 0.2} />
        <path d="M-62 -14 C-72 -70 -70 -150 0 -168 C70 -150 72 -70 62 -14 Z" fill={soot ? '#D8D2CB' : '#FFFDF8'} stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
        {/* 头顶小天线 */}
        <path d="M0 -168 L6 -198" stroke={ink} strokeWidth={4.5} strokeLinecap="round" />
        <circle cx={7} cy={-203} r={10} fill={brand} stroke={ink} strokeWidth={4} />
        <ellipse cx={-44} cy={-94} rx={11} ry={7} fill="#F3B6AE" opacity={soot ? 0.3 : 0.9} />
        <ellipse cx={44} cy={-94} rx={11} ry={7} fill="#F3B6AE" opacity={soot ? 0.3 : 0.9} />
        <Eyes expr={expr} ink={ink} t={t} />
        <Mouth expr={expr} ink={ink} brand={brand} />
        {soot
          ? [[-30, -70], [22, -60], [-8, -140], [38, -128], [-42, -120]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5 + (i % 2) * 3} fill={ink} opacity={0.75} />)
          : null}
      </g>
      {/* 悬浮滑板 */}
      <rect x={-130} y={-8} width={260} height={34} rx={17} fill="#fff" stroke={ink} strokeWidth={4.5} />
      <rect x={-96} y={2} width={120} height={14} rx={7} fill={brand} />
      <circle cx={70} cy={9} r={7} fill={ink} />
      <path d="M-70 34 q10 8 20 0 M40 34 q10 8 20 0" stroke={ink} strokeWidth={3.5} fill="none" strokeLinecap="round" opacity={0.5} />
    </svg>
  );
};

export const Rider: React.FC<RiderProps & {speed?: number; night?: number; facing?: 'left' | 'right'}> = (p) =>
  USE_ART ? (
    <>
      <SpeedLines x={-40} y={-8} t={p.t} amount={p.speed ?? 0.8} size={190} />
      <Mascot x={0} y={-8} size={190} t={p.t} vehicle="hoverboard" facing={p.facing ?? 'right'} speed={p.speed ?? 0.8} night={p.night ?? 0} squash={p.squash ?? 0} {...ART[p.expr]} />
    </>
  ) : (
    <PlaceholderRider {...p} />
  );

/** 载具中心到角色头顶的高度（像素，size=300 时），气泡定位用 */
export const RIDER_TOP = 205;
