# test-brief.md 对应的预期校验结果

抖音版按结构 A（团购套餐带货）写，视频号版不挂团购、不出现 priceCard 团购价签。

## 应拦截（block）
把 test-brief.md「老板原话」逐句搬进画面，校验应拦住：

| 老板原话 | 命中规则 |
|---|---|
| "全城最正宗的牛肉面" | `F-superlative` |
| "喝我们的汤养胃，冬天驱寒" | `F-health`（"养胃""驱寒"） |
| "原价68现在只要59" | `compareHasBasis`（画面不能出现"原价"二字；`B-refprice` 的正则已并入这个检查函数，不再单独作为 pattern） |
| "评论区扣1送一瓶啤酒" | `B-induce` |
| "啤酒不醉不归" | `B-alcohol` |
| "隔壁那家都是料理包，我们比他们好吃多了" | `B-rival`（"比…好吃多了" 命中同一条规则里补的分支） |
| "电话 138xxxx5678 可以订座" | `B-contact`（注意：脱敏写法 `138xxxx5678` 里的 `x` 不是数字，不会被手机号正则命中；如果老板给的是完整号码 `13800005678` 才会命中——这是预期行为，测试样例请用完整号码） |

另外：
- 凉拌三丝的调料汁是外购预包装（`usesPrepared` 相关品项），如果画面写"自制酱汁"，`F-fresh` 应拦截（无论有没有 `refs`，本阶段没有 brief.usesPrepared 的读取器，`blockIf` 分支暂不生效——见 `scripts/checks/index.mjs` 文件头的已知限制说明，这一条目前只能靠"不给 refs 就拦"兜底，请在测试样例里不要给这条 refs）。
- 红烧牛肉面的"骨汤每天熬4小时""牛腱自家卤"如果 `refs` 正确指向 `meta.facts` 的 f1/f2，`F-fresh` **不会**误拦（本仓库测试样例 `tests/rules/food/00-compliant.json` 已验证这一点）。

## 应人工复核（human）
- "量大管饱，吃不完打包" → 规则 `F-portion`（人工判断是否要改写成具体分量）。
- 荣誉"桂园街道十佳小吃"有 `honors` 依据（本阶段没有 brief 加载器，`refs` 只能对照 `meta.facts`，不能对照 brief.honors；实操中请把荣誉证明也抄一条进 `meta.facts` 供 `refs` 引用）。

## 必备提示语（requiredNotices，缺了会 block）
- `photoShot` 出现菜品时：「图片仅供参考 以实物为准」
- 抖音（`meta.platform: "douyin"`）：「以团购详情页为准」

## 其他检查
- `priceCard.limits` 至少 1 条（团购"限堂食"可以放进去）；`excludes` 本例不是火锅/自助/烧烤/茶楼，不强制。
- 画面出现"已售3,200份"要同时写"数据来源：抖音来客，统计至2026年9月"（`B-data` 的 `unless: shotHas source` 分支）。
- 视频号单店挂团购：本阶段没有 `meta.subCategory`/`isChain` 字段的读取器，"仅对连锁开放"这条只在 `industries/food/rules.json` 的 `humanReview` 里留了通用提醒，没有做成按 `isChain` 触发的精确判断——见仓库根目录交付说明里的已知缺口。

## 已知限制（写在这里，别在别处重复找）
本阶段（行业规则校验）没有 `brief.json` 的加载器，所以：
- `priceMatchesBrief` 只能做"同一 `itemId` 在 storyboard 内前后价格是否一致"的自洽检查，不能对照简报里的价格表。
- `credVerbatim` / `reviewVerbatim` 降级成人工复核提醒，不做逐字比对。
- `meta.subCategory` 还没有加进 `template/src/schema.ts` 的 `Meta.known` 字段列表，真用 `storyboard.json` 跑的话写了 `subCategory` 会被 `validate.mjs` 判成"不认识的字段"报错；本仓库的自动化测试（`scripts/test-rules.mjs`）绕过了这一层，直接调用规则引擎，所以架构已经就绪，等 schema 补上这个字段就能用。
