import React from 'react';
import {bump, easeOut, pop} from '../core/anim';
import {emWidth, fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {Avatar, IconDisc} from '../core/kit';
import {MAIN} from '../core/safe';
import {alpha, textOnHot, toneColor, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// quickList：快切列表（参考 jev v2 S5）。3–6 行白卡按拍左右交替飞入；
// 每行落定后右侧「盖章」：分数从 0 滚到目标值并鼓一下，或判词胶囊从大到小砸下，左边色条按语气色长满。
// 主角 = 每行的判定（分数/标签）一行一行砸下来，颜色直接传达好坏。
// 版面：可选小标题胶囊 y 560–640；行区在剩余主体区里竖直居中，x 150–930。
// ============================================================
type Tone = 'good' | 'warn' | 'bad' | 'neutral';
type Row = {text: string; tag?: string; tone?: Tone; icon?: string; score?: number};
type P = {title?: string; items: Row[]; max?: number; quote?: boolean};

const RIGHT_W = 176; // 右侧判定区宽
const TITLE_H = 76;
const TITLE_GAP = 24;

export const geom = (n: number, hasTitle: boolean) => {
  const top0 = MAIN.y0 + (hasTitle ? TITLE_H + TITLE_GAP : 0);
  const H = MAIN.y1 - top0;
  const gap = n >= 5 ? 16 : 22;
  const rh = Math.floor(Math.min(170, (H - gap * (n - 1)) / n));
  const tot = rh * n + gap * (n - 1);
  const y0 = top0 + Math.round((H - tot) / 2);
  return {rh, gap, y0};
};

/** 行出现时间：每行 1–2 拍；行多时长短就改成半拍一行，保证最后一行后还有 ≥1 秒 */
export const plan = (n: number, dur: number, beat: number) => {
  let step = beat * Math.max(1, Math.min(2, Math.floor((dur - 1.0) / Math.max(1, n - 1) / beat)));
  if ((n - 1) * step > dur - 1.0) step = beat / 2;
  const at = Array.from({length: n}, (_, i) => i * step);
  const stamp = Math.min(0.2, step * 0.6);
  return {at, stamp: at.map((a) => a + stamp)};
};

const fmtScore = (v: number, dec: number) => (dec > 0 ? v.toFixed(dec) : String(Math.round(v)));
const decOf = (v: number) => (Number.isInteger(v) ? 0 : 1);

// 分数区字号：数字（等宽 0.6em）+ 「/max」（0.42 倍字号）放进 RIGHT_W
const scoreSize = (num: string, suffix: string, maxSize: number) => {
  const em = 0.6 * num.length + 0.6 * 0.42 * suffix.length;
  return Math.max(40, Math.min(maxSize, Math.floor((RIGHT_W - 6) / em)));
};

const QuickRow: React.FC<{row: Row; i: number; t: number; at: number; stampAt: number; rh: number; y: number; max?: number; quote: boolean}> = ({
  row,
  i,
  t,
  at,
  stampAt,
  rh,
  y,
  max,
  quote,
}) => {
  const th = useTheme();
  const p = pop(t, at, 13, 210);
  const toneRaw = toneColor(th, row.tone); // 不写 tone = 品牌强调色
  const accentish = !row.tone;
  const toneFill = accentish ? th.accentFill : toneRaw;
  const toneInk = accentish ? th.accentInk : toneRaw;
  const toneKey = row.tone === 'good' || row.tone === 'warn' || row.tone === 'bad' ? row.tone : 'accent';
  const hasScore = typeof row.score === 'number' && Number.isFinite(row.score);
  const hasRight = hasScore || !!row.tag;
  const big = rh >= 140;

  // 盖章
  const s = pop(t, stampAt, 10, 220);
  const roll = easeOut(t, stampAt, 0.28);
  const hit = bump(t, stampAt + 0.22, 0.4);
  const strip = easeOut(t, stampAt, 0.3);

  // 左侧
  const lead = quote ? Math.min(64, Math.round(rh * 0.5)) : Math.min(84, Math.round(rh * 0.58));
  const inner = 780 - 34 - 26; // 左右内边距后
  const textW = inner - lead - (quote ? 14 : 20) - (hasRight ? RIGHT_W + 16 : 0);
  const text = row.text ?? '';
  const textSize = quote
    ? Math.max(40, Math.min(big ? 52 : 46, Math.floor(textW / (emWidth(text) + 1.16))))
    : fitLine(text, textW, big ? 56 : 48, 40);
  const icon = isIcon(row.icon) ? row.icon : row.tone === 'good' ? 'check' : row.tone === 'bad' || row.tone === 'warn' ? 'alert' : 'sparkle';

  // 右侧
  const dec = hasScore ? decOf(row.score as number) : 0;
  const numStr = hasScore ? fmtScore(row.score as number, dec) : '';
  const suffix = hasScore && typeof max === 'number' ? `/${max}` : '';
  const wordSize = 30;
  const numMax = Math.min(100, Math.round(rh * (row.tag ? 0.56 : 0.72)));
  const nSize = hasScore ? scoreSize(numStr, suffix, numMax) : 0;
  const tagSize = row.tag ? Math.max(34, Math.min(big ? 46 : 40, Math.floor((RIGHT_W - 30) / Math.max(1, emWidth(row.tag))))) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: MAIN.x0,
        top: y,
        width: MAIN.w,
        height: rh,
        boxSizing: 'border-box',
        borderRadius: Math.min(40, rh * 0.3),
        overflow: 'hidden',
        background: th.card,
        boxShadow: th.shadow,
        display: 'flex',
        alignItems: 'center',
        padding: '0 26px 0 34px',
        opacity: Math.min(1, p * 1.6),
        transform: `translateX(${(1 - p) * (i % 2 ? 170 : -170)}px) scale(${0.9 + 0.1 * p})`,
      }}
    >
      {/* 语气色条 */}
      <div style={{position: 'absolute', left: 0, bottom: 0, width: 12, height: `${strip * 100}%`, background: toneFill}} />
      {/* 左：头像+气泡 或 图标+文字 */}
      {quote ? (
        <div style={{display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0}}>
          <Avatar size={lead} hue={(i * 67 + 12) % 360} />
          <div
            style={{
              background: th.bubbleOther,
              color: th.bubbleOtherText,
              fontSize: textSize,
              fontWeight: 600,
              lineHeight: 1.3,
              padding: `${textSize * 0.28}px ${textSize * 0.58}px`,
              borderRadius: textSize * 0.8,
              borderTopLeftRadius: 10,
              whiteSpace: 'nowrap',
            }}
          >
            {text}
          </div>
        </div>
      ) : (
        <div style={{display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 0}}>
          <IconDisc name={icon} size={lead} tone={toneKey} soft />
          <div style={{fontSize: textSize, fontWeight: 800, color: th.cardText, whiteSpace: 'nowrap'}}>{text}</div>
        </div>
      )}
      {/* 右：分数 / 判词 */}
      {hasRight && (
        <div style={{width: RIGHT_W, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', marginLeft: 16}}>
          {hasScore ? (
            <>
              <div
                style={{
                  fontFamily: MONO,
                  fontWeight: 700,
                  fontSize: nSize,
                  lineHeight: 1,
                  color: toneInk,
                  whiteSpace: 'nowrap',
                  opacity: Math.min(1, s * 2),
                  transform: `scale(${1 + hit * 0.25})`,
                  transformOrigin: '100% 60%',
                }}
              >
                {fmtScore((row.score as number) * roll, dec)}
                {suffix && <span style={{fontSize: Math.round(nSize * 0.42), color: th.cardMuted}}>{suffix}</span>}
              </div>
              {row.tag && (
                <div style={{fontFamily: FONT, fontWeight: 800, fontSize: wordSize, color: toneInk, marginTop: 4, whiteSpace: 'nowrap', opacity: Math.min(1, s * 2)}}>{row.tag}</div>
              )}
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 124,
                height: tagSize * 1.6,
                padding: `0 ${Math.round(tagSize * 0.3)}px`,
                borderRadius: tagSize * 0.5,
                boxSizing: 'border-box',
                border: `4px solid ${alpha('#FFFFFF', 0.85)}`,
                background: toneFill,
                color: !row.tone ? th.accentText : row.tone === 'neutral' && th.dark ? th.card : '#FFFFFF',
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: tagSize,
                whiteSpace: 'nowrap',
                boxShadow: `0 8px 18px ${alpha(toneFill.startsWith('#') ? toneFill : '#000000', 0.35)}`,
                opacity: Math.min(1, s * 2.5),
                transform: `scale(${1.8 - 0.8 * s}) rotate(${-4 - (1 - s) * 14}deg)`, // 盖章：从大砸下，最后微斜 4°
                transformOrigin: '70% 50%',
              }}
            >
              {row.tag}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const QuickList: React.FC<ShotProps<P>> = ({params: p, t, dur, beat}) => {
  const th = useTheme();
  const items = (p.items ?? []).slice(0, 6);
  const n = items.length;
  if (!n) return null;
  const hasTitle = !!p.title;
  const g = geom(n, hasTitle);
  const pl = plan(n, dur, beat);
  const tq = pop(t, 0, 15, 190);
  const titleSize = hasTitle ? fitLine(p.title as string, 640, 44, 40) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      {hasTitle && (
        <div style={{position: 'absolute', left: MAIN.x0, width: MAIN.w, top: MAIN.y0, height: TITLE_H, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: Math.min(1, tq * 1.6), transform: `translateY(${(1 - tq) * -30}px)`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, height: TITLE_H, boxSizing: 'border-box', padding: '0 36px', borderRadius: TITLE_H / 2, background: th.hot, color: textOnHot(th), fontSize: titleSize, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 10px 26px rgba(0,0,0,0.2)', border: '4px solid #ffffff'}}>
            <Icon name="bolt" size={40} color={textOnHot(th)} stroke={2.6} />
            {p.title}
          </div>
        </div>
      )}
      {items.map((r, i) =>
        t >= pl.at[i] ? (
          <QuickRow key={i} row={r} i={i} t={t} at={pl.at[i]} stampAt={pl.stamp[i]} rh={g.rh} y={g.y0 + i * (g.rh + g.gap)} max={p.max} quote={!!p.quote} />
        ) : null,
      )}
    </div>
  );
};

export default QuickList;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const items = (p.items ?? []).slice(0, 6);
  if (!items.length) return [];
  const pl = plan(items.length, ctx.dur, ctx.beat);
  const out: SfxCue[] = [];
  let lastHeavy = -9;
  items.forEach((r, i) => {
    out.push({at: pl.at[i] + 0.01, kind: 'swish', vol: 0.12});
    const heavy = r.tone === 'bad' && pl.stamp[i] - lastHeavy >= 0.5;
    if (heavy) lastHeavy = pl.stamp[i];
    out.push({at: pl.stamp[i], kind: heavy ? 'thud' : 'pop', vol: heavy ? 0.32 : 0.22});
  });
  return out;
};
