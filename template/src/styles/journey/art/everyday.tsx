import React from 'react';
import {DISTRICT, DistrictKind, INK, NEON, hash, lit, mixHex, nightOf} from './palette';
import {Bench, Bush, House, OUT, StreetLamp, Tree, Windows} from './city';

// ============================================================
// journey / art 日常街区（原创造型），适合软件、生活服务、餐饮零售这类题材，现代城市和低层街巷（skyline: street）都能用：
//   phone  手机：手机形状的大楼（屏幕上是列表界面）、小票招牌店、平板楼（柱状图）；gagT 起屏幕扫描线扫过、第一行打勾
//   home   住家：带阳台的公寓楼、心形圆窗的小房子、信箱、晾衣绳；gagT 起公寓窗户一扇扇亮灯、信箱小旗竖起
//   cafe   咖啡馆：屋顶大咖啡杯（冒热气）、条纹遮阳篷、户外桌椅、小黑板、面包房（屋顶可颂）
//   market 集市：四个条纹布篷摊位（水果、蔬菜、糕点、小物）、头顶一串小灯泡
// 局部坐标同 districts.tsx：地面线 y = 0，x 0..2200。
// ============================================================
type C = (typeof DISTRICT)[DistrictKind];
type P = {p: number; t: number; gagT?: number; c: C};

