# 更新日志

[English → CHANGELOG.en.md](CHANGELOG.en.md)

## Unreleased

### 口播配画面
- 积木风改为顶面光滑的方块。全片只用一个圆头、圆球手、身上没有图案的浅蓝灰积木机器人。
- 新增 `scripts/broll/llm_broll.mjs`：便宜模型写 `broll.json`，校验报错原文回喂，最多 3 轮。
- 说明见 `docs/broll.md`。选段方法参考了 vidmuse-video-creator（MIT），是改写，没有拷贝它的文字和素材。

## v0.7.0 · 2026-10-03 · 数据图表镜头、12 套可选配色

老分镜不用改，出来的画面也不变（没写品牌色、或品牌色本来就够清楚时逐像素相同）。本版图表镜头和新配色来自 @opc8838-hub 的 PR #2，谢谢。

### 新增：数据图表镜头 `dataChart`
- 一镜讲清一段数据：标题、一句结论、最多 3 个关键数字、图表、旁注、来源。图表可选条形 `bar`、折线 `line`、点图 `dot`、堆叠 `stacked`、环形 `donut`。
- 数字必须能在引用的 `meta.facts` 原文里找到，来源自动显示在卡片底部；示例数据要标 `meta.demoData` 并在免责声明里写明。
- 校验会拦下画出来会误导人的数据：堆叠图某个类别少一段、两条折线时间点对不上、数据超过 6 条、环图超过 5 类、标签超过 12 字等。
- 深色主题、英文片都能用；数据多时图表自动缩小，不压住关键数字和旁注。
- 用法见 `docs/shots/dataChart.md`。

### 新增：12 套可选配色
- `studio-cream-blue`、`studio-neon`、`studio-pink-green`、`studio-blue-orange`、`studio-red-black`、`studio-purple-yellow`、`studio-cyan`、`studio-lime-purple`、`studio-indigo`、`studio-graphite`、`coral-pop`、`mint-pop`，写在 `meta.theme` 里就能用。
- 新配色的字幕不描边，重点词换颜色；画面下方不铺装饰图案。原来 6 套主题不变，仍是默认。
- 全部主题列表和说明见 `styles/cards/THEMES.md`；新增 `node scripts/test-themes.mjs` 检查新配色的文字对比度。

### 修复
- 渲染锁：上一次出片崩掉留下的锁文件删不掉时（比如被杀毒软件占着），下一次出片会一直卡住不报错；现在到排队时间上限就停下并说明原因。
- 品牌色：`meta.brandColor` 和卡片底色太接近时，画在卡片上的价格、图标、文字会自动调亮或调暗（色相不变），按钮和色块对比不够时同样处理；校验会提示一句。

### DeepSeek Harness 插件 0.5.0
- 随本版同步 skill 快照（0.4.0 没有发到 npm，直接到 0.5.0）。仍只支持 dsh 0.1.x（0.1.7-rc.2 起）。

## v0.6.0 · 2026-10-02 · 写稿更稳：按配方给说明书、通读不过不出片、防剧透更准

老分镜不用改。默认写稿模型从 `deepseek-chat` 换成 `deepseek-flash`（DeepSeek 现在的模型名）。

### 写稿（llm_make）
- 指定配方后，只把那个配方自己的写法说明和样例给模型，不再混进卡片配方的镜头目录和样例；只适用于卡片配方的规则（比如"至少一镜产品演示"）只在卡片配方里出现。没指定配方就用卡片。
- 简报里常见的写法都能认出配方：`配方：quiz`、`- 配方：quiz`、`**配方**：quiz`、标题下一行写、中文名（答题 / 卡片 / 漫游）；写了但认不出时会提示。可用配方从 `styles/*/style.json` 读，不再写死。
- 模型写成了别的配方会被打回重写。
- 通读检查发现的问题改不好就**不出片**（包括改稿改坏后退回原稿、检查接口出错的情况）；想照常出片加 `--skip-readthrough-gate`。接口超时、断线会重试，运行记录 `llm_log.json` 一定会写下来，并记录用的模型。

### 校验
- 答题配方的防剧透：揭晓前配音把正确答案单独说出来会被拦；按写法说明念一遍全部选项不算剧透。

