# beforeAfter 前后对比滑块

**最小可用写法**（照抄改字即可通过校验）：
```json
{"type": "beforeAfter", "dur": 3,
 "params": {"before": {"src": "photos/before.png"}, "after": {"src": "photos/after.png"}, "consent": true, "retouched": false, "subVertical": "hair"}}
```
只在美业开放。两张必须是同一位顾客的商家实拍，并在 meta.assets 登记：`[{"src": "photos/before.png", "source": "merchant", "kind": "customer-before", "pair": "A"}, {"src": "photos/after.png", "source": "merchant", "kind": "customer-after", "pair": "A"}]`。没有照片就改用 steps。

同一位顾客做之前和做完的真实对比：一根滑杆从右往左扫过，露出「之后」。只有美业开放（发型 / 美甲 / 美睫）。

## 什么时候用
- 有同一位顾客、同一机位拍的「之前」「之后」两张真实照片，并且已经书面授权、没有修图。

## 什么时候别用
- 缺照片、没有授权、修过图，或者素材是 AI 生成的：一律不能用这个镜头，改用 steps 讲操作过程。
- `subVertical` 不支持医美相关项目（不接受 skincare 取值），这类需求这个镜头直接不做。

## 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| before.src | 是 | 素材 png/jpg/jpeg/webp | 做之前的照片 |
| before.label | 否 | 4 字 | 默认「做之前」 |
| after.src | 是 | 素材 png/jpg/jpeg/webp | 做完的照片 |
| after.label | 否 | 4 字 | 默认「做完」 |
| consent | 是 | 必须为 true | 顾客已书面授权 |
| retouched | 是 | 必须为 false | 未修图 |
| sameAngle | 否 | true/false | 建议 true：同一机位拍摄 |
| subVertical | 是 | — | hair / nail / lash |
| caption2 | 否 | 12 字 | 卡片内的一句说明，和镜头字幕（caption）分开显示 |

镜头固定显示「顾客授权实拍 · 未修图」和「效果因人而异，仅供参考」，这两行由组件写死，不用也不能写进 params。

## 时长
2–4 秒，默认 3 秒。给到 3.5–4 秒时「之前」「之后」两侧停留更从容；2 秒是压缩节奏的下限，滑杆动作会更快。

## 好例子
```json
{"type": "beforeAfter", "dur": 3.5, "mood": 0.15,
 "params": {"before": {"src": "photos/hair-before.jpg"}, "after": {"src": "photos/hair-after.jpg"},
   "consent": true, "retouched": false, "sameAngle": true, "subVertical": "hair"}}
```
```json
{"type": "beforeAfter", "dur": 3, "mood": 0.15,
 "params": {"before": {"src": "photos/nail-before.jpg", "label": "之前"}, "after": {"src": "photos/nail-after.jpg", "label": "之后"},
   "consent": true, "retouched": false, "subVertical": "nail", "caption2": "顾客当场确认"}}
```

## 坏例子
- `retouched` 写 true，或者压根不填 `consent`：直接被拦。
- `subVertical` 写成医美相关的取值：不在这个镜头的适用范围内。
- 没有真实前后照片时硬凑一张示意图：缺照片时这个镜头直接不画、不生成，改用别的镜头。
