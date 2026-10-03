import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {beatPulse, bump, clamp, float, pop} from '../core/anim';
import {emWidth, fitLine, glueBreaks} from '../core/fit';
import {FONT} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {Avatar, Card, IconDisc, Lang, Sweep, pick} from '../core/kit';
import {alpha, mixHex, textOnHot, toneColor, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';
import {Illust, isIllust} from '../illust';

// ============================================================
// hook：第 0 帧即封面。标题由全局字幕层画（第 1 镜字幕第 0 帧完整显示）。
// 这里画：标题旁的高光笔触、产品高亮胶囊（y 572–660）、主视觉（y 690–1340）。
// 第 0 帧所有元素都已在位；之后只有漂浮、扫光、卡拍脉冲这类「活着」的小动作。
//
// visual 分两类：bubble/stat/icon/illust/phone 按「内容类型」选（聊天消息/数字/图标/行业插画/截图）；
// split/statBar 是两种独立的「构图」变体（分屏对比 / 通栏数字条），用来让同一内容类型
// 的不同产品别撞脸。
//
// 2026-09 第三轮（评审「同一模板换皮」）：
//   - 不再有固定装饰：icon 不再画写死的六图标环绕（要环绕就用 params.orbit 自己选 3–6 个），
//     两侧漂浮小图标也不再按主题默认给（只画 params.deco 写了的）——默认装饰和产品无关，还让所有片子撞脸；
//   - stat 圆环：数字按环内直径自动缩字号（最小 64px，必要时在 → / 空格处拆两行）；
//     弧长 = params.pct 或 text 里的百分数，没有就不画弧（写死 78% 的弧没有意义）；text 里没有数字就不画环；
//   - statBar 同理：没给 level、text 里也没有百分数时不填条、不写「8/10」；
//   - 卡片按内容长高、在主视觉区里居中，不再写死 600px 高留大块空白。
// ============================================================
type P = {
  visual: 'bubble' | 'stat' | 'icon' | 'illust' | 'phone' | 'split' | 'statBar';
  text?: string;
  sub?: string;
  icon?: string;
  badge?: string;
  src?: string;
  tone?: 'bad' | 'warn' | 'good' | 'accent';
  deco?: string[];
  head?: string;
  /** split 专用：左侧（痛点侧）短语 */
  leftText?: string;
  /** statBar 专用：0–10，条形填充比例；不写且 text 里没有百分数时不填条 */
  level?: number;
  /** stat/statBar：数值占比 0–100，决定圆环弧长/条形长度；不写就从 text 里的「87%」取，都没有就不画弧 */
  pct?: number;
  /** icon 专用：环绕主图标的 3–6 个小图标（和产品有关的）；不写就不画环绕，主图标放大 + 卡拍脉冲圈 */
  orbit?: string[];
  /** illust 专用：行业插画 id（template/src/illust/names.json），如 "travel/window" */
  illust?: string;
};

const BADGE_TOP = 572;
const BADGE_H = 88;
const VIS_TOP = 690;
const VIS_BOT = 1330;

const ownDeco = (p: P) => (p.deco ?? []).filter((x) => isIcon(x));
const hasDigit = (s: string) => /[0-9０-９]/.test(s);
/** 数值占比：params.pct 优先，其次 text 里的「87%」；都没有返回 null（不画弧/不填条） */
const pctOf = (p: P): number | null => {
  if (typeof p.pct === 'number' && Number.isFinite(p.pct)) return Math.max(0, Math.min(100, p.pct));
  const m = /(\d+(?:\.\d+)?)\s*[%％]/.exec(p.text ?? '');
  return m ? Math.max(0, Math.min(100, parseFloat(m[1]))) : null;
};

// 标题旁的高光笔触
const Stroke: React.FC<{x: number; y: number; len: number; rot: number; color: string}> = ({x, y, len, rot, color}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: len,
      height: 12,
      borderRadius: 6,
      background: color,
      transform: `rotate(${rot}deg)`,
      transformOrigin: '0 50%',
      boxShadow: '0 2px 0 rgba(0,0,0,0.18)',
    }}
  />
);

