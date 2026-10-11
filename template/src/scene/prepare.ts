// 渲染前的数据准备。纯函数：屏 → 块、拍点出场、曲线参数。不读文件，不画。
// 第 0 帧必须已经有主文案，所以每屏第一块的 showAt 压到 0；其余块仍用 revealFromBeats 的拍点。
// 次文字只标成落在卡片上。低于 4.5 的前景会调深，本轮三支预设的卡片对已经过线，调深不会触发。
import {contrastRatio} from './contrast.ts';
import {layoutBlocks} from './geom.ts';
import {curveOf} from './motion.ts';
import {revealFromBeats} from './time.ts';
import type {SceneFrame} from './safe-box.ts';
import type {BeatReveal} from './time.ts';
import type {Align, FontFloor, MotionName, SceneFile, SceneScreen, TokenRoles} from './types.ts';

const FPS = 30;
const FONT_STACK = '"PSans", "Noto Sans SC", "Microsoft YaHei UI", sans-serif';

export type PlanBlock = {
  text: string;
  note?: string;
  emphasis?: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  font: number;
  noteFont: number;
  role: 'main' | 'item' | 'support';
  index: number;
  align: Align;
  textAlign: Align;
  /** 秒，相对本屏。第一块是 0，其余等于拍点。 */
  showAt: number;
  mark: boolean;
};

export type PlanCurve = {
  action: 'enter';
  motion: MotionName;
  duration: number;
  durationRange: [number, number];
  overshootPx: number;
  overshootDeg: number;
  up?: number;
  down?: number;
};

export type PlanScreen = {
  index: number;
  role: string;
  layout: 'hero' | 'stack' | 'split' | 'end';
  start: number;
  duration: number;
  startFrame: number;
  durationFrames: number;
  reveal: BeatReveal;
  curve: PlanCurve;
  blocks: PlanBlock[];
};

export type ContrastRow = {
  pair: string;
  fg: string;
  bg: string;
  ratio: number;
  /** 这一对会不会真的画上去。muted/bg 只记录，不画。 */
  painted: boolean;
  adjusted: boolean;
};

export type ScenePlan = {
  fps: number;
  width: number;
  height: number;
  durationSec: number;
  durationFrames: number;
  product: SceneFile['product'];
  aspect: SceneFile['aspect'];
  style: string;
  motion: MotionName;
  align: Align;
  roles: TokenRoles;
  fontFamily: string;
  cardBorder: string;
  /** 渐变只取令牌里的 bgTop / bgBot。没有这两项时上下都是 bg。 */
  backdrop: {top: string; bottom: string};
  safe: {x: number; y: number; w: number; h: number};
  floor: FontFloor;
  paint: {ink: string; muted: string; surface: string; inkAdjusted: boolean; mutedAdjusted: boolean};
  contrast: ContrastRow[];
  screens: PlanScreen[];
};

export type Pose = {y: number; scale: number; tilt: number; opacity: number};

type Piece = {text: string; note?: string; emphasis?: string[]; role: PlanBlock['role']};

export function hanziCount(text: string): number {
  return [...text].filter((ch) => /[\u3400-\u9fff]/.test(ch)).length;
}

export function glyphCount(text: string): number {
  return [...text.replace(/\s/g, '')].length || 1;
}

/** 收成 claim 的 hero、points 的 stack、compare 的 split，再加片尾。文案字段原样留下。 */
export function protoScene<T extends SceneFile>(scene: T): T {
  const screens: SceneScreen[] = [];
  for (const screen of scene.screens ?? []) {
    if (screen.role === 'claim') screens.push(screen);
    else if (screen.role === 'points') screens.push({...screen, layout: 'stack'});
    else if (screen.role === 'compare') screens.push(screen.layout === 'split' ? screen : {...screen, layout: 'split'});
    else if (screen.role === 'action' || screen.layout === 'end') screens.push({...screen, layout: 'end'});
  }
  return {...scene, screens};
}

