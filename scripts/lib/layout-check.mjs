// ============================================================
// 布局 / 汉字自查（make.mjs 用）：读渲染日志里布局探针（template/src/core/probe.tsx）打出的 __LAYOUT__{json}__END__，
//   - 检查帧（第 0 帧 + 每镜结束前）：文字被容器裁切 / 两块字相交 / 出了 x180–900（字幕、片尾）或 x150–930（其余）
//   - lang=en 时，所有探针帧（每半拍一帧，覆盖每一拍）：画面 DOM 里任何一段含汉字的文字都算 ✗，
//     连「此刻透明、还没淡入」的也算——组件写死的中文（不在分镜里）也能抓到。
// 每条问题尽量指到分镜字段（shots[2].params.items[1]）；指不到的就是组件自己生成/写死的文字。
// ============================================================

export const HAN_RE = /[㐀-鿿豈-﫿]/;

/** 从渲染日志里收集探针帧：Map<frame, {frame, blocks?, han?, error?}> */
export const parseProbeLog = (text) => {
  const frames = new Map();
  for (const m of String(text).matchAll(/__LAYOUT__(\{.*?\})__END__/g)) {
    try {
      const o = JSON.parse(m[1]);
      if (typeof o.frame === 'number') frames.set(o.frame, o);
    } catch {}
  }
  return frames;
};

const norm = (s) => String(s ?? '').replace(/[{}\s]/g, '');

/** 分镜里所有会上屏的字符串 → [{path, shot, n}] */
export const storyboardFields = (sb) => {
  const out = [];
  const add = (p, v, shot) => {
    if (typeof v !== 'string') return;
    const n = norm(v);
    if (n.length >= 2) out.push({path: p, shot, n});
  };
  const walk = (v, p, shot) => {
    if (typeof v === 'string') add(p, v, shot);
    else if (Array.isArray(v)) v.forEach((x, k) => walk(x, `${p}[${k}]`, shot));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!/^(src|logo|bgm|note|icon|illust|color|refs?|id)$/.test(k)) walk(x, `${p}.${k}`, shot);
  };
  for (const k of ['disclaimer', 'product', 'cta', 'title']) add(`meta.${k}`, sb?.meta?.[k], -1);
  (sb?.meta?.notices ?? []).forEach((x, i) => add(`meta.notices[${i}]`, x, -1));
  (sb?.shots ?? []).forEach((s, i) => {
    walk(s.caption, `shots[${i}].caption`, i);
    walk(s.params, `shots[${i}].params`, i);
  });
  return out;
};

/** 屏幕上的一段字属于分镜哪个字段；优先本镜，其次 meta，最后其他镜 */
export const fieldOf = (fields, text, shotIdx) => {
  const t = norm(text);
  if (t.length < 2) return null;
  const hit = (f) => f.n.includes(t) || (f.n.length >= 4 && t.includes(f.n));
  const order = [...fields.filter((f) => f.shot === shotIdx), ...fields.filter((f) => f.shot === -1), ...fields.filter((f) => f.shot !== shotIdx && f.shot !== -1)];
  return order.find(hit)?.path ?? null;
};

/**
 * @param {{frames: Map<number, any>, slots: {i:number,type:string,start:number,end:number}[], sb: any, checkFrames: number[], fps?: number}} o
 * @returns {{layoutIssues: string[], hanIssues: string[], checked: number, scanned: number, errors: string[]}}
 */
