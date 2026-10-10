import assert from 'node:assert/strict';
import {validateLesson} from './validate-lesson.mjs';
import {buildTimeline, mapExplicitSentences, toSrt} from './timeline.mjs';

const base = {
  meta: {format: 'lesson', title: '真人口播测试', domain: 'tech', lang: 'zh'},
  chapters: [{title: '测试章', pages: [
    {layout: 'cover', title: '封面', subtitle: '副题', narration: [{text: '先讲第一句', reveal: 0}, {text: '再讲第二句'}]},
    {layout: 'steps', title: '步骤', items: ['第一步', '第二步'], narration: [{text: '进入下一页', reveal: 0}]},
  ]}],
};
const presenter = {
  kind: 'video', src: 'speaker.mp4', layout: 'pip', segments: [
    {pageIndex: 0, startMs: 1000, endMs: 5000, sentences: [{startMs: 100, endMs: 1700}, {startMs: 1900, endMs: 3800}]},
    {pageIndex: 1, startMs: 5000, endMs: 8000, layout: 'hidden', sentences: [{startMs: 0, endMs: 2900}]},
  ],
};
const withPresenter = (value) => ({...base, meta: {...base.meta, presenter: value}});
const errors = (value) => validateLesson(withPresenter(value)).errors.join('\n');

assert.equal(errors(presenter), '');
assert.equal(errors({...presenter, kind: 'real'}), '');
assert.equal(errors({...presenter, layout: 'full'}), '');
assert.match(errors({...presenter, src: 'https://example.com/speaker.mp4'}), /meta.presenter.src/);
assert.match(errors({...presenter, layout: 'large'}), /meta.presenter.layout/);
assert.match(errors({...presenter, segments: presenter.segments.slice(0, 1)}), /逐页提供 2 个片段/);
assert.match(errors({...presenter, segments: [presenter.segments[0], {...presenter.segments[1], pageIndex: 0}]}), /pageIndex/);
assert.match(errors({...presenter, segments: [{...presenter.segments[0], startMs: 1000.5}, presenter.segments[1]]}), /整数毫秒/);
assert.match(errors({...presenter, segments: [presenter.segments[0], {...presenter.segments[1], startMs: 4999}]}), /不重叠/);
assert.match(errors({...presenter, segments: [{...presenter.segments[0], sentences: presenter.segments[0].sentences.slice(0, 1)}, presenter.segments[1]]}), /sentences/);
assert.match(errors({...presenter, segments: [{...presenter.segments[0], sentences: [{startMs: 100, endMs: 2000}, {startMs: 1900, endMs: 3800}]}, presenter.segments[1]]}), /片段内/);
assert.match(errors({...presenter, segments: [{...presenter.segments[0], sentences: [{startMs: 100.5, endMs: 1700}, presenter.segments[0].sentences[1]]}, presenter.segments[1]]}), /整数毫秒/);

const audioPages = [
  {src: 'voice/first.wav', durMs: 4000, words: [], sentenceTimings: presenter.segments[0].sentences, presenter: {src: 'video/speaker.mp4', startMs: 1000, endMs: 5000, layout: 'pip', aspectRatio: 9 / 16}},
  {src: 'voice/second.wav', durMs: 3000, words: [], sentenceTimings: presenter.segments[1].sentences, presenter: {src: 'video/speaker.mp4', startMs: 5000, endMs: 8000, layout: 'hidden'}},
];
const timeline = buildTimeline(base, audioPages);
assert.equal(timeline.pages[0].timingSource, 'manual-sentence');
assert.equal(timeline.pages[0].audioStartFrame, 12);
assert.equal(timeline.pages[0].sentences[0].startMs, 500);
assert.equal(timeline.pages[0].sentences[1].startMs, 2300);
assert.equal(timeline.pages[0].sentences[0].revealAtMs, 500);
assert.deepEqual(timeline.pages.map((page) => page.presenter?.layout), ['pip', 'hidden']);
assert.equal(timeline.pages[0].presenter?.aspectRatio, 9 / 16);
assert.match(toSrt(timeline), /先讲第一句/);
assert.ok(timeline.pages[1].sentences[0].startMs >= timeline.pages[1].startMs);
assert.throws(() => buildTimeline(base, [{...audioPages[0], sentenceTimings: undefined}, audioPages[1]]), /缺少逐句时刻/);
assert.throws(() => buildTimeline(base, [{...audioPages[0], presenter: {...audioPages[0].presenter, endMs: 9000}}, audioPages[1]]), /时长不匹配/);
assert.throws(() => buildTimeline(base, [{...audioPages[0], presenter: {...audioPages[0].presenter, aspectRatio: 0}}, audioPages[1]]), /宽高比无效/);
assert.throws(() => mapExplicitSentences(base.chapters[0].pages[0].narration, [{startMs: 0, endMs: 1000}], 4000), /数量/);
assert.equal(mapExplicitSentences([{text: '大家好，'}, {text: '今天我想'}], [{startMs: 0, endMs: 300}, {startMs: 500, endMs: 1000}], 1000).map((row) => row.text).join(''), '大家好，今天我想');
const phraseTimeline = buildTimeline({meta: base.meta, chapters: [{title: '短语字幕', pages: [{layout: 'cover', title: '开场', subtitle: '说明', narration: [{text: '大家好，'}, {text: '新的讲解方式：'}]}]}]}, [
  {src: 'voice/phrase.wav', durMs: 2000, words: [], sentenceTimings: [{startMs: 0, endMs: 500}, {startMs: 1000, endMs: 2000}], presenter: {src: 'video/speaker.mp4', startMs: 0, endMs: 2000, layout: 'hidden'}},
]);
assert.equal(phraseTimeline.pages[0].sentences.map((row) => row.text).join(''), '大家好，新的讲解方式：');
assert.doesNotMatch(toSrt(phraseTimeline), /[，：]。|\n。\n/u, '真人短语字幕不得补出孤立句号');

const legacy = buildTimeline(base, [
  {src: 'voice/first.wav', durMs: 4000, words: [{text: '先讲第一句。再讲第二句。', startMs: 0, endMs: 4000}]},
  {src: 'voice/second.wav', durMs: 3000, words: [{text: '进入下一页。', startMs: 0, endMs: 3000}]},
]);
assert.equal(legacy.pages[0].timingSource, 'tts-words');
assert.equal(legacy.pages[0].presenter, undefined);
console.log('✓ 真人口播 schema、逐句时间轴、字幕、原有 TTS 路径');
