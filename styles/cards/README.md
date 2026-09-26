# cards · 卡片信息流（默认）

状态：stable。分镜不写 `meta.style` 就是它。渐变底 + 居中卡片 + 描边大字幕，18 个公共镜头，六个行业都能用。

| 文件 | 内容 |
|---|---|
| `STYLE.md` / `STYLE.en.md` | 九层规格 |
| `recipes.md` | 叙事模板索引（按行业） |
| `rules.json` | 风格专属规则（cards 的规则在 validate.mjs 主体和 industries/，这里为空） |
| `examples/` | 样例在仓库根目录 `examples/`（9 份） |
| 代码 | `template/src/shots/`、`template/src/core/`，清单 `template/src/styles/cards/style.json` |