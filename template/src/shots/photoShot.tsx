import React from 'react';
import {Img, OffthreadVideo, staticFile} from 'remotion';
import {fitTimeline, pop} from '../core/anim';
import {fitLine} from '../core/fit';
import {FONT} from '../core/font';
import {illustFor, isIllust} from '../illust';
import {IllustScene, resolveSceneIllust} from '../illust/scene';
import {pick, type Lang} from '../core/kit';
import {CARD, MAIN} from '../core/safe';
import {alpha, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// photoShot：商家实拍照片/短视频做主角（docs/dev/industry-design.md §1.1）。
//   hero    单张缓推满屏卡 + 底部渐变字幕带（标题/一句卖点/价签）+ 角标（招牌等）
//   clip    同 hero，素材是视频，加播放小标 + 底部进度条
//   grid    2–4 张拼贴，各带短标签，依次错落入场
//   callouts 单张照片 + 1–3 处引线圈注
//   tour    2–5 张依次轮播，带页码点
// 没有真实素材（media.source==='drawn' 或没给 src）时不画拟真实物，换成整卡插画场景（illust/scene.tsx）：
// 主题色底 + 纹理、约 480px 主插画、同行业 2–3 个小道具飘入、慢推、按行业的粒子层；角标一律「示意」。
// 没写 illust 时按 label/title 的关键词挑图（illust/names.json 的 keywords），再按行业默认图兜底。
// 画面里的固定文案走 pick(meta.lang, 中, 英)。
// ============================================================
type Media = {
  src?: string;
  kind?: 'image' | 'video';
  source?: 'merchant' | 'ai' | 'drawn';
  tag?: '实拍' | '示意' | '效果图'; // i18n-ignore（枚举值，上屏走 tagLabel 的 pick）
  month?: number;
  label?: string;
  illust?: string;
  retouched?: boolean;
  trimStart?: number;
  trimEnd?: number;
  keepAudio?: boolean;
  speed?: number;
};
type Callout = {text: string; x?: number; y?: number};
type P = {
  layout?: 'hero' | 'clip' | 'grid' | 'callouts' | 'tour';
  media?: Media[];
  title?: string;
  tagline?: string;
  badge?: string;
  price?: number;
  unit?: string;
  roomType?: string;
  callouts?: Callout[];
  refs?: string[];
};

const isVideoSrc = (src?: string) => !!src && /\.(mp4|webm|mov|m4v)$/i.test(src);

// 没给 illust（或给了不存在的名字）时：先按这一张的 label / 镜头 title 等文字挑关键词最贴的插画
// （names.json 的 keywords；如「手打牛肉丸」→ food/meatball、「保温杯」→ ecommerce/cup），都没命中再按行业默认图。
// 以前一律按行业给默认图，保温杯拿到的是礼盒（评审 evidence：ind-ecommerce 9s）。
const drawnIllust = (m: Media | undefined, texts: Array<string | undefined>, industry?: string) =>
  isIllust(m?.illust) ? (m?.illust as string) : resolveSceneIllust(illustFor([m?.label, ...texts], industry), industry);

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TAG_EN: Record<string, string> = {实拍: 'Real photo', 示意: 'Illustration', 效果图: 'Concept render'};

const tagLabel = (m: Media | undefined, lang?: Lang) => {
  // 插画兜底一律标「示意」：模型把 tag 写成「实拍」也不照抄（画的不能冒充实拍）
  if (!m || m.source === 'drawn' || !m.src) return pick(lang, '示意', 'Illustration');
  if (m.source === 'ai') return pick(lang, 'AI生成 · 效果示意', 'AI-generated · Concept');
  if (m.month) return pick(lang, `${m.month}月实拍`, `Shot in ${MONTH_EN[(m.month - 1) % 12]}`);
  const tag = m.tag ?? '实拍'; // i18n-ignore（枚举值，下一行 pick 换英文）
  return pick(lang, tag, TAG_EN[tag] ?? tag);
};

// ---------- 素材内容：真图/真视频/整卡插画场景兜底（illust/scene.tsx） ----------
const MediaContent: React.FC<{m?: Media; t: number; dur: number; industry?: string; w: number; h: number; texts?: Array<string | undefined>; variant?: number}> = ({
  m,
  t,
  dur,
  industry,
  w,
  h,
  texts = [],
  variant = 0,
}) => {
  const zoom = 1 + 0.06 * Math.min(1, Math.max(0, t) / Math.max(0.6, dur));
  if (!m || m.source === 'drawn' || !m.src) {
    return <IllustScene name={drawnIllust(m, texts, industry)} w={w} h={h} t={t} dur={dur} industry={industry} variant={variant} />;
  }
  if (m.kind === 'video' || isVideoSrc(m.src)) {
    return (
      <OffthreadVideo
        src={staticFile(m.src)}
        muted={!m.keepAudio}
        playbackRate={m.speed ?? 1}
        trimBefore={Math.round((m.trimStart ?? 0) * 30)}
        trimAfter={m.trimEnd !== undefined ? Math.round(m.trimEnd * 30) : undefined}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}}
      />
    );
  }
  return <Img src={staticFile(m.src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}} />;
};

