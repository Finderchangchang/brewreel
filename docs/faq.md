# 常见问题

[← 返回 README](../README.md) · [English](faq.en.md)


<details>
<summary><b>背景音乐是怎么来的？</b></summary>

`scripts/make_bgm.py` 用 numpy / scipy 现场合成：乐器、和声、旋律、混音、母带都在脚本里，不用外部素材库。`make.mjs` 把每个镜头的起点传给它，一个镜头一个段落，按位置和情绪选写法（钩子、紧张、抬升、律动、高潮、收尾），音符落在整拍 / 半拍，镜头切换处有镲或加花，所以音乐是卡着镜头走的。响度用 ffmpeg 的 ebur128 校到 -16 LUFS（找不到 ffmpeg 就按 RMS 近似）。

因为是现场合成的，没有版权问题。正式发抖音这类平台时，也可以换成平台曲库里的音乐：出片时加 `--no-bgm` 出静音版，再在平台里配乐。

</details>

<details>
<summary><b>有没有配音？</b></summary>

有。v0.5.0 起接了 MiniMax 语音合成，v0.5.1 起也可以用阿里云（百炼 CosyVoice）和火山引擎（豆包语音）。分镜里写 `meta.voice` 和每镜的 `vo`，设好对应的环境变量（`MINIMAX_API_KEY` / `DASHSCOPE_API_KEY` / `VOLCENGINE_TTS_API_KEY`）后出片即可；镜头时长跟着旁白走，字幕逐字点亮，配乐在人声处自动压低。没有 key 时加 `--voice-provider mock` 用占位音预览节奏。不写 `meta.voice` 就和以前一样没有配音。用 AI 配音发布时，记得按平台要求勾选 AI 生成内容声明。

</details>

<details>
<summary><b>为什么画面是插画，不是实拍？</b></summary>

项目不生成「看起来像真实拍摄」的拟真图片。没有商家素材时，画面用组件和简笔插画兜底，并明确标注，不冒充实拍。有商家实拍照片（门店、成品、价目表）时，用实拍镜头放进去，可信度会好很多；照片是否授权会列进「需人工复核」。

</details>

<details>
<summary><b>成片能直接发吗？</b></summary>

还不建议。把成片当初稿：看完整片，改掉别扭的文案和重复的卖点再发；行业片把画面上每个价格、条件、日期、营业时间、距离逐条和简报对一遍。实测情况见[「已知限制」](limitations.md)。

</details>

<details>
<summary><b>要花钱吗？</b></summary>

本项目免费开源。模型调用用你自己的 API Key，按用量在服务商那边结算，项目不经手任何费用；渲染在你自己的电脑上跑。渲染引擎 Remotion 对 4 人及以上的营利组织收费，见下一条。

</details>

<details>
<summary><b>Remotion 要授权吗？升级到 5.0 要注意什么？</b></summary>

Remotion 是源码可见、非开源的软件：个人、3 人及以下的营利公司、非营利组织可免费使用（含商用）；**4 人及以上的营利组织需要购买 Remotion 的 Company License**，详见 <https://www.remotion.dev/license>。本仓库的 Apache-2.0 不改变 Remotion 自己的许可条件，见 `THIRD_PARTY_LICENSES.md`。

本仓库把 `remotion` / `@remotion/cli` 钉在 `4.0.529`。升级到 5.0 后，Remotion 免费层需要在配置里传 `licenseKey`（个人 / 3 人以下公司 / 非营利填 `"free-license"`），详见 [Remotion 许可证页](https://www.remotion.dev/license)。升级前请先看 `THIRD_PARTY_LICENSES.md`。

</details>

<details>
<summary><b>Windows 上要注意什么？</b></summary>

- 只支持 x64。
- 环境变量用 PowerShell 写法 `$env:LLM_API_KEY="..."`，不是 `export`。
- `--props` 报「neither valid JSON」：Windows shell 会吃掉 JSON 字符串里的引号，所以分镜一律用文件路径传入（`--props=./storyboard.json`），不要在命令行拼 JSON。`make.mjs` / `llm_make.py` 已经是文件传入方式。
- `make.mjs` 在 Windows 上调 `python`，在 macOS / Linux 上调 `python3`；装在别处的，设环境变量 `PYTHON` 指过去。

</details>

<details>
<summary><b>需要装系统 ffmpeg 吗？</b></summary>

不需要。拼图 `sheet.png` 由 Remotion 的 `Sheet` 合成直接出图（整片每秒一帧，缩略排成网格，每格下面标时间和镜号），检查帧 `check/*.png` 用 Remotion 自带的 ffmpeg 从成片里抽，抽不出来会改用 Remotion 单帧补。设了环境变量 `FFMPEG=/path/to/ffmpeg` 时，拼图会先用它的 `tile` 滤镜拼，失败再退回 `Sheet` 合成。拼图没生成不影响成片 `video.mp4`，终端会打印原因。

</details>

<details>
<summary><b><code>npm install</code> 后 lock 文件里缺某个平台的 compositor？</b></summary>

`package-lock.json` 里应该有 7 个 `@remotion/compositor-*` 平台包（win32-x64-msvc / darwin-arm64 / darwin-x64 / linux-x64-gnu / linux-x64-musl / linux-arm64-gnu / linux-arm64-musl）。如果你的平台对应的条目缺失，删掉 `template/node_modules` 和 `template/package-lock.json` 后在目标平台上重新 `npm install`（这是 npm 已知的可选依赖解析问题，跨平台生成的 lock 文件不一定包含所有平台）。

</details>

<details>
<summary><b>Chrome Headless Shell 下载失败？</b></summary>

国内网络环境下 `npx remotion browser ensure` 可能连不上 Google 的下载地址。可以手动下载后用 `--browser-executable` 指定本地 Chrome / Chromium 路径（不同 Chrome 版本渲染结果可能有细微差异）。

</details>

<details>
<summary><b>为什么叫「精酿」？</b></summary>

好酒靠的是配方，原料普通也能酿好。先让强模型把一种视频风格做到位，再把它的版式、动效、节奏和规则写成一份「配方」——现成组件加校验脚本；之后 DeepSeek 这类便宜模型就是普通原料，照着配方填分镜，就能酿出同一水准的片子。文档里的说法随之统一：风格包 = 配方，从参考视频提炼风格 = 调配方，出片 = 开酿。`styles/`、`meta.style`、`distill/` 这些路径和字段沿用原名。

</details>
