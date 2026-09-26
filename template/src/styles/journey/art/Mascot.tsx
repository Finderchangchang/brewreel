import React, {useId} from 'react';
import {BOARD, BoardColors, INK, MASCOT, MascotColors, PAPER_SHADOW, clamp01, mixHex, useArtColors} from './palette';
import {limbDir, ribbon, spark4, spiral, star5} from './shapes';

// ============================================================
// journey 吉祥物「橘团」：一只圆滚滚的小熊猫崽（原创设计），青绿围巾 + 环纹大尾巴，踩一块电光蓝悬浮滑板。
// 拆成部件：尾巴 / 腿 / 身体 / 围巾（颈圈 + 两条飘带）/ 耳朵 / 腮毛 / 头 / 眉斑 / 眼 / 鼻 / 嘴 / 腮红 / 手臂（上臂 + 前臂 + 爪）/ 道具 / 眼镜。
// 局部坐标（面朝右）：脚底 = (0, 0)，头顶耳尖 ≈ y -300；滑板在 y 0..60。朝左时整体镜像。
// 姿态 pose 决定手臂、身体、耳朵、尾巴；表情 expr 决定眼、嘴、眉；两者可以自由组合（pose 自带默认表情）。
// ============================================================

export const POSES = ['cruise', 'excited', 'surprised', 'think', 'wave', 'study', 'startled', 'spin', 'point', 'cheer', 'squeeze', 'dizzy'] as const;
export type Pose = (typeof POSES)[number];
export const EXPRS = ['smile', 'happy', 'excited', 'surprised', 'shock', 'thinking', 'focused', 'wink', 'dizzy', 'proud'] as const;
export type Expr = (typeof EXPRS)[number];
export const VEHICLES = ['hoverboard', 'none'] as const;
export type Vehicle = (typeof VEHICLES)[number];
export const MASCOT_FX = ['none', 'sweat', 'exclaim', 'question', 'sparkle', 'dizzy', 'smoke'] as const;
export type MascotFx = (typeof MASCOT_FX)[number];

type Arm = [number, number]; // [上臂角, 前臂相对角]，度；0 = 下垂，90 = 平伸向外，180 = 举过头顶
type PoseSpec = {
  L: Arm;
  R: Arm;
  lean: number; // 身体前倾（度，正 = 向前）
  tilt: number; // 歪头（度）
  ears: number; // 耳朵外张（度，负 = 竖起，正 = 耷拉）
  lift: number; // 离开滑板的高度
  stretch: number; // 纵向拉伸（负 = 压扁）
  tailPuff: number; // 尾巴炸毛倍数
  legs: 'stand' | 'tuck';
  expr: Expr;
  fx?: MascotFx;
  glasses?: boolean;
  hold?: 'clipboard';
};

const base: PoseSpec = {L: [18, 12], R: [22, 18], lean: 5, tilt: 0, ears: 0, lift: 0, stretch: 0, tailPuff: 1, legs: 'stand', expr: 'smile'};
export const POSE_SPECS: Record<Pose, PoseSpec> = {
  cruise: {...base},
  excited: {...base, L: [158, 18], R: [158, 18], lean: 0, ears: -8, expr: 'excited', fx: 'sparkle'},
  surprised: {...base, L: [118, 62], R: [118, 62], lean: -6, ears: -10, expr: 'surprised'},
  think: {...base, L: [30, 70], R: [150, 104], lean: 2, tilt: 7, expr: 'thinking', fx: 'question'},
  wave: {...base, L: [18, 14], R: [150, 20], lean: 2, tilt: -4, expr: 'happy'},
  study: {...base, L: [38, 92], R: [158, 130], lean: 4, tilt: 5, expr: 'focused', glasses: true, hold: 'clipboard'},
  startled: {...base, L: [140, -18], R: [140, -18], lean: -10, ears: -16, lift: 46, stretch: 0.12, tailPuff: 1.28, legs: 'tuck', expr: 'shock', fx: 'exclaim'},
  spin: {...base, L: [92, 0], R: [92, 0], lean: 0, expr: 'happy', fx: 'sparkle'},
  point: {...base, L: [16, 12], R: [96, -6], lean: 8, expr: 'smile'},
  cheer: {...base, L: [165, -30], R: [165, -30], lean: 0, ears: -6, lift: 10, expr: 'proud', fx: 'sparkle'},
  squeeze: {...base, L: [8, 4], R: [8, 4], lean: 0, ears: 14, stretch: -0.32, expr: 'shock', fx: 'sweat'},
  dizzy: {...base, L: [40, 30], R: [46, 40], lean: -4, tilt: -10, ears: 16, expr: 'dizzy', fx: 'dizzy'},
};

