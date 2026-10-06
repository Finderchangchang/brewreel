// 相邻两段动效的锚点接力。
// 对应原理：同一外观、间隔不超过 3 秒时，后一段的锚点从前一段的最终姿态进来
//（倾斜差 ≤ 3°，颜色 ΔE00 ≤ 8）。差得更多就各自入场，不要硬接。

import {deltaE} from './color.ts';

export type AnchorPose = {tilt: number; color: string};

export type RelayInput = {
  /** 两段是不是同一个动效外观 */
  sameLook: boolean;
  /** 前一段结束到后一段开始的秒数。重叠（负数）或超过 3 秒都不接 */
  gapSec: number;
  prev: AnchorPose;
  next: AnchorPose;
};

export type RelayDecision = {
  relay: boolean;
  /** 这一段锚点该用的静止角：接上了就用前一段的，否则用自己的 */
  tilt: number;
  /** 接上了就用前一段的锚点色，否则用自己的 */
  color: string;
};

export const RELAY_MAX_GAP = 3;
export const RELAY_MAX_TILT = 3;
export const RELAY_MAX_DE = 8;

export const anchorRelay = (input: RelayInput | null | undefined): RelayDecision => {
  const nextTilt = input?.next.tilt ?? 0;
  const nextColor = input?.next.color ?? '#000000';
  const alone = (): RelayDecision => ({relay: false, tilt: nextTilt, color: nextColor});
  if (!input) return alone();
  const gapOk = input.gapSec >= 0 && input.gapSec <= RELAY_MAX_GAP;
  const tiltOk = Math.abs(input.prev.tilt - input.next.tilt) <= RELAY_MAX_TILT;
  const de = deltaE(input.prev.color, input.next.color);
  const colorOk = Number.isFinite(de) && de <= RELAY_MAX_DE;
  if (input.sameLook && gapOk && tiltOk && colorOk) {
    return {relay: true, tilt: input.prev.tilt, color: input.prev.color};
  }
  return alone();
};
