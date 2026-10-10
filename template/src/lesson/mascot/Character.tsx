import React from 'react';
import Peep from '../../vendor/react-peeps/peeps';
import type {AccessoryType, FaceType, FacialHairType, HairType} from '../../vendor/react-peeps/peeps';
import type {MascotPose, MascotWardrobe} from './poses';
import {FRAME, mouthAnchor, PEEP_FILL, poseLook, resolveLook} from './cast.mjs';
import type {IconKind, PoseLook} from './cast.mjs';
import {fitPeep, iconMarkup, markFractions, pieceFill, pieceMarkup} from './icon-place.mjs';
import type {MarkBox} from './icon-place.mjs';
import {breatheAt, mouthGeometry, smoothStep} from './motion.mjs';

type CharacterProps = {
  pose: MascotPose;
  fromPose: MascotPose;
  progress: number;
  /** 0 闭嘴，1 张到这个字的最大幅度。 */
  mouth: number;
  /** 1 时换成闭眼脸，并且不另画嘴。 */
  blink: number;
  elapsedMs: number;
  wardrobe?: MascotWardrobe | null;
  ink?: string;
  surface?: string;
  /** card 是 3:4 半身窗；circle 只留头肩；bust 是圆形头像里的头肩放大。 */
  crop?: 'card' | 'circle' | 'bust';
  /** 外框像素。图标按这个尺寸里人物真正画出来的大小摆。 */
  frameWidth?: number;
  frameHeight?: number;
};

type PeepCrop = 'card' | 'circle' | 'bust';
const frameKey = (crop: PeepCrop) => (crop === 'bust' ? 'card' : crop);
const viewBoxOf = (crop: PeepCrop) => {
  const box = FRAME[frameKey(crop)];
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
};

const Mouth: React.FC<{amount: number; body: string; ink: string; crop: PeepCrop}> = ({amount, body, ink, crop}) => {
  const shape = mouthGeometry(amount, mouthAnchor(body));
  return <svg viewBox={viewBoxOf(crop)} preserveAspectRatio="xMidYMid meet" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block'}}>
    {shape.open
      ? <path d={shape.d} fill={ink} />
      : <path d={shape.d} fill="none" stroke={ink} strokeWidth={7} strokeLinecap="round" />}
  </svg>;
};

const Layer: React.FC<{
  look: PoseLook;
  hair: HairType;
  accessory: AccessoryType;
  facialHair: FacialHairType;
  ink: string;
  surface: string;
  opacity: number;
  blink: boolean;
  mouth: number;
  crop: PeepCrop;
}> = ({look, hair, accessory, facialHair, ink, surface, opacity, blink, mouth, crop}) => {
  const box = FRAME[frameKey(crop)];
  const face: FaceType = blink ? 'EyesClosed' : look.face;
  return <div style={{position: 'absolute', inset: 0, opacity}}>
    <Peep
      style={{width: '100%', height: '100%', display: 'block'}}
      viewBox={{x: String(box.x), y: String(box.y), width: String(box.width), height: String(box.height)}}
      strokeColor={ink}
      backgroundColor={surface}
      hair={hair}
      accessory={accessory}
      facialHair={facialHair}
      body={look.body}
      face={face}
    />
    {blink ? null : <Mouth amount={mouth} body={look.body} ink={ink} crop={crop} />}
  </div>;
};

const boxStyle = (box: MarkBox): React.CSSProperties => ({
  position: 'absolute',
  left: `${box.x * 100}%`,
  top: `${box.y * 100}%`,
  width: `${box.w * 100}%`,
  height: `${box.h * 100}%`,
  pointerEvents: 'none',
});

const Marks: React.FC<{kind: IconKind; opacity: number; ink: string; elapsedMs: number; crop: PeepCrop}> = ({kind, opacity, ink, elapsedMs, crop}) => {
  const marks = markFractions(kind, elapsedMs, frameKey(crop));
  if (!marks.icon && marks.pieces.length === 0) return null;
  return <div style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}>
    {marks.icon ? <div style={boxStyle(marks.icon)} dangerouslySetInnerHTML={{__html: iconMarkup(kind, ink)}} /> : null}
    {marks.pieces.map((piece, index) => <div key={index} style={boxStyle(piece)} dangerouslySetInnerHTML={{__html: pieceMarkup(pieceFill(index, ink))}} />)}
  </div>;
};

export const Character: React.FC<CharacterProps> = ({
  pose, fromPose, progress, mouth, blink, elapsedMs, wardrobe, ink = '#1E2422', surface = '#FFFFFF', crop = 'card', frameWidth, frameHeight,
}) => {
  const look = resolveLook(wardrobe);
  // skin 先留在 look 里。react-peeps 的填充色会染到整个人，这一版不用它，也不用风格 surface。
  const fill = PEEP_FILL;
  const from = poseLook(look.family, fromPose);
  const to = poseLook(look.family, pose);
  const blend = smoothStep(Math.max(0, Math.min(1, progress)));
  const breath = breatheAt(elapsedMs);
  const dip = Math.sin(Math.PI * Math.max(0, Math.min(1, progress))) * 0.03;
  const eyesShut = blink >= 1;
  const shared = {hair: look.hair, accessory: look.accessory, facialHair: look.facialHair, ink, surface: fill, blink: eyesShut, mouth, crop};
  const transform = `scaleX(-1) translateY(${breath.y.toFixed(2)}px) scale(${(breath.sx * (1 - dip)).toFixed(4)}, ${(breath.sy * (1 - dip)).toFixed(4)})`;
  const view = FRAME[frameKey(crop)];
  const sized = Number.isFinite(frameWidth) && Number.isFinite(frameHeight) && (frameWidth ?? 0) > 0 && (frameHeight ?? 0) > 0;
  const bust = crop === 'bust' && sized;
  const bustScale = (frameWidth ?? 210) / 210;
  const fit = sized && !bust ? fitPeep(frameWidth ?? 0, frameHeight ?? 0, frameKey(crop)) : null;
  const fitted: React.CSSProperties = bust
    ? {position: 'absolute', left: '50%', top: 8 * bustScale, width: 240 * bustScale, height: 339 * bustScale, transform: 'translateX(-50%)'}
    : fit
    ? {position: 'absolute', left: fit.offsetX, top: fit.offsetY, width: fit.drawnW, height: fit.drawnH}
    : {position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: `min(100cqw, calc(100cqh * ${view.width} / ${view.height}))`, aspectRatio: `${view.width} / ${view.height}`};
  return <div style={{position: 'absolute', inset: 0, containerType: fit || bust ? undefined : 'size'}} role="img" aria-label={`${look.id} ${pose}`}>
    <div style={fitted}>
      <div style={{position: 'absolute', inset: 0, transform, transformOrigin: bust ? '50% 58%' : '50% 100%'}}>
        <Layer {...shared} look={from} opacity={1 - blend} />
        <Layer {...shared} look={to} opacity={blend} />
      </div>
      {blend < 1 ? <Marks kind={from.icon} opacity={1 - blend} ink={ink} elapsedMs={elapsedMs} crop={crop} /> : null}
      {blend > 0 ? <Marks kind={to.icon} opacity={blend} ink={ink} elapsedMs={elapsedMs} crop={crop} /> : null}
    </div>
  </div>;
};
