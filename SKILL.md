---
name: brewreel
description: 精酿 · BrewReel：做竖版产品宣传短片（1080x1920，15–45 秒，抖音/视频号/小红书）。用户要做产品宣传片、推广短视频、App 介绍视频、功能演示视频、上新短片、带货片头时使用。支持软件、餐饮、电商实物、教培、美业、文旅住宿六个行业，支持中英双语。你只写一份分镜 JSON（storyboard.json），画面由现成镜头组件画，校验脚本拦规则和行业合规，一条命令出片（带原创配乐和音效，可选 MiniMax / 阿里云 / 火山引擎配音）。
license: Apache-2.0
metadata:
  version: 0.9.0
---

# 精酿 · BrewReel：产品宣传短片

你只做两件事：**挑镜头**、**填文字**。不写代码，不改 `template/`、`scripts/`、`industries/` 里的任何文件，不写坐标、帧数、颜色值。

下文 `<SKILL>` = 本文件所在目录。命令都用 Node 22 / Python 3.10 跑。English speaker or English video needed → read `<SKILL>/SKILL.en.md` instead.

## 流程

0. **选风格**（`meta.style`，不写就是 `cards`）。先看产品属于哪一类，再读 `<SKILL>/styles/<风格>/STYLE.md` 和 `recipes.md`：

   | 风格 | 状态 | 适合什么产品 |
   |---|---|---|
   | `cards` 卡片信息流（默认） | 可用 | 单一卖点、要讲流程、要演示界面、实物门店；六个行业都支持 |
   | `quiz` 答题互动 | 可用 | 有常见误解、能出一道选择题的产品（外语短语、功能被误会、菜名名不副实、反常识知识点）。三套模板见 `styles/quiz/recipes.md`，样例在 `styles/quiz/examples/`。`meta.theme` 可选 `sage-pine` / `rice-soy` / `ash-teal`（不写：餐饮用 `rice-soy`，其余用 `sage-pine`）；`phraseTitle.params.voice` 选口吻 `exam` / `chat` / `show`（不写按行业选），题号签、回放标题、印章、评论提示这些固定句式跟着口吻走，也可以在镜头里直接写字覆盖；提问句和评论提示自己写，别抄同类视频的套话（Q14 会提醒）；clip 台词不许说出答案 |
   | `journey` 角色漫游 | 可用 | 内容多、类别清楚的产品（内容平台、功能多的软件、多门店多品类、课程体系、一条游线）。一站一个类别 / 功能 / 景点；三套模板和每拍字段见 `styles/journey/recipes.md`，样例在 `styles/journey/examples/`。默认 `meta.aspect: "4:5"`，也可 `9:16`；背景 `opening.params.skyline` 选 `modern` / `street` / `oldtown`（古城古镇题材必须 oldtown），街区道具要和内容对得上；开场小引写路线或看点（如「这趟车停 5 站」），别套「跟 X 一口气…」（J18 会提醒）；配色 `post-green`（默认）/ `plum-ticket`；价格、时间、总量数字只能抄 `meta.facts` |

   - 拿不准就用 `cards`，不用写 `meta.style`。开发中的风格校验会拦。
   - `meta.aspect`：`9:16`（默认，1080x1920）或 `4:5`（1080x1350）。`cards` 只支持 9:16，不用写。
   - 下面第 1–12 步是 `cards` 的写法。用别的风格时，镜头和字段以那个风格的 `recipes.md` 为准；行业合规、`meta.facts`、禁止事项、出片命令照旧。
   - **风格镜头的字段一律写在 `params` 里**，镜头顶层只有 `type`、`dur`、`params`。例（journey）：`{"type": "district", "dur": 4, "params": {"category": "预算提醒", "title": "月底前三天，提醒你收手", "scene": "phone"}}`。`meta.theme` 是 cards 的配色，别的风格按它自己的 recipes 写或不写；`cta` 这类可选字段不需要就整个删掉，不要写空字符串。
1. **定行业和语言**。
   - `meta.industry`：`software`（默认）/ `food`（餐饮）/ `ecommerce`（电商实物）/ `education`（教培）/ `beauty`（美业）/ `travel`（文旅住宿）。选错行业，能用的镜头和合规规则都会不对。
   - `meta.lang`：`zh`（默认）/ `en`。视频要出英文字幕、用户是英文用户，就写 `en`（用法见第 5 步）。
   - 行业不是 software → **先读 `<SKILL>/industries/<industry>/recipe.md`**（英文项目读 `recipe.en.md`）：里面有这个行业推荐的镜头组合、`brief-template.md`（这个行业简报要问哪些栏目）、`test-brief.md`/`expected.md`（合规红线举例）。跳过这一步很容易写出会被拦的内容。
