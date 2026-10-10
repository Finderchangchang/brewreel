import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emWidth, titleLines, titleSpans} from './title-wrap.mjs';
import {mapSentences, narrationText, subtitleLineEm, subtitleScreens} from './timeline.mjs';
import {SUBTITLE, subtitleLayout} from '../../template/src/lesson/stage.mjs';

const pieceLen = (text) => Array.from(String(text).replace(/\s/gu, '')).length;
const MS = 170;

function pageOf(lines, index) {
  const narration = lines.map((text) => ({text}));
  const full = narrationText(narration);
  const sentences = full.split(/(?<=[。！？!?…；;.])/u).filter(Boolean);
  let cursor = 0;
  const words = sentences.map((text) => {
    const dur = pieceLen(text) * MS;
    const word = {text, startMs: cursor, endMs: cursor + dur};
    cursor += dur;
    return word;
  });
  return {
    index,
    startMs: index * 100000,
    narrationText: full,
    sentences: mapSentences(narration, words, cursor),
  };
}

function screensOf(chunks) {
  const narration = chunks.map((chunk) => ({text: chunk.text}));
  const words = chunks.map((chunk) => ({text: chunk.text, startMs: chunk.startMs, endMs: chunk.endMs}));
  const dur = Math.max(...chunks.map((chunk) => chunk.endMs));
  const page = {index: 0, startMs: 0, sentences: mapSentences(narration, words, dur)};
  return subtitleScreens({fps: 30, pages: [page]});
}

const lesson = JSON.parse(readFileSync(new URL('../../examples/lesson/real-legal.json', import.meta.url), 'utf8'));
const pages = lesson.chapters.flatMap((chapter) => chapter.pages).map((page, index) => pageOf(page.narration.map((row) => row.text), index));
const timeline = {fps: 30, pages};
const screens = subtitleScreens(timeline);
const lineEm = subtitleLineEm();

for (const page of pages) {
  const joined = screens.filter((screen) => screen.pageIndex === page.index).map((screen) => screen.text).join('');
  assert.equal(joined, page.narrationText, `第 ${page.index} 页字幕拼不回旁白`);
}

const shorts = [];
for (const screen of screens) {
  const len = pieceLen(screen.text);
  const marks = screen.text.match(/[。！？!?]/gu) ?? [];
  const wholeShort = len < 6 && marks.length === 1 && /[。！？!?]$/u.test(screen.text);
  if (len < 6) shorts.push(screen.text);
  if (!wholeShort) assert.ok(len >= 6, `少于 6 字：${len}「${screen.text}」`);
  const dur = screen.endMs - screen.startMs;
  assert.ok(dur >= 800, `短于 0.8 秒：${dur}ms「${screen.text}」`);
  const layout = subtitleLayout(screen.text);
  assert.ok(layout.lines.length <= 2 && layout.font >= SUBTITLE.minFont, `超出两行上限：${layout.lines.length} 行 / ${layout.font}px「${screen.text}」`);
  if (emWidth(screen.text) <= lineEm + 1e-6) assert.equal(layout.lines.length, 1, `放得下却分成两行：「${screen.text}」`);
}
assert.deepEqual(shorts, ['先想一想。'], `整句不足 6 字才允许短屏，实际 ${shorts.join(' / ')}`);
for (const banned of ['利息、', '交付、', '期限、', '底下红字说的是，']) {
  assert.equal(screens.some((screen) => screen.text === banned), false, `不该单独成屏：${banned}`);
}

const comma = screensOf([{text: '利息、交付、凭证都要留意。', startMs: 0, endMs: 2500}]);
assert.deepEqual(comma.map((screen) => screen.text), ['利息、交付、凭证都要留意。']);

const clause = screensOf([{text: '底下红字说的是，约定不清楚时怎么看。', startMs: 0, endMs: 4000}]);
assert.deepEqual(clause.map((screen) => screen.text), ['底下红字说的是，约定不清楚时怎么看。']);

