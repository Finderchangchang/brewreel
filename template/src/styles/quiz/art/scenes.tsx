import React from 'react';
import type {ArtPalette} from './colors';
import {SW} from './rig';

// ============================================================
// quiz / art 小剧场背景（替代影视片段的「情景」）。全部代码绘制，平涂 + 墨色描边。
// 墙、地板、描边取当前主题；家具、灯、植物、布艺用人设色（暖橙 / 墨绿 / 琥珀 / 沙色，见 colors.ts 的 CAST），和两个角色是一套。
// 舞台坐标：1600 × 900（16:9），地面线 y = GROUND；角色站在地面线上（SceneClip 负责摆位）。
//   office 办公室：大窗 + 城市剪影、书架、挂钟、办公桌 + 显示器图表、台灯、落地绿植
//   cafe   咖啡店：菜单黑板、吊灯、条纹吧台 + 咖啡机、蛋糕罩、墙裙
//   street 街景：天空云、远处楼群、带条纹遮阳棚的小店、路灯、行道树、人行道和马路
//   home   客厅：窗帘窗、沙发、落地灯、挂画、地毯
//   classroom 教室：黑板（上面两球下落的小实验，循环）、挂钟、窗、讲台、课桌
// t（秒）只用来做很轻的环境动效（云飘、灯晃、屏幕数字跳），第 0 帧就是完整画面。
// ============================================================

export const SCENES = ['office', 'cafe', 'street', 'home', 'classroom'] as const;
export type SceneName = (typeof SCENES)[number];

export const STAGE = {w: 1600, h: 900};
export const GROUND = 850;

type P = {pal: ArtPalette; t: number};

const ol = (pal: ArtPalette, w = SW) => ({stroke: pal.line, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const});

const Cloud: React.FC<{x: number; y: number; s?: number; pal: ArtPalette}> = ({x, y, s = 1, pal}) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M-70,20 Q-86,20 -84,4 Q-82,-12 -62,-12 Q-58,-40 -28,-40 Q-4,-58 22,-40 Q52,-44 58,-16 Q84,-14 82,6 Q80,20 64,20 Z"
    fill={pal.card}
    {...ol(pal, SW / s)}
  />
);

const Plant: React.FC<{x: number; y: number; s?: number; pal: ArtPalette; sway?: number}> = ({x, y, s = 1, pal, sway = 0}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <g transform={`rotate(${sway} 0 -60)`}>
      <path d="M0,-60 C-10,-120 -60,-150 -84,-150 C-80,-110 -40,-80 0,-60 Z" fill={pal.leaf} {...ol(pal, SW / s)} />
      <path d="M0,-60 C10,-130 50,-170 80,-172 C80,-120 40,-84 0,-60 Z" fill={pal.leaf} {...ol(pal, SW / s)} />
      <path d="M0,-60 C-4,-140 10,-200 22,-214 C40,-170 30,-110 0,-60 Z" fill={pal.leaf} {...ol(pal, SW / s)} />
      <path d="M0,-66 L-50,-128 M0,-66 L48,-140 M2,-70 L16,-180" stroke={pal.line} strokeWidth={3.5 / s} strokeLinecap="round" opacity={0.5} />
    </g>
    <path d="M-50,-64 L50,-64 L38,0 L-38,0 Z" fill={pal.primary} {...ol(pal, SW / s)} />
    <rect x={-58} y={-76} width={116} height={20} rx={6} fill={pal.primary} {...ol(pal, SW / s)} />
  </g>
);

