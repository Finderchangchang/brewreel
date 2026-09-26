# 电商实物简报模板

通用字段同 `industries/food/brief-template.md` 开头所列。

## 本行业专属字段
category、platform（douyin_cart/douyin_plain/channels_cart/channels_plain/xiaohongshu，注：`meta.platform` 目前 schema 只有 douyin/shipinhao/generic 三档，这里先按 douyin 统一处理，见 `expected.md` 的已知限制）、productName、brand、sku、productPhotos[]、painPoint、targetUser、scenes[]、sellingPoints[]{text,refs}、specs[]、testData{metric,from,to,unit,duration,condition,source,reportNo}、price、priceUnit、priceLabel、priceConditions、comparePrice、compareBasis、compareEvidence、promoPeriod、gifts[]{name,qty,currentPrice}、services[]、salesClaims[]{value,source,asOf}、certificates[]、origin、realQA、competitorBrands[]、usesAIVoice、usesAIImage、brandColors、logo、cta、durationSecs、ownerSaid[]。

## 示例
见 `test-brief.md`：暖屿 380ml 一键弹盖保温杯（虚构品牌）。
