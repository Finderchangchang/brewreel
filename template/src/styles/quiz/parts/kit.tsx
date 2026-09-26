import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {WORD_JOINER, glueBreaks} from '../../../core/fit';
import {useStylePalette, useStyleTokens} from '../../context';

// ============================================================
// quiz 风格的公共元件：缓动、逐字点亮（幽灵字 / 打字）、关键词马克笔、删除线、问号块、勾叉、贴纸、冒心。
// 所有数值从令牌取（tokens.json 的 motion / type / layout），镜头只管摆位置和排时间。
// ============================================================

export type Pal = Record<string, string>;
export const usePal = () => useStylePalette() as Pal;
export const useTk = () => useStyleTokens() as Record<string, any>;

/** easeOutBack：入场回弹（参考片所有入场都带） */
export const backOut = (s = 1.4) => (x: number) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
/** 0→1 进度（带缓动） */
export const prog = (t: number, t0: number, dur: number, easing: (x: number) => number = Easing.out(Easing.cubic)) =>
  interpolate(t, [t0, t0 + Math.max(0.001, dur)], [0, 1], {...clamp, easing});
/** 弹出缩放：0 → overshoot → 1（选项、气泡、贴纸） */
export const popScale = (t: number, t0: number, dur: number, from = 0, over = 1.05) =>
  t < t0 ? from : interpolate(t, [t0, t0 + dur * 0.65, t0 + dur], [from, over, 1], {...clamp, easing: Easing.out(Easing.quad)});

const isWide = (ch: string) => {
  const cp = ch.codePointAt(0) ?? 0;
  return (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xf900 && cp <= 0xfaff) || cp === 0x2026 || cp === 0x201c || cp === 0x201d;
};

/** 点亮单位：汉字一个字一个单位，拉丁一个词（含后面的空格）一个单位 */
export const unitsOf = (text: string): string[] => {
  const out: string[] = [];
  let buf = '';
  for (const ch of Array.from(text ?? '')) {
    if (isWide(ch)) {
      if (buf) out.push(buf);
      buf = '';
      out.push(ch);
    } else if (ch === ' ') {
      out.push(buf + ch);
      buf = '';
    } else buf += ch;
  }
  if (buf) out.push(buf);
  return out;
};

/** 每个单位的开始时间（相对 t0）。rate = 字/秒；latinWord 给定时每个拉丁词固定这么长（标题用 0.37 秒） */
export const unitTimes = (units: string[], rate: number, latinWord?: number) => {
  const at: number[] = [];
  let acc = 0;
  for (const u of units) {
    at.push(acc);
    const wide = isWide(Array.from(u)[0] ?? '');
    acc += wide ? 1 / rate : latinWord ?? Math.max(0.14, (u.trim().length * 0.5) / rate);
  }
  return {at, total: acc};
};
/** 粗黑大字的宽度估算（em）。core/fit.ts 的 emWidth 把拉丁字母一律算 0.55em，大号拉丁短语（I'm down / no big deal）
 *  会估短或估长几十像素，钩子短语又紧贴探头吉祥物，所以大字按字形宽窄分档估 */
