// scene.json 结构检查。报错格式和 scripts/validate.mjs 一样：哪里、错在哪、怎么改。
// 禁止组合要么拒绝，要么改写，报告里都写原因。quiz / journey 不拆。
import {readFileSync} from 'node:fs';
import path from 'node:path';
import ICONS from '../../template/src/core/icons.json' with {type: 'json'};
import {PRODUCTS, ASPECTS, ROLES, LAYOUTS, MOTIONS, DENSITIES, ALIGNS, RELAYS} from '../../template/src/scene/types.ts';
import {defaultMotion} from '../../template/src/scene/motion.ts';
import {inspectCallouts, inspectChart} from '../../template/src/scene/rules.ts';
import {presenterLookErrors} from '../lesson/validate-lesson.mjs';
import {stylesFor, themeIsDark} from './tokens.mjs';

const ICON_NAMES = Object.keys(ICONS);
const LESSON_ICON_HINT = {
  document: 'doc',
  warning: 'alert',
  cross: 'x',
  percent: 'chart',
  card: 'money',
  bank: 'money',
  scale: 'chart',
  flag: 'star',
};

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
const glyphs = (value) => [...String(value ?? '').replace(/\s/g, '')].length;
/** 数字和单位，例如「25 分钟」「62%」「5.2%」。整句不能进 number.text。 */
const NUMBER_TEXT = /^\d+(?:\.\d+)?%?(?:\s*[\u3400-\u9fffA-Za-z]{1,3})?$/;

function copyLimitErrors(screen, where, errors) {
  if (screen.role === 'number' && isObject(screen.number) && text(screen.number.text)) {
    const raw = String(screen.number.text).trim();
    if (!NUMBER_TEXT.test(raw) || glyphs(raw) > 6) {
      errors.push(issue(`${where}.number.text`, `数字 text「${raw}」只能写数字和单位，最多 6 个字`, '改成「25 分钟」或「62%」这种。整句放进 label，不要把事实原文整段塞进来'));
    }
  }
  if (screen.role === 'number' && isObject(screen.number) && text(screen.number.label) && glyphs(screen.number.label) > 16) {
    errors.push(issue(`${where}.number.label`, `说明有 ${glyphs(screen.number.label)} 个字，最多 16 个字`, '收成这一数字的短说明'));
  }
  if (screen.role === 'action' && text(screen.line) && glyphs(screen.line) > 16) {
    errors.push(issue(`${where}.line`, `片尾这一句有 ${glyphs(screen.line)} 个字，最多 16 个字`, '收成一句短判断，不要把要点串成一段'));
  }
  if (screen.role === 'action' && text(screen.brand) && glyphs(screen.brand) > 8) {
    errors.push(issue(`${where}.brand`, `品牌有 ${glyphs(screen.brand)} 个字，最多 8 个字`, '用产品名，不要写一整句'));
  }
}

function copyLimitWarnings(screen, where, warnings) {
  if (!isObject(screen)) return;
  if ((screen.role === 'claim' || screen.role === 'quote') && text(screen.text) && glyphs(screen.text) > 16) {
    warnings.push(issue(`${where}.text`, `主张有 ${glyphs(screen.text)} 个字，最多 16 个字`, '收成一句判断。这是提醒，不拦截'));
  }
  if (text(screen.title) && glyphs(screen.title) > 12) {
    warnings.push(issue(`${where}.title`, `标题有 ${glyphs(screen.title)} 个字，最多 12 个字`, '收成一句短判断。这是提醒，不拦截'));
  }
  if (text(screen.support) && glyphs(screen.support) > 16) {
    warnings.push(issue(`${where}.support`, `辅句有 ${glyphs(screen.support)} 个字，最多 16 个字`, '收短。这是提醒，不拦截'));
  }
  if (text(screen.kicker) && glyphs(screen.kicker) > 8) {
    warnings.push(issue(`${where}.kicker`, `栏目标有 ${glyphs(screen.kicker)} 个字，最多 8 个字`, '收成几个字。这是提醒，不拦截'));
  }
  if (Array.isArray(screen.items)) {
    screen.items.forEach((item, index) => {
      if (item && text(item.text) && glyphs(item.text) > 12) {
        warnings.push(issue(`${where}.items[${index}].text`, `这一条有 ${glyphs(item.text)} 个字，最多 12 个字`, '收成短句。这是提醒，不拦截'));
      }
    });
  }
}

