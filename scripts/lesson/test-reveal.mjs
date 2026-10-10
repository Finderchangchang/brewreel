#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildTimeline, layoutRegions, visibleTargets} from './timeline.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const lesson=(name)=>JSON.parse(fs.readFileSync(path.join(ROOT,'examples/lesson',name),'utf8'));
const gallery=lesson('layouts-gallery.json');
const legal=lesson('real-legal.json');
const tech=lesson('real-tech.json');

function timelineFor(input) {
  const pages=input.chapters.flatMap((chapter)=>chapter.pages);
  const audio=pages.map((page)=>({words:[],durMs:Math.max(3000,page.narration.reduce((n,s)=>n+Array.from(s.text).length*90,0)),src:'mock.wav'}));
  return buildTimeline(input,audio);
}

function assertSentenceTargets(input,name) {
  const timeline=timelineFor(input);
  let checked=0;
  for(const page of timeline.pages) {
    const targets=page.revealTargets;
    if(!targets.length) continue;
    for(const sentence of page.sentences) {
      if(!Number.isInteger(sentence.reveal)) continue;
      const frame=Math.ceil((sentence.revealAtMs+400)*timeline.fps/1000);
      const visible=visibleTargets(page,frame);
      for(let index=0;index<targets.length;index++) {
        const mapped=page.sentences.some((row)=>Number.isInteger(row.reveal)&&row.reveal>=index);
        if(!mapped) continue; // 未映射项按契约在片尾补齐
        if(index<=sentence.reveal) assert.equal(visible[index],true,`${name} / ${page.title} / 句 ${sentence.index+1}: reveal ${sentence.reveal} 后目标 ${index} 应可见`);
        else assert.equal(visible[index],false,`${name} / ${page.title} / 句 ${sentence.index+1}: reveal ${sentence.reveal} 时目标 ${index} 应隐藏`);
      }
      checked++;
    }
  }
  assert.ok(checked>0,`${name} 应至少覆盖一条旁白句`);
  console.log(`✓ ${name}：${checked} 句旁白的 reveal 目标通过`);
}

const regions=layoutRegions();
assert.equal(regions.title.height,0,'标题在版心之上，内容组不再留标题带');
assert.equal(regions.stage.x,120);
assert.equal(regions.stage.y,300);
assert.equal(regions.stage.width,1680);
assert.equal(regions.body.y,300);
assert.equal(regions.body.height,580);
assert.equal(regions.wide.x,120);
console.log('✓ 内容组在统一版心 x120–1800、y300–880，只避开右下角');

for(const [name,input] of [['real-legal.json',legal],['real-tech.json',tech],['layouts-gallery.json',gallery]]) assertSentenceTargets(input,name);

console.log('test-reveal：4/4 通过');
