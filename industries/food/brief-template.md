# 餐饮简报模板

通用字段（各行业共有，见 `docs/dev` 设计说明）：`industry`（固定填 `food`）、`subCategory`、`platform`、`attachDeal`、`facts[]`、`reviews[]`、`honors[]`、`certs[]`、`assets`、`brandColor`、`ownerSaid`（老板原话，原样收录）、`forbidden`。

## 本行业专属字段
| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| storeName | 文字 | 是 | 店名 |
| category | 文字 | 是 | 品类，如"小吃快餐" |
| isChain | 布尔 | 是 | 是否连锁（影响视频号团购是否放开的提示） |
| city / landmark / hours / avgPrice | 文字/数字 | 建议给 | 城市、地标（不写门牌号）、营业时间、人均 |
| dishes[] | 数组 | 是 | `{id, name, price, unit, portion, photo, photoSource, sellingPoints[]{text, refs}}` |
| deals[] | 数组 | 挂团购时必填 | `{id, name, price, refPrice, basis, people, items[], limits[], extraFees, validFrom, validTo}` |
| promo | 对象 | 有活动时必填 | `{content, start, end, rules, limits}` |
| facts[] | 数组 | 有"现做/熬制/开店年份"类说法时必填 | `{id, claim, evidence}` |
| usesPrepared | 布尔 | 是 | 是否用了预制菜/中央厨房（影响"现做"类说法能不能写） |
| sellsAlcohol | 布尔 | 是 | 是否售酒 |
| certs[] / honors[] | 数组 | 有就填 | 认证；`honors[]` 要有 `{id, title, issuer, year, proof}` |
| reviews[] | 数组 | 有就填 | `{text, stars, platform, date, screenshot}` |
| salesData | 对象 | 画面要出现销量时必填 | `{value, source, asOf}` |

## 示例
```
店名：巷口牛肉面（虚构商家）
品类：小吃快餐；单店，非连锁
地标：地铁2号线桂园站B口，右转200米
营业时间：10:00–21:30
招牌菜：红烧牛肉面 ¥22/碗（牛腱80g+面200g），卖点"骨汤每天熬4小时"（依据f1：后厨作业记录+视频）
团购：双人招牌餐 ¥59，含红烧牛肉面×2+牛肉丸1份+凉拌三丝，限堂食，有效期至12-31
老板原话（原样收录，模型需过滤违规说法）："全城最正宗""喝我们的汤养胃驱寒""原价68现在只要59"
```

填完这份简报后，交给 skill 按 `recipe.md` 里的结构写 storyboard.json，再跑 `node scripts/validate.mjs`。
