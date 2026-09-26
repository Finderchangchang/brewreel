# hook 首帧钩子

**必须是第 1 镜。** 第 0 帧就是封面：大标题（caption）+ 产品高亮胶囊（badge）+ 一个主视觉，全部在位，不留空帧。

## 什么时候用
每支片子开头都用，且只用一次。时长 2–3 秒。

## 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| caption（镜头字段） | 是 | 封面大标题：用户痛点/反常识问题，≤2 行、每行 ≤12 字，{} 包最扎心的 2–5 个字 |
| visual | 是 | 先按内容选：`bubble` 扎心消息 + 警示卡 / `stat` 大数字圆环 / `icon` 大图标 + 环绕小图标 / `phone` 手机真截图；再看构图要不要换：`split` 左右分屏「痛点 vs 产品」/ `statBar` 大数字 + 通栏刻度条 |
| text | 视 visual | bubble：那条消息（≤14）；stat/statBar：数字或短词（≤6 最好看）；icon：图标下一行字；phone：贴纸标签；split：右侧（产品侧）短语（≤10 最好看） |
| sub | 否 | bubble：警示卡标题（如「危险信号」）；stat/statBar：数字说明（≤8）；split：底部一句小结 |
| icon | icon 必填 | 图标名（见图标清单）；split：右侧（产品侧）图标，默认 check |
| leftText | split 用 | 左侧（痛点侧）短语（≤10），如「手动整理」 |
| level | statBar 用 | 条形填充比例 0–10，默认 8 |
| badge | 建议 | 产品一句话卖点（≤10），如「AI 先帮你看一眼」；有 meta.logo 时胶囊左侧显示 logo |
| src | phone 必填 | 竖屏截图路径 |
| tone | 否 | 警示色 bad（默认）/ warn / good / accent；split 用来给右侧换色 |
| deco | 否 | 两侧漂浮小图标；split 用第 1 个做左侧图标 |

## 别总用同一个 visual
同一批素材（多支不同产品的片子）如果全用 `bubble` 或全用 `stat`，首帧会看着像同一个模板换了个壳。数据/效率类卖点可以在 `stat`（圆环）和 `statBar`（通栏条）之间换着用；「以前 vs 现在」类可以试试 `split`。

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
{"type": "hook", "dur": 2.5, "caption": "还在{手动}整理周报？", "mood": 0.7,
 "params": {"visual": "split", "leftText": "手动整理", "text": "自动生成", "badge": "AI 三分钟写完"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "麻烦程度{降了 8 成}", "mood": 0.6,
 "params": {"visual": "statBar", "text": "省下 80%", "sub": "整理周报的时间", "level": 9, "badge": "AI 三分钟写完"}}
```

## 坏例子
- caption 写产品名（「XX 助手上线了」）：没有钩子。
- visual 用 phone 但截图只是首页、没有冲突感。
- 一批片子里每支都用同一个 visual：首帧全长一个样，没有区分度。