function piecesOf(screen: SceneScreen, layout: PlanScreen['layout']): Piece[] {
  if (layout === 'end') {
    const pieces: Piece[] = [];
    if (screen.brand) pieces.push({text: screen.brand, role: 'main'});
    if (screen.line) pieces.push({text: screen.line, role: 'support'});
    if (screen.cta) pieces.push({text: screen.cta, role: 'support'});
    return pieces.length ? pieces : [{text: screen.text || screen.title || '片尾', role: 'main'}];
  }
  if (screen.left && screen.right) {
    const left = [screen.left.label, ...screen.left.items];
    const right = [screen.right.label, ...screen.right.items];
    return [...left, ...right].filter((text) => typeof text === 'string' && text.trim()).map((text, index) => ({
      text,
      role: index === 0 ? 'main' : 'item',
    }));
  }
  if (screen.items?.length) {
    return screen.items.map((item, index) => ({
      text: item.text,
      note: item.note,
      role: index === 0 ? 'main' : 'item',
    }));
  }
  const pieces: Piece[] = [];
  const headline = screen.number?.text || screen.text || screen.title;
  if (headline) pieces.push({text: headline, emphasis: screen.emphasis, role: 'main'});
  const support = screen.number?.label || screen.support;
  if (support) pieces.push({text: support, role: 'support'});
  return pieces.length ? pieces : [{text: ' ', role: 'main'}];
}

export function ensureContrast(fg: string, bg: string, min = 4.5): {color: string; ratio: number; adjusted: boolean} {
  let color = fg.toUpperCase();
  let ratio = contrastRatio(color, bg);
  if (ratio >= min) return {color, ratio, adjusted: false};
  let packed = parseInt(color.slice(1), 16);
  for (let step = 0; step < 24 && ratio < min; step++) {
    let r = (packed >> 16) & 255;
    let g = (packed >> 8) & 255;
    let b = packed & 255;
    r = Math.max(0, Math.round(r * 0.82));
    g = Math.max(0, Math.round(g * 0.82));
    b = Math.max(0, Math.round(b * 0.82));
    packed = (r << 16) | (g << 8) | b;
    color = `#${packed.toString(16).padStart(6, '0').toUpperCase()}`;
    ratio = contrastRatio(color, bg);
  }
  return {color, ratio, adjusted: color !== fg.toUpperCase()};
}

function curveParams(motion: MotionName, height: number): PlanCurve {
  const curve = curveOf('enter', motion, height);
  return {
    action: 'enter',
    motion,
    duration: curve.duration,
    durationRange: [curve.durationRange[0], curve.durationRange[1]],
    overshootPx: curve.overshootPx,
    overshootDeg: curve.overshootDeg,
    ...(curve.up !== undefined ? {up: curve.up, down: curve.down} : {}),
  };
}

function slowestEnter(height: number): number {
  return Math.max(
    curveOf('enter', 'crisp', height).duration,
    curveOf('enter', 'bounce', height).duration,
    curveOf('enter', 'soft', height).duration,
    curveOf('enter', 'paper', height).duration,
  );
}

function fontOf(extra: Record<string, unknown> | undefined): string {
  const heading = extra?.fontHeading;
  return typeof heading === 'string' && heading.trim() ? heading : FONT_STACK;
}

function firstColor(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value[0])) return value[0];
  return fallback;
}

/**
 * 弹簧和缓出在 t=0 的缩放是 0，整卡会看不见。
 * 显示时把缩放托在 0.88 以上，透明度不低于 0.72；过冲仍然用曲线原值，回弹次数不变。
 * 纸片不托缩放，直接用 settle / toss 的 y 和 tilt。
 */
export function poseAt(motion: MotionName, t: number, height: number): Pose {
  const raw = curveOf('enter', motion, height).sample(Math.max(0, t));
  if (motion === 'paper') return {y: raw.y, scale: raw.scale, tilt: raw.tilt, opacity: 1};
  const opacity = Math.min(1, 0.72 + 0.28 * raw.p);
  if (motion === 'crisp') return {y: raw.y, scale: 0.96 + 0.04 * raw.scale, tilt: 0, opacity};
  return {y: raw.y, scale: Math.max(raw.scale, 0.88), tilt: 0, opacity};
}

/**
 * 拍点之前卡片停在哪。旧四种性格停在静止位，行为不变。
 * push 从下方进来。若还没到拍的卡停在静止位，正在进来的卡会压进下一张。
 * 所以 push 在拍点前停在入场起点，和正在进来的那张对齐。
 */
export function holdPose(motion: MotionName, height: number): Pose {
  if (motion !== 'push') return {y: 0, scale: 1, tilt: 0, opacity: 1};
  return poseAt(motion, 0, height);
}

