import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {bump, clamp, float, pop} from '../core/anim';
import {fitLine, glueBreaks} from '../core/fit';
import {FONT} from '../core/font';
import {Icon, isIcon} from '../core/icons';
import {Avatar, Card, IconDisc, Lang, Sweep, pick} from '../core/kit';
import {alpha, mixHex, toneColor, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// hook：第 0 帧即封面。标题由全局字幕层画（第 1 镜字幕第 0 帧完整显示）。
// 这里画：标题旁的高光笔触、产品高亮胶囊（y 572–660）、主视觉（y 690–1340）。
// 第 0 帧所有元素都已在位；之后只有漂浮、扫光、脉冲这类「活着」的小动作。
//
// visual 分两类：bubble/stat/icon/phone 按「内容类型」选（聊天消息/数字/图标/截图）；
// split/statBar 是两种独立的「构图」变体（分屏对比 / 通栏数字条），用来让同一内容类型
// 的不同产品别撞脸——例如同样是效率类卖点，这次用 statBar，下次可以选 stat 的圆环。
// ============================================================
type P = {
  visual: 'bubble' | 'stat' | 'icon' | 'phone' | 'split' | 'statBar';
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
  /** statBar 专用：0–10，条形填充比例，默认 8 */
  level?: number;
};

// 两侧漂浮小图标：跟着主题走（数据产品不该飘爱心和铃铛）；params.deco 可以覆盖
const DECO: Record<string, string[]> = {
  'warm-emotion': ['chat', 'heart', 'bell'],
  'tech-dark': ['code', 'bolt', 'cloud'],
  'fresh-light': ['star', 'heart', 'check'],
  'business-blue': ['chart', 'clock', 'doc'],
  'festival-red': ['gift', 'star', 'bell'],
  'mono-premium': ['star', 'sparkle', 'eye'],
};
const decoOf = (p: P, theme: string) => {
  const base = DECO[theme] ?? DECO['warm-emotion'];
  const own = (p.deco ?? []).filter((x) => isIcon(x));
  return [0, 1, 2].map((i) => own[i] ?? base[i]);
};

const BADGE_TOP = 572;
const BADGE_H = 88;
const VIS_TOP = 690;

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
const Badge: React.FC<{text: string; t: number; logo?: string}> = ({text, t, logo}) => {
  const th = useTheme();
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
            background: `linear-gradient(90deg, #ffffff 0%, ${mixHex(th.hot, '#ffffff', 0.6)} 45%, ${th.hot} 100%)`,
            border: '4px solid #ffffff',
            boxShadow: '0 12px 26px rgba(0,0,0,0.22)',
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: size,
            color: '#1b1a18',
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
            <IconDisc name="sparkle" size={108} style={{border: '5px solid #ffffff'}} />
          )}
        </div>
      </div>
    </div>
  );
};

// 两侧漂浮的小图标圆片（装饰，在关键区外）
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
      <Icon name={icon} size={size * 0.5} color={th.accent} stroke={2.4} />
    </div>
  );
};