/** 同一版式连续不超过 2 屏；4 屏以上至少 3 种。只提醒，不拦截。 */
function layoutMixWarnings(screens) {
  const warnings = [];
  const list = Array.isArray(screens) ? screens : [];
  let start = 0;
  for (let i = 1; i <= list.length; i += 1) {
    const same = i < list.length && isObject(list[i]) && isObject(list[start]) && list[i].layout && list[i].layout === list[start].layout;
    if (same) continue;
    const run = i - start;
    if (run > 2 && isObject(list[start]) && list[start].layout) {
      const name = list[start].layout;
      warnings.push(issue(`screens[${start}].layout`, `版式 ${name} 连续 ${run} 屏，同一版式连续不超过 2 屏`, '把多出来的屏改成别的版式。这是提醒，不拦截'));
    }
    start = i;
  }
  const named = list.filter((screen) => isObject(screen) && LAYOUTS.includes(screen.layout));
  if (named.length >= 4) {
    const kinds = new Set(named.map((screen) => screen.layout));
    if (kinds.size < 3) {
      warnings.push(issue('screens', `全片 ${named.length} 屏只用了 ${kinds.size} 种版式，至少用 3 种`, '把重复的屏改成还没用过的版式。这是提醒，不拦截'));
    }
  }
  return warnings;
}

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
  copyLimitErrors(screen, where, errors);
  checkIcon(screen.icon, `${where}.icon`, errors);
  if (Array.isArray(screen.items)) {
    screen.items.forEach((item, itemIndex) => {
      if (item && item.icon !== undefined) checkIcon(item.icon, `${where}.items[${itemIndex}].icon`, errors);
    });
  }
  if (screen.role === 'media') {
    if (!text(screen.src) || !['merchant', 'screenshot', 'illustration'].includes(screen.source)) {
      errors.push(issue(where, 'media 要有 src，source 只能是 merchant、screenshot、illustration', '按画面来源写。没有图就不要用这一类'));
    }
    if (!Array.isArray(screen.callouts) || screen.callouts.length < 1 || screen.callouts.length > 4) {
      errors.push(issue(`${where}.callouts`, '标注要 1 到 4 个', '每个标注写 x、y、w、h，都是 0 到 1。不要写成像素'));
    } else {
      for (const message of inspectCallouts(screen.callouts)) {
        errors.push(issue(`${where}.callouts`, message, '框和框不要相交，也不要伸出图片。改 x、y、w、h，仍用 0 到 1'));
      }
      screen.callouts.forEach((box, boxIndex) => {
        if (box && box.label !== undefined && (typeof box.label !== 'string' || [...box.label].length > 12)) {
          errors.push(issue(`${where}.callouts[${boxIndex}].label`, '标注最多 12 字', '收成不超过 12 个字'));
        }
      });
    }
  }
  if (screen.role === 'chart') {
    if (!['bar', 'line', 'donut'].includes(screen.chart) || !text(screen.fact) || !Array.isArray(screen.points)) {
      errors.push(issue(where, 'chart 要有 chart（bar、line 或 donut）、points 和 fact', '每个点写 label 和 value。value 必须能在事实原文里找到'));
    } else {
      const fact = factById(facts, screen.fact);
      if (!fact) errors.push(issue(`${where}.fact`, `找不到事实「${screen.fact}」`, '先在 facts 里加上这个 id，原文里要包含画面上的数字'));
      else {
        for (const message of inspectChart(screen.chart, screen.points, fact.text, screen.max)) {
          const fix = message.includes('事实')
            ? '把这个数字写进对应 fact 的原文，或从画面上删掉。不要自己编一个数'
            : message.includes('donut')
              ? '合并小类别，或改成 bar'
              : message.includes('series')
                ? '每条线至少两个点，而且用同一组 label'
                : message.includes('focus')
                  ? '只保留一个 focus: true'
                  : '按 dataChart 的规则改 points';
          errors.push(issue(where, message, fix, '图表数字必须来自 facts，规则与宣传片 dataChart 相同'));
        }
      }
    }
  }
}

