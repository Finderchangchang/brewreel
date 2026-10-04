# 口播配 B-roll

用户给一段口播（`talk.mp4`）和字幕（`talk.srt`）。模型只写 `broll.json`，脚本负责校验、算时间和费用、生成画面、合成成片。

这一版能走通的来源是 `placeholder`（纯色占位片，不花钱）和 `local`（用户自己的视频）。`minimax-h3` 下一版才接。

## 目录

| 路径 | 做什么 |
|---|---|
| `schema/broll.schema.json` | `broll.json` 的字段定义 |
| `styles/brick-diorama/style.json` | 积木风：固定画面描述、运镜词、参考图（这一版参考图是空的） |
| `banned-words.json` | 品牌和敏感词。出现在文案里就报错，并给替换说法 |

宣传片的 `styles/`、`industries/` 跟这里无关。

## 命令

```
node scripts/broll/list-cues.mjs <项目目录>
node scripts/broll/validate.mjs <项目目录>
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> [--dry-run] [--provider placeholder|local] [--yes]
```

项目目录里要有 `talk.mp4`、`talk.srt`、`broll.json`。`--out` 不能写在仓库里面。`--dry-run` 只校验、写 `broll.plan.json` 和估价，不生成。估价为 0 时不用 `--yes`；大于 0 必须加 `--yes`。

## 模型只写这些

`version`（固定 1）、`style`（现在只有 `brick-diorama`）、`provider`、`quality`（`768P` / `2K`）、`budgetYuan`、`captions`（`burned` / `add` / `none`）、`keepFace`、`clips`。

每一段：`id`（`b01`）、`from` / `to`（句子号 `c1`…）、`mode`（`full` / `pip` / `split`）、`job`（`demonstrate` `explain` `ground` `compare` `quantify` `evoke` `connect`）、`plain`（≤20 字，不进提示词）、`place` / `subject`（各 ≤12 字）、`camera`（`static` `slow-push` `pull-back` `pan-left` `pan-right` `orbit` `top-down`）。动作要么写 `action` + `end`，要么写 `beats`（2–4 拍），不要两个都写。`file` 只有 `provider` 为 `local` 时才写。

不要写：毫秒、生成秒数、比例、分辨率、风格描述、禁用词、参考图、模型名、提示词全文。

## 脚本会做的事

- 窗口 = 起句开始前 120 毫秒到止句结束后 200 毫秒。生成秒数向上取整，夹在 4–15 秒。
- 每段 2.5–12 秒；段与段之间至少 1 秒真人；B-roll 总长不超过全片 60%。第一句、最后一句、`keepFace` 不能盖。
- `captions` 为 `burned` 时不能用 `full` / `pip`（会盖住烧进去的字幕）。`split` 只给竖版。
- 单价：768P 0.5 元/秒，2K 0.8 元/秒。占位片和本地文件按 0 元。超过 `budgetYuan` 就停，退出码 3。
- 请求内容没变（哈希相同）且已经有任务号时，只查询，不重新生成。
