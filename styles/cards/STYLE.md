# cards 风格（卡片信息流）

默认风格。分镜不写 `meta.style` 就是它。代码原地不动：镜头在 `template/src/shots/`，主题在 `template/src/core/themes.json`，背景和字幕层在 `template/src/core/layers.tsx`；这里只按九层模板把它登记清楚，方便二创的人照着改、三创的人对照着写新风格。

## 1. 基本参数

- 画幅 9:16（1080×1920），30 fps，默认 120 BPM（一拍 0.5 秒）；`meta.bpm` 可在 90–150 之间改。
- 总时长 15–45 秒（`meta.durationRange` 可放宽），20–30 秒最好。
- 安全区：y 0–205 只放背景；y 260–540 字幕带；y 560–1340 镜头主体区；关键内容 x 180–900。

## 2. 叙事结构

hook（2–3 秒，第 0 帧就有封面大标题）→ 中段 3–7 镜（至少一镜演示核心动作、至少一镜 compare/steps/phone/meter）→ endCard（4 秒）。各行业的推荐结构见 `industries/<行业>/recipe.md`。

## 3. 视觉系统

- 背景：随 `mood` 变化的上下两色渐变（痛点偏暖红，产品和片尾偏冷）+ 下三分之一氛围层。
- 主体：居中白卡或深色卡（6 套主题，`meta.theme`），`meta.brandColor` 只换强调色。
- 字：思源黑体可变字重；字幕是白字 + 粗描边 + 硬投影，`{}` 包住的字变强调黄。

## 4. 镜头语言

固定机位。每镜一个「会动的主角」（指针、数字、气泡、点击），卡片在主体区内入场、演完、4 帧内淡出下移。

## 5. 动效语言

弹簧入场（卡片 14/170、气泡 11/220、大字 16/170），关键动作落整拍；入场 1 拍内完成，之后每拍一个新信息，最后留 ≥0.5 秒给观众读。详见 `template/SHOT_API.md` 第 6 节。

## 6. 元件库

18 个公共镜头：hook、chat、phone、mockApp、meter、compare、counter、features、steps、quickList、endCard，以及行业镜头 photoShot、priceCard、storeCard、reviewCard、factSheet、credCard、beforeAfter。字段和字数上限见 `shots.md`。

## 7. 声音

`make.mjs` 按镜头起点和 mood 自动生成原创配乐（`scripts/make_bgm.py`），镜头按 spec 的 sfx 卡点放音效。

## 8. 可变与不变

- 模型填：镜头选择、字幕、每镜 params、mood、主题。
- 固定：安全区、字号底线、转场、音乐生成方式。

## 9. 规则

见 `SKILL.md` 的「硬规则」和 `industries/<行业>/rules.json`。

## 适合 / 不适合

- 适合：单一卖点、要讲流程、要演示界面、实物门店（配行业镜头）。
- 不适合：需要「先猜再揭晓」互动的内容（用 quiz），类别很多要一次铺开的内容平台（用 journey）。
