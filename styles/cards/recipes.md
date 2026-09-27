# cards 风格的叙事模板

cards 的叙事模板按行业分，已经写在各行业的 recipe 里，这里只做索引，不重复：

| 行业 | 模板 |
|---|---|
| software（默认） | `SKILL.md` 第 5 步的三种组合（C 端情感 / 工具提效 / B 端数据），和 `industries/software/recipe.md` |
| food | `industries/food/recipe.md` |
| ecommerce | `industries/ecommerce/recipe.md` |
| education | `industries/education/recipe.md` |
| beauty | `industries/beauty/recipe.md` |
| travel | `industries/travel/recipe.md` |

每镜要填的字段见 `shots.md`（或 `docs/shots/<type>.md`）。9 份能直接出片的样例在仓库根目录的 `examples/`。

## 有配音时（`meta.voice` + 每镜 `vo`）

结构照上面的行业模板，不用为了配音改镜头；配音的通用写法见 `SKILL.md`「配音」一节。cards 额外注意：

- **hook 照样写 `caption`**：它是封面标题，第 0 帧就要在；`vo` 可以换个说法把痛点念出来（「说好的复诊，怎么又忘了？」），不用和 caption 一字不差。
- **中间镜头写了 `vo` 就可以不写 `caption`**：字幕带会用 `vo` 逐字点亮。想让某一镜照旧显示大字标题，就留着 `caption`，这一镜旁白只念、不出旁白字幕。
- **`vo` 讲意思，不念清单**：quickList、steps、compare、factSheet 的条目已经在画面上，旁白用一句话概括（「按住说话，看一眼确认，到点它会叫你」），别把每一条再读一遍。chat 镜头的旁白讲处境，不念气泡原文。
- **字数按这一镜最长时长算**（中文约每秒 4.5 字，含前后留白 0.5 秒）：hook ≤ 15 字、compare / steps / features / quickList ≤ 25 字左右、mockApp / phone ≤ 30 字、meter / counter ≤ 20 字、endCard ≤ 20 字。有旁白的镜头时长由声音决定，`dur` 写个大概就行。
- **数字、价格照 `meta.facts`**：旁白里的数字和画面上的一样，也要能在 facts 里找到；券后、日期范围这类限定语同样要念出来或写在同一镜。
- **endCard**：只念不出字幕，一句带上产品名（和 `meta.product` 一字不差）；不念网址、不说「扫码」「搜 XX 号」。
- 样例：`styles/cards/examples/voice-reminder.json`（没有 key 时出片加 `--voice-provider mock` 预览）。
