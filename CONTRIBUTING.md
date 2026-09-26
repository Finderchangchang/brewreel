# 参与贡献

English: [CONTRIBUTING.en.md](CONTRIBUTING.en.md)

这个项目的核心是**风格包**：一种视觉风格 = 设计令牌 + 一组镜头组件 + 校验规则 + 叙事模板。便宜模型只写分镜 JSON，风格包负责好看和不出错。欢迎三种层次的参与：

| 层次 | 你做什么 | 要改的东西 |
|---|---|---|
| **一创：直接用** | 用现有风格给自己的产品出片 | 什么都不改，照 `SKILL.md` 写分镜 |
| **二创：换皮** | 复制一个风格包，换配色、字体、角色、节奏，做成自己的变体 | 新风格文件夹里的 `tokens.json`、角色组件、`STYLE.md` |
| **三创：新风格** | 按统一模板拆一支参考视频，蒸馏成一个全新的风格 | 两个新文件夹 + 一行命令注册，流程见 `distill/` |

## 风格包长什么样

```
styles/<id>/                       给人和模型看
  STYLE.md / STYLE.en.md           九层规格（基本参数、叙事、视觉、镜头、动效、元件、声音、可变/不变、规则）
  recipes.md                       叙事模板：每拍放什么镜头、模型要填哪些字段
  rules.json                       声明式规则（时长、镜头数、必有镜头、顺序、次数上限）
  checks.mjs                       可选：写不成声明式的跨字段规则
  examples/                        这个风格的样例分镜（都要能通过校验并出片）
  README.md                        一段简介（可以直接贴进主 README）
template/src/styles/<id>/          代码
  style.json                       清单：状态、默认画幅、支持的画幅、节拍、第一镜/最后一镜、可复用的公共镜头、配色名
  tokens.json                      设计令牌：色板、字体、字号层级、间距、动效预设、节奏
  index.ts                         export default defineStyle({...})，可选 Film / Background / Overlay
  shots/<type>.tsx + .spec.json    专属镜头（组件 + 规格，规格同时给校验用）
```

分镜里写 `"meta": {"style": "<id>", "aspect": "9:16" | "4:5"}` 就用这个风格；不写就是默认的 `cards`。

## 二创：复制一个风格换皮

1. `node scripts/gen-styles.mjs --new <新id> --name 中文名 --name-en EnglishName` 生成空白风格（status: draft）。
2. 把源风格 `template/src/styles/<源>/` 里要沿用的镜头和 `tokens.json` 复制过来，改令牌：颜色、字体、字号、动效时长。组件里只从 `useStyleTokens()` / `useStylePalette()` 取值，不写死。
3. 角色和场景要**自己画**（SVG / CSS），不要描摹别人的角色。
4. `STYLE.md` 写清和源风格差在哪、适合什么产品。
5. 按下面的「PR 自查清单」过一遍。

## 三创：从一支参考视频蒸馏一个新风格

完整流程和可复用提示词在 [`distill/`](distill/README.md)：拆解 → 老师示范复刻 → 组件化 → 便宜模型测试 → 评审修复。步骤概要：

1. **拆解**：`node scripts/extract-frames.mjs <参考视频> --out <仓库外目录> --audio` 抽帧、出总览、找切点，按 `distill/prompts/01-breakdown.md` 写九层拆解（原稿放仓库外）。
2. **建骨架**：`node scripts/gen-styles.mjs --new <id>`，把拆解的**匿名化**要点写进 `styles/<id>/STYLE.md`，数值写进 `tokens.json`。
3. **实现镜头**：每个元件一个 `shots/<type>.tsx + .spec.json`；一镜到底的风格写 `Film`。每加一个镜头跑一次 `node scripts/gen-styles.mjs`。
4. **写规则**：`rules.json` + `checks.mjs`，把拆解第 9 层能校验的都写进去。
5. **便宜模型测试**：让一个能力一般的模型只读 `SKILL.md` + 你的 `STYLE.md` / `recipes.md` 写分镜，出片，看它在哪里写错，回头改规则和说明。
6. **评审修复**：按 `distill/prompts/04-review.md` 找人（或另一个模型）对照参考片评审。
7. 自测通过后把 `style.json` 的 `status` 改成 `stable`。

## 版权与隐私（硬规定）

- 参考视频、它的截图和抽帧、角色、品牌名、网址、影视片段**一律不进仓库**。拆解原稿和参考帧放仓库外。
- 文档里只写「参考了一支 X 类短视频」，不写对方品牌名；对方的品牌资产（角色造型、名字、口号、logo、具体数字）在 `STYLE.md` 的「必须避开」一节列出并写明我们的替代做法。
- 仓库里不许出现本机路径、内部产品名、API key。
- 新增字体要是 OFL 等允许再分发的许可，并补进 `THIRD_PARTY_LICENSES.md`。

## PR 自查清单

- [ ] `node scripts/privacy-scan.mjs` 通过（不含本机路径、key、黑名单词）
- [ ] 不含他人的品牌、角色、影视片段、参考视频帧；角色和场景是自己画的
- [ ] `node scripts/gen-styles.mjs --check` 通过（注册表最新，清单/令牌/镜头对得上）
- [ ] `cd template && npx tsc -p .` 零错误
- [ ] `node scripts/validate.mjs --specs`、`node scripts/test-validate.mjs`、`node scripts/test-rules.mjs` 全绿
- [ ] `examples/` 下 9 份样例仍全部通过校验（改了公共代码时，至少出一支 cards 片证明没坏）
- [ ] 新风格：`styles/<id>/examples/` 至少一份分镜能出片，第 0 帧有内容和钩子，字号不低于 正文 40 / 面板 34 / 最小 26px，关键内容在安全区内（`template/src/core/aspects.json`）
- [ ] 中英文档都有：`STYLE.md` + `STYLE.en.md`，改了 `SKILL.md` 就同步 `SKILL.en.md`
- [ ] 测试和渲染产物没有提交（`make.mjs --out` 指向仓库外）

## 其他贡献

- **新行业**：见 README 的「行业包：怎么新增一个行业」。
- **公共镜头**：见 `template/SHOT_API.md`；公共镜头只按 9:16 设计，cards 风格和声明了 `commonShots` 的风格会用到它。
- **bug / 建议**：开 issue，附上分镜 JSON 和 `report.txt`。

作者：柳伟杰 / Liu Weijie（Finderchangchang）。项目以 Apache-2.0 许可发布，贡献即表示同意以同一许可发布你的改动。
