// ============================================================
// journey（角色漫游）风格。骨架：只有一个占位镜头 district（一个街区：天空 + 视差楼群 + 路牌 + 广告牌 + 占位角色），
// 用来打通 4:5 画幅的注册、校验、出帧链路。真正的一镜到底建议写成 Film（见 ../types.ts 的 StyleDef.Film），
// 规格见 styles/journey/STYLE.md。加镜头 = shots/<type>.tsx + <type>.spec.json，然后跑 node scripts/gen-styles.mjs。
// ============================================================
import {defineStyle, StyleManifest} from '../types';
import manifest from './style.json';
import tokens from './tokens.json';
import {SHOTS} from './shots/index.gen';

export default defineStyle({
  manifest: manifest as StyleManifest,
  tokens,
  shots: SHOTS,
});
