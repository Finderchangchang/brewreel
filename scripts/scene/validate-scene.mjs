// scene.json 结构检查。报错格式和 scripts/validate.mjs 一样：哪里、错在哪、怎么改。
// 禁止组合要么拒绝，要么改写，报告里都写原因。quiz / journey 不拆。
import {readFileSync} from 'node:fs';
import {PRODUCTS, ASPECTS, ROLES, LAYOUTS, MOTIONS, DENSITIES, ALIGNS} from '../../template/src/scene/types.ts';
import {defaultMotion} from '../../template/src/scene/motion.ts';
import {stylesFor, themeIsDark} from './tokens.mjs';

const BANNED_KEYS = new Set(['x', 'y', 'frame', 'ms', 'fps', 'px', 'startMs', 'endMs', 'revealAtMs', 'atMs', 'durationMs']);
const CALLOUT_KEYS = new Set(['x', 'y', 'w', 'h']);
const QUIZ_VERBS = new Set(['pen', 'stamp', 'countdown', 'cross', 'mark', 'mark-wrong']);
const MONEY_RE = /[¥￥$€£]|(?:元|块钱|万元|亿元|千元|百元)/;

export const REASONS = {
  editorialBounce: '零圆角、重字重，再加弹簧回弹，两种外形语言同时出现',
  techDarkPaper: '深色光晕底上做纸片上抛，材料对不上',
  gradientPaper: 'settle 的时长和角度是按纸舞台量的，渐变气泡底没有这套零件',
  numberSplit: '一个数被拆进多格，主焦点没了',
  compareHero: '两侧没有位置',
  tooMany: '格子不够。grid 上限 4，超过改 stack',
  moneyRoll: '中间价不是原话。沿用金额不滚动，有旧值就翻牌',
  quizVerb: 'quiz 的笔和印章依赖 semantic 色号，不能用在 surface 家族',
  journey: 'journey 的街区是一镜到底，拆成独立卡片屏之后位移没有了',
};

const issue = (where, problem, fix, reason) => ({where, problem, fix, ...(reason ? {reason} : {})});

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;

function walk(value, path, errors, inCallout) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, errors, inCallout));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const here = path ? `${path}.${key}` : key;
    if (inCallout && CALLOUT_KEYS.has(key)) {
      if (typeof child !== 'number' || child < 0 || child > 1) {
        errors.push(issue(here, `标注「${key}」必须是 0 到 1 的相对位置`, '改成画面里的比例，不要写像素', '标注指的是图里哪一块，不是排版坐标'));
      }
      continue;
    }
    if (!inCallout && BANNED_KEYS.has(key)) {
      errors.push(issue(here, `不能写坐标或时间字段「${key}」`, '删掉这个字段。位置由引擎算，出场由配音时间算。when 只写旁白里的字', '模型不写坐标、帧号、毫秒'));
    }
    walk(child, here, errors, key === 'callouts' ? true : inCallout);
  }
}

function enumError(where, value, allowed, label) {
  const sample = allowed.slice(0, 8).join('、');
  const more = allowed.length > 8 ? `等 ${allowed.length} 个` : '';
  return issue(where, `不认识的${label}「${value}」`, `改成 ${sample}${more}`, `${label}是封闭枚举`);
}

function countItems(screen) {
  if (screen.role === 'points' || screen.role === 'dialogue') return Array.isArray(screen.items) ? screen.items.length : 0;
  if (screen.role === 'compare') {
    const left = Array.isArray(screen.left?.items) ? screen.left.items.length : 0;
    const right = Array.isArray(screen.right?.items) ? screen.right.items.length : 0;
    return left + right;
  }
  return 1;
}

function checkWhen(screen, where, errors) {
  const narration = typeof screen.narration === 'string' ? screen.narration : '';
  const items = Array.isArray(screen.items) ? screen.items : [];
  items.forEach((item, index) => {
    if (!item || item.when === undefined) return;
    if (typeof item.when !== 'string' || !item.when.trim()) {
      errors.push(issue(`${where}.items[${index}].when`, 'when 必须是旁白里的几个字', '写成旁白里连续的短语，或删掉这个字段', 'when 不是秒，也不是帧'));
      return;
    }
    if (!narration.includes(item.when)) {
      errors.push(issue(`${where}.items[${index}].when`, `旁白里没有「${item.when}」这段连续的字`, '改成旁白里连续的几个字，或删掉 when，引擎会按条目顺序对到句子', '找不到就不假装对齐到这个字'));
    }
  });
}

