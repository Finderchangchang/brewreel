import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FPS} from '../../../core/safe';
import {VChar, buildPages, pageAt, pageFade, planVoice} from '../../../core/voice';
import type {FilmProps} from '../../types';
import {Lit, unitsOf, usePal, useTk} from './kit';

// ============================================================
// quiz 的配音字幕：有 props.voice 时，主体区下沿（y1340 下面一点）一条墨色字幕条（palette.subBar），
// 纸色字，用本风格的逐字点亮 Lit（没念到的字是幽灵字，念到哪个字亮到哪个字，时间来自 voice.words）。
// {} 强调词用杏黄高亮色。一屏最多两行，长句按时间翻页，上下两屏不会同时出现。
// 没有配音 / subtitles:"off" 时什么都不画；镜头里原有的 Lit 仍按固定速度点亮。
// ============================================================

/** 这一行里第一段 {} 强调词（Lit 的 hot 只收一个子串） */
const hotOf = (ln: VChar[]) => {
  let s = '';
  for (const c of ln) {
    if (c.hot) s += c.c;
    else if (s) break;
  }
  return s.trim() || undefined;
};

/** 按 Lit 的点亮单位（unitsOf）取每个单位第一个字开始念的时刻；lead = 提前量（Lit 每个字要淡入 unitFade 秒，提前半程，字亮到一半的那一帧正好是开口那一帧） */
const clockOf = (ln: VChar[], text: string, lineMode: boolean, lead = 0) => {
  const out: number[] = [];
  let k = 0;
  for (const u of unitsOf(text)) {
    out.push(lineMode ? -1e9 : (ln[k]?.a ?? ln[ln.length - 1]?.a ?? 0) - lead);
    k += Array.from(u).length;
  }
  return out;
};

export const QuizVoiceSub: React.FC<FilmProps> = ({sb, slots, geo}) => {
  const tk = useTk();
  const pal = usePal();
  const t = useCurrentFrame() / FPS;
  const plan = React.useMemo(() => planVoice(sb, slots), [sb, slots]);
  const lang = sb.meta?.lang === 'en' ? 'en' : 'zh';
  const size: number = tk.type?.subtitle ?? 46;
  const padX = 30;
  const maxW = geo.card.x1 - geo.card.x0 - padX * 2 - 8;
  const pages = React.useMemo(
    () => (plan && plan.mode !== 'off' ? buildPages(plan, slots, sb, {lang, maxW, maxSize: size, minSize: Math.max(tk.type?.min ?? 28, 36)}) : []),
    [plan, slots, sb, lang, maxW, size, tk],
  );
  const total = slots.length ? slots[slots.length - 1].end : 0;
  const p = pageAt(pages, t, total);
  if (!plan || !p) return null;
  const {op, dy} = pageFade(pages, p, t, total);
  // 底部提示条（meta.notices）在 noticeY；有它时字幕条让到它下面
  const hasNotice = (sb.meta?.notices ?? []).some((s) => typeof s === 'string' && s.trim());
  const top = geo.noticeY + (hasNotice ? 58 : 8);
  const lineMode = plan.mode === 'line';
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: op, transform: dy ? `translateY(${dy}px)` : undefined}}>
      <div
        key={p.key}
        style={{
          padding: `8px ${padX}px 10px`,
          borderRadius: 12,
          background: pal.subBar ?? pal.ink,
          boxShadow: `6px 6px 0 rgba(0,0,0,0.16)`,
          fontSize: p.size,
          fontWeight: tk.font?.bodyWeight ?? 700,
          color: pal.card,
          lineHeight: 1.34,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {p.lines.map((ln, i) => {
          const text = ln.map((c) => c.c).join('');
          return (
            <div key={i}>
              <Lit text={text} t={t} t0={0} rate={1} clock={clockOf(ln, text, lineMode, (tk.motion?.unitFade ?? 0.066) / 2)} ghost={0.36} color={pal.card} hot={hotOf(ln)} hotColor={pal.highlight} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
