import React from 'react';
import {MASCOT} from '../art';
import {World, mixHex, tint} from './city';
import type {District} from './plan';
import {clamp01} from './ui';
import {starPath} from './rider';

// ============================================================
// 街区道具 + 笑点时间线。道具的世界坐标反推：第 gagAt 拍时正好在角色面前（角色 x + dx）。
// 笑点库是本项目自己的「车站 / 邮路」一套，类型轮换：障碍 / 帮助 / 表演 / 伙伴 / 点亮。
//   crossing 道口：栏杆落下，角色后仰「下腰」从杆下滑过          （障碍）
//   postbox  邮筒：美术城市里的邮筒楼吐出一张邮票贴纸，贴到滑板上  （帮助）
//   punch    检票口：检票钳在角色举着的车票上打一个孔              （帮助）
//   booth    大头贴：路边大头贴机连拍三张，相片条飞到角色手边      （表演，不闪屏）
//   hitch    搭车站：站台上拖行李箱的小刺猬跳上滑板搭一段顺风车    （伙伴）
//   platform 夜站台：站台灯从近到远一盏盏亮起                      （点亮，只放最后一站）
//   gate     城门：一枚木印落下，在角色递出的通关文牒上盖印        （帮助）
//   bridge   石桥：一尾锦鲤从河里跃起，越过角色头顶落回水里        （惊喜）
//   market / cafe / teahouse 接住抛来的礼盒、咖啡、茶；phone 手机扫小票；home 爱心飘来；lantern 灯笼依次亮起（美术城市里画）
// Props 画世界锁定、在角色身后的部分；GagFx 画跟着角色走、在角色前面的部分（贴纸、车票、相片条、刺猬、文牒、锦鲤）。
// 角色身上的反应（表情、后仰）在 plan.exprAt 和 film.tsx 里。
// ============================================================
const DX: Record<string, number> = {duck: 0, sticker: 170, punch: 116, strip: 280, hitch: 70, lamps: 90, seal: 0, leap: 0, catch: 110, scan: 170, share: 260, glow: 200};

/** 道具锚点在屏幕上的 x */
export const propX = (w: World, d: District) => {
  const gagT = d.start + d.def.gagAt * w.plan.beat;
  return w.plan.camAt(gagT) + w.mascotX + (DX[d.def.gag] ?? 100) * (w.lay.mascotScale ?? 1) - w.plan.camAt(w.t);
};

/** 角色的屏幕 y（载具中心），给道具瞄准用 */
export const mascotBaseY = (w: World) => w.lay.mascotY as number;

const ease = (x: number) => 1 - (1 - clamp01(x)) * (1 - clamp01(x));

/** 齿孔邮票贴纸（局部坐标以中心为原点） */
const StampSticker: React.FC<{s: number; color: string; ink: string}> = ({s, color, ink}) => {
  const w = 58 * s;
  const h = 66 * s;
  const holes: React.ReactNode[] = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    holes.push(<circle key={`t${i}`} cx={-w / 2 + (i * w) / n} cy={-h / 2} r={4 * s} fill="#FFFFFF" />, <circle key={`b${i}`} cx={-w / 2 + (i * w) / n} cy={h / 2} r={4 * s} fill="#FFFFFF" />);
    holes.push(<circle key={`l${i}`} cx={-w / 2} cy={-h / 2 + (i * h) / n} r={4 * s} fill="#FFFFFF" />, <circle key={`r${i}`} cx={w / 2} cy={-h / 2 + (i * h) / n} r={4 * s} fill="#FFFFFF" />);
  }
  return (
    <g>
      <rect x={-w / 2 + 3} y={-h / 2 + 4} width={w} height={h} fill="rgba(0,0,0,0.18)" />
      {holes}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#FFFFFF" stroke={ink} strokeWidth={2.5} />
      <rect x={-w / 2 + 7 * s} y={-h / 2 + 7 * s} width={w - 14 * s} height={h - 14 * s} rx={3} fill={color} />
      <path d={`M${-w * 0.3} ${h * 0.24} L${-w * 0.08} ${-h * 0.06} L${w * 0.06} ${h * 0.1} L${w * 0.16} ${-h * 0.02} L${w * 0.32} ${h * 0.24} Z`} fill={mixHex(color, '#FFFFFF', 0.4)} />
      <circle cx={w * 0.16} cy={-h * 0.2} r={6 * s} fill="#FFFFFF" opacity={0.85} />
    </g>
  );
};

