import React from 'react';
import {ArtPalette, mixHex, useArtPalette} from './colors';
import {Fx, FxKind} from './fx';
import {blinkAt, breathe, waveAt} from './motion';
import {Expr, FACES, Face, HandKind, Pose, SPECS, SW, V, Who, solveArm} from './rig';

// ============================================================
// quiz / art 角色（全部 SVG 代码绘制，原创设计）。
//   host  主讲人：矮个大头（约 3.6 头身）、栗色侧分短发 + 低马尾、头戴式耳机（状态道具：没懂 = 耳罩灯灭，懂了 = 耳罩亮琥珀色 + 冒声波）、
//         暖橙运动夹克（奶白拉链、袖条）+ 墨绿短裤、条纹袜 + 厚底鞋
//   buddy 搭档：高个宽肩、反戴棒球帽（暖橙帽檐朝后）、深棕肤色、粗眉 + 雀斑、墨绿毛衣（胸前暖橙宽条）、沙色工装裤、暖橙高帮鞋
// 画法：平涂、无渐变、统一墨色描边 SW=6（600 高时）、圆线头；描边 / 底色取当前主题，衣服道具用人设色（colors.ts 的 CAST）。
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
  /** 状态道具亮度 0..1（仅 host 的耳机亮灯；懂了 = 1）。沿用旧名 bulb，调用方不用改 */
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

const Arm: React.FC<{who: Who; pose: Pose; side: 1 | -1; wave: number; sleeve: string; skin: string; line: string; cuff?: string; stripe?: string}> = ({who, pose, side, wave, sleeve, skin, line, cuff, stripe}) => {
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
      {stripe && <path d={`M${a.S[0].toFixed(1)},${a.S[1].toFixed(1)} L${a.E[0].toFixed(1)},${a.E[1].toFixed(1)} L${C2[0].toFixed(1)},${C2[1].toFixed(1)}`} fill="none" stroke={stripe} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />}
      {cuff && <Tube pts={[C2, C]} w={s.armW + 1} fill={cuff} line={line} />}
      <Hand at={a.H} deg={a.handDeg} flip={a.flip} kind={a.hand} skin={skin} line={line} />
    </g>
  );
};

// ---------- 五官 ----------
const Eyes: React.FC<{f: Face; blink: number; pal: ArtPalette; xs: [number, number]; y: number; lash?: boolean}> = ({f, blink, pal, xs, y, lash}) => {
  const L = pal.line;
  const one = (x: number, i: number) => {
    const kind = f.eyes === 'wink' && i === 0 ? 'happy' : f.eyes === 'wink' ? 'dot' : f.eyes;
    if (blink > 0.5 && (kind === 'dot' || kind === 'look' || kind === 'wide' || kind === 'worried')) {
      return <path key={i} d={`M${x - 7},${y + 1} Q${x},${y + 4} ${x + 7},${y + 1}`} stroke={L} strokeWidth={4.5} fill="none" strokeLinecap="round" />;
    }
    // 主讲人：眼尾一根上翘的睫毛（点眼类才有）
    if (lash && (kind === 'dot' || kind === 'look' || kind === 'worried')) {
      const ex = kind === 'look' ? x + 3 : x;
      const ey = kind === 'look' ? y - 4 : kind === 'worried' ? y + 1 : y;
      const rx = kind === 'worried' ? 5 : kind === 'look' ? 5.4 : 5.6;
      const ry = kind === 'worried' ? 6 : kind === 'look' ? 6.6 : 7;
      return (
        <g key={i}>
          <ellipse cx={ex} cy={ey} rx={rx} ry={ry} fill={L} />
          <path d={`M${ex + 4},${ey - 5} L${ex + 10},${ey - 10}`} stroke={L} strokeWidth={3.5} strokeLinecap="round" />
        </g>
      );
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

// ---------- 独立小道具：灯泡图标（镜头作者可单独用；角色本身不再戴灯泡） ----------
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
          return <line key={i} x1={cx + Math.cos(rad) * r1} y1={cy + Math.sin(rad) * r1} x2={cx + Math.cos(rad) * r2} y2={cy + Math.sin(rad) * r2} stroke={L} strokeWidth={4.5} strokeLinecap="round" />;
        })}
      <path
        d={`M${cx - r * 0.55},${cy + r * 0.75} C${cx - r * 1.35},${cy + r * 0.2} ${cx - r * 1.1},${cy - r * 1.1} ${cx},${cy - r * 1.1} C${cx + r * 1.1},${cy - r * 1.1} ${cx + r * 1.35},${cy + r * 0.2} ${cx + r * 0.55},${cy + r * 0.75} Z`}
        fill={on ? pal.glow : pal.card}
        stroke={L}
        strokeWidth={SW * 0.8}
        strokeLinejoin="round"
      />
      {on && <path d={`M${cx - 8},${cy - 6} Q${cx - 6},${cy - 12} ${cx},${cy - 13}`} stroke={pal.card} strokeWidth={4} fill="none" strokeLinecap="round" />}
      <rect x={cx - r * 0.55} y={cy + r * 0.72} width={r * 1.1} height={r * 0.7} rx={3} fill={pal.inkSoft} stroke={L} strokeWidth={SW * 0.7} />
    </g>
  );
};