export function measureEnter(motion: MotionName, height: number) {
  const y = poseAt(motion, 0.2, height).y;
  const yNext = poseAt(motion, 0.2 + 1 / FPS, height).y;
  const dy = yNext - y;
  const vertical = dy < -0.2 ? 'up' : dy > 0.2 ? 'down' : 'still';
  const curve = curveOf('enter', motion, height);
  let turns = 0;
  let prev = curve.sample(0).scale;
  let dir = 0;
  let tiltPeak = 0;
  for (let frame = 0; frame <= 50; frame++) {
    const sample = curve.sample(frame / FPS);
    tiltPeak = Math.max(tiltPeak, Math.abs(sample.tilt));
    if (frame === 0) continue;
    const delta = sample.scale - prev;
    const sign = delta > 0.001 ? 1 : delta < -0.001 ? -1 : 0;
    if (sign && dir && sign !== dir && Math.max(prev, sample.scale) > 1.02) turns += 1;
    if (sign) dir = sign;
    prev = sample.scale;
  }
  return {motion, height, at: 0.2 as const, y, yNext, dy, vertical: vertical as 'up' | 'down' | 'still', scaleTurns: turns, tiltPeak};
}

export function prepareScene(input: {
  scene: SceneFile;
  roles: TokenRoles;
  extra?: Record<string, unknown>;
  frame: SceneFrame;
  fps?: number;
}): ScenePlan {
  const fps = input.fps ?? FPS;
  const scene = input.scene;
  const roles = input.roles;
  const frame = input.frame;
  const motion = scene.motion ?? 'crisp';
  const align: Align = scene.align ?? (scene.style === 'editorial' ? 'start' : 'center');
  const ink = ensureContrast(roles.ink, roles.surface);
  const muted = ensureContrast(roles.muted, roles.surface);
  const contrast: ContrastRow[] = [
    {pair: 'ink/surface', fg: ink.color, bg: roles.surface, ratio: ink.ratio, painted: true, adjusted: ink.adjusted},
    {pair: 'muted/surface', fg: muted.color, bg: roles.surface, ratio: muted.ratio, painted: true, adjusted: muted.adjusted},
    {pair: 'ink/bg', fg: roles.ink, bg: roles.bg, ratio: contrastRatio(roles.ink, roles.bg), painted: false, adjusted: false},
    {pair: 'muted/bg', fg: roles.muted, bg: roles.bg, ratio: contrastRatio(roles.muted, roles.bg), painted: false, adjusted: false},
  ];
  const cardBorder = roles.shadow === 'none' ? `2px solid ${roles.line}` : 'none';
  const slow = slowestEnter(frame.canvasH);
  const curve = curveParams(motion, frame.canvasH);
  let frameCursor = 0;
  const screens: PlanScreen[] = (scene.screens ?? []).map((screen, index) => {
    const layout: PlanScreen['layout'] = screen.layout === 'end' ? 'end' : screen.layout === 'split' ? 'split' : screen.layout === 'stack' ? 'stack' : 'hero';
    const geom = layout === 'end' || layout === 'hero' ? 'hero' : layout === 'split' ? 'split' : 'stack';
    const pieces = piecesOf(screen, layout);
    const reveal = revealFromBeats({
      hanzi: Math.max(1, pieces.reduce((sum, piece) => sum + hanziCount(piece.text), 0)),
      count: pieces.length,
      motion,
    });
    const seconds = Math.max(reveal.duration, (reveal.at[reveal.at.length - 1] ?? 0) + slow + 0.35);
    const durationFrames = Math.max(1, Math.round(seconds * fps));
    const placed = layoutBlocks({
      layout: geom,
      count: pieces.length,
      chars: pieces.map((piece) => glyphCount(piece.text + (piece.note || ''))),
      safe: frame.safe,
      floor: frame.floor,
      maxRow: frame.maxRow,
      density: scene.density ?? 'regular',
      align,
      winner: screen.winner,
      emphasis: screen.winner && screen.winner !== 'none' ? 'focus' : 'even',
      portrait: frame.portrait,
    });
    const half = Math.ceil(pieces.length / 2);
    const blocks: PlanBlock[] = placed.blocks.map((block, blockIndex) => {
      const piece = pieces[blockIndex] ?? pieces[0];
      const side = blockIndex < half ? 'left' : 'right';
      return {
        text: piece.text,
        ...(piece.note ? {note: piece.note} : {}),
        ...(piece.emphasis?.length ? {emphasis: piece.emphasis} : {}),
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        font: block.font,
        noteFont: frame.floor.aux,
        role: piece.role,
        index: blockIndex,
        align: block.align,
        textAlign: block.textAlign,
        showAt: blockIndex === 0 ? 0 : (reveal.at[blockIndex] ?? 0),
        mark: blockIndex === 0 || (layout === 'split' && side === screen.winner),
      };
    });
    const startFrame = frameCursor;
    frameCursor += durationFrames;
    return {
      index,
      role: screen.role,
      layout,
      start: startFrame / fps,
      duration: durationFrames / fps,
      startFrame,
      durationFrames,
      reveal,
      curve,
      blocks,
    };
  });
  return {
    fps,
    width: frame.canvasW,
    height: frame.canvasH,
    durationSec: frameCursor / fps,
    durationFrames: frameCursor,
    product: scene.product,
    aspect: scene.aspect,
    style: scene.style,
    motion,
    align,
    roles,
    fontFamily: fontOf(input.extra),
    cardBorder,
    backdrop: {top: firstColor(input.extra?.bgTop, roles.bg), bottom: firstColor(input.extra?.bgBot, roles.bg)},
    safe: {x: frame.safe.x, y: frame.safe.y, w: frame.safe.w, h: frame.safe.h},
    floor: frame.floor,
    paint: {ink: ink.color, muted: muted.color, surface: roles.surface, inkAdjusted: ink.adjusted, mutedAdjusted: muted.adjusted},
    contrast,
    screens,
  };
}

