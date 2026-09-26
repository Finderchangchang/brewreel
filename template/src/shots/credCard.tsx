import React from 'react';
import {Img, staticFile} from 'remotion';
import {bump, pop} from '../core/anim';
import {fitLine} from '../core/fit';
import {FONT, MONO} from '../core/font';
import {Icon} from '../core/icons';
import {Sweep} from '../core/kit';
import {Illust, isIllust} from '../illust';
import {CARD, MAIN} from '../core/safe';
import {alpha, useTheme} from '../core/theme';
import type {ShotProps, SfxCue} from '../core/types';

// ============================================================
// credCard：人或荣誉的资历卡（design §1.7）。
//   person：首字圆标（或 photo）+ 姓名/角色/年限，creds 逐条勾出，skills 收尾一排标签
//   honor ：自绘徽章（不仿米其林/黑珍珠等官方标识）+ 称号大字 + 颁发方 · 年份
// 主角：person 的每条资历「打勾」落定；honor 的徽章扫光 + 年份数字落定。
// 无照片时用 <Illust> 顶一个和所在行业相关的小图标在圆标角上，不用 AI 人脸冒充本人。
// ============================================================
type Layout = 'person' | 'honor';
type P = {
  layout?: Layout;
  name?: string;
  role?: string;
  years?: number;
  creds?: string[];
  skills?: string[];
  photo?: string;
  title?: string;
  issuer?: string;
  year?: number;
  refs?: string[];
};

const INDUSTRY_TOOL: Record<string, string> = {
  food: 'food/bowl',
  ecommerce: 'ecommerce/tag',
  education: 'education/book',
  beauty: 'beauty/scissors',
  travel: 'travel/bed',
};

const initial = (s?: string) => (s && s.trim() ? Array.from(s.trim())[0] : '师');

