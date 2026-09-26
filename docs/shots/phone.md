# phone 手机截图 + 圈注

**最小可用写法**（照抄改字即可通过校验）：
```json
{"type": "phone", "dur": 4, "caption": "打开就能看，\n{要点都标好}",
 "params": {"src": "assets/screen.png", "focus": [{"area": "middle", "label": "要点自动标好", "style": "box"}]}}
```
`src` 换成你自己的竖屏截图；没有截图就改用 mockApp。

手机框居中，里面放用户给的真截图或录屏。按拍依次圈出 1–3 处，每处配一句短说明。截图只在手机里，不会整屏放大、不会来回晃。

三种圈注样式：
- `zoom` 放大镜（默认）：那一段从手机里弹出成大卡片，看得清细节；下一处出现时缩回去，原位留编号框
- `box` 高亮框：给那一段描边、编号，旁边贴标签
- `arrow` 箭头：手机外侧一个大箭头指向那一段，旁边贴标签

当前圈中的那一段是亮的，其余部分压暗。

## 什么时候用
- 手上有产品的**真截图 / 录屏**，想说「看这里有这个功能」。这比 mockApp 更可信。
- 一镜讲 1–3 个看得见的功能点。

## 什么时候别用
- 没有截图：改用 mockApp。
- 只想放一张图、不圈重点：别用。没有圈注就没有信息增量，这是 v1 被批评「只是图片来回动」的原因。
- 截图里有网址、二维码、账号名、手机号、真实人名、第三方 App 的 logo：先打码或换图。

## 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| src | 是 | 截图或录屏路径，相对 storyboard.json 所在目录。支持 png / jpg / jpeg / webp / mp4。竖屏手机截屏最好（如 1080×2340） |
| focus | 是 | 1–3 处圈注，每 2 拍（1 秒）出现一处 |
| focus[].area | 是 | 圈截图从上到下平均分成 5 段里的哪一段：`top` 顶部 / `upper` 上部 / `middle` 中部 / `lower` 下部 / `bottom` 底部 |
| focus[].label | 是 | 这一处的说明，**≤10 字**（拉丁字母算半个），如「自动生成摘要」 |
| focus[].style | 否 | `zoom`（默认）/ `box` / `arrow` |
| videoStart | 否 | 录屏从第几秒开始播，默认 0。截图不用写 |

## 怎么写好
- label 写「用户得到什么」，不写按钮名：写「一键分享给同事」，不写「分享按钮」。
- 圈最重要的一处用 `zoom`。一镜里 `zoom` 最多用 2 次，第 3 处用 `box` 或 `arrow`。
- 顺序从上往下圈（top → bottom），看起来更顺。
- 时长：1 处 2.5–3 秒，2 处 4 秒，3 处 5 秒。给短了会整体加速。

## 例子
```json
{"type": "phone", "dur": 4, "caption": "打开就能看，\n{重点帮你圈好}", "mood": 0.3,
 "params": {"src": "shots/home.png",
   "focus": [
     {"area": "upper", "label": "今日摘要自动写好"},
     {"area": "lower", "label": "待办一键同步", "style": "box"}
   ]}}
```

录屏：
```json
{"type": "phone", "dur": 5, "caption": "{点两下}就能下单", "mood": 0.2,
 "params": {"src": "shots/order.mp4", "videoStart": 2,
   "focus": [{"area": "middle", "label": "选好规格"}, {"area": "bottom", "label": "一键下单", "style": "arrow"}]}}
```
