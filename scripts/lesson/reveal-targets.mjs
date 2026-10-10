const descriptions = {
  steps: ['第 1 条','第 2 条','第 3 条','第 4 条','第 5 条','第 6 条'],
  recap: ['第 1 条','第 2 条','第 3 条','第 4 条','第 5 条'],
  flow: ['第 1 步','第 2 步','第 3 步','第 4 步','第 5 步','第 6 步'],
  quote: ['原文及随原文绘出的强调线','出处','底部关键句'],
  compare: ['左栏与 VS 标记','右栏'],
  question: ['题目与全部选项','揭晓答案、高亮正确项并显示说明'],
  screenshot: ['截图','第 1 个标注','第 2 个标注','第 3 个标注','第 4 个标注'],
  code: Array.from({length:14},(_,i)=>`第 ${i+1} 行`),
  points: ['第 1 张','第 2 张','第 3 张','第 4 张'],
  statement: ['左侧大字','依据','道具纸'],
  checklist: ['第 1 项','第 2 项','第 3 项','第 4 项','第 5 项','第 6 项','第 7 项','第 8 项'],
  bignumber: ['大数字与名称','依据','说明卡','进度轴'],
  saying: ['引号与观点','署名'],
  levels: ['第 1 档','第 2 档','第 3 档'],
  case: ['第 1 句','第 2 句','第 3 句','第 4 句','结论'],
  document: ['示意图','高亮与放大','关键句'],
  table: ['第 1 行','第 2 行','第 3 行','第 4 行'],
};

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

/** 返回当前页面真实存在的 reveal 目标；上限由对应 spec 的 revealTargets 声明。顺序与画面出现顺序一致。 */
export function revealTargetsFor(page) {
  const declared=descriptions[page?.layout]??[];
  const fields=page?.fields??page??{};
  if(page?.layout==='timeline'){
    const nodes=Array.isArray(fields.nodes)?Math.min(4, fields.nodes.length):0;
    const names=Array.from({length:nodes},(_,i)=>`第 ${i+1} 个节点`);
    if(hasText(fields.quote)) names.push('法条卡');
    return names;
  }
  let count=declared.length;
  if(page?.layout==='steps'||page?.layout==='recap'||page?.layout==='checklist')count=Array.isArray(fields.items)?fields.items.length:0;
  if(page?.layout==='points')count=Array.isArray(fields.items)?fields.items.length:0;
  if(page?.layout==='flow')count=Array.isArray(fields.steps)?fields.steps.length:0;
  if(page?.layout==='screenshot')count=1+(Array.isArray(fields.callouts)?fields.callouts.length:0);
  if(page?.layout==='code')count=typeof fields.code==='string'?fields.code.split(/\r?\n/u).length:0;
  if(page?.layout==='quote')count=hasText(fields.tag)||hasText(fields.tagText)?3:2;
  if(page?.layout==='statement')count=3;
  if(page?.layout==='bignumber')count=hasText(fields.axisFrom)||hasText(fields.axisTo)||hasText(fields.axisSpan)?4:3;
  if(page?.layout==='saying')count=2;
  if(page?.layout==='levels')count=Array.isArray(fields.items)?fields.items.length:0;
  if(page?.layout==='case'){
    const n=Math.min(4, Array.isArray(fields.lines)?fields.lines.length:0);
    return [...declared.slice(0,n), declared[declared.length-1]];
  }
  if(page?.layout==='document')count=3;
  if(page?.layout==='table')count=Array.isArray(fields.rows)?fields.rows.length:0;
  return declared.slice(0,Math.max(0,count));
}
