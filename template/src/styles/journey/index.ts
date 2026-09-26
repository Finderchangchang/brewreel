// ============================================================
// journey（角色漫游）风格：吉祥物乘悬浮滑板一镜到底横穿一座扁平插画城市，每个街区一个内容类别。
// 3 个专属镜头只当数据：opening（钩子）→ district × 4–6（街区）→ finale（片尾缩进产品界面）；
// 画面全部由整片渲染器 JourneyFilm（film.tsx）画：parts/plan.ts 先算相机曲线和世界坐标，art/ 画城市和吉祥物，
// parts/props.tsx 画街区道具和笑点，parts/ui.tsx 画车票/明信片/路牌/气泡/拟声字/翻牌大字，parts/outro.tsx 画片尾，
// parts/rider.tsx 是角色的接入层（美术的正式角色在 art/，接口见 rider.tsx 顶部注释）。
// 规格见 styles/journey/STYLE.md；加街区类型 = tokens.json 的 scenes 加一项 + plan.ts 的 ART_KIND 指定美术街区 + parts/props.tsx 加一个分支。
// ============================================================
import {defineStyle, StyleManifest} from '../types';
import manifest from './style.json';
import tokens from './tokens.json';
import {SHOTS} from './shots/index.gen';
import {JourneyFilm} from './film';

export default defineStyle({
  manifest: manifest as StyleManifest,
  tokens,
  shots: SHOTS,
  Film: JourneyFilm,
});