import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {ease} from '../../core/anim';
import {pick} from '../../core/kit';
import {FPS} from '../../core/safe';
import {useStylePalette, useStyleTokens} from '../context';
import type {FilmProps} from '../types';
import {CityWorld, nightOf} from './art';
import type {CityLayout} from './art/World';
import type {World} from './parts/city';
import {Finale, FinaleData, Fireworks, Stat, browserRect} from './parts/outro';
import {buildPlan, exprAt} from './parts/plan';
import {BuddyBird, Props, StartPad} from './parts/props';
import {RIDER_TOP, Rider} from './parts/rider';
import {Billboard, Bubble, Burst, HookTitle, Hud, Sign, Sparkles, clamp01, springAt} from './parts/ui';

// ============================================================
// journey 整片渲染器：一镜到底。分镜里的镜头只当数据（opening = 钩子，district = 一个街区，finale = 片尾），
// 世界剧本（相机曲线、各元件的世界坐标、笑点时刻）由 parts/plan.ts 先算好，这里逐帧按层画出来：
//   天空 → 远景 → 云 → 中景楼 → 广告牌 → 街面 → 前景楼 → 路边卡片 → 道具 → 路牌   （以上是「世界」，片尾整体缩进浏览器框）
//   → 角色（屏幕锁定，片尾出框）→ 伙伴 / 特效 → 气泡 / 拟声字 → 钩子大字 → 顶部 UI 带 → 闪光 → 片尾元件
// 角色在画面左侧 35% 处，视线 = 运动方向；道具都从右边来。
// ============================================================
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export const JourneyFilm: React.FC<FilmProps> = ({sb, slots, beat, geo}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const tk = useStyleTokens();
  const pal = useStylePalette();
  const aspectKey = geo.h > 1500 ? '9:16' : '4:5';
  const lay = tk.layout?.[aspectKey] ?? tk.layout?.['4:5'];
  const mascotX0 = geo.w * (tk.camera?.mascotX ?? 0.35);
  const cityScale: number = lay.cityScale ?? (aspectKey === '9:16' ? 1 : 0.9);
  const plan = useMemo(() => buildPlan(sb, slots, beat, tk, {cityScale, mascotX: mascotX0}), [sb, slots, beat, tk, cityScale, mascotX0]);
  const lang = sb.meta?.lang === 'en' ? 'en' : 'zh';
  const S: number = lay.mascotScale ?? 1;
  const mascotX = mascotX0;
  const w: World = {plan, tk, pal, geo, lay, t, mascotX, lang};
  const cam = tk.camera ?? {};
  const fl = tk.float ?? {};

  // ---- 片尾缩框 ----
  const fin = plan.finale;
  const ft = fin ? t - fin.start : -1;
  const zoomAt: number = cam.outroZoomAt ?? 1.3;
  const zd: number = cam.outroZoomDur ?? 0.3;
  const z = fin ? ease(ft, zoomAt, zd) : 0;
  const B = browserRect(w);
  const S1: number = cam.outroScale ?? 0.72;
  const sc = 1 - (1 - S1) * z;
  const tx = ((geo.w - geo.w * S1) / 2) * z;
  const ty = (B.y1 - geo.h * S1) * z;
  const clipR = (tk.radius?.browser ?? 34) * z;
  const textOn = fin ? 1 - clamp01((ft - zoomAt + 0.12) / 0.12) : 1;
  const hudHide = fin ? clamp01((ft - 0.5) / 0.3) : 0;

  // ---- 角色位置 ----
  const op = plan.opening;
  const seat = 70 * S;
  let dy = 0;
  let dx = 0;
  let squash = 0;
  let floatK = 1;
  if (op && t < op.end + 1) {
    const u0 = op.start + op.dur * (cam.takeoffFrom ?? 0.45);
    const sp = springAt(t - u0, 9, 120);
    dy += seat * (1 - sp);
    dx -= (plan.camAt(t) - plan.camAt(op.start)) * (1 - Math.min(1, sp));
    floatK = Math.min(1, sp);
  }
  const k = plan.districtAt(t);
  const d = k >= 0 ? plan.districts[k] : undefined;
  if (d && !(fin && t >= fin.start)) {
    const lb = (t - d.start) / beat;
    if (d.def.gag === 'obstacle' && lb > 3.9 && lb < 4.9) dy -= 36 * S * Math.sin(((lb - 3.9) / 1) * Math.PI);
    if (d.def.gag === 'obstacle' && lb >= 4.9 && lb < 5.25) squash = 0.8 * Math.sin(((lb - 4.9) / 0.35) * Math.PI);
    if (d.def.gag === 'launch' && lb > d.def.gagAt && lb < d.def.gagAt + 1.2) dx += Math.sin(t * 70) * 8 * (1 - (lb - d.def.gagAt) / 1.2);
    if (d.def.gag === 'glitch' && lb > d.def.gagAt && lb < d.def.gagAt + 1.6) dx += Math.round(Math.sin(t * 60)) * 5;
  }
  const bob = Math.sin((t / (fl.period ?? 2)) * Math.PI * 2) * (fl.amp ?? 16) * floatK;
  const sway = Math.sin((t / (fl.swayPeriod ?? 4)) * Math.PI * 2) * (fl.swayAmp ?? 8) * floatK;
  let mx = mascotX + dx + sway;
  let my = (lay.mascotY as number) + dy + bob;
  let mScale = S;
  // 片尾：跟着世界缩，再从框里探出来（出框挥手）
  if (fin && ft > zoomAt - 0.05) {
    const e = springAt(ft - zoomAt, 12, 150);
    const fx = B.x0 + 120 * S;
    const fy = B.y1 - 34 * S;
    mx = mx + (fx - mx) * Math.min(1, e);
    my = my + (fy - my) * Math.min(1.05, e);
    mScale = S * (1 - 0.1 * Math.min(1, e));
  }
  const expr = exprAt(plan, t);

  // ---- 文案 ----
  const opParams = (op?.shot.params ?? {}) as Record<string, unknown>;
  const fp = (fin?.shot.params ?? {}) as Record<string, unknown>;
  const stats: Stat[] = Array.isArray(fp.stats)
    ? (fp.stats as unknown[]).filter((s): s is Stat => !!s && typeof (s as Stat).value === 'string').slice(0, 2)
    : [];
  const fdata: FinaleData = {
    stats,
    sub: str(fp.sub),
    brand: str(fp.brand) ?? str(sb.meta?.product) ?? '',
    slogan: str(fp.slogan) ?? '',
    cta: str(fp.cta),
    bye: str(fp.bye) ?? pick(lang, '下次再飞！', 'See you!'),
  };
  const product = str(sb.meta?.product) ?? '';

  // ---- 气泡 / 拟声字 ----
  const bubbleX = mascotX + 92 * S;
  const bubbleY = lay.bubbleY as number;
  const burstX = mascotX + 250 * S;
  const burstY = (lay.mascotY as number) - 80 * S;
  const holdOf = (text: string, maxEnd: number) => Math.max(0.3, Math.min(Math.max(tk.motion?.bubbleHold ?? 0.85, 0.12 * Array.from(text).length + 0.45), maxEnd));

  // 世界层（片尾缩进浏览器框）
  const worldStyle: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: geo.w, height: geo.h, transformOrigin: '0 0', transform: z > 0 ? `translate(${tx}px, ${ty}px) scale(${sc})` : undefined};
  const clipStyle: React.CSSProperties = {position: 'absolute', inset: 0, overflow: 'hidden', clipPath: z > 0 ? `inset(${B.y0 * z}px ${(geo.w - B.x1) * z}px ${(geo.h - B.y1) * z}px ${B.x0 * z}px round ${clipR}px)` : undefined};

  // 附近的街区才画（前后各一个）
  const near = plan.districts.filter((x) => Math.abs(x.k - Math.max(0, k)) <= 2);

  // 美术城市：世界单位 = 前景层像素 / 缩放；街区首尾相接（plan 已按街区校准了巡航速度）
  const C = plan.city;
  const camX = plan.camAt(t) / C.scale;
  const layout: CityLayout = {districts: C.kinds.map((kind, i) => ({kind, x0: C.x0 + i * C.districtW, words: plan.districts[i]?.words})), start: 0, end: C.x0 + (C.kinds.length + 2) * C.districtW, districtW: C.districtW};
  const gags: Record<number, number | undefined> = {};
  plan.districts.forEach((x) => {
    const gt = x.start + x.def.gagAt * beat;
    // 美术火箭点火后抖 0.35 秒才升空：让升空那一刻落在笑点拍上
    gags[x.k] = x.def.gag === 'launch' ? t - gt + 0.35 : t - gt;
  });
  const skyP = plan.skyP(t);
  const city = (layer: 'back' | 'front') => (
    <CityWorld w={geo.w} h={geo.h} horizonY={lay.groundY as number} camX={camX} t={t} layout={layout} scale={C.scale} sky={skyP} parallax={{far: cam.parallax?.artFar ?? 0.12, mid: cam.parallax?.artMid ?? 0.55}} gags={gags} layer={layer} skyline={plan.skyline} />
  );

  return (
    <>
      <div style={clipStyle}>
        <div style={worldStyle}>
          {city('back')}
          {near.map((x) => (
            <Billboard key={`b${x.k}`} w={w} d={x} textOn={textOn} />
          ))}
          {city('front')}
          {op ? <StartPad w={w} seatY={(lay.mascotY as number) + seat + 30 * S} /> : null}
          {near.map((x) => (
            <Props key={`p${x.k}`} w={w} d={x} textOn={textOn} />
          ))}
          {near.map((x) => (
            <Sign key={`s${x.k}`} w={w} d={x} textOn={textOn} />
          ))}
        </div>
      </div>
      {/* 被熏黑时角色周围的烟 */}
      {d && d.def.gag === 'launch' ? <SootCloud w={w} x={mx} y={my - 90 * S} t0={d.start + d.def.gagAt * beat} /> : null}
      {fin && ft > 0 && ft < 1.6 ? <Fireworks w={w} t0={fin.start} /> : null}
      <div style={{position: 'absolute', left: mx, top: my, width: 0, height: 0, transform: `scale(${mScale})`}}>
        <Rider expr={expr} t={t} size={300} ink={pal.ink} brand={pal.brand} squash={squash} speed={Math.min(1, plan.speedAt(t) / (cam.cruisePxPerSec ?? 553))} night={nightOf(skyP)} />
      </div>
      {d ? <BuddyBird w={w} d={d} /> : null}
      {d && d.def.gag === 'help' ? <Sparkles w={w} t0={d.start + d.def.burstAt * beat} t1={d.start + 6.6 * beat} cx={mx} cy={my - 90 * S} r={150 * S} /> : null}
      {d && d.def.gag === 'glow' ? <Sparkles w={w} t0={d.start + d.def.gagAt * beat} t1={d.start + 6.2 * beat} cx={mx} cy={my - 110 * S} r={170 * S} /> : null}
      {d && d.def.gag === 'pose' ? <Sparkles w={w} t0={d.start + (d.def.gagAt + 0.1) * beat} t1={d.start + 6 * beat} cx={mx} cy={my - 100 * S} r={140 * S} /> : null}
      {/* 开场口令 */}
      {op ? <Bubble w={w} text={str(opParams.go) ?? pick(lang, '出发！', "Let's go!")} t0={op.start + beat} hold={Math.min(0.9, op.dur * 0.45)} x={bubbleX} y={bubbleY} /> : null}
      {plan.districts.map((x) => {
        if (Math.abs(x.k - k) > 1) return null;
        const bAt = x.start + x.def.bubbleAt * beat;
        const hold = holdOf(x.bubble, (7 - x.def.bubbleAt) * beat - 0.15);
        return (
          <React.Fragment key={`fx${x.k}`}>
            <Burst w={w} word={x.burst} tone={x.def.burstTone} t0={x.start + x.def.burstAt * beat} x={burstX} y={burstY} />
            <Bubble w={w} text={x.bubble} t0={bAt} hold={hold} x={bubbleX} y={bubbleY} />
          </React.Fragment>
        );
      })}
      {fin && ft > zoomAt + zd ? <Bubble w={w} text={fdata.bye} t0={fin.start + zoomAt + zd + 0.35} hold={fin.dur} x={B.x0 + 210 * S} y={B.y1 - 150 * S} /> : null}
      {op ? <HookTitle w={w} kicker={str(opParams.kicker)} headline={str(opParams.headline) ?? ''} t0={op.start} dur={op.dur} /> : null}
      <Hud w={w} product={product} hide={hudHide} />
      <Flash w={w} />
      {fin ? <Finale w={w} data={fdata} t0={fin.start} dur={fin.dur} /> : null}
    </>
  );
};

