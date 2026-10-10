# 第三方许可证 / Third-Party Licenses

## Remotion

本项目依赖 [Remotion](https://www.remotion.dev)（`template/` 下的渲染引擎）。Remotion 是**源码可见、非开源**的软件，有自己的许可证：

- 个人、3 人及以下的营利公司、非营利组织可以免费使用，包括商用。
- **4 人及以上的营利组织需要向 Remotion 购买 Company License。**

详见 <https://www.remotion.dev/license> 和 <https://www.remotion.pro/license>。

本仓库的 Apache-2.0 许可证只管本仓库自己的代码（分镜校验、行业规则、镜头组件的调用方式等），不改变 Remotion 本身的许可条件。本仓库把 `remotion` 和 `@remotion/cli` 钉在 `4.0.529` 这个确切版本；Remotion 5.0 发布后如果升级，需要在配置里传 `licenseKey`（免费用户传 `"free-license"`），见 README 的 FAQ。

English: This project depends on [Remotion](https://www.remotion.dev) as its
rendering engine. Remotion is **source-available, not open source**, and has
its own license: free for individuals, for-profit companies with 3 or fewer
people, and non-profits, including commercial use; **for-profit
organizations with 4 or more people must purchase a Company License**. See
<https://www.remotion.dev/license> and <https://www.remotion.pro/license>.
This repository's Apache-2.0 license covers only this repository's own code and
does not change Remotion's own license terms.

## Noto Sans SC

- 路径：`template/public/NotoSansSC-VF.ttf`，许可证全文：`template/public/fonts/NotoSansSC/OFL.txt`
- 许可证：SIL Open Font License 1.1
- 来源：google/fonts 仓库 `ofl/notosanssc/OFL.txt`
- 版权声明（保留字体名 "Source"）：Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.
- 字体文件未做子集化（子集化算修改，会触发保留名限制）。

## Cascadia Mono

- 路径：`template/public/CascadiaMono.ttf`，许可证全文：`template/public/fonts/CascadiaMono/LICENSE`
- 许可证：SIL Open Font License 1.1
- 来源：microsoft/cascadia-code 仓库
- 版权声明（保留字体名 "Cascadia Code"）：Copyright (c) 2019 - Present, Microsoft Corporation, with Reserved Font Name Cascadia Code.
- 字体文件未做子集化。

两款字体均通过 `template/src/core/font.ts` 用原生 `FontFace` + `staticFile` 在本地加载，渲染时不需要联网下载字体。

## Noto Serif SC（子集，族名 BrewReel Serif）

- 路径：`template/public/NotoSerifSC-VF.ttf`，许可证全文：`template/public/fonts/NotoSerifSC/OFL.txt`
- 许可证：SIL Open Font License 1.1
- 版权声明（保留字体名 "Source"）：Copyright 2017-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.
- 这是修改版。字表按 GB 2312 的 6763 个汉字，加上 ASCII、常用标点和全角符号，以及讲课样例和领域包里出现过的字，做了子集，并保留可变字重。
- 原族名是 Noto Serif SC，不含保留名 Source。子集算修改，主字体名已改为 BrewReel Serif，PostScript 名 BrewReelSerif。代码里的 `PSerif` 回退名与此一致。

## LXGW WenKai（子集，族名 BrewReel Kai）

- 路径：`template/public/LXGWWenKai-Regular.ttf`，许可证全文：`template/public/fonts/LXGWWenKai/OFL.txt`
- 许可证：SIL Open Font License 1.1
- 版权声明（保留字体名 "LXGW WenKai"）：Copyright (c) 2021-2024 LXGW (https://github.com/lxgw/LxgwWenKai), with Reserved Font Name 'LXGW WenKai'.
- 这是修改版。字表与上面的衬线子集相同。原主字体名就是保留名 LXGW WenKai，子集后改为 BrewReel Kai，PostScript 名 BrewReelKai。代码里的 `PKai` 回退名与此一致。

## Open Peeps

- 路径：`template/src/vendor/react-peeps/`，声明：`template/src/vendor/react-peeps/OPEN_PEEPS.txt`
- 人物线稿：Open Peeps，作者 Pablo Stanley，CC0 1.0，<https://www.openpeeps.com/>
- React 组件：react-peeps，MIT License，Copyright (c) 2020-present, Emre Çakır。许可证全文：`template/src/vendor/react-peeps/LICENSE`

English: Noto Serif SC and LXGW WenKai ship as SIL OFL 1.1 subsets. Because
subsetting is a modification and both licenses declare a Reserved Font Name
(`Source`, and `LXGW WenKai`), the primary family names in the subset files are
BrewReel Serif and BrewReel Kai. Open Peeps artwork by Pablo Stanley is CC0
1.0. The React components in `template/src/vendor/react-peeps/` are react-peeps,
MIT, Copyright (c) 2020-present, Emre Çakır.

## vidmuse-video-creator

口播里「哪几句该配解释画面」的选段方法，参考了 [erduo1998-cell/vidmuse-video-creator](https://github.com/erduo1998-cell/vidmuse-video-creator)。

- 许可证：MIT License
- 版权声明：Copyright (c) 2026 Erduo (Liu Ran)
- 我们按自己的字段、校验和积木风重写了这一步。没有拷贝它的文字，也没有使用它的素材。

English: The method for choosing which spoken lines need explanatory B-roll
refers to [erduo1998-cell/vidmuse-video-creator](https://github.com/erduo1998-cell/vidmuse-video-creator)
(MIT License, Copyright (c) 2026 Erduo (Liu Ran)). This project rewrote that
step with its own fields, checks and brick look. It does not copy that
project's text or assets.

## SenseVoice（转写模型）

口播配画面的本地转写用 SenseVoice Small 模型（int8 量化，2024-07-17 版），由 sherpa-onnx 项目转换成 ONNX 格式。

- 模型：SenseVoice，FunAudioLLM / 阿里巴巴通义实验室，<https://github.com/FunAudioLLM/SenseVoice>
- 转换版：<https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17>，用到 `model.int8.onnx` 和 `tokens.txt` 两个文件
- 许可证：FunASR 模型开源协议（FunASR Model Open Source License Agreement）1.1 版，<https://github.com/modelscope/FunASR/blob/main/MODEL_LICENSE>
- 版权声明：Copyright (C) 2023-2028 Alibaba Group. All rights reserved.
- 协议允许使用、复制、修改和分享；使用、复制、修改和分享时要注明出处和作者信息，并保留相关模型名称（SenseVoice）；违反协议条款，许可自动终止。
- 本仓库不附带模型文件。第一次转写时按顺序从魔搭（第三方上传的副本，两个文件的 sha256 已核对与官方一致）、HuggingFace、hf-mirror 下载到本机缓存，按写死的 sha256 校验，对不上不用。
- 本仓库的 Apache-2.0 许可证不覆盖这个模型，模型的使用条件以上面的协议为准。

English: Local transcription for talking-head B-roll uses the SenseVoice Small
model (int8, 2024-07-17), by FunAudioLLM / Alibaba Tongyi Lab
(<https://github.com/FunAudioLLM/SenseVoice>), converted to ONNX by the
sherpa-onnx project
(<https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17>;
files `model.int8.onnx` and `tokens.txt`). License: FunASR Model Open Source
License Agreement, Version 1.1
(<https://github.com/modelscope/FunASR/blob/main/MODEL_LICENSE>), Copyright (C)
2023-2028 Alibaba Group. All rights reserved. The agreement allows use, copying,
modification and sharing; you must attribute the source and author information
and retain the relevant model names (SenseVoice); the license terminates
automatically if its terms are violated. This repository does not ship the
model files: the first transcription downloads them to a local cache from
ModelScope (a third-party copy whose sha256 matches the official files),
HuggingFace or hf-mirror, and checks them against fixed sha256 values. This
repository's Apache-2.0 license does not cover the model.

## sherpa-onnx

- 包：`sherpa-onnx-node` 1.13.8 和对应平台的包（如 `sherpa-onnx-win-x64`），写在 `template/package.json` 里，由 npm 安装，不随本仓库分发。用来在本机运行转写模型。
- 来源：k2-fsa/sherpa-onnx（The next-gen Kaldi team），<https://github.com/k2-fsa/sherpa-onnx>
- 许可证：Apache License 2.0
- 平台包里带有 ONNX Runtime 的动态库（Microsoft，MIT License，<https://github.com/microsoft/onnxruntime>）。

English: `sherpa-onnx-node` 1.13.8 and its platform packages (for example
`sherpa-onnx-win-x64`) are listed in `template/package.json` and installed by
npm; they are not shipped in this repository. They run the transcription model
locally. Source: k2-fsa/sherpa-onnx (The next-gen Kaldi team),
<https://github.com/k2-fsa/sherpa-onnx>, Apache License 2.0. The platform
packages include ONNX Runtime libraries (Microsoft, MIT License,
<https://github.com/microsoft/onnxruntime>).

## pinyin-pro

- 包：`pinyin-pro` 3.x，写在 `template/package.json` 里，由 npm 安装，不随本仓库分发。转写校对时用它比对读音，决定一处改字能不能自动落地。
- 来源：<https://github.com/zh-lx/pinyin-pro>
- 许可证：MIT License
- 版权声明：Copyright (c) 2022-present zh-lx

English: `pinyin-pro` 3.x is listed in `template/package.json` and installed by
npm; it is not shipped in this repository. The transcription proofreading pass
uses it to compare pronunciations before applying a character fix. Source:
<https://github.com/zh-lx/pinyin-pro>, MIT License, Copyright (c) 2022-present
zh-lx.
