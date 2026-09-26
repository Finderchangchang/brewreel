# priceCard 价格卡/价目表

把明码标价的排版规则做进组件里，模型只填数字和条件，价格区不会因为排版问题看不清、不会闪烁抖动。两种布局：
- `card`：单个房型/套餐/商品的价格卡。大价格 + 单位 + （可选）划线对比价 → 商品名 → 分隔线 → 包含项清单 → 限制/另收费用/条件/活动期 → 赠品 → 脚注。
- `menu`：2–6 行的价目表，名称和价格用虚线对齐，行数多的时候用它，不要硬塞进 card。

**不写「原价」二字。** 有划线对比价时，`compare.basis` 必须写清楚这个对比价是什么依据（「厂商建议零售价」「单点合计」……），画面直接显示这个依据文字，不出现「原价」。

## 什么时候用
- 需要明确标价的镜头：套餐价、门票、课时费、理发价、商品价目表。
- 到手价/券后价这类需要写清楚条件的场景：写进 `conditions`。

## 什么时候别用
- 只是想在别的镜头角落带一个小价签（比如菜品照片上的价签）：用 `photoShot` 的 `price`/`unit` 字段，不用单独开一镜 priceCard。
- 没有真实价格，编一个数字撑场面：不写这一镜，或者等有价格再补。

## 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| layout | 否 | — | `card`（默认）/ `menu` |
| items | 是 | 1–6 项 | card 布局只看第 1 项；menu 布局逐行显示 |
| items[].itemId | 是 | 20 字 | 对应简报价格表里的 id |
| items[].name | 否 | card 10 字 / menu 8 字 | 商品/套餐名 |
| items[].price | 是 | — | 数字，不允许 0/1/9.9 这类噱头价 |
| items[].unit | 是 | 4 字 | 碗/杯/只/晚/次/位/人/张/套 |
| items[].from | 否 | — | true 时价格后带「起」；card 布局要配 fromNote，menu 布局要配 addOns |
| items[].fromNote | from=true 时必填（card） | 12 字 | 「起」价的说明 |
| items[].note | 否 | 12 字 | 一行小字说明 |
| label | 否 | — | 售价/到手价/券后价/团购价/套餐价/活动价/门票 |
| people | 否 | 6 字 | 如「2–3人」 |
| includes | 否 | ≤6 项，每项 8 字 | 包含项清单，写清数量 |
| excludes | 否 | 14 字 | 另收费用；要求必填时没有就写「无其他收费」 |
| limits | 否 | ≤3 项，每项 14 字 | 如「限堂食」「不可叠加」 |
| conditions | 否 | 16 字 | 到手价/券后价的条件 |
| period | 否 | 16 字 | 活动起止日期 |
| addOns | 否 | ≤4 项 | {cond, extra}，如「及腰长发」+「160元」 |
| compare | 否 | — | {price, basis, evidence}；basis 从固定选项里选，evidence 不上屏 |
| gift | 否 | — | {name, qty}，如「焗油」×1 |
| footnote | 否 | 24 字 | 固定文案（各行业统一口径），不要自己改写 |

## 时长
card 2–4.5 秒；menu 不少于 3 秒（行数多给到 4–4.5 秒）。

## 好例子
```json
{"type": "priceCard", "dur": 4, "caption": "双人招牌餐，\n{团购价59元}", "mood": 0.15,
 "params": {"layout": "card",
   "items": [{"itemId": "deal-1", "name": "双人招牌餐", "price": 59, "unit": "份"}],
   "label": "团购价", "people": "2人",
   "includes": ["红烧牛肉面×2", "手打牛肉丸×1份(6颗)", "凉拌三丝×1"],
   "limits": ["限堂食", "不可叠加"],
   "compare": {"price": 68, "basis": "单点合计", "evidence": "菜单图 photos/menu.jpg"},
   "footnote": "以团购详情页为准"}}
```
```json
{"params": {"layout": "menu",
  "items": [
    {"itemId": "a", "name": "红烧牛肉面", "price": 22, "unit": "碗"},
    {"itemId": "b", "name": "手打牛肉丸", "price": 16, "unit": "份"},
    {"itemId": "c", "name": "小份牛肉面", "price": 12, "unit": "碗", "note": "一个人也能点"}
  ], "label": "菜单价"}}
```

## 坏例子
- `price: 9.9` 当引流噱头价：会被行业规则拦（噱头价不允许）。
- 写了 `compare` 但 `basis` 不在固定选项里，或没给 `evidence`：校验会拦，价格对比必须有依据。
- 画面上出现「原价」二字：改成 `compare.basis` 本身的说法（如「厂商建议零售价」）。
- `items[].from: true` 却不给 `fromNote`（card）或 `addOns`（menu）：起价必须说明「起」在哪。
