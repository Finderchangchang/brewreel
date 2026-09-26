import React from 'react';
import {Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {Storyboard} from '../schema';
import {clamp} from './anim';
import {FONT} from './font';
import {Lang, glyph, parseRich} from './kit';
import {CAP, DISCLAIMER_Y, FPS} from './safe';
import {fitLine, fitSize} from './fit';
import {moodColors, useTheme} from './theme';
import type {Slot} from './timeline';
import {EXIT} from './timeline';
import type {SfxCue, ShotModule, ShotSpec} from './types';

const useSec = () => useCurrentFrame() / FPS;

const piecewise = (pts: [number, number][], t: number) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, va] = pts[i];
    const [b, vb] = pts[i + 1];
    if (t >= a && t <= b) return b === a ? vb : interpolate(t, [a, b], [va, vb], {easing: Easing.inOut(Easing.sin)});
  }
  return pts[pts.length - 1][1];
};

// ---------------- 背景：主题渐变随 mood 过渡 + 柔光 + 两团慢慢漂的光斑 ----------------
export const Background: React.FC<{slots: Slot[]}> = ({slots}) => {
  const th = useTheme();
  const t = useSec();
  // mood 就近归到 0 / 0.5 / 1 三档再过渡：两端色直接 RGB 插值的中间值（如 0.2）发灰，不好看
  const band = (m: number) => (m < 0.25 ? 0 : m > 0.75 ? 1 : 0.5);
  // 跨两档（暖红 ↔ 冷色）时不做 0.6 秒的渐变：RGB 中间色是灰橄榄/灰紫，很脏。改成在整拍上 3 帧内切过去 + 一次短闪白
  const pts: [number, number][] = [[0, band(slots[0]?.mood ?? 0.5)]];
  for (let i = 1; i < slots.length; i++) {
    const a = band(slots[i - 1].mood);
    const b = band(slots[i].mood);
    if (Math.abs(a - b) > 0.75) {
      pts.push([slots[i].start - 0.05, a]);
      pts.push([slots[i].start + 0.05, b]);
    } else {
      pts.push([slots[i].start - 0.1, a]);
      pts.push([slots[i].start + 0.5, b]);
    }
  }
  const m = piecewise(pts, t);
  const {top, bot} = moodColors(th, m);
  const drift = (ph: number, amp: number) => Math.sin(t * 0.5 + ph) * amp;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: `linear-gradient(170deg, ${top} 0%, ${bot} 100%)`}} />
      <div
        style={{
          position: 'absolute',
          left: -260 + drift(0, 60),
          top: 980 + drift(1.3, 80),
          width: 820,
          height: 820,
          borderRadius: '50%',
          background: th.blobs[0],
          filter: 'blur(90px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 560 + drift(2.1, 70),
          top: 120 + drift(0.4, 60),
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: th.blobs[1],
          filter: 'blur(100px)',
        }}
      />
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 35%, ${th.glow} 0%, rgba(255,255,255,0) 60%)`}} />
    </div>
  );
};

/** 跨两档的情绪切换点（暖红 ↔ 冷色），这些点上背景硬切 + 闪白 */
export const moodCuts = (slots: Slot[]) => {
  const band = (m: number) => (m < 0.25 ? 0 : m > 0.75 ? 1 : 0.5);
  const out: number[] = [];
  for (let i = 1; i < slots.length; i++) if (Math.abs(band(slots[i - 1].mood) - band(slots[i].mood)) > 0.75) out.push(slots[i].start);
  return out;
};

// ---------------- 闪白：盖在镜头上面、字幕下面，遮住硬切瞬间两镜重叠的那几帧 ----------------
export const MoodFlash: React.FC<{slots: Slot[]}> = ({slots}) => {
  const t = useSec();
  const f = moodCuts(slots).reduce((acc, c) => Math.max(acc, t < c - 0.07 ? 0 : t < c ? (t - c + 0.07) / 0.07 : Math.max(0, 1 - (t - c) / 0.3)), 0);
  return f > 0 ? <div style={{position: 'absolute', inset: 0, background: '#ffffff', opacity: f * 0.7}} /> : null;
};

// ---------------- 抖音式大字幕：字幕带 y 260–540，自动字号 90→64，逐字进场；第 1 镜第 0 帧直接完整显示 ----------------
// CAP.min=64 是给中文短句校准的下限；同样的字数上限（按「汉字 1/拉丁 0.5」折算）英文句子明显更宽
// （单词间有空格、字母本身也没有汉字方正），64px 常常还是装不下、被挤出 x150–930。字幕不做自动换行
// （行由模型手动拆 \n），所以英文字幕的下限单独放宽到 44px（仍在 26px 的全局字号地板之上很多）
export const captionSize = (text: string, lang: Lang = 'zh') => fitSize(text, CAP.w, CAP.max, lang === 'en' ? 44 : CAP.min, 30);

/** 字幕数组的分段：n 句平分这一镜，分界吸附到整拍（与 scripts/validate.mjs 的 captionSegments 同一算法） */
export const captionSegments = (start: number, dur: number, n: number, beat: number): [number, number][] => {
  const cuts = [0];
  for (let k = 1; k < n; k++) cuts.push(Math.min(dur, Math.max(cuts[k - 1] + beat, Math.round((dur * k) / n / beat) * beat)));
  cuts.push(dur);
  return cuts.slice(0, -1).map((a, k) => [start + a, start + cuts[k + 1]]);
};

type CapSeg = {key: string; text: string; start: number; end: number; instant: boolean};

export const Captions: React.FC<{slots: Slot[]; beat?: number; lang?: Lang}> = ({slots, beat = 0.5, lang = 'zh'}) => {
  const th = useTheme();
  const t = useSec();
  const lineHeight = lang === 'en' ? 1.32 : 1.18;
  const total = slots.length ? slots[slots.length - 1].end : 0;
  const segs: CapSeg[] = [];
  for (const s of slots) {
    const c = s.shot.caption as unknown;
    const caps = (Array.isArray(c) ? c : [c]).filter((x): x is string => typeof x === 'string' && x.length > 0);
    if (!caps.length) continue;
    captionSegments(s.start, s.dur, caps.length, beat).forEach(([a, b], k) => segs.push({key: `${s.i}-${k}`, text: caps[k], start: a, end: b, instant: s.i === 0 && k === 0}));
  }
  return (
    <>
      {segs
        .filter((s) => t >= s.start && t < (s.end >= total ? total + 1 : s.end))
        .map((s) => {
          const text = s.text;
          const instant = s.instant;
          const size = captionSize(text, lang);
          const nLines = text.split('\n').length;
          const h = nLines * size * lineHeight;
          const top = Math.round(CAP.y0 + (CAP.y1 - CAP.y0 - h) / 2);
          const out = s.end >= total ? 1 : interpolate(t, [s.end - 0.15, s.end], [1, 0], clamp);
          let k = 0;
          return (
            <div
              key={s.key}
              style={{
                position: 'absolute',
                left: CAP.x0,
                width: CAP.w,
                top,
                textAlign: 'center',
                fontFamily: FONT,
                fontSize: size,
                fontWeight: 900,
                lineHeight,
                letterSpacing: lang === 'en' ? 0 : undefined,
                whiteSpace: 'nowrap',
                opacity: out,
                fontFeatureSettings: lang === 'en' ? undefined : '"palt"',
              }}
            >
              {parseRich(text).map((ch, j) => {
                if ('br' in ch) return <br key={j} />;
                const d = instant ? 1 : t - s.start - 0.03 - k++ * 0.025;
                const p = interpolate(d, [0, 0.16], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
                return (
                  <span
                    key={j}
                    style={{
                      display: 'inline-block',
                      ...glyph(th, size, ch.hot),
                      opacity: p,
                      transform: `translateY(${(1 - p) * 26}px) scale(${1 + (1 - p) * 0.18})`,
                      filter: p < 1 ? `blur(${(1 - p) * 4}px)` : undefined,
                    }}
                  >
                    {/* 单个空格是这个 span 里唯一内容时，CSS 会把它当成「行首+行尾的可折叠空白」直接吃掉
                        （英文标题最常见：单词间的空格全部消失、粘成一串）；换成不可折叠的 NBSP 就不会被吃 */}
                    {ch.c === ' ' ? ' ' : ch.c}
                  </span>
                );
              })}
            </div>
          );
        })}
    </>
  );
};

// ---------------- 角落免责小字（全程） ----------------
export const Disclaimer: React.FC<{text?: string; lang?: Lang}> = ({text, lang = 'zh'}) => {
  const th = useTheme();
  if (!text) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: DISCLAIMER_Y,
        textAlign: 'center',
        fontFamily: FONT,
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: lang === 'en' ? 0.4 : 1,
      }}
    >
      {/* 浅色主题上底色太亮，小字会糊：统一垫一层半透明深色胶囊，白字 */}
      <span
        style={{
          display: 'inline-block',
          padding: '4px 18px',
          borderRadius: 999,
          background: th.dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.20)',
          color: 'rgba(255,255,255,0.92)',
          lineHeight: 1.3,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ---------------- 底部常驻提示条（meta.notices，全程；和角落免责小字分开显示，互不冲突） ----------------
// 安全位置：y ≥1344（主体区 1340 以下，watermark logo 在 1392 起），字号 ≥26px，半透明深色底衬保证可读。
// 多条提示合并成一行（用 · 分隔），避免和下方 logo 水印叠高度；单条也够用绝大多数场景。
export const Notices: React.FC<{items?: string[]; lang?: Lang}> = ({items, lang = 'zh'}) => {
  const list = (items ?? []).map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean).slice(0, 3);
  if (!list.length) return null;
  const text = list.join('   ·   ');
  // 内容宽度按安全区收窄到 720（和 MAIN/CARD 一致），字号仍有 26px 下限；就算 3 条提示拼满也让它换行，
  // 不再用 nowrap 硬挤一行——之前 nowrap + 字号到下限还装不下时，整段会溢出安全区（round4 修复）
  const size = Math.max(26, Math.min(28, fitLine(text, 720, 28, 26)));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 1344, display: 'flex', justifyContent: 'center'}}>
      <span
        style={{
          display: 'inline-block',
          maxWidth: 780,
          padding: '6px 28px',
          borderRadius: 28,
          background: 'rgba(0,0,0,0.34)',
          color: 'rgba(255,255,255,0.94)',
          fontFamily: FONT,
          fontSize: size,
          fontWeight: 600,
          lineHeight: 1.35,
          letterSpacing: lang === 'en' ? 0.3 : 0.5,
          whiteSpace: 'normal',
          textAlign: 'center',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ---------------- 可选 logo 角标：主体区下方居中的小水印（hook / endCard 期间隐藏，它们自己会画 logo） ----------------
export const Watermark: React.FC<{logo?: string; slots: Slot[]}> = ({logo, slots}) => {
  const t = useSec();
  if (!logo) return null;
  const cur = slots.find((s) => t >= s.start && t < s.end) ?? slots[slots.length - 1];
  if (!cur || cur.shot.type === 'hook' || cur.shot.type === 'endCard') return null;
  const fade = Math.min(interpolate(t, [cur.start, cur.start + 0.3], [0, 1], clamp), interpolate(t, [cur.end - 0.3, cur.end], [1, 0], clamp));
  return (
    <Img
      src={staticFile(logo)}
      style={{position: 'absolute', left: 540 - 40, top: 1392, width: 80, height: 80, objectFit: 'contain', opacity: 0.85 * fade}}
    />
  );
};

// ---------------- 音效轨：各镜头 spec.sfx（或模块的 sfx()）平移到镜头起点 ----------------
const SFX_VOL: Record<string, number> = {pop: 0.28, tap: 0.18, thud: 0.45, whoosh: 0.35, swish: 0.3, ding: 0.3, tick: 0.25, puff: 0.3, ka: 0.3, pu: 0.3, dong: 0.4, bell: 0.3, crunch: 0.3};

export const collectSfx = (slots: Slot[], mod: (type: string) => ShotModule | undefined, spec: (type: string) => ShotSpec | undefined, beat: number) => {
  const out: SfxCue[] = [];
  for (const s of slots) {
    const m = mod(s.shot.type);
    const sp = spec(s.shot.type);
    let cues: SfxCue[] = [];
    try {
      cues = m?.sfx ? m.sfx(s.shot.params || {}, {dur: s.dur, beat}) : sp?.sfx ?? [];
    } catch {
      cues = sp?.sfx ?? [];
    }
    for (const c of cues) {
      if (c.at < 0 || c.at > s.dur + EXIT) continue;
      out.push({...c, at: s.start + c.at});
    }
  }
  return out;
};

export const SfxTrack: React.FC<{cues: SfxCue[]}> = ({cues}) => (
  <>
    {cues.map((c, i) => (
      <Sequence key={i} from={Math.max(0, Math.round(c.at * FPS))} durationInFrames={FPS * 3} layout="none">
        <Audio src={staticFile(`sfx/${c.kind}.wav`)} volume={c.vol ?? SFX_VOL[c.kind] ?? 0.3} />
      </Sequence>
    ))}
  </>
);

// ---------------- 配乐：make.mjs 生成 bgm.wav 后写进 storyboard.bgm；没有就静音 ----------------
export const Bgm: React.FC<{sb: Storyboard; frames: number}> = ({sb, frames}) =>
  sb.bgm ? (
    <Audio
      src={staticFile(sb.bgm)}
      volume={(fr) => interpolate(fr, [0, 6, frames - 30, frames], [0, 0.3, 0.3, 0], clamp)}
    />
  ) : null;
