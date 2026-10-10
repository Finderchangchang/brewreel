import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {validateLesson} from './validate-lesson.mjs';
import {CAST, FAMILIES, LEGACY_IDS, OUTFIT_FAMILY, PEEP_FILL, POSE_LOOK, POSES, PRESETS, mouthAnchor, resolveCartoonWardrobe, resolveLook, resolveMascotId} from '../../template/src/lesson/mascot/cast.mjs';
import {peepSvg as previewSvg} from './presenter-preview-render.mjs';
import {peepSvg as cardSvg} from './character-card.mjs';
import {blinkAt, mouthGeometry, mouthOpenAmount, talkingAt} from '../../template/src/lesson/mascot/motion.mjs';

const sample = JSON.parse(readFileSync(new URL('../../examples/lesson/sample-tech.json', import.meta.url), 'utf8'));
const errors = (lesson) => validateLesson(lesson).errors.join('\n');

for (const [id, cast] of Object.entries(CAST)) {
  const allowed = new Set(FAMILIES[cast.family]);
  for (const pose of POSES) {
    const look = POSE_LOOK[cast.family][pose];
    assert.ok(allowed.has(look.body), `${id} 的 ${pose} 用了族外身体 ${look.body}`);
    assert.ok(look.face === 'SmileNM' || look.face === 'CalmNM', `${id} ${pose} 的脸必须不带嘴`);
    assert.ok(['none', 'warn', 'think', 'check', 'cheer'].includes(look.icon), `${id} ${pose} 的图标不在约定里`);
  }
}

assert.equal(resolveMascotId('mentor'), 'peep-mentor');
assert.equal(resolveMascotId('default'), 'peep-mentor');
assert.equal(resolveMascotId('counsel'), 'peep-counsel');
assert.equal(resolveMascotId('buddy'), 'peep-teacher');
assert.equal(resolveMascotId('peep-teacher'), 'peep-teacher');
assert.equal(resolveMascotId(undefined), 'peep-mentor');
assert.equal(LEGACY_IDS.buddy, 'peep-teacher');
assert.equal(errors({...sample, meta: {...sample.meta, mascot: {id: 'mentor'}}}), '');
assert.equal(errors({...sample, meta: {...sample.meta, mascot: {id: 'peep-counsel', hair: 'Bun', outfit: 'tee'}}}), '');