2. **读简报**。按对应 `brief-template.md` 的栏目理解；缺「产品名 / 一句话卖点 / 痛点场景 / 核心动作 / 2–4 个卖点」就先问，别瞎编数据和功能。
   - `meta.product` 照抄简报的产品名，全片（hook 胶囊、片尾 brand）只用这一个名字，片尾 `brand` 必须和它一字不差。
   - `meta.action`：**必填**，一句话「用户做什么 → 产品给出什么」（如「拍小票 → 自动填好金额和分类」），不上画面。演示类镜头（chat/phone/mockApp/photoShot）的画面文字要体现这个动作，校验会核对。
   - 简报「获取方式」有内容 → 原样写进 `meta.cta`，片尾 `cta` 照抄它；简报写「无」→ 两处都不写。**不要自己编**「应用商店搜 XX」。
   - 简报里没有的功能不要写进卖点和片尾。
   - 简报「数字和来源」有内容 → 每条抄进 `meta.facts`，格式是 `[{"id":"f1","text":"原话…","source":"来源"}]`（**不是纯字符串数组**）：
     - `source` **必填**：照抄简报写的来源（「2026-09 价目表」「后台统计至 8 月」）；简报没写来源就写 `"简报未注明来源"`。不许自己编来源，也不许自己编 fact。
     - `quote` 可选：简报里的那句原话，逐字照抄。
     - 画面上任何带单位的数字（时长、百分比、倍数、人数、金额）都要能在 facts 里找到同样的数字，没有一律报错；确实没给数据就写定性说法，别编数字。
     - 镜头 `params.refs: ["f1"]` 把某个说法（如「现做」、compare 的 stat/level、meter 的读数）和某条 fact 关联起来。
   - **示例数据和效果说法分开**（校验会拦）：
     - text 或 source 里带「示例 / 演示 / 模拟 / 虚构」的 fact 是示例数据，**不能给效果说法作依据**。效果说法 = compare 的 stat/level、counter 的数、meter 往「变好」方向摆、字幕和卖点里的百分比/倍数、「省 / 缩短 / 提升」带的时长和金额。
     - 界面里只能用示例数字时（简报没给真数据）：meta 写 `"demoData": true`，`meta.disclaimer` 写「演示画面，数据为示例」。示例数字只能出现在 mockApp/phone/chat/priceCard 等演示界面、价格条款和 dataChart 里。
     - 简报没给效果数据 → compare 只比做法（items 写「少 3 步」「不用切窗口」），不写 stat 数字和 level；不用 counter。
     - 速度说法（「几秒」「秒出」「即刻」「瞬间」「零等待」「instantly」）必须有一条真实 fact 带秒级耗时，否则报错。「马上试试」这类行动号召不算。
   - **限定语跟着数字走**（校验会拦）：屏幕上的数字对上某条 fact 时，fact 里跟着它的条件要在同一镜（字幕、卡片或底部提示条）写出来：
     - 日期范围照抄：fact 写「周日至周四 328 元」，画面就写「周日至周四」，不能改成「平日」「周一到周四」。
     - 券后 / 满减 / 会员价、「N 元起」、附加费金额、活动时间、预约、节假日不可用，一个都不能丢。例：「券后29.9元」不能写成「到手价29.9元」。
     - fact 只说「保温 6 小时」，画面不能写「全天保温」；fact 写了固定退房时间，画面不能写「灵活退房」。
   - **全片同一件事的耗时只用一个数**：counter 写 3 分钟，别处就不能写「秒出」「3 秒」；钩子写「半天」，counter 的旧值也得是半天。校验会拦。`compare` 同一栏的 `stat` 和 `items` 也不能自相矛盾（如左栏又写「5 分钟」又写「三天」）。
   - 想覆盖默认 15–45 秒的总时长范围（如行业推荐结构要 27 秒以上），写 `meta.durationRange: [15, 60]` 这样的两元素数组。
   - 底部需要常驻小字提示（如「限时活动，以团购详情页为准」），写 `meta.notices`：字符串数组，最多 3 条，合并成一行显示在底部。notices 别和 `meta.disclaimer` 说同一句话（都写「演示」就算重复，校验会拦）。
3. **建目录，登记素材**：`promo/<片名英文>/`，分镜写在 `promo/<片名英文>/storyboard.json`。用户给的截图/录屏/logo/照片复制进同一目录。
   - 用到照片的镜头（`photoShot`、`beforeAfter`、`storeCard.photo`）：每个文件都要登记在 `meta.assets`：
     `"assets": [{"src": "photos/dish.jpg", "source": "merchant"}]`。`source` 只能是 `merchant`（商家实拍）/ `illustration`（插画、示意图）/ `screenshot`（软件截图）。
   - 截图不能放进 photoShot；插画不能标「实拍」；不到 2KB、短边不到 300px、仓库自带示例图、`_dev/` 下的文件都算占位图，会被拦。
   - `beforeAfter` 的两张必须是**同一位顾客的两张不同照片**：都登记 `merchant`，`kind` 分别写 `customer-before` / `customer-after`，`pair` 写同一个值（如 `"A"`）。同一张图、改名复制的图都会被拦。
   - **商家没有可用照片**：photoShot 的 media 写 `{"source": "drawn", "tag": "示意", "illust": "<插画 id>"}` 用插画兜底，校验会放行并列进「需人工复核」。不写「实拍」「顾客授权」，不设 consent。商家给了照片却一张没用，才会被拦。
4. **选主题**（`meta.theme`）：
   - 情感、社交、生活 → `warm-emotion`
   - 开发者、AI、硬核工具 → `tech-dark`
   - 健康、学习、记账、轻工具 → `fresh-light`
   - 办公、B 端、效率 → `business-blue`
   - 节日、促销、上新 → `festival-red`
   - 高端、极简、设计 → `mono-premium`
   上面 6 套是默认老主题，字幕仍是描边大字。另有 12 套可选新配色，名单见 `<SKILL>/styles/cards/THEMES.md`。
   有品牌色就写 `meta.brandColor`（#RRGGBB），它只换强调色。
