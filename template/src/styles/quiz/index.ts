// ============================================================
// quiz（答题互动）风格：先让观众猜错一次，再揭晓为什么。
// 8 个专属镜头（shots/）+ 整片渲染器 QuizFilm（film.tsx：四种换场 + 整片上下文）。
// 元件在 parts/（kit = 文字点亮/马克笔/删除线/贴纸，media = 媒体卡，cast = 角色与小剧场接口层）；
// 角色和场景的正式美术在 art/，由 parts/cast.tsx 接入，镜头不直接引用 art/。
// 规格见 styles/quiz/STYLE.md；加镜头 = shots/<type>.tsx + <type>.spec.json，然后跑 node scripts/gen-styles.mjs。
// ============================================================
import {defineStyle, StyleManifest} from '../types';
import manifest from './style.json';
import tokens from './tokens.json';
import {SHOTS} from './shots/index.gen';
import {QuizFilm} from './film';

export default defineStyle({
  manifest: manifest as StyleManifest,
  tokens,
  shots: SHOTS,
  Film: QuizFilm,
});
