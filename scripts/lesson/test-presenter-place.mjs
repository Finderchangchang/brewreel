import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {avatarFrameStyle, cartoonBox, cartoonFrameStyle, circleBox, CONTENT, cornerBox, coverBox, COVER_MORPH, fullBox, morphBox, noteBox, overlaps, realBox, realFrameStyle, sideBox, SUBTITLE} from '../../template/src/lesson/presenter-place.mjs';

const tokens = JSON.parse(readFileSync(new URL('../../template/src/lesson/style-tokens.json', import.meta.url), 'utf8'));
const lesson = readFileSync(new URL('../../template/src/lesson/Lesson.tsx', import.meta.url), 'utf8');

assert.match(lesson, /avatarFrameStyle\(/, '横版圆形讲解员走主题描边');
assert.match(lesson, /cartoonFrameStyle\(/, '竖版卡通仍无框');
assert.match(lesson, /crop=\{vertical \? 'card' : 'bust'\}/, '横版用头肩裁切');
assert.match(lesson, /blinkAt\(motionMs/, '眨眼按页内相对时间');
assert.match(lesson, /elapsedMs=\{motionMs\}/, '呼吸和动作时钟走页内时间');
assert.match(lesson, /vertical && sentence\?\.note/, '便签只在竖版画');
assert.doesNotMatch(lesson, /noteBox\(/, '横版不再画句子便签');
assert.doesNotMatch(lesson, /crop=\{theme === 'product' \? 'circle' : 'card'\}/, '卡通不再按风格裁进圆');
assert.equal(COVER_MORPH, 400, '封面收到右下角用 0.4 秒');

const chrome = cartoonFrameStyle();
assert.equal(chrome.background, 'transparent');
assert.equal(chrome.border, 'none');
assert.equal(chrome.overflow, 'visible');

const corner = cornerBox();
assert.equal(corner.w, 210);
assert.equal(corner.h, 210);
assert.equal(corner.x, 1614, '右边距 96');
assert.equal(corner.y, 818, '底边距 52');
assert.equal(corner.x + corner.w / 2, 1719);
assert.equal(corner.y + corner.h / 2, 923);
assert.equal(corner.radius, 105);
assert.equal(corner.shape, 'circle');
assert.equal(1920 - (corner.x + corner.w), 96);
assert.equal(1080 - (corner.y + corner.h), 52);

const cover = coverBox();
assert.equal(cover.w, 360);
assert.equal(cover.h, 360);
assert.equal(cover.x, 1440, '封面大圆在右边距 120 处');
assert.equal(cover.y, 280);
assert.deepEqual(cartoonBox('cover'), cover);
for (const layout of ['steps', 'quote', 'screenshot', 'code', 'chapter']) {
  assert.deepEqual(cartoonBox(layout), corner, `${layout} 是右下角小圆`);
  assert.deepEqual(circleBox(), corner, '真人小窗和卡通同一个圆');
  assert.equal(overlaps(corner, CONTENT), false, `${layout} 小圆进入了内容区`);
  assert.equal(overlaps(corner, SUBTITLE), false, `${layout} 小圆进入了字幕条`);
}
assert.equal(overlaps(noteBox(corner), SUBTITLE), false, '竖版旧气泡函数仍避开字幕');

for (const id of ['paper', 'lecture', 'product', 'editorial']) {
  const style = avatarFrameStyle(tokens[id]);
  assert.equal(style.background, tokens[id].accentSoft, `${id} 圆内底色`);
  assert.equal(style.border, `6px solid ${tokens[id].surface}`, `${id} 内圈`);
  assert.match(style.boxShadow, new RegExp(`^0 0 0 3px ${tokens[id].accent.replace('#', '\\#')}`), `${id} 外圈`);
  assert.match(style.boxShadow, /0 24px 44px -20px rgba\(0,0,0,\.35\)/);
  assert.equal(style.borderRadius, 9999);
  assert.equal(style.overflow, 'hidden');
}

const pip = realBox({presenter: {layout: 'pip', aspectRatio: 16 / 9}});
assert.deepEqual(pip, corner, '真人画中画也是 210 圆');
assert.equal(realBox({presenter: {layout: 'hidden'}}), null);
const landscapeFull = realBox({presenter: {layout: 'full', aspectRatio: 16 / 9}});
assert.equal(landscapeFull.shape, 'full');
assert.deepEqual(landscapeFull, fullBox());
const portraitFull = realBox({presenter: {layout: 'full', aspectRatio: 9 / 16}});
assert.equal(portraitFull.shape, 'rounded');
assert.equal(portraitFull.radius, 20);
assert.deepEqual(portraitFull, sideBox());

const shrunk = morphBox(cover, corner, 1);
assert.equal(shrunk.w, 210);
assert.equal(shrunk.x, corner.x);
const mid = morphBox(cover, corner, 0.5);
assert.ok(mid.w > 210 && mid.w < 360, '0.4 秒中点直径介于大圆和小圆之间');
assert.equal(realFrameStyle(tokens.lecture, fullBox()).border, 'none');
assert.match(realFrameStyle(tokens.lecture, sideBox()).border, /^1px\s/u);

console.log('test-presenter-place：右下角 210 圆、封面 360 圆、竖版仍无框');
