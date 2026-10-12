#!/usr/bin/env node
// 印象派水面和壁画：确定性、安静区对比度、停死和孤立跳变。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {contrastRatio} from '../../template/src/scene/contrast.ts';
import {ART_FLOOR, ART_INK, paintArt, quietRect} from '../../template/src/scene/backdrops/art-raster.ts';
import {auditPlan, prepareScene} from '../../template/src/scene/prepare.ts';
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

function minContrast(style, pixels, w, h) {
  const quiet = quietRect(w, h);
  const ink = ART_INK[style];
  let worst = 99;
  let seen = 0;
  for (let y = quiet.y; y < quiet.y + quiet.h; y += 8) {
    for (let x = quiet.x; x < quiet.x + quiet.w; x += 8) {
      const i = (y * w + x) * 4;
      const hex = `#${[pixels[i], pixels[i + 1], pixels[i + 2]].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
      const ratio = contrastRatio(ink, hex);
      if (ratio < worst) worst = ratio;
      seen += 1;
    }
  }
  assert.ok(seen > 100, seen);
  return worst;
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

const W = 1080;
const H = 1920;
for (const style of ['impressionist', 'mural']) {
  const t0 = 1.25;
  const started = Date.now();
  const a = paintArt(style, W, H, t0);
  const once = Date.now() - started;
  const b = paintArt(style, W, H, t0);
  assert.ok(samePixels(a, b), `${style} 同一时刻两次不一致`);
  const moved = paintArt(style, W, H, t0 + 0.4);
  assert.equal(samePixels(a, moved), false, `${style} 过了 0.4 秒还停着`);
  const ratio = minContrast(style, a, W, H);
  assert.ok(ratio >= 4.5, `${style} 安静区对比度 ${ratio.toFixed(2)}`);
  const later = minContrast(style, moved, W, H);
  assert.ok(later >= 4.5, `${style} 后一帧对比度 ${later.toFixed(2)}`);

  const frames = [];
  for (let i = 0; i < 30; i++) frames.push(grayDown(paintArt(style, W, H, 0.4 + i / 15), W, H, 4).out);
  const scored = scoreFrames(frames, 270, 480, {sampleFps: 15, startSec: 0.4, freezeLevel: 'fail', jumpLevel: 'fail'});
  assert.equal(scored.level, 'ok', `${style} 动效 ${scored.level} 最静 ${scored.quietest} 跳变 ${scored.maxRatio}`);
  console.log(`${style} 一帧 ${once}ms 对比度 ${ratio.toFixed(2)} 最静 ${scored.quietest} 跳变 ${scored.maxRatio}`);
}
