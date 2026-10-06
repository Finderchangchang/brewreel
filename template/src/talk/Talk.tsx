import React from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT, ensureFont} from '../core/font';
import {pick} from '../core/kit';
import {CAPTION_LINE, MOTION_PIP_K, SPLIT_TOP, captionFor, captionMinusKeyword, layoutOf, pipCaptionPlacement, uiScale, type PipCaption, type TalkLayout} from './layout';
import {anchorRelay} from './motion/kit/anchorRelay';
import {restTiltFor} from './motion/kit/cutShape';
import {MotionLayer, type MotionClip} from './motion/MotionLayer';
import {blend, isCutpaper, resolvePalette} from './motion/palette';
import {MOTION_FRAMING, VIDEO_FRAMING, edgesOf, panelOffset, transProgress, videoPlacement} from './transition';

ensureFont();

export type TalkCue = {id: string; startMs: number; endMs: number; text: string};
/** AI 生成 / 占位 / 本地视频段：一段 mp4。kind 不写也当 video（v0.8 的 props 照常能渲染）。 */
export type VideoClip = {
  kind?: 'video';
  id: string;
  src: string;
  startMs: number;
  endMs: number;
  mode: 'full' | 'pip' | 'split';
  badge: boolean;
};
/** 一段 B-roll：视频段，或动效段（scripts/broll/motion.mjs 的 toMotionProps 产出，直接画 React 组件）。 */
export type TalkClip = VideoClip | MotionClip;
export type TalkProps = {
  talkSrc: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  captions: 'burned' | 'add' | 'none';
  cues: TalkCue[];
  clips: TalkClip[];
  /** minimax-h3 没审过就出片时为 true，AI 视频段出现时右上角加「未审」。动效段不加。 */
  draft?: boolean;
};

const isMotion = (clip: TalkClip): clip is MotionClip => clip.kind === 'motion';
/** 圆窗放大倍数：动效段的圆窗大一点（人优先），视频段和 v0.8 一样 */
const pipKOf = (clip: TalkClip | undefined) => (clip && isMotion(clip) ? MOTION_PIP_K : 1);

const cuesIn = (clip: TalkClip, cues: TalkCue[]) => cues.filter((c) => c.endMs > clip.startMs && c.startMs < clip.endMs);

/** 这一段里字幕实际显示的字：keyword 段去掉和大字重复的部分（见 layout.ts 的 captionMinusKeyword），'' = 不显示 */
const shownText = (clip: TalkClip | undefined, text: string): string =>
  clip && isMotion(clip) && clip.template === 'keyword' ? captionMinusKeyword(text, clip.data.text) : text;

const shownTextsIn = (clip: TalkClip, cues: TalkCue[]) =>
  cuesIn(clip, cues)
    .map((c) => shownText(clip, c.text))
    .filter(Boolean);

/** pip 段的字幕放圆窗左边还是上方：整段统一，按这一段里最长的那句定（见 layout.ts 的 pipCaptionPlacement）。 */
const placementOf = (clip: TalkClip | undefined, cues: TalkCue[], width: number, height: number): PipCaption =>
  clip && clip.mode === 'pip' ? pipCaptionPlacement(width, height, shownTextsIn(clip, cues), pipKOf(clip)) : 'side';

/** 这一段窗口里字幕占的竖向范围（成片像素）：最靠上那句的顶边、最靠下那句的底边。没有要显示的字幕返回 null。 */
const captionBandOf = (clip: TalkClip, cues: TalkCue[], width: number, height: number): {top: number; bottom: number} | null => {
  const placement = placementOf(clip, cues, width, height);
  const boxes = shownTextsIn(clip, cues).map((text) => captionFor(clip.mode, width, height, text, placement, pipKOf(clip)));
  if (!boxes.length) return null;
  return {top: Math.min(...boxes.map((b) => b.y)), bottom: Math.max(...boxes.map((b) => b.y + b.lines * Math.round(b.fontSize * CAPTION_LINE)))};
};

type Edge = {enter: boolean; exit: boolean};
type Slot = {clip: TalkClip; from: number; dur: number; edge: Edge};

/** 这一帧在哪一段里、进场走到哪了 */
const activeAt = (slots: Slot[], frame: number, fps: number): {slot: Slot; e: number} | null => {
  const slot = slots.find((s) => frame >= s.from && frame < s.from + s.dur);
  if (!slot) return null;
  return {slot, e: transProgress(frame - slot.from, slot.dur, fps, slot.edge)};
};

