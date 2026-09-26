# quiz · 答题互动

状态：stable（见 `template/src/styles/quiz/style.json`）。先让观众猜错一次，再揭晓为什么。适合有常见误解、能出一道选择题的产品。

![quiz 风格预览](../../docs/images/style-quiz.png)

| 文件 | 内容 |
|---|---|
| `STYLE.md` / `STYLE.en.md` | 九层规格（拆解要点的匿名化版本，含参考片与示范片的逐拍对照） |
| `recipes.md` | 三套叙事模板（外语短语 / 软件功能竞猜 / 餐饮行业竞猜）、每镜拍数、字段和字数、常见错误 |
| `rules.json` | 声明式规则（总时长、镜头数、必有镜头、顺序、次数） |
| `checks.mjs` | 跨字段规则 Q1–Q13（陷阱项 = 钩子误解、错误选项不写数字、关键词是台词子串、释义卡结构……） |
| `examples/` | 5 份样例分镜，都能通过校验并出片 |
| 代码 | `template/src/styles/quiz/`：`style.json`、`tokens.json`、`index.ts`、`film.tsx`（整片渲染器：四种换场 + 整片上下文）、`parts/`（元件）、`shots/`（8 个镜头）、`art/`（角色与小剧场，接口见 `art/README.md`） |

一创（直接用）：照 `recipes.md` 写分镜，`meta.style` 写 `"quiz"`，跑 `node scripts/make.mjs <分镜> --out <仓库外目录>`。

二创（换皮）：改 `tokens.json` 的 `themes`（配色，14 个色名要齐）即可，角色和场景跟着主题色走；分镜里用 `meta.theme` 选主题。换节奏改 `motion` / `rhythm`，换版式改 `layout`。

---

# quiz · Quiz (English)

Status: stable. Let viewers guess wrong once, then reveal why. Fits products with a common misconception that can be framed as a multiple-choice question. Spec: `STYLE.en.md`; story templates and fields: `recipes.md` (Chinese); five sample storyboards in `examples/`. To reskin, edit `themes` in `template/src/styles/quiz/tokens.json`; characters and scenes follow the theme colors.
