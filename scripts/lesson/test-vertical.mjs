import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {subtitleScreens} from './timeline.mjs';
import {coverTitleLayout, titleLines} from './title-wrap.mjs';
import {validateLesson} from './validate-lesson.mjs';
import {
  VERTICAL,
  buildPublish,
  chromeTopReserve,
  clampAtoms,
  coverCopy,
  coverTextIssues,
  emphasizedFontPx,
  headingsOverlap,
  hookEmphasisTransform,
  layoutSubtitleText,
  planClips,
  shouldShowHook,
  sliceTimeline,
  verticalChromeBoxes,
  verticalContentBox,
  verticalNoteBox,
  verticalPresenterBox,
  verticalSubtitleBox,
  verticalSubtitleMaxChars,
  visiblePageHeadings,
} from './vertical.mjs';

const LAYOUTS = ['cover', 'chapter', 'steps', 'quote', 'compare', 'question', 'flow', 'recap', 'screenshot', 'code', 'points', 'statement', 'timeline', 'checklist', 'bignumber', 'saying', 'levels', 'case', 'document', 'table'];
const insideSafe = (box) => {
  const w = box.width ?? box.w;
  const h = box.height ?? box.h;
  assert.ok(box.x >= VERTICAL.safe.x, `x ${box.x}`);
  assert.ok(box.y >= VERTICAL.safe.y, `y ${box.y}`);
  assert.ok(box.x + w <= VERTICAL.safe.right, `right ${box.x + w}`);
  assert.ok(box.y + h <= VERTICAL.safe.bottom, `bottom ${box.y + h}`);
};
const overlaps = (a, b) => {
  const aw = a.width ?? a.w;
  const ah = a.height ?? a.h;
  const bw = b.width ?? b.w;
  const bh = b.height ?? b.h;
  return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y;
};

