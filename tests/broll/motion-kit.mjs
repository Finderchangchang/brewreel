#!/usr/bin/env node
// 剪纸部件 + broll.json 的 motionTheme / --motion-look。不渲染、不联网。
//   node tests/broll/motion.mjs 的配色名单测试会另跑；这里只覆盖任务点名的断言。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deltaE as libDeltaE} from '../../scripts/lib/color.mjs';
import {forceTop, parseArgs as parseLlmArgs} from '../../scripts/broll/llm_broll.mjs';
import {parseTalkArgs} from '../../scripts/talk.mjs';
import {MOTION_LOOKS, motionLookOf, resolveMotionLook} from '../../scripts/broll/motion.mjs';
import {loadStyles, validateBroll} from '../../scripts/broll/validate.mjs';
import {LOOK_DEFAULTS} from '../../template/src/talk/motion/palette.ts';
import {anchorRelay} from '../../template/src/talk/motion/kit/anchorRelay.ts';
import {deltaE} from '../../template/src/talk/motion/kit/color.ts';
import {CUT_JITTER, CUT_STEP, SHADOW_720, TILT_AVOID, TILT_AVOID_BAND, TILT_MAX, TILT_MIN, cutGeometry, restTiltFor, safeTilt, shadowColor, tiltFromSeed} from '../../template/src/talk/motion/kit/cutShape.ts';
import {anchorPose, faceVisibility, facingBack, flipPose, pickTosses, placeTosses, TOSS_GAP} from '../../template/src/talk/motion/kit/anchorMotion.ts';
import {floatMotion, periodsCoprime} from '../../template/src/talk/motion/kit/float.ts';
import {settle} from '../../template/src/talk/motion/kit/settle.ts';
import {SHADOW_BY_HEIGHT, shadowByHeight} from '../../template/src/talk/motion/kit/shadowByHeight.ts';
import {projectPoint} from '../../template/src/talk/motion/kit/project.ts';
import {ENTRANCE_RANGE, EXIT_RANGE, PERSPECTIVE, entrance, leave, toss} from '../../template/src/talk/motion/kit/toss.ts';
import {threeColor} from '../../template/src/talk/motion/kit/threeColor.ts';
import {anchorLines} from '../../template/src/talk/motion/anchorLayout.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name} — ${detail}` : name);
};

const nearAvoid = (deg) => Math.abs(deg - TILT_AVOID) <= TILT_AVOID_BAND;

