// ============================================================
// 内置检查函数（docs/dev/industry-design.md 第 3.4 节）。
// 每个函数签名一致：(sb, ctx, rules) => Finding[]，Finding = {level, where, problem, fix}。
// ctx 是 validate.mjs 传下来的 {baseDir, specs, texts, assets, slots, beat, meta}（见 industry.mjs 顶部注释）。
// rules 是三层合并后的最终规则（merge-rules.mjs 的结果），检查函数按需读 rules.mediaPolicy / rules.shotRules 等。
//
// 已知限制：本阶段没有 brief.json 的读取器（见交接文档「遗留问题」第 4 条），设计里要求"对照 brief 核实"的检查
// （priceMatchesBrief 对齐商家报价表、credVerbatim/reviewVerbatim 逐字比对简报原文）在这里降级为：
//   - 能从 storyboard 自身结构验证的部分（同一 itemId 前后价格是否一致、字段是否齐全）照常做 block/warn；
//   - 必须依赖 brief 原文才能证实的部分，降级成 human（人工复核），不误报也不放行。
// ============================================================
import {where, indexTexts, evalWhen, shotsOfType, mkFinding} from './util.mjs';
import {assetTruth, usableMerchantAssets, usedMerchantPhotos, isSpecSelfTest} from './assets.mjs';
import {compareDirection} from './compare.mjs';
import {coreActionSurface} from './core-action.mjs';
import {priceConditions} from './price-conditions.mjs';

const F = mkFinding;
const cite = (fix, source) => (source ? `${fix}（依据：${source}）` : fix);

// ---- mediaPolicy：素材来源与角标 ----
export function mediaPolicy(sb, ctx, rules) {
  const out = [];
  const policy = rules.mediaPolicy || {};
  const targetTypes = policy.shots || ['photoShot', 'storeCard', 'hook'];
  const allowSources = policy.allowSources || ['merchant', 'ai', 'drawn'];
  const shotTypes = (sb.shots ?? []).map((s) => s?.type);
  // evalWhen(undefined,...) 本身语义是"没有门槛就总是成立"（给 checks[].when 用），mediaPolicy 这两个字段反过来：
  // rules.json 没写就是"这条策略不启用"，所以这里显式判断字段存不存在，不能直接丢给 evalWhen
  const blockAi = !!policy.blockAiWhen && evalWhen(policy.blockAiWhen, {meta: ctx.meta, shotTypes});
  const requirePhoto = !!policy.requireAtLeastOnePhotoWhen && evalWhen(policy.requireAtLeastOnePhotoWhen, {meta: ctx.meta, shotTypes});
  for (const type of targetTypes) {
    for (const {i, shot} of shotsOfType(sb, type)) {
      const media = Array.isArray(shot.params?.media) ? shot.params.media : shot.params?.photo ? [shot.params.photo] : [];
      for (const [k, m] of media.entries()) {
        if (!m || typeof m !== 'object') continue;
        if (m.source && !allowSources.includes(m.source))
          out.push(F('warn', where(i, type, `params.media[${k}].source`), `素材来源「${m.source}」不在本行业允许列表（${allowSources.join('/')}）`, '换成允许的来源，或改用插画兜底'));
        if (m.source === 'ai' && blockAi)
          out.push(F('block', where(i, type, `params.media[${k}]`), 'AI 生成素材在当前平台/挂车条件下不允许使用', '换成商家实拍（source: "merchant"）或代码绘制的插画（source: "drawn"）'));
        if (m.source === 'ai' && m.tag !== '效果图')
          out.push(F('warn', where(i, type, `params.media[${k}].tag`), 'source=ai 时 tag 应固定为「效果图」并自动加「AI生成 · 效果示意」角标', '把 tag 改成 "效果图"'));
      }
    }
  }
  // 「整片至少 1 镜商家实拍」只在商家真有可用照片时才拦（round5 修复：测试环境/小商家没有照片时，这条规则永远过不去，
  // 模型改 4 轮也出不了片）。可用 = meta.assets 里 source=merchant、文件找得到、不是占位/示例图（见 assets.mjs）。
  // 商家确实没有照片：放行插画兜底，给 warn + 人工复核「正式发布前补 1 张商家实拍」。
  if (requirePhoto && !isSpecSelfTest(ctx) && !usedMerchantPhotos(sb, ctx).length) {
    const avail = usableMerchantAssets(ctx);
    if (avail.length)
      out.push(F('block', 'shots', `当前平台/挂车条件要求整片至少 1 镜商家实拍；素材清单里有可用的商家照片（${avail.slice(0, 3).map((a) => a.src).join('、')}），但片子里一张都没用`, `在 photoShot 里用上它，如 media 写 {"src": "${avail[0].src}", "source": "merchant", "tag": "实拍"}`));
    else {
      out.push(F('warn', 'shots', '商家没有可用的实拍照片（meta.assets 里没有合格的 source=merchant 文件），这一版按插画兜底出片', '可以先出片；正式发布前补 1 张商家实拍（门头或招牌菜品/商品），登记进 meta.assets 后换掉一镜插画'));
      out.push(F('human', 'shots', '当前平台/挂车条件要求至少 1 镜商家实拍，这一版全是插画兜底', '正式发布前补 1 张商家实拍（门头或菜品/商品），不要用网图或 AI 图顶替'));
    }
  }
  return out;
}