// ---------------- office ----------------
const Office: React.FC<P> = ({pal, t}) => {
  const o = ol(pal);
  const bars = [0.55, 0.8, 0.45, 0.95, 0.7];
  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill={pal.wall} />
      <rect x={0} y={760} width={1600} height={140} fill={pal.floor} />
      <path d="M0,760 L1600,760" {...o} />
      {/* 窗 + 窗外 */}
      <rect x={110} y={110} width={500} height={450} rx={14} fill={pal.sky} {...o} />
      <g>
        <rect x={150} y={330} width={110} height={230} fill={pal.primaryPale} {...ol(pal, 4)} />
        <rect x={280} y={260} width={130} height={300} fill={pal.wallAlt} {...ol(pal, 4)} />
        <rect x={430} y={360} width={140} height={200} fill={pal.primaryPale} {...ol(pal, 4)} />
        {[0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((c) => <rect key={`${r}-${c}`} x={300 + c * 36} y={290 + r * 50} width={18} height={24} rx={3} fill={pal.card} />))}
        <Cloud x={230 + ((t * 12) % 60)} y={190} s={0.8} pal={pal} />
      </g>
      <rect x={110} y={110} width={500} height={450} rx={14} fill="none" stroke={pal.card} strokeWidth={22} />
      <rect x={110} y={110} width={500} height={450} rx={14} fill="none" {...o} />
      <path d="M360,110 L360,560 M110,335 L610,335" stroke={pal.card} strokeWidth={16} />
      <path d="M352,121 L352,327 M368,121 L368,327 M352,343 L352,549 M368,343 L368,549" stroke={pal.line} strokeWidth={4} />
      <rect x={90} y={556} width={540} height={26} rx={8} fill={pal.card} {...o} />
      {/* 挂钟 */}
      <circle cx={1420} cy={160} r={62} fill={pal.card} {...o} />
      <path d={`M1420,160 L1420,122 M1420,160 L${1420 + 30 * Math.cos(t * 0.8)},${160 + 30 * Math.sin(t * 0.8)}`} stroke={pal.line} strokeWidth={6} strokeLinecap="round" />
      <circle cx={1420} cy={160} r={7} fill={pal.primary} />
      {/* 书架 */}
      <rect x={940} y={330} width={400} height={18} rx={6} fill={pal.wood} {...o} />
      {[
        [960, 60, pal.primary],
        [996, 78, pal.highlight],
        [1034, 70, pal.deep],
        [1068, 84, pal.primarySoft],
        [1104, 64, pal.highlight],
      ].map(([x, h, c], i) => (
        <rect key={i} x={x as number} y={330 - (h as number)} width={30} height={h as number} rx={4} fill={c as string} {...ol(pal, 5)} />
      ))}
      <rect x={1150} y={274} width={80} height={24} rx={4} fill={pal.primaryPale} {...ol(pal, 5)} transform="rotate(-8 1190 286)" />
      <Plant x={1290} y={330} s={0.42} pal={pal} />
      {/* 办公桌 + 显示器 + 杯子 + 台灯 */}
      <rect x={880} y={440} width={330} height={200} rx={16} fill={pal.inkSoft} {...o} />
      <rect x={898} y={458} width={294} height={164} rx={8} fill={pal.card} />
      {bars.map((b, i) => {
        const hh = 110 * b * (0.9 + 0.1 * Math.sin(t * 3 + i));
        return <rect key={i} x={926 + i * 52} y={600 - hh} width={32} height={hh} rx={5} fill={i === 3 ? pal.primary : pal.deepSoft} />;
      })}
      <path d="M1030,640 L1030,690 M990,690 L1070,690" {...o} strokeWidth={10} />
      <rect x={820} y={690} width={740} height={26} rx={8} fill={pal.wood} {...o} />
      <path d="M850,716 L850,850 M1530,716 L1530,850" {...o} strokeWidth={12} />
      <path d="M1370,640 L1410,640 L1404,690 L1376,690 Z" fill={pal.deep} {...o} />
      <path d="M1410,652 Q1430,654 1428,668 Q1426,680 1406,678" fill="none" {...o} />
      <path d="M1470,690 L1470,560 L1420,520" fill="none" {...o} strokeWidth={8} />
      <path d="M1380,506 L1450,490 L1446,540 Z" fill={pal.highlight} {...o} />
      <Plant x={120} y={850} s={1} pal={pal} sway={Math.sin(t * 1.3) * 2} />
    </g>
  );
};

