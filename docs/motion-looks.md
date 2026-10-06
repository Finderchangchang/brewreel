# 动效外观

English: [motion-looks.en.md](motion-looks.en.md)

动效外观是口播动效卡片的画法：底色、锚点、小纸签、纹理、入场。它不是 AI 画面的风格包。风格包（`broll/styles/<id>/style.json`）决定生成画面长什么样，里面的 `motionTheme` 对象只是「没单独指定时，动效用哪一套」。

## 现在有哪些

| 名字 | 画法 |
|---|---|
| `wood` | 暖木桌面，积木卡片 |
| `clay` | 暖粉彩，软的黏土卡片 |
| `paper` | 米白纸，叠层彩纸 |
| `ink` | 白纸墨线 |
| `cutpaper-meadow` | 剪纸拼贴，灰绿纸底 |
| `cutpaper-dusk` | 剪纸拼贴，灰紫纸底 |

`wood` / `clay` / `paper` / `ink` 走原来的卡片。两个 `cutpaper-*` 走剪纸舞台，五个模板（keyword、checklist、steps、counter、compare）都在这套舞台里重排。

## 怎么选

- 不写：用主风格 `style.json` 里的 `motionTheme` 对象（老的 `broll.json` 行为不变）。
- `broll.json` version 2 的顶层 `motionTheme` 写成上表里的名字：只换这一支片子，不改风格包。用的是该外观的默认色。
- `node scripts/broll/llm_broll.mjs <项目> --motion-look <名字>` 把这个名字写进顶层，并把 version 改成 2。

## 用通用部件拼一个新外观

部件在 `template/src/talk/motion/kit/`。它们不知道具体配色，任何外观都能调用。皮肤值（色号、这一套的静止角）写在 `template/src/talk/motion/palette.ts` 的 `LOOK_DEFAULTS` 里。

以 cutpaper 为例，顺序是：

1. 在 `palette.ts` 和 `scripts/broll/motion.mjs` 的外观名单里各加一个名字，默认色补齐 11 个色号。两边的名单必须一致。
2. 用 `threeColor` 检查「一个底、一个只给锚点的强调色、一个深色」。碎屑另取颜色，不复用强调色。底和强调色要分得开。
3. 新外观先写成 tokens，跑 `scripts/check-originality.mjs`，对仓库外的参考 tokens 和招牌清单。不过就改色号，不要改部件的参数去凑颜色。
4. 舞台自己画底，不要复用别的外观的卡片。底上盖 `PaperGrain`（颗粒在字的下面，不模糊剪边）。纸底上才放 `Confetti`，颜色从这一套的碎屑色来，一段结束前退场；模糊只加在还在动的碎屑上。
5. 锚点用 `CutShape`：种子决定边数和毛边，静止角用外观自己的、落在部件允许的范围里。投影用部件给出的统一偏移，颜色由底色压暗。
6. 独立入场的锚点走 `settle()`：上抛、角度过冲一次、然后停。和上一段同一外观、间隔又够短时，先问 `anchorRelay`；接得上就从上一张的最终姿态开始，不再抛一次。接不上就各自入场。
7. 五个模板只改排版，不改字从哪来。锚点上放这段的主信息（keyword 的整句、counter 的数字、compare 里后说的那一栏、checklist / steps 的当前条），其余是小纸签。第 0 帧锚点上已经有字。不另加眉题。
8. 在 `MotionLayer` 里按外观名字分到新舞台。安全区、字幕让位、圆窗让位、split 分区仍用原来的取景框。动效段不加「AI 生成画面」标。

字号下限、字幕和圆窗的让位不要在新外观里放宽。时间仍按口播逐字时刻。
