#!/usr/bin/env node
// 印象派水面和壁画：确定性、画面占比、字形背后对比度、停死和孤立跳变。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {contrastRatio} from '../../template/src/scene/contrast.ts';
import {ART_FLOOR, ART_INK, bandsForScreen, inkContrastIn, paintArt, paintShare, quietRect} from '../../template/src/scene/backdrops/art-raster.ts';
import {captionRemainder, onScreenPhrases} from '../../template/src/scene/caption.ts';
import {fontFloorOf, auditPlan, prepareScene} from '../../template/src/scene/prepare.ts';
import {defaultMotion} from '../../template/src/scene/motion.ts';
import {PORTRAIT_CAPTION} from '../../template/src/scene/safe-box.ts';
import {scoreFrames} from '../broll/motion-check.mjs';
import {estimateSec} from '../lib/tts/checks.mjs';
import {sceneFrame} from './geom.mjs';
import {loadStyle} from './tokens.mjs';
import {formatReport, validateScene} from './validate-scene.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (name) => JSON.parse(readFileSync(path.join(ROOT, 'examples/scene', name), 'utf8'));
const impressionist = read('e-impressionist.json');
const mural = read('f-mural.json');

function withoutStyle(scene) {
  const copy = structuredClone(scene);
  delete copy.style;
  return copy;
}
assert.deepEqual(withoutStyle(impressionist), withoutStyle(mural));
assert.equal(defaultMotion('promo', 'impressionist', false), 'soft');
assert.equal(defaultMotion('promo', 'mural', false), 'soft');

const layouts = impressionist.screens.map((screen) => screen.layout);
for (const name of ['hero', 'stack', 'split', 'number', 'end']) {
  assert.ok(layouts.includes(name), name);
}

let spoken = 0;
for (const screen of impressionist.screens) spoken += estimateSec(screen.narration, 'zh', 1);
assert.ok(spoken >= 16 && spoken <= 26, `旁白约 ${spoken.toFixed(1)} 秒`);

function planOf(scene) {
  const result = validateScene(scene);
  assert.equal(result.ok, true, formatReport(result));
  const token = loadStyle('promo', scene.style);
  assert.equal(token.roles.bg, ART_FLOOR[scene.style]);
  assert.equal(token.roles.ink, ART_INK[scene.style]);
  assert.equal(token.extra.headlinePlate, 'none');
  const frame = sceneFrame('promo', '9:16');
  const plan = prepareScene({scene: result.scene, roles: token.roles, extra: token.extra, frame});
  assert.deepEqual(auditPlan(plan), []);
  assert.equal(plan.headlinePlate, 'none');
  assert.equal(plan.motion, 'soft');
  const quiet = quietRect(plan.width, plan.height);
  assert.ok(PORTRAIT_CAPTION.y >= quiet.y && PORTRAIT_CAPTION.y + PORTRAIT_CAPTION.h <= quiet.y + quiet.h);
  for (const screen of plan.screens) {
    for (const block of screen.blocks) {
      assert.ok(block.x >= quiet.x && block.x + block.w <= quiet.x + quiet.w, `${screen.layout} x`);
      assert.ok(block.y >= quiet.y && block.y + block.h + 20 <= quiet.y + quiet.h, `${screen.layout} y ${block.y}`);
    }
  }
  return plan;
}

planOf(impressionist);
planOf(mural);

function samePixels(a, b) {
  if (a.length !== b.length) return false;
  return Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;
}

