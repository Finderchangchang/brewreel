// ============================================================
// quiz / art 骨架：角色部件坐标、手臂两段式 IK、姿态表、表情表。
// 角色坐标系：脚底中心 = (0, 600)，头顶约 y≈20，默认面朝右（3/4 侧脸）；facing='left' 时整体镜像。
// 线宽 SW=6（600 高时），和参考片的线宽 / 身高比一致；缩放后线宽等比变化。
// ============================================================

export type V = [number, number];

export const SW = 6;

/** 角色：host = 主讲人（栗色侧分短发 + 低马尾、头戴式耳机、暖橙运动夹克），buddy = 搭档（反戴棒球帽、墨绿条纹毛衣、沙色工装裤） */
export type Who = 'host' | 'buddy';

/** 姿态（手臂 + 身体） */
export const POSES = ['stand', 'talk', 'point', 'pointUp', 'peace', 'think', 'surprised', 'cheer', 'wave', 'shrug'] as const;
export type Pose = (typeof POSES)[number];

/** 表情（眼 + 眉 + 嘴 + 头部角度）；嘴型开合另由 mouth(0..1) 叠加 */
export const EXPRS = ['neutral', 'happy', 'surprised', 'thinking', 'wink', 'oops', 'smug'] as const;
export type Expr = (typeof EXPRS)[number];

export type HandKind = 'rest' | 'fist' | 'open' | 'point' | 'peace';

export type Spec = {
  shoulderL: V;
  shoulderR: V;
  L1: number;
  L2: number;
  armW: number;
  /** 下巴（思考姿势的手放这儿） */
  chin: V;
  /** 头部转轴（点头 / 歪头绕这里转） */
  neck: V;
  /** 头顶（特效挂点） */
  top: V;
  /** 面部中心 */
  face: V;
};

export const SPECS: Record<Who, Spec> = {
  host: {shoulderL: [-46, 230], shoulderR: [54, 230], L1: 84, L2: 80, armW: 26, chin: [14, 188], neck: [6, 194], top: [14, -22], face: [8, 122]},
  buddy: {shoulderL: [-58, 236], shoulderR: [66, 236], L1: 96, L2: 90, armW: 30, chin: [16, 186], neck: [8, 192], top: [8, -34], face: [8, 120]},
};

type ArmDef = {
  /** 手的目标位置：相对肩膀、按臂长（L1+L2）归一化，在「右臂坐标系」里写（左臂自动镜像） */
  to: V | ((s: Spec, side: 1 | -1) => V);
  /** 肘弯方向：+1 / -1（右臂坐标系） */
  bend: 1 | -1;
  hand: HandKind;
  /** 手指方向（度，绝对角，0=朝外，-90=朝上）；不写 = 顺着小臂 */
  handDeg?: number;
};

type PoseDef = {R: ArmDef; L: ArmDef; lean?: number};

const REST: ArmDef = {to: [0.12, 0.985], bend: -1, hand: 'rest'};

// 思考：手托下巴（按下巴位置算），另一只手横在肚子前托住手肘
const chinTo = (s: Spec, side: 1 | -1): V => {
  const S = side === 1 ? s.shoulderR : s.shoulderL;
  const reach = s.L1 + s.L2;
  // 右臂坐标系：实际 x = S.x + tx * side
  return [((s.chin[0] + 8 - S[0]) * side) / reach, (s.chin[1] + 16 - S[1]) / reach];
};

export const POSE_DEFS: Record<Pose, PoseDef> = {
  stand: {R: REST, L: REST},
  talk: {R: {to: [0.46, 0.4], bend: 1, hand: 'open', handDeg: -35}, L: REST},
  point: {R: {to: [0.95, -0.05], bend: 1, hand: 'point'}, L: REST},
  pointUp: {R: {to: [0.3, -0.9], bend: -1, hand: 'point', handDeg: -88}, L: REST},
  peace: {R: {to: [0.3, -0.56], bend: 1, hand: 'peace', handDeg: -84}, L: {to: [0.06, 0.47], bend: -1, hand: 'fist'}},
  think: {
    R: {to: chinTo, bend: -1, hand: 'fist', handDeg: -70},
    // 左臂：手放到下巴正下方、腰上一点（横过肚子）
    L: {to: (s) => [(s.shoulderL[0] - (s.chin[0] - 22)) / (s.L1 + s.L2), 84 / (s.L1 + s.L2)], bend: -1, hand: 'fist', handDeg: 10},
  },
  surprised: {R: {to: [0.42, -0.56], bend: 1, hand: 'open', handDeg: -80}, L: {to: [0.42, -0.56], bend: 1, hand: 'open', handDeg: -80}, lean: -3},
  cheer: {R: {to: [0.36, -0.92], bend: 1, hand: 'fist'}, L: {to: [0.36, -0.92], bend: 1, hand: 'fist'}},
  wave: {R: {to: [0.46, -0.62], bend: 1, hand: 'open', handDeg: -75}, L: REST},
  shrug: {R: {to: [0.6, 0.36], bend: 1, hand: 'open', handDeg: -10}, L: {to: [0.6, 0.36], bend: 1, hand: 'open', handDeg: -10}},
};