// ---------------- phone ----------------
const PhoneNear: React.FC<P> = ({p, t, gagT, c}) => {
  const n = nightOf(p);
  const g = gagT ?? -1;
  const screen = mixHex('#F7F8FF', '#E8ECFF', n);
  const scanY = g >= 0 && g < 0.9 ? -556 + (g / 0.9) * 490 : null;
  const done = g >= 0.9;
  const rows = [0, 1, 2, 3];
  return (
    <g>
      <House x={40} w={240} h={280} color={c.accent} p={p} seed={111} roof="gable" win="arch" />
      {/* 手机楼 */}
      <rect x={350} y={-610} width={320} height={610} rx={48} fill={lit('#2A2F45', p)} stroke={INK} strokeWidth={OUT} />
      <rect x={346} y={-470} width={8} height={70} rx={4} fill={lit('#4A5270', p)} />
      <rect x={374} y={-576} width={272} height={530} rx={26} fill={screen} stroke={INK} strokeWidth={3} />
      {n > 0.2 && <rect x={374} y={-576} width={272} height={530} rx={26} fill="#DDE3FF" opacity={0.25 * n} />}
      <rect x={484} y={-600} width={52} height={14} rx={7} fill={lit('#1A1E2E', p)} />
      <rect x={374} y={-576} width={272} height={64} rx={26} fill={lit(c.main, p)} />
      <rect x={374} y={-540} width={272} height={28} fill={lit(c.main, p)} />
      <rect x={398} y={-556} width={110} height={16} rx={8} fill="#FFFFFF" opacity={0.85} />
      {rows.map((i) => {
        const y = -488 + i * 88;
        const hi = done && i === 0;
        return (
          <g key={i}>
            <rect x={390} y={y} width={240} height={72} rx={14} fill={hi ? mixHex('#DDF7E6', screen, 0.2) : '#FFFFFF'} stroke={mixHex(INK, '#FFFFFF', 0.7)} strokeWidth={3} />
            <circle cx={422} cy={y + 36} r={17} fill={lit(NEON[(i + 1) % NEON.length], p)} stroke={INK} strokeWidth={3} />
            <rect x={452} y={y + 18} width={90} height={12} rx={6} fill="#AEB5CC" />
            <rect x={452} y={y + 42} width={60} height={10} rx={5} fill="#D3D8E6" />
            <rect x={560} y={y + 24} width={56} height={24} rx={12} fill={lit(c.accent, p)} />
            {hi && <path d={`M 410,${y + 36} l 10,10 l 18,-20`} fill="none" stroke="#1E9E5A" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        );
      })}
      <circle cx={596} cy={-104} r={34} fill={lit(c.main, p)} stroke={INK} strokeWidth={3.5} />
      <path d="M 596,-122 L 596,-86 M 578,-104 L 614,-104" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" />
      {scanY !== null && (
        <g>
          <rect x={378} y={scanY - 18} width={264} height={36} fill={lit(c.accent, p)} opacity={0.28} />
          <rect x={378} y={scanY - 3} width={264} height={6} rx={3} fill={lit(c.accent, p)} />
        </g>
      )}
      <Tree x={740} p={p} seed={3} />
      {/* 小票招牌店 */}
      <House x={820} w={330} h={300} color={c.deep} p={p} seed={112} roof="flat" win="grid" awning={c.accent} />
      <path d="M 900,-318 L 900,-360 M 1070,-318 L 1070,-360" stroke={INK} strokeWidth={8} />
      <path d={`M 870,-520 L 1100,-520 L 1100,-372 ${Array.from({length: 8}, (_, i) => `L ${1100 - (i + 0.5) * 28.75},-356 L ${1100 - (i + 1) * 28.75},-372`).join(' ')} Z`} fill={lit('#FFFDF6', p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      {[0, 1, 2].map((i) => <rect key={i} x={896} y={-494 + i * 34} width={i === 2 ? 90 : 140} height={12} rx={6} fill="#C9CCD8" />)}
      <rect x={1040} y={-494} width={40} height={12} rx={6} fill="#C9CCD8" />
      <circle cx={1064} cy={-410} r={22} fill="#2DAA5F" stroke={INK} strokeWidth={3.5} />
      <path d="M 1053,-411 l 8,8 l 14,-15" fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      {/* 平板楼 */}
      <rect x={1200} y={-450} width={280} height={450} rx={30} fill={lit('#343A55', p)} stroke={INK} strokeWidth={OUT} />
      <rect x={1222} y={-428} width={236} height={300} rx={16} fill={screen} stroke={INK} strokeWidth={3} />
      {[0, 1, 2, 3].map((i) => {
        const h = [90, 150, 120, 200][i] * (0.9 + 0.1 * Math.sin(t * 2 + i));
        return <rect key={i} x={1248 + i * 52} y={-150 - h} width={34} height={h} rx={6} fill={lit(i % 2 ? c.accent : c.main, p)} stroke={INK} strokeWidth={3} />;
      })}
      <Windows x={1222} y={-110} w={236} h={90} kind="band" p={p} seed={113} />
      {lampAt(1540, p)}
      <House x={1600} w={250} h={260} color={mixHex(c.main, '#FFFFFF', 0.25)} p={p} seed={114} roof="gable" win="arch" />
      <House x={1880} w={260} h={340} color="#FF8A3D" p={p} seed={115} roof="flat" win="grid" awning="#FF7B6B" />
      <Bush x={300} p={p} w={80} />
    </g>
  );
};

const lampAt = (x: number, p: number) => <StreetLamp key={`lamp${x}`} x={x} p={p} />;

// ---------------- home ----------------
const HomeNear: React.FC<P> = ({p, t, gagT, c}) => {
  const n = nightOf(p);
  const g = gagT ?? -1;
  const body = mixHex(c.main, '#FFFFFF', 0.35);
  const winAt = (i: number, seed: number) => {
    const lit0 = mixHex('#EAF6FF', hash(seed) < 0.55 ? '#FFD86B' : '#2A3462', n);
    return g >= i * 0.05 ? '#FFD86B' : lit0;
  };
  const apt = (x: number, w: number, h: number, seed: number, col: string) => {
    const cols = 3;
    const rows = Math.floor((h - 60) / 90);
    const cw = (w - 40) / cols;
    const out: React.ReactNode[] = [];
    let k = 0;
    for (let r = 0; r < rows; r++)
      for (let q = 0; q < cols; q++) {
        const wx = x + 20 + q * cw + cw * 0.18;
        const wy = -h + 30 + r * 90;
        out.push(<rect key={`w${r}${q}`} x={wx} y={wy} width={cw * 0.64} height={48} rx={6} fill={winAt(k, seed + k)} stroke={INK} strokeWidth={3} />);
        k++;
      }
    const balconies = Array.from({length: rows}, (_, r) => (
      <g key={`b${r}`}>
        <rect x={x - 8} y={-h + 84 + r * 90} width={w + 16} height={12} rx={4} fill={lit(c.deep, p)} stroke={INK} strokeWidth={3} />
        {r % 2 === 0 && <circle cx={x + 30 + ((r * 70) % (w - 60))} cy={-h + 72 + r * 90} r={13} fill={lit('#3DBE73', p)} stroke={INK} strokeWidth={3} />}
      </g>
    ));
    return (
      <g>
        <rect x={x} y={-h} width={w} height={h} fill={lit(col, p)} stroke={INK} strokeWidth={OUT} />
        <rect x={x - 10} y={-h - 20} width={w + 20} height={22} rx={4} fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} />
        {out}
        {balconies}
        <rect x={x + w / 2 - 30} y={-80} width={60} height={80} rx={8} fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} />
      </g>
    );
  };
  const flagUp = g >= 0.6;
  const smokeK = [0, 1, 2];
  return (
    <g>
      <House x={40} w={220} h={260} color={c.accent} p={p} seed={121} roof="gable" win="grid" />
      {apt(300, 400, 530, 7, body)}
      {/* 心形圆窗的小房子 */}
      <rect x={1090} y={-420} width={40} height={90} fill={lit('#B85C4A', p)} stroke={INK} strokeWidth={OUT} />
      {smokeK.map((k) => {
        const q = ((t * 0.4 + k / 3) % 1 + 1) % 1;
        return <circle key={k} cx={1110 + q * 40} cy={-440 - q * 120} r={16 + q * 18} fill="#FFFFFF" opacity={0.7 * (1 - q)} />;
      })}
      <House x={780} w={380} h={300} color="#FFF3E0" p={p} seed={122} roof="gable" win="arch" roofColor={c.main} door={false} />
      <circle cx={970} cy={-330} r={44} fill={g >= 0.3 ? '#FFD86B' : lit('#EAF6FF', p)} stroke={INK} strokeWidth={OUT} />
      <path d="M 970,-316 c -26,-18 -22,-40 -4,-38 c 4,0 4,6 4,6 c 0,0 0,-6 4,-6 c 18,-2 22,20 -4,38 Z" fill={lit(c.main, p)} stroke={INK} strokeWidth={2.5} />
      <rect x={940} y={-110} width={60} height={110} rx={10} fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} />
      <circle cx={970} cy={-80} r={18} fill="none" stroke={lit('#3DBE73', p)} strokeWidth={7} />
      {/* 栅栏 */}
      {Array.from({length: 14}, (_, i) => (
        <path key={`fc${i}`} d={`M ${760 + i * 34},0 L ${760 + i * 34},-58 L ${772 + i * 34},-70 L ${784 + i * 34},-58 L ${784 + i * 34},0 Z`} fill={lit('#FFFFFF', p)} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      ))}
      <rect x={756} y={-44} width={480} height={10} fill={lit('#FFFFFF', p)} stroke={INK} strokeWidth={3} />
      {/* 信箱 */}
      <rect x={1290} y={-110} width={12} height={110} fill={lit('#6B4A3A', p)} stroke={INK} strokeWidth={3} />
      <path d="M 1256,-110 L 1256,-150 Q 1256,-176 1296,-176 Q 1336,-176 1336,-150 L 1336,-110 Z" fill={lit(c.accent, p)} stroke={INK} strokeWidth={OUT} />
      <path d={flagUp ? 'M 1336,-150 L 1336,-206 L 1366,-196 L 1344,-186' : 'M 1336,-150 L 1372,-150 L 1366,-130 L 1350,-140'} fill={lit('#FF5A4E', p)} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <Tree x={1250} p={p} seed={5} s={0.9} />
      {apt(1420, 320, 440, 31, mixHex(c.accent, '#FFFFFF', 0.45))}
      {/* 晾衣绳 */}
      <path d="M 1430,-300 Q 1580,-260 1730,-300" fill="none" stroke={INK} strokeWidth={3} />
      {[1470, 1540, 1620, 1690].map((x, i) => (
        <rect key={`cl${x}`} x={x - 18} y={-292 + Math.sin(i) * 6} width={36} height={44} rx={5} fill={lit(NEON[i % NEON.length], p)} stroke={INK} strokeWidth={3} transform={`rotate(${Math.sin(t * 3 + i) * 5} ${x} -290)`} />
      ))}
      <House x={1790} w={220} h={250} color={c.main} p={p} seed={123} roof="gable" win="arch" />
      <Tree x={2080} p={p} seed={8} />
      <Bench x={1180} p={p} color={c.accent} />
    </g>
  );
};

