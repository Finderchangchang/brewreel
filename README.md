# promo-video-skill

[English version → README.en.md](README.en.md)

作者：**柳伟杰**（GitHub [@Finderchangchang](https://github.com/Finderchangchang)）。转载、二次开发或商用请保留 `LICENSE` 与 `NOTICE` 并注明出处。

> **早期预览版**：测试和修复仍在进行中，欢迎提 issue 反馈误伤规则、渲染问题和体验建议。

一句话：给 AI 编程助手（Claude Code / Codex / opencode…）用的 skill，把「写分镜 → 出竖版宣传短片」这件事标准化——便宜模型只写一份 `storyboard.json`，固定的 Remotion 组件负责画面，校验脚本拦硬性规则和行业合规红线，一条命令出片（1080×1920，带原创配乐和音效）。

## 30 秒看懂

1. 你（或 AI）把商家简报整理成 `storyboard.json`（挑镜头、填文字，不写代码、不写坐标）。
2. `node scripts/validate.mjs storyboard.json` 校验：硬性规则和《广告法》/行业合规红线会被拦下并给出中文报告。
3. `node scripts/make.mjs storyboard.json --out <目录>` 一条命令出片：配乐 → 渲染 → 拼图 → 检查帧，全自动。

## 效果示例

每张图左边是第 0 帧封面，右边是片中一帧；分镜都在 `examples/` 里，产品和数据都是虚构的，每份都能直接通过校验并用 `make.mjs` 出片。

| 软件 · 情感聊天（jev） | 软件 · 记账工具（ledger） | 软件 · 会议纪要（meeting） |
| --- | --- | --- |
| ![jev](docs/images/jev.png) | ![ledger](docs/images/ledger.png) | ![meeting](docs/images/meeting.png) |
| **英文字幕（en-focus）** | **餐饮上新（food）** | **电商实物（ecommerce）** |
| ![en-focus](docs/images/en-focus.png) | ![food](docs/images/food.png) | ![ecommerce](docs/images/ecommerce.png) |
| **教培课程（education）** | **美业，无实拍照片（beauty）** | **文旅住宿（travel）** |
| ![education](docs/images/education.png) | ![beauty](docs/images/beauty.png) | ![travel](docs/images/travel.png) |

## 能做什么、不做什么

**能做**：软件产品、餐饮、电商实物、成人职业培训、美业（生活美容）、文旅住宿六个行业的竖版宣传短片；中文或英文字幕；11 个通用镜头 + 7 个行业镜头（实拍/价目表/门店卡/评价/前后对比/参数表/资历卡）；内置广告法极限词、行业合规红线、断词换行、安全区等几十条自动校验。

**不做**（这些品类校验规则里没有覆盖，硬要做也不保证合规）：
- 医疗美容、处方药/药品、K12 学科培训、保健品功效宣称、烟草
- 不生成"看起来像真实拍摄"的拟真实物图片——没有真实素材时，画面会用简笔插画兜底并明确标注，不冒充实拍

## 支持的行业与语言

| `meta.industry` | 说明 |
| --- | --- |
| `software`（默认） | App / SaaS / 工具类产品 |
| `food` | 餐饮、门店、单品上新 |
| `ecommerce` | 电商实物商品 |
| `education` | 成人职业培训（不含 K12） |
| `beauty` | 生活美容（不含医美） |
| `travel` | 文旅、住宿、民宿 |

`meta.lang`：`zh`（默认，中文字幕）/ `en`（英文字幕）。

## 安装

### 环境要求

| 项目 | 要求 |
| --- | --- |
| Node.js | ≥ 18（建议 20 LTS 或更高；本仓库在 Node 22 上测试过） |
| Python | 3.10+（配乐脚本用，`numpy`/`scipy`） |
| 操作系统 | Windows（仅 x64）/ macOS ≥ 15 / Linux（glibc ≥ 2.35，需要 `libnss3`/`libgbm`/`libasound2` 等共享库；不支持 Alpine、nixOS） |

### 三条命令

```bash
git clone https://github.com/Finderchangchang/promo-video-skill.git
cd promo-video-skill/template && npm install && npx remotion browser ensure
cd .. && node scripts/validate.mjs examples/ledger.json
```

第一条命令下载渲染引擎依赖（含 7 个平台的 Remotion compositor，选装但保留在 lock 文件里方便切平台）；第二条会额外下载一次 Chrome Headless Shell（约 110MB，供无头渲染用）；第三条跑一遍自带的示例分镜，校验通过就说明装好了。

也可以作为 skill 装进你的 AI 编程助手（如果它支持 skill 管理器）：手动把整个仓库 clone 到 `~/.claude/skills/promo-video-skill/`（Claude Code）或 `~/.agents/skills/promo-video-skill/`（通用约定），或用你工具自带的 skill 安装命令指向本仓库地址。

## 工作流

```
简报（brief）
  → 分镜 storyboard.json（挑镜头、填文字）
  → node scripts/validate.mjs（硬性规则 + 行业合规，报告拦下要改的地方）
  → node scripts/make.mjs（配乐 → 渲染 → 拼图 → 检查帧）
  → 发布前人工自查清单（SKILL.md 的「发布前自查清单」一节）
```

详细流程和每个字段的用法看 `SKILL.md`（AI 助手照着这份文档写分镜）；`shots.md` 是 18 个镜头的参数总表；`docs/shots/*.md` 是每个镜头的详细文档。

## 用便宜模型跑（DeepSeek 示例）

`scripts/llm_make.py` 是一个不需要 agent、直接调 OpenAI 兼容接口的无头脚本：简报进、视频出，校验报错会自动回喂给模型重试。

```bash
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic   # 仅当把 DeepSeek 接到 Claude Code 时需要
export ANTHROPIC_AUTH_TOKEN=<你的 DeepSeek API Key>
export ANTHROPIC_MODEL=deepseek-flash[1m]

# 或者直接用无头脚本，不接 Claude Code：
export LLM_API_KEY=<你的 DeepSeek API Key>
export LLM_BASE_URL=https://api.deepseek.com
export LLM_MODEL=deepseek-chat
python scripts/llm_make.py path/to/brief.md
```

Windows PowerShell 用 `$env:LLM_API_KEY="..."` 代替 `export`。以上环境变量只是占位符示例，请替换成你自己的 key；不要把 key 提交进仓库或写进 issue。也可以把这些变量写进 AI 编程助手自己的全局配置（如 `~/.claude/settings.json`），但这是可选做法，本仓库不会替你改任何全局配置。

## 风格

分镜里写 `meta.style` 选视觉风格，不写就是默认的 `cards`。每个风格是一个「风格包」：自带设计令牌、镜头组件、校验规则和叙事模板，文档、规则、样例放在 `styles/<id>/`，代码放在 `template/src/styles/<id>/`。

**`cards` 卡片信息流**（默认，可用，9:16）：渐变底 + 居中白卡片 + 描边大字幕，一镜讲一件事。适合单一卖点、讲使用流程、演示界面、实物和门店。18 个镜头、六个行业的样例都在 `examples/`。

![cards 风格预览](docs/images/style-cards.png)

**`quiz` 答题互动**（可用，9:16）：米白底、蓝 + 荧光绿、左对齐粗黑体、扁平插画小人。节奏是「抛出一个常见误解 → 出一道 A/B/C 选择题、倒数 3 → 揭晓打勾 → 满屏释义卡（≠ 旧理解 / = 正确意思）→ 小剧场演一遍 → 评论区互动」。适合有常见误解、能出一道选择题的产品：一句外语的真正意思、软件里一个常被误会的功能（如「归档 = 删掉了？」）、一道菜为什么要这么做。说明见 [`styles/quiz/`](styles/quiz/README.md)，写法和字数见 `styles/quiz/recipes.md`，5 份样例分镜在 `styles/quiz/examples/`。

![quiz 风格预览](docs/images/style-quiz.png)

**`journey` 角色漫游**（可用，默认 4:5，也支持 9:16）：原创吉祥物「橘团」踩悬浮滑板，一镜到底横穿一座扁平插画城市；一个街区一个内容类别，头顶广告牌弹出代表内容，背景三选一（现代城市 / 低层街巷 / 古城的白墙黛瓦和石桥河道），14 种街区按内容挑（资料、发布、工坊、摄影、数据、夜景、手机、住家、咖啡、集市、城门、石桥、茶馆、灯会），每站一个笑点，天色从白天走到夜晚，片尾整座城市缩进产品界面、落到品牌卡和数据卡。适合内容多、类别清楚的产品：内容平台的栏目、软件的功能、一条游线的景点。说明见 [`styles/journey/`](styles/journey/README.md)，写法和字数见 `styles/journey/recipes.md`，3 份样例分镜在 `styles/journey/examples/`。

![journey 风格预览](docs/images/style-journey.png)

**怎么选 `meta.style`**：
- 产品有一个大家常理解错的点，能写成「你猜 X 是什么意思？」且有唯一正确答案 → `quiz`。
- 产品有 4–6 个清楚的类别 / 功能 / 站点，想一口气逛一遍 → `journey`。
- 其余情况（讲卖点、讲流程、演示界面、门店和实物、价目表）→ `cards`，也就是不写。
- `quiz` 只接受 9:16；它的专属镜头（出题、揭晓、释义卡等）只能在 `quiz` 里用，和 `cards` 的 18 个镜头不混用，写错会被校验拦下。

```json
{ "meta": { "style": "quiz", "industry": "software", "lang": "zh" }, "shots": [ ... ] }
```

## 如何贡献新风格：二创与三创

- **一创**：直接用现有风格出片。
- **二创（换皮）**：`node scripts/gen-styles.mjs --new <id>` 从脚手架生成一个新风格，把源风格要沿用的镜头和 `tokens.json` 复制过来，换配色、字体、角色，做成自己的变体。只换配色的话，改 `tokens.json` 的 `themes` 就行。
- **三创（蒸馏）**：按 [`distill/`](distill/README.md) 的统一流程拆一支参考视频：`scripts/extract-frames.mjs` 抽帧、找切点 → 九层拆解 → 复刻 → 组件化 → 便宜模型测试 → 评审修复，蒸馏成一个新风格。`distill/prompts/` 里有每一步可直接用的提示词，`styles/_template/` 是新风格的空白模板。`quiz` 和 `journey` 就是这样做出来的，分别参考了一支答题互动类短视频和一支角色漫游类短视频。

参考视频和它的截图、抽帧、角色、品牌名、网址、影视片段一律不进仓库；拆解原稿放在仓库外，仓库里只放自己写的拆解文字、自己画的角色和场景、自己写的示例内容。步骤和 PR 自查清单见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 行业包：怎么新增一个行业

每个行业是 `industries/<id>/` 下的一套文件：

```
industries/<id>/
  rules.json           合规规则（enabledShots、checks、mediaPolicy 等，和 industries/_base/rules.json 合并）
  recipe.md             推荐的镜头结构、写作要点（AI 助手写分镜前必读）
  recipe.en.md           英文版
  brief-template.md      给商家的简报模板
  brief-template.en.md   英文版
  test-brief.md          一份完整测试简报
  expected.md            这份测试简报应该触发哪些规则（回归测试用）
```

新增行业：复制一份现有行业目录改名，参照 `industries/_base/rules.json` 的字段说明填 `rules.json`，写 `recipe.md` 说清楚这个行业该用哪些镜头、常见合规红线，再写一份 `test-brief.md` + `expected.md` 跑 `node scripts/test-rules.mjs` 验证规则生效。

## 校验规则说明和免责声明

`scripts/validate.mjs` 里的规则整理自公开的《广告法》极限词清单和各平台公开规则，分三档：
- **错误（block）**：必须改，否则 `make.mjs` 拒绝出片
- **警告（warn）**：建议改，不强制拦截
- **人工复核（human）**：机器判断不了（比如"照片是否真的授权""评价是否真实"），出片后列成清单给发布者自己确认

**这些规则只是辅助自查，不构成法律意见，也不保证覆盖所有平台的最新规则。** 内容是否合规，以监管部门和平台当时的最新规定为准，责任由发布者自行承担。已知的规则边界和未核实事项见 `docs/dev/`（本仓库不含开发笔记目录本身，欢迎在 issue 里反馈你实测到的误伤或漏拦）。

## 测试状态 / 已知限制

这是早期预览版，**目前还不建议把成片不经人工修改直接对外发布**。

**测试方法**：前几轮用 DeepSeek 级别的便宜模型批量写分镜。最近一轮（本版发布前）换成 Claude Haiku 级别的小模型扮演「便宜模型」：只给它简报和 `SKILL.md`，让它从零写分镜、跑校验、出片，共 9 支。其中软件 / 工具类 4 支（聊天辅助 App、公众号文章发布工具、数据问答类工具、英文字幕的专注计时器），行业片 5 支（餐饮、电商、教培、美业、文旅各一支）。全程**没有商家实拍照片**，画面靠组件和插画兜底。成片由人逐帧看，按 10 分制给「整体」和「合规」两项打分，并逐条核对分镜和简报。

**这一轮的结果**：9 支里没有一支达到 7 分（我们定的「可以直接发」的线）。
- 软件 / 工具类：整体 5–6 分，合规 7–8 分。功能演示最完整的一支是 6 分：聊天 → 分析 → 候选回复 → 填入。
- 行业片：整体 4–5 分，合规 4–5 分。失分主要在跨字段的事实问题上，见下面第 1、3 条。
- 上一轮的硬伤这轮基本没再出现：英文片画面里没有汉字（94 个抽查帧），速度类说法被拦住，同一张图不能再当前后对比，价目表组件不再漏画条目，路线标注带上了目的地，版式自查有 ✗ 的片子会被拒绝交付。
- 交付：9 支里模型自己交出成片的有 5 支。2 支在渲染排队时模型就提前结束了，1 支渲染到一半被中断，1 支被 `make.mjs` 的一个 bug 挡住（传了 `--brief` 时误把文件路径当简报原文，导致数字全部报「简报里找不到」）。这个 bug 在本版已修；本版还加了两条：`--out` 指向仓库内部时 make 直接拒绝，`SKILL.md` 要求模型看到「交付：」那一行才能收工。

**quiz 风格的测试**（本版新增）：让便宜模型只读 `SKILL.md` 和 `styles/quiz/` 的文档，从零写了 3 支分镜并出片：外语短语、软件功能竞猜、餐饮竞猜。人工按 10 分制给「风格」（像不像这个风格）和「整体」打分，修复前的结果：

| 分镜 | 风格 | 整体 |
|---|---|---|
| 外语短语（phrase） | 7 | 6 |
| 软件功能竞猜（app-feature） | 6 | 4 |
| 餐饮竞猜（food-guess） | 6 | 4 |

质检评审列了 10 条问题，第 1–9 条都改了，第 10 条只做了一部分。主要改动：
- **出题前剧透**：新加校验 Q10，钩子语境句、影视片段每句台词、答题卡里的字幕条，都不许出现正确选项、释义卡 = 行里的内容和其中的数字。用这 3 支分镜回测，3 支都会被拦下。
- **答题卡字幕条**：默认只放片段最后一句里含关键词的那半句，也可以用 `quizLine` 自己写（≤12 字，不许含答案）；软件、餐饮模板改成「只露功能名 / 菜名，不露效果」。
- **纯色空帧**：`make.mjs` 新加空帧检查，成片里整屏 95% 以上是同一个颜色、连续超过 6 帧就不交付。
- 另加了 Q11–Q13：数量题每个选项都要是数量；界面示意（screen / phone）要写界面里的真字；有影视片段就要保留「再听一遍」。

修复后，`styles/quiz/examples/` 里 5 份样例分镜全部重新校验并出片：`make.mjs` 退出码都是 0，最后一行都是「交付：…」，版式自查和空帧检查都通过。修复后还没有让便宜模型重新写一轮打分，上面的分数仍是修复前的。

**journey 风格的测试**（本版新增）：做法和 quiz 一样，便宜模型只读 `SKILL.md` 和 `styles/journey/` 的文档，从零写了 3 支分镜并出片：软件功能巡游（app-tour）、内容平台栏目巡游（content-site）、文旅游线（city-walk）。人工按 10 分制打「风格」和「整体」，修复前的结果：

| 分镜 | 风格 | 整体 |
|---|---|---|
| 软件功能巡游（app-tour） | 5.5 | 4 |
| 内容平台栏目巡游（content-site） | 7 | 5.5 |
| 文旅游线（city-walk） | 5 | 3.5 |

三支都没到 7 分。质检评审列了 10 条问题，10 条都改了，其中第 10 条（配色）只做了一部分：评审建议整体调柔，但风格规格要求不照搬参考视频的配色，所以只柔化了一部分。主要改动：
- **道具和题材对不上**（第 1 条）：新增背景选项 `opening.params.skyline`：`modern` 现代城市（默认）/ `street` 低层街巷 / `oldtown` 古城（白墙黛瓦、石桥河道），并补了集市、城门、石桥、茶馆、灯会等街区。校验会拦两种情况：古城古镇题材没用 `oldtown`；街区道具和背景不配套（如古城里放发射场）。
- **广告牌没被检查到**：一镜到底的广告牌在镜头中段就收起，以前在镜尾抽检查帧，根本看不到它。现在 `make.mjs` 按镜头 spec 的 `checkBeat` 在广告牌停稳的那一拍抽帧；广告牌标题和类别名必须在这一帧上看得见（`mustShow`），同一帧里混进别的街区的类别名也算错，两种都会拒绝交付。
- **数字没有出处**：画面上的价格和开放时间必须抄自 `meta.facts`，钩子里的数字要么是街区数、要么在 facts 里有依据。出现促销字眼时，报错写明是哪个词、先让删词，确有活动才写日期；提示条里的活动日期在 facts 里找不到也会拦（以前模型会编一条活动日期来过校验）。
- **文案提醒**：类别名被截成半个词、钩子写成「5 个账本街」这类读不通的说法、长标题没有停顿、片尾只剩一句口号（没有数字也没有获取方式），都会给警告。
- **字段写错位置**：把 `params` 里的字段写到镜头顶层时，合并成一条错并给出正确写法，不再一个字段报一条。

修复后，`styles/journey/examples/` 里 3 份样例分镜（播客平台 4:5、笔记软件 9:16、古镇游线 9:16）重新校验并出片，都通过了校验和 `make.mjs` 的交付检查。配乐和音效还没有人工试听。修复后也还没有让便宜模型重新写一轮打分，上面的分数仍是修复前的。

**仍存在的主要限制**（欢迎在 issue 里补充实测反例）：

1. **价格条件可以靠删 facts 绕过去**：价格条件、日期范围、加价项的检查，只对模型自己写进 `meta.facts` 的内容生效。模型把 facts 删掉，画面上的价格就没人核对了。实测中丢过节假日价和加价金额、活动日期、有效期、一项加价服务。传 `--brief` 可以核对「facts 是否出自简报」，但核对不了「简报里的价格条件有没有上屏」。
2. **组件会悄悄丢数据**：比如 mockApp 的 dashboard 只显示放得下的行，不支持的 `done` 字段直接不显示，校验不报。
3. **位置和插画的真实性**：「步行几分钟」这类说法仍会被模型编出来，门店卡会自动加一行「导航估算」。插画配上「本店作品」、插画和标签对不上（例如山景图标成「卫浴间」）、把真实数据标成示例数据，这些校验还拦不全。
4. **模板感**：不同片子的封面、默认折线图、片尾白卡、底部装饰经常一样，只换了字和颜色。
5. **文案质量没有自动检查**：截断的半个词、别扭句子、英文语法和句首大小写、同一片里卖点重复三遍、前后说法矛盾（如「三步」和「一步」），都没有自动检查。不带数字的夸大词（如「翻倍」「都说好」）也拦不住。
6. **核心动作不强制演示**：工具类产品「点开始」这样的核心动作，可能被演成一个不相关的界面，校验不管。
7. **版式**：深色主题上品牌色数字的对比度可能不够。内容少时部分面板下半截留白。照片标注互相压住要等渲染完才被拦，白等几分钟。priceCard 塞满时整体缩到 0.8 倍，个别小字会低于 26px。
8. **英文和素材检查的覆盖面**：行业合规词表按中文写，英文文案查得没有中文全。素材只能在文件层面查（同图、改名复制、截图当实拍）；是不是同一位顾客、有没有授权，只能列进「需人工复核」。

**建议用法**：
- 把成片当初稿用：看完整片，改掉别扭的文案和重复的卖点再发。不要只看校验通过就发。
- 行业片尽量配商家实拍照片（门店、成品、价目），出片时传 `--brief <简报>`。交付前把画面上每个价格、条件、日期、营业时间、距离逐条和简报对一遍。
- 测试产物用 `--round` 放在仓库外，不要写进仓库。

## 目录结构

```
promo-video-skill/
  SKILL.md / SKILL.en.md      AI 助手看的说明书（怎么挑镜头、写字段、走流程）
  README.md / README.en.md    人看的项目说明（本文件）
  LICENSE / NOTICE / THIRD_PARTY_LICENSES.md
  shots.md / shots.en.md      18 个镜头的参数总表
  brief-template.md           通用简报模板
  docs/
    shots/                    每个镜头的详细文档（18 × 2 语言）
    images/                   README 里的效果示例图
  industries/                 六个行业包（见上一节）
  scripts/
    validate.mjs              校验入口
    make.mjs                  一条命令出片
    llm_make.py                无头模式：简报 → 分镜 → 出片
    make_bgm.py                 参数化原创配乐
    build_docs.mjs              从 spec.json 生成 shots.md / shots.en.md
    privacy-scan.mjs            发布前隐私自查
    checks/ lib/                 校验规则的实现
  template/                   Remotion 渲染工程
    src/shots/                 18 个公共镜头组件 + 参数 spec（cards 风格用）
    src/styles/                各风格的清单、设计令牌、专属镜头；registry.gen.ts 由 scripts/gen-styles.mjs 生成
    src/core/                  字体、主题、动画、版式等公共逻辑
    src/illust/                行业插画兜底
    public/                    字体、音效、示例素材
  examples/                   9 份可直接渲染的分镜样例（六行业 + 英文 + 两份通用示例，都是 cards 风格）
  styles/                     风格包：每个风格的九层规格、叙事模板、规则、样例；_template/ 是新风格脚手架
  distill/                    风格蒸馏流程和可复用提示词（拆解 → 复刻 → 组件化 → 测试 → 评审）
  CONTRIBUTING.md             贡献说明（一创 / 二创 / 三创、PR 自查清单）
  tests/
    validate/                  校验规则的正负例回归测试
    rules/                     六个行业的规则回归测试（各 4 例）
```

## FAQ

**Remotion 5.0 发布后升级要注意什么？**
本仓库把 `remotion` / `@remotion/cli` 钉在 `4.0.529`。升级到 5.0 后，Remotion 免费层需要在配置里传 `licenseKey`（个人/3 人以下公司/非营利填 `"free-license"`），详见 [Remotion 许可证页](https://www.remotion.dev/license)。升级前请先看 `THIRD_PARTY_LICENSES.md`。

**`npm install` 后 lock 文件里缺某个平台的 compositor 怎么办？**
`package-lock.json` 里应该有 7 个 `@remotion/compositor-*` 平台包（win32-x64-msvc / darwin-arm64 / darwin-x64 / linux-x64-gnu / linux-x64-musl / linux-arm64-gnu / linux-arm64-musl）。如果你的平台对应的条目缺失，删掉 `template/node_modules` 和 `template/package-lock.json` 后在目标平台上重新 `npm install`（这是 npm 已知的可选依赖解析问题，跨平台生成的 lock 文件不一定包含所有平台）。

**Chrome Headless Shell 下载失败怎么办？**
国内网络环境下 `npx remotion browser ensure` 可能连不上 Google 的下载地址。可以手动下载后用 `--browser-executable` 指定本地 Chrome/Chromium 路径（不同 Chrome 版本渲染结果可能有细微差异）。

**Windows 下 `--props` 报「neither valid JSON」？**
Windows shell 会吃掉 JSON 字符串里的引号，所以分镜一律用文件路径传入（`--props=./storyboard.json`），不要直接在命令行拼 JSON 字符串。本仓库的 `make.mjs`/`llm_make.py` 已经是文件传入方式。

**需要装系统 ffmpeg 吗？**
不需要。拼图 `sheet.png` 由 Remotion 的 `Sheet` 合成直接出图（整片每秒一帧，缩略排成网格，每格下面标时间和镜号），检查帧 `check/*.png` 用 Remotion 自带的 ffmpeg 从成片里抽，抽不出来会改用 Remotion 单帧补。设了环境变量 `FFMPEG=/path/to/ffmpeg` 时，拼图会先用它的 `tile` 滤镜拼，失败再退回 `Sheet` 合成。拼图没生成不影响成片 `video.mp4`，终端会打印原因。

## 许可证

本仓库代码以 **Apache-2.0** 许可证发布，见 `LICENSE`，版权人：柳伟杰（Finderchangchang）。**可以免费商用**；按 Apache-2.0 第 4 条，转载、修改后再发布或集成进你的产品时，必须保留 `LICENSE`，并在你的 NOTICE 文件、文档或产品界面里保留 `NOTICE` 中的署名（即注明出处：基于柳伟杰的 promo-video-skill）。用本工具渲染出的视频不要求署名。

本仓库依赖 [Remotion](https://www.remotion.dev) 作为渲染引擎——Remotion 是**源码可见、非开源**的软件：个人、3 人及以下的营利公司、非营利组织可免费使用（含商用）；**4 人及以上的营利组织需要购买 Remotion 的 Company License**，详见 <https://www.remotion.dev/license>。本仓库的 Apache-2.0 许可证不改变 Remotion 自己的许可条件，具体见 `THIRD_PARTY_LICENSES.md`。

字体 Noto Sans SC、Cascadia Mono 使用 SIL Open Font License 1.1，许可证全文随字体文件放在 `template/public/fonts/`。

用本项目渲染出的视频，不要求为本项目署名。
