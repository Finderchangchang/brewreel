# 口播配 B-roll（给助手）

用户给 `talk.mp4` 和 `talk.srt`。你只写 `broll.json`。时间、费用、生成、合成都由脚本算。不要自己算毫秒，不要自己算秒数。

每步只跑下面写的那一条命令。失败就看脚本印出的「怎么改」，改完再跑同一条。

**AI 助手不许替人运行 `approve.mjs`。** 审片必须人自己看、人自己批准。

## 流程

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

5. 等用户确认。用户同意之后才加 `--yes`。

6. 生成。同一条命令，同一个 `--out`。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --yes
```

`provider` 是 `minimax-h3` 时，这一步会提交任务。没有 `--yes` 会停，退出码 3。

7. 出审片页。

```
node scripts/broll/review-sheet.mjs <项目目录> --out <仓库外目录>
```

用浏览器打开输出目录里的 `review.html`。每段一行：原句、plain、提示词、开头 / 中间 / 结尾 3 帧、费用、状态。

8. 等人自己批准。人看完后自己跑：

```
node scripts/broll/approve.mjs <项目目录> --out <仓库外目录>
```

这会写 `broll.review.json`，绑定 `broll.json` 和每段 `clips/*.mp4` 的 sha256。改了其中任何一个，审片就失效，要人重新看、重新批准。你不要跑这条。

9. 出正式片。同一条命令，同一个 `--out`。账本里已有的片段不会重新提交。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --yes
```

## 来源

- `placeholder`：纯色占位，不花钱，不用审片，不用 `--yes`。
- `local`：用户自己的视频，字段 `file` 指向项目目录里的文件。不花钱，不用审片。
- `minimax-h3`：真生成。先要有风格参考图。估价大于 `budgetYuan` 就停。估价没超也要 `--yes`。正式片要求每段都已审过。

参考图还没有时，先估价再生成。已有的图不会覆盖。

```
node scripts/broll/make-style-refs.mjs
node scripts/broll/make-style-refs.mjs --yes
```

## 怎么挑句子

只给「这句话需要画面才能看懂」的句子配 B-roll。开场、收尾、个人经历、情绪句留脸。

不要盖：`c1`、最后一句、`keepFace` 里的句子。段和段之间至少留 1 秒真人。B-roll 总长不超过全片 60%。这些脚本会查。你不要算毫秒，用 `list-cues` 的句子号。

| job | 什么时候用 |
|---|---|
| demonstrate | 句子在讲一个动手的步骤 |
| explain | 句子在讲流程，需要画面把步骤摊开 |
| ground | 句子点了一个具体的地方或物件 |
| compare | 句子在比前后两种状态。画面里不要写字 |
| quantify | 句子在讲多少、多大。用方块数量表现，提示词里不要写数字 |
| evoke | 只给产品的气氛。不给说话人的心情 |
| connect | 两件具体的东西之间的过渡 |

这些词出现时留脸，不要配 B-roll：我觉得、我当时、说实话、后悔、我记得、我以为。脚本只警告，不拦截。你自己拿掉。

## 字段

顶层只写这些：

| 字段 | 写什么 |
|---|---|
| version | 固定 `1` |
| style | 现在只有 `brick-diorama` |
| provider | `placeholder`、`local` 或 `minimax-h3` |
| quality | `768P` 或 `2K` |
| budgetYuan | 预算，单位元 |
| captions | `add`、`none` 或 `burned` |
| keepFace | 必须露脸的句子号，例如 `["c5"]` |
| clips | 片段数组 |

每一段：

| 字段 | 写什么 |
|---|---|
| id | `b01`、`b02`，按顺序 |
| from / to | 句子号。一段可以盖连续的几句 |
| mode | `full` 盖满，`pip` 右下角圆窗，`split` 上 60% 是 B-roll、下 40% 是脸。`split` 只给竖版 |
| job | 上表里的七个词 |
| plain | 这句在画面上做什么。不超过 20 字。不进提示词 |
| place | 地点。不超过 12 字 |
| subject | 谁。不超过 12 字。全片同一个机器人 |
| camera | `static` `slow-push` `pull-back` `pan-left` `pan-right` `orbit` `top-down` |
| action + end | 一个动作和结束状态 |
| beats | 2 到 4 拍，每拍有 `action` 和 `end`。和上面的 `action` 二选一 |
| file | 只有 `local` 才写，指向项目目录里的视频 |

不要写：毫秒、生成秒数、比例、分辨率、风格长描述、提示词全文、参考图、模型名、数字、引号、品牌词。

`captions` 为 `burned` 时只能用 `split`。`full` 和 `pip` 会盖住已经烧进原片的字幕。

字幕位置由模板决定：`full` 和 `pip` 在画面下方 1/4；`split` 贴在上下分界线上方，压在 B-roll 底部，不压脸。

## 断了再跑

命令中断后，用同一个 `--out` 再跑一次。账本里已有 task id 的段只查询，不重新提交。

只重做一段：

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --only b03 --yes
```

每段最多重做 2 次。第 3 次必须加 `--force-redo`，日志会写明。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --only b03 --yes --force-redo
```

多段一起提交时可以加 `--concurrency 3`。默认就是 3。

## 草稿

还没审、但要先看合成效果时加 `--draft`。只对 `minimax-h3` 生效。B-roll 出现时画面右上角有「B-roll 未审」。`manifest.json` 的 `draft` 为 true。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --yes --draft
```

`placeholder` 和 `local` 不用审，也不要加 `--draft`。

## 费用

按价目表，不按接口回执。回执里没有金额。

- 768P：0.5 元/秒
- 2K：0.8 元/秒
- 参考图：0.025 元/张，最多 4 张
- 生成秒数由脚本把窗口向上取整，再夹到 4–15 秒。你不要算。
- 账本记实际输出秒数，费用 = 单价 × 实际秒数。

## 退出码

| 码 | 意思 | 你怎么做 |
|---|---|---|
| 0 | 交付了 | 把输出目录交给用户 |
| 1 | 校验没过 | 看「怎么改」，改 `broll.json`，再跑 validate |
| 2 | 参数错、输出目录在仓库里、没有密钥、域名不是 https、没有参考图 | 按印出的那一句改，不要换一条新命令 |
| 3 | 估价超过预算、没加 `--yes`、重做次数到顶 | 超预算就减少段或提高 `budgetYuan`。没 `--yes` 就等用户确认。重做到顶就告诉用户，不要自己加 `--force-redo` |
| 4 | 生成、检查或渲染失败 | 看原因。不要自动再提交 |
| 5 | 还没审片 | 跑 review-sheet，把页面交给用户。不要跑 approve。用户只要草稿时才加 `--draft` |

## 常见报错

- 鉴权失败：停下。请用户核对 `MINIMAX_API_KEY` 和域名是不是同一区。不要重试，不要把密钥写进文件或日志。
- 余额不足：停下。不要再提交。写进报告。
- 内容审核拦截：停下。把原因告诉用户，改文案后再让用户决定要不要重做。不要自动重试。
- 提交结果不明：停下。不要再提交。请用户核对。
- 已有 task id：再跑同一条命令。脚本只查不重提。
- 下载失败：再跑同一条命令。脚本会重新查询新链接，不重新生成。
- 超过 30 分钟：task id 还在。再跑同一条命令，只查不重提。
- 黑帧或静帧：这段画面不合格。告诉用户，不要自动重做。
- 仓库里面：`--out` 改到仓库外的目录。
