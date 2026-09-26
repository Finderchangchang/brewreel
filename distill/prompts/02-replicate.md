# 提示词 02：老师示范复刻

---

读 `<仓库外路径>/breakdown.md`（拆解）和仓库里的 `CONTRIBUTING.md`、`template/src/styles/types.ts`、`styles/_template/`。先不做组件化，你的任务是**手写一支 20–30 秒的示范片**，验证拆解里哪些东西真正决定观感。

要求：
1. 用 `node scripts/gen-styles.mjs --new <id>` 建一个 draft 风格，示范代码写在它的 `shots/` 或 `Film` 里；可以先写死数值，但颜色、字号、时长统一放进 `tokens.json`。
2. 素材全部自己画（SVG / CSS）或用仓库已有的插画；产品和文案用虚构的。不许用参考片的截图、角色、配色组合、品牌元素。拆解里「必须避开」的每一项都要有替代。
3. 用 ShotLab 出关键帧自查（`template/SHOT_API.md` 第 9 节；新风格加 `"style":"<id>"`），环境变量 `PROMO_DEV_STYLES=1` 下用 `node scripts/make.mjs <分镜> --out <仓库外目录>` 出整片。
4. 和参考片的关键帧并排看，逐层写差距：哪些差距是关键（观众一眼能看出），哪些无所谓。

交付：示范片路径（make 最后一行「交付：」）、并排对比图（放仓库外）、一份「关键要素清单」（按重要性排序，每条写清楚是令牌、组件还是规则能管住的）。