type EyeKind = 'dot' | 'happy' | 'closed' | 'star' | 'wide' | 'tiny' | 'look' | 'half' | 'spiral';
type MouthKind = 'w' | 'open' | 'o' | 'O' | 'shout' | 'flat' | 'hmm' | 'grin' | 'wavy';
type ExprSpec = {eyeL: EyeKind; eyeR: EyeKind; mouth: MouthKind; open?: number; brow: [number, number, number, number]; blush: number};
// brow = [左眉斑 dy, 左旋转, 右眉斑 dy, 右旋转]
export const EXPR_SPECS: Record<Expr, ExprSpec> = {
  smile: {eyeL: 'dot', eyeR: 'dot', mouth: 'w', brow: [0, 0, 0, 0], blush: 0.55},
  happy: {eyeL: 'happy', eyeR: 'happy', mouth: 'open', open: 0.75, brow: [-4, 0, -4, 0], blush: 0.75},
  excited: {eyeL: 'star', eyeR: 'star', mouth: 'open', open: 1, brow: [-9, -6, -9, 6], blush: 0.85},
  surprised: {eyeL: 'wide', eyeR: 'wide', mouth: 'o', brow: [-11, -4, -11, 4], blush: 0.3},
  shock: {eyeL: 'tiny', eyeR: 'tiny', mouth: 'shout', brow: [-16, -12, -16, 12], blush: 0},
  thinking: {eyeL: 'look', eyeR: 'look', mouth: 'hmm', brow: [-1, 6, -11, 14], blush: 0.35},
  focused: {eyeL: 'half', eyeR: 'half', mouth: 'flat', brow: [3, 14, 3, -14], blush: 0.3},
  wink: {eyeL: 'dot', eyeR: 'happy', mouth: 'open', open: 0.6, brow: [-3, 0, 1, -8], blush: 0.7},
  dizzy: {eyeL: 'spiral', eyeR: 'spiral', mouth: 'wavy', brow: [-3, 10, -3, -10], blush: 0.2},
  proud: {eyeL: 'closed', eyeR: 'closed', mouth: 'grin', brow: [2, -6, 2, 6], blush: 0.7},
};

export type MascotProps = {
  pose?: Pose;
  /** 覆盖 pose 自带的表情 */
  expr?: Expr;
  /** 全局秒数：驱动眨眼、飘带、尾巴、滑板喷口、挥手 */
  t?: number;
  /** 进入当前姿态后的秒数：驱动一次性动作（startled 的跳起、spin 的转圈），不传就用 t */
  poseT?: number;
  facing?: 'right' | 'left';
  vehicle?: Vehicle;
  /** 0..1 速度感：围巾飘带、喷口长度、速度线 */
  speed?: number;
  /** 0..1 嘴张合（说话），0 = 用表情自带嘴型 */
  talk?: number;
  /** 额外压扁（正）/ 拉长（负），叠加在姿态上，给 1–2 帧 squash 用 */
  squash?: number;
  /** 头顶特效；不传用姿态自带的，传 'none' 关掉 */
  fx?: MascotFx;
  /** 夜晚程度 0..1：喷口变成青色辉光，滑板前灯打光 */
  night?: number;
  /** 满脸黑灰（被烟熏的笑点） */
  sooty?: boolean;
  /** 眼镜（study 姿态自带） */
  glasses?: boolean;
  colors?: {mascot?: Partial<MascotColors>; board?: Partial<BoardColors>};
};

const SW = 5; // 角色描边
const sin = Math.sin;

