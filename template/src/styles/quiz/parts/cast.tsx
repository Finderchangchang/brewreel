import React from 'react';
import {Avatar as ArtAvatar, Character as ArtCharacter, MediaClip, SCENES, mouthAt} from '../art';
import type {Expr, FxKind, Pose, SceneName} from '../art';
import {Sparks, popScale, prog, usePal, useTk} from './kit';

// ============================================================
// 角色与小剧场的「接口层」：镜头只从这里拿角色、头像、讲解小窗和小剧场，不直接引用 art/。
// 美术（art/）换实现时只改这个文件，镜头不动。角色：a = 主讲人（art 的 host，状态道具亮 = 懂了；钩子镜里是卡下旁白左边的讲解小窗 Presenter），
// b = 搭档（art 的 buddy）。场景：art 的 office / cafe / street / home 小剧场 + 这里的 screen（产品界面示意）。
// ============================================================

export type Who = 'a' | 'b';
const artWho = (w: Who) => (w === 'a' ? 'host' : 'buddy');

/** 站姿角色。(x, y) = 脚底中心像素；size = 身高像素 */
export const Actor: React.FC<{who: Who; x: number; y: number; size: number; t: number; lit?: boolean; talk?: [number, number] | null; facing?: 'left' | 'right'; pose?: Pose; expr?: Expr; hop?: number; scale?: number; fx?: FxKind; fxT?: number; shadow?: boolean}> = ({who, talk, lit, ...p}) => {
  const m = talk ? mouthAt(p.t, talk[0], talk[1], 6, who === 'a' ? 1 : 2) : 0;
  const speaking = !!talk && p.t >= talk[0] && p.t < talk[1];
  return <ArtCharacter who={artWho(who)} bulb={lit ? 1 : 0} mouth={m} pose={p.pose ?? (speaking ? 'talk' : 'stand')} seed={who === 'a' ? 1 : 2} {...p} />;
};

/** 圆形头像（评论框） */
export const Avatar: React.FC<{who: Who; size: number; t: number}> = ({who, size, t}) => <ArtAvatar who={artWho(who)} size={size} t={t} expr="smug" ring />;

/** 讲解小窗：主讲人的圆形画中画，停在钩子镜卡下旁白的左边，当「说话人」标（不贴媒体卡的右沿 / 右上角）。
 *  (x, y) = 圆心像素。出场是「光圈打开」：圆形裁切从 0 张到 1.08 再回到 1（0.24 秒），同时主色外环顺时针画一圈；
 *  讲解员会说话（嘴动）、耳机会亮灯（lit = 懂了）并放火花。 */
export const Presenter: React.FC<{t: number; at: number; x: number; y: number; d?: number; lit?: boolean; talk?: [number, number] | null; expr?: Expr; sparks?: number}> = ({t, at, x, y, d: dOver, lit, talk, expr, sparks}) => {
  const tk = useTk();
  const pal = usePal();
  const P = tk.layout?.presenter ?? {d: 176, ring: 8};
  const d = dOver ?? P.d;
  if (t < at) return null;
  const dur = tk.motion?.presenterIn ?? 0.24;
  const s = popScale(t, at, dur, 0, 1.08);
  const ringP = prog(t, at + dur * 0.3, 0.3);
  const R = d / 2;
  const m = talk ? mouthAt(t, talk[0], talk[1]) : 0;
  return (
    <div style={{position: 'absolute', left: x - R - P.ring, top: y - R - P.ring, width: d + P.ring * 2, height: d + P.ring * 2}}>
      <div style={{position: 'absolute', left: P.ring, top: P.ring, width: d, height: d, borderRadius: '50%', overflow: 'hidden', transform: `scale(${s})`, background: pal.cardAlt}}>
        <ArtAvatar who="host" size={d} t={t} expr={expr ?? (lit ? 'happy' : 'neutral')} mouth={m} bulb={lit ? 1 : 0} ring={false} bg={pal.cardAlt} />
      </div>
      <svg width={d + P.ring * 2} height={d + P.ring * 2} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', transform: `rotate(-90deg) scale(${Math.min(1, s)})`}}>
        <circle cx={R + P.ring} cy={R + P.ring} r={R + P.ring / 2} fill="none" stroke={pal.ink} strokeWidth={P.ring + 6} />
        <circle cx={R + P.ring} cy={R + P.ring} r={R + P.ring / 2} fill="none" stroke={pal.primary} strokeWidth={P.ring} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ringP} />
      </svg>
      {/* 小窗左下角一个朱红圆点，像直播小窗的在线灯 */}
      <div style={{position: 'absolute', left: 4, bottom: 10, width: 22, height: 22, borderRadius: 11, background: pal.pen, border: `3px solid ${pal.ink}`, transform: `scale(${Math.min(1, s)})`}} />
      {sparks !== undefined ? <Sparks t={t} at={sparks} x={R + P.ring} y={14} spread={d} /> : null}
    </div>
  );
};