// 产品高亮胶囊：白→强调黄渐变 + 左侧 logo/图标 + 扫光
const Badge: React.FC<{text: string; t: number; logo?: string; icon?: string}> = ({text, t, logo, icon}) => {
  const th = useTheme();
  const ink = textOnHot(th);
  const darkInk = ink.toLowerCase() !== '#ffffff';
  const size = fitLine(text, 560, 48, 36);
  const w = Math.round(size * (text.length * 0.92) + 150);
  const sweep = interpolate(t, [0.4, 1.1], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: BADGE_TOP, display: 'flex', justifyContent: 'center'}}>
      <div style={{position: 'relative'}}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            height: BADGE_H,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            padding: '0 40px 0 112px',
            borderRadius: BADGE_H / 2,
            background: darkInk ? `linear-gradient(90deg, #ffffff 0%, ${mixHex(th.hot, '#ffffff', 0.6)} 45%, ${th.hot} 100%)` : th.hot,
            border: '4px solid #ffffff',
            boxShadow: '0 12px 26px rgba(0,0,0,0.22)',
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: size,
            color: ink,
            whiteSpace: 'nowrap',
          }}
        >
          {text}
          <Sweep p={sweep} w={w} />
        </div>
        <div style={{position: 'absolute', left: -6, top: -10, width: 108, height: 108, transform: `translateY(${float(t, 0.8, 5)}px)`}}>
          {logo ? (
            <Img src={staticFile(logo)} style={{width: 108, height: 108, objectFit: 'contain'}} />
          ) : (
            <IconDisc name={icon && isIcon(icon) ? icon : 'sparkle'} size={108} style={{border: '5px solid #ffffff'}} />
          )}
        </div>
      </div>
    </div>
  );
};

