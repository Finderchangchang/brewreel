// scene 原型合成。A / B 的 hero、stack、split 仍是整张卡片。
// headlinePlate 为 none 时，判断句（hero 主张、板式标题、片尾那一句）直接写在舞台上。
// 证据、图表绘图区和条目卡仍是圆角卡。
// 圆角、阴影、字重、描边、质感都从 plan.roles 来，不写死像素。
// 纸片入场走 poseAt → curveOf → settle / toss，这里不另写曲线。
import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {SERIF} from '../core/font.ts';
import {LegalMarkings} from '../lesson/overlays/LegalMarkings';
import {Character} from '../lesson/mascot/Character';
import type {MascotWardrobe} from '../lesson/mascot/poses';
import {resolveCartoonWardrobe} from '../lesson/mascot/cast.mjs';
import {cartoonBox} from '../lesson/presenter-place.mjs';
import type {LessonTheme} from '../lesson/theme';
import {LayoutProbe} from '../core/probe';
import {Icon} from '../core/icons';
import {BLOCK_CHIP_EM, CARD_PAD_X, chipFitWidth, dressOf, freshLowerBlob, showTitleTick, type SceneDress} from './look.ts';
import {emphasisLook} from './motion.ts';
import {fontFloorOf, holdPose, poseAt, type PlanBlock, type PlanScreen, type ScenePlan} from './prepare.ts';
import {fitSceneCopy} from './wrap.ts';
import {CollageFilm} from './backdrops/CollageFilm.tsx';
import {ArtFilm} from './backdrops/ArtFilm.tsx';
import {bandsForScreen, isArtStyle, type BandSource} from './backdrops/art-raster.ts';

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
      {texture === 'grain' && plan.style !== 'editorial' ? <Grain /> : null}
      {plan.style === 'editorial' ? <EditorialPaper ink={roles.ink} /> : null}
      {plan.style === 'fresh-light' ? <FreshBlobs accent={roles.accent} /> : null}
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
      {texture === 'grid' ? (
        <div
          data-probe-skip
          style={{
            position: 'absolute',
            inset: 0,
            // 1px 淡线在半分辨率缩略图里会被平均掉。判断句没有卡片时，网格要留得住，空帧检查才不会把整屏当成纯色。
            backgroundImage: `linear-gradient(${roles.line}CC 4px, transparent 4px), linear-gradient(90deg, ${roles.line}CC 4px, transparent 4px)`,
            backgroundSize: '72px 72px',
          }}
        />
      ) : null}
      {texture === 'bars' ? <Bars tint={roles.accent} /> : null}
      {texture === 'rays' ? <Rays tint={roles.accent} /> : null}
      {texture === 'confetti' ? <Confetti tint={roles.accent} line={roles.line} /> : null}
      {texture === 'wood' ? <WoodGrain line={roles.line} /> : null}
      {texture === 'clay' ? <ClayBlobs tint={roles.accent} /> : null}
      {texture === 'ink' ? <InkSpots tint={roles.ink} /> : null}
      {texture === 'cutpaper' ? <CutPaper tint={roles.accent} line={roles.line} /> : null}
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

function Bars({tint}: {tint: string}) {
  return <div data-probe-skip style={{position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(90deg, ${tint}22 0 18px, transparent 18px 92px)`}} />;
}

function Rays({tint}: {tint: string}) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none" style={{position: 'absolute', inset: 0}} data-probe-skip>
      <g stroke={tint} strokeWidth={16} opacity={0.16}>
        <line x1="0" y1="1920" x2="1080" y2="180" />
        <line x1="0" y1="1920" x2="760" y2="0" />
        <line x1="180" y1="1920" x2="1080" y2="420" />
      </g>
    </svg>
  );
}

function Confetti({tint, line}: {tint: string; line: string}) {
  const bits = [
    {x: 80, y: 180, w: 28, h: 14, c: tint},
    {x: 920, y: 260, w: 16, h: 16, c: line},
    {x: 140, y: 1500, w: 22, h: 10, c: tint},
    {x: 860, y: 1620, w: 14, h: 26, c: line},
    {x: 980, y: 900, w: 18, h: 18, c: tint},
  ];
  return (
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none" style={{position: 'absolute', inset: 0}} data-probe-skip>
      {bits.map((bit, index) => (
        <rect key={index} x={bit.x} y={bit.y} width={bit.w} height={bit.h} fill={bit.c} opacity={0.35} />
      ))}
    </svg>
  );
}

function WoodGrain({line}: {line: string}) {
  return (
    <div
      data-probe-skip
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `repeating-linear-gradient(98deg, ${line}18 0 2px, transparent 2px 14px)`,
      }}
    />
  );
}

function ClayBlobs({tint}: {tint: string}) {
  return (
    <div
      data-probe-skip
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(circle at 18% 22%, ${tint}33 0 90px, transparent 120px), radial-gradient(circle at 84% 78%, ${tint}28 0 120px, transparent 160px)`,
      }}
    />
  );
}

function InkSpots({tint}: {tint: string}) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none" style={{position: 'absolute', inset: 0}} data-probe-skip>
      <circle cx="160" cy="280" r="46" fill={tint} opacity={0.08} />
      <circle cx="940" cy="640" r="28" fill={tint} opacity={0.1} />
      <circle cx="220" cy="1560" r="36" fill={tint} opacity={0.08} />
    </svg>
  );
}

function CutPaper({tint, line}: {tint: string; line: string}) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none" style={{position: 'absolute', inset: 0}} data-probe-skip>
      <path d="M0 120 L 220 80 L 180 260 Z" fill={tint} opacity={0.2} />
      <path d="M1080 1700 L 860 1760 L 920 1560 Z" fill={line} opacity={0.28} />
    </svg>
  );
}

