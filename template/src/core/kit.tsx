import React from 'react';
import {FONT} from './font';
import {Icon} from './icons';
import {Theme, alpha, toneColor, useTheme} from './theme';

// ============================================================
// 共享 UI 零件（都从 useTheme() 取色）。新镜头优先拼这些，风格才统一。
// ============================================================

/** meta.lang 的取值（和 schema.ts 的 Lang 同一个字符串，这里不引 schema 是为了不给 core 加依赖） */
export type Lang = 'zh' | 'en';

/** 中英文案二选一：meta.lang === 'en' 时用 en，否则（含没写）用 zh。给组件里的默认文案/占位符用 */
export const pick = (lang: Lang | undefined, zh: string, en: string): string => (lang === 'en' ? en : zh);

// ---------- 带 {} 强调的大字（字幕/封面标题/片尾大字同款：白字 + 粗描边 + 硬投影） ----------
export type Ch = {c: string; hot: boolean} | {br: true};
export const parseRich = (s: string): Ch[] => {
  const out: Ch[] = [];
  let hot = false;
  for (const c of Array.from(s)) {
    if (c === '{') hot = true;
    else if (c === '}') hot = false;
    else if (c === '\n') out.push({br: true});
    else out.push({c, hot});
  }
  return out;
};

export const glyph = (th: Theme, size: number, hot: boolean, strokeK = 0.15): React.CSSProperties => {
  // 只有主题自己写了 captionStyle: "clean" 才去掉描边。原来的主题不写这个字段，画面保持描边。
  if (th.captionStyle === 'clean') {
    return {
      color: hot ? th.hot : th.capFill,
      textShadow: '0 4px 14px rgba(14,21,49,0.22)',
    };
  }
  return {
    color: hot ? th.hot : th.capFill,
    WebkitTextStroke: `${Math.round(size * strokeK)}px ${th.capStroke}`,
    paintOrder: 'stroke fill',
    textShadow: `0 ${Math.round(size * 0.08)}px 0 ${th.capStroke}`,
  };
};

/** 静态大字（封面/片尾用）；逐字动画的版本在 layers.tsx 的 Captions。
 * lang='en' 时行高更松、不用中文的 palt 特性、字距归零（拉丁字重叠比汉字更明显） */
export const BigText: React.FC<{text: string; size: number; lineHeight?: number; style?: React.CSSProperties; lang?: Lang}> = ({
  text,
  size,
  lineHeight,
  style,
  lang = 'zh',
}) => {
  const th = useTheme();
  const lh = lineHeight ?? (lang === 'en' ? 1.28 : 1.16);
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: th.captionStyle === 'clean' ? 800 : 900,
        lineHeight: lh,
        letterSpacing: lang === 'en' ? 0 : undefined,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        fontFeatureSettings: lang === 'en' ? undefined : '"palt"',
        ...style,
      }}
    >
      {parseRich(text).map((ch, j) =>
        // 逐字 span：单独一个空格会被当成行首+行尾的可折叠空白吃掉（英文标题最明显），换成 NBSP
        'br' in ch ? <br key={j} /> : <span key={j} style={glyph(th, size, ch.hot)}>{ch.c === ' ' ? ' ' : ch.c}</span>,
      )}
    </div>
  );
};

