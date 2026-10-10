# 讲课视频

横版 16:9 讲解课。画面、配音和字幕由程序生成。你写一份 `lesson.json`，或者先写一份 brief，再生成讲稿。便宜模型看的步骤在 [lesson/SKILL-lesson.md](../lesson/SKILL-lesson.md)。

## 能做什么

- **二十种版式。** 清单在下面。片尾品牌页由程序加上，不是你要写的一种版式。
- **四套主题。** `paper` 卷宗（普法默认）、`lecture` 讲台（其余默认）、`product` 产品（截图页和代码页达到三成时自动选用）、`editorial` 杂志（只能手选，不能用于普法）。
- **讲解员。** 预设卡通不花钱。也可以手改形象、导入真人视频，或用照片建一个卡通。真人视频目前只支持技术课。关掉写 `meta.presenter.kind: "none"`，或写 `meta.mascot.enabled: false`。两种都会真的不画，清单里记成 `none`。
- **品牌包装。** 片头、角标、姓名条都可以不写。不写也能出片。
- **竖版切片和封面。** 默认不出。出片命令加上 `--vertical`、`--covers`，或两个都加。
- **改一页只重出一页。** 用同一个输出目录再跑。没改的页复用，改过的页重渲。翻页淡出可能让下一页也重渲。
- **审稿。** 普法没有有效审稿记录就不出片。技术课不强制。AI 助手不能替人签字。
- **领域包。** `tech` 技术讲解，`legal` 普法，`news` 新闻 / 时事复盘。普法的法条只从已核对的《民法典》语料回填。新闻每条事实要有出处，片尾自动加一页免责说明。
- **照片建角色。** 要本人同意，并且会花 MiniMax 的钱。没有当次明确要求，不要跑。

## 最短上手三步

在仓库根目录运行。输出目录要在仓库外面。

**1. 看这台电脑缺不缺必需项。**

```bash
node scripts/lesson/doctor.mjs
```

最后一行含「结果：必需项都通过。」就可以往下。Python 配乐是可选项，缺了也能出片，只是没有背景音乐。

**2. 校验一份现成样例。**

```bash
node scripts/lesson/validate-lesson.mjs examples/lesson/mascot-demo.json
```

没有报错再出片。

**3. 用占位配音出一片。** 不花配音费。

```bash
node scripts/lesson/make-lesson.mjs examples/lesson/mascot-demo.json --out ../brewreel-studio-out/first-lesson --voice-provider mock --no-bgm
```

成功时有一行「交付：」，后面是 `video.mp4` 的路径。同目录有 `sheet.png`（抽帧拼图）。没有「交付：」就不是成片。

## 版式清单

每一页写 `layout`、`title`、`narration`。字段和字数上限在 `template/src/lesson/layouts/<版式>.spec.json`。画布、安全区和字号见 [版式规则](lesson/LAYOUT_RULES.md)。

| 版式 | 用来放什么 |
|---|---|
| `cover` | 封面 |
| `chapter` | 章节页 |
| `steps` | 步骤 |
| `quote` | 引用。普法只填条号，正文由语料回填。只有 `legal` 画「法」字，新闻和技术课画引号 |
| `compare` | 左右对比 |
| `question` | 提问和选项 |
| `flow` | 流程 |
| `recap` | 回顾 |
| `screenshot` | 截图和标注 |
| `code` | 代码 |
| `points` | 要点 |
| `statement` | 一句话陈述 |
| `timeline` | 时间线 |
| `checklist` | 清单 |
| `bignumber` | 大数字 |
| `saying` | 一种说法 |
| `levels` | 层级 |
| `case` | 案例 |
| `document` | 文书 |
| `table` | 表格 |

## 新闻 / 时事复盘

`meta.domain` 写 `news`。还要写：

- `meta.asOf`：截至时间，例如 `2026-10-10 19:30（北京时间）`。
- `meta.facts`：数组。每条是对象，含 `text`（事实原文）和 `source`（媒体名和日期）。

程序在片尾加一页，无旁白：「据公开报道整理，截至 <asOf>，不构成任何结论」。英文稿是 “Compiled from public reports as of <asOf>. This is not a conclusion.” 这一页不用写进讲稿。

定性词（造假、抹黑、黑幕、实锤、造谣、诬陷、带节奏、甩锅）出现在画面或旁白里，校验只提醒。`compare` 两边字数差超过 1.5 倍也只提醒。出处超过字数时，提示是「只留媒体名和日期」，不是普法那句「只留法律全称和条号」。

技术课不自动加这一页。要加的话，写非空的 `meta.disclaimer`，或把 `meta.disclaimerTail` 设为 `true`。

## 再往下看

- [安装](lesson/INSTALL.md)
- [版式规则](lesson/LAYOUT_RULES.md)
- [显式标识和 AIGC 元数据](lesson/AIGC_LABEL.md)
- [品牌档案](lesson/BRAND.md)
- [角色档案](lesson/CHARACTERS.md)
- [卡通讲解员](lesson/PEEPS_PRESENTER.md)
- [用照片建角色](lesson/PRESENTER_FROM_PHOTO.md)
- [导入真人视频](lesson/PRESENTER_IMPORT.md)

角色和品牌档案默认在当前目录上一级的 `brewreel-data`。如果还没有这个目录、只有旧目录 `brewreel-studio-data`，程序仍读旧目录。两个都在时用新目录。不要把档案放进仓库。

## 已知限制

- **法律示例是虚构的，未经律师审核。** 仓库里的普法样例用来看命令和版式，不能当成法律意见，也不能当成已经审过的片子。
- **照片建角色要花钱。** 照片会发给 MiniMax 做识别。预设卡通不花钱。
- **两套讲课字体是子集。** `NotoSerifSC-VF.ttf` 和 `LXGWWenKai-Regular.ttf` 保留 GB 2312 汉字、ASCII、常用标点和全角符号。子集之外的字会缺字形。裁剪后的字体族名是 BrewReel Serif 和 BrewReel Kai，许可证全文在 `template/public/fonts/`。
- **成片时长**要在 30 秒到 8 分钟之间。
- **Remotion 不是开源软件**：4 人及以上的营利组织需要购买 Remotion 的 Company License，本仓库的 Apache-2.0 不改变这一点，详见 <https://www.remotion.dev/license>。