// ---------- CutShape ----------
const sides = new Set();
for (let i = 0; i < 240; i++) {
  const g = cutGeometry(i + 3);
  sides.add(g.sides);
  if (g.sides < 4 || g.sides > 7) check(`边数 ${i}`, false, String(g.sides));
  if (g.tilt < TILT_MIN || g.tilt > TILT_MAX) check(`默认倾斜 ${i}`, false, String(g.tilt));
  if (nearAvoid(g.tilt)) check(`默认倾斜躲开禁区 ${i}`, false, String(g.tilt));
}
check('4 到 7 边都出现过', [4, 5, 6, 7].every((n) => sides.has(n)), [...sides].sort().join(','));
check('明示招牌静止角会被推出禁区', !nearAvoid(safeTilt(TILT_AVOID, -20, 20)) && Math.abs(safeTilt(TILT_AVOID, -20, 20) - TILT_AVOID) > TILT_AVOID_BAND, String(safeTilt(TILT_AVOID, -20, 20)));
let badWide = 0;
for (let i = 0; i < 400; i++) {
  const t = tiltFromSeed(i, -20, 5);
  if (nearAvoid(t) || t < -20 || t > 5) badWide += 1;
}
check('放宽范围后仍然不落进禁区', badWide === 0, String(badWide));
check('同一外观的静止角稳定且在默认范围', (() => {
  const a = restTiltFor('cutpaper-meadow');
  return a === restTiltFor('cutpaper-meadow') && a >= TILT_MIN && a <= TILT_MAX && !nearAvoid(a);
})());
check('投影参数落在原理区间', SHADOW_720.dx >= 0 && SHADOW_720.dx <= 12 && SHADOW_720.dy >= 36 && SHADOW_720.dy <= 47, JSON.stringify(SHADOW_720));
const shade = shadowColor('#7EA870');
check('投影色不是纯黑也不是那支青绿', shade !== '#000000' && shade.toLowerCase() !== '#4b8481' && /^#[0-9a-f]{6}$/i.test(shade), shade);
const poly = cutGeometry('polyline-check', {width: 420, height: 300});
check('手剪边只有直线', !/[QqCcAaSsTt]/.test(poly.d) && poly.d.startsWith('M ') && poly.d.endsWith('Z'), poly.d.slice(0, 60));
const polyPts = poly.d.match(/-?\d+(?:\.\d+)?/g);
check('沿轮廓按步长重采样，点比边数多', Boolean(polyPts) && polyPts.length / 2 > poly.sides * 2, `${polyPts ? polyPts.length / 2 : 0}/${poly.sides}`);
check('同一种子折线相同', cutGeometry('seed-a', {width: 300, height: 200}).d === cutGeometry('seed-a', {width: 300, height: 200}).d);
check('步长和抖动是写死的正数', CUT_STEP >= 8 && CUT_STEP <= 40 && CUT_JITTER > 0 && CUT_JITTER < CUT_STEP / 2, `${CUT_STEP}/${CUT_JITTER}`);

// ---------- settle ----------
const curve = settle(1000);
check('上去、下来落在区间且下来更长', curve.up >= 0.4 && curve.up <= 0.7 && curve.down >= 0.8 && curve.down <= 1.1 && curve.down > curve.up, `${curve.up}/${curve.down}`);
const samples = [];
for (let t = 0; t <= curve.duration + 0.25; t += 1 / 60) samples.push(curve.at(Number(t.toFixed(4))));
const minI = samples.reduce((b, s, i) => (s.y < samples[b].y ? i : b), 0);
let bounced = false;
for (let i = minI + 1; i < samples.length; i++) if (samples[i].y + 0.05 < samples[i - 1].y) bounced = true;
const minY = samples[minI].y;
const end = samples[samples.length - 1];
check('上抛行程在 15%–25% 高', minY <= -150 + 1 && minY >= -250 - 1, String(minY));
check('位置过冲不超过 1% 高，并停在那里', end.y >= -0.01 && end.y <= 10.01 && Math.abs(end.y - curve.posOver * 1000) < 0.05, String(end.y));
check('过了最高点之后不再往回弹', !bounced);
const peakI = samples.reduce((b, s, i) => (Math.abs(s.tilt - curve.restTilt) > Math.abs(samples[b].tilt - curve.restTilt) ? i : b), 0);
const peak = Math.abs(samples[peakI].tilt - curve.restTilt);
check('角度过冲 10–18 度', peak >= 10 - 0.05 && peak <= 18 + 0.05, String(peak));
let angleBounce = false;
const sign = Math.sign(samples[peakI].tilt - curve.restTilt) || 1;
for (let i = peakI + 1; i < samples.length; i++) {
  const prev = Math.abs(samples[i - 1].tilt - curve.restTilt);
  const now = Math.abs(samples[i].tilt - curve.restTilt);
  if (now > prev + 0.08) angleBounce = true;
  if (sign * (samples[i].tilt - curve.restTilt) < -0.2) angleBounce = true;
}
check('角度回到静止角，没有第二次过冲', !angleBounce && Math.abs(end.tilt - curve.restTilt) < 0.05, String(end.tilt));
const mid = curve.at(curve.up + curve.down * 0.3);
const late = curve.at(curve.up + curve.down * 0.92);
check('下来的末段速度掉下去', mid.speed > late.speed * 8, `${mid.speed} vs ${late.speed}`);

// ---------- toss / entrance / leave ----------
const lift = toss(1000);
check('上抛行程 18%–24% 高', lift.travel >= 0.18 && lift.travel <= 0.24, String(lift.travel));
check('上抛上升 0.5–0.6 秒、下落 0.9–1.1 秒且下落更长', lift.up >= 0.5 && lift.up <= 0.6 && lift.down >= 0.9 && lift.down <= 1.1 && lift.down > lift.up, `${lift.up}/${lift.down}`);
const liftSamples = [];
for (let t = 0; t <= lift.duration + 0.05; t += 1 / 60) liftSamples.push(lift.at(Number(t.toFixed(4))));
const liftMin = liftSamples.reduce((b, s, i) => (s.y < liftSamples[b].y ? i : b), 0);
check('上抛最高点在 18%–24% 高', liftSamples[liftMin].y <= -180 + 1 && liftSamples[liftMin].y >= -240 - 1, String(liftSamples[liftMin].y));
const liftEnd = lift.at(lift.duration);
check('上抛结束回到静止位', Math.abs(liftEnd.y) < 0.5 && Math.abs(liftEnd.tilt - lift.restTilt) < 0.05 && liftEnd.rotX === 0 && liftEnd.rotY === 0, JSON.stringify(liftEnd));
let posOver = 0;
for (const s of liftSamples) if (s.y > posOver) posOver = s.y;
check('位置过冲不超过 1% 高', posOver <= 10.01, String(posOver));
const tiltPeak = liftSamples.reduce((m, s) => Math.max(m, Math.abs(s.tilt - lift.restTilt)), 0);
check('角度过冲约 14°（12–16）', tiltPeak >= 12 - 0.05 && tiltPeak <= 16 + 0.05, String(tiltPeak));
let tiltBumps = 0;
let tiltUp = false;
for (let i = 1; i < liftSamples.length; i++) {
  const prev = Math.abs(liftSamples[i - 1].tilt - lift.restTilt);
  const now = Math.abs(liftSamples[i].tilt - lift.restTilt);
  if (!tiltUp && now > prev + 0.02) tiltUp = true;
  if (tiltUp && now + 0.02 < prev) {
    tiltBumps += 1;
    tiltUp = false;
  }
}
check('角度只过冲一次', tiltBumps === 1, String(tiltBumps));
const fallU = (u) => lift.at(lift.up + lift.down * 0.86 * u);
check('下落末段速度至少掉一个数量级', fallU(0.12).speed > fallU(0.9).speed * 8, `${fallU(0.12).speed} vs ${fallU(0.9).speed}`);
const riseU = (u) => lift.at(lift.up * u);
check('上升是 ease-out', riseU(0.08).speed > riseU(0.92).speed * 3, `${riseU(0.08).speed} vs ${riseU(0.92).speed}`);
const rotXPeak = liftSamples.reduce((m, s) => Math.max(m, s.rotX), 0);
const rotYPeak = liftSamples.reduce((m, s) => Math.max(m, Math.abs(s.rotY)), 0);
check('上抛 rotateX 落在 10–25°', rotXPeak >= 10 - 0.05 && rotXPeak <= 25 + 0.05, String(rotXPeak));
check('上抛 rotateY 落在 10–20°', rotYPeak >= 10 - 0.05 && rotYPeak <= 20 + 0.05, String(rotYPeak));
check('落地时 rotateX / rotateY 回到 0', Math.abs(lift.at(lift.up + lift.down).rotX) < 0.05 && Math.abs(lift.at(lift.up + lift.down).rotY) < 0.05);

const fly = entrance(1000, 800, {restTilt: 3, startTilt: -36, from: 'below'});
check('飞入 0.45–0.6 秒', fly.duration >= ENTRANCE_RANGE.dur[0] && fly.duration <= ENTRANCE_RANGE.dur[1], String(fly.duration));
check('飞入起始角 ±25–40°', Math.abs(fly.at(0).tilt) >= 25 && Math.abs(fly.at(0).tilt) <= 40, String(fly.at(0).tilt));
check('飞入从下方开始', fly.at(0).y > 200, String(fly.at(0).y));
const flySamples = [];
for (let t = 0; t <= fly.duration; t += 1 / 60) flySamples.push(fly.at(Number(t.toFixed(4))));
let far = 0;
for (const s of flySamples) {
  const past = fly.startTilt >= fly.restTilt ? fly.restTilt - s.tilt : s.tilt - fly.restTilt;
  if (past > far) far = past;
}
check('飞入角度过冲约 14°', far >= 12 - 0.05 && far <= 16 + 0.05, String(far));
const flyEnd = fly.at(fly.duration);
check('飞入停在静止位，位置过冲不超过 1% 高', Math.abs(flyEnd.y) < 0.5 && Math.abs(flyEnd.x) < 0.5 && Math.abs(flyEnd.tilt - 3) < 0.05 && flySamples.every((s) => s.y <= 1000), `${flyEnd.y},${flyEnd.tilt}`);
let flyPos = 0;
for (const s of flySamples) if (s.y < 0) flyPos = Math.max(flyPos, -s.y);
check('飞入位置过冲不超过 1% 高', flyPos <= 10.01, String(flyPos));
const side = entrance(900, 700, {from: 'side', startTilt: 32});
check('侧面飞入从画面外侧开始', Math.abs(side.at(0).x) > 150, String(side.at(0).x));

const exitMove = leave(1000);
check('翻出 0.35–0.5 秒，rotateX 到 70–90°', exitMove.duration >= EXIT_RANGE.dur[0] && exitMove.duration <= EXIT_RANGE.dur[1] && exitMove.at(1).rotX >= 70 && exitMove.at(1).rotX <= 90, `${exitMove.duration}/${exitMove.at(1).rotX}`);
check('翻出往上离开，不在原点', exitMove.at(1).y < -400, String(exitMove.at(1).y));
check('透视落在 1000–1400', PERSPECTIVE >= 1000 && PERSPECTIVE <= 1400, String(PERSPECTIVE));
const pcx = 400;
const pcy = 300;
const topL = projectPoint(pcx - 180, pcy - 120, pcx, pcy, 0, 55, PERSPECTIVE);
const botL = projectPoint(pcx - 180, pcy + 120, pcx, pcy, 0, 55, PERSPECTIVE);
const topR = projectPoint(pcx + 180, pcy - 120, pcx, pcy, 0, 55, PERSPECTIVE);
const botR = projectPoint(pcx + 180, pcy + 120, pcx, pcy, 0, 55, PERSPECTIVE);
const hL = Math.abs(botL.y - topL.y);
const hR = Math.abs(botR.y - topR.y);
check('绕 Y 时近侧更高，不是左右同高的压扁', Math.abs(hL - hR) / Math.max(hL, hR) > 0.12, `${hL.toFixed(1)}/${hR.toFixed(1)}`);
const origin = projectPoint(pcx, pcy, pcx, pcy, 22, 40, PERSPECTIVE);
check('投影中心不动', Math.abs(origin.x - pcx) < 0.05 && Math.abs(origin.y - pcy) < 0.05);
const flat = projectPoint(pcx + 100, pcy - 40, pcx, pcy, 0, 0, PERSPECTIVE);
check('零转角不变形', Math.abs(flat.x - (pcx + 100)) < 0.05 && Math.abs(flat.y - (pcy - 40)) < 0.05);

// ---------- float ----------
const bob = floatMotion(1000);
check('浮动振幅 1–1.5% 高、倾斜 2–3°', bob.ampY >= 10 - 0.01 && bob.ampY <= 15 + 0.01 && bob.ampTilt >= 2 && bob.ampTilt <= 3, `${bob.ampY}/${bob.ampTilt}`);
check('浮动周期 1.6–2.4 秒且互质', bob.periodY >= 1.6 && bob.periodY <= 2.4 && bob.periodTilt >= 1.6 && bob.periodTilt <= 2.4 && bob.periodY !== bob.periodTilt && periodsCoprime(bob.periodY, bob.periodTilt), `${bob.periodY}/${bob.periodTilt}`);
let yLo = Infinity;
let yHi = -Infinity;
let tLo = Infinity;
let tHi = -Infinity;
for (let t = 0; t <= bob.periodY * bob.periodTilt; t += 1 / 50) {
  const s = bob.at(t);
  if (s.y < yLo) yLo = s.y;
  if (s.y > yHi) yHi = s.y;
  if (s.tilt < tLo) tLo = s.tilt;
  if (s.tilt > tHi) tHi = s.tilt;
}
check('浮动确实上下、左右倾', yHi - yLo > bob.ampY * 1.8 && tHi - tLo > bob.ampTilt * 1.8, `${yHi - yLo}/${tHi - tLo}`);
const half = floatMotion(1000, {ampScale: 0.5});
check('轻浮动不超过剪纸默认的一半', half.ampY <= bob.ampY * 0.5 + 0.02 && half.ampTilt <= bob.ampTilt * 0.5 + 0.02 && half.ampY >= bob.ampY * 0.5 - 0.02, `${half.ampY}/${half.ampTilt} vs ${bob.ampY}/${bob.ampTilt}`);

// ---------- shadowByHeight ----------
const sh0 = shadowByHeight(0, 720);
const sh1 = shadowByHeight(1, 720);
check('静止投影偏下 36–47、模糊 18–24、不透明度 0.45', sh0.dy >= 36 && sh0.dy <= 47 && sh0.blur >= 18 && sh0.blur <= 24 && Math.abs(sh0.opacity - 0.45) < 0.001 && sh0.dx >= 0 && sh0.dx <= 12, JSON.stringify(sh0));
check('顶点投影偏下约 +50%、模糊 40–55、不透明度 0.22', Math.abs(sh1.dy - SHADOW_BY_HEIGHT.dyRest * 1.5) < 0.2 && sh1.blur >= 40 && sh1.blur <= 55 && Math.abs(sh1.opacity - 0.22) < 0.001, JSON.stringify(sh1));
let shadowMono = true;
let prevSh = shadowByHeight(0, 720);
for (let h = 0.1; h <= 1.001; h += 0.1) {
  const sh = shadowByHeight(Number(h.toFixed(2)), 720);
  if (sh.dy + 1e-6 < prevSh.dy || sh.blur + 1e-6 < prevSh.blur || sh.opacity > prevSh.opacity + 1e-6) shadowMono = false;
  prevSh = sh;
}
check('投影随高度单调：偏下和模糊变大，不透明度变小', shadowMono);
const shHi = shadowByHeight(1, 1080);
check('1080 参考像素按短边放大', Math.abs(shHi.dy - sh1.dy * 1.5) < 0.2, String(shHi.dy));

// ---------- anchorPose：任意 0.4 秒都还在动 ----------
check('两次上抛至少隔 1.2 秒', JSON.stringify(pickTosses([0.4, 1.0, 1.7, 3.2], {dur: 4, enterEnd: 0.52, exitStart: 3.5})) === JSON.stringify([0.52 > 0.4 ? 1.0 : 0.4, 3.2].filter((t) => t >= 0.52 - 1e-3 && t - (t < 1.2 ? 0 : 1) < 99)) || pickTosses([0.4, 1.0, 1.7, 3.2], {dur: 4, enterEnd: 0.52, exitStart: 3.5}).every((t, i, arr) => i === 0 || t - arr[i - 1] >= TOSS_GAP - 1e-6), JSON.stringify(pickTosses([0.4, 1.0, 1.7, 3.2], {dur: 4, enterEnd: 0.52, exitStart: 3.5})));
const picked = pickTosses([0.2, 0.9, 2.2, 3.5], {dur: 4.2, enterEnd: 0.52, exitStart: 3.7, gap: TOSS_GAP});
check('飞入期间和退场之后的抛起会被丢掉', picked[0] >= 0.52 - 1e-3 && picked.every((t, i) => i === 0 || t - picked[i - 1] >= 1.2 - 1e-6) && picked.every((t) => t <= 3.7), JSON.stringify(picked));
check('翻到 180° 看见背面', facingBack(180) && !facingBack(0) && facingBack(120));
check('60° 以后藏正面，翻过 120° 才露背面', faceVisibility(50) === 'front' && faceVisibility(60) === 'front' && faceVisibility(70) === 'edge' && faceVisibility(90) === 'edge' && faceVisibility(119) === 'edge' && faceVisibility(120) === 'back' && faceVisibility(180) === 'back', `${faceVisibility(70)}/${faceVisibility(120)}`);
check('口播时刻被裁掉时，抛起落在窗口 35%–50%', (() => {
  const at = placeTosses([0.1], {dur: 4, enterEnd: 0.52, exitStart: 3.6});
  const span = 3.6 - 0.52;
  return at.length === 1 && at[0] >= 0.52 + span * 0.35 - 1e-6 && at[0] <= 0.52 + span * 0.5 + 1e-6;
})(), JSON.stringify(placeTosses([0.1], {dur: 4, enterEnd: 0.52, exitStart: 3.6})));
const flipped = flipPose(1.35, [1]);
check('翻面从正面内容翻到下一条', flipped.flip > 40 && flipped.flip < 180 && flipped.faceA === 0 && flipped.faceB === 1, JSON.stringify(flipped));
const poseH = 1152;
const poseDur = 4;
const poses = [];
for (let t = 0; t <= poseDur; t += 1 / 30) {
  poses.push(anchorPose({t, dur: poseDur, height: poseH, width: 1080, restTilt: 2.5, relay: false, hold: false, seed: 'motion-window', tossAt: [1.5], flipAt: []}));
}
let quiet = 0;
const win = 12;
for (let i = 0; i + win < poses.length; i++) {
  let path = 0;
  let ang = 0;
  for (let k = 0; k < win; k++) {
    const a = poses[i + k];
    const b = poses[i + k + 1];
    path += Math.hypot(b.x - a.x, b.y - a.y);
    ang += Math.abs(b.tilt - a.tilt) + Math.abs(b.rotX - a.rotX) + Math.abs(b.rotY + b.flip - (a.rotY + a.flip));
  }
  const pathPx = path * (720 / 1080);
  if (pathPx < 6 && ang < 1) quiet += 1;
}
check('4 秒样段里任意 0.4 秒窗口都有可见运动', quiet === 0, `安静窗口 ${quiet}`);

// ---------- anchorRelay ----------
const meadow = '#7EA870';
const brick = '#7E3E44';
let closeHex = '';
let farHex = '';
for (let g = 0; g < 256 && (!closeHex || !farHex); g += 2) {
  const hex = `#7E${g.toString(16).padStart(2, '0')}44`;
  const d = deltaE(brick, hex);
  if (!closeHex && d > 0.4 && d <= 8) closeHex = hex;
  if (!farHex && d > 12) farHex = hex;
}
check('色差拷贝和脚本一致', Math.abs(deltaE(brick, meadow) - libDeltaE(brick, meadow)) < 1e-6, String(deltaE(brick, meadow)));
check('找到了近色和远色', Boolean(closeHex && farHex), `${closeHex} ${farHex}`);
const okRelay = anchorRelay({sameLook: true, gapSec: 2, prev: {tilt: 2, color: brick}, next: {tilt: 4, color: closeHex}});
check('同一外观、间隔 2 秒、倾斜差 2°、颜色够近：接力', okRelay.relay && okRelay.tilt === 2 && okRelay.color === brick, JSON.stringify(okRelay));
check('间隔正好 3 秒仍接力', anchorRelay({sameLook: true, gapSec: 3, prev: {tilt: 1, color: brick}, next: {tilt: 1, color: brick}}).relay);
check('间隔超过 3 秒各自入场', !anchorRelay({sameLook: true, gapSec: 3.01, prev: {tilt: 1, color: brick}, next: {tilt: 1, color: brick}}).relay);
check('倾斜差超过 3° 各自入场', !anchorRelay({sameLook: true, gapSec: 1, prev: {tilt: 0, color: brick}, next: {tilt: 3.2, color: brick}}).relay);
check('颜色差超过 8 各自入场', !anchorRelay({sameLook: true, gapSec: 1, prev: {tilt: 1, color: brick}, next: {tilt: 1, color: farHex}}).relay);
check('外观不同各自入场', !anchorRelay({sameLook: false, gapSec: 1, prev: {tilt: 1, color: brick}, next: {tilt: 1, color: brick}}).relay);
check('窗口重叠不接力', !anchorRelay({sameLook: true, gapSec: -0.2, prev: {tilt: 1, color: brick}, next: {tilt: 1, color: brick}}).relay);
check('没有上一段就各自入场', !anchorRelay(null).relay);

// ---------- threeColor ----------
for (const name of ['cutpaper-meadow', 'cutpaper-dusk']) {
  const p = LOOK_DEFAULTS[name];
  const r = threeColor({bg: p.bg, accent: p.accent, dark: p.ink, scraps: [p.cool, p.warm, p.muted]});
  check(`${name} 是底 + 一个强调色 + 一个深色`, r.ok, r.problems.join('; '));
}
const badScrap = threeColor({bg: '#7EA870', accent: '#7E3E44', dark: '#1C1A24', scraps: ['#7E3E44']});
check('碎屑复用强调色不通过', !badScrap.ok);
const badClose = threeColor({bg: '#7EA870', accent: '#86A878', dark: '#1C1A24', scraps: []});
check('底和强调色太近不通过', !badClose.ok && badClose.problems.some((s) => s.includes('10')));
const badDark = threeColor({bg: '#1C1A24', accent: '#7E3E44', dark: '#F6F1E4', scraps: []});
check('深色比底还亮不通过', !badDark.ok);

// ---------- motionTheme 字段 ----------
const styles = loadStyles();
const ctx = {cues: [{id: 'c1', startMs: 0, endMs: 3000, text: '你好世界'}], durationMs: 8000, width: 1080, height: 1920, styles, banned: [], projectDir: ROOT};
const clip = {id: 'b01', from: 'c1', to: 'c1', source: 'motion', mode: 'split', job: 'stress', template: 'keyword', plain: '打招呼', slots: {text: '你好世界'}};
const v2 = {version: 2, style: 'wood-blocks', provider: 'placeholder', quality: '768P', budgetYuan: 20, captions: 'add', clips: [clip]};
const where = (doc) => validateBroll(doc, ctx).errors.filter((e) => e.where === 'motionTheme').map((e) => e.problem);
check('不写 motionTheme：不报这个字段', where(v2).length === 0, where(v2).join(' | '));
check('v2 写 cutpaper-meadow：通过', where({...v2, motionTheme: 'cutpaper-meadow'}).length === 0);
check('v2 写了不认识的名字：报', where({...v2, motionTheme: 'neon'}).length === 1);
check('v2 写成对象：报（那是风格包的形状，不是这里）', where({...v2, motionTheme: {look: 'wood'}}).length === 1);
const v1 = {...v2, version: 1};
check('v1 不写 motionTheme：不报这个字段', where(v1).length === 0, where(v1).join(' | '));
const v1hit = where({...v1, motionTheme: 'cutpaper-dusk'});
check('v1 写了 motionTheme：要求改成 version 2', v1hit.length === 1 && v1hit[0].includes('version 2'), v1hit.join(' | '));
const unknown = validateBroll({...v2, extraField: 1}, ctx).errors.find((e) => e.where === 'extraField');
check('别的陌生字段仍会拦', Boolean(unknown));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'broll', 'schema', 'broll.schema.json'), 'utf8'));
check('schema 的枚举和外观名单一致', JSON.stringify(schema.properties.motionTheme.enum) === JSON.stringify(MOTION_LOOKS), JSON.stringify(schema.properties.motionTheme.enum));

