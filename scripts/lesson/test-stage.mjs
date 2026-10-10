#!/usr/bin/env node
// 统一版心：最长文案的内容包围盒留在内容区，不进讲解员保留区。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  AVATAR,
  CANVAS,
  CONTENT,
  COVER_AVATAR,
  LAYOUT_NAMES,
  MIN_BODY,
  RESERVE,
  RESERVE_ROW_RIGHT,
  SUBTITLE,
  boxTextFits,
  contentFrame,
  insideContent,
  intersectsReserve,
  layoutContentBoxes,
  nameBarMetrics,
  nameBarReserve,
  contrastRatio,
  subtitleChrome,
  subtitleLayout,
} from '../../template/src/lesson/stage.mjs';

assert.equal(AVATAR.w, 210);
assert.equal(AVATAR.h, 210);
assert.equal(AVATAR.x + AVATAR.w / 2, 1719);
assert.equal(AVATAR.y + AVATAR.h / 2, 923);
assert.equal(CANVAS.w - (AVATAR.x + AVATAR.w), 96);
assert.equal(CANVAS.h - (AVATAR.y + AVATAR.h), 52);
assert.equal(COVER_AVATAR.w, 360);
assert.equal(COVER_AVATAR.x, 1440);
assert.deepEqual(CONTENT, {x: 120, y: 300, right: 1800, bottom: 880});
assert.deepEqual(RESERVE, {x: 1600, y: 810});

assert.equal(RESERVE_ROW_RIGHT, 1580);
assert.equal(intersectsReserve({x: 1500, y: 820, w: 90, h: 50}), false, '右缘停在 1590 的下排不进保留区');
assert.equal(intersectsReserve({x: 120, y: 820, w: 1460, h: 50}), false, '收到 x 1580 的下排可以落到 y 880');
assert.equal(insideContent({x: 120, y: 820, w: 1460, h: 50}), true);
assert.equal(intersectsReserve({x: 1580, y: 820, w: 40, h: 40}), true, '越过 x 1600 且低于 y 810 才算进保留区');
assert.equal(intersectsReserve({x: 120, y: 300, w: 1680, h: 500}), false, '底边停在 800 的全宽块不进保留区');
assert.equal(intersectsReserve({x: 120, y: 300, w: 1680, h: 530}), true, '全宽块底边落到 830 就进了右下角');
assert.equal(intersectsReserve({x: 1700, y: 400, w: 80, h: 80}), false, '右上角不是保留区');

const nameBar = nameBarMetrics({name: '陈思远', title: '律师', firmLine: '衡川律师事务所 · 民商事业务部'});
const nameReserve = nameBarReserve(nameBar);
assert.ok(nameReserve.x <= nameBar.x && nameReserve.x < RESERVE.x, `姓名条保留区左缘 ${nameReserve.x}`);
assert.ok(nameReserve.y <= nameBar.y && nameReserve.y < RESERVE.y, `姓名条保留区上缘 ${nameReserve.y}`);
assert.equal(intersectsReserve({x: nameReserve.x + 8, y: nameReserve.y + 8, w: 80, h: 40}), false, '姓名条那一块不在小保留区里');
assert.equal(intersectsReserve({x: nameReserve.x + 8, y: nameReserve.y + 8, w: 80, h: 40}, nameReserve), true);

