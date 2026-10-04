import React from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT, ensureFont} from '../core/font';
import {pick} from '../core/kit';
import {layoutOf, type TalkLayout} from './layout';

ensureFont();

export type TalkCue = {id: string; startMs: number; endMs: number; text: string};
export type TalkClip = {
  id: string;
  src: string;
  startMs: number;
  endMs: number;
  mode: 'full' | 'pip' | 'split';
  badge: boolean;
};
export type TalkProps = {
  talkSrc: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  captions: 'burned' | 'add' | 'none';
  cues: TalkCue[];
  clips: TalkClip[];
};

const frameStyle = (box: {x: number; y: number; width: number; height: number}, opacity = 1): React.CSSProperties => ({
  position: 'absolute',
  left: box.x,
  top: box.y,
  width: box.width,
  height: box.height,
  overflow: 'hidden',
  opacity,
});

const ClipLayer: React.FC<{clip: TalkClip; talkSrc: string; lay: TalkLayout; fps: number; dur: number}> = ({clip, talkSrc, lay, fps, dur}) => {
  const frame = useCurrentFrame();
  const fade = Math.max(1, Math.round(0.2 * fps));
  const opacity = interpolate(frame, [0, fade, Math.max(fade + 1, dur - fade), dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const faceOpacity = clip.mode === 'split' ? 1 : opacity;
  return (
    <AbsoluteFill>
      <div style={frameStyle(lay.broll, opacity)}>
        <OffthreadVideo muted src={staticFile(clip.src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </div>
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
      {clip.badge ? (
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
            fontSize: 28,
            lineHeight: 1.2,
            padding: '8px 14px',
            borderRadius: 8,
          }}
        >
          {pick(undefined, 'AI 生成画面', 'AI-generated')}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const CaptionLayer: React.FC<{cues: TalkCue[]; box: TalkLayout['caption']}> = ({cues, box}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const cue = cues.find((c) => ms >= c.startMs && ms < c.endMs);
  if (!cue) return null;
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

export const Talk: React.FC<TalkProps> = ({talkSrc, captions, cues, clips}) => {
  const {width, height, fps} = useVideoConfig();
  const cap = layoutOf('full', width, height).caption;
  if (!talkSrc) return <AbsoluteFill style={{background: '#141218'}} />;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <OffthreadVideo muted src={staticFile(talkSrc)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      <Audio src={staticFile(talkSrc)} />
      {clips.map((clip) => {
        const from = Math.round((clip.startMs / 1000) * fps);
        const dur = Math.max(1, Math.round(((clip.endMs - clip.startMs) / 1000) * fps));
        return (
          <Sequence key={clip.id} from={from} durationInFrames={dur}>
            <ClipLayer clip={clip} talkSrc={talkSrc} lay={layoutOf(clip.mode, width, height)} fps={fps} dur={dur} />
          </Sequence>
        );
      })}
      {captions === 'add' ? <CaptionLayer cues={cues} box={cap} /> : null}
    </AbsoluteFill>
  );
};