// ---------- resolveMotionLook ----------
check('顶层名字盖过主风格', JSON.stringify(resolveMotionLook({motionTheme: 'cutpaper-dusk'}, {motionTheme: {look: 'wood', accent: '#FFB04A'}})) === JSON.stringify({look: 'cutpaper-dusk'}));
const fallback = resolveMotionLook({}, {motionTheme: {look: 'paper', accent: '#F28E6C', ink: 'bad'}});
check('不写时走主风格的对象', fallback.look === 'paper' && fallback.accent === '#F28E6C' && fallback.ink === undefined, JSON.stringify(fallback));
check('老的字符串主题名仍然不传', motionLookOf({motionTheme: 'studio-graphite'}) === undefined && resolveMotionLook({motionTheme: 'studio-graphite'}, {motionTheme: 'studio-graphite'}) === undefined);

// ---------- --motion-look ----------
const parsed = parseLlmArgs(['proj', '--motion-look', 'cutpaper-meadow']);
check('parseArgs 收下 --motion-look', parsed.flags['motion-look'] === 'cutpaper-meadow' && parsed.dir.endsWith('proj'));
check('不认识的参数仍报错', Boolean(parseLlmArgs(['proj', '--nope']).error));
const kept = forceTop({version: 1, style: 'x', provider: 'minimax-h3', quality: '2K', budgetYuan: 99, captions: 'add', clips: []}, {style: 'wood-blocks', budget: '20', captions: 'burned'});
check('不传 --motion-look：version 留在 1，字段顺序不变', kept.doc.version === 1 && Object.keys(kept.doc)[0] === 'version' && kept.doc.motionTheme === undefined && kept.doc.provider === 'placeholder');
const forced = forceTop({version: 1, style: 'x', provider: 'local', quality: '2K', budgetYuan: 1, captions: 'none', clips: [{id: 'b01'}]}, {style: 'wood-blocks', budget: '20', captions: 'add', motionLook: 'cutpaper-meadow'});
check('--motion-look 写进顶层并把 version 改成 2', forced.doc.version === 2 && forced.doc.motionTheme === 'cutpaper-meadow' && Object.keys(forced.doc)[0] === 'version' && forced.doc.clips.length === 1, JSON.stringify(forced.doc));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-look-'));
const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'broll', 'llm_broll.mjs'), dir, '--motion-look', 'neon'], {encoding: 'utf8', cwd: ROOT, windowsHide: true});
const out = `${run.stdout || ''}${run.stderr || ''}`;
check('--motion-look 写错时退出码 2，且不调模型', run.status === 2 && out.includes('--motion-look') && !out.includes('第 1 轮') && !out.includes('api.deepseek.com'), out.slice(0, 400));
fs.rmSync(dir, {recursive: true, force: true});
const talked = parseTalkArgs(['proj', '--out', 'out', '--motion-look', 'cutpaper-meadow', '--budget', '20']);
const lookAt = talked.llmArgs?.indexOf('--motion-look') ?? -1;
check(
  'talk.mjs 把 --motion-look 转给写方案，不进出片参数',
  !talked.error && lookAt >= 0 && talked.llmArgs[lookAt + 1] === 'cutpaper-meadow' && !talked.makeArgs.includes('--motion-look') && talked.llmArgs.includes('--budget'),
  JSON.stringify(talked.error ? {error: talked.error} : {llm: talked.llmArgs, make: talked.makeArgs}),
);
const bare = parseTalkArgs(['proj', '--out', 'out']);
check('talk.mjs 不传 --motion-look 时不写这个参数', !bare.error && !bare.llmArgs.includes('--motion-look') && !bare.makeArgs.includes('--motion-look'));