function FreshBlobs({accent}: {accent: string}) {
  const blob = freshLowerBlob();
  return (
    <div data-probe-skip style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: -140, top: 40, width: 680, height: 680, borderRadius: '50%', background: `radial-gradient(circle, ${accent}66 0%, ${accent}00 70%)`}} />
      <div style={{position: 'absolute', right: -180, top: 860, width: 760, height: 760, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0) 68%)'}} />
      <div
        style={{
          position: 'absolute',
          left: blob.left,
          bottom: blob.bottom,
          width: blob.width,
          height: blob.height,
          borderRadius: blob.radius,
          background: `radial-gradient(ellipse at 35% 40%, ${accent}66 0%, ${accent}22 62%, ${accent}00 74%)`,
        }}
      />
    </div>
  );
}

function EditorialPaper({ink}: {ink: string}) {
  return (
    <div data-probe-skip style={{position: 'absolute', inset: 0}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${ink}55 1px, transparent 1px), linear-gradient(90deg, ${ink}55 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div style={{position: 'absolute', left: 96, right: 96, top: 220, height: 1, background: ink}} />
      <div style={{position: 'absolute', left: 96, right: 96, top: 1500, height: 1, background: ink}} />
    </div>
  );
}

function onAccent(accent: string): string {
  const packed = Number.parseInt(accent.replace('#', ''), 16);
  if (!Number.isFinite(packed)) return '#1C1915';
  const r = (packed >> 16) & 255;
  const g = (packed >> 8) & 255;
  const b = packed & 255;
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  return y > 150 ? '#1C1915' : '#FFFFFF';
}

const NUMBER_LOCK = /^(\d+(?:\.\d+)?)(?:\s+)(\S+)$/;

function Copy({
  plan,
  text,
  width,
  font,
  minFont,
  color,
  align,
  family,
  weight,
  lineHeight,
  emphasis,
  tracking,
  shadow,
}: {
  plan: ScenePlan;
  text: string;
  width: number;
  font: number;
  minFont: number;
  color: string;
  align: PlanBlock['textAlign'] | 'end';
  family: string;
  weight: number;
  lineHeight: number;
  emphasis?: string[];
  tracking?: number;
  shadow?: string;
}) {
  const dress = dressOf(plan.style);
  const look = dress?.emphasis ?? emphasisLook(plan.motion);
  const chip = look === 'block' && Boolean(emphasis?.some((item) => item && text.includes(item)));
  let fitted = fitSceneCopy(text, Math.max(8, width), font, minFont);
  if (chip) fitted = fitSceneCopy(text, chipFitWidth(width, fitted.font, true), font, minFont);
  const lines = fitted.lines.length ? fitted.lines : text ? [text] : [];
  return (
    <div
      style={{
        fontFamily: family,
        fontWeight: weight,
        fontSize: fitted.font,
        lineHeight,
        color,
        textAlign: align,
        wordBreak: 'normal',
        letterSpacing: tracking ? `${tracking}em` : undefined,
        textShadow: shadow,
      }}
    >
      {lines.map((line, index) => (
        <div key={index} style={{whiteSpace: 'nowrap'}}>
          <Line text={line} emphasis={emphasis} accent={plan.roles.accent} look={look} />
        </div>
      ))}
    </div>
  );
}

function Line({text, emphasis, accent, look}: {text: string; emphasis?: string[]; accent: string; look: 'line' | 'block' | 'marker'}) {
  const word = emphasis?.find((item) => item && text.includes(item));
  if (!word) return <>{text}</>;
  const at = text.indexOf(word);
  const style: React.CSSProperties = look === 'block'
    ? {background: accent, color: onAccent(accent), padding: `0 ${BLOCK_CHIP_EM}em`, borderRadius: 4}
    : look === 'marker'
      ? {backgroundImage: `linear-gradient(${accent}, ${accent})`, backgroundRepeat: 'no-repeat', backgroundSize: '100% 0.38em', backgroundPosition: '0 86%'}
      : {boxShadow: `inset 0 -0.18em 0 ${accent}`};
  return (
    <>
      {text.slice(0, at)}
      <span style={style}>{word}</span>
      {text.slice(at + word.length)}
    </>
  );
}

function poseStyle(plan: ScenePlan, block: PlanBlock, local: number): React.CSSProperties {
  const pose = local + 1e-4 >= block.showAt
    ? poseAt(plan.motion, local - block.showAt, plan.height)
    : holdPose(plan.motion, plan.height);
  return {
    transform: `translateY(${pose.y}px) rotate(${pose.tilt}deg) scale(${pose.scale})`,
    transformOrigin: 'center center',
    opacity: pose.opacity,
  };
}

function cardChrome(plan: ScenePlan, screen: PlanScreen, block: PlanBlock, dress: SceneDress): React.CSSProperties {
  if (dress.end === 'masthead' && screen.layout === 'end') {
    // 报头落在白底牌上。透明字压在细网格上时，36×64 空帧检查会把整屏收成纸色。
    return {
      background: plan.roles.surface,
      boxShadow: 'none',
      border: `2px solid ${plan.roles.ink}`,
      borderRadius: 0,
    };
  }
  if (dress.end === 'chip' && screen.layout === 'end' && block.role === 'main') {
    return {boxShadow: `${plan.roles.shadow}, inset 0 -10px 0 ${plan.roles.accent}`};
  }
  if (dress.stage === 'paper-grid' && (screen.layout === 'split' || screen.layout === 'stack')) {
    return {background: 'transparent', boxShadow: 'none', border: 'none', borderRadius: 0};
  }
  if (dress.stage === 'paper-grid') {
    return {background: plan.roles.surface, boxShadow: 'none', border: `1px solid ${plan.roles.ink}`, borderRadius: 0};
  }
  if (dress.split === 'accent-bar' && screen.layout === 'split' && block.mark) {
    return {boxShadow: `${plan.roles.shadow}, inset 8px 0 0 ${plan.roles.accent}`};
  }
  if (dress.stage === 'blobs' && block.role === 'main' && screen.layout !== 'split') {
    return {boxShadow: `${plan.roles.shadow}, inset 0 8px 0 ${plan.roles.accent}`};
  }
  return {};
}

function titleLike(screen: PlanScreen, block: PlanBlock): boolean {
  if (block.role === 'main' || block.kind === 'stage') return true;
  return screen.layout === 'end' && block.index === 1;
}

function Card({plan, screen, block, local}: {plan: ScenePlan; screen: PlanScreen; block: PlanBlock; local: number}) {
  // 拍点之前也留在静止位。只藏起来的话，竖版大底上只剩一张小卡，会被空帧检查判成纯色。
  const pose = local + 1e-4 >= block.showAt
    ? poseAt(plan.motion, local - block.showAt, plan.height)
    : holdPose(plan.motion, plan.height);
  const dress = dressOf(plan.style);
  const chrome = dress ? cardChrome(plan, screen, block, dress) : {};
  const mainColor = block.role === 'support' ? plan.paint.muted : plan.paint.ink;
  const mainWeight = dress ? (titleLike(screen, block) ? dress.titleWeight : dress.bodyWeight) : plan.roles.weight;
  const noteWeight = dress ? dress.noteWeight : plan.roles.weight;
  const mainFamily = dress?.titleFont === 'serif' && titleLike(screen, block) ? SERIF : plan.fontFamily;
  return (
    <div
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        boxSizing: 'border-box',
        borderRadius: chrome.borderRadius ?? plan.roles.radius,
        background: chrome.background ?? plan.roles.surface,
        boxShadow: block.pane === 'right'
          ? `${chrome.boxShadow ?? plan.roles.shadow}, inset 0 0 0 4px ${plan.roles.accent}`
          : (chrome.boxShadow ?? plan.roles.shadow),
        border: block.pane === 'right' ? `3px solid ${plan.roles.accent}` : chrome.border !== undefined ? chrome.border : plan.cardBorder,
        transform: `translateY(${pose.y}px) rotate(${pose.tilt}deg) scale(${pose.scale})`,
        transformOrigin: 'center center',
        opacity: pose.opacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxSizing: 'border-box',
          padding: `16px ${CARD_PAD_X}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'stretch',
          gap: 8,
        }}
      >
      {dress?.end === 'masthead' && screen.layout === 'end' && block.role === 'main' ? (
        <>
          <div data-probe-skip style={{position: 'absolute', left: '12%', right: '12%', top: '18%', height: 2, background: plan.roles.ink}} />
          <div data-probe-skip style={{position: 'absolute', left: '12%', right: '12%', top: 'calc(18% + 8px)', height: 1, background: plan.roles.ink}} />
          <div data-probe-skip style={{position: 'absolute', left: '12%', right: '12%', bottom: 'calc(18% + 8px)', height: 1, background: plan.roles.ink}} />
          <div data-probe-skip style={{position: 'absolute', left: '12%', right: '12%', bottom: '18%', height: 2, background: plan.roles.ink}} />
        </>
      ) : null}
      {dress?.split === 'column-rule' && (screen.layout === 'stack' || screen.layout === 'split') ? (
        <div data-probe-skip style={{position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: plan.roles.ink}} />
      ) : null}
      {showTitleTick(dress?.stage, screen.blocks.some((item) => item.kind === 'kicker'), Boolean(block.mark)) ? (
        <div
          data-probe-skip
          style={{
            width: dress?.stage === 'paper-grid' ? 64 : 28,
            height: dress?.stage === 'paper-grid' ? 2 : 8,
            borderRadius: Math.min(plan.roles.radius, 4),
            background: plan.roles.accent,
            alignSelf: block.textAlign === 'center' ? 'center' : 'flex-start',
            flexShrink: 0,
          }}
        />
      ) : null}
      <Copy
        plan={plan}
        text={block.text}
        width={block.w - CARD_PAD_X * 2}
        font={block.font}
        minFont={fontFloorOf(plan, screen, block)}
        color={mainColor}
        align={block.textAlign}
        family={mainFamily}
        weight={mainWeight}
        lineHeight={1.15}
        emphasis={block.emphasis}
      />
      {block.note ? (
        <Copy
          plan={plan}
          text={block.note}
          width={block.w - CARD_PAD_X * 2}
          font={block.noteFont}
          minFont={plan.floor.aux}
          color={plan.paint.muted}
          align={block.textAlign}
          family={plan.fontFamily}
          weight={noteWeight}
          lineHeight={1.2}
        />
      ) : null}
      </div>
    </div>
  );
}

function DressedLine({plan, screen, block, local, dress}: {plan: ScenePlan; screen: PlanScreen; block: PlanBlock; local: number; dress: SceneDress}) {
  const lock = block.kind === 'stage' ? block.text.trim().match(NUMBER_LOCK) : null;
  const kicker = block.kind === 'kicker';
  const heading = titleLike(screen, block) || Boolean(lock);
  const family = heading && dress.titleFont === 'serif' ? SERIF : kicker ? plan.fontFamily : (block.mono && !heading ? plan.fontNumber : plan.fontFamily);
  const weight = kicker ? dress.kickerWeight : heading ? dress.titleWeight : dress.bodyWeight;
  const color = kicker && dress.stage === 'paper-grid' ? plan.roles.accent : plan.paint.stage;
  const unitFont = Math.max(plan.floor.aux, Math.round(block.font * 0.75));
  const pill = lock && dress.number === 'pill';
  const rule = lock && dress.number === 'rule';
  const cta = dress.end === 'chip' && screen.layout === 'end' && block.kind === 'caption' && block.index === 2;
  return (
    <div
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: block.textAlign === 'center' ? 'center' : 'flex-start',
        ...poseStyle(plan, block, local),
      }}
    >
      {lock ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: block.textAlign === 'center' ? 'center' : 'flex-start',
            maxWidth: '100%',
            gap: '0.18em',
            fontFamily: dress.titleFont === 'serif' ? SERIF : plan.fontNumber,
            fontWeight: dress.titleWeight,
            color: plan.paint.stage,
            lineHeight: 1,
            background: pill ? plan.roles.surface : 'transparent',
            borderRadius: pill ? plan.roles.radius : 0,
            boxShadow: pill ? plan.roles.shadow : 'none',
            padding: pill ? '0.12em 0.42em 0.18em' : 0,
            borderBottom: rule ? `3px solid ${plan.roles.accent}` : 'none',
          }}
        >
          <span style={{fontSize: block.font}}>{lock[1]}</span>
          <span style={{fontSize: unitFont, color: plan.roles.accent}}>{lock[2]}</span>
        </div>
      ) : (
        <div
          style={{
            maxWidth: '100%',
            background: cta ? plan.roles.surface : 'transparent',
            borderRadius: cta ? 999 : 0,
            boxShadow: cta ? plan.roles.shadow : 'none',
            padding: cta ? '10px 28px' : 0,
          }}
        >
          <Copy
            plan={plan}
            text={block.text}
            width={block.w - (cta ? 56 : 0)}
            font={block.font}
            minFont={fontFloorOf(plan, screen, block)}
            color={cta ? plan.paint.ink : color}
            align={block.textAlign}
            family={family}
            weight={weight}
            lineHeight={block.kind === 'stage' ? 1 : 1.15}
            emphasis={block.emphasis}
            tracking={kicker ? dress.kickerTrackingEm : 0}
          />
        </div>
      )}
    </div>
  );
}

function artHalo(style: string): string | undefined {
  if (style === 'impressionist') return '0 0 16px rgba(232,244,238,0.96), 0 0 3px rgba(232,244,238,0.94)';
  if (style === 'mural') return '0 0 12px rgba(244,234,214,0.94), 0 0 2px rgba(244,234,214,0.9)';
  return undefined;
}

function StageLine({plan, screen, block, local}: {plan: ScenePlan; screen: PlanScreen; block: PlanBlock; local: number}) {
  const dress = dressOf(plan.style);
  if (dress) return <DressedLine plan={plan} screen={screen} block={block} local={local} dress={dress} />;
  const lock = block.kind === 'stage' ? block.text.trim().match(NUMBER_LOCK) : null;
  const unitFont = Math.max(plan.floor.aux, Math.round(block.font * 0.75));
  const halo = artHalo(plan.style);
  return (
    <div
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: block.textAlign === 'center' ? 'center' : 'flex-start',
        ...poseStyle(plan, block, local),
      }}
    >
      {lock ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: block.textAlign === 'center' ? 'center' : 'flex-start',
            maxWidth: '100%',
            gap: '0.18em',
            fontFamily: plan.fontNumber,
            fontWeight: plan.roles.weight,
            color: plan.paint.stage,
            lineHeight: 1,
            textShadow: halo,
          }}
        >
          <span style={{fontSize: block.font}}>{lock[1]}</span>
          <span style={{fontSize: unitFont}}>{lock[2]}</span>
        </div>
      ) : (
        <Copy
          plan={plan}
          text={block.text}
          width={block.w}
          font={block.font}
          minFont={fontFloorOf(plan, screen, block)}
          color={plan.paint.stage}
          align={block.textAlign}
          family={block.mono ? plan.fontNumber : plan.fontFamily}
          weight={block.kind === 'kicker' ? 500 : plan.roles.weight}
          lineHeight={block.kind === 'stage' ? 1 : 1.15}
          emphasis={block.emphasis}
          shadow={halo}
        />
      )}
    </div>
  );
}

function Slotted({plan, screen, block, local}: {plan: ScenePlan; screen: PlanScreen; block: PlanBlock; local: number}) {
  const slot = block.slot;
  const textBox = block.textBox;
  const dress = dressOf(plan.style);
  const indexLabel = String(block.index + 1).padStart(2, '0');
  return (
    <div
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        boxSizing: 'border-box',
        borderRadius: (dress ? cardChrome(plan, screen, block, dress).borderRadius : undefined) ?? plan.roles.radius,
        background: (dress ? cardChrome(plan, screen, block, dress).background : undefined) ?? plan.roles.surface,
        boxShadow: (dress ? cardChrome(plan, screen, block, dress).boxShadow : undefined) ?? plan.roles.shadow,
        border: dress && cardChrome(plan, screen, block, dress).border !== undefined ? cardChrome(plan, screen, block, dress).border : plan.cardBorder,
        overflow: 'hidden',
        ...poseStyle(plan, block, local),
      }}
    >
      {slot && block.kind === 'node' ? (
        <div
          style={{
            position: 'absolute',
            left: slot.x - block.x,
            top: slot.y - block.y,
            width: slot.w,
            height: slot.h,
            boxSizing: 'border-box',
            borderRadius: dress?.step === 'index' ? 0 : '50%',
            border: dress?.step === 'disc' || dress?.step === 'index' ? 'none' : `4px solid ${plan.roles.accent}`,
            background: dress?.step === 'disc' ? plan.roles.accent : dress?.step === 'index' ? 'transparent' : plan.roles.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {dress?.step === 'index' ? (
            <span style={{fontFamily: SERIF, fontWeight: dress.titleWeight, fontSize: Math.max(plan.floor.aux, Math.round(slot.w * 0.62)), color: plan.roles.accent, letterSpacing: '-0.04em'}}>
              {indexLabel}
            </span>
          ) : block.icon ? (
            <Icon name={block.icon} size={Math.round(slot.w * 0.52)} color={dress?.step === 'disc' ? onAccent(plan.roles.accent) : plan.roles.accent} />
          ) : (
            <span style={{fontFamily: dress?.step === 'disc' ? plan.fontFamily : plan.fontNumber, fontWeight: plan.roles.weight, fontSize: Math.max(plan.floor.aux, Math.round(slot.w * 0.36)), color: dress?.step === 'disc' ? onAccent(plan.roles.accent) : plan.paint.ink}}>
              {block.index + 1}
            </span>
          )}
        </div>
      ) : null}
      {slot && block.kind !== 'node' && block.icon ? (
        <div
          data-probe-skip
          style={{
            position: 'absolute',
            left: slot.x - block.x,
            top: slot.y - block.y,
            width: slot.w,
            height: slot.h,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            borderRadius: dress?.step === 'disc' ? '50%' : 0,
            background: dress?.step === 'disc' ? plan.roles.accent : 'transparent',
            border: dress?.step === 'index' ? `1px solid ${plan.roles.ink}` : 'none',
          }}
        >
          <Icon name={block.icon} size={Math.round(slot.w * 0.72)} color={dress?.step === 'disc' ? onAccent(plan.roles.accent) : plan.roles.accent} />
        </div>
      ) : null}
      {textBox ? (
        <div
          style={{
            position: 'absolute',
            left: textBox.x - block.x,
            top: textBox.y - block.y,
            width: textBox.w,
            height: textBox.h,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Copy
            plan={plan}
            text={block.text}
            width={textBox.w}
            font={block.font}
            minFont={fontFloorOf(plan, screen, block)}
            color={plan.paint.ink}
            align={block.textAlign}
            family={plan.fontFamily}
            weight={dress ? dress.bodyWeight : plan.roles.weight}
            lineHeight={1.15}
            emphasis={block.emphasis}
          />
          {block.note ? (
            <Copy
              plan={plan}
              text={block.note}
              width={textBox.w}
              font={block.noteFont}
              minFont={plan.floor.aux}
              color={plan.paint.muted}
              align={block.textAlign}
              family={plan.fontFamily}
              weight={dress ? dress.noteWeight : plan.roles.weight}
              lineHeight={1.2}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Evidence({plan, screen, block, local}: {plan: ScenePlan; screen: PlanScreen; block: PlanBlock; local: number}) {
  const rows = screen.rows ?? [];
  const showImage = Boolean(screen.imageSrc);
  const showTable = !showImage && rows.length > 0;
  const showCode = !showImage && !showTable && Boolean(screen.code);
  const rowH = rows.length ? block.h / rows.length : block.h;
  const rowFont = Math.min(plan.floor.body, Math.max(plan.floor.aux, Math.floor(rowH * 0.42)));
  const dress = dressOf(plan.style);
  const aspect = screen.imageAspect && screen.imageAspect > 0 ? screen.imageAspect : block.w / Math.max(1, block.h);
  const boxAspect = block.w / Math.max(1, block.h);
  const imageBox = aspect > boxAspect
    ? {x: 0, y: (block.h - block.w / aspect) / 2, w: block.w, h: block.w / aspect}
    : {x: (block.w - block.h * aspect) / 2, y: 0, w: block.h * aspect, h: block.h};
  return (
    <div
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        boxSizing: 'border-box',
        borderRadius: dress?.evidence === 'hairline' ? 0 : plan.roles.radius,
        background: plan.roles.surface,
        boxShadow: dress?.evidence === 'hairline' ? 'none' : plan.roles.shadow,
        border: dress?.evidence === 'rounded' ? `4px solid ${plan.roles.accent}` : dress?.evidence === 'hairline' ? `1px solid ${plan.roles.ink}` : plan.cardBorder,
        overflow: 'hidden',
        ...poseStyle(plan, block, local),
      }}
    >
      {showImage && screen.imageSrc ? (
        <div style={{position: 'absolute', left: imageBox.x, top: imageBox.y, width: imageBox.w, height: imageBox.h}}>
          <Img src={screen.imageSrc} style={{width: '100%', height: '100%', objectFit: 'fill', display: 'block'}} />
          {screen.callouts ? screen.callouts.map((box, index) => (
            <div
              key={index}
              data-probe-skip
              style={{
                position: 'absolute',
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
                boxSizing: 'border-box',
                border: `3px solid ${plan.roles.accent}`,
                borderRadius: dress?.evidence === 'hairline' ? 0 : dress?.evidence === 'rounded' ? 12 : 6,
              }}
            />
          )) : null}
        </div>
      ) : null}
      {showTable ? rows.map((row, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 16,
            top: index * rowH,
            width: block.w - 32,
            height: rowH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxSizing: 'border-box',
            borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${plan.roles.line}`,
            fontFamily: plan.fontFamily,
            fontWeight: plan.roles.weight,
            fontSize: rowFont,
            color: plan.paint.ink,
          }}
        >
          <div style={{flex: '1 1 auto', minWidth: 0}}>
            <Copy
              plan={plan}
              text={row.label}
              width={Math.max(8, Math.floor((block.w - 32) * 0.62))}
              font={rowFont}
              minFont={plan.floor.tiny}
              color={plan.paint.ink}
              align="start"
              family={plan.fontFamily}
              weight={plan.roles.weight}
              lineHeight={1.15}
            />
          </div>
          <div style={{flex: '0 0 auto'}}>
            <Copy
              plan={plan}
              text={String(row.value)}
              width={Math.max(8, Math.floor((block.w - 32) * 0.34))}
              font={rowFont}
              minFont={plan.floor.tiny}
              color={plan.paint.ink}
              align="end"
              family={plan.fontNumber}
              weight={plan.roles.weight}
              lineHeight={1.15}
            />
          </div>
        </div>
      )) : null}
      {showCode ? (
        <pre
          style={{
            margin: 0,
            padding: 16,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            fontFamily: plan.fontNumber,
            fontSize: plan.floor.aux,
            lineHeight: 1.35,
            color: plan.paint.ink,
          }}
        >
          {screen.code}
        </pre>
      ) : null}
    </div>
  );
}

