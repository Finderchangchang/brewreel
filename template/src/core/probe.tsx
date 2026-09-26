import React, {useLayoutEffect, useRef} from 'react';
import {continueRender, delayRender, useCurrentFrame} from 'remotion';

// ============================================================
// 布局探针（make.mjs 自动用，镜头开发者不用管）。
// props 里带 __probe: [帧号...] 时，渲到这些帧就把画面上每个文字块的包围盒用 console.error 打出来
// （一行一帧：__LAYOUT__{json}__END__；Remotion 只在 --log=verbose 时把页面日志转出来），make.mjs 从渲染日志里收集，检查：
//   文字被容器裁切 / 两个文字块相交 / 文字出了 x 150–930。
// 文字块 = 最近的「非行内」祖先元素里所有文字的并集；带底色的块（角标、胶囊）用它自己的外框。
// ============================================================
export type ProbeBlock = {id: number; text: string; x0: number; y0: number; x1: number; y1: number; box: boolean; clip: null | [number, number, number, number]; anc: number[]};

const isInline = (d: string) => d === 'inline' || d === 'inline-block' || d === 'contents';
const hasBg = (cs: CSSStyleDeclaration) => {
  const c = cs.backgroundColor;
  return (!!c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c)) || (cs.backgroundImage && cs.backgroundImage !== 'none');
};

const measure = (root: HTMLElement): ProbeBlock[] => {
  const R = root.getBoundingClientRect();
  const k = R.width ? 1080 / R.width : 1;
  const tr = (r: DOMRect | {left: number; top: number; right: number; bottom: number}) => [(r.left - R.left) * k, (r.top - R.top) * k, (r.right - R.left) * k, (r.bottom - R.top) * k] as [number, number, number, number];
  const ids = new Map<Element, number>();
  const idOf = (el: Element) => {
    if (!ids.has(el)) ids.set(el, ids.size + 1);
    return ids.get(el)!;
  };
  const blocks = new Map<Element, ProbeBlock>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const txt = (n.textContent ?? '').trim();
    if (!txt) continue;
    const parent = n.parentElement;
    if (!parent) continue;
    // 可见性：祖先 opacity 连乘
    let op = 1;
    let hidden = false;
    for (let e: Element | null = parent; e && e !== root.parentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      op *= parseFloat(cs.opacity || '1');
      if (cs.visibility === 'hidden' || cs.display === 'none') hidden = true;
    }
    if (hidden || op < 0.35) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rr = range.getBoundingClientRect();
    if (rr.width < 1 || rr.height < 1) continue;
    // 所属文字块
    let blockEl: Element = parent;
    while (blockEl !== root && isInline(getComputedStyle(blockEl).display) && blockEl.parentElement) blockEl = blockEl.parentElement;
    let b = blocks.get(blockEl);
    if (!b) {
      const cs = getComputedStyle(blockEl);
      const box = !!hasBg(cs) && blockEl !== root;
      // 裁切框：所有 overflow 不是 visible 的祖先（含自己）的交集
      let clip: null | [number, number, number, number] = null;
      const anc: number[] = [];
      for (let e: Element | null = blockEl; e && e !== root.parentElement; e = e.parentElement) {
        anc.push(idOf(e));
        const s = getComputedStyle(e);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const c = tr(e.getBoundingClientRect());
          clip = clip ? [Math.max(clip[0], c[0]), Math.max(clip[1], c[1]), Math.min(clip[2], c[2]), Math.min(clip[3], c[3])] : c;
        }
      }
      const r0 = box ? tr(blockEl.getBoundingClientRect()) : [Infinity, Infinity, -Infinity, -Infinity];
      b = {id: idOf(blockEl), text: '', x0: r0[0], y0: r0[1], x1: r0[2], y1: r0[3], box, clip, anc};
      blocks.set(blockEl, b);
    }
    // 用「墨迹框」代替字体内容框：每一行取中心 ± 0.46 字号（ascent/descent 比行高大，直接用 range 框会把紧排的两行误报成相交/裁切）
    const fs = parseFloat(getComputedStyle(parent).fontSize || '16') / k;
    const lines = Array.from(range.getClientRects()).filter((q) => q.width >= 1 && q.height >= 1);
    const ink = lines.map((q) => {
      const c = (q.top + q.bottom) / 2;
      const h = Math.min(q.height, fs * 0.92) / 2;
      return {left: q.left, right: q.right, top: c - h, bottom: c + h};
    });
    const r = tr({left: Math.min(...ink.map((q) => q.left)), right: Math.max(...ink.map((q) => q.right)), top: Math.min(...ink.map((q) => q.top)), bottom: Math.max(...ink.map((q) => q.bottom))});
    b.text += txt;
    // 文字本身的范围（裁切检查用文字，不用底色框）
    (b as ProbeBlock & {tx?: number[]}).tx = (() => {
      const o = (b as ProbeBlock & {tx?: number[]}).tx ?? [Infinity, Infinity, -Infinity, -Infinity];
      return [Math.min(o[0], r[0]), Math.min(o[1], r[1]), Math.max(o[2], r[2]), Math.max(o[3], r[3])];
    })();
    if (!b.box) {
      b.x0 = Math.min(b.x0, r[0]);
      b.y0 = Math.min(b.y0, r[1]);
      b.x1 = Math.max(b.x1, r[2]);
      b.y1 = Math.max(b.y1, r[3]);
    }
  }
  return [...blocks.values()].map((b) => {
    const tx = (b as ProbeBlock & {tx?: number[]}).tx ?? [b.x0, b.y0, b.x1, b.y1];
    const rd = (v: number) => Math.round(v);
    return {...b, x0: rd(b.x0), y0: rd(b.y0), x1: rd(b.x1), y1: rd(b.y1), tx: tx.map(rd), clip: b.clip ? (b.clip.map(rd) as [number, number, number, number]) : null, text: b.text.slice(0, 24)};
  });
};

/** 包住整片内容；只在 frames 里列出的帧测量一次 */
export const LayoutProbe: React.FC<{frames?: number[]; children: React.ReactNode}> = ({frames, children}) => {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useCurrentFrame();
  const on = Array.isArray(frames) && frames.includes(frame);
  useLayoutEffect(() => {
    if (!on || !ref.current) return;
    // 提交当下容器可能还没排好尺寸（百分比宽度为 0）：挂一个 delayRender，等下一帧动画回调再量，量完才放行截图
    const el = ref.current;
    const h = delayRender('layout probe');
    const done = () => {
      try {
        // eslint-disable-next-line no-console
        console.error(`__LAYOUT__${JSON.stringify({frame, blocks: measure(el)})}__END__`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`__LAYOUT__${JSON.stringify({frame, error: String(e)})}__END__`);
      }
      continueRender(h);
    };
    requestAnimationFrame(() => requestAnimationFrame(done));
  });
  return (
    <div ref={ref} style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%'}}>
      {children}
    </div>
  );
};
