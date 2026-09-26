# test-brief.md 对应的预期校验结果

## 应拦截（block）
- 顾客A 的前后对比：`consent:true`、`retouched:false`、`subVertical:"hair"` 齐全 → `beforeAfterConsent` 放行。
- 顾客B 的前后对比：没有书面授权 → `beforeAfterConsent` 拦截（`consent` 不为 true）。

| 店主原话 | 命中规则 |
|---|---|
| "我们的头疗能防脱生发" | `BE-efficacy`（"防脱生发"） |
| "全成都剪短发最好的店" | 通用极限词（"最好"，在 `scripts/validate.mjs` 主体的 `AD_WORDS` 里，不在行业规则内，两层规则会同时拦） |
| "90%的顾客都会回头" | `B-data`（没有 `source`） |
| "加我微信 lizi-hair 预约" | `B-contact` |
| "做完显年轻十岁，不再是黄脸婆" | `BE-efficacy`（"年轻十岁"）+ `BE-anxiety`（"黄脸婆"） |

## 应人工复核（human）
- "头疗"本身不在任何 block 正则里，但属于灰区词，`industries/beauty/rules.json` 的 `humanReview` 有一条提醒改写成"护理"。

## 结构检查
- 染发 298 元起（`from:true`）必须同屏列出三条加价项（`addOns`），本例已给"及肩以下+80元""及腰+160元""漂色另计+200元/次"。
- 团购门市价 138 要标注"近7日成交价"（`compare.basis` 的允许值之一）；抖音挂团购版按 `_base`/行业的 `forbidCompareWhen` 规则，`compare` 整体不能上屏，门市价不出现。
- 储值卡"充1000送100"如果上屏，要写清"签电子合同，未消费余额可退"，不写施压话术——这条走人工判断（`giftHasQty` 只检查有没有品名+数量，不检查合同条款措辞）。

## 必备提示语
`storeCard` 有出现时要带「生活美容 · 不提供医疗美容服务」（本例的 `storeCard` 需要在 `meta.notices` 里写这句原文，或者组件渲染时自动加——本阶段校验按 `meta.notices`/`disclaimer` 检查，不检查组件是否自动补全）。

<!-- round5 -->
## round5 新增检查：素材真实性（assetTruth，对应 tests/rules/beauty/04–08）
评审原案：一张会议纪要 App 截图同时当理发的「做之前」和「做完」，还标着「顾客授权实拍 · 未修图」，校验放行了。现在：
- before 和 after 是同一个文件 → 拦（`04-beforeafter-same-file.json`）；文件名不同但内容哈希相同 → 拦（`05-beforeafter-same-hash.json`）。
- 前后两张必须在 `meta.assets` 登记为 `source: merchant`，`kind` 分别是 `customer-before` / `customer-after`，`pair` 一致；登记成 `screenshot`、用仓库示例截图（改名复制也认得出）→ 拦（`06-beforeafter-screenshot.json`）。
- 插画/设计图标「实拍」、字幕写「顾客授权实拍 未修图」却没有商家照片 → 拦（`07-illustration-labelled-real.json`）。
- 没有授权对比图时，`steps`（洗→剪→吹）+ 插画兜底照样放行（`08-no-photo-fallback-ok.json`）。

顾客A 的授权对比图在素材清单里要写成两条：`{src, source: "merchant", kind: "customer-before", pair: "A"}`、`{src, source: "merchant", kind: "customer-after", pair: "A"}`，两个不同的文件。

## round5 其他
- **核心动作**：美业用 photoShot（实拍或插画）/ beforeAfter 演示，`mockApp` 编预约界面直接拦。