function Plot({plan, screen, block, local}: {plan: ScenePlan; screen: PlanScreen; block: PlanBlock; local: number}) {
  const chart = screen.chart;
  const points = chart?.points ?? [];
  const peak = Math.max(chart?.max ?? 0, ...points.map((point) => point.value), 1);
  const dress = dressOf(plan.style);
  const shell: React.CSSProperties = {
    position: 'absolute',
    left: block.x,
    top: block.y,
    width: block.w,
    height: block.h,
    boxSizing: 'border-box',
    borderRadius: dress?.evidence === 'hairline' ? 0 : plan.roles.radius,
    background: plan.roles.surface,
    boxShadow: dress?.evidence === 'hairline' ? 'none' : plan.roles.shadow,
    border: dress?.evidence === 'rounded' ? `4px solid ${plan.roles.accent}` : dress?.evidence === 'hairline' ? `1px solid ${plan.roles.ink}` : plan.cardBorder,
    overflow: 'hidden',
    ...poseStyle(plan, block, local),
  };
  if (!points.length) return <div style={shell} />;
  if (chart?.type === 'donut') return <Donut plan={plan} block={block} points={points} shell={shell} />;
  if (chart?.type === 'line') return <LineChart plan={plan} block={block} points={points} peak={peak} shell={shell} />;
  return <BarsChart plan={plan} block={block} points={points} peak={peak} shell={shell} />;
}