5. **挑 5–9 个镜头**（镜头说明看 `<SKILL>/shots.md`，19 个镜头一览表在最上面；用 quiz / journey 时镜头换成那个风格的，字段照第 0 步写进 `params`）。`hook` 必须第 1 镜（2–3 秒），`endCard` 必须最后 1 镜（4 秒）。
   **必须有一镜演示核心动作**（第 2 步写的 `meta.action`），按行业用不同的镜头，校验会拦：
   - **software、education（界面类）**：`chat` 写 messages + panel（提问 → 回答）；或 `mockApp` 写 input（用户输入/提问）+ 结果（dashboard 的 stat、editor 的 items、done）；有截图用 `phone`。
     - 核心动作是发消息/回复的产品 → 必须有 chat（或 phone 真截图）；不是聊天类的产品 → 别用 chat 演。
     - `mockApp kind:"form"` 只给本来就是填表的产品，别拿表单顶替核心动作。
     - mockApp dashboard 的 `input` 和 `stat.label` 要问答对得上（问「上月广州新增多少商户」，stat 就写「上月广州新增商户」）；items 别写「数据」「信息」「内容」这种占位词。
   - **food、ecommerce、beauty、travel（实物/门店类）**：**不许用 mockApp 编 App 界面**（点单页、预订页都不行）。全片至少一镜 `photoShot`（实拍或插画兜底）或 `beforeAfter`，再配 steps / priceCard 讲清楚。
   `meta.industry` 决定哪些镜头能用（见 `industries/<industry>/rules.json` 的 `enabledShots`，或直接看 recipe.md），选了不开放的镜头校验会报错。7 个行业镜头（software 默认不开）：
   - `photoShot` 实拍照片/短视频（菜品、商品、作品、房间、公区、后厨）
   - `priceCard` 价目表；`storeCard` 门店/地图/预订；`reviewCard` 真实顾客评价（原文摘录，不能改写得更夸张）
   - `factSheet` 参数表/开箱清单/课程大纲/考试信息/色卡；`credCard` 资历/荣誉卡
   - `beforeAfter` 前后对比滑块（**只有美业开放**，要 `consent:true` + `retouched:false`）
   中间按产品类型选镜头，**别套固定模板**，`features` 卖点卡不是必选。两条硬要求（校验会提醒）：
   - **中段至少 1 镜来自 {compare, steps, phone, meter}**；
   - **quickList 和 counter 不同时用**（两个都用，片子就长成 hook → quickList → mockApp → counter → endCard 那个人人都一样的模板）。
   software 行业可选的组合（挑一种，再按产品改；其他行业直接照 `industries/<industry>/recipe.md` 的推荐结构改）：
   - **C 端情感/社交**（聊天、情感、陪伴）：hook(bubble) → chat 演示（写成 2–3 句字幕）→ meter 或 compare 讲「这句话的分量」→ quickList 快切 → endCard
   - **工具提效**（写作、记账、发布、剪辑）：hook(stat) → compare 讲「以前 vs 现在」→ mockApp editor/form 演示「输入 → 结果」→ steps 讲怎么用 → endCard；或 hook → quickList 讲麻烦 → mockApp → steps → endCard
   - **B 端数据/办公**（报表、会议、CRM）：hook(icon 或 split) → phone 截图圈注或 mockApp dashboard 带 input「问一句 → 出数」→ compare 讲做法差别 → steps → endCard；只有简报给了耗时数字才用 counter（那就别再用 quickList）
   - hook 的 `visual` 同一批片子别总用一种：一条扎心消息用 bubble，有真数字用 stat，说一处风景/一样东西用 illust，痛点 vs 产品用 split。compare 写了 level 时，`tone: good` 那栏要在这把尺子上占优（写 `higherIs` 说清越高越好还是越差）。
   总时长 20–30 秒最好（允许 15–45，或 `meta.durationRange` 的自定义范围）。同一种镜头别连着用。相邻两镜 mood 差别别超过 0.5（中间插一镜过渡），否则背景会硬切。
6. **写字幕**（每镜的 `caption`）：一镜一句话，抖音式大字，**说给观众听，不描述画面怎么动**（❌「卡片一张张出，讲它能做什么」这是镜头说明，不是字幕）。
   - 中文：最多 2 行，用 `\n` 换行；每行 ≤12 个汉字（字母数字算半个）。`meta.lang: "en"` 时英文字幕按拉丁字符数折算（约中文限制的 1.8 倍），具体数字看 `docs/shots/<type>.en.md`
   - `{}` 包住最关键的 2–5 个字，变强调色；每条最多 1 处
   - hook 的 caption = 封面标题，写用户的痛点或反常识问题
   - endCard 不写 caption，口号写在 `params.slogan`
   - **同一句字幕最多停 5 秒**。超过 5 秒的镜头（如 8–10 秒的 chat），caption 写成 2–3 句的数组，按拍平分这一镜：
     `"caption": ["先别急着发，\n对方要的是{你的在乎}", "挑一条填进输入框，\n发不发{你决定}"]`
   - 字幕要讲用户的处境或产品带来的变化，和前后镜头接得上；画面怎么动是组件的事，不用写。字幕里用「」引的词，必须在这一镜或前面镜头的画面上出现过（校验会拦）
   - 字幕里写了数量（「这 4 句」「三条回复」），必须和这一镜的条目数一致（校验会拦）
   - 别用万能句（「三件事，{它…}」「这三步」「这些时刻，你是不是也…」），也别照抄 examples、shots.md、spec 里的字幕和参数，校验会提醒并给一个可以直接填空的句型；样例只用来看格式
   - 不要叠字（「排期排期」）、不要删字凑字数（「卡脖子」写成「卡脖」）、不要写错别字（「登陆」应为「登录」，除非真是登陆舰/月球），字数超了整句换说法
   - 别写绝对化用语（「全搞定」「一清二楚」「安全无忧」「100%」）：产品很难兑现，校验会提醒，换成有分寸的说法
   - 换行只写一个反斜杠 `\n`；字幕里要用引号就写「」，不要写英文双引号 `"`
   - 条目（items、points）开头不要自己写 ✓ • · - 「1.」：组件会画图标和序号。断行别让最后一行只剩一个字或一个词（「复制粘贴排版全\n乱」）；英文别断在 your / the / to 这类虚词后面
7. **写 `mood`**（0–1）：痛点/紧张 0.8–1，转折 0.5，产品和卖点 0–0.3，片尾 0。背景颜色和配乐都跟着它变。
8. **写 storyboard.json**，格式见文末完整示例。时长用 `dur`（秒），写 0.5 的整数倍。
   **文件必须是 UTF-8 编码**。中文 Windows 默认 GBK：用编辑器/写文件工具直接写 UTF-8；用 PowerShell 就 `[IO.File]::WriteAllText($p, $json, [Text.UTF8Encoding]::new($false))`；用 Python 就 `open(p, "w", encoding="utf-8")`。不要用 `echo >`、`Out-File`（5.1 版）写中文。
   `chat` 的 `panel.replies` 是产品建议**「我」**发给对方的话，站在 me 的立场写（我说要加班，建议回复不能是「别再加班了，陪我」——那是对方的口吻）；有 panel 就别写 `typing`。
