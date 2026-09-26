import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {WORD_JOINER, glueBreaks} from '../../../core/fit';
import {useStylePalette, useStyleTokens} from '../../context';
import {useStoryParams} from './story';

// ============================================================
// quiz 风格的公共元件（v0.2.1「批改纸」皮肤）：缓动、逐字点亮（幽灵字 / 打字）、杏黄马克笔、
// 朱红批改笔（圈疑、波浪划掉、手写勾叉）、印章、火花、等宽题号签、标签。
// 所有数值从令牌取（tokens.json 的 motion / type / layout），镜头只管摆位置和排时间。
// ============================================================

export type Pal = Record<string, string>;
export const usePal = () => useStylePalette() as Pal;
export const useTk = () => useStyleTokens() as Record<string, any>;

/** easeOutBack：入场回弹 */
export const backOut = (s = 1.4) => (x: number) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
/** 0→1 进度（带缓动） */
export const prog = (t: number, t0: number, dur: number, easing: (x: number) => number = Easing.out(Easing.cubic)) =>
  interpolate(t, [t0, t0 + Math.max(0.001, dur)], [0, 1], {...clamp, easing});
/** 弹出缩放：0 → overshoot → 1（选项、气泡、便签） */
export const popScale = (t: number, t0: number, dur: number, from = 0, over = 1.05) =>
  t < t0 ? from : interpolate(t, [t0, t0 + dur * 0.65, t0 + dur], [from, over, 1], {...clamp, easing: Easing.out(Easing.quad)});

/** 两色按比例混合：p=0 → a，p=1 → b（元件里调浅色用，不写死色值） */
export const mix = (a: string, b: string, p: number) => {
  const h = (c: string) => {
    const s = (c ?? '#000000').replace('#', '');
    const n = parseInt(s.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const A = h(a);
  const B = h(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * p).toString(16).padStart(2, '0')).join('');
};

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

/** 每个单位的开始时间（相对 t0）。rate = 字/秒；latinWord 给定时每个拉丁词固定这么长 */
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
/** 粗体大字的宽度估算（em）：大号拉丁短语按字形宽窄分档估，避免估短撞到右边的元件 */
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
  /** 关键词（必须是 text 的子串）：换主色；marker=true 时再从左往右扫一道杏黄马克笔 */
  hot?: string;
  hotColor?: string;
  marker?: boolean;
  markerColor?: string;
  /** 马克笔开始时刻（默认关键词开始点亮时） */
  markerAt?: number;
  markerDur?: number;
  /** 光标（打字模式，最后一个字后面闪） */
  caret?: boolean;
  /** 覆盖令牌的幽灵字不透明度 */
  ghost?: number;
  /** 前 pre 个单位从第 0 帧起就是实色（语境句第 0 帧至少露出前 4 个字） */
  pre?: number;
};

/** 杏黄马克笔：斜切的粗笔触（两头略倾斜，不是圆角条），从左往右扫 */
const MarkerStroke: React.FC<{p: number; color: string}> = ({p, color}) => (
  <span style={{position: 'absolute', left: -8, right: -8, bottom: '0.02em', height: '0.38em', background: color, transformOrigin: 'left center', transform: `scaleX(${p}) skewX(-12deg)`, borderRadius: 2, zIndex: -1}} />
);

/** 逐字点亮的一段文字（行内内容，外层自己定字号、对齐） */
export const Lit: React.FC<LitProps> = ({text, t, t0, rate, mode = 'ghost', latinWord, color, hot, hotColor, marker, markerColor, markerAt, markerDur, caret, ghost: ghostOver, pre = 0}) => {
  const tk = useTk();
  const pal = usePal();
  const ghost = ghostOver ?? tk.motion?.ghostOpacity ?? 0.16;
  const fade = tk.motion?.unitFade ?? 0.066;
  const units = unitsOf(text);
  const {at, total} = unitTimes(units, rate, latinWord);
  const k = hot && text.includes(hot) ? text.indexOf(hot) : -1;
  // 中文按词粘住（词内不断行）：glueBreaks 在词内相邻字之间插零宽 WORD JOINER，这里记下「哪个字后面要粘」
  const glueAfter = new Set<number>();
  {
    const g = glueBreaks(text);
    let oi = -1;
    for (let gi = 0; gi < g.length; gi++) {
      if (g[gi] === WORD_JOINER) glueAfter.add(oi);
      else oi++;
    }
  }
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
  const flush = (key: string) => {
    out.push(
      <span key={key} style={{position: 'relative', display: 'inline-block', whiteSpace: 'pre', zIndex: 0}}>
        {marker ? <MarkerStroke p={mP} color={markerColor ?? pal.highlight} /> : null}
        {hotBuf}
      </span>,
    );
    hotBuf = [];
  };
  segs.forEach((s, n) => {
    if (s.hot) hotBuf.push(render(s, n));
    else {
      if (hotBuf.length) flush(`h${n}`);
      out.push(render(s, n));
    }
  });
  if (hotBuf.length) flush('hEnd');
  const typing = caret && t >= t0 - 0.2;
  const blink = Math.floor(t * 3.2) % 2 === 0 || (t >= t0 && t <= t0 + total);
  return (
    <>
      {out}
      {typing ? <span style={{display: 'inline-block', width: '0.5em', height: 5, marginLeft: 4, verticalAlign: '-0.08em', background: pal.pen ?? pal.primary, opacity: blink ? 1 : 0}} /> : null}
    </>
  );
};

