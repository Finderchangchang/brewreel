import React from 'react';
import {Gear, World, mixHex, tint} from './city';
import type {District} from './plan';
import {clamp01, edgeFade, textW} from './ui';
import {starPath} from './rider';

// ============================================================
// 街区道具 + 笑点时间线（前景层，世界锁定）。道具的世界坐标反推：第 gagAt 拍时正好在角色面前（角色 x + dx）。
// 每种街区一个笑点：stack 跳过书塔 / launch 倒数发射被熏黑 / factory 机械臂掸灰 / studio 相机闪光摆拍 /
// observatory 机器鸟结伴 / neon 霓虹牌故障 / market 接住摊主抛来的礼盒 / cafe、teahouse 接住递来的咖啡、茶 /
// phone 手机扫一下小票、变成一行打勾的账目 / home 爱心从房子飘向角色 / gate 城门前相机闪光打卡 / bridge 燕子结伴过桥 /
// lantern 灯笼从左到右依次亮起（灯笼在美术城市里，按 gagT 亮）。
// 角色身上的反应（表情、跳起、压扁）在 plan.exprAt 和 film.tsx 的 mascotOffset 里；这里只画道具和特效。
// ============================================================
const DX: Record<string, number> = {obstacle: 40, launch: 170, help: 120, pose: 60, buddy: 0, glitch: 330, catch: 110, scan: 170, share: 260, glow: 200};
/** 发布街区的火箭用美术城市里的那枚 */
const ART_LAUNCH = true;
const GLITCH_PROP = false;

/** 道具锚点在屏幕上的 x */
export const propX = (w: World, d: District) => {
  const gagT = d.start + d.def.gagAt * w.plan.beat;
  return w.plan.camAt(gagT) + w.mascotX + (DX[d.def.gag] ?? 100) * (w.lay.mascotScale ?? 1) - w.plan.camAt(w.t);
};

/** 角色的屏幕 y（载具中心），给道具瞄准用 */
export const mascotBaseY = (w: World) => w.lay.mascotY as number;