const safeArea = (VERTICAL.safe.right - VERTICAL.safe.x) * (VERTICAL.safe.bottom - VERTICAL.safe.y);
const denseLayout = (layout) => layout === 'screenshot' || layout === 'code' || layout === 'compare';
for (const layout of LAYOUTS) {
  for (const kind of ['cartoon', 'real', 'none']) {
    const content = verticalContentBox(layout, kind);
    insideSafe(content);
    assert.equal(content.width, VERTICAL.safe.right - VERTICAL.safe.x, `${layout} 竖版内容应全宽`);
    assert.ok(content.area / safeArea >= 0.45, `${layout}/${kind} 稳态内容应占安全区至少 45%，实际 ${(content.area / safeArea).toFixed(3)}`);
    const presenter = verticalPresenterBox(kind, {layout});
    if (!presenter) continue;
    insideSafe(presenter);
    assert.equal(overlaps(content, presenter), false, `${layout}/${kind} 讲解员挡住了内容`);
    assert.equal(presenter.x + presenter.w, VERTICAL.safe.right, `${layout}/${kind} 右缘对齐 900`);
    assert.equal(presenter.y + presenter.h, VERTICAL.safe.bottom, `${layout}/${kind} 脚底对齐 1340`);
    const sub = verticalSubtitleBox(content);
    assert.equal(sub.x + sub.width / 2, content.x + content.width / 2, `${layout} 字幕应在内容下方水平居中`);
    assert.ok(sub.y >= content.y + content.height, `${layout} 字幕应在内容下方`);
    assert.equal(overlaps(sub, presenter), false, `${layout}/${kind} 字幕和讲解员重叠`);
    assert.equal(overlaps(sub, content), false, `${layout} 字幕和内容重叠`);
    const note = verticalNoteBox(presenter);
    insideSafe(note);
    assert.equal(overlaps(note, presenter), false, `${layout}/${kind} 便签盖住了讲解员`);
    assert.equal(overlaps(note, content), false, `${layout}/${kind} 便签盖住了内容`);
    assert.equal(overlaps(note, sub), false, `${layout}/${kind} 便签盖住了字幕`);
    assert.ok(note.x + note.w <= presenter.x + 0.01, `${layout} 便签应在人物左侧`);
    assert.ok(note.y >= presenter.y - 0.01 && note.y < presenter.y + presenter.h / 2, `${layout} 便签应与头顶齐平，留在上半身`);
    assert.equal(note.w, VERTICAL.noteW, `${layout} 右下角左侧够宽，便签保持 220`);
    if (kind === 'cartoon') assert.equal(presenter.h, denseLayout(layout) ? 220 : 300);
    if (kind === 'real') assert.equal(presenter.w, denseLayout(layout) ? 200 : 240);
  }
}
const hookBottom = VERTICAL.safe.y + chromeTopReserve({showLabel: true, showHook: true, hookLines: 1});
const introOpts = {layout: 'cover', frame: 0, fps: 30, showHook: true, hookBottom, topReserve: hookBottom - VERTICAL.safe.y};
const intro = verticalPresenterBox('cartoon', introOpts);
assert.equal(intro.h, 420, '开头卡通高 420');
assert.equal(intro.x + intro.w / 2, (VERTICAL.safe.x + VERTICAL.safe.right) / 2, '开头水平居中');
assert.ok(intro.y >= hookBottom, '开头站在钩子下方');
const introContent = verticalContentBox('cover', 'cartoon', introOpts);
assert.equal(overlaps(introContent, intro), false, '开头人物挡住了内容');
const introNote = verticalNoteBox(intro);
insideSafe(introNote);
assert.equal(overlaps(introNote, intro), false, '开头便签盖住了人物');
assert.equal(overlaps(introNote, introContent), false, '开头便签盖住了内容');
assert.ok(introNote.y >= hookBottom, '开头便签不进入钩子');
assert.ok(introNote.w < VERTICAL.noteW, '开头居中时左侧变窄');
const introReal = verticalPresenterBox('real', introOpts);
assert.equal(introReal.w, 360);
assert.equal(introReal.h, 360);
assert.equal(introReal.x + introReal.w / 2, (VERTICAL.safe.x + VERTICAL.safe.right) / 2);
assert.equal(overlaps(verticalContentBox('cover', 'real', introOpts), introReal), false);
const introRealNote = verticalNoteBox(introReal);
insideSafe(introRealNote);
assert.equal(overlaps(introRealNote, introReal), false, '开头圆窗便签盖住了圆窗');
assert.equal(overlaps(introRealNote, verticalContentBox('cover', 'real', introOpts)), false);
const mid = verticalPresenterBox('cartoon', {...introOpts, frame: 45 + 6});
assert.ok(mid.h < 420 && mid.h > 300, '0.4 秒过渡中高度介于 420 和 300');
assert.ok(mid.x > intro.x, '过渡时向右下角移动');
const settled = verticalPresenterBox('cartoon', {...introOpts, frame: 45 + 12});
assert.equal(settled.h, 300);
assert.equal(settled.x + settled.w, 900);
assert.equal(settled.y + settled.h, 1340);
const quiet = verticalPresenterBox('cartoon', {...introOpts, showHook: false});
assert.equal(quiet.h, 300, '钩子没出现时不放大居中');
assert.equal(quiet.x + quiet.w, 900);
const pageStart = verticalPresenterBox('cartoon', {layout: 'compare', frame: 90, fps: 30, showHook: false, pageFrame: 0, prevLayout: 'steps'});
assert.equal(pageStart.h, 300, '切到内容重的页，尺寸从上一页开始');
const pageEnd = verticalPresenterBox('cartoon', {layout: 'compare', frame: 90, fps: 30, showHook: false, pageFrame: 9, prevLayout: 'steps'});
assert.equal(pageEnd.h, 220);
assert.equal(pageEnd.x + pageEnd.w, 900);
assert.equal(pageEnd.y + pageEnd.h, 1340);
const realPageEnd = verticalPresenterBox('real', {layout: 'code', frame: 90, fps: 30, showHook: false, pageFrame: 9, prevLayout: 'quote'});
assert.equal(realPageEnd.w, 200);
const crowded = {x: 180, y: 1200, width: 720, height: 180};
const shrunk = verticalPresenterBox('cartoon', {layout: 'steps', subtitle: crowded});
assert.equal(shrunk.h, 220, '字幕放不下时卡通缩到 220');
assert.equal(overlaps(shrunk, crowded), false, '缩小后仍和字幕重叠');
assert.equal(overlaps(verticalContentBox('steps', 'cartoon', {subtitle: crowded}), shrunk), false);
const shrunkReal = verticalPresenterBox('real', {layout: 'steps', subtitle: crowded});
assert.equal(shrunkReal.w, 220, '字幕放不下时圆窗缩到 220');
assert.equal(overlaps(shrunkReal, crowded), false);
const sampled = verticalContentBox('steps', 'cartoon', {sampleReview: true});
assert.ok(sampled.area / safeArea >= 0.45, '样片水印下内容仍应占安全区至少 45%');
const labeled = verticalContentBox('cover', 'cartoon', {sampleReview: true, showLabel: true});
assert.equal(labeled.width, VERTICAL.safe.right - VERTICAL.safe.x, '片头标识下内容仍应全宽');
const labeledPresenter = verticalPresenterBox('cartoon', {layout: 'cover', sampleReview: true, showLabel: true});
const labeledNote = verticalNoteBox(labeledPresenter);
assert.equal(overlaps(labeledNote, labeled), false, '片头标识下便签盖住了内容');
assert.equal(overlaps(labeled, labeledPresenter), false, '片头标识下讲解员挡住了内容');
const openingReserve = chromeTopReserve({showLabel: true, showHook: true, hookLines: 1});
const during = verticalContentBox('steps', 'cartoon', {topReserve: openingReserve});
const opening = verticalChromeBoxes({showLabel: true, showHook: true, hookLines: 1});
for (const box of Object.values(opening)) insideSafe(box);
assert.equal(overlaps(during, opening.label), false, '片头标识挡住了正文');
assert.equal(overlaps(during, opening.hook), false, '钩子挡住了正文');
assert.equal(overlaps(during, verticalPresenterBox('cartoon')), false);
const sub = verticalSubtitleBox();
assert.ok(sub.y >= 1380 && sub.y + sub.height <= 1520, '字幕应在 y 1380–1520');
assert.ok(sub.x >= 180 && sub.x + sub.width <= 900, '字幕不进右侧按钮区');
assert.ok(VERTICAL.subtitleMinPx >= 56);
assert.ok(verticalSubtitleMaxChars() <= 14);

