import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {Shot, Storyboard, ThemeName} from './schema';
import {FONT} from './core/font';
import {Placeholder, pick} from './core/kit';
import {Background, Bgm, Captions, Disclaimer, MoodFlash, Notices, SfxTrack, Watermark, collectSfx} from './core/layers';
import {FPS} from './core/safe';
import {ThemeProvider, resolveTheme} from './core/theme';
import {Slot, beatOf, schedule, totalDur} from './core/timeline';
import {LayoutProbe} from './core/probe';
import {moduleOf, specOf} from './shots';
import {AspectProvider} from './core/aspect';
import {geometryOf} from './core/safe';
import {DEFAULT_STYLE, ShotLookup, aspectOf, lookupOf, styleDefOf, styleIdOf, withStyleDefaults} from './styles';
import {StyleTokensProvider} from './styles/context';
import {StyleChrome} from './styles/_shared/chrome';
import type {StyleDef} from './styles/types';

/** 公共镜头查找（cards 风格用它，和改造前一样） */
const COMMON: ShotLookup = {specOf, moduleOf};
/** 这个分镜该用的镜头查找：cards → 公共镜头；其他风格 → 专属镜头 + 允许复用的公共镜头 */
export const lookupFor = (sb: Storyboard): ShotLookup => (styleIdOf(sb) === DEFAULT_STYLE ? COMMON : lookupOf(styleDefOf(sb)));

export const framesOf = (sb0: Storyboard) => {
  const sb = withStyleDefaults(sb0);
  return Math.max(1, Math.round(totalDur(schedule(sb, lookupFor(sb).specOf)) * FPS));
};
/** 成片宽高（按 meta.aspect / 风格默认画幅） */
export const sizeOf = (sb: Storyboard) => {
  const g = geometryOf(aspectOf(sb));
  return {width: g.w, height: g.h};
};

/** 旧镜退场帧数：4 帧内淡出并下移；新镜在旧镜淡出一半（第 2 帧）后才开始显形，第 4 帧完全出来，两镜的卡片不会叠在一起 */
export const OUT_FRAMES = 4;
const OUT = OUT_FRAMES / FPS;

// 单个镜头的外壳：本地时间 + 统一退场（push / fade 都是 4 帧淡出 + 下移；none 不退场）+ 非首镜的短暂延后显形
const ShotHost: React.FC<{slot: Slot; beat: number; sb: Storyboard; isLast: boolean; lookup?: ShotLookup}> = ({slot, beat, sb, isLast, lookup = COMMON}) => {
  const t = useCurrentFrame() / FPS;
  const mod = lookup.moduleOf(slot.shot.type);
  const spec = lookup.specOf(slot.shot.type);
  const exit = isLast ? 'none' : spec?.exit ?? 'push';
  const p = exit === 'none' ? 0 : Math.min(1, Math.max(0, (t - slot.dur) / OUT));
  const enter = slot.i === 0 ? 1 : Math.min(1, Math.max(0, (t - OUT / 2) / (OUT / 2)));
  const style: React.CSSProperties = exit === 'none' ? {opacity: enter} : {opacity: enter * (1 - p), transform: `translateY(${p * 48}px)`};
  const Comp = mod?.default;
  return (
    <AbsoluteFill style={style}>
      {Comp ? (
        <Comp
          params={slot.shot.params || {}}
          t={t}
          dur={slot.dur}
          beat={beat}
          index={slot.i}
          isLast={isLast}
          caption={slot.shot.caption}
          mood={slot.mood}
          meta={sb.meta}
        />
      ) : (
        <Placeholder type={pick(sb.meta?.lang, `未知镜头 ${slot.shot.type}`, `Unknown shot ${slot.shot.type}`)} t={t} />
      )}
    </AbsoluteFill>
  );
};

/** 整片：按 meta.style 分派。cards（默认）走原来的管线，其他风格走 StylePromo */
export const Promo: React.FC<Storyboard & {__probe?: number[]}> = (sb) =>
  styleIdOf(sb) === DEFAULT_STYLE ? <CardsPromo {...sb} /> : <StylePromo {...(withStyleDefaults(sb) as Storyboard & {__probe?: number[]})} def={styleDefOf(sb)} />;

