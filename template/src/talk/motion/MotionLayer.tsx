// 动效 B-roll：在 Talk 合成里直接画 React 组件。不生成、不进账本、不审片、不加「AI 生成画面」标。
// 三层：① 框内铺不透明背景（宣传片配色的渐变；keyword 用 quiz 的纸色）
//       ② 舞台（stage.ts）：1080×1920 的镜头画布缩放进 B-roll 框，内容落在可用区正中，让开平台栏、字幕、画中画圆窗
//       ③ 时间重映射（warp.ts）：镜头里「第 i 条亮起」对到口播说出第 i 条的那一刻
// 复用宣传片公共镜头 steps / quickList / counter / compare（一行不改），keyword 是口播专用的新组件。
//
// 用法（Talk.tsx 的 ClipLayer，包在已有的 0.2 秒淡入淡出层里）：
//   <MotionLayer clip={clip} box={lay.broll} face={lay.face} captionTop={captions === 'add' ? 本段最靠上的字幕顶边 : null} />
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {pop} from '../../core/anim';
import {fitLine} from '../../core/fit';
import {FONT} from '../../core/font';
import {Icon} from '../../core/icons';
import {THEME_NAMES, ThemeProvider, alpha, moodColors, resolveTheme, textOnHot, useTheme} from '../../core/theme';
import type {Meta} from '../../schema';
import Compare from '../../shots/compare';
import Counter from '../../shots/counter';
import QuickList from '../../shots/quickList';
import Steps from '../../shots/steps';
import {StyleTokensProvider} from '../../styles/context';
import quizTokens from '../../styles/quiz/tokens.json';
import type {Rect} from '../layout';
import {BEAT, CHECK_TITLE, adaptShot, type ShotType} from './adapt';
import {Keyword, keywordGeom} from './Keyword';
import {stageOf, type VBox} from './stage';
import type {MotionClip} from './types';
import {makeWarp} from './warp';

export type {MotionClip} from './types';

/** 宣传片配色默认值（积木风配 studio-graphite：蓝灰底加橙色，和 AI 段接得上） */
export const DEFAULT_MOTION_THEME = 'studio-graphite';
/** keyword 纸卡默认配色 */
export const DEFAULT_PAPER = 'sage-pine';

const SHOTS: Record<ShotType, React.FC<any>> = {steps: Steps, quickList: QuickList, counter: Counter, compare: Compare};
const QUIZ = quizTokens as unknown as {themes: Record<string, Record<string, string>>};

/** checklist 的小标题胶囊（照 quickList 自带标题的样子画，只是贴在清单正上方） */
const CheckTitle: React.FC<{text: string; y: number; t: number}> = ({text, y, t}) => {
  const th = useTheme();
  const q = pop(t, 0, 15, 190);
  const size = fitLine(text, 640, 44, 40);
  return (
    <div style={{position: 'absolute', left: 150, width: 780, top: y, height: CHECK_TITLE.h, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: Math.min(1, q * 1.6), transform: `translateY(${(1 - q) * -30}px)`}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, height: CHECK_TITLE.h, boxSizing: 'border-box', padding: '0 36px', borderRadius: CHECK_TITLE.h / 2, background: th.hot, color: textOnHot(th), fontSize: size, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 10px 26px rgba(0,0,0,0.2)', border: '4px solid #ffffff'}}>
        <Icon name="bolt" size={40} color={textOnHot(th)} stroke={2.6} />
        {text}
      </div>
    </div>
  );
};

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
  // 不认识的配色名退回默认（resolveTheme 自己会退到亮色的 warm-emotion，和口播片不搭）
  const themeName = clip.theme && THEME_NAMES.includes(clip.theme) ? clip.theme : DEFAULT_MOTION_THEME;
  const theme = resolveTheme(themeName);
  const paperName = clip.paper && QUIZ.themes[clip.paper] ? clip.paper : DEFAULT_PAPER;
  const paper = QUIZ.themes[paperName];
  const meta = {title: '', product: '', theme: themeName, lang: clip.lang === 'en' ? 'en' : 'zh'} as unknown as Meta;

  let body: React.ReactNode = null;
  let content: VBox | undefined;
  let background: string;
  if (clip.template === 'keyword') {
    const g = keywordGeom(clip.data);
    content = g.content;
    body = <Keyword data={clip.data} marks={clip.marks} t={t} geom={g} />;
    background = `radial-gradient(ellipse at 50% 42%, ${paper.cardAlt ?? paper.bg} 0%, ${paper.bg} 70%)`;
  } else {
    const a = adaptShot(clip, dur, BEAT);
    const bg = moodColors(theme, 0.5);
    background = `linear-gradient(180deg, ${bg.top} 0%, ${bg.bot} 100%)`;
    if (a) {
      const Comp = SHOTS[a.type];
      const st = makeWarp(a.anchors, dur)(t);
      content = a.content;
      body = (
        <>
          {a.title ? <CheckTitle text={a.title.text} y={a.title.y} t={st} /> : null}
          <Comp params={a.params} t={st} dur={dur} beat={BEAT} index={1} isLast={false} mood={0.5} meta={meta} />
        </>
      );
    }
  }
  const st = stageOf({box, compW: width, compH: height, captionTop, avoid: face ?? null, content});
  const glowY = st.placed.y - box.y + st.placed.height / 2;
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, overflow: 'hidden'}}>
      <AbsoluteFill style={{background}} />
      {clip.template !== 'keyword' ? (
        <AbsoluteFill style={{background: `radial-gradient(ellipse ${Math.round(st.placed.width * 0.9)}px ${Math.round(st.placed.height * 0.8)}px at 50% ${Math.round(glowY)}px, ${alpha(theme.accent, 0.1)} 0%, transparent 100%)`}} />
      ) : null}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${st.tx}px, ${st.ty}px) scale(${st.u})`, fontFamily: FONT}}>
        <ThemeProvider theme={theme}>
          <StyleTokensProvider tokens={quizTokens as any} themeName={paperName}>
            {body}
          </StyleTokensProvider>
        </ThemeProvider>
      </div>
    </div>
  );
};
