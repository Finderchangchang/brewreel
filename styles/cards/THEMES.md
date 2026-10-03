# 主题

`meta.theme` 从下面 18 套里选。前 6 套是默认的老主题，后 12 套是可选的新配色。新配色来自 @opc8838-hub 的 PR #2。

不写 `meta.theme` 时校验示例用 `warm-emotion`。`meta.brandColor` 只换强调色，不换整套配色。

## 默认 6 套

这 6 套没有 `captionStyle`，字幕仍是白字加粗描边。除 `warm-emotion` 外都带 `chartColors`。`onHot` 是强调色小标签上的字色，和原来画面上的深色字相同。

| id | 名字 |
|---|---|
| `warm-emotion` | 情绪渐变（Jev 同款）：平静蓝绿 → 留神橙 → 危险暖红，白卡片 |
| `tech-dark` | 科技暗色：深蓝紫底，青色强调，玻璃深色卡片 |
| `fresh-light` | 清新亮色：薄荷 → 天蓝 → 橘黄，白卡片，适合生活/效率工具 |
| `business-blue` | 商务蓝：沉稳蓝 → 靛紫 → 警示红，白卡片，适合 B 端/SaaS |
| `festival-red` | 节日红金：正红底 + 金色强调，奶白卡片，适合节日/促销 |
| `mono-premium` | 高级灰金：石墨黑底 + 香槟金强调，深色卡片，适合高客单/质感产品 |

## 可选 12 套

这 12 套写了 `captionStyle: "clean"`（字幕不描边，重点词和普通字颜色不同）和 `ambient.pattern: "none"`（下三分之一不再铺图案）。没写这些字段的主题走原来的描边字幕和氛围图案。强调色当底的小标签（价目卡「活动价」、步骤编号、门店按钮、实拍角标等）按主题的 `onHot` 上字，不写死黑字。

| id | 名字 |
|---|---|
| `studio-cream-blue` | 奶油 · 蓝橙：背景、卡片、文字与重点色分工搭配 |
| `studio-neon` | 黑底 · 荧光绿粉：背景、卡片、文字与重点色分工搭配 |
| `studio-pink-green` | 浅粉 · 墨绿：背景、卡片、文字与重点色分工搭配 |
| `studio-blue-orange` | 钴蓝 · 奶油橙：背景、卡片、文字与重点色分工搭配 |
| `studio-red-black` | 白灰 · 红黑：背景、卡片、文字与重点色分工搭配 |
| `studio-purple-yellow` | 深紫 · 淡黄：背景、卡片、文字与重点色分工搭配 |
| `studio-cyan` | 湖蓝 · 黑白：主色、黑白与对比色统一搭配 |
| `studio-lime-purple` | 青柠 · 葡萄紫：主色、黑白与对比色统一搭配 |
| `studio-indigo` | 靛蓝 · 珊瑚：主色、黑白与对比色统一搭配 |
| `studio-graphite` | 石墨 · 电橘：主色、黑白与对比色统一搭配 |
| `coral-pop` | 珊瑚桃红：白色标题、白卡与明亮数据强调色 |
| `mint-pop` | 鲜薄荷：白色标题、白卡与明亮数据强调色 |

## 图表色

不写 `palette` 时，有 `chartColors` 的主题用自己的系列色。没带图表色的主题（包括 `warm-emotion`）按卡片底色选一套和底对比至少 3:1 的系列色。显式写 `palette` 仍用 micro / mono / porcelain / palm / wire。
