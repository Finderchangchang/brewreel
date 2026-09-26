# 成人职业培训（education）推荐结构

## 1. 适用范围
成人职业技能课：办公软件、AI 应用、考证。**不做**：K12、学龄前、少儿兴趣课——brief 的 audience 或画面文字出现相关人群词，整份拒绝。

## 2. 推荐结构

### A. 干货技巧引流（办公软件），28 秒
| 镜头 | 秒 | 目的 | 字幕示例 |
|---|---|---|---|
| hook | 2.5 | 用具体痛点开场，不制造焦虑 | 姓名电话混一列？ |
| mockApp(sheet) | 6 | 按键加表格变化，演示数据为虚构 | 输第一行，按Ctrl+E |
| mockApp(app) | 5 | 展示结果 | 整列自动拆好了 |
| compare(subject=method) | 5 | 对比两种做法，不对比学员学前学后 | 同一张表 两种做法 |
| factSheet(syllabus) | 5 | 带出章节和课时 | 6章36节 从录入到透视表 |
| endCard | 4.5 | 站内入口 | 课程大纲见小黄车 |

### B. 课程介绍（直接卖课），40 秒
hook 3 → features(只写服务事实) 6 → factSheet(syllabus，要和详情页一致) 8 → credCard(person，资历逐字来自简报) 6 → steps(下单后怎么学) 7 → chat(常见问题，disclaimer 写"演示对话") 5 → priceCard/endCard 5

### C. 考证信息，35 秒
hook(时间节点) 3 → factSheet(exam，source 必填) 8 → steps(官方报名流程) 7 → factSheet(syllabus) 7 → features(模拟题、答疑期) 5 → endCard(带"考试结果取决于个人") 5

变体"AI 办公演示"：hook → mockApp(prompt) → chat(和通用"AI助手"对话) → mockApp(app) → quickList → endCard。不讲"AI 副业赚钱"。

## 3. 钩子示例
姓名电话混一列？\n一个快捷键拆开｜合并单元格\n别再手动拖了｜周报写两小时？\n让AI先起个草｜PPT排版总是乱？\n先学对齐这一步｜零基础学Excel\n课程是这么排的｜提示词写不好？\n记住这四段｜数据透视表\n一张图讲明白｜同一张表\n两种做法对比｜会议纪要\n交给AI先整理｜考前别乱刷题\n先看官方考纲

## 4. 镜头用法
- **禁用** `reviewCard`（教培不能用学员证言/评价类内容，依据《广告法》第二十四条第（三）项）。
- `compare`/`meter`/`counter` 不做"学前学后"对比，只能对比两种做法（method）。
- `credCard` 的 `creds` 必须逐字出自简报资历字段。
- 演示数据一律虚构；手机号等个人信息写成 `138****0000` 打星号的形式，完整号码会被站外联系方式规则拦住——这是预期行为。
- 画面不用微软、WPS、各家 AI 产品的 logo。
- `chat` 计入"核心动作演示"（校验的 `isDemo` 判定）只认 `panel`（带 `verdict` 或 `replies`）；只写 `messages`、没写 `panel` 的纯对话（如变体"AI 办公演示"里"和通用 AI 助手对话"那一镜）**不会**被判定为演示核心动作。想用 AI 问答类场景当演示镜，要么给 `chat` 补一个 `panel`，要么改用 `mockApp`（`kind: "editor"`，`input` 写用户说的话、`items` 写 AI 给出的结果）——本 industry 的样例 `examples/education.json` 用的是后一种写法。
- `priceCard.compare`（划线价）目前在本行业**必被拦**：`scripts/checks/index.mjs` 的 `compareHasBasis` 只在 `industries/<id>/rules.json` 的 `shotRules.priceCard.forbidCompareWhen` 写了条件时才会按条件判断，没写就直接当"总是禁止"（`evalWhen(undefined,...)` 恒真，且这里没有像 `mediaPolicy` 那样加 `!!` 判空）；education 的 `rules.json` 没定义这个字段，所以哪怕 `basis`/`evidence` 都按规范填了也会被挡。这是共享脚本的问题，不是内容问题。写划线价前先看这个字段有没有补上；补上之前，priceCard 只写活动价、不写 `compare`。

## 5. 视觉风格
- 办公软件：浅色表格底 `#F7F9FB`，主色办公绿 `#0F766E`，辅色墨蓝 `#1E2A44`（`#1F8A5B` 这类偏翠绿的色号会被校验判定"很像某聊天软件的标志绿"而报提醒，选色时避开）。
- AI 应用：深色编辑器底 `#12141C`，主色蓝紫 `#5B5BD6`。
- 考证：米白纸张底 `#FBF7EF`，主色藏青 `#1D3557`。
- 演示类镜头 5–7 秒，信息卡 5–8 秒；每屏字幕不超过 14 字。

## 6. 必备提示语
卖课视频：「学习效果因人而异」；考证课：「考试结果取决于考生个人，本课程不承诺通过；报名以官方公布为准」；录屏/模拟界面：「演示数据为虚构」；有价格：「价格以下单页为准」；用了 AI 配音：「内容由AI辅助生成」。

## 7. 最容易犯的 5 个错
1. "学员都涨薪了""上岸了"这类证言/效果承诺——教培整体禁用证言类内容。
2. "包过""保证通过""一次拿证"——承诺通过一律拦截。
3. "月入过万""学完就能接私活"——承诺收入一律拦截。
4. "名额只剩最后20个，不学就被淘汰"——制造焦虑一律拦截。
5. 演示手机号用了完整号码——改成打星号的形式。
