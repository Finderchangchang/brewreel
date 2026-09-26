# quiz · 答题互动

状态：stable（见 `template/src/styles/quiz/style.json`）。先让观众猜错一次，再揭晓为什么。适合有常见误解、能出一道选择题的产品。

皮肤（v0.2.1 起）：「批改纸」——点阵答题纸底、深色主色 + 杏黄马克笔 + 朱红批改笔；存疑的理解被红笔圈起来，答案在答题卡上揭晓，释义是压在桌面上的词条卡，懂了就盖章。和参考片的逐条区别见 `originality.md`。

![quiz 风格预览](../../docs/images/style-quiz.png)

| 文件 | 内容 |
|---|---|
| `STYLE.md` / `STYLE.en.md` | 九层规格（骨架来自拆解，皮肤是我们自己的） |
| `originality.md` | 原创性记录：保留的骨架、逐条替换的皮肤、配色色差（CIEDE2000） |
| `recipes.md` | 三套叙事模板（外语短语 / 软件功能竞猜 / 餐饮行业竞猜）、三套口吻、每镜拍数、字段和字数、常见错误 |
| `rules.json` | 声明式规则（总时长、镜头数、必有镜头、顺序、次数） |
| `checks.mjs` | 跨字段规则 Q1–Q14（陷阱项 = 钩子误解、错误选项不写数字、关键词是台词子串、释义卡结构、套话提醒……） |
| `examples/` | 5 份样例分镜，都能通过校验并出片（覆盖三套配色、三套口吻） |
| 代码 | `template/src/styles/quiz/`：`style.json`、`tokens.json`、`index.ts`、`film.tsx`（整片渲染器：四种换场 + 整片上下文）、`parts/`（元件与纸面背景）、`shots/`（8 个镜头）、`art/`（角色与小剧场，接口见 `art/README.md`） |

一创（直接用）：照 `recipes.md` 写分镜，`meta.style` 写 `"quiz"`，跑 `node scripts/make.mjs <分镜> --out <仓库外目录>`。

二创（换皮）：改 `tokens.json` 的 `themes`（配色，色名要齐：bg / card / cardAlt / ink / primary / onPrimary / onPrimaryMuted / highlight / pen / wrong / cross / ground / skin / subBar / grid）和 `voices`（固定句式）即可，描边、底色、卡片跟着主题走，角色衣服用固定的角色色板（想换就在主题里加 `castWarm` / `castDeep` / `castLight` / `castSand` / `castGlow`）；分镜里用 `meta.theme` 选主题、`phraseTitle.voice` 选口吻。换节奏改 `motion` / `rhythm`，换版式改 `layout`。改完跑 `node scripts/check-originality.mjs --style quiz --ref <仓库外参考 tokens.json>`。

---

# quiz · Quiz (English)

Status: stable. Let viewers guess wrong once, then reveal why. Fits products with a common misconception that can be framed as a multiple-choice question. Skin since v0.2.1: "graded paper" (dot-grid paper, a dark primary, an amber marker and a vermilion grading pen). Spec: `STYLE.en.md`; originality record: `originality.md` (Chinese); story templates, voices and fields: `recipes.md` (Chinese); five sample storyboards in `examples/`. To reskin, edit `themes` and `voices` in `template/src/styles/quiz/tokens.json`; outlines, backgrounds and cards follow the theme, while the characters wear a fixed palette (add `castWarm` / `castDeep` / `castLight` / `castSand` / `castGlow` to a theme to redress them).
