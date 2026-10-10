import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {timelineClipIssues, timelineFrameLayout} from './timeline-frame.mjs';
import {validateLesson} from './validate-lesson.mjs';

const two = timelineFrameLayout({
  nodes: ['鸿蒙智行', '江淮汽车'],
  segments: [{label: '同日白天', tone: 'accent'}],
  captions: [{icon: 'doc', text: '称未接到反馈'}, {icon: 'doc', text: '称正在调查'}],
  hasQuote: false,
});
assert.deepEqual(timelineClipIssues(two), []);
assert.equal(two.captions.length, 2);
assert.ok(two.captions.every((cap) => cap.x >= 0 && cap.x + cap.w <= two.frame.width), '说明画出画面');
assert.ok(two.bars[0].labelBox.y + two.bars[0].labelBox.h <= two.bars[0].y + 0.5, '区段名压到色条');
assert.ok(two.offsetY > 40 && two.offsetY + two.blockHeight < two.frame.height - 40, `两节点没有居中：top ${two.offsetY} height ${two.blockHeight}`);

const gallery = JSON.parse(readFileSync(new URL('../../examples/lesson/gallery-a-g.json', import.meta.url), 'utf8'));
const page = gallery.chapters.flatMap((chapter) => chapter.pages).find((item) => item.layout === 'timeline');
const laid = timelineFrameLayout({
  nodes: page.nodes.map((node) => node.label),
  segments: page.segments,
  captions: page.captions,
  hasQuote: Boolean(page.quote),
});
assert.deepEqual(timelineClipIssues(laid), [], timelineClipIssues(laid).join('；'));
assert.equal(validateLesson(gallery).errors.filter((line) => line.includes('时间轴文字会被裁切')).length, 0);

const broken = {
  frame: {width: 1680, height: 580, reserveX: 1480, reserveY: 510},
  writtenCaptions: 2,
  nodes: [{x: 40, y: 140, w: 220, h: 54, font: 46, text: '鸿蒙智行'}],
  bars: [{
    x: 80, y: 78, w: 900, h: 48, label: '同日白天',
    labelBox: {x: 360, y: 78, w: 220, h: 54, font: 54, text: '同日白天'},
  }],
  captions: [
    {x: 20, y: 8, w: 280, h: 40, font: 34, text: '称未接到反馈'},
    {x: 1500, y: 8, w: 360, h: 40, font: 34, text: '称正在调查'},
  ],
};
const issues = timelineClipIssues(broken);
assert.ok(issues.some((line) => line.includes('同日白天') && line.includes('色条')), issues.join('；'));
assert.ok(issues.some((line) => line.includes('称正在调查') && (line.includes('画出') || line.includes('只画出'))), issues.join('；'));

console.log('✓ 时间轴：两节点居中且不裁切，旧几何会被检查抓住');
