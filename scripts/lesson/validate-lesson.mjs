import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJsonResource} from './read-json.mjs';
import {hookForDomain} from './packs/domain-hooks.mjs';
import {copyLimitIssues, layoutMixIssues, LESSON_GENERATED_BY, resolveLessonTheme} from './style-rules.mjs';
import {characterRefProblem} from './character-ref.mjs';
import {brandRefProblem, parseBrandRef} from './brand-ref.mjs';
import {cardEchoWarnings, singleChapterWarning} from './card-echo.mjs';
import {revealTargetsFor} from './reveal-targets.mjs';
import {isIconName} from '../../template/src/lesson/icon-names.mjs';
import {BASIS_RE, CASE_LABEL, basisCitations, collectStrings, documentBrandHit, sayingLawHit} from '../../template/src/lesson/layout-guards.mjs';
import {resolveCartoonWardrobe, resolveLook} from '../../template/src/lesson/mascot/cast.mjs';
import {corpusNumbers} from './packs/domain-hooks.mjs';

const SPEC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../template/src/lesson/layouts');
export const LAYOUTS = new Set(['cover','steps','chapter','quote','compare','question','flow','recap','screenshot','code','points','statement','timeline','checklist','bignumber','saying','levels','case','document','table']);
const specs = Object.fromEntries([...LAYOUTS].map((name) => [name, readJsonResource(path.join(SPEC_DIR, `${name}.spec.json`))]));
const count = (value) => Array.from(String(value ?? '')).length;
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const MASCOT_POSES = new Set(['explain','point','check','warn','think','affirm','cheer','wave']);
const MASCOT_IDS = new Set(['peep-mentor','peep-counsel','peep-teacher','mentor','counsel','buddy','default']);
const MASCOT_OUTFITS = new Set(['sweater','tee','shirt','darkSweater','blackTee','whiteShirt']);
const LOOK_OUTFITS = new Set(['darkSweater','blackTee','whiteShirt','sweater','tee','shirt']);
const LOOK_PRESETS = new Set(['male','female','peep-mentor','peep-counsel','peep-teacher']);
const PRESENTER_KINDS = new Set(['cartoon','real','none','video']);
const PEEP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../template/src/vendor/react-peeps/peeps');

function peepOptionKeys(file, exportName) {
  const text = fs.readFileSync(path.join(PEEP_DIR, file), 'utf8');
  const match = text.match(new RegExp(`exports\\.${exportName} = \\{([\\s\\S]*?)\\n\\};`));
  if (!match) throw new Error(`读不到 Open Peeps 选项 ${exportName}`);
  const keys = [...match[1].matchAll(/^\s+(\w+):/gm)].map((item) => item[1]);
  if (!keys.length) throw new Error(`Open Peeps 选项 ${exportName} 是空的`);
  return new Set(keys);
}

const MASCOT_HAIR = peepOptionKeys('hair/z_options.js', 'Hair');
const MASCOT_ACCESSORIES = peepOptionKeys('accessories/z_options.js', 'Accessories');
const MASCOT_FACIAL_HAIR = peepOptionKeys('facialHair/z_options.js', 'FacialHair');
const PALETTE_KEYS = ['skin','hair','primary','secondary'];
const PRESENTER_LAYOUTS = new Set(['pip', 'full', 'hidden']);
const LEGAL_CONCLUSIONS = ['不构成法律意见', '不构成法律建议', '法律效力', '法律责任', '人民法院', '合同无效', '不具有法律约束力', '承担赔偿责任', '司法解释', '诉讼时效', '依法应当', '本法规定', '根据本法'];
const ARTICLE_RE = /第\s*[0-9０-９零〇一二三四五六七八九十百千]+\s*条(?!件)/u;

// 手填 domain=tech 不能绕过律师审稿。只认法条引用和法律结论，避免把「许可证」「方法」误判成法律内容。
export function looksLikeLegalContent(lesson) {
  const texts = [];
  collectStrings(lesson, texts);
  const blob = texts.join('\n');
  if (blob.includes('民法典')) return true;
  if (LEGAL_CONCLUSIONS.some((phrase) => blob.includes(phrase))) return true;
  if (ARTICLE_RE.test(blob)) return true;
  for (const match of blob.matchAll(/《([^》\n]{1,40})法》/gu)) {
    const title = match[1];
    if (/[方办语算写做用看听说加减乘除]$/u.test(title)) continue;
    return true;
  }
  return false;
}

export function generatedChapterSubtitleErrors(lesson) {
  const errors = [];
  (lesson?.chapters ?? []).forEach((chapter, ci) => {
    (chapter?.pages ?? []).forEach((page, pi) => {
      if (page?.layout !== 'chapter') return;
      if (typeof page.subtitle !== 'string' || !page.subtitle.trim()) errors.push(`chapters[${ci}].pages[${pi}].subtitle：生成新稿时章节页必须写副标题，一句不超过 60 字`);
    });
  });
  return errors;
}

