# 安装与上手

[← 返回 README](../README.md) · [English](quickstart.en.md)

## 平台支持

| 用法 | 状态 | 说明 |
|---|---|---|
| Claude Code / Codex / opencode 等能读 `SKILL.md` 的 AI 编程助手 | ✅ 可用 | 把仓库装成 skill，助手照 `SKILL.md` 写分镜、跑校验、出片 |
| DeepSeek Harness 插件 `dsh-brewreel` | ⚠️ 已发布到 npm | 7 个工具负责校验、出片、核对；还没接真实 DeepSeek 模型实测 |
| 无 agent 脚本 `scripts/llm_make.py` | ✅ 可用 | 直接调 OpenAI 兼容接口（默认 DeepSeek），简报进、视频出，校验报错自动回喂重试 |

| 运行环境 | 要求 |
|---|---|
| 操作系统 | Windows（仅 x64）/ macOS ≥ 15 / Linux（glibc ≥ 2.35，需要 `libnss3` / `libgbm` / `libasound2` 等共享库；不支持 Alpine、NixOS） |
| Node.js | ≥ 18（建议 20 LTS 或更高，本仓库在 Node 22 上测试过）；DeepSeek Harness 插件要 22.19+ 的 22.x 或 24+ |
| Python | 3.10+；配乐脚本要 `numpy` / `scipy`，`llm_make.py` 只用标准库 |
| 首次下载 | 渲染依赖约几百 MB，外加约 110 MB 的 Chrome Headless Shell；用口播配画面时，第一次转写再下载约 240 MB 的 SenseVoice 识别模型（只下一次） |

成片 1080×1920（journey 默认 1080×1350），30 fps，带配乐和音效。

## 快速开始

**1. 装依赖。**

```bash
git clone https://github.com/Finderchangchang/brewreel.git
cd brewreel/template && npm install && npx remotion browser ensure
cd .. && pip install numpy scipy imageio-ffmpeg
```

`npm install` 装渲染引擎（lock 文件里带 7 个平台的 Remotion compositor，换平台不用重新生成）；`npx remotion browser ensure` 下载一次 Chrome Headless Shell，供无头渲染用。

**2. 跑一个样例，确认装好了。**

```bash
node scripts/validate.mjs examples/ledger.json
node scripts/make.mjs examples/ledger.json --out ../brewreel-out/ledger
```

第一条校验通过就说明装好了。第二条出片要几分钟，终端最后一行是「交付：<mp4 路径>」；输出目录里有 `video.mp4`、拼图 `sheet.png`、检查帧 `check/`、`report.txt` 和交付清单 `manifest.json`。`--out` 不能指向仓库里面。

**3. 让 AI 写分镜。** 三选一：