// ---- evidenceRefs：refs 指向的 id 必须存在于 meta.facts（brief.honors/certs 暂不可核对，见文件头注释）----
export function evidenceRefs(sb, ctx) {
  const out = [];
  const ids = new Set((ctx.meta?.facts ?? []).map((f) => f.id));
  (sb.shots ?? []).forEach((shot, i) => {
    const refs = shot?.params?.refs;
    if (!Array.isArray(refs) || !refs.length) return;
    for (const r of refs) {
      if (!ids.has(r)) out.push(F('block', where(i, shot.type, 'params.refs'), `refs 里的 "${r}" 在 meta.facts 里找不到对应 id`, '把 id 改成 meta.facts 里已有的条目，或者在 meta.facts 里补一条 {"id":"' + r + '","text":"…简报原话…"}'));
    }
  });
  return out;
}

// ---- priceHasUnit：priceCard.items 必须有 unit ----
export function priceHasUnit(sb) {
  const out = [];
  for (const {i, shot} of shotsOfType(sb, 'priceCard')) {
    (shot.params?.items ?? []).forEach((it, k) => {
      if (!it?.unit || !String(it.unit).trim()) out.push(F('block', where(i, 'priceCard', `params.items[${k}].unit`), '缺少计价单位', '补一个单位（碗/杯/只/晚/次/位/人/张/套…），和价格同一行显示'));
    });
  }
  return out;
}

const REFPRICE_RE = /原价|门市价|划线价|市场价|挂牌价|日常价|专柜价|吊牌价|指导价|建议零售价|门店价/;
const BASIS_ALLOWED = ['前7日最低成交价', '单点合计', '厂商建议零售价', '吊牌价', '平日价', '近7日成交价', '上次成交价'];

