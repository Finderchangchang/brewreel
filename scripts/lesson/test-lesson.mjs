import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generatedChapterSubtitleErrors, validateLesson} from './validate-lesson.mjs';
import {buildTimeline, chaptersText, contentBox, mapSentences, narrationText, pageFrames, revealProgress, subtitleScreenAtFrame, toSrt} from './timeline.mjs';
import {hasVisibleContent} from '../lib/blank-check.mjs';
import {readFileSync as readText} from 'node:fs';
import {PAGE_MOVE_FRAMES, POSE_BLEND_MS, interpolatePoint, poseAt, smoothStep, talkingAt} from '../../template/src/lesson/mascot/motion.mjs';

const sample = JSON.parse(readFileSync(new URL('../../examples/lesson/sample-tech.json', import.meta.url), 'utf8'));
assert.equal(validateLesson(sample).ok, true);
const gallery = JSON.parse(readFileSync(new URL('../../examples/lesson/layouts-gallery.json', import.meta.url), 'utf8'));
assert.equal(validateLesson(gallery).ok, true, '十种版式目录样例应全部通过规格校验');
assert.equal(new Set(gallery.chapters[0].pages.map((p) => p.layout)).size, 10, '目录应覆盖十种版式');
const contentArea = 1320 * 780;
for (const page of gallery.chapters.flatMap((chapter) => chapter.pages)) {
  const box = contentBox(page.layout, page);
  assert.ok(box.area >= contentArea * .4, `${page.layout} 主体面积 ${box.area} 不足版心 40%`);
}
const checkedGallery = validateLesson(gallery);
assert.deepEqual(checkedGallery.lesson.chapters[0].pages[1].items, gallery.chapters[0].pages[1].items, '校验器不得把版式字段打包进 items');
assert.equal(checkedGallery.lesson.chapters[0].pages.some((page) => (page.items ?? []).some((item) => item && typeof item === 'object' && '_m2Lang' in item)), false);
assert.match(checkedGallery.lesson.chapters[0].pages.find((page) => page.layout === 'screenshot').imageData, /^data:image\/svg\+xml;base64,/);
const checkedGalleryTimeline = buildTimeline(checkedGallery.lesson, checkedGallery.lesson.chapters[0].pages.map((page) => ({words:[{text:narrationText(page.narration),startMs:0,endMs:1000}],durMs:1000,src:'gallery.wav'})));
assert.match(checkedGalleryTimeline.pages.find((page) => page.layout === 'screenshot').fields.imageData, /^data:image\/svg\+xml;base64,/,'校验生成的 imageData 必须透传在 fields 中');
const errors = (lesson) => validateLesson(lesson).errors.join('\n');
assert.match(errors({...sample, meta: {...sample.meta, format: 'promo'}}), /meta.format/);
assert.match(errors({...sample, meta: {...sample.meta, title: ''}}), /meta.title/);
assert.match(errors({...sample, meta: {...sample.meta, domain: 'other'}}), /meta.domain/);
assert.match(errors({...sample, meta: {...sample.meta, brand: {primary:'blue'}}}), /meta.brand.primary/);
assert.match(errors({...sample, meta: {...sample.meta, facts:'text'}}), /meta.facts/);
assert.match(errors({...sample, meta: {...sample.meta, voice:{provider:'mock',subtitles:'karaoke-plus'}}}), /meta.voice.subtitles/);
assert.match(errors({...sample, chapters: []}), /chapters/);
const badPage = (edit) => ({...sample, chapters: [{title: 'x', pages: [{layout: 'steps', title: 'x', items: ['only one'], narration: [{text: 'a', reveal: 5, pose: 3, note: []}], ...edit}]}]});
assert.match(errors(badPage({layout:'chart'})), /不支持/);
assert.match(errors(badPage({})), /2–6 项/);
assert.match(errors(badPage({layout:'cover', subtitle:4, items:undefined})), /subtitle/);
assert.match(errors(badPage({items:['a','b'], narration:[]})), /narration/);
assert.match(errors(badPage({items:['a','b'], narration:[{text:'x',reveal:5}]})), /reveal/);
assert.match(errors(badPage({items:['a','b'], narration:[{text:'x',pose:3}]})), /pose/);
assert.match(errors(badPage({items:['a','b'], narration:[{text:'x',pose:'dance'}]})), /pose/);
assert.match(errors(badPage({items:['a','b'], narration:[{text:'x',note:'这个要点便签内容超过十二个字符'}]})), /note/);
assert.match(errors(badPage({items:['a','b'], narration:[{text:'x',note:'   '}]})), /note/);
assert.match(errors({...sample, meta:{...sample.meta,mascot:{id:2}}}), /meta.mascot/);
const quotePage = (edit) => ({...sample, chapters:[{title:'测试',pages:[{layout:'quote',title:'引用校验',quote:'引用内容',source:'来源',narration:[{text:'说明',reveal:0}],...edit}]}]});
const quoteWarning = validateLesson(quotePage({quote:'完全不同的引用原文',source:'出处',emphasis:'目标短语'}));
assert.equal(quoteWarning.ok, true);
assert.match(quoteWarning.warnings.join('\n'), /emphasis.*不在引用原文中/);
assert.match(errors(quotePage({source:''})), /必须提供出处行/);
assert.match(errors(quotePage({quote:'字'.repeat(181)})), /最多 180 字/);
assert.match(errors(quotePage({narration:[{text:'说明',reveal:3}]})), /超出此版式可用范围/);
const codePage = (code) => ({...sample,chapters:[{title:'测试',pages:[{layout:'code',title:'代码校验',code,language:'JavaScript',narration:[{text:'说明',reveal:0}]}]}]});
assert.match(errors(codePage(Array.from({length:15},(_,i)=>`line${i+1}`).join('\n'))), /代码最多 14 行/);
const screenshotPage = (image, callouts) => ({...sample,chapters:[{title:'测试',pages:[{layout:'screenshot',title:'截图校验',image,callouts,alt:'示意界面',narration:[{text:'说明',reveal:0}]}]}]});
assert.match(errors(screenshotPage('missing-screen.png',[{x:0,y:0,width:.2,height:.2}])), /找不到截图/);
assert.match(errors(screenshotPage('examples/lesson/layouts/demo-screen.svg',[{x:.9,y:.1,width:.2,height:.2}])), /超出图片右边界/);
assert.equal(errors(screenshotPage('examples/lesson/layouts/demo-screen.svg',[{x:0,y:0,width:.2,height:.2}])), '');
const lessonSource = readText(new URL('../../template/src/lesson/Lesson.tsx', import.meta.url), 'utf8');
assert.match(lessonSource, /contentMotion\(\{first, inTail, tMs\}\)/, '页首走 contentMotion，封面不会从空白淡入');
assert.match(lessonSource, /turnOutFrames\(timeline\.fps\)/, '上一页内容延到下一页开头，交界不能空');
assert.match(errors({...sample, meta:{...sample.meta,mascot:{id:'default',palette:{primary:'teal'}}}}), /meta.mascot.palette.primary/);
assert.match(errors({...sample, meta:{...sample.meta,mascot:{id:'default',hair:'ponytail'}}}), /meta.mascot.hair/);
assert.match(errors({...sample, meta:{...sample.meta,mascot:{id:'default',outfit:'robe'}}}), /meta.mascot.outfit/);
assert.match(errors({...sample, meta:{...sample.meta,mascot:{id:'default',pageOverrides:[{pageIndex:1,wardrobe:{id:'custom',hair:'mohawk'}}]}}}), /pageOverrides\[0\].wardrobe.hair/);
for (const id of ['mentor','counsel','buddy']) assert.equal(errors({...sample,meta:{...sample.meta,mascot:{id}}}), '', `${id} 角色应可选择`);
assert.equal(errors({...sample,meta:{...sample.meta,mascot:{}}}), '', '省略角色 id 时应默认 mentor');
assert.match(errors({...sample,meta:{...sample.meta,mascot:{id:'wizard'}}}), /meta.mascot.id/);
assert.equal(errors({...sample,meta:{...sample.meta,mascot:{id:'counsel',hair:'Bun',outfit:'tee',accessory:'GlassButterflyOutline',palette:{primary:'#675080'}}}}), '', 'counsel 应支持配色、发型与衣服族');
assert.equal(errors({...sample,meta:{...sample.meta,mascot:{id:'buddy',palette:{primary:'#4B8AA0'}}}}), '', 'buddy 应支持 palette');
assert.equal(errors({...sample,meta:{...sample.meta,mascot:{id:'buddy',hair:'MediumBangs',outfit:'shirt'}}}), '', '旧 buddy 可以覆盖发型并选择衣服族');
assert.match(errors({...sample,meta:{...sample.meta,mascot:{id:'buddy',hair:'wave'}}}), /meta.mascot.hair/);
assert.match(errors({...sample,meta:{...sample.meta,mascot:{id:'buddy',outfit:'suit'}}}), /meta.mascot.outfit/);
assert.match(errors({...sample,meta:{...sample.meta,mascot:{id:'peep-teacher',accessory:'monocle'}}}), /meta.mascot.accessory/);
assert.match(errors({...sample,meta:{...sample.meta,mascot:{id:'peep-mentor',facialHair:'beard'}}}), /meta.mascot.facialHair/);
for (const id of ['peep-mentor','peep-counsel','peep-teacher']) assert.equal(errors({...sample,meta:{...sample.meta,mascot:{id}}}), '', `${id} 应可选择`);
const mascotDemo = JSON.parse(readFileSync(new URL('../../examples/lesson/mascot-demo.json', import.meta.url), 'utf8'));
const demoPoses = [...new Set(mascotDemo.chapters.flatMap((chapter) => chapter.pages.flatMap((page) => page.narration.map((line) => line.pose ?? 'explain'))))].sort();
assert.deepEqual(demoPoses, ['affirm','check','cheer','explain','point','think','warn','wave']);
assert.equal(poseAt(undefined), 'explain');
assert.equal(poseAt('wave'), 'wave');
assert.equal(POSE_BLEND_MS, 300);
assert.equal(PAGE_MOVE_FRAMES, 9);
assert.deepEqual(interpolatePoint([0, 10], [10, 30], 0.5), [5, 20]);
assert.equal(smoothStep(0), 0);
assert.equal(smoothStep(1), 1);
const mouthChars = [{text:'字',startMs:0,endMs:100},{text:'，',startMs:100,endMs:250},{text:'后',startMs:500,endMs:600}];
assert.equal(talkingAt(mouthChars, 50), true, '可发声字符区间张嘴');
assert.equal(talkingAt(mouthChars, 150), false, '标点区间闭嘴');
assert.equal(talkingAt(mouthChars, 350), false, '两个字之间的停顿闭嘴');
assert.equal(talkingAt(mouthChars, 550), true, '后续可发声字符再次张嘴');