/** 摄影棚街区的闪光：整屏白闪 0.18 秒 */
const Flash: React.FC<{w: World}> = ({w}) => {
  const k = w.plan.districtAt(w.t);
  const d = k >= 0 ? w.plan.districts[k] : undefined;
  if (!d || d.def.gag !== 'pose') return null;
  const lb = (w.t - d.start) / w.plan.beat;
  let o = 0;
  for (const f of [d.def.gagAt, d.def.gagAt + 1]) {
    const dt = (lb - f) * w.plan.beat;
    if (dt >= 0 && dt < 0.18) o = Math.max(o, 0.42 * (1 - dt / 0.18));
  }
  return o > 0 ? <div style={{position: 'absolute', inset: 0, background: '#FFFFFF', opacity: o}} /> : null;
};

const SootCloud: React.FC<{w: World; x: number; y: number; t0: number}> = ({w, x, y, t0}) => {
  const lt = w.t - t0;
  if (lt < 0.05 || lt > 1.4) return null;
  const p = clamp01(lt / 0.35);
  const fade = 1 - clamp01((lt - 0.7) / 0.7);
  const S = (w.lay.mascotScale ?? 1) as number;
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
      {Array.from({length: 9}, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const r = (60 + 60 * p) * S;
        return <circle key={i} cx={x + Math.cos(a) * r * 1.2 + lt * 60} cy={y + Math.sin(a) * r * 0.7 - lt * 40} r={(36 + 30 * p) * S} fill="#E4DFD8" stroke="rgba(31,25,26,0.35)" strokeWidth={3} opacity={0.9 * fade} />;
      })}
    </svg>
  );
};

export const RIDER_HEAD = RIDER_TOP;
