import React from 'react';
import {Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {Storyboard} from '../schema';
import {clamp} from './anim';
import {FONT} from './font';
import {Lang, glyph, parseRich, repeatsHint} from './kit';
import {CAP, DISCLAIMER_Y, FPS} from './safe';
import {fitLine, fitSize} from './fit';
import {Icon, isIcon} from './icons';
import {alpha, mixHex, moodColors, useTheme} from './theme';
import {Illust, isIllust} from '../illust';
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

// ---------------- 下三分之一氛围层（y 1340–1920，只放装饰，不放任何关键信息/文字） ----------------
// 以前 y 1340 以下每一帧都是光秃秃的渐变（评审：「下三分之一全空、所有片子一个样」）。这里按主题画一层
// 会动的氛围：图案由 themes.json 的 ambient.pattern 决定（圆泡/网格/水波/柱状天际线/纸屑/金线），
// 速度与冷暖跟着 mood 走，每拍鼓一下；再叠一团品牌色地平线光、本片自己用到的插画/图标剪影（按内容来，
// 不是固定图标）和一条按镜头分段的节拍进度条。全部没有文字，平台的文案/按钮盖上来也不丢信息。
const hash01 = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const ICON_KEYS = new Set(['icon', 'deco', 'orbit', 'icons']);
/** 本片分镜里真正用到的插画 id / 图标名（按出现顺序去重）：氛围层剪影只画这些，和产品有关 */
const visualIdsOf = (v: unknown, key = '', out: {illust: string[]; icon: string[]} = {illust: [], icon: []}) => {
  if (typeof v === 'string') {
    if (isIllust(v) && !out.illust.includes(v)) out.illust.push(v);
    else if (ICON_KEYS.has(key) && isIcon(v) && v !== 'sparkle' && !out.icon.includes(v)) out.icon.push(v);
  } else if (Array.isArray(v)) v.forEach((x) => visualIdsOf(x, key, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visualIdsOf(x, k, out);
  return out;
};

const AMB_TOP = 1340;
const AMB_H = 1920 - AMB_TOP;

const AmbientPattern: React.FC<{kind: string; t: number; e: number; bb: number; a: string; b: string; hot: string}> = ({kind, t, e, bb, a, b, hot}) => {
  if (kind === 'none') return null;
  if (kind === 'grid') {
    const hz = 70;
    const off = (t * 0.9 * e) % 1;
    const rows = Array.from({length: 9}, (_, k) => hz + (AMB_H - hz) * Math.pow((k + off) / 8, 2.1));
    const cols = Array.from({length: 23}, (_, k) => -780 + k * 120);
    return (
      <svg width={1080} height={AMB_H} style={{position: 'absolute', left: 0, top: 0}}>
        {cols.map((x, k) => (
          <line key={`c${k}`} x1={540 + (x - 540) * 0.08} y1={hz} x2={x} y2={AMB_H} stroke={alpha(a, 0.32)} strokeWidth={2} />
        ))}
        {rows.map((y, k) => (
          <line key={`r${k}`} x1={0} y1={y} x2={1080} y2={y} stroke={alpha(a, 0.1 + 0.3 * ((y - hz) / (AMB_H - hz)))} strokeWidth={2} />
        ))}
        <rect x={0} y={hz - 3} width={1080} height={6} fill={alpha(b, 0.55 + 0.35 * bb)} />
        <rect x={0} y={hz - 26} width={1080} height={52} fill={alpha(b, 0.12 + 0.1 * bb)} style={{filter: 'blur(14px)'}} />
      </svg>
    );
  }
  if (kind === 'waves') {
    const wave = (amp: number, len: number, ph: number, base: number) => {
      let d = `M 0 ${AMB_H} L 0 ${base}`;
      for (let x = 0; x <= 1080; x += 30) d += ` L ${x} ${(base + Math.sin((x / len) * Math.PI * 2 + ph) * amp).toFixed(1)}`;
      return `${d} L 1080 ${AMB_H} Z`;
    };
    const s = t * 0.9 * e;
    return (
      <svg width={1080} height={AMB_H} style={{position: 'absolute', left: 0, top: 0}}>
        <path d={wave(26 + 14 * bb, 620, s, 170)} fill={alpha(a, 0.16)} />
        <path d={wave(20 + 10 * bb, 480, -s * 1.3 + 1.7, 280)} fill={alpha(b, 0.2)} />
        <path d={wave(16 + 8 * bb, 380, s * 1.6 + 3.1, 390)} fill={alpha(a, 0.24)} />
      </svg>
    );
  }
  if (kind === 'bars') {
    const n = 16;
    const w = 46;
    const gap = (1080 - n * w) / (n + 1);
    return (
      <>
        {Array.from({length: n}, (_, i) => {
          const base = 150 + hash01(i, 3) * 220;
          const h = base + Math.sin(t * 1.4 * e + i * 0.8) * 40 + (i % 3 === Math.floor(t * 2) % 3 ? bb * 46 : 0);
          return (
            <div
              key={i}
              style={{position: 'absolute', left: gap + i * (w + gap), top: AMB_H - h, width: w, height: h + 20, borderRadius: '14px 14px 0 0', background: `linear-gradient(180deg, ${alpha(i % 4 === 1 ? b : a, 0.42)} 0%, ${alpha(a, 0.06)} 100%)`}}
            />
          );
        })}
        <div style={{position: 'absolute', left: 0, right: 0, top: 90, height: 3, background: alpha(b, 0.25)}} />
      </>
    );
  }
  if (kind === 'confetti') {
    return (
      <>
        {Array.from({length: 26}, (_, i) => {
          const sp = 60 + hash01(i, 1) * 70;
          const y = ((t * sp * e + hash01(i, 2) * (AMB_H + 80)) % (AMB_H + 80)) - 40;
          const x = hash01(i, 4) * 1080 + Math.sin(t * 1.5 + i) * 24;
          const c = i % 3 === 0 ? hot : i % 3 === 1 ? a : b;
          return (
            <div
              key={i}
              style={{position: 'absolute', left: x, top: y, width: 14 + (i % 3) * 5, height: 8 + (i % 2) * 6, borderRadius: 3, background: alpha(c, 0.55), transform: `rotate(${t * (90 + i * 13) + i * 40}deg)`}}
            />
          );
        })}
        {[150, 390, 690, 930].map((x, i) => (
          <div
            key={`g${i}`}
            style={{position: 'absolute', left: x - 70, top: 400 + (i % 2) * 40, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(a, 0.5 + 0.3 * bb)} 0%, ${alpha(a, 0)} 70%)`}}
          />
        ))}
      </>
    );
  }
  if (kind === 'rays') {
    const sweep = ((t * 0.35 * e) % 1.6) - 0.3;
    return (
      <>
        <div style={{position: 'absolute', inset: 0, background: `repeating-linear-gradient(115deg, ${alpha(a, 0.16)} 0px, ${alpha(a, 0.16)} 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 38px)`}} />
        <div style={{position: 'absolute', top: -100, bottom: -100, left: sweep * 1080 - 160, width: 320, transform: 'skewX(-25deg)', background: `linear-gradient(90deg, ${alpha(b, 0)} 0%, ${alpha(b, 0.16)} 50%, ${alpha(b, 0)} 100%)`}} />
        <div style={{position: 'absolute', left: 180, right: 180, top: 120, height: 2, background: alpha(a, 0.45 + 0.35 * bb)}} />
      </>
    );
  }
  // bubbles（默认）
  return (
    <>
      {Array.from({length: 15}, (_, i) => {
        const size = 36 + hash01(i, 5) * 90;
        const sp = 40 + hash01(i, 6) * 50;
        const y = AMB_H - ((t * sp * e + hash01(i, 7) * (AMB_H + 140)) % (AMB_H + 140)) + 20;
        const x = hash01(i, 8) * 1080 + Math.sin(t * 0.9 + i) * 18;
        const c = i % 3 === 0 ? b : a;
        const pulse = i % 4 === 0 ? 1 + bb * 0.12 : 1;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${alpha(c, 0.5)} 0%, ${alpha(c, 0.14)} 60%, ${alpha(c, 0.05)} 100%)`,
              border: `2px solid ${alpha(c, 0.3)}`,
              transform: `scale(${pulse})`,
            }}
          />
        );
      })}
    </>
  );
};

export const LowerAmbient: React.FC<{slots: Slot[]; t: number; m: number; beat: number}> = ({slots, t, m, beat}) => {
  const th = useTheme();
  const amb = (th as {ambient?: {pattern?: string; a?: string; b?: string}}).ambient ?? {};
  const kind = amb.pattern ?? 'bubbles';
  // mood 越高（紧张）动得越快、颜色越往 hot 偏；越低越慢越冷
  const e = 0.6 + 0.8 * m;
  const bp = beat > 0 ? (t % beat) / beat : 0;
  const bb = Math.exp(-bp * 5); // 每拍起点 1 → 衰减
  const a = mixHex(amb.a ?? '#FFFFFF', th.hot, Math.max(0, m - 0.5) * 0.8);
  const b = amb.b ?? th.hot;
  const total = slots.length ? slots[slots.length - 1].end : 1;
  const cur = slots.find((s) => t >= s.start && t < s.end) ?? slots[slots.length - 1];
  const film = visualIdsOf(slots.map((s) => s.shot.params ?? {}));
  const mine = cur ? visualIdsOf(cur.shot.params ?? {}) : {illust: [], icon: []};
  // 剪影：本镜自己用到的插画/图标优先，其次全片的；一个都没有就不画（不拿默认图标凑数）
  const ills = [...mine.illust, ...film.illust.filter((x) => !mine.illust.includes(x))].slice(0, 3);
  const icons = ills.length ? [] : [...mine.icon, ...film.icon.filter((x) => !mine.icon.includes(x))].slice(0, 3);
  const sil = ills.length ? ills : icons;
  const xs = sil.length === 1 ? [830] : sil.length === 2 ? [230, 850] : [200, 540, 880];
  const glow = mixHex(th.accent, th.hot, Math.max(0, m - 0.4));
  return (
    <div style={{position: 'absolute', left: 0, top: AMB_TOP, width: 1080, height: AMB_H, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0px, #000 150px)', maskImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0px, #000 150px)'}}>
      {/* 品牌色地平线光：每拍亮一下 */}
      <div style={{position: 'absolute', left: -160, top: 250, width: 1400, height: 560, borderRadius: '50%', background: `radial-gradient(ellipse at 50% 50%, ${alpha(glow, 0.42 + 0.14 * bb)} 0%, ${alpha(glow, 0)} 65%)`}} />
      <AmbientPattern kind={kind} t={t} e={e} bb={bb} a={a} b={b} hot={th.hot} />
      {sil.map((id, i) => (
        <div key={id} style={{position: 'absolute', left: xs[i] - 95, top: 250 + (i % 2) * 50 + Math.sin(t * 1.3 + i * 1.7) * 10 - bb * 8, width: 190, height: 190, opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(${(i - 1) * 8}deg)`}}>
          {ills.length ? <Illust name={id} size={190} /> : <Icon name={id} size={130} color={th.onBg} stroke={1.6} />}
        </div>
      ))}
      {/* 节拍进度条：按镜头分段，已播部分亮、当前拍一个亮点（纯装饰，无文字） */}
      <div style={{position: 'absolute', left: 180, width: 720, top: AMB_H - 50, height: 8, display: 'flex', gap: 8}}>
        {slots.map((s) => {
          const f = Math.max(0, Math.min(1, (t - s.start) / s.dur));
          return (
            <div key={s.i} style={{flex: s.dur, position: 'relative', height: 8, borderRadius: 4, background: alpha(th.onBg.startsWith('#') ? th.onBg : '#FFFFFF', 0.22), overflow: 'hidden'}}>
              <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${f * 100}%`, borderRadius: 4, background: alpha(th.onBg.startsWith('#') ? th.onBg : '#FFFFFF', 0.7)}} />
            </div>
          );
        })}
      </div>
      {total > 0 && (
        <div style={{position: 'absolute', left: 180 + 720 * Math.min(1, t / total) - 9, top: AMB_H - 55, width: 18, height: 18, borderRadius: 9, background: th.hot, transform: `scale(${1 + bb * 0.5})`, boxShadow: `0 0 12px ${alpha(th.hot, 0.8)}`}} />
      )}
    </div>
  );
};

// ---------------- 背景：主题渐变随 mood 过渡 + 柔光 + 两团慢慢漂的光斑 + 下三分之一氛围层 ----------------
export const Background: React.FC<{slots: Slot[]; beat?: number}> = ({slots, beat = 0.5}) => {
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
      <LowerAmbient slots={slots} t={t} m={m} beat={beat} />
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
// 按关键内容区 x180–900（720 宽）来缩，而不是字幕带外框 780：make 的版式自查按 180–900 量字幕，
// 以前按 780−30 缩出来的 10.5–11.7 字宽的行会出界 5–10px（p3 自测：「写纪要，从40分钟到3分钟」x173–907）
// 两处再收紧（p3 集成）：
// - 中文下限从 CAP.min(64) 放到 58：校验允许一行 12 字，12×64=768 会出 720 宽的区；12×58=696 放得下
// - 英文按 680 宽估：粗体拉丁字母的实际宽度比 emWidth 估算宽约 4%（p3 样例：「Meant to focus,」估 712、实测 738，出界 9px）
export const captionSize = (text: string, lang: Lang = 'zh') =>
  fitSize(text, lang === 'en' ? 680 : 720, CAP.max, lang === 'en' ? 44 : Math.min(CAP.min, 58), 8);

/** 字幕数组的分段：n 句平分这一镜，分界吸附到整拍（与 scripts/validate.mjs 的 captionSegments 同一算法） */
export const captionSegments = (start: number, dur: number, n: number, beat: number): [number, number][] => {
  const cuts = [0];
  for (let k = 1; k < n; k++) cuts.push(Math.min(dur, Math.max(cuts[k - 1] + beat, Math.round((dur * k) / n / beat) * beat)));
  cuts.push(dur);
  return cuts.slice(0, -1).map((a, k) => [start + a, start + cuts[k + 1]]);
};

type CapSeg = {key: string; text: string; start: number; end: number; instant: boolean};

/** skip：这些镜头的字幕带交给配音字幕（core/voice.tsx 的 VoiceCaptions）画，这里不画；不传 = 和以前一样 */
export const Captions: React.FC<{slots: Slot[]; beat?: number; lang?: Lang; skip?: Set<number>}> = ({slots, beat = 0.5, lang = 'zh', skip}) => {
  const th = useTheme();
  const t = useSec();
  const lineHeight = lang === 'en' ? 1.32 : 1.18;
  const total = slots.length ? slots[slots.length - 1].end : 0;
  const segs: CapSeg[] = [];
  for (const s of slots) {
    if (skip?.has(s.i)) continue;
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
          const clean = th.captionStyle === 'clean';
          const size = clean ? Math.min(78, captionSize(text, lang)) : captionSize(text, lang);
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
                fontWeight: clean ? 800 : 900,
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
// 同一提示不重复出现：和顶部免责小字说的是一回事（原话相同，或都是「演示/示意/模拟」这类演示声明）的条目不再画；
// 多条之间互相重复的也只留一条（评审：顶部「演示画面，数据为示意」+ 底部「演示数据，以实际为准」每帧各一遍）。
// disclaimer 由 Promo.tsx 传入（没传时只做条目之间的去重）
export const Notices: React.FC<{items?: string[]; lang?: Lang; disclaimer?: string}> = ({items, lang = 'zh', disclaimer}) => {
  const list = (items ?? [])
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .filter((s, i, arr) => !repeatsHint(s, {disclaimer, notices: arr.slice(0, i)}))
    .slice(0, 3);
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
// duck：配音时的闪避增益（core/voice.tsx 的 duckGainOf，按帧返回 0..1 乘在音量上）；不传 = 和以前一样
export const Bgm: React.FC<{sb: Storyboard; frames: number; duck?: (frame: number) => number}> = ({sb, frames, duck}) =>
  sb.bgm ? (
    <Audio
      src={staticFile(sb.bgm)}
      volume={(fr) => interpolate(fr, [0, 6, frames - 30, frames], [0, 0.3, 0.3, 0], clamp) * (duck ? duck(fr) : 1)}
    />
  ) : null;