// ---------- 卡片 ----------
export const Card: React.FC<{style?: React.CSSProperties; children?: React.ReactNode; radius?: number; alt?: boolean}> = ({
  style,
  children,
  radius = 36,
  alt,
}) => {
  const th = useTheme();
  return (
    <div
      style={{
        background: alt ? th.cardAlt : th.card,
        color: th.cardText,
        borderRadius: radius,
        boxShadow: th.shadow,
        fontFamily: FONT,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ---------- 胶囊 ----------
export const Pill: React.FC<{
  text: string;
  size?: number;
  tone?: 'accent' | 'good' | 'warn' | 'bad' | 'neutral';
  filled?: boolean;
  icon?: string;
  style?: React.CSSProperties;
}> = ({text, size = 30, tone = 'accent', filled, icon, style}) => {
  const th = useTheme();
  const c = toneColor(th, tone);
  // 强调色要拆开：字用 accentInk，实心底用 accentFill。没触发时两者都等于 accent。
  const fill = tone === 'accent' ? th.accentFill : c;
  const ink = tone === 'accent' ? th.accentInk : c;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.3,
        height: size * 1.6,
        boxSizing: 'border-box',
        padding: `0 ${size * 0.7}px`,
        borderRadius: size * 0.8,
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: size,
        whiteSpace: 'nowrap',
        color: filled ? (tone === 'accent' ? th.accentText : '#FFFFFF') : ink,
        background: filled ? fill : tone === 'accent' ? th.accentSoft : alpha(c, th.dark ? 0.18 : 0.12),
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size * 1.05} stroke={2.4} />}
      {text}
    </div>
  );
};

// ---------- 头像（中性：圆底 + 白色剪影） ----------
export const Avatar: React.FC<{size?: number; mine?: boolean; hue?: number}> = ({size = 60, mine, hue}) => {
  const th = useTheme();
  const bg = hue !== undefined ? `hsl(${hue} 70% ${th.dark ? 38 : 82}%)` : mine ? th.accentLine : th.dark ? '#5B4A6B' : '#FFD9CF';
  return (
    <div style={{width: size, height: size, borderRadius: size / 2, flex: 'none', background: bg, position: 'relative', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: size * 0.32, top: size * 0.18, width: size * 0.36, height: size * 0.36, borderRadius: '50%', background: 'rgba(255,255,255,0.95)'}} />
      <div style={{position: 'absolute', left: size * 0.16, top: size * 0.6, width: size * 0.68, height: size * 0.6, borderRadius: '50%', background: 'rgba(255,255,255,0.95)'}} />
    </div>
  );
};

// ---------- 聊天气泡（中性配色：我方 = 强调色，对方 = 浅灰；不用任何 IM 的标志色） ----------
export const Bubble: React.FC<{
  text: string;
  mine?: boolean;
  size?: number;
  maxW?: number;
  avatar?: number; // 0 = 不画头像
  lh?: number;
}> = ({text, mine, size = 42, maxW = 520, avatar = 60, lh = 1.36}) => {
  const th = useTheme();
  return (
    <div style={{display: 'flex', flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 14}}>
      {avatar > 0 && <Avatar mine={mine} size={avatar} />}
      <div
        style={{
          maxWidth: maxW,
          background: mine ? th.accentFill : th.bubbleOther,
          color: mine ? th.accentText : th.bubbleOtherText,
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: size,
          lineHeight: lh,
          padding: `${size * 0.36}px ${size * 0.58}px`,
          borderRadius: size * 0.8,
          borderTopLeftRadius: mine ? size * 0.8 : 10,
          borderTopRightRadius: mine ? 10 : size * 0.8,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ---------- 图标圆盘 ----------
export const IconDisc: React.FC<{name: string; size?: number; tone?: 'accent' | 'good' | 'warn' | 'bad'; soft?: boolean; style?: React.CSSProperties}> = ({
  name,
  size = 96,
  tone = 'accent',
  soft,
  style,
}) => {
  const th = useTheme();
  const c = toneColor(th, tone);
  const fill = tone === 'accent' ? th.accentFill : c;
  const ink = tone === 'accent' ? th.accentInk : c;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: soft ? (tone === 'accent' ? th.accentSoft : alpha(c, 0.14)) : fill,
        boxShadow: soft ? undefined : `0 10px 24px ${alpha(fill, 0.35)}`,
        ...style,
      }}
    >
      <Icon name={name} size={size * 0.52} color={soft ? ink : tone === 'accent' ? th.accentText : '#FFFFFF'} stroke={2.2} />
    </div>
  );
};

// ---------- 扫光（胶囊/按钮上的一道高光） p: 0→1 ----------
export const Sweep: React.FC<{p: number; w: number}> = ({p, w}) =>
  p > 0 && p < 1 ? (
    <div
      style={{
        position: 'absolute',
        top: -20,
        bottom: -20,
        left: -140 + p * (w + 280),
        width: 90,
        transform: 'skewX(-22deg)',
        background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none',
      }}
    />
  ) : null;

// ---------- 点击指示（手指点下的圆圈），d = t - 点击时刻 ----------
export const TapRipple: React.FC<{x: number; y: number; d: number}> = ({x, y, d}) =>
  d >= -0.25 && d < 0.6 ? (
    <div
      style={{
        position: 'absolute',
        left: x - 44,
        top: y - 44,
        width: 88,
        height: 88,
        borderRadius: 44,
        background: 'rgba(17,24,39,0.28)',
        border: '4px solid rgba(255,255,255,0.9)',
        transform: `scale(${d < 0 ? 1.3 + d : 1 + d * 0.8})`,
        opacity: d < 0 ? (d + 0.25) / 0.25 : 1 - d / 0.6,
        pointerEvents: 'none',
      }}
    />
  ) : null;

// ---------- 同一提示不重复出现 ----------
// 全局层已经画了顶部免责小字（meta.disclaimer）和底部提示条（meta.notices）。镜头里的脚注/说明、片尾卖点
// 如果和它们说的是同一句话，就别再画一遍（评审：「生活美容·不提供医疗美容服务」一帧里印了两次）。
// 判定：去掉标点空白后相同 / 一方包含另一方（≥6 字）/ 两边都是「演示、示意、模拟」类的演示声明。
const normHint = (s: string) => s.replace(/[\s{}·•,，。.、:：;；!！?？()（）「」“”"'\-—_/|]/g, '').toLowerCase();
const DEMO_RE = /演示|示意|模拟|示例|仅供参考|以实际为准|sample|demo|simulat|illustrat/i;
export const repeatsHint = (text: string, ref: {disclaimer?: string; notices?: string[]}): boolean => {
  const a = normHint(text ?? '');
  if (!a) return false;
  const others = [ref.disclaimer, ...(ref.notices ?? [])].filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return others.some((o) => {
    const b = normHint(o);
    if (!b) return false;
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (Array.from(short).length >= 6 && long.includes(short)) return true;
    return o === ref.disclaimer && DEMO_RE.test(text) && DEMO_RE.test(o);
  });
};

// ---------- 主体区居中容器：卡片高度贴合内容，在 y 560–1340 里垂直居中 ----------
// 以前不少卡片写死 ~780px 高，内容少时下半截大块留白（评审：storeCard/mockApp 卡片 40–60% 是空的）。
// 新写的镜头把卡片放进这个容器、别给卡片定高，卡片就按内容长高、整体居中。
export const CenterMain: React.FC<{top?: number; bottom?: number; gap?: number; style?: React.CSSProperties; children?: React.ReactNode}> = ({
  top = 560,
  bottom = 1340,
  gap = 24,
  style,
  children,
}) => (
  <div style={{position: 'absolute', left: 150, width: 780, top, height: bottom - top, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch', gap, ...style}}>
    {children}
  </div>
);

// ---------- 占位（未实现的镜头用） ----------
export const Placeholder: React.FC<{type: string; t: number; lines?: string[]}> = ({type, t, lines = []}) => {
  const th = useTheme();
  const p = Math.min(1, Math.max(0, t / 0.35));
  return (
    <div style={{position: 'absolute', left: 150, top: 560, width: 780, height: 780, opacity: p, transform: `translateY(${(1 - p) * 40}px)`}}>
      <Card style={{width: '100%', height: '100%', padding: 50, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 24, border: `4px dashed ${th.accentLine}`}}>
        <Icon name="doc" size={96} color={th.accentInk} />
        <div style={{fontSize: 72, fontWeight: 900, color: th.cardText}}>{type}</div>
        {/* i18n-ignore：开发占位，只在镜头没实现时出现，validate 会先拦掉未知镜头 */}
        <div style={{fontSize: 34, color: th.cardSub}}>镜头待实现（占位）</div>
        {lines.slice(0, 4).map((l, i) => (
          <div key={i} style={{fontSize: 34, color: th.cardText, maxWidth: 680, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>
            {l}
          </div>
        ))}
      </Card>
    </div>
  );
};
