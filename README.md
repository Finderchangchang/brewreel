<div align="center">

<img src="docs/images/logo.png" width="120" alt="精酿 · BrewReel" />

# 精酿 · BrewReel

**便宜模型也能出合格视频：给素材，一条命令出片。**

[![Version](https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v0.14.0-1f6feb?style=flat-square)](CHANGELOG.md) [![Stars](https://img.shields.io/github/stars/Finderchangchang/brewreel?style=flat-square&logo=github&label=Stars)](https://github.com/Finderchangchang/brewreel/stargazers) [![License](https://img.shields.io/github/license/Finderchangchang/brewreel?style=flat-square)](LICENSE) [![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-%E6%8F%92%E4%BB%B6-4D6BFE?style=flat-square)](#在-deepseek-harness-里用)

[为什么是精酿](#为什么是精酿) · [快速开始](#快速开始) · [宣传片](#宣传片) · [口播配画面](#口播配画面) · [讲课视频](#讲课视频) · [文档](#文档) · [English](README.en.md)

<img src="docs/images/readme-modes.png" width="860" alt="宣传片、口播配画面、讲课视频" />

**宣传片**：一份产品简报 → 竖版宣传片（9:16）
**口播配画面**：一段口播 `talk.mp4` → 配好画面的口播（动效卡片 / AI 画面）
**讲课视频**：一份讲稿或 brief → 16:9 讲解课（可切竖版）
<sub>原名 promo-video-skill / 蒸馏视频，旧地址自动跳转。</sub>

</div>

## 为什么是精酿

**便宜模型只填表，不写代码。** 宣传片填 `storyboard.json`，口播填 `broll.json`，讲课填 `lesson.json`：挑版式、填文字。所以 DeepSeek 这类模型也能出合格片。

**合规和质检先拦一遍。** 广告法、行业规则、数字出处、版式、动效有没有停死，有一项不过就不出片。

**开源，可以商用。** Apache-2.0。分发时注明出处。渲染出的视频不要求署名。

## 快速开始

**装依赖。**

```bash
git clone https://github.com/Finderchangchang/brewreel.git
cd brewreel/template && npm install && npx remotion browser ensure
cd .. && pip install numpy scipy imageio-ffmpeg
```

**宣传片**（`examples/ledger.json`）

```bash
node scripts/validate.mjs examples/ledger.json
node scripts/make.mjs examples/ledger.json --out ../brewreel-out/ledger
```

校验通过后出片，要几分钟，最后一行是「交付：<mp4 路径>」。`--out` 不能指向仓库里面。

**口播配画面**

```bash
node scripts/talk.mjs path/to/project --out ../brewreel-out/talk
```

项目目录里放好 `talk.mp4`。本机转写，动效画面直接画；AI 画面先占位，不花钱。

**讲课视频**（`examples/lesson/mascot-demo.json`，mock 配音）

```bash
node scripts/lesson/make-lesson.mjs examples/lesson/mascot-demo.json --out ../brewreel-out/first-lesson --voice-provider mock --no-bgm
```

用占位配音看版式和节奏，不花配音费。成功时最后一行是「交付：」。

需要 Node.js 18+、Python 3.10+；Windows 只支持 x64。平台、环境变量和完整说明见 [安装与上手](docs/quickstart.md)。

## 宣传片

<p align="center"><img src="docs/images/readme-hero.gif" width="720" alt="cards、数据图表、quiz、journey" /></p>

**你给什么**：一份产品简报。

**你得到什么**：竖版宣传片（9:16；`journey` 默认 4:5）。

**一条命令**：`node scripts/make.mjs examples/ledger.json --out ../brewreel-out/ledger`

- 3 种配方：`cards` 卡片信息流（默认，9:16）、`quiz` 答题互动（9:16）、`journey` 角色漫游（默认 4:5，也可 9:16）。
- 6 个行业：软件、餐饮、电商实物、成人职业培训、生活美容、文旅住宿。各带广告法和行业规则。不做医疗美容、处方药 / 药品、K12 学科培训、保健品功效宣称、烟草。
- 配音可选 MiniMax、阿里云、火山引擎。镜头时长跟着旁白，字幕逐字点亮，配乐在人声处压低。
- 数据图表有条形、折线、点图、堆叠、环形。图上的数必须能在引用的事实原文里找到。见 [dataChart](docs/shots/dataChart.md)。
- 校验自查有 ✗ 不出片。配乐现场合成，卡着镜头切点；字幕可选中文或英文。cards 默认 6 套主题，另有 12 套可选，见 [配色](styles/cards/THEMES.md)。

详细说明 → [功能](docs/features.md)

## 口播配画面

<p align="center"><img src="docs/images/talk-intro.png" width="720" alt="口播配画面示意，没有真人出镜" /></p>

<p align="center"><a href="https://github.com/Finderchangchang/brewreel/releases/download/v0.9.0/brewreel-v0.9.0-talk-demo.mp4">看演示视频</a></p>

**你给什么**：一段口播 `talk.mp4`。

**你得到什么**：配好画面的口播。动效卡片不花钱；AI 画面要先估价、人审。

**一条命令**：`node scripts/talk.mjs path/to/project --out ../brewreel-out/talk`

- 本机用 SenseVoice（FunAudioLLM / 阿里通义实验室，由 sherpa-onnx 运行）转写。已有 `talk.srt` 不会被覆盖。
- 动效画面五种：关键词、清单、步骤、数字、对比。字只能照抄原话，脚本逐字核对，不花钱。
- 动效卡片默认跟着主风格配色。加 `--motion-look cutpaper-meadow` 或 `cutpaper-dusk` 换成剪纸拼贴：纸纹底、手剪卡片，说到重点词卡片抛起再落下。也不花钱。见 [动效外观](docs/motion-looks.md)。
- AI 画面用 MiniMax H3，全片共用 `broll/character.json` 里的一个机器人：积木风（`wood-blocks`，默认）、黏土定格（`clay-stopmotion`）、分层纸艺（`paper-layers`）。手绘线稿（`ink-sketch`）只能占位预览。默认最多 2 段。

**风格工厂。** 用一句话描述一种 AI 画面风格。脚本写配置、出参考图、看图打分、做一张静态试拍。看图会看错，最后要人看。人自己跑 `node scripts/broll/approve-style.mjs <id>`，AI 助手不许替人运行。欢迎把批准后的风格用 Pull Request 贡献回来。见 [风格工厂](docs/style-factory.md)。

**花钱和人审**：AI 画面先加 `--provider minimax-h3 --dry-run` 估价，加上 `--yes` 才生成。正式片要人自己跑 `node scripts/broll/approve.mjs <项目目录> --out <仓库外目录>`。`talk.mjs` 不会替你跑，批准命令只能人跑。

详细说明 → [口播配画面](docs/broll.md)

## 讲课视频

<p align="center"><img src="docs/images/lesson-layouts.webp" width="720" alt="讲课视频四种版式：法条卡、对比、流程、大数字" /></p>

**你给什么**：一份讲稿 `lesson.json`，或一份 brief。

**你得到什么**：16:9 讲解课。可以另出竖版切片和封面。

**一条命令**：`node scripts/lesson/make-lesson.mjs examples/lesson/mascot-demo.json --out ../brewreel-out/first-lesson --voice-provider mock --no-bgm`

- 20 种版式，4 套主题：`paper` 卷宗（普法默认）、`lecture` 讲台（其余默认）、`product` 产品、`editorial` 杂志（只能手选，不能用于普法）。
- 可以带讲解员和品牌包装。预设卡通不花钱。不写品牌也能出片。
- 改完一页后用同一个输出目录再跑，没改的页会复用。
- 普法没有有效审稿记录就不出片。技术课不强制。AI 助手不能替人签字。
- 领域包：`tech` 技术讲解，`legal` 普法。普法的法条只从已核对的《民法典》语料回填。

**花钱和人审**：照片建角色要本人同意，照片会发给 MiniMax 做识别，会花钱。没有当次明确要求不要跑。未确认的角色不能正式出片，确认只能人跑。

详细说明 → [讲课视频](docs/lesson.md)

## 让 AI 助手来做

Claude Code 把仓库放到 `~/.claude/skills/brewreel/`，Codex 等放到 `~/.agents/skills/brewreel/`。说要做什么。技能开头按你给的材料分流到宣传片、口播配画面或讲课视频。

- **想改哪里，说一句话**：`node scripts/revise.mjs <分镜/讲稿/broll.json> "第三镜慢一点，开头换成提问"`。便宜模型只改你说的那几处，改完先校验，宣传片先出改动镜头的静帧。见 [安装与上手](docs/quickstart.md)。
- **可调项**：宣传片分镜写 `meta.tweak` 调节奏、字号、标题字体，每一镜可以换背景图。见 [功能](docs/features.md)。
- **强模型的自由镜头**：Codex、Claude Code 这类会写代码的模型，可以在宣传片里自己写一镜动画（`custom`），字仍从分镜里读、校验照跑。便宜模型不要用。见 [自由镜头](docs/custom-shot.md)。

### 在 DeepSeek Harness 里用

仓库自带插件 `dsh-brewreel`。7 个工具管宣传片的校验、出片和核对。注册进去的技能说明也会分流：口播配画面写 `broll.json`、跑 `scripts/talk.mjs`；风格工厂读 `docs/style-factory.md`、跑 `scripts/broll/new-style.mjs`；讲课视频读 `lesson/SKILL-lesson.md`、跑 `scripts/lesson/make-lesson.mjs`。这三件不走那 7 个工具。安装和版本要求见 [安装与上手](docs/quickstart.md#在-deepseek-harness-里用)。

## 文档

| 文档 | 讲什么 |
|---|---|
| [安装与上手](docs/quickstart.md) | 平台、环境、口播命令、风格工厂、DeepSeek Harness |
| [功能](docs/features.md) | 配方、配音、行业、校验 |
| [口播配画面](docs/broll.md) | 只放一段口播，配动效画面或 AI 画面 |
| [风格工厂](docs/style-factory.md) | 一句话造一种 AI 画面风格，人批准 |
| [讲课视频](docs/lesson.md) | 讲解课、课程、普法、教程 |
| [动效外观](docs/motion-looks.md) | 剪纸拼贴等动效卡片外观 |
| [截图](docs/gallery.md) | 三种宣传片配方的画面 |
| [它怎么工作](docs/how-it-works.md) | 从简报到成片的步骤 |
| [常见问题](docs/faq.md) | 配乐、环境、出片时碰到的问题 |
| [已知限制](docs/limitations.md) | 还不能直接发的原因，和测试方法 |
| [更新日志](CHANGELOG.md) | 每个版本改了什么 · [历史版本](https://github.com/Finderchangchang/brewreel/releases) |
| [贡献说明](CONTRIBUTING.md) | 怎么交一份宣传片配方 |

官网：[首次出片指南](https://brewreel.com/guides/first-promo-video.html) · [产品简报模板](https://brewreel.com/guides/product-brief.html)。仓库里的通用模板：[brief-template.md](brief-template.md)。

## 已知限制

- **还是预览版。** 不建议把成片不经人工修改直接对外发布。当成初稿，看完再改再发。
- **有的接入还没真实跑过。** 阿里云和火山引擎配音还没用真实 key。DeepSeek Harness 插件还没接真实 DeepSeek 模型。MiniMax 配音用真实 key 出过片。
- **没有实拍就只能插画。** 不做医疗美容、处方药 / 药品、K12 学科培训、保健品功效宣称、烟草。

测试方法和仍存在的问题见 [已知限制](docs/limitations.md)。

## 交流群 / 需求收集

**如需联系，请公众号私信。** 合作、赞助、反馈都走公众号私信。暂时还没有精酿 · BrewReel 的专属交流群。

<p align="center"><img src="docs/images/contact/wechat-mp.png" width="180" alt="公众号二维码" /></p>

**问题反馈走 [GitHub Issues](https://github.com/Finderchangchang/brewreel/issues)**：误伤或漏拦的校验规则、渲染出错、看着别扭的画面，附上分镜 JSON 和报错最好（别贴 API Key）。

想听真实需求：你想给什么产品做片？缺哪种配方、哪个行业？哪条合规规则误伤了你？公众号私信或开 issue 都行。

## ❤️赞助商

> 想出现在这里？加微信 **jskjkf007**，添加时请备注「BrewReel 商务合作」。

## ☕ 请我喝杯咖啡

如果精酿帮你省下了一晚上剪片的时间，欢迎请我喝杯咖啡。每一份配方都是一杯杯咖啡熬出来的：这杯续上，下一份配方就调得快一点；哪天仓库里突然多了一个新风格，多半是这杯起了作用 😄

<p align="center">
  <img src="docs/images/contact/wechat-donate-v3.png" width="260" alt="微信赞赏码（姓名已隐去）" />
</p>

<p align="center"><sub>量力而行，不用有压力；点个 Star、提个 issue，或者给我看看你酿的片子，我一样开心。</sub></p>

## 姊妹项目

同一作者放在 [jev-chat](https://github.com/jev-chat) 组织下的开源项目：

- [Jev 聊天助手](https://github.com/jev-chat/jev-chat-jarvis)：装在手机上的「对话副驾」，在受支持的聊天 App 里帮你读懂对方、给出回复建议并填入输入框，发不发由你。
- [Jev 聊天助手 macOS 版](https://github.com/jev-chat/jev-chat-jarvis-mac)：微信消息意图识别悬浮窗，看屏 + 本地小模型判断意图和风险，再按话术生成回复候选，纯只读。
- [Jev 聊天助手 Windows 版](https://github.com/jev-chat/jev-chat-windows)：微信 Windows 4.x 旁挂的回复辅助，窗口截图 + 本地离线 OCR，3 条候选一键填入，发送永远手动。

## 版权与许可

Copyright © 2026 Finderchangchang。代码以 [Apache-2.0](LICENSE) 协议开源，另见 [NOTICE](NOTICE) 和 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。

- **可以商用**：个人和公司都可以使用、修改、再分发，或集成进自己的产品，不需要付费或事先授权。
- **必须注明出处**：按 Apache-2.0 第 4 条，分发本项目、它的修改版或包含它的产品时，保留 LICENSE，并把 NOTICE 里的署名放进你的 NOTICE 文件、说明文档或产品界面。推荐写法：`基于 精酿 BrewReel（https://github.com/Finderchangchang/brewreel）二次开发`。
- 不要用「精酿」「BrewReel」名称或 brewreel.com 域名暗示由原作者出品或背书。
- **渲染出的视频不要求署名。**
- **Remotion 不是开源软件**：4 人及以上的营利组织需要购买 Remotion 的 Company License，本仓库的 Apache-2.0 不改变这一点，详见 <https://www.remotion.dev/license>。
- 字体 Noto Sans SC、Cascadia Mono，以及讲课用的 BrewReel Serif、BrewReel Kai（Noto Serif SC、LXGW WenKai 的子集），使用 SIL Open Font License 1.1。许可证全文随字体文件放在 `template/public/fonts/`。

**使用边界**：`industries/` 和校验脚本里的规则整理自公开法规和平台规则，只用于辅助自查，**不构成法律意见**，也不保证覆盖所有平台的最新规则。内容是否合规，以监管部门和平台当时的最新规定为准，责任由发布者自行承担。

## 致谢

- 口播配画面的思路来自 [erduo1998-cell/vidmuse-video-creator](https://github.com/erduo1998-cell/vidmuse-video-creator)（抖音「耳朵」）：「读字幕、挑哪几句配解释画面」的方法参考了它，代码是重写的。
- 本地转写用 [SenseVoice](https://github.com/FunAudioLLM/SenseVoice)（FunAudioLLM / 阿里通义实验室），由 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 运行。
- 视频合成基于 [Remotion](https://www.remotion.dev/)。
- v0.12 的三处改进借鉴了 [alchaincyf/huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion)（花叔）的思路：技能开头先分流、选型写明「别选」、用帧差查动效有没有停住和闪。只借思路，代码是自己写的。
- 各自的许可见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