9. **校验**，按报错逐条改，直到通过。简报是文件时加 `--brief`，校验会核对 facts 里的数字和 quote 是不是真在简报里：
   ```
   node <SKILL>/scripts/validate.mjs promo/<片名>/storyboard.json --brief promo/<片名>/brief.md
   ```
   报错格式是「第 N 镜（类型）字段：问题 → 怎么改」，照「怎么改」做。结果分三档：
   - **报错（errors）**：必须改，改不完不出片。
   - **提醒（warnings）**：尽量改（文案质量、结构别太像模板），改不动也能出片，但交付时要能跟用户说清楚为什么没改。
   - **需人工复核（human）**：校验判断不了的（如「这条评价是不是真的一字不改」「这句资历是不是确实出自简报」），**不用改 storyboard**，原样列给用户，让用户自己确认。
10. **出片**（2–4 分钟，会自动生成配乐；别的片子在渲染时会排队，每 15 秒打印一次排队情况）：
   ```
   node <SKILL>/scripts/make.mjs promo/<片名>/storyboard.json --out promo/<片名> --brief promo/<片名>/brief.md
   ```
   - `--out` 必填。测试时改用 `--round <轮次>`：产物放到**仓库外**的 `promo-video-skill-tests/<轮次>/<片名>/`（和仓库同级），同一轮的几支片子用同一个轮次名，**不要自己按秒生成时间戳目录**，也不要把测试产物写进仓库。`--out` 落在仓库里（`promo/` 除外）时 make 会直接退出（退出码 2）；测试用 `--round`，或给仓库外的绝对路径。
   - **make 没结束不许收工**：排队加渲染可能超过你的单条命令时限。超时就把 make 放后台跑，每 30 秒左右看一次输出目录里的 `manifest.json`，直到 `status` 出现（`delivered` 才算成）。没看到 `交付：` 那一行之前，不许写交付报告、不许结束。
   - 产物：`video.mp4`、`sheet.png`（每秒一帧拼图）、`check/`（第 0 帧 + 每镜结束前的全尺寸帧）、`report.txt`、`layout.json`、`manifest.json`（分镜和成片的 sha256、时长、各项检查结论）。开跑时会先清掉目录里上一次的这些产物。
   - 只想快速看几帧：加 `--stills 0,3.5,8`（秒），只出单帧，不出整片（不是交付）。
   - 写了 `meta.voice`（配音）：make 会先合成旁白、按声音改写镜头时长，见下文「配音」。没有这家的 key 时加 `--voice-provider mock` 先看节奏（占位音，不能交付），或加 `--no-voice` 出无配音版。
   - **只认最后一行**：成功时 make 最后一行是 `交付：<mp4 路径>`，交给用户的路径**只能抄这一行**。没有这一行就是失败，不许把别的 mp4 当成片。
   - 退出码：0 可交付 / 1 校验没过 / 2 参数错 / 3 版式或汉字自查有 ✗（成片改名 `video.rejected.mp4`，只给人看哪里坏了）/ 4 渲染失败或时长不对 / 5 排队超时 / 6 内部错误 / 130 被中断。
11. **看 `report.txt`**：「机器自查」「文字排版报告」「布局自查」里**有一个 ✗ 就不能交付**（make 会返回 3）。布局自查在渲染后量每个文字块：被卡片裁切、两块字互相压住、关键文字出了 x180–900、英文片画面上出现汉字（每半拍抽一帧查）。✗ 通常是某个字段写太多：删条目或缩短文字，改完回到第 9 步。全是 ✓ 之后再看 `sheet.png` 和 `check/`，按下面清单自查。
12. **交付**：交付前可以跑一次 `node <SKILL>/scripts/make.mjs promo/<片名>/storyboard.json --out promo/<片名> --verify`，确认成片还对应当前分镜（改过分镜会报「成片和分镜不一致，请重跑 make」）。把 make 最后一行的 mp4 路径、`sheet.png` 路径交给用户，附上「发布前自查清单」（见下）——第 9 步的「需人工复核」条目原样列进去，逐条让用户确认，不要替用户下判断。

## 配音（可选）

用户要旁白 / 配音 / 口播时才开；不写 `meta.voice` 就是无配音片，和以前完全一样。开了之后**声音就是时间轴**：make 先合成每句旁白、拿到逐字时间，再把写了 `vo` 的镜头时长改成「0.15 秒 + 旁白 + 0.35 秒」向上取整拍（不短于这种镜头的最短时长），你写的 `dur` / `beats` 只对没写 `vo` 的镜头算数；字幕跟着声音逐字点亮，配乐在人声处自动压低约 10 dB。

1. **`meta.voice`**（只能写这 6 个字段，多写报错）：
   | 字段 | 写法 |
   |---|---|
   | `provider` | 必填。`minimax` / `aliyun` / `volcengine` = 真人感配音（各要自己的环境变量，见下表）；`mock` = 不联网的占位音，只用来听节奏。用户没指定就写 `minimax` |
   | `voiceId` | 音色，不写用这家的默认（下表）。音色 id 各家不通用，换 provider 要一起换 |
   | `speed` | 0.5–2，默认 1。广告旁白 1–1.15；念不完就删字或拆镜，别靠调快硬塞 |
   | `emotion` | **只有 minimax 认**：`calm` / `fluent` / `happy` / `sad` / `angry` / `fearful` / `disgusted` / `surprised` / `whisper`。不写用音色默认；广告旁白建议 `calm` 或 `fluent`。aliyun / volcengine 写了会被忽略 |
   | `model` | 一般不写（用这家的默认，见下表）。volcengine 这里填资源 ID，音色要和它对上 |
   | `subtitles` | `karaoke`（默认，逐字点亮）/ `line`（整句出现）/ `off`（只念不出旁白字幕） |