// ---------------- cards：原来的整片管线（一行没改） ----------------
const CardsPromo: React.FC<Storyboard & {__probe?: number[]}> = (sb) => {
  const theme = resolveTheme(sb.meta?.theme, sb.meta?.brandColor);
  const slots = schedule(sb, specOf);
  const frames = Math.max(1, Math.round(totalDur(slots) * FPS));
  const beat = beatOf(sb);
  const cues = collectSfx(slots, moduleOf, specOf, beat);
  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={{fontFamily: FONT, overflow: 'hidden', background: theme.bgBot[0]}}>
        <Background slots={slots} beat={beat} />
        <LayoutProbe frames={sb.__probe}>
        {slots.map((s) => {
          const isLast = s.i === slots.length - 1;
          const from = Math.round(s.start * FPS);
          const len = Math.max(1, Math.round(s.dur * FPS) + (isLast ? 0 : OUT_FRAMES));
          return (
            <Sequence key={s.i} from={from} durationInFrames={len} name={`${s.i + 1}-${s.shot.type}`}>
              <ShotHost slot={s} beat={beat} sb={sb} isLast={isLast} />
            </Sequence>
          );
        })}
        <MoodFlash slots={slots} />
        <Captions slots={slots} beat={beat} lang={sb.meta?.lang} />
        <Disclaimer text={sb.meta?.disclaimer} lang={sb.meta?.lang} />
        <Notices items={sb.meta?.notices} lang={sb.meta?.lang} disclaimer={sb.meta?.disclaimer} />
        <Watermark logo={sb.meta?.logo} slots={slots} />
        </LayoutProbe>
        <SfxTrack cues={cues} />
        <Bgm sb={sb} frames={frames} />
      </AbsoluteFill>
    </ThemeProvider>
  );
};

// ---------------- 其他风格的整片管线 ----------------
// 画幅按 meta.aspect（或风格默认）；令牌走 StyleTokensProvider；公共镜头复用时用 def.cardsTheme 给的 cards 主题。
// 层次：风格背景 → 镜头（或整片渲染器 Film）→ 全局字幕（captionLayer=cards 时）→ 风格覆盖层 → 合规小字 → 音效 / 配乐。
const StylePromo: React.FC<Storyboard & {__probe?: number[]; def: StyleDef}> = ({def, ...sb}) => {
  const geo = geometryOf(aspectOf(sb));
  const lookup = lookupOf(def);
  const slots = schedule(sb, lookup.specOf);
  const frames = Math.max(1, Math.round(totalDur(slots) * FPS));
  const beat = beatOf(sb);
  const cues = collectSfx(slots, lookup.moduleOf, lookup.specOf, beat);
  const ct = def.cardsTheme;
  const theme = {...resolveTheme(ct?.base ?? 'fresh-light', sb.meta?.brandColor), ...(ct?.override ?? {})};
  // 没写 meta.theme 时，风格令牌可以按行业给默认配色（tokens.industryThemes，如 quiz 的餐饮用暖色）
  const byIndustry = typeof sb.meta?.industry === 'string' ? def.tokens?.industryThemes?.[sb.meta.industry] : undefined;
  const themeName = typeof sb.meta?.theme === 'string' ? sb.meta.theme : typeof byIndustry === 'string' ? byIndustry : undefined;
  const pal = (def.tokens?.themes?.[themeName ?? ''] ?? def.tokens?.themes?.[def.tokens?.defaultTheme ?? ''] ?? {}) as Record<string, string>;
  const fp = {sb, slots, beat, geo};
  const {Film, Background: StyleBg, Overlay} = def;
  return (
    <AspectProvider geo={geo}>
      <StyleTokensProvider tokens={def.tokens} themeName={themeName}>
        <ThemeProvider theme={theme}>
          <AbsoluteFill style={{fontFamily: def.tokens?.font?.family ?? FONT, overflow: 'hidden', background: pal.bg ?? theme.bgBot[0]}}>
            {StyleBg ? <StyleBg {...fp} /> : null}
            <LayoutProbe frames={sb.__probe}>
              {Film
                ? <Film {...fp} />
                : slots.map((s) => {
                    const isLast = s.i === slots.length - 1;
                    const from = Math.round(s.start * FPS);
                    const len = Math.max(1, Math.round(s.dur * FPS) + (isLast ? 0 : OUT_FRAMES));
                    return (
                      <Sequence key={s.i} from={from} durationInFrames={len} name={`${s.i + 1}-${s.shot.type}`}>
                        <ShotHost slot={s} beat={beat} sb={sb} isLast={isLast} lookup={lookup} />
                      </Sequence>
                    );
                  })}
              {def.manifest.captionLayer === 'cards' ? <Captions slots={slots} beat={beat} lang={sb.meta?.lang} /> : null}
              {Overlay ? <Overlay {...fp} /> : null}
              <StyleChrome meta={sb.meta} />
            </LayoutProbe>
            <SfxTrack cues={cues} />
            <Bgm sb={sb} frames={frames} />
          </AbsoluteFill>
        </ThemeProvider>
      </StyleTokensProvider>
    </AspectProvider>
  );
};

