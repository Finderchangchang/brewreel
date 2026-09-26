// __ID__ 风格。加镜头 = shots/<type>.tsx + <type>.spec.json，然后跑 node scripts/gen-styles.mjs
import {defineStyle, StyleManifest} from '../types';
import manifest from './style.json';
import tokens from './tokens.json';
import {SHOTS} from './shots/index.gen';

export default defineStyle({
  manifest: manifest as StyleManifest,
  tokens,
  shots: SHOTS,
  // Film: 一镜到底时写整片渲染器；Background / Overlay：全片常驻的背景层、覆盖层（见 ../types.ts）
});