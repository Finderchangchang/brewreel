# 文旅住宿简报模板

通用字段同 `industries/food/brief-template.md` 开头所列。

## 本行业专属字段
name、type（民宿/酒店/景区/度假村/营地/农家乐）、location{province,county,village,landmark}（不写门牌号）、routes[]{to,mode,minutes,basis}、parking、pickup{price,advanceDays}、rooms[]{id,name,area,bed,capacity,view,photos[]{src,month}}、publicAreas[]{name,photo,extraFee}、prices[]{itemId,weekday,weekend,holiday,unit,breakfast,checkedAt}、deals[]{itemId,price,includes,excludes,validDays,weekendSurcharge,validUntil,advanceDays}、fees{deposit,pet,extraBed,lateCheckout,parking}、ticket{adult,child,senior,hours,closedDays,reservation,extraItems[],riskItems[]}、licenses{business,specialTrade,homestayFiling,hygiene,food,travelAgency}、certs[]{grade,proof}、facts[]、reviews[]、seasonal[]{scene,months,photoMonth,weatherDependent}、audience、platform、attachDeal、theme、brandColor、logo、avoid[]、ownerSaid[]。

## 示例
见 `test-brief.md`：松溪小住（虚构民宿）。