const page = (index, chapterIndex, chapterTitle, ms, extra = {}) => {
  const start = extra.startMs ?? 0;
  return {index, chapterIndex, chapterTitle, layout: extra.layout ?? 'steps', title: extra.title ?? chapterTitle, fields: extra.fields ?? {}, startMs: start, endMs: start + ms, narration: extra.narration ?? [{text: `${chapterTitle}旁白。`}]};
};
const clock = (rows) => {
  let t = 0;
  return rows.map((row) => {
    const next = {...row, startMs: t, endMs: t + (row.endMs - row.startMs)};
    t += row.endMs - row.startMs;
    return next;
  });
};

const split = planClips({fps: 30, pages: clock([
  page(0, 0, '长章', 40000),
  page(1, 0, '长章', 30000),
])});
assert.equal(split.length, 2, '超过 60 秒要在页边界切开');
assert.ok(split.every((clip) => clip.durationMs <= 60000));
assert.equal(split[0].pageEnd, 0);
assert.equal(split[1].pageStart, 1);
assert.deepEqual(split.flatMap((clip) => clip.pages.map((item) => item.index)), [0, 1]);

const merged = planClips({fps: 30, pages: clock([
  page(0, 0, '短章', 10000, {narration: [{text: '短章第一句。'}, {text: '短章第二句。'}]}),
  page(1, 1, '邻章', 20000, {narration: [{text: '邻章只有一句。'}, {text: '邻章第二句。'}]}),
])});
assert.equal(merged.length, 1, '不足 15 秒应和相邻一条合并');
assert.equal(merged[0].durationMs, 30000);
assert.deepEqual(merged[0].pages.map((item) => item.index), [0, 1]);

const keptShort = planClips({fps: 30, pages: clock([
  page(0, 0, '满章', 55000),
  page(1, 0, '满章', 10000),
])});
assert.equal(keptShort.length, 2, '合并会超过 60 秒时不再并');
assert.ok(keptShort.every((clip) => clip.durationMs <= 60000));
assert.equal(keptShort[1].pages.length, 1);

