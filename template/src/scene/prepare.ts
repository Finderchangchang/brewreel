// 渲染前的数据准备。纯函数：屏 → 块、出场、曲线参数。不读文件，不画。
// 第 0 帧必须已经有主文案，所以每屏第一块的 showAt 压到 0。
// 逐字时钟只调用 revealFromWords。句内估算只调用 revealFromSentenceInterp。没有配音只调用 revealFromBeats。三种来源不写进同一个对象。
// 次文字只标成落在卡片上。低于 4.5 的前景会调深，本轮三支预设的卡片对已经过线，调深不会触发。
import {captionPaint, captionRemainder, onScreenPhrases} from './caption.ts';
import {contrastRatio} from './contrast.ts';
import {layoutBlocks} from './geom.ts';
import type {BandName, GeomLayout} from './geom.ts';
import {curveOf} from './motion.ts';
import {revealFromBeats, revealFromSentenceInterp, revealFromWords} from './time.ts';
import {captionBox, layoutSafe, screenSafe, type SceneFrame} from './safe-box.ts';
import type {RevealPlan} from './time.ts';
import {collageDurations, relayOf} from './backdrops/collage-time.ts';
import type {Align, BlockKind, CalloutBox, ChartPoint, FontFloor, MotionName, RelayName, SceneFile, ScenePresenter, SceneScreen, TokenRoles} from './types.ts';

const FPS = 30;
const FONT_STACK = '"PSans", "Noto Sans SC", "Microsoft YaHei UI", sans-serif';
const MONO_STACK = '"PMono", "Cascadia Mono", ui-monospace, monospace';

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
  /** 秒，相对本屏。第一块是 0，其余等于这一来源的 at。 */
  showAt: number;
  mark: boolean;
  kind?: BlockKind;
  icon?: string;
  /** 大数字和栏目标用等宽。 */
  mono?: boolean;
  slot?: {x: number; y: number; w: number; h: number};
  textBox?: {x: number; y: number; w: number; h: number};
  pane?: 'left' | 'right';
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
  layout: 'hero' | 'stack' | 'split' | 'end' | 'grid' | 'sequence' | 'media' | 'chart' | 'board' | 'number';
  start: number;
  duration: number;
  startFrame: number;
  durationFrames: number;
  reveal: RevealPlan;
  curve: PlanCurve;
  blocks: PlanBlock[];
  links?: {x1: number; y1: number; x2: number; y2: number}[];
  /** split 两组之间的分隔。 */
  rule?: {x: number; y: number; w: number; h: number};
  chart?: {type: 'bar' | 'line' | 'donut'; points: ChartPoint[]; max?: number};
  imageSrc?: string;
  /** 原图像素宽 / 高。标注按图片本身，不按外层卡片。 */
  imageAspect?: number;
  callouts?: CalloutBox[];
  rows?: {label: string; value: string}[];
  code?: string;
  /** 这一屏实际用的安全框。资讯板在 9:16 上是讲课竖版 safe，其它屏是宣传片主体区。 */
  safe?: {x: number; y: number; w: number; h: number};
  overflow?: boolean;
  /** 剪纸拼贴的接力名。其它风格不写。 */
  relay?: RelayName;
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
  fontNumber: string;
  cardBorder: string;
  /** 渐变只取令牌里的 bgTop / bgBot。没有这两项时上下都是 bg。 */
  backdrop: {top: string; bottom: string};
  safe: {x: number; y: number; w: number; h: number};
  floor: FontFloor;
  paint: {ink: string; muted: string; surface: string; stage: string; inkAdjusted: boolean; mutedAdjusted: boolean};
  /** 底部字幕的字色。不铺底板。ink 是还没念到的字，hot 是已经点亮的字。 */
  caption: {ink: string; hot: string; bg: string; shadow: string};
  contrast: ContrastRow[];
  /**
   * none：判断句直接写在舞台上，不铺圆角底。卡片只留给证据和条目。
   * 没写这个令牌时是 card，A / B 仍是整张卡片。
   */
  headlinePlate: 'none' | 'card';
  screens: PlanScreen[];
  domain?: string;
  presenter?: ScenePresenter;
  /** make-scene 在准备之后填上。渲染器只读，准备函数不写。 */
  sound?: {
    bgm?: string;
    lines?: {src: string; startFrame: number}[];
  };
  captions?: {
    coverScreens: number[];
    screens: {
      index: number;
      box: {x: number; y: number; w: number; h: number};
      pages: {startSec: number; endSec: number; font?: number; chars: {ch: string; at: number}[]}[];
    }[];
  };
};