- **装成 skill**：把整个仓库 clone 到 `~/.claude/skills/brewreel/`（Claude Code）或 `~/.agents/skills/brewreel/`（通用约定），或用你工具自带的 skill 安装命令指向本仓库。然后把简报交给助手（模板见 [`brief-template.md`](../brief-template.md)），让它照 `SKILL.md` 出片。
- **无头脚本**：不需要 agent，见下面的[「用便宜模型直接跑」](#用便宜模型直接跑)。
- **DeepSeek Harness**：装插件后模型用工具校验和出片，见[「在 DeepSeek Harness 里用」](#在-deepseek-harness-里用)。

### 用便宜模型直接跑

`scripts/llm_make.py` 直接调 OpenAI 兼容接口：简报进、视频出，校验报错会原样回喂给模型重试（最多 3 次）。

```bash
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic   # 仅当把 DeepSeek 接到 Claude Code 时需要
export ANTHROPIC_AUTH_TOKEN=<你的 DeepSeek API Key>
export ANTHROPIC_MODEL=deepseek-flash[1m]

# 或者直接用无头脚本，不接 Claude Code：
export LLM_API_KEY=<你的 DeepSeek API Key>
export LLM_BASE_URL=https://api.deepseek.com
export LLM_MODEL=deepseek-flash
python scripts/llm_make.py path/to/brief.md
```

Windows PowerShell 用 `$env:LLM_API_KEY="..."` 代替 `export`。以上都是占位符，换成你自己的 key；不要把 key 提交进仓库或写进 issue。也可以把这些变量写进 AI 编程助手自己的全局配置（如 `~/.claude/settings.json`），这是可选做法，本仓库不会替你改任何全局配置。加 `--dry-run` 不调接口、不读密钥，只把拼好的提示写出来并估算 token 数。加 `--skip-readthrough-gate` 时，通读检查发现的问题只警告，仍照常出片；默认会拦下、不出片。

### 口播配画面（实验）

已经有一段真人口播、想在讲步骤、讲数字的句子上加解释画面时用。项目目录里只放口播 `talk.mp4`，一条命令：

```bash
node scripts/talk.mjs path/to/project --out ../brewreel-out/talk
```

它先在本机转写出字幕，再请 DeepSeek 挑句子写 `broll.json`（要设 `DEEPSEEK_API_KEY`），最后出片：免费的动效画面直接画，AI 画面先用纯色占位，不花钱。第一次转写会下载约 240 MB 的识别模型。从 v0.8 升级的，先在 `template` 目录重新 `npm install`。口播配画面要完整版 ffmpeg，上面装依赖时的 `imageio-ffmpeg` 就是给它用的（Remotion 自带的精简版不够）。AI 画面有三种正式风格（积木风、黏土定格、分层纸艺），参考图随仓库发布；手绘线稿是实验风格，参考图还没出，只能占位预览。真生成 AI 画面、费用和审片见 [口播配画面](broll.md)。

### 风格工厂

一句话造一种口播用的 AI 画面风格。先不加 `--yes`，只看将要发送的请求，不调接口：

```bash
node scripts/broll/new-style.mjs --id demo-watercolor --name 水彩绘本 --desc "水彩晕染、纸纹、柔和暖色"
```

人自己批准、花费和看图规则见 [风格工厂](style-factory.md)。

### 在 DeepSeek Harness 里用

仓库自带一个 DeepSeek Harness（dsh）插件，放在 [`integrations/deepseek-harness/`](../integrations/deepseek-harness/README.md)，包名 `dsh-brewreel`（原名 `dsh-distill-video`，从旧版升级见插件 README 的「从 dsh-distill-video 升级」）。装上后，模型照着 skill 写分镜，校验、出片、核对都调插件的工具完成，不用自己拼 `node scripts/…` 命令；出片在后台跑、报进度，输出路径和子进程拿到的环境变量都受插件限制。

需要 **dsh 0.1.7-rc.2 或更高**的 0.1.x。npm 上 dsh 的 `latest` 标签目前还指向更早的 0.1.5-rc.3，所以安装时要写明版本号。另外要有 Node.js 22.19+ 的 22.x 或 24+，以及 pnpm（`dsh plugin` 靠 pnpm 装插件）。从 npm 安装：

```bash
npm install -g @deepseek-ai/dsh@0.1.7-rc.2 pnpm    # 还没装 dsh 时
dsh plugin --profile web add dsh-brewreel
dsh web
```

`web` 可以换成你自己的 profile 名，profile 已经在运行的要重启才生效。第一次用时对模型说「检查一下视频插件环境」，它会调 doctor，经你同意后再调 setup 装渲染依赖（约几百 MB，外加约 110 MB 的 Chrome Headless Shell）。想用仓库里还没发版的代码，可以 clone 后在上一级目录执行 `dsh plugin --profile web add ./brewreel/integrations/deepseek-harness`。插件还没接真实 DeepSeek 模型实测，遇到问题请开 issue。

<details>
<summary><b>7 个工具、许可提醒与安全说明</b></summary>

- `brewreel_doctor` 查环境，`brewreel_setup` 装依赖和浏览器，`brewreel_catalog` 列风格、行业和配色，`brewreel_guide` 读 skill 与各风格、行业、镜头文档，`brewreel_validate` 校验分镜并给改法，`brewreel_render` 后台出片，`brewreel_verify` 核对成片是否还对应当前分镜。
- 许可提醒：插件和 skill 是 Apache-2.0，但渲染引擎 Remotion 不是开源软件，**4 人及以上的营利组织需要购买 Remotion 的 Company License**（见[「版权与许可」](../README.md#版权与许可)和 `THIRD_PARTY_LICENSES.md`）；插件不改变这一点。
- 渲染子进程不经过 dsh 的 shell 沙箱，以当前用户权限运行。
- 配置项、安全说明和故障排查见插件的 [README](../integrations/deepseek-harness/README.md)。

</details>