function meaningful(text) {
  return [...String(text ?? '')].filter((ch) => !/[\s，。、！？：；,.!?:;“”"'‘’（）()【】…—\-–·~～《》「」『』]/u.test(ch)).length;
}

function grayDown(pixels, w, h, factor) {
  const ow = Math.floor(w / factor);
  const oh = Math.floor(h / factor);
  const out = new Uint8Array(ow * oh);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const i = (y * factor * w + x * factor) * 4;
      out[y * ow + x] = Math.round(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
    }
  }
  return {out, ow, oh};
}

const flat = new Uint8ClampedArray(8 * 8 * 4);
const floor = ART_FLOOR.impressionist;
const fr = parseInt(floor.slice(1, 3), 16);
const fg = parseInt(floor.slice(3, 5), 16);
const fb = parseInt(floor.slice(5, 7), 16);
for (let i = 0; i < flat.length; i += 4) {
  flat[i] = fr;
  flat[i + 1] = fg;
  flat[i + 2] = fb;
  flat[i + 3] = 255;
}
assert.equal(paintShare(flat, 8, 8), 0);
const one = inkContrastIn(flat, 8, 8, {x: 0, y: 0, w: 8, h: 8}, ART_INK.impressionist);
assert.ok(Math.abs(one - contrastRatio(ART_INK.impressionist, floor)) < 0.02, one);

const W = 1080;
const H = 1920;
for (const style of ['impressionist', 'mural']) {
  const scene = style === 'mural' ? mural : impressionist;
  const plan = planOf(scene);
  const t0 = 1.25;
  const started = Date.now();
  const a = paintArt(style, W, H, t0);
  const once = Date.now() - started;
  const b = paintArt(style, W, H, t0);
  assert.ok(samePixels(a, b), `${style} 同一时刻两次不一致`);
  const moved = paintArt(style, W, H, t0 + 0.4);
  assert.equal(samePixels(a, moved), false, `${style} 过了 0.4 秒还停着`);
  const bareShare = paintShare(a, W, H);
  assert.ok(bareShare >= 0.6, `${style} 无字画面占比 ${(bareShare * 100).toFixed(1)}%`);

  for (const screen of plan.screens) {
    const src = scene.screens[screen.index];
    const spoken = captionRemainder(src.narration || '', onScreenPhrases(src));
    assert.ok(meaningful(spoken) === 0 || meaningful(spoken) >= 4, `${style} ${screen.layout} 字幕残句「${spoken}」`);
    const blocks = screen.blocks.map((block) => ({
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      text: block.text,
      font: block.font,
      minFont: fontFloorOf(plan, screen, block),
      textAlign: block.textAlign,
      kind: block.kind,
    }));
    const caption = spoken
      ? {x: PORTRAIT_CAPTION.x, y: PORTRAIT_CAPTION.y, w: PORTRAIT_CAPTION.w, h: PORTRAIT_CAPTION.h, text: spoken, font: 48, minFont: 40, textAlign: 'center', kind: 'caption', lineHeight: 1.25}
      : null;
    const bands = bandsForScreen(screen.layout, blocks, caption);
    if (screen.layout === 'split') {
      const seam = bands.find((band) => band.role === 'seam');
      assert.ok(seam && seam.w >= 200 && seam.h >= 8, `${style} split 没有分隔`);
    }
    const painted = paintArt(style, W, H, t0, bands);
    const share = paintShare(painted, W, H);
    assert.ok(share >= 0.6, `${style} ${screen.layout} 画面占比 ${(share * 100).toFixed(1)}%`);
    let worst = 99;
    for (const band of bands) {
      if (band.role !== 'glyph') continue;
      const ratio = inkContrastIn(painted, W, H, {x: band.x - 12, y: band.y - 12, w: band.w + 24, h: band.h + 24}, ART_INK[style]);
      if (ratio < worst) worst = ratio;
      assert.ok(ratio >= 4.5, `${style} ${screen.layout} 字形背后 ${ratio.toFixed(2)}`);
    }
    const laterBands = paintArt(style, W, H, t0 + 0.4, bands);
    for (const band of bands) {
      if (band.role !== 'glyph') continue;
      const ratio = inkContrastIn(laterBands, W, H, {x: band.x - 12, y: band.y - 12, w: band.w + 24, h: band.h + 24}, ART_INK[style]);
      assert.ok(ratio >= 4.5, `${style} ${screen.layout} 后一帧字形背后 ${ratio.toFixed(2)}`);
    }
    console.log(`${style} ${screen.layout} 画面 ${(share * 100).toFixed(1)}% 字形背后 ${worst.toFixed(2)} 字幕「${spoken}」`);
  }

  const frames = [];
  for (let i = 0; i < 30; i++) frames.push(grayDown(paintArt(style, W, H, 0.4 + i / 15), W, H, 4).out);
  const scored = scoreFrames(frames, 270, 480, {sampleFps: 15, startSec: 0.4, freezeLevel: 'fail', jumpLevel: 'fail'});
  assert.equal(scored.level, 'ok', `${style} 动效 ${scored.level} 最静 ${scored.quietest} 跳变 ${scored.maxRatio}`);
  console.log(`${style} 一帧 ${once}ms 无字画面 ${(bareShare * 100).toFixed(1)}% 最静 ${scored.quietest} 跳变 ${scored.maxRatio}`);
}
