# factSheet 参数表 / 清单 / 大纲 / 考试信息 / 色卡

五种排版共用一张卡，逐行点亮，主角是「信息被一条条证实」的过程，不是一次性摆满：
- `spec`：规格参数表（key: value），画表格线
- `box`：开箱或包装清单，圆角方块卡片 + 数量「×N」+ 赠品「赠」角标
- `syllabus`：课程大纲，章节号 + 章节名 + 节数
- `exam`：考试信息，同 spec 的表格，底部必须写来源（没有来源不允许渲染）
- `swatch`：色卡，色块依次弹出，可选高亮一个主推色

## 什么时候用
- 有一屏能写清楚的硬信息：材质规格、开箱清单、课程章节、考试安排、色号。
- 想替代「一句话吹一个功能」时，用表格/清单把可核实的事实摆出来更可信。

## 什么时候别用
- 信息只有 1 条：用 counter 或更轻的镜头，不必上整张表。
- exam 布局但写不出真实 `source`：不要编一个来源，没有就别用这个布局。

## 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| layout | 是 | — | spec / box / syllabus / exam / swatch |
| title | 是 | 12 字 | 卡片标题 |
| rows | 是 | 2–6 行 | 见下 |
| rows[].key | 是 | 6 字 | spec/exam：参数名；box：项目名；syllabus：备用（建议填 `name`）；swatch：色名 |
| rows[].value | 是 | 10 字 | spec/exam：参数值；box：备注；swatch 布局当前不显示这一项，但字段仍要填 |
| rows[].qty | 否 | 整数 | box 布局：数量，显示成「×N」 |
| rows[].isGift | 否 | true/false | box 布局：为 true 时加「赠」角标 |
| rows[].no | 否 | 4 字 | syllabus 布局：章节号 |
| rows[].name | 否 | 12 字 | syllabus 布局：章节名（不填就退回显示 `key`） |
| rows[].lessons | 否 | 整数 | syllabus 布局：本章节数 |
| rows[].hex | 否 | #RRGGBB | swatch 布局：色值，格式不对会显示成占位灰块 |
| facts | 否 | 0–4 条 | 底部事实条 |
| facts[].label | 是 | 4 字 | 如「总课时」 |
| facts[].value | 是 | 8 字 | 如「36节」；不能出现「终身」「永久」 |
| source | exam 必填 | 24 字 | 如「来源：XX官网 2026-09」 |
| notice | 否 | 20 字 | swatch 布局按行业要求固定写法，如「屏幕有色差，以到店色板为准」 |
| image | 否 | 素材 png/jpg/jpeg/webp | 左侧缩略图（接口预留，当前实现未渲染） |
| highlight | 否 | 从 0 数 | swatch 布局：主推色在 `rows` 里的序号 |

## 时长
3–8 秒，默认 4 秒；syllabus、exam 行数多时建议给到 5–8 秒，太短逐行点亮会被压得很快，读不清。

## 好例子
```json
{"type": "factSheet", "dur": 4, "mood": 0.1,
 "params": {"layout": "spec", "title": "规格参数",
   "rows": [{"key": "材质", "value": "304不锈钢"}, {"key": "容量", "value": "500ml"}, {"key": "重量", "value": "320g"}]}}
```
```json
{"type": "factSheet", "dur": 6, "mood": 0.1,
 "params": {"layout": "syllabus", "title": "课程大纲",
   "rows": [{"no": "1", "name": "基础语法", "lessons": 6}, {"no": "2", "name": "实战项目", "lessons": 10}],
   "facts": [{"label": "总课时", "value": "16节"}]}}
```

## 坏例子
- exam 布局不填 `source` → 不允许渲染，不要编一个「网络」当来源。
- facts 里写「终身有效」「永久使用」→ 会被拦。
- swatch 布局 `hex` 不是 6 位十六进制（如漏写、写成颜色名）→ 显示成占位灰块，等于没给色值。
