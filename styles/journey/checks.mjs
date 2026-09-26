// ============================================================
// journey（角色漫游）的跨字段规则。validate.mjs 通过 scripts/lib/styles.mjs 的 runStyleRules 调用 run(sb, ctx)。
//   J1 街区 4–6 个（3 个只提醒，少于 3 或多于 6 拦截）
//   J2 相邻街区的 scene 不能一样（笑点要轮换，拆解里「不重复是它耐看的关键」）
//   J3 类别名 category 全片不重复（路牌、胶囊、片尾 chips 都用它）
//   J4 钩子 headline 要带数字（「5 个新功能」），不带只提醒
//   J5 片尾 brand = meta.product；cta 照抄 meta.cta
//   J6 片尾 stats 的数字必须在 meta.facts 里原样出现
//   J7 district 必须连续地夹在 opening 和 finale 之间
//   J8 价格和时间（N 元 / ¥N / HH:MM / N 小时 / N 分钟 / N 晚）必须在 meta.facts 里原样出现
//   J9 钩子大字里的数字要么等于街区数，要么在 meta.facts 里出现
//   J10 夜景街区（neon / lantern）不是最后一站时提醒（只有最后一站是夜景）
//   J11 街区要配得上背景天际线（opening.params.skyline）：古城街区只在 oldtown 里，现代道具不进古城（按 tokens.json 的 scenes.*.fits）
//   J12 文旅题材写到古城 / 古镇 / 老街 / 水乡，skyline 必须是 oldtown（不然满屏玻璃高楼）
//   J13 类别名像被截断的半个词（「预算提」而 title / facts 里是「预算提醒」）提醒
//   J14 钩子大字照搬句式读不通（「N 个账本街」、带产品名）提醒
//   J15 广告牌标题超过 10 字又没有停顿（逗号、空格）提醒
//   J16 片尾既没有数字（stats）也没有获取方式（cta）提醒
//   J17 meta.notices / disclaimer 里的日期必须在 meta.facts 里原样出现（活动日期不能自己编）；有促销字眼时由公共检查 promoHasPeriod 报，这里不重复
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROMO_RE} from '../../scripts/checks/promo-words.mjs';

const s = (v) => (typeof v === 'string' ? v.trim() : '');
const HERE = path.dirname(fileURLToPath(import.meta.url));
/** 街区类型表（fits / night）以组件令牌为准：template/src/styles/journey/tokens.json */
const SCENES = (() => {
  try {
    const tk = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'template', 'src', 'styles', 'journey', 'tokens.json'), 'utf8'));
    return Object.fromEntries(Object.entries(tk.scenes ?? {}).filter(([k]) => !k.startsWith('$')));
  } catch {
    return {};
  }
})();
const SKYLINE_NAME = {modern: '现代城市', street: '低层街巷', oldtown: '古城'};
const scenesFor = (sk) => Object.entries(SCENES).filter(([, v]) => (v.fits ?? ['modern', 'street']).includes(sk)).map(([k]) => k);
const CJK = /[\u4e00-\u9fff]/;
const PUNCT = /[，,。！？!?、；;：:\s·—–\-~～…]/;

