// ============================================================
// 素材真实性检查（assetTruth）+ 「商家有没有可用实拍」的判断（给 mediaPolicy / firstPhotoWithin3s 用）。
//
// 背景：评审里出现过把一张会议纪要 App 截图同时当成理发「做之前」和「做完」、还标着「顾客授权实拍 · 未修图」的片子，
// 校验器只查了两张图"有没有"，没查"是不是同一张""是不是商家的照片"。这里补上：
//   1. meta.assets 素材清单：[{src, source: merchant|illustration|screenshot, kind?, pair?, note?}]，照抄简报的素材清单。
//      photoShot / beforeAfter / storeCard.photo 用到的每个文件都必须在清单里登记来源。
//   2. 会上屏「实拍」「N月实拍」「顾客授权实拍 · 未修图」这类角标或字样的，只能用 source=merchant 的文件。
//   3. beforeAfter：before/after 不能是同一个文件，也不能内容完全相同（哈希一致）；kind 分别是 customer-before / customer-after。
//   4. 占位/示例素材直接拦：< 2KB、短边 < 300px、解不开的文件、_dev/ 目录、仓库自带的示例截图（按内容哈希认，改名复制也认得出）。
//
// 文件解析只读文件头（PNG/JPEG/WebP/GIF），不引依赖。找不到文件时不在这里报（validate.mjs 主体已经报「素材文件找不到」）。
// validate.mjs 的 --specs 自检会用 template/public/sample-screen.png 跑单镜示例，这种情况整段跳过（见 isSpecSelfTest）。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {where, shotsOfType, mkFinding as F} from './util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = path.join(ROOT, 'template');

export const MIN_BYTES = 2048;
export const MIN_SIDE = 300;
export const ASSET_SOURCES = ['merchant', 'illustration', 'screenshot'];
const BA_KIND = {before: 'customer-before', after: 'customer-after'};
const IMG_EXT = /\.(png|jpe?g|webp|gif)$/i;

const DRAWN_FIX = '没有商家照片就改成插画兜底：media 写 {"source": "drawn", "illust": "<行业>/<名字>", "tag": "示意"}，不写 src、不写 month；画面文字也别写「实拍」';
const BA_FIX = '没有顾客授权的真实前后照片 → 删掉 beforeAfter，改用 steps 讲过程（如 洗→剪→吹）+ photoShot {"source": "drawn", "illust": "beauty/hairdryer", "tag": "示意"}；tag 不许写实拍，不许设 consent';

export const normRel = (s) => String(s ?? '').trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '');

/** validate.mjs 的 checkSpecs() 用 meta.title="spec-check"、baseDir=template 跑单镜示例；示例图是仓库自带的，这里不按商家素材要求它 */
export function isSpecSelfTest(ctx) {
  if (ctx?.specCheck === true) return true;
  return ctx?.meta?.title === 'spec-check' && !!ctx?.baseDir && path.resolve(ctx.baseDir) === TEMPLATE;
}

/** 和 validate.mjs 的 resolveAsset 同一规则：相对 storyboard 目录，其次 template/public */
export function resolveFile(ctx, rel) {
  if (typeof rel !== 'string' || !rel.trim()) return null;
  const r = rel.trim();
  const cands = [path.isAbsolute(r) ? r : path.resolve(ctx?.baseDir ?? process.cwd(), r), path.join(TEMPLATE, 'public', r)];
  for (const p of cands) {
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {}
  }
  return null;
}

/** 只读文件头拿宽高；认不出格式返回 {} */
export function imageSize(buf) {
  if (!buf || buf.length < 12) return {};
  // PNG
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG' && buf.length >= 24) return {format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)};
  // GIF
  if (buf.toString('ascii', 0, 4) === 'GIF8' && buf.length >= 10) return {format: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8)};
  // WebP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' && buf.length >= 30) {
    const fourcc = buf.toString('ascii', 12, 16);
    if (fourcc === 'VP8 ') return {format: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff};
    if (fourcc === 'VP8L') {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      return {format: 'webp', width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))};
    }
    if (fourcc === 'VP8X') return {format: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3)};
    return {};
  }
  // JPEG：顺着段走到 SOFn
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const m = buf[i + 1];
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      if (m === 0xd9 || m === 0xda) break;
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return {format: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7)};
      i += 2 + len;
    }
    return {format: 'jpeg'};
  }
  // MP4/MOV：ftyp 盒子，视频不查宽高
  if (buf.toString('ascii', 4, 8) === 'ftyp') return {format: 'video', video: true};
  return {};
}

