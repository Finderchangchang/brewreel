export type MarkBox = {x: number; y: number; w: number; h: number};
export type PeepCrop = 'card' | 'circle';
export type PeepFit = {
  scale: number;
  drawnW: number;
  drawnH: number;
  offsetX: number;
  offsetY: number;
  view: {x: number; y: number; width: number; height: number};
};

export const HEAD_VIEW: MarkBox;
export const BADGE_VIEW: MarkBox;
export const CONFETTI_ACCENT: string;
export const CARD_MOTION_FRAME: {w: number; h: number};

export function cssPx(value: number): string;
export function boxesOverlap(a: MarkBox | null | undefined, b: MarkBox | null | undefined): boolean;
export function fitPeep(stageW: number, stageH: number, crop?: PeepCrop): PeepFit;
export function markFractions(kind: string, elapsedMs?: number, crop?: PeepCrop): {head: MarkBox; icon: MarkBox | null; pieces: MarkBox[]};
export function placeMarks(stageW: number, stageH: number, crop?: PeepCrop, kind?: string, elapsedMs?: number): {
  head: MarkBox;
  icon: MarkBox | null;
  pieces: MarkBox[];
  fit: PeepFit;
};
export function pieceFill(index: number, ink?: string): string;
export function iconMarkup(kind: string, ink?: string): string;
export function pieceMarkup(fill?: string): string;
