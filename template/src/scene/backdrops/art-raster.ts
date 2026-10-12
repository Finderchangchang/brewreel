// 两种程序化背景。印象派是水面短笔触，壁画是横带平涂。
// 种子固定，同一时刻画两次，像素一致。字落在安静区，安静区里不放深色笔触。

export const ART_INK = {
  impressionist: '#10241C',
  mural: '#2A160E',
} as const;

/** 安静区里允许的最深底色。再深就被抬回这个颜色，保证深字能读。 */
export const ART_FLOOR = {
  impressionist: '#A8C4B8',
  mural: '#D4C098',
} as const;

export type ArtStyleName = keyof typeof ART_INK;

export function isArtStyle(style: string): style is ArtStyleName {
  return style === 'impressionist' || style === 'mural';
}

export type QuietRect = {x: number; y: number; w: number; h: number};

/** 9:16 正文和底部字幕带都落在这里。左右留出纹样，上下留出母题。 */
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

const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

type RGB = [number, number, number];

const hexRgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const pack = (r: number, g: number, b: number) => {
  const R = r & 255;
  const G = g & 255;
  const B = b & 255;
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

function liftFloor(buf: Uint8ClampedArray, w: number, h: number, rect: QuietRect, floor: RGB) {
  const score = floor[0] * 2 + floor[1] * 5 + floor[2];
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(w, rect.x + rect.w);
  const y1 = Math.min(h, rect.y + rect.h);
  for (let y = y0; y < y1; y++) {
    let i = (y * w + x0) * 4;
    for (let x = x0; x < x1; x++) {
      if (buf[i] * 2 + buf[i + 1] * 5 + buf[i + 2] < score) {
        buf[i] = floor[0];
        buf[i + 1] = floor[1];
        buf[i + 2] = floor[2];
        buf[i + 3] = 255;
      }
      i += 4;
    }
  }
}

const bases = new Map<string, Uint8ClampedArray>();

function paintImpressionBase(pen: Pen) {
  const {h} = pen;
  fillGradient(pen, 0, h * 0.12, [79, 116, 79], [106, 144, 90]);
  fillGradient(pen, h * 0.12, h * 0.42, [168, 196, 184], [214, 230, 222]);
  fillGradient(pen, h * 0.42, h * 0.74, [214, 230, 222], [168, 196, 184]);
  fillGradient(pen, h * 0.74, h, [94, 132, 118], [58, 96, 82]);
}

function paintImpressionMove(pen: Pen, t: number) {
  const {w, h} = pen;
  const sx = w / 1080;
  const sy = h / 1920;
  const X = (n: number) => n * sx;
  const Y = (n: number) => n * sy;
  const greens: RGB[] = [
    [106, 144, 90],
    [79, 116, 79],
    [143, 173, 106],
    [62, 98, 72],
  ];
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  for (let k = 0; k < 9; k++) {
    const x0 = X(8 + k * 122);
    const phase = t * 2.4 + k * 0.7;
    const breathe = 14 * Math.sin(t * 2.1 + k);
    const col = greens[k % greens.length];
    const ink = pack(clamp(col[0] + breathe), clamp(col[1] + breathe), col[2]);
    for (let j = 0; j < 5; j++) {
      const sway = Math.sin(phase + j * 0.4) * X(26);
      const x = x0 + j * X(14);
      const y1 = Y(64 + j * 26);
      pen.line(x, 0, x + sway, y1, X(6), ink);
      pen.ellipse(x + sway * 0.7, y1 * 0.45, X(18), Y(6), clamp(col[0] + breathe), clamp(col[1] + breathe), col[2]);
    }
  }
  const sway = Math.sin(t * 1.6) * X(10);
  const deck = pack(76, 130, 104);
  const rail = pack(92, 158, 128);
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    const x = X(150 + u * 780) + sway;
    const y = Y(186 - Math.sin(u * Math.PI) * 72);
    if (i > 0) pen.line(prevX, prevY, x, y, Y(11), deck);
    prevX = x;
    prevY = y;
    if (i % 4 === 0) pen.line(x, y, x, Math.min(y + Y(20), Y(216)), X(5), deck);
  }
  pen.line(X(160) + sway, Y(184), X(920) + sway, Y(184), Y(5), rail);

  const water = rng(0x51a7c0de);
  const dabs: RGB[] = [
    [126, 168, 156],
    [158, 184, 196],
    [112, 154, 112],
    [90, 132, 120],
  ];
  const calm: RGB[] = [
    [214, 230, 222],
    [196, 220, 210],
    [232, 240, 232],
  ];
  const quiet = quietRect(w, h);
  for (let i = 0; i < 150; i++) {
    const x = water() * w;
    const y = Y(240) + water() * (h - Y(240));
    const len = X(16 + water() * 42);
    const xx = x + Math.sin(t * 2.2 + i * 0.31) * X(18);
    const yy = y + Math.sin(t * 1.8 + i * 0.17) * Y(6);
    const inside = xx > quiet.x && xx < quiet.x + quiet.w && yy > quiet.y && yy < quiet.y + quiet.h;
    const col = inside ? calm[i % calm.length] : dabs[i % dabs.length];
    pen.ellipse(xx, yy, len, Y(4.5), col[0], col[1], col[2], inside ? 170 : 220);
  }
  const leaf = rng(0x1eaf11);
  for (let i = 0; i < 11; i++) {
    const x = X(80 + leaf() * 920) + Math.sin(t * 1.7 + i) * X(26);
    const y = Y(1500 + leaf() * 340) + Math.sin(t * 1.4 + i * 1.3) * Y(8);
    pen.ellipse(x, y, X(46 + leaf() * 24), Y(16), 90, 140, 78);
    if (leaf() > 0.45) pen.ellipse(x + X(6), y - Y(2), X(14), Y(8), 240, 214, 214);
  }
  for (let i = 0; i < 3; i++) {
    const cx = X(260 + i * 280);
    const cy = Y(1580 + i * 70);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7);
    const rx = X(26 + pulse * 34);
    const ry = Y(8 + pulse * 8);
    pen.ellipse(cx, cy, rx, ry, 210, 228, 220, 90);
  }
  const drift = rng(0xb0a7);
  const marks: {y: number; len: number; th: number; ph: number; sp: number; light: number}[] = [];
  for (let i = 0; i < 86; i++) {
    marks.push({
      y: 1508 + drift() * 380,
      len: 26 + drift() * 70,
      th: 3.5 + drift() * 4,
      ph: drift() * 1400,
      sp: 78 + drift() * 64,
      light: drift(),
    });
  }
  for (const m of marks) {
    const span = w + X(m.len + 40);
    const x = ((m.ph * sx + t * m.sp * sx) % span) - X(16);
    const y = Y(m.y) + Math.sin(t * 1.6 + m.ph) * Y(5);
    const light = m.light > 0.58;
    pen.line(x, y, x + X(m.len), y + Y((m.light - 0.5) * 12), Y(m.th), pack(light ? 224 : 146, light ? 234 : 178, light ? 216 : 156));
  }
  const spark = rng(0xdaab);
  for (let i = 0; i < 36; i++) {
    const y0 = spark() > 0.5 ? Y(12 + spark() * 180) : Y(1500 + spark() * 340);
    const x = spark() * w + Math.sin(t * 2.5 + i) * X(22);
    const y = y0 + Math.sin(t * 2.1 + i * 0.4) * Y(7);
    const hot = 180 + Math.round(50 * (0.5 + 0.5 * Math.sin(t * 2.8 + i)));
    pen.ellipse(x, y, X(14), Y(4), hot, hot - 8, 200, 210);
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
    pen.rect(px0, py0, across ? size : size, across ? size : size, pack(c[0], c[1], c[2]));
    if (across) pen.rect(px0 + size, py0, step - size, size, gap);
    else pen.rect(px0, py0 + size, size, step - size, gap);
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
  const sx = w / 1080;
  const sy = h / 1920;
  pen.rect(0, 0, w, h, pack(228, 208, 160));
  const spot = rng(0xc0a1);
  for (let i = 0; i < 18; i++) {
    pen.ellipse(spot() * w, spot() * h, 30 * sx + spot() * 40 * sx, 16 * sy + spot() * 18 * sy, 196, 174, 122, 80);
  }
  const rule = pack(90, 42, 32);
  pen.rect(64 * sx, 220 * sy, w - 128 * sx, 4 * sy, rule);
  pen.rect(64 * sx, 1410 * sy, w - 128 * sx, 4 * sy, rule);
  pen.rect(72 * sx, 226 * sy, w - 144 * sx, 2 * sy, pack(242, 226, 190));
  pen.rect(72 * sx, 1416 * sy, w - 144 * sx, 2 * sy, pack(242, 226, 190));

  const skin = [230, 176, 140] as RGB;
  const cloth = [244, 232, 206] as RGB;
  const ink = pack(42, 24, 16);
  const gx = 210 * sx;
  const gy = 92 * sy;
  pen.ellipse(gx, gy, 22 * sx, 26 * sy, skin[0], skin[1], skin[2]);
  pen.ellipse(gx + 6 * sx, gy - 2 * sy, 6 * sx, 7 * sy, 244, 236, 220);
  pen.ellipse(gx + 7 * sx, gy, 3 * sx, 3 * sy, 30, 20, 16);
  pen.quad(
    [
      [gx - 46 * sx, gy + 22 * sy],
      [gx + 50 * sx, gy + 22 * sy],
      [gx + 32 * sx, gy + 100 * sy],
      [gx - 28 * sx, gy + 100 * sy],
    ],
    pack(skin[0], skin[1], skin[2]),
  );
  pen.quad(
    [
      [gx - 24 * sx, gy + 40 * sy],
      [gx + 26 * sx, gy + 40 * sy],
      [gx + 34 * sx, gy + 108 * sy],
      [gx - 30 * sx, gy + 108 * sy],
    ],
    pack(cloth[0], cloth[1], cloth[2]),
  );
  pen.line(gx - 46 * sx, gy + 22 * sy, gx + 50 * sx, gy + 22 * sy, 2 * sy, ink);
  for (let i = 0; i < 3; i++) {
    pen.ellipse(gx, gy + (46 + i * 12) * sy, (34 - i * 4) * sx, 7 * sy, i % 2 ? 42 : 176, i % 2 ? 78 : 56, i % 2 ? 154 : 42);
  }

  pen.ellipse(820 * sx, 118 * sy, 34 * sx, 34 * sy, 226, 177, 58);
  pen.ellipse(820 * sx, 118 * sy, 24 * sx, 24 * sy, 196, 56, 44);

  const goose = (x: number, y: number) => {
    pen.ellipse(x, y, 22 * sx, 12 * sy, 150, 148, 136);
    pen.line(x + 16 * sx, y - 2 * sy, x + 28 * sx, y - 16 * sy, 4 * sy, pack(150, 148, 136));
    pen.ellipse(x + 30 * sx, y - 18 * sy, 7 * sx, 5 * sy, 150, 148, 136);
    pen.line(x + 34 * sx, y - 18 * sy, x + 44 * sx, y - 14 * sy, 2 * sy, pack(196, 120, 58));
  };
  goose(430 * sx, 150 * sy);
  goose(520 * sx, 176 * sy);
}