function BarsChart({plan, block, points, peak, shell}: {plan: ScenePlan; block: PlanBlock; points: {label: string; value: number; focus?: boolean}[]; peak: number; shell: React.CSSProperties}) {
  const pad = 16;
  const innerW = block.w - pad * 2;
  const rowH = (block.h - pad * 2) / points.length;
  const labelW = Math.round(innerW * 0.3);
  const valueW = Math.round(innerW * 0.18);
  const barW = Math.max(8, innerW - labelW - valueW - 16);
  const font = Math.min(plan.floor.body, Math.max(plan.floor.aux, Math.floor(rowH * 0.46)));
  return (
    <div style={shell}>
      {points.map((point, index) => (
        <div key={index} style={{position: 'absolute', left: pad, top: pad + index * rowH, width: innerW, height: rowH}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: labelW, height: rowH, display: 'flex', alignItems: 'center'}}>
            <Copy plan={plan} text={point.label} width={labelW} font={font} minFont={plan.floor.tiny} color={plan.paint.ink} align="start" family={plan.fontFamily} weight={plan.roles.weight} lineHeight={1.1} />
          </div>
          <div data-probe-skip style={{position: 'absolute', left: labelW + 8, top: rowH * 0.28, width: barW, height: Math.max(8, rowH * 0.4), background: plan.roles.line, borderRadius: dressOf(plan.style)?.number === 'pill' ? 999 : dressOf(plan.style)?.number === 'rule' ? 0 : 4}}>
            <div style={{width: `${Math.max(4, Math.min(100, (point.value / peak) * 100))}%`, height: '100%', background: point.focus ? plan.roles.accent : plan.paint.ink, borderRadius: dressOf(plan.style)?.number === 'pill' ? 999 : dressOf(plan.style)?.number === 'rule' ? 0 : 4}} />
          </div>
          <div style={{position: 'absolute', left: labelW + 8 + barW + 8, top: 0, width: valueW, height: rowH, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontFamily: plan.fontNumber, fontWeight: plan.roles.weight, fontSize: font, color: plan.paint.ink}}>
            {point.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({plan, block, points, peak, shell}: {plan: ScenePlan; block: PlanBlock; points: {label: string; value: number; focus?: boolean}[]; peak: number; shell: React.CSSProperties}) {
  const font = Math.min(plan.floor.body, Math.max(plan.floor.tiny ?? plan.floor.aux, 26));
  const labelH = font + 18;
  const plotH = Math.max(8, block.h - labelH - 16);
  const step = points.length > 1 ? (block.w - 32) / (points.length - 1) : 0;
  const xy = points.map((point, index) => {
    const x = 16 + index * step;
    const y = 8 + (1 - point.value / peak) * plotH;
    return {x, y};
  });
  const d = xy.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const colW = block.w / points.length;
  return (
    <div style={shell}>
      <svg width={block.w} height={plotH + 16} style={{position: 'absolute', left: 0, top: 0}} data-probe-skip>
        <path d={d} fill="none" stroke={plan.roles.accent} strokeWidth={4} />
        {xy.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r={points[index].focus ? 7 : 5} fill={plan.roles.accent} />
        ))}
      </svg>
      {points.map((point, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: index * colW,
            top: block.h - labelH,
            width: colW,
            height: labelH,
            textAlign: 'center',
            fontFamily: plan.fontFamily,
            fontWeight: plan.roles.weight,
            color: plan.paint.ink,
          }}
        >
          <Copy plan={plan} text={point.label} width={colW} font={font} minFont={plan.floor.tiny} color={plan.paint.ink} align="center" family={plan.fontFamily} weight={plan.roles.weight} lineHeight={1.1} />
        </div>
      ))}
    </div>
  );
}

function Donut({plan, block, points, shell}: {plan: ScenePlan; block: PlanBlock; points: {label: string; value: number; focus?: boolean}[]; shell: React.CSSProperties}) {
  const total = points.reduce((sum, point) => sum + point.value, 0) || 1;
  const size = Math.max(48, Math.min(block.h - 24, Math.round(block.w * 0.42)));
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  let cursor = 0;
  const rowH = block.h / points.length;
  const font = Math.min(plan.floor.body, Math.max(plan.floor.aux, Math.floor(rowH * 0.42)));
  const legendX = size + 28;
  return (
    <div style={shell}>
      <svg width={size} height={size} style={{position: 'absolute', left: 16, top: (block.h - size) / 2}} data-probe-skip>
        {points.map((point, index) => {
          const len = (point.value / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={point.focus ? plan.roles.accent : plan.roles.line}
              strokeWidth={14}
              strokeDasharray={dash}
              strokeDashoffset={-cursor}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          cursor += len;
          return el;
        })}
      </svg>
      {points.map((point, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: legendX,
            top: index * rowH,
            width: Math.max(8, block.w - legendX - 16),
            height: rowH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontFamily: plan.fontFamily,
            fontWeight: plan.roles.weight,
            fontSize: font,
            color: plan.paint.ink,
          }}
        >
          <div style={{flex: '1 1 auto', minWidth: 0}}>
            <Copy plan={plan} text={point.label} width={Math.max(8, block.w - legendX - 72)} font={font} minFont={plan.floor.tiny} color={plan.paint.ink} align="start" family={plan.fontFamily} weight={plan.roles.weight} lineHeight={1.1} />
          </div>
          <span style={{fontFamily: plan.fontNumber, whiteSpace: 'nowrap'}}>{point.value}</span>
        </div>
      ))}
    </div>
  );
}