for (const layout of LAYOUT_NAMES) {
  const frame = contentFrame(layout);
  const boxes = layoutContentBoxes(layout);
  assert.ok(boxes.length > 0, `${layout} 没有内容盒`);
  let left = Infinity;
  let right = 0;
  let top = Infinity;
  let bottom = 0;
  let cleft = Infinity;
  let cright = 0;
  let cbottom = 0;
  for (const box of boxes) {
    if (box.bleed) {
      assert.ok(box.x >= -0.01 && box.y >= -0.01 && box.x + box.w <= CANVAS.w + 0.01 && box.y + box.h <= CANVAS.h + 0.01, `${layout} 出血盒出画布`);
      assert.equal(intersectsReserve(box), false, `${layout} 出血盒碰到讲解员`);
    } else {
      assert.equal(insideContent(box), true, `${layout} 盒子越出内容区 ${JSON.stringify(box)}`);
      assert.equal(intersectsReserve(box), false, `${layout} 碰到讲解员保留区`);
      cleft = Math.min(cleft, box.x);
      cright = Math.max(cright, box.x + box.w);
      cbottom = Math.max(cbottom, box.y + box.h);
    }
    assert.ok(box.fontPx >= MIN_BODY, `${layout} 正文字号 ${box.fontPx} 小于 30`);
    assert.equal(boxTextFits(box), true, `${layout} 最长文案出框 ${box.text} / ${box.fontPx}px / ${box.w}x${box.h}`);
    left = Math.min(left, box.x);
    right = Math.max(right, box.x + box.w);
    top = Math.min(top, box.y);
    bottom = Math.max(bottom, box.y + box.h);
  }
  assert.ok(right - left >= frame.width * 0.85, `${layout} 内容宽度 ${right - left} 没有撑满版心 ${frame.width}`);
  assert.ok(bottom - top >= frame.height * 0.65, `${layout} 内容高度 ${bottom - top} 没有撑满版心 ${frame.height}`);
  if (cright > 0) {
    assert.ok(cbottom <= CONTENT.bottom + 0.01, `${layout} 非出血盒底边 ${cbottom}`);
    assert.ok(cright <= CONTENT.right + 0.01, layout);
  }
  for (const box of layoutContentBoxes(layout, {reserve: nameReserve})) {
    assert.equal(intersectsReserve(box, nameReserve), false, `${layout} 姓名条页碰到姓名条 ${JSON.stringify(box)}`);
  }
}

const chapterPanel = layoutContentBoxes('chapter').find((box) => box.bleed && box.h >= CANVAS.h);
assert.ok(chapterPanel, '章节页要有通高面板');
assert.ok(chapterPanel.w >= CANVAS.w * 0.42 && chapterPanel.w <= CANVAS.w * 0.44, `章节面板宽 ${chapterPanel.w}`);
assert.equal(layoutContentBoxes('bignumber')[0].fontPx, 380);
assert.ok(layoutContentBoxes('statement').some((box) => box.fontPx === 104));
assert.ok(layoutContentBoxes('saying').some((box) => box.fontPx === 116));
const quoteBoxes = layoutContentBoxes('quote');
assert.ok(quoteBoxes.some((box) => box.fontPx === 44));
const quoteShell = quoteBoxes[0];
const quoteTag = quoteBoxes.find((box) => box.fontPx === 44);
assert.ok(quoteTag, '法条卡要有底栏盒');
assert.ok(Math.abs(quoteTag.y + quoteTag.h + 44 - (quoteShell.y + quoteShell.h)) < 1, `底栏下沿到卡片底边应是 44px，实际 ${quoteShell.y + quoteShell.h - quoteTag.y - quoteTag.h}`);

const shortBar = subtitleLayout('利息别预先扣除');
assert.equal(shortBar.font, 40);
assert.equal(shortBar.lines.length, 1);
assert.ok(Math.abs(shortBar.x + shortBar.width / 2 - SUBTITLE.centerX) < 1, '字幕条中心在 x 900');
assert.equal(shortBar.y + shortBar.height, CANVAS.h - SUBTITLE.bottom);
assert.ok(shortBar.width <= SUBTITLE.maxWidth);
assert.equal(SUBTITLE.background, undefined);
assert.equal(SUBTITLE.color, undefined);

const answer = subtitleLayout('答案：不可以。');
assert.equal(answer.lines.length, 1, '答案：不可以。放得下就要一行');
assert.equal(answer.lines[0], '答案：不可以。');
assert.equal(answer.font, 40);
assert.ok(answer.width >= 7 * 40, '底条至少按这一行的字宽');
assert.ok(answer.width < 7 * 40 + SUBTITLE.padX * 2 + 16);

const thirty = subtitleLayout('字'.repeat(30));
assert.equal(thirty.lines.length, 1, '30 个字以内一行');
assert.equal(thirty.font, 40);
assert.ok(thirty.width <= SUBTITLE.maxWidth);
assert.ok(thirty.width >= 30 * 40);