// ---------------- cafe ----------------
const Cafe: React.FC<P> = ({pal, t}) => {
  const o = ol(pal);
  const swing = Math.sin(t * 1.6) * 2;
  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill={pal.wallAlt} />
      <rect x={0} y={560} width={1600} height={200} fill={pal.primaryPale} />
      {Array.from({length: 20}).map((_, i) => (
        <path key={i} d={`M${40 + i * 80},560 L${40 + i * 80},760`} stroke={pal.primarySoft} strokeWidth={10} />
      ))}
      <path d="M0,560 L1600,560" {...o} />
      <rect x={0} y={760} width={1600} height={140} fill={pal.floor} />
      <path d="M0,760 L1600,760" {...o} />
      {/* 菜单黑板 */}
      <rect x={150} y={90} width={500} height={300} rx={18} fill={pal.line} stroke={pal.wood} strokeWidth={16} />
      <rect x={150} y={90} width={500} height={300} rx={18} fill="none" {...o} />
      <path d="M200,150 L360,150 M200,200 L420,200 M200,250 L330,250 M200,300 L400,300" stroke={pal.card} strokeWidth={10} strokeLinecap="round" opacity={0.85} />
      <path d="M500,150 L590,150 M520,200 L590,200 M510,250 L590,250 M520,300 L590,300" stroke={pal.highlight} strokeWidth={10} strokeLinecap="round" />
      {/* 吊灯 */}
      {[880, 1130, 1380].map((x, i) => (
        <g key={i} transform={`rotate(${swing * (i % 2 ? -1 : 1)} ${x} 0)`}>
          <path d={`M${x},0 L${x},120`} stroke={pal.line} strokeWidth={5} />
          <path d={`M${x - 60},190 Q${x - 56},120 ${x},118 Q${x + 56},120 ${x + 60},190 Z`} fill={pal.primary} {...o} />
          <circle cx={x} cy={196} r={16} fill={pal.highlight} {...o} />
        </g>
      ))}
      {/* 吧台后面的架子 + 杯子 */}
      <rect x={780} y={330} width={760} height={16} rx={6} fill={pal.wood} {...o} />
      {[820, 900, 980, 1060].map((x, i) => (
        <path key={i} d={`M${x},290 L${x + 44},290 L${x + 38},330 L${x + 6},330 Z`} fill={i % 2 ? pal.card : pal.highlight} {...ol(pal, 5)} />
      ))}
      <rect x={1180} y={250} width={60} height={80} rx={10} fill={pal.inkSoft} {...ol(pal, 5)} />
      <rect x={1260} y={270} width={50} height={60} rx={10} fill={pal.highlightSoft} {...ol(pal, 5)} />
      {/* 吧台 */}
      <rect x={760} y={560} width={840} height={200} fill={pal.deep} {...o} />
      {Array.from({length: 7}).map((_, i) => (
        <path key={i} d={`M${820 + i * 110},586 L${820 + i * 110},740`} stroke={pal.deepSoft} strokeWidth={10} strokeLinecap="round" />
      ))}
      <rect x={740} y={530} width={880} height={32} rx={10} fill={pal.wood} {...o} />
      {/* 咖啡机 */}
      <rect x={1240} y={380} width={200} height={150} rx={16} fill={pal.inkSoft} {...o} />
      <rect x={1264} y={404} width={152} height={40} rx={8} fill={pal.card} {...ol(pal, 4)} />
      <circle cx={1290} cy={424} r={9} fill={pal.primary} />
      <circle cx={1320} cy={424} r={9} fill={pal.highlight} />
      <path d="M1300,444 L1300,470 M1380,444 L1380,470" {...o} strokeWidth={10} />
      <path d="M1284,494 L1316,494 L1312,528 L1288,528 Z" fill={pal.card} {...ol(pal, 5)} />
      <path d="M1300,478 Q1296,486 1302,492" stroke={pal.line} strokeWidth={3} fill="none" opacity={0.3 + 0.3 * Math.abs(Math.sin(t * 2))} />
      {/* 蛋糕罩 */}
      <path d="M880,530 Q880,440 960,440 Q1040,440 1040,530 Z" fill={pal.card} {...o} opacity={0.95} />
      <path d="M916,530 L916,494 Q960,480 1004,494 L1004,530 Z" fill={pal.highlight} {...ol(pal, 5)} />
      <path d="M916,506 Q960,492 1004,506" stroke={pal.primary} strokeWidth={8} fill="none" />
      <circle cx={960} cy={434} r={10} fill={pal.primary} {...ol(pal, 5)} />
      <Plant x={90} y={850} s={1.05} pal={pal} sway={Math.sin(t * 1.1) * 2} />
    </g>
  );
};

