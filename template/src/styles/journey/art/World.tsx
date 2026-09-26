import React from 'react';
import {DistrictKind, PAPER_SHADOW, Skyline, nightOf, skyForDistrict, useArtColors} from './palette';
import {FarSkyline, Sky, Street} from './city';
import {DISTRICT_NEAR, DISTRICT_W, DistrictMid, FillerNear} from './districts';
import {OldFar, OldFiller, OldMid, OldStreet} from './oldtown';

// ============================================================
// journey / art 横版世界：一次画出 天空 → 远景天际线 → 中景塔楼 → 近景街区 + 街面，按相机位置做多层视差。
// 世界坐标 = 近景层像素（1.0 倍）。camX = 画面左边缘对应的世界 x。中景、远景按 parallax 倍率跟着走，
// 以画面中线为支点：屏幕 x = w/2 + (世界 x - camX - w/2) × 倍率。
// 招牌、角色这些带字/前景件由 Film 画在这层上面，位置用 toScreen() 换算。
// 剪纸分层：远景、中景、近景三组各套一个 paper 滤镜，在身后投一道往右下错开的硬边纸影（越近错得越多、越深）。
// ============================================================

/** words = 这一站自己的字（夜景街屋顶对话框用），来自分镜 */
export type DistrictSlot = {kind: DistrictKind; x0: number; gagT?: number; words?: string[]};
export type CityLayout = {districts: DistrictSlot[]; start: number; end: number; districtW: number};

/** 排街区：第一个街区从 introW 开始，每个宽 districtW；片尾留 outroW 的填充段 */
export const layoutCity = (kinds: DistrictKind[], opts: {introW?: number; districtW?: number; outroW?: number} = {}): CityLayout => {
  const dw = opts.districtW ?? DISTRICT_W;
  const intro = opts.introW ?? 900;
  const outro = opts.outroW ?? 1600;
  return {districts: kinds.map((kind, i) => ({kind, x0: intro + i * dw})), start: 0, end: intro + kinds.length * dw + outro, districtW: dw};
};

/** 建筑缩放建议值：让普通房子的屋顶落在角色脚下（4:5 地平线 1040 → 0.78；9:16 地平线 1560 → 1.1），塔吊、邮筒楼、铅笔塔这类地标照样冒出来 */
export const sceneScale = (h: number) => (h > 1500 ? 1.1 : 0.78);

/** 世界 x → 屏幕 x（k = 该层视差倍率，近景 1） */
export const toScreen = (worldX: number, camX: number, w: number, k = 1) => w / 2 + (worldX - camX - w / 2) * k;

/** 当前相机在第几个街区（带小数），给天色、HUD 用 */
export const districtAt = (layout: CityLayout, camX: number, anchor = 0) => {
  const x = camX + anchor;
  const first = layout.districts[0]?.x0 ?? 0;
  return (x - first) / layout.districtW;
};

export type CityWorldProps = {
  w: number;
  h: number;
  /** 地面线（街面顶边）的屏幕 y */
  horizonY: number;
  camX: number;
  t: number;
  layout: CityLayout;
  /** 天色进度 0..1；不传就按街区自动：前面白天，倒数第二个街区黄昏，最后一个夜晚 */
  sky?: number;
  /** 建筑缩放，建议用 sceneScale(画面高) */
  scale?: number;
  parallax?: {far?: number; mid?: number};
  /** 覆盖某个街区的 gagT（按序号） */
  gags?: Record<number, number | undefined>;
  /** 只画一部分：back = 天空 + 远景 + 中景（招牌可以插在它和近景之间），front = 街面 + 近景；默认 all */
  layer?: 'all' | 'back' | 'front';
  /** 背景天际线：modern 现代城市（默认）/ street 低层街巷 / oldtown 古城（远山宝塔、白墙黛瓦、石板路和河） */
  skyline?: Skyline;
};

