---
name: promo-video-skill
description: 做竖版产品宣传短片（1080x1920，15–45 秒，抖音/视频号/小红书）。用户要做产品宣传片、推广短视频、App 介绍视频、功能演示视频、上新短片、带货片头时使用。支持软件、餐饮、电商实物、教培、美业、文旅住宿六个行业，支持中英双语。你只写一份分镜 JSON（storyboard.json），画面由现成镜头组件画，校验脚本拦规则和行业合规，一条命令出片（带原创配乐和音效）。
license: Apache-2.0
metadata:
  version: 0.1.0
---

# 产品宣传短片（promo-video）

你只做两件事：**挑镜头**、**填文字**。不写代码，不改 `template/`、`scripts/`、`industries/` 里的任何文件，不写坐标、帧数、颜色值。

下文 `<SKILL>` = 本文件所在目录。命令都用 Node 22 / Python 3.10 跑。English speaker or English video needed → read `<SKILL>/SKILL.en.md` instead.

## 流程

1. **定行业和语言**。
   - `meta.industry`：`software`（默认）/ `food`（餐饮）/ `ecommerce`（电商实物）/ `education`（教培）/ `beauty`（美业）/ `travel`（文旅住宿）。选错行业，能用的镜头和合规规则都会不对。
   - `meta.lang`：`zh`（默认）/ `en`。视频要出英文字幕、用户是英文用户，就写 `en`（用法见第 5 步）。
   - 行业不是 software → **先读 `<SKILL>/industries/<industry>/recipe.md`**（英文项目读 `recipe.en.md`）：里面有这个行业推荐的镜头组合、`brief-template.md`（这个行业简报要问哪些栏目）、`test-brief.md`/`expected.md`（合规红线举例）。跳过这一步很容易写出会被拦的内容。
2. **读简报**。按对应 `brief-template.md` 的栏目理解；缺「产品名 / 一句话卖点 / 痛点场景 / 核心动作 / 2–4 个卖点」就先问，别瞎编数据和功能。
   - `meta.product` 照抄简报的产品名，全片（hook 胶囊、片尾 brand）只用这一个名字，片尾 `brand` 必须和它一字不差。
   - `meta.action`：**必填**，一句话「用户做什么 → 产品给出什么」（如「拍小票 → 自动填好金额和分类」），不上画面。演示类镜头（chat/phone/mockApp/photoShot）的画面文字要体现这个动作，校验会核对。
   - 简报「获取方式」有内容 → 原样写进 `meta.cta`，片尾 `cta` 照抄它；简报写「无」→ 两处都不写。**不要自己编**「应用商店搜 XX」。
   - 简报里没有的功能不要写进卖点和片尾。
   - 简报「数字和来源」有内容 → 每条抄进 `meta.facts`，格式是 `[{"id":"f1","text":"原话…"}]`（**不是纯字符串数组**）。画面上任何带单位的数字（时长、百分比、倍数、人数、金额）都要能在这里找到同样的数字，没有来源一律报错，不是提醒；确实没给数据就写定性说法，别编数字。镜头 `params.refs: ["f1"]` 可以把某个说法（如「现做」）和某条 fact 关联起来，给行业规则核对用。
   - **全片同一件事的耗时只用一个数**：counter 写 3 分钟，别处就不能写「秒出」「3 秒」；钩子写「半天」，counter 的旧值也得是半天。校验会拦。`compare` 同一栏的 `stat` 和 `items` 也不能自相矛盾（如左栏又写「5 分钟」又写「三天」）。
   - 想覆盖默认 15–45 秒的总时长范围（如行业推荐结构要 27 秒以上），写 `meta.durationRange: [15, 60]` 这样的两元素数组。
   - 底部需要常驻小字提示（如「限时活动，以团购详情页为准」），写 `meta.notices`：字符串数组，最多 3 条，合并成一行显示在底部。
3. **建目录**：`promo/<片名英文>/`，分镜写在 `promo/<片名英文>/storyboard.json`。用户给的截图/录屏/logo 复制进同一目录。
4. **选主题**（`meta.theme`）：
   - 情感、社交、生活 → `warm-emotion`
   - 开发者、AI、硬核工具 → `tech-dark`
   - 健康、学习、记账、轻工具 → `fresh-light`
   - 办公、B 端、效率 → `business-blue`
   - 节日、促销、上新 → `festival-red`
   - 高端、极简、设计 → `mono-premium`
   有品牌色就写 `meta.brandColor`（#RRGGBB），它只换强调色。
