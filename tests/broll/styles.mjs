#!/usr/bin/env node
// 多风格（风格包 + 共用角色 + 提示词 v2 + 风格规则 + H3 请求体 + 出图脚本 + 静帧容差）的单测。
// 几秒跑完：不联网、不花钱、不下载模型。只有静帧那组要用 ffmpeg，找不到就跳过并说明。
//   node tests/broll/styles.mjs
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkClip, DEFAULT_FREEZE_NOISE, freezeNoiseOf} from '../../scripts/broll/check-clip.mjs';
import {sha256Text, stableString} from '../../scripts/broll/hash.mjs';
import {ffmpeg} from '../../scripts/broll/media.mjs';
import {
  buildPrompt,
  buildPromptV2,
  clipRefs,
  expandRefPrompt,
  findLeaks,
  hashFieldsV2,
  lintStyle,
  loadCharacter,
  missingRefs,
  prevForContinue,
  readStyles,
  styleMenu,
  styleRefs,
  validateStyles,
} from '../../scripts/broll/prompt.mjs';
import {buildVideoBody, createH3Client, H3Error, redactBody} from '../../scripts/broll/providers/minimax-h3.mjs';
import {ROOT} from '../../scripts/broll/root.mjs';

const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name}：${detail}` : name);
};
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const count = (s, w) => s.split(w).length - 1;
const show = (r) => JSON.stringify(r, null, 1);

const styles = readStyles(ROOT);
const character = loadCharacter(ROOT);
// v0.9 发布的三种正式风格；ink-sketch 是 v0.9 新做的风格包，但参考图没出，降成实验风格
const FORMAL = ['wood-blocks', 'clay-stopmotion', 'paper-layers'];
const STABLE = [...FORMAL, 'ink-sketch'];
const EXPERIMENTAL = ['brick-diorama', 'ink-sketch'];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-styles-'));
const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const jpg1 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

// broll.json v2 的小工具：默认是合法的一段。
const base = (over = {}) => ({version: 2, style: 'wood-blocks', provider: 'placeholder', quality: '768P', budgetYuan: 20, captions: 'add', ...over});
const c = (id, over = {}) => ({id, from: 'c2', to: 'c2', mode: 'split', job: 'explain', plain: '演示', place: '桌面', subject: '机器人', action: '把方块排成一行', end: '方块排成一行', camera: 'static', ...over});
const run = (doc, opt = {}) => validateStyles(doc, opt.styles ?? styles, {character, ...opt});
const has = (r, where, ...needles) => r.errors.some((e) => e.where === where && needles.every((n) => `${e.problem} ${e.fix}`.includes(n)));

// ───────── 风格包和共用角色 ─────────
{
  const themes = readJson(path.join(ROOT, 'template', 'src', 'core', 'themes.json'));
  check('五个风格都在', [...STABLE, 'brick-diorama'].every((id) => styles[id]), Object.keys(styles).join(','));
  for (const id of Object.keys(styles)) {
    const problems = lintStyle(styles[id], id, {styles, character, themes});
    check(`风格包 ${id} 写得对`, problems.length === 0, problems.join('\n'));
  }
  const defaults = Object.keys(styles).filter((id) => styles[id].default === true);
  check('默认主风格只有 wood-blocks', defaults.length === 1 && defaults[0] === 'wood-blocks', defaults.join(','));
  check('wood-blocks 对外叫积木风', styles['wood-blocks'].name === '积木风');
  check('brick-diorama 是实验、非默认', styles['brick-diorama'].status === 'experimental' && styles['brick-diorama'].default === false);
  check('brick-diorama 说明会出凸点', String(styles['brick-diorama'].summary).includes('凸点') && String(styles['brick-diorama'].note).includes('凸点'));
  check('ink-sketch 是实验、非默认', styles['ink-sketch'].status === 'experimental' && styles['ink-sketch'].default === false && styles['ink-sketch'].name.includes('实验'));
  check('ink-sketch 说明参考图未出、只能占位预览', String(styles['ink-sketch'].summary).includes('参考图未出') && String(styles['ink-sketch'].summary).includes('只能占位预览') && String(styles['ink-sketch'].note).includes('天线'));
  check('正式风格正好三种', JSON.stringify(Object.keys(styles).filter((id) => styles[id].status !== 'experimental').sort()) === JSON.stringify([...FORMAL].sort()), Object.keys(styles).filter((id) => styles[id].status !== 'experimental').join(','));
  check('没有风格把实验风格当副风格', Object.values(styles).every((st) => !(st.pairsWith ?? []).some((p) => EXPERIMENTAL.includes(p))), Object.entries(styles).map(([id, st]) => `${id}:${(st.pairsWith ?? []).join('/')}`).join(' '));
  check('正式风格的参考图都在仓库里', FORMAL.every((id) => styleRefs(id, styles[id]).every((r) => r.exists)));
  check('ink-sketch 的参考图不在仓库里', styleRefs('ink-sketch', styles['ink-sketch']).every((r) => !r.exists));
  check('白底风格调低静帧容差', styles['paper-layers'].freezeNoise < DEFAULT_FREEZE_NOISE && styles['ink-sketch'].freezeNoise < DEFAULT_FREEZE_NOISE && styles['wood-blocks'].freezeNoise === DEFAULT_FREEZE_NOISE);
  check('新风格关掉提示词扩写', STABLE.every((id) => styles[id].promptExpansion === 'disabled'));
  check('纸艺不用 orbit', !styles['paper-layers'].cameras.includes('orbit'));
  check('黏土不做 quantify', !styles['clay-stopmotion'].jobs.includes('quantify'));
  check('新风格每个都是角色图 + 材质图两张', STABLE.every((id) => styles[id].refs.length === 2 && styles[id].refs[0].role === '角色' && styles[id].refs[1].role === '材质'));
  check('新风格目录有 refs/README.md', STABLE.every((id) => fs.existsSync(path.join(ROOT, 'broll', 'styles', id, 'refs', 'README.md'))));
  check('共用角色有中英文形状和色号', [character.name, character.shape, character.color, character.en?.shape, character.en?.color].every((s) => typeof s === 'string' && s.length > 0));
  check('共用角色色号', character.color.includes('#9FB1BC') && character.color.includes('#FFB04A'));
  check('共用角色规格没有泄漏词', findLeaks(JSON.stringify(character)).length === 0);
  for (const id of STABLE) {
    for (const ref of styles[id].refs) {
      const text = expandRefPrompt(ref, styles[id], character);
      check(`${id} ${ref.file} 出图提示展开了角色`, ref.role !== '角色' || (text.includes('#9FB1BC') && !text.includes('{character}')), text);
    }
  }
  // v1 老文件靠这五个字段算请求哈希，必须和 v0.8 一字不差。
  const git = spawnSync('git', ['show', '2369ae9:broll/styles/brick-diorama/style.json'], {cwd: ROOT, encoding: 'utf8'});
  if (git.status === 0) {
    const old = JSON.parse(git.stdout.replace(/^﻿/, ''));
    const now = styles['brick-diorama'];
    const same = ['look', 'negative', 'forbid', 'camera', 'references'].every((k) => stableString(old[k]) === stableString(now[k]));
    check('brick-diorama 的 v1 字段和 v0.8 一样', same);
    const clip = {place: '积木工作台', subject: '蓝色积木机器人', action: '从货架取下旧方块换上新方块', end: '货架变得整整齐齐', camera: 'slow-push'};
    check('v1 提示词和 v0.8 一样', buildPrompt({style: old, clip, genSec: 5}) === buildPrompt({style: now, clip, genSec: 5}));
  } else {
    console.log('（跳过：拿不到 v0.8 的 brick-diorama/style.json 做对照）');
  }
}

// ───────── 禁用词 ─────────
{
  const words = readJson(path.join(ROOT, 'broll', 'banned-words.json')).words;
  const list = words.map((w) => w.word);
  const need = ['阿德曼', 'Aardman', '华莱士', '小羊肖恩', 'Shaun', 'Pingu', '企鹅家族', 'Minecraft', '我的世界', '纪念碑谷', 'Monument Valley'];
  check('禁用词加了 IP 词', need.every((w) => list.includes(w)), need.filter((w) => !list.includes(w)).join('、'));
  check('禁用词没有重复', new Set(list).size === list.length);
  check('v0.8 的改法没动（老测试在查）', words.find((w) => w.word === '乐高小人')?.suggest === '积木小人' && words.find((w) => w.word === '凸点')?.suggest.includes('顶面光滑'));
  const materials = Object.values(styles).flatMap((st) => st.materialWords);
  const bad = words.filter((w) => {
    const s = w.suggestV2 ?? w.suggest;
    return materials.some((m) => s.includes(m)) || findLeaks(s).length > 0;
  });
  check('v2 的改法不带材质词和泄漏词', bad.length === 0, bad.map((w) => `${w.word}→${w.suggestV2 ?? w.suggest}`).join('、'));
}

// ───────── 提示词 v2 ─────────
{
  const b02 = {
    id: 'b02',
    from: 'c4',
    to: 'c5',
    mode: 'split',
    job: 'quantify',
    plain: '机器人先数方块再开工',
    place: '桌面',
    subject: '机器人',
    beats: [
      {action: '把几块小方块推到桌子中央', end: '小方块聚成一堆'},
      {action: '再逐块摆成整齐的方格', end: '方块排成完整方阵'},
    ],
    camera: 'top-down',
  };
  const doc = base({clips: [b02]});
  const r = buildPromptV2({doc, clip: b02, genSec: 7, styles, character});
  const p = r.prompt;
  const at = (s) => p.indexOf(s);
  check('v2 以图序指代开头', p.startsWith('图1是角色参考，图2是材质参考。'), p);
  check('v2 带风格 look', p.includes(styles['wood-blocks'].look));
  check('v2 带本风格材质的角色 + 共用形状和色号', p.includes(`${styles['wood-blocks'].character}：${character.shape}；${character.color}。全片只有这一个角色，造型保持不变。`), p);
  check('v2 带地面、地点、主体', p.includes(`${styles['wood-blocks'].ground}。地点：桌面。主体：机器人。`), p);
  check('v2 分拍按生成秒数切', p.includes('0–3.5 秒：把几块小方块推到桌子中央，结束画面：小方块聚成一堆；3.5–7 秒：再逐块摆成整齐的方格，结束画面：方块排成完整方阵。'), p);
  check('v2 运镜', p.includes('镜头从正上方俯拍。'));
  check('v2 以 forbid 结尾', p.endsWith(styles['wood-blocks'].forbid), p);
  check(
    'v2 顺序：图序 → look → 角色 → 地面 → 动作 → 运镜 → forbid',
    at('图1') < at(styles['wood-blocks'].look) && at(styles['wood-blocks'].look) < at(character.shape) && at(character.shape) < at('地点：') && at('地点：') < at('0–3.5') && at('0–3.5') < at('镜头从正上方俯拍') && at('镜头从正上方俯拍') < at(styles['wood-blocks'].forbid),
    p,
  );
  check('v2 没有泄漏词', r.leaked.length === 0 && findLeaks(p).length === 0, r.leaked.join('、'));
  check('v2 不写塑料、工作台、凸点', count(p, '塑料') === 0 && count(p, '工作台') === 0 && count(p, '凸点') === 0, p);
  check('v2 返回风格和 look', r.styleId === 'wood-blocks' && r.look === 'main' && r.link === 'new' && r.chars === Array.from(p).length);
  check('v2 不写 continue 的开场', !p.includes('开场画面'));

  // 每个正式风格、每种允许的运镜、单拍和多拍，都没有泄漏词
  let leaks = [];
  for (const id of STABLE) {
    const st = styles[id];
    for (const camera of st.cameras) {
      for (const clip of [c('b01', {camera, job: st.jobs[0]}), {...c('b01', {camera, job: st.jobs[0], action: undefined, end: undefined}), beats: b02.beats}]) {
        const out = buildPromptV2({doc: base({style: id, clips: [clip]}), clip, genSec: 5, styles, character});
        if (out.leaked.length || !out.prompt.includes(st.character) || !out.prompt.includes(st.camera[camera])) leaks.push(`${id}/${camera}: ${out.leaked.join(',')}`);
      }
    }
  }
  check('所有正式风格 × 运镜 × 单拍多拍都没有泄漏词', leaks.length === 0, leaks.join('\n'));

  // continue：开场接上一段的结尾（多拍取最后一拍）
  const first = {...c('b01'), action: undefined, end: undefined, beats: [{action: '把方块堆起来', end: '方块堆成一堆'}, {action: '退后一步', end: '机器人看着方块堆'}]};
  const second = c('b02', {link: 'continue', action: '把那堆方块搭成小桥', end: '小桥搭好'});
  const cdoc = base({clips: [first, second]});
  const prev = prevForContinue(cdoc, second);
  check('continue 找到上一段', prev === first);
  check('new 不找上一段', prevForContinue(cdoc, first) === null && prevForContinue(base({clips: [c('b01'), c('b02')]}), c('b02')) === null);
  const cp = buildPromptV2({doc: cdoc, clip: second, prev, genSec: 5, styles, character}).prompt;
  check('continue 写上一段最后一拍的结尾', cp.includes('开场画面接上一段的结尾：机器人看着方块堆。'), cp);
  check('continue 的开场在主体之后、动作之前', cp.indexOf('主体：') < cp.indexOf('开场画面') && cp.indexOf('开场画面') < cp.indexOf('动作：'), cp);

  // alt 段用副风格的 look 和参考图说明
  const adoc = base({styleAlt: 'paper-layers', clips: [c('b01'), c('b02', {look: 'alt', job: 'compare'})]});
  const ap = buildPromptV2({doc: adoc, clip: adoc.clips[1], genSec: 4, styles, character});
  check('alt 段用副风格', ap.styleId === 'paper-layers' && ap.prompt.includes(styles['paper-layers'].look) && !ap.prompt.includes(styles['wood-blocks'].look), ap.prompt);
  check('alt 段带纸艺的 forbid', ap.prompt.endsWith(styles['paper-layers'].forbid));

  // 实验风格在 v2 用 lookV2 / forbidV2，不带 v0.8 那几句反着写的话
  const bp = buildPromptV2({doc: base({style: 'brick-diorama', clips: [c('b01')]}), clip: c('b01'), genSec: 4, styles, character});
  check('brick-diorama 的 v2 用 lookV2', bp.prompt.startsWith('图1是角色和材质参考。') && bp.prompt.includes(styles['brick-diorama'].lookV2) && bp.leaked.length === 0, bp.prompt);

  let threw = '';
  try {
    buildPromptV2({doc, clip: b02, genSec: 7, styles, character: {}});
  } catch (e) {
    threw = e.message;
  }
  check('没有共用角色就报错', threw.includes('character.json'));
  check('泄漏词查英文不分大小写', findLeaks('Studless LEGO tiles').join(',') === 'stud,lego');
}

// ───────── 风格规则（v2 规则 1–13）─────────
{
  const ok = (name, doc, opt) => {
    const r = run(doc, opt);
    check(name, r.errors.length === 0, show(r.errors));
    return r;
  };
  const bad = (name, doc, where, needles, opt) => {
    const r = run(doc, opt);
    check(name, has(r, where, ...needles), show(r));
    check(`${name}（报错格式）`, r.errors.every((e) => typeof e.where === 'string' && e.problem && e.fix), show(r.errors));
    return r;
  };

  const a = ok('A 正确：主积木 + 副纸艺做对比', base({styleAlt: 'paper-layers', thread: '机器人把乱方块搭成一座桥', clips: [c('b01', {job: 'demonstrate'}), c('b02', {look: 'alt', job: 'compare', action: '左边摆乱的右边摆齐的', end: '两边并排'}), c('b03', {link: 'new', end: '方块搭成一座小桥'})]}));
  check('A 没有提醒', a.warnings.length === 0, show(a.warnings));
  ok('A2 正确：同风格接力', base({clips: [c('b01', {end: '方块堆成一堆'}), c('b02', {link: 'continue', action: '把那堆方块搭成小桥', end: '小桥搭好'})]}));
  ok('副风格切 2 次可以', base({styleAlt: 'paper-layers', clips: [c('b01'), c('b02', {look: 'alt'}), c('b03', {look: 'alt'}), c('b04')]}));
  bad('规则 1：段里写 style', base({styleAlt: 'paper-layers', clips: [c('b01'), c('b02', {style: 'clay-stopmotion'})]}), 'b02.style', ['段里不能写 style', '"look": "alt"']);
  bad('规则 2：alt 但没有 styleAlt', base({clips: [c('b01'), c('b02', {look: 'alt'})]}), 'b02.look', ['顶层没有 styleAlt', '"styleAlt"']);
  bad('规则 3：styleAlt 和 style 一样', base({styleAlt: 'wood-blocks', clips: [c('b01')]}), 'styleAlt', ['一样']);
  bad('规则 3：副风格不在 pairsWith', base({styleAlt: 'clay-stopmotion', clips: [c('b01'), c('b02', {look: 'alt', job: 'evoke'})]}), 'styleAlt', ['不搭配', 'paper-layers']);
  bad('规则 3：实验风格不能当副风格', base({styleAlt: 'brick-diorama', clips: [c('b01')]}), 'styleAlt', ['不搭配']);
  const inkAlt = bad('规则 3：手绘线稿（实验）不能当副风格', base({styleAlt: 'ink-sketch', clips: [c('b01'), c('b02', {look: 'alt', job: 'compare'})]}), 'styleAlt', ['不搭配']);
  check('规则 3：报错列的副风格里没有实验风格', inkAlt.errors.filter((e) => e.where === 'styleAlt').every((e) => !EXPERIMENTAL.some((x) => e.fix.includes(x))), show(inkAlt.errors));
  bad('规则 4：第一段用副风格', base({styleAlt: 'paper-layers', clips: [c('b01', {look: 'alt'}), c('b02')]}), 'b01.look', ['第一段', 'main']);
  bad('规则 5：副风格超过一半', base({styleAlt: 'paper-layers', clips: [c('b01'), c('b02', {look: 'alt'}), c('b03', {look: 'alt'}), c('b04', {look: 'alt'})]}), 'clips', ['超过一半']);
  bad('规则 6：来回切 3 次', base({styleAlt: 'paper-layers', clips: [c('b01'), c('b02', {look: 'alt'}), c('b03'), c('b04', {look: 'alt'})]}), 'clips', ['切了 3 次']);
  bad('规则 7：第一段写 continue', base({clips: [c('b01', {link: 'continue'})]}), 'b01.link', ['前面没有画面', 'new']);
  bad('规则 7：换风格还 continue', base({styleAlt: 'paper-layers', clips: [c('b01'), c('b02', {look: 'alt', link: 'continue'})]}), 'b02.link', ['接不上']);
  bad('规则 8：黏土做 quantify', base({styleAlt: 'clay-stopmotion', style: 'paper-layers', clips: [c('b01'), c('b02', {look: 'alt', job: 'quantify'})]}), 'b02.job', ['黏土定格不适合 quantify', 'counter']);
  bad('规则 8：纸艺用 orbit', base({style: 'paper-layers', clips: [c('b01', {camera: 'orbit'})]}), 'b01.camera', ['不用 orbit', 'pan-left']);
  bad('规则 8：AI 段写动效的 job', base({clips: [c('b01', {job: 'list'})]}), 'b01.job', ['动效画面的 job', 'source: motion']);
  bad('规则 9：place 照抄积木工作台', base({style: 'clay-stopmotion', clips: [c('b01', {job: 'demonstrate', place: '积木工作台'})]}), 'b01.place', ['积木', '只写地点']);
  bad('规则 9：subject 照抄浅蓝灰积木机器人', base({clips: [c('b01', {subject: '浅蓝灰积木机器人'})]}), 'b01.subject', ['积木', '只写「机器人」']);
  bad('规则 10：纸艺段动作写黏土', base({styleAlt: 'paper-layers', clips: [c('b01'), c('b02', {look: 'alt', action: '捏一团黏土'})]}), 'b02', ['分层纸艺', '黏土定格的「黏土」']);
  bad('规则 10：beats 里也查', base({style: 'paper-layers', clips: [{...c('b01', {action: undefined, end: undefined}), beats: [{action: '堆起木块', end: '木块堆好'}, {action: '推倒', end: '倒了'}]}]}), 'b01', ['积木风的「木块」']);
  bad('规则 11：subject 里没有机器人', base({clips: [c('b01', {subject: '小推车'})]}), 'b01.subject', ['机器人']);
  bad('subject 写了颜色', base({clips: [c('b01', {subject: '蓝色机器人'})]}), 'b01.subject', ['颜色']);
  bad('规则 12：主风格不存在', base({style: 'no-such', clips: [c('b01')]}), 'style', ['没有叫「no-such」', 'wood-blocks']);
  bad('规则 12：主风格没写', base({style: undefined, clips: [c('b01')]}), 'style', ['没写', 'wood-blocks']);
  bad('规则 12：副风格不存在', base({styleAlt: 'no-such', clips: [c('b01')]}), 'styleAlt', ['没有叫「no-such」']);
  const r13 = ok('规则 13：写了副风格没用只提醒', base({styleAlt: 'paper-layers', clips: [c('b01')]}));
  check('规则 13：提醒内容', r13.warnings.some((w) => w.where === 'styleAlt' && w.problem.includes('没有一段用它')), show(r13.warnings));
  bad('look 写错', base({clips: [c('b01', {look: 'side'})]}), 'b01.look', ['不在可选值里']);
  bad('link 写错', base({clips: [c('b01', {link: 'next'})]}), 'b01.link', ['不在可选值里']);
  bad('thread 太长', base({thread: '字'.repeat(21), clips: [c('b01')]}), 'thread', ['最多 20 字']);
  bad('提示词泄漏词来自段里的字', base({clips: [c('b01', {action: '把凸点抠掉', end: '桌面平了'})]}), 'b01', ['「凸点」', '删掉']);
  const dirty = {...styles, 'wood-blocks': {...styles['wood-blocks'], look: `${styles['wood-blocks'].look}像乐高一样。`}};
  bad('提示词泄漏词来自风格文件', base({clips: [c('b01')]}), 'b01', ['风格 wood-blocks 的描述里有「乐高」', '维护者'], {styles: dirty});

  // 实验风格只提醒
  const exp = ok('v2 用实验风格不拦截', base({style: 'brick-diorama', clips: [c('b01')]}));
  check('v2 用实验风格会提醒', exp.warnings.some((w) => w.where === 'style' && w.problem.includes('凸点') && w.fix.includes('wood-blocks')), show(exp.warnings));
  const inkMain = ok('v2 用手绘线稿（实验）当主风格不拦截', base({style: 'ink-sketch', clips: [c('b01')]}));
  check('手绘线稿的提醒说参考图未出，不说凸点', inkMain.warnings.some((w) => w.where === 'style' && w.problem.includes('实验风格') && w.problem.includes('参考图未出') && !w.problem.includes('凸点') && w.fix.includes('wood-blocks') && w.fix.includes('placeholder')), show(inkMain.warnings));

  // 动效段不归风格管
  const motion = {id: 'b01', from: 'c2', to: 'c2', source: 'motion', mode: 'split', job: 'list', template: 'checklist', plain: '两样东西', slots: {items: ['口播视频', '预算']}};
  ok('动效段不查风格规则', base({clips: [motion, c('b02', {from: 'c4', to: 'c4'})]}));
  bad('动效后第一段 AI 用副风格也算第一段', base({styleAlt: 'paper-layers', clips: [motion, c('b02', {look: 'alt'})]}), 'b02.look', ['第一段']);
  bad('接在动效段后面写 continue', base({clips: [c('b01'), {...motion, id: 'b02'}, c('b03', {link: 'continue'})]}), 'b03.link', ['动效画面', '接不上']);
  ok('只有动效段', base({clips: [motion]}));

  // v1 兼容
  const demo = readJson(path.join(ROOT, 'examples', 'talk', 'demo', 'broll.json'));
  const v1 = run(demo);
  check('v1 示例不报风格错', v1.errors.length === 0, show(v1.errors));
  check('v1 用 brick-diorama 提醒实验', v1.warnings.some((w) => w.where === 'style' && w.problem.includes('实验')), show(v1.warnings));
  const v1bad = run({...demo, styleAlt: 'ink-sketch', clips: [{...demo.clips[0], look: 'alt'}]});
  check('v1 写了 v2 字段要改 version', has(v1bad, 'styleAlt', 'version 2', '改成 2') && has(v1bad, 'b01.look', 'version 2'), show(v1bad));
  check('v1 不查材质词', !run(demo).errors.some((e) => e.where.endsWith('.place')));
  check('不是对象就不报', run(null).errors.length === 0 && run([]).errors.length === 0);
}

// ───────── 参考图、请求哈希、风格清单 ─────────
{
  const doc = base({styleAlt: 'paper-layers', clips: [c('b01'), c('b02', {look: 'alt', job: 'compare'})]});
  const fakeRoot = path.join(tmp, 'root');
  fs.mkdirSync(path.join(fakeRoot, 'broll'), {recursive: true});
  fs.cpSync(path.join(ROOT, 'broll', 'styles'), path.join(fakeRoot, 'broll', 'styles'), {recursive: true});
  // 真仓库里新风格的参考图可能还没出；用一个只有 brick-diorama 图的假仓库测缺图
  for (const id of STABLE) for (const ref of styles[id].refs) fs.rmSync(path.join(fakeRoot, 'broll', 'styles', id, ref.file), {force: true});
  const miss = missingRefs(doc, styles, {root: fakeRoot});
  check('缺参考图报两个风格', miss.length === 2 && miss.some((m) => m.where === 'style') && miss.some((m) => m.where === 'styleAlt'), show(miss));
  check(
    '缺参考图说清下一步',
    miss.every((m) => m.problem.includes('refs/character.jpg') && m.problem.includes('没有花钱') && m.fix.includes('make-style-refs.mjs --style') && m.fix.includes('--dry-run') && m.fix.includes('placeholder')),
    show(miss),
  );
  check('只有动效段不要参考图', missingRefs(base({clips: [{id: 'b01', source: 'motion'}]}), styles, {root: fakeRoot}).length === 0);
  check('v1 brick-diorama 的参考图在', missingRefs({version: 1, style: 'brick-diorama', clips: [c('b01')]}, styles).length === 0);

  for (const ref of styles['wood-blocks'].refs) {
    const abs = path.join(fakeRoot, 'broll', 'styles', 'wood-blocks', ref.file);
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    fs.writeFileSync(abs, ref.role === '角色' ? jpg1 : png1);
  }
  const woodOnly = base({clips: [c('b01')]});
  check('参考图齐了不报', missingRefs(woodOnly, styles, {root: fakeRoot}).length === 0);
  const refs = clipRefs({doc: woodOnly, clip: woodOnly.clips[0], styles, root: fakeRoot});
  check('每段参考图按图1角色、图2材质排', refs.length === 2 && refs[0].role === '角色' && refs[1].role === '材质' && refs.every((r) => r.exists && path.isAbsolute(r.abs)), show(refs));
  const altRefs = clipRefs({doc, clip: doc.clips[1], styles, root: fakeRoot});
  check('alt 段用副风格的参考图', altRefs.every((r) => r.abs.includes(`${path.sep}paper-layers${path.sep}`)) && altRefs.every((r) => !r.exists));
  const legacy = styleRefs('brick-diorama', styles['brick-diorama']);
  check('brick-diorama 的参考图是 ref-3.jpg', legacy.length === 1 && legacy[0].file === 'ref-3.jpg' && legacy[0].exists);

  const hf = hashFieldsV2({doc: woodOnly, clip: woodOnly.clips[0], styles, root: fakeRoot});
  check('哈希字段：风格、look、link、扩写模式', hf.styleId === 'wood-blocks' && hf.look === 'main' && hf.link === 'new' && hf.promptExpansion === 'disabled' && hf.prevEnd === null, show(hf));
  check('哈希字段：参考图 sha256', hf.referenceSha256.length === 2 && hf.referenceSha256.every((h) => /^[0-9a-f]{64}$/.test(h)), show(hf));
  const hfAlt = hashFieldsV2({doc, clip: doc.clips[1], styles, root: fakeRoot});
  check('哈希字段：缺的图记 missing', hfAlt.referenceSha256.every((h) => h.startsWith('missing:refs/')) && hfAlt.styleId === 'paper-layers', show(hfAlt));
  const cdoc = base({clips: [c('b01', {end: '方块堆成一堆'}), c('b02', {link: 'continue'})]});
  const hfc = hashFieldsV2({doc: cdoc, clip: cdoc.clips[1], prev: prevForContinue(cdoc, cdoc.clips[1]), styles, root: fakeRoot});
  check('哈希字段：continue 带上一段结尾', hfc.prevEnd === '方块堆成一堆' && hfc.link === 'continue');
  const h1 = sha256Text(stableString(hfc));
  const h2 = sha256Text(stableString(hashFieldsV2({doc: cdoc, clip: cdoc.clips[1], prev: {...cdoc.clips[0], end: '方块倒了'}, styles, root: fakeRoot})));
  check('上一段结尾变了哈希就变', h1 !== h2);
  check('brick-diorama 不带扩写模式', hashFieldsV2({doc: base({style: 'brick-diorama', clips: [c('b01')]}), clip: c('b01'), styles}).promptExpansion === null);

  const menu = styleMenu(styles, 'wood-blocks').join('\n');
  check('风格清单：主风格 + 能搭的副风格', menu.includes('积木风（wood-blocks）') && menu.includes('paper-layers') && !menu.includes('ink-sketch') && !menu.includes('brick-diorama') && !menu.includes('clay-stopmotion'), menu);
  const leaky = FORMAL.filter((id) => EXPERIMENTAL.some((x) => styleMenu(styles, id).join('\n').includes(x)));
  check('正式风格当主风格时，风格清单不推荐实验风格', leaky.length === 0, leaky.join(','));
  // 真仓库：正式风格的参考图齐了；手绘线稿（实验）用 minimax-h3 会在提交前停下，给出换风格的下一步
  const inkMiss = missingRefs(base({style: 'ink-sketch', provider: 'minimax-h3', clips: [c('b01')]}), styles);
  check('手绘线稿缺参考图：停下并说清下一步', inkMiss.length === 1 && inkMiss[0].where === 'style' && inkMiss[0].problem.includes('手绘线稿') && inkMiss[0].problem.includes('没有花钱') && FORMAL.every((id) => inkMiss[0].fix.includes(id)) && inkMiss[0].fix.includes('placeholder'), show(inkMiss));
  check('三种正式风格不缺参考图', FORMAL.every((id) => missingRefs(base({style: id, provider: 'minimax-h3', clips: [c('b01', {job: styles[id].jobs[0]})]}), styles).length === 0));
}

// ───────── H3 请求体 ─────────
{
  const r1 = path.join(tmp, 'character.jpg');
  const r2 = path.join(tmp, 'material.png');
  fs.writeFileSync(r1, jpg1);
  fs.writeFileSync(r2, png1);
  const args = {prompt: '图1是角色参考，图2是材质参考。机器人摆方块。', refs: [r1, r2], resolution: '768P', duration: 4, ratio: '9:16'};
  const body = buildVideoBody({...args, promptExpansion: 'disabled'});
  check('请求体：一段文字 + 两张参考图', body.content.length === 3 && body.content[0].type === 'text' && body.content.slice(1).every((x) => x.role === 'reference_image'));
  check('请求体：参考图按顺序', body.content[1].image_url.url.startsWith('data:image/jpeg;base64,') && body.content[2].image_url.url.startsWith('data:image/png;base64,'));
  check('请求体：不带 extra（H3 不收）', body.extra === undefined);
  const plain = buildVideoBody(args);
  check('请求体：不传扩写模式就和 v0.8 一样', !('extra' in plain) && Object.keys(plain).sort().join(',') === 'content,duration,model,ratio,resolution', Object.keys(plain).join(','));
  const fail = (fn) => {
    try {
      fn();
      return null;
    } catch (e) {
      return e;
    }
  };
  const e1 = fail(() => buildVideoBody({...args, promptExpansion: 'max'}));
  check('扩写模式写错就拦', e1 instanceof H3Error && e1.code === 'BAD_REQUEST' && e1.exitCode === 2 && e1.message.includes('disabled'));
  const e2 = fail(() => buildVideoBody({...args, refs: [r1, path.join(tmp, 'nope.jpg')], styleId: 'clay-stopmotion'}));
  check('参考图不在就拦，说清下一步', e2 instanceof H3Error && e2.code === 'NO_REFS' && e2.exitCode === 2 && e2.message.includes('nope.jpg') && e2.message.includes('make-style-refs.mjs --style clay-stopmotion') && e2.message.includes('没有花钱'), e2?.message);
  const e3 = fail(() => buildVideoBody({...args, refs: []}));
  check('没有参考图就拦', e3 instanceof H3Error && e3.code === 'NO_REFS');
  const e4 = fail(() => buildVideoBody({...args, refs: [r1, r1, r1, r2, r2, r2]}));
  check('超过 5 张参考图就拦', e4 instanceof H3Error && e4.code === 'BAD_REQUEST' && e4.message.includes('5 张'));
  const red = JSON.stringify(redactBody(body));
  check('打印请求体时不带图片原文', !red.includes(png1.toString('base64')) && red.includes('字节'));

  // submit：假 fetch，不联网
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({url, body: JSON.parse(init.body), auth: init.headers.Authorization});
    return {status: 200, text: async () => JSON.stringify({task_id: 'task-1', base_resp: {status_code: 0, status_msg: 'success'}})};
  };
  const client = createH3Client({env: {MINIMAX_API_KEY: 'test-key-123'}, baseUrl: 'http://127.0.0.1:9', fetchImpl});
  const taskId = await client.submit({...args, promptExpansion: 'disabled', styleId: 'wood-blocks'});
  check('submit 带每段参考图，不带 extra', taskId === 'task-1' && calls.length === 1 && calls[0].body.extra === undefined && calls[0].body.content.length === 3 && calls[0].url.endsWith('/v2/video_generation'), show(calls.map((x) => x.url)));
  const before = calls.length;
  const e5 = await client.submit({...args, refs: [path.join(tmp, 'nope.jpg')], styleId: 'wood-blocks'}).then(() => null, (e) => e);
  check('submit 缺图不发请求', e5?.code === 'NO_REFS' && calls.length === before);
  const e6 = await createH3Client({env: {}, baseUrl: 'http://127.0.0.1:9', fetchImpl}).submit({...args, refs: []}).then(() => null, (e) => e);
  check('没有密钥先报密钥', e6?.code === 'NO_KEY');
}

// ───────── 出图脚本（只跑不花钱的分支）─────────
{
  const script = path.join(ROOT, 'scripts', 'broll', 'make-style-refs.mjs');
  const env = {...process.env, MINIMAX_BASE_URL: 'http://127.0.0.1:9'};
  delete env.MINIMAX_API_KEY;
  const refsBefore = STABLE.map((id) => fs.readdirSync(path.join(ROOT, 'broll', 'styles', id, 'refs')).sort().join(','));
  const sh = (...a) => {
    const r = spawnSync(process.execPath, [script, ...a], {cwd: ROOT, env, encoding: 'utf8', timeout: 30_000});
    return {code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`};
  };
  const missingAll = STABLE.find((id) => styles[id].refs.every((r) => !fs.existsSync(path.join(ROOT, 'broll', 'styles', id, r.file))));
  let r = sh();
  check('出图：没写 --style 退出 2 并列出风格', r.code === 2 && r.out.includes('--style') && STABLE.every((id) => r.out.includes(id)), r.out);
  r = sh('--style', 'no-such');
  check('出图：风格不存在退出 2', r.code === 2 && r.out.includes('no-such'), r.out);
  r = sh('--style', 'wood-blocks', '--n', '9', '--dry-run');
  check('出图：--n 超范围退出 2', r.code === 2 && r.out.includes('--n'), r.out);
  r = sh('--style', 'brick-diorama');
  check('出图：图都在就不花钱', r.code === 0 && r.out.includes('没有新的花费'), r.out);
  if (missingAll) {
    r = sh('--style', missingAll, '--dry-run');
    check('出图 dry-run：打印请求、价格，不带图片原文', r.code === 0 && r.out.includes('image-01') && r.out.includes('/v1/image_generation') && r.out.includes('#9FB1BC') && r.out.includes('0.05 元') && !r.out.includes('base64,') && r.out.includes('没有发送'), r.out);
    r = sh('--style', missingAll, '--n', '2', '--dry-run');
    check('出图 dry-run：候选文件名和价格', r.code === 0 && r.out.includes('refs/character.cand-1.jpg') && r.out.includes('refs/material.cand-2.jpg') && r.out.includes('0.1 元'), r.out);
    r = sh('--style', missingAll, '--n', '3', '--dry-run');
    check('出图：一次超过 4 张退出 2', r.code === 2 && r.out.includes('最多 4 张'), r.out);
    r = sh('--style', missingAll, '--only', 'refs/material.jpg', '--dry-run');
    check('出图 dry-run：--only 只出一张', r.code === 0 && r.out.includes('[1/1] refs/material.jpg') && r.out.includes('0.025 元'), r.out);
    r = sh('--style', missingAll);
    check('出图：没加 --yes 退出 3，只报价', r.code === 3 && r.out.includes('--yes') && r.out.includes('0.05 元'), r.out);
  } else {
    console.log('（跳过：正式风格的参考图都已经出了，没有能 dry-run 的风格）');
  }
  const refsAfter = STABLE.map((id) => fs.readdirSync(path.join(ROOT, 'broll', 'styles', id, 'refs')).sort().join(','));
  check('出图测试没有往仓库写文件', refsBefore.join('|') === refsAfter.join('|'), `${refsBefore.join('|')} → ${refsAfter.join('|')}`);
}