const fortyFive = subtitleLayout('字'.repeat(45));
assert.equal(fortyFive.lines.length, 2, '45 个字折成两行');
assert.ok(Math.abs([...fortyFive.lines[0]].length - [...fortyFive.lines[1]].length) <= 4, `两行差 ${[...fortyFive.lines[0]].length - [...fortyFive.lines[1]].length}`);
assert.equal(fortyFive.lines.join(''), '字'.repeat(45));

const kept = subtitleLayout(`${'甲'.repeat(16)}不可以${'乙'.repeat(16)}`);
assert.equal(kept.lines.length, 2);
assert.equal(kept.lines.some((line) => line.includes('不') && !line.includes('不可以')), false, `不可以被拆开了：${kept.lines.join(' / ')}`);
assert.ok(kept.lines.some((line) => line.includes('不可以')));

const longBar = subtitleLayout(`${'借条里如果没写利息就视为没有利息'.repeat(4)}\u2060`);
assert.equal(longBar.lines.length, 2, '超长字幕断成两行');
assert.ok(longBar.width <= SUBTITLE.maxWidth, '两行也不出底条');
assert.ok(longBar.font >= MIN_BODY);
assert.equal(longBar.y + longBar.height, CANVAS.h - SUBTITLE.bottom);
assert.ok(longBar.x + longBar.width <= AVATAR.x, '字幕条不盖住讲解员圆');
assert.equal(longBar.lines.join('').includes('\u2060'), false);

const tokens = JSON.parse(readFileSync(new URL('../../template/src/lesson/style-tokens.json', import.meta.url), 'utf8'));
const bgs = new Set();
for (const id of ['paper', 'lecture', 'product', 'editorial']) {
  const token = tokens[id];
  const chrome = subtitleChrome(token);
  assert.equal(chrome.background, token.badgeBg);
  assert.equal(chrome.color, token.badgeFg);
  assert.equal(chrome.radius, token.radius);
  assert.match(chrome.background, /^#[0-9A-Fa-f]{6}$/);
  assert.match(chrome.color, /^#[0-9A-Fa-f]{6}$/);
  assert.ok(contrastRatio(token.badgeFg, token.badgeBg) >= 4.5, `${id} 片头标识 ${contrastRatio(token.badgeFg, token.badgeBg).toFixed(2)}`);
  assert.ok(contrastRatio(chrome.color, chrome.background) >= 4.5, `${id} 字幕条 ${contrastRatio(chrome.color, chrome.background).toFixed(2)}`);
  assert.ok(contrastRatio(chrome.karaokeRest, chrome.background) >= 4.5, `${id} 未念字幕 ${contrastRatio(chrome.karaokeRest, chrome.background).toFixed(2)}`);
  assert.notEqual(chrome.karaokeRest, chrome.karaokeSpoken);
  bgs.add(chrome.background);
}
assert.equal(bgs.size, 4, '四套主题的字幕条底色不能是同一个写死色');
const markingSource = readFileSync(new URL('../../template/src/lesson/overlays/LegalMarkings.tsx', import.meta.url), 'utf8');
assert.match(markingSource, /background:t\.badgeBg/);
assert.match(markingSource, /color:t\.badgeFg/);
assert.doesNotMatch(markingSource, /rgba\(0,\s*0,\s*0/);
assert.doesNotMatch(markingSource, /opacity:\s*0\./);
const colors = {
  paper: {alert: '#B23A2B', ok: '#2F6B4F', hl: '#F1D98A', deco: '#B08D57'},
  lecture: {alert: '#B23A2B', ok: '#2F6B5F', hl: '#F6D9A8', deco: '#2F6B5F'},
  product: {alert: '#D93025', ok: '#188038', hl: '#CFE3FF', deco: '#0A66E0'},
  editorial: {alert: '#C13A22', ok: '#2B59C3', hl: '#FFE14D', deco: '#121212'},
};
for (const [id, expected] of Object.entries(colors)) {
  for (const key of Object.keys(expected)) assert.equal(tokens[id][key], expected[key], `${id}.${key}`);
}

console.log(`test-stage：${LAYOUT_NAMES.length} 个版式的最长文案都在版心内`);
