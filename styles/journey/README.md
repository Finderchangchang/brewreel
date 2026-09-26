# journey · 角色漫游

状态：skeleton（开发中，校验会拦，负责人自测设 `PROMO_DEV_STYLES=1`）。吉祥物一镜到底穿过插画城市，一个街区一个内容类别。默认 4:5，也支持 9:16。适合内容多、类别清楚的产品。

| 文件 | 内容 |
|---|---|
| `STYLE.md` / `STYLE.en.md` | 九层规格（拆解要点的匿名化版本） |
| `recipes.md` | 叙事模板和每段字段（计划接口） |
| `rules.json` | 声明式规则（草稿）；跨字段规则写 `checks.mjs` |
| `examples/` | 本风格样例分镜（待补） |
| 代码 | `template/src/styles/journey/`：`style.json`、`tokens.json`、`index.ts`、`shots/district.*`（占位） |