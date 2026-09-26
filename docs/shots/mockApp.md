# mockApp 模拟产品界面

**最小可用写法**（照抄改字即可通过校验）：
```json
{"type": "mockApp", "dur": 4, "caption": "写下本周要点，\n{初稿就出来}",
 "params": {"kind": "editor", "title": "写周报", "input": "本周做了什么", "button": "生成", "items": [{"text": "完成首页改版"}, {"text": "修复登录问题"}], "done": "已生成"}}
```

没有截图时用它：画一个中性配色、看起来像真产品的 App 界面，并让它「动起来演一遍」。全部由参数决定，不用画图。

四种界面（`kind`）：
| kind | 画面里发生什么 | 适合讲 |
|---|---|---|
| dashboard | 大数字从 0 滚上去 → 折线/柱子长出来 → 指标一行行出现 → 点中高亮的一行 | 数据、统计、监控、报表 |
| list | （可选）搜索框打字 → 条目一行行出现，带状态标签 → 点中高亮的一行 | 订单、任务、客户、消息管理 |
| editor | （可选）输入框打出一句需求 → 点「生成」→ 文字一行行写出来 → 高亮一行 → 弹「已生成」 | AI 写作、自动生成、笔记 |
| form | 表单逐项自动填好（打勾）→ 点提交 → 按钮变绿成功 | 预约、下单、报名、登记 |

## 什么时候用
- 产品还没截图，或截图太乱、有隐私信息。
- 想演示「操作过程」而不只是结果。

## 什么时候别用
- 有好看的真截图：用 phone，更可信。
- 要讲聊天对话：用 chat。
- 只想亮一个大数字：用 counter。

## 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| kind | 是 | `dashboard` / `list` / `editor` / `form` |
| title | 是 | 顶栏页面名，**≤10 字**，如「今日概览」。写自己产品里的页面名，不写第三方 App 名 |
| items | 看 kind | 0–5 行，每行 `{icon?, text, value?, tone?}`，见下表 |
| items[].text | 是 | **≤10 字** |
| items[].value | 否 | **≤6 字**（数字、拉丁字母算半个） |
| items[].tone | 否 | value 的颜色：`good` 绿 / `warn` 橙 / `bad` 红 / `neutral` 灰 |
| items[].icon | 否 | 行首图标，从图标清单选（如 trend clock alert money user doc calendar users check） |
| highlight | 否 | 被点中高亮的行号，**从 0 数**，0–4 |
| stat | dashboard 建议写 | `{value ≤6, label ≤8}`，如 `{"value": "1,286", "label": "今日新增订单"}`，数字部分会滚动 |
| series | 否 | dashboard 图表数据，2–12 个数，5–8 个最好看 |
| chart | 否 | dashboard 图表：`line` 折线（默认）/ `bar` 柱状 |
| input | 否 | **≤12 字**。editor：输入框里的需求；list：搜索框里的词 |
| button | 否 | **≤4 字**，主按钮，如「生成」「提交」「新建」 |
| done | 否 | **≤6 字**，editor/form 完成后的提示，如「已生成」「预约成功」 |

各 kind 的 items 怎么写：
- dashboard：2–3 行指标，text 写指标名，value 写数值（只显示前 3 行）。highlight 点中要强调的那一行（如异常）。
- list：3–5 行，text 写条目名，value 写状态标签（**≤4 字最好看**，如「待处理」「已发货」）。
- editor：3–5 行，是「生成出来的文字」，第 1 行会当标题加粗。highlight 让某一行被荧光笔划出来。
- form：2–5 项，text 写字段名，value 写填进去的内容。

## 时长
dashboard 3.5–4 秒；list 3.5–4 秒；editor 4.5–5 秒（有 input 时）；form 3–4 秒。给短了会整体加速。

## 例子
```json
{"type": "mockApp", "dur": 4, "caption": "数据一目了然，\n{异常自动标红}", "mood": 0.3,
 "params": {"kind": "dashboard", "title": "今日概览",
   "stat": {"value": "1,286", "label": "今日新增订单"}, "series": [32, 41, 38, 52, 49, 63, 78],
   "items": [{"icon": "trend", "text": "转化率", "value": "+12%", "tone": "good"},
             {"icon": "alert", "text": "待处理投诉", "value": "2 条", "tone": "bad"}],
   "highlight": 1}}
```
```json
{"type": "mockApp", "dur": 5, "caption": "一句话需求，\n{文案直接出来}", "mood": 0.1,
 "params": {"kind": "editor", "title": "新建文档", "input": "写一段新品上市文案", "button": "生成",
   "items": [{"text": "新品上市｜轻盈一整天"}, {"text": "重量只有 180 克"}, {"text": "续航提升到 12 小时"}],
   "highlight": 1, "done": "已生成"}}
```
```json
{"type": "mockApp", "dur": 4, "caption": "几百条订单，\n{一搜就到}", "mood": 0.5,
 "params": {"kind": "list", "title": "订单列表", "input": "退款",
   "items": [{"icon": "money", "text": "退款申请 #2931", "value": "待处理", "tone": "warn"},
             {"icon": "user", "text": "王先生的订单", "value": "已发货", "tone": "good"},
             {"icon": "alert", "text": "投诉：配送超时", "value": "紧急", "tone": "bad"}],
   "highlight": 0}}
```
```json
{"type": "mockApp", "dur": 3.5, "caption": "顾客预约，\n{30 秒填完}", "mood": 0,
 "params": {"kind": "form", "title": "预约到店", "button": "提交", "done": "预约成功",
   "items": [{"icon": "user", "text": "姓名", "value": "李女士"}, {"icon": "calendar", "text": "到店时间", "value": "周六下午"}, {"icon": "users", "text": "人数", "value": "2 人"}]}}
```
