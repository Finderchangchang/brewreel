# cards · 卡片信息流（默认）

状态：stable。分镜不写 `meta.style` 就是它。渐变底 + 居中卡片 + 描边大字幕，19 个公共镜头，六个行业都能用。`examples/ledger.json` 演示 dataChart 的标题、结论、KPI、图表、旁注、来源到片尾的完整叙事。

| 文件 | 内容 |
|---|---|
| `STYLE.md` / `STYLE.en.md` | 九层规格 |
| `recipes.md` | 叙事模板索引（按行业） |
| `rules.json` | 风格专属规则（cards 的规则在 validate.mjs 主体和 industries/，这里为空） |
| `examples/` | 样例在仓库根目录 `examples/`（含 dataChart 叙事示例） |
| 代码 | `template/src/shots/`、`template/src/core/`，清单 `template/src/styles/cards/style.json` |
