// ============================================================
// quiz / art：角色、表情、姿态、头顶特效、小剧场场景、媒体片段、探头。接口说明见同目录 README.md。
// ============================================================
export {Character, CharacterG, Avatar, Bulb} from './Character';
export type {CharacterProps} from './Character';
export {POSES, EXPRS, SPECS, SW} from './rig';
export type {Pose, Expr, Who, HandKind} from './rig';
export {Fx, FX_KINDS, Heart, Sparkle} from './fx';
export type {FxKind} from './fx';
export {SCENES, STAGE, GROUND, SceneBackdrop} from './scenes';
export type {SceneName} from './scenes';
export {SceneClip, MediaClip, PeekCharacter, performAt} from './theater';
export type {ClipLine, ClipEvent, ClipCamera, ClipMedia, CastSlot, SceneClipProps, PeekProps} from './theater';
export {mouthAt, blinkAt, nodAt, hopAt, breathe, backOut, waveAt} from './motion';
export {useArtPalette, artPalette, mixHex} from './colors';
export type {ArtPalette} from './colors';