// ---- compareHasBasis：原价类字眼要有 basis+evidence；平台挂车时可能整体禁用 compare ----
export function compareHasBasis(sb, ctx, rules) {
  const out = [];
  for (const t of indexTexts(sb, ctx)) {
    // compare.basis 自己的取值（如「吊牌价」「厂商建议零售价」）本来就是 BASIS_ALLOWED 里的合法词，
    // 且也含"原价类字眼"，被下面单独核对，这里的通用扫描要跳过它，否则合法值会把自己拦掉（round4 修复）
    if (/params\.compare\.basis$/.test(t.where)) continue;
    if (REFPRICE_RE.test(t.text)) out.push(F('block', t.where, `「${t.text}」含原价类字眼，画面不能出现"原价"二字`, cite('改成 priceCard.compare（basis 从允许值里选：' + BASIS_ALLOWED.join('/') + '，并填 evidence 说明依据，不上屏）', '《明码标价和禁止价格欺诈规定》第十六、十七条')));
  }
  for (const type of ['priceCard']) {
    for (const {i, shot} of shotsOfType(sb, type)) {
      const cmp = shot.params?.compare;
      if (!cmp) continue;
      const shotTypes = (sb.shots ?? []).map((s) => s?.type);
      // evalWhen(undefined,...) 语义是"没有门槛就总是成立"（给 checks[].when 用）；这里反过来，rules.json 没写
      // forbidCompareWhen 就是"这条策略不启用"，必须先判字段存不存在，和 mediaPolicy() 的 blockAiWhen 同一模式（round4 修复：
      // 之前少了 !! 判断，food 以外的行业只要没写 forbidCompareWhen，compare 就被永远拦掉）
      const forbid = !!rules.shotRules?.priceCard?.forbidCompareWhen && evalWhen(rules.shotRules.priceCard.forbidCompareWhen, {meta: ctx.meta, shotTypes});
      if (forbid) {
        out.push(F('block', where(i, type, 'params.compare'), '当前平台/挂车条件下不允许显示比较价（compare）', '删掉 compare 字段，本条不上屏'));
        continue;
      }
      if (!cmp.basis || !BASIS_ALLOWED.includes(cmp.basis)) out.push(F('block', where(i, type, 'params.compare.basis'), `basis「${cmp.basis ?? ''}」不在允许值里`, `从这些里选：${BASIS_ALLOWED.join('/')}`));
      if (!cmp.evidence || !String(cmp.evidence).trim()) out.push(F('block', where(i, type, 'params.compare.evidence'), '缺少 evidence（不上屏，只给校验和人看）', '写清楚这个比较价的依据，如后台截图路径或成交记录'));
    }
  }
  return out;
}

// ---- discountMath：折/省/直降/立减 的换算要对得上 ----
export function discountMath(sb, ctx) {
  const out = [];
  for (const {i, shot} of shotsOfType(sb, 'priceCard')) {
    const item = (shot.params?.items ?? [])[0];
    const cmp = shot.params?.compare;
    const price = item?.price;
    const base = cmp?.price;
    if (typeof price !== 'number' || typeof base !== 'number' || base <= 0) continue;
    for (const t of indexTexts(sb, ctx).filter((x) => x.shotIndex === i)) {
      const foldM = /(\d+(?:\.\d+)?)\s*折/.exec(t.text);
      if (foldM) {
        const stated = Number(foldM[1]);
        const actual = (price / base) * 10;
        if (Math.abs(stated - actual) > 0.1) out.push(F('block', t.where, `写着「${foldM[0]}」，但 ${price}/${base} 实际约 ${actual.toFixed(1)} 折，对不上`, '按实际价格改折数，或改价格'));
      }
      const cutM = /(省|直降|立减)\s*(\d+(?:\.\d+)?)\s*元/.exec(t.text);
      if (cutM) {
        const stated = Number(cutM[2]);
        const actual = base - price;
        if (Math.abs(stated - actual) > 1) out.push(F('block', t.where, `写着「${cutM[0]}」，但 ${base}-${price}=${actual} 元，对不上`, '按实际差价改数字'));
      }
    }
  }
  return out;
}

const PROMO_RE = /限时|半价|第二[杯件份]|\d(\.\d)?折|买.送|满\d+减|秒杀|活动价|特价|今日|倒计时/;

// ---- promoHasPeriod：出现促销字眼要有起止日期 ----
export function promoHasPeriod(sb, ctx, rules) {
  const out = [];
  const hasPromoWord = indexTexts(sb, ctx).some((t) => PROMO_RE.test(t.text));
  if (!hasPromoWord) return out;
  const priceCards = shotsOfType(sb, 'priceCard');
  const hasPeriod = priceCards.some(({shot}) => shot.params?.period && String(shot.params.period).trim());
  const noticeHasDate = (ctx.meta?.notices ?? []).some((n) => /\d+月\d+日/.test(n)) || (ctx.meta?.disclaimer && /\d+月\d+日/.test(ctx.meta.disclaimer));
  if (!hasPeriod && !noticeHasDate) out.push(F('block', 'shots', '出现促销字眼，但没有写活动起止日期', cite('在 priceCard.params.period 或 meta.notices 里写清"活动时间：X月X日—X月X日"', '《规范促销行为暂行规定》第五、六条')));
  if (rules.flags?.promoRequiresLimits) {
    const hasLimits = priceCards.some(({shot}) => Array.isArray(shot.params?.limits) && shot.params.limits.length);
    if (!hasLimits) out.push(F('block', 'shots', '促销价还需要至少 1 条 limits（如"限堂食"）', '在 priceCard.params.limits 里补一条'));
  }
  return out;
}

