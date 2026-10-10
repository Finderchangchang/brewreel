import React from 'react';
import {Easing, Img, interpolate, staticFile} from 'remotion';
import {clamp, pop} from '../core/anim';
import {fitLine} from '../core/fit';
import {FONT} from '../core/font';
import {Icon} from '../core/icons';
import {pick} from '../core/kit';
import {Illust, isIllust} from '../illust';
import {CARD, MAIN} from '../core/safe';
import {alpha, useTheme} from '../core/theme';
import {labelInk} from '../core/plate';
import {useStylePalette} from '../styles/context';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// beforeAfter：前后对比滑块（design §1.5，只对美业开放）。
//   先完整展示「之前」，一根竖直滑杆从右扫到左露出「之后」，随后完整停留在「之后」。
// 主角 = 滑杆本身的移动（不是两张图来回切）；固定角标「顾客授权实拍 · 未修图」和
// 「效果因人而异，仅供参考」由组件写死，模型不能改（design 要求）。
// 没有照片时不画占位插画——design §1.5 明确要求这种情况直接报错，交给校验拦，这里只负责有图时的呈现。
// ============================================================
type Side = {src?: string; label?: string};
type P = {
  before?: Side;
  after?: Side;
  consent?: boolean;
  retouched?: boolean;
  sameAngle?: boolean;
  subVertical?: 'hair' | 'nail' | 'lash';
  caption2?: string;
};

const SUB_ICON: Record<string, string> = {hair: 'beauty/scissors', nail: 'beauty/polish', lash: 'beauty/tweezers'};

// ---------- 时间线：先停在「之前」，滑杆扫过，停在「之后」。按 dur 等比例分配，不写死 1.5/1/1.5 秒
// （design §1.5 建议每侧≥1.5秒+擦除1秒，但镜头 dur 下限只有 2 秒，两者冲突；这里按比例压缩，dur 越长越接近设计建议）。
export const plan = (dur: number) => {
  const wipe = Math.min(1, Math.max(0.4, dur * 0.22));
  const before = Math.max(0.5, dur * 0.42);
  const revealAt = before;
  const revealEnd = revealAt + wipe;
  return {revealAt, revealEnd};
};