export const displayEm = (text: string): number => {
  let w = 0;
  for (const ch of Array.from(text ?? '')) {
    if (isWide(ch)) w += 1;
    else if (ch === ' ') w += 0.25;
    else if (/[iljtfrI'!.,:;|]/.test(ch)) w += 0.32;
    else if (/[mwMW]/.test(ch)) w += 0.9;
    else if (/[A-Z]/.test(ch)) w += 0.7;
    else w += 0.6;
  }
  return w;
};
/** 大字按宽度自动缩字号：放得下用 max，放不下缩到刚好，最小 min */
export const fitDisplay = (text: string, maxW: number, max: number, min: number) => Math.max(min, Math.min(max, Math.floor(maxW / Math.max(0.5, displayEm(text)))));

/** 一段文字点亮完要多久（秒） */
export const litDur = (text: string, rate: number, latinWord?: number) => unitTimes(unitsOf(text), rate, latinWord).total;

type LitProps = {
  text: string;
  t: number;
  /** 开始点亮的时刻 */
  t0: number;
  /** 字/秒 */
  rate: number;
  /** ghost：没读到的字先以 16% 排好（第 0 帧不空）；type：没打到的字不显示（占位不变，居中文字不会跳） */
  mode?: 'ghost' | 'type';
  latinWord?: number;
  color?: string;
  /** 关键词（必须是 text 的子串）：换主色；marker=true 时再从左往右扫一道亮色马克笔 */
  hot?: string;
  hotColor?: string;
  marker?: boolean;
  markerColor?: string;
  /** 马克笔开始时刻（默认关键词开始点亮时） */
  markerAt?: number;
  markerDur?: number;
  /** 光标（打字模式，最后一个字后面闪） */
  caret?: boolean;
  /** 覆盖令牌的幽灵字不透明度（钩子要求第 0 帧可读：误解行用 motion.hookGhost） */
  ghost?: number;
  /** 前 pre 个单位从第 0 帧起就是实色（语境句第 0 帧至少露出前 4 个字） */
  pre?: number;
};

/** 逐字点亮的一段文字（行内内容，外层自己定字号、对齐） */
export const Lit: React.FC<LitProps> = ({text, t, t0, rate, mode = 'ghost', latinWord, color, hot, hotColor, marker, markerColor, markerAt, markerDur, caret, ghost: ghostOver, pre = 0}) => {
  const tk = useTk();
  const pal = usePal();
  const ghost = ghostOver ?? tk.motion?.ghostOpacity ?? 0.16;
  const fade = tk.motion?.unitFade ?? 0.066;
  const units = unitsOf(text);
  const {at, total} = unitTimes(units, rate, latinWord);
  const k = hot && text.includes(hot) ? text.indexOf(hot) : -1;
  // 中文按词粘住（词内不断行）：glueBreaks 在词内相邻字之间插零宽 WORD JOINER，这里记下「哪个字后面要粘」，
  // 渲染时把 WJ 补回到那个字后面。WJ 零宽，不影响字宽和点亮时间
  const glueAfter = new Set<number>();
  {
    const g = glueBreaks(text);
    let oi = -1;
    for (let gi = 0; gi < g.length; gi++) {
      if (g[gi] === WORD_JOINER) glueAfter.add(oi);
      else oi++;
    }
  }
  // 按字符位置把单位分成 前 / 关键词 / 后 三段（关键词若切在词中间，按字符切开）
  type Seg = {s: string; i: number; hot: boolean};
  const segs: Seg[] = [];
  let pos = 0;
  units.forEach((u, i) => {
    const chars = Array.from(u);
    let cur = '';
    let curHot: boolean | null = null;
    chars.forEach((c, j) => {
      const cp = pos + u.slice(0, chars.slice(0, j).join('').length).length;
      const h = k >= 0 && cp >= k && cp < k + (hot?.length ?? 0);
      if (curHot !== null && h !== curHot) {
        segs.push({s: cur, i, hot: curHot});
        cur = '';
      }
      curHot = h;
      cur += c;
      if (glueAfter.has(cp + c.length - 1)) cur += WORD_JOINER;
    });
    if (cur) segs.push({s: cur, i, hot: !!curHot});
    pos += u.length;
  });
  const opOf = (i: number) => {
    if (i < pre) return 1;
    const a = t0 + at[i];
    return mode === 'ghost' ? interpolate(t, [a, a + fade], [ghost, 1], clamp) : interpolate(t, [a, a + fade], [0, 1], clamp);
  };
  const hotStartUnit = segs.find((s) => s.hot)?.i ?? 0;
  const mAt = markerAt ?? t0 + at[hotStartUnit];
  const mP = prog(t, mAt, markerDur ?? tk.motion?.marker ?? 1.5, Easing.inOut(Easing.quad));
  const render = (s: Seg, key: number) => (
    <span key={key} style={{opacity: opOf(s.i), color: s.hot ? hotColor ?? pal.primary : color, position: 'relative'}}>
      {s.s}
    </span>
  );
  const out: React.ReactNode[] = [];
  let hotBuf: React.ReactNode[] = [];
  segs.forEach((s, n) => {
    if (s.hot) hotBuf.push(render(s, n));
    else {
      if (hotBuf.length) {
        out.push(
          <span key={`h${n}`} style={{position: 'relative', display: 'inline-block', whiteSpace: 'pre'}}>
            {marker ? <span style={{position: 'absolute', left: -6, right: -6, bottom: '0.06em', height: '0.42em', background: markerColor ?? pal.highlight, transformOrigin: 'left center', transform: `scaleX(${mP})`, borderRadius: 4}} /> : null}
            {hotBuf}
          </span>,
        );
        hotBuf = [];
      }
      out.push(render(s, n));
    }
  });
  if (hotBuf.length)
    out.push(
      <span key="hEnd" style={{position: 'relative', display: 'inline-block', whiteSpace: 'pre'}}>
        {marker ? <span style={{position: 'absolute', left: -6, right: -6, bottom: '0.06em', height: '0.42em', background: markerColor ?? pal.highlight, transformOrigin: 'left center', transform: `scaleX(${mP})`, borderRadius: 4}} /> : null}
        {hotBuf}
      </span>,
    );
  const typing = caret && t >= t0 - 0.2;
  const blink = Math.floor(t * 3.2) % 2 === 0 || (t >= t0 && t <= t0 + total);
  return (
    <>
      {out}
      {typing ? <span style={{display: 'inline-block', width: 4, height: '1em', marginLeft: 4, verticalAlign: '-0.12em', background: pal.primary, opacity: blink ? 1 : 0}} /> : null}
    </>
  );
};

/** 删除线：从左往右画，线比字两边各长 overhang */
export const Strike: React.FC<{t: number; t0: number; color: string; children: React.ReactNode}> = ({t, t0, color, children}) => {
  const tk = useTk();
  const m = tk.motion?.strike ?? {dur: 0.13, overhang: 50};
  const p = prog(t, t0, m.dur, Easing.out(Easing.quad));
  return (
    <span style={{position: 'relative', display: 'inline-block'}}>
      {children}
      <span style={{position: 'absolute', left: -m.overhang / 2, right: -m.overhang / 2, top: '52%', height: 8, marginTop: -4, borderRadius: 4, background: color, transformOrigin: 'left center', transform: `scaleX(${p})`}} />
    </span>
  );
};

/** 问号块：先是描边空块，揭示时变亮色 */
export const QBlock: React.FC<{t: number; at: number; size?: number}> = ({t, at, size}) => {
  const tk = useTk();
  const pal = usePal();
  const q = tk.layout?.qBlock ?? {size: 108, radius: 18};
  const s = size ?? q.size;
  const on = t >= at;
  const sc = on ? popScale(t, at, 0.2, 0.85, 1.08) : 1;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: s,
        height: s,
        borderRadius: q.radius,
        background: on ? pal.highlight : 'transparent',
        color: pal.ink,
        opacity: on ? 1 : tk.motion?.hookGhost ?? 0.6,
        fontSize: s * 0.78,
        fontWeight: 900,
        lineHeight: 1,
        transform: `scale(${sc})`,
      }}
    >
      ?
    </span>
  );
};