2. **每镜的 `vo`**（这一镜要念的一句话）：
   - **口语化**：说给人听的短句，主语清楚，像跟朋友介绍；不念画面上的清单，不说「如图所示」「下面我们来看」。
   - **每镜一句**，讲一件事，不换行（字幕会按声音自动分页）。不是每镜都要写：没写 `vo` 的镜头按 `dur` 播，配乐照常。
   - **字数跟着时长走**：中文按每秒 4–5 字算，一句最多 ≈（这种镜头的最长秒数 − 0.5）× 4.5 字。cards 常用上限：hook（最长 4 秒）≈ 15 字、compare / steps / features（7 秒）≈ 29 字、mockApp / phone（8 秒）≈ 33 字、endCard（6 秒）≈ 24 字；quiz / journey 见各自的 `recipes.md`。推荐一句 8–20 字。英文按每秒 2.5 词算。校验按中文 5 字/秒、英文 3 词/秒拦，出片时按真实配音时长再核一遍，超了会停并告诉你第几镜能念多少字。
   - **数字要有依据**：`vo` 和字幕走同一套检查——带单位的数字要能在 `meta.facts` 里找到，广告法极限词、绝对化用语、错别字、速度说法照样拦。念出来的数字和画面上的保持一致。
   - `{}` 强调：和字幕一样，每句最多 1 处（24 字以内），字幕上变强调色。
   - **字幕谁来出**：cards 里写了 `vo`、没写 `caption` 的镜头，字幕由 `vo` 自动生成（逐字点亮）；写了 `caption` 的镜头照旧显示 `caption`、旁白只念——**hook 必须写 `caption`**（它是封面标题）；`endCard` 只念不出字幕。quiz / journey 在自己的字幕条上显示旁白。
   - 片尾那句带上产品名（和 `meta.product` 一字不差）。
   **三家怎么选**（都按字符计费、都能给逐字时间戳；以各家控制台为准，第一次用先试听）：

   | provider | 要设的环境变量 | 默认模型 | 中文默认音色 | 英文默认音色 | 实测 |
   |---|---|---|---|---|---|
   | `minimax` | `MINIMAX_API_KEY`（可选 `MINIMAX_GROUP_ID`、`MINIMAX_BASE_URL`） | `speech-2.8-hd` | `Chinese (Mandarin)_Male_Announcer`（播报男声） | `English_expressive_narrator` | 已用真实 key 出片 |
   | `aliyun`（阿里云百炼 CosyVoice） | `DASHSCOPE_API_KEY`（可选 `DASHSCOPE_WORKSPACE_ID`、`DASHSCOPE_REGION`、`DASHSCOPE_TTS_URL`） | `cosyvoice-v3-flash` | `longsanshu_v3`（沉稳质感男） | `loongabby_v3` | 未实测 |
   | `volcengine`（火山引擎豆包语音） | `VOLCENGINE_TTS_API_KEY`，或旧版 `VOLCENGINE_TTS_APP_ID` + `VOLCENGINE_TTS_ACCESS_TOKEN`（可选 `VOLCENGINE_TTS_BASE_URL`） | `seed-tts-2.0` | `zh_male_guanggaojieshuo_uranus_bigtts`（广告解说） | `en_male_alex_uranus_bigtts` | 未实测 |

   「未实测」= 按官方文档接入、用假响应测过，还没用真实 key 出过片；第一次用出了问题，报错里会写是鉴权、限流还是参数，按提示改或换 minimax。
3. **推荐音色**：
   - **minimax**（MiniMax 系统音色）：
   - `Chinese (Mandarin)_Male_Announcer`（默认）：播报男声，稳重清楚，适合大多数产品片
   - `Chinese (Mandarin)_News_Anchor`：新闻女声，稳重播报，适合 B 端、办公、工具
   - `female-shaonv`：年轻女声，适合 C 端生活、情感、轻工具
   - `male-qn-qingse`：年轻男声，口语感强，适合答题互动、种草
   - `presenter_female`：女主持，适合讲解、教培
   - 英文片（`meta.lang: "en"`）：`English_expressive_narrator`（默认）；英文片最好写明 `voiceId`
   - **aliyun**：`longsanshu_v3`（默认，沉稳质感男）、`longshu_v3`（沉稳青年男）、`longxiaoxia_v3`（沉稳权威女）、`longxiaochun_v3`（知性积极女）；英文 `loongabby_v3`
   - **volcengine**（2.0 音色，`model` 用默认 `seed-tts-2.0`）：`zh_male_guanggaojieshuo_uranus_bigtts`（默认，广告解说）、`zh_male_cixingjieshuonan_uranus_bigtts`（磁性解说男）、`zh_female_tianmeixiaoyuan_uranus_bigtts`（甜美女声）、`zh_female_zhixingnv_uranus_bigtts`（知性女声）；英文 `en_male_alex_uranus_bigtts`
4. **没有 key 怎么预览**：出片加 `--voice-provider mock`（不联网的占位音，时间轴、逐字字幕、配乐压低都照常，不用改分镜）；或加 `--no-voice` 出无配音版。**mock 出的片子只是看节奏，不能当成片交付**——交付时要明说「这是占位音，设好 key 重跑才是真人配音」。没有 key 时 validate 只提醒、不拦。
5. **费用**：三家都按字符计费（旁白全文，价格看各家官网）。同一句（提供者、模型、音色、语速、情绪、文字都一样）合成过一次就缓存在用户目录 `~/.cache/brewreel/tts`（环境变量 `BREWREEL_TTS_CACHE` 可改），改画面、改字幕、重渲染都不再计费；改了 `vo` 或音色才会重新合成。`manifest.json` 的 `voice.billedCharacters` 是这一次计费的字符数。
6. **密钥**：只从环境变量读（每家的变量名见上表；自定义接口地址只接受 https）。不要把 key 写进分镜、简报、命令行参数或任何文件，也不要打印出来。
7. **配音相关退出码**：旁白比这一镜最长时长还长 → 1（删字或拆镜）；没 key、鉴权失败、限流重试用完、网络不通 → 2（让用户设 key 或稍后重跑；先看效果用 `--voice-provider mock`）。

## 自查清单（看拼图，逐条对照画面写结论，不要直接打勾）

