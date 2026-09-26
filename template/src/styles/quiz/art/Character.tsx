import React from 'react';
import {ArtPalette, useArtPalette} from './colors';
import {Fx, FxKind} from './fx';
import {blinkAt, breathe, waveAt} from './motion';
import {Expr, FACES, Face, HandKind, Pose, SPECS, SW, V, Who, solveArm} from './rig';

// ============================================================
// quiz / art 角色（全部 SVG 代码绘制，原创设计）。
//   host  主讲人：齐刘海波波头、头戴发箍 + 小灯泡天线（状态道具：没懂 = 灯灭，懂了 = 灯亮），白衬衫 + 主色背带裙、玛丽珍鞋
//   buddy 搭档：个子高、毛线帽 + 亮色绒球、小麦肤色、粗眉、亮色卫衣（帽兜 + 抽绳 + 袋鼠兜）、深色直筒裤、白色运动鞋
// 画法：平涂、无渐变、统一墨色描边 SW=6（600 高时）、圆线头；颜色全部取自当前主题（colors.ts）。
//
// 两种用法：
//   <Character who="host" x={300} y={1200} size={560} pose="talk" expr="happy" mouth={m} t={t} />   ← HTML 里，(x,y) = 脚底中心
//   <CharacterG who="buddy" pose="point" ... />                                                    ← 放进别的 <svg>（小剧场），坐标系见 rig.ts
// ============================================================

export type CharacterProps = {
  who: Who;
  pose?: Pose;
  expr?: Expr;
  /** 嘴张开程度 0..1（说话时每帧传 mouthAt(t, ...)）；0 = 用表情自带的嘴型 */
  mouth?: number;
  /** 镜头内秒数：驱动眨眼、呼吸、挥手；不传就静止 */
  t?: number;
  facing?: 'right' | 'left';
  /** 点头 0..1（nodAt(t, t0)） */
  nod?: number;
  /** 额外歪头（度，正 = 朝面向方向歪） */
  tilt?: number;
  /** 灯泡亮度 0..1（仅 host；懂了 = 1） */
  bulb?: number;
  /** 头顶特效 + 它开始后经过的秒数 */
  fx?: FxKind;
  fxT?: number;
  /** 随机种子（两个角色眨眼错开） */
  seed?: number;
};

const Tube: React.FC<{pts: V[]; w: number; fill: string; line: string}> = ({pts, w, fill, line}) => {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <>
      <path d={d} fill="none" stroke={line} strokeWidth={w + SW * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
};

// ---------- 手：先整体描边一遍（粗墨线），再平涂一遍，轮廓自然合并 ----------
const HandShape: React.FC<{kind: HandKind; pass: 'line' | 'fill'; skin: string; line: string}> = ({kind, pass, skin, line}) => {
  const isLine = pass === 'line';
  const st = isLine ? {fill: line, stroke: line, strokeWidth: SW * 2, strokeLinejoin: 'round' as const} : {fill: skin};
  const finger = (x1: number, y1: number, x2: number, y2: number, w = 10) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isLine ? line : skin} strokeWidth={isLine ? w + SW * 2 : w} strokeLinecap="round" />
  );
  switch (kind) {
    case 'open':
      return (
        <g>
          <path d="M-2,-12 L20,-12 Q34,-12 34,0 Q34,12 20,12 L-2,12 Z" {...st} />
          <ellipse cx={8} cy={-15} rx={9} ry={5.5} transform="rotate(-38 8 -15)" {...st} />
          {!isLine && (
            <g stroke={line} strokeWidth={2.6} strokeLinecap="round">
              <line x1={23} y1={-4} x2={31} y2={-4} />
              <line x1={23} y1={4} x2={31} y2={4} />
            </g>
          )}
        </g>
      );
    case 'point':
      return (
        <g>
          {finger(10, -4, 34, -4)}
          <circle cx={5} cy={2} r={13} {...st} />
          <ellipse cx={10} cy={-11} rx={7} ry={4.5} {...st} />
        </g>
      );
    case 'peace':
      return (
        <g>
          {finger(8, -4, 32, -13, 9.5)}
          {finger(8, 3, 33, 8, 9.5)}
          <circle cx={4} cy={1} r={13} {...st} />
        </g>
      );
    case 'fist':
      return <circle cx={5} cy={0} r={13.5} {...st} />;
    default:
      // 自然垂手：手掌 + 朝身体内侧的拇指
      return (
        <g>
          <ellipse cx={7} cy={0} rx={14} ry={12} {...st} />
          <ellipse cx={2} cy={11} rx={7} ry={4.6} transform="rotate(20 2 11)" {...st} />
        </g>
      );
  }
};

