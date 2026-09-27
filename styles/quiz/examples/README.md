quiz 风格的样例分镜（`meta.style: "quiz"`）。每份都能通过 `node scripts/validate.mjs` 并出片；产品、门店、人物和数据都是虚构的，不写任何真实品牌。

| 文件 | 行业 | 配色 / 口吻 | 模板 | 说明 |
|---|---|---|---|---|
| `english-im-down.json` | education | `ash-teal` / `exam` | 一：一句外语 | 「I'm down = 我很低落？」8 镜约 44 秒；证据用 street 小剧场，迁移剧场换成点奶茶；回放和评论区的句子全走考场腔默认句 |
| `software-notes-backlink.json` | software | 默认 `sage-pine` / `show` | 二：软件功能竞猜 | 「双链 = 复制一份？」揭晓的答案就是卖点；钩子用 screen 界面示意，证据用 office 小剧场；`brandEnd.button` 是 `meta.cta` 里的关键几个字 |
| `software-archive.json` | software | 默认 `sage-pine` / `show` | 二：软件功能竞猜 | 「归档 = 删掉了？」8 镜约 43 秒；钩子 screen 界面带 `screenItems`；印章字自己写「找到了」 |
| `software-voice-list.json` | software | 默认 `sage-pine` / `show` | 二：软件功能竞猜（`phone` 演示） | 「长按说话 = 只转成文字？」clip 和 quiz 里手指按住、波形跳、列表是「？」，回放时列表逐条出现；题号签自己写「功能竞猜」；评论区写了 `comments` |
| `food-slow-soup.json` | food | 默认 `rice-soy` / `chat` | 三：餐饮行业竞猜 | 「老火汤 = 大火煮一会儿？」7 镜约 40 秒（省掉 replay）；正确项的「6 小时」出自 `meta.facts`，错误选项不写数字 |
| `software-archive-voice.json` | software | 默认 `sage-pine` / `show` | 二：软件功能竞猜 + 配音 | 在 `software-archive.json` 上加配音：除 replay 外每镜一句 `vo`，quiz 镜头的旁白只念题和选项、不说答案，揭晓放到 meaningCard；旁白字幕显示在主体区下沿的字幕条上（`meta.voice.provider` 写的是 `minimax`，出片要环境变量 `MINIMAX_API_KEY`；**没有 key 时用 `--voice-provider mock` 或把 provider 改成 `mock` 预览**，占位音只看节奏，不能交付） |
