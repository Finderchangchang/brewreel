import React from 'react';
import {Easing, interpolate} from 'remotion';
import {bump, clamp, ease, pop} from '../core/anim';
import {fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {MAIN} from '../core/safe';
import {alpha, textOnHot, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// steps：一张流程卡（x 150–930，竖直居中于 y 560–1340），左边一列节点 + 竖连线，右边步骤文字。
// 主角：连线上的光点从上一个节点跑到下一个节点，落拍时节点点亮（弹一下 + 脉冲圈），
// 该步文字从骨架条换成真字滑入，浅色高亮条移到当前行。全部点亮后下一拍：每个节点弹出 ✓ + ding。
// 未点亮的步骤先画成虚线节点 + 灰色骨架条，第 0 帧就能看出「一共几步」。
// ============================================================
type Step = {title: string; desc?: string; icon?: string};
type P = {items: Step[]};

const PAD = 30; // 卡片上下内边距
const NODE_X = MAIN.x0 + 30 + 20; // 节点左缘 x=200
const TEXT_X = (d: number) => NODE_X + d + 34; // 文字左缘
const TEXT_W = (d: number) => MAIN.x1 - 30 - TEXT_X(d);

export const geom = (n: number) => {
  const pitch = n <= 2 ? 250 : n === 3 ? 215 : 178;
  const node = n >= 4 ? 96 : 108;
  const cardH = n * pitch + PAD * 2;
  const cardY = MAIN.y0 + Math.round((MAIN.h - cardH) / 2);
  const rowY = (i: number) => cardY + PAD + i * pitch;
  const cy = (i: number) => rowY(i) + pitch / 2;
  return {pitch, node, cardH, cardY, rowY, cy};
};

/** 每步点亮时间：第 1 步 0 秒，之后每隔 1–4 拍；全部点亮后再过 1 拍是「完成」时刻，之后留 ≥1.2 秒 */
export const plan = (n: number, dur: number, beat: number) => {
  const k = n > 1 ? Math.max(1, Math.min(4, Math.floor((dur - 1.2 - beat) / (n - 1) / beat))) : 1;
  const at = Array.from({length: n}, (_, i) => i * k * beat);
  const fill = Math.min(0.4, k * beat * 0.8); // 光点在两节点之间跑的时长，落拍时到达
  return {at, doneAt: at[n - 1] + beat, fill};
};

const grey = (c: string, a: number) => alpha(c.startsWith('#') ? c : '#9CA3AF', a);

const Steps: React.FC<ShotProps<P>> = ({params: p, t, dur, beat}) => {
  const th = useTheme();
  const items = (p.items ?? []).slice(0, 4);
  const n = items.length;
  if (!n) return null;
  const g = geom(n);
  const pl = plan(n, dur, beat);
  const D = g.node;
  const ncx = NODE_X + D / 2;
  let cur = -1;
  pl.at.forEach((a, i) => {
    if (t >= a) cur = i;
  });
  const done = t >= pl.doneAt;
  const enter = pop(t, 0, 16, 170);
  const muted = th.cardMuted;

  // 连线点亮长度 + 正在跑的那一段
  let lit = 0;
  let moving = false;
  for (let i = 1; i < n; i++) {
    const q = ease(t, pl.at[i] - pl.fill, pl.fill);
    lit += q * g.pitch;
    if (q > 0 && q < 1) moving = true;
  }
  const lineTop = g.cy(0);
  const lineLen = g.cy(n - 1) - lineTop;

  // 当前行高亮条（完成后淡出）
  const prev = Math.max(0, cur - 1);
  const mv = cur <= 0 ? 1 : interpolate(t, [pl.at[cur], pl.at[cur] + 0.3], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const bandY = cur < 0 ? g.rowY(0) : g.rowY(prev) + (g.rowY(cur) - g.rowY(prev)) * mv;
  const bandOp = cur < 0 ? 0 : interpolate(t, [pl.doneAt, pl.doneAt + 0.3], [1, 0], clamp) * Math.min(1, (t - pl.at[0]) / 0.2);

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div
        style={{
          position: 'absolute',
          left: MAIN.x0,
          top: g.cardY,
          width: MAIN.w,
          height: g.cardH,
          borderRadius: 40,
          background: th.card,
          boxShadow: th.shadow,
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 60}px) scale(${0.94 + 0.06 * enter})`,
        }}
      >
        {/* 内层用画面绝对坐标：整体平移回画布原点 */}
        <div style={{position: 'absolute', left: -MAIN.x0, top: -g.cardY, width: 1080, height: 1920}}>
          {/* 高亮条 */}
          <div style={{position: 'absolute', left: MAIN.x0 + 14, width: MAIN.w - 28, top: bandY + 8, height: g.pitch - 16, borderRadius: 28, background: th.accentSoft, opacity: bandOp}} />
          {/* 底线 + 点亮的线 */}
          {n > 1 && (
            <>
              <div style={{position: 'absolute', left: ncx - 5, top: lineTop, width: 10, height: lineLen, borderRadius: 5, background: grey(muted, 0.28)}} />
              <div style={{position: 'absolute', left: ncx - 5, top: lineTop, width: 10, height: lit, borderRadius: 5, background: th.accent, boxShadow: `0 0 14px ${alpha(th.accent, 0.5)}`}} />
            </>
          )}
          {/* 跑动的光点 */}
          {moving && (
            <div
              style={{
                position: 'absolute',
                left: ncx - 18,
                top: lineTop + lit - 18,
                width: 36,
                height: 36,
                borderRadius: 18,
                boxSizing: 'border-box',
                background: th.hot,
                border: `5px solid ${th.card}`,
                boxShadow: `0 0 0 6px ${alpha(th.hot, 0.35)}, 0 0 24px ${alpha(th.hot, 0.8)}`,
              }}
            />
          )}
          {items.map((it, i) => {
            const on = t >= pl.at[i];
            const q = pop(t, pl.at[i], 11, 200);
            const hit = bump(t, pl.at[i] + 0.1, 0.45);
            const active = i === cur && !done;
            const pulse = active ? (Math.max(0, t - pl.at[i]) % 1) / 1 : 0;
            const y = g.cy(i);
            const icon = isIcon(it.icon) ? it.icon : null;
            const chk = pop(t, pl.doneAt + i * 0.06, 12, 220);
            const tq = pop(t, pl.at[i] + 0.05, 14, 180);
            const tw = TEXT_W(D);
            const titleSize = fitLine(it.title, tw, n >= 4 ? 52 : 58, 40);
            const descSize = it.desc ? fitLine(it.desc, tw, 40, 34) : 0;
            return (
              <React.Fragment key={i}>
                {/* 节点：虚线占位 → 点亮 */}
                <div style={{position: 'absolute', left: NODE_X, top: y - D / 2, width: D, height: D}}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      boxSizing: 'border-box',
                      background: th.cardAlt,
                      border: `4px dashed ${grey(muted, 0.7)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: MONO,
                      fontWeight: 700,
                      fontSize: 44,
                      color: muted,
                      opacity: on ? 1 - Math.min(1, q * 2) : 1,
                    }}
                  >
                    {i + 1}
                  </div>
                  {on && (
                    <>
                      {active && <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `5px solid ${th.accent}`, transform: `scale(${1 + pulse * 0.6})`, opacity: 1 - pulse}} />}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          background: th.accent,
                          boxShadow: `0 10px 24px ${alpha(th.accent, 0.4)}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: Math.min(1, q * 2),
                          transform: `scale(${(0.5 + 0.5 * q) * (1 + hit * 0.18)})`,
                        }}
                      >
                        {icon ? (
                          <Icon name={icon} size={D * 0.5} color={th.accentText} stroke={2.4} />
                        ) : (
                          <span style={{fontFamily: MONO, fontWeight: 700, fontSize: D * 0.46, color: th.accentText}}>{i + 1}</span>
                        )}
                      </div>
                      {icon && (
                        <div
                          style={{
                            position: 'absolute',
                            left: -8,
                            top: -8,
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            boxSizing: 'border-box',
                            border: `3px solid ${th.card}`,
                            background: th.hot,
                            color: textOnHot(th),
                            fontFamily: MONO,
                            fontWeight: 700,
                            fontSize: 26,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: Math.min(1, q * 2),
                            transform: `scale(${q})`,
                          }}
                        >
                          {i + 1}
                        </div>
                      )}
                    </>
                  )}
                  {/* 完成 ✓ */}
                  {chk > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        right: -10,
                        bottom: -8,
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        boxSizing: 'border-box',
                        border: `3px solid ${th.card}`,
                        background: th.good,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: `scale(${chk})`,
                      }}
                    >
                      <Icon name="check" size={28} color="#FFFFFF" stroke={3.4} />
                    </div>
                  )}
                </div>
                {/* 文字：骨架条 → 真字 */}
                {!on || tq < 0.05 ? (
                  <div style={{position: 'absolute', left: TEXT_X(D), top: y - (it.desc ? 37 : 17)}}>
                    <div style={{width: Math.min(tw, 60 + Array.from(it.title).length * 34), height: 34, borderRadius: 17, background: grey(muted, 0.22)}} />
                    {it.desc && <div style={{marginTop: 18, width: Math.min(tw, 80 + Array.from(it.desc).length * 22), height: 22, borderRadius: 11, background: grey(muted, 0.15)}} />}
                  </div>
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      left: TEXT_X(D),
                      width: tw,
                      top: y,
                      transform: `translateY(-50%) translateX(${(1 - tq) * 70}px)`,
                      opacity: Math.min(1, tq * 1.6),
                    }}
                  >
                    <div style={{fontSize: titleSize, fontWeight: 900, lineHeight: 1.18, color: th.cardText, whiteSpace: 'nowrap'}}>{it.title}</div>
                    {it.desc && <div style={{marginTop: 6, fontSize: descSize, fontWeight: 500, lineHeight: 1.3, color: th.cardSub, whiteSpace: 'nowrap'}}>{it.desc}</div>}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Steps;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const n = Math.min(4, p.items?.length ?? 0);
  if (!n) return [];
  const pl = plan(n, ctx.dur, ctx.beat);
  return [
    ...pl.at.map((at, i) => ({at: at + 0.02, kind: i === 0 ? 'pop' : 'tick', vol: i === 0 ? 0.24 : 0.32})),
    ...pl.at.slice(1).map((at) => ({at: Math.max(0, at - pl.fill), kind: 'swish', vol: 0.1})),
    {at: pl.doneAt, kind: 'ding', vol: 0.24},
  ];
};