- 第 0 帧就有大标题 + 主视觉，不是空白或半截；封面上没有 `\n`、反斜杠这类怪字符
- 每镜都有一个会动的主角（指针、数字、卡片、聊天气泡），不是一张静图；不是「图片来回缩放」凑数
- 字幕没盖住主体，没有被截断，没有断词（一个词被拆到两行）；字幕和画面讲的是同一件事，前后镜头的故事接得上
- 字幕是说给观众的话，不是镜头说明（不会出现「卡片一张张出」这种描述画面动作的句子）
- 核心动作真的演出来了（看得到「输入/提问 → 结果」），不是只有一张现成的面板
- 背景颜色随情绪变：痛点偏红，卖点和片尾偏冷
- 片尾产品名和 meta.product 一致；获取方式是简报原文或不放；没有网址、二维码
- **数字要自洽**：对比里的前后数字自己算一遍（30 分钟对 5 秒，结论就别写「省出 25 分钟」）；画面里的数字能在 `meta.facts` 里找到来源
- 没有错别字、没有为了凑字数删字造出来的词（「自动上传」不能写成「自传」）、没有绝对化用语
- 行业镜头用对了地方：`beforeAfter` 只在美业；`reviewCard` 的引用是原文，没有改写得更夸张

## 发布前自查清单（交付时附给用户，不是自己看完就算）

1. **「需人工复核」条目全部列出**：第 9 步校验结果里的 `human` 列表，原样抄给用户，别替用户判断「应该没问题」。常见的有：`reviewCard`/`credCard` 的引用是否和简报原文一字不差、平台规则口径是否有更新、行业资质是否齐全。
2. `meta.industry` 选对了吗（不对的话开放的镜头和合规规则都会错）。
3. 涉及真人出镜、顾客评价、前后对比照片的，是否已经书面取得当事人同意（`consent`/`retouched` 这类字段只是校验要求写，真实取得同意是用户的责任，不是校验能替你核实的）。
4. 视频要发的平台（抖音/视频号/小红书/海外）是否和 `meta.platform` 一致，对应的平台专属规则（如购物车不能挂价格字幕）是否已经确认。
5. 中英双语项目：英文字幕是否找母语者看过一遍，机器只查了字数和敏感词，看不出别扭的措辞。

## 硬规则（校验会拦）

- 第 1 镜必须是 `hook`；`endCard` 放最后
- 总时长 15–45 秒（或 `meta.durationRange` 的自定义范围）；每种镜头有自己的时长范围（见 shots.md）
- 每个字段有字数上限，超了就**整句换个更短的说法**；不要删掉词里的字凑数，也不要换成英文（`meta.lang: "en"` 时英文有自己的字符数上限，见对应字段的说明）
- 只能用 shots.md 里列出的字段、可选值和图标名；拼错或多写字段会报错
- 至少一镜演示 `meta.action`（见第 5 步）；同一句字幕最多停 5 秒
- 片尾 `brand` = `meta.product`；片尾 `cta` = `meta.cta`（简报没给就都不写）
- 画面文字里不能有反斜杠（JSON 里写成 `\\n` 会原样显示在画面上）
- 画面里不许出现：网址、二维码、「扫码」、@账号、「XX号：名字」、「关注/搜 XX 号」。产品本身的品类词（如做「公众号」排版的工具）不算引流：把词加进 `meta.allowWords`，**不要为了过校验改产品名**
- 不许用《广告法》极限词：最、第一、唯一、首个、首选、独家、顶级、绝对、100%、全网、遥遥领先……（「最近/最后/第一步」这类不算）。确有依据才写进 `meta.allowWords`
- 带单位的数字（时长/百分比/倍数/人数/金额）必须能在 `meta.facts` 里找到同样的数字，没有就是编造，一律报错；每条 fact 必须有 `source`
- 示例数据（fact 里写了「示例/演示/模拟/虚构」）不能撑效果说法；界面里用示例数字要写 `meta.demoData: true` + disclaimer 带「演示/示例」
- 数字对上 fact 时，fact 里的日期范围、券后条件、「起」、附加费金额、活动时间要一起上屏（同一镜或 notices）
- 照片类镜头用到的文件要在 `meta.assets` 登记来源；beforeAfter 前后必须是同一位顾客的两张不同的商家实拍
- 实物/门店行业（food/ecommerce/beauty/travel）不许用 mockApp；software/education 的核心动作要在界面里演（chat/phone/mockApp）
- 行业规则三档：**block 一律拦截**（如医美功效宣称、划线价没写依据、真实评价没写月份）；**warn 提醒但不拦**；**human 校验判断不了，交付时列给用户**（见上面的「发布前自查清单」第 1 条）
- 素材路径相对 storyboard.json 所在目录，文件必须存在；截图支持 png/jpg/webp，录屏支持 mp4

## 禁止事项

- 不改 `template/`、`scripts/`、`industries/` 里的任何文件；不写坐标、像素、帧号、颜色值、CSS
- 不编造用户没给的数据和来源；画面上的数字要在 `meta.facts` 里找得到。没有真数据：效果类镜头（counter、带数字的 compare、「变好」的 meter）不用，演示界面里的示例数字用 `demoData` 声明
- 不把同一张图当前后对比，不把插画、截图说成实拍
- 不出现第三方 App 的名字、logo 或标志色（如某聊天软件的绿色气泡）；称呼用「对方」「同事」「客户」
- 不写真实人名、手机号、账号
- 不用 `bgm` 字段（make.mjs 自动填）；顶层也不写 `voice`（配音设置写 `meta.voice`，每镜念的话写 `vo`）
- 不自己判断行业合规的灰区问题（如「这句算不算医疗用语」）：校验拦了就改，校验放行但你拿不准，写进「需人工复核」交给用户，不要自己下结论说「应该没事」

## 常见错误与改法