export const Props: React.FC<{w: World; d: District; textOn: number}> = ({w, d}) => {
  const ax = propX(w, d);
  if (ax < -900 || ax > w.geo.w + 900) return null;
  const b = w.plan.beat;
  const lb = (w.t - d.start) / b;
  const ink = w.pal.ink;
  const G = w.lay.groundY as number;
  const S = (w.lay.mascotScale ?? 1) as number;
  const my = mascotBaseY(w);
  const pc = d.props.map((c) => tint(c, d.phase));
  const gag = d.def.gag;
  const svg = (children: React.ReactNode) => (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
      {children}
    </svg>
  );
  if (gag === 'duck') {
    // 道口栏杆：立柱在右，横杆朝左落下到角色头顶高度（2.2–3.0 拍落下，5.8–6.4 拍抬起）；柱顶两盏灯交替闪
    const L = 330 * S;
    const px = ax + L / 2;
    const py = my - 176 * S;
    const down = ease((lb - 2.2) / 0.8) * (1 - ease((lb - 5.8) / 0.6));
    const ang = -90 * (1 - down); // 0 = 水平朝左
    const blink = lb > 2 && lb < 6.4 ? Math.floor(w.t * 4) % 2 : -1;
    const seg = 6;
    return svg(
      <g>
        <rect x={px - 11 * S} y={py - 20 * S} width={22 * S} height={G - py + 20 * S} rx={6} fill={tint('#E8ECEF', d.phase)} stroke={ink} strokeWidth={4} />
        <rect x={px - 34 * S} y={G - 34 * S} width={68 * S} height={34 * S} rx={8} fill={pc[3]} stroke={ink} strokeWidth={4} />
        {/* 灯架：左右两盏 */}
        <rect x={px - 52 * S} y={py - 92 * S} width={104 * S} height={14 * S} rx={7} fill={pc[3]} stroke={ink} strokeWidth={3.5} />
        {[-1, 1].map((sd, i) => (
          <g key={sd}>
            {blink === i ? <circle cx={px + sd * 40 * S} cy={py - 60 * S} r={36 * S} fill={pc[2]} opacity={0.35} /> : null}
            <circle cx={px + sd * 40 * S} cy={py - 60 * S} r={20 * S} fill={blink === i ? pc[2] : tint('#5E6573', d.phase)} stroke={ink} strokeWidth={4} />
          </g>
        ))}
        {/* 横杆：主色和白相间 */}
        <g transform={`rotate(${ang} ${px} ${py})`}>
          <rect x={px - L} y={py - 12 * S} width={L + 18 * S} height={24 * S} rx={12 * S} fill="#FFFFFF" stroke={ink} strokeWidth={4} />
          {Array.from({length: seg}, (_, i) => (i % 2 ? null : <rect key={i} x={px - L + 12 * S + (i * (L - 24 * S)) / seg} y={py - 8 * S} width={(L - 24 * S) / seg} height={16 * S} fill={pc[0]} />))}
          <circle cx={px - L + 16 * S} cy={py} r={9 * S} fill={pc[2]} stroke={ink} strokeWidth={3} />
        </g>
        <circle cx={px} cy={py} r={14 * S} fill={pc[3]} stroke={ink} strokeWidth={4} />
      </g>,
    );
  }
  if (gag === 'punch') {
    // 检票口：一根检票柱立在角色前方，柱顶的检票钳画在 GagFx（要压在车票前面）
    const jy = my - 116 * S;
    return svg(
      <g>
        <rect x={ax + 30 * S} y={jy + 30 * S} width={26 * S} height={G - jy - 30 * S} rx={8} fill={pc[1]} stroke={ink} strokeWidth={4} />
        <rect x={ax - 10 * S} y={G - 120 * S} width={110 * S} height={120 * S} rx={14} fill={pc[0]} stroke={ink} strokeWidth={4} />
        <rect x={ax + 8 * S} y={G - 96 * S} width={74 * S} height={14 * S} rx={7} fill={ink} />
        <circle cx={ax + 45 * S} cy={G - 50 * S} r={14 * S} fill={lb > d.def.gagAt ? pc[2] : '#FFFFFF'} stroke={ink} strokeWidth={3.5} />
      </g>,
    );
  }
  if (gag === 'strip') {
    // 大头贴机：落地的小亭子，半截帘子，顶上一个镜头；3.6 / 3.8 / 4.0 拍镜头各亮一下（不闪屏）
    const bw = 190 * S;
    const bh = 300 * S;
    const x0 = ax - bw / 2;
    const y0 = G - bh;
    const lens = [3.6, 3.8, 4.0].some((q) => lb >= q && lb < q + 0.12);
    return svg(
      <g>
        <rect x={x0} y={y0} width={bw} height={bh} rx={18} fill={pc[0]} stroke={ink} strokeWidth={4} />
        <rect x={x0 + 16 * S} y={y0 + 70 * S} width={bw * 0.5} height={bh - 86 * S} rx={8} fill={tint('#2E3440', d.phase)} stroke={ink} strokeWidth={3.5} />
        {/* 帘子：波浪下摆 */}
        <path d={`M${x0 + 16 * S} ${y0 + 70 * S} L${x0 + 16 * S + bw * 0.5} ${y0 + 70 * S} L${x0 + 16 * S + bw * 0.5} ${G - 60 * S} ${Array.from({length: 4}, (_, i) => `Q${x0 + 16 * S + bw * 0.5 - (i + 0.5) * bw * 0.125} ${G - 40 * S} ${x0 + 16 * S + bw * 0.5 - (i + 1) * bw * 0.125} ${G - 60 * S}`).join(' ')} Z`} fill={pc[1]} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
        {/* 右半边：投币口和出片口 */}
        <rect x={x0 + bw * 0.62} y={y0 + 90 * S} width={bw * 0.28} height={14 * S} rx={7} fill={ink} />
        <rect x={x0 + bw * 0.62} y={y0 + 130 * S} width={bw * 0.28} height={60 * S} rx={8} fill={pc[4] ?? '#FFFFFF'} stroke={ink} strokeWidth={3} />
        {/* 顶上的镜头盒 */}
        <rect x={ax - 60 * S} y={y0 - 56 * S} width={120 * S} height={64 * S} rx={14} fill={pc[3]} stroke={ink} strokeWidth={4} />
        <rect x={ax - 44 * S} y={y0 - 10 * S} width={88 * S} height={10 * S} rx={5} fill={ink} />
        <circle cx={ax} cy={y0 - 26 * S} r={20 * S} fill={lens ? '#FFFBE8' : tint('#9FB3C8', d.phase)} stroke={ink} strokeWidth={4} />
        {lens ? <path d={starPath(ax + 30 * S, y0 - 52 * S, 22 * S, 9 * S)} fill="#FFFFFF" stroke={ink} strokeWidth={2.5} /> : null}
      </g>,
    );
  }
  if (gag === 'hitch') {
    // 搭车站：一根站牌立柱，柱上有一块圆站牌，半腰伸出一截小站台（刺猬在上面等车，画在 GagFx）
    const pole = ax + 56 * S;
    const deckY = my + 26 * S;
    return svg(
      <g>
        <rect x={pole - 10 * S} y={my - 150 * S} width={20 * S} height={G - my + 150 * S} rx={6} fill={tint('#E8ECEF', d.phase)} stroke={ink} strokeWidth={4} />
        <rect x={pole - 110 * S} y={deckY} width={124 * S} height={20 * S} rx={8} fill={pc[3]} stroke={ink} strokeWidth={4} />
        <path d={`M${pole - 80 * S} ${deckY + 20 * S} L${pole - 8 * S} ${deckY + 90 * S}`} stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <circle cx={pole} cy={my - 170 * S} r={40 * S} fill={pc[0]} stroke={ink} strokeWidth={4.5} />
        {/* 站牌上的小巴图标 */}
        <rect x={pole - 22 * S} y={my - 190 * S} width={44 * S} height={34 * S} rx={8} fill="#FFFFFF" stroke={ink} strokeWidth={3} />
        <rect x={pole - 16 * S} y={my - 184 * S} width={32 * S} height={12 * S} rx={3} fill={pc[2]} />
        <circle cx={pole - 12 * S} cy={my - 154 * S} r={5 * S} fill={ink} />
        <circle cx={pole + 12 * S} cy={my - 154 * S} r={5 * S} fill={ink} />
      </g>,
    );
  }
  if (gag === 'lamps') {
    // 夜站台：一排站台灯，从近到远在 gagAt 起每 0.3 拍亮一盏；地面一条站台边线
    const n = 5;
    const gap = 180 * S;
    const top = my - 70 * S;
    return svg(
      <g>
        <rect x={ax - 120 * S} y={G - 18 * S} width={gap * n + 120 * S} height={18 * S} fill={tint('#E3C75A', d.phase)} stroke={ink} strokeWidth={3} />
        {Array.from({length: n}, (_, i) => {
          const x = ax + i * gap;
          const on = clamp01((lb - d.def.gagAt - i * 0.3) / 0.15) * (1 - clamp01((lb - 7.6) / 0.3));
          const h = top + (i % 2) * 24 * S;
          return (
            <g key={i}>
              {on > 0 ? <circle cx={x} cy={h} r={80 * S} fill="#FFE7A0" opacity={0.32 * on} /> : null}
              {on > 0 ? <path d={`M${x - 26 * S} ${h + 20 * S} L${x - 90 * S} ${G - 18 * S} L${x + 90 * S} ${G - 18 * S} L${x + 26 * S} ${h + 20 * S} Z`} fill="#FFE7A0" opacity={0.16 * on} /> : null}
              <rect x={x - 7 * S} y={h + 16 * S} width={14 * S} height={G - h - 34 * S} fill={tint('#4B5563', d.phase)} stroke={ink} strokeWidth={3} />
              <path d={`M${x - 34 * S} ${h - 8 * S} L${x + 34 * S} ${h - 8 * S} L${x + 24 * S} ${h - 26 * S} L${x - 24 * S} ${h - 26 * S} Z`} fill={pc[0]} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
              <rect x={x - 22 * S} y={h - 8 * S} width={44 * S} height={26 * S} rx={10} fill={on > 0.5 ? '#FFF3C4' : tint('#C9D1D6', d.phase)} stroke={ink} strokeWidth={3.5} />
              {/* 立柱半腰一块小站名牌（不写字） */}
              <rect x={x + 7 * S} y={h + 90 * S} width={58 * S} height={30 * S} rx={6} fill={pc[1]} stroke={ink} strokeWidth={3} />
            </g>
          );
        })}
      </g>,
    );
  }
  if (gag === 'catch') {
    // 摊位：遮阳棚 + 柜台；3.6 拍抛出礼盒，4.6 拍落进角色手里
    const t0 = 3.6;
    const t1 = d.def.gagAt + 0.4;
    const u = clamp01((lb - t0) / (t1 - t0));
    const sx = ax;
    const sy = G - 160 * S;
    // 落点在角色右手边（身体外侧），不被身体挡住
    const ex = w.mascotX + 100 * S;
    const ey = my - 50 * S;
    const held = lb >= t1 && lb < 6.6;
    const bx = held ? ex : sx + (ex - sx) * u;
    const by = held ? ey : sy + (ey - sy) * u - Math.sin(u * Math.PI) * 260 * S;
    const showBox = lb >= t0 - 0.2 && lb < 6.6;
    const item = d.def.item ?? 'box';
    // 咖啡 / 茶：店就是美术城市里的咖啡馆、茶馆，这里不再立摊位，只画递过来的杯子
    const stall = item === 'box';
    const cup = (k: 'cup' | 'tea') => (
      <g>
        {k === 'cup' ? (
          <g>
            <path d={`M${-26 * S} ${-30 * S} L${26 * S} ${-30 * S} L${20 * S} ${26 * S} L${-20 * S} ${26 * S} Z`} fill="#FFFFFF" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
            <rect x={-24 * S} y={-8 * S} width={48 * S} height={16 * S} fill={pc[0]} />
            <rect x={-30 * S} y={-40 * S} width={60 * S} height={12 * S} rx={5} fill={pc[0]} stroke={ink} strokeWidth={3.5} />
          </g>
        ) : (
          <g>
            <path d={`M${-30 * S} ${-16 * S} L${30 * S} ${-16 * S} Q${28 * S} ${22 * S} 0 ${24 * S} Q${-28 * S} ${22 * S} ${-30 * S} ${-16 * S} Z`} fill={pc[1]} stroke={ink} strokeWidth={4} />
            <path d={`M${-22 * S} ${-6 * S} L${22 * S} ${-6 * S}`} stroke={pc[0]} strokeWidth={6} />
            <ellipse cx={0} cy={26 * S} rx={38 * S} ry={8 * S} fill={pc[0]} stroke={ink} strokeWidth={3} />
          </g>
        )}
        {[-10, 8].map((sx, i) => <path key={i} d={`M${sx * S} ${-44 * S} q${-8 * S} ${-12 * S} 0 ${-24 * S} q${8 * S} ${-12 * S} 0 ${-24 * S}`} fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.7} />)}
      </g>
    );
    return svg(
      <g>
        {stall ? (
        <g>
        <rect x={ax - 110 * S} y={G - 140 * S} width={220 * S} height={140 * S} fill={tint('#FFF6E6', d.phase)} stroke={ink} strokeWidth={4} />
        {Array.from({length: 6}, (_, i) => (
          <path key={i} d={`M${ax - 130 * S + i * 43 * S} ${G - 200 * S} l${43 * S} 0 l0 40 q${-21 * S} 22 ${-43 * S} 0 Z`} fill={i % 2 ? '#FFFFFF' : pc[0]} stroke={ink} strokeWidth={3} />
        ))}
        {[0, 1, 2].map((i) => <circle key={i} cx={ax - 60 * S + i * 60 * S} cy={G - 110 * S} r={20 * S} fill={[pc[3], pc[2], pc[0]][i]} stroke={ink} strokeWidth={3} />)}
        </g>
        ) : null}
        {showBox && !stall ? <g transform={`translate(${bx} ${by}) rotate(${held ? 0 : Math.sin(u * Math.PI) * 20})`}>{cup(item === 'tea' ? 'tea' : 'cup')}</g> : null}
        {showBox && stall ? (
          <g transform={`translate(${bx} ${by}) rotate(${held ? 0 : u * 360})`}>
            <rect x={-30 * S} y={-26 * S} width={60 * S} height={52 * S} rx={6} fill={pc[0]} stroke={ink} strokeWidth={4} />
            <rect x={-6 * S} y={-26 * S} width={12 * S} height={52 * S} fill={pc[3]} />
            <path d={`M0 ${-26 * S} q-26 -26 -30 -4 M0 ${-26 * S} q26 -26 30 -4`} stroke={ink} strokeWidth={4} fill="none" />
          </g>
        ) : null}
        {held
          ? Array.from({length: 4}, (_, i) => {
              const lt = (lb - t1) * b;
              const hy = my - 180 * S - lt * 90 - i * 30;
              const hx = w.mascotX - 60 * S + i * 45 * S;
              return <path key={i} d={`M${hx} ${hy} c-14 -18 -34 0 0 22 c34 -22 14 -40 0 -22 Z`} fill={pc[0]} stroke={ink} strokeWidth={3} opacity={clamp01(1.4 - lt)} />;
            })
          : null}
      </g>,
    );
  }
  if (gag === 'scan') {
    // 手机扫小票：3.2 拍小票从右上飘到角色面前 → 4 拍手机升起、扫描线扫过 → 4.9 拍小票变成一行打勾的账目，6.3 拍收起
    const inP = clamp01((lb - 3.2) / 0.7);
    const out = clamp01((lb - 6.3) / 0.35);
    if (inP <= 0 || out >= 1) return null;
    const px = w.mascotX + 230 * S;
    const py = my - 150 * S;
    const e = 1 - (1 - inP) * (1 - inP);
    const rx = px + (1 - e) * 260 * S;
    const ry = py - (1 - e) * 260 * S + Math.sin(w.t * 6) * 6 * (1 - e);
    const phoneP = clamp01((lb - 3.9) / 0.25);
    const scan = lb >= 4 && lb < 4.9 ? (lb - 4) / 0.9 : -1;
    const done = lb >= 4.9;
    const pw = 190 * S;
    const ph = 330 * S;
    const green = '#2DAA5F';
    return svg(
      <g opacity={1 - out}>
        {/* 小票 */}
        {!done ? (
          <g transform={`translate(${rx} ${ry}) rotate(${(1 - e) * 24})`}>
            <path d={`M${-54 * S} ${-80 * S} L${54 * S} ${-80 * S} L${54 * S} ${70 * S} ${Array.from({length: 6}, (_, i) => `L${54 * S - (i + 0.5) * 18 * S} ${82 * S} L${54 * S - (i + 1) * 18 * S} ${70 * S}`).join(' ')} Z`} fill="#FFFDF6" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
            {[0, 1, 2, 3].map((i) => <rect key={i} x={-38 * S} y={(-58 + i * 30) * S} width={(i === 3 ? 44 : 76) * S} height={10 * S} rx={5} fill="#C9CCD8" />)}
          </g>
        ) : null}
        {/* 手机 */}
        {phoneP > 0 ? (
          <g transform={`translate(${px} ${py + (1 - phoneP) * 120 * S})`} opacity={phoneP}>
            <rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} rx={30 * S} fill="#2A2F45" stroke={ink} strokeWidth={4.5} />
            <rect x={-pw / 2 + 12 * S} y={-ph / 2 + 16 * S} width={pw - 24 * S} height={ph - 32 * S} rx={18 * S} fill={done ? '#F2FBF5' : 'rgba(255,255,255,0.25)'} stroke={ink} strokeWidth={3} />
            {scan >= 0 ? <rect x={-pw / 2 + 14 * S} y={-ph / 2 + 18 * S + scan * (ph - 40 * S)} width={pw - 28 * S} height={8 * S} rx={4} fill={pc[3]} /> : null}
            {done ? (
              <g>
                <rect x={-pw / 2 + 24 * S} y={-40 * S} width={pw - 48 * S} height={80 * S} rx={14 * S} fill="#FFFFFF" stroke={ink} strokeWidth={3} />
                <circle cx={-pw / 2 + 56 * S} cy={0} r={22 * S} fill={green} stroke={ink} strokeWidth={3} />
                <path d={`M${-pw / 2 + 44 * S} ${0} l${9 * S} ${9 * S} l${16 * S} ${-18 * S}`} fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                <rect x={-pw / 2 + 88 * S} y={-14 * S} width={60 * S} height={10 * S} rx={5} fill="#AEB5CC" />
                <rect x={-pw / 2 + 88 * S} y={6 * S} width={40 * S} height={10 * S} rx={5} fill="#D3D8E6" />
              </g>
            ) : null}
          </g>
        ) : null}
      </g>,
    );
  }
  if (gag === 'share') {
    // 爱心从房子那边一颗颗飘到角色身边（gagAt 起约 2.5 拍），住家街区的窗户由美术按 gagT 亮灯
    if (lb < d.def.gagAt || lb > 6.4) return null;
    const hx = ax;
    const hy = G - 330 * S;
    const tx0 = w.mascotX + 40 * S;
    const ty0 = my - 170 * S;
    return svg(
      <g>
        {Array.from({length: 6}, (_, i) => {
          const u = clamp01((lb - d.def.gagAt - i * 0.28) / 1.1);
          if (u <= 0 || u >= 1) return null;
          const x = hx + (tx0 - hx) * u + Math.sin(u * Math.PI * 2 + i) * 30;
          const y = hy + (ty0 - hy) * u - Math.sin(u * Math.PI) * 140 * S;
          const s = (0.8 + 0.4 * Math.sin(u * Math.PI)) * S;
          return <path key={i} d={`M${x} ${y + 14 * s} c${-30 * s} ${-20 * s} ${-26 * s} ${-46 * s} ${-6 * s} ${-44 * s} c${4 * s} 0 ${6 * s} ${6 * s} ${6 * s} ${6 * s} c0 0 ${2 * s} ${-6 * s} ${6 * s} ${-6 * s} c${20 * s} ${-2 * s} ${24 * s} ${24 * s} ${-6 * s} ${44 * s} Z`} fill={pc[i % 2 ? 3 : 0]} stroke={ink} strokeWidth={3} opacity={1 - u * 0.3} />;
        })}
      </g>,
    );
  }
  return null;
};

