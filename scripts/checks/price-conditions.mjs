// ============================================================
// priceConditions：价格条件不许丢——画面上的价格要带着 meta.facts（简报原话）里它附带的条件一起出现。
//
// 评审案例：
//   · 文旅：简报「周日至周四 368 元/晚，周五周六 468 元/晚，法定节假日 598 元/晚」，
//     compare 写成「周一到周四 368元 / 周五六日 468元」（周日被算成周末价），priceCard 只剩 368，468/598 没上屏；
//     「另收：加床、宠物清洁费另计」丢了金额（加床100元/晚、清洁费80元/晚）；「灵活退房」藏掉了延迟退房加 50 元。
//   · 电商：简报「领 20 元店铺券后 59 元/只」，片尾写「现价59元」。
//
// 做法（没有 brief 加载器，以 meta.facts 为准；facts 必须是简报原话，见 schema.ts）：
//   1. 把每条 fact 切成「段（；。）→ 小句（，）」，认出主价格、它自己的日期段（周日至周四/周末/节假日…）、同段的兄弟价格、
//      券后条件、加价小句、有效期、预约、不可用、限堂食等条件。
//   2. priceCard 每个 items[].price 对上 fact 的主价格时，同一镜（含 meta.notices 底部提示条）必须能看到这些条件，缺了就拦。
//   3. 其他镜头文字里出现「N元/¥N」且对上主价格：券后条件、适用日期不许丢；写出来的日期段和简报不一致就拦。
//   4. 提到加床/清洁费/押金/锅底这类附加费，简报里有金额就必须写金额；「灵活退房」这类说法遇到简报里有固定时间或加价就拦。
// 已知限制：同一价格拆成两条 fact（如 368 一条、468 一条）时认不出它们是兄弟价格；facts 里没抄的条件核对不了。
// ============================================================
import {where, mkFinding as F} from './util.mjs';
import {shotStrings} from './assets.mjs';

const DAYMAP = {一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0};
const DAY_RE = /(?:周|星期)[一二三四五六日天](?:\s*(?:至|到|-|—|–|~|～|、|和|及|与|\/)?\s*(?:周|星期)?[一二三四五六日天])*|周末|平日|工作日|法定节假日|节假日|法定假日|节日|假期|春节|国庆/g;
const COUPON_RE = /领.{0,8}券|券后|用券|满\s*\d+\s*减|满减|立减|会员价|新客价|首单价/;
const SURCHARGE_RE = /加收|另收|另付|加价|附加|[加＋+]\s*\d/;
const VALIDITY_RE = /至|到|前|截至|截止|有效|期间|活动|~|～|—|–/;
const BOOKING_RE = /提前\s*\d+\s*(?:天|日|小时)\s*预约|需预约|提前预约|须预约/;
const UNAVAIL_RE = /不可用|不可使用|不适用|不能用|除外/;
const LIMIT_RE = /限堂食|仅限堂食|不可外带|限\s*(\d+)\s*人/;
const FEE_NAMES = ['加床', '清洁费', '押金', '服务费', '接站', '接送', '茶位费', '餐位费', '锅底费', '锅底', '停车费', '打包费', '配送费', '延迟退房', '延时退房', '开瓶费', '包间费', '餐具费'];
const FLEX_RE = /灵活退房|随时退房|退房不限|退房自由|灵活入住|随时入住|入住不限/;

const fmt = (n) => String(Math.round(n * 100) / 100);

function parseDay(txt) {
  if (/周末/.test(txt)) return {kind: 'weekend', text: txt};
  if (/平日|工作日/.test(txt)) return {kind: 'weekday', text: txt};
  if (/节|假|春节|国庆/.test(txt)) return {kind: 'holiday', text: txt};
  const s = txt.replace(/星期|周/g, '');
  const days = new Set();
  let prev = null;
  let range = false;
  for (const ch of s) {
    if (ch in DAYMAP) {
      const d = DAYMAP[ch];
      if (range && prev !== null) {
        let x = prev;
        let guard = 0;
        while (x !== d && guard++ < 7) {
          x = (x + 1) % 7;
          days.add(x);
        }
      } else days.add(d);
      prev = d;
      range = false;
    } else if (/[至到\-—–~～]/.test(ch)) range = true;
  }
  return {kind: 'set', days, text: txt};
}
const cnt = (set, arr) => arr.filter((d) => set.has(d)).length;
const bucket = (x) => (x.kind !== 'set' ? x.kind : !x.days.has(6) && cnt(x.days, [1, 2, 3, 4]) >= 3 ? 'weekday' : (x.days.has(5) || x.days.has(6)) && cnt(x.days, [1, 2, 3, 4]) === 0 ? 'weekend' : 'other');
function compat(a, b) {
  if (a.kind === 'set' && b.kind === 'set') return a.days.size === b.days.size && [...a.days].every((d) => b.days.has(d));
  if (a.kind === 'holiday' || b.kind === 'holiday') return a.kind === b.kind;
  return bucket(a) === bucket(b);
}

