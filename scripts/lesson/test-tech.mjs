import assert from 'node:assert/strict';
import {domainHooks, getDomainRules} from './packs/domain-hooks.mjs';

const rules = getDomainRules('tech');
assert.equal(rules.checks.length, 4);
assert.ok(rules.checks.every((rule) => rule.source?.trim()));
const lesson = (page, meta = {}) => ({meta:{domain:'tech',facts:[],...meta},chapters:[{title:'章节',pages:[{title:'页面',items:['要点一','要点二'],narration:[{text:'介绍功能'}],...page}]}]});
const run = (page, meta) => domainHooks.tech(lesson(page,meta));

let result = run({narration:[{text:'API 是指应用之间调用功能的接口。'}]});
assert.equal(result.warn.some((x) => /tech-first-term/.test(x)), false);
result = run({narration:[{text:'使用 API 连接服务。'}]});
assert.ok(result.warn.some((x) => /tech-first-term/.test(x)));
result = run({narration:[{text:'了解普通功能。'}]});
assert.equal(result.warn.some((x) => /tech-first-term/.test(x)), false);
const repeatedTerms = {meta:{domain:'tech',facts:[]},chapters:[{title:'术语前后',pages:[{title:'定义',items:['A','B'],narration:[{text:'API（应用程序接口）用于连接服务。'}]},{title:'复用',items:['A','B'],narration:[{text:'API 可以传递数据。'}]}]}]};
assert.equal(domainHooks.tech(repeatedTerms).warn.some((x) => /tech-first-term/.test(x)), false,'术语只需在全稿首次出现时解释');

result = run({layout:'code',language:'javascript',code:'const a = 1;\nconsole.log(a);'});
assert.equal(result.warn.some((x) => /tech-code-block/.test(x)), false);
result = run({layout:'code',code:'x'});
assert.ok(result.warn.some((x) => /tech-code-block/.test(x)));
result = run({layout:'code',language:'js',code:Array.from({length:13},(_,i)=>`line${i}`).join('\n')});
assert.ok(result.warn.some((x) => /13 行/.test(x)));

result = run({layout:'screenshot',alt:'代码编辑器显示保存按钮',annotations:[{label:'保存'}]});
assert.equal(result.block.some((x) => /tech-screenshot/.test(x)), false);
result = run({layout:'screenshot',alt:'',annotations:[]});
assert.ok(result.block.some((x) => /tech-screenshot/.test(x)));
result = run({layout:'steps',title:'Codex 2.4 新版功能'});
assert.ok(result.warn.some((x) => /tech-product-facts/.test(x)));
result = run({layout:'steps',title:'Codex 2.4 新版功能'}, {facts:[{text:'Codex 2.4 released',source:'https://example.test/release'}]});
assert.equal(result.warn.some((x) => /tech-product-facts/.test(x)), false);
result = run({layout:'steps',title:'介绍常规编程概念'});
assert.equal(result.warn.some((x) => /tech-product-facts/.test(x)), false);
console.log('✓ tech 术语、代码块、截图 alt/标注、产品与版本出处：正反例通过');