export const layoutCheck = ({frames, slots, sb, checkFrames, fps = 30}) => {
  const lang = sb?.meta?.lang === 'en' ? 'en' : 'zh';
  const fields = storyboardFields(sb);
  const checkSet = new Set(checkFrames);
  const slotOf = (fr) => {
    const sec = fr / fps;
    return slots.find((x) => sec >= x.start - 1e-6 && sec < x.end - 1e-6) ?? slots[slots.length - 1] ?? {i: 0, type: '?'};
  };
  const at = (fr) => {
    const s = slotOf(fr);
    return `${(fr / fps).toFixed(1)}s 第 ${s.i + 1} 镜（${s.type}）`;
  };
  const q = (b) => `「${String(b.text).slice(0, 12)}」`;
  const where = (text, fr) => {
    const f = fieldOf(fields, text, slotOf(fr).i);
    return f ? `（字段 ${f}）` : '（分镜里找不到这段字：是组件自己生成或写死的文字）';
  };
  const layoutIssues = [];
  const errors = [];
  const han = new Map(); // key → {fr[], text, vis, shot}
  let checked = 0;
  for (const [fr, o] of [...frames.entries()].sort((a, b) => a[0] - b[0])) {
    if (o.error) {
      errors.push(`${at(fr)}：探针出错 ${o.error}`);
      continue;
    }
    // ---- 汉字：所有探针帧都查（只在 lang=en） ----
    if (lang === 'en') {
      const seen = new Set();
      const hanList = Array.isArray(o.han) ? o.han : (o.blocks ?? []).filter((b) => HAN_RE.test(b.text)).map((b) => ({text: b.text, vis: true}));
      for (const h of hanList) {
        const text = String(h.text).slice(0, 24);
        if (seen.has(text)) continue;
        seen.add(text);
        const s = slotOf(fr);
        const key = `${s.i}|${text}`;
        const e = han.get(key) ?? {frs: [], text, vis: false, fr0: fr};
        e.frs.push(fr);
        e.vis = e.vis || !!h.vis;
        han.set(key, e);
      }
    }
    if (!checkSet.has(fr)) continue;
    // ---- 版式：只查检查帧（动画已演完的时刻；过渡中的帧会误报相交） ----
    checked++;
    const slot = slotOf(fr);
    const vis = [];
    for (const b of o.blocks ?? []) {
      const [x0, y0, x1, y1] = b.tx ?? [b.x0, b.y0, b.x1, b.y1];
      const c = b.clip;
      if (c && (x1 <= c[0] || x0 >= c[2] || y1 <= c[1] || y0 >= c[3])) continue; // 整块在裁切框外 = 看不见
      if (x1 <= 0 || x0 >= 1080 || y1 <= 0 || y0 >= 1920) continue;
      vis.push(b);
      // 裁切：底边 / 左右被容器切掉（顶边切掉多是聊天记录上滚，属正常）
      if (c) {
        const cut = [];
        if (y1 > c[3] + 3) cut.push(`底边切掉 ${Math.round(y1 - c[3])}px`);
        if (x1 > c[2] + 3) cut.push(`右边切掉 ${Math.round(x1 - c[2])}px`);
        if (x0 < c[0] - 3) cut.push(`左边切掉 ${Math.round(c[0] - x0)}px`);
        if (cut.length) layoutIssues.push(`${at(fr)}：文字${q(b)}被容器裁切（${cut.join('，')}）${where(b.text, fr)}`);
      }
      // 全局字幕带（y260–540）和 endCard 的大字算「关键内容」，按 x180–900 核对；其余卡片内容按 x150–930
      const isKeyContent = (y0 >= 245 && y1 <= 555) || slot?.type === 'endCard';
      const [lo, hi] = isKeyContent ? [178, 902] : [148, 932];
      if (x0 < lo || x1 > hi) layoutIssues.push(`${at(fr)}：文字${q(b)}出了 x${isKeyContent ? 180 : 150}–${isKeyContent ? 900 : 930}（x ${x0}–${x1}）${where(b.text, fr)}`);
    }
    for (let i = 0; i < vis.length; i++)
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i];
        const b = vis[j];
        if (a.anc?.includes(b.id) || b.anc?.includes(a.id)) continue;
        const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ix <= 4 || iy <= 4) continue;
        const area = (z) => Math.max(1, (z.x1 - z.x0) * (z.y1 - z.y0));
        if (ix * iy < 300 || ix * iy < 0.08 * Math.min(area(a), area(b))) continue;
        layoutIssues.push(`${at(fr)}：文字${q(a)}和${q(b)}相交（重叠 ${ix}×${iy}px）${where(a.text, fr)}`);
      }
  }
  const hanIssues = [...han.values()]
    .sort((a, b) => a.fr0 - b.fr0)
    .map((e) => {
      const t0 = (e.frs[0] / fps).toFixed(1);
      const t1 = (e.frs[e.frs.length - 1] / fps).toFixed(1);
      const span = e.frs.length > 1 ? `${t0}–${t1}s 共 ${e.frs.length} 个探针帧` : `${t0}s`;
      const s = slotOf(e.fr0);
      const f = fieldOf(fields, e.text, s.i);
      const src = f ? `分镜字段 ${f} 写了中文，改成英文` : `分镜里没有这段字：是组件 ${s.type} 写死的中文，组件要用 pick(lang, 中文, 英文) 做切换`;
      return `${span} 第 ${s.i + 1} 镜（${s.type}）：英文视频（meta.lang: "en"）${e.vis ? '画面上出现' : '画面里渲染了（此刻透明/未淡入）'}中文「${e.text.slice(0, 16)}」→ ${src}`;
    });
  return {layoutIssues: [...new Set(layoutIssues)], hanIssues, checked, scanned: frames.size, errors, lang};
};