const sentenceSet = [{text:'今天 Codex 支持第 2 项'}, {text:'版本更新？'}];
const full = narrationText(sentenceSet);
assert.equal(full, '今天 Codex 支持第 2 项。版本更新？');
const timed = [{text:'今天 Codex 支持第 2 项。版本更新？',startMs:0,endMs:3000}];
const mapped = mapSentences(sentenceSet, timed, 3000);
assert.equal(mapped.length,2);
assert.equal(mapped[0].text,'今天 Codex 支持第 2 项。');
assert.equal(mapped[1].text,'版本更新？');
assert.ok(mapped[0].endMs <= mapped[1].endMs);
assert.ok(mapped.every((s)=>s.chars.every((c)=>Number.isFinite(c.startMs)&&Number.isFinite(c.endMs))));
const mismatched = mapSentences([{text:'甲乙丙丁'}],[{text:'甲丁',startMs:0,endMs:1000}],1000);
assert.equal(mismatched[0].chars.length,5);
assert.ok(mismatched[0].chars.every((c)=>Number.isFinite(c.startMs)&&c.endMs>=c.startMs));

assert.equal(pageFrames(1000),66); // 2.2 秒向上对齐 30fps
assert.equal(pageFrames(1000) * 1000 / 30, 2200);
const lesson = {meta:sample.meta,chapters:[{title:'第一章',pages:[{layout:'cover',title:'标题',subtitle:'副题',narration:[{text:'甲乙',reveal:0,pose:'point'}]}]},{title:'第二章',pages:[{layout:'steps',title:'标题',items:['一','二'],narration:[{text:'一二',reveal:1}]}]}]};
const tl = buildTimeline(lesson,[{words:[{text:'甲乙。',startMs:0,endMs:1000}],durMs:1000,src:'a'},{words:[{text:'一二。',startMs:0,endMs:1000}],durMs:1000,src:'b'}]);
assert.equal(tl.totalFrames,132);
assert.equal(tl.pages[0].sentences[0].revealAtMs,400);
assert.equal(tl.pages[0].sentences[0].pose,'point');
assert.match(toSrt(tl),/00:00:00,\d{3} --> 00:00:01,\d{3}/);
assert.match(chaptersText(tl),/^00:00 第一章\n00:02 第二章\n$/);
assert.deepEqual(tl.pages[1].fields, {layout:'steps',title:'标题',items:['一','二']}, 'page.fields 应包含除 narration 外的原始字段');
const revealFallbackLesson = {meta:sample.meta,chapters:[{title:'steps 补齐',pages:[{layout:'steps',title:'三步',items:['第一','第二','第三'],narration:[{text:'第一步。',reveal:0},{text:'第三步。',reveal:2}]}]}]};
const revealFallbackTimeline = buildTimeline(revealFallbackLesson,[{words:[{text:'第一步。第三步。',startMs:0,endMs:1600}],durMs:1600,src:'steps.wav'}]);
const revealFallbackPage = revealFallbackTimeline.pages[0];
const thirdAtFrame = Math.floor(revealFallbackPage.sentences[1].revealAtMs * 30 / 1000);
assert.equal(revealProgress(revealFallbackPage,1,thirdAtFrame-1),0,'累积语义：第二条在讲到第三条之前不出现');
assert.ok(revealProgress(revealFallbackPage,1,thirdAtFrame+11)>0,'累积语义：讲到第三条时第二条一起出现');
assert.equal(revealProgress(revealFallbackPage,3,revealFallbackPage.durationFrames-27,true),0,'没有任何旁白覆盖的条目不提前出现');
assert.equal(revealProgress(revealFallbackPage,3,revealFallbackPage.durationFrames-15,true),1,'所有条目须在片尾前 0.5 秒出现');
assert.equal(revealProgress(revealFallbackPage,3,0),1,'无 reveal 的独立主体应保持可见');
assert.ok(revealProgress(revealFallbackPage,0,30)>0,'reveal 0 应映射首条');
assert.ok(revealProgress(revealFallbackPage,2,60)>0,'reveal 2 应映射第三条');

