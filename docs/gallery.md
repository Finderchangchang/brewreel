# 截图

[← 返回 README](../README.md) · [English](gallery.en.md)


下面都是实际渲染的画面。分镜都在仓库里，产品和数据都是虚构的；[演示视频](https://github.com/Finderchangchang/brewreel/releases/download/v0.3.0/demo-5MB.mp4)（v0.3.0 附件，约 5 MB）是三种配方的实际渲染效果。

**三种配方**

<table align="center">
<tr><td align="center"><img src="images/style-cards.png" width="760" alt="cards 卡片信息流" /><br/><sub><b>cards 卡片信息流</b>（默认，9:16）：渐变底 + 居中白卡片 + 描边大字幕，一镜讲一件事</sub></td></tr>
<tr><td align="center"><img src="images/style-quiz.png" width="760" alt="quiz 答题互动" /><br/><sub><b>quiz 答题互动</b>（9:16）：红笔圈出一个常见误解 → 出一道选择题 → 揭晓 → 词条卡讲清楚</sub></td></tr>
<tr><td align="center"><img src="images/style-journey.png" width="760" alt="journey 角色漫游" /><br/><sub><b>journey 角色漫游</b>（4:5 / 9:16）：原创吉祥物一镜到底横穿剪纸城市，每站一张明信片讲一个类别</sub></td></tr>
</table>

**六个行业**（每张图左边是第 0 帧封面，右边是片中一帧）

<table align="center">
<tr>
<td align="center"><img src="images/ledger.png" width="260" alt="软件：记账工具" /><br/><sub>软件 · 记账工具（ledger）</sub></td>
<td align="center"><img src="images/food.png" width="260" alt="餐饮：单品上新" /><br/><sub>餐饮 · 单品上新（food）</sub></td>
<td align="center"><img src="images/ecommerce.png" width="260" alt="电商：实物商品" /><br/><sub>电商 · 实物商品（ecommerce）</sub></td>
</tr>
<tr>
<td align="center"><img src="images/education.png" width="260" alt="教培：成人职业课程" /><br/><sub>教培 · 成人职业课程（education）</sub></td>
<td align="center"><img src="images/beauty.png" width="260" alt="美业：无实拍照片" /><br/><sub>美业 · 无实拍照片（beauty）</sub></td>
<td align="center"><img src="images/travel.png" width="260" alt="文旅：住宿" /><br/><sub>文旅 · 住宿（travel）</sub></td>
</tr>
</table>

<details>
<summary>更多样例：情感聊天 App、会议纪要、英文字幕</summary>

<table align="center">
<tr>
<td align="center"><img src="images/jev.png" width="260" alt="软件：情感聊天" /><br/><sub>软件 · 情感聊天（jev）</sub></td>
<td align="center"><img src="images/meeting.png" width="260" alt="软件：会议纪要" /><br/><sub>软件 · 会议纪要（meeting）</sub></td>
<td align="center"><img src="images/en-focus.png" width="260" alt="英文字幕" /><br/><sub>英文字幕（en-focus）</sub></td>
</tr>
</table>

</details>

这 9 份分镜在 `examples/`（都是 cards 配方），quiz 和 journey 的样例在 `styles/quiz/examples/`、`styles/journey/examples/`。每份都能直接通过校验并用 `make.mjs` 出片。
