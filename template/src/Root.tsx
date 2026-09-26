import React from 'react';
import {Composition} from 'remotion';
import type {Storyboard} from './schema';
import {ensureFont} from './core/font';
import {FPS, H, W} from './core/safe';
import {LabProps, Promo, ShotLab, ShotScreen, framesOf, labStoryboard} from './Promo';
import {IllustLab} from './IllustLab';
import demo from './demo.json';

ensureFont();

// Promo：整片（--props=<storyboard.json>）
// ShotLab：单镜自测（--props='{"type":"meter","theme":"tech-dark"}'，不给 params 就用 spec.example）
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Promo"
      component={Promo as unknown as React.FC<Record<string, unknown>>}
      fps={FPS}
      width={W}
      height={H}
      durationInFrames={300}
      defaultProps={demo as unknown as Record<string, unknown>}
      calculateMetadata={({props}) => ({durationInFrames: framesOf(props as unknown as Storyboard)})}
    />
    <Composition
      id="ShotLab"
      component={ShotLab as unknown as React.FC<Record<string, unknown>>}
      fps={FPS}
      width={W}
      height={H}
      durationInFrames={90}
      defaultProps={{type: 'hook'} as Record<string, unknown>}
      calculateMetadata={({props}) => ({durationInFrames: framesOf(labStoryboard(props as unknown as LabProps))})}
    />
    {/* Screen：把单个镜头渲成干净的「App 截图」（无字幕/免责/音效），给 phone 镜头当示意素材 */}
    <Composition
      id="Screen"
      component={ShotScreen as unknown as React.FC<Record<string, unknown>>}
      fps={FPS}
      width={W}
      height={H}
      durationInFrames={90}
      defaultProps={{type: 'mockApp'} as Record<string, unknown>}
      calculateMetadata={({props}) => ({durationInFrames: framesOf(labStoryboard(props as unknown as LabProps))})}
    />
    {/* IllustLab：行业插画网格自检（props: {industry?, theme?}），不是正式镜头，见 IllustLab.tsx */}
    <Composition
      id="IllustLab"
      component={IllustLab as unknown as React.FC<Record<string, unknown>>}
      fps={FPS}
      width={W}
      height={H}
      durationInFrames={30}
      defaultProps={{} as Record<string, unknown>}
    />
  </>
);
