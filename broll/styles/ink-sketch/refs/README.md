# 手绘线稿（ink-sketch）参考图

**v0.9 状态：实验风格，参考图未出。** 这个风格只能用 `provider: placeholder` 占位预览；`minimax-h3` 会在提交前停下（退出码 2），不花钱。它也不能当别的风格的副风格。

这里要放两张图：

- `character.jpg`：图1，角色。机器人正面全身，单独站着。
- `material.jpg`：图2，材质。一片没有角色的空场景。

出图提示写在 `../style.json` 的 `refs` 里，机器人的形状和色号来自 `broll/character.json`。

## 已知问题

两轮 image-01 出的角色图，手绘机器人头顶都有天线（出图提示里已经写了头顶是光滑圆顶、没有天线），和共用角色（圆头、头顶光滑）对不上。另外三个风格的角色图都是光滑圆头，只有线稿画法总被模型补上天线，所以 v0.9 不发这个风格的参考图。

## 下一步思路

拿 `wood-blocks` 已经挑好的角色图 `../../wood-blocks/refs/character.jpg` 当参考出线稿，让模型照着它的头型画，不只靠文字描述：

1. 在 `../style.json` 角色那一条 `refs` 里加 `"subjectFrom": "../wood-blocks/refs/character.jpg"`（路径相对 `broll/styles/ink-sketch/`，出图脚本会把这张图作为 image-01 的 `subject_reference` 发出去）。
2. 先 `--dry-run` 看请求，确认带上了主体参考，再每张出 2 张候选挑。
3. 挑图标准照下面，头顶有天线、旋钮、螺栓的一律不要。两张都合格后，把 `style.json` 的 `status` 改回 `stable`，在要搭它的风格的 `pairsWith` 里加回 `ink-sketch`，再同步文档。

`subject_reference` 官方写的是人物角色参考，对玩具机器人的线稿管不管用还没试过；不行就先把木积木角色图描成线稿，再拿描好的图当参考。

```bash
node scripts/broll/make-style-refs.mjs --style ink-sketch --dry-run      # 看请求，不花钱
node scripts/broll/make-style-refs.mjs --style ink-sketch --n 2 --yes    # 每张 2 张候选，挑好改名
```

挑图标准：任何表面都没有圆形凸点；机器人头顶光滑、两只手都是实心圆球；画面里没有字；两张图看着是同一个世界。

## English

**v0.9 status: experimental, no reference images yet.** This style only works for stand-in previews with `provider: placeholder`; `minimax-h3` stops before submitting (exit code 2) and charges nothing. It cannot be used as another style's second style.

Two images go here: `character.jpg` (image 1, the robot, front view, full body) and `material.jpg` (image 2, an empty scene without characters). Prompts are in `../style.json` → `refs`; the robot's shape and colours come from `broll/character.json`.

Known issue: in two rounds of image-01, every hand-drawn robot came out with an antenna on its head (the prompt already says the head is a smooth dome with no antenna), so it does not match the shared character (round, smooth head). The other three styles got smooth round heads; only the line-drawing look keeps adding an antenna, so v0.9 ships no references for this style.

Next step: use the picked `wood-blocks` character image as the reference for the line drawing. Add `"subjectFrom": "../wood-blocks/refs/character.jpg"` to the character entry in `../style.json` → `refs` (relative to `broll/styles/ink-sketch/`; the script sends that image as image-01 `subject_reference`), run `--dry-run` to check the request carries it, then make 2 candidates per image. Reject any robot with an antenna, knob or bolt on its head. Once both images pass, set `status` back to `stable`, add `ink-sketch` back to the `pairsWith` of the styles that should pair with it, and update the docs. `subject_reference` is documented for human characters and has not been tried on a toy-robot line drawing; if it does not hold, trace the wood-blocks character into a line drawing first and use that as the reference.

Pick only images where no surface has round studs, the robot's head top is smooth and both hands are solid balls, there is no text, and both images look like the same world.