function validateMascot(mascot, where, err) {
  if (!mascot || typeof mascot !== 'object' || Array.isArray(mascot)) { err(where, '必须是对象'); return; }
  if (mascot.id !== undefined && (typeof mascot.id !== 'string' || !MASCOT_IDS.has(mascot.id))) err(`${where}.id`, '必须是 peep-mentor、peep-counsel、peep-teacher，或旧 id mentor、counsel、buddy、default');
  if (mascot.enabled !== undefined && typeof mascot.enabled !== 'boolean') err(`${where}.enabled`, '必须是布尔值');
  if (mascot.palette !== undefined) {
    if (!mascot.palette || typeof mascot.palette !== 'object' || Array.isArray(mascot.palette)) err(`${where}.palette`, '必须是对象');
    else for (const [key, value] of Object.entries(mascot.palette)) {
      if (!PALETTE_KEYS.includes(key)) err(`${where}.palette.${key}`, '只支持 skin、hair、primary、secondary');
      else if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) err(`${where}.palette.${key}`, '必须是 #RRGGBB 颜色');
    }
  }
  if (mascot.hair !== undefined && (typeof mascot.hair !== 'string' || !MASCOT_HAIR.has(mascot.hair))) err(`${where}.hair`, `必须是 react-peeps 的发型。可选：${[...MASCOT_HAIR].join('、')}`);
  if (mascot.accessory !== undefined && (typeof mascot.accessory !== 'string' || !MASCOT_ACCESSORIES.has(mascot.accessory))) err(`${where}.accessory`, `必须是 react-peeps 的饰品。可选：${[...MASCOT_ACCESSORIES].join('、')}`);
  if (mascot.facialHair !== undefined && (typeof mascot.facialHair !== 'string' || !MASCOT_FACIAL_HAIR.has(mascot.facialHair))) err(`${where}.facialHair`, `必须是 react-peeps 的胡子。可选：${[...MASCOT_FACIAL_HAIR].join('、')}`);
  if (mascot.outfit !== undefined && !MASCOT_OUTFITS.has(mascot.outfit)) err(`${where}.outfit`, '必须是 darkSweater、blackTee、whiteShirt 之一（旧名 sweater、tee、shirt 也分别对应这三套衣服族）。换手势不会换成另一套衣服');
  if (mascot.pageOverrides !== undefined) {
    if (!Array.isArray(mascot.pageOverrides)) err(`${where}.pageOverrides`, '必须是数组');
    else {
      const seen = new Set();
      mascot.pageOverrides.forEach((item, index) => {
        const at = `${where}.pageOverrides[${index}]`;
        if (!item || typeof item !== 'object' || Array.isArray(item)) { err(at, '必须是对象'); return; }
        if (!Number.isInteger(item.pageIndex) || item.pageIndex < 0) err(`${at}.pageIndex`, '必须是非负整数');
        else if (seen.has(item.pageIndex)) err(`${at}.pageIndex`, '页码不能重复');
        else seen.add(item.pageIndex);
        if (!item.wardrobe || typeof item.wardrobe !== 'object' || Array.isArray(item.wardrobe)) { err(`${at}.wardrobe`, '必须是对象'); return; }
        validateMascot(item.wardrobe, `${at}.wardrobe`, err);
      });
    }
  }
}

