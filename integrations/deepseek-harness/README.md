# 精酿 · BrewReel — DeepSeek Harness 插件

中文 | [English](README.en.md)

用 DeepSeek 模型写一份分镜 JSON，一次工具调用出一支竖版宣传片（1080x1920，15–45 秒）。

作者：柳伟杰 / Liu Weijie（Finderchangchang）　·　许可证：Apache-2.0　·　主仓库：<https://github.com/Finderchangchang/brewreel>

插件包名 `dsh-brewreel`，0.2.0 起随项目改名（原名 `dsh-distill-video`，项目原名 promo-video-skill / 蒸馏视频）；从旧版升级见[「从 dsh-distill-video 升级」](#从-dsh-distill-video-升级)。

## 它做什么，不做什么

- **做**：模型只写 `storyboard.json`（挑镜头、填文字）；画面由现成的 Remotion 镜头组件渲染；校验脚本拦下违反规则和《广告法》/行业合规的写法；一次调用完成校验 → 自查 → 配乐 → 渲染 → 版式检查 → 交付清单。
- **不做**：生成任意视频；替用户判断合规灰区（「需人工复核」条目原样交给用户）。
- 这是「7 个工具 + 一份 skill 说明」的插件：skill 教模型怎么写分镜，工具负责校验、出片、核对，并管住输出路径、子进程和环境变量。

## 效果示例

见主仓库 README 里的截图和示例视频。本 README 不放图片；插件包里的 skill 快照会带上主仓库 `docs/images/` 的预览图（约 3.5 MB），风格文档里的图片链接指向它们。

## 环境要求

| 项 | 要求 |
|---|---|
| Node.js | 22.19 及以上的 22.x，或 24 及以上（和 dsh 本身的要求一致） |
| DeepSeek Harness | `@deepseek-ai/dsh` 0.1.7-rc.2 及以上的 0.1.x（0.1.7-rc.2 实测通过） |
| pnpm | `dsh plugin` 靠 pnpm 装插件，pnpm 要在 PATH 上 |
| Python（可选） | 3.10+，带 numpy、scipy；缺了配乐静音，不影响出片 |
| 磁盘 | 约 1 GB（渲染依赖 + Chrome Headless Shell） |
| 网络 | 首次初始化要从 npm 和 Google 下载依赖 |

## 安装

还没装 dsh 的话先装它和 pnpm（`dsh plugin` 会把参数转给 pnpm）：

```sh
npm install -g @deepseek-ai/dsh@0.1.7-rc.2 pnpm
```

版本号要写上：npm 上 dsh 的 `latest` 标签目前还指向更早的 0.1.5-rc.3，低于插件要求的 0.1.7-rc.2（新版本在 `next` 标签下）。已经装过 dsh 的，先用 `dsh --version` 看一下版本。

下面的命令都以 `web` profile 为例，换成你自己的 profile 名也行。第一次 `dsh plugin --profile web …` 会自动建好这个 profile。装完用 `dsh web` 启动；如果 profile 已经在运行，要**重启**（dsh 的 bundle 变更在下次启动时生效）。

**A. 本地 clone 链接安装（最稳，国内网络友好）**

```sh
git clone https://github.com/Finderchangchang/brewreel.git
dsh plugin --profile web add ./brewreel/integrations/deepseek-harness
```

在 clone 的上一级目录执行第二条命令（相对路径按当前目录解析）。插件会直接使用这份 clone 里的 skill（`checkout` 模式）：渲染依赖装在 clone 的 `template/node_modules/`，出片时 `make.mjs` 会在 clone 的 `template/` 里写临时素材和渲染锁（都已被仓库 `.gitignore` 忽略）；不想碰 clone，就在配置里开 `stageCheckout: true`，改为复制到运行目录再跑。

**B. GitHub Release 附件（npm 发布前）**

从 Release 页面下载 `dsh-brewreel-<版本>.tgz`，然后：

```sh
dsh plugin --profile web add ./dsh-brewreel-0.2.0.tgz
```

**C. npm（作者发布后）**

```sh
dsh plugin --profile web add dsh-brewreel
```

**D. 只装 skill、不装插件**

把仓库 clone 到 `~/.agents/skills/brewreel/`（或项目的 `.agents/skills/`），dsh 会自动发现这份 skill，模型用 shell 工具跑 `node scripts/…`。没有进度、路径保护和结构化报错，只适合临时试用。

卸载：`dsh plugin --profile web remove dsh-brewreel`，再删掉运行目录（默认 `~/.dsh/brewreel/`，从 0.1.x 升级上来的可能是 `~/.dsh/distill-video/`；A 方式不开 `stageCheckout` 时依赖在 clone 的 `template/node_modules/`）。

## 首次初始化

对模型说「检查一下视频插件环境」，它会调 `brewreel_doctor`。环境没就绪时，模型会先问你，再调 `brewreel_setup`：

1. `stage`：把 skill 复制到运行目录（npm / tgz 安装时必做；不联网）；
2. `deps`：在 `template/` 里 `npm ci`（Remotion 等，约几百 MB）；
3. `browser`：下载 Chrome Headless Shell（约 110 MB）。

国内网络：在配置里设 `npmRegistry`（如 `https://registry.npmmirror.com`）。Chrome Headless Shell 下载失败时，按主仓库 README「FAQ」一节（Chrome Headless Shell 下载失败怎么办）的手动办法处理，放到 doctor 结果里 `runtimeRoot` 下的 `template/node_modules/.remotion/chrome-headless-shell/`，再调一次 setup（已存在会跳过）。

Python 依赖插件**只检测、不安装**；需要配乐就自己执行 doctor 给出的 `python -m pip install numpy scipy`。

## 怎么用

示例对话：

> **你**：给我的记账 App 做一支 20 秒左右的抖音宣传片。卖点：拍小票自动记账、月底超支提醒。简报在 promo/ledger/brief.md。
>
> **模型**：（调 `brewreel_catalog`）这个产品单一卖点、要演示界面，用默认的 cards 风格、software 行业。（调 `brewreel_guide` 读 cards 的 recipes 和 hook 镜头说明，写 `promo/ledger/storyboard.json`）
>
> **模型**：（调 `brewreel_validate`）第 3 镜字幕太长，按提示改成两行……再校验，通过。
>
> **模型**：（调 `brewreel_render`，后台任务 `brewreel-1`；用 `job_output` 看到「渲染 420/735 帧」）
>
> **模型**：出片完成。成片：`…/promo/ledger/video.mp4`（24.5 秒），拼图 `sheet.png`。发布前请你确认这 2 条「需人工复核」：……

出片产物（都在输出目录里）：

| 文件 | 说明 |
|---|---|
| `video.mp4` | 成片。**只有工具结果里 `video.path` 给出的才算交付** |
| `sheet.png` | 拼图，一眼看全片 |
| `check/` | 检查帧 |
| `report.txt` | 校验、机器自查、版式自查的完整报告 |
| `manifest.json` | 分镜 sha256、成片 sha256 / 时长、各项检查结论 |

「只认交付行」：`video` 字段只在四个条件同时满足时出现——退出码 0、`make.mjs` 最后一行是「交付：…」、manifest 状态为 delivered、文件 sha256 与 manifest 一致。失败时留下的 `video.rejected.mp4` 只给人看哪里坏了，不能交付。`stills`（单帧预览）永远不是成片。

## 工具一览

| 工具 | 用途 | 写文件 | 后台 |
|---|---|---|---|
| `brewreel_doctor` | 检查环境（Node、skill 文件、依赖、Chrome、Python、输出目录、渲染锁） | 否 | 否 |
| `brewreel_setup` | 一键初始化：stage / deps / browser | 运行目录 | 默认是 |
| `brewreel_catalog` | 列出风格、行业、配色主题 | 否 | 否 |
| `brewreel_guide` | 读 skill 说明、风格 recipes、行业 recipe、镜头说明、样例 | 否 | 否 |
| `brewreel_validate` | 校验分镜，给出 errors / warnings / human 三档，每条带「怎么改」 | 否 | 否 |
| `brewreel_render` | 出片（约 3–10 分钟，看机器），报进度；`stills` 只出单帧 | 输出目录 | 默认是 |
| `brewreel_verify` | 核对成片是否还对应当前分镜 | 否 | 否 |

同一条校验错误连续 3 轮都没改掉，`validate` 会在 `stuck` 里提示模型停下来问你，避免便宜模型死循环。

## 配置项

在 Web UI 的插件设置里改（表单由配置 schema 自动生成），或写进 profile 的 `cordis.patch.yml`：

```yaml
- id: brewreel
  config:
    outputRoot: promo
    npmRegistry: https://registry.npmmirror.com
    renderTimeoutMin: 40
```

注意：patch 会**整体替换**这一行的 `config`，想保留的键都要写上。

| 键 | 默认 | 说明 |
|---|---|---|
| `skillRoot` | `''` | 指定一份精酿 BrewReel 的 clone；空 = 自动查找（插件外两级的 clone → 包内快照） |
| `stageCheckout` | `false` | clone 模式下也先复制到运行目录再跑，不碰 clone |
| `runtimeDir` | `''` | 空 = `$DSH_HOME/brewreel`（`~/.dsh/brewreel`）；只有 0.1.x 留下的 `~/.dsh/distill-video` 时直接沿用它 |
| `outputRoot` | `promo` | 输出根目录，相对会话工作区 |
| `extraWriteRoots` | `[]` | 额外允许读写的目录（绝对路径） |
| `renderInBackground` | `true` | 出片默认走后台任务 |
| `maxConcurrentRenders` | `1` | 插件同时跑几个出片进程（1–4） |
| `renderTimeoutMin` | `30` | 单次出片硬超时（分钟），到点终止整个进程树 |
| `queueTimeoutMin` | `20` | 等渲染锁的上限（分钟） |
| `bgm` | `true` | 默认生成配乐 |
| `autoSetup` | `false` | 出片发现依赖缺失时自动先跑 setup（会联网下载）。默认关，让你知情 |
| `npmRegistry` | `''` | setup 用的 npm 源，必须是 https |
| `python` / `ffmpeg` | `''` | 指定 Python / ffmpeg 可执行文件 |
| `registerSkill` | `true` | 是否注册 skill 说明 |
| `skillLang` | `zh` | 注册中文还是英文 SKILL，也决定工具文字的语言 |
| `maxResultChars` | `16000` | 单次工具结果给模型的文字上限 |
| `envPassthrough` | `[]` | 额外透传给子进程的环境变量名；名字像密钥的（KEY/TOKEN/SECRET/PASSWORD/AUTH/COOKIE）一律拒绝 |

想每次出片前都让你点确认：用 dsh 的工具审批策略（`tools/pre-execute`）把 `brewreel_render` 配成「询问」。

## 安全说明

- **写入范围**：只写会话工作区里的输出目录（默认 `promo/<片名>/`）、`extraWriteRoots`，以及插件运行目录。输出目录不能是工作区根目录、`outputRoot` 本身、用户主目录或盘符根目录；`make.mjs` 开跑会按固定文件名清旧产物（`video.mp4`、`report.txt`、`layout.json`、`manifest.json`、`check/*.png` 等），所以目录里已有别人的 `storyboard.json`，或者有这些文件名、却不是本工具或 `make.mjs` 产出的（没有它写的 `manifest.json`，也没有插件的标记文件 `.brewreel-out.json`，0.1.x 写的 `.distill-video-out.json` 也认），一律拒绝。所有路径先解析真实路径再比较，符号链接 / 目录联接跑不出去。
- **可读范围**：分镜、简报必须在工作区里；分镜引用的素材不能跑出分镜目录和工作区。
- **不执行任意命令**：插件只启动当前 Node 跑 skill 里固定的脚本（validate.mjs、make.mjs、Remotion CLI、npm），Python 只跑固定的检测命令，Windows 上用 `taskkill` 终止自己启动的进程树；`make.mjs` 自己还会调 Python 生成配乐、调 ffmpeg（配置了的话）。全部 `shell: false`，参数是固定数组；模型给的字符串只以「校验过的绝对路径」或「校验过的数字」进入参数。
- **环境变量白名单**：子进程只拿到 PATH、TEMP、HOME、LANG 等基础变量；DeepSeek key 等凭据不会传给渲染进程。
- **如实说明**：渲染子进程**不经过 dsh 的 shell 沙箱**，以当前用户权限运行，插件靠上面的规则自我约束。setup 会从 npm 和 Google 下载 Remotion 与 Chrome Headless Shell。

## 故障排查

| 现象 | 处理 |
|---|---|
| 工具报「渲染依赖还没装好」 | 调 `brewreel_doctor`，同意后调 `brewreel_setup` |
| 退出码 1（`invalid`） | 分镜校验没过，结果里的 `validation.errors` 逐条改 |
| 退出码 3（`rejected`） | 版式 / 空帧自查有 ✗：删条目或缩短文字，再校验、再出片 |
| 退出码 4（`render-failed`） | 多半是 Chrome Headless Shell 缺失或内存不足；先跑 doctor |
| 退出码 5（`queue-timeout`） | 别的渲染占着锁；等它结束或调大 `queueTimeoutMin` |
| 退出码 6（`internal`） | 把 `report.txt` 发到仓库 issue |
| `killed` | 超过 `renderTimeoutMin` 或被取消，进程树已终止；锁会被下一次出片自动回收 |
| 配乐静音 | Python 缺 numpy / scipy，按 doctor 给出的命令安装 |
| Chrome 下载失败 | 配 `npmRegistry`；Chrome 按主仓库 FAQ 手动放置 |
| Windows 中文路径 | 支持中文和空格路径；分镜、简报请用 UTF-8 保存 |

## 与主仓库的关系、版本对应

- 仓库根目录是唯一源头。npm / tgz 包里的 `skill/` 是打包时由 `scripts/sync-skill.mjs` 生成的快照，`skill/.distill-source.json` 记录 skill 版本、仓库 commit 和文件哈希；`brewreel_doctor` 会显示这几项。
- 插件版本独立编号。0.1.0（包名 `dsh-distill-video`）随 v0.3.0 发布；0.2.0 起包名改为 `dsh-brewreel`，随 v0.4.0 发布。包里的 skill 快照具体是哪个版本、哪个 commit，以 `skill/.distill-source.json`（doctor 结果里也有）为准。
- 升级：重装插件后重启 profile；新快照会暂存到新的运行子目录，`package-lock.json` 的依赖没变时沿用已下载的依赖（只改模板包名或版本号不算变），只保留最近两份。

## 从 dsh-distill-video 升级

0.2.0 起插件随项目改名为精酿 · BrewReel，包名、工具名、skill 名都换了：

| 项 | 0.1.x（旧） | 0.2.0 起 |
|---|---|---|
| npm 包名 | `dsh-distill-video` | `dsh-brewreel` |
| 7 个工具 | `distill_video_doctor` 等 | `brewreel_doctor` 等，后缀不变（doctor / setup / catalog / guide / validate / render / verify） |
| 注册的 skill 名 | `promo-video-skill` | `brewreel`（跟随 SKILL.md 的 `name`） |
| `cordis.patch.yml` 里的插件行 | `id: distill-video` | `id: brewreel` |
| 默认运行目录 | `~/.dsh/distill-video/` | `~/.dsh/brewreel/` |
| 输出目录标记文件 | `.distill-video-out.json` | `.brewreel-out.json` |
| 打包时跳过脏检查的环境变量 | `DISTILL_SYNC_ALLOW_DIRTY` | `BREWREEL_SYNC_ALLOW_DIRTY` |

升级步骤：`dsh plugin --profile web remove dsh-distill-video`，按上面「安装」重新装 `dsh-brewreel`，重启 profile。

- **要你改的**：旧工具名不再注册。工具审批策略（`tools/pre-execute`）、自己的提示词或脚本里写了 `distill_video_*` 的，换成 `brewreel_*`；profile 的 `cordis.patch.yml` 里写过覆盖的，把 `id` 改成 `brewreel`（否则旧 id 的那行不再对应本插件）。
- **自动兼容的**：旧输出目录里的 `.distill-video-out.json` 照样认，原来的输出目录可以接着出片；只有旧运行目录 `~/.dsh/distill-video/` 时会直接沿用，已下载的依赖和 Chrome Headless Shell 不用重下；`DISTILL_SYNC_ALLOW_DIRTY` 仍然有效。
- GitHub 仓库地址改为 <https://github.com/Finderchangchang/brewreel>，旧地址会自动跳转；已有的 clone 可以用 `git remote set-url origin https://github.com/Finderchangchang/brewreel.git` 改过来，不改也能拉取。

## 开发者

```sh
cd integrations/deepseek-harness
npm test                  # 单测，零依赖，不启动 dsh
npm run smoke -- --runtime-dir <目录> --work <目录> --setup [--full]   # 直接调工具函数的冒烟测试
npm run sync              # 生成 skill/ 快照（打包前 prepack 自动跑，工作区有未提交改动会拒绝；确需打包设 BREWREEL_SYNC_ALLOW_DIRTY=1）
dsh plugin --profile dev add .   # 本地链接调试
```

发布（由作者操作）：确认 npm 包名未被占用 → `npm pack --dry-run` 核对文件清单 → `npm publish` → 给 GitHub 仓库打 `dsh-plugin` topic。

## 许可证与第三方

- 插件与 skill：Apache-2.0，见 `LICENSE`、`NOTICE`。
- Remotion 有自己的许可条款，公司使用可能需要购买商业许可，详见主仓库 `THIRD_PARTY_LICENSES.md`。
- 字体等第三方资源的许可同样见 `THIRD_PARTY_LICENSES.md`。

## 免责声明

校验规则整理自公开法规与平台规则，仅供自查，不构成法律意见。发布前的自查清单由你本人确认。
