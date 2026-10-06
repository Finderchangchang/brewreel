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
import {MOTION_LOOKS, motionLookOf, resolveMotionLook} from '../../scripts/broll/motion.mjs';
import {loadStyles, validateBroll} from '../../scripts/broll/validate.mjs';
import {LOOK_DEFAULTS} from '../../template/src/talk/motion/palette.ts';
import {anchorRelay} from '../../template/src/talk/motion/kit/anchorRelay.ts';
import {deltaE} from '../../template/src/talk/motion/kit/color.ts';
import {SHADOW_720, TILT_AVOID, TILT_AVOID_BAND, TILT_MAX, TILT_MIN, cutGeometry, restTiltFor, safeTilt, shadowColor, tiltFromSeed} from '../../template/src/talk/motion/kit/cutShape.ts';
import {settle} from '../../template/src/talk/motion/kit/settle.ts';
import {threeColor} from '../../template/src/talk/motion/kit/threeColor.ts';

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

if (failures.length) {
  console.error(`motion-kit: ${failures.length} 失败`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`motion-kit: ${passed} 通过`);