### 安全
- npm 插件打包只复制已提交到 git 的文件，被忽略的文件（比如存 key 的 `.env`）不会进包；打包前自动跑一遍隐私扫描。
- 隐私扫描能认出带短横的 key（如 `sk-cp-…`）、`XXX_API_KEY=值` 写法、JSON 里转义的 Windows 路径和中文路径；禁词不区分大小写。

### 测试
- 所有自带样例（含 `styles/*/examples/`）每次都会被校验；新增写稿脚本的单测（`python scripts/test-llm-make.py`）和隐私扫描的单测；插件测试不再受本机环境变量影响。

### DeepSeek Harness 插件 0.4.0
- 随本版同步 skill 快照。dsh 的 npm 默认版本已经升到 0.2.0-rc.2，插件还没在 0.2 上测过，目前只支持 0.1.x（0.1.7-rc.2 起）。

## v0.5.1 · 2026-09-27 · 配音多两家：阿里云、火山引擎；MiniMax 真人实测

老分镜不用改；v0.5.0 写好的配音分镜也不用改（没写 `voiceId` 的中文片默认音色从新闻女声换成播报男声，想要原来的声音就写上 `"voiceId": "Chinese (Mandarin)_News_Anchor"`）。

### 新增：阿里云、火山引擎配音
- `meta.voice.provider` 多了 `aliyun`（阿里云百炼 CosyVoice）和 `volcengine`（火山引擎豆包语音），和 `minimax` 用法一样：设好环境变量、每镜写 `vo`，出片就带配音、逐字字幕和配乐闪避。
- **阿里云**：`DASHSCOPE_API_KEY`；可选 `DASHSCOPE_WORKSPACE_ID`（百炼业务空间域名）、`DASHSCOPE_REGION`（默认 cn-beijing）、`DASHSCOPE_TTS_URL`（完整接口地址）。走 SSE 流式拿字级时间戳（`word_timestamp_enabled`）。默认模型 `cosyvoice-v3-flash`，默认音色 `longsanshu_v3`（沉稳质感男）/ 英文 `loongabby_v3`。
- **火山引擎**：`VOLCENGINE_TTS_API_KEY`（新版控制台），或旧版 `VOLCENGINE_TTS_APP_ID` + `VOLCENGINE_TTS_ACCESS_TOKEN`；可选 `VOLCENGINE_TTS_BASE_URL`。走 V3 单向流式 SSE，字级时间戳（2.0 用 `enable_subtitle`、1.0 用 `enable_timestamp`，秒换成毫秒）。`meta.voice.model` 填资源 ID，默认 `seed-tts-2.0`；默认音色 `zh_male_guanggaojieshuo_uranus_bigtts`（广告解说）/ 英文 `en_male_alex_uranus_bigtts`。
- `emotion` 只有 MiniMax 认，另外两家写了会提醒并忽略；`--voice-provider` 换到别家时，分镜里的 `voiceId` / `model` / `emotion` 不带过去，用那家的默认值。
- 两家都没加新依赖（Node 自带的 fetch 读 SSE），限流、超时、5xx 按指数退避重试，鉴权和参数错不重试；报错按中英文写清是鉴权、限流、额度还是参数，并且会抹掉密钥。
- DeepSeek Harness 插件：渲染进程额外放行这两家的环境变量（`DASHSCOPE_*` 四个、`VOLCENGINE_TTS_*` 四个），validate、doctor、setup 仍然拿不到。

### 改动
- 中文默认音色改成 MiniMax 播报男声 `Chinese (Mandarin)_Male_Announcer`（在真实接口上核对过）。
- 自定义接口地址（`MINIMAX_BASE_URL` 等）只接受 https，填 http 直接报错，免得 key 明文发出去。
- quiz 配音样例第 4 镜旁白缩短：真人念要 7.08 秒，超过 meaningCard 的上限，第一次实测时被拦下。

### MiniMax 真实 key 实测（v0.5.0 发布后）
- 三种配方的配音样例都用真实接口出了片，逐字时间戳由接口直接返回（精确到每个字），字幕点亮、镜头时长、配乐闪避都正常；三条旁白共计费约 390 字符。
- 真人语速约每秒 4 字，比校验用的每秒 5 字慢；写旁白按每秒 4 字留余量。

### 还没做到的
- 阿里云、火山引擎没用真实 key 实测：按官方文档实现，用照文档造的 SSE 假响应做了单测；时间戳在事件里的嵌套位置、默认音色能不能用，要等第一次真实调用确认（原始时间戳会存成缓存目录里的 `<hash>.subtitle.json`，方便核对）。