/** 波浪划掉：朱红批改笔在字上来回划一道锯齿（不是直线删除线），从左往右露出。
 *  锯齿按像素画（固定 26px 一个来回），用裁切露出，不拉伸笔画 */
export const Scribble: React.FC<{t: number; t0: number; color?: string; children: React.ReactNode}> = ({t, t0, color, children}) => {
  const tk = useTk();
  const pal = usePal();
  const m = tk.motion?.scribble ?? {dur: 0.18};
  const p = prog(t, t0, m.dur, Easing.out(Easing.quad));
  let d = 'M4 22';
  for (let x = 4, k = 0; x < 1400; x += 13, k++) d += ` L${x + 13} ${k % 2 ? 22 : 6}`;
  return (
    <span style={{position: 'relative', display: 'inline-block'}}>
      {children}
      <span style={{position: 'absolute', left: -14, width: 'calc(100% + 28px)', top: '50%', height: 28, marginTop: -12, overflow: 'hidden', clipPath: `inset(-10px ${(1 - p) * 100}% -10px 0)`, opacity: t >= t0 ? 1 : 0}}>
        <svg width={1400} height={28} viewBox="0 0 1400 28" style={{display: 'block'}}>
          <path d={d} fill="none" stroke={color ?? pal.pen} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
};
/** 手写问号（朱红批改笔），画出来 */
export const PenQuestion: React.FC<{size: number; p: number; color?: string}> = ({size, p, color}) => {
  const pal = usePal();
  const c = color ?? pal.pen;
  return (
    <svg width={size * 0.62} height={size} viewBox="0 0 62 100" style={{display: 'inline-block', overflow: 'visible', verticalAlign: 'middle'}}>
      <path d="M12 30 C10 12 26 4 38 6 C54 9 58 26 48 38 C40 47 31 50 31 64" fill="none" stroke={c} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, p * 1.25)} />
      <circle cx={31} cy={86} r={6.5} fill={c} opacity={p >= 0.95 ? 1 : 0} />
    </svg>
  );
};

/** 红笔圈疑：朱红笔沿着文字画一个没收口的手绘圈，圈尾甩出去接一个手写问号。
 *  钩子里圈住「= 误解」，告诉观众「这个理解存疑」 */
export const PenCircle: React.FC<{t: number; at: number; children: React.ReactNode; qSize?: number; w: number; h: number}> = ({t, at, children, qSize = 80, w, h}) => {
  const tk = useTk();
  const pal = usePal();
  const d = tk.motion?.penCircle ?? 0.32;
  const p = prog(t, at, d, Easing.inOut(Easing.quad));
  const q = prog(t, at + d * 0.85, 0.2, Easing.out(Easing.quad));
  // 圈按像素画（w / h = 圈住的字的估算宽高），笔画粗细不随宽高拉伸
  const W = w + 28 + 20;
  const H = h + 32;
  let n = 0;
  const path = 'M14 72 C2 52 8 16 50 8 C84 2 102 22 98 48 C95 78 66 94 40 92 C16 90 2 76 6 54 C8 40 20 26 36 20'.replace(/-?\d+(\.\d+)?/g, (v) => String(Math.round((Number(v) / 100) * (n++ % 2 === 0 ? W : H) * 10) / 10));
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 10}}>
      <span style={{position: 'relative', display: 'inline-block', padding: '0 14px'}}>
        {children}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: -10, top: '50%', marginTop: -H / 2, overflow: 'visible', opacity: t >= at ? 1 : 0}}>
          <path d={path} fill="none" stroke={pal.pen} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
        </svg>
      </span>
      <span style={{display: 'inline-block', transform: 'rotate(8deg)', opacity: t >= at + d * 0.85 ? 1 : 0}}>
        <PenQuestion size={qSize} p={q} />
      </span>
    </span>
  );
};
/** 手写勾 / 叉（批改笔的笔触：勾带一个起笔小顿，叉是两笔先后画） */
export const Mark: React.FC<{kind: 'check' | 'cross'; size: number; color: string; p?: number; stroke?: number}> = ({kind, size, color, p = 1, stroke = 9}) => (
  <svg width={size} height={size} viewBox="0 0 60 60" style={{display: 'block', overflow: 'visible'}}>
    {kind === 'check' ? (
      <path d="M8 30 C11 31 14 34 17 38 C19 41 21 45 23 49 C30 34 40 20 55 7" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    ) : (
      <g stroke={color} strokeWidth={stroke * 0.8} strokeLinecap="round" fill="none">
        <path d="M15 14 C24 24 34 36 46 47" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, p * 2)} />
        <path d="M45 13 C36 24 26 36 14 47" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, p * 2 - 1)} />
      </g>
    )}
  </svg>
);