/** 按出现顺序切出日期段和价格；surcharge=前面带 + / 加 / 另收 的金额 */
function tokenize(str) {
  const s = String(str ?? '');
  const toks = [];
  for (const m of s.matchAll(DAY_RE)) toks.push({type: 'day', ...parseDay(m[0]), idx: m.index, end: m.index + m[0].length});
  const taken = new Set();
  const addPrice = (value, idx, end, surcharge) => {
    if (taken.has(idx)) return;
    taken.add(idx);
    toks.push({type: 'price', value: Number(value), idx, end, surcharge});
  };
  for (const m of s.matchAll(/(?:[+＋]|加收?|另收)\s*(\d+(?:\.\d+)?)(?:\s*(?:元|块))?/g)) addPrice(m[1], m.index + m[0].indexOf(m[1]), m.index + m[0].length, true);
  for (const m of s.matchAll(/(?:¥|￥)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:元|块)/g)) {
    const v = m[1] ?? m[2];
    addPrice(v, m.index + m[0].indexOf(v), m.index + m[0].length, false);
  }
  // 日期段后面直接跟的裸数字（「周日至周四 398，周五周六 498」）
  for (const d of toks.filter((t) => t.type === 'day')) {
    const m = /^\s*[:：]?\s*(\d+(?:\.\d+)?)(?![\d.]|\s*(?:月|日|年|天|晚|人|张|个|点|号|㎡|平|米|小时|分钟|%|:|：|岁|间|位|层|次|折))/.exec(s.slice(d.end));
    if (m) addPrice(m[1], d.end + m[0].indexOf(m[1]), d.end + m[0].length, false);
  }
  return toks.sort((a, b) => a.idx - b.idx);
}

/** 每个价格 token 配一个日期段：同一句里，它前面（上一个价格之后）最近的日期段，没有就取它后面（下一个价格之前）的 */
function pairDays(toks) {
  const res = [];
  toks.forEach((t, k) => {
    if (t.type !== 'price') return;
    let day = null;
    for (let j = k - 1; j >= 0 && toks[j].type !== 'price'; j--) if (toks[j].type === 'day') {
      day = toks[j];
      break;
    }
    if (!day) for (let j = k + 1; j < toks.length && toks[j].type !== 'price'; j++) if (toks[j].type === 'day') {
      day = toks[j];
      break;
    }
    res.push({price: t, day});
  });
  return res;
}

function extractDates(s) {
  const out = [];
  const seen = [];
  const push = (idx, len, M, D) => {
    if (seen.some(([a, b]) => idx < b && idx + len > a)) return;
    seen.push([idx, idx + len]);
    out.push({idx, M: Number(M), D: Number(D)});
  };
  for (const m of s.matchAll(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?/g)) push(m.index, m[0].length, m[2], m[3]);
  for (const m of s.matchAll(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/g)) push(m.index, m[0].length, m[1], m[2]);
  for (const m of s.matchAll(/(?:至|到|~|～|—|–)\s*(\d{1,2})[-/.](\d{1,2})(?!\d)/g)) push(m.index, m[0].length, m[1], m[2]);
  return out.filter((d) => d.M >= 1 && d.M <= 12 && d.D >= 1 && d.D <= 31).sort((a, b) => a.idx - b.idx);
}

function analyzeClause(text) {
  const toks = tokenize(text);
  const prices = toks.filter((t) => t.type === 'price');
  const isCoupon = COUPON_RE.test(text);
  const isSurcharge = !isCoupon && SURCHARGE_RE.test(text);
  let main = [];
  let sur = prices.filter((p) => p.surcharge);
  if (isCoupon) main = prices.filter((p) => !p.surcharge).slice(-1);
  else if (isSurcharge) sur = prices;
  else main = prices.filter((p) => !p.surcharge);
  return {text, toks, main, sur, isCoupon, days: toks.filter((t) => t.type === 'day'), dates: extractDates(text), unavailable: UNAVAIL_RE.test(text)};
}

