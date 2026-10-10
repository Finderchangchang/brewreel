// 叠在画面上的小标签取色。和免责小字同一套：实色底，字和底的对比度先拉到 ≥ 4.5，
// 再靠 1px 同色描边和轻投影。不要再用半透明黑胶囊。
import {alpha, contrastRatio, mixHex, relLuminance, type Theme} from './theme';

export type Plate = {
  color: string;
  background: string;
  border: string;
  boxShadow: string;
};

export const tunePlate = (text: string, plate: string, lightPlate: boolean): Plate => {
  let p = plate;
  let t = text;
  for (let i = 0; i < 8 && contrastRatio(t, p) < 4.5; i++) p = mixHex(p, lightPlate ? '#FFFFFF' : '#0C0E14', 0.25);
  if (contrastRatio(t, p) < 4.5) {
    t = lightPlate ? '#141820' : '#F5F7FB';
    p = lightPlate ? '#FFFFFF' : '#141820';
  }
  return {
    color: t,
    background: p,
    border: `1px solid ${alpha(t, lightPlate ? 0.28 : 0.4)}`,
    boxShadow: `0 1px 2px ${alpha(t, 0.22)}`,
  };
};

/** 风格令牌（quiz / journey 的 ink、card、bg）优先。浅色纸用深字，深色纸用浅字。 */
export const palettePlate = (pal: {ink?: string; card?: string; bg?: string; flapInk?: string; onPrimary?: string}): Plate => {
  const ink = pal.ink;
  const card = pal.card;
  const bg = pal.bg;
  if (ink && (card || bg)) {
    const surface = bg || card || ink;
    const dark = relLuminance(surface) < 0.4;
    if (!dark) return tunePlate(ink, mixHex(card || '#FFFCF6', bg || ink, 0.1), true);
    const light = pal.flapInk || pal.onPrimary || '#F4F1E6';
    return tunePlate(light, mixHex(card || surface, '#000000', 0.25), false);
  }
  return tunePlate('#141820', '#FFFFFF', true);
};

export const labelInk = (th: Theme, pal: Record<string, string>): Plate => {
  if (pal.ink && (pal.card || pal.bg)) return palettePlate(pal);
  if (th.dark) return tunePlate(th.cardText, mixHex(th.card, th.bgBot[0], 0.2), false);
  return tunePlate(th.cardText, mixHex(th.card, th.bgTop[0], 0.14), true);
};

/** 口播真人段、AI 视频段：没有画面主题时的中性实底。暖纸深字，不透、不纯黑。 */
export const neutralPlate = (): Plate => tunePlate('#1B1914', '#F4EFE4', true);

/** 「AI 生成画面」角标：实色深底浅字，整段不透明。对比度由 tunePlate 拉到 ≥ 4.5。 */
export const aiBadgePlate = (): Plate => tunePlate('#F5F7FB', '#1B2838', false);
