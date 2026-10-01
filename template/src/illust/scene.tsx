import React from 'react';
import {pop} from '../core/anim';
import {alpha, mixHex, useTheme} from '../core/theme';
import {DEFAULT_ILLUST, Illust, illustIndustry, isIllust} from './index';

// ============================================================
// IllustScene：没有实拍素材时的「整卡插画场景」（替代以前「灰卡中间一个小图标」）。
// 评审原话：一个约 150px 的图标放在 780px 的灰卡中间，11 秒都是这种画面。
// 现在铺满整张卡：
//   1. 主题色底 + 点阵纹理 + 两团柔光
//   2. 主插画约占卡片短边 62%（780 卡上约 480px），底下有落地阴影，背后一圈光晕
//   3. 同行业 2–3 个小道具从卡片外飘进来，之后轻微漂浮
//   4. 整个场景慢推（Ken Burns），叠一层按行业区分的粒子：餐饮热气、美业/电商闪光、文旅光带、教育小方块
//   5. 入场时一道扫光
// 所有颜色只从主题取（accent / card / cardText），6 套主题都能用。
// 用法：<IllustScene name="food/meatball" w={780} h={780} t={t} dur={dur} />（放进一个 overflow:hidden 的容器里）
// ============================================================

/** 每个行业可以当配角的小道具（都是 icons.tsx 里真画了的） */
const PROPS: Record<string, string[]> = {
  food: ['food/steamer', 'food/tea', 'food/coffee', 'food/receipt', 'food/bowl', 'food/meatball'],
  ecommerce: ['ecommerce/tag', 'ecommerce/parcel', 'ecommerce/thermometer', 'ecommerce/gift', 'ecommerce/bag'],
  education: ['education/pencil', 'education/book', 'education/keycap', '_base/cert', 'education/laptop'],
  beauty: ['beauty/comb', 'beauty/scissors', 'beauty/hairdryer', 'beauty/polish'],
  travel: ['travel/landscape', 'travel/breakfast', 'travel/train', 'travel/house', 'travel/bed'],
  _base: ['_base/clock', '_base/pin', '_base/calendar'],
};

type Particle = 'steam' | 'sparkle' | 'rays' | 'bits';
const PARTICLE: Record<string, Particle> = {food: 'steam', beauty: 'sparkle', ecommerce: 'sparkle', travel: 'rays', education: 'bits', _base: 'bits'};

/** 字符串 → 稳定的小整数（同一张插画每次挑同样的配角） */
const hash = (s: string) => Array.from(s).reduce((a, c) => (a * 31 + (c.codePointAt(0) ?? 0)) >>> 0, 7);

