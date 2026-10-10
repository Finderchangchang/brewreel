/** 讲稿里引用品牌的写法：客户id，或再加 @版本。 */

export const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const REF_RE = /^([a-z0-9][a-z0-9-]{0,40})(?:@([1-9]\d*))?$/;

export function parseBrandRef(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(REF_RE);
  if (!match) return null;
  return {client: match[1], version: match[2] ? Number(match[2]) : null};
}

export function brandRefProblem(value) {
  if (parseBrandRef(value)) return '';
  return '必须是「客户id」或「客户id@版本」，例如 hengchuan@1。客户 id 只用小写字母、数字和短横线，版本从 1 开始';
}