// ---------- 角标（实拍/示意/AI生成/N月实拍） ----------
const TagChip: React.FC<{text: string; corner?: 'tl' | 'tr'}> = ({text, corner = 'tr'}) => (
  <div
    style={{
      position: 'absolute',
      top: 18,
      [corner === 'tr' ? 'right' : 'left']: 18,
      padding: '7px 16px',
      borderRadius: 20,
      background: alpha('#0B0D14', 0.55),
      color: '#FFFFFF',
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: 26,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </div>
);

// ---------- 卡片式圆角外框 ----------
const Frame: React.FC<{box: {x: number; y: number; w: number; h: number}; radius?: number; style?: React.CSSProperties; children?: React.ReactNode}> = ({box, radius = 40, style, children}) => {
  const th = useTheme();
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: radius,
        overflow: 'hidden',
        boxShadow: th.shadow,
        background: th.cardAlt,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ---------- 底部渐变字幕带：标题/卖点一句/价签/顶部角标 ----------
const InfoOverlay: React.FC<{p: P; t: number}> = ({p, t}) => {
  const th = useTheme();
  const has = p.title || p.tagline || p.roomType || p.price !== undefined;
  const q = pop(t, 0.08, 15, 190);
  return (
    <>
      {p.badge && (
        <div style={{position: 'absolute', left: 18, top: 18, opacity: Math.min(1, q * 1.8)}}>
          <div style={{padding: '8px 20px', borderRadius: 22, background: th.hot, color: '#1B1A18', fontFamily: FONT, fontWeight: 900, fontSize: 28, whiteSpace: 'nowrap', boxShadow: '0 8px 18px rgba(0,0,0,0.25)'}}>{p.badge}</div>
        </div>
      )}
      {has && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '110px 28px 26px',
            background: 'linear-gradient(0deg, rgba(6,8,14,0.78) 0%, rgba(6,8,14,0.42) 55%, rgba(6,8,14,0) 100%)',
            opacity: Math.min(1, q * 1.6),
            transform: `translateY(${(1 - q) * 24}px)`,
          }}
        >
          {p.roomType && <div style={{fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.86)', marginBottom: 4}}>{p.roomType}</div>}
          {p.title && <div style={{fontSize: fitLine(p.title, 620, 52, 40), fontWeight: 900, color: '#FFFFFF', lineHeight: 1.16}}>{p.title}</div>}
          {p.tagline && <div style={{marginTop: 8, fontSize: fitLine(p.tagline, 620, 36, 28), fontWeight: 600, color: 'rgba(255,255,255,0.9)'}}>{p.tagline}</div>}
        </div>
      )}
      {p.price !== undefined && (
        <div
          style={{
            position: 'absolute',
            right: 20,
            bottom: 20,
            display: 'flex',
            alignItems: 'baseline',
            gap: 4,
            padding: '10px 22px',
            borderRadius: 26,
            background: th.accent,
            color: th.accentText,
            fontFamily: FONT,
            whiteSpace: 'nowrap',
            opacity: Math.min(1, q * 1.8),
            transform: `scale(${0.85 + 0.15 * q})`,
            boxShadow: `0 10px 24px ${alpha(th.accent, 0.4)}`,
          }}
        >
          <span style={{fontWeight: 900, fontSize: 40}}>¥{p.price}</span>
          {p.unit && <span style={{fontWeight: 700, fontSize: 26, opacity: 0.9}}>/{p.unit}</span>}
        </div>
      )}
    </>
  );
};

// ---------- 播放角标（clip 专用） ----------
const PlayBadge: React.FC<{t: number}> = ({t}) => {
  const pulse = (t % 1.4) / 1.4;
  return (
    <div style={{position: 'absolute', left: 18, top: 18, width: 60, height: 60}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.85)', transform: `scale(${1 + pulse * 0.5})`, opacity: 1 - pulse}} />
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: alpha('#0B0D14', 0.5), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{width: 0, height: 0, marginLeft: 5, borderTop: '11px solid transparent', borderBottom: '11px solid transparent', borderLeft: '17px solid #FFFFFF'}} />
      </div>
    </div>
  );
};

const BOX = {x: CARD.x0, y: MAIN.y0, w: CARD.w, h: MAIN.h};

// ---------- hero / clip / callouts：单张大图 ----------
const HeroLike: React.FC<{p: P; t: number; dur: number; industry?: string; lang?: Lang; isClip?: boolean; isCallouts?: boolean}> = ({p, t, dur, industry, lang, isClip, isCallouts}) => {
  const th = useTheme();
  const m0 = p.media?.[0];
  const enter = pop(t, 0, 14, 170);
  const marks = isCallouts ? (p.callouts ?? []).slice(0, 3) : [];
  const at = marks.map((_, i) => 0.35 + i * 0.55);
  return (
    <Frame box={BOX} style={{opacity: Math.min(1, enter * 1.6), transform: `translateY(${(1 - enter) * 44}px) scale(${0.94 + 0.06 * enter})`}}>
      <MediaContent m={m0} t={t} dur={dur} industry={industry} w={BOX.w} h={BOX.h} texts={[p.title, p.tagline, p.roomType]} />
      <TagChip text={tagLabel(m0, lang)} />
      {isClip && <PlayBadge t={t} />}
      {marks.map((c, i) => {
        if (t < at[i]) return null;
        const x = Math.min(BOX.w - 40, Math.max(40, (c.x ?? BOX.w * (0.28 + i * 0.24)) - BOX.x));
        const yRaw = c.y !== undefined ? c.y - BOX.y : BOX.h * (0.3 + (i % 2) * 0.3);
        const y = Math.min(BOX.h - 120, Math.max(60, yRaw));
        const q = pop(t, at[i], 13, 210);
        const below = y < BOX.h * 0.55;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: x - 12, top: y - 12, width: 24, height: 24, borderRadius: 12, background: th.hot, border: '3px solid #fff', boxShadow: '0 6px 14px rgba(0,0,0,0.3)', transform: `scale(${q})`}} />
            <div style={{position: 'absolute', left: x - 2, top: below ? y : y - 46, width: 4, height: 46, background: 'rgba(255,255,255,0.85)', opacity: Math.min(1, q * 2)}} />
            <div
              style={{
                position: 'absolute',
                left: Math.min(BOX.w - 20, Math.max(20, x - 20)),
                top: below ? y + 46 : y - 92,
                padding: '8px 18px',
                borderRadius: 20,
                background: '#FFFFFF',
                color: '#1B1A18',
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 28,
                whiteSpace: 'nowrap',
                boxShadow: '0 10px 22px rgba(0,0,0,0.28)',
                opacity: Math.min(1, q * 1.8),
                transform: `scale(${0.7 + 0.3 * q})`,
              }}
            >
              {c.text}
            </div>
          </React.Fragment>
        );
      })}
      <InfoOverlay p={p} t={t} />
    </Frame>
  );
};

