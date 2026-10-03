# 它怎么工作

[← 返回 README](../README.md) · [English](how-it-works.en.md)


```
产品简报（brief）
  → 选配方：meta.style 选 cards / quiz / journey，meta.industry 选行业包
  → 便宜模型写分镜 storyboard.json（挑镜头、填文字，不写代码、不写坐标）
  → 校验 validate.mjs（硬性规则 + 广告法 / 行业合规，报错回喂给模型改）
  → 开酿 make.mjs（配乐 → 渲染 → 拼图 → 检查帧 → 交付清单）
  → 发布前人工自查（SKILL.md 的「发布前自查清单」）
```

- **简报**：商家或你自己填一份产品简报，通用模板是 [`brief-template.md`](../brief-template.md)，各行业另有 `industries/<id>/brief-template.md`。
- **选配方**：按内容挑配方和行业包，写进分镜的 `meta`。
- **写分镜**：模型读 `SKILL.md`（AI 助手的说明书）、配方的 `recipes.md` 和行业的 `recipe.md`，只输出一份 JSON。
- **校验**：`node scripts/validate.mjs storyboard.json` 出中文报告，指出哪一镜哪个字段要改、怎么改；`llm_make.py` 和插件会把报告原样回喂给模型。
- **开酿**：`make.mjs` 一条命令出片，任何一项自查有 ✗ 都不交付，见[「出片质检与交付清单」](features.md#出片质检与交付清单)。
- **人工自查**：交付时附一份发布前自查清单，列出机器判断不了的事（照片授权、评价真实性、价格条件等），由发布者确认。

<details>
<summary><b>目录结构</b></summary>

```
brewreel/
  SKILL.md / SKILL.en.md      AI 助手看的说明书（怎么挑镜头、写字段、走流程）
  README.md / README.en.md    人看的项目首页
  LICENSE / NOTICE / THIRD_PARTY_LICENSES.md
  shots.md / shots.en.md      19 个镜头的参数总表
  brief-template.md           通用简报模板
  docs/
    *.md / *.en.md            README 的详细页：安装、功能、截图、常见问题、原理、已知限制
    shots/                    每个镜头的详细文档（19 × 2 语言）
    images/                   README 里的 logo 和效果示例图
  industries/                 六个行业包
  scripts/
    validate.mjs              校验入口
    make.mjs                  一条命令出片
    llm_make.py               无头模式：简报 → 分镜 → 出片
    make_bgm.py               参数化原创配乐
    build_docs.mjs            从 spec.json 生成 shots.md / shots.en.md
    privacy-scan.mjs          发布前隐私自查
    check-originality.mjs     原创性检查：和参考片的配色色差（CIEDE2000）+ 招牌逐条记录
    checks/ lib/              校验规则的实现
  template/                   Remotion 渲染工程
    src/shots/                19 个公共镜头组件 + 参数 spec（cards 配方用）
    src/styles/               各配方的清单、设计令牌、专属镜头；registry.gen.ts 由 scripts/gen-styles.mjs 生成
    src/core/                 字体、主题、动画、版式等公共逻辑
    src/illust/               行业插画兜底
    public/                   字体、音效、示例素材
  examples/                   9 份可直接渲染的分镜样例（六行业 + 英文 + 两份通用示例，都是 cards 配方）
  styles/                     配方（风格包）：九层规格、叙事模板、规则、样例；_template/ 是新风格脚手架
  distill/                    调配方流程和可复用提示词（拆解 → 复刻 → 再设计 → 组件化 → 测试 → 评审）
  CONTRIBUTING.md             贡献说明（一创 / 二创 / 三创、PR 自查清单）
  integrations/
    deepseek-harness/         DeepSeek Harness 插件 dsh-brewreel（7 个工具）
  tests/
    validate/                 校验规则的正负例回归测试
    rules/                    六个行业的规则回归测试（各 4 例）
    originality/              原创性检查（色差算法、判定规则、招牌记录）的单元测试
```

</details>
