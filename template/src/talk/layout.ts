// 口播配 B-roll 的三种摆法。纯函数，节点测试直接引用。
export const PIP_MARGIN = 64;
export const PIP_DIAMETER_V = 320;
export const PIP_DIAMETER_H = 260;
export const SPLIT_TOP = 0.6;
export const FADE_SEC = 0.2;

export type Rect = {x: number; y: number; width: number; height: number};
export type FaceLayout = Rect & {shape: 'circle' | 'rect'};
export type CaptionBox = {x: number; y: number; width: number; fontSize: number; stroke: number};

export type TalkLayout = {
  broll: Rect;
  face: FaceLayout | null;
  badge: {x: number; y: number};
  caption: CaptionBox;
};

const captionOf = (width: number, height: number): CaptionBox => {
  const fontSize = Math.max(36, Math.round((height * 72) / 1920));
  return {
    x: Math.round((width * 150) / 1080),
    y: Math.round((height * 260) / 1920),
    width: Math.round((width * 780) / 1080),
    fontSize,
    stroke: Math.round(fontSize * 0.15),
  };
};

/** full 盖满；pip 右下角圆形小窗；split 上 60% 是 B-roll、下 40% 是口播。 */
export const layoutOf = (mode: 'full' | 'pip' | 'split', width: number, height: number): TalkLayout => {
  const badge = {x: 36, y: 36};
  const caption = captionOf(width, height);
  if (mode === 'split') {
    const bh = Math.round(height * SPLIT_TOP);
    return {
      broll: {x: 0, y: 0, width, height: bh},
      face: {x: 0, y: bh, width, height: height - bh, shape: 'rect'},
      badge,
      caption,
    };
  }
  if (mode === 'pip') {
    const d = height > width ? PIP_DIAMETER_V : PIP_DIAMETER_H;
    return {
      broll: {x: 0, y: 0, width, height},
      face: {x: width - PIP_MARGIN - d, y: height - PIP_MARGIN - d, width: d, height: d, shape: 'circle'},
      badge,
      caption,
    };
  }
  return {
    broll: {x: 0, y: 0, width, height},
    face: null,
    badge,
    caption,
  };
};