/** facts → 主价格记录 */
export function analyzeFacts(facts) {
  const recs = [];
  for (const f of Array.isArray(facts) ? facts : []) {
    const text = typeof f?.text === 'string' ? f.text : '';
    if (!text) continue;
    const segs = text.split(/[；;。\n]/).map((s) => s.trim()).filter(Boolean).map((seg) => ({seg, clauses: seg.split(/[，,]/).map((c) => c.trim()).filter(Boolean).map(analyzeClause)}));
    for (const s of segs) s.hasMain = s.clauses.some((c) => c.main.length);
    const shared = segs.filter((s) => !s.hasMain);
    for (const s of segs) {
      for (const c of s.clauses) {
        for (const p of c.main) {
          const around = [s, ...shared];
          const allClauses = around.flatMap((x) => x.clauses);
          // 自己的日期段：本小句里的；没有就找共享段里「周日至周四可用」这种不带价格、不是「不可用」的小句
          let own = pairDays(c.toks).find((x) => x.price === p)?.day ?? null;
          let ownClause = c.text;
          if (!own) {
            const cl = shared.flatMap((x) => x.clauses).find((x) => x.days.length && !x.main.length && !x.sur.length && !x.unavailable && /可用|适用|入住|使用|仅/.test(x.text));
            if (cl) {
              own = cl.days[0];
              ownClause = cl.text;
            }
          }
          const siblings = [];
          for (const c2 of s.clauses) for (const p2 of c2.main) {
            if (p2 === p) continue;
            const d2 = pairDays(c2.toks).find((x) => x.price === p2)?.day ?? null;
            if (d2 && (!own || !compat(own, d2))) siblings.push({value: p2.value, day: d2, text: c2.text});
          }
          const surcharges = [];
          for (const c2 of s.clauses) for (const p2 of c2.sur) surcharges.push({value: p2.value, text: c2.text});
          for (const x of shared) for (const c2 of x.clauses) if (c2.sur.length && c2.days.length) for (const p2 of c2.sur) surcharges.push({value: p2.value, text: c2.text});
          const validity = allClauses.filter((x) => x.dates.length && VALIDITY_RE.test(x.text));
          const deadline = validity.length ? validity[validity.length - 1] : null;
          recs.push({
            factId: f.id,
            factText: text,
            value: p.value,
            clause: c.text,
            own,
            ownClause,
            coupon: c.isCoupon ? c.text : null,
            siblings,
            surcharges,
            deadline: deadline ? {...deadline.dates[deadline.dates.length - 1], text: deadline.text} : null,
            booking: allClauses.find((x) => BOOKING_RE.test(x.text))?.text ?? null,
            unavailable: allClauses.filter((x) => x.unavailable).map((x) => x.text),
            limit: (() => {
              const x = allClauses.find((y) => LIMIT_RE.test(y.text));
              if (!x) return null;
              const m = LIMIT_RE.exec(x.text);
              return {text: x.text, key: m[1] ? `${m[1]}人` : '堂食'};
            })(),
          });
        }
      }
    }
  }
  return recs;
}

const hasNum = (pool, n) => new RegExp(`(?<![\\d.])${fmt(n).replace('.', '\\.')}(?![\\d])`).test(pool);
const hasDate = (pool, M, D) => new RegExp(`(?<!\\d)0?${M}\\s*月\\s*0?${D}(?!\\d)|(?<![\\d.])0?${M}[./-]0?${D}(?![\\d])`).test(pool);
const dayTokens = (pool) => [...String(pool).matchAll(DAY_RE)].map((m) => parseDay(m[0]));

