import React from 'react';
import {Easing, interpolate} from 'remotion';
import {bump, clamp, fitTimeline, pop} from '../core/anim';
import {emWidth, fitLine, glueBreaks} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {IconDisc, Lang, Sweep} from '../core/kit';
import {CARD, MAIN} from '../core/safe';
import {Theme, alpha, textOnHot, toneColor, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// compare：对比。
//   lr：左右两张卡（x 150–530 / 550–930）。左卡内容先逐条出 → 中线从上往下画出 + VS 弹出 →
//       右卡内容逐条出 → 右卡「赢」：放大一下 + 描边发光 + 角标对勾，左卡变暗 → 底部结论胶囊。
//   beforeAfter：一张宽卡，先演「之前」，再由一根分隔滑杆从右往左扫过，露出「之后」。
// 每栏可带：stat（大数字/短词，如「2 小时」）和 level（0–10 的小刻度条，两栏同一把尺子，差距一眼可见）。
// 内容出来之前用骨架条占位，卡片不空。
// ============================================================
type Tone = 'good' | 'bad' | 'neutral';
type Side = {title: string; items: string[]; tone?: Tone; icon?: string; stat?: string; level?: number};
type P = {mode?: 'lr' | 'beforeAfter'; left: Side; right: Side; meterLabel?: string; verdict?: string};

const GAP = 20;
const COL_W = (CARD.w - GAP) / 2; // 380
const VERDICT_H = 92;

// ---------- 时间线（120 BPM 基准，按 beat 缩放，内容多/时长短时整体压缩） ----------
export const plan = (p: P, dur: number, beat: number) => {
  const b = beat / 0.5;
  const nL = Math.max(1, Math.min(3, p.left?.items?.length ?? 0));
  const nR = Math.max(1, Math.min(3, p.right?.items?.length ?? 0));
  if (p.mode === 'beforeAfter') {
    const leftItems = Array.from({length: nL}, (_, i) => (0.25 + i * 0.25) * b);
    const leftStat = 0.25 * b;
    const revealAt = Math.max(1.5 * b, leftItems[nL - 1] + 0.75 * b);
    const revealEnd = revealAt + 0.5 * b;
    const winAt = revealEnd;
    const verdictAt = winAt + 0.5 * b;
    const end = (p.verdict ? verdictAt : winAt) + 0.4;
    const k = fitTimeline(end, dur, 0.5);
    const s = (v: number) => v * k;
    return {
      k,
      leftItems: leftItems.map(s),
      leftStat: s(leftStat),
      vsAt: s(revealAt),
      rightItems: Array.from({length: nR}, () => s(revealAt)),
      rightStat: s(revealAt),
      revealAt: s(revealAt),
      revealEnd: s(revealEnd),
      winAt: s(winAt),
      verdictAt: s(verdictAt),
    };
  }
  const leftItems = Array.from({length: nL}, (_, i) => (0.15 + i * 0.25) * b);
  const leftStat = 0.25 * b;
  const vsAt = Math.max(1.0 * b, leftItems[nL - 1] + 0.35 * b);
  const rightStart = vsAt + 0.5 * b;
  const rightItems = Array.from({length: nR}, (_, i) => rightStart + i * 0.25 * b);
  const winAt = Math.max(rightItems[nR - 1] + 0.5 * b, rightStart + 0.75 * b);
  const verdictAt = winAt + 0.5 * b;
  const end = (p.verdict ? verdictAt : winAt) + 0.4;
  const k = fitTimeline(end, dur, 0.5);
  const s = (v: number) => v * k;
  return {
    k,
    leftItems: leftItems.map(s),
    leftStat: s(leftStat),
    vsAt: s(vsAt),
    rightItems: rightItems.map(s),
    rightStat: s(rightStart),
    revealAt: -1,
    revealEnd: -1,
    winAt: s(winAt),
    verdictAt: s(verdictAt),
  };
};

const sideTone = (s: Side | undefined, dflt: Tone): Tone => (s?.tone === 'good' || s?.tone === 'bad' || s?.tone === 'neutral' ? s.tone : dflt);
const bulletIcon = (tone: Tone) => (tone === 'good' ? 'check' : tone === 'bad' ? 'x' : 'arrow');

// 一行文字实际会占几行：没有空格（中文这类逐字都能换行的文本）按「总宽度 / 行宽」估算就够准；
// 有空格（英文这类按整词换行的文本）词本身不可拆，贪婪按词换行才准——按总宽度/行宽算会systematically
// 低估行数（长单词卡在行尾时会提前换行、留白浪费），导致后面几栏文字互相压住
const wrapLineCount = (text: string, size: number, w: number): number => {
  if (!/\s/.test(text)) return Math.max(1, Math.ceil((emWidth(text) * size) / w - 0.02));
  const words = text.split(/\s+/).filter(Boolean);
  const spaceW = 0.3 * size;
  // emWidth 是按「拉丁字母 0.55em」估的粗略值，真实字体的字宽会有小出入；留 8% 余量再判断要不要换行，
  // 宁可多估一行（顶多行间多一点空白）也不要少估（少估会把下一条压住，见 14.6s 那次真实回归）
  const SAFETY = 1.08;
  let lines = 1;
  let cur = 0;
  for (const word of words) {
    const ww = emWidth(word) * size * SAFETY;
    const withGap = cur === 0 ? ww : cur + spaceW + ww;
    if (withGap > w && cur > 0) {
      lines++;
      cur = ww;
    } else {
      cur = withGap;
    }
  }
  return Math.max(1, lines);
};

// ---------- 一栏的版面计算（lr 与 beforeAfter 共用，宽度不同） ----------
const layoutSide = (s: Side, w: number, hasMeter: boolean, availH: number, wide: boolean) => {
  const HEAD = wide ? 104 : 96;
  const PAD = wide ? 30 : 22;
  const statH = s.stat ? (wide ? 130 : 104) : 0;
  const meterH = hasMeter ? 84 : 0;
  const bullet = wide ? 44 : 36;
  const textW = w - 2 * PAD - bullet - 12;
  const items = (s.items ?? []).slice(0, 3);
  const rows = (size: number) => items.map((it) => wrapLineCount(it, size, textW));
  const itemsH = (size: number) => rows(size).reduce((a, n) => a + n * size * 1.25 + 26, 0);
  const fixed = HEAD + PAD + statH + meterH + 14 + PAD;
  let size = wide ? 44 : 40;
  while (size > 34 && fixed + itemsH(size) > availH) size -= 1;
  return {HEAD, PAD, statH, meterH, bullet, size, rows: rows(size), h: Math.min(availH, Math.max(wide ? 420 : 380, Math.ceil(fixed + itemsH(size))))};
};
type Lay = ReturnType<typeof layoutSide>;

// ---------- 小刻度条（两栏同一把尺子） ----------
const MiniMeter: React.FC<{level: number; p: number; color: string; label?: string; w: number}> = ({level, p, color, label, w}) => {
  const th = useTheme();
  const v = Math.max(0, Math.min(10, level)) * p;
  const segW = (w - 9 * 6) / 10;
  return (
    <div style={{width: w}}>
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', height: 44}}>
        <span style={{fontSize: 30, fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap'}}>{label ?? ''}</span>
        <span style={{fontFamily: MONO, fontSize: 34, fontWeight: 700, color}}>
          {Math.round(v)}
          <span style={{fontSize: 26, color: th.cardMuted}}>/10</span>
        </span>
      </div>
      <div style={{display: 'flex', gap: 6, marginTop: 4}}>
        {Array.from({length: 10}).map((_, i) => {
          const f = Math.max(0, Math.min(1, v - i));
          return (
            <div key={i} style={{width: segW, height: 24, borderRadius: 7, background: alpha(color, th.dark ? 0.2 : 0.14), overflow: 'hidden'}}>
              <div style={{width: `${f * 100}%`, height: '100%', background: color}} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- 骨架条（内容出来之前占位，卡片不空） ----------
const Skeleton: React.FC<{w: number; h: number; t: number; i: number; th: Theme}> = ({w, h, t, i, th}) => (
  <div style={{width: w, height: h, borderRadius: h / 2, background: th.dark ? 'rgba(255,255,255,0.10)' : th.line, opacity: 0.55 + 0.45 * Math.sin(t * 7 - i * 0.8)}} />
);

// ---------- 一栏 ----------
const SideCard: React.FC<{
  s: Side;
  tone: Tone;
  w: number;
  lay: Lay;
  t: number;
  itemAt: number[];
  statAt: number;
  meterLabel?: string;
  hasMeter: boolean;
  wide: boolean;
  win: number; // 0..1 胜出强调
  dim: number; // 0..1 变暗
  inset?: 'l' | 'r'; // lr 模式给中间的 VS 让位：标题栏靠中线一侧多留白
  lang?: Lang;
}> = ({s, tone, w, lay, t, itemAt, statAt, meterLabel, hasMeter, wide, win, dim, inset, lang = 'zh'}) => {
  const th = useTheme();
  const c = toneColor(th, tone);
  const icon = isIcon(s.icon) ? s.icon : tone === 'good' ? 'bolt' : tone === 'bad' ? 'clock' : 'doc';
  const VS_ROOM = 34;
  const BADGE_ROOM = inset === 'l' ? 40 : 0; // 右卡右上角有胜出角标，标题别钻到它底下
  const titleSize = fitLine(s.title ?? '', w - 2 * lay.PAD - (wide ? 84 : 72) - 16 - (inset ? VS_ROOM : 0) - BADGE_ROOM, wide ? 48 : 42, 34);
  const statP = pop(t, statAt, 12, 190);
  const statBump = bump(t, statAt + 0.3, 0.45);
  const statSize = s.stat ? fitLine(s.stat, w - 2 * lay.PAD, wide ? 104 : 84, 48) : 0;
  const meterP = interpolate(t, [statAt, statAt + 0.6], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const items = (s.items ?? []).slice(0, 3);
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: lay.h,
        boxSizing: 'border-box',
        borderRadius: 34,
        background: th.card,
        boxShadow: win > 0 ? `0 0 0 ${7 * win}px ${alpha(c, 0.95)}, 0 0 ${50 * win}px ${alpha(c, 0.5)}, ${th.shadow}` : th.shadow,
        overflow: 'hidden',
        fontFamily: FONT,
        filter: dim > 0 ? `saturate(${1 - 0.7 * dim})` : undefined,
      }}
    >
      {/* 顶部色带：图标 + 标题 */}
      <div style={{height: lay.HEAD, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 16, padding: `0 ${lay.PAD + (inset === 'r' ? VS_ROOM : 0) + BADGE_ROOM}px 0 ${lay.PAD + (inset === 'l' ? VS_ROOM : 0)}px`, background: alpha(c, th.dark ? 0.22 : 0.12), borderBottom: `3px solid ${alpha(c, 0.35)}`}}>
        <IconDisc name={icon} size={wide ? 68 : 60} tone={tone === 'neutral' ? 'accent' : tone} />
        <div style={{fontSize: titleSize, fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap'}}>{s.title}</div>
      </div>
      <div style={{padding: `${lay.PAD}px ${lay.PAD}px 0`}}>
        {s.stat && (
          <div style={{height: lay.statH, display: 'flex', alignItems: 'center', justifyContent: wide ? 'flex-start' : 'center'}}>
            {t < statAt ? (
              <Skeleton w={w * 0.5} h={Math.round(statSize * 0.6)} t={t} i={0} th={th} />
            ) : (
              <div
                style={{
                  fontSize: statSize,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: c,
                  whiteSpace: 'nowrap',
                  transformOrigin: wide ? '0% 60%' : '50% 60%',
                  transform: `scale(${(0.6 + 0.4 * statP) * (1 + statBump * 0.2)})`,
                  opacity: Math.min(1, statP * 2),
                }}
              >
                {s.stat}
              </div>
            )}
          </div>
        )}
        {hasMeter && (
          <div style={{height: lay.meterH}}>
            <MiniMeter level={typeof s.level === 'number' ? s.level : 0} p={meterP} color={c} label={meterLabel} w={w - 2 * lay.PAD} />
          </div>
        )}
        <div style={{marginTop: 14}}>
          {items.map((it, i) => {
            const at = itemAt[i] ?? 0;
            const q = pop(t, at, 14, 200);
            const lines = lay.rows[i] ?? 1;
            const rowH = lines * lay.size * 1.25 + 26;
            return (
              <div key={i} style={{height: rowH, position: 'relative'}}>
                {t < at ? (
                  <div style={{display: 'flex', alignItems: 'center', gap: 12, height: lay.size * 1.25}}>
                    <div style={{width: lay.bullet, height: lay.bullet, borderRadius: lay.bullet / 2, background: th.dark ? 'rgba(255,255,255,0.10)' : th.line, flex: 'none'}} />
                    <Skeleton w={(w - 2 * lay.PAD - lay.bullet - 12) * (0.9 - i * 0.15)} h={18} t={t} i={i + 1} th={th} />
                  </div>
                ) : (
                  <div style={{display: 'flex', alignItems: 'flex-start', gap: 12, opacity: Math.min(1, q * 1.6), transform: `translateX(${(1 - q) * 30}px)`}}>
                    <div
                      style={{
                        width: lay.bullet,
                        height: lay.bullet,
                        marginTop: (lay.size * 1.25 - lay.bullet) / 2,
                        borderRadius: lay.bullet / 2,
                        background: alpha(c, th.dark ? 0.25 : 0.14),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <Icon name={bulletIcon(tone)} size={lay.bullet * 0.62} color={c} stroke={3} />
                    </div>
                    <div style={{fontSize: lay.size, lineHeight: 1.25, fontWeight: 700, color: th.cardText, wordBreak: 'normal', overflowWrap: 'normal'}}>{glueBreaks(it, lang)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------- 胜出角标 ----------
const WinBadge: React.FC<{x: number; y: number; p: number; color: string; icon?: string}> = ({x, y, p, color, icon = 'check'}) =>
  p > 0 ? (
    <div
      style={{
        position: 'absolute',
        left: x - 44,
        top: y - 44,
        width: 88,
        height: 88,
        borderRadius: 44,
        background: color,
        border: '6px solid #ffffff',
        boxShadow: `0 10px 24px ${alpha(color, 0.45)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${p}) rotate(${(1 - p) * -40}deg)`,
      }}
    >
      <Icon name={icon} size={50} color="#ffffff" stroke={3.4} />
    </div>
  ) : null;

// ---------- 结论胶囊 ----------
const Verdict: React.FC<{text: string; t: number; at: number; top: number}> = ({text, t, at, top}) => {
  const th = useTheme();
  if (t < at) return null;
  const q = pop(t, at, 12, 180);
  const size = fitLine(text, 620, 46, 38);
  const sweep = interpolate(t, [at + 0.2, at + 0.9], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', left: CARD.x0, width: CARD.w, top, height: VERDICT_H, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: Math.min(1, q * 1.6), transform: `translateY(${(1 - q) * 30}px) scale(${0.8 + 0.2 * q})`}}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: th.hot,
          color: textOnHot(th),
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: size,
          padding: '14px 38px',
          borderRadius: 50,
          border: '4px solid #ffffff',
          boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon name="sparkle" size={size} color={textOnHot(th)} stroke={2.6} />
        {text}
        <Sweep p={sweep} w={700} />
      </div>
    </div>
  );
};

const Compare: React.FC<ShotProps<P>> = ({params: p, t, dur, beat, meta}) => {
  const th = useTheme();
  const lang: Lang = meta?.lang === 'en' ? 'en' : 'zh';
  const pl = plan(p, dur, beat);
  const L: Side = p.left ?? {title: '', items: []};
  const R: Side = p.right ?? {title: '', items: []};
  const lt = sideTone(L, 'bad');
  const rt = sideTone(R, 'good');
  const hasMeter = typeof L.level === 'number' || typeof R.level === 'number';
  const verdictSpace = p.verdict ? VERDICT_H + 20 : 0;
  const availH = MAIN.h - 30 - verdictSpace;
  const win = t >= pl.winAt ? pop(t, pl.winAt, 12, 170) : 0;
  const winBump = bump(t, pl.winAt, 0.5);
  const rc = toneColor(th, rt);

  if (p.mode === 'beforeAfter') {
    const w = CARD.w;
    const lay = layoutSide(L, w, hasMeter, availH, true);
    const layR = layoutSide(R, w, hasMeter, availH, true);
    const h = Math.max(lay.h, layR.h);
    const top = MAIN.y0 + Math.round((MAIN.h - h - verdictSpace) / 2);
    const enter = pop(t, 0, 16, 170);
    const rv = interpolate(t, [pl.revealAt, pl.revealEnd], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
    const hx = w * (1 - rv); // 分隔滑杆位置（卡片内 x）
    const handleIn = interpolate(t, [pl.revealAt - 0.25, pl.revealAt], [0, 1], clamp);
    const showHandle = t >= pl.revealAt - 0.25 && rv < 1;
    return (
      <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
        <div
          style={{
            position: 'absolute',
            left: CARD.x0,
            top,
            width: w,
            height: h,
            opacity: Math.min(1, enter * 1.6),
            transform: `translateY(${(1 - enter) * 60}px) scale(${(0.94 + 0.06 * enter) * (1 + winBump * 0.03)})`,
          }}
        >
          {/* 揭晓完成（rv>=1）后右卡不再裁切，和左卡同框同大小、不透明地整张盖住它——这时候左卡已经
              完全看不见，干脆不渲染：省一次绘制，也不会被布局探针当成「文字压住文字」误报 */}
          {rv < 1 && (
            <div style={{position: 'absolute', inset: 0}}>
              <SideCard s={L} tone={lt} w={w} lay={{...lay, h}} t={t} itemAt={pl.leftItems} statAt={pl.leftStat} meterLabel={p.meterLabel} hasMeter={hasMeter} wide win={0} dim={0} lang={lang} />
            </div>
          )}
          {rv > 0 && (
            <div style={{position: 'absolute', inset: 0, clipPath: rv < 1 ? `inset(0px 0px 0px ${hx}px)` : undefined}}>
              <SideCard s={R} tone={rt} w={w} lay={{...layR, h}} t={t} itemAt={pl.rightItems} statAt={pl.rightStat} meterLabel={p.meterLabel} hasMeter={hasMeter} wide win={win} dim={0} lang={lang} />
            </div>
          )}
          {showHandle && (
            <div style={{position: 'absolute', left: hx - 4, top: -24, width: 8, height: h + 48, borderRadius: 4, background: '#ffffff', boxShadow: '0 0 18px rgba(0,0,0,0.3)', opacity: handleIn}}>
              <div
                style={{
                  position: 'absolute',
                  left: -38,
                  top: h / 2 + 24 - 42,
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  background: '#ffffff',
                  boxShadow: '0 8px 22px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="arrow" size={44} color="#1b1a18" stroke={3} style={{transform: 'scaleX(-1)'}} />
              </div>
            </div>
          )}
          <WinBadge x={w - 74} y={-34} p={win} color={rc} icon={rt === 'bad' ? 'alert' : 'check'} />
        </div>
        {p.verdict && <Verdict text={p.verdict} t={t} at={pl.verdictAt} top={top + h + 20} />}
      </div>
    );
  }

  // ---- lr ----
  const layL = layoutSide(L, COL_W, hasMeter, availH, false);
  const layR = layoutSide(R, COL_W, hasMeter, availH, false);
  const h = Math.max(layL.h, layR.h);
  const top = MAIN.y0 + Math.round((MAIN.h - h - verdictSpace) / 2);
  const eL = pop(t, 0, 16, 170);
  const eR = pop(t, 0.1, 16, 170);
  const draw = interpolate(t, [0.1, Math.max(0.3, pl.vsAt)], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const vs = pop(t, pl.vsAt, 10, 200);
  const dim = interpolate(t, [pl.winAt, pl.winAt + 0.3], [0, 1], clamp);
  const xL = CARD.x0;
  const xR = CARD.x0 + COL_W + GAP;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: xL, top, opacity: Math.min(1, eL * 1.6) * (1 - 0.25 * dim), transform: `translateX(${(1 - eL) * -80}px) scale(${1 - 0.04 * dim})`, transformOrigin: '0% 50%'}}>
        <SideCard s={L} tone={lt} w={COL_W} lay={{...layL, h}} t={t} itemAt={pl.leftItems} statAt={pl.leftStat} meterLabel={p.meterLabel} hasMeter={hasMeter} wide={false} win={0} dim={dim} inset="r" lang={lang} />
      </div>
      <div style={{position: 'absolute', left: xR, top, opacity: Math.min(1, eR * 1.6), transform: `translateX(${(1 - eR) * 80}px) scale(${1 + 0.04 * win + 0.03 * winBump})`, transformOrigin: '100% 50%'}}>
        <SideCard s={R} tone={rt} w={COL_W} lay={{...layR, h}} t={t} itemAt={pl.rightItems} statAt={pl.rightStat} meterLabel={p.meterLabel} hasMeter={hasMeter} wide={false} win={win} dim={0} inset="l" lang={lang} />
      </div>
      {/* 中线：从上往下画出 */}
      <div style={{position: 'absolute', left: 540 - 3, top: top - 14, width: 6, height: (h + 28) * draw, borderRadius: 3, background: th.onBg, opacity: 0.9, boxShadow: '0 0 12px rgba(0,0,0,0.2)'}} />
      {/* VS */}
      {t >= pl.vsAt && (
        <div
          style={{
            position: 'absolute',
            left: 540 - 46,
            top: top + layL.HEAD / 2 - 46, // 和两栏标题同一高度，不挡下面的数字和刻度
            width: 92,
            height: 92,
            borderRadius: 46,
            background: th.hot,
            border: '6px solid #ffffff',
            boxShadow: '0 10px 26px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT,
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: 44,
            color: textOnHot(th),
            transform: `scale(${vs}) rotate(${(1 - vs) * 90}deg)`,
          }}
        >
          VS
        </div>
      )}
      <WinBadge x={xR + COL_W - 74} y={top - 34} p={win} color={rc} icon={rt === 'bad' ? 'alert' : 'check'} />
      {p.verdict && <Verdict text={p.verdict} t={t} at={pl.verdictAt} top={top + h + 20} />}
    </div>
  );
};

export default Compare;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur, ctx.beat);
  const out: SfxCue[] = [{at: 0.03, kind: 'whoosh', vol: 0.26}];
  pl.leftItems.forEach((at) => out.push({at, kind: 'pop', vol: 0.14}));
  if (p.mode === 'beforeAfter') {
    out.push({at: pl.revealAt, kind: 'swish', vol: 0.3});
  } else {
    out.push({at: pl.vsAt, kind: 'thud', vol: 0.32});
    pl.rightItems.forEach((at) => out.push({at, kind: 'pop', vol: 0.16}));
  }
  out.push({at: pl.winAt, kind: 'ding', vol: 0.26});
  if (p.verdict) out.push({at: pl.verdictAt, kind: 'pop', vol: 0.22});
  return out;
};
