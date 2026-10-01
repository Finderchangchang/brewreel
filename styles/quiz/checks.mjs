// ============================================================
// quiz 风格的跨字段规则（validate.mjs 通过 scripts/lib/styles.mjs 调用）。
// 声明式规则（镜头数、必有镜头、顺序、次数上限、总时长）在 rules.json；字段自己的字数上限、必填、枚举在各镜头的 .spec.json。
// 这里只写「一个字段要和另一个字段对得上」的规则。每条报错都给一句能照做的改法。
// 返回 {errors, warnings, human}，每条 {where, problem, fix}；where 用 ctx.where(i, type, field) 生成。
//
// 规则清单（和 styles/quiz/STYLE.md 第 9 层一一对应）：
//   Q1 选项 2–4 个、不重复；answer 是合法序号
//   Q2 钩子的 guess 必须原样是一个选项（陷阱项），且不是正确答案
//   Q3 错误选项不写阿拉伯数字（会被当成商家说法去核对 meta.facts）；数字只给正确项，并且要出自 meta.facts
//   Q4 clip / duoScene / replay 的 key 必须是所在台词的子串；clip 没写 key 提醒
//   Q5 clip 的 key 和钩子短语要对得上（一个包含另一个）
//   Q6 释义卡 3–5 行：第一行 word、恰好 1 行 ≠、至少 1 行 =；≠ 行要和钩子误解对得上；第一个词要和钩子短语对得上
//   Q7 评论区的 letters / answer 如果写了，必须和 quiz 一致；commentCta 后面紧跟 brandEnd
//   Q8 brandEnd 的产品名和按钮：没写 name 就要有 meta.product；按钮文案（默认 meta.cta）≤8 字
//   Q9 提问到揭晓 6–8 秒（quiz 写 17–21 拍）
//   Q10 出题前不剧透：钩子语境、clip 台词（text / zh）、quiz 卡里字幕条、揭晓前的 vo 不许含正确答案、释义卡 = 行及其中的数字。
//       旁白和钩子语境先剥掉该镜全部选项原文再比：念完全部选项，或「是 A 还是 B」并列设问，不算剧透；单独点名正确项，或说出 = 行 / 数字答案，才拦。
//   Q11 数量题（几个小时 / 多少 / 几次 / 几天）：每个选项都要是数量
//   Q12 scene 是 screen / phone 就要写 screenItems（界面真字）；软件题材必须有
//   Q13 有 clip 没 replay 提醒
//   Q14 固定套话提醒：同类视频里用滥了的几句原话（如「你猜他什么意思」「再听一遍」「评论区打个字母」）换成自己的句式或口吻默认句
//   Q8 另有：落版必须有行动引导（button 或 meta.cta），button 要和 meta.cta 对得上
// ============================================================