/** 小刺猬（面朝右，脚底中心为原点）+ 身后拖的小行李箱 */
const Hedgehog: React.FC<{s: number; ink: string; bag: string; t: number; wave?: boolean}> = ({s, ink, bag, t, wave}) => {
  const spikes = Array.from({length: 7}, (_, i) => {
    const a = Math.PI * (0.95 + (i / 6) * 0.95);
    const r0 = 30 * s;
    const r1 = 44 * s;
    const a0 = a - 0.14;
    const a1 = a + 0.14;
    return `L${(Math.cos(a0) * r0).toFixed(1)} ${(-24 * s + Math.sin(a0) * r0).toFixed(1)} L${(Math.cos(a) * r1).toFixed(1)} ${(-24 * s + Math.sin(a) * r1).toFixed(1)} L${(Math.cos(a1) * r0).toFixed(1)} ${(-24 * s + Math.sin(a1) * r0).toFixed(1)}`;
  }).join(' ');
  return (
    <g>
      {/* 行李箱在身后（左边），拉杆搭在手上 */}
      <line x1={-30 * s} y1={-30 * s} x2={-44 * s} y2={-58 * s} stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
      <rect x={-78 * s} y={-40 * s} width={40 * s} height={34 * s} rx={7 * s} fill={bag} stroke={ink} strokeWidth={3.5} />
      <line x1={-66 * s} y1={-40 * s} x2={-66 * s} y2={-6 * s} stroke={mixHex(bag, '#FFFFFF', 0.45)} strokeWidth={4} />
      <circle cx={-70 * s} cy={-2 * s} r={5 * s} fill={ink} />
      <circle cx={-46 * s} cy={-2 * s} r={5 * s} fill={ink} />
      {/* 刺 + 身体 */}
      <path d={`M${-34 * s} ${-6 * s} ${spikes} L${34 * s} ${-12 * s} Z`} fill="#8A5A3B" stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
      <path d={`M${-4 * s} ${-2 * s} Q${-6 * s} ${-44 * s} ${22 * s} ${-44 * s} Q${46 * s} ${-40 * s} ${50 * s} ${-18 * s} Q${40 * s} ${-2 * s} ${-4 * s} ${-2 * s} Z`} fill="#F4E3C8" stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
      <circle cx={52 * s} cy={-19 * s} r={6 * s} fill={ink} />
      <circle cx={28 * s} cy={-28 * s} r={4.5 * s} fill={ink} />
      <circle cx={20 * s} cy={-16 * s} r={6 * s} fill="#F2A48F" opacity={0.8} />
      {/* 小手：挥手或扶着拉杆 */}
      <path d={wave ? `M${10 * s} ${-26 * s} L${4 * s + Math.sin(t * 14) * 6 * s} ${-56 * s}` : `M${4 * s} ${-22 * s} L${-26 * s} ${-30 * s}`} stroke={ink} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={-2 * s} cy={0} rx={10 * s} ry={4 * s} fill={ink} />
      <ellipse cx={26 * s} cy={0} rx={10 * s} ry={4 * s} fill={ink} />
    </g>
  );
};

