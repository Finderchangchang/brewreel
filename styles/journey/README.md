# journey · 角色漫游

状态：stable。吉祥物踩悬浮滑板一镜到底穿过插画城市，一个街区一个内容类别：顶部一张车票标着路线和当前站，每站甩来一张航空信封边的明信片写代表内容，开场是翻牌站牌大字，天色从白天走到夜晚，到终点这张车票滑到画面中间、检票打孔、翻面露出产品名。皮肤（配色、信息层、收尾、句式）是本项目原创，和参考片的区分见 `originality.md`。默认 4:5，也支持 9:16。背景三选一：现代城市 / 低层街巷 / 古城（白墙黛瓦、石桥河道）；14 种街区（道口、邮筒、检票口、大头贴、搭车站、夜站台、手机、住家、咖啡、集市、城门、石桥、茶馆、灯会），按内容挑，每站一个车站 / 邮路题材的小笑点。适合内容多、类别清楚的产品（内容平台、多功能软件、多门店多品类、课程体系、一条游线）。

| 文件 | 内容 |
|---|---|
| `STYLE.md` / `STYLE.en.md` | 九层规格（拆解要点 + 实现数值） |
| `recipes.md` | 三套叙事模板（栏目巡游 / 功能巡游 / 游线）、每拍字段和字数、街区类型怎么选 |
| `rules.json` | 声明式规则：时长、镜头数、必有镜头、顺序 |
| `originality.md` | 原创性口径：骨架保留什么、皮肤换了什么（逐条对照表）、配色 ΔE 数值 |
| `checks.mjs` | 跨字段规则 J1–J18（街区数、相邻类型、类别不重复、片尾照抄 meta、数据 / 价格 / 时间有出处、钩子数字有依据、夜景街放最后、街区配得上背景、古城题材用古城背景、类别名别截断、钩子别照搬、长标题加停顿、片尾要有数字或获取方式、提示条日期有出处、小引别套「跟 X 一口气…」） |
| `examples/` | `content-podcast.json`（4:5，5 站，街巷背景）、`software-notes.json`（9:16，6 站，现代城市）、`travel-town.json`（9:16，文旅 5 站，古城背景） |
| 代码 | `template/src/styles/journey/`：`film.tsx`（整片渲染器）、`art/`（吉祥物和横版城市）、`parts/`（世界剧本、道具、界面元件、片尾、角色接入层）、`shots/`（opening / district / finale 的 spec 和音效）、`tokens.json`、`style.json` |

二创换皮：只改 `tokens.json`——`themes`（UI 和落版配色：`post-green` 默认、`plum-ticket` 示范；新主题的有彩色要和参考色板拉开 ΔE2000 ≥ 20，见 `originality.md`）、`art`（城市街区、角色、滑板的颜色，键见 `art/README.md`）、`scenes.*`（道具配色槽位、笑点时刻、默认台词）、`type` 字号、`motion` 时长。换角色改 `parts/rider.tsx` 的接入（接口见文件顶部注释）。加一种街区：`tokens.json` 的 `scenes` 加一项（写清 `fits` 能配哪些背景、夜景街区加 `night: true`）+ `art/` 里画一个近景街区（`art/palette.ts` 的 `DISTRICT_KINDS` / `DISTRICT` 加一项，组件登记进 `DISTRICT_NEAR`）+ `parts/plan.ts` 的 `ART_KIND` 指定用哪种美术街区 + 需要新笑点就在 `parts/props.tsx` 加一个分支 + `district.spec.json` 的 `scene` 枚举和 `recipes.md` 的 scene 表加上。**道具要通用**：画「这一类内容」的样子，不要画某一家产品的专属栏目。