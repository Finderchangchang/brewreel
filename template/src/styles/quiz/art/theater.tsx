import React from 'react';
import {Img, OffthreadVideo, staticFile} from 'remotion';
import {CharacterG} from './Character';
import {useArtPalette} from './colors';
import type {FxKind} from './fx';
import {backOut, hopAt, mouthAt, nodAt} from './motion';
import type {Expr, Pose, Who} from './rig';
import {GROUND, SceneBackdrop, SceneName, STAGE} from './scenes';

// ============================================================
// quiz / art 情景小剧场 + 媒体片段。
// 题目里的「片段」（参考片用的是影视原声片段）我们不能用影视素材，所以默认用代码画的小剧场：
// 两个角色在一个场景里把那句话「演」出来——说话的人嘴动、听的人点头，镜头在全景和说话人近景之间切。
// 用户自己有版权的视频 / 图片也可以直接放（MediaClip 的 video / image）。
//
//   <SceneClip scene="office" w={780} h={439} t={t} lines={[{who:'buddy', at:0.3, dur:1.6}, {who:'host', at:2.1, dur:1.2, expr:'happy'}]} />
//   <MediaClip media={{kind:'video', src:'_run/xx/clip.mp4', trimStart: 3}} w={780} h={439} t={t} />
//
// 倒放（「再听一遍」的倒带效果）：把 t 反着传进来即可，全部是 t 的纯函数。
// ============================================================

/** 一句台词：谁、第几秒开口、说多久（秒）。说话时默认 talk 姿势 + 嘴动；pose/expr 可覆盖 */
export type ClipLine = {who: Who; at: number; dur: number; pose?: Pose; expr?: Expr};

/** 一个表演事件：从 at 秒起换姿势 / 表情，或者触发特效、灯泡亮、跳一下、点头 */
export type ClipEvent = {who: Who; at: number; pose?: Pose; expr?: Expr; fx?: FxKind; bulb?: boolean; hop?: boolean; nod?: boolean};

export type CastSlot = {x?: number; facing?: 'left' | 'right'; pose?: Pose; expr?: Expr; bulb?: number; hidden?: boolean};

/** 镜头：auto = 全景开场，长台词切说话人近景，台词之间回全景；wide = 固定全景；push = 全景慢推 */
export type ClipCamera = 'auto' | 'wide' | 'push';

export type SceneClipProps = {
  scene: SceneName;
  w: number;
  h: number;
  t: number;
  lines?: ClipLine[];
  events?: ClipEvent[];
  cast?: Partial<Record<Who, CastSlot>>;
  camera?: ClipCamera;
};

const CHAR_SCALE = 0.95;
const DEFAULT_CAST: Record<Who, Required<Pick<CastSlot, 'x' | 'facing'>>> = {
  host: {x: 560, facing: 'right'},
  buddy: {x: 1060, facing: 'left'},
};

type Perf = {pose: Pose; expr: Expr; mouth: number; nod: number; hop: number; bulb: number; fx?: FxKind; fxT: number};

/** 算某个角色在 t 时刻的表演状态（纯函数，shot 作者也可以拿去驱动 Character） */
export const performAt = (who: Who, t: number, lines: ClipLine[] = [], events: ClipEvent[] = [], base: CastSlot = {}): Perf => {
  const p: Perf = {pose: base.pose ?? 'stand', expr: base.expr ?? 'neutral', mouth: 0, nod: 0, hop: 0, bulb: base.bulb ?? 0, fxT: 0};
  const evs = events.filter((e) => e.who === who && e.at <= t).sort((a, b) => a.at - b.at);
  for (const e of evs) {
    if (e.pose) p.pose = e.pose;
    if (e.expr) p.expr = e.expr;
    if (e.fx) {
      p.fx = e.fx;
      p.fxT = t - e.at;
    } else if (e.pose || e.expr) {
      // 换姿势 / 表情但没给新特效：旧特效收掉
      p.fx = undefined;
    }
    if (e.bulb) p.bulb = Math.min(1, (t - e.at) / 0.12);
    if (e.hop) p.hop = Math.max(p.hop, hopAt(t, e.at, 40));
    if (e.nod) p.nod = Math.max(p.nod, nodAt(t, e.at, 2));
  }
  const own = lines.find((l) => l.who === who && t >= l.at && t < l.at + l.dur);
  if (own) {
    p.pose = own.pose ?? 'talk';
    if (own.expr) p.expr = own.expr;
    p.mouth = mouthAt(t, own.at, own.at + own.dur, 6, who === 'host' ? 1 : 2);
  } else {
    // 听的人：对方开口 0.5 秒后点一次头
    const other = lines.find((l) => l.who !== who && t >= l.at && t < l.at + l.dur);
    if (other) p.nod = Math.max(p.nod, nodAt(t, other.at + 0.5, 1, 0.4));
  }
  return p;
};

