journey 风格的样例分镜（`meta.style: "journey"`）。产品、栏目、标题、价格、时间和数字都是虚构的示例，不写任何真实品牌；带数字的都放进了 `meta.facts` 并标明示例。

| 文件 | 画幅 | 模板 | 内容 |
|---|---|---|---|
| `content-podcast.json` | 4:5 | 栏目巡游 | 播客平台，街巷背景（`skyline: street`），5 个频道各一站（`cafe → postbox → crossing → booth → platform`），片尾正面终点旁一个累计「1200 期节目」 |
| `software-notes.json` | 9:16 | 功能巡游 | 笔记软件，现代城市，6 个功能各一站（`postbox → phone → punch → booth → hitch → platform`），片尾一个数据「120 个模板」 |
| `software-notes-voice.json` | 9:16 | 功能巡游 + 配音 | 在 `software-notes.json` 上加配音：每站一句 `vo`（10–14 字），镜头时长由旁白决定，旁白字幕显示在角色脚下的字幕条上（`meta.voice.provider` 写的是 `minimax`，出片要环境变量 `MINIMAX_API_KEY`；**没有 key 时用 `--voice-provider mock` 或把 provider 改成 `mock` 预览**，占位音只看节奏，不能交付） |
| `travel-town.json` | 9:16 | 游线 | 文旅（`meta.industry: "travel"`），古城背景（`skyline: oldtown`），古镇 5 站：早市、城门、石桥、扎染、灯会（`market → gate → bridge → teahouse → lantern`）；价格和开放时间全部抄自 `meta.facts`（J8 逐个核对），片尾正面终点旁「5 站游线」 |

自测：`PROMO_DEV_STYLES` 不用设（风格已是 stable），`node scripts/validate.mjs styles/journey/examples/<文件>` 全部通过；出片用 `node scripts/make.mjs <文件> --out <仓库外目录>`。