const Hand: React.FC<{at: V; deg: number; flip: boolean; kind: HandKind; skin: string; line: string}> = ({at, deg, flip, kind, skin, line}) => (
  <g transform={`translate(${at[0].toFixed(1)} ${at[1].toFixed(1)}) rotate(${deg.toFixed(1)}) scale(1 ${flip ? -1 : 1})`}>
    <HandShape kind={kind} pass="line" skin={skin} line={line} />
    <HandShape kind={kind} pass="fill" skin={skin} line={line} />
  </g>
);

const Arm: React.FC<{who: Who; pose: Pose; side: 1 | -1; wave: number; sleeve: string; skin: string; line: string; cuff?: string}> = ({who, pose, side, wave, sleeve, skin, line, cuff}) => {
  const s = SPECS[who];
  const a = solveArm(who, pose, side, wave);
  // 袖口：沿小臂从手往回退一点
  const dx = a.H[0] - a.E[0];
  const dy = a.H[1] - a.E[1];
  const len = Math.hypot(dx, dy) || 1;
  const back = who === 'host' ? 14 : 16;
  const C: V = [a.H[0] - (dx / len) * back, a.H[1] - (dy / len) * back];
  const C2: V = [a.H[0] - (dx / len) * (back + 12), a.H[1] - (dy / len) * (back + 12)];
  return (
    <g>
      <Tube pts={[a.S, a.E, C]} w={s.armW} fill={sleeve} line={line} />
      {cuff && <Tube pts={[C2, C]} w={s.armW + 1} fill={cuff} line={line} />}
      <Hand at={a.H} deg={a.handDeg} flip={a.flip} kind={a.hand} skin={skin} line={line} />
    </g>
  );
};

// ---------- 五官 ----------
const Eyes: React.FC<{f: Face; blink: number; pal: ArtPalette; xs: [number, number]; y: number}> = ({f, blink, pal, xs, y}) => {
  const L = pal.line;
  const one = (x: number, i: number) => {
    const kind = f.eyes === 'wink' && i === 0 ? 'happy' : f.eyes === 'wink' ? 'dot' : f.eyes;
    if (blink > 0.5 && (kind === 'dot' || kind === 'look' || kind === 'wide' || kind === 'worried')) {
      return <path key={i} d={`M${x - 7},${y + 1} Q${x},${y + 4} ${x + 7},${y + 1}`} stroke={L} strokeWidth={4.5} fill="none" strokeLinecap="round" />;
    }
    switch (kind) {
      case 'happy':
        return <path key={i} d={`M${x - 8},${y + 3} Q${x},${y - 8} ${x + 8},${y + 3}`} stroke={L} strokeWidth={5} fill="none" strokeLinecap="round" />;
      case 'wide':
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={9} ry={11} fill={pal.card} stroke={L} strokeWidth={4} />
            <circle cx={x + 1.5} cy={y + 1} r={4.6} fill={L} />
          </g>
        );
      case 'look':
        return <ellipse key={i} cx={x + 3} cy={y - 4} rx={5.4} ry={6.6} fill={L} />;
      case 'worried':
        return <ellipse key={i} cx={x} cy={y + 1} rx={5} ry={6} fill={L} />;
      default:
        return <ellipse key={i} cx={x} cy={y} rx={5.6} ry={7} fill={L} />;
    }
  };
  return <g>{xs.map((x, i) => one(x, i))}</g>;
};

const Brows: React.FC<{f: Face; xs: [number, number]; y: number; thick: number; line: string}> = ({f, xs, y, thick, line}) => {
  const seg = (x: number, i: number) => {
    let dy = 0;
    let rot = 0;
    switch (f.brows) {
      case 'up':
        dy = -4;
        break;
      case 'high':
        dy = -10;
        rot = i === 0 ? -6 : 6;
        break;
      case 'quirk':
        dy = i === 0 ? 2 : -8;
        rot = i === 0 ? 8 : -10;
        break;
      case 'worried':
        dy = -2;
        rot = i === 0 ? -14 : 14;
        break;
      case 'down':
        dy = 2;
        rot = i === 0 ? 10 : -10;
        break;
    }
    return (
      <line
        key={i}
        x1={x - 9}
        y1={y + dy}
        x2={x + 9}
        y2={y + dy}
        stroke={line}
        strokeWidth={thick}
        strokeLinecap="round"
        transform={`rotate(${rot} ${x} ${y + dy})`}
      />
    );
  };
  return <g>{xs.map((x, i) => seg(x, i))}</g>;
};