/** 火花：4–6 颗四角星，从 (x,y) 往上散开（杏黄 + 朱红两色，墨色描边） */
export const Sparks: React.FC<{t: number; at: number; x: number; y: number; spread?: number}> = ({t, at, x, y, spread = 90}) => {
  const tk = useTk();
  const pal = usePal();
  const h = tk.motion?.sparks ?? {dur: 0.45, rise: 110, count: 5};
  if (t < at) return null;
  return (
    <>
      {Array.from({length: h.count}).map((_, i) => {
        const d = at + i * 0.06;
        if (t < d) return null;
        const p = prog(t, d, h.dur * 1.5, Easing.out(Easing.quad));
        const dx = (i - (h.count - 1) / 2) * (spread / h.count) * 1.5;
        const op = interpolate(t, [d, d + 0.06, d + h.dur * 2, d + h.dur * 2.8], [0, 1, 1, 0], clamp);
        const s = 30 + (i % 3) * 10;
        return (
          <svg key={i} width={s} height={s} viewBox="0 0 40 40" style={{position: 'absolute', left: x + dx - s / 2, top: y - p * h.rise * (0.7 + (i % 2) * 0.4) - s / 2, opacity: op, transform: `scale(${0.3 + 0.7 * Math.min(1, p * 2.2)}) rotate(${p * (i % 2 ? 60 : -60)}deg)`}}>
            <path d="M20 2 C22 14 26 18 38 20 C26 22 22 26 20 38 C18 26 14 22 2 20 C14 18 18 14 20 2 Z" fill={i % 2 ? pal.pen : pal.highlight} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
        );
      })}
    </>
  );
};

/** 印章：朱红圆角方章、内框一道细线，字按印章排（1–2 个汉字竖排，3–4 个两字一行，拉丁字一行）。
 *  盖章 0.14 秒，1.35→1，转 -7° */
export const Seal: React.FC<{t: number; at: number; text: string; x: number; y: number; size?: number; rot?: number}> = ({t, at, text, x, y, size, rot}) => {
  const tk = useTk();
  const pal = usePal();
  const st = tk.motion?.stamp ?? {dur: 0.14, from: 1.35, rot: -7};
  const d = size ?? tk.layout?.seal ?? 196;
  if (t < at) return null;
  const p = prog(t, at, st.dur, Easing.in(Easing.quad));
  const sc = st.from + (1 - st.from) * p;
  return (
    <div style={{position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, transform: `scale(${sc}) rotate(${rot ?? st.rot}deg)`, opacity: Math.min(1, p * 3 + 0.2)}}>
      <SealFace text={text} size={d} />
    </div>
  );
};