/** 勾 / 叉（粗描边图标） */
export const Mark: React.FC<{kind: 'check' | 'cross'; size: number; color: string; p?: number; stroke?: number}> = ({kind, size, color, p = 1, stroke = 9}) => (
  <svg width={size} height={size} viewBox="0 0 60 60" style={{display: 'block', overflow: 'visible'}}>
    {kind === 'check' ? (
      <path d="M12 31 L25 44 L49 17" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    ) : (
      <g stroke={color} strokeWidth={stroke * 0.8} strokeLinecap="round" opacity={p}>
        <path d="M16 16 L44 44" />
        <path d="M44 16 L16 44" />
      </g>
    )}
  </svg>
);

/** 冒心：3–5 颗，从 (x,y) 往上飘 rise px，0.4 秒 */
export const Hearts: React.FC<{t: number; at: number; x: number; y: number; spread?: number}> = ({t, at, x, y, spread = 90}) => {
  const tk = useTk();
  const pal = usePal();
  const h = tk.motion?.hearts ?? {dur: 0.4, rise: 120, count: 4};
  if (t < at) return null;
  return (
    <>
      {Array.from({length: h.count}).map((_, i) => {
        const d = at + i * 0.07;
        const p = prog(t, d, h.dur * 1.6, Easing.out(Easing.quad));
        if (t < d) return null;
        const dx = (i - (h.count - 1) / 2) * (spread / h.count) * 1.4;
        const op = interpolate(t, [d, d + 0.08, d + h.dur * 2.2, d + h.dur * 3], [0, 1, 1, 0], clamp);
        const s = 34 + (i % 2) * 12;
        return (
          <svg key={i} width={s} height={s} viewBox="0 0 40 40" style={{position: 'absolute', left: x + dx - s / 2, top: y - p * h.rise - s / 2, opacity: op, transform: `scale(${0.4 + 0.6 * Math.min(1, p * 2)}) rotate(${(i % 2 ? 1 : -1) * 12}deg)`}}>
            <path d="M20 35 C8 26 3 19 3 12.5 C3 7 7 3.5 12 3.5 C15.5 3.5 18.5 5.5 20 8.5 C21.5 5.5 24.5 3.5 28 3.5 C33 3.5 37 7 37 12.5 C37 19 32 26 20 35 Z" fill={i % 2 ? pal.highlight : pal.primary} stroke={pal.ink} strokeWidth={3} strokeLinejoin="round" />
          </svg>
        );
      })}
    </>
  );
};