// 两侧漂浮的小图标圆片（装饰，在关键区外）。只画 params.deco 写了的（不再按主题给默认图标）
const Floaty: React.FC<{x: number; y: number; icon: string; size: number; t: number; ph: number; rot: number}> = ({x, y, icon, size, t, ph, rot}) => {
  const th = useTheme();
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + float(t, ph, 10),
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: th.card,
        boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${rot}deg)`,
        opacity: 0.95,
      }}
    >
      <Icon name={icon} size={size * 0.5} color={th.accentInk} stroke={2.4} />
    </div>
  );
};
const Floaties: React.FC<{p: P; t: number; spots: [number, number, number, number][]}> = ({p, t, spots}) => (
  <>
    {ownDeco(p)
      .slice(0, spots.length)
      .map((ic, i) => (
        <Floaty key={i} x={spots[i][0]} y={spots[i][1]} icon={ic} size={spots[i][2]} t={t} ph={i * 1.7} rot={spots[i][3]} />
      ))}
  </>
);

// 卡拍脉冲圈：每拍从主体边缘扩一圈
const BeatRings: React.FC<{cx: number; cy: number; r: number; t: number; beat: number; color: string}> = ({cx, cy, r, t, beat, color}) => (
  <>
    {[0, 1].map((k) => {
      const ph = ((t + k * beat) % (2 * beat)) / (2 * beat);
      return (
        <div
          key={k}
          style={{
            position: 'absolute',
            left: cx - r,
            top: cy - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            border: `6px solid ${color}`,
            transform: `scale(${1 + ph * 0.42})`,
            opacity: (1 - ph) * 0.75,
          }}
        />
      );
    })}
  </>
);

// 主视觉下方的一行字（icon / illust 用）
const Label: React.FC<{text: string; top: number}> = ({text, top}) => (
  <div style={{position: 'absolute', left: 150, width: 780, top, display: 'flex', justifyContent: 'center'}}>
    <Card style={{padding: '14px 40px', fontSize: fitLine(text, 700, 48, 36), fontWeight: 900, whiteSpace: 'nowrap'}} radius={50}>
      {text}
    </Card>
  </div>
);

// ---------- 主视觉：扎心消息 + 警示卡（卡片按内容长高，在主视觉区里居中） ----------
const BubbleVisual: React.FC<{p: P; t: number; lang: Lang}> = ({p, t, lang}) => {
  const th = useTheme();
  const head = p.head ?? pick(lang, '新消息 · 刚刚', 'New message · now');
  const toneBase = toneColor(th, p.tone ?? 'bad');
  const toneInk = p.tone === 'accent' ? th.accentInk : toneBase;
  const toneFill = p.tone === 'accent' ? th.accentFill : toneBase;
  const pulse = (t % 1.2) / 1.2;
  const hit = bump(t, 1.0, 0.5);
  const text = p.text ?? '';
  const bubbleSize = fitLine(text, 1200, 56, 44) >= 52 ? 56 : 48;
  const shine = (t % 1.6) / 1.6;
  return (
    <>
      <Floaties p={p} t={t} spots={[[36, 820, 112, -10], [934, 900, 104, 12], [46, 1150, 92, 8]]} />
      <div style={{position: 'absolute', left: 150, width: 780, top: VIS_TOP, height: VIS_BOT - VIS_TOP, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <Card style={{width: 780, padding: '26px 30px 30px', display: 'flex', flexDirection: 'column'}} radius={40}>
          {head ? (
            <div style={{display: 'flex', alignItems: 'center', gap: 14, height: 48, color: th.cardMuted, fontSize: 30, fontWeight: 600}}>
              <Icon name="chat" size={34} color={th.cardMuted} />
              {head}
            </div>
          ) : null}
          <div style={{marginTop: head ? 20 : 6, display: 'flex', alignItems: 'flex-start', gap: 16}}>
            <Avatar size={76} />
            <div
              style={{
                maxWidth: 560,
                background: th.bubbleOther,
                color: th.bubbleOtherText,
                fontSize: bubbleSize,
                lineHeight: 1.3,
                fontWeight: 600,
                padding: '16px 28px',
                borderRadius: 34,
                borderTopLeftRadius: 10,
                wordBreak: 'normal',
                overflowWrap: 'normal',
              }}
            >
              {glueBreaks(text, lang)}
            </div>
          </div>
          {p.sub && (
            <div
              style={{
                marginTop: 30,
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '22px 26px',
                borderRadius: 30,
                background: alpha(toneFill, th.dark ? 0.18 : 0.1),
                border: `3px solid ${alpha(toneInk, 0.35)}`,
                transform: `scale(${1 + hit * 0.06})`,
              }}
            >
              <div style={{position: 'relative', width: 92, height: 92, flex: 'none'}}>
                <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `5px solid ${toneInk}`, transform: `scale(${1 + pulse * 0.7})`, opacity: 1 - pulse}} />
                <IconDisc name={isIcon(p.icon) ? p.icon : 'alert'} size={92} tone={p.tone === 'accent' ? 'accent' : (p.tone ?? 'bad')} />
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: 46, fontWeight: 900, color: toneInk, lineHeight: 1.15}}>{p.sub}</div>
                {/* 一条连续的警示光带（不再是 9 格里亮 8 格——那像一个没有定义的「8/9」分数） */}
                <div style={{position: 'relative', overflow: 'hidden', marginTop: 14, height: 16, borderRadius: 8, background: `linear-gradient(90deg, ${alpha(toneFill, 0.25)}, ${toneFill})`}}>
                  <div style={{position: 'absolute', top: 0, bottom: 0, left: `${shine * 130 - 30}%`, width: '24%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.7), rgba(255,255,255,0))'}} />
                </div>
              </div>
            </div>
          )}
          <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 30}}>
            <div
              style={{
                flex: 1,
                height: 84,
                boxSizing: 'border-box',
                borderRadius: 42,
                background: th.cardAlt,
                border: `2px solid ${th.line}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 28px',
                gap: 12,
              }}
            >
              <div style={{width: 4, height: 40, background: th.accentFill, borderRadius: 2, opacity: Math.floor(t * 2) % 2 === 0 ? 1 : 0}} />
              <span style={{fontSize: 34, color: th.cardMuted}}>{pick(lang, '输入你的回复…', 'Type your reply…')}</span>
            </div>
            <div style={{width: 84, height: 84, borderRadius: 42, background: th.accentFill, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Icon name="send" size={40} color={th.accentText} stroke={2.4} />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};

// 大数字拆行：一行放不下时在 → / ~ / 空格 处拆成两行（选最靠中间的断点）
const splitStat = (text: string): string[] => {
  const cps = Array.from(text);
  let best = -1;
  let bestD = Infinity;
  cps.forEach((c, i) => {
    if (i === 0 || i === cps.length - 1) return;
    if (!/[→~～/\s-]/.test(c)) return;
    const d = Math.abs(i - cps.length / 2);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best < 0) return [text];
  const c = cps[best];
  const keep = /\s/.test(c) ? '' : c; // 箭头/波浪号留在第一行末尾
  return [(cps.slice(0, best).join('') + keep).trim(), cps.slice(best + 1).join('').trim()].filter(Boolean);
};

// ---------- 主视觉：大数字圆环（弧长 = 数值占比；没有占比就不画弧；没有数字就不用环） ----------
const RING_R = 236;
const RING_W = 30;
/** 环内能放字的宽度（内径 ≈ 2×(236−15) = 442，两侧留边） */
const RING_TEXT_W = 400;
const STAT_MIN = 64;

const StatVisual: React.FC<{p: P; t: number; beat: number}> = ({p, t, beat}) => {
  const th = useTheme();
  const onAccent = p.tone === 'accent' || !p.tone;
  const toneFill = onAccent ? th.accentFill : toneColor(th, p.tone);
  const toneInk = onAccent ? th.accentInk : toneColor(th, p.tone);
  const text = p.text ?? '';
  if (!hasDigit(text)) return <WordVisual p={p} t={t} beat={beat} />;
  // 一行放得下（≥64px）就一行，否则拆两行
  const one = Math.floor(RING_TEXT_W / Math.max(0.01, emWidth(text)));
  const lines = one >= STAT_MIN ? [text] : splitStat(text);
  const size = Math.max(STAT_MIN - 8, Math.min(lines.length > 1 ? 120 : 180, Math.floor((lines.length > 1 ? RING_TEXT_W - 30 : RING_TEXT_W) / Math.max(0.01, ...lines.map(emWidth)))));
  const subSize = p.sub ? fitLine(p.sub, 330, 44, 30) : 0;
  const numH = lines.length * size * 1.08;
  const blockH = numH + (p.sub ? 14 + subSize * 1.25 : 0);
  const numTop = 300 - blockH / 2;
  const pct = pctOf(p);
  const C = 2 * Math.PI * RING_R;
  const bb = beatPulse(t, beat);
  const cx = 300;
  const cy = 300;
  const endA = pct === null ? 0 : ((pct / 100) * 360 - 90) * (Math.PI / 180);
  return (
    <>
      <Floaties p={p} t={t} spots={[[40, 800, 104, -10], [936, 1120, 104, 10]]} />
      <div style={{position: 'absolute', left: 540 - 300, top: VIS_TOP + 20, width: 600, height: 600}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: th.card, boxShadow: th.shadow}} />
        {pct === null && <BeatRings cx={300} cy={300} r={RING_R + RING_W / 2} t={t} beat={beat} color={alpha(toneFill, 0.5)} />}
        <svg width={600} height={600} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <circle cx={cx} cy={cy} r={RING_R} stroke={alpha(toneFill, 0.15)} strokeWidth={RING_W} fill="none" />
          {pct !== null && pct > 0 && (
            <>
              <circle
                cx={cx}
                cy={cy}
                r={RING_R}
                stroke={toneFill}
                strokeWidth={RING_W}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(C * pct) / 100} ${C}`}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
              <circle cx={cx + Math.cos(endA) * RING_R} cy={cy + Math.sin(endA) * RING_R} r={RING_W * (0.62 + 0.25 * bb)} fill={toneFill} stroke="#ffffff" strokeWidth={6} />
            </>
          )}
        </svg>
        <div style={{position: 'absolute', left: 0, right: 0, top: numTop, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: toneInk, whiteSpace: 'nowrap', transform: `scale(${1 + bb * 0.025})`}}>
          {lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
        {p.sub && (
          <div style={{position: 'absolute', left: 135, right: 135, top: numTop + numH + 14, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: subSize, lineHeight: 1.25, color: th.cardSub, whiteSpace: 'nowrap'}}>
            {p.sub}
          </div>
        )}
      </div>
    </>
  );
};

// ---------- stat 的文字兜底：text 里没有数字时不套圆环，改成一张贴纸式大字卡（按内容长高） ----------
const WordVisual: React.FC<{p: P; t: number; beat: number}> = ({p, t, beat}) => {
  const th = useTheme();
  const tone = p.tone === 'accent' || !p.tone ? th.accentInk : toneColor(th, p.tone);
  const text = p.text ?? '';
  const size = fitLine(text, 640, 150, 64);
  const bb = beatPulse(t, beat);
  const under = interpolate(t, [0, 0.4], [0.35, 1], clamp);
  return (
    <>
      <Floaties p={p} t={t} spots={[[40, 800, 104, -10], [936, 1120, 104, 10]]} />
      <div style={{position: 'absolute', left: 150, width: 780, top: VIS_TOP, height: VIS_BOT - VIS_TOP, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
        <Card style={{padding: '44px 56px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `rotate(-2deg) scale(${1 + bb * 0.02})`}} radius={44}>
          <div style={{position: 'relative', fontSize: size, fontWeight: 900, lineHeight: 1.1, color: tone, whiteSpace: 'nowrap'}}>
            <div style={{position: 'absolute', left: -10, right: -10, bottom: size * 0.04, height: size * 0.28, borderRadius: size * 0.1, background: alpha(th.hot, 0.75), transform: `scaleX(${under})`, transformOrigin: '0 50%'}} />
            <span style={{position: 'relative'}}>{text}</span>
          </div>
          {p.sub && <div style={{marginTop: 22, fontSize: fitLine(p.sub, 600, 44, 34), fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap'}}>{p.sub}</div>}
        </Card>
      </div>
    </>
  );
};

// ---------- 主视觉：大图标（环绕小图标由 params.orbit 决定；不写就不环绕，主图标放大 + 卡拍脉冲圈） ----------
const IconVisual: React.FC<{p: P; t: number; beat: number}> = ({p, t, beat}) => {
  const th = useTheme();
  const orbit = (p.orbit ?? []).filter((x) => isIcon(x)).slice(0, 6);
  const withOrbit = orbit.length >= 3;
  const tone = p.tone ?? 'accent';
  const toneC = toneColor(th, tone);
  const bb = beatPulse(t, beat);
  const D = withOrbit ? 300 : 380;
  const cx = 540;
  const cy = withOrbit ? VIS_TOP + 290 : p.text ? VIS_TOP + 250 : VIS_TOP + 310;
  const rot = t * 12;
  const ringBase = th.card.startsWith('#') ? th.card : '#ffffff';
  return (
    <>
      <Floaties p={p} t={t} spots={[[40, 800, 100, -10], [940, 1160, 100, 10]]} />
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: cx - D / 2 - 50 - i * 60,
            top: cy - D / 2 - 50 - i * 60,
            width: D + 100 + i * 120,
            height: D + 100 + i * 120,
            borderRadius: '50%',
            border: `3px solid ${alpha(ringBase, 0.32 - i * 0.1)}`,
          }}
        />
      ))}
      <BeatRings cx={cx} cy={cy} r={D / 2 + 8} t={t} beat={beat} color={alpha(toneC, 0.7)} />
      <IconDisc
        name={isIcon(p.icon) ? p.icon : 'sparkle'}
        size={D}
        tone={tone}
        style={{position: 'absolute', left: cx - D / 2, top: cy - D / 2, border: '8px solid #ffffff', transform: `translateY(${float(t, 0, 6)}px) scale(${1 + bb * 0.035})`}}
      />
      {withOrbit &&
        orbit.map((ic, i) => {
          const a = ((i / orbit.length) * 360 + rot) * (Math.PI / 180);
          const r = 262;
          const s = 96;
          return (
            <div
              key={`${ic}-${i}`}
              style={{
                position: 'absolute',
                left: cx + Math.cos(a) * r - s / 2,
                top: cy + Math.sin(a) * r * 0.92 - s / 2,
                width: s,
                height: s,
                borderRadius: 28,
                background: th.card,
                boxShadow: '0 12px 26px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={ic} size={50} color={th.accentInk} stroke={2.4} />
            </div>
          );
        })}
      {p.text && <Label text={p.text} top={withOrbit ? 1236 : Math.min(1236, cy + D / 2 + 70)} />}
    </>
  );
};

// ---------- 主视觉：行业插画（画面说的是一样东西/一处场景时用，比套数字环贴题） ----------
const IllustVisual: React.FC<{p: P; t: number; beat: number}> = ({p, t, beat}) => {
  const th = useTheme();
  const bb = beatPulse(t, beat);
  const cx = 540;
  const cy = p.text ? VIS_TOP + 275 : VIS_TOP + 310;
  const D = 500;
  const toneC = toneColor(th, p.tone ?? 'accent');
  return (
    <>
      <Floaties p={p} t={t} spots={[[40, 800, 100, -10], [940, 1160, 100, 10]]} />
      <div style={{position: 'absolute', left: cx - D / 2, top: cy - D / 2, width: D, height: D, borderRadius: '50%', background: `radial-gradient(circle at 50% 42%, ${th.card} 0%, ${th.card} 58%, ${alpha(th.card.startsWith('#') ? th.card : '#ffffff', 0.55)} 100%)`, boxShadow: th.shadow}} />
      <BeatRings cx={cx} cy={cy} r={D / 2} t={t} beat={beat} color={alpha(toneC, 0.55)} />
      <div style={{position: 'absolute', left: cx - 140, top: cy + D * 0.3, width: 280, height: 36, borderRadius: '50%', background: alpha('#000000', 0.12), transform: `scaleX(${1 - bb * 0.08})`}} />
      <div style={{position: 'absolute', left: cx - 220, top: cy - 230 + float(t, 0, 8) - bb * 6, width: 440, height: 440}}>
        <Illust name={p.illust as string} size={440} animate t={t} />
      </div>
      {p.text && <Label text={p.text} top={Math.min(1236, cy + D / 2 + 40)} />}
    </>
  );
};

// ---------- 主视觉：手机真截图 ----------
const PhoneVisual: React.FC<{p: P; t: number}> = ({p, t}) => {
  const th = useTheme();
  const tone = toneColor(th, p.tone ?? 'bad');
  const X = 270;
  const PW = 540;
  return (
    <>
      <Floaties p={p} t={t} spots={[[60, 880, 104, -10]]} />
      <div style={{position: 'absolute', left: X, top: VIS_TOP, width: PW, height: 1300}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 72,
            background: 'linear-gradient(135deg, #ffffff 0%, #eef0f4 30%, #cfd2da 70%, #b9bdc8 100%)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.30), inset 0 3px 0 #ffffff',
          }}
        />
        <div style={{position: 'absolute', left: 14, top: 14, right: 14, bottom: 14, borderRadius: 60, overflow: 'hidden', background: '#ffffff', boxShadow: 'inset 0 0 0 3px #2a2b33'}}>
          {p.src && <Img src={staticFile(p.src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%'}} />}
        </div>
        <div style={{position: 'absolute', left: PW / 2 - 80, top: 14, width: 160, height: 26, borderRadius: '0 0 16px 16px', background: '#1c1d22'}} />
      </div>
      {p.text && (
        <div
          style={{
            position: 'absolute',
            right: 1080 - 900,
            top: VIS_TOP + 60 + float(t, 1, 6),
            transform: 'rotate(6deg)',
            background: tone,
            color: '#ffffff',
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: fitLine(p.text, 420, 44, 34),
            padding: '14px 28px',
            borderRadius: 24,
            boxShadow: `0 14px 30px ${alpha(tone, 0.4)}`,
            border: '4px solid #ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          {p.text}
        </div>
      )}
    </>
  );
};

// ---------- 主视觉：左右分屏（痛点 vs 产品，中间一支箭头）；面板高度按内容，在主视觉区里居中 ----------
const SplitVisual: React.FC<{p: P; t: number; lang: Lang; beat: number}> = ({p, t, lang, beat}) => {
  const th = useTheme();
  const badTone = toneColor(th, 'bad');
  const rightFill = p.tone === 'warn' ? toneColor(th, p.tone) : th.accentFill;
  const rightInk = p.tone === 'warn' ? toneColor(th, p.tone) : th.accentInk;
  const leftIcon = isIcon(p.deco?.[0] ?? '') ? (p.deco as string[])[0] : 'x';
  const rightIcon = isIcon(p.icon) ? p.icon : 'check';
  const h = 460;
  const subH = p.sub ? 70 : 0;
  const y0 = Math.round(VIS_TOP + (VIS_BOT - VIS_TOP - h - subH) / 2);
  const y1 = y0 + h;
  const leftText = p.leftText ?? '';
  const rightText = p.text ?? '';
  const grow = Math.min(1, t / 0.3);
  const bb = beatPulse(t, beat);
  return (
    <>
      <div style={{position: 'absolute', left: 150, top: y0, width: 780, height: h, borderRadius: 40, overflow: 'hidden', boxShadow: th.shadow}}>
        <div style={{position: 'absolute', inset: 0, display: 'flex'}}>
          <div style={{flex: 1, background: mixHex(th.card.startsWith('#') ? th.card : '#ffffff', badTone, th.dark ? 0.24 : 0.14), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
            <IconDisc name={leftIcon} size={132} tone="bad" style={{transform: `translateY(${float(t, 0, 6)}px)`}} />
            {leftText && (
              <div style={{fontSize: fitLine(leftText, 300, 44, 30), fontWeight: 800, color: badTone, textAlign: 'center', maxWidth: 300, whiteSpace: 'nowrap'}}>
                {leftText}
              </div>
            )}
          </div>
          <div style={{flex: 1, background: mixHex(th.card.startsWith('#') ? th.card : '#ffffff', rightFill, th.dark ? 0.24 : 0.12), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
            <IconDisc name={rightIcon} size={132} tone={p.tone === 'warn' ? 'warn' : 'accent'} style={{transform: `translateY(${float(t, 1.4, 6)}px) scale(${1 + bb * 0.04})`}} />
            {rightText && (
              <div style={{fontSize: fitLine(rightText, 300, 44, 30), fontWeight: 800, color: rightInk, textAlign: 'center', maxWidth: 300, whiteSpace: 'nowrap'}}>
                {rightText}
              </div>
            )}
          </div>
        </div>
        <div style={{position: 'absolute', left: '50%', top: 0, bottom: 0, width: 6, marginLeft: -3, background: th.onBg, opacity: 0.9, transform: `scaleY(${grow})`, transformOrigin: '50% 50%'}} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 540 - 52,
          top: y0 + h / 2 - 52,
          width: 104,
          height: 104,
          borderRadius: 52,
          background: th.hot,
          border: '6px solid #ffffff',
          boxShadow: '0 10px 26px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${0.7 + 0.3 * pop(t, 0.05, 14, 170) + bb * 0.05})`,
        }}
      >
        <Icon name="arrow" size={54} color={textOnHot(th)} stroke={3} />
      </div>
      {p.sub && (
        <div style={{position: 'absolute', left: 150, width: 780, top: y1 + 22, textAlign: 'center', fontSize: fitLine(p.sub, 700, 40, 30), fontWeight: 700, color: th.onBgSub, whiteSpace: 'nowrap'}}>
          {glueBreaks(p.sub, lang)}
        </div>
      )}
    </>
  );
};