function validateLook(look, where, err) {
  if (!look || typeof look !== 'object' || Array.isArray(look)) { err(where, '必须是对象'); return; }
  const known = new Set(['preset','hair','accessory','facialHair','outfit','skin']);
  for (const key of Object.keys(look)) if (!known.has(key)) err(`${where}.${key}`, '不能有这个字段。可以写 preset、hair、accessory、facialHair、outfit、skin');
  if (look.preset !== undefined && !LOOK_PRESETS.has(look.preset)) err(`${where}.preset`, `必须是 ${[...LOOK_PRESETS].join('、')}。preset 只是一组默认值，单项可以再覆盖`);
  if (look.hair !== undefined && (typeof look.hair !== 'string' || !MASCOT_HAIR.has(look.hair))) err(`${where}.hair`, `必须是 react-peeps 的发型。可选：${[...MASCOT_HAIR].join('、')}`);
  if (look.accessory !== undefined && (typeof look.accessory !== 'string' || !MASCOT_ACCESSORIES.has(look.accessory))) err(`${where}.accessory`, `必须是 react-peeps 的饰品。可选：${[...MASCOT_ACCESSORIES].join('、')}`);
  if (look.facialHair !== undefined && (typeof look.facialHair !== 'string' || !MASCOT_FACIAL_HAIR.has(look.facialHair))) err(`${where}.facialHair`, `必须是 react-peeps 的胡子。可选：${[...MASCOT_FACIAL_HAIR].join('、')}`);
  if (look.outfit !== undefined && !LOOK_OUTFITS.has(look.outfit)) err(`${where}.outfit`, '必须是 darkSweater、blackTee、whiteShirt 之一（旧名 sweater、tee、shirt 也分别对应这三套衣服族）。换手势不会换成另一套衣服');
  if (look.skin !== undefined && (typeof look.skin !== 'string' || !/^#[0-9a-f]{6}$/i.test(look.skin))) err(`${where}.skin`, '必须是 #RRGGBB。字段会保留，这一版渲染不使用');
}

export function lookFieldErrors(look, where = 'look') {
  const errors = [];
  validateLook(look, where, (at, problem) => errors.push(`${at}：${problem}`));
  return errors;
}

function noteCharacter(presenter, where, err) {
  if (presenter.character === undefined) return;
  const problem = characterRefProblem(presenter.character);
  if (problem) err(`${where}.character`, problem);
  else if (presenter.kind !== 'cartoon') err(`${where}.kind`, '角色档案只用于卡通讲解员，kind 必须是 cartoon');
  if (presenter.look !== undefined) err(`${where}.look`, '写了角色档案就不要再写 look。形象以角色档案里的版本为准');
}

export function presenterLookErrors(presenter, where = 'presenter') {
  const errors = [];
  const err = (at, problem) => errors.push(`${at}：${problem}`);
  if (!presenter || typeof presenter !== 'object' || Array.isArray(presenter)) { err(where, '必须是对象'); return errors; }
  if (!PRESENTER_KINDS.has(presenter.kind)) err(`${where}.kind`, '必须是 cartoon、real 或 none。真人视频用 real；旧稿里的 video 同样表示真人');
  if (presenter.look !== undefined) validateLook(presenter.look, `${where}.look`, err);
  noteCharacter(presenter, where, err);
  return errors;
}

function validatePresenter(presenter, pages, err) {
  const where = 'meta.presenter';
  if (!presenter || typeof presenter !== 'object' || Array.isArray(presenter)) { err(where, '必须是对象'); return; }
  if (!PRESENTER_KINDS.has(presenter.kind)) { err(`${where}.kind`, '必须是 cartoon、real 或 none。真人视频用 real；旧稿里的 video 同样表示真人'); return; }
  if (presenter.look !== undefined) validateLook(presenter.look, `${where}.look`, err);
  noteCharacter(presenter, where, err);
  if (presenter.kind === 'cartoon' || presenter.kind === 'none') return;
  if (!isText(presenter.src) || path.extname(presenter.src).toLowerCase() !== '.mp4' || /^(?:[a-z][a-z\d+.-]*:\/\/|data:|blob:|\\\\|\/\/)/i.test(presenter.src)) err(`${where}.src`, '必须是本地 MP4 文件路径，不能是网络地址');
  if (presenter.layout !== undefined && !PRESENTER_LAYOUTS.has(presenter.layout)) err(`${where}.layout`, '必须是 pip、full 或 hidden');
  if (!Array.isArray(presenter.segments) || presenter.segments.length !== pages.length) { err(`${where}.segments`, `必须逐页提供 ${pages.length} 个片段`); return; }
  let previousEnd = 0;
  presenter.segments.forEach((segment, index) => {
    const at = `${where}.segments[${index}]`;
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) { err(at, '必须是对象'); return; }
    const pageIndex = segment.pageIndex;
    if (pageIndex !== index) err(`${at}.pageIndex`, `必须按讲稿顺序填写 ${index}`);
    if (!Number.isInteger(segment.startMs) || !Number.isInteger(segment.endMs) || segment.startMs < 0 || segment.endMs <= segment.startMs || segment.startMs < previousEnd) err(`${at}.startMs/endMs`, '源片起止时刻必须是非负整数毫秒、递增且不重叠');
    else previousEnd = segment.endMs;
    if (segment.layout !== undefined && !PRESENTER_LAYOUTS.has(segment.layout)) err(`${at}.layout`, '必须是 pip、full 或 hidden');
    const expected = pages[index]?.narration?.length;
    if (!Array.isArray(segment.sentences) || segment.sentences.length !== expected) { err(`${at}.sentences`, `必须与本页 ${expected ?? 0} 句旁白一一对应`); return; }
    let previousSentenceEnd = 0;
    segment.sentences.forEach((sentence, si) => {
      const sat = `${at}.sentences[${si}]`;
      if (!sentence || !Number.isInteger(sentence.startMs) || !Number.isInteger(sentence.endMs) || sentence.startMs < previousSentenceEnd || sentence.endMs <= sentence.startMs || sentence.endMs > segment.endMs - segment.startMs) err(sat, '句时刻须为相对片段起点的整数毫秒、按顺序且位于片段内');
      else previousSentenceEnd = sentence.endMs;
    });
  });
}

const TAG_ALLOW = {
  legal: ['普法', '法律', '民法典', '合同', '借款', '利息', '诉讼', '债权'],
  tech: ['编程', '代码', '软件', '人工智能', 'AI编程', '工具', '开发'],
};

const lessonSurface = (lesson) => {
  const parts = [];
  const walk = (value) => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(lesson?.meta?.title);
  walk(lesson?.chapters);
  return parts.join('\n');
};

/** 旧稿可以没有 meta.tags。写了就必须是 3–5 个、每个 2–6 字，并且是讲稿里出现过的词或领域通用词。生成器传 requireTags。 */
export function tagIssues(lesson, options = {}) {
  const tags = lesson?.meta?.tags;
  const issues = [];
  if (tags === undefined) {
    if (options.requireTags) issues.push('需要 3–5 个主题词，每个 2–6 字，必须出现在讲稿里或是领域通用词');
    return issues;
  }
  if (!Array.isArray(tags) || tags.length < 3 || tags.length > 5) {
    issues.push('需要 3–5 个主题词');
    return issues;
  }
  const blob = lessonSurface(lesson);
  const allow = new Set(TAG_ALLOW[lesson?.meta?.domain] ?? []);
  tags.forEach((tag, index) => {
    if (typeof tag !== 'string') { issues.push(`第 ${index + 1} 个必须是字符串`); return; }
    const word = tag.trim().replace(/^#+/u, '');
    const n = Array.from(word).length;
    if (n < 2 || n > 6) issues.push(`「${word}」须为 2–6 字`);
    else if (!blob.includes(word) && !allow.has(word)) issues.push(`「${word}」不是讲稿里的主题词，也不是领域通用词`);
  });
  return issues;
}

export function validateLesson(x, options = {}) {
  const errors = [];
  const warnings = [];
  const packs = [];
  const human = [];
  const domainSummary = [];
  const err = (where, problem) => errors.push(`${where}：${problem}`);
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {ok: false, errors: ['根节点必须是对象']};
  const meta = x.meta;
  if (!meta || meta.format !== 'lesson') err('meta.format', '必须为 lesson');
  if (!isText(meta?.title)) err('meta.title', '必须是非空字符串');
  if (!['tech', 'legal'].includes(meta?.domain)) err('meta.domain', '必须是 tech 或 legal');
  if (!['zh', 'en'].includes(meta?.lang)) err('meta.lang', '必须是 zh 或 en');
  if (typeof meta?.brand === 'string') {
    if (!parseBrandRef(meta.brand)) err('meta.brand', brandRefProblem(meta.brand));
  } else if (meta?.brand !== undefined && (!meta.brand || typeof meta.brand !== 'object' || Array.isArray(meta.brand))) {
    err('meta.brand', '写成「客户id」或「客户id@版本」。旧稿也可以继续用对象');
  } else if (meta?.brand && typeof meta.brand === 'object') {
    if (meta.brand.name !== undefined && typeof meta.brand.name !== 'string') err('meta.brand.name', '必须是字符串');
    if (meta.brand.primary !== undefined && (typeof meta.brand.primary !== 'string' || !/^#[0-9a-f]{6}$/i.test(meta.brand.primary))) err('meta.brand.primary', '必须是 #RRGGBB 颜色');
  }
  if (meta?.episode !== undefined && (!Number.isInteger(meta.episode) || meta.episode < 1 || meta.episode > 999)) err('meta.episode', '必须是 1 到 999 的整数');
  if (meta?.lawyer !== undefined) {
    const named = typeof meta.lawyer === 'string' && meta.lawyer.trim();
    const indexed = Number.isInteger(meta.lawyer) && meta.lawyer >= 1;
    if (!named && !indexed) err('meta.lawyer', '写成律师姓名，或从 1 开始的序号');
  }
  for (const k of ['facts','sources']) if (meta?.[k] !== undefined && !Array.isArray(meta[k])) err(`meta.${k}`, '必须是数组');
  if (meta?.disclaimer !== undefined && typeof meta.disclaimer !== 'string') err('meta.disclaimer', '必须是字符串');
  if (meta?.voice !== undefined) {
    if (!meta.voice || typeof meta.voice !== 'object' || Array.isArray(meta.voice)) err('meta.voice', '必须是对象');
    else {
      if (meta.voice.provider !== undefined && !['minimax','aliyun','volcengine','mock'].includes(meta.voice.provider)) err('meta.voice.provider', '不支持的配音提供者');
      for (const k of ['voiceId','model']) if (meta.voice[k] !== undefined && (!isText(meta.voice[k]))) err(`meta.voice.${k}`, '必须是非空字符串');
      if (meta.voice.subtitles !== undefined && !['karaoke','line','off'].includes(meta.voice.subtitles)) err('meta.voice.subtitles', '必须是 karaoke、line 或 off');
      if (meta.voice.speed !== undefined && (typeof meta.voice.speed !== 'number' || meta.voice.speed < .5 || meta.voice.speed > 2)) err('meta.voice.speed', '必须在 0.5 至 2 之间');
    }
  }
  if (meta?.mascot !== undefined) validateMascot(meta.mascot, 'meta.mascot', err);
  if (!Array.isArray(x.chapters) || !x.chapters.length) err('chapters', '至少需要一个章节');
  (Array.isArray(x.chapters) ? x.chapters : []).forEach((c, ci) => {
    if (!c || !isText(c.title)) err(`chapters[${ci}].title`, '必须是非空字符串');
    if (!Array.isArray(c.pages) || !c.pages.length) err(`chapters[${ci}].pages`, '至少需要一页');
    (Array.isArray(c.pages) ? c.pages : []).forEach((p, pi) => {
      const at = `chapters[${ci}].pages[${pi}]`;
      let imageData;
      let logoData;
      if (!p || typeof p !== 'object' || Array.isArray(p)) { err(at, '必须是对象'); return; }
      if (!LAYOUTS.has(p.layout)) { err(`${at}.layout`, `不支持“${p.layout ?? '(缺失)'}”；请改为 ${[...LAYOUTS].join('、')} 之一`); return; }
      if (!isText(p.title)) err(`${at}.title`, '必须是非空字符串；请填写本页标题');
      const spec = specs[p.layout];
      for (const [field, rule] of Object.entries(spec.fields ?? {})) {
        const value = p[field];
        if (rule.required && (value === undefined || value === null || value === '')) { err(`${at}.${field}`, `缺少必填字段；${rule.hint}`); continue; }
        if (value === undefined || value === null) continue;
        if (rule.type === 'text') {
          if (typeof value !== 'string' || (rule.nonEmpty && !value.trim())) err(`${at}.${field}`, `必须是${rule.nonEmpty ? '非空' : ''}字符串；${rule.hint}`);
          else if (rule.max && count(value) > rule.max) err(`${at}.${field}`, `当前 ${count(value)} 字，最多 ${rule.max} 字；请压缩文案`);
        }
      }
      const list = (field, min, max, label, validator) => {
        const value = p[field];
        if (!Array.isArray(value) || value.length < min || value.length > max) { err(`${at}.${field}`, `${label}须为 ${min}–${max} 项；请增删到范围内`); return; }
        value.forEach((item, i) => validator(item, i));
      };
      if (p.layout === 'cover') {
        if (!isText(p.subtitle)) err(`${at}.subtitle`, '封面必须有副标题；请补充一句概括');
        if (p.smallText !== undefined && (typeof p.smallText !== 'string' || count(p.smallText) > 30)) err(`${at}.smallText`, '小字最多 30 字；请缩短说明');
      }
      if (p.layout === 'steps') list('items', 2, 6, 'steps 要点', (v, i) => { if (!isText(v)) err(`${at}.items[${i}]`, '必须是非空字符串'); else if (count(v) > 32) err(`${at}.items[${i}]`, '每条最多 32 字；请拆页或精简'); });
      if (p.layout === 'chapter' && p.kicker !== undefined && (typeof p.kicker !== 'string' || count(p.kicker) > 24)) err(`${at}.kicker`, '最多 24 字；请精简章节提示');
      if (p.layout === 'quote') {
        for (const k of ['quote','source']) if (!isText(p[k])) err(`${at}.${k}`, k === 'source' ? '必须提供出处行；请注明法规、作者或来源' : '必须填写引用原文');
        if (count(p.quote ?? '') > 180) err(`${at}.quote`, '引用最多 180 字；请摘取关键段落');
        if (count(p.source ?? '') > 80) err(`${at}.source`, '出处最多 80 字；请保留可核查信息');
        if (p.emphasis !== undefined && (typeof p.emphasis !== 'string' || count(p.emphasis) > 24)) err(`${at}.emphasis`, '重点词最多 24 字；请缩短标注');
        else if (isText(p.emphasis) && isText(p.quote) && !p.quote.includes(p.emphasis)) warnings.push(`${at}.emphasis：重点词“${p.emphasis}”不在引用原文中，渲染时不会绘制下划线`);
      }
      if (p.layout === 'compare') {
        for (const k of ['leftTitle','rightTitle']) if (!isText(p[k]) || count(p[k] ?? '') > 24) err(`${at}.${k}`, '必须填写且最多 24 字；请写短栏标题');
        for (const k of ['left','right']) list(k, 2, 4, `${k} 对比内容`, (v, i) => { if (!isText(v)) err(`${at}.${k}[${i}]`, '必须是非空字符串'); else if (count(v) > 42) err(`${at}.${k}[${i}]`, '每条最多 42 字；请压缩内容'); });
      }
      if (p.layout === 'question') {
        if (!isText(p.question) || count(p.question ?? '') > 100) err(`${at}.question`, '问题必填且最多 100 字；请写成一个清楚的问题');
        if (p.options !== undefined) list('options', 2, 4, '选项', (v, i) => { if (!isText(v) || count(v) > 32) err(`${at}.options[${i}]`, '每个选项须非空且最多 32 字；请精简'); });
        if (p.options === undefined && p.openQuestion !== true) err(`${at}.options`, '请提供 2–4 个选项，或设置 openQuestion: true 表示开放问题');
        if (p.answer !== undefined && (typeof p.answer !== 'string' && !Number.isInteger(p.answer))) err(`${at}.answer`, '答案须为选项文字或从 0 开始的序号；请检查答案格式');
        if (p.answerText !== undefined && (typeof p.answerText !== 'string' || count(p.answerText) > 100)) err(`${at}.answerText`, '揭晓说明最多 100 字；请精简');
        if (p.answer === undefined && p.answerText === undefined) err(`${at}.answer`, '请填写揭晓答案，供下一页或后半段显示');
      }
      if (p.layout === 'flow') list('steps', 3, 6, '流程步骤', (v, i) => {
        if (typeof v === 'string') { if (!isText(v) || count(v) > 30) err(`${at}.steps[${i}]`, '每步须非空且最多 30 字；请精简'); return; }
        if (!v || typeof v !== 'object' || Array.isArray(v)) { err(`${at}.steps[${i}]`, '须为标题字符串，或含 title 的对象'); return; }
        if (!isText(v.title) || count(v.title) > 6) err(`${at}.steps[${i}].title`, '卡片标题须非空且最多 6 字');
        if (v.icon !== undefined && !isIconName(v.icon)) err(`${at}.steps[${i}].icon`, '必须是图标库里的名字');
        if (v.points !== undefined) {
          if (!Array.isArray(v.points) || v.points.length < 1 || v.points.length > 3) err(`${at}.steps[${i}].points`, '小点为 1–3 条');
          else v.points.forEach((point, pi) => { if (!isText(point) || count(point) > 8) err(`${at}.steps[${i}].points[${pi}]`, '每条小点须非空且最多 8 字'); });
        }
      });
      if (p.layout === 'recap') list('items', 3, 5, '回顾要点', (v, i) => { if (!isText(v) || count(v) > 36) err(`${at}.items[${i}]`, '每条须非空且最多 36 字；请精简'); });
      if (p.layout === 'screenshot') {
        if (!isText(p.image)) err(`${at}.image`, '必须填写图片路径；请提供截图文件');
        else {
          const imagePath = path.resolve(process.cwd(), p.image);
          if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) err(`${at}.image`, `找不到截图“${p.image}”；请放入仓库并填写可访问的文件路径`);
          else {
            const mime = ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(imagePath).toLowerCase()];
            if (!mime) err(`${at}.image`, '图片格式请使用 PNG、JPG、WebP 或 SVG');
            else imageData = `data:${mime};base64,${fs.readFileSync(imagePath).toString('base64')}`;
          }
        }
        list('callouts', 1, 4, '截图标注', (box, i) => {
          if (!box || typeof box !== 'object') { err(`${at}.callouts[${i}]`, '须为对象，含 x、y、width、height；请补齐框坐标'); return; }
          for (const key of ['x','y','width','height']) if (typeof box[key] !== 'number' || box[key] < 0 || box[key] > 1) err(`${at}.callouts[${i}].${key}`, '坐标与尺寸必须在 0–1；请使用相对画面比例');
          if (typeof box.x === 'number' && typeof box.width === 'number' && box.x + box.width > 1) err(`${at}.callouts[${i}]`, '标注框超出图片右边界；请调小 x 或 width');
          if (typeof box.y === 'number' && typeof box.height === 'number' && box.y + box.height > 1) err(`${at}.callouts[${i}]`, '标注框超出图片下边界；请调小 y 或 height');
          if (box.label !== undefined && (typeof box.label !== 'string' || count(box.label) > 24)) err(`${at}.callouts[${i}].label`, '标注最多 24 字；请精简');
          if (box.type !== undefined && !['box','arrow','magnify'].includes(box.type)) err(`${at}.callouts[${i}].type`, '类型须为 box、arrow 或 magnify；请修正类型');
        });
      }
      if (p.layout === 'compare') {
        for (const key of ['leftTone', 'rightTone']) if (p[key] !== undefined && !['ok', 'alert', 'neutral'].includes(p[key])) err(`${at}.${key}`, '须为 ok、alert 或 neutral');
      }
      if (p.layout === 'points') list('items', 2, 4, '图标卡', (card, i) => {
        if (!card || typeof card !== 'object' || Array.isArray(card)) { err(`${at}.items[${i}]`, '须为对象，含 icon、title、text'); return; }
        if (!isIconName(card.icon)) err(`${at}.items[${i}].icon`, '必须是图标库里的名字');
        if (!isText(card.title) || count(card.title) > 6) err(`${at}.items[${i}].title`, '小标题须非空且最多 6 字');
        if (!isText(card.text) || count(card.text) > 20) err(`${at}.items[${i}].text`, '说明须非空且最多 20 字');
      });
      if (p.layout === 'statement') {
        list('lines', 2, 3, '大字', (v, i) => { if (!isText(v) || count(v) > 12) err(`${at}.lines[${i}]`, '每行须非空且最多 12 字'); });
        if (p.alertLast !== undefined && typeof p.alertLast !== 'boolean') err(`${at}.alertLast`, '须为布尔值');
        if (!['iou', 'contract', 'notice'].includes(p.prop)) err(`${at}.prop`, '须为 iou、contract 或 notice');
        list('propLines', 2, 6, '道具正文', (v, i) => { if (!isText(v) || count(v) > 18) err(`${at}.propLines[${i}]`, '每行须非空且最多 18 字'); });
        const lineCount = Array.isArray(p.propLines) ? p.propLines.length : 0;
        if (!Number.isInteger(p.circle) || p.circle < 1 || p.circle > lineCount) err(`${at}.circle`, '须是从 1 开始、不超过正文行数的行号');
      }
      if (p.layout === 'timeline') {
        list('nodes', 2, 4, '时间节点', (node, i) => {
          if (!node || typeof node !== 'object' || Array.isArray(node)) { err(`${at}.nodes[${i}]`, '须为对象，含 label'); return; }
          if (!isText(node.label) || count(node.label) > 6) err(`${at}.nodes[${i}].label`, '节点名须非空且最多 6 字');
        });
        if (p.segments !== undefined) {
          const expect = Array.isArray(p.nodes) ? p.nodes.length - 1 : 0;
          if (!Array.isArray(p.segments) || p.segments.length !== expect) err(`${at}.segments`, `区段数量须比节点少 1，当前应为 ${expect} 段`);
          else p.segments.forEach((seg, i) => {
            if (!seg || typeof seg !== 'object' || Array.isArray(seg)) { err(`${at}.segments[${i}]`, '须为对象，含 label 和 tone'); return; }
            if (!isText(seg.label) || count(seg.label) > 8) err(`${at}.segments[${i}].label`, '区段标注须非空且最多 8 字');
            if (!['accent', 'alert'].includes(seg.tone)) err(`${at}.segments[${i}].tone`, '须为 accent 或 alert');
          });
        }
        if (p.captions !== undefined) {
          if (!Array.isArray(p.captions) || p.captions.length < 1 || p.captions.length > 2) err(`${at}.captions`, '轴上说明为 1–2 个');
          else p.captions.forEach((cap, i) => {
            if (!cap || typeof cap !== 'object' || Array.isArray(cap)) { err(`${at}.captions[${i}]`, '须为对象，含 icon 和 text'); return; }
            if (!isIconName(cap.icon)) err(`${at}.captions[${i}].icon`, '必须是图标库里的名字');
            if (!isText(cap.text) || count(cap.text) > 10) err(`${at}.captions[${i}].text`, '说明须非空且最多 10 字');
          });
        }
        if (p.quote !== undefined || p.source !== undefined || p.emphasis !== undefined) {
          if (!isText(p.quote)) err(`${at}.quote`, '法条卡须填写原文');
          if (!isText(p.source)) err(`${at}.source`, '法条卡须填写出处');
          if (p.emphasis !== undefined && (!isText(p.emphasis) || count(p.emphasis) > 24)) err(`${at}.emphasis`, '重点词最多 24 字');
          else if (isText(p.emphasis) && isText(p.quote) && !p.quote.includes(p.emphasis)) warnings.push(`${at}.emphasis：重点词“${p.emphasis}”不在法条原文中，渲染时不会绘制强调`);
        }
      }
      if (p.layout === 'checklist') list('items', 4, 8, '核对项', (v, i) => { if (!isText(v) || count(v) > 16) err(`${at}.items[${i}]`, '每项须非空且最多 16 字'); });
      if (p.layout === 'chapter' && p.points !== undefined) list('points', 2, 3, '本章要点', (point, i) => {
        if (!point || typeof point !== 'object' || Array.isArray(point)) { err(`${at}.points[${i}]`, '须为对象，含 icon 和 text'); return; }
        if (!isIconName(point.icon)) err(`${at}.points[${i}].icon`, '必须是图标库里的名字');
        if (!isText(point.text) || count(point.text) > 8) err(`${at}.points[${i}].text`, '每条须非空且最多 8 字');
      });
      const checkBasis = (text) => {
        if (!isText(text)) return;
        if (!BASIS_RE.test(String(text).trim())) { err(`${at}.basis`, '只能写书名和条号，例如《民法典》第六百八十条；多项用分号隔开'); return; }
        if (meta?.domain !== 'legal') return;
        const known = new Set(corpusNumbers());
        for (const cite of basisCitations(text)) {
          if (!cite.book.includes('民法典')) err(`${at}.basis`, `《${cite.book}》不在法条白名单。legal 的依据只能写民法典里的白名单条号`);
          else if (!known.has(cite.number)) err(`${at}.basis`, `第${cite.number}条不在法条白名单里`);
        }
      };
      if (p.layout === 'bignumber') {
        if (!isText(p.number) || count(p.number) > 4) err(`${at}.number`, '数字必填且最多 4 个字符');
        if (!isText(p.unit) || count(p.unit) > 4) err(`${at}.unit`, '单位必填且最多 4 字');
        if (!isText(p.name) || count(p.name) > 12) err(`${at}.name`, '名称必填且最多 12 字');
        if (!isText(p.basis) || count(p.basis) > 40) err(`${at}.basis`, '依据必填且最多 40 字');
        else checkBasis(p.basis);
        if (!isIconName(p.cardIcon)) err(`${at}.cardIcon`, '必须是图标库里的名字');
        if (!isText(p.cardText) || count(p.cardText) > 14) err(`${at}.cardText`, '说明卡关键句必填且最多 14 字');
        if (p.cardEmphasis !== undefined && (!isText(p.cardEmphasis) || count(p.cardEmphasis) > 8)) err(`${at}.cardEmphasis`, '强调段最多 8 字');
        else if (isText(p.cardEmphasis) && isText(p.cardText) && !p.cardText.includes(p.cardEmphasis)) warnings.push(`${at}.cardEmphasis：强调段不在说明卡文字里，渲染时不会上色`);
        const axis = [p.axisFrom, p.axisTo, p.axisSpan];
        if (axis.some((item) => item !== undefined && item !== null && item !== '')) {
          if (!isText(p.axisFrom) || count(p.axisFrom) > 8) err(`${at}.axisFrom`, '进度轴左端必填且最多 8 字');
          if (!isText(p.axisTo) || count(p.axisTo) > 8) err(`${at}.axisTo`, '进度轴右端必填且最多 8 字');
          if (!isText(p.axisSpan) || count(p.axisSpan) > 8) err(`${at}.axisSpan`, '进度轴跨度必填且最多 8 字');
        }
      }
      if (p.layout === 'saying') {
        list('lines', 1, 2, '观点', (v, i) => { if (!isText(v) || count(v) > 16) err(`${at}.lines[${i}]`, '每行须非空且最多 16 字'); });
        const joined = Array.isArray(p.lines) ? p.lines.join('') : '';
        if (count(joined) > 28) err(`${at}.lines`, '两行合计最多 28 字');
        if (p.emphasis !== undefined && (!isText(p.emphasis) || count(p.emphasis) > 8)) err(`${at}.emphasis`, '强调段最多 8 字');
        else if (isText(p.emphasis) && !joined.includes(p.emphasis)) warnings.push(`${at}.emphasis：强调段不在观点里，渲染时不会上色`);
        if (!isText(p.name) || count(p.name) > 8) err(`${at}.name`, '姓名必填且最多 8 字');
        if (!isText(p.org) || count(p.org) > 16) err(`${at}.org`, '机构必填且最多 16 字');
        const lawHit = collectStrings(p).map(sayingLawHit).find(Boolean);
        if (lawHit) err(at, `律师观点不能写法条字样“${lawHit}”。法条请改用 quote`);
        if (isText(p.logo)) {
          const logoPath = path.resolve(process.cwd(), p.logo);
          if (!fs.existsSync(logoPath) || !fs.statSync(logoPath).isFile()) err(`${at}.logo`, `找不到标记图“${p.logo}”`);
          else {
            const mime = ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(logoPath).toLowerCase()];
            if (!mime) err(`${at}.logo`, '标记图请使用 PNG、JPG、WebP 或 SVG');
            else logoData = `data:${mime};base64,${fs.readFileSync(logoPath).toString('base64')}`;
          }
        }
      }
      if (p.layout === 'levels') list('items', 2, 3, '风险档', (card, i) => {
        if (!card || typeof card !== 'object' || Array.isArray(card)) { err(`${at}.items[${i}]`, '须为对象，含 tone、label、icon、text'); return; }
        if (!['high', 'mid', 'low'].includes(card.tone)) err(`${at}.items[${i}].tone`, '只能是 high、mid 或 low');
        if (!isText(card.label) || count(card.label) > 4) err(`${at}.items[${i}].label`, '等级标签须非空且最多 4 字');
        if (!isIconName(card.icon)) err(`${at}.items[${i}].icon`, '必须是图标库里的名字');
        if (!isText(card.text) || count(card.text) > 16) err(`${at}.items[${i}].text`, '关键词须非空且最多 16 字');
      });
      if (p.layout === 'case') {
        for (const key of ['caseLabel', 'caption', 'fictionLabel']) {
          if (p[key] !== undefined && p[key] !== CASE_LABEL) err(`${at}.${key}`, `这行字固定为“${CASE_LABEL}”，不能改`);
        }
        const looks = new Set(['male', 'female', 'peep-mentor', 'peep-counsel', 'peep-teacher']);
        // resolveMascotId(空) 固定返回 peep-mentor。比较造型时把 preset 同时放进 id，别名才能落到对应的人。
        const castId = (preset) => looks.has(preset) ? resolveLook({preset, id: preset}, meta?.domain).id : '';
        list('roles', 2, 2, '角色', (role, i) => {
          if (!role || typeof role !== 'object' || Array.isArray(role)) { err(`${at}.roles[${i}]`, '须为对象，含 name、role、look、pose'); return; }
          if (!isText(role.name) || count(role.name) > 4) err(`${at}.roles[${i}].name`, '姓名须非空且最多 4 字');
          if (!isText(role.role) || count(role.role) > 6) err(`${at}.roles[${i}].role`, '身份须非空且最多 6 字');
          if (!looks.has(role.look)) err(`${at}.roles[${i}].look`, '须是 male、female、peep-mentor、peep-counsel 或 peep-teacher');
          if (!MASCOT_POSES.has(role.pose)) err(`${at}.roles[${i}].pose`, '须是八个讲解姿势之一');
        });
        if (Array.isArray(p.roles) && p.roles.length === 2 && p.roles.every((role) => role && looks.has(role.look))) {
          const ids = p.roles.map((role) => castId(role.look));
          if (ids[0] && ids[0] === ids[1]) err(`${at}.roles`, '两个角色的造型不能相同');
          const wardrobe = resolveCartoonWardrobe(x.meta);
          const presenterId = wardrobe ? resolveLook({...wardrobe, id: wardrobe.preset}, meta?.domain).id : '';
          if (presenterId && ids.includes(presenterId)) err(`${at}.roles`, '角色造型不能和右下角讲解员相同');
        }
        list('lines', 2, 4, '对话', (line, i) => {
          if (!line || typeof line !== 'object' || Array.isArray(line)) { err(`${at}.lines[${i}]`, '须为对象，含 who 和 text'); return; }
          if (line.who !== 0 && line.who !== 1) err(`${at}.lines[${i}].who`, '须为 0 或 1');
          if (!isText(line.text) || count(line.text) > 16) err(`${at}.lines[${i}].text`, '每句须非空且最多 16 字');
          if (i > 0 && Array.isArray(p.lines) && p.lines[i - 1]?.who === line.who) err(`${at}.lines[${i}]`, '对话要左右交替');
        });
        const payOn = p.payLabel !== undefined || p.payAmount !== undefined;
        if (payOn) {
          if (!isText(p.payLabel) || count(p.payLabel) > 4) err(`${at}.payLabel`, '转账小条名称须非空且最多 4 字');
          if (!isText(p.payAmount) || count(p.payAmount) > 8) err(`${at}.payAmount`, '转账金额须非空且最多 8 字');
        }
        if (!isIconName(p.verdictIcon)) err(`${at}.verdictIcon`, '必须是图标库里的名字');
        if (!isText(p.verdictLabel) || count(p.verdictLabel) > 4) err(`${at}.verdictLabel`, '结论标签须非空且最多 4 字');
        if (!isText(p.verdictText) || count(p.verdictText) > 20) err(`${at}.verdictText`, '结论须非空且最多 20 字');
        if (p.verdictEmphasis !== undefined && (!isText(p.verdictEmphasis) || count(p.verdictEmphasis) > 8)) err(`${at}.verdictEmphasis`, '强调段最多 8 字');
        else if (isText(p.verdictEmphasis) && isText(p.verdictText) && !p.verdictText.includes(p.verdictEmphasis)) warnings.push(`${at}.verdictEmphasis：强调段不在结论里，渲染时不会上色`);
      }
      if (p.layout === 'document') {
        if (!['transfer', 'chat'].includes(p.kind)) err(`${at}.kind`, '须为 transfer 或 chat');
        if (p.kind === 'chat' && isText(p.amount)) err(`${at}.amount`, '聊天记录不写金额');
        if (p.screenTitle !== undefined && (!isText(p.screenTitle) || count(p.screenTitle) > 6)) err(`${at}.screenTitle`, '示意页标题最多 6 字');
        if (p.status !== undefined && (!isText(p.status) || count(p.status) > 6)) err(`${at}.status`, '状态最多 6 字');
        if (p.amount !== undefined && p.kind !== 'chat' && (!isText(p.amount) || count(p.amount) > 12)) err(`${at}.amount`, '金额最多 12 字');
        list('rows', 3, 6, '示意行', (row, i) => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) { err(`${at}.rows[${i}]`, '须为对象，含 name 和 value'); return; }
          if (!isText(row.name) || count(row.name) > 6) err(`${at}.rows[${i}].name`, '名称须非空且最多 6 字');
          if (!isText(row.value) || count(row.value) > 16) err(`${at}.rows[${i}].value`, '值须非空且最多 16 字');
        });
        const rowCount = Array.isArray(p.rows) ? p.rows.length : 0;
        if (!Number.isInteger(p.highlight) || p.highlight < 1 || p.highlight > rowCount) err(`${at}.highlight`, '须是从 1 开始、不超过行数的行号');
        if (!isText(p.point) || count(p.point) > 18) err(`${at}.point`, '关键句必填且最多 18 字');
        if (p.emphasis !== undefined && (!isText(p.emphasis) || count(p.emphasis) > 8)) err(`${at}.emphasis`, '强调段最多 8 字');
        else if (isText(p.emphasis) && isText(p.point) && !p.point.includes(p.emphasis)) warnings.push(`${at}.emphasis：强调段不在关键句里，渲染时不会上色`);
        const brandHit = collectStrings(p).map(documentBrandHit).find(Boolean);
        if (brandHit) err(at, `示意图不能出现真实品牌“${brandHit}”`);
      }
      if (p.layout === 'table') {
        list('rows', 2, 4, '对照行', (row, i) => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) { err(`${at}.rows[${i}]`, '须为对象，含 situation 和 result'); return; }
          if (!isText(row.situation) || count(row.situation) > 24) err(`${at}.rows[${i}].situation`, '情形须非空且最多 24 字');
          if (!isText(row.result) || count(row.result) > 16) err(`${at}.rows[${i}].result`, '结果须非空且最多 16 字');
          if (row.emphasis !== undefined && (!isText(row.emphasis) || count(row.emphasis) > 8)) err(`${at}.rows[${i}].emphasis`, '加粗词最多 8 字');
          else if (isText(row.emphasis) && isText(row.result) && !row.result.includes(row.emphasis)) warnings.push(`${at}.rows[${i}].emphasis：加粗词不在结果里，渲染时不会加粗`);
        });
        if (!isText(p.basis) || count(p.basis) > 40) err(`${at}.basis`, '依据必填且最多 40 字');
        else checkBasis(p.basis);
      }
      if (p.layout === 'code') {
        if (!isText(p.code)) err(`${at}.code`, '请填写代码内容');
        else if (p.code.split(/\r?\n/).length > 14) err(`${at}.code`, '代码最多 14 行；请拆成多页');
        if (p.language !== undefined && (typeof p.language !== 'string' || count(p.language) > 16)) err(`${at}.language`, '语言标签最多 16 字；请精简');
        if (p.highlightLines !== undefined && (!Array.isArray(p.highlightLines) || p.highlightLines.some((n) => !Number.isInteger(n) || n < 1 || n > (p.code?.split(/\r?\n/).length ?? 0)))) err(`${at}.highlightLines`, '高亮行须是代码范围内从 1 开始的行号；请核对行数');
      }
      if (!Array.isArray(p.narration) || !p.narration.length) err(`${at}.narration`, '至少需要一句旁白');
      const maxReveal = revealTargetsFor(p).length;
      (Array.isArray(p.narration) ? p.narration : []).forEach((n, ni) => {
        const na = `${at}.narration[${ni}]`;
        if (!n || !isText(n.text)) err(`${na}.text`, '必须是非空字符串');
        if (maxReveal > 0 && n?.reveal !== undefined && (!Number.isInteger(n.reveal) || n.reveal < 0 || n.reveal >= maxReveal)) err(`${na}.reveal`, `超出此版式可用范围 0–${maxReveal - 1}；请调整 reveal 序号`);
        if (n?.pose !== undefined && (typeof n.pose !== 'string' || !MASCOT_POSES.has(n.pose))) err(`${na}.pose`, '必须是 explain、point、check、warn、think、affirm、cheer 或 wave');
        if (n?.note !== undefined && (typeof n.note !== 'string' || !n.note.trim() || Array.from(n.note).length > 12)) err(`${na}.note`, '必须是 1 至 12 个字符');
      });
      if (!errors.some((e) => e.startsWith(at))) packs.push({ci, pi, imageData, logoData});
    });
  });
  for (const message of tagIssues(x, options)) err('meta.tags', message);
  if (meta?.domain === 'tech' && looksLikeLegalContent(x)) err('meta.domain', '看起来是法律内容，请把 domain 设为 legal，走律师审稿');
  if (meta?.presenter !== undefined) validatePresenter(meta.presenter, (Array.isArray(x.chapters) ? x.chapters : []).flatMap((chapter) => Array.isArray(chapter?.pages) ? chapter.pages : []), err);
  const themePick = resolveLessonTheme(x);
  if (themePick.error) err('meta.theme', themePick.error);
  if (themePick.warning) warnings.push(themePick.warning);
  const strictCopy = options.strictCopy === true || x.meta?.generatedBy === LESSON_GENERATED_BY;
  for (const message of copyLimitIssues(x)) {
    if (strictCopy) err('稿件字数', message);
    else warnings.push(`稿件字数：${message}`);
  }
  const hooks = options.domainHooks ?? [hookForDomain(meta?.domain)].filter(Boolean);
  for (const hook of hooks) {
    const result = hook(x) ?? {};
    const block = Array.isArray(result) ? result : result.block ?? [];
    const warn = Array.isArray(result) ? [] : result.warn ?? [];
    const needsHuman = Array.isArray(result) ? [] : result.human ?? [];
    for (const message of block) err('domain hook', message);
    for (const message of warn) warnings.push(`domain hook：${message}`);
    for (const message of needsHuman) human.push(`domain hook：${message}`);
    if (result.summary) domainSummary.push(result.summary);
  }
  for (const message of singleChapterWarning(x)) warnings.push(message);
  for (const message of cardEchoWarnings(x)) warnings.push(message);
  for (const message of layoutMixIssues(x)) warnings.push(`版式分布：${message}`);
  // 校验不改调用方的对象（审稿哈希、领域规则都要看原稿）。副本只注入内嵌截图数据。
  const lesson = errors.length ? null : structuredClone(x);
  if (lesson && themePick.theme) lesson.meta.theme = themePick.theme;
  if (lesson) for (const {ci, pi, imageData, logoData} of packs) {
    const p = lesson.chapters[ci].pages[pi];
    if (imageData) p.imageData = imageData;
    if (logoData) p.logoData = logoData;
  }
  return {ok: errors.length === 0, errors, warnings, human, domainSummary, lesson};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('用法：node scripts/lesson/validate-lesson.mjs <lesson.json>'); process.exit(1); }
  const r = validateLesson(JSON.parse(fs.readFileSync(file, 'utf8')));
  for (const e of r.errors) console.log(`✗ ${e}`);
  for (const w of r.warnings ?? []) console.log(`! ${w}`);
  for (const h of r.human ?? []) console.log(`? ${h}`);
  console.log(r.ok ? `✓ 校验通过：${file}` : `校验失败：${r.errors.length} 处`);
  process.exit(r.ok ? 0 : 1);
}