// ---------- grid：2–4 张拼贴 ----------
const gridBoxes = (n: number): {x: number; y: number; w: number; h: number}[] => {
  const {x0, y0, w, h} = MAIN;
  const G = 16;
  const cw = (w - G) / 2;
  if (n <= 1) return [{x: x0, y: y0, w, h}];
  if (n === 2) return [{x: x0, y: y0, w: cw, h}, {x: x0 + cw + G, y: y0, w: cw, h}];
  if (n === 3) {
    const hTop = 356;
    const hBot = h - G - hTop;
    return [
      {x: x0, y: y0, w, h: hTop},
      {x: x0, y: y0 + hTop + G, w: cw, h: hBot},
      {x: x0 + cw + G, y: y0 + hTop + G, w: cw, h: hBot},
    ];
  }
  const ch = (h - G) / 2;
  return [0, 1, 2, 3].map((i) => ({x: x0 + (i % 2) * (cw + G), y: y0 + Math.floor(i / 2) * (ch + G), w: cw, h: ch}));
};

const Grid: React.FC<{p: P; t: number; dur: number; industry?: string; lang?: Lang}> = ({p, t, dur, industry, lang}) => {
  const items = (p.media ?? []).slice(0, 4);
  const n = items.length;
  if (!n) return null;
  const boxes = gridBoxes(n);
  const k = fitTimeline((n - 1) * 0.8, dur, 0.6);
  const gap = 0.8 * k;
  return (
    <>
      {items.map((m, i) => {
        const at = i * gap;
        const q = pop(t, at, 14, 190);
        if (t < at) return null;
        return (
          <Frame key={i} box={boxes[i]} radius={32} style={{opacity: Math.min(1, q * 1.6), transform: `translateY(${(1 - q) * 46}px) scale(${0.9 + 0.1 * q})`}}>
            <MediaContent m={m} t={t - at} dur={dur} industry={industry} w={boxes[i].w} h={boxes[i].h} texts={[p.title]} variant={i} />
            <TagChip text={tagLabel(m, lang)} corner={i % 2 ? 'tr' : 'tl'} />
            {m.label && (
              <div style={{position: 'absolute', left: 14, bottom: 12, padding: '6px 16px', borderRadius: 18, background: alpha('#0B0D14', 0.55), color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 26, whiteSpace: 'nowrap'}}>{m.label}</div>
            )}
          </Frame>
        );
      })}
    </>
  );
};