function checkFacts(scene, errors) {
  const facts = Array.isArray(scene.facts) ? scene.facts : [];
  const ids = new Set();
  facts.forEach((fact, index) => {
    const where = `facts[${index}]`;
    if (!isObject(fact) || !text(fact.id) || !text(fact.text) || !text(fact.source)) {
      errors.push(issue(where, '事实要有 id、text、source', '三条都写成字符串。画面上的数字和原话用这个 id'));
      return;
    }
    if (ids.has(fact.id)) errors.push(issue(`${where}.id`, `事实 id「${fact.id}」重复了`, '每个 id 只留一条'));
    ids.add(fact.id);
  });
  return facts;
}

function factById(facts, id) {
  return facts.find((fact) => fact && fact.id === id);
}

function checkScreen(screen, index, facts, errors) {
  const where = `screens[${index}]`;
  if (!isObject(screen)) {
    errors.push(issue(where, '每一屏必须是对象', '按角色写 role、layout 和文案'));
    return;
  }
  if (!ROLES.includes(screen.role)) errors.push(enumError(`${where}.role`, screen.role, ROLES, '内容种类'));
  if (!LAYOUTS.includes(screen.layout)) errors.push(enumError(`${where}.layout`, screen.layout, LAYOUTS, '版式原型'));
  if (screen.narration !== undefined && typeof screen.narration !== 'string') {
    errors.push(issue(`${where}.narration`, '旁白必须是字符串', '写成这一屏要说的话。when 从这句话里摘'));
  }
  checkWhen(screen, where, errors);
  if (Array.isArray(screen.verbs)) {
    for (const verb of screen.verbs) {
      if (QUIZ_VERBS.has(verb)) {
        errors.push(issue(`${where}.verbs`, `不能在这套场景里用「${verb}」`, '删掉笔、印章、倒数。这些只留在 quiz 成片里', REASONS.quizVerb));
      }
    }
  }
  if (screen.role === 'district' || screen.layout === 'district' || screen.scene === 'district') {
    errors.push(issue(where, '不能把 journey 的街区拆成一屏卡片', '整片继续走 journey，不要写进 scene.json', REASONS.journey));
  }
  if (screen.role === 'dialogue') {
    errors.push(issue(where, '对话这一类原型阶段先不做', '改成 points，或继续用现在的 chat 镜头'));
  }
  if (screen.role === 'claim') {
    if (!text(screen.text)) errors.push(issue(`${where}.text`, 'claim 要有一句主文案', '把这一屏的主句写进 text'));
    if (screen.emphasis !== undefined && !Array.isArray(screen.emphasis)) {
      errors.push(issue(`${where}.emphasis`, 'emphasis 必须是字符串数组', '写成要标的那几个字，例如 ["你不懂我"]'));
    } else if (Array.isArray(screen.emphasis)) {
      screen.emphasis.forEach((word, wordIndex) => {
        if (typeof word !== 'string' || !String(screen.text || '').includes(word)) {
          errors.push(issue(`${where}.emphasis[${wordIndex}]`, `主文案里没有「${word}」`, '改成 text 里连续的几个字'));
        }
      });
    }
  }
  if (screen.role === 'points') {
    if (!Array.isArray(screen.items) || screen.items.length < 1) {
      errors.push(issue(`${where}.items`, 'points 至少要有一条', '每条写 text，可选 note 和 when'));
    } else {
      screen.items.forEach((item, itemIndex) => {
        if (!isObject(item) || !text(item.text)) errors.push(issue(`${where}.items[${itemIndex}].text`, '这一条要有 text', '写成短句'));
      });
    }
  }
  if (screen.role === 'number') {
    const num = screen.number;
    if (!isObject(num) || !text(num.text) || !text(num.fact) || !text(num.label)) {
      errors.push(issue(`${where}.number`, '数字要有 text、fact、label', 'text 照抄原话，例如「3 分钟」。fact 填 facts 里的 id'));
    } else {
      const fact = factById(facts, num.fact);
      if (!fact) errors.push(issue(`${where}.number.fact`, `找不到事实「${num.fact}」`, '先在 facts 里加上这个 id，再引用'));
      else if (!String(fact.text).includes(String(num.text).trim())) {
        errors.push(issue(`${where}.number.text`, `事实「${num.fact}」里没有「${num.text}」`, 'text 必须是事实原文里的那一段，不要改写数字'));
      }
      if (num.from !== undefined && fact && !String(fact.text).includes(String(num.from))) {
        errors.push(issue(`${where}.number.from`, `事实里没有旧值「${num.from}」`, '旧值也要出现在事实原文里，或者删掉 from'));
      }
    }
  }
  if (screen.role === 'quote') {
    if (!text(screen.text) || !text(screen.source) || !text(screen.fact)) {
      errors.push(issue(where, '引用要有 text、source、fact', '原文、出处、事实 id 都要写'));
    } else if (!factById(facts, screen.fact)) {
      errors.push(issue(`${where}.fact`, `找不到事实「${screen.fact}」`, '先在 facts 里加上这个 id'));
    }
  }
  if (screen.role === 'compare') {
    for (const side of ['left', 'right']) {
      const pane = screen[side];
      if (!isObject(pane) || !text(pane.label) || !Array.isArray(pane.items) || pane.items.some((item) => typeof item !== 'string')) {
        errors.push(issue(`${where}.${side}`, `${side === 'left' ? '左' : '右'}栏要有 label 和 items`, 'items 是字符串数组'));
      }
    }
    if (screen.winner !== undefined && !['left', 'right', 'none'].includes(screen.winner)) {
      errors.push(issue(`${where}.winner`, `不认识的 winner「${screen.winner}」`, '改成 left、right 或 none'));
    }
  }
  if (screen.role === 'action') {
    if (!text(screen.brand) || !text(screen.line)) errors.push(issue(where, '行动屏要有 brand 和 line', '品牌和一句口号。没有获取方式就不要写 cta'));
  }
  if (screen.role === 'media') {
    if (!text(screen.src) || !['merchant', 'screenshot', 'illustration'].includes(screen.source)) {
      errors.push(issue(where, 'media 要有 src，source 只能是 merchant、screenshot、illustration', '按画面来源写。没有图就不要用这一类'));
    }
    if (screen.callouts !== undefined && (!Array.isArray(screen.callouts) || screen.callouts.length < 1 || screen.callouts.length > 4)) {
      errors.push(issue(`${where}.callouts`, '标注要 1 到 4 个', '删到 4 个以内，或整段删掉'));
    }
  }
  if (screen.role === 'chart') {
    if (!['bar', 'line', 'donut'].includes(screen.chart) || !text(screen.fact) || !Array.isArray(screen.points)) {
      errors.push(issue(where, 'chart 要有 chart（bar、line 或 donut）、points 和 fact', '每个点写 label 和 value'));
    }
  }
}

