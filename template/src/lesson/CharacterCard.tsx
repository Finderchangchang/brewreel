import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {pick, type Lang} from '../core/kit';
import {FONT} from '../core/font';
import {Character, PEEP_FILL} from './mascot';
import {CARD_MOTION_FRAME} from './mascot/icon-place.mjs';
import type {MascotWardrobe} from './mascot';
import {lessonThemes, type LessonTheme} from './theme';
import {CARD_LINE, POSE_LABELS, cardFrameState} from '../../../scripts/lesson/character-clip.mjs';

export type CharacterCardProps = {
  look: MascotWardrobe;
  theme?: LessonTheme;
  name?: string;
  lang?: Lang;
};

export const CharacterCard: React.FC<CharacterCardProps> = ({look, theme = 'lecture', name, lang}) => {
  const frame = useCurrentFrame();
  const state = cardFrameState(frame);
  const themeId = theme && lessonThemes[theme] ? theme : 'lecture';
  const t = lessonThemes[themeId];
  const title = name || pick(lang, '讲解员', 'Presenter');
  const poseLabel = state.progress < 1 && state.fromPose !== state.pose ? pick(lang, '换手势', 'Changing gesture') : POSE_LABELS[state.pose];
  return <AbsoluteFill style={{background: t.bg, color: t.ink, fontFamily: FONT}}>
    <div style={{position: 'absolute', left: 80, top: 56, fontFamily: t.fontBody, fontWeight: 700, fontSize: 42}}>{title}</div>
    <div style={{position: 'absolute', right: 80, top: 68, fontFamily: t.fontBody, fontSize: 28, color: t.muted}}>{poseLabel}</div>
    <div style={{position: 'absolute', left: 560, top: 120, width: CARD_MOTION_FRAME.w, height: CARD_MOTION_FRAME.h}}>
      <Character pose={state.pose} fromPose={state.fromPose} progress={state.progress} mouth={state.mouth} blink={state.blink} elapsedMs={state.elapsedMs} wardrobe={look} ink={t.ink} surface={PEEP_FILL} crop="card" frameWidth={CARD_MOTION_FRAME.w} frameHeight={CARD_MOTION_FRAME.h} />
    </div>
    <div style={{position: 'absolute', left: 160, right: 160, bottom: 56, textAlign: 'center', fontFamily: t.fontBody, fontWeight: 700, fontSize: 40, color: t.ink}}>{state.line || CARD_LINE}</div>
  </AbsoluteFill>;
};
