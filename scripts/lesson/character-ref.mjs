/** 讲稿里引用角色的写法：客户id/角色id，或再加 @版本。 */

export const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const REF_RE = /^([a-z0-9][a-z0-9-]{0,40})\/([a-z0-9][a-z0-9-]{0,40})(?:@([1-9]\d*))?$/;

export function parseCharacterRef(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(REF_RE);
  if (!match) return null;
  return {client: match[1], id: match[2], version: match[3] ? Number(match[3]) : null};
}

export function characterRefProblem(value) {
  if (parseCharacterRef(value)) return '';
  return '必须是「客户id/角色id」或「客户id/角色id@版本」，例如 demo/host@1。客户 id 和角色 id 只用小写字母、数字和短横线，版本从 1 开始';
}
