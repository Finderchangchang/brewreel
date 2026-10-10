import assert from 'node:assert/strict';
import {contrastFailures, copyContractTable, copyLimitIssues, LESSON_GENERATED_BY, resolveLessonTheme} from './style-rules.mjs';
import {validateLesson} from './validate-lesson.mjs';

const page = (layout, extra = {}) => ({layout, title: '短标题', narration: [{text: '一句旁白。'}], ...extra});
const lesson = (meta, pages) => ({meta, chapters: [{title: '章', pages}]});

const legal = resolveLessonTheme(lesson({domain: 'legal', title: '借条'}, [page('quote', {quote: '原文', source: '出处'})]));
assert.equal(legal.theme, 'paper');
assert.equal(legal.error, undefined);

const editorialLegal = resolveLessonTheme(lesson({domain: 'legal', theme: 'editorial', title: '借条'}, [page('quote', {quote: '原文', source: '出处'})]));
assert.match(editorialLegal.error, /杂志/);

const heavy = resolveLessonTheme(lesson({domain: 'tech', title: '工具'}, [
  page('screenshot', {image: 'a.png', callouts: [{x: 0, y: 0, width: .2, height: .2, label: '按钮'}]}),
  page('code', {code: 'a', language: 'js'}),
  page('steps', {items: ['一步']}),
]));
assert.equal(heavy.theme, 'product');

const plain = resolveLessonTheme(lesson({domain: 'tech', title: '概念'}, [page('steps', {items: ['一步']}), page('quote', {quote: '一句', source: '出处'})]));
assert.equal(plain.theme, 'lecture');

const legacy = resolveLessonTheme(lesson({domain: 'tech', theme: 'dark', title: '概念'}, [page('steps', {items: ['一步']})]));
assert.equal(legacy.theme, 'lecture');
assert.match(legacy.warning, /深色底/);

const unknown = resolveLessonTheme(lesson({domain: 'tech', theme: 'neon', title: '概念'}, [page('steps', {items: ['一步']})]));
assert.match(unknown.error, /不认识的风格/);

const contrast = contrastFailures();
assert.deepEqual(contrast, [], contrast.join('\n'));

const longCover = lesson({domain: 'tech', title: '概念'}, [page('cover', {title: '这是一个明显超过十二个字的封面标题', subtitle: '副题也写得太长了超过十六字'})]);
const warned = copyLimitIssues(longCover);
assert.ok(warned.some((line) => line.includes('请收成不超过 12 字')));
const coverLesson = {
  meta: {format: 'lesson', domain: 'tech', title: '概念', lang: 'zh'},
  chapters: [{title: '章', pages: [page('cover', {title: '这是一个明显超过十二个字的封面标题', subtitle: '一句概括'})]}],
};
const loose = validateLesson(coverLesson);
assert.equal(loose.ok, true, loose.errors?.join('\n'));
assert.ok(loose.warnings.some((line) => line.startsWith('稿件字数：')));
const strict = validateLesson(coverLesson, {strictCopy: true});
assert.equal(strict.ok, false);
assert.ok(strict.errors.some((line) => line.includes('请收成不超过 12 字')));
const marked = validateLesson({...coverLesson, meta: {...coverLesson.meta, generatedBy: LESSON_GENERATED_BY}});
assert.equal(marked.ok, false);
assert.ok(marked.errors.some((line) => line.includes('请收成不超过 12 字')));
assert.equal(marked.warnings.some((line) => line.startsWith('稿件字数：')), false);
const table = copyContractTable();
assert.match(table, /\| steps \|/);
assert.match(table, /14/);
assert.match(table, /40/);

console.log('✓ 风格：法律自动卷宗，截图加代码过三成自动产品台，其余讲台；杂志不能用于法律');
console.log('✓ 四套对比度都过 4.5:1；旧稿字数超限只警告，generatedBy 或 strictCopy 才报错');