// ---------------- cafe ----------------
const CafeNear: React.FC<P> = ({p, t, c}) => {
  const n = nightOf(p);
  const body = mixHex(c.main, '#FFFFFF', 0.25);
  const umbrella = (x: number, k: number) => (
    <g key={`u${k}`}>
      <line x1={x} y1={0} x2={x} y2={-190} stroke={INK} strokeWidth={6} />
      <path d={`M ${x - 110},-170 Q ${x},-260 ${x + 110},-170 Z`} fill={lit(k % 2 ? c.accent : c.main, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      <path d={`M ${x - 36},-170 Q ${x - 20},-236 ${x},-240 Q ${x + 20},-236 ${x + 36},-170 Z`} fill="#FFFFFF" opacity={0.85 - n * 0.4} />
      <rect x={x - 60} y={-80} width={120} height={12} rx={5} fill={lit('#8A5A3B', p)} stroke={INK} strokeWidth={3} />
      <path d={`M ${x},-68 L ${x},0 M ${x - 30},0 L ${x + 30},0`} stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d={`M ${x - 18},-80 L ${x - 14},-100 L ${x + 2},-100 L ${x + 4},-80 Z`} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
      {[-1, 1].map((s) => <path key={s} d={`M ${x + s * 90},-110 L ${x + s * 90},0 M ${x + s * 90},-50 L ${x + s * 60},-50 L ${x + s * 60},0`} fill="none" stroke={INK} strokeWidth={5} />)}
    </g>
  );
  return (
    <g>
      <House x={40} w={240} h={280} color="#8FA3C7" p={p} seed={131} roof="flat" win="grid" />
      {/* 咖啡馆 */}
      <rect x={330} y={-330} width={500} height={330} fill={lit(body, p)} stroke={INK} strokeWidth={OUT} />
      <rect x={320} y={-350} width={520} height={26} rx={4} fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} />
      <rect x={370} y={-216} width={260} height={160} rx={8} fill={mixHex('#EAF6FF', '#FFD98A', n)} stroke={INK} strokeWidth={OUT} />
      <line x1={370} y1={-150} x2={630} y2={-150} stroke={INK} strokeWidth={3} />
      {[410, 470, 530, 590].map((x, i) => <circle key={x} cx={x} cy={-168} r={12} fill={lit(['#C7773F', '#F2C14E', '#FFFFFF', '#9A5327'][i], p)} stroke={INK} strokeWidth={2.5} />)}
      <rect x={670} y={-150} width={80} height={150} rx={10} fill={lit(c.deep, p)} stroke={INK} strokeWidth={OUT} />
      <path d="M 356,-260 L 650,-260 L 666,-222 L 340,-222 Z" fill={lit(c.accent, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      {Array.from({length: 7}, (_, i) => <path key={i} d={`M ${366 + i * 42},-260 L ${384 + i * 42},-260 L ${392 + i * 42},-222 L ${372 + i * 42},-222 Z`} fill="#FFFFFF" opacity={0.85 - n * 0.4} />)}
      {/* 屋顶大咖啡杯 */}
      <g>
        <path d="M 500,-352 L 660,-352 L 648,-470 L 512,-470 Z" fill={lit('#FFFFFF', p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        <rect x={506} y={-438} width={148} height={34} fill={lit(c.main, p)} stroke={INK} strokeWidth={3} />
        <path d="M 654,-446 q 50,0 44,40 q -6,30 -50,26" fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
        <path d="M 654,-446 q 50,0 44,40 q -6,30 -50,26" fill="none" stroke={lit('#FFFFFF', p)} strokeWidth={7} strokeLinecap="round" />
        <ellipse cx={580} cy={-350} rx={110} ry={14} fill={lit(c.deep, p)} stroke={INK} strokeWidth={3.5} />
        {[540, 580, 620].map((x, i) => {
          const q = ((t * 0.6 + i / 3) % 1 + 1) % 1;
          return <path key={x} d={`M ${x},${-480 - q * 60} q -14,-20 0,-40 q 14,-20 0,-40`} fill="none" stroke={lit('#FFFFFF', p)} strokeWidth={9} strokeLinecap="round" opacity={0.9 * (1 - q)} />;
        })}
      </g>
      {umbrella(930, 0)}
      {umbrella(1150, 1)}
      {/* 小黑板 */}
      <path d="M 1270,0 L 1300,-150 L 1360,-150 L 1390,0" fill="none" stroke={lit('#8A5A3B', p)} strokeWidth={10} strokeLinejoin="round" />
      <rect x={1286} y={-146} width={88} height={110} rx={6} fill={lit('#2F3A34', p)} stroke={INK} strokeWidth={3.5} />
      {[0, 1, 2].map((i) => <rect key={i} x={1298} y={-128 + i * 30} width={i === 1 ? 44 : 64} height={8} rx={4} fill="#F4F1E6" opacity={0.8} />)}
      {/* 面包房 */}
      <House x={1440} w={330} h={300} color="#F2C14E" p={p} seed={132} roof="flat" win="arch" awning={c.main} />
      <path d="M 1530,-360 Q 1605,-470 1680,-360 Q 1650,-400 1605,-404 Q 1560,-400 1530,-360 Z" fill={lit('#E9A64A', p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      {[1570, 1605, 1640].map((x) => <path key={x} d={`M ${x},-430 L ${x + 6},-380`} stroke={INK} strokeWidth={3.5} strokeLinecap="round" />)}
      {lampAt(1820, p)}
      <House x={1880} w={260} h={320} color={c.accent} p={p} seed={133} roof="gable" win="grid" />
    </g>
  );
};

// ---------------- market ----------------
const MarketNear: React.FC<P> = ({p, t, c}) => {
  const n = nightOf(p);
  const canopy = [c.main, c.accent, '#F2C14E', '#3F6FF2'];
  const goods = [
    ['#FF5A4E', '#FF8A3D', '#FFC845'],
    ['#56C98A', '#2DAA5F', '#A8D86B'],
    ['#E9A64A', '#F6D9A8', '#C7773F'],
    ['#7B5CFF', '#E845A8', '#4DE6FF'],
  ];
  const stall = (x: number, k: number) => {
    const col = canopy[k % canopy.length];
    const gs = goods[k % goods.length];
    return (
      <g key={`s${k}`}>
        <rect x={x + 6} y={-270} width={14} height={270} fill={lit('#8A5A3B', p)} stroke={INK} strokeWidth={3} />
        <rect x={x + 262} y={-270} width={14} height={270} fill={lit('#8A5A3B', p)} stroke={INK} strokeWidth={3} />
        <rect x={x} y={-112} width={282} height={112} fill={lit('#C58B58', p)} stroke={INK} strokeWidth={OUT} />
        {[0, 1, 2].map((i) => <line key={i} x1={x} y1={-80 + i * 28} x2={x + 282} y2={-80 + i * 28} stroke={lit('#A06C40', p)} strokeWidth={3} />)}
        {Array.from({length: 9}, (_, i) => (
          <circle key={`g${i}`} cx={x + 30 + (i % 5) * 56 + (i >= 5 ? 28 : 0)} cy={-126 - (i >= 5 ? 28 : 0)} r={20} fill={lit(gs[i % 3], p)} stroke={INK} strokeWidth={3} />
        ))}
        <path d={`M ${x - 16},-300 L ${x + 298},-300 L ${x + 298},-246 ${Array.from({length: 7}, (_, i) => `Q ${x + 298 - (i + 0.5) * 44.86},-222 ${x + 298 - (i + 1) * 44.86},-246`).join(' ')} Z`} fill={lit(col, p)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        {Array.from({length: 4}, (_, i) => <rect key={`st${i}`} x={x + 8 + i * 76} y={-298} width={32} height={50} fill="#FFFFFF" opacity={0.8 - n * 0.4} />)}
      </g>
    );
  };
  const bulbs = Array.from({length: 22}, (_, i) => {
    const u = (i + 0.5) / 22;
    const x = 320 + u * 1300;
    const y = -360 + Math.sin(u * Math.PI * 4) * -18 + 30;
    const on = n > 0.2 ? (Math.sin(t * 4 + i) > -0.3 ? 1 : 0.4) : 0;
    return (
      <g key={`bl${i}`}>
        {on > 0 && <circle cx={x} cy={y + 12} r={20} fill={NEON[i % NEON.length]} opacity={0.3 * n * on} />}
        <circle cx={x} cy={y + 12} r={9} fill={mixHex(lit('#FFF6D8', p), NEON[i % NEON.length], n * on)} stroke={INK} strokeWidth={2.5} />
      </g>
    );
  });
  return (
    <g>
      <House x={40} w={220} h={260} color="#6FBF9B" p={p} seed={141} roof="flat" win="grid" awning={c.main} />
      <path d="M 320,-330 Q 640,-290 970,-330 Q 1300,-290 1620,-330" fill="none" stroke={INK} strokeWidth={3} />
      {stall(330, 0)}
      {stall(650, 1)}
      {stall(970, 2)}
      {stall(1290, 3)}
      {bulbs}
      <House x={1660} w={260} h={300} color={c.deep} p={p} seed={142} roof="gable" win="arch" />
      <Tree x={1980} p={p} seed={6} />
      <House x={2040} w={140} h={230} color="#F2C14E" p={p} seed={143} roof="flat" win="tall" />
    </g>
  );
};

export const EVERYDAY_NEAR = {phone: PhoneNear, home: HomeNear, cafe: CafeNear, market: MarketNear};
