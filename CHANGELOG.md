# 更新日志

[English → CHANGELOG.en.md](CHANGELOG.en.md)

## v0.11.0 · 2026-10-07 · 剪纸拼贴动效外观 + 可复用动效部件

### 新增
- 口播配画面的动效画面多了「剪纸拼贴」外观，两套配色：`cutpaper-meadow`（灰绿纸底 + 覆盆子红卡片）、`cutpaper-dusk`（灰紫纸底 + 翡翠绿卡片）。纸纹底、无描边的手剪卡片、软投影；说到重点词卡片抛起再落下（带透视倾斜，投影随高度变大变虚），平时轻微浮动不停死；纸屑旋转飞过；相邻两段用同一张卡接力；数字卡翻面换内容；清单、步骤把说过的条目留成小纸签，对比两侧都看得到。不花钱。
- 选外观：`broll.json` 顶层可写 `motionTheme`；`llm_broll.mjs` 和 `talk.mjs` 加 `--motion-look`。不写就和以前一样跟主风格走。
- 可复用动效部件 `template/src/talk/motion/kit/`：纸纹、手剪形状、纸屑、抛起落定、浮动、投影随高度、锚点接力、三色校验。新外观只调用部件，见 [docs/motion-looks.md](docs/motion-looks.md)。
- 调配方（`distill/`）加第 1b 步「第一性原理」：拆完参考片后写清它为什么好看、哪些机制能脱离皮肤复用，产出可复用部件清单。模板在 `distill/prompts/01b-principles.md`。

### 说明
- 剪纸拼贴从一支参考片按调配方流程拆出来：只学骨架（锚点、接力、颗粒、落定、配色结构），配色、形状、句式全部重做，`check-originality` 通过。
- 关键词大字按词断行，不把一个词拆到两行。

## v0.10.0 · 2026-10-06 · 风格工厂：一句话造一个 AI 画面风格

另外：README 首页重排（两种玩法并排、快速开始三步、细节挪进 docs），中英同步。

### 新增：风格工厂

- `node scripts/broll/new-style.mjs`：一句话写一个 AI 画面风格的草稿（`broll/styles/_drafts/<id>/`），出参考图、看图打分、挑图、做一张静态试拍。不加 `--yes` 只打印将要发送的请求。视频试拍要同时加 `--video` 和 `--yes`，真调前打印积分和价目。看图打分只是第一道筛，最后要人看。
- `node scripts/broll/approve-style.mjs <id>`：人看完汇总页之后自己跑，把草稿收进 `broll/styles/<id>/`。AI 助手不许替人运行。做过视频试拍且通过写 `stable`，否则写 `experimental`。
- 下划线开头的风格目录不进风格清单。说明见 [docs/style-factory.md](docs/style-factory.md)。

## v0.9.0 · 2026-10-05 · 只放一段口播，自动配画面

口播配画面（实验）这一版大改：只放一段口播视频就能出片，多了免费的动效画面和几种 AI 画面风格。宣传片的用法和画面都没变。v0.8 写的 `broll.json`（version 1）留着 version 1 照常能跑，已经生成过的片段不会重新花钱；改成 version 2 的话，v2 的提示词和请求都变了，已经生成过的 AI 段会重新生成、重新花钱。

### 新增：一条命令
- `node scripts/talk.mjs <项目目录> --out <仓库外目录>`：转写 → 便宜模型写 `broll.json` → 出片。做过的步骤自动跳过，可以一直重复跑同一条命令。它永远不跑 `approve.mjs`。

