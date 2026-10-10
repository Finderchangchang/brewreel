#!/usr/bin/env node
// 免责小字挂在哪些镜头上。beauty 的 hook（消息卡）第 1 秒要有；纯文字 hook 没有。
//   node tests/broll/demo-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {importTs} from './quiet-ts.mjs';

const {demoOpacity, isDemoShot} = await importTs('../../template/src/core/demo-shots.ts', import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));

const slotsOf = (shots) => {
  let t = 0;
  return shots.map((shot) => {
    const start = t;
    t += Number(shot.dur) || 0;
    return {start, end: t, shot};
  });
};

const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name}：${detail}` : name);
};

const beauty = readJson(path.join(root, 'examples/beauty.json'));
const beautySlots = slotsOf(beauty.shots);
check('beauty hook 是演示镜头', isDemoShot(beauty.shots[0], beauty.shots));
check('beauty hook 第 1 秒免责小字不透明度为 1', demoOpacity(1, beautySlots) === 1, `实际 ${demoOpacity(1, beautySlots)}`);

const edu = readJson(path.join(root, 'examples/education.json'));
const eduSlots = slotsOf(edu.shots);
check('education 纯文字 hook 不是演示镜头', isDemoShot(edu.shots[0], edu.shots) === false);
check('education 纯文字 hook 第 1 秒没有免责小字', demoOpacity(1, eduSlots) === 0, `实际 ${demoOpacity(1, eduSlots)}`);

const shotsOf = (...shots) => shots;
const hook = (visual, extra = {}) => ({type: 'hook', params: {visual, ...extra}});
const withChat = (shot) => [shot, {type: 'chat', params: {}}];

check('bubble 算演示', isDemoShot(hook('bubble', {text: '甲面薄'}), []));
check('没写 visual 落到消息卡，算演示', isDemoShot({type: 'hook', params: {text: '你好'}}, []));
check('phone 算演示', isDemoShot(hook('phone', {src: 'a.png'}), []));
check('stat 有数字算演示', isDemoShot(hook('stat', {text: '¥ 0.00'}), []));
check('stat 纯文字不算', isDemoShot(hook('stat', {text: '会不会伤甲'}), withChat(hook('stat', {text: '会不会伤甲'}))) === false);
check('statBar 没数字也算演示', isDemoShot(hook('statBar', {text: '更快'}), []));
check('icon 不算', isDemoShot(hook('icon', {text: '改到第9版还没定', icon: 'doc'}), withChat(hook('icon'))) === false);
check('illust 不算', isDemoShot(hook('illust', {illust: 'travel/window-view', text: '推开窗'}), []) === false);
check('split 不算', isDemoShot(hook('split', {text: '扣上就不掉', leftText: '会掉'}), []) === false);

const textThenChat = withChat(hook('icon', {icon: 'doc', text: '只有一句'}));
const textSlots = [
  {start: 0, end: 2.5, shot: textThenChat[0]},
  {start: 2.5, end: 6, shot: textThenChat[1]},
];
check('旁边有演示镜头时，纯文字 hook 第 1 秒不透明度是 0', demoOpacity(1, textSlots) === 0, `实际 ${demoOpacity(1, textSlots)}`);

check('meter 算演示', isDemoShot({type: 'meter', params: {value: 7}}, []));
check('counter 算演示', isDemoShot({type: 'counter', params: {to: 100}}, []));
check('commentCta 算演示', isDemoShot({type: 'commentCta', params: {}}, []));
check('quickList quote 算演示', isDemoShot({type: 'quickList', params: {quote: true, items: [{text: '随便'}]}}, []));
check('quickList 打分算演示', isDemoShot({type: 'quickList', params: {items: [{text: '甲', score: 8}]}}, []));
check('quickList 图标清单不算', isDemoShot({type: 'quickList', params: {items: [{text: '基础修甲', tag: '含'}]}}, []) === false);
check('compare 有 stat 算演示', isDemoShot({type: 'compare', params: {left: {stat: '2/9', items: []}, right: {items: []}}}, []));
check('compare 纯文字不算', isDemoShot({type: 'compare', params: {left: {title: '旧', items: ['松']}, right: {title: '新', items: ['紧']}}}, []) === false);
check('beforeAfter 镜头不算', isDemoShot({type: 'beforeAfter', params: {}}, []) === false);
check('endCard 不算', isDemoShot({type: 'endCard', params: {brand: '甲'}}, []) === false);
check('finale 票面数字不算', isDemoShot({type: 'finale', params: {stats: [{value: '1200', unit: '期'}]}}, []) === false);
check('district scene=phone 仍算', isDemoShot({type: 'district', params: {scene: 'phone'}}, []));
check('quiz scene=office 不算', isDemoShot({type: 'quiz', params: {scene: 'office'}}, [{type: 'quiz', params: {scene: 'office'}}]) === false);
check('custom 一律算演示镜头', isDemoShot({type: 'custom', component: 'shots/keyword-toss.tsx', slots: {keyword: '少一步'}}, []));

const onlyText = [{type: 'hook', params: {visual: 'icon', text: '只有字'}}];
check('全片没有演示镜头时纯文字 hook 仍全片显示', demoOpacity(1, [{start: 0, end: 3, shot: onlyText[0]}]) === 1);

if (failures.length) {
  console.error(`失败 ${failures.length} / 通过 ${passed}`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log(`通过 ${passed}`);
