// ============================================================
// scripts/check-originality.mjs 和 scripts/lib/color.mjs 的回归用例。
//   node tests/originality/originality.test.mjs
// 夹具在 fixtures/：ref-tokens.json 是合成的「参考」色板（不是任何真实视频的实测值），
// style-copy / style-pair / style-ok 分别是照搬、只撞组合、重新设计过的风格令牌。
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseColor, rgbToLab, deltaE2000, deltaE, chroma} from '../../scripts/lib/color.mjs';
import {
  LIMITS,
  collectColors,
  collectColorsFromText,
  splitStyleTokens,
  isBackgroundKey,
  isOutlineKey,
  checkPalette,
  parseSignatures,
  checkSignatureRecords,
  suggestionPool,
  suggestColor,
} from '../../scripts/check-originality.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FX = (f) => path.join(HERE, 'fixtures', f);
const json = (f) => JSON.parse(fs.readFileSync(FX(f), 'utf8'));
const text = (f) => fs.readFileSync(FX(f), 'utf8');
const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

// ---------------- 颜色工具 ----------------

test('parseColor：只认整个值就是颜色的字符串', () => {
  assert.deepEqual(parseColor('#abc'), {r: 170, g: 187, b: 204, a: 1, hex: '#AABBCC'});
  assert.equal(parseColor('#2A2F36').hex, '#2A2F36');
  near(parseColor('#FFFFFF80').a, 128 / 255);
  assert.equal(parseColor('rgb(255, 0, 0)').hex, '#FF0000');
  near(parseColor('rgba(20,33,62,0.12)').a, 0.12);
  assert.equal(parseColor('0 20px 60px rgba(20,33,62,0.12)'), null, '阴影参数里的颜色不算');
  assert.equal(parseColor('品牌红 #C8553D'), null, '句子里的色值不算');
  assert.equal(parseColor('#12345'), null);
  assert.equal(parseColor(42), null);
});

test('sRGB → Lab：白、红与标准值一致', () => {
  const [L, a, b] = rgbToLab(255, 255, 255);
  near(L, 100, 1e-3);
  near(a, 0, 1e-3);
  near(b, 0, 1e-3);
  const red = rgbToLab(255, 0, 0);
  near(red[0], 53.2408, 1e-3);
  near(red[1], 80.0925, 1e-3);
  near(red[2], 67.2032, 1e-3);
});