/** 讲解小窗的位置（圆心）和直径：卡下左侧、旁白第一行旁边；inset 保留参数形状，不再用 */
export const presenterSpot = (box: {x: number; y: number; w: number; h: number}, inset = 36, d = 128) => {
  void inset;
  return {x: 150 + 8 + d / 2, y: box.y + box.h + 34 + 8 + d / 2, d};
};
/** 界面里的一行：有字就上真字（34px，面板字号下限），没字就是「？」占位（还没揭晓） */
const UiRow: React.FC<{text?: string; hot?: boolean; op?: number; scale?: number; done?: boolean}> = ({text, hot, op = 1, scale = 1, done}) => {
  const pal = usePal();
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', height: 72, borderBottom: `3px solid ${pal.bg}`, opacity: op, transform: `scale(${scale})`, transformOrigin: 'left center'}}>
      <div style={{width: 40, height: 40, borderRadius: 20, flexShrink: 0, background: done ? pal.highlight : hot ? pal.highlight : pal.bg, border: `3px solid ${pal.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        {done ? (
          <svg width={26} height={26} viewBox="0 0 60 60">
            <path d="M12 31 L25 44 L49 17" fill="none" stroke={pal.ink} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
      {text ? (
        <div style={{flex: 1, fontSize: 34, fontWeight: 800, color: pal.ink, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1.2}}>{text}</div>
      ) : (
        <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 12}}>
          <div style={{flex: 1, height: 16, borderRadius: 8, background: pal.bg}} />
          <div style={{fontSize: 34, fontWeight: 900, color: pal.wrong, lineHeight: 1}}>?</div>
        </div>
      )}
    </div>
  );
};

/** 产品界面示意（scene=screen）：窗口 + 标题栏 + 2–4 行真实文字（params.screenItems）；没写 screenItems 退回灰条占位 */
const ScreenUI: React.FC<{w: number; h: number; items?: string[]; jitter: number}> = ({w, h, items, jitter}) => {
  const pal = usePal();
  const list = items?.length ? items.slice(0, 4) : undefined;
  return (
    <div style={{position: 'absolute', inset: 0, background: pal.cardAlt, transform: `translateX(${jitter}px)`}}>
      <div style={{position: 'absolute', left: w * 0.08, top: h * 0.08, width: w * 0.84, height: h * 0.84, borderRadius: 22, background: pal.card, border: `5px solid ${pal.ink}`, overflow: 'hidden'}}>
        <div style={{height: 58, background: pal.primary, borderBottom: `5px solid ${pal.ink}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px'}}>
          {[0, 1, 2].map((k) => (
            <div key={k} style={{width: 16, height: 16, borderRadius: 8, background: pal.card, opacity: 0.85}} />
          ))}
        </div>
        {(list ?? ['', '', '', '']).map((r, i) => (
          <UiRow key={i} text={r || undefined} hot={i === 1} />
        ))}
      </div>
    </div>
  );
};

/** 手机演示（scene=phone）：左边手机（按住说话键 → 波形），右边 App 列表面板。
 *  phase：idle 待机（列表空）/ ask 手指按住、波形跳、列表是「？」占位（不剧透）/ show 按住 → 松手 → 列表逐条出现真字（再看一遍时揭晓）。
 *  phaseAt = 手指开始按下的时刻（秒，相对本镜） */
const PhoneDemo: React.FC<{w: number; h: number; t: number; items?: string[]; phase: 'idle' | 'ask' | 'show'; phaseAt: number}> = ({w, h, t, items, phase, phaseAt}) => {
  const pal = usePal();
  const list = (items?.length ? items : ['', '', '']).slice(0, 4);
  const pw = 220;
  const ph = h - 52;
  const px = 36;
  const py = 26;
  const btnD = 86;
  const bx = px + pw / 2;
  const by = py + ph - 70;
  const press = phase === 'idle' ? 0 : Math.max(0, Math.min(1, (t - phaseAt) / 0.25));
  const releaseAt = phase === 'show' ? phaseAt + 1.1 : Infinity;
  const released = t >= releaseAt;
  const holding = press >= 1 && !released;
  // 手指：从右下角滑到按键上，按住时按键缩一点；松手后退回去
  const back = released ? Math.min(1, (t - releaseAt) / 0.25) : 0;
  const fp = press * (1 - back);
  const fx = bx + 26 + (1 - fp) * 180;
  const fy = by + 20 + (1 - fp) * 160;
  const bars = 9;
  return (
    <div style={{position: 'absolute', inset: 0, background: pal.cardAlt}}>
      {/* 手机 */}
      <div style={{position: 'absolute', left: px, top: py, width: pw, height: ph, borderRadius: 40, background: pal.card, border: `6px solid ${pal.ink}`, overflow: 'hidden', boxSizing: 'border-box'}}>
        <div style={{position: 'absolute', left: pw / 2 - 40, top: 12, width: 80, height: 16, borderRadius: 8, background: pal.ink}} />
        {/* 波形 */}
        <div style={{position: 'absolute', left: 18, right: 18, top: ph * 0.3, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          {Array.from({length: bars}).map((_, k) => {
            const amp = holding ? 0.35 + 0.65 * Math.abs(Math.sin(t * 9 + k * 1.3) * Math.cos(t * 4.7 + k)) : 0.12;
            return <div key={k} style={{width: 12, height: 120 * amp, borderRadius: 6, background: holding ? pal.primary : pal.bg}} />;
          })}
        </div>
      </div>
      {/* 按键 + 按住时的涟漪 */}
      {holding
        ? [0, 1].map((k) => {
            const q = ((t - phaseAt) * 1.4 + k * 0.5) % 1;
            return <div key={k} style={{position: 'absolute', left: bx - btnD / 2 - q * 40, top: by - btnD / 2 - q * 40, width: btnD + q * 80, height: btnD + q * 80, borderRadius: '50%', border: `4px solid ${pal.primary}`, opacity: 1 - q, boxSizing: 'border-box'}} />;
          })
        : null}
      <div style={{position: 'absolute', left: bx - btnD / 2, top: by - btnD / 2, width: btnD, height: btnD, borderRadius: '50%', background: pal.primary, border: `5px solid ${pal.ink}`, transform: `scale(${holding ? 0.9 : 1})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'}}>
        <svg width={40} height={40} viewBox="0 0 40 40">
          <rect x={14} y={5} width={12} height={20} rx={6} fill={pal.card} stroke={pal.ink} strokeWidth={3} />
          <path d="M9 19 C9 26 14 30 20 30 C26 30 31 26 31 19 M20 30 L20 36" fill="none" stroke={pal.card} strokeWidth={3.5} strokeLinecap="round" />
        </svg>
      </div>
      {/* 手指 */}
      {phase !== 'idle' ? (
        <svg width={120} height={170} viewBox="0 0 120 170" style={{position: 'absolute', left: fx - 30, top: fy - 18}}>
          <path d="M30 18 C30 6 50 6 50 18 L50 70 L96 82 C108 86 112 96 108 108 L98 160 L30 160 L10 110 C4 96 18 88 28 98 L30 102 Z" fill={pal.skin ?? '#EFC19C'} stroke={pal.ink} strokeWidth={5} strokeLinejoin="round" />
        </svg>
      ) : null}
      {/* App 列表面板 */}
      <div style={{position: 'absolute', left: px + pw + 30, top: 30, right: 30, bottom: 30, borderRadius: 22, background: pal.card, border: `5px solid ${pal.ink}`, overflow: 'hidden'}}>
        <div style={{height: 58, background: pal.primary, borderBottom: `5px solid ${pal.ink}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px'}}>
          {[0, 1, 2].map((k) => (
            <div key={k} style={{width: 16, height: 16, borderRadius: 8, background: pal.card, opacity: 0.85}} />
          ))}
        </div>
        {list.map((r, i) => {
          if (phase === 'show' && released) {
            const at = releaseAt + 0.15 + i * 0.28;
            if (t < at) return <UiRow key={i} op={0} />;
            const s = Math.min(1, (t - at) / 0.18);
            return <UiRow key={i} text={r || undefined} done={t >= at + 0.3} op={s} scale={0.9 + 0.1 * s} />;
          }
          return <UiRow key={i} op={phase === 'idle' ? 0.6 : 1} />;
        })}
      </div>
    </div>
  );
};

export type StagePhase = 'idle' | 'ask' | 'show';

/** 媒体卡里的小剧场。scene：office / cafe / street / home / classroom（art 画的情景，两人对话）、screen（产品界面示意，items 是界面里的真实文字）
 *  或 phone（手机演示：按住 → 波形 → 松手 → 列表逐条出现；phase 控制演到哪一步，不剧透）；media = 用户自备图片或视频（优先） */
export const Stage: React.FC<{scene?: string; w: number; h: number; t: number; speaker?: Who | null; talkFrom?: number; talkUntil?: number; rewind?: boolean; media?: string; items?: string[]; phase?: StagePhase; phaseAt?: number}> = ({scene, w, h, t, speaker, talkFrom = 0, talkUntil = 0, rewind, media, items, phase = 'idle', phaseAt = 0}) => {
  if (media) return <MediaClip media={/\.mp4$/i.test(media) ? {kind: 'video', src: media} : {kind: 'image', src: media}} w={w} h={h} t={t} />;
  // 倒带：把时间反着走，再加横向抖动
  const tt = rewind ? Math.max(0, 3 - (t % 3) * 4) : t;
  const jitter = rewind ? Math.sin(t * 90) * 6 : 0;
  if (scene === 'screen') return <ScreenUI w={w} h={h} items={items} jitter={jitter} />;
  if (scene === 'phone')
    return (
      <div style={{position: 'absolute', inset: 0, transform: `translateX(${jitter}px)`}}>
        <PhoneDemo w={w} h={h} t={rewind ? -1 : t} items={items} phase={rewind ? 'idle' : phase} phaseAt={phaseAt} />
      </div>
    );
  const name = (SCENES as readonly string[]).includes(scene ?? '') ? (scene as SceneName) : 'office';
  const lines = speaker && talkUntil > talkFrom ? [{who: artWho(speaker), at: talkFrom, dur: talkUntil - talkFrom}] : [];
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translateX(${jitter}px)`}}>
      <MediaClip media={{kind: 'scene', scene: name, lines: lines as never, camera: rewind ? 'wide' : 'auto'}} w={w} h={h} t={tt} />
      {rewind ? <div style={{position: 'absolute', inset: 0, background: 'rgba(20,20,40,0.16)'}} /> : null}
    </div>
  );
};
