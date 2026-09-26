import React from 'react';
import {AbsoluteFill, Freeze} from 'remotion';
import type {Storyboard} from './schema';
import {FONT} from './core/font';
import {FPS, geometryOf} from './core/safe';
import {schedule} from './core/timeline';
import {Promo, framesOf, lookupFor} from './Promo';
import {aspectOf, withStyleDefaults} from './styles';

// ============================================================
// Sheet：整片拼图（make.mjs 出 sheet.png 用，不依赖系统 ffmpeg）。
// props: {storyboard, frames: [帧号...], cols?: 10}
// 每个格子是把 Promo 冻结在某一帧、缩到 1/4（270×480），下面一行小字标时间和镜号。
//   npx remotion still src/index.ts Sheet sheet.png --props=sheet-props.json
// ============================================================
export type SheetProps = {storyboard: Storyboard; frames?: number[]; cols?: number};

export const SHEET = {thumbW: 270, thumbH: 480, pad: 5, label: 31};
export const cellW = SHEET.thumbW + SHEET.pad * 2;
export const cellH = SHEET.thumbH + SHEET.pad + SHEET.label;
/** 缩略图高度按画幅算（9:16 → 480，和原来一样；4:5 → 338） */
const thumbHOf = (sb: Storyboard) => {
  const g = geometryOf(aspectOf(sb));
  return Math.round((SHEET.thumbW * g.h) / g.w);
};
const cellHOf = (sb: Storyboard) => thumbHOf(sb) + SHEET.pad + SHEET.label;

/** 默认取样：每秒一帧，取 x.5 秒（和旧的 ffmpeg 拼图一致） */
export const sheetFrames = (sb: Storyboard) => {
  const total = framesOf(sb);
  const n = Math.max(1, Math.ceil(total / FPS));
  return Array.from({length: n}, (_, k) => Math.min(total - 1, Math.round((k + 0.5) * FPS)));
};

export const sheetSize = (p: SheetProps) => {
  const n = (p.frames?.length ? p.frames : sheetFrames(p.storyboard)).length;
  const cols = Math.max(1, Math.min(p.cols ?? 10, n));
  const rows = Math.max(1, Math.ceil(n / cols));
  return {cols, rows, width: cols * cellW, height: rows * cellHOf(p.storyboard)};
};

export const Sheet: React.FC<SheetProps> = (p) => {
  const sb = {...p.storyboard, __probe: undefined} as Storyboard;
  const frames = p.frames?.length ? p.frames : sheetFrames(sb);
  const {cols} = sheetSize(p);
  const slots = schedule(withStyleDefaults(sb), lookupFor(sb).specOf);
  const g = geometryOf(aspectOf(sb));
  const [W, H, thumbH, cH] = [g.w, g.h, thumbHOf(sb), cellHOf(sb)];
  const scale = SHEET.thumbW / W;
  return (
    <AbsoluteFill style={{background: '#ffffff', fontFamily: FONT}}>
      {frames.map((fr, k) => {
        const sec = fr / FPS;
        const slot = slots.find((s) => sec >= s.start - 1e-6 && sec < s.end - 1e-6) ?? slots[slots.length - 1];
        const x = (k % cols) * cellW;
        const y = Math.floor(k / cols) * cH;
        return (
          <div key={k} style={{position: 'absolute', left: x, top: y, width: cellW, height: cH}}>
            <div style={{position: 'absolute', left: SHEET.pad, top: SHEET.pad, width: SHEET.thumbW, height: thumbH, overflow: 'hidden', background: '#000'}}>
              <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0'}}>
                <Freeze frame={fr}>
                  <Promo {...sb} />
                </Freeze>
              </div>
            </div>
            <div style={{position: 'absolute', left: SHEET.pad, top: SHEET.pad + thumbH, width: SHEET.thumbW, height: SHEET.label, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 18, color: '#555', fontVariantNumeric: 'tabular-nums'}}>
              <span>{sec.toFixed(1)}s</span>
              <span>{slot ? `#${slot.i + 1} ${slot.shot.type}` : ''}</span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
