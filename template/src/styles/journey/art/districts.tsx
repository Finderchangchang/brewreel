import React from 'react';
import {DISTRICT, DistrictKind, INK, NEON, hash, lit, mixHex, nightOf} from './palette';
import {Bench, Bunting, Bush, House, OUT, StreetLamp, Tower, Tree, Windows} from './city';
import {cloudPath, star5} from './shapes';
import {EVERYDAY_NEAR} from './everyday';
import {OLDTOWN_NEAR} from './oldtown';

// ============================================================
// journey / art 现代城市的六个主题街区（原创造型；日常街区见 everyday.tsx，古城街区见 oldtown.tsx）。每个街区 = 一段宽 DISTRICT_W 的近景模块 + 一段中景模块。
// 近景局部坐标：地面线 y = 0，x 0..DISTRICT_W；中景 x 0..midW。
//   docs     资料/文档：文件柜大楼（抽屉 + 冒出来的文件夹）、三本竖立的活页夹楼、文件夹招牌
//   post     发布/寄出：邮局（拱窗 + 钟楼）、一座邮筒楼（笑点时投信口翻开，吐出邮票贴纸——贴纸在 parts/props.tsx 的 GagFx 里飞）
//   tools    工具/工厂：工具箱大楼、锯齿屋顶车间 + 扳手招牌、塔吊吊箱子、传送带
//   creative 创意/设计：铅笔塔、溢出颜料的油漆桶楼、画架、调色板招牌
//   data     数据/资料：柱状图楼群 + 折线（gagT 起长高）、楼顶一块圆形饼图牌、量杯楼、服务器塔
//   global   夜景街：转动的地球仪、屋顶对话框招牌（写分镜里这一站的类别名和标签，另两块画星星和爱心；夜里像灯箱一样亮暖光）、串旗
// 日常街区（phone / home / cafe / market）在 everyday.tsx，古城街区（gate / bridge / teahouse / lantern）在 oldtown.tsx。
// gagT = 本街区笑点开始后的秒数（没有就不传），组件按它自己演（投信口翻开、柱子长高、箱子晃）。
// ============================================================

export const DISTRICT_W = 2200;

/** words = 街区自己的字（夜景街屋顶对话框上显示的类别名 / 标签，来自分镜），不传就画图标 */
export type DistrictArtProps = {p: number; t: number; gagT?: number; words?: string[]};
type C = (typeof DISTRICT)[DistrictKind];

const lamp = (x: number, p: number) => <StreetLamp key={`lamp${x}`} x={x} p={p} />;

