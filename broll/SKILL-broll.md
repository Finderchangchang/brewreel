# 口播配画面（给助手）

用户给 `talk.mp4`（`talk.srt` 可选，没有就自动转写）。你只写 `broll.json`。时间、费用、生成、合成都由脚本算。不要自己算毫秒，不要自己算秒数。

每步只跑下面写的那一条命令。失败就看脚本印出的「怎么改」，改完再跑同一条。

**AI 助手不许替人运行 `approve.mjs`。** 审片必须人自己看、人自己批准。

## 最省事：一条命令

```
node scripts/talk.mjs <项目目录> --out <仓库外目录>
```

它依次做三步，做过的步骤会跳过，一直重复跑同一条命令就行：

1. 转写：没有 `talk.srt` 就本地转写（第一次下载约 240MB 模型）。已有 `talk.srt` 永不覆盖。
2. 写 `broll.json`：没有就请便宜模型写（要 `DEEPSEEK_API_KEY` 或 `LLM_API_KEY`）；已有就跳过，加 `--rewrite-broll` 才重写。
3. 出片：就是下面的 `make-talk`，参数原样透传。预算、`--yes`、审片照旧。

它永远不跑 `approve.mjs`。退出码和 `make-talk` 一样。

## 分步流程

0. 没有 `talk.srt` 时先转写。

```
node scripts/broll/transcribe.mjs <项目目录>
```

可以改 `talk.srt` 里的错字。不要拆句、并句：句子号会错位，写好的 `broll.json` 就对不上了。

1. 列句子。

```
node scripts/broll/list-cues.mjs <项目目录>
```

2. 按下面的规则写 `<项目目录>/broll.json`。句子号用上一步印出的 `c1`、`c2`。不要写毫秒。

3. 校验。

```
node scripts/broll/validate.mjs <项目目录>
```

退出码 0 才继续。

4. 看估价。不生成。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --dry-run
```

把印出的「估价明细」给用户。`--out` 必须在仓库外面。

5. 等用户确认。用户同意之后才加 `--yes`。全片都是动效画面时不花钱，不用 `--yes`。

6. 生成。同一条命令，同一个 `--out`。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --yes
```

`provider` 是 `minimax-h3` 时，这一步会提交 AI 画面的任务。没有 `--yes` 会停，退出码 3。

7. 出审片页。

```
node scripts/broll/review-sheet.mjs <项目目录> --out <仓库外目录>
```

用浏览器打开输出目录里的 `review.html`。每段一行：原句、plain、风格、提示词、开头 / 中间 / 结尾 3 帧、费用、状态。动效段标「动效，不用审」，列出屏幕上的字。

8. 等人自己批准。人看完后自己跑：

```
node scripts/broll/approve.mjs <项目目录> --out <仓库外目录>
```

这会写 `broll.review.json`，绑定 `broll.json` 里 AI 画面的部分和每段 `clips/*.mp4` 的 sha256。改了其中任何一个，审片就失效，要人重新看、重新批准。只改动效段不会让审片失效。你不要跑这条。