const character = readFileSync(new URL('../../template/src/lesson/mascot/Character.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(character, /SweaterDots|PointingUp|ShirtFilled|ArmsCrossed|Whatever|ButtonShirt|Coffee|Geek/, '姿势到身体的映射不能写进组件');

const chars = [
  {text: '今', startMs: 0, endMs: 200},
  {text: '，', startMs: 200, endMs: 320},
  {text: '天', startMs: 400, endMs: 600},
];
const midFirst = mouthOpenAmount(chars, 100, 0, 2000);
const midSecond = mouthOpenAmount(chars, 500, 0, 2000);
assert.ok(midFirst >= 0.5, '字的中段要张开');
assert.ok(midSecond >= 0.5, '后一个字的中段要张开');
assert.notEqual(midFirst, midSecond, '不同的字幅度不同');
assert.equal(mouthOpenAmount(chars, 260, 0, 2000), 0, '标点闭嘴');
assert.equal(mouthOpenAmount(chars, 350, 0, 2000), 0, '两字之间的停顿闭嘴');
assert.equal(talkingAt(chars, 100), true);
assert.equal(talkingAt(chars, 260), false);

const voiced = [{text: '字', startMs: 0, endMs: 400}];
const raw = mouthOpenAmount(voiced, 300, 0, Infinity);
const closing = mouthOpenAmount(voiced, 300, 0, 400);
assert.ok(raw > 0.2 && closing > 0 && closing < raw, '句尾 120ms 内收口，但还没完全闭上');
assert.equal(mouthOpenAmount(voiced, 390, 0, 400), mouthOpenAmount(voiced, 390, 0, Infinity) * (10 / 120));

const shut = mouthGeometry(0);
const wide = mouthGeometry(1);
const narrow = mouthGeometry(0.1);
assert.equal(shut.open, false);
assert.equal(wide.open, true);
assert.equal(wide.width, 68);
assert.equal(wide.depth, 32);
assert.ok(narrow.width >= 52 && narrow.width <= 68);
assert.ok(narrow.depth >= 8 && narrow.depth <= 32);
assert.deepEqual(mouthAnchor('PointingUp'), {cx: 545, cy: 411});
assert.deepEqual(mouthAnchor('SweaterDots'), mouthAnchor('PointingUp'));

let blinkMs = -1;
for (let t = 0; t < 8000; t += 10) {
  if (blinkAt(t, 3, false) === 1) { blinkMs = t; break; }
}
assert.ok(blinkMs >= 3000 && blinkMs <= 5000, `第一次眨眼应落在 3–5 秒，实际 ${blinkMs}`);
assert.equal(blinkAt(blinkMs, 3, true), 0, '正在说话时不眨');
assert.equal(blinkAt(blinkMs + 140, 3, false), 0, '眨眼只持续 130ms');

const mascotDemo = JSON.parse(readFileSync(new URL('../../examples/lesson/mascot-demo.json', import.meta.url), 'utf8'));
assert.equal(validateLesson(mascotDemo).ok, true, validateLesson(mascotDemo).errors.join('\n'));

assert.equal(PRESETS.male.hair, 'ShortVolumed');
assert.equal(PRESETS.male.outfit, 'darkSweater');
assert.equal(PRESETS.female.hair, 'Bun');
assert.equal(PRESETS.female.accessory, 'GlassButterflyOutline');
assert.equal(PRESETS['peep-teacher'].outfit, 'whiteShirt');
assert.equal(OUTFIT_FAMILY.darkSweater, 'sweater');
assert.equal(OUTFIT_FAMILY.blackTee, 'tee');
assert.equal(OUTFIT_FAMILY.whiteShirt, 'shirt');

const femaleOnTech = resolveLook({preset: 'female', outfit: 'whiteShirt', hair: 'Mohawk', facialHair: 'Goatee'}, 'tech');
assert.equal(femaleOnTech.family, 'shirt');
assert.equal(femaleOnTech.hair, 'Mohawk');
assert.equal(femaleOnTech.facialHair, 'Goatee');
assert.equal(femaleOnTech.accessory, PRESETS.female.accessory, '没写的单项沿用预设');
for (const pose of POSES) assert.ok(FAMILIES[femaleOnTech.family].includes(POSE_LOOK[femaleOnTech.family][pose].body));

assert.equal(resolveCartoonWardrobe({domain: 'legal'}).preset, 'female');
assert.equal(resolveCartoonWardrobe({domain: 'tech'}).preset, 'male');
assert.equal(resolveCartoonWardrobe({domain: 'tech', mascot: {id: 'counsel'}}).preset, 'peep-counsel');
assert.equal(resolveCartoonWardrobe({domain: 'legal', mascot: {id: 'mentor', enabled: true}}).hair, 'ShortVolumed');
const mixed = resolveCartoonWardrobe({domain: 'legal', presenter: {kind: 'cartoon', look: {preset: 'male', outfit: 'blackTee', hair: 'Afro'}}});
assert.equal(mixed.hair, 'Afro');
assert.equal(resolveLook(mixed).family, 'tee');
assert.equal(resolveCartoonWardrobe({domain: 'tech', presenter: {kind: 'real'}}), null);
assert.equal(resolveCartoonWardrobe({domain: 'tech', presenter: {kind: 'video'}}), null);
assert.equal(resolveCartoonWardrobe({domain: 'tech', presenter: {kind: 'none'}}), null);
assert.equal(resolveCartoonWardrobe({domain: 'tech', mascot: {enabled: false}}), null);

const free = {kind: 'cartoon', look: {preset: 'female', outfit: 'darkSweater', hair: 'LongBangs', accessory: 'GlassAviator', facialHair: 'None', skin: '#E0B090'}};
assert.equal(errors({...sample, meta: {...sample.meta, presenter: free}}), '');
const badHair = errors({...sample, meta: {...sample.meta, presenter: {kind: 'cartoon', look: {hair: 'ponytail'}}}});
assert.match(badHair, /发型/);
assert.match(badHair, /ShortVolumed/);
assert.match(badHair, /Bun/);
const badOutfit = errors({...sample, meta: {...sample.meta, presenter: {kind: 'cartoon', look: {outfit: 'robe'}}}});
assert.match(badOutfit, /darkSweater/);
assert.match(badOutfit, /blackTee/);
assert.match(badOutfit, /whiteShirt/);
assert.match(errors({...sample, meta: {...sample.meta, presenter: {kind: 'cartoon', look: {preset: 'wizard'}}}}), /peep-mentor/);
assert.equal(errors({...sample, meta: {...sample.meta, presenter: {kind: 'none'}}}), '');

const require = createRequire(new URL('../../template/package.json', import.meta.url));
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {BustPose} = require(fileURLToPath(new URL('../../template/src/vendor/react-peeps/peeps/pose/bust/z_options.js', import.meta.url)));

function subpaths(d) {
  return String(d).split(/(?=[Mm])/).filter((part) => part.trim());
}
function bbox(d) {
  const nums = String(d).match(/-?\d*\.?\d+/g) || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]);
    const y = Number(nums[i + 1]);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return {w: maxX - minX, h: maxY - minY};
}
function blackPath(name) {
  const html = renderToStaticMarkup(React.createElement(BustPose[name], {strokeColor: '#111111', backgroundColor: '#FFFFFF'}));
  const tags = [...html.matchAll(/<path\b([^>]*)>/g)].map((match) => match[1]);
  const tag = tags.find((item) => item.includes('fill="#111111"'));
  assert.ok(tag, `${name} 没有渲出黑色毛衣路径`);
  const d = tag.match(/\bd="([^"]*)"/)[1];
  return subpaths(d);
}

