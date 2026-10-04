import React from 'react';
import {Composition} from 'remotion';
import type {Storyboard} from './schema';
import {ensureFont} from './core/font';
import {FPS, H, W} from './core/safe';
import {LabProps, Promo, ShotLab, ShotScreen, framesOf, labStoryboard, sizeOf} from './Promo';
import {IllustLab} from './IllustLab';
import {Sheet, SheetProps, sheetSize} from './Sheet';
import {Talk, type TalkProps} from './talk/Talk';
import demo from './demo.json';

ensureFont();

// Promo：整片（--props=<storyboard.json>）
// ShotLab：单镜自测（--props='{"type":"meter","theme":"tech-dark"}'，不给 params 就用 spec.example；别的风格加 "style":"quiz"、"aspect":"4:5"）
// Promo / ShotLab 的宽高由 calculateMetadata 按 meta.aspect（或风格默认画幅）算，下面的 W/H 只是默认值
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
      calculateMetadata={({props}) => ({durationInFrames: framesOf(props as unknown as Storyboard), ...sizeOf(props as unknown as Storyboard)})}
    />
    <Composition
      id="ShotLab"
      component={ShotLab as unknown as React.FC<Record<string, unknown>>}
      fps={FPS}
      width={W}
      height={H}
      durationInFrames={90}
      defaultProps={{type: 'hook'} as Record<string, unknown>}
      calculateMetadata={({props}) => {
        const sb = labStoryboard(props as unknown as LabProps);
        return {durationInFrames: framesOf(sb), ...sizeOf(sb)};
      }}
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
    {/* Sheet：整片拼图（make.mjs 出 sheet.png；props: {storyboard, frames?, cols?}），见 Sheet.tsx。
        时长取整片帧数：Sheet 里冻结的 Promo 用到的 Sequence 会按合成时长截断，短了后面的镜头就画不出来 */}
    <Composition
      id="Sheet"
      component={Sheet as unknown as React.FC<Record<string, unknown>>}
      fps={FPS}
      width={2800}
      height={516}
      durationInFrames={300}
      defaultProps={{storyboard: demo} as unknown as Record<string, unknown>}
      calculateMetadata={({props}) => {
        const p = props as unknown as SheetProps;
        const {width, height} = sheetSize(p);
        return {width, height, durationInFrames: framesOf(p.storyboard)};
      }}
    />
    {/* Talk：口播底片 + B-roll。props 走文件，不在命令行拼 JSON。见 talk/Talk.tsx */}
    <Composition
      id="Talk"
      component={Talk as unknown as React.FC<Record<string, unknown>>}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={30}
      defaultProps={{talkSrc: '', width: 1080, height: 1920, fps: 30, durationSec: 1, captions: 'none', cues: [], clips: [], draft: false} as TalkProps}
      calculateMetadata={({props}) => {
        const p = props as unknown as TalkProps;
        const fps = p.fps > 0 ? p.fps : 30;
        const durationSec = p.durationSec > 0 ? p.durationSec : 1;
        return {
          fps,
          width: p.width > 0 ? p.width : 1080,
          height: p.height > 0 ? p.height : 1920,
          durationInFrames: Math.max(1, Math.round(durationSec * fps)),
        };
      }}
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