function checkIcon(name, where, errors) {
  if (name === undefined) return;
  if (typeof name === 'string' && ICON_NAMES.includes(name)) return;
  const hint = LESSON_ICON_HINT[name];
  if (hint) {
    errors.push(issue(where, `「${name}」是讲课图标名，场景原型不收`, `改成 ${hint}。场景只用宣传片 template/src/core/icons.json 里的名字`));
    return;
  }
  errors.push(issue(where, `不认识的图标「${name}」`, `改成 ${ICON_NAMES.join('、')}`, '图标名是封闭枚举，来自宣传片 core/icons.json'));
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
  if (role === 'claim' || role === 'quote') return layout === 'hero' || layout === 'board';
  if (role === 'number') return layout === 'hero' || layout === 'board' || layout === 'number';
  if (role === 'action') return layout === 'end' || layout === 'hero';
  if (role === 'compare') return layout === 'split' || layout === 'stack';
  if (role === 'chart') return layout === 'chart' || layout === 'board';
  if (role === 'media') return layout === 'media' || layout === 'board';
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

function checkPresenter(scene, errors) {
  if (scene.domain !== undefined && typeof scene.domain !== 'string') {
    errors.push(issue('domain', 'domain 必须是字符串', '法律领域写 legal，其它领域写 tech 这类名字'));
  }
  if (scene.presenter === undefined) return;
  if (scene.product !== 'lesson') {
    errors.push(issue('presenter', '讲解员只属于讲课', 'product 改成 lesson，或删掉 presenter'));
    return;
  }
  for (const line of presenterLookErrors(scene.presenter, 'presenter')) {
    const cut = line.indexOf('：');
    errors.push(issue(cut >= 0 ? line.slice(0, cut) : 'presenter', cut >= 0 ? line.slice(cut + 1) : line, '按讲课引擎写 presenter.kind：cartoon、real、video 或 none'));
  }
  const kind = scene.presenter && scene.presenter.kind;
  if (kind === 'real' || kind === 'video') {
    const src = scene.presenter.src;
    if (typeof src !== 'string' || path.extname(src).toLowerCase() !== '.mp4' || /^(?:[a-z][a-z\d+.-]*:\/\/|data:|blob:|\\\\|\/\/)/i.test(src)) {
      errors.push(issue('presenter.src', '真人或视频讲解员要本地 mp4', 'src 写本地 .mp4 路径，不要写网址'));
    }
  }
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
  if (scene.aspect === undefined || scene.aspect === null || scene.aspect === '') {
    const to = scene.product === 'lesson' ? '16:9' : '9:16';
    scene.aspect = to;
    applied.push({where: 'aspect', from: '', to, reason: scene.product === 'lesson' ? '讲课没写画幅，预设横版 16:9' : '没写画幅，预设竖版 9:16'});
  } else if (!ASPECTS.includes(scene.aspect)) errors.push(enumError('aspect', scene.aspect, ASPECTS, '画幅'));
  checkPresenter(scene, errors);
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
  if (Array.isArray(scene.screens)) {
    scene.screens.forEach((screen, index) => {
      if (!isObject(screen) || screen.relay === undefined) return;
      if (typeof screen.relay !== 'string' || !RELAYS.includes(screen.relay)) {
        errors.push(enumError(`screens[${index}].relay`, screen.relay, RELAYS, '接力'));
        return;
      }
      if (scene.style !== 'cutpaper-collage') {
        errors.push(issue(`screens[${index}].relay`, '只有剪纸拼贴能写接力', '删掉 relay，或把 style 改成 cutpaper-collage', '接力是色卡跨屏换形，不给别的风格用'));
      }
    });
  }

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
  nextScreens.forEach((screen, index) => copyLimitWarnings(screen, `screens[${index}]`, warnings));
  warnings.push(...layoutMixWarnings(nextScreens));

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
