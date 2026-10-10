import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {lessonThemes, type LessonTheme} from './theme';
import type {LessonPage} from './types';

export type LayoutProps = {page: LessonPage; theme: LessonTheme};
const MascotSlot: React.FC = () => <div aria-label="mascot slot" style={{position: 'absolute', right: 92, bottom: 152, width: 360, height: 360}} />;
const showFor = (page: LessonPage, reveal: number, frame: number) => {
  const at = page.sentences.filter((s) => s.reveal === reveal).reduce((m, s) => Math.min(m, s.revealAtMs ?? Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  return at === Number.MAX_SAFE_INTEGER ? 1 : Math.max(0, Math.min(1, (frame * 1000 / 30 - at) / 350));
};

const Cover: React.FC<LayoutProps> = ({page, theme}) => {
  const t = lessonThemes[theme];
  return <AbsoluteFill style={{justifyContent: 'center', padding: '110px 540px 170px 150px', boxSizing: 'border-box'}}>
    <div style={{width: 100, height: 8, borderRadius: 8, background: t.accent, marginBottom: 36}} />
    <div style={{fontSize: 72, fontWeight: 750, lineHeight: 1.2, color: t.ink, whiteSpace: 'pre-wrap', opacity: showFor(page,0,useCurrentFrame())}}>{page.title}</div>
    <div style={{fontSize: 38, lineHeight: 1.5, color: t.muted, marginTop: 28, maxWidth: 1120, opacity: showFor(page,1,useCurrentFrame())}}>{page.subtitle}</div>
    {page.smallText ? <div style={{fontSize: 24, color: t.muted, marginTop: 44, opacity: showFor(page,2,useCurrentFrame())}}>{page.smallText}</div> : null}
    <MascotSlot />
  </AbsoluteFill>;
};

const Steps: React.FC<LayoutProps> = ({page, theme}) => {
  const t = lessonThemes[theme];
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{padding: '104px 540px 150px 150px', boxSizing: 'border-box'}}>
    <div style={{fontSize: 54, fontWeight: 720, color: t.ink, marginBottom: 34, lineHeight: 1.2}}>{page.title}</div>
    <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
      {page.items.map((item, i) => {
        const progress = showFor(page, i, frame);
        return <div key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 22, padding: '22px 26px', borderRadius: 20, background: t.surface, border: `1px solid ${t.line}`, opacity: progress, transform: `translateY(${(1 - progress) * 14}px)`, boxShadow: '0 10px 28px rgba(18, 37, 61, .045)'}}>
          <div style={{width: 44, height: 44, borderRadius: 22, background: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24, flex: '0 0 auto'}}>{i + 1}</div>
          <div style={{fontSize: 34, lineHeight: 1.4, color: t.ink, whiteSpace: 'pre-wrap'}}>{item}</div>
        </div>;
      })}
    </div>
    <MascotSlot />
  </AbsoluteFill>;
};

/** M2 只需向此注册表追加 layout → 组件映射；M1 校验先行限制实际输入。 */
export const lessonLayouts: Record<string, React.FC<LayoutProps>> = {cover: Cover, steps: Steps};
