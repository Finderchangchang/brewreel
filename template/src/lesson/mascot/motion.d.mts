import type {MascotPose} from './poses';

export const POSE_BLEND_MS: number;
export const PAGE_MOVE_FRAMES: number;
export const BLINK_MS: number;
export const SENTENCE_CLOSE_MS: number;
export function smoothStep(value: number): number;
export function interpolatePoint(a: [number, number], b: [number, number], amount: number): [number, number];
export function poseAt(pose: string | null | undefined): MascotPose;
export function hashUnit(n: number): number;
export function blinkAt(elapsedMs: number, seed?: number, speaking?: boolean): number;
export function breatheAt(elapsedMs: number): {y: number; sx: number; sy: number};
export type TimedMouthChar = {text: string; startMs: number; endMs: number};
export function talkingAt(chars: TimedMouthChar[], elapsedMs: number, offsetMs?: number): boolean;
export function mouthOpenAmount(chars: TimedMouthChar[], elapsedMs: number, offsetMs?: number, sentenceEndMs?: number): number;
export function mouthGeometry(amount: number, anchor?: {cx: number; cy: number}): {open: boolean; d: string; width: number; depth: number};
