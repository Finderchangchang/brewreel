# 新风格脚手架

这个文件夹是新风格的模板，不是一个风格（以 `_` 开头的文件夹不会被注册）。

## 一条命令建好骨架

```
node scripts/gen-styles.mjs --new <id> --name 中文名 --name-en EnglishName
```

它会：
- 把本文件夹的 `STYLE.md`、`STYLE.en.md`、`recipes.md`、`rules.json`、`checks.mjs`、`examples/` 复制到 `styles/<id>/`；
- 把 `code/` 复制到 `template/src/styles/<id>/`（`style.json` 清单、`tokens.json` 令牌、`index.ts`、一个示例镜头 `opening`）；
- 重新生成注册表 `template/src/styles/registry.gen.ts` 和 `template/src/styles/<id>/shots/index.gen.ts`。

新风格的 `status` 是 `draft`：校验会拦住正式出片，自测时设环境变量 `PROMO_DEV_STYLES=1`。

## 然后

1. 按 `STYLE.md` 的九层把规格写完（方法见 `distill/`）。
2. 改 `tokens.json`，加镜头（`shots/<type>.tsx + .spec.json`，加完跑 `node scripts/gen-styles.mjs`）。
3. 写 `rules.json` / `checks.mjs`、`recipes.md`、`examples/`。
4. 自测：ShotLab 出单帧（props 加 `"style":"<id>"`，可加 `"aspect":"4:5"`），`make.mjs --stills` 出几帧，最后出整片。
5. 过一遍 `CONTRIBUTING.md` 的 PR 自查清单，把 `status` 改成 `stable`。

## 占位符

模板里的 `__ID__`、`__NAME__`、`__NAME_EN__`、`__FIRST__` 由脚本替换，手动复制时自己改。