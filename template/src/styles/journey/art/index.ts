// ============================================================
// journey / art：吉祥物「橘团」+ 悬浮滑板、横版城市（天空 / 远景 / 中景 / 近景 / 街面，三种天际线）、十四个主题街区、带字招牌。
// 全部用 SVG / React 代码画，是本项目自己的原创设计。接口说明见同目录 README.md。
// ============================================================
export {Mascot, MascotG, Hoverboard, SpeedLines, POSES, EXPRS, VEHICLES, MASCOT_FX, POSE_SPECS, EXPR_SPECS, MASCOT_BOX, MASCOT_HEIGHT} from './Mascot';
export type {Pose, Expr, Vehicle, MascotFx, MascotProps} from './Mascot';
export {CityWorld, layoutCity, toScreen, districtAt, sceneScale} from './World';
export type {CityWorldProps, CityLayout, DistrictSlot} from './World';
export {DISTRICT_W, DISTRICT_NEAR, DistrictMid, FillerNear} from './districts';
export type {DistrictArtProps} from './districts';
export {Sky, FarSkyline, House, Tower, Windows, StreetLamp, Tree, Bush, Bench, Bunting, Street} from './city';
export {Billboard, WaySign, NeonSign} from './signs';
export {EVERYDAY_NEAR} from './everyday';
export {OLDTOWN_NEAR, OldFar, OldMid, OldFiller, OldStreet, OldHouse, TileRoof, Lantern, Willow} from './oldtown';
export {INK, MASCOT, BOARD, SKY, STREET, WINDOW, NEON, OLD, DISTRICT, DISTRICT_KINDS, skyAt, skyForDistrict, nightOf, duskOf, lit, mixHex, hash, useArtColors} from './palette';
export type {DistrictKind, MascotColors, BoardColors, SkyStop, Skyline} from './palette';