# test-brief.md 对应的预期校验结果

## 应拦截（block）
| 商家想加的说法 | 命中规则 |
|---|---|
| "全网最低价，仅此一天！" | `B-lowest` + `B-urgent` |
| "原价 129，现在 59，直接 3 折！" | `compareHasBasis`（"原价"二字不能上屏）+ `discountMath`（59/129≈4.6 折，写"3折"算错了） |
| "喝热水还能预防感冒" | `B-medical` |
| "加 V 看更多颜色" | `B-contact` |
| "假一赔十" | `E-service`（没有 `refs` 指向 `meta.facts` 里的服务依据） |
| "比 XX 牌保温杯强多了" | `B-rival`（"比…强多了"分支） |
| "12 小时保温" | `E-3c`（同一镜头没有 `condition`/`source` 或 `refs`） |

priceCard 需要同屏写「划线价为前7日最低成交价 79元」「需领取20元店铺券后」「9.26–10.7」和固定 footnote「价格以下单页为准」。

用了 `chat` 镜头会被 `chatDisclaimer`/行业禁用规则拦——本例 `brief.realQA` 为空，chat 一律不能用（本阶段没有 brief 读取器，实操中体现为：不给 `meta.disclaimer` 写"演示/模拟"就会被拦，且不应该为了通过校验硬凑 disclaimer——没有真实问答就不要用这个镜头）。

## 应人工复核 / 发布前确认
- publishChecklist 里要提醒"用了 AI 配音，发布时勾选 AI 生成内容声明"（`_base` 的 `publishChecklist` 已含这条）。
- `platform` 用 douyin_cart 时若带 `priceCard`，会给出警告：字幕出现价格和 2026-02-10 价格整治口径可能冲突，建议默认不带（详情见 `industries/ecommerce/rules.json` 的 `humanReview`）。

## 已知限制
- `meta.platform` 目前 schema 只支持 `douyin`/`shipinhao`/`generic`，设计里更细的 `douyin_cart`/`channels_cart` 等取值本阶段统一按 `douyin` 处理，见 `rules.json` 里的说明。
- `priceMatchesBrief` 只做 storyboard 内部一致性核对，不对照 `test-brief.md` 的价格表（无 brief 加载器）。