function Links({plan, links}: {plan: ScenePlan; links: {x1: number; y1: number; x2: number; y2: number}[]}) {
  return (
    <svg width={plan.width} height={plan.height} style={{position: 'absolute', inset: 0}} data-probe-skip>
      {links.map((link, index) => (
        <line key={index} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} stroke={dressOf(plan.style)?.step === 'index' ? plan.roles.ink : plan.roles.accent} strokeWidth={dressOf(plan.style)?.step === 'index' ? 1 : dressOf(plan.style)?.step === 'disc' ? 6 : 4} />
      ))}
    </svg>
  );
}

/** 令牌 headlinePlate=none 时，判断句不上卡片。条目卡、证据、绘图区不受影响。A / B 没有这条令牌。 */
function bareJudgment(plan: ScenePlan, screen: PlanScreen, block: PlanBlock): boolean {
  if (plan.headlinePlate !== 'none') return false;
  if (block.kind === 'evidence' || block.kind === 'plot' || block.kind === 'node') return false;
  if (block.slot || block.textBox) return false;
  if (screen.layout === 'grid' || screen.layout === 'sequence' || screen.layout === 'split' || screen.layout === 'stack') return false;
  if (screen.layout === 'hero') return block.role === 'main' || block.role === 'support';
  if (screen.layout === 'end') return block.role === 'main' || block.kind === 'caption';
  if ((screen.layout === 'board' || screen.layout === 'number' || screen.layout === 'chart' || screen.layout === 'media') && block.kind === 'card' && block.role === 'main') return true;
  return false;
}