// ---------------- docs ----------------
const DocsNear: React.FC<DistrictArtProps & {c: C}> = ({p, t, c}) => {
  const steel = '#DCEDE8';
  const drawers = [0, 1, 2, 3];
  const binders = [
    {x: 720, h: 430, col: c.main},
    {x: 800, h: 470, col: c.accent},
    {x: 880, h: 410, col: '#F58A4B'},
  ];
  const n = nightOf(p);
  return (
    <g>
      <House x={40} w={250} h={290} color={c.main} p={p} seed={11} roof="gable" win="arch" awning={c.accent} />
      {/* 文件柜大楼 */}
      <rect x={340} y={-548} width={310} height={548} rx={14} fill={lit(steel, p)} stroke={INK} strokeWidth={OUT} />
      {drawers.map((i) => {
        const y = -532 + i * 132;
        const out = i === 0 ? 34 : 0;
        return (
          <g key={i}>
            {i === 0 && (
              <g>
                <path d={`M ${380 + out},${y + 6} L ${392 + out},${y - 34} L ${452 + out},${y - 34} L ${460 + out},${y - 20} L ${520 + out},${y - 20} L ${520 + out},${y + 6} Z`} fill={lit(c.accent, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
                <path d={`M ${470 + out},${y + 6} L ${478 + out},${y - 48} L ${540 + out},${y - 48} L ${548 + out},${y - 30} L ${600 + out},${y - 30} L ${600 + out},${y + 6} Z`} fill={lit('#F58A4B', p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
              </g>
            )}
            <rect x={360 + out} y={y} width={270} height={116} rx={10} fill={lit(c.main, p)} stroke={INK} strokeWidth={OUT} />
            <rect x={438 + out} y={y + 18} width={114} height={34} rx={6} fill={mixHex('#FFFFFF', '#FFE9A8', n)} stroke={INK} strokeWidth={3} />
            <path d={`M ${452 + out},${y + 30} L ${520 + out},${y + 30} M ${452 + out},${y + 40} L ${500 + out},${y + 40}`} stroke="#9AA3B8" strokeWidth={4} strokeLinecap="round" />
            <rect x={455 + out} y={y + 70} width={80} height={20} rx={10} fill={lit('#EEF6F3', p)} stroke={INK} strokeWidth={3.5} />
          </g>
        );
      })}
      {/* 柜顶盆栽 */}
      <path d="M 590,-548 L 596,-590 L 632,-590 L 638,-548 Z" fill={lit('#FF8A3D', p)} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M 614,-592 Q 590,-640 566,-630 Q 588,-612 612,-594 M 614,-592 Q 632,-650 660,-640 Q 640,-616 616,-594" fill={lit('#4FAE6A', p)} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      {/* 三本竖立的活页夹楼 */}
      {binders.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={-b.h} width={76} height={b.h} rx={10} fill={lit(b.col, p)} stroke={INK} strokeWidth={OUT} />
          <rect x={b.x + 14} y={-b.h + 40} width={48} height={120} rx={6} fill={mixHex('#FFFFFF', '#FFE9A8', n)} stroke={INK} strokeWidth={3} />
          <path d={`M ${b.x + 22},${-b.h + 70} L ${b.x + 54},${-b.h + 70} M ${b.x + 22},${-b.h + 90} L ${b.x + 48},${-b.h + 90} M ${b.x + 22},${-b.h + 110} L ${b.x + 52},${-b.h + 110}`} stroke="#9AA3B8" strokeWidth={4} strokeLinecap="round" />
          <circle cx={b.x + 38} cy={-70} r={16} fill={lit(mixHex(b.col, INK, 0.45), p)} stroke={INK} strokeWidth={3.5} />
          <Windows x={b.x + 10} y={-b.h + 190} w={56} h={b.h - 290} kind="round" cols={1} p={p} seed={40 + i} />
        </g>
      ))}
      <Tree x={1030} p={p} seed={2} />
      {/* 资料馆：文件夹招牌 */}
      <House x={1120} w={400} h={300} color={c.deep} p={p} seed={13} roof="step" win="tall" door />
      <g transform="translate(1250,-236)">
        <path d="M 0,10 L 0,-40 Q 0,-48 8,-48 L 50,-48 L 62,-36 L 132,-36 Q 140,-36 140,-28 L 140,10 Z" fill={lit(c.accent, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <rect x={-6} y={-24} width={152} height={70} rx={8} fill={lit(mixHex(c.accent, '#FFFFFF', 0.35), p)} stroke={INK} strokeWidth={OUT} />
      </g>
      {lamp(1580, p)}
      <House x={1660} w={250} h={260} color={c.main} p={p} seed={14} roof="gable" win="grid" />
      <House x={1930} w={240} h={330} color={mixHex(c.main, '#FFFFFF', 0.25)} p={p} seed={15} roof="flat" win="arch" awning="#FF7B6B" />
      {/* 纸箱 */}
      {[0, 1, 2].map((i) => (
        <g key={`box${i}`} transform={`translate(${1530 + (i === 2 ? 30 : i * 62)},${i === 2 ? -94 : -44})`}>
          <rect x={0} y={0} width={58} height={50} rx={4} fill={lit('#D9A066', p)} stroke={INK} strokeWidth={3.5} />
          <rect x={16} y={14} width={26} height={10} rx={5} fill={lit('#8A5A3B', p)} />
        </g>
      ))}
      <Bush x={300} p={p} w={80} />
      {lamp(1000 - 20, p)}
      {void t}
    </g>
  );
};

// ---------------- post ----------------
const PostNear: React.FC<DistrictArtProps & {c: C}> = ({p, t, gagT, c}) => {
  const n = nightOf(p);
  const g = gagT ?? -9;
  // 邮筒楼（x 1000–1180）：投信口的挡板在笑点前 0.2 秒翻开，吐完贴纸 1 秒后合上；楼身一抖
  const open = Math.max(0, Math.min(1, (g + 0.2) / 0.15)) * (1 - Math.max(0, Math.min(1, (g - 1) / 0.2)));
  const shake = g > 0 && g < 0.4 ? Math.sin(g * 70) * 3 : 0;
  const clock = t * 12;
  const white = lit('#F4F9F7', p);
  return (
    <g>
      <House x={40} w={220} h={250} color={mixHex(c.main, '#FFFFFF', 0.2)} p={p} seed={21} roof="gable" win="grid" />
      {/* 邮局：一排拱窗 + 钟楼 */}
      <g>
        <rect x={470} y={-470} width={120} height={180} rx={10} fill={lit(c.accent, p)} stroke={INK} strokeWidth={OUT} />
        <path d="M 460,-470 L 530,-540 L 600,-470 Z" fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <circle cx={530} cy={-395} r={42} fill={white} stroke={INK} strokeWidth={OUT} />
        <path d={`M 530,-395 L ${530 + Math.cos((clock * Math.PI) / 180) * 26},${-395 + Math.sin((clock * Math.PI) / 180) * 26} M 530,-395 L 530,-420`} stroke={INK} strokeWidth={5} strokeLinecap="round" />
        <House x={300} w={420} h={300} color={c.accent} p={p} seed={22} roof="flat" win="arch" door />
        <rect x={330} y={-150} width={360} height={40} rx={8} fill={lit(c.main, p)} stroke={INK} strokeWidth={3.5} />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M ${350 + i * 72},-142 l 44,0 l 0,24 l -44,0 Z M ${350 + i * 72},-142 l 22,14 l 22,-14`} fill={mixHex('#FFFFFF', '#FFE9A8', n)} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        ))}
      </g>
      {/* 邮筒楼：圆顶筒身、投信口、邮筒帽檐、底座 */}
      <g transform={`translate(${shake},0)`}>
        <rect x={960} y={-40} width={260} height={40} rx={8} fill={lit('#86A2A4', p)} stroke={INK} strokeWidth={OUT} />
        <path d="M 1000,-40 L 1000,-470 Q 1000,-560 1090,-560 Q 1180,-560 1180,-470 L 1180,-40 Z" fill={lit(c.main, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <path d="M 988,-470 Q 1090,-500 1192,-470 L 1192,-448 Q 1090,-478 988,-448 Z" fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <rect x={1030} y={-344} width={120} height={28} rx={8} fill={INK} />
        <g transform={`rotate(${-70 * open},1030,-344)`}>
          <rect x={1026} y={-360} width={128} height={20} rx={6} fill={lit(c.deep, p)} stroke={INK} strokeWidth={3.5} />
        </g>
        {/* 筒身上的信封标 */}
        <rect x={1044} y={-250} width={92} height={62} rx={6} fill={white} stroke={INK} strokeWidth={3.5} />
        <path d="M 1044,-250 L 1090,-214 L 1136,-250" fill="none" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
        <rect x={1030} y={-150} width={120} height={60} rx={8} fill={lit(mixHex(c.main, '#FFFFFF', 0.3), p)} stroke={INK} strokeWidth={3.5} />
        <path d="M 1040,-120 L 1140,-120" stroke={INK} strokeWidth={3} strokeDasharray="8 6" />
      </g>
      <Tree x={1350} p={p} seed={7} />
      {lamp(1440, p)}
      <House x={1510} w={280} h={300} color={c.main} p={p} seed={23} roof="arc" win="arch" awning="#FFB627" />
      <House x={1810} w={260} h={250} color={mixHex(c.accent, '#FFFFFF', 0.3)} p={p} seed={24} roof="flat" win="grid" />
      <Bench x={760} p={p} color={c.main} />
    </g>
  );
};

// ---------------- tools ----------------
const ToolsNear: React.FC<DistrictArtProps & {c: C}> = ({p, t, gagT, c}) => {
  const swing = Math.sin(t * 1.8) * 7 + (gagT !== undefined && gagT > 0 ? Math.sin(gagT * 9) * Math.exp(-gagT * 2) * 18 : 0);
  const belt = (t * 90) % 150;
  const slate = '#3F6A74';
  return (
    <g>
      {/* 工具箱大楼 */}
      <path d="M 170,-330 L 170,-390 Q 170,-410 190,-410 L 370,-410 Q 390,-410 390,-390 L 390,-330" fill="none" stroke={INK} strokeWidth={34} strokeLinecap="round" />
      <path d="M 170,-330 L 170,-390 Q 170,-410 190,-410 L 370,-410 Q 390,-410 390,-390 L 390,-330" fill="none" stroke={lit('#3E5561', p)} strokeWidth={24} strokeLinecap="round" />
      <rect x={60} y={-340} width={440} height={340} rx={16} fill={lit(c.main, p)} stroke={INK} strokeWidth={OUT} />
      <rect x={60} y={-340} width={440} height={80} rx={16} fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} />
      <rect x={110} y={-280} width={40} height={36} rx={6} fill={lit('#C3D6D1', p)} stroke={INK} strokeWidth={3.5} />
      <rect x={410} y={-280} width={40} height={36} rx={6} fill={lit('#C3D6D1', p)} stroke={INK} strokeWidth={3.5} />
      <Windows x={90} y={-230} w={380} h={130} kind="grid" p={p} seed={31} rows={2} />
      <rect x={250} y={-80} width={60} height={80} rx={10} fill={lit(c.accent, p)} stroke={INK} strokeWidth={OUT} />
      {/* 锯齿车间 + 扳手招牌 */}
      <House x={580} w={460} h={250} color={slate} p={p} seed={32} roof="saw" win="band" door={false} roofColor="#3A5260" />
      <rect x={700} y={-130} width={220} height={130} rx={6} fill={lit('#C3D6D1', p)} stroke={INK} strokeWidth={OUT} />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={700} y1={-110 + i * 24} x2={920} y2={-110 + i * 24} stroke={INK} strokeWidth={3} opacity={0.5} />
      ))}
      <g transform="translate(810,-360) rotate(-24)">
        <rect x={-18} y={-10} width={36} height={170} rx={16} fill={lit('#C3D6D1', p)} stroke={INK} strokeWidth={OUT} />
        <path d="M -44,-40 Q -48,-80 -14,-92 L -14,-52 L 14,-52 L 14,-92 Q 48,-80 44,-40 Q 40,-8 0,-6 Q -40,-8 -44,-40 Z" fill={lit('#C3D6D1', p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <circle cx={0} cy={130} r={9} fill={lit(c.main, p)} stroke={INK} strokeWidth={3} />
      </g>
      {/* 塔吊 */}
      <g>
        <rect x={1300} y={-620} width={60} height={620} fill="none" stroke={lit(c.main, p)} strokeWidth={10} />
        {Array.from({length: 8}, (_, i) => (
          <path key={i} d={`M 1300,${-620 + i * 77} L 1360,${-543 + i * 77}`} stroke={lit(c.main, p)} strokeWidth={7} />
        ))}
        <rect x={1296} y={-624} width={68} height={624} fill="none" stroke={INK} strokeWidth={3} />
        <rect x={960} y={-660} width={520} height={34} fill={lit(c.main, p)} stroke={INK} strokeWidth={OUT} />
        <rect x={1400} y={-700} width={70} height={40} fill={lit('#3E5561', p)} stroke={INK} strokeWidth={OUT} />
        <rect x={1318} y={-700} width={28} height={40} fill={lit('#8FD3FF', p)} stroke={INK} strokeWidth={3} />
        <g transform={`rotate(${swing},1060,-626)`}>
          <line x1={1060} y1={-626} x2={1060} y2={-380} stroke={INK} strokeWidth={4} />
          <path d="M 1052,-380 L 1068,-380 L 1068,-362 Q 1082,-356 1076,-344" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <path d="M 1060,-362 L 1010,-320 M 1060,-362 L 1110,-320" stroke={INK} strokeWidth={3} />
          <rect x={990} y={-320} width={140} height={100} rx={8} fill={lit('#D9A066', p)} stroke={INK} strokeWidth={OUT} />
          <path d="M 990,-290 L 1130,-290" stroke={INK} strokeWidth={3} opacity={0.4} />
          <rect x={1030} y={-276} width={60} height={34} rx={6} fill={lit(c.main, p)} stroke={INK} strokeWidth={3} />
        </g>
      </g>
      {/* 传送带 */}
      <g>
        <rect x={1420} y={-96} width={420} height={30} rx={15} fill={lit('#3E5561', p)} stroke={INK} strokeWidth={OUT} />
        {Array.from({length: 7}, (_, i) => (
          <circle key={i} cx={1440 + i * 63} cy={-81} r={9} fill={lit('#C3D6D1', p)} stroke={INK} strokeWidth={3} />
        ))}
        <path d="M 1460,-66 L 1450,0 M 1800,-66 L 1810,0" stroke={INK} strokeWidth={10} strokeLinecap="round" />
        {[0, 1, 2].map((i) => {
          const x = 1420 + ((belt + i * 150) % 450) - 30;
          if (x < 1410 || x > 1790) return null;
          const col = [c.main, '#F58A4B', '#3259C9'][i];
          return <rect key={i} x={x} y={-150} width={54} height={54} rx={6} fill={lit(col, p)} stroke={INK} strokeWidth={3.5} />;
        })}
      </g>
      <House x={1880} w={290} h={310} color={mixHex(c.main, '#FFFFFF', 0.2)} p={p} seed={33} roof="gable" win="grid" />
      {lamp(1180, p)}
      <Bush x={520} p={p} w={60} />
    </g>
  );
};

// ---------------- creative ----------------
const CreativeNear: React.FC<DistrictArtProps & {c: C}> = ({p, t, c}) => {
  const n = nightOf(p);
  const drip = (x: number, len: number, col: string, k: number) => {
    const L = len * (0.85 + 0.15 * Math.sin(t * 1.5 + k));
    return <path key={k} d={`M ${x - 16},-300 L ${x - 16},${-300 + L} Q ${x - 16},${-300 + L + 16} ${x},${-300 + L + 16} Q ${x + 16},${-300 + L + 16} ${x + 16},${-300 + L} L ${x + 16},-300 Z`} fill={lit(col, p)} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />;
  };
  return (
    <g>
      <House x={40} w={240} h={300} color={mixHex(c.accent, '#FFFFFF', 0.2)} p={p} seed={41} roof="flat" win="grid" awning={c.main} />
      {/* 铅笔塔 */}
      <g>
        <rect x={340} y={-46} width={140} height={46} rx={10} fill={lit('#FFA46B', p)} stroke={INK} strokeWidth={OUT} />
        <rect x={336} y={-96} width={148} height={52} fill={lit('#C3D6D1', p)} stroke={INK} strokeWidth={OUT} />
        <path d="M 336,-78 L 484,-78 M 336,-62 L 484,-62" stroke={INK} strokeWidth={3} opacity={0.5} />
        <rect x={340} y={-470} width={140} height={374} fill={lit('#FFB627', p)} stroke={INK} strokeWidth={OUT} />
        <rect x={386} y={-470} width={48} height={374} fill={lit('#FFAA3B', p)} />
        <line x1={386} y1={-470} x2={386} y2={-96} stroke={INK} strokeWidth={3} />
        <line x1={434} y1={-470} x2={434} y2={-96} stroke={INK} strokeWidth={3} />
        <path d="M 340,-470 L 410,-600 L 480,-470 Z" fill={lit('#F2D2A2', p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <path d="M 388,-560 L 410,-600 L 432,-560 Q 410,-550 388,-560 Z" fill={INK} />
        <Windows x={350} y={-440} w={120} h={320} kind="round" cols={1} rows={4} p={p} seed={42} />
      </g>
      {/* 油漆桶楼 */}
      <g>
        <path d="M 600,-300 Q 760,-440 920,-300" fill="none" stroke={INK} strokeWidth={12} />
        <path d="M 580,-300 L 940,-300 L 910,0 L 610,0 Z" fill={lit(c.main, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <ellipse cx={760} cy={-300} rx={184} ry={26} fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} />
        {drip(650, 90, '#FFB627', 1)}
        {drip(730, 140, '#7CFFD0', 2)}
        {drip(820, 70, c.accent, 3)}
        {drip(880, 110, '#FFFFFF', 4)}
        <Windows x={640} y={-170} w={240} h={90} kind="grid" rows={1} p={p} seed={43} />
        <rect x={730} y={-76} width={60} height={76} rx={10} fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} />
      </g>
      {/* 画架 */}
      <g>
        <path d="M 1080,-380 L 1010,0 M 1080,-380 L 1150,0 M 1080,-380 L 1100,0" stroke={lit('#8A5A3B', p)} strokeWidth={14} strokeLinecap="round" />
        <path d="M 1080,-380 L 1010,0 M 1080,-380 L 1150,0" stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        <rect x={950} y={-350} width={260} height={200} rx={6} fill={lit('#FFFDF7', p)} stroke={INK} strokeWidth={OUT} />
        <circle cx={1150} cy={-300} r={26} fill={lit('#FFB627', p)} />
        <path d="M 960,-160 Q 1020,-250 1080,-190 Q 1130,-240 1200,-170 L 1200,-160 Z" fill={lit(c.main, p)} />
        <path d="M 980,-280 Q 1030,-320 1080,-285" fill="none" stroke={lit(c.accent, p)} strokeWidth={12} strokeLinecap="round" />
        <rect x={960} y={-150} width={240} height={18} rx={6} fill={lit('#8A5A3B', p)} stroke={INK} strokeWidth={3.5} />
      </g>
      {/* 调色板招牌楼 */}
      <House x={1280} w={320} h={290} color={c.accent} p={p} seed={44} roof="arc" win="grid" />
      <g transform="translate(1440,-420)">
        <path d="M -110,10 C -120,-60 -40,-90 30,-80 C 110,-70 130,0 90,30 C 60,50 40,20 10,40 C -20,60 -100,70 -110,10 Z" fill={lit('#F2D2A2', p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <ellipse cx={40} cy={10} rx={16} ry={12} fill={lit(c.accent, p)} stroke={INK} strokeWidth={3} />
        {['#FF7A45', '#FFB627', '#2F9E6E', '#3259C9', c.main].map((col, i) => (
          <circle key={i} cx={-70 + i * 34} cy={-40 + (i % 2) * 18} r={14} fill={n > 0.5 ? NEON[i % NEON.length] : col} stroke={INK} strokeWidth={3} />
        ))}
      </g>
      {lamp(1640, p)}
      <House x={1720} w={240} h={320} color="#FF8A3D" p={p} seed={45} roof="gable" win="arch" />
      <Tree x={2060} p={p} seed={9} />
    </g>
  );
};

// ---------------- data ----------------
const DataNear: React.FC<DistrictArtProps & {c: C}> = ({p, t, gagT, c}) => {
  const n = nightOf(p);
  const g = gagT ?? 99;
  const grow = (i: number) => {
    const k = Math.max(0, Math.min(1, (g - i * 0.12) / 0.5));
    return 0.45 + 0.55 * (1 - Math.pow(1 - k, 3));
  };
  const hs = [220, 300, 390, 500];
  const cols = [c.main, c.accent, c.deep, '#FFB627'];
  const tops = hs.map((h, i) => [80 + i * 126 + 55, -h * grow(i)] as const);
  const line = mixHex('#FF7A45', NEON[1], n);
  const bub = (i: number) => {
    const k = ((t * 0.5 + hash(i)) % 1 + 1) % 1;
    return <circle key={i} cx={1320 + (hash(i * 3) - 0.5) * 160} cy={-110 - k * 170} r={8 + hash(i * 7) * 10} fill="#FFFFFF" opacity={0.8 * (1 - k)} />;
  };
  return (
    <g>
      {/* 柱状图楼群 */}
      {hs.map((h, i) => {
        const hh = h * grow(i);
        return (
          <g key={i}>
            <rect x={80 + i * 126} y={-hh} width={110} height={hh} rx={8} fill={lit(cols[i], p)} stroke={INK} strokeWidth={OUT} />
            <Windows x={90 + i * 126} y={-hh + 20} w={90} h={Math.max(40, hh - 110)} kind="grid" cols={2} p={p} seed={50 + i} />
          </g>
        );
      })}
      <polyline points={tops.map(([x, y]) => `${x},${y - 60}`).join(' ')} fill="none" stroke={INK} strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" />
      {n > 0.1 && <polyline points={tops.map(([x, y]) => `${x},${y - 60}`).join(' ')} fill="none" stroke={line} strokeWidth={22} opacity={0.3 * n} strokeLinejoin="round" />}
      <polyline points={tops.map(([x, y]) => `${x},${y - 60}`).join(' ')} fill="none" stroke={line} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
      {tops.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y - 60} r={12} fill="#FFFFFF" stroke={INK} strokeWidth={4} />
      ))}
      {/* 楼顶一块圆形饼图牌（立在两根短柱上，不是穹顶） */}
      <g>
        <House x={690} w={400} h={230} color={c.deep} p={p} seed={55} roof="flat" win="tall" />
        <rect x={846} y={-300} width={14} height={70} fill={INK} />
        <rect x={920} y={-300} width={14} height={70} fill={INK} />
        <circle cx={890} cy={-380} r={96} fill={lit(c.main, p)} stroke={INK} strokeWidth={OUT} />
        <path d="M 890,-380 L 890,-476 A 96 96 0 0 1 973,-332 Z" fill={lit('#FFB627', p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <path d="M 890,-380 L 973,-332 A 96 96 0 0 1 842,-297 Z" fill={lit(c.accent, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      </g>
      {/* 量杯楼 */}
      <g>
        <defs>
          <clipPath id="jFlask">
            <circle cx={1320} cy={-170} r={150} />
          </clipPath>
        </defs>
        <rect x={1275} y={-450} width={90} height={150} fill={lit('#E9F7FA', p)} stroke={INK} strokeWidth={OUT} />
        <rect x={1258} y={-470} width={124} height={30} rx={10} fill={lit('#E9F7FA', p)} stroke={INK} strokeWidth={OUT} />
        <circle cx={1320} cy={-170} r={150} fill={lit('#E9F7FA', p)} />
        <g clipPath="url(#jFlask)">
          <path d={`M 1150,${-150 + Math.sin(t * 2) * 6} Q 1240,${-175 + Math.sin(t * 2 + 1) * 8} 1320,-150 Q 1400,${-125 + Math.sin(t * 2 + 2) * 8} 1490,-150 L 1490,0 L 1150,0 Z`} fill={lit(c.accent, p)} />
          {Array.from({length: 6}, (_, i) => bub(i))}
        </g>
        <circle cx={1320} cy={-170} r={150} fill="none" stroke={INK} strokeWidth={OUT} />
        <path d="M 1230,-250 Q 1240,-290 1270,-300" fill="none" stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" opacity={0.9} />
        <rect x={1220} y={-24} width={200} height={24} rx={6} fill={lit('#3E5561', p)} stroke={INK} strokeWidth={OUT} />
      </g>
      {/* 服务器塔 */}
      <g>
        <rect x={1560} y={-400} width={200} height={400} rx={10} fill={lit('#23414E', p)} stroke={INK} strokeWidth={OUT} />
        {Array.from({length: 6}, (_, i) => (
          <g key={i}>
            <rect x={1580} y={-380 + i * 60} width={160} height={42} rx={6} fill={lit('#2F5866', p)} stroke={INK} strokeWidth={3} />
            {[0, 1, 2].map((k) => (
              <circle key={k} cx={1600 + k * 18} cy={-359 + i * 60} r={5} fill={(Math.floor(t * 4) + i + k) % 3 === 0 ? '#EFF27A' : '#7CFFD0'} />
            ))}
            <rect x={1680} y={-364 + i * 60} width={46} height={10} rx={5} fill={lit('#86A2A4', p)} />
          </g>
        ))}
      </g>
      {lamp(1480, p)}
      <House x={1820} w={260} h={280} color={mixHex(c.main, '#FFFFFF', 0.25)} p={p} seed={56} roof="gable" win="grid" awning={c.accent} />
      <Tree x={620} p={p} s={0.8} seed={4} />
    </g>
  );
};

// ---------------- global ----------------
const GlobalNear: React.FC<DistrictArtProps & {c: C}> = ({p, t, c, words}) => {
  // 屋顶对话框：第 1、3 块写这一站的字（类别名、标签），第 2、4 块画图标；不再写死任何语言的问候语
  const ws = (words ?? []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 2);
  const labels: (string | 'star' | 'heart')[] = [ws[0] ?? 'star', 'heart', ws[1] ?? 'star', 'star'];
  const n = nightOf(p);
  const spin = (t * 60) % 520;
  const continents = (dx: number) => (
    <g transform={`translate(${dx},0)`}>
      <path d="M 380,-400 C 420,-430 480,-420 490,-380 C 500,-350 470,-330 450,-300 C 430,-270 400,-280 392,-310 C 386,-340 350,-370 380,-400 Z" fill={lit('#6ED39A', p)} stroke={INK} strokeWidth={3.5} />
      <path d="M 540,-340 C 580,-360 640,-350 650,-310 C 660,-270 620,-250 610,-210 C 600,-180 560,-190 556,-230 C 552,-270 510,-320 540,-340 Z" fill={lit('#6ED39A', p)} stroke={INK} strokeWidth={3.5} />
      <path d="M 440,-230 C 470,-240 500,-220 494,-196 C 488,-176 460,-172 446,-186 C 432,-200 420,-222 440,-230 Z" fill={lit('#6ED39A', p)} stroke={INK} strokeWidth={3.5} />
      <path d="M 700,-420 C 740,-430 770,-400 750,-370 C 730,-350 690,-370 700,-420 Z" fill={lit('#6ED39A', p)} stroke={INK} strokeWidth={3.5} />
    </g>
  );
  const bubble = (x: number, y: number, label: string, i: number) => {
    // 夜里是灯箱：纸面发暖光，字和图标用本街区深色（不做霓虹描边、不闪）
    const neon = c.deep;
    const icon = label === 'star' || label === 'heart';
    const text = icon ? '' : label;
    const w = icon ? 130 : Math.max(130, Array.from(text).length * 44 + 60);
    return (
      <g key={i} transform={`translate(${x},${y})`}>
        <path d={`M ${-w / 2},-44 Q ${-w / 2},-60 ${-w / 2 + 16},-60 L ${w / 2 - 16},-60 Q ${w / 2},-60 ${w / 2},-44 L ${w / 2},14 Q ${w / 2},30 ${w / 2 - 16},30 L -8,30 L -30,56 L -30,30 L ${-w / 2 + 16},30 Q ${-w / 2},30 ${-w / 2},14 Z`} fill={mixHex('#FFFFFF', '#FFF1C9', n)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        {n > 0.3 && <path d={`M ${-w / 2},-44 Q ${-w / 2},-60 ${-w / 2 + 16},-60 L ${w / 2 - 16},-60 Q ${w / 2},-60 ${w / 2},-44 L ${w / 2},14 Q ${w / 2},30 ${w / 2 - 16},30 L -8,30 L -30,56 L -30,30 L ${-w / 2 + 16},30 Q ${-w / 2},30 ${-w / 2},14 Z`} fill="none" stroke="#FFE7A0" strokeWidth={22} opacity={0.35 * n} />}
        {label === 'star' ? (
          <path d={star5(0, -14, 30)} fill={n > 0.3 ? neon : lit('#FFB627', p)} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        ) : label === 'heart' ? (
          <path d="M 0,12 C -34,-10 -30,-44 -8,-42 C -2,-42 0,-36 0,-34 C 0,-36 2,-42 8,-42 C 30,-44 34,-10 0,12 Z" fill={n > 0.3 ? neon : lit('#FF7A45', p)} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        ) : (
          <text x={0} y={-2} textAnchor="middle" dominantBaseline="middle" fontSize={44} fontWeight={900} fill={n > 0.3 ? neon : lit(c.deep, p)} style={{fontFamily: '"PSans", "Noto Sans SC", "Microsoft YaHei UI", sans-serif'}}>
            {text}
          </text>
        )}
      </g>
    );
  };
  return (
    <g>
      <House x={40} w={240} h={300} color={c.main} p={p} seed={61} roof="gable" win="arch" />
      {/* 地球仪 */}
      <g>
        <defs>
          <clipPath id="jGlobe">
            <circle cx={540} cy={-310} r={170} />
          </clipPath>
        </defs>
        <path d="M 470,-60 L 610,-60 L 640,0 L 440,0 Z" fill={lit('#8A5A3B', p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <rect x={530} y={-120} width={20} height={64} fill={lit('#C3D6D1', p)} stroke={INK} strokeWidth={3.5} />
        <circle cx={540} cy={-310} r={170} fill={lit('#3FA9F5', p)} />
        <g clipPath="url(#jGlobe)">
          {continents(-spin)}
          {continents(520 - spin)}
          <path d="M 370,-310 Q 540,-250 710,-310" fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.5} />
          <path d="M 400,-400 Q 540,-360 680,-400" fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.4} />
        </g>
        <circle cx={540} cy={-310} r={170} fill="none" stroke={INK} strokeWidth={OUT} />
        <path d="M 400,-200 A 196 196 0 0 1 680,-420" fill="none" stroke={INK} strokeWidth={20} strokeLinecap="round" />
        <path d="M 400,-200 A 196 196 0 0 1 680,-420" fill="none" stroke={lit(c.accent, p)} strokeWidth={12} strokeLinecap="round" />
        <path d="M 440,-420 Q 460,-450 500,-455" fill="none" stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" opacity={0.7} />
      </g>
      <House x={780} w={300} h={320} color={c.deep} p={p} seed={62} roof="flat" win="grid" awning={c.accent} />
      {bubble(930, -400, labels[0], 0)}
      <House x={1110} w={280} h={270} color={c.accent} p={p} seed={63} roof="flat" win="tall" />
      {bubble(1250, -350, labels[1], 1)}
      <House x={1420} w={300} h={350} color={mixHex(c.main, '#FFFFFF', 0.2)} p={p} seed={64} roof="flat" win="arch" />
      {bubble(1570, -430, labels[2], 2)}
      <House x={1760} w={280} h={300} color="#3F6FF2" p={p} seed={65} roof="flat" win="grid" awning="#FFB627" />
      {bubble(1900, -380, labels[3], 3)}
      <StreetLamp x={720} p={p} />
      <StreetLamp x={1400} p={p} />
      <Bunting x0={726} y0={-250} x1={1406} y1={-250} p={p} sag={50} seed={1} />
    </g>
  );
};

// ---------------- 通用填充段（片头、片尾、街区之间） ----------------
export const FillerNear: React.FC<DistrictArtProps & {seed?: number; w?: number}> = ({p, seed = 0, w = DISTRICT_W}) => {
  const cols = ['#78AFC4', '#F09A5B', '#6DB48A', '#FFB627', '#C9745A', '#3F95A6'];
  const out: React.ReactNode[] = [];
  let x = 30;
  let i = 0;
  while (x < w - 200) {
    const s = seed * 31 + i;
    const hw = 220 + Math.floor(hash(s) * 90);
    const hh = 240 + Math.floor(hash(s + 1) * 140);
    const roofs = ['gable', 'flat', 'arc', 'step'] as const;
    out.push(<House key={i} x={x} w={hw} h={hh} color={cols[Math.floor(hash(s + 2) * cols.length)]} p={p} seed={s} roof={roofs[Math.floor(hash(s + 3) * 4)]} win={hash(s + 4) > 0.5 ? 'arch' : 'grid'} awning={hash(s + 5) > 0.6 ? '#F58A4B' : undefined} />);
    x += hw + 30;
    if (hash(s + 6) > 0.45) {
      out.push(<Tree key={`t${i}`} x={x + 50} p={p} seed={s} />);
      x += 110;
    }
    i++;
  }
  out.push(<StreetLamp key="l" x={Math.round(w * 0.5)} p={p} />);
  return <g>{out}</g>;
};

export const DISTRICT_NEAR: Record<DistrictKind, React.FC<DistrictArtProps & {c: C}>> = {
  docs: DocsNear,
  post: PostNear,
  tools: ToolsNear,
  creative: CreativeNear,
  data: DataNear,
  global: GlobalNear,
  ...EVERYDAY_NEAR,
  ...OLDTOWN_NEAR,
};

// ---------------- 中景模块 ----------------
/** low = 低层街巷（skyline: street）：中景楼压到 2–4 层，不画高塔 */
export const DistrictMid: React.FC<{kind: DistrictKind | 'filler'; w: number; p: number; t: number; seed?: number; c?: C; low?: boolean}> = ({kind, w, p, t, seed = 0, c, low = false}) => {
  const base = c?.mid ?? '#BFD9D3';
  const alt = mixHex(base, '#FFFFFF', 0.25);
  const deep = mixHex(base, INK, 0.12);
  const tops = ['flat', 'dome', 'spire', 'step', 'antenna', 'tank'] as const;
  const out: React.ReactNode[] = [];
  let x = 0;
  let i = 0;
  while (x < w - 60) {
    const s = seed * 17 + i * 3;
    const tw = 120 + hash(s) * 90;
    const th = low ? 200 + hash(s + 1) * 170 : 380 + hash(s + 1) * 300;
    const lowTops = ['flat', 'step', 'dome'] as const;
    out.push(<Tower key={i} x={x} w={tw} h={th} color={[base, alt, deep][i % 3]} p={p} seed={s} top={low ? lowTops[Math.floor(hash(s + 2) * lowTops.length)] : tops[Math.floor(hash(s + 2) * tops.length)]} />);
    x += tw + 10 + hash(s + 3) * 40;
    i++;
  }
  const col = lit(deep, p);
  const extra =
    kind === 'post' ? (
      <g transform={`translate(${w * 0.45},0)`}>
        <rect x={-60} y={-640} width={120} height={640} fill={col} />
        <path d="M -76,-640 L 0,-730 L 76,-640 Z" fill={col} />
        <circle cx={0} cy={-560} r={40} fill={mixHex(col, '#FFFFFF', 0.5 - nightOf(p) * 0.2)} />
      </g>
    ) : kind === 'tools' ? (
      <g>
        {[0.3, 0.62].map((f, k) => (
          <g key={k}>
            <rect x={w * f} y={-720} width={54} height={720} fill={col} />
            {[0, 1, 2].map((j) => {
              const q = ((t * 0.35 + j / 3 + k * 0.2) % 1 + 1) % 1;
              return <circle key={j} cx={w * f + 27 + q * 60} cy={-740 - q * 150} r={22 + q * 26} fill={mixHex('#FFFFFF', col, 0.25)} opacity={0.8 * (1 - q)} />;
            })}
          </g>
        ))}
      </g>
    ) : kind === 'creative' ? (
      <g transform={`translate(${w * 0.55},-470)`}>
        <circle cx={0} cy={0} r={230} fill="none" stroke={col} strokeWidth={12} />
        {Array.from({length: 8}, (_, k) => {
          const a = t * 0.4 + (k * Math.PI) / 4;
          return (
            <g key={k}>
              <line x1={0} y1={0} x2={Math.cos(a) * 230} y2={Math.sin(a) * 230} stroke={col} strokeWidth={5} />
              <rect x={Math.cos(a) * 230 - 22} y={Math.sin(a) * 230} width={44} height={36} rx={8} fill={lit(NEON[k % NEON.length], p)} opacity={0.8} />
            </g>
          );
        })}
        <path d="M -30,0 L -120,470 M 30,0 L 120,470" stroke={col} strokeWidth={12} />
      </g>
    ) : kind === 'data' ? (
      <g transform={`translate(${w * 0.5},0)`}>
        {[0, 1, 2, 3].map((k) => <rect key={k} x={-150 + k * 76} y={-(360 + k * 110 + Math.sin(t * 0.8 + k) * 12)} width={64} height={360 + k * 110 + Math.sin(t * 0.8 + k) * 12} rx={10} fill={col} />)}
      </g>
    ) : kind === 'global' ? (
      <g transform={`translate(${w * 0.4},0)`}>
        <path d="M -40,0 L -12,-700 L 12,-700 L 40,0 Z" fill={col} />
        <circle cx={0} cy={-620} r={52} fill={col} />
        <rect x={-3} y={-860} width={6} height={170} fill={col} />
        <circle cx={0} cy={-864} r={8} fill={mixHex(col, '#FF7A45', 0.4 + nightOf(p) * 0.6)} />
      </g>
    ) : kind === 'phone' ? (
      <g transform={`translate(${w * 0.5},0)`}>
        <rect x={-36} y={-720} width={72} height={720} rx={10} fill={col} />
        {[0, 1, 2].map((k) => <path key={k} d={`M ${-40 - k * 26},${-780 - k * 22} Q 0,${-840 - k * 40} ${40 + k * 26},${-780 - k * 22}`} fill="none" stroke={col} strokeWidth={8} strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(t * 3 - k)} />)}
      </g>
    ) : kind === 'cafe' || kind === 'home' ? (
      <g transform={`translate(${w * 0.45},0)`}>
        <rect x={-50} y={-560} width={100} height={70} rx={14} fill={col} />
        <path d="M -40,-490 L -56,0 M 40,-490 L 56,0" stroke={col} strokeWidth={10} />
      </g>
    ) : kind === 'market' ? (
      <g transform={`translate(${w * 0.5},0)`}>
        {[-160, 0, 160].map((dx, k) => <path key={k} d={`M ${dx - 90},-300 L ${dx},-420 L ${dx + 90},-300 Z`} fill={col} />)}
      </g>
    ) : kind === 'docs' ? (
      <g transform={`translate(${w * 0.6},0)`}>
        <rect x={-70} y={-640} width={140} height={640} fill={col} />
        <circle cx={0} cy={-560} r={46} fill={mixHex(col, '#FFFFFF', 0.5 - nightOf(p) * 0.2)} />
        <path d={`M 0,-560 L 0,-594 M 0,-560 L ${Math.cos(t * 0.5) * 26},${-560 + Math.sin(t * 0.5) * 26}`} stroke={col} strokeWidth={6} strokeLinecap="round" />
      </g>
    ) : null;
  return (
    <g>
      {extra}
      {out}
    </g>
  );
};

export {cloudPath, Bush};
