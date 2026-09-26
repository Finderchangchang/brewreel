import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {clamp, float, pop, rise} from '../core/anim';
import {fitSize} from '../core/fit';
import {FONT} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {BigText, IconDisc, Sweep} from '../core/kit';
import {alpha, useTheme} from '../core/theme';
import type {ShotProps} from '../core/types';

// ============================================================
// endCard：片尾。这一镜没有字幕，所以可以用字幕带（y 260–540）放 logo 和品牌名。
// 版面：logo y 280–480 → 品牌名 ~510 → 口号大字 ~600 → 卖点胶囊 → 行动号召（全部 ≤1340）
// 节奏：logo、品牌名、口号第 0 帧一起起（不留只有品牌胶囊的空档）→ 卖点从 +1 拍起每 ½ 拍一个 → 行动号召
// 口号 + 卖点 + 行动号召这一组在 y 594–1300 里垂直居中；卖点 ≤2 条且没有行动号召时胶囊放大，主体区下半截不空
// ============================================================
type P = {brand: string; slogan: string; points?: string[]; cta?: string; icon?: string};

const EndCard: React.FC<ShotProps<P>> = ({params: p, t, beat, meta}) => {
  const th = useTheme();
  const b = beat / 0.5; // 以 120 BPM 为基准缩放节奏
  const m = pop(t, 0, 10, 160);
  const br = pop(t, 0, 18, 160);
  const big = pop(t, 0, 14, 170);
  const points = (p.points ?? []).slice(0, 3);
  const pointAt = (i: number) => (0.5 + i * 0.25) * b;
  const ctaAt = (0.5 + points.length * 0.25 + 0.25) * b;
  const slogan = p.slogan ?? '';
  const size = fitSize(slogan, 780, 112, 72, 40);
  const nLines = slogan.split('\n').length;
  const sloganH = nLines * size * 1.16;
  const roomy = points.length <= 2 && !p.cta;
  const ptFont = roomy ? 46 : 40;
  const ptStep = roomy ? 124 : 100;
  const groupH = sloganH + 44 + points.length * ptStep + (p.cta ? 120 : 0);
  const sloganTop = Math.round(594 + Math.max(0, (1300 - 594 - groupH) / 2));
  let y = Math.round(sloganTop + sloganH + 44);
  const halo = (t % 2) / 2;
  const logoSize = 170;
  const sweep = interpolate(t, [ctaAt + 0.3, ctaAt + 1.0], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      {/* logo / 品牌图标 */}
      <div style={{position: 'absolute', left: 540 - logoSize / 2, top: 306, width: logoSize, height: logoSize, transform: `scale(${m}) translateY(${float(t, 0, 5)}px)`}}>
        <div style={{position: 'absolute', inset: -20, borderRadius: '50%', border: `4px solid ${alpha(th.onBg.startsWith('#') ? th.onBg : '#ffffff', 0.5)}`, transform: `scale(${1 + halo * 0.12})`, opacity: 1 - halo}} />
        {meta?.logo ? (
          <Img src={staticFile(meta.logo)} style={{width: logoSize, height: logoSize, objectFit: 'contain'}} />
        ) : (
          <IconDisc name={isIcon(p.icon) ? p.icon : 'sparkle'} size={logoSize} style={{border: '8px solid #ffffff'}} />
        )}
      </div>
      {/* 品牌名 */}
      {/* 品牌名放在卡片色胶囊里：浅色背景（如 mood=0 的浅青）上白字对比度不够 */}
      <div style={{position: 'absolute', left: 150, width: 780, top: 500, display: 'flex', justifyContent: 'center', ...rise(br)}}>
        <div style={{background: th.card, color: th.cardText, fontSize: 48, fontWeight: 900, lineHeight: 1.25, padding: '6px 34px', borderRadius: 40, boxShadow: '0 8px 22px rgba(0,0,0,0.2)', whiteSpace: 'nowrap'}}>{p.brand}</div>
      </div>
      {/* 口号大字 */}
      <div style={{position: 'absolute', left: 150, width: 780, top: sloganTop, opacity: Math.min(1, big * 1.5), transform: `translateY(${(1 - big) * 50}px) scale(${0.85 + 0.15 * big})`}}>
        <BigText text={slogan} size={size} />
      </div>
      {/* 卖点胶囊 */}
      {points.map((pt, i) => {
        const q = pop(t, pointAt(i), 16, 170);
        const top = y;
        y += ptStep;
        return (
          <div key={i} style={{position: 'absolute', left: 150, width: 780, top, display: 'flex', justifyContent: 'center', ...rise(q)}}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: th.card,
                color: th.cardText,
                fontWeight: 700,
                fontSize: ptFont,
                padding: roomy ? '18px 40px' : '14px 34px',
                borderRadius: 50,
                boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon name="check" size={ptFont} color={th.accent} stroke={3} />
              {pt}
            </div>
          </div>
        );
      })}
      {/* 行动号召 */}
      {p.cta &&
        (() => {
          const q = pop(t, ctaAt, 12, 180);
          return (
            <div style={{position: 'absolute', left: 150, width: 780, top: Math.min(y + 12, 1230), display: 'flex', justifyContent: 'center', ...rise(q, 30)}}>
              <div
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: th.hot,
                  color: '#1b1a18',
                  fontWeight: 900,
                  fontSize: 44,
                  padding: '16px 40px',
                  borderRadius: 54,
                  border: '4px solid #ffffff',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.cta}
                <Icon name="arrow" size={42} color="#1b1a18" stroke={3} />
                <Sweep p={sweep} w={600} />
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default EndCard;