// ---- netPriceConditions：到手价/券后价/满减要写条件 ----
export function netPriceConditions(sb, ctx) {
  const out = [];
  const hasNetWord = indexTexts(sb, ctx).some((t) => /到手价|券后价|满\d+减/.test(t.text));
  if (!hasNetWord) return out;
  for (const {i, shot} of shotsOfType(sb, 'priceCard')) {
    if (['到手价', '券后价'].includes(shot.params?.label) && !String(shot.params?.conditions ?? '').trim())
      out.push(F('block', where(i, 'priceCard', 'params.conditions'), `label 是「${shot.params.label}」，但没写条件`, '补一句，如"需领取20元店铺券"'));
  }
  return out;
}

// ---- giftHasQty：出现"送/赠"要有赠品名和数量 ----
export function giftHasQty(sb, ctx) {
  const out = [];
  const hasGiftWord = indexTexts(sb, ctx).some((t) => /送|赠/.test(t.text));
  if (!hasGiftWord) return out;
  const priceCards = shotsOfType(sb, 'priceCard');
  const ok = priceCards.some(({shot}) => shot.params?.gift?.name && Number.isInteger(shot.params?.gift?.qty) && shot.params.gift.qty > 0);
  if (!ok) out.push(F('block', 'shots', '出现"送/赠"，但没有 priceCard.params.gift（品名+数量）', '补 params.gift: {"name": "...", "qty": 1}，不写具体数量就别写"送"'));
  return out;
}

// 「自助」只按复合词匹配（自助餐/自助火锅/自助烧烤），避免误伤「自助点单」「自助结账」这类和自助餐无关的用法（round4 修复）
const FEE_CATEGORY_RE = /火锅|自助餐|自助火锅|自助烧烤|烧烤|茶楼|门票/;

// ---- extraFeesRequired：指定品类要求 priceCard.excludes 必填 ----
export function extraFeesRequired(sb, ctx) {
  const out = [];
  const hit = indexTexts(sb, ctx).some((t) => FEE_CATEGORY_RE.test(t.text));
  if (!hit) return out;
  for (const {i, shot} of shotsOfType(sb, 'priceCard')) {
    if (!String(shot.params?.excludes ?? '').trim()) out.push(F('block', where(i, 'priceCard', 'params.excludes'), '这个品类要求写清另收费用', '没有另收费用就写"无其他收费"'));
  }
  return out;
}

// ---- fromNeedsNote：标"起"价要有 fromNote（card）或 addOns（menu）----
export function fromNeedsNote(sb) {
  const out = [];
  for (const {i, shot} of shotsOfType(sb, 'priceCard')) {
    const layout = shot.params?.layout;
    (shot.params?.items ?? []).forEach((it, k) => {
      if (!it?.from) return;
      if (layout === 'card' && !String(it.fromNote ?? '').trim()) out.push(F('block', where(i, 'priceCard', `params.items[${k}].fromNote`), '标了"起"价（card 布局），缺 fromNote', '补一句说明，如"及腰长发 +160元起"'));
      if (layout === 'menu' && !(Array.isArray(shot.params?.addOns) && shot.params.addOns.length)) out.push(F('block', where(i, 'priceCard', 'params.addOns'), '标了"起"价（menu 布局），缺 addOns', '补 addOns: [{"cond":"...","extra":"..."}]'));
    });
  }
  return out;
}

