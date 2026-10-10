export type {MascotPose, PeepFamily, IconKind} from './cast.mjs';
export {POSES, FAMILIES, OUTFITS, OUTFIT_FAMILY, OUTFIT_NAMES, PRESETS, PRESET_NAMES, CAST, POSE_LOOK, LEGACY_IDS, resolveMascotId, resolveLook, resolveCartoonWardrobe, defaultPreset, poseLook, mouthAnchor, FRAME, PEEP_FILL} from './cast.mjs';

export type MascotPalette = {skin: string; hair: string; primary: string; secondary: string};

export type MascotWardrobe = {
  id?: string;
  enabled?: boolean;
  palette?: Partial<MascotPalette>;
  /** Open Peeps 发型名，例如 ShortVolumed、Bun、MediumBangs。 */
  hair?: string;
  /** Open Peeps 眼镜或饰品名，None 表示不戴。 */
  accessory?: string;
  /** Open Peeps 胡子名，None 表示没有。 */
  facialHair?: string;
  /** 衣服族。darkSweater / blackTee / whiteShirt；旧名 sweater / tee / shirt 仍可用。 */
  outfit?: 'darkSweater' | 'blackTee' | 'whiteShirt' | 'sweater' | 'tee' | 'shirt';
  /** male、female，或 peep-mentor / peep-counsel / peep-teacher。只提供默认值。 */
  preset?: 'male' | 'female' | 'peep-mentor' | 'peep-counsel' | 'peep-teacher';
  /** #RRGGBB。识别和校验仍接受。这一版渲染忽略，人物保持 Open Peeps 的白色。 */
  skin?: string;
  pageOverrides?: {pageIndex: number; wardrobe: Omit<MascotWardrobe, 'pageOverrides'>}[];
};

export const DEFAULT_PALETTE: MascotPalette = {skin: '#D99B78', hair: '#26364A', primary: '#287A78', secondary: '#F0B35B'};
