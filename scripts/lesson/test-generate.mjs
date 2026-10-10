#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LLM_TIMEOUT_MS, resolveLlmEndpoint} from './llm-endpoint.mjs';
import {reviewHash} from './review.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'m5-generate-'));
const run=(args,env={})=>spawnSync(process.execPath,[path.join(ROOT,'scripts/lesson/generate-lesson.mjs'),...args],{cwd:ROOT,encoding:'utf8',env:{...process.env,...env},windowsHide:true});
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const fixture=(name)=>path.join(ROOT,'scripts/lesson/fixtures',name);
let passed=0;function test(name,fn){try{fn();passed++;console.log(`✓ ${name}`);}catch(e){console.error(`✗ ${name}: ${e.message}`);process.exitCode=1;}}

test('brief JSON 校验并返回中文错误',()=>{
  const bad=path.join(tmp,'bad-brief.json');fs.writeFileSync(bad,JSON.stringify({domain:'unknown',lang:'zh',title:'x',audience:'y',minutes:9,points:[]}));
  const r=run(['--brief',bad,'--out',path.join(tmp,'bad-out'),'--mock-llm',fixture('what-is-codex')]);assert.equal(r.status,2);assert.match(r.stderr,/brief 校验失败/u);assert.match(r.stderr,/domain 必须/u);assert.match(r.stderr,/minutes 必须/u);
});

test('mock 大纲、讲稿、lesson 组装并通过 validator',()=>{
  const out=path.join(tmp,'tech'),brief=path.join(ROOT,'examples/lesson/briefs/what-is-codex.json');
  const r=run(['--brief',brief,'--out',out,'--mock-llm',fixture('what-is-codex')],{DEEPSEEK_API_KEY:'FAKE_KEY_M5_ONLY'});assert.equal(r.status,0,r.stderr);
  const lesson=readJson(path.join(out,'lesson.json'));assert.equal(lesson.chapters[0].pages.length,6);assert.equal(lesson.chapters[0].pages[1].layout,'flow');assert.equal(lesson.chapters[0].pages[2].layout,'compare');
  assert.deepEqual(lesson.chapters[0].pages[2].narration.map((line)=>line.reveal),[0,1],'compare mock 必须对应左栏、右栏两个目标');
  const question=lesson.chapters[0].pages.find((page)=>page.layout==='question');assert.deepEqual(question.narration.map((line)=>line.reveal),[0,0,1],'question mock 必须按读题/思考/揭晓顺序使用 r0/r0/r1');assert.equal(question.narration[1].text,'先想一想。');
  assert.match(fs.readFileSync(path.join(ROOT,'scripts/lesson/prompts/script.txt'),'utf8'),/question 页固定顺序：r0 读题，接着单独一句“先想一想”也用 r0，之后 r1 揭晓并解释答案/u);
  const chars=lesson.chapters.flatMap(c=>c.pages).flatMap(p=>p.narration).reduce((n,x)=>n+Array.from(x.text).length,0);assert.ok(chars>=Math.round(3*240*.8)&&chars<=Math.round(3*240*1.2),`旁白字数 ${chars}`);
  assert.equal(lesson.meta.generatedBy, 'generate-lesson');
  assert.deepEqual(lesson.meta.tags, ['编程', '代码', 'Codex']);
  assert.equal(lesson.meta.theme, 'lecture');
  assert.deepEqual(lesson.meta.presenter, {kind:'cartoon', look:{preset:'male'}});
  const log=fs.readFileSync(path.join(out,'generate-log.txt'),'utf8');assert.ok(!log.includes('FAKE_KEY_M5_ONLY'));assert.match(log,/位于 ±20% 范围/u);assert.match(log,/风格 lecture/u);assert.ok(fs.existsSync(path.join(out,'outline.json'))&&fs.existsSync(path.join(out,'script.json')));
  const prompt = fs.readFileSync(path.join(ROOT,'scripts/lesson/generate-lesson.mjs'),'utf8');
  assert.match(prompt, /copyContractTable/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT,'scripts/lesson/prompts/script.txt'),'utf8'), /最多 14 字/);
});

