import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {pick} from '../../core/kit';
import {FPS} from '../../core/safe';
import {useStylePalette, useStyleTokens} from '../context';
import type {FilmProps} from '../types';
import {CityWorld, nightOf} from './art';
import type {CityLayout} from './art/World';
import type {World} from './parts/city';
import {Finale, FinaleData, Stat, sealWordOf, stampCardRect} from './parts/outro';
import {buildPlan, exprAt} from './parts/plan';
import {GagFx, Props, StartPad} from './parts/props';
import {RIDER_TOP, Rider} from './parts/rider';
import {Bubble, Burst, HookTitle, Postcard, RouteTicket, Sign, Sparkles, clamp01, springAt} from './parts/ui';

// ============================================================
// journey 整片渲染器：一镜到底。分镜里的镜头只当数据（opening = 钩子，district = 一个街区，finale = 片尾），
// 世界剧本（相机曲线、各元件的世界坐标、笑点时刻）由 parts/plan.ts 先算好，这里逐帧按层画出来：
//   天空 → 远景 → 云 → 中景楼 → 街面 → 前景楼 → 道具 → 路牌   （以上是「世界」，片尾停在终点、压暗，不缩框）
//   → 片尾集章卡 → 角色（屏幕锁定，片尾跳到集章卡右下角）→ 笑点特效（贴纸、车票、相片条、搭车的刺猬…）→ 气泡 / 拟声字 → 明信片 → 开场翻牌大字 → 顶部车票
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

  // ---- 片尾：停在终点，城市压暗，集章卡升起（世界本身不缩、不换画面） ----
  const fin = plan.finale;
  const ft = fin ? t - fin.start : -1;
  const textOn = fin ? 1 - clamp01((ft - 0.3) / 0.2) : 1;
  const hudHide = fin ? clamp01((ft - 0.2) / 0.3) : 0;

  // ---- 角色位置 ----
  const op = plan.opening;
  const seat = 70 * S;
  let dy = 0;
  let dx = 0;
  let squash = 0;
  let mRot = 0;
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
    // 道口：3.2–5.4 拍整个角色后仰「下腰」从横杆下滑过（绕滑板中心转），过杆后回正、落地一下
    if (d.def.gag === 'duck') {
      const k = clamp01((lb - 3.2) / 0.3) * (1 - clamp01((lb - 5.1) / 0.3));
      mRot = -32 * k;
      dy += 26 * S * k;
      if (lb >= 5.4 && lb < 5.7) squash = 0.5 * Math.sin(((lb - 5.4) / 0.3) * Math.PI);
    }
  }
  const bob = Math.sin((t / (fl.period ?? 2)) * Math.PI * 2) * (fl.amp ?? 16) * floatK;
  const sway = Math.sin((t / (fl.swayPeriod ?? 4)) * Math.PI * 2) * (fl.swayAmp ?? 8) * floatK;
  let mx = mascotX + dx + sway;
  let my = (lay.mascotY as number) + dy + bob;
  let mScale = S;
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
    bye: str(fp.bye) ?? pick(lang, '下一班见', 'Next ride soon!'),
    seal: sealWordOf(lang),
  };
  const product = str(sb.meta?.product) ?? '';
  // 片尾：角色一跳落到集章卡右下角（卡外），转身朝左看着卡片欢呼
  const SC = stampCardRect(w, fdata);
  const fx = SC.x1 - 110 * S;
  const fy = SC.y1 + 250 * S;
  if (fin && ft > 0.25) {
    const e = springAt(ft - 0.25, 12, 140);
    const hop = Math.sin(Math.min(1, (ft - 0.25) / 0.5) * Math.PI) * 120 * S;
    mx = mx + (fx - mx) * Math.min(1, e);
    my = my + (fy - my) * Math.min(1.05, e) - hop;
    mScale = S * (1 - 0.08 * Math.min(1, e));
  }

  // ---- 气泡 / 拟声字 ----
  const bubbleX = mascotX + 92 * S;
  const bubbleY = lay.bubbleY as number;
  const burstX = mascotX + 250 * S;
  const burstY = (lay.mascotY as number) - 80 * S;
  const holdOf = (text: string, maxEnd: number) => Math.max(0.3, Math.min(Math.max(tk.motion?.bubbleHold ?? 0.85, 0.12 * Array.from(text).length + 0.45), maxEnd));

  const worldStyle: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: geo.w, height: geo.h};
  const clipStyle: React.CSSProperties = {position: 'absolute', inset: 0, overflow: 'hidden'};

  // 附近的街区才画（前后各一个）
  const near = plan.districts.filter((x) => Math.abs(x.k - Math.max(0, k)) <= 2);

  // 美术城市：世界单位 = 前景层像素 / 缩放；街区首尾相接（plan 已按街区校准了巡航速度）
  const C = plan.city;
  const camX = plan.camAt(t) / C.scale;
  const layout: CityLayout = {districts: C.kinds.map((kind, i) => ({kind, x0: C.x0 + i * C.districtW, words: plan.districts[i]?.words})), start: 0, end: C.x0 + (C.kinds.length + 2) * C.districtW, districtW: C.districtW};
  const gags: Record<number, number | undefined> = {};
  plan.districts.forEach((x) => {
    const gt = x.start + x.def.gagAt * beat;
    // 美术城市按 gagT 演自己的部分（邮筒楼投信口翻开、柱状图长高、灯笼亮起）
    gags[x.k] = t - gt;
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
      {fin ? <Finale w={w} data={fdata} t0={fin.start} dur={fin.dur} /> : null}
      <div style={{position: 'absolute', left: mx, top: my, width: 0, height: 0, transform: `scale(${mScale}) rotate(${mRot}deg)`}}>
        <Rider expr={expr} t={t} size={300} ink={pal.ink} brand={pal.brand} squash={squash} speed={Math.min(1, plan.speedAt(t) / (cam.cruisePxPerSec ?? 553))} night={nightOf(skyP)} facing={fin && ft > 0.25 ? 'left' : 'right'} />
      </div>
      {near.map((x) => (Math.abs(x.k - k) <= 1 ? <GagFx key={`g${x.k}`} w={w} d={x} mx={mx} my={my} /> : null))}
      {d && (d.def.gag === 'sticker' || d.def.gag === 'punch' || d.def.gag === 'seal') ? <Sparkles w={w} t0={d.start + (d.def.gagAt + 0.5) * beat} t1={d.start + 6.2 * beat} cx={mx} cy={my - 90 * S} r={150 * S} /> : null}
      {d && (d.def.gag === 'glow' || d.def.gag === 'lamps') ? <Sparkles w={w} t0={d.start + d.def.gagAt * beat} t1={d.start + 6.2 * beat} cx={mx} cy={my - 110 * S} r={170 * S} /> : null}
      {d && d.def.gag === 'strip' ? <Sparkles w={w} t0={d.start + (d.def.gagAt + 0.5) * beat} t1={d.start + 6 * beat} cx={mx} cy={my - 100 * S} r={140 * S} /> : null}
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
      {fin && ft > (tk.motion?.sealAt ?? 2) ? <Bubble w={w} text={fdata.bye} t0={fin.start + (tk.motion?.sealAt ?? 2) + 0.3} hold={fin.dur} x={fx - 130 * S} y={fy - 200 * S} anchor="right" /> : null}
      {near.map((x) => (
        <Postcard key={`c${x.k}`} w={w} d={x} textOn={textOn} />
      ))}
      {op ? <HookTitle w={w} kicker={str(opParams.kicker)} headline={str(opParams.headline) ?? ''} t0={op.start} dur={op.dur} /> : null}
      <RouteTicket w={w} product={product} hide={hudHide} />
    </>
  );
};

export const RIDER_HEAD = RIDER_TOP;
