journey 风格的样例分镜（`meta.style: "journey"`）。产品、栏目、标题、价格、时间和数字都是虚构的示例，不写任何真实品牌；带数字的都放进了 `meta.facts` 并标明示例。

| 文件 | 画幅 | 模板 | 内容 |
|---|---|---|---|
| `content-podcast.json` | 4:5 | 栏目巡游 | 播客平台，街巷背景（`skyline: street`），5 个频道各一站（`cafe → postbox → crossing → booth → platform`），片尾「节目期数 + 频道数」 |
| `software-notes.json` | 9:16 | 功能巡游 | 笔记软件，现代城市，6 个功能各一站（`postbox → phone → punch → booth → hitch → platform`），片尾两个数据 |
| `travel-town.json` | 9:16 | 游线 | 文旅（`meta.industry: "travel"`），古城背景（`skyline: oldtown`），古镇 5 站：早市、城门、石桥、扎染、灯会（`market → gate → bridge → teahouse → lantern`）；价格和开放时间全部抄自 `meta.facts`（J8 逐个核对），片尾「5 站游线」 |

自测：`PROMO_DEV_STYLES` 不用设（风格已是 stable），`node scripts/validate.mjs styles/journey/examples/<文件>` 全部通过；出片用 `node scripts/make.mjs <文件> --out <仓库外目录>`。