const infoCache = new Map();
/** {bytes, sha1, format, width, height, video} */
export function inspectFile(abs) {
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    return null;
  }
  const key = `${abs}|${st.size}|${st.mtimeMs}`;
  if (infoCache.has(key)) return infoCache.get(key);
  let info;
  try {
    // 视频只读文件头（不算哈希，免得每次校验把几十 MB 的片子整个读一遍）
    if (/\.(mp4|mov|m4v|webm)$/i.test(abs)) {
      const fd = fs.openSync(abs, 'r');
      const head = Buffer.alloc(64);
      fs.readSync(fd, head, 0, 64, 0);
      fs.closeSync(fd);
      info = {bytes: st.size, ...imageSize(head)};
      if (!info.format) info.video = true;
      infoCache.set(key, info);
      return info;
    }
    const buf = fs.readFileSync(abs);
    info = {bytes: buf.length, sha1: crypto.createHash('sha1').update(buf).digest('hex'), ...imageSize(buf)};
  } catch {
    info = {bytes: 0, unreadable: true};
  }
  infoCache.set(key, info);
  return info;
}

let SAMPLE = null;
/** 仓库自带的示例/说明图（sha1 → 仓库内路径）：拷贝改名后拿来当商家照片也认得出 */
export function sampleHashes() {
  if (SAMPLE) return SAMPLE;
  SAMPLE = new Map();
  const walk = (dir, deep) => {
    let list = [];
    try {
      list = fs.readdirSync(dir, {withFileTypes: true});
    } catch {
      return;
    }
    for (const d of list) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (deep) walk(p, deep);
      } else if (IMG_EXT.test(d.name)) {
        const info = inspectFile(p);
        if (info?.sha1) SAMPLE.set(info.sha1, normRel(path.relative(ROOT, p)));
      }
    }
  };
  walk(path.join(TEMPLATE, 'public'), false);
  walk(path.join(ROOT, 'examples'), true);
  walk(path.join(ROOT, 'docs', 'images'), true);
  return SAMPLE;
}

