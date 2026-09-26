quiz 风格的样例分镜（`meta.style: "quiz"`）。每份都能通过 `node scripts/validate.mjs` 并出片；产品、门店、人物和数据都是虚构的，不写任何真实品牌。

| 文件 | 行业 | 模板 | 说明 |
|---|---|---|---|
| `english-im-down.json` | education | 一：一句外语 | 「I'm down = 我很低落？」8 镜约 44 秒；证据用 street 小剧场，迁移剧场换成点奶茶 |
| `software-notes-backlink.json` | software | 二：软件功能竞猜 | 「双链 = 复制一份？」揭晓的答案就是卖点；钩子用 screen 界面示意（`screenItems` 写界面里的笔记标题），证据用 office 小剧场；`brandEnd.button` 是 `meta.cta` 里的关键几个字 |
| `software-archive.json` | software | 二：软件功能竞猜 | 「归档 = 删掉了？」8 镜约 43 秒；钩子 screen 界面带 `screenItems` |
| `software-voice-list.json` | software | 二：软件功能竞猜（`phone` 演示） | 「长按说话 = 只转成文字？」clip 和 quiz 里手指按住、波形跳、列表是「？」，再看一遍时列表逐条出现；clip 台词只说「松手看看」不露结果；评论区写了 `comments` |
| `food-slow-soup.json` | food | 三：餐饮行业竞猜 | 「老火汤 = 大火煮一会儿？」「猜猜这锅汤熬了多久？」7 镜约 40 秒（省掉 replay）；正确项的「6 小时」出自 `meta.facts`，错误选项不写数字 |
