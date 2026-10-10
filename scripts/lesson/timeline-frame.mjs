// 横版时间轴的框。少节点时整块居中放大；区段名画在色条上方；每条说明都落在自己的节点上。
// 出片前用 timelineClipIssues 拦「字被色条切掉 / 说明画出画面」。
import {emWidth} from './title-wrap.mjs';

export const TIMELINE_FRAME = Object.freeze({width: 1680, height: 580, reserveX: 1480, reserveY: 510});

const textPx = (text, font) => emWidth(String(text ?? '')) * font;

const labelOf = (node) => (typeof node === 'string' ? node : node?.label ?? '');

function measure(scale, caps, segs) {
  const nodeFont = Math.round(46 * scale);
  const segFont = Math.round(32 * scale);
  const capFont = Math.round(34 * scale);
  const barH = Math.max(14, Math.round(18 * scale));
  const capH = caps.some((cap) => cap.text) ? Math.ceil(capFont * 1.4) : 0;
  const segH = segs.some((seg) => seg.label) ? Math.ceil(segFont * 1.4) : 0;
  const nodeH = Math.ceil(nodeFont * 1.4);
  const gapCap = capH ? 16 : 0;
  const gapSeg = segH ? 10 : 0;
  const blockH = capH + gapCap + segH + gapSeg + barH + 14 + nodeH;
  return {nodeFont, segFont, capFont, barH, capH, segH, nodeH, gapCap, gapSeg, blockH, scale};
}

function clampBox(cx, y, w, h, width) {
  const boxW = Math.max(8, Math.min(w, width - 16));
  let x = cx - boxW / 2;
  if (x < 8) x = 8;
  if (x + boxW > width - 8) x = Math.max(8, width - 8 - boxW);
  return {x, y, w: boxW, h};
}

export function timelineFrameLayout({nodes = [], segments = [], captions = [], hasQuote = false, width = TIMELINE_FRAME.width, height = TIMELINE_FRAME.height} = {}) {
  const labels = nodes.map(labelOf);
  const segs = (Array.isArray(segments) ? segments : []).map((seg) => ({
    label: seg?.label ?? '',
    tone: seg?.tone === 'alert' ? 'alert' : 'accent',
  }));
  const caps = (Array.isArray(captions) ? captions : []).map((cap) => ({
    text: cap?.text ?? '',
    icon: cap?.icon ?? '',
  }));
  const n = labels.length;
  let sized = measure(1, caps, segs);
  if (!hasQuote && sized.blockH < height * 0.55) {
    const scale = Math.min(1.28, (height * 0.72) / Math.max(1, sized.blockH));
    sized = measure(scale, caps, segs);
  }
  const offsetY = hasQuote ? 12 : Math.max(12, Math.round((height - sized.blockH) / 2));
  const half = (index) => {
    const capW = caps[index]?.text ? textPx(caps[index].text, sized.capFont) + 52 : 0;
    const nodeW = textPx(labels[index] ?? '', sized.nodeFont) + 16;
    return Math.max(capW, nodeW) / 2 + 8;
  };
  const xs = [];
  if (n === 1) xs.push(width / 2);
  else if (n > 1) {
    const left = Math.max(half(0), 24);
    const right = width - Math.max(half(n - 1), 24);
    const span = Math.max(1, right - left);
    for (let i = 0; i < n; i += 1) xs.push(left + (i / (n - 1)) * span);
  }
  let y = offsetY;
  const captionBoxes = [];
  labels.forEach((_, index) => {
    const cap = caps[index];
    if (!cap?.text) return;
    const w = textPx(cap.text, sized.capFont) + 52;
    captionBoxes.push({
      ...clampBox(xs[index], y, w, sized.capH, width),
      font: sized.capFont,
      text: cap.text,
      icon: cap.icon,
      index,
    });
  });
  if (sized.capH) y += sized.capH + sized.gapCap;
  const segTop = y;
  if (sized.segH) y += sized.segH + sized.gapSeg;
  const barY = y;
  y += sized.barH + 14;
  const bars = [];
  for (let i = 0; i < Math.max(0, n - 1); i += 1) {
    const seg = segs[i] ?? {label: '', tone: 'accent'};
    const x1 = xs[i];
    const x2 = xs[i + 1];
    const x = Math.min(x1, x2);
    const w = Math.max(8, Math.abs(x2 - x1));
    const labelW = seg.label ? textPx(seg.label, sized.segFont) + 20 : 0;
    const labelBox = seg.label
      ? {...clampBox((x1 + x2) / 2, segTop, Math.max(labelW, 24), sized.segH, width), font: sized.segFont, text: seg.label}
      : null;
    bars.push({x, y: barY, w, h: sized.barH, label: seg.label, tone: seg.tone, labelBox, index: i});
  }
  const nodeBoxes = labels.map((label, index) => ({
    ...clampBox(xs[index], y, textPx(label, sized.nodeFont) + 16, sized.nodeH, width),
    font: sized.nodeFont,
    text: label,
    index,
    cx: xs[index],
    cy: barY + sized.barH / 2,
  }));
  return {
    frame: {width, height, reserveX: TIMELINE_FRAME.reserveX, reserveY: TIMELINE_FRAME.reserveY},
    scale: sized.scale,
    blockHeight: sized.blockH,
    offsetY,
    quoteTop: offsetY + sized.blockH + 20,
    nodes: nodeBoxes,
    bars,
    captions: captionBoxes,
    writtenCaptions: caps.filter((cap) => cap.text).length,
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5;
}

function outside(box, frame) {
  return box.x < -0.5 || box.y < -0.5 || box.x + box.w > frame.width + 0.5 || box.y + box.h > frame.height + 0.5;
}

function inReserve(box, frame) {
  return box.x + box.w > frame.reserveX + 0.5 && box.y + box.h > frame.reserveY + 0.5 && box.x < frame.width && box.y < frame.height;
}

export function timelineClipIssues(layout) {
  const issues = [];
  const frame = layout?.frame ?? TIMELINE_FRAME;
  const texts = [];
  for (const node of layout?.nodes ?? []) if (node?.text) texts.push({kind: '节点', ...node});
  for (const cap of layout?.captions ?? []) if (cap?.text) texts.push({kind: '说明', ...cap});
  for (const bar of layout?.bars ?? []) {
    if (!bar?.labelBox || !bar.label) continue;
    texts.push({kind: '区段', ...bar.labelBox});
    if (overlaps(bar.labelBox, bar)) issues.push(`区段「${bar.label}」被色条切到`);
  }
  for (const box of texts) {
    if (outside(box, frame)) issues.push(`${box.kind}「${box.text}」画出画面`);
    else if (inReserve(box, frame)) issues.push(`${box.kind}「${box.text}」进了讲解员保留区`);
    if (box.h + 0.5 < box.font * 1.15) issues.push(`${box.kind}「${box.text}」的字高过了格子`);
    if (textPx(box.text, box.font) > box.w + 1) issues.push(`${box.kind}「${box.text}」的字宽过了格子`);
  }
  const drawn = (layout?.captions ?? []).filter((cap) => cap?.text && !outside(cap, frame)).length;
  const written = layout?.writtenCaptions ?? drawn;
  if (drawn < written) issues.push(`说明写了 ${written} 条，只画出 ${drawn} 条`);
  return issues;
}