### 新增：本地转写
- 项目目录里只放 `talk.mp4` 就行。本机用 SenseVoice 模型（通过 sherpa-onnx 运行）转写，不联网、不花钱。第一次下载约 240MB 模型，按魔搭、HuggingFace、hf-mirror 的顺序试，断点续传，sha256 对不上不收。已有 `talk.srt` 永不覆盖。
- 有 DeepSeek key 时默认校对一遍：模型只交「哪个字改成哪个字」的补丁，脚本按读音规则决定改不改，涉及数字、否定、反义的只提示不改，记录写进 `talk.fixes.txt`。`--no-fix` 关掉。专有名词可以写进 `talk.terms.txt` 或用 `--terms`。
- 写好 `broll.json` 后再拆句、并句，校验会拦下（句子号会错位）。
- 这一期不接云端转写。

### 新增：动效画面
- `broll.json` 里写 `"source": "motion"` 的段是动效画面，五个模板：`keyword` 关键词、`checklist` 清单、`steps` 步骤、`counter` 数字、`compare` 对比。
- 画面按口播框重新排版、填满取景框（让开平台栏、字幕、画中画圆窗之后剩下的那一块），不再是一张小卡片放在一大片空底上：keyword 大字占宽度约八成、长了两行，重点词扫一道马克笔并轻轻放大一下；清单、步骤、数字、对比的卡片和字都明显加大。
- 配色和质感跟着主风格走，和 AI 段接得上（风格包 `style.json` 的 `motionTheme` 改成 `{"look": …, 色号…}`）：积木风是暖木色桌面、米白卡片、浅蓝灰和暖橙的木积木，黏土定格暖粉彩，分层纸艺米白纸加几层彩纸，手绘线稿（实验）白纸墨线。背景有很淡的纹理和慢慢漂的形状；只加形状和纹理，字仍然只来自原话。
- 摆法：动效段默认 `split`（横版 `pip`），说话的人留在画面里；`keyword` 写 `full` 会被拦，`full` 只给 3 条以上的 `checklist` / `steps`，报错里给改法。`llm_broll` 的提示和示例、`SKILL-broll` 的选择表跟着改了。
- 进出场不再交叉淡化（会透出两张脸）：真人只有一个画面，`split` 收到下方、卡片从上面推下来，`pip` 收进右下圆窗，出场倒放；split 的分界线加一道主题色细线和软阴影，真人裁切往下挪一点。动效段的圆窗放大到约 250 像素（720 宽），脸放大一点，加卡片色描边和阴影。
- 动效画面再打磨：pip / full 按竖长的框排，keyword 的重点词单独一行撑满宽度、框高时拆两行放大，清单和步骤行高、字号跟着框变大；没说到的条目不再画虚线、灰条骨架；装饰只放在字和字幕外扩一圈以外，不从圆窗后面露出来；keyword 段字幕和大字重复时只留多出来的字；对比的结论放大、旧卡片不透明并划掉；有旧价的钱数不滚动、直接翻牌，彩纸只从卡片后面往外飞；打勾徽章按风格取色，ink 只用黑白黄；分层纸艺、黏土定格的背景加纸纤维、指纹和斑驳，编码后也看得出。
- 卡片上的字必须是原句里连着的几个字，脚本逐字核对；摘词前面的否定字要一起摘；数字只能经 `counter` 的 `say` / `from`，而且要出自原句。
- 不花钱、不进账本、不审片、不加「AI 生成画面」标。有转写缓存时按真实的逐字时刻出字。
- v2 示例在 `examples/talk/motion`。

### 新增：AI 画面多风格
- 新风格：`wood-blocks`（新的默认，对外仍叫「积木风」，换成木头积木）、`clay-stopmotion` 黏土定格、`paper-layers` 分层纸艺三种正式风格，参考图随仓库发布。`ink-sketch` 手绘线稿是实验风格：两轮出的角色图机器人头顶都有天线，和共用角色对不上，这一版没发参考图，只能用 `placeholder` 占位预览，也不能当副风格。原来的 `brick-diorama` 改标成实验风格、不是默认，校验会提醒它会出凸点；老项目照常能用。
- 全片共用一个机器人，形状和色号写在 `broll/character.json`，风格只决定它用什么材质。
- `broll.json` 升到 version 2：顶层 `style` 加可选的副风格 `styleAlt` 和主线 `thread`；AI 段加 `look`（主 / 副风格）和 `link`（接着上一段的结束画面）。一部片最多两种风格，副风格不超过 AI 段的一半，第一段用主风格。
- 提示词 v2：只写想看到的东西，拼好后检查有没有会把画面带偏的词，查到就不提交。
- 出参考图：`make-style-refs.mjs --style <风格 id>`。风格没有参考图时，真生成会在提交前停下（退出码 2，没花钱），并给出换风格、改成动效、先用占位三种改法。