// ---------- 主视觉：扎心消息 + 警示卡 ----------
const BubbleVisual: React.FC<{p: P; t: number; lang: Lang}> = ({p, t, lang}) => {
  const th = useTheme();
  const deco = decoOf(p, th.name);
  const head = p.head ?? pick(lang, '新消息 · 刚刚', 'New message · now');
  const tone = toneColor(th, p.tone ?? 'bad');
  const pulse = (t % 1.2) / 1.2;
  const hit = bump(t, 1.0, 0.5);
  const text = p.text ?? '';
  const bubbleSize = fitLine(text, 1200, 56, 44) >= 52 ? 56 : 48;
  return (
    <>
      <Floaty x={36} y={820} icon={deco[0]} size={112} t={t} ph={0} rot={-10} />
      <Floaty x={934} y={900} icon={deco[1]} size={104} t={t} ph={Math.PI} rot={12} />
      <Floaty x={46} y={1150} icon={deco[2]} size={92} t={t} ph={1.7} rot={8} />
      <Card style={{position: 'absolute', left: 150, top: VIS_TOP, width: 780, height: 600, padding: '26px 30px', display: 'flex', flexDirection: 'column'}} radius={40}>
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
              background: alpha(tone, th.dark ? 0.18 : 0.1),
              border: `3px solid ${alpha(tone, 0.35)}`,
              transform: `scale(${1 + hit * 0.06})`,
            }}
          >
            <div style={{position: 'relative', width: 92, height: 92, flex: 'none'}}>
              <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `5px solid ${tone}`, transform: `scale(${1 + pulse * 0.7})`, opacity: 1 - pulse}} />
              <IconDisc name={isIcon(p.icon) ? p.icon : 'alert'} size={92} tone={p.tone === 'accent' ? 'accent' : (p.tone ?? 'bad')} />
            </div>
            <div style={{flex: 1}}>
              <div style={{fontSize: 46, fontWeight: 900, color: tone, lineHeight: 1.15}}>{p.sub}</div>
              <div style={{display: 'flex', gap: 8, marginTop: 14}}>
                {Array.from({length: 9}).map((_, i) => (
                  <div key={i} style={{width: 44, height: 16, borderRadius: 8, background: tone, opacity: i < 8 ? 0.35 + i * 0.08 : 0.15}} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{flex: 1}} />
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
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
            <div style={{width: 4, height: 40, background: th.accent, borderRadius: 2, opacity: Math.floor(t * 2) % 2 === 0 ? 1 : 0}} />
            <span style={{fontSize: 34, color: th.cardMuted}}>{pick(lang, '输入你的回复…', 'Type your reply…')}</span>
          </div>
          <div style={{width: 84, height: 84, borderRadius: 42, background: th.accent, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Icon name="send" size={40} color={th.accentText} stroke={2.4} />
          </div>
        </div>
      </Card>
    </>
  );
};

// ---------- 主视觉：大数字 ----------
const StatVisual: React.FC<{p: P; t: number}> = ({p, t}) => {
  const th = useTheme();
  const deco = decoOf(p, th.name);
  const tone = p.tone === 'accent' || !p.tone ? th.accent : toneColor(th, p.tone);
  const text = p.text ?? '';
  const size = fitLine(text, 380, 190, 90);
  const R = 236;
  const C = 2 * Math.PI * R;
  const spin = t * 60;
  return (
    <>
      <Floaty x={40} y={800} icon={deco[0]} size={104} t={t} ph={0} rot={-10} />
      <Floaty x={936} y={1120} icon={deco[1]} size={104} t={t} ph={Math.PI} rot={10} />
      <div style={{position: 'absolute', left: 540 - 300, top: VIS_TOP + 20, width: 600, height: 600}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: th.card, boxShadow: th.shadow}} />
        <svg width={600} height={600} style={{position: 'absolute', left: 0, top: 0}}>
          <circle cx={300} cy={300} r={R} stroke={alpha(tone, 0.15)} strokeWidth={30} fill="none" />
          <circle
            cx={300}
            cy={300}
            r={R}
            stroke={tone}
            strokeWidth={30}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${C * 0.78} ${C}`}
            transform={`rotate(${-90 + spin * 0.15} 300 300)`}
          />
        </svg>
        <div style={{position: 'absolute', left: 0, right: 0, top: 300 - size * 0.62 - (p.sub ? 30 : 0), textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.2, color: tone, whiteSpace: 'nowrap'}}>
          {text}
        </div>
        {p.sub && (
          <div style={{position: 'absolute', left: 60, right: 60, top: 300 + size * 0.5 - 10, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 44, color: th.cardSub}}>
            {p.sub}
          </div>
        )}
      </div>
    </>
  );
};

// ---------- 主视觉：大图标 + 环绕小图标 ----------
const ORBIT = ['chat', 'clock', 'star', 'bolt', 'shield', 'heart'];
const IconVisual: React.FC<{p: P; t: number}> = ({p, t}) => {
  const th = useTheme();
  const cx = 540;
  const cy = VIS_TOP + 290;
  const pulse = (t % 1.5) / 1.5;
  const rot = t * 12;
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: cx - 180 - i * 55,
            top: cy - 180 - i * 55,
            width: 360 + i * 110,
            height: 360 + i * 110,
            borderRadius: '50%',
            border: `3px solid ${alpha(th.card.startsWith('#') ? th.card : '#ffffff', 0.35 - i * 0.08)}`,
          }}
        />
      ))}
      <div style={{position: 'absolute', left: cx - 170, top: cy - 170, width: 340, height: 340, borderRadius: '50%', border: `6px solid ${th.accent}`, transform: `scale(${1 + pulse * 0.4})`, opacity: 1 - pulse}} />
      <IconDisc name={isIcon(p.icon) ? p.icon : 'sparkle'} size={300} style={{position: 'absolute', left: cx - 150, top: cy - 150, border: '8px solid #ffffff', transform: `translateY(${float(t, 0, 6)}px)`}} />
      {ORBIT.map((ic, i) => {
        const a = ((i / ORBIT.length) * 360 + rot) * (Math.PI / 180);
        const r = 262;
        const s = 96;
        return (
          <div
            key={ic}
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
            <Icon name={ic} size={50} color={th.accent} stroke={2.4} />
          </div>
        );
      })}
      {p.text && (
        <div style={{position: 'absolute', left: 150, width: 780, top: 1236, display: 'flex', justifyContent: 'center'}}>
          <Card style={{padding: '14px 40px', fontSize: fitLine(p.text, 700, 48, 36), fontWeight: 900, whiteSpace: 'nowrap'}} radius={50}>
            {p.text}
          </Card>
        </div>
      )}
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
      <Floaty x={60} y={880} icon="search" size={104} t={t} ph={0} rot={-10} />
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

// ---------- 主视觉：左右分屏（痛点 vs 产品，中间一支箭头） ----------
const SplitVisual: React.FC<{p: P; t: number; lang: Lang}> = ({p, t, lang}) => {
  const th = useTheme();
  const badTone = toneColor(th, 'bad');
  const rightTone = p.tone === 'warn' || p.tone === 'accent' ? toneColor(th, p.tone) : th.accent;
  const leftIcon = isIcon(p.deco?.[0] ?? '') ? (p.deco as string[])[0] : 'x';
  const rightIcon = isIcon(p.icon) ? p.icon : 'check';
  const y0 = VIS_TOP;
  const y1 = 1320;
  const h = y1 - y0;
  const leftText = p.leftText ?? '';
  const rightText = p.text ?? '';
  const grow = Math.min(1, t / 0.3);
  return (
    <>
      <div style={{position: 'absolute', left: 150, top: y0, width: 780, height: h, borderRadius: 40, overflow: 'hidden', boxShadow: th.shadow}}>
        <div style={{position: 'absolute', inset: 0, display: 'flex'}}>
          <div style={{flex: 1, background: alpha(badTone, th.dark ? 0.24 : 0.14), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            <IconDisc name={leftIcon} size={104} tone="bad" style={{transform: `translateY(${float(t, 0, 6)}px)`}} />
            {leftText && (
              <div style={{fontSize: fitLine(leftText, 300, 40, 30), fontWeight: 800, color: badTone, textAlign: 'center', maxWidth: 300, whiteSpace: 'nowrap'}}>
                {leftText}
              </div>
            )}
          </div>
          <div style={{flex: 1, background: alpha(rightTone, th.dark ? 0.24 : 0.12), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            <IconDisc name={rightIcon} size={104} tone={p.tone === 'warn' ? 'warn' : 'accent'} style={{transform: `translateY(${float(t, 1.4, 6)}px)`}} />
            {rightText && (
              <div style={{fontSize: fitLine(rightText, 300, 40, 30), fontWeight: 800, color: rightTone, textAlign: 'center', maxWidth: 300, whiteSpace: 'nowrap'}}>
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
          transform: `scale(${0.7 + 0.3 * pop(t, 0.05, 14, 170)})`,
        }}
      >
        <Icon name="arrow" size={54} color="#1b1a18" stroke={3} />
      </div>
      {p.sub && (
        <div style={{position: 'absolute', left: 150, width: 780, top: y1 + 16, textAlign: 'center', fontSize: fitLine(p.sub, 700, 36, 28), fontWeight: 700, color: th.onBgSub, whiteSpace: 'nowrap'}}>
          {glueBreaks(p.sub, lang)}
        </div>
      )}
    </>
  );
};

// ---------- 主视觉：通栏数字条（大数字 + 一整条刻度/进度条，数据/效率类专用构图） ----------
const StatBarVisual: React.FC<{p: P; t: number}> = ({p, t}) => {
  const th = useTheme();
  const deco = decoOf(p, th.name);
  const tone = p.tone === 'accent' || !p.tone ? th.accent : toneColor(th, p.tone);
  const text = p.text ?? '';
  const size = fitLine(text, 780, 148, 90);
  const level = Math.max(0, Math.min(10, p.level ?? 8));
  const fillP = Math.min(1, t / 0.5);
  const barY = 1010;
  const barH = 100;
  const barW = 780;
  const pulse = bump(t, 0.5, 0.4);
  return (
    <>
      <Floaty x={36} y={800} icon={deco[0]} size={100} t={t} ph={0} rot={-10} />
      <Floaty x={940} y={1160} icon={deco[1]} size={100} t={t} ph={Math.PI} rot={10} />
      <div style={{position: 'absolute', left: 150, top: VIS_TOP, width: 780, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.05, color: tone, whiteSpace: 'nowrap'}}>
        {text}
      </div>
      {p.sub && (
        <div style={{position: 'absolute', left: 150, top: VIS_TOP + size * 1.08 + 14, width: 780, textAlign: 'center', fontSize: 34, fontWeight: 700, color: th.onBgSub, whiteSpace: 'nowrap'}}>
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
      </div>
      <div style={{position: 'absolute', left: (1080 - barW) / 2, top: barY + barH + 18, width: barW, display: 'flex', justifyContent: 'space-between', fontFamily: FONT, fontSize: 30, fontWeight: 700, color: th.onBgSub}}>
        <span>0</span>
        <span>{Math.round(level)}/10</span>
      </div>
    </>
  );
};

const Hook: React.FC<ShotProps<P>> = ({params: p, t, meta}) => {
  const th = useTheme();
  const lang: Lang = meta?.lang === 'en' ? 'en' : 'zh';
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      <Stroke x={194} y={266} len={44} rot={40} color={th.hot} />
      <Stroke x={172} y={306} len={32} rot={8} color={th.hot} />
      <Stroke x={846} y={292} len={44} rot={-40} color={th.hot} />
      <Stroke x={852} y={326} len={32} rot={-8} color={th.hot} />
      {p.visual === 'stat' ? (
        <StatVisual p={p} t={t} />
      ) : p.visual === 'icon' ? (
        <IconVisual p={p} t={t} />
      ) : p.visual === 'phone' ? (
        <PhoneVisual p={p} t={t} />
      ) : p.visual === 'split' ? (
        <SplitVisual p={p} t={t} lang={lang} />
      ) : p.visual === 'statBar' ? (
        <StatBarVisual p={p} t={t} />
      ) : (
        <BubbleVisual p={p} t={t} lang={lang} />
      )}
      {p.badge && <Badge text={p.badge} t={t} logo={meta?.logo} />}
    </div>
  );
};

export default Hook;

export const sfx = (p: P): SfxCue[] => [
  {at: 0.05, kind: 'pop', vol: 0.34},
  ...(p.visual === 'bubble' && p.sub ? [{at: 1.0, kind: 'thud', vol: 0.3}] : []),
  ...(p.badge ? [{at: 0.45, kind: 'swish', vol: 0.18}] : []),
];
