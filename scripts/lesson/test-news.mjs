import assert from 'node:assert/strict';
import fs from 'node:fs';
import {appendDisclaimerPage, newsDisclaimerText} from './disclaimer-page.mjs';
import {copyLimitIssues} from './style-rules.mjs';
import {titleLines} from './title-wrap.mjs';
import {validateLesson} from './validate-lesson.mjs';

const cover = {
  layout: 'cover',
  title: '问界复盘',
  subtitle: '公开报道整理',
  narration: [{text: '下面只转述公开报道，不下结论。'}],
};
const quote = {
  layout: 'quote',
  title: '公司声明',
  quote: '未发生制动踏板支架底座断裂故障。',
  source: '澎湃转述 2026-10-08',
  narration: [{text: '公司声明是这么说的。', reveal: 0}],
};
const compare = {
  layout: 'compare',
  title: '两边说法',
  leftTitle: '甲方',
  rightTitle: '乙方',
  left: ['短', '一句'],
  right: ['这边写得很长很长很长很长很长', '另一句也更长'],
  narration: [{text: '两边都只是转述。'}],
};

function news(meta, pages = [cover]) {
  return {
    meta: {
      format: 'lesson',
      title: '问界复盘',
      domain: 'news',
      lang: 'zh',
      asOf: '2026-10-10 19:30（北京时间）',
      facts: [{text: '未发生断裂故障。', source: '澎湃转述 2026-10-08'}],
      ...meta,
    },
    chapters: [{title: '报道', pages}],
  };
}

const ok = validateLesson(news());
assert.equal(ok.ok, true, ok.errors.join('\n'));
assert.equal(validateLesson(news({asOf: ''})).ok, false);
assert.match(validateLesson(news({facts: []})).errors.join('\n'), /facts/);
assert.match(validateLesson(news({facts: [{text: '只有原文'}]})).errors.join('\n'), /source/);
assert.equal(validateLesson({...news(), meta: {...news().meta, domain: 'sports'}}).ok, false);

const judged = validateLesson(news({}, [{...cover, narration: [{text: '有人说这是实锤造假。'}]}]));
assert.equal(judged.ok, true, judged.errors.join('\n'));
assert.match(judged.warnings.join('\n'), /实锤/);
assert.match(judged.warnings.join('\n'), /造假/);

const sided = validateLesson(news({}, [cover, compare]));
assert.equal(sided.ok, true, sided.errors.join('\n'));
assert.match(sided.warnings.join('\n'), /1\.5|篇幅/);

const longSource = '甲'.repeat(40);
const hint = copyLimitIssues({
  meta: {domain: 'news'},
  chapters: [{pages: [{layout: 'quote', quote: '短句', source: longSource}]}],
}).join('\n');
assert.match(hint, /媒体名和日期/);
assert.doesNotMatch(hint, /法律全称/);
const legalHint = copyLimitIssues({
  meta: {domain: 'legal'},
  chapters: [{pages: [{layout: 'quote', quote: '短句', source: longSource}]}],
}).join('\n');
assert.match(legalHint, /法律全称和条号/);

const asOf = '2026-10-10 19:30（北京时间）';
assert.match(newsDisclaimerText({asOf, lang: 'zh'}), /据公开报道整理/);
assert.match(newsDisclaimerText({asOf, lang: 'zh'}), new RegExp(asOf));
assert.match(newsDisclaimerText({asOf, lang: 'zh'}), /不构成任何结论/);
const tail = appendDisclaimerPage({
  fps: 30,
  pages: [{index: 0, chapterIndex: 0, chapterTitle: '报道', pageInChapter: 0, endFrame: 90, layout: 'cover', title: '封面'}],
  chapters: [{title: '报道', endFrame: 90, endMs: 3000}],
}, {domain: 'news', lang: 'zh', asOf});
assert.equal(tail.added, true);
assert.equal(tail.timeline.pages.at(-1).layout, 'disclaimer');
assert.match(tail.timeline.pages.at(-1).fields.body, /不构成任何结论/);
assert.equal(appendDisclaimerPage(tail.timeline, {domain: 'legal', lang: 'zh', disclaimer: '不会加第二页'}).added, false);
const tech = appendDisclaimerPage(tail.timeline, {domain: 'tech', lang: 'zh', disclaimerTail: true});
assert.equal(tech.added, true);
assert.match(tech.body, /不构成专业意见/);

const disclaimerSrc = fs.readFileSync(new URL('../../template/src/lesson/layouts/Disclaimer.tsx', import.meta.url), 'utf8');
assert.match(disclaimerSrc, /maxEm:\s*26/);
const wrapped = titleLines(newsDisclaimerText({asOf, lang: 'zh'}), {maxEm: 26, maxLines: 4, subtitle: true});
assert.ok(wrapped.some((line) => line.includes('北京时间')));
assert.ok(wrapped.every((line) => !line.endsWith('北京') && !line.startsWith('时间')));

console.log('✓ 新闻领域：出处、免责页、定性词和篇幅只提醒');