### 改动
- `llm_broll`：默认最多写 2 段 AI 画面（`--max-ai` 可改），其余优先用动效画面或留脸；写 version 2；提示词带选择表、风格清单和每个模板的例子；没有 `talk.srt` 时先自动转写。
- `validate`：加 `--max-ai`；报数的句子选了 AI 画面会报错，并给出 `counter` 的写法。
- 原片自动转码：手机常见的 HEVC、可变帧率、单声道、旋转标记、奇数宽高、非整数帧率，出片前转成 H.264 恒定帧率存在项目目录的 `.brewreel/`，原片不动。
- 费用显示：估价同时给出 AI 视频一共多少秒。订阅套餐的 MiniMax key（`sk-cp-` 开头）不能按量付费，H3 视频扣积分，估价多显示一句「约 N 积分」（768P 按约 70 积分/秒估，以 MiniMax 后台为准）。预算闸门照旧按元拦。
- 审片页：动效段单独一行，列出屏幕上的字；AI 段标风格名；最上面并排放每段 AI 画面的中间帧。批准记录只绑定 AI 画面的部分，只改动效段不用重审，v0.8 的批准记录照样认。
- `manifest.json` 记下字幕来源（自动转写 / 改过 / 自己给的）、转写模型、原片有没有转码，每段记来源和风格。
- 依赖：`template` 新增 `sherpa-onnx-node` 1.13.8 和 `pinyin-pro`。从 v0.8 升级要在 `template` 目录重新 `npm install`。口播配画面要完整版 ffmpeg：安装命令加了 `pip install imageio-ffmpeg`（Remotion 自带的精简版缺滤镜），`talk.mjs` 和 `make-talk` 一开头就查，缺了退出码 2。
- `talk.mjs`：停下时把下一条命令完整印出来，去掉只该生效一次的 `--rewrite-broll`、`--only`、`--force-redo`；`--rewrite-broll` 不能和 `--yes` 一起用。`--rewrite-broll` 通过校验才替换 `broll.json`，旧的备份成 `broll.json.bak-<时间>`。便宜模型的接口调用失败（断网、key 不对、余额不足）单独给退出码 4 和一句人话。
- 出片：原片、字幕、计划、生成片和合成代码都没变时，不重新渲染。
- 转写校对拿不准、还没人核对的字，不会被做成动效卡片；命令跑完会再提醒一次。

### 修复
- `pip` 圆窗的直径和边距原来写死像素，小尺寸的片子圆窗显得过大；现在按画面大小缩放。
- `split` 的字幕原来只留一行高度，两行字幕会往下压到脸；现在按行数往上留高。
- `pip` 段的字幕在圆窗左边放不下时会剩一个字单独成行；现在稍长的行缩一点字号，还放不下就整段挪到圆窗上方。
- 同一个输出目录先占位、再真生成：占位片的账本条目不再算花过钱，第一次真生成不占重做次数；漏写 `--provider minimax-h3` 再跑，不会再把付费片段换成占位片（停下，退出码 2）。
- MiniMax H3 的请求体不再带 `extra`：2026-10-05 真接口实测 H3 不收这个字段（400，2013「param 'extra' incompatible with model MiniMax-H3」），带上就提交失败。风格包里的 `promptExpansion` 目前只校验写法，不发送；请求体和 v0.8 一样。
- 转写校对改「他」「它」不稳定：同一段口播跑两次，一次把指软件的「他」改成了「它」，一次一处都没改。现在代词单独成一类：字幕里每一个「他」「她」逐个列给模型，模型要说出它指的是什么、是不是人；指东西的改成「它」，指人的不动，`talk.fixes.txt` 写明指的是什么。同一次请求里做完，不多调一次接口。改成「他」「她」的补丁只提示不改。原来提示词里的格式示例和真实口播重样，模型会照抄，换成了编的内容。用同一段原片真调 DeepSeek 连跑 3 次，两处「他」都改对。
- 提交前就被接口拒绝的段（参数错误这类，账本记 `submit_failed`）：当场和再跑时都写明「这次没有生成、没有扣费」，并印出只重做这一段的完整命令（带 `--only`；从 `talk.mjs` 跑的就是 `talk.mjs` 那一条）。仍然不自动重做。