test('校验错误原文回喂，最多修复两轮后通过',()=>{
  const d=path.join(tmp,'repair-fixtures');fs.mkdirSync(d);for(const f of ['outline.json','script.json'])fs.copyFileSync(path.join(fixture('what-is-codex'),f),path.join(d,f));
  const broken=readJson(path.join(d,'script.json'));delete broken.chapters[0].pages[0].fields.subtitle;fs.writeFileSync(path.join(d,'script.json'),JSON.stringify(broken));
  fs.copyFileSync(path.join(fixture('what-is-codex'),'script.json'),path.join(d,'repair-1.json'));
  const out=path.join(tmp,'repaired'),brief=path.join(ROOT,'examples/lesson/briefs/what-is-codex.json');const r=run(['--brief',brief,'--out',out,'--mock-llm',d]);assert.equal(r.status,0,r.stderr);
  assert.match(fs.readFileSync(path.join(out,'generate-log.txt'),'utf8'),/回喂 \d 条原始错误/u);
});

test('超出 ±20% 时请求模型改写时长并核对最终字数',()=>{
  const d=path.join(tmp,'duration-fixtures');fs.mkdirSync(d);for(const f of ['outline.json','script.json'])fs.copyFileSync(path.join(fixture('what-is-codex'),f),path.join(d,f));
  const short=readJson(path.join(d,'script.json'));for(const c of short.chapters)for(const p of c.pages)for(const line of p.narration)line.text='短稿';fs.writeFileSync(path.join(d,'script.json'),JSON.stringify(short));
  fs.copyFileSync(path.join(fixture('what-is-codex'),'script.json'),path.join(d,'duration-fix.json'));
  const out=path.join(tmp,'duration-fixed'),brief=path.join(ROOT,'examples/lesson/briefs/what-is-codex.json');const r=run(['--brief',brief,'--out',out,'--mock-llm',d]);assert.equal(r.status,0,r.stderr);
  const log=fs.readFileSync(path.join(out,'generate-log.txt'),'utf8');assert.match(log,/超出目标 .*请求模型删改/u);assert.match(log,/位于 ±20% 范围/u);
});

test('legal 法条由语料逐字回填，忽略模型字段 quote',()=>{
  const out=path.join(tmp,'legal'),brief=path.join(ROOT,'examples/lesson/briefs/iou-basics.json');const r=run(['--brief',brief,'--out',out,'--mock-llm',fixture('iou-basics')]);assert.equal(r.status,0,r.stderr);
  const lesson=readJson(path.join(out,'lesson.json')),quote=lesson.chapters.flatMap(c=>c.pages).find(p=>p.layout==='quote');
  assert.equal(quote.quote,'借款合同是借款人向贷款人借款，到期返还借款并支付利息的合同。');assert.match(quote.source,/第六百六十七条/u);
  assert.ok(Array.from(quote.source).length<=30,'画面出处只留法律全称和条号');
  assert.ok(lesson.meta.sources.some((item)=>typeof item==='string'&&item.includes('第六百六十七条')&&item.includes('2021-01-01')),'施行日期留在 meta.sources，供语料钩子核对');
  assert.equal(lesson.meta.theme, 'paper');
  assert.deepEqual(lesson.meta.presenter, {kind:'cartoon', look:{preset:'female'}});
  assert.equal(lesson.meta.generatedBy, 'generate-lesson');
  assert.equal(reviewHash(lesson).length,64);
});

test('legal 非语料条号无法注入模型自写法条原文',()=>{
  const d=path.join(tmp,'bad-law-fixtures');fs.mkdirSync(d);for(const f of ['outline.json','script.json'])fs.copyFileSync(path.join(fixture('iou-basics'),f),path.join(d,f));
  const outline=readJson(path.join(d,'outline.json'));outline.chapters[0].pages[2].articleNumber='999999';fs.writeFileSync(path.join(d,'outline.json'),JSON.stringify(outline));
  const script=readJson(path.join(d,'script.json'));script.chapters[0].pages[2].fields.quote='模型自写的不实法条';fs.writeFileSync(path.join(d,'script.json'),JSON.stringify(script));
  for(const n of [1,2])fs.copyFileSync(path.join(fixture('iou-basics'),'script.json'),path.join(d,`repair-${n}.json`));
  const out=path.join(tmp,'bad-law'),brief=path.join(ROOT,'examples/lesson/briefs/iou-basics.json');const r=run(['--brief',brief,'--out',out,'--mock-llm',d]);assert.equal(r.status,1);assert.match(r.stderr,/quote/u);assert.ok(fs.existsSync(path.join(out,'lesson.json')));assert.ok(!fs.readFileSync(path.join(out,'lesson.json'),'utf8').includes('模型自写的不实法条'));
});

