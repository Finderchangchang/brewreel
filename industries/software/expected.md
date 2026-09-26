# 软件行业的预期校验结果

行业规则引擎对软件行业的预期行为（见 `tests/rules/software/*.json`，用 `node scripts/test-rules.mjs software` 跑）：

- `00-compliant.json`：用既有 11 个镜头写的软件宣传片，不触发任何行业规则（block/warn/human 全部为 0）。
- `01-disabled-shot.json`：即使是软件行业，`beforeAfter` 仍然被 `_base` 默认禁用（它是美业专属），命中「software」行业不开放镜头 beforeAfter。
- `02-base-contact.json` / `03-base-medical.json`：`_base/rules.json` 里的通用规则（站外导流 `B-contact`、医疗用语 `B-medical`）对软件行业同样生效，说明"跨行业通用"规则不因为 `meta.industry` 缺省或等于 `software`而被跳过。

`examples/*.json` 三份既有样例过校验时出现的其它提示（如字幕相似度、`meta.action` 相关检查）来自 `scripts/validate.mjs` 主体和 `scripts/lib/text-checks.mjs`，不属于本行业包（`scripts/lib/industry.mjs`）的职责范围。

<!-- round5 -->
## round5 新增检查（对应 tests/rules/software/04–06）
- **核心动作不许用表单顶替**（`coreActionSurface`）：评审原案是聊天助手为了避开样例，把「收到消息 → 分析 → 回复」换成填「情绪标签/危险程度」的 `mockApp kind:"form"`，消息本身从头到尾没出现。现在 meta.action 不是填表类却用 form → 拦；meta.action 是消息/聊天类却没有 `chat`（或 `phone` 真截图）→ 拦；全片没有一镜 chat/phone/mockApp（非表单）→ 拦（`04-form-substitute.json`）。
- **不是聊天产品别演成聊天**：评审原案是专注计时器被演成和「them」的对话。meta.action 不是对话/问答类却用了 `chat` → 拦（`05-chat-non-messaging.json`）。
- **compare 刻度方向**（`compareDirection`）：「麻烦程度」bad 栏高、good 栏低放行；刻度名看不出方向（如「时间」）只提醒（`06-ok-ui-demo-and-compare.json`）。

因为新增了「全片至少一镜界面演示」，`01`–`03` 这类只测单条规则的最小样例会多出一条核心动作拦截，属预期。
