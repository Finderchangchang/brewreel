# 口播配画面

给一段真人口播配上解释用的画面。画面是积木风微缩场景。模型只写 `broll.json`。时间、费用、生成和合成由脚本完成。

## 适合谁

已经有真人口播，想在讲步骤、讲物件、讲对比的句子上加一段解释画面的作者。开场、收尾和讲自己感受的句子继续露脸。

## 三步上手

项目目录里放 `talk.mp4` 和 `talk.srt`。脚本不转写，字幕要自己导出。

1. 列句子。

```
node scripts/broll/list-cues.mjs <项目目录>
```

2. 写 `broll.json`。助手按 `broll/SKILL-broll.md` 写，或交给便宜模型：

```
node scripts/broll/llm_broll.mjs <项目目录> --style brick-diorama --budget 20 --captions add
```

校验没过，会把报错原文交回模型再写，最多 3 轮。仍不过就停，最后一版和报错留在项目目录。

3. 出片。先看估价，再生成。`--out` 放在仓库外面。

```
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --dry-run
node scripts/make-talk.mjs <项目目录> --out <仓库外目录> --yes
```

`placeholder` 不花钱，不用 `--yes`。`minimax-h3` 要先看估价，再加 `--yes`。

## 三种放法

| mode | 画面 |
|---|---|
| full | B-roll 盖满 |
| pip | 右下角圆窗露脸 |
| split | 上面 60% 是 B-roll，下面 40% 是脸。只给竖版 |

## 字幕

| captions | 意思 |
|---|---|
| add | 按 `talk.srt` 把字幕加到成片上 |
| none | 不加字幕 |
| burned | 口播里已经烧了字幕。只能用 `split`，免得再盖住 |

配图看检查帧。成片在 `check/` 里，每段有开头、中间、结尾三帧。审片页 `review.html` 把这三帧和原句放在一行。

## 费用

按价目表，不按接口回执。回执里没有金额。以 MiniMax 官网为准。

- 768P：0.5 元/秒
- 2K：0.8 元/秒
- 参考图：0.025 元/张
- 1 分钟口播配 6–8 段，大约 12–20 元

生成秒数由脚本把窗口向上取整，再夹到 4–15 秒。

## 审片关卡

`minimax-h3` 的正式片，每段都要人看过。

1. `node scripts/broll/review-sheet.mjs <项目目录> --out <仓库外目录>`
2. 用浏览器打开输出目录里的 `review.html`
3. 人自己跑 `node scripts/broll/approve.mjs <项目目录> --out <仓库外目录>`
4. 再跑同一条 `make-talk`，出正式片

AI 助手不许替人运行 approve。还没审、先看合成效果，加 `--draft`。B-roll 出现时右上角写「B-roll 未审」。

`placeholder` 和 `local` 不花钱，不用审。

## 已知限制

- 每段单独生成，机器人的造型会漂。
- 生成画面里的文字不可靠。不要要求画面上写字。
- 现在只支持积木风一种。积木顶面光滑，没有凸点。
- 没有自动转写。要自己把口播字幕导出成 `talk.srt`。