export type Pose = {y: number; scale: number; tilt: number; opacity: number};

type Piece = {text: string; note?: string; emphasis?: string[]; role: PlanBlock['role']; icon?: string; pane?: 'left' | 'right'; groupLabel?: boolean};

export function hanziCount(text: string): number {
  return [...text].filter((ch) => /[\u3400-\u9fff]/.test(ch)).length;
}

export function glyphCount(text: string): number {
  return [...text.replace(/\s/g, '')].length || 1;
}

/** 留下能画的屏。dialogue 丢掉。compare 不是 split/stack 时收成 split。文案字段原样留下。 */
export function protoScene<T extends SceneFile>(scene: T): T {
  const screens: SceneScreen[] = [];
  for (const screen of scene.screens ?? []) {
    if (screen.role === 'dialogue') continue;
    if (screen.role === 'compare' && screen.layout !== 'split' && screen.layout !== 'stack') screens.push({...screen, layout: 'split'});
    else if (screen.role === 'action' && screen.layout !== 'end' && screen.layout !== 'hero') screens.push({...screen, layout: 'end'});
    else screens.push(screen);
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
  if (screen.left && screen.right && screen.layout === 'stack') {
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

function fontNumberOf(extra: Record<string, unknown> | undefined): string {
  const raw = extra?.fontNumber;
  if (typeof raw === 'string' && raw.includes('PMono')) return raw;
  if (typeof raw === 'string' && raw.trim()) return `${MONO_STACK}, ${raw}`;
  return MONO_STACK;
}

function stageInk(ink: string, surface: string, bg: string): string {
  if (contrastRatio(ink, bg) >= 4.5) return ink;
  if (contrastRatio(surface, bg) >= 4.5) return surface;
  return ensureContrast('#F4F1EA', bg).color;
}

type Built = {
  layout: PlanScreen['layout'];
  geom: GeomLayout;
  pieces: Piece[];
  bands?: BandName[];
  callouts?: CalloutBox[];
  icons?: string[];
  sides?: {labelChars: number; itemChars: number[]}[];
};

function comparePieces(screen: SceneScreen): {pieces: Piece[]; sides: {labelChars: number; itemChars: number[]}[]} {
  const pieces: Piece[] = [];
  const sides: {labelChars: number; itemChars: number[]}[] = [];
  const push = (pane: 'left' | 'right', label: string | undefined, items: string[] | undefined) => {
    const head = (label || (pane === 'left' ? '左' : '右')).trim() || (pane === 'left' ? '左' : '右');
    const body = (items ?? []).map((text) => text.trim()).filter(Boolean);
    pieces.push({text: head, role: 'support', pane, groupLabel: true});
    const itemChars: number[] = [];
    const rows = body.length ? body : [' '];
    for (const text of rows) {
      pieces.push({text, role: 'item', pane});
      itemChars.push(glyphCount(text));
    }
    sides.push({labelChars: glyphCount(head), itemChars});
  };
  push('left', screen.left?.label, screen.left?.items);
  push('right', screen.right?.label, screen.right?.items);
  return {pieces, sides};
}

function textPiece(text: string, role: Piece['role'], emphasis?: string[], note?: string, icon?: string): Piece {
  return {text, role, ...(emphasis?.length ? {emphasis} : {}), ...(note ? {note} : {}), ...(icon ? {icon} : {})};
}

function compose(screen: SceneScreen): Built {
  if (screen.role === 'number') {
    const num = screen.number?.text || screen.text || '0';
    const label = screen.number?.label || screen.support || '';
    if (screen.layout === 'board') {
      const pieces: Piece[] = [];
      const bands: BandName[] = [];
      if (screen.kicker) {
        pieces.push(textPiece(screen.kicker, 'support'));
        bands.push('kicker');
      }
      const judgment = screen.title || screen.text || '';
      if (judgment) {
        pieces.push(textPiece(judgment, 'main', screen.emphasis));
        bands.push('title');
      }
      pieces.push(textPiece(num, 'main'));
      bands.push('number');
      const caption = screen.support || (judgment && label && label !== judgment ? label : judgment ? '' : label);
      if (caption) {
        pieces.push(textPiece(caption, 'support'));
        bands.push('caption');
      }
      return {layout: 'board', geom: 'board', pieces, bands};
    }
    const pieces = [textPiece(num, 'main')];
    const bands: BandName[] = ['number'];
    if (label) {
      pieces.push(textPiece(label, 'support'));
      bands.push('caption');
    }
    return {layout: 'number', geom: 'number', pieces, bands};
  }
  if (screen.role === 'media' || (screen.layout === 'board' && screen.src)) {
    const pieces: Piece[] = [];
    const bands: BandName[] = [];
    if (screen.kicker) {
      pieces.push(textPiece(screen.kicker, 'support'));
      bands.push('kicker');
    }
    pieces.push(textPiece(screen.title || screen.text || '界面', 'main', screen.emphasis));
    const labels = (screen.callouts ?? []).map((box) => box.label).filter((label): label is string => typeof label === 'string' && label.trim().length > 0);
    const caption = screen.support || '';
    if (screen.layout === 'board') {
      bands.push('title');
      pieces.push(textPiece(' ', 'item'));
      bands.push('evidence');
      const line = caption || labels[0] || '';
      if (line && line !== (screen.title || screen.text || '界面')) {
        pieces.push(textPiece(line, 'support'));
        bands.push('caption');
      }
      return {layout: 'board', geom: 'board', pieces, bands, callouts: screen.callouts};
    }
    for (const label of labels) pieces.push(textPiece(label, 'support'));
    if (!labels.length && caption) pieces.push(textPiece(caption, 'support'));
    if (screen.kicker) bands.push('kicker');
    return {layout: 'media', geom: 'media', pieces, ...(screen.kicker ? {bands} : {}), callouts: screen.callouts};
  }
  if (screen.role === 'chart' || screen.layout === 'chart') {
    const pieces = [textPiece(screen.title || screen.text || '对比', 'main', screen.emphasis)];
    pieces.push(textPiece(' ', 'item'));
    if (screen.support) pieces.push(textPiece(screen.support, 'support'));
    return {layout: 'chart', geom: 'chart', pieces};
  }
  if (screen.layout === 'end' || screen.role === 'action') {
    return {layout: 'end', geom: 'end', pieces: piecesOf(screen, 'end')};
  }
  if (screen.layout === 'grid' && screen.items?.length) {
    return {
      layout: 'grid',
      geom: 'grid',
      pieces: screen.items.map((item) => textPiece(item.text, 'item', undefined, item.note, item.icon)),
      icons: screen.items.map((item) => item.icon || ''),
    };
  }
  if (screen.layout === 'sequence' && screen.items?.length) {
    return {
      layout: 'sequence',
      geom: 'sequence',
      pieces: screen.items.map((item) => textPiece(item.text, 'item', undefined, item.note, item.icon)),
    };
  }
  if (screen.layout === 'board') {
    const pieces: Piece[] = [];
    const bands: BandName[] = [];
    if (screen.kicker) {
      pieces.push(textPiece(screen.kicker, 'support'));
      bands.push('kicker');
    }
    const judgment = screen.title || screen.text || '';
    if (judgment) {
      pieces.push(textPiece(judgment, 'main', screen.emphasis));
      bands.push('title');
    }
    pieces.push(textPiece(screen.support || ' ', 'item'));
    bands.push('evidence');
    if (screen.line) {
      pieces.push(textPiece(screen.line, 'support'));
      bands.push('caption');
    }
    return {layout: 'board', geom: 'board', pieces, bands};
  }
  const layout: PlanScreen['layout'] = screen.layout === 'split' ? 'split' : screen.layout === 'stack' ? 'stack' : 'hero';
  const geom: GeomLayout = layout === 'split' ? 'split' : layout === 'stack' ? 'stack' : 'hero';
  if (layout === 'split' && screen.left && screen.right) {
    const compared = comparePieces(screen);
    return {layout, geom, pieces: compared.pieces, sides: compared.sides};
  }
  return {layout, geom, pieces: piecesOf(screen, layout)};
}

/** 这一屏要逐条对上旁白的文案，顺序和 compose 的 pieces 一致。证据占位也占一条。 */
export function pieceTextsOf(screen: SceneScreen): string[] {
  const built = compose(screen);
  const pieces = built.pieces.length ? built.pieces : [{text: ' ', role: 'main' as const}];
  return pieces.map((piece) => piece.text);
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
  /** 与 screens 等长。word 只走逐字，sentence 只走句内估算，beat 或缺省只走拍点。 */
  clocks?: Array<{source: 'word' | 'sentence'; marks: number[]; duration: number} | {source: 'beat'} | undefined>;
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
  const stage = stageInk(roles.ink, roles.surface, roles.bg);
  const lane = captionBox(frame);
  const backdropTop = firstColor(input.extra?.bgTop, roles.bg);
  const backdropBottom = firstColor(input.extra?.bgBot, roles.bg);
  const spokenColor = captionPaint({
    style: scene.style,
    ink: roles.ink,
    accent: roles.accent,
    bg: roles.bg,
    stage,
    backdropTop,
    backdropBottom,
    canvasH: frame.canvasH,
    laneY: lane.y,
    laneH: lane.h,
  });
  contrast.push(
    {pair: 'caption/bg', fg: spokenColor.ink, bg: spokenColor.bg, ratio: spokenColor.inkRatio, painted: true, adjusted: spokenColor.inkAdjusted},
    {pair: 'captionHot/bg', fg: spokenColor.hot, bg: spokenColor.bg, ratio: spokenColor.hotRatio, painted: true, adjusted: spokenColor.hotAdjusted},
  );
  let frameCursor = 0;
  const collage = scene.style === 'cutpaper-collage' ? collageDurations(scene.screens ?? []) : null;
  const screenCount = scene.screens?.length ?? 0;
  const screens: PlanScreen[] = (scene.screens ?? []).map((screen, index) => {
    const built = compose(screen);
    const pieces = built.pieces.length ? built.pieces : [{text: ' ', role: 'main' as const}];
    const clock = input.clocks?.[index];
    let reveal: RevealPlan;
    let seconds: number;
    if (clock?.source === 'word' || clock?.source === 'sentence') {
      const count = Math.max(1, pieces.length);
      const marks = clock.marks.slice(0, count);
      while (marks.length < count) marks.push(marks.length ? marks[marks.length - 1] : 0);
      const span = Math.max(0.1, clock.duration);
      reveal = clock.source === 'sentence' ? revealFromSentenceInterp(marks, motion, span) : revealFromWords(marks, motion, span, 'tts-words');
      seconds = Math.max(clock.duration, (reveal.at[reveal.at.length - 1] ?? 0) + slow + 0.35);
    } else {
      reveal = revealFromBeats({
        hanzi: Math.max(1, pieces.reduce((sum, piece) => sum + hanziCount(piece.text), 0)),
        count: pieces.length,
        motion,
      });
      // 剪纸拼贴的时长跟接力走，不跟拍点。有逐字时钟时仍用配音时长，不进这个分支。
      seconds = collage ? collage[index] : Math.max(reveal.duration, (reveal.at[reveal.at.length - 1] ?? 0) + slow + 0.35);
    }
    const durationFrames = Math.max(1, Math.round(seconds * fps));
    const full = screenSafe(frame, built.geom);
    const spoken = captionRemainder(screen.narration || '', onScreenPhrases(screen));
    const safe = layoutSafe(full, lane.y, Boolean(spoken));
    const placed = layoutBlocks({
      layout: built.geom,
      count: pieces.length,
      chars: pieces.map((piece) => glyphCount(piece.text + (piece.note || ''))),
      safe,
      floor: frame.floor,
      maxRow: frame.maxRow,
      density: scene.density ?? 'regular',
      align,
      winner: screen.winner,
      emphasis: screen.winner && screen.winner !== 'none' ? 'focus' : 'even',
      portrait: frame.portrait,
      ...(built.bands ? {bands: built.bands} : {}),
      ...(built.callouts ? {callouts: built.callouts} : {}),
      ...(built.sides ? {sides: built.sides} : {}),
    });
    const half = Math.ceil(pieces.length / 2);
    const mediaPieces = () => {
      const out: Piece[] = [];
      let cursor = 0;
      for (const block of placed.blocks) {
        if (block.kind === 'evidence' || block.kind === 'plot') out.push({text: '', role: 'item'});
        else out.push(pieces[cursor++] ?? {text: '', role: 'item'});
      }
      return out;
    };
    const aligned = built.geom === 'media' ? mediaPieces() : pieces;
    const blocks: PlanBlock[] = placed.blocks.map((block, blockIndex) => {
      const raw = aligned[blockIndex] ?? {text: '', role: 'item' as const};
      const piece = block.kind === 'evidence' || block.kind === 'plot' ? {text: '', role: 'item' as const} : raw;
      const side = blockIndex < half ? 'left' : 'right';
      const icon = piece.icon || built.icons?.[blockIndex] || '';
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
        role: block.kind === 'evidence' || block.kind === 'plot' ? 'item' : piece.role,
        index: blockIndex,
        align: block.align,
        textAlign: block.textAlign,
        showAt: blockIndex === 0 ? 0 : (reveal.at[Math.min(blockIndex, pieces.length - 1)] ?? 0),
        mark: blockIndex === 0 || (built.layout === 'split' && (piece.pane ? piece.pane === screen.winner : side === screen.winner)),
        ...(block.kind ? {kind: block.kind} : {}),
        ...(block.pane ? {pane: block.pane} : {}),
        ...(icon ? {icon} : {}),
        ...((block.kind === 'stage' || block.kind === 'kicker') ? {mono: true} : {}),
        ...(block.slot ? {slot: block.slot} : {}),
        ...(block.textBox ? {textBox: block.textBox} : {}),
      };
    });
    const startFrame = frameCursor;
    frameCursor += durationFrames;
    return {
      index,
      role: screen.role,
      layout: built.layout,
      start: startFrame / fps,
      duration: durationFrames / fps,
      startFrame,
      durationFrames,
      reveal,
      curve,
      blocks,
      ...(placed.links?.length ? {links: placed.links} : {}),
      ...(placed.rule ? {rule: placed.rule} : {}),
      ...(screen.chart && screen.points ? {chart: {type: screen.chart, points: screen.points, ...(screen.max !== undefined ? {max: screen.max} : {})}} : {}),
      ...(screen.src ? {imageSrc: screen.src} : {}),
      ...(screen.callouts ? {callouts: screen.callouts} : {}),
      ...(screen.rows ? {rows: screen.rows} : {}),
      ...(screen.code ? {code: screen.code} : {}),
      safe: {x: full.x, y: full.y, w: full.w, h: full.h},
      overflow: placed.overflow,
      ...(collage ? {relay: relayOf(screen, index, screenCount)} : {}),
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
    fontNumber: fontNumberOf(input.extra),
    cardBorder,
    backdrop: {top: backdropTop, bottom: backdropBottom},
    safe: {x: frame.safe.x, y: frame.safe.y, w: frame.safe.w, h: frame.safe.h},
    floor: frame.floor,
    ...(scene.domain ? {domain: scene.domain} : {}),
    ...(scene.presenter ? {presenter: scene.presenter} : {}),
    paint: {ink: ink.color, muted: muted.color, surface: roles.surface, stage, inkAdjusted: ink.adjusted, mutedAdjusted: muted.adjusted},
    caption: {ink: spokenColor.ink, hot: spokenColor.hot, bg: spokenColor.bg, shadow: spokenColor.shadow},
    contrast,
    headlinePlate: input.extra?.headlinePlate === 'none' ? 'none' : 'card',
    screens,
  };
}

function timingIssue(reveal: RevealPlan, index: number): string {
  const where = `第 ${index + 1} 屏`;
  if (reveal.source === 'word') {
    if (reveal.kind !== 'tts-words' && reveal.kind !== 'talk-marks') return `${where}逐字时间的种类不对`;
    if ('bpm' in reveal || 'charsPerSec' in reveal) return `${where}逐字时间混进了拍点`;
    return '';
  }
  if (reveal.source === 'sentence') {
    if (reveal.kind !== 'tts-sentence' || reveal.resolution !== 'sentence-interp') return `${where}时间来源不是逐字，也不是拍点`;
    if ('bpm' in reveal || 'charsPerSec' in reveal) return `${where}句级时间混进了拍点`;
    return '';
  }
  if (reveal.source === 'beat') {
    if (reveal.kind !== 'promo-no-audio') return `${where}拍点种类不对`;
    if ('lead' in reveal) return `${where}拍点混进了逐字提前量`;
    return '';
  }
  return `${where}时间来源不是逐字，也不是拍点`;
}

export function fontFloorOf(plan: ScenePlan, screen: PlanScreen, block: PlanBlock): number {
  if (block.kind === 'kicker') return plan.floor.aux;
  if (block.kind === 'stage') return plan.floor.title;
  if (block.role === 'main' && (screen.layout === 'hero' || screen.layout === 'end' || screen.layout === 'board' || screen.layout === 'number')) return plan.floor.title;
  return plan.floor.body;
}

export function auditPlan(plan: ScenePlan): string[] {
  const issues: string[] = [];
  if (plan.durationSec < 6) issues.push(`成片 ${plan.durationSec.toFixed(2)} 秒，短于 6 秒`);
  if (plan.aspect !== '9:16' && plan.aspect !== '16:9') issues.push(`画幅 ${plan.aspect}，不是 9:16 或 16:9`);
  for (const row of plan.contrast) {
    if (row.painted && row.ratio < 4.5) issues.push(`${row.pair} 对比度 ${row.ratio.toFixed(2)}，低于 4.5`);
  }
  for (const screen of plan.screens) {
    const timing = timingIssue(screen.reveal, screen.index);
    if (timing) issues.push(timing);
    for (let i = 0; i < screen.blocks.length; i++) {
      const block = screen.blocks[i];
      const min = fontFloorOf(plan, screen, block);
      if (block.font < min) issues.push(`第 ${screen.index + 1} 屏「${block.text}」字号 ${block.font} 低于 ${min}`);
      if (block.note && block.noteFont < plan.floor.aux) issues.push(`第 ${screen.index + 1} 屏注字号 ${block.noteFont} 低于 ${plan.floor.aux}`);
      const box = screen.safe ?? plan.safe;
      if (block.x < box.x - 0.5 || block.y < box.y - 0.5) issues.push(`第 ${screen.index + 1} 屏块超出安全区左上`);
      if (block.x + block.w > box.x + box.w + 0.5 || block.y + block.h > box.y + box.h + 0.5) {
        issues.push(`第 ${screen.index + 1} 屏块超出安全区右下`);
      }
      if (i === 0 && block.showAt !== 0) issues.push(`第 ${screen.index + 1} 屏第一块不是从 0 秒出现`);
      if (i > 0 && block.showAt + 1e-9 < screen.blocks[i - 1].showAt) issues.push(`第 ${screen.index + 1} 屏出场不是单调的`);
    }
    const stageNumber = screen.blocks.find((item) => item.kind === 'stage');
    const caption = screen.blocks.find((item) => item.kind === 'caption');
    if (stageNumber && caption && stageNumber.font < caption.font * 2) {
      issues.push(`第 ${screen.index + 1} 屏数字 ${stageNumber.font} 不到说明 ${caption.font} 的两倍`);
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
