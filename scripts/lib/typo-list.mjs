// ============================================================
// 常见错别字表 + 绝对化承诺表（中/英）。
// 供 scripts/lib/text-checks.mjs 使用；不在这里做校验逻辑，只放数据。
//
// TYPO_ZH / TYPO_EN：{wrong, right, exceptionRe?}
//   exceptionRe 命中时不报错（如「登陆」在「登陆舰/登陆月球」里是对的）。
// ABS_CLAIM_ZH / ABS_CLAIM_EN：绝对化承诺的关键词（字符串，includes 命中）
// ABS_CLAIM_ZH_PATTERNS：绝对化承诺的正则（如「每…都」这种句式）
// ============================================================

export const TYPO_ZH = [
  {wrong: '登陆', right: '登录', exceptionRe: /登陆(舰|月球|火星|艇|点|日|战)/},
  {wrong: '帐号', right: '账号'},
  {wrong: '帐户', right: '账户'},
  {wrong: '帐单', right: '账单'},
  {wrong: '帐面', right: '账面'},
  {wrong: '帐簿', right: '账簿'},
  {wrong: '结帐', right: '结账'},
  {wrong: '做为', right: '作为'},
  {wrong: '既使', right: '即使'},
  {wrong: '必竟', right: '毕竟'},
  {wrong: '在次', right: '再次'},
  {wrong: '按装', right: '安装'},
  {wrong: '以经', right: '已经'},
  {wrong: '简结', right: '简洁'},
  {wrong: '立既', right: '立刻'},
  {wrong: '既可', right: '即可'},
  {wrong: '既将', right: '即将'},
  {wrong: '从新', right: '重新'},
  {wrong: '须要', right: '需要'},
  {wrong: '份享', right: '分享'},
  {wrong: '优惠卷', right: '优惠券'},
  {wrong: '打折卷', right: '打折券'},
  {wrong: '礼卷', right: '礼券'},
  {wrong: '兑换卷', right: '兑换券'},
  {wrong: '度身定制', right: '量身定制'},
  {wrong: '迫不急待', right: '迫不及待'},
  {wrong: '一如即往', right: '一如既往'},
  {wrong: '世外桃园', right: '世外桃源'},
  {wrong: '沧海一栗', right: '沧海一粟'},
  {wrong: '一股作气', right: '一鼓作气'},
  {wrong: '声名雀起', right: '声名鹊起'},
  {wrong: '甘败下风', right: '甘拜下风'},
  {wrong: '精神抖数', right: '精神抖擞'},
  {wrong: '烩炙人口', right: '脍炙人口'},
  {wrong: '编篡', right: '编纂'},
  {wrong: '走头无路', right: '走投无路'},
  {wrong: '不径而走', right: '不胫而走'},
  {wrong: '老俩口', right: '老两口'},
  {wrong: '名列前矛', right: '名列前茅'},
  {wrong: '鬼鬼崇崇', right: '鬼鬼祟祟'},
  {wrong: '眼花瞭乱', right: '眼花缭乱'},
  {wrong: '俱备', right: '具备'},
  {wrong: '相辅相承', right: '相辅相成'},
  {wrong: '穿流不息', right: '川流不息'},
  {wrong: '循序渐近', right: '循序渐进'},
  {wrong: '谈笑风声', right: '谈笑风生'},
  {wrong: '提心掉胆', right: '提心吊胆'},
  {wrong: '一丝不扣', right: '一丝不苟'},
  {wrong: '明辩是非', right: '明辨是非'},
  {wrong: '相形见拙', right: '相形见绌'},
  {wrong: '直接了当', right: '直截了当'},
];

export const TYPO_EN = [
  {wrong: 'recieve', right: 'receive'},
  {wrong: 'seperate', right: 'separate'},
  {wrong: 'occured', right: 'occurred'},
  {wrong: 'definately', right: 'definitely'},
  {wrong: 'untill', right: 'until'},
  {wrong: 'wich', right: 'which'},
  {wrong: 'becuase', right: 'because'},
  {wrong: 'thier', right: 'their'},
  {wrong: 'tommorow', right: 'tomorrow'},
  {wrong: 'acheive', right: 'achieve'},
  {wrong: 'enviroment', right: 'environment'},
  {wrong: 'freind', right: 'friend'},
  {wrong: 'adress', right: 'address'},
  {wrong: 'begining', right: 'beginning'},
  {wrong: 'calender', right: 'calendar'},
  {wrong: 'comming', right: 'coming'},
  {wrong: 'embarass', right: 'embarrass'},
  {wrong: 'exagerate', right: 'exaggerate'},
];

/** 绝对化承诺：命中即警告（不拦截），提示换更有分寸的说法 */
export const ABS_CLAIM_ZH = [
  '全搞定', '一清二楚', '不再卡脖子', '秒推送', '安全无忧', '百分百', '彻底解决', '一步到位', '再也不用', '再也不', '永远不会', '从此不用担心',
];
export const ABS_CLAIM_ZH_PATTERNS = [
  /每(一)?(句|个|次|条|位|一)[^，。！？\n]{0,6}都/,
];

export const ABS_CLAIM_EN = [
  'best', "world's best", 'number one', 'no.1', '#1', 'guaranteed', 'forever', 'always works', 'never fails',
  'ultimate', 'perfect', 'completely safe', 'zero risk', 'everyone loves', '100% ',
  'nothing distracts', 'never miss', 'always on', 'every time', 'zero distractions', 'instantly', 'in an instant',
];

/** 拼写出来的整数（one…hundred）+ 时长/百分比单位：常是没有来源的具体数字，只警告不拦截（英文没有 meta.facts 数字来源核对） */
export const SPELLED_NUM_EN_RE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b[\s-]*(minutes?|hours?|seconds?|percent|days?|weeks?)\b/i;