// ---- beforeAfterConsent：美业专用，consent/retouched/subVertical 缺一不可 ----
export function beforeAfterConsent(sb) {
  const out = [];
  for (const {i, shot} of shotsOfType(sb, 'beforeAfter')) {
    const p = shot.params ?? {};
    if (p.consent !== true) out.push(F('block', where(i, 'beforeAfter', 'params.consent'), '没有 consent:true（顾客书面授权）', '没有授权就不能用这个顾客的前后对比，换一组或改用 steps 镜头展示过程'));
    if (p.retouched !== false) out.push(F('block', where(i, 'beforeAfter', 'params.retouched'), 'retouched 必须明确为 false（未修图）', '确认未修图后写 "retouched": false；修过图的照片不能用'));
    if (!['hair', 'nail', 'lash'].includes(p.subVertical)) out.push(F('block', where(i, 'beforeAfter', 'params.subVertical'), `subVertical「${p.subVertical}」不允许（只能 hair/nail/lash）`, 'skincare 不能用 beforeAfter，换成 steps 展示护理过程'));
    if (!p.before?.src || !p.after?.src) out.push(F('block', where(i, 'beforeAfter', 'params'), '缺少 before.src 或 after.src', '两张照片都要有'));
  }
  return out;
}

// ---- syllabusSum：大纲课时之和要能自洽（无 brief 时和同镜头 facts 里的总课时对照）----
export function syllabusSum(sb) {
  const out = [];
  for (const {i, shot} of shotsOfType(sb, 'factSheet')) {
    if (shot.params?.layout !== 'syllabus') continue;
    const rows = shot.params?.rows ?? [];
    const sum = rows.reduce((s, r) => s + (Number(r?.lessons) || 0), 0);
    const totalFact = (shot.params?.facts ?? []).find((f) => /总课时/.test(f?.label ?? ''));
    if (totalFact) {
      const stated = parseInt(String(totalFact.value).replace(/[^\d]/g, ''), 10);
      if (Number.isFinite(stated) && stated !== sum) out.push(F('block', where(i, 'factSheet', 'params.rows'), `各章节 lessons 之和是 ${sum}，和 facts 里"${totalFact.label}"写的 ${totalFact.value} 对不上`, '改 rows 或改 facts，两处要一致'));
    } else {
      out.push(F('human', where(i, 'factSheet', 'params.rows'), '大纲课时之和无法和总课时对照（没有 facts 里的"总课时"条目）', '建议在 params.facts 里补一条 {"label":"总课时","value":"' + sum + '节"}，或人工核对是否和详情页一致'));
    }
  }
  return out;
}

// ---- credVerbatim / reviewVerbatim：需要逐字比对简报原文，暂无 brief 加载器，降级为人工复核 ----
export function credVerbatim(sb) {
  const out = [];
  for (const {i, shot} of shotsOfType(sb, 'credCard')) {
    if (shot.params?.layout !== 'person') continue;
    const creds = shot.params?.creds ?? [];
    if (!creds.length) out.push(F('block', where(i, 'credCard', 'params.creds'), '缺少 creds（资历条目）', '至少写 1 条，必须逐字出自简报'));
    else out.push(F('human', where(i, 'credCard', 'params.creds'), 'creds 需要逐字出自简报的资历字段，当前没有 brief 可自动比对', '发布前人工核对每条 creds 和简报原文一字不差'));
  }
  return out;
}

export function reviewVerbatim(sb) {
  const out = [];
  for (const {i, shot} of shotsOfType(sb, 'reviewCard')) {
    (shot.params?.quotes ?? []).forEach((q, k) => {
      if (!q?.month) out.push(F('block', where(i, 'reviewCard', `params.quotes[${k}].month`), '缺少 month（评价月份）', '补 YYYY-MM'));
    });
    if (!shot.params?.evidence) out.push(F('block', where(i, 'reviewCard', 'params.evidence'), '缺少 evidence（评价截图路径，不上屏）', '补上截图路径'));
    if ((shot.params?.quotes ?? []).length) out.push(F('human', where(i, 'reviewCard', 'params.quotes'), 'text 需要是评价截图原文的子串，当前没有 brief.reviews 可自动比对', '发布前人工核对每条摘录和原评价一致，没有改写得更夸张'));
  }
  return out;
}

// ---- routeHasMode：字幕出现"X分钟"要连着写交通方式 ----
export function routeHasMode(sb, ctx) {
  const out = [];
  const MODE_RE = /步行|驾车|打车|公交|地铁|骑行|接驳车/;
  for (const t of indexTexts(sb, ctx)) {
    if (/\d+\s*分钟/.test(t.text) && !MODE_RE.test(t.text) && t.shotType !== 'storeCard')
      out.push(F('block', t.where, `「${t.text}」写了时长但没有交通方式`, '同一句里补上交通方式，如"驾车约25分钟"'));
  }
  return out;
}