/** 同一价格有多条记录时，挑和商品名最像的那条 */
function pickRec(recs, value, hint) {
  const cands = recs.filter((r) => r.value === value);
  if (cands.length <= 1) return cands[0] ?? null;
  const grams = (s) => new Set([...String(s ?? '')].map((c, k, a) => c + (a[k + 1] ?? '')).filter((g) => g.length === 2));
  const h = grams(hint);
  let best = cands[0];
  let bestScore = -1;
  for (const r of cands) {
    const g = grams(r.factText);
    const score = [...h].filter((x) => g.has(x)).length;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

export function priceConditions(sb, ctx) {
  const out = [];
  const meta = ctx?.meta ?? {};
  const recs = analyzeFacts(meta.facts);
  const shots = Array.isArray(sb?.shots) ? sb.shots : [];
  const metaStrs = [...(Array.isArray(meta.notices) ? meta.notices : []), typeof meta.disclaimer === 'string' ? meta.disclaimer : ''].filter(Boolean);
  const factStrs = (Array.isArray(meta.facts) ? meta.facts : []).map((f) => String(f?.text ?? ''));
  const reported = new Set();
  const emit = (level, w, problem, fix) => {
    const key = `${w}|${problem}`;
    if (reported.has(key)) return;
    reported.add(key);
    out.push(F(level, w, problem, fix));
  };

  shots.forEach((shot, i) => {
    if (!shot || typeof shot !== 'object') return;
    const strs = shotStrings(shot);
    if (shot.type === 'priceCard') {
      (Array.isArray(shot.params?.items) ? shot.params.items : []).forEach((it, k) => {
        if (it && typeof it.price === 'number') strs.push({field: `params.items[${k}]`, text: `${it.name ?? ''} ${it.note ?? ''} ${it.price}元${it.from ? '起' : ''}`, synthetic: true});
      });
    }
    const pool = [...strs.map((s) => s.text), ...metaStrs].join(' | ');

    // ---- 日期段写错（任何镜头）：「周一到周四 368元」vs 简报「周日至周四 368」----
    for (const s of strs) {
      for (const {price, day} of pairDays(tokenize(s.text))) {
        if (price.surcharge || !day) continue;
        const r = pickRec(recs, price.value, s.text);
        if (!r?.own || compat(r.own, day)) continue;
        emit('block', where(i, shot.type, s.field), `「${s.text.trim()}」把 ${fmt(price.value)} 元写成「${day.text}」的价，简报是「${r.clause}」`, `照抄 facts 里的「${r.own.text}」，别自己改日期段（周日算哪一档要和简报一致）`);
      }
    }

    if (shot.type === 'priceCard') {
      const items = Array.isArray(shot.params?.items) ? shot.params.items : [];
      items.forEach((it, k) => {
        if (!it || typeof it.price !== 'number') return;
        const r = pickRec(recs, it.price, `${it.name ?? ''}${it.unit ?? ''}`);
        if (!r) return;
        const W = (f) => where(i, 'priceCard', f);
        const P = fmt(r.value);
        if (r.coupon && !/券|满\s*\d+\s*减|满减|立减/.test(pool))
          emit('block', W('params.conditions'), `${P} 元在简报里是「${r.coupon}」，画面没写领券/满减条件，观众会以为直接就是这个价`, `label 用「券后价」，conditions 照抄条件（如「需领取20元店铺券」）`);
        const sibOk = r.siblings.every((sb2) => hasNum(pool, sb2.value) || hasNum(pool, Math.abs(sb2.value - r.value)));
        if (r.own && !dayTokens(pool).some((d) => compat(d, r.own)) && !(r.siblings.length && sibOk))
          emit('block', W('params.conditions'), `简报里 ${P} 元只适用于「${r.own.text}」（简报：「${r.ownClause}」），画面没写适用日期`, `conditions 或 limits 写上「${r.own.text}」`);
        for (const sb2 of r.siblings) {
          if (hasNum(pool, sb2.value) || hasNum(pool, Math.abs(sb2.value - r.value))) continue;
          const diff = fmt(Math.abs(sb2.value - r.value));
          emit('block', W('params.conditions'), `简报里同一项还有「${sb2.text}」，画面只给了 ${P} 元，${sb2.day.text}的价格丢了`, `在 conditions/limits/addOns 里写上，如「${sb2.day.text}${fmt(sb2.value)}元」或「${sb2.day.text}+${diff}元」；价格多就用 layout:"menu" 分行列出`);
        }
        for (const s2 of r.surcharges) {
          if (hasNum(pool, s2.value)) continue;
          emit('block', W('params.conditions'), `简报写着「${s2.text}」，画面没写这笔加价`, `照写金额，如「${s2.text.replace(/\s+/g, '')}」`);
        }
        if (r.deadline && !hasDate(pool, r.deadline.M, r.deadline.D))
          emit('block', W('params.period'), `简报的有效期是「${r.deadline.text}」，画面没写截止日期（${r.deadline.M}月${r.deadline.D}日）`, `period 写「截至${r.deadline.M}月${r.deadline.D}日」或「起始日–${r.deadline.M}.${r.deadline.D}」`);
        if (r.booking && !/预约/.test(pool)) emit('block', W('params.limits'), `简报写着「${r.booking}」，画面没写预约要求`, `limits 里加一条「${r.booking.replace(/\s+/g, '')}」`);
        for (const u of r.unavailable) if (!/不可用|不可使用|不适用|不能用|除外/.test(pool)) emit('block', W('params.limits'), `简报写着「${u}」，画面没写`, `limits 里照写「${u.replace(/\s+/g, '')}」`);
        if (r.limit && !pool.includes(r.limit.key)) emit('block', W('params.limits'), `简报写着「${r.limit.text}」，画面没写`, `limits 里照写「${r.limit.text.replace(/\s+/g, '')}」`);
      });
    } else {
      // ---- 其他镜头提到价格：券后条件、适用日期不许丢 ----
      for (const s of strs) {
        for (const {price: t, day: paired} of pairDays(tokenize(s.text))) {
          if (t.surcharge) continue;
          const r = pickRec(recs, t.value, s.text);
          if (!r) continue;
          const P = fmt(r.value);
          if (r.coupon && !/券|满\s*\d+\s*减|满减|立减/.test(pool))
            emit('block', where(i, shot.type, s.field), `「${s.text.trim()}」说 ${P} 元，但简报里这个价要满足条件才有（「${r.coupon}」）`, `同一句写清条件，如「领券后${P}元」；放不下就别在这里报价`);
          // 同一句已经带了日期段的，对不对由上面的「日期段写错」判断，这里只管完全没写的
          if (r.own && !paired && !dayTokens(pool).some((d) => compat(d, r.own)) && !/(周末|节假日|节日|假期).{0,6}(另计|另算|加价|不同|另收|上浮|浮动|另)/.test(pool))
            emit('block', where(i, shot.type, s.field), `「${s.text.trim()}」只写了 ${P} 元，简报里这个价只适用于「${r.own.text}」`, `同一句补上「${r.own.text}」，如「${r.own.text}${P}元」`);
        }
      }
    }

    // ---- 附加费只写名目不写金额 / 「灵活退房」----
    for (const s of strs) {
      if (s.synthetic) continue;
      for (const name of FEE_NAMES) {
        if (!s.text.includes(name)) continue;
        if (name === '锅底' && s.text.includes('锅底费')) continue;
        const amounts = [];
        const srcClauses = [];
        for (const ft of factStrs) for (const cl of ft.split(/[，,；;。\n]/)) {
          if (!cl.includes(name)) continue;
          const vals = tokenize(cl).filter((t) => t.type === 'price').map((t) => t.value);
          if (vals.length) {
            amounts.push(...vals);
            srcClauses.push(cl.trim());
          }
        }
        if (amounts.length && !amounts.some((v) => hasNum(pool, v)))
          emit('block', where(i, shot.type, s.field), `「${s.text.trim()}」提到「${name}」，简报写的是「${srcClauses.join('；')}」，画面没写金额`, `写清金额，如「${srcClauses[0].replace(/\s+/g, '').replace(/^(加收|另收)/, '')}」；放不下就删掉这一项，不要只写"另计"`);
      }
      const flex = FLEX_RE.exec(s.text);
      if (flex) {
        const key = /退房/.test(flex[0]) ? '退房' : '入住';
        const cls = factStrs.flatMap((ft) => ft.split(/[，,；;。\n]/)).map((c) => c.trim()).filter((c) => c.includes(key) && (/\d{1,2}\s*[:：点]/.test(c) || SURCHARGE_RE.test(c)));
        if (cls.length) emit('block', where(i, shot.type, s.field), `「${s.text.trim()}」说「${flex[0]}」，简报写的是「${cls.slice(0, 2).join('；')}」，时间是固定的/超时要加钱`, `照写简报的时间和加价，如「${cls.slice(0, 2).map((c) => c.replace(/\s+/g, '')).join('，')}」`);
      }
    }
  });
  return out;
}