5. **挑 5–9 个镜头**（镜头说明看 `<SKILL>/shots.md`，18 个镜头一览表在最上面）。`hook` 必须第 1 镜（2–3 秒），`endCard` 必须最后 1 镜（4 秒）。
   **必须有一镜演示核心动作**（第 2 步写的 `meta.action`），校验会拦：
   `chat` 写 messages + panel（提问 → 回答）；或 `mockApp` 写 input（用户输入/提问）+ 结果（dashboard 的 stat、editor 的 items、done）；有截图用 `phone`。
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
   - **B 端数据/办公**（报表、会议、CRM）：hook(icon) → phone 截图圈注或 mockApp dashboard 带 input「问一句 → 出数」→ compare 或 meter 讲效果 → steps → endCard；只有简报给了耗时数字才用 counter（那就别再用 quickList）
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
7. **写 `mood`**（0–1）：痛点/紧张 0.8–1，转折 0.5，产品和卖点 0–0.3，片尾 0。背景颜色和配乐都跟着它变。
8. **写 storyboard.json**，格式见文末完整示例。时长用 `dur`（秒），写 0.5 的整数倍。
   **文件必须是 UTF-8 编码**。中文 Windows 默认 GBK：用编辑器/写文件工具直接写 UTF-8；用 PowerShell 就 `[IO.File]::WriteAllText($p, $json, [Text.UTF8Encoding]::new($false))`；用 Python 就 `open(p, "w", encoding="utf-8")`。不要用 `echo >`、`Out-File`（5.1 版）写中文。
   `chat` 的 `panel.replies` 是产品建议**「我」**发给对方的话，站在 me 的立场写（我说要加班，建议回复不能是「别再加班了，陪我」——那是对方的口吻）；有 panel 就别写 `typing`。
9. **校验**，按报错逐条改，直到通过：
   ```
   node <SKILL>/scripts/validate.mjs promo/<片名>/storyboard.json
   ```
   报错格式是「第 N 镜（类型）字段：问题 → 怎么改」，照「怎么改」做。结果分三档：
   - **报错（errors）**：必须改，改不完不出片。
   - **提醒（warnings）**：尽量改（文案质量、结构别太像模板），改不动也能出片，但交付时要能跟用户说清楚为什么没改。
   - **需人工复核（human）**：校验判断不了的（如「这条评价是不是真的一字不改」「这句资历是不是确实出自简报」），**不用改 storyboard**，原样列给用户，让用户自己确认。
10. **出片**（约 2 分钟，会自动生成配乐）：
   ```
   node <SKILL>/scripts/make.mjs promo/<片名>/storyboard.json --out promo/<片名>
   ```
   `--out` 必填（测试时改用 `--round <轮次>`，产物统一放 `tests/<轮次>/<片名>/`，同一轮的几支片子用同一个轮次名，**不要自己按秒生成时间戳目录**）。
   产物：`video.mp4`、`sheet.png`（每秒一帧拼图）、`check/`（第 0 帧 + 每镜结束前的全尺寸帧）、`report.txt`（含文字排版报告：会不会断词、会不会超宽）、`layout.json`。
   只想快速看几帧：加 `--stills 0,3.5,8`（秒），只出单帧，不出整片。
11. **先看 `report.txt` 末尾的「机器自查」「文字排版报告」「布局自查」**（make.mjs 自动做：反斜杠、产品名、获取方式、字幕停留时长、片尾图标和免责小字是否相碰、有没有断词/超宽的行；渲染时量出每个文字块的位置，查文字被卡片裁切、两块字互相压住、字出了 x150–930），有 ✗ 先改（布局 ✗ 通常是某个字段写太多：删条目或缩短文字）；再看 `sheet.png` 和 `check/` 按下面清单自查，有问题改 storyboard.json 回到第 9 步。
12. **交付**：把 `video.mp4` 路径、`sheet.png` 路径交给用户，附上「发布前自查清单」（见下）——第 9 步的「需人工复核」条目原样列进去，逐条让用户确认，不要替用户下判断。

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
- 带单位的数字（时长/百分比/倍数/人数/金额）必须能在 `meta.facts` 里找到同样的数字，没有就是编造，一律报错
- 行业规则三档：**block 一律拦截**（如医美功效宣称、划线价没写依据、真实评价没写月份）；**warn 提醒但不拦**；**human 校验判断不了，交付时列给用户**（见上面的「发布前自查清单」第 1 条）
- 素材路径相对 storyboard.json 所在目录，文件必须存在；截图支持 png/jpg/webp，录屏支持 mp4