const plainPairs = [
  ['SweaterDotsPlain', 'SweaterDots'],
  ['PointingUpPlain', 'PointingUp'],
  ['PaperPlain', 'Paper'],
];
for (const [plain, orig] of plainPairs) {
  const next = blackPath(plain);
  const prev = blackPath(orig);
  assert.equal(next[0], prev[0], `${plain} 的外轮廓应与 ${orig} 相同`);
  for (const part of next) assert.ok(prev.includes(part), `${plain} 出现了原件里没有的路径`);
  const pattern = next.slice(1).filter((part) => Math.min(bbox(part).w, bbox(part).h) < 80);
  assert.equal(pattern.length, 0, `${plain} 毛衣上还有白色花纹镂空`);
}
assert.equal(blackPath('SweaterDotsPlain').length, 1);
assert.equal(blackPath('PointingUpPlain').length, 1);
assert.equal(blackPath('PaperPlain').length, 5, '纸和两只手的镂空要留下');
assert.ok(blackPath('SweaterDots').length > 10, '原件白点还在，变体才是去掉花纹的那一版');

const dyed = {preset: 'male', outfit: 'whiteShirt', hair: 'ShortVolumed', accessory: 'None', facialHair: 'None', skin: '#D4A878'};
for (const svg of [previewSvg(dyed, 'explain'), cardSvg(dyed, 'explain', {ink: '#24211C', mouth: 0})]) {
  assert.equal(svg.toLowerCase().includes('#d4a878'), false, '渲染不应使用 skin');
  assert.equal(svg.toLowerCase().includes(PEEP_FILL.toLowerCase()), true);
}
assert.equal(resolveLook(dyed).skin, '#D4A878');
assert.doesNotMatch(character, /look\.skin/);
