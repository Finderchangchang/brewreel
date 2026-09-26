import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp, easeOut, fitTimeline, pop} from '../core/anim';
import {emWidth} from '../core/fit';
import {FONT} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {Avatar, TapRipple, pick} from '../core/kit';
import type {Lang} from '../core/kit';
import {CARD, SAFE} from '../core/safe';
import {alpha, toneColor, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// chat：模拟聊天窗（x 150–930，y 560–1340）。中性配色：我方 = 强调色，对方 = 浅灰。
// 时间线（整拍）：卡片进场 → 每拍一条消息 → 输入框打字 → 悬浮球变色弹出面板 →
// 删掉打的字 → 候选逐拍出现 → 点第 1 条「填入」→ 文字飞进输入框。内容多、时长短时整体按比例压缩。
// ============================================================
type Msg = {from: 'me' | 'peer'; text: string};
type P = {
  peer?: string;
  messages: Msg[];
  typing?: string;
  panel?: {title: string; icon?: string; verdict?: string; tone?: 'good' | 'warn' | 'bad' | 'accent'; tags?: string[]; replies?: string[]};
};

// ---------- 版面常量（卡片内坐标） ----------
const X = CARD.x0;
const Y = SAFE.y0;
const W = CARD.w;
const H = SAFE.h;
const HEADER = 84;
const BALL = 64;
const MSG = {size: 42, maxW: 520, avatar: 60, gap: 18, padX: 26};
const INPUT = {font: 38, send: 80, padY: 14, padX: 18, fieldPadY: 10, fieldPadX: 22};
const PANEL = {left: 20, top: HEADER + 12, w: W - 40, padY: 22, padX: 24, head: 52, verdict: 64, tags: 58, label: 44, reply: 84, gap: 10, title: 34};
const PILL_W = 2 * 28 + 2 * 22;

// ---------- 时间线 ----------
export const plan = (p: P, dur: number, beat: number) => {
  const n = p.messages?.length ?? 0;
  const msgAt = Array.from({length: n}, (_, i) => (i === 0 ? 0.15 : beat * i)); // 第 1 条跟卡片一起出现，不留空窗
  const typed = Array.from(p.typing ?? '');
  const charSec = 0.1;
  const replies = p.panel?.replies ?? [];
  // padA：面板弹出后、候选出来前多留几拍读结论；padB：候选出齐后、点「填入」前多留几拍（v2.1 的节奏）
  const build = (padA: number, padB: number) => {
    let cur = n > 0 ? msgAt[n - 1] : beat;
    const typeFrom = typed.length ? cur + beat : -1;
    if (typed.length) cur = typeFrom + typed.length * charSec;
    const panelAt = p.panel ? Math.ceil((cur + 0.3) / beat) * beat : -1;
    if (p.panel) cur = panelAt + beat * 2;
    const deleteFrom = p.panel && typed.length && replies.length ? panelAt + beat : -1;
    const replyAt = replies.map((_, i) => panelAt + beat * 2 + padA + i * beat);
    if (replies.length) cur = replyAt[replies.length - 1];
    const tapAt = replies.length ? cur + beat * 2 + padB : -1;
    if (replies.length) cur = tapAt + 0.7;
    return {cur, typeFrom, panelAt, deleteFrom, replyAt, tapAt};
  };
  let b = build(0, 0);
  // 时长比内容长时，把空余时间分给「读面板」和「挑候选」，不在结尾干停
  const slack = dur - 0.3 - (b.cur + 0.5);
  if (slack >= beat && replies.length) b = build(Math.floor((slack * 0.55) / beat) * beat, Math.floor((slack * 0.3) / beat) * beat);
  const {cur, typeFrom, panelAt, deleteFrom, replyAt, tapAt} = b;
  const delSec = 0.05;
  const k = fitTimeline(cur + 0.5, dur, 0.3);
  const s = (v: number) => (v < 0 ? v : v * k);
  return {
    k,
    msgAt: msgAt.map(s),
    typeFrom: s(typeFrom),
    charSec: charSec * k,
    typed,
    panelAt: s(panelAt),
    deleteFrom: s(deleteFrom),
    delSec: delSec * k,
    replyAt: replyAt.map(s),
    tapAt: s(tapAt),
    collapseAt: tapAt < 0 ? -1 : s(tapAt) + 0.3,
    filledAt: tapAt < 0 ? -1 : s(tapAt) + 0.7,
  };
};
type Plan = ReturnType<typeof plan>;

// 英文按词换行，行尾会空出半个词左右，估行数时把可用宽度打九折，免得气泡比预留的高、压到下一条
const bubbleH = (text: string, lang?: Lang) => {
  const room = (MSG.maxW - MSG.size * 1.16) * (lang === 'en' ? 0.9 : 1);
  const lines = Math.max(1, Math.ceil((emWidth(text) * MSG.size) / room));
  return lines * MSG.size * 1.36 + MSG.size * 0.72;
};

// ---------- 输入框状态 ----------
const inputState = (p: P, pl: Plan, t: number) => {
  const reply = p.panel?.replies?.[0];
  if (reply && pl.filledAt >= 0 && t >= pl.filledAt) return {text: reply, focus: true, filled: true};
  const chars = pl.typed;
  if (chars.length && pl.deleteFrom >= 0 && t >= pl.deleteFrom) {
    const n = chars.length - Math.floor((t - pl.deleteFrom) / pl.delSec) - 1;
    return {text: chars.slice(0, Math.max(0, n)).join(''), focus: true, filled: false};
  }
  if (chars.length && t >= pl.typeFrom) {
    const n = Math.min(chars.length, Math.floor((t - pl.typeFrom) / pl.charSec) + 1);
    return {text: chars.slice(0, n).join(''), focus: true, filled: false};
  }
  return {text: '', focus: false, filled: false};
};

const fieldLines = (text: string) => Math.max(1, Math.ceil((emWidth(text) * INPUT.font) / (W - 2 * INPUT.padX - INPUT.send - 14 - 2 * INPUT.fieldPadX - 30)));
const barHeight = (text: string) => 2 * INPUT.padY + Math.max(INPUT.send, fieldLines(text) * INPUT.font * 1.4 + 2 * INPUT.fieldPadY + 4);

const InputBar: React.FC<{text: string; focus: boolean; t: number; flashAt: number; hint: string}> = ({text, focus, t, flashAt, hint}) => {
  const th = useTheme();
  const blink = Math.floor(t * 2) % 2 === 0;
  const flash = flashAt >= 0 ? interpolate(t, [flashAt, flashAt + 0.6], [1, 0], clamp) * (t >= flashAt ? 1 : 0) : 0;
  return (
    <div style={{background: th.cardAlt, borderTop: `2px solid ${th.line}`, padding: `${INPUT.padY}px ${INPUT.padX}px`, display: 'flex', alignItems: 'flex-end', gap: 14, flex: 'none'}}>
      <div
        style={{
          flex: 1,
          minHeight: INPUT.send,
          boxSizing: 'border-box',
          background: th.card,
          border: `2px solid ${focus ? th.accentLine : th.line}`,
          borderRadius: 28,
          padding: `${INPUT.fieldPadY}px ${INPUT.fieldPadX}px`,
          fontSize: INPUT.font,
          lineHeight: 1.4,
          color: th.cardText,
          boxShadow: flash > 0 ? `0 0 0 ${8 * flash}px ${alpha(th.accent, 0.35 * flash)}` : undefined,
        }}
      >
        {text || (!focus ? <span style={{color: th.cardMuted}}>{hint}</span> : null)}
        {focus && <span style={{display: 'inline-block', width: 4, height: INPUT.font * 1.1, marginLeft: 3, verticalAlign: 'middle', background: th.accent, opacity: blink ? 1 : 0}} />}
      </div>
      <div style={{width: INPUT.send, height: INPUT.send, borderRadius: INPUT.send / 2, background: th.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}>
        <Icon name="send" size={38} color={th.accentText} stroke={2.4} />
      </div>
    </div>
  );
};

// ---------- 产品悬浮球（在顶栏右侧） ----------
const Ball: React.FC<{p: P; pl: Plan; t: number}> = ({p, pl, t}) => {
  const th = useTheme();
  if (!p.panel) return null;
  const on = pl.panelAt >= 0 && t >= pl.panelAt;
  const d = t - pl.panelAt;
  const jump = on ? Math.sin(Math.min(1, d / 0.5) * Math.PI) * Math.exp(-d * 2) : 0;
  const ring = on ? interpolate(t, [pl.panelAt, pl.panelAt + 0.7], [0, 1], clamp) : 1;
  const tone = on ? toneColor(th, p.panel.tone ?? 'warn') : th.accent;
  return (
    <div style={{position: 'absolute', right: 22, top: (HEADER - BALL) / 2, width: BALL, height: BALL, transform: `translateY(${-jump * 18}px) scale(${1 + jump * 0.14})`}}>
      {on && ring < 1 && <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `5px solid ${tone}`, transform: `scale(${1 + ring * 1.3})`, opacity: 1 - ring}} />}
      <div style={{width: '100%', height: '100%', borderRadius: '50%', background: tone, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 16px ${alpha(tone, 0.45)}`}}>
        <Icon name={isIcon(p.panel.icon) ? p.panel.icon : 'sparkle'} size={34} color="#ffffff" stroke={2.4} />
      </div>
      {on && <div style={{position: 'absolute', right: -3, top: -3, width: 20, height: 20, borderRadius: 10, background: tone, border: '3px solid #fff'}} />}
    </div>
  );
};

// ---------- 面板 ----------
const replyTop = (p: P, i: number) =>
  PANEL.top + PANEL.padY + PANEL.head + (p.panel?.verdict ? PANEL.verdict : 0) + (p.panel?.tags?.length ? PANEL.tags : 0) + PANEL.label + i * (PANEL.reply + PANEL.gap);

const Panel: React.FC<{p: P; pl: Plan; t: number; lang?: Lang}> = ({p, pl, t, lang}) => {
  const th = useTheme();
  const panel = p.panel;
  if (!panel || pl.panelAt < 0 || t < pl.panelAt) return null;
  const open = interpolate(t, [pl.panelAt, pl.panelAt + 0.4], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.2))});
  const close = pl.collapseAt >= 0 ? interpolate(t, [pl.collapseAt, pl.collapseAt + 0.3], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)}) : 0;
  const k = open * (1 - close);
  if (k <= 0) return null;
  const tone = toneColor(th, panel.tone ?? 'warn');
  const toneIcon = panel.tone === 'good' ? 'check' : panel.tone === 'accent' ? 'sparkle' : 'alert';
  const replies = panel.replies ?? [];
  const press = pl.tapAt >= 0 && t >= pl.tapAt ? (t - pl.tapAt) / 0.25 : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: PANEL.left,
        top: PANEL.top,
        width: PANEL.w,
        boxSizing: 'border-box',
        background: th.card,
        border: `1.5px solid ${th.line}`,
        borderRadius: 28,
        boxShadow: '0 16px 44px rgba(0,0,0,0.24)',
        padding: `${PANEL.padY}px ${PANEL.padX}px`,
        transformOrigin: `${PANEL.w - 40}px -40px`,
        transform: `translateX(${(1 - k) * 40}px) scale(${0.4 + 0.6 * k})`,
        opacity: Math.min(1, k * 1.5),
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12, height: PANEL.head}}>
        <Icon name={isIcon(panel.icon) ? panel.icon : 'sparkle'} size={38} color={th.accent} stroke={2.4} />
        <div style={{flex: 1, fontSize: PANEL.title, fontWeight: 800, color: th.cardText}}>{panel.title}</div>
        <Icon name="x" size={32} color={th.cardMuted} />
      </div>
      {panel.verdict && (
        <div
          style={{
            height: PANEL.verdict - 8,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 18px',
            borderRadius: 18,
            background: alpha(tone, th.dark ? 0.2 : 0.1),
            borderLeft: `8px solid ${tone}`,
          }}
        >
          <Icon name={toneIcon} size={38} color={tone} stroke={2.6} />
          <div style={{fontSize: 38, fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap'}}>{panel.verdict}</div>
        </div>
      )}
      {!!panel.tags?.length && (
        <div style={{height: PANEL.tags, display: 'flex', alignItems: 'center', gap: 12}}>
          {panel.tags.map((tag, i) => (
            <div key={i} style={{fontSize: 28, fontWeight: 700, color: tone, background: alpha(tone, th.dark ? 0.2 : 0.1), borderRadius: 22, padding: '6px 18px', whiteSpace: 'nowrap'}}>
              {tag}
            </div>
          ))}
        </div>
      )}
      {replies.length > 0 && (
        <>
          <div style={{height: PANEL.label, display: 'flex', alignItems: 'center', fontSize: 28, color: th.cardMuted, borderTop: `2px solid ${th.line}`}}>
            {t < pl.replyAt[0] ? pick(lang, '生成中…', 'Thinking…') : pick(lang, '候选回复', 'Suggested replies')}
          </div>
          {replies.map((r, i) => {
            if (t < pl.replyAt[i]) return null;
            const q = pop(t, pl.replyAt[i], 18, 180);
            const first = i === 0;
            const pr = first ? press : 0;
            const grow = easeOut(t, pl.replyAt[i], 0.25); // 面板高度跟着候选逐条长出来，不跳
            return (
              <div key={i} style={{height: (PANEL.reply + PANEL.gap) * grow, overflow: 'visible'}}>
              <div
                style={{
                  height: PANEL.reply,
                  marginBottom: PANEL.gap,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 16px 0 20px',
                  borderRadius: 20,
                  background: first ? th.accentSoft : th.cardAlt,
                  opacity: Math.min(1, q * 1.5),
                  transform: `translateY(${(1 - q) * 20}px)`,
                }}
              >
                <div style={{width: 44, fontSize: 26, fontWeight: 800, color: th.accent}}>#{i + 1}</div>
                <div style={{flex: 1, fontSize: 36, color: th.cardText, whiteSpace: 'nowrap', overflow: 'hidden'}}>{r}</div>
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    width: PILL_W,
                    height: 48,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    fontWeight: 800,
                    borderRadius: 24,
                    color: first ? th.accentText : th.accent,
                    background: first ? th.accent : 'transparent',
                    border: first ? 'none' : `2px solid ${th.accentLine}`,
                    transform: `scale(${1 - 0.12 * Math.sin(Math.min(1, pr) * Math.PI)})`,
                    flex: 'none',
                  }}
                >
                  {pick(lang, '填入', 'Use')}
                </div>
              </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

// ---------- 文字飞进输入框 ----------
const Fly: React.FC<{p: P; pl: Plan; t: number}> = ({p, pl, t}) => {
  const th = useTheme();
  const reply = p.panel?.replies?.[0];
  if (!reply || pl.collapseAt < 0) return null;
  const fly = interpolate(t, [pl.collapseAt, pl.filledAt], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  if (fly <= 0 || fly >= 1) return null;
  const from = {x: PANEL.left + PANEL.padX + 20 + 56, y: replyTop(p, 0) + 16};
  const to = {x: INPUT.padX + INPUT.fieldPadX, y: H - barHeight(reply) + INPUT.padY + INPUT.fieldPadY};
  return (
    <div
      style={{
        position: 'absolute',
        left: interpolate(fly, [0, 1], [from.x, to.x]),
        top: interpolate(fly, [0, 1], [from.y, to.y]),
        maxWidth: W - 160,
        fontSize: interpolate(fly, [0, 1], [36, INPUT.font]),
        lineHeight: 1.4,
        color: th.cardText,
        background: th.accentSoft,
        borderRadius: 16,
        padding: '4px 12px',
        boxShadow: `0 10px 28px ${alpha(th.accent, 0.35)}`,
        opacity: fly < 0.9 ? 1 : (1 - fly) * 10,
        whiteSpace: 'nowrap',
      }}
    >
      {reply}
    </div>
  );
};

const Chat: React.FC<ShotProps<P>> = ({params: p, t, dur, beat, meta}) => {
  const th = useTheme();
  const lang = meta?.lang;
  const pl = plan(p, dur, beat);
  const enter = pop(t, 0, 16, 170);
  const input = inputState(p, pl, t);
  const reply = p.panel?.replies?.[0];
  // 没有面板时按最终内容定卡片高度并在主体区居中，避免上半截大片空白；有面板时用满 780
  const contentH = HEADER + (p.messages ?? []).reduce((a, m) => a + bubbleH(m.text, lang) + MSG.gap, 0) + 32 + barHeight(p.typing ?? '') + 40;
  const cardH = p.panel ? H : Math.max(440, Math.min(H, Math.round(contentH)));
  const cardY = Y + Math.round((H - cardH) / 2);
  const tapX = PANEL.left + PANEL.w - PANEL.padX - 16 - PILL_W / 2;
  const tapY = replyTop(p, 0) + PANEL.reply / 2;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div
        style={{
          position: 'absolute',
          left: X,
          top: cardY,
          width: W,
          height: cardH,
          borderRadius: 38,
          overflow: 'hidden',
          background: th.card,
          boxShadow: th.shadow,
          display: 'flex',
          flexDirection: 'column',
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 60}px) scale(${0.94 + 0.06 * enter})`,
        }}
      >
        {/* 顶栏 */}
        <div style={{height: HEADER, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: `2px solid ${th.line}`, color: th.cardText}}>
          <span style={{position: 'absolute', left: 30, fontSize: 52, fontWeight: 300, lineHeight: 1}}>‹</span>
          <span style={{fontSize: 36, fontWeight: 700}}>{p.peer || pick(lang, '对方', 'Chat')}</span>
          {!p.panel && <span style={{position: 'absolute', right: 30, fontSize: 38, fontWeight: 700, letterSpacing: 3}}>···</span>}
        </div>
        {/* 消息区 */}
        <div style={{flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: `12px ${MSG.padX}px 20px`}}>
          {(p.messages ?? []).map((m, i) => {
            const at = pl.msgAt[i];
            if (t < at) return null;
            const mine = m.from === 'me';
            const q = pop(t, at, 11, 220);
            const hgt = (bubbleH(m.text, lang) + MSG.gap) * easeOut(t, at, 0.2);
            return (
              <div key={i} style={{height: hgt, flex: 'none', overflow: 'visible'}}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: mine ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: 14,
                    transformOrigin: mine ? '100% 100%' : '0% 100%',
                    transform: `scale(${q})`,
                    opacity: Math.min(1, q * 2),
                  }}
                >
                  <Avatar mine={mine} size={MSG.avatar} />
                  <div
                    style={{
                      maxWidth: MSG.maxW,
                      background: mine ? th.accent : th.bubbleOther,
                      color: mine ? th.accentText : th.bubbleOtherText,
                      fontSize: MSG.size,
                      lineHeight: 1.36,
                      fontWeight: 500,
                      padding: `${MSG.size * 0.36}px ${MSG.size * 0.58}px`,
                      borderRadius: MSG.size * 0.8,
                      borderTopLeftRadius: mine ? MSG.size * 0.8 : 10,
                      borderTopRightRadius: mine ? 10 : MSG.size * 0.8,
                      // 中文任意处可断；英文只在词间断（break-all 会把英文单词从中间劈开）
                      wordBreak: lang === 'en' ? 'normal' : 'break-all',
                      overflowWrap: lang === 'en' ? 'break-word' : undefined,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <InputBar text={input.text} focus={input.focus} t={t} flashAt={input.filled ? pl.filledAt : -1} hint={pick(lang, '输入消息…', 'Type a message…')} />
        <Ball p={p} pl={pl} t={t} />
        <Panel p={p} pl={pl} t={t} lang={lang} />
        {reply && pl.tapAt >= 0 && <TapRipple x={tapX} y={tapY} d={t - pl.tapAt} />}
        <Fly p={p} pl={pl} t={t} />
      </div>
    </div>
  );
};

export default Chat;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(p, ctx.dur, ctx.beat);
  const out: SfxCue[] = [];
  pl.msgAt.forEach((at, i) => out.push({at, kind: 'pop', vol: p.messages[i]?.from === 'me' ? 0.16 : 0.22}));
  if (pl.typeFrom >= 0) pl.typed.forEach((_, i) => out.push({at: pl.typeFrom + i * pl.charSec, kind: 'tap', vol: 0.16}));
  if (pl.panelAt >= 0) {
    out.push({at: pl.panelAt, kind: 'pop', vol: 0.26});
    if (p.panel?.tone === 'bad') out.push({at: pl.panelAt + 0.1, kind: 'thud', vol: 0.4});
  }
  if (pl.deleteFrom >= 0) pl.typed.forEach((_, i) => out.push({at: pl.deleteFrom + i * pl.delSec, kind: 'tap', vol: 0.08}));
  pl.replyAt.forEach((at) => out.push({at, kind: 'pop', vol: 0.16}));
  if (pl.tapAt >= 0) {
    out.push({at: pl.tapAt, kind: 'tap', vol: 0.35});
    out.push({at: pl.collapseAt, kind: 'swish', vol: 0.18});
  }
  return out;
};
