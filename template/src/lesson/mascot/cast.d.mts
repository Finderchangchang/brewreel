import type {AccessoryType, BustPoseType, FacialHairType, HairType} from '../../vendor/react-peeps/peeps';

export const POSES: readonly ['explain', 'point', 'check', 'warn', 'think', 'affirm', 'cheer', 'wave'];
export type MascotPose = (typeof POSES)[number];
export type PeepFamily = 'sweater' | 'tee' | 'shirt';
export type IconKind = 'none' | 'warn' | 'think' | 'check' | 'cheer';
export type PoseLook = {body: BustPoseType; face: 'SmileNM' | 'CalmNM'; icon: IconKind};
export type MouthAnchor = {cx: number; cy: number};
export type PeepFrame = {x: number; y: number; width: number; height: number};

export const FAMILIES: Record<PeepFamily, readonly BustPoseType[]>;
export const OUTFITS: readonly PeepFamily[];
export const LEGACY_IDS: Record<string, string>;
export const CAST: Record<string, {family: PeepFamily; hair: HairType; accessory: AccessoryType; facialHair: FacialHairType; label: string}>;
export const POSE_LOOK: Record<PeepFamily, Record<MascotPose, PoseLook>>;
export const MOUTH_ANCHOR: {default: MouthAnchor; [body: string]: MouthAnchor};
export function mouthAnchor(body: string): MouthAnchor;
export const FRAME: Record<'card' | 'circle', PeepFrame>;
export const PEEP_FILL: '#FFFFFF';
export const OUTFIT_FAMILY: Record<string, PeepFamily>;
export const OUTFIT_NAMES: readonly ['darkSweater', 'blackTee', 'whiteShirt'];
export const PRESET_NAMES: readonly string[];
export const PRESETS: Record<string, {hair: HairType; accessory: AccessoryType; facialHair: FacialHairType; outfit: string}>;
export function defaultPreset(domain?: string | null): 'male' | 'female';
export function resolveMascotId(id?: string | null): string | null;
export function resolveLook(wardrobe?: {id?: string; preset?: string; hair?: string; accessory?: string; facialHair?: string; outfit?: string; skin?: string} | null, domain?: string | null): {
  id: string;
  preset: string;
  family: PeepFamily;
  outfit: string;
  hair: HairType;
  accessory: AccessoryType;
  facialHair: FacialHairType;
  skin: string | null;
};
export function resolveCartoonWardrobe(meta?: {domain?: string; mascot?: {id?: string; enabled?: boolean; hair?: string; accessory?: string; facialHair?: string; outfit?: string; pageOverrides?: unknown[]}; presenter?: {kind?: string; look?: {preset?: string; hair?: string; accessory?: string; facialHair?: string; outfit?: string; skin?: string}}} | null): {
  enabled: boolean;
  preset: string;
  hair: string;
  accessory: string;
  facialHair: string;
  outfit: string;
  skin?: string;
  pageOverrides?: unknown[];
} | null;
export function poseLook(family: PeepFamily, pose: MascotPose): PoseLook;