/** 锦鲤（头朝右，中心为原点） */
const Koi: React.FC<{s: number; ink: string; spot: string}> = ({s, ink, spot}) => (
  <g>
    <path d={`M${-50 * s} 0 L${-86 * s} ${-26 * s} Q${-76 * s} 0 ${-86 * s} ${26 * s} Z`} fill={spot} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
    <path d={`M${-54 * s} 0 Q${-30 * s} ${-34 * s} ${20 * s} ${-30 * s} Q${58 * s} ${-24 * s} ${62 * s} 0 Q${58 * s} ${24 * s} ${20 * s} ${28 * s} Q${-30 * s} ${32 * s} ${-54 * s} 0 Z`} fill="#FFFFFF" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
    <path d={`M${-24 * s} ${-26 * s} Q${-6 * s} ${-6 * s} ${14 * s} ${-28 * s} Z M${22 * s} ${8 * s} Q${34 * s} ${24 * s} ${46 * s} ${10 * s} Q${34 * s} ${2 * s} ${22 * s} ${8 * s} Z`} fill={spot} />
    <path d={`M${0} ${-30 * s} Q${12 * s} ${-50 * s} ${30 * s} ${-30 * s} Z`} fill={spot} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
    <circle cx={42 * s} cy={-8 * s} r={5 * s} fill={ink} />
  </g>
);

