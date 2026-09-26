// ============================================================
// 颜色工具：解析色值、sRGB → CIELAB（D65）→ CIELCh、CIEDE2000 色差。
// 给 scripts/check-originality.mjs 用，不依赖任何第三方包。
// CIEDE2000 按 Sharma, Wu, Dalal (2005) 的公式实现，tests/originality/ 里用论文附带的
// 标准色对验证到小数点后 4 位。
// ============================================================

const FULL_HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FULL_RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+%?)\s*)?\)$/i;

/**
 * 把一个「整个字符串就是颜色」的值解析成 {r,g,b,a,hex}。
 * 支持 #RGB / #RGBA / #RRGGBB / #RRGGBBAA / rgb() / rgba()。
 * 夹在句子里的色值（说明文字、阴影参数）不算，返回 null。
 * @param {unknown} v
 * @returns {{r:number,g:number,b:number,a:number,hex:string}|null}
 */
export function parseColor(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = s.match(FULL_HEX);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return {r, g, b, a, hex: toHex(r, g, b)};
  }
  m = s.match(FULL_RGB);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)));
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    if (!Number.isFinite(a)) a = 1;
    return {r, g, b, a: Math.max(0, Math.min(1, a)), hex: toHex(r, g, b)};
  }
  return null;
}

export function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

// D65 参考白（2° 观察者），与 sRGB 矩阵配套
const WHITE = [0.95047, 1.0, 1.08883];
const EPS = Math.pow(6 / 29, 3);
const f = (t) => (t > EPS ? Math.cbrt(t) : t / (3 * Math.pow(6 / 29, 2)) + 4 / 29);

/**
 * sRGB（0–255）→ CIELAB（D65）
 * @returns {[number, number, number]} [L, a, b]
 */
export function rgbToLab(r, g, b) {
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const Z = 0.0193339 * R + 0.119192 * G + 0.9503041 * B;
  const fx = f(X / WHITE[0]);
  const fy = f(Y / WHITE[1]);
  const fz = f(Z / WHITE[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** 任意可解析色值 → Lab；解析不了返回 null */
export function toLab(v) {
  const c = typeof v === 'string' ? parseColor(v) : v;
  if (!c) return null;
  return rgbToLab(c.r, c.g, c.b);
}

/**
 * Lab → LCh（C* = 色度，h = 色相角，度）
 * @returns {[number, number, number]} [L, C, h]
 */
export function labToLch([L, a, b]) {
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, C, h];
}

/** 色值的 CIELCh 色度 C*（< 12 视为近黑/近白/灰的中性色） */
export function chroma(v) {
  const lab = toLab(v);
  return lab ? Math.hypot(lab[1], lab[2]) : NaN;
}

const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

/**
 * CIEDE2000 色差（kL = kC = kH = 1）
 * @param {[number,number,number]} lab1
 * @param {[number,number,number]} lab2
 */
export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hp = (a, b) => {
    if (a === 0 && b === 0) return 0;
    const h = deg(Math.atan2(b, a));
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(a1p, b1);
  const h2p = hp(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p - 360) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(rad(2 * dTheta)) * RC;
  const tL = dLp / SL;
  const tC = dCp / SC;
  const tH = dHp / SH;
  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}

/** 两个色值字符串的 ΔE00；任一解析不了返回 NaN */
export function deltaE(c1, c2) {
  const A = toLab(c1);
  const B = toLab(c2);
  if (!A || !B) return NaN;
  return deltaE2000(A, B);
}