const regressionLesson = {meta:sample.meta,chapters:[
  {title:'第一章',pages:[
    {layout:'cover',title:'封面一',narration:[{text:'第一页旁白。'}]},
    {layout:'steps',title:'页面二',items:['甲','乙'],narration:[{text:'第二页旁白。'}]},
  ]},
  {title:'第二章',pages:[
    {layout:'steps',title:'页面三',items:['甲','乙'],narration:[{text:'第三页旁白。'}]},
    {layout:'steps',title:'页面四',items:['甲','乙'],narration:[{text:'目标句位于第二章第二页。'}]},
  ]},
]};
const regressionTimeline = buildTimeline(regressionLesson, regressionLesson.chapters.flatMap((chapter) => chapter.pages).map((page) => ({
  words:[{text:narrationText(page.narration),startMs:0,endMs:1200}],durMs:1200,src:'mock.wav',
})));
const targetPage = regressionTimeline.pages[3];
const targetSentence = targetPage.sentences[0];
const targetFrame = Math.floor(((targetSentence.startMs + targetSentence.endMs) / 2) * regressionTimeline.fps / 1000);
assert.equal(subtitleScreenAtFrame(regressionTimeline,targetFrame)?.text,targetSentence.text,'第二章第二页句子中点的全片帧应选择该句字幕屏');
assert.ok(regressionTimeline.subtitles.find((s)=>s.pageIndex===targetPage.index)?.startMs >= targetPage.startMs,'后续页字幕时间必须含全片页偏移');
const pauseTimeline = buildTimeline({meta:sample.meta,chapters:[{title:'停顿测试',pages:[{layout:'steps',title:'字幕停顿',items:['甲','乙'],narration:[{text:'甲，乙。'}]}]}]},[
  {words:[{text:'甲，',startMs:0,endMs:400},{text:'乙。',startMs:600,endMs:1000}],durMs:1000,src:'mock.wav'},
]);
const pauseSentence = pauseTimeline.pages[0].sentences[0];
const pauseFrame = Math.floor((pauseSentence.startMs + 500) * pauseTimeline.fps / 1000);
assert.equal(subtitleScreenAtFrame(pauseTimeline,pauseFrame)?.text,'甲，乙。','整句不足 6 字时不在逗号切屏，停顿期间字幕仍在');
const holdTimeline = buildTimeline({meta:sample.meta,chapters:[{title:'长句停顿',pages:[{layout:'steps',title:'字幕停顿',items:['甲','乙'],narration:[{text:'利息写清楚才算有约定。'},{text:'交付凭证也要一起留存。'}]}]}]},[
  {words:[{text:'利息写清楚才算有约定。',startMs:0,endMs:1200},{text:'交付凭证也要一起留存。',startMs:2000,endMs:3200}],durMs:3200,src:'mock.wav'},
]);
const holdScreens = holdTimeline.subtitles;
assert.deepEqual(holdScreens.map((screen) => screen.text), ['利息写清楚才算有约定。', '交付凭证也要一起留存。'], '句号两侧都够长时必须换屏');
const holdGapFrame = Math.floor((holdScreens[0].startMs + 1500) * holdTimeline.fps / 1000);
assert.equal(subtitleScreenAtFrame(holdTimeline, holdGapFrame)?.text, '利息写清楚才算有约定。', '句号后的停顿应保留上一字幕屏');
assert.ok(holdScreens.every((screen) => screen.endMs - screen.startMs >= 800), '停顿算进显示时长后仍要够 0.8 秒');

