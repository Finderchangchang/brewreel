import React from 'react';

// ============================================================
// 行业插画：真正的图形实现（设计 docs/dev/industry-design.md §2）。
// 每个图标是一个纯展示组件：viewBox 固定 "0 0 200 200"，只用 3 种颜色
//   fillMain / fillPop  —— 从当前主题取的 2 种填色（index.tsx 按 color 挑）
//   stroke              —— 描边色（也允许当小面积填色用，如指针、轮毂）
// t：镜头内秒数，animate=false 时 index.tsx 会把 t 钉在 0（=静止姿态）。
// 动画只允许「呼吸/漂浮/蒸汽/指针转动/开合摆动」这类不改变主体大小和数量的小动作。
// 新增图标：在下面写一个组件，然后加进文件末尾的 ICONS 表，key 与 names.json 的 id 一致。
// ============================================================

export type IconProps = {
  fillMain: string;
  fillPop: string;
  stroke: string;
  /** 镜头内秒数；animate=false 时恒为 0 */
  t: number;
};

const SW = 9;
const cap = {strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

/** 常驻漂浮（和 core/anim.ts 的 float 同公式，插画自包含，不依赖镜头时间轴） */
const bob = (t: number, amp = 6, period = 1.6, phase = 0) => Math.sin((t / period) * Math.PI * 2 + phase) * amp;

/** 三缕蒸汽，左右轻摆 + 明暗呼吸，循环 1.4s，不改变数量/大小 */
const Steam: React.FC<{cx: number; top: number; t: number; stroke: string; w?: number}> = ({cx, top, t, stroke, w = 34}) => {
  const sway = (i: number) => Math.sin((t * Math.PI * 2) / 1.4 + i * 2.1) * 7;
  const op = 0.42 + 0.16 * Math.sin((t * Math.PI * 2) / 1.4);
  return (
    <g stroke={stroke} strokeWidth={6} fill="none" opacity={op} {...cap}>
      {[-1, 0, 1].map((i) => (
        <path key={i} d={`M ${cx + i * w * 0.42} ${top} q ${8 + sway(i)} -14 0 -28 q -8 -14 0 -28`} />
      ))}
    </g>
  );
};

/** 十字闪光，明暗+轻微大小的「眨」，循环 1.2s（装饰性点缀，不是主体） */
const Sparkle: React.FC<{cx: number; cy: number; t: number; fill: string; r?: number; phase?: number}> = ({cx, cy, t, fill, r = 8, phase = 0}) => {
  const s = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 1.2 + phase);
  const rr = r.toFixed(1);
  const rr28 = (r * 0.28).toFixed(1);
  return (
    <g opacity={0.35 + 0.65 * s} transform={`translate(${cx} ${cy}) scale(${(0.6 + 0.5 * s).toFixed(2)})`}>
      <path d={`M0 -${rr} L${rr28} -${rr28} L${rr} 0 L${rr28} ${rr28} L0 ${rr} L-${rr28} ${rr28} L-${rr} 0 L-${rr28} -${rr28} Z`} fill={fill} />
    </g>
  );
};

// 收据锯齿底边（模块级预计算，闭合路径，避免每帧现算拼字符串出错）
const RECEIPT_PATH = (() => {
  const left = 40;
  const right = 160;
  const top = 40;
  const bodyBottom = 148;
  const teeth = 6;
  const toothW = (right - left) / teeth;
  let d = `M ${left} ${top} H ${right} V ${bodyBottom} `;
  for (let i = teeth; i >= 0; i--) {
    const x = left + i * toothW;
    const y = bodyBottom + (i % 2 === 0 ? 10 : 0);
    d += `L ${x} ${y} `;
  }
  return d + 'Z';
})();

// ============================================================ _base ============================================================

const PinIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const y = bob(t, 6, 1.6);
  return (
    <g>
      <ellipse cx={100} cy={176} rx={28} ry={7} fill={stroke} opacity={0.15} />
      <g transform={`translate(0 ${y.toFixed(2)})`}>
        <path
          d="M100 30 C60 30 34 58 34 96 C34 138 100 176 100 176 C100 176 166 138 166 96 C166 58 140 30 100 30 Z"
          fill={fillMain}
          stroke={stroke}
          strokeWidth={SW}
          {...cap}
        />
        <circle cx={100} cy={94} r={30} fill={fillPop} stroke={stroke} strokeWidth={SW} />
      </g>
    </g>
  );
};

const SubwayIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const dx = Math.sin((t * Math.PI * 2) / 1.4) * 3;
  const lineOp = 0.3 + 0.25 * Math.sin((t * Math.PI * 2) / 1.4 + 1);
  return (
    <g>
      <g stroke={stroke} strokeWidth={6} opacity={lineOp} {...cap}>
        <line x1={26} y1={80} x2={44} y2={80} />
        <line x1={20} y1={100} x2={42} y2={100} />
        <line x1={26} y1={120} x2={44} y2={120} />
      </g>
      <g transform={`translate(${dx.toFixed(2)} 0)`}>
        <path
          d="M56 60 h72 a24 24 0 0 1 24 24 v46 a10 10 0 0 1 -10 10 h-100 a10 10 0 0 1 -10 -10 v-46 a24 24 0 0 1 24 -24 Z"
          fill={fillMain}
          stroke={stroke}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
        <rect x={66} y={76} width={30} height={26} rx={8} fill={fillPop} stroke={stroke} strokeWidth={7} />
        <rect x={104} y={76} width={30} height={26} rx={8} fill={fillPop} stroke={stroke} strokeWidth={7} />
        <rect x={70} y={132} width={60} height={8} rx={4} fill={stroke} opacity={0.5} />
        <circle cx={78} cy={150} r={12} fill={stroke} />
        <circle cx={122} cy={150} r={12} fill={stroke} />
        <circle cx={78} cy={150} r={4} fill={fillMain} />
        <circle cx={122} cy={150} r={4} fill={fillMain} />
      </g>
    </g>
  );
};

const ClockIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const a = (t / 1.5) * Math.PI * 2;
  const hx = 100 + 40 * Math.sin(a);
  const hy = 100 - 40 * Math.cos(a);
  const ha = a * 0.15;
  const hhx = 100 + 24 * Math.sin(ha);
  const hhy = 100 - 24 * Math.cos(ha);
  return (
    <g>
      <circle cx={100} cy={100} r={70} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      {[0, 1, 2, 3].map((i) => {
        const ang = (i * Math.PI) / 2;
        return (
          <line
            key={i}
            x1={100 + 58 * Math.sin(ang)}
            y1={100 - 58 * Math.cos(ang)}
            x2={100 + 50 * Math.sin(ang)}
            y2={100 - 50 * Math.cos(ang)}
            stroke={stroke}
            strokeWidth={6}
            strokeLinecap="round"
          />
        );
      })}
      <line x1={100} y1={100} x2={hhx.toFixed(1)} y2={hhy.toFixed(1)} stroke={stroke} strokeWidth={9} strokeLinecap="round" />
      <line x1={100} y1={100} x2={hx.toFixed(1)} y2={hy.toFixed(1)} stroke={fillPop} strokeWidth={7} strokeLinecap="round" />
      <circle cx={100} cy={100} r={7} fill={stroke} />
    </g>
  );
};

const CalendarIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const pulse = 0.55 + 0.45 * Math.sin((t * Math.PI * 2) / 1.4);
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) cells.push([r, c]);
  return (
    <g>
      <rect x={36} y={46} width={128} height={116} rx={16} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <rect x={36} y={46} width={128} height={30} rx={16} fill={stroke} opacity={0.12} />
      <line x1={68} y1={32} x2={68} y2={58} stroke={stroke} strokeWidth={8} strokeLinecap="round" />
      <line x1={132} y1={32} x2={132} y2={58} stroke={stroke} strokeWidth={8} strokeLinecap="round" />
      {cells.map(([r, c]) => {
        const x = 54 + c * 26;
        const y = 96 + r * 24;
        const hi = r === 1 && c === 2;
        return <rect key={`${r}-${c}`} x={x} y={y} width={16} height={14} rx={4} fill={hi ? fillPop : stroke} opacity={hi ? pulse : 0.16} />;
      })}
    </g>
  );
};

// ============================================================ food ============================================================

const BowlIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => (
  <g>
    <Steam cx={100} top={64} t={t} stroke={stroke} />
    <path d="M34 108 a66 20 0 0 0 132 0 Z" fill={fillPop} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
    <path
      d="M30 106 C30 96 170 96 170 106 C166 140 138 160 100 160 C62 160 34 140 30 106 Z"
      fill={fillMain}
      stroke={stroke}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
    <ellipse cx={100} cy={106} rx={70} ry={16} fill="none" stroke={stroke} strokeWidth={6} opacity={0.3} />
    <line x1={118} y1={70} x2={140} y2={148} stroke={stroke} strokeWidth={7} strokeLinecap="round" />
    <line x1={130} y1={70} x2={150} y2={144} stroke={stroke} strokeWidth={7} strokeLinecap="round" />
  </g>
);

const CoffeeIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => (
  <g>
    <Steam cx={92} top={58} t={t} stroke={stroke} w={26} />
    <ellipse cx={100} cy={158} rx={54} ry={10} fill={fillMain} stroke={stroke} strokeWidth={SW} />
    <path d="M58 92 h68 v42 a34 34 0 0 1 -68 0 Z" fill={fillPop} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
    <path d="M126 100 q26 -4 26 20 q0 22 -26 20" fill="none" stroke={stroke} strokeWidth={8} strokeLinecap="round" />
    <path d="M64 92 q36 12 68 0" fill="none" stroke={stroke} strokeWidth={5} opacity={0.4} />
  </g>
);

const TeaIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const by = bob(t, 4, 1.4);
  return (
    <g>
      <path d="M64 60 h72 l-10 100 a10 10 0 0 1 -10 8 h-32 a10 10 0 0 1 -10 -8 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M58 60 q42 -22 84 0" fill="none" stroke={stroke} strokeWidth={SW} strokeLinecap="round" />
      <line x1={112} y1={38} x2={104} y2={70} stroke={stroke} strokeWidth={8} strokeLinecap="round" />
      <path d="M70 70 q30 10 60 0" stroke={stroke} strokeWidth={5} opacity={0.35} fill="none" />
      <g transform={`translate(0 ${by.toFixed(2)})`}>
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={80 + i * 16} cy={140} r={6} fill={fillPop} stroke={stroke} strokeWidth={3} />
        ))}
      </g>
    </g>
  );
};

const ReceiptIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const pop = 0.75 + 0.25 * Math.sin((t * Math.PI * 2) / 1.3);
  return (
    <g>
      <path d={RECEIPT_PATH} fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      {[64, 84, 104, 124].map((y, i) => (
        <line key={i} x1={56} y1={y} x2={i === 3 ? 100 : 144} y2={y} stroke={stroke} strokeWidth={6} strokeLinecap="round" opacity={0.45} />
      ))}
      <g transform={`translate(100 128) scale(${pop.toFixed(2)})`}>
        <circle r={16} fill={fillPop} stroke={stroke} strokeWidth={6} />
        <path d="M-7 0 L-2 6 L8 -7" stroke={stroke} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
};

const HotpotIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const bubOp = (i: number) => 0.3 + 0.4 * Math.max(0, Math.sin((t * Math.PI * 2) / 1.3 + i * 1.7));
  return (
    <g>
      <rect x={30} y={58} width={140} height={16} rx={8} fill={fillPop} stroke={stroke} strokeWidth={7} />
      <rect x={30} y={70} width={140} height={70} rx={14} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <path d="M100 70 V140" stroke={stroke} strokeWidth={7} />
      <path d="M40 70 C40 100 70 96 70 70" fill="none" stroke={stroke} strokeWidth={5} opacity={0.3} />
      <path d="M130 70 C130 100 160 96 160 70" fill="none" stroke={stroke} strokeWidth={5} opacity={0.3} />
      <circle cx={64} cy={122} r={4} fill={fillPop} opacity={bubOp(0)} />
      <circle cx={80} cy={112} r={3} fill={fillPop} opacity={bubOp(1)} />
      <circle cx={128} cy={120} r={4} fill={stroke} opacity={0.28 * bubOp(2)} />
      <path d="M20 92 q-14 6 -6 24" fill="none" stroke={stroke} strokeWidth={8} strokeLinecap="round" />
      <path d="M180 92 q14 6 6 24" fill="none" stroke={stroke} strokeWidth={8} strokeLinecap="round" />
    </g>
  );
};

const SteamerIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => (
  <g>
    <Steam cx={100} top={56} t={t} stroke={stroke} />
    <ellipse cx={100} cy={70} rx={54} ry={12} fill={fillPop} stroke={stroke} strokeWidth={SW} />
    <path d="M50 78 h100 v26 h-100 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
    <path d="M46 104 h108 v28 h-108 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
    {[0, 1, 2, 3, 4].map((i) => (
      <line key={`a${i}`} x1={54 + i * 20} y1={78} x2={54 + i * 20} y2={104} stroke={stroke} strokeWidth={4} opacity={0.3} />
    ))}
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <line key={`b${i}`} x1={50 + i * 20} y1={104} x2={50 + i * 20} y2={132} stroke={stroke} strokeWidth={4} opacity={0.3} />
    ))}
    <ellipse cx={100} cy={132} rx={58} ry={10} fill={stroke} opacity={0.14} />
  </g>
);

// ============================================================ ecommerce ============================================================

const GiftIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const wob = 5 * Math.sin((t * Math.PI * 2) / 1.4);
  return (
    <g>
      <rect x={40} y={92} width={120} height={70} rx={10} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <rect x={40} y={92} width={120} height={22} fill={fillPop} stroke={stroke} strokeWidth={SW} />
      <rect x={90} y={92} width={20} height={70} fill={fillPop} stroke={stroke} strokeWidth={6} />
      <g transform={`translate(100 84) rotate(${wob.toFixed(2)})`}>
        <path d="M0 0 C -34 -34 -50 4 0 8 C 50 4 34 -34 0 0 Z" fill={fillPop} stroke={stroke} strokeWidth={7} strokeLinejoin="round" />
        <circle r={9} fill={fillMain} stroke={stroke} strokeWidth={6} />
      </g>
    </g>
  );
};

const ParcelIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const y = bob(t, 5, 1.6);
  return (
    <g transform={`translate(0 ${y.toFixed(2)})`}>
      <path d="M40 76 L100 50 L160 76 L160 146 L100 172 L40 146 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M40 76 L100 102 L160 76" fill="none" stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <line x1={100} y1={102} x2={100} y2={172} stroke={stroke} strokeWidth={SW} />
      <rect x={82} y={60} width={36} height={90} fill={fillPop} opacity={0.85} transform="rotate(2 100 105)" />
    </g>
  );
};

const ThermoIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const lvl = 60 + 14 * Math.sin((t * Math.PI * 2) / 1.5);
  return (
    <g>
      <rect x={86} y={40} width={28} height={96} rx={14} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <circle cx={100} cy={150} r={26} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <rect x={94} y={lvl.toFixed(1)} width={12} height={(150 - lvl).toFixed(1)} rx={6} fill={fillPop} />
      <circle cx={100} cy={150} r={16} fill={fillPop} />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={118} y1={58 + i * 20} x2={126} y2={58 + i * 20} stroke={stroke} strokeWidth={5} strokeLinecap="round" />
      ))}
    </g>
  );
};

const TagIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const ang = 6 * Math.sin((t * Math.PI * 2) / 1.6);
  return (
    <g transform={`rotate(${ang.toFixed(2)} 70 46)`}>
      <line x1={70} y1={40} x2={70} y2={20} stroke={stroke} strokeWidth={6} strokeLinecap="round" />
      <circle cx={70} cy={46} r={8} fill="none" stroke={stroke} strokeWidth={6} />
      <path d="M78 54 L150 54 L166 78 L150 158 L78 158 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <circle cx={100} cy={80} r={9} fill={fillPop} stroke={stroke} strokeWidth={5} />
      <line x1={92} y1={116} x2={140} y2={116} stroke={stroke} strokeWidth={6} strokeLinecap="round" opacity={0.5} />
      <line x1={92} y1={132} x2={124} y2={132} stroke={stroke} strokeWidth={6} strokeLinecap="round" opacity={0.5} />
    </g>
  );
};

const BatteryIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const lvl = 1.5 + 1.5 * Math.sin((t * Math.PI * 2) / 1.6);
  return (
    <g>
      <rect x={40} y={70} width={110} height={60} rx={12} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <rect x={150} y={88} width={14} height={24} rx={5} fill={stroke} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={54 + i * 32} y={82} width={24} height={36} rx={6} fill={fillPop} opacity={lvl > i ? Math.min(1, lvl - i) : 0.15} />
      ))}
    </g>
  );
};

const BagIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const ang = 3 * Math.sin((t * Math.PI * 2) / 1.6);
  return (
    <g transform={`rotate(${ang.toFixed(2)} 100 60)`}>
      <path d="M74 70 q0 -34 26 -34 q26 0 26 34" fill="none" stroke={stroke} strokeWidth={8} strokeLinecap="round" />
      <path d="M46 70 H154 L146 160 H54 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <rect x={78} y={98} width={44} height={34} rx={8} fill={fillPop} stroke={stroke} strokeWidth={6} />
    </g>
  );
};

// ============================================================ education ============================================================

const LaptopIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const glow = 0.4 + 0.4 * Math.sin((t * Math.PI * 2) / 1.4);
  return (
    <g>
      <rect x={54} y={48} width={92} height={64} rx={8} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <rect x={64} y={58} width={72} height={44} rx={4} fill={fillPop} opacity={0.9} />
      <line x1={76} y1={72} x2={112} y2={72} stroke={stroke} strokeWidth={5} opacity={glow} />
      <line x1={76} y1={84} x2={124} y2={84} stroke={stroke} strokeWidth={5} opacity={glow * 0.7} />
      <path d="M32 158 L60 114 H140 L168 158 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <rect x={88} y={154} width={24} height={6} rx={3} fill={stroke} opacity={0.4} />
    </g>
  );
};

const SheetIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const p = (Math.sin((t * Math.PI * 2) / 1.6) + 1) / 2;
  const cellW = 26;
  const cellH = 22;
  const x0 = 52;
  const y0 = 60;
  const hiX = x0 + cellW + cellW * 2 * p;
  return (
    <g>
      <rect x={44} y={52} width={112} height={96} rx={10} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      {[0, 1, 2, 3].map((c) => (
        <line key={`v${c}`} x1={x0 + c * cellW} y1={52} x2={x0 + c * cellW} y2={148} stroke={stroke} strokeWidth={4} opacity={0.25} />
      ))}
      {[0, 1, 2, 3].map((r) => (
        <line key={`h${r}`} x1={44} y1={y0 + r * cellH} x2={156} y2={y0 + r * cellH} stroke={stroke} strokeWidth={4} opacity={0.25} />
      ))}
      <rect x={hiX.toFixed(1)} y={y0 + cellH} width={cellW} height={cellH} fill={fillPop} opacity={0.85} />
    </g>
  );
};

const KeycapIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const press = Math.max(0, Math.sin((t * Math.PI * 2) / 1.4));
  const dy = 6 * press;
  return (
    <g>
      <rect x={48} y={116} width={104} height={16} rx={8} fill={stroke} opacity={0.15} />
      <g transform={`translate(0 ${dy.toFixed(2)})`}>
        <rect x={48} y={38} width={104} height={104} rx={18} fill={fillMain} stroke={stroke} strokeWidth={SW} />
        <rect x={60} y={50} width={80} height={80} rx={12} fill={fillPop} opacity={0.22 + 0.15 * press} />
        <path d="M84 88 L96 102 L120 74" stroke={stroke} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
};

const BookIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const sway = 3 * Math.sin((t * Math.PI * 2) / 1.6);
  return (
    <g>
      <path d="M100 60 C80 44 54 44 40 52 V138 C54 130 80 130 100 146 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <g transform={`skewX(${sway.toFixed(2)})`} style={{transformOrigin: '100px 100px'}}>
        <path d="M100 60 C120 44 146 44 160 52 V138 C146 130 120 130 100 146 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      </g>
      <line x1={100} y1={60} x2={100} y2={146} stroke={stroke} strokeWidth={5} opacity={0.3} />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={108} y1={72 + i * 16} x2={148} y2={70 + i * 16} stroke={stroke} strokeWidth={4} opacity={0.35} />
      ))}
      <path d="M126 40 v34 l10 -8 l10 8 v-34 Z" fill={fillPop} stroke={stroke} strokeWidth={5} strokeLinejoin="round" />
    </g>
  );
};

const PencilIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const p = (Math.sin((t * Math.PI * 2) / 1.6) + 1) / 2;
  const lineLen = 10 + 50 * p;
  return (
    <g>
      <path d={`M60 150 q0 -16 16 -16 h${lineLen.toFixed(1)}`} fill="none" stroke={stroke} strokeWidth={5} strokeDasharray="4 6" opacity={0.5} strokeLinecap="round" />
      <g transform="rotate(45 100 100)">
        <rect x={70} y={90} width={90} height={20} rx={4} fill={fillMain} stroke={stroke} strokeWidth={SW} />
        <path d="M160 90 L182 100 L160 110 Z" fill={fillPop} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M60 90 L70 90 L70 110 L60 110 L52 100 Z" fill={fillPop} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
        <rect x={70} y={90} width={12} height={20} fill={stroke} opacity={0.5} />
      </g>
    </g>
  );
};

const HeadsetIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const y = bob(t, 4, 1.6);
  return (
    <g transform={`translate(0 ${y.toFixed(2)})`}>
      <path d="M50 110 A50 50 0 0 1 150 110" fill="none" stroke={stroke} strokeWidth={SW} strokeLinecap="round" />
      <rect x={36} y={104} width={26} height={44} rx={12} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <rect x={138} y={104} width={26} height={44} rx={12} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <path d="M62 138 q30 22 40 4" fill="none" stroke={stroke} strokeWidth={6} strokeLinecap="round" />
      <circle cx={104} cy={144} r={7} fill={fillPop} stroke={stroke} strokeWidth={5} />
    </g>
  );
};

// ============================================================ beauty ============================================================

const ScissorsIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const ang = 12 + 10 * Math.abs(Math.sin((t * Math.PI * 2) / 1.2));
  return (
    <g>
      <g transform={`rotate(${(-ang).toFixed(2)} 100 110)`}>
        <path d="M100 110 L60 46 L74 44 L112 108 Z" fill={fillPop} stroke={stroke} strokeWidth={7} strokeLinejoin="round" />
      </g>
      <g transform={`rotate(${ang.toFixed(2)} 100 110)`}>
        <path d="M100 110 L140 46 L126 44 L88 108 Z" fill={fillPop} stroke={stroke} strokeWidth={7} strokeLinejoin="round" />
      </g>
      <line x1={70} y1={140} x2={100} y2={110} stroke={stroke} strokeWidth={7} />
      <line x1={130} y1={140} x2={100} y2={110} stroke={stroke} strokeWidth={7} />
      <circle cx={70} cy={140} r={14} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      <circle cx={130} cy={140} r={14} fill={fillMain} stroke={stroke} strokeWidth={SW} />
    </g>
  );
};

const HairdryerIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const p = 0.4 + 0.4 * Math.sin((t * Math.PI * 2) / 1.3);
  return (
    <g>
      <path d="M60 80 h60 l30 -14 v40 l-30 -14 h-60 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M60 80 v50 q0 14 -14 14 h-10 v-20 q0 -8 8 -8 h16 Z" fill={fillPop} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M156 ${72 + i * 12} q${(16 + 8 * p).toFixed(1)} ${2 + i * 4} ${(28 + 10 * p).toFixed(1)} ${8 + i * 2}`}
          fill="none"
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.5 - i * 0.1}
        />
      ))}
    </g>
  );
};

const PolishIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => (
  <g>
    <Sparkle cx={140} cy={70} t={t} fill={fillPop} r={9} />
    <Sparkle cx={64} cy={96} t={t} fill={fillPop} r={6} phase={2} />
    <path d="M70 76 q30 -18 60 0 v54 a10 10 0 0 1 -10 10 h-40 a10 10 0 0 1 -10 -10 Z" fill={fillPop} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
    <rect x={90} y={40} width={20} height={22} rx={4} fill={fillMain} stroke={stroke} strokeWidth={7} />
    <path d="M76 92 h48" stroke={stroke} strokeWidth={5} opacity={0.35} />
  </g>
);

const TweezersIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const gap = 6 + 6 * Math.abs(Math.sin((t * Math.PI * 2) / 1.2));
  return (
    <g>
      <path d={`M100 40 L${(100 - gap).toFixed(1)} 150 L${(100 - gap + 10).toFixed(1)} 156 L104 60 Z`} fill={fillMain} stroke={stroke} strokeWidth={7} strokeLinejoin="round" />
      <path d={`M100 40 L${(100 + gap).toFixed(1)} 150 L${(100 + gap - 10).toFixed(1)} 156 L96 60 Z`} fill={fillMain} stroke={stroke} strokeWidth={7} strokeLinejoin="round" />
      <path d="M84 44 Q100 30 116 44" fill="none" stroke={stroke} strokeWidth={7} strokeLinecap="round" />
      <rect x={(92 - gap * 0.4).toFixed(1)} y={140} width={(16 + gap * 0.8).toFixed(1)} height={16} rx={4} fill={fillPop} opacity={0.6} />
    </g>
  );
};

const CombIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const ang = 4 * Math.sin((t * Math.PI * 2) / 1.6);
  return (
    <g transform={`rotate(${ang.toFixed(2)} 100 100)`}>
      <rect x={46} y={54} width={108} height={24} rx={12} fill={fillPop} stroke={stroke} strokeWidth={SW} />
      {Array.from({length: 9}).map((_, i) => (
        <line key={i} x1={56 + i * 11} y1={78} x2={56 + i * 11} y2={146} stroke={stroke} strokeWidth={6} strokeLinecap="round" />
      ))}
      <rect x={46} y={54} width={108} height={24} rx={12} fill="none" stroke={stroke} strokeWidth={SW} />
    </g>
  );
};

const ChairIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const ang = 3 * Math.sin((t * Math.PI * 2) / 1.6);
  return (
    <g transform={`rotate(${ang.toFixed(2)} 100 130)`}>
      <ellipse cx={100} cy={172} rx={34} ry={7} fill={stroke} opacity={0.18} />
      <path d="M64 86 v50 h72 v-50" fill="none" stroke={stroke} strokeWidth={7} />
      <path d="M90 152 h20 v14 h-20 Z" fill={fillMain} stroke={stroke} strokeWidth={7} strokeLinejoin="round" />
      <rect x={70} y={120} width={60} height={16} rx={6} fill={fillPop} stroke={stroke} strokeWidth={7} />
      <path d="M56 70 h88 v16 h-88 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
    </g>
  );
};

// ============================================================ travel ============================================================

const BedIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const breathe = 1 + 0.02 * Math.sin((t * Math.PI * 2) / 1.8);
  return (
    <g>
      <path d="M34 150 V96 a10 10 0 0 1 10 -10 h112 a10 10 0 0 1 10 10 v54" fill="none" stroke={stroke} strokeWidth={SW} strokeLinecap="round" />
      <g transform={`scale(1 ${breathe.toFixed(3)})`} style={{transformOrigin: '100px 136px'}}>
        <rect x={34} y={122} width={132} height={28} rx={8} fill={fillMain} stroke={stroke} strokeWidth={SW} />
      </g>
      <rect x={44} y={98} width={36} height={24} rx={8} fill={fillPop} stroke={stroke} strokeWidth={7} />
      <line x1={34} y1={150} x2={34} y2={166} stroke={stroke} strokeWidth={8} strokeLinecap="round" />
      <line x1={166} y1={150} x2={166} y2={166} stroke={stroke} strokeWidth={8} strokeLinecap="round" />
    </g>
  );
};

const WindowIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const cx = 70 + 20 * Math.sin((t * Math.PI * 2) / 1.8 + 1);
  return (
    <g>
      <rect x={40} y={44} width={120} height={112} rx={10} fill={fillPop} opacity={0.16} stroke={stroke} strokeWidth={SW} />
      <path d="M40 130 L80 84 L104 112 L128 86 L160 130 Z" fill={fillMain} stroke={stroke} strokeWidth={7} strokeLinejoin="round" />
      <circle cx={cx.toFixed(1)} cy={68} r={12} fill={fillPop} opacity={0.7} />
      <circle cx={(cx + 18).toFixed(1)} cy={72} r={9} fill={fillPop} opacity={0.5} />
      <line x1={100} y1={44} x2={100} y2={156} stroke={stroke} strokeWidth={7} />
      <line x1={40} y1={100} x2={160} y2={100} stroke={stroke} strokeWidth={7} />
    </g>
  );
};

const HouseIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => (
  <g>
    <Steam cx={132} top={44} t={t} stroke={stroke} w={16} />
    <rect x={128} y={44} width={12} height={20} fill={fillMain} stroke={stroke} strokeWidth={6} />
    <path d="M40 96 L100 48 L160 96 V152 H40 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
    <path d="M30 100 L100 42 L170 100" fill="none" stroke={stroke} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <rect x={54} y={110} width={22} height={22} rx={4} fill={fillPop} opacity={0.6} stroke={stroke} strokeWidth={5} />
    <rect x={88} y={116} width={24} height={36} rx={4} fill={fillPop} stroke={stroke} strokeWidth={6} />
  </g>
);

const BreakfastIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => (
  <g>
    <Steam cx={140} top={70} t={t} stroke={stroke} w={16} />
    <ellipse cx={100} cy={150} rx={70} ry={12} fill={fillMain} stroke={stroke} strokeWidth={SW} />
    <path
      d="M50 100 q26 -20 52 0 q26 -20 52 0 v6 q-26 -14 -52 4 q-26 -18 -52 -4 Z"
      fill={fillPop}
      stroke={stroke}
      strokeWidth={7}
      strokeLinejoin="round"
    />
    <ellipse cx={70} cy={124} rx={16} ry={10} fill={fillPop} opacity={0.5} stroke={stroke} strokeWidth={5} />
    <circle cx={70} cy={124} r={5} fill={fillPop} stroke={stroke} strokeWidth={4} />
    <path d="M124 96 h30 v26 a15 15 0 0 1 -30 0 Z" fill={fillMain} stroke={stroke} strokeWidth={7} strokeLinejoin="round" />
  </g>
);

const LandscapeIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const glow = 0.5 + 0.3 * Math.sin((t * Math.PI * 2) / 1.6);
  return (
    <g>
      <circle cx={140} cy={64} r={20} fill={fillPop} opacity={glow} />
      <circle cx={140} cy={64} r={14} fill={fillPop} stroke={stroke} strokeWidth={6} />
      <path d="M30 150 L80 76 L112 118 L136 90 L170 150 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M60 150 L80 122 L100 150 Z" fill={fillPop} opacity={0.5} />
    </g>
  );
};

const TrainIcon: React.FC<IconProps> = ({fillMain, fillPop, stroke, t}) => {
  const op = 0.35 + 0.3 * Math.sin((t * Math.PI * 2) / 1.3);
  return (
    <g>
      <g stroke={stroke} strokeWidth={6} opacity={op} strokeLinecap="round">
        <line x1={20} y1={90} x2={38} y2={90} />
        <line x1={16} y1={104} x2={36} y2={104} />
        <line x1={22} y1={118} x2={38} y2={118} />
      </g>
      <path d="M60 78 Q30 90 40 118 h110 a14 14 0 0 0 14 -14 v-12 a14 14 0 0 0 -14 -14 Z" fill={fillMain} stroke={stroke} strokeWidth={SW} strokeLinejoin="round" />
      <rect x={78} y={86} width={26} height={18} rx={6} fill={fillPop} stroke={stroke} strokeWidth={6} />
      <rect x={112} y={86} width={26} height={18} rx={6} fill={fillPop} stroke={stroke} strokeWidth={6} />
      <circle cx={70} cy={132} r={10} fill={stroke} />
      <circle cx={140} cy={132} r={10} fill={stroke} />
    </g>
  );
};

// ============================================================ 注册表 ============================================================

export const ICONS: Record<string, React.FC<IconProps>> = {
  '_base/pin': PinIcon,
  '_base/subway': SubwayIcon,
  '_base/clock': ClockIcon,
  '_base/calendar': CalendarIcon,

  'food/bowl': BowlIcon,
  'food/coffee': CoffeeIcon,
  'food/tea': TeaIcon,
  'food/receipt': ReceiptIcon,
  'food/hotpot': HotpotIcon,
  'food/steamer': SteamerIcon,

  'ecommerce/gift': GiftIcon,
  'ecommerce/parcel': ParcelIcon,
  'ecommerce/thermometer': ThermoIcon,
  'ecommerce/tag': TagIcon,
  'ecommerce/battery': BatteryIcon,
  'ecommerce/bag': BagIcon,

  'education/laptop': LaptopIcon,
  'education/sheet': SheetIcon,
  'education/keycap': KeycapIcon,
  'education/book': BookIcon,
  'education/pencil': PencilIcon,
  'education/headset': HeadsetIcon,

  'beauty/scissors': ScissorsIcon,
  'beauty/hairdryer': HairdryerIcon,
  'beauty/polish': PolishIcon,
  'beauty/tweezers': TweezersIcon,
  'beauty/comb': CombIcon,
  'beauty/chair': ChairIcon,

  'travel/bed': BedIcon,
  'travel/window': WindowIcon,
  'travel/house': HouseIcon,
  'travel/breakfast': BreakfastIcon,
  'travel/landscape': LandscapeIcon,
  'travel/train': TrainIcon,
};