function GroupRule({plan, screen}: {plan: ScenePlan; screen: PlanScreen}) {
  const rule = screen.rule;
  if (!rule || rule.w < 1 || rule.h < 1) return null;
  return (
    <div
      data-probe-skip
      style={{
        position: 'absolute',
        left: rule.x,
        top: rule.y,
        width: rule.w,
        height: rule.h,
        borderRadius: 3,
        background: plan.roles.ink,
      }}
    />
  );
}

const LESSON_THEMES = new Set(['paper', 'lecture', 'product', 'editorial']);

function LessonChrome({plan, frame}: {plan: ScenePlan; frame: number}) {
  if (plan.product !== 'lesson') return null;
  const theme = (LESSON_THEMES.has(plan.style) ? plan.style : 'lecture') as LessonTheme;
  const presenter = plan.presenter;
  const showCartoon = presenter?.kind === 'cartoon';
  const showReal = presenter?.kind === 'real' || presenter?.kind === 'video';
  const box = showCartoon || (showReal && presenter?.src) ? cartoonBox('steps') : null;
  return (
    <>
      {/* 片头标识在讲课右上角（right: 80），超出内容区 x1800。标识本身不进内容区检查。 */}
      <div data-probe-skip>
        <LegalMarkings domain={plan.domain} lang="zh" frame={frame} totalFrames={plan.durationFrames} theme={theme} />
      </div>
      {box && showCartoon ? (
        <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.w / 2, overflow: 'hidden', zIndex: 24, background: plan.roles.surface}}>
          <Character
            pose="explain"
            fromPose="explain"
            progress={1}
            mouth={0}
            blink={0}
            elapsedMs={(frame / Math.max(1, plan.fps)) * 1000}
            wardrobe={resolveCartoonWardrobe({presenter, domain: plan.domain}) as MascotWardrobe | null}
            crop="circle"
            frameWidth={box.w}
            frameHeight={box.h}
          />
        </div>
      ) : null}
      {box && showReal && presenter?.src ? (
        <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.w / 2, overflow: 'hidden', zIndex: 24}}>
          <OffthreadVideo src={staticFile(presenter.src)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </div>
      ) : null}
    </>
  );
}

