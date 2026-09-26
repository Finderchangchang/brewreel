import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {FONT} from '../../../core/font';
import {EXPRS, Mascot, MascotG, POSES, SpeedLines} from './Mascot';
import {DISTRICT_KINDS, DistrictKind, DISTRICT, nightOf} from './palette';
import {CityWorld, layoutCity, sceneScale, toScreen} from './World';
import {Billboard, NeonSign, WaySign} from './signs';

// ============================================================
// journey / art 总览图（自检用，不是正式镜头）。part：
//   mascot  = 12 个姿态 + 10 个表情
//   city    = 6 个主题街区（白天）+ 天色走向 + 夜景霓虹
// 出图方法见同目录 README.md「总览图」。
// ============================================================
export type ArtSheetProps = {part?: 'mascot' | 'city' | 'frames'};

const BG = '#F4F1EA';
const Label: React.FC<{x: number; y: number; text: string; size?: number; color?: string}> = ({x, y, text, size = 30, color = '#2A2320'}) => (
  <div style={{position: 'absolute', left: x, top: y, fontFamily: FONT, fontSize: size, fontWeight: 800, color, whiteSpace: 'nowrap'}}>{text}</div>
);

const MascotSheet: React.FC<{t: number}> = ({t}) => {
  const cw = 540;
  const ch = 560;
  return (
    <AbsoluteFill style={{background: BG}}>
      <Label x={40} y={24} text="journey mascot: poses (pose) x hoverboard" size={40} />
      {POSES.map((p, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = col * cw;
        const y = 90 + row * ch;
        const night = i === 11 ? 1 : 0;
        return (
          <div key={p} style={{position: 'absolute', left: x + 12, top: y + 8, width: cw - 24, height: ch - 16, borderRadius: 24, background: night ? '#1B2447' : i % 2 ? '#D8EEF6' : '#E6F4EA'}}>
            <svg width={cw - 24} height={ch - 16} viewBox="-258 -400 516 544">
              <MascotG pose={p} t={t} poseT={p === 'spin' ? 0.3 : p === 'startled' ? 0.22 : t} night={night} speed={0.8} />
            </svg>
            <Label x={20} y={ch - 70} text={p} color={night ? '#fff' : '#2A2320'} />
          </div>
        );
      })}
      <Label x={40} y={90 + 3 * ch + 10} text="expressions (expr)" size={40} />
      {EXPRS.map((e, i) => {
        const cw2 = 216;
        const x = i * cw2;
        const y = 90 + 3 * ch + 70;
        return (
          <div key={e} style={{position: 'absolute', left: x + 6, top: y, width: cw2 - 12, height: 250, borderRadius: 20, background: '#FFFFFF'}}>
            <svg width={cw2 - 12} height={210} viewBox="-120 -320 250 254">
              <MascotG pose="cruise" expr={e} t={1.3} vehicle="none" fx="none" />
            </svg>
            <Label x={14} y={206} text={e} size={26} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const CitySheet: React.FC<{t: number}> = ({t}) => {
  const W = 2160;
  const rowH = 600;
  const skies = [0, 0.14, 0.3, 0.45, 0.66, 1];
  const gags: Record<string, number | undefined> = {launch: 1.1, data: 0.8, tools: 0.3};
  return (
    <AbsoluteFill style={{background: BG}}>
      <Label x={40} y={20} text="journey city: 6 districts, sky day -> dusk -> night (near 1.0 / mid 0.55 / far 0.12)" size={40} />
      {DISTRICT_KINDS.map((k, i) => {
        const lay = layoutCity([k], {introW: 0});
        return (
          <div key={k} style={{position: 'absolute', left: 0, top: 90 + i * rowH, width: W, height: rowH - 16, overflow: 'hidden'}}>
            <CityWorld w={W} h={rowH - 16} horizonY={rowH - 150} camX={-20} t={t} layout={lay} sky={skies[i]} scale={0.96} gags={{0: gags[k]}} />
            <div style={{position: 'absolute', left: 24, top: 18, padding: '6px 20px', background: '#FFFFFF', border: '4px solid #1F191A', borderRadius: 14, fontFamily: FONT, fontSize: 34, fontWeight: 900, color: DISTRICT[k].deep}}>
              {k} · sky {skies[i]}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// 三张拼好的示意帧（4:5）：白天 / 黄昏 / 夜晚，演示世界 + 角色 + 广告牌 + 路牌 + 霓虹怎么叠
const FrameDemo: React.FC<{t: number; kinds: DistrictKind[]; di: number; into: number; pose: Parameters<typeof MascotG>[0]['pose']; sky: number; night?: boolean; title: string; tag: string; tall?: boolean; gag?: number}> = ({t, kinds, di, into, pose, sky, night, title, tag, tall, gag}) => {
  const w = 1080;
  const h = tall ? 1920 : 1350;
  const horizon = tall ? 1560 : 1040;
  const lay = layoutCity(kinds);
  const d = lay.districts[di];
  const camX = d.x0 + into;
  const mx = w * 0.35;
  const my = (tall ? 1150 : 760) + Math.sin(t * Math.PI) * 14;
  const n = nightOf(sky);
  const bbX = toScreen(d.x0 + 1500, camX, w, 0.55);
  const col = DISTRICT[d.kind].main;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden'}}>
      <CityWorld w={w} h={h} horizonY={horizon} camX={camX} t={t} layout={lay} sky={sky} scale={sceneScale(h)} gags={{[di]: gag}} />
      {night ? (
        <NeonSign x={560} y={tall ? 330 : 150} w={440} h={250} text="Hola" sub="Espanol" color="#4DE6FF" p={sky} t={t} />
      ) : (
        <Billboard x={Math.min(w - 680, Math.max(150, bbX - 60))} y={tall ? 330 : 150} w={640} h={270} groundY={horizon} tag={tag} title={title} sub="sample / 2 lines max" color={col} p={sky} t={t} />
      )}
      <WaySign x={toScreen(d.x0 + 560, camX, w)} groundY={horizon + 20} label={d.kind.toUpperCase()} color={col} p={sky} badge={`${di + 1} / ${kinds.length}`} />
      <SpeedLines x={mx} y={my} t={t} amount={0.9} color={n > 0.5 ? '#9FEFFF' : '#FFFFFF'} size={260} />
      <Mascot x={mx} y={my} size={tall ? 320 : 260} t={t} pose={pose} night={n} speed={0.9} />
    </div>
  );
};

const FramesSheet: React.FC<{t: number}> = ({t}) => {
  const kinds: DistrictKind[] = ['docs', 'launch', 'tools', 'creative', 'data', 'global'];
  const s = 0.6667;
  const frames = [
    {di: 0, into: 380, pose: 'cruise' as const, sky: 0, title: 'Sample headline for the docs district', tag: 'DOCS'},
    {di: 4, into: 380, pose: 'study' as const, sky: 0.64, title: 'A chart that grows while you fly by', tag: 'DATA'},
    {di: 5, into: 620, pose: 'wave' as const, sky: 1, night: true, title: '', tag: ''},
  ];
  const tallFrames = [
    {di: 1, into: 700, pose: 'excited' as const, sky: 0.1, title: 'Version 2.0 is live today', tag: 'LAUNCH', gag: 1.0},
    {di: 2, into: 900, pose: 'think' as const, sky: 0.25, title: 'One toolbox for every step', tag: 'TOOLS'},
    {di: 3, into: 200, pose: 'point' as const, sky: 0.45, title: 'Draft, paint, ship', tag: 'CREATIVE'},
    {di: 5, into: 1300, pose: 'spin' as const, sky: 1, night: true, title: '', tag: ''},
  ];
  return (
    <AbsoluteFill style={{background: BG}}>
      {tallFrames.map((f, i) => (
        <div key={`v${i}`} style={{position: 'absolute', left: i * 540, top: 900, width: 536, height: 960, overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: 'scale(0.5)', transformOrigin: '0 0'}}>
            <FrameDemo t={t} kinds={kinds} tall {...f} />
          </div>
        </div>
      ))}
      {frames.map((f, i) => (
        <div key={i} style={{position: 'absolute', left: i * 720, top: 0, width: 716, height: 900, overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1350, transform: `scale(${s})`, transformOrigin: '0 0'}}>
            <FrameDemo t={t} kinds={kinds} {...f} />
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

export const artSheetSize = (p: ArtSheetProps) => (p.part === 'city' ? {width: 2160, height: 3700} : p.part === 'frames' ? {width: 2160, height: 1860} : {width: 2160, height: 2130});

export const ArtSheet: React.FC<ArtSheetProps> = ({part = 'mascot'}) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  if (part === 'city') return <CitySheet t={t} />;
  if (part === 'frames') return <FramesSheet t={t} />;
  return <MascotSheet t={t} />;
};
