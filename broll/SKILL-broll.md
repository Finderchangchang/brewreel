# 口播配画面（给助手）

用户只给 `talk.mp4` 就行（`talk.srt` 可选，没有就本地自动转写）。你只写 `broll.json`。时间、费用、生成、合成都由脚本算。不要自己算毫秒，不要自己算秒数。

每步只跑下面写的那一条命令。失败就看脚本印出的「怎么改」，改完再跑同一条。

**AI 助手不许替人运行 `approve.mjs`。** 审片必须人自己看、人自己批准。

## 用户只给了视频：一条命令

```
node scripts/talk.mjs <项目目录> --out <仓库外目录>
```

项目目录里有 `talk.mp4` 就够。它依次做三步，做过的步骤会跳过，一直重复跑同一条命令就行：

1. 转写：没有 `talk.srt` 就本地转写（第一次下载约 240MB 模型）。已有 `talk.srt` 永不覆盖。
2. 写 `broll.json`：没有就请便宜模型写（要 `DEEPSEEK_API_KEY` 或 `LLM_API_KEY`）；已有就跳过，加 `--rewrite-broll` 才重写。没有 key 时，你照本文写好 `broll.json` 放进项目目录，再跑同一条命令。
3. 出片：就是下面的 `make-talk`，参数原样透传。预算、`--yes`、审片照旧。

便宜模型写出的 `provider` 是 `placeholder`：AI 画面先用纯色占位，不花钱，动效画面照常出。要真生成 AI 画面，在同一条命令后面加 `--provider minimax-h3 --dry-run` 看估价，用户同意后把 `--dry-run` 换成 `--yes`。

它永远不跑 `approve.mjs`。退出码和 `make-talk` 一样；第 2 步写 `broll.json` 时接口调用失败（断网、key 不对、余额不足）退出码是 4。

「再跑同一条命令」时去掉 `--rewrite-broll`、`--only`、`--force-redo`：它们只该生效一次（带着 `--rewrite-broll` 会重写一份没看过估价的方案，带着 `--only` 每次都会重做那一段、重新花钱）。脚本停下时会把下一条命令完整印出来，照抄那一条。`--rewrite-broll` 不能和 `--yes` 一起用。

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

3. 校验。`--max-ai 2` 顺便查 AI 画面不超过 2 段（用户要别的上限就换成那个数）。

```
node scripts/broll/validate.mjs <项目目录> --max-ai 2
```

退出码 0 才继续。

