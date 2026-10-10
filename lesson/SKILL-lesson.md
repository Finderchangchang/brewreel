---
name: brewreel-lesson
description: 讲课视频。用户要做讲解课、课程、普法、教程类横版视频时使用。只写 lesson.json 或 brief，跑 make-lesson。不替人签审稿，不擅自用照片建角色。
license: Apache-2.0
---

# 讲课视频

你在做 16:9 横版讲解课。画面、配音、字幕由程序生成。你负责问清楚、写对 `lesson.json` 或 brief、按下面的命令跑。不要写 `storyboard.json`，不要改 `template/` 和 `scripts/`。

`<SKILL>` = 仓库根（`SKILL.md` 所在目录）。命令都在这个目录里跑。英文改读 `<SKILL>/lesson/SKILL-lesson.en.md`。给人看的说明在 `<SKILL>/docs/lesson.md`。

## 用户给了什么

| 用户给了什么 | 你做什么 |
|---|---|
| 已经有一份 `lesson.json` | 校验，然后出片 |
| 一份 brief（选题、要点、受众、时长、领域、出处） | 用生成流水线写出 `lesson.json`，再校验、出片 |
| 只有口头要求 | 先写成 brief。缺栏目就问，不要编 |

brief 是 UTF-8 JSON。中文 Windows 不要用 `echo >` 写文件。

## 写 brief

缺任何一项就停下来问。

1. `title` 选题。
2. `points` 要点。条数不少于 `minutes` × 2。3 分钟至少 6 条。不够就问，不要为了凑数编一条。
3. `audience` 受众。
4. `minutes` 时长，1 到 8 的整数。成片要落在 30 秒到 8 分钟。
5. `domain`：`tech` 技术讲解，或 `legal` 普法。普法不能当成技术课。
6. `sources` 出处。技术课要有文档或命令出处。普法要有法律名称和条号。用户没给就停。
7. 讲解员：预设卡通、手改卡通、真人视频，或用照片建卡通。四选一。照片见文末，不要自己跑。

```json
{
  "domain": "tech",
  "lang": "zh",
  "title": "选题",
  "audience": "受众",
  "minutes": 3,
  "points": ["要点一", "要点二"],
  "sources": ["出处，用户原文"],
  "facts": []
}
```

普法把 `domain` 写成 `legal`。法条正文不要写进 brief。程序只从已核对的《民法典》语料回填。要的条号不在语料里，就告诉用户现在插不进去，不要自己写条文。

样例：`<SKILL>/examples/lesson/briefs/what-is-codex.json`、`<SKILL>/examples/lesson/briefs/iou-basics.json`。

## 从 brief 生成 lesson.json

没有密钥，或只是在核对命令时，加 `--mock-llm`，不联网。不要自己去调 DeepSeek。

```text
node <SKILL>/scripts/lesson/generate-lesson.mjs --brief <SKILL>/examples/lesson/briefs/what-is-codex.json --out <仓库外目录>/tech --mock-llm <SKILL>/scripts/lesson/fixtures/what-is-codex
```

成功：退出码 0，有一行「lesson.json 已生成并通过校验」。讲稿在 `--out` 目录的 `lesson.json`。

失败：退出码 2 是 brief 不合格，按「brief 校验失败」里的每一条去问用户。退出码 1 是讲稿没通过校验。把错误原文留着，不要手改法条去凑。

用户明确要求正式写稿、并且环境里已有 `DEEPSEEK_API_KEY` 时，去掉 `--mock-llm`。不要把密钥写进文件、命令参数或聊天。

普法样例把 brief 换成 `examples/lesson/briefs/iou-basics.json`，`--mock-llm` 换成 `scripts/lesson/fixtures/iou-basics`。

## 手写或改 lesson.json

用户想改已经写好的某一处时，先跑 `node <SKILL>/scripts/revise.mjs <lesson.json> "一句话"`，不要整份重写。

顶层是 `meta` 和 `chapters`。`meta.format` 为 `lesson`，`meta.domain` 为 `tech` 或 `legal`，`meta.lang` 为 `zh` 或 `en`。每一页有 `layout`、`title`、`narration`。版式名见 `<SKILL>/docs/lesson.md` 的清单。样例：`<SKILL>/examples/lesson/sample-tech.json`、`<SKILL>/examples/lesson/mascot-demo.json`。

`meta.theme` 可以不写。不写时：普法用 `paper`，截图和代码页占比高用 `product`，其余用 `lecture`。要指定就写 `paper`、`lecture`、`product`、`editorial`。`editorial` 不能用于普法。

校验：

```text
node <SKILL>/scripts/lesson/validate-lesson.mjs <lesson.json>
```

按报错改，直到通过。不要为了过校验编造出处或法条。

## 出片

`--out` 必须在仓库外面。不写时，成片放在当前工作目录上一级的 `brewreel-studio-out`。样片用占位配音，不花配音费。没有「交付：」就不是成片。

```text
node <SKILL>/scripts/lesson/make-lesson.mjs <lesson.json> --out <仓库外目录> --voice-provider mock --no-bgm
```

成功：退出码 0，有一行「交付：」，后面是 `video.mp4` 的路径。只把这一行的路径交给用户。同目录还有 `sheet.png`（抽帧拼图）、`subtitles.srt`、`chapters.txt`、`manifest.json`、`lock.json`。

失败不要把 `video.rejected.mp4` 当成交付。