// ---------------- street ----------------
const Street: React.FC<P> = ({pal, t}) => {
  const o = ol(pal);
  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill={pal.sky} />
      <Cloud x={260 + ((t * 18) % 120)} y={110} s={1} pal={pal} />
      <Cloud x={1220 - ((t * 10) % 80)} y={80} s={0.7} pal={pal} />
      {/* 远处楼群 */}
      <rect x={-10} y={300} width={200} height={480} fill={pal.primaryPale} {...ol(pal, 5)} />
      <rect x={180} y={220} width={170} height={560} fill={pal.wallAlt} {...ol(pal, 5)} />
      <rect x={1500} y={260} width={120} height={520} fill={pal.wallAlt} {...ol(pal, 5)} />
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <g key={r}>
          <rect x={214} y={260 + r * 72} width={34} height={40} rx={4} fill={pal.card} />
          <rect x={278} y={260 + r * 72} width={34} height={40} rx={4} fill={pal.card} />
          <rect x={30} y={340 + r * 66} width={40} height={34} rx={4} fill={pal.card} opacity={r === 5 ? 0 : 1} />
          <rect x={110} y={340 + r * 66} width={40} height={34} rx={4} fill={pal.card} opacity={r === 5 ? 0 : 1} />
        </g>
      ))}
      {/* 小店 */}
      <rect x={640} y={200} width={860} height={580} fill={pal.wall} {...o} />
      <rect x={760} y={120} width={620} height={110} rx={18} fill={pal.line} {...o} />
      <rect x={784} y={142} width={572} height={66} rx={12} fill={pal.highlight} />
      <circle cx={830} cy={175} r={18} fill={pal.primary} {...ol(pal, 5)} />
      <path d="M870,175 L1080,175" stroke={pal.line} strokeWidth={14} strokeLinecap="round" />
      <path d="M1110,175 L1300,175" stroke={pal.primary} strokeWidth={14} strokeLinecap="round" />
      {/* 条纹遮阳棚（扇边） */}
      <path d="M620,260 L1520,260 L1540,350 L600,350 Z" fill={pal.card} {...o} />
      {Array.from({length: 9}).map((_, i) => (
        <path key={i} d={`M${640 + i * 100},262 L${690 + i * 100},262 L${702 + i * 104},348 L${650 + i * 104},348 Z`} fill={pal.primary} />
      ))}
      {Array.from({length: 10}).map((_, i) => (
        <path key={i} d={`M${600 + i * 94},350 Q${647 + i * 94},396 ${694 + i * 94},350 Z`} fill={i % 2 ? pal.card : pal.primary} {...ol(pal, 5)} />
      ))}
      {/* 橱窗 + 门 */}
      <rect x={700} y={430} width={440} height={300} rx={10} fill={pal.sky} {...o} />
      <path d="M760,450 L700,530 M860,450 L760,600 M1020,450 L900,640" stroke={pal.card} strokeWidth={14} strokeLinecap="round" />
      <path d="M760,730 L760,650 Q800,610 840,650 L840,730 M880,730 L880,630 L960,630 L960,730" fill={pal.highlightSoft} {...ol(pal, 5)} />
      <rect x={1200} y={430} width={220} height={350} rx={10} fill={pal.deepSoft} {...o} />
      <rect x={1226} y={456} width={168} height={170} rx={8} fill={pal.sky} {...ol(pal, 5)} />
      <circle cx={1394} cy={640} r={9} fill={pal.highlight} {...ol(pal, 4)} />
      {/* 人行道 + 马路 */}
      <rect x={0} y={780} width={1600} height={80} fill={pal.floor} />
      <path d="M0,780 L1600,780" {...o} />
      {Array.from({length: 9}).map((_, i) => (
        <path key={i} d={`M${i * 200 + 60},782 L${i * 200 + 20},858`} stroke={pal.inkPale} strokeWidth={4} />
      ))}
      <rect x={0} y={858} width={1600} height={50} fill={pal.inkSoft} />
      <path d="M0,858 L1600,858" {...o} />
      {/* 路灯 + 行道树 */}
      <path d="M520,780 L520,300 Q520,250 570,250 L600,250" fill="none" {...o} strokeWidth={14} />
      <path d="M520,780 L520,300 Q520,250 570,250 L600,250" fill="none" stroke={pal.inkSoft} strokeWidth={6} />
      <path d="M580,244 L640,244 L630,280 L590,280 Z" fill={pal.highlight} {...o} />
      <rect x={498} y={760} width={44} height={22} rx={6} fill={pal.inkSoft} {...o} />
      <path d="M380,780 L384,520" {...o} strokeWidth={26} />
      <path d="M380,780 L384,520" stroke={pal.wood} strokeWidth={14} />
      <g transform={`rotate(${Math.sin(t * 1.2) * 1.2} 384 560)`}>
        <circle cx={330} cy={470} r={80} fill={pal.leaf} {...o} />
        <circle cx={440} cy={460} r={90} fill={pal.leaf} {...o} />
        <circle cx={390} cy={380} r={90} fill={pal.leaf} {...o} />
        <path d="M340,470 Q360,440 390,452 M420,400 Q440,380 460,392" stroke={pal.line} strokeWidth={4} fill="none" opacity={0.4} strokeLinecap="round" />
      </g>
    </g>
  );
};