type Cam = {cx: number; cy: number; zoom: number};

const clampCam = (c: Cam): Cam => {
  const vw = STAGE.w / c.zoom;
  const vh = STAGE.h / c.zoom;
  return {zoom: c.zoom, cx: Math.max(vw / 2, Math.min(STAGE.w - vw / 2, c.cx)), cy: Math.max(vh / 2, Math.min(STAGE.h - vh / 2, c.cy))};
};

const cameraAt = (t: number, mode: ClipCamera, lines: ClipLine[], xs: Record<Who, number>, facing: Record<Who, 'left' | 'right'>): Cam => {
  const wide: Cam = {cx: STAGE.w / 2, cy: STAGE.h / 2, zoom: 1};
  if (mode === 'wide') return wide;
  if (mode === 'push') return clampCam({...wide, zoom: 1 + 0.025 * Math.max(0, t)});
  // auto：说话超过 1.2 秒的台词切近景（开口 0.15 秒后切，像剪辑师跟人）
  const cur = lines.find((l) => l.dur >= 1.2 && t >= l.at + 0.15 && t < l.at + l.dur);
  if (!cur) {
    // 全景也慢慢推一点，别死板
    const last = [...lines].filter((l) => l.at + l.dur <= t).pop();
    const since = last ? t - (last.at + last.dur) : t;
    return clampCam({...wide, zoom: 1 + 0.02 * since});
  }
  // 近景：说话人偏画面一侧、朝向那边留出手势空间；取景上沿压在帽顶 / 灯泡上方一点
  const x = xs[cur.who] + (facing[cur.who] === 'right' ? 110 : -110);
  const since = t - (cur.at + 0.15);
  const zoom = 1.6 + 0.03 * since;
  const topY = GROUND - 650 * CHAR_SCALE;
  return clampCam({cx: x, cy: topY - 10 + STAGE.h / zoom / 2, zoom});
};

/** 情景小剧场（16:9 舞台按 cover 铺满 w×h） */
export const SceneClip: React.FC<SceneClipProps> = ({scene, w, h, t, lines = [], events = [], cast = {}, camera = 'auto'}) => {
  const pal = useArtPalette();
  const whos: Who[] = ['host', 'buddy'];
  const xs = {host: cast.host?.x ?? DEFAULT_CAST.host.x, buddy: cast.buddy?.x ?? DEFAULT_CAST.buddy.x};
  const facing = {host: cast.host?.facing ?? DEFAULT_CAST.host.facing, buddy: cast.buddy?.facing ?? DEFAULT_CAST.buddy.facing};
  const cam = cameraAt(t, camera, lines, xs, facing);
  // viewBox 取景：以 cam 为中心、按 zoom 缩放，再按容器比例 cover
  const aspect = w / h;
  let vw = STAGE.w / cam.zoom;
  let vh = STAGE.h / cam.zoom;
  if (vw / vh > aspect) vw = vh * aspect;
  else vh = vw / aspect;
  const vx = cam.cx - vw / 2;
  const vy = cam.cy - vh / 2;
  return (
    <svg width={w} height={h} viewBox={`${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`} style={{display: 'block'}}>
      <SceneBackdrop name={scene} pal={pal} t={t} />
      {whos.map((who) => {
        const slot = cast[who] ?? {};
        if (slot.hidden) return null;
        const p = performAt(who, t, lines, events, slot);
        return (
          <g key={who} transform={`translate(${xs[who]} ${GROUND}) scale(${CHAR_SCALE}) translate(0 -600)`}>
            <ellipse cx={facing[who] === 'left' ? -8 : 8} cy={602} rx={112 * (1 - Math.min(0.4, p.hop / 150))} ry={12} fill={pal.ground} opacity={0.9} />
            <g transform={`translate(0 ${-p.hop})`}>
              <CharacterG who={who} pose={p.pose} expr={p.expr} mouth={p.mouth} t={t} facing={facing[who]} nod={p.nod} bulb={p.bulb} fx={p.fx} fxT={p.fxT} />
            </g>
          </g>
        );
      })}
    </svg>
  );
};

// ---------------- 媒体片段：小剧场 / 用户自备视频 / 图片 ----------------

export type ClipMedia =
  | ({kind: 'scene'} & Omit<SceneClipProps, 'w' | 'h' | 't'>)
  | {kind: 'video'; src: string; trimStart?: number; trimEnd?: number; keepAudio?: boolean; speed?: number}
  | {kind: 'image'; src: string};

const srcOf = (src: string) => (/^(https?:|data:|blob:)/.test(src) ? src : staticFile(src.replace(/^\/+/, '')));

/**
 * 题目里的「片段」：默认小剧场；用户自备素材（public 下的相对路径或 http 地址）走 video / image。
 * 用户素材的版权由使用者声明；图片会有轻微推近，避免「死图」。
 */