| 退出码 | 含义 |
|---|---|
| 0 | 有「交付：」 |
| 1 | 讲稿、审稿、角色或时长不合格 |
| 2 | 参数写错，或某一页配音失败 |
| 3 | 空帧自查没过，不能交付 |
| 4 | 渲染失败或时长对不上 |

正式配音把 `--voice-provider mock` 换成 `minimax`（也可用 `aliyun`、`volcengine`），并去掉 `--no-bgm`（要已安装 `requirements.txt` 里的库，否则日志写明本片没有配乐）。这会花配音费。用户没要求正式配音时，保持 mock。

环境自检：

```text
node <SKILL>/scripts/lesson/doctor.mjs
```

成功时最后一行是「结果：必需项都通过。」Python 配乐是可选项，不过也不影响出片。

## 竖版和封面

默认不出。同一条出片命令后面加上开关：`--vertical` 出竖版切片，`--covers` 出三张封面。两个都要就两个都写。

竖版在成片目录的 `vertical/`：`clip-01.mp4`、`clip-01.cover.png`、`clip-01.publish.txt`。封面在 `covers/`：`cover-16x9.png`、`cover-9x16.png`、`cover-3x4.png`。

成功时「交付：」仍是横版 `video.mp4`。普法片仍然要先有审稿记录。

## 改一页只重出一页

改完 `lesson.json` 之后，用**同一个** `--out` 再跑上面的 `make-lesson`。程序按页看缓存：没改的页日志是「第 N 页：复用」，改过的页是「第 N 页：重渲」。翻页时上一页会在下一页开头淡出，所以改一页时，下一页也可能重渲。不要换一个新的输出目录，否则每一页都会重出。

成片目录里已有 `lock.json`，而引擎版本变了：程序会停下。用户确认要整片重出时才加 `--accept-engine-change`。

## 法律课必须先过审稿

技术课不强制审稿。普法没有有效审稿记录时，`make-lesson` 会拒绝出片。这是对的，不要加参数绕过。

先出审稿网页，把 `review.html` 交给用户，请律师逐页看，然后停。

```text
node <SKILL>/scripts/lesson/review-sheet.mjs <lesson.json> --out <仓库外目录>
```

成功：退出码 0，有一行「审稿 HTML 已生成」。

你不要运行 `sign-review.mjs`，也不要自己写 `.review.json`。律师本人在自己的电脑上签字：

```text
node <SKILL>/scripts/lesson/sign-review.mjs <lesson.json> --reviewer <姓名> --license <执业证号>
```

空、无、测试、none、- 这类证号无效。内部样片用 `--test`，成片会打上「内部样片 · 未经律师审核」，不能当作律师审过的片子。这条也要用户自己跑，你不要替人签。

讲稿若改过，旧签字作废，要重新审。

## 讲解员

预设卡通不花钱。角色档案默认放在当前工作目录上一级的 `brewreel-data`（环境变量 `LESSON_DATA_DIR` 或 `--data-dir` 可改）。若只有旧目录 `brewreel-studio-data`、还没有 `brewreel-data`，程序仍读旧目录。档案不能放进仓库。

命令里的「客户 id」是档案编号。只用小写字母、数字、短横线。

```text
node <SKILL>/scripts/lesson/character.mjs create --client <档案id> --name <名字> --id <角色id> --preset female --data-dir <仓库外数据目录>
node <SKILL>/scripts/lesson/character.mjs card <档案id>/<角色id> --out <仓库外目录> --data-dir <仓库外数据目录>
```

把 `card.png` 和 `card.mp4` 交给用户。用户明确确认之后才跑：

```text
node <SKILL>/scripts/lesson/character.mjs approve <档案id>/<角色id> --data-dir <仓库外数据目录>
```

讲稿里写成 `档案id/角色id`。还没确认的角色，正式出片会被拒绝。试看才加 `--draft`，画面上有「角色未确认」，不能当正式片。

男讲解员把 `--preset female` 换成 `--preset male`。

真人视频：`meta.presenter.kind` 写 `real`，`src` 是本地 mp4，`segments` 要按页给起止时间。目前只支持技术课（`meta.domain` 为 `tech`）。普法不能用真人视频。出片不要加 `--voice-provider`，用源片原声。源片放在这次 `--out` 的外面。细节见 `<SKILL>/docs/lesson/PRESENTER_IMPORT.md`。

## 照片建角色

要用本人的照片，或已经得到本人同意的照片。没有授权人就不要做。

这条会把照片发给 MiniMax 做识别，**要花钱**。没有用户当次明确要求，不要运行带 `--photo` 的 `character.mjs create`，也不要运行 `presenter-from-photo.mjs`。

用户明确要求、并且说了授权人是谁之后，才把这条命令交给用户自己跑（或在用户再次确认后运行）：

```text
node <SKILL>/scripts/lesson/character.mjs create --client <档案id> --name <名字> --id <角色id> --photo <照片> --consent-by <授权人姓名> --data-dir <仓库外数据目录>
```

没有 `--consent-by`，程序会拒绝。

## 品牌

律所片头、角标、姓名条是可选项。不写品牌的片子照常出。建档命令见 `<SKILL>/docs/lesson/BRAND.md`。档案同样放在数据目录，不进仓库。

## 你不要做的事

- 不编造事实、数字、出处、法条。
- 不替人签审稿，不自己写 `.review.json`。
- 不擅自用照片建角色，不擅自调用 MiniMax 或 DeepSeek。
- 不关掉片头「AI生成合成」。不要改标识组件。
- 不把密钥写进文件、命令参数或聊天。
