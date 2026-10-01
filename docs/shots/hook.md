# hook 首帧钩子

**最小可用写法**（照抄改字即可通过校验）：
```json
{"type": "hook", "dur": 2.5, "caption": "周报写到半夜，\n{还没写完}",
 "params": {"visual": "icon", "icon": "doc", "text": "又到周五了", "badge": "一键出周报初稿"}}
```

**必须是第 1 镜。** 第 0 帧就是封面：大标题（caption）+ 产品高亮胶囊（badge）+ 一个主视觉，全部在位，不留空帧。

## 什么时候用
每支片子开头都用，且只用一次。时长 2–3 秒。

## 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| caption（镜头字段） | 是 | 封面大标题：用户痛点/反常识问题，≤2 行、每行 ≤12 字，{} 包最扎心的 2–5 个字 |
| visual | 是 | 先按内容选：`bubble` 扎心消息 + 警示卡 / `stat` 大数字圆环（text 必须带数字）/ `icon` 大图标 / `illust` 行业插画 / `phone` 手机真截图；再看构图要不要换：`split` 左右分屏「痛点 vs 产品」/ `statBar` 大数字 + 通栏刻度条 |
| text | 视 visual | bubble：那条消息（≤14）；stat/statBar：带数字的短词（≤6 最好看，放不下会自动缩字号、在 → 或空格处拆两行）；icon/illust：主视觉下一行字；phone：贴纸标签；split：右侧（产品侧）短语（≤10 最好看） |
| sub | 否 | bubble：警示卡标题（如「危险信号」）；stat/statBar：数字说明（≤8）；split：底部一句小结 |
| icon | icon 必填 | 图标名（见图标清单）；split：右侧（产品侧）图标，默认 check |
| illust | illust 必填 | 行业插画 id（`template/src/illust/names.json`），如 `travel/window` |
| orbit | 否 | icon 专用：环绕主图标的 3–6 个小图标，选和产品有关的；**不写就不环绕**，主图标放大、每拍一圈脉冲 |
| pct | 否 | stat/statBar：数值占比 0–100，决定圆环弧长/条形长度；不写就从 text 里的「87%」取，**都没有就不画弧、不填条** |
| leftText | split 用 | 左侧（痛点侧）短语（≤10），如「手动整理」 |
| level | statBar 用 | 条形填充 0–10，会显示「x/10」，要有依据；不写时看 pct |
| badge | 建议 | 产品一句话卖点（≤10），如「AI 先帮你看一眼」；有 meta.logo 时胶囊左侧显示 logo |
| src | phone 必填 | 竖屏截图路径 |
| tone | 否 | 警示色 bad（默认）/ warn / good / accent；split 用来给右侧换色 |
| deco | 否 | 两侧漂浮小图标。**不写就不画**（不再按主题给默认图标）；split 用第 1 个做左侧图标 |

## 圆环和刻度条只表达有含义的数
- stat 的弧长 = `pct`（或 text 里的百分数）。写「6 小时」想表达「一天的四分之一」就写 `"pct": 25`；没有占比就不写，组件只画环、不画弧。
- text 里没有数字（如「推开窗 整片竹林」「手动拆分」）别用 stat：说一处风景/一样东西用 `illust`，说一个功能用 `icon`。组件遇到没数字的 stat 会退成一张大字卡，不套环。
- statBar 同理：没有 `level`、`pct`、百分数时只画刻度槽，不写「8/10」。

## 别总用同一个 visual，也别靠默认装饰
同一批素材（多支不同产品的片子）如果全用 `bubble` 或全用 `stat`，首帧会看着像同一个模板换了个壳。数据/效率类卖点可以在 `stat`（圆环）和 `statBar`（通栏条）之间换着用；「以前 vs 现在」类可以试试 `split`；行业片说的是一样东西/一处场景时用 `illust`。环绕小图标和两侧漂浮图标只画你写了的（`orbit` / `deco`），和产品无关的默认装饰已经去掉。

## 好例子
```json
{"type": "hook", "dur": 2.5, "caption": "对象说{“你不懂我”}，\n你怎么回？", "mood": 0.85,
 "params": {"visual": "bubble", "text": "你根本就不懂我", "sub": "危险信号", "badge": "AI 先帮你看一眼"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "写周报要{一小时}？", "mood": 0.8,
 "params": {"visual": "stat", "text": "60 分钟", "sub": "每周花在周报上", "badge": "AI 三分钟写完"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "推开窗，\n是{一整片山}", "mood": 0.3,
 "params": {"visual": "illust", "illust": "travel/window", "text": "住一晚含双早", "tone": "good", "badge": "山里住一晚"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "还在{手动}整理周报？", "mood": 0.7,
 "params": {"visual": "split", "leftText": "手动整理", "text": "自动生成", "badge": "AI 三分钟写完"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "周会开了一小时，\n{待办}没人记", "mood": 0.7,
 "params": {"visual": "icon", "icon": "doc", "orbit": ["clock", "users", "check"], "text": "谁来跟进这件事？", "badge": "边开会边记待办"}}
```

## 坏例子
- caption 写产品名（「XX 助手上线了」）：没有钩子。
- visual 用 phone 但截图只是首页、没有冲突感。
- `visual: "stat"` 配一句没有数字的话（「手动拆分」）：环里的字没有数，环也没有含义。
- 一批片子里每支都用同一个 visual：首帧全长一个样，没有区分度。