### 其他
- 新增 11 条配音单测（两家的请求形状、音频分片拼接、时间戳、报错分类、没 key、http 地址），共 36 条。
- 版本号改为 0.5.1；插件 0.3.0。

## v0.5.0 · 2026-09-27 · 配音：MiniMax 语音 + 逐字字幕

老分镜怎么办：不用改。没写 `meta.voice` 的分镜不配音，镜头时长、字幕、配乐和以前完全一样（和 v0.4.0 对比了四份样例分镜的抽帧，逐像素一致）。

### 新增：配音（可选）
- 分镜里写 `meta.voice`（`provider`：`minimax` / `mock`，可选 `voiceId`、`speed` 0.5–2、`emotion`、`model`、`subtitles`：`karaoke` / `line` / `off`），每镜写一句 `vo`（旁白，可含 `{}` 强调），出片就带配音。写法、推荐音色和字数上限见 `SKILL.md` 的「配音」一节。
- **以声音为时间轴**：`make.mjs` 在渲染前先合成每句旁白、拿到逐字时间，再把有旁白的镜头时长改成「0.15 秒 + 旁白 + 0.35 秒」向上取整拍（不短于这种镜头的最短时长），按新时长再校验一遍后排程；`dur` / `beats` 只对没写 `vo` 的镜头算数。配音结果写进输出目录的 `voice.json`，作为 `props.voice` 传给 Remotion。
- **逐字字幕，三种配方都有**：字幕跟着声音逐字点亮，按声音自动分页；每句起点对齐到整帧，声音和字幕用同一个起点。cards 里写了 `vo`、没写 `caption` 的镜头，字幕由旁白自动生成；hook 仍要写 `caption`（封面标题），`endCard` 只念不出字幕。quiz、journey 在各自的字幕条上显示旁白。
- **背景音乐闪避**：人声处配乐压低约 10 dB（起 0.12 秒、落 0.3 秒），直接做进 `bgm.wav`。
- **缓存与计费提示**：按（提供者、模型、音色、语速、情绪、文字）缓存音频和时间戳，默认在用户目录 `~/.cache/brewreel/tts`，环境变量 `BREWREEL_TTS_CACHE` 可改；改画面、重渲染不再合成、不再计费。报告里写合成几句、缓存命中几句，`manifest.json` 的 `voice.billedCharacters` 是这次计费的字符数。
- **mock 预览**：`mock` 提供者不联网、不要 key，按字数和标点生成柔和的音节脉冲占位音和对齐的时间戳，整条管线没有 key 也能跑通。出片加 `--voice-provider mock` 临时改用占位音（不改分镜），加 `--no-voice` 出无配音版。mock 出的片子只用来看节奏，不能交付。
- **需要 `MINIMAX_API_KEY`**：密钥只从环境变量读（需要时加 `MINIMAX_GROUP_ID`、`MINIMAX_BASE_URL`；国际账号设 `MINIMAX_BASE_URL=https://api.minimax.io`），只放在请求头里发给 MiniMax，不写进分镜、`voice.json`、`manifest.json` 和日志，报错里也会抹掉。没有 key 时 validate 只提醒、不拦。
- **退出码**：旁白比这一镜最长时长还长 → 1（删字或拆镜）；没 key、鉴权失败、限流重试用完、网络不通 → 2。

### 校验
- `meta.voice` 只认上面 6 个字段，值写错会给改法；`vo` 按中文 5 字/秒、英文 3 词/秒估算是否念得完，出片时再按真实配音时长核一遍，超了会停并告诉你第几镜能念多少字。
- `vo` 和字幕走同一套文本检查：广告法极限词、绝对化用语、错别字、数字要能在 `meta.facts` 里找到。
- 写了 `vo` 没写 `meta.voice`、或开了配音却没有一镜写 `vo`，都会提醒；顶层写了 `voice` 会提示挪进 `meta`。
- 新增 6 份校验用例（`tests/validate/voice-*.json`）和配音单测 `scripts/test-tts.mjs`（MiniMax 用录制的假响应，不联网）。

### 样例与无头脚本
- 三种配方各加一份带配音的样例分镜：`styles/cards/examples/voice-reminder.json`、`styles/quiz/examples/software-archive-voice.json`、`styles/journey/examples/software-notes-voice.json`。
- `llm_make.py` 加 `--voice minimax|mock`：让模型写 `meta.voice` 和每镜 `vo`；不给就和以前一样不配音。