/**
 * 笑点里跟着角色走的部分（画在角色前面）。mx / my = 角色此刻的屏幕位置（含漂浮），S = 角色缩放。
 */
export const GagFx: React.FC<{w: World; d: District; mx: number; my: number}> = ({w, d, mx, my}) => {
  const gag = d.def.gag;
  const b = w.plan.beat;
  const lb = (w.t - d.start) / b;
  if (lb < 2 || lb > 8) return null;
  const S = (w.lay.mascotScale ?? 1) as number;
  const ink = w.pal.ink;
  const G = w.lay.groundY as number;
  const pc = d.props.map((c) => tint(c, d.phase));
  const g0 = d.def.gagAt;
  const svg = (children: React.ReactNode) => (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
      {children}
    </svg>
  );
  if (gag === 'sticker') {
    // 邮筒楼投信口吐出一张邮票贴纸（gagAt），翻着跟头飞 0.7 拍，贴到滑板前半截，一直贴到本站结束
    const u = clamp01((lb - g0) / 0.7);
    if (lb < g0 || lb > 7.6) return null;
    const sx0 = propX(w, d);
    const sy0 = G - 330 * w.plan.city.scale;
    const ex = mx + 62 * S;
    const ey = my - 4 * S;
    const stuck = u >= 1;
    const x = stuck ? ex : sx0 + (ex - sx0) * u;
    const y = stuck ? ey : sy0 + (ey - sy0) * u - Math.sin(u * Math.PI) * 190 * S;
    const pop = stuck ? 1 + 0.25 * Math.exp(-(lb - g0 - 0.7) * b * 10) : 0.8 + 0.2 * u;
    const out = clamp01((lb - 7.3) / 0.3);
    return svg(
      <g transform={`translate(${x} ${y}) rotate(${stuck ? -9 : u * 540 - 9}) scale(${pop * (1 - out)})`}>
        <StampSticker s={S} color={pc[0]} ink={ink} />
      </g>,
    );
  }
  if (gag === 'punch') {
    // 角色举着一张车票（3 拍起），检票钳在 gagAt 合上，车票上多一个孔、掉下三颗纸屑，随后打勾
    const inP = ease((lb - 3) / 0.35);
    const out = clamp01((lb - 6.4) / 0.35);
    if (inP <= 0 || out >= 1) return null;
    const tx = mx + 120 * S;
    const ty = my - 112 * S;
    const jx = propX(w, d);
    const jy = (w.lay.mascotY as number) - 116 * S;
    const shut = lb < g0 - 0.25 ? 0 : lb < g0 ? (lb - g0 + 0.25) / 0.25 : lb < g0 + 0.35 ? 1 : 1 - clamp01((lb - g0 - 0.35) / 0.3);
    const holed = lb >= g0;
    const dots = holed && lb < g0 + 1.4 ? (lb - g0) / 1.4 : -1;
    const tw = 112 * S;
    const th = 62 * S;
    return svg(
      <g>
        <g transform={`translate(${tx} ${ty + (1 - inP) * 40 * S}) rotate(-6) scale(${inP * (1 - out)})`}>
          <rect x={-tw / 2} y={-th / 2} width={tw} height={th} rx={8} fill="#FFFDF6" stroke={ink} strokeWidth={3.5} />
          <rect x={-tw / 2} y={-th / 2} width={26 * S} height={th} rx={6} fill={pc[1]} stroke={ink} strokeWidth={3} />
          <rect x={-tw / 2 + 36 * S} y={-14 * S} width={44 * S} height={9 * S} rx={4} fill="#C9CCD8" />
          <rect x={-tw / 2 + 36 * S} y={4 * S} width={28 * S} height={9 * S} rx={4} fill="#D3D8E6" />
          {holed ? <circle cx={tw / 2 - 18 * S} cy={0} r={9 * S} fill={ink} opacity={0.85} /> : null}
          {lb > g0 + 0.5 ? <path d={`M${tw / 2 - 44 * S} ${-2 * S} l${8 * S} ${9 * S} l${14 * S} ${-18 * S}`} fill="none" stroke={pc[0]} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" /> : null}
        </g>
        {dots >= 0
          ? [0, 1, 2].map((i) => (
              <circle key={i} cx={tx + tw / 2 - 18 * S + (i - 1) * 16 * S + dots * (i - 1) * 30 * S} cy={ty + dots * (140 + i * 40) * S} r={6 * S} fill={i === 1 ? pc[2] : '#FFFDF6'} stroke={ink} strokeWidth={2.5} opacity={1 - dots * 0.6} />
            ))
          : null}
        {/* 检票钳：下颚固定在柱顶，上颚绕后轴合上 */}
        <g transform={`translate(${jx} ${jy})`}>
          <rect x={10 * S} y={16 * S} width={96 * S} height={24 * S} rx={10} fill={pc[0]} stroke={ink} strokeWidth={4} />
          <g transform={`rotate(${-38 * (1 - shut)} ${96 * S} ${10 * S})`}>
            <rect x={10 * S} y={-18 * S} width={96 * S} height={26 * S} rx={10} fill={pc[0]} stroke={ink} strokeWidth={4} />
            <rect x={18 * S} y={4 * S} width={16 * S} height={14 * S} rx={3} fill={ink} />
          </g>
          <circle cx={96 * S} cy={10 * S} r={12 * S} fill={pc[2]} stroke={ink} strokeWidth={3.5} />
        </g>
      </g>,
    );
  }
  if (gag === 'strip') {
    // 大头贴机出片口吐出一条三连拍（gagAt 起升出 0.4 拍），再飞到角色手边挂着，6.6 拍往上飞走
    if (lb < g0) return null;
    const bx = propX(w, d);
    const topY = G - 300 * S - 56 * S;
    const rise = ease((lb - g0) / 0.4);
    const fly = ease((lb - g0 - 0.4) / 0.6);
    const out = ease((lb - 6.6) / 0.6);
    const hx = mx + 168 * S;
    const hy = my - 190 * S;
    const x0 = bx;
    const y0 = topY - rise * 110 * S;
    let x = x0 + (hx - x0) * fly;
    let y = y0 + (hy - y0) * fly - Math.sin(fly * Math.PI) * 120 * S;
    x += out * 200 * S;
    y -= out * 700 * S;
    const rot = fly * 8 + Math.sin(w.t * 3) * 3 * fly;
    const fw = 74 * S;
    const fh = 64 * S;
    const face = (cy: number, k: number) => (
      <g key={k}>
        <rect x={-fw / 2 + 8 * S} y={cy} width={fw - 16 * S} height={fh - 12 * S} rx={4} fill={[pc[2], pc[1], pc[0]][k] ?? pc[0]} />
        <path d={`M${-18 * S} ${cy + 26 * S} l${6 * S} ${-16 * S} l${8 * S} ${10 * S} Z M${18 * S} ${cy + 26 * S} l${-6 * S} ${-16 * S} l${-8 * S} ${10 * S} Z`} fill={MASCOT.furDeep} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={0} cy={cy + 30 * S} r={16 * S} fill={MASCOT.fur} stroke={ink} strokeWidth={2.5} />
        <ellipse cx={0} cy={cy + 36 * S} rx={10 * S} ry={7 * S} fill={MASCOT.cream} />
        {k === 1 ? (
          <path d={`M${-8 * S} ${cy + 28 * S} l${4 * S} ${-3 * S} M${8 * S} ${cy + 28 * S} l${-4 * S} ${-3 * S}`} stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        ) : (
          <g>
            <circle cx={-6 * S} cy={cy + 27 * S} r={2.6 * S} fill={ink} />
            <circle cx={6 * S} cy={cy + 27 * S} r={2.6 * S} fill={ink} />
          </g>
        )}
      </g>
    );
    return svg(
      <g transform={`translate(${x} ${y}) rotate(${rot})`}>
        <rect x={-fw / 2} y={-8 * S} width={fw} height={fh * 3 + 12 * S} rx={6} fill="#FFFFFF" stroke={ink} strokeWidth={3.5} />
        {[0, 1, 2].map((k) => face(k * fh, k))}
      </g>,
    );
  }
  if (gag === 'hitch') {
    // 小刺猬在站台上等车 → gagAt 前 0.3 拍跳上滑板前端 → 搭到 6.4 拍 → 挥手跳下，往右上离开
    const pole = propX(w, d) + 56 * S;
    const deckY = (w.lay.mascotY as number) + 26 * S;
    const wx = pole - 50 * S;
    const bx = mx + 70 * S;
    const by = my - 6 * S;
    const hop = clamp01((lb - g0 + 0.3) / 0.5);
    const off = clamp01((lb - 6.4) / 0.8);
    let x: number;
    let y: number;
    if (hop <= 0) {
      x = wx;
      y = deckY;
    } else if (off <= 0) {
      x = wx + (bx - wx) * ease(hop);
      y = deckY + (by - deckY) * ease(hop) - Math.sin(hop * Math.PI) * 90 * S;
    } else {
      x = bx + off * 520 * S;
      y = by - Math.sin(Math.min(1, off * 1.6) * Math.PI * 0.5) * 260 * S - off * off * 200 * S;
    }
    if (x > w.geo.w + 200) return null;
    return svg(
      <g transform={`translate(${x} ${y})`}>
        <Hedgehog s={S} ink={ink} bag={pc[1]} t={w.t} wave={hop <= 0 || off > 0} />
      </g>,
    );
  }
  if (gag === 'seal') {
    // 角色递出一张通关文牒（3.4 拍起），木印在 gagAt 落下盖印，文牒上留一枚方印，6.4 拍收起
    const inP = ease((lb - 3.4) / 0.35);
    const out = clamp01((lb - 6.4) / 0.35);
    if (inP <= 0 || out >= 1) return null;
    const px = mx + 126 * S;
    const py = my - 104 * S;
    const drop = lb < g0 - 0.3 ? 0 : lb < g0 ? (lb - g0 + 0.3) / 0.3 : lb < g0 + 0.25 ? 1 : 1 - ease((lb - g0 - 0.25) / 0.45);
    const sealTop = py - 60 * S - (1 - drop) * 420 * S;
    const marked = lb >= g0;
    const pw = 120 * S;
    const ph = 92 * S;
    const red = pc[0];
    return svg(
      <g>
        <g transform={`translate(${px} ${py + (1 - inP) * 40 * S}) rotate(4) scale(${inP * (1 - out)})`}>
          <rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} rx={4} fill="#FBF3DF" stroke={ink} strokeWidth={3.5} />
          <rect x={-pw / 2 - 8 * S} y={-ph / 2 - 6 * S} width={10 * S} height={ph + 12 * S} rx={4} fill={pc[2] ?? pc[1]} stroke={ink} strokeWidth={3} />
          <rect x={pw / 2 - 2 * S} y={-ph / 2 - 6 * S} width={10 * S} height={ph + 12 * S} rx={4} fill={pc[2] ?? pc[1]} stroke={ink} strokeWidth={3} />
          {[0, 1, 2].map((i) => <rect key={i} x={-pw / 2 + 14 * S + i * 22 * S} y={-ph / 2 + 12 * S} width={8 * S} height={ph - 24 * S} rx={4} fill="#D8CBB0" />)}
          {marked ? (
            <g transform={`translate(${24 * S} 0) rotate(-8) scale(${1 + 0.3 * Math.exp(-(lb - g0) * b * 12)})`}>
              <rect x={-24 * S} y={-24 * S} width={48 * S} height={48 * S} rx={4} fill="none" stroke={red} strokeWidth={5} />
              <rect x={-15 * S} y={-15 * S} width={30 * S} height={30 * S} fill={red} opacity={0.85} />
              <path d={`M${-15 * S} 0 L${15 * S} 0 M0 ${-15 * S} L0 ${15 * S}`} stroke="#FBF3DF" strokeWidth={4} />
            </g>
          ) : null}
        </g>
        {drop > 0 ? (
          <g transform={`translate(${px + 24 * S} ${sealTop})`}>
            <rect x={-14 * S} y={-110 * S} width={28 * S} height={70 * S} rx={10} fill="#9A6446" stroke={ink} strokeWidth={3.5} />
            <circle cx={0} cy={-116 * S} r={20 * S} fill="#9A6446" stroke={ink} strokeWidth={3.5} />
            <rect x={-30 * S} y={-44 * S} width={60 * S} height={44 * S} rx={6} fill="#7A4B32" stroke={ink} strokeWidth={4} />
            <rect x={-30 * S} y={-8 * S} width={60 * S} height={8 * S} fill={red} />
          </g>
        ) : null}
      </g>,
    );
  }
  if (gag === 'leap') {
    // 锦鲤从角色右前方的河里跃起（3.3 拍），在 gagAt 从角色面前掠过（弧顶在胸口高度，不钻到明信片后面），4.7 拍落回左后方的水里；起落各一圈水花
    const a = 3.3;
    const z = 4.7;
    const u = (lb - a) / (z - a);
    const splash = (x: number, k: number, key: string) =>
      k > 0 && k < 1 ? (
        <g key={key}>
          {Array.from({length: 7}, (_, i) => {
            const ang = Math.PI * (0.15 + (i / 6) * 0.7);
            const r = (30 + 90 * k) * S;
            return <circle key={i} cx={x - Math.cos(ang) * r} cy={G - Math.sin(ang) * r * 1.2 + k * k * 60 * S} r={(9 - 5 * k) * S} fill={tint('#BFE7EC', d.phase)} stroke={ink} strokeWidth={2.5} />;
          })}
        </g>
      ) : null;
    const x0 = mx + 320 * S;
    const x1 = mx - 300 * S;
    const apex = my - 150 * S;
    const parts: React.ReactNode[] = [splash(x0, (lb - a + 0.1) / 0.7, 's0'), splash(x1, (lb - z) / 0.7, 's1')];
    if (u > 0 && u < 1) {
      const x = x0 + (x1 - x0) * u;
      const y = G - (G - apex) * 4 * u * (1 - u);
      const slope = -(G - apex) * 4 * (1 - 2 * u);
      const ang = (Math.atan2(slope, x0 - x1) * 180) / Math.PI;
      parts.push(
        <g key="koi" transform={`translate(${x} ${y}) scale(-1 1) rotate(${ang})`}>
          <Koi s={S * 1.1} ink={ink} spot={pc[2] ?? pc[0]} />
        </g>,
      );
    }
    return svg(<g>{parts}</g>);
  }
  return null;
};