const Mouth: React.FC<{f: Face; open: number; at: V; pal: ArtPalette}> = ({f, open, at, pal}) => {
  const [x, y] = at;
  const L = pal.line;
  const inside = pal.mouthIn;
  if (open > 0.08 || f.mouth === 'grin' || f.mouth === 'o') {
    if (f.mouth === 'o' && open <= 0.08) return <ellipse cx={x} cy={y + 2} rx={7} ry={9} fill={inside} stroke={L} strokeWidth={4} />;
    const o = f.mouth === 'grin' ? Math.max(0.55, open) : open;
    const w = 11 + 5 * o;
    const h = 4 + 17 * o;
    return (
      <g>
        <path d={`M${x - w},${y - 2} Q${x},${y + 1} ${x + w},${y - 2} Q${x + w * 0.85},${y + h} ${x},${y + h} Q${x - w * 0.85},${y + h} ${x - w},${y - 2} Z`} fill={inside} stroke={L} strokeWidth={4} strokeLinejoin="round" />
        {h > 9 && <ellipse cx={x + 1} cy={y + h - 4} rx={w * 0.5} ry={Math.min(5, h * 0.25)} fill={pal.tongue} />}
      </g>
    );
  }
  const P: Record<string, string> = {
    smile: `M${x - 9},${y} Q${x},${y + 8} ${x + 9},${y}`,
    flat: `M${x - 7},${y + 2} L${x + 7},${y + 2}`,
    hmm: `M${x - 6},${y + 3} Q${x + 2},${y - 1} ${x + 10},${y + 1}`,
    wavy: `M${x - 11},${y + 2} q3.6,-5 7.3,0 q3.6,5 7.3,0 q3.6,-5 7.3,0`,
    smirk: `M${x - 8},${y + 3} Q${x + 3},${y + 6} ${x + 11},${y - 3}`,
  };
  return <path d={P[f.mouth] ?? P.smile} stroke={L} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
};