// ---------------- 眼、嘴 ----------------
const Eye: React.FC<{kind: EyeKind; x: number; y: number; c: MascotColors; blink: boolean; side: number}> = ({kind, x, y, c, blink, side}) => {
  const k = blink && (kind === 'dot' || kind === 'look' || kind === 'half') ? 'closed' : kind;
  const line = {fill: 'none', stroke: INK, strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  switch (k) {
    case 'happy':
      return <path d={`M ${x - 12},${y + 4} Q ${x},${y - 13} ${x + 12},${y + 4}`} {...line} />;
    case 'closed':
      return <path d={`M ${x - 12},${y - 1} Q ${x},${y + 9} ${x + 12},${y - 1}`} {...line} />;
    case 'star':
      return (
        <g>
          <path d={star5(x, y, 17)} fill={c.star} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
          <circle cx={x - 3} cy={y - 4} r={3} fill="#fff" />
        </g>
      );
    case 'wide':
      return (
        <g>
          <circle cx={x} cy={y} r={15} fill="#fff" stroke={INK} strokeWidth={3.5} />
          <circle cx={x + 3} cy={y + 1} r={8} fill={INK} />
          <circle cx={x + 5} cy={y - 2} r={2.6} fill="#fff" />
        </g>
      );
    case 'tiny':
      return (
        <g>
          <circle cx={x} cy={y} r={16} fill="#fff" stroke={INK} strokeWidth={3.5} />
          <circle cx={x + 1} cy={y} r={4} fill={INK} />
        </g>
      );
    case 'look':
      return (
        <g>
          <ellipse cx={x + 4} cy={y - 5} rx={10} ry={12.5} fill={INK} />
          <circle cx={x + 7} cy={y - 10} r={3.6} fill="#fff" />
        </g>
      );
    case 'half':
      return (
        <g>
          <path d={`M ${x - 10},${y - 2} A 10 10 0 0 0 ${x + 10},${y - 2} Z`} fill={INK} />
          <path d={`M ${x - 14},${y - 3} L ${x + 13},${y - 3 - side * 2}`} {...line} />
        </g>
      );
    case 'spiral':
      return <path d={spiral(x, y, 14)} fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />;
    default:
      return (
        <g>
          <ellipse cx={x} cy={y} rx={10} ry={13} fill={INK} />
          <circle cx={x + 3} cy={y - 5} r={4} fill="#fff" />
          <circle cx={x - 3} cy={y + 5} r={1.8} fill="#fff" />
        </g>
      );
  }
};

const Mouth: React.FC<{kind: MouthKind; open: number}> = ({kind, open}) => {
  const line = {fill: 'none', stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const mx = 14;
  const my = -181;
  if (kind === 'open' || open > 0.05) {
    const o = Math.max(0.25, open || 0.8);
    const d = 8 + 20 * o;
    return (
      <g>
        <path d={`M ${mx},${my - 6} L ${mx},${my}`} {...line} />
        <path d={`M ${mx - 16},${my + 1} Q ${mx},${my + 5} ${mx + 16},${my + 1} Q ${mx + 14},${my + d} ${mx},${my + d + 1} Q ${mx - 14},${my + d} ${mx - 16},${my + 1} Z`} fill="#7A2330" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <ellipse cx={mx} cy={my + d - 4} rx={8} ry={Math.min(5, d / 4)} fill="#FF7F8E" />
      </g>
    );
  }
  switch (kind) {
    case 'o':
      return <ellipse cx={mx} cy={my + 9} rx={7} ry={9} fill="#7A2330" stroke={INK} strokeWidth={4} />;
    case 'O':
      return <ellipse cx={mx} cy={my + 11} rx={11} ry={14} fill="#7A2330" stroke={INK} strokeWidth={4} />;
    case 'shout':
      return (
        <g>
          <path d={`M ${mx - 20},${my + 2} Q ${mx},${my - 3} ${mx + 20},${my + 2} Q ${mx + 18},${my + 32} ${mx},${my + 33} Q ${mx - 18},${my + 32} ${mx - 20},${my + 2} Z`} fill="#7A2330" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d={`M ${mx - 15},${my + 4} L ${mx + 15},${my + 4} L ${mx + 14},${my + 10} L ${mx - 14},${my + 10} Z`} fill="#fff" />
        </g>
      );
    case 'flat':
      return <path d={`M ${mx - 9},${my + 8} L ${mx + 9},${my + 6}`} {...line} />;
    case 'hmm':
      return <path d={`M ${mx - 10},${my + 8} Q ${mx - 4},${my + 3} ${mx + 2},${my + 8} Q ${mx + 8},${my + 12} ${mx + 13},${my + 6}`} {...line} />;
    case 'grin':
      return (
        <g>
          <path d={`M ${mx},${my - 6} L ${mx},${my}`} {...line} />
          <path d={`M ${mx - 17},${my + 1} Q ${mx},${my + 18} ${mx + 19},${my - 1}`} {...line} />
        </g>
      );
    case 'wavy':
      return <path d={`M ${mx - 14},${my + 8} L ${mx - 7},${my + 3} L ${mx},${my + 9} L ${mx + 7},${my + 3} L ${mx + 14},${my + 8}`} {...line} />;
    default:
      return (
        <g>
          <path d={`M ${mx},${my - 6} L ${mx},${my}`} {...line} />
          <path d={`M ${mx - 13},${my + 2} Q ${mx - 6},${my + 11} ${mx},${my + 1} Q ${mx + 6},${my + 11} ${mx + 13},${my + 2}`} {...line} />
        </g>
      );
  }
};

// ---------------- 滑板 ----------------
export const Hoverboard: React.FC<{t: number; speed: number; night: number; c: BoardColors}> = ({t, speed, night, c}) => {
  const flick = 1 + sin(t * 37) * 0.12 + sin(t * 23) * 0.08;
  const jet = (22 + 26 * speed) * flick;
  const jetCol = mixHex(c.flameB, c.glow, night);
  const coreCol = mixHex(c.flameA, '#FFFFFF', night);
  const pods = [-80, 76];
  const flagWave = sin(t * 9) * 5;
  return (
    <g>
      {/* 喷口 */}
      {pods.map((px) => (
        <g key={px}>
          {night > 0.05 && <ellipse cx={px - 6} cy={70} rx={46} ry={18} fill={c.glow} opacity={0.28 * night} />}
          <path d={`M ${px - 16},${48} Q ${px - 22 - jet * 0.5},${58 + jet * 0.55} ${px - 10 - jet * 0.9},${54 + jet} Q ${px + 2},${58 + jet * 0.45} ${px + 16},${48} Z`} fill={jetCol} />
          <path d={`M ${px - 8},${48} Q ${px - 10 - jet * 0.3},${56 + jet * 0.35} ${px - 6 - jet * 0.55},${52 + jet * 0.62} Q ${px + 2},${55 + jet * 0.3} ${px + 8},${48} Z`} fill={coreCol} />
        </g>
      ))}
      {/* 尾鳍 + 小旗 */}
      <path d={`M -150,-40 L -150,-86`} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d={`M -150,-86 Q -126,${-80 + flagWave} -104,${-72 + flagWave * 1.4} Q -128,${-66 + flagWave} -150,-60 Z`} fill={c.flag} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M -128,6 L -162,-44 Q -168,-54 -156,-52 L -100,6 Z" fill={c.fin} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
      {/* 推进舱 */}
      {pods.map((px) => (
        <g key={`p${px}`}>
          <rect x={px - 28} y={20} width={56} height={32} rx={15} fill={c.pod} stroke={INK} strokeWidth={4.5} />
          <ellipse cx={px} cy={45} rx={16} ry={5} fill={mixHex(c.podDeep, c.glow, night)} stroke={INK} strokeWidth={3} />
        </g>
      ))}
      {/* 板面 */}
      <path d="M -146,2 L 112,2 Q 146,1 160,-22 Q 172,-6 162,10 Q 150,30 112,30 L -146,30 Q -164,30 -164,16 Q -164,2 -146,2 Z" fill={c.deck} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d="M -150,8 L 110,8 Q 136,7 150,-8" fill="none" stroke={c.deckLight} strokeWidth={5} strokeLinecap="round" />
      <path d="M -112,19 L 96,19" stroke={c.stripe} strokeWidth={5} strokeLinecap="round" />
      <path d="M 104,19 L 118,19" stroke={c.stripe} strokeWidth={5} strokeLinecap="round" />
      {/* 前灯 */}
      <circle cx={156} cy={8} r={6} fill={mixHex('#FFF6CC', '#FFEA5A', night)} stroke={INK} strokeWidth={3} />
      {night > 0.05 && <path d={`M 160,4 L 330,-24 L 330,52 Z`} fill="#FFF3B0" opacity={0.22 * night} />}
    </g>
  );
};

// ---------------- 头顶特效（不镜像：文字形状不能反） ----------------
const FxLayer: React.FC<{fx: MascotFx; t: number; side: number}> = ({fx, t, side}) => {
  const hx = side * 96;
  const hy = -268;
  if (fx === 'none') return null;
  if (fx === 'sweat') {
    const dy = (t * 40) % 20;
    return <path d={`M ${hx},${hy + dy} Q ${hx + side * 14},${hy + 22 + dy} ${hx},${hy + 30 + dy} Q ${hx - side * 14},${hy + 22 + dy} ${hx},${hy + dy} Z`} fill={MASCOT.sweat} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />;
  }
  if (fx === 'exclaim') {
    const s = 1 + Math.max(0, sin(t * 18)) * 0.12;
    return (
      <g transform={`translate(${hx + side * 20},${hy - 36}) rotate(${side * 12}) scale(${s})`}>
        <path d="M -9,-44 L 9,-44 L 5,6 L -5,6 Z" fill="#FF5A4E" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <circle cx={0} cy={22} r={8} fill="#FF5A4E" stroke={INK} strokeWidth={4} />
      </g>
    );
  }
  if (fx === 'question') {
    const b = sin(t * 4) * 4;
    return (
      <g transform={`translate(${hx + side * 18},${hy - 30 + b}) rotate(${side * 10})`}>
        <path d="M -16,-28 Q -16,-48 2,-48 Q 20,-48 20,-32 Q 20,-20 6,-14 Q 0,-11 0,-2" fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M -16,-28 Q -16,-48 2,-48 Q 20,-48 20,-32 Q 20,-20 6,-14 Q 0,-11 0,-2" fill="none" stroke="#FFEA5A" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={0} cy={16} r={7.5} fill="#FFEA5A" stroke={INK} strokeWidth={3.5} />
      </g>
    );
  }
  if (fx === 'sparkle') {
    const pts: [number, number, number, number][] = [
      [side * 118, -250, 16, 0],
      [side * -104, -268, 12, 1.3],
      [side * 136, -176, 10, 2.1],
      [side * -120, -150, 9, 0.7],
    ];
    return (
      <g>
        {pts.map(([x, y, r, ph], i) => {
          const s = 0.55 + 0.45 * Math.abs(sin(t * 5 + ph));
          return <path key={i} d={spark4(x, y, r * s * 1.3)} fill="#FFEA5A" stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
        })}
      </g>
    );
  }
  if (fx === 'dizzy') {
    return (
      <g>
        {[0, 1, 2].map((i) => {
          const a = t * 5 + (i * Math.PI * 2) / 3;
          const x = 6 + Math.cos(a) * 70;
          const y = -300 + Math.sin(a) * 16;
          return <path key={i} d={star5(x, y, 13)} fill="#FFEA5A" stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
        })}
      </g>
    );
  }
  // smoke：头顶冒三团灰烟
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const p = ((t * 0.9 + i / 3) % 1 + 1) % 1;
        return <circle key={i} cx={side * (20 + i * 16) + sin(t * 3 + i) * 8} cy={-300 - p * 90} r={10 + p * 16} fill="#8B8F9E" opacity={0.85 * (1 - p)} stroke={INK} strokeWidth={3} />;
      })}
    </g>
  );
};