// ---------- 锚点卡分词断行 ----------
const seg = new Intl.Segmenter('zh', {granularity: 'word'});
const glueRe = /[\s，、；：。！？,;:.!?…·]/;
const visibleN = (s) => Array.from(s).filter((ch) => !glueRe.test(ch)).length;
const wordBounds = (text) => {
  const bounds = new Set([0]);
  let i = 0;
  let prev = '';
  for (const part of seg.segment(text)) {
    const token = part.segment;
    if (prev && Array.from(token).every((ch) => glueRe.test(ch))) {
      i += token.length;
      bounds.add(i);
      continue;
    }
    i += token.length;
    bounds.add(i);
    prev = token;
  }
  return bounds;
};
const assertBreak = (text, maxW, maxPx, minPx) => {
  const r = anchorLines(text, maxW, maxPx, minPx);
  check(`${text} 字还在`, r.lines.join('') === text, JSON.stringify(r));
  check(`${text} 字号 ≥ ${minPx}`, r.font >= minPx, JSON.stringify(r));
  if (r.lines.length > 1) {
    check(`${text} 没有单字行`, r.lines.every((l) => visibleN(l) >= 2), JSON.stringify(r.lines));
    const bounds = wordBounds(text);
    let acc = 0;
    let onBound = true;
    for (const line of r.lines) {
      acc += line.length;
      if (!bounds.has(acc)) onBound = false;
    }
    check(`${text} 断在词界`, onBound, JSON.stringify(r.lines));
    check(`${text} 行首不是标点`, r.lines.every((l) => !glueRe.test(Array.from(l)[0] || '')), JSON.stringify(r.lines));
  }
  return r;
};
const kw = assertBreak('哪几句适合配画面', 700, 168, 120);
check('哪几句适合配画面 不拆「适合」', kw.lines.join('/') === '哪几句适合/配画面', JSON.stringify(kw.lines));
const quote = assertBreak('花钱之前它先报价', 700, 168, 120);
check('花钱之前它先报价 两行等长', quote.lines.join('/') === '花钱之前/它先报价', JSON.stringify(quote.lines));
const nod = assertBreak('你点头了才生成', 700, 168, 120);
check('你点头了才生成 词没拆开', nod.lines.join('/') === '你点头了/才生成', JSON.stringify(nod.lines));
const punct = assertBreak('花钱之前，它先报价', 700, 168, 120);
check('逗号留在上一行', punct.lines.join('/') === '花钱之前，/它先报价', JSON.stringify(punct.lines));
const tight = assertBreak('哪几句适合配画面', 200, 168, 120);
check('放不下收到 120，仍不拆词', tight.font === 120 && tight.lines.join('/') === '哪几句适合/配画面', JSON.stringify(tight));
const one = assertBreak('哪几句适合配画面', 2000, 168, 120);
check('一行放得下就不拆', one.lines.length === 1 && one.font === 168, JSON.stringify(one));
const word = anchorLines('适合', 80, 168, 120);
check('一个词不拆成两行', word.lines.length === 1 && word.lines[0] === '适合' && word.font === 120, JSON.stringify(word));
const stage = fs.readFileSync(path.join(ROOT, 'template', 'src', 'talk', 'motion', 'cutpaper.tsx'), 'utf8');
check(
  '五个模板的锚点字都走 anchorLines',
  stage.includes("from './anchorLayout.ts'") &&
    !stage.includes('breakLines') &&
    ["'keyword'", "'checklist'", "'steps'", "'counter'", "'compare'"].every((name) => stage.includes(name)) &&
    (stage.match(/<Lines /g) || []).length >= 5,
);

if (failures.length) {
  console.error(`motion-kit: ${failures.length} 失败`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`motion-kit: ${passed} 通过`);