// ---------- tour：2–5 张依次轮播 ----------
const Tour: React.FC<{p: P; t: number; dur: number; industry?: string; lang?: Lang}> = ({p, t, dur, industry, lang}) => {
  const items = (p.media ?? []).slice(0, 5);
  const n = items.length;
  if (!n) return null;
  const slice = dur / n;
  let idx = Math.min(n - 1, Math.floor(t / Math.max(0.01, slice)));
  const local = t - idx * slice;
  const enter = pop(t, 0, 14, 170);
  const cross = Math.min(1, local / 0.35);
  const m = items[idx];
  return (
    <Frame box={BOX} style={{opacity: Math.min(1, enter * 1.6), transform: `translateY(${(1 - enter) * 44}px) scale(${0.94 + 0.06 * enter})`}}>
      <div style={{position: 'absolute', inset: 0, opacity: cross, transform: `scale(${0.98 + 0.02 * cross})`}}>
        <MediaContent m={m} t={local} dur={slice} industry={industry} w={BOX.w} h={BOX.h} texts={[p.roomType, p.title]} variant={idx} />
      </div>
      <TagChip text={tagLabel(m, lang)} />
      {p.roomType && (
        <div style={{position: 'absolute', left: 20, top: 62, padding: '6px 18px', borderRadius: 18, background: alpha('#0B0D14', 0.5), color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 26, whiteSpace: 'nowrap'}}>{p.roomType}</div>
      )}
      {m.label && (
        <div style={{position: 'absolute', left: 20, bottom: 22, padding: '9px 22px', borderRadius: 24, background: alpha('#0B0D14', 0.55), color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 32, whiteSpace: 'nowrap'}}>{m.label}</div>
      )}
      <div style={{position: 'absolute', right: 24, bottom: 24, display: 'flex', gap: 8}}>
        {items.map((_, i) => (
          <div key={i} style={{width: i === idx ? 26 : 10, height: 10, borderRadius: 5, background: i === idx ? '#FFFFFF' : 'rgba(255,255,255,0.5)', transition: 'width 0.2s'}} />
        ))}
      </div>
    </Frame>
  );
};

const PhotoShot: React.FC<ShotProps<P>> = ({params: p, t, dur, meta}) => {
  const layout = p.layout ?? 'hero';
  const industry = meta?.industry as string | undefined;
  const lang = meta?.lang;
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      {layout === 'grid' ? (
        <Grid p={p} t={t} dur={dur} industry={industry} lang={lang} />
      ) : layout === 'tour' ? (
        <Tour p={p} t={t} dur={dur} industry={industry} lang={lang} />
      ) : (
        <HeroLike p={p} t={t} dur={dur} industry={industry} lang={lang} isClip={layout === 'clip'} isCallouts={layout === 'callouts'} />
      )}
    </div>
  );
};

export default PhotoShot;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const layout = p.layout ?? 'hero';
  if (layout === 'grid') {
    const n = Math.min(4, p.media?.length ?? 0);
    const k = fitTimeline((n - 1) * 0.8, ctx.dur, 0.6);
    return Array.from({length: n}, (_, i) => ({at: i * 0.8 * k, kind: 'pop', vol: 0.22}));
  }
  if (layout === 'tour') {
    const n = Math.min(5, p.media?.length ?? 0);
    const slice = ctx.dur / Math.max(1, n);
    return Array.from({length: n}, (_, i) => ({at: i * slice, kind: 'swish', vol: 0.18}));
  }
  const out: SfxCue[] = [{at: 0.05, kind: 'pop', vol: 0.2}, {at: 0.3, kind: 'swish', vol: 0.2}];
  if (layout === 'callouts') (p.callouts ?? []).slice(0, 3).forEach((_, i) => out.push({at: 0.35 + i * 0.55, kind: 'tap', vol: 0.24}));
  return out;
};
