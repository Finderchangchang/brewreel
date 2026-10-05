// 动效 B-roll：在 Talk 合成里直接画 React 组件。不生成、不进账本、不审片、不加「AI 生成画面」标。
// 两层：① 背景（Backdrop）铺满 B-roll 框：主风格的底色、很淡的纹理、框边几块慢慢漂的形状
//       ② 模板：在取景框（stage.ts 的 freeRect：让开平台栏、字幕、画中画圆窗之后剩下的那一块）里按它的宽高排版、把它填满
// 时刻直接按 marks（timing.ts）：第 i 条在口播说出第 i 条的那一刻出来。配色和质感跟主风格走（palette.ts）。
// 坐标用「参考像素」：短边 1080 时 1 参考像素 = 1 成片像素，别的分辨率整体等比缩放。
//
// 用法（Talk.tsx 的 ClipLayer，包在已有的 0.2 秒淡入淡出层里）：
//   <MotionLayer clip={clip} box={lay.broll} face={lay.face} captionTop={captions === 'add' ? 本段最靠上的字幕顶边 : null} />
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT} from '../../core/font';
import type {Rect} from '../layout';
import {Backdrop} from './Backdrop';
import {Checklist} from './Checklist';
import {Compare} from './Compare';
import {Counter} from './Counter';
import {Keyword} from './Keyword';
import {resolvePalette} from './palette';
import {freeRect} from './stage';
import {Steps} from './Steps';
import type {MotionClip} from './types';

export type {MotionClip} from './types';

export type MotionLayerProps = {
  clip: MotionClip;
  /** B-roll 框（layoutOf(...).broll，成片像素） */
  box: Rect;
  /** 字幕块顶边（成片像素）；captions 不是 add 时传 null。字幕按行数变高时传这一段里最靠上的那条 */
  captionTop: number | null;
  /** 口播小窗（layoutOf(...).face）。pip 的圆窗在框里，会被让开；split 的下半脸在框外，自动忽略 */
  face?: Rect | null;
};

export const MotionLayer: React.FC<MotionLayerProps> = ({clip, box, captionTop, face}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const dur = Math.max(0.1, (clip.endMs - clip.startMs) / 1000);
  const pal = resolvePalette(clip.look);
  const u = Math.max(0.1, Math.min(width, height) / 1080);
  const area = freeRect({box, compW: width, compH: height, captionTop, avoid: face ?? null});
  // 参考像素下的框和取景框（取景框相对框左上角）
  const bw = box.width / u;
  const bh = box.height / u;
  const W = area.width / u;
  const H = area.height / u;
  const fx = (area.x - box.x) / u;
  const fy = (area.y - box.y) / u;
  const common = {t, dur, W, H, pal};
  let body: React.ReactNode = null;
  if (clip.template === 'keyword') body = <Keyword data={clip.data} marks={clip.marks} {...common} />;
  else if (clip.template === 'checklist') body = <Checklist data={clip.data} marks={clip.marks} {...common} />;
  else if (clip.template === 'steps') body = <Steps data={clip.data} marks={clip.marks} {...common} />;
  else if (clip.template === 'counter') body = <Counter data={clip.data} marks={clip.marks} {...common} />;
  else if (clip.template === 'compare') body = <Compare data={clip.data} marks={clip.marks} {...common} />;
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: bw, height: bh, transformOrigin: '0 0', transform: `scale(${u})`, fontFamily: FONT}}>
        <Backdrop pal={pal} w={bw} h={bh} t={t} seed={clip.id} focus={{x: fx, y: fy, w: W, h: H}} />
        <div style={{position: 'absolute', left: fx, top: fy, width: W, height: H}}>{body}</div>
      </div>
    </div>
  );
};