const SEASON_RE = /云海|雾凇|雪景|日出|日落|晚霞|星空|银河|萤火虫|花海|花期|油菜花|樱花|桃花|红叶|银杏|稻田|极光/;

// ---- seasonalMonth：季节景观照片要标月份，并提醒"视天气而定" ----
export function seasonalMonth(sb, ctx) {
  const out = [];
  const hasCaveat = (ctx.meta?.notices ?? []).some((n) => /视天气|季节而定/.test(n)) || /视天气|季节而定/.test(ctx.meta?.disclaimer ?? '');
  for (const t of indexTexts(sb, ctx)) {
    if (!SEASON_RE.test(t.text)) continue;
    const shot = t.shot;
    if (shot?.type === 'photoShot') {
      const media = Array.isArray(shot.params?.media) ? shot.params.media : [];
      if (!media.some((m) => m?.month)) out.push(F('block', where(t.shotIndex, 'photoShot', 'params.media'), `「${t.text}」是季节景观说法，照片缺 month`, '给对应的 media 项补 month（1–12）'));
    }
    if (!hasCaveat) out.push(F('warn', t.where, '出现季节景观说法，建议补充"景观视天气与季节而定"', '加进 meta.notices 或 meta.disclaimer'));
  }
  return out;
}

// ---- textShotRatio：纯文字镜头别太长、别太多 ----
export function textShotRatio(sb, ctx) {
  const out = [];
  const TEXT_TYPES = ['hook', 'counter', 'endCard'];
  const BRIEF_TYPES = ['hook', 'counter']; // endCard 组件本身要求 ≥3 秒（brand+slogan+points+cta），不算在"单个≤2秒"里，只计入占比
  const slots = ctx.slots ?? [];
  let textDur = 0;
  for (const s of slots) {
    if (BRIEF_TYPES.includes(s.type) && s.dur > 2) out.push(F('warn', where(s.i, s.type, ''), `纯文字镜头 ${s.dur} 秒，建议 ≤2 秒`, '缩短，或换成带画面主体的镜头'));
    if (TEXT_TYPES.includes(s.type)) textDur += s.dur;
  }
  const total = slots.length ? slots[slots.length - 1].end : 0;
  if (total > 0 && textDur / total > 0.3) out.push(F('warn', 'shots', `纯文字镜头占全片 ${Math.round((textDur / total) * 100)}%，超过经验值 30%`, '加一镜实拍或模拟界面'));
  return out;
}

// ---- firstPhotoWithin3s：前 3 秒要有实拍 ----
// round5：只有「真实照片」才算实拍——photoShot/storeCard/beforeAfter 里用了素材清单登记为 merchant 的合格文件，或 phone 放了截图；
// 插画兜底的 photoShot 不算。商家压根没有可用实拍时（meta.assets 里没有合格 merchant 文件）不再报这条：
// 那种情况 mediaPolicy 已经给了「按插画兜底」的提醒，再报「前 3 秒没有实拍」只会逼模型去找不存在的照片。
export function firstPhotoWithin3s(sb, ctx) {
  const out = [];
  if (isSpecSelfTest(ctx)) return out;
  if (!usableMerchantAssets(ctx).length) return out;
  const realShots = new Set(usedMerchantPhotos(sb, ctx).map((u) => u.i));
  (sb.shots ?? []).forEach((s, i) => {
    if (s?.type === 'phone' && s.params?.src) realShots.add(i);
  });
  const slot = (ctx.slots ?? []).find((s) => realShots.has(s.i));
  if (!slot || slot.start > 3) out.push(F('warn', 'shots', '素材清单里有商家实拍，但前 3 秒内没有出现（插画兜底的 photoShot 不算实拍）', '把用了商家实拍的镜头往前挪到 3 秒内，或在前 3 秒内插一镜'));
  return out;
}

