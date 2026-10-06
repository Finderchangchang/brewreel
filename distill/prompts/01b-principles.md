# 1b. 第一性原理

中文在前，English below。这是通用模板：不要把任何一支参考片的色值、角度、顶点、品牌或句式抄进提示词或仓库。数字只来自第 1 步已经量到的结果，写进仓库外的 `principles.md`。

在九层拆解、逐拍表、tokens 草稿和招牌清单都写完之后做这一步。拆解回答「画面上有什么」。这一步回答「哪几条机制在起作用，去掉皮肤之后还剩什么」。

## 怎么写

只根据第 1 步的实测（抽帧、时间、色差、位移）。量不到的不要补。每条机制单独一节，六项都要有：

1. **是什么**：用一句机制描述，不写某一家的造型。
2. **参考片证据**：时间段、量到的位移 / 色差 / 面积 / 时长。证据放仓库外，仓库里的文档不引用这些原值。
3. **为什么起作用**：注意力、连贯、节奏、质感里它承担哪一种。写得具体，不要只写「更好看」。
4. **能否脱离皮肤复用**：能，或不能。不能的写明它是造型、配色、句式还是品牌资产，归进招牌清单，不要做成部件。
5. **参数范围**：由证据收出来的区间（最小–最大，或一个默认和允许的偏差）。区间要能放进代码的参数，不要只写一个点。
6. **不复用会怎样**：观众会失去哪一种阅读或连贯。用这个判断它值不值得做成部件。

机制之间如果互相依赖（例如「换景不断开」依赖「有一个始终能认出来的锚点」），在条目里点明，不要合并成一条。

## 可复用部件清单

`principles.md` 的最后一张表。一行一个部件。只收第 4 项写成「能复用」的机制。造型、固定句式、某一组色值、某一个静止角度不要进这张表。

| 部件 | 参数 | 口播动效 | 宣传片 | AI 画面 | 难度 |
|---|---|---|---|---|---|
| （名字，是机制不是造型） | （对应上面的区间） | 用 / 不用，用在什么位置 | 用 / 不用 | 用 / 不用（代码叠加，还是生成时就要留位置） | 低 / 中 / 高，并写卡在哪 |

口播动效能用的部件后来放 `template/src/talk/motion/kit/`，一个部件一个文件，参数和注释写明对应哪一条原理。宣传片的部件放该形式自己的组件目录。皮肤值（配色、具体形状、文案）不进部件，进外观或配方。新外观先过 `scripts/check-originality.mjs`，再接到模板上。

## 不要做的事

- 不要把参考片的色值、顶点坐标、招牌角度、品牌名写进仓库。
- 不要把「像那一支」当成原理。原理要在换一套颜色、换一个形状之后仍然成立。
- 不要为了凑部件，把只出现一次、又没有测量的动作写进来。

---

# 1b. First principles

Chinese is above. This is a generic template: do not copy any reference film's colours, angles, vertices, brand or stock phrase into the prompt or the repo. Numbers come only from step 1's measurements and are written into `principles.md` outside the repo.

Do this after the nine-layer breakdown, the beat table, the token draft and the signature list. The breakdown says what is on screen. This step says which mechanisms are doing the work, and what is left once the skin is gone.

## What to write

Use only step 1's measurements (frames, times, colour difference, motion, area). Do not fill in anything that was not measured. One section per mechanism, all six items:

1. **What it is.** One sentence about the mechanism, not about one brand's drawing.
2. **Evidence from the reference.** Time range and the measured shift, colour difference, area or duration. Evidence stays outside the repo. Docs inside the repo do not quote those raw values.
3. **Why it works.** Which of attention, continuity, rhythm or texture it carries. Be specific. "It looks better" is not a reason.
4. **Reusable without the skin.** Yes or no. If no, say whether it is a drawing, a palette, a stock phrase or a brand asset, send it to the signature list, and do not make it a part.
5. **Parameter range.** The interval the evidence supports (min–max, or a default plus a tolerance). The interval has to be something code can take as a parameter, not a single copied point.
6. **What fails if it is dropped.** Which kind of reading or continuity the viewer loses. That is how you decide it is worth a part.

If one mechanism depends on another, say so in the entry. Do not merge them.

## Reusable-parts table

The last table in `principles.md`. One row per part. Include only mechanisms marked reusable in item 4. Leave out drawings, stock phrases, a specific palette and a specific rest angle.

| Part | Parameters | Talk motion | Promo | AI picture | Difficulty |
|---|---|---|---|---|---|
| (name the mechanism, not the drawing) | (the range from above) | use or not, and where | use or not | use or not (composited in code, or the generated frame must leave a place) | low / medium / high, and what makes it hard |

Talk-motion parts later live in `template/src/talk/motion/kit/`, one file each, with the principle named in a comment. Promo parts live in that format's component directory. Skin values (colours, the specific shape, copy) do not go into the part; they go into the look or the recipe. A new look passes `scripts/check-originality.mjs` before it is wired to a template.

## Do not

- Do not write the reference film's colours, vertex coordinates, signature angle or brand name into the repo.
- Do not treat "it looks like that film" as a principle. A principle still holds after the colours and the shape are replaced.
- Do not invent a part for a one-off move that was never measured.