// ---------------- home ----------------
const Home: React.FC<P> = ({pal, t}) => {
  const o = ol(pal);
  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill={pal.wall} />
      <rect x={0} y={740} width={1600} height={160} fill={pal.floor} />
      <path d="M0,740 L1600,740" {...o} />
      {/* 窗 + 窗帘 */}
      <rect x={180} y={100} width={420} height={380} rx={12} fill={pal.sky} {...o} />
      <path d="M390,100 L390,480 M180,290 L600,290" stroke={pal.card} strokeWidth={14} />
      <Cloud x={300 + ((t * 10) % 50)} y={200} s={0.6} pal={pal} />
      <path d="M150,70 L640,70" {...o} strokeWidth={12} />
      <path d={`M160,74 L260,74 Q${250 + Math.sin(t) * 4},300 230,520 L150,520 Z`} fill={pal.deep} {...o} />
      <path d={`M620,74 L520,74 Q${530 - Math.sin(t) * 4},300 550,520 L630,520 Z`} fill={pal.deep} {...o} />
      {/* 挂画 */}
      <rect x={880} y={140} width={200} height={150} rx={8} fill={pal.card} {...o} />
      <path d="M900,270 L960,200 L1000,240 L1030,210 L1060,270 Z" fill={pal.primarySoft} {...ol(pal, 4)} />
      <circle cx={1030} cy={180} r={14} fill={pal.highlight} {...ol(pal, 4)} />
      <rect x={1120} y={180} width={120} height={110} rx={8} fill={pal.highlight} {...o} />
      <circle cx={1180} cy={235} r={28} fill={pal.primary} {...ol(pal, 4)} />
      {/* 沙发 */}
      <rect x={760} y={460} width={620} height={170} rx={40} fill={pal.primary} {...o} />
      <rect x={720} y={560} width={700} height={130} rx={30} fill={pal.primary} {...o} />
      <path d="M1070,470 L1070,560" stroke={pal.primaryDeep} strokeWidth={8} strokeLinecap="round" />
      <rect x={690} y={520} width={90} height={190} rx={36} fill={pal.primary} {...o} />
      <rect x={1360} y={520} width={90} height={190} rx={36} fill={pal.primary} {...o} />
      <rect x={830} y={500} width={130} height={90} rx={24} fill={pal.highlight} {...o} transform="rotate(-8 895 545)" />
      <path d="M760,710 L760,740 M1390,710 L1390,740" {...o} strokeWidth={12} />
      {/* 落地灯 */}
      <path d="M1520,740 L1520,300" {...o} strokeWidth={10} />
      <path d="M1460,300 L1580,300 L1550,200 L1490,200 Z" fill={pal.highlight} {...o} />
      <rect x={1490} y={728} width={60} height={16} rx={6} fill={pal.inkSoft} {...o} />
      {/* 地毯 */}
      <ellipse cx={900} cy={820} rx={560} ry={50} fill={pal.highlightSoft} {...o} />
      <ellipse cx={900} cy={820} rx={480} ry={32} fill="none" stroke={pal.primarySoft} strokeWidth={8} strokeDasharray="30 20" />
      <Plant x={90} y={760} s={0.9} pal={pal} />
    </g>
  );
};