/** 上一段动效和这一段接不接同一张锚点卡。中间隔了视频段也按两段动效的窗口间隔算。 */
const relayFor = (slots: Slot[], index: number) => {
  const cur = slots[index]?.clip;
  if (!cur || !isMotion(cur)) return null;
  let prev: MotionClip | null = null;
  for (let j = index - 1; j >= 0; j--) {
    const earlier = slots[j].clip;
    if (isMotion(earlier)) {
      prev = earlier;
      break;
    }
  }
  if (!prev) return null;
  const a = resolvePalette(prev.look);
  const b = resolvePalette(cur.look);
  return anchorRelay({
    sameLook: a.look === b.look,
    gapSec: (cur.startMs - prev.endMs) / 1000,
    prev: {tilt: restTiltFor(a.look), color: a.accent},
    next: {tilt: restTiltFor(b.look), color: b.accent},
  });
};

/** B-roll 面板：视频段是一段 mp4，动效段是 React 组件。split / full 从上方推进来，pip 在人像后面不动。 */
const PanelLayer: React.FC<{slot: Slot; slots: Slot[]; index: number; lay: TalkLayout; fps: number; band: {top: number; bottom: number} | null}> = ({slot, slots, index, lay, fps, band}) => {
  const frame = useCurrentFrame();
  const {clip} = slot;
  const e = transProgress(frame, slot.dur, fps, slot.edge);
  const dy = panelOffset(clip.mode, lay.broll.height, e);
  return (
    <AbsoluteFill style={{transform: `translateY(${dy}px)`}}>
      {isMotion(clip) ? (
        <MotionLayer clip={clip} box={lay.broll} face={lay.face} captionTop={band ? band.top : null} captionBottom={band ? band.bottom : null} relay={relayFor(slots, index)} />
      ) : (
        <div style={{position: 'absolute', left: lay.broll.x, top: lay.broll.y, width: lay.broll.width, height: lay.broll.height, overflow: 'hidden'}}>
          <OffthreadVideo muted src={staticFile(clip.src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/** 真人：整片只有这一个视频层，按当前这段的摆法收放（transition.ts），不叠第二张脸 */
const FaceLayer: React.FC<{talkSrc: string; slots: Slot[]}> = ({talkSrc, slots}) => {
  const frame = useCurrentFrame();
  const {width: W, height: H, fps} = useVideoConfig();
  const at = activeAt(slots, frame, fps);
  const video = <OffthreadVideo muted src={staticFile(talkSrc)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />;
  if (!at || at.e <= 0) return <AbsoluteFill>{video}</AbsoluteFill>;
  const {clip} = at.slot;
  const motion = isMotion(clip);
  const pl = videoPlacement(clip.mode, W, H, at.e, motion ? MOTION_FRAMING : VIDEO_FRAMING);
  const u = Math.min(W, H) / 1080;
  const {inset: c, frame: f} = pl;
  const circle = clip.mode === 'pip';
  // 圆窗描边：720 宽竖版 6 像素，卡片色（动效段）或白色（视频段）；阴影 0 8px 24px rgba(0,0,0,.18)
  const ring = Math.max(2, Math.round(9 * u));
  const ringColor = motion ? resolvePalette(clip.look).card : '#FFFFFF';
  const ringOpacity = Math.max(0, Math.min(1, (at.e - 0.35) / 0.5));
  return (
    <AbsoluteFill>
      {circle ? (
        <div
          style={{
            position: 'absolute',
            left: f.x - ring,
            top: f.y - ring,
            width: f.width + ring * 2,
            height: f.height + ring * 2,
            borderRadius: f.radius + ring,
            boxShadow: `0 ${Math.round(12 * u)}px ${Math.round(36 * u)}px rgba(0,0,0,${(0.18 * at.e).toFixed(3)})`,
          }}
        />
      ) : null}
      <div style={{position: 'absolute', inset: 0, clipPath: `inset(${c.top}px ${c.right}px ${c.bottom}px ${c.left}px round ${c.radius}px)`}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${pl.tx}px, ${pl.ty}px) scale(${pl.s})`}}>{video}</div>
      </div>
      {circle && ringOpacity > 0 && motion ? (
        <div
          style={{
            position: 'absolute',
            left: f.x - ring,
            top: f.y - ring,
            width: f.width + ring * 2,
            height: f.height + ring * 2,
            boxSizing: 'border-box',
            borderRadius: f.radius + ring,
            border: `${ring}px solid ${ringColor}`,
            opacity: ringOpacity,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/** 画在真人上面的：split 动效段的分界线（细线 + 往下一道软阴影）、视频段的「AI 生成画面」和「未审」角标。剪纸的细线用纸底压暗，强调色只留给锚点 */
const OverlayLayer: React.FC<{slot: Slot; lay: TalkLayout; fps: number; draft?: boolean}> = ({slot, lay, fps, draft}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const s = uiScale(width, height);
  const {clip} = slot;
  const e = transProgress(frame, slot.dur, fps, slot.edge);
  if (e <= 0) return null;
  if (isMotion(clip)) {
    if (clip.mode !== 'split') return null;
    const pal = resolvePalette(clip.look);
    const u = Math.min(width, height) / 1080;
    const y = Math.round(height * SPLIT_TOP) * e;
    const line = Math.max(2, Math.round(6 * u));
    const shadow = Math.round(24 * u);
    return (
      <AbsoluteFill>
        <div style={{position: 'absolute', left: 0, top: y, width, height: shadow, background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 100%)'}} />
        <div style={{position: 'absolute', left: 0, top: y - line / 2, width, height: line, background: isCutpaper(pal.look) ? blend(pal.bg, '#000000', 0.2) : pal.look === 'ink' ? pal.ink : pal.accent}} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      {clip.badge ? (
        <div
          style={{
            position: 'absolute',
            left: lay.badge.x,
            top: lay.badge.y,
            opacity: e,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: Math.round(28 * s),
            lineHeight: 1.2,
            padding: `${Math.round(8 * s)}px ${Math.round(14 * s)}px`,
            borderRadius: Math.round(8 * s),
          }}
        >
          {pick(undefined, 'AI 生成画面', 'AI-generated')}
        </div>
      ) : null}
      {draft ? (
        <div
          style={{
            position: 'absolute',
            right: Math.round(36 * s),
            top: Math.round(36 * s),
            opacity: e,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: Math.round(22 * s),
            lineHeight: 1.2,
            padding: `${Math.round(6 * s)}px ${Math.round(10 * s)}px`,
            borderRadius: Math.round(8 * s),
          }}
        >
          {pick(undefined, 'B-roll 未审', 'B-roll unreviewed')}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 字幕：跟着当前这段的摆法走（进出场时位置跟着一起移），keyword 段去掉和大字重复的部分 */
const CaptionLayer: React.FC<{cues: TalkCue[]; slots: Slot[]; width: number; height: number}> = ({cues, slots, width, height}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const cue = cues.find((c) => ms >= c.startMs && ms < c.endMs);
  if (!cue) return null;
  const at = activeAt(slots, frame, fps);
  const active = at && at.e > 0 ? at.slot.clip : undefined;
  const text = shownText(active, cue.text);
  if (!text) return null;
  const box = captionFor(active?.mode ?? 'full', width, height, text, placementOf(active, cues, width, height), pipKOf(active));
  let y = box.y;
  if (active && at) {
    const fullY = captionFor('full', width, height, text).y;
    y = fullY + (box.y - fullY) * at.e;
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: y,
        width: box.width,
        textAlign: 'center',
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: box.fontSize,
        lineHeight: 1.18,
        color: '#FFFFFF',
        WebkitTextStroke: `${box.stroke}px #141218`,
        paintOrder: 'stroke fill',
        textShadow: `0 ${Math.round(box.fontSize * 0.08)}px 0 #141218`,
        whiteSpace: 'pre-line',
      }}
    >
      {text}
    </div>
  );
};

export const Talk: React.FC<TalkProps> = ({talkSrc, captions, cues, clips, draft}) => {
  const {width, height, fps} = useVideoConfig();
  if (!talkSrc) return <AbsoluteFill style={{background: '#141218'}} />;
  const edges = edgesOf(clips, fps);
  const slots: Slot[] = clips.map((clip, i) => ({
    clip,
    from: Math.round((clip.startMs / 1000) * fps),
    dur: Math.max(1, Math.round(((clip.endMs - clip.startMs) / 1000) * fps)),
    edge: edges[i],
  }));
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {slots.map((slot, i) => (
        <Sequence key={`p-${slot.clip.id}`} from={slot.from} durationInFrames={slot.dur}>
          <PanelLayer
            slot={slot}
            slots={slots}
            index={i}
            lay={layoutOf(slot.clip.mode, width, height, 1, pipKOf(slot.clip))}
            fps={fps}
            band={captions === 'add' ? captionBandOf(slot.clip, cues, width, height) : null}
          />
        </Sequence>
      ))}
      <FaceLayer talkSrc={talkSrc} slots={slots} />
      <Audio src={staticFile(talkSrc)} />
      {slots.map((slot) => (
        <Sequence key={`o-${slot.clip.id}`} from={slot.from} durationInFrames={slot.dur}>
          <OverlayLayer slot={slot} lay={layoutOf(slot.clip.mode, width, height, 1, pipKOf(slot.clip))} fps={fps} draft={draft} />
        </Sequence>
      ))}
      {captions === 'add' ? <CaptionLayer cues={cues} slots={slots} width={width} height={height} /> : null}
    </AbsoluteFill>
  );
};