// ---------- 主视觉：通栏数字条（大数字 + 一整条刻度/进度条，数据/效率类专用构图） ----------
// 条的长度只来自有含义的数：params.level（0–10）或 pct / text 里的百分数；都没有就只画刻度槽 + 一道扫光，不写「x/10」
const StatBarVisual: React.FC<{p: P; t: number; beat: number}> = ({p, t, beat}) => {
  const th = useTheme();
  const tone = p.tone === 'accent' || !p.tone ? th.accent : toneColor(th, p.tone);
  const text = p.text ?? '';
  const size = fitLine(text, 780, 148, STAT_MIN);
  const pct = pctOf(p);
  const level = typeof p.level === 'number' && Number.isFinite(p.level) ? Math.max(0, Math.min(10, p.level)) : pct !== null ? pct / 10 : null;
  const fillP = Math.min(1, t / 0.5);
  const barW = 780;
  const barH = 100;
  const subH = p.sub ? 34 * 1.3 + 14 : 0;
  const groupH = size * 1.05 + subH + 60 + barH + 60;
  const top0 = Math.round(VIS_TOP + Math.max(0, (VIS_BOT - VIS_TOP - groupH) / 2));
  const barY = Math.round(top0 + size * 1.05 + subH + 60);
  const pulse = bump(t, 0.5, 0.4) + beatPulse(t, beat) * 0.5;
  const shine = (t % 1.5) / 1.5;
  return (
    <>
      <Floaties p={p} t={t} spots={[[36, 800, 100, -10], [940, 1160, 100, 10]]} />
      <div style={{position: 'absolute', left: 150, top: top0, width: 780, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.05, color: tone, whiteSpace: 'nowrap'}}>
        {text}
      </div>
      {p.sub && (
        <div style={{position: 'absolute', left: 150, top: top0 + size * 1.05 + 14, width: 780, textAlign: 'center', fontSize: 34, fontWeight: 700, color: th.onBgSub, whiteSpace: 'nowrap'}}>
          {p.sub}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: (1080 - barW) / 2,
          top: barY,
          width: barW,
          height: barH,
          borderRadius: barH / 2,
          background: alpha('#ffffff', th.dark ? 0.14 : 0.3),
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.35)',
        }}
      >
        {level !== null ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${(level / 10) * fillP * 100}%`,
              borderRadius: barH / 2,
              background: `linear-gradient(90deg, ${mixHex(tone, '#ffffff', 0.25)}, ${tone})`,
              boxShadow: `0 0 18px ${alpha(tone, 0.5)}`,
              transform: `scaleY(${1 + pulse * 0.06})`,
              transformOrigin: '0% 50%',
            }}
          />
        ) : (
          <>
            {Array.from({length: 9}, (_, i) => (
              <div key={i} style={{position: 'absolute', left: `${(i + 1) * 10}%`, top: 26, bottom: 26, width: 4, marginLeft: -2, borderRadius: 2, background: alpha('#ffffff', 0.45)}} />
            ))}
            <div style={{position: 'absolute', top: 0, bottom: 0, left: `${shine * 130 - 30}%`, width: '22%', background: `linear-gradient(90deg, ${alpha(tone, 0)}, ${alpha(tone, 0.7)}, ${alpha(tone, 0)})`}} />
          </>
        )}
      </div>
      {typeof p.level === 'number' && (
        <div style={{position: 'absolute', left: (1080 - barW) / 2, top: barY + barH + 18, width: barW, display: 'flex', justifyContent: 'space-between', fontFamily: FONT, fontSize: 30, fontWeight: 700, color: th.onBgSub}}>
          <span>0</span>
          <span>{Math.round(p.level)}/10</span>
        </div>
      )}
    </>
  );
};

const Hook: React.FC<ShotProps<P>> = ({params: p, t, beat, meta}) => {
  const th = useTheme();
  const lang: Lang = meta?.lang === 'en' ? 'en' : 'zh';
  const b = beat || 0.5;
  // illust 没给合法插画 id 时退回 icon 构图（校验会另外报错）
  const visual = p.visual === 'illust' && !isIllust(p.illust) ? 'icon' : p.visual;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <Stroke x={194} y={266} len={44} rot={40} color={th.hot} />
      <Stroke x={172} y={306} len={32} rot={8} color={th.hot} />
      <Stroke x={846} y={292} len={44} rot={-40} color={th.hot} />
      <Stroke x={852} y={326} len={32} rot={-8} color={th.hot} />
      {visual === 'stat' ? (
        <StatVisual p={p} t={t} beat={b} />
      ) : visual === 'icon' ? (
        <IconVisual p={p} t={t} beat={b} />
      ) : visual === 'illust' ? (
        <IllustVisual p={p} t={t} beat={b} />
      ) : visual === 'phone' ? (
        <PhoneVisual p={p} t={t} />
      ) : visual === 'split' ? (
        <SplitVisual p={p} t={t} lang={lang} beat={b} />
      ) : visual === 'statBar' ? (
        <StatBarVisual p={p} t={t} beat={b} />
      ) : (
        <BubbleVisual p={p} t={t} lang={lang} />
      )}
      {/* 胶囊左侧：有 logo 用 logo；split 用产品侧图标；其余用 sparkle */}
      {p.badge && <Badge text={p.badge} t={t} logo={meta?.logo} icon={visual === 'split' ? p.icon : undefined} />}
    </div>
  );
};

export default Hook;

export const sfx = (p: P): SfxCue[] => [
  {at: 0.05, kind: 'pop', vol: 0.34},
  ...(p.visual === 'bubble' && p.sub ? [{at: 1.0, kind: 'thud', vol: 0.3}] : []),
  ...(p.badge ? [{at: 0.45, kind: 'swish', vol: 0.18}] : []),
];