// ---------------- 角色本体 ----------------
/** SVG 组：放进别的 <svg> 里用。局部坐标见文件头；返回的是朝向、姿态都处理好的整组 */
export const MascotG: React.FC<MascotProps> = (props) => {
  const art = useArtColors();
  const c: MascotColors = {...art.mascot, ...(props.colors?.mascot ?? {})};
  const bc: BoardColors = {...art.board, ...(props.colors?.board ?? {})};
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = props.t ?? 0;
  const pt = props.poseT ?? t;
  const pose = props.pose ?? 'cruise';
  const P = POSE_SPECS[pose];
  const E = EXPR_SPECS[props.expr ?? P.expr];
  const side = props.facing === 'left' ? -1 : 1;
  const speed = clamp01(props.speed ?? 0.7);
  const night = clamp01(props.night ?? 0);
  const vehicle = props.vehicle ?? 'hoverboard';
  const fx = props.fx ?? P.fx ?? 'none';

  // 一次性动作
  let lift = P.lift;
  let stretch = P.stretch + (props.squash ? -props.squash * 0.35 : 0);
  let spinX = 1;
  if (pose === 'startled') {
    const k = clamp01(pt / 0.5);
    lift = P.lift * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 8;
    stretch = pt < 0.08 ? -0.18 : P.stretch * (1 - k * 0.5);
  }
  if (pose === 'excited') lift = Math.abs(sin(pt * Math.PI * 2.4)) * 22;
  if (pose === 'spin') {
    spinX = Math.cos(pt * Math.PI * 2 * 1.25);
    if (Math.abs(spinX) < 0.1) spinX = spinX < 0 ? -0.1 : 0.1;
    lift = Math.abs(sin(pt * Math.PI * 1.25)) * 18;
  }
  const back = spinX < 0;
  const breathe = sin(t * Math.PI) * 0.015;
  const sy = 1 + stretch + breathe;
  const sx = 1 - stretch * 0.7 - breathe * 0.5;

  // 眨眼：约每 3.1 秒一次，0.1 秒
  const blink = (t + 0.7) % 3.1 < 0.1;

  // 手臂
  const sway = sin(t * Math.PI) * 5;
  const armL: Arm = [P.L[0] + (pose === 'cruise' ? sway : 0), P.L[1]];
  let armR: Arm = [P.R[0] - (pose === 'cruise' ? sway : 0), P.R[1]];
  if (pose === 'wave') armR = [P.R[0], P.R[1] + sin(pt * Math.PI * 4) * 30];
  if (pose === 'excited' || pose === 'cheer') armR = [P.R[0] + sin(pt * 12) * 6, P.R[1]];
  const U = 32;
  const F = 30;
  const armPts = (sh: [number, number], a: Arm, s: number) => {
    const d1 = limbDir(a[0], s);
    const e: [number, number] = [sh[0] + d1[0] * U, sh[1] + d1[1] * U];
    const d2 = limbDir(a[0] + a[1], s);
    const h: [number, number] = [e[0] + d2[0] * F, e[1] + d2[1] * F];
    return {sh, e, h};
  };
  const aL = armPts([-44, -118], armL, -1);
  const aR = armPts([46, -118], armR, 1);

  // 腿
  const legs = P.legs === 'tuck' ? {l: [-24, -54, -30, -22], r: [28, -54, 36, -26]} : {l: [-22, -54, -24, -10], r: [26, -54, 30, -10]};

  // 尾巴
  const tailRot = sin(t * 2.4) * 5 + (pose === 'startled' ? -10 : 0);
  const tail = 'M -36,-58 C -92,-50 -160,-82 -158,-150 C -156,-202 -128,-232 -98,-226 C -74,-220 -68,-196 -82,-184 C -100,-170 -106,-132 -82,-112 C -68,-102 -52,-100 -36,-100 Z';

  // 围巾飘带
  const tails = [0, 1].map((k) => {
    const n = 9;
    const len = k === 0 ? 15 : 12.5;
    const droop = 0.9 - speed * 0.75; // 0.15..0.9 rad 往下垂
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + droop * -1 * (0.5 + i / n);
      const wave = sin(t * (8 + speed * 6) - i * 0.8 + k * 1.3) * i * (0.8 + speed * 1.6);
      const x0 = -40 + Math.cos(a) * i * len;
      const y0 = -118 + k * 12 + Math.sin(a) * i * len + wave;
      pts.push([x0, y0]);
    }
    return pts;
  });

  // 眉斑
  const [bLy, bLr, bRy, bRr] = E.brow;
  const tilt = P.tilt;
  const earL = -22 - P.ears;
  const earR = 22 + P.ears;
  const face = !back;
  const soot = props.sooty;
  const glasses = props.glasses ?? P.glasses;

  const limbLine = (a: [number, number], b: [number, number], w: number, col: string, key: string) => (
    <g key={key}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK} strokeWidth={w + SW * 2} strokeLinecap="round" />
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={col} strokeWidth={w} strokeLinecap="round" />
    </g>
  );
  const arm = (p: ReturnType<typeof armPts>, key: string) => (
    <g key={key}>
      <line x1={p.sh[0]} y1={p.sh[1]} x2={p.e[0]} y2={p.e[1]} stroke={INK} strokeWidth={24 + SW * 2} strokeLinecap="round" />
      <line x1={p.e[0]} y1={p.e[1]} x2={p.h[0]} y2={p.h[1]} stroke={INK} strokeWidth={24 + SW * 2} strokeLinecap="round" />
      <line x1={p.sh[0]} y1={p.sh[1]} x2={p.e[0]} y2={p.e[1]} stroke={c.limb} strokeWidth={24} strokeLinecap="round" />
      <line x1={p.e[0]} y1={p.e[1]} x2={p.h[0]} y2={p.h[1]} stroke={c.limb} strokeWidth={24} strokeLinecap="round" />
      <circle cx={p.h[0]} cy={p.h[1]} r={15} fill={c.limb} stroke={INK} strokeWidth={SW} />
      <circle cx={p.h[0] + 3} cy={p.h[1] - 3} r={4} fill={mixHex(c.limb, '#FFFFFF', 0.25)} />
    </g>
  );

  const ear = (x: number, y: number, rot: number, key: string) => (
    <g key={key} transform={`translate(${x},${y}) rotate(${rot})`}>
      <path d="M -32,20 C -36,-8 -22,-42 0,-44 C 22,-42 36,-8 32,20 Z" fill={c.fur} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      {face && <path d="M -18,16 C -20,-2 -12,-24 0,-26 C 12,-24 20,-2 18,16 Z" fill={c.cream} />}
    </g>
  );

  const clipId = `tail${uid}`;
  const riderLift = -lift;
  const bodyT = `translate(0,${riderLift}) rotate(${P.lean * (vehicle === 'none' ? 0.5 : 1)},0,-40) scale(${sx},${sy})`;

  const character = (
    <g transform={bodyT}>
      {/* 尾巴（背面视角时画在身体前面，见下） */}
      {!back && (
        <g transform={`rotate(${tailRot},-40,-80) translate(-40,-80) scale(${P.tailPuff}) translate(40,80)`}>
          <path d={tail} fill={c.fur} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <g clipPath={`url(#${clipId})`}>
            <line x1={-86} y1={-36} x2={-80} y2={-118} stroke={c.limb} strokeWidth={20} />
            <line x1={-184} y1={-104} x2={-96} y2={-140} stroke={c.limb} strokeWidth={20} />
            <line x1={-150} y1={-212} x2={-80} y2={-190} stroke={c.limb} strokeWidth={22} />
          </g>
          <path d={tail} fill="none" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        </g>
      )}
      {/* 腿 */}
      {limbLine([legs.l[0], legs.l[1]], [legs.l[2], legs.l[3]], 28, c.limb, 'll')}
      {limbLine([legs.r[0], legs.r[1]], [legs.r[2], legs.r[3]], 28, c.limb, 'lr')}
      <ellipse cx={legs.l[2] + 4} cy={legs.l[3] + 2} rx={21} ry={11} fill={c.limb} stroke={INK} strokeWidth={SW} />
      <ellipse cx={legs.r[2] + 6} cy={legs.r[3] + 2} rx={21} ry={11} fill={c.limb} stroke={INK} strokeWidth={SW} />
      {/* 围巾飘带（在身体后面） */}
      {tails.map((pts, k) => (
        <g key={`st${k}`}>
          <path d={ribbon(pts, 26, 20)} fill={k === 0 ? c.scarf : c.scarfDeep} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          {[3, 6].map((i) => {
            const a = pts[i];
            const b = pts[i + 1];
            return <line key={i} x1={(a[0] * 2 + b[0]) / 3} y1={(a[1] * 2 + b[1]) / 3} x2={(a[0] + b[0] * 2) / 3} y2={(a[1] + b[1] * 2) / 3} stroke={c.scarfStripe} strokeWidth={17} opacity={0.95} />;
          })}
        </g>
      ))}
      {/* 身体 */}
      <path d="M -46,-146 C -60,-118 -66,-76 -58,-50 C -50,-30 50,-30 58,-50 C 66,-76 60,-118 46,-146 Z" fill={c.fur} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <ellipse cx={face ? 6 : 0} cy={-76} rx={30} ry={28} fill={face ? c.furLight : c.fur} />
      {/* 围巾颈圈 + 结 */}
      <path d="M -56,-140 Q 2,-120 60,-140 L 62,-112 Q 2,-92 -58,-112 Z" fill={c.scarf} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
      <path d="M -40,-124 L -40,-104 M -8,-118 L -8,-98 M 24,-120 L 24,-100" stroke={c.scarfStripe} strokeWidth={8} opacity={0.9} />
      {face && <path d="M 30,-114 L 26,-72 Q 38,-68 50,-74 L 48,-116 Z" fill={c.scarfDeep} stroke={INK} strokeWidth={4} strokeLinejoin="round" />}
      {/* 道具：写字板（study） */}
      {P.hold === 'clipboard' && face && (
        <g transform="translate(6,-84) rotate(-8)">
          <rect x={-34} y={-40} width={68} height={82} rx={8} fill="#B07A4E" stroke={INK} strokeWidth={4.5} />
          <rect x={-26} y={-30} width={52} height={64} rx={4} fill={c.clip} />
          <rect x={-14} y={-46} width={28} height={14} rx={5} fill="#AEB8CC" stroke={INK} strokeWidth={3.5} />
          <path d="M -18,-14 L 18,-14 M -18,0 L 14,0 M -18,14 L 8,14" stroke="#9AA3B8" strokeWidth={5} strokeLinecap="round" />
          <path d="M 4,20 L 10,27 L 22,12" fill="none" stroke="#2DAA5F" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {/* 头 */}
      <g transform={`rotate(${tilt},4,-130)`}>
        {ear(-56, -262, earL, 'el')}
        {ear(68, -262, earR, 'er')}
        <path d="M -76,-196 L -100,-156 L -62,-164 Z" fill={c.fur} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M 88,-196 L 108,-158 L 76,-164 Z" fill={c.fur} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        <ellipse cx={6} cy={-204} rx={90} ry={78} fill={c.fur} stroke={INK} strokeWidth={SW} />
        {face && (
          <g>
            {/* 泪痕纹 */}
            <path d="M -30,-202 Q -42,-180 -32,-158" fill="none" stroke={c.furDeep} strokeWidth={11} strokeLinecap="round" />
            <path d="M 58,-202 Q 68,-180 58,-158" fill="none" stroke={c.furDeep} strokeWidth={11} strokeLinecap="round" />
            {/* 口鼻白斑 */}
            <ellipse cx={13} cy={-170} rx={46} ry={32} fill={c.cream} />
            {/* 眉斑 */}
            <ellipse cx={-20} cy={-243 + bLy} rx={17} ry={9} fill={c.cream} transform={`rotate(${bLr},-20,${-243 + bLy})`} />
            <ellipse cx={48} cy={-243 + bRy} rx={17} ry={9} fill={c.cream} transform={`rotate(${bRr},48,${-243 + bRy})`} />
            {/* 腮红 */}
            {E.blush > 0 && (
              <g opacity={E.blush}>
                <ellipse cx={-48} cy={-182} rx={13} ry={8} fill={c.blush} />
                <ellipse cx={80} cy={-182} rx={12} ry={8} fill={c.blush} />
              </g>
            )}
            {/* 眼 */}
            <Eye kind={E.eyeL} x={-18} y={-214} c={c} blink={blink} side={-1} />
            <Eye kind={E.eyeR} x={46} y={-214} c={c} blink={blink} side={1} />
            {/* 鼻 */}
            <path d="M 3,-196 Q 14,-202 25,-196 Q 21,-186 14,-185 Q 7,-186 3,-196 Z" fill={INK} />
            <Mouth kind={E.mouth} open={props.talk ?? (E.mouth === 'open' ? E.open ?? 0.8 : 0)} />
            {/* 烟熏黑点 */}
            {soot && (
              <g fill="#3A3A44" opacity={0.85}>
                <circle cx={-52} cy={-236} r={9} />
                <circle cx={70} cy={-248} r={7} />
                <circle cx={-6} cy={-266} r={6} />
                <circle cx={86} cy={-206} r={8} />
                <circle cx={-62} cy={-204} r={6} />
              </g>
            )}
            {/* 眼镜 */}
            {glasses && (
              <g>
                <rect x={-42} y={-232} width={46} height={36} rx={10} fill="#FFFFFF" fillOpacity={0.28} stroke={c.glasses} strokeWidth={5.5} />
                <rect x={24} y={-232} width={46} height={36} rx={10} fill="#FFFFFF" fillOpacity={0.28} stroke={c.glasses} strokeWidth={5.5} />
                <path d="M 4,-216 Q 14,-222 24,-216" fill="none" stroke={c.glasses} strokeWidth={5} />
                <path d="M -42,-220 L -76,-228 M 70,-220 L 90,-226" stroke={c.glasses} strokeWidth={5} strokeLinecap="round" />
                <path d="M -32,-202 L -18,-226 M 34,-202 L 48,-226" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
              </g>
            )}
          </g>
        )}
      </g>
      {/* 背面视角：尾巴在前 */}
      {back && (
        <g transform={`rotate(${tailRot},-40,-80) translate(-40,-80) scale(${P.tailPuff}) translate(40,80)`}>
          <path d={tail} fill={c.fur} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <g clipPath={`url(#${clipId})`}>
            <line x1={-86} y1={-36} x2={-80} y2={-118} stroke={c.limb} strokeWidth={20} />
            <line x1={-184} y1={-104} x2={-96} y2={-140} stroke={c.limb} strokeWidth={20} />
            <line x1={-150} y1={-212} x2={-80} y2={-190} stroke={c.limb} strokeWidth={22} />
          </g>
          <path d={tail} fill="none" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        </g>
      )}
      {/* 手臂（在头前面，托腮、推眼镜才对得上） */}
      {arm(aL, 'al')}
      {arm(aR, 'ar')}
    </g>
  );

  const tiltBoard = vehicle === 'hoverboard' ? sin(t * 2.2) * 2.2 : 0;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={tail} />
        </clipPath>
      </defs>
      <g transform={`rotate(${tiltBoard * side},0,20)`}>
        <g transform={`scale(${side},1)`}>{vehicle === 'hoverboard' && <Hoverboard t={t} speed={speed} night={night} c={bc} />}</g>
        <g transform={`scale(${side * spinX},1)`}>{character}</g>
      </g>
      <g transform={`translate(0,${riderLift})`}>
        <FxLayer fx={fx} t={t} side={side} />
      </g>
    </g>
  );
};