## 禁止事项

- 不改 `template/`、`scripts/`、`industries/` 里的任何文件；不写坐标、像素、帧号、颜色值、CSS
- 不编造用户没给的数据和来源；画面上的数字要在 `meta.facts` 里找得到，没有来源就写「示例数据，以实际为准」
- 不出现第三方 App 的名字、logo 或标志色（如某聊天软件的绿色气泡）；称呼用「对方」「同事」「客户」
- 不写真实人名、手机号、账号
- 不用 `bgm` 字段（make.mjs 自动填）
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
| 含平台名「公众号」（提醒） | 产品本身的品类词：加进 `meta.allowWords`；引流：删掉 |
| 缺少必填字段 meta.action | 写一句「用户做什么 → 产品给出什么」 |
| 数字在 meta.facts 里找不到来源 | 简报给了这个数字就原话抄进 `meta.facts`（`{"id":"f1","text":"…"}` 格式）；没给就把具体数字换成定性说法 |
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

- `<SKILL>/examples/jev.json`：C 端情感，software 行业（聊天演示配 2 句字幕 → 仪表 → 快切 → 片尾；获取方式「官网下载安卓版」）
- `<SKILL>/examples/ledger.json`：工具提效，software 行业（痛点快切 → 对比 → mockApp 拍小票出结果 → 数字 → 片尾；简报没给获取方式，片尾不放 cta）
- `<SKILL>/examples/meeting.json`：B 端办公，software 行业（截图圈注 → 模拟界面 → 数字 → 步骤 → 片尾；获取方式「官网申请免费试用」）
- `<SKILL>/examples/en-focus.json`：`meta.lang: "en"` 的英文样例（虚构 App，展示英文字幕怎么写）
- 其他行业（food/ecommerce/education/beauty/travel）的合规样例在 `industries/<industry>/test-brief.md` + `expected.md`：test-brief 是一份示例简报，expected 写清楚照这份简报写的分镜哪些地方会被拦、为什么。开新行业的第一支片子建议先看这两份。

## 完整示例（examples/ledger.json，可直接通过校验）

```json
{
  "meta": {
    "title": "省心记账 宣传片（痛点 → 产品 → 3 卖点 → 片尾）",
    "product": "省心记账",
    "theme": "fresh-light",
    "disclaimer": "演示画面，数据为示例",
    "action": "拍小票 → 自动填好金额和分类",
    "facts": [
      {"id": "f1", "text": "试用用户本月比上月多存下约 1260 元（示例数据）"},
      {"id": "f2", "text": "演示账本示例条目：外卖 ¥860、奶茶咖啡 ¥326、忘关的自动续费 ¥98、深夜打车 ¥410（示例数据）"},
      {"id": "f3", "text": "手动记一笔平均约 5 分钟；用本产品拍照记一笔约 10 秒（示例数据）"},
      {"id": "f4", "text": "演示识别结果：午饭 ¥38.5，本月餐饮预算已用 62%（示例数据）"}
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
        "left": {"title": "手动记账", "items": ["每笔手动输入", "分类全靠猜", "拖到最后就放弃"], "tone": "bad", "icon": "doc", "stat": "5 分钟", "level": 8},
        "right": {"title": "省心记账", "items": ["拍小票自动识别", "自动分好类", "月底一键复盘"], "tone": "good", "icon": "bolt", "stat": "10 秒", "level": 2},
        "meterLabel": "麻烦程度",
        "verdict": "记一笔只要十秒"
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
      "type": "counter",
      "dur": 3,
      "caption": "月底一看，\n{居然还有结余}",
      "mood": 0.1,
      "params": {"to": 1260, "prefix": "¥", "label": "本月比上月多存下", "sub": "示例数据，因人而异", "icon": "money", "tone": "good"}
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