// ---------------- classroom ----------------
const Classroom: React.FC<P> = ({pal, t}) => {
  const o = ol(pal);
  // 黑板上的小实验：两个球下落（教育类「反常识」题的现成道具）
  const fall = ((t * 0.6) % 1) * 150;
  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill={pal.wall} />
      <rect x={0} y={740} width={1600} height={160} fill={pal.floor} />
      <path d="M0,740 L1600,740" {...o} />
      {/* 黑板 */}
      <rect x={420} y={90} width={760} height={400} rx={16} fill={pal.line} stroke={pal.wood} strokeWidth={18} />
      <rect x={420} y={90} width={760} height={400} rx={16} fill="none" {...o} />
      <rect x={440} y={488} width={720} height={16} rx={6} fill={pal.wood} {...o} />
      <path d="M470,150 L660,150 M470,200 L610,200" stroke={pal.card} strokeWidth={10} strokeLinecap="round" opacity={0.85} />
      <path d="M760,160 L760,440 M1000,160 L1000,440" stroke={pal.card} strokeWidth={4} strokeDasharray="14 14" opacity={0.6} />
      <circle cx={760} cy={200 + fall} r={26} fill={pal.primary} stroke={pal.card} strokeWidth={5} />
      <path d={`M1000,${188 + fall} q-14,20 0,40 q14,-20 0,-40 Z`} fill={pal.highlight} stroke={pal.card} strokeWidth={4} />
      <path d="M1080,160 Q1120,200 1090,250 M1090,250 L1076,236 M1090,250 L1100,232" stroke={pal.highlight} strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M470,440 L620,440" stroke={pal.highlight} strokeWidth={10} strokeLinecap="round" />
      {/* 挂钟 + 窗 */}
      <circle cx={1330} cy={150} r={56} fill={pal.card} {...o} />
      <path d={`M1330,150 L1330,116 M1330,150 L${1330 + 28 * Math.cos(t * 0.8)},${150 + 28 * Math.sin(t * 0.8)}`} stroke={pal.line} strokeWidth={6} strokeLinecap="round" />
      <rect x={70} y={120} width={260} height={360} rx={12} fill={pal.sky} {...o} />
      <path d="M200,120 L200,480 M70,300 L330,300" stroke={pal.card} strokeWidth={14} />
      <Cloud x={150 + ((t * 10) % 40)} y={210} s={0.5} pal={pal} />
      {/* 讲台 + 书 */}
      <path d="M1250,560 L1480,560 L1460,740 L1270,740 Z" fill={pal.wood} {...o} />
      <path d="M1270,600 L1460,600" stroke={pal.primaryDeep} strokeWidth={5} opacity={0.5} />
      <rect x={1300} y={528} width={120} height={32} rx={6} fill={pal.deep} {...o} />
      <rect x={1316} y={500} width={96} height={28} rx={6} fill={pal.highlight} {...o} />
      {/* 课桌 */}
      {[180, 560].map((x, i) => (
        <g key={i}>
          <rect x={x} y={640} width={260} height={24} rx={8} fill={pal.wood} {...o} />
          <path d={`M${x + 24},664 L${x + 24},800 M${x + 236},664 L${x + 236},800`} {...o} strokeWidth={10} />
          <rect x={x + 60} y={616} width={90} height={24} rx={5} fill={i ? pal.primarySoft : pal.card} {...ol(pal, 5)} />
        </g>
      ))}
    </g>
  );
};
/** 画一个场景背景（放进 viewBox 为 0 0 1600 900 的 <svg> / <g> 里） */
export const SceneBackdrop: React.FC<{name: SceneName; pal: ArtPalette; t?: number}> = ({name, pal: themePal, t = 0}) => {
  // 场景里的「主色 / 亮色」一律用人设色：换主题只换墙和描边，家具还是这一套暖橙 + 墨绿 + 琥珀
  const pal: ArtPalette = {...themePal, primary: themePal.warm, highlight: themePal.glow};
  switch (name) {
    case 'cafe':
      return <Cafe pal={pal} t={t} />;
    case 'street':
      return <Street pal={pal} t={t} />;
    case 'home':
      return <Home pal={pal} t={t} />;
    case 'classroom':
      return <Classroom pal={pal} t={t} />;
    default:
      return <Office pal={pal} t={t} />;
  }
};