const period = screensOf([
  {text: '利息写清楚才算有约定。', startMs: 0, endMs: 1200},
  {text: '交付凭证也要一起留存。', startMs: 2000, endMs: 3200},
]);
assert.deepEqual(period.map((screen) => screen.text), ['利息写清楚才算有约定。', '交付凭证也要一起留存。']);
assert.ok(period[0].endMs > period[0].startMs + 1200, '句号后的停顿应留在上一屏');

const whole = screensOf([{text: '答案：不可以。', startMs: 0, endMs: 1600}]);
assert.deepEqual(whole.map((screen) => screen.text), ['答案：不可以。']);

const fast = screensOf([
  {text: '利息写清楚才算有约定。', startMs: 0, endMs: 400},
  {text: '交付凭证也要一起留存。', startMs: 400, endMs: 800},
]);
assert.equal(fast.length, 1, `不足 0.8 秒应并成一屏，实际 ${fast.map((screen) => screen.text).join(' | ')}`);
assert.ok(fast[0].endMs - fast[0].startMs >= 800);

const vertical = subtitleScreens(timeline, {maxHan: 14, maxLen: 14});
assert.ok(vertical.some((screen) => screen.text === '利息、'), '竖版仍按逗号切屏');

const atomsOf = (text) => titleSpans(text, {subtitle: true}).map((span) => span.text);
const modelAtoms = atomsOf('三台尊界V800');
assert.ok(modelAtoms.some((atom) => atom.includes('尊界')), `尊和界被拆开：${modelAtoms.join('|')}`);
assert.ok(modelAtoms.some((atom) => atom.includes('V800')), `V800 被拆开：${modelAtoms.join('|')}`);
assert.equal(modelAtoms.includes('尊') || modelAtoms.includes('界'), false);
const workAtoms = atomsOf('非标准极端工况');
assert.ok(workAtoms.some((atom) => atom.includes('工况')), `工况被拆开：${workAtoms.join('|')}`);
assert.equal(workAtoms.includes('工') || workAtoms.includes('况'), false);
assert.ok(atomsOf('制动踏板1612N').some((atom) => atom.includes('1612N')), atomsOf('制动踏板1612N').join('|'));
const english = titleLines('brake test is basic', {subtitle: true, maxEm: 8, maxLines: 2});
const englishWords = new Set(['brake', 'test', 'is', 'basic']);
for (const line of english) for (const word of line.split(' ')) assert.ok(englishWords.has(word), `英文断进了词里：${line}`);
const modelScreens = screensOf([{text: '三台尊界V800在非标准极端工况下做了测试。', startMs: 0, endMs: 5000}]);
assert.ok(modelScreens.some((screen) => screen.text.includes('尊界')), modelScreens.map((screen) => screen.text).join(' / '));
assert.ok(modelScreens.some((screen) => screen.text.includes('工况')), modelScreens.map((screen) => screen.text).join(' / '));
assert.ok(modelScreens.some((screen) => screen.text.includes('V800')), modelScreens.map((screen) => screen.text).join(' / '));
for (let i = 0; i < modelScreens.length - 1; i += 1) {
  const edge = modelScreens[i].text.slice(-1) + modelScreens[i + 1].text.slice(0, 1);
  assert.notEqual(edge, '尊界', modelScreens.map((screen) => screen.text).join(' / '));
  assert.notEqual(edge, '工况', modelScreens.map((screen) => screen.text).join(' / '));
}
const wrapped = subtitleLayout('三台尊界V800在非标准极端工况下刹车');
for (const line of wrapped.lines) {
  assert.equal(line.endsWith('尊') || line.endsWith('工'), false, line);
  assert.equal(line.startsWith('界') || line.startsWith('况'), false, line);
}

console.log(`✓ 横版字幕 ${screens.length} 屏：real-legal 全旁白无碎屏，竖版切法未改`);
