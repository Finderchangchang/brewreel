// 两种程序化背景。印象派是满屏短弧笔触叠三层，壁画是三格都画满的横带。
// 种子固定，同一时刻画两次，像素一致。
// 字只在字形背后融进画面：印象派是一小片羽化的雾，壁画是题记横带。不再整屏抬成底色。

import {contrastRatio} from '../contrast.ts';
import {fitSceneCopy} from '../wrap.ts';
import {textEm} from '../../talk/motion/measure.ts';

export const ART_INK = {
  impressionist: '#10241C',
  mural: '#2A160E',
} as const;

/** 雾和题记的底色。风格令牌的 bg 仍用它，字幕对比度按这块算。 */
export const ART_FLOOR = {
  impressionist: '#A8C4B8',
  mural: '#D4C098',
} as const;

export type ArtStyleName = keyof typeof ART_INK;

export function isArtStyle(style: string): style is ArtStyleName {
  return style === 'impressionist' || style === 'mural';
}

export type QuietRect = {x: number; y: number; w: number; h: number};

/** 正文和底部字幕仍落在这块里。只用来核对文字没有跑出中段，不再清成一块底板。 */
export function quietRect(w: number, h: number): QuietRect {
  const sx = w / 1080;
  const sy = h / 1920;
  return {
    x: Math.round(140 * sx),
    y: Math.round(230 * sy),
    w: Math.round(800 * sx),
    h: Math.round(1180 * sy),
  };
}

/** 8×8 小格。纯色方差是 0，高于这个值算「画」。 */
export const PAINT_CELL = 8;
export const PAINT_VARIANCE = 4;

export function paintShare(pixels: Uint8ClampedArray, w: number, h: number): number {
  const cw = Math.floor(w / PAINT_CELL);
  const ch = Math.floor(h / PAINT_CELL);
  if (cw < 1 || ch < 1) return 0;
  let hit = 0;
  const n = PAINT_CELL * PAINT_CELL;
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      let sum = 0;
      let sum2 = 0;
      for (let yy = 0; yy < PAINT_CELL; yy++) {
        let i = ((cy * PAINT_CELL + yy) * w + cx * PAINT_CELL) * 4;
        for (let xx = 0; xx < PAINT_CELL; xx++) {
          const l = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
          sum += l;
          sum2 += l * l;
          i += 4;
        }
      }
      const mean = sum / n;
      if (sum2 / n - mean * mean > PAINT_VARIANCE) hit += 1;
    }
  }
  return hit / (cw * ch);
}

