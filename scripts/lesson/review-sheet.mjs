#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {validateLesson} from './validate-lesson.mjs';
import {assignFramesToPages, cardTexts, frameTimeMs, reviewHash, checkReview} from './review.mjs';

const args=process.argv.slice(2);
const val=(key)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
const lessonArg=args.find((x,i)=>!x.startsWith('--')&&args[i-1]!=='--out'&&args[i-1]!=='--frames');
const outArg=val('--out'), framesArg=val('--frames');
if(!lessonArg||!outArg){console.error('用法：node scripts/lesson/review-sheet.mjs <lesson.json> --out <dir> [--frames <check-dir>]');process.exit(2);}
const lessonPath=path.resolve(lessonArg),outDir=path.resolve(outArg);
if(!fs.existsSync(lessonPath)){console.error(`找不到 lesson 文件：${lessonPath}`);process.exit(2);}
let lesson;try{lesson=JSON.parse(fs.readFileSync(lessonPath,'utf8'));}catch(e){console.error(`lesson.json 解析失败：${e.message}`);process.exit(2);}
const esc=v=>String(v??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validation=validateLesson(lesson),approval=checkReview(lesson,lessonPath);
const framesDir=framesArg?path.resolve(framesArg):null;
const files=framesDir&&fs.existsSync(framesDir)?fs.readdirSync(framesDir).filter(f=>/\.(png|jpe?g|webp)$/iu.test(f)).sort():[];
const timelinePath=framesDir?[path.join(framesDir,'timeline.json'),path.join(framesDir,'..','timeline.json')].find(p=>fs.existsSync(p)):null;
let timelinePages=null, timelineNote='';
if(framesDir){
  if(!timelinePath) timelineNote='未找到 timeline.json，检查帧未按时间配到页上';
  else {
    try { timelinePages=JSON.parse(fs.readFileSync(timelinePath,'utf8')).pages??[]; }
    catch { timelineNote='timeline.json 无法解析，检查帧未按时间配到页上'; }
  }
}
const pages=(lesson.chapters??[]).flatMap((chapter,ci)=>(chapter.pages??[]).map((page,pi)=>({chapter,ci,page,pi})));
const assigned=timelinePages?assignFramesToPages(files,pages.map((_,index)=>({startMs:timelinePages[index]?.startMs,endMs:timelinePages[index]?.endMs}))):[];
const narrationCount=pages.reduce((n,x)=>n+(x.page.narration??[]).reduce((m,line)=>m+Array.from(line.text??'').length,0),0);
const estimatedSeconds=Math.round(narrationCount/240*60);
const reminderFor=(ci,pi,kind)=>[...(kind==='warn'?validation.warnings:validation.human)].filter(x=>x.includes(`chapters[${ci}].pages[${pi}]`)||!x.includes('chapters['));
const pageHtml=pages.map(({chapter,ci,page,pi},index)=>{
  const chosen=assigned[index]??null;
  const frame=chosen&&framesDir?path.join(framesDir,chosen):null;
  const atMs=chosen?frameTimeMs(chosen):null;
  const frameHtml=frame?`<img class="frame" data-page="${index+1}" data-time="${(atMs/1000).toFixed(2)}" src="data:${({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'})[path.extname(frame).toLowerCase()]};base64,${fs.readFileSync(frame).toString('base64')}" alt="第 ${index+1} 页检查帧 ${(atMs/1000).toFixed(2)} 秒">`:`<div class="no-frame">${esc(timelineNote||(framesDir?'这一页的时间范围内没有检查帧':'未提供检查帧'))}</div>`;
  const cards=cardTexts(page).map((t,i)=>`<p class="card">${i===0?'<b>卡片文字：</b>':''}${esc(t)}</p>`).join('');
  const lines=(page.narration??[]).map(n=>`<li>${esc(n.text)} <small>动作：${esc(n.pose??'explain')}${n.note?` · 便签：${esc(n.note)}`:''}</small></li>`).join('');
  const warn=reminderFor(ci,pi,'warn'),human=reminderFor(ci,pi,'human');
  const law=page.layout==='quote'?`<blockquote>${esc(page.quote)}</blockquote>`:'';
  const sourceList=Array.isArray(lesson.meta?.sources)?lesson.meta.sources:[];
  const dated=typeof page.source==='string'?sourceList.find((item)=>typeof item==='string'&&item.startsWith(page.source)&&item.length>page.source.length):undefined;
  const citation=dated??page.source??lesson.meta?.sources??[];
  return `<article class="page"><div class="visual">${frameHtml}</div><div class="copy"><p class="eyebrow">${ci+1}.${pi+1} · ${esc(chapter.title)} · ${esc(page.layout)}</p><h2>${esc(page.title)}</h2>${cards}${law}<h3>旁白</h3><ol>${lines}</ol><p><b>法条与出处：</b>${esc(typeof citation==='string'?citation:JSON.stringify(citation))}</p>${warn.length?`<aside class="warn"><b>规则 warn</b><ul>${warn.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></aside>`:''}${human.length?`<aside class="human"><b>人工复核</b><ul>${human.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></aside>`:''}</div></article>`;
}).join('');
const general=[...validation.errors.map(x=>`拦截：${x}`),...validation.warnings.map(x=>`提醒：${x}`),...validation.human.map(x=>`人工复核：${x}`)];
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(lesson.meta?.title)} · 课程审稿单</title><style>
:root{font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif;color:#192435;background:#f2f5f9}*{box-sizing:border-box}body{max-width:1180px;margin:24px auto;padding:0 18px}header,.page,.panel{background:#fff;border:1px solid #dce3ec;border-radius:16px;padding:22px;margin:16px 0;box-shadow:0 4px 18px #1c35500b}h1,h2,h3,p{margin-top:0}h1{font-size:clamp(24px,5vw,36px)}.facts{display:flex;gap:8px;flex-wrap:wrap}.pill{background:#eef3fa;border-radius:99px;padding:5px 12px}.status{font-weight:700;color:${approval.ok?'#11764d':'#9a5b08'}}.hash{font:13px/1.5 ui-monospace,monospace;overflow-wrap:anywhere}.page{display:grid;grid-template-columns:minmax(280px,1fr) minmax(0,1.15fr);gap:22px}.visual{min-width:0}.frame{width:100%;height:auto;border:1px solid #dce3ec;border-radius:10px;object-fit:contain;background:#eef1f5}.no-frame{min-height:180px;display:grid;place-items:center;background:#f3f6fa;border-radius:10px;color:#708096}.eyebrow,small{color:#65758a}.card{background:#f3f6fb;border-radius:8px;padding:10px;margin:8px 0}blockquote{border-left:4px solid #4783d1;margin:10px 0;padding:10px 16px;background:#f6f9ff;white-space:pre-wrap}.warn{background:#fff7e8;color:#754800;padding:10px 14px;border-radius:9px;margin:10px 0}.human{background:#fff0ec;color:#8a3820;padding:10px 14px;border-radius:9px;margin:10px 0}.sign p{border-bottom:1px solid #ccd5df;padding:8px 0}.muted{color:#66758a}@media(max-width:720px){body{padding:0 10px;margin:12px auto}.page{grid-template-columns:1fr;padding:15px;gap:14px}.frame{max-height:45vh;object-fit:contain}header,.panel{padding:16px}}
</style><header><h1>${esc(lesson.meta?.title)}</h1><div class="facts"><span class="pill">${esc(lesson.meta?.domain)}</span><span class="pill">${esc(lesson.meta?.lang)}</span><span class="pill">${pages.length} 页</span><span class="pill">旁白估时约 ${Math.floor(estimatedSeconds/60)}分${estimatedSeconds%60}秒</span><span class="pill">SHA-256：${reviewHash(lesson).slice(0,16)}…</span></div><p class="status">${approval.ok?(approval.test?'测试审稿（不能当作律师审稿）':'已通过'):'待审'}</p>${timelineNote?`<p class="warn">${esc(timelineNote)}</p>`:''}<p class="muted">逐页核对旁白、卡片文字、法条原文与出处。自动规则提示供复核参考。检查帧按时间轴配到对应页，不按文件序号。</p></header>${pageHtml}<section class="panel"><h2>领域规则提示</h2>${general.length?`<ul>${general.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>没有自动提示；仍需人工逐页审阅。</p>'}<h3>讲稿 SHA-256</h3><p class="hash">${reviewHash(lesson)}</p></section><section class="panel sign"><h2>审稿签署</h2><p>审稿人：________________　执业证号：________________</p><p>审稿日期：________________　结论：approved / rejected</p><p>确认通过后，在项目终端运行：</p><pre>node scripts/lesson/sign-review.mjs "${esc(lessonPath)}" --reviewer "姓名" --license "执业证号"</pre><p class="muted">脚本会把审稿记录写到与讲稿同名的 &lt;讲稿名&gt;.review.json。再次签署会把上一条放进 history，不覆盖。同目录旧的 review.json 只在哈希对得上时兼容读取。空、无、测试、none、- 这类执业证号不算律师审稿。内部样片用 --test，成片会固定打上「内部样片 · 未经律师审核」。</p></section></html>`;
fs.mkdirSync(outDir,{recursive:true});const output=path.join(outDir,'review.html');fs.writeFileSync(output,html,'utf8');
console.log(`审稿 HTML 已生成：${output}`);console.log(`讲稿 SHA-256：${reviewHash(lesson)}`);console.log(`估算时长：${estimatedSeconds} 秒；校验提示：拦截 ${validation.errors.length}，warn ${validation.warnings.length}，human ${validation.human.length}`);