/** 两段式 IK：肩 S → 手 H，返回肘 E 和（夹紧后的）手 H */
export const ik = (S: V, H: V, L1: number, L2: number, bend: number): {E: V; H: V} => {
  let dx = H[0] - S[0];
  let dy = H[1] - S[1];
  let d = Math.hypot(dx, dy) || 0.001;
  const max = L1 + L2 - 0.5;
  const min = Math.abs(L1 - L2) + 2;
  if (d > max || d < min) {
    const k = (d > max ? max : min) / d;
    dx *= k;
    dy *= k;
    d = Math.hypot(dx, dy);
  }
  const cosA = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  const a = Math.acos(cosA);
  const base = Math.atan2(dy, dx);
  const ang = base + bend * a;
  return {E: [S[0] + Math.cos(ang) * L1, S[1] + Math.sin(ang) * L1], H: [S[0] + dx, S[1] + dy]};
};

export type ArmSolved = {S: V; E: V; H: V; hand: HandKind; handDeg: number; flip: boolean};

/** 解一条手臂。side：1 = 右臂（面朝方向那侧），-1 = 左臂。wave = 挥手摆角（度） */
export const solveArm = (who: Who, pose: Pose, side: 1 | -1, wave = 0): ArmSolved => {
  const s = SPECS[who];
  const def = side === 1 ? POSE_DEFS[pose].R : POSE_DEFS[pose].L;
  const S = side === 1 ? s.shoulderR : s.shoulderL;
  const reach = s.L1 + s.L2;
  const rel = typeof def.to === 'function' ? def.to(s, side) : def.to;
  // 右臂坐标系 → 实际：x 乘 side
  let tx = rel[0] * reach;
  let ty = rel[1] * reach;
  if (wave && side === 1) {
    const r = (wave * Math.PI) / 180;
    // 以肘附近为轴摆动：把目标绕肩膀上方一点转一下
    const cx = tx * 0.45;
    const cy = ty * 0.45;
    const ox = tx - cx;
    const oy = ty - cy;
    tx = cx + ox * Math.cos(r) - oy * Math.sin(r);
    ty = cy + ox * Math.sin(r) + oy * Math.cos(r);
  }
  const H: V = [S[0] + tx * side, S[1] + ty];
  const {E, H: H2} = ik(S, H, s.L1, s.L2, def.bend * side);
  const fore = (Math.atan2(H2[1] - E[1], H2[0] - E[0]) * 180) / Math.PI;
  let deg = fore;
  if (def.handDeg !== undefined) deg = side === 1 ? def.handDeg + wave * 0.6 : 180 - def.handDeg;
  return {S, E, H: H2, hand: def.hand, handDeg: deg, flip: side === -1};
};

/** 表情参数 */
export type Face = {
  eyes: 'dot' | 'happy' | 'wide' | 'look' | 'wink' | 'worried';
  brows: 'flat' | 'up' | 'high' | 'quirk' | 'worried' | 'down';
  mouth: 'smile' | 'flat' | 'hmm' | 'o' | 'grin' | 'wavy' | 'smirk';
  tilt: number;
  blush: number;
};

export const FACES: Record<Expr, Face> = {
  neutral: {eyes: 'dot', brows: 'flat', mouth: 'smile', tilt: 0, blush: 0.7},
  happy: {eyes: 'happy', brows: 'up', mouth: 'grin', tilt: 4, blush: 1},
  surprised: {eyes: 'wide', brows: 'high', mouth: 'o', tilt: -5, blush: 0.5},
  thinking: {eyes: 'look', brows: 'quirk', mouth: 'hmm', tilt: 7, blush: 0.5},
  wink: {eyes: 'wink', brows: 'up', mouth: 'grin', tilt: 5, blush: 1},
  oops: {eyes: 'worried', brows: 'worried', mouth: 'wavy', tilt: -3, blush: 0.4},
  smug: {eyes: 'dot', brows: 'down', mouth: 'smirk', tilt: 3, blush: 0.8},
};