export const CityWorld: React.FC<CityWorldProps> = ({w, h, horizonY, camX, t, layout, sky, scale = 1, parallax, gags, layer = 'all', skyline = 'modern'}) => {
  const old = skyline === 'oldtown';
  const art = useArtColors();
  const kFar = parallax?.far ?? 0.12;
  const kMid = parallax?.mid ?? 0.55;
  const dw = layout.districtW;
  const n = layout.districts.length;
  const anchor = w * 0.35;
  const p = sky ?? skyForDistrict(Math.max(0, districtAt(layout, camX, anchor)), n);
  const depth = h - horizonY;

  // 近景：按 dw 分段，落在街区上的画街区，其他画填充段
  const near: React.ReactNode[] = [];
  const first = layout.districts[0]?.x0 ?? 0;
  const segFrom = Math.floor((camX - 400 - first) / dw);
  const segTo = Math.floor((camX + w / scale + 400 - first) / dw);
  for (let s = segFrom; s <= segTo; s++) {
    const x0 = first + s * dw;
    const sx = (x0 - camX) * scale;
    const d = layout.districts[s];
    if (d) {
      const Comp = DISTRICT_NEAR[d.kind];
      near.push(
        <g key={`n${s}`} transform={`translate(${sx},${horizonY}) scale(${scale})`}>
          <Comp p={p} t={t} gagT={gags?.[s] ?? d.gagT} c={art.district(d.kind)} words={d.words} />
        </g>,
      );
    } else {
      near.push(
        <g key={`n${s}`} transform={`translate(${sx},${horizonY}) scale(${scale})`}>
          {old ? <OldFiller p={p} t={t} seed={s + 100} /> : <FillerNear p={p} t={t} seed={s + 100} />}
        </g>,
      );
    }
  }

  // 中景：每个街区对应一段宽 dw × kMid 的中景，屏幕位置按视差换算
  const mid: React.ReactNode[] = [];
  const mw = dw * kMid;
  const midFrom = Math.floor(((camX + w / 2 - w / 2 / kMid) - first) / dw) - 1;
  const midTo = Math.floor(((camX + w / 2 + w / 2 / kMid) - first) / dw) + 1;
  for (let s = midFrom; s <= midTo; s++) {
    const x0 = first + s * dw;
    const sx = toScreen(x0, camX, w, kMid);
    const d = layout.districts[s];
    mid.push(
      <g key={`m${s}`} transform={`translate(${sx},${horizonY}) scale(${scale})`}>
        {old ? (
          <OldMid w={mw / scale} p={p} seed={s + 50} tower={!!d && (d.kind === 'gate' || s % 3 === 1)} />
        ) : (
          <DistrictMid kind={d ? d.kind : 'filler'} w={mw / scale} p={p} t={t} seed={s + 50} c={d ? art.district(d.kind) : undefined} low={skyline === 'street'} />
        )}
      </g>,
    );
  }

  // 剪纸分层：远 / 中 / 近三层各在身后投一道往右下错开的硬边纸影，越近错得越多、越深
  const night = nightOf(p);
  // 同一页里可能有好几张世界（总览图）：id 带上尺寸、缩放和夜色档，参数相同才共用一个滤镜
  const fid = `jpaper-${w}-${h}-${Math.round(scale * 100)}-${Math.round(night * 20)}`;
  const paper = (name: string, dx: number, dy: number, a: number) => (
    <filter id={`${fid}-${name}`} filterUnits="userSpaceOnUse" x={-60} y={-60} width={w + 120} height={h + 120} colorInterpolationFilters="sRGB">
      <feFlood floodColor={PAPER_SHADOW} floodOpacity={a} result="c" />
      <feComposite in="c" in2="SourceAlpha" operator="in" result="s" />
      <feOffset in="s" dx={dx * scale} dy={dy * scale} result="o" />
      <feMerge>
        <feMergeNode in="o" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
  const shadeA = 1 - night * 0.45;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', left: 0, top: 0}} data-probe-skip>
      <defs>
        {paper('far', 6, 5, 0.16 * shadeA)}
        {paper('mid', 10, 8, 0.26 * shadeA)}
        {paper('near', 14, 10, 0.36 * shadeA)}
      </defs>
      {layer !== 'front' && <Sky w={w} h={h} horizonY={horizonY} p={p} t={t} drift={camX * kFar * 1.5} />}
      {layer !== 'front' && <g filter={`url(#${fid}-far)`}>{old ? <OldFar w={w} horizonY={horizonY} p={p} offset={camX * kFar} scale={scale} /> : <FarSkyline w={w} horizonY={horizonY} p={p} offset={camX * kFar} scale={skyline === 'street' ? scale * 0.55 : scale} />}</g>}
      {layer !== 'front' && <g filter={`url(#${fid}-mid)`}>{mid}</g>}
      {layer !== 'back' && (
        <g transform={`translate(0,${horizonY})`}>
          {old ? <OldStreet x0={0} x1={w} depth={depth} p={p} offset={camX * scale} t={t} /> : <Street x0={0} x1={w} depth={depth} p={p} offset={camX * scale} />}
        </g>
      )}
      {layer !== 'back' && <g filter={`url(#${fid}-near)`}>{near}</g>}
    </svg>
  );
};
