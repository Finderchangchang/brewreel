// ============================================================
// journey / art 的几何小工具：星形、闪光、圆角多边形、飘带。纯函数，返回 SVG path 字符串。
// ============================================================

/** 五角星（中心 cx,cy，外半径 r，内外比 k） */
export const star5 = (cx: number, cy: number, r: number, k = 0.48, rot = -90) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * k;
    const a = ((rot + i * 36) * Math.PI) / 180;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')} Z`;
};

/** 四角闪光（中心 cx,cy，半径 r） */
export const spark4 = (cx: number, cy: number, r: number) => {
  const q = r * 0.22;
  return `M ${cx},${cy - r} Q ${cx + q},${cy - q} ${cx + r},${cy} Q ${cx + q},${cy + q} ${cx},${cy + r} Q ${cx - q},${cy + q} ${cx - r},${cy} Q ${cx - q},${cy - q} ${cx},${cy - r} Z`;
};

/** 螺旋（眩晕眼） */
export const spiral = (cx: number, cy: number, r: number, turns = 2.2) => {
  const n = 40;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const a = p * turns * Math.PI * 2;
    const rr = r * p;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')}`;
};

/** 折线 → 带宽度的飘带多边形（w0 起点宽，w1 末端宽） */
export const ribbon = (pts: [number, number][], w0: number, w1: number) => {
  const up: string[] = [];
  const dn: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const w = (w0 + (w1 - w0) * (i / Math.max(1, pts.length - 1))) / 2;
    up.push(`${(pts[i][0] + nx * w).toFixed(1)},${(pts[i][1] + ny * w).toFixed(1)}`);
    dn.push(`${(pts[i][0] - nx * w).toFixed(1)},${(pts[i][1] - ny * w).toFixed(1)}`);
  }
  return `M ${up.join(' L ')} L ${dn.reverse().join(' L ')} Z`;
};

/** 云朵（一串圆拼成，底边平） */
export const cloudPath = (x: number, y: number, w: number, h: number) => {
  const r1 = h * 0.55;
  const r2 = h * 0.75;
  const r3 = h * 0.5;
  return [
    `M ${x},${y}`,
    `A ${r1} ${r1} 0 0 1 ${x + w * 0.22},${y - h * 0.5}`,
    `A ${r2} ${r2} 0 0 1 ${x + w * 0.62},${y - h * 0.62}`,
    `A ${r3} ${r3} 0 0 1 ${x + w},${y}`,
    'Z',
  ].join(' ');
};

/** 角度（度）→ 从「竖直向下」往外侧转的方向向量；side = -1 左 / +1 右 */
export const limbDir = (deg: number, side: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [side * Math.sin(a), Math.cos(a)];
};