export const MediaClip: React.FC<{media: ClipMedia; w: number; h: number; t: number}> = ({media, w, h, t}) => {
  if (media.kind === 'video') {
    return (
      <div style={{width: w, height: h, overflow: 'hidden', position: 'relative'}}>
        <OffthreadVideo
          src={srcOf(media.src)}
          muted={!media.keepAudio}
          playbackRate={media.speed ?? 1}
          trimBefore={Math.round((media.trimStart ?? 0) * 30)}
          trimAfter={media.trimEnd !== undefined ? Math.round(media.trimEnd * 30) : undefined}
          style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </div>
    );
  }
  if (media.kind === 'image') {
    const z = 1 + 0.05 * Math.min(1, Math.max(0, t) / 4);
    return (
      <div style={{width: w, height: h, overflow: 'hidden', position: 'relative'}}>
        <Img src={srcOf(media.src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})`}} />
      </div>
    );
  }
  const {kind: _k, ...rest} = media;
  return <SceneClip {...rest} w={w} h={h} t={t} />;
};

// ---------------- 探头 ----------------

export type PeekProps = {
  who: Who;
  /** 角色中心 x（像素） */
  x: number;
  /** 遮挡边缘的 y（像素，一般 = 媒体卡上沿）。角色从这条线后面升起，线以下被裁掉 */
  edgeY: number;
  /** 角色身高（600 单位）对应的像素 */
  size: number;
  t: number;
  /** 开始探头的秒数；升起 0.17 秒，带回弹 */
  at?: number;
  /** 露出多少：head = 只露头，bust = 头 + 肩（默认） */
  show?: 'head' | 'bust';
  /** 两只手扒在边缘上 */
  grip?: boolean;
  facing?: 'left' | 'right';
  expr?: Expr;
  mouth?: number;
  bulb?: number;
  fx?: FxKind;
  fxT?: number;
  /** 退场：从这个秒数起 0.15 秒缩回去 */
  hideAt?: number;
};

/**
 * 从卡片上沿后面探头。要画在卡片「之后」（DOM 顺序在后），它会自己把边缘以下裁掉，
 * 扒边的手会压在卡片边缘上，看起来像躲在卡片后面。
 */
export const PeekCharacter: React.FC<PeekProps> = ({who, x, edgeY, size, t, at = 0, show = 'bust', grip = true, facing = 'right', expr = 'neutral', mouth = 0, bulb = 0, fx, fxT = 0, hideAt}) => {
  const pal = useArtPalette();
  const k = size / 600;
  const up = backOut(t, at, 0.17, 2.2);
  const down = hideAt !== undefined ? Math.min(1, Math.max(0, (t - hideAt) / 0.15)) : 0;
  const p = Math.max(0, up - down);
  // 露出的高度（角色坐标）：头顶 ≈ 20，肩 ≈ 230
  const visible = show === 'head' ? 185 : 262;
  const topPad = 200; // 灯泡 / 绒球 / 特效的上方余量
  const boxH = (visible + topPad) * k;
  // 脚底相对边缘的位置：p=0 时整个人在线下，p=1 时露出 visible
  const feetY = edgeY + ((1 - p) * 680 + p * (600 - visible)) * k;
  const handDx = who === 'host' ? 74 : 86;
  const gripP = Math.max(0, Math.min(1, (p - 0.6) / 0.4));
  return (
    <>
      <div style={{position: 'absolute', left: x - 260 * k, top: edgeY - boxH, width: 520 * k, height: boxH, overflow: 'hidden', pointerEvents: 'none'}}>
        <svg width={520 * k} height={(600 + topPad + 40) * k} viewBox={`-260 ${-topPad - 40} 520 ${600 + topPad + 40}`} style={{position: 'absolute', left: 0, top: feetY - 600 * k - (edgeY - boxH) - (topPad + 40) * k}}>
          <CharacterG who={who} pose="stand" expr={expr} mouth={mouth} t={t} facing={facing} bulb={bulb} fx={fx} fxT={fxT} />
        </svg>
      </div>
      {grip && gripP > 0 && (
        <svg width={520 * k} height={60 * k} viewBox="-260 -30 520 60" style={{position: 'absolute', left: x - 260 * k, top: edgeY - 30 * k, overflow: 'visible', opacity: gripP}}>
          {[-1, 1].map((s) => (
            <g key={s} transform={`translate(${s * handDx + (facing === 'right' ? 8 : -8)} ${-2 + 8 * (1 - gripP)}) scale(1.3)`}>
              <path d="M-17,6 Q-19,-12 0,-13 Q19,-12 17,6 Z" fill={who === 'host' ? pal.skinA : pal.skinB} stroke={pal.line} strokeWidth={6} strokeLinejoin="round" />
              <path d="M-6,-8 L-6,4 M5,-8 L5,4" stroke={pal.line} strokeWidth={3} strokeLinecap="round" />
            </g>
          ))}
        </svg>
      )}
    </>
  );
};
