// ============================================================
// coreActionSurface：核心动作要在「产品自己的样子」里演出来，按行业分两类（rules.coreAction.surface）：
//   ui（软件、成人职业培训）：在产品界面里演示——chat / phone（真截图）/ mockApp；
//       · mockApp kind=form 只给「本来就是填表」的产品（报名/登记/预约…），别的产品拿表单顶替核心动作一律拦
//         （评审案例：聊天助手为了避开样例相似度，把「收到消息 → 分析 → 回复」换成填「情绪标签/危险程度」的表单）；
//       · meta.action 是消息/聊天/回复类，必须有 chat（或 phone 真截图）；
//       · meta.action 根本不是对话/问答类，却用 chat 演成聊天（评审案例：专注计时器被演成和「them」的对话）→ 拦。
//   physical（餐饮、电商实物、美业、文旅）：用照片或插画场景演示——photoShot（商家实拍或 source:"drawn" 插画）/ beforeAfter；
//       · mockApp 是模型编出来的 App 界面（点单页、结算页、预订页），一律拦；商家真有小程序/店铺页截图就用 phone 放截图。
// 全片级的问题 where 用 'shots'（validate.mjs --specs 的单镜自检会跳过 where==='shots' 的整片规则）。
// ============================================================
import {where, mkFinding as F} from './util.mjs';

const UI_DEFAULT = ['software', 'education'];
const FORM_ACTION = /填表|表单|填写|报名|登记|提交|申请|预约|问卷|注册|签到|打卡|投票|form|sign ?up|register|apply|booking|survey/i;
const MSG_ACTION = /消息|聊天|回消息|回复|私信|对话|留言|评论区|客服|群聊|message|chat|repl(y|ies)|\bdm\b|comment/i;
const CONVO_ACTION = /消息|聊天|回复|私信|对话|留言|评论|客服|咨询|问|答|说|聊|助手|AI|message|chat|repl(y|ies)|ask|question|answer|talk|say|assistant|\bdm\b/i;

export function coreActionSurface(sb, ctx, rules) {
  const out = [];
  const shots = Array.isArray(sb?.shots) ? sb.shots : [];
  const cfg = rules?.coreAction ?? {};
  const industry = rules?.industry ?? ctx?.meta?.industry ?? 'software';
  const surface = cfg.surface ?? (UI_DEFAULT.includes(industry) ? 'ui' : 'physical');
  const industryName = rules?.name ?? industry;
  const action = typeof ctx?.meta?.action === 'string' ? ctx.meta.action.trim() : '';
  const isFormProduct = !!action && FORM_ACTION.test(action);

  if (surface === 'ui') {
    shots.forEach((s, i) => {
      if (s?.type === 'mockApp' && s.params?.kind === 'form' && !isFormProduct)
        out.push(F('block', where(i, 'mockApp', 'params.kind'), `核心动作是「${action || '（meta.action 没写）'}」，这一镜却用 form 表单代替：观众看到的是在填字段，不是产品真正在做的事`,
          '在产品自己的界面里演这个动作：消息/聊天类用 chat（先出现对方的消息 → 点开面板 → 给出结果）；生成类用 mockApp kind:"editor"（input 写用户输入，items 写产出）；查数类用 kind:"dashboard"；有真截图就用 phone。form 只给本来就是填表/报名/预约的产品'));
    });
    const isUiDemo = (s) => s?.type === 'chat' || (s?.type === 'phone' && !!s.params?.src) || (s?.type === 'mockApp' && (s.params?.kind !== 'form' || isFormProduct));
    if (!shots.some(isUiDemo))
      out.push(F('block', 'shots', `「${industryName}」的核心动作要在产品自己的界面里演示，全片没有一镜 chat / phone（真截图）/ mockApp（非表单）`,
        '加一镜：消息类用 chat；生成/编辑类用 mockApp kind:"editor"；查数类用 kind:"dashboard"；有截图就用 phone。卖点卡、步骤卡不算演示'));
    if (action && MSG_ACTION.test(action) && !shots.some((s) => s?.type === 'chat' || (s?.type === 'phone' && !!s.params?.src)))
      out.push(F('block', 'shots', `核心动作「${action}」是消息/聊天类，全片却没有 chat（也没有 phone 真截图），消息本身从头到尾没出现`,
        '用 chat 镜头：messages 先出现对方发来的那句话，panel 给出分析/候选回复；不要用表单或卖点卡代替'));
    if (action && !CONVO_ACTION.test(action))
      shots.forEach((s, i) => {
        if (s?.type === 'chat')
          out.push(F('block', where(i, 'chat', ''), `核心动作「${action}」不是聊天/问答，这一镜却把产品演成了和别人的对话`,
            'chat 只给消息/聊天/问答类产品用；改成 mockApp（button 写产品里真实的按钮，如「开始专注」，done 写按下后的结果），有截图就用 phone'));
      });
  } else {
    shots.forEach((s, i) => {
      if (s?.type === 'mockApp')
        out.push(F('block', where(i, 'mockApp', ''), `「${industryName}」是实物/门店行业，mockApp 是编出来的 App 界面（点单页、结算页、预订页、编辑器），不能拿来演示核心动作`,
          '改用 photoShot 演示产品本身：有商家实拍就用实拍（meta.assets 里 source:"merchant"），没有就用插画场景 {"source": "drawn", "illust": "<行业>/<名字>", "tag": "示意"}；过程用 steps。商家确有自己小程序/店铺页的真实截图，用 phone 镜头放截图'));
    });
    const hasScene = shots.some((s) => (s?.type === 'photoShot' && Array.isArray(s.params?.media) && s.params.media.length > 0) || s?.type === 'beforeAfter');
    if (!hasScene)
      out.push(F('block', 'shots', `「${industryName}」的核心动作要用照片或插画场景演示，全片没有一镜 photoShot${industry === 'beauty' ? ' / beforeAfter' : ''}`,
        '加一镜 photoShot：有商家实拍用实拍，没有就用插画兜底 {"source": "drawn", "illust": "<行业>/<名字>", "tag": "示意"}'));
  }
  return out;
}