/** 字形包围盒里的背景像素对字色的最低对比度。矩形可以落在画面外，超出的部分不量。 */
export function inkContrastIn(pixels: Uint8ClampedArray, w: number, h: number, rect: QuietRect, ink: string): number {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(w, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(h, Math.ceil(rect.y + rect.h));
  let worst = 99;
  let seen = 0;
  for (let y = y0; y < y1; y++) {
    let i = (y * w + x0) * 4;
    for (let x = x0; x < x1; x++) {
      const hex = `#${[pixels[i], pixels[i + 1], pixels[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      const ratio = contrastRatio(ink, hex);
      if (ratio < worst) worst = ratio;
      seen += 1;
      i += 4;
    }
  }
  return seen ? worst : 0;
}

export type ArtBand = {x: number; y: number; w: number; h: number; role: 'glyph' | 'seam'};

export type BandSource = {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  font: number;
  minFont?: number;
  textAlign?: string;
  kind?: string;
  lineHeight?: number;
};

function roundBand(x: number, y: number, w: number, h: number, role: ArtBand['role']): ArtBand {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  return {x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0), role};
}

function centerBand(block: BandSource, tw: number, th: number): ArtBand {
  const w = Math.max(1, Math.min(block.w, tw));
  const h = Math.max(1, Math.min(block.h, th));
  const start = block.textAlign === 'left' || block.textAlign === 'start';
  const x = start ? block.x : block.x + (block.w - w) / 2;
  const y = block.y + (block.h - h) / 2;
  return roundBand(x, y, w, h, 'glyph');
}

function glyphBands(block: BandSource): ArtBand[] {
  const raw = String(block.text ?? '').replace(/[ \t]+/gu, ' ').trim();
  if (!raw) return [];
  const font0 = Math.max(1, block.font || 1);
  const minFont = Math.max(1, Math.min(font0, block.minFont ?? font0));
  const lh = block.lineHeight ?? (block.kind === 'stage' ? 1 : 1.15);
  const lock = block.kind === 'stage' ? raw.match(/^(\d+(?:\.\d+)?)(?:\s+)(\S+)$/) : null;
  if (lock) {
    const numW = textEm(lock[1]) * font0;
    const unitW = textEm(lock[2]) * font0 * 0.75;
    const tw = (numW + font0 * 0.18 + unitW) * 1.06 + 4;
    return [centerBand(block, tw, font0)];
  }
  const preset = raw.includes('\n') ? raw.split('\n').map((line) => line.trim()).filter(Boolean) : null;
  const fitted = preset ? {font: font0, lines: preset} : fitSceneCopy(raw, Math.max(8, block.w), font0, minFont);
  const lines = fitted.lines.length ? fitted.lines : [raw];
  const font = fitted.font;
  const lineH = font * lh;
  const inkH = font * 0.96;
  const usedH = Math.min(block.h, lines.length * lineH);
  const top = block.y + (block.h - usedH) / 2;
  const startLeft = block.textAlign === 'left' || block.textAlign === 'start';
  const out: ArtBand[] = [];
  for (let i = 0; i < lines.length; i++) {
    const tw = Math.min(block.w, textEm(lines[i]) * font * 1.08 + 6);
    const x = startLeft ? block.x : block.x + (block.w - tw) / 2;
    const y = top + i * lineH + (lineH - inkH) / 2;
    out.push(roundBand(x, y, tw, inkH, 'glyph'));
  }
  return out;
}

function seamOf(blocks: BandSource[]): ArtBand | null {
  if (blocks.length < 2) return null;
  const n = Math.ceil(blocks.length / 2);
  const rest = blocks.slice(n);
  if (!rest.length) return null;
  const bounds = (list: BandSource[]) => {
    let x = Infinity;
    let y = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    for (const item of list) {
      x = Math.min(x, item.x);
      y = Math.min(y, item.y);
      r = Math.max(r, item.x + item.w);
      b = Math.max(b, item.y + item.h);
    }
    return {x, y, r, b};
  };
  const top = bounds(blocks.slice(0, n));
  const bot = bounds(rest);
  if (bot.y >= top.b - 1) {
    const gap = bot.y - top.b;
    return roundBand(Math.min(top.x, bot.x), top.b, Math.max(top.r, bot.r) - Math.min(top.x, bot.x), Math.max(8, gap), 'seam');
  }
  if (bot.x >= top.r - 1) {
    const gap = bot.x - top.r;
    return roundBand(top.r, Math.min(top.y, bot.y), Math.max(8, gap), Math.max(top.b, bot.b) - Math.min(top.y, bot.y), 'seam');
  }
  return null;
}

/** 每个文字块一条字形带。split 再加一条组分隔。字幕带传入时同样只包住字行。 */
export function bandsForScreen(layout: string, blocks: BandSource[], caption?: BandSource | null): ArtBand[] {
  const out: ArtBand[] = [];
  for (const block of blocks) out.push(...glyphBands(block));
  if (caption) out.push(...glyphBands(caption));
  if (layout === 'split') {
    const seam = seamOf(blocks);
    if (seam) out.push(seam);
  }
  return out;
}

const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

type RGB = [number, number, number];

const hexRgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const pack = (r: number, g: number, b: number) => {
  const R = Math.max(0, Math.min(255, Math.round(r))) & 255;
  const G = Math.max(0, Math.min(255, Math.round(g))) & 255;
  const B = Math.max(0, Math.min(255, Math.round(b))) & 255;
  return LE ? ((255 << 24) | (B << 16) | (G << 8) | R) >>> 0 : ((R << 24) | (G << 16) | (B << 8) | 255) >>> 0;
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pen = {
  w: number;
  h: number;
  px: Uint32Array;
  buf: Uint8ClampedArray;
  rect: (x: number, y: number, rw: number, rh: number, col: number) => void;
  ellipse: (cx: number, cy: number, rx: number, ry: number, r: number, g: number, b: number, a?: number) => void;
  quad: (pts: number[][], col: number) => void;
  line: (x0: number, y0: number, x1: number, y1: number, width: number, col: number) => void;
};

function makePen(buf: Uint8ClampedArray, w: number, h: number): Pen {
  const px = new Uint32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
  const span = (y: number, x0: number, x1: number, col: number) => {
    if (y < 0 || y >= h) return;
    const a = Math.max(0, x0) | 0;
    const b = Math.min(w, x1) | 0;
    if (b <= a) return;
    const row = y * w;
    px.fill(col, row + a, row + b);
  };
  const blendSpan = (y: number, x0: number, x1: number, r: number, g: number, b: number, alpha: number) => {
    if (y < 0 || y >= h) return;
    const a0 = Math.max(0, x0) | 0;
    const b0 = Math.min(w, x1) | 0;
    if (b0 <= a0) return;
    const inv = 255 - alpha;
    let i = (y * w + a0) * 4;
    for (let x = a0; x < b0; x++) {
      buf[i] = (buf[i] * inv + r * alpha) / 255;
      buf[i + 1] = (buf[i + 1] * inv + g * alpha) / 255;
      buf[i + 2] = (buf[i + 2] * inv + b * alpha) / 255;
      i += 4;
    }
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, r: number, g: number, b: number, a = 255) => {
    if (rx < 0.6 || ry < 0.6) return;
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(h - 1, Math.ceil(cy + ry));
    const solid = a >= 254 ? pack(r, g, b) : 0;
    for (let y = y0; y <= y1; y++) {
      const ny = (y + 0.5 - cy) / ry;
      if (ny * ny >= 1) continue;
      const dx = rx * Math.sqrt(1 - ny * ny);
      if (solid) span(y, cx - dx, cx + dx, solid);
      else blendSpan(y, Math.floor(cx - dx), Math.ceil(cx + dx), r, g, b, a);
    }
  };
  const quad = (pts: number[][], col: number) => {
    let minY = h;
    let maxY = 0;
    for (const p of pts) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(h - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          const t = (y - a[1]) / (b[1] - a[1]);
          xs.push(a[0] + (b[0] - a[0]) * t);
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) span(y, Math.ceil(xs[i]), Math.floor(xs[i + 1]) + 1, col);
    }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, width: number, col: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const px0 = (-dy / len) * width * 0.5;
    const py0 = (dx / len) * width * 0.5;
    quad(
      [
        [x0 + px0, y0 + py0],
        [x1 + px0, y1 + py0],
        [x1 - px0, y1 - py0],
        [x0 - px0, y0 - py0],
      ],
      col,
    );
  };
  return {
    w,
    h,
    px,
    buf,
    rect: (x, y, rw, rh, col) => {
      const y0 = Math.max(0, Math.floor(y));
      const y1 = Math.min(h, Math.ceil(y + rh));
      for (let yy = y0; yy < y1; yy++) span(yy, x, x + rw, col);
    },
    ellipse,
    quad,
    line,
  };
}

function fillGradient(pen: Pen, y0: number, y1: number, top: RGB, bot: RGB) {
  const yA = Math.max(0, Math.floor(y0));
  const yB = Math.min(pen.h, Math.ceil(y1));
  const span = Math.max(1, yB - yA);
  for (let y = yA; y < yB; y++) {
    const t = (y - yA) / span;
    const col = pack(top[0] + (bot[0] - top[0]) * t, top[1] + (bot[1] - top[1]) * t, top[2] + (bot[2] - top[2]) * t);
    pen.px.fill(col, y * pen.w, (y + 1) * pen.w);
  }
}

function outside(px: number, py: number, rect: QuietRect): number {
  const dx = Math.max(rect.x - px, px - (rect.x + rect.w), 0);
  const dy = Math.max(rect.y - py, py - (rect.y + rect.h), 0);
  return Math.hypot(dx, dy);
}

function fade(d: number, feather: number): number {
  if (d <= 0) return 1;
  if (d >= feather) return 0;
  const u = d / feather;
  const s = u * u * (3 - 2 * u);
  return 1 - s;
}

function hash2(x: number, y: number): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

/** 雾只盖住字形外扩 12px 的核，再往外羽化。壁画的核里带一点墙面颗粒。 */
function applyVeils(buf: Uint8ClampedArray, w: number, h: number, bands: ArtBand[], target: RGB, speckle: boolean, strength: number, featherPx: number) {
  const feather = Math.max(18, Math.round(featherPx * (w / 1080)));
  const pad = Math.max(8, Math.round(12 * (w / 1080)));
  for (const band of bands) {
    if (band.role !== 'glyph') continue;
    const core: QuietRect = {x: band.x - pad, y: band.y - pad, w: band.w + pad * 2, h: band.h + pad * 2};
    const x0 = Math.max(0, Math.floor(core.x - feather));
    const y0 = Math.max(0, Math.floor(core.y - feather));
    const x1 = Math.min(w, Math.ceil(core.x + core.w + feather));
    const y1 = Math.min(h, Math.ceil(core.y + core.h + feather));
    for (let y = y0; y < y1; y++) {
      let i = (y * w + x0) * 4;
      for (let x = x0; x < x1; x++) {
        const f = fade(outside(x + 0.5, y + 0.5, core), feather);
        if (f > 0.004) {
          const a = f * strength;
          let tr = target[0];
          let tg = target[1];
          let tb = target[2];
          if (speckle && f > 0.82) {
            const n = (hash2(x, y) % 13) - 6;
            tr += n;
            tg += n;
            tb += n * 0.6;
          }
          // 按亮度差来抬。接近雾色的水面、墙面不动，只有明显更暗的笔触被抬起来。
          const luma = buf[i] * 0.299 + buf[i + 1] * 0.587 + buf[i + 2] * 0.114;
          const goalL = tr * 0.299 + tg * 0.587 + tb * 0.114;
          const gap = goalL <= luma ? 0 : (goalL - luma) / goalL;
          const a2 = Math.min(0.9, a * gap * 2.2);
          if (a2 > 0.004) {
            const inv = 1 - a2;
            buf[i] = buf[i] * inv + tr * a2;
            buf[i + 1] = buf[i + 1] * inv + tg * a2;
            buf[i + 2] = buf[i + 2] * inv + tb * a2;
          }
        }
        i += 4;
      }
    }
  }
}

function hatch(pen: Pen, y0: number, y1: number, seed: number, colors: RGB[], x0 = 0, x1 = pen.w, stepScale = 1) {
  const rand = rng(seed);
  const stepY = Math.max(7, Math.round(11 * stepScale * (pen.h / 1920)));
  const stepX = Math.max(14, Math.round(24 * stepScale * (pen.w / 1080)));
  const th = Math.max(3, Math.round(4 * stepScale * (pen.h / 1920)));
  for (let y = y0; y < y1; y += stepY) {
    const shift = rand() * stepX;
    const wobble = (rand() - 0.5) * stepY * 0.35;
    for (let x = x0 - stepX; x < x1; x += stepX) {
      const col = colors[(rand() * colors.length) | 0];
      const len = stepX * (0.45 + rand() * 0.55);
      pen.rect(x + shift, y + wobble, len, th, pack(col[0], col[1], col[2]));
    }
  }
}

function jumpColor(rand: () => number, palette: RGB[], prev: RGB | null): RGB {
  let col = palette[(rand() * palette.length) | 0];
  if (prev) {
    const d = Math.abs((col[0] - prev[0]) * 0.299 + (col[1] - prev[1]) * 0.587 + (col[2] - prev[2]) * 0.114);
    if (d < 18) col = palette[(rand() * palette.length) | 0];
  }
  return col;
}

/** 一端略细的短笔。水面用横笔，柳用竖笔。 */
function brush(pen: Pen, cx: number, cy: number, len: number, th: number, ang: number, rgb: RGB, caps = false) {
  if (len < 1.2 || th < 0.8) return;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const hx = c * len * 0.5;
  const hy = s * len * 0.5;
  const nx = -s;
  const ny = c;
  const w0 = th * 0.5;
  const w1 = th * 0.3;
  pen.quad(
    [
      [cx - hx + nx * w0, cy - hy + ny * w0],
      [cx + hx + nx * w1, cy + hy + ny * w1],
      [cx + hx - nx * w1, cy + hy - ny * w1],
      [cx - hx - nx * w0, cy - hy - ny * w0],
    ],
    pack(rgb[0], rgb[1], rgb[2]),
  );
  if (caps) {
    pen.ellipse(cx - hx, cy - hy, Math.max(1.2, w0), Math.max(1.1, w0 * 0.82), rgb[0], rgb[1], rgb[2]);
    pen.ellipse(cx + hx, cy + hy, Math.max(1, w1), Math.max(0.9, w1 * 0.82), rgb[0], rgb[1], rgb[2]);
  }
}

function waterField(
  pen: Pen,
  y0: number,
  y1: number,
  seed: number,
  palette: RGB[],
  stepX: number,
  stepY: number,
  t: number,
  motion: number,
  skip = 0.2,
) {
  const {w} = pen;
  const rand = rng(seed);
  const rows = Math.ceil((y1 - y0) / stepY) + 2;
  const cols = Math.ceil(w / stepX) + 2;
  let prev: RGB | null = null;
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      const drop = rand();
      const jx = rand();
      const jy = rand();
      const jl = rand();
      const jt = rand();
      const ja = rand() + rand();
      const jp = rand();
      if (drop < skip) continue;
      const x = i * stepX + (jx - 0.5) * stepX * 1.75;
      const y = y0 + j * stepY + (jy - 0.5) * stepY * 1.65;
      if (y < y0 - stepY || y > y1 + stepY) continue;
      const len = stepX * (0.28 + jl * 1.7);
      const th = stepY * (0.16 + jt * 0.95);
      const ang = (ja - 1) * 0.36;
      const col = jumpColor(rand, palette, prev);
      prev = col;
      const dx = motion * Math.sin(t * 1.12 + jp * 6.2832);
      const dy = motion * 0.38 * Math.cos(t * 0.93 + jp * 4.17);
      brush(pen, x + dx, y + dy, len, th, ang, col, false);
    }
  }
}

function willowLayer(
  pen: Pen,
  seed: number,
  clumps: number,
  palette: RGB[],
  y0: number,
  y1: number,
  t: number,
  swayAmp: number,
  openCenter: boolean,
) {
  const {w} = pen;
  const sx = w / 1080;
  const rand = rng(seed);
  let prev: RGB | null = null;
  for (let k = 0; k < clumps; k++) {
    const u = (k + rand() * 0.7) / clumps;
    const keep = !openCenter || Math.abs(u - 0.5) > 0.2 || rand() > 0.7;
    const cx = u * w + (rand() - 0.5) * 48 * sx;
    const cy = y0 + rand() * Math.max(8, y1 - y0);
    const rw = (26 + rand() * 54) * sx;
    const rh = (32 + rand() * 72) * sx;
    const n = 12 + ((rand() * 14) | 0);
    const phase = rand() * 6.2832;
    const lean = (rand() - 0.5) * 0.28;
    if (!keep) continue;
    for (let j = 0; j < n; j++) {
      const ox = (rand() - 0.5) * 2;
      const oy = (rand() - 0.5) * 2;
      if (ox * ox + oy * oy > 1) continue;
      const xx0 = cx + ox * rw;
      const yy = cy + oy * rh;
      const len = (14 + rand() * 32) * sx;
      const th = (5 + rand() * 9) * sx;
      const ang = Math.PI * 0.5 + lean + (rand() - 0.5) * 0.4;
      const col = jumpColor(rand, palette, prev);
      prev = col;
      const fall = Math.max(0, (yy - y0) / Math.max(1, y1 - y0));
      const sway = Math.sin(t * 1.28 + phase + j * 0.15) * swayAmp * (0.25 + fall);
      brush(pen, xx0 + sway, yy, len, th, ang, col, true);
    }
    const drips = 2 + ((rand() * 4) | 0);
    const side = Math.abs(u - 0.5) > 0.22;
    if (!side) continue;
    for (let d = 0; d < drips; d++) {
      const v = 0.55 + rand() * 0.55;
      const xx = cx + (rand() - 0.5) * rw * 1.1;
      const yy = cy + rh * 0.4 + v * rh * 1.3;
      const col = jumpColor(rand, palette, prev);
      prev = col;
      const sway = Math.sin(t * 1.22 + phase + d) * swayAmp * v;
      brush(pen, xx + sway, yy, (16 + rand() * 28) * sx, (4.5 + rand() * 7) * sx, Math.PI * 0.5 + (rand() - 0.5) * 0.35, col, true);
    }
  }
}

function paintImpressionBase(pen: Pen) {
  const {w, h} = pen;
  const sx = w / 1080;
  const sy = h / 1920;
  fillGradient(pen, 0, h * 0.3, [46, 92, 48], [92, 138, 70]);
  fillGradient(pen, h * 0.22, h * 0.58, [88, 148, 142], [142, 186, 178]);
  fillGradient(pen, h * 0.5, h, [96, 156, 164], [48, 104, 128]);
  const underWater: RGB[] = [
    [64, 108, 126],
    [110, 156, 132],
    [148, 176, 186],
    [72, 128, 118],
    [186, 196, 168],
    [92, 122, 158],
  ];
  const underLeaf: RGB[] = [
    [70, 118, 58],
    [118, 158, 78],
    [48, 92, 50],
    [156, 184, 102],
    [88, 132, 64],
  ];
  const blob = rng(0x4b11);
  for (let i = 0; i < 90; i++) {
    const col = underLeaf[(blob() * underLeaf.length) | 0];
    pen.ellipse(blob() * w, blob() * h * 0.32, (10 + blob() * 22) * sx, (16 + blob() * 28) * sy, col[0], col[1], col[2]);
  }
  for (let i = 0; i < 110; i++) {
    const col = underWater[(blob() * underWater.length) | 0];
    pen.ellipse(blob() * w, h * 0.26 + blob() * h * 0.74, (14 + blob() * 32) * sx, (7 + blob() * 14) * sy, col[0], col[1], col[2]);
  }
  const backLeaf: RGB[] = [
    [132, 168, 88],
    [156, 186, 110],
    [110, 150, 72],
    [176, 198, 128],
    [96, 140, 78],
    [148, 176, 96],
  ];
  const midLeaf: RGB[] = [
    [72, 124, 58],
    [98, 146, 68],
    [54, 104, 50],
    [120, 160, 74],
    [84, 132, 62],
  ];
  willowLayer(pen, 0x61c2, 48, backLeaf, 0, h * 0.3, 0, 0, false);
  willowLayer(pen, 0x62a9, 38, midLeaf, h * 0.02, h * 0.34, 0, 0, false);
  const deepWater: RGB[] = [
    [48, 96, 118],
    [62, 118, 112],
    [86, 132, 96],
    [40, 84, 104],
    [108, 148, 126],
    [72, 108, 142],
    [96, 86, 140],
    [120, 148, 88],
  ];
  const midWater: RGB[] = [
    [96, 156, 152],
    [128, 176, 168],
    [74, 138, 148],
    [156, 188, 176],
    [110, 150, 118],
    [88, 128, 166],
    [170, 186, 154],
    [64, 120, 130],
    [186, 176, 210],
    [210, 200, 150],
  ];
  waterField(pen, h * 0.22, h, 0x51a1, deepWater, 34 * sx, 24 * sy, 0, 0, 0.22);
  waterField(pen, h * 0.24, h, 0x52c8, midWater, 43 * sx, 29 * sy, 0, 0, 0.28);
}

function paintImpressionMove(pen: Pen, t: number) {
  const {w, h} = pen;
  const sx = w / 1080;
  const sy = h / 1920;
  const X = (n: number) => n * sx;
  const Y = (n: number) => n * sy;
  const hiWater: RGB[] = [
    [214, 226, 210],
    [186, 206, 198],
    [168, 196, 214],
    [232, 230, 214],
    [148, 186, 176],
    [196, 184, 168],
    [126, 170, 188],
    [176, 204, 164],
    [210, 198, 150],
    [152, 132, 186],
  ];
  waterField(pen, h * 0.26, h, 0x53e2, hiWater, 38 * sx, 26 * sy, t, X(11), 0.3);

  const frontLeaf: RGB[] = [
    [36, 78, 40],
    [52, 98, 46],
    [28, 64, 36],
    [68, 112, 52],
    [44, 88, 42],
    [84, 128, 58],
  ];
  const hangLeaf: RGB[] = [
    [48, 96, 46],
    [72, 120, 54],
    [38, 82, 42],
    [96, 140, 64],
    [58, 106, 50],
  ];
  willowLayer(pen, 0x63d4, 28, hangLeaf, h * 0.04, h * 0.32, t, X(18), true);
  willowLayer(pen, 0x64b7, 20, frontLeaf, h * 0.08, h * 0.38, t, X(28), true);

  const x0 = X(80);
  const x1 = X(1000);
  const deckY = Y(548);
  const rise = Y(188);
  const sway = Math.sin(t * 0.72) * X(5);
  const archAt = (u: number, lift: number) => {
    const x = x0 + (x1 - x0) * u + sway;
    const y = deckY - Math.sin(u * Math.PI) * lift;
    return [x, y] as const;
  };
  const tanAt = (u: number, lift: number) => {
    const dx = x1 - x0;
    const dy = -Math.PI * Math.cos(u * Math.PI) * lift;
    return Math.atan2(dy, dx);
  };
  const deckCols: RGB[] = [
    [48, 108, 92],
    [72, 136, 112],
    [40, 92, 82],
    [96, 154, 124],
    [58, 118, 100],
  ];
  const railCols: RGB[] = [
    [206, 228, 210],
    [232, 240, 224],
    [176, 210, 190],
    [244, 246, 232],
  ];
  const shadeCols: RGB[] = [
    [28, 70, 78],
    [46, 96, 92],
    [64, 112, 108],
    [38, 82, 90],
  ];
  let prev: RGB | null = null;
  const randR = rng(0x71a4);
  for (let i = 0; i <= 72; i++) {
    const u = i / 72;
    const [x, y] = archAt(u, rise);
    const ang = tanAt(u, rise);
    const nx = Math.cos(ang + Math.PI * 0.5);
    const ny = Math.sin(ang + Math.PI * 0.5);
    for (let k = 0; k < 4; k++) {
      const col = jumpColor(randR, deckCols, prev);
      prev = col;
      brush(pen, x + nx * Y(8 * k - 6), y + ny * Y(8 * k - 6), X(34), Y(14), ang, col, false);
    }
    const ry2 = deckY + (deckY - y) * 0.62 + Y(28);
    brush(pen, x, ry2, X(22 + randR() * 14), Y(7), (randR() - 0.5) * 0.4, jumpColor(randR, shadeCols, prev), false);
    if (i % 2 === 0) {
      brush(pen, x + X((randR() - 0.5) * 10), ry2 + Y(10), X(16 + randR() * 12), Y(5), (randR() - 0.5) * 0.45, jumpColor(randR, shadeCols, prev), false);
    }
  }
  for (let i = 0; i <= 64; i++) {
    const u = i / 64;
    const [x, y] = archAt(u, rise * 1.22);
    const ang = tanAt(u, rise * 1.22);
    brush(pen, x, y, X(30), Y(9), ang, jumpColor(randR, railCols, prev), true);
  }
  for (let i = 1; i < 20; i++) {
    const u = i / 20;
    const [dx, dy] = archAt(u, rise);
    const [rx, ry] = archAt(u, rise * 1.22);
    const post = jumpColor(randR, railCols, prev);
    prev = post;
    brush(pen, (dx + rx) * 0.5, (dy + ry) * 0.5 - Y(4), Math.hypot(rx - dx, ry - dy) + Y(8), X(7), Math.atan2(ry - dy, rx - dx), post, false);
    if (i < 19) {
      const [nx, ny] = archAt((i + 0.5) / 20, rise * 1.08);
      brush(pen, nx, ny, Y(22), X(4.2), tanAt((i + 0.5) / 20, rise) + 1.15, jumpColor(randR, deckCols, post), false);
    }
  }

  const padCols: RGB[] = [
    [36, 110, 64],
    [58, 136, 74],
    [28, 92, 56],
    [78, 150, 82],
    [46, 122, 68],
    [96, 158, 90],
  ];
  const padHi: RGB[] = [
    [110, 168, 96],
    [86, 150, 82],
    [128, 176, 108],
  ];
  const petal: RGB[] = [
    [244, 240, 226],
    [232, 226, 208],
    [252, 246, 236],
  ];
  const blush: RGB[] = [
    [214, 118, 132],
    [232, 168, 176],
    [196, 92, 118],
  ];
  const pads: [number, number, number, number, number, number][] = [
    [168, 708, 26, 0.4, 4, 1],
    [312, 746, 22, -0.25, 3, 0],
    [470, 690, 28, 0.18, 4, 1],
    [820, 730, 24, -0.4, 3, 1],
    [960, 780, 30, 0.3, 4, 1],
    [240, 860, 34, -0.15, 4, 1],
    [880, 900, 32, 0.5, 3, 0],
    [130, 1040, 32, 0.22, 4, 1],
    [940, 1100, 30, -0.33, 4, 1],
    [200, 1220, 36, 0.45, 4, 1],
    [860, 1280, 34, -0.2, 3, 1],
    [120, 1380, 42, 0.1, 4, 2],
    [980, 1420, 38, -0.48, 4, 1],
    [250, 1520, 58, 0.28, 5, 2],
    [210, 1588, 36, -0.4, 3, 1],
    [320, 1610, 48, 0.12, 4, 1],
    [520, 1688, 72, -0.18, 5, 2],
    [580, 1740, 44, 0.5, 4, 1],
    [470, 1780, 32, -0.3, 3, 1],
    [780, 1620, 64, 0.22, 5, 2],
    [840, 1690, 40, -0.36, 4, 1],
    [900, 1760, 52, 0.08, 4, 1],
    [160, 1760, 46, 0.4, 4, 1],
    [640, 1540, 28, -0.22, 3, 1],
    [400, 1480, 24, 0.35, 3, 0],
  ];
  const lilyRand = rng(0x81c0);
  for (let i = 0; i < pads.length; i++) {
    const [px, py, s0, rot, leaves, flowers] = pads[i];
    const bob = Math.sin(t * 1.18 + i * 0.73) * Y(6);
    const drift = Math.sin(t * 0.7 + i * 0.51) * X(10);
    const cx = X(px) + drift;
    const cy = Y(py) + bob;
    const s = X(s0);
    for (let k = 0; k < leaves; k++) {
      const a = rot + k * (Math.PI / Math.max(2.2, leaves)) + (lilyRand() - 0.5) * 0.35;
      const col = jumpColor(lilyRand, k % 2 ? padHi : padCols, prev);
      prev = col;
      brush(pen, cx + Math.cos(a) * s * 0.22, cy + Math.sin(a) * s * 0.12, s * (1.15 + lilyRand() * 0.4), s * (0.42 + lilyRand() * 0.22), a, col, true);
    }
    for (let f = 0; f < flowers; f++) {
      const fx = cx + X((f - 0.3) * 10) + (lilyRand() - 0.5) * s * 0.35;
      const fy = cy - s * (0.12 + f * 0.08) + (lilyRand() - 0.5) * s * 0.12;
      for (let p = 0; p < 3; p++) {
        const a = rot + p * 0.85 + f;
        brush(pen, fx + Math.cos(a) * s * 0.08, fy + Math.sin(a) * s * 0.05, s * 0.34, s * 0.14, a, jumpColor(lilyRand, petal, prev), true);
      }
      brush(pen, fx + s * 0.06, fy - s * 0.04, s * 0.16, s * 0.1, rot + 0.4, jumpColor(lilyRand, blush, prev), true);
    }
  }

  const spark = rng(0xdaab);
  for (let i = 0; i < 42; i++) {
    const x0 = spark() * w;
    const y0 = Y(360 + spark() * 1500);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.85 + i * 1.17);
    const x = x0 + Math.sin(t * 1.4 + i) * X(6);
    const y = y0 + Math.cos(t * 1.1 + i * 0.6) * Y(3);
    const hot = 188 + Math.round(48 * pulse);
    pen.ellipse(x, y, X(7 + pulse * 5), Y(2.6 + pulse * 1.4), hot, hot - 8, 196, 190 + Math.round(40 * pulse));
  }
}

function beads(pen: Pen, x: number, y: number, across: boolean, count: number, step: number, size: number) {
  const colors: RGB[] = [
    [178, 58, 46],
    [42, 78, 154],
    [226, 177, 58],
    [46, 122, 74],
  ];
  const gap = pack(242, 230, 200);
  const seam = pack(42, 28, 20);
  for (let i = 0; i < count; i++) {
    const c = colors[i % colors.length];
    const px0 = across ? x + i * step : x;
    const py0 = across ? y : y + i * step;
    pen.rect(px0, py0, size, size, pack(c[0], c[1], c[2]));
    if (across) pen.rect(px0 + size, py0, Math.max(0, step - size), size, gap);
    else pen.rect(px0, py0 + size, size, Math.max(0, step - size), gap);
    pen.rect(px0, py0, across ? step : 2, across ? 2 : step, seam);
  }
}

function glyph(pen: Pen, kind: number, x: number, y: number, s: number, phase: number) {
  const ink = pack(42, 24, 16);
  const gold = pack(212, 160, 48);
  const blue = pack(42, 86, 168);
  if (kind === 0) {
    pen.ellipse(x, y, s * 0.42, s * 0.42, 196, 64, 48);
    pen.ellipse(x, y, s * 0.16, s * 0.16, 242, 210, 120);
  } else if (kind === 1) {
    const shift = phase * s * 0.35;
    for (let i = 0; i < 3; i++) {
      const yy = y - s * 0.28 + i * s * 0.28;
      pen.line(x - s * 0.4, yy, x - s * 0.15, yy - s * 0.16 + shift * 0.1, s * 0.08, blue);
      pen.line(x - s * 0.15, yy - s * 0.16 + shift * 0.1, x + s * 0.15, yy + s * 0.12, s * 0.08, blue);
      pen.line(x + s * 0.15, yy + s * 0.12, x + s * 0.4, yy, s * 0.08, blue);
    }
  } else if (kind === 2) {
    pen.ellipse(x, y + s * 0.1, s * 0.36, s * 0.22, 90, 96, 88);
    pen.line(x + s * 0.2, y, x + s * 0.46, y - s * 0.28, s * 0.08, ink);
    pen.ellipse(x - s * 0.05, y + s * 0.02, s * 0.08, s * 0.08, 30, 24, 18);
  } else if (kind === 3) {
    pen.line(x, y + s * 0.4, x, y - s * 0.45, s * 0.1, ink);
    pen.ellipse(x + s * 0.16, y - s * 0.2, s * 0.22, s * 0.1, 46, 122, 74);
    pen.ellipse(x - s * 0.16, y - s * 0.02, s * 0.2, s * 0.09, 46, 122, 74);
  } else if (kind === 4) {
    pen.ellipse(x, y - s * 0.12, s * 0.28, s * 0.28, 212, 160, 48);
    pen.line(x, y + s * 0.1, x, y + s * 0.46, s * 0.1, gold);
    pen.line(x - s * 0.24, y + s * 0.16, x + s * 0.24, y + s * 0.16, s * 0.08, gold);
  } else {
    pen.ellipse(x, y, s * 0.4, s * 0.22, 244, 236, 220);
    pen.ellipse(x + s * 0.06, y, s * 0.12, s * 0.12, 42, 24, 16);
    pen.line(x - s * 0.46, y - s * 0.12, x + s * 0.2, y - s * 0.28, s * 0.06, ink);
  }
}

function paintMuralBase(pen: Pen) {
  const {w, h} = pen;
  pen.rect(0, 0, w, h, pack(216, 196, 154));
  const tooth: RGB[] = [
    [196, 168, 118],
    [232, 214, 176],
    [176, 148, 102],
    [210, 186, 140],
  ];
  hatch(pen, 0, h, 0xc0a1, tooth);
}

function figure(pen: Pen, x: number, y: number, s: number, phase: number) {
  const skin = pack(214, 146, 96);
  const kilt = pack(232, 214, 176);
  const sash = pack(178, 58, 46);
  const ink = pack(48, 28, 20);
  const step = Math.sin(phase) * s * 0.07;
  pen.ellipse(x, y - s * 0.36, s * 0.09, s * 0.11, 214, 146, 96);
  pen.ellipse(x - s * 0.01, y - s * 0.42, s * 0.1, s * 0.06, 36, 24, 18);
  pen.ellipse(x + s * 0.045, y - s * 0.36, s * 0.016, s * 0.016, 30, 20, 16);
  pen.quad(
    [
      [x - s * 0.07, y - s * 0.26],
      [x + s * 0.11, y - s * 0.26],
      [x + s * 0.08, y],
      [x - s * 0.04, y],
    ],
    skin,
  );
  pen.quad(
    [
      [x - s * 0.08, y - s * 0.02],
      [x + s * 0.13, y - s * 0.02],
      [x + s * 0.1, y + s * 0.16],
      [x - s * 0.02, y + s * 0.16],
    ],
    kilt,
  );
  pen.rect(x - s * 0.02, y - s * 0.02, s * 0.14, s * 0.04, sash);
  pen.line(x + s * 0.06, y - s * 0.2, x + s * 0.24, y - s * 0.06, Math.max(2, s * 0.035), skin);
  pen.line(x - s * 0.02, y - s * 0.18, x - s * 0.16, y - s * 0.02, Math.max(2, s * 0.03), skin);
  pen.line(x + s * 0.03, y + s * 0.14, x + s * 0.12 + step, y + s * 0.42, Math.max(2, s * 0.04), skin);
  pen.line(x - s * 0.01, y + s * 0.14, x - s * 0.1 - step, y + s * 0.42, Math.max(2, s * 0.04), skin);
  pen.line(x - s * 0.07, y - s * 0.26, x - s * 0.04, y, Math.max(1.4, s * 0.018), ink);
}

function bird(pen: Pen, x: number, y: number, s: number, flap: number) {
  const body = pack(186, 184, 170);
  const ink = pack(48, 32, 24);
  pen.ellipse(x, y, s * 0.5, s * 0.26, 186, 184, 170);
  pen.line(x + s * 0.35, y - s * 0.04, x + s * 0.8, y - s * 0.26, Math.max(2, s * 0.1), body);
  pen.ellipse(x + s * 0.86, y - s * 0.3, s * 0.14, s * 0.1, 186, 184, 170);
  pen.line(x + s * 0.96, y - s * 0.3, x + s * 1.2, y - s * 0.22, Math.max(1.5, s * 0.05), pack(196, 112, 48));
  pen.line(x - s * 0.05, y, x - s * 0.62, y - s * flap, Math.max(2, s * 0.07), ink);
  pen.line(x, y + s * 0.04, x - s * 0.4, y + s * 0.18, Math.max(1.6, s * 0.05), body);
}

function papyrus(pen: Pen, x: number, yTop: number, yBot: number, sway: number, sx: number, sy: number) {
  const stem = pack(32, 118, 70);
  pen.line(x, yBot, x + sway, yTop, Math.max(2, 3.2 * sx), stem);
  for (let i = -2; i <= 2; i++) {
    const ang = i * 0.42;
    const len = 34 * sy;
    pen.line(x + sway, yTop, x + sway + Math.sin(ang) * len * 1.4, yTop - Math.cos(ang) * len * 0.45, Math.max(1.6, 2.6 * sx), pack(46, 142, 78));
  }
  pen.ellipse(x + sway, yTop - 8 * sy, 6 * sx, 8 * sy, 186, 64, 52);
}

function paintMuralMove(pen: Pen, t: number) {
  const {w, h} = pen;
  const sx = w / 1080;
  const sy = h / 1920;
  const X = (n: number) => n * sx;
  const Y = (n: number) => n * sy;
  const sideCount = Math.ceil(h / (32 * sy));
  beads(pen, 0, 0, true, Math.ceil(w / (32 * sx)) + 1, 32 * sx, 24 * sx);
  beads(pen, 0, 0, false, sideCount, 32 * sy, 24 * sx);
  beads(pen, w - 24 * sx, 0, false, sideCount, 32 * sy, 24 * sx);

  for (let i = 0; i < 18; i++) {
    const x = X(70 + i * 56);
    const sway = Math.sin(t * 1.6 + i * 0.45) * X(10);
    papyrus(pen, x, Y(78 + (i % 3) * 10), Y(430), sway, sx, sy);
  }
  for (let i = 0; i < 10; i++) {
    const x = X(160 + i * 86);
    const sway = Math.sin(t * 1.4 + i) * X(8);
    papyrus(pen, x, Y(560 + (i % 2) * 16), Y(860), sway, sx, sy);
  }
  for (let i = 0; i < 7; i++) {
    const x = X(220 + i * 100);
    const sway = Math.sin(t * 1.3 + i * 0.6) * X(8);
    papyrus(pen, x, Y(980 + (i % 3) * 18), Y(1280), sway, sx, sy);
  }
  for (let i = 0; i < 4; i++) {
    const span = w + X(120);
    const x = ((t * X(28 + i * 8) + i * X(260)) % span + span) % span - X(30);
    const y = Y(640 + i * 90) + Math.sin(t * 1.6 + i) * Y(5);
    bird(pen, x, y, X(22), 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.1 + i)));
  }

  pen.ellipse(X(860), Y(168), X(42), Y(42), 226, 176, 64);
  pen.ellipse(X(860), Y(168), X(24), Y(24), 186, 52, 40);
  for (let i = 0; i < 11; i++) {
    const ang = -Math.PI * 0.15 + (i / 10) * Math.PI * 1.3;
    const len = Y(34 + 16 * Math.sin(t * 1.8 + i * 0.5));
    const x1 = X(860) + Math.cos(ang) * len;
    const y1 = Y(168) + Math.sin(ang) * len * 0.7;
    pen.line(X(860), Y(168), x1, y1, X(3), pack(194, 58, 42));
  }

  for (let i = 0; i < 5; i++) {
    const span = w + X(100);
    const x = ((t * X(36 + i * 10) + i * X(230)) % span + span) % span - X(40);
    const y = Y(120 + (i % 3) * 78) + Math.sin(t * 1.8 + i) * Y(6);
    bird(pen, x, y, X(26), 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.4 + i)));
  }

  const order = [0, 3, 1, 4, 2, 5, 0, 1];
  for (let col = 0; col < 4; col++) {
    const x = X([86, 210, 870, 1000][col]);
    for (let row = 0; row < order.length; row++) {
      const kind = order[(row + col) % order.length];
      const phase = kind === 1 ? t : 0;
      glyph(pen, kind, x, Y(500 + row * 108), X(40), phase);
    }
  }

  const people: [number, number, number][] = [
    [340, 250, 150],
    [620, 300, 130],
    [260, 1040, 150],
    [480, 1120, 170],
    [760, 1000, 150],
    [560, 1320, 120],
  ];
  for (let i = 0; i < people.length; i++) {
    figure(pen, X(people[i][0]), Y(people[i][1]), Y(people[i][2]), t * 1.7 + i);
  }

  const rule = pack(92, 52, 36);
  pen.rect(0, Y(458), w, Y(4), rule);
  pen.rect(0, Y(464), w, Y(2), pack(226, 186, 96));
  pen.rect(0, Y(1468), w, Y(4), rule);

  const waterTop = Y(1508);
  pen.rect(0, waterTop, w, h - waterTop, pack(36, 74, 132));
  const tri = Math.ceil(w / X(28));
  for (let i = 0; i < tri; i++) {
    const x = i * X(28);
    const up = i % 2 === 0;
    const c = up ? pack(178, 58, 46) : pack(36, 28, 22);
    pen.quad(
      [
        [x, waterTop],
        [x + X(28), waterTop],
        [x + X(14), waterTop - (up ? Y(16) : Y(8))],
      ],
      c,
    );
  }
  const period = X(48);
  const drift = (t * X(42)) % period;
  for (let row = 0; row < 8; row++) {
    const y = waterTop + Y(24) + row * Y(46);
    const shift = drift + row * X(10);
    for (let i = -1; i < 28; i++) {
      const x = i * X(48) + shift;
      pen.line(x, y, x + X(24), y - Y(10), X(4), pack(150, 196, 220));
      pen.line(x + X(24), y - Y(10), x + X(48), y, X(4), pack(196, 220, 232));
    }
  }
  for (let i = 0; i < 6; i++) {
    const span = w + X(90);
    const x = ((t * X(70 + i * 14) + i * X(180)) % span + span) % span - X(30);
    const y = waterTop + Y(36 + (i % 4) * 40);
    const drawFish = (fx: number) => {
      pen.ellipse(fx, y, X(16), Y(7), 232, 210, 160);
      pen.quad(
        [
          [fx - X(14), y],
          [fx - X(26), y - Y(7)],
          [fx - X(26), y + Y(7)],
        ],
        pack(196, 150, 90),
      );
      pen.ellipse(fx + X(8), y - Y(1), X(2), Y(2), 36, 24, 18);
    };
    drawFish(x);
    drawFish(x - span);
  }

  const span = w + X(140);
  const bx = ((t * X(90)) % span + span) % span - X(40);
  const drawBug = (x: number) => {
    const y = Y(1446);
    pen.ellipse(x + X(30), y - Y(10), X(16), Y(16), 226, 176, 64);
    pen.ellipse(x, y, X(22), Y(12), 44, 86, 176);
    pen.ellipse(x + X(16), y - Y(1), X(8), Y(7), 62, 166, 150);
    for (let leg = 0; leg < 3; leg++) {
      const ly = y - Y(6) + leg * Y(6);
      const kick = Math.sin(t * 4 + leg + x * 0.01) * X(6);
      pen.line(x - X(6), ly, x - X(20) + kick, ly + Y(8), X(2), pack(36, 28, 22));
    }
  };
  drawBug(bx);
  drawBug(bx - span);
}

function inscription(pen: Pen, band: ArtBand) {
  const sx = pen.w / 1080;
  const sy = pen.h / 1920;
  const y0 = band.y - 22 * sy;
  const y1 = band.y + band.h + 22 * sy;
  const x0 = band.x - 16 * sx;
  const x1 = band.x + band.w + 16 * sx;
  // 横线可能贴进相邻字行的测量区，颜色仍要对字色过 4.5，所以用浅赭而不是深褐。
  const ink = pack(186, 140, 78);
  const gold = pack(232, 204, 140);
  pen.line(x0, y0, x1, y0, Math.max(1.5, 2.4 * sy), ink);
  pen.line(x0, y0 - 5 * sy, x1, y0 - 5 * sy, Math.max(1.2, 1.6 * sy), gold);
  pen.line(x0, y1, x1, y1, Math.max(1.5, 2.4 * sy), ink);
  pen.line(x0, y1 + 5 * sy, x1, y1 + 5 * sy, Math.max(1.2, 1.6 * sy), gold);
  const s = 7 * sx;
  for (const x of [x0, x1]) {
    for (const y of [y0, y1]) {
      pen.quad(
        [
          [x, y - s],
          [x + s, y],
          [x, y + s],
          [x - s, y],
        ],
        gold,
      );
    }
  }
}

function paintSeam(pen: Pen, style: string, seam: ArtBand, t: number) {
  const sx = pen.w / 1080;
  const sy = pen.h / 1920;
  const mid = seam.y + seam.h / 2;
  if (style === 'mural') {
    const size = Math.min(seam.h * 0.7, 20 * sy);
    if (size >= 8) {
      const step = size + 6 * sx;
      beads(pen, 0, mid - size / 2, true, Math.ceil(pen.w / step) + 1, step, size);
    }
    pen.line(0, mid, pen.w, mid, Math.max(2, 3 * sy), pack(72, 40, 28));
    return;
  }
  const step = Math.max(36 * sx, pen.w / 16);
  for (let i = 0; i < Math.ceil(pen.w / step); i++) {
    const x = i * step + Math.sin(t * 1.2 + i) * 4 * sx;
    const bob = Math.sin(t * 1.5 + i * 0.8) * Math.min(3 * sy, seam.h * 0.15);
    const s = Math.min(18 * sx, seam.h * 0.42);
    const y = mid + bob;
    brush(pen, x, y, s * 1.6, Math.max(3, s * 0.4), 0.15 * Math.sin(i), [48, 112, 74], true);
    brush(pen, x + s * 0.4, y - s * 0.2, s * 0.5, Math.max(2, s * 0.22), 0.6 + 0.2 * Math.sin(i), [236, 226, 206], true);
  }
}

function paintBase(style: string, w: number, h: number) {
  const buf = new Uint8ClampedArray(w * h * 4);
  const pen = makePen(buf, w, h);
  if (style === 'mural') paintMuralBase(pen);
  else paintImpressionBase(pen);
  return buf;
}

const bases = new Map<string, Uint8ClampedArray>();

export function paintArt(style: string, w: number, h: number, t: number, bands?: ArtBand[]): Uint8ClampedArray {
  const key = `${style}:${w}x${h}`;
  let base = bases.get(key);
  if (!base) {
    base = paintBase(style, w, h);
    bases.set(key, base);
  }
  const buf = new Uint8ClampedArray(base);
  const pen = makePen(buf, w, h);
  const time = Number.isFinite(t) ? t : 0;
  if (style === 'mural') paintMuralMove(pen, time);
  else paintImpressionMove(pen, time);
  const list = bands ?? [];
  if (list.length) {
    const floor = hexRgb(style === 'mural' ? ART_FLOOR.mural : ART_FLOOR.impressionist);
    const mist: RGB = style === 'mural' ? floor : [154, 196, 186];
    const muralVeil = style === 'mural';
    applyVeils(buf, w, h, list, mist, muralVeil, muralVeil ? 0.8 : 0.64, muralVeil ? 24 : 48);
    if (style === 'mural') {
      for (const band of list) if (band.role === 'glyph') inscription(pen, band);
    }
    for (const band of list) if (band.role === 'seam') paintSeam(pen, style, band, time);
  }
  return buf;
}