### DeepSeek Harness 插件 0.3.0
- 白名单变化：渲染进程（`make.mjs`）额外放行固定的四个环境变量 `MINIMAX_API_KEY`、`MINIMAX_GROUP_ID`、`MINIMAX_BASE_URL`、`BREWREEL_TTS_CACHE`；validate、doctor、setup 进程拿不到，别的 key 仍然一律不给，`envPassthrough` 也加不进来。safety 测试相应补上。

### 还没做到的
- 没有用 MiniMax 真实 key 实测：接口按官方文档实现，只用录制的假响应做了单测；真人音色、计费和字幕时间戳的实际字段还没核对过（解析不出逐字时间时退回句级，再退回按字数估算）。
- 成片音轨整体比画面晚约 42 毫秒（约 1.3 帧），来自 AAC 编码的前置填充，v0.4.0 的配乐就有，一般察觉不到。

### 其他
- 版本号改为 0.5.0；Apache-2.0、合规小字、隐私扫描、作者署名不变。

## v0.4.0 · 2026-09-27 · 更名：精酿 · BrewReel

老分镜怎么办：不用改。风格、字段、镜头和脚本命令都没变，这一版只改名字。要动手的只有 skill 安装目录（可选）和 DeepSeek Harness 插件，见下面「迁移」。

### 新名字
- 项目从 蒸馏视频（Distill Video）/ promo-video-skill 改名为 **精酿 · BrewReel**。口号：「便宜模型，也能酿出好片」（英文 "Brew great promo reels with low-cost models"）。
- 为什么叫精酿：好酒靠配方，原料普通也能酿好。强模型先把一种风格做成「配方」（现成组件 + 校验规则），DeepSeek 这类便宜模型照配方填分镜，出同一水准的片子。文档里的说法随之统一：风格包 = 配方，从参考视频提炼风格 = 调配方，出片 = 开酿。`styles/`、`meta.style`、`distill/` 这些路径和字段不变。
- 官网 brewreel.com 筹备中，上线前暂时打不开。
- GitHub 仓库从 `Finderchangchang/promo-video-skill` 改名为 `Finderchangchang/brewreel`，旧地址自动跳转。已有的 clone 不改也能拉取；想改可以执行 `git remote set-url origin https://github.com/Finderchangchang/brewreel.git`。

### 迁移
- skill 名：SKILL.md 的 `name` 从 `promo-video-skill` 改为 `brewreel`。以 skill 方式安装的，建议把目录改成 `~/.claude/skills/brewreel/` 或 `~/.agents/skills/brewreel/`。
- DeepSeek Harness 插件升到 0.2.0，**有不兼容改动**：
  - 包名 `dsh-distill-video` 改为 `dsh-brewreel`；7 个工具 `distill_video_*` 改为 `brewreel_*`，后缀不变（doctor / setup / catalog / guide / validate / render / verify），**旧工具名不再注册**；注册的 skill 名是 `brewreel`；`cordis.patch.yml` 里插件行的 `id` 从 `distill-video` 改为 `brewreel`。
  - 要你自己改的：审批策略（`tools/pre-execute`）、提示词、脚本里写的旧工具名；profile 里写过插件覆盖的，把 `id` 改成 `brewreel`。
  - 升级步骤：`dsh plugin --profile web remove dsh-distill-video` → 重新安装 `dsh-brewreel` → 重启 profile。
  - 自动兼容的：旧输出目录的标记文件 `.distill-video-out.json` 照样认，原来的输出目录可以接着出片；只有旧运行目录 `~/.dsh/distill-video/` 时直接沿用，已下载的依赖和 Chrome 不用重下（模板包改名不算依赖变化）；旧环境变量 `DISTILL_SYNC_ALLOW_DIRTY` 仍有效，新名是 `BREWREEL_SYNC_ALLOW_DIRTY`。
  - 对照表见插件 README 的「从 dsh-distill-video 升级」。
- 模板包名 `promo-video-template` 改为 `brewreel-template`，依赖没变。

### 其他
- README、SKILL、CONTRIBUTING、`distill/` 文档和插件 README 同步新名字和说法。
- 版本号改为 0.4.0；Apache-2.0、合规小字、隐私扫描、作者署名不变。下面的历史条目保留当时的名字。

