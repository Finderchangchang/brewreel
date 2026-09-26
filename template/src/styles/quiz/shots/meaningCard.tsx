import React from 'react';
import {interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitLine} from '../../../core/fit';
import {pick} from '../../../core/kit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Eyebrow, Lit, Strike, fitDisplay, litDur, usePal, useTk} from '../parts/kit';
import {Peek} from '../parts/cast';
import {useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / meaningCard：满屏主色释义卡（参考片 20.3–26.3 秒，全片唯一一次换底色）。
// 1 帧硬切到纯主色满屏，第 0 帧第一个 word（被误解的词，反白大字）和下方「原句卡」已经在位（不留整屏纯色的空帧），
// 然后逐行出字（左对齐）：neq「≠ 误解」逐字 + 删除线从左往右画 / eq「= 正解」逐字 / 后面的 word 用亮色整块出现。
// 第一个 = 行用亮色（答案），后面的 = 行用反白色。行之间停 0.25 秒；释义 8 字/秒。
// 原句卡贴底（下沿 y1320），释义行在它上方居中，吉祥物从卡上沿探头、最后一行出完灯泡亮——下半屏不空着。
// 原句卡：白底圆角卡，放 clip 最后一句（关键词主色 + 马克笔）和译文；没有 clip 用 replay.line / duoScene.reply。
// ============================================================
type Row = {kind: 'word' | 'neq' | 'eq'; text: string};
type P = {eyebrow?: string; rows: Row[]};

export const plan = (p: P) => {
  const rate = tokens.motion.charsPerSec.meaning;
  let at = 0;
  return (p.rows ?? []).slice(0, 5).map((r, i) => {
    // 第一行（word）第 0 帧就在位；后面的行接着出
    const t0 = i === 0 ? 0 : at;
    const d = r.kind === 'word' ? 0.2 : litDur(`= ${r.text ?? ''}`, rate, 0.2);
    const strikeAt = r.kind === 'neq' ? t0 + d + tokens.motion.strike.delay : undefined;
    at = i === 0 ? 0.3 : t0 + d + (r.kind === 'neq' ? 0.5 : 0.3);
    return {t0, end: t0 + d, strikeAt};
  });
};

const MeaningCard: React.FC<ShotProps<P>> = ({params, t, meta}) => {
  const tk = useTk();
  const pal = usePal();
  const clip = useStoryParams<{lines?: {text: string; zh?: string}[]; key?: string}>('clip');
  const rep = useStoryParams<{line?: string; zh?: string; key?: string}>('replay');
  const duo = useStoryParams<{reply?: string; replyZh?: string; key?: string}>('duoScene');
  const rows = (params.rows ?? []).slice(0, 5);
  const pl = plan(params);
  const x0 = tk.layout?.marginLeft ?? 150;
  const last = clip?.lines?.[clip.lines.length - 1];
  const ex = last?.text ? {line: last.text, zh: last.zh, key: clip?.key} : rep?.line ? {line: rep.line, zh: rep.zh, key: rep.key} : duo?.reply ? {line: duo.reply, zh: duo.replyZh, key: duo.key} : null;
  // 先量高度：释义行 + 原句卡，整块在 y300–1340 里垂直居中
  let words = 0;
  const metrics = rows.map((r) => {
    if (r.kind === 'word') {
      const first = words++ === 0;
      // 宽度按 740 估（大号拉丁字宽估算有误差，留 40px 余量不出 x930）
      const size = fitDisplay(r.text ?? '', 740, first ? tk.type?.meaningWord ?? 180 : tk.type?.meaningWord2 ?? 150, 72);
      return {size, h: size * 1.1 + 12 + (first ? 0 : 26), first};
    }
    const size = fitLine(`= ${r.text ?? ''}`, 780, tk.type?.meaningLine ?? 80, 56);
    return {size, h: size * 1.3 + 14, first: false};
  });
  const rowsH = metrics.reduce((a, m) => a + m.h, 0);
  const exFs = ex ? fitLine(ex.line, 700, tk.type?.subtitle ?? 50, 34) : 0;
  const exLines = exFs <= 36 ? 2 : 1;
  const cardH = ex ? 90 + exFs * 1.3 * exLines + (ex.zh ? 60 : 0) + 20 : 0;
  // 原句卡贴底（下沿 y1320），释义行在卡上方的空间里垂直居中；没有原句卡时释义行在 y300–1340 里居中
  const cardTop0 = 1320 - cardH;
  const top0 = ex ? Math.max(380, 300 + (cardTop0 - 60 - 300 - rowsH) / 2) : Math.max(380, 300 + (1040 - rowsH) / 2);
  let y = top0;
  let eqs = 0;
  const items = rows.map((r, i) => {
    const P0 = pl[i];
    const M = metrics[i];
    if (r.kind === 'word') {
      if (!M.first) y += 26;
      const top = y;
      y += M.size * 1.1 + 12;
      const on = t >= P0.t0;
      const s = interpolate(t, [P0.t0, P0.t0 + 0.2], [M.first ? 1.04 : 0.94, 1], clamp);
      return (
        <div key={i} style={{position: 'absolute', left: x0, top, fontSize: M.size, fontWeight: 900, lineHeight: 1.1, color: M.first ? pal.onPrimary : pal.highlight, letterSpacing: tk.font?.latinTracking ?? '-0.025em', whiteSpace: 'nowrap', opacity: M.first ? 1 : on ? interpolate(t, [P0.t0, P0.t0 + 0.08], [0, 1], clamp) : 0, transform: `scale(${s})`, transformOrigin: 'left center'}}>
          {r.text}
        </div>
      );
    }
    const size = M.size;
    const top = y;
    y += M.h;
    const neg = r.kind === 'neq';
    const color = neg ? pal.onPrimaryMuted : eqs++ === 0 ? pal.highlight : pal.onPrimary;
    const symOn = t >= P0.t0 - 0.12;
    return (
      <div key={i} style={{position: 'absolute', left: x0, top, fontSize: size, fontWeight: 900, lineHeight: 1.3, color, whiteSpace: 'nowrap', display: 'flex', gap: size * 0.3}}>
        <span style={{opacity: symOn ? 1 : 0}}>{neg ? '≠' : '='}</span>
        {neg ? (
          <Strike t={t} t0={P0.strikeAt ?? 99} color={pal.strike}>
            <Lit text={r.text ?? ''} t={t} t0={P0.t0} rate={tk.motion?.charsPerSec?.meaning ?? 8} mode="type" />
          </Strike>
        ) : (
          <span>
            <Lit text={r.text ?? ''} t={t} t0={P0.t0} rate={tk.motion?.charsPerSec?.meaning ?? 8} mode="type" />
          </span>
        )}
      </div>
    );
  });
  const cardTop = Math.max(cardTop0, top0 + rowsH + 40);
  const lastEnd = pl.length ? pl[pl.length - 1].end : 0;
  // 吉祥物从原句卡上沿探头（右侧），释义行离卡够远才放；最后一行出完灯泡亮
  const peekRoom = cardTop - (top0 + rowsH) >= 230;
  return (
    <div style={{position: 'absolute', inset: 0, background: pal.primary}}>
      {params.eyebrow ? <Eyebrow text={params.eyebrow} x={x0 + 2} y={Math.max(290, top0 - 70)} color={pal.onPrimary} dot={pal.highlight} /> : null}
      {items}
      {ex && peekRoom ? <Peek t={t} at={0.2} cardY={cardTop} lit={t >= lastEnd + 0.2} fx={t >= lastEnd + 0.2 ? 'hearts' : undefined} fxT={t - lastEnd - 0.2} /> : null}
      {ex ? (
        <div style={{position: 'absolute', left: 150, width: 780, top: cardTop, height: cardH, borderRadius: 28, background: pal.card, border: `4px solid ${pal.ink}`, boxShadow: `0 10px 0 ${pal.ink}`, boxSizing: 'border-box', padding: '20px 36px', display: 'flex', flexDirection: 'column', gap: 8}}>
          <div style={{fontSize: tk.type?.speaker ?? 28, fontWeight: 800, color: pal.primary, lineHeight: 1.2}}>{pick(meta?.lang, '原句', 'In context')}</div>
          <div style={{fontSize: exFs, fontWeight: 800, color: pal.ink, lineHeight: 1.3}}>
            <Lit text={ex.line} t={t} t0={-1} rate={40} hot={ex.key && ex.line.includes(ex.key) ? ex.key : undefined} marker={!!ex.key && ex.line.includes(ex.key)} markerAt={lastEnd + 0.1} />
          </div>
          {ex.zh ? <div style={{fontSize: tk.type?.translation ?? 40, fontWeight: 600, color: pal.ink, opacity: 0.72, lineHeight: 1.3}}>{ex.zh}</div> : null}
        </div>
      ) : null}
    </div>
  );
};
export default MeaningCard;

export const sfx = (p: P): SfxCue[] => {
  const pl = plan(p);
  const out: SfxCue[] = [{at: 0, kind: 'thud', vol: 0.3}];
  (p.rows ?? []).slice(0, 5).forEach((r, i) => {
    if (r.kind === 'word' && i > 0) out.push({at: pl[i].t0, kind: 'pop', vol: 0.28});
    if (pl[i].strikeAt !== undefined) out.push({at: pl[i].strikeAt!, kind: 'swish', vol: 0.2});
  });
  return out;
};
