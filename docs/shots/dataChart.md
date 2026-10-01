# dataChart 数据叙事卡

**一镜组织一段数据论证**：标题交代指标范围，核心结论先说人话，KPI 给出关键读数，图表展开证据，旁注补口径，底部标出来源。常见顺序是 hook 提问 → dataChart 回答 → 产品镜头解释如何做到 → endCard 收束品牌和行动号召。

```json
{"type":"dataChart", "dur":4, "caption":"账本数据摊开，\n{看清支出分布}", "mood":0.35,
 "params":{"title":"示例账本条目", "takeaway":"外卖示例金额为 ¥860", "chartType":"donut",
   "kpis":[{"label":"外卖支出","value":"¥860"},{"label":"预算使用","value":"62%"}],
   "data":[{"label":"外卖","value":860,"focus":true},{"label":"奶茶咖啡","value":326},{"label":"自动续费","value":98},{"label":"深夜打车","value":410}],
   "unit":"元", "annotations":["虚构账本示例，仅演示图表排版"], "refs":["f1","f2"]}}
```

完整可校验的演示在 `examples/ledger.json`。示例数据必须标 `meta.demoData: true`、在 `meta.disclaimer` 说明“演示/示例”，并引用相应 fact；真实内容必须引用简报中的真实来源。图表数值必须能在所引用的 fact 原文中找到。不要把推算总数写成来源原值。

## 图形怎么选

- `bar`：比较类别或排名；标签短、排序明确。
- `line`：看时间趋势；按时间顺序排列。
- `dot`：用统一的横向数值刻度比较离散类别，行尾直接显示读数。
- `stacked`：看类别构成；同一类别写多条 data，并用 `series` 区分组成部分。每条归一化为 100%，段内显示原始数值，不用于比较总量。
- `donut`：看整体中的占比，类别控制在 5 个以内。

每镜最多 6 条数据、3 个 KPI、2 条旁注。标题最多 16 字，结论最多 28 字。data 结构是 `{label,value,series?}`；堆叠图的相同 label 组成一条堆叠条。单位写在 `unit`，自定义上限写 `max`。

## 设计规范

新增鲜活主题 `citrus-pop`、`coral-pop`、`cobalt-pop`、`mint-pop`、`lilac-pop`、`apricot-pop` 自带图表色板。不写 `palette` 时使用主题系列色，显式填写 `palette` 时使用指定色板；品牌色仍覆盖重点项。卡外标题以白色为主，卡内使用蓝灰正文与明亮数字强调色。

卡片优先展示核心结论：范围标题 30 px，结论 44 px，KPI 数字 52 px，标签与来源 28–30 px。折线图提供零点、中点和上限刻度；点图从零点比较各类别。相同系列在所有数据段和图例中保持同色，`focus` 位于某系列时突出整个系列，避免单段换色造成歧义。环图中心显示重点类别及其占比；没有 `focus` 时选择最大类别。

图表用稳定纸面卡承载，避免随 `mood` 改变读数的颜色。默认 `micro` 色板取自项目提供的 MicroPalettes 色卡：墨蓝、莓紫、雾蓝与灰紫，整体压低饱和度，并以细留白分隔环图扇区。`palette` 还可选 `mono`（灰墨）、`porcelain`（单色阶）、`palm`（低饱和绿黄与琥珀重点）、`wire`（灰阶配单橙重点）。将需要突出的数据行标记 `focus: true`，重点项使用焦点色；设置 `meta.brandColor` 时，重点项改用品牌强调色。其他颜色只区分系列，不承担 good/warn/bad 的语义；情绪渐变与字幕强调色仍由主题系统管理。

来源由 `refs` 中 1–2 个 fact ID 找到 `meta.facts[].source`，自动显示在卡片底部。旁注用来说明统计口径或读图限制，不能替来源背书。图表负责解释数据；片尾仍用 `endCard` 展示品牌、口号和 CTA。