const uncut = planClips({fps: 30, pages: clock([page(0, 0, '单页', 70000)])});
assert.equal(uncut.length, 1, '单页超过 60 秒也不能切断旁白');
assert.equal(uncut[0].pages.length, 1);
assert.equal(uncut[0].durationMs, 70000);

const packed = planClips({fps: 30, pages: clock([
  page(0, 0, '三页', 25000),
  page(1, 0, '三页', 25000),
  page(2, 0, '三页', 25000),
])});
assert.deepEqual(packed.map((clip) => clip.durationMs), [50000, 25000]);
assert.ok(packed.every((clip) => clip.pageEnd - clip.pageStart + 1 === clip.pages.length));

const asked = planClips({fps: 30, pages: clock([
  page(0, 0, '借钱给别人：借条里的三个关键点', 20000, {layout: 'question', title: '借条没写利息，还能要利息吗？', fields: {question: '借条没写利息，还能要利息吗？'}}),
])});
assert.equal(asked[0].hookTitle, '借条没写利息，还能要利息吗？');
assert.equal(asked[0].hookTitle.includes('…'), false);
const chapterHook = planClips({fps: 30, pages: clock([page(0, 0, '安全与项目规矩', 20000)])});
assert.equal(chapterHook[0].hookTitle, '安全与项目规矩');
const narrHook = planClips({fps: 30, pages: clock([
  page(0, 0, '借钱给别人：借条里的三个关键点', 20000, {layout: 'cover', narration: [{text: '借钱给别人，借条里三件事最容易忽略。'}]}),
])});
assert.equal(narrHook[0].hookTitle, '借钱给别人');
assert.equal(narrHook[0].hookTitle.endsWith('三个'), false);

const samePage = {layout: 'chapter', title: '开始使用 Codex', chapterTitle: '开始使用 Codex'};
assert.equal(headingsOverlap('开始使用 Codex', ['开始使用 Codex']), true, '相同');
assert.equal(headingsOverlap('开始使用 Codex', ['开始使用Codex']), true, '相同：忽略空白');
assert.equal(shouldShowHook('开始使用 Codex', samePage, 0), false, '相同则不另画钩子');
assert.ok(emphasizedFontPx(80, true) >= 80);
assert.equal(emphasizedFontPx(72, false), 72);

const contained = {layout: 'cover', title: '借钱给别人，借条里最容易忽略的三件事'};
assert.equal(headingsOverlap('借钱给别人', ['借钱给别人，借条里最容易忽略的三件事']), true, '钩子被页面标题包含');
assert.equal(headingsOverlap('借钱给别人，借条里最容易忽略的三件事', ['借钱给别人']), true, '页面标题被钩子包含');
assert.equal(shouldShowHook('借钱给别人', contained, 6), false, '互相包含则不另画钩子');
assert.ok(emphasizedFontPx(72, true) >= 80, '重复时页面标题放大到钩子字号');
assert.equal(emphasizedFontPx(110, true), 110, '已经大于钩子字号则保持');

const different = {layout: 'cover', title: '什么是 Codex', chapterTitle: '认识 Codex'};
assert.equal(headingsOverlap('认识 Codex', ['什么是 Codex']), false, '不同');
assert.equal(headingsOverlap('认识 Codex', visiblePageHeadings(different)), false, '封面不显示未画出的章节名');
assert.equal(shouldShowHook('认识 Codex', different, 0), true, '不同则仍画钩子');
assert.equal(shouldShowHook('认识 Codex', different, VERTICAL.hookFrames), false, '1.5 秒后钩子本来就消失');
const stepsSame = {layout: 'steps', title: '开始使用 Codex'};
assert.equal(visiblePageHeadings(stepsSame).length, 0);
assert.equal(shouldShowHook('开始使用 Codex', stepsSame, 0), true, '页面没画出标题时钩子仍单独显示');
const askedOnScreen = {layout: 'question', title: '借条没写利息，还能要利息吗？', fields: {question: '借条里没有写利息，出借人还能要求借款人支付利息吗？'}};
assert.equal(shouldShowHook('借条没写利息，还能要利息吗？', askedOnScreen, 0), true, '画面上的提问和钩子不是包含关系');
const emphasisStart = hookEmphasisTransform(0);
const emphasisMid = hookEmphasisTransform(12);
const emphasisEnd = hookEmphasisTransform(VERTICAL.hookFrames);
assert.equal(emphasisStart.scale, 1);
assert.ok(emphasisStart.y > emphasisMid.y && emphasisMid.y > 0, '强调从略下移收回');
assert.ok(emphasisStart.transform.startsWith('translateY('));
assert.equal(emphasisEnd.y, 0);