const rgb = Buffer.alloc(192*108*3,255);
for (let y=20;y<40;y++) for(let x=20;x<28;x++) {const i=(y*192+x)*3;rgb[i]=rgb[i+1]=rgb[i+2]=0;}
assert.equal(hasVisibleContent(Buffer.alloc(192*108*3,255)),false,'纯白画面应为空');
assert.equal(hasVisibleContent(rgb),true,'白底文字边缘应当算作内容');

const chapterOnly = {...sample, chapters:[{title:'旧稿章节', pages:[{layout:'chapter', title:'没有副标题的旧稿', narration:[{text:'这一章先讲工具怎么用。'}]}]}]};
assert.equal(validateLesson(chapterOnly).ok, true, `旧讲稿章节副标题可以不填：${validateLesson(chapterOnly).errors.join('；')}`);
assert.equal(generatedChapterSubtitleErrors(chapterOnly).length, 1, '生成新稿时章节副标题仍然必填');
const licenseLesson = {...sample, chapters:[{title:'许可证', pages:[{layout:'steps', title:'开源许可证', items:['MIT 许可证','使用前先看许可证'], narration:[{text:'讲 Codex 时会提到软件许可证，这不是法律意见。'}]}]}]};
assert.equal(validateLesson(licenseLesson).ok, true, `许可证不应被当成法律内容：${validateLesson(licenseLesson).errors.join('；')}`);
const methodLesson = {...sample, chapters:[{title:'方法', pages:[{layout:'steps', title:'《使用方法》', items:['先看语法','再看步骤'], narration:[{text:'这一页只讲工具的使用方法。'}]}]}]};
assert.equal(validateLesson(methodLesson).ok, true, `《使用方法》不应被当成法条：${validateLesson(methodLesson).errors.join('；')}`);
const withLaw = (text) => ({...sample, chapters:[{title:'章', pages:[{layout:'steps', title:'标题', items:['要点一','要点二'], narration:[{text}]}]}]});
for (const text of ['这里引用《合同法》的一般规则。', '民法典把书面形式写进条文。', '第十二条只是一个例子。', '这会由人民法院认定。']) {
  const result = validateLesson(withLaw(text));
  assert.equal(result.ok, false, text);
  assert.match(result.errors.join('\n'), /看起来是法律内容，请把 domain 设为 legal，走律师审稿/);
}
const realTech = JSON.parse(readFileSync(new URL('../../examples/lesson/real-tech.json', import.meta.url), 'utf8'));
const techWithLicense = structuredClone(realTech);
techWithLicense.chapters[0].pages[0].narration.push({text:'使用前先看软件许可证。', reveal:0, pose:'explain'});
assert.equal(validateLesson(techWithLicense).ok, true, `Codex 课提到许可证不应误伤：${validateLesson(techWithLicense).errors.join('；')}`);
assert.equal(validateLesson(realTech).ok, true, `real-tech 应通过校验：${validateLesson(realTech).errors.join('；')}`);
const realLegal = JSON.parse(readFileSync(new URL('../../examples/lesson/real-legal.json', import.meta.url), 'utf8'));
assert.equal(validateLesson(realLegal).ok, true, `real-legal 应通过校验：${validateLesson(realLegal).errors.join('；')}`);
const legalAsTech = structuredClone(realLegal);
legalAsTech.meta = {...legalAsTech.meta, domain:'tech'};
assert.match(validateLesson(legalAsTech).errors.join('\n'), /看起来是法律内容，请把 domain 设为 legal，走律师审稿/);

