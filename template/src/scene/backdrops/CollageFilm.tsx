// 整支剪纸拼贴。一块色卡穿过各屏：缩成补丁、翻面、变成圆窗，再回到原点。
// 字仍是场景计划里的块，探针和安全区沿用原来的坐标。插画层不承载文案。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Confetti} from '../../talk/motion/kit/Confetti.tsx';
import {CutShape} from '../../talk/motion/kit/CutShape.tsx';
import {PaperGrain} from '../../talk/motion/kit/PaperGrain.tsx';
import {shadowColor, shadowOffset} from '../../talk/motion/kit/cutShape.ts';
import type {PlanBlock, PlanScreen, ScenePlan} from '../prepare.ts';
import type {RelayName} from '../types.ts';
import ink from '../styles/cutpaper-collage.json';
import {ANCHOR, PATCH, WIPE_S, WINDOW_R, anchorPose, groundName, guideAt, worldScale} from './collage-time.ts';
import {Hills, Meadow, Moth, NeedleMark, Rack, Stitches, Tub} from './illustrations.tsx';

const C = ink.palette;
const W = 1080;
const H = 1920;

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

const isReturnPatch = (plan: ScenePlan, screen: PlanScreen) =>
  screen.relay === 'patch' && plan.screens.slice(0, screen.index).some((item) => item.relay === 'patch');

const Ticket: React.FC<{
  pose: ReturnType<typeof anchorPose>;
  fill: string;
  ground: string;
  mark?: boolean;
  stitches?: boolean;
}> = ({pose, fill, ground, mark, stitches}) => {
  const w = pose.w * pose.scale;
  const h = pose.h * pose.scale;
  return (
    <div style={{position: 'absolute', left: pose.cx - w / 2, top: pose.cy - h / 2, width: w, height: h}}>
      <CutShape seed="mend-ticket" w={w} h={h} fill={fill} tilt={pose.tilt} keepTilt shadow={shadowColor(ground)} shortSide={W}>
        {stitches ? <Stitches /> : null}
        {mark ? (
          <div style={{position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)'}}>
            <NeedleMark />
          </div>
        ) : null}
      </CutShape>
    </div>
  );
};

const CopyLine: React.FC<{plan: ScenePlan; block: PlanBlock; local: number; onCard: boolean; ride?: number}> = ({plan, block, local, onCard, ride = 0}) => {
  const text = block.text.trim();
  if (!text || local + 1e-6 < block.showAt) return null;
  const shift = (local < 0.32 ? (1 - local / 0.32) * 22 : 0) + ride;
  return (
    <div
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y + shift,
        width: block.w,
        height: block.h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: block.textAlign === 'start' ? 'flex-start' : 'center',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          color: onCard ? C.onAccent : plan.paint.ink,
          background: onCard ? 'transparent' : plan.roles.surface,
          padding: onCard ? 0 : '8px 16px',
          lineHeight: 1.12,
          fontFamily: plan.fontFamily,
          fontWeight: plan.roles.weight,
          fontSize: block.font,
          textAlign: 'center',
        }}
      >
        {text}
      </span>
    </div>
  );
};

