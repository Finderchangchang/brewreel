// 风格专属的跨字段检查（可选）。validate.mjs 在行业规则之后调用 run()。
// 返回 {errors, warnings, human}，每条 {where, problem, fix}：where 用 ctx.where(镜号从 0 起, 类型, 字段) 生成，
// problem 说哪里不对，fix 说怎么改（写给能力一般的模型看，要能照做）。
export function run(storyboard, ctx) {
  const errors = [];
  const warnings = [];
  const human = [];
  // 例：某个镜头的 A 字段必须等于另一个镜头的 B 字段
  // const shots = storyboard.shots ?? [];
  // const i = shots.findIndex((s) => s?.type === 'someShot');
  // if (i >= 0 && ...) errors.push({where: ctx.where(i, 'someShot', 'params.x'), problem: '…', fix: '…'});
  return {errors, warnings, human};
}