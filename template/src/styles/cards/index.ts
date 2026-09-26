// ============================================================
// cards：现有的默认风格（渐变底 + 居中卡片 + 描边大字幕）。
// 代码原地不动：镜头在 src/shots/，主题在 core/themes.json，背景/字幕层在 core/layers.tsx，整片由 Promo.tsx 的 CardsPromo 画。
// 这里只登记清单和令牌，让它和其他风格走同一个注册表。
// ============================================================
import THEMES from '../../core/themes.json';
import {defineStyle, StyleManifest} from '../types';
import manifest from './style.json';

export default defineStyle({
  manifest: manifest as StyleManifest,
  tokens: {themes: THEMES},
  // 公共镜头由 commonShots:"*" 引入，cards 没有专属镜头
  shots: {},
});
