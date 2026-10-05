# 风格包

[English](README.en.md)

AI 画面（口播配画面里 `source` 不是 `motion` 的段）用什么材质、什么画法，由这里的风格包决定。每个风格一个目录：

```
broll/styles/<id>/
  style.json        风格描述、允许的 job 和运镜、能搭的副风格、参考图清单和出图提示
  refs/             参考图（图1 角色、图2 材质），维护者出好后随仓库发
  refs/README.md    这个风格的参考图说明
```

机器人的形状和色号不在风格包里，写在 `broll/character.json`，所有风格共用。风格只决定「这个机器人用什么做的、站在什么上面」。

## 现有风格

| id | 名字 | 状态 | 适合的 job | 运镜 | 参考图 |
|---|---|---|---|---|---|
| `wood-blocks` | 积木风（木积木） | 默认主风格 | 全部 7 种 | 全部 7 种 | 已出 |
| `clay-stopmotion` | 黏土定格 | 可用 | demonstrate、ground、evoke、connect | 不用 orbit、top-down | 已出 |
| `paper-layers` | 分层纸艺 | 可用 | explain、ground、compare、connect | 只用 static、slow-push、pan-left、pan-right | 已出 |
| `ink-sketch` | 手绘线稿（实验） | 实验，不是默认 | explain、compare、quantify、connect | 只用 static、slow-push、pan-left、pan-right | 还没出（角色图头顶总有天线） |
| `brick-diorama` | 塑料积木（实验） | 实验，不是默认 | 全部 7 种 | 全部 7 种 | 有 `ref-3.jpg`（带凸点） |

`brick-diorama` 是 v0.8 的老风格。它生成的 5 段画面全部带凸点，参考图本身也带凸点，所以标成实验风格：校验会提醒，也不能当别的风格的副风格。留着是为了让 version 1 的老 `broll.json` 照常能跑。它的 `look`、`forbid`、`negative`、`camera`、`references` 五个字段保持 v0.8 原样（改了会让老项目的请求哈希变掉、重新花钱），version 2 读 `lookV2`、`forbidV2`。要下线就把整个目录移走：其他风格不受影响，只是写了 `brick-diorama` 的老文件会在校验时报「没有这个风格」。

`ink-sketch` 在 v0.9 降成实验风格：两轮 image-01 出的角色图，手绘机器人头顶都有天线，和共用角色（圆头、头顶光滑）对不上，所以这一版不发参考图。它只能用 `provider: placeholder` 占位预览，校验会提醒，也不能当别的风格的副风格。已知问题和下一步（拿 `wood-blocks` 的角色图当参考出线稿）见 [`ink-sketch/refs/README.md`](ink-sketch/refs/README.md)。

参考图还没出的风格可以用 `provider: placeholder` 排版、预览；要真生成（`minimax-h3`），先由维护者出参考图，否则脚本会在提交前停下，说清缺哪张、下一步怎么做，不会花钱。

## style.json 字段

| 字段 | 说明 |
|---|---|
| `id` | 和目录名一样 |
| `name` / `nameEn` | 给人看的名字 |
| `status` | `default`（默认主风格，只能有一个）、`stable`、`experimental` |
| `default` | 只有 `status` 为 `default` 的风格是 `true` |
| `summary` / `summaryEn` | 一句话「适合什么」，会进给便宜模型的风格清单 |
| `look` | 材质和画法，只写正面描述 |
| `character` | 本风格里机器人用什么做，例如「角色是一个木头做的玩具机器人，表面刷哑光漆」 |
| `characterEn` | 同上，英文，出参考图用 |
| `ground` | 地面或背景，例如「地面是一整块平整光滑的浅色木桌面」 |
| `forbid` | 只禁文字、字母、数字、商标、真人、人声 |
| `camera` | 运镜的中文说法（键是运镜 id） |
| `cameras` | 本风格允许的运镜 |
| `jobs` | 本风格适合的 job |
| `pairsWith` | 能当副风格的 id 白名单 |
| `materialWords` | 本风格的材质词。`place`、`subject` 里一个都不许出现；别的风格的段的动作里也不许出现 |
| `refs` | 参考图清单，顺序就是提示词里的图1、图2：`file`、`role`、`aspect`、`prompt`（英文出图提示，`{character}` 会换成本风格的机器人 + 共用形状和色号），可选 `subjectFrom` |
| `promptExpansion` | H3 的 `extra.prompt_expansion_mode`：`disabled`、`balanced`、`quality`。不写就不带，走官方默认 |
| `freezeNoise` | 静帧检测的噪声容差。白底、纯色底的风格要小一点（`0.0005`），默认 `0.003` |
| `motionTheme` | 同一条片子里动效画面的配色和质感：`{"look": "wood", "bg": "#F3E8D6", …}`。`look` 选 `wood`（木纹桌面 + 刷漆木积木）、`clay`（细颗粒 + 黏土团）、`paper`（纸纤维 + 叠层彩纸）、`ink`（点格白纸 + 墨线涂鸦），决定背景纹理、装饰形状和卡片质感；色号可选，键是 `bg` `bg2` `card` `edge` `ink` `sub` `accent` `cool` `warm` `good` `muted`（`#RRGGBB`），不写用这个 look 的默认色。画面上只有形状和纹理，字仍然只来自原话 |

## 提示词规则

1. 只写想看到的东西。视频模型没有反向提示词，写「不要凸点」等于在说「凸点」。
2. 拼好的提示词里不许出现：凸点、stud、乐高、拼搭、颗粒、人仔（英文不分大小写，`studless` 也算）。脚本最后会查，查到就不提交。
3. `forbid` 只禁文字、字母、数字、商标、真人、人声。
4. 不写任何品牌、作品名、角色名（见 `broll/banned-words.json`）。黏土风格尤其要避开有名的黏土动画角色，机器人不画嘴。

## 出参考图（维护者）

每个风格两张：图1 是机器人正面全身，图2 是一片没有角色的空场景（看材质）。

```bash
# 1. 先看将要发送的请求（不花钱，不需要密钥）
node scripts/broll/make-style-refs.mjs --style wood-blocks --dry-run
# 2. 每张出 2 张候选挑（共 4 张，按价目表 0.1 元）
node scripts/broll/make-style-refs.mjs --style wood-blocks --n 2 --yes
# 3. 挑好的改名成 refs/character.jpg、refs/material.jpg，其余删掉
# 4. 只补一张
node scripts/broll/make-style-refs.mjs --style wood-blocks --only refs/material.jpg --yes
```

挑图标准：任何表面都没有圆形凸点；机器人头顶光滑、两只手都是实心圆球；画面里没有字；两张图看着是同一个世界。挑不出来就改 `prompt` 再出，不要凑合。

已有的图不会被覆盖；一次最多出 4 张；没加 `--yes` 只报价不花钱（退出码 3）。

## 新加一个风格

1. 复制一个现有目录，改 `id` 和各字段。
2. 跑 `node tests/broll/styles.mjs`，它会检查字段齐不齐、job 和运镜写得对不对、`pairsWith` 存不存在、提示词和出图提示里有没有泄漏词。
3. 出参考图，人挑过再提交。新风格先花一次小钱实测（一段 4 秒），过了再写进文档。