## v0.3.0 · 2026-09-27 · DeepSeek Harness 插件，journey 换新结尾

老分镜怎么办：只有 `journey` 要看一眼。`finale` 的 `stats` 上限从 2 改成 1，写了两个数字的分镜会被校验拦下（提示「删到 1 项以内」），删掉一个就行；`bye` 字段保留，写了不报错，但片尾不再有告别气泡。其它风格和字段不变。

### 新增：DeepSeek Harness 插件 `dsh-distill-video`
- 放在 `integrations/deepseek-harness/`，插件版本 0.1.0。需要 dsh 0.1.7-rc.2 或更高的 0.1.x、Node.js 22.19+ 或 24+、pnpm。
- 原生接入：插件把这份 skill 注册进 dsh，模型照 skill 写分镜；另带 7 个工具——`distill_video_catalog` 列风格、行业和配色，`distill_video_guide` 读 skill 与风格 / 行业 / 镜头文档，`distill_video_validate` 校验分镜并给改法，`distill_video_render` 后台出片、报进度，`distill_video_verify` 核对成片是否还对应当前分镜，`distill_video_doctor` 检查环境，`distill_video_setup` 一键装渲染依赖和浏览器（经用户同意后才调）。
- 安全边界：只写会话工作区里的输出目录（默认 `promo/<片名>/`），路径先解析真实路径再比较，符号链接跑不出去；不执行任意命令，只启动 skill 里固定的脚本，全部 `shell: false`；子进程的环境变量走白名单，DeepSeek key 等凭据拿不到。渲染子进程不经过 dsh 的 shell 沙箱，README 里如实写明。
- 安装：从 GitHub 仓库目录装（`dsh plugin --profile web add ./promo-video-skill/integrations/deepseek-harness`），见 README 新增的「在 DeepSeek Harness 里用」一节。npm 包待发布。
- 打包时 `skill/` 快照只取仓库里已提交的文件，`skill/.distill-source.json` 记下 skill 版本、commit 和文件哈希；`scripts/privacy-scan.mjs` 豁免快照里它自己的副本，`.tgz` / `.gz` 按二进制跳过。
- README 中英各加一段「三种用法」（skill / `llm_make.py` 无头脚本 / dsh 插件）。

### `journey` 新结尾「终点检票」
- 替代 v0.2.1 的集章卡（品牌卡式落版）：整片一直在顶部的那张车票滑到画面中间、展开成大票（整条路线已走完）→ 检票钳在票根上打孔 → 车票翻面，背面只印「终点站」、产品名、口号和获取方式，上下居中。没有类别色块、彩纸和告别气泡。
- 数字最多 1 个：印在车票正面、挂在终点旗上方当这一程的累计（如「1200 期节目」），翻面前由出票机从左到右打出，不滚动计数；出处小字在它下面，一条虚线连到终点旗。
- 翻面落定后角色蹲一下，踩滑板冲出画面右侧（机头上仰、带速度线），不再回来；5 秒片尾的最后约 1.9 秒画面上只有车票。
- 光线：去掉结尾那层灰青纱，改成四周压暗（楼和窗灯保留原色）加车票身后一层暖光（取美术色板里已有的窗灯暖黄，没有新增颜色），车票是画面里最亮的东西。
- 时间线：0 秒车票滑下、城市转夜景 → 0.6 秒打出累计 → 1.25 秒打孔 → 1.65 秒翻面 → 2.2 秒口号 → 2.35 秒角色冲出画面；音效相应是滑票 swish、打累计 tick ×2、打孔 tap、翻面 swish、背面落定 ding、冲出画面 whoosh。
- 修复：结尾前压暗后空着的那一段（现在压暗和车票下移同时开始）；翻面侧对镜头那几帧改画一条带描边的纸边，不再空帧；4:5 开场上三分之一拥挤——只对 4:5 调了天空构图（`layout["4:5"].sky`），太阳和云挪到翻牌大字下面，上三分之一只剩免责小字、小引和大字。
- 样例 `content-podcast`、`software-notes` 改成 1 个数字；展示图 `docs/images/style-journey.png` 重做；`originality.md` 记下本版原创性检查结果（和参考色板最小色差 21.6，招牌元素 8/8）和评审记录（混淆度 2）。

### 其他
- 版本号改为 0.3.0；合规小字、隐私扫描、作者署名不变。
## v0.2.1 · 2026-09-26 · 同一类型，不是同一家

