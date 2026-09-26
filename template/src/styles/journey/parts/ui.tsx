import React from 'react';
import {Easing, spring} from 'remotion';
import {FPS} from '../../../core/safe';
import {fitSize, glueBreaks} from '../../../core/fit';
import {starPath} from './rider';
import type {World} from './city';
import {mixHex, tint} from './city';
import type {District} from './plan';

// ============================================================
// 界面元件：钩子大字、顶部 UI 带（品牌胶囊 + 类别胶囊 + 进度点 + 昼夜小图标）、广告牌、路牌、气泡、拟声字。
// 世界里的字（广告牌、路牌、道具上的字）跟着所在层滚动；为了「任何时刻截图都不出现半截字」，
// 字只在完整落在卡片区（geo.card）里时显示：广告牌在完全进画后弹出内容、出画前收起；路牌和道具字贴边淡出。
// ============================================================
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const springAt = (dt: number, damping = 12, stiffness = 200) => (dt < 0 ? 0 : spring({frame: Math.round(dt * FPS), fps: FPS, config: {damping, stiffness}}));

/** 贴边淡出：文字框 [x0,x1] 完全在画面里（离边 ≥ fadePx）= 1，碰到画面边就是 0——不出现被画框切掉的半截字 */
export const edgeFade = (w: World, x0: number, x1: number) => {
  const f: number = w.tk.motion?.edgeFadePx ?? 48;
  // 按卡片区淡出（9:16 两侧有平台按钮，卡片区 x150–930；4:5 是 x90–990）：世界里的字只在卡片区里完整显示
  const c = w.geo.card;
  return clamp01((x0 - c.x0 + 4) / f) * clamp01((c.x1 + 4 - x1) / f);
};

/** 粗略字宽（px）：汉字 1em，其余 0.56em */
export const textW = (s: string, size: number) => {
  let n = 0;
  for (const ch of Array.from(s)) n += /[⺀-鿿＀-￯　-〿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.56;
  return n * size;
};

// ---------------- 钩子大字 ----------------
export const HookTitle: React.FC<{w: World; kicker?: string; headline: string; t0: number; dur: number}> = ({w, kicker, headline, t0, dur}) => {
  const m = w.tk.motion ?? {};
  const ty = w.tk.type ?? {};
  const lt = w.t - t0;
  const outAt = dur * (m.hookOutAt ?? 0.9);
  const pin = springAt(lt, 11, 260);
  const from: number = m.hookFrom ?? 0.86;
  const out = clamp01((lt - outAt) / (m.hookOut ?? 0.15));
  if (out >= 1) return null;
  const s = (from + (1 - from) * pin) * (1 - out * 0.6);
  const size = fitSize(headline, w.geo.card.x1 - w.geo.card.x0 - 40, ty.hookHeadline ?? 124, 72, 0);
  const ink = w.pal.ink;
  const sw: number = w.tk.outline?.hook ?? 5;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: w.lay.hookKickerY, textAlign: 'center', opacity: 1 - out}}>
      {kicker ? (
        <div style={{fontSize: ty.hookKicker ?? 48, fontWeight: w.tk.font?.bodyWeight ?? 500, color: ink, lineHeight: 1.2, transform: `scale(${0.96 + 0.04 * pin})`}}>{kicker}</div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: w.lay.hookHeadlineY - w.lay.hookKickerY,
          fontSize: size,
          fontWeight: w.tk.font?.displayWeight ?? 900,
          lineHeight: 1.12,
          color: w.pal.brand,
          WebkitTextStroke: `${sw * 2}px ${ink}`,
          paintOrder: 'stroke fill',
          textShadow: `${sw}px ${sw + 2}px 0 ${ink}`,
          transform: `scale(${s})`,
          transformOrigin: '50% 60%',
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em',
        } as React.CSSProperties}
      >
        {headline}
      </div>
    </div>
  );
};