function moneyText(screen) {
  const raw = `${screen.number?.text || ''} ${screen.number?.from || ''} ${screen.number?.label || ''}`;
  return MONEY_RE.test(raw);
}

function rewriteScreen(screen, index, rewrites) {
  const where = `screens[${index}]`;
  const next = {...screen};
  const n = countItems(screen);
  if (screen.role === 'number' && (screen.layout === 'grid' || screen.layout === 'split')) {
    rewrites.push({where: `${where}.layout`, from: screen.layout, to: 'hero', reason: REASONS.numberSplit});
    next.layout = 'hero';
  }
  if (screen.role === 'compare' && screen.layout === 'hero') {
    rewrites.push({where: `${where}.layout`, from: 'hero', to: 'split', reason: REASONS.compareHero});
    next.layout = 'split';
  }
  if (screen.role === 'points' && n >= 6 && (screen.layout === 'hero' || screen.layout === 'grid')) {
    rewrites.push({where: `${where}.layout`, from: screen.layout, to: 'stack', reason: REASONS.tooMany});
    next.layout = 'stack';
  } else if (screen.role === 'points' && screen.layout === 'grid' && n > 4) {
    rewrites.push({where: `${where}.layout`, from: 'grid', to: 'stack', reason: REASONS.tooMany});
    next.layout = 'stack';
  }
  if (screen.role === 'number' && moneyText(screen) && (screen.count === 'roll' || screen.showComputedDelta === true)) {
    rewrites.push({where: `${where}.count`, from: screen.count || 'roll', to: 'flip', reason: REASONS.moneyRoll});
    next.count = 'flip';
    next.showComputedDelta = false;
  }
  return next;
}

