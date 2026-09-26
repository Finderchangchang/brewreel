# 提示词 03：组件化成风格包

---

读 `breakdown.md`、上一步的「关键要素清单」和示范代码，读仓库的 `CONTRIBUTING.md`、`template/SHOT_API.md`、`template/src/styles/types.ts`、`scripts/lib/styles.mjs`。把示范片拆成便宜模型能驱动的风格包。

1. **令牌**：`template/src/styles/<id>/tokens.json` 收齐色板（含多套配色）、字体、字号层级、间距、动效预设、节奏。组件里不写死任何颜色、字号、时长。
2. **镜头**：拆解第 6 层的每个元件对应一个镜头或 Film 里的一个部件；每个镜头 `shots/<type>.tsx + <type>.spec.json`，spec 写清 purpose、tips、时长范围、字段、字数上限、音效、example。加完跑 `node scripts/gen-styles.mjs`。
3. **画幅**：所有位置用 `useGeometry()` 取安全区；声明支持的画幅（`style.json` 的 `aspects`），每个画幅都出帧自查。
4. **规则**：拆解第 9 层能校验的全写进 `styles/<id>/rules.json`（声明式）和 `checks.mjs`（跨字段），报错格式「哪里 / 什么问题 / 怎么改」，写给能力一般的模型看。
5. **文档**：`STYLE.md` / `STYLE.en.md` 按九层写（匿名化，数值与实现一致）；`recipes.md` 写叙事模板和每拍字段；`examples/` 放 2–3 份能出片的样例分镜。
6. **自检**：`node scripts/gen-styles.mjs --check`、`cd template && npx tsc -p .`、`node scripts/validate.mjs --specs`、`node scripts/test-validate.mjs`、`node scripts/test-rules.mjs`；样例全部出片；`node scripts/privacy-scan.mjs`。

交付：改动的文件清单、样例成片路径、自检结果、还没做完的地方。