import React from 'react';
import {AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {FONT} from '../core/font';
import {lessonThemes, type LessonTheme} from './theme';
import type {LayoutProps, StageMode} from './layouts/shared';
import {PageHeader} from './layouts/shared';
import {Cover} from './layouts/Cover';
import {Steps} from './layouts/Steps';
import {Chapter} from './layouts/Chapter';
import {Quote} from './layouts/Quote';
import {Compare} from './layouts/Compare';
import {Question} from './layouts/Question';
import {Flow} from './layouts/Flow';
import {Recap} from './layouts/Recap';
import {Screenshot} from './layouts/Screenshot';
import {Code} from './layouts/Code';
import {Points} from './layouts/Points';
import {Statement} from './layouts/Statement';
import {Timeline} from './layouts/Timeline';
import {Checklist} from './layouts/Checklist';
import {BigNumber} from './layouts/BigNumber';
import {Saying} from './layouts/Saying';
import {Levels} from './layouts/Levels';
import {CaseStudy} from './layouts/CaseStudy';
import {DocumentMark} from './layouts/DocumentMark';
import {TableCompare} from './layouts/TableCompare';
import {BrandEnd} from './layouts/BrandEnd';
import type {LessonPage, LessonPresenterClip, LessonTimeline} from './types';
import {subtitleScreenAtFrame} from '../../../scripts/lesson/timeline.mjs';
import {protectBreaks, WORD_JOINER} from '../../../scripts/lesson/title-wrap.mjs';
import {fitHookLines} from '../../../scripts/lesson/title-wrap.mjs';
import {pick} from '../core/kit';
import {LegalMarkings, VerticalChrome} from './overlays/LegalMarkings';
import {BrandBug, BrandEnding, BrandNameBar} from './brand/BrandChrome';
import {Character, POSE_BLEND_MS, blinkAt, mouthOpenAmount, poseAt, talkingAt} from './mascot';
import type {MascotWardrobe} from './mascot';
import {avatarFrameStyle, cartoonBox, cartoonFrameStyle, COVER_MORPH, morphBox, objectPosition, realBox, realFrameStyle, MORPH_MS} from './presenter-place.mjs';
import {chapterLineKey, chapterLineMode, contentMotion, nameBarSlide, sameChapterLine, SUBTITLE, subtitleChrome, subtitleLayout, turnOutFrames} from './stage.mjs';
import {VERTICAL, chromeTopReserve, shouldShowHook, verticalChromeBoxes, verticalContentBox, verticalNoteBox, verticalPresenterBox, verticalSubtitleBox} from '../../../scripts/lesson/vertical-layout.mjs';
import {CanvasProvider, useCanvas, type LessonBrandView, type PresenterKind} from './canvas';

const lessonLayouts: Record<string, React.FC<LayoutProps>> = {cover:Cover, steps:Steps, chapter:Chapter, quote:Quote, compare:Compare, question:Question, flow:Flow, recap:Recap, screenshot:Screenshot, code:Code, points:Points, statement:Statement, timeline:Timeline, checklist:Checklist, bignumber:BigNumber, saying:Saying, levels:Levels, case:CaseStudy, document:DocumentMark, table:TableCompare, brandEnd:BrandEnd};
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.55'/></svg>")`;

export type LessonProps = {timeline: LessonTimeline; title: string; bgm?: string | null; theme?: LessonTheme; mascot?: MascotWardrobe | null; domain?: string; lang?: 'zh' | 'en'; sampleReview?: boolean; characterUnconfirmed?: boolean; trial?: boolean; orientation?: 'horizontal' | 'vertical'; hookTitle?: string; legalTailFrames?: number; brand?: LessonBrandView | null};
type PagePart = 'all' | 'content' | 'overlay';

const stageFor = (page: LessonPage): StageMode => {
  const portraitFull = page.presenter?.layout === 'full' && (page.presenter.aspectRatio ?? 1) < 1;
  if (portraitFull) return 'side';
  if (page.layout === 'cover') return 'cover';
  if (page.layout === 'screenshot' || page.layout === 'code') return 'tall';
  return 'standard';
};

const PresenterVideo: React.FC<{presenter: LessonPresenterClip; page: LessonPage; fps: number; theme: LessonTheme; box: {x: number; y: number; w: number; h: number; radius: number; shape: string; eyeY: number}; landscape?: boolean}> = ({presenter, page, fps, theme, box, landscape = false}) => {
  const canvas = useCanvas();
  if (presenter.layout === 'hidden' || !box) return null;
  const base = lessonThemes[theme];
  const override = canvas.brandColors;
  const t = override ? {...base, accent: override.accent || base.accent, ...(override.deco ? {deco: override.deco} : {})} : base;
  const chrome = landscape && box.shape === 'circle' ? avatarFrameStyle(t) : realFrameStyle(t, box);
  const leadFrames = page.audioStartFrame - page.startFrame;
  const trimBefore = Math.round(presenter.startMs * fps / 1000);
  const sourceFrames = Math.max(1, Math.ceil(presenter.endMs * fps / 1000) - trimBefore);
  const liveFrames = Math.min(Math.ceil(page.audioDurationMs * fps / 1000), sourceFrames);
  const tailFrom = leadFrames + liveFrames;
  const clip = () => <OffthreadVideo src={staticFile(presenter.src)} trimBefore={trimBefore} muted style={{width:'100%', height:'100%', objectFit:'cover', objectPosition: objectPosition(box)}} />;
  return <div style={{position:'absolute', left:box.x, top:box.y, width:box.w, height:box.h, zIndex:3, overflow:'hidden', boxSizing:'border-box', borderRadius:chrome.borderRadius, background:chrome.background, border:chrome.border === 'none' ? undefined : chrome.border, boxShadow:chrome.boxShadow === 'none' ? undefined : chrome.boxShadow}}>
    {leadFrames > 0 ? <Sequence layout="none" from={0} durationInFrames={leadFrames} name={`presenter-lead-${page.index + 1}`}><Freeze frame={0}>{clip()}</Freeze></Sequence> : null}
    <Sequence layout="none" from={leadFrames} durationInFrames={Math.max(1, liveFrames)} name={`presenter-${page.index + 1}`}>{clip()}</Sequence>
    {tailFrom < page.durationFrames ? <Sequence layout="none" from={tailFrom} durationInFrames={page.durationFrames - tailFrom} name={`presenter-tail-${page.index + 1}`}><Freeze frame={Math.max(0, liveFrames - 1)}>{clip()}</Freeze></Sequence> : null}
  </div>;
};

const Page: React.FC<{page: LessonPage; timeline: LessonTimeline; theme: LessonTheme; mascot?: MascotWardrobe | null; domain?: string; lang?: 'zh' | 'en'; sampleReview?: boolean; trial?: boolean; orientation?: 'horizontal' | 'vertical'; part?: PagePart; first?: boolean}> = ({page, timeline, theme, mascot, domain, lang, sampleReview, trial = false, orientation = 'horizontal', part = 'all', first = true}) => {
  const frame = useCurrentFrame();
  const Layout = lessonLayouts[page.layout];
  const globalFrame = frame + page.startFrame;
  const elapsedMs = globalFrame * 1000 / timeline.fps;
  const localMs = frame * 1000 / timeline.fps;
  const currentSubtitle = subtitleScreenAtFrame(timeline, globalFrame);
  const sentenceIndex = page.sentences.reduce((found, sentence, index) => sentence.startMs <= elapsedMs ? index : found, -1);
  const sentence = sentenceIndex >= 0 ? page.sentences[sentenceIndex] : null;
  const previousSentence = sentenceIndex > 0 ? page.sentences[sentenceIndex - 1] : null;
  const pose = poseAt(sentence?.pose);
  const fromPose = poseAt(previousSentence?.pose);
  const poseProgress = sentence ? Math.max(0, Math.min(1, (elapsedMs - sentence.startMs) / POSE_BLEND_MS)) : 1;
  const charOffsetMs = sentence?.chars.length ? sentence.startMs - sentence.chars[0].startMs : 0;
  const speaking = sentence ? talkingAt(sentence.chars, elapsedMs, charOffsetMs) : false;
  const mouthAmount = sentence ? mouthOpenAmount(sentence.chars, elapsedMs, charOffsetMs, sentence.endMs) : 0;
  const vertical = orientation === 'vertical';
  const motionMs = vertical ? elapsedMs : localMs;
  const canvas = useCanvas();
  const baseTheme = lessonThemes[theme] ?? lessonThemes.lecture;
  const override = canvas.brandColors;
  const t = override ? {...baseTheme, accent: override.accent || baseTheme.accent, ...(override.deco ? {deco: override.deco} : {})} : baseTheme;
  const stage = stageFor(page);
  const pos = timeline.pages.findIndex((item) => item.index === page.index);
  const prevPage = pos > 0 ? timeline.pages[pos - 1] : undefined;
  const nextPage = pos >= 0 && pos + 1 < timeline.pages.length ? timeline.pages[pos + 1] : undefined;
  const morphT = frame / Math.max(1, (MORPH_MS / 1000) * timeline.fps);
  const place = {
    layout: page.layout,
    frame: canvas.clipFrame,
    fps: timeline.fps,
    showHook: canvas.showHook,
    hookBottom: canvas.hookBottom,
    pageFrame: canvas.pageFrame,
    prevLayout: canvas.prevLayout,
    topReserve: canvas.topReserve,
    sampleReview: canvas.sampleReview,
    brandBug: canvas.brandBug === true,
  };
  const brandedCover = Boolean(canvas.brand) && page.layout === 'cover' && !vertical;
  const brandedEnding = Boolean(canvas.brand) && (page.layout === 'brandEnd' || page.index === canvas.brandRecapIndex);
  const hidePresenter = brandedCover || page.layout === 'brandEnd' || brandedEnding;
  const realLive = !hidePresenter && page.presenter ? (vertical ? verticalPresenterBox('real', place) : morphBox(prevPage?.presenter ? realBox(prevPage) : null, realBox(page), morphT)) : null;
  const cartoonTarget = cartoonBox(page.layout);
  const cartoonFrom = !vertical && prevPage?.layout === 'cover' && !canvas.brand ? cartoonBox('cover') : cartoonTarget;
  const coverT = frame / Math.max(1, (COVER_MORPH / 1000) * timeline.fps);
  const cartoonLive = !hidePresenter && !page.presenter && mascot?.enabled !== false ? (vertical ? verticalPresenterBox('cartoon', place) : morphBox(cartoonFrom, cartoonTarget, coverT)) : null;
  const wardrobe = mascot?.pageOverrides?.find((variant) => variant.pageIndex === page.index)?.wardrobe ?? mascot;
  const mascotEnabled = !page.presenter && mascot?.enabled !== false && wardrobe?.enabled !== false && !!cartoonLive;
  const cartoonChrome = vertical ? cartoonFrameStyle() : avatarFrameStyle(t);
  const bubbleAnchor = realLive ?? cartoonLive;
  const bubble = vertical && sentence?.note && elapsedMs < sentence.endMs ? verticalNoteBox(bubbleAnchor) : null;
  const pushT = brandedCover || page.layout === 'brandEnd' ? 0 : Math.min(1, frame / Math.max(1, timeline.fps * t.pushSeconds));
  const scale = vertical ? 1 : 1 + pushT * t.push;
  const drift = vertical ? 0 : pushT * t.drift * 1920;
  const sceneContent = vertical ? verticalContentBox(canvas.pageLayout || page.layout, canvas.presenter, place) : null;
  const sub = vertical ? verticalSubtitleBox(sceneContent) : null;
  const bar = !vertical && currentSubtitle ? subtitleLayout(currentSubtitle.text) : null;
  const subChrome = subtitleChrome(t);
  const subBottom = brandedCover ? 132 : SUBTITLE.bottom;
  const subSize = vertical ? (typeof currentSubtitle?.fontPx === 'number' ? currentSubtitle.fontPx : Math.max(VERTICAL.subtitleMinPx, t.subtitleSize)) : (bar?.font ?? SUBTITLE.fontPx);
  const chapterTitles = timeline.chapters.map((chapter) => chapter.title);
  const karaokeOn = t.karaoke && currentSubtitle && !vertical;
  let spokenVisible = 0;
  if (karaokeOn && currentSubtitle && currentSubtitle.endMs > currentSubtitle.startMs) {
    const ratio = Math.max(0, Math.min(1, (elapsedMs - currentSubtitle.startMs) / (currentSubtitle.endMs - currentSubtitle.startMs)));
    const chars = Array.from(protectBreaks(currentSubtitle.text)).filter((ch) => ch !== WORD_JOINER);
    spokenVisible = Math.round(chars.length * ratio);
  }
  const showContent = part !== 'overlay';
  const showOverlay = part !== 'content';
  const horizontalTurn = part === 'content';
  const inTail = horizontalTurn && frame >= page.durationFrames;
  const tMs = (inTail ? frame - page.durationFrames : frame) * 1000 / timeline.fps;
  const motion = horizontalTurn ? contentMotion({first, inTail, tMs}) : {opacity: 1, dy: 0};
  const lineOpts = {brandRecapIndex: canvas.brandRecapIndex ?? null};
  const lineKey = !vertical && horizontalTurn ? chapterLineKey(page, lineOpts) : null;
  const lineMode = chapterLineMode({
    key: lineKey,
    first,
    inTail,
    holdPrev: sameChapterLine(prevPage, page, lineOpts),
    holdNext: sameChapterLine(page, nextPage, lineOpts),
    tMs,
  });
  const texture = <>
    {t.texture !== 'none' ? <div style={{position:'absolute', inset:0, pointerEvents:'none', opacity:t.grain, backgroundImage:GRAIN, backgroundSize:'180px 180px'}} /> : null}
    {t.id === 'paper' ? <div style={{position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse farthest-corner at 50% 50%, rgba(70,50,20,0) 70%, rgba(70,50,20,.04) 100%)'}} /> : null}
    {t.id === 'lecture' ? <div style={{position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse at 50% 45%, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 60%)'}} /> : null}
  </>;
  const origin = vertical ? '540px 800px' : '960px 465px';
  const settled = !horizontalTurn || (!inTail && motion.opacity === 1 && motion.dy === 0);
  const placed = `translateX(${drift}px) scale(${scale})`;
  const moving = `${motion.dy ? `translateY(${motion.dy}px) ` : ''}${placed}`;
  return <AbsoluteFill style={{background: part === 'all' ? t.bg : 'transparent', color:t.ink, fontFamily:FONT, overflow:'hidden'}}>
    {part === 'all' ? texture : null}
    {showContent && settled ? <div style={{position:'absolute', inset:0, opacity:1, transform:placed, transformOrigin:origin}}>
      {vertical ? null : <PageHeader page={page} theme={theme} lang={lang ?? 'zh'} />}
      {Layout ? <Layout page={page} fields={page.fields} theme={theme} lang={lang ?? 'zh'} stage={stage} domain={domain} chapterTitles={chapterTitles} /> : null}
    </div> : null}
    {showContent && !settled && lineMode === 'stable' ? <div style={{position:'absolute', inset:0, transform:placed, transformOrigin:origin}}>
      <PageHeader page={page} theme={theme} lang={lang ?? 'zh'} slot="chapter" />
    </div> : null}
    {showContent && !settled ? <div style={{position:'absolute', inset:0, opacity:motion.opacity, transform:moving, transformOrigin:origin}}>
      {lineMode === 'turn' ? <PageHeader page={page} theme={theme} lang={lang ?? 'zh'} slot="chapter" /> : null}
      {vertical ? null : <PageHeader page={page} theme={theme} lang={lang ?? 'zh'} slot="title" />}
      {Layout ? <Layout page={page} fields={page.fields} theme={theme} lang={lang ?? 'zh'} stage={stage} domain={domain} chapterTitles={chapterTitles} /> : null}
    </div> : null}
    {showOverlay && !hidePresenter && page.presenter && realLive ? <PresenterVideo presenter={page.presenter} page={page} fps={timeline.fps} theme={theme} box={realLive} landscape={!vertical} /> : null}
    {showOverlay && mascotEnabled && cartoonLive ? <div style={{position:'absolute', left:cartoonLive.x, top:cartoonLive.y, width:cartoonLive.w, height:cartoonLive.h, zIndex:3, pointerEvents:'none', boxSizing:'border-box', overflow:cartoonChrome.overflow, borderRadius:cartoonChrome.borderRadius, background:cartoonChrome.background, border:cartoonChrome.border === 'none' ? undefined : cartoonChrome.border, boxShadow:cartoonChrome.boxShadow === 'none' ? undefined : cartoonChrome.boxShadow, opacity:1}}>
      <Character pose={pose} fromPose={fromPose} progress={poseProgress} mouth={mouthAmount} blink={blinkAt(motionMs, page.index * 19, speaking)} elapsedMs={motionMs} wardrobe={wardrobe} ink={t.ink} surface={t.surface} crop={vertical ? 'card' : 'bust'} frameWidth={cartoonLive.w} frameHeight={cartoonLive.h} />
    </div> : null}
    {showOverlay && bubble && sentence?.note ? <div style={{position:'absolute', left:bubble.x, top:bubble.y, width:bubble.w, zIndex:4, padding:'12px 14px', borderRadius:t.radius, background:t.surface, color:t.ink, border:t.cardBorder, boxShadow:t.cardShadow === 'none' ? undefined : t.cardShadow, fontFamily:t.fontBody, fontWeight:t.headingWeight > 500 ? 700 : 600, fontSize:28, textAlign:'center'}}>{sentence.note}</div> : null}
    {showOverlay && vertical && currentSubtitle && sub ? <div style={{position:'absolute', left:sub.x, top:sub.y, width:sub.width, height:sub.height, zIndex:5, display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', fontFamily:t.fontBody, fontWeight:500, fontSize:subSize, lineHeight:1.2, color:t.subtitleInk, WebkitTextStroke:`4px ${t.subtitleHalo}`, paintOrder:'stroke fill', wordBreak:'normal'}}>
      {protectBreaks(currentSubtitle.text)}
    </div> : null}
    {showOverlay && bar && currentSubtitle ? <div style={{position:'absolute', left:SUBTITLE.centerX, bottom:subBottom, transform:'translateX(-50%)', width:bar.width, maxWidth:SUBTITLE.maxWidth, zIndex:5, boxSizing:'border-box', padding:`${SUBTITLE.padY}px ${SUBTITLE.padX}px`, borderRadius:subChrome.radius, background:subChrome.background, color:subChrome.color, textAlign:'center', fontFamily:t.fontBody, fontWeight:500, fontSize:bar.font, lineHeight:bar.lineHeight}}>
      {bar.lines.map((line, index) => {
        const chars = Array.from(line);
        const take = karaokeOn ? Math.max(0, Math.min(chars.length, spokenVisible)) : chars.length;
        if (karaokeOn) spokenVisible -= take;
        const spoken = chars.slice(0, take).join('');
        const rest = chars.slice(take).join('');
        return <div key={index} style={{whiteSpace:'nowrap'}}>{karaokeOn ? <><span style={{color:subChrome.karaokeSpoken}}>{protectBreaks(spoken)}</span><span style={{color:subChrome.karaokeRest}}>{protectBreaks(rest)}</span></> : protectBreaks(line)}</div>;
      })}
    </div> : null}
    {showOverlay && !vertical && canvas.brandBug && !brandedCover && !brandedEnding ? <BrandBug theme={theme} /> : null}
    {showOverlay && canvas.brand?.lawyer && page.index === canvas.nameBarPage ? <BrandNameBar theme={theme} vertical={vertical} slide={nameBarSlide(localMs, page.durationFrames * 1000 / timeline.fps)} box={vertical && (cartoonLive || realLive) ? {right: 1080 - ((cartoonLive || realLive)!.x + (cartoonLive || realLive)!.w), bottom: 1920 - (cartoonLive || realLive)!.y + 12} : null} /> : null}
    {showOverlay && !vertical && brandedEnding ? <BrandEnding theme={theme} lang={lang} disclaimerBottom={page.layout === 'brandEnd' ? 70 : 150} /> : null}
    {showOverlay && !vertical ? <LegalMarkings domain={domain} lang={lang} frame={globalFrame} totalFrames={timeline.totalFrames} sampleReview={sampleReview} trial={trial} theme={theme} branded={Boolean(canvas.brand)} /> : null}
  </AbsoluteFill>;
};

const presenterKindOf = (timeline: LessonTimeline, mascot?: MascotWardrobe | null): PresenterKind => {
  if (timeline.pages.some((page) => page.presenter)) return 'real';
  if (mascot?.enabled === false) return 'none';
  return 'cartoon';
};

const Texture: React.FC<{theme: LessonTheme}> = ({theme}) => {
  const t = lessonThemes[theme];
  return <>
    {t.texture !== 'none' ? <div style={{position:'absolute', inset:0, pointerEvents:'none', opacity:t.grain, backgroundImage:GRAIN, backgroundSize:'180px 180px'}} /> : null}
    {t.id === 'paper' ? <div style={{position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse farthest-corner at 50% 50%, rgba(70,50,20,0) 70%, rgba(70,50,20,.04) 100%)'}} /> : null}
    {t.id === 'lecture' ? <div style={{position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse at 50% 45%, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 60%)'}} /> : null}
  </>;
};

export const Lesson: React.FC<LessonProps> = ({timeline, title: _title, bgm, theme = 'lecture', mascot, domain, lang, sampleReview = false, characterUnconfirmed = false, trial = false, orientation = 'horizontal', hookTitle = '', legalTailFrames = 0, brand = null}) => {
  const frame = useCurrentFrame();
  const vertical = orientation === 'vertical';
  const t = lessonThemes[theme];
  const presenterKind = presenterKindOf(timeline, mascot);
  const showLabel = vertical && frame < 90;
  const pageNow = timeline.pages.find((item) => frame >= item.startFrame && frame < item.endFrame) ?? timeline.pages[timeline.pages.length - 1];
  const showHook = vertical && shouldShowHook(hookTitle, pageNow, frame, {domain, lang});
  const hookLines = showHook ? fitHookLines(hookTitle, (VERTICAL.safe.right - VERTICAL.safe.x) / VERTICAL.hookFont) : [];
  const chromeOpts = {sampleReview, showLabel, showHook: hookLines.length > 0, hookLines: Math.max(1, hookLines.length), brandBug: Boolean(brand)};
  const topReserve = vertical ? chromeTopReserve(chromeOpts) : 0;
  const chrome = vertical ? verticalChromeBoxes(chromeOpts) : null;
  const hookBottom = chrome?.hook ? chrome.hook.y + chrome.hook.h : VERTICAL.safe.y + topReserve;
  const pageFrame = pageNow ? frame - pageNow.startFrame : 0;
  const nowPos = pageNow ? timeline.pages.findIndex((item) => item.index === pageNow.index) : -1;
  const prevLayout = nowPos > 0 ? timeline.pages[nowPos - 1]?.layout : undefined;
  const tail = turnOutFrames(timeline.fps);
  const lastPos = timeline.pages.length - 1;
  const pageProps = {timeline, theme, mascot, domain, lang, sampleReview, trial, orientation};
  return <AbsoluteFill style={{background: t.bg}}>
    <CanvasProvider value={{orientation: vertical ? 'vertical' : 'horizontal', presenter: presenterKind, sampleReview, topReserve, hookTitle: vertical ? hookTitle : '', clipFrame: frame, fps: timeline.fps, showHook: hookLines.length > 0, hookBottom, pageLayout: pageNow?.layout, pageFrame, prevLayout, pageIndex: pageNow?.index ?? null, brand, brandColors: brand ? {accent: brand.primary, ...(brand.secondary ? {deco: brand.secondary} : {})} : null, brandBug: Boolean(brand), brandRecapIndex: brand?.recapIndex ?? null, nameBarPage: brand?.nameBarPage ?? null}}>
      {vertical ? null : <Texture theme={theme} />}
      {vertical ? timeline.pages.map((page) => <Sequence key={page.index} from={page.startFrame} durationInFrames={page.durationFrames} name={`page-${page.index + 1}`}>
        <Page page={page} {...pageProps} />
        {page.audio ? <Sequence from={page.audioStartFrame - page.startFrame} durationInFrames={Math.max(1, Math.ceil(page.audioDurationMs * timeline.fps / 1000))}>
          <Audio src={staticFile(page.audio)} />
        </Sequence> : null}
      </Sequence>) : <>
        {timeline.pages.map((page, pos) => <Sequence key={`content-${page.index}`} from={page.startFrame} durationInFrames={page.durationFrames + (pos === lastPos ? 0 : tail)} name={`page-content-${page.index + 1}`}>
          <Page page={page} {...pageProps} part="content" first={pos === 0} />
        </Sequence>)}
        {timeline.pages.map((page) => <Sequence key={`overlay-${page.index}`} from={page.startFrame} durationInFrames={page.durationFrames} name={`page-${page.index + 1}`}>
          <Page page={page} {...pageProps} part="overlay" />
          {page.audio ? <Sequence from={page.audioStartFrame - page.startFrame} durationInFrames={Math.max(1, Math.ceil(page.audioDurationMs * timeline.fps / 1000))}>
            <Audio src={staticFile(page.audio)} />
          </Sequence> : null}
        </Sequence>)}
      </>}
      {vertical ? <VerticalChrome domain={domain} lang={lang} frame={frame} totalFrames={timeline.totalFrames} sampleReview={sampleReview} trial={trial} theme={theme} hookTitle={showHook ? hookTitle : ''} legalTailFrames={legalTailFrames} brandBug={Boolean(brand)} /> : null}
      {characterUnconfirmed ? <div aria-label={pick(lang, '角色未确认', 'Character not confirmed')} style={{position:'absolute', left: vertical ? 180 : 48, top: vertical ? 268 : undefined, bottom: vertical ? undefined : 28, zIndex:41, padding:'4px 10px', borderRadius:t.badgeRadius, background:'rgba(140,72,0,.92)', color:'#fff', fontFamily:t.fontBody, fontSize:22, fontWeight:700, letterSpacing:1, pointerEvents:'none'}}>{pick(lang, '角色未确认', 'Character not confirmed')}</div> : null}
    </CanvasProvider>
    {bgm ? <Audio src={staticFile(bgm)} volume={0.22} loop /> : null}
  </AbsoluteFill>;
};