// ───────── 静帧容差 ─────────
{
  check('静帧容差：风格写了就用', freezeNoiseOf(styles['ink-sketch']) === 0.0005 && freezeNoiseOf(styles['wood-blocks']) === 0.003);
  check('静帧容差：没写或写错用默认', [undefined, null, {}, {freezeNoise: 0}, {freezeNoise: 'x'}, {freezeNoise: 1}, {freezeNoise: -1}].every((s) => freezeNoiseOf(s) === DEFAULT_FREEZE_NOISE));
  const probe = ffmpeg(['-hide_banner', '-version']);
  if (probe.status !== 0) {
    console.log('（跳过静帧实测：找不到 ffmpeg）');
  } else {
    // 白底上一块小黑块慢慢移动：画面在动，但变化只占很小一块（线稿、纸艺的典型情况）
    const moving = path.join(tmp, 'white-moving.mp4');
    const still = path.join(tmp, 'white-still.mp4');
    const mk = (args, out) => ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', ...args, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', out]);
    const a = mk(['-f', 'lavfi', '-i', 'color=c=white:s=180x320:r=30:d=2', '-f', 'lavfi', '-i', 'color=c=black:s=14x20:r=30:d=2', '-filter_complex', "[0][1]overlay=x='20+t*10':y=20:shortest=1,format=yuv420p"], moving);
    const b = mk(['-f', 'lavfi', '-i', 'color=c=white:s=180x320:r=30:d=2'], still);
    if (a.status !== 0 || b.status !== 0) {
      console.log(`（跳过静帧实测：ffmpeg 造素材失败 ${String(a.stderr || b.stderr).slice(0, 200)}）`);
    } else {
      const opts = {frames: 60, width: 180, height: 320, preset: 'ultrafast'};
      const strict = checkClip({src: moving, dest: path.join(tmp, 'm1.mp4'), ...opts});
      const loose = checkClip({src: moving, dest: path.join(tmp, 'm2.mp4'), ...opts, freezeNoise: freezeNoiseOf(styles['ink-sketch'])});
      const stillLoose = checkClip({src: still, dest: path.join(tmp, 's1.mp4'), ...opts, freezeNoise: freezeNoiseOf(styles['ink-sketch'])});
      check('静帧：默认容差把白底上在动的画面误判成静帧', strict.meta.freeze > 0 && strict.meta.freezeNoise === DEFAULT_FREEZE_NOISE, JSON.stringify(strict.meta));
      check('静帧：线稿的容差不误判', loose.meta.freeze === 0 && loose.meta.freezeNoise === 0.0005, JSON.stringify(loose.meta));
      check('静帧：真的不动照样查出来', stillLoose.meta.freeze > 0, JSON.stringify(stillLoose.meta));
      let msg = '';
      try {
        checkClip({src: still, dest: path.join(tmp, 's2.mp4'), ...opts, freezeNoise: 2});
      } catch (e) {
        msg = e.message;
      }
      check('静帧：容差写错就报错', msg.includes('freezeNoise'));
    }
  }
}

fs.rmSync(tmp, {recursive: true, force: true});
if (failures.length) {
  console.log(`失败 ${failures.length}，通过 ${passed}`);
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
console.log(`风格测试全部通过 ${passed}`);