// ---------- person ----------
const Person: React.FC<{p: P; t: number; beat: number; industry?: string}> = ({p, t, beat, industry}) => {
  const th = useTheme();
  const enter = pop(t, 0, 15, 170);
  const creds = (p.creds ?? []).slice(0, 3);
  const skills = (p.skills ?? []).slice(0, 3);
  const step = Math.max(0.35, beat * 0.9);
  const credAt = (i: number) => 0.55 + i * step;
  const skillAt = credAt(Math.max(0, creds.length - 1)) + step * 0.9;
  const AV = 176;
  const tool = industry ? INDUSTRY_TOOL[industry] : undefined;
  const nameSize = fitLine(p.name ?? '', 480, 52, 40);
  return (
    <div
      style={{
        position: 'absolute',
        left: CARD.x0,
        top: MAIN.y0,
        width: CARD.w,
        height: MAIN.h,
        boxSizing: 'border-box',
        borderRadius: 40,
        background: th.card,
        boxShadow: th.shadow,
        padding: 42,
        display: 'flex',
        flexDirection: 'column',
        opacity: Math.min(1, enter * 1.6),
        transform: `translateY(${(1 - enter) * 50}px) scale(${0.94 + 0.06 * enter})`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
        <div style={{position: 'relative', width: AV, height: AV, flex: 'none'}}>
          {p.photo ? (
            <Img src={staticFile(p.photo)} style={{width: AV, height: AV, borderRadius: AV / 2, objectFit: 'cover', boxShadow: th.shadow}} />
          ) : (
            <div
              style={{
                width: AV,
                height: AV,
                borderRadius: AV / 2,
                background: th.accentSoft,
                color: th.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 72,
              }}
            >
              {initial(p.name)}
            </div>
          )}
          {!p.photo && tool && isIllust(tool) && (
            <div style={{position: 'absolute', right: -10, bottom: -10, width: 68, height: 68, borderRadius: 20, background: th.card, boxShadow: '0 8px 18px rgba(0,0,0,0.2)', padding: 6, boxSizing: 'border-box'}}>
              <Illust name={tool} size={56} color="accent" animate t={t} />
            </div>
          )}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0}}>
          <div style={{fontSize: nameSize, fontWeight: 900, color: th.cardText, whiteSpace: 'nowrap'}}>{p.name}</div>
          {p.role && <div style={{fontSize: 36, fontWeight: 700, color: th.cardSub, whiteSpace: 'nowrap'}}>{p.role}</div>}
          {typeof p.years === 'number' && (
            <div style={{display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', padding: '5px 18px', borderRadius: 18, background: th.accentSoft, color: th.accent, fontWeight: 800, fontSize: 28}}>
              从业 {p.years} 年
            </div>
          )}
        </div>
      </div>

      {creds.length > 0 && (
        <div style={{marginTop: 30, display: 'flex', flexDirection: 'column', gap: 16}}>
          {creds.map((c, i) => {
            const at = credAt(i);
            if (t < at) return null;
            const q = pop(t, at, 13, 210);
            const hit = bump(t, at + 0.12, 0.4);
            const size = fitLine(c, CARD.w - 84 - 84, 38, 32);
            return (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 16, opacity: Math.min(1, q * 1.7), transform: `translateX(${(1 - q) * 36}px)`}}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    flex: 'none',
                    background: th.good,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `scale(${1 + hit * 0.28})`,
                  }}
                >
                  <Icon name="check" size={26} color="#FFFFFF" stroke={3.2} />
                </div>
                <div style={{fontSize: size, fontWeight: 700, color: th.cardText, lineHeight: 1.28}}>{c}</div>
              </div>
            );
          })}
        </div>
      )}

      {skills.length > 0 && t >= skillAt && (
        <div style={{marginTop: 'auto', paddingTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
          {skills.map((s, i) => {
            const at = skillAt + i * 0.12;
            if (t < at) return null;
            const q = pop(t, at, 12, 220);
            return (
              <div
                key={i}
                style={{
                  padding: '9px 22px',
                  borderRadius: 20,
                  background: th.cardAlt,
                  color: th.cardSub,
                  fontWeight: 800,
                  fontSize: 28,
                  opacity: Math.min(1, q * 1.7),
                  transform: `scale(${0.8 + 0.2 * q})`,
                }}
              >
                {s}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------- honor：自绘徽章 ----------
const Badge: React.FC<{t: number; year?: number; photo?: string}> = ({t, year, photo}) => {
  const th = useTheme();
  const q = pop(t, 0.05, 13, 150);
  const spin = pop(t, 0.05, 20, 60);
  const sweepP = Math.min(1, Math.max(0, (t - 0.35) / 0.9));
  const D = 220;
  if (photo) {
    return (
      <div style={{width: D, height: D, borderRadius: 28, overflow: 'hidden', boxShadow: th.shadow, opacity: Math.min(1, q * 1.7), transform: `scale(${0.7 + 0.3 * q})`}}>
        <Img src={staticFile(photo)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </div>
    );
  }
  const rays = 16;
  return (
    <div style={{position: 'relative', width: D, height: D, opacity: Math.min(1, q * 1.7), transform: `scale(${0.6 + 0.4 * q})`}}>
      <svg width={D} height={D} viewBox="0 0 220 220" style={{position: 'absolute', inset: 0, transform: `rotate(${(1 - spin) * 60}deg)`}}>
        {Array.from({length: rays}).map((_, i) => {
          const ang = (i / rays) * Math.PI * 2;
          const r1 = 74;
          const r2 = 108;
          const x1 = 110 + Math.cos(ang) * r1;
          const y1 = 110 + Math.sin(ang) * r1;
          const x2 = 110 + Math.cos(ang) * r2;
          const y2 = 110 + Math.sin(ang) * r2;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={th.accent} strokeWidth={10} strokeLinecap="round" opacity={0.85} />;
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: D / 2 - 74,
          top: D / 2 - 74,
          width: 148,
          height: 148,
          borderRadius: 74,
          background: th.accent,
          boxShadow: `0 14px 30px ${alpha(th.accent, 0.4)}`,
          border: '6px solid #ffffff',
          overflow: 'hidden',
        }}
      >
        <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
          <Icon name="star" size={40} color={th.accentText} stroke={2.4} />
          {typeof year === 'number' && <div style={{fontFamily: MONO, fontWeight: 800, fontSize: 30, color: th.accentText, marginTop: 4}}>{year}</div>}
        </div>
        <Sweep p={sweepP} w={148} />
      </div>
    </div>
  );
};

const Honor: React.FC<{p: P; t: number}> = ({p, t}) => {
  const th = useTheme();
  const enter = pop(t, 0, 15, 170);
  const textAt = 0.45;
  const tq = pop(t, textAt, 14, 190);
  const titleSize = fitLine(p.title ?? '', CARD.w - 120, 52, 40);
  return (
    <div
      style={{
        position: 'absolute',
        left: CARD.x0,
        top: MAIN.y0,
        width: CARD.w,
        height: MAIN.h,
        boxSizing: 'border-box',
        borderRadius: 40,
        background: th.card,
        boxShadow: th.shadow,
        padding: '48px 44px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        opacity: Math.min(1, enter * 1.6),
        transform: `translateY(${(1 - enter) * 50}px) scale(${0.94 + 0.06 * enter})`,
      }}
    >
      <Badge t={t} year={p.year} photo={p.photo} />
      {t >= textAt && (
        <div style={{textAlign: 'center', opacity: Math.min(1, tq * 1.7), transform: `translateY(${(1 - tq) * 30}px)`}}>
          <div style={{fontSize: titleSize, fontWeight: 900, color: th.cardText, lineHeight: 1.24}}>{p.title}</div>
          {(p.issuer || p.year) && (
            <div style={{marginTop: 12, fontSize: 32, fontWeight: 700, color: th.cardSub}}>
              {p.issuer}
              {p.issuer && p.year ? ' · ' : ''}
              {p.year}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CredCard: React.FC<ShotProps<P>> = ({params: p, t, beat, meta}) => {
  const layout: Layout = p.layout === 'honor' ? 'honor' : 'person';
  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: FONT}}>
      {layout === 'person' ? <Person p={p} t={t} beat={beat} industry={meta?.industry} /> : <Honor p={p} t={t} />}
    </div>
  );
};

export default CredCard;

export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => {
  const layout: Layout = p.layout === 'honor' ? 'honor' : 'person';
  if (layout === 'honor') return [{at: 0.05, kind: 'pop', vol: 0.24}, {at: 0.35, kind: 'swish', vol: 0.2}];
  const creds = (p.creds ?? []).slice(0, 3);
  const step = Math.max(0.35, ctx.beat * 0.9);
  const out: SfxCue[] = [{at: 0, kind: 'pop', vol: 0.22}];
  creds.forEach((_, i) => out.push({at: 0.55 + i * step + 0.12, kind: 'ding', vol: 0.16}));
  return out;
};