export const Props: React.FC<{w: World; d: District; textOn: number}> = ({w, d, textOn}) => {
  const ax = propX(w, d);
  if (ax < -700 || ax > w.geo.w + 700) return null;
  const b = w.plan.beat;
  const lb = (w.t - d.start) / b;
  const ink = w.pal.ink;
  const G = w.lay.groundY as number;
  const S = (w.lay.mascotScale ?? 1) as number;
  const my = mascotBaseY(w);
  const pc = d.def.props.map((c) => tint(c, d.phase));
  const gag = d.def.gag;
  const svg = (children: React.ReactNode) => (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
      {children}
    </svg>
  );
  if (gag === 'obstacle') {
    // 一座书塔：从地面一直堆到角色脚下，角色得跳过去
    const top = my + 64 * S;
    const n = Math.max(3, Math.ceil((G - top) / 64));
    const h = (G - top) / n;
    return svg(
      <g>
        {Array.from({length: n}, (_, i) => {
          const bw = (190 + ((i * 37) % 50)) * S;
          const off = ((i * 53) % 30) - 15;
          return <rect key={i} x={ax - bw / 2 + off} y={G - (i + 1) * h} width={bw} height={h - 4} rx={8} fill={pc[i % pc.length]} stroke={ink} strokeWidth={4} />;
        })}
        {/* 塔顶一页纸在飘 */}
        <path d={`M${ax - 40} ${top - 6} l70 -8 l6 -34 l-64 8 Z`} fill="#fff" stroke={ink} strokeWidth={3.5} strokeLinejoin="round" transform={`rotate(${Math.sin(w.t * 6) * 6} ${ax} ${top})`} />
      </g>,
    );
  }
  if (gag === 'launch') {
    const tL = d.def.gagAt;
    const up = Math.max(0, lb - tL) * b;
    const rocketDy = -up * up * 2400;
    const count = lb < 3 ? '3' : lb < 3.5 ? '3' : lb < 4 ? '2' : lb < tL ? '1' : '0';
    const flame = lb > tL - 0.3;
    const smoke = lb > tL ? clamp01((lb - tL) / 2.5) : 0;
    const rocket = (x: number, base: number, s: number, dy: number, c: string, fl: boolean, key: string) => (
      <g key={key} transform={`translate(${x} ${base + dy}) scale(${s * S})`}>
        {fl ? <path d={`M-18 0 Q0 ${70 + Math.sin(w.t * 50) * 12} 18 0 Z`} fill="#FFB547" stroke={ink} strokeWidth={3.5} /> : null}
        <path d="M-26 0 L-44 26 L-26 18 Z M26 0 L44 26 L26 18 Z" fill={c} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
        <path d="M-26 0 L-26 -120 Q0 -190 26 -120 L26 0 Z" fill="#FFFFFF" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d="M-24 -126 Q0 -186 24 -126 Z" fill={c} stroke={ink} strokeWidth={3} />
        <circle cx={0} cy={-80} r={12} fill={pc[1]} stroke={ink} strokeWidth={3.5} />
      </g>
    );
    return (
      <>
        {svg(
          <g>
            {/* 发射台、塔架和大火箭由美术城市的发布街区画（plan 把它对准了这里）；ART_LAUNCH=false 时用下面的简版 */}
            {ART_LAUNCH ? null : (
              <g>
                <rect x={ax - 170 * S} y={G - 34} width={340 * S} height={34} fill={pc[2]} stroke={ink} strokeWidth={4} />
                {rocket(ax - 150 * S, G - 34, 0.62, 0, pc[1], false, 'a')}
                {rocket(ax + 140 * S, G - 34, 0.7, 0, pc[1], false, 'b')}
                {rocket(ax, G - 34, 1.05, rocketDy, pc[0], flame, 'c')}
              </g>
            )}
            {/* 浓烟 */}
            {smoke > 0
              ? Array.from({length: 14}, (_, i) => {
                  // 烟团：从发射台向两边翻滚、往上飘，大小不一
                  const side = i % 2 ? 1 : -1;
                  const spread = (40 + (i * 37) % 160) * S * (0.4 + smoke);
                  const rise = ((i * 53) % 120) * smoke + smoke * 60;
                  const r = (34 + ((i * 29) % 40) + 50 * smoke) * S;
                  return <circle key={i} cx={ax + side * spread} cy={G - 30 - rise} r={r} fill="#EFEBE5" stroke={mixHex(ink, '#FFFFFF', 0.55)} strokeWidth={3} opacity={Math.min(1, 1.6 - smoke * 1.2)} />;
                })
              : null}
          </g>,
        )}
        {/* 倒数牌 */}
        <CountBoard w={w} x={ax + 300 * S} y={G - 330 * S} text={lb < tL + 1 ? count : ''} textOn={textOn} color={pc[3]} />
      </>
    );
  }
  if (gag === 'help') {
    // 机械臂 + 鸡毛掸子：3.4–4.9 拍来回掸两次
    const baseX = ax + 40 * S;
    const baseY = G - 30;
    const tipX = w.mascotX + 90 * S;
    const tipY = my - 90 * S;
    const swing = lb > 3.4 && lb < 4.9 ? Math.sin(((lb - 3.4) / 1.5) * Math.PI * 4) : 0;
    const reach = clamp01((lb - 3.1) / 0.4) * (1 - clamp01((lb - 5.2) / 0.5));
    const tx = baseX + (tipX - baseX) * reach + swing * 26;
    const ty = baseY + (tipY - baseY) * reach + (reach < 0.05 ? -180 * S : 0) + swing * 10;
    const ex = (baseX + tx) / 2 + 70 * S;
    const ey = (baseY + ty) / 2 - 20;
    const dust = lb > 3.5 && lb < 5 ? clamp01((lb - 3.5) / 0.4) * (1 - clamp01((lb - 4.6) / 0.4)) : 0;
    return svg(
      <g>
        <Gear cx={ax + 190 * S} cy={G - 70 * S} r={62 * S} rot={w.t * 70} fill={pc[1]} ink={ink} />
        <rect x={baseX - 50 * S} y={baseY - 10} width={100 * S} height={40} rx={10} fill={pc[2]} stroke={ink} strokeWidth={4} />
        <path d={`M${baseX} ${baseY} L${ex} ${ey} L${tx} ${ty}`} stroke={ink} strokeWidth={30 * S} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M${baseX} ${baseY} L${ex} ${ey} L${tx} ${ty}`} stroke={pc[1]} strokeWidth={22 * S} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={ex} cy={ey} r={16 * S} fill={pc[0]} stroke={ink} strokeWidth={4} />
        {/* 鸡毛掸子 */}
        <g transform={`translate(${tx} ${ty}) rotate(${-30 + swing * 25})`}>
          {[-30, -12, 6, 24].map((a, i) => (
            <ellipse key={a} cx={0} cy={-46 * S} rx={12 * S} ry={40 * S} transform={`rotate(${a})`} fill={['#FF7B6B', '#FFC845', '#0FB5C9', '#E845A8'][i]} stroke={ink} strokeWidth={3} />
          ))}
        </g>
        {dust > 0
          ? Array.from({length: 8}, (_, i) => (
              <circle key={i} cx={w.mascotX + Math.cos(i * 0.8) * (80 + i * 6) * S} cy={my - 90 * S + Math.sin(i * 1.3) * 70 * S - dust * 30} r={(12 + (i % 3) * 8) * S} fill="#CFC8BE" opacity={0.85 * dust} />
            ))
          : null}
      </g>,
    );
  }
  if (gag === 'pose') {
    const flashes = [d.def.gagAt, d.def.gagAt + 1];
    const cam = (x: number, k: number) => {
      const fl = flashes[k] !== undefined ? clamp01(1 - Math.abs(lb - flashes[k]) * 5) : 0;
      return (
        <g key={k} transform={`translate(${x} ${G})`}>
          {[-40, 0, 40].map((o) => <line key={o} x1={0} y1={-150 * S} x2={o * S} y2={0} stroke={ink} strokeWidth={6} strokeLinecap="round" />)}
          <g transform={`translate(0 ${-170 * S}) rotate(-24)`}>
            <rect x={-56 * S} y={-38 * S} width={112 * S} height={76 * S} rx={12} fill={pc[3]} stroke={ink} strokeWidth={4} />
            <rect x={-30 * S} y={-56 * S} width={36 * S} height={20 * S} rx={4} fill={pc[3]} stroke={ink} strokeWidth={3} />
            <circle cx={-64 * S} cy={0} r={26 * S} fill={pc[0]} stroke={ink} strokeWidth={4} />
            <circle cx={-64 * S} cy={0} r={11 * S} fill="#fff" />
            {fl > 0 ? <path d={starPath(-10 * S, -64 * S, 60 * fl + 10, (60 * fl + 10) * 0.35)} fill="#FFFBE0" stroke={ink} strokeWidth={2.5} /> : null}
          </g>
        </g>
      );
    };
    return svg(<g>{[cam(ax + 40 * S, 0), cam(ax + 250 * S, 1)]}</g>);
  }
  // 霓虹街的故障笑点画在广告牌上（ui.tsx 的 Billboard 霓虹模式），这里不再单独立一块霓虹牌
  if (gag === 'glitch' && GLITCH_PROP) {
    const glitch = lb >= d.def.gagAt && lb < d.def.gagAt + 1.6;
    const jx = glitch ? Math.round(Math.sin(w.t * 90) * 10) : 0;
    const flicker = glitch && Math.floor(w.t * 20) % 3 === 0 ? 0.45 : 1;
    const bw = Math.max(240, textW(d.category, 46) + 80);
    const by = (w.lay.fgTop[0] as number) - 150 * S;
    const x0 = ax - bw / 2;
    const op = edgeFade(w, ax - textW(d.category, 46) / 2 - 20, ax + textW(d.category, 46) / 2 + 20) * textOn;
    return (
      <>
        {svg(
          <g>
            <rect x={ax - 8} y={by + 120} width={16} height={G - by - 120} fill={tint('#4B3565', d.phase)} stroke={ink} strokeWidth={3} />
            {glitch
              ? Array.from({length: 5}, (_, i) => <path key={i} d={`M${ax + bw / 2 - 10} ${by + 20 + i * 18} l${18 + (i % 2) * 10} ${-8 + (i % 3) * 8} l-6 10 l16 -4`} stroke={w.pal.neonC} strokeWidth={4} fill="none" opacity={Math.sin(w.t * 40 + i) > 0 ? 1 : 0} />)
              : null}
          </g>,
        )}
        <div style={{position: 'absolute', left: x0 + jx, top: by, width: bw, height: 120, borderRadius: 18, background: '#1B1530', border: `5px solid ${w.pal.neonA}`, boxShadow: `0 0 24px ${w.pal.neonA}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', opacity: flicker}}>
          <span style={{fontSize: 46, fontWeight: 700, color: w.pal.neonB, whiteSpace: 'nowrap', opacity: op, textShadow: glitch ? `-6px 0 ${w.pal.neonA}, 6px 0 ${w.pal.neonB}` : `0 0 14px ${w.pal.neonB}`, lineHeight: 1.2}}>{d.category}</span>
        </div>
      </>
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
              return <path key={i} d={`M${hx} ${hy} c-14 -18 -34 0 0 22 c34 -22 14 -40 0 -22 Z`} fill="#F65198" stroke={ink} strokeWidth={3} opacity={clamp01(1.4 - lt)} />;
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

const CountBoard: React.FC<{w: World; x: number; y: number; text: string; textOn: number; color: string}> = ({w, x, y, text, textOn, color}) => {
  const ink = w.pal.ink;
  const G = w.lay.groundY as number;
  const op = edgeFade(w, x - 30, x + 30) * textOn;
  return (
    <div style={{position: 'absolute', left: x - 55, top: y, width: 110, height: G - y}}>
      <div style={{position: 'absolute', left: 47, top: 100, width: 16, bottom: 0, background: mixHex(color, '#FFFFFF', 0.4), border: `3px solid ${ink}`, boxSizing: 'border-box'}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: 110, height: 104, borderRadius: 16, background: color, border: `4px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'}}>
        <span style={{fontSize: 64, fontWeight: 800, color: '#FF7A59', opacity: text ? op : 0, lineHeight: 1.1}}>{text || '0'}</span>
      </div>
    </div>
  );
};

/** 伙伴：天文台是机器鸟，石桥是燕子。屏幕锁定，从右边飞来并排，最后向右上飞走 */
export const BuddyBird: React.FC<{w: World; d: District}> = ({w, d}) => {
  if (d.def.gag !== 'buddy') return null;
  const lb = (w.t - d.start) / w.plan.beat;
  const a = d.def.gagAt - 0.4;
  if (lb < a - 0.1 || lb > 7) return null;
  const S = (w.lay.mascotScale ?? 1) as number;
  const my = w.lay.mascotY as number;
  const hx = w.mascotX + 230 * S;
  const hy = my - 100 * S;
  const inP = clamp01((lb - a) / 0.8);
  const outP = clamp01((lb - 5.8) / 1.0);
  const e = 1 - (1 - inP) * (1 - inP);
  const x = w.geo.w + 120 + (hx - w.geo.w - 120) * e + outP * outP * (w.geo.w - hx + 200);
  const y = hy + Math.sin(w.t * 5) * 14 - outP * outP * 380 * S;
  const flap = Math.sin(w.t * 28);
  const ink = w.pal.ink;
  const c = d.def.props;
  const robot = d.scene === 'observatory';
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
      {robot ? (
        <g transform={`translate(${x} ${y}) scale(${S})`}>
          <path d="M34 -4 L64 -14 L60 4 Z" fill="#F6D046" stroke={ink} strokeWidth={3.5} strokeLinejoin="round" transform="scale(-1 1) translate(-2 0)" />
          <path d="M44 -8 L74 -24 L70 -2 Z" fill={c[0]} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
          <ellipse cx={0} cy={0} rx={50} ry={34} fill={c[1]} stroke={ink} strokeWidth={4} />
          <path d="M-50 -2 L-72 -8 L-52 8 Z" fill={c[2]} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
          <circle cx={-26} cy={-8} r={7} fill={ink} />
          <path d={`M-6 -10 Q20 ${-60 * flap - 10} 40 -12 Z`} fill={mixHex(c[1], '#FFFFFF', 0.35)} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
          <line x1={4} y1={-34} x2={10} y2={-56} stroke={ink} strokeWidth={3.5} />
          <circle cx={11} cy={-60} r={7} fill={c[2]} stroke={ink} strokeWidth={3} />
        </g>
      ) : (
        // 燕子：深蓝背、白肚、红喉、剪刀尾（朝左飞，和角色同向看）
        <g transform={`translate(${x} ${y}) scale(${S})`}>
          <path d="M30 -2 L92 -30 L66 -2 L96 16 L34 10 Z" fill={c[0]} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
          <path d="M-52 0 Q-40 -30 0 -26 Q40 -22 44 0 Q30 22 -10 22 Q-44 20 -52 0 Z" fill={c[0]} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-40 6 Q-10 22 30 8 Q10 20 -14 20 Q-34 18 -40 6 Z" fill={c[1]} />
          <circle cx={-44} cy={4} r={9} fill={c[2]} />
          <path d="M-52 -2 L-70 2 L-52 8 Z" fill="#3A3030" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
          <circle cx={-36} cy={-8} r={5} fill="#FFFFFF" />
          <circle cx={-37} cy={-8} r={3} fill={ink} />
          <path d={`M-10 -18 Q10 ${-80 * flap - 10} 50 ${-30 - 20 * flap} Q20 -14 -10 -18 Z`} fill={mixHex(c[0], '#FFFFFF', 0.15)} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
};

/** 开场角色站着的起点台（前景层，第 0 秒在角色正下方）：中性的圆台 + 条纹，不带任何题材道具；古城是一座石墩 */
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
    const rows = Math.max(3, Math.round(h / 70));
    const rh = h / rows;
    return (
      <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={w.geo.w} height={w.geo.h}>
        {Array.from({length: rows}, (_, i) => {
          const y = G - (i + 1) * rh;
          const ww = bw + (rows - i) * 8 * S;
          return (
            <g key={i}>
              <rect x={x - ww / 2} y={y} width={ww} height={rh - 3} rx={6} fill={i % 2 ? '#CFC9BE' : '#C2BBAE'} stroke={ink} strokeWidth={4} />
              <line x1={x - ww / 2 + ((i * 53) % 90) + 40} y1={y} x2={x - ww / 2 + ((i * 53) % 90) + 40} y2={y + rh - 3} stroke={ink} strokeWidth={3} opacity={0.5} />
            </g>
          );
        })}
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