// ---------- 状态道具：小灯泡 ----------
export const Bulb: React.FC<{cx: number; cy: number; lit: number; pal: ArtPalette; r?: number}> = ({cx, cy, lit, pal, r = 17}) => {
  const L = pal.line;
  const on = lit > 0.5;
  const rays = [-150, -115, -65, -30, 0, 180];
  return (
    <g>
      {lit > 0.05 &&
        rays.map((a, i) => {
          const rad = (a * Math.PI) / 180;
          const r1 = r + 8;
          const r2 = r + 8 + 13 * lit;
          return (
            <line
              key={i}
              x1={cx + Math.cos(rad) * r1}
              y1={cy + Math.sin(rad) * r1}
              x2={cx + Math.cos(rad) * r2}
              y2={cy + Math.sin(rad) * r2}
              stroke={L}
              strokeWidth={4.5}
              strokeLinecap="round"
            />
          );
        })}
      <path
        d={`M${cx - r * 0.55},${cy + r * 0.75} C${cx - r * 1.35},${cy + r * 0.2} ${cx - r * 1.1},${cy - r * 1.1} ${cx},${cy - r * 1.1} C${cx + r * 1.1},${cy - r * 1.1} ${cx + r * 1.35},${cy + r * 0.2} ${cx + r * 0.55},${cy + r * 0.75} Z`}
        fill={on ? pal.highlight : pal.card}
        stroke={L}
        strokeWidth={SW * 0.8}
        strokeLinejoin="round"
      />
      {!on && <path d={`M${cx - 6},${cy + 2} l4,-7 l4,7 l4,-7`} stroke={pal.inkPale} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {on && <path d={`M${cx - 8},${cy - 6} Q${cx - 6},${cy - 12} ${cx},${cy - 13}`} stroke={pal.card} strokeWidth={4} fill="none" strokeLinecap="round" />}
      <rect x={cx - r * 0.55} y={cy + r * 0.72} width={r * 1.1} height={r * 0.7} rx={3} fill={pal.inkSoft} stroke={L} strokeWidth={SW * 0.7} />
    </g>
  );
};

// ================= host：主讲人 =================
const HostBody: React.FC<{pal: ArtPalette}> = ({pal}) => {
  const L = pal.line;
  const o = {stroke: L, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  return (
    <g>
      {/* 腿 + 袜子 + 玛丽珍鞋 */}
      <Tube pts={[[-22, 440], [-24, 574]]} w={25} fill={pal.skinA} line={L} />
      <Tube pts={[[26, 440], [30, 574]]} w={25} fill={pal.skinA} line={L} />
      <Tube pts={[[-24, 552], [-24, 574]]} w={29} fill={pal.card} line={L} />
      <Tube pts={[[30, 552], [30, 574]]} w={29} fill={pal.card} line={L} />
      <path d="M-40,578 Q-42,598 -24,598 L-4,598 Q8,598 6,586 Q2,572 -18,572 Q-36,570 -40,578 Z" fill={L} {...o} />
      <path d="M14,578 Q12,598 30,598 L52,598 Q64,598 62,586 Q58,572 38,572 Q18,570 14,578 Z" fill={L} {...o} />
      {/* 衬衫 */}
      <path d="M-46,214 Q-48,200 -30,196 L38,196 Q54,200 52,214 L54,300 L-48,300 Z" fill={pal.card} {...o} />
      {/* 背带裙：护胸 + A 字裙摆 */}
      <path d="M-34,238 L40,238 L46,300 L90,462 Q4,478 -84,462 L-42,300 Z" fill={pal.primary} {...o} />
      <path d="M-40,300 L44,300" stroke={L} strokeWidth={SW * 0.7} strokeLinecap="round" />
      {/* 裙摆褶线 */}
      <path d="M-16,318 L-26,446 M20,318 L28,448" stroke={pal.primaryDeep} strokeWidth={4} strokeLinecap="round" />
      {/* 胸前口袋 */}
      <path d="M-12,254 L20,254 L20,276 Q4,284 -12,276 Z" fill={pal.primarySoft} stroke={L} strokeWidth={4} strokeLinejoin="round" />
      {/* 背带 + 扣子 */}
      <Tube pts={[[-30, 240], [-34, 204]]} w={9} fill={pal.primary} line={L} />
      <Tube pts={[[36, 240], [40, 204]]} w={9} fill={pal.primary} line={L} />
      <circle cx={-29} cy={244} r={6} fill={pal.highlight} stroke={L} strokeWidth={3.5} />
      <circle cx={35} cy={244} r={6} fill={pal.highlight} stroke={L} strokeWidth={3.5} />
      {/* 脖子 + 圆领 */}
      <path d="M-8,168 L-8,196 L20,196 L20,168" fill={pal.skinA} {...o} />
      <path d="M-24,192 Q-30,216 -4,214 Q4,208 4,196 Z" fill={pal.card} {...o} />
      <path d="M32,192 Q38,216 12,214 Q4,208 4,196 Z" fill={pal.card} {...o} />
    </g>
  );
};

const HostHead: React.FC<{pal: ArtPalette; f: Face; blink: number; mouth: number; nod: number; bulb: number}> = ({pal, f, blink, mouth, nod, bulb}) => {
  const L = pal.line;
  const o = {stroke: L, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  const fy = nod * 5;
  return (
    <g>
      {/* 后发：齐肩波波头 */}
      <path d="M-84,172 C-96,112 -86,32 4,28 C94,32 104,112 92,172 Q86,184 74,178 L-66,178 Q-78,184 -84,172 Z" fill={L} {...o} />
      {/* 脸 */}
      <ellipse cx={8} cy={116} rx={62} ry={64} fill={pal.skinA} {...o} />
      <g transform={`translate(0 ${fy})`}>
        {/* 腮红 */}
        <ellipse cx={-22} cy={140} rx={11} ry={6.5} fill={pal.blushA} opacity={f.blush} />
        <ellipse cx={52} cy={140} rx={11} ry={6.5} fill={pal.blushA} opacity={f.blush} />
        <Brows f={f} xs={[-6, 38]} y={98} thick={4} line={L} />
        <Eyes f={f} blink={blink} pal={pal} xs={[-4, 38]} y={120} />
        <Mouth f={f} open={mouth} at={[18, 148]} pal={pal} />
      </g>
      {/* 齐刘海 */}
      <path d="M-58,112 C-70,52 -34,34 8,34 C52,34 84,54 74,110 C70,98 66,90 60,84 Q14,92 -40,84 C-50,90 -54,100 -58,112 Z" fill={L} {...o} />
      {/* 两侧鬓发 */}
      <path d="M-58,100 C-66,128 -64,156 -60,178 L-46,178 C-52,150 -52,122 -46,96 Z" fill={L} {...o} />
      <path d="M74,98 C80,128 80,156 76,178 L62,178 C66,150 66,124 60,94 Z" fill={L} {...o} />
      {/* 发箍 + 天线 + 灯泡 */}
      <path d="M-66,72 C-60,44 -28,36 8,36 C46,36 74,44 82,70" fill="none" stroke={L} strokeWidth={11 + SW * 2} strokeLinecap="round" />
      <path d="M-66,72 C-60,44 -28,36 8,36 C46,36 74,44 82,70" fill="none" stroke={pal.highlight} strokeWidth={11} strokeLinecap="round" />
      <path d="M14,30 C14,10 22,-4 18,-18" fill="none" stroke={L} strokeWidth={5} strokeLinecap="round" />
      <Bulb cx={18} cy={-36} lit={bulb} pal={pal} />
    </g>
  );
};

// ================= buddy：搭档 =================
const BuddyBody: React.FC<{pal: ArtPalette}> = ({pal}) => {
  const L = pal.line;
  const o = {stroke: L, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  return (
    <g>
      {/* 直筒裤 */}
      <path d="M-56,366 L64,366 L66,560 L14,560 L8,420 L2,420 L-4,560 L-56,560 Z" fill={pal.inkSoft} {...o} />
      <path d="M-56,544 L-4,544 M14,544 L66,544" stroke={L} strokeWidth={4} strokeLinecap="round" />
      {/* 运动鞋 */}
      <path d="M-58,566 Q-62,598 -40,598 L2,598 Q16,598 14,584 Q10,564 -14,562 L-50,558 Q-58,558 -58,566 Z" fill={pal.card} {...o} />
      <path d="M-60,588 L14,588" stroke={L} strokeWidth={4} />
      <path d="M12,566 Q8,598 30,598 L76,598 Q92,598 88,582 Q82,564 56,562 L20,558 Q12,558 12,566 Z" fill={pal.card} {...o} />
      <path d="M10,588 L90,588" stroke={L} strokeWidth={4} />
      {/* 卫衣：身体 + 罗纹下摆 */}
      <path d="M-62,236 Q-64,208 -34,202 L44,202 Q74,208 72,236 L74,360 L-64,360 Z" fill={pal.highlight} {...o} />
      <rect x={-66} y={352} width={142} height={28} rx={10} fill={pal.highlight} {...o} />
      <path d="M-40,360 L-40,372 M-14,360 L-14,372 M12,360 L12,372 M38,360 L38,372 M60,360 L60,372" stroke={pal.primaryDeep} strokeWidth={3} strokeLinecap="round" opacity={0.45} />
      {/* 袋鼠兜 */}
      <path d="M-34,298 L44,298 L56,346 L-46,346 Z" fill={pal.highlightSoft} stroke={L} strokeWidth={4.5} strokeLinejoin="round" />
      {/* 脖子 */}
      <path d="M-8,172 L-8,202 L24,202 L24,172" fill={pal.skinB} {...o} />
      {/* 帽兜（领口一圈） */}
      <path d="M-44,200 C-38,242 52,244 58,200 L42,196 C34,222 -20,224 -28,196 Z" fill={pal.highlight} {...o} />
      {/* 抽绳 */}
      <path d="M-4,222 L-8,272 M20,222 L24,272" stroke={L} strokeWidth={4} strokeLinecap="round" />
      <rect x={-13} y={270} width={10} height={14} rx={3} fill={pal.primary} stroke={L} strokeWidth={3} />
      <rect x={19} y={270} width={10} height={14} rx={3} fill={pal.primary} stroke={L} strokeWidth={3} />
    </g>
  );
};

const BuddyHead: React.FC<{pal: ArtPalette; f: Face; blink: number; mouth: number; nod: number}> = ({pal, f, blink, mouth, nod}) => {
  const L = pal.line;
  const o = {stroke: L, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  const fy = nod * 5;
  return (
    <g>
      {/* 耳朵 */}
      <ellipse cx={-58} cy={124} rx={13} ry={16} fill={pal.skinB} {...o} />
      <ellipse cx={74} cy={124} rx={13} ry={16} fill={pal.skinB} {...o} />
      {/* 脸：方一点的下巴 */}
      <path d="M-58,86 C-58,58 -36,46 8,46 C52,46 74,58 74,88 L72,138 C70,168 44,182 8,182 C-28,182 -56,168 -58,138 Z" fill={pal.skinB} {...o} />
      {/* 鬓角碎发 */}
      <path d="M-58,76 Q-70,98 -58,112 Q-56,98 -48,88 Z" fill={L} {...o} />
      <path d="M74,76 Q84,96 74,110 Q72,96 64,88 Z" fill={L} {...o} />
      <g transform={`translate(0 ${fy})`}>
        <ellipse cx={-20} cy={146} rx={11} ry={6} fill={pal.blushB} opacity={f.blush} />
        <ellipse cx={56} cy={146} rx={11} ry={6} fill={pal.blushB} opacity={f.blush} />
        <Brows f={f} xs={[-10, 40]} y={100} thick={7.5} line={L} />
        <Eyes f={f} blink={blink} pal={pal} xs={[-8, 40]} y={122} />
        {/* 小鼻子 */}
        <path d="M20,130 Q28,138 20,144" stroke={pal.nose} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <Mouth f={f} open={mouth} at={[20, 160]} pal={pal} />
      </g>
      {/* 毛线帽：帽身 + 翻边 + 绒球 */}
      <path d="M-66,76 C-72,14 -34,-6 8,-6 C52,-6 88,14 82,76 Z" fill={pal.primary} {...o} />
      <path d="M-30,6 Q-40,40 -38,66 M8,-4 L8,66 M46,6 Q56,40 54,66" stroke={pal.primaryDeep} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
      <rect x={-74} y={56} width={164} height={34} rx={15} fill={pal.primary} {...o} />
      <path d="M-50,62 L-50,84 M-28,62 L-28,84 M-6,62 L-6,84 M16,62 L16,84 M38,62 L38,84 M60,62 L60,84" stroke={pal.primaryDeep} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      <path d="M8,-30 q9,-6 16,2 q10,2 6,12 q6,9 -3,15 q-4,9 -14,5 q-9,6 -15,-3 q-10,-2 -6,-12 q-5,-10 4,-14 q4,-9 12,-5 Z" fill={pal.highlight} {...o} />
    </g>
  );
};

// ================= 组装 =================
export const CharacterG: React.FC<CharacterProps> = ({who, pose = 'stand', expr = 'neutral', mouth = 0, t, facing = 'right', nod = 0, tilt = 0, bulb = 0, fx, fxT = 0, seed}) => {
  const pal = useArtPalette();
  const sd = seed ?? (who === 'host' ? 1 : 2);
  const f = FACES[expr];
  const blink = t === undefined || expr === 'happy' || expr === 'wink' ? 0 : blinkAt(t, sd);
  const wave = pose === 'wave' && t !== undefined ? waveAt(t) : 0;
  const talkWave = pose === 'talk' && mouth > 0 ? mouth * 6 : 0;
  const bob = t === undefined ? 0 : breathe(t, sd);
  const s = SPECS[who];
  const headRot = f.tilt + tilt + nod * 8;
  const L = pal.line;
  const isHost = who === 'host';
  const skin = isHost ? pal.skinA : pal.skinB;
  const sleeve = isHost ? pal.card : pal.highlight;
  const lean = pose === 'surprised' ? -3 : pose === 'think' ? 2 : 0;
  // 手臂在身体前面画；思考姿势的托肘手要在托下巴那只手后面
  const armR = <Arm who={who} pose={pose} side={1} wave={wave + talkWave} sleeve={sleeve} skin={skin} line={L} cuff={isHost ? undefined : pal.highlight} />;
  const armL = <Arm who={who} pose={pose} side={-1} wave={0} sleeve={sleeve} skin={skin} line={L} cuff={isHost ? undefined : pal.highlight} />;
  const head = isHost ? (
    <HostHead pal={pal} f={f} blink={blink} mouth={mouth} nod={nod} bulb={bulb} />
  ) : (
    <BuddyHead pal={pal} f={f} blink={blink} mouth={mouth} nod={nod} />
  );
  const armsBehindHead = pose === 'stand' || pose === 'talk' || pose === 'point' || pose === 'shrug';
  return (
    <g transform={facing === 'left' ? 'scale(-1 1)' : undefined}>
      <g transform={`translate(0 ${bob.toFixed(2)}) rotate(${lean} 0 600)`}>
        {isHost ? <HostBody pal={pal} /> : <BuddyBody pal={pal} />}
        {armsBehindHead && armL}
        {armsBehindHead && armR}
        <g transform={`translate(0 ${(nod * 7).toFixed(2)}) rotate(${headRot.toFixed(2)} ${s.neck[0]} ${s.neck[1]})`}>{head}</g>
        {!armsBehindHead && armL}
        {!armsBehindHead && armR}
      </g>
      {fx && (
        <g transform={facing === 'left' ? 'scale(-1 1)' : undefined}>
          <Fx kind={fx} t={fxT} x={facing === 'left' ? -s.top[0] : s.top[0]} y={s.top[1]} pal={pal} />
        </g>
      )}
    </g>
  );
};

/**
 * 圆形头像（评论框、弹幕头像用）。size = 直径像素；bg 不写用主色浅色。
 * 头像只裁头肩，表情照常可用（说话时同样传 mouth）。
 */
export const Avatar: React.FC<{who: Who; size: number; expr?: Expr; mouth?: number; nod?: number; t?: number; bulb?: number; bg?: string; ring?: boolean; style?: React.CSSProperties}> = ({
  who,
  size,
  expr = 'happy',
  mouth = 0,
  nod = 0,
  t,
  bulb = 0,
  bg,
  ring = true,
  style,
}) => {
  const pal = useArtPalette();
  const id = React.useId().replace(/:/g, '');
  const cx = 10;
  const cy = who === 'host' ? 150 : 140;
  const r = 132;
  return (
    <svg width={size} height={size} viewBox={`${cx - r - 8} ${cy - r - 8} ${2 * r + 16} ${2 * r + 16}`} style={style}>
      <defs>
        <clipPath id={`av${id}`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={bg ?? (who === 'host' ? pal.highlightSoft : pal.primaryPale)} />
      <g clipPath={`url(#av${id})`}>
        <g transform={`translate(0 ${who === 'host' ? 34 : 34})`}>
          <CharacterG who={who} expr={expr} mouth={mouth} nod={nod} t={t} bulb={bulb} />
        </g>
      </g>
      {ring && <circle cx={cx} cy={cy} r={r} fill="none" stroke={pal.line} strokeWidth={SW * 1.4} />}
    </svg>
  );
};

/** 画布：角色 SVG 的可见范围（角色坐标）。x -220..220，y -140..640 */
const VB = {x: -220, y: -140, w: 440, h: 780};

/**
 * HTML 里放一个角色。(x, y) = 脚底中心的像素坐标，size = 身高（600 单位）对应的像素。
 * hop = 离地高度（角色坐标，hopAt(t, t0)），scale = 放大进场（以脚底为锚点，0..1）。shadow = 地面影。
 */
export const Character: React.FC<CharacterProps & {x: number; y: number; size: number; hop?: number; scale?: number; shadow?: boolean; style?: React.CSSProperties}> = ({
  x,
  y,
  size,
  hop = 0,
  scale = 1,
  shadow = true,
  style,
  ...rest
}) => {
  const k = size / 600;
  const pal = useArtPalette();
  return (
    <svg
      width={VB.w * k}
      height={VB.h * k}
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      style={{position: 'absolute', left: x + VB.x * k, top: y + (VB.y - 600) * k, overflow: 'visible', ...style}}
    >
      <g transform={`translate(0 600) scale(${scale}) translate(0 -600)`}>
        {shadow && <ellipse cx={rest.facing === 'left' ? -8 : 8} cy={602} rx={112 * (1 - Math.min(0.4, hop / 150))} ry={12} fill={pal.ground} />}
        <g transform={`translate(0 ${-hop})`}>
          <CharacterG {...rest} />
        </g>
      </g>
    </svg>
  );
};
