<div align="center">

<img src="docs/images/logo.png" width="150" alt="精酿 · BrewReel" />

# 精酿 · BrewReel

**两种玩法，一条命令出片。** 写一份产品简报，出一支竖版宣传片；或者只放一段口播，给讲到的句子配上画面。

[![Version](https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v0.10.0-1f6feb?style=flat-square)](CHANGELOG.md)
[![Stars](https://img.shields.io/github/stars/Finderchangchang/brewreel?style=flat-square&logo=github&label=Stars)](https://github.com/Finderchangchang/brewreel/stargazers)
[![License](https://img.shields.io/github/license/Finderchangchang/brewreel?style=flat-square)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-%E6%8F%92%E4%BB%B6-4D6BFE?style=flat-square)](#在-deepseek-harness-里用)

[宣传片](#宣传片) · [口播配画面](#口播配画面) · [风格工厂](#风格工厂) · [快速开始](#快速开始) · [文档](#文档) · [English](README.en.md)

<table>
<tr>
<td width="50%" align="left">
<b>宣传片</b>（v0.1 起）<br/>
<code>node scripts/make.mjs</code><br/>
<sub>写简报，便宜模型写分镜<br/>3 种配方 · 6 个行业</sub>
</td>
<td width="50%" align="left">
<b>口播配画面</b>（v0.9 起可用）<br/>
<code>node scripts/talk.mjs</code><br/>
<sub>只放 talk.mp4<br/>本机转写 · 动效画面或 AI 画面</sub>
</td>
</tr>
</table>

v0.10 还可以一句话造一种 AI 画面风格，见 [风格工厂](#风格工厂)。

<sub>原名 promo-video-skill / 蒸馏视频，旧地址自动跳转。</sub>

</div>

## 快速开始

需要 Node.js 18+、Python 3.10+；Windows 只支持 x64。平台表、环境变量和完整说明见 [安装与上手](docs/quickstart.md)。

**1. 装依赖。**

```bash
git clone https://github.com/Finderchangchang/brewreel.git
cd brewreel/template && npm install && npx remotion browser ensure
cd .. && pip install numpy scipy imageio-ffmpeg
```

**2. 宣传片：跑一个样例。**

```bash
node scripts/validate.mjs examples/ledger.json
node scripts/make.mjs examples/ledger.json --out ../brewreel-out/ledger
```

出片要几分钟，终端最后一行是「交付：<mp4 路径>」。`--out` 不能指向仓库里面。

要模型写分镜：把仓库放到 `~/.claude/skills/brewreel/` 或 `~/.agents/skills/brewreel/`，把 [`brief-template.md`](brief-template.md) 交给助手，让它照 `SKILL.md` 做。不用助手也可以：`python scripts/llm_make.py path/to/brief.md`。

**3. 口播：只放一段视频。**

把口播改名为 `talk.mp4`，放进一个项目目录：

```bash
node scripts/talk.mjs path/to/project --out ../brewreel-out/talk
```

本机转写，DeepSeek 写 `broll.json`（要先设 `DEEPSEEK_API_KEY` 或 `LLM_API_KEY`）。动效画面直接画。AI 画面先占位，不花钱；真生成要先估价，人审过才出正式片。见 [口播配画面](docs/broll.md)。

### 在 DeepSeek Harness 里用

仓库自带插件 `dsh-brewreel`，管宣传片的校验、出片和核对。需要 dsh 0.1.7-rc.2 或更高的 0.1.x。安装命令、7 个工具和许可提醒见 [安装与上手](docs/quickstart.md#在-deepseek-harness-里用)。这一版还没接口播配画面，也还没接真实 DeepSeek 模型实测。

## 宣传片

从 v0.1 起：写产品简报，便宜模型只写一份 `storyboard.json`（挑镜头、填文字，不写代码），一条命令出竖版片。

<p align="center"><img src="docs/images/readme-hero.gif" width="720" alt="cards、数据图表、quiz、journey" /></p>

| 配方 | 什么时候用 |
|---|---|
| `cards` 卡片信息流（默认） | 单一卖点、使用流程、界面、实物和价目。9:16 |
| `quiz` 答题互动 | 能出一道唯一正确答案的选择题。9:16 |
| `journey` 角色漫游 | 有 4–6 个类别，想挨站逛一遍。默认 4:5，也可 9:16 |

- **六个行业**：软件、餐饮、电商实物、成人职业培训、生活美容、文旅住宿。各带《广告法》和行业规则、推荐镜头、简报模板。不做医疗美容、处方药 / 药品、K12 学科培训、保健品功效宣称、烟草。
- **配音**（v0.5 起）：MiniMax、阿里云、火山引擎。镜头时长跟着旁白，字幕逐字点亮，配乐在人声处压低。
- **数据图表**（v0.7）：条形、折线、点图、堆叠、环形。图上的数必须能在引用的事实原文里找到。见 [`docs/shots/dataChart.md`](docs/shots/dataChart.md)。
- **配色**（v0.7）：cards 默认 6 套，另有 12 套可选。不选的话，老分镜出片不变。见 [`styles/cards/THEMES.md`](styles/cards/THEMES.md)。
- **配乐和字幕**：配乐由 `scripts/make_bgm.py` 现场合成，卡着镜头切点。字幕可选中文或英文。

<p align="center"><img src="docs/images/themes.png" width="720" alt="12 套可选配色" /></p>

校验自查有 ✗ 的片子不交付。每项说明见 [功能](docs/features.md)，更多画面见 [截图](docs/gallery.md)。

## 口播配画面

v0.8 先做实验。v0.9 起可以只放一段口播，一条命令出片。项目目录里只要 `talk.mp4`。

<p align="center"><img src="docs/images/talk-intro.png" width="720" alt="口播配画面示意，没有真人出镜" /></p>

<p align="center"><a href="https://github.com/Finderchangchang/brewreel/releases/download/v0.9.0/brewreel-v0.9.0-talk-demo.mp4">看 v0.9.0 演示视频</a></p>

- **本机转写**：SenseVoice（FunAudioLLM / 阿里通义实验室），由 sherpa-onnx 运行。已有 `talk.srt` 不会被覆盖。
- **动效画面**：DeepSeek 逐句选。关键词、清单、步骤、数字、对比五种。字只能照抄原话，脚本逐字核对。这种画面不花钱。
- **AI 画面**：MiniMax H3。正式风格三种，全片共用 `broll/character.json` 里的一个机器人：积木风（木积木，`wood-blocks`，默认）、黏土定格（`clay-stopmotion`）、分层纸艺（`paper-layers`）。手绘线稿（`ink-sketch`）是实验，只能占位预览。默认最多 2 段。
- **先估价，人审过才出正式片**。`--provider minimax-h3 --dry-run` 只印估价；加上 `--yes` 才生成。人自己跑 `node scripts/broll/approve.mjs <项目目录> --out <仓库外目录>`。`talk.mjs` 不会替你跑。

费用、放法和限制见 [口播配画面](docs/broll.md)。那边的标题仍写着实验：黏土定格和分层纸艺还没真生成过，手绘线稿还没有参考图。

## 风格工厂

v0.10。用一句话描述一种 AI 画面风格。脚本写配置、出参考图、看图打分、做一张静态试拍。看图会看错，最后要人看。

先看将要发送的请求，这一步不调接口：

```bash
node scripts/broll/new-style.mjs --id demo-watercolor --name 水彩绘本 --desc "水彩晕染、纸纹、柔和暖色"
```

确认后加 `--yes` 真跑。看完 `broll/styles/_drafts/<id>/review.html`，人自己在终端里跑：

```bash
node scripts/broll/approve-style.mjs <id>
```

这条只能人跑。AI 助手不许替人运行；不是交互终端会直接拒绝。做过视频试拍且通过，状态写 `stable`，否则写 `experimental`。

欢迎把批准后的风格用 Pull Request 贡献回来。这和宣传片配方的二创不是同一套文件，宣传片配方仍走 [贡献说明](CONTRIBUTING.md)。步骤、花费和看图规则见 [风格工厂](docs/style-factory.md)。

## 为什么用它

- **便宜模型只做它做得好的事。** 宣传片只写 `storyboard.json`，口播只写 `broll.json`：挑镜头、填文字，不写代码、不算坐标。
- **配方由强模型先调好。** 每种宣传片风格先做成组件和校验规则，便宜模型照着填。
- **合规红线先拦一遍。** 报错用中文写清楚哪一镜哪个字段要改。校验 → 配乐 → 渲染 → 检查帧，一条命令走完。
- **开源、可商用。** Apache-2.0，注明出处即可。渲染出的视频不要求署名。

## 文档

**开始**

- [安装与上手](docs/quickstart.md)：平台、环境、便宜模型、口播命令、风格工厂、DeepSeek Harness
- [首次出片指南](https://brewreel.com/guides/first-promo-video.html) · [产品简报模板](https://brewreel.com/guides/product-brief.html)（官网）
- [简报模板](brief-template.md)（仓库里的通用模板）

**两种玩法**

- [功能](docs/features.md)：配方、配音、行业、口播、风格工厂、校验
- [截图](docs/gallery.md)
- [口播配画面](docs/broll.md)
- [风格工厂](docs/style-factory.md)
- [它怎么工作](docs/how-it-works.md)

**参考**

- [常见问题](docs/faq.md)
- [已知限制](docs/limitations.md)
- [更新日志](CHANGELOG.md) · [历史版本](https://github.com/Finderchangchang/brewreel/releases) · [贡献说明](CONTRIBUTING.md)

## 已知限制

- **还是预览版**。不建议把成片不经人工修改直接对外发布。当成初稿，看完再改再发。
- **有的接入还没真实跑过**。阿里云和火山引擎配音还没用真实 key；DeepSeek Harness 插件还没接真实 DeepSeek 模型。MiniMax 配音用真实 key 出过片。
- **没有实拍就只能插画**。不做医疗美容、处方药 / 药品、K12 学科培训、保健品功效宣称、烟草。

测试方法和仍存在的问题见 [已知限制](docs/limitations.md)。

## 交流群 / 需求收集

**如需联系，请公众号私信。** 合作、赞助、反馈都走公众号私信。暂时还没有精酿 · BrewReel 的专属交流群。

<p align="center"><img src="docs/images/contact/wechat-mp.png" width="180" alt="公众号二维码" /></p>

**问题反馈走 [GitHub Issues](https://github.com/Finderchangchang/brewreel/issues)**：误伤或漏拦的校验规则、渲染出错、看着别扭的画面，附上分镜 JSON 和报错最好（别贴 API Key）。

想听真实需求：你想给什么产品做片？缺哪种配方、哪个行业？哪条合规规则误伤了你？公众号私信或开 issue 都行。

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
- 字体 Noto Sans SC、Cascadia Mono 使用 SIL Open Font License 1.1，许可证全文随字体文件放在 `template/public/fonts/`。

**使用边界**：`industries/` 和校验脚本里的规则整理自公开法规和平台规则，只用于辅助自查，**不构成法律意见**，也不保证覆盖所有平台的最新规则。内容是否合规，以监管部门和平台当时的最新规定为准，责任由发布者自行承担。

## ❤️赞助商

> 想出现在这里？加微信 **jskjkf007**，添加时请备注「BrewReel 商务合作」。

## ☕ 请我喝杯咖啡

如果精酿帮你省下了一晚上剪片的时间，欢迎请我喝杯咖啡。每一份配方都是一杯杯咖啡熬出来的：这杯续上，下一份配方就调得快一点；哪天仓库里突然多了一个新风格，多半是这杯起了作用 😄

<p align="center">
  <img src="docs/images/contact/wechat-donate-v3.png" width="260" alt="微信赞赏码（姓名已隐去）" />
</p>

<p align="center"><sub>量力而行，不用有压力；点个 Star、提个 issue，或者给我看看你酿的片子，我一样开心。</sub></p>

## 致谢

- 口播配画面的思路来自 [erduo1998-cell/vidmuse-video-creator](https://github.com/erduo1998-cell/vidmuse-video-creator)（抖音「耳朵」）：「读字幕、挑哪几句配解释画面」的方法参考了它，代码是重写的。
- 本地转写用 [SenseVoice](https://github.com/FunAudioLLM/SenseVoice)（FunAudioLLM / 阿里通义实验室），由 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 运行。
- 视频合成基于 [Remotion](https://www.remotion.dev/)。
- 各自的许可见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