const text = (v) => (typeof v === 'string' ? v : '');
const low = (v) => text(v).toLowerCase();
/** 字数：汉字 1、拉丁半个（和 validate.mjs / core/fit.ts 同一规则） */
const units = (s) => Array.from(text(s)).reduce((n, ch) => n + (/[⺀-鿿＀-｠　-〿]/.test(ch) ? 1 : 0.5), 0);
const related = (a, b) => !!a && !!b && (low(a).includes(low(b)) || low(b).includes(low(a)));
/** 去掉空白和标点后比较（「小火熬 6 小时」和「小火熬6小时。」算同一句） */
const norm = (s) => low(s).replace(/[\s\p{P}\p{S}]/gu, '');
/** 最长公共子串长度（字符串都很短，直接 DP） */
const lcs = (a, b) => {
  const A = Array.from(a);
  const B = Array.from(b);
  let best = 0;
  let prev = new Array(B.length + 1).fill(0);
  for (let i = 1; i <= A.length; i++) {
    const cur = new Array(B.length + 1).fill(0);
    for (let j = 1; j <= B.length; j++) if (A[i - 1] === B[j - 1]) best = Math.max(best, (cur[j] = prev[j - 1] + 1));
    prev = cur;
  }
  return best;
};
const numsIn = (s) => text(s).match(/\d+(?:\.\d+)?/g) ?? [];
/** 出题时卡里字幕条默认显示的半句：clip 最后一句里含 key 的那一段（和 template/src/styles/quiz/shots/quiz.tsx 的 quizLineOf 同一规则） */
export const quizLineOf = (line, key) => {
  const parts = text(line).split(/[，,。.!！?？；;：:（）()]/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return '';
  if (key) return parts.find((s) => s.includes(key)) ?? key;
  return parts[0];
};
/** 数量疑问（几个小时 / 多少 / 几次 / 几天…）和「选项是不是一个数量」 */
const UNIT = '小时|钟头|分钟|秒|天|晚|夜|次|年|遍|岁|斤|块|元|步|层|种|道|口|碗|杯|页|张|个|周|星期|月|倍|度|克|公里|米|人|家|条';
const QTY_Q = new RegExp(`(几|多少)\\s*(个)?\\s*(${UNIT})|多少`);
const QTY_OPT = new RegExp(`(\\d+(\\.\\d+)?|[一二两三四五六七八九十百千万半]+)\\s*(个)?\\s*(${UNIT})`);

export function run(sb, ctx) {
  const errors = [];
  const warnings = [];
  const human = [];
  const shots = Array.isArray(sb?.shots) ? sb.shots : [];
  const meta = sb?.meta ?? {};
  const idx = (type) => shots.findIndex((s) => s?.type === type);
  const P = (i) => (i >= 0 ? shots[i]?.params ?? {} : {});
  const hookI = idx('phraseTitle');
  const quizI = idx('quiz');
  const hook = P(hookI);
  const quiz = P(quizI);
  const opts = Array.isArray(quiz.options) ? quiz.options : [];

  // Q1 选项数量、重复、答案序号
  if (quizI >= 0) {
    if (opts.length < 2 || opts.length > 4)
      errors.push({where: ctx.where(quizI, 'quiz', 'options'), problem: `选项有 ${opts.length} 个，要 2–4 个`, fix: '写 3 个最好：常见误解（和钩子 guess 一字不差）、正确答案、一个干扰项'});
    if (Number.isInteger(quiz.answer) && (quiz.answer < 0 || quiz.answer >= opts.length))
      errors.push({where: ctx.where(quizI, 'quiz', 'answer'), problem: `answer 是 ${quiz.answer}，但只有 ${opts.length} 个选项`, fix: `写 0 到 ${Math.max(0, opts.length - 1)} 之间的序号（从 0 数，第一个选项是 0）`});
    const dup = opts.find((o, i) => opts.indexOf(o) !== i);
    if (dup) errors.push({where: ctx.where(quizI, 'quiz', 'options'), problem: `选项「${dup}」重复了`, fix: '每个选项写不一样的理解'});

    // Q2 陷阱项 = 钩子误解，且不是正确答案
    if (hookI >= 0 && text(hook.guess)) {
      const trap = opts.indexOf(hook.guess);
      if (trap < 0)
        errors.push({where: ctx.where(quizI, 'quiz', 'options'), problem: `钩子里的误解「${hook.guess}」不在选项里`, fix: `把其中一个错误选项改成和 phraseTitle.guess 一字不差的「${hook.guess}」（陷阱项）`});
      else if (trap === quiz.answer)
        errors.push({where: ctx.where(quizI, 'quiz', 'answer'), problem: `正确答案就是钩子里的误解「${hook.guess}」`, fix: '钩子写大家常见的错误理解，answer 指向另一个选项'});
    }

    // Q3 错误选项别写阿拉伯数字；正确项的数字交给全片数字核对（必须出自 meta.facts）
    opts.forEach((o, i) => {
      if (i === quiz.answer) return;
      const m = /\d+(?:\.\d+)?/.exec(text(o));
      if (m)
        errors.push({where: ctx.where(quizI, 'quiz', `options[${i}]`), problem: `错误选项「${o}」写了具体数字 ${m[0]}：观众会当成商家说法，校验也会去 meta.facts 里找它的来源`, fix: '错误选项写定性说法（如「大火煮一会儿」「隔夜泡一晚」）；具体数字只留给正确答案，并且要出自 meta.facts'});
    });
  }

  // Q4 关键词必须是所在台词的子串（不然马克笔没地方落）
  const clipI = idx('clip');
  if (clipI >= 0) {
    const c = P(clipI);
    const lines = Array.isArray(c.lines) ? c.lines : [];
    const last = text(lines[lines.length - 1]?.text);
    if (text(c.key) && !last.includes(c.key))
      errors.push({where: ctx.where(clipI, 'clip', 'key'), problem: `关键词「${c.key}」不在最后一句台词「${last}」里（大小写也要一致）`, fix: '让最后一句台词原样包含关键词，或者把 key 改成台词里的那几个字'});
    if (!text(c.key))
      warnings.push({where: ctx.where(clipI, 'clip', 'key'), problem: '没写 key，最后一句台词不会有主色 + 马克笔强调', fix: '写 key：最后一句里那个被误解的短语（原样照抄）'});
    // Q5 片段里强调的词要和钩子短语对得上
    if (hookI >= 0 && text(c.key) && text(hook.phrase) && !related(c.key, hook.phrase))
      warnings.push({where: ctx.where(clipI, 'clip', 'key'), problem: `片段强调的「${c.key}」和钩子短语「${hook.phrase}」对不上`, fix: 'key 写钩子短语本身或它的一部分，观众才知道「就是这句」'});
  }
  const duoI = idx('duoScene');
  if (duoI >= 0) {
    const d = P(duoI);
    if (text(d.key) && !text(d.ask).includes(d.key) && !text(d.reply).includes(d.key))
      errors.push({where: ctx.where(duoI, 'duoScene', 'key'), problem: `关键词「${d.key}」既不在 ask 里也不在 reply 里（大小写也要一致）`, fix: '让问句或回答原样包含关键词'});
  }
  const repI = idx('replay');
  if (repI >= 0) {
    const r = P(repI);
    if (text(r.key) && text(r.line) && !text(r.line).includes(r.key))
      errors.push({where: ctx.where(repI, 'replay', 'key'), problem: `关键词「${r.key}」不在 line 里`, fix: '让 line 原样包含关键词，或者两个都不写（沿用 clip）'});
    if (clipI < 0 && !text(r.line))
      errors.push({where: ctx.where(repI, 'replay', 'line'), problem: '没有 clip 镜头，replay 又没写 line，回放没有台词可放', fix: '给 replay 写 line（和 key），或者在前面加一镜 clip'});
  }

  // Q6 释义卡
  const mI = idx('meaningCard');
  if (mI >= 0) {
    const rows = Array.isArray(P(mI).rows) ? P(mI).rows : [];
    const neqRows = rows.filter((r) => r?.kind === 'neq');
    const eq = rows.filter((r) => r?.kind === 'eq').length;
    // 行数 3–5 由 meaningCard.spec.json 的 minItems / maxItems 拦
    if (rows.length && rows[0]?.kind !== 'word') errors.push({where: ctx.where(mI, 'meaningCard', 'rows'), problem: '第一行不是 word（被误解的那个词）', fix: '第一行写 {"kind":"word","text":"<被误解的词>"}'});
    if (neqRows.length !== 1) errors.push({where: ctx.where(mI, 'meaningCard', 'rows'), problem: `≠ 行有 ${neqRows.length} 行，要恰好 1 行`, fix: '只留一行 neq，写常见误解'});
    if (eq < 1) errors.push({where: ctx.where(mI, 'meaningCard', 'rows'), problem: '没有 = 行（正解）', fix: '加一行 {"kind":"eq","text":"<正解>"}'});
    if (hookI >= 0 && text(hook.guess) && neqRows.length === 1 && !related(neqRows[0]?.text, hook.guess))
      warnings.push({where: ctx.where(mI, 'meaningCard', 'rows'), problem: `≠ 行「${neqRows[0]?.text}」和钩子误解「${hook.guess}」对不上`, fix: '≠ 行写钩子里那个误解（原样或其中的关键几个字），删除线划掉的就是观众刚才猜错的'});
    // 第一个词可以是短语本身，也可以是短语里被误解的那一部分（先拆「big deal」再讲「no big deal」）
    if (hookI >= 0 && text(hook.phrase) && rows[0]?.kind === 'word' && text(rows[0].text) && !related(rows[0].text, hook.phrase))
      warnings.push({where: ctx.where(mI, 'meaningCard', 'rows'), problem: `释义卡第一个词「${rows[0].text}」和钩子短语「${hook.phrase}」对不上`, fix: '第一行写钩子短语本身，或者短语里被误解的那一部分'});
  }

  // Q7 评论区沿用 quiz；圆形擦除要接上 brandEnd
  const cI = idx('commentCta');
  if (cI >= 0) {
    const c = P(cI);
    if (quizI >= 0 && c.letters !== undefined && c.letters !== opts.length)
      errors.push({where: ctx.where(cI, 'commentCta', 'letters'), problem: `letters 是 ${c.letters}，但 quiz 有 ${opts.length} 个选项`, fix: '删掉 letters（自动取 quiz 的选项数）'});
    if (quizI >= 0 && c.answer !== undefined && c.answer !== quiz.answer)
      errors.push({where: ctx.where(cI, 'commentCta', 'answer'), problem: `answer 是 ${c.answer}，和 quiz 的正确答案 ${quiz.answer} 不一致`, fix: '删掉 answer（自动取 quiz 的答案）'});
    if (shots[cI + 1]?.type !== 'brandEnd')
      warnings.push({where: ctx.where(cI, 'commentCta', 'type'), problem: '评论区后面不是 brandEnd，发送键长出来的亮色圆接不上', fix: '把 brandEnd 放在 commentCta 紧后面'});
  }

  // Q8 落版：产品名、按钮文案
  const eI = idx('brandEnd');
  if (eI >= 0) {
    const e = P(eI);
    if (!text(e.name) && !text(meta.product))
      errors.push({where: ctx.where(eI, 'brandEnd', 'name'), problem: '落版没有产品名：params.name 和 meta.product 都没写', fix: '在 meta.product 写产品名（≤10 字）'});
    const btn = text(e.button) || text(meta.cta);
    if (!btn)
      errors.push({where: ctx.where(eI, 'brandEnd', 'button'), problem: '落版没有行动引导：meta.cta 和 brandEnd.button 都没写，结尾只剩 logo', fix: '在 meta.cta 写获取方式（如「应用商店搜闪记」「到店尝一碗」），落版按钮会一直显示到最后一帧'});
    if (!text(e.button) && btn && units(btn) > 14)
      errors.push({where: ctx.where(eI, 'brandEnd', 'button'), problem: `按钮默认用 meta.cta「${btn}」，超过 14 字，按钮放不下`, fix: '给 brandEnd 写 params.button（≤8 字，是 meta.cta 里的关键几个字，如「应用商店搜 X」→「搜 X」），meta.cta 保持原样'});
    if (text(e.button) && text(meta.cta) && !related(norm(e.button), norm(meta.cta)))
      errors.push({where: ctx.where(eI, 'brandEnd', 'button'), problem: `按钮「${e.button}」和 meta.cta「${meta.cta}」对不上：落版上看不到简报里的行动引导`, fix: '删掉 button（按钮直接显示 meta.cta），或者让 button 是 meta.cta 里的关键几个字（如「应用商店搜闪记」→「搜闪记」）'});
  }

  // Q10 出题前不许剧透。
  // 画面上的 clip 台词、quiz 字幕签：含正确答案、释义卡 = 行或其中的数字就拦。
  // 旁白 vo 和钩子语境：念题 + 念全部选项，或「是 A 还是 B」并列设问，不算剧透。
  // 先在去标点的原文上把该镜所有选项剥掉（要比 key 先剥：key「小火」是选项「小火熬6小时」的前缀，先剥 key 会把数字 6 留在剩下的字里），
  // 再和 = 行、数字答案比。正确项单独出现（没有同时念出别的选项）才拦。
  if (quizI >= 0) {
    const answers = [];
    if (Number.isInteger(quiz.answer) && text(opts[quiz.answer])) answers.push(opts[quiz.answer]);
    const mI2 = idx('meaningCard');
    if (mI2 >= 0 && Array.isArray(P(mI2).rows)) for (const r of P(mI2).rows) if (r?.kind === 'eq' && text(r.text)) answers.push(r.text);
    const nums = new Set(answers.flatMap(numsIn));
    const c = clipI >= 0 ? P(clipI) : {};
    // 短语本身、key 允许出现（观众要知道「就是这句」），先从台词里拿掉再比
    const strip = (s) => [hook.phrase, c.key].filter((x) => text(x)).reduce((acc, x) => acc.split(norm(x)).join(''), norm(s));
    const spoil = (line) => {
      if (!text(line)) return null;
      const L = strip(line);
      for (const a of answers) {
        const A = norm(a);
        if (A.length < 2) continue;
        if (L.includes(A) || lcs(L, A) >= Math.max(2, Math.ceil(A.length * 0.5))) return a;
      }
      const n = numsIn(line).find((x) => nums.has(x));
      return n ? n : null;
    };
    const optionNorms = opts.map((o) => norm(o)).filter((o) => o.length >= 2).sort((a, b) => b.length - a.length);
    const correctNorm = Number.isInteger(quiz.answer) ? norm(text(opts[quiz.answer])) : '';
    const withoutOptions = (line) => {
      let L = norm(line);
      for (const o of optionNorms) L = L.split(o).join('');
      return L;
    };
    const stripNorm = (L) => [hook.phrase, c.key].filter((x) => text(x)).reduce((acc, x) => {
      const n = norm(x);
      return n ? acc.split(n).join('') : acc;
    }, L);
    const spoilVo = (line) => {
      if (!text(line)) return null;
      const raw = norm(line);
      if (correctNorm.length >= 2 && raw.includes(correctNorm) && !optionNorms.some((o) => o !== correctNorm && raw.includes(o)))
        return text(opts[quiz.answer]);
      const L = stripNorm(withoutOptions(line));
      for (const a of answers) {
        const A = norm(a);
        if (A.length < 2) continue;
        if (L.includes(A) || lcs(L, A) >= Math.max(2, Math.ceil(A.length * 0.5))) return a;
      }
      const n = numsIn(L).find((x) => nums.has(x));
      return n ? n : null;
    };
    const FIX = '改成卖关子（例：『这汤看起来好浓，你猜熬了多久？』），只露短语 / 功能名 / 菜名，不说效果；答案留给 meaningCard';
    const lines = Array.isArray(c.lines) ? c.lines : [];
    lines.forEach((l, k) => {
      for (const f of ['text', 'zh']) {
        const hit = spoil(l?.[f]);
        if (hit) errors.push({where: ctx.where(clipI, 'clip', `lines[${k}].${f}`), problem: `clip 台词「${l[f]}」把答案说出来了（「${hit}」）：观众还没猜就知道了`, fix: FIX});
      }
    });
    if (hookI >= 0) {
      const hit = spoilVo(hook.context);
      if (hit) errors.push({where: ctx.where(hookI, 'phraseTitle', 'context'), problem: `钩子语境句「${hook.context}」把答案说出来了（「${hit}」）`, fix: '语境只交代谁在什么情况下碰到它，别揭晓；答案留给 meaningCard。并列设问（「是 A 还是 B」）可以把选项都念出来'});
    }
    const shown = text(quiz.quizLine) || text(quiz.sub) || quizLineOf(lines[lines.length - 1]?.text, c.key);
    const field = text(quiz.quizLine) ? 'quizLine' : text(quiz.sub) ? 'sub' : 'quizLine';
    const hitQ = spoil(shown);
    if (hitQ && !(field === 'quizLine' && !text(quiz.quizLine) && lines.length))
      errors.push({where: ctx.where(quizI, 'quiz', field), problem: `出题时卡里字幕条「${shown}」就是答案（「${hitQ}」）：正解一直挂在题目上方`, fix: '写 quizLine（≤12 字）只放被误解的那半句，如「老火两个字」「我给它加了双链」，不含答案和数字'});
    const revealAt = mI2 >= 0 ? mI2 : shots.length;
    shots.forEach((shot, i) => {
      if (i >= revealAt || !shot) return;
      const hitVo = spoilVo(shot.vo);
      if (hitVo) errors.push({where: ctx.where(i, shot.type || '?', 'vo'), problem: `配音「${shot.vo}」在揭晓前把答案说出来了（「${hitVo}」）`, fix: '揭晓前的 vo 可以念题并念完全部选项，也可以并列设问（「是 A 还是 B」）。不要单独点名正确项，也不要说出释义卡 = 行或其中的数字；答案留到 meaningCard 及之后'});
    });
  }

  // Q11 数量题：题目问「几个小时 / 多少 / 几次 / 几天」，每个选项都要是一个数量
  if (quizI >= 0 && QTY_Q.test(text(quiz.question))) {
    const bad = opts.filter((o) => !QTY_OPT.test(text(o)));
    if (bad.length)
      errors.push({where: ctx.where(quizI, 'quiz', 'options'), problem: `题目「${quiz.question}」问的是数量，选项「${bad.join('」「')}」却不是数量：题和选项对不上`, fix: '二选一：① 每个选项都写数量，正确项用 meta.facts 里的数字，错误项用中文数字（如「一小时 / 4小时 / 十二小时」）；② 题目改成问做法（「这锅汤是怎么熬的？」），选项写做法'});
  }

  // Q12 界面示意要有真字：scene 是 screen / phone 就要写 screenItems；软件题材必须有
  {
    const anyItems = shots.some((s) => Array.isArray(s?.params?.screenItems) && s.params.screenItems.length > 0);
    const uiI = shots.findIndex((s) => ['screen', 'phone'].includes(s?.params?.scene) && !s?.params?.media);
    if (uiI >= 0 && !anyItems)
      errors.push({where: ctx.where(uiI, shots[uiI].type, 'screenItems'), problem: `scene 是「${shots[uiI].params.scene}」，但全片没写 screenItems：界面里只有灰条占位，接近反面教材「空的录屏」`, fix: '在这一镜写 "screenItems": ["买牛奶", "周五交报告", "约牙医"]（2–4 行，每行 ≤10 字，写界面里真的会出现的字；别的镜头自动沿用）'});
    else if (meta.industry === 'software' && !anyItems && hookI >= 0)
      errors.push({where: ctx.where(hookI, 'phraseTitle', 'screenItems'), problem: '软件题材没写 screenItems：全片看不到产品界面，功能没被演示', fix: '第 1 镜写 "scene": "screen" 和 "screenItems"（界面里的 2–4 行字）；功能是「按住说话 → 出清单」这类的，clip 写 "scene": "phone"，再看一遍时会演出结果'});
  }

  // Q13 有 clip 就保留 replay（回放复证这一拍）
  if (clipI >= 0 && repI < 0)
    warnings.push({where: ctx.where(clipI, 'clip', 'type'), problem: '有 clip 但没有 replay：节奏里少了「回放复证」这一拍', fix: '在 meaningCard 后面加 {"type": "replay", "beats": 8}（参数都可省）'});


  // Q14 固定套话：这几句在同类答题视频里用滥了，观众一眼会当成别家的片子；换成自己的话，或者删掉字段用口吻（phraseTitle.voice）的默认句
  {
    const STOCK = [/你猜[他她它]?(是)?什么意思/, /再听一遍/, /评论区打个字母/, /^听懂了$/, /第一反应选的/];
    const FIELDS = {quiz: ['question'], replay: ['title', 'sticker'], commentCta: ['question', 'hint', 'prefill'], brandEnd: ['badge']};
    shots.forEach((s, i) => {
      for (const f of FIELDS[s?.type] ?? []) {
        const v = text(s?.params?.[f]);
        if (v && STOCK.some((re) => re.test(v)))
          warnings.push({where: ctx.where(i, s.type, f), problem: `「${v}」是同类视频里用滥的固定说法，放在这个风格里像照搬别家`, fix: f === 'question' ? '换成自己的句式，如「他这句到底想说啥？」「你押的是哪个？」' : '换成自己的句式，或者删掉这个字段，按 phraseTitle.voice 的口吻出默认句'});
      }
    });
  }

  // Q9 提问到揭晓 6–8 秒：quiz 镜头时长决定（揭晓在结束前约 1.5 秒的整拍）
  if (quizI >= 0) {
    const bpm = typeof meta.bpm === 'number' && meta.bpm ? meta.bpm : 128;
    const beat = 60 / bpm;
    const s = shots[quizI];
    const raw = typeof s.beats === 'number' ? s.beats * beat : typeof s.dur === 'number' ? s.dur : 19 * beat;
    const dur = Math.max(1, Math.round(raw / beat)) * beat;
    const reveal = Math.floor((dur - 1.5) / beat) * beat;
    if (reveal < 5.5 || reveal > 8.5)
      warnings.push({where: ctx.where(quizI, 'quiz', 'dur'), problem: `提问到揭晓约 ${reveal.toFixed(1)} 秒，建议 6–8 秒`, fix: '把 quiz 的时长写成 17–21 拍（"beats": 19）'});
  }
  return {errors, warnings, human};
}