const Frame: React.FC<{src?: string; label?: string}> = ({src, label}) => {
  const th = useTheme();
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {src ? (
        <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      ) : (
        <div style={{width: '100%', height: '100%', background: th.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <span style={{fontSize: 34, color: th.cardMuted}}>{label ?? ''}</span>
        </div>
      )}
    </div>
  );
};

const BeforeAfter: React.FC<ShotProps<P>> = ({params: p, t, dur, meta}) => {
  const th = useTheme();
  const consentPlate = labelInk(th, useStylePalette());
  const lang = meta?.lang;
  const enter = pop(t, 0, 16, 170);
  const pl = plan(dur);
  const rv = interpolate(t, [pl.revealAt, pl.revealEnd], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const W = CARD.w;
  const H = 700;
  const top = MAIN.y0 + Math.round((MAIN.h - H) / 2) + 18;
  const hx = W * (1 - rv); // 卡片内的滑杆 x（从右向左走）
  const showHandle = t >= pl.revealAt - 0.15 && rv < 1;
  const handleIn = interpolate(t, [pl.revealAt - 0.15, pl.revealAt], [0, 1], clamp);
  const beforeOp = interpolate(t, [pl.revealAt, pl.revealEnd], [1, 0.0], clamp);
  const afterOp = interpolate(t, [pl.revealAt, pl.revealEnd], [0, 1], clamp);
  const subIcon = p.subVertical ? SUB_ICON[p.subVertical] : undefined;
  const beforeLabel = p.before?.label ?? pick(lang, '做之前', 'Before');
  const afterLabel = p.after?.label ?? pick(lang, '做完', 'After');
  const labelSize = (txt: string) => fitLine(txt, 240, 34, 28);

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <div
        style={{
          position: 'absolute',
          left: CARD.x0,
          top,
          width: W,
          height: H,
          borderRadius: 36,
          overflow: 'hidden',
          boxShadow: th.shadow,
          opacity: Math.min(1, enter * 1.6),
          transform: `translateY(${(1 - enter) * 50}px) scale(${0.94 + 0.06 * enter})`,
        }}
      >
        <Frame src={p.before?.src} label={beforeLabel} />
        {rv > 0 && (
          <div style={{position: 'absolute', inset: 0, clipPath: rv < 1 ? `inset(0px 0px 0px ${hx}px)` : undefined}}>
            <Frame src={p.after?.src} label={afterLabel} />
          </div>
        )}
        {/* 顶部固定角标：顾客授权实拍 · 未修图（模型不能改） */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 20,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 8,
            ...consentPlate,
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          <Icon name="shield" size={24} color={consentPlate.color} stroke={2.4} />
          {pick(lang, '顾客授权实拍 · 未修图', 'Client consented · Unretouched')}
        </div>
        {/* 分项小图标 */}
        {subIcon && isIllust(subIcon) && (
          <div style={{position: 'absolute', left: 18, top: 18, width: 64, height: 64, borderRadius: 18, background: alpha('#000000', 0.4), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Illust name={subIcon} size={48} color="accent" animate t={t} />
          </div>
        )}
        {/* 左右标签 */}
        <div
          style={{
            position: 'absolute',
            left: 22,
            bottom: 22,
            padding: '8px 20px',
            borderRadius: 18,
            background: th.accentFill,
            color: th.accentText,
            fontWeight: 800,
            fontSize: labelSize(beforeLabel),
            opacity: beforeOp,
          }}
        >
          {beforeLabel}
        </div>
        <div
          style={{
            position: 'absolute',
            right: 22,
            bottom: 22,
            padding: '8px 20px',
            borderRadius: 18,
            background: th.good,
            color: '#ffffff',
            fontWeight: 800,
            fontSize: labelSize(afterLabel),
            opacity: afterOp,
          }}
        >
          {afterLabel}
        </div>
        {/* 滑杆 */}
        {showHandle && (
          <div style={{position: 'absolute', left: hx - 4, top: -20, width: 8, height: H + 40, background: '#ffffff', boxShadow: '0 0 18px rgba(0,0,0,0.35)', opacity: handleIn}}>
            <div
              style={{
                position: 'absolute',
                left: -36,
                top: H / 2 - 38,
                width: 80,
                height: 80,
                borderRadius: 40,
                background: '#ffffff',
                boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <Icon name="arrow" size={30} color="#1b1a18" stroke={3} style={{transform: 'scaleX(-1)'}} />
              <Icon name="arrow" size={30} color="#1b1a18" stroke={3} style={{marginLeft: -14}} />
            </div>
          </div>
        )}
      </div>
      {p.caption2 && (
        <div style={{position: 'absolute', left: CARD.x0, width: W, top: top + H + 22, textAlign: 'center', fontSize: 32, fontWeight: 700, color: th.cardText, opacity: Math.min(1, enter * 1.6)}}>
          {p.caption2}
        </div>
      )}
      {/* 固定小字：效果因人而异（模型不能改，design 要求「自动显示」） */}
      <div style={{position: 'absolute', left: CARD.x0, width: W, top: top + H + (p.caption2 ? 68 : 24), textAlign: 'center', fontSize: 26, color: th.cardMuted, opacity: Math.min(1, enter * 1.6)}}>
        {pick(lang, '效果因人而异，仅供参考', 'Results vary from person to person')}
      </div>
    </div>
  );
};

export default BeforeAfter;

export const sfx = (_p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const pl = plan(ctx.dur);
  return [
    {at: 0.05, kind: 'pop', vol: 0.2},
    {at: pl.revealAt, kind: 'whoosh', vol: 0.28},
    {at: pl.revealEnd, kind: 'thud', vol: 0.22},
  ];
};
