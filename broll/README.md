# 口播配 B-roll

用户给一段口播（`talk.mp4`），字幕 `talk.srt` 可以自己给，没有就本地转写。模型只写 `broll.json`，脚本负责校验、算时间和费用、生成画面、合成成片。

画面两种：动效画面（`"source": "motion"`，免费，字全部照抄原话）和 AI 画面（`"source": "ai"` 或不写，按风格生成）。AI 画面的来源可以是 `placeholder`（纯色占位片，不花钱）、`local`（用户自己的视频）或 `minimax-h3`（MiniMax H3 图生视频，按价目表花钱）。

给人看的说明在 [`docs/broll.md`](../docs/broll.md)，给助手看的步骤在 [`SKILL-broll.md`](SKILL-broll.md)。English: [`docs/broll.en.md`](../docs/broll.en.md), [`SKILL-broll.en.md`](SKILL-broll.en.md).

## 目录

| 路径 | 做什么 |
|---|---|
| `schema/broll.schema.json` | `broll.json` 的字段定义（version 1 和 2） |
| `styles/<id>/style.json` | AI 画面的风格包：材质和画法、允许的 job 和运镜、能搭的副风格、参考图清单和出图提示。现有风格见 [`styles/README.md`](styles/README.md) |
| `character.json` | 所有风格共用的机器人：形状和色号 |
| `SKILL-broll.md` | 给助手的步骤。英文对照是 `SKILL-broll.en.md`。`llm_broll` 会把它整份放进给便宜模型的提示 |
| `banned-words.json` | 品牌和敏感词。出现在 AI 段文案里就报错，并给替换说法 |

宣传片的 `styles/`、`industries/` 跟这里无关。

## 命令

```
node scripts/talk.mjs <项目目录> --out <仓库外目录> [--provider placeholder|local|minimax-h3] [--dry-run] [--yes] [--draft]
                      [--style wood-blocks] [--max-ai 2] [--budget 20] [--captions add|none|burned]
                      [--lang auto|zh|en|yue|ja|ko] [--terms "词1,词2"] [--no-fix] [--rewrite-broll]
                      [--only b01] [--concurrency 3] [--force-redo] [--keep] [--allow-in-repo]
node scripts/broll/transcribe.mjs <项目目录> [--lang auto|zh|en|yue|ja|ko] [--terms "词1,词2"] [--no-fix] [--force]
node scripts/broll/list-cues.mjs <项目目录>
node scripts/broll/llm_broll.mjs <项目目录> [--style wood-blocks] [--budget 20] [--captions add|none|burned] [--max-ai 2]
                                 [--lang auto|zh|en|yue|ja|ko] [--terms "词1,词2"] [--no-fix] [--dry-run]
node scripts/broll/validate.mjs <项目目录> [--max-ai 2]
node scripts/broll/motion.mjs <项目目录>
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> [--dry-run] [--provider placeholder|local|minimax-h3] [--yes] [--draft]
                           [--only b01] [--concurrency 3] [--force-redo] [--keep] [--allow-in-repo]
node scripts/broll/review-sheet.mjs <项目目录> --out <仓库外目录>
node scripts/broll/approve.mjs <项目目录> --out <仓库外目录>
node scripts/broll/make-style-refs.mjs --style <风格 id> [--only refs/character.jpg] [--n 1-4] [--dry-run] [--yes]
```

- `talk.mjs` 把转写、`llm_broll`、`make-talk` 串成一条：已有 `talk.srt` 就不转写，已有 `broll.json` 就不重写（`--rewrite-broll` 才重写），出片的参数原样交给 `make-talk`。它永远不跑 `approve.mjs`。
- `motion.mjs` 只查动效段，打印每段的时间窗、上屏的字和每个字出现的时刻。
- `make-style-refs.mjs` 给维护者出风格参考图（image-01，花钱），普通用户不用跑。
- 项目目录里要有 `talk.mp4`；`make-talk` 还要 `talk.srt` 和 `broll.json`。`--out` 不能写在仓库里面。`--dry-run` 只校验、写 `broll.plan.json` 和估价，不生成。`minimax-h3` 即使没超预算，也要先看估价，再加 `--yes` 才生成。`placeholder` 和 `local` 估价为 0 时不用 `--yes`。
- `minimax-h3` 出正式片前，每段 AI 画面都要人自己跑过 `approve.mjs`。AI 助手不许替人运行 approve。`--draft` 可以跳过审片，成片在 AI 画面出现时右上角写「B-roll 未审」，`manifest.json` 里 `draft` 为 true。

## 模型只写这些

顶层：`version`（写 2；v0.8 的老文件是 1，照常能跑）、`style`（主风格，默认 `wood-blocks`）、可选 `styleAlt`（副风格，只能选主风格 `pairsWith` 里的）、可选 `thread`（≤20 字，只进审片页）、`provider`、`quality`（`768P` / `2K`）、`budgetYuan`、`captions`（`burned` / `add` / `none`）、`keepFace`、`clips`（1–12 段）。