test('CIEDE2000：Sharma 等（2005）标准色对，四位小数一致且对称', () => {
  const pairs = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [61, -5, 29], 22.8977],
    [[50, 2.5, 0], [56, -27, -3], 31.903],
    [[50, 2.5, 0], [58, 24, 15], 19.4535],
    [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
    [[36.4612, 47.858, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
    [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  for (const [a, b, e] of pairs) {
    near(deltaE2000(a, b), e);
    near(deltaE2000(b, a), e);
  }
  assert.equal(deltaE('#123456', '#123456'), 0);
  assert.ok(Number.isNaN(deltaE('#123456', 'nope')));
});

test('色度 C*：近黑近白灰 < 12，饱和色远高于 12', () => {
  assert.ok(chroma('#FFFFFF') < 1);
  assert.ok(chroma('#2A2F36') < LIMITS.chroma);
  assert.ok(chroma('#EFEBE0') < LIMITS.chroma);
  assert.ok(chroma('#C8412B') > 60);
});

// ---------------- 取色与键名 ----------------

test('collectColors：跳过 $ 开头的说明键、句子里的色值和半透明色', () => {
  const list = collectColors(json('ref-tokens.json'));
  const hexes = list.map((c) => c.hex);
  assert.ok(!hexes.includes('#C8412B') || list.find((c) => c.hex === '#C8412B').path === 'palette.primary.hex', 'meta 说明文字里的色值不算');
  assert.ok(!list.some((c) => c.path.startsWith('palette.shadow')), '阴影串不算');
  assert.ok(!list.some((c) => c.path.startsWith('palette.veil')), '不透明度 0.2 的遮罩不算');
  assert.equal(list.find((c) => c.path === 'palette.ink.hex').leaf, 'ink', '{hex: …} 包装取外层键名');
  assert.equal(list.find((c) => c.path === 'palette.props[0]').leaf, 'props');
});

test('collectColorsFromText：代码里的 key: "#RRGGBB" 带上键名', () => {
  const list = collectColorsFromText("export const INK = '#15384A';\nconst A = {fur: '#F5993A', x: 1};", 'palette.ts');
  assert.deepEqual(list.map((c) => [c.path, c.leaf, c.hex]), [
    ['palette.ts:1 INK', 'INK', '#15384A'],
    ['palette.ts:2 fur', 'fur', '#F5993A'],
  ]);
});

test('背景键 / 描边键的识别', () => {
  for (const k of ['bg', 'bgTop', 'bg_cream', 'sky', 'sky0', 'skyDay', 'skyTimeline', 'background']) assert.ok(isBackgroundKey(k), k);
  for (const k of ['skyline', 'skylineNight', 'tagSoftBg', 'card', 'paper', 'bgm']) assert.ok(!isBackgroundKey(k), k);
  for (const k of ['ink', 'outline', 'stroke', 'line', 'pillStroke', 'capStroke', 'char_outline']) assert.ok(isOutlineKey(k), k);
  for (const k of ['inkSoft', 'strike_line', 'lineHeight', 'text']) assert.ok(!isOutlineKey(k), k);
});

test('splitStyleTokens：themes 对象 / 顶层主题表 / 整份文件三种形状', () => {
  const a = splitStyleTokens(json('style-copy.json'));
  assert.deepEqual(a.themes.map((t) => t.name), ['copy']);
  assert.deepEqual(a.others.map((c) => c.path), ['scenes.shop.props[0]', 'scenes.shop.props[1]']);
  const b = splitStyleTokens({warm: {bgTop: ['#FFC877'], accent: '#3B82F6'}, cool: {bgTop: ['#12204A'], accent: '#4F8CFF'}});
  assert.deepEqual(b.themes.map((t) => t.name), ['warm', 'cool']);
  const c = splitStyleTokens({palette: ['#112233'], size: 3});
  assert.equal(c.themes.length, 1);
});

// ---------------- 判定 ----------------

test('照搬参考的风格：有彩色、背景、组合、描边、照搬五条全报', () => {
  const r = checkPalette(json('style-copy.json'), json('ref-tokens.json'));
  assert.equal(r.ok, false);
  const rules = new Set(r.failures.map((f) => f.rule));
  for (const rule of ['chromatic', 'background', 'pair', 'outline', 'copy']) assert.ok(rules.has(rule), `缺 ${rule}：${JSON.stringify(r.failures)}`);
  const prim = r.chromatic.find((x) => x.path === 'themes.copy.primary');
  assert.equal(prim.nearest.hex, '#C8412B');
  assert.ok(prim.dE < 1);
  assert.equal(r.outline[0].nearest.hex, '#232A33');
  // 道具色：#2E9C8F 照搬失败，#5B3FD0 离得远不报
  assert.ok(r.failures.some((f) => f.rule === 'copy' && f.msg.includes('#2E9C8F')));
  assert.ok(!r.failures.some((f) => f.msg.includes('#5B3FD0')));
  // 中性色原样照搬只提示
  assert.ok(r.warnings.some((w) => w.rule === 'neutral' && w.msg.includes('#EFEBE0')));
});

test('重新设计过的风格：全部通过', () => {
  const r = checkPalette(json('style-ok.json'), json('ref-tokens.json'));
  assert.deepEqual(r.failures, []);
  assert.equal(r.ok, true);
  assert.ok(r.chromatic.every((x) => x.dE >= LIMITS.chromatic));
  assert.ok(r.background.every((x) => x.dE >= LIMITS.background));
});

test('单色都 ≥ 20、但主色 + 强调色同时落在参考一组搭配的 25 以内：只报组合', () => {
  const r = checkPalette(json('style-pair.json'), json('ref-tokens.json'));
  assert.deepEqual([...new Set(r.failures.map((f) => f.rule))], ['pair']);
  const p = r.pairs[0];
  assert.equal(p.refPrimary, '#C8412B');
  assert.equal(p.refAccent, '#F2C12E');
  assert.ok(p.dePrimary < LIMITS.pair && p.deAccent < LIMITS.pair);
});

test('--strict：主题以外偏近的有彩色也算失败', () => {
  const style = {themes: {a: {bg: '#E4ECF4', ink: '#101418', primary: '#5B3FD0', highlight: '#7BD957'}}, props: ['#D96A1C']};
  const soft = checkPalette(style, json('ref-tokens.json'));
  assert.equal(soft.ok, true);
  assert.ok(soft.warnings.some((w) => w.rule === 'near'));
  const hard = checkPalette(style, json('ref-tokens.json'), {strict: true});
  assert.ok(hard.failures.some((f) => f.rule === 'near' && f.msg.includes('#D96A1C')));
});

test('缺强调色键时跳过组合检查并提示；$originality 可以指定键名', () => {
  const style = {themes: {a: {bg: '#E4ECF4', ink: '#101418', brand: '#E17300', sun: '#9B8732'}}};
  const r1 = checkPalette(style, json('ref-tokens.json'));
  assert.ok(r1.warnings.some((w) => w.rule === 'pair'));
  assert.equal(r1.pairs.length, 0);
  const r2 = checkPalette({...style, $originality: {accent: 'sun'}}, json('ref-tokens.json'));
  assert.ok(r2.failures.some((f) => f.rule === 'pair'), '指定 accent 后应当查出撞组合');
});

test('--suggest：给出的替代色真的能过线', () => {
  const ref = json('ref-tokens.json');
  const r = checkPalette(json('style-copy.json'), ref, {suggest: true});
  const refAll = collectColors(ref);
  const refChrom = refAll.filter((c) => c.C >= LIMITS.chroma);
  const refBg = refAll.filter((c) => isBackgroundKey(c.leaf));
  const passes = (hex) =>
    chroma(hex) >= LIMITS.chroma
      ? refChrom.every((c) => deltaE(hex, c.hex) >= LIMITS.chromatic)
      : refAll.every((c) => deltaE(hex, c.hex) >= LIMITS.background);
  for (const row of r.chromatic.filter((x) => !x.ok)) {
    assert.ok(row.suggest, `${row.path} 没给建议`);
    assert.ok(passes(row.suggest.hex), `${row.path} → ${row.suggest.hex}`);
  }
  for (const row of r.background.filter((x) => !x.ok)) {
    assert.ok(passes(row.suggest.hex));
    for (const c of refBg) assert.ok(deltaE(row.suggest.hex, c.hex) >= LIMITS.background);
  }
  // 直接调用：很鲜的红只能换成别的有彩色；可以退成中性色的只有本来就不鲜的颜色
  const pool = suggestionPool(refChrom, refBg, refAll);
  const s = suggestColor({lab: rgbToLab(200, 66, 44), C: 67}, pool);
  assert.ok(s && chroma(s.hex) >= LIMITS.chroma && s.fromOriginal >= LIMITS.chromatic);
  const ink = suggestColor({lab: rgbToLab(35, 42, 51), C: 6.9}, pool);
  assert.ok(ink && passes(ink.hex));
});

// ---------------- 招牌记录 ----------------

test('parseSignatures：只读招牌标题下的一级列表，没写编号的按位置编号', () => {
  const sigs = parseSignatures(text('signatures.md'));
  assert.deepEqual(sigs, [
    {id: 'S1', text: '标题右侧的方形强调块'},
    {id: 'S2', text: '角落里探头的小人'},
    {id: 'S3', text: '每条视频结尾都用的固定口号句式'},
  ]);
  // 没有招牌标题时读全部一级列表
  assert.equal(parseSignatures('- a\n- b\n  - c\n1. d').length, 3);
  assert.deepEqual(parseSignatures('- A2：手写编号').map((s) => s.id), ['A2']);
});

test('checkSignatureRecords：逐条要有「已替换为 + 内容」或「已删除」', () => {
  const sigs = parseSignatures(text('signatures.md'));
  const ok = checkSignatureRecords(sigs, text('originality-ok.md'));
  assert.ok(ok.every((s) => s.ok), JSON.stringify(ok));
  const bad = checkSignatureRecords(sigs, text('originality-missing.md'));
  assert.deepEqual(bad.map((s) => s.ok), [true, false, false]);
  assert.match(bad[1].problem, /没有 S2/);
  assert.match(bad[2].problem, /占位符/);
  // S1 不能被 S10 误匹配
  assert.equal(checkSignatureRecords([{id: 'S1', text: 'x'}], '| S10 | x | 已替换为：别的 |')[0].ok, false);
});

// ---------------- 命令行 ----------------

const cli = (args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-originality.mjs'), ...args], {encoding: 'utf8'});

test('命令行：照搬退出码 1，重新设计退出码 0，参数错退出码 2', () => {
  const base = ['--style', 'fixture', '--ref', FX('ref-tokens.json'), '--signatures', FX('signatures.md')];
  const bad = cli([...base, '--tokens', FX('style-copy.json'), '--record', FX('originality-missing.md')]);
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /结论：未通过/);
  assert.match(bad.stdout, /S2/);
  const good = cli([...base, '--tokens', FX('style-ok.json'), '--record', FX('originality-ok.md')]);
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /结论：通过/);
  const noRecord = cli([...base, '--tokens', FX('style-ok.json'), '--record', FX('does-not-exist.md')]);
  assert.equal(noRecord.status, 1);
  assert.equal(cli(['--style', 'fixture']).status, 2);
  assert.equal(cli([...base, '--tokens', FX('style-ok.json'), '--svg', path.join(ROOT, 'x.svg')]).status, 2, '色块图不许写进仓库');
});

test('命令行：--json 和 --svg（写到系统临时目录）', () => {
  const svg = path.join(os.tmpdir(), `originality-${process.pid}.svg`);
  const r = cli(['--style', 'fixture', '--ref', FX('ref-tokens.json'), '--tokens', FX('style-pair.json'), '--json', '--svg', svg]);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.equal(out.failures[0].rule, 'pair');
  assert.match(fs.readFileSync(svg, 'utf8'), /^<svg[\s\S]*#E17300[\s\S]*<\/svg>$/);
  fs.rmSync(svg, {force: true});
});
