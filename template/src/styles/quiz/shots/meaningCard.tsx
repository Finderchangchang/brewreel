import React from 'react';
import {Easing, interpolate} from 'remotion';
import {clamp} from '../../../core/anim';
import {fitLine} from '../../../core/fit';
import type {SfxCue, ShotProps} from '../../../core/types';
import {Lit, Mark, Scribble, cardStyle, fitDisplay, litDur, usePal, useTk, useVoice} from '../parts/kit';
import {useStoryParams} from '../parts/story';
import tokens from '../tokens.json';

// ============================================================
// quiz / meaningCard：词条卡（全片唯一一次换底色）。
// 1 帧硬切到主色「桌面」，一张纸质词条卡已经压在桌上（第 0 帧就有卡和词头，不留纯色空帧），0.28 秒从侧面翻正；
// 卡里按词典排版逐行出字（左对齐）：词头（第一个 word，墨色大字）+ 细线 → 误解行（朱红小叉 + 灰字，
// 字出完朱红批改笔来回划一道波浪线）→ 释义行（主色编号圆 ① ② + 墨色字，第一条释义扫杏黄马克笔）
// → 后面的 word 是主色的「▸ 相关说法」副词头。卡底部是「例」栏：clip 最后一句（关键词主色 + 马克笔）和译文；
// 没有 clip 用 replay.line / duoScene.reply。释义 8 字/秒，行之间停 0.3 秒。
// ============================================================
type Row = {kind: 'word' | 'neq' | 'eq'; text: string};
type P = {eyebrow?: string; label?: string; rows: Row[]};

export const plan = (p: P) => {
  const rate = tokens.motion.charsPerSec.meaning;
  let at = 0.3;
  return (p.rows ?? []).slice(0, 5).map((r, i) => {
    // 第一行（词头）第 0 帧就在位；翻卡落定后下一行开始
    const t0 = i === 0 ? 0 : at;
    const d = r.kind === 'word' ? 0.2 : litDur(r.text ?? '', rate, 0.2);
    const strikeAt = r.kind === 'neq' ? t0 + d + tokens.motion.scribble.delay : undefined;
    at = i === 0 ? at : t0 + d + (r.kind === 'neq' ? 0.5 : 0.3);
    return {t0, end: t0 + d, strikeAt};
  });
};