/** 画布范围（局部坐标）：给 HTML 包装和外部 svg 算 viewBox 用 */
export const MASCOT_BOX = {x0: -300, y0: -440, x1: 360, y1: 150};
/** 角色身高（脚底到耳尖）在局部坐标里的值；size 按它换算 */
export const MASCOT_HEIGHT = 300;

/** HTML 层：(x, y) = 滑板面（脚底）中心的屏幕像素，size = 角色身高像素（不含滑板） */
export const Mascot: React.FC<MascotProps & {x: number; y: number; size?: number; style?: React.CSSProperties}> = ({x, y, size = 300, style, ...rest}) => {
  const k = size / MASCOT_HEIGHT;
  const b = MASCOT_BOX;
  const w = (b.x1 - b.x0) * k;
  const h = (b.y1 - b.y0) * k;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`${b.x0} ${b.y0} ${b.x1 - b.x0} ${b.y1 - b.y0}`}
      style={{position: 'absolute', left: x + b.x0 * k, top: y + b.y0 * k, overflow: 'visible', ...style}}
    >
      {/* 剪纸分层：角色也在身后投一道往右下错开的硬边纸影，和城市三层同一套光 */}
      <defs>
        <filter id={`jmascot-paper-${Math.round((rest.night ?? 0) * 10)}`} filterUnits="userSpaceOnUse" x={b.x0 - 40} y={b.y0 - 40} width={b.x1 - b.x0 + 80} height={b.y1 - b.y0 + 80} colorInterpolationFilters="sRGB">
          <feFlood floodColor={PAPER_SHADOW} floodOpacity={0.26 * (1 - (rest.night ?? 0) * 0.4)} result="c" />
          <feComposite in="c" in2="SourceAlpha" operator="in" result="s" />
          <feOffset in="s" dx={11} dy={9} result="o" />
          <feMerge>
            <feMergeNode in="o" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#jmascot-paper-${Math.round((rest.night ?? 0) * 10)})`}>
        <MascotG {...rest} />
      </g>
    </svg>
  );
};

/** 速度线（画在角色身后，屏幕坐标）：n 条白线往左拖 */
export const SpeedLines: React.FC<{x: number; y: number; t: number; amount?: number; color?: string; size?: number}> = ({x, y, t, amount = 1, color = '#FFFFFF', size = 300}) => {
  if (amount <= 0.02) return null;
  const k = size / MASCOT_HEIGHT;
  const rows = [-210, -150, -80, 10, 60];
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      {rows.map((ry, i) => {
        const p = ((t * 2.2 + i * 0.37) % 1 + 1) % 1;
        const len = (90 + (i % 3) * 50) * k * amount;
        const x0 = x - (170 + p * 260) * k;
        return <line key={i} x1={x0} y1={y + ry * k} x2={x0 - len} y2={y + ry * k} stroke={color} strokeWidth={7 * k} strokeLinecap="round" opacity={(1 - p) * 0.9 * amount} />;
      })}
    </svg>
  );
};

export {BOARD, MASCOT};
