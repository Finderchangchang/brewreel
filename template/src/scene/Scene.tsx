// scene 原型合成。hero / stack / split 仍是整张卡片。
// 新版式按块的 kind 画：证据板、节点、图表、大数字不进卡片。
// 圆角、阴影、字重、描边、质感都从 plan.roles 来，不写死像素。
// 纸片入场走 poseAt → curveOf → settle / toss，这里不另写曲线。
import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame} from 'remotion';
import {LayoutProbe} from '../core/probe';
import {Icon} from '../core/icons';
import {emphasisLook} from './motion.ts';
import {holdPose, poseAt, type PlanBlock, type PlanScreen, type ScenePlan} from './prepare.ts';

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
      {texture === 'grid' ? (
        <div
          data-probe-skip
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${roles.line}55 1px, transparent 1px), linear-gradient(90deg, ${roles.line}55 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
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

function onAccent(accent: string): string {
  const packed = Number.parseInt(accent.replace('#', ''), 16);
  if (!Number.isFinite(packed)) return '#1C1915';
  const r = (packed >> 16) & 255;
  const g = (packed >> 8) & 255;
  const b = packed & 255;
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  return y > 150 ? '#1C1915' : '#FFFFFF';
}

function Line({text, emphasis, accent, look}: {text: string; emphasis?: string[]; accent: string; look: 'line' | 'block' | 'marker'}) {
  const word = emphasis?.find((item) => item && text.includes(item));
  if (!word) return <>{text}</>;
  const at = text.indexOf(word);
  const style: React.CSSProperties = look === 'block'
    ? {background: accent, color: onAccent(accent), padding: '0 0.12em', borderRadius: 4}
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

function Card({plan, block, local}: {plan: ScenePlan; block: PlanBlock; local: number}) {
  // 拍点之前也留在静止位。只藏起来的话，竖版大底上只剩一张小卡，会被空帧检查判成纯色。
  const pose = local + 1e-4 >= block.showAt
    ? poseAt(plan.motion, local - block.showAt, plan.height)
    : holdPose(plan.motion, plan.height);
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
        borderRadius: plan.roles.radius,
        background: plan.roles.surface,
        boxShadow: plan.roles.shadow,
        border: plan.cardBorder,
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
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'stretch',
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
        <Line text={block.text} emphasis={block.emphasis} accent={plan.roles.accent} look={emphasisLook(plan.motion)} />
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
    </div>
  );
}

function StageLine({plan, block, local}: {plan: ScenePlan; block: PlanBlock; local: number}) {
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
      <div
        style={{
          maxWidth: '100%',
          fontFamily: block.mono ? plan.fontNumber : plan.fontFamily,
          fontWeight: block.kind === 'kicker' ? 500 : plan.roles.weight,
          fontSize: block.font,
          lineHeight: block.kind === 'stage' ? 1 : 1.15,
          color: plan.paint.stage,
          textAlign: block.textAlign,
        }}
      >
        <Line text={block.text} emphasis={block.emphasis} accent={plan.roles.accent} look={emphasisLook(plan.motion)} />
      </div>
    </div>
  );
}

function Slotted({plan, block, local}: {plan: ScenePlan; block: PlanBlock; local: number}) {
  const slot = block.slot;
  const textBox = block.textBox;
  const look = emphasisLook(plan.motion);
  return (
    <div
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        boxSizing: 'border-box',
        borderRadius: plan.roles.radius,
        background: plan.roles.surface,
        boxShadow: plan.roles.shadow,
        border: plan.cardBorder,
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
            borderRadius: '50%',
            border: `4px solid ${plan.roles.accent}`,
            background: plan.roles.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {block.icon ? (
            <Icon name={block.icon} size={Math.round(slot.w * 0.52)} color={plan.roles.accent} />
          ) : (
            <span style={{fontFamily: plan.fontNumber, fontWeight: plan.roles.weight, fontSize: Math.max(plan.floor.aux, Math.round(slot.w * 0.36)), color: plan.paint.ink}}>
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
          }}
        >
          <Icon name={block.icon} size={Math.round(slot.w * 0.72)} color={plan.roles.accent} />
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
          <div
            style={{
              fontFamily: plan.fontFamily,
              fontWeight: plan.roles.weight,
              fontSize: block.font,
              lineHeight: 1.15,
              color: plan.paint.ink,
              textAlign: block.textAlign,
            }}
          >
            <Line text={block.text} emphasis={block.emphasis} accent={plan.roles.accent} look={look} />
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
        borderRadius: plan.roles.radius,
        background: plan.roles.surface,
        boxShadow: plan.roles.shadow,
        border: plan.cardBorder,
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
                borderRadius: 6,
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
          <span>{row.label}</span>
          <span style={{fontFamily: plan.fontNumber}}>{row.value}</span>
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
  const shell: React.CSSProperties = {
    position: 'absolute',
    left: block.x,
    top: block.y,
    width: block.w,
    height: block.h,
    boxSizing: 'border-box',
    borderRadius: plan.roles.radius,
    background: plan.roles.surface,
    boxShadow: plan.roles.shadow,
    border: plan.cardBorder,
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
          <div style={{position: 'absolute', left: 0, top: 0, width: labelW, height: rowH, display: 'flex', alignItems: 'center', fontFamily: plan.fontFamily, fontWeight: plan.roles.weight, fontSize: font, color: plan.paint.ink}}>
            {point.label}
          </div>
          <div data-probe-skip style={{position: 'absolute', left: labelW + 8, top: rowH * 0.28, width: barW, height: Math.max(8, rowH * 0.4), background: plan.roles.line, borderRadius: 4}}>
            <div style={{width: `${Math.max(4, Math.min(100, (point.value / peak) * 100))}%`, height: '100%', background: point.focus ? plan.roles.accent : plan.paint.ink, borderRadius: 4}} />
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
            fontSize: font,
            color: plan.paint.ink,
          }}
        >
          {point.label}
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
          <span>{point.label}</span>
          <span style={{fontFamily: plan.fontNumber}}>{point.value}</span>
        </div>
      ))}
    </div>
  );
}

function Links({plan, links}: {plan: ScenePlan; links: {x1: number; y1: number; x2: number; y2: number}[]}) {
  return (
    <svg width={plan.width} height={plan.height} style={{position: 'absolute', inset: 0}} data-probe-skip>
      {links.map((link, index) => (
        <line key={index} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} stroke={plan.roles.accent} strokeWidth={4} />
      ))}
    </svg>
  );
}

function BlockView({plan, screen, block, local}: {plan: ScenePlan; screen: PlanScreen; block: PlanBlock; local: number}) {
  if (block.kind === 'stage' || block.kind === 'kicker' || block.kind === 'caption') return <StageLine plan={plan} block={block} local={local} />;
  if (block.kind === 'evidence') return <Evidence plan={plan} screen={screen} block={block} local={local} />;
  if (block.kind === 'plot') return <Plot plan={plan} screen={screen} block={block} local={local} />;
  if ((block.kind === 'card' || block.kind === 'node') && (block.slot || block.textBox)) return <Slotted plan={plan} block={block} local={local} />;
  return <Card plan={plan} block={block} local={local} />;
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
        {screen.links?.length ? <Links plan={plan} links={screen.links} /> : null}
        {screen.blocks.map((block) => (
          <BlockView key={`${screen.index}-${block.index}`} plan={plan} screen={screen} block={block} local={local} />
        ))}
      </AbsoluteFill>
    </LayoutProbe>
  );
};