const MeaningCard: React.FC<ShotProps<P>> = ({params, t, meta}) => {
  const tk = useTk();
  const pal = usePal();
  const voice = useVoice(meta);
  const clip = useStoryParams<{lines?: {text: string; zh?: string}[]; key?: string}>('clip');
  const rep = useStoryParams<{line?: string; zh?: string; key?: string}>('replay');
  const duo = useStoryParams<{reply?: string; replyZh?: string; key?: string}>('duoScene');
  const rows = (params.rows ?? []).slice(0, 5);
  const pl = plan(params);
  const last = clip?.lines?.[clip.lines.length - 1];
  const ex = last?.text ? {line: last.text, zh: last.zh, key: clip?.key} : rep?.line ? {line: rep.line, zh: rep.zh, key: rep.key} : duo?.reply ? {line: duo.reply, zh: duo.replyZh, key: duo.key} : null;
  const cardX = 120;
  const cardW = 840;
  const pad = 46;
  const innerW = cardW - pad * 2 - 8;
  const rate = tk.motion?.charsPerSec?.meaning ?? 8;
  // 先量高度：卡片整体在 y280–1330 里垂直居中
  let words = 0;
  const metrics = rows.map((r) => {
    if (r.kind === 'word') {
      const first = words++ === 0;
      const size = fitDisplay(r.text ?? '', first ? innerW - 20 : innerW - 90, first ? tk.type?.headword ?? 132 : tk.type?.subword ?? 88, 64);
      return {size, h: first ? size * 1.12 + 28 : size * 1.18 + 10, first};
    }
    const size = fitLine(r.text ?? '', innerW - 90, tk.type?.sense ?? 60, 44);
    return {size, h: size * 1.35 + 14, first: false};
  });
  const headH = 58;
  const rowsH = metrics.reduce((a, m) => a + m.h, 0);
  const exFs = ex ? fitLine(ex.line, innerW - 20, tk.type?.subtitle ?? 46, 34) : 0;
  const exLines = ex && exFs <= 36 ? 2 : 1;
  const exH = ex ? 36 + 52 + exFs * 1.3 * exLines + (ex.zh ? 56 : 0) : 0;
  const cardH = pad * 2 + headH + rowsH + exH;
  const cardTop = Math.max(280, Math.round(280 + (1330 - 280 - cardH) / 2));
  const flip = tk.motion?.cardFlip ?? 0.28;
  const rot = interpolate(t, [0, flip], [26, 0], {...clamp, easing: Easing.out(Easing.back(1.4))});
  const lastEnd = pl.length ? pl[pl.length - 1].end : 0;
  let y = 0;
  let eqN = 0;
  const items = rows.map((r, i) => {
    const P0 = pl[i];
    const M = metrics[i];
    const top = y;
    y += M.h;
    if (r.kind === 'word') {
      if (M.first)
        return (
          <div key={i} style={{position: 'absolute', left: 0, top, width: innerW}}>
            <div style={{fontSize: M.size, fontWeight: tk.font?.displayWeight ?? 800, lineHeight: 1.12, color: pal.ink, letterSpacing: tk.font?.latinTracking ?? '-0.01em', whiteSpace: 'nowrap'}}>{r.text}</div>
            <div style={{marginTop: 10, height: 4, background: pal.ink, width: '100%'}} />
          </div>
        );
      const op = interpolate(t, [P0.t0, P0.t0 + 0.1], [0, 1], clamp);
      const dx = interpolate(t, [P0.t0, P0.t0 + 0.2], [-24, 0], {...clamp, easing: Easing.out(Easing.cubic)});
      return (
        <div key={i} style={{position: 'absolute', left: 0, top: top + 6, display: 'flex', alignItems: 'center', gap: 18, opacity: op, transform: `translateX(${dx}px)`, whiteSpace: 'nowrap'}}>
          <svg width={40} height={40} viewBox="0 0 40 40">
            <path d="M8 6 L34 20 L8 34 Z" fill={pal.primary} />
          </svg>
          <span style={{fontSize: M.size, fontWeight: 800, lineHeight: 1.18, color: pal.primary, letterSpacing: tk.font?.latinTracking ?? '-0.01em'}}>{r.text}</span>
        </div>
      );
    }
    const neg = r.kind === 'neq';
    const n = neg ? 0 : ++eqN;
    const symOn = t >= P0.t0 - 0.1;
    const badge = neg ? (
      <div style={{width: 58, height: 58, borderRadius: 10, border: `4px solid ${pal.pen}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
        <Mark kind="cross" size={34} color={pal.pen} stroke={10} />
      </div>
    ) : (
      <div style={{width: 58, height: 58, borderRadius: '50%', background: pal.primary, color: pal.onPrimary, fontFamily: tk.font?.mono, fontSize: 34, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1}}>{n}</div>
    );
    const text = <Lit text={r.text ?? ''} t={t} t0={P0.t0} rate={rate} mode="type" marker={!neg && n === 1} hot={!neg && n === 1 ? r.text : undefined} hotColor={pal.ink} markerAt={P0.end + 0.05} markerDur={0.6} />;
    return (
      <div key={i} style={{position: 'absolute', left: 0, top, display: 'flex', alignItems: 'center', gap: 24, fontSize: M.size, fontWeight: 800, lineHeight: 1.35, color: neg ? pal.wrong : pal.ink, whiteSpace: 'nowrap'}}>
        <div style={{opacity: symOn ? 1 : 0, transform: `scale(${symOn ? interpolate(t, [P0.t0 - 0.1, P0.t0], [0.6, 1], clamp) : 0.6})`}}>{badge}</div>
        {neg ? (
          <Scribble t={t} t0={P0.strikeAt ?? 99}>
            <span>{text}</span>
          </Scribble>
        ) : (
          <span>{text}</span>
        )}
      </div>
    );
  });
  return (
    <div style={{position: 'absolute', inset: 0, background: pal.primary}}>
      <div style={{position: 'absolute', inset: 0, perspective: 1800}}>
        <div style={{position: 'absolute', left: cardX, top: cardTop, width: cardW, height: cardH, padding: pad, transform: `rotateY(${rot}deg)`, transformOrigin: 'left center', ...cardStyle(pal, {radius: 20, stroke: 5, shadow: 14})}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, height: headH - 16, whiteSpace: 'nowrap'}}>
            <span style={{padding: '3px 12px 4px', borderRadius: 6, background: pal.ink, color: pal.card, fontFamily: tk.font?.mono, fontSize: tk.type?.tag ?? 28, fontWeight: 700, letterSpacing: tk.font?.tagTracking ?? '0.08em', lineHeight: 1.2}}>{params.label ?? voice('entry')}</span>
            {params.eyebrow ? <span style={{fontSize: tk.type?.eyebrow ?? 30, fontWeight: 700, color: pal.ink, opacity: 0.75}}>{params.eyebrow}</span> : null}
          </div>
          <div style={{position: 'relative', height: rowsH, marginTop: 16}}>{items}</div>
          {ex ? (
            <div style={{marginTop: 36, paddingTop: 22, borderTop: `3px dashed ${pal.ink}`, display: 'flex', flexDirection: 'column', gap: 6, opacity: interpolate(t, [0, 0.12], [0.5, 1], clamp)}}>
              <div style={{display: 'flex', alignItems: 'flex-start', gap: 18}}>
                <span style={{padding: '2px 12px 4px', borderRadius: 6, background: pal.pen, color: pal.card, fontSize: tk.type?.speaker ?? 28, fontWeight: 800, lineHeight: 1.3, flexShrink: 0, marginTop: 6}}>{voice('example')}</span>
                <div style={{fontSize: exFs, fontWeight: 800, color: pal.ink, lineHeight: 1.3}}>
                  <Lit text={ex.line} t={t} t0={-1} rate={40} hot={ex.key && ex.line.includes(ex.key) ? ex.key : undefined} marker={!!ex.key && ex.line.includes(ex.key)} markerAt={lastEnd + 0.1} />
                </div>
              </div>
              {ex.zh ? <div style={{fontSize: tk.type?.translation ?? 40, fontWeight: 600, color: pal.ink, opacity: 0.7, lineHeight: 1.3, paddingLeft: 4}}>{ex.zh}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
export default MeaningCard;

export const sfx = (p: P): SfxCue[] => {
  const pl = plan(p);
  const out: SfxCue[] = [{at: 0, kind: 'thud', vol: 0.3}, {at: 0.02, kind: 'swish', vol: 0.18}];
  (p.rows ?? []).slice(0, 5).forEach((r, i) => {
    if (i > 0) out.push({at: pl[i].t0, kind: 'pop', vol: r.kind === 'word' ? 0.28 : 0.2});
    if (pl[i].strikeAt !== undefined) out.push({at: pl[i].strikeAt!, kind: 'swish', vol: 0.2});
  });
  return out;
};