const audioFor = (pages) => pages.map((page) => ({words: [{text: narrationText(page.narration), startMs: 0, endMs: 1000}], durMs: 1000, src: 'mock.wav'}));
const oneChapterLesson = {meta: sample.meta, chapters: [{title: '只有一章', pages: [
  {layout: 'cover', title: '封面', narration: [{text: '开场'}]},
  {layout: 'chapter', title: '这一章', subtitle: '把时长并到后一页', narration: [{text: '章节页旁白'}]},
  {layout: 'steps', title: '两步', items: ['甲', '乙'], narration: [{text: '接着讲'}]},
]}]};
const skippedTimeline = buildTimeline(oneChapterLesson, audioFor(oneChapterLesson.chapters[0].pages));
assert.deepEqual(skippedTimeline.pages.map((page) => page.layout), ['cover', 'steps']);
assert.equal(skippedTimeline.pages[1].index, 2, '跳过章节页后仍保留原稿页序');
assert.equal(skippedTimeline.pages[0].durationFrames, pageFrames(1000));
assert.equal(skippedTimeline.pages[1].durationFrames, pageFrames(1000) * 2, '章节页时长并到后一页');
assert.equal(skippedTimeline.totalFrames, pageFrames(1000) * 3, '总时长不变');
const onlyChapterTimeline = buildTimeline(chapterOnly, audioFor(chapterOnly.chapters[0].pages));
assert.equal(onlyChapterTimeline.pages.length, 1, '只有章节页时不能把时间轴清空');
assert.equal(onlyChapterTimeline.pages[0].layout, 'chapter');
const twoChapterLesson = {meta: sample.meta, chapters: [
  {title: '第一章', pages: [{layout: 'chapter', title: '甲章', subtitle: '甲的内容', narration: [{text: '甲'}]}]},
  {title: '第二章', pages: [{layout: 'steps', title: '乙', items: ['甲', '乙'], narration: [{text: '乙'}]}]},
]};
const keptTimeline = buildTimeline(twoChapterLesson, audioFor(twoChapterLesson.chapters.flatMap((chapter) => chapter.pages)));
assert.equal(keptTimeline.pages[0].layout, 'chapter', '多章时章节页照常成页');
const legalTimeline = buildTimeline(realLegal, audioFor(realLegal.chapters.flatMap((chapter) => chapter.pages)));
assert.equal(legalTimeline.pages.some((page) => page.layout === 'chapter'), false);
assert.equal(legalTimeline.pages.length, realLegal.chapters[0].pages.length - 1);
const legalWarnings = validateLesson(realLegal).warnings.join('\n');
assert.match(legalWarnings, /全片只有 1 章，章节页不会单独成页，时长并到后一页/);
assert.match(legalWarnings, /卡片写关键词，旁白讲完整的话/);

console.log('✓ lesson.json 校验：合法样例 + 十种布局、字段缺失/超限、reveal、截图路径与坐标、代码行数');
console.log('✓ 讲解员：8 种 pose、300ms 姿态过渡、逐字口型与停顿闭口');
console.log('✓ 句子时间映射：标点、中英混排、数字、缺字插值');
console.log('✓ 页时长整帧、reveal、SRT 毫秒时间码、章节列表');
console.log('✓ 字幕屏全片帧映射：第二章第二页旁白中点选择正确字幕，标点停顿不掉屏');
console.log('✓ 空帧内容判定：纯色为空、白底文字有内容');
console.log('✓ 首帧回归：第一页封面取消初始淡入空帧');
console.log('✓ M2.1 版心占比、fields 透传、重点词缺失警告、steps 未映射条目补齐');