test('legal 修复可调整条号，但最终原文仍由本地语料提供',()=>{
  const d=path.join(tmp,'law-repair-fixtures');fs.mkdirSync(d);for(const f of ['outline.json','script.json'])fs.copyFileSync(path.join(fixture('iou-basics'),f),path.join(d,f));
  const invalid=readJson(path.join(d,'outline.json'));invalid.chapters[0].pages[2].articleNumber='999999';fs.writeFileSync(path.join(d,'outline.json'),JSON.stringify(invalid));
  const fake=readJson(path.join(d,'script.json'));fake.chapters[0].pages[2].fields.quote='不可使用的模型法条';fs.writeFileSync(path.join(d,'script.json'),JSON.stringify(fake));
  const corrected=readJson(path.join(fixture('iou-basics'),'outline.json')),validScript=readJson(path.join(fixture('iou-basics'),'script.json'));
  fs.writeFileSync(path.join(d,'repair-1.json'),JSON.stringify({outline:corrected,script:validScript}));
  const out=path.join(tmp,'law-repaired'),brief=path.join(ROOT,'examples/lesson/briefs/iou-basics.json');const r=run(['--brief',brief,'--out',out,'--mock-llm',d]);assert.equal(r.status,0,r.stderr);
  const quote=readJson(path.join(out,'lesson.json')).chapters[0].pages[2].quote;assert.equal(quote,'借款合同是借款人向贷款人借款，到期返还借款并支付利息的合同。');assert.ok(!quote.includes('不可使用的模型法条'));
});

test('key 与接口地址成对，地址必须 https，请求有超时',()=>{
  const deepseek=resolveLlmEndpoint({env:{DEEPSEEK_API_KEY:'dk-deepseek-test'}});
  assert.equal(deepseek.base,'https://api.deepseek.com');
  assert.equal(deepseek.pair,'DEEPSEEK_API_KEY');
  assert.equal(deepseek.apiKey,'dk-deepseek-test');
  const paired=resolveLlmEndpoint({env:{DEEPSEEK_API_KEY:'dk-deepseek-test',LLM_API_KEY:'lk-custom-test',LLM_BASE_URL:'https://models.example.com/v1'}});
  assert.equal(paired.base,'https://models.example.com/v1');
  assert.equal(paired.apiKey,'lk-custom-test');
  assert.equal(paired.pair,'LLM_API_KEY');
  const deepseekExplicit=resolveLlmEndpoint({env:{DEEPSEEK_API_KEY:'dk-deepseek-test'},baseArg:'https://api.deepseek.com/'});
  assert.equal(deepseekExplicit.base,'https://api.deepseek.com');
  assert.equal(deepseekExplicit.apiKey,'dk-deepseek-test');
  assert.throws(()=>resolveLlmEndpoint({env:{DEEPSEEK_API_KEY:'dk-deepseek-test',LLM_BASE_URL:'https://models.example.com'}}),/LLM_API_KEY/);
  assert.throws(()=>resolveLlmEndpoint({env:{LLM_API_KEY:'lk-custom-test'}}),/LLM_BASE_URL/);
  assert.throws(()=>resolveLlmEndpoint({env:{LLM_API_KEY:'lk-custom-test',LLM_BASE_URL:'http://models.example.com'}}),/https/);
  assert.ok(LLM_TIMEOUT_MS>=120000&&LLM_TIMEOUT_MS<=180000);
});

function overStepsFixture(dir, repairs) {
  fs.mkdirSync(dir, {recursive:true});
  const outline = readJson(path.join(fixture('what-is-codex'), 'outline.json'));
  const script = readJson(path.join(fixture('what-is-codex'), 'script.json'));
  outline.chapters[0].pages[4].layout = 'steps';
  const longItems = ['甲乙丙丁戊己庚辛壬癸一二', '甲乙丙丁戊己庚辛壬癸三四', '甲乙丙丁戊己庚辛壬癸五六', '甲乙丙丁戊己庚辛壬癸七八'];
  script.chapters[0].pages[4].fields.items = longItems;
  fs.writeFileSync(path.join(dir, 'outline.json'), JSON.stringify(outline));
  fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(script));
  repairs.forEach((body, index) => fs.writeFileSync(path.join(dir, `repair-${index + 1}.json`), JSON.stringify(body)));
  return {outline, script, longItems};
}