// ================= host：主讲人 =================
// 栗色侧分短发 + 低马尾（暖橙发圈）；头戴式耳机 = 状态道具（没懂：耳罩灯灭；懂了：耳罩亮琥珀色、往外冒声波）；
// 暖橙运动夹克（奶白拉链、袖子一道奶白条、墨绿罗纹领 / 袖口 / 下摆）；墨绿短裤；奶白条纹袜 + 厚底鞋。个子矮、头大，约 3.6 头身。

const HostBody: React.FC<{pal: ArtPalette}> = ({pal}) => {
  const L = pal.line;
  const o = {stroke: L, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  return (
    <g>
      {/* 腿 + 条纹袜 */}
      <Tube pts={[[-22, 440], [-24, 568]]} w={24} fill={pal.skinA} line={L} />
      <Tube pts={[[26, 440], [30, 568]]} w={24} fill={pal.skinA} line={L} />
      <Tube pts={[[-24, 526], [-24, 568]]} w={28} fill={pal.light} line={L} />
      <Tube pts={[[30, 526], [30, 568]]} w={28} fill={pal.light} line={L} />
      <path d="M-36,538 L-12,538 M18,538 L42,538" stroke={pal.warm} strokeWidth={6} />
      {/* 厚底鞋：奶白鞋面 + 墨绿厚鞋底 */}
      <path d="M-46,582 Q-48,558 -28,556 L-12,556 Q10,558 14,582 Z" fill={pal.light} {...o} />
      <path d="M-50,580 L18,580 Q24,580 24,588 L24,592 Q24,600 14,600 L-42,600 Q-50,600 -50,592 Z" fill={pal.deep} {...o} />
      <path d="M10,582 Q8,558 28,556 L44,556 Q66,558 70,582 Z" fill={pal.light} {...o} />
      <path d="M6,580 L74,580 Q80,580 80,588 L80,592 Q80,600 70,600 L14,600 Q6,600 6,592 Z" fill={pal.deep} {...o} />
      <path d="M-30,566 L-16,566 M26,566 L40,566" stroke={L} strokeWidth={3.5} strokeLinecap="round" />
      {/* 墨绿短裤 */}
      <path d="M-54,360 L62,360 L74,446 L12,450 L6,416 L0,450 L-64,446 Z" fill={pal.deep} {...o} />
      <path d="M-62,432 L-2,436 M12,436 L72,432" stroke={pal.deepSoft} strokeWidth={4} strokeLinecap="round" />
      {/* 脖子 */}
      <path d="M-6,176 L-6,210 L20,210 L20,176" fill={pal.skinA} {...o} />
      {/* 夹克：身体 + 墨绿罗纹下摆 */}
      <path d="M-52,228 Q-52,208 -30,206 L42,206 Q62,208 62,228 L66,354 L-58,354 Z" fill={pal.warm} {...o} />
      <rect x={-62} y={342} width={132} height={28} rx={10} fill={pal.deep} {...o} />
      <path d="M-44,348 L-44,364 M-26,348 L-26,364 M-8,348 L-8,364 M10,348 L10,364 M28,348 L28,364 M46,348 L46,364" stroke={pal.deepSoft} strokeWidth={3} strokeLinecap="round" />
      {/* 奶白拉链 + 拉头 */}
      <path d="M8,214 L8,342" stroke={pal.light} strokeWidth={6} strokeLinecap="round" />
      <rect x={1} y={232} width={14} height={20} rx={5} fill={pal.light} stroke={L} strokeWidth={3.5} />
      {/* 胸前琥珀色星星徽章 + 一个小口袋 */}
      <circle cx={-26} cy={256} r={11} fill={pal.glow} stroke={L} strokeWidth={4} />
      <path d="M-26,248 Q-25,255 -18,256 Q-25,257 -26,264 Q-27,257 -34,256 Q-27,255 -26,248 Z" fill={L} />
      <path d="M24,300 L50,300" stroke={pal.warmDeep} strokeWidth={5} strokeLinecap="round" />
      {/* 墨绿罗纹立领 */}
      <path d="M-30,204 Q8,232 44,204 L36,192 Q8,214 -22,192 Z" fill={pal.deep} {...o} />
    </g>
  );
};

/** 耳机：远侧耳罩（画在脸后面） */
const PhonesFar: React.FC<{pal: ArtPalette}> = ({pal}) => <rect x={68} y={94} width={26} height={52} rx={12} fill={pal.deep} stroke={pal.line} strokeWidth={SW} />;

/** 耳机：头梁 + 近侧耳罩 + 亮灯时的声波（lit 0..1） */
const PhonesNear: React.FC<{pal: ArtPalette; lit: number}> = ({pal, lit}) => {
  const L = pal.line;
  const on = lit > 0.5;
  const band = 'M-62,112 C-70,40 -28,20 10,20 C52,20 90,40 82,100';
  return (
    <g>
      <path d={band} fill="none" stroke={L} strokeWidth={13 + SW * 2} strokeLinecap="round" />
      <path d={band} fill="none" stroke={pal.deep} strokeWidth={13} strokeLinecap="round" />
      {/* 头梁上的暖橙软垫 */}
      <path d="M-30,32 C-12,22 26,20 44,28" fill="none" stroke={L} strokeWidth={18 + SW * 2} strokeLinecap="round" />
      <path d="M-30,32 C-12,22 26,20 44,28" fill="none" stroke={pal.warm} strokeWidth={18} strokeLinecap="round" />
      {/* 近侧耳罩 */}
      <rect x={-86} y={92} width={44} height={66} rx={20} fill={pal.deep} stroke={L} strokeWidth={SW} />
      <ellipse cx={-68} cy={125} rx={12} ry={21} fill={on ? pal.glow : pal.deepDark} stroke={L} strokeWidth={4} />
      {on ? <path d="M-72,112 Q-76,120 -74,128" stroke={pal.card} strokeWidth={4} fill="none" strokeLinecap="round" /> : <circle cx={-68} cy={125} r={4} fill={pal.deepSoft} />}
      {/* 声波：亮灯时从耳罩往外冒三道弧 */}
      {lit > 0.05 &&
        [0, 1, 2].map((i) => {
          const k = Math.min(1, lit * 1.2 - i * 0.12);
          if (k <= 0) return null;
          const x = -98 - i * 16;
          const h = (14 + i * 9) * k;
          return <path key={i} d={`M${x + 6},${125 - h} Q${x - 8 * k},125 ${x + 6},${125 + h}`} stroke={L} strokeWidth={5} fill="none" strokeLinecap="round" />;
        })}
    </g>
  );
};

const HostHead: React.FC<{pal: ArtPalette; f: Face; blink: number; mouth: number; nod: number; bulb: number}> = ({pal, f, blink, mouth, nod, bulb}) => {
  const L = pal.line;
  const o = {stroke: L, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  const fy = nod * 5;
  const strand = mixHex(pal.hairA, L, 0.45);
  return (
    <g>
      {/* 低马尾 + 暖橙发圈 */}
      <path d="M-58,158 C-96,158 -122,196 -112,242 C-100,222 -86,208 -56,196 Z" fill={pal.hairA} {...o} />
      <path d="M-100,212 Q-96,200 -84,194" stroke={strand} strokeWidth={4} fill="none" strokeLinecap="round" />
      <ellipse cx={-64} cy={176} rx={11} ry={16} transform="rotate(-24 -64 176)" fill={pal.warm} stroke={L} strokeWidth={4.5} />
      <PhonesFar pal={pal} />
      {/* 后发 */}
      <path d="M-76,166 C-94,96 -74,28 8,28 C90,28 106,96 92,158 Q86,170 74,162 L-62,170 Q-72,178 -76,166 Z" fill={pal.hairA} {...o} />
      {/* 脸 */}
      <ellipse cx={8} cy={122} rx={68} ry={66} fill={pal.skinA} {...o} />
      <g transform={`translate(0 ${fy})`}>
        <ellipse cx={-22} cy={150} rx={11} ry={6.5} fill={pal.blushA} opacity={f.blush} />
        <ellipse cx={54} cy={150} rx={11} ry={6.5} fill={pal.blushA} opacity={f.blush} />
        <Brows f={f} xs={[-4, 40]} y={104} thick={4.5} line={L} />
        <Eyes f={f} blink={blink} pal={pal} xs={[-2, 40]} y={126} lash />
        <Mouth f={f} open={mouth} at={[20, 157]} pal={pal} />
      </g>
      {/* 侧分斜刘海：从左往右一大片扫过额头，发梢收在右鬓 */}
      <path d="M-64,114 C-76,54 -34,30 10,30 C60,30 92,56 82,108 C74,90 62,78 48,70 C34,84 10,88 -12,90 C-34,94 -52,102 -64,114 Z" fill={pal.hairA} {...o} />
      <path d="M-30,44 Q10,40 40,62 M-46,70 Q-20,58 12,62" stroke={strand} strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* 右鬓一缕 */}
      <path d="M80,98 C88,122 86,148 78,164 L68,158 C74,140 74,120 70,102 Z" fill={pal.hairA} {...o} />
      <PhonesNear pal={pal} lit={bulb} />
    </g>
  );
};

// ================= buddy：搭档 =================
// 反戴棒球帽（墨绿帽身、暖橙帽檐朝后、前额露出调节扣的开口）；深棕肤色、粗眉、雀斑；
// 墨绿圆领毛衣（胸前一道暖橙宽条 + 两根奶白细线、奶白罗纹领口和袖口）；沙色工装裤（侧袋、卷边）；暖橙高帮鞋。个子高、肩宽。

const BuddyBody: React.FC<{pal: ArtPalette}> = ({pal}) => {
  const L = pal.line;
  const o = {stroke: L, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  return (
    <g>
      {/* 沙色工装裤 + 侧袋 + 卷边 */}
      <path d="M-60,368 L68,368 L72,540 L14,540 L8,432 L2,432 L-4,540 L-62,540 Z" fill={pal.sand} {...o} />
      <rect x={-60} y={446} width={30} height={38} rx={6} fill={pal.sand} stroke={L} strokeWidth={4} />
      <path d="M-60,458 L-30,458" stroke={L} strokeWidth={3.5} />
      <path d="M40,388 L44,520" stroke={pal.sandDeep} strokeWidth={4} strokeLinecap="round" />
      <rect x={-65} y={526} width={64} height={22} rx={7} fill={pal.sandDeep} {...o} />
      <rect x={11} y={526} width={64} height={22} rx={7} fill={pal.sandDeep} {...o} />
      {/* 暖橙高帮鞋 + 奶白鞋底 */}
      <path d="M-58,546 L-8,546 L-6,568 Q16,568 18,586 L-60,586 Z" fill={pal.warm} {...o} />
      <rect x={-62} y={582} width={84} height={18} rx={8} fill={pal.light} {...o} />
      <path d="M-46,556 L-24,556 M-46,568 L-24,568" stroke={L} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M14,546 L64,546 L66,568 Q88,568 90,586 L12,586 Z" fill={pal.warm} {...o} />
      <rect x={10} y={582} width={84} height={18} rx={8} fill={pal.light} {...o} />
      <path d="M26,556 L48,556 M26,568 L48,568" stroke={L} strokeWidth={3.5} strokeLinecap="round" />
      {/* 脖子 */}
      <path d="M-8,176 L-8,206 L24,206 L24,176" fill={pal.skinB} {...o} />
      {/* 墨绿毛衣 + 胸前暖橙宽条 */}
      <path d="M-68,240 Q-70,210 -38,204 L48,204 Q78,210 76,240 L80,362 L-72,362 Z" fill={pal.deep} {...o} />
      <path d="M-69,262 L77,262 L78,298 L-70,298 Z" fill={pal.warm} stroke={L} strokeWidth={4.5} strokeLinejoin="round" />
      <path d="M-66,271 L75,271 M-67,289 L76,289" stroke={pal.light} strokeWidth={3.5} />
      {/* 罗纹下摆 */}
      <rect x={-76} y={350} width={160} height={28} rx={10} fill={pal.deep} {...o} />
      <path d="M-56,356 L-56,372 M-36,356 L-36,372 M-16,356 L-16,372 M4,356 L4,372 M24,356 L24,372 M44,356 L44,372 M64,356 L64,372" stroke={pal.deepSoft} strokeWidth={3} strokeLinecap="round" />
      {/* 奶白罗纹圆领 */}
      <path d="M-32,204 Q8,238 48,204 L40,194 Q8,222 -24,194 Z" fill={pal.light} {...o} />
    </g>
  );
};

const BuddyHead: React.FC<{pal: ArtPalette; f: Face; blink: number; mouth: number; nod: number}> = ({pal, f, blink, mouth, nod}) => {
  const L = pal.line;
  const o = {stroke: L, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  const fy = nod * 5;
  return (
    <g>
      {/* 帽檐朝后（暖橙） */}
      <path d="M-58,72 C-98,60 -130,68 -140,88 C-114,98 -82,96 -56,90 Z" fill={pal.warm} {...o} />
      {/* 耳朵 */}
      <ellipse cx={-58} cy={126} rx={13} ry={16} fill={pal.skinB} {...o} />
      <ellipse cx={74} cy={126} rx={13} ry={16} fill={pal.skinB} {...o} />
      {/* 脸：方一点的下巴 */}
      <path d="M-58,88 C-58,58 -36,46 8,46 C52,46 74,58 74,90 L72,140 C70,170 44,186 8,186 C-28,186 -56,170 -58,140 Z" fill={pal.skinB} {...o} />
      {/* 鬓角 */}
      <path d="M-58,78 Q-70,102 -58,118 Q-56,102 -46,90 Z" fill={L} {...o} />
      <path d="M74,78 Q84,98 74,114 Q72,98 64,90 Z" fill={L} {...o} />
      <g transform={`translate(0 ${fy})`}>
        <ellipse cx={-20} cy={150} rx={11} ry={6} fill={pal.blushB} opacity={f.blush} />
        <ellipse cx={56} cy={150} rx={11} ry={6} fill={pal.blushB} opacity={f.blush} />
        {/* 雀斑 */}
        {[[-30, 142], [-20, 138], [-12, 145], [48, 142], [58, 138], [66, 145]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.8} fill={pal.freckle} />
        ))}
        <Brows f={f} xs={[-10, 40]} y={104} thick={7.5} line={L} />
        <Eyes f={f} blink={blink} pal={pal} xs={[-8, 40]} y={126} />
        <path d="M20,132 Q28,140 20,146" stroke={pal.nose} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <Mouth f={f} open={mouth} at={[20, 163]} pal={pal} />
      </g>
      {/* 帽身（墨绿）+ 缝线 + 顶扣 */}
      <path d="M-68,88 C-74,20 -36,-10 8,-10 C54,-10 90,20 84,88 C50,78 -30,78 -68,88 Z" fill={pal.deep} {...o} />
      <path d="M8,-8 C-12,20 -22,50 -26,80 M8,-8 C28,20 38,50 42,79" stroke={pal.deepSoft} strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* 前额：调节扣的开口，露出一撮头发 + 扣带 */}
      <path d="M10,80 Q12,54 32,54 Q52,54 54,80 Z" fill={L} {...o} />
      <path d="M8,76 L56,76" stroke={L} strokeWidth={10 + SW} strokeLinecap="round" />
      <path d="M8,76 L56,76" stroke={pal.deep} strokeWidth={10} strokeLinecap="round" />
      <circle cx={8} cy={-12} r={8} fill={pal.warm} stroke={L} strokeWidth={4} />
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
  const sleeve = isHost ? pal.warm : pal.deep;
  const cuff = isHost ? pal.deep : pal.light;
  const stripe = isHost ? pal.light : undefined;
  const lean = pose === 'surprised' ? -3 : pose === 'think' ? 2 : 0;
  // 手臂在身体前面画；思考姿势的托肘手要在托下巴那只手后面
  const armR = <Arm who={who} pose={pose} side={1} wave={wave + talkWave} sleeve={sleeve} skin={skin} line={L} cuff={cuff} stripe={stripe} />;
  const armL = <Arm who={who} pose={pose} side={-1} wave={0} sleeve={sleeve} skin={skin} line={L} cuff={cuff} stripe={stripe} />;
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
      <circle cx={cx} cy={cy} r={r} fill={bg ?? (who === 'host' ? pal.glowSoft : pal.deepPale)} />
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