9. 出正式片。同一条命令，同一个 `--out`。账本里已有的片段不会重新提交。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --yes
```

## 两种画面

- 动效画面（`"source": "motion"`）：免费。屏幕上的字全部从原句里摘，脚本逐字核对。不生成、不进账本、不审片、不加「AI 生成画面」标。
- AI 画面（`"source": "ai"` 或不写）：MiniMax H3 按风格生成，花钱，要审片。一部片默认最多 2 段，只给最需要画面的句子。

## 怎么挑句子

只给「这句话需要画面才能看懂」的句子配画面。开场、收尾、个人经历、情绪句留脸。

不要盖：`c1`、最后一句、`keepFace` 里的句子。段和段之间至少留 1 秒真人。所有画面加起来不超过全片 60%。动效段至少盖 1.8 秒，AI 段至少 2.5 秒，都不超过 12 秒。这些脚本会查。你不要算毫秒，用 `list-cues` 的句子号。

每句先按这张表定 `source` 和 `template`：

| 句子在干嘛 | job | source | template |
|---|---|---|---|
| 报一个确定的数（钱、时长、个数、倍数），原句里有这个数 | quantify | motion | counter |
| 列两到四样东西 | list | motion | checklist |
| 讲先后（先…再…最后） | explain 或 demonstrate | motion | steps |
| 前后、两种做法对比，原句两边都说了 | compare | motion | compare |
| 一句要观众记住的话、一个关键词 | stress | motion | keyword |
| 点一个地方或物件、只给气氛、动手做事、把两件事连起来 | ground、evoke、demonstrate、connect | ai | 不写，用风格 |

同一个模板全片最多用 2 次，相邻两段动效画面不要用同一个模板。

这些词出现时留脸，不要配画面：我觉得、我当时、说实话、后悔、我记得、我以为。脚本只警告，不拦截。你自己拿掉。

## 动效模板

| template | 什么时候用 | job | slots |
|---|---|---|---|
| keyword | 一句要记住的话 | stress、explain、evoke | `text` 必填，≤12 字；`hot` 可选，≤6 字，要在 `text` 里 |
| checklist | 列两到四样东西 | list | `title` 可选，≤8 字；`items` 2–4 条，每条 ≤10 字 |
| steps | 讲先后 | explain、demonstrate | `items` 2–4 条，每条 ≤8 字 |
| counter | 报一个确定的数 | quantify | `say` 必填，原句里带数字的那几个字连同单位；`from` 可选，单位和 `say` 一样；`label` 必填，≤12 字 |
| compare | 两种做法对比 | compare | `labels` 必填，只能选 `before-after`、`old-new`、`manual-auto`、`wrong-right`；`left`、`right` 各 1–2 条，每条 ≤10 字；`verdict` 可选，≤12 字 |

动效段的规矩：

- `slots` 里每个字都从这一段盖住的原句里原样复制（连着的几个字）。不许改写，不许换同义词，不许补字。
- 原句里紧挨在摘词前面的「不、没、别、无、非、未」要一起摘进来。
- 清单、步骤、对比两栏，按说话的先后写。
- 数字只写在 counter 的 `say` 和 `from` 里，照抄原句的写法（「二十五秒」就写「二十五秒」），不要换成阿拉伯数字。
- 约数（七八块）、「第几」、口语简写（一万二）不要用 counter，改用 keyword 或留脸。
- 转写错的字会照样上屏。先看一眼原句对不对，错字改 `talk.srt`。

## 风格（AI 画面用）

| style | 名字 | 适合 |
|---|---|---|
| `wood-blocks` | 积木风（默认） | 什么都能配，最适合步骤、数量、讲一样东西 |
| `clay-stopmotion` | 黏土定格 | 动手做事、点一个地方、给气氛、连接；不做 quantify |
| `paper-layers` | 分层纸艺 | 讲道理、点一个场景、对比、连接；镜头只平移和推近 |
| `ink-sketch` | 手绘线稿 | 讲道理、对比、数量、连接；最适合当副风格 |
| `brick-diorama` | 塑料积木（实验） | 实验风格，不是默认，生成的画面会出凸点，不建议用 |

- `style` 是主风格，必填。`styleAlt` 是副风格，可以不写；要写只能是主风格搭得上的那几个（`llm_broll` 和校验会列出来）。
- 副风格最多一个，只给讲道理、做对比的 AI 段，不超过 AI 段的一半。第一段 AI 画面用主风格。
- 想让一段 AI 画面接着上一段 AI 画面的结束画面：两段挨着、`look` 一样，后一段写 `"link": "continue"`。
- 每种风格能用哪些 job、哪些镜头，校验会按 `broll/styles/<id>/style.json` 查。

## 字段

顶层只写这些：

| 字段 | 写什么 |
|---|---|
| version | 写 `2`（v0.8 的老文件写 `1`，照常能跑，但没有动效画面和副风格） |
| style | 主风格，默认 `wood-blocks` |
| styleAlt | 副风格，可选 |
| thread | 一句不超过 20 字的主线，可选。只进审片页 |
| provider | `placeholder`、`local` 或 `minimax-h3`。只管 AI 画面段 |
| quality | `768P` 或 `2K` |
| budgetYuan | 预算，单位元 |
| captions | `add`、`none` 或 `burned` |
| keepFace | 必须露脸的句子号，例如 `["c5"]` |
| clips | 片段数组，1 到 12 段 |

每一段都写：

| 字段 | 写什么 |
|---|---|
| id | `b01`、`b02`，按顺序 |
| from / to | 句子号。一段可以盖连续的几句 |
| source | `motion`（动效画面）或 `ai`（AI 画面，可以不写） |
| mode | `full` 盖满，`pip` 右下角圆窗，`split` 上 60% 是画面、下 40% 是脸。`split` 只给竖版 |
| job | 按选择表 |
| plain | 这段画面在干嘛。不超过 20 字。不进画面 |

动效段另外只写 `template` 和 `slots`。不写 `place`、`subject`、`camera`、`action`、`end`、`beats`、`look`、`link`、`file`。

AI 段另外写：

| 字段 | 写什么 |
|---|---|
| place | 只写地点，例如「桌面」「小仓库」。不超过 12 字。不写材质 |
| subject | 只写「机器人」或「机器人和某样东西」。不超过 12 字。颜色和材质由脚本加 |
| camera | `static` `slow-push` `pull-back` `pan-left` `pan-right` `orbit` `top-down`，要在这个风格允许的范围里 |
| action + end | 一个动作和结束画面 |
| beats | 2 到 4 拍，每拍有 `action` 和 `end`。和上面的 `action` 二选一 |
| look | `main`（主风格，默认）或 `alt`（副风格） |
| link | `new`（默认）或 `continue` |
| file | 只有 `local` 才写，指向项目目录里的视频 |

AI 段不要写：毫秒、生成秒数、比例、分辨率、风格长描述、提示词全文、参考图、模型名、阿拉伯数字、引号、品牌和玩具名。

`captions` 为 `burned` 时只能用 `split`。`full` 和 `pip` 会盖住已经烧进原片的字幕。

字幕位置由模板决定：`full` 和 `pip` 在画面下方 1/4；`split` 贴在上下分界线上方，按行数往上留高，不压脸。

## 来源

- `placeholder`：AI 画面段用纯色占位，不花钱，不用审片，不用 `--yes`。
- `local`：AI 画面段用用户自己的视频，字段 `file` 指向项目目录里的文件。不花钱，不用审片。
- `minimax-h3`：AI 画面段真生成。先要有风格参考图。估价大于 `budgetYuan` 就停。估价没超也要 `--yes`。正式片要求每段 AI 画面都已审过。

动效段不管 `provider` 是什么都不花钱。

风格还没有参考图时，`make-talk` 会在提交前停下（退出码 2，没花钱），告诉你换哪个风格或改成动效。参考图由维护者出，不要自己跑：

```
node scripts/broll/make-style-refs.mjs --style <风格 id> --dry-run
```

## 断了再跑

命令中断后，用同一个 `--out` 再跑一次。账本里已有 task id 的段只查询，不重新提交。

只重做一段 AI 画面：

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --only b03 --yes
```