/**
 * 开场角色停着的起点台（前景层，第 0 秒在角色正下方）。现代城市 / 街巷：一根车站立柱托着圆站台（中性，不带题材道具）；
 * 古城：一座木栈台（木柱 + 铺板），旁边一根挂空白木牌的杆子——车站意象，不用堆叠物。
 */
export const StartPad: React.FC<{w: World; seatY: number}> = ({w, seatY}) => {
  const x = w.plan.camAt(w.plan.opening?.start ?? 0) + w.mascotX - w.plan.camAt(w.t);
  if (x < -400 || x > w.geo.w + 400) return null;
  const G = w.lay.groundY as number;
  const S = (w.lay.mascotScale ?? 1) as number;
  const ink = w.pal.ink;
  const old = w.plan.skyline === 'oldtown';
  const bw = 250 * S;
  const top = seatY;
  const h = G - top;
  if (old) {
    const wood = '#9A6446';
    const woodD = '#7A4B32';
    const dw = bw * 1.1;
    return (
      <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
        {[-0.38, 0, 0.38].map((f, i) => (
          <rect key={i} x={x + f * dw - 14 * S} y={top + 30 * S} width={28 * S} height={h - 30 * S} fill={i === 1 ? woodD : wood} stroke={ink} strokeWidth={4} />
        ))}
        <path d={`M${x - dw * 0.38} ${top + 60 * S} L${x + dw * 0.38} ${G - 40 * S} M${x + dw * 0.38} ${top + 60 * S} L${x - dw * 0.38} ${G - 40 * S}`} stroke={woodD} strokeWidth={10 * S} strokeLinecap="round" opacity={0.8} />
        <rect x={x - dw / 2} y={top + 6 * S} width={dw} height={30 * S} rx={6} fill={wood} stroke={ink} strokeWidth={4} />
        {Array.from({length: 5}, (_, i) => (
          <line key={i} x1={x - dw / 2 + ((i + 1) * dw) / 6} y1={top + 8 * S} x2={x - dw / 2 + ((i + 1) * dw) / 6} y2={top + 34 * S} stroke={ink} strokeWidth={2.5} opacity={0.5} />
        ))}
        {/* 挂木牌的杆子（牌上不写字） */}
        <rect x={x + dw / 2 - 6 * S} y={top - 170 * S} width={12 * S} height={176 * S} fill={woodD} stroke={ink} strokeWidth={3.5} />
        <rect x={x + dw / 2 - 6 * S} y={top - 170 * S} width={80 * S} height={10 * S} fill={woodD} stroke={ink} strokeWidth={3} />
        <line x1={x + dw / 2 + 40 * S} y1={top - 160 * S} x2={x + dw / 2 + 40 * S} y2={top - 140 * S} stroke={ink} strokeWidth={3} />
        <rect x={x + dw / 2 + 14 * S} y={top - 140 * S} width={52 * S} height={84 * S} rx={6} fill="#F1E3C4" stroke={ink} strokeWidth={3.5} />
        <line x1={x + dw / 2 + 40 * S} y1={top - 124 * S} x2={x + dw / 2 + 40 * S} y2={top - 70 * S} stroke={woodD} strokeWidth={5} strokeLinecap="round" />
      </svg>
    );
  }
  const brand = w.pal.brand;
  const col = mixHex(brand, '#FFFFFF', 0.15);
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
      <rect x={x - 40 * S} y={top + 40 * S} width={80 * S} height={h - 40 * S} fill={mixHex(ink, '#FFFFFF', 0.72)} stroke={ink} strokeWidth={4} />
      {Array.from({length: Math.max(2, Math.floor((h - 60 * S) / (70 * S)))}, (_, i) => (
        <path key={i} d={`M${x - 40 * S} ${top + (70 + i * 70) * S} l${80 * S} ${-28 * S} l0 ${16 * S} l${-80 * S} ${28 * S} Z`} fill={col} opacity={0.9} />
      ))}
      <rect x={x - bw * 0.35} y={G - 40 * S} width={bw * 0.7} height={40 * S} rx={10} fill={mixHex(ink, '#FFFFFF', 0.6)} stroke={ink} strokeWidth={4} />
      <ellipse cx={x} cy={top + 36 * S} rx={bw / 2} ry={34 * S} fill={mixHex(col, ink, 0.2)} stroke={ink} strokeWidth={4} />
      <ellipse cx={x} cy={top + 20 * S} rx={bw / 2} ry={34 * S} fill={col} stroke={ink} strokeWidth={4} />
      <ellipse cx={x} cy={top + 20 * S} rx={bw / 2 - 30 * S} ry={20 * S} fill="none" stroke="#FFFFFF" strokeWidth={5} strokeDasharray={`${18 * S} ${14 * S}`} opacity={0.9} />
    </svg>
  );
};