/** 印章本体（不带动画，落版的印章擦除也用它） */
export const SealFace: React.FC<{text: string; size: number; check?: boolean}> = ({text, size, check}) => {
  const tk = useTk();
  const pal = usePal();
  const chars = Array.from(text ?? '');
  const cjk = chars.every((c) => isWide(c));
  const inner = size - size * 0.16;
  let body: React.ReactNode;
  if (check || !chars.length) body = <Mark kind="check" size={inner * 0.62} color={pal.card} stroke={10} />;
  else if (cjk && chars.length <= 2) {
    const fs = Math.max(tk.type?.min ?? 28, Math.floor((inner * 0.86) / Math.max(1, chars.length)));
    body = (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, fontSize: fs, fontWeight: 900, color: pal.card}}>
        {chars.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
    );
  } else if (cjk) {
    // 3–4 个字：两字一行，从上往下（按现代阅读顺序，不做右起竖读）
    const rowsArr = [chars.slice(0, 2), chars.slice(2, 4)];
    const fs = Math.max(tk.type?.min ?? 28, Math.floor((inner * 0.74) / 2));
    body = (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, lineHeight: 1, fontSize: fs, fontWeight: 900, color: pal.card}}>
        {rowsArr.map((row, i) => (
          <div key={i} style={{display: 'flex', gap: 6}}>
            {row.map((c, j) => (
              <span key={j}>{c}</span>
            ))}
          </div>
        ))}
      </div>
    );  } else {
    const fs = Math.max(tk.type?.min ?? 28, Math.min(Math.floor(inner * 0.4), Math.floor((inner * 0.9) / Math.max(1, displayEm(text)))));
    body = <div style={{fontSize: fs, fontWeight: 900, color: pal.card, fontFamily: tk.font?.mono, letterSpacing: '0.02em', lineHeight: 1, whiteSpace: 'nowrap'}}>{text}</div>;
  }
  return (
    <div style={{width: size, height: size, borderRadius: size * 0.14, background: pal.pen, boxShadow: `4px 5px 0 ${pal.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'}}>
      <div style={{position: 'absolute', inset: size * 0.07, borderRadius: size * 0.08, border: `${Math.max(3, size * 0.022)}px solid ${pal.card}`}} />
      {body}
    </div>
  );
};

/** 题号签：等宽小字的墨色签 + 正文 */
export const TagRow: React.FC<{label?: string; text?: string; x: number; y: number; color?: string; chipBg?: string; chipFg?: string}> = ({label, text, x, y, color, chipBg, chipFg}) => {
  const tk = useTk();
  const pal = usePal();
  if (!label && !text) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap'}}>
      {label ? (
        <span style={{padding: '3px 12px 4px', borderRadius: 6, background: chipBg ?? pal.ink, color: chipFg ?? pal.card, fontFamily: tk.font?.mono, fontSize: tk.type?.tag ?? 28, fontWeight: 700, letterSpacing: tk.font?.tagTracking ?? '0.08em', lineHeight: 1.2}}>{label}</span>
      ) : null}
      {text ? <span style={{fontSize: tk.type?.eyebrow ?? 30, fontWeight: 700, color: color ?? pal.ink, lineHeight: 1.2}}>{text}</span> : null}
    </div>
  );
};

/** 标签（右端斜切角的书签形，不是胶囊）：= 正解、小提示 */
export const Label: React.FC<{text: string; bg: string; color: string; size?: number; style?: React.CSSProperties}> = ({text, bg, color, size, style}) => {
  const tk = useTk();
  const pal = usePal();
  const fs = size ?? tk.type?.pill ?? 34;
  return (
    <span style={{display: 'inline-block', padding: `6px ${fs * 1.1}px 6px ${fs * 0.55}px`, background: bg, color, fontSize: fs, fontWeight: 800, lineHeight: 1.25, whiteSpace: 'nowrap', border: `3px solid ${pal.ink}`, borderRadius: 6, clipPath: `polygon(0 0, 100% 0, calc(100% - ${fs * 0.5}px) 50%, 100% 100%, 0 100%)`, ...style}}>
      {text}
    </span>
  );
};

/** 硬投影卡片样式（小圆角 + 右下实色偏移影，不用柔光阴影） */
export const cardStyle = (pal: Pal, opt: {radius?: number; stroke?: number; shadow?: number; bg?: string; shadowColor?: string} = {}): React.CSSProperties => ({
  background: opt.bg ?? pal.card,
  border: `${opt.stroke ?? 4}px solid ${pal.ink}`,
  borderRadius: opt.radius ?? 16,
  boxShadow: `${opt.shadow ?? 8}px ${opt.shadow ?? 8}px 0 ${opt.shadowColor ?? pal.ink}`,
  boxSizing: 'border-box',
});

// ---------------- 口吻（固定句式的三套可选） ----------------

export type VoiceKey = 'tag' | 'replayTitle' | 'seal' | 'entry' | 'example' | 'sheet' | 'hint' | 'prefill' | 'comments' | 'badge';

/** 本片的口吻：phraseTitle.params.voice，不写按 meta.industry（tokens.industryVoices） */
export const useVoice = (meta?: {industry?: string; lang?: string}) => {
  const tk = useTk();
  const hook = useStoryParams<{voice?: string}>('phraseTitle');
  const V = tk.voices ?? {};
  const byInd = tk.industryVoices ?? {};
  const name = hook?.voice && V[hook.voice] ? hook.voice : byInd[meta?.industry ?? ''] ?? byInd.default ?? 'exam';
  const set = V[name] ?? V.exam ?? {};
  const get = (key: VoiceKey): string | string[] => {
    const e = set[key];
    return e ? (meta?.lang === 'en' ? e.en : e.zh) : '';
  };
  const fill = (s: string, vars: Record<string, string>) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  /** 一句话（{trap} / {right} 会被替换） */
  const say = (key: VoiceKey, vars: Record<string, string> = {}): string => {
    const raw = get(key);
    return fill(Array.isArray(raw) ? raw[0] ?? '' : raw, vars);
  };
  /** 一组话（便签评论） */
  const list = (key: VoiceKey, vars: Record<string, string> = {}): string[] => {
    const raw = get(key);
    return (Array.isArray(raw) ? raw : [raw]).map((s) => fill(s, vars));
  };
  return Object.assign(say, {list});
};