const latin = clampAtoms('Supercalifragilistic', 12);
assert.equal(latin, 'Supercalifragilistic');
assert.equal(latin.includes('Supercalifra') && !latin.endsWith('c'), false);
const lines = titleLines('什么是 Codex', {forceTwo: true});
assert.ok(lines.every((line) => line.includes('Codex') || !/Code(?!x)/u.test(line)));
assert.ok(lines.join('').replace(/\s/gu, '').includes('Codex'));

const narrations = ['这节三分钟，我们认识 OpenAI 的编程代理 Codex。', '它会在你的代码仓库里工作，而不只是聊天。', '登录用的是 ChatGPT 账号。', '多出来的第四句不该进简介。'];
const pub = buildPublish({courseTitle: '什么是 Codex', chapterTitle: '认识 Codex', domain: 'tech', narrations});
assert.equal(pub.title, '什么是 Codex');
assert.ok(graphemes(pub.title).length <= 20);
assert.deepEqual(pub.intro, narrations.slice(0, 3));
assert.equal(pub.text.includes('第四句'), false);
assert.equal(pub.text.includes('胜诉'), false);
assert.deepEqual(pub.tags, ['#AI编程']);
const tagged = buildPublish({courseTitle: '什么是 Codex', chapterTitle: '认识 Codex', domain: 'tech', narrations, tags: ['编程', '代码', 'Codex']});
assert.deepEqual(tagged.tags, ['#编程', '#代码', '#Codex', '#AI编程']);
assert.equal(tagged.tags.includes('#别人'), false);
assert.equal(tagged.tags.includes('#关键'), false);

const legalPub = buildPublish({
  courseTitle: '借钱给别人，借条里最容易忽略的三件事',
  chapterTitle: '借钱给别人：借条里的三个关键点',
  domain: 'legal',
  narrations: ['借钱给别人，借条里三件事最容易忽略。', '利息、交付、凭证都要留意。'],
});
assert.equal(legalPub.title, '借钱给别人，借条里最容易忽略的三件事');
assert.equal(legalPub.title.includes('｜'), false);
assert.deepEqual(legalPub.tags, ['#普法']);
assert.equal(legalPub.text.includes('保证胜诉'), false);
assert.ok(legalPub.intro.every((line) => ['借钱给别人，借条里三件事最容易忽略。', '利息、交付、凭证都要留意。'].includes(line)));