/** 文件级问题（占位/过小/解不开/_dev/示例截图），返回 [{problem, fix}]；文件找不到返回 [] 并由调用方决定 */
export function fileProblems(ctx, src) {
  const out = [];
  const rel = normRel(src);
  if (/(^|\/)_dev\//.test(rel)) out.push({problem: `素材「${src}」在 _dev/ 目录下，是测试用的占位素材，不能当商家素材上片`, fix: DRAWN_FIX});
  if (/(^|\/)sample-screen\.(png|jpe?g|webp)$|(^|\/)examples\/assets\//.test(rel)) out.push({problem: `素材「${src}」是仓库自带的示例截图，不是商家素材`, fix: DRAWN_FIX});
  const abs = resolveFile(ctx, src);
  if (!abs) return out;
  const info = inspectFile(abs);
  if (!info) return out;
  if (info.bytes < MIN_BYTES) out.push({problem: `素材「${src}」只有 ${info.bytes} 字节，是占位/空文件，不是真实照片`, fix: DRAWN_FIX});
  else if (!info.video && !(info.width > 0 && info.height > 0)) out.push({problem: `素材「${src}」不是能解开的 PNG/JPEG/WebP 图片（文件头认不出）`, fix: '换成真实的 png/jpg/webp 照片；' + DRAWN_FIX});
  else if (!info.video && Math.min(info.width, info.height) < MIN_SIDE) out.push({problem: `素材「${src}」只有 ${info.width}×${info.height}，短边不到 ${MIN_SIDE}px，是缩略图或占位图，放大后全是马赛克`, fix: `换成短边 ≥${MIN_SIDE}px 的原图；` + DRAWN_FIX});
  const sample = info.sha1 && !out.some((x) => x.problem.includes('示例截图')) ? sampleHashes().get(info.sha1) : null;
  if (sample) out.push({problem: `素材「${src}」和仓库自带的示例图 ${sample} 内容完全一样（改名复制也算），不是商家素材`, fix: DRAWN_FIX});
  return out;
}

/** 读 meta.assets 清单；格式问题作为 block 返回 */
export function readRegistry(meta) {
  const problems = [];
  const bySrc = new Map();
  const list = meta?.assets;
  if (list === undefined) return {bySrc, problems, declared: false};
  if (!Array.isArray(list)) {
    problems.push(F('block', 'meta.assets', 'meta.assets 应该是数组', '写成 [{"src": "photos/dish-1.jpg", "source": "merchant", "kind": "dish"}, ...]，照抄简报的素材清单'));
    return {bySrc, problems, declared: true};
  }
  list.forEach((a, k) => {
    const w = `meta.assets[${k}]`;
    if (!a || typeof a !== 'object' || Array.isArray(a)) return problems.push(F('block', w, '应该是对象 {src, source}', '写成 {"src": "photos/dish-1.jpg", "source": "merchant"}'));
    if (typeof a.src !== 'string' || !a.src.trim()) problems.push(F('block', `${w}.src`, '缺少 src（文件路径）', '写素材文件路径，相对 storyboard.json 所在目录'));
    if (!ASSET_SOURCES.includes(a.source))
      problems.push(F('block', `${w}.source`, `source「${a.source ?? ''}」不是可选值`, '只能是 merchant（商家实拍/顾客授权照片）/ illustration（插画、设计图、AI 生成图）/ screenshot（App/网页截图）；照抄简报素材清单的说明，拿不准就按 illustration'));
    if (typeof a.src === 'string' && a.src.trim()) bySrc.set(normRel(a.src), {...a, _k: k});
  });
  return {bySrc, problems, declared: true};
}

/** photoShot 角标（和 template/src/shots/photoShot.tsx 的 tagLabel 一致） */
export const photoBadge = (m) => (!m ? '示意' : m.source === 'ai' ? 'AI生成 · 效果示意' : m.month ? `${m.month}月实拍` : m.tag ?? (m.source === 'drawn' ? '示意' : '实拍'));

/** 全片用到的图片：photoShot.media / beforeAfter.before|after / storeCard.photo */
export function collectUsages(sb) {
  const out = [];
  for (const {i, shot} of shotsOfType(sb, 'photoShot')) {
    const media = Array.isArray(shot.params?.media) ? shot.params.media : [];
    media.forEach((m, k) => {
      if (m && typeof m === 'object') out.push({i, type: 'photoShot', field: `params.media[${k}]`, src: typeof m.src === 'string' && m.src.trim() ? m.src : null, m, role: 'photo'});
    });
  }
  for (const {i, shot} of shotsOfType(sb, 'beforeAfter')) {
    for (const role of ['before', 'after']) {
      const src = shot.params?.[role]?.src;
      out.push({i, type: 'beforeAfter', field: `params.${role}.src`, src: typeof src === 'string' && src.trim() ? src : null, role});
    }
  }
  for (const {i, shot} of shotsOfType(sb, 'storeCard')) {
    const src = shot.params?.photo;
    if (typeof src === 'string' && src.trim()) out.push({i, type: 'storeCard', field: 'params.photo', src, role: 'store'});
  }
  (sb.shots ?? []).forEach((shot, i) => {
    if (shot && typeof shot.bg === 'string' && shot.bg.trim()) out.push({i, type: shot.type, field: 'bg', src: shot.bg, role: 'bg'});
  });
  return out;
}

/** 这个文件能不能当「可用的商家实拍」：清单里 source=merchant，且文件找得到、没有占位/示例问题 */
export function isUsableMerchant(ctx, entry) {
  if (!entry || entry.source !== 'merchant' || typeof entry.src !== 'string') return false;
  if (!resolveFile(ctx, entry.src)) return false;
  return fileProblems(ctx, entry.src).length === 0;
}

/** 简报素材清单里可用的商家实拍（没用上也算）；用来判断「商家到底有没有照片」 */
export function usableMerchantAssets(ctx) {
  const {bySrc} = readRegistry(ctx?.meta);
  return [...bySrc.values()].filter((e) => isUsableMerchant(ctx, e));
}

/** 片子里真正用上的可用商家实拍（按镜头） */
export function usedMerchantPhotos(sb, ctx) {
  const {bySrc} = readRegistry(ctx?.meta);
  return collectUsages(sb).filter((u) => u.src && isUsableMerchant(ctx, bySrc.get(normRel(u.src))));
}

// 画面文字里的「真实性」字样：实拍/未修图/顾客授权/原图直出/无滤镜；前面带「非/不是/并非」的是免责说明，不算
const CLAIM_RE = /实拍|实景拍摄|未修图|没修图|无修图|不修图|顾客授权|原图直出|无滤镜|真实拍摄/g;
function claimsIn(text) {
  const hits = [];
  for (const m of String(text ?? '').matchAll(CLAIM_RE)) {
    const before = String(text).slice(Math.max(0, m.index - 2), m.index);
    if (/非|不是/.test(before)) continue;
    hits.push(m[0]);
  }
  return hits;
}

const SKIP_KEYS = new Set(['icon', 'src', 'kind', 'visual', 'tone', 'chart', 'type', 'mode', 'source', 'tag', 'layout', 'illust', 'itemId', 'refs', 'evidence', 'x', 'y', 'hex', 'no', 'photo']);
/** 一镜里会上屏的文字（params 叶子 + caption），带字段路径；price-conditions.mjs 也用它 */
export function shotStrings(shot) {
  const out = [];
  const walk = (v, p) => {
    if (typeof v === 'string') {
      if (v.trim()) out.push({field: p, text: v});
    } else if (Array.isArray(v)) v.forEach((x, k) => walk(x, `${p}[${k}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) walk(x, p ? `${p}.${k}` : k);
  };
  walk(shot?.params ?? {}, 'params');
  const cap = shot?.caption;
  (Array.isArray(cap) ? cap : [cap]).forEach((c, k) => typeof c === 'string' && c.trim() && out.push({field: Array.isArray(cap) ? `caption[${k}]` : 'caption', text: c}));
  return out;
}

// ---- assetTruth：素材真实性 ----
export function assetTruth(sb, ctx) {
  if (isSpecSelfTest(ctx)) return [];
  const out = [];
  const reg = readRegistry(ctx.meta);
  out.push(...reg.problems);
  const usages = collectUsages(sb);
  const entryOf = (src) => (src ? reg.bySrc.get(normRel(src)) : undefined);

  for (const u of usages) {
    const w = where(u.i, u.type, u.field);
    if (!u.src) {
      if (u.role === 'photo') {
        const badge = photoBadge(u.m);
        if (/实拍/.test(badge) || u.m.source === 'merchant')
          out.push(F('block', w, `没有照片文件（src），画面却会显示「${badge}」角标${u.m.source === 'merchant' ? '、source 写的是 merchant' : ''}`, DRAWN_FIX));
      }
      continue; // beforeAfter 缺 src 由 beforeAfterConsent 报
    }
    // 镜头 bg 是压暗的装饰底，不强制登记、不按实拍照片的 2KB/300px 门槛卡。画面写「实拍」仍走下面的声明检查。
    if (u.role === 'bg') continue;
    for (const p of fileProblems(ctx, u.src)) out.push(F('block', w, p.problem, u.type === 'beforeAfter' ? BA_FIX : p.fix));
    const e = entryOf(u.src);
    if (!e) {
      out.push(F('block', w, `素材「${u.src}」没有在 meta.assets 素材清单里登记来源`, `在 meta.assets 里加一条 {"src": "${normRel(u.src)}", "source": "merchant|illustration|screenshot"}，照抄简报素材清单；简报没给来源的图不能用。${u.type === 'beforeAfter' ? BA_FIX : DRAWN_FIX}`));
      continue;
    }
    if (u.role === 'photo') {
      if (e.source === 'screenshot')
        out.push(F('block', w, `「${u.src}」登记的是截图（source=screenshot），photoShot 只放商家实拍或插画`, '截图放进 phone 镜头展示；这一镜换成实拍，或 ' + DRAWN_FIX));
      const badge = photoBadge(u.m);
      if ((/实拍/.test(badge) || u.m.source === 'merchant') && e.source !== 'merchant')
        out.push(F('block', w, `「${u.src}」在素材清单里是 ${e.source}，画面却会标「${badge}」${u.m.source === 'merchant' ? '（media.source 写成了 merchant）' : ''}`, '只有 meta.assets 里 source=merchant 的照片才能标实拍：插画/设计图把 media.source 改成 "drawn"、tag 改成「示意」、删掉 month'));
    } else if (u.role === 'before' || u.role === 'after') {
      if (e.source !== 'merchant')
        out.push(F('block', w, `beforeAfter 固定显示「顾客授权实拍 · 未修图」，但「${u.src}」在素材清单里是 ${e.source}，不是顾客照片`, BA_FIX));
      else if (e.kind !== BA_KIND[u.role])
        out.push(F('block', `meta.assets[${e._k}].kind`, `「${u.src}」用作${u.role === 'before' ? '做之前' : '做完'}，素材清单里的 kind 却是「${e.kind ?? '没写'}」`, `简报里这张确实是同一位顾客${u.role === 'before' ? '做之前' : '做完'}的授权照片，kind 写 "${BA_KIND[u.role]}"（前后两张再写同一个 pair，如 "A"）；不是就别用 beforeAfter。${BA_FIX}`));
    } else if (u.role === 'store' && e.source !== 'merchant') {
      out.push(F('block', w, `门头照片会标「实拍」，但「${u.src}」在素材清单里是 ${e.source}`, '换成 source=merchant 的门头实拍，或删掉 photo 改用 layout:"card"/"map"'));
    }
  }

  // beforeAfter：同一个文件 / 内容相同 / 不是同一组
  for (const {i, shot} of shotsOfType(sb, 'beforeAfter')) {
    const b = shot.params?.before?.src;
    const a = shot.params?.after?.src;
    if (typeof b !== 'string' || typeof a !== 'string' || !b.trim() || !a.trim()) continue;
    const w = where(i, 'beforeAfter', 'params.after.src');
    if (normRel(b) === normRel(a)) {
      out.push(F('block', w, `before 和 after 是同一个文件（${b}），拿同一张图当前后对比就是造假`, BA_FIX));
      continue;
    }
    const ab = resolveFile(ctx, b);
    const aa = resolveFile(ctx, a);
    const ib = ab && inspectFile(ab);
    const ia = aa && inspectFile(aa);
    if (ib?.sha1 && ia?.sha1 && ib.sha1 === ia.sha1) out.push(F('block', w, `before「${b}」和 after「${a}」文件名不同，内容却完全一样（哈希一致），是同一张图`, BA_FIX));
    const eb = entryOf(b);
    const ea = entryOf(a);
    if (eb?.pair && ea?.pair && String(eb.pair) !== String(ea.pair))
      out.push(F('block', w, `before 登记的 pair 是「${eb.pair}」，after 是「${ea.pair}」，不是同一位顾客的同一组照片`, '前后两张必须是同一位顾客同一次服务，pair 一致；凑不出同一组就别用 beforeAfter'));
  }

  // 画面文字里的「实拍/未修图/顾客授权」：本镜有图就要求本镜的图都是商家实拍；本镜没图/meta 级文字要求全片至少用了一张
  const usedMerchant = usages.filter((u) => u.src && entryOf(u.src)?.source === 'merchant');
  (sb.shots ?? []).forEach((shot, i) => {
    if (!shot) return;
    const mine = usages.filter((u) => u.i === i);
    for (const t of shotStrings(shot)) {
      const hits = claimsIn(t.text);
      if (!hits.length) continue;
      const w = where(i, shot.type, t.field);
      if (mine.length) {
        const bad = mine.filter((u) => !u.src || entryOf(u.src)?.source !== 'merchant');
        if (bad.length) out.push(F('block', w, `「${t.text}」写了「${hits[0]}」，但这一镜的 ${bad.map((u) => u.src ?? `${u.field}（插画/无文件）`).join('、')} 不是素材清单里 source=merchant 的商家照片`, '「实拍」「未修图」「顾客授权」只能配 source=merchant 的照片；插画/截图就删掉这几个字，改写「示意」'));
      } else if (!usedMerchant.length) {
        out.push(F('block', w, `「${t.text}」写了「${hits[0]}」，但全片没有用任何一张素材清单里 source=merchant 的商家照片`, '删掉「实拍/未修图/顾客授权」字样；有商家照片就先在 meta.assets 登记并用上'));
      }
    }
  });
  const metaTexts = [...(Array.isArray(ctx.meta?.notices) ? ctx.meta.notices.map((n, k) => ({w: `meta.notices[${k}]`, t: n})) : []), ...(typeof ctx.meta?.disclaimer === 'string' ? [{w: 'meta.disclaimer', t: ctx.meta.disclaimer}] : [])];
  for (const {w, t} of metaTexts) {
    const hits = claimsIn(t);
    if (hits.length && !usedMerchant.length) out.push(F('block', w, `「${t}」写了「${hits[0]}」，但全片没有用任何一张 source=merchant 的商家照片`, '改成「画面为插画示意」这类如实说法'));
  }
  return out;
}