每段最多重做 2 次。第 3 次必须加 `--force-redo`，日志会写明。动效段不用重做：改了字直接重新出片。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --only b03 --yes --force-redo
```

多段一起提交时可以加 `--concurrency 3`。默认就是 3。

## 草稿

还没审、但要先看合成效果时加 `--draft`。只对 `minimax-h3` 生效。AI 画面出现时画面右上角有「B-roll 未审」。`manifest.json` 的 `draft` 为 true。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --yes --draft
```

`placeholder` 和 `local` 不用审，也不要加 `--draft`。

## 费用

只有 AI 画面花钱。按价目表，不按接口回执。回执里没有金额。

- 768P：0.5 元/秒
- 2K：0.8 元/秒
- 生成秒数由脚本把窗口向上取整，再夹到 4–15 秒。你不要算。估价会同时印出 AI 视频一共多少秒。
- 账本记实际输出秒数，费用 = 单价 × 实际秒数。
- 订阅套餐的 MiniMax key（`sk-cp-` 开头）不能按量付费：H3 视频不在套餐额度里，扣的是积分（768P 实测约 70 积分/秒，以 MiniMax 后台为准）。估价会多印一行「约 N 积分」。预算闸门照旧按元的价目表拦。

## 退出码

| 码 | 意思 | 你怎么做 |
|---|---|---|
| 0 | 交付了 | 把输出目录交给用户 |
| 1 | 校验没过 | 看「怎么改」，改 `broll.json`，再跑 validate |
| 2 | 参数错、缺文件、输出目录在仓库里、没有密钥、域名不是 https、风格没有参考图 | 按印出的那一句改，不要换一条新命令 |
| 3 | 估价超过预算、没加 `--yes`、重做次数到顶 | 超预算就减少 AI 画面段或提高 `budgetYuan`。没 `--yes` 就等用户确认。重做到顶就告诉用户，不要自己加 `--force-redo` |
| 4 | 转写、转码、生成、检查或渲染失败 | 看原因。不要自动再提交 |
| 5 | 还没审片 | 跑 review-sheet，把页面交给用户。不要跑 approve。用户只要草稿时才加 `--draft` |

## 常见报错

- 写完 `broll.json` 后字幕分句变了：拆句、并句以后句子号错位。重跑 `llm_broll` 重写，或把 `talk.srt` 的分句改回去。只改字没关系。
- 鉴权失败：停下。请用户核对 `MINIMAX_API_KEY` 和域名是不是同一区。不要重试，不要把密钥写进文件或日志。
- 余额不足：停下。不要再提交。写进报告。
- 内容审核拦截：停下。把原因告诉用户，改文案后再让用户决定要不要重做。不要自动重试。
- 提交结果不明：停下。不要再提交。请用户核对。
- 已有 task id：再跑同一条命令。脚本只查不重提。
- 下载失败：再跑同一条命令。脚本会重新查询新链接，不重新生成。
- 超过 30 分钟：task id 还在。再跑同一条命令，只查不重提。
- 黑帧或静帧：这段画面不合格。告诉用户，不要自动重做。
- 仓库里面：`--out` 改到仓库外的目录。
