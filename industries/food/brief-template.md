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

<!-- round5 -->
## 素材清单（assets）
简报里每一个要上片的图片/视频都登记一行，模型原样抄进 `storyboard.json` 的 `meta.assets`；没登记来源的文件校验会直接拦。

| 字段 | 必填 | 说明 |
|---|---|---|
| src | 是 | 文件路径（相对 storyboard.json 所在目录） |
| source | 是 | `merchant` 商家实拍 / 顾客授权照片；`illustration` 插画、设计图、AI 生成图；`screenshot` App、网页、小程序截图 |
| kind | 建议 | 拍的是什么：dish / product / room / store / customer-before / customer-after / review … |
| pair | 前后对比必填 | 同一位顾客同一次服务的前后两张写同一个值，如 `"A"` |

- 只有 `source: merchant` 的照片能在画面上标「实拍」「N月实拍」「顾客授权」「未修图」。
- 小于 2KB、短边小于 300px、解不开的文件、`_dev/` 目录下的文件、仓库自带的示例截图（改名复制也认得出）一律不收。
- 截图只能放 `phone` 镜头，不能放进 `photoShot` 当实拍。
- 商家确实没有照片：素材清单写"无"，片子用插画兜底（`source: "drawn"` + `illust` + `tag: "示意"`），校验只给提醒、不拦，正式发布前再补实拍。

## 价格和它的条件要写进同一条 fact
价格表原话整句抄进 `meta.facts`（如「山景大床房：周日至周四 368 元/晚，周五周六 468 元/晚，法定节假日 598 元/晚」「活动：9月26日至10月7日，领 20 元店铺券后 59 元/只」）。校验按 fact 核对画面：周末/节假日价、券后条件、加价、有效期、预约、不可用日期、附加费金额，缺一个就拦；日期段写得和 fact 不一样（如把周日算进周末）也拦。