export function run(sb, ctx) {
  const errors = [];
  const warnings = [];
  const human = [];
  const shots = Array.isArray(sb?.shots) ? sb.shots : [];
  const meta = sb?.meta ?? {};
  const W = (i, f) => ctx.where(i, shots[i]?.type, f);
  const dIdx = shots.map((x, i) => (x?.type === 'district' ? i : -1)).filter((i) => i >= 0);
  const opIdx = shots.findIndex((x) => x?.type === 'opening');
  const skyline = s(shots[opIdx]?.params?.skyline) || 'modern';

  // J1
  if (dIdx.length < 3 || dIdx.length > 6)
    errors.push({where: 'shots', problem: `街区（district）有 ${dIdx.length} 个，这个风格要 4–6 个`, fix: dIdx.length < 3 ? '按产品的类别 / 功能 / 卖点补到 4 个街区' : '合并相近的类别，删到 6 个以内'});
  else if (dIdx.length === 3) warnings.push({where: 'shots', problem: '只有 3 个街区，片子偏短、类别感弱', fix: '最好 4–6 个街区'});

  // J2 / J3
  const seen = new Map();
  dIdx.forEach((i, n) => {
    const p = shots[i]?.params ?? {};
    if (n > 0) {
      const prev = shots[dIdx[n - 1]]?.params ?? {};
      if (s(p.scene) && s(p.scene) === s(prev.scene))
        errors.push({where: W(i, 'params.scene'), problem: `和上一个街区都是「${s(p.scene)}」，笑点重复`, fix: `换一种街区类型（${scenesFor(skyline).join(' / ')}），相邻不要一样`});
    }
    const c = s(p.category);
    if (c && seen.has(c)) errors.push({where: W(i, 'params.category'), problem: `类别名「${c}」和第 ${seen.get(c) + 1} 镜重复`, fix: '每个街区写一个不同的类别名'});
    else if (c) seen.set(c, i);
  });

  // J4
  shots.forEach((x, i) => {
    if (x?.type !== 'opening') return;
    const h = s(x.params?.headline);
    if (h && !/[0-9０-９一二三四五六七八九十百千万两]/.test(h))
      warnings.push({where: W(i, 'params.headline'), problem: `钩子大字「${h}」里没有数字`, fix: '写成「数字 + 单位」，如「5 个新功能」，说清这趟要逛多少东西'});
  });

  // J5 / J6
  const product = s(meta.product);
  const metaCta = s(meta.cta);
  const facts = Array.isArray(meta.facts) ? meta.facts.map((f) => `${s(f?.text)} ${s(f?.quote)}`) : [];
  shots.forEach((x, i) => {
    if (x?.type !== 'finale') return;
    const p = x.params ?? {};
    const brand = s(p.brand);
    if (product && brand && brand !== product) errors.push({where: W(i, 'params.brand'), problem: `片尾产品名「${brand}」和 meta.product「${product}」不一致`, fix: `brand 写成「${product}」，一字不差`});
    const cta = s(p.cta);
    if (cta && !metaCta) errors.push({where: W(i, 'params.cta'), problem: '写了 cta，但 meta.cta 是空的：获取方式不能自己编', fix: '简报「获取方式」那栏有内容就原样写进 meta.cta，这里照抄；没有就删掉 cta'});
    else if (cta && cta !== metaCta) errors.push({where: W(i, 'params.cta'), problem: `cta「${cta}」和 meta.cta「${metaCta}」不一致`, fix: `原样写成「${metaCta}」`});
    else if (!cta && metaCta) warnings.push({where: W(i, 'params.cta'), problem: '简报给了获取方式，片尾却没放', fix: `补上 "cta": "${metaCta}"`});
    (Array.isArray(p.stats) ? p.stats : []).forEach((st, k) => {
      const v = s(st?.value);
      if (!v) return;
      if (!facts.some((f) => f.includes(v)))
        errors.push({where: W(i, `params.stats[${k}].value`), problem: `数字「${v}」在 meta.facts 里找不到（没有简报依据）`, fix: '只用简报「数字和来源」栏里的数字：先原样抄进 meta.facts（带 source），这里再写；简报没给数字就删掉 stats'});
    });
  });

  // J8 价格和时间只能抄简报：分镜任何文字里的「N 元 / ¥N / HH:MM / N 小时 / N 分钟 / N 晚」都必须在 meta.facts 里原样出现
  const factText = facts.join(' ').replace(/\s+/g, '').replace(/：/g, ':');
  const PT = /(?:[¥￥]\s*\d+(?:\.\d+)?)|(?:\d+(?:\.\d+)?\s*(?:元|块钱|块))|(?:\d{1,2}[:：]\d{2})|(?:\d+(?:\.\d+)?\s*(?:个)?(?:小时|分钟|晚))/g;
  shots.forEach((x, i) => {
    const p = x?.params ?? {};
    for (const [k, v] of Object.entries(p)) {
      if (typeof v !== 'string') continue;
      for (const m of v.match(PT) ?? []) {
        if (!factText.includes(m.replace(/\s+/g, '').replace(/：/g, ':')))
          errors.push({where: W(i, `params.${k}`), problem: `「${m}」是价格或时间，但 meta.facts 里没有这一条（没有简报依据）`, fix: '价格、营业时间、时长只能抄简报：先把简报原句写进 meta.facts（带 source），这里的写法要和 facts 一字不差；简报没给就删掉这个数'});
      }
    }
  });

  // J9 钩子大字里的数字：要么等于街区数，要么在 meta.facts 里原样出现（「600 篇」这类总量不能自己编）
  shots.forEach((x, i) => {
    // 街区数不在范围里时 J1 已经报了，这里不跟着误报（镜头 spec 自检只拼了一两镜）
    if (x?.type !== 'opening' || dIdx.length < 3) return;
    for (const num of s(x.params?.headline).match(/\d+(?:\.\d+)?/g) ?? []) {
      if (Number(num) === dIdx.length) continue;
      // 整个数字匹配：「30」不能算在「6:30」里
      if (!new RegExp(`(?<![\\d.:：])${num.replace('.', '\\.')}(?![\\d.:：])`).test(factText))
        errors.push({where: W(i, 'params.headline'), problem: `钩子大字里的「${num}」既不是街区数（${dIdx.length}），也不在 meta.facts 里`, fix: `写成街区数，如「${dIdx.length} 个站」；要写总量（篇数、用户数）就先把简报原句抄进 meta.facts`});
    }
  });

  // J10 夜景街区（霓虹街、灯会）放在白天的站会很怪：只提醒
  dIdx.forEach((i, n) => {
    const sc = s(shots[i]?.params?.scene);
    if (SCENES[sc]?.night && n !== dIdx.length - 1)
      warnings.push({where: W(i, 'params.scene'), problem: `「${sc}」是夜景街区，但不是最后一站：天色只有最后一站是夜，灯和霓虹在白天不亮`, fix: `把 ${sc} 挪到最后一个街区，或换成别的街区类型`});
  });

  // J11 街区和背景天际线要配得上：古城里不出现发射塔、服务器；现代城市里不冒出城门
  if (opIdx >= 0 && shots[opIdx]?.params?.skyline !== undefined && !SKYLINE_NAME[skyline])
    errors.push({where: W(opIdx, 'params.skyline'), problem: `背景「${skyline}」不存在`, fix: '写 modern（现代城市，默认）/ street（低层街巷）/ oldtown（古城）'});
  else
    dIdx.forEach((i) => {
      const sc = s(shots[i]?.params?.scene);
      const fits = SCENES[sc]?.fits;
      if (sc && Array.isArray(fits) && !fits.includes(skyline))
        errors.push({where: W(i, 'params.scene'), problem: `「${sc}」的道具和${SKYLINE_NAME[skyline]}背景（skyline: ${skyline}）对不上`, fix: `${SKYLINE_NAME[skyline]}里能用的街区：${scenesFor(skyline).join(' / ')}；要用「${sc}」就把 opening.params.skyline 改成 ${fits.join(' 或 ')}`});
    });

  // J12 文旅写到古城古镇，背景必须是古城
  const blob = [meta.product, meta.action, meta.title, ...(Array.isArray(meta.facts) ? meta.facts.map((f) => f?.text) : []), ...dIdx.map((i) => `${s(shots[i]?.params?.category)} ${s(shots[i]?.params?.title)}`)].map(s).join(' ');
  const oldWord = /古城|古镇|老街|古街|水乡|古村|老城/.exec(blob);
  if (s(meta.industry) === 'travel' && oldWord && skyline !== 'oldtown')
    errors.push({where: opIdx >= 0 ? W(opIdx, 'params.skyline') : 'shots', problem: `题材是「${oldWord[0]}」，背景却是${SKYLINE_NAME[skyline] ?? skyline}（满屏现代楼房，会误导观众）`, fix: '在 opening.params 里写 "skyline": "oldtown"，街区从 gate / bridge / teahouse / lantern / market 里选'});

  // J13 类别名被截成半个词：title / tag / source / meta.action / facts 里有「类别名 + 1 个汉字」的更长写法
  const ctxText = [meta.action, ...(Array.isArray(meta.facts) ? meta.facts.map((f) => f?.text) : [])].map(s).join(' ');
  dIdx.forEach((i) => {
    const p = shots[i]?.params ?? {};
    const c = s(p.category);
    if (!c || !CJK.test(c)) return;
    const pool = `${s(p.title)} ${s(p.tag)} ${s(p.source)} ${ctxText}`;
    const m = new RegExp(`${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\u4e00-\\u9fff])`).exec(pool);
    if (m && Array.from(c).length + 1 <= 6 && Array.from(c).length % 2 === 1)
      warnings.push({where: W(i, 'params.category'), problem: `类别名「${c}」像被截断的词（文案里写的是「${c}${m[1]}」）；它会出现在路牌、胶囊、广告牌表头和片尾标签 4 个地方`, fix: `写完整：「${c}${m[1]}」。类别名 4 字最好，6 字以内组件都放得下，不要为了凑字数截断`});
  });

  // J14 钩子大字照搬句式：「N 个账本街」读不通；带产品名也不行
  shots.forEach((x, i) => {
    if (x?.type !== 'opening') return;
    const h = s(x.params?.headline);
    const prod = s(meta.product);
    if (/街$/.test(h) || (prod && prod.length >= 2 && h.includes(prod)))
      warnings.push({where: W(i, 'params.headline'), problem: `钩子大字「${h}」读不通：观众看不出这趟逛的是什么`, fix: '按题材套句式：内容站「N 篇精选」「N 个栏目」，软件「N 个功能」，文旅「N 站慢游」，门店「N 家店」；产品名不用写进大字（左上角胶囊和片尾都有）'});
  });

  // J15 广告牌标题太长又没停顿，一口气读不下来
  dIdx.forEach((i) => {
    const t = s(shots[i]?.params?.title);
    if (Array.from(t).length > 10 && !PUNCT.test(t))
      warnings.push({where: W(i, 'params.title'), problem: `标题「${t}」${Array.from(t).length} 字没有停顿，一口气读不下来`, fix: '在意群之间加逗号（「一本账本，全家一起看」），或把一半挪到 tag / source；广告牌每行约 12 字'});
  });

  // J16 片尾没有数字也没有获取方式：落版只剩口号
  shots.forEach((x, i) => {
    if (x?.type !== 'finale') return;
    const p = x.params ?? {};
    if (!(Array.isArray(p.stats) && p.stats.length) && !s(p.cta))
      warnings.push({where: W(i, 'params.stats'), problem: '片尾既没有数字卡（stats）也没有获取方式（cta），落版只剩一句口号', fix: '简报有获取方式就写 meta.cta 并照抄到 cta；没有真实数据时可以用 facts 里的计数，如「6 个功能」（先把「共 6 个功能」写进 meta.facts）'});
  });

  // J17 提示条 / 免责里的日期必须有简报依据：为了过「促销要写期限」编一条活动日期是捏造
  const DATE = /\d{1,2}\s*月\s*\d{1,2}\s*日|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g;
  const allText = JSON.stringify({m: [meta.notices, meta.disclaimer, meta.title], p: shots.map((x) => x?.params)});
  if (!PROMO_RE.test(allText))
  [...(Array.isArray(meta.notices) ? meta.notices.map((n, k) => [`meta.notices[${k}]`, n]) : []), ['meta.disclaimer', meta.disclaimer]].forEach(([wh, v]) => {
    for (const d of s(v).match(DATE) ?? [])
      if (!factText.includes(d.replace(/\s+/g, '')))
        errors.push({where: wh, problem: `日期「${d}」在 meta.facts 里找不到：活动日期不能自己编`, fix: '不是真实活动就删掉这条（连同触发它的促销字眼）；真有活动，先把简报原句抄进 meta.facts（带 source），这里一字不差地写'});
  });

  // J7
  const first = shots.findIndex((x) => x?.type === 'opening');
  const last = shots.findIndex((x) => x?.type === 'finale');
  if (first >= 0 && last >= 0)
    dIdx.forEach((i) => {
      if (i < first || i > last) errors.push({where: W(i, 'type'), problem: '街区要放在 opening 和 finale 之间', fix: '顺序：opening → district × 4–6 → finale'});
    });
  return {errors, warnings, human};
}