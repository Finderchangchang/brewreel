#!/usr/bin/env node
// 翻页曲线：两页文字不同时超过 25% 不透明，同章章节行不动，内容区空白不超过 0.2 秒。
import assert from 'node:assert/strict';
import {
  TURN_IN_DELAY_MS,
  TURN_IN_MS,
  TURN_MAX_OVERLAP,
  TURN_OUT_MS,
  TURN_SHIFT_PX,
  chapterLineMode,
  chapterLineOpacity,
  contentBlankMs,
  contentMotion,
  pageTurnAt,
  turnOutFrames,
} from '../../template/src/lesson/stage.mjs';

const fps = 30;
const frames = Math.ceil(((TURN_IN_DELAY_MS + TURN_IN_MS) / 1000) * fps) + 1;
let peak = 0;
for (let frame = 0; frame < frames; frame += 1) {
  const tMs = (frame * 1000) / fps;
  const turn = pageTurnAt(tMs);
  const overlap = Math.min(turn.outgoing.opacity, turn.incoming.opacity);
  peak = Math.max(peak, overlap);
  assert.ok(overlap <= TURN_MAX_OVERLAP + 1e-9, `第 ${frame} 帧重叠 ${overlap}`);
  assert.equal(chapterLineOpacity({sameChapter: true, role: 'outgoing', tMs}), 1);
  assert.equal(chapterLineOpacity({sameChapter: true, role: 'incoming', tMs}), 1);
  const outgoingMode = chapterLineMode({key: 'chapter:0:章', first: false, inTail: true, holdPrev: true, holdNext: true, tMs});
  const incomingMode = chapterLineMode({key: 'chapter:0:章', first: false, inTail: false, holdPrev: true, holdNext: true, tMs});
  assert.equal(outgoingMode, 'none', '同章时上一页不再画章节行');
  assert.equal(incomingMode, 'stable', '同章时下一页章节行不淡');
}
for (let tMs = 0; tMs <= TURN_IN_DELAY_MS + TURN_IN_MS; tMs += 1) {
  const turn = pageTurnAt(tMs);
  assert.ok(Math.min(turn.outgoing.opacity, turn.incoming.opacity) <= TURN_MAX_OVERLAP + 1e-9, `${tMs}ms`);
}
assert.ok(peak <= TURN_MAX_OVERLAP);
assert.ok(contentBlankMs(fps) <= 200, `内容区空白 ${contentBlankMs(fps)}ms`);
assert.ok(contentBlankMs(24) <= 200);
assert.ok(contentBlankMs(60) <= 200);
assert.ok(TURN_IN_DELAY_MS < TURN_OUT_MS, '下一页开始进来时上一页还在');

const start = pageTurnAt(0);
assert.equal(start.outgoing.opacity, 1);
assert.equal(start.outgoing.dy, 0);
assert.equal(start.incoming.opacity, 0);
assert.equal(start.incoming.dy, TURN_SHIFT_PX);
const outDone = pageTurnAt(TURN_OUT_MS);
assert.equal(outDone.outgoing.opacity, 0);
assert.equal(outDone.outgoing.dy, -TURN_SHIFT_PX);
const inDone = pageTurnAt(TURN_IN_DELAY_MS + TURN_IN_MS);
assert.equal(inDone.incoming.opacity, 1);
assert.equal(inDone.incoming.dy, 0);
assert.deepEqual(contentMotion({first: true, inTail: false, tMs: 0}), {opacity: 1, dy: 0});
assert.ok(turnOutFrames(30) >= Math.ceil((TURN_OUT_MS / 1000) * 30), '退场帧要盖住淡出结束');

const changed = chapterLineMode({key: 'chapter:1:下一章', first: false, inTail: true, holdPrev: true, holdNext: false, tMs: 0});
assert.equal(changed, 'turn');
assert.equal(chapterLineOpacity({sameChapter: false, role: 'outgoing', tMs: 0}), 1);
assert.ok(chapterLineOpacity({sameChapter: false, role: 'outgoing', tMs: TURN_OUT_MS}) === 0);

console.log(`test-page-turn：重叠峰值 ${peak.toFixed(3)}，内容空白 ${contentBlankMs(fps)}ms`);