每一段都写：`id`（`b01`）、`from` / `to`（句子号 `c1`…）、`source`（`motion` 或 `ai`，不写算 `ai`）、`mode`（`full` / `pip` / `split`）、`job`、`plain`（≤20 字，不进画面）。

- 动效段（`"source": "motion"`）另外只写 `template`（`keyword` `checklist` `steps` `counter` `compare`）和 `slots`。`job` 跟着模板：keyword 配 `stress` `explain` `evoke`，checklist 配 `list`，steps 配 `explain` `demonstrate`，counter 配 `quantify`，compare 配 `compare`。各模板的槽位和例子见 `SKILL-broll.md`。
- AI 段另外写 `place` / `subject`（各 ≤12 字；`subject` 只写「机器人」或「机器人和某样东西」，都不写颜色和材质）、`camera`（`static` `slow-push` `pull-back` `pan-left` `pan-right` `orbit` `top-down`，要在风格允许的范围里），可选 `look`（`main` / `alt`）、`link`（`new` / `continue`）。`job` 是 `demonstrate` `explain` `ground` `compare` `quantify` `evoke` `connect` 之一，也要在风格允许的范围里。动作要么写 `action`（≤24 字）+ `end`（≤16 字），要么写 `beats`（2–4 拍），不要两个都写。`file` 只有 `provider` 为 `local` 时才写。

不要写：毫秒、生成秒数、比例、分辨率、风格描述、禁用词、参考图、模型名、提示词全文。AI 段里不要写阿拉伯数字、百分号、引号。

## 脚本会做的事

- 窗口 = 起句开始前 120 毫秒到止句结束后 200 毫秒。AI 段生成秒数向上取整，夹在 4–15 秒。
- 动效段 1.8–12 秒，AI 段 2.5–12 秒；段与段之间至少 1 秒真人；所有画面总长不超过全片 60%。第一句、最后一句、`keepFace` 不能盖。
- 动效段：上屏的字按位置从字幕原文里拷出来，不在原句里就报错；摘词前面的否定字要一起摘；数字只经 counter 的 `say` / `from`，由脚本换算；同一模板全片最多 2 次，相邻动效段不同模板。有转写缓存时用逐字时刻，没有就按字数估。
- AI 段：按 `look` 选风格和参考图，拼提示词（共用机器人规格、材质、地面、镜头），拼好后查泄漏词；风格最多两种，副风格不超过 AI 段一半，第一段用主风格，来回切不超过 2 次。
- `captions` 为 `burned` 时不能用 `full` / `pip`（会盖住烧进去的字幕）。`split` 只给竖版。
- 原片是 HEVC、可变帧率、单声道、带旋转标记、奇数宽高或非整数帧率时，先转成 H.264 恒定帧率存在 `<项目目录>/.brewreel/`，原片不动。
- 单价：768P 0.5 元/秒，2K 0.8 元/秒。参考图 image-01 每张 0.025 元。动效段、占位片和本地文件按 0 元。接口回执没有金额，账本按价目表乘实际秒数。超过 `budgetYuan` 就停，退出码 3。`MINIMAX_API_KEY` 以 `sk-cp-` 开头（订阅 key）时，估价另印积分（768P 约 70 积分/秒，以 MiniMax 后台为准），预算闸门仍按元。
- 已有 task id 时只查询，不重新提交。下载链接过期就重新查询拿新链接，不重新生成。同一段最多重做 2 次，第 3 次要加 `--force-redo`。缺参考图时在写账本之前停下，退出码 2，没花钱。
- 退出码：0 交付，1 校验没过，2 参数或目录或密钥或缺参考图，3 超预算、没加 `--yes`、或重做次数到顶，4 转写、转码、生成、检查或渲染失败，5 还没审片。

## 环境变量

| 变量 | 用途 |
|---|---|
| `DEEPSEEK_API_KEY` / `LLM_API_KEY` | `llm_broll` 写 `broll.json`、转写后校对。`LLM_API_KEY` 优先 |
| `LLM_BASE_URL` / `LLM_MODEL` | 默认 `https://api.deepseek.com`、`deepseek-flash` |
| `MINIMAX_API_KEY` | `minimax-h3` 生成、出参考图 |
| `MINIMAX_BASE_URL` | 默认 `https://api.minimaxi.com`，只收 https |
| `BREWREEL_ASR_DIR` | 转写模型缓存目录（默认 Windows `%LOCALAPPDATA%\brewreel\asr`，macOS / Linux `~/.cache/brewreel/asr`） |
| `BREWREEL_ASR_MODEL_DIR` | 直接用手动下载好的模型目录（里面放 `model.int8.onnx` 和 `tokens.txt`），不下载 |