为什么改：v0.2.0 的 `quiz` 和 `journey` 跟参考视频的配色、版式过于接近——配色几乎是参考色板原样，信息层版式、招牌细节和固定句式也基本照搬。这一版改成同一类型、但设计是我们自己的：只保留类型骨架（叙事结构、节奏、动效手法、镜头语言、版式原则），皮肤（配色、角色、招牌细节、固定句式、收尾方式）整套重做；并把「再设计 + 原创性检查」写进蒸馏流程，作为贡献新风格的必经步骤。

老分镜怎么办：字段结构不变（`quiz` 只多了可选的 `voice`）。要改的只有两处：写了 `meta.theme` 的换成新主题名（不写的不用改）；`journey` 用到下面六个旧 scene id 的要改名。

### `quiz` 换成「批改纸」皮肤
- 配色：删掉 `blue-lime` / `cream-tomato`，换成 `sage-pine`（默认，灰绿答题纸 + 松绿）、`rice-soy`（餐饮默认，米纸 + 酱色）、`ash-teal`（灰纸 + 深青），共用杏黄马克笔和朱红批改笔。点阵纸背景 + 朱红页边线，卡片小圆角 + 实色硬投影，标签用等宽字，全片左对齐。
- 元件：红笔圈出误解（替代标题旁的问号方块）、答题卡选项 + 秒表倒数、翻正的词条卡（替代满屏主色释义卡）、回放计时签、盖章、印章擦除落到结业卡（不出网址）。讲解人从卡片后探头改成钩子镜卡下旁白左边的圆形讲解小窗（说话人标）；回放后的方章批改在「= 正解」标签上，不盖在媒体卡右下角。纸面在 y1340 以下加了不带字的页脚小物，题号签下移到和顶部合规小字隔开 24px。
- 角色重画：一矮一高——戴耳机的主讲人（懂了 = 耳罩亮起、发出声波）和反戴棒球帽的搭档，衣服用固定角色色板（橙 / 松绿 / 沙 / 杏黄）。
- 固定句式：新增 `phraseTitle.params.voice` 三套口吻（`exam` / `chat` / `show`，中英两版），组件里不再写死任何参考原句；新增 Q14，分镜里抄了同类视频的套话会收到提醒。

### `journey` 换成「旅行文具 + 剪纸分层」皮肤
- 配色：删掉 `day-city` / `mint-town`，换成 `post-green`（默认，邮政绿 + 荧光青柠 + 石墨描边）和 `plum-ticket`（酒红 + 苔绿）；`tokens.json` 里的道具色改成美术配色槽位，不再逐站写死。
- 信息层和收尾：顶部左右胶囊 + 进度点 → 一整条车票（路线、站点、当前站名）；每站的高架广告牌 → 甩进来又「寄出」的航空信封明信片；开场描边大字 → 翻牌站牌；结尾缩进浏览器 + 数据卡 → 停在终点、集章卡逐站盖章、「到站」圆章。
- 城市美术：整套换成剪纸分层（每层纸影、五层色纸天空、剪出的窗洞），街区、天色、吉祥物配色全部重配；描边读主题的 `ink`。
- 笑点库整套换成车站 / 邮路题材，scene id 改名：`crossing` 道口下腰、`postbox` 邮筒贴邮票、`punch` 检票打孔、`booth` 大头贴三连拍、`hitch` 小刺猬搭车、`platform` 夜站台亮灯（替代 `stack` / `launch` / `factory` / `studio` / `observatory` / `neon`）；古城 `gate` 改成木印盖通关文牒、`bridge` 改成锦鲤跃出。霓虹明信片、故障效果、霓虹牌组件、「被熏黑」「螺旋眼」表情删除；起点台改成车站意象；拟声框从尖刺爆炸框改成邮戳形圆齿框。**老分镜里的这六个 scene 要改名**，校验会报出可选值。
- 收尾：数据从「N │ M」横排改成「集章 k/n」小圆牌 + 竖排两行；告别默认「下一班见」；角色落在集章卡右下角。
- 台词：拟声字和气泡台词重写；新增 J18，小引套「跟 X 一口气…」会收到提醒。