/** 「懂了」圆贴纸：盖章 0.13 秒，1.3→1，旋转 -8° */
export const Sticker: React.FC<{t: number; at: number; text: string; x: number; y: number; size?: number}> = ({t, at, text, x, y, size}) => {
  const tk = useTk();
  const pal = usePal();
  const st = tk.motion?.stamp ?? {dur: 0.13, from: 1.3, rot: -8};
  const d = size ?? tk.layout?.sticker ?? 210;
  if (t < at) return null;
  const p = prog(t, at, st.dur, Easing.in(Easing.quad));
  const sc = st.from + (1 - st.from) * p;
  const fs = Math.max(tk.type?.min ?? 28, Math.min(46, Math.floor((d * 0.72) / Math.max(1, Array.from(text).length))));
  return (
    <div
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        borderRadius: '50%',
        background: pal.highlight,
        border: `5px solid ${pal.ink}`,
        boxShadow: `0 6px 0 ${pal.ink}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${sc}) rotate(${st.rot}deg)`,
        opacity: Math.min(1, p * 3 + 0.2),
      }}
    >
      <div style={{fontSize: fs, fontWeight: 900, color: pal.ink, lineHeight: 1.1}}>{text}</div>
      <div style={{marginTop: 4}}>
        <Mark kind="check" size={52} color={pal.ink} p={prog(t, at + st.dur, 0.12)} stroke={8} />
      </div>
    </div>
  );
};

/** 眉题：小圆点 + 小字 */
export const Eyebrow: React.FC<{text: string; x: number; y: number; color: string; dot?: string; size?: number}> = ({text, x, y, color, dot, size}) => {
  const tk = useTk();
  const fs = size ?? tk.type?.eyebrow ?? 30;
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 12, fontSize: fs, fontWeight: 700, color, letterSpacing: 1, lineHeight: 1.2, whiteSpace: 'nowrap'}}>
      <span style={{width: 14, height: 14, borderRadius: 7, background: dot ?? color, display: 'inline-block'}} />
      <span>{text}</span>
    </div>
  );
};

/** 胶囊标签（= 释义、按钮） */
export const Pill: React.FC<{text: string; bg: string; color: string; size?: number; style?: React.CSSProperties}> = ({text, bg, color, size, style}) => {
  const tk = useTk();
  return (
    <span style={{display: 'inline-block', padding: '8px 26px', borderRadius: 999, background: bg, color, fontSize: size ?? tk.type?.pill ?? 34, fontWeight: 800, lineHeight: 1.25, whiteSpace: 'nowrap', ...style}}>
      {text}
    </span>
  );
};
