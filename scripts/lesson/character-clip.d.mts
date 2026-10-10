export const CARD_FPS: number;
export const CARD_FRAMES: number;
export const CARD_LINE: string;
export const POSE_LABELS: Record<'explain' | 'point' | 'check' | 'warn' | 'think' | 'affirm' | 'cheer' | 'wave', string>;

export type CardPose = 'explain' | 'point' | 'check' | 'warn' | 'think' | 'affirm' | 'cheer' | 'wave';
export type CardFrameState = {
  pose: CardPose;
  fromPose: CardPose;
  progress: number;
  mouth: number;
  blink: number;
  elapsedMs: number;
  line: string;
};

export function cardFrameState(frame: number): CardFrameState;