### 新增：原创性检查
- `scripts/check-originality.mjs`：对照参考片的 `tokens.json`（放仓库外）算 CIEDE2000 色差——主题有彩色 ≥ 20、背景 ≥ 8、主色 + 强调色不能同时撞上参考的一组、描边不同、没有照搬的颜色；`--signatures` 逐条核对招牌清单在 `styles/<id>/originality.md` 里有没有替换记录；`--extra` 把代码里写死的颜色一起查。
- `distill/` 流程改成六步：拆解（同时列招牌清单）→ 复刻（只在本地）→ **再设计** → 组件化 → 便宜模型测试 → 评审（新增混淆度 1–10，≤ 3 才过）；新增 `distill/prompts/redesign.md`。
- `styles/_template/originality.md`：新风格的原创性记录模板，`gen-styles --new` 自动带上；`quiz`、`journey` 各有一份填好的记录。
- `CONTRIBUTING.md` 的 PR 自查清单加上「原创性检查通过 + originality.md 填完」。
- `tests/originality/`：色差算法（Sharma 2005 标准色对）和判定规则的单元测试。

### 其他
- 合规小字、隐私扫描、作者署名不变；修了一处 `check-i18n` 查出的写死中文。

## v0.2.0 · 2026-09-26 · 三种风格 + 可蒸馏

项目正式定名 **蒸馏视频（Distill Video）**。

### 新增：多风格
- 分镜里写 `meta.style` 选风格，每个风格是一个独立的「风格包」（设计令牌、专属镜头、校验规则、叙事模板、样例）。
- **`quiz` 答题互动**：抛出常见误解 → A/B/C 选择题 → 倒数 3 → 揭晓打勾 → 满屏释义卡 → 小剧场演一遍 → 评论区互动。原创角色一对，没有影视素材时用代码画的「情景小剧场」代替片段。
- **`journey` 角色漫游**：原创吉祥物「橘团」踩悬浮滑板，一镜到底横穿扁平插画城市，一站一个类别，天色从白天走到夜晚，片尾缩进产品界面。现代城市 / 低层街巷 / 古城三种背景，14 种街区。
- 原有风格整理为 `cards`（卡片信息流），老分镜不用改。
- 画幅支持 9:16 和 4:5。

### 新增：开放蒸馏，欢迎二创、三创
- `distill/`：把一支参考视频按「九层」结构化拆解（基本参数、叙事、视觉、镜头、动效、元件、声音、可变槽位、规则），再复刻、组件化、用便宜模型测试、评审修复。每一步的提示词都在 `distill/prompts/`。
- `scripts/extract-frames.mjs`：抽帧、出总览拼图、找切点。
- `styles/_template/`、`scripts/gen-styles.mjs --new <id>`：新风格脚手架。
- `CONTRIBUTING.md`：一创（直接用）、二创（换皮）、三创（蒸新风格）的规则与 PR 自查清单。

### 更稳：出片流程
- 版式出问题（裁切、出安全区、断词、英文片里混进中文、整屏空帧）直接判失败，不交付。
- 每支片写 `manifest.json`，绑定分镜哈希；`--verify` 可核对成片是否还对应当前分镜。
- 渲染排队锁能自动回收，不再卡死；拼图不再依赖系统 ffmpeg。
- 测试产物一律写到仓库外。

### 更严：内容校验
- 效果数字必须有简报来源；"几秒出结果""秒推送"这类说法没有依据会被拦。
- 价格条件（周末价、券后价、附加费、有效期）不许丢；数字的限定语要跟着一起上屏。
- 素材真实性：同一张图不能当前后对比；没登记为商家实拍的图，不许标"实拍""未修图"。
- 答题互动风格：出题前剧透答案会被拦。
- 角色漫游风格：街区道具和题材对不上（例如古城里出现玻璃高楼）会被拦。

### 更好看
- 画面下三分之一不再空着；封面按内容换构图，不同产品不再撞脸。
- 价格卡显示全部套餐项，地图标出每个目的地；没照片时用整卡插画兜底。
- 英文片清掉了组件里写死的中文。

### 其他
- 许可证改为 **Apache-2.0**：可免费商用，再分发须保留 NOTICE 中的署名。

## v0.1.0 · 2026-09-26 · 首个预览版

- 便宜模型只写 `storyboard.json`，Remotion 组件出 1080×1920 竖版宣传片，一条命令出片，带原创配乐和音效。
- 18 个镜头；软件、餐饮、电商实物、成人职业培训、美业、文旅住宿六个行业包，内置广告法与行业合规校验。
- 中英双语文档，支持英文字幕。