function allowed(role, layout, n) {
  if (role === 'claim' || role === 'quote') return layout === 'hero';
  if (role === 'number') return layout === 'hero';
  if (role === 'action') return layout === 'end' || layout === 'hero';
  if (role === 'compare') return layout === 'split' || layout === 'stack';
  if (role === 'chart') return layout === 'chart';
  if (role === 'media') return layout === 'media';
  if (role === 'points') {
    if (layout === 'stack' || layout === 'sequence') return true;
    if (layout === 'grid') return n <= 4;
    if (layout === 'hero') return n < 6;
    return false;
  }
  return false;
}

function suggest(role) {
  if (role === 'compare') return 'split';
  if (role === 'points') return 'stack';
  if (role === 'action') return 'end';
  if (role === 'media') return 'media';
  if (role === 'chart') return 'chart';
  return 'hero';
}

export function validateScene(scene) {
  const errors = [];
  const warnings = [];
  const rewrites = [];
  const applied = [];
  if (!isObject(scene)) {
    return {ok: false, errors: [issue('整个文件', 'scene.json 必须是对象', '最外层写 product、aspect、style、screens')], warnings, rewrites, applied, scene: null};
  }
  walk(scene, '', errors, false);
  if (!PRODUCTS.includes(scene.product)) {
    if (scene.product === 'quiz' || scene.product === 'journey') {
      errors.push(issue('product', `「${scene.product}」不拆进通用场景`, '整片继续走现有成片。不要写成 screens 列表', scene.product === 'journey' ? REASONS.journey : REASONS.quizVerb));
    } else errors.push(enumError('product', scene.product, PRODUCTS, '产品'));
  }
  if (!ASPECTS.includes(scene.aspect)) errors.push(enumError('aspect', scene.aspect, ASPECTS, '画幅'));
  const styles = stylesFor(scene.product);
  if (PRODUCTS.includes(scene.product) && !styles.includes(scene.style)) {
    errors.push(enumError('style', scene.style, styles, scene.product === 'promo' ? '宣传片风格' : scene.product === 'lesson' ? '讲课风格' : '口播风格'));
  }
  if (scene.motion !== undefined && !MOTIONS.includes(scene.motion)) errors.push(enumError('motion', scene.motion, MOTIONS, '动效性格'));
  if (scene.density !== undefined && !DENSITIES.includes(scene.density)) errors.push(enumError('density', scene.density, DENSITIES, '疏密'));
  if (scene.align !== undefined && !ALIGNS.includes(scene.align)) errors.push(enumError('align', scene.align, ALIGNS, '对齐'));
  if (!Array.isArray(scene.screens) || scene.screens.length < 1) errors.push(issue('screens', '至少要有一屏', 'screens 写成数组'));

  const facts = checkFacts(scene, errors);
  if (Array.isArray(scene.screens)) scene.screens.forEach((screen, index) => checkScreen(screen, index, facts, errors));

  let motion = scene.motion;
  if (motion === undefined && PRODUCTS.includes(scene.product) && styles.includes(scene.style)) {
    motion = defaultMotion(scene.product, scene.style, scene.product === 'promo' && themeIsDark(scene.style));
    applied.push({where: 'motion', from: '', to: motion, reason: '没写性格，按风格预设。讲课 paper、lecture 预设 soft，不改现有课程手感'});
  }
  if (scene.product === 'lesson' && scene.style === 'editorial' && motion === 'bounce') {
    errors.push(issue('motion', 'editorial 不能配 bounce', '改成 crisp。这是 editorial 的默认性格', REASONS.editorialBounce));
  }
  if (scene.product === 'promo' && motion === 'paper') {
    const reason = scene.style === 'tech-dark' ? REASONS.techDarkPaper : REASONS.gradientPaper;
    const fix = scene.style === 'tech-dark' ? '改成 crisp' : '改成 bounce 或 crisp。纸片性格只配口播的纸和剪纸';
    errors.push(issue('motion', `「${scene.style}」不能配 paper`, fix, reason));
  }

  const nextScreens = Array.isArray(scene.screens)
    ? scene.screens.map((screen, index) => (isObject(screen) ? rewriteScreen(screen, index, rewrites) : screen))
    : [];
  nextScreens.forEach((screen, index) => {
    if (!isObject(screen) || !ROLES.includes(screen.role) || !LAYOUTS.includes(screen.layout)) return;
    const n = countItems(screen);
    if (!allowed(screen.role, screen.layout, n)) {
      const to = suggest(screen.role);
      errors.push(issue(`screens[${index}].layout`, `${screen.role} 不能用 ${screen.layout}`, `改成 ${to}。版式受内容种类限制，不是任意搭配`, '同一种内容只落在少数原型上'));
    }
  });

  if (motion === 'crisp' && scene.style === 'fresh-light' && !errors.some((item) => item.where === 'motion')) {
    warnings.push(issue('motion', 'crisp 配 fresh-light 可以渲染，但和现在的弹簧卡片不一样', '想要卡片回弹就改成 bounce'));
  }
  let run = 1;
  for (let i = 1; i < nextScreens.length; i++) {
    const prev = nextScreens[i - 1];
    const cur = nextScreens[i];
    if (isObject(prev) && isObject(cur) && prev.layout === cur.layout && motion) run += 1;
    else run = 1;
    if (run === 3) {
      warnings.push(issue(`screens[${i}].layout`, '连续 3 屏是同一个原型、同一种性格', '改疏密，或换一个性格。这是提醒，不拦截'));
      break;
    }
  }

  const next = {
    ...scene,
    ...(motion && scene.motion === undefined ? {motion} : {}),
    screens: nextScreens,
  };
  return {ok: errors.length === 0, errors, warnings, rewrites, applied, scene: next};
}