const hexOr = (c: string, fallback: string) => (/^#?[0-9a-f]{6}$/i.test(c.trim()) ? c : fallback);

export const resolveSceneIllust = (wanted: string | undefined, industry?: string) =>
  isIllust(wanted) ? wanted : DEFAULT_ILLUST[industry ?? ''] ?? '_base/bubble';

export const IllustScene: React.FC<{name?: string; w: number; h: number; t: number; dur?: number; industry?: string; variant?: number}> = ({
  name,
  w,
  h,
  t,
  dur = 3,
  industry,
  variant = 0,
}) => {
  const th = useTheme();
  const main = resolveSceneIllust(name, industry);
  const ind = illustIndustry(main) === '_base' ? industry ?? '_base' : illustIndustry(main);
  const card = hexOr(th.card, th.dark ? '#141B33' : '#FFFFFF');
  const accent = hexOr(th.accent, '#3B82F6');
  const top = mixHex(accent, card, th.dark ? 0.45 : 0.42);
  const bot = mixHex(accent, card, th.dark ? 0.7 : 0.78);
  const ink = hexOr(th.cardText, th.dark ? '#EEF2FF' : '#111827');

  const short = Math.min(w, h);
  const band = h < w * 0.6; // 横条（storeCard 门头兜底之类）
  const tall = h > w * 1.5; // 竖条（grid 两张并排的格子）
  const mainSize = Math.round(Math.min(480, band ? h * 0.78 : tall ? w * 0.8 : short * 0.62));
  const cx = w / 2;
  const cy = band ? h * 0.5 : tall ? h * 0.36 : h * 0.42;

  // 慢推：整场景 1 → 1.07，轻微上移
  const prog = Math.min(1, Math.max(0, t) / Math.max(1, dur));
  const kb = 1 + 0.07 * prog;
  const kbY = -12 * prog;

  const enter = pop(t, 0, 13, 150);
  const bobY = Math.sin((t / 1.8) * Math.PI * 2) * 6;
  const haloPulse = 0.5 + 0.5 * Math.sin((t / 2) * Math.PI * 2);

  // 配角：宽卡 3 个，窄卡 2 个，很小的格子不放
  const pool = (PROPS[ind] ?? PROPS._base).filter((x) => x !== main && isIllust(x));
  const nProps = short < 300 ? 0 : w >= 600 && !band ? 3 : 2;
  // 深色主题里卡片色是深的，粒子/光效要用浅色（cardText）才看得见
  const light = th.dark ? ink : card;
  // variant：grid/tour 里同一张插画出现多次时，换一组配角 + 主图左右镜像，避免几格长得一模一样
  const start = pool.length ? (hash(main) + variant * 2) % pool.length : 0;
  const mirror = variant % 2 === 1;
  const props = Array.from({length: Math.min(nProps, pool.length)}, (_, i) => pool[(start + i) % pool.length]);
  const propSize = Math.round(band ? mainSize * 0.62 : Math.max(110, mainSize * 0.34));
  const slots = band
    ? [
        {x: w * 0.17, y: h * 0.56, from: -1},
        {x: w * 0.83, y: h * 0.5, from: 1},
      ]
    : tall
    ? [
        {x: w * 0.3, y: h * 0.7, from: -1},
        {x: w * 0.72, y: h * 0.8, from: 1},
      ]
    : [
        {x: w * 0.16, y: h * 0.3, from: -1},
        {x: w * 0.86, y: h * 0.56, from: 1},
        {x: w * 0.8, y: h * 0.2, from: 1},
      ];

  const particle = PARTICLE[ind] ?? 'bits';

  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(165deg, ${top} 0%, ${bot} 100%)`}}>
      {/* 点阵纹理 + 柔光 */}
      <div
        style={{
          position: 'absolute',
          inset: -40,
          backgroundImage: `radial-gradient(${alpha(ink, th.dark ? 0.1 : 0.07)} 2.2px, transparent 2.8px)`,
          backgroundSize: '30px 30px',
          transform: `translate(${(-10 * prog).toFixed(1)}px, ${(-14 * prog).toFixed(1)}px)`,
        }}
      />
      <div style={{position: 'absolute', left: -w * 0.2, top: -h * 0.15, width: w * 0.8, height: w * 0.8, borderRadius: '50%', background: alpha(card, th.dark ? 0.1 : 0.35), filter: 'blur(40px)'}} />
      <div style={{position: 'absolute', right: -w * 0.25, bottom: -h * 0.1, width: w * 0.7, height: w * 0.7, borderRadius: '50%', background: alpha(accent, 0.28), filter: 'blur(50px)'}} />

      <div style={{position: 'absolute', inset: 0, transform: `translateY(${kbY.toFixed(1)}px) scale(${kb.toFixed(4)})`, transformOrigin: `${cx}px ${cy}px`}}>
        {/* 光晕 + 落地阴影 */}
        <div
          style={{
            position: 'absolute',
            left: cx - mainSize * 0.62,
            top: cy - mainSize * 0.62,
            width: mainSize * 1.24,
            height: mainSize * 1.24,
            borderRadius: '50%',
            background: alpha(card, th.dark ? 0.12 : 0.5),
            boxShadow: `0 0 0 ${Math.round(10 + 8 * haloPulse)}px ${alpha(card, th.dark ? 0.05 : 0.18)}`,
            opacity: Math.min(1, enter * 1.4),
            transform: `scale(${0.8 + 0.2 * enter})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: cx - mainSize * 0.46,
            top: cy + mainSize * 0.4,
            width: mainSize * 0.92,
            height: mainSize * 0.12,
            borderRadius: '50%',
            background: alpha(ink, 0.14),
            filter: 'blur(6px)',
            opacity: enter,
          }}
        />

        {/* 配角道具：从卡外飘进来，之后轻飘 */}
        {props.map((id, i) => {
          const s = slots[i];
          const q = pop(t, 0.12 + i * 0.16, 15, 120);
          const fy = Math.sin((t / 2.2) * Math.PI * 2 + i * 1.7) * 8;
          const dx = (1 - q) * s.from * (propSize + 80);
          return (
            <div
              key={id}
              style={{
                position: 'absolute',
                left: s.x - propSize / 2,
                top: s.y - propSize / 2,
                width: propSize,
                height: propSize,
                opacity: Math.min(0.92, q * 1.4),
                transform: `translate(${dx.toFixed(1)}px, ${fy.toFixed(1)}px) rotate(${(s.from * (1 - q) * 18 + Math.sin(t + i) * 3).toFixed(2)}deg)`,
              }}
            >
              <div style={{position: 'absolute', inset: propSize * 0.08, borderRadius: '50%', background: alpha(card, th.dark ? 0.18 : 0.55)}} />
              <Illust name={id} size={propSize} color="primary" animate t={t + i * 0.4} />
            </div>
          );
        })}

        {/* 主插画 */}
        <div
          style={{
            position: 'absolute',
            left: cx - mainSize / 2,
            top: cy - mainSize / 2,
            width: mainSize,
            height: mainSize,
            opacity: Math.min(1, enter * 1.6),
            transform: `translateY(${((1 - enter) * 40 + bobY).toFixed(1)}px) scale(${(0.82 + 0.18 * enter).toFixed(3)})`,
          }}
        >
          <div style={{transform: mirror ? 'scaleX(-1)' : undefined}}>
            <Illust name={main} size={mainSize} color="primary" animate t={t} />
          </div>
        </div>

        {/* 粒子层 */}
        <Particles kind={particle} w={w} h={h} cx={cx} cy={cy} r={mainSize / 2} t={t} ink={ink} card={light} />
      </div>


    </div>
  );
};

