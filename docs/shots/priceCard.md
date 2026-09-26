# priceCard 价格卡/价目表

**最小可用写法**（照抄改数字即可通过校验）：
```json
{"type": "priceCard", "dur": 3, "params": {"layout": "card",
  "items": [{"itemId": "<简报价格表里的 id>", "name": "双人套餐", "price": 79, "unit": "份"}]}}
```

把明码标价的排版规则做进组件里，模型只填数字和条件，价格区不会因为排版问题看不清、不会闪烁抖动。两种布局：
- `card`：1–3 个价格的价格卡。1 项时是大价格 + 单位 + （可选）划线对比价 → 商品名；2–3 项时逐行堆叠，每行「名称/说明 + 价格」依次落定。下面是分隔线 → 包含项清单 → 限制/另收费用/条件/活动期 → 赠品 → 脚注。
- `menu`：2–6 行的价目表，名称和价格用虚线对齐。

**给了几项就显示几项，一项都不丢。** card 给 4 项以上会自动换成 menu；内容多到主体区放不下时，包含项改成两列、间距收紧，最后整体缩小，但不会删掉任何一行。

**同一房型/套餐分两档价**（平日/周末、单人/双人）：写两项 items，`name` 相同，`note` 分别照抄 facts 里的日期范围或条件。画面把名字写一次当小标题，两行价格各带自己的日期。只写一项、把另一档价写进 conditions 或干脆不写，都会让观众以为只有一个价。

**不写「原价」二字。** 有划线对比价时，`compare.basis` 必须写清楚这个对比价是什么依据（「厂商建议零售价」「单点合计」……），画面直接显示这个依据文字，不出现「原价」。

卡片高度跟着内容走，在主体区里垂直居中，不会留一大片空白。`footnote` 和 `meta.notices` 里某一条相同（忽略空格和标点）时，画面只显示底部提示条那一份，不重复。

## 什么时候用
- 需要明确标价的镜头：套餐价、门票、课时费、理发价、商品价目表、房型平日/周末价。
- 到手价/券后价这类需要写清楚条件的场景：写进 `conditions`（如「领20元券后」）。

## 什么时候别用
- 只是想在别的镜头角落带一个小价签（比如菜品照片上的价签）：用 `photoShot` 的 `price`/`unit` 字段，不用单独开一镜 priceCard。
- 没有真实价格，编一个数字撑场面：不写这一镜，或者等有价格再补。

## 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| layout | 否 | — | `card`（默认，1–3 项）/ `menu`（2–6 项） |
| items | 是 | 1–6 项 | 全部显示；card 超过 3 项自动换 menu |
| items[].itemId | 是 | 20 字 | 对应简报价格表里的 id |
| items[].name | 否 | card 10 字 / menu 8 字 | 商品/套餐/房型名；同一房型两档价就写同一个名字 |
| items[].price | 是 | — | 数字，不允许 0/1/9.9 这类噱头价 |
| items[].unit | 是 | 4 字 | 碗/杯/只/晚/次/位/人/张/套 |
| items[].from | 否 | — | true 时价格后带「起」；card 布局要配 fromNote，menu 布局要配 addOns |
| items[].fromNote | from=true 时必填（card） | 12 字 | 「起」价的说明 |
| items[].note | 否 | 12 字 | 一行小字说明；多项同名时就是这一行的标题（如「周一至周四」） |
| label | 否 | — | 售价/到手价/券后价/团购价/套餐价/活动价/门票（英文片也写中文值，画面自动换成英文） |
| people | 否 | 6 字 | 如「2–3人」 |
| includes | 否 | ≤6 项，每项 8 字 | 包含项清单，写清数量 |
| excludes | 否 | 14 字 | 另收费用；要求必填时没有就写「无其他收费」 |
| limits | 否 | ≤3 项，每项 14 字 | 如「限堂食」「不可叠加」 |
| conditions | 否 | 16 字 | 到手价/券后价的条件 |
| period | 否 | 16 字 | 活动起止日期 |
| addOns | 否 | ≤4 项 | {cond, extra}，如「及腰长发」+「160元」 |
| compare | 否 | — | {price, basis, evidence}；basis 从固定选项里选（英文片同样写中文值），evidence 不上屏 |
| gift | 否 | — | {name, qty}，如「焗油」×1 |
| footnote | 否 | 24 字 | 固定文案（各行业统一口径），不要自己改写；和 notices 重复时不显示 |

## 时长
card 1 项 2–3 秒，2–3 项 3–4 秒；menu 不少于 3 秒（行数多给到 4–4.5 秒）。

## 好例子
```json
{"type": "priceCard", "dur": 3.5, "caption": "平日周末，\n{价格写清楚}", "mood": 0.15,
 "params": {"layout": "card", "label": "售价", "people": "2人",
   "items": [
     {"itemId": "room-a-weekday", "name": "庭院双床房", "price": 328, "unit": "晚", "note": "周一至周四"},
     {"itemId": "room-a-weekend", "name": "庭院双床房", "price": 428, "unit": "晚", "note": "周五至周日"}
   ],
   "includes": ["两份早餐", "免费停车"],
   "conditions": "法定节假日另计"}}
```
```json
{"type": "priceCard", "dur": 4, "caption": "三人小聚，\n{套餐价99元}", "mood": 0.15,
 "params": {"layout": "card",
   "items": [{"itemId": "set-3", "name": "三人小聚餐", "price": 99, "unit": "份"}],
   "label": "套餐价", "people": "3人",
   "includes": ["招牌锅底×1", "时蔬拼盘×1", "饮品×3"],
   "limits": ["限堂食", "不可叠加"],
   "compare": {"price": 128, "basis": "单点合计", "evidence": "菜单图 photos/menu.jpg"}}}
```
```json
{"params": {"layout": "menu", "label": "售价",
  "items": [
    {"itemId": "a", "name": "招牌汤面", "price": 18, "unit": "碗"},
    {"itemId": "b", "name": "鲜肉馄饨", "price": 15, "unit": "碗"},
    {"itemId": "c", "name": "小份汤面", "price": 12, "unit": "碗", "note": "一个人也能点"}
  ]}}
```

## 坏例子
- `price: 9.9` 当引流噱头价：会被行业规则拦（噱头价不允许）。
- 平日 368、周末 468 只写了一项 368，周末价写进 conditions 或不写：观众看到的就只有一个价。写两项 items。
- 写了 `compare` 但 `basis` 不在固定选项里，或没给 `evidence`：校验会拦，价格对比必须有依据。
- 画面上出现「原价」二字：改成 `compare.basis` 本身的说法（如「厂商建议零售价」）。
- `items[].from: true` 却不给 `fromNote`（card）或 `addOns`（menu）：起价必须说明「起」在哪。
- `note` 自己改写日期范围（facts 写「周一至周四」，卡上写「周一到周五」）：照抄 facts。
