// 剪纸拼贴的接力时间。模型只写 relay 名字，秒数和落点在这里。
// 时长故意不落在 0.5 秒网格上，剪辑不锁拍。
import {settle} from '../../talk/motion/kit/settle.ts';
import {RELAYS, type RelayName} from '../types.ts';

export {RELAYS};

export const ANCHOR = {cx: 540, cy: 950, w: 500, h: 620, tilt: 6};
export const PATCH = {cx: 390, cy: 1180, scale: 0.22};
export const TOSS_AT = 1.7;
export const WIPE_S = 0.68;
export const MORPH_S = 1.8;
export const HOLD_ZOOM = 2.4;
export const WINDOW_R = 340;

const OPEN = settle(1920, {restTilt: ANCHOR.tilt, travel: 0.2, up: 0.55, down: 0.95, tiltOver: 14, sign: 1});

export type RelayScreen = {relay?: string; role?: string; layout?: string};

const isRelay = (value: string | undefined): value is RelayName => !!value && (RELAYS as readonly string[]).includes(value);

/** 没写 relay 时按版式推一个。模型写了就用模型的。 */
export function relayOf(screen: RelayScreen | undefined, index: number, total: number): RelayName {
  if (isRelay(screen?.relay)) return screen.relay;
  if (screen?.role === 'action' || screen?.layout === 'end') return 'card';
  if (index === 0) return 'card';
  if (screen?.layout === 'sequence') return 'guide';
  if (screen?.layout === 'board') return index > total / 2 ? 'window' : 'postcard';
  if (screen?.layout === 'stack') return 'patch';
  return 'card';
}

export function collageDurations(screens: readonly RelayScreen[]): number[] {
  let seenPatch = false;
  const total = screens.length;
  return screens.map((screen, index) => {
    const relay = relayOf(screen, index, total);
    let seconds = 2.4;
    if (relay === 'card') seconds = index === 0 ? 4 : index === total - 1 ? 2 : 2.4;
    else if (relay === 'patch') seconds = seenPatch ? 1.4 : 3.2;
    else if (relay === 'guide') seconds = 1.8;
    else if (relay === 'tumble') seconds = 3.6;
    else if (relay === 'postcard') seconds = 4.2;
    else if (relay === 'window') seconds = 3.8;
    if (relay === 'patch') seenPatch = true;
    return seconds;
  });
}

export type AnchorPose = {
  show: boolean;
  cx: number;
  cy: number;
  w: number;
  h: number;
  tilt: number;
  /** 画在屏幕上的倍数。补丁在衣身空间里另算。 */
  scale: number;
  /** 0 是票券折线，1 是圆。 */
  round: number;
  swirl: number;
  /** screen：叠在最上面。garment：跟着衣架缩放。 */
  space: 'screen' | 'garment';
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

const ticket = (over: Partial<AnchorPose> = {}): AnchorPose => ({
  show: true,
  cx: ANCHOR.cx,
  cy: ANCHOR.cy,
  w: ANCHOR.w,
  h: ANCHOR.h,
  tilt: ANCHOR.tilt,
  scale: 1,
  round: 0,
  swirl: 0,
  space: 'screen',
  ...over,
});

/** 第一段补丁镜头的衣架缩放。先贴着补丁，再拉远。 */
export function worldScale(relay: RelayName, local: number, duration: number, returnVisit: boolean): number {
  if (relay !== 'patch') return 1;
  if (!returnVisit) {
    if (local < 1.6) return HOLD_ZOOM;
    return lerp(HOLD_ZOOM, 1, smooth((local - 1.6) / Math.max(0.2, duration - 1.6)));
  }
  return lerp(1, 2.5, smooth(local / Math.max(0.2, duration)));
}

/**
 * 锚点这一帧的姿态。
 * 开场卡做一次上抛。补丁在擦入期间用屏幕坐标飞过去，之后改贴在衣身上。
 */
export function anchorPose(relay: RelayName, local: number, index: number, returnVisit: boolean): AnchorPose {
  const t = Math.max(0, local);
  if (relay === 'guide') return ticket({show: false});
  if (relay === 'card' && index === 0) {
    if (t <= TOSS_AT) return ticket();
    const sample = OPEN.at(t - TOSS_AT);
    return ticket({cy: ANCHOR.cy + sample.y, tilt: sample.tilt});
  }
  if (relay === 'card') {
    const u = smooth(t / 0.16);
    return ticket({
      cx: lerp(PATCH.cx, ANCHOR.cx, u),
      cy: lerp(ANCHOR.cy + 22, ANCHOR.cy, u),
      scale: lerp(PATCH.scale, 1, u),
    });
  }
  if (relay === 'patch') {
    if (!returnVisit && t < WIPE_S) {
      const u = smooth(t / WIPE_S);
      return ticket({
        cx: lerp(ANCHOR.cx, PATCH.cx, u),
        cy: lerp(ANCHOR.cy, PATCH.cy, u),
        scale: lerp(1, PATCH.scale * HOLD_ZOOM, u),
      });
    }
    return ticket({
      cx: PATCH.cx,
      cy: PATCH.cy,
      scale: PATCH.scale,
      space: 'garment',
    });
  }
  if (relay === 'tumble') {
    const phase = (t % 1.2) / 1.2;
    const up = Math.sin(phase * Math.PI);
    return ticket({tilt: ANCHOR.tilt + up * 22, cy: ANCHOR.cy - up * 140, scale: 1.04});
  }
  if (relay === 'postcard') {
    return ticket({w: 640, h: 880, round: 0.22});
  }
  const u = smooth(t / MORPH_S);
  const size = lerp(640, WINDOW_R * 2, u);
  return ticket({
    w: size,
    h: size,
    tilt: lerp(ANCHOR.tilt, 0, u),
    round: lerp(0.22, 1, u),
    swirl: t > MORPH_S ? (t - MORPH_S) * 288 : 0,
  });
}

/** 带路纸蛾。全片只用这一次，最大边约画面宽的 11%。 */
export function guideAt(local: number, duration: number): {x: number; y: number; size: number} {
  const u = smooth(local / Math.max(0.2, duration));
  return {x: lerp(780, 690, u), y: lerp(1320, 1120, u), size: 118};
}

export function groundName(relay: RelayName, local: number, duration: number): 'bg' | 'bg_plaster' | 'bg_meadow' | 'bg_cream' | 'bg_swap' | 'bg_drum' {
  if (relay === 'patch') return 'bg_plaster';
  if (relay === 'guide') return 'bg_meadow';
  if (relay === 'postcard') return local < duration * 0.48 ? 'bg_cream' : 'bg_swap';
  if (relay === 'window') return 'bg_drum';
  return 'bg';
}

export const openSettle = OPEN;
