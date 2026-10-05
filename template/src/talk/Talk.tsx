import React from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT, ensureFont} from '../core/font';
import {pick} from '../core/kit';
import {captionFor, layoutOf, pipCaptionPlacement, uiScale, type PipCaption, type TalkLayout} from './layout';
import {MotionLayer, type MotionClip} from './motion/MotionLayer';

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

const frameStyle = (box: {x: number; y: number; width: number; height: number}, opacity = 1): React.CSSProperties => ({
  position: 'absolute',
  left: box.x,
  top: box.y,
  width: box.width,
  height: box.height,
  overflow: 'hidden',
  opacity,
});

const cuesIn = (clip: TalkClip, cues: TalkCue[]) => cues.filter((c) => c.endMs > clip.startMs && c.startMs < clip.endMs);

/** pip 段的字幕放圆窗左边还是上方：整段统一，按这一段里最长的那句定（见 layout.ts 的 pipCaptionPlacement）。 */
const placementOf = (clip: TalkClip | undefined, cues: TalkCue[], width: number, height: number): PipCaption =>
  clip && clip.mode === 'pip' ? pipCaptionPlacement(width, height, cuesIn(clip, cues).map((c) => c.text)) : 'side';

/** 这一段窗口里字幕最靠上的顶边（成片像素）。split 和 pip 上方按每句的行数留高，所以取最高的那句；没有字幕返回 null。 */
const captionTopOf = (clip: TalkClip, cues: TalkCue[], width: number, height: number): number | null => {
  const placement = placementOf(clip, cues, width, height);
  const tops = cuesIn(clip, cues).map((c) => captionFor(clip.mode, width, height, c.text, placement).y);
  return tops.length ? Math.min(...tops) : null;
};

const ClipLayer: React.FC<{clip: TalkClip; talkSrc: string; lay: TalkLayout; fps: number; dur: number; draft?: boolean; captionTop: number | null}> = ({
  clip,
  talkSrc,
  lay,
  fps,
  dur,
  draft,
  captionTop,
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const s = uiScale(width, height);
  const fade = Math.max(1, Math.round(0.2 * fps));
  const opacity = interpolate(frame, [0, fade, Math.max(fade + 1, dur - fade), dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const faceOpacity = clip.mode === 'split' ? 1 : opacity;
  const motion = isMotion(clip);
  return (
    <AbsoluteFill>
      {motion ? (
        <div style={{position: 'absolute', inset: 0, opacity}}>
          <MotionLayer clip={clip} box={lay.broll} face={lay.face} captionTop={captionTop} />
        </div>
      ) : (
        <div style={frameStyle(lay.broll, opacity)}>
          <OffthreadVideo muted src={staticFile(clip.src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </div>
      )}
      {lay.face ? (
        <div
          style={{
            position: 'absolute',
            left: lay.face.x,
            top: lay.face.y,
            width: lay.face.width,
            height: lay.face.height,
            overflow: 'hidden',
            borderRadius: lay.face.shape === 'circle' ? '50%' : 0,
            opacity: faceOpacity,
          }}
        >
          <OffthreadVideo muted src={staticFile(talkSrc)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </div>
      ) : null}
      {!motion && clip.badge ? (
        <div
          style={{
            position: 'absolute',
            left: lay.badge.x,
            top: lay.badge.y,
            opacity,
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
      {!motion && draft ? (
        <div
          style={{
            position: 'absolute',
            right: Math.round(36 * s),
            top: Math.round(36 * s),
            opacity,
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

const CaptionLayer: React.FC<{cues: TalkCue[]; clips: TalkClip[]; width: number; height: number}> = ({cues, clips, width, height}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const cue = cues.find((c) => ms >= c.startMs && ms < c.endMs);
  if (!cue) return null;
  const active = clips.find((c) => ms >= c.startMs && ms < c.endMs);
  const mode = active?.mode ?? 'full';
  const box = captionFor(mode, width, height, cue.text, placementOf(active, cues, width, height));
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
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
      {cue.text}
    </div>
  );
};

export const Talk: React.FC<TalkProps> = ({talkSrc, captions, cues, clips, draft}) => {
  const {width, height, fps} = useVideoConfig();
  if (!talkSrc) return <AbsoluteFill style={{background: '#141218'}} />;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <OffthreadVideo muted src={staticFile(talkSrc)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      <Audio src={staticFile(talkSrc)} />
      {clips.map((clip) => {
        const from = Math.round((clip.startMs / 1000) * fps);
        const dur = Math.max(1, Math.round(((clip.endMs - clip.startMs) / 1000) * fps));
        const captionTop = captions === 'add' ? captionTopOf(clip, cues, width, height) : null;
        return (
          <Sequence key={clip.id} from={from} durationInFrames={dur}>
            <ClipLayer clip={clip} talkSrc={talkSrc} lay={layoutOf(clip.mode, width, height)} fps={fps} dur={dur} draft={draft} captionTop={captionTop} />
          </Sequence>
        );
      })}
      {captions === 'add' ? <CaptionLayer cues={cues} clips={clips} width={width} height={height} /> : null}
    </AbsoluteFill>
  );
};
