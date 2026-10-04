# 口播配 B-roll

用户给一段口播（`talk.mp4`）和字幕（`talk.srt`）。模型只写 `broll.json`，脚本负责校验、算时间和费用、生成画面、合成成片。

来源可以是 `placeholder`（纯色占位片，不花钱）、`local`（用户自己的视频）或 `minimax-h3`（MiniMax H3 图生视频，按价目表花钱）。给助手看的步骤在 `SKILL-broll.md`。

## 目录

| 路径 | 做什么 |
|---|---|
| `schema/broll.schema.json` | `broll.json` 的字段定义 |
| `styles/brick-diorama/style.json` | 积木风：固定画面描述、运镜词、参考图文件名 |
| `SKILL-broll.md` | 给助手的步骤。英文对照是 `SKILL-broll.en.md` |
| `banned-words.json` | 品牌和敏感词。出现在文案里就报错，并给替换说法 |

宣传片的 `styles/`、`industries/` 跟这里无关。

## 命令

```
node scripts/broll/list-cues.mjs <项目目录>
node scripts/broll/validate.mjs <项目目录>
node scripts/broll/make-style-refs.mjs [--yes]
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> [--dry-run] [--provider placeholder|local|minimax-h3] [--yes] [--draft] [--only b01] [--concurrency 3] [--force-redo]
node scripts/broll/review-sheet.mjs <项目目录> --out <仓库外目录>
node scripts/broll/approve.mjs <项目目录> --out <仓库外目录>
```

项目目录里要有 `talk.mp4`、`talk.srt`、`broll.json`。`--out` 不能写在仓库里面。`--dry-run` 只校验、写 `broll.plan.json` 和估价，不生成。`minimax-h3` 即使没超预算，也要先看估价，再加 `--yes` 才生成。`placeholder` 和 `local` 估价为 0 时不用 `--yes`。

`minimax-h3` 出正式片前，每段都要人自己跑过 `approve.mjs`。AI 助手不许替人运行 approve。`--draft` 可以跳过审片，成片在 B-roll 出现时右上角写「B-roll 未审」，`manifest.json` 里 `draft` 为 true。

## 模型只写这些

`version`（固定 1）、`style`（现在只有 `brick-diorama`）、`provider`、`quality`（`768P` / `2K`）、`budgetYuan`、`captions`（`burned` / `add` / `none`）、`keepFace`、`clips`。

每一段：`id`（`b01`）、`from` / `to`（句子号 `c1`…）、`mode`（`full` / `pip` / `split`）、`job`（`demonstrate` `explain` `ground` `compare` `quantify` `evoke` `connect`）、`plain`（≤20 字，不进提示词）、`place` / `subject`（各 ≤12 字）、`camera`（`static` `slow-push` `pull-back` `pan-left` `pan-right` `orbit` `top-down`）。动作要么写 `action` + `end`，要么写 `beats`（2–4 拍），不要两个都写。`file` 只有 `provider` 为 `local` 时才写。

不要写：毫秒、生成秒数、比例、分辨率、风格描述、禁用词、参考图、模型名、提示词全文。

## 脚本会做的事

- 窗口 = 起句开始前 120 毫秒到止句结束后 200 毫秒。生成秒数向上取整，夹在 4–15 秒。
- 每段 2.5–12 秒；段与段之间至少 1 秒真人；B-roll 总长不超过全片 60%。第一句、最后一句、`keepFace` 不能盖。
- `captions` 为 `burned` 时不能用 `full` / `pip`（会盖住烧进去的字幕）。`split` 只给竖版。
- 单价：768P 0.5 元/秒，2K 0.8 元/秒。参考图 image-01 每张 0.025 元。占位片和本地文件按 0 元。接口回执没有金额，账本按价目表乘实际秒数。超过 `budgetYuan` 就停，退出码 3。
- 已有 task id 时只查询，不重新提交。下载链接过期就重新查询拿新链接，不重新生成。同一段最多重做 2 次，第 3 次要加 `--force-redo`。
- 退出码：0 交付，1 校验没过，2 参数或目录或密钥，3 超预算、没加 `--yes`、或重做次数到顶，4 生成、检查或渲染失败，5 还没审片。
