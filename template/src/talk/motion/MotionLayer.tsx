// 动效 B-roll：在 Talk 合成里直接画 React 组件。不生成、不进账本、不审片、不加「AI 生成画面」标。
// 两层：① 背景（Backdrop）铺满 B-roll 框：主风格的底色、编码后也看得出的淡纹理、慢慢漂的大色块、禁区以外的几件装饰
//       ② 模板：在取景框（stage.ts 的 freeRect：让开平台栏、字幕、画中画圆窗、竖版右侧图标列之后剩下的那一块）里按它的宽高排版、把它填满
// 时刻直接按 marks（timing.ts）：第 i 条在口播说出第 i 条的那一刻出来。配色和质感跟主风格走（palette.ts）。
// 进出场（面板从上方推进来、真人收进下半或圆窗）由 Talk.tsx / transition.ts 管，这里只画面板本身。
// 坐标用「参考像素」：短边 1080 时 1 参考像素 = 1 成片像素，别的分辨率整体等比缩放。
//
// 用法（Talk.tsx 的 PanelLayer）：
//   <MotionLayer clip={clip} box={lay.broll} face={lay.face} captionTop={本段最靠上的字幕顶边} captionBottom={最靠下的字幕底边} />
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

/** 圆窗外扩多少不放装饰（参考像素；720 宽时 48 像素） */
const FACE_PAD = 72;
/** 字幕带上下各外扩多少不放装饰（参考像素） */
const CAPTION_PAD = 16;

export type MotionLayerProps = {
  clip: MotionClip;
  /** B-roll 框（layoutOf(...).broll，成片像素） */
  box: Rect;
  /** 字幕块顶边（成片像素）；captions 不是 add 时传 null。字幕按行数变高时传这一段里最靠上的那条 */
  captionTop: number | null;
  /** 字幕块底边（成片像素）：装饰要躲开整条字幕带；不传按顶边往下两行算 */
  captionBottom?: number | null;
  /** 口播小窗（layoutOf(...).face）。pip 的圆窗在框里，会被让开；split 的下半脸在框外，自动忽略 */
  face?: Rect | null;
};

export const MotionLayer: React.FC<MotionLayerProps> = ({clip, box, captionTop, captionBottom, face}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const dur = Math.max(0.1, (clip.endMs - clip.startMs) / 1000);
  const pal = resolvePalette(clip.look);
  const u = Math.max(0.1, Math.min(width, height) / 1080);
  const area = freeRect({box, compW: width, compH: height, captionTop, avoid: face ?? null, mode: clip.mode});
  // 参考像素下的框和取景框（取景框相对框左上角）
  const bw = box.width / u;
  const bh = box.height / u;
  const W = area.width / u;
  const H = area.height / u;
  const fx = (area.x - box.x) / u;
  const fy = (area.y - box.y) / u;
  // 装饰的禁区（取景框之外的）：字幕带整条、圆窗外扩
  const avoid: Rect[] = [];
  if (captionTop != null) {
    const top = (captionTop - box.y) / u - CAPTION_PAD;
    const bottom = captionBottom != null ? (captionBottom - box.y) / u + CAPTION_PAD : top + (height * 0.1) / u;
    avoid.push({x: -bw, y: top, width: bw * 3, height: Math.max(1, bottom - top)});
  }
  if (face && clip.mode === 'pip') avoid.push({x: (face.x - box.x) / u - FACE_PAD, y: (face.y - box.y) / u - FACE_PAD, width: face.width / u + FACE_PAD * 2, height: face.height / u + FACE_PAD * 2});
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
        <Backdrop pal={pal} w={bw} h={bh} t={t} seed={clip.id} focus={{x: fx, y: fy, width: W, height: H}} avoid={avoid} />
        <div style={{position: 'absolute', left: fx, top: fy, width: W, height: H}}>{body}</div>
      </div>
    </div>
  );
};