export function formatReport(result, file = '') {
  const out = [];
  if (result.errors.length) {
    out.push(`校验未通过：${result.errors.length} 个问题${file ? `（${file}）` : ''}`);
    result.errors.forEach((item, index) => {
      out.push(`${index + 1}. ${item.where}：${item.problem}\n   → 怎么改：${item.fix}${item.reason ? `\n   → 原因：${item.reason}` : ''}`);
    });
  }
  if (result.rewrites.length) {
    out.push(`改写 ${result.rewrites.length} 处：`);
    result.rewrites.forEach((item, index) => {
      out.push(`${index + 1}. ${item.where}：${item.from} → ${item.to}\n   → 原因：${item.reason}`);
    });
  }
  if (result.warnings.length) {
    out.push(`提醒 ${result.warnings.length} 条（不拦截）：`);
    result.warnings.forEach((item) => out.push(`  - ${item.where}：${item.problem}（${item.fix}）`));
  }
  if (result.applied?.length) {
    result.applied.forEach((item) => out.push(`预设 ${item.where} = ${item.to}（${item.reason}）`));
  }
  if (!result.errors.length) out.push(`校验通过：${result.scene?.screens?.length ?? 0} 屏`);
  return out.join('\n');
}

export function validateSceneFile(file) {
  let scene;
  try {
    scene = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    const result = {ok: false, errors: [issue('整个文件', `JSON 解析失败（${error.message}）`, '检查逗号、引号和括号')], warnings: [], rewrites: [], applied: [], scene: null};
    return result;
  }
  return validateScene(scene);
}