test('超字数稿回喂，第二轮合格', () => {
  const dir = path.join(tmp, 'copy-repair');
  const {outline, script} = overStepsFixture(dir, []);
  const still = {outline, script};
  const fixedScript = readJson(path.join(fixture('what-is-codex'), 'script.json'));
  const fixedOutline = readJson(path.join(fixture('what-is-codex'), 'outline.json'));
  fs.writeFileSync(path.join(dir, 'repair-1.json'), JSON.stringify(still));
  fs.writeFileSync(path.join(dir, 'repair-2.json'), JSON.stringify({outline: fixedOutline, script: fixedScript}));
  const out = path.join(tmp, 'copy-repaired');
  const brief = path.join(ROOT, 'examples/lesson/briefs/what-is-codex.json');
  const r = run(['--brief', brief, '--out', out, '--mock-llm', dir]);
  assert.equal(r.status, 0, r.stderr);
  const log = fs.readFileSync(path.join(out, 'generate-log.txt'), 'utf8');
  assert.match(log, /第 1 轮校验未通过，回喂/u);
  assert.match(log, /第 2 轮校验未通过，回喂/u);
  assert.doesNotMatch(log, /拆页/);
  const lesson = readJson(path.join(out, 'lesson.json'));
  assert.equal(lesson.chapters[0].pages.length, 6);
  assert.equal(lesson.meta.generatedBy, 'generate-lesson');
  assert.ok(!JSON.stringify(lesson).includes('甲乙丙丁戊己庚辛壬癸一二'));
});

test('超字数两轮都修不好就按同一版式拆页', () => {
  const dir = path.join(tmp, 'copy-split');
  const {outline, script} = overStepsFixture(dir, []);
  const still = {outline, script};
  fs.writeFileSync(path.join(dir, 'repair-1.json'), JSON.stringify(still));
  fs.writeFileSync(path.join(dir, 'repair-2.json'), JSON.stringify(still));
  const out = path.join(tmp, 'copy-split-out');
  const brief = path.join(ROOT, 'examples/lesson/briefs/what-is-codex.json');
  const r = run(['--brief', brief, '--out', out, '--mock-llm', dir]);
  assert.equal(r.status, 0, r.stderr);
  const log = fs.readFileSync(path.join(out, 'generate-log.txt'), 'utf8');
  assert.match(log, /回喂/u);
  assert.match(log, /拆页/u);
  const lesson = readJson(path.join(out, 'lesson.json'));
  const pages = lesson.chapters[0].pages;
  assert.equal(pages.length, 7);
  const steps = pages.filter((page) => page.layout === 'steps');
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[0].items, ['甲乙丙丁戊己庚辛壬癸一二', '甲乙丙丁戊己庚辛壬癸三四']);
  assert.deepEqual(steps[1].items, ['甲乙丙丁戊己庚辛壬癸五六', '甲乙丙丁戊己庚辛壬癸七八']);
  assert.equal(steps[0].narration.length, 1);
  assert.equal(steps[1].narration.length, 1);
  assert.equal(steps[0].narration[0].reveal, 0);
  assert.equal(steps[1].narration[0].reveal, 0);
  assert.equal(lesson.meta.generatedBy, 'generate-lesson');
  assert.equal(lesson.meta.theme, 'lecture');
});

test('brief 的 presenter 原样写入 lesson.json', () => {
  const presenter = {kind: 'cartoon', look: {preset: 'female', outfit: 'whiteShirt', hair: 'Long', accessory: 'None', facialHair: 'None'}};
  const brief = {...readJson(path.join(ROOT, 'examples/lesson/briefs/what-is-codex.json')), presenter};
  const briefPath = path.join(tmp, 'presenter-brief.json');
  fs.writeFileSync(briefPath, JSON.stringify(brief));
  const out = path.join(tmp, 'presenter-copy');
  const r = run(['--brief', briefPath, '--out', out, '--mock-llm', fixture('what-is-codex')], {DEEPSEEK_API_KEY: 'FAKE_KEY_M5_ONLY'});
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readJson(path.join(out, 'lesson.json')).meta.presenter, presenter);
  const bad = path.join(tmp, 'bad-presenter.json');
  fs.writeFileSync(bad, JSON.stringify({...brief, presenter: {kind: 'cartoon', look: {hair: 'ponytail'}}}));
  const rejected = run(['--brief', bad, '--out', path.join(tmp, 'bad-presenter-out'), '--mock-llm', fixture('what-is-codex')]);
  assert.equal(rejected.status, 2);
  assert.match(rejected.stderr, /发型/);
  assert.match(rejected.stderr, /ShortVolumed/);
});

console.log(`test-generate：${passed}/11 通过`);
