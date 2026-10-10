#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveOutDir} from './paths.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2),val=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
const briefArg=val('--brief'),outSpecified=args.includes('--out'),outArg=val('--out'),mock=val('--mock-llm'),wantVertical=args.includes('--vertical'),wantCovers=args.includes('--covers');
if(!briefArg||(outSpecified&&(!outArg||outArg.startsWith('--')))){console.error('用法：node scripts/lesson/studio.mjs --brief <brief.json> [--out <dir>] [--model ...] [--base-url ...] [--mock-llm <fixture-dir>] [--voice-provider mock] [--vertical] [--covers]；不写 --out 时，成片放在当前工作目录上一级的 brewreel-studio-out。--vertical 和 --covers 默认都不开');process.exit(2);}
const briefPath=path.resolve(briefArg),outDir=resolveOutDir(outSpecified?outArg:undefined);if(!fs.existsSync(briefPath)){console.error(`找不到 brief 文件：${briefPath}`);process.exit(2);}
let brief;try{brief=JSON.parse(fs.readFileSync(briefPath,'utf8'));}catch(e){console.error(`brief JSON 解析失败：${e.message}`);process.exit(2);}
fs.mkdirSync(outDir,{recursive:true});
function run(script,argv){const r=spawnSync(process.execPath,[path.join(ROOT,script),...argv],{cwd:ROOT,stdio:'inherit',windowsHide:true});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);}
try{
  const genArgs=['--brief',briefPath,'--out',outDir];for(const flag of ['--model','--base-url'])if(val(flag))genArgs.push(flag,val(flag));if(mock)genArgs.push('--mock-llm',path.resolve(mock));
  run('scripts/lesson/generate-lesson.mjs',genArgs);
  const lessonPath=path.join(outDir,'lesson.json');run('scripts/lesson/validate-lesson.mjs',[lessonPath]);
  const reviewArgs=[lessonPath,'--out',outDir];if(val('--frames'))reviewArgs.push('--frames',path.resolve(val('--frames')));run('scripts/lesson/review-sheet.mjs',reviewArgs);
  if(brief.domain==='legal'){
    console.log('流程停在：待律师审。确认审稿通过后运行：');
    console.log(`node scripts/lesson/sign-review.mjs "${lessonPath}" --reviewer "姓名" --license "执业证号"`);
    console.log('审稿记录写到与讲稿同名的 .review.json；内部样片用 --test，不能代替律师审稿。');
    if(wantVertical||wantCovers){
      const flags=[wantVertical?'--vertical':'',wantCovers?'--covers':''].filter(Boolean).join(' ');
      console.log(`竖版和封面要加在签字之后的出片命令上：node scripts/lesson/make-lesson.mjs "${lessonPath}" --out "<目录>" ${flags}`);
    }
    process.exit(0);
  }
  const videoOut=path.join(outDir,'video');const makeArgs=[lessonPath,'--out',videoOut];if(val('--voice-provider'))makeArgs.push('--voice-provider',val('--voice-provider'));else if(mock)makeArgs.push('--voice-provider','mock');
  if(wantVertical)makeArgs.push('--vertical');
  if(wantCovers)makeArgs.push('--covers');
  run('scripts/lesson/make-lesson.mjs',makeArgs);
}catch(e){console.error(`studio 执行失败：${e.message}`);process.exit(1);}
