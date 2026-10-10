#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateLesson, LAYOUTS, generatedChapterSubtitleErrors, presenterLookErrors} from './validate-lesson.mjs';
import {copyContractTable, LESSON_GENERATED_BY, resolveLessonTheme, splitCopyOverflow} from './style-rules.mjs';
import {defaultPreset} from '../../template/src/lesson/mascot/cast.mjs';
import {resolveLlmEndpoint} from './llm-endpoint.mjs';
import {internalLeaks, repetition, thinBrief} from './text-quality.mjs';
import {readJsonResource} from './read-json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROMPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prompts');
const promptText = (name) => fs.readFileSync(path.join(PROMPTS,`${name}.txt`),'utf8');
const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
const briefPath = value('--brief'), outArg = value('--out'), fixtureArg = value('--mock-llm');
const model = value('--model') ?? 'deepseek-flash';
const baseArg = value('--base-url');
const fail = (message, code = 2) => { console.error(message); process.exit(code); };
if (!briefPath || !outArg) fail('用法：node scripts/lesson/generate-lesson.mjs --brief <brief.json> --out <dir> [--model deepseek-flash] [--base-url ...] [--mock-llm <fixture-dir>]');
const briefFile = path.resolve(briefPath), outDir = path.resolve(outArg);
if (!fs.existsSync(briefFile)) fail(`找不到 brief 文件：${briefFile}`);
let brief;
try { brief = JSON.parse(fs.readFileSync(briefFile, 'utf8').replace(/^\uFEFF/u, '')); }
catch (e) { fail(`brief JSON 解析失败：${e.message}`); }
function validateBrief(b) {
  const errors = [];
  if (!b || typeof b !== 'object' || Array.isArray(b)) return ['根节点必须是对象'];
  if (!['tech','legal'].includes(b.domain)) errors.push('domain 必须是 tech 或 legal');
  if (!['zh','en'].includes(b.lang)) errors.push('lang 必须是 zh 或 en');
  for (const k of ['title','audience']) if (typeof b[k] !== 'string' || !b[k].trim()) errors.push(`${k} 必须是非空字符串`);
  if (!Number.isInteger(b.minutes) || b.minutes < 1 || b.minutes > 8) errors.push('minutes 必须是 1–8 的整数');
  if (!Array.isArray(b.points) || !b.points.length || b.points.some(x => typeof x !== 'string' || !x.trim())) errors.push('points 必须是至少一条非空字符串组成的数组');
  for (const k of ['sources','facts']) if (b[k] !== undefined && (!Array.isArray(b[k]) || b[k].some(x => typeof x !== 'string' && (!x || typeof x !== 'object')))) errors.push(`${k} 必须是数组`);
  if (b.mascot !== undefined && (!b.mascot || typeof b.mascot !== 'object' || Array.isArray(b.mascot))) errors.push('mascot 必须是对象');
  if (b.presenter !== undefined) {
    errors.push(...presenterLookErrors(b.presenter, 'presenter'));
    if (b.presenter && typeof b.presenter === 'object' && (b.presenter.kind === 'real' || b.presenter.kind === 'video') && (typeof b.presenter.src !== 'string' || !b.presenter.src.trim())) errors.push('presenter：简报里的真人讲解员需要本地 MP4。只选形象请用 kind cartoon');
  }
  return errors;
}
const briefErrors = validateBrief(brief);
if (briefErrors.length) fail(`brief 校验失败：\n${briefErrors.map(x => `- ${x}`).join('\n')}`);
fs.mkdirSync(outDir, {recursive:true});
const logLines = [];
const fixtureIndex = new Map();
const log = (line) => { logLines.push(line); fs.writeFileSync(path.join(outDir,'generate-log.txt'), `${logLines.join('\n')}\n`, 'utf8'); };
const specsDir = path.join(ROOT,'template/src/lesson/layouts');
const specs = Object.fromEntries([...LAYOUTS].map(name => [name, readJsonResource(path.join(specsDir,`${name}.spec.json`))]));
const poseNames = ['explain','point','check','warn','think','affirm','cheer','wave'];
function readCorpus() {
  const dir = path.join(ROOT,'scripts/lesson/packs/legal/corpus');
  const rows=[];
  for (const file of fs.readdirSync(dir).filter(x => x.endsWith('.txt') && x !== 'README.txt')) {
    const source=fs.readFileSync(path.join(dir,file),'utf8');
    const heads=[...source.matchAll(/《中华人民共和国民法典》第([〇零一二三四五六七八九十百千\d]+)条（自(\d{4}-\d{2}-\d{2})起施行）/gu)];
    heads.forEach((h,i)=>{const begin=h.index+h[0].length, end=heads[i+1]?.index ?? source.length; rows.push({number:h[1],effective:h[2],body:source.slice(begin,end).trim(),law:'《中华人民共和国民法典》'});});
  }
  return rows;
}
const corpus=brief.domain==='legal'?readCorpus():[];
const articleByNumber=new Map(corpus.map(a=>[a.number,a]));
const rules = readJsonResource(path.join(ROOT,`scripts/lesson/packs/${brief.domain}/rules.json`));
const layoutPrompt=JSON.stringify(Object.fromEntries(Object.entries(specs).map(([name,s])=>[name,{fields:s.fields,revealTargets:s.revealTargets??[],...(s.copy?{copy:s.copy}:{})}])),null,2);
const contractTable=copyContractTable();
async function call(stage, messages) {
  if (fixtureArg) {
    const fpath=path.join(path.resolve(fixtureArg),`${stage}.json`);
    if (!fs.existsSync(fpath)) throw new Error(`mock fixture 缺失：${path.basename(fpath)}`);
    const fixture=JSON.parse(fs.readFileSync(fpath,'utf8'));
    const index=fixtureIndex.get(stage)??0;fixtureIndex.set(stage,index+1);
    const result=Array.isArray(fixture)?fixture[index]:fixture;
    if (!result) throw new Error(`mock fixture ${stage} 没有更多响应`);
    return result;
  }
  const endpoint=resolveLlmEndpoint({env:process.env,baseArg});
  let last;
  for(let i=0;i<3;i++) try {
    const response=await fetch(`${endpoint.base}/chat/completions`,{method:'POST',signal:AbortSignal.timeout(endpoint.timeoutMs),headers:{'content-type':'application/json','authorization':`Bearer ${endpoint.apiKey}`},body:JSON.stringify({model,messages,temperature:0.5,response_format:{type:'json_object'}})});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();
    return parseJson(payload.choices?.[0]?.message?.content ?? '');
  } catch(e) { last=e; if(i<2) await new Promise(r=>setTimeout(r,500*(i+1))); }
  const detail=String(last?.message ?? '未知错误').split(endpoint.apiKey).join('***');
  throw new Error(`LLM 请求失败（已重试 3 次）：${detail}`);
}
function parseJson(raw) {
  if (typeof raw !== 'string') return raw;
  const clean=raw.trim().replace(/^```(?:json)?\s*/iu,'').replace(/\s*```$/u,'');
  try { return JSON.parse(clean); } catch { const a=clean.indexOf('{'), b=clean.lastIndexOf('}'); if(a>=0&&b>a)return JSON.parse(clean.slice(a,b+1)); throw new Error('模型响应不是合法 JSON'); }
}
const briefText=JSON.stringify(brief,null,2);
const briefQuality=thinBrief(brief);
const corpusPrompt=corpus.map(x=>`${x.law}第${x.number}条（自${x.effective}起施行）`).join('\n');
const system=`你是讲解课编剧，只能输出 JSON 对象，不得有 Markdown。课程领域 ${brief.domain}，语言 ${brief.lang}，面向 ${brief.audience}。目标时长 ${brief.minutes} 分钟，中文旁白目标约 ${brief.minutes*240} 字，允许范围 ${Math.round(brief.minutes*192)}–${Math.round(brief.minutes*288)} 字。可用版式及字段/限制（每种版式含有序 revealTargets）：\n${layoutPrompt}\n稿件契约（下表由版式 spec 的 copy 字段生成，严于字段 max；新稿超限会判错并回喂重写）：\n${contractTable}\n二十种布局都要综合考虑，避免全用 steps。什么内容选什么版式：法条用 quote；并列要点用 points；常见错误、实物用 statement；做与不做用 compare；先后操作用 flow；期限、节点用 timeline；要件、材料、自查用 checklist；数字、期限用 bignumber；检验理解用 question；律师观点、收尾提醒用 saying；分档、强弱用 levels；具体故事用 case；凭证上看哪一处用 document；多条「情形 → 结果」用 table。同一版式连续不超过 2 页。全片不少于 8 页时，至少用到 5 种不同版式。旁白 pose 只能取 ${poseNames.join(', ')}，可选 note 最多 12 字。卡片写关键词，旁白讲完整的话：卡片上一行不要和旁白里的一句几乎一样。内容依据只来自 brief 的 points/sources/facts，不编造数字或结论。旁白是讲给观众听的，不能提审稿、核对、来源校验、生成流程或内部角色；同一意思全片最多说两次。每个内容页写 2–4 句旁白。每句的 reveal 必须对应它正在讲的 revealTargets：reveal k 累积点亮目标 0…k；标题不是 reveal 目标。没有独立目标的 cover/chapter 可不填 reveal。章节页 layout=chapter 必须写 fields.subtitle，一句不超过 60 字，说明这一章讲什么。question 页固定三段节奏：r0 读题，随后单独一句“先想一想”也用 r0；再用 r1 揭晓答案并解释，答案前不得用 r1。${brief.domain==='legal'?`\n法条白名单（只可以从中选条号，不得生成/改写 quote 原文）：\n${corpusPrompt}`:''}`;
const outlineMessages=[{role:'system',content:system+'\n'+promptText('outline')+'\n输出结构：{"chapters":[{"title":"...","pages":[{"layout":"二十种布局之一","title":"...","points":["..."],"articleNumber":"可选，仅数字条号"}]}]}。'}, {role:'user',content:`选题简报：\n${briefText}\n\n请先给结构清晰的大纲。`}];
let outline, script;
try {
  log(`开始生成；领域=${brief.domain}，语言=${brief.lang}，目标=${brief.minutes}分钟。`);
  for (const warning of briefQuality.warnings) log(`WARN ${warning}`);
  outline=await call('outline',outlineMessages);
  if(!outline || !Array.isArray(outline.chapters)) throw new Error('大纲必须包含 chapters 数组');
  fs.writeFileSync(path.join(outDir,'outline.json'),JSON.stringify(outline,null,2)+'\n','utf8');
  const scriptMessages=[{role:'system',content:system+'\n'+promptText('script')+'\n输出结构：{"tags":["3到5个主题词"],"chapters":[{"title":"...","pages":[{"title":"...","fields":{版式字段},"narration":[{"text":"...","reveal":0,"pose":"explain","note":"可选"}]}]}]}。tags 每个 2–6 字，必须是讲稿里出现过的主题词或领域通用词，不要带 #，不要从标题里切出「别人」「关键」这种无意义词。注意 quote 布局不得填写 quote 字段，只保留 articleNumber。'}, {role:'user',content:`简报：\n${briefText}\n\n大纲：\n${JSON.stringify(outline)}\n\n请补全每页卡片文案和旁白，控制旁白总字数在 ${Math.round(brief.minutes*192)}–${Math.round(brief.minutes*288)} 字。`}];
  script=await call('script',scriptMessages);
  if(!script || !Array.isArray(script.chapters)) throw new Error('讲稿必须包含 chapters 数组');
  const initial=assemble(brief,outline,script), initialCount=wordCount(initial), targetCount=brief.minutes*240;
  if(initialCount<targetCount*.8||initialCount>targetCount*1.2) {
    log(`旁白 ${initialCount} 字超出目标 ${targetCount} 字的 ±20%，请求模型删改。`);
    script=await call('duration-fix',[{role:'system',content:system+'\n请只调整旁白字数，不改动版式字段、法条条号和出处。输出完整讲稿 JSON。'}, {role:'user',content:`讲稿 JSON：\n${JSON.stringify(script)}\n当前旁白 ${initialCount} 字，目标 ${targetCount} 字，允许 ${Math.round(targetCount*.8)}–${Math.round(targetCount*1.2)} 字。请压缩或扩充旁白并返回完整 JSON。`}]);
    if(!script || !Array.isArray(script.chapters)) throw new Error('时长修订讲稿必须包含 chapters 数组');
  }
  fs.writeFileSync(path.join(outDir,'script.json'),JSON.stringify(script,null,2)+'\n','utf8');
  let lesson=assemble(brief,outline,script);
  let validation=validateLesson(lesson, {requireTags:true}), leaks=internalLeaks(lesson), repeats=repetition(lesson);
  const subtitleErrors=()=>generatedChapterSubtitleErrors(lesson);
  for(let round=1;(!validation.ok || !leaks.ok || !repeats.ok || subtitleErrors().length) && round<=2;round++) {
    const feedback=[...validation.errors,...subtitleErrors(),...leaks.blocks,...repeats.blocks];
    log(`第 ${round} 轮校验未通过，回喂 ${feedback.length} 条原始错误。`);
    const repair=await call(`repair-${round}`,[{role:'system',content:system+'\n修复校验失败的内容。输出 {"outline":完整大纲,"script":完整讲稿}；只改正错误涉及的字段。法条条号必须来自上面的本地白名单，quote 正文不可自行撰写。'}, {role:'user',content:`原大纲：\n${JSON.stringify(outline)}\n\n原讲稿：\n${JSON.stringify(script)}\n\n校验错误原文：\n${feedback.join('\n')}\n\n请修复错误并保持其余内容。`}]);
    if(repair?.outline&&Array.isArray(repair.outline.chapters)){outline=repair.outline;fs.writeFileSync(path.join(outDir,'outline.json'),JSON.stringify(outline,null,2)+'\n','utf8');}
    script=repair?.script&&Array.isArray(repair.script.chapters)?repair.script:repair;
    fs.writeFileSync(path.join(outDir,'script.json'),JSON.stringify(script,null,2)+'\n','utf8');
    lesson=assemble(brief,outline,script); validation=validateLesson(lesson, {requireTags:true}); leaks=internalLeaks(lesson); repeats=repetition(lesson);
  }
  const nonCopy=()=>[...validation.errors.filter((line)=>!line.startsWith('稿件字数：')),...subtitleErrors(),...leaks.blocks,...repeats.blocks];
  if((!validation.ok || !leaks.ok || !repeats.ok || subtitleErrors().length) && nonCopy().length===0) {
    const split=splitCopyOverflow(lesson);
    if(split.changed) {
      lesson=stamp(split.lesson, brief);
      validation=validateLesson(lesson, {requireTags:true}); leaks=internalLeaks(lesson); repeats=repetition(lesson);
      log('稿件字数仍超过契约，已按同一版式拆页，旁白随内容分开。');
    } else log(`稿件字数仍超过契约，且无法拆页：\n${split.blocked.join('\n')}`);
  }
  for (const warning of repeats.warnings) log(`WARN ${warning}`);
  for (const warning of validation.warnings) log(`WARN ${warning}`);
  if(!validation.ok || !leaks.ok || !repeats.ok || subtitleErrors().length) { fs.writeFileSync(path.join(outDir,'lesson.json'),JSON.stringify(lesson,null,2)+'\n','utf8'); const errors=[...validation.errors,...subtitleErrors(),...leaks.blocks,...repeats.blocks]; log(`最终校验失败：\n${errors.join('\n')}`); console.error(`lesson 校验失败：\n${errors.join('\n')}`); process.exit(1); }
  fs.writeFileSync(path.join(outDir,'lesson.json'),JSON.stringify(lesson,null,2)+'\n','utf8');
  const count=wordCount(lesson), target=brief.minutes*240, ratio=count/target;
  if(ratio<.8||ratio>1.2) log(`警告：模型旁白 ${count} 字，目标 ${target} 字；请人工确认时长。`);
  else log(`旁白估算 ${count} 字，目标 ${target} 字，位于 ±20% 范围。`);
  log(`风格 ${lesson.meta.theme}；讲解员 ${JSON.stringify(lesson.meta.presenter)}`);
  log('lesson.json 校验通过。');
  console.log(`lesson.json 已生成并通过校验：${path.join(outDir,'lesson.json')}`);
} catch(e) { log(`失败：${e.message}`); console.error(`生成失败：${e.message}`); process.exit(1); }
function wordCount(x) { return x.chapters.flatMap(c=>c.pages).flatMap(p=>p.narration).reduce((n,line)=>n+Array.from(line.text??'').length,0); }
function assemble(b,o,s) {
  const datedCitations=[];
  const chapters=(o.chapters??[]).map((oc,ci)=>({title:oc.title,pages:(oc.pages??[]).map((op,pi)=>{
    const sp=s.chapters?.[ci]?.pages?.[pi]??{}; const page={layout:op.layout,title:sp.title??op.title,...(sp.fields??{}),narration:(sp.narration??[]).map(n=>({text:n.text,reveal:n.reveal??0,pose:poseNames.includes(n.pose)?n.pose:'explain',...(n.note?{note:n.note}:{})}))};
    if(page.layout==='quote'&&b.domain==='legal') {
      const article=articleByNumber.get(String(op.articleNumber??''));
      if(article) {
        page.quote=article.body;
        page.source=`${article.law}第${article.number}条`;
        const dated=`${article.law}第${article.number}条，自${article.effective}起施行`;
        if(!datedCitations.includes(dated)) datedCitations.push(dated);
      }
    } else if(page.layout==='quote'&&sp.fields?.quote) page.quote=sp.fields.quote;
    return page;
  })}));
  const sources=[...(b.sources??[])];
  for (const dated of datedCitations) if (!sources.includes(dated)) sources.push(dated);
  for(const c of chapters) for(const p of c.pages) if(p.source&&!sources.includes(p.source)&&!datedCitations.some((dated)=>dated.startsWith(p.source))) sources.push(p.source);
  const mascot=b.mascot??(b.presenter?undefined:{id:b.domain==='legal'?'peep-counsel':'peep-mentor',enabled:true});
  const tags=Array.isArray(s.tags)?s.tags.filter((tag)=>typeof tag==='string').map((tag)=>tag.trim().replace(/^#+/u,'')).filter(Boolean):undefined;
  const meta={format:'lesson',title:b.title,domain:b.domain,lang:b.lang,voice:{provider:'mock',subtitles:'line'},...(tags?.length?{tags}:{}),...(mascot?{mascot}:{}),...(b.presenter?{presenter:b.presenter}:{}),brand:{name:b.domain==='legal'?'普法课堂':'学习课堂',primary:'#2563EB'},facts:b.facts??[],sources,...(b.domain==='legal'?{disclaimer:'普法内容，不构成法律意见'}:{})};
  return stamp({meta,chapters}, b);
}
function defaultPresenter(brief) {
  if (brief.mascot?.enabled === false) return {kind:'none'};
  const id = brief.mascot?.id;
  if (id === 'counsel' || id === 'peep-counsel') return {kind:'cartoon', look:{preset:'female'}};
  if (id === 'buddy' || id === 'peep-teacher') return {kind:'cartoon', look:{preset:'peep-teacher'}};
  if (id === 'mentor' || id === 'peep-mentor') return {kind:'cartoon', look:{preset:'male'}};
  return {kind:'cartoon', look:{preset:defaultPreset(brief.domain)}};
}
function stamp(lesson, brief) {
  const meta = {...lesson.meta};
  delete meta.theme;
  const pick = resolveLessonTheme({...lesson, meta});
  if (pick.theme) lesson.meta.theme = pick.theme;
  if (!lesson.meta.presenter) lesson.meta.presenter = defaultPresenter(brief);
  lesson.meta.generatedBy = LESSON_GENERATED_BY;
  return lesson;
}