const chars = graphemes('一二三四五六七八九十甲乙丙丁戊己庚辛壬癸额外事实');
const timeline = {
  fps: 30,
  chapters: [{index: 0, title: '章'}],
  pages: [{
    index: 0,
    chapterIndex: 0,
    startFrame: 90,
    endFrame: 180,
    startMs: 3000,
    endMs: 6000,
    durationFrames: 90,
    audioStartFrame: 102,
    sentences: [{
      text: chars.join(''),
      startMs: 3400,
      endMs: 5800,
      revealAtMs: 3400,
      chars: chars.map((text, i) => ({text, startMs: i * 80, endMs: i * 80 + 70})),
    }],
  }],
};
const sliced = sliceTimeline(timeline, {pageStart: 0, pageEnd: 0, legalTailFrames: 60});
assert.equal(sliced.pages[0].startFrame, 0);
assert.equal(sliced.width, 1080);
assert.equal(sliced.height, 1920);
assert.equal(sliced.totalFrames, 90 + 60);
assert.equal(sliced.pages[0].sentences[0].chars[0].startMs, 0);
assert.ok(sliced.subtitles.length >= 2);
assert.ok(sliced.subtitles.every((screen) => screen.em <= 14 || screen.fontPx < VERTICAL.subtitleMinPx));
assert.equal(sliced.subtitles.map((screen) => screen.text).join('').includes('额外事实'), true);
const direct = subtitleScreens(timeline, {maxHan: 14, maxLen: 14});
assert.ok(direct.every((screen) => graphemes(screen.text).length <= 14));
const linesOf = (text) => layoutSubtitleText(text);
const broken = linesOf('workspace-write 只允许写当前工作区。');
assert.ok(broken.some((line) => line.text.includes('workspace-write')));
assert.equal(broken.some((line) => line.text.includes('ite') && !line.text.includes('workspace-write')), false);
assert.ok(broken.every((line) => line.fontPx >= 56));
const command = linesOf('可以看 codex --help。');
assert.equal(command.length, 1);
assert.ok(command[0].text.includes('codex --help'));
assert.equal(command[0].text.endsWith('--'), false);
const confirm = linesOf('需要更多权限时显式放开，由人确认。');
assert.ok(confirm.every((line) => line.text !== '人确认'));
assert.ok(confirm.some((line) => line.text.includes('由人确认')));
const interest = linesOf('利息约定、扣除、合同成立。');
assert.equal(interest.map((line) => line.text).join(' '), '利息约定 扣除 合同成立');
assert.equal(interest.some((line) => line.text === '扣除、' || line.text === '，' || line.text === '、'), false);
assert.equal(linesOf('，').length, 0);
assert.ok(linesOf('甲，乙。').every((line) => !/^[，,。．.、\s]+$/u.test(line.text)));
const longWord = linesOf('antidisestablishmentarianism');
assert.equal(longWord.length, 1);
assert.equal(longWord[0].text, 'antidisestablishmentarianism');
assert.ok(longWord[0].em > 14 && longWord[0].em <= 18);
assert.ok(longWord[0].fontPx < VERTICAL.subtitleMinPx);

const tech = JSON.parse(readFileSync(new URL('../../examples/lesson/real-tech.json', import.meta.url), 'utf8'));
const legal = JSON.parse(readFileSync(new URL('../../examples/lesson/real-legal.json', import.meta.url), 'utf8'));
for (const lesson of [tech, legal]) {
  const copy = coverCopy(lesson);
  assert.ok(graphemes(copy.title).length <= 20, copy.title);
  assert.equal(copy.title.includes('…'), false);
  assert.equal(coverTextIssues(lesson.meta.domain, [copy.title, copy.subtitle]).length, 0, `${lesson.meta.domain} ${copy.title}`);
}
assert.equal(coverCopy(legal).title, legal.meta.title);
const legalCover = coverTitleLayout(legal.meta.title, {width: 936, minPx: 110, maxPx: 140, maxLines: 4});
assert.ok(legalCover.lines.length >= 2 && legalCover.lines.length <= 3, legalCover.lines.join('/'));
assert.ok(legalCover.size >= 110 && legalCover.size <= 140, String(legalCover.size));
assert.equal(legalCover.lines.join(''), legal.meta.title);
assert.equal(legalCover.lines.join('').includes('…'), false);
const techCover = coverTitleLayout(tech.meta.title, {width: 936, minPx: 110, maxPx: 140, maxLines: 4});
assert.ok(techCover.size >= 110 && techCover.size <= 140);
assert.ok(techCover.lines.join('').replace(/\s/gu, '').includes('Codex'));
assert.equal(validateLesson(tech).ok, true);
assert.equal(validateLesson({...tech, meta: {...tech.meta, tags: ['编程', '代码', 'Codex']}}).ok, true, validateLesson({...tech, meta: {...tech.meta, tags: ['编程', '代码', 'Codex']}}).errors.join('\n'));
assert.equal(validateLesson({...tech, meta: {...tech.meta, tags: ['别人', '关键']}}).ok, false);
assert.ok(coverTextIssues('legal', ['本课保证胜诉']).some((line) => line.startsWith('legal-promise')));
assert.ok(coverTextIssues('legal', ['胜诉率很高']).some((line) => line.startsWith('legal-promise')));
assert.equal(coverTextIssues('tech', ['什么是 Codex']).length, 0);

function graphemes(text) { return Array.from(String(text ?? '')); }

console.log('test-vertical: ok');