function SplitRule({plan, screen}: {plan: ScenePlan; screen: PlanScreen}) {
  const blocks = [...screen.blocks].sort((a, b) => a.y - b.y);
  let y: number | null = null;
  for (let i = 0; i < blocks.length - 1; i++) {
    const gap = blocks[i + 1].y - (blocks[i].y + blocks[i].h);
    if (gap > 8) {
      y = blocks[i].y + blocks[i].h + gap / 2;
      break;
    }
  }
  if (y == null) return null;
  return <div data-probe-skip style={{position: 'absolute', left: plan.safe.x, top: y, width: plan.safe.w, height: 1, background: plan.roles.ink}} />;
}

function SoundBed({plan}: {plan: ScenePlan}) {
  if (!plan.sound) return null;
  const end = Math.max(8, plan.durationFrames);
  return (
    <>
      {plan.sound.bgm ? (
        <Audio
          src={staticFile(plan.sound.bgm)}
          volume={(frame) => interpolate(frame, [0, 6, Math.max(7, end - 30), end], [0, 0.3, 0.3, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
        />
      ) : null}
      {(plan.sound.lines ?? []).map((line) => (
        <Sequence key={line.src} from={Math.max(0, line.startFrame)} layout="none">
          <Audio src={staticFile(line.src)} />
        </Sequence>
      ))}
    </>
  );
}

function artCaption(plan: ScenePlan, screen: PlanScreen, local: number): BandSource | null {
  const cap = plan.captions?.screens.find((item) => item.index === screen.index);
  if (!cap) return null;
  let page = cap.pages[0];
  for (const item of cap.pages) {
    if (local + 1e-6 >= item.startSec) page = item;
  }
  if (!page || local + 1e-6 < page.startSec) return null;
  const text = page.chars.map((item) => item.ch).join('');
  if (!text.trim()) return null;
  const font = page.font || 48;
  return {
    x: cap.box.x,
    y: cap.box.y,
    w: cap.box.w,
    h: cap.box.h,
    text,
    font,
    minFont: font,
    textAlign: 'center',
    kind: 'caption',
    lineHeight: 1.25,
  };
}

function Karaoke({plan, screen, local}: {plan: ScenePlan; screen: PlanScreen; local: number}) {
  const cap = plan.captions?.screens.find((item) => item.index === screen.index);
  if (!cap) return null;
  let page = cap.pages[0];
  for (const item of cap.pages) {
    if (local + 1e-6 >= item.startSec) page = item;
  }
  if (!page || local + 1e-6 < page.startSec) return null;
  const box = cap.box;
  const ink = plan.caption?.ink || plan.paint.stage;
  const hot = plan.caption?.hot || plan.roles.accent;
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: '100%',
          fontFamily: plan.fontFamily,
          fontWeight: plan.roles.weight,
          fontSize: page.font || 48,
          lineHeight: 1.25,
          textAlign: 'center',
          color: ink,
          textShadow: artHalo(plan.style) || (plan.caption?.shadow && plan.caption.shadow !== 'none' ? plan.caption.shadow : undefined),
        }}
      >
        {page.chars.map((item, index) =>
          item.ch === '\n' ? (
            <br key={index} />
          ) : (
            <span key={index} style={{color: local + 1e-4 >= item.at ? hot : ink}}>
              {item.ch}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function BlockView({plan, screen, block, local}: {plan: ScenePlan; screen: PlanScreen; block: PlanBlock; local: number}) {
  if (plan.captions?.coverScreens.includes(screen.index) && block.kind === 'caption') return null;
  if (isArtStyle(plan.style) && block.kind !== 'evidence' && block.kind !== 'plot') return <StageLine plan={plan} screen={screen} block={block} local={local} />;
  if (bareJudgment(plan, screen, block) || block.kind === 'stage' || block.kind === 'kicker' || block.kind === 'caption') return <StageLine plan={plan} screen={screen} block={block} local={local} />;
  if (block.kind === 'evidence') return <Evidence plan={plan} screen={screen} block={block} local={local} />;
  if (block.kind === 'plot') return <Plot plan={plan} screen={screen} block={block} local={local} />;
  if ((block.kind === 'card' || block.kind === 'node') && (block.slot || block.textBox)) return <Slotted plan={plan} screen={screen} block={block} local={local} />;
  return <Card plan={plan} screen={screen} block={block} local={local} />;
}

export const Scene: React.FC<SceneProps> = ({plan, __probe}) => {
  const frame = useCurrentFrame();
  if (!plan?.screens?.length) return <AbsoluteFill style={{background: '#FFFFFF'}} />;
  const screen = plan.screens.find((item) => frame >= item.startFrame && frame < item.startFrame + item.durationFrames) ?? plan.screens[plan.screens.length - 1];
  const local = (frame - screen.startFrame) / plan.fps;
  if (plan.style === 'cutpaper-collage') {
    return (
      <LayoutProbe frames={__probe}>
        <AbsoluteFill>
          <CollageFilm plan={plan} screen={screen} local={local} />
          <SoundBed plan={plan} />
        </AbsoluteFill>
      </LayoutProbe>
    );
  }
  return (
    <LayoutProbe frames={__probe}>
      <AbsoluteFill>
        {isArtStyle(plan.style) ? (
          <ArtFilm
            style={plan.style}
            bands={bandsForScreen(
              screen.layout,
              screen.blocks.map((block) => ({
                x: block.x,
                y: block.y,
                w: block.w,
                h: block.h,
                text: block.text,
                font: block.font,
                minFont: fontFloorOf(plan, screen, block),
                textAlign: block.textAlign,
                kind: block.kind,
              })),
              artCaption(plan, screen, local),
            )}
          />
        ) : (
          <Backdrop plan={plan} />
        )}
        <SoundBed plan={plan} />
        {screen.links?.length ? <Links plan={plan} links={screen.links} /> : null}
        {screen.rule ? <GroupRule plan={plan} screen={screen} /> : null}
        {screen.layout === 'split' && dressOf(plan.style)?.split === 'column-rule' ? <SplitRule plan={plan} screen={screen} /> : null}
        {screen.blocks.map((block) => (
          <BlockView key={`${screen.index}-${block.index}`} plan={plan} screen={screen} block={block} local={local} />
        ))}
        <Karaoke plan={plan} screen={screen} local={local} />
        <LessonChrome plan={plan} frame={frame} />
      </AbsoluteFill>
    </LayoutProbe>
  );
};
