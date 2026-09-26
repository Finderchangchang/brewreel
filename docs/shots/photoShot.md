# photoShot 实拍照片/短视频

非软件行业的主力镜头：把商家的实拍照片或短视频放大做主角，叠上菜名/商品名、一句卖点、价签这类信息。五种构图（`layout`）：
- `hero`：单张照片缓慢推近，底部渐变字幕带放标题/卖点/价签，适合招牌菜、主打商品、房型大图。
- `clip`：同 hero，素材换成一段短视频（带播放小标），适合制作过程、环境走动。
- `grid`：2–4 张拼贴依次入场，各带一个短标签，适合多角度环境照、几道菜一起亮相。
- `callouts`：一张照片 + 1–3 处引线圈注，适合讲清楚一张图里的几个细节（用料、工艺、部件）。
- `tour`：2–5 张依次轮播（带页码点），适合带看一个房间/一个空间的几个角度。

没有真实素材时，把这一项的 `source` 写成 `"drawn"`，不用给 `src`，改给 `illust`（插画名，从 `template/src/illust/names.json` 里按行业选，如 `"food/bowl"`）；不写 `illust` 也可以，会按 `meta.industry` 给一张默认插画。**插画兜底不是万能的**：一张干净的商家实拍永远比插画更有说服力，能拍就拍。

## 什么时候用
- 商家有真实照片/视频，想让它做画面主角（不是塞进手机框里当截图）。
- 需要在同一镜里把「这是什么」和「多少钱/什么标签」一起交代清楚。

## 什么时候别用
- 素材是 App 界面/操作演示：用 `phone`（真截图）或 `mockApp`（没截图时的模拟界面），不要用 photoShot 硬装。
- 一张图撑不起一整镜的信息量：并进 `features`、`quickList` 这类镜头，插画图标挂在那边就够。
- `grid` 缺图硬凑纯文字列表冒充环境照：直接跳过这一镜，或换用有图的镜头。

## 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| layout | 否 | — | `hero` / `clip` / `grid` / `callouts` / `tour`，不写按 hero |
| media | 是 | 1–5 项 | hero/clip/callouts 各 1 项；grid 2–4 项；tour 2–5 项 |
| media[].src | 条件必填 | — | 素材路径；`source: "drawn"` 时不填，改填 `illust` |
| media[].source | 是 | — | `merchant` 商家实拍 / `ai` AI 生成 / `drawn` 插画兜底 |
| media[].tag | 是 | — | `实拍` / `示意` / `效果图`；`source: "ai"` 时必须是「效果图」 |
| media[].illust | 否 | — | `source: "drawn"` 时选一张插画（见 names.json） |
| media[].label | 否 | 8 字 | grid/tour 每张图下的短标签 |
| media[].month | 否 | 1–12 | 季节/天气相关的画面填这个，会自动显示「N月实拍」 |
| title | 否 | 10 字 | 菜名/商品名/房型名 |
| tagline | 否 | 12 字 | 一句卖点 |
| badge | 否 | 4 字 | 如「招牌」「新品」 |
| price / unit | 否 | — | 角上的小价签，price 是数字，unit ≤4 字（碗/份/晚…） |
| roomType | 否 | 10 字 | 文旅专用，一镜只放一个房型 |
| callouts | layout=callouts 时必填 | 2–4 条，每条 text ≤8 字 | 引线圈注文字 |
| refs | 否 | — | 指向 meta.facts 的 id，给「现熬」「开了10年」这类说法当依据 |

## 时长
hero 1.5–3 秒；clip 2–4 秒；grid 2.5–4 秒；tour 每张 1.2–3 秒（总时长按张数给）；callouts 跟 hero 一样按内容给（默认 2.5 秒，圈注多给到 3.5–4 秒）。

## 好例子
```json
{"type": "photoShot", "dur": 2.5, "caption": "牛腱现卤，\n{骨汤熬足4小时}", "mood": 0.3,
 "params": {"layout": "hero",
   "media": [{"src": "photos/beef_noodle.jpg", "source": "merchant", "tag": "实拍"}],
   "title": "红烧牛肉面", "tagline": "牛腱自家卤", "badge": "招牌", "price": 22, "unit": "碗",
   "refs": ["f2"]}}
```
```json
{"type": "photoShot", "dur": 3, "mood": 0.25,
 "params": {"layout": "grid",
   "media": [
     {"src": "photos/hall.jpg", "source": "merchant", "tag": "实拍", "label": "大堂"},
     {"src": "photos/room.jpg", "source": "merchant", "tag": "实拍", "label": "包间"}
   ]}}
```
没有实拍图时的兜底写法：
```json
{"params": {"layout": "hero",
  "media": [{"source": "drawn", "illust": "food/bowl"}],
  "title": "招牌牛肉面", "price": 22, "unit": "碗"}}
```

## 坏例子
- `media[0].source: "merchant"` 但没给 `src`：校验会当成素材路径缺失。
- `source: "ai"` 却把 `tag` 写成「实拍」：AI 生成的画面必须标「效果图」，不能冒充实拍。
- `layout: "grid"` 只给 1 张：grid 至少要 2 张，1 张改用 `hero`。
- 把这一镜的 `title` 写成和 `meta.product` 不一致的产品名：photoShot 讲的是具体的菜/商品/房型，不是整个产品。
