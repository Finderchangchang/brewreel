# 场景写法（实验）

模型写语义，引擎算样子。这一屏说什么、强调哪几个字、用哪块版式、哪套风格、哪种动效性格，写在 `scene.json` 里。坐标、字号、出场秒数由引擎按原型、字数和配音时间算出来，再用安全区、字号和对比度检查。

这一版对外标成实验。`quiz` 和 `journey` 不走这条路，继续用原来的分镜。旧的 `storyboard.json`、`lesson.json`、`broll.json` 仍由现在的命令渲染，一行不用改。

![三套风格的开场](images/scene-compare.png)

## 六类轴

一条画面拆成六类，分开选：

| 轴 | 谁来写 | 写什么 |
|---|---|---|
| 内容单元 | 模型 | 这一屏的角色和文案：主张、条目、对比、截图、数字、片尾 |
| 版式原型 | 模型写名字，引擎排 | `hero`、`stack`、`grid`、`split`、`sequence`、`media`、`chart`、`end`、`board` |
| 风格 | 模型写名字 | 颜色、圆角、字重、质感。见下面「风格」 |
| 动效 | 模型写性格名 | `crisp`、`bounce`、`soft`、`paper`、`push` |
| 时间 | 引擎 | 有逐字配音走字的开始时间，没配音按拍。两种来源不混在同一屏 |
| 硬约束 | 引擎 | 安全区、字号下限、对比度不低于 4.5、第 0 帧已经有主文案 |

不要写坐标、像素、帧号、毫秒。`when` 是旁白里连续的几个字，不是秒。

## 版式原型

| 名字 | 适合 |
|---|---|
| `hero` | 一句主张，或一个大数字 |
| `stack` | 条目上下排 |
| `grid` | 最多 4 条，格子 |
| `split` | 左右对比 |
| `sequence` | 有先后的几步 |
| `media` | 一张图加标注。截图板用 `board` |
| `chart` | 至少两个能对上事实原文的数 |
| `board` | 资讯板：栏目标、判断句、证据或大数字 |
| `end` | 片尾：品牌和一句口号 |

内容种类和版式不是任意搭配。截图用 `role: "media"`、`layout: "board"`。大数字用 `role: "number"`，`text` 是数字加单位，最多 6 个字，而且必须是所引事实原文里连续的那一段。

## 风格

示例里用到的三套：

| 名字 | 产品 | 样子 |
|---|---|---|
| `fresh-light` | `promo` | A。渐变底，圆角卡片 |
| `editorial` | `lesson` | B。杂志。零圆角，重字重 |
| `techbrief` | `promo` | 资讯板。判断句直接写在舞台上，证据和条目仍是卡片。配 `push` |

宣传片还可以用 `template/src/core/themes.json` 里的主题名，另加 `techbrief`。讲课可以用 `template/src/lesson/style-tokens.json` 里的名字，示例用 `editorial`。

`editorial` 不要配 `bounce`。宣传片风格不要配 `paper`。`paper` 是口播纸片的性格。

## 动效性格

`crisp` 干净，`bounce` 回弹，`soft` 缓，`paper` 纸片，`push` 从下方推进。性格只决定入场曲线和提前量，不决定文案。

## 命令

从已经写好的 `scene.json` 出片：

```
node scripts/scene/make-scene.mjs <scene.json> --out <仓库外目录> [--style 名字] [--motion 性格] [--voice-provider minimax|aliyun|volcengine|mock] [--no-voice] [--no-bgm]
```

从简报到成片（先写场景，再出片）：

```
node scripts/scene/brief-to-video.mjs <brief.md|json> --out <仓库外目录> [--assets <素材清单.json>]
```

有旁白时要写 `--voice-provider`，或写 `--no-voice`。没写这两项，命令会停下来。没有这家密钥时，用 `--voice-provider mock` 看节奏。mock 不联网、不计费，是占位音，不能当交付。密钥只从环境变量读，不会打印，也不要写进文件。

配音按每一屏的 `narration` 合成，拿到逐字时间后再算这一屏多长。字幕固定在底部字幕带（9:16 下沿 y=1340，不进平台底栏，也不挪到顶部），逐字点亮，不铺底板。已经写在屏上的标题、判断句、数字和条目会从字幕里去掉，整句都重复时这一屏不出字幕。配乐复用现有脚本，人声处压低。检查没过时，成片改名为 `video.rejected.mp4`。

没有 DeepSeek 密钥时，一条龙会直接说明，并提示改跑 `make-scene.mjs`。

一句话改稿：

```
node scripts/revise.mjs <scene.json> "一句话"
```

能改屏上的文案、强调、版式名、风格名、性格名、疏密。不能改素材路径、事实原文、角色、画幅，也不能写坐标。改完会再跑校验和几何审计。

给便宜模型写场景的提示词，用 `scripts/scene/deepseek-layouts.mjs` 里导出的 `prompt`，不要另写一份。

可直接出片的示例：`examples/scene/a-fresh.json`、`examples/scene/b-editorial.json`、`examples/scene/c-techbrief.json`。

## 和旧写法的关系

旧分镜仍然是宣传片的正式写法。`scene.json` 是同一条宣传片里的实验入口，不另占分流表的一行。出片命令不同：旧的走 `scripts/make.mjs`，新的走 `scripts/scene/make-scene.mjs`。

## 已知限制

- 实验功能。校验和几何过了，也不等于可以当正式交付标准。
- `quiz`、`journey` 不拆进这套场景。
- 没配音的屏按拍计时。配了音的屏只用逐字时间。同一屏不会把两种来源混在一个时间对象里。
- 逐字字幕固定在底部带。和标题、kicker、证据、数字、条目相交就算检查失败，不会改放到画面顶部。
