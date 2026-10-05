# 积木风（wood-blocks）参考图

这里放两张图，还没出：

- `character.jpg`：图1，角色。机器人正面全身，单独站着。
- `material.jpg`：图2，材质。一片没有角色的空场景。

出图提示写在 `../style.json` 的 `refs` 里，机器人的形状和色号来自 `broll/character.json`。

```bash
node scripts/broll/make-style-refs.mjs --style wood-blocks --dry-run      # 看请求，不花钱
node scripts/broll/make-style-refs.mjs --style wood-blocks --n 2 --yes    # 每张 2 张候选，挑好改名
```

挑图标准：任何表面都没有圆形凸点；机器人头顶光滑、两只手都是实心圆球；画面里没有字；两张图看着是同一个世界。

没有这两张图时，这个风格只能用 `provider: placeholder` 预览；`minimax-h3` 会在提交前停下，不花钱。

## English

Two images go here (not made yet): `character.jpg` (image 1, the robot, front view, full body) and `material.jpg` (image 2, an empty scene without characters). Prompts are in `../style.json` → `refs`; the robot's shape and colours come from `broll/character.json`. Run the commands above (`--dry-run` first, then `--yes`), rename the chosen candidates, and check: no round studs on any surface, smooth head top, both hands solid balls, no text, both images look like the same world. Without them this style only works with `provider: placeholder`; `minimax-h3` stops before submitting and charges nothing.