const Particles: React.FC<{kind: Particle; w: number; h: number; cx: number; cy: number; r: number; t: number; ink: string; card: string}> = ({kind, w, h, cx, cy, r, t, ink, card}) => {
  if (kind === 'steam') {
    // 热气：6 个小圆从主图上方往上冒、边冒边淡
    return (
      <>
        {Array.from({length: 6}, (_, i) => {
          const p = (t / 2.2 + i / 6) % 1;
          const x = cx + (i - 2.5) * r * 0.22 + Math.sin(p * Math.PI * 2 + i) * 10;
          const y = cy - r * 0.7 - p * r * 0.9;
          const s = 10 + p * 22;
          return <div key={i} style={{position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: '50%', background: alpha(card, 0.7 * (1 - p)), filter: 'blur(2px)'}} />;
        })}
      </>
    );
  }
  if (kind === 'sparkle') {
    const pts = [
      [0.2, 0.62],
      [0.78, 0.3],
      [0.62, 0.72],
      [0.3, 0.16],
      [0.9, 0.78],
    ];
    return (
      <>
        {pts.map(([px, py], i) => {
          const s = 0.5 + 0.5 * Math.sin((t / 1.2) * Math.PI * 2 + i * 1.3);
          const size = 18 + 14 * s;
          return (
            <svg key={i} width={size} height={size} viewBox="-10 -10 20 20" style={{position: 'absolute', left: w * px - size / 2, top: h * py - size / 2, opacity: 0.3 + 0.7 * s, overflow: 'visible'}}>
              <path d="M0 -10 L2.8 -2.8 L10 0 L2.8 2.8 L0 10 L-2.8 2.8 L-10 0 L-2.8 -2.8 Z" fill={card} stroke={alpha(ink, 0.35)} strokeWidth={0.8} />
            </svg>
          );
        })}
      </>
    );
  }
  if (kind === 'rays') {
    // 文旅：斜向光带缓慢扫过 + 几片漂浮的叶/光点
    return (
      <>
        {[0, 1, 2].map((i) => {
          const p = (t / 4 + i / 3) % 1;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: -h * 0.3,
                height: h * 1.6,
                left: -w * 0.3 + p * w * 1.4,
                width: 26 + i * 18,
                transform: 'rotate(-24deg)',
                background: alpha(card, 0.16),
              }}
            />
          );
        })}
        {Array.from({length: 5}, (_, i) => {
          const p = (t / 3 + i / 5) % 1;
          const x = w * (0.1 + 0.2 * i) + Math.sin(p * Math.PI * 2) * 20;
          const y = h * 0.15 + p * h * 0.6;
          return <div key={`l${i}`} style={{position: 'absolute', left: x, top: y, width: 16, height: 9, borderRadius: '50%', background: alpha(card, 0.75), transform: `rotate(${(p * 360 + i * 40).toFixed(0)}deg)`, opacity: Math.sin(p * Math.PI)}} />;
        })}
      </>
    );
  }
  // bits：教育/通用，小方块和加号缓慢上浮
  return (
    <>
      {Array.from({length: 6}, (_, i) => {
        const p = (t / 3 + i / 6) % 1;
        const x = w * (0.08 + 0.16 * i);
        const y = h * 0.9 - p * h * 0.7;
        const s = 12 + (i % 3) * 5;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: s,
              height: s,
              borderRadius: i % 2 ? 3 : s,
              border: `3px solid ${alpha(card, 0.8)}`,
              opacity: Math.sin(p * Math.PI),
              transform: `rotate(${(p * 180).toFixed(0)}deg)`,
            }}
          />
        );
      })}
    </>
  );
};

export default IllustScene;