export const CollageFilm: React.FC<{plan: ScenePlan; screen: PlanScreen; local: number}> = ({plan, screen, local}) => {
  const relay: RelayName = screen.relay ?? 'card';
  const back = isReturnPatch(plan, screen);
  const pose = anchorPose(relay, local, screen.index, back);
  const zoom = worldScale(relay, local, screen.duration, back);
  const groundKey = groundName(relay, local, screen.duration);
  const ground = C[groundKey];
  const wiping = relay === 'patch' && !back && local < WIPE_S;
  const edge = wiping ? smooth(local / WIPE_S) * W : W;
  const shade = shadowOffset(W);
  const sky = groundKey === 'bg_swap' ? C.bg : C.cloud;
  const moth = relay === 'guide' ? guideAt(local, screen.duration) : null;
  const onCard = relay === 'card';

  const shape = pose.show && pose.round < 0.02 ? (
    <Ticket pose={pose} fill={C.accent} ground={wiping ? C.bg : ground} mark={onCard && screen.index > 0} stitches={pose.space === 'garment'} />
  ) : null;

  return (
    <AbsoluteFill style={{background: wiping ? C.bg : ground, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${zoom})`,
          transformOrigin: `${PATCH.cx}px ${PATCH.cy}px`,
          clipPath: wiping ? `inset(0px ${Math.max(0, W - edge)}px 0px 0px)` : undefined,
        }}
      >
        <div style={{position: 'absolute', inset: 0, background: ground}} />
        {relay === 'patch' ? <Rack imageSrc={screen.imageSrc} /> : null}
        {relay === 'guide' ? <Meadow /> : null}
        {pose.show && pose.space === 'garment' ? shape : null}
      </div>
      {wiping ? (
        <div style={{position: 'absolute', left: edge - 8, top: 0, width: 12, height: H, background: C.garmentDark}} />
      ) : null}
      {pose.show && pose.space === 'screen' && pose.round < 0.02 ? shape : null}
      {pose.show && pose.round >= 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: pose.cx - pose.w / 2,
            top: pose.cy - pose.h / 2,
            width: pose.w,
            height: pose.h,
            transform: `rotate(${pose.tilt}deg)`,
            borderRadius: pose.round >= 0.99 ? '50%' : Math.round(Math.min(pose.w, pose.h) * pose.round),
            overflow: 'hidden',
            background: relay === 'window' ? `conic-gradient(from ${pose.swirl}deg, ${C.accent} 0 180deg, ${C.bg} 180deg 360deg)` : sky,
            boxShadow: `${shade.dx}px ${shade.dy}px 0 ${shadowColor(ground)}`,
          }}
        >
          {relay === 'postcard' ? <Hills sky={sky} /> : null}
        </div>
      ) : null}
      {relay === 'window' && pose.round > 0.6 ? (
        <div style={{position: 'absolute', left: pose.cx - pose.w / 2, top: pose.cy - pose.h / 2, width: pose.w, height: pose.h}}>
          <Tub radius={Math.max(WINDOW_R, pose.w / 2)} />
        </div>
      ) : null}
      {relay === 'tumble'
        ? [0, 1, 2, 3].map((n) => {
            const phase = (local % 1.2) / 1.2;
            const lift = Math.sin(phase * Math.PI);
            return (
              <div
                key={n}
                data-probe-skip
                style={{
                  position: 'absolute',
                  left: ANCHOR.cx + 180 + n * 28,
                  top: pose.cy - 80 - lift * 40 - n * 18,
                  width: 18,
                  height: 4,
                  background: plan.roles.ink,
                  opacity: 0.35 + lift * 0.4,
                  transform: `rotate(${-20 + n * 12}deg)`,
                }}
              />
            );
          })
        : null}
      {moth ? (
        <div style={{position: 'absolute', left: moth.x - moth.size / 2, top: moth.y - moth.size / 2}}>
          <Moth size={moth.size} />
        </div>
      ) : null}
      <PaperGrain w={W} h={H} seed={7} sigma={5} scale={3.2} opacity={0.2} />
      {onCard ? (
        <Confetti
          t={local}
          dur={screen.duration}
          w={W}
          h={H}
          seed={`mend-${screen.index}`}
          colors={[C.scrapA, C.scrapB, C.scrapC]}
          count={12}
          shortSide={W}
          avoid={[{x: 300, y: 760, width: 480, height: 380}]}
        />
      ) : null}
      {screen.blocks.map((block) => (
        <CopyLine key={block.index} plan={plan} block={block} local={local} onCard={onCard} ride={onCard && screen.index === 0 ? pose.cy - ANCHOR.cy : 0} />
      ))}
    </AbsoluteFill>
  );
};
