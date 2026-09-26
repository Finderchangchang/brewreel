# 软件产品（software）推荐结构

这是第一阶段就有的行业，`meta.industry` 缺省时按它处理。完整流程和推荐结构已经写在仓库根目录的 `SKILL.md`（第 4 步"挑镜头"）和 `shots.md` 里，这里不重复，只补行业包机制相关的说明。

## 1. 适用范围
App、小工具、AI 产品等软件类产品的宣传短片。

## 2. 推荐结构
见根目录 `SKILL.md` 第 4 步：C 端情感/社交、工具提效、B 端数据/办公三类组合，都用 `hook`/`chat`/`phone`/`mockApp`/`meter`/`compare`/`counter`/`features`/`steps`/`quickList`/`endCard` 这 11 个既有镜头拼。

## 3. 钩子示例
见根目录 `SKILL.md` 里各类型产品的例子和 `examples/*.json`。

## 4. 镜头用法
- `beforeAfter`（美业专属）不能用，其余 7 个新镜头（`photoShot`/`priceCard`/`storeCard`/`reviewCard`/`factSheet`/`credCard`）没有强制禁用，但本阶段没有针对软件行业写专门的文案规则，用之前想清楚是不是真的需要（多数软件宣传片用现成的 11 个镜头就够）。
- 网址/二维码/极限词/字数/断词这些规则都在 `scripts/validate.mjs` 主体，不属于行业包范围。

## 5. 视觉风格
按 `meta.theme` 选主题（见 `SKILL.md` 第 3 步），不属于行业包范围。

## 6. 必备提示语
无行业专属的必备提示语；`_base/rules.json` 的通用规则（站外导流、诱导互动、医疗用语等）仍然适用。

## 7. 最容易犯的 5 个错
见根目录 `SKILL.md`「常见错误与改法」表格。

<!-- round5 -->
## 核心动作要在产品自己的界面里演（校验会拦）
- 至少一镜 `chat` / `phone`（真截图）/ `mockApp` 把 meta.action 演出来；卖点卡、步骤卡不算。
- `mockApp` 的 `kind: "form"` 只给本来就是填表/报名/预约的产品；别的产品拿表单顶替核心动作会被拦（例：聊天助手把「收到消息 → 分析 → 回复」换成填「情绪标签/危险程度」）。
- meta.action 是消息/聊天/回复类，必须有 `chat`（或 `phone` 真截图），让那条消息本身出现在画面上。
- meta.action 不是对话/问答类（如「点开始 → 屏蔽分心应用」），不要用 `chat` 把产品演成和别人聊天，改用 `mockApp` 的 button/done。
- `compare` 两栏写了 `level` 时，`tone: "good"` 那栏在 `meterLabel` 这把尺子上必须更优（「麻烦程度」good 栏更低，「效率」good 栏更高）。