### 已知限制
- 手绘线稿 `ink-sketch` 是实验风格，参考图还没出，用它只能 `placeholder` 预览，真生成会在提交前停下。
- 积木风（木积木）用真接口生成过一段，8 帧里没有凸点；黏土定格、分层纸艺还没真生成过。生成画面仍可能偶尔出现带圆点的积木，发布前要在审片页看过。
- 每段 AI 画面单独生成，共用角色和 `link` 能让几段更接近，但不保证完全一致。
- 动效卡片的字照抄转写，转写错的字会上屏。
- 英文转写只用合成语音测过；macOS 上的转写没有实测。
- DeepSeek Harness 插件这一版仍没有接口播配画面。

## v0.8.0 · 2026-10-05 · 口播配画面（实验）

给已有的真人口播加积木风解释画面。宣传片的用法和画面都没变。

### 新增：口播配画面（实验）
- 一个项目目录放口播 `talk.mp4` 和字幕 `talk.srt`，模型只写 `broll.json`：哪几句配画面、画面里是什么、动作和结束画面。时间、提示词、费用都由脚本算。
- 三种放法：`full` 盖满画面，`pip` 真人缩成右下角圆窗，`split` 竖版上下分屏。字幕可选：原片已烧（`burned`）、由我们加（`add`）、不要（`none`）。
- 画面来源：`placeholder` 占位片（不花钱，先看节奏）；`local` 自己的录屏或实拍；`minimax-h3` 用 MiniMax H3 生成（768P 约 0.5 元/秒，以 MiniMax 官网为准）。
- 花钱前先估价，超预算或没加 `--yes` 就停下；中断后重跑只查询、不重复提交；每段最多重做 2 次。
- 生成的画面要人在审片页看过、运行 `approve.mjs` 才能出正式片，AI 助手不许替人批准。画面出现时角落标「AI 生成画面」。
- 便宜模型直接写：`node scripts/broll/llm_broll.mjs <项目目录>`，校验报错原文回喂，最多 3 轮。用 deepseek-flash 实测 3 次：2 次一轮通过，1 次第 3 轮通过。
- 风格目前只有积木风一种：顶面光滑的方块，一个圆头、圆球手的浅蓝灰积木机器人。字段里出现品牌和商标词会被校验拦下。
- 说明见 `docs/broll.md`，给 AI 助手的说明见 `broll/SKILL-broll.md`。选段方法参考了 vidmuse-video-creator（MIT），是改写，没有拷贝它的文字和素材。

### 已知限制
- 实验功能：只在合成的假口播和几段真实生成片上测过，还没有用真人口播出过完整样片。
- 每段画面独立生成，人物造型和颜色会有出入；生成画面里偶尔还会出现带凸点或小字的积木，发布前务必在审片页看过。
- 生成画面里的文字不可靠，要准确的文字请用宣传片的版式镜头。
- 没有自动转写，字幕要自己从剪映等软件导出。
- DeepSeek Harness 插件这一版没有接这个能力，npm 上仍是 `dsh-brewreel@0.5.0`。

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