| 报错 | 改法 |
|---|---|
| 第 N 行 … 字，每行最多 12 字 | 缩短，或在语义停顿处用 `\n` 断成两行 |
| 用了 2 处 {} 强调 | 只留最关键的一处 |
| {} 没有成对 | 每个 `{` 都要有 `}`，不要跨行 |
| 含《广告法》极限词「最」 | 换成可证实的说法：「最快」→「3 秒出结果」 |
| 第 1 镜必须是 hook | 在最前面加 hook |
| endCard 这一镜不能写字幕 | 删掉 caption，大字写在 `params.slogan` |
| 多了一个不认识的字段 | 看报错里的「可用字段」，改拼写（如 mockApp 用 `kind` 不是 `variant`） |
| 没有叫「xx」的图标 | 从 shots.md 顶部的图标清单里选 |
| 总时长 … 要在 15–45 秒之间 | 加/删镜头，或改 `dur` |
| 素材文件找不到 | 检查路径，相对 storyboard.json 所在目录 |
| JSON 解析失败：第 N 行 | 看那一行：漏逗号、多了结尾逗号、字幕里写了英文双引号（改成「」） |
| 这一句要在屏幕上停 N 秒 | caption 写成 2–3 句的数组，或把这一镜拆成两镜 |
| 全片没有一镜在演示核心动作 | 加 chat（提问 → panel 回答）或 mockApp（input + 结果） |
| 片尾产品名和 meta.product 不一致 | brand 改成和 meta.product 一字不差 |
| 写了 cta，但 meta.cta 是空的 | 简报有获取方式就写进 meta.cta 再照抄；没有就删掉 cta |
| 里有字面的 \n | JSON 里换行只写一个反斜杠 |
| vo：旁白 N 字，这一镜最长 M 秒，要每秒念 X 字才念得完 | 删字，或把这句拆到两镜（每镜一句）；别靠调快 speed |
| 配音失败：旁白念完要 N 秒，超过这一镜最长 M 秒 | 按提示的字数缩短，或拆镜 |
| 当前环境没有 MINIMAX_API_KEY / DASHSCOPE_API_KEY / VOLCENGINE_TTS_API_KEY（提醒） | 让用户设好对应的环境变量再出片；先看节奏加 `--voice-provider mock` |
| 配音设置要写在 meta.voice 里 | 顶层的 `voice` 挪进 `meta`，每镜要念的话写 `vo` |
| 含平台名「公众号」（提醒） | 产品本身的品类词：加进 `meta.allowWords`；引流：删掉 |
| 缺少必填字段 meta.action | 写一句「用户做什么 → 产品给出什么」 |
| 数字在 meta.facts 里找不到来源 | 简报给了这个数字就原话抄进 `meta.facts`（`{"id":"f1","text":"…","source":"…"}` 格式）；没给就把具体数字换成定性说法 |
| meta.facts[N].source：缺少 source | 照抄简报写的来源；简报没写就写 `"简报未注明来源"` |
| 来自标了「示例/演示」的 fact，但没声明这是演示数据 | meta 写 `"demoData": true`，disclaimer 写「演示画面，数据为示例」 |
| 只在你自己标了「示例/演示」的 fact 里有 | 这是效果说法，示例数据撑不住：删掉数字，compare 只比做法；counter 换成 steps 或 compare |
| level（8 对 2）…meta.facts 里没有这个分数 | 删掉两栏的 level 和 meterLabel，差别写进 items |
| 刻度方向反了 | 让 `tone: good` 那栏在这把尺子上占优，或写 `higherIs` / 换 meterLabel 的说法 |
| 读数 N 没有依据 | 产品演示里给出的判断 → `demoData: true`；效果/评分 → 数字抄进 facts 并写 refs，没有就删掉这一镜 |
| 限定语丢了：没写 facts 里跟着它的「周日至周四」 | 把 fact 里的日期范围/条件原样写进同一镜（字幕、标题或卡片），别改写成「平日」「周末」 |
| 说 29.9 元，但简报里这个价要满足条件才有 | 同一句写清条件，如「领券后29.9元」；放不下就别在这里报价 |
| 是实物/门店行业，mockApp 是编出来的 App 界面 | 删掉 mockApp，用 photoShot（实拍或插画兜底）+ steps 演核心动作 |
| 素材没登记 / 前后两张是同一个文件 | 在 `meta.assets` 登记每个文件的来源；前后对比换成同一位顾客的两张不同照片，没有就改用 steps |
| 「现做」类说法需要依据 | 给这一镜写 `refs` 指向简报里的那条 fact；这一镜没有 refs 字段就删掉这类说法 |
| 字幕含镜头说明词（如「卡片一张张出」） | 这是说给观众听的字幕，不是给剪辑的说明；换成用户视角的一句话 |
| 「登陆」是错别字，应为「登录」 | 改成「登录」（「登陆舰/登陆月球」这类不算） |
| 「一清二楚」是绝对化承诺 | 换成有分寸的说法，如「关键信息看得到」 |
| 「XX」行业不开放镜头「YY」 | 换一个这个行业开放的镜头，或检查 `meta.industry` 是不是选错了 |
| [B-xxx] 命中行业合规规则 | 报错信息里的「怎么改」照做；确有依据的极限词才考虑 `meta.allowWords`（只对 warn 级有效，block 级必须删） |

## 没有真截图时

优先用 `mockApp` 镜头（它会动）。如果一定要演「手机里点这里」，先把 mockApp 渲成一张示意截图再给 `phone` 用：
```
cd <SKILL>/template
npx remotion still src/index.ts Screen <分镜目录绝对路径>/screen.png --frame=145 --props=<分镜目录绝对路径>/screen-props.json
```
`screen-props.json` 写 `{"type":"mockApp","theme":"<主题>","dur":5,"params":{...mockApp 的 params...}}`，参考 `<SKILL>/examples/_src/screen-props.json`。然后 phone 镜头写 `"src": "screen.png"`，并在 `meta.disclaimer` 写「演示画面，内容为模拟」。

## 更多样例（结构各不相同，照着「产品类型」挑，别照抄字幕）

