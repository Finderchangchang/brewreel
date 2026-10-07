#!/usr/bin/env node
// 动效帧差检查的单测。像素在内存里造，不出片、不调 ffmpeg。
//   node tests/broll/motion-check.mjs
import {diffPair, formatLine, median, panelMask, scoreFrames} from '../../scripts/broll/motion-check.mjs';

const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name} — ${detail}` : name);
};

const W = 24;
const H = 16;
const blank = (fill = 0) => {
  const b = new Uint8Array(W * H);
  if (fill) b.fill(fill);
  return b;
};
const bar = (x0) => {
  const b = blank();
  for (let y = 4; y < 12; y++) {
    for (let k = 0; k < 4; k++) {
      const x = x0 + k;
      if (x >= 0 && x < W) b[y * W + x] = 220;
    }
  }
  return b;
};

const OPT = {
  sampleFps: 10,
  stillMean: 2,
  freezeWindowSec: 0.4,
  edgePadSec: 0.2,
  jumpRatio: 6,
  jumpRadius: 4,
  jumpEdgePairs: 2,
  jumpFloor: 15,
  pixelOn: 12,
  freezeLevel: 'fail',
  jumpLevel: 'fail',
};

const moving = (n, speed = 1) => {
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(bar(2 + ((i * speed) % 14)));
  return frames;
};

check('中位数', median([4, 1, 9]) === 4 && median([1, 9]) === 5 && median([]) === 0);

const a = bar(2);
const b = bar(3);
const d = diffPair(a, b, W, H, null, 12);
check('相邻帧差大于 0', d.mean > 1 && d.area > 0 && d.area < 0.5, JSON.stringify(d));
check('同一帧差是 0', diffPair(a, a, W, H, null, 12).mean === 0);

const live = scoreFrames(moving(24, 1), W, H, {...OPT, startSec: 3});
check('正常移动不报停死', live.level === 'ok' && !live.freezeHit && !live.jumpHit, JSON.stringify({level: live.level, quietest: live.quietest, maxRatio: live.maxRatio, freeze: live.freezeHit, jump: live.jumpHit}));

const frozen = moving(8, 1);
const hold = frozen[frozen.length - 1];
for (let i = 0; i < 16; i++) frozen.push(new Uint8Array(hold));
for (let i = 0; i < 8; i++) frozen.push(bar(2 + (i % 14)));
const dead = scoreFrames(frozen, W, H, {...OPT, startSec: 6.4});
check('中间冻住 1.6 秒判停死', dead.freezeHit && dead.level === 'fail' && dead.longestStillSec >= 1, JSON.stringify({level: dead.level, still: dead.longestStillSec, quietest: dead.quietest}));
check('停死那一行写明时间码和改法', /停死 ✗/.test(formatLine({...dead, id: 'b01', startSec: 6.4, endSec: 10, template: 'keyword'})) && formatLine({...dead, id: 'b01', startSec: 6.4, endSec: 10}).includes('主卡片'));

const flashed = moving(22, 1);
flashed[11] = blank(255);
const flash = scoreFrames(flashed, W, H, {...OPT, startSec: 2});
check('插一帧全白判闪', flash.jumpHit && flash.level === 'fail' && flash.maxRatio >= 6, JSON.stringify({level: flash.level, ratio: flash.maxRatio, mean: flash.maxRatioMean}));
check('闪那一行指向种子', /闪 ✗/.test(formatLine({...flash, id: 'b02', startSec: 2, endSec: 4.2})) && formatLine({...flash, id: 'b02', startSec: 2, endSec: 4.2}).includes('种子'));

const cut = moving(20, 1);
cut[0] = blank(255);
const edge = scoreFrames(cut, W, H, {...OPT, startSec: 0});
check('段首切换的大跳变不误报', !edge.jumpHit && edge.level === 'ok', JSON.stringify({level: edge.level, ratio: edge.maxRatio, jump: edge.jumpHit, freeze: edge.freezeHit}));

// 很安静但没冻死（最安静窗口在 stillHard 和 stillMean 之间）：只提醒，不拒收
const slow = moving(8, 1);
const base = slow[slow.length - 1];
for (let i = 0; i < 16; i++) {
  const f = new Uint8Array(base);
  f[i % 2] = 100;
  slow.push(f);
}
for (let i = 0; i < 8; i++) slow.push(bar(2 + (i % 14)));
const hush = scoreFrames(slow, W, H, {...OPT, startSec: 1});
check('很安静但没冻死只出 ⚠', hush.freezeHit && hush.level === 'warn' && hush.freezeLevel === 'warn' && hush.quietest >= 0.2, JSON.stringify({level: hush.level, quietest: hush.quietest}));
check('⚠ 那一行用 ⚠ 不用 ✗', /停死 ⚠/.test(formatLine({...hush, id: 'b03', startSec: 1, endSec: 4})));

const toss = moving(8, 1).concat(moving(8, 5)).concat(moving(8, 1));
const burst = scoreFrames(toss, W, H, {...OPT, startSec: 1});
check('连续加快的抛起不判闪', !burst.jumpHit, JSON.stringify({level: burst.level, ratio: burst.maxRatio, mean: burst.maxRatioMean, med: burst.maxRatioMedian}));

const pop = [];
for (let i = 0; i < 14; i++) pop.push(bar(3));
for (let i = 0; i < 10; i++) pop.push(bar(12));
const popped = scoreFrames(pop, W, H, {...OPT, startSec: 1});
check('卡片滑入后留在新位置，不判闪', !popped.jumpHit, JSON.stringify({jump: popped.jumpHit, ratio: popped.maxRatio, mean: popped.maxRatioMean}));

const quiet = moving(6, 1);
const held = quiet[quiet.length - 1];
for (let i = 0; i < 16; i++) quiet.push(new Uint8Array(held));
for (let i = 0; i < 6; i++) quiet.push(bar(2 + ((5 + i) % 14)));
const warned = scoreFrames(quiet, W, H, {...OPT, freezeLevel: 'warn', startSec: 6.4});
const warnedLine = formatLine({...warned, id: 'b03', startSec: 6.4, endSec: 10});
check('间距不够时停死只报警告', warned.freezeHit && !warned.jumpHit && warned.level === 'warn' && /停死 ⚠/.test(warnedLine) && !/停死 ✗/.test(warnedLine), warnedLine);

const mask = await panelMask(720, 1280, 'split', 270, 480);
check('split 面板只盖上半', mask.mask[5 * 270 + 5] === 1 && mask.mask[400 * 270 + 5] === 0, `top=${mask.mask[5 * 270 + 5]} bot=${mask.mask[400 * 270 + 5]} rect=${JSON.stringify(mask.rect)}`);
const pip = await panelMask(720, 1280, 'pip', 270, 480);
check('pip 左上是动效、圆窗中心挖掉', pip.mask[5 * 270 + 5] === 1 && pip.mask[417 * 270 + 207] === 0, `tl=${pip.mask[5 * 270 + 5]} face=${pip.mask[417 * 270 + 207]}`);

if (failures.length) {
  console.error(`motion-check: ${failures.length} 失败`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`motion-check: ${passed} 通过`);
