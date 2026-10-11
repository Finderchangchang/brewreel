// scene 原型合成。只画 hero / stack / split，片尾复用 hero 的块。
// 圆角、阴影、字重、描边、质感都从 plan.roles 来，不写死像素。
// 纸片入场走 poseAt → curveOf → settle / toss，这里不另写曲线。
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {LayoutProbe} from '../core/probe';
import {poseAt, type PlanBlock, type ScenePlan} from './prepare.ts';

export type SceneProps = {
  plan?: ScenePlan;
  __probe?: number[];
};

function Backdrop({plan}: {plan: ScenePlan}) {
  const {roles, backdrop} = plan;
  const texture = roles.texture;
  const base: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: texture === 'waves' || texture === 'bubbles' || texture === 'gradient'
      ? `linear-gradient(180deg, ${backdrop.top}, ${backdrop.bottom})`
      : roles.bg,
  };
  return (
    <div style={base} data-probe-skip>
      {texture === 'waves' || texture === 'bubbles' || texture === 'gradient' ? <WaveLines tint={roles.accent} /> : null}
      {texture === 'grain' ? <Grain /> : null}
      {texture === 'paper' ? (
        <div
          data-probe-skip
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(0deg, ${roles.line}22 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, ${roles.line}14 0 1px, transparent 1px 11px)`,
          }}
        />
      ) : null}
    </div>
  );
}

function WaveLines({tint}: {tint: string}) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none" style={{position: 'absolute', inset: 0}} data-probe-skip>
      <path d="M0 430 C 180 360, 360 520, 540 450 C 760 360, 900 520, 1080 440 L 1080 0 L 0 0 Z" fill={tint} opacity={0.18} />
      <path d="M0 1680 C 220 1580, 420 1780, 640 1660 C 820 1560, 960 1760, 1080 1660 L 1080 1920 L 0 1920 Z" fill="#FFFFFF" opacity={0.28} />
      <path d="M0 980 C 260 900, 480 1080, 760 980 C 900 930, 1000 1040, 1080 990" fill="none" stroke="#FFFFFF" strokeWidth={28} opacity={0.35} />
    </svg>
  );
}

function Grain() {
  return (
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0}} data-probe-skip>
      <filter id="scene-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
      </filter>
      <rect width="100%" height="100%" filter="url(#scene-grain)" opacity={0.22} />
    </svg>
  );
}

function Line({text, emphasis, accent}: {text: string; emphasis?: string[]; accent: string}) {
  const word = emphasis?.find((item) => item && text.includes(item));
  if (!word) return <>{text}</>;
  const at = text.indexOf(word);
  return (
    <>
      {text.slice(0, at)}
      <span style={{boxShadow: `inset 0 -0.18em 0 ${accent}`}}>{word}</span>
      {text.slice(at + word.length)}
    </>
  );
}

function Card({plan, block, local}: {plan: ScenePlan; block: PlanBlock; local: number}) {
  // 拍点之前也留在静止位。只藏起来的话，竖版大底上只剩一张小卡，会被空帧检查判成纯色。
  const pose = local + 1e-4 >= block.showAt
    ? poseAt(plan.motion, local - block.showAt, plan.height)
    : {y: 0, scale: 1, tilt: 0, opacity: 1};
  const mainColor = block.role === 'support' ? plan.paint.muted : plan.paint.ink;
  return (
    <div
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        boxSizing: 'border-box',
        padding: '16px 18px',
        borderRadius: plan.roles.radius,
        background: plan.roles.surface,
        boxShadow: plan.roles.shadow,
        border: plan.cardBorder,
        transform: `translateY(${pose.y}px) rotate(${pose.tilt}deg) scale(${pose.scale})`,
        transformOrigin: 'center center',
        opacity: pose.opacity,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {block.mark ? (
        <div
          data-probe-skip
          style={{
            width: 28,
            height: 8,
            borderRadius: Math.min(plan.roles.radius, 4),
            background: plan.roles.accent,
            alignSelf: block.textAlign === 'center' ? 'center' : 'flex-start',
            flexShrink: 0,
          }}
        />
      ) : null}
      <div
        style={{
          fontFamily: plan.fontFamily,
          fontWeight: plan.roles.weight,
          fontSize: block.font,
          lineHeight: 1.15,
          color: mainColor,
          textAlign: block.textAlign,
        }}
      >
        <Line text={block.text} emphasis={block.emphasis} accent={plan.roles.accent} />
      </div>
      {block.note ? (
        <div
          style={{
            fontFamily: plan.fontFamily,
            fontWeight: plan.roles.weight,
            fontSize: block.noteFont,
            lineHeight: 1.2,
            color: plan.paint.muted,
            textAlign: block.textAlign,
          }}
        >
          {block.note}
        </div>
      ) : null}
    </div>
  );
}

export const Scene: React.FC<SceneProps> = ({plan, __probe}) => {
  const frame = useCurrentFrame();
  if (!plan?.screens?.length) return <AbsoluteFill style={{background: '#FFFFFF'}} />;
  const screen = plan.screens.find((item) => frame >= item.startFrame && frame < item.startFrame + item.durationFrames) ?? plan.screens[plan.screens.length - 1];
  const local = (frame - screen.startFrame) / plan.fps;
  return (
    <LayoutProbe frames={__probe}>
      <AbsoluteFill>
        <Backdrop plan={plan} />
        {screen.blocks.map((block) => (
          <Card key={`${screen.index}-${block.index}`} plan={plan} block={block} local={local} />
        ))}
      </AbsoluteFill>
    </LayoutProbe>
  );
};