4. 看估价。不生成。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --dry-run
```

把印出的「估价明细」给用户。`--out` 必须在仓库外面。

5. 等用户确认。用户同意之后才加 `--yes`。`provider` 是 `placeholder` 或 `local`、或者全片都是动效画面时，不花钱，不用 `--yes`。

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
- AI 画面（`"source": "ai"` 或不写）：MiniMax H3 按风格生成，花钱，要审片。默认一部片最多 2 段（命令行 `--max-ai` 可以改，以「这次必须遵守」为准），只给最需要画面的句子。

## 怎么挑句子

只给「这句话需要画面才能看懂」的句子配画面。开场、收尾、个人经历、情绪句留脸。通常 3 到 6 段。

不要盖：`c1`、最后一句、`keepFace` 里的句子。段和段之间至少留 1 秒真人。所有画面加起来不超过全片 60%。动效段至少盖 1.8 秒，AI 段至少 2.5 秒，都不超过 12 秒。这些脚本会查。你不要算毫秒，用 `list-cues` 的句子号。

每句先按这张表定 `source` 和 `template`：

| 句子在干嘛 | job | source | template | mode | 别选 | 为什么 |
|---|---|---|---|---|---|---|
| 报一个确定的数（钱、时长、个数、倍数），原句里有这个数 | quantify | motion | counter | split 或 pip | checklist、steps、keyword、compare、AI 画面 | 这句就是在报这一个数。拆成清单或步骤，数就没了 |
| 列两到四样东西 | list | motion | checklist | split 或 pip；3 条以上才可以 full | counter、steps、compare、keyword、AI 画面 | 在列东西，不是报一个数，也没有先后，也不是新旧对比 |
| 讲先后（先…再…最后） | explain 或 demonstrate | motion | steps | split 或 pip；3 条以上才可以 full | checklist、counter、compare、keyword、AI 画面 | 有先有后。清单和对比看不出哪一步先做 |
| 前后、两种做法对比，原句先说旧的、后说新的（先说新的别用 compare） | compare | motion | compare | split 或 pip | checklist、steps、counter、keyword、AI 画面 | 只有先说旧的、后说新的才用 compare。先说新的就别用 compare，两栏对调意思会反 |
| 一句要观众记住的话、一个关键词 | stress | motion | keyword | split 或 pip，不许 full | checklist、steps、counter、compare、AI 画面 | 只要一句原话。不要拆成清单、步骤或两边对比 |
| 点一个地方或物件、只给气氛、动手做事、把两件事连起来 | ground、evoke、demonstrate、connect | ai | 不写，用风格 | full、pip 或 split | keyword、checklist、steps、counter、compare | 五种动效卡片盖不住地点、气氛或动作，这一句用 AI 画面 |

一句里只有一个数，用 counter，不要拆成 checklist 或 steps。约数（「大概」「左右」「几十」「上千」这类）不用 counter。counter 的数字落定已自动对齐说出这个数的时刻。

动效段默认写 `split`（上 60% 放画面、下 40% 露脸），横版原片写 `pip`：说话的人要留在画面里。keyword 写 `full` 会被拦；`full` 只给 3 条以上的 checklist、steps。同一个模板全片最多用 2 次，相邻两段动效画面不要用同一个模板。AI 画面超过上限（默认 2 段，命令行 `--max-ai` 可以改，以「这次必须遵守」为准）时，把不那么要紧的改成动效画面或留脸。

这些词出现时留脸，不要配画面：我觉得、我当时、说实话、后悔、我记得、我以为。脚本只警告，不拦截。你自己拿掉。

## 动效模板

| template | 什么时候用 | job | slots |
|---|---|---|---|
| keyword | 一句要记住的话 | stress、explain、evoke | `text` 必填，2–12 字；`hot` 可选，≤6 字，要在 `text` 里 |
| checklist | 列两到四样东西 | list | `title` 可选，≤8 字；`items` 2–4 条，每条 ≤10 字 |
| steps | 讲先后 | explain、demonstrate | `items` 2–4 条，每条 ≤8 字 |
| counter | 报一个确定的数 | quantify | `say` 必填，原句里带数字的那几个字连同单位；`from` 可选，单位和 `say` 一样；`label` 必填，≤12 字 |
| compare | 两种做法对比 | compare | `labels` 必填，只能选 `before-after`、`old-new`、`manual-auto`、`wrong-right`；`left`、`right` 各 1–2 条，每条 ≤10 字；`verdict` 可选，≤12 字 |

字数：汉字算 1，英文字母和数字算半个，空格不算。

动效段的规矩：

- `slots` 里每个字都从这一段盖住的原句里原样复制（连着的几个字）。不许改写，不许换同义词，不许补字。标点可以不抄。
- 原句里紧挨在摘词前面的否定（不、没、别、无、非、未，以及「不用」「不要」「不会」「没有」「don't」这类）要一起摘进来。数字前面有否定的，别用 counter，改用 keyword。
- 清单、步骤、对比两栏，按说话的先后写。
- 数字只写在 counter 的 `say` 和 `from` 里，照抄原句的写法（「二十五秒」就写「二十五秒」，字幕里是「3.5元」就写「3.5元」），不要自己换写法，不要补原句没有的数。
- 约数（七八块、三十多秒）、「第几」、口语简写（一万二）不要用 counter，改用 keyword 或留脸。英文口播的数要是阿拉伯数字（25 seconds）才能用 counter。
- `from` 要从开口就说到要点的那一句开始，`to` 停在最后一处上屏字所在的那一句。前后多盖了不相干的句子，校验会让你挪。
- 转写错的字会照样上屏。先看一眼原句对不对，错字改 `talk.srt`。转写时拿不准、还没人核对的字（提示里「转写拿不准的字」那一节）不要放进 `slots`。

## 五个模板的写法

每个例子先给原句，再给一整段。句子号换成 `list-cues` 印出的号，`slots` 里的字换成你那句原句里的字。不要照抄例子里的字。

keyword，原句 c2「花钱之前，它先报价」：

```json
{"id": "b01", "from": "c2", "to": "c2", "source": "motion", "mode": "split", "job": "stress", "template": "keyword", "plain": "先报价再花钱", "slots": {"text": "花钱之前它先报价", "hot": "先报价"}}
```

checklist，原句 c4「你要准备的只有两样东西：口播视频和预算」：

```json
{"id": "b02", "from": "c4", "to": "c4", "source": "motion", "mode": "split", "job": "list", "template": "checklist", "plain": "要准备两样东西", "slots": {"title": "要准备的", "items": ["口播视频", "预算"]}}
```

steps，原句 c6「做法分三步：先转写，再挑句子，最后出片」：

```json
{"id": "b03", "from": "c6", "to": "c6", "source": "motion", "mode": "split", "job": "explain", "template": "steps", "plain": "三步做完", "slots": {"items": ["先转写", "再挑句子", "最后出片"]}}
```

counter，原句 c8「整条视频只用了二十五秒」：

```json
{"id": "b04", "from": "c8", "to": "c8", "source": "motion", "mode": "split", "job": "quantify", "template": "counter", "plain": "只用二十五秒", "slots": {"say": "二十五秒", "label": "整条视频"}}
```

原句说「从七块降到三块」时，`from` 写「七块」，`say` 写「三块」。一格只放一个数。

compare，原句 c10「以前要自己手动剪，现在交给脚本来做」：

```json
{"id": "b05", "from": "c10", "to": "c10", "source": "motion", "mode": "split", "job": "compare", "template": "compare", "plain": "以前手动现在自动", "slots": {"labels": "old-new", "left": ["要自己手动剪"], "right": ["交给脚本来做"]}}
```

`labels` 只选一个词，栏标题（以前 / 现在）由脚本给。左栏写先说的旧做法，右栏写后说、胜出的新做法。原句先说新做法（「现在一分钱不用，以前要花七块钱」）就别用 compare，也不要把两栏对调，改用 keyword 或 checklist。

## 风格（AI 画面用）

| style | 名字 | 能做的 job | 镜头 | 能搭的副风格 |
|---|---|---|---|---|
| `wood-blocks` | 积木风（默认） | 全部 7 种 | 全部 7 种 | `paper-layers` |
| `clay-stopmotion` | 黏土定格 | demonstrate、ground、evoke、connect | static、slow-push、pull-back、pan-left、pan-right | `paper-layers` |
| `paper-layers` | 分层纸艺 | explain、ground、compare、connect | static、slow-push、pan-left、pan-right | `wood-blocks` |
| `ink-sketch` | 手绘线稿（实验） | 实验风格，参考图还没出，只能 `placeholder` 占位预览，也不能当副风格。用户没点名就不要选 | | |
| `brick-diorama` | 塑料积木（实验） | 实验风格，不是默认，只为 v0.8 的老文件保留。用户没点名就不要选 | | |

AI 画面的 7 种 job：demonstrate、explain、ground、compare、quantify、evoke、connect。`list`、`stress` 只给动效段。

- `style` 是主风格，必填。用户没说就写 `wood-blocks`。
- `styleAlt` 是副风格，可以不写；要写只能从上表「能搭的副风格」里挑一个。全片 AI 画面最多这两种风格。
- 副风格只给讲道理、做对比的 AI 段，不超过 AI 段的一半。第一段 AI 画面用主风格。用副风格的段写 `"look": "alt"`。
- 想让一段 AI 画面接着上一段 AI 画面的结束画面：两段在 `clips` 里挨着、`look` 一样，后一段写 `"link": "continue"`。上一段是动效段就接不上。
- 全片只有一个机器人。`subject` 只写「机器人」或「机器人和某样东西」，`place` 只写地点。颜色、材质、形状由脚本按风格和 `broll/character.json` 加，你写了会报错。

## AI 画面的写法

一个动作，原句 c12「把小仓库里的旧零件换成新的」：

```json
{"id": "b06", "from": "c12", "to": "c12", "source": "ai", "mode": "pip", "job": "demonstrate", "plain": "旧零件换成新的", "place": "小仓库", "subject": "机器人", "action": "从架子上取下旧方块换上新方块", "end": "架子变得整整齐齐", "camera": "slow-push"}
```

两拍动作写 `beats`，不写 `action` 和 `end`：

```json
"beats": [{"action": "拿起一块方块放到桌上", "end": "方块放在桌面中央"}, {"action": "再把一块方块靠上去", "end": "两块方块靠在一起"}]
```

用副风格做对比（顶层要有 `"styleAlt": "paper-layers"`，而且前面已经有一段主风格的 AI 画面）：

```json
{"id": "b07", "from": "c14", "to": "c14", "source": "ai", "mode": "split", "job": "compare", "look": "alt", "plain": "两种做法对照", "place": "两张桌子", "subject": "机器人", "action": "看向左边的乱方块再看向右边的齐方块", "end": "机器人站在整齐的那一桌前", "camera": "pan-right"}
```

## 字段

顶层只写这些：

| 字段 | 写什么 |
|---|---|
| version | 写 `2`（v0.8 的老文件写 `1`，照常能跑，但没有动效画面、副风格和新风格。老文件改成 2 以后，已经生成过的 AI 段会按新提示词重新生成、重新花钱） |
| style | 主风格，默认 `wood-blocks` |
| motionTheme | 可选。这一支片子的动效外观名字：`wood`、`clay`、`paper`、`ink`、`cutpaper-meadow`、`cutpaper-dusk`。不写就用主风格里的那套。`llm_broll --motion-look` 会写进这里 |
| styleAlt | 副风格，可选 |
| thread | 一句不超过 20 字的主线，可选。只进审片页 |
| provider | `placeholder`、`local` 或 `minimax-h3`。只管 AI 画面段 |
| quality | `768P` 或 `2K` |
| budgetYuan | 预算，单位元 |
| captions | `add`、`none` 或 `burned` |
| keepFace | 必须露脸的句子号，例如 `["c5"]` |
| clips | 片段数组，1 到 12 段，按时间先后排 |

每一段都写：

| 字段 | 写什么 |
|---|---|
| id | `b01`、`b02`，按顺序 |
| from / to | 句子号。一段可以盖连续的几句 |
| source | `motion`（动效画面）或 `ai`（AI 画面，可以不写） |
| mode | `full` 盖满，`pip` 右下角圆窗，`split` 上 60% 是画面、下 40% 是脸。`split` 只给竖版。动效段默认 `split`（横版 `pip`），keyword 不许 `full`，`full` 只给 3 条以上的 checklist、steps |
| job | 按选择表 |
| plain | 这段画面在干嘛。不超过 20 字。不进画面 |

动效段另外只写 `template` 和 `slots`。不写 `place`、`subject`、`camera`、`action`、`end`、`beats`、`look`、`link`、`file`。

AI 段另外写：

| 字段 | 写什么 |
|---|---|
| place | 只写地点，例如「桌面」「小仓库」。不超过 12 字。不写材质 |
| subject | 只写「机器人」或「机器人和某样东西」。不超过 12 字。不写颜色和材质 |
| camera | `static` `slow-push` `pull-back` `pan-left` `pan-right` `orbit` `top-down`，要在这个风格允许的范围里 |
| action + end | 一个动作和结束画面。action 不超过 24 字，end 不超过 16 字 |
| beats | 2 到 4 拍，每拍有 `action` 和 `end`。和上面的 `action` 二选一 |
| look | `main`（主风格，默认）或 `alt`（副风格） |
| link | `new`（默认）或 `continue` |
| file | 只有 `local` 才写，指向项目目录里的视频 |

AI 段不要写：毫秒、生成秒数、比例、分辨率、风格长描述、提示词全文、参考图、模型名、阿拉伯数字、百分号、引号、「写着」「标语」这类要画面出字的说法、品牌和玩具名。

`captions` 为 `burned` 时只能用 `split`。`full` 和 `pip` 会盖住已经烧进原片的字幕。横版原片加 `burned` 这一版不支持（split 只给竖版），脚本会在调模型之前停下。

字幕位置由模板决定：`full` 和 `pip` 在画面下方 1/4（pip 段左边放不下时整段挪到圆窗上方）；`split` 贴在上下分界线上方，按行数往上留高，不压脸。

## 来源

- `placeholder`：AI 画面段用纯色占位，不花钱，不用审片，不用 `--yes`。
- `local`：AI 画面段用用户自己的视频，字段 `file` 指向项目目录里的文件。不花钱，不用审片。
- `minimax-h3`：AI 画面段真生成。先要有风格参考图。估价大于 `budgetYuan` 就停。估价没超也要 `--yes`。正式片要求每段 AI 画面都已审过。

动效段不管 `provider` 是什么都不花钱。

风格还没有参考图时，`make-talk` 会在提交前停下（退出码 2，没花钱），告诉你换哪个风格或改成动效。这一版三个正式风格（`wood-blocks`、`clay-stopmotion`、`paper-layers`）的参考图已经随仓库发布；手绘线稿 `ink-sketch` 是实验风格，参考图还没出，用它只能 `placeholder` 占位预览。参考图由维护者出，出图要花钱，你不要自己跑 `make-style-refs.mjs`。

同一个 `--out` 里已经有 `minimax-h3` 生成的付费片段时，用 `placeholder` 或 `local` 跑会停下（退出码 2），不会把付费片段换成占位片。照提示加回 `--provider minimax-h3`，或者换一个 `--out`。

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
- 订阅套餐的 MiniMax key（`sk-cp-` 开头）不能按量付费：H3 视频不在套餐额度里，扣的是积分（768P 实测约 70 积分/秒，以 MiniMax 后台为准）。估价会多印一句「约 N 积分」。预算闸门照旧按元的价目表拦。

## 退出码

| 码 | 意思 | 你怎么做 |
|---|---|---|
| 0 | 交付了 | 把输出目录交给用户 |
| 1 | 校验没过 | 看「怎么改」，改 `broll.json`，再跑 validate。用 `talk.mjs` 时也可以加 `--rewrite-broll` 让模型重写（不带 `--yes`） |
| 2 | 参数错、缺文件、输出目录在仓库里、没有密钥、域名不是 https、风格没有参考图、缺完整版 ffmpeg、会盖掉付费片段、横版加 burned | 按印出的那一句改，不要换一条新命令 |
| 3 | 估价超过预算、没加 `--yes`、重做次数到顶 | 超预算就减少 AI 画面段或提高 `budgetYuan`。没 `--yes` 就等用户确认。重做到顶就告诉用户，不要自己加 `--force-redo` |
| 4 | 转写、转码、生成、检查或渲染失败；写 `broll.json` 时便宜模型的接口调用失败 | 看原因。接口失败就请用户检查 key、余额和网络。不要自动再提交 |
| 5 | 还没审片 | 跑 review-sheet，把页面交给用户。不要跑 approve。用户只要草稿时才加 `--draft` |

## 常见报错怎么改

校验报错一条一行：`哪一段.哪个字段：错在哪`，下一行是「怎么改」。照「怎么改」改那一处，别的不动。最常见的几种：

| 报错里写着 | 怎么改 |
|---|---|
| 「…」不在这一段盖住的口播里 | 你改写了原句。换成报错里给的「原句里最接近的」那几个字，或者从原句里重新摘连着的字 |
| 前面原句是「不用」，摘掉后意思反了 | 把那个否定一起摘进来，照报错给的写法改；counter 的数字前面有否定就改用 keyword |
| 右栏比左栏先说出来 / 两栏放反了 | 这句先说的是新做法，别用 compare，不要把两栏对调，改用 keyword 或 checklist |
| 卡片上的字用了转写时拿不准的字 | 这几个字先不上卡片：换一句，或者这句改成 AI 画面、留脸 |
| 里的数字是隔开说的 | 两个数中间隔着空格、换行或分句，不是一个数。只摘连着说的那个数，拿不准就改用 keyword |
| 里没有数字 / 里有 2 个数 | counter 的 `say` 要照抄原句里带数的那几个字，一格一个数。没有确定的数就改用 keyword |
| 这段在报数，AI 生成画面里的数字不可靠 | 这一段改成 `"source": "motion"`、`"template": "counter"`，删掉 place、subject、action、end、camera |
| 含数字「3」 / 含引号 / 含「写着」 | AI 段的字段里删掉阿拉伯数字、引号和要画面出字的说法 |
| 「template」只有动效画面才写 | 要做动效就加 `"source": "motion"` 并删掉 AI 段的字段；要 AI 画面就删掉 template 和 slots |
| motion 段不写「place」 | 动效段删掉 place、subject、camera、action、end、beats、look、link、file |
| 短于 1.8 秒 / 短于 2.5 秒 | 把 `to` 延到下一句，或者这句留脸 |
| 盖住了不许盖的第一句 c1（或最后一句、keepFace） | 把 `from` / `to` 挪开 |
| 之间只留了 0.68 秒真人画面 | 把后一段的 `from` 往后挪一句，或把前一段的 `to` 往前收 |
| 画面上的字要到第 3.8 秒才说出来 | 把 `from` 改成报错里给的句子号 |
| 最后一处字说完后，画面还要停 | 把 `to` 改成报错里给的句子号 |
| 和上一段 b01 都是 keyword / 已经用了 2 次 | 删掉不那么要紧的一段留脸（两段数字挨着时尤其这样），或者换一个模板 |
| keyword 不用 full / 只有 2 条，用 full 整屏太空 / counter 不用 full | 动效段改成 `split`（横版 `pip`），把说话的人留在画面里。`full` 只给 3 条以上的 checklist、steps |
| AI 画面写了 3 段，这次最多 2 段 | 按报错里的上限，只留最需要画面的几段，其余改成动效画面或删掉 |
| 第一段 AI 画面必须用主风格 | 这一段删掉 `look`；副风格留给后面讲道理、做对比的段 |
| 不搭配 / 没有叫「…」的风格 | `styleAlt` 换成报错里列的风格，或删掉 `styleAlt` |
| 不适合 quantify / 不用 orbit | 换成报错里列的 job 或镜头；报数改用动效 counter |
| 写了材质词 / 机器人前面写了颜色 | `subject` 只写「机器人」，`place` 只写地点 |
| 上一段 b01 是动效画面，接不上 | 删掉 `link`，或改成 `new` |
| 写完 broll.json 后字幕分句变了 | 拆句、并句以后句子号错位。重跑 `llm_broll` 重写，或把 `talk.srt` 的分句改回去。只改字没关系 |
| broll.json 解析失败 | JSON 格式错了：检查逗号、括号，JSON 的引号只用英文双引号 |

生成和出片时的报错：

- 风格还没有参考图：停下（退出码 2，没花钱）。按报错的做法选一种：换有参考图的风格（`wood-blocks`、`clay-stopmotion`、`paper-layers`）、改成动效画面或留脸、先用 `placeholder` 看排版。不要自己出参考图。
- 缺完整版 ffmpeg：停下（退出码 2）。请用户 `pip install imageio-ffmpeg`，或装好系统 ffmpeg，再跑同一条命令。
- 估价超过预算（退出码 3）：减少 AI 画面段（改成动效画面不花钱）、缩短 `from` / `to`，或请用户提高 `budgetYuan`。
- 鉴权失败：停下。请用户核对 `MINIMAX_API_KEY` 和域名是不是同一区。不要重试，不要把密钥写进文件或日志。
- 余额不足（订阅 key 就是积分不够）：停下。不要再提交。写进报告。
- 内容审核拦截：停下。把原因告诉用户，改文案后再让用户决定要不要重做。不要自动重试。
- 提交结果不明：停下。不要再提交。请用户核对。
- 提交被接口拒绝（参数错误这类，账本记 `submit_failed`）：停下（退出码 4）。这一段没有生成、没有扣费，报错里写着。再跑同一条命令不会自动重做；报错最后一行是只重做这一段的完整命令（带 `--only`）。把原因告诉用户，改好后再照那一条跑，不要自己反复重试。
- 已有 task id：再跑同一条命令。脚本只查不重提。
- 下载失败：再跑同一条命令。脚本会重新查询新链接，不重新生成。
- 超过 30 分钟：task id 还在。再跑同一条命令，只查不重提。
- 黑帧或静帧：这段画面不合格。告诉用户，不要自动重做。
- 转写失败（退出码 4）：照报错说的检查视频有没有声音、音量够不够；实在不行请用户自己放一个 `talk.srt`。
- 仓库里面：`--out` 改到仓库外的目录。