// ---------------- ShotLab：单镜自测。props 只给 type 就用 spec.example ----------------
// style / aspect 可选：{"type":"phraseTitle","style":"quiz"}、{"type":"district","style":"journey","aspect":"9:16"}
export type LabProps = {type: string; style?: string; aspect?: '9:16' | '4:5'; theme?: ThemeName | (string & {}); brandColor?: string; params?: Record<string, unknown>; caption?: string | string[]; dur?: number; mood?: number};

export const labStoryboard = (p: LabProps): Storyboard => {
  const spec = lookupFor({meta: {style: p.style}} as Storyboard).specOf(p.type);
  const ex = spec?.example ?? {params: {}};
  const shot: Shot = {
    type: p.type as Shot['type'],
    dur: p.dur ?? ex.dur ?? spec?.dur.default ?? 3,
    caption: p.caption ?? ex.caption,
    mood: p.mood ?? ex.mood,
    params: p.params ?? ex.params,
  };
  const cards = !p.style || p.style === DEFAULT_STYLE;
  return {
    // i18n-ignore：ShotLab/ShotScreen 是开发自测和中文示意截图，不进正式片
    meta: {title: 'lab', product: 'lab', theme: p.theme ?? (cards ? 'warm-emotion' : ''), brandColor: p.brandColor, disclaimer: '演示场景，内容为模拟', ...(cards ? {} : {style: p.style}), ...(p.aspect ? {aspect: p.aspect} : {})},
    shots: [shot],
  };
};

export const ShotLab: React.FC<LabProps> = (p) => <Promo {...labStoryboard(p)} />;

// ---------------- Screen：把一个镜头（通常是 mockApp）渲成「App 截图」，给 phone 镜头当示意素材 ----------------
// 没有字幕、免责、音效；中性底色 + 顶栏。用法见 SHOT_API.md 第 9 节。
export const ShotScreen: React.FC<LabProps> = (p) => {
  const sb = labStoryboard({...p, caption: undefined});
  sb.shots[0].caption = undefined;
  const theme = resolveTheme(sb.meta.theme, sb.meta.brandColor);
  const slots = schedule(sb, specOf);
  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={{fontFamily: FONT, overflow: 'hidden', background: theme.dark ? '#10131c' : '#F2F4F7'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 150, background: theme.accent}} />
        {/* 镜头主体区 y 560–1340（中心 950）放大 1.1 倍、上移到顶栏下。不能再大：phone 镜头按屏幕比例裁掉截图左右各约 100px */}
        <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '540px 950px', transform: 'translateY(-330px) scale(1.1)'}}>
          <ShotHost slot={slots[0]} beat={beatOf(sb)} sb={sb} isLast />
        </div>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
