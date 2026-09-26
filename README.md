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

这是早期预览版。测试方式是用便宜模型（DeepSeek 级别）批量生成六个行业 + 中英文的分镜，人工评分，按问题严重程度反复修了几轮。**当前平均水平**：机器硬校验（`validate.mjs` 拦的错误/警告）已经比较可靠，但**内容质量**（文案是否贴合产品、数字有没有编造、画面是否耐看）仍然依赖模型本身的发挥，人工过一遍再发布是必要步骤，不建议校验通过就直接对外发布。

已知短板（按当前了解，欢迎在 issue 里补充实测反例）：

- **英文视频的汉字检查只覆盖画面文字**：组件里写死的文案都已改成中英切换（`node scripts/check-i18n.mjs` 静态扫描为 0），出片时每半拍抽一帧扫描整片画面里的汉字，有就拒绝交付。但行业合规规则仍按中文词表判断，英文文案里的合规问题查得不如中文全。
- **数字核验依赖 facts 和简报**：速度说法、示例数据当效果、数字丢了日期范围/券后条件这类跨字段问题现在会拦。没传 `--brief` 时，校验只能核对「画面和 facts 一致」，核对不了 facts 本身是不是从简报抄来的；同一个价格被拆成两条 fact、或 fact 里本来就漏了条件，也查不出来。
- **compare 刻度方向**：两栏都写了 level 时会检查 `tone: good` 那栏是否占优；方向优先看 `higherIs`，没写时按 meterLabel 的词猜，猜不出只提醒。
- **素材真实性只查得到文件层面**：同一张图、改名复制、占位图、截图当实拍、插画标实拍会拦；两张不同的照片是不是同一位顾客、是否真的取得授权，只能列进「需人工复核」。
- **模板感**：封面 hook 去掉了固定的环绕图标，片尾有三种版式、按产品名挑，画面下方加了按主题变化的装饰层；但同一行业的片子结构仍然容易相近，没有强制多样性的机制。
- **`make.mjs` 出片有闸门**：布局自查、英文汉字扫描、机器自查、文字排版里有任何 ✗，make 返回 3、成片改名 `video.rejected.mp4`，不算交付。极端情况下（比如 priceCard 塞满 6 项价目 + 6 项包含项 + 各种条款）组件会整体缩小到 0.8 倍，个别小字会低于 26px，校验暂时拦不住。

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
    src/shots/                 18 个镜头组件 + 参数 spec
    src/core/                  字体、主题、动画、版式等公共逻辑
    src/illust/                行业插画兜底
    public/                    字体、音效、示例素材
  examples/                   9 份可直接渲染的分镜样例（六行业 + 英文 + 两份通用示例）
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
