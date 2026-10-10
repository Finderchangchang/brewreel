// ============================================================
// 演示镜头清单。免责小字（meta.disclaimer）只跟这些镜头走。
// 依据现有校验和镜头说明，不改校验本身：
//
// 1. scripts/validate.mjs 的 DEMO_UI_TYPES（示例数字只能出现在这些演示界面）：
//    mockApp、phone、chat、priceCard、factSheet、storeCard、photoShot、dataChart
// 2. scripts/checks/index.mjs 的 chatDisclaimer：用了 chat，disclaimer 要写「演示 / 模拟」
// 3. quiz 镜头说明 + styles/quiz/checks.mjs Q12：
//    params.scene 为 screen（产品界面示意）或 phone（手机演示）才算界面演示。
//    office / cafe / street / home / classroom 是小剧场，不算。
//    scene 的沿用和组件一致（clip.tsx / quiz.tsx / replay.tsx）：
//    - clip 没写 scene → 用 phraseTitle 的 scene
//    - quiz 有 clip 时只用 clip 自己写的 scene（没写就落到默认 office，不算演示）
//    - replay 只用 clip 自己写的 scene
// 4. journey district.spec.json：scene = phone 是「手机街」（App 操作、扫码、提醒），算界面演示。
//    其它街区是插画城市，不算。片尾车票上的累计数字是插画票面，不是界面，不算。
// 5. hook 按实际画的主视觉，不按类型一刀切：
//    - visual=bubble，或没写 / 写了不认识的 visual（组件落到 BubbleVisual）：消息卡 + 气泡 +「输入你的回复」
//    - visual=phone：手机框 + 截图
//    - visual=stat 且 text 里有数字：数字环（模拟数据）。没有数字时退成纯文字贴纸，不算
//    - visual=statBar：通栏刻度条，有没有数字都是数据条
//    - visual=icon / illust / split：图标、插画、左右分屏比喻，不算
// 6. meter、counter 整镜都是仪表或滚动数字。commentCta 整镜都有仿评论输入框。
// 7. quickList：params.quote===true 时每行是头像+气泡；任一 item.score 是数字时是打分。否则是图标清单，不算。
// 8. compare：left/right 写了 stat（非空字符串）或 level（数字）才算数据对比。纯文字两栏不算。
//    beforeAfter 镜头、endCard、reviewCard 是实拍滑杆或落版/评价摘录，不算界面演示。
//
// 出现规则：
// - 分镜里有上面任一镜头：只在这些镜头上显示，并随镜头淡入淡出（相邻演示镜头合并，中间不闪一下）
// - 没有这些镜头（例如只写了「图片仅供参考」，或 meta.demoData 为 true 但没有可挂的演示镜头）：全片显示
// - meta.notices 底部提示条始终全片显示，不走这条清单
// ============================================================

export type ShotLike = {type: string; params?: Record<string, unknown>};

/** 和 scripts/validate.mjs 的 DEMO_UI_TYPES 保持同一份名单 */
export const DEMO_UI_TYPES = ['mockApp', 'phone', 'chat', 'priceCard', 'factSheet', 'storeCard', 'photoShot', 'dataChart'] as const;

const QUIZ_TYPES = new Set(['phraseTitle', 'clip', 'quiz', 'replay']);
const HOOK_NOT_BUBBLE = new Set(['stat', 'icon', 'illust', 'phone', 'split', 'statBar']);

const hasDigit = (value: unknown): boolean => typeof value === 'string' && /[0-9０-９]/.test(value);

/** hook 这一组参数会不会画出消息卡、手机截图或数据条 */
export const hookIsDemo = (params?: Record<string, unknown>): boolean => {
  const visual = typeof params?.visual === 'string' ? params.visual : '';
  if (visual === 'phone' || visual === 'statBar') return true;
  if (visual === 'stat') return hasDigit(params?.text);
  if (HOOK_NOT_BUBBLE.has(visual)) return false;
  return true;
};

const quickListIsDemo = (params?: Record<string, unknown>): boolean => {
  if (params?.quote === true) return true;
  const items = params?.items;
  if (!Array.isArray(items)) return false;
  return items.some((row) => {
    if (!row || typeof row !== 'object') return false;
    const score = (row as {score?: unknown}).score;
    return typeof score === 'number' && Number.isFinite(score);
  });
};

const compareIsDemo = (params?: Record<string, unknown>): boolean => {
  for (const key of ['left', 'right']) {
    const side = params?.[key];
    if (!side || typeof side !== 'object') continue;
    const s = side as {stat?: unknown; level?: unknown};
    if (typeof s.stat === 'string' && s.stat.trim()) return true;
    if (typeof s.level === 'number' && Number.isFinite(s.level)) return true;
  }
  return false;
};

const sceneOf = (shot: ShotLike | undefined): string => {
  const s = shot?.params?.scene;
  return typeof s === 'string' ? s : '';
};

/** quiz 媒体卡实际用的 scene。其它风格只看本镜自己的 scene */
export const resolvedDemoScene = (shot: ShotLike, shots: ShotLike[]): string => {
  const own = sceneOf(shot);
  if (own) return own;
  if (!QUIZ_TYPES.has(shot.type)) return '';
  const hook = shots.find((s) => s.type === 'phraseTitle');
  const clip = shots.find((s) => s.type === 'clip');
  if (shot.type === 'clip') return sceneOf(hook);
  if (shot.type === 'quiz') return clip ? sceneOf(clip) : sceneOf(hook);
  if (shot.type === 'replay') return sceneOf(clip);
  return '';
};

export const isDemoShot = (shot: ShotLike | undefined, shots: ShotLike[]): boolean => {
  if (!shot) return false;
  if ((DEMO_UI_TYPES as readonly string[]).includes(shot.type)) return true;
  if (shot.type === 'hook') return hookIsDemo(shot.params);
  if (shot.type === 'meter' || shot.type === 'counter' || shot.type === 'commentCta') return true;
  if (shot.type === 'quickList') return quickListIsDemo(shot.params);
  if (shot.type === 'compare') return compareIsDemo(shot.params);
  const scene = QUIZ_TYPES.has(shot.type) ? resolvedDemoScene(shot, shots) : sceneOf(shot);
  return scene === 'screen' || scene === 'phone';
};

/** 有演示镜头才按镜头出；一个都没有就全片出 */
export const selectiveDisclaimer = (shots: ShotLike[]): boolean => shots.some((s) => isDemoShot(s, shots));

type RangeSlot = {start: number; end: number; shot: ShotLike};

/** 当前时刻免责小字的不透明度。没有演示镜头时恒为 1（全片）。相邻演示镜头合成一段，避免交界处闪灭 */
export const demoOpacity = (t: number, slots: RangeSlot[]): number => {
  const shots = slots.map((s) => s.shot);
  const ranges: {start: number; end: number}[] = [];
  for (const s of slots) {
    if (!isDemoShot(s.shot, shots)) continue;
    const last = ranges[ranges.length - 1];
    if (last && s.start <= last.end + 0.05) last.end = Math.max(last.end, s.end);
    else ranges.push({start: s.start, end: s.end});
  }
  if (!ranges.length) return 1;
  let o = 0;
  for (const r of ranges) {
    const fade = Math.min(0.22, Math.max(0.08, (r.end - r.start) / 4));
    const inn = t <= r.start ? 0 : t >= r.start + fade ? 1 : (t - r.start) / fade;
    const out = t >= r.end ? 0 : t <= r.end - fade ? 1 : (r.end - t) / fade;
    o = Math.max(o, Math.min(inn, out));
  }
  return o;
};
