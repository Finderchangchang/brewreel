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
