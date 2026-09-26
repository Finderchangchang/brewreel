# 镜头目录（shots.md）

> 由 `node scripts/build_docs.mjs` 从 `docs/shots/*.md` + `template/src/shots/*.spec.json` 生成，别手改。字数上限、可选值以每节末尾的「参数速查」为准（校验读的就是它）。

## 一览

| 镜头 | 干什么 | 时长（秒） | 字幕 |
|---|---|---|---|
| [hook](#hook) | 第 0 帧的封面钩子：大标题（caption）+ 一句产品高亮胶囊 + 一个主视觉，第 0 帧就完整、不留空帧 | 1.5–4（默认 2.5） | 必填 |
| [chat](#chat) | 模拟聊天窗：消息逐条弹出，可在输入框打字，产品悬浮球弹出分析面板（结论 + 标签 + 候选回复），点第 1 条候选「填入」飞进输入框 | 3–12（默认 6） | 可选 |
| [phone](#phone) | 手机框里放产品真截图或录屏，按拍依次圈注 1–3 处关键区域（放大镜 / 高亮框 / 箭头 + 短标签），说清「看这里」 | 2.5–8（默认 4） | 可选 |
| [mockApp](#mockapp) | 没有截图时的模拟产品界面（中性样式、会动）：dashboard 数据面板 / list 列表 / editor 生成文档 / form 填表提交 | 2.5–8（默认 4） | 可选 |
| [photoShot](#photoshot) | 实拍照片或短视频：放商家实拍的菜品/商品/作品/房间/公区/后厨片段，叠上菜名、价签、卖点 | 1.2–12（默认 2.5） | 可选 |
| [meter](#meter) | 仪表 / 评分：指针从起点弹簧摆到目标值，落定那一拍数字弹一下 + 重音 + 判词胶囊弹出，下一拍浮出一句结论 | 2–6（默认 3） | 可选 |
| [compare](#compare) | 对比：左右两栏（lr）或前后滑杆揭晓（beforeAfter） | 2.5–7（默认 4） | 可选 |
| [beforeAfter](#beforeafter) | 前后对比滑块：美发/美甲/美睫专用，同一位顾客做之前和做完的对比，擦除滑杆切换 | 2–4（默认 3） | 可选 |
| [counter](#counter) | 大数字滚动：数字从 from 滚到 to（嗒嗒声 + 进度条同步走），落定那一拍弹一下 + 放射光线 + 叮，下面写这个数字的含义和口径 | 2–5（默认 3） | 可选 |
| [priceCard](#pricecard) | 价格卡/价目表：把明码标价的排版规则做进组件里，模型只填数字和条件 | 2–4.5（默认 3） | 可选 |
| [storeCard](#storecard) | 门店、位置和到店指引：讲清楚店在哪、几点开门、怎么过来，以及平台内怎么操作 | 2.5–4（默认 3） | 可选 |
| [reviewCard](#reviewcard) | 引用真实顾客评价：只能摘原文，可以删减，不能改写得更夸张 | 2–4.5（默认 3） | 可选 |
| [factSheet](#factsheet) | 参数表/开箱清单/课程大纲/考试信息/色卡：把可核实的事实一屏写清 | 3–8（默认 4） | 可选 |
| [credCard](#credcard) | 人或荣誉的资历卡：只放能证明的资历/荣誉，用来替代「名师」「金牌」这类说法 | 1.5–6（默认 3） | 可选 |
| [features](#features) | 卖点卡：2–4 张带图标的卖点卡按拍依次弹入，黄色聚光框跟着「当前讲到的那张」移动 | 2.5–7（默认 4） | 可选 |
| [steps](#steps) | 1-2-3 流程：一张流程卡，左边节点竖排、连线上的光点一步步跑下去，每到一步节点点亮、文字滑入，全部走完每个节点打 ✓ | 2.5–7（默认 4） | 可选 |
| [quickList](#quicklist) | 快切列表：3–6 行白卡按拍左右交替飞入，每行右边「盖章」出判定：分数滚动落定（可带判词），或一个彩色标签砸下来；左边色条按语气色长满 | 2–6（默认 3） | 可选 |
| [endCard](#endcard) | 片尾：logo/品牌图标 + 产品名 + 一句大字口号 + 1–3 个卖点胶囊 + 可选行动号召 | 3–6（默认 4） | 不能写 |

**常规结构**：hook（0–3 秒）→ 痛点/场景（chat / quickList / compare / meter）→ 产品出场（phone / mockApp / photoShot）→ 卖点/演示（features / counter / meter / steps）→ endCard。

**行业镜头**（`meta.industry` 决定哪些能用，见各 `industries/<id>/rules.json` 的 `enabledShots`）：photoShot（实拍/示意图）、priceCard（价目表）、storeCard（门店/地图/预订）、reviewCard（真实评价）、factSheet（参数表/大纲/色卡）、credCard（资历/荣誉）、beforeAfter（前后对比，仅美业）。

**主题**：`warm-emotion` `tech-dark` `fresh-light` `business-blue` `festival-red` `mono-premium`

**图标**（所有 icon 字段只能从这里选）：`check` `clock` `chart` `chat` `lock` `bolt` `star` `doc` `send` `image` `phone` `user` `users` `search` `shield` `gift` `heart` `money` `calendar` `bell` `cloud` `code` `sparkle` `arrow` `alert` `x` `trend` `eye`

**字数怎么数**：汉字、全角标点算 1 个字，拉丁字母、数字、半角空格算半个。字幕 `caption` 最多 2 行、每行 ≤12 字，`{}` 强调最多 1 处，用 `\n` 换行。

---

<a id="hook"></a>
## hook 首帧钩子

**必须是第 1 镜。** 第 0 帧就是封面：大标题（caption）+ 产品高亮胶囊（badge）+ 一个主视觉，全部在位，不留空帧。

### 什么时候用
每支片子开头都用，且只用一次。时长 2–3 秒。

### 参数
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

### 别总用同一个 visual
同一批素材（多支不同产品的片子）如果全用 `bubble` 或全用 `stat`，首帧会看着像同一个模板换了个壳。数据/效率类卖点可以在 `stat`（圆环）和 `statBar`（通栏条）之间换着用；「以前 vs 现在」类可以试试 `split`。

### 好例子
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

### 坏例子
- caption 写产品名（「XX 助手上线了」）：没有钩子。
- visual 用 phone 但截图只是首页、没有冲突感。
- 一批片子里每支都用同一个 visual：首帧全长一个样，没有区分度。

### 参数速查（自动生成自 hook.spec.json）

时长 1.5–4 秒（默认 2.5）；字幕 必填；默认情绪 0.85；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `visual` | 是 | bubble / stat / icon / phone / split / statBar |  | 主视觉类型/构图 |
| `text` |  | 文字 | ≤14 字 | bubble：那条扎心消息；stat/statBar：大数字或短词（如「3 秒」「87%」，≤6 字最好看）；icon：大图标下的一行字；phone：贴在手机上的标签（可不填）；split：右侧（产品侧）短语（≤10 字最好看） |
| `sub` |  | 文字 | ≤8 字 | bubble：警示卡标题（如「危险信号」）；stat/statBar：数字下面的说明；split：底部一句小结（可不填）；icon：不用 |
| `icon` |  | 文字 | 图标名 | bubble：警示卡图标（默认 alert）；icon：主图标（必填）；split：右侧（产品侧）图标（默认 check） |
| `badge` |  | 文字 | ≤10 字 | 标题下方的高亮胶囊：产品一句话卖点 |
| `src` |  | 文字 | 素材 png/jpg/jpeg/webp | phone 必填：竖屏截图路径（相对 storyboard.json） |
| `tone` |  | bad / warn / good / accent |  | 警示色：bad 红（默认）/ warn 橙 / good 绿 / accent 品牌色；split 用来给右侧（产品侧）换色，默认品牌色 |
| `deco` |  | 数组 | 0–3 项 | 两侧漂浮的小图标（bubble 用 3 个、stat/statBar 用 2 个，split 用第 1 个做左侧图标），不写就按主题取（business-blue = chart/clock/doc，warm-emotion = chat/heart/bell…）；选和产品有关的图标 |
| `head` |  | 文字 | ≤10 字 | bubble：消息卡顶部那行小字，默认「新消息 · 刚刚」；写成 "" 就不显示。B 端可写「群消息 · 刚刚」「工单 · 刚刚」 |
| `leftText` |  | 文字 | ≤10 字 | split 专用：左侧（痛点侧）短语，如「手动整理」 |
| `level` |  | 数字 | 0–10 | statBar 专用：条形填充比例 0–10，默认 8（越高越满） |

示例（能直接通过校验）：

```json
{"type": "hook", "dur": 2.5, "caption": "对象说{“你不懂我”}，\n你怎么回？", "mood": 0.85, "params": {"visual": "bubble", "text": "你根本就不懂我", "sub": "危险信号", "badge": "AI 先帮你看一眼"}}
```

---

<a id="chat"></a>
## chat 模拟聊天

中性配色的聊天窗（我方 = 主题强调色，对方 = 浅灰，不像任何具体 IM）。消息逐拍弹出 → 可选「我」在输入框打字 → 可选产品悬浮球变色弹出分析面板（结论 + 标签 + 候选）→ 点第 1 条候选「填入」飞进输入框。

### 什么时候用
社交、客服、销售话术、AI 助手、协作工具等「在对话里用产品」的场景；也可只放消息，演痛点。

### 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| peer | 否 | 顶栏称呼（≤6），默认「对方」。别写真实账号名 |
| messages | 是 | 1–4 条 `{from: "me"/"peer", text ≤18}`，最关键的放最后 |
| typing | 否 | 没有 panel 时「我」在输入框里打的字（≤16），打字机 + 敲键音。有 panel 时别写（面板会把第 1 条回复填进输入框）；非要写就和 replies[0] 一字不差，否则校验报错 |
| panel.title | 有 panel 时 | 面板标题（≤8），如「AI 分析」 |
| panel.icon | 否 | 悬浮球图标，默认 sparkle |
| panel.verdict | 否 | 面板大字结论（≤12） |
| panel.tone | 否 | 结论颜色：bad / warn（默认）/ good / accent |
| panel.tags | 否 | ≤3 个小标签，每个 ≤6 |
| panel.replies | 否 | ≤3 条候选（每条 ≤16），第 1 条被点「填入」。这是产品建议**「我」**发给对方的话，站在 me 的立场写。反例：我说要加班，建议回复写成「别再加班了，陪我」——这是对方的口吻，产品演示成了错误示范 |

### 时长怎么给
只有消息：3–4 秒；消息 + 面板：6 秒；消息 + 打字 + 面板 + 3 条候选：8–10 秒。给短了会整体加速（不会出错，但会赶）。

### 好例子
```json
{"type": "chat", "dur": 9, "caption": "先别急着发，\n对方要的是{你的在乎}", "mood": 0.95,
 "params": {"peer": "对象",
   "messages": [{"from": "me", "text": "这周末我约了朋友打球"}, {"from": "peer", "text": "上周末你也不在"}, {"from": "peer", "text": "你根本就不懂我"}],
   
   "panel": {"title": "AI 分析", "verdict": "对方想确认你在不在乎", "tone": "bad", "tags": ["要你的在乎", "先接住情绪"],
             "replies": ["是我没顾上你的感受", "对不起，刚才语气不好", "那你说说哪里不懂你"]}}}
```

### 时长怎么给
内容本身约 7 秒（3 条消息 + 打字 + 面板 + 3 条候选）。给得更长时，多出来的时间自动分给「面板弹出后读结论」（约 55%）和「点填入之前」（约 30%），结尾只留一小段停顿；不会在结尾干停。情感类片子建议 9–10 秒。

### 参数速查（自动生成自 chat.spec.json）

时长 3–12 秒（默认 6）；字幕 可选；默认情绪 0.6；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `peer` |  | 文字 | ≤6 字 | 聊天窗顶栏的对方称呼，默认「对方」（不要写真实账号名） |
| `messages` | 是 | 数组 | 1–4 项 | 消息，按顺序每拍弹出一条 |
| `messages[].from` | 是 | me / peer |  | me = 我（右侧强调色气泡）；peer = 对方（左侧浅灰气泡） |
| `messages[].text` | 是 | 文字 | ≤18 字 | 消息内容 |
| `typing` |  | 文字 | ≤16 字 | 没有 panel 时，「我」在输入框里打的字（打字机 + 敲键音）；有 panel 时不写，或和 replies[0] 一字不差 |
| `panel` |  | 对象 |  | 产品面板：从右上角产品悬浮球弹出 |
| `panel.title` | 是 | 文字 | ≤8 字 | 面板标题，如「AI 分析」「智能助手」 |
| `panel.icon` |  | 文字 | 图标名 | 悬浮球和面板标题的图标，默认 sparkle |
| `panel.verdict` |  | 文字 | ≤12 字 | 面板大字结论，如「对方想确认你在不在乎」 |
| `panel.tone` |  | good / warn / bad / accent |  | 结论的颜色：bad 红 / warn 橙（默认）/ good 绿 / accent 品牌色 |
| `panel.tags` |  | 数组 | 0–3 项 | 结论下的小标签 |
| `panel.replies` |  | 数组 | 0–3 项 | 候选回复：产品建议「我」发给对方的话，站在 me 的立场写（不能是对方的口吻）；第 1 条会被点「填入」飞进输入框 |

示例（能直接通过校验）：

```json
{"type": "chat", "dur": 9, "caption": ["先别急着发，\n对方要的是{你的在乎}", "挑一条填进输入框，\n发不发{你决定}"], "mood": 0.9, "params": {"peer": "对象", "messages": [{"from": "me", "text": "这周末我约了朋友打球"}, {"from": "peer", "text": "上周末你也不在"}, {"from": "peer", "text": "你根本就不懂我"}], "panel": {"title": "AI 分析", "icon": "sparkle", "verdict": "对方想确认你在不在乎", "tone": "bad", "tags": ["要你的在乎", "先接住情绪"], "replies": ["是我没顾上你的感受", "对不起，刚才语气不好", "那你说说哪里不懂你"]}}}
```

---

<a id="phone"></a>
## phone 手机截图 + 圈注

手机框居中，里面放用户给的真截图或录屏。按拍依次圈出 1–3 处，每处配一句短说明。截图只在手机里，不会整屏放大、不会来回晃。

三种圈注样式：
- `zoom` 放大镜（默认）：那一段从手机里弹出成大卡片，看得清细节；下一处出现时缩回去，原位留编号框
- `box` 高亮框：给那一段描边、编号，旁边贴标签
- `arrow` 箭头：手机外侧一个大箭头指向那一段，旁边贴标签

当前圈中的那一段是亮的，其余部分压暗。

### 什么时候用
- 手上有产品的**真截图 / 录屏**，想说「看这里有这个功能」。这比 mockApp 更可信。
- 一镜讲 1–3 个看得见的功能点。

### 什么时候别用
- 没有截图：改用 mockApp。
- 只想放一张图、不圈重点：别用。没有圈注就没有信息增量，这是 v1 被批评「只是图片来回动」的原因。
- 截图里有网址、二维码、账号名、手机号、真实人名、第三方 App 的 logo：先打码或换图。

### 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| src | 是 | 截图或录屏路径，相对 storyboard.json 所在目录。支持 png / jpg / jpeg / webp / mp4。竖屏手机截屏最好（如 1080×2340） |
| focus | 是 | 1–3 处圈注，每 2 拍（1 秒）出现一处 |
| focus[].area | 是 | 圈截图从上到下平均分成 5 段里的哪一段：`top` 顶部 / `upper` 上部 / `middle` 中部 / `lower` 下部 / `bottom` 底部 |
| focus[].label | 是 | 这一处的说明，**≤10 字**（拉丁字母算半个），如「自动生成摘要」 |
| focus[].style | 否 | `zoom`（默认）/ `box` / `arrow` |
| videoStart | 否 | 录屏从第几秒开始播，默认 0。截图不用写 |

### 怎么写好
- label 写「用户得到什么」，不写按钮名：写「一键分享给同事」，不写「分享按钮」。
- 圈最重要的一处用 `zoom`。一镜里 `zoom` 最多用 2 次，第 3 处用 `box` 或 `arrow`。
- 顺序从上往下圈（top → bottom），看起来更顺。
- 时长：1 处 2.5–3 秒，2 处 4 秒，3 处 5 秒。给短了会整体加速。

### 例子
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

### 参数速查（自动生成自 phone.spec.json）

时长 2.5–8 秒（默认 4）；字幕 可选；默认情绪 0.3；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `src` | 是 | 文字 | 素材 png/jpg/jpeg/webp/mp4 | 竖屏截图或录屏路径（相对 storyboard.json 所在目录），如 shots/home.png |
| `focus` | 是 | 数组 | 1–3 项 | 圈注 1–3 处，按先后每 2 拍出现一处 |
| `focus[].area` | 是 | top / upper / middle / lower / bottom |  | 圈截图从上到下五等分里的哪一段 |
| `focus[].label` | 是 | 文字 | ≤10 字 | 这一处的说明，≤10 字，如「自动生成摘要」 |
| `focus[].style` |  | zoom / box / arrow |  | zoom 放大镜（默认）/ box 高亮框 / arrow 箭头 |
| `videoStart` |  | 数字 | 0–600 | 录屏从第几秒开始播（默认 0）；截图不用写 |

示例（能直接通过校验）：

```json
{"type": "phone", "dur": 4, "caption": "一眼看懂{重点在哪}", "mood": 0.3, "params": {"src": "sample-screen.png", "focus": [{"area": "upper", "label": "自动生成摘要", "style": "zoom"}, {"area": "middle", "label": "待办一键同步", "style": "box"}, {"area": "bottom", "label": "一键分享", "style": "arrow"}]}}
```

---

<a id="mockapp"></a>
## mockApp 模拟产品界面

没有截图时用它：画一个中性配色、看起来像真产品的 App 界面，并让它「动起来演一遍」。全部由参数决定，不用画图。

四种界面（`kind`）：
| kind | 画面里发生什么 | 适合讲 |
|---|---|---|
| dashboard | 大数字从 0 滚上去 → 折线/柱子长出来 → 指标一行行出现 → 点中高亮的一行 | 数据、统计、监控、报表 |
| list | （可选）搜索框打字 → 条目一行行出现，带状态标签 → 点中高亮的一行 | 订单、任务、客户、消息管理 |
| editor | （可选）输入框打出一句需求 → 点「生成」→ 文字一行行写出来 → 高亮一行 → 弹「已生成」 | AI 写作、自动生成、笔记 |
| form | 表单逐项自动填好（打勾）→ 点提交 → 按钮变绿成功 | 预约、下单、报名、登记 |

### 什么时候用
- 产品还没截图，或截图太乱、有隐私信息。
- 想演示「操作过程」而不只是结果。

### 什么时候别用
- 有好看的真截图：用 phone，更可信。
- 要讲聊天对话：用 chat。
- 只想亮一个大数字：用 counter。

### 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| kind | 是 | `dashboard` / `list` / `editor` / `form` |
| title | 是 | 顶栏页面名，**≤10 字**，如「今日概览」。写自己产品里的页面名，不写第三方 App 名 |
| items | 看 kind | 0–5 行，每行 `{icon?, text, value?, tone?}`，见下表 |
| items[].text | 是 | **≤10 字** |
| items[].value | 否 | **≤6 字**（数字、拉丁字母算半个） |
| items[].tone | 否 | value 的颜色：`good` 绿 / `warn` 橙 / `bad` 红 / `neutral` 灰 |
| items[].icon | 否 | 行首图标，从图标清单选（如 trend clock alert money user doc calendar users check） |
| highlight | 否 | 被点中高亮的行号，**从 0 数**，0–4 |
| stat | dashboard 建议写 | `{value ≤6, label ≤8}`，如 `{"value": "1,286", "label": "今日新增订单"}`，数字部分会滚动 |
| series | 否 | dashboard 图表数据，2–12 个数，5–8 个最好看 |
| chart | 否 | dashboard 图表：`line` 折线（默认）/ `bar` 柱状 |
| input | 否 | **≤12 字**。editor：输入框里的需求；list：搜索框里的词 |
| button | 否 | **≤4 字**，主按钮，如「生成」「提交」「新建」 |
| done | 否 | **≤6 字**，editor/form 完成后的提示，如「已生成」「预约成功」 |

各 kind 的 items 怎么写：
- dashboard：2–3 行指标，text 写指标名，value 写数值（只显示前 3 行）。highlight 点中要强调的那一行（如异常）。
- list：3–5 行，text 写条目名，value 写状态标签（**≤4 字最好看**，如「待处理」「已发货」）。
- editor：3–5 行，是「生成出来的文字」，第 1 行会当标题加粗。highlight 让某一行被荧光笔划出来。
- form：2–5 项，text 写字段名，value 写填进去的内容。

### 时长
dashboard 3.5–4 秒；list 3.5–4 秒；editor 4.5–5 秒（有 input 时）；form 3–4 秒。给短了会整体加速。

### 例子
```json
{"type": "mockApp", "dur": 4, "caption": "数据一目了然，\n{异常自动标红}", "mood": 0.3,
 "params": {"kind": "dashboard", "title": "今日概览",
   "stat": {"value": "1,286", "label": "今日新增订单"}, "series": [32, 41, 38, 52, 49, 63, 78],
   "items": [{"icon": "trend", "text": "转化率", "value": "+12%", "tone": "good"},
             {"icon": "alert", "text": "待处理投诉", "value": "2 条", "tone": "bad"}],
   "highlight": 1}}
```
```json
{"type": "mockApp", "dur": 5, "caption": "一句话需求，\n{文案直接出来}", "mood": 0.1,
 "params": {"kind": "editor", "title": "新建文档", "input": "写一段新品上市文案", "button": "生成",
   "items": [{"text": "新品上市｜轻盈一整天"}, {"text": "重量只有 180 克"}, {"text": "续航提升到 12 小时"}],
   "highlight": 1, "done": "已生成"}}
```
```json
{"type": "mockApp", "dur": 4, "caption": "几百条订单，\n{一搜就到}", "mood": 0.5,
 "params": {"kind": "list", "title": "订单列表", "input": "退款",
   "items": [{"icon": "money", "text": "退款申请 #2931", "value": "待处理", "tone": "warn"},
             {"icon": "user", "text": "王先生的订单", "value": "已发货", "tone": "good"},
             {"icon": "alert", "text": "投诉：配送超时", "value": "紧急", "tone": "bad"}],
   "highlight": 0}}
```
```json
{"type": "mockApp", "dur": 3.5, "caption": "顾客预约，\n{30 秒填完}", "mood": 0,
 "params": {"kind": "form", "title": "预约到店", "button": "提交", "done": "预约成功",
   "items": [{"icon": "user", "text": "姓名", "value": "李女士"}, {"icon": "calendar", "text": "到店时间", "value": "周六下午"}, {"icon": "users", "text": "人数", "value": "2 人"}]}}
```

### 参数速查（自动生成自 mockApp.spec.json）

时长 2.5–8 秒（默认 4）；字幕 可选；默认情绪 0.3；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `kind` | 是 | dashboard / list / editor / form |  | 界面类型：dashboard 数据面板 / list 列表 / editor 生成文档 / form 表单 |
| `title` | 是 | 文字 | ≤10 字 | 界面顶栏标题，如「今日概览」 |
| `items` |  | 数组 | 0–5 项 | 行：dashboard 指标（只显示前 3 行）/ list 条目 / editor 生成的文字行（第 1 行是标题）/ form 表单项 |
| `items[].icon` |  | 文字 | 图标名 | 行首图标（dashboard/list/form 用） |
| `items[].text` | 是 | 文字 | ≤12 字 | 行文字 / 字段名，≤12 字（dashboard/list 行尾有 value 时 ≤10 字） |
| `items[].value` |  | 文字 | ≤6 字 | 行尾的值：指标数值 / 状态标签 / 表单填入的内容，≤6 字 |
| `items[].tone` |  | good / warn / bad / neutral |  | 值的颜色：good 绿 / warn 橙 / bad 红 / neutral 灰 |
| `highlight` |  | 整数 | 0–4 | dashboard/list/editor：被点中并高亮的行号（从 0 数） |
| `stat` |  | 对象 |  | dashboard 顶部的大数字 |
| `stat.value` | 是 | 文字 | ≤6 字 | 如「128」「+36%」「3.2万」，数字部分会滚动 |
| `stat.label` | 是 | 文字 | ≤8 字 | 数字说明，如「今日新增订单」 |
| `series` |  | 数组 | 2–12 项 | dashboard 图表数据，5–8 个数最好看，如 [3, 5, 4, 7, 9] |
| `chart` |  | line / bar |  | dashboard 图表：line 折线（默认）/ bar 柱状 |
| `input` |  | 文字 | ≤12 字 | editor：输入框里打出的需求；list：搜索框里打出的词；dashboard：顶部提问框里打出的问题（先问后出数） |
| `button` |  | 文字 | ≤4 字 | 主按钮文字，如「生成」「提交」「新建」 |
| `done` |  | 文字 | ≤6 字 | editor/form：完成后的提示，如「已生成」「提交成功」 |
| `source` |  | 文字 | ≤40 字 | 不上屏：stat/items 里写了「已售」「%」这类数据类说法时，填数据来源和统计截止日期（如「数据来源：内部后台，统计至2026年9月」） |

示例（能直接通过校验）：

```json
{"type": "mockApp", "dur": 4, "caption": "数据一目了然，\n{异常自动标红}", "mood": 0.3, "params": {"kind": "dashboard", "title": "今日概览", "source": "数据来源：内部后台，统计至2026年9月", "stat": {"value": "1,286", "label": "今日新增订单"}, "series": [32, 41, 38, 52, 49, 63, 78], "items": [{"icon": "trend", "text": "转化率", "value": "+12%", "tone": "good"}, {"icon": "clock", "text": "平均响应", "value": "3 分钟", "tone": "neutral"}, {"icon": "alert", "text": "待处理投诉", "value": "2 条", "tone": "bad"}], "highlight": 2}}
```

---

<a id="photoshot"></a>
## photoShot 实拍照片/短视频

非软件行业的主力镜头：把商家的实拍照片或短视频放大做主角，叠上菜名/商品名、一句卖点、价签这类信息。五种构图（`layout`）：
- `hero`：单张照片缓慢推近，底部渐变字幕带放标题/卖点/价签，适合招牌菜、主打商品、房型大图。
- `clip`：同 hero，素材换成一段短视频（带播放小标），适合制作过程、环境走动。
- `grid`：2–4 张拼贴依次入场，各带一个短标签，适合多角度环境照、几道菜一起亮相。
- `callouts`：一张照片 + 1–3 处引线圈注，适合讲清楚一张图里的几个细节（用料、工艺、部件）。
- `tour`：2–5 张依次轮播（带页码点），适合带看一个房间/一个空间的几个角度。

没有真实素材时，把这一项的 `source` 写成 `"drawn"`，不用给 `src`，改给 `illust`（插画名，从 `template/src/illust/names.json` 里按行业选，如 `"food/bowl"`）；不写 `illust` 也可以，会按 `meta.industry` 给一张默认插画。**插画兜底不是万能的**：一张干净的商家实拍永远比插画更有说服力，能拍就拍。

### 什么时候用
- 商家有真实照片/视频，想让它做画面主角（不是塞进手机框里当截图）。
- 需要在同一镜里把「这是什么」和「多少钱/什么标签」一起交代清楚。

### 什么时候别用
- 素材是 App 界面/操作演示：用 `phone`（真截图）或 `mockApp`（没截图时的模拟界面），不要用 photoShot 硬装。
- 一张图撑不起一整镜的信息量：并进 `features`、`quickList` 这类镜头，插画图标挂在那边就够。
- `grid` 缺图硬凑纯文字列表冒充环境照：直接跳过这一镜，或换用有图的镜头。

### 参数
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

### 时长
hero 1.5–3 秒；clip 2–4 秒；grid 2.5–4 秒；tour 每张 1.2–3 秒（总时长按张数给）；callouts 跟 hero 一样按内容给（默认 2.5 秒，圈注多给到 3.5–4 秒）。

### 好例子
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

### 坏例子
- `media[0].source: "merchant"` 但没给 `src`：校验会当成素材路径缺失。
- `source: "ai"` 却把 `tag` 写成「实拍」：AI 生成的画面必须标「效果图」，不能冒充实拍。
- `layout: "grid"` 只给 1 张：grid 至少要 2 张，1 张改用 `hero`。
- 把这一镜的 `title` 写成和 `meta.product` 不一致的产品名：photoShot 讲的是具体的菜/商品/房型，不是整个产品。

### 参数速查（自动生成自 photoShot.spec.json）

时长 1.2–12 秒（默认 2.5）；字幕 可选；默认情绪 0.3；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `layout` | 是 | hero / clip / grid / callouts / tour |  | hero 单张缓推 / clip 单段视频 / grid 2–4 张拼贴 / callouts 引线圈注 / tour 依次出现 |
| `media` | 是 | 数组 | 1–5 项 | hero/clip/callouts 各 1 项；grid 2–4 项；tour 2–5 项 |
| `media[].src` |  | 文字 | 素材 png/jpg/jpeg/webp/mp4 | 商家实拍/AI生成的图或视频；source=drawn 时不填 src，改填 illust |
| `media[].kind` |  | image / video |  | 不写按扩展名判断 |
| `media[].source` | 是 | merchant / ai / drawn |  | merchant 商家实拍 / ai AI 生成 / drawn 代码绘制（插画兜底，不需要 src） |
| `media[].illust` |  | 文字 |  | source=drawn 时选一张插画（见 template/src/illust/names.json）；不写就按 meta.industry 给默认图 |
| `media[].tag` | 是 | 实拍 / 示意 / 效果图 |  | source=ai 时必须是「效果图」 |
| `media[].month` |  | 整数 | 1–12 | 季节/天气景观画面必填，渲染成「N月实拍」 |
| `media[].label` |  | 文字 | ≤8 字 | 房型/位置名/款式名 |
| `media[].retouched` |  | true/false |  | 是否修过图，默认 false |
| `media[].trimStart` |  | 数字 | 0–… | 视频专用：截取起点（秒） |
| `media[].trimEnd` |  | 数字 | 0–… | 视频专用：截取终点（秒） |
| `media[].keepAudio` |  | true/false |  | 视频专用：是否保留原声 |
| `media[].speed` |  | 数字 | 0.8–1.5 | 视频专用：播放速度 |
| `title` |  | 文字 | ≤10 字 | 菜名/商品名/房型名 |
| `tagline` |  | 文字 | ≤12 字 |  |
| `badge` |  | 文字 | ≤4 字 | 如「招牌」「新品」 |
| `price` |  | 数字 | 0–… | 画面角上的小价签，数值必须和 brief 一致 |
| `unit` |  | 文字 | ≤4 字 |  |
| `roomType` |  | 文字 | ≤10 字 | 文旅专用：一镜只放一个房型，后面的 priceCard 要对得上 |
| `callouts` |  | 数组 | 2–4 项 | 仅 layout=callouts 使用 |
| `callouts[].text` | 是 | 文字 | ≤8 字 |  |
| `callouts[].x` |  | 数字 | 0–1080 |  |
| `callouts[].y` |  | 数字 | 0–1920 |  |
| `refs` |  | 数组 |  | 指向 meta.facts 里条目的 id |

示例（能直接通过校验）：

```json
{"type": "photoShot", "dur": 2.5, "mood": 0.3, "params": {"layout": "hero", "media": [{"src": "sample-screen.png", "source": "merchant", "tag": "实拍", "label": "招牌款"}], "title": "招牌菜一份", "tagline": "现点现做", "badge": "招牌"}}
```

---

<a id="meter"></a>
## meter 仪表 / 评分

一张卡片：顶上是仪表名，中间的指针从起点弹簧摆到目标值，落定那一拍数字弹一下、判词胶囊弹出、响一声重音；下一拍卡片底部浮出一句结论（之前是骨架条在「加载」）。分段颜色自动：越危险越红，或越好越绿。

### 什么时候用
- 把一个判断量化给观众看：危险程度、风险、匹配度、健康分、效率、满意度。
- 痛点镜（higherIs=bad，数值高、mood 高）或产品效果镜（higherIs=good，数值高、mood 低）。
- 想演「从坏变好」：`from` 写旧值、`value` 写新值（如风险 8 → 2）。

### 什么时候别用
- 没有一个可以打分的东西时，别硬凑分数，用 features / quickList。
- 要比较两个方案，用 compare（它每栏自带小刻度条）。
- 要一个很大的真实数字（如 12,800 元、3 小时），用 counter。

### 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| value | 是 | 0–1000 | 目标值，不要超过 max（超过按 max 画） |
| label | 是 | 8 字 | 仪表名，如「危险程度」「匹配度」 |
| max | 否 | 1–1000 | 满分，默认 10。1–10 的整数最好看（gauge 会画带数字的分段）；百分比写 100 |
| from | 否 | 0–1000 | 指针起点，默认 0 |
| unit | 否 | 3 字 | 单位，如「分」「%」；不写就显示「/满分」 |
| style | 否 | — | `gauge` 半圆仪表（默认）/ `ring` 圆环（百分比、完成度）/ `bar` 横条 |
| higherIs | 否 | — | `bad` 越高越红（默认）/ `good` 越高越绿 |
| word | 否 | 4 字 | 数字下的判词胶囊，如「很危险」「很合拍」 |
| note | 否 | 14 字 | 卡片底部一句解释 |
| icon | 否 | 图标名 | 仪表名前的图标，默认 bad→alert、good→star |

### 时长
2–6 秒，默认 3 秒。3 秒刚好：进场 → 1 秒时指针落定 → 1.5 秒出结论 → 留 1 秒给人读。

### 好例子
```json
{"type": "meter", "dur": 3, "caption": "这句话的火药味，\n{比你想的重}", "mood": 0.9,
 "params": {"value": 8, "max": 9, "label": "危险程度", "higherIs": "bad", "word": "很危险", "note": "对方在确认你在不在乎"}}
```
```json
{"type": "meter", "dur": 3, "caption": "简历和岗位，\n{匹配度一眼看清}", "mood": 0,
 "params": {"value": 92, "max": 100, "unit": "%", "style": "ring", "label": "简历匹配度", "higherIs": "good", "word": "很合拍", "note": "技能关键词覆盖 9 项"}}
```
```json
{"type": "meter", "dur": 3, "caption": "改完之后，\n{风险降下来了}", "mood": 0.5,
 "params": {"from": 8, "value": 2, "max": 10, "style": "bar", "label": "合同风险", "higherIs": "bad", "word": "低风险", "note": "3 处条款已标出修改建议"}}
```

### 坏例子
- `"value": 12, "max": 10` → 超过满分，画面停在 10，数字对不上。
- `"label": "对方这句话的危险程度"` → 超过 8 字，被校验拦下。
- 分数没有依据还写 note「绝对安全」→ 极限词，被拦下。

### 参数速查（自动生成自 meter.spec.json）

时长 2–6 秒（默认 3）；字幕 可选；默认情绪 0.7；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `value` | 是 | 数字 | 0–1000 | 目标值（不超过 max） |
| `max` |  | 数字 | 1–1000 | 满分，默认 10。用 1–10 的整数效果最好，百分比写 100 |
| `from` |  | 数字 | 0–1000 | 指针起点，默认 0；写旧值可演「从 8 降到 2」 |
| `label` | 是 | 文字 | ≤8 字 | 仪表名，如「危险程度」「匹配度」 |
| `unit` |  | 文字 | ≤3 字 | 单位，如「分」「%」；不写就显示「/满分」 |
| `style` |  | gauge / ring / bar |  | gauge 半圆分段仪表（默认）/ ring 圆环 / bar 横条 |
| `higherIs` |  | good / bad |  | 数值越高越好（绿）还是越坏（红），默认 bad |
| `word` |  | 文字 | ≤4 字 | 数字下的判词胶囊，如「很危险」「很合拍」 |
| `note` |  | 文字 | ≤14 字 | 卡片底部的一句解释，如「对方在确认你在不在乎」 |
| `icon` |  | 文字 | 图标名 | 仪表名前的图标，默认 bad→alert、good→star |

示例（能直接通过校验）：

```json
{"type": "meter", "dur": 3, "caption": "这句话的火药味，\n{比你想的重}", "mood": 0.9, "params": {"value": 8, "max": 9, "label": "危险程度", "style": "gauge", "higherIs": "bad", "word": "很危险", "note": "对方在确认你在不在乎"}}
```

---

<a id="compare"></a>
## compare 对比

两种演法：
- `lr`（默认）：左右两张卡。左卡（痛点）先逐条出现 → 中线画下来、VS 弹出 → 右卡（用了产品）逐条出现 → 右卡胜出：发光描边 + 角标（right.tone 是 bad 时是警示号，否则是对勾），左卡变灰 → 底部结论胶囊。
- `beforeAfter`：一张宽卡先演「之前」，再有一根滑杆从右往左扫过，露出「之后」，最后结论胶囊。

每栏可以带一个大数字 `stat`（如「1 小时」→「3 分钟」）和一条 0–10 的刻度条 `level`（两栏同一把尺子，`meterLabel` 写尺子量什么）。内容出来之前用骨架条占位，卡片不会空着。

同一批片子里别总用 `lr`（默认最容易被顺手一直选）：有「改造前后」这类叙事时优先试试 `beforeAfter`，两种构图交替用，视频才不会看着像同一个模板换皮。

### 什么时候用
- 「没用产品 vs 用了产品」「以前 vs 现在」「改造前 vs 改造后」。
- 有具体差别可说：花多久、几步、结果怎样。两栏 items 最好一一对应（同一件事的前后）。

### 什么时候别用
- 只有一边有内容（只想夸产品）：用 features。
- 只想说一个数字变化：用 counter（`showFrom: true`）。
- 不要拿真实竞品品牌做左栏，左栏写「手动」「以前」这类中性说法。

### 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| mode | 否 | — | `lr` 左右并排（默认）/ `beforeAfter` 滑杆揭晓 |
| left.title | 是 | 6 字 | 左栏 / 之前 的标题，如「手动整理」「以前」 |
| left.items | 是 | 1–3 条，每条 10 字 | 具体做法或结果 |
| left.tone | 否 | — | `bad`（默认）/ `good` / `neutral` |
| left.icon | 否 | 图标名 | 标题前图标，默认 clock |
| left.stat | 否 | 6 字 | 这一栏最醒目的数，如「1 小时」「5 步」 |
| left.level | 否 | 0–10 | 刻度条的值 |
| right.* | 同上 | 同上 | 右栏 / 之后；tone 默认 `good`，icon 默认 bolt |
| meterLabel | 否 | 6 字 | 刻度条量的是什么，如「麻烦程度」；只在写了 level 时显示 |
| verdict | 否 | 12 字 | 底部结论，如「省下的时间拿去休息」 |

### 时长
2.5–7 秒，默认 4 秒。每栏 3 条 + stat + 结论：lr 给 4–4.5 秒，beforeAfter 给 4 秒。给短了会整体加速。

### 好例子
```json
{"type": "compare", "dur": 4.5, "caption": "同样一份周报，\n{差了一小时}", "mood": 0.5,
 "params": {"mode": "lr",
   "left": {"title": "手动整理", "items": ["翻聊天记录", "复制粘贴", "改格式"], "stat": "1 小时", "level": 8},
   "right": {"title": "用了之后", "items": ["自动汇总", "一键生成", "直接发送"], "stat": "3 分钟", "level": 2},
   "meterLabel": "麻烦程度", "verdict": "省下的时间拿去休息"}}
```
```json
{"type": "compare", "dur": 4, "caption": "老板看的时候，\n{一眼抓重点}", "mood": 0.3,
 "params": {"mode": "beforeAfter",
   "left": {"title": "以前的周报", "items": ["流水账一大段", "重点埋在中间", "数据要自己算"], "stat": "12 段"},
   "right": {"title": "现在的周报", "items": ["三条要点置顶", "进度自动标色", "数据附在后面"], "stat": "3 条"},
   "verdict": "写的人省事，看的人省心"}}
```

### 坏例子
- `"items": ["每一条都写成很长的一句完整句子"]` → 超过 10 字，被拦下。
- 左右 items 各说各的（左边说价格、右边说颜值）→ 没有对比感。
- 只给一边写 stat / level → 另一边空着，对比不成立。

### 参数速查（自动生成自 compare.spec.json）

时长 2.5–7 秒（默认 4）；字幕 可选；默认情绪 0.5；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `mode` |  | lr / beforeAfter |  | lr 左右并排（默认）/ beforeAfter 先出之前、再滑杆揭晓之后 |
| `left` | 是 | 对象 |  | 左栏 / 之前 |
| `left.title` | 是 | 文字 | ≤6 字 | 栏标题，如「以前」「手动整理」 |
| `left.items` | 是 | 数组 | 1–3 项 | 1–3 条，每条 ≤10 字 |
| `left.tone` |  | good / bad / neutral |  | 颜色语气，左栏默认 bad |
| `left.icon` |  | 文字 | 图标名 | 标题前的图标，默认 bad→clock |
| `left.stat` |  | 文字 | ≤6 字 | 这一栏的大数字或短词，如「2 小时」「5 步」 |
| `left.level` |  | 数字 | 0–10 | 0–10 刻度条的值（和右栏同一把尺子） |
| `right` | 是 | 对象 |  | 右栏 / 之后 |
| `right.title` | 是 | 文字 | ≤6 字 | 栏标题，如「现在」「用了之后」 |
| `right.items` | 是 | 数组 | 1–3 项 | 1–3 条，每条 ≤10 字 |
| `right.tone` |  | good / bad / neutral |  | 颜色语气，右栏默认 good |
| `right.icon` |  | 文字 | 图标名 | 标题前的图标，默认 good→bolt |
| `right.stat` |  | 文字 | ≤6 字 | 这一栏的大数字或短词，如「3 分钟」「1 步」 |
| `right.level` |  | 数字 | 0–10 | 0–10 刻度条的值（和左栏同一把尺子） |
| `meterLabel` |  | 文字 | ≤6 字 | 刻度条量的是什么，如「麻烦程度」「效率」；两栏写了 level 时才显示 |
| `verdict` |  | 文字 | ≤12 字 | 底部结论胶囊，如「省下的时间拿去休息」 |

示例（能直接通过校验）：

```json
{"type": "compare", "dur": 4, "caption": "同样一份周报，\n{差了一小时}", "mood": 0.5, "params": {"mode": "lr", "left": {"title": "手动整理", "items": ["翻聊天记录", "复制粘贴", "改格式"], "tone": "bad", "icon": "clock", "stat": "1 小时", "level": 8}, "right": {"title": "用了之后", "items": ["自动汇总", "一键生成", "直接发送"], "tone": "good", "icon": "bolt", "stat": "3 分钟", "level": 2}, "meterLabel": "麻烦程度", "verdict": "省下的时间拿去休息"}}
```

---

<a id="beforeafter"></a>
## beforeAfter 前后对比滑块

同一位顾客做之前和做完的真实对比：一根滑杆从右往左扫过，露出「之后」。只有美业开放（发型 / 美甲 / 美睫）。

### 什么时候用
- 有同一位顾客、同一机位拍的「之前」「之后」两张真实照片，并且已经书面授权、没有修图。

### 什么时候别用
- 缺照片、没有授权、修过图，或者素材是 AI 生成的：一律不能用这个镜头，改用 steps 讲操作过程。
- `subVertical` 不支持医美相关项目（不接受 skincare 取值），这类需求这个镜头直接不做。

### 参数
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

### 时长
2–4 秒，默认 3 秒。给到 3.5–4 秒时「之前」「之后」两侧停留更从容；2 秒是压缩节奏的下限，滑杆动作会更快。

### 好例子
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

### 坏例子
- `retouched` 写 true，或者压根不填 `consent`：直接被拦。
- `subVertical` 写成医美相关的取值：不在这个镜头的适用范围内。
- 没有真实前后照片时硬凑一张示意图：缺照片时这个镜头直接不画、不生成，改用别的镜头。

### 参数速查（自动生成自 beforeAfter.spec.json）

时长 2–4 秒（默认 3）；字幕 可选；默认情绪 0.15；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `before` | 是 | 对象 |  |  |
| `before.src` | 是 | 文字 | 素材 png/jpg/jpeg/webp |  |
| `before.label` |  | 文字 | ≤4 字 |  |
| `after` | 是 | 对象 |  |  |
| `after.src` | 是 | 文字 | 素材 png/jpg/jpeg/webp |  |
| `after.label` |  | 文字 | ≤4 字 |  |
| `consent` | 是 | true/false |  | 必须为 true：顾客已书面授权 |
| `retouched` | 是 | true/false |  | 必须为 false：未修图 |
| `sameAngle` |  | true/false |  | 建议 true：同一机位拍摄 |
| `subVertical` | 是 | hair / nail / lash |  | 取 skincare 时校验拒绝 |
| `caption2` |  | 文字 | ≤12 字 | 卡片内的一句说明（和镜头级 caption 分开，避免和字幕带重复） |

示例（能直接通过校验）：

```json
{"type": "beforeAfter", "dur": 3, "mood": 0.15, "params": {"before": {"src": "sample-screen.png", "label": "做之前"}, "after": {"src": "sample-screen.png", "label": "做完"}, "consent": true, "retouched": false, "sameAngle": true, "subVertical": "hair"}}
```

---

<a id="counter"></a>
## counter 大数字滚动

一张卡片：图标 → 大数字从 `from` 滚到 `to`（嗒嗒声，下方进度条同步走）→ 落定那一拍数字弹一下、放射光线、叮一声 → 下面是这个数字的含义 `label` 和口径 `sub`。
写 `showFrom: true` 时，数字上方先显示旧值，落定前被一笔划掉，并自动算出变化幅度胶囊（如「↓ 87%」「↑ 3 倍」）。

### 什么时候用
- 产品效果有一个硬数字：省了多少时间、多少钱、提升几倍、服务了多少人。
- 前后对比只有一个数：旧耗时 → 新耗时（`from` 旧值、`to` 新值、`showFrom: true`），两个数都要出自简报；全片别处再提耗时，必须和 `to` 是同一个数（counter 说 3 分钟，别处就不能写「秒出」「3 秒」）。

### 什么时候别用
- 数字没有来源 / 口径：别用；简报给了数字和来源，先原样抄进 `meta.facts` 再用；只想示意就在 sub 写「示例数据，以实际为准」。不要自己编「内部测试」「实测」（校验会拦）。
- 要同时比好几项：用 compare。
- 要打分（满分 10 分那种）：用 meter。

### 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| to | 是 | 数字 | 最终停在这个数 |
| label | 是 | 12 字 | 这个数字的含义，如「整理一份周报」「每人每年省下」 |
| from | 否 | 数字 | 起点，默认 0；做前后对比写旧值 |
| showFrom | 否 | true/false | true = 划掉旧值 + 显示变化幅度（要同时写 from） |
| decimals | 否 | 0–2 | 小数位，默认 0 |
| prefix | 否 | 2 字 | 数字前的符号，如「¥」「+」 |
| suffix | 否 | 3 字 | 单位，如「%」「倍」「分钟」 |
| sub | 否 | 16 字 | 小字口径/来源：只写简报给的来源；没给就写「示例数据，以实际为准」 |
| icon | 否 | 图标名 | 数字上方的图标，默认 trend |
| tone | 否 | — | 数字颜色：`accent` 主题色（默认）/ `good` 绿 / `bad` 红 |

### 时长
2–5 秒，默认 3 秒。数字在第 1.5 秒左右落定，之后留时间给人读 label。

### 好例子
```json
{"type": "counter", "dur": 3, "caption": "周报不用再熬，\n{几分钟就交}", "mood": 0.2,
 "params": {"from": 45, "to": 6, "suffix": "分钟", "showFrom": true, "label": "整理一份周报", "sub": "示例数据，以实际为准", "icon": "clock", "tone": "good"}}
```
```json
{"type": "counter", "dur": 3, "caption": "老客复购{翻了一倍多}", "mood": 0.2,
 "params": {"to": 12800, "prefix": "¥", "label": "单店月复购金额", "sub": "示例数据，以实际为准", "icon": "money"}}
```

### 坏例子
- `"to": 100, "suffix": "%", "label": "用户满意"` → 「100%」是极限表述，也没有口径。
- `"showFrom": true` 却不写 from → 没有旧值可划，这一行直接不显示，白写。
- `"label": "使用我们的产品之后每个月可以节省下来的时间"` → 超过 12 字，被拦下。

### 参数速查（自动生成自 counter.spec.json）

时长 2–5 秒（默认 3）；字幕 可选；默认情绪 0.2；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `to` | 是 | 数字 | -1000000–100000000 | 目标数字（最终停在这个数） |
| `from` |  | 数字 | -1000000–100000000 | 起始数字，默认 0；做前后对比时写旧值 |
| `decimals` |  | 整数 | 0–2 | 小数位，默认 0 |
| `prefix` |  | 文字 | ≤2 字 | 数字前的符号，如「¥」「+」 |
| `suffix` |  | 文字 | ≤3 字 | 数字后的单位，如「%」「倍」「分钟」 |
| `label` | 是 | 文字 | ≤12 字 | 数字的含义，如「整理一份周报」 |
| `sub` |  | 文字 | ≤16 字 | 小字：口径/来源。只写简报给的来源（要先抄进 meta.facts）；没给就写「示例数据，以实际为准」 |
| `icon` |  | 文字 | 图标名 | 数字上方的图标，默认 trend |
| `showFrom` |  | true/false |  | true = 在数字上方显示被划掉的旧值 + 变化幅度（需要写 from） |
| `tone` |  | accent / good / bad |  | 数字颜色：accent 主题色（默认）/ good 绿 / bad 红 |

示例（能直接通过校验）：

```json
{"type": "counter", "dur": 3, "caption": "周报不用再熬，\n{几分钟就交}", "mood": 0.2, "params": {"from": 45, "to": 6, "suffix": "分钟", "showFrom": true, "label": "整理一份周报", "sub": "示例数据，以实际为准", "icon": "clock", "tone": "good"}}
```

---

<a id="pricecard"></a>
## priceCard 价格卡/价目表

把明码标价的排版规则做进组件里，模型只填数字和条件，价格区不会因为排版问题看不清、不会闪烁抖动。两种布局：
- `card`：单个房型/套餐/商品的价格卡。大价格 + 单位 + （可选）划线对比价 → 商品名 → 分隔线 → 包含项清单 → 限制/另收费用/条件/活动期 → 赠品 → 脚注。
- `menu`：2–6 行的价目表，名称和价格用虚线对齐，行数多的时候用它，不要硬塞进 card。

**不写「原价」二字。** 有划线对比价时，`compare.basis` 必须写清楚这个对比价是什么依据（「厂商建议零售价」「单点合计」……），画面直接显示这个依据文字，不出现「原价」。

### 什么时候用
- 需要明确标价的镜头：套餐价、门票、课时费、理发价、商品价目表。
- 到手价/券后价这类需要写清楚条件的场景：写进 `conditions`。

### 什么时候别用
- 只是想在别的镜头角落带一个小价签（比如菜品照片上的价签）：用 `photoShot` 的 `price`/`unit` 字段，不用单独开一镜 priceCard。
- 没有真实价格，编一个数字撑场面：不写这一镜，或者等有价格再补。

### 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| layout | 否 | — | `card`（默认）/ `menu` |
| items | 是 | 1–6 项 | card 布局只看第 1 项；menu 布局逐行显示 |
| items[].itemId | 是 | 20 字 | 对应简报价格表里的 id |
| items[].name | 否 | card 10 字 / menu 8 字 | 商品/套餐名 |
| items[].price | 是 | — | 数字，不允许 0/1/9.9 这类噱头价 |
| items[].unit | 是 | 4 字 | 碗/杯/只/晚/次/位/人/张/套 |
| items[].from | 否 | — | true 时价格后带「起」；card 布局要配 fromNote，menu 布局要配 addOns |
| items[].fromNote | from=true 时必填（card） | 12 字 | 「起」价的说明 |
| items[].note | 否 | 12 字 | 一行小字说明 |
| label | 否 | — | 售价/到手价/券后价/团购价/套餐价/活动价/门票 |
| people | 否 | 6 字 | 如「2–3人」 |
| includes | 否 | ≤6 项，每项 8 字 | 包含项清单，写清数量 |
| excludes | 否 | 14 字 | 另收费用；要求必填时没有就写「无其他收费」 |
| limits | 否 | ≤3 项，每项 14 字 | 如「限堂食」「不可叠加」 |
| conditions | 否 | 16 字 | 到手价/券后价的条件 |
| period | 否 | 16 字 | 活动起止日期 |
| addOns | 否 | ≤4 项 | {cond, extra}，如「及腰长发」+「160元」 |
| compare | 否 | — | {price, basis, evidence}；basis 从固定选项里选，evidence 不上屏 |
| gift | 否 | — | {name, qty}，如「焗油」×1 |
| footnote | 否 | 24 字 | 固定文案（各行业统一口径），不要自己改写 |

### 时长
card 2–4.5 秒；menu 不少于 3 秒（行数多给到 4–4.5 秒）。

### 好例子
```json
{"type": "priceCard", "dur": 4, "caption": "双人招牌餐，\n{团购价59元}", "mood": 0.15,
 "params": {"layout": "card",
   "items": [{"itemId": "deal-1", "name": "双人招牌餐", "price": 59, "unit": "份"}],
   "label": "团购价", "people": "2人",
   "includes": ["红烧牛肉面×2", "手打牛肉丸×1份(6颗)", "凉拌三丝×1"],
   "limits": ["限堂食", "不可叠加"],
   "compare": {"price": 68, "basis": "单点合计", "evidence": "菜单图 photos/menu.jpg"},
   "footnote": "以团购详情页为准"}}
```
```json
{"params": {"layout": "menu",
  "items": [
    {"itemId": "a", "name": "红烧牛肉面", "price": 22, "unit": "碗"},
    {"itemId": "b", "name": "手打牛肉丸", "price": 16, "unit": "份"},
    {"itemId": "c", "name": "小份牛肉面", "price": 12, "unit": "碗", "note": "一个人也能点"}
  ], "label": "菜单价"}}
```

### 坏例子
- `price: 9.9` 当引流噱头价：会被行业规则拦（噱头价不允许）。
- 写了 `compare` 但 `basis` 不在固定选项里，或没给 `evidence`：校验会拦，价格对比必须有依据。
- 画面上出现「原价」二字：改成 `compare.basis` 本身的说法（如「厂商建议零售价」）。
- `items[].from: true` 却不给 `fromNote`（card）或 `addOns`（menu）：起价必须说明「起」在哪。

### 参数速查（自动生成自 priceCard.spec.json）

时长 2–4.5 秒（默认 3）；字幕 可选；默认情绪 0.15；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `layout` | 是 | card / menu |  | card 单个房型/套餐/商品 / menu 2–6 项价目表 |
| `items` | 是 | 数组 | 1–6 项 |  |
| `items[].itemId` | 是 | 文字 | ≤20 字 | 对应 brief 价格表里的 id |
| `items[].name` |  | 文字 | ≤10 字 | card 布局 ≤10 字，menu 布局建议 ≤8 字 |
| `items[].price` | 是 | 数字 | 0–… |  |
| `items[].unit` | 是 | 文字 | ≤4 字 | 碗/杯/只/晚/次/位/人/张/套 |
| `items[].from` |  | true/false |  | 价格后是否带「起」 |
| `items[].fromNote` |  | 文字 | ≤12 字 |  |
| `items[].note` |  | 文字 | ≤12 字 |  |
| `label` |  | 售价 / 到手价 / 券后价 / 团购价 / 套餐价 / 活动价 / 门票 |  |  |
| `people` |  | 文字 | ≤6 字 | 如「2–3人」 |
| `includes` |  | 数组 | 0–6 项 |  |
| `excludes` |  | 文字 | ≤14 字 | 另收的费用或不含的项目；行业要求必填时没有就写「无其他收费」 |
| `limits` |  | 数组 | 0–3 项 |  |
| `conditions` |  | 文字 | ≤16 字 | 到手价/券后价的条件、周末加价 |
| `period` |  | 文字 | ≤16 字 | 活动起止日期 |
| `addOns` |  | 数组 | 0–4 项 |  |
| `addOns[].cond` | 是 | 文字 | ≤8 字 |  |
| `addOns[].extra` | 是 | 文字 | ≤8 字 |  |
| `compare` |  | 对象 |  |  |
| `compare.price` | 是 | 数字 | 0–… |  |
| `compare.basis` | 是 | 前7日最低成交价 / 单点合计 / 厂商建议零售价 / 吊牌价 / 平日价 |  |  |
| `compare.evidence` | 是 | 文字 | ≤60 字 | 划线价的依据，不上屏 |
| `gift` |  | 对象 |  |  |
| `gift.name` | 是 | 文字 | ≤8 字 |  |
| `gift.qty` | 是 | 整数 | 1–… |  |
| `footnote` |  | 文字 | ≤24 字 |  |
| `refs` |  | 数组 |  | 指向 meta.facts 里条目的 id；卡片上写了「现做」「手打」这类需要依据的说法时用它放行 |

示例（能直接通过校验）：

```json
{"type": "priceCard", "dur": 3, "mood": 0.15, "params": {"layout": "card", "items": [{"itemId": "deal-1", "name": "双人套餐", "price": 59, "unit": "份", "note": "含两菜一汤"}], "label": "团购价", "people": "2人", "includes": ["主菜两份", "例汤一份"], "limits": ["限堂食"]}}
```

---

<a id="storecard"></a>
## storeCard 门店/位置/到店指引

讲清楚店在哪、几点开门、怎么过来，以及平台内怎么操作。**不设电话、微信、二维码、网址、门牌号字段**——这些信息本来就不该出现在画面上。三种布局：
- `photo`：门头实拍横幅 + 信息卡，适合有门头照的门店。
- `map`：代码画的抽象示意图（几条街道线 + 定位针 + 地铁点），不模仿任何地图 App 的界面风格，适合没有门头照或想强调「怎么走」的场景。
- `card`：纯排版信息卡，没有照片也能用，最通用。

### 什么时候用
- 需要讲清楚到店路线、营业时间、平台内操作提示的镜头（团购/到店类内容的收尾前一镜）。

### 什么时候别用
- 想放电话、微信号、二维码引导私聊：这个镜头的 schema 里根本没有这些字段，也不该出现在画面上，换成 `cta` 里平台自己的操作提示（如「点视频定位看团购」）。
- 只是想在片尾提一句「欢迎光临」：用 `endCard`，不用单独开一镜 storeCard。

### 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| layout | 否 | — | `photo` / `map` / `card`（默认） |
| name | 是 | 10 字 | 店名 |
| landmark | 否 | 14 字 | 地铁口/商场楼层/镇村名，不写门牌号 |
| hours | 否 | 14 字 | 营业时间 |
| photo | 否 | — | 门头照路径，`layout: "photo"` 时用，必须是商家实拍 |
| routes | 否 | 0–4 项 | {to, mode, minutes, km}；mode 取步行/驾车/打车/公交/地铁/骑行/接驳车 |
| basis | 否 | — | 导航估算（默认，会自动加小字说明）/ 实测 |
| parking | 否 | 10 字 | 停车说明 |
| pickup | 否 | 12 字 | 接站说明，收费的要写明金额 |
| badges | 否 | ≤4 项，每项 8 字 | 如「一客一消毒」「预约制」 |
| cta | 否 | 10 字 | 平台内操作提示，按发布平台取预设值 |
| disclaimer | 否 | 16 字 | 免责小字；美业类目默认「生活美容 · 不提供医疗美容服务」 |

### 时长
2.5–4 秒。

### 好例子
```json
{"type": "storeCard", "dur": 3, "caption": "桂园站B口，\n{步行3分钟就到}", "mood": 0.2,
 "params": {"layout": "photo", "name": "巷口面馆",
   "landmark": "地铁2号线桂园站B口", "hours": "10:00-21:30",
   "photo": "photos/storefront.jpg",
   "routes": [{"to": "地铁站", "mode": "步行", "minutes": 3}],
   "cta": "点视频定位看团购"}}
```
```json
{"params": {"layout": "map", "name": "巷口面馆",
  "routes": [{"to": "地铁站", "mode": "地铁", "minutes": 8}, {"to": "公司", "mode": "打车", "minutes": 12}]}}
```

### 坏例子
- 在 `badges` 或任何字段里塞入「加微信」「扫码进群」「私信领券」：这个镜头不做站外导流，写了会被拦。
- `layout: "photo"` 但 `photo` 的素材标了 `source: "ai"` 或不是商家实拍：门头照必须是商家自己的实拍。
- `landmark` 写成完整门牌号（如「XX路88号3楼」）：改写成地铁口/商场楼层/镇村名这类不精确到门牌的说法。

### 参数速查（自动生成自 storeCard.spec.json）

时长 2.5–4 秒（默认 3）；字幕 可选；默认情绪 0.2；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `layout` | 是 | photo / map / card |  |  |
| `name` | 是 | 文字 | ≤10 字 |  |
| `landmark` |  | 文字 | ≤14 字 |  |
| `hours` |  | 文字 | ≤14 字 |  |
| `photo` |  | 文字 | 素材 png/jpg/jpeg/webp |  |
| `routes` |  | 数组 | 0–4 项 |  |
| `routes[].to` | 是 | 文字 | ≤8 字 |  |
| `routes[].mode` | 是 | 步行 / 驾车 / 打车 / 公交 / 地铁 / 骑行 / 接驳车 |  |  |
| `routes[].minutes` | 是 | 数字 | 0–300 |  |
| `routes[].km` |  | 数字 | 0–… |  |
| `basis` |  | 导航估算 / 实测 |  |  |
| `parking` |  | 文字 | ≤10 字 |  |
| `pickup` |  | 文字 | ≤12 字 | 接站收费的要写明金额 |
| `badges` |  | 数组 | 0–4 项 |  |
| `cta` |  | 文字 | ≤10 字 |  |
| `disclaimer` |  | 文字 | ≤16 字 |  |
| `refs` |  | 数组 |  | 指向 meta.facts 里条目的 id；badges 里写了「现做」这类需要依据的说法时用它放行 |

示例（能直接通过校验）：

```json
{"type": "storeCard", "dur": 3, "mood": 0.2, "params": {"layout": "card", "name": "巷口面馆", "landmark": "地铁2号线桂园站B口", "hours": "10:00–21:30", "routes": [{"to": "地铁站", "mode": "步行", "minutes": 3}], "basis": "导航估算"}}
```

---

<a id="reviewcard"></a>
## reviewCard 真实顾客评价

摘录真实顾客评价：大引号 + 原文 + 星级 + 月份，星星一颗一颗点亮（不是一次性贴一排）。1–2 条评价，不放真人头像，改用首字圆标。

### 什么时候用
- 需要「别人说好」而不是「自己说好」的时候：餐饮、文旅、美业常用；电商也能用，但要隐去昵称。
- 有截图能对得上原文时（`evidence` 只给校验和人看，不上屏）。

### 什么时候别用
- 教培场景不能用这个镜头（学员证言类广告受限），换成 credCard 或 factSheet 讲师资/课程信息。
- 编不出真实原文摘录时别硬凑：`text` 必须是某条真实评价的子串，改写得更夸张会被拦。

### 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| quotes | 是 | 1–2 条 | 每条一段评价 |
| quotes[].text | 是 | 24 字 | 原文摘录，可删减、不能改写得更夸张 |
| quotes[].month | 是 | 7 字 | 评价月份，如 2026-08 |
| quotes[].stars | 否 | 1–5 | 星级，必须和原评价一致 |
| quotes[].who | 否 | 8 字 | 如「亲子住客」，不写真名 |
| evidence | 是 | 80 字 | 评价截图的路径，不上屏，只给校验和人看 |

### 时长
2–4.5 秒，默认 3 秒。1 条评价给 3 秒左右；2 条评价给 4–4.5 秒，太短星星来不及一颗颗点完。

### 好例子
```json
{"type": "reviewCard", "dur": 3, "mood": 0.15,
 "params": {"quotes": [{"text": "汤很浓，肉给得实在", "month": "2026-08", "stars": 5}], "evidence": "reviews/2026-08-01.png"}}
```
```json
{"type": "reviewCard", "dur": 4.5, "mood": 0.15,
 "params": {"quotes": [
   {"text": "房间很干净，窗外景色很好", "month": "2026-07", "stars": 5, "who": "亲子住客"},
   {"text": "老板人很热情，下次还来", "month": "2026-06", "stars": 4}
 ], "evidence": "reviews/screenshot-2026-07.png"}}
```

### 坏例子
- `text` 写成「全网最好评的一家」→ 不是原文摘录，是编的夸张说法。
- `stars` 写 5，但原评价只有 3 星 → 和 `evidence` 对不上，行业规则会拦。
- 给真人写了本名当 `who` → 改成「常客」「亲子住客」这类身份描述。

### 参数速查（自动生成自 reviewCard.spec.json）

时长 2–4.5 秒（默认 3）；字幕 可选；默认情绪 0.15；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `quotes` | 是 | 数组 | 1–2 项 |  |
| `quotes[].text` | 是 | 文字 | ≤24 字 | 原文摘录，可删减不可改写得更夸张 |
| `quotes[].month` | 是 | 文字 | ≤7 字 | 评价月份，如 2026-08 |
| `quotes[].stars` |  | 整数 | 1–5 | 必须和原评价一致 |
| `quotes[].who` |  | 文字 | ≤8 字 | 如「亲子住客」，不写真名 |
| `evidence` | 是 | 文字 | ≤80 字 | 评价截图的路径，不上屏 |

示例（能直接通过校验）：

```json
{"type": "reviewCard", "dur": 3, "mood": 0.15, "params": {"quotes": [{"text": "汤很浓，肉给得实在", "month": "2026-08", "stars": 5}], "evidence": "reviews/2026-08-screenshot-01.png"}}
```

---

<a id="factsheet"></a>
## factSheet 参数表 / 清单 / 大纲 / 考试信息 / 色卡

五种排版共用一张卡，逐行点亮，主角是「信息被一条条证实」的过程，不是一次性摆满：
- `spec`：规格参数表（key: value），画表格线
- `box`：开箱或包装清单，圆角方块卡片 + 数量「×N」+ 赠品「赠」角标
- `syllabus`：课程大纲，章节号 + 章节名 + 节数
- `exam`：考试信息，同 spec 的表格，底部必须写来源（没有来源不允许渲染）
- `swatch`：色卡，色块依次弹出，可选高亮一个主推色

### 什么时候用
- 有一屏能写清楚的硬信息：材质规格、开箱清单、课程章节、考试安排、色号。
- 想替代「一句话吹一个功能」时，用表格/清单把可核实的事实摆出来更可信。

### 什么时候别用
- 信息只有 1 条：用 counter 或更轻的镜头，不必上整张表。
- exam 布局但写不出真实 `source`：不要编一个来源，没有就别用这个布局。

### 参数
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

### 时长
3–8 秒，默认 4 秒；syllabus、exam 行数多时建议给到 5–8 秒，太短逐行点亮会被压得很快，读不清。

### 好例子
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

### 坏例子
- exam 布局不填 `source` → 不允许渲染，不要编一个「网络」当来源。
- facts 里写「终身有效」「永久使用」→ 会被拦。
- swatch 布局 `hex` 不是 6 位十六进制（如漏写、写成颜色名）→ 显示成占位灰块，等于没给色值。

### 参数速查（自动生成自 factSheet.spec.json）

时长 3–8 秒（默认 4）；字幕 可选；默认情绪 0.1；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `layout` | 是 | spec / box / syllabus / exam / swatch |  |  |
| `title` | 是 | 文字 | ≤12 字 |  |
| `rows` | 是 | 数组 | 2–6 项 |  |
| `rows[].key` | 是 | 文字 | ≤6 字 |  |
| `rows[].value` | 是 | 文字 | ≤10 字 |  |
| `rows[].qty` |  | 整数 | 0–… | box 布局专用 |
| `rows[].isGift` |  | true/false |  | box 布局专用：赠品方块加「赠」角标 |
| `rows[].no` |  | 文字 | ≤4 字 | syllabus 布局专用：章节号 |
| `rows[].name` |  | 文字 | ≤12 字 | syllabus 布局专用：章节名 |
| `rows[].lessons` |  | 整数 | 0–… | syllabus 布局专用：节数 |
| `rows[].hex` |  | 文字 |  | swatch 布局专用 |
| `facts` |  | 数组 | 0–4 项 | 底部事实条 |
| `facts[].label` | 是 | 文字 | ≤4 字 |  |
| `facts[].value` | 是 | 文字 | ≤8 字 |  |
| `source` |  | 文字 | ≤24 字 | exam 布局必填，如「来源：XX官网 2026-09」 |
| `notice` |  | 文字 | ≤20 字 |  |
| `image` |  | 文字 | 素材 png/jpg/jpeg/webp |  |
| `highlight` |  | 整数 | 0–… | swatch 布局专用：主推色在 rows 里的序号（从 0 数） |

示例（能直接通过校验）：

```json
{"type": "factSheet", "dur": 4, "mood": 0.1, "params": {"layout": "spec", "title": "规格参数", "rows": [{"key": "材质", "value": "304不锈钢"}, {"key": "容量", "value": "500ml"}]}}
```

---

<a id="credcard"></a>
## credCard 资历卡 / 荣誉卡

用可核实的资历替代「名师」「金牌」这类空话。两种布局：
- `person`：讲师、手艺人的资历卡——首字圆标（或本人已同意的照片）+ 姓名/角色/年限 + 资历逐条打勾 + 技能标签
- `honor`：荣誉/证书卡——自绘徽章（不模仿任何官方标识）+ 称号 + 颁发方 · 年份

### 什么时候用
- 想证明「这个人 / 这份荣誉是真的」，而不是自吹自擂。
- `person.creds` 必须逐字出自简报的资历字段；`honor` 建议给 `refs`，指向 `meta.facts` 里能核实的条目。

### 什么时候别用
- 编不出可核实的资历时别用这个镜头，换成 features 讲产品卖点。
- 不要用 AI 生成的人脸或图库人像冒充本人；没有照片就用默认的首字圆标，不要自己截一张陌生人的照片凑数。

### 参数
| 字段 | 必填 | 上限 | 说明 |
|---|---|---|---|
| layout | 是 | — | person / honor |
| name | person 布局建议填 | 6 字 | 称呼即可，不用全名 |
| role | 否 | 12 字 | 如「面点主厨」 |
| years | 否 | 0–80 | 从业年限 |
| creds | 否 | 0–3 条，每条 16 字 | 资历，须逐字出自简报 |
| skills | 否 | 0–3 条，每条 6 字 | 技能标签 |
| photo | 否 | 素材 png/jpg/jpeg/webp | person：本人已同意的照片；honor：证书或牌匾实拍 |
| title | honor 布局建议填 | 12 字 | 荣誉名称 |
| issuer | 否 | 12 字 | 颁发方 |
| year | 否 | 1900–2100 | 年份 |
| refs | honor 布局建议填 | — | 指向 `meta.facts` 里的条目 id |

公共禁用词（各行业规则还会追加）：医生、医师、专家、教授、主任、院长、皮肤科、名师、金牌、王牌、顶级、大咖、权威、第一，以及国家机关名称。

### 时长
1.5–6 秒，默认 3 秒；person 有 2–3 条资历时给到 3.5–4.5 秒，太短逐条打勾会被压得很快。

### 好例子
```json
{"type": "credCard", "dur": 3.5, "mood": 0.15,
 "params": {"layout": "person", "name": "陈师傅", "role": "面点主厨", "years": 12,
   "creds": ["中式面点职业技能等级证书"], "skills": ["手打", "熬汤"]}}
```
```json
{"type": "credCard", "dur": 3, "mood": 0.15,
 "params": {"layout": "honor", "title": "年度优质商户", "issuer": "XX平台", "year": 2026, "refs": ["f4"]}}
```

### 坏例子
- `creds` 写「业内公认的顶级大师」→ 既不可核实，又踩了公共禁用词。
- honor 布局不给 `refs`，荣誉查无出处。
- `photo` 用网图或 AI 生成的人脸冒充本人。

### 参数速查（自动生成自 credCard.spec.json）

时长 1.5–6 秒（默认 3）；字幕 可选；默认情绪 0.15；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `layout` | 是 | person / honor |  |  |
| `name` |  | 文字 | ≤6 字 | person 布局：称呼即可 |
| `role` |  | 文字 | ≤12 字 |  |
| `years` |  | 整数 | 0–80 | 从业年限 |
| `creds` |  | 数组 | 0–3 项 |  |
| `skills` |  | 数组 | 0–3 项 |  |
| `photo` |  | 文字 | 素材 png/jpg/jpeg/webp | person 布局选填，要求顾客/本人已同意（consent）；honor 布局是证书或牌匾实拍 |
| `title` |  | 文字 | ≤12 字 | honor 布局：荣誉名称 |
| `issuer` |  | 文字 | ≤12 字 | honor 布局：颁发方 |
| `year` |  | 整数 | 1900–2100 |  |
| `refs` |  | 数组 |  | honor 布局必填，指向 meta.facts 里的条目 id |

示例（能直接通过校验）：

```json
{"type": "credCard", "dur": 3, "mood": 0.15, "params": {"layout": "person", "name": "陈师傅", "role": "面点主厨", "years": 12, "creds": ["中式面点职业技能等级证书"], "skills": ["手打", "熬汤"]}}
```

---

<a id="features"></a>
## features 卖点卡

2–4 张卖点卡按拍依次弹入（图标 + 标题 + 一句好处），黄色聚光框跟着「当前讲到的那张」移动；还没讲到的卡先显示成带序号的虚线框。

### 什么时候用
- 产品出场之后，讲「它能帮你做哪几件事」。
- 每张卡一个卖点，2–4 个。

### 什么时候别用
- 讲操作顺序（先做什么后做什么）→ 用 steps。
- 要列 5 条以上、或是一堆短句/原话 → 用 quickList。
- 只有 1 个卖点 → 用 counter / meter / mockApp 把它演出来。

### 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| items | 是 | 2–4 张卡，按顺序弹出 |
| items[].icon | 是 | 图标名（只能从图标清单选） |
| items[].title | 是 | 卖点标题，**≤8 字**，名词短语，如「自动汇总」 |
| items[].desc | 否 | 一句好处，**≤16 字**，写用户能感到的结果 |
| layout | 否 | `grid`（默认：2 张并排 / 3 张一横两方 / 4 张 2x2）或 `stack`（竖排横条） |

字数：汉字算 1，英文字母/数字算半个。超了校验会拦。

### 时长
约「张数 × 1 秒 + 1.5 秒」：2 张 3 秒，3 张 4 秒，4 张 5–6 秒。范围 2.5–7 秒。时长越长，每张卡停得越久。

### 写好的要点
- title 说「是什么」，desc 说「带来什么」：✅「数据成图 / 完成率自动画成图表」 ❌「强大功能 / 非常好用」。
- 不同卡用不同图标。
- desc 普遍偏长（13–16 字）时用 `stack`，每条单行更好读。

### 示例
```json
{"type": "features", "dur": 4, "caption": "看懂语气，\n{回复也帮你想好}", "mood": 0.2,
 "params": {"items": [
   {"icon": "search", "title": "自动汇总", "desc": "从日程和文档里抓出本周进度"},
   {"icon": "chart", "title": "数据成图", "desc": "完成率自动画成图表"},
   {"icon": "doc", "title": "一键排版", "desc": "套上模板，不用调格式"}
 ]}}
```

### 参数速查（自动生成自 features.spec.json）

时长 2.5–7 秒（默认 4）；字幕 可选；默认情绪 0.2；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `items` | 是 | 数组 | 2–4 项 | 卖点卡，按顺序每 1–2 拍弹出一张 |
| `items[].icon` | 是 | 文字 | 图标名 | 卡片图标（图标清单里的名字） |
| `items[].title` | 是 | 文字 | ≤8 字 | 卖点标题，≤8 字，如「读懂语气」 |
| `items[].desc` |  | 文字 | ≤16 字 | 一句好处，≤16 字，如「看出对方话里的情绪」 |
| `layout` |  | grid / stack |  | grid 网格（默认）/ stack 竖排横条 |

示例（能直接通过校验）：

```json
{"type": "features", "dur": 4, "caption": "看懂语气，\n{回复也帮你想好}", "mood": 0.2, "params": {"items": [{"icon": "search", "title": "读懂语气", "desc": "看出对方话里的真实情绪"}, {"icon": "chat", "title": "给出回复", "desc": "三条候选，挑一条就行"}, {"icon": "shield", "title": "不替你发", "desc": "发不发永远由你决定"}]}}
```

---

<a id="steps"></a>
## steps 1-2-3 流程

一张流程卡：左边节点竖排，连线上的光点一步步往下跑，每到一步节点点亮、文字滑入；全部走完后每个节点打 ✓（叮一声）。表现「上手很简单」。

### 什么时候用
- 卖点讲完、片尾之前，讲「怎么用」「几步就好」。
- 步骤 2–4 步，有先后顺序。

### 什么时候别用
- 几个卖点之间没有先后 → 用 features。
- 步骤超过 4 步 → 合并成 3 步再写，别硬塞。

### 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| items | 是 | 2–4 步，按顺序点亮 |
| items[].title | 是 | 步骤标题，**≤8 字**，动词开头，如「打开聊天」「点悬浮球」 |
| items[].desc | 否 | 一句补充，**≤14 字**，写这一步的结果，如「一分钟出初稿」 |
| items[].icon | 否 | 图标名（图标清单里选）。写了节点里画图标、序号变角标；不写就画大号序号 |

字数：汉字算 1，英文字母/数字算半个。超了校验会拦。

### 时长
约「步数 × 1 秒 + 1.5 秒」：3 步 4 秒，4 步 5 秒。范围 2.5–7 秒。

### 写好的要点
- 标题用动作：✅「点「生成」」「改两句发出」 ❌「生成功能」「智能模块」。
- 最后一步写成「得到结果」，让 ✓ 落在结果上。
- 标题里**别写「第一步」「步骤1」**：序号画面会自动画；而且「第一」会被广告法检查拦下。
- 3 步最好看。

### 示例
```json
{"type": "steps", "dur": 4, "caption": "周五下午，\n{周报自己写好}", "mood": 0,
 "params": {"items": [
   {"title": "连上日历文档", "desc": "授权一次就行", "icon": "calendar"},
   {"title": "点「生成」", "desc": "一分钟出初稿", "icon": "sparkle"},
   {"title": "改两句发出", "desc": "你只管最后把关", "icon": "send"}
 ]}}
```

### 参数速查（自动生成自 steps.spec.json）

时长 2.5–7 秒（默认 4）；字幕 可选；默认情绪 0.2；退场 push。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `items` | 是 | 数组 | 2–4 项 | 步骤，按顺序依次点亮 |
| `items[].title` | 是 | 文字 | ≤8 字 | 步骤标题，≤8 字，动词开头 |
| `items[].desc` |  | 文字 | ≤14 字 | 一句补充，≤14 字 |
| `items[].icon` |  | 文字 | 图标名 | 节点图标（不填就显示序号） |

示例（能直接通过校验）：

```json
{"type": "steps", "dur": 4, "caption": "照常聊天，\n{点一下就有建议}", "mood": 0.2, "params": {"items": [{"title": "打开聊天", "desc": "照常聊天就行", "icon": "chat"}, {"title": "点悬浮球", "desc": "一秒出分析", "icon": "sparkle"}, {"title": "挑一条填入", "desc": "改两个字就能发", "icon": "send"}]}}
```

---

<a id="quicklist"></a>
## quickList 快切列表

3–6 行白卡一拍一行、左右交替飞入；每行落定后右边「盖章」出判定：分数从 0 滚到目标值（可带判词），或一个彩色标签砸下来；左边色条按语气色长满。节奏快，情绪强。

### 什么时候用
- 痛点连击：每行一个具体场景 + 判词（慌 / 费时 / 返工）。字幕直接说这组场景的共同点（如「月底对账，{每一步都在返工}」），别用「这些时刻，你是不是也…」这种万能句（校验会提醒）。
- 一句话一个判定：每行一句原话 + 分数（参考 Jev：随便 5/9 留神）。字幕里写了数量（「这 4 句」）就必须和行数一致。
- 场景罗列：「这些地方都能用」。

### 什么时候别用
- 每条需要一句解释 → 用 features（有 desc）。
- 有先后顺序 → 用 steps。

### 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| items | 是 | 3–6 行 |
| items[].text | 是 | 行文字，**≤10 字**，具体场景或原话，越短越狠 |
| items[].tag | 否 | 判词/标签，**≤4 字**。有 score 时写在数字下面；没 score 时是彩色标签 |
| items[].tone | 否 | 颜色：`bad` 红 / `warn` 橙 / `good` 绿 / `neutral` 灰；不写 = 品牌色 |
| items[].score | 否 | 分数（0–999，可 1 位小数），从 0 滚到这个数 |
| items[].icon | 否 | 行首图标（不写按 tone 自动选）；quote 为 true 时不用 |
| max | 否 | 满分（1–100 的整数）。写了分数显示成「8/9」 |
| quote | 否 | `true` = 每行画成头像 + 灰气泡（列举别人说的话）；默认 = 图标 + 粗字 |
| title | 否 | 列表上方小标题胶囊，**≤8 字**。字幕已经说清就别写 |

字数：汉字算 1，英文字母/数字算半个。超了校验会拦。

### 时长
3–4 行 3 秒；5–6 行 4 秒。范围 2–6 秒。行多、时长短时会自动改成半拍一行。

### 写好的要点
- 每行右边二选一：要么 score（+ tag 当判词），要么只写 tag。同一个列表里别混用。
- 好坏颜色混着排（bad、good 交替）更有节奏。
- 分数别编造成「用户评分」「好评率」这类对外承诺；用于产品自己的判定结果（如危险程度）。

### 示例 1：原话 + 分数
```json
{"type": "quickList", "dur": 3, "caption": "这些话，\n它先帮你{看一眼}", "mood": 0.6,
 "params": {"quote": true, "max": 9, "items": [
   {"text": "随便", "score": 5, "tag": "留神", "tone": "warn"},
   {"text": "我没生气", "score": 8, "tag": "很危险", "tone": "bad"},
   {"text": "你忙你的吧", "score": 7, "tag": "偏危险", "tone": "bad"},
   {"text": "哈哈哈好", "score": 2, "tag": "安全", "tone": "good"}
 ]}}
```

### 示例 2：痛点场景 + 标签
```json
{"type": "quickList", "dur": 3, "caption": "月底对账，\n{每一步都在返工}", "mood": 0.8,
 "params": {"items": [
   {"text": "周五下午才想起", "tag": "慌", "tone": "bad", "icon": "clock"},
   {"text": "翻聊天记录找进度", "tag": "费时", "tone": "warn", "icon": "search"},
   {"text": "写完被说太空", "tag": "返工", "tone": "bad", "icon": "doc"},
   {"text": "格式每次都不一样", "tag": "心累", "tone": "warn", "icon": "chart"}
 ]}}
```

### 参数速查（自动生成自 quickList.spec.json）

时长 2–6 秒（默认 3）；字幕 可选；默认情绪 0.6；退场 fade。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `title` |  | 文字 | ≤8 字 | 列表上方的小标题胶囊，≤8 字（可不写，字幕已经说了就别写） |
| `items` | 是 | 数组 | 3–6 项 | 列表行，每拍弹出一行 |
| `items[].text` | 是 | 文字 | ≤10 字 | 行文字，≤10 字 |
| `items[].tag` |  | 文字 | ≤4 字 | 判词/标签，≤4 字；有 score 时写在数字下面，没有 score 时是彩色标签 |
| `items[].tone` |  | good / warn / bad / neutral |  | 颜色：bad 红 / warn 橙 / good 绿 / neutral 灰；不写 = 品牌色 |
| `items[].icon` |  | 文字 | 图标名 | 行首图标（不填按 tone 自动选；quote 为 true 时不用） |
| `items[].score` |  | 数字 | 0–999 | 分数（可带 1 位小数），从 0 滚动到这个数 |
| `max` |  | 整数 | 1–100 | 分数满分，写了就显示成「分数/满分」，如 9 → 「8/9」 |
| `quote` |  | true/false |  | true = 每行画成头像 + 灰气泡（列举别人说的话）；默认 false = 图标 + 粗字 |

示例（能直接通过校验）：

```json
{"type": "quickList", "dur": 3, "caption": "这些话，\n它先帮你{看一眼}", "mood": 0.6, "params": {"quote": true, "max": 9, "items": [{"text": "随便", "score": 5, "tag": "留神", "tone": "warn"}, {"text": "我没生气", "score": 8, "tag": "很危险", "tone": "bad"}, {"text": "你忙你的吧", "score": 7, "tag": "偏危险", "tone": "bad"}, {"text": "哈哈哈好", "score": 2, "tag": "安全", "tone": "good"}]}}
```

---

<a id="endcard"></a>
## endCard 片尾

logo（meta.logo，没有就用 icon 图标圆盘）→ 产品名 → 两行大字口号 → 1–3 个卖点胶囊 → 可选行动号召。放最后一镜，不退场。

### 参数
| 字段 | 必填 | 说明 |
|---|---|---|
| brand | 是 | 产品名（≤10） |
| slogan | 是 | 口号，≤2 行、每行 ≤9 字，可用 \n 和 1 处 {}，建议第二行整句 {} |
| points | 否 | ≤3 条卖点/承诺/适用范围，每条 ≤14 |
| cta | 否 | 获取方式（≤12）：原样照抄 meta.cta（= 简报「获取方式」原文），简报没写就不放；不许网址/二维码/账号 |
| icon | 否 | 没有 logo 时的品牌图标，默认 sparkle |

**这一镜不写 caption。** mood 建议 0（冷色收尾）。时长 3–5 秒。

### 好例子
```json
{"type": "endCard", "dur": 4, "mood": 0,
 "params": {"brand": "Jev 聊天助手", "slogan": "回消息之前，\n{先看懂对方}",
            "points": ["只给建议，不替你发送", "安卓可用 · 支持多款聊天软件"], "cta": "官网下载安卓版", "icon": "chat"}}
```

### 参数速查（自动生成自 endCard.spec.json）

时长 3–6 秒（默认 4）；字幕 不能写；默认情绪 0；退场 none。

| 字段 | 必填 | 类型 / 可选值 | 限制 | 说明 |
|---|---|---|---|---|
| `brand` | 是 | 文字 | ≤10 字 | 产品名，必须和 meta.product 一字不差 |
| `slogan` | 是 | 文字 | ≤16 字，每行 ≤9 字、≤2 行 | 大字口号：可用 \n 换行（最多 2 行、每行 ≤9 字）和 {} 强调（最多 1 处） |
| `points` |  | 数组 | 0–3 项 | 卖点胶囊，每条 ≤14 字 |
| `cta` |  | 文字 | ≤12 字 | 获取方式：原样照抄 meta.cta（简报原文），没有就不写；不许写网址/二维码/账号 |
| `icon` |  | 文字 | 图标名 | 没有 meta.logo 时代替 logo 的图标，默认 sparkle |

示例（能直接通过校验）：

```json
{"type": "endCard", "dur": 4, "mood": 0, "params": {"brand": "Jev 聊天助手", "slogan": "回消息之前，\n{先看懂对方}", "points": ["只给建议，不替你发送", "安卓可用 · 支持多款聊天软件"], "cta": "官网下载安卓版", "icon": "chat"}}
```
