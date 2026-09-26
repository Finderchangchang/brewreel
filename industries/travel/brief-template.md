# 文旅住宿简报模板

通用字段同 `industries/food/brief-template.md` 开头所列。

## 本行业专属字段
name、type（民宿/酒店/景区/度假村/营地/农家乐）、location{province,county,village,landmark}（不写门牌号）、routes[]{to,mode,minutes,basis}、parking、pickup{price,advanceDays}、rooms[]{id,name,area,bed,capacity,view,photos[]{src,month}}、publicAreas[]{name,photo,extraFee}、prices[]{itemId,weekday,weekend,holiday,unit,breakfast,checkedAt}、deals[]{itemId,price,includes,excludes,validDays,weekendSurcharge,validUntil,advanceDays}、fees{deposit,pet,extraBed,lateCheckout,parking}、ticket{adult,child,senior,hours,closedDays,reservation,extraItems[],riskItems[]}、licenses{business,specialTrade,homestayFiling,hygiene,food,travelAgency}、certs[]{grade,proof}、facts[]、reviews[]、seasonal[]{scene,months,photoMonth,weatherDependent}、audience、platform、attachDeal、theme、brandColor、logo、avoid[]、ownerSaid[]。

## 示例
见 `test-brief.md`：松溪小住（虚构民宿）。

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
- 季节景观照片在 `note` 里写拍摄月份（如「2025 年 10 月实拍」），画面才能标「10月实拍」。
## 价格和它的条件要写进同一条 fact
价格表原话整句抄进 `meta.facts`（如「山景大床房：周日至周四 368 元/晚，周五周六 468 元/晚，法定节假日 598 元/晚」「活动：9月26日至10月7日，领 20 元店铺券后 59 元/只」）。校验按 fact 核对画面：周末/节假日价、券后条件、加价、有效期、预约、不可用日期、附加费金额，缺一个就拦；日期段写得和 fact 不一样（如把周日算进周末）也拦。