function paintMuralMove(pen: Pen, t: number) {
  const {w, h} = pen;
  const sx = w / 1080;
  const sy = h / 1920;
  const X = (n: number) => n * sx;
  const Y = (n: number) => n * sy;
  const sideCount = Math.ceil((1520 * sy) / (36 * sy));
  beads(pen, 0, 0, true, Math.ceil(w / (36 * sx)) + 1, 36 * sx, 28 * sx);
  beads(pen, 0, 0, false, sideCount, 36 * sy, 28 * sx);
  beads(pen, w - 28 * sx, 0, false, sideCount, 36 * sy, 28 * sx);

  const sway = Math.sin(t * 2.2) * X(12);
  for (let i = 0; i < 7; i++) {
    const x = X(560 + i * 26) + sway * Math.sin(i);
    const stem = pack(30, 110, 70);
    pen.line(x, Y(210), x + Math.sin(t * 2.3 + i) * X(8), Y(96), X(3), stem);
    pen.ellipse(x, Y(88 + (i % 3) * 8), X(12), Y(18), 46, 140, 78);
    pen.ellipse(x, Y(78), X(6), Y(7), 196, 72, 56);
  }

  const sunX = X(820);
  const sunY = Y(118);
  for (let i = 0; i < 9; i++) {
    const ang = -Math.PI * 0.85 + (i / 8) * Math.PI * 0.7;
    const len = Y(36 + 14 * Math.sin(t * 2.2 + i * 0.55));
    const x1 = sunX + Math.cos(ang) * len;
    const y1 = sunY + Math.sin(ang) * len * 0.55;
    pen.line(sunX, sunY, x1, y1, X(3.2), pack(194, 58, 42));
    const open = 0.35 + 0.35 * Math.sin(t * 2.6 + i * 0.8);
    pen.line(x1, y1, x1 + Math.cos(ang - open) * X(14), y1 + Y(12), X(2), pack(180, 70, 48));
    pen.line(x1, y1, x1 + Math.cos(ang + open) * X(14), y1 + Y(12), X(2), pack(180, 70, 48));
  }

  const order = [0, 2, 4, 5, 3, 1, 2, 0, 5, 4, 1, 3];
  for (let i = 0; i < order.length; i++) {
    const col = i < 6 ? X(92) : X(994);
    const y = Y(600 + (i % 6) * 120);
    const phase = order[i] === 1 ? t : 0;
    glyph(pen, order[i], col, y, X(52), phase);
  }

  const waterTop = Y(1520);
  pen.rect(0, waterTop, w, h - waterTop, pack(40, 80, 140));
  beads(pen, 0, waterTop - 30 * sy, true, Math.ceil(w / (36 * sx)) + 1, 36 * sx, 26 * sx);
  const drift = (t * 140 * sx) % (48 * sx);
  for (let row = 0; row < 6; row++) {
    const y = waterTop + Y(28) + row * Y(52);
    const shift = drift + row * 16 * sx;
    for (let i = -1; i < 26; i++) {
      const x = i * X(48) + shift;
      pen.line(x, y, x + X(24), y - Y(12), X(4), pack(150, 190, 220));
      pen.line(x + X(24), y - Y(12), x + X(48), y, X(4), pack(186, 214, 232));
    }
  }
  for (let i = 0; i < 4; i++) {
    const span = w + X(80);
    const x = ((t * X(110 + i * 16) + i * X(220)) % span + span) % span - X(40);
    const y = waterTop + Y(50 + (i % 3) * 48);
    pen.ellipse(x, y, X(16), Y(8), 232, 214, 170);
    pen.ellipse(x + X(14), y, X(5), Y(4), 196, 120, 58);
  }

  const span = w + X(120);
  const bx = ((t * X(160)) % span + span) % span - X(60);
  const drawBug = (x: number) => {
    const y = Y(1460);
    pen.ellipse(x + X(36), y - Y(8), X(22), Y(22), 226, 176, 64);
    pen.ellipse(x, y, X(28), Y(16), 44, 86, 176);
    pen.ellipse(x + X(22), y - Y(2), X(12), Y(10), 62, 166, 150);
    for (let leg = 0; leg < 3; leg++) {
      const ly = y - Y(8) + leg * Y(8);
      const kick = Math.sin(t * 6 + leg + x * 0.01) * X(8);
      pen.line(x - X(8), ly, x - X(28) + kick, ly + Y(10), X(2.4), pack(36, 28, 22));
      pen.line(x + X(8), ly, x + X(26) - kick, ly + Y(8), X(2.4), pack(36, 28, 22));
    }
  };
  drawBug(bx);
  drawBug(bx - span);
}

function paintBase(style: string, w: number, h: number) {
  const buf = new Uint8ClampedArray(w * h * 4);
  const pen = makePen(buf, w, h);
  if (style === 'mural') paintMuralBase(pen);
  else paintImpressionBase(pen);
  return buf;
}

export function paintArt(style: string, w: number, h: number, t: number): Uint8ClampedArray {
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
  const floor = hexRgb(style === 'mural' ? ART_FLOOR.mural : ART_FLOOR.impressionist);
  liftFloor(buf, w, h, quietRect(w, h), floor);
  return buf;
}