// ---------------- 顶部 UI 带 ----------------
export const Hud: React.FC<{w: World; product: string; hide: number}> = ({w, product, hide}) => {
  const {plan, t, pal, tk, geo, lay} = w;
  const k = plan.districtAt(t);
  const d = k >= 0 ? plan.districts[k] : undefined;
  const ty = tk.type ?? {};
  const swap = d ? clamp01((t - d.start) / (tk.motion?.hudSwap ?? 0.13)) : 0;
  const bump = d ? Math.sin(swap * Math.PI) * 0.12 : 0;
  const ink = pal.ink;
  const op = 1 - hide;
  const n = plan.districts.length;
  const brandSize: number = ty.brandPill ?? 30;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      {product ? (
        <div style={{position: 'absolute', left: geo.safe.x0, top: lay.hud, height: 58, padding: '0 24px', borderRadius: 999, background: pal.brand, color: pal.brandInk, border: `3.5px solid ${ink}`, fontSize: fitSize(product, 360, brandSize, 26, 0), fontWeight: 600, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', boxSizing: 'border-box'}}>
          {product}
        </div>
      ) : null}
      {d && d.category ? (
        <div style={{position: 'absolute', right: geo.w - geo.safe.x1, top: lay.hud - 2, height: 62, padding: '0 26px 0 20px', borderRadius: 999, background: pal.card, border: `3.5px solid ${ink}`, display: 'flex', alignItems: 'center', gap: 12, fontSize: ty.hud ?? 34, fontWeight: 600, color: ink, whiteSpace: 'nowrap', transform: `scale(${1 + bump})`, transformOrigin: '100% 50%', boxSizing: 'border-box'}}>
          <span style={{display: 'inline-block', width: 18, height: 18, borderRadius: 9, background: d.color, border: `3px solid ${ink}`}} />
          {d.category}
        </div>
      ) : null}
      {n > 1 && d ? (
        <div style={{position: 'absolute', right: geo.w - geo.safe.x1, top: lay.dotsY, display: 'flex', alignItems: 'center', gap: 12}}>
          <DayIcon w={w} />
          {plan.districts.map((x) => (
            <div key={x.k} style={{width: x.k === k ? 30 : 14, height: 14, borderRadius: 7, background: x.k === k ? x.color : x.k < k ? mixHex(ink, '#FFFFFF', 0.55) : '#D7D5CF', border: x.k === k ? `2.5px solid ${ink}` : 'none', boxSizing: 'border-box'}} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** 昼夜小图标：白天太阳、黄昏半落、夜里月亮 */
const DayIcon: React.FC<{w: World}> = ({w}) => {
  const k = w.plan.districtAt(w.t);
  const ph = k >= 0 ? w.plan.districts[k].phase : 'day';
  const ink = w.pal.ink;
  return (
    <svg width={30} height={30} viewBox="-15 -15 30 30" style={{marginRight: 4}}>
      {ph === 'night' ? (
        <path d="M4 -11 A11 11 0 1 0 11 5 A9 9 0 1 1 4 -11 Z" fill={w.pal.windowLight} stroke={ink} strokeWidth={2.5} />
      ) : (
        <g>
          <circle r={ph === 'dusk' ? 8 : 7} fill={ph === 'dusk' ? '#F28C5B' : '#FFC93C'} stroke={ink} strokeWidth={2.5} />
          {ph !== 'dusk' ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1={Math.cos((i * Math.PI) / 4) * 10} y1={Math.sin((i * Math.PI) / 4) * 10} x2={Math.cos((i * Math.PI) / 4) * 13.5} y2={Math.sin((i * Math.PI) / 4) * 13.5} stroke={ink} strokeWidth={2} strokeLinecap="round" />) : <line x1={-14} x2={14} y1={3} y2={3} stroke={ink} strokeWidth={2.5} />}
        </g>
      )}
    </svg>
  );
};

// ---------------- 广告牌 ----------------
/** 广告牌中心的「自然」屏幕 x：跟广告牌层（parallax.board）滚动，第 boardReadBeat 拍在 boardReadX 处 */
const boardNatX = (w: World, d: District, t: number) => {
  const cam = w.tk.camera ?? {};
  const f: number = cam.parallax?.board ?? 0.55;
  const tRead = d.start + (cam.boardReadBeat ?? 2.5) * w.plan.beat;
  const center = w.plan.camAt(tRead) * f + w.geo.w * (cam.boardReadX ?? 0.6);
  return center - w.plan.camAt(t) * f;
};

/**
 * 广告牌中心在屏幕上的 x：文字框（牌面宽 − 两侧留白）必须整块落在安全区 geo.safe（9:16 是 x180–900）里。
 * 自然位置在安全区右边时钳在右沿（牌子就在这里升起），随后跟着视差往左滚，滚到左沿就停住，直到收起——
 * 标题从弹出到收起一直完整可读（以前只在「整块进画」的约 1–1.5 秒里显示，9:16 还会滑到 x≈35）
 */
export const boardX = (w: World, d: District, t: number) => {
  const inner = (w.lay.boardW as number) - 72;
  const lo = w.geo.safe.x0 + inner / 2;
  const hi = w.geo.safe.x1 - inner / 2;
  if (lo > hi) return (w.geo.safe.x0 + w.geo.safe.x1) / 2;
  return Math.min(hi, Math.max(lo, boardNatX(w, d, t)));
};

/**
 * 广告牌节拍：第 boardRiseBeat 拍从前景楼后面升起，boardTextDelay 秒后文字就弹出（边升边出字，不出现「立着一块空牌子」），
 * 第 boardFoldBeat 拍收起再沉下去（逐站升起、逐站收起）
 */
export const boardTimes = (w: World, d: District) => {
  const cam = w.tk.camera ?? {};
  const rise = d.start + (cam.boardRiseBeat ?? 0.3) * w.plan.beat;
  const tin = rise + (w.tk.motion?.boardTextDelay ?? 0.12);
  const tout = d.start + (cam.boardFoldBeat ?? 7.2) * w.plan.beat;
  return {rise, tin, tout};
};
export const Billboard: React.FC<{w: World; d: District; textOn: number}> = ({w, d, textOn}) => {
  const {t, pal, tk, lay} = w;
  const [y0, y1] = lay.board as [number, number];
  const W0: number = lay.boardW;
  const cx = boardX(w, d, t);
  if (cx + W0 / 2 < -60 || cx - W0 / 2 > w.geo.w + 60) return null;
  const ink = pal.ink;
  const ty = tk.type ?? {};
  const pad = 36;
  const inner = W0 - pad * 2;
  const {rise, tin, tout} = boardTimes(w, d);
  const m = tk.motion ?? {};
  const pin = springAt(t - tin, 13, 210);
  const fold = clamp01((t - (tout - (m.boardFold ?? 0.12))) / (m.boardFold ?? 0.12));
  const show = Math.min(pin, 1 - fold) * textOn;
  // 广告牌本身也逐站升起 / 落下：从前景楼后面升上来，收字后 0.3 秒沉回楼后，下一站的牌子紧接着升起
  const up = Math.min(springAt(t - rise, 14, 170), 1 - Easing.inOut(Easing.cubic)(clamp01((t - tout) / 0.3)));
  const sinkY = (1 - up) * (lay.groundY - y0 + 30);
  if (up <= 0.001) return null;
  const phase = d.phase;
  const titleSize = Math.max(ty.boardTitleMin ?? 40, Math.min(ty.boardTitle ?? 46, fitSize(d.title, (inner - 40) * 2 - 60, ty.boardTitle ?? 46, ty.boardTitleMin ?? 40, 0)));
  // 外形跟美术的 Billboard 一致：顶部类别色带（白点 + 类别名 + 右侧标签）、白底标题、单根粗立柱 + 横撑、两盏仰射灯；夜里灯打亮
  const night = phase === 'night' ? 1 : phase === 'dusk' ? 0.3 : 0;
  const post = tint(mixHex(d.color, ink, 0.35), phase);
  const band = tint(d.color, phase);
  // 霓虹街（glitch）的广告牌是一块霓虹牌：深底、发光描边和发光字；笑点窗口里横向错位 + 红青分色 + 闪（角色被晃成螺旋眼）
  const neon = d.def.gag === 'glitch';
  const lb = (t - d.start) / w.plan.beat;
  const glitch = neon && lb >= d.def.gagAt && lb < d.def.gagAt + 1.6;
  const jx = glitch ? Math.round(Math.sin(t * 90) * 12) : 0;
  const flick = glitch && Math.floor(t * 20) % 3 === 0 ? 0.55 : 1;
  const glow = (c: string) => `0 0 8px ${c}, 0 0 22px ${c}`;
  const card = neon ? '#141833' : night > 0.5 ? mixHex(pal.card, '#FFF6DA', 0.45) : pal.card;
  const titleColor = neon ? mixHex(pal.neonB, '#FFFFFF', 0.55) : ink;
  const titleShadow = neon ? (glitch ? `-6px 0 ${pal.neonA}, 6px 0 ${pal.neonB}` : glow(pal.neonB)) : undefined;
  const chip: number = ty.boardChip ?? 28;
  const bandH = Math.round(chip * 1.9);
  const H0 = y1 - y0;
  const postH = lay.groundY - y1;
  return (
    <div style={{position: 'absolute', left: cx - W0 / 2, top: y0 + sinkY, width: W0, height: H0}}>
      {/* 单根立柱 + 横撑：一直伸到地平线，被近景楼挡住下半截 */}
      <div style={{position: 'absolute', left: W0 / 2 - 22, top: H0 - 10, width: 44, height: postH + 10, background: post, border: `4px solid ${ink}`, borderRadius: 10, boxSizing: 'border-box'}} />
      <div style={{position: 'absolute', left: W0 * 0.22, top: H0 + 16, width: W0 * 0.56, height: 18, background: post, border: `4px solid ${ink}`, borderRadius: 9, boxSizing: 'border-box'}} />
      {night > 0.05
        ? [0.25, 0.75].map((f) => (
            <div key={`g${f}`} style={{position: 'absolute', left: W0 * f - 110, top: -30, width: 220, height: H0 + 60, background: `linear-gradient(to top, rgba(255,240,170,${0.5 * night}), rgba(255,240,170,0))`, clipPath: 'polygon(40% 100%, 60% 100%, 100% 0, 0 0)'}} />
          ))
        : null}
      <div style={{position: 'absolute', inset: 0, background: card, border: `5px solid ${ink}`, borderRadius: tk.radius?.billboard ?? 24, boxSizing: 'border-box', overflow: 'hidden', opacity: flick, boxShadow: night > 0.5 ? `0 0 26px ${mixHex(d.color, '#FFFFFF', 0.3)}` : '0 8px 0 rgba(31,25,26,0.18)'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: bandH, background: band, borderBottom: `5px solid ${ink}`}} />
        {neon ? <div style={{position: 'absolute', left: 12, right: 12, top: bandH + 10, bottom: 12, border: `5px solid ${pal.neonA}`, borderRadius: 16, boxShadow: `${glow(pal.neonA)}, inset ${glow(pal.neonA)}`}} /> : null}
      </div>
      {[0.25, 0.75].map((f) => (
        <div key={`l${f}`} style={{position: 'absolute', left: W0 * f - 22, top: H0 - 4, width: 44, height: 26, background: tint('#4A5270', phase), border: `4px solid ${ink}`, borderRadius: '8px 8px 14px 14px', boxSizing: 'border-box'}} />
      ))}
      <div style={{position: 'absolute', left: 26, right: 26, top: 0, height: bandH, opacity: show, display: show > 0.01 ? 'flex' : 'none', alignItems: 'center', gap: 14}}>
        <span style={{display: 'inline-block', width: chip * 0.5, height: chip * 0.5, borderRadius: '50%', background: '#FFFFFF', border: `3px solid ${ink}`, flex: 'none'}} />
        <span style={{fontSize: chip, fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap', lineHeight: 1.2, letterSpacing: 1}}>{d.category}</span>
        {d.tag ? <span style={{marginLeft: 'auto', display: 'inline-block', padding: '2px 16px', borderRadius: 999, background: '#FFFFFF', color: ink, border: `3px solid ${ink}`, fontSize: chip, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap'}}>{d.tag}</span> : null}
      </div>
      <div style={{position: 'absolute', left: pad, right: pad, top: bandH + 12, bottom: 16, opacity: show * flick, transform: `translateX(${jx}px) scale(${0.8 + 0.2 * show})`, transformOrigin: '50% 30%', display: show > 0.01 ? 'flex' : 'none', flexDirection: 'column', justifyContent: 'center', gap: 6}}>
        <div style={{fontSize: titleSize, lineHeight: 1.26, fontWeight: tk.font?.strongWeight ?? 700, color: titleColor, textShadow: titleShadow, wordBreak: 'normal'}}>
          {glueBreaks(d.title, w.lang)}
        </div>
        {d.source ? <div style={{fontSize: ty.boardSource ?? 26, fontWeight: 600, color: neon ? '#C9CDE8' : pal.inkSoft, whiteSpace: 'nowrap', lineHeight: 1.3}}>{d.source}</div> : null}
      </div>
    </div>
  );
};

// ---------------- 路牌（前景层，第 0 拍经过角色） ----------------
export const Sign: React.FC<{w: World; d: District; textOn: number}> = ({w, d, textOn}) => {
  const {plan, t, pal, tk, lay} = w;
  const x = plan.camAt(d.start) + w.mascotX - plan.camAt(t);
  const size: number = tk.type?.sign ?? 44;
  const tw = textW(d.category, size);
  // 外形跟美术的 WaySign 一致：类别色箭头牌指向前进方向，立柱在左（立柱 = 街区分界，第 0 拍经过角色），下挂「第几站」小牌
  const bw = Math.max(230, tw + 90);
  const tip = 44;
  if (x + bw + tip < -40 || x - 40 > w.geo.w + 40) return null;
  const [y0, y1] = lay.sign as [number, number];
  const H = y1 - y0;
  const ink = pal.ink;
  const post = tint('#5A6178', d.phase);
  const fill = tint(d.color, d.phase);
  const tx0 = x - 10;
  const op = edgeFade(w, tx0 + 20, tx0 + 20 + tw) * textOn;
  const n = plan.districts.length;
  const badge = `${d.k + 1} / ${n}`;
  const bop = edgeFade(w, tx0 + 40, tx0 + 40 + textW(badge, 30)) * textOn;
  return (
    <div style={{position: 'absolute', left: tx0, top: y0, width: bw + tip, height: H}}>
      <div style={{position: 'absolute', left: -2, top: H / 2, width: 24, height: lay.groundY - y0 - H / 2, background: post, border: `4px solid ${ink}`, borderRadius: 8, boxSizing: 'border-box'}} />
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={bw + tip} height={H}>
        <path d={`M 12,4 L ${bw},4 L ${bw + tip},${H / 2} L ${bw},${H - 4} L 12,${H - 4} Q 4,${H - 4} 4,${H - 12} L 4,12 Q 4,4 12,4 Z`} fill={fill} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d={`M 18,15 L ${bw - 8},15`} stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.35} />
      </svg>
      <div style={{position: 'absolute', left: 24, top: 0, height: H, display: 'flex', alignItems: 'center', fontSize: size, fontWeight: 900, color: '#FFFFFF', whiteSpace: 'nowrap', opacity: op, lineHeight: 1.1, textShadow: `0 3px 0 ${mixHex(d.color, ink, 0.5)}`}}>{d.category}</div>
      <div style={{position: 'absolute', left: 40, top: H + 10, padding: '0 14px', background: '#FFFFFF', border: `4px solid ${ink}`, borderRadius: 12, fontSize: 30, fontWeight: 800, color: ink, whiteSpace: 'nowrap', lineHeight: 1.25}}>
        <span style={{opacity: bop}}>{badge}</span>
      </div>
    </div>
  );
};

// ---------------- 气泡（角色台词） ----------------
export const Bubble: React.FC<{w: World; text: string; t0: number; hold: number; x: number; y: number}> = ({w, text, t0, hold, x, y}) => {
  const {t, pal, tk} = w;
  const m = tk.motion ?? {};
  const lt = t - t0;
  const inS: number = m.bubbleIn ?? 0.1;
  const outS: number = m.bubbleOut ?? 0.1;
  if (lt < 0 || lt > hold + outS) return null;
  const pin = lt < inS ? lt / inS : 1;
  const k = springAt(lt, 10, 260);
  const out = clamp01((lt - hold) / outS);
  const s = (0.6 + 0.4 * Math.min(1.08, k)) * (1 - 0.3 * out);
  const size: number = tk.type?.bubble ?? 40;
  const maxW = w.geo.card.x1 - x - 10;
  const fs = fitSize(text, maxW - 56, size, 34, 0);
  const ink = pal.ink;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: Math.min(pin * 2, 1) * (1 - out), transform: `scale(${s})`, transformOrigin: '0% 100%'}}>
      <div style={{position: 'relative', padding: '12px 28px', background: pal.card, border: `3.5px solid ${ink}`, borderRadius: tk.radius?.bubble ?? 22, fontSize: fs, fontWeight: 600, color: ink, whiteSpace: 'nowrap', lineHeight: 1.25, boxShadow: '0 6px 0 rgba(31,25,26,0.12)'}}>
        {text}
        <svg style={{position: 'absolute', left: 18, bottom: -24, overflow: 'visible'}} width={34} height={26}>
          <path d="M2 -2 L10 22 L30 -2" fill={pal.card} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};

// ---------------- 拟声字（爆炸框） ----------------
export const Burst: React.FC<{w: World; word: string; tone: 'yellow' | 'blue' | 'gray'; t0: number; x: number; y: number}> = ({w, word, tone, t0, x, y}) => {
  const {t, pal, tk} = w;
  const m = tk.motion ?? {};
  const lt = t - t0;
  const inS: number = m.burstIn ?? 0.07;
  const hold: number = m.burstHold ?? 0.42;
  if (lt < 0 || lt > inS + hold) return null;
  const p = clamp01(lt / inS);
  const over = p < 1 ? p * 1.15 : 1 + 0.08 * Math.exp(-(lt - inS) * 18) * Math.sin((lt - inS) * 40);
  const rot = -8 - 15 * (1 - p);
  const size: number = tk.type?.burst ?? 46;
  const tw = textW(word, size);
  const R = Math.max(96, tw / 2 + 50);
  const fill = tone === 'blue' ? pal.burstBlue : tone === 'gray' ? pal.burstGray : pal.burstYellow;
  const ink = pal.ink;
  const spikes = 12;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i * Math.PI) / spikes;
    const rr = i % 2 ? R * 0.72 : R;
    pts.push(`${(Math.cos(a) * rr * 1.08).toFixed(1)} ${(Math.sin(a) * rr * 0.72).toFixed(1)}`);
  }
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0, transform: `rotate(${rot}deg) scale(${over})`}}>
      <svg style={{position: 'absolute', left: -R * 1.2, top: -R, overflow: 'visible'}} width={R * 2.4} height={R * 2}>
        <path d={`M${pts.join(' L')} Z`} transform={`translate(${R * 1.2} ${R})`} fill={fill} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      </svg>
      <div style={{position: 'absolute', left: -R, width: R * 2, top: -size * 0.66, textAlign: 'center', fontSize: size, fontWeight: 800, color: ink, whiteSpace: 'nowrap', lineHeight: 1.3}}>{word}</div>
    </div>
  );
};

/** 闪光小星（放在角色周围） */
export const Sparkles: React.FC<{w: World; t0: number; t1: number; cx: number; cy: number; r: number}> = ({w, t0, t1, cx, cy, r}) => {
  const lt = w.t - t0;
  if (lt < 0 || w.t > t1) return null;
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
      {Array.from({length: 7}, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const pulse = Math.max(0, Math.sin(lt * 9 + i * 1.7));
        const rr = r * (0.85 + 0.25 * Math.sin(i * 3.1));
        return <path key={i} d={starPath(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, 16 * pulse + 4, (16 * pulse + 4) * 0.42)} fill="#FFD84A" stroke={w.pal.ink} strokeWidth={3} strokeLinejoin="round" />;
      })}
    </svg>
  );
};