9 份样例都能直接通过校验并出片，产品和数据都是虚构的：
- `<SKILL>/examples/jev.json`：C 端情感，software（聊天演示配 2 句字幕 → 对比 → 仪表 → 快切 → 片尾；仪表读数是演示判断，写了 `demoData`）
- `<SKILL>/examples/ledger.json`：工具提效，software（痛点快切 → 只比做法的对比 → mockApp 拍小票出结果 → 预算读数 → 片尾；没有真实效果数据，所以不用 counter）
- `<SKILL>/examples/meeting.json`：B 端办公，software（截图圈注 → 待办列表 → 前后对比 → 步骤 → 片尾；获取方式「官网申请免费试用」）
- `<SKILL>/examples/en-focus.json`：`meta.lang: "en"` 的英文样例
- `<SKILL>/examples/food.json`：餐饮上新（插画兜底的 photoShot → 到店三步 → 甜度读数有 fact 撑 → 活动价 → 片尾）
- `<SKILL>/examples/ecommerce.json`：电商实物（分屏钩子 → 新旧对比 → 商家实测数字 → 券后价写清条件 → 片尾）
- `<SKILL>/examples/education.json`：教培（服务条款 → 课程大纲 → AI 演示 → 讲师 → 价格）
- `<SKILL>/examples/beauty.json`：美业，没有实拍照片时怎么拍（插画 + 步骤 + 答疑 + 价目表）
- `<SKILL>/examples/travel.json`：文旅住宿（插画钩子 → 看房 → 地图 → 价格按 facts 原样写日期范围）
- 配音样例（每镜一句 `vo`，`provider` 写的是 `minimax`；没有 key 时出片加 `--voice-provider mock`，或把 provider 改成 `mock` 预览）：`<SKILL>/styles/cards/examples/voice-reminder.json`（cards）、`<SKILL>/styles/quiz/examples/software-archive-voice.json`（quiz）、`<SKILL>/styles/journey/examples/software-notes-voice.json`（journey）
- 每个行业的合规反例在 `industries/<industry>/test-brief.md` + `expected.md`：test-brief 是一份示例简报，expected 写清楚照这份简报写的分镜哪些地方会被拦、为什么。开新行业的第一支片子建议先看这两份。

## 完整示例（examples/ledger.json，可直接通过校验）

```json
{
  "meta": {
    "title": "省心记账 宣传片（痛点 → 产品 → 3 卖点 → 片尾）",
    "product": "省心记账",
    "theme": "fresh-light",
    "disclaimer": "演示画面，数据为示例",
    "demoData": true,
    "action": "拍小票 → 自动填好金额和分类",
    "facts": [
      {"id": "f1", "text": "演示账本示例条目：外卖 ¥860、奶茶咖啡 ¥326、忘关的自动续费 ¥98、深夜打车 ¥410（示例数据）", "source": "虚构产品的示例数据"},
      {"id": "f2", "text": "演示识别结果：午饭 ¥38.5，本月餐饮预算已用 62%（示例数据）", "source": "虚构产品的示例数据"}
    ]
  },
  "shots": [
    {
      "type": "hook",
      "dur": 2.5,
      "caption": "工资刚到手，\n月底又{见底了}",
      "mood": 0.85,
      "params": {"visual": "stat", "text": "¥ 0.00", "sub": "这个月花哪了", "badge": "拍张小票就记好", "tone": "bad"}
    },
    {
      "type": "quickList",
      "dur": 3.5,
      "caption": "钱花哪了，\n却{一笔都想不起}",
      "mood": 0.8,
      "params": {
        "title": "本月去向不明",
        "items": [
          {"text": "外卖", "tag": "¥860", "tone": "bad", "icon": "bell"},
          {"text": "奶茶咖啡", "tag": "¥326", "tone": "warn", "icon": "heart"},
          {"text": "忘关的自动续费", "tag": "¥98", "tone": "bad", "icon": "calendar"},
          {"text": "深夜打车", "tag": "¥410", "tone": "warn", "icon": "clock"}
        ]
      }
    },
    {
      "type": "compare",
      "dur": 4.5,
      "caption": "记账这件事，\n{别再靠毅力}",
      "mood": 0.45,
      "params": {
        "mode": "lr",
        "left": {"title": "手动记账", "items": ["每笔手动输入", "分类全靠猜", "拖到最后就放弃"], "tone": "bad", "icon": "doc", "stat": "全靠手打"},
        "right": {"title": "省心记账", "items": ["拍小票自动识别", "自动分好类", "月底一键复盘"], "tone": "good", "icon": "bolt", "stat": "拍一下"},
        "verdict": "记账不用再硬撑"
      }
    },
    {
      "type": "mockApp",
      "dur": 4.5,
      "caption": "拍一下小票，\n{金额分类都填好}",
      "mood": 0.25,
      "params": {
        "kind": "editor",
        "title": "记一笔",
        "source": "示意数据，非真实用户账单",
        "input": "拍照：午饭小票",
        "button": "识别",
        "items": [
          {"text": "午饭 ¥38.5"},
          {"text": "商家：楼下面馆"},
          {"text": "分类：餐饮（自动）"},
          {"text": "本月餐饮已用 62%"}
        ],
        "highlight": 3,
        "done": "已记好"
      },
      "note": "核心动作演示：用户拍小票 → 产品给出金额、商家、分类"
    },
    {
      "type": "meter",
      "dur": 3,
      "caption": "预算快花完，\n{它先提醒你}",
      "mood": 0.35,
      "params": {"value": 62, "max": 100, "label": "餐饮预算已用", "unit": "%", "style": "ring", "higherIs": "bad", "word": "留神", "note": "超过八成会弹提醒"},
      "note": "单个读数（演示账本里的预算进度），不是效果对比；meta.demoData 已声明"
    },
    {
      "type": "endCard",
      "dur": 4,
      "mood": 0,
      "params": {
        "brand": "省心记账",
        "slogan": "花出去的每一笔，\n{心里都有数}",
        "points": ["拍小票自动记账", "账本只存在你手机里"],
        "icon": "money"
      }
    }
  ]
}
```

## 口播配画面

用户给的是一段真人口播（`talk.mp4`，`talk.srt` 可选，没有就脚本本地转写），要在讲解的句子上加解释画面时，不要写宣传片分镜。改读 `<SKILL>/broll/SKILL-broll.md`，只写 `broll.json`；也可以直接让用户跑 `node scripts/talk.mjs <项目目录> --out <仓库外目录>` 一条命令做完。画面分免费的动效画面和花钱的 AI 画面，时间、费用和合成由脚本做。