// ---- chatDisclaimer：非软件行业用了 chat，disclaimer 要写"演示/模拟" ----
export function chatDisclaimer(sb, ctx) {
  const out = [];
  const hasChat = (sb.shots ?? []).some((s) => s?.type === 'chat');
  if (!hasChat) return out;
  const d = ctx.meta?.disclaimer ?? '';
  if (!/演示|模拟/.test(d)) out.push(F('block', 'meta.disclaimer', '用了 chat 镜头，但 meta.disclaimer 没有写"演示"或"模拟"', '补一句，如"情景演示，对话为模拟"'));
  return out;
}

// ---- rejectBrief：整份拒绝的品类（K12、医美等），扫全片文字 ----
export function rejectBrief(sb, ctx, rules) {
  const out = [];
  for (const rule of rules.rejectBrief ?? []) {
    let re;
    try {
      re = new RegExp(rule.regex);
    } catch {
      continue;
    }
    const hit = indexTexts(sb, ctx).find((t) => re.test(t.text)) || (rule.regex && ctx.meta?.action && re.test(ctx.meta.action) ? {where: 'meta.action', text: ctx.meta.action} : null);
    if (hit) out.push(F('block', hit.where, `「${hit.text}」命中整份拒绝规则：${rule.message}`, cite('这个行业不支持这类内容，整份分镜需要重写或换成合适的行业', rule.source)));
  }
  return out;
}

// ---- requiredNotices：合并后的必备提示语要覆盖到 ----
export function requiredNotices(sb, ctx, rules) {
  const out = [];
  const shotTypes = (sb.shots ?? []).map((s) => s?.type);
  const have = [...(ctx.meta?.notices ?? []), ctx.meta?.disclaimer ?? ''].join(' | ');
  for (const n of rules.requiredNotices ?? []) {
    if (!evalWhen(n.when, {meta: ctx.meta, shotTypes})) continue;
    // 英文片（meta.lang=en）画面上不能有汉字：规则给了 textEn 时，写英文版提示语也算覆盖到
    const en = ctx.meta?.lang === 'en' && n.textEn;
    if (!have.includes(n.text) && !(en && have.includes(n.textEn)))
      out.push(F('block', 'meta.notices', en ? `Missing required notice "${n.textEn}"` : `缺少必备提示语「${n.text}」`, en ? `Add it to meta.notices, e.g. ["${n.textEn}"]` : `加进 meta.notices，如 ["${n.text}"]`));
  }
  return out;
}

// ---- priceInternalConsistency：同一 itemId 前后价格要一致（没有 brief 时只能自洽性核对）----
export function priceInternalConsistency(sb) {
  const out = [];
  const byId = new Map();
  for (const {i, shot} of shotsOfType(sb, 'priceCard')) {
    for (const it of shot.params?.items ?? []) {
      if (!it?.itemId) continue;
      const prev = byId.get(it.itemId);
      if (prev !== undefined && prev.price !== it.price) out.push(F('block', where(i, 'priceCard', `params.items[itemId=${it.itemId}]`), `itemId "${it.itemId}" 前面写的价格是 ${prev.price}，这里是 ${it.price}`, '统一成一个价格'));
      byId.set(it.itemId, it);
    }
  }
  return out;
}

export const REGISTRY = {
  mediaPolicy,
  evidenceRefs,
  priceHasUnit,
  compareHasBasis,
  discountMath,
  promoHasPeriod,
  netPriceConditions,
  giftHasQty,
  extraFeesRequired,
  fromNeedsNote,
  beforeAfterConsent,
  syllabusSum,
  credVerbatim,
  reviewVerbatim,
  routeHasMode,
  seasonalMonth,
  textShotRatio,
  firstPhotoWithin3s,
  chatDisclaimer,
  rejectBrief,
  requiredNotices,
  priceMatchesBrief: priceInternalConsistency,
  // round5（对照 p2r2 两份评审）：
  assetTruth, // 素材真实性：before≠after、meta.assets 登记来源、实拍字样只配 merchant、占位/示例图直接拦
  compareDirection, // compare 刻度方向：tone=good 那栏在 meterLabel/higherIs 这把尺子上必须更优
  coreActionSurface, // 核心动作在产品自己的样子里演：软件用界面不用表单，实物/门店用照片或插画不编 App
  priceConditions, // 价格条件不许丢：周末/节假日价、券后、加价、有效期、预约、附加费金额
};