export function fontFloorOf(plan: ScenePlan, screen: PlanScreen, block: PlanBlock): number {
  if (block.role === 'main' && (screen.layout === 'hero' || screen.layout === 'end')) return plan.floor.title;
  return plan.floor.body;
}

export function auditPlan(plan: ScenePlan): string[] {
  const issues: string[] = [];
  if (plan.durationSec < 6) issues.push(`成片 ${plan.durationSec.toFixed(2)} 秒，短于 6 秒`);
  if (plan.aspect !== '9:16') issues.push(`画幅 ${plan.aspect}，不是 9:16`);
  for (const row of plan.contrast) {
    if (row.painted && row.ratio < 4.5) issues.push(`${row.pair} 对比度 ${row.ratio.toFixed(2)}，低于 4.5`);
  }
  for (const screen of plan.screens) {
    if (screen.reveal.source !== 'beat') issues.push(`第 ${screen.index + 1} 屏时间来源不是 beat`);
    for (let i = 0; i < screen.blocks.length; i++) {
      const block = screen.blocks[i];
      const min = fontFloorOf(plan, screen, block);
      if (block.font < min) issues.push(`第 ${screen.index + 1} 屏「${block.text}」字号 ${block.font} 低于 ${min}`);
      if (block.note && block.noteFont < plan.floor.aux) issues.push(`第 ${screen.index + 1} 屏注字号 ${block.noteFont} 低于 ${plan.floor.aux}`);
      if (block.x < plan.safe.x - 0.5 || block.y < plan.safe.y - 0.5) issues.push(`第 ${screen.index + 1} 屏块超出安全区左上`);
      if (block.x + block.w > plan.safe.x + plan.safe.w + 0.5 || block.y + block.h > plan.safe.y + plan.safe.h + 0.5) {
        issues.push(`第 ${screen.index + 1} 屏块超出安全区右下`);
      }
      if (i === 0 && block.showAt !== 0) issues.push(`第 ${screen.index + 1} 屏第一块不是从 0 秒出现`);
      if (i > 0 && block.showAt + 1e-9 < screen.blocks[i - 1].showAt) issues.push(`第 ${screen.index + 1} 屏出场不是单调的`);
    }
  }
  return issues;
}

/** 探针帧：第 0 帧，以及每屏结束前（入场已经落定）。不探入场中途，避免纸片上抛被当成压字。 */
export function checkFrames(plan: ScenePlan): number[] {
  const frames = new Set<number>([0]);
  for (const screen of plan.screens) {
    const tail = screen.startFrame + screen.durationFrames - Math.max(1, Math.round(0.12 * plan.fps));
    if (tail >= screen.startFrame && tail < plan.durationFrames) frames.add(tail);
  }
  frames.add(Math.max(0, plan.durationFrames - 1));
  return [...frames].sort((a, b) => a - b);
}
